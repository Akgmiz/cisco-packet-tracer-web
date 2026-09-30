import React, { useState, useEffect, useMemo } from 'react';
import { NetworkDeviceData, DeviceType, PingSimulationResult } from '../types/network';
import {
  X,
  Trash2,
  Send,
  Check,
  AlertTriangle,
  Info,
  Server,
  Monitor,
  Network,
  Router as RouterIcon,
  Layers,
  Globe,
  Radio,
  Sliders,
  Terminal as TerminalIcon,
} from 'lucide-react';
import {
  isValidIpv4,
  isValidSubnetMask,
  calculateSubnetDetails,
} from '../utils/networkUtils';
import { CiscoTerminal } from './CiscoTerminal';
import { PcDesktop } from './PcDesktop';
import { CiscoChassisView } from './CiscoChassisView';

interface DeviceConfigSheetProps {
  device: NetworkDeviceData | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedDevice: NetworkDeviceData) => void;
  onDelete: (deviceId: string) => void;
  onInitiatePing?: (deviceId: string) => void;
  allDevices?: NetworkDeviceData[];
  nodes?: any[];
  edges?: any[];
  onTriggerPing?: (sourceId: string, destId: string) => Promise<PingSimulationResult>;
}

export const DeviceConfigSheet: React.FC<DeviceConfigSheetProps> = ({
  device,
  isOpen,
  onClose,
  onSave,
  onDelete,
  onInitiatePing,
  allDevices = [],
  nodes = [],
  edges = [],
  onTriggerPing,
}) => {
  const isNetworkDevice = device?.type === 'router' || device?.type === 'switch' || device?.type === 'hub';
  const isEndDevice = device?.type === 'pc' || device?.type === 'laptop' || device?.type === 'server';

  const [activeTab, setActiveTab] = useState<'physical' | 'config' | 'desktop' | 'cli'>('config');
  const [name, setName] = useState('');
  const [ip, setIp] = useState('');
  const [subnetMask, setSubnetMask] = useState('255.255.255.0');
  const [gateway, setGateway] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Sync state when device changes
  useEffect(() => {
    if (device) {
      setName(device.name || '');
      setIp(device.ip || '');
      setSubnetMask(device.subnetMask || '255.255.255.0');
      setGateway(device.gateway || '');
      setShowDeleteConfirm(false);

      // Default to CLI for routers/switches, Desktop for PCs/Laptops
      if (device.type === 'router' || device.type === 'switch' || device.type === 'hub') {
        setActiveTab('cli');
      } else {
        setActiveTab('desktop');
      }
    }
  }, [device]);

  // Live subnet details calculation
  const subnetDetails = useMemo(() => {
    return calculateSubnetDetails(ip, subnetMask);
  }, [ip, subnetMask]);

  const isIpValid = isValidIpv4(ip);
  const isMaskValid = isValidSubnetMask(subnetMask);
  const isGatewayValid = !gateway || isValidIpv4(gateway);

  if (!isOpen || !device) return null;

  const handleSave = () => {
    onSave({
      ...device,
      name: name.trim() || device.id,
      ip: ip.trim(),
      subnetMask: subnetMask.trim(),
      gateway: gateway.trim(),
    });
    onClose();
  };

  const handleTerminalUpdateDevice = (updated: NetworkDeviceData) => {
    setName(updated.name);
    setIp(updated.ip);
    setSubnetMask(updated.subnetMask);
    setGateway(updated.gateway);
    onSave(updated);
  };

  const autoFillGateway = () => {
    if (subnetDetails) {
      setGateway(subnetDetails.firstUsableIp);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 pointer-events-none">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs pointer-events-auto transition-opacity"
        onClick={onClose}
      />

      {/* Cisco Packet Tracer Device Dialog Window (Mobile-first: 85-88vh Bottom Sheet on mobile, centered modal on desktop) */}
      <div className="relative w-full sm:max-w-2xl bg-[#eaedf2] border-t-2 sm:border-2 border-[#94a3b8] rounded-t-3xl sm:rounded-lg shadow-2xl pointer-events-auto h-[88vh] sm:h-auto sm:max-h-[90vh] flex flex-col overflow-hidden text-slate-800 font-sans animate-in slide-in-from-bottom sm:slide-in-from-bottom-4 duration-200">
        {/* Mobile Pull Handle Affordance */}
        <div
          className="w-12 h-1.5 bg-slate-400 rounded-full mx-auto my-2 cursor-pointer touch-manipulation sm:hidden shrink-0"
          onClick={onClose}
        />

        {/* Window Title Bar */}
        <div className="px-3.5 py-2 bg-[#1e293b] text-white flex items-center justify-between text-xs font-semibold select-none shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-xs bg-[#0077b6] border border-cyan-400 inline-block" />
            <span className="font-bold text-sm sm:text-xs">{name || device.id}</span>
            <span className="text-slate-400 font-normal">({device.model || device.type.toUpperCase()})</span>
          </div>

          <div className="flex items-center gap-2">
            {onInitiatePing && isEndDevice && (
              <button
                type="button"
                onClick={() => {
                  onInitiatePing(device.id);
                  onClose();
                }}
                className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer shadow-xs touch-manipulation active:scale-95"
                title="Send Simple PDU from this device"
              >
                <Send className="w-3 h-3" />
                <span>Send PDU</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="w-7 h-7 sm:w-6 sm:h-6 rounded-full sm:rounded-xs bg-[#334155] hover:bg-rose-600 text-slate-200 hover:text-white flex items-center justify-center text-sm sm:text-xs font-bold transition-colors cursor-pointer touch-manipulation"
              aria-label="Close device settings"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Large Touch Tabs (CLI, Desktop, Physical, Config) at the top */}
        <div className="px-3 pt-1 bg-[#d8dde6] border-b border-[#cbd2de] flex items-center gap-1.5 select-none shrink-0 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('physical')}
            className={`min-h-[44px] px-4 py-2 text-xs sm:text-sm font-bold rounded-t-lg sm:rounded-t-xs border-t border-x transition-all cursor-pointer touch-manipulation flex items-center gap-1.5 ${
              activeTab === 'physical'
                ? 'bg-[#eaedf2] border-[#94a3b8] text-blue-700 shadow-xs'
                : 'bg-transparent border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Physical</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('config')}
            className={`min-h-[44px] px-4 py-2 text-xs sm:text-sm font-bold rounded-t-lg sm:rounded-t-xs border-t border-x transition-all cursor-pointer touch-manipulation flex items-center gap-1.5 ${
              activeTab === 'config'
                ? 'bg-[#eaedf2] border-[#94a3b8] text-blue-700 shadow-xs'
                : 'bg-transparent border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Config</span>
          </button>

          {/* End Devices: Desktop Tab */}
          {isEndDevice && (
            <button
              type="button"
              onClick={() => setActiveTab('desktop')}
              className={`min-h-[44px] px-4 py-2 text-xs sm:text-sm font-bold rounded-t-lg sm:rounded-t-xs border-t border-x transition-all cursor-pointer touch-manipulation flex items-center gap-1.5 ${
                activeTab === 'desktop'
                  ? 'bg-[#eaedf2] border-[#94a3b8] text-blue-700 shadow-xs'
                  : 'bg-transparent border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>Desktop</span>
            </button>
          )}

          {/* Routers & Switches: CLI Tab */}
          {isNetworkDevice && (
            <button
              type="button"
              onClick={() => setActiveTab('cli')}
              className={`min-h-[44px] px-4 py-2 text-xs sm:text-sm font-bold rounded-t-lg sm:rounded-t-xs border-t border-x transition-all cursor-pointer touch-manipulation flex items-center gap-1.5 ${
                activeTab === 'cli'
                  ? 'bg-[#eaedf2] border-[#94a3b8] text-emerald-700 shadow-xs'
                  : 'bg-transparent border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <TerminalIcon className="w-3.5 h-3.5 text-emerald-600" />
              <span>CLI</span>
            </button>
          )}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-3 flex flex-col min-h-0">
          {/* TAB 1: Physical Chassis View */}
          {activeTab === 'physical' && (
            <div className="space-y-4">
              <CiscoChassisView
                device={device}
                onUpdateDevice={(updated) => {
                  handleTerminalUpdateDevice(updated);
                }}
              />

              {/* Port Table */}
              <div className="bg-white border border-[#cbd2de] rounded-xl overflow-hidden shadow-xs">
                <div className="px-3 py-2 bg-slate-100 border-b border-[#cbd2de] font-bold text-xs text-slate-700">
                  Interface Port Status
                </div>
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                      <th className="p-2">Interface</th>
                      <th className="p-2">Type</th>
                      <th className="p-2">Link Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                    {device.ports.map((p, idx) => (
                      <tr key={p.id || idx} className="hover:bg-slate-50">
                        <td className="p-2 font-bold text-slate-800">{p.name}</td>
                        <td className="p-2 text-slate-500 uppercase">{p.type}</td>
                        <td className="p-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              p.connectedTo
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {p.connectedTo ? 'UP / CONNECTED' : 'DOWN'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: Config Tab */}
          {activeTab === 'config' && (
            <div className="space-y-4">
              {/* Global Settings */}
              <div className="bg-white border border-[#cbd2de] p-3.5 rounded-xl shadow-xs space-y-3">
                <div className="font-bold text-xs text-slate-900 border-b border-slate-200 pb-1.5 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-blue-600" />
                  <span>Global Settings</span>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                      Display / Host Name
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Router0, PC1"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-xs focus:ring-2 focus:ring-blue-500 outline-hidden bg-slate-50"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                      MAC Address
                    </label>
                    <input
                      type="text"
                      value={device.mac}
                      disabled
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono text-xs bg-slate-100 text-slate-500"
                    />
                  </div>
                </div>
              </div>

              {/* Interface IP Configuration */}
              <div className="bg-white border border-[#cbd2de] p-3.5 rounded-xl shadow-xs space-y-3">
                <div className="font-bold text-xs text-slate-900 border-b border-slate-200 pb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5 text-blue-600" />
                    <span>Interface Configuration (GigabitEthernet0/0)</span>
                  </span>
                  {device.type === 'switch' && (
                    <span className="text-[10px] text-slate-500 font-normal italic">
                      Layer 2 Switching (No IP required)
                    </span>
                  )}
                </div>

                {device.type === 'switch' || device.type === 'hub' ? (
                  <div className="p-3 bg-slate-50 rounded-lg text-xs text-slate-600 border border-slate-200 space-y-1">
                    <div className="font-semibold text-slate-800">Layer 2 Broadcast Domain:</div>
                    <div>This switch forwards Ethernet frames based on destination MAC address learning. No IP is configured for access ports.</div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                        IPv4 Address
                      </label>
                      <input
                        type="text"
                        value={ip}
                        onChange={(e) => setIp(e.target.value)}
                        placeholder="e.g. 192.168.1.10"
                        className={`w-full px-3 py-2 rounded-lg border font-mono text-xs focus:ring-2 focus:ring-blue-500 outline-hidden bg-slate-50 ${
                          ip && !isIpValid ? 'border-rose-400 bg-rose-50/50' : 'border-slate-300'
                        }`}
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                        Subnet Mask
                      </label>
                      <input
                        type="text"
                        value={subnetMask}
                        onChange={(e) => setSubnetMask(e.target.value)}
                        placeholder="e.g. 255.255.255.0"
                        className={`w-full px-3 py-2 rounded-lg border font-mono text-xs focus:ring-2 focus:ring-blue-500 outline-hidden bg-slate-50 ${
                          subnetMask && !isMaskValid ? 'border-rose-400 bg-rose-50/50' : 'border-slate-300'
                        }`}
                      />
                    </div>

                    {isEndDevice && (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[11px] font-semibold text-slate-600 uppercase">
                            Default Gateway
                          </label>
                          {subnetDetails && (
                            <button
                              type="button"
                              onClick={autoFillGateway}
                              className="text-[10px] text-blue-600 hover:underline cursor-pointer"
                            >
                              Fill Gateway ({subnetDetails.firstUsableIp})
                            </button>
                          )}
                        </div>
                        <input
                          type="text"
                          value={gateway}
                          onChange={(e) => setGateway(e.target.value)}
                          placeholder="e.g. 192.168.1.1"
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-xs focus:ring-2 focus:ring-blue-500 outline-hidden bg-slate-50"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Subnet Calculation Info Pill */}
              {subnetDetails && isIpValid && isMaskValid && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl font-mono text-[11px] text-blue-900 grid grid-cols-2 gap-2">
                  <div>Network: <strong>{subnetDetails.networkAddress}/{subnetDetails.cidr}</strong></div>
                  <div>Broadcast: <strong>{subnetDetails.broadcastAddress}</strong></div>
                  <div>Usable Hosts: <strong>{subnetDetails.usableHosts}</strong></div>
                  <div>Range: <strong>{subnetDetails.firstUsableIp} - {subnetDetails.lastUsableIp}</strong></div>
                </div>
              )}

              {/* Action buttons */}
              <div className="pt-2 flex items-center justify-between">
                {showDeleteConfirm ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-rose-600 font-bold">Confirm delete?</span>
                    <button
                      type="button"
                      onClick={() => {
                        onDelete(device.id);
                        onClose();
                      }}
                      className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer touch-manipulation"
                    >
                      Yes, Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(false)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer touch-manipulation"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="px-3 py-2 rounded-lg text-rose-600 hover:bg-rose-50 text-xs font-semibold flex items-center gap-1.5 cursor-pointer touch-manipulation"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete Device</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleSave}
                  className="px-5 py-2.5 rounded-xl bg-[#0284c7] hover:bg-[#0369a1] text-white text-xs font-bold shadow-md cursor-pointer touch-manipulation active:scale-95"
                >
                  Apply &amp; Save
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: Desktop Tab (For PC / Laptop) */}
          {activeTab === 'desktop' && isEndDevice && (
            <div className="flex-1 flex flex-col min-h-0">
              <PcDesktop
                device={device}
                allDevices={allDevices}
                nodes={nodes}
                edges={edges}
                onUpdateDevice={handleTerminalUpdateDevice}
                onTriggerPing={onTriggerPing}
              />
            </div>
          )}

          {/* TAB 4: CLI Tab (For Router / Switch) */}
          {activeTab === 'cli' && isNetworkDevice && (
            <div className="flex-1 flex flex-col min-h-0">
              <CiscoTerminal
                device={device}
                allDevices={allDevices}
                nodes={nodes}
                edges={edges}
                onUpdateDevice={handleTerminalUpdateDevice}
                onTriggerPing={onTriggerPing}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
