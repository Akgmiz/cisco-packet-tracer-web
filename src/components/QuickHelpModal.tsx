import React from 'react';
import { X, Touchpad, Cable, Sliders, Activity, MousePointer, Info } from 'lucide-react';

interface QuickHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const QuickHelpModal: React.FC<QuickHelpModalProps> = ({ isOpen, onClose }) => {
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
            <h3 className="text-base font-semibold text-slate-100">Network Simulator Guide</h3>
            <p className="text-xs text-slate-400">Controls, wiring instructions & ping mechanics</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs text-slate-300 max-h-[70vh] overflow-y-auto">
          {/* Item 1 */}
          <div className="flex gap-3">
            <div className="p-2 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-400 shrink-0 h-fit">
              <Touchpad className="w-4 h-4" />
            </div>
            <div>
              <div className="font-semibold text-slate-100 text-sm">Touch Controls & Infinite Canvas</div>
              <p className="text-slate-400 mt-0.5 leading-relaxed">
                Use one finger or mouse drag to pan across the infinite blueprint grid. Pinch-to-zoom on mobile or scroll wheel on desktop.
              </p>
            </div>
          </div>

          {/* Item 2 */}
          <div className="flex gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 shrink-0 h-fit">
              <Cable className="w-4 h-4" />
            </div>
            <div>
              <div className="font-semibold text-slate-100 text-sm">Tapping Ports to Connect Cables</div>
              <p className="text-slate-400 mt-0.5 leading-relaxed">
                Tap on any device's port (e.g. <code>eth0</code> or <code>Fa0/1</code>), then tap a port on another device. An animated data cable line will be established automatically. You can also drag directly between connection handles.
              </p>
            </div>
          </div>

          {/* Item 3 */}
          <div className="flex gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 shrink-0 h-fit">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <div className="font-semibold text-slate-100 text-sm">Device Configuration Bottom Sheet</div>
              <p className="text-slate-400 mt-0.5 leading-relaxed">
                Tap anywhere on a device's body to slide open the configuration panel. Customize Device Name, IPv4 Address, Subnet Mask, and Default Gateway with instant CIDR diagnostics.
              </p>
            </div>
          </div>

          {/* Item 4 */}
          <div className="flex gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shrink-0 h-fit">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <div className="font-semibold text-slate-100 text-sm">Subnet-Aware Ping Tracer</div>
              <p className="text-slate-400 mt-0.5 leading-relaxed">
                Tap "Ping Tool" to test ICMP reachability between any two hosts. If hosts share the same subnet and are linked via a Switch, a glowing packet traverses the cable with a Success alert. If subnets differ or no link exists, it displays <strong>Destination Host Unreachable</strong> with detailed diagnostics!
              </p>
            </div>
          </div>
        </div>

        <div className="px-5 py-3 bg-slate-950 border-t border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-semibold transition-colors cursor-pointer"
          >
            Got it, Let's Build
          </button>
        </div>
      </div>
    </div>
  );
};
