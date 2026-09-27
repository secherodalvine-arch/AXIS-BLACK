import React, { useState, useEffect, useCallback } from 'react';
import { Branch, BusinessProfile, BranchPerformance, BusinessRole, SubUser, Currency } from '../types';
import {
  getBusinessProfileApi, updateBusinessProfileApi,
  getBranchesApi, createBranchApi, updateBranchApi, deleteBranchApi, getBranchPerformanceApi,
  getRolesApi, createRoleApi, updateRoleApi, deleteRoleApi,
  getTeamApi, getBranchDetailsApi
} from '../utils/api';
import { formatCurrency } from '../utils/currencyUtils';
import { formatRelativeTime } from '../utils/dateUtils';

interface MyBusinessPageProps {
  currency?: Currency;
  user?: any;
}

const BUSINESS_CATEGORIES = [
  'Retail & Wholesale', 'Electronics & Tech', 'Food & Beverage', 'Health & Wellness',
  'Fashion & Apparel', 'Real Estate', 'Professional Services', 'Transportation & Logistics',
  'Education & Training', 'Manufacturing', 'Agriculture', 'Financial Services',
  'Media & Entertainment', 'Hospitality & Tourism', 'Other'
];

const INDUSTRY_LIST = [
  'Electronics', 'Mobile Accessories', 'Computers & Peripherals', 'Consumer Goods',
  'Telecommunications', 'Retail Trade', 'E-commerce', 'Wholesale Distribution',
  'Software & SaaS', 'Consulting', 'Healthcare', 'Fintech', 'Other'
];

const PERMISSION_OPTIONS = [
  { id: 'dashboard', label: 'Dashboard', icon: 'fa-chart-pie' },
  { id: 'inventory', label: 'Inventory', icon: 'fa-boxes-stacked' },
  { id: 'analytics', label: 'Analytics', icon: 'fa-square-poll-vertical' },
  { id: 'transactions', label: 'Ledger', icon: 'fa-receipt' },
  { id: 'agent', label: 'Axis Agent', icon: 'fa-brain' },
  { id: 'business', label: 'My Business', icon: 'fa-building' },
  { id: 'settings', label: 'Settings', icon: 'fa-sliders' },
];

