import React, { useEffect, useState, useCallback } from 'react';
import {
  CreditCard, DollarSign, TrendingUp, RefreshCw,
  ChevronLeft, ChevronRight, Search, Filter, Eye,
  CheckCircle, XCircle, Clock, Zap, Crown, X,
  Calendar, Hash, Smartphone, Globe, Download,
  BarChart2, Trash2, ShieldOff, ShieldCheck, UserPlus,
  AlertTriangle, Percent, ArrowUpRight, Copy, Check
} from 'lucide-react';
import api from '@/api/client';
import { useToastStore } from '@/store';
import { fmtDateTime } from '@/utils/formatDate';

// ── Types ────────────────────────────────────────────────────────────────────
interface Payment {
  _id: string;
  user_id: string;
  user_name?: string;
  user_email?: string;
  plan: string;
  amount_kes: number;
  fee_kes?: number;
  net_kes?: number;
  receipt_number?: string;
  payment_mode?: string;
  paid_at?: string;
  currency: string;
  channel?: string;
  status: 'pending' | 'paid' | 'failed' | 'rejected' | 'cancelled';
  provider: string;
  reference?: string;
  description?: string;
  expires_at?: string;
  created_at: string;
  approved_by?: string;
  notes?: string;
  phone?: string;
}

interface Stats {
  total_gross_kes: number;
  total_fees_kes: number;
  total_net_kes: number;
  paid_count: number;
  pending_count: number;
  active_starter: number;
  active_pro: number;
  plan_counts: Record<string, number>;
  revenue_today_kes: number;
  revenue_week_kes: number;
  revenue_month_kes: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmt(dt?: string | null) {
  if (!dt) return '—';
  const d = new Date(dt);
  return isNaN(d.getTime()) ? '—' : d.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

function fmtAgo(dt?: string | null) {
  if (!dt) return '—';
  const diff = Date.now() - new Date(dt).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function getSubStatus(p: Payment): {
  label: string; cls: string; timeLeft: string | null; isActive: boolean; isExpired: boolean;
} {
  if (p.status !== 'paid') {
    return { label: '—', cls: '', timeLeft: null, isActive: false, isExpired: false };
  }
  if (!p.expires_at) {
    return { label: 'Active', cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', timeLeft: null, isActive: true, isExpired: false };
  }
  const now = Date.now();
  const exp = new Date(p.expires_at).getTime();
  const diff = exp - now;
  if (diff <= 0) {
    return { label: 'Expired', cls: 'bg-rose-500/20 text-rose-400 border-rose-500/30', timeLeft: null, isActive: false, isExpired: true };
  }
  const totalMins = Math.floor(diff / 60000);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  const d = Math.floor(h / 24);
  const timeLeft = d > 0 ? `${d}d ${h % 24}h left` : h > 0 ? `${h}h ${m}m left` : `${m}m left`;

  if (diff < 24 * 3600_000) {
    return { label: 'Expiring Soon', cls: 'bg-amber-500/20 text-amber-400 border-amber-500/30', timeLeft, isActive: true, isExpired: false };
  }
  return { label: 'Active', cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', timeLeft, isActive: true, isExpired: false };
}

const PLAN_STYLE: Record<string, { label: string; cls: string; icon: any }> = {
  starter: { label: 'Starter', cls: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30', icon: Zap },
  pro: { label: 'Pro (3 Mo)', cls: 'bg-amber-500/20 text-amber-400 border-amber-500/30', icon: Crown },
  free: { label: 'Free', cls: 'bg-slate-500/20 text-slate-400 border-slate-500/30', icon: Globe },
};

const STATUS_CLS: Record<string, string> = {
  paid: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  pending: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  failed: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
  rejected: 'bg-rose-600/20 text-rose-500 border-rose-600/30',
  cancelled: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
};

// ── Assign Plan Modal ────────────────────────────────────────────────────────
function AssignPlanModal({ users, onClose, onDone }: {
  users: any[]; onClose: () => void; onDone: () => void;
}) {
  const { toast } = useToastStore();
  const [userId, setUserId] = useState('');
  const [plan, setPlan] = useState('starter');
  const [notes, setNotes] = useState('Manual assignment by administrator');
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = users.filter(u =>
    !search || `${u.name || ''} ${u.email || ''}`.toLowerCase().includes(search.toLowerCase())
  );

  const submit = async () => {
    if (!userId) {
      toast({ type: 'error', message: 'Please select a registered user account.' });
      return;
    }
    setLoading(true);
    try {
      await api.post('/payments/assign', { user_id: userId, plan, notes });
      toast({ type: 'success', message: `Plan ${plan.toUpperCase()} provisioned successfully!` });
      onDone();
      onClose();
    } catch (e: any) {
      toast({ type: 'error', message: e?.response?.data?.detail || 'Assignment failed' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="rounded-2xl shadow-2xl w-full max-w-md p-6 bg-navy-900 border border-white/10"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <UserPlus size={18} className="text-cyan-400" />
            <h3 className="font-bold text-white text-base">Provision Package to User</h3>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded-lg">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4 pt-4">
          <div>
            <label className="text-xs font-semibold text-slate-300 mb-1.5 block">Search &amp; Select User</label>
            <input
              type="text"
              placeholder="Filter by name or email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 mb-2 focus:outline-none focus:border-cyan-500"
            />
            <select
              value={userId}
              onChange={e => setUserId(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl bg-navy-800 border border-white/10 text-white focus:outline-none focus:border-cyan-500"
            >
              <option value="">-- Choose User ({filtered.length}) --</option>
              {filtered.map(u => (
                <option key={u.user_id || u.id} value={u.user_id || u.id}>
                  {u.name} — {u.email}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 mb-1.5 block">Package Tier</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPlan('starter')}
                className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                  plan === 'starter'
                    ? 'border-cyan-400 bg-cyan-500/10 text-white'
                    : 'border-white/10 bg-white/5 text-slate-400 hover:text-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-cyan-300">Starter</span>
                  <Zap size={14} className="text-cyan-400" />
                </div>
                <div className="text-[11px] font-mono text-slate-300">KES 899 / mo</div>
                <div className="text-[10px] text-slate-500">30 days validity</div>
              </button>

              <button
                type="button"
                onClick={() => setPlan('pro')}
                className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                  plan === 'pro'
                    ? 'border-amber-400 bg-amber-500/10 text-white'
                    : 'border-white/10 bg-white/5 text-slate-400 hover:text-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-amber-300">Pro Tier</span>
                  <Crown size={14} className="text-amber-400" />
                </div>
                <div className="text-[11px] font-mono text-slate-300">KES 2,299</div>
                <div className="text-[10px] text-slate-500">90 days (3 Months)</div>
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 mb-1.5 block">Administrative Notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              placeholder="e.g. Verified via direct M-Pesa Till payment..."
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-xl"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={loading || !userId}
              className="px-5 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg hover:shadow-cyan-500/20 disabled:opacity-50"
            >
              {loading ? 'Activating...' : 'Activate Subscription'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Payment Detail / Receipt Modal ───────────────────────────────────────────
function PaymentModal({ payment, onClose, onRefresh }: {
  payment: Payment; onClose: () => void; onRefresh: () => void;
}) {
  const { toast } = useToastStore();
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const act = async (action: 'approve' | 'reject' | 'revoke' | 'delete') => {
    const confirm = action === 'delete'
      ? window.confirm('Permanently delete this payment record from database?')
      : action === 'revoke'
      ? window.confirm('Deactivate this subscription? The user will immediately revert to Free tier.')
      : true;
    if (!confirm) return;

    setLoading(true);
    try {
      if (action === 'approve') await api.post(`/payments/${payment._id}/approve`, {});
      else if (action === 'reject') await api.post(`/payments/${payment._id}/reject`, {});
      else if (action === 'revoke') await api.post(`/payments/${payment._id}/revoke`, {});
      else if (action === 'delete') await api.delete(`/payments/${payment._id}`);
      toast({ type: 'success', message: `Payment ${action}d successfully` });
      onRefresh();
      onClose();
    } catch (e: any) {
      toast({ type: 'error', message: e?.response?.data?.detail || `${action} failed` });
    } finally {
      setLoading(false);
    }
  };

  const copyRef = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const planStyle = PLAN_STYLE[payment.plan] || PLAN_STYLE.starter;
  const isPending = payment.status === 'pending';
  const isPaid = payment.status === 'paid';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="rounded-2xl shadow-2xl w-full max-w-lg p-6 bg-navy-900 border border-white/10 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <CreditCard size={18} className="text-cyan-400" />
            <h3 className="font-bold text-white text-base">Payment &amp; Invoice Inspector</h3>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded-lg">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4 pt-4 text-xs">
          {/* Status banner */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase tracking-wider">Status</span>
              <span className={`inline-block px-2.5 py-0.5 mt-1 rounded-full text-xs font-semibold border ${STATUS_CLS[payment.status] || ''}`}>
                {payment.status.toUpperCase()}
              </span>
            </div>
            <div className="text-right">
              <span className="text-slate-400 block text-[10px] uppercase tracking-wider">Package</span>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 mt-1 rounded-full text-xs font-semibold border ${planStyle.cls}`}>
                {React.createElement(planStyle.icon, { size: 12 })}
                {planStyle.label}
              </span>
            </div>
          </div>

          {/* User info */}
          <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-400">Account Name:</span>
              <span className="font-semibold text-white">{payment.user_name || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Account Email:</span>
              <span className="font-mono text-cyan-300">{payment.user_email || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Phone Number:</span>
              <span className="font-mono text-white">{payment.phone || '—'}</span>
            </div>
          </div>

          {/* Financial Breakdown */}
          <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-2 font-mono">
            <div className="flex justify-between text-slate-300">
              <span>Gross Amount:</span>
              <span className="font-bold text-white">KES {payment.amount_kes.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Gateway / Processing Fee:</span>
              <span className="text-rose-400">- KES {(payment.fee_kes || 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-emerald-400 pt-2 border-t border-white/10 font-bold text-sm">
              <span>Net Platform Revenue:</span>
              <span>KES {(payment.net_kes || (payment.amount_kes - (payment.fee_kes || 0))).toLocaleString()}</span>
            </div>
          </div>

          {/* Transaction references */}
          <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Receipt Number:</span>
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-amber-300">{payment.receipt_number || '—'}</span>
                {payment.receipt_number && (
                  <button onClick={() => copyRef(payment.receipt_number!)} className="text-slate-500 hover:text-white">
                    {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                  </button>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Gateway Reference:</span>
              <span className="font-mono text-slate-300">{payment.reference || '—'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Payment Channel:</span>
              <span className="font-semibold text-white">{payment.payment_mode || payment.channel || '—'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Paid At:</span>
              <span className="text-slate-300">{fmt(payment.paid_at || payment.created_at)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Expires At:</span>
              <span className="text-slate-300">{fmt(payment.expires_at)}</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-white/10">
            <button
              onClick={() => act('delete')}
              disabled={loading}
              className="px-3 py-1.5 text-xs text-rose-400 hover:bg-rose-500/10 rounded-lg flex items-center gap-1 border border-rose-500/20"
            >
              <Trash2 size={13} /> Delete Record
            </button>

            <div className="flex items-center gap-2">
              {isPending && (
                <>
                  <button
                    onClick={() => act('reject')}
                    disabled={loading}
                    className="px-3 py-1.5 text-xs text-rose-400 hover:bg-rose-500/20 rounded-lg border border-rose-500/30"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => act('approve')}
                    disabled={loading}
                    className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-lg flex items-center gap-1.5"
                  >
                    <CheckCircle size={14} /> Approve &amp; Activate
                  </button>
                </>
              )}

              {isPaid && (
                <button
                  onClick={() => act('revoke')}
                  disabled={loading}
                  className="px-3.5 py-1.5 text-xs text-amber-400 hover:bg-amber-500/20 rounded-lg border border-amber-500/30 flex items-center gap-1.5"
                >
                  <ShieldOff size={13} /> Revoke Plan
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Admin Payments & Revenue Component ───────────────────────────────────
export function Payments() {
  const { toast } = useToastStore();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [planFilter, setPlanFilter] = useState('');

  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [assignModalOpen, setAssignModalOpen] = useState(false);

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, sRes, uRes] = await Promise.all([
        api.get('/payments', {
          params: { page, limit: 25, search, status: statusFilter, plan: planFilter }
        }),
        api.get('/payments/stats').catch(() => ({ data: { data: null } })),
        api.get('/users', { params: { page: 1, limit: 200 } }).catch(() => ({ data: { data: [] } }))
      ]);

      const pData = pRes.data?.data || [];
      const pagination = pRes.data?.pagination || {};
      setPayments(pData);
      setTotalPages(pagination.pages || 1);
      setTotalCount(pagination.total || pData.length);

      if (sRes.data?.data) {
        setStats(sRes.data.data);
      }
      if (uRes.data?.data) {
        setUsers(uRes.data.data);
      }
    } catch (err: any) {
      toast({ type: 'error', message: err?.response?.data?.detail || 'Failed to load payments data' });
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, planFilter, toast]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const handleExportCSV = async () => {
    try {
      const r = await api.get('/payments', {
        params: { page: 1, limit: 5000, search, status: statusFilter, plan: planFilter }
      });
      const rows = r.data?.data || [];
      if (!rows.length) {
        toast({ type: 'info', message: 'No payments found to export.' });
        return;
      }
      const headers = ['Receipt', 'User Name', 'User Email', 'Plan', 'Amount KES', 'Fee KES', 'Net KES', 'Channel', 'Status', 'Date', 'Expires'];
      const csvContent = [
        headers.join(','),
        ...rows.map((p: Payment) => [
          p.receipt_number || p.reference || '',
          `"${(p.user_name || '').replace(/"/g, '""')}"`,
          p.user_email || '',
          p.plan,
          p.amount_kes,
          p.fee_kes || 0,
          p.net_kes || (p.amount_kes - (p.fee_kes || 0)),
          p.payment_mode || p.channel || '',
          p.status,
          p.created_at,
          p.expires_at || ''
        ].join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Axis_Black_Revenue_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      toast({ type: 'success', message: `Exported ${rows.length} records to CSV.` });
    } catch {
      toast({ type: 'error', message: 'CSV export failed' });
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Top Header Strip ──────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <CreditCard className="text-cyan-400" /> Platform Revenue &amp; Billing
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time Paystack integration, M-Pesa Till verification, subscription tracking &amp; financial yield
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setAssignModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg hover:shadow-cyan-500/25 transition-all"
          >
            <UserPlus size={14} /> Assign Plan
          </button>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white/5 border border-white/10 hover:border-white/20 text-slate-300 hover:text-white transition-colors"
          >
            <Download size={14} /> Export CSV
          </button>

          <button
            onClick={fetchPayments}
            className="p-2 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 text-slate-300 hover:text-white transition-colors"
            title="Refresh Data"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* ── Metric KPI Cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Net Revenue */}
        <div className="p-5 rounded-2xl bg-navy-900 border border-emerald-500/20 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-400">Total Net Revenue</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <DollarSign size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-white mt-3 font-mono">
            KES {(stats?.total_net_kes || 0).toLocaleString()}
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2">
            <span>Gross: KES {(stats?.total_gross_kes || 0).toLocaleString()}</span>
            <span className="text-rose-400">Fees: KES {(stats?.total_fees_kes || 0).toLocaleString()}</span>
          </div>
        </div>

        {/* 30-Day Velocity */}
        <div className="p-5 rounded-2xl bg-navy-900 border border-cyan-500/20 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-cyan-400">30-Day Revenue</span>
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400">
              <TrendingUp size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-white mt-3 font-mono">
            KES {(stats?.revenue_month_kes || 0).toLocaleString()}
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2">
            <span>Today: KES {(stats?.revenue_today_kes || 0).toLocaleString()}</span>
            <span>7 Days: KES {(stats?.revenue_week_kes || 0).toLocaleString()}</span>
          </div>
        </div>

        {/* Active Subscriptions */}
        <div className="p-5 rounded-2xl bg-navy-900 border border-amber-500/20 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-400">Active Subscriptions</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
              <Crown size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-white mt-3 font-mono">
            {(stats?.active_starter || 0) + (stats?.active_pro || 0)}
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2">
            <span>Starter: {stats?.active_starter || 0}</span>
            <span className="text-amber-300 font-semibold">Pro: {stats?.active_pro || 0}</span>
          </div>
        </div>

        {/* Pending Till Review */}
        <div className="p-5 rounded-2xl bg-navy-900 border border-purple-500/20 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-purple-400">Pending Review</span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
              <Clock size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-white mt-3 font-mono">
            {stats?.pending_count || 0}
          </div>
          <div className="text-[11px] text-slate-400 mt-2">
            Total Paid Records: <strong className="text-white">{stats?.paid_count || 0}</strong>
          </div>
        </div>
      </div>

      {/* ── Search & Filter Controls ──────────────────────────────────────── */}
      <div className="p-4 rounded-2xl bg-navy-900 border border-white/10 flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="flex items-center gap-3 w-full md:w-auto flex-1">
          <div className="relative w-full max-w-sm">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search user, email, receipt or ref..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 text-xs rounded-xl bg-navy-800 border border-white/10 text-slate-300 focus:outline-none focus:border-cyan-500"
          >
            <option value="">All Statuses</option>
            <option value="paid">Paid &amp; Active</option>
            <option value="pending">Pending Review</option>
            <option value="rejected">Rejected</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <select
            value={planFilter}
            onChange={e => { setPlanFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 text-xs rounded-xl bg-navy-800 border border-white/10 text-slate-300 focus:outline-none focus:border-cyan-500"
          >
            <option value="">All Packages</option>
            <option value="starter">Starter (KES 899)</option>
            <option value="pro">Pro (KES 2,299)</option>
          </select>
        </div>

        <div className="text-xs text-slate-400 font-mono">
          Showing {payments.length} of {totalCount} records
        </div>
      </div>

      {/* ── Payments Data Table ───────────────────────────────────────────── */}
      <div className="rounded-2xl bg-navy-900 border border-white/10 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.02] text-slate-400 uppercase text-[10px] tracking-wider font-semibold">
                <th className="py-3 px-4">User / Account</th>
                <th className="py-3 px-4">Package</th>
                <th className="py-3 px-4">Channel / Mode</th>
                <th className="py-3 px-4">Amount KES</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Validity / Expiry</th>
                <th className="py-3 px-4">Receipt &amp; Ref</th>
                <th className="py-3 px-4">Created</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw size={16} className="animate-spin text-cyan-400" />
                      <span>Loading payments &amp; ledger data...</span>
                    </div>
                  </td>
                </tr>
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    No transactions found matching the filter criteria.
                  </td>
                </tr>
              ) : (
                payments.map(p => {
                  const planStyle = PLAN_STYLE[p.plan] || PLAN_STYLE.starter;
                  const subStat = getSubStatus(p);

                  return (
                    <tr
                      key={p._id}
                      className="hover:bg-white/[0.02] transition-colors cursor-pointer"
                      onClick={() => setSelectedPayment(p)}
                    >
                      {/* User */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-white">{p.user_name || 'Axis User'}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{p.user_email || '—'}</div>
                      </td>

                      {/* Package */}
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${planStyle.cls}`}>
                          {React.createElement(planStyle.icon, { size: 12 })}
                          {planStyle.label}
                        </span>
                      </td>

                      {/* Channel */}
                      <td className="py-3 px-4 text-slate-300">
                        <div className="flex items-center gap-1.5 font-medium">
                          {p.channel === 'mobile_money' || p.provider === 'mpesa_till' ? (
                            <Smartphone size={13} className="text-emerald-400" />
                          ) : p.channel === 'card' ? (
                            <CreditCard size={13} className="text-cyan-400" />
                          ) : (
                            <ShieldCheck size={13} className="text-amber-400" />
                          )}
                          <span>{p.payment_mode || p.channel || 'Card'}</span>
                        </div>
                      </td>

                      {/* Amount */}
                      <td className="py-3 px-4 font-mono">
                        <div className="font-bold text-white">KES {p.amount_kes.toLocaleString()}</div>
                        {p.fee_kes ? (
                          <div className="text-[10px] text-slate-500">Fee: KES {p.fee_kes}</div>
                        ) : null}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${STATUS_CLS[p.status] || ''}`}>
                          {p.status}
                        </span>
                      </td>

                      {/* Expiry */}
                      <td className="py-3 px-4">
                        {p.status === 'paid' ? (
                          <div>
                            <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-semibold border ${subStat.cls}`}>
                              {subStat.label}
                            </span>
                            {subStat.timeLeft && (
                              <div className="text-[10px] text-slate-400 mt-1 font-mono">{subStat.timeLeft}</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>

                      {/* Receipt & Ref */}
                      <td className="py-3 px-4 font-mono text-[11px]">
                        <div className="text-cyan-300 font-bold">{p.receipt_number || '—'}</div>
                        <div className="text-[10px] text-slate-500">{p.reference || '—'}</div>
                      </td>

                      {/* Created */}
                      <td className="py-3 px-4 text-slate-400 text-[11px]">
                        <div>{fmtAgo(p.created_at)}</div>
                        <div className="text-[10px] text-slate-500">{fmt(p.created_at)}</div>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedPayment(p)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
                            title="Inspect Payment Receipt"
                          >
                            <Eye size={14} />
                          </button>

                          {p.status === 'pending' && (
                            <button
                              onClick={async () => {
                                await api.post(`/payments/${p._id}/approve`, {});
                                toast({ type: 'success', message: 'Payment approved & plan activated' });
                                fetchPayments();
                              }}
                              className="px-2.5 py-1 text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow"
                              title="Approve M-Pesa Payment"
                            >
                              Approve
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ─────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between p-4 border-t border-white/10 text-xs text-slate-400">
          <div>
            Page <strong className="text-white">{page}</strong> of <strong className="text-white">{totalPages}</strong>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1.5 rounded-lg bg-white/5 border border-white/10 hover:border-white/20 disabled:opacity-30 disabled:pointer-events-none text-slate-300"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-1.5 rounded-lg bg-white/5 border border-white/10 hover:border-white/20 disabled:opacity-30 disabled:pointer-events-none text-slate-300"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Modals ────────────────────────────────────────────────────────── */}
      {selectedPayment && (
        <PaymentModal
          payment={selectedPayment}
          onClose={() => setSelectedPayment(null)}
          onRefresh={fetchPayments}
        />
      )}

      {assignModalOpen && (
        <AssignPlanModal
          users={users}
          onClose={() => setAssignModalOpen(false)}
          onDone={fetchPayments}
        />
      )}
    </div>
  );
}
export default Payments;
