/**
 * Cisco Packet Tracer Network Engine
 * Root Exports & Engine Bridge
 */

export * from './packets';
export * from './VirtualInterface';
export * from './BaseDevice';
export * from './SwitchDevice';
export * from './RouterDevice';
export * from './HostDevice';
export * from './TransmissionBus';
export * from './CiscoCliParser';

import { NetworkTransmissionBus, PhysicalLink } from './TransmissionBus';
import { RouterDevice } from './RouterDevice';
import { SwitchDevice } from './SwitchDevice';
import { HostDevice } from './HostDevice';
import { VirtualInterface } from './VirtualInterface';
import { NetworkDeviceData, DeviceType } from '../types/network';

/**
 * Factory to build an Engine instance synced to ReactFlow topology
 */
export function buildEngineFromTopology(
  nodes: { id: string; data: NetworkDeviceData }[],
  edges: {
    id: string;
    source: string;
    target: string;
    data?: {
      sourcePortId?: string;
      sourcePortName?: string;
      targetPortId?: string;
      targetPortName?: string;
      cableType?: any;
    };
  }[]
): NetworkTransmissionBus {
  const bus = new NetworkTransmissionBus();

  // 1. Instantiate devices
  for (const node of nodes) {
    const d = node.data;
    let dev;

    if (d.type === 'router') {
      dev = new RouterDevice(d.id, d.name);
    } else if (d.type === 'switch' || d.type === 'hub') {
      dev = new SwitchDevice(d.id, d.name);
    } else {
      dev = new HostDevice(d.id, d.name, d.type === 'server' ? 'server' : 'pc');
      if (d.gateway) {
        dev.defaultGateway = d.gateway;
      }
    }

    // Populate interfaces
    if (d.ports && d.ports.length > 0) {
      for (const p of d.ports) {
        const intf = new VirtualInterface({
          name: p.name || p.id,
          macAddress: p.mac || d.mac,
          ownerDevice: dev,
          ipAddress: p.ip || (d.type === 'pc' || d.type === 'server' ? d.ip : undefined),
          subnetMask: p.subnetMask || (d.type === 'pc' || d.type === 'server' ? d.subnetMask : undefined),
          status: p.status === 'up' ? 'UP' : p.status === 'down' ? 'DOWN' : 'ADMIN_DOWN',
          vlanMode: p.vlanMode || 'ACCESS',
          accessVlan: p.vlanId || 1,
          allowedVlans: [1],
        });
        dev.addInterface(intf);
      }
    }

    // Populate initial ARP / Routing tables if available
    if (d.arpTable) {
      for (const [ip, mac] of Object.entries(d.arpTable)) {
        if (dev instanceof RouterDevice || dev instanceof HostDevice) {
          dev.arpTable.set(ip, mac);
        }
      }
    }

    if (dev instanceof RouterDevice) {
      dev.syncConnectedRoutes();
      if (d.routingTable) {
        for (const r of d.routingTable) {
          if (r.type === 'S' && r.nextHop) {
            dev.addStaticRoute(r.network, r.netmask, r.nextHop);
          }
        }
      }
    }

    bus.registerDevice(dev);
  }

  // 2. Wire links
  for (const edge of edges) {
    const srcPort = edge.data?.sourcePortName || edge.data?.sourcePortId || 'FastEthernet0';
    const tgtPort = edge.data?.targetPortName || edge.data?.targetPortId || 'FastEthernet0';

    const link: PhysicalLink = {
      id: edge.id,
      deviceAId: edge.source,
      portA: srcPort,
      deviceBId: edge.target,
      portB: tgtPort,
      latencyMs: 500,
      cableType: edge.data?.cableType || 'straight',
      status: 'DOWN',
    };

    bus.registerLink(link);
  }

  return bus;
}
