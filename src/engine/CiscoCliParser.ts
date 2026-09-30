/**
 * Cisco IOS Command-Line Interface (CLI) Parser & Execution Engine
 * Directly binds to BaseDevice, RouterDevice, SwitchDevice, and VirtualInterface classes.
 */

import { BaseDevice } from './BaseDevice';
import { RouterDevice, RouteEntry } from './RouterDevice';
import { SwitchDevice } from './SwitchDevice';
import { HostDevice } from './HostDevice';
import { VirtualInterface } from './VirtualInterface';
import { NetworkDeviceData, DevicePort } from '../types/network';
import { isValidIpv4, isValidSubnetMask, maskToCidr, normalizePortId } from '../utils/networkUtils';

export type CiscoCliMode = 'user' | 'privileged' | 'config' | 'config-if' | 'config-router';

export interface CliExecutionResult {
  output: string;
  isError?: boolean;
  modeChanged?: boolean;
  newMode?: CiscoCliMode;
  prompt: string;
  deviceUpdated?: boolean;
  asyncAction?: Promise<string>;
}

export interface CommandDoc {
  command: string;
  description: string;
  modes: CiscoCliMode[];
}

export class CiscoCliParser {
  private device: BaseDevice;
  private rawData: NetworkDeviceData;
  private currentMode: CiscoCliMode = 'user';
  private activeInterfaceName: string = 'GigabitEthernet0/0';
  private activeRouterProtocol: { protocol: 'rip' | 'ospf'; processId?: string } | null = null;
  private startupConfigNVRAM: string = '';
  private onStateChange?: (updated: NetworkDeviceData) => void;

  constructor(
    device: BaseDevice,
    rawData: NetworkDeviceData,
    onStateChange?: (updated: NetworkDeviceData) => void
  ) {
    this.device = device;
    this.rawData = rawData;
    this.onStateChange = onStateChange;

    // Pick first interface as default if available
    const firstIntf = Array.from(device.interfaces.keys())[0];
    if (firstIntf) {
      this.activeInterfaceName = firstIntf;
    }
  }

  public setDevice(device: BaseDevice, rawData: NetworkDeviceData): void {
    this.device = device;
    this.rawData = rawData;
  }

  public getMode(): CiscoCliMode {
    return this.currentMode;
  }

  public setMode(mode: CiscoCliMode): void {
    this.currentMode = mode;
  }

  public getActiveInterface(): string {
    return this.activeInterfaceName;
  }

  /**
   * Generates authentic contextual Cisco prompt string
   */
  public getPrompt(): string {
    const name = this.device.name || 'Router';
    switch (this.currentMode) {
      case 'user':
        return `${name}>`;
      case 'privileged':
        return `${name}#`;
      case 'config':
        return `${name}(config)#`;
      case 'config-if': {
        const shortName = this.getShortInterfaceName(this.activeInterfaceName);
        return `${name}(config-if)#`;
      }
      case 'config-router':
        return `${name}(config-router)#`;
    }
  }

  /**
   * Main command execution entry point
   */
  public execute(rawInput: string): CliExecutionResult {
    const trimmed = rawInput.trim();
    const prompt = this.getPrompt();

    // Empty line (User pressed Enter) -> just show new prompt
    if (!trimmed) {
      return { output: '', prompt };
    }

    // Comment line in Cisco IOS
    if (trimmed.startsWith('!')) {
      return { output: '', prompt };
    }

    // Tokenize arguments (preserving quotes if needed)
    const tokens = trimmed.split(/\s+/);
    const cmd0 = tokens[0].toLowerCase();

    // Global navigation commands available across multiple modes
    if (this.isPrefixMatch(cmd0, 'exit') || this.isPrefixMatch(cmd0, 'quit')) {
      return this.handleExit();
    }

    if (this.isPrefixMatch(cmd0, 'end')) {
      return this.handleEnd();
    }

    // Mode-specific command dispatching
    switch (this.currentMode) {
      case 'user':
        return this.executeUserExec(tokens, trimmed);
      case 'privileged':
        return this.executePrivilegedExec(tokens, trimmed);
      case 'config':
        return this.executeGlobalConfig(tokens, trimmed);
      case 'config-if':
        return this.executeInterfaceConfig(tokens, trimmed);
      case 'config-router':
        return this.executeRouterConfig(tokens, trimmed);
    }
  }

  // =========================================================================
  // 1. USER EXEC MODE (Router>)
  // =========================================================================
  private executeUserExec(tokens: string[], fullInput: string): CliExecutionResult {
    const cmd0 = tokens[0].toLowerCase();

    if (this.isPrefixMatch(cmd0, 'enable')) {
      this.currentMode = 'privileged';
      return {
        output: '',
        modeChanged: true,
        newMode: 'privileged',
        prompt: this.getPrompt(),
      };
    }

    if (this.isPrefixMatch(cmd0, 'ping')) {
      return this.handlePing(tokens);
    }

    if (this.isPrefixMatch(cmd0, 'show')) {
      return this.handleShowCommand(tokens.slice(1), fullInput);
    }

    if (cmd0 === '?') {
      return { output: this.getHelp(''), prompt: this.getPrompt() };
    }

    return this.generateSyntaxError(fullInput, tokens[0]);
  }

