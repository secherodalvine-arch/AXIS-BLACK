import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  Radio, RefreshCw, Monitor, Smartphone, Globe,
  Zap, Activity, MapPin, Eye, Tablet, Wifi, WifiOff, Clock,
  Calendar, Search, Filter, ArrowUpRight, TrendingUp, Layers,
  ChevronRight, Download, MousePointerClick, CheckCircle2, History
} from 'lucide-react';
import api from '@/api/client';
import { useAdminStore } from '@/store';
import { fmtRelative, fmtDateTime } from '@/utils/formatDate';

/* ── types ─────────────────────────────────────────────────── */
interface Session {
  identifier: string;
  user_id?: string;
  user_name?: string;
  user_email?: string;
  visitor_id?: string;
  current_page?: string;
  page?: string;
  device_type?: string;
  browser?: string;
  os?: string;
  screen_resolution?: string;
  ip?: string;
  city?: string;
  country?: string;
  location?: string;
  local_time?: string;
  timezone?: string;
  last_seen: string;
  timestamp?: string;
  event?: string;
  is_active?: boolean;
}

interface LiveEvent {
  id?: string;
  identifier: string;
  user_name?: string;
  user_email?: string;
  visitor_id?: string;
  event: string;
  page: string;
  device?: string;
  device_type?: string;
  browser?: string;
  os?: string;
  screen_resolution?: string;
  location?: string;
  city?: string;
  country?: string;
  ip?: string;
  local_time?: string;
  timezone?: string;
  timestamp: string;
  last_seen?: string;
}

interface HistorySummary {
  timeframe: string;
  scope: string;
  total_records: number;
  unique_visitors: number;
  page_views: number;
  cta_clicks: number;
  devices: {
    desktop: number;
    mobile: number;
    tablet: number;
  };
  top_pages: Array<{ page: string; count: number }>;
}

/* ── helpers ────────────────────────────────────────────────── */
const isHomepagePath = (page?: string, event?: string) => {
  const p = (page || '').toLowerCase();
  const e = (event || '').toLowerCase();
  return (
    e === 'homepage_visit' ||
    e === 'cta_click' ||
    p === '/' || p === '' || p === '/home' || p === '/landing' ||
    /^\/(features|pricing|security|contact|landing)/.test(p)
  );
};

const isHomepageEvent = (ev: LiveEvent) => isHomepagePath(ev.page, ev.event);
const isAppEvent = (ev: LiveEvent) => !isHomepageEvent(ev);

const DeviceIcon = ({ type }: { type?: string }) => {
  const t = (type || '').toLowerCase();
  if (t === 'mobile') return <Smartphone size={13} className="text-violet-400" />;
  if (t === 'tablet') return <Tablet size={13} className="text-amber-400" />;
  return <Monitor size={13} className="text-cyan-400" />;
};

const badgeColor = (ev: string) => {
  switch (ev) {
    case 'homepage_visit': return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25';
    case 'cta_click':     return 'bg-amber-500/15 text-amber-400 border-amber-500/25';
    case 'navigate':      return 'bg-cyan-500/15 text-cyan-400 border-cyan-500/25';
    case 'page_view':     return 'bg-blue-500/15 text-blue-400 border-blue-500/25';
    case 'login':         return 'bg-teal-500/15 text-teal-400 border-teal-500/25';
    case 'signup':        return 'bg-pink-500/15 text-pink-400 border-pink-500/25';
    case 'heartbeat':     return 'bg-slate-500/15 text-slate-400 border-slate-500/20';
    default:              return 'bg-violet-500/15 text-violet-400 border-violet-500/25';
  }
};

