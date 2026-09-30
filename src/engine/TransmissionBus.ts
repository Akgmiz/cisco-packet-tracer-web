/**
 * Network Transmission Bus & Event Scheduler
 * Dispatches physical layer transmission events across links with latency,
 * emits visual telemetry for UI packet animation, and drives discrete event simulation.
 */

import { EthernetFrame } from './packets';
import { VirtualInterface } from './VirtualInterface';
import type { BaseDevice } from './BaseDevice';

export type BusMode = 'REALTIME' | 'SIMULATION';

export interface PhysicalLink {
  id: string;
  deviceAId: string;
  portA: string;
  deviceBId: string;
  portB: string;
  latencyMs: number;
  status: 'UP' | 'DOWN';
  cableType: 'straight' | 'crossover' | 'fiber' | 'serial';
}

export type TransmissionEventType =
  | 'TRANSMIT_START'
  | 'TRANSMIT_PROGRESS'
  | 'DELIVER'
  | 'DROP'
  | 'LINK_STATE_CHANGE';

export interface TransmissionEvent {
  id: string;
  type: TransmissionEventType;
  linkId: string;
  sourceDeviceId: string;
  sourceInterfaceName: string;
  targetDeviceId: string;
  targetInterfaceName: string;
  frame: EthernetFrame;
  timestamp: number;
  progress: number; // 0.0 to 1.0
  reason?: string;
  dropStatus?: 'DROPPED_TTL' | 'DROPPED_DOWN' | 'DROPPED_FILTER' | 'DROPPED_BUFFER';
}

export interface ScheduledTransmission {
  id: string;
  linkId: string;
  sourceDevice: BaseDevice;
  sourceInterface: VirtualInterface;
  targetDeviceId: string;
  targetInterfaceName: string;
  frame: EthernetFrame;
  scheduledTime: number;
  durationMs: number;
  status: 'PENDING' | 'IN_TRANSIT' | 'COMPLETED' | 'CANCELLED';
}

export type TransmissionEventListener = (event: TransmissionEvent) => void;
export type LinkStateListener = (linkId: string, isUp: boolean) => void;

export class NetworkTransmissionBus {
  private devices: Map<string, BaseDevice> = new Map();
  private links: Map<string, PhysicalLink> = new Map();

  // Mode and Event Queue
  public mode: BusMode = 'REALTIME';
  public defaultLatencyMs: number = 500; // Optimal 500ms for smooth UI animation

  private transmissionQueue: ScheduledTransmission[] = [];
  private activeTransmissions: Map<string, ScheduledTransmission> = new Map();

  // Subscribers
  private eventListeners: Set<TransmissionEventListener> = new Set();
  private linkStateListeners: Set<LinkStateListener> = new Set();

  private isRunning: boolean = true;
  private animationFrameId: number | null = null;
  private eventCounter: number = 0;

  constructor() {
    this.startClock();
  }

  // --- Device & Link Topology Registry ---

  public registerDevice(device: BaseDevice): void {
    device.setTransmissionBus(this);
    this.devices.set(device.id, device);
  }

  public unregisterDevice(deviceId: string): void {
    const dev = this.devices.get(deviceId);
    if (dev) {
      dev.setTransmissionBus(null as any);
      this.devices.delete(deviceId);
    }
  }

  public getDevice(deviceId: string): BaseDevice | undefined {
    return this.devices.get(deviceId);
  }

  public getAllDevices(): BaseDevice[] {
    return Array.from(this.devices.values());
  }

  public registerLink(link: PhysicalLink): void {
    this.links.set(link.id, link);

    // Bind endpoints
    const devA = this.devices.get(link.deviceAId);
    const devB = this.devices.get(link.deviceBId);

    const intfA = devA?.interfaces.get(link.portA);
    const intfB = devB?.interfaces.get(link.portB);

    if (intfA) intfA.connect(link.deviceBId, link.portB, link.id);
    if (intfB) intfB.connect(link.deviceAId, link.portA, link.id);

    this.notifyLinkStateChanged(link.id);
  }

