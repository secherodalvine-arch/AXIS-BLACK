import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  Radio, RefreshCw, Monitor, Smartphone, Globe,
  Zap, Activity, MapPin, Eye, Tablet, Wifi, WifiOff, Clock
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
  event?: string;
}

interface LiveEvent {
  identifier: string;
  user_name?: string;
  user_email?: string;
  event: string;
  page: string;
  device?: string;
  device_type?: string;
  location?: string;
  ip?: string;
  local_time?: string;
  timestamp: string;
}

/* ── helpers ────────────────────────────────────────────────── */
const isHomepageEvent = (ev: LiveEvent) => {
  const p = (ev.page || '').toLowerCase();
  const e = (ev.event || '').toLowerCase();
  return (
    e === 'homepage_visit' ||
    e === 'cta_click' ||
    p === '/' || p === '' || p === '/home' || p === '/landing' ||
    /^\/(features|pricing|security|contact|landing)/.test(p)
  );
};

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
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [wsStatus, setWsStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const [activeView, setActiveView] = useState<'sessions' | 'traffic' | 'events'>('sessions');
  const wsRef = useRef<WebSocket | null>(null);

  /* ── Fetch sessions ─────────────────────────────────────────── */
  const fetchSessions = useCallback(async () => {
    try {
      const res = await api.get('/live-sessions');
      setSessions(res.data.data || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
    const iv = setInterval(fetchSessions, 10_000);
    return () => clearInterval(iv);
  }, [fetchSessions]);

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
  const userSessions = sessions.filter(s => {
    const p = (s.current_page || '').toLowerCase();
    return !p.startsWith('/admin') && !p.startsWith('/api/admin');
  });

  const homepageTraffic = userSessions.filter(s => {
    const p = (s.current_page || '').toLowerCase();
    return p === '/' || p === '' || p === '/home' || p === '/landing' ||
           /^\/(features|pricing|security|contact)/.test(p) ||
           s.event === 'homepage_visit' || s.event === 'cta_click';
  });

  const appSessions = userSessions.filter(s => {
    const p = (s.current_page || '').toLowerCase();
    const e = (s.event || '').toLowerCase();
    return !( p === '/' || p === '' || p === '/home' ||
              e === 'homepage_visit' || e === 'cta_click');
  });

  const desktops = userSessions.filter(s => (s.device_type || '').toLowerCase() === 'desktop').length;
  const mobiles  = userSessions.filter(s => (s.device_type || '').toLowerCase() === 'mobile').length;
  const tablets  = userSessions.filter(s => (s.device_type || '').toLowerCase() === 'tablet').length;

  const homepageLiveEvents = liveEvents.filter(isHomepageEvent);
  const appLiveEvents      = liveEvents.filter(isAppEvent);

  /* ── KPI cards ──────────────────────────────────────────────── */
  const kpis = [
    { label: 'Live Sessions', value: userSessions.length, sub: 'Active in last 15 min', color: 'text-emerald-400', border: 'border-emerald-500/20', icon: Radio, pulse: true },
    { label: 'Homepage Visitors', value: homepageTraffic.length, sub: 'On landing / public pages', color: 'text-cyan-400', border: 'border-cyan-500/20', icon: Globe },
    { label: 'App Users', value: appSessions.length, sub: 'Inside platform dashboard', color: 'text-violet-400', border: 'border-violet-500/20', icon: Activity },
    { label: 'Desktops', value: desktops, sub: `${mobiles} mobile · ${tablets} tablet`, color: 'text-amber-400', border: 'border-amber-500/20', icon: Monitor },
  ];

  return (
    <div className="space-y-6 animate-fade">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] flex items-center gap-2.5">
            <Radio size={22} className="text-emerald-400 animate-pulse" />
            Live Traffic Monitor
          </h1>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Real-time connected sessions, page activity, and interaction stream
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
            onClick={() => { fetchSessions(); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--bg-hover)] border border-[var(--border)] text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
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
            <div className={`text-3xl font-extrabold ${color} mt-2`}>{value}</div>
            <div className="text-[10px] text-[var(--text-subtle)] mt-0.5">{sub}</div>
          </div>
        ))}
      </div>

      {/* ── Tab selector ───────────────────────────────────────── */}
      <div className="flex gap-1 p-1 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border)] w-fit">
        {([
          { id: 'sessions', label: 'Active Sessions', count: userSessions.length },
          { id: 'traffic',  label: 'Homepage Traffic', count: homepageLiveEvents.length },
          { id: 'events',   label: 'App Events',       count: appLiveEvents.length },
        ] as { id: typeof activeView; label: string; count: number }[]).map(t => (
          <button
            key={t.id}
            onClick={() => setActiveView(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeView === t.id
                ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            {t.label}
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
              activeView === t.id ? 'bg-cyan-500/20 text-cyan-400' : 'bg-[var(--bg-hover)] text-[var(--text-subtle)]'
            }`}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* ── Active Sessions table ───────────────────────────────── */}
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
            <table className="w-full text-left text-xs">
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
                      No active sessions right now. Navigate the user platform to populate live data.
                    </td>
                  </tr>
                ) : (
                  userSessions.map((s, i) => (
                    <tr key={s.identifier || i} className="hover:bg-[var(--bg-hover)] transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-[var(--text-primary)] flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                          {s.user_name || 'Anonymous Visitor'}
                        </div>
                        <div className="text-[10px] text-[var(--text-subtle)] font-mono truncate max-w-[150px] mt-0.5">
                          {s.user_email || s.visitor_id || s.identifier}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-lg bg-cyan-500/10 border border-cyan-500/15 text-cyan-400 font-mono text-[11px]">
                          {s.current_page || '/'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 text-[var(--text-muted)] font-medium">
                          <DeviceIcon type={s.device_type} />
                          {s.browser || 'Browser'} · {s.os || 'OS'}
                        </div>
                        <div className="text-[10px] text-[var(--text-subtle)] font-mono mt-0.5">
                          {s.screen_resolution || ''}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 text-[var(--text-muted)] font-medium">
                          <MapPin size={11} className="text-cyan-400" />
                          {s.location || s.city || 'Local'}
                        </div>
                        <div className="text-[10px] text-[var(--text-subtle)] font-mono mt-0.5">{s.ip || '—'}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="text-cyan-400 font-mono text-[11px] font-semibold">{s.local_time || '—'}</div>
                        <div className="text-[10px] text-[var(--text-subtle)]">{s.timezone || 'UTC'}</div>
                      </td>
                      <td className="py-3.5 px-4 text-right text-[var(--text-subtle)] font-mono text-[11px]">
                        {fmtRelative(s.last_seen)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Homepage Traffic stream ─────────────────────────────── */}
      {activeView === 'traffic' && (
        <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] shadow-[var(--shadow-card)] overflow-hidden">
          <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
            <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
              <Globe size={15} className="text-emerald-400" />
              Homepage &amp; Landing Traffic
              <span className="text-[10px] text-[var(--text-subtle)] font-normal ml-1">visits, CTA clicks, public pages</span>
            </h3>
            <span className="text-[11px] text-[var(--text-subtle)]">{homepageLiveEvents.length} events this session</span>
          </div>
          {homepageLiveEvents.length === 0 ? (
            <div className="py-16 text-center text-[var(--text-subtle)] text-xs">
              Awaiting homepage visitor activity…
            </div>
          ) : (
            <div className="divide-y divide-[var(--border)] max-h-[460px] overflow-y-auto">
              {homepageLiveEvents.map((ev, i) => (
                <div key={i} className="p-3.5 flex items-center gap-4 hover:bg-[var(--bg-hover)] transition-colors animate-fade">
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border uppercase ${badgeColor(ev.event)}`}>
                    {ev.event.replace('_', ' ')}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-[var(--text-primary)] text-xs">{ev.user_name || 'Visitor'}</span>
                    <span className="text-[var(--text-subtle)] text-xs mx-1.5">→</span>
                    <span className="font-mono text-[11px] text-emerald-400">{ev.page}</span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-[var(--text-subtle)] shrink-0">
                    <span>{ev.location || 'Local'}</span>
                    <span>{fmtRelative(ev.timestamp)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── In-app event stream ─────────────────────────────────── */}
      {activeView === 'events' && (
        <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] shadow-[var(--shadow-card)] overflow-hidden">
          <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
            <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
              <Zap size={15} className="text-amber-400" />
              In-App User Events
              <span className="text-[10px] text-[var(--text-subtle)] font-normal ml-1">navigations, heartbeats, interactions</span>
            </h3>
            <span className="text-[11px] text-[var(--text-subtle)]">{appLiveEvents.length} events this session</span>
          </div>
          {appLiveEvents.length === 0 ? (
            <div className="py-16 text-center text-[var(--text-subtle)] text-xs">
              Awaiting in-app user interaction events…
            </div>
          ) : (
            <div className="divide-y divide-[var(--border)] max-h-[460px] overflow-y-auto">
              {appLiveEvents.map((ev, i) => (
                <div key={i} className="p-3.5 flex items-center gap-4 hover:bg-[var(--bg-hover)] transition-colors animate-fade">
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border uppercase ${badgeColor(ev.event)}`}>
                    {ev.event.replace('_', ' ')}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-[var(--text-primary)] text-xs">{ev.user_name || 'User'}</span>
                    <span className="text-[var(--text-subtle)] text-xs mx-1.5">·</span>
                    <span className="font-mono text-[11px] text-cyan-400">{ev.page}</span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-[var(--text-subtle)] shrink-0">
                    <span className="flex items-center gap-1"><DeviceIcon type={ev.device_type} />{ev.device_type || 'Desktop'}</span>
                    <span>{fmtRelative(ev.timestamp)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
