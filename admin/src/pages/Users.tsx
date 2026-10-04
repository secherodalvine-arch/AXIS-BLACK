import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Users as UsersIcon, Search, Filter, Eye, ShieldAlert,
  CheckCircle, Ban, Trash2, Download, RefreshCw, KeyRound,
  ExternalLink, Smartphone, Monitor, Globe
} from 'lucide-react';
import api from '@/api/client';
import { useToastStore } from '@/store';
import { fmtDateTime, fmtRelative } from '@/utils/formatDate';

const STATUS_BADGES: Record<string, string> = {
  active: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
  suspended: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
  blocked: 'bg-rose-500/15 text-rose-400 border border-rose-500/30',
  deleted: 'bg-slate-500/15 text-slate-400 border border-slate-500/30',
};

export function Users() {
  const navigate = useNavigate();
  const { toast } = useToastStore();

  const [users, setUsers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/users', {
        params: { page, limit: 15, search, status_filter: statusFilter }
      });
      setUsers(res.data.data || []);
      setTotal(res.data.total || 0);
    } catch (e: any) {
      toast({ type: 'error', message: 'Failed to load user directory' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [page, search, statusFilter]);

  const handleAction = async (userId: string, action: string, value?: string) => {
    if (action === 'delete' && !confirm('Are you sure you want to delete this user account?')) {
      return;
    }
    setActionLoading(userId);
    try {
      await api.post(`/users/${userId}/action`, { action, value });
      toast({ type: 'success', message: `User action '${action}' completed successfully` });
      fetchUsers();
    } catch (e: any) {
      toast({ type: 'error', message: e.response?.data?.detail || 'Action failed' });
    } finally {
      setActionLoading(null);
    }
  };

  const exportCSV = () => {
    if (!users.length) return;
    const headers = ['ID', 'Name', 'Email', 'Role', 'Status', 'Registered At', 'Last Seen', 'Last IP', 'Last Location'];
    const rows = users.map(u => [
      u.user_id || u.id,
      `"${u.full_name || ''}"`,
      u.email,
      u.role || 'owner',
      u.status || 'active',
      u.created_at || '',
      u.last_seen || '',
      u.last_ip || '',
      `"${u.last_location || ''}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `axis_users_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ type: 'info', message: 'Exported users to CSV' });
  };

  return (
    <div className="space-y-6 animate-fade">
      {/* Title & Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <UsersIcon size={22} className="text-cyan-400" /> User Accounts &amp; Identities
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Directory of registered business owners, assigned team roles, device footprints, and status
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 text-xs text-slate-300 font-medium transition-all"
          >
            <Download size={13} />
            <span>Export CSV</span>
          </button>
          <button
            onClick={fetchUsers}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:border-cyan-500/40 text-xs text-slate-300 font-medium transition-all"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin text-cyan-400' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-navy-900 border border-white/8 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search size={14} className="absolute left-3.5 top-3 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by name, email, company, ID..."
            className="w-full bg-navy-950 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter size={14} className="text-slate-500" />
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="bg-navy-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-cyan-400 transition-colors"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="blocked">Blocked</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="rounded-2xl bg-navy-900 border border-white/8 shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-white/2 border-b border-white/8 text-slate-400 font-medium">
                <th className="py-3.5 px-4 font-semibold">User Identity</th>
                <th className="py-3.5 px-4 font-semibold">Business &amp; Role</th>
                <th className="py-3.5 px-4 font-semibold">Plan</th>
                <th className="py-3.5 px-4 font-semibold">Device Footprint</th>
                <th className="py-3.5 px-4 font-semibold">Last IP &amp; Location</th>
                <th className="py-3.5 px-4 font-semibold">Registration (Local Time)</th>
                <th className="py-3.5 px-4 font-semibold">Status</th>
                <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
                      <span>Loading user records...</span>
                    </div>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    No user accounts match current search or filters.
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const uid = u.user_id || u.id;
                  const isSuspended = u.status === 'suspended' || u.status === 'blocked';
                  return (
                    <tr key={uid} className="hover:bg-white/2 transition-colors">
                      <td className="py-3.5 px-4">
                        <Link to={`/users/${uid}`} className="font-semibold text-white hover:text-cyan-400 flex items-center gap-1.5">
                          <span>{u.full_name || u.name || 'User'}</span>
                          <ExternalLink size={11} className="text-slate-500" />
                        </Link>
                        <div className="text-[11px] text-slate-400">{u.email}</div>
                        <div className="text-[10px] text-slate-600 font-mono">ID: {uid}</div>
                      </td>

                      <td className="py-3.5 px-4 text-slate-300">
                        <div className="font-medium text-white">{u.company_name || 'Individual'}</div>
                        <div className="text-[10px] text-cyan-300 uppercase font-mono mt-0.5">
                          {u.role || (u.is_sub_user ? 'Team Member' : 'Business Owner')}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                          u.plan === 'pro'
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                            : u.plan === 'starter'
                            ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                            : 'bg-slate-500/20 text-slate-400 border-slate-500/30'
                        }`}>
                          {u.plan === 'pro' ? '👑 PRO' : u.plan === 'starter' ? '⚡ STARTER' : '🌐 FREE'}
                        </span>
                        {u.is_paid && u.days_left != null && (
                          <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
                            {u.days_left}d remaining
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-slate-300">
                        <div className="flex items-center gap-1.5 text-xs">
                          {u.last_device?.toLowerCase().includes('mobile') ? (
                            <Smartphone size={13} className="text-lilac-400" />
                          ) : (
                            <Monitor size={13} className="text-cyan-400" />
                          )}
                          <span className="truncate max-w-[130px]">{u.last_device || 'Standard Client'}</span>
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          Last seen: {fmtRelative(u.last_seen)}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-slate-300">
                        <div className="flex items-center gap-1.5">
                          <Globe size={12} className="text-cyan-400" />
                          <span>{u.last_location || 'Local / Proxied'}</span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">{u.last_ip || '—'}</div>
                      </td>

                      <td className="py-3.5 px-4 text-slate-300 font-mono text-[11px]">
                        <div>{fmtDateTime(u.created_at)}</div>
                        <div className="text-[10px] text-slate-500">{fmtRelative(u.created_at)}</div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${STATUS_BADGES[u.status || 'active'] || STATUS_BADGES.active}`}>
                          {u.status || 'active'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            to={`/users/${uid}`}
                            title="Inspect User Details"
                            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-cyan-400 transition-colors"
                          >
                            <Eye size={14} />
                          </Link>

                          {isSuspended ? (
                            <button
                              onClick={() => handleAction(uid, 'activate')}
                              disabled={actionLoading === uid}
                              title="Reactivate Account"
                              className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 transition-colors"
                            >
                              <CheckCircle size={14} />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleAction(uid, 'suspend')}
                              disabled={actionLoading === uid}
                              title="Suspend Account"
                              className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 transition-colors"
                            >
                              <Ban size={14} />
                            </button>
                          )}

                          <button
                            onClick={() => handleAction(uid, 'delete')}
                            disabled={actionLoading === uid}
                            title="Delete Account"
                            className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors"
                          >
                            <Trash2 size={14} />
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

        {/* Pagination Footer */}
        <div className="p-4 border-t border-white/8 flex items-center justify-between text-xs text-slate-400">
          <div>
            Showing {users.length} of {total} registered users
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-white"
            >
              Previous
            </button>
            <span className="font-mono text-cyan-400 font-bold">Page {page}</span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page * 15 >= total}
              className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-white"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
