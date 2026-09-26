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
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('axis_insight_banner_dismissed') === 'true';
    } catch {
      return false;
    }
  });

  const handleDismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem('axis_insight_banner_dismissed', 'true');
    } catch {
      // storage unavailable
    }
  };

  if (dismissed) return null;

  const finMetric = metrics?.find(m => m.id === 'financial');
  const symbol = currency === 'KES' ? 'KSh ' : '$';
  const multiplier = currency === 'KES' ? 130 : 1;

  // If metrics haven't loaded yet, show a loading banner
  if (!finMetric) {
    return (
      <div className="insight-banner" style={{ opacity: 0.6 }}>
        <div className="banner-icon">
          <i className="fa-solid fa-circle-notch fa-spin"></i>
        </div>
        <div className="banner-content">
          <h4>Loading Business Insight...</h4>
          <p>Connecting to your financial records. This will only take a moment.</p>
        </div>
        <button className="banner-close" onClick={handleDismiss} aria-label="Dismiss banner">
          &times;
        </button>
      </div>
    );
  }

  const runwayMonths = finMetric.runwayMonths;
  const netLiquidity = finMetric.netLiquidity;
  const formattedLiquidity = netLiquidity
    ? `${symbol}${(netLiquidity * multiplier).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
    : null;

  return (
    <div className="insight-banner">
      <div className="banner-icon">
        <i className="fa-solid fa-lightbulb"></i>
      </div>
      <div className="banner-content">
        <h4>Business Financial Insight</h4>
        <p>
          {formattedLiquidity
            ? <>Verified net liquidity of <strong>{formattedLiquidity}</strong> across active ledger entries. </>
            : null}
          {runwayMonths
            ? <>Operating runway calculated at <strong>{runwayMonths} month{runwayMonths === 1 ? '' : 's'}</strong> based on cash flow analysis.</>
            : <>Dashboard metrics loaded. Explore your transactions to view complete details.</>}
        </p>
      </div>
      <button className="banner-action" onClick={onExploreClick}>
        Inspect Ledger <i className="fa-solid fa-arrow-right"></i>
      </button>
      <button className="banner-close" onClick={handleDismiss} aria-label="Dismiss banner">
        &times;
      </button>
    </div>
  );
};
