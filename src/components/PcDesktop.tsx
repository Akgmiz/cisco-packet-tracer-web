import React, { useState, useRef, useEffect } from 'react';
import { NetworkDeviceData, DeviceType, PingSimulationResult } from '../types/network';
import {
  Sliders,
  Terminal,
  Globe,
  FileText,
  X,
  Check,
  AlertTriangle,
  RotateCcw,
  Send,
  HelpCircle,
  Network
} from 'lucide-react';
import {
  isValidIpv4,
  isValidSubnetMask,
  calculateSubnetDetails,
  evaluatePing
} from '../utils/networkUtils';

interface PcDesktopProps {
  device: NetworkDeviceData;
  allDevices: NetworkDeviceData[];
  nodes: any[];
  edges: any[];
  onUpdateDevice: (updated: NetworkDeviceData) => void;
  onTriggerPing?: (sourceId: string, destId: string) => Promise<PingSimulationResult>;
}

type DesktopApp = 'none' | 'ip_config' | 'command_prompt' | 'web_browser' | 'text_editor';

interface CmdLine {
  id: string;
  type: 'input' | 'output' | 'error';
  text: string;
}

export const PcDesktop: React.FC<PcDesktopProps> = ({
  device,
  allDevices,
  nodes,
  edges,
  onUpdateDevice,
  onTriggerPing,
}) => {
  const [activeApp, setActiveApp] = useState<DesktopApp>('none');

  // --- IP Configuration App State ---
  const [ipType, setIpType] = useState<'static' | 'dhcp'>('static');
  const [ipVal, setIpVal] = useState(device.ip || '');
  const [maskVal, setMaskVal] = useState(device.subnetMask || '255.255.255.0');
  const [gwVal, setGwVal] = useState(device.gateway || '');
  const [dnsVal, setDnsVal] = useState('8.8.8.8');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Sync state if device changes
  useEffect(() => {
    setIpVal(device.ip || '');
    setMaskVal(device.subnetMask || '255.255.255.0');
    setGwVal(device.gateway || '');
  }, [device]);

  const subnetDetails = calculateSubnetDetails(ipVal, maskVal);

  const handleSaveIpConfig = () => {
    const updatedPorts = (device.ports || []).map((p) => {
      if (p.id === 'FastEthernet0' || p.name === 'FastEthernet0' || p.id === 'eth0') {
        return {
          ...p,
          ip: ipVal.trim(),
          subnetMask: maskVal.trim(),
        };
      }
      return p;
    });

    onUpdateDevice({
      ...device,
      ip: ipVal.trim(),
      subnetMask: maskVal.trim(),
      gateway: gwVal.trim(),
      ports: updatedPorts,
    });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  // --- Command Prompt App State ---
  const [cmdLines, setCmdLines] = useState<CmdLine[]>([
    { id: 'banner-1', type: 'output', text: 'Packet Tracer PC Command Line 1.0\n' },
  ]);
  const [cmdInput, setCmdInput] = useState('');
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isPingRunning, setIsPingRunning] = useState(false);

  const cmdEndRef = useRef<HTMLDivElement>(null);
  const cmdInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    cmdEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [cmdLines, isPingRunning]);

  // Focus input when Command Prompt is opened
  useEffect(() => {
    if (activeApp === 'command_prompt') {
      setTimeout(() => cmdInputRef.current?.focus(), 100);
    }
  }, [activeApp]);

  const addCmdLine = (type: CmdLine['type'], text: string) => {
    setCmdLines((prev) => [...prev, { id: `${Date.now()}-${Math.random()}`, type, text }]);
  };

  // Execute Command Prompt Ping
  const executeCmdPing = async (targetIp: string) => {
    if (!isValidIpv4(targetIp)) {
      addCmdLine('error', `Ping request could not find host ${targetIp}. Please check the name and try again.`);
      return;
    }

    addCmdLine('output', `\nPinging ${targetIp} with 32 bytes of data:\n`);

    // Self Ping
    if (device.ip === targetIp) {
      addCmdLine('output', `Reply from ${targetIp}: bytes=32 time<1ms TTL=128`);
      addCmdLine('output', `Reply from ${targetIp}: bytes=32 time<1ms TTL=128`);
      addCmdLine('output', `Reply from ${targetIp}: bytes=32 time<1ms TTL=128`);
      addCmdLine('output', `Reply from ${targetIp}: bytes=32 time<1ms TTL=128`);
      addCmdLine(
        'output',
        `\nPing statistics for ${targetIp}:\n    Packets: Sent = 4, Received = 4, Lost = 0 (0% loss),\nApproximate round trip times in milli-seconds:\n    Minimum = 0ms, Maximum = 0ms, Average = 0ms`
      );
      return;
    }

    const targetDevice = allDevices.find((d) => d.ip === targetIp);

    setIsPingRunning(true);

    try {
      if (onTriggerPing && targetDevice) {
        onTriggerPing(device.id, targetDevice.id);
      }

      // Graph search
      const graphNodes = nodes.map((n) => {
        const d = n.data as NetworkDeviceData;
        return {
          id: n.id,
          data: {
            type: d.type as DeviceType,
            ip: d.ip,
            subnetMask: d.subnetMask,
            gateway: d.gateway,
            name: d.name,
          },
        };
      });

      const graphEdges = edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
      }));

      const evalResult = targetDevice
        ? evaluatePing(graphNodes, graphEdges, device.id, targetDevice.id)
        : null;

      if (evalResult && evalResult.success) {
        if (targetDevice) {
          const updatedArp = { ...(device.arpTable || {}), [targetIp]: targetDevice.mac };
          onUpdateDevice({
            ...device,
            arpTable: updatedArp,
          });
        }
        const lat = evalResult.latencyMs;
        addCmdLine('output', `Reply from ${targetIp}: bytes=32 time=${lat}ms TTL=128`);
        addCmdLine('output', `Reply from ${targetIp}: bytes=32 time=${lat + 1}ms TTL=128`);
        addCmdLine('output', `Reply from ${targetIp}: bytes=32 time=${lat}ms TTL=128`);
        addCmdLine('output', `Reply from ${targetIp}: bytes=32 time=${lat + 2}ms TTL=128`);
        addCmdLine(
          'output',
          `\nPing statistics for ${targetIp}:\n    Packets: Sent = 4, Received = 4, Lost = 0 (0% loss),\nApproximate round trip times in milli-seconds:\n    Minimum = ${lat}ms, Maximum = ${lat + 2}ms, Average = ${lat + 1}ms`
        );
      } else {
        // Unreachable
        addCmdLine('output', `Request timed out.`);
        addCmdLine('output', `Request timed out.`);
        addCmdLine('output', `Request timed out.`);
        addCmdLine('output', `Request timed out.`);
        addCmdLine(
          'error',
          `\nPing statistics for ${targetIp}:\n    Packets: Sent = 4, Received = 0, Lost = 4 (100% loss)`
        );
        if (evalResult && evalResult.message) {
          addCmdLine('error', `Reason: ${evalResult.message}`);
        }
      }
    } catch {
      addCmdLine('error', `Error executing ping test.`);
    } finally {
      setIsPingRunning(false);
    }
  };

  const handleCmdSubmit = async (rawCmd: string) => {
    const trimmed = rawCmd.trim();
    if (!trimmed) {
      addCmdLine('input', 'C:\\>');
      return;
    }

    addCmdLine('input', `C:\\> ${trimmed}`);
    setCmdHistory((prev) => [...prev, trimmed]);
    setHistoryIndex(-1);

    const parts = trimmed.split(/\s+/);
    const cmd0 = parts[0].toLowerCase();
    const cmd1 = parts[1]?.toLowerCase();

    // ipconfig / ipconfig /all
    if (cmd0 === 'ipconfig') {
      const isAll = cmd1 === '/all' || parts.join(' ').includes('/all');
      const mac = device.mac || '0001.96C2.B810';
      const iface = device.ports[0]?.name || 'FastEthernet0';

      if (isAll) {
        addCmdLine(
          'output',
          `\n${iface} Connection: (default port)\n\n   Physical Address................: ${mac}\n   Link-local IPv6 Address.........: fe80::${mac.replace(/:/g, '').slice(0, 4)}:fe80\n   IPv4 Address....................: ${device.ip || '0.0.0.0'}\n   Subnet Mask.....................: ${device.subnetMask || '255.255.255.0'}\n   Default Gateway.................: ${device.gateway || '0.0.0.0'}\n   DNS Servers.....................: ${dnsVal}\n   DHCP Enabled....................: ${ipType === 'dhcp' ? 'Yes' : 'No'}\n`
        );
      } else {
        addCmdLine(
          'output',
          `\n${iface} Connection: (default port)\n\n   Connection-specific DNS Suffix..: \n   Link-local IPv6 Address.........: fe80::${mac.replace(/:/g, '').slice(0, 4)}:fe80\n   IPv4 Address....................: ${device.ip || '0.0.0.0'}\n   Subnet Mask.....................: ${device.subnetMask || '255.255.255.0'}\n   Default Gateway.................: ${device.gateway || '0.0.0.0'}\n`
        );
      }
      return;
    }

    // ping <ip>
    if (cmd0 === 'ping') {
      const target = parts[1];
      if (!target) {
        addCmdLine('output', `\nUsage: ping [-t] [-a] [-n count] [-l size] target_name\nExample: ping 192.168.1.20\n`);
        return;
      }
      await executeCmdPing(target);
      return;
    }

    // arp -a
    if (cmd0 === 'arp') {
      addCmdLine('output', `\nInterface: ${device.ip || '192.168.1.10'} --- 0x2\n  Internet Address      Physical Address      Type`);
      const arpEntries = Object.entries(device.arpTable || {});
      if (arpEntries.length === 0) {
        addCmdLine('output', `  No ARP entries found in cache. Run 'ping <ip>' to resolve ARP.`);
      } else {
        for (const [ip, mac] of arpEntries) {
          const formatted = mac.toLowerCase().replace(/:/g, '-');
          addCmdLine('output', `  ${ip.padEnd(22, ' ')}${formatted.padEnd(22, ' ')}dynamic`);
        }
      }
      addCmdLine('output', '');
      return;
    }

    // cls / clear
    if (cmd0 === 'cls' || cmd0 === 'clear') {
      setCmdLines([]);
      return;
    }

    // help / ?
    if (cmd0 === 'help' || cmd0 === '?') {
      addCmdLine(
        'output',
        `\nSupported PC Command Prompt commands:\n  ipconfig        Display IP address, subnet mask, and default gateway\n  ipconfig /all   Display full network configuration including MAC & DNS\n  ping <ip>       Send ICMP Echo request packets to verify network connectivity\n  arp -a          Display current ARP resolution table\n  cls             Clear the screen\n  exit            Exit command prompt\n`
      );
      return;
    }

    // exit
    if (cmd0 === 'exit') {
      setActiveApp('none');
      return;
    }

    // Unrecognized command
    addCmdLine('error', `'${trimmed}' is not recognized as an internal or external command,\noperable program or batch file.`);
  };

  const handleCmdKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCmdSubmit(cmdInput);
      setCmdInput('');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (cmdHistory.length > 0) {
        const next = historyIndex + 1;
        if (next < cmdHistory.length) {
          setHistoryIndex(next);
          setCmdInput(cmdHistory[cmdHistory.length - 1 - next]);
        }
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const next = historyIndex - 1;
        setHistoryIndex(next);
        setCmdInput(cmdHistory[cmdHistory.length - 1 - next]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setCmdInput('');
      }
    }
  };

  // --- Web Browser State ---
  const [webUrl, setWebUrl] = useState('http://192.168.1.100');
  const [webContent, setWebContent] = useState<{ status: 'idle' | 'loaded' | 'error'; title: string; body: string }>({
    status: 'idle',
    title: '',
    body: '',
  });

  const handleWebNavigate = () => {
    const raw = webUrl.replace(/^https?:\/\//i, '').split('/')[0];
    const serverDev = allDevices.find((d) => d.type === 'server' && (d.ip === raw || d.name.toLowerCase() === raw.toLowerCase()));

    if (serverDev) {
      setWebContent({
        status: 'loaded',
        title: `${serverDev.name} HTTP Web Server`,
        body: `Welcome to Cisco Packet Tracer Web Services!\n\nServer Name: ${serverDev.name}\nIP Address: ${serverDev.ip}\nStatus: HTTP/1.1 200 OK\n\nNetwork topology verification successful. Layer 7 HTTP transmission operational.`,
      });
    } else {
      setWebContent({
        status: 'error',
        title: 'Server Not Found',
        body: `Host "${raw}" could not be resolved. Ensure server IP is reachable and HTTP service is running.`,
      });
    }
  };

  return (
    <div className="relative h-[430px] bg-[#dbe2ec] border border-[#a2afc2] rounded-xs shadow-inner overflow-hidden flex flex-col font-sans select-none">
      {/* 1. Desktop Tiles Grid View (when no app window is open) */}
      {activeApp === 'none' && (
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-4 flex items-center justify-between">
            <span>Desktop Applications</span>
            <span className="text-[10px] text-slate-500 font-normal">Click an icon to launch</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {/* Tile 1: IP Configuration */}
            <button
              type="button"
              onClick={() => setActiveApp('ip_config')}
              className="group flex flex-col items-center p-3 bg-white hover:bg-sky-50 border border-slate-300 hover:border-sky-500 rounded-xs shadow-xs hover:shadow-md transition-all cursor-pointer text-center"
            >
              <div className="w-12 h-12 rounded-xs bg-[#0284c7] text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                <Network className="w-7 h-7" />
              </div>
              <span className="text-xs font-bold text-slate-900 mt-2">
                IP Configuration
              </span>
              <span className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                Static / DHCP IPv4 & Gateway
              </span>
            </button>

            {/* Tile 2: Command Prompt */}
            <button
              type="button"
              onClick={() => setActiveApp('command_prompt')}
              className="group flex flex-col items-center p-3 bg-white hover:bg-slate-100 border border-slate-300 hover:border-slate-700 rounded-xs shadow-xs hover:shadow-md transition-all cursor-pointer text-center"
            >
              <div className="w-12 h-12 rounded-xs bg-slate-900 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform font-mono text-sm font-bold">
                &gt;_
              </div>
              <span className="text-xs font-bold text-slate-900 mt-2">
                Command Prompt
              </span>
              <span className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                ping &amp; ipconfig terminal
              </span>
            </button>

            {/* Tile 3: Web Browser */}
            <button
              type="button"
              onClick={() => setActiveApp('web_browser')}
              className="group flex flex-col items-center p-3 bg-white hover:bg-indigo-50 border border-slate-300 hover:border-indigo-500 rounded-xs shadow-xs hover:shadow-md transition-all cursor-pointer text-center"
            >
              <div className="w-12 h-12 rounded-xs bg-indigo-600 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                <Globe className="w-7 h-7" />
              </div>
              <span className="text-xs font-bold text-slate-900 mt-2">
                Web Browser
              </span>
              <span className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                HTTP Client for Servers
              </span>
            </button>

            {/* Tile 4: Text Editor */}
            <button
              type="button"
              onClick={() => setActiveApp('text_editor')}
              className="group flex flex-col items-center p-3 bg-white hover:bg-amber-50 border border-slate-300 hover:border-amber-500 rounded-xs shadow-xs hover:shadow-md transition-all cursor-pointer text-center"
            >
              <div className="w-12 h-12 rounded-xs bg-amber-600 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                <FileText className="w-7 h-7" />
              </div>
              <span className="text-xs font-bold text-slate-900 mt-2">
                Text Editor
              </span>
              <span className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                Notes &amp; Scratchpad
              </span>
            </button>
          </div>
        </div>
      )}

      {/* 2. APP WINDOW: IP Configuration */}
      {activeApp === 'ip_config' && (
        <div className="flex-1 flex flex-col bg-white overflow-hidden animate-in fade-in duration-150">
          {/* App Header Bar */}
          <div className="px-3 py-1.5 bg-[#1e293b] text-white flex items-center justify-between text-xs font-semibold shrink-0">
            <div className="flex items-center gap-2">
              <Network className="w-4 h-4 text-sky-400" />
              <span>IP Configuration - {device.name} (FastEthernet0)</span>
            </div>
            <button
              type="button"
              onClick={() => setActiveApp('none')}
              className="w-5 h-5 rounded-xs bg-slate-800 hover:bg-rose-600 text-white flex items-center justify-center text-xs transition-colors cursor-pointer"
              title="Close and return to desktop"
            >
              ✕
            </button>
          </div>

          {/* Form Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
            {/* DHCP vs Static Radio Selector */}
            <div className="flex items-center gap-6 p-2 bg-slate-50 border border-slate-200 rounded-xs">
              <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                <input
                  type="radio"
                  name="ip_type"
                  checked={ipType === 'dhcp'}
                  onChange={() => setIpType('dhcp')}
                  className="text-blue-600"
                />
                <span>DHCP</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                <input
                  type="radio"
                  name="ip_type"
                  checked={ipType === 'static'}
                  onChange={() => setIpType('static')}
                  className="text-blue-600"
                />
                <span>Static</span>
              </label>
            </div>

            {/* IPv4 Address */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                IPv4 Address
              </label>
              <input
                type="text"
                value={ipVal}
                onChange={(e) => setIpVal(e.target.value)}
                disabled={ipType === 'dhcp'}
                placeholder="e.g. 192.168.1.10"
                className="w-full px-3 py-1.5 rounded-xs border border-slate-300 font-mono text-slate-900 text-xs focus:border-blue-500 outline-hidden"
              />
            </div>

            {/* Subnet Mask */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold text-slate-700 uppercase">
                  Subnet Mask
                </label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setMaskVal('255.255.255.0')}
                    className="text-[10px] text-blue-600 hover:underline"
                  >
                    /24
                  </button>
                  <span>·</span>
                  <button
                    type="button"
                    onClick={() => setMaskVal('255.255.255.128')}
                    className="text-[10px] text-blue-600 hover:underline"
                  >
                    /25
                  </button>
                  <span>·</span>
                  <button
                    type="button"
                    onClick={() => setMaskVal('255.255.0.0')}
                    className="text-[10px] text-blue-600 hover:underline"
                  >
                    /16
                  </button>
                </div>
              </div>
              <input
                type="text"
                value={maskVal}
                onChange={(e) => setMaskVal(e.target.value)}
                disabled={ipType === 'dhcp'}
                placeholder="255.255.255.0"
                className="w-full px-3 py-1.5 rounded-xs border border-slate-300 font-mono text-slate-900 text-xs focus:border-blue-500 outline-hidden"
              />
            </div>

            {/* Default Gateway */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold text-slate-700 uppercase">
                  Default Gateway
                </label>
                {subnetDetails && (
                  <button
                    type="button"
                    onClick={() => setGwVal(subnetDetails.firstUsableIp)}
                    className="text-[10px] text-blue-600 hover:underline"
                  >
                    Use .1 ({subnetDetails.firstUsableIp})
                  </button>
                )}
              </div>
              <input
                type="text"
                value={gwVal}
                onChange={(e) => setGwVal(e.target.value)}
                disabled={ipType === 'dhcp'}
                placeholder="e.g. 192.168.1.1"
                className="w-full px-3 py-1.5 rounded-xs border border-slate-300 font-mono text-slate-900 text-xs focus:border-blue-500 outline-hidden"
              />
            </div>

            {/* DNS Server */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                DNS Server
              </label>
              <input
                type="text"
                value={dnsVal}
                onChange={(e) => setDnsVal(e.target.value)}
                disabled={ipType === 'dhcp'}
                placeholder="8.8.8.8"
                className="w-full px-3 py-1.5 rounded-xs border border-slate-300 font-mono text-slate-900 text-xs focus:border-blue-500 outline-hidden"
              />
            </div>

            {/* Subnet Review */}
            {subnetDetails && (
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xs font-mono text-[10px] grid grid-cols-2 gap-1 text-slate-600">
                <div>Network: <strong className="text-slate-800">{subnetDetails.networkAddress}/{subnetDetails.cidr}</strong></div>
                <div>Broadcast: <strong className="text-slate-800">{subnetDetails.broadcastAddress}</strong></div>
                <div>Hosts: <strong className="text-emerald-700">{subnetDetails.usableHosts} usable</strong></div>
                <div>Range: <strong className="text-slate-800">{subnetDetails.firstUsableIp} - {subnetDetails.lastUsableIp}</strong></div>
              </div>
            )}
          </div>

          {/* App Footer */}
          <div className="p-3 bg-[#e2e8f0] border-t border-slate-300 flex items-center justify-between shrink-0">
            <button
              type="button"
              onClick={() => setActiveApp('none')}
              className="px-3 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xs text-xs font-medium cursor-pointer"
            >
              Back to Desktop
            </button>

            <div className="flex items-center gap-2">
              {saveSuccess && (
                <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
                  <Check className="w-3.5 h-3.5 text-emerald-600" /> Saved!
                </span>
              )}
              <button
                type="button"
                onClick={handleSaveIpConfig}
                className="px-4 py-1 bg-[#0284c7] hover:bg-[#0369a1] text-white rounded-xs text-xs font-bold cursor-pointer shadow-xs"
              >
                Apply IP Config
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. APP WINDOW: Command Prompt */}
      {activeApp === 'command_prompt' && (
        <div className="flex-1 flex flex-col bg-black text-slate-100 font-mono text-[12px] overflow-hidden animate-in fade-in duration-150">
          {/* CMD Title Bar */}
          <div className="px-3 py-1 bg-[#1e293b] text-white flex items-center justify-between text-xs font-semibold shrink-0 select-none">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-mono">&gt;_</span>
              <span>Command Prompt - {device.name} [C:\]</span>
            </div>
            <button
              type="button"
              onClick={() => setActiveApp('none')}
              className="w-5 h-5 rounded-xs bg-slate-800 hover:bg-rose-600 text-white flex items-center justify-center text-xs transition-colors cursor-pointer"
              title="Close and return to desktop"
            >
              ✕
            </button>
          </div>

          {/* Shortcuts Ribbon */}
          <div className="px-3 py-1 bg-[#0f172a] border-b border-slate-800 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0 text-[10px] select-none">
            <span className="text-slate-400 shrink-0">Commands:</span>
            <button
              type="button"
              onClick={() => handleCmdSubmit('ipconfig')}
              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 transition-colors shrink-0 cursor-pointer"
            >
              ipconfig
            </button>
            <button
              type="button"
              onClick={() => handleCmdSubmit('ipconfig /all')}
              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-teal-300 border border-slate-700 transition-colors shrink-0 cursor-pointer"
            >
              ipconfig /all
            </button>
            {allDevices
              .filter((d) => d.id !== device.id && d.ip)
              .slice(0, 2)
              .map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => handleCmdSubmit(`ping ${d.ip}`)}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 transition-colors shrink-0 cursor-pointer"
                >
                  ping {d.ip} ({d.name})
                </button>
              ))}
            <button
              type="button"
              onClick={() => handleCmdSubmit('help')}
              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors shrink-0 cursor-pointer"
            >
              help
            </button>
            <button
              type="button"
              onClick={() => setCmdLines([])}
              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-rose-300 border border-slate-700 transition-colors shrink-0 cursor-pointer"
            >
              cls
            </button>
          </div>

          {/* CMD Output Area */}
          <div
            className="flex-1 p-3 overflow-y-auto space-y-1 select-text cursor-text"
            onClick={() => cmdInputRef.current?.focus()}
          >
            {cmdLines.map((line) => {
              if (line.type === 'input') {
                return (
                  <div key={line.id} className="text-white font-semibold">
                    {line.text}
                  </div>
                );
              }
              if (line.type === 'error') {
                return (
                  <div key={line.id} className="text-rose-400 whitespace-pre-wrap leading-relaxed">
                    {line.text}
                  </div>
                );
              }
              return (
                <div key={line.id} className="text-slate-200 whitespace-pre-wrap leading-relaxed">
                  {line.text}
                </div>
              );
            })}

            {isPingRunning && (
              <div className="text-sky-400 text-xs flex items-center gap-2 py-1">
                <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
                <span>Pinging destination host across network...</span>
              </div>
            )}

            {/* Current Input Line */}
            <div className="flex items-center pt-1 text-xs">
              <span className="text-white font-semibold mr-1.5 shrink-0 select-none">
                C:\&gt;
              </span>
              <div className="relative flex-1 flex items-center">
                <input
                  ref={cmdInputRef}
                  type="text"
                  value={cmdInput}
                  onChange={(e) => setCmdInput(e.target.value)}
                  onKeyDown={handleCmdKeyDown}
                  disabled={isPingRunning}
                  autoFocus
                  spellCheck={false}
                  autoCapitalize="none"
                  autoComplete="off"
                  className="w-full bg-transparent text-white outline-hidden font-mono text-[12px] border-none p-0 focus:ring-0 leading-normal"
                />
                {cmdInput.length === 0 && !isPingRunning && (
                  <span className="absolute left-0 pointer-events-none text-white font-bold animate-pulse">
                    █
                  </span>
                )}
              </div>
            </div>

            <div ref={cmdEndRef} />
          </div>
        </div>
      )}

      {/* 4. APP WINDOW: Web Browser */}
      {activeApp === 'web_browser' && (
        <div className="flex-1 flex flex-col bg-white overflow-hidden animate-in fade-in duration-150">
          <div className="px-3 py-1.5 bg-[#1e293b] text-white flex items-center justify-between text-xs font-semibold shrink-0">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-indigo-400" />
              <span>Web Browser - {device.name}</span>
            </div>
            <button
              type="button"
              onClick={() => setActiveApp('none')}
              className="w-5 h-5 rounded-xs bg-slate-800 hover:bg-rose-600 text-white flex items-center justify-center text-xs transition-colors cursor-pointer"
            >
              ✕
            </button>
          </div>

          {/* URL Navigation Bar */}
          <div className="p-2 bg-[#edf1f7] border-b border-slate-300 flex items-center gap-2 text-xs">
            <span className="text-slate-500 font-semibold text-[11px]">URL:</span>
            <input
              type="text"
              value={webUrl}
              onChange={(e) => setWebUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleWebNavigate()}
              placeholder="http://192.168.1.100"
              className="flex-1 px-3 py-1 bg-white rounded-xs border border-slate-300 font-mono text-xs focus:border-blue-500 outline-hidden"
            />
            <button
              type="button"
              onClick={handleWebNavigate}
              className="px-3 py-1 bg-[#0284c7] hover:bg-[#0369a1] text-white rounded-xs text-xs font-bold cursor-pointer"
            >
              Go
            </button>
          </div>

          {/* Browser Render Canvas */}
          <div className="flex-1 p-6 overflow-y-auto bg-slate-50">
            {webContent.status === 'idle' ? (
              <div className="text-center text-slate-400 space-y-2 mt-8">
                <Globe className="w-12 h-12 mx-auto text-slate-300" />
                <div className="text-sm font-semibold text-slate-600">Packet Tracer Web Browser</div>
                <div className="text-xs">Type a server IP (e.g. 192.168.1.100) or Server name in the URL bar above and press Go.</div>
              </div>
            ) : webContent.status === 'loaded' ? (
              <div className="max-w-md mx-auto p-6 bg-white border border-emerald-300 rounded shadow-sm text-slate-800">
                <h3 className="text-base font-bold text-emerald-700 border-b pb-2 mb-3">
                  {webContent.title}
                </h3>
                <div className="font-mono text-xs whitespace-pre-wrap text-slate-700 leading-relaxed">
                  {webContent.body}
                </div>
              </div>
            ) : (
              <div className="max-w-md mx-auto p-6 bg-white border border-rose-300 rounded shadow-sm text-slate-800">
                <h3 className="text-base font-bold text-rose-600 border-b pb-2 mb-3">
                  {webContent.title}
                </h3>
                <div className="text-xs text-slate-600">
                  {webContent.body}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. APP WINDOW: Text Editor */}
      {activeApp === 'text_editor' && (
        <div className="flex-1 flex flex-col bg-white overflow-hidden animate-in fade-in duration-150">
          <div className="px-3 py-1.5 bg-[#1e293b] text-white flex items-center justify-between text-xs font-semibold shrink-0">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-amber-400" />
              <span>Text Editor - Untitled.txt</span>
            </div>
            <button
              type="button"
              onClick={() => setActiveApp('none')}
              className="w-5 h-5 rounded-xs bg-slate-800 hover:bg-rose-600 text-white flex items-center justify-center text-xs transition-colors cursor-pointer"
            >
              ✕
            </button>
          </div>
          <div className="flex-1 p-2">
            <textarea
              placeholder="Enter configuration notes, script commands, or scratchpad text here..."
              className="w-full h-full p-2 bg-white text-slate-800 font-mono text-xs resize-none outline-hidden border border-slate-200 rounded-xs"
            />
          </div>
        </div>
      )}
    </div>
  );
};
