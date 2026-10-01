import React, { useMemo } from 'react';
import { MetricData, Transaction, AIStreamItem, Currency } from '../types';
import { BusinessInsightBanner } from '../components/BusinessInsightBanner';
import { FinancialGrowthChart } from '../components/FinancialGrowthChart';
import { AssetAllocationChart } from '../components/AssetAllocationChart';
import { RecentLedgerTable } from '../components/RecentLedgerTable';
import { formatCurrency } from '../utils/currencyUtils';

interface OverviewDashboardProps {
  metrics: MetricData[];
  transactions: Transaction[];
  aiStream: AIStreamItem[];
  currency?: Currency;
  user?: any;
  onNavigateToAgent?: () => void;
  onNavigateToLedger?: () => void;
  onAIActionClick: (title: string) => void;
  onQuickAISubmit: (query: string) => void;
  onExportCSV: (txns?: Transaction[]) => void;
}

export const OverviewDashboard: React.FC<OverviewDashboardProps> = ({
  metrics,
  transactions,
  aiStream: _aiStream,
  currency = 'USD',
  user,
  onNavigateToAgent,
  onNavigateToLedger,
  onAIActionClick: _onAIActionClick,
  onQuickAISubmit: _onQuickAISubmit,
  onExportCSV
}) => {
  const handleExplore = onNavigateToLedger || onNavigateToAgent || (() => {});

  // Compute key executive financial figures directly from ledger transactions
  const { totalRevenue, totalExpenses, netLiquidity, runwayMonths, netMarginPct } = useMemo(() => {
    let rev = 0;
    let exp = 0;

    transactions.forEach(t => {
      const amt = Number(t.amount) || 0;
      if (amt > 0) {
        rev += amt;
      } else {
        exp += Math.abs(amt);
      }
    });

    const net = rev - exp;
    const margin = rev > 0 ? ((net / rev) * 100).toFixed(1) : '0.0';
    const runway = (exp > 0 && net > 0) ? Math.max(0, +(net / exp).toFixed(1)) : (net > 0 ? 12 : 0);

    return {
      totalRevenue: rev,
      totalExpenses: exp,
      netLiquidity: net,
      runwayMonths: runway,
      netMarginPct: margin
    };
  }, [transactions]);

  return (
    <div className="tab-view active" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Team Operational Context Banner */}
      {user?.is_sub_user && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          padding: '14px 20px',
          borderRadius: '14px',
          background: 'rgba(0, 212, 255, 0.06)',
          border: '1px solid rgba(0, 212, 255, 0.25)',
          color: 'var(--text-main, #ffffff)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'rgba(0, 212, 255, 0.15)',
              border: '1px solid rgba(0, 212, 255, 0.35)',
              color: 'var(--secondary-cyan, #00d4ff)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.1rem'
            }}>
              <i className="fa-solid fa-code-branch"></i>
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.96rem', fontFamily: 'Plus Jakarta Sans' }}>
                {user.company || 'Business Dashboard'}
              </div>
              <div style={{ color: 'var(--text-muted, #9ca3af)', fontSize: '0.8rem', marginTop: '2px' }}>
                Operational Scope: <strong style={{ color: 'var(--secondary-cyan, #00d4ff)' }}>{user.branch_name || 'Assigned Branch'}</strong>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{
              fontSize: '0.78rem',
              padding: '5px 12px',
              borderRadius: '20px',
              background: 'rgba(206, 189, 255, 0.15)',
              border: '1px solid rgba(206, 189, 255, 0.3)',
              color: 'var(--primary-lilac, #cebdff)',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <i className="fa-solid fa-user-shield"></i>
              {user.role_name || user.role || 'Team Member'}
            </span>
          </div>
        </div>
      )}

      {/* 1. Automated Business Financial Insight */}
      <BusinessInsightBanner onExploreClick={handleExplore} metrics={metrics} currency={currency} />

      {/* 2. Executive KPI Summary Cards (Instant clarity on financial standing) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        {/* Total Revenue Card */}
        <div className="glass-card" style={{ padding: '18px 20px', borderRadius: '14px', border: '1px solid rgba(0, 212, 255, 0.25)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted, #9ca3af)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Total Revenue
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(0, 212, 255, 0.12)', color: '#00d4ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem' }}>
              <i className="fa-solid fa-arrow-trend-up"></i>
            </div>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main, #ffffff)', fontFamily: 'JetBrains Mono' }}>
            {formatCurrency(totalRevenue, currency)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', fontSize: '0.72rem' }}>
            <span style={{ color: '#4ade80', fontWeight: 700 }}>
              <i className="fa-solid fa-circle-check"></i> Money In
            </span>
            <span style={{ color: 'var(--text-muted, #9ca3af)' }}>· Recorded across ledger</span>
          </div>
        </div>

        {/* Total Operating Expenses Card */}
        <div className="glass-card" style={{ padding: '18px 20px', borderRadius: '14px', border: '1px solid rgba(206, 189, 255, 0.25)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted, #9ca3af)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Operating Expenses
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(206, 189, 255, 0.12)', color: '#cebdff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem' }}>
              <i className="fa-solid fa-receipt"></i>
            </div>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main, #ffffff)', fontFamily: 'JetBrains Mono' }}>
            {formatCurrency(totalExpenses, currency)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', fontSize: '0.72rem' }}>
            <span style={{ color: '#cebdff', fontWeight: 600 }}>
              <i className="fa-solid fa-arrow-trend-down"></i> Money Out
            </span>
            <span style={{ color: 'var(--text-muted, #9ca3af)' }}>· COGS, payroll &amp; overhead</span>
          </div>
        </div>

        {/* Net Cash / Profit Card */}
        <div className="glass-card" style={{ padding: '18px 20px', borderRadius: '14px', border: `1px solid ${netLiquidity >= 0 ? 'rgba(74, 222, 128, 0.3)' : 'rgba(248, 113, 113, 0.3)'}`, position: 'relative', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted, #9ca3af)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Net Profit / Cash
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: netLiquidity >= 0 ? 'rgba(74, 222, 128, 0.12)' : 'rgba(248, 113, 113, 0.12)', color: netLiquidity >= 0 ? '#4ade80' : '#f87171', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem' }}>
              <i className={`fa-solid ${netLiquidity >= 0 ? 'fa-wallet' : 'fa-triangle-exclamation'}`}></i>
            </div>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: netLiquidity >= 0 ? '#4ade80' : '#f87171', fontFamily: 'JetBrains Mono' }}>
            {netLiquidity >= 0 ? `+${formatCurrency(netLiquidity, currency)}` : formatCurrency(netLiquidity, currency)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', fontSize: '0.72rem' }}>
            <span style={{ color: netLiquidity >= 0 ? '#4ade80' : '#f87171', fontWeight: 700 }}>
              {netMarginPct}% margin
            </span>
            <span style={{ color: 'var(--text-muted, #9ca3af)' }}>· Net retained capital</span>
          </div>
        </div>

        {/* Operating Runway Card */}
        <div className="glass-card" style={{ padding: '18px 20px', borderRadius: '14px', border: '1px solid rgba(0, 212, 255, 0.25)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted, #9ca3af)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Projected Runway
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(0, 212, 255, 0.12)', color: '#00d4ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem' }}>
              <i className="fa-solid fa-hourglass-half"></i>
            </div>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#00d4ff', fontFamily: 'JetBrains Mono' }}>
            {runwayMonths} {runwayMonths === 1 ? 'Month' : 'Months'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', fontSize: '0.72rem' }}>
            <span style={{ color: runwayMonths >= 6 ? '#4ade80' : '#fbbf24', fontWeight: 600 }}>
              <i className={`fa-solid ${runwayMonths >= 6 ? 'fa-shield-halved' : 'fa-bell'}`}></i> {runwayMonths >= 6 ? 'Stable runway' : 'Monitor cash flow'}
            </span>
            <span style={{ color: 'var(--text-muted, #9ca3af)' }}>· Based on net burn</span>
          </div>
        </div>
      </div>

      {/* 3. Decent & Easy to Understand Financial Performance Graph */}
      <FinancialGrowthChart transactions={transactions} currency={currency} />

      {/* 4. Secondary Grid: Category Spending Breakdown & Recent Ledger Table */}
      <div className="dashboard-grid-secondary" style={{ marginTop: '0.5rem' }}>
        <AssetAllocationChart transactions={transactions} currency={currency} />
        <RecentLedgerTable 
          transactions={transactions}
          currency={currency}
          onExportCSV={onExportCSV}
        />
      </div>
    </div>
  );
};

export default OverviewDashboard;
