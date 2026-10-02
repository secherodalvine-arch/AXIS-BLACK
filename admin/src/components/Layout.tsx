import React, { useState, useEffect, useRef } from 'react';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { useAdminStore, useToastStore } from '@/store';
import {
  LayoutDashboard, Users, Radio, BarChart2, ScrollText,
  Database, Bot, MessageSquare, Settings, LogOut, Bell,
  Menu, X, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight,
  Clock, ShieldAlert, Sparkles, CreditCard, Shield, ExternalLink,
  Trash2, Check, RefreshCw, Mail, MailOpen, AlertTriangle, Info,
  AlertCircle
} from 'lucide-react';
import api from '@/api/client';
import {
  fmtDateTime,
  formatNotificationTime,
  formatNotificationDetailTime,
  userTimeZone
} from '@/utils/formatDate';

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard, section: 'CORE' },
  { path: '/users', label: 'Users & Accounts', icon: Users, section: 'CORE' },
  { path: '/payments', label: 'Payments & Revenue', icon: CreditCard, section: 'CORE' },
  { path: '/live', label: 'Live Traffic Monitor', icon: Radio, section: 'TELEMETRY' },
  { path: '/analytics', label: 'Analytics & Trends', icon: BarChart2, section: 'TELEMETRY' },
  { path: '/audit', label: 'Activity & Audit Log', icon: ScrollText, section: 'TELEMETRY' },
  { path: '/database', label: 'Database Explorer', icon: Database, section: 'TELEMETRY' },
  { path: '/agent-usage', label: 'Admin Agent', icon: Bot, section: 'INTELLIGENCE' },
  { path: '/messages', label: 'Customer Support', icon: MessageSquare, section: 'INTELLIGENCE' },
  { path: '/logs', label: 'System Logs', icon: ShieldAlert, section: 'SYSTEM' },
  { path: '/settings', label: 'Platform Settings', icon: Settings, section: 'SYSTEM' },
];

interface AdminNotificationItem {
  id: string;
  title: string;
  message: string;
  type?: 'success' | 'warning' | 'info' | 'support' | 'critical' | 'error';
  timestamp?: string;
  read?: boolean;
  link?: string;
}

