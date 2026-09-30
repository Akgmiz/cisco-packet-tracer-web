import React from 'react';
import { DeviceType } from '../types/network';
import {
  Router as RouterIcon,
  Network,
  Monitor,
  Server,
  Activity,
  Cable,
  FolderOpen,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Trash2,
  HelpCircle,
  Plus
} from 'lucide-react';

interface FloatingToolbarProps {
  onAddNode: (type: DeviceType) => void;
  onOpenPingModal: () => void;
  onOpenPresets: () => void;
  onOpenHelp: () => void;
  onClearCanvas: () => void;
  onFitView: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  connectingSource: { nodeId: string; portId: string } | null;
  onCancelConnecting: () => void;
  isPinging?: boolean;
}

const NODE_ITEMS: Array<{
  type: DeviceType;
  label: string;
  sub: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  borderColor: string;
}> = [
  {
    type: 'router',
    label: 'Router',
    sub: 'Gateway L3',
    icon: RouterIcon,
    color: 'text-amber-400 bg-amber-500/10 group-hover:bg-amber-500/20',
    borderColor: 'border-amber-500/30 group-hover:border-amber-500/60',
  },
  {
    type: 'switch',
    label: 'Switch',
    sub: 'Bridge L2',
    icon: Network,
    color: 'text-indigo-400 bg-indigo-500/10 group-hover:bg-indigo-500/20',
    borderColor: 'border-indigo-500/30 group-hover:border-indigo-500/60',
  },
  {
    type: 'pc',
    label: 'PC',
    sub: 'Workstation',
    icon: Monitor,
    color: 'text-sky-400 bg-sky-500/10 group-hover:bg-sky-500/20',
    borderColor: 'border-sky-500/30 group-hover:border-sky-500/60',
  },
  {
    type: 'server',
    label: 'Server',
    sub: 'Datacenter',
    icon: Server,
    color: 'text-purple-400 bg-purple-500/10 group-hover:bg-purple-500/20',
    borderColor: 'border-purple-500/30 group-hover:border-purple-500/60',
  },
];

export const FloatingToolbar: React.FC<FloatingToolbarProps> = ({
  onAddNode,
  onOpenPingModal,
  onOpenPresets,
  onOpenHelp,
  onClearCanvas,
  onFitView,
  onZoomIn,
  onZoomOut,
  connectingSource,
  onCancelConnecting,
  isPinging,
}) => {
  // Support desktop drag-and-drop
  const handleDragStart = (event: React.DragEvent, type: DeviceType) => {
    event.dataTransfer.setData('application/reactflow', type);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-40 w-full max-w-4xl px-3 pointer-events-none">
      {/* If currently in port connection mode, display an actionable helper banner above toolbar */}
      {connectingSource && (
        <div className="mb-2 flex items-center justify-between gap-3 px-4 py-2 bg-cyan-950/95 border border-cyan-400/80 rounded-xl shadow-xl pointer-events-auto backdrop-blur-md animate-in slide-in-from-bottom-2">
          <div className="flex items-center gap-2 text-cyan-200 text-xs">
            <Cable className="w-4 h-4 text-cyan-400 animate-pulse" />
            <span>
              Port <strong>{connectingSource.portId}</strong> selected. Tap any device port to connect cable.
            </span>
          </div>
          <button
            type="button"
            onClick={onCancelConnecting}
            className="px-2.5 py-1 rounded-lg bg-cyan-900/60 hover:bg-cyan-800 text-cyan-100 text-xs font-medium border border-cyan-500/40 transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Main Floating Deck */}
      <div className="pointer-events-auto bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-2xl p-2 sm:p-2.5 shadow-2xl flex flex-wrap sm:flex-nowrap items-center justify-between gap-2">
        {/* Network Device Buttons (Draggable & Tappable) */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-1 justify-around sm:justify-start">
          {NODE_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.type}
                type="button"
                draggable
                onDragStart={(e) => handleDragStart(e, item.type)}
                onClick={() => onAddNode(item.type)}
                className={`group flex items-center gap-2 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl bg-slate-950/60 border ${item.borderColor} hover:bg-slate-800/80 transition-all duration-200 cursor-grab active:cursor-grabbing text-left shrink-0`}
                title={`Tap to add or drag to canvas: ${item.label}`}
              >
                <div className={`p-1.5 rounded-lg border border-slate-700/50 ${item.color} transition-colors`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="hidden xs:block">
                  <div className="text-xs font-semibold text-slate-200 group-hover:text-white leading-none">
                    {item.label}
                  </div>
                  <div className="text-[9px] text-slate-400 font-mono leading-tight mt-0.5">
                    {item.sub}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Divider */}
        <div className="hidden md:block w-px h-8 bg-slate-800 shrink-0" />

        {/* Action Tools */}
        <div className="flex items-center gap-1.5 shrink-0 justify-end">
          {/* Ping Tool Trigger */}
          <button
            type="button"
            onClick={onOpenPingModal}
            className={`px-3 py-1.5 sm:py-2 rounded-xl font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
              isPinging
                ? 'bg-sky-500 text-slate-950 animate-pulse shadow-[0_0_16px_rgba(14,165,233,0.5)]'
                : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-[0_0_14px_rgba(16,185,129,0.3)]'
            }`}
            title="Open Ping Tool"
          >
            <Activity className="w-4 h-4 fill-current" />
            <span className="font-semibold">Ping Tool</span>
          </button>

          {/* Presets Topology */}
          <button
            type="button"
            onClick={onOpenPresets}
            className="p-2 sm:px-2.5 sm:py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Load Preset Topologies"
          >
            <FolderOpen className="w-4 h-4" />
            <span className="hidden sm:inline">Presets</span>
          </button>

          {/* Quick Canvas View Controls */}
          <div className="hidden lg:flex items-center bg-slate-950/60 border border-slate-800 rounded-xl p-0.5">
            <button
              type="button"
              onClick={onZoomIn}
              className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onZoomOut}
              className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onFitView}
              className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title="Fit View"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Help button */}
          <button
            type="button"
            onClick={onOpenHelp}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700 transition-colors cursor-pointer"
            title="Help & Shortcuts"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
