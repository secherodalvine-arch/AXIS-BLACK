import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAdminStore, useToastStore } from '@/store';
import { Shield, Lock, Mail, User, KeyRound, Eye, EyeOff, ArrowRight, CheckCircle2, AlertCircle, Phone } from 'lucide-react';
import api from '@/api/client';

export function Auth({ mode: initialMode = 'login' }: { mode?: 'login' | 'register' }) {
  const navigate = useNavigate();
  const { setAuth } = useAdminStore();
  const { toast } = useToastStore();

  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>(initialMode);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    invite_code: '',
    phone: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'login') {
        const res = await api.post('/auth/login', {
          email: form.email,
          password: form.password,
        });
        if (res.data.success) {
          setAuth(res.data.admin, res.data.token);
          toast({ type: 'success', message: `Welcome back, ${res.data.admin.name}` });
          navigate('/');
        }
      } else if (mode === 'register') {
        const res = await api.post('/auth/register', {
          name: form.name,
          email: form.email,
          password: form.password,
          invite_code: form.invite_code,
          phone: form.phone,
        });
        if (res.data.success) {
          setAuth(res.data.admin, res.data.token);
          toast({ type: 'success', message: 'Admin account created successfully' });
          navigate('/');
        }
      } else {
        toast({ type: 'info', message: 'If this admin email exists, instructions have been sent.' });
        setMode('login');
      }
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Authentication failed';
      setError(msg);
      toast({ type: 'error', message: msg });
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="min-h-screen bg-navy-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-lilac-500/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-md z-10 animate-fade">
        {/* Brand header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-500 to-lilac-500 p-0.5 shadow-xl shadow-cyan-500/20 mb-4">
            <div className="w-full h-full bg-navy-950 rounded-2xl flex items-center justify-center">
              <Shield size={24} className="text-cyan-400" />
            </div>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            AXIS<span className="text-cyan-400">BLACK</span> ADMIN
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-mono">
            Executive Command &amp; Telemetry Platform
          </p>
        </div>

        {/* Card */}
        <div className="bg-navy-900/90 border border-white/10 rounded-2xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl">
          <div className="flex border-b border-white/10 mb-6">
            <button
              onClick={() => { setMode('login'); setError(''); }}
              className={`flex-1 pb-3 text-xs font-bold uppercase tracking-wider transition-colors ${
                mode === 'login' ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setMode('register'); setError(''); }}
              className={`flex-1 pb-3 text-xs font-bold uppercase tracking-wider transition-colors ${
                mode === 'register' ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              Register Admin
            </button>
          </div>

          {error && (
            <div className="mb-5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Full Name</label>
                <div className="relative">
                  <User size={15} className="absolute left-3.5 top-3 text-slate-500" />
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Chief Administrator"
                    className="w-full bg-navy-950 border border-white/10 rounded-xl px-10 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-400 transition-colors"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Admin Email</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3.5 top-3 text-slate-500" />
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="admin@example.com"
                  className="w-full bg-navy-950 border border-white/10 rounded-xl px-10 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-400 transition-colors"
                />
              </div>
            </div>

            {mode !== 'forgot' && (
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-xs font-semibold text-slate-300">Password</label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => setMode('forgot')}
                      className="text-[11px] text-cyan-400 hover:underline"
                    >
                      Forgot?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock size={15} className="absolute left-3.5 top-3 text-slate-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="••••••••••••"
                    className="w-full bg-navy-950 border border-white/10 rounded-xl px-10 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-400 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-3 text-slate-500 hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
            )}

            {mode === 'register' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Admin Invite Code</label>
                  <div className="relative">
                    <KeyRound size={15} className="absolute left-3.5 top-3 text-amber-400/80" />
                    <input
                      type="text"
                      required
                      value={form.invite_code}
                      onChange={(e) => setForm({ ...form, invite_code: e.target.value })}
                      placeholder="Enter admin invite code"
                      className="w-full bg-navy-950 border border-amber-400/30 rounded-xl px-10 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-400 transition-colors font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Contact Phone (Optional)</label>
                  <div className="relative">
                    <Phone size={15} className="absolute left-3.5 top-3 text-slate-500" />
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      placeholder="+254 700 000 000"
                      className="w-full bg-navy-950 border border-white/10 rounded-xl px-10 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-400 transition-colors"
                    />
                  </div>
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-lilac-500 text-black font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 hover:opacity-95 transition-opacity disabled:opacity-50 shadow-lg shadow-cyan-500/20"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <span>{mode === 'login' ? 'Authenticate' : mode === 'register' ? 'Provision Account' : 'Send Reset Link'}</span>
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </form>
        </div>

        <div className="text-center mt-6">
          <a
            href={import.meta.env.VITE_USER_APP_URL || "http://localhost:5173"}
            className="text-xs text-slate-400 hover:text-cyan-400 transition-colors inline-flex items-center gap-1.5"
          >
            &larr; Return to Axis Black User App
          </a>
        </div>
      </div>
    </div>
  );
}
