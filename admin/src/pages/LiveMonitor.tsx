import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  Radio, RefreshCw, Monitor, Smartphone, Globe,
  Clock, Activity, MapPin, Eye, Zap, Shield, AlertCircle
} from 'lucide-react';
import api from '@/api/client';
import { useAdminStore } from '@/store';
import { fmtDateTime, fmtRelative } from '@/utils/formatDate';

export function LiveMonitor() {
  const { admin, token } = useAdminStore();
  const [sessions, setSessions] = useState<any[]>([]);
  const [incomingEvents, setIncomingEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [wsStatus, setWsStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const wsRef = useRef<WebSocket | null>(null);

  const fetchSessions = useCallback(async () => {
    try {
      const res = await api.get('/live-sessions');
      setSessions(res.data.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Polling fallback every 8 seconds
  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, 8000);
    return () => clearInterval(interval);
  }, [fetchSessions]);

  // WebSocket Connection
  useEffect(() => {
    if (!admin?.id || !token) return;

    let wsBase = '';
    const envWs = (import.meta.env.VITE_WS_URL as string | undefined ?? '').trim().replace(/\/+$/, '');
    const envApi = (import.meta.env.VITE_API_URL as string | undefined ?? '').trim().replace(/\/+$/, '');

    if (envWs) {
      wsBase = envWs;
    } else if (envApi) {
      try {
        const url = new URL(envApi);
        const wsProto = url.protocol === 'https:' ? 'wss:' : 'ws:';
        wsBase = `${wsProto}//${url.host}`;
      } catch {
        wsBase = envApi.replace(/^http/, 'ws');
      }
    } else {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.hostname;
      const port = '8000';
      wsBase = `${protocol}//${host}:${port}`;
    }

    const wsUrl = `${wsBase}/api/admin/ws/${admin.id}?token=${token}`;

    setWsStatus('connecting');
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsStatus('connected');
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'traffic_event') {
          const page = (msg.page || '').toLowerCase();
          if (page.startsWith('/admin')) {
            return;
          }
          setIncomingEvents((prev) => [msg, ...prev].slice(0, 30));
          fetchSessions();
        }
      } catch {}
    };

    ws.onclose = () => {
      setWsStatus('disconnected');
    };

    ws.onerror = () => {
      setWsStatus('disconnected');
    };

    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send('ping');
      }
    }, 15000);

    return () => {
      clearInterval(pingInterval);
      ws.close();
    };
  }, [admin?.id, token, fetchSessions]);

  // Display user platform sessions
  const userSessions = sessions.filter(s => {
    const page = (s.current_page || s.page || '').toLowerCase();
    return !page.startsWith('/admin') && !page.startsWith('/api/admin');
  });

  return (
    <div className="space-y-6 animate-fade">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Radio size={22} className="text-emerald-400 animate-pulse" /> Live Telemetry &amp; Traffic Stream
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time monitor of active device connections, pages in view, device clocks, and location
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
            <Shield size={12} /> Live Real-Time Stream
          </span>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-navy-900 border border-white/10 text-xs">
            <span className={`w-2 h-2 rounded-full ${
              wsStatus === 'connected' ? 'bg-emerald-400 animate-pulse' : wsStatus === 'connecting' ? 'bg-amber-400' : 'bg-slate-500'
            }`}></span>
            <span className="text-slate-300 font-mono capitalize">
              {wsStatus === 'connected' ? 'WebSocket Live' : wsStatus}
            </span>
          </div>

          <button
            onClick={fetchSessions}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:border-cyan-500/40 text-xs text-slate-300 font-medium transition-all"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin text-cyan-400' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Online Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-navy-900 border border-emerald-500/20 shadow-lg flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-400">Active Live Sessions</div>
            <div className="text-3xl font-extrabold text-white mt-1">{userSessions.length}</div>
            <div className="text-[10px] text-emerald-400 mt-0.5">Online within 15 mins</div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
            <Radio size={24} className="animate-pulse" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-navy-900 border border-white/8 shadow-lg flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-400">Desktop Visitors</div>
            <div className="text-3xl font-extrabold text-cyan-400 mt-1">
              {userSessions.filter(s => (s.device_type || '').toLowerCase() === 'desktop').length}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">Desktops / Laptops</div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
            <Monitor size={24} />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-navy-900 border border-white/8 shadow-lg flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-400">Mobile &amp; Tablets</div>
            <div className="text-3xl font-extrabold text-lilac-400 mt-1">
              {userSessions.filter(s => (s.device_type || '').toLowerCase() !== 'desktop').length}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">Smartphones / Handhelds</div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-lilac-500/10 text-lilac-400 flex items-center justify-center">
            <Smartphone size={24} />
          </div>
        </div>
      </div>

      {/* Live Active Sessions Table */}
      <div className="rounded-2xl bg-navy-900 border border-white/8 shadow-xl overflow-hidden">
        <div className="p-4 border-b border-white/8 flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Activity size={16} className="text-cyan-400" /> Active Connected Clients ({userSessions.length})
          </h3>
          <span className="text-[11px] text-slate-500">Auto-synced</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-white/2 border-b border-white/8 text-slate-400 font-medium">
                <th className="py-3 px-4 font-semibold">User / Session ID</th>
                <th className="py-3 px-4 font-semibold">Current Viewing Route</th>
                <th className="py-3 px-4 font-semibold">Client Environment</th>
                <th className="py-3 px-4 font-semibold">Public IP &amp; Geolocation</th>
                <th className="py-3 px-4 font-semibold">Device Local Clock</th>
                <th className="py-3 px-4 font-semibold text-right">Heartbeat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {userSessions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    No active sessions recorded right now. Navigate the user app to see real-time updates!
                  </td>
                </tr>
              ) : (
                userSessions.map((s, idx) => (
                  <tr key={s.identifier || idx} className="hover:bg-white/2 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-white flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                        <span>{s.user_name || 'Anonymous Visitor'}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono truncate max-w-[150px] mt-0.5">
                        {s.user_email || s.visitor_id || s.identifier}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 font-mono text-[11px]">
                        {s.current_page || '/'}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-slate-300">
                      <div className="flex items-center gap-1.5 font-medium">
                        {(s.device_type || '').toLowerCase() === 'mobile' ? (
                          <Smartphone size={13} className="text-lilac-400" />
                        ) : (
                          <Monitor size={13} className="text-cyan-400" />
                        )}
                        <span>{s.browser || 'Browser'} on {s.os || 'OS'}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                        Res: {s.screen_resolution || 'Standard'}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-slate-300">
                      <div className="flex items-center gap-1.5 font-medium">
                        <Globe size={13} className="text-cyan-400" />
                        <span>{s.location || s.city || 'Local Host'}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">{s.ip || '127.0.0.1'}</div>
                    </td>

                    <td className="py-3.5 px-4 text-slate-300 font-mono text-[11px]">
                      <div className="text-cyan-300 font-semibold">{s.local_time || '—'}</div>
                      <div className="text-[10px] text-slate-500">{s.timezone || 'UTC'}</div>
                    </td>

                    <td className="py-3.5 px-4 text-right text-emerald-400 font-mono text-[11px]">
                      {fmtRelative(s.last_seen)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Real-time Inbound Event Stream */}
      <div className="p-5 rounded-2xl bg-navy-900 border border-white/8 shadow-xl">
        <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
          <Zap size={16} className="text-amber-400" /> Live Inbound Event Feed
        </h3>

        {incomingEvents.length === 0 ? (
          <div className="text-xs text-slate-500 py-6 text-center">
            Awaiting live telemetry events from active user sessions...
          </div>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {incomingEvents.map((ev, i) => (
              <div key={i} className="p-2.5 rounded-xl bg-white/3 border border-white/6 flex items-center justify-between text-xs animate-fade">
                <div className="flex items-center gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                  <span className="font-semibold text-white">{ev.user_name || 'Visitor'}</span>
                  <span className="text-slate-400">navigated to</span>
                  <span className="px-1.5 py-0.5 rounded bg-white/5 font-mono text-cyan-300 text-[11px]">{ev.page}</span>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-slate-500 font-mono">
                  <span>{ev.device}</span>
                  <span>{ev.location || 'Local'}</span>
                  <span className="text-slate-400">{fmtRelative(ev.timestamp)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
