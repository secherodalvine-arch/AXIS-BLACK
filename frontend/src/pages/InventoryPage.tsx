import React, { useState, useEffect, useRef } from 'react';
import { Currency, UserSubscription } from '../types';
import { formatCurrency, getCurrencySymbol, toDisplayAmount, fromDisplayAmount, parseMoneyInput } from '../utils/currencyUtils';
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
import { INVENTORY_CATEGORIES, CUSTOM_CATEGORY_VALUE, DEFAULT_INVENTORY_CATEGORY, categoryOptionLabel, isPresetCategory } from '../utils/categories';

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
  status: 'In Stock' | 'Running Low' | 'Out of Stock';
  branch_id?: string;
}

// ── Shared form pieces (kept OUTSIDE the page component so inputs never lose focus while typing) ──
const FIELD_LABEL: React.CSSProperties = { fontSize: '0.82rem', color: 'var(--text-main, #e5e7eb)', fontWeight: 600, display: 'block', marginBottom: '6px' };
const FIELD_HINT: React.CSSProperties = { fontSize: '0.72rem', color: 'var(--text-muted, #9ca3af)', marginTop: '5px', lineHeight: 1.4 };
const FIELD_INPUT: React.CSSProperties = { background: 'var(--search-bg, #1a1a22)', color: 'var(--text-main, #ffffff)', border: '1px solid var(--search-border, rgba(255, 255, 255, 0.15))', borderRadius: '10px', padding: '12px' };

const isUpgradeMessage = (msg?: string | null): boolean => {
  const m = (msg || '').toLowerCase();
  return m.includes('limit') || m.includes('upgrade') || m.includes('tier') || m.includes('plan');
};

const sanitizeMoneyText = (v: string): string => {
  let s = v.replace(/[^0-9.]/g, '');
  const firstDot = s.indexOf('.');
  if (firstDot !== -1) s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, '');
  return s;
};
const sanitizeWholeNumber = (v: string): string => v.replace(/[^0-9]/g, '');

interface ItemFormFieldsProps {
  currency: Currency;
  showItemCode: boolean;
  name: string;
  setName: (v: string) => void;
  itemCode?: string;
  setItemCode?: (v: string) => void;
  category: string;
  isCustomCategory: boolean;
  onCategoryChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  customCategory: string;
  setCustomCategory: (v: string) => void;
  stockLabel: string;
  stockQuantity: string;
  setStockQuantity: (v: string) => void;
  reorderPoint: string;
  setReorderPoint: (v: string) => void;
  unitCost: string;
  setUnitCost: (v: string) => void;
  sellingPrice: string;
  setSellingPrice: (v: string) => void;
  supplier: string;
  setSupplier: (v: string) => void;
}

