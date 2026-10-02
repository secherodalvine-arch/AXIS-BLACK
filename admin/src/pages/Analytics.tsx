import React, { useEffect, useState, useCallback } from 'react';
import {
  BarChart2, TrendingUp, RefreshCw, Monitor, Smartphone,
  Globe, Users, Home, Activity, MapPin, ArrowUpRight, Tablet
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip,
  BarChart, Bar, PieChart, Pie, Cell, Legend
} from 'recharts';
import api from '@/api/client';
import { useToastStore } from '@/store';

/* ── palette ─────────────────────────────────────────────────── */
const PIE_COLORS = ['#06b6d4', '#8b5cf6', '#f59e0b', '#10b981', '#ec4899', '#3b82f6', '#f97316'];

/* ── micro helpers ───────────────────────────────────────────── */
const fmt = (n: number) => n >= 1_000 ? `${(n / 1_000).toFixed(1)}k` : String(n);

const PieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
  if (percent < 0.05) return null;
  const r = innerRadius + (outerRadius - innerRadius) * 0.6;
  const x = cx + r * Math.cos(-midAngle * (Math.PI / 180));
  const y = cy + r * Math.sin(-midAngle * (Math.PI / 180));
  return (
    <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={700}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', fontSize: 12 }}>
      <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} style={{ color: p.color, display: 'flex', gap: 8 }}>
          <span style={{ opacity: 0.7 }}>{p.name}:</span>
          <span style={{ fontWeight: 700 }}>{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════════ */
export function Analytics() {
  const { toast } = useToastStore();
  const [platform, setPlatform] = useState<any>(null);
  const [homepage, setHomepage]  = useState<any>(null);
  const [days, setDays]          = useState(30);
  const [loading, setLoading]    = useState(true);
  const [section, setSection]    = useState<'traffic' | 'homepage' | 'devices' | 'pages'>('traffic');

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, hRes] = await Promise.all([
        api.get(`/analytics/platform?days=${days}`),
        api.get('/traffic/homepage').catch(() => ({ data: { data: null } }))
      ]);
      setPlatform(pRes.data.data);
      if (hRes.data?.data) setHomepage(hRes.data.data);
    } catch {
      toast({ type: 'error', message: 'Failed to load analytics data' });
    } finally {
      setLoading(false);
    }
  }, [days, toast]);

  useEffect(() => { fetch(); }, [fetch]);

  /* ── build data series ──────────────────────────────────────── */
  const timeline = Object.entries(platform?.traffic_by_day || {})
    .map(([day, views]) => ({
      date: day.slice(5),
      views: views as number,
      unique: (platform?.unique_visitors_by_day || {})[day] || 0,
      signups: (platform?.registrations_by_day || {})[day] || 0,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const totalViews   = timeline.reduce((s, d) => s + d.views, 0);
  const totalUnique  = timeline.reduce((s, d) => s + d.unique, 0);
  const totalSignups = timeline.reduce((s, d) => s + d.signups, 0);

  const deviceData = Object.entries(platform?.devices || {}).map(([name, value]) => ({ name, value: value as number }));
  const browserData = Object.entries(platform?.browsers || {})
    .map(([name, value]) => ({ name, value: value as number }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 7);
  const osData = Object.entries(platform?.os || {})
    .map(([name, value]) => ({ name, value: value as number }))
    .sort((a, b) => b.value - a.value);

  const topPages = (platform?.top_pages || []) as [string, number][];
  const topLocations = (platform?.top_locations || []) as [string, number][];

  // Homepage stats
  const hpTotal   = homepage?.total_views || 0;
  const hpUnique  = homepage?.unique_visitors || 0;
  const hpDevices = Object.entries(homepage?.device_breakdown || {}).map(([name, val]) => ({ name, value: val as number }));
  const hpBrowsers = Object.entries(homepage?.browser_breakdown || {})
    .map(([name, val]) => ({ name, value: val as number }))
    .sort((a, b) => b.value - a.value).slice(0, 6);
  const hpLocations = Object.entries(homepage?.top_locations || {})
    .map(([name, val]) => ({ name, value: val as number }))
    .sort((a, b) => b.value - a.value).slice(0, 6);

  /* ── KPI bar ─────────────────────────────────────────────────── */
  const kpis = [
    { label: 'Total Events', value: fmt(totalViews), sub: `Last ${days} days`, color: 'text-cyan-400', icon: Activity },
    { label: 'Unique Visitors', value: fmt(totalUnique), sub: 'Deduplicated by IP', color: 'text-violet-400', icon: Users },
    { label: 'New Signups', value: fmt(totalSignups), sub: `Registered accounts`, color: 'text-emerald-400', icon: TrendingUp },
    { label: 'Homepage Views', value: fmt(hpTotal), sub: `${hpUnique} unique`, color: 'text-amber-400', icon: Home },
  ];

  const sections = [
    { id: 'traffic',  label: 'Traffic Timeline' },
    { id: 'homepage', label: 'Homepage Traffic' },
    { id: 'devices',  label: 'Devices & Browsers' },
    { id: 'pages',    label: 'Top Pages & Locations' },
  ] as const;

  return (
    <div className="space-y-6 animate-fade">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] flex items-center gap-2.5">
            <BarChart2 size={22} className="text-cyan-400" /> Analytics &amp; Trends
          </h1>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Platform traffic, homepage visits, device breakdown, top pages &amp; user registrations
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Days selector */}
          {([7, 14, 30, 90] as const).map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                days === d
                  ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400'
                  : 'bg-[var(--bg-subtle)] border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              {d}d
            </button>
          ))}
          <button
            onClick={fetch}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--bg-hover)] border border-[var(--border)] text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* ── KPI row ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(({ label, value, sub, color, icon: Icon }) => (
          <div key={label} className="p-4 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] shadow-[var(--shadow-card)]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[var(--text-muted)]">{label}</span>
              <Icon size={16} className={color} />
            </div>
            <div className={`text-2xl font-extrabold ${color} mt-2`}>{value}</div>
            <div className="text-[10px] text-[var(--text-subtle)] mt-0.5">{sub}</div>
          </div>
        ))}
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="flex items-center justify-center h-48 text-cyan-400 gap-3">
          <div className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-[var(--text-muted)]">Loading analytics…</span>
        </div>
      )}

      {!loading && platform && (
        <>
          {/* ── Section nav ──────────────────────────────────────── */}
          <div className="flex gap-1 p-1 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border)] w-fit overflow-x-auto">
            {sections.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setSection(id)}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all shrink-0 ${
                  section === id
                    ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* ── TRAFFIC TIMELINE ───────────────────────────────────── */}
          {section === 'traffic' && (
            <div className="space-y-5">
              <div className="p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] shadow-[var(--shadow-card)]">
                <h3 className="text-sm font-bold text-[var(--text-primary)] mb-4">Total Events &amp; Unique Visitors</h3>
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={timeline}>
                    <defs>
                      <linearGradient id="gViews" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gUnique" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-subtle)' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--text-subtle)' }} axisLine={false} tickLine={false} width={32} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="views"  name="Events"   stroke="#06b6d4" fill="url(#gViews)"  strokeWidth={2} />
                    <Area type="monotone" dataKey="unique" name="Unique"   stroke="#8b5cf6" fill="url(#gUnique)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] shadow-[var(--shadow-card)]">
                <h3 className="text-sm font-bold text-[var(--text-primary)] mb-4">New User Registrations</h3>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={timeline}>
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-subtle)' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--text-subtle)' }} axisLine={false} tickLine={false} width={28} allowDecimals={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="signups" name="Signups" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* ── HOMEPAGE TRAFFIC ───────────────────────────────────── */}
          {section === 'homepage' && (
            <div className="space-y-5">
              {/* KPIs */}
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'Total Page Views', value: fmt(hpTotal), color: 'text-emerald-400' },
                  { label: 'Unique Visitors', value: fmt(hpUnique), color: 'text-cyan-400' },
                  { label: 'Desktop Ratio', value: hpDevices.length ? `${Math.round(((hpDevices.find(d=>d.name==='Desktop')?.value||0)/Math.max(hpTotal,1))*100)}%` : '—', color: 'text-violet-400' },
                ].map(k => (
                  <div key={k.label} className="p-4 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] shadow-[var(--shadow-card)] text-center">
                    <div className={`text-2xl font-extrabold ${k.color}`}>{k.value}</div>
                    <div className="text-[11px] text-[var(--text-muted)] mt-1">{k.label}</div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Device breakdown */}
                {hpDevices.length > 0 && (
                  <div className="p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] shadow-[var(--shadow-card)]">
                    <h3 className="text-sm font-bold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                      <Monitor size={14} className="text-cyan-400" /> Device Breakdown
                    </h3>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={hpDevices} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={90} labelLine={false} label={PieLabel}>
                          {hpDevices.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Pie>
                        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: 'var(--text-muted)' }} />
                        <Tooltip content={<CustomTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Browser breakdown */}
                {hpBrowsers.length > 0 && (
                  <div className="p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] shadow-[var(--shadow-card)]">
                    <h3 className="text-sm font-bold text-[var(--text-primary)] mb-4">Browser Share</h3>
                    <div className="space-y-2.5">
                      {hpBrowsers.map(({ name, value }, i) => {
                        const pct = hpTotal ? Math.round((value / hpTotal) * 100) : 0;
                        return (
                          <div key={name}>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-[var(--text-primary)] font-medium">{name}</span>
                              <span className="text-[var(--text-muted)]">{value} ({pct}%)</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
                              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Top locations */}
              {hpLocations.length > 0 && (
                <div className="p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] shadow-[var(--shadow-card)]">
                  <h3 className="text-sm font-bold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                    <MapPin size={14} className="text-emerald-400" /> Top Visitor Locations
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {hpLocations.map(({ name, value }, i) => (
                      <div key={name} className="flex items-center justify-between p-3 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border)]">
                        <span className="text-xs text-[var(--text-primary)] font-medium flex items-center gap-2">
                          <span className="text-[var(--text-subtle)]">{i + 1}.</span>{name}
                        </span>
                        <span className="text-xs font-bold text-cyan-400">{fmt(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── DEVICES & BROWSERS ──────────────────────────────────── */}
          {section === 'devices' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Platform device breakdown */}
              {deviceData.length > 0 && (
                <div className="p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] shadow-[var(--shadow-card)]">
                  <h3 className="text-sm font-bold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                    <Monitor size={14} className="text-cyan-400" /> Device Types (Platform-wide)
                  </h3>
                  <ResponsiveContainer width="100%" height={210}>
                    <PieChart>
                      <Pie data={deviceData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={90} labelLine={false} label={PieLabel}>
                        {deviceData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: 'var(--text-muted)' }} />
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* OS breakdown */}
              {osData.length > 0 && (
                <div className="p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] shadow-[var(--shadow-card)]">
                  <h3 className="text-sm font-bold text-[var(--text-primary)] mb-4">Operating Systems</h3>
                  <div className="space-y-2.5">
                    {osData.slice(0, 7).map(({ name, value }, i) => {
                      const total = osData.reduce((s, d) => s + d.value, 0);
                      const pct = total ? Math.round((value / total) * 100) : 0;
                      return (
                        <div key={name}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-[var(--text-primary)] font-medium">{name}</span>
                            <span className="text-[var(--text-muted)]">{value} ({pct}%)</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Browser breakdown platform-wide */}
              {browserData.length > 0 && (
                <div className="p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] shadow-[var(--shadow-card)] lg:col-span-2">
                  <h3 className="text-sm font-bold text-[var(--text-primary)] mb-4">Browser Share (Platform)</h3>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={browserData} layout="vertical">
                      <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--text-subtle)' }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-primary)' }} axisLine={false} tickLine={false} width={70} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="value" name="Events" radius={[0, 4, 4, 0]}>
                        {browserData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {/* ── TOP PAGES & LOCATIONS ───────────────────────────────── */}
          {section === 'pages' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Top Pages */}
              <div className="p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] shadow-[var(--shadow-card)]">
                <h3 className="text-sm font-bold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                  <ArrowUpRight size={14} className="text-cyan-400" /> Most Visited Pages
                </h3>
                {topPages.length === 0 ? (
                  <div className="text-xs text-[var(--text-subtle)] py-8 text-center">No page data yet.</div>
                ) : (
                  <div className="space-y-2">
                    {topPages.map(([page, count], i) => {
                      const max = topPages[0]?.[1] || 1;
                      const pct = Math.round((count / max) * 100);
                      return (
                        <div key={page}>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="font-mono text-[var(--text-primary)] truncate max-w-[220px]">{page}</span>
                            <span className="text-[var(--text-muted)] ml-2 shrink-0">{fmt(count)}</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Top Locations */}
              <div className="p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] shadow-[var(--shadow-card)]">
                <h3 className="text-sm font-bold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                  <MapPin size={14} className="text-emerald-400" /> Top Geographic Locations
                </h3>
                {topLocations.length === 0 ? (
                  <div className="text-xs text-[var(--text-subtle)] py-8 text-center">No location data yet.</div>
                ) : (
                  <div className="space-y-2.5">
                    {topLocations.map(([loc, count], i) => {
                      const max = topLocations[0]?.[1] || 1;
                      const pct = Math.round((count / max) * 100);
                      return (
                        <div key={loc}>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-[var(--text-primary)] font-medium flex items-center gap-2">
                              <span className="text-[var(--text-subtle)]">{i + 1}.</span>{loc}
                            </span>
                            <span className="text-[var(--text-muted)]">{fmt(count)}</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
