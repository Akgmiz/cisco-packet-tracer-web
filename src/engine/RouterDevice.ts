/**
 * Cisco Layer 3 Router Device
 * Implements Longest Prefix Match (LPM) IP Routing, ARP Resolution Cache,
 * TTL Decrement, ICMP Exception Handling, and Dynamic Route Management.
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
  createIcmpTimeExceeded,
  createIcmpDestUnreachable,
} from './packets';

export interface RouteEntry {
  network: string;
  mask: string;
  nextHop?: string;
  interfaceName: string;
  metric: number;
  proto: 'C' | 'S' | 'O'; // Connected, Static, OSPF
}

export class RouterDevice extends BaseDevice {
  // ARP Table: IP Address -> MAC Address
  public arpTable: Map<string, string> = new Map();

  // Routing Table Array
  public routingTable: RouteEntry[] = [];

  // Queued packets awaiting ARP resolution
  private pendingArpPackets: Map<string, { frame: EthernetFrame; egressIntf: VirtualInterface }[]> = new Map();

  constructor(id: string, name: string) {
    super(id, name, 'router');
  }

  /**
   * Main Router Ingress Pipeline
   */
  public receiveFrame(ingressInterface: VirtualInterface, frame: EthernetFrame): void {
    const dstMac = frame.dstMac.toUpperCase();
    const myMac = ingressInterface.macAddress.toUpperCase();

    // Layer 2 filtering: Packet must be addressed to this interface or broadcast
    if (dstMac !== myMac && dstMac !== BROADCAST_MAC) {
      this.log(`[DROP L2] Frame dst MAC ${dstMac} does not match interface MAC ${myMac}. Dropped.`);
      return;
    }

    // EtherType Dissector
    if (frame.ethertype === '0x0806') {
      // ARP Protocol
      this.handleArpPacket(ingressInterface, frame.payload as ARPPacket);
    } else if (frame.ethertype === '0x0800') {
      // IPv4 Protocol
      this.handleIPv4Packet(ingressInterface, frame.payload as IPv4Packet);
    } else {
      this.log(`[DROP L2] Unsupported EtherType ${frame.ethertype}.`);
    }
  }

  /**
   * Layer 2/3: ARP Protocol Processing
   */
  private handleArpPacket(ingressInterface: VirtualInterface, arp: ARPPacket): void {
    // Learn sender mapping into ARP cache
    if (arp.senderIp && arp.senderMac) {
      this.arpTable.set(arp.senderIp, arp.senderMac.toUpperCase());
      this.log(`[ARP LEARN] Cached ${arp.senderIp} -> ${arp.senderMac}`);

      // Flush any queued packets waiting for this IP
      this.flushPendingArp(arp.senderIp, arp.senderMac.toUpperCase());
    }

    if (arp.opCode === 'REQUEST') {
      // Check if target IP matches this router interface's IP
      if (arp.targetIp === ingressInterface.ipAddress) {
        this.log(`[ARP REPLY] Replying to ARP Request for my IP ${ingressInterface.ipAddress}`);

        const arpReply = createArpPacket({
          opCode: 'REPLY',
          senderMac: ingressInterface.macAddress,
          senderIp: ingressInterface.ipAddress,
          targetMac: arp.senderMac,
          targetIp: arp.senderIp,
        });

        const replyFrame = createEthernetFrame({
          srcMac: ingressInterface.macAddress,
          dstMac: arp.senderMac,
          ethertype: '0x0806',
          payload: arpReply,
        });

        ingressInterface.transmit(replyFrame);
      }
    }
  }

  /**
   * Layer 3: IPv4 Packet Processing and Forwarding
   */
  private handleIPv4Packet(ingressInterface: VirtualInterface, packet: IPv4Packet): void {
    // 1. Check if packet is destined for one of the router's own interfaces (Local Delivery)
    for (const intf of this.interfaces.values()) {
      if (intf.status === 'UP' && intf.ipAddress === packet.dstIp) {
        this.processLocalDelivery(ingressInterface, intf, packet);
        return;
      }
    }

    // 2. TTL Check and Decrement
    if (packet.ttl <= 1) {
      this.log(`[TTL EXPIRED] Dropping packet for ${packet.dstIp}: TTL reached 0.`);
      this.sendIcmpTimeExceeded(ingressInterface, packet);
      return;
    }

    const forwardedPacket: IPv4Packet = {
      ...packet,
      ttl: packet.ttl - 1,
    };

    // 3. Routing Table Lookup: Longest Prefix Match (LPM)
    const bestRoute = this.lookupLongestPrefixMatch(forwardedPacket.dstIp);
    if (!bestRoute) {
      this.log(`[NO ROUTE] No route to host ${forwardedPacket.dstIp}. Sending ICMP Destination Unreachable.`);
      this.sendIcmpDestUnreachable(ingressInterface, packet);
      return;
    }

    const egressInterface = this.interfaces.get(bestRoute.interfaceName);
    if (!egressInterface || egressInterface.status !== 'UP') {
      this.log(`[ROUTE FAIL] Egress interface ${bestRoute.interfaceName} is down or missing.`);
      this.sendIcmpDestUnreachable(ingressInterface, packet);
      return;
    }

    // 4. Resolve Next-Hop Layer 2 Destination MAC
    // For connected routes, nextHop is the destination IP itself; for static/dynamic, use route.nextHop
    const nextHopIp = bestRoute.nextHop || forwardedPacket.dstIp;
    const nextHopMac = this.arpTable.get(nextHopIp);

    if (nextHopMac) {
      // MAC is cached: Immediately frame and transmit
      const outFrame = createEthernetFrame({
        srcMac: egressInterface.macAddress,
        dstMac: nextHopMac,
        ethertype: '0x0800',
        payload: forwardedPacket,
      });

      this.log(
        `[ROUTE FORWARD] Forwarded packet ${forwardedPacket.srcIp} -> ${forwardedPacket.dstIp} via ${egressInterface.name} (Next-hop MAC: ${nextHopMac})`
      );
      egressInterface.transmit(outFrame);
    } else {
      // MAC unknown: Queue packet and send ARP Request out egress interface
      this.log(`[ARP PENDING] Next hop ${nextHopIp} MAC unknown. Queuing packet and broadcasting ARP Request.`);

      const outFrame = createEthernetFrame({
        srcMac: egressInterface.macAddress,
        dstMac: '00:00:00:00:00:00', // Resolved upon ARP reply
        ethertype: '0x0800',
        payload: forwardedPacket,
      });

      this.queuePacketForArp(nextHopIp, outFrame, egressInterface);

      const arpRequest = createArpPacket({
        opCode: 'REQUEST',
        senderMac: egressInterface.macAddress,
        senderIp: egressInterface.ipAddress || '0.0.0.0',
        targetIp: nextHopIp,
      });

      const arpFrame = createEthernetFrame({
        srcMac: egressInterface.macAddress,
        dstMac: BROADCAST_MAC,
        ethertype: '0x0806',
        payload: arpRequest,
      });

      egressInterface.transmit(arpFrame);
    }
  }

  /**
   * Local Delivery: Packet was destined for the router itself
   */
  private processLocalDelivery(
    ingressInterface: VirtualInterface,
    localInterface: VirtualInterface,
    packet: IPv4Packet
  ): void {
    if (packet.protocol === 'ICMP') {
      const icmp = packet.payload as ICMPPacket;
      if (icmp && icmp.type === 'ECHO_REQUEST') {
        this.log(`[ICMP ECHO] Received Echo Request from ${packet.srcIp}. Generating Echo Reply.`);

        const echoReplyIcmp = createIcmpEcho({
          type: 'ECHO_REPLY',
          seq: icmp.seq,
          data: icmp.data,
        });

        const replyPacket = createIPv4Packet({
          srcIp: localInterface.ipAddress || packet.dstIp,
          dstIp: packet.srcIp,
          protocol: 'ICMP',
          payload: echoReplyIcmp,
        });

        // Route reply back to sender
        this.handleIPv4Packet(ingressInterface, replyPacket);
      }
    }
  }

  /**
   * Longest Prefix Match (LPM) IP Routing Table Lookup
   */
  public lookupLongestPrefixMatch(destIp: string): RouteEntry | null {
    let bestMatch: RouteEntry | null = null;
    let maxPrefixLength = -1;

    const destNum = this.ipToNumber(destIp);

    for (const route of this.routingTable) {
      const netNum = this.ipToNumber(route.network);
      const maskNum = this.ipToNumber(route.mask);

      // Check if destination IP matches this network/mask
      if ((destNum & maskNum) === (netNum & maskNum)) {
        const prefixLength = this.maskToPrefixLength(route.mask);
        if (prefixLength > maxPrefixLength) {
          maxPrefixLength = prefixLength;
          bestMatch = route;
        }
      }
    }

    return bestMatch;
  }

  /**
   * Synchronize Connected Routes ('C') from operational interfaces
   */
  public syncConnectedRoutes(): void {
    // Remove existing 'C' routes
    this.routingTable = this.routingTable.filter((r) => r.proto !== 'C');

    // Add 'C' route for every interface that has an IP and is UP
    for (const intf of this.interfaces.values()) {
      if (intf.status === 'UP' && intf.ipAddress && intf.subnetMask) {
        const network = this.calculateNetworkAddress(intf.ipAddress, intf.subnetMask);
        this.routingTable.push({
          network,
          mask: intf.subnetMask,
          interfaceName: intf.name,
          metric: 0,
          proto: 'C',
        });
      }
    }
  }

  /**
   * Add a static route ('S')
   */
  public addStaticRoute(network: string, mask: string, nextHop: string, interfaceName?: string): void {
    let ifName = interfaceName;
    if (!ifName) {
      // Find interface on same subnet as nextHop
      for (const intf of this.interfaces.values()) {
        if (intf.ipAddress && intf.subnetMask) {
          const net1 = this.calculateNetworkAddress(intf.ipAddress, intf.subnetMask);
          const net2 = this.calculateNetworkAddress(nextHop, intf.subnetMask);
          if (net1 === net2) {
            ifName = intf.name;
            break;
          }
        }
      }
    }

    this.routingTable.push({
      network,
      mask,
      nextHop,
      interfaceName: ifName || 'GigabitEthernet0/0',
      metric: 1,
      proto: 'S',
    });

    this.log(`[STATIC ROUTE] Added route to ${network}/${mask} via ${nextHop}`);
  }

  private sendIcmpTimeExceeded(ingressInterface: VirtualInterface, originalPacket: IPv4Packet): void {
    const timeExceededIcmp = createIcmpTimeExceeded(originalPacket);
    const replyIp = ingressInterface.ipAddress || '192.168.1.1';

    const replyPacket = createIPv4Packet({
      srcIp: replyIp,
      dstIp: originalPacket.srcIp,
      protocol: 'ICMP',
      payload: timeExceededIcmp,
    });

    this.handleIPv4Packet(ingressInterface, replyPacket);
  }

  private sendIcmpDestUnreachable(ingressInterface: VirtualInterface, originalPacket: IPv4Packet): void {
    const unreachIcmp = createIcmpDestUnreachable(originalPacket, 1);
    const replyIp = ingressInterface.ipAddress || '192.168.1.1';

    const replyPacket = createIPv4Packet({
      srcIp: replyIp,
      dstIp: originalPacket.srcIp,
      protocol: 'ICMP',
      payload: unreachIcmp,
    });

    this.handleIPv4Packet(ingressInterface, replyPacket);
  }

  private queuePacketForArp(ip: string, frame: EthernetFrame, egressIntf: VirtualInterface): void {
    const list = this.pendingArpPackets.get(ip) || [];
    list.push({ frame, egressIntf });
    this.pendingArpPackets.set(ip, list);
  }

  private flushPendingArp(ip: string, mac: string): void {
    const list = this.pendingArpPackets.get(ip);
    if (!list || list.length === 0) return;

    this.pendingArpPackets.delete(ip);
    this.log(`[ARP FLUSH] Transmitting ${list.length} queued packets for ${ip} (MAC: ${mac})`);

    for (const item of list) {
      const resolvedFrame = createEthernetFrame({
        srcMac: item.egressIntf.macAddress,
        dstMac: mac,
        ethertype: item.frame.ethertype,
        payload: item.frame.payload,
        vlanTag: item.frame.vlanTag,
      });
      item.egressIntf.transmit(resolvedFrame);
    }
  }

  // --- IP Address Math Helpers ---

  private ipToNumber(ip: string): number {
    return ip
      .split('.')
      .reduce((acc, octet) => ((acc << 8) + parseInt(octet, 10)) >>> 0, 0);
  }

  private maskToPrefixLength(mask: string): number {
    const num = this.ipToNumber(mask);
    return num.toString(2).split('1').length - 1;
  }

  private calculateNetworkAddress(ip: string, mask: string): string {
    const ipNum = this.ipToNumber(ip);
    const maskNum = this.ipToNumber(mask);
    const netNum = (ipNum & maskNum) >>> 0;
    return [
      (netNum >>> 24) & 255,
      (netNum >>> 16) & 255,
      (netNum >>> 8) & 255,
      netNum & 255,
    ].join('.');
  }

  /**
   * Formatted Cisco "show ip route"
   */
  public getFormattedRoutingTable(): string {
    this.syncConnectedRoutes();

    const banner = [
      'Codes: L - local, C - connected, S - static, R - RIP, M - mobile, B - BGP',
      '       D - EIGRP, EX - EIGRP external, O - OSPF, IA - OSPF inter area',
      '       Gateway of last resort is not set\n',
    ].join('\n');

    const rows = this.routingTable.map((r) => {
      const cidr = this.maskToPrefixLength(r.mask);
      const proto = r.proto;
      if (proto === 'C') {
        return `C    ${r.network}/${cidr} is directly connected, ${r.interfaceName}`;
      } else {
        return `S    ${r.network}/${cidr} [1/0] via ${r.nextHop}, ${r.interfaceName}`;
      }
    });

    return `${banner}\n${rows.join('\n')}\n`;
  }
}
