/**
 * Base Network Device Class
 * Models core properties and interface management across all Cisco hardware.
 */

import { VirtualInterface } from './VirtualInterface';
import { EthernetFrame } from './packets';
import type { NetworkTransmissionBus } from './TransmissionBus';

export type DeviceCategory = 'router' | 'switch' | 'pc' | 'server' | 'hub';

export abstract class BaseDevice {
  public id: string;
  public name: string;
  public deviceType: DeviceCategory;
  public interfaces: Map<string, VirtualInterface> = new Map();

  protected bus: NetworkTransmissionBus | null = null;
  protected logs: string[] = [];

  constructor(id: string, name: string, deviceType: DeviceCategory) {
    this.id = id;
    this.name = name;
    this.deviceType = deviceType;
  }

  public setTransmissionBus(bus: NetworkTransmissionBus): void {
    this.bus = bus;
  }

  public getTransmissionBus(): NetworkTransmissionBus | null {
    return this.bus;
  }

  public addInterface(intf: VirtualInterface): void {
    this.interfaces.set(intf.name, intf);
  }

  public getInterface(name: string): VirtualInterface | undefined {
    return this.interfaces.get(name);
  }

  public getAllInterfaces(): VirtualInterface[] {
    return Array.from(this.interfaces.values());
  }

  public log(message: string): void {
    const entry = `[${new Date().toISOString().slice(11, 19)}] [${this.name}] ${message}`;
    this.logs.push(entry);
    if (this.logs.length > 500) this.logs.shift();
  }

  public getLogs(): string[] {
    return [...this.logs];
  }

  /**
   * Abstract frame ingress entry point.
   * Every device subclass (Switch, Router, Host) implements its dedicated layer-2 / layer-3 pipeline.
   */
  public abstract receiveFrame(ingressInterface: VirtualInterface, frame: EthernetFrame): void;
}
