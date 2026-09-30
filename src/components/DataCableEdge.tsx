/**
 * Data Cable Edge with Real Link Status LEDs, Protocol-Colored Envelopes & Dropped Packet Animation
 */

import React, { memo } from 'react';
import { BaseEdge, EdgeProps, getStraightPath } from '@xyflow/react';
import { CableEdgeData, ActiveTool, PduHeaderInfo } from '../types/network';

export const DataCableEdge = memo(({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
}: EdgeProps) => {
  const edgeData = (data || {}) as CableEdgeData & {
    activeTool?: ActiveTool;
    onDeleteEdge?: (id: string) => void;
    onPacketClick?: (info?: PduHeaderInfo) => void;
    simulationSpeed?: number;
    dropReason?: string;
  };

  const isPinging = edgeData.isPinging;
  const isDropped = edgeData.pingStatus === 'dropped';
  const pingDirection = edgeData.pingDirection || 'forward';
  const isCrossover = edgeData.cableType === 'crossover';
  const isDeleteTool = edgeData.activeTool === 'delete';
  const packetType = edgeData.packetType || 'ICMP';
  const pduInfo = edgeData.pduInfo;
  const dropReason = edgeData.dropReason || (pduInfo?.explanation?.[pduInfo.explanation.length - 1] ?? 'Packet Dropped: Host Unreachable or Interface Shutdown');
  const speed = edgeData.simulationSpeed || 1;
  const animationDuration = `${(1.2 / speed).toFixed(2)}s`;

  // Real Link Status LEDs based on port status
  const sourceStatus = edgeData.sourceStatus || 'up';
  const targetStatus = edgeData.targetStatus || 'up';
  const isLinkUp = sourceStatus === 'up' && targetStatus === 'up';

  const getLedColor = (status: string, remoteStatus: string) => {
    if (status === 'admin_down') return '#ef4444'; // Red (administratively shutdown)
    if (status === 'down') return '#f59e0b'; // Amber (down)
    if (remoteStatus !== 'up') return '#f59e0b'; // Amber (remote end is down)
    return '#22c55e'; // Green (Link UP!)
  };

  const sourceLedColor = getLedColor(sourceStatus, targetStatus);
  const targetLedColor = getLedColor(targetStatus, sourceStatus);

  // Packet Tracer cables use straight line connections
  const [edgePath] = getStraightPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
  });

  const [reverseEdgePath] = getStraightPath({
    sourceX: targetX,
    sourceY: targetY,
    targetX: sourceX,
    targetY: sourceY,
  });

  const activePath = pingDirection === 'backward' ? reverseEdgePath : edgePath;

  const handleClick = (e: React.MouseEvent) => {
    if (isDeleteTool) {
      e.stopPropagation();
      edgeData.onDeleteEdge?.(id);
    }
  };

  const handleEnvelopeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (edgeData.onPacketClick) {
      edgeData.onPacketClick(pduInfo);
    }
  };

  // Position calculations for link lights & port badges
  const srcLedX = sourceX + (targetX - sourceX) * 0.12;
  const srcLedY = sourceY + (targetY - sourceY) * 0.12;
  const tgtLedX = targetX - (targetX - sourceX) * 0.12;
  const tgtLedY = targetY - (targetY - sourceY) * 0.12;

  // Protocol envelope colors
  const getProtocolEnvelope = () => {
    switch (packetType) {
      case 'ARP':
        return {
          fill: '#facc15', // Yellow
          stroke: '#ca8a04',
          text: 'ARP',
          textColor: '#713f12',
          aura: '#fef08a',
        };
      case 'OSPF':
        return {
          fill: '#f97316', // Orange
          stroke: '#c2410c',
          text: 'OSPF',
          textColor: '#431407',
          aura: '#fed7aa',
        };
      case 'ICMP':
      default:
        return {
          fill: '#06b6d4', // Cyan
          stroke: '#0891b2',
          text: 'ICMP',
          textColor: '#164e63',
          aura: '#a5f3fc',
        };
    }
  };

  const env = getProtocolEnvelope();

  return (
    <g onClick={handleClick} className={isDeleteTool ? 'cursor-crosshair group' : ''}>
      {/* Invisible thicker hit-box path for easier selection/deletion */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        className="cursor-pointer"
      />

      {/* Main Cable Line */}
      <path
        id={id}
        d={edgePath}
        fill="none"
        stroke={
          isDeleteTool
            ? '#ef4444'
            : isDropped
            ? '#f43f5e'
            : isPinging
            ? env.stroke
            : isLinkUp
            ? '#1e293b'
            : '#475569'
        }
        strokeWidth={2.5}
        strokeDasharray={isCrossover ? '6 4' : undefined}
        strokeLinecap="round"
        className="transition-colors duration-200"
      />

      {/* Cisco Link Status LEDs at Both Cable Terminals */}
      {/* Source Link Light */}
      <g>
        <circle
          cx={srcLedX}
          cy={srcLedY}
          r={4.5}
          fill={sourceLedColor}
          stroke="#0f172a"
          strokeWidth={1}
          className="transition-colors duration-300"
        />
        {edgeData.sourcePortName && (
          <text
            x={srcLedX}
            y={srcLedY - 7}
            textAnchor="middle"
            fontSize="8"
            fontFamily="monospace"
            fill="#334155"
            className="pointer-events-none select-none font-bold"
          >
            {edgeData.sourcePortName}
          </text>
        )}
      </g>

      {/* Target Link Light */}
      <g>
        <circle
          cx={tgtLedX}
          cy={tgtLedY}
          r={4.5}
          fill={targetLedColor}
          stroke="#0f172a"
          strokeWidth={1}
          className="transition-colors duration-300"
        />
        {edgeData.targetPortName && (
          <text
            x={tgtLedX}
            y={tgtLedY - 7}
            textAnchor="middle"
            fontSize="8"
            fontFamily="monospace"
            fill="#334155"
            className="pointer-events-none select-none font-bold"
          >
            {edgeData.targetPortName}
          </text>
        )}
      </g>

      {/* Authentic Animated PDU Envelope Traversing Cable (Color-Coded by Protocol) */}
      {isPinging && !isDropped && (
        <g
          onClick={handleEnvelopeClick}
          className="cursor-pointer group/packet"
        >
          <title>Click packet to inspect 7 OSI Layers &amp; Wireshark Headers</title>
          <g>
            <animateMotion
              dur={animationDuration}
              repeatCount="indefinite"
              path={activePath}
              keyPoints="0;1"
              keyTimes="0;1"
            />

            {/* Glowing aura */}
            <circle cx="0" cy="0" r="15" fill={env.aura} fillOpacity="0.4" className="animate-pulse" />

            {/* Envelope Shape */}
            <rect
              x="-12"
              y="-8"
              width="24"
              height="16"
              rx="2.5"
              fill={env.fill}
              stroke={env.stroke}
              strokeWidth="1.2"
              className="drop-shadow-md"
            />
            <path
              d="M-12 -6 L0 3 L12 -6"
              stroke={env.stroke}
              strokeWidth="1.2"
              fill="none"
            />
            <circle cx="0" cy="2" r="2.2" fill="#ef4444" />
            <text
              x="0"
              y="-1.5"
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="6"
              fontFamily="monospace"
              fontWeight="bold"
              fill={env.textColor}
            >
              {env.text}
            </text>
          </g>
        </g>
      )}

      {/* 4. Dropped Packet Visualization (Red X Pop Animation with Reason Tooltip) */}
      {isPinging && isDropped && (
        <g
          transform={`translate(${(sourceX + targetX) / 2}, ${(sourceY + targetY) / 2})`}
          onClick={handleEnvelopeClick}
          className="cursor-pointer animate-in zoom-in duration-200"
        >
          <title>{dropReason}</title>
          {/* Pulsing Red Aura */}
          <circle cx="0" cy="0" r="16" fill="#fee2e2" fillOpacity="0.6" className="animate-ping" />
          <circle cx="0" cy="0" r="12" fill="#ef4444" stroke="#ffffff" strokeWidth="2" className="drop-shadow-lg" />
          {/* Red X */}
          <path d="M-4.5 -4.5 L4.5 4.5 M4.5 -4.5 L-4.5 4.5" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
          {/* Drop Tag */}
          <g transform="translate(0, -18)">
            <rect x="-35" y="-10" width="70" height="15" rx="3" fill="#0f172a" fillOpacity="0.9" />
            <text x="0" y="0" textAnchor="middle" dominantBaseline="central" fontSize="7" fontFamily="sans-serif" fontWeight="bold" fill="#f87171">
              DROP (Inspect)
            </text>
          </g>
        </g>
      )}
    </g>
  );
});

DataCableEdge.displayName = 'DataCableEdge';
