import {
  DeviceType,
  DevicePort,
  PingSimulationResult,
  PortStatus,
  RouteEntry,
} from '../types/network';

// IP address validator
export function isValidIpv4(ip: string): boolean {
  if (!ip) return false;
  const parts = ip.trim().split('.');
  if (parts.length !== 4) return false;
  return parts.every((p) => {
    if (!/^\d+$/.test(p)) return false;
    const n = Number(p);
    return n >= 0 && n <= 255;
  });
}

// Subnet mask validator
export function isValidSubnetMask(mask: string): boolean {
  if (!isValidIpv4(mask)) return false;
  const binary = mask
    .trim()
    .split('.')
    .map((p) => Number(p).toString(2).padStart(8, '0'))
    .join('');
  return /^1*0*$/.test(binary) && binary.includes('1');
}

// Convert IP to 32-bit unsigned integer
export function ipToInt(ip: string): number {
  return (
    ip
      .trim()
      .split('.')
      .reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0
  );
}

// Convert 32-bit unsigned integer to IP string
export function intToIp(int: number): string {
  return [
    (int >>> 24) & 255,
    (int >>> 16) & 255,
    (int >>> 8) & 255,
    int & 255,
  ].join('.');
}

// Convert dotted subnet mask to CIDR notation (/24)
export function maskToCidr(mask: string): number {
  if (!isValidSubnetMask(mask)) return 24;
  const binary = mask
    .trim()
    .split('.')
    .map((p) => Number(p).toString(2).padStart(8, '0'))
    .join('');
  return (binary.match(/1/g) || []).length;
}

// Convert CIDR to dotted decimal subnet mask
export function cidrToMask(cidr: number): string {
  const binary = '1'.repeat(cidr).padEnd(32, '0');
  const octets = [];
  for (let i = 0; i < 32; i += 8) {
    octets.push(parseInt(binary.slice(i, i + 8), 2));
  }
  return octets.join('.');
}

// Calculate subnet details
export interface SubnetDetails {
  networkAddress: string;
  broadcastAddress: string;
  firstUsableIp: string;
  lastUsableIp: string;
  totalHosts: number;
  usableHosts: number;
  cidr: number;
  mask: string;
}

export function calculateSubnetDetails(
  ip: string,
  subnetMask: string
): SubnetDetails | null {
  if (!isValidIpv4(ip) || !isValidSubnetMask(subnetMask)) {
    return null;
  }

  const ipInt = ipToInt(ip);
  const maskInt = ipToInt(subnetMask);
  const cidr = maskToCidr(subnetMask);

  const networkInt = (ipInt & maskInt) >>> 0;
  const wildcardInt = ~maskInt >>> 0;
  const broadcastInt = (networkInt | wildcardInt) >>> 0;

  const totalHosts = Math.pow(2, 32 - cidr);
  const usableHosts = Math.max(0, totalHosts - 2);

  const firstUsableInt = cidr >= 31 ? networkInt : networkInt + 1;
  const lastUsableInt = cidr >= 31 ? broadcastInt : broadcastInt - 1;

  return {
    networkAddress: intToIp(networkInt),
    broadcastAddress: intToIp(broadcastInt),
    firstUsableIp: intToIp(firstUsableInt),
    lastUsableIp: intToIp(lastUsableInt),
    totalHosts,
    usableHosts,
    cidr,
    mask: subnetMask,
  };
}

// Check if two IPs are on the same subnet
export function checkAreInSameSubnet(
  ip1: string,
  mask1: string,
  ip2: string,
  mask2: string
): { isSame: boolean; net1: string; net2: string } {
  if (
    !isValidIpv4(ip1) ||
    !isValidSubnetMask(mask1) ||
    !isValidIpv4(ip2) ||
    !isValidSubnetMask(mask2)
  ) {
    return { isSame: false, net1: 'invalid', net2: 'invalid' };
  }

  const int1 = ipToInt(ip1);
  const m1 = ipToInt(mask1);
  const int2 = ipToInt(ip2);
  const m2 = ipToInt(mask2);

  const net1Int = (int1 & m1) >>> 0;
  const net2Int = (int2 & m2) >>> 0;

  const net1 = `${intToIp(net1Int)}/${maskToCidr(mask1)}`;
  const net2 = `${intToIp(net2Int)}/${maskToCidr(mask2)}`;

  const isSame = (net1Int === (int2 & m1) >>> 0) && (net2Int === (int1 & m2) >>> 0);

  return { isSame, net1, net2 };
}

