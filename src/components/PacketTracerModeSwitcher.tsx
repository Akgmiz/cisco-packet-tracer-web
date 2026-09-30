/**
 * Interactive Simulation Controller & Event Drawer
 * Features:
 *   - Floating Bottom Pill: Realtime vs Simulation toggle, Play/Pause, Speed (0.5x, 1x, 2x), Step Forward, Reset
 *   - Collapsible Bottom Event Table: Time (s), Last Device, At Device, Protocol, Type/Info, Status Icon
 *   - Click to inspect packet in Dual PDU Inspector / highlight on canvas
 */

import React, { useState } from 'react';
import { WorkspaceMode, SimulationEvent, UserPdu, PduHeaderInfo } from '../types/network';
import {
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  Clock,
  Layers,
  ChevronUp,
  ChevronDown,
  X,
  Activity,
  CheckCircle2,
  XCircle,
  Gauge,
  Sliders,
} from 'lucide-react';

interface PacketTracerModeSwitcherProps {
  mode: WorkspaceMode;
  onToggleMode: (mode: WorkspaceMode) => void;
  isSimulating: boolean;
  onPlayPause: () => void;
  onStepForward: () => void;
  onResetSimulation: () => void;
  events: SimulationEvent[];
  userPdus: UserPdu[];
  onOpenPduInfo?: (info: PduHeaderInfo) => void;
  isEventPanelOpen: boolean;
  onToggleEventPanel: () => void;
  elapsedSeconds: number;
  simulationSpeed?: number;
  onSpeedChange?: (speed: number) => void;
  selectedEventId?: string | null;
  onSelectEvent?: (event: SimulationEvent) => void;
}

