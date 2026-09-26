import React, { useEffect, useRef } from 'react';
import ChartJS from 'chart.js/auto';
import { Currency } from '../types';
import { formatCurrency } from '../utils/currencyUtils';

interface AssetAllocationChartProps {
  transactions?: any[];
  currency?: Currency;
}

export const AssetAllocationChart: React.FC<AssetAllocationChartProps> = ({ transactions = [], currency = 'USD' }) => {
  const chartRef = useRef<HTMLCanvasElement | null>(null);
  const instanceRef = useRef<any>(null);

  // Calculate real balances from ledger entries
  let cashTotal = 0;
  let arTotal = 0;
  let assetTotal = 0;

  transactions.forEach((t: any) => {
    const acc = (t.accountType || '').toLowerCase();
    const cat = (t.category || '').toLowerCase();
    const amt = Number(t.amount) || 0;

    if (acc === 'cash' || acc === 'bank' || (!acc && (cat.includes('cash') || cat.includes('bank') || cat.includes('operations')))) {
      cashTotal += amt;
    } else if (acc === 'accounts receivable' || cat.includes('receivable')) {
      arTotal += Math.abs(amt);
    } else if (acc === 'asset' || cat.includes('asset') || cat.includes('treasury') || cat.includes('equipment')) {
      assetTotal += Math.abs(amt);
    } else {
      cashTotal += amt;
    }
  });

  const positiveCash = Math.max(0, cashTotal);
  const positiveAR = Math.max(0, arTotal);
  const positiveAsset = Math.max(0, assetTotal);
  const grandTotal = positiveCash + positiveAR + positiveAsset;
  const hasData = grandTotal > 0;

  useEffect(() => {
    const canvas = chartRef.current;
    if (!canvas || !hasData) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (instanceRef.current) {
      instanceRef.current.destroy();
    }

    instanceRef.current = new ChartJS(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Cash & Equivalents', 'Assets & Capital', 'Accounts Receivable'],
        datasets: [
          {
            data: [positiveCash, positiveAsset, positiveAR],
            backgroundColor: ['#00d4ff', '#cebdff', '#a78bfa'],
            borderColor: '#0a0a0a',
            borderWidth: 3,
            hoverOffset: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#131315',
            titleColor: '#ffffff',
            bodyColor: '#00d4ff',
            borderColor: 'rgba(255,255,255,0.15)',
            borderWidth: 1,
            callbacks: {
              label: (context: any) => ` ${context.label}: ${formatCurrency(context.parsed, currency)}`
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
  }, [positiveCash, positiveAsset, positiveAR, hasData, currency]);

  return (
    <div className="glass-card chart-card-sm">
      <div className="card-header">
        <h3>Asset Allocation Breakdown</h3>
        <span className="pill-tag cyan" style={{ fontSize: '0.65rem' }}>ASSETS</span>
      </div>

      <div className="chart-wrapper-sm">
        {hasData ? (
          <canvas ref={chartRef} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '170px', color: '#64748b' }}>
            <i className="fa-solid fa-chart-pie" style={{ fontSize: '2rem', marginBottom: '0.75rem', opacity: 0.35, color: '#cebdff' }}></i>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.25rem' }}>No Asset Entries Logged</div>
            <div style={{ fontSize: '0.75rem', textAlign: 'center', maxWidth: '240px', lineHeight: '1.4' }}>
              Record transactions in Cash, Bank, or Receivables to populate your asset distribution.
            </div>
          </div>
        )}
      </div>

      <div className="spectrum-stats-list">
        <div className="spectrum-row">
          <span className="spec-label"><span className="sq-dot" style={{ background: '#00d4ff' }}></span> Cash &amp; Equivalents</span>
          <span className="spec-val">{hasData ? formatCurrency(positiveCash, currency) : '—'}</span>
        </div>
        <div className="spectrum-row">
          <span className="spec-label"><span className="sq-dot" style={{ background: '#cebdff' }}></span> Assets &amp; Capital</span>
          <span className="spec-val">{hasData ? formatCurrency(positiveAsset, currency) : '—'}</span>
        </div>
        <div className="spectrum-row">
          <span className="spec-label"><span className="sq-dot" style={{ background: '#a78bfa' }}></span> Accounts Receivable</span>
          <span className="spec-val">{hasData ? formatCurrency(positiveAR, currency) : '—'}</span>
        </div>
      </div>
      <p style={{ fontSize: '0.72rem', color: '#475569', marginTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.6rem' }}>
        <i className="fa-solid fa-circle-info" style={{ marginRight: '4px' }}></i>
        Breakdown computed from ledger entries.
      </p>
    </div>
  );
};
