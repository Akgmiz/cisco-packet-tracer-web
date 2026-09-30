/**
 * PC / Server Host Device
 * Implements Host Layer 3 IP stack, ARP cache resolution,
 * ICMP Echo Request / Reply engine, and default gateway routing.
 */

import { BaseDevice } from './BaseDevice';
import { VirtualInterface } from './VirtualInterface';
import {
  EthernetFrame,
  ARPPacket,
  IPv4Packet,
  ICMPPacket,
  BROADCAST_MAC,
  createEthernetFrame,
  createArpPacket,
  createIPv4Packet,
  createIcmpEcho,
} from './packets';

export interface PingReplyEvent {
  targetIp: string;
  seq: number;
  rttMs: number;
  ttl: number;
  success: boolean;
  message?: string;
}

export class HostDevice extends BaseDevice {
  public defaultGateway?: string;
  public arpTable: Map<string, string> = new Map();

  private pendingEchoRequests: Map<number, { startTime: number; targetIp: string }> = new Map();
  private pingListeners: ((event: PingReplyEvent) => void)[] = [];
  private sequenceCounter = 0;

  constructor(id: string, name: string, category: 'pc' | 'server' = 'pc') {
    super(id, name, category);
  }

  public get primaryInterface(): VirtualInterface | undefined {
    return this.interfaces.get('FastEthernet0') || Array.from(this.interfaces.values())[0];
  }

  public setNetworkConfig(ip: string, subnetMask: string, gateway?: string): void {
    const intf = this.primaryInterface;
    if (intf) {
      intf.setIpAddress(ip, subnetMask);
    }
    this.defaultGateway = gateway;
  }

  public onPingReply(callback: (event: PingReplyEvent) => void): () => void {
    this.pingListeners.push(callback);
    return () => {
      this.pingListeners = this.pingListeners.filter((l) => l !== callback);
    };
  }

  /**
   * Main Host Ingress Frame Processor
   */
  public receiveFrame(ingressInterface: VirtualInterface, frame: EthernetFrame): void {
    const dstMac = frame.dstMac.toUpperCase();
    const myMac = ingressInterface.macAddress.toUpperCase();

    // Check if addressed to this NIC or Broadcast
    if (dstMac !== myMac && dstMac !== BROADCAST_MAC) {
      return;
    }

    if (frame.ethertype === '0x0806') {
      this.handleArp(ingressInterface, frame.payload as ARPPacket);
    } else if (frame.ethertype === '0x0800') {
      this.handleIPv4(ingressInterface, frame.payload as IPv4Packet);
    }
  }

  private handleArp(ingressInterface: VirtualInterface, arp: ARPPacket): void {
    // Cache sender ARP mapping
    if (arp.senderIp && arp.senderMac) {
      this.arpTable.set(arp.senderIp, arp.senderMac.toUpperCase());
    }

    if (arp.opCode === 'REQUEST') {
      // Check if request is asking for my IP
      if (arp.targetIp === ingressInterface.ipAddress) {
        this.log(`[ARP REPLY] Answering ARP Request from ${arp.senderIp}`);

        const arpReply = createArpPacket({
          opCode: 'REPLY',
          senderMac: ingressInterface.macAddress,
          senderIp: ingressInterface.ipAddress,
          targetMac: arp.senderMac,
          targetIp: arp.senderIp,
        });

        const frame = createEthernetFrame({
          srcMac: ingressInterface.macAddress,
          dstMac: arp.senderMac,
          ethertype: '0x0806',
          payload: arpReply,
        });

        ingressInterface.transmit(frame);
      }
    }
  }

