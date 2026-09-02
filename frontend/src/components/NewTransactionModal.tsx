import React, { useState } from 'react';
import { Transaction, Currency } from '../types';
import { USD_TO_KES_RATE, getCurrencySymbol } from '../utils/currencyUtils';

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
  const [counterparty, setCounterparty] = useState('');
  const [type, setType] = useState<'Expense' | 'Revenue'>('Expense');
  const [category, setCategory] = useState<string>('Food & Beverage');
  const [accountType, setAccountType] = useState<Transaction['accountType']>('Cash');
  const [customCategory, setCustomCategory] = useState('');
  const [isCustom, setIsCustom] = useState(false);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const rawNum = parseFloat(amount);
    const finalCategory = isCustom ? (customCategory.trim() || 'General') : category;
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
      notes: notes ? `${notes} (Entered in ${currency})` : `Entered in ${currency}`
    });

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
    <div className="modal-overlay active">
      <div className="modal-card glass-card" style={{ background: '#141418', border: '1px solid rgba(0, 212, 255, 0.35)', boxShadow: '0 24px 80px rgba(0,0,0,0.9), 0 0 40px rgba(0, 212, 255, 0.2)' }}>
        <div className="modal-header" style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '12px', marginBottom: '20px' }}>
          <h3 style={{ margin: 0, color: '#ffffff', fontFamily: 'Plus Jakarta Sans', fontSize: '1.25rem', fontWeight: 800 }}>
            Record General Ledger Entry
          </h3>
          <button className="modal-close" onClick={onClose} style={{ color: '#9ca3af', fontSize: '1.5rem', background: 'none', border: 'none', cursor: 'pointer' }}>&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label style={{ fontSize: '0.8rem', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Counterparty / Description
            </label>
            <input 
              type="text" 
              className="input-text" 
              placeholder="e.g. Food Sales / Sysco Ingredients / Energy Utility"
              value={counterparty}
              onChange={(e) => setCounterparty(e.target.value)}
              required
              style={{ background: '#1a1a22', color: '#ffffff', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '10px', padding: '12px' }}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label style={{ fontSize: '0.8rem', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Account Ledger Type
              </label>
              <select 
                className="select-text"
                value={accountType}
                onChange={(e) => setAccountType(e.target.value as any)}
                style={{ background: '#1a1a22', color: '#ffffff', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '10px', padding: '12px' }}
              >
                <option value="Cash" style={{ background: '#141418', color: '#ffffff' }}>💵 Cash Account</option>
                <option value="Bank" style={{ background: '#141418', color: '#ffffff' }}>🏦 Bank Account</option>
                <option value="Accounts Receivable" style={{ background: '#141418', color: '#ffffff' }}>👥 Accounts Receivable (Customer)</option>
                <option value="Accounts Payable" style={{ background: '#141418', color: '#ffffff' }}>🧾 Accounts Payable (Supplier)</option>
                <option value="Revenue" style={{ background: '#141418', color: '#ffffff' }}>💰 Revenue Account</option>
                <option value="Expense" style={{ background: '#141418', color: '#ffffff' }}>💡 Expense Account</option>
              </select>
            </div>

            <div className="form-group">
              <label style={{ fontSize: '0.8rem', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Transaction Type
              </label>
              <select 
                className="select-text"
                value={type}
                onChange={(e) => setType(e.target.value as 'Expense' | 'Revenue')}
                style={{ background: '#1a1a22', color: '#ffffff', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '10px', padding: '12px' }}
              >
                <option value="Expense" style={{ background: '#141418', color: '#ffffff' }}>Expense (Money Out)</option>
                <option value="Revenue" style={{ background: '#141418', color: '#ffffff' }}>Revenue (Money In)</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label style={{ fontSize: '0.8rem', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Category
            </label>
            <select 
              className="select-text"
              value={isCustom ? '__CUSTOM__' : category}
              onChange={handleCategorySelectChange}
              style={{ background: '#1a1a22', color: '#ffffff', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '10px', padding: '12px' }}
            >
              <option value="Food & Beverage" style={{ background: '#141418', color: '#ffffff' }}>Food & Beverage</option>
              <option value="Ingredients & Produce" style={{ background: '#141418', color: '#ffffff' }}>Ingredients & Produce</option>
              <option value="Dining Sales" style={{ background: '#141418', color: '#ffffff' }}>Dining Sales</option>
              <option value="Kitchen Equipment" style={{ background: '#141418', color: '#ffffff' }}>Kitchen Equipment</option>
              <option value="Infrastructure" style={{ background: '#141418', color: '#ffffff' }}>Infrastructure</option>
              <option value="Payroll" style={{ background: '#141418', color: '#ffffff' }}>Payroll</option>
              <option value="Subscription" style={{ background: '#141418', color: '#ffffff' }}>Subscription ARR</option>
              <option value="Marketing" style={{ background: '#141418', color: '#ffffff' }}>Marketing</option>
              <option value="Supplies & Maintenance" style={{ background: '#141418', color: '#ffffff' }}>Supplies & Maintenance</option>
              <option value="Utilities" style={{ background: '#141418', color: '#ffffff' }}>Utilities</option>
              <option value="Treasury" style={{ background: '#141418', color: '#ffffff' }}>Treasury Yield</option>
              <option value="__CUSTOM__" style={{ background: '#141418', color: '#00d4ff', fontWeight: 'bold' }}>+ Custom Category...</option>
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
                placeholder="e.g. Catering Services, Wine Cellar, Software Licenses"
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                required={isCustom}
                style={{ background: '#1a1a22', color: '#ffffff', border: '1px solid #00d4ff', borderRadius: '10px', padding: '10px' }}
              />
            </div>
          )}

          <div className="form-row">
            <div className="form-group">
              <label style={{ fontSize: '0.8rem', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
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
                style={{ background: '#1a1a22', color: '#ffffff', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '10px', padding: '12px' }}
              />
            </div>
            <div className="form-group">
              <label style={{ fontSize: '0.8rem', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Date
              </label>
              <input 
                type="date" 
                className="input-text" 
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                style={{ background: '#1a1a22', color: '#ffffff', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '10px', padding: '12px' }}
              />
            </div>
          </div>

          <div className="form-group">
            <label style={{ fontSize: '0.8rem', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Notes / Audit Memo
            </label>
            <textarea 
              className="input-text" 
              rows={2}
              placeholder="Optional notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{ background: '#1a1a22', color: '#ffffff', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '10px', padding: '12px' }}
            />
          </div>

          <div className="modal-actions" style={{ marginTop: '24px' }}>
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
