/**
 * Cisco Layer 2 Switch Device
 * Implements hardware MAC learning, 802.1Q VLAN filtering, and frame forwarding / flooding.
 */

import { BaseDevice } from './BaseDevice';
import { VirtualInterface } from './VirtualInterface';
import { EthernetFrame, BROADCAST_MAC, createEthernetFrame } from './packets';

export interface MacAddressEntry {
  mac: string;
  port: string;
  vlan: number;
  timestamp: number;
  type: 'DYNAMIC' | 'STATIC';
}

export class SwitchDevice extends BaseDevice {
  // MAC Address Table: MAC -> Entry
  private macTable: Map<string, MacAddressEntry> = new Map();
  private agingTimeMs: number = 300000; // 300 seconds Cisco default

  constructor(id: string, name: string) {
    super(id, name, 'switch');
  }

  /**
   * Main L2 Switch Ingress Processing Pipeline
   */
  public receiveFrame(ingressInterface: VirtualInterface, frame: EthernetFrame): void {
    const srcMac = frame.srcMac.toUpperCase();
    const dstMac = frame.dstMac.toUpperCase();

    // 1. Resolve Frame VLAN
    let frameVlan = 1;
    if (ingressInterface.vlanMode === 'ACCESS') {
      frameVlan = ingressInterface.accessVlan;
    } else if (ingressInterface.vlanMode === 'TRUNK') {
      frameVlan = frame.vlanTag ?? ingressInterface.accessVlan;
      if (!ingressInterface.allowedVlans.includes(frameVlan)) {
        this.log(
          `[DROP] VLAN Mismatch: Ingress frame on trunk ${ingressInterface.name} has VLAN ${frameVlan} which is not allowed.`
        );
        return;
      }
    }

    // 2. Hardware MAC Learning (Source MAC Table Update)
    if (srcMac !== BROADCAST_MAC && srcMac !== '00:00:00:00:00:00') {
      const existing = this.macTable.get(srcMac);
      const isMoved = existing && existing.port !== ingressInterface.name;

      this.macTable.set(srcMac, {
        mac: srcMac,
        port: ingressInterface.name,
        vlan: frameVlan,
        timestamp: Date.now(),
        type: 'DYNAMIC',
      });

      if (!existing || isMoved) {
        this.log(
          `[MAC LEARN] Learned ${srcMac} on ${ingressInterface.name} (VLAN ${frameVlan})${
            isMoved ? ' [Station Moved]' : ''
          }`
        );
      }
    }

    // 3. Forwarding Decision
    const isBroadcast = dstMac === BROADCAST_MAC;
    const isMulticast = dstMac.startsWith('01:00:5E') || dstMac.startsWith('33:33');
    const knownEntry = this.macTable.get(dstMac);

    if (isBroadcast || isMulticast || !knownEntry) {
      // Flooding: Unknown Unicast or Broadcast -> Flood to all ports in same VLAN except ingress
      this.floodFrame(ingressInterface, frame, frameVlan);
    } else {
      // Filtering: Destination MAC is on the same segment as ingress port
      if (knownEntry.port === ingressInterface.name) {
        this.log(`[FILTER] Destination ${dstMac} resides on ingress segment ${ingressInterface.name}. Frame dropped.`);
        return;
      }

      // Check VLAN membership of destination port
      if (knownEntry.vlan !== frameVlan) {
        this.log(
          `[DROP] Destination ${dstMac} is in VLAN ${knownEntry.vlan}, but frame is in VLAN ${frameVlan}. Dropping cross-VLAN frame.`
        );
        return;
      }

      // Forward to specific egress port
      const targetInterface = this.interfaces.get(knownEntry.port);
      if (!targetInterface) {
        this.log(`[DROP] Target interface ${knownEntry.port} does not exist. Flooding instead.`);
        this.floodFrame(ingressInterface, frame, frameVlan);
        return;
      }

      if (targetInterface.status !== 'UP') {
        this.log(`[DROP] Target interface ${targetInterface.name} is down. Frame dropped.`);
        return;
      }

      this.forwardToInterface(targetInterface, frame, frameVlan);
    }
  }