  private handleIPv4(ingressInterface: VirtualInterface, packet: IPv4Packet): void {
    // Check if addressed to my IP
    if (packet.dstIp !== ingressInterface.ipAddress) {
      return;
    }

    if (packet.protocol === 'ICMP') {
      const icmp = packet.payload as ICMPPacket;
      if (!icmp) return;

      if (icmp.type === 'ECHO_REQUEST') {
        this.log(`[ICMP ECHO] Replying to Ping from ${packet.srcIp}`);

        const echoReply = createIcmpEcho({
          type: 'ECHO_REPLY',
          seq: icmp.seq,
          data: icmp.data,
        });

        const replyPacket = createIPv4Packet({
          srcIp: ingressInterface.ipAddress,
          dstIp: packet.srcIp,
          protocol: 'ICMP',
          payload: echoReply,
        });

        this.sendIpPacket(ingressInterface, replyPacket);
      } else if (icmp.type === 'ECHO_REPLY') {
        const pending = this.pendingEchoRequests.get(icmp.seq);
        const rtt = pending ? Date.now() - pending.startTime : 1;
        this.pendingEchoRequests.delete(icmp.seq);

        this.log(`[ICMP REPLY] Received Echo Reply from ${packet.srcIp}, seq=${icmp.seq} time=${rtt}ms`);

        for (const listener of this.pingListeners) {
          listener({
            targetIp: packet.srcIp,
            seq: icmp.seq,
            rttMs: rtt,
            ttl: packet.ttl,
            success: true,
          });
        }
      } else if (icmp.type === 'TIME_EXCEEDED' || icmp.type === 'DESTINATION_UNREACHABLE') {
        for (const listener of this.pingListeners) {
          listener({
            targetIp: packet.srcIp,
            seq: icmp.seq || 0,
            rttMs: 0,
            ttl: packet.ttl,
            success: false,
            message: icmp.data,
          });
        }
      }
    }
  }

  /**
   * Initiate a Ping to target IP
   */
  public ping(targetIp: string): void {
    const intf = this.primaryInterface;
    if (!intf || !intf.ipAddress) {
      this.log(`[PING FAIL] No active interface configured with an IP address.`);
      return;
    }

    const seq = ++this.sequenceCounter;
    this.pendingEchoRequests.set(seq, { startTime: Date.now(), targetIp });

    const icmpReq = createIcmpEcho({
      type: 'ECHO_REQUEST',
      seq,
    });

    const ipPacket = createIPv4Packet({
      srcIp: intf.ipAddress,
      dstIp: targetIp,
      protocol: 'ICMP',
      payload: icmpReq,
    });

    this.sendIpPacket(intf, ipPacket);
  }

  /**
   * Determine next hop (direct vs gateway) and encapsulate frame
   */
  private sendIpPacket(intf: VirtualInterface, packet: IPv4Packet): void {
    const isSameSubnet = this.isIpInSameSubnet(
      intf.ipAddress || '',
      intf.subnetMask || '255.255.255.0',
      packet.dstIp
    );

    const nextHopIp = isSameSubnet ? packet.dstIp : this.defaultGateway;
    if (!nextHopIp) {
      this.log(`[ROUTE DROP] Cannot reach ${packet.dstIp}: Destination is in another subnet and no Default Gateway configured.`);
      return;
    }

    const cachedMac = this.arpTable.get(nextHopIp);
    if (cachedMac) {
      const frame = createEthernetFrame({
        srcMac: intf.macAddress,
        dstMac: cachedMac,
        ethertype: '0x0800',
        payload: packet,
      });
      intf.transmit(frame);
    } else {
      this.log(`[ARP REQUEST] Next hop ${nextHopIp} MAC unknown. Sending ARP Request.`);

      const arpReq = createArpPacket({
        opCode: 'REQUEST',
        senderMac: intf.macAddress,
        senderIp: intf.ipAddress || '0.0.0.0',
        targetIp: nextHopIp,
      });

      const frame = createEthernetFrame({
        srcMac: intf.macAddress,
        dstMac: BROADCAST_MAC,
        ethertype: '0x0806',
        payload: arpReq,
      });

      intf.transmit(frame);
    }
  }

  private isIpInSameSubnet(ip1: string, mask: string, ip2: string): boolean {
    const toNum = (ip: string) => ip.split('.').reduce((acc, o) => ((acc << 8) + parseInt(o, 10)) >>> 0, 0);
    const m = toNum(mask);
    return (toNum(ip1) & m) === (toNum(ip2) & m);
  }
}
