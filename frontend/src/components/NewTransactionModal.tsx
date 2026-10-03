import React, { useState, useEffect } from 'react';
import { Transaction, Currency } from '../types';
import { fromDisplayAmount, getCurrencySymbol, parseMoneyInput } from '../utils/currencyUtils';
import { getBranchesApi, getStoredUser } from '../utils/api';
import { getLocalDateString } from '../utils/dateUtils';
import {
  CUSTOM_CATEGORY_VALUE,
  getLedgerCategories,
  getDefaultLedgerCategory,
  categoryOptionLabel
} from '../utils/categories';

interface NewTransactionModalProps {
  isOpen: boolean;
  currency?: Currency;
  onClose: () => void;
  onSubmit: (txn: Omit<Transaction, 'id'> & { id?: string }) => void;
}

const LABEL_STYLE: React.CSSProperties = { fontSize: '0.82rem', color: 'var(--text-main, #e5e7eb)', fontWeight: 600, display: 'block', marginBottom: '6px' };
const HINT_STYLE: React.CSSProperties = { fontSize: '0.72rem', color: 'var(--text-muted, #9ca3af)', marginTop: '5px', lineHeight: 1.4 };
const INPUT_STYLE: React.CSSProperties = { background: 'var(--search-bg, #1a1a22)', color: 'var(--text-main, #ffffff)', border: '1px solid var(--search-border, rgba(255, 255, 255, 0.15))', borderRadius: '10px', padding: '12px' };

