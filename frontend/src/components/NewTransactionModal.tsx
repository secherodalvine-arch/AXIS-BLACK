import React, { useState, useEffect } from 'react';
import { Transaction, Currency } from '../types';
import { USD_TO_KES_RATE, getCurrencySymbol } from '../utils/currencyUtils';
import { getBranchesApi, getStoredUser } from '../utils/api';

interface NewTransactionModalProps {
  isOpen: boolean;
  currency?: Currency;
  onClose: () => void;
  onSubmit: (txn: Omit<Transaction, 'id'>) => void;
}

export const NewTransactionModal: React.FC<NewTransactionModalProps> = ({
  isOpen,
  currency = 'USD',
  onClose,
  onSubmit
}) => {
  const currentUser = getStoredUser();
  const isSubUserWithBranch = Boolean(currentUser?.is_sub_user && currentUser?.branch_id);

  const [counterparty, setCounterparty] = useState('');
  const [type, setType] = useState<'Expense' | 'Revenue'>('Expense');
  const [category, setCategory] = useState<string>('Operations & Logistics');
  const [accountType, setAccountType] = useState<Transaction['accountType']>('Cash');
  const [customCategory, setCustomCategory] = useState('');
  const [isCustom, setIsCustom] = useState(false);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [branchId, setBranchId] = useState(currentUser?.branch_id || '');
  const [branches, setBranches] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen) {
      if (isSubUserWithBranch && currentUser?.branch_id) {
        setBranchId(currentUser.branch_id);
      }
      getBranchesApi().then(b => setBranches(Array.isArray(b) ? b : [])).catch(() => {});
    }
  }, [isOpen, isSubUserWithBranch]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const rawNum = parseFloat(amount);
    const finalCategory = isCustom ? (customCategory.trim() || 'Operations & Logistics') : category;
    if (!counterparty || isNaN(rawNum)) return;

    // Convert to USD base if entered in KES
    const numAmountInUSD = currency === 'KES' ? rawNum / USD_TO_KES_RATE : rawNum;

    onSubmit({
      counterparty,
      type,
      category: finalCategory,
      accountType,
      date,
      status: 'Cleared',
      amount: type === 'Expense' ? -Math.abs(numAmountInUSD) : Math.abs(numAmountInUSD),
      notes: notes ? `${notes} (Entered in ${currency})` : `Entered in ${currency}`,
      ...(branchId ? { branch_id: branchId } : {})
    } as any);

    setCounterparty('');
    setAmount('');
    setNotes('');
    setCustomCategory('');
    setIsCustom(false);
    onClose();
  };

  const handleCategorySelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === '__CUSTOM__') {
      setIsCustom(true);
    } else {
      setIsCustom(false);
      setCategory(val);
    }
  };

  return (
    <div className="modal-overlay active" style={{ zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div className="modal-card glass-card" style={{ width: '560px', maxWidth: '95vw', maxHeight: '85vh', display: 'flex', flexDirection: 'column', background: 'var(--dropdown-bg, #141418)', border: '1px solid var(--dropdown-border, rgba(0, 212, 255, 0.35))', boxShadow: 'var(--dropdown-shadow, 0 24px 80px rgba(0,0,0,0.9))', padding: '24px', borderRadius: '20px' }}>
        <div className="modal-header" style={{ borderBottom: '1px solid var(--header-border, rgba(255, 255, 255, 0.1))', paddingBottom: '12px', marginBottom: '16px', flexShrink: 0 }}>
          <h3 style={{ margin: 0, color: 'var(--text-main, #ffffff)', fontFamily: 'Plus Jakarta Sans', fontSize: '1.25rem', fontWeight: 800 }}>
            Record Ledger Entry
          </h3>
          <button className="modal-close" onClick={onClose} style={{ color: 'var(--text-muted, #9ca3af)', fontSize: '1.5rem', background: 'none', border: 'none', cursor: 'pointer' }}>&times;</button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <div style={{ overflowY: 'auto', flex: 1, paddingRight: '6px', minHeight: 0 }}>
          <div className="form-group">
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted, #9ca3af)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Counterparty / Description
            </label>
            <input 
              type="text" 
              className="input-text" 
              placeholder="e.g. Stripe Payout / AWS Cloud Services / Office Supplies"
              value={counterparty}
              onChange={(e) => setCounterparty(e.target.value)}
              required
              style={{ background: 'var(--search-bg, #1a1a22)', color: 'var(--text-main, #ffffff)', border: '1px solid var(--search-border, rgba(255, 255, 255, 0.15))', borderRadius: '10px', padding: '12px' }}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted, #9ca3af)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Account Ledger Type
              </label>
              <select 
                className="select-text"
                value={accountType}
                onChange={(e) => setAccountType(e.target.value as any)}
                style={{ background: 'var(--search-bg, #1a1a22)', color: 'var(--text-main, #ffffff)', border: '1px solid var(--search-border, rgba(255, 255, 255, 0.15))', borderRadius: '10px', padding: '12px' }}
              >
                <option value="Cash">Cash Account</option>
                <option value="Bank">Bank Account</option>
                <option value="Accounts Receivable">Accounts Receivable (Customer)</option>
                <option value="Accounts Payable">Accounts Payable (Supplier)</option>
                <option value="Revenue">Revenue Account</option>
                <option value="Expense">Expense Account</option>
              </select>
            </div>

            <div className="form-group">
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted, #9ca3af)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Transaction Type
              </label>
              <select 
                className="select-text"
                value={type}
                onChange={(e) => setType(e.target.value as 'Expense' | 'Revenue')}
                style={{ background: 'var(--search-bg, #1a1a22)', color: 'var(--text-main, #ffffff)', border: '1px solid var(--search-border, rgba(255, 255, 255, 0.15))', borderRadius: '10px', padding: '12px' }}
              >
                <option value="Expense">Expense (Money Out)</option>
                <option value="Revenue">Revenue (Money In)</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted, #9ca3af)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Category
            </label>
            <select 
              className="select-text"
              value={isCustom ? '__CUSTOM__' : category}
              onChange={handleCategorySelectChange}
              style={{ background: 'var(--search-bg, #1a1a22)', color: 'var(--text-main, #ffffff)', border: '1px solid var(--search-border, rgba(255, 255, 255, 0.15))', borderRadius: '10px', padding: '12px' }}
            >
              <option value="Revenue & Sales">Revenue & Sales</option>
              <option value="Software & Subscriptions">Software & Subscriptions</option>
              <option value="Cloud & Infrastructure">Cloud & Infrastructure</option>
              <option value="Payroll & Compensation">Payroll & Compensation</option>
              <option value="Operations & Logistics">Operations & Logistics</option>
              <option value="Marketing & Growth">Marketing & Growth</option>
              <option value="Office & Facilities">Office & Facilities</option>
              <option value="Professional Services">Professional Services</option>
              <option value="Equipment & Assets">Equipment & Assets</option>
              <option value="Utilities">Utilities</option>
              <option value="Treasury & Capital">Treasury & Capital</option>
              <option value="__CUSTOM__">+ Custom Category...</option>
            </select>
          </div>

          {isCustom && (
            <div className="form-group" style={{ marginTop: '-4px' }}>
              <label style={{ fontSize: '0.75rem', color: '#00d4ff', fontWeight: 600, textTransform: 'uppercase' }}>
                Enter Custom Category Name
              </label>
              <input 
                type="text" 
                className="input-text" 
                placeholder="e.g. Legal Retainer, Cloud Compute, Travel & Lodging"
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                required={isCustom}
                style={{ background: 'var(--search-bg, #1a1a22)', color: 'var(--text-main, #ffffff)', border: '1px solid #00d4ff', borderRadius: '10px', padding: '10px' }}
              />
            </div>
          )}

          <div className="form-row">
            <div className="form-group">
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted, #9ca3af)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Amount ({getCurrencySymbol(currency)})
              </label>
              <input 
                type="number" 
                className="input-text" 
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                style={{ background: 'var(--search-bg, #1a1a22)', color: 'var(--text-main, #ffffff)', border: '1px solid var(--search-border, rgba(255, 255, 255, 0.15))', borderRadius: '10px', padding: '12px' }}
              />
            </div>
            <div className="form-group">
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted, #9ca3af)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Date
              </label>
              <input 
                type="date" 
                className="input-text" 
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                style={{ background: 'var(--search-bg, #1a1a22)', color: 'var(--text-main, #ffffff)', border: '1px solid var(--search-border, rgba(255, 255, 255, 0.15))', borderRadius: '10px', padding: '12px' }}
              />
            </div>
          </div>

          <div className="form-group">
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted, #9ca3af)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Notes / Audit Memo
            </label>
            <textarea 
              className="input-text" 
              rows={2}
              placeholder="Optional notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{ background: 'var(--search-bg, #1a1a22)', color: 'var(--text-main, #ffffff)', border: '1px solid var(--search-border, rgba(255, 255, 255, 0.15))', borderRadius: '10px', padding: '12px' }}
            />
          </div>

          {isSubUserWithBranch ? (
            <div style={{
              background: 'rgba(0, 212, 255, 0.08)',
              border: '1px solid rgba(0, 212, 255, 0.25)',
              borderRadius: '10px',
              padding: '10px 14px',
              color: '#00d4ff',
              fontSize: '0.82rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '16px'
            }}>
              <i className="fa-solid fa-building-circle-check"></i>
              <span>Branch: <strong>{branches.find((b: any) => b.id === currentUser?.branch_id)?.name || 'Assigned Branch'}</strong> (Auto-locked)</span>
            </div>
          ) : (
            branches.length > 0 && (
              <div className="form-group">
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted, #9ca3af)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Branch
                </label>
                <select
                  value={branchId}
                  onChange={e => setBranchId(e.target.value)}
                  style={{ background: 'var(--search-bg, #1a1a22)', color: branchId ? '#00d4ff' : 'var(--text-muted, #9ca3af)', border: '1px solid var(--search-border, rgba(255, 255, 255, 0.15))', borderRadius: '10px', padding: '12px', width: '100%' }}
                >
                  <option value="">All Branches / HQ</option>
                  {branches.map((b: any) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            )
          )}

          </div>

          <div className="modal-actions" style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--header-border, rgba(255, 255, 255, 0.08))', flexShrink: 0, display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button type="button" className="action-btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="action-btn-primary">
              Submit to Ledger
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