  // =========================================================================
  // 2. PRIVILEGED EXEC MODE (Router#)
  // =========================================================================
  private executePrivilegedExec(tokens: string[], fullInput: string): CliExecutionResult {
    const cmd0 = tokens[0].toLowerCase();
    const cmd1 = tokens[1]?.toLowerCase();

    // configure terminal / conf t
    if (this.isPrefixMatch(cmd0, 'configure')) {
      if (!cmd1 || this.isPrefixMatch(cmd1, 'terminal') || cmd1 === 't') {
        this.currentMode = 'config';
        return {
          output: 'Enter configuration commands, one per line.  End with CNTL/Z.',
          modeChanged: true,
          newMode: 'config',
          prompt: this.getPrompt(),
        };
      }
      return this.generateSyntaxError(fullInput, tokens[1]);
    }

    // Shorthand 'conf t'
    if (cmd0 === 'conf' && (!cmd1 || cmd1 === 't' || this.isPrefixMatch(cmd1, 'terminal'))) {
      this.currentMode = 'config';
      return {
        output: 'Enter configuration commands, one per line.  End with CNTL/Z.',
        modeChanged: true,
        newMode: 'config',
        prompt: this.getPrompt(),
      };
    }

    // disable
    if (this.isPrefixMatch(cmd0, 'disable')) {
      this.currentMode = 'user';
      return {
        output: '',
        modeChanged: true,
        newMode: 'user',
        prompt: this.getPrompt(),
      };
    }

    // show ...
    if (this.isPrefixMatch(cmd0, 'show')) {
      return this.handleShowCommand(tokens.slice(1), fullInput);
    }

    // copy running-config startup-config / copy run start
    if (this.isPrefixMatch(cmd0, 'copy')) {
      if (tokens.length < 3) {
        return { output: '% Incomplete command.', isError: true, prompt: this.getPrompt() };
      }
      const src = tokens[1].toLowerCase();
      const dst = tokens[2].toLowerCase();
      if (
        (this.isPrefixMatch(src, 'running-config') || src === 'run') &&
        (this.isPrefixMatch(dst, 'startup-config') || dst === 'start')
      ) {
        return this.handleSaveConfig();
      }
      return this.generateSyntaxError(fullInput, tokens[1]);
    }

    // write memory / write / wr
    if (this.isPrefixMatch(cmd0, 'write') || cmd0 === 'wr') {
      if (!cmd1 || this.isPrefixMatch(cmd1, 'memory')) {
        return this.handleSaveConfig();
      }
      if (this.isPrefixMatch(cmd1, 'erase')) {
        this.startupConfigNVRAM = '';
        return {
          output: 'Erasing the nvram filesystem will remove all configuration files! Continue? [confirm]\n[OK]\nErase of nvram: complete',
          prompt: this.getPrompt(),
        };
      }
    }

    // ping
    if (this.isPrefixMatch(cmd0, 'ping')) {
      return this.handlePing(tokens);
    }

    // ai diagnose / diagnose
    if ((cmd0 === 'ai' && (cmd1 === 'diagnose' || cmd1 === 'diag')) || cmd0 === 'diagnose') {
      return {
        output: [
          'Initiating In-App AI Network Copilot Topology Scan...',
          'Scanning Layer 1 / 2 / 3 interfaces, default gateways, and routing tables...',
          `[AI Copilot]: Device ${this.device.name} verified. Check AI Diagnostics dashboard in top bar for complete network-wide report.`,
        ].join('\n'),
        prompt: this.getPrompt(),
      };
    }

    // reload
    if (this.isPrefixMatch(cmd0, 'reload')) {
      return {
        output: 'Proceed with reload? [confirm]\n\nSystem Bootstrap, Version 15.2(4)M5\nReloading system...\n[OK]',
        prompt: this.getPrompt(),
      };
    }

    if (cmd0 === '?') {
      return { output: this.getHelp(''), prompt: this.getPrompt() };
    }

    return this.generateSyntaxError(fullInput, tokens[0]);
  }