  /**
   * Floods frame out all operational ports in the same VLAN except the ingress port
   */
  private floodFrame(ingressInterface: VirtualInterface, frame: EthernetFrame, vlan: number): void {
    let forwardCount = 0;

    for (const [name, targetInterface] of this.interfaces.entries()) {
      if (name === ingressInterface.name) continue;
      if (targetInterface.status !== 'UP') continue;

      if (targetInterface.vlanMode === 'ACCESS') {
        if (targetInterface.accessVlan === vlan) {
          this.forwardToInterface(targetInterface, frame, vlan);
          forwardCount++;
        }
      } else if (targetInterface.vlanMode === 'TRUNK') {
        if (targetInterface.allowedVlans.includes(vlan)) {
          this.forwardToInterface(targetInterface, frame, vlan);
          forwardCount++;
        }
      }
    }

    this.log(
      `[FLOOD] Flooded frame ${frame.id} (${frame.payload?.type || 'L2'}) on VLAN ${vlan} to ${forwardCount} ports.`
    );
  }

  /**
   * Encapsulates or decapsulates 802.1Q tags as needed and transmits out interface
   */
  private forwardToInterface(targetInterface: VirtualInterface, frame: EthernetFrame, vlan: number): void {
    let frameToSend: EthernetFrame;

    if (targetInterface.vlanMode === 'ACCESS') {
      // Untagged frame for Access port
      frameToSend = frame.vlanTag
        ? createEthernetFrame({
            srcMac: frame.srcMac,
            dstMac: frame.dstMac,
            ethertype: frame.ethertype,
            payload: frame.payload,
            vlanTag: undefined,
          })
        : frame;
    } else {
      // Trunk port: 802.1Q tagged frame
      frameToSend = frame.vlanTag === vlan
        ? frame
        : createEthernetFrame({
            srcMac: frame.srcMac,
            dstMac: frame.dstMac,
            ethertype: '0x8100',
            payload: frame.payload,
            vlanTag: vlan,
          });
    }

    targetInterface.transmit(frameToSend);
  }

  /**
   * Formatted Cisco MAC Address Table output (show mac address-table)
   */
  public getFormattedMacTable(): string {
    this.purgeStaleEntries();

    const header = '          Mac Address Table\n-------------------------------------------';
    const subheader = 'Vlan    Mac Address       Type        Ports\n----    -----------       --------    -----';

    const rows: string[] = [];
    for (const entry of this.macTable.values()) {
      const vlanStr = entry.vlan.toString().padEnd(8, ' ');
      const macStr = entry.mac.toLowerCase().padEnd(18, ' ');
      const typeStr = entry.type.padEnd(12, ' ');
      const portStr = entry.port;
      rows.push(`${vlanStr}${macStr}${typeStr}${portStr}`);
    }

    if (rows.length === 0) {
      return `${header}\n${subheader}\nTotal Mac Addresses for this criterion: 0\n`;
    }

    return `${header}\n${subheader}\n${rows.join('\n')}\nTotal Mac Addresses for this criterion: ${rows.length}\n`;
  }

  public getMacTableEntries(): MacAddressEntry[] {
    this.purgeStaleEntries();
    return Array.from(this.macTable.values());
  }

  public clearMacTable(): void {
    this.macTable.clear();
    this.log('[MAC TABLE] MAC address table cleared.');
  }

  private purgeStaleEntries(): void {
    const now = Date.now();
    for (const [mac, entry] of this.macTable.entries()) {
      if (entry.type === 'DYNAMIC' && now - entry.timestamp > this.agingTimeMs) {
        this.macTable.delete(mac);
      }
    }
  }
}
