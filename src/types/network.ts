export type DeviceType = 'router' | 'switch' | 'hub' | 'pc' | 'laptop' | 'server';

export type CableType = 'auto' | 'straight' | 'crossover' | 'fiber' | 'console';

export type ActiveTool = 'select' | 'delete' | 'note' | 'pdu';

export type WorkspaceMode = 'realtime' | 'simulation';

export type PortStatus = 'up' | 'down' | 'admin_down';

export interface CanvasNote {
  id: string;
  text: string;
  x: number;
  y: number;
}

export interface UserPdu {
  id: string;
  sourceId: string;
  destId: string;
  sourceName: string;
  destName: string;
  sourceIp: string;
  destIp: string;
  sourceMac: string;
  destMac: string;
  type: 'ICMP' | 'ARP';
  fireStatus: 'In Progress' | 'Successful' | 'Failed';
  color: string;
  time: string;
}

export interface OsiLayerDetail {
  layer: number; // 1 to 7
  name: string; // e.g. "Physical", "Data Link", "Network", etc.
  title: string;
  summary: string;
  headers?: { key: string; value: string }[];
}

export interface PduHeaderInfo {
  deviceAt: string;
  deviceType: DeviceType;
  protocol: 'ICMP' | 'ARP';
  packetName: string;
  inLayers: OsiLayerDetail[];
  outLayers?: OsiLayerDetail[];
  rawHeaders: {
    ethernet: {
      preamble: string;
      destMac: string;
      srcMac: string;
      type: string;
    };
    ip?: {
      version: number;
      ihl: number;
      tos: string;
      totalLength: number;
      id: string;
      flags: string;
      ttl: number;
      protocol: string;
      checksum: string;
      srcIp: string;
      destIp: string;
    };
    icmp?: {
      type: string;
      code: string;
      checksum: string;
      id: string;
      seq: string;
      payload: string;
    };
    arp?: {
      hardwareType: string;
      protocolType: string;
      opcode: string;
      srcMac: string;
      srcIp: string;
      targetMac: string;
      targetIp: string;
    };
  };
  explanation: string[];
}

export interface SimulationEvent {
  id: string;
  step: number;
  time?: string;
  lastDevice: string;
  atDevice: string;
  type: 'ICMP' | 'ARP' | 'OSPF' | string;
  info: string;
  status: 'success' | 'failed' | 'in_progress';
  pduInfo?: PduHeaderInfo;
}

export interface DevicePort {
  id: string;
  name: string;
  type: 'ethernet' | 'gigabit' | 'console';
  status: PortStatus;
  ip?: string;
  subnetMask?: string;
  mac: string;
  vlanMode?: 'ACCESS' | 'TRUNK';
  vlanId?: number;
  connectedTo?: {
    nodeId: string;
    portId: string;
    edgeId?: string;
  } | null;
}

export interface RouteEntry {
  id: string;
  network: string;
  netmask: string;
  nextHop?: string;
  interface?: string;
  type: 'C' | 'S' | 'L'; // Connected, Static, Local
  metric?: string;
}

export interface MacTableEntry {
  vlan: number;
  mac: string;
  type: 'DYNAMIC' | 'STATIC';
  portId: string;
}

export interface NetworkDeviceData extends Record<string, unknown> {
  id: string;
  name: string;
  type: DeviceType;
  model?: string;
  ip: string;
  subnetMask: string;
  gateway: string;
  mac: string;
  ports: DevicePort[];
  arpTable?: Record<string, string>; // IP -> MAC
  macTable?: MacTableEntry[]; // Switch MAC table
  routingTable?: RouteEntry[]; // Router routing table
  powerOn?: boolean; // Physical chassis power switch state
  installedModules?: Record<string, string>; // slotId -> moduleId (e.g. HWIC-2T, GLC-T)
  status: 'idle' | 'transmitting' | 'receiving' | 'error' | 'success';
  isSelected?: boolean;
  isConnectingSource?: boolean;
  [key: string]: unknown;
}

export interface CableEdgeData extends Record<string, unknown> {
  sourcePortId?: string;
  targetPortId?: string;
  sourcePortName?: string;
  targetPortName?: string;
  cableType?: CableType;
  isPinging?: boolean;
  pingDirection?: 'forward' | 'backward';
  pingProgress?: number;
  pingStatus?: 'transmitting' | 'success' | 'dropped';
  packetType?: 'ICMP' | 'ARP' | 'OSPF' | string;
  isBroadcast?: boolean;
  pduInfo?: PduHeaderInfo;
  isLinkUp?: boolean;
  sourceStatus?: PortStatus;
  targetStatus?: PortStatus;
  onPacketClick?: (info?: PduHeaderInfo) => void;
  dropReason?: string;
  simulationSpeed?: number;
  [key: string]: unknown;
}

export interface PingStep {
  fromNodeId: string;
  toNodeId: string;
  edgeId: string;
  direction: 'forward' | 'backward';
}

export interface PingSimulationResult {
  success: boolean;
  sourceId: string;
  destId: string;
  sourceIp: string;
  destIp: string;
  isSameSubnet: boolean;
  isConnectedViaSwitch: boolean;
  path: string[];
  edgesInPath: string[];
  message: string;
  details: string[];
  latencyMs: number;
  arpNeeded?: boolean;
}
