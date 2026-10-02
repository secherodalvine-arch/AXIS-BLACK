import React, { useEffect, useState } from 'react';
import {
  BarChart2, TrendingUp, Monitor, Globe, RefreshCw,
  Compass, Eye, Smartphone, Cpu, Home, ArrowUpRight,
  ShieldCheck, Clock, MapPin, Tablet, Layers, Activity
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area,
  XAxis, YAxis, Tooltip, PieChart, Pie, Cell, Legend
} from 'recharts';
import api from '@/api/client';
import { fmtDateTime, fmtRelative } from '@/utils/formatDate';

const COLORS = ['#06b6d4', '#8b5cf6', '#f59e0b', '#10b981', '#ec4899', '#3b82f6'];

export function Analytics() {
  const [data, setData] = useState<any>(null);
  const [homepageData, setHomepageData] = useState<any>(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const [res, hpRes] = await Promise.all([
        api.get(`/analytics/platform?days=${days}`),
        api.get('/traffic/homepage').catch(() => ({ data: { data: null } }))
      ]);
      setData(res.data.data);
      if (hpRes.data?.data) {
        setHomepageData(hpRes.data.data);
      }
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
        <span className="text-sm font-semibold text-slate-300">Compiling Platform Telemetry &amp; Traffic...</span>
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

  // Filter out any admin routes from user platform top pages
  const userTopPages = (data.top_pages || []).filter(([route]: any) => {
    const r = String(route || '').toLowerCase();
    return !r.startsWith('/admin') && !r.startsWith('/api/admin');
  });

  return (
    <div className="space-y-6 animate-fade">
      {/* Title & Range Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
              <BarChart2 size={22} className="text-cyan-400" /> Platform Traffic &amp; Audience Analytics
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-semibold">
              <ShieldCheck size={12} /> User End Telemetry (Admin Excluded)
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Aggregated traffic telemetry, popular user routes, device footprints, and public landing acquisition
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
            title="Refresh Analytics"
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
          <div className="text-[10px] text-cyan-400 font-mono mt-0.5">Last {days} days (User App)</div>
        </div>

        <div className="p-4 rounded-2xl bg-navy-900 border border-white/8">
          <div className="text-xs text-slate-400 font-medium">Unique Visitors</div>
          <div className="text-2xl font-extrabold text-lilac-400 mt-1">{totalUnique}</div>
          <div className="text-[10px] text-slate-500 font-mono mt-0.5">Distinct user devices / IPs</div>
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
            {userTopPages[0]?.[0] || '/dashboard'}
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-0.5">{userTopPages[0]?.[1] || 0} views</div>
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
            {(!userTopPages || userTopPages.length === 0) ? (
              <div className="text-xs text-slate-500 py-6 text-center">No route telemetry logged yet</div>
            ) : (
              userTopPages.map(([route, count]: any) => {
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

      {/* ── HOMEPAGE TRAFFIC & AUDIENCE ACQUISITION SECTION ── */}
      <div className="p-6 rounded-2xl bg-navy-900 border border-cyan-500/20 shadow-2xl space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center border border-cyan-500/20 shadow-inner">
              <Home size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">Homepage Traffic Recording &amp; Audience Acquisition</h3>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="Telemetry Live"></span>
              </div>
              <p className="text-xs text-slate-400">
                Direct landing page visits, device hardware metrics, browsers, and acquisition footprints on the public site
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold flex items-center gap-1.5">
              Conversion Rate: <span className="font-mono font-bold">{homepageData?.conversion_rate || '0.0%'}</span>
            </span>
          </div>
        </div>

        {/* 4 Summary Highlight Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-4 rounded-xl bg-white/2 border border-white/5 shadow-sm">
            <div className="text-[11px] text-slate-400 font-medium">Landing Pageviews</div>
            <div className="text-2xl font-extrabold text-white mt-1 font-mono">{homepageData?.total_views || 0}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Hero &amp; Landing sections</div>
          </div>
          <div className="p-4 rounded-xl bg-white/2 border border-white/5 shadow-sm">
            <div className="text-[11px] text-slate-400 font-medium">Unique Landing Visitors</div>
            <div className="text-2xl font-extrabold text-cyan-400 mt-1 font-mono">{homepageData?.unique_visitors || 0}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Distinct devices &amp; IPs</div>
          </div>
          <div className="p-4 rounded-xl bg-white/2 border border-white/5 shadow-sm">
            <div className="text-[11px] text-slate-400 font-medium">Desktop Landing Share</div>
            <div className="text-2xl font-extrabold text-amber-400 mt-1 font-mono">
              {homepageData?.device_breakdown?.Desktop || 0}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              {homepageData?.total_views > 0
                ? `${Math.round(((homepageData?.device_breakdown?.Desktop || 0) / homepageData.total_views) * 100)}% of landing views`
                : 'Laptops & Desktops'}
            </div>
          </div>
          <div className="p-4 rounded-xl bg-white/2 border border-white/5 shadow-sm">
            <div className="text-[11px] text-slate-400 font-medium">Mobile &amp; Tablet Share</div>
            <div className="text-2xl font-extrabold text-lilac-400 mt-1 font-mono">
              {(homepageData?.device_breakdown?.Mobile || 0) + (homepageData?.device_breakdown?.Tablet || 0)}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              {homepageData?.total_views > 0
                ? `${Math.round((((homepageData?.device_breakdown?.Mobile || 0) + (homepageData?.device_breakdown?.Tablet || 0)) / homepageData.total_views) * 100)}% of landing views`
                : 'Smartphones & Tablets'}
            </div>
          </div>
        </div>

        {/* Device & Environment Footprint Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Device Type Distribution */}
          <div className="p-4 rounded-xl bg-white/2 border border-white/5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Monitor size={14} className="text-cyan-400" /> Device Distribution
              </span>
              <span className="text-[10px] text-slate-500">Hardware categories</span>
            </div>
            <div className="space-y-2">
              {['Desktop', 'Mobile', 'Tablet'].map((dType) => {
                const count = homepageData?.device_breakdown?.[dType] || 0;
                const total = homepageData?.total_views || 1;
                const pct = Math.round((count / total) * 100);
                return (
                  <div key={dType} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-300 font-medium">{dType}</span>
                      <span className="font-mono text-slate-400">{count} ({pct}%)</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          dType === 'Desktop' ? 'bg-cyan-400' : dType === 'Mobile' ? 'bg-lilac-400' : 'bg-amber-400'
                        }`}
                        style={{ width: `${Math.max(count > 0 ? 5 : 0, pct)}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Browser Breakdown */}
          <div className="p-4 rounded-xl bg-white/2 border border-white/5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Globe size={14} className="text-emerald-400" /> Client Browsers
              </span>
              <span className="text-[10px] text-slate-500">Browser engines</span>
            </div>
            <div className="space-y-2">
              {(!homepageData?.browser_breakdown || Object.keys(homepageData.browser_breakdown).length === 0) ? (
                <div className="text-xs text-slate-500 py-3 text-center">No browser data recorded yet</div>
              ) : (
                Object.entries(homepageData.browser_breakdown).slice(0, 4).map(([browser, count]: any) => {
                  const total = homepageData?.total_views || 1;
                  const pct = Math.round((count / total) * 100);
                  return (
                    <div key={browser} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-300 font-medium">{browser}</span>
                        <span className="font-mono text-slate-400">{count} ({pct}%)</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-white/5 overflow-hidden">
                        <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${Math.max(5, pct)}%` }}></div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Operating Systems */}
          <div className="p-4 rounded-xl bg-white/2 border border-white/5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Cpu size={14} className="text-amber-400" /> Operating Systems
              </span>
              <span className="text-[10px] text-slate-500">Platform OS</span>
            </div>
            <div className="space-y-2">
              {(!homepageData?.os_breakdown || Object.keys(homepageData.os_breakdown).length === 0) ? (
                <div className="text-xs text-slate-500 py-3 text-center">No OS data recorded yet</div>
              ) : (
                Object.entries(homepageData.os_breakdown).slice(0, 4).map(([osName, count]: any) => {
                  const total = homepageData?.total_views || 1;
                  const pct = Math.round((count / total) * 100);
                  return (
                    <div key={osName} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-300 font-medium">{osName}</span>
                        <span className="font-mono text-slate-400">{count} ({pct}%)</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-white/5 overflow-hidden">
                        <div className="h-full bg-amber-400 rounded-full" style={{ width: `${Math.max(5, pct)}%` }}></div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Screen Resolutions & Referrers Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Display & Screen Resolutions */}
          <div className="p-4 rounded-xl bg-white/2 border border-white/5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Layers size={14} className="text-cyan-400" /> Screen Resolutions &amp; Hardware Display
              </span>
              <span className="text-[10px] text-slate-500">Visitor display sizes</span>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              {(!homepageData?.screen_resolutions || Object.keys(homepageData.screen_resolutions).length === 0) ? (
                <div className="text-xs text-slate-500 py-2">No resolution telemetry logged yet</div>
              ) : (
                Object.entries(homepageData.screen_resolutions).map(([res, count]: any) => (
                  <div key={res} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-navy-950 border border-white/10 text-xs">
                    <span className="font-mono text-slate-300 font-semibold">{res}</span>
                    <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono text-[10px] font-bold">
                      {count} {count === 1 ? 'visit' : 'visits'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Acquisition Referrers & Top Geographies */}
          <div className="p-4 rounded-xl bg-white/2 border border-white/5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Compass size={14} className="text-lilac-400" /> Acquisition Sources &amp; Locations
              </span>
              <span className="text-[10px] text-slate-500">Inbound traffic channels</span>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              {(!homepageData?.top_referrers || Object.keys(homepageData.top_referrers).length === 0) ? (
                <div className="text-xs text-slate-500 py-2">Direct public access</div>
              ) : (
                Object.entries(homepageData.top_referrers).map(([ref, count]: any) => (
                  <div key={ref} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-navy-950 border border-white/10 text-xs">
                    <span className="text-slate-300 font-medium truncate max-w-[180px]">{ref || 'Direct'}</span>
                    <span className="px-1.5 py-0.5 rounded bg-lilac-500/20 text-lilac-300 font-mono text-[10px] font-bold">{count}</span>
                  </div>
                ))
              )}
              {homepageData?.top_locations && Object.entries(homepageData.top_locations).map(([loc, count]: any) => (
                <div key={loc} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300">
                  <MapPin size={11} />
                  <span className="font-medium">{loc}</span>
                  <span className="font-mono font-bold text-[10px]">({count})</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Detailed Recent Landing Visitors Table */}
        <div className="rounded-xl bg-navy-950 border border-white/8 overflow-hidden shadow-inner">
          <div className="p-4 border-b border-white/8 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Activity size={15} className="text-cyan-400" />
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                Recent Landing Visitors &amp; Device Telemetry ({homepageData?.recent_visits?.length || 0})
              </h4>
            </div>
            <span className="text-[11px] text-slate-500">Public Landing Telemetry • Live Captured</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-white/2 border-b border-white/8 text-slate-400 font-medium">
                  <th className="py-3 px-4 font-semibold">Visitor / Event</th>
                  <th className="py-3 px-4 font-semibold">Landing Section</th>
                  <th className="py-3 px-4 font-semibold">Device &amp; Hardware Specs</th>
                  <th className="py-3 px-4 font-semibold">Screen Resolution</th>
                  <th className="py-3 px-4 font-semibold">Public IP &amp; Geolocation</th>
                  <th className="py-3 px-4 font-semibold">Device Local Clock</th>
                  <th className="py-3 px-4 font-semibold text-right">Recorded</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {(!homepageData?.recent_visits || homepageData.recent_visits.length === 0) ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Home size={28} className="text-slate-600 animate-pulse" />
                        <span className="font-medium text-slate-400">Waiting for landing page visitor telemetry...</span>
                        <span className="text-[11px] text-slate-500 max-w-md">
                          Direct visits and interactions on the public homepage (https://axisblack.vercel.app or local dev)
                          will automatically record device footprints, local clocks, and IP geolocation here in real time.
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  homepageData.recent_visits.map((v: any, idx: number) => {
                    const devType = v.device_type || 'Desktop';
                    return (
                      <tr key={v.id || idx} className="hover:bg-white/2 transition-colors">
                        {/* Visitor ID & Event */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
                            <span className="font-semibold text-white font-mono text-[11px]">
                              {v.user_name && v.user_name !== 'Visitor' ? v.user_name : (v.visitor_id || v.identifier || 'Anonymous')}
                            </span>
                          </div>
                          <div className="mt-1">
                            <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase ${
                              v.event === 'cta_click' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-cyan-500/20 text-cyan-300'
                            }`}>
                              {v.event || 'homepage_visit'}
                            </span>
                          </div>
                        </td>

                        {/* Section / Route */}
                        <td className="py-3.5 px-4">
                          <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-slate-200 font-mono text-[11px]">
                            {v.page || '/'}
                          </span>
                        </td>

                        {/* Device & Hardware Specs */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            {devType.toLowerCase() === 'mobile' ? (
                              <Smartphone size={14} className="text-lilac-400 shrink-0" />
                            ) : devType.toLowerCase() === 'tablet' ? (
                              <Tablet size={14} className="text-amber-400 shrink-0" />
                            ) : (
                              <Monitor size={14} className="text-cyan-400 shrink-0" />
                            )}
                            <div>
                              <div className="font-medium text-slate-200 text-xs">
                                {v.device || `${devType} • ${v.browser || 'Browser'} • ${v.os || 'OS'}`}
                              </div>
                              <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                                {v.browser || 'Browser'} • {v.os || 'OS'}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Screen Resolution */}
                        <td className="py-3.5 px-4">
                          <span className="px-2 py-0.5 rounded-lg bg-navy-900 border border-white/10 font-mono text-[11px] text-cyan-300 font-bold">
                            {v.screen_resolution || '1920x1080'}
                          </span>
                        </td>

                        {/* IP & Location */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5 text-xs text-slate-300">
                            <MapPin size={12} className="text-emerald-400 shrink-0" />
                            <span>{v.location || v.city || v.country || 'Public Network'}</span>
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono mt-0.5 pl-4">
                            {v.ip || '127.0.0.1'}
                          </div>
                        </td>

                        {/* Device Local Clock */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5 text-xs text-slate-200 font-mono">
                            <Clock size={12} className="text-amber-400 shrink-0" />
                            <span>{v.local_time || '—'}</span>
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono mt-0.5 pl-4">
                            {v.local_date || ''} {v.timezone ? `(${v.timezone})` : ''}
                          </div>
                        </td>

                        {/* Recorded Timestamp */}
                        <td className="py-3.5 px-4 text-right">
                          <span className="text-slate-300 font-mono text-xs" title={v.timestamp ? fmtDateTime(v.timestamp) : ''}>
                            {v.timestamp ? fmtRelative(v.timestamp) : '—'}
                          </span>
                          <div className="text-[10px] text-slate-500 mt-0.5 truncate max-w-[120px] ml-auto">
                            {v.referrer || 'Direct'}
                          </div>
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
    </div>
  );
}
