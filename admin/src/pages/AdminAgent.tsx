import React, { useState, useEffect, useRef } from 'react';
import {
  Bot, Sparkles, Cpu, Zap, Activity, MessageSquare,
  Shield, CheckCircle, BarChart3, TrendingUp, Lightbulb,
  Send, RefreshCw, Copy, Check, Info, ArrowUpRight
} from 'lucide-react';
import api from '@/api/client';
import { useToastStore } from '@/store';

interface ChatMessage {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  timestamp: string;
  metrics?: any;
}

const ADVISORS = [
  { name: 'Financial Advisor', skill: 'financial_advisor.md', queries: 142, accuracy: '99.4%', status: 'Active', latency: '420ms', color: '#06b6d4' },
  { name: 'Inventory & Supply Advisor', skill: 'inventory_advisor.md', queries: 88, accuracy: '98.9%', status: 'Active', latency: '380ms', color: '#8b5cf6' },
  { name: 'Operations & Branch Advisor', skill: 'operations_advisor.md', queries: 64, accuracy: '99.1%', status: 'Active', latency: '410ms', color: '#10b981' },
  { name: 'Growth & ARR Forecast Advisor', skill: 'growth_advisor.md', queries: 53, accuracy: '98.5%', status: 'Active', latency: '490ms', color: '#f59e0b' },
];

const PROMPT_SUGGESTIONS = [
  "Summarize active platform traffic and user signups",
  "What is our current ARR/MRR and subscription plan breakdown?",
  "How can we improve user retention based on platform usage?",
  "Analyze platform usage: which features are most engaged?",
  "Are there any payment or API anomalies detected recently?"
];

