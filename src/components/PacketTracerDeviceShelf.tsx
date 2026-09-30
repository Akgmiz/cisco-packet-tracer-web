import React, { useState } from 'react';
import { DeviceType, CableType } from '../types/network';
import {
  RouterIconPT,
  SwitchIconPT,
  HubIconPT,
  PcIconPT,
  LaptopIconPT,
  ServerIconPT,
  LightningCablePT,
} from './PacketTracerIcons';
import { Plus, X, Zap, Cable } from 'lucide-react';

export type ShelfCategory = 'routers' | 'switches' | 'end_devices' | 'connections';

interface PacketTracerDeviceShelfProps {
  onAddDevice: (type: DeviceType, model?: string) => void;
  onSelectCable: (cableType: CableType) => void;
  activeCableType: CableType | null;
}

export const PacketTracerDeviceShelf: React.FC<PacketTracerDeviceShelfProps> = ({
  onAddDevice,
  onSelectCable,
  activeCableType,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<ShelfCategory>('routers');

  const handleDeviceTap = (type: DeviceType, model?: string) => {
    onAddDevice(type, model);
    setIsOpen(false);
  };

  const handleCableTap = (type: CableType) => {
    onSelectCable(type);
    setIsOpen(false);
  };

  const handleDragStart = (e: React.DragEvent, type: DeviceType, model: string) => {
    e.dataTransfer.setData('application/reactflow', JSON.stringify({ type, model }));
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <>
      {/* Floating '+' Action Button (Bottom-Left) */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-4 left-4 z-30 w-14 h-14 rounded-full bg-[#0284c7] hover:bg-[#0369a1] text-white shadow-2xl flex items-center justify-center cursor-pointer active:scale-95 transition-all border-2 border-white touch-manipulation"
        title="Add Network Device or Cable"
        aria-label="Add Device"
      >
        {isOpen ? (
          <X className="w-6 h-6 text-white" />
        ) : (
          <Plus className="w-7 h-7 text-white stroke-[2.5]" />
        )}
      </button>

      {/* Smooth Touch-Friendly Bottom Sheet Drawer */}
      {isOpen && (
        <>
          {/* Backdrop overlay */}
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs transition-opacity"
            onClick={() => setIsOpen(false)}
          />

          {/* Bottom Sheet Container */}
          <div className="fixed inset-x-0 bottom-0 z-50 bg-[#dbe1ea] border-t-2 border-slate-300 rounded-t-3xl shadow-2xl p-4 max-h-[70vh] flex flex-col animate-in slide-in-from-bottom duration-200 select-none">
            {/* Drag Handle Bar Affordance */}
            <div
              className="w-12 h-1.5 bg-slate-400 rounded-full mx-auto mb-2.5 cursor-pointer touch-manipulation"
              onClick={() => setIsOpen(false)}
            />

            {/* Drawer Title & Close */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-300">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-xs bg-[#0077b6] inline-block shadow-xs" />
                <span className="font-bold text-slate-900 text-sm">Add Device to Canvas</span>
                <span className="text-[11px] text-slate-500 hidden sm:inline">(Tap to place at center)</span>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center text-slate-600 cursor-pointer touch-manipulation"
                aria-label="Close device drawer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Category Segmented Touch Tabs */}
            <div className="grid grid-cols-4 gap-1 p-1 bg-[#c8d2df] rounded-xl my-2.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveCategory('routers')}
                className={`py-2 rounded-lg text-center transition-all cursor-pointer touch-manipulation ${
                  activeCategory === 'routers'
                    ? 'bg-white text-blue-700 shadow-sm font-bold'
                    : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                Routers
              </button>
              <button
                type="button"
                onClick={() => setActiveCategory('switches')}
                className={`py-2 rounded-lg text-center transition-all cursor-pointer touch-manipulation ${
                  activeCategory === 'switches'
                    ? 'bg-white text-blue-700 shadow-sm font-bold'
                    : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                Switches
              </button>
              <button
                type="button"
                onClick={() => setActiveCategory('end_devices')}
                className={`py-2 rounded-lg text-center transition-all cursor-pointer touch-manipulation ${
                  activeCategory === 'end_devices'
                    ? 'bg-white text-blue-700 shadow-sm font-bold'
                    : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                PCs
              </button>
              <button
                type="button"
                onClick={() => setActiveCategory('connections')}
                className={`py-2 rounded-lg text-center transition-all cursor-pointer touch-manipulation ${
                  activeCategory === 'connections'
                    ? 'bg-white text-amber-700 shadow-sm font-bold'
                    : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                Wires
              </button>
            </div>

            {/* Device Grid for Selected Category */}
            <div className="flex-1 overflow-y-auto py-1">
              {/* Category 1: Routers */}
              {activeCategory === 'routers' && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div
                    draggable
                    onDragStart={(e) => handleDragStart(e, 'router', '1941')}
                    onClick={() => handleDeviceTap('router', '1941')}
                    className="p-3 bg-white hover:bg-sky-50 border border-slate-300 hover:border-sky-500 rounded-2xl flex flex-col items-center justify-center text-center shadow-xs cursor-pointer active:scale-95 transition-all touch-manipulation min-h-[90px]"
                  >
                    <RouterIconPT size={48} />
                    <span className="font-bold text-xs text-slate-900 mt-1.5">Cisco 1941</span>
                    <span className="text-[10px] text-slate-500">Dual Gigabit Router</span>
                  </div>

                  <div
                    draggable
                    onDragStart={(e) => handleDragStart(e, 'router', '2911')}
                    onClick={() => handleDeviceTap('router', '2911')}
                    className="p-3 bg-white hover:bg-sky-50 border border-slate-300 hover:border-sky-500 rounded-2xl flex flex-col items-center justify-center text-center shadow-xs cursor-pointer active:scale-95 transition-all touch-manipulation min-h-[90px]"
                  >
                    <RouterIconPT size={48} />
                    <span className="font-bold text-xs text-slate-900 mt-1.5">Cisco 2911</span>
                    <span className="text-[10px] text-slate-500">Triple Gigabit ISR</span>
                  </div>
                </div>
              )}

              {/* Category 2: Switches */}
              {activeCategory === 'switches' && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div
                    draggable
                    onDragStart={(e) => handleDragStart(e, 'switch', '2960')}
                    onClick={() => handleDeviceTap('switch', '2960')}
                    className="p-3 bg-white hover:bg-sky-50 border border-slate-300 hover:border-sky-500 rounded-2xl flex flex-col items-center justify-center text-center shadow-xs cursor-pointer active:scale-95 transition-all touch-manipulation min-h-[90px]"
                  >
                    <SwitchIconPT size={48} />
                    <span className="font-bold text-xs text-slate-900 mt-1.5">Catalyst 2960</span>
                    <span className="text-[10px] text-slate-500">24-Port FastEthernet</span>
                  </div>

                  <div
                    draggable
                    onDragStart={(e) => handleDragStart(e, 'switch', '3650')}
                    onClick={() => handleDeviceTap('switch', '3650')}
                    className="p-3 bg-white hover:bg-sky-50 border border-slate-300 hover:border-sky-500 rounded-2xl flex flex-col items-center justify-center text-center shadow-xs cursor-pointer active:scale-95 transition-all touch-manipulation min-h-[90px]"
                  >
                    <SwitchIconPT size={48} />
                    <span className="font-bold text-xs text-slate-900 mt-1.5">Catalyst 3650</span>
                    <span className="text-[10px] text-slate-500">Multilayer L3 Switch</span>
                  </div>

                  <div
                    draggable
                    onDragStart={(e) => handleDragStart(e, 'hub', 'Hub-PT')}
                    onClick={() => handleDeviceTap('hub', 'Hub-PT')}
                    className="p-3 bg-white hover:bg-sky-50 border border-slate-300 hover:border-sky-500 rounded-2xl flex flex-col items-center justify-center text-center shadow-xs cursor-pointer active:scale-95 transition-all touch-manipulation min-h-[90px]"
                  >
                    <HubIconPT size={48} />
                    <span className="font-bold text-xs text-slate-900 mt-1.5">Hub-PT</span>
                    <span className="text-[10px] text-slate-500">Broadcast Repeater</span>
                  </div>
                </div>
              )}

              {/* Category 3: End Devices (PCs) */}
              {activeCategory === 'end_devices' && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div
                    draggable
                    onDragStart={(e) => handleDragStart(e, 'pc', 'PC-PT')}
                    onClick={() => handleDeviceTap('pc', 'PC-PT')}
                    className="p-3 bg-white hover:bg-sky-50 border border-slate-300 hover:border-sky-500 rounded-2xl flex flex-col items-center justify-center text-center shadow-xs cursor-pointer active:scale-95 transition-all touch-manipulation min-h-[90px]"
                  >
                    <PcIconPT size={48} />
                    <span className="font-bold text-xs text-slate-900 mt-1.5">PC-PT</span>
                    <span className="text-[10px] text-slate-500">Desktop Workstation</span>
                  </div>

                  <div
                    draggable
                    onDragStart={(e) => handleDragStart(e, 'laptop', 'Laptop-PT')}
                    onClick={() => handleDeviceTap('laptop', 'Laptop-PT')}
                    className="p-3 bg-white hover:bg-sky-50 border border-slate-300 hover:border-sky-500 rounded-2xl flex flex-col items-center justify-center text-center shadow-xs cursor-pointer active:scale-95 transition-all touch-manipulation min-h-[90px]"
                  >
                    <LaptopIconPT size={48} />
                    <span className="font-bold text-xs text-slate-900 mt-1.5">Laptop-PT</span>
                    <span className="text-[10px] text-slate-500">Mobile Station</span>
                  </div>

                  <div
                    draggable
                    onDragStart={(e) => handleDragStart(e, 'server', 'Server-PT')}
                    onClick={() => handleDeviceTap('server', 'Server-PT')}
                    className="p-3 bg-white hover:bg-sky-50 border border-slate-300 hover:border-sky-500 rounded-2xl flex flex-col items-center justify-center text-center shadow-xs cursor-pointer active:scale-95 transition-all touch-manipulation min-h-[90px]"
                  >
                    <ServerIconPT size={48} />
                    <span className="font-bold text-xs text-slate-900 mt-1.5">Server-PT</span>
                    <span className="text-[10px] text-slate-500">DHCP / Web / DNS</span>
                  </div>
                </div>
              )}

              {/* Category 4: Connections (Wires) */}
              {activeCategory === 'connections' && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div
                    onClick={() => handleCableTap('auto')}
                    className={`p-3 bg-white border rounded-2xl flex flex-col items-center justify-center text-center shadow-xs cursor-pointer active:scale-95 transition-all touch-manipulation min-h-[90px] ${
                      activeCableType === 'auto'
                        ? 'border-amber-500 ring-2 ring-amber-400 bg-amber-50'
                        : 'border-slate-300 hover:border-amber-400'
                    }`}
                  >
                    <LightningCablePT size={40} />
                    <span className="font-bold text-xs text-slate-900 mt-1.5">Automatically Choose</span>
                    <span className="text-[10px] text-slate-500">Auto Cable Selection</span>
                  </div>

                  <div
                    onClick={() => handleCableTap('straight')}
                    className={`p-3 bg-white border rounded-2xl flex flex-col items-center justify-center text-center shadow-xs cursor-pointer active:scale-95 transition-all touch-manipulation min-h-[90px] ${
                      activeCableType === 'straight'
                        ? 'border-blue-500 ring-2 ring-blue-400 bg-blue-50'
                        : 'border-slate-300 hover:border-blue-400'
                    }`}
                  >
                    <div className="w-10 h-1 bg-slate-800 rounded-full my-4" />
                    <span className="font-bold text-xs text-slate-900">Copper Straight-Through</span>
                    <span className="text-[10px] text-slate-500">PC to Switch / Router</span>
                  </div>

                  <div
                    onClick={() => handleCableTap('crossover')}
                    className={`p-3 bg-white border rounded-2xl flex flex-col items-center justify-center text-center shadow-xs cursor-pointer active:scale-95 transition-all touch-manipulation min-h-[90px] ${
                      activeCableType === 'crossover'
                        ? 'border-rose-500 ring-2 ring-rose-400 bg-rose-50'
                        : 'border-slate-300 hover:border-rose-400'
                    }`}
                  >
                    <div className="w-10 h-1 border-t-2 border-dashed border-rose-600 my-4" />
                    <span className="font-bold text-xs text-slate-900">Copper Cross-Over</span>
                    <span className="text-[10px] text-slate-500">PC to PC / Switch to Switch</span>
                  </div>

                  <div
                    onClick={() => handleCableTap('fiber')}
                    className={`p-3 bg-white border rounded-2xl flex flex-col items-center justify-center text-center shadow-xs cursor-pointer active:scale-95 transition-all touch-manipulation min-h-[90px] ${
                      activeCableType === 'fiber'
                        ? 'border-orange-500 ring-2 ring-orange-400 bg-orange-50'
                        : 'border-slate-300 hover:border-orange-400'
                    }`}
                  >
                    <div className="w-10 h-1 bg-amber-400 rounded-full my-4" />
                    <span className="font-bold text-xs text-slate-900">Fiber Optic</span>
                    <span className="text-[10px] text-slate-500">High-Speed Optical</span>
                  </div>

                  <div
                    onClick={() => handleCableTap('console')}
                    className={`p-3 bg-white border rounded-2xl flex flex-col items-center justify-center text-center shadow-xs cursor-pointer active:scale-95 transition-all touch-manipulation min-h-[90px] ${
                      activeCableType === 'console'
                        ? 'border-cyan-500 ring-2 ring-cyan-400 bg-cyan-50'
                        : 'border-slate-300 hover:border-cyan-400'
                    }`}
                  >
                    <div className="w-10 h-1 bg-cyan-500 rounded-full my-4" />
                    <span className="font-bold text-xs text-slate-900">Console Cable</span>
                    <span className="text-[10px] text-slate-500">RS-232 Rollover</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
};