  // =========================================================================
  // 3. GLOBAL CONFIGURATION MODE (Router(config)#)
  // =========================================================================
  private executeGlobalConfig(tokens: string[], fullInput: string): CliExecutionResult {
    const cmd0 = tokens[0].toLowerCase();
    const cmd1 = tokens[1]?.toLowerCase();
    const cmd2 = tokens[2]?.toLowerCase();

    // hostname <name>
    if (this.isPrefixMatch(cmd0, 'hostname')) {
      if (!tokens[1]) {
        return { output: '% Incomplete command.', isError: true, prompt: this.getPrompt() };
      }
      const newName = tokens[1].trim();
      this.device.name = newName;
      this.rawData.name = newName;
      this.triggerStateUpdate();
      return {
        output: '',
        prompt: this.getPrompt(),
        deviceUpdated: true,
      };
    }

    // interface <name> / int <name>
    if (this.isPrefixMatch(cmd0, 'interface') || cmd0 === 'int') {
      if (!tokens[1]) {
        return { output: '% Incomplete command.', isError: true, prompt: this.getPrompt() };
      }
      const inputPort = tokens.slice(1).join('');
      const resolvedPort = this.resolveInterfaceName(inputPort);

      if (!resolvedPort) {
        return {
          output: `% Invalid interface type or number: ${inputPort}`,
          isError: true,
          prompt: this.getPrompt(),
        };
      }

      this.activeInterfaceName = resolvedPort;
      this.currentMode = 'config-if';
      return {
        output: '',
        modeChanged: true,
        newMode: 'config-if',
        prompt: this.getPrompt(),
      };
    }

    // ip route <network> <mask> <nextHop>
    if (cmd0 === 'ip' && this.isPrefixMatch(cmd1 || '', 'route')) {
      if (tokens.length < 5) {
        return {
          output: '% Incomplete command: ip route <destination_network> <subnet_mask> <next_hop_ip>',
          isError: true,
          prompt: this.getPrompt(),
        };
      }

      const net = tokens[2];
      const mask = tokens[3];
      const nextHop = tokens[4];

      if (!isValidIpv4(net) || !isValidSubnetMask(mask) || !isValidIpv4(nextHop)) {
        return {
          output: '% Invalid IP address or subnet mask provided.',
          isError: true,
          prompt: this.getPrompt(),
        };
      }

      if (this.device instanceof RouterDevice) {
        this.device.addStaticRoute(net, mask, nextHop);
      }

      // Sync into React rawData
      const newRoute: RouteEntry = {
        network: net,
        mask: mask,
        nextHop: nextHop,
        interfaceName: this.activeInterfaceName,
        metric: 1,
        proto: 'S',
      };

      const existing = (this.rawData.routingTable || []).filter((r) => r.network !== net);
      this.rawData.routingTable = [
        ...existing,
        {
          id: `route-${Date.now()}`,
          network: net,
          netmask: mask,
          nextHop: nextHop,
          type: 'S',
        },
      ];

      this.triggerStateUpdate();
      return {
        output: `[OK]: Static route added: ${net}/${maskToCidr(mask)} via ${nextHop}`,
        prompt: this.getPrompt(),
        deviceUpdated: true,
      };
    }

    // router rip / router ospf <id>
    if (this.isPrefixMatch(cmd0, 'router')) {
      if (!cmd1) {
        return { output: '% Incomplete command: router <protocol>', isError: true, prompt: this.getPrompt() };
      }
      if (this.isPrefixMatch(cmd1, 'rip')) {
        this.activeRouterProtocol = { protocol: 'rip' };
        this.currentMode = 'config-router';
        return { output: '', modeChanged: true, newMode: 'config-router', prompt: this.getPrompt() };
      }
      if (this.isPrefixMatch(cmd1, 'ospf')) {
        const pid = tokens[2] || '1';
        this.activeRouterProtocol = { protocol: 'ospf', processId: pid };
        this.currentMode = 'config-router';
        return { output: '', modeChanged: true, newMode: 'config-router', prompt: this.getPrompt() };
      }
      return this.generateSyntaxError(fullInput, tokens[1]);
    }

    // vlan <id>
    if (this.isPrefixMatch(cmd0, 'vlan')) {
      const vlanId = parseInt(tokens[1], 10);
      if (isNaN(vlanId) || vlanId < 1 || vlanId > 4094) {
        return { output: '% Invalid VLAN ID (1-4094)', isError: true, prompt: this.getPrompt() };
      }
      return { output: `VLAN ${vlanId} created / updated.`, prompt: this.getPrompt() };
    }

    // do <exec-command>
    if (cmd0 === 'do') {
      const execTokens = tokens.slice(1);
      return this.executePrivilegedExec(execTokens, execTokens.join(' '));
    }

    if (cmd0 === '?') {
      return { output: this.getHelp(''), prompt: this.getPrompt() };
    }

    return this.generateSyntaxError(fullInput, tokens[0]);
  }

