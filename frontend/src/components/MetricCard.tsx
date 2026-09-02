import React from 'react';
import { MetricData, Currency } from '../types';
import { formatCurrency } from '../utils/currencyUtils';

interface MetricCardProps {
  metric: MetricData;
  currency?: Currency;
}

export const MetricCard: React.FC<MetricCardProps> = ({ metric, currency = 'USD' }) => {
  const displayValue = metric.numericValue !== undefined 
    ? formatCurrency(metric.numericValue, currency)
    : metric.value;

  return (
    <div className="metric-card glass-card">
      <div className={`card-glow-bg glow-${metric.glowColor}`}></div>
      
      <div className="metric-header">
        <span className="metric-title">{metric.title}</span>
        <div className={`metric-icon-badge ${metric.glowColor}`}>
          <i className={`fa-solid ${metric.icon}`}></i>
        </div>
      </div>

      <div className="metric-value-row">
        <span className="metric-value">{displayValue}</span>
        <span className={`trend-pill ${metric.isPositive ? 'positive' : 'badge-low-risk'}`}>
          {metric.isPositive && <i className="fa-solid fa-arrow-trend-up"></i>}
          {' '}{metric.change}
        </span>
      </div>

      <div className="metric-footer">
        <span className="meta-label">{metric.targetOrMeta}</span>
        {metric.progressPercent !== undefined && (
          <div className="mini-progress-bar">
            <div className="fill" style={{ width: `${metric.progressPercent}%` }}></div>
          </div>
        )}
      </div>
    </div>
  );
};