// Generate realistic MAC address
export function generateMac(type: DeviceType = 'router'): string {
  const prefix =
    {
      pc: '00:1A:2B',
      laptop: '00:1B:3C',
      server: '52:54:00',
      switch: '00:0C:29',
      hub: '00:0D:30',
      router: 'CC:01:A2',
    }[type] || '00:50:56';

  const randomByte = () =>
    Math.floor(Math.random() * 256)
      .toString(16)
      .padStart(2, '0')
      .toUpperCase();
  return `${prefix}:${randomByte()}:${randomByte()}:${randomByte()}`;
}

// Normalize port ID string for case-insensitive matching
export function normalizePortId(raw: string): string {
  const trimmed = raw.trim();
  const lower = trimmed.toLowerCase();

  // GigabitEthernet aliases
  if (/^g(ig)?(abit)?(ethernet)?0\/0$/i.test(lower)) return 'GigabitEthernet0/0';
  if (/^g(ig)?(abit)?(ethernet)?0\/1$/i.test(lower)) return 'GigabitEthernet0/1';
  if (/^g(ig)?(abit)?(ethernet)?0\/2$/i.test(lower)) return 'GigabitEthernet0/2';

  // FastEthernet router aliases
  if (/^f(a)?(ast)?(ethernet)?0\/0$/i.test(lower)) return 'FastEthernet0/0';
  if (/^f(a)?(ast)?(ethernet)?0\/1$/i.test(lower)) return 'FastEthernet0/1';

  // Switch FastEthernet aliases Fa0/1 to Fa0/24
  const faMatch = lower.match(/^f(a)?(ast)?(ethernet)?0\/(\d+)$/i);
  if (faMatch) {
    return `FastEthernet0/${faMatch[4]}`;
  }

  // PC FastEthernet0 aliases
  if (/^f(a)?(ast)?(ethernet)?0$/i.test(lower) || lower === 'eth0') return 'FastEthernet0';

  if (lower === 'console' || lower === 'con 0' || lower === 'con0') return 'Console';

  return trimmed;
}

// Find port in port array with fuzzy matching
export function findPort(ports: DevicePort[], query: string): DevicePort | undefined {
  const normalized = normalizePortId(query);
  return (
    ports.find((p) => p.id === normalized || p.name === normalized) ||
    ports.find((p) => p.id.toLowerCase() === query.toLowerCase() || p.name.toLowerCase() === query.toLowerCase()) ||
    ports.find((p) => p.name.toLowerCase().includes(query.toLowerCase()))
  );
}

// Default ports generator conforming to Cisco specifications
export function getDefaultPorts(type: DeviceType): DevicePort[] {
  switch (type) {
    case 'pc':
    case 'laptop':
      return [
        {
          id: 'FastEthernet0',
          name: 'FastEthernet0',
          type: 'ethernet',
          status: 'up',
          mac: generateMac(type),
        },
      ];
    case 'server':
      return [
        {
          id: 'FastEthernet0',
          name: 'FastEthernet0',
          type: 'ethernet',
          status: 'up',
          mac: generateMac(type),
        },
        {
          id: 'GigabitEthernet0',
          name: 'GigabitEthernet0',
          type: 'gigabit',
          status: 'up',
          mac: generateMac(type),
        },
      ];
    case 'router':
      // Cisco Routers: ports default to "administratively down" (shutdown)!
      return [
        {
          id: 'GigabitEthernet0/0',
          name: 'GigabitEthernet0/0',
          type: 'gigabit',
          status: 'admin_down',
          mac: generateMac('router'),
        },
        {
          id: 'GigabitEthernet0/1',
          name: 'GigabitEthernet0/1',
          type: 'gigabit',
          status: 'admin_down',
          mac: generateMac('router'),
        },
        {
          id: 'FastEthernet0/0',
          name: 'FastEthernet0/0',
          type: 'ethernet',
          status: 'admin_down',
          mac: generateMac('router'),
        },
        {
          id: 'FastEthernet0/1',
          name: 'FastEthernet0/1',
          type: 'ethernet',
          status: 'admin_down',
          mac: generateMac('router'),
        },
        {
          id: 'Console',
          name: 'Console',
          type: 'console',
          status: 'up',
          mac: generateMac('router'),
        },
      ];
    case 'switch': {
      // Cisco Catalyst Switch: 24 FastEthernet ports + 2 GigabitEthernet ports (all UP by default)
      const ports: DevicePort[] = [];
      for (let i = 1; i <= 24; i++) {
        ports.push({
          id: `FastEthernet0/${i}`,
          name: `FastEthernet0/${i}`,
          type: 'ethernet',
          status: 'up',
          mac: generateMac('switch'),
        });
      }
      ports.push({
        id: 'GigabitEthernet0/1',
        name: 'GigabitEthernet0/1',
        type: 'gigabit',
        status: 'up',
        mac: generateMac('switch'),
      });
      ports.push({
        id: 'GigabitEthernet0/2',
        name: 'GigabitEthernet0/2',
        type: 'gigabit',
        status: 'up',
        mac: generateMac('switch'),
      });
      ports.push({
        id: 'Console',
        name: 'Console',
        type: 'console',
        status: 'up',
        mac: generateMac('switch'),
      });
      return ports;
    }
    case 'hub': {
      const ports: DevicePort[] = [];
      for (let i = 1; i <= 6; i++) {
        ports.push({
          id: `FastEthernet0/${i}`,
          name: `Port ${i}`,
          type: 'ethernet',
          status: 'up',
          mac: generateMac('hub'),
        });
      }
      return ports;
    }
  }
}