  public removeLink(linkId: string): void {
    const link = this.links.get(linkId);
    if (link) {
      const devA = this.devices.get(link.deviceAId);
      const devB = this.devices.get(link.deviceBId);
      devA?.interfaces.get(link.portA)?.disconnect();
      devB?.interfaces.get(link.portB)?.disconnect();
      this.links.delete(linkId);
    }
  }

  public getLink(linkId: string): PhysicalLink | undefined {
    return this.links.get(linkId);
  }

  // --- Frame Transmission Scheduling ---

  public scheduleFrameTransmission(params: {
    linkId: string;
    sourceDevice: BaseDevice;
    sourceInterface: VirtualInterface;
    targetDeviceId: string;
    targetInterfaceName: string;
    frame: EthernetFrame;
    latencyMs?: number;
  }): void {
    const link = this.links.get(params.linkId);
    const latency = params.latencyMs ?? link?.latencyMs ?? this.defaultLatencyMs;

    const transmission: ScheduledTransmission = {
      id: `tx-${++this.eventCounter}-${Date.now().toString(36)}`,
      linkId: params.linkId,
      sourceDevice: params.sourceDevice,
      sourceInterface: params.sourceInterface,
      targetDeviceId: params.targetDeviceId,
      targetInterfaceName: params.targetInterfaceName,
      frame: params.frame,
      scheduledTime: Date.now(),
      durationMs: latency,
      status: 'PENDING',
    };

    if (this.mode === 'REALTIME') {
      this.activeTransmissions.set(transmission.id, transmission);
      this.emitEvent({
        id: `evt-${transmission.id}-start`,
        type: 'TRANSMIT_START',
        linkId: transmission.linkId,
        sourceDeviceId: transmission.sourceDevice.id,
        sourceInterfaceName: transmission.sourceInterface.name,
        targetDeviceId: transmission.targetDeviceId,
        targetInterfaceName: transmission.targetInterfaceName,
        frame: transmission.frame,
        timestamp: Date.now(),
        progress: 0.0,
      });

      // Deliver after latency
      setTimeout(() => {
        this.completeTransmission(transmission);
      }, latency);
    } else {
      // Simulation mode: Enqueue for step-by-step dispatch
      this.transmissionQueue.push(transmission);
    }
  }

  /**
   * Completes delivery of a transmission at the destination interface
   */
  private completeTransmission(tx: ScheduledTransmission): void {
    this.activeTransmissions.delete(tx.id);

    const targetDev = this.devices.get(tx.targetDeviceId);
    const targetIntf = targetDev?.interfaces.get(tx.targetInterfaceName);

    if (!targetDev || !targetIntf) {
      this.emitEvent({
        id: `evt-${tx.id}-drop`,
        type: 'DROP',
        linkId: tx.linkId,
        sourceDeviceId: tx.sourceDevice.id,
        sourceInterfaceName: tx.sourceInterface.name,
        targetDeviceId: tx.targetDeviceId,
        targetInterfaceName: tx.targetInterfaceName,
        frame: tx.frame,
        timestamp: Date.now(),
        progress: 1.0,
        reason: 'Target interface not found',
        dropStatus: 'DROPPED_DOWN',
      });
      return;
    }

    if (targetIntf.status !== 'UP') {
      this.emitEvent({
        id: `evt-${tx.id}-drop`,
        type: 'DROP',
        linkId: tx.linkId,
        sourceDeviceId: tx.sourceDevice.id,
        sourceInterfaceName: tx.sourceInterface.name,
        targetDeviceId: tx.targetDeviceId,
        targetInterfaceName: tx.targetInterfaceName,
        frame: tx.frame,
        timestamp: Date.now(),
        progress: 1.0,
        reason: `Target port ${targetIntf.name} is administratively down (shutdown)`,
        dropStatus: 'DROPPED_DOWN',
      });
      return;
    }

    // Emit delivery event so UI can display success pulse
    this.emitEvent({
      id: `evt-${tx.id}-deliver`,
      type: 'DELIVER',
      linkId: tx.linkId,
      sourceDeviceId: tx.sourceDevice.id,
      sourceInterfaceName: tx.sourceInterface.name,
      targetDeviceId: tx.targetDeviceId,
      targetInterfaceName: tx.targetInterfaceName,
      frame: tx.frame,
      timestamp: Date.now(),
      progress: 1.0,
    });

    // Deliver to receiver NIC
    targetIntf.receive(tx.frame);
  }

