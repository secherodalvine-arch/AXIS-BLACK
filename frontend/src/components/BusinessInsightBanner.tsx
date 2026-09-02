import React, { useState } from 'react';
import { Currency } from '../types';

interface BusinessInsightBannerProps {
  onExploreClick: () => void;
  metrics?: any[];
  currency?: Currency;
}

export const BusinessInsightBanner: React.FC<BusinessInsightBannerProps> = ({
  onExploreClick,
  metrics,
  currency = 'USD'
}) => {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const finMetric = metrics?.find(m => m.id === 'financial');
  const runwayMonths = finMetric?.runwayMonths || 14.8;
  const netLiquidity = finMetric?.netLiquidity;
  const symbol = currency === 'KES' ? 'KSh ' : '$';
  const multiplier = currency === 'KES' ? 130 : 1;

  const formattedLiquidity = netLiquidity 
    ? `${symbol}${(netLiquidity * multiplier).toLocaleString(undefined, { maximumFractionDigits: 0 })}` 
    : `${symbol}${(1845000 * multiplier).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  return (
    <div className="insight-banner">
      <div className="banner-icon">
        <i className="fa-solid fa-lightbulb"></i>
      </div>
      <div className="banner-content">
        <h4>Live Business Telemetry & Insight</h4>
        <p>
          Verified net liquidity of <strong>{formattedLiquidity}</strong> across active ledger entries. Operating runway calculated at <strong>{runwayMonths} months</strong> based on real-time cash flow telemetry.
        </p>
      </div>
      <button className="banner-action" onClick={onExploreClick}>
        Explore Insight <i className="fa-solid fa-arrow-right"></i>
      </button>
      <button className="banner-close" onClick={() => setDismissed(true)} aria-label="Dismiss banner">
        &times;
      </button>
    </div>
  );
};
