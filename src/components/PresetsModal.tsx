import React from 'react';
import { X, Network, AlertTriangle, GitFork, Trash2, CheckCircle2 } from 'lucide-react';

export interface TopologyPreset {
  id: string;
  name: string;
  description: string;
  category: string;
  nodeCount: number;
  expectedPing: 'success' | 'unreachable' | 'custom';
}

interface PresetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadPreset: (presetId: string) => void;
}

export const PRESETS: TopologyPreset[] = [
  {
    id: 'star-lan',
    name: 'Standard Star LAN',
    category: 'Layer 2 Switching',
    description: 'A central FastBridge Switch connected to PC-1, PC-2, and WebServer on subnet 192.168.1.0/24. Ping succeeds instantly.',
    nodeCount: 4,
    expectedPing: 'success',
  },
  {
    id: 'subnet-mismatch',
    name: 'Subnet Mismatch Test',
    category: 'Layer 3 Isolation',
    description: 'Two workstations (192.168.1.10 and 192.168.2.20) physically wired to the same Switch, but configured on distinct subnets without a router. Triggers "Destination Host Unreachable".',
    nodeCount: 3,
    expectedPing: 'unreachable',
  },
  {
    id: 'routed-gateway',
    name: 'Dual-Subnet Router Gateway',
    category: 'Inter-VLAN Routing',
    description: 'An enterprise gateway router connecting two independent branch subnets (10.0.1.0/24 and 10.0.2.0/24) via dedicated switches.',
    nodeCount: 5,
    expectedPing: 'custom',
  },
  {
    id: 'empty',
    name: 'Blank Canvas',
    category: 'Scratchpad',
    description: 'Empty workspace with an infinite canvas ready for custom manual topology design.',
    nodeCount: 0,
    expectedPing: 'custom',
  },
];

export const PresetsModal: React.FC<PresetsModalProps> = ({
  isOpen,
  onClose,
  onLoadPreset,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
      <div
        className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs pointer-events-auto transition-opacity"
        onClick={onClose}
      />

      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl pointer-events-auto overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div>
            <h3 className="text-base font-semibold text-slate-100">Network Topology Presets</h3>
            <p className="text-xs text-slate-400">Load interactive networking lab scenarios</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-2.5 max-h-[70vh] overflow-y-auto">
          {PRESETS.map((preset) => {
            return (
              <div
                key={preset.id}
                onClick={() => {
                  onLoadPreset(preset.id);
                  onClose();
                }}
                className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-sky-500/70 hover:bg-slate-800/40 transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm text-slate-200 group-hover:text-sky-300 transition-colors">
                    {preset.name}
                  </span>
                  <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                    <span>{preset.category}</span>
                    <span aria-hidden="true">·</span>
                    <span>{preset.nodeCount} Nodes</span>
                  </div>
                </div>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                  {preset.description}
                </p>
              </div>
            );
          })}
        </div>

        <div className="px-5 py-3 bg-slate-950 border-t border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
