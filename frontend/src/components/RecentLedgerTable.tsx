import React, { useState } from 'react';
import { Transaction, Currency } from '../types';
import { formatCurrency } from '../utils/currencyUtils';
import { formatRelativeTime, fmtDate } from '../utils/dateUtils';

interface RecentLedgerTableProps {
  transactions: Transaction[];
  currency?: Currency;
  onExportCSV: (txns?: Transaction[]) => void;
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
        <div className="card-actions" style={{ display: 'flex', flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'center', gap: '8px' }}>
          <input 
            type="text" 
            className="input-table-search"
            placeholder="Filter ledger..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            style={{ flex: 1, minWidth: '100px', width: 'auto' }}
          />
          <button 
            className="action-btn-secondary" 
            onClick={() => onExportCSV(filtered.length > 0 && searchFilter ? filtered : transactions)}
            style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
          >
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
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-dim, #64748b)' }}>
                  <i className="fa-solid fa-receipt" style={{ fontSize: '1.8rem', display: 'block', marginBottom: '0.75rem', opacity: 0.4 }}></i>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-muted, #94a3b8)', marginBottom: '0.35rem' }}>No transactions recorded yet</div>
                  <div style={{ fontSize: '0.8rem' }}>Use the <strong>Record Transaction</strong> button to log your first entry.</div>
                </td>
              </tr>
            ) : (
              filtered.slice(0, 6).map(t => (
                <tr key={t.id}>
                  <td className="ref-code">{t.id}</td>
                  <td>
                    <div className="counterparty-cell">
                      <div className="entity-avatar"><i className="fa-solid fa-building"></i></div>
                      <span>{t.counterparty}</span>
                    </div>
                  </td>
                  <td>{t.category}</td>
                  <td>
                    <span title={fmtDate(t.date)} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <span>{formatRelativeTime(t.date, { showTime: false })}</span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted, #9ca3af)', fontFamily: 'JetBrains Mono' }}>
                        ({fmtDate(t.date)})
                      </span>
                    </span>
                  </td>
                  <td>
                    <span className={`status-badge status-${t.status.toLowerCase()}`}>
                      {t.status}
                    </span>
                  </td>
                  <td className={`text-right amount-val ${t.amount > 0 ? 'positive' : 'negative'}`}>
                    {t.amount > 0 ? `+${formatCurrency(t.amount, currency)}` : formatCurrency(t.amount, currency)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
