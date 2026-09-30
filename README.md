# 🌐 Cisco Packet Tracer Web (NetCanvas)

A free, interactive, mobile-responsive, in-browser network simulation application designed to deliver an authentic Cisco Packet Tracer experience. Built with a modern web stack (React, TypeScript, Tailwind CSS) and optimized as a Progressive Web App (PWA) for desktop and Android devices.

---

## 🚀 Key Features

* **Authentic Cisco IOS CLI Engine**:
  * Hierarchical mode transitions: User EXEC (`Router>`), Privileged EXEC (`Router#`), Global Config (`Router(config)#`), and Interface Config (`Router(config-if)#`).
  * Real shorthand command parsing (`sh ip int br`, `conf t`, `no shut`).
  * On-screen mobile accessory bar with `[Tab]`, `[?]`, and `[Enter]` touch keys.

* **Discrete Event Packet Simulation**:
  * Realistic ARP broadcasting and ICMP Echo Request/Reply propagation.
  * Real-time playback controls with speed adjustment, pause, and step-by-step frame forwarding.
  * Live simulation event log recording timestamps, packet types, and device hop history.

* **Port-to-Port Wiring & Interface States**:
  * Dynamic port picker modal for `FastEthernet` and `GigabitEthernet` connections.
  * Interface LED status indicators: Red for administratively down ports, Amber for link transitions, and Green for active connections.

* **PC Virtual Desktop Environment**:
  * **IP Configuration**: Static and DHCP settings with automatic subnet mask calculation based on IP address classes.
  * **Command Prompt**: Native execution of `ipconfig`, `ipconfig /all`, and multi-packet ICMP `ping` diagnostics.

* **Dual-View Packet Inspector (OSI & Wireshark-Lite)**:
  * Clickable simulation events displaying full 7-Layer OSI Model transitions (In-Layers vs. Out-Layers).
  * Collapsible Wireshark dissection tree inspecting Ethernet II, IPv4, and ICMP frame headers alongside raw payload data.

* **Modular Physical Hardware Chassis**:
  * Rear faceplate view featuring a functional power rocker switch and status LEDs.
  * Cisco interlock enforcement: Module insertion/removal is blocked while the device is powered on.
  * Expansion bays supporting modules like `HWIC-2T` (Dual Serial WAN) and `GLC-T` (SFP Gigabit).

* **Lab Persistence & AI Diagnostics**:
  * Save and load network topologies using standardized `.pkt.json` files.
  * 30-second automated backup to browser `localStorage`.
  * Integrated **AI Doctor** copilot that scans running topologies to detect subnet mismatches, missing default gateways, and shutdown ports.

---

## 🛠️ Tech Stack

* **Frontend**: React 18, TypeScript, Tailwind CSS
* **Canvas / Topology**: React Flow / SVG Canvas Engine
* **Icons**: Lucide Icons
* **Application Shell**: Progressive Web App (PWA) via Service Workers

---

## 📦 Getting Started

### Prerequisites
* Node.js (v18 or higher)
* npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone [https://github.com/Akgmiz/cisco-packet-tracer-web.git](https://github.com/Akgmiz/cisco-packet-tracer-web.git)
   cd cisco-packet-tracer-web

   