  // =========================================================================
  // 4. INTERFACE CONFIGURATION MODE (Router(config-if)#)
  // =========================================================================
  private executeInterfaceConfig(tokens: string[], fullInput: string): CliExecutionResult {
    const cmd0 = tokens[0].toLowerCase();
    const cmd1 = tokens[1]?.toLowerCase();
    const cmd2 = tokens[2]?.toLowerCase();

    // ip address <ip> <subnet> / ip add <ip> <subnet>
    if (cmd0 === 'ip' && (this.isPrefixMatch(cmd1 || '', 'address') || cmd1 === 'add')) {
      if (tokens.length < 4) {
        return {
          output: '% Incomplete command: ip address <ip_address> <subnet_mask>',
          isError: true,
          prompt: this.getPrompt(),
        };
      }

      const ip = tokens[2];
      const mask = tokens[3];

      if (!isValidIpv4(ip)) {
        return { output: `% Invalid IP address: ${ip}`, isError: true, prompt: this.getPrompt() };
      }

      if (!isValidSubnetMask(mask)) {
        return { output: `% Invalid subnet mask: ${mask}`, isError: true, prompt: this.getPrompt() };
      }

      // Update Step 1 VirtualInterface instance
      const intf = this.device.interfaces.get(this.activeInterfaceName);
      if (intf) {
        intf.setIpAddress(ip, mask);
      }

      // Update Router's connected routes if router
      if (this.device instanceof RouterDevice) {
        this.device.syncConnectedRoutes();
      }

      // Sync into React device data
      this.rawData.ports = (this.rawData.ports || []).map((p) => {
        if (p.name === this.activeInterfaceName || p.id === this.activeInterfaceName) {
          return { ...p, ip, subnetMask: mask };
        }
        return p;
      });

      this.triggerStateUpdate();
      return {
        output: '',
        prompt: this.getPrompt(),
        deviceUpdated: true,
      };
    }

    // no shutdown / no shut
    if (cmd0 === 'no' && (this.isPrefixMatch(cmd1 || '', 'shutdown') || cmd1 === 'shut')) {
      const intf = this.device.interfaces.get(this.activeInterfaceName);
      if (intf) {
        intf.setAdminStatus('UP');
      }

      if (this.device instanceof RouterDevice) {
        this.device.syncConnectedRoutes();
      }

      // Sync React state
      this.rawData.ports = (this.rawData.ports || []).map((p) => {
        if (p.name === this.activeInterfaceName || p.id === this.activeInterfaceName) {
          return { ...p, status: 'up' };
        }
        return p;
      });

      this.triggerStateUpdate();

      const out = [
        `%LINK-3-UPDOWN: Interface ${this.activeInterfaceName}, changed state to up`,
        `%LINEPROTO-5-UPDOWN: Line protocol on Interface ${this.activeInterfaceName}, changed state to up`,
      ].join('\n');

      return {
        output: out,
        prompt: this.getPrompt(),
        deviceUpdated: true,
      };
    }

    // shutdown / shut
    if (this.isPrefixMatch(cmd0, 'shutdown') || cmd0 === 'shut') {
      const intf = this.device.interfaces.get(this.activeInterfaceName);
      if (intf) {
        intf.setAdminStatus('ADMIN_DOWN');
      }

      if (this.device instanceof RouterDevice) {
        this.device.syncConnectedRoutes();
      }

      // Sync React state
      this.rawData.ports = (this.rawData.ports || []).map((p) => {
        if (p.name === this.activeInterfaceName || p.id === this.activeInterfaceName) {
          return { ...p, status: 'admin_down' };
        }
        return p;
      });

      this.triggerStateUpdate();

      const out = [
        `%LINK-5-CHANGED: Interface ${this.activeInterfaceName}, changed state to administratively down`,
        `%LINEPROTO-5-UPDOWN: Line protocol on Interface ${this.activeInterfaceName}, changed state to down`,
      ].join('\n');

      return {
        output: out,
        prompt: this.getPrompt(),
        deviceUpdated: true,
      };
    }

    // switchport mode <access|trunk>
    if (this.isPrefixMatch(cmd0, 'switchport') && this.isPrefixMatch(cmd1 || '', 'mode')) {
      const mode = cmd2 === 'trunk' ? 'TRUNK' : 'ACCESS';
      const intf = this.device.interfaces.get(this.activeInterfaceName);
      if (intf) {
        intf.vlanMode = mode;
      }
      this.rawData.ports = (this.rawData.ports || []).map((p) =>
        p.name === this.activeInterfaceName || p.id === this.activeInterfaceName ? { ...p, vlanMode: mode } : p
      );
      this.triggerStateUpdate();
      return { output: '', prompt: this.getPrompt(), deviceUpdated: true };
    }

    // switchport access vlan <id>
    if (
      this.isPrefixMatch(cmd0, 'switchport') &&
      this.isPrefixMatch(cmd1 || '', 'access') &&
      this.isPrefixMatch(cmd2 || '', 'vlan')
    ) {
      const vid = parseInt(tokens[3], 10);
      if (!isNaN(vid)) {
        const intf = this.device.interfaces.get(this.activeInterfaceName);
        if (intf) intf.accessVlan = vid;
        this.rawData.ports = (this.rawData.ports || []).map((p) =>
          p.name === this.activeInterfaceName || p.id === this.activeInterfaceName ? { ...p, vlanId: vid } : p
        );
        this.triggerStateUpdate();
      }
      return { output: '', prompt: this.getPrompt(), deviceUpdated: true };
    }

    // description <text>
    if (this.isPrefixMatch(cmd0, 'description')) {
      return { output: '', prompt: this.getPrompt() };
    }

    // do <command>
    if (cmd0 === 'do') {
      const execTokens = tokens.slice(1);
      return this.executePrivilegedExec(execTokens, execTokens.join(' '));
    }

    if (cmd0 === '?') {
      return { output: this.getHelp(''), prompt: this.getPrompt() };
    }

    return this.generateSyntaxError(fullInput, tokens[0]);
  }

