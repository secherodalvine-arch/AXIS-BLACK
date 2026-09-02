import React, { useEffect, useRef } from 'react';
import ChartJS from 'chart.js/auto';

export const FinancialGrowthChart: React.FC = () => {
  const chartRef = useRef<HTMLCanvasElement | null>(null);
  const instanceRef = useRef<any>(null);

  useEffect(() => {
    const canvas = chartRef.current;
    if (!canvas) return;

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

    instanceRef.current = new ChartJS(ctx, {
      type: 'line',
      data: {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'],
        datasets: [
          {
            label: 'Revenue Stream',
            data: [280000, 310000, 345000, 390000, 420000, 465000, 490000, 528000],
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
            data: [120000, 140000, 165000, 195000, 210000, 240000, 260000, 290000],
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
            data: [160000, 170000, 180000, 195000, 210000, 225000, 230000, 238000],
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
              label: (context: any) => ` ${context.dataset.label}: $${context.parsed.y?.toLocaleString()}`
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
              callback: (value: any) => `$${Number(value) / 1000}k`
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
    <div className="glass-card chart-container-card">
      <div className="card-header">
        <div className="card-title-group">
          <h3>Financial Performance & Growth</h3>
          <p className="subtitle">Real-time revenue, gross margin, and operational expenditures</p>
        </div>
        <div className="card-actions">
          <div className="chart-legend-custom">
            <span className="legend-item"><span className="color-dot dot-cyan"></span> Revenue</span>
            <span className="legend-item"><span className="color-dot dot-lilac"></span> Net Margin</span>
            <span className="legend-item"><span className="color-dot" style={{ background: '#a78bfa' }}></span> Expenses</span>
          </div>
          <button className="icon-btn-sm" title="Expand view"><i className="fa-solid fa-expand"></i></button>
        </div>
      </div>
      <div className="chart-wrapper">
        <canvas ref={chartRef} />
      </div>
    </div>
  );
};
