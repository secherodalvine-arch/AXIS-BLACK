import React, { useState, useEffect, useRef } from 'react';
import { Currency } from '../types';
import { formatCurrency } from '../utils/currencyUtils';
import { getInventoryApi, createInventoryItemApi, importInventoryCsvApi, getBranchesApi, getStoredUser } from '../utils/api';

interface InventoryViewProps {
  currency?: Currency;
  searchQuery?: string;
}

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  stockLevel: number;
  minThreshold: number;
  unitPriceUSD: number;
  turnoverRate: string;
  status: 'Optimal' | 'Reorder Soon' | 'Surge Buffer';
}

export const InventoryView: React.FC<InventoryViewProps> = ({ currency = 'USD', searchQuery = '' }) => {
  const currentUser = getStoredUser();
  const isSubUserWithBranch = Boolean(currentUser?.is_sub_user && currentUser?.branch_id);

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Hardware & Devices');
  const [customCategory, setCustomCategory] = useState('');
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [stockQuantity, setStockQuantity] = useState('');
  const [reorderPoint, setReorderPoint] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [supplier, setSupplier] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [branchFilter, setBranchFilter] = useState<string>('');
  const [branches, setBranches] = useState<any[]>([]);
  const [itemBranchId, setItemBranchId] = useState<string>(currentUser?.branch_id || '');
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvStatus, setCsvStatus] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const csvInputRef = useRef<HTMLInputElement | null>(null);

  const fetchInventory = () => {
    setIsLoading(true);
    const activeBranch = isSubUserWithBranch ? currentUser?.branch_id : (branchFilter || undefined);
    getInventoryApi(activeBranch)
      .then((data) => {
        if (data && data.length) {
          const mapped: InventoryItem[] = data.map((d: any) => ({
            id: d.sku || d.id || `ITEM-${Math.floor(1000 + Math.random() * 9000)}`,
            name: d.name || 'Inventory Item',
            category: d.category || 'Inventory',
            stockLevel: Number(d.stock_quantity ?? d.stockLevel ?? 0),
            minThreshold: Number(d.reorder_point ?? d.minThreshold ?? 50),
            unitPriceUSD: Number(d.unit_cost ?? d.unitPriceUSD ?? 100),
            turnoverRate: d.velocity || '1.8x/mo',
            status: Number(d.stock_quantity ?? d.stockLevel ?? 0) <= Number(d.reorder_point ?? d.minThreshold ?? 50) ? 'Reorder Soon' : 'Optimal'
          }));
          setItems(mapped);
        } else {
          setItems([]);
        }
      })
      .catch((err) => {
        console.log('Live inventory fetch error:', err);
        setItems([]);
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    fetchInventory();
  }, [branchFilter]);

  useEffect(() => {
    getBranchesApi().then(b => {
      const list = Array.isArray(b) ? b : [];
      setBranches(list);
      if (isSubUserWithBranch && currentUser?.branch_id) {
        setItemBranchId(currentUser.branch_id);
      } else if (list.length > 0) {
        setItemBranchId(list[0].id);
      }
    }).catch(() => {});
  }, [isSubUserWithBranch]);

  const handleCsvImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvImporting(true);
    setCsvStatus(null);
    try {
      const result = await importInventoryCsvApi(file, branchFilter || undefined);
      setCsvStatus({ text: result.message || `Imported ${result.imported} items`, type: 'success' });
      fetchInventory();
    } catch (err: any) {
      setCsvStatus({ text: err.message || 'Import failed', type: 'error' });
    } finally {
      setCsvImporting(false);
      if (csvInputRef.current) csvInputRef.current.value = '';
      setTimeout(() => setCsvStatus(null), 6000);
    }
  };


  const handleCreateSKU = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    setSubmitting(true);

    const finalCategory = isCustomCategory ? (customCategory.trim() || 'Inventory') : category;
    const itemCode = `ITEM-${Math.floor(1000 + Math.random() * 9000)}`;
    const newItemData = {
      sku: itemCode,
      name,
      category: finalCategory,
      stock_quantity: parseInt(stockQuantity) || 0,
      reorder_point: parseInt(reorderPoint) || 50,
      unit_cost: parseFloat(unitCost) || 100,
      selling_price: parseFloat(sellingPrice) || 200,
      supplier: supplier || 'Primary Supplier',
      branch_id: isSubUserWithBranch ? currentUser?.branch_id : (itemBranchId || (branches[0]?.id || null))
    };

    try {
      await createInventoryItemApi(newItemData);
      // Re-fetch from backend to get the latest persisted state
      fetchInventory();
      setIsModalOpen(false);
      setName('');
      setSupplier('');
      setCustomCategory('');
      setIsCustomCategory(false);
    } catch (err) {
      console.error('Failed to save item to backend:', err);
      // Optimistic local update as fallback
      const newLocalItem: InventoryItem = {
        id: itemCode,
        name,
        category: finalCategory,
        stockLevel: parseInt(stockQuantity) || 0,
        minThreshold: parseInt(reorderPoint) || 50,
        unitPriceUSD: parseFloat(unitCost) || 100,
        turnoverRate: '1.8x/mo',
        status: (parseInt(stockQuantity) || 0) <= (parseInt(reorderPoint) || 50) ? 'Reorder Soon' : 'Optimal'
      };
      setItems(prev => [newLocalItem, ...prev]);
      setIsModalOpen(false);
      setName('');
      setSupplier('');
      setCustomCategory('');
      setIsCustomCategory(false);
    } finally {
      setSubmitting(false);
    }
  };

  const totalValuationUSD = items.reduce((acc, item) => acc + (item.stockLevel * item.unitPriceUSD), 0);
  
  // Dynamic categories list from items + presets
  const availableCategories = Array.from(new Set([
    'ALL',
    'Hardware & Devices',
    'Finished Goods & Products',
    'Raw Materials & Parts',
    'Office Equipment & Facilities',
    'Packaging & Logistics',
    ...items.map(i => i.category)
  ]));

  const effectiveSearch = searchQuery.toLowerCase().trim();
  const filteredItems = items.filter(item => {
    const matchesCategory = filterCategory === 'ALL' || item.category === filterCategory;
    const matchesSearch = !effectiveSearch || 
      item.name.toLowerCase().includes(effectiveSearch) ||
      item.category.toLowerCase().includes(effectiveSearch) ||
      item.id.toLowerCase().includes(effectiveSearch);
    return matchesCategory && matchesSearch;
  });

  const handleCategorySelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === '__CUSTOM__') {
      setIsCustomCategory(true);
    } else {
      setIsCustomCategory(false);
      setCategory(val);
    }
  };

  return (
    <div className="tab-view active">
      {/* View Header */}
      <div className="view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#fff', margin: 0, fontFamily: 'Plus Jakarta Sans' }}>
            Inventory
          </h2>
          <p className="subtitle" style={{ color: '#9ca3af', marginTop: '0.25rem' }}>
            Item stock levels, valuation, and automated low-stock reorder alerts
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {branches.length > 0 && !isSubUserWithBranch && (
            <select
              value={branchFilter}
              onChange={e => setBranchFilter(e.target.value)}
              style={{ background: '#1a1a22', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '8px 14px', color: branchFilter ? '#00d4ff' : '#9ca3af', fontSize: '0.82rem', cursor: 'pointer' }}
            >
              <option value="">All Branches</option>
              {branches.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
          {isSubUserWithBranch && (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(0, 212, 255, 0.1)',
              border: '1px solid rgba(0, 212, 255, 0.3)',
              borderRadius: '8px',
              padding: '6px 12px',
              fontSize: '0.8rem',
              color: '#00d4ff'
            }}>
              <i className="fa-solid fa-code-branch"></i>
              <span>{branches.find(b => b.id === currentUser?.branch_id)?.name || 'Assigned Branch'}</span>
            </div>
          )}
          <input ref={csvInputRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleCsvImport} />
          <button
            className="action-btn-secondary"
            onClick={() => csvInputRef.current?.click()}
            disabled={csvImporting}
            style={{ gap: '8px', fontSize: '0.82rem', display: 'flex', alignItems: 'center' }}
          >
            {csvImporting ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-file-import"></i>}
            {csvImporting ? 'Importing...' : 'Import CSV'}
          </button>
          <button className="action-btn-primary" onClick={() => setIsModalOpen(true)}>
            <i className="fa-solid fa-boxes-stacked"></i>
            <span>Add Inventory Item</span>
          </button>
        </div>
      </div>

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
        </div>
      )}

      {/* Top 4 Inventory Advisor Metric Highlights */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
        <div className="glass-card" style={{ padding: '1.25rem', borderRadius: '1rem' }}>
          <div style={{ fontSize: '0.75rem', fontFamily: 'JetBrains Mono', color: '#9ca3af' }}>TOTAL STOCK VALUATION</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#ffffff', fontFamily: 'JetBrains Mono', marginTop: '0.25rem' }}>
            {formatCurrency(totalValuationUSD, currency)}
          </div>
          <span className="trend-pill positive" style={{ fontSize: '0.72rem', marginTop: '0.5rem', display: 'inline-flex' }}>
            <i className="fa-solid fa-boxes-stacked"></i> {items.length} Items Tracked
          </span>
        </div>

        <div className="glass-card" style={{ padding: '1.25rem', borderRadius: '1rem' }}>
          <div style={{ fontSize: '0.75rem', fontFamily: 'JetBrains Mono', color: '#9ca3af' }}>STOCK TURNOVER RATE</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#00d4ff', fontFamily: 'JetBrains Mono', marginTop: '0.25rem' }}>
            {items.length > 0 ? `${(items.reduce((acc, i) => acc + (parseFloat(i.turnoverRate) || 1.8), 0) / items.length).toFixed(1)}x / mo` : '--'}
          </div>
          <span style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.5rem', display: 'block' }}>
            {items.length > 0 ? 'Stock Movement: Active' : 'No inventory items logged'}
          </span>
        </div>

        <div className="glass-card" style={{ padding: '1.25rem', borderRadius: '1rem' }}>
          <div style={{ fontSize: '0.75rem', fontFamily: 'JetBrains Mono', color: '#9ca3af' }}>ACTIVE UNITS IN STOCK</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#cebdff', fontFamily: 'JetBrains Mono', marginTop: '0.25rem' }}>
            {items.reduce((acc, item) => acc + item.stockLevel, 0).toLocaleString()} Units
          </div>
          <span style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.5rem', display: 'block' }}>
            Across {items.length} Tracked Item(s)
          </span>
        </div>

        <div className="glass-card" style={{ padding: '1.25rem', borderRadius: '1rem' }}>
          <div style={{ fontSize: '0.75rem', fontFamily: 'JetBrains Mono', color: '#9ca3af' }}>WAREHOUSE & STOCK HEALTH</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#ffafd3', fontFamily: 'JetBrains Mono', marginTop: '0.25rem' }}>
            {items.length ? `${(Math.round((items.filter(i => i.stockLevel > i.minThreshold).length / items.length) * 1000) / 10).toFixed(1)}%` : '--'}
          </div>
          <span style={{ fontSize: '0.75rem', color: items.some(i => i.stockLevel <= i.minThreshold) ? '#ff8e8e' : '#4ade80', marginTop: '0.5rem', display: 'block' }}>
            {items.length ? `${items.filter(i => i.stockLevel <= i.minThreshold).length} Low Stock Alert(s)` : 'No items recorded'}
          </span>
        </div>
      </div>

      {/* Main Item Table */}
      <div className="glass-card" style={{ padding: '1.5rem', borderRadius: '1.1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#ffffff', fontFamily: 'Plus Jakarta Sans', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
            <i className="fa-solid fa-list-check" style={{ color: '#00d4ff' }}></i>
            Stock Inventory & Status
          </h3>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <select 
              className="select-text"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              style={{ width: '220px', padding: '6px 12px', background: '#141418', color: '#ffffff', border: '1px solid rgba(255, 255, 255, 0.15)' }}
            >
              {availableCategories.map(cat => (
                <option key={cat} value={cat} style={{ background: '#141418', color: '#ffffff' }}>
                  {cat === 'ALL' ? 'All Categories' : cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Item Code</th>
                <th>Item Description</th>
                <th>Category</th>
                <th>Stock Units</th>
                <th>Unit Value</th>
                <th>Total Valuation</th>
                <th>Turnover</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '3rem 1rem', color: '#64748b' }}>
                    <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: '1.6rem', display: 'block', marginBottom: '0.75rem', color: '#00d4ff', opacity: 0.7 }}></i>
                    <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Loading your inventory from the server...</div>
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '3rem 1rem', color: '#64748b' }}>
                    <i className="fa-solid fa-boxes-stacked" style={{ fontSize: '1.8rem', display: 'block', marginBottom: '0.75rem', opacity: 0.3 }}></i>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.35rem' }}>
                      {filterCategory !== 'ALL' ? `No items in "${filterCategory}" category` : 'No inventory items yet'}
                    </div>
                    <div style={{ fontSize: '0.8rem' }}>Click <strong>Add Inventory Item</strong> to log your first SKU.</div>
                  </td>
                </tr>
              ) : (
                filteredItems.map(item => {
                  const totalVal = item.stockLevel * item.unitPriceUSD;
                  return (
                    <tr key={item.id}>
                      <td className="ref-code">{item.id}</td>
                      <td>
                        <div className="counterparty-cell">
                          <div className="entity-avatar" style={{ background: 'rgba(0, 212, 255, 0.15)', color: '#00d4ff' }}>
                            <i className="fa-solid fa-box"></i>
                          </div>
                          <span style={{ fontWeight: 600, color: '#fff' }}>{item.name}</span>
                        </div>
                      </td>
                      <td style={{ color: '#9ca3af' }}>{item.category}</td>
                      <td style={{ fontFamily: 'JetBrains Mono', fontWeight: 600, color: item.stockLevel < item.minThreshold ? '#ff8e8e' : '#e5e2e1' }}>
                        {item.stockLevel} units (Min: {item.minThreshold})
                      </td>
                      <td style={{ fontFamily: 'JetBrains Mono' }}>
                        {formatCurrency(item.unitPriceUSD, currency)}
                      </td>
                      <td style={{ fontFamily: 'JetBrains Mono', fontWeight: 700, color: '#cebdff' }}>
                        {formatCurrency(totalVal, currency)}
                      </td>
                      <td style={{ fontFamily: 'JetBrains Mono', color: '#00d4ff' }}>
                        {item.turnoverRate}
                      </td>
                      <td>
                        <span className={`status-badge ${item.status === 'Reorder Soon' ? 'status-pending' : item.status === 'Optimal' ? 'status-cleared' : 'status-processing'}`}>
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD NEW INVENTORY ITEM MODAL */}
      {isModalOpen && (
        <div className="modal-overlay active">
          <div className="modal-card glass-card" style={{ background: '#141418', border: '1px solid rgba(0, 212, 255, 0.35)', boxShadow: '0 24px 80px rgba(0,0,0,0.9), 0 0 40px rgba(0, 212, 255, 0.2)', maxHeight: '88vh', overflowY: 'auto' }}>
            <div className="modal-header" style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '12px', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, color: '#ffffff', fontFamily: 'Plus Jakarta Sans', fontSize: '1.25rem', fontWeight: 800 }}>
                Add New Inventory Item
              </h3>
              <button className="modal-close" onClick={() => setIsModalOpen(false)} style={{ color: '#9ca3af', fontSize: '1.5rem', background: 'none', border: 'none', cursor: 'pointer' }}>&times;</button>
            </div>
            
            <form onSubmit={handleCreateSKU}>
              {isSubUserWithBranch ? (
                <div style={{
                  padding: '12px 14px',
                  borderRadius: '10px',
                  background: 'rgba(0, 212, 255, 0.08)',
                  border: '1px solid rgba(0, 212, 255, 0.25)',
                  color: '#00d4ff',
                  fontSize: '0.85rem',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <i className="fa-solid fa-building-circle-check"></i>
                  <span>Branch: <strong>{branches.find(b => b.id === currentUser?.branch_id)?.name || 'Assigned Branch'}</strong> (Auto-locked)</span>
                </div>
              ) : branches.length > 0 ? (
                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '0.8rem', color: '#00d4ff', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    <i className="fa-solid fa-code-branch" style={{ marginRight: '6px' }}></i> Assign to Branch *
                  </label>
                  <select
                    className="select-text"
                    value={itemBranchId}
                    onChange={(e) => setItemBranchId(e.target.value)}
                    required
                    style={{ background: '#1a1a22', color: '#ffffff', border: '1px solid rgba(0, 212, 255, 0.35)', borderRadius: '10px', padding: '12px' }}
                  >
                    {branches.map(b => (
                      <option key={b.id} value={b.id} style={{ background: '#141418', color: '#ffffff' }}>
                        {b.name} {b.location ? `(${b.location})` : ''} {b.is_main ? '· [HQ / Main Branch]' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div style={{ padding: '12px 14px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', color: '#f59e0b', fontSize: '0.85rem', marginBottom: '16px' }}>
                  <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: '8px' }}></i>
                  Set up your business &amp; branch in <strong>My Business</strong> to categorize inventory across branches.
                </div>
              )}

              <div className="form-group">
                <label style={{ fontSize: '0.8rem', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Item Name / Description
                </label>
                <input 
                  type="text" 
                  className="input-text" 
                  placeholder="e.g. Server Rack Mount / Display Unit / Packaging Stock"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  style={{ background: '#1a1a22', color: '#ffffff', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '10px', padding: '12px' }}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label style={{ fontSize: '0.8rem', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Category
                  </label>
                  <select 
                    className="select-text"
                    value={isCustomCategory ? '__CUSTOM__' : category}
                    onChange={handleCategorySelectChange}
                    style={{ background: '#1a1a22', color: '#ffffff', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '10px', padding: '12px' }}
                  >
                    <option value="Hardware & Devices" style={{ background: '#141418', color: '#ffffff' }}>Hardware & Devices</option>
                    <option value="Finished Goods & Products" style={{ background: '#141418', color: '#ffffff' }}>Finished Goods & Products</option>
                    <option value="Raw Materials & Parts" style={{ background: '#141418', color: '#ffffff' }}>Raw Materials & Parts</option>
                    <option value="Office Equipment & Facilities" style={{ background: '#141418', color: '#ffffff' }}>Office Equipment & Facilities</option>
                    <option value="Packaging & Logistics" style={{ background: '#141418', color: '#ffffff' }}>Packaging & Logistics</option>
                    <option value="__CUSTOM__" style={{ background: '#141418', color: '#00d4ff', fontWeight: 'bold' }}>+ Custom Category...</option>
                  </select>
                </div>

                <div className="form-group">
                  <label style={{ fontSize: '0.8rem', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Initial Stock Units
                  </label>
                  <input 
                    type="number" 
                    className="input-text" 
                    placeholder="0"
                    value={stockQuantity}
                    onChange={(e) => setStockQuantity(e.target.value)}
                    required
                    style={{ background: '#1a1a22', color: '#ffffff', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '10px', padding: '12px' }}
                  />
                </div>
              </div>

              {isCustomCategory && (
                <div className="form-group" style={{ marginTop: '-4px' }}>
                  <label style={{ fontSize: '0.75rem', color: '#00d4ff', fontWeight: 600, textTransform: 'uppercase' }}>
                    Enter Custom Category Name
                  </label>
                  <input 
                    type="text" 
                    className="input-text" 
                    placeholder="e.g. Spare Parts, Electronics, Retail Stock"
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    required={isCustomCategory}
                    style={{ background: '#1a1a22', color: '#ffffff', border: '1px solid #00d4ff', borderRadius: '10px', padding: '10px' }}
                  />
                </div>
              )}

              <div className="form-row">
                <div className="form-group">
                  <label style={{ fontSize: '0.8rem', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Reorder Alert Threshold
                  </label>
                  <input 
                    type="number" 
                    className="input-text" 
                    placeholder="50"
                    value={reorderPoint}
                    onChange={(e) => setReorderPoint(e.target.value)}
                    required
                    style={{ background: '#1a1a22', color: '#ffffff', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '10px', padding: '12px' }}
                  />
                </div>

                <div className="form-group">
                  <label style={{ fontSize: '0.8rem', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Unit Cost ($)
                  </label>
                  <input 
                    type="number" 
                    step="0.01"
                    className="input-text" 
                    placeholder="0.00"
                    value={unitCost}
                    onChange={(e) => setUnitCost(e.target.value)}
                    required
                    style={{ background: '#1a1a22', color: '#ffffff', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '10px', padding: '12px' }}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label style={{ fontSize: '0.8rem', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Selling Price ($)
                  </label>
                  <input 
                    type="number" 
                    step="0.01"
                    className="input-text" 
                    placeholder="0.00"
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(e.target.value)}
                    required
                    style={{ background: '#1a1a22', color: '#ffffff', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '10px', padding: '12px' }}
                  />
                </div>

                <div className="form-group">
                  <label style={{ fontSize: '0.8rem', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Supplier / Vendor
                  </label>
                  <input 
                    type="text" 
                    className="input-text" 
                    placeholder="e.g. Apex Supply Co. / Global Tech"
                    value={supplier}
                    onChange={(e) => setSupplier(e.target.value)}
                    required
                    style={{ background: '#1a1a22', color: '#ffffff', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '10px', padding: '12px' }}
                  />
                </div>
              </div>

              <div className="modal-actions" style={{ marginTop: '24px' }}>
                <button type="button" className="action-btn-secondary" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="action-btn-primary" disabled={submitting}>
                  {submitting ? 'Saving...' : 'Save Inventory Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

