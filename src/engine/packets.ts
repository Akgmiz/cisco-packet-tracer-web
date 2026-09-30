/**
 * Network Packet & Frame Data Structures
 * Cisco Packet Tracer Engine - Protocol Layer Specifications
 */

// --- Layer 2: Data Link Layer ---

export type EtherType = '0x0800' | '0x0806' | '0x8100';

export interface EthernetFrame {
  id: string;
  srcMac: string;
  dstMac: string;
  ethertype: EtherType;
  vlanTag?: number;
  payload: ARPPacket | IPv4Packet | any;
  timestamp: number;
}

// --- Layer 2 / 2.5: Address Resolution Protocol ---

export type ArpOpCode = 'REQUEST' | 'REPLY';

export interface ARPPacket {
  type: 'ARP';
  opCode: ArpOpCode;
  senderMac: string;
  senderIp: string;
  targetMac: string;
  targetIp: string;
}

// --- Layer 3: Internet Protocol version 4 ---

export type IpProtocol = 'ICMP' | 'TCP' | 'UDP';

export interface IPv4Packet {
  type: 'IPv4';
  srcIp: string;
  dstIp: string;
  protocol: IpProtocol;
  ttl: number;
  identification?: number;
  tos?: number;
  flags?: {
    df: boolean; // Don't Fragment
    mf: boolean; // More Fragments
  };
  payload: ICMPPacket | any;
}

// --- Layer 3 / 4: Internet Control Message Protocol ---

export type IcmpType = 
  | 'ECHO_REQUEST' 
  | 'ECHO_REPLY' 
  | 'DESTINATION_UNREACHABLE' 
  | 'TIME_EXCEEDED';

export interface ICMPPacket {
  type: IcmpType;
  code?: number;
  seq: number;
  data: string;
  checksum?: string;
  originalPacket?: IPv4Packet; // Attached on error replies (e.g. TTL expired)
}

// --- Special Protocol Constants ---

export const BROADCAST_MAC = 'FF:FF:FF:FF:FF:FF';
export const ZERO_MAC = '00:00:00:00:00:00';
export const DEFAULT_TTL = 64;
export const DEFAULT_VLAN = 1;

// --- Helper Constructors ---

let packetSequenceCounter = 0;

export function createEthernetFrame(params: {
  srcMac: string;
  dstMac: string;
  ethertype: EtherType;
  payload: ARPPacket | IPv4Packet | any;
  vlanTag?: number;
}): EthernetFrame {
  return {
    id: `frame-${++packetSequenceCounter}-${Date.now().toString(36)}`,
    srcMac: params.srcMac.toUpperCase(),
    dstMac: params.dstMac.toUpperCase(),
    ethertype: params.ethertype,
    vlanTag: params.vlanTag,
    payload: params.payload,
    timestamp: Date.now(),
  };
}

export function createArpPacket(params: {
  opCode: ArpOpCode;
  senderMac: string;
  senderIp: string;
  targetMac?: string;
  targetIp: string;
}): ARPPacket {
  return {
    type: 'ARP',
    opCode: params.opCode,
    senderMac: params.senderMac.toUpperCase(),
    senderIp: params.senderIp,
    targetMac: (params.targetMac || (params.opCode === 'REQUEST' ? ZERO_MAC : BROADCAST_MAC)).toUpperCase(),
    targetIp: params.targetIp,
  };
}

export function createIPv4Packet(params: {
  srcIp: string;
  dstIp: string;
  protocol: IpProtocol;
  ttl?: number;
  payload: ICMPPacket | any;
}): IPv4Packet {
  return {
    type: 'IPv4',
    srcIp: params.srcIp,
    dstIp: params.dstIp,
    protocol: params.protocol,
    ttl: params.ttl ?? DEFAULT_TTL,
    identification: Math.floor(Math.random() * 65535),
    flags: { df: false, mf: false },
    payload: params.payload,
  };
}

export function createIcmpEcho(params: {
  type: 'ECHO_REQUEST' | 'ECHO_REPLY';
  seq: number;
  data?: string;
}): ICMPPacket {
  return {
    type: params.type,
    code: 0,
    seq: params.seq,
    data: params.data ?? 'abcdefghijklmnopqrstuvwabcdefghi',
    checksum: '0x' + Math.floor(Math.random() * 65535).toString(16).padStart(4, '0'),
  };
}

export function createIcmpTimeExceeded(originalPacket: IPv4Packet): ICMPPacket {
  return {
    type: 'TIME_EXCEEDED',
    code: 0, // TTL expired in transit
    seq: 0,
    data: 'Time to live exceeded in transit',
    originalPacket,
  };
}

export function createIcmpDestUnreachable(originalPacket: IPv4Packet, code = 1): ICMPPacket {
  return {
    type: 'DESTINATION_UNREACHABLE',
    code, // 1: Host unreachable, 0: Net unreachable
    seq: 0,
    data: code === 1 ? 'Host Unreachable' : 'Network Unreachable',
    originalPacket,
  };
}