  // =========================================================================
  // 5. ROUTER ROUTING CONFIG MODE (Router(config-router)#)
  // =========================================================================
  private executeRouterConfig(tokens: string[], fullInput: string): CliExecutionResult {
    const cmd0 = tokens[0].toLowerCase();

    // network <net>
    if (this.isPrefixMatch(cmd0, 'network')) {
      if (!tokens[1]) {
        return { output: '% Incomplete command: network <network_number>', isError: true, prompt: this.getPrompt() };
      }
      return { output: '', prompt: this.getPrompt() };
    }

    // version 2
    if (this.isPrefixMatch(cmd0, 'version')) {
      return { output: '', prompt: this.getPrompt() };
    }

    // no auto-summary
    if (cmd0 === 'no' && this.isPrefixMatch(tokens[1] || '', 'auto-summary')) {
      return { output: '', prompt: this.getPrompt() };
    }

    // do <command>
    if (cmd0 === 'do') {
      const execTokens = tokens.slice(1);
      return this.executePrivilegedExec(execTokens, execTokens.join(' '));
    }

    if (cmd0 === '?') {
      return { output: this.getHelp(''), prompt: this.getPrompt() };
    }

    return this.generateSyntaxError(fullInput, tokens[0]);
  }

  // =========================================================================
  // SHOW COMMAND ENGINE (show ip int br, show ip route, show mac, etc.)
  // =========================================================================
  private handleShowCommand(subTokens: string[], fullInput: string): CliExecutionResult {
    if (subTokens.length === 0) {
      return { output: '% Incomplete command.', isError: true, prompt: this.getPrompt() };
    }

    const sub0 = subTokens[0].toLowerCase();
    const sub1 = subTokens[1]?.toLowerCase();
    const sub2 = subTokens[2]?.toLowerCase();

    // show ip interface brief / sh ip int br
    if (
      this.isPrefixMatch(sub0, 'ip') &&
      this.isPrefixMatch(sub1 || '', 'interface') &&
      (!sub2 || this.isPrefixMatch(sub2, 'brief') || sub2 === 'br')
    ) {
      return { output: this.renderShowIpInterfaceBrief(), prompt: this.getPrompt() };
    }

    // show ip route / sh ip ro
    if (this.isPrefixMatch(sub0, 'ip') && (this.isPrefixMatch(sub1 || '', 'route') || sub1 === 'ro')) {
      return { output: this.renderShowIpRoute(), prompt: this.getPrompt() };
    }

    // show mac address-table / sh mac
    if (
      this.isPrefixMatch(sub0, 'mac') ||
      (this.isPrefixMatch(sub0, 'mac-address-table') && (!sub1 || this.isPrefixMatch(sub1, 'address-table')))
    ) {
      return { output: this.renderShowMacAddressTable(), prompt: this.getPrompt() };
    }

    // show running-config / sh run
    if (this.isPrefixMatch(sub0, 'running-config') || sub0 === 'run') {
      return { output: this.renderRunningConfig(), prompt: this.getPrompt() };
    }

    // show startup-config / sh start
    if (this.isPrefixMatch(sub0, 'startup-config') || sub0 === 'start') {
      if (!this.startupConfigNVRAM) {
        return {
          output: '%% Non-volatile configuration memory invalid or not present',
          prompt: this.getPrompt(),
        };
      }
      return { output: this.startupConfigNVRAM, prompt: this.getPrompt() };
    }

    // show arp / sh ip arp
    if (sub0 === 'arp' || (sub0 === 'ip' && sub1 === 'arp')) {
      return { output: this.renderShowArpTable(), prompt: this.getPrompt() };
    }

    // show version / sh ver
    if (this.isPrefixMatch(sub0, 'version') || sub0 === 'ver') {
      return {
        output: [
          'Cisco IOS Software, 1941 Software (C3600-ADVIPSERVICESK9-M), Version 15.2(4)M5',
          'Technical Support: http://www.cisco.com/techsupport',
          `${this.device.name} uptime is 4 hours, 12 minutes`,
          'System returned to ROM by power-on',
          'System image file is "flash0:c3600-advipservicesk9-mz.152-4.M5.bin"',
          'Cisco 1941 (revision 1.0) with 512MB of processor board System memory.',
          '2 Gigabit Ethernet interfaces',
          'DRAM configuration is 64 bits wide with parity disabled.',
          '255K bytes of non-volatile configuration memory.',
          'Configuration register is 0x2102',
        ].join('\n'),
        prompt: this.getPrompt(),
      };
    }

    return this.generateSyntaxError(fullInput, subTokens[0]);
  }

  // =========================================================================
  // FORMATTED CISCO TABLES & OUTPUT
  // =========================================================================

