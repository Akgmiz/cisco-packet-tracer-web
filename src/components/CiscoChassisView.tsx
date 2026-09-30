/**
 * Cisco Physical Hardware Chassis Component
 * Features:
 *   - Realistic chassis rear/front faceplate with metal rack-mount styling
 *   - Working Power Switch with Green LED indicator
 *   - Strict Cisco Rule: "Cannot add/remove a module when the power is on"
 *   - Modular Expansion Slots (Slot 0, Slot 1)
 *   - Module Drawer: HWIC-2T (2 Serial ports), WIC-1AM (Modem), GLC-T (Gigabit SFP)
 *   - Dynamic port registration / deregistration
 */

import React, { useState } from 'react';
import { NetworkDeviceData, DevicePort } from '../types/network';
import {
  Power,
  Layers,
  AlertTriangle,
  Plus,
  Trash2,
  Cpu,
  Radio,
  Network,
  Check,
  ShieldAlert,
} from 'lucide-react';
import { generateMac } from '../utils/networkUtils';

interface CiscoChassisViewProps {
  device: NetworkDeviceData;
  onUpdateDevice: (updated: NetworkDeviceData) => void;
}

interface HardwareModule {
  id: string;
  name: string;
  type: string;
  description: string;
  portsProvided: { namePrefix: string; type: 'ethernet' | 'gigabit' | 'console'; count: number }[];
}

const AVAILABLE_MODULES: HardwareModule[] = [
  {
    id: 'HWIC-2T',
    name: 'HWIC-2T',
    type: 'High-Speed WAN Interface Card',
    description: '2-Port Serial High-Speed WAN Interface Card for point-to-point serial links and leased lines.',
    portsProvided: [{ namePrefix: 'Serial0/0/', type: 'ethernet', count: 2 }],
  },
  {
    id: 'GLC-T',
    name: 'GLC-T',
    type: 'Gigabit SFP Transceiver',
    description: '1000BASE-T SFP Copper Transceiver module providing 1 Gigabit Ethernet port over Cat5/6 cable.',
    portsProvided: [{ namePrefix: 'GigabitEthernet0/1/', type: 'gigabit', count: 1 }],
  },
  {
    id: 'WIC-1AM',
    name: 'WIC-1AM',
    type: 'Analog Modem Interface Card',
    description: '1-Port Analog Modem WAN Interface Card with V.90 technology for dial backup.',
    portsProvided: [{ namePrefix: 'Async0/0/', type: 'console', count: 1 }],
  },
];

