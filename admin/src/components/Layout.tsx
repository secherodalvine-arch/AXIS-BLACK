import React, { useState, useEffect, useRef } from 'react';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { useAdminStore, useToastStore } from '@/store';
import {
  LayoutDashboard, Users, Radio, BarChart2, ScrollText,
  Database, Bot, MessageSquare, Settings, LogOut, Bell,
  Menu, X, CheckCircle2, UserPlus, LogIn, ExternalLink,
  Clock, ShieldAlert, Sparkles, Sun, Moon, CreditCard
} from 'lucide-react';
import api from '@/api/client';
import { fmtDateTime, userTimeZone } from '@/utils/formatDate';

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/users', label: 'Users & Accounts', icon: Users },
  { path: '/payments', label: 'Payments & Revenue', icon: CreditCard },
  { path: '/live', label: 'Live Traffic Monitor', icon: Radio },
  { path: '/analytics', label: 'Analytics & Trends', icon: BarChart2 },
  { path: '/audit', label: 'Activity & Audit Log', icon: ScrollText },
  { path: '/database', label: 'Database Explorer', icon: Database },
  { path: '/agent-usage', label: 'AI Advisor Usage', icon: Bot },
  { path: '/messages', label: 'System Broadcasts', icon: MessageSquare },
  { path: '/settings', label: 'Platform Settings', icon: Settings },
];


function AdminNotifDrawer({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [notifs, setNotifs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin-notifications')
      .then((r) => setNotifs(r.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm animate-fade">
      <div ref={ref} className="w-96 max-w-full h-full bg-navy-900 border-l border-white/10 p-5 flex flex-col shadow-2xl">
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Bell size={18} className="text-cyan-400" />
            <h3 className="font-bold text-white text-base">Admin Notifications</h3>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded-lg">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-4 space-y-3">
          {loading ? (
            <div className="text-center py-10 text-slate-500 text-sm">Loading notifications...</div>
          ) : notifs.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-sm">No new administrator alerts</div>
          ) : (
            notifs.map((n) => (
              <div key={n.id || n._id} className="p-3.5 rounded-xl bg-white/5 border border-white/8 hover:border-cyan-500/30 transition-colors">
                <div className="text-xs font-semibold text-cyan-300">{n.title}</div>
                <div className="text-xs text-slate-300 mt-1">{n.message}</div>
                <div className="text-[10px] text-slate-500 mt-2 font-mono">{fmtDateTime(n.timestamp)}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { admin, logout, updateAdmin } = useAdminStore();
  const { toast } = useToastStore();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);

  // Live user device local clock
  const [clockStr, setClockStr] = useState(() => {
    const d = new Date();
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: userTimeZone });
  });
  const [dateStr, setDateStr] = useState(() => {
    const d = new Date();
    return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', timeZone: userTimeZone });
  });

  useEffect(() => {
    const timer = setInterval(() => {
      const d = new Date();
      setClockStr(d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: userTimeZone }));
      setDateStr(d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', timeZone: userTimeZone }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const toggleTheme = () => {
    const next = admin?.theme === 'light' ? 'dark' : 'light';
    updateAdmin({ theme: next });
    if (next === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
    toast({ type: 'info', message: 'Signed out of Admin Console' });
  };

  return (
    <div className="min-h-screen bg-navy-950 flex flex-col md:flex-row">
      {/* Mobile Sidebar Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 md:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside className={`admin-sidebar fixed md:sticky top-0 left-0 z-40 h-screen w-64 bg-navy-900 border-r border-white/8 flex flex-col transition-transform duration-200 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        {/* Brand header */}
        <div className="p-5 border-b border-white/8 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-lilac-500 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <span className="font-extrabold text-black text-sm tracking-wider">AX</span>
            </div>
            <div>
              <div className="font-extrabold text-sm tracking-wide text-white flex items-center gap-1.5">
                AXIS<span className="text-cyan-400">BLACK</span>
              </div>
              <div className="text-[10px] uppercase tracking-wider font-semibold text-amber-400/90 font-mono">
                Admin Console
              </div>
            </div>
          </Link>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden text-slate-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-cyan-500/20 to-lilac-500/10 text-cyan-300 border border-cyan-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
                }`}
              >
                <Icon size={16} className={isActive ? 'text-cyan-400' : 'text-slate-400'} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* App link & Footer */}
        <div className="p-3 border-t border-white/8 space-y-2">
          <a
            href={import.meta.env.VITE_USER_APP_URL || "http://localhost:5173"}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-white/4 hover:bg-white/8 border border-white/6 text-xs text-slate-300 font-medium transition-colors"
          >
            <span className="flex items-center gap-2">
              <ExternalLink size={13} className="text-amber-400" /> Open User App
            </span>
            <span className="text-[10px] text-slate-500 font-mono">
              {import.meta.env.VITE_USER_APP_URL ? 'Live App' : ':5173'}
            </span>
          </a>

          <div className="flex items-center justify-between px-2 pt-1 text-slate-400">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-cyan-500/20 text-cyan-400 font-bold text-xs flex items-center justify-center border border-cyan-500/30">
                {(admin?.name || 'A')[0].toUpperCase()}
              </div>
              <div className="truncate max-w-[110px]">
                <div className="text-xs font-semibold text-white truncate">{admin?.name || 'Admin'}</div>
                <div className="text-[10px] text-slate-500 truncate">{admin?.role || 'Operator'}</div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              title="Sign Out"
              className="p-1.5 text-rose-400/80 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-30 h-16 bg-navy-900/80 backdrop-blur-md border-b border-white/8 px-4 sm:px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-2 text-slate-400 hover:text-white rounded-lg bg-white/5"
            >
              <Menu size={18} />
            </button>

            {/* Device Local Time Display */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs font-mono">
              <Clock size={14} className="text-cyan-400" />
              <span className="text-slate-400 hidden sm:inline">{dateStr} •</span>
              <span className="text-white font-bold">{clockStr}</span>
              <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 text-[10px] font-semibold uppercase">
                {userTimeZone.split('/').pop()?.replace('_', ' ') || 'LOCAL'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Live Indicator */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Live Telemetry
            </div>

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              title="Toggle Theme"
              className="p-2 text-slate-400 hover:text-white rounded-xl bg-white/5 border border-white/8 transition-colors"
            >
              {admin?.theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
            </button>

            {/* Notification Bell */}
            <button
              onClick={() => setShowNotifs(true)}
              title="Admin Alerts"
              className="relative p-2 text-slate-400 hover:text-white rounded-xl bg-white/5 border border-white/8 transition-colors"
            >
              <Bell size={16} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-cyan-400 shadow-sm shadow-cyan-400"></span>
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>

      {showNotifs && <AdminNotifDrawer onClose={() => setShowNotifs(false)} />}
    </div>
  );
}