  private renderShowIpInterfaceBrief(): string {
    const header = 'Interface                  IP-Address      OK? Method Status                Protocol';
    const separator = '-----------------------------------------------------------------------------';

    const ports = this.rawData.ports || [];
    const rows = ports.map((p) => {
      const name = p.name.padEnd(26, ' ');
      const ip = (p.ip || 'unassigned').padEnd(16, ' ');
      const ok = 'YES'.padEnd(4, ' ');
      const method = (p.ip ? 'manual' : 'unset ').padEnd(7, ' ');

      let statusStr = '';
      let protoStr = '';

      if (p.status === 'admin_down') {
        statusStr = 'administratively down'.padEnd(22, ' ');
        protoStr = 'down';
      } else if (p.status === 'down') {
        statusStr = 'down'.padEnd(22, ' ');
        protoStr = 'down';
      } else {
        const intf = this.device.interfaces.get(p.name);
        const isUp = intf?.isOperational() ?? (p.status === 'up');
        statusStr = (isUp ? 'up' : 'down').padEnd(22, ' ');
        protoStr = isUp ? 'up' : 'down';
      }

      return `${name}${ip}${ok}${method}${statusStr}${protoStr}`;
    });

    return [header, separator, ...rows].join('\n');
  }

  private renderShowIpRoute(): string {
    if (this.device instanceof RouterDevice) {
      return this.device.getFormattedRoutingTable();
    }

    const banner = [
      'Codes: L - local, C - connected, S - static, R - RIP, M - mobile, B - BGP',
      '       D - EIGRP, EX - EIGRP external, O - OSPF, IA - OSPF inter area',
      '       Gateway of last resort is not set\n',
    ].join('\n');

    const routes = this.rawData.routingTable || [];
    const rows = routes.map((r) => {
      const cidr = maskToCidr(r.netmask);
      if (r.type === 'C') {
        return `C    ${r.network}/${cidr} is directly connected, ${r.interface || 'GigabitEthernet0/0'}`;
      } else {
        return `S    ${r.network}/${cidr} [1/0] via ${r.nextHop}, ${r.interface || 'GigabitEthernet0/0'}`;
      }
    });

    return `${banner}\n${rows.length > 0 ? rows.join('\n') : '% No routes present in table'}\n`;
  }

  private renderShowMacAddressTable(): string {
    if (this.device instanceof SwitchDevice) {
      return this.device.getFormattedMacTable();
    }

    const header = '          Mac Address Table\n-------------------------------------------';
    const subheader = 'Vlan    Mac Address       Type        Ports\n----    -----------       --------    -----';

    const macs = this.rawData.macTable || [];
    if (macs.length === 0) {
      return `${header}\n${subheader}\nTotal Mac Addresses for this criterion: 0\n`;
    }

    const rows = macs.map((m) => {
      const vlanStr = (m.vlan || 1).toString().padEnd(8, ' ');
      const macStr = m.mac.toLowerCase().padEnd(18, ' ');
      const typeStr = (m.type || 'DYNAMIC').padEnd(12, ' ');
      const portStr = m.portId;
      return `${vlanStr}${macStr}${typeStr}${portStr}`;
    });

    return `${header}\n${subheader}\n${rows.join('\n')}\nTotal Mac Addresses for this criterion: ${rows.length}\n`;
  }

  private renderShowArpTable(): string {
    const header = 'Protocol  Address          Age (min)  Hardware Addr   Type   Interface';
    const rows: string[] = [];

    const arp =
      this.device instanceof RouterDevice || this.device instanceof HostDevice
        ? this.device.arpTable
        : new Map(Object.entries(this.rawData.arpTable || {}));

    for (const [ip, mac] of arp.entries()) {
      rows.push(`Internet  ${ip.padEnd(17, ' ')} -          ${mac.toLowerCase().padEnd(16, ' ')} ARPA   ${this.activeInterfaceName}`);
    }

    if (rows.length === 0) {
      return `${header}\nInternet  ${this.rawData.ip || '192.168.1.1'}       -          ${this.rawData.mac.toLowerCase()} ARPA   ${this.activeInterfaceName}`;
    }

    return [header, ...rows].join('\n');
  }

  private renderRunningConfig(): string {
    const ports = this.rawData.ports || [];
    const portConfigs = ports
      .map((p) => {
        const ipLine = p.ip ? ` ip address ${p.ip} ${p.subnetMask || '255.255.255.0'}` : ' no ip address';
        const shutLine = p.status === 'admin_down' ? ' shutdown' : ' no shutdown';
        const duplexLine = ' duplex auto\n speed auto';
        return `interface ${p.name}\n${ipLine}\n${shutLine}\n${duplexLine}\n!`;
      })
      .join('\n');

    const routeConfigs = (this.rawData.routingTable || [])
      .filter((r) => r.type === 'S')
      .map((r) => `ip route ${r.network} ${r.netmask} ${r.nextHop}`)
      .join('\n');

    return [
      'Current configuration : 1148 bytes',
      '!',
      'version 15.2',
      'no service timestamps log datetime msec',
      'no service timestamps debug datetime msec',
      'no service password-encryption',
      '!',
      `hostname ${this.device.name}`,
      '!',
      'ip cef',
      'no ipv6 cef',
      '!',
      portConfigs,
      routeConfigs ? routeConfigs + '\n!' : '',
      'line con 0',
      'line vty 0 4',
      ' login',
      '!',
      'end',
    ]
      .filter(Boolean)
      .join('\n');
  }

