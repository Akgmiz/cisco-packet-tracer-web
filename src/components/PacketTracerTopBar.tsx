/**
 * Cisco Packet Tracer Top Bar
 * Features:
 *   - Quick Tools: Select, Place Note, Delete, Add Simple PDU, Zoom, Fit View
 *   - AI Diagnostics Copilot Quick Launch
 *   - Hamburger Drawer:
 *       * Save Lab (.pkt.json)
 *       * Open Lab (.pkt.json)
 *       * Export Topology Diagram (PNG Image)
 *       * AI Network Copilot (Tutor Mode)
 *       * New Canvas / Presets / Touch Help
 */

import React, { useState, useRef } from 'react';
import {
  Menu,
  X,
  RotateCcw,
  Trash2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Mail,
  FileText,
  FolderOpen,
  HelpCircle,
  MousePointer,
  Save,
  Upload,
  Sparkles,
  Camera,
} from 'lucide-react';
import { ActiveTool } from '../types/network';
import { PWAInstallButton } from './PWAInstallButton';

interface PacketTracerTopBarProps {
  activeTool: ActiveTool;
  onSelectTool: (tool: ActiveTool) => void;
  onNewCanvas: () => void;
  onOpenPresets: () => void;
  onOpenHelp: () => void;
  onUndo?: () => void;
  canUndo?: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitView: () => void;
  deviceCount: number;
  cableCount: number;
  onSaveLab?: () => void;
  onOpenLabFile?: (file: File) => void;
  onExportImage?: () => void;
  onOpenAiDiagnostics?: () => void;
}

