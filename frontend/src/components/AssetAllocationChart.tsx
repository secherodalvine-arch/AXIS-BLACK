import React, { useEffect, useRef } from 'react';
import ChartJS from 'chart.js/auto';

export const AssetAllocationChart: React.FC = () => {
  const chartRef = useRef<HTMLCanvasElement | null>(null);
  const instanceRef = useRef<any>(null);

  useEffect(() => {
    const canvas = chartRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (instanceRef.current) {
      instanceRef.current.destroy();
    }

    instanceRef.current = new ChartJS(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Cash & Equivalents', 'Short-Term T-Bills', 'Accounts Receivable'],
        datasets: [
          {
            data: [1120000, 450000, 270250],
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
              label: (context: any) => ` ${context.label}: $${context.parsed.toLocaleString()}`
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
  }, []);

  return (
    <div className="glass-card chart-card-sm">
      <div className="card-header">
        <h3>Asset Allocation Breakdown</h3>
        <button className="icon-btn-sm"><i className="fa-solid fa-ellipsis-vertical"></i></button>
      </div>
      <div className="chart-wrapper-sm">
        <canvas ref={chartRef} />
      </div>
      <div className="spectrum-stats-list">
        <div className="spectrum-row">
          <span className="spec-label"><span className="sq-dot" style={{ background: '#00d4ff' }}></span> Cash & Equivalents</span>
          <span className="spec-val">$1,120,000 (60.8%)</span>
        </div>
        <div className="spectrum-row">
          <span className="spec-label"><span className="sq-dot" style={{ background: '#cebdff' }}></span> Short-Term T-Bills</span>
          <span className="spec-val">$450,000 (24.5%)</span>
        </div>
        <div className="spectrum-row">
          <span className="spec-label"><span className="sq-dot" style={{ background: '#a78bfa' }}></span> Accounts Receivable</span>
          <span className="spec-val">$270,250 (14.7%)</span>
        </div>
      </div>
    </div>
  );
};
