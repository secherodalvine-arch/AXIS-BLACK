import React, { useState } from 'react';
import { Transaction, Currency } from '../types';
import { formatCurrency } from '../utils/currencyUtils';

interface RecentLedgerTableProps {
  transactions: Transaction[];
  currency?: Currency;
  onExportCSV: () => void;
}

export const RecentLedgerTable: React.FC<RecentLedgerTableProps> = ({
  transactions,
  currency = 'USD',
  onExportCSV
}) => {
  const [searchFilter, setSearchFilter] = useState('');

  const filtered = transactions.filter(t =>
    t.counterparty.toLowerCase().includes(searchFilter.toLowerCase()) ||
    t.category.toLowerCase().includes(searchFilter.toLowerCase()) ||
    t.id.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="glass-card ledger-card-lg">
      <div className="card-header">
        <div className="card-title-group">
          <h3>Recent Ledger Transactions</h3>
          <p className="subtitle">Showing verified financial movements</p>
        </div>
        <div className="card-actions">
          <input 
            type="text" 
            className="input-table-search"
            placeholder="Filter ledger..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
          />
          <button className="action-btn-secondary" onClick={onExportCSV}>
            <i className="fa-solid fa-download"></i> Export CSV
          </button>
        </div>
      </div>

      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              <th>Transaction ID</th>
              <th>Counterparty</th>
              <th>Category</th>
              <th>Date</th>
              <th>Status</th>
              <th className="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 6).map(t => (
              <tr key={t.id}>
                <td className="ref-code">{t.id}</td>
                <td>
                  <div className="counterparty-cell">
                    <div className="entity-avatar"><i className="fa-solid fa-building"></i></div>
                    <span>{t.counterparty}</span>
                  </div>
                </td>
                <td>{t.category}</td>
                <td>{t.date}</td>
                <td>
                  <span className={`status-badge status-${t.status.toLowerCase()}`}>
                    {t.status}
                  </span>
                </td>
                <td className={`text-right amount-val ${t.amount > 0 ? 'positive' : 'negative'}`}>
                  {t.amount > 0 ? `+${formatCurrency(t.amount, currency)}` : formatCurrency(t.amount, currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
