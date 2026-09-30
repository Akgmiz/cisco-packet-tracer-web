import { NetworkDeviceData, DeviceType, PduHeaderInfo, OsiLayerDetail } from '../types/network';

export function createPduHeaderInfo(
  deviceAtName: string,
  deviceType: DeviceType,
  protocol: 'ICMP' | 'ARP',
  packetName: string,
  srcDevice: { name: string; ip: string; mac: string; type: DeviceType },
  dstDevice: { name: string; ip: string; mac: string; type: DeviceType },
  stepType: 'arp_req' | 'arp_broadcast' | 'arp_reply' | 'icmp_req' | 'icmp_reply',
  isDrop: boolean = false
): PduHeaderInfo {
  const isArp = protocol === 'ARP';
  const isReply = stepType === 'arp_reply' || stepType === 'icmp_reply';

  const srcMac = isReply ? dstDevice.mac : srcDevice.mac;
  const dstMac = stepType === 'arp_req' || stepType === 'arp_broadcast'
    ? 'FF:FF:FF:FF:FF:FF'
    : isReply
    ? srcDevice.mac
    : dstDevice.mac;

  const srcIp = isReply ? dstDevice.ip : srcDevice.ip;
  const dstIp = isReply ? srcDevice.ip : dstDevice.ip;

  // Inbound OSI Layers
  const inLayers: OsiLayerDetail[] = [
    {
      layer: 1,
      name: 'Physical',
      title: 'FastEthernet0 / Gig0/0',
      summary: '1. Port is up and physically connected. Bit-level frame received from physical medium.',
      headers: [
        { key: 'Port', value: 'FastEthernet0 (Connected)' },
        { key: 'Line Protocol', value: 'UP (100 Mbps Full Duplex)' },
      ],
    },
    {
      layer: 2,
      name: 'Data Link',
      title: 'Ethernet II Frame',
      summary: dstMac === 'FF:FF:FF:FF:FF:FF'
        ? '2. The frame destination MAC is a broadcast (FF:FF:FF:FF:FF:FF). The device processes the frame.'
        : `2. The frame destination MAC matches the receiving port MAC (${dstMac}). The device processes the frame.`,
      headers: [
        { key: 'Source MAC', value: srcMac },
        { key: 'Destination MAC', value: dstMac },
        { key: 'EtherType', value: isArp ? '0x0806 (ARP)' : '0x0800 (IPv4)' },
      ],
    },
    {
      layer: 3,
      name: 'Network',
      title: isArp ? 'ARP Packet' : 'IPv4 Packet',
      summary: isArp
        ? `3. The ARP target IP matches ${dstIp}. The device updates its ARP cache.`
        : isDrop
        ? `3. Subnet mismatch or host unreachable for destination IP ${dstIp}. Packet dropped.`
        : `3. The packet destination IP matches the device IP (${dstIp}). The device decapsulates the packet.`,
      headers: isArp
        ? [
            { key: 'ARP Opcode', value: stepType === 'arp_reply' ? '2 (Reply)' : '1 (Request)' },
            { key: 'Sender IP', value: srcIp },
            { key: 'Target IP', value: dstIp },
            { key: 'Sender MAC', value: srcMac },
          ]
        : [
            { key: 'Source IP', value: srcIp },
            { key: 'Destination IP', value: dstIp },
            { key: 'TTL', value: '128' },
            { key: 'Protocol', value: '1 (ICMP)' },
          ],
    },
    {
      layer: 4,
      name: 'Transport',
      title: isArp ? 'None' : 'ICMP Protocol',
      summary: isArp
        ? 'Layer 4 not applicable for ARP frame.'
        : `4. The ICMP message type is ${isReply ? 'Echo Reply (Type 0)' : 'Echo Request (Type 8)'}.`,
      headers: isArp ? [] : [
        { key: 'Protocol Type', value: 'ICMP' },
        { key: 'Message Type', value: isReply ? '0 (Echo Reply)' : '8 (Echo Request)' },
        { key: 'Code', value: '0' },
      ],
    },
    {
      layer: 7,
      name: 'Application',
      title: isArp ? 'Address Resolution' : 'Ping Application',
      summary: isArp
        ? '7. Address Resolution Protocol request to resolve IP to MAC address.'
        : `7. Ping application processing ${isReply ? 'Echo Reply' : 'Echo Request'}.`,
    },
  ];

  // Outbound OSI Layers (if replying or forwarding)
  const outLayers: OsiLayerDetail[] = [
    {
      layer: 1,
      name: 'Physical',
      title: 'FastEthernet0 / Gig0/0',
      summary: '1. FastEthernet0 transmits frame bits out onto physical medium.',
    },
    {
      layer: 2,
      name: 'Data Link',
      title: 'Ethernet II Header Encapsulation',
      summary: `2. The device encapsulates the PDU into an Ethernet frame with Dest MAC: ${srcMac}.`,
      headers: [
        { key: 'Out Source MAC', value: dstMac },
        { key: 'Out Dest MAC', value: srcMac },
        { key: 'Out EtherType', value: isArp ? '0x0806 (ARP)' : '0x0800 (IPv4)' },
      ],
    },
    {
      layer: 3,
      name: 'Network',
      title: isArp ? 'ARP Outbound' : 'IPv4 Outbound',
      summary: `3. Next hop IP address resolved. The device sends packet to ${srcIp}.`,
      headers: isArp
        ? [
            { key: 'Out Sender IP', value: dstIp },
            { key: 'Out Target IP', value: srcIp },
          ]
        : [
            { key: 'Out Source IP', value: dstIp },
            { key: 'Out Destination IP', value: srcIp },
          ],
    },
    {
      layer: 4,
      name: 'Transport',
      title: isArp ? 'None' : 'ICMP Outbound',
      summary: isArp ? 'None' : '4. Prepares ICMP Reply packet.',
    },
    {
      layer: 7,
      name: 'Application',
      title: isArp ? 'ARP Resolution' : 'Ping Reply Generation',
      summary: isArp
        ? '7. ARP process replies with hardware MAC address.'
        : '7. Echo Reply ready for transmission.',
    },
  ];

  // Dissector raw headers
  const rawHeaders = {
    ethernet: {
      preamble: '0xAAAAAAAAAAAAAAAA',
      destMac: dstMac,
      srcMac,
      type: isArp ? '0x0806' : '0x0800',
    },
    ip: isArp ? undefined : {
      version: 4,
      ihl: 5,
      tos: '0x00',
      totalLength: 60,
      id: '0x1F2A',
      flags: '0x00 (Don\'t Fragment)',
      ttl: 128,
      protocol: '1 (ICMP)',
      checksum: '0xB4C2',
      srcIp,
      destIp: dstIp,
    },
    icmp: isArp ? undefined : {
      type: isReply ? '0 (Echo Reply)' : '8 (Echo Request)',
      code: '0',
      checksum: '0x5C88',
      id: '0x0001',
      seq: '0x0001',
      payload: 'abcdefghijklmnopqrstuvwabcdefghi (32 bytes)',
    },
    arp: isArp ? {
      hardwareType: '1 (Ethernet)',
      protocolType: '0x0800 (IPv4)',
      opcode: stepType === 'arp_reply' ? '2 (Reply)' : '1 (Request)',
      srcMac,
      srcIp,
      targetMac: dstMac,
      targetIp: dstIp,
    } : undefined,
  };

  // Explanation notes
  const explanation = [
    `1. At device ${deviceAtName}: Packet inspected at Layer 2 (MAC) and Layer 3 (IP).`,
    stepType === 'arp_req'
      ? `2. Source host ${srcDevice.name} creates an ARP Request broadcast frame to discover MAC of ${dstDevice.ip}.`
      : stepType === 'arp_broadcast'
      ? `2. Switch received broadcast frame on incoming port and flooded frame out all active ports.`
      : stepType === 'arp_reply'
      ? `2. Destination ${dstDevice.name} received ARP request for its IP and generated a unicast ARP Reply.`
      : stepType === 'icmp_req'
      ? `2. Host ${srcDevice.name} transmitted ICMP Echo Request to ${dstDevice.name} (${dstDevice.ip}).`
      : `2. Host ${dstDevice.name} generated ICMP Echo Reply back to ${srcDevice.name} (${srcDevice.ip}).`,
    isDrop
      ? `3. [ERROR]: Destination host is unreachable or subnet mismatch. Packet dropped at Layer 3.`
      : `3. [SUCCESS]: Next-hop frame switching and IP routing operational.`,
  ];

  return {
    deviceAt: deviceAtName,
    deviceType,
    protocol,
    packetName,
    inLayers,
    outLayers: isReply || deviceType === 'switch' ? outLayers : undefined,
    rawHeaders,
    explanation,
  };
}