export const MyBusinessPage: React.FC<MyBusinessPageProps> = ({ currency = 'USD', user }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'branches' | 'team' | 'roles'>('overview');
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [roles, setRoles] = useState<BusinessRole[]>([]);
  const [team, setTeam] = useState<SubUser[]>([]);
  const [branchPerformances, setBranchPerformances] = useState<Record<string, BranchPerformance>>({});
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [selectedBranchDetails, setSelectedBranchDetails] = useState<any | null>(null);
  const [branchDetailsLoading, setBranchDetailsLoading] = useState(false);
  const [branchDetailSubTab, setBranchDetailSubTab] = useState<'overview' | 'ledger' | 'inventory'>('overview');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Branch modal
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [branchForm, setBranchForm] = useState({ name: '', location: '', phone: '', email: '', manager_user_id: '', is_active: true });

  // Role modal
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [editingRole, setEditingRole] = useState<BusinessRole | null>(null);
  const [roleForm, setRoleForm] = useState({ role_name: '', permissions: [] as string[], description: '', branch_id: '' });

  // Team member modal
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [teamForm, setTeamForm] = useState({ name: '', email: '', role_id: '', branch_id: '' });
  const [teamSaving, setTeamSaving] = useState(false);

  const showStatus = (text: string, type: 'success' | 'error' = 'success') => {
    setStatusMsg({ text, type });
    setTimeout(() => setStatusMsg(null), 4000);
  };

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [profileRes, branchRes, roleRes, teamRes] = await Promise.all([
        getBusinessProfileApi(),
        getBranchesApi(),
        getRolesApi(),
        getTeamApi()
      ]);
      setProfile(profileRes);
      setBranches(Array.isArray(branchRes) ? branchRes : []);
      setRoles(Array.isArray(roleRes) ? roleRes : []);
      setTeam(Array.isArray(teamRes) ? teamRes : []);

      // Load branch performances
      if (Array.isArray(branchRes) && branchRes.length > 0) {
        const perfs: Record<string, BranchPerformance> = {};
        await Promise.all(branchRes.map(async (b: Branch) => {
          try {
            const perf = await getBranchPerformanceApi(b.id);
            perfs[b.id] = perf;
          } catch { /* ignore */ }
        }));
        setBranchPerformances(perfs);
      }
    } catch (e) {
      console.log('Business data load:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Load detailed branch data when a branch is selected
  useEffect(() => {
    if (selectedBranch) {
      setBranchDetailsLoading(true);
      getBranchDetailsApi(selectedBranch)
        .then(data => setSelectedBranchDetails(data))
        .catch(err => {
          console.log('Error loading branch details:', err);
          setSelectedBranchDetails(null);
        })
        .finally(() => setBranchDetailsLoading(false));
    } else {
      setSelectedBranchDetails(null);
    }
  }, [selectedBranch]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    try {
      const updated = await updateBusinessProfileApi(profile);
      setProfile(updated);
      showStatus('Business profile saved successfully!');
    } catch (err: any) {
      showStatus(err.message || 'Failed to save business profile', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBranch = async () => {
    try {
      if (editingBranch) {
        const updated = await updateBranchApi(editingBranch.id, branchForm);
        setBranches(prev => prev.map(b => b.id === editingBranch.id ? updated : b));
        showStatus('Branch updated successfully!');
      } else {
        const created = await createBranchApi(branchForm);
        setBranches(prev => [...prev, created]);
        showStatus('Branch created successfully!');
      }
      setShowBranchModal(false);
      setEditingBranch(null);
      setBranchForm({ name: '', location: '', phone: '', email: '', manager_user_id: '', is_active: true });
      if (selectedBranch) {
        getBranchDetailsApi(selectedBranch).then(setSelectedBranchDetails).catch(() => {});
      }
    } catch (err: any) {
      showStatus(err.message || 'Failed to save branch', 'error');
    }
  };

  const handleDeleteBranch = async (branchId: string) => {
    if (!confirm('Delete this branch? This action cannot be undone.')) return;
    try {
      await deleteBranchApi(branchId);
      setBranches(prev => prev.filter(b => b.id !== branchId));
      if (selectedBranch === branchId) {
        setSelectedBranch(null);
        setSelectedBranchDetails(null);
      }
      showStatus('Branch deleted.');
    } catch (err: any) {
      showStatus(err.message || 'Failed to delete branch', 'error');
    }
  };

  const handleSaveTeamMember = async () => {
    if (!teamForm.name || !teamForm.email || !teamForm.role_id) {
      showStatus('Please fill in Name, Email, and Role', 'error');
      return;
    }
    setTeamSaving(true);
    try {
      const created = await (await import('../utils/api')).createSubUserApi(teamForm);
      setTeam(prev => [...prev, created]);
      showStatus(`Team member ${teamForm.name} added! Their temporary password is their email address.`);
      setShowTeamModal(false);
      setTeamForm({ name: '', email: '', role_id: '', branch_id: '' });
    } catch (err: any) {
      showStatus(err.message || 'Failed to add team member', 'error');
    } finally {
      setTeamSaving(false);
    }
  };

  const handleSaveRole = async () => {
    if (!roleForm.role_name || roleForm.permissions.length === 0) {
      showStatus('Role name and at least one permission required', 'error');
      return;
    }
    try {
      if (editingRole) {
        const updated = await updateRoleApi(editingRole.id, roleForm);
        setRoles(prev => prev.map(r => r.id === editingRole.id ? updated : r));
        showStatus('Role updated successfully!');
      } else {
        const created = await createRoleApi(roleForm);
        setRoles(prev => [...prev, created]);
        showStatus('Custom role created!');
      }
      setShowRoleModal(false);
      setEditingRole(null);
      setRoleForm({ role_name: '', permissions: [], description: '', branch_id: '' });
    } catch (err: any) {
      showStatus(err.message || 'Failed to save role', 'error');
    }
  };

  const openCreateRole = () => {
    setEditingRole(null);
    setRoleForm({ role_name: '', permissions: ['dashboard', 'inventory', 'transactions'], description: '', branch_id: '' });
    setShowRoleModal(true);
  };

  const openEditRole = (role: BusinessRole) => {
    setEditingRole(role);
    setRoleForm({
      role_name: role.role_name,
      permissions: role.permissions || [],
      description: role.description || '',
      branch_id: role.branch_id || ''
    });
    setShowRoleModal(true);
  };

  const togglePermission = (permId: string) => {
    setRoleForm(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permId)
        ? prev.permissions.filter(p => p !== permId)
        : [...prev.permissions, permId]
    }));
  };

  const openEditBranch = (branch: Branch) => {
    setEditingBranch(branch);
    setBranchForm({
      name: branch.name,
      location: branch.location || '',
      phone: branch.phone || '',
      email: branch.email || '',
      manager_user_id: branch.manager_user_id || '',
      is_active: branch.is_active
    });
    setShowBranchModal(true);
  };

  // Helper to determine who manages a branch
  const getBranchManagerInfo = (managerUserId?: string) => {
    if (!managerUserId) return null;
    const isOwner = managerUserId === user?.user_id || managerUserId === user?.id || managerUserId === 'owner';
    if (isOwner) {
      return { name: user?.name || 'Owner', isOwner: true, email: user?.email };
    }
    const found = team.find(u => u.id === managerUserId);
    if (found) {
      return { name: found.name, isOwner: false, email: found.email };
    }
    return null;
  };

  const selectedBranchData = branches.find(b => b.id === selectedBranch);
  const selectedBranchPerf = selectedBranchDetails?.performance || (selectedBranch ? branchPerformances[selectedBranch] : null);

  // Filter out system static roles to eliminate confusion
  const displayRoles = roles.filter(r => r.id !== 'role-owner' && r.id !== 'role-manager');

  const tabStyle = (tab: string) => ({
    padding: '10px 20px',
    borderRadius: '10px',
    border: 'none',
    cursor: 'pointer',
    fontFamily: 'Plus Jakarta Sans',
    fontWeight: 600,
    fontSize: '0.85rem',
    transition: 'all 0.2s ease',
    background: activeTab === tab ? 'rgba(0, 212, 255, 0.15)' : 'transparent',
    color: activeTab === tab ? '#00d4ff' : '#9ca3af',
    borderBottom: activeTab === tab ? '2px solid #00d4ff' : '2px solid transparent',
  });

  if (loading) {
    return (
      <div className="tab-view active" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
        <div style={{ textAlign: 'center', color: '#9ca3af' }}>
          <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '2rem', color: '#00d4ff', marginBottom: '16px', display: 'block' }}></i>
          Loading business data...
        </div>
      </div>
    );
  }

  return (
    <div className="tab-view active">
      {/* Header */}
      <div className="view-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{
            width: '52px', height: '52px', borderRadius: '14px',
            background: profile?.logo_url ? 'transparent' : 'linear-gradient(135deg, rgba(0, 212, 255, 0.2), rgba(124, 95, 230, 0.2))',
            border: '1.5px solid rgba(0, 212, 255, 0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#00d4ff', fontSize: '1.4rem', flexShrink: 0
          }}>
            {profile?.logo_url ? (
              <img src={profile.logo_url} alt="Business Logo" style={{ width: '100%', height: '100%', borderRadius: '14px', objectFit: 'cover' }} />
            ) : (
              <i className="fa-solid fa-building"></i>
            )}
          </div>
          <div>
            <h2 style={{ margin: 0 }}>{profile?.business_name || 'My Business'}</h2>
            <p className="subtitle" style={{ margin: 0 }}>
              {profile?.business_category || 'Business Intelligence Hub'} &nbsp;·&nbsp;
              {branches.length} Branch{branches.length !== 1 ? 'es' : ''} &nbsp;·&nbsp;
              {team.length} Team Member{team.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </div>

      {/* Status message */}
      {statusMsg && (
        <div style={{
          padding: '12px 16px', borderRadius: '10px', marginBottom: '20px',
          background: statusMsg.type === 'success' ? 'rgba(74, 222, 128, 0.1)' : 'rgba(255, 142, 142, 0.1)',
          border: `1px solid ${statusMsg.type === 'success' ? 'rgba(74, 222, 128, 0.35)' : 'rgba(255, 142, 142, 0.35)'}`,
          color: statusMsg.type === 'success' ? '#4ade80' : '#ff8e8e',
          fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '10px'
        }}>
          <i className={`fa-solid ${statusMsg.type === 'success' ? 'fa-circle-check' : 'fa-triangle-exclamation'}`}></i>
          {statusMsg.text}
        </div>
      )}

      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '28px', borderBottom: '1px solid rgba(255,255,255,0.08)', flexWrap: 'wrap' }}>
        {[
          { id: 'overview', label: 'Business Profile', icon: 'fa-building' },
          { id: 'branches', label: 'Branches & Operations', icon: 'fa-code-branch' },
          { id: 'team', label: 'Team & Access', icon: 'fa-users' },
          { id: 'roles', label: 'Roles & Privileges', icon: 'fa-user-shield' },
        ].map(tab => (
          <button key={tab.id} style={tabStyle(tab.id)} onClick={() => setActiveTab(tab.id as any)}>
            <i className={`fa-solid ${tab.icon}`} style={{ marginRight: '6px' }}></i>
            {tab.label}
          </button>
        ))}
      </div>

      {/* OVERVIEW TAB */}
      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
          {/* Business Profile Form */}
          <div className="glass-card" style={{ padding: '28px', gridColumn: 'span 2' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
              <i className="fa-solid fa-pen-to-square" style={{ color: '#00d4ff' }}></i>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Business Profile Configuration</h3>
            </div>
            <form onSubmit={handleSaveProfile}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                {[
                  { label: 'Business Name', key: 'business_name', placeholder: 'e.g. REINOSERVICES' },
                  { label: 'Phone', key: 'phone', placeholder: '+254 700 000 000' },
                  { label: 'Business Email', key: 'email', placeholder: 'info@reinoservices.com' },
                  { label: 'Website', key: 'website', placeholder: 'https://reinoservices.com' },
                  { label: 'Headquarters / Main Location', key: 'location', placeholder: 'Nairobi, Kenya' },
                  { label: 'Founded Year', key: 'founded_year', placeholder: '2022' },
                ].map(({ label, key, placeholder }) => (
                  <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.78rem', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</label>
                    <input
                      type={key === 'founded_year' ? 'number' : 'text'}
                      placeholder={placeholder}
                      value={(profile as any)?.[key] || ''}
                      onChange={e => setProfile(prev => ({ ...prev!, [key]: e.target.value }))}
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '10px 14px', color: '#fff', fontSize: '0.88rem', outline: 'none' }}
                    />
                  </div>
                ))}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.78rem', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Business Category</label>
                  <select
                    value={profile?.business_category || ''}
                    onChange={e => setProfile(prev => ({ ...prev!, business_category: e.target.value }))}
                    style={{ background: '#1a1a22', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '10px 14px', color: '#fff', fontSize: '0.88rem' }}
                  >
                    <option value="">Select category...</option>
                    {BUSINESS_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.78rem', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Industry</label>
                  <select
                    value={profile?.industry || ''}
                    onChange={e => setProfile(prev => ({ ...prev!, industry: e.target.value }))}
                    style={{ background: '#1a1a22', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '10px 14px', color: '#fff', fontSize: '0.88rem' }}
                  >
                    <option value="">Select industry...</option>
                    {INDUSTRY_LIST.map(i => <option key={i} value={i}>{i}</option>)}
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.78rem', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>No. of Employees</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="2"
                    value={profile?.number_of_employees || ''}
                    onChange={e => setProfile(prev => ({ ...prev!, number_of_employees: parseInt(e.target.value) }))}
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '10px 14px', color: '#fff', fontSize: '0.88rem', outline: 'none' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', gridColumn: 'span 2' }}>
                  <label style={{ fontSize: '0.78rem', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Business Description</label>
                  <textarea
                    placeholder="Brief description of products, services, and business model..."
                    rows={3}
                    value={profile?.description || ''}
                    onChange={e => setProfile(prev => ({ ...prev!, description: e.target.value }))}
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '10px 14px', color: '#fff', fontSize: '0.88rem', outline: 'none', resize: 'vertical', fontFamily: 'inherit' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button type="submit" disabled={saving} className="action-btn-primary" style={{ gap: '8px' }}>
                  {saving ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-floppy-disk"></i>}
                  {saving ? 'Saving...' : 'Save Business Profile'}
                </button>
              </div>
            </form>
          </div>

          {/* Quick Stats Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '16px' }}>
            {[
              { label: 'Active Branches', value: branches.length, icon: 'fa-code-branch', color: '#00d4ff' },
              { label: 'Team Members', value: team.length, icon: 'fa-users', color: '#a78bfa' },
              { label: 'Configured Roles', value: displayRoles.length, icon: 'fa-user-shield', color: '#4ade80' },
              { label: 'Employees', value: profile?.number_of_employees || 0, icon: 'fa-person', color: '#f59e0b' },
            ].map(({ label, value, icon, color }) => (
              <div key={label} className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: `${color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', color }}>
                  <i className={`fa-solid ${icon}`}></i>
                </div>
                <div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff', fontFamily: 'Plus Jakarta Sans' }}>{value}</div>
                  <div style={{ fontSize: '0.78rem', color: '#9ca3af' }}>{label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* BRANCHES TAB */}
      {activeTab === 'branches' && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: selectedBranch ? 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))' : '1fr',
          gap: '24px',
          alignItems: 'start'
        }}>
          {/* Branch List */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>
                  <i className="fa-solid fa-code-branch" style={{ color: '#00d4ff', marginRight: '10px' }}></i>
                  Branches ({branches.length})
                </h3>
                <span style={{ fontSize: '0.78rem', color: '#9ca3af' }}>
                  Click on any branch to monitor its ledger, inventory, manager, and performance
                </span>
              </div>
              <button
                className="action-btn-primary"
                style={{ gap: '8px', fontSize: '0.82rem', padding: '8px 16px' }}
                onClick={() => { setEditingBranch(null); setBranchForm({ name: '', location: '', phone: '', email: '', manager_user_id: user?.user_id || 'owner', is_active: true }); setShowBranchModal(true); }}
              >
                <i className="fa-solid fa-plus"></i> Add Branch
              </button>
            </div>

            {branches.length === 0 ? (
              <div className="glass-card" style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>
                <i className="fa-solid fa-building-circle-xmark" style={{ fontSize: '2.5rem', marginBottom: '16px', display: 'block', opacity: 0.4 }}></i>
                <div style={{ fontWeight: 600 }}>No branches configured</div>
                <div style={{ fontSize: '0.85rem', marginTop: '6px' }}>Add your primary store or branch to start recording transactions and inventory.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {branches.map(branch => {
                  const perf = branchPerformances[branch.id];
                  const mgrInfo = getBranchManagerInfo(branch.manager_user_id);
                  const isSelected = selectedBranch === branch.id;

                  return (
                    <div
                      key={branch.id}
                      className="glass-card"
                      style={{
                        padding: '18px 20px', cursor: 'pointer', transition: 'all 0.2s ease',
                        border: isSelected ? '1.5px solid rgba(0, 212, 255, 0.6)' : '1px solid rgba(255,255,255,0.08)',
                        background: isSelected ? 'rgba(0, 212, 255, 0.08)' : undefined,
                        boxShadow: isSelected ? '0 0 20px rgba(0, 212, 255, 0.15)' : undefined
                      }}
                      onClick={() => setSelectedBranch(isSelected ? null : branch.id)}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                        <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                          <div style={{
                            width: '44px', height: '44px', borderRadius: '12px', flexShrink: 0,
                            background: isSelected ? 'rgba(0, 212, 255, 0.25)' : 'rgba(255,255,255,0.06)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: isSelected ? '#00d4ff' : '#9ca3af', fontSize: '1.2rem'
                          }}>
                            <i className="fa-solid fa-store"></i>
                          </div>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <span style={{ fontWeight: 700, fontSize: '0.98rem', color: '#fff' }}>{branch.name}</span>
                              {branch.is_main && (
                                <span style={{
                                  fontSize: '0.65rem', padding: '2px 8px', borderRadius: '20px',
                                  background: 'rgba(0, 212, 255, 0.15)', color: '#00d4ff',
                                  border: '1px solid rgba(0, 212, 255, 0.3)', fontWeight: 700
                                }}>
                                  MAIN / HQ
                                </span>
                              )}
                              <span style={{
                                fontSize: '0.65rem', padding: '2px 8px', borderRadius: '20px',
                                background: branch.is_active ? 'rgba(74, 222, 128, 0.15)' : 'rgba(255, 142, 142, 0.15)',
                                color: branch.is_active ? '#4ade80' : '#ff8e8e',
                                border: `1px solid ${branch.is_active ? 'rgba(74, 222, 128, 0.3)' : 'rgba(255, 142, 142, 0.3)'}`
                              }}>
                                {branch.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </div>

                            {branch.location && (
                              <div style={{ fontSize: '0.78rem', color: '#9ca3af', marginTop: '3px' }}>
                                <i className="fa-solid fa-location-dot" style={{ marginRight: '5px' }}></i>{branch.location}
                              </div>
                            )}

                            {mgrInfo && (
                              <div style={{ fontSize: '0.78rem', color: mgrInfo.isOwner ? '#00d4ff' : '#a78bfa', marginTop: '3px' }}>
                                <i className={`fa-solid ${mgrInfo.isOwner ? 'fa-crown' : 'fa-user-tie'}`} style={{ marginRight: '5px', color: mgrInfo.isOwner ? '#f59e0b' : '#a78bfa' }}></i>
                                Managed by {mgrInfo.name} {mgrInfo.isOwner ? '(Owner)' : ''}
                              </div>
                            )}

                            {perf && (
                              <div style={{ display: 'flex', gap: '14px', marginTop: '10px', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '0.78rem', color: '#4ade80', fontWeight: 600 }}>
                                  <i className="fa-solid fa-arrow-trend-up" style={{ marginRight: '4px' }}></i>{formatCurrency(perf.total_revenue, currency)} rev
                                </span>
                                <span style={{ fontSize: '0.78rem', color: '#f87171', fontWeight: 600 }}>
                                  <i className="fa-solid fa-arrow-trend-down" style={{ marginRight: '4px' }}></i>{formatCurrency(perf.total_expenses, currency)} exp
                                </span>
                                <span style={{ fontSize: '0.78rem', color: '#00d4ff', fontWeight: 600 }}>
                                  <i className="fa-solid fa-percent" style={{ marginRight: '4px' }}></i>{perf.gross_margin_percent}% margin
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            onClick={e => { e.stopPropagation(); openEditBranch(branch); }}
                            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#9ca3af', cursor: 'pointer', borderRadius: '8px', padding: '6px 10px', fontSize: '0.78rem' }}
                            title="Edit Branch"
                          >
                            <i className="fa-solid fa-pen"></i>
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); handleDeleteBranch(branch.id); }}
                            style={{ background: 'rgba(255, 142, 142, 0.08)', border: '1px solid rgba(255, 142, 142, 0.2)', color: '#ff8e8e', cursor: 'pointer', borderRadius: '8px', padding: '6px 10px', fontSize: '0.78rem' }}
                            title="Delete Branch"
                          >
                            <i className="fa-solid fa-trash-can"></i>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Detailed Branch View (Full details: Ledger, Inventory, Manager, Financials) */}
          {selectedBranch && selectedBranchData && (
            <div className="glass-card" style={{ padding: '24px', borderRadius: '16px', border: '1px solid rgba(0, 212, 255, 0.3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#fff', fontFamily: 'Plus Jakarta Sans' }}>
                      {selectedBranchData.name}
                    </h3>
                    {selectedBranchData.is_main && (
                      <span style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: '20px', background: 'rgba(0, 212, 255, 0.15)', color: '#00d4ff', border: '1px solid rgba(0, 212, 255, 0.3)', fontWeight: 700 }}>
                        HQ
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: '0.78rem', color: '#9ca3af' }}>
                    {selectedBranchData.location || 'Branch Operations Center'}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    onClick={() => openEditBranch(selectedBranchData)}
                    className="action-btn-secondary"
                    style={{ fontSize: '0.78rem', padding: '6px 12px' }}
                  >
                    <i className="fa-solid fa-pen"></i> Edit
                  </button>
                  <button
                    onClick={() => setSelectedBranch(null)}
                    style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: '1.2rem', padding: '4px 8px' }}
                    title="Close Details"
                  >
                    <i className="fa-solid fa-times"></i>
                  </button>
                </div>
              </div>

              {/* Sub-tabs inside Branch Detail */}
              <div style={{ display: 'flex', gap: '6px', marginBottom: '18px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                {[
                  { id: 'overview', label: 'Financial Performance', icon: 'fa-chart-pie' },
                  { id: 'ledger', label: 'Branch Ledger', icon: 'fa-receipt' },
                  { id: 'inventory', label: 'Branch Inventory', icon: 'fa-boxes-stacked' },
                ].map(st => (
                  <button
                    key={st.id}
                    onClick={() => setBranchDetailSubTab(st.id as any)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      borderBottom: branchDetailSubTab === st.id ? '2px solid #00d4ff' : '2px solid transparent',
                      color: branchDetailSubTab === st.id ? '#00d4ff' : '#9ca3af',
                      fontWeight: 600,
                      fontSize: '0.8rem',
                      padding: '8px 12px',
                      cursor: 'pointer'
                    }}
                  >
                    <i className={`fa-solid ${st.icon}`} style={{ marginRight: '6px' }}></i>
                    {st.label}
                  </button>
                ))}
              </div>

              {branchDetailsLoading ? (
                <div style={{ textAlign: 'center', padding: '30px', color: '#9ca3af' }}>
                  <i className="fa-solid fa-spinner fa-spin" style={{ color: '#00d4ff', fontSize: '1.5rem', marginBottom: '10px', display: 'block' }}></i>
                  Loading branch details...
                </div>
              ) : (
                <>
                  {/* OVERVIEW SUB-TAB */}
                  {branchDetailSubTab === 'overview' && (
                    <div>
                      {selectedBranchPerf ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px', marginBottom: '20px' }}>
                          {[
                            { label: 'Total Revenue', value: formatCurrency(selectedBranchPerf.total_revenue, currency), icon: 'fa-arrow-trend-up', color: '#4ade80' },
                            { label: 'Total Expenses', value: formatCurrency(selectedBranchPerf.total_expenses, currency), icon: 'fa-arrow-trend-down', color: '#f87171' },
                            { label: 'Net Cash', value: formatCurrency(selectedBranchPerf.net_cash, currency), icon: 'fa-coins', color: selectedBranchPerf.net_cash >= 0 ? '#00d4ff' : '#f59e0b' },
                            { label: 'Gross Margin', value: `${selectedBranchPerf.gross_margin_percent}%`, icon: 'fa-percent', color: '#a78bfa' },
                            { label: 'Transactions', value: selectedBranchPerf.transaction_count?.toString() || '0', icon: 'fa-receipt', color: '#f59e0b' },
                            { label: 'Stock SKUs', value: selectedBranchPerf.inventory_count?.toString() || '0', icon: 'fa-boxes-stacked', color: '#3cd7ff' },
                          ].map(({ label, value, icon, color }) => (
                            <div key={label} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '12px', padding: '14px', border: '1px solid rgba(255,255,255,0.06)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                                <i className={`fa-solid ${icon}`} style={{ color, fontSize: '0.82rem' }}></i>
                                <span style={{ fontSize: '0.68rem', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase' }}>{label}</span>
                              </div>
                              <div style={{ fontSize: '1.05rem', fontWeight: 800, color, fontFamily: 'Plus Jakarta Sans' }}>{value}</div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ textAlign: 'center', color: '#9ca3af', padding: '16px' }}>
                          No financial transactions recorded for this branch yet.
                        </div>
                      )}

                      {/* Manager and Branch Info */}
                      <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '16px', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Branch Information & Management
                        </div>

                        {/* Manager Card */}
                        {(() => {
                          const mgr = getBranchManagerInfo(selectedBranchData.manager_user_id);
                          return mgr ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', borderRadius: '10px', background: mgr.isOwner ? 'rgba(0, 212, 255, 0.08)' : 'rgba(167, 139, 250, 0.08)', border: `1px solid ${mgr.isOwner ? 'rgba(0, 212, 255, 0.25)' : 'rgba(167, 139, 250, 0.25)'}`, marginBottom: '12px' }}>
                              <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: mgr.isOwner ? 'linear-gradient(135deg, #00d4ff, #7c5fe6)' : 'rgba(167, 139, 250, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '0.85rem' }}>
                                {mgr.name.charAt(0).toUpperCase()}
                              </div>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  {mgr.name}
                                  {mgr.isOwner && <span style={{ fontSize: '0.62rem', background: '#00d4ff20', color: '#00d4ff', padding: '1px 6px', borderRadius: '10px', border: '1px solid #00d4ff40' }}>Owner Assigned</span>}
                                </div>
                                <div style={{ fontSize: '0.72rem', color: '#9ca3af' }}>{mgr.email}</div>
                              </div>
                            </div>
                          ) : (
                            <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginBottom: '12px' }}>
                              <i className="fa-solid fa-user-xmark" style={{ marginRight: '6px' }}></i> No manager currently assigned to this branch.
                            </div>
                          );
                        })()}

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.82rem' }}>
                          {selectedBranchData.location && (
                            <div style={{ color: '#e5e2e1' }}>
                              <i className="fa-solid fa-location-dot" style={{ color: '#00d4ff', marginRight: '8px', width: '14px' }}></i>
                              {selectedBranchData.location}
                            </div>
                          )}
                          {selectedBranchData.phone && (
                            <div style={{ color: '#e5e2e1' }}>
                              <i className="fa-solid fa-phone" style={{ color: '#a78bfa', marginRight: '8px', width: '14px' }}></i>
                              {selectedBranchData.phone}
                            </div>
                          )}
                          {selectedBranchData.email && (
                            <div style={{ color: '#e5e2e1' }}>
                              <i className="fa-solid fa-envelope" style={{ color: '#4ade80', marginRight: '8px', width: '14px' }}></i>
                              {selectedBranchData.email}
                            </div>
                          )}
                          {selectedBranchData.created_at && (
                            <div style={{ color: '#9ca3af', fontSize: '0.75rem', marginTop: '6px' }}>
                              Established {formatRelativeTime(selectedBranchData.created_at)}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* BRANCH LEDGER SUB-TAB */}
                  {branchDetailSubTab === 'ledger' && (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <span style={{ fontSize: '0.8rem', color: '#9ca3af', fontWeight: 600 }}>Transactions Tagged to this Branch</span>
                        <span style={{ fontSize: '0.75rem', color: '#00d4ff', fontFamily: 'JetBrains Mono' }}>
                          {selectedBranchDetails?.transactions?.length || 0} Entries
                        </span>
                      </div>

                      {(!selectedBranchDetails?.transactions || selectedBranchDetails.transactions.length === 0) ? (
                        <div style={{ textAlign: 'center', color: '#9ca3af', padding: '30px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px' }}>
                          <i className="fa-solid fa-receipt" style={{ fontSize: '2rem', marginBottom: '10px', display: 'block', opacity: 0.3 }}></i>
                          No transactions recorded for this branch yet.<br />
                          <span style={{ fontSize: '0.78rem' }}>When recording entries in Ledger, choose this branch to monitor cashflow.</span>
                        </div>
                      ) : (
                        <div style={{ maxHeight: '360px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {selectedBranchDetails.transactions.map((t: any, idx: number) => {
                            const isPositive = Number(t.amount) > 0;
                            return (
                              <div key={t.id || idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
                                <div>
                                  <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#fff' }}>{t.counterparty}</div>
                                  <div style={{ fontSize: '0.72rem', color: '#9ca3af' }}>{t.category} · {t.date}</div>
                                </div>
                                <div style={{ fontFamily: 'JetBrains Mono', fontWeight: 700, fontSize: '0.9rem', color: isPositive ? '#4ade80' : '#f87171' }}>
                                  {isPositive ? '+' : ''}{formatCurrency(t.amount, currency)}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* BRANCH INVENTORY SUB-TAB */}
                  {branchDetailSubTab === 'inventory' && (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <span style={{ fontSize: '0.8rem', color: '#9ca3af', fontWeight: 600 }}>Stock Assigned to this Branch</span>
                        <span style={{ fontSize: '0.75rem', color: '#3cd7ff', fontFamily: 'JetBrains Mono' }}>
                          {selectedBranchDetails?.inventory?.length || 0} SKUs
                        </span>
                      </div>

                      {(!selectedBranchDetails?.inventory || selectedBranchDetails.inventory.length === 0) ? (
                        <div style={{ textAlign: 'center', color: '#9ca3af', padding: '30px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px' }}>
                          <i className="fa-solid fa-boxes-stacked" style={{ fontSize: '2rem', marginBottom: '10px', display: 'block', opacity: 0.3 }}></i>
                          No inventory items stocked at this branch yet.<br />
                          <span style={{ fontSize: '0.78rem' }}>In the Inventory page, assign items to this branch when creating or importing items.</span>
                        </div>
                      ) : (
                        <div style={{ maxHeight: '360px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {selectedBranchDetails.inventory.map((item: any, idx: number) => {
                            const isLowStock = Number(item.stock_quantity || 0) <= Number(item.reorder_point || 10);
                            return (
                              <div key={item.sku || item.id || idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
                                <div>
                                  <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#fff' }}>{item.name}</div>
                                  <div style={{ fontSize: '0.72rem', color: '#9ca3af' }}>{item.category} · SKU: {item.sku}</div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                  <div style={{ fontFamily: 'JetBrains Mono', fontWeight: 700, fontSize: '0.9rem', color: isLowStock ? '#fbbf24' : '#4ade80' }}>
                                    {item.stock_quantity} units
                                  </div>
                                  <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>
                                    {formatCurrency(item.selling_price || 0, currency)}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* TEAM TAB */}
      {activeTab === 'team' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>
                <i className="fa-solid fa-users" style={{ color: '#a78bfa', marginRight: '10px' }}></i>
                Team Members & Access ({team.length})
              </h3>
              <span style={{ fontSize: '0.78rem', color: '#9ca3af' }}>
                Add managers and staff. They login with their email as temporary password.
              </span>
            </div>
            <button
              className="action-btn-primary"
              style={{ gap: '8px', fontSize: '0.82rem', padding: '8px 16px' }}
              onClick={() => setShowTeamModal(true)}
            >
              <i className="fa-solid fa-user-plus"></i> Add Team Member
            </button>
          </div>

          {/* Owner card */}
          <div className="glass-card" style={{ padding: '18px 20px', marginBottom: '12px', border: '1px solid rgba(0, 212, 255, 0.35)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: 'linear-gradient(135deg, #00d4ff, #7c5fe6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1rem', color: '#fff', flexShrink: 0 }}>
                {(user?.name || 'O').charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.94rem' }}>{user?.name || 'Account Owner'}</div>
                <div style={{ fontSize: '0.78rem', color: '#9ca3af' }}>{user?.email}</div>
              </div>
              <span style={{ fontSize: '0.72rem', padding: '4px 12px', borderRadius: '20px', background: 'rgba(0, 212, 255, 0.15)', color: '#00d4ff', border: '1px solid rgba(0, 212, 255, 0.35)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <i className="fa-solid fa-crown" style={{ color: '#f59e0b', fontSize: '0.75rem' }}></i> BUSINESS OWNER
              </span>
            </div>
          </div>

          {team.length === 0 ? (
            <div className="glass-card" style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>
              <i className="fa-solid fa-user-slash" style={{ fontSize: '2.5rem', marginBottom: '16px', display: 'block', opacity: 0.4 }}></i>
              <div style={{ fontWeight: 600 }}>No sub-users added yet</div>
              <div style={{ fontSize: '0.85rem', marginTop: '6px' }}>Add managers and staff to assign them roles and branches.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {team.map(member => {
                const memberRole = roles.find(r => r.id === member.role_id);
                const memberBranch = branches.find(b => b.id === member.branch_id);
                return (
                  <div key={member.id} className="glass-card" style={{ padding: '16px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(167, 139, 250, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.95rem', color: '#a78bfa', flexShrink: 0 }}>
                        {member.name.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 700, color: '#fff', fontSize: '0.9rem' }}>{member.name}</span>
                          {!member.is_active && <span style={{ fontSize: '0.65rem', background: 'rgba(255, 142, 142, 0.15)', color: '#ff8e8e', borderRadius: '20px', padding: '2px 8px', border: '1px solid rgba(255, 142, 142, 0.3)' }}>Inactive</span>}
                          {member.must_change_password && <span style={{ fontSize: '0.65rem', background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', borderRadius: '20px', padding: '2px 8px', border: '1px solid rgba(245, 158, 11, 0.3)' }}>Password Change Pending</span>}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#9ca3af', marginTop: '2px' }}>{member.email}</div>
                        <div style={{ display: 'flex', gap: '10px', marginTop: '6px', flexWrap: 'wrap' }}>
                          {memberRole && <span style={{ fontSize: '0.72rem', color: '#a78bfa', background: 'rgba(167, 139, 250, 0.12)', borderRadius: '6px', padding: '2px 8px' }}><i className="fa-solid fa-user-shield" style={{ marginRight: '4px' }}></i>{memberRole.role_name}</span>}
                          {memberBranch && <span style={{ fontSize: '0.72rem', color: '#00d4ff', background: 'rgba(0, 212, 255, 0.12)', borderRadius: '6px', padding: '2px 8px' }}><i className="fa-solid fa-store" style={{ marginRight: '4px' }}></i>{memberBranch.name}</span>}
                        </div>
                      </div>
                      <button
                        onClick={async () => {
                          if (!confirm(`Remove ${member.name} from the team?`)) return;
                          try {
                            await (await import('../utils/api')).deleteSubUserApi(member.id);
                            setTeam(prev => prev.filter(u => u.id !== member.id));
                            showStatus(`${member.name} removed from team.`);
                          } catch (e: any) { showStatus(e.message, 'error'); }
                        }}
                        style={{ background: 'rgba(255, 142, 142, 0.08)', border: '1px solid rgba(255, 142, 142, 0.2)', color: '#ff8e8e', cursor: 'pointer', borderRadius: '8px', padding: '6px 10px', fontSize: '0.78rem' }}
                      >
                        <i className="fa-solid fa-trash-can"></i>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ROLES TAB */}
      {activeTab === 'roles' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>
                <i className="fa-solid fa-user-shield" style={{ color: '#4ade80', marginRight: '10px' }}></i>
                Custom Roles & Privileges ({displayRoles.length})
              </h3>
              <span style={{ fontSize: '0.78rem', color: '#9ca3af' }}>
                Create, customize, and edit roles with scoped access permissions for your staff
              </span>
            </div>
            <button
              className="action-btn-primary"
              style={{ gap: '8px', fontSize: '0.82rem', padding: '8px 16px' }}
              onClick={openCreateRole}
            >
              <i className="fa-solid fa-plus"></i> Create Role
            </button>
          </div>

          {displayRoles.length === 0 ? (
            <div className="glass-card" style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>
              <i className="fa-solid fa-shield-halved" style={{ fontSize: '2.5rem', marginBottom: '16px', display: 'block', opacity: 0.4 }}></i>
              <div style={{ fontWeight: 600 }}>No custom roles created</div>
              <div style={{ fontSize: '0.85rem', marginTop: '6px' }}>Click "Create Role" above to set up specific privileges for managers and staff.</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
              {displayRoles.map(role => (
                <div key={role.id} className="glass-card" style={{ padding: '20px', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '1rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <i className="fa-solid fa-user-shield" style={{ color: '#4ade80' }}></i>
                        {role.role_name}
                      </div>
                      {role.description && <div style={{ fontSize: '0.78rem', color: '#9ca3af', marginTop: '4px' }}>{role.description}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        onClick={() => openEditRole(role)}
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#9ca3af', cursor: 'pointer', borderRadius: '8px', padding: '6px 10px', fontSize: '0.78rem' }}
                        title="Edit Role"
                      >
                        <i className="fa-solid fa-pen"></i>
                      </button>
                      <button
                        onClick={async () => {
                          if (!confirm(`Delete role "${role.role_name}"?`)) return;
                          try {
                            await deleteRoleApi(role.id);
                            setRoles(prev => prev.filter(r => r.id !== role.id));
                            showStatus('Role deleted.');
                          } catch (e: any) { showStatus(e.message, 'error'); }
                        }}
                        style={{ background: 'rgba(255, 142, 142, 0.08)', border: '1px solid rgba(255, 142, 142, 0.2)', color: '#ff8e8e', cursor: 'pointer', borderRadius: '8px', padding: '6px 10px', fontSize: '0.78rem' }}
                        title="Delete Role"
                      >
                        <i className="fa-solid fa-trash-can"></i>
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {PERMISSION_OPTIONS.map(perm => {
                      const hasIt = role.permissions.includes(perm.id);
                      return (
                        <span key={perm.id} style={{
                          fontSize: '0.68rem', padding: '3px 10px', borderRadius: '20px',
                          background: hasIt ? 'rgba(74, 222, 128, 0.12)' : 'rgba(255,255,255,0.04)',
                          color: hasIt ? '#4ade80' : 'rgba(255,255,255,0.25)',
                          border: `1px solid ${hasIt ? 'rgba(74, 222, 128, 0.3)' : 'rgba(255,255,255,0.08)'}`,
                          display: 'flex', alignItems: 'center', gap: '4px'
                        }}>
                          <i className={`fa-solid ${perm.icon}`} style={{ fontSize: '0.6rem' }}></i>
                          {perm.label}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* BRANCH MODAL */}
      {showBranchModal && (
        <div className="modal-overlay active">
          <div className="modal-card glass-card" style={{ width: '520px', maxHeight: '88vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{editingBranch ? 'Edit Branch' : 'Add New Branch'}</h3>
              <button className="modal-close" onClick={() => { setShowBranchModal(false); setEditingBranch(null); }}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '16px 0' }}>
              {[
                { label: 'Branch Name *', key: 'name', placeholder: 'e.g. Westlands Branch / CBD Store' },
                { label: 'Location', key: 'location', placeholder: 'e.g. Westlands Mall, Nairobi' },
                { label: 'Phone', key: 'phone', placeholder: '+254 700 000 000' },
                { label: 'Email', key: 'email', placeholder: 'branch@reinoservices.com' },
              ].map(({ label, key, placeholder }) => (
                <div key={key}>
                  <label style={{ fontSize: '0.78rem', color: '#9ca3af', fontWeight: 600, display: 'block', marginBottom: '6px' }}>{label}</label>
                  <input
                    type="text"
                    placeholder={placeholder}
                    value={(branchForm as any)[key]}
                    onChange={e => setBranchForm(prev => ({ ...prev, [key]: e.target.value }))}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', padding: '10px 14px', color: '#fff', fontSize: '0.88rem', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              ))}

              <div>
                <label style={{ fontSize: '0.78rem', color: '#9ca3af', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                  Assign Branch Manager (Owner or Team Member)
                </label>
                <select
                  value={branchForm.manager_user_id}
                  onChange={e => setBranchForm(prev => ({ ...prev, manager_user_id: e.target.value }))}
                  style={{ width: '100%', background: '#1a1a22', border: '1px solid rgba(0, 212, 255, 0.3)', borderRadius: '10px', padding: '10px 14px', color: '#fff', fontSize: '0.88rem' }}
                >
                  <option value="">No manager assigned</option>
                  <option value={user?.user_id || user?.id || 'owner'} style={{ color: '#00d4ff', fontWeight: 700 }}>
                    {user?.name || 'Account Owner'} (Owner / You)
                  </option>
                  {team.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.email})
                    </option>
                  ))}
                </select>
                <span style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: '4px', display: 'block' }}>
                  The owner can manage the branch directly or assign it to an appointed manager.
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input
                  type="checkbox"
                  id="branch-active"
                  checked={branchForm.is_active}
                  onChange={e => setBranchForm(prev => ({ ...prev, is_active: e.target.checked }))}
                  style={{ accentColor: '#00d4ff' }}
                />
                <label htmlFor="branch-active" style={{ fontSize: '0.85rem', color: '#e5e2e1', cursor: 'pointer' }}>Branch is actively operational</label>
              </div>
            </div>

            <div className="modal-actions">
              <button className="action-btn-secondary" onClick={() => { setShowBranchModal(false); setEditingBranch(null); }}>Cancel</button>
              <button className="action-btn-primary" onClick={handleSaveBranch}>
                <i className="fa-solid fa-floppy-disk" style={{ marginRight: '6px' }}></i>
                {editingBranch ? 'Save Changes' : 'Create Branch'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TEAM MEMBER MODAL */}
      {showTeamModal && (
        <div className="modal-overlay active">
          <div className="modal-card glass-card" style={{ width: '520px', maxHeight: '88vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Add Team Member</h3>
              <button className="modal-close" onClick={() => setShowTeamModal(false)}>×</button>
            </div>

            <div style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: '10px', padding: '12px 14px', marginTop: '16px', fontSize: '0.82rem', color: '#f59e0b' }}>
              <i className="fa-solid fa-circle-info" style={{ marginRight: '8px' }}></i>
              Their <strong>temporary password will be their email address</strong>. They'll be required to change it upon first login.
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '16px 0' }}>
              {[
                { label: 'Full Name *', key: 'name', placeholder: 'Kevin Mwangi', type: 'text' },
                { label: 'Email Address *', key: 'email', placeholder: 'kevin@reinoservices.com', type: 'email' },
              ].map(({ label, key, placeholder, type }) => (
                <div key={key}>
                  <label style={{ fontSize: '0.78rem', color: '#9ca3af', fontWeight: 600, display: 'block', marginBottom: '6px' }}>{label}</label>
                  <input
                    type={type}
                    placeholder={placeholder}
                    value={(teamForm as any)[key]}
                    onChange={e => setTeamForm(prev => ({ ...prev, [key]: e.target.value }))}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', padding: '10px 14px', color: '#fff', fontSize: '0.88rem', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              ))}

              <div>
                <label style={{ fontSize: '0.78rem', color: '#9ca3af', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Role *</label>
                <select
                  value={teamForm.role_id}
                  onChange={e => setTeamForm(prev => ({ ...prev, role_id: e.target.value }))}
                  style={{ width: '100%', background: '#1a1a22', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', padding: '10px 14px', color: '#fff', fontSize: '0.88rem' }}
                >
                  <option value="">Select a role...</option>
                  {displayRoles.map(r => (
                    <option key={r.id} value={r.id}>{r.role_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', color: '#9ca3af', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Assign to Branch</label>
                <select
                  value={teamForm.branch_id}
                  onChange={e => setTeamForm(prev => ({ ...prev, branch_id: e.target.value }))}
                  style={{ width: '100%', background: '#1a1a22', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', padding: '10px 14px', color: '#fff', fontSize: '0.88rem' }}
                >
                  <option value="">All branches / HQ</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name} {b.is_main ? '(HQ)' : ''}</option>)}
                </select>
              </div>
            </div>

            <div className="modal-actions">
              <button className="action-btn-secondary" onClick={() => setShowTeamModal(false)}>Cancel</button>
              <button className="action-btn-primary" disabled={teamSaving} onClick={handleSaveTeamMember}>
                {teamSaving ? <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: '6px' }}></i> : <i className="fa-solid fa-user-plus" style={{ marginRight: '6px' }}></i>}
                {teamSaving ? 'Adding...' : 'Add Team Member'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ROLE MODAL (Create & Edit) */}
      {showRoleModal && (
        <div className="modal-overlay active">
          <div className="modal-card glass-card" style={{ width: '540px', maxHeight: '88vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: '1.1rem' }}>
                {editingRole ? 'Edit Role' : 'Create Custom Role'}
              </h3>
              <button className="modal-close" onClick={() => { setShowRoleModal(false); setEditingRole(null); }}>×</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px 0' }}>
              <div>
                <label style={{ fontSize: '0.78rem', color: '#9ca3af', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Role Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Branch Manager, Cashier, Operations Lead"
                  value={roleForm.role_name}
                  onChange={e => setRoleForm(prev => ({ ...prev, role_name: e.target.value }))}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', padding: '10px 14px', color: '#fff', fontSize: '0.88rem', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.78rem', color: '#9ca3af', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Description</label>
                <input
                  type="text"
                  placeholder="Responsibilities and access scope for this role"
                  value={roleForm.description}
                  onChange={e => setRoleForm(prev => ({ ...prev, description: e.target.value }))}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', padding: '10px 14px', color: '#fff', fontSize: '0.88rem', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', color: '#9ca3af', fontWeight: 600, display: 'block', marginBottom: '10px' }}>
                  Assign Privileges / Page Access *
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
                  {PERMISSION_OPTIONS.map(perm => {
                    const isSelected = roleForm.permissions.includes(perm.id);
                    return (
                      <button
                        key={perm.id}
                        type="button"
                        onClick={() => togglePermission(perm.id)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px',
                          borderRadius: '10px', cursor: 'pointer', transition: 'all 0.2s ease',
                          background: isSelected ? 'rgba(74, 222, 128, 0.12)' : 'rgba(255,255,255,0.04)',
                          border: isSelected ? '1px solid rgba(74, 222, 128, 0.4)' : '1px solid rgba(255,255,255,0.1)',
                          color: isSelected ? '#4ade80' : '#9ca3af', textAlign: 'left'
                        }}
                      >
                        <i className={`fa-solid ${perm.icon}`} style={{ width: '14px', textAlign: 'center' }}></i>
                        <span style={{ fontSize: '0.83rem', fontWeight: 600 }}>{perm.label}</span>
                        {isSelected && <i className="fa-solid fa-check" style={{ marginLeft: 'auto', fontSize: '0.75rem' }}></i>}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="modal-actions">
              <button className="action-btn-secondary" onClick={() => { setShowRoleModal(false); setEditingRole(null); }}>Cancel</button>
              <button className="action-btn-primary" onClick={handleSaveRole}>
                <i className="fa-solid fa-floppy-disk" style={{ marginRight: '6px' }}></i>
                {editingRole ? 'Update Role' : 'Create Role'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
