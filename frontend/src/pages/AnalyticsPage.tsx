import React, { useEffect, useRef, useState } from 'react';
import ChartJS from 'chart.js/auto';
import { Currency } from '../types';
import { formatCurrency } from '../utils/currencyUtils';

interface BusinessAnalyticsProps {
  currency?: Currency;
}

interface MonthlyRecord {
  month: string;
  fullMonth: string;
  engineering: number;
  sales: number;
  cloud: number;
  operations: number;
}

const MONTHLY_BUSINESS_UNIT_DATA: MonthlyRecord[] = [
  { month: 'Jan', fullMonth: 'January 2026', engineering: 180000, sales: 120000, cloud: 80000, operations: 60000 },
  { month: 'Feb', fullMonth: 'February 2026', engineering: 195000, sales: 135000, cloud: 85000, operations: 65000 },
  { month: 'Mar', fullMonth: 'March 2026', engineering: 210000, sales: 150000, cloud: 95000, operations: 72000 },
  { month: 'Apr', fullMonth: 'April 2026', engineering: 225000, sales: 170000, cloud: 102000, operations: 78000 },
  { month: 'May', fullMonth: 'May 2026', engineering: 240000, sales: 190000, cloud: 110000, operations: 85000 },
  { month: 'Jun', fullMonth: 'June 2026', engineering: 255000, sales: 205000, cloud: 118000, operations: 90000 },
  { month: 'Jul', fullMonth: 'July 2026', engineering: 260000, sales: 220000, cloud: 125000, operations: 95000 },
  { month: 'Aug', fullMonth: 'August 2026', engineering: 275000, sales: 240000, cloud: 132000, operations: 100000 },
  { month: 'Sep', fullMonth: 'September 2026', engineering: 290000, sales: 260000, cloud: 140000, operations: 105000 },
  { month: 'Oct', fullMonth: 'October 2026', engineering: 310000, sales: 280000, cloud: 148000, operations: 110000 },
  { month: 'Nov', fullMonth: 'November 2026', engineering: 325000, sales: 300000, cloud: 155000, operations: 115000 },
  { month: 'Dec', fullMonth: 'December 2026', engineering: 340000, sales: 320000, cloud: 162000, operations: 120000 }
];