function AdminNotifDrawer({
  onClose,
  onUpdateCount
}: {
  onClose: () => void;
  onUpdateCount: (c: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { toast } = useToastStore();
  const [notifs, setNotifs] = useState<AdminNotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [selectedNotif, setSelectedNotif] = useState<AdminNotificationItem | null>(null);

  const fetchNotifs = () => {
    setLoading(true);
    api.get('/admin-notifications')
      .then((r) => {
        const items = r.data.data || [];
        setNotifs(items);
        const unread = items.filter((n: any) => !n.read).length;
        onUpdateCount(unread);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchNotifs();
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node) && !selectedNotif) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose, selectedNotif]);

  const handleToggleRead = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      const res = await api.post(`/admin-notifications/${id}/toggle-read`);
      const newRead = res.data?.read ?? true;
      setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: newRead } : n));
      const updated = notifs.map(n => n.id === id ? { ...n, read: newRead } : n);
      onUpdateCount(updated.filter(n => !n.read).length);
    } catch {
      // optimistic fallback
      setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: !n.read } : n));
    }
  };

  const handleOpenDetail = (n: AdminNotificationItem) => {
    setSelectedNotif(n);
    if (!n.read) {
      handleToggleRead(n.id);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.post('/admin-notifications/read-all');
      setNotifs(prev => prev.map(n => ({ ...n, read: true })));
      onUpdateCount(0);
      toast({ type: 'success', message: 'All notifications marked as read' });
    } catch {
      setNotifs(prev => prev.map(n => ({ ...n, read: true })));
      onUpdateCount(0);
    }
  };

  const handleDeleteNotif = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await api.delete(`/admin-notifications/${id}`);
      const updated = notifs.filter(n => n.id !== id);
      setNotifs(updated);
      onUpdateCount(updated.filter(n => !n.read).length);
      if (selectedNotif?.id === id) {
        setSelectedNotif(null);
      }
      toast({ type: 'info', message: 'Notification removed' });
    } catch {
      const updated = notifs.filter(n => n.id !== id);
      setNotifs(updated);
      onUpdateCount(updated.filter(n => !n.read).length);
      if (selectedNotif?.id === id) {
        setSelectedNotif(null);
      }
    }
  };

  const handleClearAll = async () => {
    try {
      await api.delete('/admin-notifications');
      setNotifs([]);
      onUpdateCount(0);
      setSelectedNotif(null);
      toast({ type: 'info', message: 'All administrator alerts cleared' });
    } catch {
      setNotifs([]);
      onUpdateCount(0);
      setSelectedNotif(null);
    }
  };

  const unreadCount = notifs.filter(n => !n.read).length;
  const filteredNotifs = filter === 'unread' ? notifs.filter(n => !n.read) : notifs;

  return (
    <>
      <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fade">
        <div ref={ref} className="w-96 max-w-full h-full bg-navy-900 border-l border-white/10 p-5 flex flex-col shadow-2xl">
          {/* Header Bar */}
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <div className="flex items-center gap-2">
              <Bell size={18} className="text-cyan-400" />
              <h3 className="font-bold text-white text-base">Admin Notifications</h3>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  {unreadCount} UNREAD
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={fetchNotifs}
                title="Refresh alerts"
                className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
              </button>
              <button
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Action strip: Mark read / Clear all */}
          <div className="flex items-center justify-between py-2 border-b border-white/5 text-[11px]">
            <div className="flex items-center gap-3">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Check size={12} /> Mark read
                </button>
              )}
            </div>
            {notifs.length > 0 && (
              <button
                onClick={handleClearAll}
                className="text-rose-400 hover:text-rose-300 font-semibold flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Trash2 size={12} /> Clear all
              </button>
            )}
          </div>

          {/* Filter Tabs (All / Unread) - Matching user platform */}
          <div className="flex gap-1.5 p-1 rounded-xl bg-navy-950 border border-white/5 my-3">
            <button
              onClick={() => setFilter('all')}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                filter === 'all'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              All ({notifs.length})
            </button>
            <button
              onClick={() => setFilter('unread')}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                filter === 'unread'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Unread ({unreadCount})
            </button>
          </div>

          {/* Notifications List */}
          <div className="flex-1 overflow-y-auto space-y-2.5 pr-0.5">
            {loading && notifs.length === 0 ? (
              <div className="text-center py-16 text-slate-500 text-xs flex flex-col items-center gap-2">
                <RefreshCw size={22} className="animate-spin text-cyan-400 mb-1" />
                <span>Loading live telemetry alerts...</span>
              </div>
            ) : filteredNotifs.length === 0 ? (
              <div className="text-center py-16 text-slate-500 text-xs flex flex-col items-center gap-2">
                <Bell size={28} className="text-slate-600 mb-1" />
                <span>No {filter === 'unread' ? 'unread' : ''} administrator alerts</span>
                <span className="text-[10px] text-slate-600">Platform operational and all systems healthy</span>
              </div>
            ) : (
              filteredNotifs.map((n) => {
                const isWarning = n.type === 'warning' || n.type === 'critical' || n.type === 'error';
                const isSuccess = n.type === 'success';
                const isSupport = n.type === 'support';

                return (
                  <div
                    key={n.id}
                    onClick={() => handleOpenDetail(n)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer group ${
                      n.read
                        ? 'bg-white/2 border-white/5 opacity-70 hover:opacity-100 hover:border-white/15'
                        : 'bg-white/6 border-cyan-500/30 shadow-sm hover:border-cyan-500/60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${
                          isWarning
                            ? 'bg-rose-400 animate-pulse'
                            : isSuccess
                            ? 'bg-cyan-400'
                            : isSupport
                            ? 'bg-amber-400'
                            : 'bg-lilac-400'
                        }`} />
                        <div className="text-xs font-bold text-white truncate leading-tight">
                          {n.title}
                        </div>
                      </div>

                      {/* Quick Actions (Mark Read/Unread & Delete) */}
                      <div
                        className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={(e) => handleToggleRead(n.id, e)}
                          title={n.read ? 'Mark as unread' : 'Mark as read'}
                          className="p-1 text-slate-400 hover:text-cyan-300 rounded cursor-pointer transition-colors"
                        >
                          {n.read ? <MailOpen size={13} /> : <Mail size={13} className="text-cyan-400" />}
                        </button>
                        <button
                          onClick={(e) => handleDeleteNotif(n.id, e)}
                          title="Delete notification"
                          className="p-1 text-slate-500 hover:text-rose-400 rounded cursor-pointer transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    <p className="text-xs text-slate-300 mt-1.5 leading-relaxed line-clamp-2 pl-4">
                      {n.message}
                    </p>

                    <div className="flex items-center justify-between text-[10px] text-slate-500 mt-2 pl-4 font-mono">
                      <span>{formatNotificationTime(n.timestamp)}</span>
                      <span className="text-cyan-400 group-hover:underline text-[9px] font-sans">
                        Click to view details &rarr;
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* NOTIFICATION DETAIL MODAL (Prominently displayed above notification drawer) */}
      {selectedNotif && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade"
          style={{ zIndex: 100 }}
          onClick={() => setSelectedNotif(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-navy-900 border border-cyan-500/40 shadow-2xl p-6 flex flex-col gap-4 text-xs relative"
            style={{ zIndex: 101 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                  selectedNotif.type === 'warning' || selectedNotif.type === 'critical' || selectedNotif.type === 'error'
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                    : selectedNotif.type === 'success'
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                    : selectedNotif.type === 'support'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                    : 'bg-lilac-500/20 text-lilac-300 border-lilac-500/30'
                }`}>
                  {selectedNotif.type?.toUpperCase() || 'INFO'}
                </span>
                <span className="text-[11px] font-mono text-slate-400">
                  {formatNotificationDetailTime(selectedNotif.timestamp)}
                </span>
              </div>
              <button
                onClick={() => setSelectedNotif(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg cursor-pointer"
                title="Close alert detail"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="space-y-3">
              <h3 className="text-base font-bold text-white leading-snug">
                {selectedNotif.title}
              </h3>

              <div className="p-4 rounded-xl bg-white/3 border border-white/8 text-slate-200 leading-relaxed whitespace-pre-wrap font-sans text-xs">
                {selectedNotif.message}
              </div>

              {(selectedNotif.link || selectedNotif.type === 'support' || selectedNotif.title?.toLowerCase().includes('message') || selectedNotif.title?.toLowerCase().includes('support')) && (
                <div className="pt-1">
                  <button
                    onClick={() => {
                      const link = selectedNotif.link || '/messages';
                      setSelectedNotif(null);
                      onClose();
                      navigate(link);
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-xs font-semibold hover:bg-cyan-500/30 transition-all cursor-pointer shadow-sm"
                  >
                    <MessageSquare size={14} />
                    <span>Open in Customer Support ({selectedNotif.link || '/messages'}) &rarr;</span>
                  </button>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => handleDeleteNotif(selectedNotif.id)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-semibold border border-rose-500/20 transition-colors cursor-pointer"
              >
                <Trash2 size={14} />
                <span>Delete Alert</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedNotif(null)}
                className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-bold transition-all shadow-md shadow-cyan-500/20 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { admin, logout } = useAdminStore();
  const { toast } = useToastStore();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Large screen collapsible state (stored in localStorage)
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      return localStorage.getItem('axis_admin_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const toggleCollapse = () => {
    setIsCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem('axis_admin_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  // Close profile dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Poll unread notifications periodically
  useEffect(() => {
    const checkUnread = () => {
      api.get('/admin-notifications?limit=20')
        .then(r => {
          const items = r.data.data || [];
          setUnreadNotifCount(items.filter((n: any) => !n.read).length);
        })
        .catch(() => {});
    };
    checkUnread();
    const interval = setInterval(checkUnread, 30000);
    return () => clearInterval(interval);
  }, []);

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

  const handleLogout = () => {
    setShowProfileMenu(false);
    logout();
    navigate('/login');
    toast({ type: 'info', message: 'Signed out of Admin Console' });
  };

  const displayName = admin?.name || 'Administrator';
  const displayRole = admin?.role || 'Superadmin';
  const initial = (displayName.charAt(0) || 'A').toUpperCase();
  const avatarImage = admin?.avatar_url || admin?.avatarUrl;

  return (
    <div className="min-h-screen bg-navy-950 flex flex-col md:flex-row text-slate-100">
      {/* Mobile Sidebar Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/70 md:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside
        className={`admin-sidebar fixed md:sticky top-0 left-0 z-40 h-screen bg-navy-900 border-r border-white/8 flex flex-col transition-all duration-200 ease-in-out ${
          isCollapsed ? 'md:w-20' : 'md:w-64'
        } ${sidebarOpen ? 'w-64 translate-x-0' : '-translate-x-full md:translate-x-0'}`}
      >
        {/* Brand header with collapse toggle */}
        <div className={`p-4 border-b border-white/8 flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-lilac-500 flex items-center justify-center shadow-lg shadow-cyan-500/20 shrink-0">
              <span className="font-extrabold text-black text-sm tracking-wider">AX</span>
            </div>
            {!isCollapsed && (
              <div className="overflow-hidden">
                <div className="font-extrabold text-sm tracking-wide text-white flex items-center gap-1.5 truncate">
                  AXIS<span className="text-cyan-400">BLACK</span>
                </div>
                <div className="text-[10px] uppercase tracking-wider font-semibold text-amber-400/90 font-mono truncate">
                  Admin Console
                </div>
              </div>
            )}
          </Link>

          {/* Desktop Collapse Toggle */}
          <button
            onClick={toggleCollapse}
            title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            className="hidden md:flex p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors shrink-0 cursor-pointer"
          >
            {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>

          {/* Mobile Close Button */}
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
                title={isCollapsed ? item.label : undefined}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-cyan-500/20 to-lilac-500/10 text-cyan-300 border border-cyan-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
                } ${isCollapsed ? 'justify-center' : ''}`}
              >
                <Icon size={17} className={`shrink-0 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                {!isCollapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-30 h-16 bg-navy-900/80 backdrop-blur-md border-b border-white/8 px-4 sm:px-6 flex items-center justify-between">
          {/* Left: Mobile trigger & Local Device Clock */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-2 text-slate-400 hover:text-white rounded-lg bg-white/5 cursor-pointer"
              aria-label="Open sidebar"
            >
              <Menu size={18} />
            </button>

            {/* Device Local Time Display */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs font-mono">
              <Clock size={14} className="text-cyan-400 shrink-0" />
              <span className="text-slate-400 hidden sm:inline">{dateStr} •</span>
              <span className="text-white font-bold">{clockStr}</span>
              <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 text-[10px] font-semibold uppercase hidden xs:inline">
                {userTimeZone.split('/').pop()?.replace('_', ' ') || 'LOCAL'}
              </span>
            </div>
          </div>

          {/* Right: Only Notification Bell and Profile Dropdown */}
          <div className="flex items-center gap-3">
            {/* Notification Bell with live unread counter */}
            <button
              onClick={() => setShowNotifs(true)}
              title="Admin Alerts & Telemetry Notifications"
              className="relative p-2 text-slate-400 hover:text-white rounded-xl bg-white/5 border border-white/8 hover:border-cyan-500/30 transition-colors cursor-pointer"
            >
              <Bell size={18} />
              {unreadNotifCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-cyan-500 text-black text-[10px] font-extrabold flex items-center justify-center shadow-md shadow-cyan-500/40">
                  {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
                </span>
              )}
            </button>

            {/* Profile Dropdown Menu */}
            <div className="relative" ref={profileMenuRef}>
              <button
                onClick={() => setShowProfileMenu(prev => !prev)}
                className="flex items-center gap-2.5 p-1.5 sm:px-3 sm:py-1.5 rounded-2xl bg-white/5 hover:bg-white/8 border border-white/10 hover:border-cyan-500/30 transition-all cursor-pointer"
              >
                {/* Profile Picture / Avatar */}
                {avatarImage ? (
                  <img
                    src={avatarImage}
                    alt={displayName}
                    className="w-8 h-8 rounded-full object-cover border border-cyan-400 shrink-0 shadow-md shadow-cyan-500/20"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-500 to-lilac-500 text-black font-extrabold text-xs flex items-center justify-center shadow-md shadow-cyan-500/20 shrink-0">
                    {initial}
                  </div>
                )}

                {/* Name & Role Text */}
                <div className="hidden sm:flex flex-col text-left">
                  <span className="text-xs font-bold text-white leading-tight truncate max-w-[120px]">
                    {displayName}
                  </span>
                  <span className="text-[10px] font-medium text-slate-400 leading-tight">
                    {displayRole}
                  </span>
                </div>

                <ChevronDown size={14} className="text-slate-400 hidden sm:block" />
              </button>

              {/* Profile Dropdown Content */}
              {showProfileMenu && (
                <div className="absolute right-0 mt-2 w-60 rounded-2xl bg-navy-900 border border-white/12 shadow-2xl p-2.5 z-50 animate-fade">
                  {/* Identity Summary Header with Avatar */}
                  <div className="p-2 border-b border-white/8 mb-1.5 flex items-center gap-3">
                    {avatarImage ? (
                      <img
                        src={avatarImage}
                        alt={displayName}
                        className="w-10 h-10 rounded-full object-cover border border-cyan-400 shrink-0 shadow-md shadow-cyan-500/20"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-cyan-500 to-lilac-500 text-black font-extrabold text-sm flex items-center justify-center shrink-0">
                        {initial}
                      </div>
                    )}
                    <div className="overflow-hidden">
                      <div className="text-xs font-bold text-white truncate">{displayName}</div>
                      <div className="text-[11px] text-slate-400 font-mono truncate">{admin?.email || 'admin@axisblack.internal'}</div>
                      <div className="inline-block mt-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-cyan-500/20 text-cyan-300">
                        {displayRole}
                      </div>
                    </div>
                  </div>

                  {/* Quick Navigation Links */}
                  <Link
                    to="/settings"
                    onClick={() => setShowProfileMenu(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/6 transition-colors"
                  >
                    <Settings size={15} className="text-cyan-400" />
                    <span>Platform Settings</span>
                  </Link>

                  <Link
                    to="/messages"
                    onClick={() => setShowProfileMenu(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/6 transition-colors"
                  >
                    <MessageSquare size={15} className="text-lilac-400" />
                    <span>Customer Support</span>
                  </Link>

                  <Link
                    to="/logs"
                    onClick={() => setShowProfileMenu(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/6 transition-colors"
                  >
                    <ShieldAlert size={15} className="text-amber-400" />
                    <span>System Logs</span>
                  </Link>

                  <div className="my-1 border-t border-white/8" />

                  {/* Sign Out Action */}
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:bg-rose-500/10 transition-colors text-left cursor-pointer"
                  >
                    <LogOut size={15} />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content Container */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-x-hidden">
          <Outlet />
        </main>
      </div>

      {/* Notification Drawer Modal */}
      {showNotifs && (
        <AdminNotifDrawer
          onClose={() => setShowNotifs(false)}
          onUpdateCount={(cnt) => setUnreadNotifCount(cnt)}
        />
      )}
    </div>
  );
}
