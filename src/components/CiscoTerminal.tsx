/**
 * Cisco IOS Terminal Component
 * Production-ready web terminal emulator binding directly to CiscoCliParser
 * with authentic Cisco IOS command hierarchy, shorthand expansion, and mobile accessory bar.
 */

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { NetworkDeviceData, PingSimulationResult, DevicePort } from '../types/network';
import { Terminal as TerminalIcon, Sparkles } from 'lucide-react';
import { CiscoCliParser, CiscoCliMode } from '../engine/CiscoCliParser';
import { RouterDevice } from '../engine/RouterDevice';
import { SwitchDevice } from '../engine/SwitchDevice';
import { HostDevice } from '../engine/HostDevice';
import { VirtualInterface } from '../engine/VirtualInterface';
import { BaseDevice } from '../engine/BaseDevice';
import { runAiNetworkDiagnostics } from '../engine/AiDiagnosticEngine';

interface CiscoTerminalProps {
  device: NetworkDeviceData;
  allDevices?: NetworkDeviceData[];
  nodes?: any[];
  edges?: any[];
  onUpdateDevice: (updated: NetworkDeviceData) => void;
  onTriggerPing?: (sourceId: string, destId: string) => Promise<PingSimulationResult>;
}

interface TerminalLine {
  id: string;
  type: 'input' | 'output' | 'error' | 'banner';
  text: string;
}

