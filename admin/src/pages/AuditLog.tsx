import React, { useEffect, useState } from 'react';
import {
  ScrollText, Search, Filter, Eye, RefreshCw,
  Clock, Shield, User, X, Download
} from 'lucide-react';
import api from '@/api/client';
import { fmtDateTime, fmtRelative } from '@/utils/formatDate';

const ACTION_COLORS: Record<string, string> = {
  activate: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  suspend: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  block: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
  delete: 'bg-rose-600/20 text-rose-500 border-rose-600/30',
  reset_password: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  change_role: 'bg-lilac-500/20 text-lilac-400 border-lilac-500/30',
  broadcast: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
};

export function AuditLog() {
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<any | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await api.get('/audit', {
        params: { page, limit: 25, action: actionFilter },
      });
      setLogs(res.data.data || []);
      setTotal(res.data.total || 0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, actionFilter]);

  return (
    <div className="space-y-6 animate-fade">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <ScrollText size={22} className="text-cyan-400" /> Platform Activities &amp; Audit Trail
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Chronological audit of administrator modifications, identity management, and security events
          </p>
        </div>

        <button
          onClick={fetchLogs}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:border-cyan-500/40 text-xs text-slate-300 font-medium transition-all"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin text-cyan-400' : ''} />
          <span>Refresh Logs</span>
        </button>
      </div>

      {/* Filter Strip */}
      <div className="p-4 rounded-2xl bg-navy-900 border border-white/8 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-slate-500" />
          <select
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
            className="bg-navy-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-cyan-400 transition-colors"
          >
            <option value="">All Action Types</option>
            <option value="activate">Account Activation</option>
            <option value="suspend">Account Suspension</option>
            <option value="block">Account Block</option>
            <option value="delete">Account Deletion</option>
            <option value="reset_password">Password Reset</option>
            <option value="change_role">Role Modification</option>
          </select>
        </div>

        <div className="text-xs text-slate-500 font-mono">
          Total Logs: <span className="text-cyan-400 font-bold">{total}</span>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl bg-navy-900 border border-white/8 shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-white/2 border-b border-white/8 text-slate-400 font-medium">
                <th className="py-3 px-4 font-semibold">Action</th>
                <th className="py-3 px-4 font-semibold">Initiated By</th>
                <th className="py-3 px-4 font-semibold">Target User ID</th>
                <th className="py-3 px-4 font-semibold">Reason / Detail</th>
                <th className="py-3 px-4 font-semibold">Timestamp (Local Time)</th>
                <th className="py-3 px-4 font-semibold text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
                      <span>Loading audit trail...</span>
                    </div>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    No audit records registered for current filters.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const badgeClass = ACTION_COLORS[log.action] || 'bg-white/10 text-slate-300 border-white/20';
                  return (
                    <tr key={log.id || log._id} className="hover:bg-white/2 transition-colors">
                      <td className="py-3.5 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${badgeClass}`}>
                          {log.action}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-slate-300">
                        <div className="font-semibold text-white">{log.admin_name || 'Admin'}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{log.admin_id}</div>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-cyan-300">
                        {log.target_user_id || 'System'}
                      </td>

                      <td className="py-3.5 px-4 text-slate-400">
                        {log.reason || 'Standard administration operation'}
                      </td>

                      <td className="py-3.5 px-4 text-slate-300 font-mono text-[11px]">
                        <div>{fmtDateTime(log.timestamp)}</div>
                        <div className="text-[10px] text-slate-500">{fmtRelative(log.timestamp)}</div>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-cyan-400 transition-colors"
                          title="Inspect JSON Payload"
                        >
                          <Eye size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 border-t border-white/8 flex items-center justify-between text-xs text-slate-400">
          <div>Showing {logs.length} of {total} records</div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-white"
            >
              Previous
            </button>
            <span className="font-mono text-cyan-400 font-bold">Page {page}</span>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={page * 25 >= total}
              className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-white"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Log Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade">
          <div className="w-full max-w-lg p-6 rounded-2xl bg-navy-900 border border-white/10 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ScrollText size={16} className="text-cyan-400" /> Audit Log Inspector
              </h3>
              <button onClick={() => setSelectedLog(null)} className="p-1 text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <div className="bg-navy-950 p-4 rounded-xl border border-white/8 font-mono text-xs text-cyan-300 overflow-x-auto max-h-96">
              <pre>{JSON.stringify(selectedLog, null, 2)}</pre>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-semibold"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
