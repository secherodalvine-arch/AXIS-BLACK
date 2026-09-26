import React, { useEffect, useRef } from 'react';
import ChartJS from 'chart.js/auto';
import { Currency } from '../types';
import { formatCurrency } from '../utils/currencyUtils';

interface FinancialGrowthChartProps {
  transactions?: any[];
  currency?: Currency;
}

export const FinancialGrowthChart: React.FC<FinancialGrowthChartProps> = ({ transactions = [], currency = 'USD' }) => {
  const chartRef = useRef<HTMLCanvasElement | null>(null);
  const instanceRef = useRef<any>(null);

  const hasTransactions = transactions && transactions.length > 0;

  useEffect(() => {
    const canvas = chartRef.current;
    if (!canvas || !hasTransactions) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Create glowing gradients
    const gradCyan = ctx.createLinearGradient(0, 0, 0, 300);
    gradCyan.addColorStop(0, 'rgba(0, 212, 255, 0.35)');
    gradCyan.addColorStop(1, 'rgba(0, 212, 255, 0.0)');

    const gradLilac = ctx.createLinearGradient(0, 0, 0, 300);
    gradLilac.addColorStop(0, 'rgba(206, 189, 255, 0.25)');
    gradLilac.addColorStop(1, 'rgba(206, 189, 255, 0.0)');

    if (instanceRef.current) {
      instanceRef.current.destroy();
    }

    const currentMonthIdx = new Date().getMonth();
    const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].slice(0, Math.max(6, currentMonthIdx + 1));
    
    const revenueData = new Array(monthLabels.length).fill(0);
    const expenseData = new Array(monthLabels.length).fill(0);
    const netMarginData = new Array(monthLabels.length).fill(0);

    const currentYear = new Date().getFullYear();
    transactions.forEach((t: any) => {
      if (!t.date) return;
      const d = new Date(t.date);
      if (isNaN(d.getTime())) return;
      if (d.getFullYear() !== currentYear) return;
      const mIdx = d.getMonth();
      if (mIdx >= 0 && mIdx < monthLabels.length) {
        const amt = Number(t.amount) || 0;
        if (amt > 0) {
          revenueData[mIdx] += amt;
        } else {
          expenseData[mIdx] += Math.abs(amt);
        }
      }
    });

    for (let i = 0; i < monthLabels.length; i++) {
      netMarginData[i] = revenueData[i] - expenseData[i];
    }

    instanceRef.current = new ChartJS(ctx, {
      type: 'line',
      data: {
        labels: monthLabels,
        datasets: [
          {
            label: 'Revenue Stream',
            data: revenueData,
            borderColor: '#00d4ff',
            backgroundColor: gradCyan,
            fill: true,
            tension: 0.4,
            borderWidth: 3,
            pointBackgroundColor: '#00d4ff',
            pointBorderColor: '#ffffff',
            pointHoverRadius: 6
          },
          {
            label: 'Net Margin',
            data: netMarginData,
            borderColor: '#cebdff',
            backgroundColor: gradLilac,
            fill: true,
            tension: 0.4,
            borderWidth: 2,
            pointBackgroundColor: '#cebdff',
            pointHoverRadius: 5
          },
          {
            label: 'OpEx Expenses',
            data: expenseData,
            borderColor: '#a78bfa',
            borderDash: [5, 5],
            fill: false,
            tension: 0.3,
            borderWidth: 2,
            pointRadius: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#131315',
            titleColor: '#ffffff',
            bodyColor: '#cebdff',
            borderColor: 'rgba(255,255,255,0.15)',
            borderWidth: 1,
            padding: 12,
            displayColors: true,
            callbacks: {
              label: (context: any) => ` ${context.dataset.label}: ${formatCurrency(context.parsed.y, currency)}`
            }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.04)' },
            ticks: { color: '#9ca3af', font: { family: 'JetBrains Mono', size: 11 } }
          },
          y: {
            grid: { color: 'rgba(255, 255, 255, 0.04)' },
            ticks: {
              color: '#9ca3af',
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
  }, [transactions, currency, hasTransactions]);

  return (
    <div className="glass-card chart-container-card">
      <div className="card-header">
        <div className="card-title-group">
          <h3>Financial Performance &amp; Growth</h3>
          <p className="subtitle">
            {hasTransactions 
              ? 'Revenue, margin, and expenditure trends calculated from your ledger' 
              : 'Add transactions to see growth curves and metrics'}
          </p>
        </div>
        <div className="card-actions">
          <div className="chart-legend-custom">
            <span className="legend-item"><span className="color-dot dot-cyan"></span> Revenue</span>
            <span className="legend-item"><span className="color-dot dot-lilac"></span> Net Margin</span>
            <span className="legend-item"><span className="color-dot" style={{ background: '#a78bfa' }}></span> Expenses</span>
          </div>
        </div>
      </div>
      <div className="chart-wrapper" style={{ minHeight: '260px' }}>
        {hasTransactions ? (
          <canvas ref={chartRef} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '240px', color: '#64748b' }}>
            <i className="fa-solid fa-chart-line" style={{ fontSize: '2.5rem', marginBottom: '1rem', opacity: 0.35, color: '#00d4ff' }}></i>
            <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.35rem' }}>No Financial Data Recorded Yet</div>
            <div style={{ fontSize: '0.82rem', maxWidth: '440px', textAlign: 'center', lineHeight: '1.45' }}>
              As you record revenue and expenses in the Ledger, this chart dynamically plots your revenue stream, operating expenses, and net margins.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
