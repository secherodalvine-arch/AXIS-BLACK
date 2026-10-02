import React, { useState, useRef } from 'react';
import {
  Settings as SettingsIcon, Lock, User, Sun, Moon,
  Save, CheckCircle2, AlertCircle, Clock, Palette,
  Bell, Key, Check, Camera, Image, Trash2, Upload, Monitor
} from 'lucide-react';
import { useAdminStore, useToastStore } from '@/store';
import api from '@/api/client';
import { userTimeZone } from '@/utils/formatDate';

type SettingsTab = 'profile' | 'theme' | 'security' | 'alerts';

export function Settings() {
  const { admin, updateAdmin } = useAdminStore();
  const { toast } = useToastStore();

  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');

  // Profile state
  const [name, setName] = useState(admin?.name || '');
  const [phone, setPhone] = useState(admin?.phone || '');
  const [avatarUrl, setAvatarUrl] = useState(admin?.avatar_url || admin?.avatarUrl || '');
  const [theme, setTheme] = useState<'dark' | 'light'>(admin?.theme || 'dark');
  const [showAvatarUrlInput, setShowAvatarUrlInput] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Alerts preferences
  const [alerts, setAlerts] = useState({
    criticalErrors: true,
    newUsers: true,
    highPayments: true,
    emailAlerts: false,
    dailyDigest: true
  });

  const getPasswordStrength = (pwd: string) => {
    if (!pwd) return { label: '', color: 'bg-transparent', width: '0%' };
    if (pwd.length < 6) return { label: 'Too short (min 6)', color: 'bg-rose-500', width: '25%' };
    if (pwd.length < 8) return { label: 'Weak', color: 'bg-amber-500', width: '50%' };
    if (!/[A-Z]/.test(pwd) || !/[0-9]/.test(pwd)) return { label: 'Fair', color: 'bg-yellow-400', width: '75%' };
    return { label: 'Strong', color: 'bg-emerald-400', width: '100%' };
  };

  const strength = getPasswordStrength(newPassword);

  const applyThemeToDOM = (t: string) => {
    document.documentElement.setAttribute('data-theme', t);
    if (t === 'light') {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light-theme');
    } else {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light-theme');
    }
  };

  // Handle Photo File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({ type: 'error', message: 'Please select a valid image file (PNG, JPG, WebP)' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ type: 'error', message: 'Image size must be less than 5MB' });
      return;
    }
    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string;
      setAvatarUrl(dataUrl);
      try {
        await api.post('/auth/avatar', { avatar_url: dataUrl });
        updateAdmin({ avatar_url: dataUrl, avatarUrl: dataUrl });
        toast({ type: 'success', message: 'Profile avatar updated successfully' });
      } catch {
        updateAdmin({ avatar_url: dataUrl, avatarUrl: dataUrl });
        toast({ type: 'info', message: 'Avatar loaded. Click Save Profile to persist.' });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAvatar = async () => {
    setAvatarUrl('');
    try {
      await api.post('/auth/avatar', { avatar_url: '' });
      updateAdmin({ avatar_url: '', avatarUrl: '' });
      toast({ type: 'info', message: 'Avatar reset to default initials' });
    } catch {
      updateAdmin({ avatar_url: '', avatarUrl: '' });
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (newPassword && newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }
    if (newPassword && newPassword.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        name: name.trim(),
        phone: phone.trim(),
        theme,
        avatar_url: avatarUrl,
      };
      if (newPassword) {
        payload.current_password = currentPassword;
        payload.new_password = newPassword;
      }

      await api.put('/auth/profile', payload);
      updateAdmin({ name: name.trim(), phone: phone.trim(), theme, avatar_url: avatarUrl, avatarUrl });
      applyThemeToDOM(theme);

      setSuccessMsg('Settings updated successfully');
      toast({ type: 'success', message: 'Admin platform settings saved' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (e: any) {
      const msg = e.response?.data?.detail || e.message || 'Failed to save settings';
      setError(msg);
      toast({ type: 'error', message: msg });
    } finally {
      setSaving(false);
    }
  };

  const handleQuickThemeSelect = async (t: 'dark' | 'light') => {
    setTheme(t);
    updateAdmin({ theme: t });
    applyThemeToDOM(t);
    try { await api.put('/auth/profile', { theme: t }); } catch {}
    toast({ type: 'info', message: `Theme set to ${t === 'dark' ? 'Dark' : 'Light'}` });
  };

  const displayName = name || admin?.name || 'Administrator';
  const displayRole = admin?.role || 'Superadmin';
  const initial = (displayName.charAt(0) || 'A').toUpperCase();

  const inputCls = 'w-full bg-[var(--bg-input)] border border-[var(--border)] rounded-xl px-3.5 py-2.5 text-xs text-[var(--text-primary)] placeholder-[var(--text-subtle)] focus:outline-none focus:border-cyan-400 transition-colors';

  return (
    <div className="space-y-6 animate-fade max-w-5xl mx-auto">
      {/* Title */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)] flex items-center gap-2.5">
          <SettingsIcon size={24} className="text-cyan-400" /> Platform &amp; Administrator Settings
        </h1>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          Manage administrator profile, theme, security, and alert triggers
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--border)] overflow-x-auto gap-2">
        {([
          { id: 'profile', icon: User, label: 'Profile' },
          { id: 'theme',   icon: Palette, label: 'Appearance' },
          { id: 'security',icon: Lock,    label: 'Security' },
          { id: 'alerts',  icon: Bell,    label: 'Alerts' },
        ] as { id: SettingsTab; icon: any; label: string }[]).map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-all shrink-0 ${
              activeTab === id
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Icon size={15} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Global feedback banners */}
      {error && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
          <AlertCircle size={16} /><span>{error}</span>
        </div>
      )}
      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
          <CheckCircle2 size={16} /><span>{successMsg}</span>
        </div>
      )}

      {/* ── TAB: Profile ────────────────────────────────────────────────────── */}
      {activeTab === 'profile' && (
        <form onSubmit={handleSaveProfile} className="space-y-6">
          <div className="p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] shadow-[var(--shadow-card)] space-y-6">

            {/* Avatar Section */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 pb-5 border-b border-[var(--border)]">
              <div className="flex items-center gap-4">
                <div className="relative group shrink-0">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={displayName}
                      className="w-20 h-20 rounded-2xl object-cover border-2 border-cyan-400 shadow-xl shadow-cyan-500/20"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-cyan-500 to-violet-500 text-black font-extrabold text-2xl flex items-center justify-center shadow-xl shadow-cyan-500/20">
                      {initial}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    title="Change Avatar"
                    className="absolute -bottom-1.5 -right-1.5 p-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black shadow-lg transition-transform hover:scale-105 cursor-pointer"
                  >
                    <Camera size={14} />
                  </button>
                </div>

                <div>
                  <h3 className="text-base font-bold text-[var(--text-primary)]">{displayName}</h3>
                  <div className="text-xs text-[var(--text-muted)] font-mono mt-0.5">{admin?.email || 'admin@axisblack.internal'}</div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                      {displayRole}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3.5 py-2 rounded-xl bg-[var(--bg-hover)] border border-[var(--border)] text-[var(--text-primary)] text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer hover:border-cyan-400"
                >
                  <Upload size={14} className="text-cyan-400" /><span>Upload Photo</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowAvatarUrlInput(p => !p)}
                  className="px-3 py-2 rounded-xl bg-[var(--bg-hover)] border border-[var(--border)] text-[var(--text-muted)] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer hover:text-[var(--text-primary)]"
                >
                  <Image size={14} /><span>URL</span>
                </button>
                {avatarUrl && (
                  <button
                    type="button"
                    onClick={handleRemoveAvatar}
                    className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs transition-colors cursor-pointer"
                    title="Remove Photo"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Avatar URL Input */}
            {showAvatarUrlInput && (
              <div className="p-3.5 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border)] space-y-2 animate-fade">
                <label className="block text-xs font-semibold text-[var(--text-muted)]">Avatar Image URL</label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                    placeholder="https://example.com/avatar.jpg"
                    className={inputCls + ' font-mono'}
                  />
                  <button
                    type="button"
                    onClick={() => { updateAdmin({ avatar_url: avatarUrl, avatarUrl }); setShowAvatarUrlInput(false); toast({ type: 'success', message: 'Avatar image URL applied' }); }}
                    className="px-4 py-2 rounded-xl bg-cyan-500 text-black font-bold text-xs shrink-0"
                  >
                    Apply
                  </button>
                </div>
              </div>
            )}

            {/* Form Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">Display Name</label>
                <input type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Administrator" className={inputCls} />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">Email Address</label>
                <input type="email" disabled value={admin?.email || ''} className={inputCls + ' opacity-60 cursor-not-allowed'} />
                <span className="text-[10px] text-[var(--text-subtle)] mt-1 block">Configured via backend env — cannot be changed here.</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">Phone Number</label>
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+254 700 000 000" className={inputCls} />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">Local Timezone</label>
                <div className="w-full bg-[var(--bg-input)] border border-[var(--border)] rounded-xl px-3.5 py-2.5 text-xs text-cyan-400 font-mono flex items-center justify-between">
                  <span>{userTimeZone}</span>
                  <Clock size={14} className="text-[var(--text-subtle)]" />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-500 hover:opacity-95 text-black font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-all shadow-lg disabled:opacity-50"
              >
                {saving ? <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" /> : <><Save size={14} /><span>Save Profile</span></>}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* ── TAB: Appearance ─────────────────────────────────────────────────── */}
      {activeTab === 'theme' && (
        <div className="p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] shadow-[var(--shadow-card)] space-y-5">
          <div>
            <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
              <Palette size={16} className="text-cyan-400" /> Theme
            </h3>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Select your preferred appearance for pages, modals, menus, and text.
            </p>
          </div>

          {/* Theme selector — 2 options matching frontend */}
          <div className="grid grid-cols-2 gap-3">
            {([
              { key: 'light', icon: Sun,  iconColor: 'text-amber-400', label: 'Light' },
              { key: 'dark',  icon: Moon, iconColor: 'text-violet-400', label: 'Dark'  },
            ] as { key: 'dark' | 'light'; icon: any; iconColor: string; label: string }[]).map(({ key, icon: Icon, iconColor, label }) => {
              const isActive = theme === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleQuickThemeSelect(key)}
                  className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all text-left ${
                    isActive
                      ? 'border-cyan-400 bg-cyan-500/10 shadow-md shadow-cyan-500/10'
                      : 'border-[var(--border)] bg-[var(--bg-subtle)] hover:border-[var(--text-subtle)]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon size={18} className={iconColor} />
                    <span className="font-semibold text-sm text-[var(--text-primary)]">{label}</span>
                  </div>
                  {isActive && (
                    <span className="w-5 h-5 rounded-full bg-cyan-400 text-black flex items-center justify-center shrink-0">
                      <Check size={12} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <p className="text-[11px] text-[var(--text-subtle)] pt-1">
            Current: <span className="font-semibold text-cyan-400 capitalize">{theme}</span>
          </p>
        </div>
      )}

      {/* ── TAB: Security ───────────────────────────────────────────────────── */}
      {activeTab === 'security' && (
        <form onSubmit={handleSaveProfile} className="space-y-6">
          <div className="p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] shadow-[var(--shadow-card)] space-y-6">
            <div>
              <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                <Lock size={16} className="text-amber-400" /> Change Password
              </h3>
              <p className="text-xs text-[var(--text-muted)] mt-1">Protect administrator access with a strong, secure password.</p>
            </div>

            <div className="space-y-4 max-w-xl">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">Current Password</label>
                <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="••••••••••••" className={inputCls} />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">New Password</label>
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min. 8 chars, include numbers & capitals" className={inputCls} />
                {newPassword && (
                  <div className="mt-2 space-y-1">
                    <div className="h-1.5 w-full bg-[var(--border)] rounded-full overflow-hidden">
                      <div className={`h-full ${strength.color} transition-all`} style={{ width: strength.width }} />
                    </div>
                    <span className="text-[10px] text-[var(--text-muted)]">{strength.label}</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">Confirm New Password</label>
                <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm matching password" className={inputCls} />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={saving || !newPassword}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-rose-500 hover:opacity-95 text-black font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-all disabled:opacity-40"
                >
                  {saving ? <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" /> : <><Key size={14} /><span>Update Password</span></>}
                </button>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* ── TAB: Alerts ─────────────────────────────────────────────────────── */}
      {activeTab === 'alerts' && (
        <div className="p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] shadow-[var(--shadow-card)] space-y-5">
          <div>
            <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
              <Bell size={16} className="text-cyan-400" /> Notification Triggers
            </h3>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Configure which events dispatch alerts to your notification drawer.
            </p>
          </div>

          <div className="space-y-2.5">
            {[
              { key: 'criticalErrors', title: 'Critical System Errors',      desc: 'Alert on 500 errors, API limits, and payment gateway issues' },
              { key: 'highPayments',  title: 'New Subscriptions & Upgrades', desc: 'Notify when an account upgrades to Starter or Pro tier' },
              { key: 'newUsers',      title: 'New User Registrations',        desc: 'Real-time notice when a new user registers on the platform' },
              { key: 'emailAlerts',  title: 'Email Forwarding',              desc: 'Forward critical errors to your administrator email address' },
              { key: 'dailyDigest',  title: 'Daily Digest',                  desc: 'Daily summary of traffic, revenue, and active user metrics' },
            ].map((pref) => {
              const checked = (alerts as any)[pref.key];
              return (
                <div
                  key={pref.key}
                  onClick={() => setAlerts(prev => ({ ...prev, [pref.key]: !checked }))}
                  className="p-4 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border)] hover:border-[var(--text-subtle)] flex items-center justify-between gap-4 cursor-pointer transition-colors"
                >
                  <div>
                    <div className="text-xs font-bold text-[var(--text-primary)]">{pref.title}</div>
                    <div className="text-[11px] text-[var(--text-muted)] mt-0.5">{pref.desc}</div>
                  </div>
                  <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all shrink-0 ${
                    checked ? 'bg-cyan-500 border-cyan-400 text-black' : 'border-[var(--border)] bg-transparent'
                  }`}>
                    {checked && <Check size={13} />}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={() => toast({ type: 'success', message: 'Preferences saved' })}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-500 hover:opacity-95 text-black font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-all shadow-lg"
            >
              <Save size={14} /><span>Save Preferences</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