const ItemFormFields: React.FC<ItemFormFieldsProps> = (p) => {
  const symbol = getCurrencySymbol(p.currency);
  const selectedPreset = INVENTORY_CATEGORIES.find(c => c.value === p.category);

  const cost = parseMoneyInput(p.unitCost);
  const price = parseMoneyInput(p.sellingPrice);
  const showProfit = p.unitCost.trim() !== '' && p.sellingPrice.trim() !== '' && !isNaN(cost) && !isNaN(price);
  const profit = showProfit ? price - cost : 0;
  const money = (n: number) => `${symbol} ${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

  return (
    <>
      <div className="form-row">
        <div className="form-group" style={{ flex: 1.3 }}>
          <label style={FIELD_LABEL}>Item Name *</label>
          <input
            type="text"
            className="input-text"
            placeholder="e.g. Rio Carnival Short Wig, Shea Butter Lotion 200ml"
            value={p.name}
            onChange={(e) => p.setName(e.target.value)}
            required
            style={FIELD_INPUT}
          />
        </div>

        {p.showItemCode && (
          <div className="form-group" style={{ flex: 1 }}>
            <label style={FIELD_LABEL}>
              Item Code <span style={{ color: '#9ca3af', fontWeight: 400 }}>(optional)</span>
            </label>
            <input
              type="text"
              className="input-text"
              placeholder="Leave empty, we will make one"
              value={p.itemCode || ''}
              onChange={(e) => p.setItemCode && p.setItemCode(e.target.value)}
              style={FIELD_INPUT}
            />
            <div style={FIELD_HINT}>A short name to find this item quickly, e.g. HAIR-1042</div>
          </div>
        )}
      </div>

      <div className="form-row">
        <div className="form-group">
          <label style={FIELD_LABEL}>What type of item is it?</label>
          <select
            className="select-text"
            value={p.isCustomCategory ? CUSTOM_CATEGORY_VALUE : p.category}
            onChange={p.onCategoryChange}
            style={FIELD_INPUT}
          >
            {INVENTORY_CATEGORIES.map(c => (
              <option key={c.value} value={c.value}>{categoryOptionLabel(c)}</option>
            ))}
            <option value={CUSTOM_CATEGORY_VALUE}>+ My item is not listed — type my own</option>
          </select>
          {selectedPreset && !p.isCustomCategory && (
            <div style={FIELD_HINT}>Good for: {selectedPreset.hint}</div>
          )}
        </div>

        <div className="form-group">
          <label style={FIELD_LABEL}>{p.stockLabel}</label>
          <input
            type="text"
            inputMode="numeric"
            className="input-text"
            placeholder="e.g. 20"
            value={p.stockQuantity}
            onChange={(e) => p.setStockQuantity(sanitizeWholeNumber(e.target.value))}
            required
            style={FIELD_INPUT}
          />
          <div style={FIELD_HINT}>Number of pieces / packs you have available</div>
        </div>
      </div>

      {p.isCustomCategory && (
        <div className="form-group" style={{ marginTop: '-4px' }}>
          <label style={{ ...FIELD_LABEL, color: '#00d4ff' }}>Type your own category name</label>
          <input
            type="text"
            className="input-text"
            placeholder="e.g. Wigs, Lotions, Baby Items, Phone Cases"
            value={p.customCategory}
            onChange={(e) => p.setCustomCategory(e.target.value)}
            required
            style={{ ...FIELD_INPUT, border: '1px solid #00d4ff', padding: '10px' }}
          />
        </div>
      )}

      <div className="form-row">
        <div className="form-group">
          <label style={FIELD_LABEL}>Buying Cost — for ONE item ({symbol}) *</label>
          <input
            type="text"
            inputMode="decimal"
            className="input-text"
            placeholder="e.g. 200"
            value={p.unitCost}
            onChange={(e) => p.setUnitCost(sanitizeMoneyText(e.target.value))}
            required
            style={FIELD_INPUT}
          />
          <div style={FIELD_HINT}>What YOU pay to get one item</div>
        </div>

        <div className="form-group">
          <label style={FIELD_LABEL}>Selling Price — for ONE item ({symbol}) *</label>
          <input
            type="text"
            inputMode="decimal"
            className="input-text"
            placeholder="e.g. 350"
            value={p.sellingPrice}
            onChange={(e) => p.setSellingPrice(sanitizeMoneyText(e.target.value))}
            required
            style={FIELD_INPUT}
          />
          <div style={FIELD_HINT}>What your CUSTOMER pays you for one item</div>
        </div>
      </div>

      {showProfit && (
        <div style={{
          margin: '-4px 0 14px 0',
          padding: '8px 12px',
          borderRadius: '8px',
          fontSize: '0.8rem',
          fontWeight: 600,
          background: profit >= 0 ? 'rgba(74, 222, 128, 0.1)' : 'rgba(248, 113, 113, 0.12)',
          border: `1px solid ${profit >= 0 ? 'rgba(74, 222, 128, 0.35)' : 'rgba(248, 113, 113, 0.4)'}`,
          color: profit >= 0 ? '#4ade80' : '#f87171'
        }}>
          {profit >= 0
            ? `You make ${money(profit)} profit on each item you sell.`
            : `Careful: you lose ${money(profit)} on each item you sell.`}
        </div>
      )}

      <div className="form-row">
        <div className="form-group">
          <label style={FIELD_LABEL}>
            Warn me when stock is low <span style={{ color: '#9ca3af', fontWeight: 400 }}>(optional)</span>
          </label>
          <input
            type="text"
            inputMode="numeric"
            className="input-text"
            placeholder="e.g. 5"
            value={p.reorderPoint}
            onChange={(e) => p.setReorderPoint(sanitizeWholeNumber(e.target.value))}
            style={FIELD_INPUT}
          />
          <div style={FIELD_HINT}>You will see a “Running Low” warning when you have this many or fewer left</div>
        </div>

        <div className="form-group">
          <label style={FIELD_LABEL}>
            Supplier — who you buy from <span style={{ color: '#9ca3af', fontWeight: 400 }}>(optional)</span>
          </label>
          <input
            type="text"
            className="input-text"
            placeholder="e.g. Mama Njeri Wholesalers"
            value={p.supplier}
            onChange={(e) => p.setSupplier(e.target.value)}
            style={FIELD_INPUT}
          />
        </div>
      </div>
    </>
  );
};

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
  const [category, setCategory] = useState(DEFAULT_INVENTORY_CATEGORY);
  const [customCategory, setCustomCategory] = useState('');
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [stockQuantity, setStockQuantity] = useState('');
  const [reorderPoint, setReorderPoint] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [supplier, setSupplier] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
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
  const [editCategory, setEditCategory] = useState(DEFAULT_INVENTORY_CATEGORY);
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
          // Prices are stored in USD. Never invent prices for items that have none.
          const mapped: InventoryItem[] = data.map((d: any) => {
            const stock = Number(d.stock_quantity ?? d.stockLevel ?? 0) || 0;
            const minStock = Number(d.reorder_point ?? d.minThreshold ?? 5) || 0;
            return {
              id: d.sku || d.id || `ITEM-${Math.floor(1000 + Math.random() * 9000)}`,
              name: d.name || 'Unnamed Item',
              category: d.category || 'Other Items',
              stockLevel: stock,
              minThreshold: minStock,
              unitPriceUSD: Number(d.unit_cost ?? d.unitPriceUSD ?? 0) || 0,
              sellingPriceUSD: Number(d.selling_price ?? d.sellingPriceUSD ?? 0) || 0,
              supplier: d.supplier || '',
              status: stock <= 0 ? 'Out of Stock' : stock <= minStock ? 'Running Low' : 'In Stock',
              branch_id: d.branch_id
            };
          });
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
    if (!name.trim()) return;

    const costTyped = parseMoneyInput(unitCost);
    const priceTyped = parseMoneyInput(sellingPrice);
    if (isNaN(costTyped) || costTyped < 0 || isNaN(priceTyped) || priceTyped < 0) {
      setCreateError('Please type the buying cost and the selling price as numbers, for example 200.');
      return;
    }

    setSubmitting(true);

    const finalCategory = isCustomCategory ? (customCategory.trim() || 'Other Items') : category;
    const itemCode = customSKU.trim() || generateSmartItemCode(finalCategory, name);
    const newItemData = {
      sku: itemCode,
      name: name.trim(),
      category: finalCategory,
      stock_quantity: Math.max(0, parseInt(stockQuantity) || 0),
      reorder_point: reorderPoint.trim() === '' ? 5 : Math.max(0, parseInt(reorderPoint) || 0),
      // What the user typed is in their chosen currency; money is stored in USD
      unit_cost: fromDisplayAmount(costTyped, currency),
      selling_price: fromDisplayAmount(priceTyped, currency),
      supplier: supplier.trim(),
      branch_id: isSubUserWithBranch ? currentUser?.branch_id : (itemBranchId || (branches[0]?.id || null))
    };

    setCreateError(null);
    try {
      await createInventoryItemApi(newItemData);
      // Re-fetch from backend to get the latest persisted state
      fetchInventory();
      window.dispatchEvent(new CustomEvent('axis-data-updated'));
      setIsModalOpen(false);
      setName('');
      setCustomSKU('');
      setSupplier('');
      setStockQuantity('');
      setReorderPoint('');
      setUnitCost('');
      setSellingPrice('');
      setCustomCategory('');
      setIsCustomCategory(false);
      setCreateError(null);
    } catch (err: any) {
      console.error('Failed to save item to backend:', err);
      const errMsg = err?.message || 'Failed to save inventory item';
      setCreateError(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setEditName(item.name);
    if (isPresetCategory(item.category, INVENTORY_CATEGORIES)) {
      setEditCategory(item.category);
      setIsEditCustomCategory(false);
      setEditCustomCategory('');
    } else {
      setEditCategory(CUSTOM_CATEGORY_VALUE);
      setIsEditCustomCategory(true);
      setEditCustomCategory(item.category);
    }
    setEditStockQuantity(item.stockLevel.toString());
    setEditReorderPoint(item.minThreshold.toString());
    // Show prices in the user's chosen currency (stored internally in USD)
    setEditUnitCost(toDisplayAmount(item.unitPriceUSD, currency).toString());
    setEditSellingPrice(toDisplayAmount(item.sellingPriceUSD || 0, currency).toString());
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

    const costTyped = parseMoneyInput(editUnitCost);
    const priceTyped = parseMoneyInput(editSellingPrice);
    if (isNaN(costTyped) || costTyped < 0 || isNaN(priceTyped) || priceTyped < 0) {
      setEditError('Please type the buying cost and the selling price as numbers, for example 200.');
      return;
    }

    setIsSavingEdit(true);
    setEditError(null);

    const finalCategory = isEditCustomCategory ? (editCustomCategory.trim() || 'Other Items') : editCategory;
    const updates = {
      name: editName.trim(),
      category: finalCategory,
      stock_quantity: Math.max(0, parseInt(editStockQuantity) || 0),
      reorder_point: editReorderPoint.trim() === '' ? 5 : Math.max(0, parseInt(editReorderPoint) || 0),
      // What the user typed is in their chosen currency; money is stored in USD
      unit_cost: fromDisplayAmount(costTyped, currency),
      selling_price: fromDisplayAmount(priceTyped, currency),
      supplier: editSupplier.trim(),
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
    if (!window.confirm(`Are you sure you want to delete "${itemName}" (code ${sku})? This will permanently remove it from your inventory.`)) {
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
  const totalSalesValueUSD = items.reduce((acc, item) => acc + (item.stockLevel * (item.sellingPriceUSD || 0)), 0);
  
  // Category list: all friendly presets + anything the user already used
  const availableCategories = Array.from(new Set([
    'ALL',
    ...INVENTORY_CATEGORIES.map(c => c.value),
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
            Your items, how many are left, what they are worth, and low-stock warnings
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
                  onOpenUpgrade('Free tier is limited to 2 inventory items. Please upgrade your plan for unlimited inventory uploads.', 'Inventory Import');
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
                  onOpenUpgrade('Free tier is limited to 2 inventory items. Please upgrade your plan to add unlimited items.', 'Inventory Engine');
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

      {/* Top Inventory Highlights */}
      <div className="inventory-metrics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '1.25rem' }}>
        <div className="glass-card" style={{ padding: '1.25rem', borderRadius: '1rem' }}>
          <div style={{ fontSize: '0.75rem', fontFamily: 'JetBrains Mono', color: 'var(--text-muted, #9ca3af)' }}>VALUE OF YOUR STOCK</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main, #ffffff)', fontFamily: 'JetBrains Mono', marginTop: '0.25rem' }}>
            {formatCurrency(totalValuationUSD, currency)}
          </div>
          <span className="trend-pill positive" style={{ fontSize: '0.72rem', marginTop: '0.5rem', display: 'inline-flex' }}>
            <i className="fa-solid fa-boxes-stacked"></i> {items.length} {items.length === 1 ? 'Item' : 'Items'} (what you paid)
          </span>
        </div>

        <div className="glass-card" style={{ padding: '1.25rem', borderRadius: '1rem' }}>
          <div style={{ fontSize: '0.75rem', fontFamily: 'JetBrains Mono', color: 'var(--text-muted, #9ca3af)' }}>EXPECTED SALES</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#00d4ff', fontFamily: 'JetBrains Mono', marginTop: '0.25rem' }}>
            {items.length > 0 ? formatCurrency(totalSalesValueUSD, currency) : '--'}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #9ca3af)', marginTop: '0.5rem', display: 'block' }}>
            {items.length > 0 ? `Profit if you sell it all: ${formatCurrency(totalSalesValueUSD - totalValuationUSD, currency)}` : 'No items added yet'}
          </span>
        </div>

        <div className="glass-card" style={{ padding: '1.25rem', borderRadius: '1rem' }}>
          <div style={{ fontSize: '0.75rem', fontFamily: 'JetBrains Mono', color: 'var(--text-muted, #9ca3af)' }}>TOTAL ITEMS IN STOCK</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--primary-lilac-glow, #cebdff)', fontFamily: 'JetBrains Mono', marginTop: '0.25rem' }}>
            {items.reduce((acc, item) => acc + item.stockLevel, 0).toLocaleString()}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #9ca3af)', marginTop: '0.5rem', display: 'block' }}>
            Across {items.length} different {items.length === 1 ? 'product' : 'products'}
          </span>
        </div>

        <div className="glass-card" style={{ padding: '1.25rem', borderRadius: '1rem' }}>
          <div style={{ fontSize: '0.75rem', fontFamily: 'JetBrains Mono', color: 'var(--text-muted, #9ca3af)' }}>STOCK HEALTH</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--tertiary-pink-glow, #ffafd3)', fontFamily: 'JetBrains Mono', marginTop: '0.25rem' }}>
            {items.length ? `${Math.round((items.filter(i => i.stockLevel > i.minThreshold).length / items.length) * 100)}%` : '--'}
          </div>
          <span style={{ fontSize: '0.75rem', color: items.some(i => i.stockLevel <= i.minThreshold) ? '#ff8e8e' : '#4ade80', marginTop: '0.5rem', display: 'block' }}>
            {items.length ? `${items.filter(i => i.stockLevel <= i.minThreshold).length} ${items.filter(i => i.stockLevel <= i.minThreshold).length === 1 ? 'item is' : 'items are'} running low` : 'No items added yet'}
          </span>
        </div>
      </div>

      {/* Main Item Table */}
      <div className="glass-card" style={{ padding: '1.5rem', borderRadius: '1.1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main, #ffffff)', fontFamily: 'Plus Jakarta Sans', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
            <i className="fa-solid fa-list-check" style={{ color: '#00d4ff' }}></i>
            Your Items & Stock Levels
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
                <th>Item Name</th>
                <th>Category</th>
                <th>In Stock</th>
                <th>Buying Cost (each)</th>
                <th>Selling Price (each)</th>
                <th>Total Stock Value</th>
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
                    <div style={{ fontSize: '0.8rem' }}>Click <strong>Add Inventory Item</strong> to add your first item.</div>
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
                      <td style={{ fontFamily: 'JetBrains Mono', fontWeight: 600, color: item.stockLevel <= item.minThreshold ? '#ff8e8e' : 'var(--text-main, #e5e2e1)' }}>
                        {item.stockLevel.toLocaleString()} {item.stockLevel === 1 ? 'item' : 'items'}
                        <div style={{ fontSize: '0.68rem', fontWeight: 400, color: 'var(--text-dim, #64748b)' }}>Warn me at {item.minThreshold}</div>
                      </td>
                      <td style={{ fontFamily: 'JetBrains Mono' }}>
                        {formatCurrency(item.unitPriceUSD, currency)}
                      </td>
                      <td style={{ fontFamily: 'JetBrains Mono', color: '#00d4ff' }}>
                        {formatCurrency(item.sellingPriceUSD || 0, currency)}
                      </td>
                      <td style={{ fontFamily: 'JetBrains Mono', fontWeight: 700, color: 'var(--primary-lilac-glow, #cebdff)' }}>
                        {formatCurrency(totalVal, currency)}
                      </td>
                      <td>
                        <span className={`status-badge ${item.status === 'In Stock' ? 'status-cleared' : 'status-pending'}`}>
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
                            title="Edit this item"
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
                            title="Delete this item"
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
              <button className="modal-close" onClick={() => { setIsModalOpen(false); setCreateError(null); }} style={{ color: 'var(--text-muted, #9ca3af)', fontSize: '1.5rem', background: 'none', border: 'none', cursor: 'pointer' }}>&times;</button>
            </div>

            {/* In-Modal Gateway / Error Banner */}
            {createError && (
              <div style={{
                borderRadius: '12px',
                padding: '12px 16px',
                marginBottom: '16px',
                background: (createError.toLowerCase().includes('limit') || createError.toLowerCase().includes('upgrade') || createError.toLowerCase().includes('tier'))
                  ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.16), rgba(239, 68, 68, 0.12))'
                  : 'rgba(239, 68, 68, 0.14)',
                border: (createError.toLowerCase().includes('limit') || createError.toLowerCase().includes('upgrade') || createError.toLowerCase().includes('tier'))
                  ? '1px solid rgba(245, 158, 11, 0.5)'
                  : '1px solid rgba(239, 68, 68, 0.4)',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: '12px',
                flexShrink: 0
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <div style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '8px',
                    background: 'rgba(245, 158, 11, 0.25)',
                    color: '#fbbf24',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.95rem',
                    flexShrink: 0,
                    marginTop: '2px'
                  }}>
                    <i className="fa-solid fa-crown"></i>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#d97706', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '2px' }}>
                      {isUpgradeMessage(createError) ? 'Subscription Requirement' : 'Please check this'}
                    </div>
                    <div style={{ fontSize: '0.86rem', color: 'var(--text-main, #0f172a)', lineHeight: 1.5, fontWeight: 600 }}>
                      {createError}
                    </div>
                    {onOpenUpgrade && isUpgradeMessage(createError) && (
                      <button
                        type="button"
                        onClick={() => onOpenUpgrade(createError, 'Inventory Engine')}
                        style={{
                          marginTop: '8px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          background: 'linear-gradient(135deg, #00d4ff, #0099ff)',
                          border: 'none',
                          color: '#040d1a',
                          fontWeight: 800,
                          fontSize: '0.8rem',
                          padding: '6px 12px',
                          borderRadius: '8px',
                          cursor: 'pointer'
                        }}
                      >
                        <i className="fa-solid fa-crown" style={{ fontSize: '0.75rem' }}></i>
                        <span>Upgrade to Unlock</span>
                        <i className="fa-solid fa-arrow-right" style={{ fontSize: '0.75rem' }}></i>
                      </button>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setCreateError(null)}
                  style={{ background: 'transparent', border: 'none', color: '#9ca3af', fontSize: '1.2rem', cursor: 'pointer', padding: 0 }}
                >
                  &times;
                </button>
              </div>
            )}

            {isFreeLimitReached && !createError && (
              <div style={{
                borderRadius: '10px',
                padding: '12px 14px',
                marginBottom: '16px',
                background: 'rgba(245, 158, 11, 0.12)',
                border: '1px solid rgba(245, 158, 11, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px',
                flexShrink: 0
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fbbf24', fontSize: '0.82rem' }}>
                  <i className="fa-solid fa-crown"></i>
                  <span>Free tier allows up to 2 items. Upgrade for unlimited inventory.</span>
                </div>
                {onOpenUpgrade && (
                  <button
                    type="button"
                    onClick={() => onOpenUpgrade('Free tier is limited to 2 inventory items. Please upgrade your plan for unlimited inventory uploads.', 'Inventory Engine')}
                    style={{
                      background: 'linear-gradient(135deg, #00d4ff, #0099ff)',
                      border: 'none',
                      color: '#040d1a',
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      padding: '5px 10px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      flexShrink: 0
                    }}
                  >
                    Upgrade
                  </button>
                )}
              </div>
            )}
            
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

              <ItemFormFields
                currency={currency}
                showItemCode
                name={name}
                setName={setName}
                itemCode={customSKU}
                setItemCode={setCustomSKU}
                category={category}
                isCustomCategory={isCustomCategory}
                onCategoryChange={handleCategorySelectChange}
                customCategory={customCategory}
                setCustomCategory={setCustomCategory}
                stockLabel="How many do you have right now?"
                stockQuantity={stockQuantity}
                setStockQuantity={setStockQuantity}
                reorderPoint={reorderPoint}
                setReorderPoint={setReorderPoint}
                unitCost={unitCost}
                setUnitCost={setUnitCost}
                sellingPrice={sellingPrice}
                setSellingPrice={setSellingPrice}
                supplier={supplier}
                setSupplier={setSupplier}
              />

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
                  Edit Item
                </h3>
                <span style={{ fontSize: '0.75rem', fontFamily: 'JetBrains Mono', color: '#00d4ff' }}>
                  {editingItem.id}
                </span>
              </div>
              <button className="modal-close" onClick={() => setIsEditModalOpen(false)} style={{ color: 'var(--text-muted, #9ca3af)', fontSize: '1.5rem', background: 'none', border: 'none', cursor: 'pointer' }}>&times;</button>
            </div>

            {editError && (
              <div style={{
                borderRadius: '12px',
                padding: '12px 16px',
                marginBottom: '16px',
                background: (editError.toLowerCase().includes('limit') || editError.toLowerCase().includes('upgrade') || editError.toLowerCase().includes('tier'))
                  ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.16), rgba(239, 68, 68, 0.12))'
                  : 'rgba(239, 68, 68, 0.14)',
                border: (editError.toLowerCase().includes('limit') || editError.toLowerCase().includes('upgrade') || editError.toLowerCase().includes('tier'))
                  ? '1px solid rgba(245, 158, 11, 0.5)'
                  : '1px solid rgba(239, 68, 68, 0.4)',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: '12px',
                flexShrink: 0
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <div style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '8px',
                    background: 'rgba(245, 158, 11, 0.25)',
                    color: '#fbbf24',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.95rem',
                    flexShrink: 0,
                    marginTop: '2px'
                  }}>
                    <i className="fa-solid fa-crown"></i>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '2px' }}>
                      {isUpgradeMessage(editError) ? 'Subscription Requirement' : 'Please check this'}
                    </div>
                    <div style={{ fontSize: '0.86rem', color: '#f3f4f6', lineHeight: 1.5, fontWeight: 600 }}>
                      {editError}
                    </div>
                    {onOpenUpgrade && isUpgradeMessage(editError) && (
                      <button
                        type="button"
                        onClick={() => onOpenUpgrade(editError, 'Inventory Engine')}
                        style={{
                          marginTop: '8px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          background: 'linear-gradient(135deg, #00d4ff, #0099ff)',
                          border: 'none',
                          color: '#040d1a',
                          fontWeight: 800,
                          fontSize: '0.8rem',
                          padding: '6px 12px',
                          borderRadius: '8px',
                          cursor: 'pointer'
                        }}
                      >
                        <i className="fa-solid fa-crown" style={{ fontSize: '0.75rem' }}></i>
                        <span>Upgrade to Unlock</span>
                        <i className="fa-solid fa-arrow-right" style={{ fontSize: '0.75rem' }}></i>
                      </button>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditError(null)}
                  style={{ background: 'transparent', border: 'none', color: '#9ca3af', fontSize: '1.2rem', cursor: 'pointer', padding: 0 }}
                >
                  &times;
                </button>
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

                <ItemFormFields
                  currency={currency}
                  showItemCode={false}
                  name={editName}
                  setName={setEditName}
                  category={editCategory}
                  isCustomCategory={isEditCustomCategory}
                  onCategoryChange={handleEditCategorySelectChange}
                  customCategory={editCustomCategory}
                  setCustomCategory={setEditCustomCategory}
                  stockLabel="How many are in stock now?"
                  stockQuantity={editStockQuantity}
                  setStockQuantity={setEditStockQuantity}
                  reorderPoint={editReorderPoint}
                  setReorderPoint={setEditReorderPoint}
                  unitCost={editUnitCost}
                  setUnitCost={setEditUnitCost}
                  sellingPrice={editSellingPrice}
                  setSellingPrice={setEditSellingPrice}
                  supplier={editSupplier}
                  setSupplier={setEditSupplier}
                />
              </div>

              <div className="modal-actions" style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--header-border, rgba(255, 255, 255, 0.08))', flexShrink: 0, display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="action-btn-secondary" onClick={() => setIsEditModalOpen(false)} disabled={isSavingEdit}>
                  Cancel
                </button>
                <button type="submit" className="action-btn-primary" disabled={isSavingEdit} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                  {isSavingEdit ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-check"></i>}
                  {isSavingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