// Calculate LED colors and link status between two ports
export function calculateLinkStatus(
  portA?: DevicePort,
  portB?: DevicePort
): {
  isUp: boolean;
  colorA: string;
  colorB: string;
} {
  if (!portA || !portB) {
    return { isUp: false, colorA: '#94a3b8', colorB: '#94a3b8' };
  }

  const isUpA = portA.status === 'up';
  const isUpB = portB.status === 'up';
  const isLinkUp = isUpA && isUpB;

  const getColor = (p: DevicePort, other: DevicePort) => {
    if (p.status === 'admin_down') return '#ef4444'; // Red (administratively shutdown)
    if (p.status === 'down') return '#f59e0b'; // Amber
    if (other.status !== 'up') return '#f59e0b'; // Amber (waiting for remote link)
    return '#22c55e'; // Green (Link UP!)
  };

  return {
    isUp: isLinkUp,
    colorA: getColor(portA, portB),
    colorB: getColor(portB, portA),
  };
}

// Graph search using BFS to find path between nodes
export interface GraphNode {
  id: string;
  data: {
    type: DeviceType;
    ip?: string;
    subnetMask?: string;
    gateway?: string;
    name?: string;
    ports?: DevicePort[];
    routingTable?: RouteEntry[];
  };
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  data?: {
    sourcePortId?: string;
    sourcePortName?: string;
    targetPortId?: string;
    targetPortName?: string;
    isLinkUp?: boolean;
    sourceStatus?: PortStatus;
    targetStatus?: PortStatus;
  };
}

export function findPath(
  nodes: GraphNode[],
  edges: GraphEdge[],
  sourceId: string,
  destId: string
): { path: string[]; edgesInPath: string[]; containsSwitch: boolean } | null {
  if (sourceId === destId) return null;

  const adj = new Map<string, Array<{ neighborId: string; edgeId: string }>>();
  for (const node of nodes) {
    adj.set(node.id, []);
  }

  for (const edge of edges) {
    adj.get(edge.source)?.push({ neighborId: edge.target, edgeId: edge.id });
    adj.get(edge.target)?.push({ neighborId: edge.source, edgeId: edge.id });
  }

  const queue: Array<{ current: string; path: string[]; edgePath: string[] }> = [
    { current: sourceId, path: [sourceId], edgePath: [] },
  ];
  const visited = new Set<string>([sourceId]);

  while (queue.length > 0) {
    const { current, path, edgePath } = queue.shift()!;

    if (current === destId) {
      const intermediateNodes = path.slice(1, -1);
      const nodeMap = new Map(nodes.map((n) => [n.id, n]));
      const containsSwitch = intermediateNodes.some((nId) => {
        const t = nodeMap.get(nId)?.data.type;
        return t === 'switch' || t === 'hub';
      });

      return {
        path,
        edgesInPath: edgePath,
        containsSwitch,
      };
    }

    const neighbors = adj.get(current) || [];
    for (const { neighborId, edgeId } of neighbors) {
      if (!visited.has(neighborId)) {
        visited.add(neighborId);
        queue.push({
          current: neighborId,
          path: [...path, neighborId],
          edgePath: [...edgePath, edgeId],
        });
      }
    }
  }

  return null;
}