export const CiscoTerminal: React.FC<CiscoTerminalProps> = ({
  device,
  allDevices = [],
  nodes = [],
  edges = [],
  onUpdateDevice,
  onTriggerPing,
}) => {
  // Instantiate Engine Device instance for direct state mutation
  const engineDevice = useMemo(() => {
    let dev: BaseDevice;
    if (device.type === 'router') {
      dev = new RouterDevice(device.id, device.name);
    } else if (device.type === 'switch' || device.type === 'hub') {
      dev = new SwitchDevice(device.id, device.name);
    } else {
      dev = new HostDevice(device.id, device.name, device.type === 'server' ? 'server' : 'pc');
    }

    // Populate interfaces
    for (const p of device.ports || []) {
      const intf = new VirtualInterface({
        name: p.name || p.id,
        macAddress: p.mac || device.mac,
        ownerDevice: dev,
        ipAddress: p.ip,
        subnetMask: p.subnetMask,
        status: p.status === 'up' ? 'UP' : p.status === 'down' ? 'DOWN' : 'ADMIN_DOWN',
        vlanMode: p.vlanMode || 'ACCESS',
        accessVlan: p.vlanId || 1,
      });
      dev.addInterface(intf);
    }

    if (dev instanceof RouterDevice) {
      dev.syncConnectedRoutes();
      if (device.routingTable) {
        for (const r of device.routingTable) {
          if (r.type === 'S' && r.nextHop) {
            dev.addStaticRoute(r.network, r.netmask, r.nextHop);
          }
        }
      }
    }

    return dev;
  }, [device.id, device.type]);

  // Parser instance
  const parser = useMemo(() => {
    return new CiscoCliParser(engineDevice, device, (updated) => {
      onUpdateDevice(updated);
    });
  }, [engineDevice, device, onUpdateDevice]);

  // Terminal UI State
  const [lines, setLines] = useState<TerminalLine[]>([]);
  const [inputVal, setInputVal] = useState('');
  const [cliMode, setCliMode] = useState<CiscoCliMode>('user');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState<number>(-1);
  const [isExecuting, setIsExecuting] = useState(false);

  const terminalEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize terminal banner
  useEffect(() => {
    const isRouter = device.type === 'router';
    const isSwitch = device.type === 'switch';
    const model = device.model || (isRouter ? '1941' : isSwitch ? '2960' : 'C3600');

    setLines([
      {
        id: 'banner-1',
        type: 'banner',
        text: `Cisco IOS Software, ${model} Software (C3600-ADVIPSERVICESK9-M), Version 15.2(4)M5, RELEASE SOFTWARE (fc2)`,
      },
      {
        id: 'banner-2',
        type: 'banner',
        text: `Technical Support: http://www.cisco.com/techsupport`,
      },
      {
        id: 'banner-3',
        type: 'banner',
        text: `Compiled Cisco IOS NetCanvas Simulator. System image file is "flash0:c3600-advipservicesk9-mz.152-4.M5.bin"\n`,
      },
      {
        id: 'banner-4',
        type: 'banner',
        text: `Press RETURN or tap quick shortcuts below to get started!\n`,
      },
    ]);

    parser.setDevice(engineDevice, device);
    setCliMode(parser.getMode());
  }, [device.id]);

  // Keep device data synchronized
  useEffect(() => {
    parser.setDevice(engineDevice, device);
  }, [device, engineDevice, parser]);

  // Auto-scroll
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines, isExecuting]);

  const addLine = (type: TerminalLine['type'], text: string) => {
    setLines((prev) => [...prev, { id: `${Date.now()}-${Math.random()}`, type, text }]);
  };

  const executeCommand = useCallback(
    async (cmdText: string) => {
      const trimmed = cmdText.trim();
      const currentPrompt = parser.getPrompt();

      // Echo command input line
      addLine('input', `${currentPrompt} ${cmdText}`);

      if (!trimmed) {
        return;
      }

      // Record in history
      setCommandHistory((prev) => [...prev.filter((c) => c !== trimmed), trimmed]);
      setHistoryIdx(-1);

      // Check if command is ping
      const tokens = trimmed.split(/\s+/);
      if (tokens[0].toLowerCase() === 'ping' && tokens[1] && onTriggerPing) {
        const targetIp = tokens[1];
        const targetDev = allDevices.find((d) => d.ip === targetIp);
        if (targetDev) {
          setIsExecuting(true);
          try {
            addLine('output', `Type escape sequence to abort.\nSending 5, 100-byte ICMP Echos to ${targetIp}, timeout is 2 seconds:`);
            const res = await onTriggerPing(device.id, targetDev.id);
            if (res.success) {
              addLine('output', `!!!!!\nSuccess rate is 100 percent (5/5), round-trip min/avg/max = 1/2/4 ms`);
            } else {
              addLine('output', `.....\nSuccess rate is 0 percent (0/5)`);
            }
          } catch {
            addLine('output', `.....\nSuccess rate is 0 percent (0/5)`);
          } finally {
            setIsExecuting(false);
          }
          return;
        }
      }

      // Check if command is ai diagnose / diagnose
      if (
        (tokens[0].toLowerCase() === 'ai' && (tokens[1]?.toLowerCase() === 'diagnose' || tokens[1]?.toLowerCase() === 'diag')) ||
        tokens[0].toLowerCase() === 'diagnose'
      ) {
        const report = runAiNetworkDiagnostics(nodes, edges);
        let out = `--- Cisco In-App AI Network Copilot Diagnostics ---\n`;
        out += `Topology Scan: ${report.totalDevices} devices, ${report.totalLinks} links\n`;
        out += `Network Health Score: ${report.healthScore}%\n`;
        out += `Summary: ${report.summary}\n`;
        if (report.issues.length === 0) {
          out += `\n[OK] No configuration flaws or link anomalies detected. Network is optimal.`;
        } else {
          out += `\nDetected Issues (${report.issues.length}):\n`;
          report.issues.forEach((iss, idx) => {
            out += `\n${idx + 1}. [${iss.severity.toUpperCase()}] ${iss.title}\n`;
            out += `   ${iss.description}\n`;
            if (iss.suggestedCli && iss.suggestedCli.length > 0) {
              out += `   Remediation CLI:\n`;
              iss.suggestedCli.forEach((cli) => {
                out += `     ${cli}\n`;
              });
            }
          });
        }
        addLine('output', out);
        return;
      }

      // Execute via CiscoCliParser
      const result = parser.execute(trimmed);

      if (result.modeChanged && result.newMode) {
        setCliMode(result.newMode);
      }

      if (result.output) {
        addLine(result.isError ? 'error' : 'output', result.output);
      }
    },
    [parser, onTriggerPing, allDevices, device.id, nodes, edges]
  );

  // Handle Enter
  const handleEnterKey = () => {
    const text = inputVal;
    setInputVal('');
    executeCommand(text);
  };

  // Keyboard navigation & Shortcuts
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Enter
    if (e.key === 'Enter') {
      e.preventDefault();
      handleEnterKey();
      return;
    }

    // Tab Autocompletion
    if (e.key === 'Tab') {
      e.preventDefault();
      handleTabCompletion();
      return;
    }

    // '?' Contextual Help
    if (e.key === '?') {
      e.preventDefault();
      handleContextHelp();
      return;
    }

    // Ctrl+C (Abort line)
    if (e.ctrlKey && e.key.toLowerCase() === 'c') {
      e.preventDefault();
      handleCtrlC();
      return;
    }

    // Ctrl+Z (Jump to Privileged EXEC mode)
    if (e.ctrlKey && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      const currentPrompt = parser.getPrompt();
      addLine('input', `${currentPrompt} ^Z`);
      const res = parser.handleEnd();
      setCliMode(parser.getMode());
      if (res.output) addLine('output', res.output);
      setInputVal('');
      return;
    }

    // History Up
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      handleHistoryUp();
      return;
    }

    // History Down
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      handleHistoryDown();
      return;
    }
  };

  // [Tab] Autocomplete
  const handleTabCompletion = () => {
    const res = parser.autocomplete(inputVal);
    if (res.suggestions && res.suggestions.length > 1) {
      addLine('input', `${parser.getPrompt()} ${inputVal}`);
      addLine('output', res.suggestions.join('  '));
    } else if (res.completed !== inputVal) {
      setInputVal(res.completed);
    }
  };

  // [?] Contextual Help
  const handleContextHelp = () => {
    addLine('input', `${parser.getPrompt()} ${inputVal}?`);
    const helpText = parser.getHelp(inputVal);
    addLine('output', helpText);
    // Keep current input intact
    inputRef.current?.focus();
  };

  // [Ctrl+C] Abort line
  const handleCtrlC = () => {
    addLine('input', `${parser.getPrompt()} ${inputVal}^C`);
    setInputVal('');
    inputRef.current?.focus();
  };

  // [▲ Up] History Up
  const handleHistoryUp = () => {
    if (commandHistory.length === 0) return;
    const nextIdx = historyIdx === -1 ? commandHistory.length - 1 : Math.max(0, historyIdx - 1);
    setHistoryIdx(nextIdx);
    setInputVal(commandHistory[nextIdx]);
  };

  // [▼ Down] History Down
  const handleHistoryDown = () => {
    if (commandHistory.length === 0 || historyIdx === -1) return;
    const nextIdx = historyIdx + 1;
    if (nextIdx >= commandHistory.length) {
      setHistoryIdx(-1);
      setInputVal('');
    } else {
      setHistoryIdx(nextIdx);
      setInputVal(commandHistory[nextIdx]);
    }
  };

  // Contextual Quick Action Pills based on Current Mode
  const quickPillCommands = useMemo(() => {
    switch (cliMode) {
      case 'user':
        return [
          { label: 'enable', cmd: 'enable' },
          { label: 'sh ip int br', cmd: 'show ip interface brief' },
          { label: 'ping ...', cmd: 'ping 192.168.1.1' },
          { label: '?', cmd: '?' },
        ];
      case 'privileged':
        return [
          { label: 'conf t', cmd: 'configure terminal' },
          { label: 'sh ip int br', cmd: 'show ip interface brief' },
          { label: 'sh ip ro', cmd: 'show ip route' },
          { label: 'sh mac', cmd: 'show mac address-table' },
          { label: 'sh run', cmd: 'show running-config' },
          { label: 'wr', cmd: 'write memory' },
          { label: 'disable', cmd: 'disable' },
        ];
      case 'config':
        return [
          { label: 'int g0/0', cmd: 'interface GigabitEthernet0/0' },
          { label: 'int fa0/1', cmd: 'interface FastEthernet0/1' },
          { label: 'hostname ...', cmd: 'hostname ' },
          { label: 'ip route ...', cmd: 'ip route 192.168.2.0 255.255.255.0 192.168.1.1' },
          { label: 'exit', cmd: 'exit' },
          { label: 'end', cmd: 'end' },
        ];
      case 'config-if':
        return [
          { label: 'no shut', cmd: 'no shutdown' },
          { label: 'shut', cmd: 'shutdown' },
          { label: 'ip add ...', cmd: 'ip address 192.168.1.1 255.255.255.0' },
          { label: 'sw mode acc', cmd: 'switchport mode access' },
          { label: 'sw mode trunk', cmd: 'switchport mode trunk' },
          { label: 'exit', cmd: 'exit' },
          { label: 'end', cmd: 'end' },
        ];
      case 'config-router':
        return [
          { label: 'network ...', cmd: 'network 192.168.1.0' },
          { label: 'version 2', cmd: 'version 2' },
          { label: 'exit', cmd: 'exit' },
          { label: 'end', cmd: 'end' },
        ];
    }
  }, [cliMode]);

  return (
    <div className="flex flex-col h-full bg-[#0a0f1d] text-slate-100 font-mono text-xs select-none">
      {/* Top Header Bar */}
      <div className="px-4 py-2.5 bg-[#0f172a] border-b border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <TerminalIcon className="w-4 h-4 text-emerald-400" />
          <span className="font-bold text-slate-200 text-xs">
            {device.name} — Cisco IOS Software (CLI)
          </span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-emerald-400 border border-emerald-500/30">
            {cliMode.toUpperCase()}
          </span>
        </div>
        <div className="text-[11px] text-slate-400 hidden sm:block">
          Type <span className="text-emerald-400 font-bold">?</span> for help, <span className="text-sky-400 font-bold">Tab</span> for autocomplete
        </div>
      </div>

      {/* Contextual Quick Command Chips */}
      <div className="px-3 py-1.5 bg-[#0b1324] border-b border-slate-800/80 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
        <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mr-1 shrink-0 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-amber-400" /> Shortcuts:
        </span>
        {quickPillCommands.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => {
              if (item.cmd.endsWith(' ') || item.cmd.includes('...')) {
                setInputVal(item.cmd);
                inputRef.current?.focus();
              } else {
                executeCommand(item.cmd);
              }
            }}
            className="px-2.5 py-1 rounded-md bg-slate-800/90 hover:bg-slate-700 active:scale-95 text-slate-200 border border-slate-700/80 text-[11px] font-mono whitespace-nowrap transition-all cursor-pointer touch-manipulation shadow-xs hover:text-emerald-400"
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Terminal Output Area */}
      <div
        className="flex-1 p-3.5 overflow-y-auto space-y-1 text-slate-100 bg-black cursor-text select-text leading-relaxed"
        onClick={() => inputRef.current?.focus()}
      >
        {lines.map((line) => {
          if (line.type === 'banner') {
            return (
              <div key={line.id} className="text-slate-400 text-[11px]">
                {line.text}
              </div>
            );
          }
          if (line.type === 'input') {
            return (
              <div key={line.id} className="text-white font-bold pt-1">
                {line.text}
              </div>
            );
          }
          if (line.type === 'error') {
            return (
              <div key={line.id} className="text-rose-400 whitespace-pre-wrap">
                {line.text}
              </div>
            );
          }
          return (
            <div key={line.id} className="text-slate-200 whitespace-pre-wrap">
              {line.text}
            </div>
          );
        })}

        {/* Live execution indicator */}
        {isExecuting && (
          <div className="text-sky-400 text-xs flex items-center gap-2 py-1">
            <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
            <span>Transmitting ICMP packets...</span>
          </div>
        )}

        {/* Active Command Input Line */}
        <div className="flex items-center pt-1 text-xs">
          <span className="text-emerald-400 font-bold mr-1.5 shrink-0 select-none">
            {parser.getPrompt()}
          </span>
          <div className="relative flex-1 flex items-center">
            <input
              ref={inputRef}
              type="text"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isExecuting}
              autoFocus
              spellCheck={false}
              autoCapitalize="none"
              autoComplete="off"
              className="w-full bg-transparent text-white outline-hidden font-mono text-[12px] border-none p-0 focus:ring-0 leading-normal"
            />
            {/* Blinking block cursor when empty */}
            {inputVal.length === 0 && !isExecuting && (
              <span className="absolute left-0 pointer-events-none text-emerald-400 font-bold animate-pulse">
                █
              </span>
            )}
          </div>
        </div>

        <div ref={terminalEndRef} />
      </div>

      {/* 4. Mobile-Optimized Terminal Accessory Bar */}
      <div className="p-2 bg-[#0c1322] border-t border-slate-800 flex items-center justify-between gap-1.5 shrink-0 select-none">
        <button
          type="button"
          onClick={handleTabCompletion}
          className="flex-1 h-10 rounded-lg bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 border border-slate-700 font-mono font-bold text-xs flex items-center justify-center transition-all touch-manipulation shadow-xs cursor-pointer"
          title="Auto-complete command [Tab]"
        >
          [Tab]
        </button>

        <button
          type="button"
          onClick={handleContextHelp}
          className="flex-1 h-10 rounded-lg bg-slate-800 hover:bg-slate-700 active:scale-95 text-emerald-400 border border-slate-700 font-mono font-bold text-xs flex items-center justify-center transition-all touch-manipulation shadow-xs cursor-pointer"
          title="Show available commands [?]"
        >
          [?]
        </button>

        <button
          type="button"
          onClick={handleCtrlC}
          className="flex-1 h-10 rounded-lg bg-slate-800 hover:bg-slate-700 active:scale-95 text-rose-400 border border-slate-700 font-mono font-bold text-xs flex items-center justify-center transition-all touch-manipulation shadow-xs cursor-pointer"
          title="Abort line [Ctrl+C]"
        >
          [Ctrl+C]
        </button>

        <button
          type="button"
          onClick={handleHistoryUp}
          className="flex-1 h-10 rounded-lg bg-slate-800 hover:bg-slate-700 active:scale-95 text-amber-300 border border-slate-700 font-mono font-bold text-xs flex items-center justify-center transition-all touch-manipulation shadow-xs cursor-pointer"
          title="Previous command in history [Up]"
        >
          [▲ Up]
        </button>

        <button
          type="button"
          onClick={handleHistoryDown}
          className="flex-1 h-10 rounded-lg bg-slate-800 hover:bg-slate-700 active:scale-95 text-amber-300 border border-slate-700 font-mono font-bold text-xs flex items-center justify-center transition-all touch-manipulation shadow-xs cursor-pointer"
          title="Next command in history [Down]"
        >
          [▼ Down]
        </button>

        <button
          type="button"
          onClick={handleEnterKey}
          className="flex-1 h-10 rounded-lg bg-emerald-700 hover:bg-emerald-600 active:scale-95 text-white font-mono font-bold text-xs flex items-center justify-center transition-all touch-manipulation shadow-xs cursor-pointer"
          title="Execute Command [Enter]"
        >
          [Enter]
        </button>
      </div>
    </div>
  );
};
