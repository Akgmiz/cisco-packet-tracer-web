/**
 * Virtual Network Interface (NIC)
 * Models physical and logical layer 1/layer 2 properties of Cisco interfaces.
 */

import { EthernetFrame } from './packets';
import type { BaseDevice } from './BaseDevice';

export type InterfaceStatus = 'UP' | 'DOWN' | 'ADMIN_DOWN';
export type DuplexMode = 'FULL' | 'HALF' | 'AUTO';
export type InterfaceSpeed = 10 | 100 | 1000;
export type VlanMode = 'ACCESS' | 'TRUNK';

export interface PeerConnection {
  deviceId: string;
  interfaceName: string;
  linkId: string;
}

export interface InterfaceStats {
  rxFrames: number;
  txFrames: number;
  rxBytes: number;
  txBytes: number;
  rxDrops: number;
  txDrops: number;
  rxErrors: number;
}

export class VirtualInterface {
  public name: string;
  public macAddress: string;
  public ipAddress?: string;
  public subnetMask?: string;
  public status: InterfaceStatus;
  public duplex: DuplexMode;
  public speed: InterfaceSpeed;
  public vlanMode: VlanMode;
  public accessVlan: number;
  public allowedVlans: number[];

  // Physical connection endpoint
  public connectedPeer: PeerConnection | null = null;
  public ownerDevice: BaseDevice;

  // Interface telemetry statistics
  public stats: InterfaceStats = {
    rxFrames: 0,
    txFrames: 0,
    rxBytes: 0,
    txBytes: 0,
    rxDrops: 0,
    txDrops: 0,
    rxErrors: 0,
  };

  constructor(params: {
    name: string;
    macAddress: string;
    ownerDevice: BaseDevice;
    ipAddress?: string;
    subnetMask?: string;
    status?: InterfaceStatus;
    duplex?: DuplexMode;
    speed?: InterfaceSpeed;
    vlanMode?: VlanMode;
    accessVlan?: number;
    allowedVlans?: number[];
  }) {
    this.name = params.name;
    this.macAddress = params.macAddress.toUpperCase();
    this.ownerDevice = params.ownerDevice;
    this.ipAddress = params.ipAddress;
    this.subnetMask = params.subnetMask;
    this.status = params.status ?? 'ADMIN_DOWN';
    this.duplex = params.duplex ?? 'FULL';
    this.speed = params.speed ?? 1000;
    this.vlanMode = params.vlanMode ?? 'ACCESS';
    this.accessVlan = params.accessVlan ?? 1;
    this.allowedVlans = params.allowedVlans ?? [1];
  }

  /**
   * Determine if the physical line protocol is UP.
   * Both this interface AND the connected peer interface must be administratively UP.
   */
  public isOperational(): boolean {
    if (this.status !== 'UP') return false;
    if (!this.connectedPeer) return false;

    const bus = this.ownerDevice.getTransmissionBus();
    if (!bus) return false;

    const peerDevice = bus.getDevice(this.connectedPeer.deviceId);
    if (!peerDevice) return false;

    const peerInterface = peerDevice.interfaces.get(this.connectedPeer.interfaceName);
    if (!peerInterface) return false;

    return peerInterface.status === 'UP';
  }

  /**
   * Set administrative status (e.g. Cisco 'shutdown' or 'no shutdown')
   */
  public setAdminStatus(status: 'UP' | 'ADMIN_DOWN'): void {
    const previous = this.status;
    this.status = status;

    if (previous !== status) {
      const bus = this.ownerDevice.getTransmissionBus();
      if (bus && this.connectedPeer) {
        bus.notifyLinkStateChanged(this.connectedPeer.linkId);
      }
    }
  }

  /**
   * Configure IP and Subnet Mask
   */
  public setIpAddress(ip: string, mask: string): void {
    this.ipAddress = ip;
    this.subnetMask = mask;
  }

  /**
   * Connect interface to a remote peer port via a link
   */
  public connect(peerDeviceId: string, peerInterfaceName: string, linkId: string): void {
    this.connectedPeer = {
      deviceId: peerDeviceId,
      interfaceName: peerInterfaceName,
      linkId,
    };
  }

  /**
   * Disconnect patch cable
   */
  public disconnect(): void {
    this.connectedPeer = null;
  }

  /**
   * Ingress pipeline: Receives an incoming frame from the physical transmission line
   */
  public receive(frame: EthernetFrame): void {
    // If interface is administratively down or physically disconnected, frame is dropped
    if (this.status === 'ADMIN_DOWN') {
      this.stats.rxDrops++;
      this.ownerDevice.log(
        `[DROP] Interface ${this.name} is administratively down. Ingress frame ${frame.id} dropped.`
      );
      return;
    }

    if (!this.connectedPeer) {
      this.stats.rxDrops++;
      this.ownerDevice.log(
        `[DROP] Interface ${this.name} has no physical cable. Ingress frame ${frame.id} dropped.`
      );
      return;
    }

    this.stats.rxFrames++;
    this.stats.rxBytes += 64; // Base Ethernet frame size approximation

    // Deliver frame to device protocol processing stack
    this.ownerDevice.receiveFrame(this, frame);
  }

  /**
   * Egress pipeline: Transmits a frame out of this physical interface over the bus
   */
  public transmit(frame: EthernetFrame): boolean {
    if (this.status === 'ADMIN_DOWN') {
      this.stats.txDrops++;
      this.ownerDevice.log(
        `[DROP] Cannot transmit frame ${frame.id}: Interface ${this.name} is administratively down (shutdown).`
      );
      return false;
    }

    if (!this.connectedPeer) {
      this.stats.txDrops++;
      this.ownerDevice.log(
        `[DROP] Cannot transmit frame ${frame.id}: Interface ${this.name} is not connected to a cable.`
      );
      return false;
    }

    const bus = this.ownerDevice.getTransmissionBus();
    if (!bus) {
      this.stats.txDrops++;
      this.ownerDevice.log(`[DROP] Cannot transmit frame ${frame.id}: No transmission bus registered.`);
      return false;
    }

    this.stats.txFrames++;
    this.stats.txBytes += 64;

    // Dispatch transmission across the physical link via the event scheduler
    bus.scheduleFrameTransmission({
      linkId: this.connectedPeer.linkId,
      sourceDevice: this.ownerDevice,
      sourceInterface: this,
      targetDeviceId: this.connectedPeer.deviceId,
      targetInterfaceName: this.connectedPeer.interfaceName,
      frame,
    });

    return true;
  }
}