export function AdminAgent() {
  const { toast } = useToastStore();
  const [model] = useState('Gemini 2.5 Flash / Pro Multimodal');
  const [activeTab, setActiveTab] = useState<'chat' | 'architecture'>('chat');

  const [inputQuery, setInputQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'welcome-01',
      sender: 'agent',
      text: "### Welcome to Axis Admin Strategic Agent\n\nI am your **executive platform advisor**, grounded in real-time telemetry across **active users, subscription MRR, feature engagement, and operational error logs**.\n\nAsk me about:\n- **Traffic & Visitors**: Page views, landing conversions, device breakdown\n- **Platform Usage**: Spreadsheet adoption, inventory tracking, ledger volume\n- **User Retention**: Data-backed strategies to lower churn based on active telemetry\n- **Revenue Telemetry**: MRR, ARR, and plan distribution\n\n*Note: Axis Admin Agent operates in strict **READ-ONLY** mode to safeguard the production database.*",
      timestamp: new Date().toISOString()
    }
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSendMessage = async (queryText?: string) => {
    const q = (queryText || inputQuery).trim();
    if (!q || loading) return;

    const userMsgId = `usr-${Date.now()}`;
    const userMsg: ChatMessage = {
      id: userMsgId,
      sender: 'user',
      text: q,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputQuery('');
    setLoading(true);

    try {
      const historyPayload = messages.slice(-4).map(m => ({
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

      setMessages(prev => [...prev, agentMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `agt-err-${Date.now()}`,
        sender: 'agent',
        text: "I encountered a temporary telemetry connection timeout. Please verify that backend services are active.",
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMsg]);
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

  const handleClearChat = () => {
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        sender: 'agent',
        text: "Conversation cleared. Ready for your executive platform inquiries.",
        timestamp: new Date().toISOString()
      }
    ]);
  };

  // Simple Markdown Renderer
  const renderMarkdown = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      // Header 3
      if (line.startsWith('### ')) {
        return (
          <h4 key={idx} className="text-sm font-bold text-cyan-400 mt-2.5 mb-1 flex items-center gap-1.5">
            <Sparkles size={13} /> {line.replace('### ', '')}
          </h4>
        );
      }
      // Header 2 or 1
      if (line.startsWith('## ') || line.startsWith('# ')) {
        return (
          <h3 key={idx} className="text-sm font-extrabold text-white mt-3 mb-1">
            {line.replace(/^#+\s/, '')}
          </h3>
        );
      }
      // Bullet list item
      if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        const clean = line.trim().replace(/^[-*]\s+/, '');
        return (
          <div key={idx} className="flex items-start gap-2 ml-2 my-1 text-slate-200">
            <span className="text-cyan-400 font-bold">•</span>
            <div>{renderBoldParts(clean)}</div>
          </div>
        );
      }
      // Numbered list item
      if (line.trim().match(/^\d+\.\s/)) {
        return (
          <div key={idx} className="flex items-start gap-2 ml-2 my-1 text-slate-200">
            <span className="text-cyan-400 font-bold text-xs">{line.trim().split('.')[0]}.</span>
            <div>{renderBoldParts(line.trim().replace(/^\d+\.\s+/, ''))}</div>
          </div>
        );
      }
      // Empty line spacer
      if (!line.trim()) {
        return <div key={idx} className="h-1.5" />;
      }
      // Standard paragraph
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
    <div className="space-y-6 animate-fade max-w-6xl mx-auto">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Bot size={24} className="text-cyan-400" /> Admin Agent &amp; Autonomous Advisors
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time platform intelligence, telemetry synthesis, and autonomous advisory engines
          </p>
        </div>

        {/* View Toggle Tabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-navy-900 border border-white/8">
          <button
            onClick={() => setActiveTab('chat')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === 'chat'
                ? 'bg-gradient-to-r from-cyan-500/20 to-lilac-500/10 text-cyan-300 border border-cyan-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <MessageSquare size={13} />
            <span>Admin Strategic Agent</span>
          </button>
          <button
            onClick={() => setActiveTab('architecture')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === 'architecture'
                ? 'bg-gradient-to-r from-cyan-500/20 to-lilac-500/10 text-cyan-300 border border-cyan-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Cpu size={13} />
            <span>Advisory Architecture</span>
          </button>
        </div>
      </div>

      {/* CHAT TAB (Default view: Executive Admin Strategic Agent) */}
      {activeTab === 'chat' && (
        <div className="space-y-4">
          {/* Read-Only Status & Engine Indicator */}
          <div className="p-3.5 rounded-2xl bg-navy-900 border border-white/8 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs shadow-lg">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
                <Sparkles size={16} />
              </div>
              <div>
                <span className="font-bold text-white">Axis Admin Platform Advisor</span>
                <span className="text-slate-400 ml-2">Grounded in live telemetry • Read-Only Mode</span>
              </div>
            </div>

            <div className="flex items-center gap-3 text-[11px]">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-medium flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Gemini 2.5 Flash Active
              </span>
              <button
                onClick={handleClearChat}
                className="text-slate-400 hover:text-white transition-colors"
                title="Clear conversation"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Chat Container */}
          <div className="rounded-2xl bg-navy-900 border border-white/8 shadow-2xl flex flex-col h-[580px] overflow-hidden">
            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              {messages.map((m) => {
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
                      className={`max-w-[85%] sm:max-w-[78%] rounded-2xl p-4 text-xs ${
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
                              className="hover:text-cyan-300 transition-colors"
                            >
                              {copiedId === m.id ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="space-y-1">
                        {isUser ? <p className="leading-relaxed">{m.text}</p> : renderMarkdown(m.text)}
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

              {loading && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-lilac-500 text-black font-extrabold text-xs flex items-center justify-center shrink-0 animate-pulse">
                    AX
                  </div>
                  <div className="p-4 rounded-2xl bg-navy-950/80 border border-white/8 text-xs text-cyan-300 flex items-center gap-2.5">
                    <div className="w-3.5 h-3.5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                    <span>Analyzing live platform telemetry, retention heuristics, and database snapshots...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Prompt Suggestions */}
            <div className="px-4 py-2.5 border-t border-white/5 bg-navy-950/40 flex items-center gap-2 overflow-x-auto">
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

            {/* Input Composer */}
            <div className="p-3 sm:p-4 border-t border-white/8 bg-navy-950/80">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  value={inputQuery}
                  onChange={(e) => setInputQuery(e.target.value)}
                  placeholder="Ask about traffic, users, ARR, platform usage, retention strategies, or system errors..."
                  disabled={loading}
                  className="flex-1 bg-navy-900 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition-colors"
                />
                <button
                  type="submit"
                  disabled={loading || !inputQuery.trim()}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-lilac-500 hover:opacity-95 text-black font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-all disabled:opacity-40 shadow-lg shadow-cyan-500/20 shrink-0"
                >
                  <Send size={14} />
                  <span className="hidden sm:inline">Consult Agent</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ARCHITECTURE TAB & CARDS (Intact as requested!) */}
      {(activeTab === 'architecture' || activeTab === 'chat') && (
        <div className={`space-y-6 ${activeTab === 'chat' ? 'pt-4 border-t border-white/8' : ''}`}>
          {/* Section Header */}
          <div>
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white flex items-center gap-2.5">
              <Cpu size={20} className="text-cyan-400" /> Axis Autonomous AI Advisors
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Execution status, skill models, latency, and conversation metrics across advisory engines
            </p>
          </div>

          {/* Model Spec Card */}
          <div className="p-5 rounded-2xl bg-navy-900 border border-white/8 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center shrink-0">
                <Sparkles size={24} />
              </div>
              <div>
                <div className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">Underlying Engine</div>
                <div className="text-lg font-bold text-white">{model}</div>
                <div className="text-xs text-slate-400">Autonomous subagent execution with live ledger &amp; catalog grounding</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Operational
              </span>
            </div>
          </div>

          {/* Advisors Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ADVISORS.map((adv) => (
              <div key={adv.name} className="p-5 rounded-2xl bg-navy-900 border border-white/8 shadow-xl space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-white text-sm">{adv.name}</h3>
                    <div className="text-[11px] text-slate-500 font-mono mt-0.5">{adv.skill}</div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 text-[10px] font-bold uppercase">
                    {adv.status}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/5 text-center text-xs">
                  <div className="p-2.5 rounded-xl bg-white/2">
                    <div className="text-[10px] text-slate-500">Invocations</div>
                    <div className="font-bold text-white mt-0.5">{adv.queries}</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white/2">
                    <div className="text-[10px] text-slate-500">Avg Latency</div>
                    <div className="font-bold text-cyan-300 mt-0.5">{adv.latency}</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white/2">
                    <div className="text-[10px] text-slate-500">Accuracy</div>
                    <div className="font-bold text-emerald-400 mt-0.5">{adv.accuracy}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Advisory Capabilities Overview */}
          <div className="p-5 rounded-2xl bg-navy-900 border border-white/8 shadow-xl space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Lightbulb size={16} className="text-amber-400" /> Active Autonomous Capabilities
            </h3>
            <ul className="text-xs text-slate-300 space-y-2 list-disc list-inside">
              <li><strong>Autonomous Anomaly Scanning:</strong> Proactively alerts users about runaway overhead and anomalous expenses.</li>
              <li><strong>Inventory Reorder Heuristics:</strong> Calculates stock velocity and signals stockouts before critical depletion.</li>
              <li><strong>Multi-Branch Reconciliation:</strong> Evaluates branch performance differentials and highlights high-growth units.</li>
              <li><strong>Voice Synthesizer:</strong> Integrates ElevenLabs natural conversational voice interaction for real-time executive voice debriefs.</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
