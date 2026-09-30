import React from 'react';
import { DevicePort, NetworkDeviceData } from '../types/network';
import { Network, Check, ShieldAlert } from 'lucide-react';

interface PortSelectionModalProps {
  device: NetworkDeviceData | null;
  isOpen: boolean;
  onClose: () => void;
  onSelectPort: (portId: string) => void;
  title?: string;
  subtitle?: string;
  pendingSource?: {
    deviceId: string;
    portId: string;
    portName: string;
  } | null;
  edges?: any[];
}

export const PortSelectionModal: React.FC<PortSelectionModalProps> = ({
  device,
  isOpen,
  onClose,
  onSelectPort,
  title,
  subtitle,
  pendingSource,
  edges = [],
}) => {
  if (!isOpen || !device) return null;

  const resolvedSubtitle =
    subtitle ||
    (pendingSource
      ? `Connecting to ${device.name}: source is ${pendingSource.deviceId} [${pendingSource.portName}]`
      : `Choose an interface to connect cable`);

  const ports = device.ports || [];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 pointer-events-none select-none font-sans">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs pointer-events-auto transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog (Bottom sheet on mobile, centered modal on desktop) */}
      <div className="relative w-full sm:max-w-md bg-white dark:bg-slate-900 border-t-2 sm:border-2 border-slate-300 dark:border-slate-700 rounded-t-3xl sm:rounded-2xl shadow-2xl pointer-events-auto max-h-[82vh] flex flex-col overflow-hidden text-slate-800 dark:text-slate-100 animate-in slide-in-from-bottom sm:slide-in-from-bottom-2 duration-150">
        {/* Mobile Pull Handle */}
        <div
          className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto my-2.5 cursor-pointer touch-manipulation sm:hidden shrink-0"
          onClick={onClose}
        />

        {/* Header */}
        <div className="px-4 py-3 bg-[#1e293b] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-400/40 flex items-center justify-center shrink-0">
              <Network className="w-4 h-4 text-sky-400" />
            </div>
            <div>
              <span className="font-bold text-sm block leading-tight text-white">
                {title || `${device.name || device.id} — Select Interface`}
              </span>
              <span className="text-[11px] text-slate-300 font-mono">
                {subtitle || `Choose port to attach cable`}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center text-xs font-bold cursor-pointer touch-manipulation"
          >
            ✕
          </button>
        </div>

        {/* Port List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5 divide-y divide-slate-100 dark:divide-slate-800">
          {ports.length === 0 ? (
            <div className="text-center py-6 text-slate-400 text-xs italic">
              No interfaces available on this device.
            </div>
          ) : (
            ports.map((port) => {
              const connectedEdge = edges.find(
                (e) =>
                  (e.source === device.id && (e.data?.sourcePortId === port.id || e.data?.sourcePortName === port.name)) ||
                  (e.target === device.id && (e.data?.targetPortId === port.id || e.data?.targetPortName === port.name))
              );
              const isConnected = !!port.connectedTo || !!connectedEdge;
              const isShutdown = port.status === 'admin_down';
              const remoteNodeId = port.connectedTo?.nodeId || (connectedEdge ? (connectedEdge.source === device.id ? connectedEdge.target : connectedEdge.source) : null);

              return (
                <button
                  key={port.id}
                  type="button"
                  disabled={isConnected}
                  onClick={() => {
                    onSelectPort(port.id);
                    onClose();
                  }}
                  className={`w-full px-3.5 py-2.5 rounded-xl flex items-center justify-between transition-all touch-manipulation text-left ${
                    isConnected
                      ? 'bg-slate-100/80 dark:bg-slate-800/40 text-slate-400 cursor-not-allowed opacity-60'
                      : 'hover:bg-sky-50 dark:hover:bg-slate-800 cursor-pointer active:scale-98 text-slate-800 dark:text-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Status LED */}
                    <div
                      className={`w-3 h-3 rounded-full border border-white dark:border-slate-800 shrink-0 ${
                        isShutdown
                          ? 'bg-rose-500 shadow-[0_0_6px_#ef4444]'
                          : isConnected
                          ? 'bg-emerald-500 shadow-[0_0_6px_#10b981]'
                          : 'bg-emerald-400 shadow-[0_0_6px_#34d399]'
                      }`}
                      title={
                        isShutdown
                          ? 'Administratively Down (shutdown)'
                          : isConnected
                          ? 'Connected'
                          : 'Port Available (Up)'
                      }
                    />

                    <div>
                      <div className="font-bold text-xs font-mono text-slate-800 dark:text-slate-100">
                        {port.name || port.id}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono flex items-center gap-1.5">
                        {port.ip ? (
                          <span className="text-sky-600 dark:text-sky-400 font-semibold">IP: {port.ip}</span>
                        ) : isShutdown ? (
                          <span className="text-rose-500 flex items-center gap-0.5">
                            <ShieldAlert className="w-2.5 h-2.5" /> admin shutdown (Red LED)
                          </span>
                        ) : (
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                            {port.type === 'gigabit' ? 'Gigabit (Up)' : 'FastEthernet (Up)'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isConnected ? (
                      <span className="px-2.5 py-0.5 rounded text-[10px] font-mono bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                        In Use ({remoteNodeId})
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-lg text-[10px] font-bold bg-sky-600 hover:bg-sky-500 text-white flex items-center gap-1 shadow-xs">
                        <Check className="w-3 h-3" />
                        <span>Select Port</span>
                      </span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
