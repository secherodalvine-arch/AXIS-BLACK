import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  User, Shield, Mail, Phone, Building2, MapPin,
  Clock, Monitor, Smartphone, Globe, Receipt, FileSpreadsheet,
  Boxes, Activity, ArrowLeft, Ban, CheckCircle, Trash2, KeyRound,
  Send, RefreshCw
} from 'lucide-react';
import api from '@/api/client';
import { useToastStore } from '@/store';
import { fmtDateTime, fmtRelative } from '@/utils/formatDate';

export function UserDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToastStore();

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [newPass, setNewPass] = useState('');
  const [showPassModal, setShowPassModal] = useState(false);

  const loadUser = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await api.get(`/users/${id}`);
      setData(res.data.data);
    } catch (e: any) {
      toast({ type: 'error', message: 'Failed to load user profile' });
      navigate('/users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUser();
  }, [id]);

  const handleAction = async (action: string, value?: string) => {
    if (action === 'delete' && !confirm('Permanently delete this user account?')) return;
    setActionLoading(true);
    try {
      await api.post(`/users/${id}/action`, { action, value });
      toast({ type: 'success', message: `Action '${action}' applied` });
      if (action === 'delete') {
        navigate('/users');
      } else {
        loadUser();
        setShowPassModal(false);
        setNewPass('');
      }
    } catch (e: any) {
      toast({ type: 'error', message: e.response?.data?.detail || 'Action failed' });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center h-80 text-cyan-400 gap-3">
        <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
        <span className="text-sm font-semibold text-slate-300">Retrieving User Identity...</span>
      </div>
    );
  }

  const { user, session, transactions_count, spreadsheets_count, inventory_count, recent_activities, recent_transactions, spreadsheets } = data;
  const isSuspended = user.status === 'suspended' || user.status === 'blocked';

  return (
    <div className="space-y-6 animate-fade max-w-6xl mx-auto">
      {/* Back button */}
      <div>
        <Link to="/users" className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-cyan-400 transition-colors">
          <ArrowLeft size={14} /> Back to Users Directory
        </Link>
      </div>

      {/* Header Profile Card */}
      <div className="p-6 rounded-2xl bg-navy-900 border border-white/8 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-500 to-lilac-500 flex items-center justify-center text-black text-2xl font-black shadow-lg shadow-cyan-500/20">
              {(user.full_name || user.name || user.email || 'U')[0].toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-white">{user.full_name || user.name || 'User'}</h1>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                  user.status === 'active' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                }`}>
                  {user.status || 'active'}
                </span>
              </div>
              <div className="text-xs text-slate-400 font-mono mt-0.5">{user.email}</div>
              <div className="text-[11px] text-cyan-300 mt-1 flex items-center gap-3">
                <span>Role: <strong className="uppercase">{user.role || 'Owner'}</strong></span>
                <span>•</span>
                <span>Company: <strong>{user.company_name || 'Individual'}</strong></span>
              </div>
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPassModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:border-cyan-400 text-xs text-slate-200 transition-all font-medium"
            >
              <KeyRound size={13} className="text-amber-400" />
              <span>Reset Password</span>
            </button>

            {isSuspended ? (
              <button
                onClick={() => handleAction('activate')}
                disabled={actionLoading}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 text-xs text-emerald-300 transition-all font-medium"
              >
                <CheckCircle size={13} />
                <span>Reactivate</span>
              </button>
            ) : (
              <button
                onClick={() => handleAction('suspend')}
                disabled={actionLoading}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 text-xs text-amber-300 transition-all font-medium"
              >
                <Ban size={13} />
                <span>Suspend</span>
              </button>
            )}

            <button
              onClick={() => handleAction('delete')}
              disabled={actionLoading}
              className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 text-rose-400 transition-colors"
              title="Delete Account"
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-navy-900 border border-white/8">
          <div className="flex items-center gap-2 text-cyan-400 text-xs mb-1">
            <Receipt size={14} /> Transactions
          </div>
          <div className="text-xl font-bold text-white">{transactions_count}</div>
          <div className="text-[10px] text-slate-500">Ledger records</div>
        </div>

        <div className="p-4 rounded-2xl bg-navy-900 border border-white/8">
          <div className="flex items-center gap-2 text-lilac-400 text-xs mb-1">
            <FileSpreadsheet size={14} /> Spreadsheets
          </div>
          <div className="text-xl font-bold text-white">{spreadsheets_count}</div>
          <div className="text-[10px] text-slate-500">Custom workbooks</div>
        </div>

        <div className="p-4 rounded-2xl bg-navy-900 border border-white/8">
          <div className="flex items-center gap-2 text-amber-400 text-xs mb-1">
            <Boxes size={14} /> Inventory SKUs
          </div>
          <div className="text-xl font-bold text-white">{inventory_count}</div>
          <div className="text-[10px] text-slate-500">Tracked items</div>
        </div>

        <div className="p-4 rounded-2xl bg-navy-900 border border-white/8">
          <div className="flex items-center gap-2 text-emerald-400 text-xs mb-1">
            <Clock size={14} /> Registered On
          </div>
          <div className="text-xs font-bold text-white font-mono">{fmtDateTime(user.created_at)}</div>
          <div className="text-[10px] text-slate-500">{fmtRelative(user.created_at)}</div>
        </div>
      </div>

      {/* Device & Session Telemetry Card */}
      <div className="p-5 rounded-2xl bg-navy-900 border border-white/8 shadow-xl">
        <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
          <Monitor size={16} className="text-cyan-400" /> Device Telemetry &amp; Location Footprint
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-3.5 rounded-xl bg-white/4 border border-white/6 space-y-1">
            <div className="text-slate-400 text-[11px] font-semibold">Active Client Device</div>
            <div className="font-semibold text-white">{session?.device || user.last_device || 'Unknown Client'}</div>
            <div className="text-[10px] text-slate-500 font-mono">
              Type: {session?.device_type || 'Desktop'} • Browser: {session?.browser || 'Browser'} • OS: {session?.os || 'OS'}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-white/4 border border-white/6 space-y-1">
            <div className="text-slate-400 text-[11px] font-semibold">IP Address &amp; Geolocation</div>
            <div className="font-semibold text-white flex items-center gap-1.5">
              <Globe size={13} className="text-cyan-400" />
              <span>{session?.location || user.last_location || 'Local Host'}</span>
            </div>
            <div className="text-[10px] text-slate-500 font-mono">IP: {session?.ip || user.last_ip || '127.0.0.1'}</div>
          </div>

          <div className="p-3.5 rounded-xl bg-white/4 border border-white/6 space-y-1">
            <div className="text-slate-400 text-[11px] font-semibold">Device Local Time &amp; Timezone</div>
            <div className="font-semibold text-cyan-300 font-mono">{session?.local_time || user.last_local_time || '—'}</div>
            <div className="text-[10px] text-slate-500 font-mono">Timezone: {session?.timezone || user.timezone || 'UTC'}</div>
          </div>
        </div>
      </div>

      {/* Recent Activities & Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Ledger Entries */}
        <div className="p-5 rounded-2xl bg-navy-900 border border-white/8 shadow-xl">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
            <Receipt size={16} className="text-amber-400" /> Recent Ledger Transactions
          </h3>
          {!recent_transactions?.length ? (
            <div className="text-xs text-slate-500 py-6 text-center">No transactions recorded yet.</div>
          ) : (
            <div className="space-y-2">
              {recent_transactions.map((t: any) => (
                <div key={t.id} className="p-3 rounded-xl bg-white/3 border border-white/6 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-semibold text-white">{t.counterparty || 'Transaction'}</div>
                    <div className="text-[10px] text-slate-400">{t.category} • {t.date}</div>
                  </div>
                  <div className={`font-mono font-bold ${t.amount < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {t.amount < 0 ? '-' : '+'}${Math.abs(t.amount).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Activity Audit */}
        <div className="p-5 rounded-2xl bg-navy-900 border border-white/8 shadow-xl">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
            <Activity size={16} className="text-cyan-400" /> User Activities Trail
          </h3>
          {!recent_activities?.length ? (
            <div className="text-xs text-slate-500 py-6 text-center">No logged activities for this user.</div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {recent_activities.map((a: any) => (
                <div key={a.id} className="p-3 rounded-xl bg-white/3 border border-white/6 text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-cyan-300">{a.title}</span>
                    <span className="text-[10px] text-slate-500 font-mono">{fmtRelative(a.timestamp)}</span>
                  </div>
                  <div className="text-slate-300 text-[11px]">{a.details}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Password Reset Modal */}
      {showPassModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade">
          <div className="w-full max-w-sm p-6 rounded-2xl bg-navy-900 border border-white/10 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-2">Set New Password</h3>
            <p className="text-xs text-slate-400 mb-4">
              Enter a new password for {user.full_name || user.email}:
            </p>
            <input
              type="text"
              value={newPass}
              onChange={(e) => setNewPass(e.target.value)}
              placeholder="Enter new password"
              className="w-full bg-navy-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 mb-4 focus:outline-none focus:border-cyan-400"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowPassModal(false)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => handleAction('reset_password', newPass)}
                disabled={!newPass.trim()}
                className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-bold transition-colors disabled:opacity-50"
              >
                Confirm Update
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
