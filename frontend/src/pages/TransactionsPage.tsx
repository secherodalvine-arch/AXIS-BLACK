import React, { useState, useRef } from 'react';
import { Transaction, Currency } from '../types';
import { formatCurrency } from '../utils/currencyUtils';
import { formatRelativeTime } from '../utils/dateUtils';
import { importTransactionsCsvApi, getBranchesApi } from '../utils/api';

interface TransactionsLedgerProps {
  transactions: Transaction[];
  currency?: Currency;
  searchQuery?: string;
  onOpenModal: () => void;
  onAddTransaction?: (txn: Omit<Transaction, 'id'>) => void;
}

export const TransactionsLedger: React.FC<TransactionsLedgerProps> = ({
  transactions,
  currency = 'USD',
  searchQuery = '',
  onOpenModal,
  onAddTransaction
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [accountLedgerFilter, setAccountLedgerFilter] = useState<string>('ALL');
  const [branchFilter, setBranchFilter] = useState<string>('');
  const [branches, setBranches] = useState<any[]>([]);
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvStatus, setCsvStatus] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const csvInputRef = useRef<HTMLInputElement | null>(null);

  // Load branches once
  React.useEffect(() => {
    getBranchesApi().then(b => {
      const list = Array.isArray(b) ? b : [];
      setBranches(list);
      if (list.length === 1) {
        setBranchFilter(list[0].id);
      }
    }).catch(() => {});
  }, []);

  const handleCsvImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvImporting(true);
    setCsvStatus(null);
    try {
      const targetBranch = branchFilter || (branches.length === 1 ? branches[0].id : undefined);
      const result = await importTransactionsCsvApi(file, targetBranch);
      setCsvStatus({ text: result.message || `Imported ${result.imported} transactions`, type: 'success' });
      window.dispatchEvent(new CustomEvent('axis-data-updated'));
    } catch (err: any) {
      setCsvStatus({ text: err.message || 'Import failed', type: 'error' });
    } finally {
      setCsvImporting(false);
      if (csvInputRef.current) csvInputRef.current.value = '';
      setTimeout(() => setCsvStatus(null), 6000);
    }
  };


  // Daily Budget & Usage State
  const [dailyBudgetLimit, setDailyBudgetLimit] = useState<number>(25000);
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState<string>('25000');

  // Quick Usage Input State
  const [quickCounterparty, setQuickCounterparty] = useState('');
  const [quickAmount, setQuickAmount] = useState('');
  const [quickCategory, setQuickCategory] = useState('Operations & Logistics');

  // Calculate Used Today (Sum of expense transactions logged today)
  const now = new Date();
  const todayUtcStr = now.toISOString().split('T')[0];
  const todayLocalStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const usedTodayUSD = transactions
    .filter(t => (t.type === 'Expense' || t.amount < 0) && (t.date === todayUtcStr || t.date === todayLocalStr || (t.date && (t.date.startsWith(todayUtcStr) || t.date.startsWith(todayLocalStr)))))
    .reduce((acc, t) => acc + Math.abs(t.amount), 0);

  const remainingUSD = dailyBudgetLimit - usedTodayUSD;
  const percentUsed = Math.min(100, Math.max(0, Math.round((usedTodayUSD / (dailyBudgetLimit || 1)) * 100)));
  const isOverBudget = remainingUSD < 0;

  const handleSaveBudget = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(budgetInput);
    if (!isNaN(val) && val > 0) {
      setDailyBudgetLimit(val);
    }
    setIsEditingBudget(false);
  };

  const handleQuickLogUsage = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(quickAmount);
    if (!quickCounterparty || isNaN(amt) || amt <= 0) return;

    if (onAddTransaction) {
      onAddTransaction({
        counterparty: quickCounterparty,
        type: 'Expense',
        category: quickCategory,
        accountType: 'Expense',
        date: todayLocalStr,
        status: 'Cleared',
        amount: -Math.abs(amt),
        notes: 'Logged via Daily Usage Tracker'
      });
    }

    setQuickCounterparty('');
    setQuickAmount('');
  };

  // Compute Running Balance for all transactions chronologically
  const sortedAsc = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  let runningTotal = 0;
  const transactionsWithBalance = sortedAsc.map(t => {
    runningTotal += t.amount;
    return {
      ...t,
      runningBalance: runningTotal
    };
  });

  // Display reverse chronological (newest first)
  const sortedDescWithBalance = [...transactionsWithBalance].reverse();

  const availableCategories = Array.from(new Set([
    'ALL',
    'Revenue & Sales',
    'Software & Subscriptions',
    'Cloud & Infrastructure',
    'Payroll & Compensation',
    'Marketing & Growth',
    'Operations & Logistics',
    'Office & Facilities',
    'Professional Services',
    'Equipment & Assets',
    'Treasury & Capital',
    ...transactions.map(t => t.category).filter(Boolean)
  ]));

  const effectiveSearch = (searchTerm || searchQuery).toLowerCase();

  const filtered = sortedDescWithBalance.filter(t => {
    const matchesSearch = 
      t.counterparty.toLowerCase().includes(effectiveSearch) ||
      t.category.toLowerCase().includes(effectiveSearch) ||
      t.id.toLowerCase().includes(effectiveSearch) ||
      (t.notes && t.notes.toLowerCase().includes(effectiveSearch));

    const matchesCategory = categoryFilter === 'ALL' || t.category === categoryFilter;
    const matchesStatus = statusFilter === 'ALL' || t.status === statusFilter;
    const matchesAccount = accountLedgerFilter === 'ALL' || t.accountType === accountLedgerFilter;
    const matchesBranch = !branchFilter || t.branch_id === branchFilter;

    return matchesSearch && matchesCategory && matchesStatus && matchesAccount && matchesBranch;
  });

  return (
    <div className="tab-view active">
      {/* Page Header */}
      <div className="view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-main, #fff)', margin: 0, fontFamily: 'Plus Jakarta Sans' }}>
            Ledger
          </h2>
          <p className="subtitle" style={{ color: 'var(--text-muted, #9ca3af)', marginTop: '0.25rem' }}>
            Structured financial history, running balance, and account records
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'nowrap', overflowX: 'auto', maxWidth: '100%', paddingBottom: '4px' }}>
          {branches.length > 1 && (
            <select
              value={branchFilter}
              onChange={e => setBranchFilter(e.target.value)}
              style={{ background: 'var(--header-btn-bg, #1a1a22)', border: '1px solid var(--header-btn-border, rgba(255,255,255,0.1))', borderRadius: '10px', padding: '8px 14px', color: branchFilter ? '#00d4ff' : 'var(--text-muted, #9ca3af)', fontSize: '0.82rem', cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' }}
              title="Filter by branch"
            >
              <option value="">All Branches</option>
              {branches.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
          {branches.length === 1 && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '10px',
                background: 'rgba(0, 212, 255, 0.08)',
                border: '1px solid rgba(0, 212, 255, 0.25)',
                color: 'var(--secondary-cyan, #00d4ff)',
                fontSize: '0.82rem',
                fontWeight: 600,
                flexShrink: 0,
                whiteSpace: 'nowrap'
              }}
              title="Assigned branch"
            >
              <i className="fa-solid fa-code-branch"></i>
              {branches[0].name}
            </span>
          )}
          <input ref={csvInputRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleCsvImport} />
          <button
            className="action-btn-secondary"
            onClick={() => csvInputRef.current?.click()}
            disabled={csvImporting}
            title="Import transactions from CSV"
            style={{ gap: '8px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', flexShrink: 0, whiteSpace: 'nowrap' }}
          >
            {csvImporting ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-file-import"></i>}
            {csvImporting ? 'Importing...' : 'Import CSV'}
          </button>
          <button className="action-btn-primary" onClick={onOpenModal} style={{ flexShrink: 0, whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <i className="fa-solid fa-plus"></i> Record Entry
          </button>
        </div>
      </div>

      {/* CSV Import Status */}
      {csvStatus && (
        <div style={{
          padding: '10px 14px', borderRadius: '10px', marginBottom: '16px',
          background: csvStatus.type === 'success' ? 'rgba(74, 222, 128, 0.08)' : 'rgba(255, 142, 142, 0.08)',
          border: `1px solid ${csvStatus.type === 'success' ? 'rgba(74, 222, 128, 0.3)' : 'rgba(255, 142, 142, 0.3)'}`,
          color: csvStatus.type === 'success' ? '#4ade80' : '#ff8e8e',
          fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '10px'
        }}>
          <i className={`fa-solid ${csvStatus.type === 'success' ? 'fa-circle-check' : 'fa-triangle-exclamation'}`}></i>
          {csvStatus.text}
          {csvStatus.type === 'success' && <span style={{ color: 'var(--text-muted, #9ca3af)', fontSize: '0.78rem' }}>· Refresh the page to see imported entries</span>}
        </div>
      )}

      {/* ACCOUNT LEDGERS SELECTOR BAR */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.25rem', padding: '6px', background: 'var(--glass-bg, rgba(255, 255, 255, 0.04))', borderRadius: '12px', border: '1px solid var(--glass-border, rgba(255,255,255,0.08))' }}>
        <button 
          className={`tf-btn ${accountLedgerFilter === 'ALL' ? 'active' : ''}`}
          onClick={() => setAccountLedgerFilter('ALL')}
          style={{ padding: '8px 14px', fontSize: '0.82rem' }}
        >
          <i className="fa-solid fa-book" style={{ marginRight: '6px' }}></i> All Accounts
        </button>
        <button 
          className={`tf-btn ${accountLedgerFilter === 'Cash' ? 'active' : ''}`}
          onClick={() => setAccountLedgerFilter('Cash')}
          style={{ padding: '8px 14px', fontSize: '0.82rem' }}
        >
          <i className="fa-solid fa-dollar-sign" style={{ marginRight: '6px' }}></i> Cash Account
        </button>
        <button 
          className={`tf-btn ${accountLedgerFilter === 'Bank' ? 'active' : ''}`}
          onClick={() => setAccountLedgerFilter('Bank')}
          style={{ padding: '8px 14px', fontSize: '0.82rem' }}
        >
          <i className="fa-solid fa-building-columns" style={{ marginRight: '6px' }}></i> Bank Account
        </button>
        <button 
          className={`tf-btn ${accountLedgerFilter === 'Accounts Receivable' ? 'active' : ''}`}
          onClick={() => setAccountLedgerFilter('Accounts Receivable')}
          style={{ padding: '8px 14px', fontSize: '0.82rem' }}
        >
          <i className="fa-solid fa-users" style={{ marginRight: '6px' }}></i> Accounts Receivable
        </button>
        <button 
          className={`tf-btn ${accountLedgerFilter === 'Accounts Payable' ? 'active' : ''}`}
          onClick={() => setAccountLedgerFilter('Accounts Payable')}
          style={{ padding: '8px 14px', fontSize: '0.82rem' }}
        >
          <i className="fa-solid fa-file-invoice" style={{ marginRight: '6px' }}></i> Accounts Payable
        </button>
        <button 
          className={`tf-btn ${accountLedgerFilter === 'Revenue' ? 'active' : ''}`}
          onClick={() => setAccountLedgerFilter('Revenue')}
          style={{ padding: '8px 14px', fontSize: '0.82rem' }}
        >
          <i className="fa-solid fa-money-bill-trend-up" style={{ marginRight: '6px' }}></i> Sales & Revenue
        </button>
        <button 
          className={`tf-btn ${accountLedgerFilter === 'Expense' ? 'active' : ''}`}
          onClick={() => setAccountLedgerFilter('Expense')}
          style={{ padding: '8px 14px', fontSize: '0.82rem' }}
        >
          <i className="fa-solid fa-file-invoice-dollar" style={{ marginRight: '6px' }}></i> Operating Expenses
        </button>
      </div>

      {/* DAILY USAGE & REMAINING BUDGET TELEMETRY */}
      <div className="budget-grid-2x2" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
        
        {/* Card 1: Daily Allocated Limit */}
        <div className="glass-card" style={{ padding: '1.25rem', borderRadius: '1rem', border: '1px solid rgba(0, 212, 255, 0.3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontFamily: 'JetBrains Mono', color: 'var(--text-muted, #9ca3af)' }}>DAILY BUDGET LIMIT</span>
            <button 
              onClick={() => { setIsEditingBudget(!isEditingBudget); setBudgetInput(dailyBudgetLimit.toString()); }}
              style={{ background: 'none', border: 'none', color: '#00d4ff', fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'JetBrains Mono' }}
            >
              <i className="fa-solid fa-pen-to-square"></i> {isEditingBudget ? 'Cancel' : 'Set Limit'}
            </button>
          </div>

          {isEditingBudget ? (
            <form onSubmit={handleSaveBudget} style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem' }}>
              <input 
                type="number" 
                className="input-text" 
                value={budgetInput} 
                onChange={(e) => setBudgetInput(e.target.value)}
                style={{ background: 'var(--search-bg, #141418)', color: 'var(--text-main, #fff)', padding: '6px 10px', fontSize: '0.9rem', borderRadius: '6px', border: '1px solid #00d4ff' }}
                autoFocus
              />
              <button type="submit" className="action-btn-primary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>Save</button>
            </form>
          ) : (
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main, #ffffff)', fontFamily: 'JetBrains Mono', marginTop: '0.25rem' }}>
              {formatCurrency(dailyBudgetLimit, currency)}
            </div>
          )}
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted, #9ca3af)', marginTop: '0.5rem', display: 'block' }}>
            User Configured Limit
          </span>
        </div>

        {/* Card 2: Used Today */}
        <div className="glass-card" style={{ padding: '1.25rem', borderRadius: '1rem', border: '1px solid rgba(255, 175, 211, 0.3)' }}>
          <div style={{ fontSize: '0.75rem', fontFamily: 'JetBrains Mono', color: 'var(--text-muted, #9ca3af)' }}>USED TODAY (EXPENSES)</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#ffafd3', fontFamily: 'JetBrains Mono', marginTop: '0.25rem' }}>
            {formatCurrency(usedTodayUSD, currency)}
          </div>
          <span style={{ fontSize: '0.72rem', color: '#ffafd3', marginTop: '0.5rem', display: 'block' }}>
            <i className="fa-solid fa-arrow-down-long"></i> {percentUsed}% of Limit Spent
          </span>
        </div>

        {/* Card 3: Remaining Today */}
        <div className="glass-card" style={{ padding: '1.25rem', borderRadius: '1rem', border: `1px solid ${isOverBudget ? 'rgba(255, 142, 142, 0.5)' : 'rgba(74, 222, 128, 0.3)'}` }}>
          <div style={{ fontSize: '0.75rem', fontFamily: 'JetBrains Mono', color: 'var(--text-muted, #9ca3af)' }}>REMAINING TODAY</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: isOverBudget ? '#ff8e8e' : '#4ade80', fontFamily: 'JetBrains Mono', marginTop: '0.25rem' }}>
            {formatCurrency(remainingUSD, currency)}
          </div>
          <span style={{ fontSize: '0.72rem', color: isOverBudget ? '#ff8e8e' : '#4ade80', marginTop: '0.5rem', display: 'block', fontWeight: 600 }}>
            {isOverBudget ? (
              <><i className="fa-solid fa-triangle-exclamation" style={{ marginRight: '4px' }}></i>Over Budget Alert!</>
            ) : (
              <><i className="fa-solid fa-circle-check" style={{ marginRight: '4px' }}></i>Available Remaining</>
            )}
          </span>
        </div>

        {/* Card 4: Daily Meter & Status */}
        <div className="glass-card" style={{ padding: '1.25rem', borderRadius: '1rem' }}>
          <div style={{ fontSize: '0.75rem', fontFamily: 'JetBrains Mono', color: 'var(--text-muted, #9ca3af)', display: 'flex', justifyContent: 'space-between' }}>
            <span>DAILY UTILIZATION</span>
            <span style={{ color: isOverBudget ? '#ff8e8e' : '#00d4ff' }}>{percentUsed}%</span>
          </div>

          <div style={{ width: '100%', height: '10px', background: 'var(--glass-border, rgba(255,255,255,0.08))', borderRadius: '5px', overflow: 'hidden', marginTop: '0.75rem' }}>
            <div 
              style={{ 
                width: `${percentUsed}%`, 
                height: '100%', 
                background: isOverBudget ? 'linear-gradient(90deg, #ff8e8e, #ff4d4d)' : percentUsed > 80 ? 'linear-gradient(90deg, #fbbf24, #f59e0b)' : 'linear-gradient(90deg, #00d4ff, #4ade80)',
                borderRadius: '5px',
                transition: 'width 0.4s ease'
              }}
            />
          </div>

          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted, #9ca3af)', marginTop: '0.5rem', display: 'block' }}>
            {isOverBudget ? 'Budget limit breached for today' : `${100 - percentUsed}% buffer remaining`}
          </span>
        </div>
      </div>

      {/* QUICK LOG DAILY USAGE BAR */}
      <div className="glass-card" style={{ padding: '1.25rem', borderRadius: '1rem', marginBottom: '1.5rem', background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.08), rgba(206, 189, 255, 0.05))', border: '1px solid rgba(0, 212, 255, 0.25)' }}>
        <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.95rem', color: 'var(--text-main, #ffffff)', fontFamily: 'Plus Jakarta Sans', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <i className="fa-solid fa-bolt" style={{ color: '#00d4ff' }}></i>
          Quick Log Today's Usage / Expense
        </h4>

        <form onSubmit={handleQuickLogUsage} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', alignItems: 'end' }}>
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted, #9ca3af)', fontWeight: 600 }}>Item / Supplier</label>
            <input 
              type="text" 
              className="input-text" 
              placeholder="e.g. Daily Milk & Bakery Supply"
              value={quickCounterparty}
              onChange={(e) => setQuickCounterparty(e.target.value)}
              required
              style={{ background: 'var(--search-bg, #141418)', color: 'var(--text-main, #fff)', border: '1px solid var(--search-border, rgba(255,255,255,0.15))', padding: '8px 12px', fontSize: '0.85rem' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted, #9ca3af)', fontWeight: 600 }}>Category</label>
            <select 
              className="select-text"
              value={quickCategory}
              onChange={(e) => setQuickCategory(e.target.value)}
              style={{ background: 'var(--search-bg, #141418)', color: 'var(--text-main, #fff)', border: '1px solid var(--search-border, rgba(255,255,255,0.15))', padding: '8px 12px', fontSize: '0.85rem' }}
            >
              <option value="Operations & Logistics" style={{ background: 'var(--dropdown-bg, #141418)', color: 'var(--text-main, #ffffff)' }}>Operations & Logistics</option>
              <option value="Cloud & Infrastructure" style={{ background: 'var(--dropdown-bg, #141418)', color: 'var(--text-main, #ffffff)' }}>Cloud & Infrastructure</option>
              <option value="Software & Subscriptions" style={{ background: 'var(--dropdown-bg, #141418)', color: 'var(--text-main, #ffffff)' }}>Software & Subscriptions</option>
              <option value="Marketing & Growth" style={{ background: 'var(--dropdown-bg, #141418)', color: 'var(--text-main, #ffffff)' }}>Marketing & Growth</option>
              <option value="Office & Facilities" style={{ background: 'var(--dropdown-bg, #141418)', color: 'var(--text-main, #ffffff)' }}>Office & Facilities</option>
              <option value="Professional Services" style={{ background: 'var(--dropdown-bg, #141418)', color: 'var(--text-main, #ffffff)' }}>Professional Services</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted, #9ca3af)', fontWeight: 600 }}>Amount ({currency})</label>
            <input 
              type="number" 
              step="0.01"
              className="input-text" 
              placeholder="0.00"
              value={quickAmount}
              onChange={(e) => setQuickAmount(e.target.value)}
              required
              style={{ background: 'var(--search-bg, #141418)', color: 'var(--text-main, #fff)', border: '1px solid var(--search-border, rgba(255,255,255,0.15))', padding: '8px 12px', fontSize: '0.85rem' }}
            />
          </div>

          <div>
            <button type="submit" className="action-btn-primary" style={{ width: '100%', padding: '9px', fontSize: '0.85rem', justifyContent: 'center' }}>
              <i className="fa-solid fa-plus-circle"></i> Log Usage
            </button>
          </div>
        </form>
      </div>

      {/* Main Ledger Table Card */}
      <div className="glass-card ledger-full-card" style={{ padding: '24px' }}>
        <div className="table-toolbar" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div className="search-filter-group" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <input 
              type="text" 
              className="input-table-search" 
              placeholder="Search counterparty, category, ref, memo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: '100%', maxWidth: '280px' }}
            />
            <select 
              className="select-text"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={{ background: 'var(--search-bg, #141418)', color: 'var(--text-main, #ffffff)', border: '1px solid var(--search-border, rgba(255, 255, 255, 0.15))' }}
            >
              {availableCategories.map(cat => (
                <option key={cat} value={cat} style={{ background: 'var(--dropdown-bg, #141418)', color: 'var(--text-main, #ffffff)' }}>
                  {cat === 'ALL' ? 'All Categories' : cat}
                </option>
              ))}
            </select>
            <select 
              className="select-text"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ background: 'var(--search-bg, #141418)', color: 'var(--text-main, #ffffff)', border: '1px solid var(--search-border, rgba(255, 255, 255, 0.15))' }}
            >
              <option value="ALL" style={{ background: 'var(--dropdown-bg, #141418)', color: 'var(--text-main, #ffffff)' }}>All Statuses</option>
              <option value="Cleared" style={{ background: 'var(--dropdown-bg, #141418)', color: 'var(--text-main, #ffffff)' }}>Cleared</option>
              <option value="Pending" style={{ background: 'var(--dropdown-bg, #141418)', color: 'var(--text-main, #ffffff)' }}>Pending</option>
            </select>
          </div>

          <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.8rem', color: 'var(--text-muted, #9ca3af)', alignSelf: 'center' }}>
            Showing {filtered.length} ledger entries
          </span>
        </div>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Ref Code</th>
                <th>Date</th>
                <th>Description / Entity</th>
                <th>Account & Category</th>
                <th className="text-right">Money In (+)</th>
                <th className="text-right">Money Out (-)</th>
                <th className="text-right">Running Balance</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-dim, #64748b)' }}>
                    <i className="fa-solid fa-file-invoice" style={{ fontSize: '1.8rem', display: 'block', marginBottom: '0.75rem', opacity: 0.3 }}></i>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-muted, #94a3b8)', marginBottom: '0.35rem' }}>
                      {searchTerm || categoryFilter !== 'ALL' || statusFilter !== 'ALL'
                        ? 'No transactions match your current filters'
                        : 'No transactions recorded yet'}
                    </div>
                    <div style={{ fontSize: '0.8rem' }}>
                      {searchTerm || categoryFilter !== 'ALL' || statusFilter !== 'ALL'
                        ? 'Try clearing your search or filters to see all entries.'
                        : 'Use the Record Transaction button or Quick Log above to add your first entry.'}
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map(t => (
                  <tr key={t.id}>
                    <td className="ref-code">{t.id}</td>
                    <td style={{ fontSize: '0.85rem' }}>
                      <span title={t.date} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <span>{formatRelativeTime(t.date, { showTime: false })}</span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted, #9ca3af)', fontFamily: 'JetBrains Mono' }}>
                          ({t.date})
                        </span>
                      </span>
                    </td>
                    <td>
                      <div className="counterparty-cell">
                        <div className="entity-avatar" style={{ background: t.amount > 0 ? 'rgba(74, 222, 128, 0.15)' : 'rgba(255, 175, 211, 0.15)', color: t.amount > 0 ? '#4ade80' : '#ffafd3' }}>
                          <i className={`fa-solid ${t.amount > 0 ? 'fa-arrow-trend-up' : 'fa-receipt'}`}></i>
                        </div>
                        <div>
                          <span style={{ fontWeight: 600, color: 'var(--text-main, #fff)' }}>{t.counterparty}</span>
                          {t.notes && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #9ca3af)' }}>{t.notes}</div>}
                        </div>
                      </div>
                    </td>
                    <td>
                      {t.accountType && (
                        <span className="pill-tag lilac" style={{ fontSize: '0.7rem', textTransform: 'none', marginRight: '6px' }}>
                          {t.accountType}
                        </span>
                      )}
                      <span style={{ fontSize: '0.8rem', color: 'var(--primary-lilac-glow, #cebdff)' }}>{t.category}</span>
                    </td>
                    <td className="text-right amount-val positive" style={{ fontFamily: 'JetBrains Mono', fontWeight: 600 }}>
                      {t.amount > 0 ? `+${formatCurrency(t.amount, currency)}` : <span style={{ color: 'var(--text-dim, #4b5563)' }}>—</span>}
                    </td>
                    <td className="text-right amount-val negative" style={{ fontFamily: 'JetBrains Mono', fontWeight: 600 }}>
                      {t.amount < 0 ? formatCurrency(Math.abs(t.amount), currency) : <span style={{ color: 'var(--text-dim, #4b5563)' }}>—</span>}
                    </td>
                    <td className="text-right" style={{ fontFamily: 'JetBrains Mono', fontWeight: 800, color: t.runningBalance >= 0 ? '#00d4ff' : '#ff8e8e', fontSize: '0.95rem' }}>
                      {formatCurrency(t.runningBalance, currency)}
                    </td>
                    <td>
                      <span className={`status-badge status-${t.status.toLowerCase()}`}>
                        {t.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