export const CiscoChassisView: React.FC<CiscoChassisViewProps> = ({
  device,
  onUpdateDevice,
}) => {
  const isPowerOn = device.powerOn !== false; // Default ON
  const installedModules = device.installedModules || {};
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [selectedModuleId, setSelectedModuleId] = useState<string>('HWIC-2T');

  const togglePower = () => {
    const nextPower = !isPowerOn;
    const updatedPorts = (device.ports || []).map((p) => ({
      ...p,
      status: nextPower ? ('up' as const) : ('down' as const),
    }));

    onUpdateDevice({
      ...device,
      powerOn: nextPower,
      ports: updatedPorts,
    });
  };

  const handleInsertModule = (slotId: string) => {
    // Cisco Rule: Power must be OFF
    if (isPowerOn) {
      setWarningMessage('Cannot add/remove a module when the power is on.');
      return;
    }

    const mod = AVAILABLE_MODULES.find((m) => m.id === selectedModuleId);
    if (!mod) return;

    // Generate new ports for this module
    const newPorts: DevicePort[] = [];
    mod.portsProvided.forEach((prov) => {
      for (let i = 0; i < prov.count; i++) {
        const portName = `${prov.namePrefix}${i}`;
        newPorts.push({
          id: `port-${portName.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
          name: portName,
          type: prov.type,
          status: 'admin_down',
          mac: generateMac(device.type || 'router'),
        });
      }
    });

    const updatedModules = { ...installedModules, [slotId]: mod.id };
    const updatedPorts = [...(device.ports || []), ...newPorts];

    onUpdateDevice({
      ...device,
      installedModules: updatedModules,
      ports: updatedPorts,
    });
    setWarningMessage(null);
  };

  const handleRemoveModule = (slotId: string) => {
    // Cisco Rule: Power must be OFF
    if (isPowerOn) {
      setWarningMessage('Cannot add/remove a module when the power is on.');
      return;
    }

    const modId = installedModules[slotId];
    const mod = AVAILABLE_MODULES.find((m) => m.id === modId);
    if (!mod) return;

    // Remove ports added by this module
    const prefixes = mod.portsProvided.map((p) => p.namePrefix);
    const updatedPorts = (device.ports || []).filter(
      (p) => !prefixes.some((prefix) => p.name.startsWith(prefix))
    );

    const updatedModules = { ...installedModules };
    delete updatedModules[slotId];

    onUpdateDevice({
      ...device,
      installedModules: updatedModules,
      ports: updatedPorts,
    });
    setWarningMessage(null);
  };

  return (
    <div className="space-y-4 font-sans select-none text-xs">
      {/* Cisco Power On Warning Alert Banner */}
      {warningMessage && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/80 border-2 border-rose-500 rounded-xl text-rose-800 dark:text-rose-200 flex items-center justify-between shadow-md animate-in shake duration-200">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
            <span className="font-bold text-xs">{warningMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setWarningMessage(null)}
            className="w-5 h-5 rounded-full hover:bg-rose-200 dark:hover:bg-rose-900 flex items-center justify-center font-bold text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Hardware Chassis Faceplate Graphic */}
      <div className="bg-[#111827] border-4 border-[#374151] rounded-2xl p-4 shadow-2xl relative overflow-hidden">
        {/* Metal Rack Ears & Screws */}
        <div className="absolute top-2 left-2 w-2.5 h-2.5 rounded-full bg-[#4b5563] border border-[#1f2937]" />
        <div className="absolute bottom-2 left-2 w-2.5 h-2.5 rounded-full bg-[#4b5563] border border-[#1f2937]" />
        <div className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-[#4b5563] border border-[#1f2937]" />
        <div className="absolute bottom-2 right-2 w-2.5 h-2.5 rounded-full bg-[#4b5563] border border-[#1f2937]" />

        {/* Chassis Header (Silkscreen Branding) */}
        <div className="flex items-center justify-between border-b border-[#374151] pb-3 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-[#06b6d4] font-extrabold tracking-wider font-mono text-sm">
              CISCO SYSTEMS
            </span>
            <span className="text-[#9ca3af] font-mono text-[11px]">
              {device.model || (device.type === 'router' ? '1941 INTEGRATED SERVICES ROUTER' : 'CATALYST 2960 SERIES')}
            </span>
          </div>

          {/* Working Physical Power Rocker Switch & Green LED */}
          <div className="flex items-center gap-3 bg-[#1f2937] px-3 py-1.5 rounded-xl border border-[#374151]">
            {/* Green Power LED */}
            <div className="flex items-center gap-1.5">
              <div
                className={`w-3 h-3 rounded-full border border-black transition-all ${
                  isPowerOn
                    ? 'bg-emerald-400 shadow-[0_0_10px_#10b981] animate-pulse'
                    : 'bg-[#4b5563]'
                }`}
              />
              <span className="text-[10px] font-mono font-bold text-slate-300">
                {isPowerOn ? 'PWR ON' : 'OFF'}
              </span>
            </div>

            {/* Toggle Switch */}
            <button
              type="button"
              onClick={togglePower}
              className={`w-12 h-6 rounded-full transition-colors p-0.5 cursor-pointer touch-manipulation flex items-center ${
                isPowerOn ? 'bg-emerald-600 justify-end' : 'bg-slate-700 justify-start'
              }`}
              title="Toggle Power Switch (Turn OFF to change modules)"
            >
              <span className="w-5 h-5 rounded-full bg-white shadow-md block" />
            </button>
          </div>
        </div>

        {/* Main Faceplate Hardware Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {/* Base Onboard Interfaces */}
          <div className="bg-[#1f2937] border border-[#374151] rounded-xl p-3 space-y-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#9ca3af] block font-bold">
              Onboard Interfaces (Fixed)
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(device.ports || []).slice(0, 4).map((p) => (
                <div
                  key={p.id}
                  className="bg-[#111827] border border-[#374151] rounded-lg p-2 text-center space-y-1"
                >
                  <div
                    className={`w-2 h-2 rounded-full mx-auto ${
                      isPowerOn && p.status === 'up'
                        ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]'
                        : isPowerOn && p.status === 'admin_down'
                        ? 'bg-rose-500'
                        : 'bg-[#4b5563]'
                    }`}
                  />
                  <div className="w-6 h-4 bg-[#1f2937] border border-[#4b5563] mx-auto rounded-2xs" />
                  <span className="text-[8px] font-mono text-slate-300 truncate block">
                    {p.name.replace(/GigabitEthernet|FastEthernet/i, (m) => (m[0] === 'G' ? 'Gi' : 'Fa'))}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Modular Bay: Slot 0 */}
          <div className="bg-[#1f2937] border border-[#374151] rounded-xl p-3 flex flex-col justify-between">
            <div className="flex items-center justify-between pb-1.5 border-b border-[#374151]">
              <span className="text-[10px] font-mono uppercase font-bold text-slate-300">
                Slot 0: {installedModules['slot-0'] || 'EMPTY BAY'}
              </span>
              {installedModules['slot-0'] && (
                <button
                  type="button"
                  onClick={() => handleRemoveModule('slot-0')}
                  className="text-rose-400 hover:text-rose-300 text-[10px] flex items-center gap-1 cursor-pointer font-bold"
                  title="Remove Module"
                >
                  <Trash2 className="w-3 h-3" /> Eject
                </button>
              )}
            </div>

            {installedModules['slot-0'] ? (
              <div className="py-3 text-center bg-[#111827] rounded-lg border border-[#374151] my-2">
                <span className="text-emerald-400 font-mono font-bold text-xs block">
                  [{installedModules['slot-0']}]
                </span>
                <span className="text-[9px] text-slate-400">Card Active &amp; Bound</span>
              </div>
            ) : (
              <div
                onClick={() => handleInsertModule('slot-0')}
                className="py-4 my-2 border-2 border-dashed border-[#4b5563] hover:border-sky-400 rounded-lg text-center cursor-pointer transition-colors bg-[#111827]/60 group"
              >
                <Plus className="w-4 h-4 mx-auto text-slate-500 group-hover:text-sky-400" />
                <span className="text-[10px] text-slate-400 group-hover:text-sky-300 block font-mono">
                  Tap to Install {selectedModuleId}
                </span>
              </div>
            )}

            <span className="text-[9px] text-slate-500 font-mono">HWIC / WIC Modular Slot</span>
          </div>

          {/* Modular Bay: Slot 1 */}
          <div className="bg-[#1f2937] border border-[#374151] rounded-xl p-3 flex flex-col justify-between">
            <div className="flex items-center justify-between pb-1.5 border-b border-[#374151]">
              <span className="text-[10px] font-mono uppercase font-bold text-slate-300">
                Slot 1: {installedModules['slot-1'] || 'EMPTY BAY'}
              </span>
              {installedModules['slot-1'] && (
                <button
                  type="button"
                  onClick={() => handleRemoveModule('slot-1')}
                  className="text-rose-400 hover:text-rose-300 text-[10px] flex items-center gap-1 cursor-pointer font-bold"
                  title="Remove Module"
                >
                  <Trash2 className="w-3 h-3" /> Eject
                </button>
              )}
            </div>

            {installedModules['slot-1'] ? (
              <div className="py-3 text-center bg-[#111827] rounded-lg border border-[#374151] my-2">
                <span className="text-emerald-400 font-mono font-bold text-xs block">
                  [{installedModules['slot-1']}]
                </span>
                <span className="text-[9px] text-slate-400">Card Active &amp; Bound</span>
              </div>
            ) : (
              <div
                onClick={() => handleInsertModule('slot-1')}
                className="py-4 my-2 border-2 border-dashed border-[#4b5563] hover:border-sky-400 rounded-lg text-center cursor-pointer transition-colors bg-[#111827]/60 group"
              >
                <Plus className="w-4 h-4 mx-auto text-slate-500 group-hover:text-sky-400" />
                <span className="text-[10px] text-slate-400 group-hover:text-sky-300 block font-mono">
                  Tap to Install {selectedModuleId}
                </span>
              </div>
            )}

            <span className="text-[9px] text-slate-500 font-mono">HWIC / WIC Modular Slot</span>
          </div>
        </div>
      </div>

      {/* Available Modules Selection Tray */}
      <div className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-sky-600" />
            <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">
              Available Modules (HWIC / WIC Cards)
            </span>
          </div>
          <span className="text-[11px] text-slate-500 font-mono">
            Requires Power OFF to Install
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {AVAILABLE_MODULES.map((mod) => {
            const isSelected = selectedModuleId === mod.id;
            return (
              <div
                key={mod.id}
                onClick={() => setSelectedModuleId(mod.id)}
                className={`p-3 rounded-xl border transition-all cursor-pointer space-y-1.5 ${
                  isSelected
                    ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/40 ring-2 ring-sky-400/40'
                    : 'border-slate-200 dark:border-slate-700 hover:border-sky-300 bg-slate-50/50 dark:bg-slate-900/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold font-mono text-xs text-slate-900 dark:text-slate-100">
                    {mod.name}
                  </span>
                  {isSelected && <Check className="w-3.5 h-3.5 text-sky-600 font-bold" />}
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 leading-snug font-sans">
                  {mod.description}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
