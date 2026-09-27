import React, { useEffect, useRef, useState, useMemo } from 'react';
import ChartJS from 'chart.js/auto';
import { Currency } from '../types';
import { formatCurrency } from '../utils/currencyUtils';

interface FinancialGrowthChartProps {
  transactions?: any[];
  currency?: Currency;
}

const ALL_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const FinancialGrowthChart: React.FC<FinancialGrowthChartProps> = ({
  transactions = [],
  currency = 'USD'
}) => {
  const chartRef = useRef<HTMLCanvasElement | null>(null);
  const instanceRef = useRef<any>(null);
  const [viewRange, setViewRange] = useState<'6M' | '12M'>('6M');

  const hasTransactions = transactions && transactions.length > 0;
  const currentYear = new Date().getFullYear();
  const currentMonthIdx = new Date().getMonth();

  // Compute monthly data
  const { monthLabels, revenueData, expenseData, netMarginData, totalRevenue, totalExpenses, totalNetMargin } = useMemo(() => {
    let labels: string[];
    let startIdx = 0;

    if (viewRange === '6M') {
      // Last 6 months up to current or min 6
      const end = Math.min(11, Math.max(5, currentMonthIdx));
      startIdx = Math.max(0, end - 5);
      labels = ALL_MONTHS.slice(startIdx, startIdx + 6);
    } else {
      labels = [...ALL_MONTHS];
      startIdx = 0;
    }

    const rev = new Array(labels.length).fill(0);
    const exp = new Array(labels.length).fill(0);
    const net = new Array(labels.length).fill(0);

    transactions.forEach((t: any) => {
      if (!t.date) return;
      const d = new Date(t.date);
      if (isNaN(d.getTime())) return;
      if (d.getFullYear() !== currentYear) return;
      const mIdx = d.getMonth();

      const labelIdx = viewRange === '6M' ? mIdx - startIdx : mIdx;
      if (labelIdx >= 0 && labelIdx < labels.length) {
        const amt = Number(t.amount) || 0;
        if (amt > 0) {
          rev[labelIdx] += amt;
        } else {
          exp[labelIdx] += Math.abs(amt);
        }
      }
    });

    for (let i = 0; i < labels.length; i++) {
      net[i] = rev[i] - exp[i];
    }

    const totRev = rev.reduce((a, b) => a + b, 0);
    const totExp = exp.reduce((a, b) => a + b, 0);
    const totNet = totRev - totExp;

    return {
      monthLabels: labels,
      revenueData: rev,
      expenseData: exp,
      netMarginData: net,
      totalRevenue: totRev,
      totalExpenses: totExp,
      totalNetMargin: totNet
    };
  }, [transactions, viewRange, currentMonthIdx, currentYear]);

  useEffect(() => {
    const canvas = chartRef.current;
    if (!canvas || !hasTransactions) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (instanceRef.current) {
      instanceRef.current.destroy();
    }

    const isLight = document.body.classList.contains('light-theme') || document.documentElement.getAttribute('data-theme') === 'light';

    instanceRef.current = new ChartJS(ctx, {
      type: 'bar',
      data: {
        labels: monthLabels,
        datasets: [
          {
            type: 'bar',
            label: 'Revenue (Money In)',
            data: revenueData,
            backgroundColor: '#00d4ff',
            borderRadius: 5,
            borderSkipped: false,
            barPercentage: 0.65,
            categoryPercentage: 0.7,
            order: 2
          },
          {
            type: 'bar',
            label: 'Expenses (Money Out)',
            data: expenseData,
            backgroundColor: '#cebdff',
            borderRadius: 5,
            borderSkipped: false,
            barPercentage: 0.65,
            categoryPercentage: 0.7,
            order: 2
          },
          {
            type: 'line',
            label: 'Net Profit',
            data: netMarginData,
            borderColor: '#4ade80',
            backgroundColor: 'rgba(74, 222, 128, 0.1)',
            borderWidth: 2.5,
            pointBackgroundColor: '#4ade80',
            pointBorderColor: isLight ? '#ffffff' : '#0e0e12',
            pointRadius: 4,
            pointHoverRadius: 6,
            tension: 0.25,
            fill: false,
            order: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: isLight ? '#ffffff' : '#0e0e12',
            titleColor: isLight ? '#0f172a' : '#ffffff',
            titleFont: { family: 'Plus Jakarta Sans', size: 12, weight: 700 },
            bodyColor: isLight ? '#334155' : '#e5e2e1',
            bodyFont: { family: 'JetBrains Mono', size: 11 },
            borderColor: isLight ? '#cbd5e1' : 'rgba(255, 255, 255, 0.15)',
            borderWidth: 1,
            padding: 12,
            callbacks: {
              label: (context: any) => {
                const label = context.dataset.label || '';
                const val = context.parsed.y || 0;
                return ` ${label}: ${formatCurrency(val, currency)}`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { color: isLight ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.04)' },
            ticks: {
              color: isLight ? '#64748b' : '#9ca3af',
              font: { family: 'JetBrains Mono', size: 11 }
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
      if (instanceRef.current) {
        instanceRef.current.destroy();
      }
    };
  }, [revenueData, expenseData, netMarginData, monthLabels, currency, hasTransactions]);

  const netMarginPct = totalRevenue > 0 ? ((totalNetMargin / totalRevenue) * 100).toFixed(1) : '0.0';

  return (
    <div className="glass-card chart-container-card" style={{ padding: '20px 24px', borderRadius: '16px' }}>
      {/* Header with Title, Quick KPI Pills, Range Toggle, and Legend */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', marginBottom: '18px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="pill-tag cyan" style={{ fontSize: '0.65rem' }}>CASH FLOW OVERVIEW</span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted, #9ca3af)', fontFamily: 'JetBrains Mono' }}>{currentYear} FISCAL YEAR</span>
          </div>
          <h3 style={{ margin: '4px 0 0 0', fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main, #fff)', fontFamily: 'Plus Jakarta Sans' }}>
            Financial Performance &amp; Cash Flow
          </h3>
          <p className="subtitle" style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted, #9ca3af)' }}>
            Monthly comparison of money received (Revenue) versus money paid out (Expenses)
          </p>
        </div>

        {/* Range Toggle & Legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          {/* Legend Items */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.75rem', color: 'var(--text-muted, #e5e2e1)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#00d4ff' }}></span>
              Revenue
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#cebdff' }}></span>
              Expenses
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#4ade80', fontWeight: 600 }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4ade80' }}></span>
              Net Profit
            </span>
          </div>

          {/* Range Button Group */}
          <div style={{ display: 'inline-flex', background: 'var(--glass-bg-hover, rgba(255,255,255,0.06))', borderRadius: '8px', padding: '2px', border: '1px solid var(--glass-border, rgba(255,255,255,0.1))' }}>
            <button
              onClick={() => setViewRange('6M')}
              style={{
                background: viewRange === '6M' ? '#00d4ff' : 'transparent',
                color: viewRange === '6M' ? '#000' : 'var(--text-muted, #9ca3af)',
                border: 'none',
                borderRadius: '6px',
                padding: '4px 10px',
                fontSize: '0.72rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              6 Months
            </button>
            <button
              onClick={() => setViewRange('12M')}
              style={{
                background: viewRange === '12M' ? '#00d4ff' : 'transparent',
                color: viewRange === '12M' ? '#000' : 'var(--text-muted, #9ca3af)',
                border: 'none',
                borderRadius: '6px',
                padding: '4px 10px',
                fontSize: '0.72rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              Full Year
            </button>
          </div>
        </div>
      </div>

      {/* Summary KPI Strip Above Chart */}
      {hasTransactions && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', marginBottom: '16px' }}>
          <div style={{ background: 'rgba(0, 212, 255, 0.08)', border: '1px solid rgba(0, 212, 255, 0.25)', borderRadius: '10px', padding: '10px 14px' }}>
            <div style={{ fontSize: '0.7rem', color: '#00d4ff', fontWeight: 600, textTransform: 'uppercase' }}>Period Revenue</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main, #fff)', fontFamily: 'JetBrains Mono', marginTop: '2px' }}>
              {formatCurrency(totalRevenue, currency)}
            </div>
          </div>

          <div style={{ background: 'rgba(206, 189, 255, 0.08)', border: '1px solid rgba(206, 189, 255, 0.25)', borderRadius: '10px', padding: '10px 14px' }}>
            <div style={{ fontSize: '0.7rem', color: '#cebdff', fontWeight: 600, textTransform: 'uppercase' }}>Period Expenses</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main, #fff)', fontFamily: 'JetBrains Mono', marginTop: '2px' }}>
              {formatCurrency(totalExpenses, currency)}
            </div>
          </div>

          <div style={{ background: totalNetMargin >= 0 ? 'rgba(74, 222, 128, 0.08)' : 'rgba(248, 113, 113, 0.08)', border: `1px solid ${totalNetMargin >= 0 ? 'rgba(74, 222, 128, 0.25)' : 'rgba(248, 113, 113, 0.25)'}`, borderRadius: '10px', padding: '10px 14px' }}>
            <div style={{ fontSize: '0.7rem', color: totalNetMargin >= 0 ? '#4ade80' : '#f87171', fontWeight: 600, textTransform: 'uppercase' }}>
              Net Profit ({netMarginPct}%)
            </div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: totalNetMargin >= 0 ? '#4ade80' : '#f87171', fontFamily: 'JetBrains Mono', marginTop: '2px' }}>
              {totalNetMargin >= 0 ? `+${formatCurrency(totalNetMargin, currency)}` : formatCurrency(totalNetMargin, currency)}
            </div>
          </div>
        </div>
      )}

      {/* Chart Canvas Area */}
      <div className="chart-wrapper" style={{ height: '280px', position: 'relative' }}>
        {hasTransactions ? (
          <canvas ref={chartRef} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '240px', color: '#64748b' }}>
            <i className="fa-solid fa-chart-column" style={{ fontSize: '2.5rem', marginBottom: '1rem', opacity: 0.35, color: '#00d4ff' }}></i>
            <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.35rem' }}>No Transactions Recorded Yet</div>
            <div style={{ fontSize: '0.82rem', maxWidth: '440px', textAlign: 'center', lineHeight: '1.45' }}>
              As you record revenue and expenses in the Ledger, this chart automatically visualizes your monthly cash flow, operating costs, and net margins.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FinancialGrowthChart;
