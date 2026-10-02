import React, { useState, useEffect, useRef } from 'react';
import {
  Bot, Sparkles, Send, Copy, Check, Plus, Trash2,
  Clock, MessageSquare, PanelLeftClose, PanelLeftOpen,
  ArrowUpRight, RefreshCw, X
} from 'lucide-react';
import api from '@/api/client';
import { useToastStore } from '@/store';
import { fmtRelative } from '@/utils/formatDate';

interface ChatMessage {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  timestamp: string;
  metrics?: any;
}

interface ChatSession {
  id: string;
  title: string;
  timestamp: string;
  messages: ChatMessage[];
}

const STORAGE_KEY = 'axis_admin_chat_sessions';

const PROMPT_SUGGESTIONS = [
  "Summarize active platform traffic and user signups",
  "What is our current ARR/MRR and subscription plan breakdown?",
  "How can we improve user retention based on platform usage?",
  "Analyze platform usage: which features are most engaged?",
  "Are there any payment or API anomalies detected recently?"
];

const createDefaultSession = (): ChatSession => ({
  id: `session-${Date.now()}`,
  title: 'New Advisory Chat',
  timestamp: new Date().toISOString(),
  messages: []
});

const loadInitialSessions = (): ChatSession[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load admin chat sessions from storage:', e);
  }
  return [createDefaultSession()];
};

