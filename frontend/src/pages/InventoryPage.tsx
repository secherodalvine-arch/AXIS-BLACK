import React, { useState, useEffect } from 'react';
import { Currency } from '../types';
import { formatCurrency } from '../utils/currencyUtils';
import { getInventoryApi, createInventoryItemApi } from '../utils/api';

interface InventoryViewProps {
  currency?: Currency;
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

const INITIAL_INVENTORY_ITEMS: InventoryItem[] = [
  { id: 'ITEM-8092', name: 'Wagyu Beef Ribeye Cut (10kg)', category: 'Food & Beverage', stockLevel: 350, minThreshold: 100, unitPriceUSD: 320, turnoverRate: '3.8x/mo', status: 'Optimal' },
  { id: 'ITEM-8093', name: 'Artisan Espresso Roast Beans (5kg)', category: 'Ingredients & Produce', stockLevel: 45, minThreshold: 60, unitPriceUSD: 85, turnoverRate: '4.2x/mo', status: 'Reorder Soon' },
  { id: 'ITEM-4021', name: 'Commercial Grade Espresso Machine', category: 'Kitchen & Dining Equipment', stockLevel: 12, minThreshold: 5, unitPriceUSD: 2400, turnoverRate: '0.8x/mo', status: 'Optimal' },
  { id: 'ITEM-1192', name: 'POS Thermal Receipts & Rolls (Box)', category: 'Packaging & Supplies', stockLevel: 180, minThreshold: 50, unitPriceUSD: 45, turnoverRate: '2.5x/mo', status: 'Optimal' },
  { id: 'ITEM-5541', name: 'Enterprise Gateway Sensor Array v4', category: 'Tech & Network Hardware', stockLevel: 120, minThreshold: 50, unitPriceUSD: 890, turnoverRate: '1.8x/mo', status: 'Optimal' },
];

export const InventoryView: React.FC<InventoryViewProps> = ({ currency = 'USD' }) => {
  const [items, setItems] = useState<InventoryItem[]>(INITIAL_INVENTORY_ITEMS);
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Food & Beverage');
  const [customCategory, setCustomCategory] = useState('');
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [stockQuantity, setStockQuantity] = useState('100');
  const [reorderPoint, setReorderPoint] = useState('50');
  const [unitCost, setUnitCost] = useState('150');
  const [sellingPrice, setSellingPrice] = useState('250');
  const [supplier, setSupplier] = useState('Sysco Food Logistics');
  const [submitting, setSubmitting] = useState(false);

  const fetchInventory = () => {
    getInventoryApi()
      .then((data) => {
        if (data && data.length) {
          const mapped: InventoryItem[] = data.map((d: any) => ({
            id: d.sku || d.id || `ITEM-${Math.floor(1000 + Math.random() * 9000)}`,
            name: d.name || 'Inventory Item',
            category: d.category || 'General',
            stockLevel: Number(d.stock_quantity ?? d.stockLevel ?? 0),
            minThreshold: Number(d.reorder_point ?? d.minThreshold ?? 50),
            unitPriceUSD: Number(d.unit_cost ?? d.unitPriceUSD ?? 100),
            turnoverRate: d.velocity || '1.8x/mo',
            status: Number(d.stock_quantity ?? d.stockLevel ?? 0) <= Number(d.reorder_point ?? d.minThreshold ?? 50) ? 'Reorder Soon' : 'Optimal'
          }));
          setItems(mapped);
        }
      })
      .catch((err) => console.log('Live inventory fetch fallback:', err));
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  const handleCreateSKU = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    setSubmitting(true);

    const finalCategory = isCustomCategory ? (customCategory.trim() || 'General') : category;
    const itemCode = `ITEM-${Math.floor(1000 + Math.random() * 9000)}`;
    const newItemData = {
      sku: itemCode,
      name,
      category: finalCategory,
      stock_quantity: parseInt(stockQuantity) || 0,
      reorder_point: parseInt(reorderPoint) || 50,
      unit_cost: parseFloat(unitCost) || 100,
      selling_price: parseFloat(sellingPrice) || 200,
      supplier
    };

    try {
      await createInventoryItemApi(newItemData);
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
      setCustomCategory('');
      setIsCustomCategory(false);
    } catch (err) {
      console.error('Failed to save item:', err);
      // Fallback local update
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
    'Food & Beverage',
    'Ingredients & Produce',
    'Kitchen & Dining Equipment',
    'Packaging & Supplies',
    'Tech & Network Hardware',
    ...items.map(i => i.category)
  ]));

