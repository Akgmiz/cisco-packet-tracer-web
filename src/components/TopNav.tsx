import React from 'react';
import { Activity, Plus, RotateCcw, Share2, Layers, HelpCircle } from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';

interface TopNavProps {
  deviceCount: number;
  cableCount: number;
  onOpenPing: () => void;
  onOpenPresets: () => void;
  onOpenHelp: () => void;
  onClear: () => void;
}

export const TopNav: React.FC<TopNavProps> = ({
  deviceCount,
  cableCount,
  onOpenPing,
  onOpenPresets,
  onOpenHelp,
  onClear,
}) => {
  return (
    <header className="fixed top-0 left-0 right-0 z-30 h-14 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80 px-4 md:px-6 flex items-center justify-between pointer-events-auto">
      {/* Zone 1: Brand Wordmark (Single text element in high-character display font) */}
      <div className="flex items-center gap-3">
        <a href="/" className="text-base md:text-lg font-bold tracking-tight text-slate-100 flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-sky-400 shadow-[0_0_8px_#38bdf8] inline-block" />
          NetCanvas
        </a>

        {/* Clean unboxed metadata with dot separators */}
        <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 font-mono pl-3 border-l border-slate-800">
          <span>{deviceCount} Nodes</span>
          <span aria-hidden="true">·</span>
          <span>{cableCount} Cables</span>
          <span aria-hidden="true">·</span>
          <span className="text-emerald-400">Online</span>
        </div>
      </div>

      {/* Zone 2: Clean Text Links / Secondary Controls */}
      <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-400">
        <button
          type="button"
          onClick={onOpenPresets}
          className="hover:text-slate-100 transition-colors whitespace-nowrap cursor-pointer"
        >
          Topologies
        </button>
        <button
          type="button"
          onClick={onOpenPing}
          className="hover:text-slate-100 transition-colors whitespace-nowrap cursor-pointer"
        >
          Ping Tracer
        </button>
        <button
          type="button"
          onClick={onOpenHelp}
          className="hover:text-slate-100 transition-colors whitespace-nowrap cursor-pointer"
        >
          Documentation
        </button>
      </nav>

      {/* Zone 3: Primary Actions */}
      <div className="flex items-center gap-2">
        <PWAInstallButton />
        <button
          type="button"
          onClick={onClear}
          className="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-900 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          title="Clear canvas"
        >
          Reset
        </button>
        <button
          type="button"
          onClick={onOpenPing}
          className="px-3.5 py-1.5 text-xs font-semibold text-slate-950 bg-sky-400 hover:bg-sky-300 rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 shadow-[0_0_12px_rgba(56,189,248,0.25)] cursor-pointer"
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Test Ping</span>
        </button>
      </div>
    </header>
  );
};
