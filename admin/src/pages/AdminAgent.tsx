import React, { useState } from 'react';
import {
  Bot, Sparkles, Cpu, Zap, Activity, MessageSquare,
  Shield, CheckCircle, BarChart3, TrendingUp, Lightbulb
} from 'lucide-react';

const ADVISORS = [
  { name: 'Financial Advisor', skill: 'financial_advisor.md', queries: 142, accuracy: '99.4%', status: 'Active', latency: '420ms', color: '#06b6d4' },
  { name: 'Inventory & Supply Advisor', skill: 'inventory_advisor.md', queries: 88, accuracy: '98.9%', status: 'Active', latency: '380ms', color: '#8b5cf6' },
  { name: 'Operations & Branch Advisor', skill: 'operations_advisor.md', queries: 64, accuracy: '99.1%', status: 'Active', latency: '410ms', color: '#10b981' },
  { name: 'Growth & ARR Forecast Advisor', skill: 'growth_advisor.md', queries: 53, accuracy: '98.5%', status: 'Active', latency: '490ms', color: '#f59e0b' },
];

export function AdminAgent() {
  const [model] = useState('Gemini 2.5 Flash / Pro Multimodal');

  return (
    <div className="space-y-6 animate-fade">
      {/* Title */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
          <Bot size={22} className="text-cyan-400" /> Axis Autonomous AI Advisors
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Execution status, skill models, latency, and conversation metrics across advisory engines
        </p>
      </div>

      {/* Model Spec Card */}
      <div className="p-5 rounded-2xl bg-navy-900 border border-white/8 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
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
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
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
  );
}
