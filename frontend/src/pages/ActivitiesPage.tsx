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
    <div className="analytics-page-container" style={{ padding: '1.5rem', maxWidth: '1400px', margin: '0 auto' }}>
      
      {/* ── Page Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
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
              color: '#00d4ff',
              fontSize: '0.95rem'
            }}>
              <i className="fa-solid fa-clock-rotate-left"></i>
            </span>
            <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#f9fafb', letterSpacing: '-0.02em' }}>
              Business Activities &amp; Audit Trail
            </h1>
          </div>
          <p style={{ margin: 0, color: '#9ca3af', fontSize: '0.85rem' }}>
            Real-time immutable log of every action performed on inventory, ledger transactions, branch assignments, and team roles.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={fetchData}
            disabled={loading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: '#e5e7eb',
              borderRadius: '8px',
              padding: '0.55rem 1rem',
              fontSize: '0.85rem',
              fontWeight: 500,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(0, 212, 255, 0.5)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)'}
          >
            <i className={`fa-solid fa-arrows-rotate ${loading ? 'fa-spin' : ''}`} style={{ color: '#00d4ff' }}></i>
            {loading ? 'Refreshing...' : 'Refresh Logs'}
          </button>
        </div>
      </div>

      {/* ── Summary Stat Cards ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '1rem',
        marginBottom: '1.5rem'
      }}>
        <div style={{
          background: 'rgba(17, 24, 39, 0.7)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '12px',
          padding: '1.1rem',
          backdropFilter: 'blur(12px)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Total Activities
            </span>
            <span style={{ color: '#00d4ff', fontSize: '0.9rem' }}>
              <i className="fa-solid fa-list-check"></i>
            </span>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#f3f4f6' }}>
            {totalEvents}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: '0.2rem' }}>
            Recorded system events
          </div>
        </div>

        <div style={{
          background: 'rgba(17, 24, 39, 0.7)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '12px',
          padding: '1.1rem',
          backdropFilter: 'blur(12px)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Team Member Actions
            </span>
            <span style={{ color: '#a78bfa', fontSize: '0.9rem' }}>
              <i className="fa-solid fa-users-gear"></i>
            </span>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#a78bfa' }}>
            {teamEvents}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: '0.2rem' }}>
            By managers &amp; staff
          </div>
        </div>

        <div style={{
          background: 'rgba(17, 24, 39, 0.7)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '12px',
          padding: '1.1rem',
          backdropFilter: 'blur(12px)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Inventory Changes
            </span>
            <span style={{ color: '#38bdf8', fontSize: '0.9rem' }}>
              <i className="fa-solid fa-boxes-stacked"></i>
            </span>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#38bdf8' }}>
            {inventoryEvents}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: '0.2rem' }}>
            SKU creations, edits &amp; imports
          </div>
        </div>

        <div style={{
          background: 'rgba(17, 24, 39, 0.7)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '12px',
          padding: '1.1rem',
          backdropFilter: 'blur(12px)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Ledger Transactions
            </span>
            <span style={{ color: '#10b981', fontSize: '0.9rem' }}>
              <i className="fa-solid fa-receipt"></i>
            </span>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#10b981' }}>
            {ledgerEvents}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: '0.2rem' }}>
            Revenue &amp; expenses logged
          </div>
        </div>
      </div>

      {/* ── Filters & Search Bar ── */}
      <div style={{
        background: 'rgba(17, 24, 39, 0.65)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '12px',
        padding: '1rem',
        marginBottom: '1.5rem',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.85rem',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        {/* Search */}
        <div style={{ flex: '1 1 260px', position: 'relative' }}>
          <i className="fa-solid fa-magnifying-glass" style={{
            position: 'absolute',
            left: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: '#6b7280',
            fontSize: '0.85rem'
          }}></i>
          <input
            type="text"
            placeholder="Search by action, item, counterparty, actor, or SKU..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              background: 'rgba(0, 0, 0, 0.35)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              padding: '0.55rem 0.75rem 0.55rem 2.2rem',
              color: '#f3f4f6',
              fontSize: '0.85rem',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
        </div>

        {/* Action Category Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
          {(['all', 'inventory', 'transaction', 'branch', 'role', 'team'] as const).map(cat => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              style={{
                background: categoryFilter === cat ? 'rgba(0, 212, 255, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                border: categoryFilter === cat ? '1px solid rgba(0, 212, 255, 0.5)' : '1px solid rgba(255, 255, 255, 0.08)',
                color: categoryFilter === cat ? '#00d4ff' : '#9ca3af',
                borderRadius: '6px',
                padding: '0.4rem 0.75rem',
                fontSize: '0.78rem',
                fontWeight: categoryFilter === cat ? 600 : 400,
                cursor: 'pointer',
                textTransform: 'capitalize',
                transition: 'all 0.15s ease'
              }}
            >
              {cat === 'all' ? 'All Activities' : cat === 'transaction' ? 'Ledger' : cat}
            </button>
          ))}
        </div>

        {/* Actor & Branch Dropdowns */}
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Actor Filter */}
          <select
            value={actorFilter}
            onChange={e => setActorFilter(e.target.value as any)}
            style={{
              background: 'rgba(0, 0, 0, 0.4)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              color: '#d1d5db',
              padding: '0.45rem 0.75rem',
              fontSize: '0.8rem',
              outline: 'none'
            }}
          >
            <option value="all">All Actors</option>
            <option value="owner">Owner Only</option>
            <option value="team">Team Members</option>
          </select>

          {/* Branch Filter */}
          {branches.length > 0 && (
            <select
              value={branchFilter}
              onChange={e => setBranchFilter(e.target.value)}
              style={{
                background: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                color: '#d1d5db',
                padding: '0.45rem 0.75rem',
                fontSize: '0.8rem',
                outline: 'none'
              }}
            >
              <option value="all">All Branches</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* ── Activity Feed Stream ── */}
      {loading ? (
        <div style={{
          textAlign: 'center',
          padding: '4rem 1rem',
          background: 'rgba(17, 24, 39, 0.5)',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.05)'
        }}>
          <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: '2rem', color: '#00d4ff', marginBottom: '1rem' }}></i>
          <p style={{ color: '#9ca3af', fontSize: '0.9rem' }}>Loading activity audit stream...</p>
        </div>
      ) : filteredActivities.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '4rem 1rem',
          background: 'rgba(17, 24, 39, 0.5)',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.05)'
        }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '54px',
            height: '54px',
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.04)',
            color: '#6b7280',
            fontSize: '1.5rem',
            marginBottom: '1rem'
          }}>
            <i className="fa-solid fa-inbox"></i>
          </div>
          <h3 style={{ margin: '0 0 0.5rem 0', color: '#e5e7eb', fontSize: '1.1rem' }}>No Activities Found</h3>
          <p style={{ margin: 0, color: '#9ca3af', fontSize: '0.85rem', maxWidth: '420px', marginLeft: 'auto', marginRight: 'auto' }}>
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
              style={{
                marginTop: '1.25rem',
                background: 'rgba(0, 212, 255, 0.15)',
                border: '1px solid rgba(0, 212, 255, 0.4)',
                color: '#00d4ff',
                borderRadius: '8px',
                padding: '0.5rem 1rem',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
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
                style={{
                  background: 'rgba(17, 24, 39, 0.65)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '10px',
                  padding: '1rem 1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(17, 24, 39, 0.9)';
                  e.currentTarget.style.borderColor = 'rgba(0, 212, 255, 0.35)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'rgba(17, 24, 39, 0.65)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                }}
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
                    <span style={{ fontWeight: 600, color: '#f3f4f6', fontSize: '0.92rem' }}>
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
                      <span style={{
                        fontSize: '0.68rem',
                        padding: '0.15rem 0.5rem',
                        borderRadius: '4px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        color: '#9ca3af',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem'
                      }}>
                        <i className="fa-solid fa-code-branch" style={{ fontSize: '0.65rem', color: '#a78bfa' }}></i>
                        {item.branch_name}
                      </span>
                    )}
                  </div>

                  {/* Details Line */}
                  <div style={{
                    color: '#9ca3af',
                    fontSize: '0.82rem',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
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
                    <span style={{
                      fontSize: '0.78rem',
                      fontWeight: 500,
                      color: '#e5e7eb'
                    }}>
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

                  <span style={{ fontSize: '0.72rem', color: '#6b7280', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
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
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div style={{
            background: '#0d131f',
            border: '1px solid rgba(0, 212, 255, 0.3)',
            borderRadius: '14px',
            width: '100%',
            maxWidth: '540px',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8)',
            padding: '1.5rem',
            position: 'relative'
          }}>
            {/* Close Button */}
            <button
              onClick={() => setSelectedActivity(null)}
              style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                background: 'transparent',
                border: 'none',
                color: '#9ca3af',
                fontSize: '1.1rem',
                cursor: 'pointer'
              }}
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
                <h3 style={{ margin: 0, color: '#f3f4f6', fontSize: '1.05rem', fontWeight: 600 }}>
                  {selectedActivity.title}
                </h3>
                <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                  Action ID: <span style={{ fontFamily: 'monospace', color: '#00d4ff' }}>{selectedActivity.id}</span>
                </div>
              </div>
            </div>

            {/* Details Table */}
            <div style={{
              background: 'rgba(0, 0, 0, 0.4)',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              marginBottom: '1.25rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                <span style={{ color: '#6b7280' }}>Action Performed:</span>
                <span style={{ color: '#e5e7eb', fontFamily: 'monospace' }}>{selectedActivity.action}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                <span style={{ color: '#6b7280' }}>Executed By:</span>
                <span style={{ color: '#e5e7eb', fontWeight: 500 }}>
                  {selectedActivity.actor_name} ({selectedActivity.actor_role})
                </span>
              </div>

              {selectedActivity.branch_name && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                  <span style={{ color: '#6b7280' }}>Branch Scoped:</span>
                  <span style={{ color: '#a78bfa' }}>{selectedActivity.branch_name}</span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                <span style={{ color: '#6b7280' }}>Exact Timestamp:</span>
                <span style={{ color: '#e5e7eb' }}>
                  {new Date(selectedActivity.timestamp).toLocaleString(undefined, {
                    dateStyle: 'medium',
                    timeStyle: 'medium'
                  })}
                </span>
              </div>
            </div>

            {/* Full Details Text */}
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#9ca3af', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                Event Log Details:
              </div>
              <div style={{
                background: 'rgba(0, 0, 0, 0.25)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '8px',
                padding: '0.85rem',
                color: '#d1d5db',
                fontSize: '0.85rem',
                lineHeight: 1.5
              }}>
                {selectedActivity.details}
              </div>
            </div>

            {/* Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setSelectedActivity(null)}
                style={{
                  background: 'rgba(0, 212, 255, 0.15)',
                  border: '1px solid rgba(0, 212, 255, 0.4)',
                  color: '#00d4ff',
                  borderRadius: '8px',
                  padding: '0.55rem 1.25rem',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
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
