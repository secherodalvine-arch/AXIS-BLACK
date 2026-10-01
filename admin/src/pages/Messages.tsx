import React, { useState } from 'react';
import {
  MessageSquare, Send, Bell, Shield, CheckCircle2,
  Users, AlertTriangle, Info, Sparkles
} from 'lucide-react';
import api from '@/api/client';
import { useToastStore } from '@/store';

export function Messages() {
  const { toast } = useToastStore();
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState('info');
  const [target, setTarget] = useState('all');
  const [sending, setSending] = useState(false);
  const [sentHistory, setSentHistory] = useState<any[]>([
    {
      id: 'b-01',
      title: 'Scheduled Financial Platform Maintenance',
      message: 'Platform telemetry will run with low latency during database index optimization.',
      type: 'info',
      dispatched: 14,
      time: 'Earlier today'
    }
  ]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) return;

    setSending(true);
    try {
      const res = await api.post('/messages/broadcast', {
        title,
        message,
        type,
        target,
      });

      const count = res.data.dispatched_to || 0;
      toast({ type: 'success', message: `Broadcast successfully delivered to ${count} users` });
      setSentHistory(prev => [
        {
          id: `b-${Date.now()}`,
          title,
          message,
          type,
          dispatched: count,
          time: 'Just now'
        },
        ...prev
      ]);
      setTitle('');
      setMessage('');
    } catch (e: any) {
      toast({ type: 'error', message: e.response?.data?.detail || 'Failed to dispatch broadcast' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade max-w-4xl mx-auto">
      {/* Title */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
          <MessageSquare size={22} className="text-cyan-400" /> System Broadcasts &amp; Announcements
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Dispatch in-app notifications and administrative bulletins directly to user client dashboards
        </p>
      </div>

      {/* Broadcast Form */}
      <div className="p-6 rounded-2xl bg-navy-900 border border-white/8 shadow-xl">
        <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
          <Send size={15} className="text-cyan-400" /> Compose Platform Announcement
        </h3>

        <form onSubmit={handleSend} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Notification Title</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Critical Update: Multi-Branch Reconciliation Live"
                className="w-full bg-navy-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-400"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Severity Type</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full bg-navy-950 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-400"
                >
                  <option value="info">Information (Lilac)</option>
                  <option value="success">Success (Cyan)</option>
                  <option value="warning">Alert (Pink / Rose)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Audience Target</label>
                <select
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  className="w-full bg-navy-950 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-400"
                >
                  <option value="all">All Accounts</option>
                  <option value="owners">Owners Only</option>
                  <option value="active">Active Sessions</option>
                </select>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Notification Message</label>
            <textarea
              required
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Enter detailed notice content to display inside users' notification drawer..."
              className="w-full bg-navy-950 border border-white/10 rounded-xl p-3.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-400 resize-none"
            />
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={sending || !title.trim() || !message.trim()}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-lilac-500 hover:opacity-95 text-black font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-all disabled:opacity-40 shadow-lg shadow-cyan-500/20"
            >
              {sending ? (
                <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <Send size={14} />
                  <span>Send Broadcast</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* History */}
      <div className="p-6 rounded-2xl bg-navy-900 border border-white/8 shadow-xl">
        <h3 className="text-sm font-bold text-white mb-3">Broadcast Transmission Log</h3>
        <div className="space-y-3">
          {sentHistory.map((item) => (
            <div key={item.id} className="p-3.5 rounded-xl bg-white/3 border border-white/6 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${
                    item.type === 'warning' ? 'bg-rose-400' : item.type === 'success' ? 'bg-cyan-400' : 'bg-lilac-400'
                  }`}></span>
                  {item.title}
                </span>
                <span className="text-[10px] text-slate-500 font-mono">{item.time}</span>
              </div>
              <p className="text-slate-300 text-[11px]">{item.message}</p>
              <div className="text-[10px] text-cyan-400/90 font-mono pt-1">
                Dispatched to {item.dispatched} recipients
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