export const PacketTracerTopBar: React.FC<PacketTracerTopBarProps> = ({
  activeTool,
  onSelectTool,
  onNewCanvas,
  onOpenPresets,
  onOpenHelp,
  onUndo,
  canUndo = false,
  onZoomIn,
  onZoomOut,
  onFitView,
  deviceCount,
  cableCount,
  onSaveLab,
  onOpenLabFile,
  onExportImage,
  onOpenAiDiagnostics,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [workspaceView, setWorkspaceView] = useState<'logical' | 'physical'>('logical');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onOpenLabFile) {
      onOpenLabFile(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.pkt.json"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Floating Compact Top Bar */}
      <header className="fixed top-2.5 inset-x-2.5 sm:inset-x-4 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-300 dark:border-slate-800 shadow-lg rounded-2xl px-2.5 py-1.5 flex items-center justify-between select-none">
        {/* Left Section: Hamburger Menu (≡) & Logical/Physical Pill */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Hamburger Menu (≡) Toggle Button */}
          <button
            type="button"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="w-10 h-10 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-200 cursor-pointer active:scale-95 transition-all touch-manipulation"
            title="Menu (Save, Open, Presets, AI Tutor)"
            aria-label="Open Navigation Menu"
          >
            {isMenuOpen ? <X className="w-5 h-5 text-slate-800 dark:text-slate-100" /> : <Menu className="w-5 h-5" />}
          </button>

          {/* Cisco Packet Tracer Brand Mark */}
          <div className="hidden md:flex items-center gap-1.5 pl-1 pr-2 border-r border-slate-200 dark:border-slate-800">
            <span className="w-2.5 h-2.5 rounded-xs bg-[#0077b6] inline-block shadow-xs" />
            <span className="text-xs font-bold text-slate-900 dark:text-slate-100 tracking-tight">Packet Tracer</span>
          </div>

          {/* AI Copilot Quick Button */}
          {onOpenAiDiagnostics && (
            <button
              type="button"
              onClick={onOpenAiDiagnostics}
              className="px-2.5 py-1.5 rounded-xl text-[11px] sm:text-xs font-bold bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-xs hover:brightness-110 transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 touch-manipulation"
              title="AI Network Copilot (Tutor Mode & Diagnostics)"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
              <span className="hidden sm:inline">AI Diagnose</span>
            </button>
          )}

          {/* Logical / Physical Workspace Small Toggle Button */}
          <button
            type="button"
            onClick={() => setWorkspaceView(workspaceView === 'logical' ? 'physical' : 'logical')}
            className="px-2.5 py-1.5 rounded-xl text-[11px] sm:text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-blue-700 dark:text-sky-400 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer flex items-center gap-1.5 active:scale-95 touch-manipulation"
            title="Toggle Logical / Physical Workspace"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                workspaceView === 'logical' ? 'bg-blue-600 dark:bg-sky-400' : 'bg-slate-400'
              } inline-block`}
            />
            <span>{workspaceView === 'logical' ? 'Logical' : 'Physical'}</span>
          </button>
        </div>

        {/* Center / Right Section: Essential Quick Action Tools */}
        <div className="flex items-center gap-1 sm:gap-1.5">
          {/* Tool: Select Tool */}
          <button
            type="button"
            onClick={() => onSelectTool('select')}
            className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer touch-manipulation active:scale-95 ${
              activeTool === 'select'
                ? 'bg-sky-100 text-sky-700 ring-2 ring-sky-400 font-bold'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title="Select tool"
            aria-label="Select tool"
          >
            <MousePointer className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
          </button>

          {/* Tool: Place Note */}
          <button
            type="button"
            onClick={() => onSelectTool('note')}
            className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer touch-manipulation active:scale-95 ${
              activeTool === 'note'
                ? 'bg-amber-100 text-amber-800 ring-2 ring-amber-400 font-bold'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title="Place Note"
            aria-label="Place Note"
          >
            <FileText className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
          </button>

          {/* Tool: Delete Tool */}
          <button
            type="button"
            onClick={() => onSelectTool('delete')}
            className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer touch-manipulation active:scale-95 ${
              activeTool === 'delete'
                ? 'bg-rose-100 text-rose-700 ring-2 ring-rose-400 font-bold'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title="Delete Tool"
            aria-label="Delete Tool"
          >
            <Trash2 className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
          </button>

          {/* Tool: Add Simple PDU (Envelope) */}
          <button
            type="button"
            onClick={() => onSelectTool('pdu')}
            className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer touch-manipulation relative active:scale-95 ${
              activeTool === 'pdu'
                ? 'bg-yellow-100 text-yellow-900 ring-2 ring-yellow-400 font-bold'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title="Add Simple PDU (Ping Host A to Host B)"
            aria-label="Add Simple PDU"
          >
            <Mail className="w-4 h-4 sm:w-4.5 sm:h-4.5 fill-yellow-400 text-yellow-700" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500" />
          </button>

          {/* Divider */}
          <div className="w-px h-5 bg-slate-300 dark:bg-slate-700 mx-0.5" />

          {/* Tool: Zoom Out */}
          <button
            type="button"
            onClick={onZoomOut}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-300 cursor-pointer touch-manipulation active:scale-95"
            title="Zoom Out"
            aria-label="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          {/* Tool: Zoom In */}
          <button
            type="button"
            onClick={onZoomIn}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-300 cursor-pointer touch-manipulation active:scale-95"
            title="Zoom In"
            aria-label="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          {/* Tool: Fit View */}
          <button
            type="button"
            onClick={onFitView}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-300 cursor-pointer touch-manipulation active:scale-95"
            title="Fit View"
            aria-label="Fit View"
          >
            <Maximize2 className="w-4 h-4" />
          </button>

          {/* AI Diagnostics Copilot Quick Button */}
          {onOpenAiDiagnostics && (
            <button
              type="button"
              onClick={onOpenAiDiagnostics}
              className="ml-1 px-2.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer transition-all active:scale-95"
              title="AI Network Diagnostics Copilot"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">AI Diagnostics</span>
            </button>
          )}
        </div>
      </header>

      {/* Hamburger Menu Dropdown / Slide Drawer */}
      {isMenuOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs transition-opacity"
            onClick={() => setIsMenuOpen(false)}
          />

          <div className="fixed top-16 left-3 sm:left-4 z-50 w-80 bg-white dark:bg-slate-900 rounded-3xl border border-slate-300 dark:border-slate-800 shadow-2xl p-4 text-xs space-y-3 animate-in fade-in slide-in-from-top-3 duration-150 select-none">
            {/* Menu Header */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5">
              <div>
                <span className="font-bold text-slate-900 dark:text-slate-100 block text-sm">
                  Cisco Packet Tracer
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  {deviceCount} Devices · {cableCount} Links
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsMenuOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Menu Actions */}
            <div className="space-y-1">
              {/* Save Lab */}
              {onSaveLab && (
                <button
                  type="button"
                  onClick={() => {
                    onSaveLab();
                    setIsMenuOpen(false);
                  }}
                  className="w-full px-3 py-2.5 rounded-xl text-left hover:bg-sky-50 dark:hover:bg-slate-800 flex items-center gap-3 text-slate-700 dark:text-slate-200 font-medium cursor-pointer transition-colors"
                >
                  <Save className="w-4 h-4 text-sky-600" />
                  <div>
                    <span className="block font-bold">Save Lab (.pkt.json)</span>
                    <span className="text-[10px] text-slate-400">Download complete topology &amp; configs</span>
                  </div>
                </button>
              )}

              {/* Open Lab */}
              {onOpenLabFile && (
                <button
                  type="button"
                  onClick={() => {
                    fileInputRef.current?.click();
                    setIsMenuOpen(false);
                  }}
                  className="w-full px-3 py-2.5 rounded-xl text-left hover:bg-sky-50 dark:hover:bg-slate-800 flex items-center gap-3 text-slate-700 dark:text-slate-200 font-medium cursor-pointer transition-colors"
                >
                  <Upload className="w-4 h-4 text-emerald-600" />
                  <div>
                    <span className="block font-bold">Open Lab (.pkt.json)</span>
                    <span className="text-[10px] text-slate-400">Upload and restore existing lab state</span>
                  </div>
                </button>
              )}

              {/* Export Topology Image */}
              {onExportImage && (
                <button
                  type="button"
                  onClick={() => {
                    onExportImage();
                    setIsMenuOpen(false);
                  }}
                  className="w-full px-3 py-2.5 rounded-xl text-left hover:bg-purple-50 dark:hover:bg-slate-800 flex items-center gap-3 text-slate-700 dark:text-slate-200 font-medium cursor-pointer transition-colors"
                >
                  <Camera className="w-4 h-4 text-purple-600" />
                  <div>
                    <span className="block font-bold">Export Topology Diagram</span>
                    <span className="text-[10px] text-slate-400">Download crisp PNG image for lab reports</span>
                  </div>
                </button>
              )}

              {/* AI Diagnostics Copilot */}
              {onOpenAiDiagnostics && (
                <button
                  type="button"
                  onClick={() => {
                    onOpenAiDiagnostics();
                    setIsMenuOpen(false);
                  }}
                  className="w-full px-3 py-2.5 rounded-xl text-left hover:bg-purple-50 dark:hover:bg-slate-800 flex items-center gap-3 text-purple-700 dark:text-purple-300 font-medium cursor-pointer transition-colors"
                >
                  <Sparkles className="w-4 h-4 text-purple-500" />
                  <div>
                    <span className="block font-bold">AI Network Copilot</span>
                    <span className="text-[10px] text-purple-400">Run CCNA health scan &amp; auto-fixes</span>
                  </div>
                </button>
              )}

              <div className="w-full h-px bg-slate-200 dark:bg-slate-800 my-1" />

              {/* New Canvas */}
              <button
                type="button"
                onClick={() => {
                  onNewCanvas();
                  setIsMenuOpen(false);
                }}
                className="w-full px-3 py-2.5 rounded-xl text-left hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-3 text-slate-700 dark:text-slate-200 font-medium cursor-pointer transition-colors"
              >
                <FileText className="w-4 h-4 text-slate-500" />
                <span>New / Clear Canvas</span>
              </button>

              {/* Topology Presets */}
              <button
                type="button"
                onClick={() => {
                  onOpenPresets();
                  setIsMenuOpen(false);
                }}
                className="w-full px-3 py-2.5 rounded-xl text-left hover:bg-amber-50 dark:hover:bg-slate-800 flex items-center gap-3 text-slate-700 dark:text-slate-200 font-medium cursor-pointer transition-colors"
              >
                <FolderOpen className="w-4 h-4 text-amber-600" />
                <span>Load Topology Presets</span>
              </button>

              {/* Help Modal */}
              <button
                type="button"
                onClick={() => {
                  onOpenHelp();
                  setIsMenuOpen(false);
                }}
                className="w-full px-3 py-2.5 rounded-xl text-left hover:bg-emerald-50 dark:hover:bg-slate-800 flex items-center gap-3 text-slate-700 dark:text-slate-200 font-medium cursor-pointer transition-colors"
              >
                <HelpCircle className="w-4 h-4 text-emerald-600" />
                <span>Help &amp; Touch Shortcuts</span>
              </button>
            </div>

            {/* PWA Install Button */}
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
              <PWAInstallButton className="w-full justify-center !py-2.5 !rounded-xl !bg-slate-900 !text-white" />
            </div>
          </div>
        </>
      )}
    </>
  );
};
