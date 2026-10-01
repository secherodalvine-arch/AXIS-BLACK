import React, { useEffect, useState } from 'react';
import {
  BarChart2, TrendingUp, Monitor, Globe, RefreshCw,
  Compass, Eye, Smartphone, Cpu
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, PieChart, Pie, Cell, Legend
} from 'recharts';
import api from '@/api/client';

const COLORS = ['#06b6d4', '#8b5cf6', '#f59e0b', '#10b981', '#ec4899', '#3b82f6'];

export function Analytics() {
  const [data, setData] = useState<any>(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/analytics/platform?days=${days}`);
      setData(res.data.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [days]);

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center h-80 text-cyan-400 gap-3">
        <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
        <span className="text-sm font-semibold text-slate-300">Compiling Analytics Data...</span>
      </div>
    );
  }

  // Transform timeline
  const timeline = Object.entries(data.traffic_by_day || {}).map(([day, count]) => ({
    date: day.slice(5),
    views: count as number,
    unique: (data.unique_visitors_by_day || {})[day] || 0,
    signups: (data.registrations_by_day || {})[day] || 0,
  }));

  const totalViews = Object.values(data.traffic_by_day || {}).reduce((a: any, b: any) => a + b, 0);
  const totalUnique = Object.values(data.unique_visitors_by_day || {}).reduce((a: any, b: any) => a + b, 0);

  const deviceData = Object.entries(data.devices || {}).map(([name, val]) => ({
    name,
    value: val as number,
  })).filter(d => d.value > 0);

  const browserData = Object.entries(data.browsers || {}).map(([name, val]) => ({
    name,
    value: val as number,
  })).filter(d => d.value > 0);

  const osData = Object.entries(data.os || {}).map(([name, val]) => ({
    name,
    value: val as number,
  })).filter(d => d.value > 0);

  return (
    <div className="space-y-6 animate-fade">
      {/* Title & Range Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <BarChart2 size={22} className="text-cyan-400" /> Platform Traffic &amp; Audience Analytics
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Aggregated traffic telemetry, popular routes, device footprints, and geolocation
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex rounded-xl bg-navy-900 border border-white/10 p-1 text-xs font-semibold">
            {[7, 14, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1 rounded-lg transition-colors ${
                  days === d ? 'bg-cyan-500 text-black font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                {d}D
              </button>
            ))}
          </div>

          <button
            onClick={fetchAnalytics}
            className="p-2 rounded-xl bg-white/5 border border-white/10 hover:border-cyan-500/40 text-slate-300 transition-colors"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin text-cyan-400' : ''} />
          </button>
        </div>
      </div>

      {/* Traffic Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-navy-900 border border-white/8">
          <div className="text-xs text-slate-400 font-medium">Total Page Views</div>
          <div className="text-2xl font-extrabold text-white mt-1">{totalViews}</div>
          <div className="text-[10px] text-cyan-400 font-mono mt-0.5">Last {days} days</div>
        </div>

        <div className="p-4 rounded-2xl bg-navy-900 border border-white/8">
          <div className="text-xs text-slate-400 font-medium">Unique Visitors</div>
          <div className="text-2xl font-extrabold text-lilac-400 mt-1">{totalUnique}</div>
          <div className="text-[10px] text-slate-500 font-mono mt-0.5">Distinct devices/IPs</div>
        </div>

        <div className="p-4 rounded-2xl bg-navy-900 border border-white/8">
          <div className="text-xs text-slate-400 font-medium">Top Device Type</div>
          <div className="text-2xl font-extrabold text-amber-400 mt-1">
            {deviceData[0]?.name || 'Desktop'}
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-0.5">{deviceData[0]?.value || 0} visits</div>
        </div>

        <div className="p-4 rounded-2xl bg-navy-900 border border-white/8">
          <div className="text-xs text-slate-400 font-medium">Top Visited Page</div>
          <div className="text-xl font-extrabold text-emerald-400 mt-1 truncate">
            {data.top_pages?.[0]?.[0] || '/dashboard'}
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-0.5">{data.top_pages?.[0]?.[1] || 0} views</div>
        </div>
      </div>

      {/* Timeline Chart */}
      <div className="p-5 rounded-2xl bg-navy-900 border border-white/8 shadow-xl">
        <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
          <TrendingUp size={16} className="text-cyan-400" /> Daily Page Views vs Unique Visitors
        </h3>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={timeline} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="aViews" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="aUnique" x1="0" y1="0" x2="0" y2="1">
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
              <Area type="monotone" dataKey="views" name="Page Views" stroke="#06b6d4" strokeWidth={2} fillOpacity={1} fill="url(#aViews)" />
              <Area type="monotone" dataKey="unique" name="Unique Visitors" stroke="#8b5cf6" strokeWidth={2} fillOpacity={1} fill="url(#aUnique)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Breakdown Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Top Pages */}
        <div className="p-5 rounded-2xl bg-navy-900 border border-white/8 shadow-xl">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
            <Compass size={16} className="text-cyan-400" /> Popular Application Routes
          </h3>
          <div className="space-y-3">
            {(!data.top_pages || data.top_pages.length === 0) ? (
              <div className="text-xs text-slate-500 py-6 text-center">No route telemetry logged yet</div>
            ) : (
              data.top_pages.map(([route, count]: any) => {
                const pct = totalViews > 0 ? Math.round((count / totalViews) * 100) : 0;
                return (
                  <div key={route} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono text-slate-200">{route}</span>
                      <span className="text-slate-400 font-mono">{count} ({pct}%)</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <div className="h-full bg-cyan-400 rounded-full" style={{ width: `${Math.max(5, pct)}%` }}></div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Operating Systems */}
        <div className="p-5 rounded-2xl bg-navy-900 border border-white/8 shadow-xl">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
            <Cpu size={16} className="text-lilac-400" /> Operating Systems
          </h3>
          <div className="h-52 flex items-center justify-center">
            {osData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={osData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={65}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {osData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
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
              <div className="text-xs text-slate-500">No OS data available</div>
            )}
          </div>
        </div>

        {/* Geolocation & Cities */}
        <div className="p-5 rounded-2xl bg-navy-900 border border-white/8 shadow-xl">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
            <Globe size={16} className="text-emerald-400" /> Top Visitor Geographies
          </h3>
          <div className="space-y-3">
            {(!data.top_locations || data.top_locations.length === 0) ? (
              <div className="text-xs text-slate-500 py-6 text-center">No location telemetry logged yet</div>
            ) : (
              data.top_locations.map(([loc, count]: any) => (
                <div key={loc} className="flex items-center justify-between text-xs p-2 rounded-xl bg-white/3 border border-white/5">
                  <div className="flex items-center gap-2">
                    <Globe size={13} className="text-emerald-400" />
                    <span className="font-medium text-slate-200">{loc}</span>
                  </div>
                  <span className="font-mono text-cyan-300 font-bold">{count}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
