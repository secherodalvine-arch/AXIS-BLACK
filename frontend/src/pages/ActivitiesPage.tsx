import React, { useState, useEffect, useMemo } from 'react';
import { ActivityLog, Branch } from '../types';
import { getActivitiesApi, getBranchesApi } from '../utils/api';
import { formatNotificationTime } from '../utils/dateUtils';

interface ActivitiesPageProps {
  userRole?: string;
  isOwner?: boolean;
}

export const ActivitiesPage: React.FC<ActivitiesPageProps> = () => {
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'inventory' | 'transaction' | 'branch' | 'role' | 'team'>('all');
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [actorFilter, setActorFilter] = useState<'all' | 'owner' | 'team'>('all');
  const [selectedActivity, setSelectedActivity] = useState<ActivityLog | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [acts, brs] = await Promise.all([
        getActivitiesApi(),
        getBranchesApi().catch(() => [])
      ]);
      setActivities(acts || []);
      setBranches(brs || []);
    } catch (err) {
      console.error('Failed to fetch activities:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const handleDataUpdated = () => {
      fetchData();
    };
    window.addEventListener('axis-data-updated', handleDataUpdated);
    return () => window.removeEventListener('axis-data-updated', handleDataUpdated);
  }, []);

  // Filtered Activities
  const filteredActivities = useMemo(() => {
    return activities.filter(act => {
      // 1. Category filter
      if (categoryFilter !== 'all') {
        if (!act.action.startsWith(categoryFilter)) return false;
      }
      // 2. Branch filter
      if (branchFilter !== 'all') {
        if (act.branch_id !== branchFilter && act.branch_name !== branchFilter) return false;
      }
      // 3. Actor filter
      if (actorFilter === 'owner' && act.actor_role !== 'Owner') return false;
      if (actorFilter === 'team' && act.actor_role === 'Owner') return false;

      // 4. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = (act.title || '').toLowerCase().includes(q);
        const matchDetails = (act.details || '').toLowerCase().includes(q);
        const matchActor = (act.actor_name || '').toLowerCase().includes(q);
        const matchAction = (act.action || '').toLowerCase().includes(q);
        const matchBranch = (act.branch_name || '').toLowerCase().includes(q);
        if (!matchTitle && !matchDetails && !matchActor && !matchAction && !matchBranch) {
          return false;
        }
      }
      return true;
    });
  }, [activities, categoryFilter, branchFilter, actorFilter, searchQuery]);

  // Statistics counters
  const totalEvents = activities.length;
  const teamEvents = activities.filter(a => a.actor_role !== 'Owner').length;
  const inventoryEvents = activities.filter(a => a.action.startsWith('inventory')).length;
  const ledgerEvents = activities.filter(a => a.action.startsWith('transaction')).length;

  const getActionBadge = (action: string) => {
    if (action.startsWith('inventory')) {
      return {
        icon: 'fa-boxes-stacked',
        color: '#00d4ff',
        bg: 'rgba(0, 212, 255, 0.12)',
        border: 'rgba(0, 212, 255, 0.3)',
        label: 'Inventory'
      };
    }
    if (action.startsWith('transaction')) {
      return {
        icon: 'fa-receipt',
        color: '#10b981',
        bg: 'rgba(16, 185, 129, 0.12)',
        border: 'rgba(16, 185, 129, 0.3)',
        label: 'Ledger'
      };
    }
    if (action.startsWith('branch')) {
      return {
        icon: 'fa-building',
        color: '#a78bfa',
        bg: 'rgba(167, 139, 250, 0.12)',
        border: 'rgba(167, 139, 250, 0.3)',
        label: 'Branch'
      };
    }
    if (action.startsWith('role')) {
      return {
        icon: 'fa-shield-halved',
        color: '#f59e0b',
        bg: 'rgba(245, 158, 11, 0.12)',
        border: 'rgba(245, 158, 11, 0.3)',
        label: 'Role'
      };
    }
    if (action.startsWith('team')) {
      return {
        icon: 'fa-user-plus',
        color: '#ec4899',
        bg: 'rgba(236, 72, 153, 0.12)',
        border: 'rgba(236, 72, 153, 0.3)',
        label: 'Team Access'
      };
    }
    return {
      icon: 'fa-clock-rotate-left',
      color: '#9ca3af',
      bg: 'rgba(156, 163, 175, 0.12)',
      border: 'rgba(156, 163, 175, 0.3)',
      label: 'System'
    };
  };

  return (
    <div className="analytics-page-container" style={{ padding: '0.75rem 0.5rem', maxWidth: '1400px', margin: '0 auto' }}>
      
      {/* ── Page Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'rgba(0, 212, 255, 0.15)',
              border: '1px solid rgba(0, 212, 255, 0.3)',
              color: 'var(--secondary-cyan, #00d4ff)',
              fontSize: '0.95rem'
            }}>
              <i className="fa-solid fa-clock-rotate-left"></i>
            </span>
            <h1 className="activity-header-title" style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
              Business Activities &amp; Audit Trail
            </h1>
          </div>
          <p className="activity-header-sub" style={{ margin: 0, fontSize: '0.82rem' }}>
            Real-time immutable log of every action performed on inventory, ledger transactions, branch assignments, and team roles.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={fetchData}
            disabled={loading}
            className="activity-refresh-btn"
          >
            <i className={`fa-solid fa-arrows-rotate ${loading ? 'fa-spin' : ''}`} style={{ color: 'var(--secondary-cyan, #00d4ff)' }}></i>
            {loading ? 'Refreshing...' : 'Refresh Logs'}
          </button>
        </div>
      </div>

      {/* ── Summary Stat Cards: 2x2 Grid ── */}
      <div className="activity-stats-grid" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        gap: '10px',
        marginBottom: '1.25rem'
      }}>
        <div className="activity-stat-card" style={{ padding: '14px', borderRadius: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
            <span className="activity-stat-label" style={{ fontSize: '0.75rem' }}>
              Total Activities
            </span>
            <span style={{ color: 'var(--secondary-cyan, #00d4ff)', fontSize: '0.85rem' }}>
              <i className="fa-solid fa-list-check"></i>
            </span>
          </div>
          <div className="activity-stat-val" style={{ fontSize: '1.3rem' }}>
            {totalEvents}
          </div>
          <div className="activity-stat-sub" style={{ fontSize: '0.72rem' }}>
            Recorded system events
          </div>
        </div>

        <div className="activity-stat-card" style={{ padding: '14px', borderRadius: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
            <span className="activity-stat-label" style={{ fontSize: '0.75rem' }}>
              Team Member Actions
            </span>
            <span style={{ color: '#a78bfa', fontSize: '0.85rem' }}>
              <i className="fa-solid fa-users-gear"></i>
            </span>
          </div>
          <div className="activity-stat-val" style={{ color: '#a78bfa', fontSize: '1.3rem' }}>
            {teamEvents}
          </div>
          <div className="activity-stat-sub" style={{ fontSize: '0.72rem' }}>
            By managers &amp; staff
          </div>
        </div>

        <div className="activity-stat-card" style={{ padding: '14px', borderRadius: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
            <span className="activity-stat-label" style={{ fontSize: '0.75rem' }}>
              Inventory Changes
            </span>
            <span style={{ color: '#38bdf8', fontSize: '0.85rem' }}>
              <i className="fa-solid fa-boxes-stacked"></i>
            </span>
          </div>
          <div className="activity-stat-val" style={{ color: '#38bdf8', fontSize: '1.3rem' }}>
            {inventoryEvents}
          </div>
          <div className="activity-stat-sub" style={{ fontSize: '0.72rem' }}>
            SKU creations, edits &amp; imports
          </div>
        </div>

        <div className="activity-stat-card" style={{ padding: '14px', borderRadius: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
            <span className="activity-stat-label" style={{ fontSize: '0.75rem' }}>
              Ledger Transactions
            </span>
            <span style={{ color: '#10b981', fontSize: '0.85rem' }}>
              <i className="fa-solid fa-receipt"></i>
            </span>
          </div>
          <div className="activity-stat-val" style={{ color: '#10b981', fontSize: '1.3rem' }}>
            {ledgerEvents}
          </div>
          <div className="activity-stat-sub" style={{ fontSize: '0.72rem' }}>
            Revenue &amp; expenses logged
          </div>
        </div>
      </div>

      {/* ── Filters & Search Bar ── */}
      <div className="activity-filter-bar" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem', padding: '12px', borderRadius: '12px' }}>
        {/* Search & All Branches on ONE Line Horizontally */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', width: '100%', flexWrap: 'nowrap' }}>
          <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
            <i className="fa-solid fa-magnifying-glass" style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted, #6b7280)',
              fontSize: '0.85rem'
            }}></i>
            <input
              type="text"
              className="activity-search-input"
              placeholder="Search by action, item, counterparty, actor, or SKU..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box', paddingLeft: '34px', height: '38px', borderRadius: '8px' }}
            />
          </div>

          {/* Branch Filter dropdown on same line */}
          <select
            value={branchFilter}
            onChange={e => setBranchFilter(e.target.value)}
            className="activity-select"
            style={{ width: 'auto', flexShrink: 0, height: '38px', borderRadius: '8px', padding: '0 10px', fontSize: '0.82rem' }}
          >
            <option value="all">All Branches</option>
            {branches.map(b => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>

          {/* Actor Filter */}
          <select
            value={actorFilter}
            onChange={e => setActorFilter(e.target.value as any)}
            className="activity-select"
            style={{ width: 'auto', flexShrink: 0, height: '38px', borderRadius: '8px', padding: '0 10px', fontSize: '0.82rem' }}
          >
            <option value="all">All Actors</option>
            <option value="owner">Owner Only</option>
            <option value="team">Team Members</option>
          </select>
        </div>

        {/* Action Category Filter on ONE Line Horizontally */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'nowrap', overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: '2px' }}>
          {(['all', 'inventory', 'transaction', 'branch', 'role', 'team'] as const).map(cat => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`activity-cat-pill ${categoryFilter === cat ? 'active' : ''}`}
              style={{ whiteSpace: 'nowrap', flexShrink: 0, fontSize: '0.78rem', padding: '5px 12px' }}
            >
              {cat === 'all' ? 'All Activities' : cat === 'transaction' ? 'Ledger' : cat}
            </button>
          ))}
        </div>
      </div>

      {/* ── Activity Feed Stream ── */}
      {loading ? (
        <div className="activity-empty-box">
          <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: '2rem', color: 'var(--secondary-cyan, #00d4ff)', marginBottom: '1rem' }}></i>
          <p style={{ color: 'var(--text-muted, #9ca3af)', fontSize: '0.9rem' }}>Loading activity audit stream...</p>
        </div>
      ) : filteredActivities.length === 0 ? (
        <div className="activity-empty-box">
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '54px',
            height: '54px',
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.04)',
            color: 'var(--text-muted, #6b7280)',
            fontSize: '1.5rem',
            marginBottom: '1rem'
          }}>
            <i className="fa-solid fa-inbox"></i>
          </div>
          <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-main, #e5e7eb)', fontSize: '1.1rem' }}>No Activities Found</h3>
          <p style={{ margin: 0, color: 'var(--text-muted, #9ca3af)', fontSize: '0.85rem', maxWidth: '420px', marginLeft: 'auto', marginRight: 'auto' }}>
            {searchQuery || categoryFilter !== 'all' || branchFilter !== 'all' || actorFilter !== 'all'
              ? 'No activity entries matched your active filters. Try clearing or expanding your search.'
              : 'Every business action performed on the platform by you or your team will be recorded here.'}
          </p>
          {(searchQuery || categoryFilter !== 'all' || branchFilter !== 'all' || actorFilter !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setCategoryFilter('all');
                setBranchFilter('all');
                setActorFilter('all');
              }}
              className="action-btn-secondary"
              style={{ marginTop: '1.25rem', padding: '0.5rem 1rem', fontSize: '0.82rem' }}
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {filteredActivities.map(item => {
            const badge = getActionBadge(item.action);
            const isOwnerActor = item.actor_role === 'Owner';

            return (
              <div
                key={item.id}
                onClick={() => setSelectedActivity(item)}
                className="activity-item-card"
              >
                {/* Action Icon Badge */}
                <div style={{
                  flexShrink: 0,
                  width: '42px',
                  height: '42px',
                  borderRadius: '10px',
                  background: badge.bg,
                  border: `1px solid ${badge.border}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: badge.color,
                  fontSize: '1.05rem'
                }}>
                  <i className={`fa-solid ${badge.icon}`}></i>
                </div>

                {/* Main Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
                    <span className="activity-item-title">
                      {item.title}
                    </span>

                    {/* Category Tag */}
                    <span style={{
                      fontSize: '0.68rem',
                      fontWeight: 600,
                      padding: '0.15rem 0.5rem',
                      borderRadius: '4px',
                      background: badge.bg,
                      color: badge.color,
                      border: `1px solid ${badge.border}`,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em'
                    }}>
                      {badge.label}
                    </span>

                    {/* Branch Tag if available */}
                    {item.branch_name && (
                      <span className="activity-branch-tag">
                        <i className="fa-solid fa-code-branch" style={{ fontSize: '0.65rem', color: '#a78bfa' }}></i>
                        {item.branch_name}
                      </span>
                    )}
                  </div>

                  {/* Details Line */}
                  <div className="activity-item-details">
                    {item.details}
                  </div>
                </div>

                {/* Actor Info & Timestamp */}
                <div style={{
                  flexShrink: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-end',
                  gap: '0.25rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span className="activity-actor-name">
                      {item.actor_name || 'System'}
                    </span>
                    <span style={{
                      fontSize: '0.68rem',
                      fontWeight: 600,
                      padding: '0.1rem 0.4rem',
                      borderRadius: '4px',
                      background: isOwnerActor ? 'rgba(245, 158, 11, 0.15)' : 'rgba(167, 139, 250, 0.15)',
                      color: isOwnerActor ? '#fbbf24' : '#c084fc',
                      border: isOwnerActor ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid rgba(167, 139, 250, 0.3)'
                    }}>
                      {isOwnerActor ? 'Owner' : 'Team'}
                    </span>
                  </div>

                  <span className="activity-timestamp">
                    <i className="fa-regular fa-clock" style={{ fontSize: '0.65rem' }}></i>
                    {formatNotificationTime(item.timestamp)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Activity Detail Modal ── */}
      {selectedActivity && (
        <div className="modal-overlay active activity-modal-overlay">
          <div className="modal-card glass-card activity-modal-card">
            {/* Close Button */}
            <button
              onClick={() => setSelectedActivity(null)}
              className="modal-close"
              style={{ position: 'absolute', top: '1rem', right: '1rem', fontSize: '1.2rem', cursor: 'pointer' }}
            >
              <i className="fa-solid fa-xmark"></i>
            </button>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                background: getActionBadge(selectedActivity.action).bg,
                border: `1px solid ${getActionBadge(selectedActivity.action).border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: getActionBadge(selectedActivity.action).color,
                fontSize: '1.1rem'
              }}>
                <i className={`fa-solid ${getActionBadge(selectedActivity.action).icon}`}></i>
              </div>
              <div>
                <h3 className="activity-modal-title" style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600 }}>
                  {selectedActivity.title}
                </h3>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #9ca3af)' }}>
                  Action ID: <span style={{ fontFamily: 'monospace', color: 'var(--secondary-cyan, #00d4ff)' }}>{selectedActivity.id}</span>
                </div>
              </div>
            </div>

            {/* Details Table */}
            <div className="activity-modal-box">
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                <span className="activity-modal-label">Action Performed:</span>
                <span className="activity-modal-val" style={{ fontFamily: 'monospace' }}>{selectedActivity.action}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                <span className="activity-modal-label">Executed By:</span>
                <span className="activity-modal-val" style={{ fontWeight: 500 }}>
                  {selectedActivity.actor_name} ({selectedActivity.actor_role})
                </span>
              </div>

              {selectedActivity.branch_name && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                  <span className="activity-modal-label">Branch Scoped:</span>
                  <span style={{ color: '#a78bfa' }}>{selectedActivity.branch_name}</span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                <span className="activity-modal-label">Exact Timestamp:</span>
                <span className="activity-modal-val">
                  {new Date(selectedActivity.timestamp).toLocaleString(undefined, {
                    dateStyle: 'medium',
                    timeStyle: 'medium'
                  })}
                </span>
              </div>
            </div>

            {/* Full Details Text */}
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted, #9ca3af)', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                Event Log Details:
              </div>
              <div className="activity-modal-log-box">
                {selectedActivity.details}
              </div>
            </div>

            {/* Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setSelectedActivity(null)}
                className="action-btn-primary"
                style={{ fontSize: '0.85rem', padding: '0.55rem 1.25rem' }}
              >
                Close Audit Entry
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

