import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Users, Radio, Receipt, FileSpreadsheet, Boxes,
  TrendingUp, ArrowRight, RefreshCw, Smartphone, Monitor,
  Tablet, Activity, ShieldCheck, Globe, Clock
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  Tooltip, PieChart, Pie, Cell, Legend
} from 'recharts';
import api from '@/api/client';
import { fmtDateTime, fmtRelative } from '@/utils/formatDate';

const PIE_COLORS = ['#06b6d4', '#8b5cf6', '#f59e0b', '#10b981'];

export function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [liveSessions, setLiveSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const [sRes, aRes, lRes] = await Promise.all([
        api.get('/stats'),
        api.get('/analytics/platform?days=14'),
        api.get('/live-sessions'),
      ]);
      setStats(sRes.data.data);
      setAnalytics(aRes.data.data);
      setLiveSessions(lRes.data.data || []);
    } catch (e) {
      console.error('Failed to load dashboard stats', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 20000);
    return () => clearInterval(interval);
  }, []);

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center h-80 text-cyan-400 gap-3">
        <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
        <span className="text-sm font-semibold text-slate-300">Synchronizing Platform Telemetry...</span>
      </div>
    );
  }

  // Transform traffic data for recharts
  const chartData = Object.entries(analytics?.traffic_by_day || {}).map(([day, count]) => ({
    date: day.slice(5),
    visits: count as number,
    unique: (analytics?.unique_visitors_by_day || {})[day] || 0,
    signups: (analytics?.registrations_by_day || {})[day] || 0,
  }));

  // Device breakdown data
  const devicePieData = Object.entries(stats.device_breakdown || {}).map(([name, val]) => ({
    name,
    value: val as number,
  })).filter((d) => d.value > 0);

  return (
    <div className="space-y-6 animate-fade">
      {/* Page Title & Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            Command Center Overview
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time multi-branch financial intelligence &amp; user telemetry (auto-refreshes every 20s)
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:border-cyan-500/40 text-xs text-slate-300 transition-all font-medium"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin text-cyan-400' : ''} />
            <span>Refresh Now</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Total Users */}
        <Link to="/users" className="p-4 rounded-2xl bg-navy-900 border border-white/8 hover:border-cyan-500/40 transition-all group block shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
              <Users size={16} />
            </div>
            <ArrowRight size={13} className="text-slate-600 group-hover:text-cyan-400 transition-colors" />
          </div>
          <div className="text-2xl font-extrabold text-white">{stats.total_users}</div>
          <div className="text-xs text-slate-400 font-medium">Total Accounts</div>
          <div className="text-[10px] text-emerald-400 mt-1 font-mono">+{stats.new_this_week} this week</div>
        </Link>

        {/* Online Now */}
        <Link to="/live" className="p-4 rounded-2xl bg-navy-900 border border-emerald-500/20 hover:border-emerald-500/40 transition-all group block shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <Radio size={16} className="animate-pulse" />
            </div>
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400"></span>
          </div>
          <div className="text-2xl font-extrabold text-white">{stats.online_now}</div>
          <div className="text-xs text-slate-400 font-medium">Online Right Now</div>
          <div className="text-[10px] text-slate-500 mt-1 font-mono">{stats.active_today} active today</div>
        </Link>

        {/* Transactions & Volume */}
        <Link to="/database" className="p-4 rounded-2xl bg-navy-900 border border-white/8 hover:border-amber-500/40 transition-all group block shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <Receipt size={16} />
            </div>
            <ArrowRight size={13} className="text-slate-600 group-hover:text-amber-400 transition-colors" />
          </div>
          <div className="text-2xl font-extrabold text-white">{stats.total_transactions}</div>
          <div className="text-xs text-slate-400 font-medium">Transactions Logged</div>
          <div className="text-[10px] text-amber-300 mt-1 font-mono">${stats.total_volume.toLocaleString()} Vol</div>
        </Link>

        {/* Custom Spreadsheets */}
        <Link to="/database" className="p-4 rounded-2xl bg-navy-900 border border-white/8 hover:border-lilac-500/40 transition-all group block shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 rounded-xl bg-lilac-500/10 text-lilac-400 flex items-center justify-center">
              <FileSpreadsheet size={16} />
            </div>
            <ArrowRight size={13} className="text-slate-600 group-hover:text-lilac-400 transition-colors" />
          </div>
          <div className="text-2xl font-extrabold text-white">{stats.total_spreadsheets}</div>
          <div className="text-xs text-slate-400 font-medium">Spreadsheets</div>
          <div className="text-[10px] text-slate-500 mt-1 font-mono">Custom Workbooks</div>
        </Link>

        {/* Inventory SKUs */}
        <Link to="/database" className="p-4 rounded-2xl bg-navy-900 border border-white/8 hover:border-cyan-500/40 transition-all group block shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
              <Boxes size={16} />
            </div>
            <ArrowRight size={13} className="text-slate-600 group-hover:text-cyan-400 transition-colors" />
          </div>
          <div className="text-2xl font-extrabold text-white">{stats.total_inventory_items}</div>
          <div className="text-xs text-slate-400 font-medium">Inventory SKUs</div>
          <div className="text-[10px] text-slate-500 mt-1 font-mono">Tracked in Catalog</div>
        </Link>

        {/* System Health */}
        <div className="p-4 rounded-2xl bg-navy-900 border border-white/8 block shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <ShieldCheck size={16} />
            </div>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono font-bold">100%</span>
          </div>
          <div className="text-2xl font-extrabold text-white">Optimal</div>
          <div className="text-xs text-slate-400 font-medium">System Telemetry</div>
          <div className="text-[10px] text-slate-500 mt-1 font-mono">FastAPI + MongoDB</div>
        </div>
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Traffic History Area Chart */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-navy-900 border border-white/8 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <TrendingUp size={16} className="text-cyan-400" /> Platform Traffic &amp; Page Views (Last 14 Days)
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Continuous user navigations and telemetry heartbeats</p>
            </div>
            <Link to="/analytics" className="text-xs text-cyan-400 hover:underline">
              Deep Analytics &rarr;
            </Link>
          </div>

          <div className="h-64 w-full">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="trafficGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="uniqueGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" stroke="#64748b" fontSize={11} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#060b13',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '12px',
                      fontSize: '12px',
                    }}
                  />
                  <Area type="monotone" dataKey="visits" name="Total Views" stroke="#06b6d4" strokeWidth={2} fillOpacity={1} fill="url(#trafficGrad)" />
                  <Area type="monotone" dataKey="unique" name="Unique Visitors" stroke="#8b5cf6" strokeWidth={2} fillOpacity={1} fill="url(#uniqueGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500 text-xs">
                No recorded traffic in this period
              </div>
            )}
          </div>
        </div>

        {/* Device Distribution Pie */}
        <div className="p-5 rounded-2xl bg-navy-900 border border-white/8 shadow-xl flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-1">
              <Smartphone size={16} className="text-lilac-400" /> Device Distribution
            </h3>
            <p className="text-[11px] text-slate-400">Captured client device environments</p>
          </div>

          <div className="h-48 w-full my-auto flex items-center justify-center">
            {devicePieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={devicePieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {devicePieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#060b13',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px',
                      fontSize: '11px',
                    }}
                  />
                  <Legend verticalAlign="bottom" height={36} iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-xs text-slate-500">No device data available</div>
            )}
          </div>

          <div className="pt-3 border-t border-white/8 flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5"><Monitor size={13} className="text-cyan-400" /> Desktop {stats.device_breakdown?.Desktop || 0}</span>
            <span className="flex items-center gap-1.5"><Smartphone size={13} className="text-lilac-400" /> Mobile {stats.device_breakdown?.Mobile || 0}</span>
          </div>
        </div>
      </div>

      {/* Real-Time Live Sessions Strip */}
      <div className="p-5 rounded-2xl bg-navy-900 border border-white/8 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Radio size={16} className="text-emerald-400" /> Live Visitor Sessions &amp; Device Details
            </h3>
            <p className="text-[11px] text-slate-400">Real-time devices online with local clocks &amp; IP locations</p>
          </div>
          <Link to="/live" className="text-xs text-cyan-400 hover:underline">
            View Live Stream &rarr;
          </Link>
        </div>

        {liveSessions.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-xs">
            No live visitors detected in the last 15 minutes. Open the user app in another tab to observe live recording!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/8 text-slate-400 font-medium">
                  <th className="pb-3 font-semibold">User / Visitor</th>
                  <th className="pb-3 font-semibold">Current Page</th>
                  <th className="pb-3 font-semibold">Device &amp; Browser</th>
                  <th className="pb-3 font-semibold">IP &amp; Geolocation</th>
                  <th className="pb-3 font-semibold">Device Local Time</th>
                  <th className="pb-3 font-semibold text-right">Last Seen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {liveSessions.slice(0, 6).map((s, idx) => (
                  <tr key={s.identifier || idx} className="hover:bg-white/2 transition-colors">
                    <td className="py-3">
                      <div className="font-semibold text-white">{s.user_name || 'Anonymous Visitor'}</div>
                      <div className="text-[10px] text-slate-500 font-mono truncate max-w-[140px]">
                        {s.user_email || s.visitor_id || s.identifier}
                      </div>
                    </td>
                    <td className="py-3">
                      <span className="px-2 py-0.5 rounded-lg bg-cyan-500/10 text-cyan-300 font-mono text-[11px]">
                        {s.current_page || '/'}
                      </span>
                    </td>
                    <td className="py-3 text-slate-300">
                      <div>{s.browser || 'Browser'} on {s.os || 'OS'}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{s.device_type || 'Desktop'}</div>
                    </td>
                    <td className="py-3 text-slate-300">
                      <div className="flex items-center gap-1.5">
                        <Globe size={12} className="text-cyan-400" />
                        <span>{s.location || s.city || 'Local Host'}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">{s.ip || '127.0.0.1'}</div>
                    </td>
                    <td className="py-3 text-slate-300 font-mono text-[11px]">
                      <div>{s.local_time || '—'}</div>
                      <div className="text-[10px] text-slate-500">{s.timezone || 'UTC'}</div>
                    </td>
                    <td className="py-3 text-right text-emerald-400 font-mono text-[11px]">
                      {fmtRelative(s.last_seen)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
