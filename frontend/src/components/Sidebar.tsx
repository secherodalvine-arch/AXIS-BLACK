import React from 'react';
import { NavTab } from '../types';
import { UserProfile } from '../utils/api';

interface SidebarProps {
  currentTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  isOpen: boolean;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onCloseMobile?: () => void;
  user?: UserProfile | null;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  currentTab, 
  onTabChange, 
  isOpen, 
  isCollapsed = false,
  onToggleCollapse,
  onCloseMobile,
  user
}) => {
  const isOwner = !user?.is_sub_user;
  const perms = user?.permissions || [];
  const canAccess = (perm: string) => isOwner || perms.includes(perm);

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''} ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <div className="brand-logo" onClick={() => onTabChange('dashboard')} style={{ cursor: 'pointer' }}>
          <div className="compass-icon">
            <img src="/compass_icon.png" alt="Axis Black Compass Icon" style={{ width: '32px', height: '32px', filter: 'drop-shadow(0 0 8px rgba(0, 212, 255, 0.8))' }} />
          </div>
          {!isCollapsed && (
            <div className="brand-title">
              <span className="brand-name">AXIS<span className="brand-accent">BLACK</span></span>
              <span className="brand-tagline">
                {user?.is_sub_user ? (user.role || 'TEAM WORKSPACE') : 'FINANCIAL INTELLIGENCE'}
              </span>
            </div>
          )}
        </div>

        <button 
          className="collapse-toggle-btn mobile-sidebar-close" 
          onClick={isOpen ? (onCloseMobile || onToggleCollapse) : onToggleCollapse}
          title={isOpen ? "Close Navigation" : (isCollapsed ? "Expand Sidebar" : "Collapse Sidebar")}
        >
          <i className={`fa-solid ${isOpen ? 'fa-xmark' : (isCollapsed ? 'fa-angles-right' : 'fa-angles-left')}`}></i>
        </button>
      </div>

      <nav className="sidebar-nav">
        {canAccess('dashboard') && (
          <button 
            className={`nav-item ${currentTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => onTabChange('dashboard')}
            title={isCollapsed ? "Dashboard" : undefined}
          >
            <div className="nav-icon-wrapper"><i className="fa-solid fa-chart-pie"></i></div>
            {!isCollapsed && <span className="nav-label">Dashboard</span>}
          </button>
        )}

        {canAccess('inventory') && (
          <button 
            className={`nav-item ${currentTab === 'inventory' ? 'active' : ''}`}
            onClick={() => onTabChange('inventory')}
            title={isCollapsed ? "Inventory" : undefined}
          >
            <div className="nav-icon-wrapper"><i className="fa-solid fa-boxes-stacked"></i></div>
            {!isCollapsed && <span className="nav-label">Inventory</span>}
          </button>
        )}

        {canAccess('analytics') && (
          <button 
            className={`nav-item ${currentTab === 'analytics' ? 'active' : ''}`}
            onClick={() => onTabChange('analytics')}
            title={isCollapsed ? "Analytics" : undefined}
          >
            <div className="nav-icon-wrapper"><i className="fa-solid fa-square-poll-vertical"></i></div>
            {!isCollapsed && <span className="nav-label">Analytics</span>}
          </button>
        )}

        {canAccess('transactions') && (
          <button 
            className={`nav-item ${currentTab === 'transactions' ? 'active' : ''}`}
            onClick={() => onTabChange('transactions')}
            title={isCollapsed ? "Ledger" : undefined}
          >
            <div className="nav-icon-wrapper"><i className="fa-solid fa-receipt"></i></div>
            {!isCollapsed && <span className="nav-label">Ledger</span>}
          </button>
        )}

        {canAccess('agent') && (
          <button 
            className={`nav-item ${currentTab === 'agent' ? 'active' : ''}`}
            onClick={() => onTabChange('agent')}
            title={isCollapsed ? "Axis Agent" : undefined}
          >
            <div className="nav-icon-wrapper"><i className="fa-solid fa-brain"></i></div>
            {!isCollapsed && <span className="nav-label">Axis Agent</span>}
          </button>
        )}

        {isOwner && (
          <button 
            className={`nav-item ${currentTab === 'business' ? 'active' : ''}`}
            onClick={() => onTabChange('business')}
            title={isCollapsed ? "My Business" : undefined}
          >
            <div className="nav-icon-wrapper"><i className="fa-solid fa-building"></i></div>
            {!isCollapsed && <span className="nav-label">My Business</span>}
          </button>
        )}

        {canAccess('activities') && (
          <button 
            className={`nav-item ${currentTab === 'activities' ? 'active' : ''}`}
            onClick={() => onTabChange('activities')}
            title={isCollapsed ? "Activities" : undefined}
          >
            <div className="nav-icon-wrapper"><i className="fa-solid fa-clock-rotate-left"></i></div>
            {!isCollapsed && <span className="nav-label">Activities</span>}
          </button>
        )}

        {canAccess('forecast') && (
          <>
            <div className="nav-section-title">STRATEGY &amp; PLANNING</div>
            <button 
              className={`nav-item ${currentTab === 'forecast' ? 'active' : ''}`}
              onClick={() => onTabChange('forecast')}
              title={isCollapsed ? "Runway Simulator" : undefined}
            >
              <div className="nav-icon-wrapper"><i className="fa-solid fa-cubes-stacked"></i></div>
              {!isCollapsed && <span className="nav-label">Runway Simulator</span>}
            </button>
          </>
        )}

        <div className="nav-section-title">SYSTEM</div>
        <button 
          className={`nav-item ${currentTab === 'settings' ? 'active' : ''}`}
          onClick={() => onTabChange('settings')}
          title={isCollapsed ? "Settings" : undefined}
        >
          <div className="nav-icon-wrapper"><i className="fa-solid fa-sliders"></i></div>
          {!isCollapsed && <span className="nav-label">Settings</span>}
        </button>
      </nav>

      <div className="sidebar-footer">
      </div>
    </aside>
  );
};