  private handleSaveConfig(): CliExecutionResult {
    this.startupConfigNVRAM = this.renderRunningConfig();
    return {
      output: 'Destination filename [startup-config]? \nBuilding configuration...\n[OK]',
      prompt: this.getPrompt(),
    };
  }

  // =========================================================================
  // PING HANDLER
  // =========================================================================
  private handlePing(tokens: string[]): CliExecutionResult {
    if (tokens.length < 2) {
      return { output: '% Incomplete command: ping <target_ip>', isError: true, prompt: this.getPrompt() };
    }
    const targetIp = tokens[1];
    if (!isValidIpv4(targetIp)) {
      return { output: `% Unrecognized host or address: ${targetIp}`, isError: true, prompt: this.getPrompt() };
    }

    const output = [
      `Type escape sequence to abort.`,
      `Sending 5, 100-byte ICMP Echos to ${targetIp}, timeout is 2 seconds:`,
      `!!!!!`,
      `Success rate is 100 percent (5/5), round-trip min/avg/max = 1/2/4 ms`,
    ].join('\n');

    return { output, prompt: this.getPrompt() };
  }

  // =========================================================================
  // NAVIGATION: EXIT & END
  // =========================================================================
  public handleExit(): CliExecutionResult {
    switch (this.currentMode) {
      case 'user':
        return { output: '\n[Connection to device closed]', prompt: this.getPrompt() };
      case 'privileged':
        this.currentMode = 'user';
        return { output: '', modeChanged: true, newMode: 'user', prompt: this.getPrompt() };
      case 'config':
        this.currentMode = 'privileged';
        return { output: '', modeChanged: true, newMode: 'privileged', prompt: this.getPrompt() };
      case 'config-if':
      case 'config-router':
        this.currentMode = 'config';
        return { output: '', modeChanged: true, newMode: 'config', prompt: this.getPrompt() };
    }
  }

  public handleEnd(): CliExecutionResult {
    if (this.currentMode !== 'user' && this.currentMode !== 'privileged') {
      this.currentMode = 'privileged';
      return {
        output: '%SYS-5-CONFIG_I: Configured from console by console',
        modeChanged: true,
        newMode: 'privileged',
        prompt: this.getPrompt(),
      };
    }
    return { output: '', prompt: this.getPrompt() };
  }

  // =========================================================================
  // TAB AUTOCOMPLETE & '?' CONTEXTUAL HELP
  // =========================================================================

  public autocomplete(input: string): { completed: string; suggestions?: string[] } {
    const trimmed = input.trimStart();
    const tokens = trimmed.split(/\s+/);
    const commands = this.getCommandsForCurrentMode();

    if (tokens.length === 1) {
      const partial = tokens[0].toLowerCase();
      const matches = commands.filter((c) => c.command.toLowerCase().startsWith(partial));
      if (matches.length === 1) {
        return { completed: matches[0].command + ' ' };
      }
      if (matches.length > 1) {
        return { completed: input, suggestions: matches.map((m) => m.command) };
      }
    } else if (tokens.length === 2 && this.isPrefixMatch(tokens[0], 'show')) {
      const partial = tokens[1].toLowerCase();
      const showOptions = ['ip', 'interfaces', 'mac address-table', 'running-config', 'startup-config', 'version', 'arp'];
      const matches = showOptions.filter((o) => o.startsWith(partial));
      if (matches.length === 1) {
        return { completed: `show ${matches[0]} ` };
      }
      if (matches.length > 1) {
        return { completed: input, suggestions: matches };
      }
    } else if (tokens.length === 2 && (this.isPrefixMatch(tokens[0], 'interface') || tokens[0] === 'int')) {
      const partial = tokens[1].toLowerCase();
      const ports = this.rawData.ports?.map((p) => p.name) || ['GigabitEthernet0/0', 'GigabitEthernet0/1'];
      const matches = ports.filter((p) => p.toLowerCase().startsWith(partial));
      if (matches.length === 1) {
        return { completed: `interface ${matches[0]} ` };
      }
      if (matches.length > 1) {
        return { completed: input, suggestions: matches };
      }
    }

    return { completed: input };
  }

  public getHelp(input: string): string {
    const trimmed = input.trim();
    const tokens = trimmed ? trimmed.split(/\s+/) : [];

    if (tokens.length === 0 || (tokens.length === 1 && input.endsWith('?'))) {
      const commands = this.getCommandsForCurrentMode();
      const padLen = 24;
      const lines = commands.map((c) => `  ${c.command.padEnd(padLen, ' ')} ${c.description}`);
      return lines.join('\n');
    }

    const cmd0 = tokens[0].toLowerCase();

    if (this.isPrefixMatch(cmd0, 'show')) {
      return [
        '  ip               IP information',
        '  interfaces       Interface status and configuration',
        '  mac              MAC address table',
        '  running-config   Current operating configuration',
        '  startup-config   Contents of startup configuration',
        '  version          System hardware and software status',
      ].join('\n');
    }

    if (cmd0 === 'ip') {
      return [
        '  address          Set IPv4 address and subnet mask',
        '  route            Establish static routes',
        '  interface        IP interface status and configuration',
      ].join('\n');
    }

    return this.getHelp('');
  }

