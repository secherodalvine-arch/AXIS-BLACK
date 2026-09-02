import React, { useState, useEffect } from 'react';
import { Currency } from '../types';
import { formatCurrency } from '../utils/currencyUtils';
import { runRunwaySimulationApi, getDashboardMetricsApi } from '../utils/api';

interface RunwaySimulatorProps {
  currency?: Currency;
}

export const RunwaySimulator: React.FC<RunwaySimulatorProps> = ({ currency = 'USD' }) => {
  const [revGrowth, setRevGrowth] = useState(5);
  const [newHires, setNewHires] = useState(1);
  const [mktBudget, setMktBudget] = useState(10000);
  const [dbRunway, setDbRunway] = useState<number | null>(null);
  const [confidence, setConfidence] = useState<string>('95%');
  const [recommendation, setRecommendation] = useState<string>('Optimal runway buffer achieved.');

  // Compute local dynamic runway
  const baseCash = 1840250;
  const baseBurn = 142800;
  const netBurn = Math.max(20000, baseBurn + (newHires * 12000) + mktBudget - (baseBurn * (revGrowth / 100)));
  const calculatedRunway = dbRunway !== null ? dbRunway.toFixed(1) : (baseCash / netBurn).toFixed(1);

  useEffect(() => {
    // Fetch live backend metrics first to seed baseline
    getDashboardMetricsApi()
      .then(metrics => {
        if (metrics && metrics[0] && metrics[0].runwayMonths) {
          setDbRunway(metrics[0].runwayMonths);
        }
      })
      .catch(err => console.log('Dashboard metrics fallback notice:', err));
  }, []);

  useEffect(() => {
    // Trigger Monte Carlo simulation on parameter change
    const adjustedBurn = Math.max(20000, baseBurn + (newHires * 12000) + mktBudget - (baseBurn * (revGrowth / 100)));
    const efficiencyFactor = Math.min(100, Math.max(0, revGrowth * 2));
    
    runRunwaySimulationApi(adjustedBurn, efficiencyFactor)
      .then(res => {
        if (res && typeof res.runway_months === 'number') {
          setDbRunway(res.runway_months);
          if (res.confidence_interval) setConfidence(res.confidence_interval);
          if (res.recommendation) setRecommendation(res.recommendation);
        }
      })
      .catch(err => console.log('Simulation backend fallback notice:', err));
  }, [revGrowth, newHires, mktBudget]);

  return (
    <div className="tab-view active">
      <div className="view-header">
        <h2>Runway Simulator</h2>
        <p className="subtitle">Test financial runway scenarios with live Monte Carlo backend simulation and database telemetry</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
        <div className="glass-card" style={{ padding: '24px' }}>
          <h3>Scenario Parameters</h3>
          
          <div className="form-group" style={{ marginTop: '20px' }}>
            <label style={{ fontSize: '0.82rem', color: '#9ca3af' }}>Monthly Revenue Growth: <strong>{revGrowth}%</strong></label>
            <input 
              type="range" 
              min="-10" 
              max="30" 
              value={revGrowth}
              onChange={(e) => setRevGrowth(Number(e.target.value))}
              style={{ width: '100%', marginTop: '6px' }}
            />
          </div>

          <div className="form-group" style={{ marginTop: '20px' }}>
            <label style={{ fontSize: '0.82rem', color: '#9ca3af' }}>Headcount Expansion (Hires / month): <strong>{newHires}</strong></label>
            <input 
              type="range" 
              min="0" 
              max="10" 
              value={newHires}
              onChange={(e) => setNewHires(Number(e.target.value))}
              style={{ width: '100%', marginTop: '6px' }}
            />
          </div>

          <div className="form-group" style={{ marginTop: '20px' }}>
            <label style={{ fontSize: '0.82rem', color: '#9ca3af' }}>Marketing Expenditure Shift: <strong>{formatCurrency(mktBudget, currency)}</strong></label>
            <input 
              type="range" 
              min="0" 
              max="50000" 
              step="5000"
              value={mktBudget}
              onChange={(e) => setMktBudget(Number(e.target.value))}
              style={{ width: '100%', marginTop: '6px' }}
            />
          </div>
        </div>

        <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
          <span className="pill-tag cyan" style={{ fontSize: '0.7rem', marginBottom: '8px' }}>
            MONTE CARLO SIMULATED • {confidence} CONFIDENCE
          </span>
          <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#fff' }}>Projected Runway Outcome</h3>
          <div style={{ margin: '24px 0' }}>
            <span style={{ fontFamily: 'JetBrains Mono', fontSize: '4rem', fontWeight: 800, color: '#00d4ff' }}>
              {calculatedRunway}
            </span>
            <div style={{ fontSize: '1.1rem', color: '#cebdff', fontWeight: 600 }}>Months of Solvency</div>
          </div>
          <p style={{ fontSize: '0.85rem', color: '#9ca3af', maxWidth: '400px', margin: 0 }}>
            Based on current cash reserves of <strong>{formatCurrency(baseCash, currency)}</strong> with projected net burn of <strong>{formatCurrency(netBurn, currency)}/mo</strong>.
          </p>
          <div style={{ marginTop: '16px', padding: '10px 14px', background: 'rgba(0, 212, 255, 0.08)', borderRadius: '8px', border: '1px solid rgba(0, 212, 255, 0.25)', fontSize: '0.8rem', color: '#00d4ff' }}>
            <i className="fa-solid fa-lightbulb" style={{ marginRight: '6px' }}></i> {recommendation}
          </div>
        </div>
      </div>
    </div>
  );
};