export const PacketTracerModeSwitcher: React.FC<PacketTracerModeSwitcherProps> = ({
  mode,
  onToggleMode,
  isSimulating,
  onPlayPause,
  onStepForward,
  onResetSimulation,
  events,
  userPdus,
  onOpenPduInfo,
  isEventPanelOpen,
  onToggleEventPanel,
  elapsedSeconds,
  simulationSpeed = 1,
  onSpeedChange,
  selectedEventId,
  onSelectEvent,
}) => {
  const [panelTab, setPanelTab] = useState<'events' | 'pdus'>('events');

  const formatSeconds = (secs: number) => {
    return `${secs.toFixed(3)}s`;
  };

  const getProtocolBadge = (proto: string) => {
    const p = proto.toUpperCase();
    if (p === 'ARP') {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-400/40">
          ARP
        </span>
      );
    }
    if (p === 'ICMP') {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-100 dark:bg-cyan-950/80 text-cyan-700 dark:text-cyan-300 border border-cyan-400/40">
          ICMP
        </span>
      );
    }
    if (p === 'OSPF') {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 dark:bg-orange-950/80 text-orange-700 dark:text-orange-300 border border-orange-400/40">
          OSPF
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
        {proto}
      </span>
    );
  };

  const getStatusIcon = (status: SimulationEvent['status']) => {
    switch (status) {
      case 'success':
        return (
          <span title="Delivered">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          </span>
        );
      case 'failed':
        return (
          <span title="Dropped">
            <XCircle className="w-4 h-4 text-rose-500 shrink-0" />
          </span>
        );
      case 'in_progress':
      default:
        return (
          <span title="Queued / In Transit">
            <Clock className="w-4 h-4 text-amber-500 shrink-0 animate-spin" />
          </span>
        );
    }
  };

  return (
    <>
      {/* 1. Floating Simulation Controller Pill (Pinned Neatly at Bottom-Center) */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-2.5 py-1.5 rounded-full border border-slate-300 dark:border-slate-800 shadow-2xl select-none font-sans text-xs max-w-[92vw] overflow-x-auto no-scrollbar touch-manipulation">
        {/* Realtime vs Simulation Mode Toggle */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-full p-0.5 border border-slate-200 dark:border-slate-700 shrink-0">
          <button
            type="button"
            onClick={() => onToggleMode('realtime')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 touch-manipulation active:scale-95 ${
              mode === 'realtime'
                ? 'bg-[#0284c7] text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                mode === 'realtime' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'
              }`}
            />
            <span>Realtime</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onToggleMode('simulation');
              if (!isEventPanelOpen) onToggleEventPanel();
            }}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 touch-manipulation active:scale-95 ${
              mode === 'simulation'
                ? 'bg-[#0284c7] text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                mode === 'simulation' ? 'bg-amber-400' : 'bg-slate-400'
              }`}
            />
            <span>Simulation</span>
          </button>
        </div>

        {/* Simulation Playback & Speed Controls (Active in Simulation Mode) */}
        {mode === 'simulation' && (
          <div className="flex items-center gap-1 pl-1.5 border-l border-slate-300 dark:border-slate-700 shrink-0">
            {/* Play / Pause */}
            <button
              type="button"
              onClick={onPlayPause}
              className="p-1.5 rounded-full bg-sky-50 dark:bg-sky-950 text-sky-700 dark:text-sky-300 hover:bg-sky-100 cursor-pointer active:scale-95 transition-transform touch-manipulation"
              title={isSimulating ? 'Pause Auto-Capture' : 'Play / Auto-Capture'}
              aria-label={isSimulating ? 'Pause' : 'Play'}
            >
              {isSimulating ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
            </button>

            {/* Step Forward (Capture / Forward) */}
            <button
              type="button"
              onClick={onStepForward}
              className="px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 cursor-pointer active:scale-95 transition-transform touch-manipulation flex items-center gap-1 font-semibold text-[11px]"
              title="Capture / Forward (Step Hop-by-Hop)"
              aria-label="Capture / Forward"
            >
              <SkipForward className="w-3 h-3 text-sky-600 dark:text-sky-400" />
              <span>Forward</span>
            </button>

            {/* Playback Speed Selector (0.5x, 1x, 2x) */}
            {onSpeedChange && (
              <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-full p-0.5 border border-slate-200 dark:border-slate-700 ml-0.5">
                {[0.5, 1, 2].map((spd) => (
                  <button
                    key={spd}
                    type="button"
                    onClick={() => onSpeedChange(spd)}
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold transition-all cursor-pointer ${
                      simulationSpeed === spd
                        ? 'bg-sky-600 text-white shadow-2xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {spd}x
                  </button>
                ))}
              </div>
            )}

            {/* Reset Simulation */}
            <button
              type="button"
              onClick={onResetSimulation}
              className="p-1.5 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 cursor-pointer active:scale-95 transition-transform touch-manipulation ml-0.5"
              title="Reset Simulation Events"
              aria-label="Reset Simulation"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Drawer Toggle with Event Count Badge */}
        <button
          type="button"
          onClick={onToggleEventPanel}
          className="px-2.5 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-mono text-[11px] flex items-center gap-1.5 cursor-pointer shrink-0 transition-colors touch-manipulation active:scale-95"
          title="Toggle Simulation Event List"
        >
          <Activity className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
          <span className="font-bold">{events.length} Events</span>
          {isEventPanelOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
        </button>
      </div>

      {/* 2. Slide-Up Simulation Event List & PDU Drawer */}
      {isEventPanelOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs transition-opacity"
            onClick={onToggleEventPanel}
          />

          <div className="fixed inset-x-2 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 bottom-20 z-50 w-auto sm:w-[680px] bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-800 rounded-3xl shadow-2xl p-4 flex flex-col max-h-[62vh] animate-in slide-in-from-bottom duration-200 select-none text-xs">
            {/* Drawer Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                  Simulation Event List &amp; Packets
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  [{formatSeconds(elapsedSeconds)}]
                </span>
              </div>
              <button
                type="button"
                onClick={onToggleEventPanel}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 cursor-pointer touch-manipulation"
                aria-label="Close Event Panel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tab selection + Controls Bar */}
            <div className="flex items-center justify-between py-2 border-b border-slate-200 dark:border-slate-800 shrink-0">
              <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl text-[11px] font-semibold">
                <button
                  type="button"
                  onClick={() => setPanelTab('events')}
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer touch-manipulation ${
                    panelTab === 'events'
                      ? 'bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-300 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Event List ({events.length})
                </button>
                <button
                  type="button"
                  onClick={() => setPanelTab('pdus')}
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 touch-manipulation ${
                    panelTab === 'pdus'
                      ? 'bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-300 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <span>User PDUs</span>
                  {userPdus.length > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-blue-600 text-white text-[9px] font-bold">
                      {userPdus.length}
                    </span>
                  )}
                </button>
              </div>

              {/* Simulation Quick Step Controls */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={onPlayPause}
                  className="px-2.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-[11px] font-semibold flex items-center gap-1 cursor-pointer touch-manipulation active:scale-95 shadow-xs"
                >
                  {isSimulating ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3 fill-current" />}
                  <span>{isSimulating ? 'Pause' : 'Play'}</span>
                </button>
                <button
                  type="button"
                  onClick={onStepForward}
                  className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-semibold flex items-center gap-1 cursor-pointer touch-manipulation active:scale-95 shadow-xs"
                >
                  <SkipForward className="w-3 h-3" />
                  <span>Step</span>
                </button>
                <button
                  type="button"
                  onClick={onResetSimulation}
                  className="p-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer touch-manipulation active:scale-95 shadow-xs"
                  title="Reset"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Event List Table */}
            <div className="flex-1 overflow-y-auto pt-2">
              {panelTab === 'events' ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px] text-left border-collapse">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 uppercase font-semibold sticky top-0">
                      <tr>
                        <th className="p-2">Status</th>
                        <th className="p-2">Time</th>
                        <th className="p-2">Last Device</th>
                        <th className="p-2">At Device</th>
                        <th className="p-2">Protocol</th>
                        <th className="p-2">Type / Info</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                      {events.map((evt) => {
                        const isSelected = selectedEventId === evt.id;
                        return (
                          <tr
                            key={evt.id}
                            onClick={() => {
                              onSelectEvent?.(evt);
                              if (evt.pduInfo && onOpenPduInfo) {
                                onOpenPduInfo(evt.pduInfo);
                              }
                            }}
                            className={`hover:bg-sky-50 dark:hover:bg-slate-800/80 cursor-pointer transition-colors ${
                              isSelected ? 'bg-sky-100/60 dark:bg-slate-800 font-bold' : ''
                            }`}
                            title="Click to view 7 OSI Layers & Wireshark Dissector"
                          >
                            <td className="p-2">{getStatusIcon(evt.status)}</td>
                            <td className="p-2 text-slate-500 whitespace-nowrap">
                              {evt.time || formatSeconds(evt.step * 0.5)}
                            </td>
                            <td className="p-2 font-sans font-semibold text-slate-800 dark:text-slate-200">
                              {evt.lastDevice}
                            </td>
                            <td className="p-2 font-sans font-semibold text-slate-800 dark:text-slate-200">
                              {evt.atDevice}
                            </td>
                            <td className="p-2">{getProtocolBadge(evt.type)}</td>
                            <td className="p-2 font-sans text-slate-600 dark:text-slate-300 truncate max-w-[220px]">
                              {evt.info}
                            </td>
                          </tr>
                        );
                      })}
                      {events.length === 0 && (
                        <tr>
                          <td colSpan={6} className="text-center py-8 text-slate-400 dark:text-slate-500 font-sans">
                            No packet simulation events captured yet.
                            <div className="text-[11px] text-slate-400 mt-1">
                              Click the Envelope (Simple PDU) tool or Command Prompt ping to generate packets!
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                /* User PDUs Table */
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px] text-left border-collapse">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 uppercase font-semibold sticky top-0">
                      <tr>
                        <th className="p-2">Fire Status</th>
                        <th className="p-2">Source</th>
                        <th className="p-2">Destination</th>
                        <th className="p-2">Type</th>
                        <th className="p-2">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                      {userPdus.map((pdu) => (
                        <tr key={pdu.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                          <td className="p-2">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                pdu.fireStatus === 'Successful'
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                                  : pdu.fireStatus === 'Failed'
                                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                                  : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                              }`}
                            >
                              {pdu.fireStatus}
                            </span>
                          </td>
                          <td className="p-2 font-sans font-semibold text-slate-800 dark:text-slate-200">
                            {pdu.sourceName} ({pdu.sourceIp})
                          </td>
                          <td className="p-2 font-sans font-semibold text-slate-800 dark:text-slate-200">
                            {pdu.destName} ({pdu.destIp})
                          </td>
                          <td className="p-2">{getProtocolBadge(pdu.type)}</td>
                          <td className="p-2 text-slate-500">{pdu.time}</td>
                        </tr>
                      ))}
                      {userPdus.length === 0 && (
                        <tr>
                          <td colSpan={5} className="text-center py-8 text-slate-400 font-sans">
                            No User Simple PDUs created.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
};