/* ═══════════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════════ */
export function LiveMonitor() {
  const { admin, token } = useAdminStore();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [recentHomepageVisits, setRecentHomepageVisits] = useState<Session[]>([]);
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [wsStatus, setWsStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  
  // Navigation tabs: Active Sessions, Homepage Traffic, Traffic & Events History, Live Stream
  const [activeView, setActiveView] = useState<'sessions' | 'traffic' | 'history' | 'events'>('sessions');

  // History Tab state
  const [historyTimeframe, setHistoryTimeframe] = useState<'today' | 'yesterday' | '7d' | '30d' | 'all'>('today');
  const [historyScope, setHistoryScope] = useState<'all' | 'homepage' | 'app'>('all');
  const [historyEventType, setHistoryEventType] = useState<string>('all');
  const [historySearch, setHistorySearch] = useState('');
  const [historyRecords, setHistoryRecords] = useState<LiveEvent[]>([]);
  const [historySummary, setHistorySummary] = useState<HistorySummary | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);

  /* ── Fetch sessions & homepage visits ───────────────────────── */
  const fetchSessions = useCallback(async () => {
    try {
      const [sessRes, hpRes] = await Promise.all([
        api.get('/live-sessions'),
        api.get('/traffic/homepage').catch(() => ({ data: { data: null } }))
      ]);
      setSessions(sessRes.data.data || []);
      if (hpRes.data?.data?.recent_visits) {
        setRecentHomepageVisits(hpRes.data.data.recent_visits);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  /* ── Fetch Traffic History ──────────────────────────────────── */
  const fetchTrafficHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await api.get('/traffic/history', {
        params: {
          timeframe: historyTimeframe,
          scope: historyScope,
          event_type: historyEventType !== 'all' ? historyEventType : undefined,
          limit: 300
        }
      });
      if (res.data?.success) {
        setHistoryRecords(res.data.data || []);
        setHistorySummary(res.data.summary || null);
      }
    } catch (e) {
      console.warn('Could not fetch traffic history:', e);
    } finally {
      setHistoryLoading(false);
    }
  }, [historyTimeframe, historyScope, historyEventType]);

  useEffect(() => {
    fetchSessions();
    const iv = setInterval(fetchSessions, 10_000);
    return () => clearInterval(iv);
  }, [fetchSessions]);

  useEffect(() => {
    if (activeView === 'history') {
      fetchTrafficHistory();
    }
  }, [activeView, fetchTrafficHistory]);

  /* ── WebSocket for real-time feed ───────────────────────────── */
  useEffect(() => {
    if (!admin?.id || !token) return;

    const envWs = (import.meta.env.VITE_WS_URL as string | undefined ?? '').trim().replace(/\/+$/, '');
    const envApi = (import.meta.env.VITE_API_URL as string | undefined ?? '').trim().replace(/\/+$/, '');
    let wsBase = '';
    if (envWs) {
      wsBase = envWs;
    } else if (envApi) {
      try {
        const u = new URL(envApi);
        wsBase = `${u.protocol === 'https:' ? 'wss:' : 'ws:'}//${u.host}`;
      } catch {
        wsBase = envApi.replace(/^http/, 'ws');
      }
    } else {
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      wsBase = `${proto}//${window.location.hostname}:8000`;
    }

    const wsUrl = `${wsBase}/api/admin/ws/${admin.id}?token=${token}`;
    setWsStatus('connecting');
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => setWsStatus('connected');
    ws.onclose = () => setWsStatus('disconnected');
    ws.onerror = () => setWsStatus('disconnected');

    ws.onmessage = (e) => {
      try {
        const msg: LiveEvent = JSON.parse(e.data);
        if (msg.type === 'traffic_event' || msg.event) {
          const page = (msg.page || '').toLowerCase();
          if (page.startsWith('/admin')) return;
          setLiveEvents(prev => [msg, ...prev].slice(0, 50));
          fetchSessions();
        }
      } catch {}
    };

    const ping = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.send('ping');
    }, 15_000);

    return () => { clearInterval(ping); ws.close(); };
  }, [admin?.id, token, fetchSessions]);

  /* ── Derived data ───────────────────────────────────────────── */
  const userSessions = useMemo(() => {
    return sessions.filter(s => {
      const p = (s.current_page || s.page || '').toLowerCase();
      return !p.startsWith('/admin') && !p.startsWith('/api/admin');
    });
  }, [sessions]);

  // Real-time active clients on homepage
  const activeHomepageSessions = useMemo(() => {
    return userSessions.filter(s => isHomepagePath(s.current_page || s.page, s.event));
  }, [userSessions]);

  // Combined detailed homepage traffic list (Live active sessions + recent visitor records)
  const combinedHomepageTraffic = useMemo(() => {
    const list: Session[] = [];
    const seenKeys = new Set<string>();

    // 1. First add all currently live homepage sessions
    activeHomepageSessions.forEach(s => {
      const key = s.ip || s.visitor_id || s.identifier;
      if (key) seenKeys.add(key);
      list.push({ ...s, is_active: true });
    });

    // 2. Add recent recorded homepage visits
    recentHomepageVisits.forEach(v => {
      const key = v.ip || v.visitor_id || v.identifier;
      if (!key || !seenKeys.has(key)) {
        if (key) seenKeys.add(key);
        list.push({ ...v, is_active: false });
      }
    });

    return list;
  }, [activeHomepageSessions, recentHomepageVisits]);

  const appSessions = userSessions.filter(s => !isHomepagePath(s.current_page || s.page, s.event));
  const desktops = userSessions.filter(s => (s.device_type || '').toLowerCase() === 'desktop').length;
  const mobiles  = userSessions.filter(s => (s.device_type || '').toLowerCase() === 'mobile').length;
  const tablets  = userSessions.filter(s => (s.device_type || '').toLowerCase() === 'tablet').length;

  const homepageLiveEvents = liveEvents.filter(isHomepageEvent);
  const appLiveEvents      = liveEvents.filter(isAppEvent);

  // Filtered historical records based on search query
  const filteredHistoryRecords = useMemo(() => {
    if (!historySearch.trim()) return historyRecords;
    const q = historySearch.toLowerCase();
    return historyRecords.filter(r =>
      (r.user_name || '').toLowerCase().includes(q) ||
      (r.user_email || '').toLowerCase().includes(q) ||
      (r.visitor_id || '').toLowerCase().includes(q) ||
      (r.page || '').toLowerCase().includes(q) ||
      (r.event || '').toLowerCase().includes(q) ||
      (r.ip || '').toLowerCase().includes(q) ||
      (r.location || '').toLowerCase().includes(q)
    );
  }, [historyRecords, historySearch]);

  /* ── Export History to CSV Helper ──────────────────────────── */
  const exportHistoryCSV = () => {
    if (filteredHistoryRecords.length === 0) return;
    const headers = ['Timestamp', 'Event', 'User / Visitor', 'Page', 'Device', 'Browser', 'OS', 'Location', 'IP', 'Local Time'];
    const rows = filteredHistoryRecords.map(r => [
      `"${r.timestamp || ''}"`,
      `"${r.event || ''}"`,
      `"${r.user_name || r.user_email || r.visitor_id || 'Visitor'}"`,
      `"${r.page || '/'}"`,
      `"${r.device_type || 'Desktop'}"`,
      `"${r.browser || ''}"`,
      `"${r.os || ''}"`,
      `"${r.location || r.city || ''}"`,
      `"${r.ip || ''}"`,
      `"${r.local_time || ''}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `axis-traffic-history-${historyTimeframe}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  /* ── KPI cards ──────────────────────────────────────────────── */
  const kpis = [
    { label: 'Live Sessions', value: userSessions.length, sub: 'Active in last 15 min', color: 'text-emerald-400', border: 'border-emerald-500/20', icon: Radio, pulse: true },
    { label: 'Homepage Visitors', value: combinedHomepageTraffic.length, sub: `${activeHomepageSessions.length} currently live`, color: 'text-cyan-400', border: 'border-cyan-500/20', icon: Globe },
    { label: 'App Users', value: appSessions.length, sub: 'Inside platform dashboard', color: 'text-violet-400', border: 'border-violet-500/20', icon: Activity },
    { label: 'Device Footprint', value: `${desktops} Desktop`, sub: `${mobiles} mobile · ${tablets} tablet`, color: 'text-amber-400', border: 'border-amber-500/20', icon: Monitor },
  ];

  return (
    <div className="space-y-6 animate-fade max-w-7xl mx-auto">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] flex items-center gap-2.5">
            <Radio size={22} className="text-emerald-400 animate-pulse" />
            Live Traffic Monitor &amp; History
          </h1>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Real-time connected sessions, homepage visitors, and historical telemetry performance
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* WS status pill */}
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold border ${
            wsStatus === 'connected'
              ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
              : wsStatus === 'connecting'
              ? 'bg-amber-500/10 border-amber-500/25 text-amber-400'
              : 'bg-slate-500/10 border-slate-500/20 text-slate-400'
          }`}>
            {wsStatus === 'connected' ? <Wifi size={11} /> : <WifiOff size={11} />}
            {wsStatus === 'connected' ? 'Live' : wsStatus === 'connecting' ? 'Connecting…' : 'Offline'}
          </span>

          <button
            onClick={() => {
              fetchSessions();
              if (activeView === 'history') fetchTrafficHistory();
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[var(--bg-hover)] border border-[var(--border)] text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
          >
            <RefreshCw size={13} className={loading || historyLoading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── KPI row ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(({ label, value, sub, color, border, icon: Icon, pulse }) => (
          <div key={label} className={`p-4 rounded-2xl bg-[var(--bg-card)] border ${border} shadow-[var(--shadow-card)]`}>
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-[var(--text-muted)]">{label}</div>
              <Icon size={18} className={`${color} ${pulse ? 'animate-pulse' : ''}`} />
            </div>
            <div className={`text-2xl sm:text-3xl font-extrabold ${color} mt-2`}>{value}</div>
            <div className="text-[10px] text-[var(--text-subtle)] mt-0.5">{sub}</div>
          </div>
        ))}
      </div>

      {/* ── Main Tab Selector ───────────────────────────────────── */}
      <div className="flex flex-wrap gap-1.5 p-1 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border)] w-fit">
        {([
          { id: 'sessions', label: 'Active Sessions', count: userSessions.length, icon: Eye },
          { id: 'traffic',  label: 'Homepage Traffic', count: combinedHomepageTraffic.length, icon: Globe },
          { id: 'history',  label: 'Traffic & Events History', count: historySummary?.total_records ?? historyRecords.length, icon: History },
          { id: 'events',   label: 'Live Stream', count: liveEvents.length, icon: Zap },
        ] as { id: typeof activeView; label: string; count: number; icon: any }[]).map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setActiveView(t.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeView === t.id
                  ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm border border-[var(--border)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] border border-transparent'
              }`}
            >
              <Icon size={14} className={activeView === t.id ? 'text-cyan-400' : 'text-slate-400'} />
              <span>{t.label}</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                activeView === t.id ? 'bg-cyan-500/20 text-cyan-400' : 'bg-[var(--bg-hover)] text-[var(--text-subtle)]'
              }`}>
                {t.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── TAB 1: ACTIVE CONNECTED CLIENTS TABLE ───────────────── */}
      {activeView === 'sessions' && (
        <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] shadow-[var(--shadow-card)] overflow-hidden">
          <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
            <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
              <Eye size={15} className="text-cyan-400" />
              Connected Clients ({userSessions.length})
            </h3>
            <span className="text-[11px] text-[var(--text-subtle)]">Auto-refreshed every 10s</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[750px]">
              <thead>
                <tr className="border-b border-[var(--border)] text-[var(--text-muted)] bg-[var(--bg-elevated)]">
                  <th className="py-3 px-4 font-semibold">User / Session</th>
                  <th className="py-3 px-4 font-semibold">Current Page</th>
                  <th className="py-3 px-4 font-semibold">Device</th>
                  <th className="py-3 px-4 font-semibold">Location · IP</th>
                  <th className="py-3 px-4 font-semibold">Local Time</th>
                  <th className="py-3 px-4 font-semibold text-right">Last Seen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {userSessions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-[var(--text-subtle)]">
                      No active sessions right now. Open the user platform to populate real-time data.
                    </td>
                  </tr>
                ) : (
                  userSessions.map((s, i) => (
                    <tr key={s.identifier || i} className="hover:bg-[var(--bg-hover)] transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-[var(--text-primary)] flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                          {s.user_name || 'Anonymous Visitor'}
                        </div>
                        <div className="text-[10px] text-[var(--text-subtle)] font-mono truncate max-w-[170px] mt-0.5">
                          {s.user_email || s.visitor_id || s.identifier}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-lg bg-cyan-500/10 border border-cyan-500/15 text-cyan-400 font-mono text-[11px]">
                          {s.current_page || s.page || '/'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 text-[var(--text-muted)] font-medium">
                          <DeviceIcon type={s.device_type} />
                          {s.browser || 'Browser'} · {s.os || 'OS'}
                        </div>
                        <div className="text-[10px] text-[var(--text-subtle)] font-mono mt-0.5">
                          {s.screen_resolution || '—'}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 text-[var(--text-muted)] font-medium">
                          <MapPin size={12} className="text-cyan-400 shrink-0" />
                          <span>{s.location || s.city || 'Local'}</span>
                        </div>
                        <div className="text-[10px] text-[var(--text-subtle)] font-mono mt-0.5">{s.ip || '—'}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="text-cyan-400 font-mono text-[11px] font-semibold">{s.local_time || '—'}</div>
                        <div className="text-[10px] text-[var(--text-subtle)]">{s.timezone || 'UTC'}</div>
                      </td>
                      <td className="py-3.5 px-4 text-right text-[var(--text-subtle)] font-mono text-[11px]">
                        {fmtRelative(s.last_seen || s.timestamp)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 2: HOMEPAGE TRAFFIC DETAILED TABLE ──────────────── */}
      {activeView === 'traffic' && (
        <div className="space-y-4">
          {/* Homepage Mini Stats Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border)]">
              <span className="text-[11px] text-[var(--text-muted)] font-medium">Live On Homepage</span>
              <div className="text-xl font-bold text-emerald-400 mt-1 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                {activeHomepageSessions.length}
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border)]">
              <span className="text-[11px] text-[var(--text-muted)] font-medium">Recorded Landing Views</span>
              <div className="text-xl font-bold text-cyan-400 mt-1">
                {combinedHomepageTraffic.length}
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border)]">
              <span className="text-[11px] text-[var(--text-muted)] font-medium">Live CTA Interactions</span>
              <div className="text-xl font-bold text-amber-400 mt-1">
                {homepageLiveEvents.filter(e => e.event === 'cta_click').length}
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border)]">
              <span className="text-[11px] text-[var(--text-muted)] font-medium">Desktop / Mobile Split</span>
              <div className="text-xl font-bold text-violet-400 mt-1">
                {combinedHomepageTraffic.length > 0
                  ? `${Math.round((combinedHomepageTraffic.filter(s => (s.device_type || '').toLowerCase() === 'desktop').length / combinedHomepageTraffic.length) * 100)}% Desk`
                  : '—'}
              </div>
            </div>
          </div>

          {/* Detailed Homepage Visitors Table */}
          <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] shadow-[var(--shadow-card)] overflow-hidden">
            <div className="p-4 border-b border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <Globe size={15} className="text-emerald-400" />
                  Homepage &amp; Landing Traffic ({combinedHomepageTraffic.length})
                </h3>
                <p className="text-[11px] text-[var(--text-subtle)] mt-0.5">
                  Detailed client breakdown for landing page visitors, marketing routes, and CTA interactions
                </p>
              </div>
              <span className="text-[11px] text-[var(--text-subtle)] font-mono">
                {activeHomepageSessions.length} active now
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[750px]">
                <thead>
                  <tr className="border-b border-[var(--border)] text-[var(--text-muted)] bg-[var(--bg-elevated)]">
                    <th className="py-3 px-4 font-semibold">User / Session</th>
                    <th className="py-3 px-4 font-semibold">Current Page</th>
                    <th className="py-3 px-4 font-semibold">Device</th>
                    <th className="py-3 px-4 font-semibold">Location · IP</th>
                    <th className="py-3 px-4 font-semibold">Local Time</th>
                    <th className="py-3 px-4 font-semibold text-right">Last Seen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {combinedHomepageTraffic.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-16 text-center text-[var(--text-subtle)]">
                        <Globe size={28} className="mx-auto text-slate-600 mb-2" />
                        <div>No homepage visitors recorded yet.</div>
                        <div className="text-[11px] text-slate-500 mt-1">Visit the landing page to capture visitor telemetry.</div>
                      </td>
                    </tr>
                  ) : (
                    combinedHomepageTraffic.map((s, i) => {
                      const isLive = s.is_active || activeHomepageSessions.some(a => a.identifier === s.identifier);
                      return (
                        <tr key={s.identifier || s.visitor_id || i} className="hover:bg-[var(--bg-hover)] transition-colors">
                          {/* 1. User / Session */}
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-[var(--text-primary)] flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full shrink-0 ${isLive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                              <span>{s.user_name || 'Anonymous Visitor'}</span>
                              {isLive && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase">
                                  LIVE
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-[var(--text-subtle)] font-mono truncate max-w-[170px] mt-0.5">
                              {s.user_email || s.visitor_id || s.identifier}
                            </div>
                          </td>

                          {/* 2. Current Page */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="px-2 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono text-[11px]">
                                {s.current_page || s.page || '/'}
                              </span>
                              {s.event && s.event !== 'page_view' && (
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border uppercase ${badgeColor(s.event)}`}>
                                  {s.event.replace('_', ' ')}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* 3. Device */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5 text-[var(--text-muted)] font-medium">
                              <DeviceIcon type={s.device_type} />
                              <span>{s.browser || 'Browser'} · {s.os || 'OS'}</span>
                            </div>
                            <div className="text-[10px] text-[var(--text-subtle)] font-mono mt-0.5">
                              {s.screen_resolution || '—'}
                            </div>
                          </td>

                          {/* 4. Location · IP */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5 text-[var(--text-muted)] font-medium">
                              <MapPin size={12} className="text-emerald-400 shrink-0" />
                              <span>{s.location || s.city || 'Local'}</span>
                            </div>
                            <div className="text-[10px] text-[var(--text-subtle)] font-mono mt-0.5">
                              {s.ip || '—'}
                            </div>
                          </td>

                          {/* 5. Local Time */}
                          <td className="py-3.5 px-4">
                            <div className="text-cyan-400 font-mono text-[11px] font-semibold">{s.local_time || '—'}</div>
                            <div className="text-[10px] text-[var(--text-subtle)]">{s.timezone || 'UTC'}</div>
                          </td>

                          {/* 6. Last Seen */}
                          <td className="py-3.5 px-4 text-right text-[var(--text-subtle)] font-mono text-[11px]">
                            <div>{fmtRelative(s.last_seen || s.timestamp)}</div>
                            <div className="text-[10px] text-slate-500 mt-0.5">{fmtDateTime(s.last_seen || s.timestamp)}</div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 3: TRAFFIC & EVENTS HISTORY (Today, Yesterday, 7d, etc.) ── */}
      {activeView === 'history' && (
        <div className="space-y-4">
          {/* Timeframe & Scope Controls */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] shadow-[var(--shadow-card)]">
            {/* Timeframe selector: Today, Yesterday, 7d, 30d, all */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-semibold text-[var(--text-muted)] mr-1 flex items-center gap-1">
                <Calendar size={13} className="text-cyan-400" /> Timeframe:
              </span>
              {(['today', 'yesterday', '7d', '30d', 'all'] as const).map(tf => (
                <button
                  key={tf}
                  onClick={() => setHistoryTimeframe(tf)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all cursor-pointer border ${
                    historyTimeframe === tf
                      ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300 shadow-sm'
                      : 'bg-[var(--bg-subtle)] border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {tf === '7d' ? 'Last 7 Days' : tf === '30d' ? 'Last 30 Days' : tf}
                </button>
              ))}
            </div>

            {/* Scope: All, Homepage, App */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border)] text-xs">
                {(['all', 'homepage', 'app'] as const).map(sc => (
                  <button
                    key={sc}
                    onClick={() => setHistoryScope(sc)}
                    className={`px-2.5 py-1 rounded-lg font-semibold capitalize transition-all cursor-pointer ${
                      historyScope === sc
                        ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {sc === 'all' ? 'All Traffic' : sc === 'homepage' ? 'Homepage Only' : 'App Only'}
                  </button>
                ))}
              </div>

              <button
                onClick={exportHistoryCSV}
                title="Export filtered records to CSV"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                <Download size={13} />
                <span className="hidden sm:inline">Export CSV</span>
              </button>
            </div>
          </div>

          {/* Historical Performance Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="p-3.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border)]">
              <span className="text-[11px] text-[var(--text-muted)] font-medium">Total Events Recorded</span>
              <div className="text-xl font-bold text-cyan-400 mt-1">
                {historySummary?.total_records ?? historyRecords.length}
              </div>
              <div className="text-[10px] text-[var(--text-subtle)] mt-0.5 capitalize">{historyTimeframe} period</div>
            </div>

            <div className="p-3.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border)]">
              <span className="text-[11px] text-[var(--text-muted)] font-medium">Unique Visitors</span>
              <div className="text-xl font-bold text-violet-400 mt-1">
                {historySummary?.unique_visitors ?? '—'}
              </div>
              <div className="text-[10px] text-[var(--text-subtle)] mt-0.5">Deduplicated by IP &amp; ID</div>
            </div>

            <div className="p-3.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border)]">
              <span className="text-[11px] text-[var(--text-muted)] font-medium">Page Views</span>
              <div className="text-xl font-bold text-emerald-400 mt-1">
                {historySummary?.page_views ?? '—'}
              </div>
              <div className="text-[10px] text-[var(--text-subtle)] mt-0.5">Total navigations</div>
            </div>

            <div className="p-3.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border)]">
              <span className="text-[11px] text-[var(--text-muted)] font-medium">CTA &amp; Interactions</span>
              <div className="text-xl font-bold text-amber-400 mt-1">
                {historySummary?.cta_clicks ?? '—'}
              </div>
              <div className="text-[10px] text-[var(--text-subtle)] mt-0.5">Buttons &amp; action clicks</div>
            </div>

            <div className="p-3.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] col-span-2 lg:col-span-1">
              <span className="text-[11px] text-[var(--text-muted)] font-medium">Top Visited Page</span>
              <div className="text-xs font-bold text-white mt-1 truncate font-mono">
                {historySummary?.top_pages?.[0]?.page || '/'}
              </div>
              <div className="text-[10px] text-cyan-400 mt-0.5">
                {historySummary?.top_pages?.[0]?.count ? `${historySummary.top_pages[0].count} visits` : '0 visits'}
              </div>
            </div>
          </div>

          {/* Records Search and Event Filter */}
          <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] shadow-[var(--shadow-card)] overflow-hidden">
            <div className="p-4 border-b border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search size={14} className="absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder="Search user, visitor ID, IP, page, or event..."
                  className="w-full bg-[var(--bg-input)] border border-[var(--border)] rounded-xl pl-9 pr-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--text-muted)] flex items-center gap-1">
                  <Filter size={12} /> Event Type:
                </span>
                <select
                  value={historyEventType}
                  onChange={(e) => setHistoryEventType(e.target.value)}
                  className="bg-[var(--bg-input)] border border-[var(--border)] rounded-xl px-2.5 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-cyan-400"
                >
                  <option value="all">All Events</option>
                  <option value="homepage_visit">Homepage Visit</option>
                  <option value="cta_click">CTA Click</option>
                  <option value="page_view">Page View</option>
                  <option value="navigate">Navigate</option>
                  <option value="heartbeat">Heartbeat</option>
                </select>
              </div>
            </div>

            {/* Historical Records Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[850px]">
                <thead>
                  <tr className="border-b border-[var(--border)] text-[var(--text-muted)] bg-[var(--bg-elevated)]">
                    <th className="py-3 px-4 font-semibold">User / Session</th>
                    <th className="py-3 px-4 font-semibold">Event / Action</th>
                    <th className="py-3 px-4 font-semibold">Page / Route</th>
                    <th className="py-3 px-4 font-semibold">Device</th>
                    <th className="py-3 px-4 font-semibold">Location · IP</th>
                    <th className="py-3 px-4 font-semibold">Local Time</th>
                    <th className="py-3 px-4 font-semibold text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {historyLoading ? (
                    <tr>
                      <td colSpan={7} className="py-16 text-center text-[var(--text-muted)]">
                        <RefreshCw size={22} className="animate-spin text-cyan-400 mx-auto mb-2" />
                        <span>Loading historical telemetry records for {historyTimeframe}…</span>
                      </td>
                    </tr>
                  ) : filteredHistoryRecords.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-16 text-center text-[var(--text-subtle)]">
                        <History size={26} className="mx-auto text-slate-600 mb-2" />
                        <div>No traffic or interaction records found for {historyTimeframe}.</div>
                        <div className="text-[11px] text-slate-500 mt-1">Try expanding your timeframe or clearing filters.</div>
                      </td>
                    </tr>
                  ) : (
                    filteredHistoryRecords.map((r, i) => (
                      <tr key={r.id || `${r.identifier}-${i}`} className="hover:bg-[var(--bg-hover)] transition-colors">
                        {/* 1. User / Session */}
                        <td className="py-3 px-4">
                          <div className="font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />
                            <span>{r.user_name || 'Visitor'}</span>
                          </div>
                          <div className="text-[10px] text-[var(--text-subtle)] font-mono truncate max-w-[150px] mt-0.5">
                            {r.user_email || r.visitor_id || r.identifier}
                          </div>
                        </td>

                        {/* 2. Event / Action */}
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border uppercase ${badgeColor(r.event)}`}>
                            {r.event ? r.event.replace('_', ' ') : 'EVENT'}
                          </span>
                        </td>

                        {/* 3. Page / Route */}
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-lg bg-cyan-500/10 border border-cyan-500/15 text-cyan-400 font-mono text-[11px]">
                            {r.page || '/'}
                          </span>
                        </td>

                        {/* 4. Device */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5 text-[var(--text-muted)] font-medium">
                            <DeviceIcon type={r.device_type} />
                            <span>{r.browser || 'Browser'} · {r.os || 'OS'}</span>
                          </div>
                          <div className="text-[10px] text-[var(--text-subtle)] font-mono mt-0.5">
                            {r.screen_resolution || '—'}
                          </div>
                        </td>

                        {/* 5. Location · IP */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5 text-[var(--text-muted)] font-medium">
                            <MapPin size={11} className="text-cyan-400 shrink-0" />
                            <span>{r.location || r.city || 'Local'}</span>
                          </div>
                          <div className="text-[10px] text-[var(--text-subtle)] font-mono mt-0.5">
                            {r.ip || '—'}
                          </div>
                        </td>

                        {/* 6. Local Time */}
                        <td className="py-3 px-4">
                          <div className="text-cyan-400 font-mono text-[11px] font-semibold">{r.local_time || '—'}</div>
                          <div className="text-[10px] text-[var(--text-subtle)]">{r.timezone || 'UTC'}</div>
                        </td>

                        {/* 7. Timestamp */}
                        <td className="py-3 px-4 text-right text-[var(--text-subtle)] font-mono text-[11px]">
                          <div>{fmtDateTime(r.timestamp)}</div>
                          <div className="text-[10px] text-slate-500">{fmtRelative(r.timestamp)}</div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 4: REAL-TIME IN-APP & HOMEPAGE EVENT STREAM ─────── */}
      {activeView === 'events' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Homepage Events Stream */}
          <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] shadow-[var(--shadow-card)] overflow-hidden">
            <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
              <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                <Globe size={15} className="text-emerald-400" />
                Live Homepage Stream
                <span className="text-[10px] text-[var(--text-subtle)] font-normal ml-1">Landing pages &amp; CTAs</span>
              </h3>
              <span className="text-[11px] text-[var(--text-subtle)]">{homepageLiveEvents.length} events</span>
            </div>
            {homepageLiveEvents.length === 0 ? (
              <div className="py-16 text-center text-[var(--text-subtle)] text-xs">
                Awaiting homepage visitor activity…
              </div>
            ) : (
              <div className="divide-y divide-[var(--border)] max-h-[460px] overflow-y-auto">
                {homepageLiveEvents.map((ev, i) => (
                  <div key={i} className="p-3.5 flex items-center gap-3 hover:bg-[var(--bg-hover)] transition-colors animate-fade">
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border uppercase shrink-0 ${badgeColor(ev.event)}`}>
                      {ev.event.replace('_', ' ')}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="font-semibold text-[var(--text-primary)] text-xs">{ev.user_name || 'Visitor'}</span>
                      <span className="text-[var(--text-subtle)] text-xs mx-1.5">&rarr;</span>
                      <span className="font-mono text-[11px] text-emerald-400">{ev.page}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-[var(--text-subtle)] shrink-0 font-mono">
                      <span>{ev.location || 'Local'}</span>
                      <span>{fmtRelative(ev.timestamp)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* In-App Events Stream */}
          <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] shadow-[var(--shadow-card)] overflow-hidden">
            <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
              <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                <Zap size={15} className="text-amber-400" />
                Live In-App Stream
                <span className="text-[10px] text-[var(--text-subtle)] font-normal ml-1">Dashboard &amp; modules</span>
              </h3>
              <span className="text-[11px] text-[var(--text-subtle)]">{appLiveEvents.length} events</span>
            </div>
            {appLiveEvents.length === 0 ? (
              <div className="py-16 text-center text-[var(--text-subtle)] text-xs">
                Awaiting in-app user interactions…
              </div>
            ) : (
              <div className="divide-y divide-[var(--border)] max-h-[460px] overflow-y-auto">
                {appLiveEvents.map((ev, i) => (
                  <div key={i} className="p-3.5 flex items-center gap-3 hover:bg-[var(--bg-hover)] transition-colors animate-fade">
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border uppercase shrink-0 ${badgeColor(ev.event)}`}>
                      {ev.event.replace('_', ' ')}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="font-semibold text-[var(--text-primary)] text-xs">{ev.user_name || 'User'}</span>
                      <span className="text-[var(--text-subtle)] text-xs mx-1.5">&bull;</span>
                      <span className="font-mono text-[11px] text-cyan-400">{ev.page}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-[var(--text-subtle)] shrink-0 font-mono">
                      <span className="flex items-center gap-1"><DeviceIcon type={ev.device_type} />{ev.device_type || 'Desktop'}</span>
                      <span>{fmtRelative(ev.timestamp)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
