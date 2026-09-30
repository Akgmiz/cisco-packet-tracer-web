/**
 * In-App AI Network Copilot & Diagnostics Engine (Tutor Mode)
 * Scans the active canvas topology, identifies physical/L2/L3 configuration flaws,
 * and provides actionable Cisco IOS CLI remediation commands with one-click Auto-Fix.
 */

import { NetworkDeviceData, DevicePort } from '../types/network';
import { checkAreInSameSubnet, isValidIpv4, isValidSubnetMask, calculateSubnetDetails } from '../utils/networkUtils';

export type DiagnosticSeverity = 'critical' | 'warning' | 'info';

export interface AiDiagnosticIssue {
  id: string;
  category: 'physical' | 'layer2' | 'layer3' | 'routing' | 'gateway';
  severity: DiagnosticSeverity;
  title: string;
  description: string;
  deviceId?: string;
  deviceName?: string;
  interfaceName?: string;
  suggestedCli: string[];
  autoFixAvailable: boolean;
  fixAction?: () => void;
}

export interface DiagnosticScanReport {
  timestamp: number;
  totalDevices: number;
  totalLinks: number;
  issues: AiDiagnosticIssue[];
  healthScore: number; // 0 to 100
  summary: string;
}

export function runAiNetworkDiagnostics(
  nodes: { id: string; data: NetworkDeviceData }[],
  edges: {
    id: string;
    source: string;
    target: string;
    data?: any;
  }[],
  onApplyFix?: (updatedNodes: { id: string; data: NetworkDeviceData }[]) => void
): DiagnosticScanReport {
  const issues: AiDiagnosticIssue[] = [];
  const nodeMap = new Map(nodes.map((n) => [n.id, n.data]));

  // 1. Check for Administratively Down Interfaces on Connected Cables
  for (const edge of edges) {
    const srcDev = nodeMap.get(edge.source);
    const dstDev = nodeMap.get(edge.target);
    if (!srcDev || !dstDev) continue;

    const srcPort = srcDev.ports?.find(
      (p) => p.id === edge.data?.sourcePortId || p.name === edge.data?.sourcePortName
    );
    const dstPort = dstDev.ports?.find(
      (p) => p.id === edge.data?.targetPortId || p.name === edge.data?.targetPortName
    );

    if (srcPort && srcPort.status === 'admin_down') {
      issues.push({
        id: `diag-admin-down-${srcDev.id}-${srcPort.name}`,
        category: 'physical',
        severity: 'critical',
        title: `Interface Shutdown on ${srcDev.name}`,
        description: `Port ${srcPort.name} on ${srcDev.name} is connected to ${dstDev.name} but is administratively down (shutdown). Line protocol cannot transition to UP.`,
        deviceId: srcDev.id,
        deviceName: srcDev.name,
        interfaceName: srcPort.name,
        suggestedCli: [
          `enable`,
          `configure terminal`,
          `interface ${srcPort.name}`,
          `no shutdown`,
        ],
        autoFixAvailable: true,
        fixAction: () => {
          srcPort.status = 'up';
          if (onApplyFix) onApplyFix([...nodes]);
        },
      });
    }

    if (dstPort && dstPort.status === 'admin_down') {
      issues.push({
        id: `diag-admin-down-${dstDev.id}-${dstPort.name}`,
        category: 'physical',
        severity: 'critical',
        title: `Interface Shutdown on ${dstDev.name}`,
        description: `Port ${dstPort.name} on ${dstDev.name} is connected to ${srcDev.name} but is administratively down (shutdown). Line protocol cannot transition to UP.`,
        deviceId: dstDev.id,
        deviceName: dstDev.name,
        interfaceName: dstPort.name,
        suggestedCli: [
          `enable`,
          `configure terminal`,
          `interface ${dstPort.name}`,
          `no shutdown`,
        ],
        autoFixAvailable: true,
        fixAction: () => {
          dstPort.status = 'up';
          if (onApplyFix) onApplyFix([...nodes]);
        },
      });
    }
  }

  // 2. Check for Missing Default Gateways on End Devices (PCs / Laptops)
  const routers = nodes.filter((n) => n.data.type === 'router');
  for (const node of nodes) {
    const d = node.data;
    if (d.type === 'pc' || d.type === 'laptop') {
      if (d.ip && (!d.gateway || d.gateway === '0.0.0.0')) {
        // Find if there's a router in topology
        const nearbyRouter = routers.find((r) => {
          const routerPorts = r.data.ports || [];
          return routerPorts.some((rp) => rp.ip && checkAreInSameSubnet(d.ip, d.subnetMask || '255.255.255.0', rp.ip, rp.subnetMask || '255.255.255.0').isSame);
        });

        const suggestedGw = nearbyRouter?.data.ports?.find(
          (rp) => rp.ip && checkAreInSameSubnet(d.ip, d.subnetMask || '255.255.255.0', rp.ip, rp.subnetMask || '255.255.255.0').isSame
        )?.ip || '192.168.1.1';

        issues.push({
          id: `diag-missing-gw-${d.id}`,
          category: 'gateway',
          severity: 'warning',
          title: `Missing Default Gateway on ${d.name}`,
          description: `${d.name} (${d.ip}) has no Default Gateway configured. It will not be able to route packets outside its local LAN subnet.`,
          deviceId: d.id,
          deviceName: d.name,
          suggestedCli: [
            `ipconfig /gateway ${suggestedGw}`,
          ],
          autoFixAvailable: true,
          fixAction: () => {
            d.gateway = suggestedGw;
            if (onApplyFix) onApplyFix([...nodes]);
          },
        });
      }
    }
  }

  // 3. Check for Subnet Mismatches on Direct Host-to-Router or Host-to-Host Links
  for (const edge of edges) {
    const srcDev = nodeMap.get(edge.source);
    const dstDev = nodeMap.get(edge.target);
    if (!srcDev || !dstDev) continue;

    // Direct link between two endpoints with IPs
    const srcIp = srcDev.ip;
    const dstIp = dstDev.ip;
    const srcMask = srcDev.subnetMask || '255.255.255.0';
    const dstMask = dstDev.subnetMask || '255.255.255.0';

    if (srcIp && dstIp && (srcDev.type === 'pc' || srcDev.type === 'server') && (dstDev.type === 'pc' || dstDev.type === 'server')) {
      const { isSame } = checkAreInSameSubnet(srcIp, srcMask, dstIp, dstMask);
      if (!isSame) {
        issues.push({
          id: `diag-subnet-mismatch-${srcDev.id}-${dstDev.id}`,
          category: 'layer3',
          severity: 'critical',
          title: `Subnet Mismatch on Direct Cable Link`,
          description: `${srcDev.name} (${srcIp}) and ${dstDev.name} (${dstIp}) are connected directly but reside on different IP subnets without a Layer 3 Router.`,
          deviceId: dstDev.id,
          deviceName: dstDev.name,
          suggestedCli: [
            `Change IP of ${dstDev.name} to match ${srcDev.name}'s subnet: 192.168.1.x / 255.255.255.0`,
          ],
          autoFixAvailable: false,
        });
      }
    }
  }

  // 4. Check for Routers without Static or Connected Routes for Inter-Subnet Traffic
  for (const r of routers) {
    const dev = r.data;
    const routes = dev.routingTable || [];
    const connectedPorts = (dev.ports || []).filter((p) => p.status === 'up' && p.ip);

    // If router has 1 interface and no static routes, it cannot route inter-subnet
    if (connectedPorts.length === 1 && routes.filter((rt) => rt.type === 'S').length === 0) {
      issues.push({
        id: `diag-router-stub-${dev.id}`,
        category: 'routing',
        severity: 'info',
        title: `Single Active Subnet on ${dev.name}`,
        description: `Router ${dev.name} only has 1 operational interface configured (${connectedPorts[0].name} - ${connectedPorts[0].ip}). Inter-subnet routing requires at least two subnets or static routes.`,
        deviceId: dev.id,
        deviceName: dev.name,
        suggestedCli: [
          `interface GigabitEthernet0/1`,
          `ip address 192.168.2.1 255.255.255.0`,
          `no shutdown`,
        ],
        autoFixAvailable: false,
      });
    }
  }

  // 5. Unassigned IP Addresses on Active Connected Hosts
  for (const node of nodes) {
    const d = node.data;
    if ((d.type === 'pc' || d.type === 'laptop' || d.type === 'server') && !d.ip) {
      issues.push({
        id: `diag-unassigned-ip-${d.id}`,
        category: 'layer3',
        severity: 'critical',
        title: `Unassigned IP on Host ${d.name}`,
        description: `${d.name} has no IP address assigned. Open Desktop -> IP Configuration to assign an IPv4 address.`,
        deviceId: d.id,
        deviceName: d.name,
        suggestedCli: [
          `ipconfig 192.168.1.10 255.255.255.0 192.168.1.1`,
        ],
        autoFixAvailable: true,
        fixAction: () => {
          d.ip = '192.168.1.10';
          d.subnetMask = '255.255.255.0';
          d.gateway = '192.168.1.1';
          if (onApplyFix) onApplyFix([...nodes]);
        },
      });
    }
  }

  // Compute Health Score
  const criticalCount = issues.filter((i) => i.severity === 'critical').length;
  const warningCount = issues.filter((i) => i.severity === 'warning').length;
  const healthScore = Math.max(0, 100 - criticalCount * 30 - warningCount * 15);

  let summary = 'Network topology healthy and operational.';
  if (criticalCount > 0) {
    summary = `${criticalCount} critical networking issue(s) detected that prevent packet delivery.`;
  } else if (warningCount > 0) {
    summary = `${warningCount} optimization warning(s) detected.`;
  }

  return {
    timestamp: Date.now(),
    totalDevices: nodes.length,
    totalLinks: edges.length,
    issues,
    healthScore,
    summary,
  };
}