  // --- Step Forward / Discrete Event Execution (Simulation Mode) ---

  public stepForward(): ScheduledTransmission | null {
    if (this.transmissionQueue.length === 0) return null;

    const nextTx = this.transmissionQueue.shift()!;
    this.emitEvent({
      id: `evt-${nextTx.id}-start`,
      type: 'TRANSMIT_START',
      linkId: nextTx.linkId,
      sourceDeviceId: nextTx.sourceDevice.id,
      sourceInterfaceName: nextTx.sourceInterface.name,
      targetDeviceId: nextTx.targetDeviceId,
      targetInterfaceName: nextTx.targetInterfaceName,
      frame: nextTx.frame,
      timestamp: Date.now(),
      progress: 0.0,
    });

    this.completeTransmission(nextTx);
    return nextTx;
  }

  public getPendingQueueCount(): number {
    return this.transmissionQueue.length;
  }

  public clearQueue(): void {
    this.transmissionQueue = [];
    this.activeTransmissions.clear();
  }

  // --- Link State Notification & LED Updates ---

  public notifyLinkStateChanged(linkId: string): void {
    const link = this.links.get(linkId);
    if (!link) return;

    const devA = this.devices.get(link.deviceAId);
    const devB = this.devices.get(link.deviceBId);
    const intfA = devA?.interfaces.get(link.portA);
    const intfB = devB?.interfaces.get(link.portB);

    const isUp = (intfA?.status === 'UP') && (intfB?.status === 'UP');
    link.status = isUp ? 'UP' : 'DOWN';

    for (const listener of this.linkStateListeners) {
      listener(linkId, isUp);
    }
  }

  // --- Event Subscriptions ---

  public subscribeEvents(listener: TransmissionEventListener): () => void {
    this.eventListeners.add(listener);
    return () => {
      this.eventListeners.delete(listener);
    };
  }

  public subscribeLinkState(listener: LinkStateListener): () => void {
    this.linkStateListeners.add(listener);
    return () => {
      this.linkStateListeners.delete(listener);
    };
  }

  private emitEvent(event: TransmissionEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (err) {
        console.error('Error in transmission event listener:', err);
      }
    }
  }

  // --- Animation Clock (Emits Smooth Progress for In-Flight Packets) ---

  private startClock(): void {
    const tick = () => {
      if (this.isRunning && this.activeTransmissions.size > 0) {
        const now = Date.now();
        for (const tx of this.activeTransmissions.values()) {
          const elapsed = now - tx.scheduledTime;
          const progress = Math.min(1.0, elapsed / tx.durationMs);

          this.emitEvent({
            id: `evt-${tx.id}-progress`,
            type: 'TRANSMIT_PROGRESS',
            linkId: tx.linkId,
            sourceDeviceId: tx.sourceDevice.id,
            sourceInterfaceName: tx.sourceInterface.name,
            targetDeviceId: tx.targetDeviceId,
            targetInterfaceName: tx.targetInterfaceName,
            frame: tx.frame,
            timestamp: now,
            progress,
          });
        }
      }

      if (typeof window !== 'undefined' && window.requestAnimationFrame) {
        this.animationFrameId = window.requestAnimationFrame(tick);
      } else {
        setTimeout(tick, 30);
      }
    };

    tick();
  }

  public stopClock(): void {
    this.isRunning = false;
    if (this.animationFrameId !== null && typeof window !== 'undefined') {
      window.cancelAnimationFrame(this.animationFrameId);
    }
  }
}
