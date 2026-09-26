import React, { useEffect, useRef, useState, useMemo } from 'react';
import ChartJS from 'chart.js/auto';
import { Currency, Transaction } from '../types';
import { formatCurrency } from '../utils/currencyUtils';

interface BusinessAnalyticsProps {
  currency?: Currency;
  transactions?: Transaction[];
  searchQuery?: string;
}

interface MonthlyRecord {
  month: string;
  fullMonth: string;
  cat1: number;
  cat2: number;
  cat3: number;
  cat4: number;
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

export const BusinessAnalytics: React.FC<BusinessAnalyticsProps> = ({ currency = 'USD', transactions = [], searchQuery = '' }) => {
  const chartRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstanceRef = useRef<any>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [timeframe, setTimeframe] = useState<'24H' | '7D' | '30D' | '1Y'>('1Y');
  const [selectedMonthIndex, setSelectedMonthIndex] = useState<number>(() => {
    const cur = new Date().getMonth();
    return cur >= 0 && cur <= 11 ? cur : 7;
  });

  const labelsConfig = {
    cat1: 'Direct Operations & COGS',
    cat2: 'Payroll & Personnel',
    cat3: 'Infrastructure & Technology',
    cat4: 'Growth & Administration',
    cat1Short: 'Direct Operations',
    cat2Short: 'Payroll',
    cat3Short: 'Technology',
    cat4Short: 'Growth & Admin'
  };

  // Filter transactions by active timeframe and search query
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
  }, [transactions, timeframe, searchQuery]);

  // Dynamically compute monthly records from real transactions
  const monthlyData: MonthlyRecord[] = useMemo(() => {
    const records: MonthlyRecord[] = MONTHS_CONFIG.map(m => ({
      month: m.month,
      fullMonth: m.fullMonth,
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
      const mIdx = d.getMonth();
      if (isNaN(mIdx) || mIdx < 0 || mIdx > 11) return;

      const amt = Math.abs(Number(t.amount) || 0);
      const cat = (t.category || '').toLowerCase();
      const cp = (t.counterparty || '').toLowerCase();

      if (/cogs|cost of goods|inventory|produce|materials|merchandise|order/i.test(cat)) {
        records[mIdx].cat1 += amt;
      } else if (/payroll|salary|wage|personnel|staff|compensation/i.test(cat) || /payroll|gusto/i.test(cp)) {
        records[mIdx].cat2 += amt;
      } else if (/infra|tech|cloud|aws|hosting|server|kubernetes|hardware|software|subscription/i.test(cat) || /aws|amazon|google|stripe/i.test(cp)) {
        records[mIdx].cat3 += amt;
      } else {
        records[mIdx].cat4 += amt;
      }
    });

    return records;
  }, [effectiveTransactions]);

  const hasAnyData = useMemo(() => {
    return monthlyData.some(m => m.cat1 > 0 || m.cat2 > 0 || m.cat3 > 0 || m.cat4 > 0);
  }, [monthlyData]);

  const selectedMonth = monthlyData[selectedMonthIndex] || monthlyData[0];

  useEffect(() => {
    if (!chartRef.current) return;
    const ctx = chartRef.current.getContext('2d');
    if (!ctx) return;

    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
    }

    const months = monthlyData.map(d => d.month);
    const cat1Data = monthlyData.map(d => d.cat1);
    const cat2Data = monthlyData.map(d => d.cat2);
    const cat3Data = monthlyData.map(d => d.cat3);
    const cat4Data = monthlyData.map(d => d.cat4);

    chartInstanceRef.current = new ChartJS(ctx, {
      type: 'bar',
      data: {
        labels: months,
        datasets: [
          {
            label: labelsConfig.cat1,
            data: cat1Data,
            backgroundColor: '#cebdff',
            borderRadius: 6,
            barPercentage: 0.75,
            categoryPercentage: 0.8
          },
          {
            label: labelsConfig.cat2,
            data: cat2Data,
            backgroundColor: '#00d4ff',
            borderRadius: 6,
            barPercentage: 0.75,
            categoryPercentage: 0.8
          },
          {
            label: labelsConfig.cat3,
            data: cat3Data,
            backgroundColor: '#a78bfa',
            borderRadius: 6,
            barPercentage: 0.75,
            categoryPercentage: 0.8
          },
          {
            label: labelsConfig.cat4,
            data: cat4Data,
            backgroundColor: '#818cf8',
            borderRadius: 6,
            barPercentage: 0.75,
            categoryPercentage: 0.8
          }
        ]
      },
      options: {
        responsive: false,
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
              color: '#e5e2e1',
              font: { family: 'Plus Jakarta Sans', size: 12, weight: 600 },
              padding: 16,
              usePointStyle: true,
              pointStyle: 'rectRounded'
            }
          },
          tooltip: {
            backgroundColor: '#0a0a0a',
            borderColor: 'rgba(0, 212, 255, 0.4)',
            borderWidth: 1,
            titleColor: '#ffffff',
            titleFont: { family: 'Plus Jakarta Sans', size: 13, weight: 700 },
            bodyColor: '#e5e2e1',
            bodyFont: { family: 'JetBrains Mono', size: 12 },
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
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: {
              color: '#cebdff',
              font: { family: 'JetBrains Mono', size: 12, weight: 600 }
            }
          },
          y: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
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
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
      }
    };
  }, [currency, monthlyData]);

  // Scroll helper functions
  const handleScrollToRange = (startIndex: number) => {
    if (scrollContainerRef.current) {
      const containerWidth = scrollContainerRef.current.clientWidth;
      const scrollPos = (startIndex / 12) * (1100 - containerWidth + 60);
      scrollContainerRef.current.scrollTo({ left: scrollPos, behavior: 'smooth' });
    }
  };

  const selectedMonthTotal = selectedMonth.cat1 + selectedMonth.cat2 + selectedMonth.cat3 + selectedMonth.cat4;

  // Annual Totals
  const totalCat1 = monthlyData.reduce((acc, curr) => acc + curr.cat1, 0);
  const totalCat2 = monthlyData.reduce((acc, curr) => acc + curr.cat2, 0);
  const totalCat3 = monthlyData.reduce((acc, curr) => acc + curr.cat3, 0);
  const totalCat4 = monthlyData.reduce((acc, curr) => acc + curr.cat4, 0);
  const grandAnnualTotal = totalCat1 + totalCat2 + totalCat3 + totalCat4;

  return (
    <div className="tab-view active">
      {/* Header View */}
      <div className="view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span className="pill-tag cyan">PERFORMANCE DATA</span>
            <span className="pill-tag lilac">BUSINESS UNIT OVERVIEW</span>
          </div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#fff', margin: 0, fontFamily: 'Plus Jakarta Sans' }}>
            Business Financial Performance
          </h2>
          <p className="subtitle" style={{ color: '#9ca3af', marginTop: '0.25rem' }}>
            Financial performance and cost breakdowns extracted from real ledger transactions
          </p>
        </div>

        {/* Timeframe presets and Quarter View */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
          <div className="timeframe-selector" style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.15)', padding: '4px' }}>
            <span style={{ fontSize: '0.7rem', fontFamily: 'JetBrains Mono', color: '#9ca3af', marginRight: '6px', alignSelf: 'center', paddingLeft: '6px' }}>TIMEFRAME:</span>
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

          <div className="timeframe-selector" style={{ background: 'rgba(0, 212, 255, 0.08)', border: '1px solid rgba(0, 212, 255, 0.25)', padding: '4px' }}>
            <span style={{ fontSize: '0.7rem', fontFamily: 'JetBrains Mono', color: '#9ca3af', marginRight: '6px', alignSelf: 'center', paddingLeft: '6px' }}>VIEW:</span>
            <button className="tf-btn" onClick={() => handleScrollToRange(0)}>Q1 (Jan-Apr)</button>
            <button className="tf-btn" onClick={() => handleScrollToRange(4)}>Q2/Q3 (May-Aug)</button>
            <button className="tf-btn" onClick={() => handleScrollToRange(8)}>Q4 (Sep-Dec)</button>
          </div>
        </div>
      </div>

      {/* Real data notification banner if no transactions logged yet */}
      {!hasAnyData && (
        <div style={{
          background: 'rgba(0, 212, 255, 0.06)',
          border: '1px solid rgba(0, 212, 255, 0.25)',
          borderRadius: '0.85rem',
          padding: '1rem 1.25rem',
          marginBottom: '1.25rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.85rem'
        }}>
          <i className="fa-solid fa-circle-info" style={{ color: '#00d4ff', fontSize: '1.2rem', flexShrink: 0 }}></i>
          <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
            <strong style={{ color: '#fff' }}>No transaction records for the current year yet.</strong> As you log revenue and expenses in the Ledger, this dashboard dynamically aggregates and visualizes your monthly business unit metrics.
          </div>
        </div>
      )}

      {/* Main Layout Grid (Left: 12-Month Scrollable Graph | Right: Historical Data Sidebar) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
        
        {/* LEFT PANEL: 12-Month Performance Scrollable Graph */}
        <div className="glass-card" style={{ padding: '1.5rem', borderRadius: '1.1rem', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#ffffff', fontFamily: 'Plus Jakarta Sans', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <i className="fa-solid fa-chart-simple" style={{ color: '#00d4ff' }}></i>
                Business Unit Performance (12 Months)
              </h3>
              <span style={{ fontSize: '0.78rem', color: '#9ca3af' }}>
                Showing <strong>4 months visible at a time</strong>. Scroll horizontally or drag to inspect all 12 months.
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', fontFamily: 'JetBrains Mono', color: '#00d4ff' }}>
              <i className="fa-solid fa-arrows-left-right"></i> Scrollable Graph
            </div>
          </div>

          {/* Scrollable Canvas Container */}
          <div 
            ref={scrollContainerRef}
            style={{ 
              width: '100%', 
              overflowX: 'auto', 
              overflowY: 'hidden', 
              paddingBottom: '0.75rem',
              borderRadius: '0.75rem',
              border: '1px solid rgba(255,255,255,0.06)',
              background: 'rgba(0,0,0,0.4)',
              scrollbarWidth: 'thin',
              scrollbarColor: '#00d4ff rgba(255,255,255,0.05)'
            }}
          >
            <div style={{ width: '1100px', height: '360px', padding: '1rem 0.5rem' }}>
              <canvas ref={chartRef} width={1080} height={340} />
            </div>
          </div>

          {/* Annual Summary Stats Banner */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', marginTop: '1.25rem' }}>
            <div style={{ background: 'rgba(206, 189, 255, 0.08)', padding: '0.75rem', borderRadius: '0.6rem', border: '1px solid rgba(206, 189, 255, 0.2)' }}>
              <div style={{ fontSize: '0.7rem', color: '#cebdff', fontWeight: 600, textTransform: 'uppercase' }}>{labelsConfig.cat1Short}</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#ffffff', fontFamily: 'JetBrains Mono', marginTop: '0.2rem' }}>
                {formatCurrency(totalCat1, currency)}
              </div>
            </div>

            <div style={{ background: 'rgba(0, 212, 255, 0.08)', padding: '0.75rem', borderRadius: '0.6rem', border: '1px solid rgba(0, 212, 255, 0.2)' }}>
              <div style={{ fontSize: '0.7rem', color: '#00d4ff', fontWeight: 600, textTransform: 'uppercase' }}>{labelsConfig.cat2Short}</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#ffffff', fontFamily: 'JetBrains Mono', marginTop: '0.2rem' }}>
                {formatCurrency(totalCat2, currency)}
              </div>
            </div>

            <div style={{ background: 'rgba(167, 139, 250, 0.08)', padding: '0.75rem', borderRadius: '0.6rem', border: '1px solid rgba(167, 139, 250, 0.2)' }}>
              <div style={{ fontSize: '0.7rem', color: '#a78bfa', fontWeight: 600, textTransform: 'uppercase' }}>{labelsConfig.cat3Short}</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#ffffff', fontFamily: 'JetBrains Mono', marginTop: '0.2rem' }}>
                {formatCurrency(totalCat3, currency)}
              </div>
            </div>

            <div style={{ background: 'rgba(129, 140, 248, 0.08)', padding: '0.75rem', borderRadius: '0.6rem', border: '1px solid rgba(129, 140, 248, 0.2)' }}>
              <div style={{ fontSize: '0.7rem', color: '#818cf8', fontWeight: 600, textTransform: 'uppercase' }}>{labelsConfig.cat4Short}</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#ffffff', fontFamily: 'JetBrains Mono', marginTop: '0.2rem' }}>
                {formatCurrency(totalCat4, currency)}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT SIDEBAR: Historical Data Panel */}
        <div className="glass-card" style={{ padding: '1.5rem', borderRadius: '1.1rem', display: 'flex', flexDirection: 'column', height: 'fit-content' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.75rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#ffffff', fontFamily: 'Plus Jakarta Sans', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
              <i className="fa-solid fa-clock-rotate-left" style={{ color: '#a78bfa' }}></i>
              Historical Data Sidebar
            </h3>
            <span className="pill-tag lilac">12 MONTHS RECORD</span>
          </div>

          {/* Selected Month Inspector Card */}
          <div style={{ background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.12), rgba(167, 139, 250, 0.1))', border: '1px solid rgba(0, 212, 255, 0.3)', borderRadius: '0.75rem', padding: '1rem', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', fontFamily: 'JetBrains Mono', color: '#00d4ff', fontWeight: 700 }}>
                {selectedMonth.fullMonth}
              </span>
              <span className="pill-tag cyan" style={{ fontSize: '0.65rem' }}>SELECTED</span>
            </div>
            
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ffffff', fontFamily: 'JetBrains Mono', marginTop: '0.35rem' }}>
              {formatCurrency(selectedMonthTotal, currency)}
            </div>
            <span style={{ fontSize: '0.72rem', color: '#9ca3af' }}>Combined Monthly Performance</span>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.75rem', fontSize: '0.8rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.2rem' }}>
                <span style={{ color: '#9ca3af' }}>{labelsConfig.cat1Short}:</span>
                <span style={{ color: '#cebdff', fontFamily: 'JetBrains Mono', fontWeight: 600 }}>{formatCurrency(selectedMonth.cat1, currency)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.2rem' }}>
                <span style={{ color: '#9ca3af' }}>{labelsConfig.cat2Short}:</span>
                <span style={{ color: '#00d4ff', fontFamily: 'JetBrains Mono', fontWeight: 600 }}>{formatCurrency(selectedMonth.cat2, currency)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.2rem' }}>
                <span style={{ color: '#9ca3af' }}>{labelsConfig.cat3Short}:</span>
                <span style={{ color: '#a78bfa', fontFamily: 'JetBrains Mono', fontWeight: 600 }}>{formatCurrency(selectedMonth.cat3, currency)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#9ca3af' }}>{labelsConfig.cat4Short}:</span>
                <span style={{ color: '#818cf8', fontFamily: 'JetBrains Mono', fontWeight: 600 }}>{formatCurrency(selectedMonth.cat4, currency)}</span>
              </div>
            </div>
          </div>

          {/* Historical 12 Months Scroll List */}
          <h4 style={{ fontSize: '0.82rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>
            MONTHLY HISTORICAL LOG (JAN - DEC)
          </h4>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '320px', overflowY: 'auto', paddingRight: '4px' }}>
            {monthlyData.map((rec, index) => {
              const monthSum = rec.cat1 + rec.cat2 + rec.cat3 + rec.cat4;
              const isSelected = selectedMonthIndex === index;
              return (
                <div
                  key={rec.month}
                  onClick={() => setSelectedMonthIndex(index)}
                  style={{
                    padding: '0.7rem 0.85rem',
                    borderRadius: '0.6rem',
                    cursor: 'pointer',
                    background: isSelected ? 'rgba(0, 212, 255, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                    border: isSelected ? '1px solid #00d4ff' : '1px solid rgba(255, 255, 255, 0.05)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: isSelected ? '#ffffff' : '#e5e2e1' }}>
                      {rec.month} - {rec.fullMonth.split(' ')[0]}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '0.1rem' }}>
                      {labelsConfig.cat1Short}: {formatCurrency(rec.cat1, currency)} • {labelsConfig.cat2Short}: {formatCurrency(rec.cat2, currency)}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: isSelected ? '#00d4ff' : '#cebdff', fontFamily: 'JetBrains Mono' }}>
                      {formatCurrency(monthSum, currency)}
                    </div>
                    <span style={{ fontSize: '0.65rem', color: monthSum > 0 ? '#4ade80' : '#64748b' }}>
                      {monthSum > 0 ? 'Verified' : 'No Data'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>Grand Annual Total:</span>
            <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#00d4ff', fontFamily: 'JetBrains Mono' }}>
              {formatCurrency(grandAnnualTotal, currency)}
            </span>
          </div>
        </div>

      </div>
    </div>
  );
};
