import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import {
  RouterIconPT,
  SwitchIconPT,
  HubIconPT,
  PcIconPT,
  LaptopIconPT,
  ServerIconPT,
  PduEnvelopePT,
} from './PacketTracerIcons';
import { NetworkDeviceData, DeviceType, ActiveTool, CableType } from '../types/network';

interface NetworkNodeProps {
  id: string;
  data: NetworkDeviceData & {
    onOpenConfig?: (id: string) => void;
    onPortClick?: (nodeId: string, portId: string) => void;
    onDeviceCableClick?: (nodeId: string) => void;
    connectingSource?: { nodeId: string; portId: string } | null;
    activeCableType?: CableType | null;
    activeTool?: ActiveTool;
    isPingSource?: boolean;
    isPingDest?: boolean;
    pingRoleState?: 'idle' | 'source' | 'destination' | 'forwarding' | 'dropped';
    onDeleteNode?: (id: string) => void;
    onPduSelect?: (id: string) => void;
  };
  selected?: boolean;
}

export const NetworkNode = memo(({ id, data, selected }: NetworkNodeProps) => {
  const isDeleteTool = data.activeTool === 'delete';
  const isPduTool = data.activeTool === 'pdu';
  const isConnecting = data.connectingSource?.nodeId === id;
  const isCableMode = !!data.activeCableType || !!data.connectingSource;

  const isPingActive = data.isPingSource || data.isPingDest;
  const isDropped = data.pingRoleState === 'dropped';
  const isForwarding = data.pingRoleState === 'forwarding';

  // Compute realistic Cisco device LED status
  const getDeviceLedStatus = () => {
    if (isDropped) return 'dropped';
    if (isPingActive || isForwarding) return 'active';

    const ports = data.ports || [];
    const connectedPorts = ports.filter((p) => !!p.connectedTo);

    if (data.type === 'router') {
      // If no connections, gray
      if (connectedPorts.length === 0) return 'idle';
      // If any connected port is admin_down (shutdown), red LED!
      const hasShutdownConnectedPort = connectedPorts.some((p) => p.status === 'admin_down');
      if (hasShutdownConnectedPort) return 'admin_down';
      // If any connected port is up, green LED!
      const hasUpPort = connectedPorts.some((p) => p.status === 'up');
      if (hasUpPort) return 'up';
      return 'down';
    }

    // Switch, PC, Server
    if (connectedPorts.length > 0) {
      const hasUp = connectedPorts.some((p) => p.status === 'up');
      return hasUp ? 'up' : 'down';
    }

    return 'idle';
  };

  const ledStatus = getDeviceLedStatus();

  const renderIcon = () => {
    switch (data.type) {
      case 'router':
        return <RouterIconPT size={56} />;
      case 'switch':
        return <SwitchIconPT size={56} />;
      case 'hub':
        return <HubIconPT size={56} />;
      case 'laptop':
        return <LaptopIconPT size={54} />;
      case 'server':
        return <ServerIconPT size={54} />;
      case 'pc':
      default:
        return <PcIconPT size={54} />;
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    // 1. Delete tool active: delete this device
    if (isDeleteTool) {
      data.onDeleteNode?.(id);
      return;
    }

    // 2. PDU tool active: select as source or destination
    if (isPduTool) {
      data.onPduSelect?.(id);
      return;
    }

    // 3. Cable tool active: trigger Port Selection Modal for Device A or Device B!
    if (isCableMode && data.onDeviceCableClick) {
      data.onDeviceCableClick(id);
      return;
    }

    // 4. Default: Open Packet Tracer Device Configuration Window
    data.onOpenConfig?.(id);
  };

  return (
    <div
      onClick={handleClick}
      className={`relative group flex flex-col items-center select-none cursor-pointer p-3 min-w-[72px] min-h-[72px] touch-manipulation transition-all rounded-2xl active:scale-95 ${
        isDeleteTool
          ? 'hover:ring-2 hover:ring-rose-500 hover:bg-rose-50/50 cursor-crosshair'
          : isPduTool
          ? 'hover:ring-2 hover:ring-amber-500 hover:bg-amber-50/50 cursor-pointer'
          : isCableMode
          ? isConnecting
            ? 'ring-2 ring-emerald-500 bg-emerald-50/60 shadow-md animate-pulse'
            : 'hover:ring-2 hover:ring-blue-400 hover:bg-blue-50/40 cursor-pointer'
          : selected
          ? 'ring-2 ring-blue-500 bg-blue-50/60 rounded-2xl shadow-sm'
          : 'hover:bg-slate-200/50'
      }`}
    >
      {/* PDU Indicator Badge (If selected by Add Simple PDU tool) */}
      {isDropped && (
        <div
          className="absolute -top-8 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 bg-rose-600 border border-white px-2 py-0.5 rounded-full shadow-lg text-[10px] font-bold text-white animate-bounce"
          title="Packet dropped at this device: check interface status or routing table"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
          <span>DROP ✕</span>
        </div>
      )}
      {data.isPingSource && !isDropped && (
        <div className="absolute -top-7 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 bg-yellow-400 border border-yellow-600 px-2 py-0.5 rounded shadow-md text-[10px] font-bold text-yellow-950 animate-bounce">
          <PduEnvelopePT size={14} />
          <span>SRC PDU</span>
        </div>
      )}
      {data.isPingDest && (
        <div className="absolute -top-7 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 bg-sky-400 border border-sky-600 px-2 py-0.5 rounded shadow-md text-[10px] font-bold text-sky-950 animate-bounce">
          <PduEnvelopePT size={14} />
          <span>DST PDU</span>
        </div>
      )}

      {/* Delete Tool Red X Overlay */}
      {isDeleteTool && (
        <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-rose-600 text-white flex items-center justify-center font-bold text-xs shadow-md z-20">
          ✕
        </div>
      )}

      {/* Cable Connecting Tool Indicator */}
      {isCableMode && isConnecting && (
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 z-20 bg-emerald-600 text-white px-2 py-0.5 rounded-full text-[9px] font-mono font-bold shadow-md">
          PORT: {data.connectingSource?.portId}
        </div>
      )}

      {/* Device Equipment Graphic (Min touch area 48x48px guaranteed) */}
      <div className="relative flex items-center justify-center min-w-[52px] min-h-[52px] drop-shadow-md">
        {renderIcon()}

        {/* Cisco Link Activity LED */}
        <div
          className={`absolute bottom-0 right-1 w-2.5 h-2.5 rounded-full border border-white transition-colors ${
            ledStatus === 'dropped'
              ? 'bg-rose-500 shadow-[0_0_6px_#f43f5e]'
              : ledStatus === 'admin_down'
              ? 'bg-rose-500 shadow-[0_0_6px_#ef4444]'
              : ledStatus === 'active'
              ? 'bg-emerald-400 shadow-[0_0_8px_#10b981] animate-ping'
              : ledStatus === 'up'
              ? 'bg-emerald-500 shadow-[0_0_4px_#10b981]'
              : ledStatus === 'down'
              ? 'bg-amber-500 shadow-[0_0_4px_#f59e0b]'
              : 'bg-slate-400'
          }`}
          title={
            ledStatus === 'admin_down'
              ? 'Interface Shutdown (Red)'
              : ledStatus === 'up'
              ? 'Link Up (Green)'
              : ledStatus === 'down'
              ? 'Link Down (Amber)'
              : 'Idle'
          }
        />
      </div>

      {/* Device Name Label */}
      <div className="mt-1 text-center">
        <div className="text-[12px] font-semibold text-slate-800 tracking-tight leading-tight">
          {data.name || id}
        </div>
        {data.model && (
          <div className="text-[9px] font-mono text-slate-500 leading-tight">
            ({data.model})
          </div>
        )}
        {/* IP Address subtitle */}
        {data.ip ? (
          <div className="text-[10px] font-mono font-medium text-slate-600 leading-tight">
            {data.ip}
          </div>
        ) : (
          <div className="text-[9px] font-mono text-slate-400 italic leading-tight">
            {data.type === 'switch' || data.type === 'hub' ? 'Layer 2' : 'unassigned'}
          </div>
        )}
      </div>

      {/* Port Handles around the device - Touch visible */}
      {/* Top Handle */}
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        className="!w-4 !h-4 !bg-slate-400 hover:!bg-emerald-500 !border-2 !border-white sm:!opacity-0 sm:group-hover:!opacity-100 !opacity-60 transition-opacity"
      />
      {/* Bottom Handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className="!w-4 !h-4 !bg-slate-400 hover:!bg-emerald-500 !border-2 !border-white sm:!opacity-0 sm:group-hover:!opacity-100 !opacity-60 transition-opacity"
      />
      {/* Left Handle */}
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        className="!w-4 !h-4 !bg-slate-400 hover:!bg-emerald-500 !border-2 !border-white sm:!opacity-0 sm:group-hover:!opacity-100 !opacity-60 transition-opacity"
      />
      {/* Right Handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className="!w-4 !h-4 !bg-slate-400 hover:!bg-emerald-500 !border-2 !border-white sm:!opacity-0 sm:group-hover:!opacity-100 !opacity-60 transition-opacity"
      />
    </div>
  );
});

NetworkNode.displayName = 'NetworkNode';
