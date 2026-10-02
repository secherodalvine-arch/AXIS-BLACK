import React, { useState, useEffect } from 'react';
import {
  MessageSquare, Send, Bell, Shield, CheckCircle2,
  Users, AlertTriangle, Info, Sparkles, Search, Check,
  Clock, RefreshCw, User, Mail, Tag, Plus, X, MessageCircle
} from 'lucide-react';
import api from '@/api/client';
import { useToastStore } from '@/store';
import { fmtDateTime } from '@/utils/formatDate';

interface SupportThread {
  id: string;
  user_name: string;
  user_email: string;
  subject: string;
  label?: string;
  status: 'open' | 'in_progress' | 'resolved';
  messages: Array<{
    id: string;
    sender: 'user' | 'admin';
    name?: string;
    text: string;
    timestamp: string;
  }>;
  created_at: string;
  updated_at: string;
}

export function Messages() {
  const { toast } = useToastStore();
  const [activeTab, setActiveTab] = useState<'support' | 'broadcast'>('support');

  // Support Threads state
  const [threads, setThreads] = useState<SupportThread[]>([]);
  const [selectedThread, setSelectedThread] = useState<SupportThread | null>(null);
  const [threadFilter, setThreadFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingThreads, setLoadingThreads] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  // New Thread Modal state
  const [showNewModal, setShowNewModal] = useState(false);
  const [newRecipientEmail, setNewRecipientEmail] = useState('');
  const [newRecipientName, setNewRecipientName] = useState('');
  const [newSubject, setNewSubject] = useState('');
  const [newLabel, setNewLabel] = useState('support');
  const [newInitialMsg, setNewInitialMsg] = useState('');
  const [creatingThread, setCreatingThread] = useState(false);

  // Broadcast state
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastType, setBroadcastType] = useState('info');
  const [broadcastTarget, setBroadcastTarget] = useState('all');
  const [sendingBroadcast, setSendingBroadcast] = useState(false);
  const [broadcastHistory, setBroadcastHistory] = useState<any[]>([
    {
      id: 'b-01',
      title: 'Scheduled Financial Platform Maintenance',
      message: 'Platform telemetry will run with low latency during database index optimization.',
      type: 'info',
      dispatched: 14,
      time: 'Earlier today'
    }
  ]);

  const fetchThreads = async () => {
    setLoadingThreads(true);
    try {
      const res = await api.get('/support/threads');
      const data: SupportThread[] = res.data.data || [];
      setThreads(data);
      if (data.length > 0 && !selectedThread) {
        setSelectedThread(data[0]);
      } else if (selectedThread) {
        const updated = data.find(t => t.id === selectedThread.id);
        if (updated) setSelectedThread(updated);
      }
    } catch (e: any) {
      toast({ type: 'error', message: 'Failed to fetch customer support threads' });
    } finally {
      setLoadingThreads(false);
    }
  };

  useEffect(() => {
    fetchThreads();
  }, []);

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedThread || !replyText.trim() || sendingReply) return;

    setSendingReply(true);
    try {
      const res = await api.post(`/support/threads/${selectedThread.id}/reply`, {
        reply: replyText.trim()
      });

      const newMsg = res.data.data;
      const updatedThread = {
        ...selectedThread,
        status: 'in_progress' as const,
        messages: [...selectedThread.messages, newMsg],
        updated_at: new Date().toISOString()
      };

      setSelectedThread(updatedThread);
      setThreads(prev => prev.map(t => t.id === updatedThread.id ? updatedThread : t));
      setReplyText('');
      toast({ type: 'success', message: 'Reply sent to user' });
    } catch (e: any) {
      toast({ type: 'error', message: e.response?.data?.detail || 'Failed to dispatch reply' });
    } finally {
      setSendingReply(false);
    }
  };

  const handleUpdateStatus = async (status: 'open' | 'in_progress' | 'resolved') => {
    if (!selectedThread) return;
    try {
      await api.patch(`/support/threads/${selectedThread.id}/status`, { status });
      const updated = { ...selectedThread, status };
      setSelectedThread(updated);
      setThreads(prev => prev.map(t => t.id === updated.id ? updated : t));
      toast({ type: 'info', message: `Thread status updated to ${status.replace('_', ' ')}` });
    } catch {
      toast({ type: 'error', message: 'Failed to update status' });
    }
  };

  const handleCreateNewThread = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRecipientEmail || !newSubject || !newInitialMsg || creatingThread) return;

    setCreatingThread(true);
    try {
      const res = await api.post('/support/threads', {
        user_email: newRecipientEmail.trim(),
        user_name: newRecipientName.trim() || undefined,
        subject: newSubject.trim(),
        label: newLabel,
        message: newInitialMsg.trim()
      });

      const created = res.data.data;
      setThreads(prev => [created, ...prev]);
      setSelectedThread(created);
      setShowNewModal(false);
      setNewRecipientEmail('');
      setNewRecipientName('');
      setNewSubject('');
      setNewInitialMsg('');
      toast({ type: 'success', message: 'Support thread created and message delivered' });
    } catch (e: any) {
      toast({ type: 'error', message: e.response?.data?.detail || 'Failed to initiate thread' });
    } finally {
      setCreatingThread(false);
    }
  };

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastTitle.trim() || !broadcastMessage.trim() || sendingBroadcast) return;

    setSendingBroadcast(true);
    try {
      const res = await api.post('/messages/broadcast', {
        title: broadcastTitle,
        message: broadcastMessage,
        type: broadcastType,
        target: broadcastTarget,
      });

      const count = res.data.dispatched_to || 0;
      toast({ type: 'success', message: `Broadcast successfully delivered to ${count} users` });
      setBroadcastHistory(prev => [
        {
          id: `b-${Date.now()}`,
          title: broadcastTitle,
          message: broadcastMessage,
          type: broadcastType,
          dispatched: count,
          time: 'Just now'
        },
        ...prev
      ]);
      setBroadcastTitle('');
      setBroadcastMessage('');
    } catch (e: any) {
      toast({ type: 'error', message: e.response?.data?.detail || 'Failed to dispatch broadcast' });
    } finally {
      setSendingBroadcast(false);
    }
  };

  const filteredThreads = threads.filter(t => {
    if (threadFilter !== 'all' && t.status !== threadFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = t.user_name?.toLowerCase().includes(q);
      const matchEmail = t.user_email?.toLowerCase().includes(q);
      const matchSubject = t.subject?.toLowerCase().includes(q);
      return matchName || matchEmail || matchSubject;
    }
    return true;
  });

  return (
    <div className="space-y-6 animate-fade max-w-7xl mx-auto">
      {/* Title & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <MessageSquare size={24} className="text-cyan-400" /> Customer Support &amp; Messaging
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Interact and respond to user inquiries, manage support tickets, or dispatch system-wide bulletins
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'support' && (
            <button
              onClick={() => setShowNewModal(true)}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-lilac-500 text-black font-bold text-xs flex items-center gap-1.5 shadow-md shadow-cyan-500/20"
            >
              <Plus size={14} /> New Conversation
            </button>
          )}

          <div className="flex items-center gap-1 p-1 rounded-xl bg-navy-900 border border-white/8">
            <button
              onClick={() => setActiveTab('support')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'support'
                  ? 'bg-gradient-to-r from-cyan-500/20 to-lilac-500/10 text-cyan-300 border border-cyan-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <MessageCircle size={13} />
              <span>User Support</span>
            </button>
            <button
              onClick={() => setActiveTab('broadcast')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'broadcast'
                  ? 'bg-gradient-to-r from-cyan-500/20 to-lilac-500/10 text-cyan-300 border border-cyan-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Send size={13} />
              <span>System Broadcasts</span>
            </button>
          </div>
        </div>
      </div>

      {/* TAB 1: User Customer Support Threads */}
      {activeTab === 'support' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 min-h-[600px]">
          {/* Left Panel: Threads List (5 cols on lg) */}
          <div className="lg:col-span-5 flex flex-col rounded-2xl bg-navy-900 border border-white/8 shadow-xl overflow-hidden">
            {/* Filter & Search Bar */}
            <div className="p-3.5 border-b border-white/8 space-y-2.5">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search user, email, or subject..."
                  className="w-full bg-navy-950 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1">
                  {(['all', 'open', 'in_progress', 'resolved'] as const).map((st) => (
                    <button
                      key={st}
                      onClick={() => setThreadFilter(st)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold capitalize transition-all ${
                        threadFilter === st
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {st.replace('_', ' ')}
                    </button>
                  ))}
                </div>

                <button
                  onClick={fetchThreads}
                  title="Refresh threads"
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors"
                >
                  <RefreshCw size={13} className={loadingThreads ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>

            {/* Threads List */}
            <div className="flex-1 overflow-y-auto divide-y divide-white/5 max-h-[520px]">
              {loadingThreads && threads.length === 0 ? (
                <div className="text-center py-16 text-slate-500 text-xs">Loading conversations...</div>
              ) : filteredThreads.length === 0 ? (
                <div className="text-center py-16 text-slate-500 text-xs">No matching support conversations</div>
              ) : (
                filteredThreads.map((t) => {
                  const isSelected = selectedThread?.id === t.id;
                  const lastMsg = t.messages[t.messages.length - 1];
                  const isOpen = t.status === 'open';
                  const isInProgress = t.status === 'in_progress';

                  return (
                    <div
                      key={t.id}
                      onClick={() => setSelectedThread(t)}
                      className={`p-3.5 cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-cyan-500/10 border-l-4 border-l-cyan-400'
                          : 'hover:bg-white/3'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-bold text-xs text-white truncate max-w-[170px]">
                          {t.user_name || t.user_email}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase ${
                          isOpen
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : isInProgress
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        }`}>
                          {t.status.replace('_', ' ')}
                        </span>
                      </div>

                      <div className="text-xs font-semibold text-slate-200 truncate">{t.subject}</div>
                      <div className="text-[11px] text-slate-400 truncate mt-0.5">
                        {lastMsg ? lastMsg.text : 'No messages'}
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-slate-500 mt-2 font-mono">
                        <span className="capitalize px-1.5 py-0.2 rounded bg-white/5">{t.label || 'support'}</span>
                        <span>{fmtDateTime(t.updated_at)}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Panel: Conversation View & Responder (7 cols on lg) */}
          <div className="lg:col-span-7 flex flex-col rounded-2xl bg-navy-900 border border-white/8 shadow-xl overflow-hidden min-h-[500px]">
            {selectedThread ? (
              <>
                {/* Thread Header */}
                <div className="p-4 border-b border-white/8 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-navy-950/40">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-white">{selectedThread.subject}</h3>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-white/5 text-slate-300">
                        {selectedThread.label}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                      <span className="font-semibold text-cyan-300">{selectedThread.user_name}</span>
                      <span>•</span>
                      <span className="font-mono">{selectedThread.user_email}</span>
                    </div>
                  </div>

                  {/* Status Dropdown */}
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400">Status:</span>
                    <select
                      value={selectedThread.status}
                      onChange={(e) => handleUpdateStatus(e.target.value as any)}
                      className="bg-navy-950 border border-white/10 rounded-xl px-2.5 py-1 text-xs font-semibold text-white focus:outline-none focus:border-cyan-400"
                    >
                      <option value="open">Open</option>
                      <option value="in_progress">In Progress</option>
                      <option value="resolved">Resolved</option>
                    </select>
                  </div>
                </div>

                {/* Messages Feed */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3.5 max-h-[420px]">
                  {selectedThread.messages.map((m) => {
                    const isAdmin = m.sender === 'admin';
                    return (
                      <div
                        key={m.id}
                        className={`flex flex-col ${isAdmin ? 'items-end' : 'items-start'}`}
                      >
                        <div className="flex items-center gap-2 mb-1 text-[10px] text-slate-400">
                          <span className="font-bold text-white">{m.name || (isAdmin ? 'Admin Support' : selectedThread.user_name)}</span>
                          <span className="font-mono">{fmtDateTime(m.timestamp)}</span>
                        </div>
                        <div
                          className={`max-w-[85%] rounded-2xl p-3.5 text-xs leading-relaxed ${
                            isAdmin
                              ? 'bg-gradient-to-r from-cyan-500/20 to-lilac-500/15 border border-cyan-500/30 text-white'
                              : 'bg-navy-950 border border-white/8 text-slate-200'
                          }`}
                        >
                          {m.text}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Reply Composer */}
                <div className="p-3 sm:p-4 border-t border-white/8 bg-navy-950/80">
                  <form onSubmit={handleSendReply} className="space-y-2">
                    <textarea
                      rows={3}
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder={`Reply to ${selectedThread.user_name || selectedThread.user_email}... (will dispatch in-app notification to user)`}
                      className="w-full bg-navy-900 border border-white/10 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 resize-none"
                    />
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] text-slate-500">
                        Press Send to deliver response directly into user platform
                      </div>
                      <button
                        type="submit"
                        disabled={sendingReply || !replyText.trim()}
                        className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-lilac-500 hover:opacity-95 text-black font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all disabled:opacity-40 shadow-lg shadow-cyan-500/20"
                      >
                        {sendingReply ? (
                          <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <>
                            <Send size={13} />
                            <span>Send Reply</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500 text-xs">
                <MessageSquare size={36} className="text-slate-600 mb-2" />
                <span className="font-bold text-slate-400">No Conversation Selected</span>
                <span>Select a user support thread from the left or initiate a new message</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: System Broadcasts */}
      {activeTab === 'broadcast' && (
        <div className="space-y-6 max-w-4xl mx-auto">
          {/* Broadcast Form */}
          <div className="p-6 rounded-2xl bg-navy-900 border border-white/8 shadow-xl">
            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <Send size={15} className="text-cyan-400" /> Compose Platform Announcement
            </h3>

            <form onSubmit={handleSendBroadcast} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Notification Title</label>
                  <input
                    type="text"
                    required
                    value={broadcastTitle}
                    onChange={(e) => setBroadcastTitle(e.target.value)}
                    placeholder="e.g. Critical Update: Multi-Branch Reconciliation Live"
                    className="w-full bg-navy-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Severity Type</label>
                    <select
                      value={broadcastType}
                      onChange={(e) => setBroadcastType(e.target.value)}
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
                      value={broadcastTarget}
                      onChange={(e) => setBroadcastTarget(e.target.value)}
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
                  value={broadcastMessage}
                  onChange={(e) => setBroadcastMessage(e.target.value)}
                  placeholder="Enter detailed notice content to display inside users' notification drawer..."
                  className="w-full bg-navy-950 border border-white/10 rounded-xl p-3.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-400 resize-none"
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={sendingBroadcast || !broadcastTitle.trim() || !broadcastMessage.trim()}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-lilac-500 hover:opacity-95 text-black font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-all disabled:opacity-40 shadow-lg shadow-cyan-500/20"
                >
                  {sendingBroadcast ? (
                    <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
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
              {broadcastHistory.map((item) => (
                <div key={item.id} className="p-3.5 rounded-xl bg-white/3 border border-white/6 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${
                        item.type === 'warning' ? 'bg-rose-400' : item.type === 'success' ? 'bg-cyan-400' : 'bg-lilac-400'
                      }`} />
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
      )}

      {/* New Support Thread Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade">
          <div className="w-full max-w-lg bg-navy-900 border border-white/10 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/8">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Plus size={16} className="text-cyan-400" /> Start Direct Support Inquiry
              </h3>
              <button onClick={() => setShowNewModal(false)} className="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateNewThread} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">User Email Address</label>
                  <input
                    type="email"
                    required
                    value={newRecipientEmail}
                    onChange={(e) => setNewRecipientEmail(e.target.value)}
                    placeholder="user@company.com"
                    className="w-full bg-navy-950 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">User Name (Optional)</label>
                  <input
                    type="text"
                    value={newRecipientName}
                    onChange={(e) => setNewRecipientName(e.target.value)}
                    placeholder="e.g. Elena Rostova"
                    className="w-full bg-navy-950 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Inquiry Subject</label>
                  <input
                    type="text"
                    required
                    value={newSubject}
                    onChange={(e) => setNewSubject(e.target.value)}
                    placeholder="e.g. Account Check-in / Support"
                    className="w-full bg-navy-950 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Category Label</label>
                  <select
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    className="w-full bg-navy-950 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-400"
                  >
                    <option value="support">Support</option>
                    <option value="billing">Billing</option>
                    <option value="feedback">Feedback</option>
                    <option value="onboarding">Onboarding</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Initial Message</label>
                <textarea
                  rows={4}
                  required
                  value={newInitialMsg}
                  onChange={(e) => setNewInitialMsg(e.target.value)}
                  placeholder="Type the message to the user..."
                  className="w-full bg-navy-950 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-cyan-400 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingThread}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-lilac-500 text-black font-bold uppercase tracking-wider"
                >
                  {creatingThread ? 'Creating...' : 'Start Thread'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
