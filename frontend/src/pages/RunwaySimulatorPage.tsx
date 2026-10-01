import React, { useState, useEffect } from 'react';
import { Currency } from '../types';
import { formatCurrency } from '../utils/currencyUtils';
import { runRunwaySimulationApi, getDashboardMetricsApi } from '../utils/api';

interface RunwaySimulatorProps {
  currency?: Currency;
}

export const RunwaySimulator: React.FC<RunwaySimulatorProps> = ({ currency = 'USD' }) => {
  const [revGrowth, setRevGrowth] = useState(0);
  const [newHires, setNewHires] = useState(0);
  const [mktBudget, setMktBudget] = useState(0);
  const [newFunding, setNewFunding] = useState(0);
  const [dbRunway, setDbRunway] = useState<number | null>(null);
  const [baseCash, setBaseCash] = useState<number | null>(null);
  const [baseBurn, setBaseBurn] = useState<number | null>(null);
  const [confidence, setConfidence] = useState<string>('95%');
  const [recommendation, setRecommendation] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  // Compute dynamic runway only when real data is available
  const currentBurn = baseBurn ?? 0;
  const netBurn = baseBurn !== null
    ? Math.max(0, currentBurn + (newHires * 12000) + mktBudget - (currentBurn * (revGrowth / 100)))
    : null;
  const effectiveCash = (baseCash ?? 0) + newFunding;
  const calculatedRunway = dbRunway !== null ? dbRunway.toFixed(1) : null;

  useEffect(() => {
    setIsLoading(true);
    // Fetch live backend metrics to seed real baseline cash & burn
    getDashboardMetricsApi()
      .then(metrics => {
        if (metrics && metrics[0]) {
          if (metrics[0].netLiquidity !== undefined) setBaseCash(metrics[0].netLiquidity);
          if (metrics[0].monthlyBurn !== undefined) setBaseBurn(metrics[0].monthlyBurn);
        }
      })
      .catch(err => {
        console.log('Dashboard metrics fetch error:', err);
        setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    if (baseBurn === null) return;
    // Trigger Monte Carlo simulation on parameter change
    const currentBurn = baseBurn ?? 0;
    const adjustedBurn = Math.max(0, currentBurn + (newHires * 12000) + mktBudget - (currentBurn * (revGrowth / 100)));
    const efficiencyFactor = Math.min(100, Math.max(0, revGrowth * 2));
    
    runRunwaySimulationApi(adjustedBurn, efficiencyFactor, newFunding)
      .then(res => {
        if (res && typeof res.runway_months === 'number') {
          setDbRunway(res.runway_months);
          if (res.confidence_interval) setConfidence(res.confidence_interval);
          if (res.recommendation) setRecommendation(res.recommendation);
        }
      })
      .catch(err => console.log('Simulation backend error:', err))
      .finally(() => setIsLoading(false));
  }, [revGrowth, newHires, mktBudget, newFunding, baseBurn]);

  return (
    <div className="tab-view active">
      <div className="view-header">
        <h2>Runway Simulator</h2>
        <p className="subtitle">Test financial runway scenarios with Monte Carlo simulation and financial records</p>
      </div>

      <div className="runway-simulator-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '20px' }}>
        <div className="glass-card" style={{ padding: '24px' }}>
          <h3>Scenario Parameters</h3>
          
          <div className="form-group" style={{ marginTop: '20px' }}>
            <label className="runway-param-label">
              <span>Monthly Revenue Growth</span>
              <strong className="runway-param-value">{revGrowth > 0 ? `+${revGrowth}%` : `${revGrowth}%`}</strong>
            </label>
            <input 
              type="range" 
              className="runway-slider"
              min="-10" 
              max="30" 
              value={revGrowth}
              onChange={(e) => setRevGrowth(Number(e.target.value))}
            />
          </div>

          <div className="form-group" style={{ marginTop: '20px' }}>
            <label className="runway-param-label">
              <span>Headcount Expansion (Hires / mo)</span>
              <strong className="runway-param-value">{newHires}</strong>
            </label>
            <input 
              type="range" 
              className="runway-slider"
              min="0" 
              max="10" 
              value={newHires}
              onChange={(e) => setNewHires(Number(e.target.value))}
            />
          </div>

          <div className="form-group" style={{ marginTop: '20px' }}>
            <label className="runway-param-label">
              <span>Marketing Expenditure Shift</span>
              <strong className="runway-param-value">{formatCurrency(mktBudget, currency)}</strong>
            </label>
            <input 
              type="range" 
              className="runway-slider"
              min="0" 
              max={currency === 'KES' ? 5000000 : 50000} 
              step={currency === 'KES' ? 250000 : 2500}
              value={mktBudget}
              onChange={(e) => setMktBudget(Number(e.target.value))}
            />
          </div>

          <div className="form-group" style={{ marginTop: '20px' }}>
            <label className="runway-param-label">
              <span>New Capital / Funding Injection</span>
              <strong className="runway-param-value" style={{ color: 'var(--secondary-cyan, #00d4ff)' }}>
                {formatCurrency(newFunding, currency)}
              </strong>
            </label>
            <input 
              type="range" 
              className="runway-slider"
              min="0" 
              max={currency === 'KES' ? 25000000 : 200000} 
              step={currency === 'KES' ? 500000 : 5000}
              value={newFunding}
              onChange={(e) => setNewFunding(Number(e.target.value))}
            />
          </div>
        </div>

        <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
          {isLoading ? (
            <>
              <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: '2rem', color: 'var(--secondary-cyan, #00d4ff)', marginBottom: '1rem' }}></i>
              <p className="runway-outcome-desc">Executing Monte Carlo simulation...</p>
            </>
          ) : calculatedRunway === null ? (
            <>
              <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: '2rem', color: '#fb923c', marginBottom: '1rem' }}></i>
              <h3 className="runway-outcome-title" style={{ margin: '0 0 8px' }}>Data Unavailable</h3>
              <p className="runway-outcome-desc" style={{ maxWidth: '340px' }}>
                Unable to load your financial baseline from the server. Please check your connection and try refreshing.
              </p>
            </>
          ) : (
            <>
              <span className="pill-tag cyan" style={{ fontSize: '0.7rem', marginBottom: '8px' }}>
                MONTE CARLO SIMULATED • {confidence} CONFIDENCE
              </span>
              <h3 className="runway-outcome-title">Projected Runway Outcome</h3>
              <div style={{ margin: '24px 0' }}>
                <span className="runway-outcome-number" style={{ color: calculatedRunway === '0.0' ? '#fb923c' : 'var(--secondary-cyan, #00d4ff)' }}>
                  {calculatedRunway}
                </span>
                <div className="runway-solvency-label">
                  {calculatedRunway === '0.0' && effectiveCash <= 0 ? 'Months of Solvency (Capital Deficit)' : 'Months of Solvency'}
                </div>
              </div>
              <p className="runway-outcome-desc">
                Based on cash reserves of <strong>{formatCurrency(effectiveCash, currency)}</strong> {newFunding > 0 ? `(incl. ${formatCurrency(newFunding, currency)} injection)` : ''} with projected net burn of <strong>{netBurn !== null ? `${formatCurrency(netBurn, currency)}/mo` : '—'}</strong>.
              </p>
              {recommendation && (
                <div className="runway-recommendation-box" style={{ marginTop: '16px' }}>
                  <i className="fa-solid fa-lightbulb" style={{ marginRight: '6px' }}></i> {recommendation}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