export function AdminAgent() {
  const { toast } = useToastStore();
  const [sessions, setSessions] = useState<ChatSession[]>(loadInitialSessions);
  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    const initial = loadInitialSessions();
    return initial[0]?.id || `session-${Date.now()}`;
  });

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [inputQuery, setInputQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync sessions to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    } catch (e) {
      console.error('Failed to save admin chat sessions to storage:', e);
    }
  }, [sessions]);

  // Current active session
  const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0] || createDefaultSession();
  const activeMessages = activeSession ? activeSession.messages : [];

  // Filter history to display sessions with messages or user exchanges
  const historySessions = sessions.filter(s => s.messages && s.messages.length > 0);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [activeMessages.length, loading]);

  const handleCreateNewChat = () => {
    const newSession = createDefaultSession();
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
    setInputQuery('');
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleSelectSession = (sessionId: string) => {
    setActiveSessionId(sessionId);
  };

  const handleDeleteSession = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    setSessions(prev => {
      const remaining = prev.filter(s => s.id !== sessionId);
      if (remaining.length === 0) {
        const fresh = createDefaultSession();
        setActiveSessionId(fresh.id);
        return [fresh];
      }
      if (activeSessionId === sessionId) {
        setActiveSessionId(remaining[0].id);
      }
      return remaining;
    });
    toast({ type: 'info', message: 'Chat session removed' });
  };

  const handleSendMessage = async (queryText?: string) => {
    const q = (queryText || inputQuery).trim();
    if (!q || loading) return;

    const nowIso = new Date().toISOString();
    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: q,
      timestamp: nowIso
    };

    // Update active session with user message and dynamic title if first message
    setSessions(prev => prev.map(s => {
      if (s.id === activeSessionId) {
        const isGenericTitle = s.title === 'New Advisory Chat' || s.title === 'New Chat';
        const newTitle = isGenericTitle ? (q.length > 35 ? q.slice(0, 35) + '...' : q) : s.title;
        return {
          ...s,
          title: newTitle,
          timestamp: nowIso,
          messages: [...s.messages, userMsg]
        };
      }
      return s;
    }));

    setInputQuery('');
    setLoading(true);

    try {
      const historyPayload = activeMessages.slice(-6).map(m => ({
        role: m.sender === 'user' ? 'user' : 'model',
        text: m.text
      }));

      const res = await api.post('/agent/chat', {
        query: q,
        history: historyPayload
      });

      const answer = res.data.answer || 'Platform analysis complete.';
      const metrics = res.data.metrics_snapshot;

      const agentMsg: ChatMessage = {
        id: `agt-${Date.now()}`,
        sender: 'agent',
        text: answer,
        timestamp: new Date().toISOString(),
        metrics
      };

      setSessions(prev => prev.map(s => {
        if (s.id === activeSessionId) {
          return {
            ...s,
            timestamp: new Date().toISOString(),
            messages: [...s.messages, agentMsg]
          };
        }
        return s;
      }));
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `agt-err-${Date.now()}`,
        sender: 'agent',
        text: "I encountered a telemetry connection issue. Please verify backend connectivity.",
        timestamp: new Date().toISOString()
      };
      setSessions(prev => prev.map(s => {
        if (s.id === activeSessionId) {
          return {
            ...s,
            messages: [...s.messages, errorMsg]
          };
        }
        return s;
      }));
    } finally {
      setLoading(false);
    }
  };

  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast({ type: 'info', message: 'Response copied to clipboard' });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClearCurrentChat = () => {
    setSessions(prev => prev.map(s => {
      if (s.id === activeSessionId) {
        return {
          ...s,
          messages: []
        };
      }
      return s;
    }));
    toast({ type: 'info', message: 'Current chat history cleared' });
  };

  // Markdown rendering
  const renderMarkdown = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      if (line.startsWith('### ')) {
        return (
          <h4 key={idx} className="text-xs sm:text-sm font-bold text-cyan-400 mt-2.5 mb-1 flex items-center gap-1.5">
            <Sparkles size={13} /> {line.replace('### ', '')}
          </h4>
        );
      }
      if (line.startsWith('## ') || line.startsWith('# ')) {
        return (
          <h3 key={idx} className="text-xs sm:text-sm font-extrabold text-white mt-3 mb-1">
            {line.replace(/^#+\s/, '')}
          </h3>
        );
      }
      if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        const clean = line.trim().replace(/^[-*]\s+/, '');
        return (
          <div key={idx} className="flex items-start gap-2 ml-1 sm:ml-2 my-1 text-slate-200">
            <span className="text-cyan-400 font-bold">•</span>
            <div>{renderBoldParts(clean)}</div>
          </div>
        );
      }
      if (line.trim().match(/^\d+\.\s/)) {
        return (
          <div key={idx} className="flex items-start gap-2 ml-1 sm:ml-2 my-1 text-slate-200">
            <span className="text-cyan-400 font-bold text-xs">{line.trim().split('.')[0]}.</span>
            <div>{renderBoldParts(line.trim().replace(/^\d+\.\s+/, ''))}</div>
          </div>
        );
      }
      if (!line.trim()) {
        return <div key={idx} className="h-1.5" />;
      }
      return <p key={idx} className="my-1 leading-relaxed text-slate-200">{renderBoldParts(line)}</p>;
    });
  };

  const renderBoldParts = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="text-white font-bold">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return <code key={i} className="px-1.5 py-0.5 rounded bg-black/40 text-cyan-300 font-mono text-[11px]">{part.slice(1, -1)}</code>;
      }
      return part;
    });
  };

  return (
    <div className="space-y-4 animate-fade max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Bot size={24} className="text-cyan-400" /> Admin Strategic Agent
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time platform telemetry synthesis, user retention heuristics, and operational analysis
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setSidebarOpen(prev => !prev)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-navy-900 border border-white/10 text-xs text-slate-300 hover:text-white transition-colors"
            title={sidebarOpen ? "Hide session history" : "Show session history"}
          >
            {sidebarOpen ? <PanelLeftClose size={14} /> : <PanelLeftOpen size={14} />}
            <span className="hidden sm:inline">{sidebarOpen ? 'Collapse' : 'Chat History'}</span>
          </button>

          <button
            onClick={handleCreateNewChat}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-xs text-cyan-300 font-medium transition-colors"
          >
            <Plus size={14} />
            <span>New Chat</span>
          </button>
        </div>
      </div>

      {/* Main Container: Sidebar + Chat Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[calc(100vh-210px)] min-h-[580px]">
        {/* SIDEBAR: CHAT SESSIONS */}
        {sidebarOpen && (
          <div className="lg:col-span-3 rounded-2xl bg-navy-900 border border-white/8 shadow-xl flex flex-col overflow-hidden transition-all">
            {/* Sidebar Header */}
            <div className="p-3.5 border-b border-white/8 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-white uppercase tracking-wider">
                <Clock size={14} className="text-cyan-400" />
                <span>Sessions ({historySessions.length})</span>
              </div>
              <button
                onClick={handleCreateNewChat}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
                title="Create New Session"
              >
                <Plus size={14} />
              </button>
            </div>

            {/* Sessions List */}
            <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5 custom-scrollbar">
              {historySessions.length === 0 ? (
                <div className="p-4 text-center">
                  <MessageSquare size={24} className="mx-auto text-slate-600 mb-2" />
                  <p className="text-xs text-slate-400">No session history yet.</p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Your conversation history will appear here as you ask queries.
                  </p>
                </div>
              ) : (
                historySessions.map(s => {
                  const isActive = s.id === activeSessionId;
                  return (
                    <div
                      key={s.id}
                      onClick={() => handleSelectSession(s.id)}
                      className={`group relative flex items-center justify-between p-2.5 rounded-xl cursor-pointer text-xs transition-all ${
                        isActive
                          ? 'bg-cyan-500/15 border border-cyan-500/35 text-white shadow-sm'
                          : 'bg-navy-950/40 hover:bg-white/5 border border-transparent text-slate-300 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 overflow-hidden flex-1 mr-2">
                        <MessageSquare
                          size={14}
                          className={isActive ? 'text-cyan-400 shrink-0' : 'text-slate-500 shrink-0'}
                        />
                        <div className="overflow-hidden">
                          <p className="font-medium truncate text-xs">
                            {s.title}
                          </p>
                          <span className="text-[10px] text-slate-500 block mt-0.5">
                            {fmtRelative(s.timestamp)}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={(e) => handleDeleteSession(e, s.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-white/10 text-slate-400 hover:text-red-400 transition-all shrink-0"
                        title="Delete Session"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* MAIN CHAT AREA */}
        <div className={`${sidebarOpen ? 'lg:col-span-9' : 'lg:col-span-12'} rounded-2xl bg-navy-900 border border-white/8 shadow-2xl flex flex-col overflow-hidden transition-all`}>
          {/* Chat Header Bar */}
          <div className="px-4 py-3 border-b border-white/8 bg-navy-950/60 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-lilac-500 text-black font-extrabold text-xs flex items-center justify-center shrink-0 shadow-md shadow-cyan-500/20">
                AX
              </div>
              <div className="overflow-hidden">
                <h2 className="text-xs sm:text-sm font-bold text-white truncate">
                  {activeSession.title}
                </h2>
                <div className="flex items-center gap-2 text-[10px] text-slate-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Real-time platform telemetry active</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {activeMessages.length > 0 && (
                <button
                  onClick={handleClearCurrentChat}
                  className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] text-slate-400 hover:text-white transition-colors"
                  title="Clear messages in current chat"
                >
                  Clear Chat
                </button>
              )}
            </div>
          </div>

          {/* Messages Scroll View */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 custom-scrollbar">
            {/* If no messages yet in active session, show compact welcome banner + prompt chips */}
            {activeMessages.length === 0 && (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-lilac-500 text-black font-extrabold text-xs flex items-center justify-center shrink-0 shadow-md shadow-cyan-500/20 mt-1">
                  AX
                </div>
                <div className="max-w-[90%] sm:max-w-[80%] rounded-2xl p-4 text-xs bg-navy-950/80 border border-white/8 text-slate-200 shadow-md">
                  <div className="flex items-center justify-between gap-4 mb-2 text-[10px] opacity-80">
                    <span className="font-bold text-cyan-400">Axis Strategic Agent</span>
                    <span className="font-mono">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <p className="leading-relaxed">
                    Welcome back, Administrator. I am your platform strategic intelligence advisor. How can I assist you with platform telemetry, subscriptions, or system operations today?
                  </p>

                  <div className="mt-3.5 pt-3 border-t border-white/5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                      Suggested Inquiries:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {PROMPT_SUGGESTIONS.map((sug, i) => (
                        <button
                          key={i}
                          onClick={() => handleSendMessage(sug)}
                          className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-cyan-500/15 border border-white/8 hover:border-cyan-500/30 text-[11px] text-slate-300 hover:text-cyan-300 transition-all text-left flex items-center gap-1.5"
                        >
                          <span>{sug}</span>
                          <ArrowUpRight size={10} className="text-slate-500 shrink-0" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Conversation Messages */}
            {activeMessages.map((m) => {
              const isUser = m.sender === 'user';
              return (
                <div
                  key={m.id}
                  className={`flex items-start gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  {!isUser && (
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-lilac-500 text-black font-extrabold text-xs flex items-center justify-center shrink-0 shadow-md shadow-cyan-500/20 mt-1">
                      AX
                    </div>
                  )}

                  <div
                    className={`max-w-[88%] sm:max-w-[78%] rounded-2xl p-4 text-xs ${
                      isUser
                        ? 'bg-gradient-to-r from-cyan-500 to-lilac-500 text-black font-medium shadow-md shadow-cyan-500/20'
                        : 'bg-navy-950/80 border border-white/8 text-slate-200 shadow-md'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4 mb-1.5 opacity-80 text-[10px]">
                      <span className="font-bold">{isUser ? 'Administrator' : 'Axis Strategic Agent'}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono">
                          {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {!isUser && (
                          <button
                            onClick={() => handleCopyText(m.id, m.text)}
                            title="Copy response"
                            className="hover:text-cyan-300 transition-colors p-0.5"
                          >
                            {copiedId === m.id ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1">
                      {isUser ? <p className="leading-relaxed whitespace-pre-wrap">{m.text}</p> : renderMarkdown(m.text)}
                    </div>
                  </div>

                  {isUser && (
                    <div className="w-8 h-8 rounded-xl bg-white/10 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-1">
                      ADM
                    </div>
                  )}
                </div>
              );
            })}

            {/* Loading Indicator */}
            {loading && (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-lilac-500 text-black font-extrabold text-xs flex items-center justify-center shrink-0 animate-pulse">
                  AX
                </div>
                <div className="p-3.5 rounded-2xl bg-navy-950/80 border border-white/8 text-xs text-cyan-300 flex items-center gap-2.5">
                  <div className="w-3.5 h-3.5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                  <span>Axis Agent is analyzing telemetry...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts Bar (when active messages exist) */}
          {activeMessages.length > 0 && (
            <div className="px-4 py-2 border-t border-white/5 bg-navy-950/40 flex items-center gap-2 overflow-x-auto custom-scrollbar">
              <span className="text-[10px] text-slate-500 font-bold uppercase shrink-0">Prompts:</span>
              {PROMPT_SUGGESTIONS.map((s, i) => (
                <button
                  key={i}
                  disabled={loading}
                  onClick={() => handleSendMessage(s)}
                  className="px-2.5 py-1 rounded-lg bg-white/4 hover:bg-white/8 border border-white/6 text-[11px] text-slate-300 hover:text-cyan-300 whitespace-nowrap transition-colors shrink-0 flex items-center gap-1"
                >
                  <span>{s}</span>
                  <ArrowUpRight size={10} className="text-slate-500" />
                </button>
              ))}
            </div>
          )}

          {/* Input Area */}
          <div className="p-3 sm:p-4 border-t border-white/8 bg-navy-950/90">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-end gap-2"
            >
              <div className="flex-1 relative">
                <textarea
                  ref={textareaRef}
                  rows={2}
                  value={inputQuery}
                  onChange={(e) => setInputQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="Ask about traffic, users, ARR, platform usage, retention strategies, or system errors..."
                  disabled={loading}
                  className="w-full resize-none bg-navy-900 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !inputQuery.trim()}
                className="h-[48px] px-5 rounded-xl bg-gradient-to-r from-cyan-500 to-lilac-500 hover:opacity-95 text-black font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all disabled:opacity-40 shadow-lg shadow-cyan-500/20 shrink-0"
              >
                <Send size={15} />
                <span className="hidden sm:inline">Send</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
