import React, { useEffect, useRef, useState, useMemo } from 'react';
import ChartJS from 'chart.js/auto';
import { Currency, Transaction } from '../types';
import { formatCurrency } from '../utils/currencyUtils';
import { getBranchesApi, getAnalyticsApi } from '../utils/api';

interface BusinessAnalyticsProps {
  currency?: Currency;
  transactions?: Transaction[];
  searchQuery?: string;
}

interface MonthlyRecord {
  month: string;
  fullMonth: string;
  revenue: number;
  expenses: number;
  net: number;
  cat1: number; // Operations & COGS
  cat2: number; // Payroll & Personnel
  cat3: number; // Infrastructure & Tech
  cat4: number; // Growth & Admin
}

const currentYear = new Date().getFullYear();
const MONTHS_CONFIG = [
  { month: 'Jan', fullMonth: `January ${currentYear}` },
  { month: 'Feb', fullMonth: `February ${currentYear}` },
  { month: 'Mar', fullMonth: `March ${currentYear}` },
  { month: 'Apr', fullMonth: `April ${currentYear}` },
  { month: 'May', fullMonth: `May ${currentYear}` },
  { month: 'Jun', fullMonth: `June ${currentYear}` },
  { month: 'Jul', fullMonth: `July ${currentYear}` },
  { month: 'Aug', fullMonth: `August ${currentYear}` },
  { month: 'Sep', fullMonth: `September ${currentYear}` },
  { month: 'Oct', fullMonth: `October ${currentYear}` },
  { month: 'Nov', fullMonth: `November ${currentYear}` },
  { month: 'Dec', fullMonth: `December ${currentYear}` },
];

