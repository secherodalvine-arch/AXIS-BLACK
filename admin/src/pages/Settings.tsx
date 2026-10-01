import React, { useState } from 'react';
import {
  Settings as SettingsIcon, Shield, Lock, User, Phone,
  Sun, Moon, Save, CheckCircle2, AlertCircle, Info, Clock
} from 'lucide-react';
import { useAdminStore, useToastStore } from '@/store';
import api from '@/api/client';
import { userTimeZone } from '@/utils/formatDate';

export function Settings() {
  const { admin, updateAdmin } = useAdminStore();
  const { toast } = useToastStore();

  const [name, setName] = useState(admin?.name || '');
  const [phone, setPhone] = useState(admin?.phone || '');
  const [theme, setTheme] = useState(admin?.theme || 'dark');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword && newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    setSaving(true);
    try {
      await api.put('/auth/profile', {
        name,
        phone,
        theme,
        current_password: currentPassword || undefined,
        new_password: newPassword || undefined,
      });

      updateAdmin({ name, phone, theme });
      if (theme === 'light') {
        document.documentElement.classList.remove('dark');
      } else {
        document.documentElement.classList.add('dark');
      }

      toast({ type: 'success', message: 'Admin settings saved successfully' });
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

  return (
    <div className="space-y-6 animate-fade max-w-4xl mx-auto">
      {/* Title */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
          <SettingsIcon size={22} className="text-cyan-400" /> Platform &amp; Security Settings
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Administrator profile credentials, security policies, visual theme, and system environment
        </p>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle size={15} />
          <span>{error}</span>
        </div>
      )}

      {/* Profile Form */}
      <form onSubmit={handleSaveProfile} className="space-y-6">
        <div className="p-6 rounded-2xl bg-navy-900 border border-white/8 shadow-xl space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <User size={15} className="text-cyan-400" /> Administrator Identity
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Admin Display Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-navy-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Admin Email</label>
              <input
                type="email"
                disabled
                value={admin?.email || ''}
                className="w-full bg-navy-950/60 border border-white/5 rounded-xl px-3.5 py-2.5 text-xs text-slate-400 cursor-not-allowed font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Emergency Mobile / Phone</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+254 700 000 000"
                className="w-full bg-navy-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Visual Theme</label>
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                className="w-full bg-navy-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-400"
              >
                <option value="dark">Dark Space (Midnight Navy)</option>
                <option value="light">Daylight Executive</option>
              </select>
            </div>
          </div>
        </div>

        {/* Password Update */}
        <div className="p-6 rounded-2xl bg-navy-900 border border-white/8 shadow-xl space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Lock size={15} className="text-amber-400" /> Change Security Password
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-navy-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-navy-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-navy-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-400"
              />
            </div>
          </div>
        </div>

        {/* Environment Specs */}
        <div className="p-5 rounded-2xl bg-navy-900 border border-white/8 shadow-xl">
          <h3 className="text-xs font-bold text-slate-300 flex items-center gap-2 mb-3">
            <Info size={14} className="text-cyan-400" /> Environment &amp; System Configuration
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
            <div className="p-2.5 rounded-xl bg-white/3 border border-white/6">
              <div className="text-[10px] text-slate-500">Device Local Timezone</div>
              <div className="text-cyan-300 font-bold truncate mt-0.5">{userTimeZone}</div>
            </div>
            <div className="p-2.5 rounded-xl bg-white/3 border border-white/6">
              <div className="text-[10px] text-slate-500">Security Algorithm</div>
              <div className="text-white font-bold mt-0.5">Argon2id + HS256</div>
            </div>
            <div className="p-2.5 rounded-xl bg-white/3 border border-white/6">
              <div className="text-[10px] text-slate-500">API Endpoint</div>
              <div className="text-slate-300 truncate mt-0.5">:8000/api/admin</div>
            </div>
            <div className="p-2.5 rounded-xl bg-white/3 border border-white/6">
              <div className="text-[10px] text-slate-500">Admin Role</div>
              <div className="text-amber-400 font-bold uppercase mt-0.5">{admin?.role || 'Superadmin'}</div>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-lilac-500 hover:opacity-95 text-black font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-all disabled:opacity-50 shadow-lg shadow-cyan-500/20"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <>
                <Save size={14} />
                <span>Save Changes</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
