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
  onNavigateToAgent?: () => void;
  onNavigateToLedger?: () => void;
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
  onNavigateToLedger,
  onAIActionClick: _onAIActionClick,
  onQuickAISubmit: _onQuickAISubmit,
  onExportCSV
}) => {
  const handleExplore = onNavigateToLedger || onNavigateToAgent || (() => {});

  return (
    <div className="tab-view active">
      <BusinessInsightBanner onExploreClick={handleExplore} metrics={metrics} currency={currency} />

      {/* 1. Financial Performance & Growth */}
      <FinancialGrowthChart transactions={transactions} currency={currency} />

      {/* 2. Asset Allocation Breakdown & 3. Ledger Transactions */}
      <div className="dashboard-grid-secondary" style={{ marginTop: '1.5rem' }}>
        <AssetAllocationChart transactions={transactions} currency={currency} />
        <RecentLedgerTable 
          transactions={transactions}
          currency={currency}
          onExportCSV={onExportCSV}
        />
      </div>
    </div>
  );
};
