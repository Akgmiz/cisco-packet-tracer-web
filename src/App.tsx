/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  ReactFlowProvider,
  BackgroundVariant,
  useReactFlow,
} from '@xyflow/react';

import {
  NetworkDeviceData,
  DeviceType,
  CableType,
  CableEdgeData,
  PingSimulationResult,
  ActiveTool,
  WorkspaceMode,
  SimulationEvent,
  CanvasNote,
  UserPdu,
  PduHeaderInfo,
  PortStatus,
} from './types/network';
import { NetworkNode } from './components/NetworkNode';
import { DataCableEdge } from './components/DataCableEdge';
import { DeviceConfigSheet } from './components/DeviceConfigSheet';
import { PingModal } from './components/PingModal';
import { PacketTracerTopBar } from './components/PacketTracerTopBar';
import { PacketTracerDeviceShelf } from './components/PacketTracerDeviceShelf';
import { PacketTracerModeSwitcher } from './components/PacketTracerModeSwitcher';
import { PacketTracerNote } from './components/PacketTracerNote';
import { PresetsModal } from './components/PresetsModal';
import { QuickHelpModal } from './components/QuickHelpModal';
import { PduInformationModal } from './components/PduInformationModal';
import { PortSelectionModal } from './components/PortSelectionModal';
import { AiDiagnosticsModal } from './components/AiDiagnosticsModal';
import { runAiNetworkDiagnostics, DiagnosticScanReport, AiDiagnosticIssue } from './engine/AiDiagnosticEngine';
import {
  evaluatePing,
  generateMac,
  getDefaultPorts,
  checkAreInSameSubnet,
  findPath,
} from './utils/networkUtils';
import { createPduHeaderInfo } from './utils/pduUtils';
import { CheckCircle2, AlertOctagon, X } from 'lucide-react';
import confetti from 'canvas-confetti';

const nodeTypes = {
  networkDevice: NetworkNode,
};

const edgeTypes = {
  dataCable: DataCableEdge,
};

type AppNode = Node<NetworkDeviceData>;
type AppEdge = Edge<CableEdgeData>;

interface SimPlanStep {
  stepNumber: number;
  lastDevice: string;
  atDevice: string;
  type: 'ICMP' | 'ARP';
  info: string;
  status: 'success' | 'failed' | 'in_progress';
  pduInfo: PduHeaderInfo;
  action: () => Promise<void>;
}

// Initial Cisco Packet Tracer Starter Topology
const createInitialNodes = (): AppNode[] => [
  {
    id: 'switch0',
    type: 'networkDevice',
    position: { x: 380, y: 200 },
    data: {
      id: 'switch0',
      name: 'Switch0',
      type: 'switch',
      model: '2960',
      ip: '',
      subnetMask: '255.255.255.0',
      gateway: '',
      mac: generateMac('switch'),
      ports: getDefaultPorts('switch').map((p) => {
        if (p.id === 'FastEthernet0/1') return { ...p, connectedTo: { nodeId: 'pc0', portId: 'FastEthernet0' } };
        if (p.id === 'FastEthernet0/2') return { ...p, connectedTo: { nodeId: 'pc1', portId: 'FastEthernet0' } };
        if (p.id === 'FastEthernet0/3') return { ...p, connectedTo: { nodeId: 'server0', portId: 'FastEthernet0' } };
        return p;
      }),
      status: 'idle',
    },
  },
  {
    id: 'pc0',
    type: 'networkDevice',
    position: { x: 100, y: 120 },
    data: {
      id: 'pc0',
      name: 'PC0',
      type: 'pc',
      model: 'PC-PT',
      ip: '192.168.1.10',
      subnetMask: '255.255.255.0',
      gateway: '192.168.1.1',
      mac: generateMac('pc'),
      ports: getDefaultPorts('pc').map((p) =>
        p.id === 'FastEthernet0' ? { ...p, connectedTo: { nodeId: 'switch0', portId: 'FastEthernet0/1' } } : p
      ),
      arpTable: {},
      status: 'idle',
    },
  },
  {
    id: 'pc1',
    type: 'networkDevice',
    position: { x: 100, y: 320 },
    data: {
      id: 'pc1',
      name: 'PC1',
      type: 'pc',
      model: 'PC-PT',
      ip: '192.168.1.20',
      subnetMask: '255.255.255.0',
      gateway: '192.168.1.1',
      mac: generateMac('pc'),
      ports: getDefaultPorts('pc').map((p) =>
        p.id === 'FastEthernet0' ? { ...p, connectedTo: { nodeId: 'switch0', portId: 'FastEthernet0/2' } } : p
      ),
      arpTable: {},
      status: 'idle',
    },
  },
  {
    id: 'server0',
    type: 'networkDevice',
    position: { x: 680, y: 200 },
    data: {
      id: 'server0',
      name: 'Server0',
      type: 'server',
      model: 'Server-PT',
      ip: '192.168.1.100',
      subnetMask: '255.255.255.0',
      gateway: '192.168.1.1',
      mac: generateMac('server'),
      ports: getDefaultPorts('server').map((p) =>
        p.id === 'FastEthernet0' ? { ...p, connectedTo: { nodeId: 'switch0', portId: 'FastEthernet0/3' } } : p
      ),
      arpTable: {},
      status: 'idle',
    },
  },
];

const createInitialEdges = (): AppEdge[] => [
  {
    id: 'cable-pc0-switch0',
    source: 'pc0',
    target: 'switch0',
    sourceHandle: 'right',
    targetHandle: 'left',
    type: 'dataCable',
    data: {
      sourcePortId: 'FastEthernet0',
      sourcePortName: 'FastEthernet0',
      targetPortId: 'FastEthernet0/1',
      targetPortName: 'FastEthernet0/1',
      cableType: 'straight',
      sourceStatus: 'up',
      targetStatus: 'up',
      isLinkUp: true,
    },
  },
  {
    id: 'cable-pc1-switch0',
    source: 'pc1',
    target: 'switch0',
    sourceHandle: 'right',
    targetHandle: 'left',
    type: 'dataCable',
    data: {
      sourcePortId: 'FastEthernet0',
      sourcePortName: 'FastEthernet0',
      targetPortId: 'FastEthernet0/2',
      targetPortName: 'FastEthernet0/2',
      cableType: 'straight',
      sourceStatus: 'up',
      targetStatus: 'up',
      isLinkUp: true,
    },
  },
  {
    id: 'cable-server0-switch0',
    source: 'switch0',
    target: 'server0',
    sourceHandle: 'right',
    targetHandle: 'left',
    type: 'dataCable',
    data: {
      sourcePortId: 'FastEthernet0/3',
      sourcePortName: 'FastEthernet0/3',
      targetPortId: 'FastEthernet0',
      targetPortName: 'FastEthernet0',
      cableType: 'straight',
      sourceStatus: 'up',
      targetStatus: 'up',
      isLinkUp: true,
    },
  },
];