  private getCommandsForCurrentMode(): CommandDoc[] {
    switch (this.currentMode) {
      case 'user':
        return [
          { command: 'enable', description: 'Turn on privileged commands', modes: ['user'] },
          { command: 'ping', description: 'Send echo messages', modes: ['user'] },
          { command: 'show', description: 'Show running system information', modes: ['user'] },
          { command: 'exit', description: 'Exit from EXEC mode', modes: ['user'] },
          { command: 'help', description: 'Description of the interactive help system', modes: ['user'] },
        ];
      case 'privileged':
        return [
          { command: 'configure', description: 'Enter configuration mode', modes: ['privileged'] },
          { command: 'disable', description: 'Turn off privileged commands', modes: ['privileged'] },
          { command: 'ping', description: 'Send echo messages', modes: ['privileged'] },
          { command: 'show', description: 'Show running system information', modes: ['privileged'] },
          { command: 'copy', description: 'Copy from one file to another', modes: ['privileged'] },
          { command: 'write', description: 'Write running configuration to memory', modes: ['privileged'] },
          { command: 'reload', description: 'Halt and perform a cold restart', modes: ['privileged'] },
          { command: 'exit', description: 'Exit from EXEC mode', modes: ['privileged'] },
        ];
      case 'config':
        return [
          { command: 'hostname', description: 'Set system network name', modes: ['config'] },
          { command: 'interface', description: 'Select an interface to configure', modes: ['config'] },
          { command: 'ip', description: 'Global IP configuration subcommands', modes: ['config'] },
          { command: 'router', description: 'Enable a routing process', modes: ['config'] },
          { command: 'vlan', description: 'VLAN configuration', modes: ['config'] },
          { command: 'do', description: 'Execute an EXEC-level command', modes: ['config'] },
          { command: 'exit', description: 'Exit from configure mode', modes: ['config'] },
          { command: 'end', description: 'Exit to privileged EXEC mode', modes: ['config'] },
        ];
      case 'config-if':
        return [
          { command: 'ip', description: 'Interface IP configuration subcommands', modes: ['config-if'] },
          { command: 'shutdown', description: 'Shutdown the selected interface', modes: ['config-if'] },
          { command: 'no', description: 'Negate a command or set its defaults', modes: ['config-if'] },
          { command: 'switchport', description: 'Set switching characteristics of the interface', modes: ['config-if'] },
          { command: 'description', description: 'Interface specific description', modes: ['config-if'] },
          { command: 'duplex', description: 'Configure duplex operation', modes: ['config-if'] },
          { command: 'speed', description: 'Configure speed operation', modes: ['config-if'] },
          { command: 'do', description: 'Execute an EXEC-level command', modes: ['config-if'] },
          { command: 'exit', description: 'Exit from interface configuration mode', modes: ['config-if'] },
          { command: 'end', description: 'Exit to privileged EXEC mode', modes: ['config-if'] },
        ];
      case 'config-router':
        return [
          { command: 'network', description: 'Enable routing on an IP network', modes: ['config-router'] },
          { command: 'version', description: 'Set routing protocol version', modes: ['config-router'] },
          { command: 'no', description: 'Negate a command or set its defaults', modes: ['config-router'] },
          { command: 'exit', description: 'Exit from routing protocol configuration', modes: ['config-router'] },
          { command: 'end', description: 'Exit to privileged EXEC mode', modes: ['config-router'] },
        ];
    }
  }

  // =========================================================================
  // HELPER UTILITIES
  // =========================================================================

  private isPrefixMatch(input: string, fullCommand: string): boolean {
    if (!input || !fullCommand) return false;
    return fullCommand.toLowerCase().startsWith(input.toLowerCase());
  }

  private resolveInterfaceName(input: string): string | null {
    const raw = input.trim();
    // Check direct match
    const existing = (this.rawData.ports || []).map((p) => p.name);
    for (const p of existing) {
      if (p.toLowerCase() === raw.toLowerCase()) return p;
    }

    // Shorthand expansions: gig0/0 -> GigabitEthernet0/0, fa0/1 -> FastEthernet0/1
    const normalized = normalizePortId(raw);
    for (const p of existing) {
      if (p.toLowerCase() === normalized.toLowerCase()) return p;
    }

    return null;
  }

  private getShortInterfaceName(name: string): string {
    return name
      .replace(/^GigabitEthernet/i, 'Gig')
      .replace(/^FastEthernet/i, 'Fa')
      .replace(/^Ethernet/i, 'Eth')
      .replace(/^Serial/i, 'Se');
  }

  private generateSyntaxError(fullCommand: string, badToken: string): CliExecutionResult {
    const markerIndex = fullCommand.indexOf(badToken);
    const spaces = ' '.repeat(Math.max(0, markerIndex));
    const output = `% Invalid input detected at '^' marker.\n${spaces}^`;
    return {
      output,
      isError: true,
      prompt: this.getPrompt(),
    };
  }

  private triggerStateUpdate(): void {
    if (this.onStateChange) {
      this.onStateChange({ ...this.rawData });
    }
  }
}
