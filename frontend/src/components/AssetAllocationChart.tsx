import React, { useEffect, useRef, useMemo } from 'react';
import ChartJS from 'chart.js/auto';
import { Currency } from '../types';
import { formatCurrency } from '../utils/currencyUtils';

interface AssetAllocationChartProps {
  transactions?: any[];
  currency?: Currency;
}

interface CategoryGroup {
  name: string;
  amount: number;
  color: string;
}

export const AssetAllocationChart: React.FC<AssetAllocationChartProps> = ({
  transactions = [],
  currency = 'USD'
}) => {
  const chartRef = useRef<HTMLCanvasElement | null>(null);
  const instanceRef = useRef<any>(null);

  // Group transactions into meaningful business operational categories
  const { categoryData, totalSpend, isExpenseData } = useMemo(() => {
    // Check if we have expense transactions first
    const expenses = transactions.filter((t: any) => t.type === 'Expense' || Number(t.amount) < 0);
    const useExpenses = expenses.length > 0;
    const targetTxns = useExpenses ? expenses : transactions;

    const buckets: Record<string, { amount: number; color: string }> = {
      'Operations & COGS': { amount: 0, color: '#00d4ff' },
      'Payroll & Staff': { amount: 0, color: '#cebdff' },
      'Cloud & Technology': { amount: 0, color: '#a78bfa' },
      'Logistics & Inventory': { amount: 0, color: '#fbbf24' },
      'Admin & Marketing': { amount: 0, color: '#818cf8' },
    };

    targetTxns.forEach((t: any) => {
      const amt = Math.abs(Number(t.amount) || 0);
      const cat = (t.category || '').toLowerCase();
      const cp = (t.counterparty || '').toLowerCase();

      if (/payroll|salary|wage|personnel|staff|bonus/i.test(cat) || /payroll|gusto/i.test(cp)) {
        buckets['Payroll & Staff'].amount += amt;
      } else if (/cloud|tech|aws|software|host|server|subscription|license/i.test(cat) || /aws|google|microsoft|stripe/i.test(cp)) {
        buckets['Cloud & Technology'].amount += amt;
      } else if (/inventory|stock|shipping|freight|warehouse|logistics|produce/i.test(cat)) {
        buckets['Logistics & Inventory'].amount += amt;
      } else if (/cogs|cost of goods|operations|equipment|merchandise|materials/i.test(cat)) {
        buckets['Operations & COGS'].amount += amt;
      } else {
        buckets['Admin & Marketing'].amount += amt;
      }
    });

    const activeGroups: CategoryGroup[] = Object.entries(buckets)
      .filter(([_, data]) => data.amount > 0)
      .map(([name, data]) => ({
        name,
        amount: data.amount,
        color: data.color
      }))
      .sort((a, b) => b.amount - a.amount);

    const sum = activeGroups.reduce((acc, g) => acc + g.amount, 0);

    return {
      categoryData: activeGroups,
      totalSpend: sum,
      isExpenseData: useExpenses
    };
  }, [transactions]);

  const hasData = totalSpend > 0;

  useEffect(() => {
    const canvas = chartRef.current;
    if (!canvas || !hasData) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (instanceRef.current) {
      instanceRef.current.destroy();
    }

    const isLight = document.body.classList.contains('light-theme') || document.documentElement.getAttribute('data-theme') === 'light';

    instanceRef.current = new ChartJS(ctx, {
      type: 'doughnut',
      data: {
        labels: categoryData.map(c => c.name),
        datasets: [
          {
            data: categoryData.map(c => c.amount),
            backgroundColor: categoryData.map(c => c.color),
            borderColor: isLight ? '#ffffff' : '#0e0e12',
            borderWidth: 3,
            hoverOffset: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '72%',
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: isLight ? '#ffffff' : '#0e0e12',
            titleColor: isLight ? '#0f172a' : '#ffffff',
            titleFont: { family: 'Plus Jakarta Sans', size: 12, weight: 700 },
            bodyColor: '#00d4ff',
            bodyFont: { family: 'JetBrains Mono', size: 11 },
            borderColor: isLight ? '#cbd5e1' : 'rgba(255, 255, 255, 0.15)',
            borderWidth: 1,
            padding: 10,
            callbacks: {
              label: (context: any) => {
                const val = context.parsed || 0;
                const pct = totalSpend > 0 ? ((val / totalSpend) * 100).toFixed(1) : '0';
                return ` ${context.label}: ${formatCurrency(val, currency)} (${pct}%)`;
              }
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
  }, [categoryData, totalSpend, hasData, currency]);

  return (
    <div className="glass-card chart-card-sm" style={{ padding: '20px 24px', borderRadius: '16px' }}>
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main, #fff)' }}>
            {isExpenseData ? 'Spending Breakdown by Category' : 'Volume Distribution by Category'}
          </h3>
          <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: 'var(--text-muted, #9ca3af)' }}>
            {isExpenseData ? 'Where your operational capital is spent' : 'Transaction categories across ledger'}
          </p>
        </div>
        <span className="pill-tag lilac" style={{ fontSize: '0.65rem' }}>
          {isExpenseData ? 'EXPENSES' : 'LEDGER'}
        </span>
      </div>

      {/* Doughnut Chart Canvas with Center Stat */}
      <div className="chart-wrapper-sm" style={{ position: 'relative', height: '170px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {hasData ? (
          <>
            <canvas ref={chartRef} />
            <div style={{
              position: 'absolute',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none'
            }}>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted, #9ca3af)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Total
              </span>
              <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main, #fff)', fontFamily: 'JetBrains Mono' }}>
                {formatCurrency(totalSpend, currency)}
              </span>
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '160px', color: '#64748b' }}>
            <i className="fa-solid fa-chart-pie" style={{ fontSize: '2rem', marginBottom: '0.75rem', opacity: 0.35, color: '#cebdff' }}></i>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted, #94a3b8)', marginBottom: '0.25rem' }}>No Categorized Data</div>
            <div style={{ fontSize: '0.75rem', textAlign: 'center', maxWidth: '240px', lineHeight: '1.4', color: 'var(--text-dim, #64748b)' }}>
              Add transactions with categories to view your operational spending distribution.
            </div>
          </div>
        )}
      </div>

      {/* Category Progress List */}
      <div className="spectrum-stats-list" style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {hasData ? (
          categoryData.map(c => {
            const pct = totalSpend > 0 ? ((c.amount / totalSpend) * 100).toFixed(0) : '0';
            return (
              <div key={c.name} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted, #e5e2e1)' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: c.color, flexShrink: 0 }}></span>
                    {c.name}
                  </span>
                  <span style={{ color: 'var(--text-main, #fff)', fontFamily: 'JetBrains Mono', fontWeight: 600 }}>
                    {formatCurrency(c.amount, currency)}{' '}
                    <span style={{ color: 'var(--text-dim, #9ca3af)', fontSize: '0.7rem', fontWeight: 400 }}>({pct}%)</span>
                  </span>
                </div>
                <div style={{ width: '100%', height: '4px', background: 'var(--header-divider, rgba(255,255,255,0.08))', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: c.color, borderRadius: '2px' }} />
                </div>
              </div>
            );
          })
        ) : (
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim, #64748b)', textAlign: 'center', padding: '8px 0' }}>
            Awaiting ledger records to calculate distribution
          </div>
        )}
      </div>

      <p style={{ fontSize: '0.7rem', color: 'var(--text-dim, #64748b)', marginTop: '14px', borderTop: '1px solid var(--glass-border, rgba(255,255,255,0.06))', paddingTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <i className="fa-solid fa-circle-info" style={{ color: '#00d4ff' }}></i>
        Calculated dynamically from active ledger transactions.
      </p>
    </div>
  );
};

export default AssetAllocationChart;
