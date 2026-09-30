/**
 * In-App AI Network Copilot & Diagnostics Modal (Tutor Mode)
 * Renders network health score, detected configuration anomalies,
 * Cisco CLI suggestions, and one-click Auto-Fix.
 */

import React from 'react';
import { DiagnosticScanReport, AiDiagnosticIssue } from '../engine/AiDiagnosticEngine';
import {
  Sparkles,
  X,
  AlertOctagon,
  AlertTriangle,
  Info,
  CheckCircle2,
  Wrench,
  Terminal,
  Copy,
  Check,
  RefreshCw,
} from 'lucide-react';

interface AiDiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: DiagnosticScanReport | null;
  onReScan: () => void;
  onApplyAutoFix?: (issue: AiDiagnosticIssue) => void;
}

export const AiDiagnosticsModal: React.FC<AiDiagnosticsModalProps> = ({
  isOpen,
  onClose,
  report,
  onReScan,
  onApplyAutoFix,
}) => {
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  if (!isOpen || !report) return null;

  const handleCopyCli = (issueId: string, cliLines: string[]) => {
    navigator.clipboard.writeText(cliLines.join('\n'));
    setCopiedId(issueId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getSeverityBadge = (severity: AiDiagnosticIssue['severity']) => {
    switch (severity) {
      case 'critical':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-300 dark:border-rose-800 flex items-center gap-1">
            <AlertOctagon className="w-3 h-3" /> CRITICAL
          </span>
        );
      case 'warning':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> WARNING
          </span>
        );
      case 'info':
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300 border border-sky-300 dark:border-sky-800 flex items-center gap-1">
            <Info className="w-3 h-3" /> INFO
          </span>
        );
    }
  };

  const healthColor =
    report.healthScore >= 90
      ? 'text-emerald-500'
      : report.healthScore >= 60
      ? 'text-amber-500'
      : 'text-rose-500';

  const healthBarColor =
    report.healthScore >= 90
      ? 'bg-emerald-500'
      : report.healthScore >= 60
      ? 'bg-amber-500'
      : 'bg-rose-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 pointer-events-none select-none font-sans text-slate-800">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs pointer-events-auto transition-opacity"
        onClick={onClose}
      />

      {/* Main Dialog */}
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-800 rounded-3xl shadow-2xl pointer-events-auto flex flex-col overflow-hidden max-h-[88vh] animate-in zoom-in-95 duration-150">
        {/* Title Bar */}
        <div className="px-4 py-3 bg-[#0f172a] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-400/40 flex items-center justify-center text-purple-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-sm block leading-tight text-white">
                In-App AI Network Copilot (Tutor Mode)
              </span>
              <span className="text-[11px] text-purple-300 font-mono">
                Real-time CCNA/CCNP Topology Diagnostic Scanner
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onReScan}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Re-scan Topology"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white flex items-center justify-center text-xs font-bold transition-colors cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Health Score Banner */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className={`text-3xl font-extrabold font-mono ${healthColor}`}>
              {report.healthScore}%
            </div>
            <div>
              <span className="font-bold text-slate-800 dark:text-slate-100 text-sm block">
                Overall Topology Health
              </span>
              <span className="text-slate-500 text-xs">
                {report.summary}
              </span>
            </div>
          </div>

          <div className="w-32 bg-slate-200 dark:bg-slate-700 h-3 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${healthBarColor}`}
              style={{ width: `${report.healthScore}%` }}
            />
          </div>
        </div>

        {/* Issues List Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs">
          {report.issues.map((issue) => (
            <div
              key={issue.id}
              className="p-3.5 bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xs space-y-2.5 transition-all hover:border-slate-400"
            >
              {/* Issue Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  {getSeverityBadge(issue.severity)}
                  <div>
                    <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                      {issue.title}
                    </h4>
                    {issue.deviceName && (
                      <span className="text-[11px] text-slate-500 font-mono">
                        Device: <strong>{issue.deviceName}</strong>
                        {issue.interfaceName && ` · Interface: ${issue.interfaceName}`}
                      </span>
                    )}
                  </div>
                </div>

                {issue.autoFixAvailable && (
                  <button
                    type="button"
                    onClick={() => onApplyAutoFix?.(issue)}
                    className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[11px] flex items-center gap-1 cursor-pointer transition-all shadow-xs touch-manipulation active:scale-95"
                  >
                    <Wrench className="w-3 h-3" />
                    <span>Auto-Fix</span>
                  </button>
                )}
              </div>

              {/* Description */}
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed font-sans">
                {issue.description}
              </p>

              {/* Cisco CLI Suggestions */}
              {issue.suggestedCli && issue.suggestedCli.length > 0 && (
                <div className="bg-[#0f172a] rounded-xl p-2.5 font-mono text-[11px] text-slate-200 space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 border-b border-slate-800 pb-1">
                    <span className="flex items-center gap-1 font-bold text-emerald-400">
                      <Terminal className="w-3 h-3" /> Cisco IOS CLI Remediation:
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyCli(issue.id, issue.suggestedCli)}
                      className="hover:text-white flex items-center gap-1 cursor-pointer"
                    >
                      {copiedId === issue.id ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400 font-bold">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy Commands</span>
                        </>
                      )}
                    </button>
                  </div>
                  {issue.suggestedCli.map((line, idx) => (
                    <div key={idx} className="text-slate-200">
                      <span className="text-slate-500 mr-2 select-none">$</span>
                      {line}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {report.issues.length === 0 && (
            <div className="text-center py-12 space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base">
                Zero Configuration Anomalies Detected!
              </h3>
              <p className="text-slate-500 max-w-sm mx-auto text-xs">
                All physical links are up, subnets and IP addressing are consistent, and routing paths are valid.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
