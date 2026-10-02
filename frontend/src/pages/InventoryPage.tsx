import React, { useState, useEffect, useRef } from 'react';
import { Currency, UserSubscription } from '../types';
import { formatCurrency } from '../utils/currencyUtils';
import { 
  getInventoryApi, 
  createInventoryItemApi, 
  updateInventoryItemApi, 
  deleteInventoryItemApi, 
  importInventoryCsvApi, 
  getBranchesApi, 
  getStoredUser 
} from '../utils/api';
import { generateSmartItemCode } from '../utils/skuUtils';

interface InventoryViewProps {
  currency?: Currency;
  searchQuery?: string;
  subscription?: UserSubscription | null;
  onOpenUpgrade?: (reason?: string, feature?: string) => void;
}

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  stockLevel: number;
  minThreshold: number;
  unitPriceUSD: number;
  sellingPriceUSD?: number;
  supplier?: string;
  turnoverRate: string;
  status: 'Optimal' | 'Reorder Soon' | 'Surge Buffer';
  branch_id?: string;
}

export const InventoryView: React.FC<InventoryViewProps> = ({ 
  currency = 'USD', 
  searchQuery = '',
  subscription,
  onOpenUpgrade
}) => {
  const currentUser = getStoredUser();
  const isSubUserWithBranch = Boolean(currentUser?.is_sub_user && currentUser?.branch_id);

  const [items, setItems] = useState<InventoryItem[]>([]);
  const isFreeTier = subscription?.plan_key === 'free' || (!subscription && true);
  const isFreeLimitReached = Boolean(isFreeTier && items.length >= 2);
  const [isLoading, setIsLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State (New SKU)
  const [name, setName] = useState('');
  const [customSKU, setCustomSKU] = useState('');
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

  // Edit SKU State
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('Hardware & Devices');
  const [editCustomCategory, setEditCustomCategory] = useState('');
  const [isEditCustomCategory, setIsEditCustomCategory] = useState(false);
  const [editStockQuantity, setEditStockQuantity] = useState('');
  const [editReorderPoint, setEditReorderPoint] = useState('');
  const [editUnitCost, setEditUnitCost] = useState('');
  const [editSellingPrice, setEditSellingPrice] = useState('');
  const [editSupplier, setEditSupplier] = useState('');
  const [editBranchId, setEditBranchId] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

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
            sellingPriceUSD: Number(d.selling_price ?? (d.unit_cost ? d.unit_cost * 1.5 : 150)),
            supplier: d.supplier || 'Primary Supplier',
            turnoverRate: d.velocity || '1.8x/mo',
            status: Number(d.stock_quantity ?? d.stockLevel ?? 0) <= Number(d.reorder_point ?? d.minThreshold ?? 50) ? 'Reorder Soon' : 'Optimal',
            branch_id: d.branch_id
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
      const activeBranch = isSubUserWithBranch ? currentUser?.branch_id : (branchFilter || (branches.length === 1 ? branches[0].id : undefined));
      const result = await importInventoryCsvApi(file, activeBranch);
      setCsvStatus({ text: result.message || `Imported ${result.imported} items`, type: 'success' });
      fetchInventory();
      window.dispatchEvent(new CustomEvent('axis-data-updated'));
    } catch (err: any) {
      setCsvStatus({ text: err.message || 'Import failed', type: 'error' });
    } finally {
      setCsvImporting(false);
      if (csvInputRef.current) csvInputRef.current.value = '';
      setTimeout(() => setCsvStatus(null), 6000);
    }
  };

  useEffect(() => {
    const handleSync = () => fetchInventory();
    window.addEventListener('axis-data-updated', handleSync);
    return () => window.removeEventListener('axis-data-updated', handleSync);
  }, []);


  const handleCreateSKU = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    setSubmitting(true);

    const finalCategory = isCustomCategory ? (customCategory.trim() || 'Inventory') : category;
    const itemCode = customSKU.trim() || generateSmartItemCode(finalCategory, name);
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
      setCustomSKU('');
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
      setCustomSKU('');
      setSupplier('');
      setCustomCategory('');
      setIsCustomCategory(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setEditName(item.name);
    const standardCategories = [
      'Hardware & Devices',
      'Finished Goods & Products',
      'Raw Materials & Parts',
      'Office Equipment & Facilities',
      'Packaging & Logistics'
    ];
    if (standardCategories.includes(item.category)) {
      setEditCategory(item.category);
      setIsEditCustomCategory(false);
      setEditCustomCategory('');
    } else {
      setEditCategory('__CUSTOM__');
      setIsEditCustomCategory(true);
      setEditCustomCategory(item.category);
    }
    setEditStockQuantity(item.stockLevel.toString());
    setEditReorderPoint(item.minThreshold.toString());
    setEditUnitCost(item.unitPriceUSD.toString());
    setEditSellingPrice((item.sellingPriceUSD || (item.unitPriceUSD * 1.5)).toString());
    setEditSupplier(item.supplier || '');
    setEditBranchId(item.branch_id || '');
    setEditError(null);
    setIsEditModalOpen(true);
  };

  const handleEditCategorySelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === '__CUSTOM__') {
      setIsEditCustomCategory(true);
      setEditCategory('__CUSTOM__');
    } else {
      setIsEditCustomCategory(false);
      setEditCategory(val);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    setIsSavingEdit(true);
    setEditError(null);

    const finalCategory = isEditCustomCategory ? (editCustomCategory.trim() || 'Inventory') : editCategory;
    const updates = {
      name: editName,
      category: finalCategory,
      stock_quantity: parseInt(editStockQuantity) || 0,
      reorder_point: parseInt(editReorderPoint) || 50,
      unit_cost: parseFloat(editUnitCost) || 0,
      selling_price: parseFloat(editSellingPrice) || 0,
      supplier: editSupplier || 'Global Supplier',
      branch_id: editBranchId || undefined
    };

    try {
      await updateInventoryItemApi(editingItem.id, updates);
      setIsEditModalOpen(false);
      setEditingItem(null);
      fetchInventory();
      window.dispatchEvent(new CustomEvent('axis-data-updated'));
    } catch (err: any) {
      setEditError(err.message || 'Failed to update item');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDelete = async (sku: string, itemName: string) => {
    if (!window.confirm(`Are you sure you want to delete SKU "${sku}" (${itemName})? This will permanently remove it from inventory.`)) {
      return;
    }
    try {
      await deleteInventoryItemApi(sku);
      fetchInventory();
      window.dispatchEvent(new CustomEvent('axis-data-updated'));
    } catch (err: any) {
      alert(err.message || 'Failed to delete inventory item');
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
          <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-main, #fff)', margin: 0, fontFamily: 'Plus Jakarta Sans' }}>
            Inventory
          </h2>
          <p className="subtitle" style={{ color: 'var(--text-muted, #9ca3af)', marginTop: '0.25rem' }}>
            Item stock levels, valuation, and automated low-stock reorder alerts
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'nowrap', overflowX: 'auto', maxWidth: '100%', paddingBottom: '4px' }}>
          {branches.length > 0 && !isSubUserWithBranch && (
            <select
              value={branchFilter}
              onChange={e => setBranchFilter(e.target.value)}
              style={{ background: 'var(--dropdown-bg, #1a1a22)', border: '1px solid var(--search-border, rgba(255,255,255,0.1))', borderRadius: '10px', padding: '8px 14px', color: branchFilter ? '#00d4ff' : 'var(--text-main, #9ca3af)', fontSize: '0.82rem', cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' }}
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
              color: '#00d4ff',
              flexShrink: 0,
              whiteSpace: 'nowrap'
            }}>
              <i className="fa-solid fa-code-branch"></i>
              <span>{branches.find(b => b.id === currentUser?.branch_id)?.name || currentUser?.branch_name || 'Assigned Branch'}</span>
            </div>
          )}
          {isFreeTier && (
            <div style={{
              fontSize: '0.78rem',
              background: isFreeLimitReached ? 'rgba(239, 68, 68, 0.12)' : 'rgba(0, 212, 255, 0.08)',
              border: `1px solid ${isFreeLimitReached ? 'rgba(239, 68, 68, 0.3)' : 'rgba(0, 212, 255, 0.2)'}`,
              color: isFreeLimitReached ? '#f87171' : '#00d4ff',
              padding: '4px 10px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              flexShrink: 0
            }}>
              <i className={isFreeLimitReached ? "fa-solid fa-lock" : "fa-solid fa-layer-group"}></i>
              <span>{items.length} / 2 Items (Free{isFreeLimitReached ? ' Limit Reached' : ''})</span>
            </div>
          )}

          <input ref={csvInputRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleCsvImport} />
          <button
            className="action-btn-secondary"
            onClick={() => {
              if (isFreeLimitReached) {
                if (onOpenUpgrade) {
                  onOpenUpgrade('Free tier is limited to 2 inventory items. Upgrade to Starter or Pro for unlimited inventory uploads.', 'Inventory Import');
                }
                return;
              }
              csvInputRef.current?.click();
            }}
            disabled={csvImporting}
            style={{ gap: '8px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', flexShrink: 0, whiteSpace: 'nowrap' }}
          >
            {csvImporting ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-file-import"></i>}
            {csvImporting ? 'Importing...' : 'Import CSV'}
          </button>
          <button 
            className="action-btn-primary" 
            onClick={() => {
              if (isFreeLimitReached) {
                if (onOpenUpgrade) {
                  onOpenUpgrade('Free tier is limited to 2 inventory items. Upgrade to Starter or Pro for unlimited SKU management.', 'Inventory Engine');
                }
                return;
              }
              setIsModalOpen(true);
            }} 
            style={{ flexShrink: 0, whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          >
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
      <div className="inventory-metrics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '1.25rem' }}>
        <div className="glass-card" style={{ padding: '1.25rem', borderRadius: '1rem' }}>
          <div style={{ fontSize: '0.75rem', fontFamily: 'JetBrains Mono', color: 'var(--text-muted, #9ca3af)' }}>TOTAL STOCK VALUATION</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main, #ffffff)', fontFamily: 'JetBrains Mono', marginTop: '0.25rem' }}>
            {formatCurrency(totalValuationUSD, currency)}
          </div>
          <span className="trend-pill positive" style={{ fontSize: '0.72rem', marginTop: '0.5rem', display: 'inline-flex' }}>
            <i className="fa-solid fa-boxes-stacked"></i> {items.length} Items Tracked
          </span>
        </div>

        <div className="glass-card" style={{ padding: '1.25rem', borderRadius: '1rem' }}>
          <div style={{ fontSize: '0.75rem', fontFamily: 'JetBrains Mono', color: 'var(--text-muted, #9ca3af)' }}>STOCK TURNOVER RATE</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#00d4ff', fontFamily: 'JetBrains Mono', marginTop: '0.25rem' }}>
            {items.length > 0 ? `${(items.reduce((acc, i) => acc + (parseFloat(i.turnoverRate) || 1.8), 0) / items.length).toFixed(1)}x / mo` : '--'}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #9ca3af)', marginTop: '0.5rem', display: 'block' }}>
            {items.length > 0 ? 'Stock Movement: Active' : 'No inventory items logged'}
          </span>
        </div>

        <div className="glass-card" style={{ padding: '1.25rem', borderRadius: '1rem' }}>
          <div style={{ fontSize: '0.75rem', fontFamily: 'JetBrains Mono', color: 'var(--text-muted, #9ca3af)' }}>ACTIVE UNITS IN STOCK</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--primary-lilac-glow, #cebdff)', fontFamily: 'JetBrains Mono', marginTop: '0.25rem' }}>
            {items.reduce((acc, item) => acc + item.stockLevel, 0).toLocaleString()} Units
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #9ca3af)', marginTop: '0.5rem', display: 'block' }}>
            Across {items.length} Tracked Item(s)
          </span>
        </div>

        <div className="glass-card" style={{ padding: '1.25rem', borderRadius: '1rem' }}>
          <div style={{ fontSize: '0.75rem', fontFamily: 'JetBrains Mono', color: 'var(--text-muted, #9ca3af)' }}>WAREHOUSE & STOCK HEALTH</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--tertiary-pink-glow, #ffafd3)', fontFamily: 'JetBrains Mono', marginTop: '0.25rem' }}>
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
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main, #ffffff)', fontFamily: 'Plus Jakarta Sans', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
            <i className="fa-solid fa-list-check" style={{ color: '#00d4ff' }}></i>
            Stock Inventory & Status
          </h3>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <select 
              className="select-text"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              style={{ width: '220px', padding: '6px 12px', background: 'var(--search-bg, #141418)', color: 'var(--text-main, #ffffff)', border: '1px solid var(--search-border, rgba(255, 255, 255, 0.15))' }}
            >
              {availableCategories.map(cat => (
                <option key={cat} value={cat} style={{ background: 'var(--dropdown-bg, #141418)', color: 'var(--text-main, #ffffff)' }}>
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
                <th style={{ textAlign: 'center', width: '90px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-dim, #64748b)' }}>
                    <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: '1.6rem', display: 'block', marginBottom: '0.75rem', color: '#00d4ff', opacity: 0.7 }}></i>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted, #94a3b8)' }}>Loading your inventory from the server...</div>
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-dim, #64748b)' }}>
                    <i className="fa-solid fa-boxes-stacked" style={{ fontSize: '1.8rem', display: 'block', marginBottom: '0.75rem', opacity: 0.3 }}></i>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-muted, #94a3b8)', marginBottom: '0.35rem' }}>
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
                          <span style={{ fontWeight: 600, color: 'var(--text-main, #fff)' }}>{item.name}</span>
                        </div>
                      </td>
                      <td style={{ color: 'var(--text-muted, #9ca3af)' }}>{item.category}</td>
                      <td style={{ fontFamily: 'JetBrains Mono', fontWeight: 600, color: item.stockLevel < item.minThreshold ? '#ff8e8e' : 'var(--text-main, #e5e2e1)' }}>
                        {item.stockLevel} units (Min: {item.minThreshold})
                      </td>
                      <td style={{ fontFamily: 'JetBrains Mono' }}>
                        {formatCurrency(item.unitPriceUSD, currency)}
                      </td>
                      <td style={{ fontFamily: 'JetBrains Mono', fontWeight: 700, color: 'var(--primary-lilac-glow, #cebdff)' }}>
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
                      <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                          <button
                            onClick={() => handleOpenEdit(item)}
                            style={{
                              background: 'rgba(0, 212, 255, 0.1)',
                              border: '1px solid rgba(0, 212, 255, 0.3)',
                              color: '#00d4ff',
                              borderRadius: '6px',
                              padding: '5px 8px',
                              fontSize: '0.78rem',
                              cursor: 'pointer',
                              transition: 'all 0.2s'
                            }}
                            title="Edit inventory SKU"
                          >
                            <i className="fa-solid fa-pen-to-square"></i>
                          </button>
                          <button
                            onClick={() => handleDelete(item.id, item.name)}
                            style={{
                              background: 'rgba(255, 142, 142, 0.1)',
                              border: '1px solid rgba(255, 142, 142, 0.3)',
                              color: '#ff8e8e',
                              borderRadius: '6px',
                              padding: '5px 8px',
                              fontSize: '0.78rem',
                              cursor: 'pointer',
                              transition: 'all 0.2s'
                            }}
                            title="Delete SKU"
                          >
                            <i className="fa-solid fa-trash"></i>
                          </button>
                        </div>
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
        <div className="modal-overlay active" style={{ zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div className="modal-card glass-card" style={{ width: '560px', maxWidth: '95vw', maxHeight: '85vh', display: 'flex', flexDirection: 'column', background: 'var(--dropdown-bg, #141418)', border: '1px solid var(--dropdown-border, rgba(0, 212, 255, 0.35))', boxShadow: 'var(--dropdown-shadow, 0 24px 80px rgba(0,0,0,0.9))', padding: '24px', borderRadius: '20px' }}>
            <div className="modal-header" style={{ borderBottom: '1px solid var(--header-border, rgba(255, 255, 255, 0.1))', paddingBottom: '12px', marginBottom: '16px', flexShrink: 0 }}>
              <h3 style={{ margin: 0, color: 'var(--text-main, #ffffff)', fontFamily: 'Plus Jakarta Sans', fontSize: '1.25rem', fontWeight: 800 }}>
                Add New Inventory Item
              </h3>
              <button className="modal-close" onClick={() => setIsModalOpen(false)} style={{ color: 'var(--text-muted, #9ca3af)', fontSize: '1.5rem', background: 'none', border: 'none', cursor: 'pointer' }}>&times;</button>
            </div>
            
            <form onSubmit={handleCreateSKU} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <div style={{ overflowY: 'auto', flex: 1, paddingRight: '6px', minHeight: 0 }}>
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
                    style={{ background: 'var(--search-bg, #1a1a22)', color: 'var(--text-main, #ffffff)', border: '1px solid rgba(0, 212, 255, 0.35)', borderRadius: '10px', padding: '12px' }}
                  >
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>
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

              <div className="form-row">
                <div className="form-group" style={{ flex: 1.3 }}>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted, #9ca3af)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Item Name / Description *
                  </label>
                  <input 
                    type="text" 
                    className="input-text" 
                    placeholder="e.g. Server Rack Mount / Display Unit"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    style={{ background: 'var(--search-bg, #1a1a22)', color: 'var(--text-main, #ffffff)', border: '1px solid var(--search-border, rgba(255, 255, 255, 0.15))', borderRadius: '10px', padding: '12px' }}
                  />
                </div>

                <div className="form-group" style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted, #9ca3af)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Item Code / SKU <span style={{ color: '#9ca3af', fontWeight: 400, textTransform: 'none' }}>(Optional)</span>
                  </label>
                  <input 
                    type="text" 
                    className="input-text" 
                    placeholder="Auto-assigned if empty (e.g. HW-1042)"
                    value={customSKU}
                    onChange={(e) => setCustomSKU(e.target.value)}
                    style={{ background: 'var(--search-bg, #1a1a22)', color: 'var(--text-main, #ffffff)', border: '1px solid var(--search-border, rgba(255, 255, 255, 0.15))', borderRadius: '10px', padding: '12px' }}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted, #9ca3af)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Category
                  </label>
                  <select 
                    className="select-text"
                    value={isCustomCategory ? '__CUSTOM__' : category}
                    onChange={handleCategorySelectChange}
                    style={{ background: 'var(--search-bg, #1a1a22)', color: 'var(--text-main, #ffffff)', border: '1px solid var(--search-border, rgba(255, 255, 255, 0.15))', borderRadius: '10px', padding: '12px' }}
                  >
                    <option value="Hardware & Devices">Hardware & Devices</option>
                    <option value="Finished Goods & Products">Finished Goods & Products</option>
                    <option value="Raw Materials & Parts">Raw Materials & Parts</option>
                    <option value="Office Equipment & Facilities">Office Equipment & Facilities</option>
                    <option value="Packaging & Logistics">Packaging & Logistics</option>
                    <option value="__CUSTOM__">+ Custom Category...</option>
                  </select>
                </div>

                <div className="form-group">
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted, #9ca3af)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Initial Stock Units
                  </label>
                  <input 
                    type="number" 
                    className="input-text" 
                    placeholder="0"
                    value={stockQuantity}
                    onChange={(e) => setStockQuantity(e.target.value)}
                    required
                    style={{ background: 'var(--search-bg, #1a1a22)', color: 'var(--text-main, #ffffff)', border: '1px solid var(--search-border, rgba(255, 255, 255, 0.15))', borderRadius: '10px', padding: '12px' }}
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
                    style={{ background: 'var(--search-bg, #1a1a22)', color: 'var(--text-main, #ffffff)', border: '1px solid #00d4ff', borderRadius: '10px', padding: '10px' }}
                  />
                </div>
              )}

              <div className="form-row">
                <div className="form-group">
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted, #9ca3af)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Reorder Alert Threshold
                  </label>
                  <input 
                    type="number" 
                    className="input-text" 
                    placeholder="50"
                    value={reorderPoint}
                    onChange={(e) => setReorderPoint(e.target.value)}
                    required
                    style={{ background: 'var(--search-bg, #1a1a22)', color: 'var(--text-main, #ffffff)', border: '1px solid var(--search-border, rgba(255, 255, 255, 0.15))', borderRadius: '10px', padding: '12px' }}
                  />
                </div>

                <div className="form-group">
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted, #9ca3af)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
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
                    style={{ background: 'var(--search-bg, #1a1a22)', color: 'var(--text-main, #ffffff)', border: '1px solid var(--search-border, rgba(255, 255, 255, 0.15))', borderRadius: '10px', padding: '12px' }}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted, #9ca3af)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
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
                    style={{ background: 'var(--search-bg, #1a1a22)', color: 'var(--text-main, #ffffff)', border: '1px solid var(--search-border, rgba(255, 255, 255, 0.15))', borderRadius: '10px', padding: '12px' }}
                  />
                </div>

                <div className="form-group">
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted, #9ca3af)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Supplier / Vendor
                  </label>
                  <input 
                    type="text" 
                    className="input-text" 
                    placeholder="e.g. Apex Supply Co. / Global Tech"
                    value={supplier}
                    onChange={(e) => setSupplier(e.target.value)}
                    required
                    style={{ background: 'var(--search-bg, #1a1a22)', color: 'var(--text-main, #ffffff)', border: '1px solid var(--search-border, rgba(255, 255, 255, 0.15))', borderRadius: '10px', padding: '12px' }}
                  />
                </div>
              </div>

              </div>

              <div className="modal-actions" style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--header-border, rgba(255, 255, 255, 0.08))', flexShrink: 0, display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
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

      {/* EDIT INVENTORY ITEM MODAL */}
      {isEditModalOpen && editingItem && (
        <div className="modal-overlay active" style={{ zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div className="modal-card glass-card" style={{ width: '560px', maxWidth: '95vw', maxHeight: '88vh', display: 'flex', flexDirection: 'column', background: 'var(--dropdown-bg, #141418)', border: '1px solid rgba(0, 212, 255, 0.35)', boxShadow: '0 24px 80px rgba(0,0,0,0.9)', padding: '24px', borderRadius: '20px' }}>
            <div className="modal-header" style={{ borderBottom: '1px solid var(--header-border, rgba(255, 255, 255, 0.1))', paddingBottom: '12px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div>
                <h3 style={{ margin: 0, color: 'var(--text-main, #ffffff)', fontFamily: 'Plus Jakarta Sans', fontSize: '1.25rem', fontWeight: 800 }}>
                  Edit Inventory SKU
                </h3>
                <span style={{ fontSize: '0.75rem', fontFamily: 'JetBrains Mono', color: '#00d4ff' }}>
                  {editingItem.id}
                </span>
              </div>
              <button className="modal-close" onClick={() => setIsEditModalOpen(false)} style={{ color: 'var(--text-muted, #9ca3af)', fontSize: '1.5rem', background: 'none', border: 'none', cursor: 'pointer' }}>&times;</button>
            </div>

            {editError && (
              <div style={{ padding: '8px 12px', borderRadius: '8px', background: 'rgba(255, 142, 142, 0.15)', border: '1px solid #ff8e8e', color: '#ff8e8e', fontSize: '0.82rem', marginBottom: '12px' }}>
                <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: '6px' }}></i> {editError}
              </div>
            )}

            <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <div style={{ overflowY: 'auto', flex: 1, paddingRight: '6px', minHeight: 0 }}>
                {branches.length > 0 && !isSubUserWithBranch && (
                  <div className="form-group" style={{ marginBottom: '14px' }}>
                    <label style={{ fontSize: '0.78rem', color: '#00d4ff', fontWeight: 600, textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>
                      Branch Location
                    </label>
                    <select
                      className="select-text"
                      value={editBranchId}
                      onChange={e => setEditBranchId(e.target.value)}
                      style={{ background: 'var(--search-bg, #1a1a22)', color: 'var(--text-main, #ffffff)', border: '1px solid rgba(0, 212, 255, 0.35)', borderRadius: '10px', padding: '10px' }}
                    >
                      <option value="">HQ / Unassigned</option>
                      {branches.map(b => (
                        <option key={b.id} value={b.id}>{b.name} {b.location ? `(${b.location})` : ''}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="form-group" style={{ marginBottom: '14px' }}>
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-muted, #9ca3af)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>
                    Item Name / Description *
                  </label>
                  <input
                    type="text"
                    className="input-text"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    required
                    style={{ background: 'var(--search-bg, #1a1a22)', color: 'var(--text-main, #ffffff)', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '10px', padding: '10px' }}
                  />
                </div>

                <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                  <div className="form-group">
                    <label style={{ fontSize: '0.78rem', color: 'var(--text-muted, #9ca3af)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>
                      Category
                    </label>
                    <select
                      className="select-text"
                      value={isEditCustomCategory ? '__CUSTOM__' : editCategory}
                      onChange={handleEditCategorySelectChange}
                      style={{ background: 'var(--search-bg, #1a1a22)', color: 'var(--text-main, #ffffff)', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '10px', padding: '10px' }}
                    >
                      <option value="Hardware & Devices">Hardware & Devices</option>
                      <option value="Finished Goods & Products">Finished Goods & Products</option>
                      <option value="Raw Materials & Parts">Raw Materials & Parts</option>
                      <option value="Office Equipment & Facilities">Office Equipment & Facilities</option>
                      <option value="Packaging & Logistics">Packaging & Logistics</option>
                      <option value="__CUSTOM__">+ Custom Category...</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label style={{ fontSize: '0.78rem', color: 'var(--text-muted, #9ca3af)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>
                      Stock Quantity Units *
                    </label>
                    <input
                      type="number"
                      min="0"
                      className="input-text"
                      value={editStockQuantity}
                      onChange={e => setEditStockQuantity(e.target.value)}
                      required
                      style={{ background: 'var(--search-bg, #1a1a22)', color: 'var(--text-main, #ffffff)', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '10px', padding: '10px' }}
                    />
                  </div>
                </div>

                {isEditCustomCategory && (
                  <div className="form-group" style={{ marginBottom: '14px' }}>
                    <label style={{ fontSize: '0.75rem', color: '#00d4ff', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>
                      Custom Category Name
                    </label>
                    <input
                      type="text"
                      className="input-text"
                      value={editCustomCategory}
                      onChange={e => setEditCustomCategory(e.target.value)}
                      required={isEditCustomCategory}
                      style={{ background: 'var(--search-bg, #1a1a22)', color: 'var(--text-main, #ffffff)', border: '1px solid #00d4ff', borderRadius: '10px', padding: '10px' }}
                    />
                  </div>
                )}

                <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                  <div className="form-group">
                    <label style={{ fontSize: '0.78rem', color: 'var(--text-muted, #9ca3af)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>
                      Reorder Alert Point
                    </label>
                    <input
                      type="number"
                      min="0"
                      className="input-text"
                      value={editReorderPoint}
                      onChange={e => setEditReorderPoint(e.target.value)}
                      required
                      style={{ background: 'var(--search-bg, #1a1a22)', color: 'var(--text-main, #ffffff)', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '10px', padding: '10px' }}
                    />
                  </div>

                  <div className="form-group">
                    <label style={{ fontSize: '0.78rem', color: 'var(--text-muted, #9ca3af)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>
                      Supplier / Vendor
                    </label>
                    <input
                      type="text"
                      className="input-text"
                      value={editSupplier}
                      onChange={e => setEditSupplier(e.target.value)}
                      style={{ background: 'var(--search-bg, #1a1a22)', color: 'var(--text-main, #ffffff)', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '10px', padding: '10px' }}
                    />
                  </div>
                </div>

                <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                  <div className="form-group">
                    <label style={{ fontSize: '0.78rem', color: 'var(--text-muted, #9ca3af)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>
                      Unit Cost ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="input-text"
                      value={editUnitCost}
                      onChange={e => setEditUnitCost(e.target.value)}
                      required
                      style={{ background: 'var(--search-bg, #1a1a22)', color: 'var(--text-main, #ffffff)', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '10px', padding: '10px' }}
                    />
                  </div>

                  <div className="form-group">
                    <label style={{ fontSize: '0.78rem', color: 'var(--text-muted, #9ca3af)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>
                      Selling Price ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="input-text"
                      value={editSellingPrice}
                      onChange={e => setEditSellingPrice(e.target.value)}
                      required
                      style={{ background: 'var(--search-bg, #1a1a22)', color: 'var(--text-main, #ffffff)', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '10px', padding: '10px' }}
                    />
                  </div>
                </div>
              </div>

              <div className="modal-actions" style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--header-border, rgba(255, 255, 255, 0.08))', flexShrink: 0, display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="action-btn-secondary" onClick={() => setIsEditModalOpen(false)} disabled={isSavingEdit}>
                  Cancel
                </button>
                <button type="submit" className="action-btn-primary" disabled={isSavingEdit} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                  {isSavingEdit ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-check"></i>}
                  {isSavingEdit ? 'Saving...' : 'Update SKU'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

