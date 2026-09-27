import React, { useState } from 'react';
import { NavTab, Timeframe, Currency } from '../types';
import { formatNotificationTime, formatNotificationDetailTime } from '../utils/dateUtils';

export interface SystemNotification {
  id: string;
  title: string;
  message: string;
  time: string;
  type: 'warning' | 'success' | 'info';
  read: boolean;
}

interface HeaderProps {
  currentTab: NavTab;
  timeframe?: Timeframe;
  currency?: Currency;
  searchQuery?: string;
  userName?: string;
  userEmail?: string;
  userAvatar?: string;
  userRole?: string;
  notifications?: SystemNotification[];
  onClearNotifications?: () => void;
  onDeleteNotification?: (id: string) => void;
  onToggleNotificationRead?: (id: string) => void;
  onMarkAllRead?: () => void;
  onCurrencyChange?: (c: Currency) => void;
  onTimeframeChange?: (tf: Timeframe) => void;
  onOpenNewTxnModal: () => void;
  onOpenVoiceAgent?: () => void;
  onToggleMobileMenu: () => void;
  onSearchChange: (query: string) => void;
  onLogout?: () => void;
  onNavigateLogin?: () => void;
  onNavigateSettings?: () => void;
}

const TAB_TITLES: Record<NavTab, string> = {
  dashboard: 'Dashboard',
  inventory: 'Inventory',
  analytics: 'Analytics',
  transactions: 'Ledger',
  agent: 'Axis Agent',
  business: 'My Business',
  activities: 'Business Activities',
  forecast: 'Runway Simulator',
  settings: 'Settings'
};

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  timeframe: _timeframe,
  currency: _currency,
  searchQuery = '',
  userName = '',
  userEmail = '',
  userAvatar = '',
  userRole = '',
  notifications: propNotifications,
  onClearNotifications,
  onDeleteNotification: propDeleteNotification,
  onToggleNotificationRead: propToggleNotificationRead,
  onMarkAllRead,
  onCurrencyChange: _onCurrencyChange,
  onTimeframeChange: _onTimeframeChange,
  onOpenNewTxnModal,
  onOpenVoiceAgent,
  onToggleMobileMenu,
  onSearchChange,
  onLogout,
  onNavigateLogin,
  onNavigateSettings
}) => {
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showNotificationDropdown, setShowNotificationDropdown] = useState(false);
  const [localNotifications, setLocalNotifications] = useState<SystemNotification[]>([]);
  const [notifFilter, setNotifFilter] = useState<'all' | 'unread'>('all');
  const [selectedNotif, setSelectedNotif] = useState<SystemNotification | null>(null);

  const notifications = propNotifications ?? localNotifications;
  const setNotifications = setLocalNotifications;

  const displayName = userName || (userEmail ? userEmail.split('@')[0] : 'Operator');
  const unreadCount = notifications.filter(n => !n.read).length;

  const filteredNotifications = notifications.filter(n => {
    if (notifFilter === 'unread') return !n.read;
    return true;
  });

  const markAllRead = () => {
    if (onMarkAllRead) onMarkAllRead();
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const clearNotifications = () => {
    if (onClearNotifications) onClearNotifications();
    setNotifications([]);
  };

  const deleteNotification = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (propDeleteNotification) propDeleteNotification(id);
    setNotifications(prev => prev.filter(n => n.id !== id));
    if (selectedNotif?.id === id) {
      setSelectedNotif(null);
    }
  };

  const toggleNotificationRead = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (propToggleNotificationRead) propToggleNotificationRead(id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: !n.read } : n));
  };

  const openNotifDetail = (notif: SystemNotification) => {
    setSelectedNotif(notif);
    if (!notif.read) {
      if (propToggleNotificationRead) propToggleNotificationRead(notif.id);
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
    }
  };

  return (
    <header className="top-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 28px', height: '64px', background: 'var(--header-bg, rgba(10, 10, 14, 0.85))', backdropFilter: 'blur(16px)', borderBottom: '1px solid var(--header-border, rgba(255, 255, 255, 0.08))', position: 'relative', zIndex: 100 }}>
      <div className="header-left" style={{ display: 'flex', alignItems: 'center', gap: '16px', minWidth: '180px' }}>
        <div className="mobile-toggle" onClick={onToggleMobileMenu} title="Toggle Navigation" style={{ color: 'var(--text-main, #ffffff)', cursor: 'pointer' }}>
          <i className="fa-solid fa-bars"></i>
        </div>
        <div className="breadcrumb-container" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="breadcrumb-current" style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main, #ffffff)', fontFamily: 'Plus Jakarta Sans' }}>
            {TAB_TITLES[currentTab]}
          </span>
        </div>
      </div>

      <div className="header-center" style={{ flex: 1, maxWidth: '680px', margin: '0 24px', display: 'flex', justifyContent: 'center' }}>
        <div className="global-search-bar" style={{ width: '100%', position: 'relative' }}>
          <i className="fa-solid fa-magnifying-glass search-icon" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim, #9ca3af)', fontSize: '0.85rem' }}></i>
          <input 
            type="text" 
            placeholder="Search metrics, ledger transactions, inventory, insights..." 
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            style={{ width: '100%', padding: '9px 16px 9px 38px', background: 'var(--search-bg, #141418)', border: '1px solid var(--search-border, rgba(255, 255, 255, 0.12))', borderRadius: '20px', color: 'var(--text-main, #ffffff)', fontSize: '0.85rem' }}
          />
        </div>
      </div>

      <div className="header-right" style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'nowrap' }}>

        {onOpenVoiceAgent && (
          <button 
            className="action-btn-secondary voice-header-btn" 
            onClick={onOpenVoiceAgent}
            style={{
              background: 'rgba(0, 212, 255, 0.12)',
              border: '1px solid rgba(0, 212, 255, 0.35)',
              color: '#00d4ff',
              padding: '7px 14px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontWeight: 600,
              fontSize: '0.82rem',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
            title="Open Voice Support Agent"
          >
            <i className="fa-solid fa-microphone-lines" style={{ fontSize: '0.9rem' }}></i>
            <span>Voice Support</span>
          </button>
        )}

        <button className="action-btn-primary" onClick={onOpenNewTxnModal} style={{ padding: '7px 16px', fontSize: '0.85rem', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <i className="fa-solid fa-plus"></i>
          <span>New Entry</span>
        </button>

        <div className="header-divider" style={{ width: '1px', height: '24px', background: 'var(--header-divider, rgba(255, 255, 255, 0.12))', margin: '0 2px' }}></div>

        {/* NOTIFICATION CENTER BUTTON & DROPDOWN */}
        <div style={{ position: 'relative' }}>
          <button 
            className="icon-btn" 
            title="System Notifications"
            onClick={() => {
              setShowNotificationDropdown(!showNotificationDropdown);
              setShowProfileDropdown(false);
            }}
            style={{ 
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'var(--header-btn-bg, #141418)',
              border: '1px solid var(--header-btn-border, rgba(255, 255, 255, 0.12))',
              color: 'var(--text-main, #ffffff)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              position: 'relative'
            }}
          >
            <i className="fa-solid fa-bell" style={{ fontSize: '1rem', color: unreadCount > 0 ? '#00d4ff' : 'var(--text-dim, #9ca3af)' }}></i>
            {unreadCount > 0 && (
              <span className="notification-dot" style={{
                position: 'absolute',
                top: '6px',
                right: '6px',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#00d4ff',
                boxShadow: '0 0 8px #00d4ff'
              }}></span>
            )}
          </button>

          {showNotificationDropdown && (
            <div 
              className="notification-dropdown glass-card"
              style={{
                position: 'absolute',
                top: '125%',
                right: 0,
                width: '380px',
                maxHeight: '460px',
                background: 'var(--dropdown-bg, #141418)',
                border: '1px solid var(--dropdown-border, rgba(0, 212, 255, 0.35))',
                borderRadius: '16px',
                padding: '16px',
                boxShadow: 'var(--dropdown-shadow, 0 20px 60px rgba(0, 0, 0, 0.9), 0 0 30px rgba(0, 212, 255, 0.15))',
                zIndex: 1000,
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}
            >
              {/* Header bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--header-border, rgba(255, 255, 255, 0.1))', paddingBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main, #ffffff)', fontFamily: 'Plus Jakarta Sans' }}>
                    Notifications
                  </h4>
                  {unreadCount > 0 && (
                    <span className="pill-tag cyan" style={{ fontSize: '0.65rem', padding: '2px 8px' }}>
                      {unreadCount} UNREAD
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {unreadCount > 0 && (
                    <button 
                      onClick={markAllRead} 
                      style={{ background: 'transparent', border: 'none', color: '#00d4ff', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600 }}
                    >
                      Mark read
                    </button>
                  )}
                  {notifications.length > 0 && (
                    <button 
                      onClick={clearNotifications} 
                      style={{ background: 'transparent', border: 'none', color: '#ff8e8e', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600 }}
                    >
                      Clear all
                    </button>
                  )}
                </div>
              </div>

              {/* Filter Tabs */}
              <div style={{ display: 'flex', gap: '6px', background: 'rgba(255, 255, 255, 0.04)', padding: '3px', borderRadius: '8px' }}>
                <button
                  onClick={() => setNotifFilter('all')}
                  style={{
                    flex: 1,
                    padding: '4px 8px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    borderRadius: '6px',
                    background: notifFilter === 'all' ? 'rgba(0, 212, 255, 0.2)' : 'transparent',
                    color: notifFilter === 'all' ? '#00d4ff' : '#9ca3af',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  All ({notifications.length})
                </button>
                <button
                  onClick={() => setNotifFilter('unread')}
                  style={{
                    flex: 1,
                    padding: '4px 8px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    borderRadius: '6px',
                    background: notifFilter === 'unread' ? 'rgba(0, 212, 255, 0.2)' : 'transparent',
                    color: notifFilter === 'unread' ? '#00d4ff' : '#9ca3af',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  Unread ({unreadCount})
                </button>
              </div>

              {/* List */}
              <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '300px', paddingRight: '4px' }}>
                {filteredNotifications.length === 0 ? (
                  <div style={{ padding: '24px 12px', textAlign: 'center', color: '#9ca3af', fontSize: '0.85rem' }}>
                    <i className="fa-solid fa-bell-slash" style={{ fontSize: '1.5rem', marginBottom: '8px', display: 'block', color: 'rgba(255, 255, 255, 0.2)' }}></i>
                    No {notifFilter === 'unread' ? 'unread' : ''} notifications.
                  </div>
                ) : (
                  filteredNotifications.map(n => (
                    <div
                      key={n.id}
                      onClick={() => openNotifDetail(n)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '10px',
                        background: n.read ? 'var(--notif-read-bg, rgba(255, 255, 255, 0.02))' : 'var(--notif-unread-bg, rgba(0, 212, 255, 0.08))',
                        border: n.read ? '1px solid var(--header-border, rgba(255, 255, 255, 0.05))' : '1px solid rgba(0, 212, 255, 0.3)',
                        cursor: 'pointer',
                        userSelect: 'none',
                        WebkitUserSelect: 'none',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        gap: '10px',
                        alignItems: 'flex-start',
                        position: 'relative'
                      }}
                    >
                      <div style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '8px',
                        background: n.type === 'warning' ? 'rgba(255, 142, 142, 0.2)' : n.type === 'success' ? 'rgba(0, 212, 255, 0.2)' : 'rgba(167, 139, 250, 0.2)',
                        color: n.type === 'warning' ? '#ff8e8e' : n.type === 'success' ? '#00d4ff' : '#cebdff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.8rem',
                        flexShrink: 0,
                        marginTop: '2px',
                        cursor: 'pointer'
                      }}>
                        <i className={n.type === 'warning' ? 'fa-solid fa-triangle-exclamation' : n.type === 'success' ? 'fa-solid fa-circle-check' : 'fa-solid fa-lightbulb'}></i>
                      </div>

                      <div style={{ flex: 1, cursor: 'pointer', userSelect: 'none' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main, #ffffff)', cursor: 'pointer', userSelect: 'none' }}>{n.title}</span>
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-dim, #9ca3af)', fontFamily: 'JetBrains Mono', cursor: 'pointer', userSelect: 'none' }}>{formatNotificationTime(n.time)}</span>
                        </div>
                        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted, #9ca3af)', margin: '4px 0 0', lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', cursor: 'pointer', userSelect: 'none' }}>
                          {n.message}
                        </p>
                      </div>

                      {/* Action Icon Buttons */}
                      <div style={{ display: 'flex', gap: '4px', opacity: 0.8 }} onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={(e) => toggleNotificationRead(n.id, e)}
                          title={n.read ? "Mark as unread" : "Mark as read"}
                          style={{ background: 'transparent', border: 'none', color: '#00d4ff', cursor: 'pointer', padding: '2px 4px', fontSize: '0.75rem' }}
                        >
                          <i className={n.read ? "fa-regular fa-envelope-open" : "fa-solid fa-envelope"}></i>
                        </button>
                        <button
                          onClick={(e) => deleteNotification(n.id, e)}
                          title="Delete notification"
                          style={{ background: 'transparent', border: 'none', color: '#ff8e8e', cursor: 'pointer', padding: '2px 4px', fontSize: '0.75rem' }}
                        >
                          <i className="fa-solid fa-trash-can"></i>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* USER PROFILE DROPDOWN */}
        <div className="user-profile-wrapper" style={{ position: 'relative' }}>
          <div 
            className="user-profile-menu" 
            title="User Profile Options"
            onClick={() => {
              setShowProfileDropdown(!showProfileDropdown);
              setShowNotificationDropdown(false);
            }}
            style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--user-menu-bg, #141418)', border: '1px solid var(--user-menu-border, rgba(255, 255, 255, 0.12))', padding: '4px 10px 4px 4px', borderRadius: '20px', cursor: 'pointer' }}
          >
            {userAvatar ? (
              <img 
                src={userAvatar} 
                alt={displayName} 
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '1.5px solid #00d4ff'
                }}
              />
            ) : (
              <div className="avatar-initials" style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #00d4ff, #7c5fe6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '13px',
                color: '#ffffff'
              }}>
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
            
            <div className="user-meta" style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
              <span className="user-name" style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main, #ffffff)', lineHeight: 1.2 }}>{displayName}</span>
              <span className="user-role" style={{ fontSize: '0.7rem', color: 'var(--text-muted, #9ca3af)', lineHeight: 1.2 }}>{userRole || 'CFO'}</span>
            </div>
            <i className="fa-solid fa-chevron-down profile-arrow" style={{ fontSize: '0.7rem', color: 'var(--text-muted, #9ca3af)', marginLeft: '2px' }}></i>
          </div>

          {showProfileDropdown && (
            <div className="profile-dropdown-menu" style={{
              position: 'absolute',
              top: '120%',
              right: 0,
              width: '210px',
              background: 'var(--dropdown-bg, #141418)',
              border: '1px solid var(--user-menu-border, rgba(255, 255, 255, 0.12))',
              borderRadius: '12px',
              padding: '8px',
              boxShadow: 'var(--dropdown-shadow, 0 12px 32px rgba(0, 0, 0, 0.8))',
              zIndex: 100
            }}>
              {/* Profile Identity Summary */}
              <div style={{ padding: '8px 12px 10px', borderBottom: '1px solid var(--header-border, rgba(255, 255, 255, 0.08))', marginBottom: '6px' }}>
                <div style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-main, #ffffff)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {displayName}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #9ca3af)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '2px' }}>
                  {userEmail || userRole || 'Active Operator'}
                </div>
              </div>

              {/* Settings Action */}
              {onNavigateSettings && (
                <button
                  onClick={() => {
                    setShowProfileDropdown(false);
                    onNavigateSettings();
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: 'transparent',
                    border: 'none',
                    borderRadius: '8px',
                    color: 'var(--text-main, #e5e2e1)',
                    fontSize: '0.85rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    marginBottom: '4px',
                    transition: 'all 0.2s ease',
                    textAlign: 'left'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0, 212, 255, 0.1)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <i className="fa-solid fa-gear" style={{ color: '#00d4ff', width: '16px', textAlign: 'center' }}></i>
                  <span>Settings</span>
                </button>
              )}

              {/* Logout Action */}
              {onLogout ? (
                <button
                  onClick={() => {
                    setShowProfileDropdown(false);
                    onLogout();
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: 'rgba(255, 142, 142, 0.08)',
                    border: '1px solid rgba(255, 142, 142, 0.2)',
                    borderRadius: '8px',
                    color: '#ff8e8e',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    transition: 'all 0.2s ease',
                    textAlign: 'left'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 142, 142, 0.18)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255, 142, 142, 0.08)')}
                >
                  <i className="fa-solid fa-right-from-bracket" style={{ width: '16px', textAlign: 'center' }}></i>
                  <span>Logout</span>
                </button>
              ) : onNavigateLogin ? (
                <button
                  onClick={() => {
                    setShowProfileDropdown(false);
                    onNavigateLogin();
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: 'rgba(0, 212, 255, 0.1)',
                    border: '1px solid rgba(0, 212, 255, 0.2)',
                    borderRadius: '8px',
                    color: '#00d4ff',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                  }}
                >
                  <i className="fa-solid fa-right-to-bracket" style={{ width: '16px', textAlign: 'center' }}></i>
                  <span>Sign In</span>
                </button>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {/* NOTIFICATION DETAIL MODAL */}
      {selectedNotif && (
        <div className="modal-overlay active" style={{ zIndex: 2000 }}>
          <div className="modal-card glass-card" style={{ width: '460px', background: 'var(--dropdown-bg, #141418)', border: '1px solid var(--dropdown-border, rgba(0, 212, 255, 0.4))', boxShadow: 'var(--dropdown-shadow, 0 24px 80px rgba(0,0,0,0.95))' }}>
            <div className="modal-header" style={{ borderBottom: '1px solid var(--header-border, rgba(255, 255, 255, 0.1))', paddingBottom: '12px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className={`pill-tag ${selectedNotif.type === 'warning' ? 'pink' : selectedNotif.type === 'success' ? 'cyan' : 'lilac'}`} style={{ fontSize: '0.68rem' }}>
                  {selectedNotif.type.toUpperCase()}
                </span>
                <span style={{ fontSize: '0.75rem', fontFamily: 'JetBrains Mono', color: 'var(--text-dim, #9ca3af)' }}>{formatNotificationDetailTime(selectedNotif.time)}</span>
              </div>
              <button className="modal-close" onClick={() => setSelectedNotif(null)} style={{ color: 'var(--text-muted, #9ca3af)', background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer' }}>&times;</button>
            </div>

            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main, #ffffff)', fontFamily: 'Plus Jakarta Sans', margin: '0 0 12px 0' }}>
              {selectedNotif.title}
            </h3>

            <p style={{ fontSize: '0.9rem', color: 'var(--text-main, #e5e2e1)', lineHeight: 1.5, background: 'var(--modal-msg-bg, rgba(255, 255, 255, 0.03))', padding: '14px', borderRadius: '10px', border: '1px solid var(--modal-msg-border, rgba(255, 255, 255, 0.06))' }}>
              {selectedNotif.message}
            </p>

            <div className="modal-actions" style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button 
                type="button" 
                className="action-btn-secondary"
                onClick={() => deleteNotification(selectedNotif.id, {} as any)}
                style={{ color: '#ff8e8e', border: '1px solid rgba(255, 142, 142, 0.3)' }}
              >
                <i className="fa-solid fa-trash-can"></i> Delete
              </button>

              <button 
                type="button" 
                className="action-btn-primary"
                onClick={() => setSelectedNotif(null)}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};