export const BusinessAnalytics: React.FC<BusinessAnalyticsProps> = ({
  currency = 'USD',
  transactions = [],
  searchQuery = ''
}) => {
  const chartRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstanceRef = useRef<any>(null);

  const [chartMode, setChartMode] = useState<'cashflow' | 'categories'>('cashflow');
  const [timeframe, setTimeframe] = useState<'24H' | '7D' | '30D' | '1Y'>('1Y');
  const [branchFilter, setBranchFilter] = useState<string>('');
  const [branches, setBranches] = useState<any[]>([]);
  const [backendAnalytics, setBackendAnalytics] = useState<any | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [selectedMonthIndex, setSelectedMonthIndex] = useState<number>(() => {
    const cur = new Date().getMonth();
    return cur >= 0 && cur <= 11 ? cur : 5;
  });

  const labelsConfig = {
    cat1: 'Operations & COGS',
    cat2: 'Payroll & Personnel',
    cat3: 'Infrastructure & Tech',
    cat4: 'Growth & Admin'
  };

  useEffect(() => {
    getBranchesApi().then(b => setBranches(Array.isArray(b) ? b : [])).catch(() => {});
  }, []);

  useEffect(() => {
    setLoadingAnalytics(true);
    getAnalyticsApi(branchFilter || undefined)
      .then(data => setBackendAnalytics(data))
      .catch(err => console.log('Analytics load error:', err))
      .finally(() => setLoadingAnalytics(false));
  }, [branchFilter]);

  // Filter transactions by active timeframe, branchFilter, and search query
  const effectiveTransactions = useMemo(() => {
    if (!transactions || transactions.length === 0) return [];
    const now = Date.now();
    const msMap: Record<string, number> = {
      '24H': 24 * 60 * 60 * 1000,
      '7D': 7 * 24 * 60 * 60 * 1000,
      '30D': 30 * 24 * 60 * 60 * 1000,
      '1Y': 365 * 24 * 60 * 60 * 1000
    };
    const maxAge = msMap[timeframe] || 365 * 24 * 60 * 60 * 1000;
    const cutoff = now - maxAge;
    const query = (searchQuery || '').toLowerCase().trim();

    return transactions.filter(t => {
      if (branchFilter && t.branch_id && t.branch_id !== branchFilter) {
        return false;
      }
      if (t.date) {
        const tTime = new Date(t.date).getTime();
        if (!isNaN(tTime) && tTime < cutoff) return false;
      }
      if (query) {
        const matches = (t.counterparty || '').toLowerCase().includes(query) ||
          (t.category || '').toLowerCase().includes(query) ||
          (t.notes || '').toLowerCase().includes(query);
        if (!matches) return false;
      }
      return true;
    });
  }, [transactions, timeframe, searchQuery, branchFilter]);

  // Dynamically compute monthly records from real transactions
  const monthlyData: MonthlyRecord[] = useMemo(() => {
    const records: MonthlyRecord[] = MONTHS_CONFIG.map(m => ({
      month: m.month,
      fullMonth: m.fullMonth,
      revenue: 0,
      expenses: 0,
      net: 0,
      cat1: 0,
      cat2: 0,
      cat3: 0,
      cat4: 0,
    }));

    if (!effectiveTransactions || effectiveTransactions.length === 0) {
      return records;
    }

    effectiveTransactions.forEach(t => {
      if (!t.date) return;
      const d = new Date(t.date);
      if (isNaN(d.getTime())) return;
      if (d.getFullYear() !== currentYear) return;
      const mIdx = d.getMonth();
      if (isNaN(mIdx) || mIdx < 0 || mIdx > 11) return;

      const amt = Number(t.amount) || 0;
      const cat = (t.category || '').toLowerCase();
      const cp = (t.counterparty || '').toLowerCase();

      if (amt > 0) {
        records[mIdx].revenue += amt;
      } else {
        const absAmt = Math.abs(amt);
        records[mIdx].expenses += absAmt;

        if (/cogs|cost of goods|inventory|produce|materials|merchandise|order/i.test(cat)) {
          records[mIdx].cat1 += absAmt;
        } else if (/payroll|salary|wage|personnel|staff|compensation/i.test(cat) || /payroll|gusto/i.test(cp)) {
          records[mIdx].cat2 += absAmt;
        } else if (/infra|tech|cloud|aws|hosting|server|kubernetes|hardware|software|subscription/i.test(cat) || /aws|amazon|google|stripe/i.test(cp)) {
          records[mIdx].cat3 += absAmt;
        } else {
          records[mIdx].cat4 += absAmt;
        }
      }
    });

    for (let i = 0; i < records.length; i++) {
      records[i].net = records[i].revenue - records[i].expenses;
    }

    return records;
  }, [effectiveTransactions]);

  const selectedMonth = monthlyData[selectedMonthIndex] || monthlyData[0];

  // Annual Totals
  const totalAnnualRev = monthlyData.reduce((acc, curr) => acc + curr.revenue, 0);
  const totalAnnualExp = monthlyData.reduce((acc, curr) => acc + curr.expenses, 0);
  const totalAnnualNet = totalAnnualRev - totalAnnualExp;

  const totalCat1 = monthlyData.reduce((acc, curr) => acc + curr.cat1, 0);

  // Render responsive Chart
  useEffect(() => {
    if (!chartRef.current) return;
    const ctx = chartRef.current.getContext('2d');
    if (!ctx) return;

    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
    }

    const months = monthlyData.map(d => d.month);

    let datasets: any[] = [];

    if (chartMode === 'cashflow') {
      datasets = [
        {
          type: 'bar',
          label: 'Revenue (Money In)',
          data: monthlyData.map(d => d.revenue),
          backgroundColor: '#00d4ff',
          borderRadius: 4,
          borderSkipped: false,
          barPercentage: 0.65,
          categoryPercentage: 0.75,
          order: 2
        },
        {
          type: 'bar',
          label: 'Expenses (Money Out)',
          data: monthlyData.map(d => d.expenses),
          backgroundColor: '#cebdff',
          borderRadius: 4,
          borderSkipped: false,
          barPercentage: 0.65,
          categoryPercentage: 0.75,
          order: 2
        },
        {
          type: 'line',
          label: 'Net Margin',
          data: monthlyData.map(d => d.net),
          borderColor: '#4ade80',
          backgroundColor: 'rgba(74, 222, 128, 0.1)',
          borderWidth: 2.5,
          pointBackgroundColor: '#4ade80',
          pointBorderColor: '#ffffff',
          pointRadius: 4,
          pointHoverRadius: 6,
          tension: 0.25,
          fill: false,
          order: 1
        }
      ];
    } else {
      datasets = [
        {
          type: 'bar',
          label: labelsConfig.cat1,
          data: monthlyData.map(d => d.cat1),
          backgroundColor: '#00d4ff',
          borderRadius: 4,
          barPercentage: 0.65,
          categoryPercentage: 0.75
        },
        {
          type: 'bar',
          label: labelsConfig.cat2,
          data: monthlyData.map(d => d.cat2),
          backgroundColor: '#cebdff',
          borderRadius: 4,
          barPercentage: 0.65,
          categoryPercentage: 0.75
        },
        {
          type: 'bar',
          label: labelsConfig.cat3,
          data: monthlyData.map(d => d.cat3),
          backgroundColor: '#a78bfa',
          borderRadius: 4,
          barPercentage: 0.65,
          categoryPercentage: 0.75
        },
        {
          type: 'bar',
          label: labelsConfig.cat4,
          data: monthlyData.map(d => d.cat4),
          backgroundColor: '#818cf8',
          borderRadius: 4,
          barPercentage: 0.65,
          categoryPercentage: 0.75
        }
      ];
    }

    const isLight = document.body.classList.contains('light-theme') || document.documentElement.getAttribute('data-theme') === 'light';

    chartInstanceRef.current = new ChartJS(ctx, {
      type: 'bar',
      data: {
        labels: months,
        datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        onClick: (_event: any, elements: any[]) => {
          if (elements.length > 0) {
            const index = elements[0].index;
            setSelectedMonthIndex(index);
          }
        },
        plugins: {
          legend: {
            position: 'top',
            labels: {
              color: isLight ? '#0f172a' : '#e5e2e1',
              font: { family: 'Plus Jakarta Sans', size: 12, weight: 600 },
              padding: 14,
              usePointStyle: true,
              pointStyle: 'rectRounded'
            }
          },
          tooltip: {
            backgroundColor: isLight ? '#ffffff' : '#0e0e12',
            borderColor: isLight ? '#cbd5e1' : 'rgba(0, 212, 255, 0.4)',
            borderWidth: 1,
            titleColor: isLight ? '#0f172a' : '#ffffff',
            titleFont: { family: 'Plus Jakarta Sans', size: 12, weight: 700 },
            bodyColor: isLight ? '#334155' : '#e5e2e1',
            bodyFont: { family: 'JetBrains Mono', size: 11 },
            padding: 12,
            callbacks: {
              label: (context: any) => {
                const val = context.parsed.y || 0;
                return ` ${context.dataset.label}: ${formatCurrency(val, currency)}`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { color: isLight ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.04)' },
            ticks: {
              color: isLight ? '#6366f1' : '#cebdff',
              font: { family: 'JetBrains Mono', size: 11, weight: 600 }
            }
          },
          y: {
            grid: { color: isLight ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.05)' },
            ticks: {
              color: isLight ? '#64748b' : '#9ca3af',
              font: { family: 'JetBrains Mono', size: 11 },
              callback: (value: any) => formatCurrency(Number(value), currency)
            }
          }
        }
      }
    });

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
      }
    };
  }, [currency, monthlyData, chartMode]);

  return (
    <div className="tab-view active" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header View */}
      <div className="view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-main, #fff)', margin: 0, fontFamily: 'Plus Jakarta Sans' }}>
            Operations &amp; Scalability Analytics
          </h2>
          <p className="subtitle" style={{ color: 'var(--text-muted, #9ca3af)', marginTop: '0.25rem' }}>
            Operational performance, unit economics, and financial insights.
          </p>
        </div>

        {/* Controls: Branch Scope & Timeframes */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
          {/* Branch Filter Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0, 212, 255, 0.08)', border: '1px solid rgba(0, 212, 255, 0.3)', borderRadius: '10px', padding: '4px 10px' }}>
            <span style={{ fontSize: '0.72rem', fontFamily: 'JetBrains Mono', color: '#00d4ff', fontWeight: 700 }}>
              <i className="fa-solid fa-code-branch" style={{ marginRight: '4px' }}></i> BRANCH:
            </span>
            <select
              value={branchFilter}
              onChange={e => setBranchFilter(e.target.value)}
              style={{
                background: 'var(--dropdown-bg, #141418)',
                color: 'var(--text-main, #fff)',
                border: 'none',
                fontSize: '0.85rem',
                fontWeight: 600,
                outline: 'none',
                cursor: 'pointer',
                padding: '4px 6px'
              }}
            >
              <option value="">All Branches</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>
                  {b.name} {b.is_main ? '· (HQ)' : ''}
                </option>
              ))}
            </select>
            {loadingAnalytics && (
              <i className="fa-solid fa-spinner fa-spin" style={{ color: '#00d4ff', fontSize: '0.75rem' }}></i>
            )}
          </div>

          {/* Timeframe Presets */}
          <div className="timeframe-selector" style={{ background: 'var(--glass-bg-hover, rgba(255, 255, 255, 0.05))', border: '1px solid var(--glass-border, rgba(255, 255, 255, 0.15))', padding: '4px' }}>
            <span style={{ fontSize: '0.7rem', fontFamily: 'JetBrains Mono', color: 'var(--text-muted, #9ca3af)', marginRight: '6px', alignSelf: 'center', paddingLeft: '6px' }}>SCOPE:</span>
            {(['24H', '7D', '30D', '1Y'] as const).map(tf => (
              <button 
                key={tf}
                className={`tf-btn ${timeframe === tf ? 'active' : ''}`} 
                onClick={() => setTimeframe(tf)}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* High-Level Financial & Scalability KPI Row */}
      {backendAnalytics && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
          {[
            { label: 'Total Revenue', value: formatCurrency(backendAnalytics.total_revenue || 0, currency), icon: 'fa-arrow-trend-up', color: '#4ade80' },
            { label: 'Operating Expenses', value: formatCurrency(backendAnalytics.total_expenses || 0, currency), icon: 'fa-arrow-trend-down', color: '#cebdff' },
            { label: 'Net Cash Balance', value: formatCurrency(backendAnalytics.cash_balance || 0, currency), icon: 'fa-wallet', color: (backendAnalytics.cash_balance || 0) >= 0 ? '#00d4ff' : '#f59e0b' },
            { label: 'Operating Margin', value: `${backendAnalytics.net_margin || 0}%`, icon: 'fa-percent', color: '#a78bfa' },
            { label: 'Projected Runway', value: `${backendAnalytics.projected_runway_months || 0} mos`, icon: 'fa-hourglass-half', color: '#3cd7ff' },
            { label: 'Stock Valuation', value: formatCurrency(backendAnalytics.inventory_summary?.total_valuation || 0, currency), icon: 'fa-boxes-stacked', color: '#fbbf24' },
          ].map(({ label, value, icon, color }) => (
            <div key={label} className="glass-card" style={{ padding: '16px', borderRadius: '12px', border: '1px solid var(--glass-border, rgba(255,255,255,0.07))' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <i className={`fa-solid ${icon}`} style={{ color, fontSize: '0.9rem' }}></i>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted, #9ca3af)', fontWeight: 600, textTransform: 'uppercase' }}>{label}</span>
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color, fontFamily: 'Plus Jakarta Sans' }}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* MULTI-BRANCH COMPARISON SECTION */}
      {!branchFilter && backendAnalytics?.branch_breakdown && backendAnalytics.branch_breakdown.length > 0 && (
        <div className="glass-card" style={{ padding: '24px', borderRadius: '16px', border: '1px solid rgba(0, 212, 255, 0.25)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main, #fff)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <i className="fa-solid fa-code-compare" style={{ color: '#00d4ff' }}></i>
                Branch Performance &amp; Scalability Comparison
              </h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted, #9ca3af)' }}>
                Cross-branch operational efficiency, revenue contribution share, and growth scalability ratings.
              </p>
            </div>
            {backendAnalytics.top_performing_branch && (
              <div style={{ padding: '6px 14px', borderRadius: '20px', background: 'rgba(74, 222, 128, 0.12)', border: '1px solid rgba(74, 222, 128, 0.35)', color: '#4ade80', fontSize: '0.78rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center' }}>
                <i className="fa-solid fa-trophy" style={{ color: '#fbbf24', marginRight: '6px' }}></i> Top Performer: {backendAnalytics.top_performing_branch}
              </div>
            )}
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--header-border, rgba(255,255,255,0.1))', color: 'var(--text-muted, #9ca3af)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <th style={{ padding: '10px 14px' }}>Branch</th>
                  <th style={{ padding: '10px 14px' }}>Location</th>
                  <th style={{ padding: '10px 14px' }}>Revenue</th>
                  <th style={{ padding: '10px 14px' }}>Expenses</th>
                  <th style={{ padding: '10px 14px' }}>Net Profit</th>
                  <th style={{ padding: '10px 14px' }}>Margin</th>
                  <th style={{ padding: '10px 14px' }}>Share of Business</th>
                  <th style={{ padding: '10px 14px' }}>Scalability Rating</th>
                </tr>
              </thead>
              <tbody>
                {backendAnalytics.branch_breakdown.map((b: any) => (
                  <tr key={b.branch_id} style={{ borderBottom: '1px solid var(--header-border, rgba(255,255,255,0.04))', transition: 'background 0.2s ease' }}>
                    <td style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--text-main, #fff)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <i className="fa-solid fa-store" style={{ color: '#00d4ff', fontSize: '0.85rem' }}></i>
                        {b.name}
                        {b.is_main && <span style={{ fontSize: '0.62rem', background: '#00d4ff20', color: '#00d4ff', padding: '1px 6px', borderRadius: '10px' }}>HQ</span>}
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px', color: 'var(--text-muted, #9ca3af)', fontSize: '0.8rem' }}>{b.location}</td>
                    <td style={{ padding: '12px 14px', color: '#4ade80', fontFamily: 'JetBrains Mono', fontWeight: 700 }}>{formatCurrency(b.revenue, currency)}</td>
                    <td style={{ padding: '12px 14px', color: '#cebdff', fontFamily: 'JetBrains Mono' }}>{formatCurrency(b.expenses, currency)}</td>
                    <td style={{ padding: '12px 14px', color: b.net_cash >= 0 ? '#00d4ff' : '#f59e0b', fontFamily: 'JetBrains Mono', fontWeight: 700 }}>{formatCurrency(b.net_cash, currency)}</td>
                    <td style={{ padding: '12px 14px', color: '#a78bfa', fontWeight: 600 }}>{b.margin_percent}%</td>
                    <td style={{ padding: '12px 14px', minWidth: '130px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ flex: 1, height: '6px', background: 'var(--header-divider, rgba(255,255,255,0.1))', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(100, b.revenue_share_percent)}%`, height: '100%', background: 'linear-gradient(90deg, #00d4ff, #a78bfa)', borderRadius: '3px' }} />
                        </div>
                        <span style={{ fontSize: '0.75rem', fontFamily: 'JetBrains Mono', color: 'var(--text-main, #e5e2e1)', width: '36px' }}>{b.revenue_share_percent}%</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{
                        fontSize: '0.72rem', padding: '3px 10px', borderRadius: '20px', fontWeight: 600,
                        background: b.scalability_badge === 'success' ? 'rgba(74, 222, 128, 0.15)' :
                          b.scalability_badge === 'cyan' ? 'rgba(0, 212, 255, 0.15)' :
                          b.scalability_badge === 'warning' ? 'rgba(251, 191, 36, 0.15)' : 'rgba(255, 142, 142, 0.15)',
                        color: b.scalability_badge === 'success' ? '#4ade80' :
                          b.scalability_badge === 'cyan' ? '#00d4ff' :
                          b.scalability_badge === 'warning' ? '#fbbf24' : '#ff8e8e',
                        border: '1px solid currentColor'
                      }}>
                        {b.scalability_grade}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Main Layout Grid: Left (Full Width Responsive Graph) | Right (Month Detail Inspector) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        
        {/* LEFT PANEL: 12-Month Performance Full-Width Responsive Graph */}
        <div className="glass-card" style={{ padding: '1.5rem', borderRadius: '1.1rem', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main, #ffffff)', fontFamily: 'Plus Jakarta Sans', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                <i className="fa-solid fa-chart-column" style={{ color: '#00d4ff' }}></i>
                Unit Economics &amp; Performance (12 Months)
              </h3>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted, #9ca3af)', marginTop: '2px', display: 'block' }}>
                Full-year monthly business performance with responsive timeline
              </span>
            </div>

            {/* Mode Switcher: Cash Flow vs Operating Cost Breakdown */}
            <div style={{ display: 'inline-flex', background: 'var(--glass-bg, rgba(255,255,255,0.06))', borderRadius: '8px', padding: '3px', border: '1px solid var(--glass-border, rgba(255,255,255,0.1))' }}>
              <button
                onClick={() => setChartMode('cashflow')}
                style={{
                  background: chartMode === 'cashflow' ? '#00d4ff' : 'transparent',
                  color: chartMode === 'cashflow' ? '#000' : 'var(--text-muted, #9ca3af)',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '5px 12px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <i className="fa-solid fa-money-bill-transfer"></i> Cash Flow
              </button>
              <button
                onClick={() => setChartMode('categories')}
                style={{
                  background: chartMode === 'categories' ? '#00d4ff' : 'transparent',
                  color: chartMode === 'categories' ? '#000' : 'var(--text-muted, #9ca3af)',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '5px 12px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <i className="fa-solid fa-chart-pie"></i> Cost Structure
              </button>
            </div>
          </div>

          {/* Clean, Full-Width Responsive Canvas Container */}
          <div style={{ width: '100%', height: '360px', position: 'relative' }}>
            <canvas ref={chartRef} />
          </div>

          {/* Annual Summary Stats Banner */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem', marginTop: '1.25rem' }}>
            <div style={{ background: 'rgba(0, 212, 255, 0.08)', padding: '0.75rem 1rem', borderRadius: '0.6rem', border: '1px solid rgba(0, 212, 255, 0.2)' }}>
              <div style={{ fontSize: '0.68rem', color: '#00d4ff', fontWeight: 600, textTransform: 'uppercase' }}>Annual Revenue</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main, #ffffff)', fontFamily: 'JetBrains Mono', marginTop: '0.2rem' }}>
                {formatCurrency(totalAnnualRev, currency)}
              </div>
            </div>

            <div style={{ background: 'rgba(206, 189, 255, 0.08)', padding: '0.75rem 1rem', borderRadius: '0.6rem', border: '1px solid rgba(206, 189, 255, 0.2)' }}>
              <div style={{ fontSize: '0.68rem', color: '#cebdff', fontWeight: 600, textTransform: 'uppercase' }}>Annual Expenses</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main, #ffffff)', fontFamily: 'JetBrains Mono', marginTop: '0.2rem' }}>
                {formatCurrency(totalAnnualExp, currency)}
              </div>
            </div>

            <div style={{ background: totalAnnualNet >= 0 ? 'rgba(74, 222, 128, 0.08)' : 'rgba(248, 113, 113, 0.08)', padding: '0.75rem 1rem', borderRadius: '0.6rem', border: `1px solid ${totalAnnualNet >= 0 ? 'rgba(74, 222, 128, 0.25)' : 'rgba(248, 113, 113, 0.25)'}` }}>
              <div style={{ fontSize: '0.68rem', color: totalAnnualNet >= 0 ? '#4ade80' : '#f87171', fontWeight: 600, textTransform: 'uppercase' }}>Annual Net Margin</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: totalAnnualNet >= 0 ? '#4ade80' : '#f87171', fontFamily: 'JetBrains Mono', marginTop: '0.2rem' }}>
                {totalAnnualNet >= 0 ? `+${formatCurrency(totalAnnualNet, currency)}` : formatCurrency(totalAnnualNet, currency)}
              </div>
            </div>

            <div style={{ background: 'rgba(167, 139, 250, 0.08)', padding: '0.75rem 1rem', borderRadius: '0.6rem', border: '1px solid rgba(167, 139, 250, 0.2)' }}>
              <div style={{ fontSize: '0.68rem', color: '#a78bfa', fontWeight: 600, textTransform: 'uppercase' }}>Direct Ops &amp; COGS</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main, #ffffff)', fontFamily: 'JetBrains Mono', marginTop: '0.2rem' }}>
                {formatCurrency(totalCat1, currency)}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT SIDEBAR: Selected Month Inspector & Monthly Log */}
        <div className="glass-card" style={{ padding: '1.5rem', borderRadius: '1.1rem', display: 'flex', flexDirection: 'column', height: 'fit-content' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--glass-border, rgba(255,255,255,0.08))', paddingBottom: '0.75rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main, #ffffff)', fontFamily: 'Plus Jakarta Sans', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
              <i className="fa-solid fa-calendar-check" style={{ color: '#00d4ff' }}></i>
              Month Inspector
            </h3>
            <span className="pill-tag cyan">CLICK CHART TO INSPECT</span>
          </div>

          {/* Selected Month Detail Card */}
          <div style={{ background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.12), rgba(167, 139, 250, 0.08))', border: '1px solid rgba(0, 212, 255, 0.3)', borderRadius: '0.75rem', padding: '1.1rem', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', fontFamily: 'JetBrains Mono', color: '#00d4ff', fontWeight: 700 }}>
                {selectedMonth.fullMonth}
              </span>
              <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '12px', background: selectedMonth.net >= 0 ? 'rgba(74,222,128,0.2)' : 'rgba(248,113,113,0.2)', color: selectedMonth.net >= 0 ? '#4ade80' : '#f87171', fontWeight: 600 }}>
                {selectedMonth.revenue > 0 ? (selectedMonth.net >= 0 ? 'Profitable' : 'Deficit') : 'No Volume'}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '12px' }}>
              <div style={{ background: 'var(--modal-msg-bg, rgba(0,0,0,0.25))', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--glass-border, transparent)' }}>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted, #9ca3af)', textTransform: 'uppercase' }}>Revenue</span>
                <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#00d4ff', fontFamily: 'JetBrains Mono' }}>
                  {formatCurrency(selectedMonth.revenue, currency)}
                </div>
              </div>
              <div style={{ background: 'var(--modal-msg-bg, rgba(0,0,0,0.25))', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--glass-border, transparent)' }}>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted, #9ca3af)', textTransform: 'uppercase' }}>Expenses</span>
                <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--primary-lilac-glow, #cebdff)', fontFamily: 'JetBrains Mono' }}>
                  {formatCurrency(selectedMonth.expenses, currency)}
                </div>
              </div>
            </div>

            <div style={{ marginTop: '10px', background: 'var(--modal-msg-bg, rgba(0,0,0,0.25))', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--glass-border, transparent)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted, #9ca3af)' }}>Net Profit / Margin:</span>
              <span style={{ fontSize: '1rem', fontWeight: 800, color: selectedMonth.net >= 0 ? '#4ade80' : '#f87171', fontFamily: 'JetBrains Mono' }}>
                {selectedMonth.net >= 0 ? `+${formatCurrency(selectedMonth.net, currency)}` : formatCurrency(selectedMonth.net, currency)}
              </span>
            </div>

            {/* Pillar Breakdown for Selected Month */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '12px', fontSize: '0.78rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--glass-border, rgba(255,255,255,0.06))', paddingBottom: '0.2rem' }}>
                <span style={{ color: 'var(--text-muted, #9ca3af)' }}>{labelsConfig.cat1}:</span>
                <span style={{ color: '#00d4ff', fontFamily: 'JetBrains Mono', fontWeight: 600 }}>{formatCurrency(selectedMonth.cat1, currency)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--glass-border, rgba(255,255,255,0.06))', paddingBottom: '0.2rem' }}>
                <span style={{ color: 'var(--text-muted, #9ca3af)' }}>{labelsConfig.cat2}:</span>
                <span style={{ color: 'var(--primary-lilac-glow, #cebdff)', fontFamily: 'JetBrains Mono', fontWeight: 600 }}>{formatCurrency(selectedMonth.cat2, currency)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--glass-border, rgba(255,255,255,0.06))', paddingBottom: '0.2rem' }}>
                <span style={{ color: 'var(--text-muted, #9ca3af)' }}>{labelsConfig.cat3}:</span>
                <span style={{ color: '#a78bfa', fontFamily: 'JetBrains Mono', fontWeight: 600 }}>{formatCurrency(selectedMonth.cat3, currency)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted, #9ca3af)' }}>{labelsConfig.cat4}:</span>
                <span style={{ color: '#818cf8', fontFamily: 'JetBrains Mono', fontWeight: 600 }}>{formatCurrency(selectedMonth.cat4, currency)}</span>
              </div>
            </div>
          </div>

          {/* Quick Month Selector Buttons */}
          <h4 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted, #9ca3af)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.65rem' }}>
            QUICK MONTH SELECTION
          </h4>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
            {monthlyData.map((rec, index) => {
              const isSelected = selectedMonthIndex === index;
              return (
                <button
                  key={rec.month}
                  onClick={() => setSelectedMonthIndex(index)}
                  style={{
                    padding: '8px 4px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    background: isSelected ? '#00d4ff' : 'var(--bg-surface-high, rgba(255, 255, 255, 0.04))',
                    color: isSelected ? '#000' : 'var(--text-main, #e5e2e1)',
                    border: isSelected ? '1px solid #00d4ff' : '1px solid var(--glass-border, rgba(255, 255, 255, 0.08))',
                    fontFamily: 'JetBrains Mono',
                    fontSize: '0.75rem',
                    fontWeight: isSelected ? 700 : 500,
                    transition: 'all 0.2s ease',
                    textAlign: 'center'
                  }}
                >
                  {rec.month}
                </button>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
};

export default BusinessAnalytics;