export const BusinessAnalytics: React.FC<BusinessAnalyticsProps> = ({ currency = 'USD' }) => {
  const chartRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstanceRef = useRef<any>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<MonthlyRecord>(MONTHLY_BUSINESS_UNIT_DATA[3]); // Apr 2026 default
  const [industryMode, setIndustryMode] = useState<'restaurant' | 'tech' | 'general'>('restaurant');

  const getLabels = () => {
    if (industryMode === 'restaurant') {
      return {
        cat1: 'Kitchen & Ingredients (COGS)',
        cat2: 'Front-of-House & Staff',
        cat3: 'Dining Equipment & Tech',
        cat4: 'Utilities & Operations',
        cat1Short: 'Kitchen COGS',
        cat2Short: 'FOH & Staff',
        cat3Short: 'Dining Equip',
        cat4Short: 'Utilities'
      };
    } else if (industryMode === 'tech') {
      return {
        cat1: 'Engineering & Product',
        cat2: 'Sales & Growth',
        cat3: 'Cloud Infrastructure',
        cat4: 'Operations & Logistics',
        cat1Short: 'Engineering',
        cat2Short: 'Sales',
        cat3Short: 'Cloud Infra',
        cat4Short: 'Operations'
      };
    } else {
      return {
        cat1: 'Cost of Goods (COGS)',
        cat2: 'Sales & Marketing',
        cat3: 'Facilities & Rent',
        cat4: 'General & Admin Ops',
        cat1Short: 'Direct COGS',
        cat2Short: 'Marketing',
        cat3Short: 'Facilities',
        cat4Short: 'Admin Ops'
      };
    }
  };

  const labelsConfig = getLabels();

  useEffect(() => {
    if (!chartRef.current) return;
    const ctx = chartRef.current.getContext('2d');
    if (!ctx) return;

    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
    }

    const months = MONTHLY_BUSINESS_UNIT_DATA.map(d => d.month);
    const engData = MONTHLY_BUSINESS_UNIT_DATA.map(d => d.engineering);
    const salesData = MONTHLY_BUSINESS_UNIT_DATA.map(d => d.sales);
    const cloudData = MONTHLY_BUSINESS_UNIT_DATA.map(d => d.cloud);
    const opsData = MONTHLY_BUSINESS_UNIT_DATA.map(d => d.operations);

    chartInstanceRef.current = new ChartJS(ctx, {
      type: 'bar',
      data: {
        labels: months,
        datasets: [
          {
            label: labelsConfig.cat1,
            data: engData,
            backgroundColor: '#cebdff',
            borderRadius: 6,
            barPercentage: 0.75,
            categoryPercentage: 0.8
          },
          {
            label: labelsConfig.cat2,
            data: salesData,
            backgroundColor: '#00d4ff',
            borderRadius: 6,
            barPercentage: 0.75,
            categoryPercentage: 0.8
          },
          {
            label: labelsConfig.cat3,
            data: cloudData,
            backgroundColor: '#cebdff',
            borderRadius: 6,
            barPercentage: 0.75,
            categoryPercentage: 0.8
          },
          {
            label: labelsConfig.cat4,
            data: opsData,
            backgroundColor: '#a78bfa',
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
            setSelectedMonth(MONTHLY_BUSINESS_UNIT_DATA[index]);
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
  }, [currency, industryMode]);

  // Scroll helper functions
  const handleScrollToRange = (startIndex: number) => {
    if (scrollContainerRef.current) {
      const containerWidth = scrollContainerRef.current.clientWidth;
      const scrollPos = (startIndex / 12) * (1100 - containerWidth + 60);
      scrollContainerRef.current.scrollTo({ left: scrollPos, behavior: 'smooth' });
    }
  };

  const selectedMonthTotal = selectedMonth.engineering + selectedMonth.sales + selectedMonth.cloud + selectedMonth.operations;

  // Annual Totals
  const totalEng = MONTHLY_BUSINESS_UNIT_DATA.reduce((acc, curr) => acc + curr.engineering, 0);
  const totalSales = MONTHLY_BUSINESS_UNIT_DATA.reduce((acc, curr) => acc + curr.sales, 0);
  const totalCloud = MONTHLY_BUSINESS_UNIT_DATA.reduce((acc, curr) => acc + curr.cloud, 0);
  const totalOps = MONTHLY_BUSINESS_UNIT_DATA.reduce((acc, curr) => acc + curr.operations, 0);
  const grandAnnualTotal = totalEng + totalSales + totalCloud + totalOps;

  return (
    <div className="tab-view active">
      {/* Header View */}
      <div className="view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span className="pill-tag cyan">12 MONTH PERFORMANCE DATA</span>
            <span className="pill-tag lilac">BUSINESS UNIT OVERVIEW</span>
          </div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#fff', margin: 0, fontFamily: 'Plus Jakarta Sans' }}>
            Business Unit Financial Performance
          </h2>
          <p className="subtitle" style={{ color: '#9ca3af', marginTop: '0.25rem' }}>
            Monthly performance breakdown across business units (Adaptable for Restaurant, Tech & General Business)
          </p>
        </div>

        {/* Industry Sector Mode Selector & Timeframe presets */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
          <div className="timeframe-selector" style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.15)', padding: '4px' }}>
            <span style={{ fontSize: '0.7rem', fontFamily: 'JetBrains Mono', color: '#9ca3af', marginRight: '6px', alignSelf: 'center', paddingLeft: '6px' }}>SECTOR:</span>
            <button className={`tf-btn ${industryMode === 'restaurant' ? 'active' : ''}`} onClick={() => setIndustryMode('restaurant')}>
              <i className="fa-solid fa-utensils" style={{ marginRight: '4px' }}></i> Restaurant
            </button>
            <button className={`tf-btn ${industryMode === 'tech' ? 'active' : ''}`} onClick={() => setIndustryMode('tech')}>
              <i className="fa-solid fa-laptop-code" style={{ marginRight: '4px' }}></i> Tech
            </button>
            <button className={`tf-btn ${industryMode === 'general' ? 'active' : ''}`} onClick={() => setIndustryMode('general')}>
              <i className="fa-solid fa-briefcase" style={{ marginRight: '4px' }}></i> General
            </button>
          </div>

          <div className="timeframe-selector" style={{ background: 'rgba(0, 212, 255, 0.08)', border: '1px solid rgba(0, 212, 255, 0.25)', padding: '4px' }}>
            <span style={{ fontSize: '0.7rem', fontFamily: 'JetBrains Mono', color: '#9ca3af', marginRight: '6px', alignSelf: 'center', paddingLeft: '6px' }}>VIEW:</span>
            <button className="tf-btn" onClick={() => handleScrollToRange(0)}>Q1 (Jan-Apr)</button>
            <button className="tf-btn" onClick={() => handleScrollToRange(4)}>Q2/Q3 (May-Aug)</button>
            <button className="tf-btn" onClick={() => handleScrollToRange(8)}>Q4 (Sep-Dec)</button>
          </div>
        </div>
      </div>

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
                {formatCurrency(totalEng, currency)}
              </div>
            </div>

            <div style={{ background: 'rgba(0, 212, 255, 0.08)', padding: '0.75rem', borderRadius: '0.6rem', border: '1px solid rgba(0, 212, 255, 0.2)' }}>
              <div style={{ fontSize: '0.7rem', color: '#00d4ff', fontWeight: 600, textTransform: 'uppercase' }}>{labelsConfig.cat2Short}</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#ffffff', fontFamily: 'JetBrains Mono', marginTop: '0.2rem' }}>
                {formatCurrency(totalSales, currency)}
              </div>
            </div>

            <div style={{ background: 'rgba(206, 189, 255, 0.08)', padding: '0.75rem', borderRadius: '0.6rem', border: '1px solid rgba(206, 189, 255, 0.2)' }}>
              <div style={{ fontSize: '0.7rem', color: '#cebdff', fontWeight: 600, textTransform: 'uppercase' }}>{labelsConfig.cat3Short}</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#ffffff', fontFamily: 'JetBrains Mono', marginTop: '0.2rem' }}>
                {formatCurrency(totalCloud, currency)}
              </div>
            </div>

            <div style={{ background: 'rgba(167, 139, 250, 0.08)', padding: '0.75rem', borderRadius: '0.6rem', border: '1px solid rgba(167, 139, 250, 0.2)' }}>
              <div style={{ fontSize: '0.7rem', color: '#a78bfa', fontWeight: 600, textTransform: 'uppercase' }}>{labelsConfig.cat4Short}</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#ffffff', fontFamily: 'JetBrains Mono', marginTop: '0.2rem' }}>
                {formatCurrency(totalOps, currency)}
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
                <span style={{ color: '#cebdff', fontFamily: 'JetBrains Mono', fontWeight: 600 }}>{formatCurrency(selectedMonth.engineering, currency)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.2rem' }}>
                <span style={{ color: '#9ca3af' }}>{labelsConfig.cat2Short}:</span>
                <span style={{ color: '#00d4ff', fontFamily: 'JetBrains Mono', fontWeight: 600 }}>{formatCurrency(selectedMonth.sales, currency)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.2rem' }}>
                <span style={{ color: '#9ca3af' }}>{labelsConfig.cat3Short}:</span>
                <span style={{ color: '#cebdff', fontFamily: 'JetBrains Mono', fontWeight: 600 }}>{formatCurrency(selectedMonth.cloud, currency)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#9ca3af' }}>{labelsConfig.cat4Short}:</span>
                <span style={{ color: '#a78bfa', fontFamily: 'JetBrains Mono', fontWeight: 600 }}>{formatCurrency(selectedMonth.operations, currency)}</span>
              </div>
            </div>
          </div>

          {/* Historical 12 Months Scroll List */}
          <h4 style={{ fontSize: '0.82rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>
            MONTHLY HISTORICAL LOG (JAN - DEC)
          </h4>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '320px', overflowY: 'auto', paddingRight: '4px' }}>
            {MONTHLY_BUSINESS_UNIT_DATA.map((rec) => {
              const monthSum = rec.engineering + rec.sales + rec.cloud + rec.operations;
              const isSelected = selectedMonth.month === rec.month;
              return (
                <div
                  key={rec.month}
                  onClick={() => setSelectedMonth(rec)}
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
                      {labelsConfig.cat1Short}: {formatCurrency(rec.engineering, currency)} • {labelsConfig.cat2Short}: {formatCurrency(rec.sales, currency)}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: isSelected ? '#00d4ff' : '#cebdff', fontFamily: 'JetBrains Mono' }}>
                      {formatCurrency(monthSum, currency)}
                    </div>
                    <span style={{ fontSize: '0.65rem', color: '#4ade80' }}>Verified</span>
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