  const filteredItems = items.filter(item => filterCategory === 'ALL' || item.category === filterCategory);

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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span className="pill-tag cyan">INVENTORY MANAGEMENT</span>
            <span className="pill-tag lilac">STOCK LEVEL METRICS</span>
          </div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#fff', margin: 0, fontFamily: 'Plus Jakarta Sans' }}>
            Inventory
          </h2>
          <p className="subtitle" style={{ color: '#9ca3af', marginTop: '0.25rem' }}>
            Real-time item stock levels, valuation, and automated low-stock reorder alerts
          </p>
        </div>

        <button className="action-btn-primary" onClick={() => setIsModalOpen(true)}>
          <i className="fa-solid fa-boxes-stacked"></i>
          <span>Add Inventory Item</span>
        </button>
      </div>

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
            2.4x / month
          </div>
          <span style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.5rem', display: 'block' }}>
            Velocity: Optimal
          </span>
        </div>

        <div className="glass-card" style={{ padding: '1.25rem', borderRadius: '1rem' }}>
          <div style={{ fontSize: '0.75rem', fontFamily: 'JetBrains Mono', color: '#9ca3af' }}>ACTIVE UNITS IN STOCK</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#cebdff', fontFamily: 'JetBrains Mono', marginTop: '0.25rem' }}>
            {items.reduce((acc, item) => acc + item.stockLevel, 0).toLocaleString()} Units
          </div>
          <span style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.5rem', display: 'block' }}>
            Across Active Items
          </span>
        </div>

        <div className="glass-card" style={{ padding: '1.25rem', borderRadius: '1rem' }}>
          <div style={{ fontSize: '0.75rem', fontFamily: 'JetBrains Mono', color: '#9ca3af' }}>WAREHOUSE & STOCK HEALTH</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#ffafd3', fontFamily: 'JetBrains Mono', marginTop: '0.25rem' }}>
            {items.length ? (Math.round((items.filter(i => i.stockLevel > i.minThreshold).length / items.length) * 1000) / 10).toFixed(1) : '100.0'}%
          </div>
          <span style={{ fontSize: '0.75rem', color: items.some(i => i.stockLevel <= i.minThreshold) ? '#ff8e8e' : '#4ade80', marginTop: '0.5rem', display: 'block' }}>
            {items.filter(i => i.stockLevel <= i.minThreshold).length} Low Stock Alert(s)
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
              {filteredItems.map(item => {
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
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD NEW INVENTORY ITEM MODAL */}
      {isModalOpen && (
        <div className="modal-overlay active">
          <div className="modal-card glass-card" style={{ background: '#141418', border: '1px solid rgba(0, 212, 255, 0.35)', boxShadow: '0 24px 80px rgba(0,0,0,0.9), 0 0 40px rgba(0, 212, 255, 0.2)' }}>
            <div className="modal-header" style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '12px', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, color: '#ffffff', fontFamily: 'Plus Jakarta Sans', fontSize: '1.25rem', fontWeight: 800 }}>
                Add New Inventory Item
              </h3>
              <button className="modal-close" onClick={() => setIsModalOpen(false)} style={{ color: '#9ca3af', fontSize: '1.5rem', background: 'none', border: 'none', cursor: 'pointer' }}>&times;</button>
            </div>
            
            <form onSubmit={handleCreateSKU}>
              <div className="form-group">
                <label style={{ fontSize: '0.8rem', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Item Name / Description
                </label>
                <input 
                  type="text" 
                  className="input-text" 
                  placeholder="e.g. Wagyu Beef Ribeye / Espresso Beans / POS Printer"
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
                    <option value="Food & Beverage" style={{ background: '#141418', color: '#ffffff' }}>Food & Beverage</option>
                    <option value="Ingredients & Produce" style={{ background: '#141418', color: '#ffffff' }}>Ingredients & Produce</option>
                    <option value="Kitchen & Dining Equipment" style={{ background: '#141418', color: '#ffffff' }}>Kitchen & Dining Equipment</option>
                    <option value="Packaging & Supplies" style={{ background: '#141418', color: '#ffffff' }}>Packaging & Supplies</option>
                    <option value="Tech & Network Hardware" style={{ background: '#141418', color: '#ffffff' }}>Tech & Network Hardware</option>
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
                    placeholder="e.g. Wine Cellar, Cleaning Supplies, Bakery Ingredients"
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