export const NewTransactionModal: React.FC<NewTransactionModalProps> = ({
  isOpen,
  currency = 'USD',
  onClose,
  onSubmit
}) => {
  const currentUser = getStoredUser();
  const isSubUserWithBranch = Boolean(currentUser?.is_sub_user && currentUser?.branch_id);

  const [counterparty, setCounterparty] = useState('');
  const [customRef, setCustomRef] = useState('');
  const [type, setType] = useState<'Expense' | 'Revenue'>('Expense');
  const [category, setCategory] = useState<string>(getDefaultLedgerCategory('Expense'));
  const [accountType, setAccountType] = useState<Transaction['accountType']>('Cash');
  const [customCategory, setCustomCategory] = useState('');
  const [isCustom, setIsCustom] = useState(false);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(getLocalDateString());
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

  const symbol = getCurrencySymbol(currency);
  const categoryOptions = getLedgerCategories(type);
  const selectedPreset = categoryOptions.find(c => c.value === category);

  const handleTypeChange = (newType: 'Expense' | 'Revenue') => {
    setType(newType);
    // Categories differ for money in vs money out - pick a sensible default for the new type
    if (!isCustom) setCategory(getDefaultLedgerCategory(newType));
  };

  const handleAmountChange = (v: string) => {
    let s = v.replace(/[^0-9.]/g, '');
    const firstDot = s.indexOf('.');
    if (firstDot !== -1) s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, '');
    setAmount(s);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const rawNum = parseMoneyInput(amount);
    const finalCategory = isCustom ? (customCategory.trim() || getDefaultLedgerCategory(type)) : category;
    if (!counterparty.trim() || isNaN(rawNum)) return;

    // Money is stored in USD: convert what the user typed (in their chosen currency)
    const numAmountInUSD = fromDisplayAmount(rawNum, currency);

    const userRef = customRef.trim();
    onSubmit({
      ...(userRef ? { id: userRef } : {}),
      counterparty: counterparty.trim(),
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
    setCustomRef('');
    setAmount('');
    setNotes('');
    setCustomCategory('');
    setIsCustom(false);
    setCategory(getDefaultLedgerCategory(type));
    onClose();
  };

  const handleCategorySelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === CUSTOM_CATEGORY_VALUE) {
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
            Record Money In / Out
          </h3>
          <button className="modal-close" onClick={onClose} style={{ color: 'var(--text-muted, #9ca3af)', fontSize: '1.5rem', background: 'none', border: 'none', cursor: 'pointer' }}>&times;</button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <div style={{ overflowY: 'auto', flex: 1, paddingRight: '6px', minHeight: 0 }}>

          <div className="form-group">
            <label style={LABEL_STYLE}>Is money coming in or going out?</label>
            <select
              className="select-text"
              value={type}
              onChange={(e) => handleTypeChange(e.target.value as 'Expense' | 'Revenue')}
              style={INPUT_STYLE}
            >
              <option value="Expense">Money Out — I spent / paid money</option>
              <option value="Revenue">Money In — I received money (sales, income)</option>
            </select>
          </div>

          <div className="form-row">
            <div className="form-group" style={{ flex: 1.3 }}>
              <label style={LABEL_STYLE}>What is this for? *</label>
              <input 
                type="text" 
                className="input-text" 
                placeholder={type === 'Revenue' ? 'e.g. Sold 2 wigs to Mary' : 'e.g. Paid shop rent, Bought stock'}
                value={counterparty}
                onChange={(e) => setCounterparty(e.target.value)}
                required
                style={INPUT_STYLE}
              />
            </div>

            <div className="form-group" style={{ flex: 1 }}>
              <label style={LABEL_STYLE}>
                Receipt / Reference No. <span style={{ color: '#9ca3af', fontWeight: 400 }}>(optional)</span>
              </label>
              <input 
                type="text" 
                className="input-text" 
                placeholder="Leave empty, we will make one"
                value={customRef}
                onChange={(e) => setCustomRef(e.target.value)}
                style={INPUT_STYLE}
              />
            </div>
          </div>

          <div className="form-group">
            <label style={LABEL_STYLE}>Category — what kind of {type === 'Revenue' ? 'income' : 'expense'} is it?</label>
            <select 
              className="select-text"
              value={isCustom ? CUSTOM_CATEGORY_VALUE : category}
              onChange={handleCategorySelectChange}
              style={INPUT_STYLE}
            >
              {categoryOptions.map(c => (
                <option key={c.value} value={c.value}>{categoryOptionLabel(c)}</option>
              ))}
              <option value={CUSTOM_CATEGORY_VALUE}>+ Not listed — type my own</option>
            </select>
            {selectedPreset && !isCustom && <div style={HINT_STYLE}>Good for: {selectedPreset.hint}</div>}
          </div>

          {isCustom && (
            <div className="form-group" style={{ marginTop: '-4px' }}>
              <label style={{ ...LABEL_STYLE, color: '#00d4ff' }}>Type your own category name</label>
              <input 
                type="text" 
                className="input-text" 
                placeholder="e.g. Staff Lunch, Church Offering, Wig Braiding"
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                required={isCustom}
                style={{ ...INPUT_STYLE, border: '1px solid #00d4ff', padding: '10px' }}
              />
            </div>
          )}

          <div className="form-row">
            <div className="form-group">
              <label style={LABEL_STYLE}>
                How much? ({symbol}) *
              </label>
              <input 
                type="text" 
                inputMode="decimal"
                className="input-text" 
                placeholder="e.g. 1500"
                value={amount}
                onChange={(e) => handleAmountChange(e.target.value)}
                required
                style={INPUT_STYLE}
              />
              <div style={HINT_STYLE}>Type the amount in {currency === 'KES' ? 'Kenya Shillings' : 'US Dollars'}</div>
            </div>
            <div className="form-group">
              <label style={LABEL_STYLE}>Date</label>
              <input 
                type="date" 
                className="input-text" 
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                style={INPUT_STYLE}
              />
            </div>
          </div>

          <div className="form-group">
            <label style={LABEL_STYLE}>How was it paid / where is the money?</label>
            <select 
              className="select-text"
              value={accountType}
              onChange={(e) => setAccountType(e.target.value as any)}
              style={INPUT_STYLE}
            >
              <option value="Cash">Cash (money in hand)</option>
              <option value="Bank">Bank or Mobile Money (M-Pesa)</option>
              <option value="Accounts Receivable">Customer owes me (not paid yet)</option>
              <option value="Accounts Payable">I owe a supplier (not paid yet)</option>
              <option value="Revenue">Sales / income record</option>
              <option value="Expense">Business expense record</option>
            </select>
          </div>

          <div className="form-group">
            <label style={LABEL_STYLE}>
              Notes <span style={{ color: '#9ca3af', fontWeight: 400 }}>(optional)</span>
            </label>
            <textarea 
              className="input-text" 
              rows={2}
              placeholder="Anything you want to remember about this entry..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={INPUT_STYLE}
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
                <label style={LABEL_STYLE}>Branch</label>
                <select
                  value={branchId}
                  onChange={e => setBranchId(e.target.value)}
                  style={{ ...INPUT_STYLE, color: branchId ? '#00d4ff' : 'var(--text-muted, #9ca3af)', width: '100%' }}
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
              Save Entry
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
