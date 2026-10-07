import React, { useState, useEffect } from 'react';
import {
  ShieldAlert, AlertTriangle, AlertCircle, Info, CheckCircle2,
  RefreshCw, Search, Filter, Trash2, Check, ExternalLink,
  Cpu, Mail, CreditCard, Monitor, Server, Terminal, Copy, X
} from 'lucide-react';
import api from '@/api/client';
import { useToastStore } from '@/store';
import { fmtDateTime } from '@/utils/formatDate';

interface SystemLogEntry {
  id: string;
  timestamp: string;
  level: 'CRITICAL' | 'ERROR' | 'WARNING' | 'INFO';
  service: string;
  event: string;
  message: string;
  details?: any;
  path?: string;
  status_code?: number;
  stack_trace?: string;
  client_ip?: string;
  resolved?: boolean;
}

interface LogStats {
  total_24h: number;
  critical_count: number;
  frontend_errors: number;
  api_errors: number;
  email_errors: number;
  overall_status: string;
}

export function SystemLogs() {
  const { toast } = useToastStore();
  const [logs, setLogs] = useState<SystemLogEntry[]>([]);
  const [stats, setStats] = useState<LogStats>({
    total_24h: 0,
    critical_count: 0,
    frontend_errors: 0,
    api_errors: 0,
    email_errors: 0,
    overall_status: 'Operational'
  });
  const [loading, setLoading] = useState(true);

  // Filters
  const [levelFilter, setLevelFilter] = useState('');
  const [serviceFilter, setServiceFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Selected Log for detail modal
  const [selectedLog, setSelectedLog] = useState<SystemLogEntry | null>(null);
  const [copiedTrace, setCopiedTrace] = useState(false);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params: any = { page, limit: 30 };
      if (levelFilter) params.level = levelFilter;
      if (serviceFilter) params.service = serviceFilter;
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const [logsRes, statsRes] = await Promise.all([
        api.get('/logs', { params }),
        api.get('/logs/stats').catch(() => ({ data: { stats: null } }))
      ]);

      setLogs(logsRes.data.data || []);
      setTotalCount(logsRes.data.total || 0);
      if (statsRes.data.stats) {
        setStats(statsRes.data.stats);
      }
    } catch (e: any) {
      toast({ type: 'error', message: 'Failed to fetch platform logs' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [levelFilter, serviceFilter, page]);

  const handleResolveLog = async (logId: string) => {
    try {
      await api.post(`/logs/${logId}/resolve`);
      setLogs(prev => prev.map(l => l.id === logId ? { ...l, resolved: true } : l));
      if (selectedLog && selectedLog.id === logId) {
        setSelectedLog({ ...selectedLog, resolved: true });
      }
      toast({ type: 'success', message: 'Issue marked as resolved' });
    } catch {
      toast({ type: 'error', message: 'Failed to resolve log entry' });
    }
  };

  const handleClearLogs = async (onlyResolved: boolean) => {
    try {
      await api.delete(`/logs?only_resolved=${onlyResolved}`);
      toast({ type: 'info', message: onlyResolved ? 'Resolved issues cleared' : 'All logs cleared' });
      fetchLogs();
    } catch {
      toast({ type: 'error', message: 'Failed to clear logs' });
    }
  };

  const handleCopyTrace = (trace: string) => {
    navigator.clipboard.writeText(trace);
    setCopiedTrace(true);
    toast({ type: 'info', message: 'Stack trace copied to clipboard' });
    setTimeout(() => setCopiedTrace(false), 2000);
  };

  const getServiceIcon = (service: string) => {
    switch (service) {
      case 'Backend API': return <Server size={14} className="text-cyan-400" />;
      case 'Frontend Client': return <Monitor size={14} className="text-lilac-400" />;
      case 'Email Service': return <Mail size={14} className="text-amber-400" />;
      case 'IntaSend Gateway': return <CreditCard size={14} className="text-emerald-400" />;
      case 'Gemini AI Engine': return <Cpu size={14} className="text-pink-400" />;
      default: return <Terminal size={14} className="text-slate-400" />;
    }
  };

  return (
    <div className="space-y-6 animate-fade max-w-7xl mx-auto">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <ShieldAlert size={24} className="text-cyan-400" /> System Logs &amp; Platform Health Monitor
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time error tracking and system activity across Backend API, Frontend Client, Email Dispatcher, and Integrated APIs
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleClearLogs(true)}
            className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Check size={13} /> Clear Resolved
          </button>
          <button
            onClick={fetchLogs}
            className="px-3.5 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh Logs
          </button>
        </div>
      </div>

      {/* 4 Summary Health Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Issues */}
        <div className="p-5 rounded-2xl bg-navy-900 border border-white/8 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Logged Issues (24h)</span>
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
              <Terminal size={16} />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-white mt-2 font-mono">
            {stats.total_24h}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
            <span className="text-cyan-400">Total captured platform events</span>
          </div>
        </div>

        {/* Critical Errors */}
        <div className="p-5 rounded-2xl bg-navy-900 border border-white/8 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Critical Exceptions</span>
            <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center">
              <AlertTriangle size={16} />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-white mt-2 font-mono">
            {stats.critical_count}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
            <span className={stats.critical_count > 0 ? 'text-rose-400' : 'text-emerald-400'}>
              {stats.critical_count > 0 ? 'Requires investigation' : 'Zero unhandled fatal crashes'}
            </span>
          </div>
        </div>

        {/* API Integration Health */}
        <div className="p-5 rounded-2xl bg-navy-900 border border-white/8 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Integrated APIs Status</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <Cpu size={16} />
            </div>
          </div>
          <div className="text-base font-bold text-emerald-400 mt-2 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            IntaSend &amp; Gemini OK
          </div>
          <div className="text-[11px] text-slate-400 mt-1 font-mono">
            {stats.api_errors} API error warnings logged
          </div>
        </div>

        {/* Email & Client Health */}
        <div className="p-5 rounded-2xl bg-navy-900 border border-white/8 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Email Dispatcher</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <Mail size={16} />
            </div>
          </div>
          <div className="text-base font-bold text-white mt-2">
            Vercel Serverless / SMTP
          </div>
          <div className="text-[11px] text-slate-400 mt-1 font-mono">
            {stats.email_errors} dispatch delivery warnings
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-navy-900 border border-white/8 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchLogs()}
            placeholder="Search log message, endpoint, stack trace, or IP..."
            className="w-full bg-navy-950 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
          />
        </div>

        {/* Filter Controls */}
        <div className="flex items-center gap-2.5 overflow-x-auto">
          {/* Level Filter */}
          <select
            value={levelFilter}
            onChange={(e) => {
              setLevelFilter(e.target.value);
              setPage(1);
            }}
            className="bg-navy-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
          >
            <option value="">All Severity Levels</option>
            <option value="CRITICAL">CRITICAL</option>
            <option value="ERROR">ERROR</option>
            <option value="WARNING">WARNING</option>
            <option value="INFO">INFO</option>
          </select>

          {/* Service Filter */}
          <select
            value={serviceFilter}
            onChange={(e) => {
              setServiceFilter(e.target.value);
              setPage(1);
            }}
            className="bg-navy-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
          >
            <option value="">All Platform Services</option>
            <option value="Backend API">Backend API</option>
            <option value="Frontend Client">Frontend Client</option>
            <option value="Email Service">Email Service</option>
            <option value="IntaSend Gateway">IntaSend Gateway</option>
            <option value="Gemini AI Engine">Gemini AI Engine</option>
          </select>
        </div>
      </div>

      {/* Real-Time Logs Table */}
      <div className="rounded-2xl bg-navy-900 border border-white/8 shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-white/8 text-slate-400 bg-white/2">
                <th className="py-3 px-4 font-semibold">Severity</th>
                <th className="py-3 px-4 font-semibold">Service</th>
                <th className="py-3 px-4 font-semibold">Timestamp</th>
                <th className="py-3 px-4 font-semibold">Event &amp; Message</th>
                <th className="py-3 px-4 font-semibold">Route / Status</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading && logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-16 text-slate-500">
                    Loading platform logs and system activity...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-16 text-slate-500">
                    No log entries matching the selected criteria.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const isCritical = log.level === 'CRITICAL';
                  const isError = log.level === 'ERROR';
                  const isWarning = log.level === 'WARNING';

                  return (
                    <tr
                      key={log.id}
                      onClick={() => setSelectedLog(log)}
                      className="hover:bg-white/3 cursor-pointer transition-colors"
                    >
                      {/* Severity Pill */}
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                          isCritical
                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse'
                            : isError
                            ? 'bg-rose-500/15 text-rose-300 border-rose-500/25'
                            : isWarning
                            ? 'bg-amber-500/15 text-amber-300 border-amber-500/25'
                            : 'bg-cyan-500/15 text-cyan-300 border-cyan-500/25'
                        }`}>
                          {log.level}
                        </span>
                      </td>

                      {/* Service with Icon */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2 text-white font-semibold">
                          {getServiceIcon(log.service)}
                          <span>{log.service}</span>
                        </div>
                      </td>

                      {/* Timestamp */}
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                        {fmtDateTime(log.timestamp)}
                      </td>

                      {/* Event & Message */}
                      <td className="py-3 px-4 max-w-md">
                        <div className="font-semibold text-white truncate">{log.event}</div>
                        <div className="text-[11px] text-slate-400 truncate mt-0.5">{log.message}</div>
                      </td>

                      {/* Route / Status Code */}
                      <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px]">
                        {log.path && <div className="text-cyan-300">{log.path}</div>}
                        {log.status_code && (
                          <div className={`text-[10px] ${log.status_code >= 500 ? 'text-rose-400' : 'text-slate-400'}`}>
                            HTTP {log.status_code}
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          {!log.resolved && (
                            <button
                              onClick={() => handleResolveLog(log.id)}
                              title="Mark resolved"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                            >
                              <Check size={14} />
                            </button>
                          )}
                          <button
                            onClick={() => setSelectedLog(log)}
                            className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-[11px] font-semibold transition-colors"
                          >
                            Details
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info */}
        <div className="p-3.5 border-t border-white/8 bg-navy-950/40 flex items-center justify-between text-xs text-slate-400">
          <span>Showing {logs.length} of {totalCount} total logged events</span>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-40"
            >
              Previous
            </button>
            <span className="font-mono text-white">Page {page}</span>
            <button
              disabled={logs.length < 30}
              onClick={() => setPage(p => p + 1)}
              className="px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Detailed Log Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade">
          <div className="w-full max-w-2xl bg-navy-900 border border-white/10 rounded-2xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-3 border-b border-white/8">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                    selectedLog.level === 'CRITICAL' ? 'bg-rose-500/20 text-rose-300' : 'bg-cyan-500/20 text-cyan-300'
                  }`}>
                    {selectedLog.level}
                  </span>
                  <h3 className="text-base font-bold text-white">{selectedLog.event}</h3>
                </div>
                <div className="text-xs text-slate-400 flex items-center gap-2 font-mono">
                  <span>{selectedLog.service}</span>
                  <span>•</span>
                  <span>{fmtDateTime(selectedLog.timestamp)}</span>
                </div>
              </div>

              <button onClick={() => setSelectedLog(null)} className="text-slate-400 hover:text-white p-1">
                <X size={18} />
              </button>
            </div>

            {/* Error Message */}
            <div className="p-3.5 rounded-xl bg-navy-950 border border-white/8 text-xs text-slate-200 leading-relaxed font-mono">
              {selectedLog.message}
            </div>

            {/* Context details */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-white/2 border border-white/5">
                <div className="text-slate-500 font-semibold mb-0.5">Endpoint / Path</div>
                <div className="font-mono text-cyan-300">{selectedLog.path || 'N/A'}</div>
              </div>

              <div className="p-3 rounded-xl bg-white/2 border border-white/5">
                <div className="text-slate-500 font-semibold mb-0.5">HTTP Status</div>
                <div className="font-mono text-white">{selectedLog.status_code || 200}</div>
              </div>

              {selectedLog.client_ip && (
                <div className="p-3 rounded-xl bg-white/2 border border-white/5">
                  <div className="text-slate-500 font-semibold mb-0.5">Client IP</div>
                  <div className="font-mono text-white">{selectedLog.client_ip}</div>
                </div>
              )}

              <div className="p-3 rounded-xl bg-white/2 border border-white/5">
                <div className="text-slate-500 font-semibold mb-0.5">Resolution Status</div>
                <div className={selectedLog.resolved ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                  {selectedLog.resolved ? 'Resolved' : 'Active / Unresolved'}
                </div>
              </div>
            </div>

            {/* Stack Trace */}
            {selectedLog.stack_trace && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-semibold flex items-center gap-1.5">
                    <Terminal size={13} className="text-cyan-400" /> Stack Trace / Traceback
                  </span>
                  <button
                    onClick={() => handleCopyTrace(selectedLog.stack_trace!)}
                    className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300"
                  >
                    {copiedTrace ? <Check size={12} /> : <Copy size={12} />}
                    <span>{copiedTrace ? 'Copied' : 'Copy Trace'}</span>
                  </button>
                </div>
                <pre className="p-3.5 rounded-xl bg-black/60 border border-white/10 text-[11px] text-rose-300 font-mono overflow-x-auto max-h-48 leading-relaxed whitespace-pre-wrap">
                  {selectedLog.stack_trace}
                </pre>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-white/8">
              {!selectedLog.resolved ? (
                <button
                  onClick={() => handleResolveLog(selectedLog.id)}
                  className="px-4 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1.5"
                >
                  <Check size={14} /> Mark as Resolved
                </button>
              ) : (
                <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1.5">
                  <CheckCircle2 size={15} /> Acknowledged &amp; Resolved
                </span>
              )}

              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
