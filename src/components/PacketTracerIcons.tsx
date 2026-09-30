import React from 'react';

// Official Cisco Packet Tracer style vector iconography

// 1. Router Icon: Metallic-blue puck with 4 arrows (2 in, 2 out)
export const RouterIconPT: React.FC<{ className?: string; size?: number }> = ({ className = '', size = 48 }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    {/* Cylinder base / 3D rim */}
    <ellipse cx="32" cy="38" rx="26" ry="12" fill="#02457a" />
    <path d="M6 26v12c0 6.627 11.64 12 26 12s26-5.373 26-12V26" fill="#005b96" />
    {/* Top face */}
    <ellipse cx="32" cy="26" rx="26" ry="12" fill="#0077b6" stroke="#0096c7" strokeWidth="1.5" />
    
    {/* 4 Crossing Arrows (Iconic Cisco Router symbol) */}
    {/* Inward arrows */}
    <path d="M14 26h12m-4-4 4 4-4 4" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M50 26H38m4-4-4 4 4 4" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    {/* Outward arrows */}
    <path d="M32 17v7m-3-4 3-3 3 3" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M32 29v7m-3 4 3 3 3-3" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// 2. Switch Icon: Dark blue rectangular box with 4 arrows pointing in opposite directions
export const SwitchIconPT: React.FC<{ className?: string; size?: number }> = ({ className = '', size = 48 }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    {/* 3D Box base */}
    <rect x="6" y="24" width="52" height="18" rx="2" fill="#023e8a" stroke="#03045e" strokeWidth="1.5" />
    {/* Top face */}
    <path d="M6 24 16 16h42l-10 8H6z" fill="#0077b6" stroke="#03045e" strokeWidth="1.5" />
    {/* Right side */}
    <path d="m48 24 10-8v18l-10 8V24z" fill="#0096c7" stroke="#03045e" strokeWidth="1.5" />

    {/* 4 Parallel horizontal switching arrows */}
    <path d="M14 29h22m-4-3 4 3-4 3" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M38 35H16m4-3-4 3 4 3" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    
    {/* Port LEDs on front panel */}
    <circle cx="10" cy="38" r="1.5" fill="#48cae4" />
    <circle cx="14" cy="38" r="1.5" fill="#52b788" />
    <circle cx="18" cy="38" r="1.5" fill="#52b788" />
    <circle cx="22" cy="38" r="1.5" fill="#52b788" />
    <circle cx="26" cy="38" r="1.5" fill="#52b788" />
    <circle cx="30" cy="38" r="1.5" fill="#52b788" />
  </svg>
);

// 3. Hub Icon: Gray rectangular hub
export const HubIconPT: React.FC<{ className?: string; size?: number }> = ({ className = '', size = 48 }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect x="6" y="24" width="52" height="18" rx="2" fill="#475569" stroke="#334155" strokeWidth="1.5" />
    <path d="M6 24 16 16h42l-10 8H6z" fill="#64748b" stroke="#334155" strokeWidth="1.5" />
    <path d="m48 24 10-8v18l-10 8V24z" fill="#94a3b8" stroke="#334155" strokeWidth="1.5" />
    {/* Hub Broadcast Star/Arrows */}
    <circle cx="27" cy="33" r="3" fill="#ffffff" />
    <path d="M20 33h-6m20 0h6m-10-6v-3m0 12v3" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

// 4. PC Desktop Workstation: Monitor + Computer Tower + Keyboard
export const PcIconPT: React.FC<{ className?: string; size?: number }> = ({ className = '', size = 48 }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    {/* Monitor */}
    <rect x="8" y="14" width="34" height="24" rx="2" fill="#1e293b" stroke="#334155" strokeWidth="1.5" />
    <rect x="11" y="17" width="28" height="18" rx="1" fill="#38bdf8" fillOpacity="0.8" />
    {/* Screen glare/grid line */}
    <path d="M12 32h26" stroke="#ffffff" strokeWidth="0.8" strokeOpacity="0.6" />
    {/* Monitor stand */}
    <path d="M22 38h6v5h-6z" fill="#334155" />
    <path d="M16 43h18v2H16z" fill="#475569" />

    {/* Tower case */}
    <rect x="44" y="16" width="13" height="30" rx="1.5" fill="#334155" stroke="#1e293b" strokeWidth="1.5" />
    {/* CD-ROM / Power LED */}
    <rect x="46" y="20" width="9" height="2.5" fill="#64748b" />
    <rect x="46" y="24" width="9" height="2.5" fill="#64748b" />
    <circle cx="50" cy="34" r="1.5" fill="#22c55e" />
  </svg>
);

// 5. Laptop Icon
export const LaptopIconPT: React.FC<{ className?: string; size?: number }> = ({ className = '', size = 48 }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    {/* Screen */}
    <rect x="14" y="16" width="36" height="24" rx="2" fill="#1e293b" stroke="#334155" strokeWidth="1.5" />
    <rect x="17" y="19" width="30" height="18" rx="1" fill="#38bdf8" fillOpacity="0.75" />
    {/* Base keyboard panel */}
    <path d="M6 42h52l-5 7H11l-5-7z" fill="#475569" stroke="#334155" strokeWidth="1.5" />
    <rect x="25" y="44" width="14" height="3" rx="0.5" fill="#64748b" />
  </svg>
);

// 6. Server Rack Unit
export const ServerIconPT: React.FC<{ className?: string; size?: number }> = ({ className = '', size = 48 }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect x="14" y="12" width="36" height="38" rx="3" fill="#1e293b" stroke="#334155" strokeWidth="1.5" />
    {/* 3 rack shelves */}
    <rect x="18" y="16" width="28" height="8" rx="1" fill="#334155" />
    <circle cx="41" cy="20" r="1.5" fill="#22c55e" />
    <circle cx="37" cy="20" r="1.5" fill="#38bdf8" />

    <rect x="18" y="27" width="28" height="8" rx="1" fill="#334155" />
    <circle cx="41" cy="31" r="1.5" fill="#22c55e" />
    <circle cx="37" cy="31" r="1.5" fill="#38bdf8" />

    <rect x="18" y="38" width="28" height="8" rx="1" fill="#334155" />
    <circle cx="41" cy="42" r="1.5" fill="#22c55e" />
    <circle cx="37" cy="42" r="1.5" fill="#eab308" />
  </svg>
);

// 7. Iconic Packet Tracer PDU Envelope Icon
export const PduEnvelopePT: React.FC<{ className?: string; size?: number }> = ({ className = '', size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect x="3" y="6" width="26" height="20" rx="2" fill="#fde047" stroke="#ca8a04" strokeWidth="1.5" />
    <path d="M3 8l13 10L29 8" stroke="#ca8a04" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="16" cy="18" r="3" fill="#ef4444" />
  </svg>
);

// 8. Lightning Cable Icon
export const LightningCablePT: React.FC<{ className?: string; size?: number }> = ({ className = '', size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="#f59e0b" stroke="#d97706" strokeWidth="1.2" strokeLinejoin="round" />
  </svg>
);
