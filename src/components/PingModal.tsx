import React, { useState, useEffect } from 'react';
import { NetworkDeviceData, PingSimulationResult } from '../types/network';
import {
  X,
  Play,
  CheckCircle2,
  AlertOctagon,
  ArrowRight,
  Terminal,
  Activity,
  Layers,
  Network,
  RotateCcw
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface PingModalProps {
  isOpen: boolean;
  onClose: () => void;
  devices: NetworkDeviceData[];
  defaultSourceId?: string;
  defaultDestId?: string;
  onRunPing: (sourceId: string, destId: string) => Promise<PingSimulationResult>;
  isExecuting?: boolean;
}

export const PingModal: React.FC<PingModalProps> = ({
  isOpen,
  onClose,
  devices,
  defaultSourceId,
  defaultDestId,
  onRunPing,
  isExecuting = false,
}) => {
  const pingableDevices = devices.filter((d) => d.type === 'pc' || d.type === 'server' || d.type === 'router');

  const [sourceId, setSourceId] = useState<string>('');
  const [destId, setDestId] = useState<string>('');
  const [logs, setLogs] = useState<string[]>([]);
  const [lastResult, setLastResult] = useState<PingSimulationResult | null>(null);
  const [activeTab, setActiveTab] = useState<'console' | 'diagnostics'>('console');

  // Initialize selected devices
  useEffect(() => {
    if (pingableDevices.length >= 2) {
      if (defaultSourceId && pingableDevices.some((d) => d.id === defaultSourceId)) {
        setSourceId(defaultSourceId);
        const other = pingableDevices.find((d) => d.id !== defaultSourceId);
        setDestId(defaultDestId || other?.id || '');
      } else {
        setSourceId(pingableDevices[0].id);
        setDestId(pingableDevices[1].id);
      }
    } else if (pingableDevices.length === 1) {
      setSourceId(pingableDevices[0].id);
    }
  }, [isOpen, defaultSourceId, defaultDestId]);

  if (!isOpen) return null;

  const sourceDevice = devices.find((d) => d.id === sourceId);
  const destDevice = devices.find((d) => d.id === destId);

  const handleExecute = async () => {
    if (!sourceId || !destId || sourceId === destId) return;

    setLogs([
      `net@simulator:~$ ping -c 4 ${destDevice?.ip || '0.0.0.0'}`,
      `PING ${destDevice?.name || destId} (${destDevice?.ip || '0.0.0.0'}): 56 data bytes`,
    ]);
    setLastResult(null);

    const result = await onRunPing(sourceId, destId);
    setLastResult(result);

    if (result.success) {
      // Trigger festive celebration confetti
      try {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.8 },
          colors: ['#38bdf8', '#34d399', '#818cf8'],
        });
      } catch {
        // fallback
      }

      setLogs((prev) => [
        ...prev,
        `64 bytes from ${result.destIp}: icmp_seq=1 ttl=64 time=${result.latencyMs} ms`,
        `64 bytes from ${result.destIp}: icmp_seq=2 ttl=64 time=${(result.latencyMs * 0.95).toFixed(2)} ms`,
        `64 bytes from ${result.destIp}: icmp_seq=3 ttl=64 time=${(result.latencyMs * 1.05).toFixed(2)} ms`,
        `64 bytes from ${result.destIp}: icmp_seq=4 ttl=64 time=${result.latencyMs} ms`,
        `--- ${result.destIp} ping statistics ---`,
        `4 packets transmitted, 4 received, 0% packet loss, time 3012ms`,
        `rtt min/avg/max = ${(result.latencyMs * 0.9).toFixed(2)}/${result.latencyMs}/${(result.latencyMs * 1.1).toFixed(2)} ms`,
        `[SUCCESS]: Both devices reside on the same subnet and are bridged via Switch!`,
      ]);
    } else {
      setLogs((prev) => [
        ...prev,
        `From ${result.sourceIp} icmp_seq=1 Destination Host Unreachable`,
        `From ${result.sourceIp} icmp_seq=2 Destination Host Unreachable`,
        `From ${result.sourceIp} icmp_seq=3 Destination Host Unreachable`,
        `From ${result.sourceIp} icmp_seq=4 Destination Host Unreachable`,
        `--- ${destDevice?.ip || 'target'} ping statistics ---`,
        `4 packets transmitted, 0 received, +4 errors, 100% packet loss`,
        `[ERROR]: ${result.message}`,
        ...result.details.map((d) => `  * ${d}`),
      ]);
    }
  };

  const handleSwap = () => {
    const temp = sourceId;
    setSourceId(destId);
    setDestId(temp);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs pointer-events-auto transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl pointer-events-auto flex flex-col overflow-hidden max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-400">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-100">ICMP Ping Simulator</h3>
              <p className="text-xs text-slate-400">Verify subnet reachability & Layer 2 switch forwarding</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Source & Destination Selector */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] items-center gap-2">
              {/* Source Device */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Source Host
                </label>
                <select
                  value={sourceId}
                  onChange={(e) => setSourceId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-hidden focus:border-sky-500"
                >
                  <option value="" disabled>Select Source</option>
                  {pingableDevices.map((d) => (
                    <option key={d.id} value={d.id} disabled={d.id === destId}>
                      {d.name} ({d.ip || 'No IP'})
                    </option>
                  ))}
                </select>
                {sourceDevice && (
                  <div className="mt-1 text-[11px] font-mono text-sky-400 truncate">
                    IP: {sourceDevice.ip} · Mask: {sourceDevice.subnetMask}
                  </div>
                )}
              </div>

              {/* Swap Button */}
              <div className="flex justify-center pt-2 sm:pt-4">
                <button
                  type="button"
                  onClick={handleSwap}
                  className="p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
                  title="Swap Source and Destination"
                >
                  <ArrowRight className="w-4 h-4 hidden sm:block" />
                  <RotateCcw className="w-4 h-4 sm:hidden" />
                </button>
              </div>

              {/* Destination Device */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Destination Host
                </label>
                <select
                  value={destId}
                  onChange={(e) => setDestId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-hidden focus:border-sky-500"
                >
                  <option value="" disabled>Select Destination</option>
                  {pingableDevices.map((d) => (
                    <option key={d.id} value={d.id} disabled={d.id === sourceId}>
                      {d.name} ({d.ip || 'No IP'})
                    </option>
                  ))}
                </select>
                {destDevice && (
                  <div className="mt-1 text-[11px] font-mono text-cyan-400 truncate">
                    IP: {destDevice.ip} · Mask: {destDevice.subnetMask}
                  </div>
                )}
              </div>
            </div>

            {/* Launch Ping Button */}
            <div className="pt-2 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                Rule: Same subnet + Switch connection required
              </span>
              <button
                type="button"
                onClick={handleExecute}
                disabled={isExecuting || !sourceId || !destId || sourceId === destId}
                className={`px-5 py-2.5 rounded-xl font-semibold text-xs flex items-center gap-2 transition-all cursor-pointer ${
                  isExecuting || !sourceId || !destId || sourceId === destId
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-[0_0_16px_rgba(16,185,129,0.35)]'
                }`}
              >
                <Play className={`w-3.5 h-3.5 fill-current ${isExecuting ? 'animate-spin' : ''}`} />
                <span>{isExecuting ? 'Transmitting Packets...' : 'Send ICMP Ping'}</span>
              </button>
            </div>
          </div>

          {/* Result Alert Banner if test ran */}
          {lastResult && (
            <div
              className={`p-3.5 rounded-xl border flex items-start gap-3 animate-in fade-in duration-200 ${
                lastResult.success
                  ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200'
                  : 'bg-rose-950/40 border-rose-500/50 text-rose-200'
              }`}
            >
              {lastResult.success ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertOctagon className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <div className="text-sm font-semibold">
                  {lastResult.success ? 'Ping Success: Host Reachable' : 'Destination Host Unreachable'}
                </div>
                <div className="text-xs mt-1 text-slate-300 leading-relaxed">
                  {lastResult.message}
                </div>
                <div className="mt-2 text-[11px] font-mono space-y-0.5 text-slate-400">
                  {lastResult.details.map((detail, idx) => (
                    <div key={idx}>• {detail}</div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Tabs: Terminal Output vs Subnet Diagnostic */}
          <div>
            <div className="flex items-center gap-1 border-b border-slate-800 mb-2">
              <button
                type="button"
                onClick={() => setActiveTab('console')}
                className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'console'
                    ? 'border-sky-500 text-sky-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Terminal className="w-3.5 h-3.5" />
                Terminal Console
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('diagnostics')}
                className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'diagnostics'
                    ? 'border-sky-500 text-sky-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                Subnet Diagnostic
              </button>
            </div>

            {activeTab === 'console' ? (
              <div className="p-3 rounded-xl bg-slate-950 font-mono text-[11px] text-slate-300 border border-slate-800 h-40 overflow-y-auto space-y-1">
                {logs.length === 0 ? (
                  <span className="text-slate-500 italic">Select hosts and press "Send ICMP Ping" to begin simulation...</span>
                ) : (
                  logs.map((line, idx) => (
                    <div
                      key={idx}
                      className={
                        line.includes('[SUCCESS]')
                          ? 'text-emerald-400 font-semibold'
                          : line.includes('[ERROR]') || line.includes('Unreachable')
                          ? 'text-rose-400 font-semibold'
                          : line.startsWith('net@')
                          ? 'text-sky-400'
                          : 'text-slate-300'
                      }
                    >
                      {line}
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3 font-mono">
                  <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-400 block uppercase">Source</span>
                    <span className="font-semibold text-slate-200">{sourceDevice?.name || 'N/A'}</span>
                    <div className="text-[11px] text-sky-400 mt-1">{sourceDevice?.ip || '0.0.0.0'}</div>
                    <div className="text-[10px] text-slate-400">{sourceDevice?.subnetMask}</div>
                  </div>
                  <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-400 block uppercase">Destination</span>
                    <span className="font-semibold text-slate-200">{destDevice?.name || 'N/A'}</span>
                    <div className="text-[11px] text-cyan-400 mt-1">{destDevice?.ip || '0.0.0.0'}</div>
                    <div className="text-[10px] text-slate-400">{destDevice?.subnetMask}</div>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 text-[11px] text-slate-300 space-y-1">
                  <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                    <Network className="w-3.5 h-3.5 text-indigo-400" />
                    How the Simulator Evaluates:
                  </div>
                  <div>1. <strong>Bitwise Subnet Match:</strong> Evaluates <code>(Src_IP &amp; Mask) === (Dst_IP &amp; Mask)</code>.</div>
                  <div>2. <strong>Topology Check:</strong> Verifies cables link through a Layer 2 Switch.</div>
                  <div>3. <strong>Frame Animation:</strong> On success, a packet traverses along the cable. On mismatch, packet drops at the switch.</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            {pingableDevices.length} pingable host{pingableDevices.length !== 1 ? 's' : ''} available
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
