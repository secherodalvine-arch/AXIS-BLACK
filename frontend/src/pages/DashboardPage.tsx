import React from 'react';
import { MetricData, Transaction, AIStreamItem, Currency } from '../types';
import { BusinessInsightBanner } from '../components/BusinessInsightBanner';
import { FinancialGrowthChart } from '../components/FinancialGrowthChart';
import { AssetAllocationChart } from '../components/AssetAllocationChart';
import { RecentLedgerTable } from '../components/RecentLedgerTable';

interface OverviewDashboardProps {
  metrics: MetricData[];
  transactions: Transaction[];
  aiStream: AIStreamItem[];
  currency?: Currency;
  onNavigateToAgent: () => void;
  onAIActionClick: (title: string) => void;
  onQuickAISubmit: (query: string) => void;
  onExportCSV: () => void;
}

export const OverviewDashboard: React.FC<OverviewDashboardProps> = ({
  metrics,
  transactions,
  aiStream: _aiStream,
  currency = 'USD',
  onNavigateToAgent,
  onAIActionClick: _onAIActionClick,
  onQuickAISubmit: _onQuickAISubmit,
  onExportCSV
}) => {
  return (
    <div className="tab-view active">
      <BusinessInsightBanner onExploreClick={onNavigateToAgent} metrics={metrics} currency={currency} />

      {/* 1. Financial Performance & Growth */}
      <FinancialGrowthChart />

      {/* 2. Asset Allocation Breakdown & 3. Ledger Transactions */}
      <div className="dashboard-grid-secondary" style={{ marginTop: '1.5rem' }}>
        <AssetAllocationChart />
        <RecentLedgerTable 
          transactions={transactions}
          currency={currency}
          onExportCSV={onExportCSV}
        />
      </div>
    </div>
  );
};