function NetworkCanvasContent() {
  const [nodes, setNodes, onNodesChange] = useNodesState<AppNode>(createInitialNodes());
  const [edges, setEdges, onEdgesChange] = useEdgesState<AppEdge>(createInitialEdges());
  const { screenToFlowPosition, fitView, zoomIn, zoomOut } = useReactFlow();

  // Cisco Packet Tracer Workspace Tools & Modes
  const [activeTool, setActiveTool] = useState<ActiveTool>('select');
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>('realtime');
  const [activeCableType, setActiveCableType] = useState<CableType | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Simple PDU Selection State
  const [pduSourceId, setPduSourceId] = useState<string | null>(null);

  // User Created PDUs & Simulation Events
  const [userPdus, setUserPdus] = useState<UserPdu[]>([]);
  const [simulationEvents, setSimulationEvents] = useState<SimulationEvent[]>([]);
  const [isEventPanelOpen, setIsEventPanelOpen] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);

  // PDU Information Modal State
  const [selectedPduInfo, setSelectedPduInfo] = useState<PduHeaderInfo | null>(null);
  const [isPduModalOpen, setIsPduModalOpen] = useState(false);
  const [simulationSpeed, setSimulationSpeed] = useState<number>(1);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  // Step-by-Step Simulation Plan for Simulation Mode
  const simPlanRef = useRef<SimPlanStep[]>([]);
  const currentStepIndexRef = useRef<number>(0);
  const activePduIdRef = useRef<string | null>(null);
  const isPlayingRef = useRef<boolean>(false);

  // Canvas Notes
  const [notes, setNotes] = useState<CanvasNote[]>([
    {
      id: 'note-1',
      text: 'Subnet 192.168.1.0/24\nFastEthernet Switching',
      x: 350,
      y: 90,
    },
  ]);

  // Modals & Panels State
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [isPingModalOpen, setIsPingModalOpen] = useState(false);
  const [isPresetsOpen, setIsPresetsOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isPinging, setIsPinging] = useState(false);

  // Port Wiring Mode State (Device A -> Device B)
  const [portModalDevice, setPortModalDevice] = useState<NetworkDeviceData | null>(null);
  const [pendingCableSource, setPendingCableSource] = useState<{
    deviceId: string;
    portId: string;
    portName: string;
  } | null>(null);

  // Toast Alert Banner
  const [toastAlert, setToastAlert] = useState<{
    type: 'success' | 'error';
    title: string;
    message: string;
  } | null>(null);

  // Undo History Stack
  interface TopologySnapshot {
    nodes: AppNode[];
    edges: AppEdge[];
    notes: CanvasNote[];
  }
  const [undoHistory, setUndoHistory] = useState<TopologySnapshot[]>([]);

  const pushUndoSnapshot = useCallback(() => {
    setUndoHistory((prev) => [
      ...prev.slice(-15),
      {
        nodes: JSON.parse(JSON.stringify(nodes)),
        edges: JSON.parse(JSON.stringify(edges)),
        notes: JSON.parse(JSON.stringify(notes)),
      },
    ]);
  }, [nodes, edges, notes]);

  const handleUndo = useCallback(() => {
    if (undoHistory.length === 0) return;
    const lastSnapshot = undoHistory[undoHistory.length - 1];
    setUndoHistory((prev) => prev.slice(0, prev.length - 1));
    setNodes(lastSnapshot.nodes);
    setEdges(lastSnapshot.edges);
    setNotes(lastSnapshot.notes);
    setToastAlert({
      type: 'success',
      title: 'Action Undone',
      message: 'Reverted to previous topology state.',
    });
  }, [undoHistory, setNodes, setEdges, setNotes]);

  // AI Diagnostics State
  const [isAiDiagOpen, setIsAiDiagOpen] = useState(false);
  const [aiReport, setAiReport] = useState<DiagnosticScanReport | null>(null);

  // AI Diagnostics Scanner Trigger
  const handleOpenAiDiagnostics = useCallback(() => {
    const report = runAiNetworkDiagnostics(
      nodes.map((n) => ({ id: n.id, data: n.data as unknown as NetworkDeviceData })),
      edges.map((e) => ({ id: e.id, source: e.source, target: e.target, data: e.data })),
      (updatedNodes) => {
        setNodes(updatedNodes as unknown as AppNode[]);
        const refreshed = runAiNetworkDiagnostics(
          updatedNodes,
          edges.map((e) => ({ id: e.id, source: e.source, target: e.target, data: e.data }))
        );
        setAiReport(refreshed);
        confetti({ particleCount: 30, spread: 60, origin: { y: 0.6 } });
        setToastAlert({
          type: 'success',
          title: 'Auto-Fix Applied',
          message: 'Network configuration updated by AI Copilot.',
        });
      }
    );
    setAiReport(report);
    setIsAiDiagOpen(true);
  }, [nodes, edges, setNodes]);

  // 2. Lab Persistence: Save Lab (.pkt.json)
  const handleSaveLab = useCallback(() => {
    const labData = {
      version: '1.0',
      type: 'cisco-packet-tracer-lab',
      savedAt: new Date().toISOString(),
      nodes,
      edges,
      notes,
    };
    const jsonStr = JSON.stringify(labData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cisco-lab-${Date.now()}.pkt.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setToastAlert({
      type: 'success',
      title: 'Lab Saved (.pkt.json)',
      message: 'Topology and device configurations exported to file.',
    });
  }, [nodes, edges, notes]);

  // 2. Lab Persistence: Open Lab (.pkt.json)
  const handleOpenLabFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = JSON.parse(content);
        if (parsed.nodes && Array.isArray(parsed.nodes)) {
          pushUndoSnapshot();
          setNodes(parsed.nodes);
          setEdges(parsed.edges || []);
          setNotes(parsed.notes || []);
          setToastAlert({
            type: 'success',
            title: 'Lab Loaded Successfully',
            message: `Restored ${parsed.nodes.length} devices and ${(parsed.edges || []).length} connections.`,
          });
        } else {
          throw new Error('Invalid .pkt.json format');
        }
      } catch {
        setToastAlert({
          type: 'error',
          title: 'Failed to Open Lab',
          message: 'The selected file is not a valid Cisco Packet Tracer lab JSON.',
        });
      }
    };
    reader.readAsText(file);
  }, [pushUndoSnapshot, setNodes, setEdges, setNotes]);

  // 2. Lab Persistence: Auto-Save every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      try {
        const autosaveData = {
          nodes,
          edges,
          notes,
          savedAt: Date.now(),
        };
        localStorage.setItem('cisco_packet_tracer_autosave', JSON.stringify(autosaveData));
      } catch (e) {
        console.warn('Auto-save write failed:', e);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [nodes, edges, notes]);

  // Restore from auto-save on initial mount if available
  useEffect(() => {
    try {
      const saved = localStorage.getItem('cisco_packet_tracer_autosave');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.nodes && parsed.nodes.length > 0) {
          setNodes(parsed.nodes);
          setEdges(parsed.edges || []);
          if (parsed.notes) setNotes(parsed.notes);
        }
      }
    } catch (e) {
      console.warn('Auto-save restore failed:', e);
    }
  }, []);

  // 4. Export Topology Diagram as High-Res PNG
  const handleExportImage = useCallback(() => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 1920;
    canvas.height = 1080;

    // Background
    ctx.fillStyle = '#eaedf2';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Subtle Grid
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Title Card
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.roundRect(40, 30, 620, 75, 12);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('CISCO PACKET TRACER LAB REPORT', 65, 65);
    ctx.fillStyle = '#38bdf8';
    ctx.font = '13px monospace';
    ctx.fillText(
      `Generated: ${new Date().toLocaleString()} · ${nodes.length} Devices · ${edges.length} Links`,
      65,
      90
    );

    // Map Coordinates
    const nodePosMap = new Map<string, { x: number; y: number }>();
    nodes.forEach((n) => {
      const x = Math.max(120, Math.min(canvas.width - 150, n.position.x + 350));
      const y = Math.max(160, Math.min(canvas.height - 150, n.position.y + 250));
      nodePosMap.set(n.id, { x, y });
    });

    // Draw Cables
    edges.forEach((e) => {
      const p1 = nodePosMap.get(e.source);
      const p2 = nodePosMap.get(e.target);
      if (p1 && p2) {
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();

        // Link Green LEDs
        ctx.fillStyle = '#22c55e';
        ctx.beginPath();
        ctx.arc(p1.x + (p2.x - p1.x) * 0.15, p1.y + (p2.y - p1.y) * 0.15, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(p2.x - (p2.x - p1.x) * 0.15, p2.y - (p2.y - p1.y) * 0.15, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // Draw Devices
    nodes.forEach((n) => {
      const pos = nodePosMap.get(n.id);
      if (!pos) return;
      const d = n.data as unknown as NetworkDeviceData;

      // Chassis Box
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(pos.x - 75, pos.y - 45, 150, 90, 10);
      ctx.fill();
      ctx.stroke();

      // Top Header Color Bar
      ctx.fillStyle =
        d.type === 'router'
          ? '#0284c7'
          : d.type === 'switch'
          ? '#059669'
          : d.type === 'server'
          ? '#7c3aed'
          : '#d97706';
      ctx.beginPath();
      ctx.roundRect(pos.x - 75, pos.y - 45, 150, 10, [10, 10, 0, 0]);
      ctx.fill();

      // Labels
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(d.name, pos.x, pos.y - 8);

      ctx.fillStyle = '#0284c7';
      ctx.font = 'bold 12px monospace';
      ctx.fillText(d.ip || 'No IP', pos.x, pos.y + 12);

      ctx.fillStyle = '#64748b';
      ctx.font = '10px monospace';
      ctx.fillText(d.type.toUpperCase(), pos.x, pos.y + 30);
    });

    // Trigger PNG Download
    const a = document.createElement('a');
    a.download = `cisco-topology-${Date.now()}.png`;
    a.href = canvas.toDataURL('image/png');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setToastAlert({
      type: 'success',
      title: 'Topology Diagram Exported',
      message: 'High-res diagram downloaded as PNG for lab reports.',
    });
  }, [nodes, edges]);

  // Timer tick for Packet Tracer elapsed time
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Keyboard shortcut listener (Esc to cancel active tool)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveTool('select');
        setPduSourceId(null);
        setPendingCableSource(null);
        setPortModalDevice(null);
        setActiveCableType(null);
        setToastAlert(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const selectedDevice = useMemo(() => {
    if (!selectedDeviceId) return null;
    const node = nodes.find((n) => n.id === selectedDeviceId);
    return node ? (node.data as unknown as NetworkDeviceData) : null;
  }, [selectedDeviceId, nodes]);

  // Handle Delete Tool on a Node (also frees ports on remote connected devices)
  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      pushUndoSnapshot();
      const connectedEdges = edges.filter((e) => e.source === nodeId || e.target === nodeId);
      const connectedNodeIds = new Set(connectedEdges.map((e) => (e.source === nodeId ? e.target : e.source)));

      setNodes((nds) =>
        nds
          .filter((n) => n.id !== nodeId)
          .map((n) => {
            if (connectedNodeIds.has(n.id)) {
              const updatedPorts = (n.data.ports || []).map((p) => {
                if (p.connectedTo?.nodeId === nodeId) {
                  return { ...p, connectedTo: null };
                }
                return p;
              });
              return { ...n, data: { ...n.data, ports: updatedPorts } };
            }
            return n;
          })
      );
      setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
      if (selectedDeviceId === nodeId) setSelectedDeviceId(null);
      if (pduSourceId === nodeId) setPduSourceId(null);
      if (pendingCableSource?.deviceId === nodeId) setPendingCableSource(null);
      setToastAlert({
        type: 'success',
        title: 'Device Deleted',
        message: `Removed ${nodeId} from topology.`,
      });
    },
    [selectedDeviceId, pduSourceId, pendingCableSource, nodes, edges, setNodes, setEdges, pushUndoSnapshot]
  );

  // Handle Delete Tool on an Edge (releases connected ports on both devices)
  const handleDeleteEdge = useCallback(
    (edgeId: string) => {
      pushUndoSnapshot();
      const edge = edges.find((e) => e.id === edgeId);
      if (edge) {
        setNodes((nds) =>
          nds.map((n) => {
            if (n.id === edge.source || n.id === edge.target) {
              const updatedPorts = (n.data.ports || []).map((p) => {
                if (
                  p.id === edge.data?.sourcePortId ||
                  p.id === edge.data?.targetPortId ||
                  p.name === edge.data?.sourcePortName ||
                  p.name === edge.data?.targetPortName
                ) {
                  return { ...p, connectedTo: null };
                }
                return p;
              });
              return { ...n, data: { ...n.data, ports: updatedPorts } };
            }
            return n;
          })
        );
      }
      setEdges((eds) => eds.filter((e) => e.id !== edgeId));
      setToastAlert({
        type: 'success',
        title: 'Cable Removed',
        message: `Removed cable and freed interfaces.`,
      });
    },
    [edges, setEdges, setNodes, pushUndoSnapshot]
  );

  // Add Note on canvas
  const handleAddNote = useCallback(
    (x: number, y: number) => {
      pushUndoSnapshot();
      const newNote: CanvasNote = {
        id: `note-${Date.now()}`,
        text: 'New Subnet Note',
        x,
        y,
      };
      setNotes((prev) => [...prev, newNote]);
      setActiveTool('select');
    },
    [pushUndoSnapshot]
  );

  // Handle canvas click
  const handlePaneClick = useCallback(
    (e: React.MouseEvent) => {
      if (activeTool === 'note') {
        const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
        handleAddNote(pos.x, pos.y);
      } else if (activeTool === 'pdu' && pduSourceId) {
        setPduSourceId(null);
        setToastAlert(null);
      }
    },
    [activeTool, pduSourceId, screenToFlowPosition, handleAddNote]
  );

  // Handle Tapping a Device while Cable Tool is Active (Port-Based Wiring Flow)
  const handleDeviceCableClick = useCallback(
    (deviceId: string) => {
      const targetNode = nodes.find((n) => n.id === deviceId);
      if (!targetNode) return;
      const targetDev = targetNode.data as unknown as NetworkDeviceData;

      if (!pendingCableSource) {
        // Step 1: User tapped Device A -> Show popup of Device A's available ports
        setPortModalDevice(targetDev);
      } else {
        // Step 2: User tapped Device B (or same device)
        if (pendingCableSource.deviceId === deviceId) {
          // Tapped same device: let user pick a different port or keep
          setPortModalDevice(targetDev);
          return;
        }

        // Check if a cable already directly connects these two devices
        const alreadyConnected = edges.some(
          (e) =>
            (e.source === pendingCableSource.deviceId && e.target === deviceId) ||
            (e.source === deviceId && e.target === pendingCableSource.deviceId)
        );

        if (alreadyConnected) {
          setToastAlert({
            type: 'error',
            title: 'Cable Already Exists',
            message: `A cable already connects ${pendingCableSource.deviceId} and ${targetDev.name}.`,
          });
          return;
        }

        // Show popup of Device B's available ports
        setPortModalDevice(targetDev);
      }
    },
    [nodes, edges, pendingCableSource]
  );

  // Handle Selecting a Specific Interface from PortSelectionModal
  const handleSelectPort = useCallback(
    (portId: string) => {
      if (!portModalDevice) return;

      if (!pendingCableSource) {
        // Step 1: Picked outbound port on Device A
        const portA = portModalDevice.ports?.find((p) => p.id === portId);
        const portName = portA?.name || portId;
        setPendingCableSource({
          deviceId: portModalDevice.id,
          portId,
          portName,
        });
        setPortModalDevice(null);
        setToastAlert({
          type: 'success',
          title: 'Plugged Port A',
          message: `Connected cable to ${portModalDevice.name} [${portName}]. Now tap Device B to select destination interface.`,
        });
      } else {
        // Step 2: Picked destination port on Device B -> Create authentic cable connection!
        const sourceDevId = pendingCableSource.deviceId;
        const sourcePortId = pendingCableSource.portId;
        const sourcePortName = pendingCableSource.portName;

        const targetDevId = portModalDevice.id;
        const targetPortId = portId;
        const portB = portModalDevice.ports?.find((p) => p.id === portId);
        const targetPortName = portB?.name || portId;

        const sourceNode = nodes.find((n) => n.id === sourceDevId);
        const targetNode = nodes.find((n) => n.id === targetDevId);
        const portA = sourceNode?.data.ports?.find((p) => p.id === sourcePortId);

        pushUndoSnapshot();

        const newEdgeId = `cable-${sourceDevId}-${targetDevId}-${Date.now()}`;
        const newEdge: AppEdge = {
          id: newEdgeId,
          source: sourceDevId,
          target: targetDevId,
          sourceHandle: 'right',
          targetHandle: 'left',
          type: 'dataCable',
          data: {
            sourcePortId,
            sourcePortName,
            targetPortId,
            targetPortName,
            cableType: activeCableType || 'straight',
          },
        };

        // Update connectedTo on both devices' ports in nodes
        setNodes((nds) =>
          nds.map((n) => {
            if (n.id === sourceDevId) {
              const updatedPorts = (n.data.ports || []).map((p) =>
                p.id === sourcePortId || p.name === sourcePortName
                  ? { ...p, connectedTo: { nodeId: targetDevId, portId: targetPortId, edgeId: newEdgeId } }
                  : p
              );
              return { ...n, data: { ...n.data, ports: updatedPorts } };
            }
            if (n.id === targetDevId) {
              const updatedPorts = (n.data.ports || []).map((p) =>
                p.id === targetPortId || p.name === targetPortName
                  ? { ...p, connectedTo: { nodeId: sourceDevId, portId: sourcePortId, edgeId: newEdgeId } }
                  : p
              );
              return { ...n, data: { ...n.data, ports: updatedPorts } };
            }
            return n;
          })
        );

        setEdges((eds) => addEdge(newEdge, eds));
        setPendingCableSource(null);
        setPortModalDevice(null);
        setActiveCableType(null);

        const isUpA = portA?.status === 'up';
        const isUpB = portB?.status === 'up';
        const isBothUp = isUpA && isUpB;

        setToastAlert({
          type: 'success',
          title: isBothUp ? 'Link Up (Green LEDs)' : 'Cable Connected (Waiting for no shutdown)',
          message: isBothUp
            ? `Connected ${sourceNode?.data.name || sourceDevId} [${sourcePortName}] to ${portModalDevice.name} [${targetPortName}]. Link status: UP.`
            : `Connected ${sourceNode?.data.name || sourceDevId} [${sourcePortName}] to ${portModalDevice.name} [${targetPortName}]. Link LED is Red until 'no shutdown' is run.`,
        });
      }
    },
    [portModalDevice, pendingCableSource, activeCableType, nodes, pushUndoSnapshot, setNodes, setEdges]
  );

  // Fallback direct handle connection
  const handlePortClick = useCallback(
    (nodeId: string, portId: string) => {
      handleDeviceCableClick(nodeId);
    },
    [handleDeviceCableClick]
  );

  // Drag-and-drop wiring
  const onConnect = useCallback(
    (connection: Connection) => {
      const newEdge: AppEdge = {
        ...connection,
        id: `cable-${connection.source}-${connection.target}-${Date.now()}`,
        type: 'dataCable',
        data: {
          sourcePortId: connection.sourceHandle?.replace('-source', '') || 'port',
          targetPortId: connection.targetHandle?.replace('-target', '') || 'port',
          cableType: activeCableType || 'straight',
        },
      };
      setEdges((eds) => addEdge(newEdge, eds));
    },
    [activeCableType, setEdges]
  );

  // Reset edge packet animations
  const resetEdgeAnimations = useCallback(() => {
    setEdges((eds) =>
      eds.map((e) => ({
        ...e,
        data: {
          ...e.data,
          isPinging: false,
          pingStatus: undefined,
          packetType: undefined,
          pduInfo: undefined,
        },
      }))
    );
  }, [setEdges]);

  // Execute 1 step in simulation mode
  const executeSimulationStep = useCallback(async (step: SimPlanStep) => {
    await step.action();
    const eventTime = `${((step.stepNumber - 1) * 0.5).toFixed(3)}s`;
    setSimulationEvents((prev) => [...prev, {
      id: `evt-${step.stepNumber}-${Date.now()}`,
      step: step.stepNumber,
      time: eventTime,
      lastDevice: step.lastDevice,
      atDevice: step.atDevice,
      type: step.type,
      info: step.info,
      status: step.status,
      pduInfo: step.pduInfo,
    }]);

    // Visually flag dropped node with red pop animation badge
    if (step.status === 'failed') {
      setNodes((nds) =>
        nds.map((n) =>
          n.data.name === step.atDevice || n.id === step.atDevice
            ? { ...n, data: { ...n.data, pingRoleState: 'dropped' } }
            : n
        )
      );
    }
  }, [setNodes]);

  // Step forward button handler
  const handleStepForward = useCallback(async () => {
    if (simPlanRef.current.length === 0) return;
    if (currentStepIndexRef.current >= simPlanRef.current.length) {
      setToastAlert({
        type: 'success',
        title: 'Simulation Complete',
        message: 'All packet transmission events for this PDU have completed.',
      });
      return;
    }

    const nextStep = simPlanRef.current[currentStepIndexRef.current];
    currentStepIndexRef.current += 1;
    await executeSimulationStep(nextStep);

    if (currentStepIndexRef.current >= simPlanRef.current.length) {
      setIsSimulating(false);
      isPlayingRef.current = false;
      if (activePduIdRef.current) {
        setUserPdus((prev) =>
          prev.map((p) =>
            p.id === activePduIdRef.current ? { ...p, fireStatus: nextStep.status === 'failed' ? 'Failed' : 'Successful' } : p
          )
        );
      }
    }
  }, [executeSimulationStep]);

  // Play / Pause Auto-Capture Handler
  const handlePlayPause = useCallback(async () => {
    if (isPlayingRef.current) {
      // Pause
      isPlayingRef.current = false;
      setIsSimulating(false);
      return;
    }

    if (simPlanRef.current.length === 0) return;

    isPlayingRef.current = true;
    setIsSimulating(true);

    while (isPlayingRef.current && currentStepIndexRef.current < simPlanRef.current.length) {
      const step = simPlanRef.current[currentStepIndexRef.current];
      currentStepIndexRef.current += 1;
      await executeSimulationStep(step);
      await new Promise((res) => setTimeout(res, 1200 / simulationSpeed));
    }

    if (currentStepIndexRef.current >= simPlanRef.current.length) {
      setIsSimulating(false);
      isPlayingRef.current = false;
      const lastStep = simPlanRef.current[simPlanRef.current.length - 1];
      if (activePduIdRef.current) {
        setUserPdus((prev) =>
          prev.map((p) =>
            p.id === activePduIdRef.current ? { ...p, fireStatus: lastStep?.status === 'failed' ? 'Failed' : 'Successful' } : p
          )
        );
      }
    }
  }, [executeSimulationStep, simulationSpeed]);

  // Reset Simulation
  const handleResetSimulation = useCallback(() => {
    isPlayingRef.current = false;
    setIsSimulating(false);
    currentStepIndexRef.current = 0;
    resetEdgeAnimations();
    setSimulationEvents([]);
    setSelectedEventId(null);
    setNodes((nds) =>
      nds.map((n) => ({ ...n, data: { ...n.data, pingRoleState: 'idle' } }))
    );
  }, [resetEdgeAnimations, setNodes]);

  // Main PDU Simulation Runner
  const runPduSimulation = useCallback(
    async (sourceId: string, destId: string): Promise<PingSimulationResult> => {
      setIsPinging(true);
      resetEdgeAnimations();

      const srcNode = nodes.find((n) => n.id === sourceId);
      const dstNode = nodes.find((n) => n.id === destId);
      const srcDev = (srcNode?.data as unknown as NetworkDeviceData) || {
        id: sourceId,
        name: sourceId,
        ip: '192.168.1.10',
        mac: '00:1A:2B:3C:4D:5E',
        type: 'pc' as DeviceType,
      };
      const dstDev = (dstNode?.data as unknown as NetworkDeviceData) || {
        id: destId,
        name: destId,
        ip: '192.168.1.20',
        mac: '00:1B:3C:4D:5E:6F',
        type: 'pc' as DeviceType,
      };

      // Add Row to User Created PDU List (Bottom Simulation Panel)
      const pduId = `pdu-${Date.now()}`;
      activePduIdRef.current = pduId;

      const newPdu: UserPdu = {
        id: pduId,
        sourceId,
        destId,
        sourceName: srcDev.name,
        destName: dstDev.name,
        sourceIp: srcDev.ip || '0.0.0.0',
        destIp: dstDev.ip || '0.0.0.0',
        sourceMac: srcDev.mac,
        destMac: dstDev.mac,
        type: 'ICMP',
        fireStatus: 'In Progress',
        color: '#facc15',
        time: `${elapsedSeconds}s`,
      };
      setUserPdus((prev) => [newPdu, ...prev]);
      setIsEventPanelOpen(true);

      const graphNodes = nodes.map((n) => {
        const d = n.data as unknown as NetworkDeviceData;
        return {
          id: n.id,
          data: {
            type: d.type as DeviceType,
            ip: d.ip,
            subnetMask: d.subnetMask,
            gateway: d.gateway,
            name: d.name,
          },
        };
      });

      const graphEdges = edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
      }));

      const result = evaluatePing(graphNodes, graphEdges, sourceId, destId);
      const isSameSubnet = checkAreInSameSubnet(srcDev.ip, srcDev.subnetMask || '255.255.255.0', dstDev.ip, dstDev.subnetMask || '255.255.255.0').isSame;
      const pathResult = findPath(graphNodes, graphEdges, sourceId, destId);

      // Find switch in path if applicable
      const switchNode = nodes.find((n) => n.data.type === 'switch' || n.data.type === 'hub');
      const switchId = switchNode?.id || 'switch0';
      const switchName = switchNode?.data.name || 'Switch0';

      // Find all cables connected to switch for ARP broadcast
      const allSwitchEdges = edges.filter(
        (e) => e.source === switchId || e.target === switchId
      );
      const srcSwitchEdge = edges.find(
        (e) => (e.source === sourceId && e.target === switchId) || (e.target === sourceId && e.source === switchId)
      );
      const dstSwitchEdge = edges.find(
        (e) => (e.source === destId && e.target === switchId) || (e.target === destId && e.source === switchId)
      );
      const otherSwitchEdges = allSwitchEdges.filter(
        (e) => e.id !== srcSwitchEdge?.id && e.id !== dstSwitchEdge?.id
      );

      // Construct Complete Simulation Plan
      const plan: SimPlanStep[] = [];
      let stepCounter = 1;

      if (!result.success || !pathResult) {
        // Failed case (Subnet mismatch or no connection or interface shutdown)
        const pduDropInfo = createPduHeaderInfo(
          srcDev.name,
          srcDev.type,
          'ICMP',
          'ICMP Echo Request (Drop)',
          srcDev,
          dstDev,
          'icmp_req',
          true
        );

        plan.push({
          stepNumber: stepCounter++,
          lastDevice: srcDev.name,
          atDevice: srcDev.name,
          type: 'ICMP',
          info: result.details[result.details.length - 1] || result.message,
          status: 'failed',
          pduInfo: pduDropInfo,
          action: async () => {
            if (srcSwitchEdge) {
              setEdges((eds) =>
                eds.map((e) =>
                  e.id === srcSwitchEdge.id
                    ? { ...e, data: { ...e.data, isPinging: true, pingStatus: 'dropped', pduInfo: pduDropInfo } }
                    : e
                )
              );
            }
          },
        });
      } else if (isSameSubnet) {
        // --- INTRA-SUBNET L2 SWITCHING FLOW ---
        const isArpKnown = !!srcDev.arpTable?.[dstDev.ip];

        if (!isArpKnown) {
          // Step 1: ARP Request from Source PC to Switch
          const arp1Info = createPduHeaderInfo(
            srcDev.name,
            srcDev.type,
            'ARP',
            'ARP Request',
            srcDev,
            dstDev,
            'arp_req'
          );

          plan.push({
            stepNumber: stepCounter++,
            lastDevice: srcDev.name,
            atDevice: switchName,
            type: 'ARP',
            info: `ARP Request: Who has ${dstDev.ip}? Tell ${srcDev.ip} (${srcDev.mac})`,
            status: 'in_progress',
            pduInfo: arp1Info,
            action: async () => {
              if (srcSwitchEdge) {
                setEdges((eds) =>
                  eds.map((e) =>
                    e.id === srcSwitchEdge.id
                      ? {
                          ...e,
                          data: {
                            ...e.data,
                            isPinging: true,
                            packetType: 'ARP',
                            pingDirection: e.source === sourceId ? 'forward' : 'backward',
                            pduInfo: arp1Info,
                          },
                        }
                      : e
                  )
                );
              }
            },
          });

          // Step 2: Switch floods ARP Broadcast to ALL active switch ports except incoming!
          const arpBroadcastInfo = createPduHeaderInfo(
            switchName,
            'switch',
            'ARP',
            'ARP Broadcast Flood',
            srcDev,
            dstDev,
            'arp_broadcast'
          );

          plan.push({
            stepNumber: stepCounter++,
            lastDevice: switchName,
            atDevice: `${dstDev.name} & Switch Ports`,
            type: 'ARP',
            info: `Switch floods ARP broadcast out all active ports (${allSwitchEdges.length - 1} ports)`,
            status: 'in_progress',
            pduInfo: arpBroadcastInfo,
            action: async () => {
              setEdges((eds) =>
                eds.map((e) => {
                  if (e.id === dstSwitchEdge?.id) {
                    // Destination cable (accepts ARP)
                    return {
                      ...e,
                      data: {
                        ...e.data,
                        isPinging: true,
                        packetType: 'ARP',
                        pingDirection: e.source === switchId ? 'forward' : 'backward',
                        pduInfo: arpBroadcastInfo,
                      },
                    };
                  }
                  if (otherSwitchEdges.some((oe) => oe.id === e.id)) {
                    // Other devices receive broadcast and drop
                    return {
                      ...e,
                      data: {
                        ...e.data,
                        isPinging: true,
                        packetType: 'ARP',
                        pingDirection: e.source === switchId ? 'forward' : 'backward',
                        pingStatus: 'dropped',
                        pduInfo: arpBroadcastInfo,
                      },
                    };
                  }
                  return { ...e, data: { ...e.data, isPinging: false } };
                })
              );
            },
          });

          // Step 3: ARP Reply from Destination PC to Switch -> Source PC
          const arpReplyInfo = createPduHeaderInfo(
            dstDev.name,
            dstDev.type,
            'ARP',
            'ARP Reply',
            srcDev,
            dstDev,
            'arp_reply'
          );

          plan.push({
            stepNumber: stepCounter++,
            lastDevice: dstDev.name,
            atDevice: srcDev.name,
            type: 'ARP',
            info: `ARP Reply: ${dstDev.ip} is at ${dstDev.mac}. ARP table updated.`,
            status: 'success',
            pduInfo: arpReplyInfo,
            action: async () => {
              // Update ARP table in state for both devices
              setNodes((nds) =>
                nds.map((n) => {
                  if (n.id === sourceId) {
                    return {
                      ...n,
                      data: {
                        ...n.data,
                        arpTable: { ...(n.data.arpTable || {}), [dstDev.ip]: dstDev.mac },
                      },
                    };
                  }
                  if (n.id === destId) {
                    return {
                      ...n,
                      data: {
                        ...n.data,
                        arpTable: { ...(n.data.arpTable || {}), [srcDev.ip]: srcDev.mac },
                      },
                    };
                  }
                  return n;
                })
              );

              setEdges((eds) =>
                eds.map((e) => {
                  if (e.id === dstSwitchEdge?.id || e.id === srcSwitchEdge?.id) {
                    return {
                      ...e,
                      data: {
                        ...e.data,
                        isPinging: true,
                        packetType: 'ARP',
                        pingDirection: 'backward',
                        pingStatus: undefined,
                        pduInfo: arpReplyInfo,
                      },
                    };
                  }
                  return { ...e, data: { ...e.data, isPinging: false, pingStatus: undefined } };
                })
              );
            },
          });
        }

        // Step 4: ICMP Echo Request (PC0 -> Switch -> PC1)
        const icmpReqInfo = createPduHeaderInfo(
          srcDev.name,
          srcDev.type,
          'ICMP',
          'ICMP Echo Request',
          srcDev,
          dstDev,
          'icmp_req'
        );

        plan.push({
          stepNumber: stepCounter++,
          lastDevice: srcDev.name,
          atDevice: dstDev.name,
          type: 'ICMP',
          info: `ICMP Echo Request: Src ${srcDev.ip}, Dst ${dstDev.ip} (Dest MAC: ${dstDev.mac})`,
          status: 'in_progress',
          pduInfo: icmpReqInfo,
          action: async () => {
            setEdges((eds) =>
              eds.map((e) => {
                if (result.edgesInPath.includes(e.id)) {
                  return {
                    ...e,
                    data: {
                      ...e.data,
                      isPinging: true,
                      packetType: 'ICMP',
                      pingDirection: 'forward',
                      pingStatus: undefined,
                      pduInfo: icmpReqInfo,
                    },
                  };
                }
                return e;
              })
            );
          },
        });

        // Step 5: ICMP Echo Reply (PC1 -> Switch -> PC0)
        const icmpReplyInfo = createPduHeaderInfo(
          dstDev.name,
          dstDev.type,
          'ICMP',
          'ICMP Echo Reply',
          srcDev,
          dstDev,
          'icmp_reply'
        );

        plan.push({
          stepNumber: stepCounter++,
          lastDevice: dstDev.name,
          atDevice: srcDev.name,
          type: 'ICMP',
          info: `ICMP Echo Reply received at ${srcDev.name} (0% packet loss, RTT=${result.latencyMs}ms)`,
          status: 'success',
          pduInfo: icmpReplyInfo,
          action: async () => {
            setEdges((eds) =>
              eds.map((e) => {
                if (result.edgesInPath.includes(e.id)) {
                  return {
                    ...e,
                    data: {
                      ...e.data,
                      isPinging: true,
                      packetType: 'ICMP',
                      pingDirection: 'backward',
                      pingStatus: undefined,
                      pduInfo: icmpReplyInfo,
                    },
                  };
                }
                return e;
              })
            );
          },
        });
      } else {
        // --- INTER-SUBNET ROUTING VIA DEFAULT GATEWAY ---
        const routerNode = nodes.find((n) => n.data.type === 'router');
        const routerDev = routerNode?.data as unknown as NetworkDeviceData | undefined;
        const routerName = routerDev?.name || 'Router0';

        if (!srcDev.gateway) {
          const noGwInfo = createPduHeaderInfo(
            srcDev.name,
            srcDev.type,
            'ICMP',
            'No Default Gateway (Drop)',
            srcDev,
            dstDev,
            'icmp_req',
            true
          );
          plan.push({
            stepNumber: stepCounter++,
            lastDevice: srcDev.name,
            atDevice: srcDev.name,
            type: 'ICMP',
            info: `Routing Failure: No Default Gateway configured on ${srcDev.name}. Cannot route outside subnet.`,
            status: 'failed',
            pduInfo: noGwInfo,
            action: async () => {},
          });
        } else if (!routerDev) {
          const noRouterInfo = createPduHeaderInfo(
            srcDev.name,
            srcDev.type,
            'ICMP',
            'No Router in Path (Drop)',
            srcDev,
            dstDev,
            'icmp_req',
            true
          );
          plan.push({
            stepNumber: stepCounter++,
            lastDevice: srcDev.name,
            atDevice: srcDev.name,
            type: 'ICMP',
            info: `Routing Failure: Subnet mismatch and no Router present in topology to route packets.`,
            status: 'failed',
            pduInfo: noRouterInfo,
            action: async () => {},
          });
        } else {
          // Check Router interface status
          const gwPort = routerDev.ports?.find((p) => p.ip === srcDev.gateway);
          const isGwPortDown = gwPort && gwPort.status === 'admin_down';

          if (isGwPortDown) {
            const dropInfo = createPduHeaderInfo(
              routerName,
              'router',
              'ICMP',
              'Router Interface Shutdown (Drop)',
              srcDev,
              dstDev,
              'icmp_req',
              true
            );
            plan.push({
              stepNumber: stepCounter++,
              lastDevice: srcDev.name,
              atDevice: routerName,
              type: 'ICMP',
              info: `Request timed out: ${routerName} interface ${gwPort?.name} is administratively down (shutdown).`,
              status: 'failed',
              pduInfo: dropInfo,
              action: async () => {},
            });
          } else {
            // Forward to Gateway
            const icmpToGwInfo = createPduHeaderInfo(
              srcDev.name,
              srcDev.type,
              'ICMP',
              'Forward to Gateway',
              srcDev,
              dstDev,
              'icmp_req'
            );
            plan.push({
              stepNumber: stepCounter++,
              lastDevice: srcDev.name,
              atDevice: routerName,
              type: 'ICMP',
              info: `L3 Routing: ${srcDev.name} forwards packet to Default Gateway (${srcDev.gateway}) on ${routerName}`,
              status: 'in_progress',
              pduInfo: icmpToGwInfo,
              action: async () => {
                setEdges((eds) =>
                  eds.map((e) => {
                    if (result.edgesInPath.slice(0, 2).includes(e.id)) {
                      return {
                        ...e,
                        data: {
                          ...e.data,
                          isPinging: true,
                          packetType: 'ICMP',
                          pingDirection: 'forward',
                          pduInfo: icmpToGwInfo,
                        },
                      };
                    }
                    return e;
                  })
                );
              },
            });

            // Router routes across subnets towards destination
            const icmpFromRouterInfo = createPduHeaderInfo(
              routerName,
              'router',
              'ICMP',
              'L3 Route Forward',
              srcDev,
              dstDev,
              'icmp_req'
            );
            plan.push({
              stepNumber: stepCounter++,
              lastDevice: routerName,
              atDevice: dstDev.name,
              type: 'ICMP',
              info: `${routerName} routes packet across subnets towards ${dstDev.name} (${dstDev.ip})`,
              status: 'in_progress',
              pduInfo: icmpFromRouterInfo,
              action: async () => {
                setEdges((eds) =>
                  eds.map((e) => {
                    if (result.edgesInPath.includes(e.id)) {
                      return {
                        ...e,
                        data: {
                          ...e.data,
                          isPinging: true,
                          packetType: 'ICMP',
                          pingDirection: 'forward',
                          pduInfo: icmpFromRouterInfo,
                        },
                      };
                    }
                    return e;
                  })
                );
              },
            });

            // ICMP Echo Reply returned back through router
            const icmpReplyRoutedInfo = createPduHeaderInfo(
              dstDev.name,
              dstDev.type,
              'ICMP',
              'ICMP Echo Reply (Routed)',
              srcDev,
              dstDev,
              'icmp_reply'
            );
            plan.push({
              stepNumber: stepCounter++,
              lastDevice: dstDev.name,
              atDevice: srcDev.name,
              type: 'ICMP',
              info: `ICMP Echo Reply received via ${routerName} gateway (0% packet loss, RTT=${result.latencyMs}ms)`,
              status: 'success',
              pduInfo: icmpReplyRoutedInfo,
              action: async () => {
                setEdges((eds) =>
                  eds.map((e) => {
                    if (result.edgesInPath.includes(e.id)) {
                      return {
                        ...e,
                        data: {
                          ...e.data,
                          isPinging: true,
                          packetType: 'ICMP',
                          pingDirection: 'backward',
                          pduInfo: icmpReplyRoutedInfo,
                        },
                      };
                    }
                    return e;
                  })
                );
              },
            });
          }
        }
      }

      simPlanRef.current = plan;
      currentStepIndexRef.current = 0;

      // Handle Realtime Mode vs Simulation Mode
      if (workspaceMode === 'realtime') {
        setIsSimulating(true);
        // Execute steps sequentially with realistic network latency delays
        for (const step of plan) {
          await executeSimulationStep(step);
          await new Promise((res) => setTimeout(res, 900));
        }

        setIsSimulating(false);
        setIsPinging(false);
        resetEdgeAnimations();

        const last = plan[plan.length - 1];
        setUserPdus((prev) =>
          prev.map((p) =>
            p.id === pduId ? { ...p, fireStatus: last?.status === 'failed' ? 'Failed' : 'Successful' } : p
          )
        );

        if (result.success) {
          try {
            confetti({
              particleCount: 35,
              spread: 45,
              origin: { y: 0.85 },
              colors: ['#0284c7', '#22c55e', '#facc15'],
            });
          } catch {}

          setToastAlert({
            type: 'success',
            title: 'Simple PDU Successful',
            message: `ICMP Echo reply received from ${result.destIp} at ${srcDev.name}. 0% packet loss.`,
          });
        } else {
          setToastAlert({
            type: 'error',
            title: 'Destination Host Unreachable',
            message: result.details[result.details.length - 1] || result.message,
          });
        }
      } else {
        // Simulation Mode: Load Step 1 and pause for user interaction
        setIsSimulating(false);
        setIsPinging(false);
        if (plan.length > 0) {
          const firstStep = plan[0];
          currentStepIndexRef.current = 1;
          await executeSimulationStep(firstStep);
        }
        setToastAlert({
          type: 'success',
          title: 'Simulation Ready',
          message: 'Click "Auto Capture / Play" or "Capture / Forward" in the bottom dock to step through packet hops.',
        });
      }

      setActiveTool('select');
      return result;
    },
    [nodes, edges, workspaceMode, elapsedSeconds, executeSimulationStep, resetEdgeAnimations, setEdges, setNodes]
  );

  // Add Simple PDU Click Handler on Nodes
  const handlePduSelect = useCallback(
    (nodeId: string) => {
      if (!pduSourceId) {
        // Step 1: Select Source Host
        setPduSourceId(nodeId);
        const name = nodes.find((n) => n.id === nodeId)?.data.name || nodeId;
        setToastAlert({
          type: 'success',
          title: 'Source PDU Selected',
          message: `Selected ${name} as Source. Now click Destination host to fire Simple PDU.`,
        });
      } else {
        // Step 2: Select Destination Host
        if (pduSourceId === nodeId) {
          setPduSourceId(null);
          setToastAlert(null);
          return;
        }

        const src = pduSourceId;
        setPduSourceId(null);
        runPduSimulation(src, nodeId);
      }
    },
    [pduSourceId, nodes, runPduSimulation]
  );

  // Add Device from Cisco Device Shelf (Automatically places in center of canvas viewport)
  const handleAddDevice = useCallback(
    (type: DeviceType, model?: string) => {
      pushUndoSnapshot();

      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;
      const centerPos = screenToFlowPosition({ x: centerX, y: centerY });
      const jitterX = (Math.random() - 0.5) * 40;
      const jitterY = (Math.random() - 0.5) * 40;

      const existingOfType = nodes.filter((n) => n.data.type === type).length;
      const count = existingOfType;
      const id = `${type}${Date.now().toString().slice(-4)}`;

      let name = '';
      let defaultIp = '';
      let defaultSubnet = '255.255.255.0';
      let defaultGateway = '192.168.1.1';

      switch (type) {
        case 'router':
          name = `Router${count}`;
          defaultIp = `192.168.1.1`;
          defaultGateway = '';
          break;
        case 'switch':
          name = `Switch${count}`;
          defaultIp = '';
          defaultGateway = '';
          break;
        case 'hub':
          name = `Hub${count}`;
          defaultIp = '';
          defaultGateway = '';
          break;
        case 'laptop':
          name = `Laptop${count}`;
          defaultIp = `192.168.1.${30 + count}`;
          break;
        case 'server':
          name = `Server${count}`;
          defaultIp = `192.168.1.${100 + count}`;
          break;
        case 'pc':
        default:
          name = `PC${count}`;
          defaultIp = `192.168.1.${10 + count}`;
          break;
      }

      const newNode: AppNode = {
        id,
        type: 'networkDevice',
        position: {
          x: Math.round(centerPos.x + jitterX),
          y: Math.round(centerPos.y + jitterY),
        },
        data: {
          id,
          name,
          type,
          model: model || (type === 'router' ? '1941' : type === 'switch' ? '2960' : 'PT'),
          ip: defaultIp,
          subnetMask: defaultSubnet,
          gateway: defaultGateway,
          mac: generateMac(type),
          ports: getDefaultPorts(type),
          status: 'idle',
        },
      };

      setNodes((nds) => [...nds, newNode]);
      setToastAlert({
        type: 'success',
        title: `${name} Added to Canvas`,
        message: `Placed in center of workspace. Tap to configure or drag to reposition.`,
      });
    },
    [nodes, setNodes, screenToFlowPosition, pushUndoSnapshot]
  );

  // Desktop drag-and-drop placement
  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      try {
        const raw = event.dataTransfer.getData('application/reactflow');
        if (!raw) return;
        const { type, model } = JSON.parse(raw);
        const position = screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });

        const existingOfType = nodes.filter((n) => n.data.type === type).length;
        const count = existingOfType;
        const id = `${type}${Date.now().toString().slice(-4)}`;

        let name = `${type.toUpperCase()}${count}`;
        let defaultIp = type === 'pc' ? `192.168.1.${10 + count}` : type === 'router' ? '192.168.1.1' : '';

        const newNode: AppNode = {
          id,
          type: 'networkDevice',
          position,
          data: {
            id,
            name,
            type,
            model,
            ip: defaultIp,
            subnetMask: '255.255.255.0',
            gateway: '192.168.1.1',
            mac: generateMac(type),
            ports: getDefaultPorts(type),
            status: 'idle',
          },
        };

        setNodes((nds) => [...nds, newNode]);
      } catch {}
    },
    [screenToFlowPosition, nodes, setNodes]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  // Preset Topologies
  const handleLoadPreset = useCallback(
    (presetId: string) => {
      setIsPresetsOpen(false);
      setPduSourceId(null);
      setSimulationEvents([]);
      setUserPdus([]);
      resetEdgeAnimations();

      switch (presetId) {
        case 'empty':
          setNodes([]);
          setEdges([]);
          setNotes([]);
          break;

        case 'subnet-mismatch':
          setNodes([
            {
              id: 'switch0',
              type: 'networkDevice',
              position: { x: 380, y: 150 },
              data: {
                id: 'switch0',
                name: 'Switch0',
                type: 'switch',
                model: '2960',
                ip: '',
                subnetMask: '255.255.255.0',
                gateway: '',
                mac: generateMac('switch'),
                ports: getDefaultPorts('switch').map((p) => {
                  if (p.id === 'FastEthernet0/1') return { ...p, connectedTo: { nodeId: 'pc0', portId: 'FastEthernet0' } };
                  if (p.id === 'FastEthernet0/2') return { ...p, connectedTo: { nodeId: 'pc1', portId: 'FastEthernet0' } };
                  return p;
                }),
                status: 'idle',
              },
            },
            {
              id: 'pc0',
              type: 'networkDevice',
              position: { x: 120, y: 150 },
              data: {
                id: 'pc0',
                name: 'PC0',
                type: 'pc',
                model: 'PC-PT',
                ip: '192.168.1.10',
                subnetMask: '255.255.255.0',
                gateway: '',
                mac: generateMac('pc'),
                ports: getDefaultPorts('pc').map((p) =>
                  p.id === 'FastEthernet0' ? { ...p, connectedTo: { nodeId: 'switch0', portId: 'FastEthernet0/1' } } : p
                ),
                status: 'idle',
              },
            },
            {
              id: 'pc1',
              type: 'networkDevice',
              position: { x: 640, y: 150 },
              data: {
                id: 'pc1',
                name: 'PC1',
                type: 'pc',
                model: 'PC-PT',
                ip: '192.168.2.20',
                subnetMask: '255.255.255.0',
                gateway: '',
                mac: generateMac('pc'),
                ports: getDefaultPorts('pc').map((p) =>
                  p.id === 'FastEthernet0' ? { ...p, connectedTo: { nodeId: 'switch0', portId: 'FastEthernet0/2' } } : p
                ),
                status: 'idle',
              },
            },
          ]);
          setEdges([
            {
              id: 'cable-pc0-switch0',
              source: 'pc0',
              target: 'switch0',
              sourceHandle: 'right',
              targetHandle: 'left',
              type: 'dataCable',
              data: {
                sourcePortId: 'FastEthernet0',
                sourcePortName: 'FastEthernet0',
                targetPortId: 'FastEthernet0/1',
                targetPortName: 'FastEthernet0/1',
                cableType: 'straight',
                sourceStatus: 'up',
                targetStatus: 'up',
                isLinkUp: true,
              },
            },
            {
              id: 'cable-pc1-switch0',
              source: 'pc1',
              target: 'switch0',
              sourceHandle: 'right',
              targetHandle: 'left',
              type: 'dataCable',
              data: {
                sourcePortId: 'FastEthernet0',
                sourcePortName: 'FastEthernet0',
                targetPortId: 'FastEthernet0/2',
                targetPortName: 'FastEthernet0/2',
                cableType: 'straight',
                sourceStatus: 'up',
                targetStatus: 'up',
                isLinkUp: true,
              },
            },
          ]);
          setNotes([
            {
              id: 'note-mismatch',
              text: 'Subnet Isolation Test:\nPC0: 192.168.1.10/24\nPC1: 192.168.2.20/24\nLayer 2 Switch will NOT route across subnets.',
              x: 280,
              y: 70,
            },
          ]);
          break;

        case 'routed-gateway':
        case 'router-gateway':
          setNodes([
            {
              id: 'router0',
              type: 'networkDevice',
              position: { x: 380, y: 100 },
              data: {
                id: 'router0',
                name: 'Router0',
                type: 'router',
                model: '1941',
                ip: '192.168.1.1',
                subnetMask: '255.255.255.0',
                gateway: '',
                mac: generateMac('router'),
                ports: getDefaultPorts('router').map((p) => {
                  if (p.id === 'GigabitEthernet0/0') {
                    return {
                      ...p,
                      ip: '192.168.1.1',
                      subnetMask: '255.255.255.0',
                      status: 'admin_down' as const, // Starts shutdown!
                      connectedTo: { nodeId: 'switch0', portId: 'FastEthernet0/2' },
                    };
                  }
                  if (p.id === 'GigabitEthernet0/1') {
                    return {
                      ...p,
                      ip: '192.168.2.1',
                      subnetMask: '255.255.255.0',
                      status: 'admin_down' as const, // Starts shutdown!
                      connectedTo: { nodeId: 'server0', portId: 'FastEthernet0' },
                    };
                  }
                  return p;
                }),
                status: 'idle',
              },
            },
            {
              id: 'switch0',
              type: 'networkDevice',
              position: { x: 200, y: 260 },
              data: {
                id: 'switch0',
                name: 'Switch0',
                type: 'switch',
                model: '2960',
                ip: '',
                subnetMask: '255.255.255.0',
                gateway: '',
                mac: generateMac('switch'),
                ports: getDefaultPorts('switch').map((p) => {
                  if (p.id === 'FastEthernet0/1') return { ...p, connectedTo: { nodeId: 'pc0', portId: 'FastEthernet0' } };
                  if (p.id === 'FastEthernet0/2') return { ...p, connectedTo: { nodeId: 'router0', portId: 'GigabitEthernet0/0' } };
                  return p;
                }),
                status: 'idle',
              },
            },
            {
              id: 'pc0',
              type: 'networkDevice',
              position: { x: 60, y: 380 },
              data: {
                id: 'pc0',
                name: 'PC0',
                type: 'pc',
                model: 'PC-PT',
                ip: '192.168.1.10',
                subnetMask: '255.255.255.0',
                gateway: '192.168.1.1',
                mac: generateMac('pc'),
                ports: getDefaultPorts('pc').map((p) =>
                  p.id === 'FastEthernet0' ? { ...p, connectedTo: { nodeId: 'switch0', portId: 'FastEthernet0/1' } } : p
                ),
                status: 'idle',
              },
            },
            {
              id: 'server0',
              type: 'networkDevice',
              position: { x: 640, y: 260 },
              data: {
                id: 'server0',
                name: 'Server0',
                type: 'server',
                model: 'Server-PT',
                ip: '192.168.2.100',
                subnetMask: '255.255.255.0',
                gateway: '192.168.2.1',
                mac: generateMac('server'),
                ports: getDefaultPorts('server').map((p) =>
                  p.id === 'FastEthernet0' ? { ...p, connectedTo: { nodeId: 'router0', portId: 'GigabitEthernet0/1' } } : p
                ),
                status: 'idle',
              },
            },
          ]);
          setEdges([
            {
              id: 'cable-pc0-switch0',
              source: 'pc0',
              target: 'switch0',
              sourceHandle: 'right',
              targetHandle: 'left',
              type: 'dataCable',
              data: {
                sourcePortId: 'FastEthernet0',
                sourcePortName: 'FastEthernet0',
                targetPortId: 'FastEthernet0/1',
                targetPortName: 'FastEthernet0/1',
                cableType: 'straight',
                sourceStatus: 'up',
                targetStatus: 'up',
                isLinkUp: true,
              },
            },
            {
              id: 'cable-router0-switch0',
              source: 'router0',
              target: 'switch0',
              sourceHandle: 'bottom',
              targetHandle: 'top',
              type: 'dataCable',
              data: {
                sourcePortId: 'GigabitEthernet0/0',
                sourcePortName: 'GigabitEthernet0/0',
                targetPortId: 'FastEthernet0/2',
                targetPortName: 'FastEthernet0/2',
                cableType: 'straight',
                sourceStatus: 'admin_down', // Router port starts shutdown!
                targetStatus: 'up',
                isLinkUp: false,
              },
            },
            {
              id: 'cable-router0-server0',
              source: 'router0',
              target: 'server0',
              sourceHandle: 'right',
              targetHandle: 'left',
              type: 'dataCable',
              data: {
                sourcePortId: 'GigabitEthernet0/1',
                sourcePortName: 'GigabitEthernet0/1',
                targetPortId: 'FastEthernet0',
                targetPortName: 'FastEthernet0',
                cableType: 'straight',
                sourceStatus: 'admin_down', // Router port starts shutdown!
                targetStatus: 'up',
                isLinkUp: false,
              },
            },
          ]);
          setNotes([
            {
              id: 'note-router',
              text: 'Dual-Subnet Router Gateway:\nRouter interfaces default to "shutdown" (Red LEDs).\nOpen Router0 CLI and run "int gig0/0" -> "no shutdown"\nand "int gig0/1" -> "no shutdown" to bring links UP!',
              x: 310,
              y: 20,
            },
          ]);
          break;

        case 'star-lan':
        default:
          setNodes(createInitialNodes());
          setEdges(createInitialEdges());
          setNotes([
            {
              id: 'note-1',
              text: 'Subnet 192.168.1.0/24\nFastEthernet Switching',
              x: 350,
              y: 90,
            },
          ]);
          break;
      }

      setToastAlert({
        type: 'success',
        title: 'Topology Loaded',
        message: 'Network topology successfully initialized.',
      });
      setTimeout(() => fitView({ padding: 0.2, duration: 400 }), 100);
    },
    [fitView, resetEdgeAnimations, setEdges, setNodes]
  );

  const handleSaveDevice = useCallback(
    (updated: NetworkDeviceData) => {
      setNodes((nds) =>
        nds.map((n) => (n.id === updated.id ? { ...n, data: updated } : n))
      );
      setToastAlert({
        type: 'success',
        title: `${updated.name} Updated`,
        message: `IP: ${updated.ip || 'none'}, Subnet: ${updated.subnetMask}`,
      });
    },
    [setNodes]
  );

  // Enrich Nodes with Tool, Port-Based Wiring and Runtime Callbacks
  const enrichedNodes = useMemo(() => {
    return nodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        activeTool,
        activeCableType,
        connectingSource: pendingCableSource
          ? { nodeId: pendingCableSource.deviceId, portId: pendingCableSource.portId }
          : null,
        onOpenConfig: (id: string) => setSelectedDeviceId(id),
        onDeviceCableClick: handleDeviceCableClick,
        onPortClick: handlePortClick,
        onDeleteNode: handleDeleteNode,
        onPduSelect: handlePduSelect,
        isPingSource: pduSourceId === node.id,
      },
    }));
  }, [nodes, activeTool, activeCableType, pendingCableSource, pduSourceId, handleDeviceCableClick, handlePortClick, handleDeleteNode, handlePduSelect]);

  // Enrich Edges with Delete tool, Packet Click callback, and Real Link Status (Updates immediately on no shutdown!)
  const enrichedEdges = useMemo(() => {
    return edges.map((edge) => {
      const sourceNode = nodes.find((n) => n.id === edge.source);
      const targetNode = nodes.find((n) => n.id === edge.target);

      const portA = sourceNode?.data.ports?.find(
        (p) =>
          p.id === edge.data?.sourcePortId ||
          p.name === edge.data?.sourcePortName ||
          p.name === edge.data?.sourcePortId ||
          p.id === edge.data?.sourcePortName
      );
      const portB = targetNode?.data.ports?.find(
        (p) =>
          p.id === edge.data?.targetPortId ||
          p.name === edge.data?.targetPortName ||
          p.name === edge.data?.targetPortId ||
          p.id === edge.data?.targetPortName
      );

      const sourceStatus: PortStatus = portA?.status || 'up';
      const targetStatus: PortStatus = portB?.status || 'up';
      const isLinkUp = sourceStatus === 'up' && targetStatus === 'up';

      return {
        ...edge,
        data: {
          ...edge.data,
          sourcePortName: portA?.name || edge.data?.sourcePortName || edge.data?.sourcePortId,
          targetPortName: portB?.name || edge.data?.targetPortName || edge.data?.targetPortId,
          sourceStatus,
          targetStatus,
          isLinkUp,
          activeTool,
          simulationSpeed,
          onDeleteEdge: handleDeleteEdge,
          onPacketClick: (info?: PduHeaderInfo) => {
            const targetInfo = info || (edge.data?.pduInfo as PduHeaderInfo) || null;
            if (targetInfo) {
              setSelectedPduInfo(targetInfo);
              setIsPduModalOpen(true);
            }
          },
        },
      };
    });
  }, [edges, nodes, activeTool, simulationSpeed, handleDeleteEdge]);

  return (
    <div className="relative w-screen h-screen bg-[#eaedf2] text-slate-800 overflow-hidden font-sans select-none">
      {/* 1. Responsive Canvas Viewport (100% of screen height and width) */}
      <div
        className={`absolute inset-0 w-full h-full ${
          activeTool === 'pdu' ? 'cursor-pdu' : ''
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        <ReactFlow
          nodes={enrichedNodes}
          edges={enrichedEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onPaneClick={handlePaneClick}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          panOnDrag={true}
          panOnScroll={false}
          zoomOnScroll={true}
          zoomOnPinch={true}
          preventScrolling={true}
          minZoom={0.25}
          maxZoom={2.5}
          defaultViewport={{ x: 0, y: 0, zoom: 1 }}
          proOptions={{ hideAttribution: true }}
        >
          {/* Cisco Packet Tracer Light-Grey Dotted Grid */}
          <Background
            variant={BackgroundVariant.Dots}
            gap={24}
            size={1.5}
            color="#cbd5e1"
            className="opacity-90"
          />

          {/* MiniMap in Packet Tracer Style - Hidden on mobile */}
          <div className="hidden md:block">
            <MiniMap
              nodeColor={(node) => {
                const dev = node.data as unknown as NetworkDeviceData;
                switch (dev?.type) {
                  case 'router':
                    return '#0284c7';
                  case 'switch':
                    return '#0369a1';
                  case 'server':
                    return '#475569';
                  case 'pc':
                  default:
                    return '#64748b';
                }
              }}
              maskColor="rgba(234, 237, 242, 0.75)"
              className="!bg-white/90 !border !border-slate-300 !rounded-xl !bottom-24 !right-4 !shadow-md"
            />
          </div>
        </ReactFlow>

        {/* Canvas Sticky Notes Layer */}
        {notes.map((note) => (
          <PacketTracerNote
            key={note.id}
            note={note}
            onUpdate={(id, text) =>
              setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, text } : n)))
            }
            onDelete={(id) => setNotes((prev) => prev.filter((n) => n.id !== id))}
          />
        ))}
      </div>

      {/* 2. Compact Floating Top Bar */}
      <PacketTracerTopBar
        activeTool={activeTool}
        onSelectTool={setActiveTool}
        onNewCanvas={() => handleLoadPreset('empty')}
        onOpenPresets={() => setIsPresetsOpen(true)}
        onOpenHelp={() => setIsHelpOpen(true)}
        onUndo={handleUndo}
        canUndo={undoHistory.length > 0}
        onZoomIn={() => zoomIn({ duration: 200 })}
        onZoomOut={() => zoomOut({ duration: 200 })}
        onFitView={() => fitView({ padding: 0.2, duration: 400 })}
        deviceCount={nodes.length}
        cableCount={edges.length}
        onSaveLab={handleSaveLab}
        onOpenLabFile={handleOpenLabFile}
        onExportImage={handleExportImage}
        onOpenAiDiagnostics={handleOpenAiDiagnostics}
      />

      {/* Floating Active Tool Helper Banner (Shows only when a special tool is engaged) */}
      {(activeTool !== 'select' || activeCableType) && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-30 pointer-events-auto max-w-[92vw] animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="px-3.5 py-1.5 rounded-full bg-slate-900/90 text-white shadow-xl backdrop-blur-md flex items-center gap-2 text-xs font-medium border border-slate-700">
            {activeTool === 'delete' && (
              <span className="text-rose-400 font-semibold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                Delete Tool Active — Tap device or cable to remove
              </span>
            )}
            {activeTool === 'pdu' && !pduSourceId && (
              <span className="text-amber-300 font-semibold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                Add Simple PDU Active — Tap Source Host
              </span>
            )}
            {activeTool === 'pdu' && pduSourceId && (
              <span className="text-sky-300 font-semibold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
                Source selected — Now tap Destination Host to fire PDU!
              </span>
            )}
            {activeTool === 'note' && (
              <span className="text-amber-300 font-semibold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                Note Tool Active — Tap canvas to place sticky note
              </span>
            )}
            {activeCableType && !pendingCableSource && (
              <span className="text-emerald-300 font-semibold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                {activeCableType} Cable — Tap source device
              </span>
            )}
            {activeCableType && pendingCableSource && (
              <span className="text-sky-300 font-semibold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
                Tap destination device to connect cable
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                setActiveTool('select');
                setPduSourceId(null);
                setPendingCableSource(null);
                setActiveCableType(null);
              }}
              className="ml-1 w-5 h-5 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white cursor-pointer"
              title="Cancel tool (Esc)"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Floating Alert Toast */}
      {toastAlert && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4 pointer-events-auto animate-in slide-in-from-top-2 duration-150">
          <div
            className={`p-3 rounded-2xl border shadow-2xl flex items-start gap-3 ${
              toastAlert.type === 'success'
                ? 'bg-white border-emerald-500 text-slate-800 shadow-[0_4px_20px_rgba(16,185,129,0.2)]'
                : 'bg-white border-rose-500 text-slate-800 shadow-[0_4px_20px_rgba(244,63,94,0.2)]'
            }`}
          >
            {toastAlert.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertOctagon className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-slate-900 tracking-wide">
                {toastAlert.title}
              </div>
              <div className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                {toastAlert.message}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setToastAlert(null)}
              className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 3. Bottom Device Shelf (Categorized Dock: Network Devices, End Devices, Connections) */}
      <PacketTracerDeviceShelf
        onAddDevice={handleAddDevice}
        onSelectCable={(type) => {
          setActiveCableType(type);
          setToastAlert({
            type: 'success',
            title: `${type === 'straight' ? 'Copper Straight-Through' : type === 'crossover' ? 'Copper Cross-Over' : 'Auto'} Cable Selected`,
            message: 'Click any device port, then click destination port to link.',
          });
        }}
        activeCableType={activeCableType}
      />

      {/* 4. Bottom-Right Mode Switcher & Simulation Dock */}
      <PacketTracerModeSwitcher
        mode={workspaceMode}
        onToggleMode={setWorkspaceMode}
        isSimulating={isSimulating}
        onPlayPause={handlePlayPause}
        onStepForward={handleStepForward}
        onResetSimulation={handleResetSimulation}
        events={simulationEvents}
        userPdus={userPdus}
        onOpenPduInfo={(info) => {
          setSelectedPduInfo(info);
          setIsPduModalOpen(true);
        }}
        isEventPanelOpen={isEventPanelOpen}
        onToggleEventPanel={() => setIsEventPanelOpen(!isEventPanelOpen)}
        elapsedSeconds={elapsedSeconds}
        simulationSpeed={simulationSpeed}
        onSpeedChange={setSimulationSpeed}
        selectedEventId={selectedEventId}
        onSelectEvent={(evt) => {
          setSelectedEventId(evt.id);
          if (evt.pduInfo) {
            setSelectedPduInfo(evt.pduInfo);
            setIsPduModalOpen(true);
          }
        }}
      />

      {/* PDU Information Dialog (7 OSI Layers & Inbound/Outbound Packet Dissector) */}
      <PduInformationModal
        pduInfo={selectedPduInfo}
        isOpen={isPduModalOpen}
        onClose={() => setIsPduModalOpen(false)}
      />

      {/* Port Selection Dialog for Cisco Cable Wiring */}
      <PortSelectionModal
        device={portModalDevice}
        isOpen={!!portModalDevice}
        onClose={() => {
          setPortModalDevice(null);
          setPendingCableSource(null);
        }}
        onSelectPort={handleSelectPort}
        pendingSource={pendingCableSource}
        edges={edges}
      />

      {/* Device Configuration Window (Physical, Config, CLI / Desktop) */}
      <DeviceConfigSheet
        device={selectedDevice}
        isOpen={!!selectedDeviceId}
        onClose={() => setSelectedDeviceId(null)}
        onSave={handleSaveDevice}
        onDelete={handleDeleteNode}
        allDevices={nodes.map((n) => n.data as unknown as NetworkDeviceData)}
        nodes={nodes}
        edges={edges}
        onTriggerPing={runPduSimulation}
        onInitiatePing={(devId) => {
          setSelectedDeviceId(null);
          setPduSourceId(devId);
          setActiveTool('pdu');
          setToastAlert({
            type: 'success',
            title: 'Simple PDU Source Selected',
            message: 'Click the destination host on the workspace to send ICMP packet.',
          });
        }}
      />

      {/* Ping Modal Tool */}
      <PingModal
        isOpen={isPingModalOpen}
        onClose={() => setIsPingModalOpen(false)}
        devices={nodes.map((n) => n.data as unknown as NetworkDeviceData)}
        defaultSourceId={selectedDeviceId || undefined}
        onRunPing={runPduSimulation}
        isExecuting={isPinging}
      />

      {/* Presets Topology Selector Modal */}
      <PresetsModal
        isOpen={isPresetsOpen}
        onClose={() => setIsPresetsOpen(false)}
        onLoadPreset={handleLoadPreset}
      />

      {/* Quick Help Guide Modal */}
      <QuickHelpModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
      />

      {/* AI Network Copilot & Diagnostics Modal */}
      <AiDiagnosticsModal
        isOpen={isAiDiagOpen}
        onClose={() => setIsAiDiagOpen(false)}
        report={aiReport}
        onReScan={handleOpenAiDiagnostics}
        onApplyAutoFix={(issue) => {
          if (issue.fixAction) {
            issue.fixAction();
          }
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <ReactFlowProvider>
      <NetworkCanvasContent />
    </ReactFlowProvider>
  );
}