// Ping & Routing Evaluator Conforming to Cisco Packet Tracer
export function evaluatePing(
  nodes: GraphNode[],
  edges: GraphEdge[],
  sourceId: string,
  destId: string
): PingSimulationResult {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const edgeMap = new Map(edges.map((e) => [e.id, e]));
  const sourceNode = nodeMap.get(sourceId);
  const destNode = nodeMap.get(destId);

  if (!sourceNode || !destNode) {
    return {
      success: false,
      sourceId,
      destId,
      sourceIp: '',
      destIp: '',
      isSameSubnet: false,
      isConnectedViaSwitch: false,
      path: [],
      edgesInPath: [],
      message: 'Destination Host Unreachable',
      details: ['One or both endpoints do not exist in topology.'],
      latencyMs: 0,
    };
  }

  const srcIp = sourceNode.data.ip || '0.0.0.0';
  const srcMask = sourceNode.data.subnetMask || '255.255.255.0';
  const dstIp = destNode.data.ip || '0.0.0.0';
  const dstMask = destNode.data.subnetMask || '255.255.255.0';
  const srcGateway = sourceNode.data.gateway;

  const { isSame: isSameSubnet, net1, net2 } = checkAreInSameSubnet(
    srcIp,
    srcMask,
    dstIp,
    dstMask
  );
  const pathResult = findPath(nodes, edges, sourceId, destId);

  const hasPhysicalLink = pathResult !== null;
  const isConnectedViaSwitch = pathResult ? pathResult.containsSwitch : false;

  const details: string[] = [];
  const srcName = sourceNode.data.name || sourceNode.id;
  const dstName = destNode.data.name || destNode.id;

  details.push(`Source: ${srcName} [${srcIp}/${maskToCidr(srcMask)}]`);
  details.push(`Destination: ${dstName} [${dstIp}/${maskToCidr(dstMask)}]`);

  if (!hasPhysicalLink) {
    details.push('Topology: No physical cable connection exists between source and destination.');
    return {
      success: false,
      sourceId,
      destId,
      sourceIp: srcIp,
      destIp: dstIp,
      isSameSubnet,
      isConnectedViaSwitch: false,
      path: [],
      edgesInPath: [],
      message: 'Destination Host Unreachable: No Cable Link',
      details,
      latencyMs: 0,
    };
  }

  // 1. Verify link status of all cables along the path
  for (const edgeId of pathResult.edgesInPath) {
    const edge = edgeMap.get(edgeId);
    if (edge) {
      const srcNode = nodeMap.get(edge.source);
      const tgtNode = nodeMap.get(edge.target);
      const portA = srcNode?.data.ports?.find(
        (p) => p.id === edge.data?.sourcePortId || p.name === edge.data?.sourcePortName || p.name === edge.data?.sourcePortId || p.id === edge.data?.sourcePortName
      );
      const portB = tgtNode?.data.ports?.find(
        (p) => p.id === edge.data?.targetPortId || p.name === edge.data?.targetPortName || p.name === edge.data?.targetPortId || p.id === edge.data?.targetPortName
      );

      if (portA && portA.status === 'admin_down') {
        details.push(`Link Down: ${srcNode?.data.name} port ${portA.name} is administratively down (shutdown).`);
        return {
          success: false,
          sourceId,
          destId,
          sourceIp: srcIp,
          destIp: dstIp,
          isSameSubnet,
          isConnectedViaSwitch,
          path: pathResult.path,
          edgesInPath: pathResult.edgesInPath,
          message: `Request timed out: ${srcNode?.data.name} port is shutdown`,
          details,
          latencyMs: 0,
        };
      }
      if (portB && portB.status === 'admin_down') {
        details.push(`Link Down: ${tgtNode?.data.name} port ${portB.name} is administratively down (shutdown).`);
        return {
          success: false,
          sourceId,
          destId,
          sourceIp: srcIp,
          destIp: dstIp,
          isSameSubnet,
          isConnectedViaSwitch,
          path: pathResult.path,
          edgesInPath: pathResult.edgesInPath,
          message: `Request timed out: ${tgtNode?.data.name} port is shutdown`,
          details,
          latencyMs: 0,
        };
      }
    }
  }

  // 2. Intra-Subnet Verification (Same IP Subnet)
  if (isSameSubnet) {
    details.push(`Subnet Check: Both hosts belong to the identical subnet (${net1}).`);
    details.push('L2 Switching: Frame forwarded directly via MAC address table.');
    const latency = Number((1.2 + Math.random() * 1.2).toFixed(2));
    return {
      success: true,
      sourceId,
      destId,
      sourceIp: srcIp,
      destIp: dstIp,
      isSameSubnet: true,
      isConnectedViaSwitch,
      path: pathResult.path,
      edgesInPath: pathResult.edgesInPath,
      message: 'Ping Success: 0% Packet Loss (4/4 Replies)',
      details,
      latencyMs: latency,
    };
  }

  // 3. Inter-Subnet Verification (Different Subnets -> Must Route through Gateway)
  details.push(`Different Subnets: ${srcName} (${net1}) vs ${dstName} (${net2}).`);

  // Check if source host has a default gateway
  if (!srcGateway || !isValidIpv4(srcGateway)) {
    details.push(`Routing Failure: ${srcName} has no Default Gateway configured.`);
    details.push('End devices cannot route packets outside their local subnet without a default gateway.');
    return {
      success: false,
      sourceId,
      destId,
      sourceIp: srcIp,
      destIp: dstIp,
      isSameSubnet: false,
      isConnectedViaSwitch,
      path: pathResult.path,
      edgesInPath: pathResult.edgesInPath,
      message: 'Destination Host Unreachable: No Default Gateway',
      details,
      latencyMs: 0,
    };
  }

  // Find router in path
  const routerNode = pathResult.path
    .map((id) => nodeMap.get(id))
    .find((n) => n?.data.type === 'router');

  if (!routerNode) {
    details.push('Routing Failure: Subnet mismatch and no Router present in path to forward packets between subnets.');
    return {
      success: false,
      sourceId,
      destId,
      sourceIp: srcIp,
      destIp: dstIp,
      isSameSubnet: false,
      isConnectedViaSwitch,
      path: pathResult.path,
      edgesInPath: pathResult.edgesInPath,
      message: 'Destination Host Unreachable: Subnet Mismatch (No Router)',
      details,
      latencyMs: 0,
    };
  }

  // Verify Router has gateway IP configured on one of its interfaces
  const routerPorts = routerNode.data.ports || [];
  const gatewayPort = routerPorts.find((p) => p.ip === srcGateway);
  const routerName = routerNode.data.name || routerNode.id;

  if (!gatewayPort && routerNode.data.ip !== srcGateway) {
    details.push(`Gateway Failure: ${srcName}'s default gateway (${srcGateway}) is not configured on ${routerName}.`);
    return {
      success: false,
      sourceId,
      destId,
      sourceIp: srcIp,
      destIp: dstIp,
      isSameSubnet: false,
      isConnectedViaSwitch,
      path: pathResult.path,
      edgesInPath: pathResult.edgesInPath,
      message: `Request timed out: Gateway ${srcGateway} unreachable`,
      details,
      latencyMs: 0,
    };
  }

  if (gatewayPort && gatewayPort.status === 'admin_down') {
    details.push(`Gateway Port Shutdown: ${routerName} interface ${gatewayPort.name} is administratively down.`);
    return {
      success: false,
      sourceId,
      destId,
      sourceIp: srcIp,
      destIp: dstIp,
      isSameSubnet: false,
      isConnectedViaSwitch,
      path: pathResult.path,
      edgesInPath: pathResult.edgesInPath,
      message: `Request timed out: Router interface is shutdown`,
      details,
      latencyMs: 0,
    };
  }

  // Inter-subnet routing success via Router
  details.push(`L3 Routing: ${srcName} forwarded packet to Default Gateway ${srcGateway} on ${routerName}.`);
  details.push(`${routerName} routed packet from ${net1} to ${net2}.`);
  const latency = Number((2.8 + Math.random() * 2.0).toFixed(2));

  return {
    success: true,
    sourceId,
    destId,
    sourceIp: srcIp,
    destIp: dstIp,
    isSameSubnet: false,
    isConnectedViaSwitch,
    path: pathResult.path,
    edgesInPath: pathResult.edgesInPath,
    message: 'Ping Success: Routed via Gateway (0% Loss)',
    details,
    latencyMs: latency,
  };
}
