/**
 * Dual Packet Inspector Modal
 * Features:
 *   Tab A: "Cisco OSI Model View" (Packet Tracer Style 7-Layer In/Out Inspector)
 *   Tab B: "Wireshark Packet Dissector" (Collapsible Protocol Tree & Live Hex/ASCII Dump)
 */

import React, { useState, useMemo } from 'react';
import { PduHeaderInfo, OsiLayerDetail } from '../types/network';
import {
  X,
  Layers,
  ArrowRight,
  ShieldCheck,
  Cpu,
  ChevronRight,
  ChevronDown,
  Binary,
  FileCode,
  Terminal,
  Activity,
  AlertTriangle,
} from 'lucide-react';

interface PduInformationModalProps {
  pduInfo: PduHeaderInfo | null;
  isOpen: boolean;
  onClose: () => void;
}

interface HexDumpRow {
  offset: string;
  hexBytes: string[];
  ascii: string;
}

export const PduInformationModal: React.FC<PduInformationModalProps> = ({
  pduInfo,
  isOpen,
  onClose,
}) => {
  const [activeMainTab, setActiveMainTab] = useState<'osi' | 'wireshark'>('osi');
  const [osiDirection, setOsiDirection] = useState<'in' | 'out'>('in');
  const [selectedLayerNum, setSelectedLayerNum] = useState<number | null>(null);

  // Wireshark tree collapsed state
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    frame: true,
    eth: true,
    ip: true,
    proto: true,
  });

  const [highlightedByteRange, setHighlightedByteRange] = useState<[number, number] | null>(null);

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Generate realistic Hex & ASCII dump based on PduHeaderInfo
  const hexDumpRows: HexDumpRow[] = useMemo(() => {
    if (!pduInfo) return [];

    const isArp = pduInfo.protocol === 'ARP';
    const eth = pduInfo.rawHeaders.ethernet;
    const ip = pduInfo.rawHeaders.ip;
    const icmp = pduInfo.rawHeaders.icmp;
    const arp = pduInfo.rawHeaders.arp;

    // Convert MAC to 6 bytes
    const macToBytes = (mac: string): number[] => {
      const parts = mac.split(/[:-]/);
      if (parts.length === 6) {
        return parts.map((p) => parseInt(p, 16) || 0);
      }
      return [0x00, 0x1a, 0x2b, 0x3c, 0x4d, 0x5e];
    };

    // Convert IP to 4 bytes
    const ipToBytes = (ipStr: string): number[] => {
      const parts = ipStr.split('.');
      if (parts.length === 4) {
        return parts.map((p) => parseInt(p, 10) || 0);
      }
      return [192, 168, 1, 1];
    };

    const bytes: number[] = [];

    // 1. Ethernet II Header (14 bytes)
    bytes.push(...macToBytes(eth.destMac));
    bytes.push(...macToBytes(eth.srcMac));
    bytes.push(isArp ? 0x08 : 0x08, isArp ? 0x06 : 0x00);

    if (isArp && arp) {
      // 2. ARP Header (28 bytes)
      bytes.push(0x00, 0x01); // Hardware type: Ethernet (1)
      bytes.push(0x08, 0x00); // Protocol type: IPv4 (0x0800)
      bytes.push(0x06, 0x04); // HLEN 6, PLEN 4
      bytes.push(0x00, arp.opcode.includes('2') ? 0x02 : 0x01); // Opcode: Request (1) or Reply (2)
      bytes.push(...macToBytes(arp.srcMac));
      bytes.push(...ipToBytes(arp.srcIp));
      bytes.push(...macToBytes(arp.targetMac));
      bytes.push(...ipToBytes(arp.targetIp));
      // Pad to 60 bytes minimum Ethernet frame
      while (bytes.length < 60) bytes.push(0x00);
    } else if (ip && icmp) {
      // 2. IPv4 Header (20 bytes)
      bytes.push(0x45); // Version 4, IHL 5 (20 bytes)
      bytes.push(0x00); // DSCP / ECN
      bytes.push(0x00, 0x3c); // Total length: 60 bytes
      bytes.push(0x1f, 0x2a); // Identification
      bytes.push(0x40, 0x00); // Flags: Don't Fragment
      bytes.push(ip.ttl ?? 64); // TTL
      bytes.push(0x01); // Protocol: ICMP (1)
      bytes.push(0xb4, 0xc2); // Header Checksum
      bytes.push(...ipToBytes(ip.srcIp));
      bytes.push(...ipToBytes(ip.destIp));

      // 3. ICMP Echo Header (8 bytes) + 32 bytes data
      const isEchoReply = icmp.type.includes('0') || icmp.type.includes('Reply');
      bytes.push(isEchoReply ? 0x00 : 0x08); // Type 8 or 0
      bytes.push(0x00); // Code 0
      bytes.push(0x5c, 0x88); // Checksum
      bytes.push(0x00, 0x01); // Identifier
      bytes.push(0x00, 0x01); // Sequence number

      // Payload (32 bytes standard Windows/Cisco pattern: abcdefghijklmnopqrstuvw...)
      const payloadStr = 'abcdefghijklmnopqrstuvwabcdefghi';
      for (let i = 0; i < payloadStr.length; i++) {
        bytes.push(payloadStr.charCodeAt(i));
      }
    }

    // Format into 16 bytes per line
    const rows: HexDumpRow[] = [];
    for (let i = 0; i < bytes.length; i += 16) {
      const slice = bytes.slice(i, i + 16);
      const hexBytes = slice.map((b) => b.toString(16).padStart(2, '0'));
      const ascii = slice
        .map((b) => (b >= 32 && b <= 126 ? String.fromCharCode(b) : '.'))
        .join('');
      rows.push({
        offset: i.toString(16).padStart(4, '0'),
        hexBytes,
        ascii,
      });
    }

    return rows;
  }, [pduInfo]);

  if (!isOpen || !pduInfo) return null;

  const displayedLayers =
    osiDirection === 'in' ? pduInfo.inLayers : pduInfo.outLayers || pduInfo.inLayers;

  const currentLayer =
    selectedLayerNum !== null
      ? displayedLayers.find((l) => l.layer === selectedLayerNum) || displayedLayers[0]
      : displayedLayers.find((l) => l.layer === 3) || displayedLayers[0];

  const eth = pduInfo.rawHeaders.ethernet;
  const ip = pduInfo.rawHeaders.ip;
  const icmp = pduInfo.rawHeaders.icmp;
  const arp = pduInfo.rawHeaders.arp;
  const isArp = pduInfo.protocol === 'ARP';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 pointer-events-none select-none font-sans text-slate-800">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs pointer-events-auto transition-opacity"
        onClick={onClose}
      />

      {/* Main Inspector Modal Window */}
      <div className="relative w-full max-w-3xl bg-[#eaedf2] dark:bg-slate-900 border-2 border-slate-400 dark:border-slate-700 rounded-xl shadow-2xl pointer-events-auto flex flex-col overflow-hidden max-h-[92vh] animate-in zoom-in-95 duration-150">
        {/* Title Bar */}
        <div className="px-4 py-2.5 bg-[#0f172a] text-white flex items-center justify-between text-xs font-semibold shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-5 h-4 bg-yellow-400 border border-yellow-600 rounded-xs flex items-center justify-center shadow-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse" />
            </div>
            <span className="text-slate-200">
              PDU Information at Device:{' '}
              <strong className="text-cyan-300 font-bold">{pduInfo.deviceAt}</strong>
            </span>
            <span className="px-2 py-0.5 rounded-full bg-slate-800 text-[10px] text-emerald-400 border border-emerald-500/30 font-mono">
              {pduInfo.protocol}
            </span>
          </div>

          <button
            onClick={onClose}
            className="w-6 h-6 rounded-md bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white flex items-center justify-center text-xs font-bold transition-colors cursor-pointer"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Tab Switcher: Tab A (Cisco OSI View) vs Tab B (Wireshark Dissector) */}
        <div className="px-3 pt-2 bg-[#d8dde6] dark:bg-slate-800 border-b border-slate-300 dark:border-slate-700 flex items-center gap-1.5 shrink-0 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveMainTab('osi')}
            className={`px-4 py-2 rounded-t-lg border-t border-x transition-all cursor-pointer flex items-center gap-2 ${
              activeMainTab === 'osi'
                ? 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-sky-600 dark:text-sky-400 shadow-xs'
                : 'bg-transparent border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Cisco OSI Model View</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMainTab('wireshark')}
            className={`px-4 py-2 rounded-t-lg border-t border-x transition-all cursor-pointer flex items-center gap-2 ${
              activeMainTab === 'wireshark'
                ? 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-sky-600 dark:text-sky-400 shadow-xs'
                : 'bg-transparent border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Binary className="w-3.5 h-3.5 text-blue-500" />
            <span>Wireshark Packet Dissector</span>
            <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-blue-600 text-white font-bold">
              PRO
            </span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 max-h-[74vh] bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100">
          {/* ========================================================================= */}
          {/* TAB A: CISCO OSI MODEL VIEW (Packet Tracer Style)                         */}
          {/* ========================================================================= */}
          {activeMainTab === 'osi' && (
            <div className="space-y-4 text-xs">
              {/* In Layers vs Out Layers Sub-selector */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-700 dark:text-slate-300">Perspective:</span>
                  <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 border border-slate-200 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => setOsiDirection('in')}
                      className={`px-3 py-1 rounded-md transition-all font-semibold ${
                        osiDirection === 'in'
                          ? 'bg-sky-600 text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                      }`}
                    >
                      Inbound Layers (RX)
                    </button>
                    {pduInfo.outLayers && (
                      <button
                        type="button"
                        onClick={() => setOsiDirection('out')}
                        className={`px-3 py-1 rounded-md transition-all font-semibold ${
                          osiDirection === 'out'
                            ? 'bg-sky-600 text-white shadow-xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                        }`}
                      >
                        Outbound Layers (TX)
                      </button>
                    )}
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 font-mono">
                  Packet: <strong className="text-slate-800 dark:text-slate-200">{pduInfo.packetName}</strong>
                </div>
              </div>

              {/* Vertical 7 OSI Layers Interactive Column */}
              <div className="grid grid-cols-1 md:grid-cols-7 gap-1.5">
                {[7, 6, 5, 4, 3, 2, 1].map((lvl) => {
                  const item = displayedLayers.find((l) => l.layer === lvl);
                  const isSelected = (currentLayer?.layer ?? 3) === lvl;

                  const layerTitles: Record<number, string> = {
                    7: 'Application',
                    6: 'Presentation',
                    5: 'Session',
                    4: 'Transport',
                    3: 'Network',
                    2: 'Data Link',
                    1: 'Physical',
                  };

                  return (
                    <div
                      key={lvl}
                      onClick={() => item && setSelectedLayerNum(lvl)}
                      className={`p-2.5 rounded-lg border transition-all cursor-pointer ${
                        !item
                          ? 'border-dashed border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-slate-400 opacity-60'
                          : isSelected
                          ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/40 ring-2 ring-sky-400/40 shadow-sm'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-sky-300'
                      }`}
                    >
                      <div className="flex items-center justify-between md:flex-col md:items-start">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Layer {lvl}
                        </span>
                        <span
                          className={`font-semibold text-[11px] truncate ${
                            isSelected ? 'text-sky-600 dark:text-sky-400 font-bold' : 'text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {layerTitles[lvl]}
                        </span>
                      </div>
                      {item ? (
                        <div className="mt-1 text-[9px] font-mono text-emerald-600 dark:text-emerald-400 truncate">
                          {item.title}
                        </div>
                      ) : (
                        <div className="mt-1 text-[9px] text-slate-400 italic">n/a</div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Selected Layer Detailed Inspection Box */}
              {currentLayer && (
                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                    <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                      Layer {currentLayer.layer}: {currentLayer.name} ({currentLayer.title})
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-mono">
                      {osiDirection === 'in' ? 'Ingress Processing' : 'Egress Encapsulation'}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed font-mono">
                    {currentLayer.summary}
                  </p>

                  {currentLayer.headers && currentLayer.headers.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-[11px]">
                      {currentLayer.headers.map((h, i) => (
                        <div
                          key={i}
                          className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-2xs"
                        >
                          <span className="text-slate-400 block text-[9px] uppercase font-sans font-semibold">
                            {h.key}
                          </span>
                          <span className="font-bold text-slate-800 dark:text-slate-100 truncate block">
                            {h.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Cisco Device Operation Explanation Box */}
              <div className="p-3.5 bg-[#0f172a] text-slate-200 rounded-xl font-mono text-[11px] space-y-1.5 shadow-md">
                <div className="text-emerald-400 font-bold font-sans text-xs flex items-center gap-1.5">
                  <Cpu className="w-4 h-4" />
                  <span>Device Forwarding Logic at {pduInfo.deviceAt}:</span>
                </div>
                {pduInfo.explanation.map((exp, idx) => (
                  <div key={idx} className="leading-relaxed text-slate-300 flex items-start gap-1.5">
                    <span className="text-sky-400 select-none">•</span>
                    <span>{exp}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB B: WIRESHARK PACKET DISSECTOR & HEX/ASCII DUMP                        */}
          {/* ========================================================================= */}
          {activeMainTab === 'wireshark' && (
            <div className="space-y-3 font-mono text-xs select-text">
              {/* Wireshark Summary Header Banner */}
              <div className="px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg flex items-center justify-between text-[11px] font-sans">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    Wireshark v4.2.0 In-Browser Capture Dissector
                  </span>
                </div>
                <span className="text-slate-500 font-mono text-[10px]">
                  Frame Length: {hexDumpRows.length * 16} bytes
                </span>
              </div>

              {/* Protocol Dissection Tree View */}
              <div className="border border-slate-300 dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-900 divide-y divide-slate-200 dark:divide-slate-800 text-[11px]">
                {/* 1. Frame Node */}
                <div>
                  <div
                    onClick={() => {
                      toggleSection('frame');
                      setHighlightedByteRange([0, hexDumpRows.length * 16]);
                    }}
                    className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300"
                  >
                    {expandedSections.frame ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    <span>▶ Frame: {hexDumpRows.length * 16} bytes on wire, captured on interface FastEthernet0/1</span>
                  </div>
                  {expandedSections.frame && (
                    <div className="pl-6 pb-2 text-[10px] text-slate-600 dark:text-slate-400 space-y-0.5">
                      <div>Arrival Time: {new Date().toISOString()}</div>
                      <div>Frame Number: 1</div>
                      <div>Frame Length: {hexDumpRows.length * 16} bytes (512 bits)</div>
                      <div>Protocols in frame: eth:ethertype:{isArp ? 'arp' : 'ip:icmp'}</div>
                    </div>
                  )}
                </div>

                {/* 2. Ethernet II Node */}
                <div>
                  <div
                    onClick={() => {
                      toggleSection('eth');
                      setHighlightedByteRange([0, 14]);
                    }}
                    className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300"
                  >
                    {expandedSections.eth ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    <span>
                      ▶ Ethernet II, Src: <span className="text-emerald-600 font-mono">{eth.srcMac}</span>, Dst:{' '}
                      <span className="text-blue-600 font-mono">{eth.destMac}</span>
                    </span>
                  </div>
                  {expandedSections.eth && (
                    <div className="pl-6 pb-2 text-[10px] text-slate-600 dark:text-slate-400 space-y-0.5">
                      <div>Destination: {eth.destMac} ({eth.destMac === 'FF:FF:FF:FF:FF:FF' ? 'Broadcast' : 'Unicast'})</div>
                      <div>Source: {eth.srcMac}</div>
                      <div>Type: {isArp ? 'ARP (0x0806)' : 'IPv4 (0x0800)'}</div>
                    </div>
                  )}
                </div>

                {/* 3. IPv4 Node (if IPv4) */}
                {!isArp && ip && (
                  <div>
                    <div
                      onClick={() => {
                        toggleSection('ip');
                        setHighlightedByteRange([14, 34]);
                      }}
                      className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300"
                    >
                      {expandedSections.ip ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      <span>
                        ▶ Internet Protocol Version 4, Src: <span className="text-emerald-600 font-mono">{ip.srcIp}</span>, Dst:{' '}
                        <span className="text-blue-600 font-mono">{ip.destIp}</span>
                      </span>
                    </div>
                    {expandedSections.ip && (
                      <div className="pl-6 pb-2 text-[10px] text-slate-600 dark:text-slate-400 space-y-0.5">
                        <div>0100 .... = Version: 4</div>
                        <div>.... 0101 = Header Length: 20 bytes (5)</div>
                        <div>Differentiated Services Field: {ip.tos || '0x00 (Default)'}</div>
                        <div>Total Length: {ip.totalLength || 60} bytes</div>
                        <div>Identification: {ip.id || '0x1f2a'} (7978)</div>
                        <div>Flags: {ip.flags || '0x00 (Don\'t Fragment)'}</div>
                        <div>Time to Live: {ip.ttl ?? 64}</div>
                        <div>Protocol: ICMP (1)</div>
                        <div>Header Checksum: {ip.checksum || '0xb4c2'} [validation disabled]</div>
                        <div>Source Address: {ip.srcIp}</div>
                        <div>Destination Address: {ip.destIp}</div>
                      </div>
                    )}
                  </div>
                )}

                {/* 4. Protocol Payload: ICMP or ARP */}
                {!isArp && icmp && (
                  <div>
                    <div
                      onClick={() => {
                        toggleSection('proto');
                        setHighlightedByteRange([34, 74]);
                      }}
                      className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300"
                    >
                      {expandedSections.proto ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      <span>
                        ▶ Internet Control Message Protocol ({icmp.type})
                      </span>
                    </div>
                    {expandedSections.proto && (
                      <div className="pl-6 pb-2 text-[10px] text-slate-600 dark:text-slate-400 space-y-0.5">
                        <div>Type: {icmp.type}</div>
                        <div>Code: {icmp.code || '0'}</div>
                        <div>Checksum: {icmp.checksum || '0x5c88'} [correct]</div>
                        <div>Identifier (BE): {icmp.id || '1 (0x0001)'}</div>
                        <div>Sequence Number (BE): {icmp.seq || '1 (0x0001)'}</div>
                        <div>Data (32 bytes): {icmp.payload || 'abcdefghijklmnopqrstuvwabcdefghi'}</div>
                      </div>
                    )}
                  </div>
                )}

                {isArp && arp && (
                  <div>
                    <div
                      onClick={() => {
                        toggleSection('proto');
                        setHighlightedByteRange([14, 42]);
                      }}
                      className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300"
                    >
                      {expandedSections.proto ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      <span>
                        ▶ Address Resolution Protocol ({arp.opcode})
                      </span>
                    </div>
                    {expandedSections.proto && (
                      <div className="pl-6 pb-2 text-[10px] text-slate-600 dark:text-slate-400 space-y-0.5">
                        <div>Hardware type: {arp.hardwareType || 'Ethernet (1)'}</div>
                        <div>Protocol type: {arp.protocolType || 'IPv4 (0x0800)'}</div>
                        <div>Hardware size: 6</div>
                        <div>Protocol size: 4</div>
                        <div>Opcode: {arp.opcode}</div>
                        <div>Sender MAC address: {arp.srcMac}</div>
                        <div>Sender IP address: {arp.srcIp}</div>
                        <div>Target MAC address: {arp.targetMac}</div>
                        <div>Target IP address: {arp.targetIp}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Wireshark Hex & ASCII Stream Preview */}
              <div className="border border-slate-300 dark:border-slate-700 rounded-xl overflow-hidden bg-black text-slate-200">
                <div className="px-3 py-1.5 bg-[#0f172a] text-slate-400 text-[10px] font-sans font-bold flex items-center justify-between border-b border-slate-800">
                  <span>Packet Bytes (Offset | Hex Stream | ASCII)</span>
                  <span className="text-emerald-400 font-mono">16 bytes/line</span>
                </div>
                <div className="p-3 font-mono text-[11px] leading-relaxed overflow-x-auto space-y-0.5">
                  {hexDumpRows.map((row, rowIdx) => {
                    const rowByteStart = rowIdx * 16;
                    return (
                      <div key={row.offset} className="flex items-center gap-4">
                        {/* Offset */}
                        <span className="text-slate-500 font-bold select-none">{row.offset}</span>

                        {/* Hex Bytes */}
                        <div className="flex items-center gap-1.5 flex-1">
                          {row.hexBytes.map((hex, colIdx) => {
                            const byteIdx = rowByteStart + colIdx;
                            const isHighlighted =
                              highlightedByteRange &&
                              byteIdx >= highlightedByteRange[0] &&
                              byteIdx < highlightedByteRange[1];

                            return (
                              <span
                                key={colIdx}
                                className={`px-0.5 rounded-2xs ${
                                  isHighlighted
                                    ? 'bg-sky-500 text-white font-bold'
                                    : 'text-slate-300 hover:text-white'
                                }`}
                              >
                                {hex}
                              </span>
                            );
                          })}
                        </div>

                        {/* ASCII Representation */}
                        <span className="text-emerald-400 font-bold border-l border-slate-800 pl-3 select-none">
                          {row.ascii}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
