import React, { useState } from 'react';
import {
  Settings as SettingsIcon, Shield, Lock, User, Phone,
  Sun, Moon, Save, CheckCircle2, AlertCircle, Info, Clock,
  Palette, Bell, Monitor, Key, Sparkles, Check
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
  const [theme, setTheme] = useState(admin?.theme || 'dark');
  const [accentColor, setAccentColor] = useState('cyan');

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

  const applyThemeToDOM = (selectedTheme: string) => {
    if (selectedTheme === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
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
      await api.put('/auth/profile', {
        name: name.trim(),
        phone: phone.trim(),
        theme,
        current_password: currentPassword || undefined,
        new_password: newPassword || undefined,
      });

      updateAdmin({ name: name.trim(), phone: phone.trim(), theme });
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

  const handleQuickThemeSelect = (selectedTheme: 'dark' | 'light') => {
    setTheme(selectedTheme);
    updateAdmin({ theme: selectedTheme });
    applyThemeToDOM(selectedTheme);
    toast({ type: 'info', message: `Theme changed to ${selectedTheme === 'dark' ? 'Dark Space' : 'Daylight Executive'}` });
  };

  return (
    <div className="space-y-6 animate-fade max-w-5xl mx-auto">
      {/* Title */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
          <SettingsIcon size={24} className="text-cyan-400" /> Platform &amp; Administrator Settings
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Manage administrator profile credentials, visual interface themes, system security, and alert triggers
        </p>
      </div>

      {/* Tabs Header (Structured like user platform) */}
      <div className="flex border-b border-white/8 overflow-x-auto gap-2">
        <button
          onClick={() => setActiveTab('profile')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-all shrink-0 ${
            activeTab === 'profile'
              ? 'border-cyan-400 text-cyan-400'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <User size={15} />
          <span>Profile &amp; Identity</span>
        </button>

        <button
          onClick={() => setActiveTab('theme')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-all shrink-0 ${
            activeTab === 'theme'
              ? 'border-cyan-400 text-cyan-400'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <Palette size={15} />
          <span>Appearance &amp; Theme</span>
        </button>

        <button
          onClick={() => setActiveTab('security')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-all shrink-0 ${
            activeTab === 'security'
              ? 'border-cyan-400 text-cyan-400'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <Lock size={15} />
          <span>Security &amp; Password</span>
        </button>

        <button
          onClick={() => setActiveTab('alerts')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-all shrink-0 ${
            activeTab === 'alerts'
              ? 'border-cyan-400 text-cyan-400'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <Bell size={15} />
          <span>Alerts &amp; Preferences</span>
        </button>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 size={16} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* TAB 1: Profile & Identity */}
      {activeTab === 'profile' && (
        <form onSubmit={handleSaveProfile} className="space-y-6">
          <div className="p-6 rounded-2xl bg-navy-900 border border-white/8 shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/5">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-500 to-lilac-500 text-black font-extrabold text-2xl flex items-center justify-center shadow-lg shadow-cyan-500/20 shrink-0">
                  {(name.charAt(0) || 'A').toUpperCase()}
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">{name || 'Administrator'}</h3>
                  <div className="text-xs text-slate-400 font-mono mt-0.5">{admin?.email || 'admin@axisblack.internal'}</div>
                  <span className="inline-block mt-2 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                    {admin?.role || 'Superadmin'}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Admin Display Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Axis Executive Operator"
                  className="w-full bg-navy-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-400 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Primary Email Address</label>
                <input
                  type="email"
                  disabled
                  value={admin?.email || ''}
                  className="w-full bg-navy-950/60 border border-white/5 rounded-xl px-3.5 py-2.5 text-xs text-slate-400 cursor-not-allowed font-mono"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">Configured via backend master authentication env.</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Emergency Mobile / Phone</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+254 769 231 760"
                  className="w-full bg-navy-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-400 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Local System Timezone</label>
                <div className="w-full bg-navy-950/60 border border-white/5 rounded-xl px-3.5 py-2.5 text-xs text-cyan-300 font-mono flex items-center justify-between">
                  <span>{userTimeZone}</span>
                  <Clock size={14} className="text-slate-500" />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-lilac-500 hover:opacity-95 text-black font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-all shadow-lg shadow-cyan-500/20 disabled:opacity-50"
              >
                {saving ? (
                  <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Save size={14} />
                    <span>Save Profile</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* TAB 2: Appearance & Theme */}
      {activeTab === 'theme' && (
        <div className="p-6 rounded-2xl bg-navy-900 border border-white/8 shadow-xl space-y-6">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Palette size={16} className="text-cyan-400" /> Interface Theme &amp; Styling
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Select your preferred visual environment for the Axis Black Administrator Console
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Dark Theme Card */}
            <div
              onClick={() => handleQuickThemeSelect('dark')}
              className={`p-5 rounded-2xl border cursor-pointer transition-all ${
                theme === 'dark'
                  ? 'bg-cyan-500/10 border-cyan-500/50 shadow-lg shadow-cyan-500/10'
                  : 'bg-navy-950/60 border-white/8 hover:border-white/20'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-navy-900 text-cyan-400 flex items-center justify-center border border-white/10">
                    <Moon size={16} />
                  </div>
                  <span className="font-bold text-sm text-white">Dark Space (Midnight Navy)</span>
                </div>
                {theme === 'dark' && (
                  <span className="w-5 h-5 rounded-full bg-cyan-400 text-black flex items-center justify-center text-xs font-bold">
                    <Check size={12} />
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                High-contrast deep space palette with cyan &amp; lilac accents. Optimized for low-light trading desks and extended monitoring sessions.
              </p>
            </div>

            {/* Light Theme Card */}
            <div
              onClick={() => handleQuickThemeSelect('light')}
              className={`p-5 rounded-2xl border cursor-pointer transition-all ${
                theme === 'light'
                  ? 'bg-cyan-500/10 border-cyan-500/50 shadow-lg shadow-cyan-500/10'
                  : 'bg-navy-950/60 border-white/8 hover:border-white/20'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-white text-amber-500 flex items-center justify-center border border-slate-200">
                    <Sun size={16} />
                  </div>
                  <span className="font-bold text-sm text-white">Daylight Executive</span>
                </div>
                {theme === 'light' && (
                  <span className="w-5 h-5 rounded-full bg-cyan-400 text-black flex items-center justify-center text-xs font-bold">
                    <Check size={12} />
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Crisp, modern high-contrast daytime interface with slate cards, dark typography, and luminous borders.
              </p>
            </div>
          </div>

          {/* Accent Color Palette */}
          <div className="pt-4 border-t border-white/5 space-y-3">
            <label className="block text-xs font-semibold text-slate-300">Brand Highlight Accent</label>
            <div className="flex items-center gap-3">
              {[
                { key: 'cyan', label: 'Cyan Pulse', hex: '#00d4ff' },
                { key: 'lilac', label: 'Lilac Royale', hex: '#cebdff' },
                { key: 'gold', label: 'Imperial Gold', hex: '#e8c97a' },
              ].map((acc) => (
                <button
                  key={acc.key}
                  type="button"
                  onClick={() => setAccentColor(acc.key)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${
                    accentColor === acc.key
                      ? 'border-white/40 bg-white/10 text-white'
                      : 'border-white/5 text-slate-400 hover:text-white'
                  }`}
                >
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: acc.hex }} />
                  <span>{acc.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Security & Password */}
      {activeTab === 'security' && (
        <form onSubmit={handleSaveProfile} className="space-y-6">
          <div className="p-6 rounded-2xl bg-navy-900 border border-white/8 shadow-xl space-y-6">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Lock size={16} className="text-amber-400" /> Change Security Password
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Ensure administrator access is protected with an enterprise-grade argon2id cryptographic hash
              </p>
            </div>

            <div className="space-y-4 max-w-xl">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Current Administrator Password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-navy-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-400 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">New Security Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 8 characters with numbers & capital letter"
                  className="w-full bg-navy-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-400 transition-colors"
                />
                {newPassword && (
                  <div className="mt-2 space-y-1">
                    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                      <div className={`h-full ${strength.color} transition-all`} style={{ width: strength.width }} />
                    </div>
                    <span className="text-[10px] text-slate-400">{strength.label}</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm matching password"
                  className="w-full bg-navy-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-400 transition-colors"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={saving || !newPassword}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-rose-500 hover:opacity-95 text-black font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-all disabled:opacity-40"
                >
                  {saving ? (
                    <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Key size={14} />
                      <span>Update Password</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Session Audit Spec */}
            <div className="pt-4 border-t border-white/5 space-y-2 text-xs text-slate-400">
              <div className="flex items-center gap-2 text-white font-semibold">
                <Shield size={14} className="text-emerald-400" /> Active Session Token Policies
              </div>
              <div className="p-3.5 rounded-xl bg-white/2 border border-white/5 font-mono text-[11px] space-y-1">
                <div>JWT Algorithm: HS256 with 72-hour sliding window</div>
                <div>Session Security: HTTP-only bearer transmission with CORS strict origin enforcement</div>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* TAB 4: Alerts & Preferences */}
      {activeTab === 'alerts' && (
        <div className="p-6 rounded-2xl bg-navy-900 border border-white/8 shadow-xl space-y-6">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Bell size={16} className="text-cyan-400" /> Real-Time Telemetry &amp; Notification Triggers
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Configure which administrative events dispatch alerts to your notification drawer and emergency channels
            </p>
          </div>

          <div className="space-y-3">
            {[
              { key: 'criticalErrors', title: 'Critical System Exceptions', desc: 'Alert when a 500 error or API rate limit occurs on backend, payment gateway, or Gemini AI' },
              { key: 'highPayments', title: 'High-Value Payments & Upgrades', desc: 'Notify immediately when an account upgrades to Starter ($29) or Pro ($99) Tier' },
              { key: 'newUsers', title: 'New Organization Registrations', desc: 'Receive real-time notice when a new business registers on the platform' },
              { key: 'emailAlerts', title: 'Emergency Email Forwarding', desc: 'Forward critical priority system errors to your configured administrator email' },
              { key: 'dailyDigest', title: 'Daily Platform Telemetry Digest', desc: 'Receive a daily 18:00 UTC debrief of total traffic, ARR, and active users' }
            ].map((pref) => {
              const checked = (alerts as any)[pref.key];
              return (
                <div
                  key={pref.key}
                  onClick={() => setAlerts(prev => ({ ...prev, [pref.key]: !checked }))}
                  className="p-4 rounded-xl bg-white/2 border border-white/5 hover:border-white/10 flex items-center justify-between gap-4 cursor-pointer transition-colors"
                >
                  <div>
                    <div className="text-xs font-bold text-white">{pref.title}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{pref.desc}</div>
                  </div>
                  <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all ${
                    checked ? 'bg-cyan-500 border-cyan-400 text-black' : 'border-white/20 bg-transparent'
                  }`}>
                    {checked && <Check size={13} className="font-extrabold" />}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={() => toast({ type: 'success', message: 'Alert notification preferences saved' })}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-lilac-500 hover:opacity-95 text-black font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-all shadow-lg shadow-cyan-500/20"
            >
              <Save size={14} />
              <span>Save Notification Preferences</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
