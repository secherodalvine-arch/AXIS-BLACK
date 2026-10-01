import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Currency, Transaction } from '../types';
import { formatCurrency } from '../utils/currencyUtils';
import { 
  getTransactionsApi, 
  createTransactionApi, 
  updateTransactionApi, 
  deleteTransactionApi,
  getInventoryApi, 
  createInventoryItemApi, 
  updateInventoryItemApi, 
  deleteInventoryItemApi,
  getBranchesApi,
  getCustomSpreadsheetsApi,
  saveCustomSpreadsheetApi,
  deleteCustomSpreadsheetApi,
  UserProfile 
} from '../utils/api';
import '../styles/spreadsheet.css';

interface SpreadsheetPageProps {
  currency?: Currency;
  transactions?: Transaction[];
  user?: UserProfile | null;
  onRefreshData?: () => void;
}

type SheetType = 'ledger' | 'inventory' | 'scratchpad' | string;

interface ColumnDef {
  key: string;
  letter: string;
  label: string;
  type: 'text' | 'number' | 'currency' | 'select' | 'date' | 'code' | 'formula';
  options?: string[];
  readOnly?: boolean;
  width?: number;
}

export const SpreadsheetPage: React.FC<SpreadsheetPageProps> = ({
  currency = 'USD',
  user: _user,
  onRefreshData
}) => {
  // Available sheets
  const [activeSheet, setActiveSheet] = useState<SheetType>('ledger');
  const [customSheets, setCustomSheets] = useState<any[]>([]);

  // Raw data from APIs
  const [ledgerRows, setLedgerRows] = useState<any[]>([]);
  const [inventoryRows, setInventoryRows] = useState<any[]>([]);
  const [scratchpadData, setScratchpadData] = useState<{ columns: ColumnDef[]; rows: any[] }>({
    columns: [
      { key: 'colA', letter: 'A', label: 'Item / Project', type: 'text' },
      { key: 'colB', letter: 'B', label: 'Category', type: 'text' },
      { key: 'colC', letter: 'C', label: 'Qty / Units', type: 'number' },
      { key: 'colD', letter: 'D', label: 'Rate ($)', type: 'currency' },
      { key: 'colE', letter: 'E', label: 'Subtotal ($)', type: 'formula' },
      { key: 'colF', letter: 'F', label: 'Notes', type: 'text' },
    ],
    rows: [
      { id: 'row-1', colA: 'Server Hosting (Q4)', colB: 'Infrastructure', colC: 3, colD: 1250, colE: '=C1*D1', colF: 'AWS cluster' },
      { id: 'row-2', colA: 'Marketing Campaign', colB: 'Growth', colC: 1, colD: 4500, colE: '=C2*D2', colF: 'Google Ads' },
      { id: 'row-3', colA: 'Security Audit', colB: 'Compliance', colC: 1, colD: 3200, colE: '=C3*D3', colF: 'Pen-testing' },
      { id: 'row-4', colA: 'Consulting Retainer', colB: 'Professional', colC: 2, colD: 2000, colE: '=C4*D4', colF: 'Legal & Tax' },
    ]
  });

  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Sync state
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'error'>('synced');
  const [syncMessage, setSyncMessage] = useState<string>('Live Sync Active');
  const [lastSyncTime, setLastSyncTime] = useState<string>(new Date().toLocaleTimeString());

  // Grid Selection & Editing state
  const [selectedCell, setSelectedCell] = useState<{ rowIdx: number; colKey: string } | null>({ rowIdx: 0, colKey: 'counterparty' });
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState<string>('');
  const [formulaBarValue, setFormulaBarValue] = useState<string>('');
  
  const cellInputRef = useRef<HTMLInputElement | null>(null);
  const formulaInputRef = useRef<HTMLInputElement | null>(null);
  const gridContainerRef = useRef<HTMLDivElement | null>(null);

  // ── Load Data ──
  const fetchAllData = async () => {
    setIsLoading(true);
    setSyncStatus('syncing');
    setSyncMessage('Fetching latest business data...');
    try {
      const [txns, inv, bList, cSheets] = await Promise.all([
        getTransactionsApi(selectedBranch || undefined).catch(() => []),
        getInventoryApi(selectedBranch || undefined).catch(() => []),
        getBranchesApi().catch(() => []),
        getCustomSpreadsheetsApi().catch(() => [])
      ]);

      setLedgerRows(Array.isArray(txns) ? txns : []);
      setInventoryRows(Array.isArray(inv) ? inv : []);
      setBranches(Array.isArray(bList) ? bList : []);
      setCustomSheets(Array.isArray(cSheets) ? cSheets : []);

      if (cSheets && cSheets.length > 0) {
        const scratch = cSheets.find((s: any) => s.id === 'scratchpad' || s.title?.toLowerCase().includes('scratchpad'));
        if (scratch && scratch.rows) {
          setScratchpadData({
            columns: scratch.columns || scratchpadData.columns,
            rows: scratch.rows
          });
        }
      }

      setSyncStatus('synced');
      setSyncMessage('Synced in Realtime');
      setLastSyncTime(new Date().toLocaleTimeString());
    } catch (err) {
      setSyncStatus('error');
      setSyncMessage('Sync error: Could not reach server');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, [selectedBranch]);

  useEffect(() => {
    const handleRemoteUpdate = () => fetchAllData();
    window.addEventListener('axis-data-updated', handleRemoteUpdate);
    return () => window.removeEventListener('axis-data-updated', handleRemoteUpdate);
  }, [selectedBranch]);

  // ── Column Definitions ──
  const ledgerColumns: ColumnDef[] = useMemo(() => [
    { key: 'id', letter: 'A', label: 'Ref Code', type: 'code', readOnly: true, width: 100 },
    { key: 'date', letter: 'B', label: 'Date', type: 'date', width: 110 },
    { key: 'counterparty', letter: 'C', label: 'Entity / Counterparty', type: 'text', width: 220 },
    { key: 'type', letter: 'D', label: 'Flow Type', type: 'select', options: ['Expense', 'Revenue'], width: 120 },
    { key: 'accountType', letter: 'E', label: 'Account Ledger', type: 'select', options: ['Cash', 'Bank', 'Accounts Receivable', 'Accounts Payable', 'Revenue', 'Expense'], width: 150 },
    { key: 'category', letter: 'F', label: 'Category', type: 'select', options: [
      'Operations & Logistics', 'Revenue & Sales', 'Software & Subscriptions', 
      'Cloud & Infrastructure', 'Payroll & Compensation', 'Marketing & Growth', 
      'Office & Facilities', 'Professional Services', 'Equipment & Assets', 'Treasury & Capital'
    ], width: 180 },
    { key: 'amount', letter: 'G', label: `Amount (${currency})`, type: 'currency', width: 140 },
    { key: 'status', letter: 'H', label: 'Status', type: 'select', options: ['Cleared', 'Pending', 'Processing'], width: 110 },
    { key: 'notes', letter: 'I', label: 'Memo / Notes', type: 'text', width: 220 },
    { key: 'branch_id', letter: 'J', label: 'Branch', type: 'select', options: branches.map(b => b.name), width: 140 }
  ], [currency, branches]);

  const inventoryColumns: ColumnDef[] = useMemo(() => [
    { key: 'sku', letter: 'A', label: 'SKU Code', type: 'code', readOnly: true, width: 110 },
    { key: 'name', letter: 'B', label: 'Item Description', type: 'text', width: 230 },
    { key: 'category', letter: 'C', label: 'Category', type: 'select', options: [
      'Hardware & Devices', 'Finished Goods & Products', 'Raw Materials & Parts', 
      'Office Equipment & Facilities', 'Packaging & Logistics', 'General Stock'
    ], width: 180 },
    { key: 'stock_quantity', letter: 'D', label: 'Stock Units', type: 'number', width: 110 },
    { key: 'reorder_point', letter: 'E', label: 'Reorder Point', type: 'number', width: 110 },
    { key: 'unit_cost', letter: 'F', label: `Cost Price (${currency})`, type: 'currency', width: 130 },
    { key: 'selling_price', letter: 'G', label: `Selling Price (${currency})`, type: 'currency', width: 140 },
    { key: 'margin', letter: 'H', label: 'Margin % (calc)', type: 'formula', readOnly: true, width: 120 },
    { key: 'supplier', letter: 'I', label: 'Supplier / Vendor', type: 'text', width: 180 },
    { key: 'branch_id', letter: 'J', label: 'Branch', type: 'select', options: branches.map(b => b.name), width: 130 }
  ], [currency, branches]);

  // Current Active Columns & Rows
  const currentColumns: ColumnDef[] = useMemo(() => {
    if (activeSheet === 'ledger') return ledgerColumns;
    if (activeSheet === 'inventory') return inventoryColumns;
    return scratchpadData.columns;
  }, [activeSheet, ledgerColumns, inventoryColumns, scratchpadData.columns]);

  const currentRawRows: any[] = useMemo(() => {
    if (activeSheet === 'ledger') return ledgerRows;
    if (activeSheet === 'inventory') return inventoryRows;
    return scratchpadData.rows;
  }, [activeSheet, ledgerRows, inventoryRows, scratchpadData.rows]);

  // Filtered rows by search query
  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return currentRawRows;
    const q = searchQuery.toLowerCase().trim();
    return currentRawRows.filter(row => {
      return Object.values(row).some(val => 
        val !== null && val !== undefined && String(val).toLowerCase().includes(q)
      );
    });
  }, [currentRawRows, searchQuery]);

  // Formula Evaluator
  const evaluateFormula = (val: any, row: any, colKey: string): any => {
    if (typeof val === 'string' && val.startsWith('=')) {
      try {
        const expr = val.substring(1).trim().toUpperCase();
        
        // Custom simple multiplier like =C1*D1 or =C2*D2
        if (expr.includes('*')) {
          const parts = expr.split('*');
          const getVal = (ref: string) => {
            ref = ref.trim();
            // If letter+number (e.g. C1 or C2)
            const match = ref.match(/^([A-Z])(\d+)$/);
            if (match) {
              const colLetter = match[1];
              const col = currentColumns.find(c => c.letter === colLetter);
              if (col) return Number(row[col.key] ?? 0);
            }
            return parseFloat(ref) || 0;
          };
          return getVal(parts[0]) * getVal(parts[1]);
        }

        // Margin % formula for inventory: (selling - cost) / selling * 100
        if (colKey === 'margin' || expr.includes('MARGIN')) {
          const cost = Number(row.unit_cost ?? 0);
          const sell = Number(row.selling_price ?? 0);
          if (sell > 0) {
            return `${(((sell - cost) / sell) * 100).toFixed(1)}%`;
          }
          return '0.0%';
        }

        // SUM formula
        if (expr.startsWith('SUM(')) {
          const inside = expr.replace('SUM(', '').replace(')', '');
          if (inside.includes(':')) {
            const [start] = inside.split(':');
            const colLetter = start.charAt(0);
            const col = currentColumns.find(c => c.letter === colLetter);
            if (col) {
              const sum = filteredRows.reduce((acc, r) => acc + (Number(r[col.key]) || 0), 0);
              return sum;
            }
          }
        }
      } catch {
        return val;
      }
    }

    // Auto-computed margin for inventory if column is margin
    if (colKey === 'margin' && activeSheet === 'inventory') {
      const cost = Number(row.unit_cost ?? 0);
      const sell = Number(row.selling_price ?? 0);
      if (sell > 0) {
        return `${(((sell - cost) / sell) * 100).toFixed(1)}%`;
      }
      return '0.0%';
    }

    return val;
  };

  // Helper to format cell display
  const formatCellValue = (val: any, col: ColumnDef, row: any) => {
    const computed = evaluateFormula(val, row, col.key);
    if (computed === null || computed === undefined || computed === '') return '';
    
    if (col.type === 'currency') {
      const num = Number(computed);
      if (isNaN(num)) return computed;
      return formatCurrency(num, currency);
    }
    if (col.type === 'number') {
      const num = Number(computed);
      return isNaN(num) ? computed : num.toLocaleString();
    }
    return String(computed);
  };

  // ── Sync Handler for cell changes ──
  const syncCellChange = async (rowIdx: number, colKey: string, newValue: any) => {
    const targetRow = filteredRows[rowIdx];
    if (!targetRow) return;

    setSyncStatus('syncing');
    setSyncMessage(`Saving cell ${currentColumns.find(c => c.key === colKey)?.letter || ''}${rowIdx + 1}...`);

    try {
      if (activeSheet === 'ledger') {
        const id = targetRow.id;
        const updates: any = {};
        
        if (colKey === 'amount') {
          const num = parseFloat(newValue);
          updates.amount = targetRow.type === 'Expense' ? -Math.abs(num) : Math.abs(num);
        } else if (colKey === 'type') {
          updates.type = newValue;
          if (targetRow.amount) {
            updates.amount = newValue === 'Expense' ? -Math.abs(targetRow.amount) : Math.abs(targetRow.amount);
          }
        } else if (colKey === 'branch_id') {
          const foundBranch = branches.find(b => b.name === newValue);
          updates.branch_id = foundBranch ? foundBranch.id : newValue;
        } else {
          updates[colKey] = newValue;
        }

        // Optimistic update
        setLedgerRows(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));

        // API call
        await updateTransactionApi(id, updates);

      } else if (activeSheet === 'inventory') {
        const sku = targetRow.sku || targetRow.id;
        const updates: any = {};

        if (colKey === 'stock_quantity' || colKey === 'reorder_point') {
          updates[colKey] = parseInt(newValue) || 0;
        } else if (colKey === 'unit_cost' || colKey === 'selling_price') {
          updates[colKey] = parseFloat(newValue) || 0;
        } else if (colKey === 'branch_id') {
          const foundBranch = branches.find(b => b.name === newValue);
          updates.branch_id = foundBranch ? foundBranch.id : newValue;
        } else {
          updates[colKey] = newValue;
        }

        // Optimistic update
        setInventoryRows(prev => prev.map(r => (r.sku === sku || r.id === sku) ? { ...r, ...updates } : r));

        // API call
        await updateInventoryItemApi(sku, updates);

      } else {
        // Scratchpad / Custom Sheet
        const updatedRows = scratchpadData.rows.map((r, idx) => {
          if (idx === rowIdx) {
            return { ...r, [colKey]: newValue };
          }
          return r;
        });

        setScratchpadData(prev => ({ ...prev, rows: updatedRows }));

        // Persist custom sheet
        await saveCustomSpreadsheetApi({
          id: 'scratchpad',
          title: 'Business Scratchpad',
          columns: scratchpadData.columns,
          rows: updatedRows
        });
      }

      setSyncStatus('synced');
      setSyncMessage('Auto-saved to database');
      setLastSyncTime(new Date().toLocaleTimeString());
      window.dispatchEvent(new CustomEvent('axis-data-updated'));
      if (onRefreshData) onRefreshData();

    } catch (err: any) {
      setSyncStatus('error');
      setSyncMessage(err.message || 'Failed to save cell change');
    }
  };

  // ── Cell Selection & Editing ──
  const handleSelectCell = (rowIdx: number, colKey: string) => {
    if (selectedCell?.rowIdx === rowIdx && selectedCell?.colKey === colKey && isEditing) {
      return;
    }
    
    // Commit previous edit if active
    if (isEditing && selectedCell) {
      commitEdit();
    }

    setSelectedCell({ rowIdx, colKey });
    setIsEditing(false);

    const row = filteredRows[rowIdx];
    if (row) {
      const raw = row[colKey] ?? '';
      setFormulaBarValue(String(raw));
    }
  };

  const handleDoubleClickCell = (rowIdx: number, colKey: string) => {
    const col = currentColumns.find(c => c.key === colKey);
    if (col?.readOnly) return;

    setSelectedCell({ rowIdx, colKey });
    const row = filteredRows[rowIdx];
    const initial = row ? (row[colKey] ?? '') : '';
    setEditValue(String(initial));
    setIsEditing(true);

    setTimeout(() => {
      cellInputRef.current?.focus();
      cellInputRef.current?.select();
    }, 50);
  };

  const commitEdit = () => {
    if (!selectedCell || !isEditing) return;
    const { rowIdx, colKey } = selectedCell;
    const row = filteredRows[rowIdx];
    if (!row) return;

    const currentVal = row[colKey] ?? '';
    if (String(currentVal) !== editValue) {
      syncCellChange(rowIdx, colKey, editValue);
    }

    setIsEditing(false);
  };

  const cancelEdit = () => {
    setIsEditing(false);
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!selectedCell) return;
    const { rowIdx, colKey } = selectedCell;
    const colIdx = currentColumns.findIndex(c => c.key === colKey);

    if (isEditing) {
      if (e.key === 'Enter') {
        e.preventDefault();
        commitEdit();
        // Move to next row down
        if (rowIdx < filteredRows.length - 1) {
          handleSelectCell(rowIdx + 1, colKey);
        }
      } else if (e.key === 'Tab') {
        e.preventDefault();
        commitEdit();
        // Move right
        if (e.shiftKey) {
          if (colIdx > 0) handleSelectCell(rowIdx, currentColumns[colIdx - 1].key);
        } else {
          if (colIdx < currentColumns.length - 1) handleSelectCell(rowIdx, currentColumns[colIdx + 1].key);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancelEdit();
      }
      return;
    }

    // Navigation mode
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (rowIdx < filteredRows.length - 1) handleSelectCell(rowIdx + 1, colKey);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (rowIdx > 0) handleSelectCell(rowIdx - 1, colKey);
    } else if (e.key === 'ArrowRight' || e.key === 'Tab') {
      e.preventDefault();
      if (colIdx < currentColumns.length - 1) handleSelectCell(rowIdx, currentColumns[colIdx + 1].key);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      if (colIdx > 0) handleSelectCell(rowIdx, currentColumns[colIdx - 1].key);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleDoubleClickCell(rowIdx, colKey);
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // Start typing directly into cell (like Excel!)
      const col = currentColumns[colIdx];
      if (!col.readOnly) {
        setIsEditing(true);
        setEditValue(e.key);
        setTimeout(() => {
          cellInputRef.current?.focus();
        }, 30);
      }
    }
  };

  // Add Row
  const handleAddRow = async () => {
    setSyncStatus('syncing');
    setSyncMessage('Adding new record row...');

    try {
      if (activeSheet === 'ledger') {
        const todayStr = new Date().toISOString().split('T')[0];
        const newTxn = await createTransactionApi({
          counterparty: 'New Entry',
          type: 'Expense',
          category: 'Operations & Logistics',
          accountType: 'Expense',
          date: todayStr,
          status: 'Cleared',
          amount: -100,
          notes: 'Entered via Axis Spreadsheet',
          branch_id: selectedBranch || undefined
        });

        setLedgerRows(prev => [newTxn, ...prev]);
        setSelectedCell({ rowIdx: 0, colKey: 'counterparty' });

      } else if (activeSheet === 'inventory') {
        const itemCode = `SKU-${Math.floor(1000 + Math.random() * 9000)}`;
        const res = await createInventoryItemApi({
          sku: itemCode,
          name: 'New Product Item',
          category: 'Hardware & Devices',
          stock_quantity: 10,
          reorder_point: 5,
          unit_cost: 50,
          selling_price: 100,
          supplier: 'Direct Supplier',
          branch_id: selectedBranch || undefined
        });

        const createdItem = res.item || {
          sku: itemCode,
          name: 'New Product Item',
          category: 'Hardware & Devices',
          stock_quantity: 10,
          reorder_point: 5,
          unit_cost: 50,
          selling_price: 100,
          supplier: 'Direct Supplier'
        };

        setInventoryRows(prev => [createdItem, ...prev]);
        setSelectedCell({ rowIdx: 0, colKey: 'name' });

      } else {
        const newRow = {
          id: `row-${Date.now()}`,
          colA: 'New Item',
          colB: 'General',
          colC: 1,
          colD: 100,
          colE: '=C' + (scratchpadData.rows.length + 1) + '*D' + (scratchpadData.rows.length + 1),
          colF: ''
        };

        const updated = [...scratchpadData.rows, newRow];
        setScratchpadData(prev => ({ ...prev, rows: updated }));
        await saveCustomSpreadsheetApi({
          id: 'scratchpad',
          title: 'Business Scratchpad',
          columns: scratchpadData.columns,
          rows: updated
        });
      }

      setSyncStatus('synced');
      setSyncMessage('New row created and synced');
      setLastSyncTime(new Date().toLocaleTimeString());
      window.dispatchEvent(new CustomEvent('axis-data-updated'));
    } catch (err: any) {
      setSyncStatus('error');
      setSyncMessage(err.message || 'Failed to add row');
    }
  };

  // Delete Row
  const handleDeleteRow = async () => {
    if (!selectedCell) return;
    const { rowIdx } = selectedCell;
    const row = filteredRows[rowIdx];
    if (!row) return;

    const rowName = row.counterparty || row.name || row.colA || row.id || `Row ${rowIdx + 1}`;
    if (!window.confirm(`Delete row ${rowIdx + 1} (${rowName}) from the spreadsheet and database?`)) {
      return;
    }

    setSyncStatus('syncing');
    setSyncMessage(`Deleting row ${rowIdx + 1}...`);

    try {
      if (activeSheet === 'ledger') {
        await deleteTransactionApi(row.id);
        setLedgerRows(prev => prev.filter(r => r.id !== row.id));
      } else if (activeSheet === 'inventory') {
        const sku = row.sku || row.id;
        await deleteInventoryItemApi(sku);
        setInventoryRows(prev => prev.filter(r => (r.sku !== sku && r.id !== sku)));
      } else {
        const updated = scratchpadData.rows.filter((_, idx) => idx !== rowIdx);
        setScratchpadData(prev => ({ ...prev, rows: updated }));
        await saveCustomSpreadsheetApi({
          id: 'scratchpad',
          title: 'Business Scratchpad',
          columns: scratchpadData.columns,
          rows: updated
        });
      }

      setSelectedCell(null);
      setSyncStatus('synced');
      setSyncMessage('Row deleted and synced');
      setLastSyncTime(new Date().toLocaleTimeString());
      window.dispatchEvent(new CustomEvent('axis-data-updated'));
    } catch (err: any) {
      setSyncStatus('error');
      setSyncMessage(err.message || 'Failed to delete row');
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = currentColumns.map(c => `"${c.label}"`).join(',');
    const rows = filteredRows.map(r => {
      return currentColumns.map(c => {
        const val = evaluateFormula(r[c.key], r, c.key) ?? '';
        return `"${String(val).replace(/"/g, '""')}"`;
      }).join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Axis_Spreadsheet_${activeSheet}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Import CSV
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const lines = text.split('\n').filter(l => l.trim().length > 0);
      if (lines.length <= 1) return;

      setSyncStatus('syncing');
      setSyncMessage(`Importing ${lines.length - 1} records from CSV...`);

      try {
        const headers = lines[0].split(',').map(h => h.replace(/(^"|"$)/g, '').trim());
        const importedData: any[] = [];

        for (let i = 1; i < lines.length; i++) {
          const cells = lines[i].split(',').map(c => c.replace(/(^"|"$)/g, '').trim());
          const obj: any = {};
          headers.forEach((h, idx) => {
            obj[h] = cells[idx] || '';
          });
          importedData.push(obj);
        }

        // If in scratchpad, populate directly
        if (activeSheet === 'scratchpad') {
          const newCols: ColumnDef[] = headers.map((h, i) => ({
            key: `col_${i}`,
            letter: String.fromCharCode(65 + i),
            label: h,
            type: 'text'
          }));

          const newRows = importedData.map((d, rIdx) => {
            const rowObj: any = { id: `import-${rIdx}` };
            headers.forEach((h, cIdx) => {
              rowObj[`col_${cIdx}`] = d[h];
            });
            return rowObj;
          });

          setScratchpadData({ columns: newCols, rows: newRows });
          await saveCustomSpreadsheetApi({
            id: 'scratchpad',
            title: 'Imported CSV Data',
            columns: newCols,
            rows: newRows
          });
        }

        setSyncStatus('synced');
        setSyncMessage(`Imported ${importedData.length} rows`);
        fetchAllData();
      } catch (err: any) {
        setSyncStatus('error');
        setSyncMessage('CSV import failed');
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  // ── Calculate Live Telemetry Stats (Excel Status Bar) ──
  const telemetry = useMemo(() => {
    const rowCount = filteredRows.length;
    let sum = 0;
    let numericCount = 0;
    let min = Infinity;
    let max = -Infinity;

    const activeColKey = selectedCell ? selectedCell.colKey : null;
    const colDef = currentColumns.find(c => c.key === activeColKey);

    filteredRows.forEach(r => {
      let val: any;
      if (activeColKey) {
        val = evaluateFormula(r[activeColKey], r, activeColKey);
      } else {
        val = r.amount ?? r.stock_quantity ?? 0;
      }

      const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/[^0-9.-]+/g, ''));
      if (!isNaN(num)) {
        sum += num;
        numericCount++;
        if (num < min) min = num;
        if (num > max) max = num;
      }
    });

    const avg = numericCount > 0 ? sum / numericCount : 0;
    const isCurrencyCol = colDef?.type === 'currency' || (!colDef && activeSheet === 'ledger');

    return {
      rowCount,
      numericCount,
      sum: numericCount > 0 ? (isCurrencyCol ? formatCurrency(sum, currency) : sum.toLocaleString()) : null,
      avg: numericCount > 0 ? (isCurrencyCol ? formatCurrency(avg, currency) : avg.toFixed(2)) : null,
      min: min !== Infinity ? (isCurrencyCol ? formatCurrency(min, currency) : min.toLocaleString()) : null,
      max: max !== -Infinity ? (isCurrencyCol ? formatCurrency(max, currency) : max.toLocaleString()) : null,
    };
  }, [filteredRows, selectedCell, currentColumns, activeSheet, currency]);

  // Active cell coordinate label (e.g. C4)
  const activeCellCoord = useMemo(() => {
    if (!selectedCell) return 'None';
    const col = currentColumns.find(c => c.key === selectedCell.colKey);
    const letter = col ? col.letter : 'A';
    return `${letter}${selectedCell.rowIdx + 1}`;
  }, [selectedCell, currentColumns]);

  return (
    <div className="tab-view active" style={{ padding: 0 }} onKeyDown={handleKeyDown} tabIndex={0}>
      <div className="axis-spreadsheet-container">
        
        {/* ── TOP RIBBON ── */}
        <div className="spreadsheet-ribbon">
          <div className="spreadsheet-brand">
            <div className="excel-badge" title="Axis Realtime Spreadsheet Engine">
              <i className="fa-solid fa-table"></i>
            </div>
            <div>
              <span className="spreadsheet-title">Axis Sheets</span>
              <span className="spreadsheet-subtitle">Real-time Business Grid &amp; Formula Engine</span>
            </div>
          </div>

          {/* Sync Status Badge */}
          <div className={`spreadsheet-sync-indicator ${syncStatus}`}>
            <span className={`sync-dot ${syncStatus === 'syncing' ? 'pulse' : ''}`}></span>
            <span>{syncMessage}</span>
            <span style={{ opacity: 0.6, fontSize: '0.7rem' }}>({lastSyncTime})</span>
          </div>

          {/* Action Tools */}
          <div className="spreadsheet-actions-group">
            {branches.length > 1 && (
              <select
                value={selectedBranch}
                onChange={e => setSelectedBranch(e.target.value)}
                style={{ background: '#1a1b26', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', padding: '4px 8px', color: '#00d4ff', fontSize: '0.78rem' }}
                title="Branch filter"
              >
                <option value="">All Branches</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            )}

            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
              <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: '8px', color: '#9ca3af', fontSize: '0.75rem' }}></i>
              <input
                type="text"
                placeholder="Find in sheet..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  background: '#1a1b26',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '6px',
                  padding: '4px 8px 4px 26px',
                  color: '#ffffff',
                  fontSize: '0.78rem',
                  width: '140px'
                }}
              />
            </div>

            <button className="sheet-tool-btn primary" onClick={handleAddRow} title="Add a new row (Excel Ctrl+Plus)">
              <i className="fa-solid fa-plus"></i> Add Row
            </button>

            <button 
              className="sheet-tool-btn danger" 
              onClick={handleDeleteRow} 
              disabled={!selectedCell}
              title="Delete the currently selected row"
            >
              <i className="fa-solid fa-trash-can"></i> Delete Row
            </button>

            <button className="sheet-tool-btn" onClick={fetchAllData} title="Force refresh from server">
              <i className={`fa-solid fa-arrows-rotate ${isLoading ? 'fa-spin' : ''}`}></i> Sync Now
            </button>

            <input ref={fileInputRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleImportCSV} />
            <button className="sheet-tool-btn" onClick={() => fileInputRef.current?.click()} title="Import external CSV into current sheet">
              <i className="fa-solid fa-file-import"></i> Import
            </button>

            <button className="sheet-tool-btn" onClick={handleExportCSV} title="Export sheet as CSV / Excel file">
              <i className="fa-solid fa-file-excel"></i> Export
            </button>
          </div>
        </div>

        {/* ── FORMULA BAR ── */}
        <div className="spreadsheet-formula-bar">
          <div className="formula-cell-box" title="Active Cell Reference">
            {activeCellCoord}
          </div>

          <div className="formula-fx-symbol" title="Formula Function">
            fx
          </div>

          <div className="formula-input-wrapper">
            <input
              ref={formulaInputRef}
              type="text"
              className="formula-input"
              value={formulaBarValue}
              onChange={e => {
                setFormulaBarValue(e.target.value);
                if (selectedCell) {
                  setEditValue(e.target.value);
                  setIsEditing(true);
                }
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commitEdit();
                }
              }}
              placeholder="Enter value or formula (e.g. =SUM(G1:G10), =C2*D2)..."
            />
          </div>

          {/* Quick formula helpers */}
          <div className="formula-chips">
            <button className="formula-chip" onClick={() => setFormulaBarValue('=SUM(')}>SUM</button>
            <button className="formula-chip" onClick={() => setFormulaBarValue('=AVERAGE(')}>AVG</button>
            <button className="formula-chip" onClick={() => setFormulaBarValue('=COUNT(')}>COUNT</button>
            <button className="formula-chip" onClick={() => setFormulaBarValue('=MAX(')}>MAX</button>
            <button className="formula-chip" onClick={() => setFormulaBarValue('=MIN(')}>MIN</button>
          </div>
        </div>

        {/* ── THE INTERACTIVE GRID VIEWPORT ── */}
        <div className="spreadsheet-grid-viewport" ref={gridContainerRef}>
          <table className="spreadsheet-grid-table">
            <thead>
              <tr>
                <th className="grid-corner-cell"></th>
                {currentColumns.map(col => {
                  const isSelectedCol = selectedCell?.colKey === col.key;
                  return (
                    <th 
                      key={col.key} 
                      className={`grid-col-header ${isSelectedCol ? 'selected-col' : ''}`}
                      style={{ width: col.width ? `${col.width}px` : undefined }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>{col.letter}</span>
                        <span style={{ fontSize: '0.68rem', opacity: 0.6, fontWeight: 400, marginLeft: '4px' }}>
                          {col.label}
                        </span>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={currentColumns.length + 1} style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
                    <i className="fa-solid fa-table-cells" style={{ fontSize: '2rem', marginBottom: '8px', opacity: 0.3, display: 'block' }}></i>
                    <div>No data rows in this sheet yet</div>
                    <button className="sheet-tool-btn primary" onClick={handleAddRow} style={{ marginTop: '10px' }}>
                      <i className="fa-solid fa-plus"></i> Insert First Row
                    </button>
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, rowIdx) => {
                  const isSelectedRow = selectedCell?.rowIdx === rowIdx;
                  return (
                    <tr key={row.id || row.sku || `row-${rowIdx}`}>
                      {/* Row Header (1, 2, 3...) */}
                      <td 
                        className={`grid-row-header ${isSelectedRow ? 'selected-row' : ''}`}
                        onClick={() => handleSelectCell(rowIdx, currentColumns[0].key)}
                      >
                        {rowIdx + 1}
                      </td>

                      {/* Columns A, B, C... */}
                      {currentColumns.map(col => {
                        const isCellActive = selectedCell?.rowIdx === rowIdx && selectedCell?.colKey === col.key;
                        const cellVal = row[col.key];
                        const isCellEditingNow = isCellActive && isEditing;

                        // Type class styling
                        let typeClass = '';
                        if (col.type === 'currency' || col.type === 'number') typeClass = 'cell-numeric';
                        if (col.type === 'code') typeClass = 'cell-code';
                        if (col.key === 'amount') {
                          typeClass += Number(cellVal) >= 0 ? ' cell-positive' : ' cell-negative';
                        }

                        return (
                          <td
                            key={col.key}
                            className={`grid-cell ${isCellActive ? 'active-cell' : ''} ${typeClass}`}
                            onClick={() => handleSelectCell(rowIdx, col.key)}
                            onDoubleClick={() => handleDoubleClickCell(rowIdx, col.key)}
                          >
                            {isCellEditingNow ? (
                              col.type === 'select' && col.options ? (
                                <select
                                  className="cell-inline-select"
                                  value={editValue}
                                  autoFocus
                                  onChange={e => {
                                    setEditValue(e.target.value);
                                    syncCellChange(rowIdx, col.key, e.target.value);
                                    setIsEditing(false);
                                  }}
                                  onBlur={commitEdit}
                                >
                                  {col.options.map(opt => (
                                    <option key={opt} value={opt} style={{ background: '#181924', color: '#fff' }}>
                                      {opt}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <input
                                  ref={cellInputRef}
                                  type={col.type === 'number' || col.type === 'currency' ? 'text' : col.type === 'date' ? 'date' : 'text'}
                                  className="cell-inline-input"
                                  value={editValue}
                                  onChange={e => setEditValue(e.target.value)}
                                  onBlur={commitEdit}
                                />
                              )
                            ) : (
                              // Formatted cell display
                              col.type === 'select' && (col.key === 'type' || col.key === 'status') ? (
                                <span className={`cell-tag ${String(cellVal).toLowerCase()}`}>
                                  {cellVal}
                                </span>
                              ) : (
                                <span>{formatCellValue(cellVal, col, row)}</span>
                              )
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── BOTTOM SHEET TABS & TELEMETRY ── */}
        <div className="spreadsheet-bottom-bar">
          {/* Sheet Selector Tabs */}
          <div className="spreadsheet-tabs">
            <button 
              className={`sheet-tab ${activeSheet === 'ledger' ? 'active' : ''}`}
              onClick={() => { setActiveSheet('ledger'); setSelectedCell({ rowIdx: 0, colKey: 'counterparty' }); }}
            >
              <i className="fa-solid fa-receipt" style={{ color: activeSheet === 'ledger' ? '#00d4ff' : '#9ca3af' }}></i>
              <span>Ledger &amp; Cashflow</span>
              <span style={{ fontSize: '0.68rem', opacity: 0.6 }}>({ledgerRows.length})</span>
            </button>

            <button 
              className={`sheet-tab ${activeSheet === 'inventory' ? 'active' : ''}`}
              onClick={() => { setActiveSheet('inventory'); setSelectedCell({ rowIdx: 0, colKey: 'name' }); }}
            >
              <i className="fa-solid fa-boxes-stacked" style={{ color: activeSheet === 'inventory' ? '#00d4ff' : '#9ca3af' }}></i>
              <span>Inventory &amp; SKUs</span>
              <span style={{ fontSize: '0.68rem', opacity: 0.6 }}>({inventoryRows.length})</span>
            </button>

            <button 
              className={`sheet-tab ${activeSheet === 'scratchpad' ? 'active' : ''}`}
              onClick={() => { setActiveSheet('scratchpad'); setSelectedCell({ rowIdx: 0, colKey: 'colA' }); }}
            >
              <i className="fa-solid fa-bolt" style={{ color: activeSheet === 'scratchpad' ? '#cebdff' : '#9ca3af' }}></i>
              <span>Custom Scratchpad</span>
              <span style={{ fontSize: '0.68rem', opacity: 0.6 }}>({scratchpadData.rows.length})</span>
            </button>

            {customSheets.filter(s => s.id !== 'scratchpad').map(cs => (
              <div key={cs.id} style={{ display: 'inline-flex', alignItems: 'center' }}>
                <button
                  className={`sheet-tab ${activeSheet === cs.id ? 'active' : ''}`}
                  onClick={() => { setActiveSheet(cs.id); }}
                >
                  <i className="fa-solid fa-table-list"></i>
                  <span>{cs.title}</span>
                  <span
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (!window.confirm(`Delete worksheet "${cs.title}"?`)) return;
                      await deleteCustomSpreadsheetApi(cs.id);
                      setCustomSheets(prev => prev.filter(s => s.id !== cs.id));
                      if (activeSheet === cs.id) setActiveSheet('ledger');
                    }}
                    style={{ marginLeft: '6px', opacity: 0.6, cursor: 'pointer' }}
                    title="Delete worksheet"
                  >
                    &times;
                  </span>
                </button>
              </div>
            ))}

            <button 
              className="sheet-tab-add" 
              title="Add Custom Worksheet"
              onClick={async () => {
                const title = prompt('Enter title for new spreadsheet:');
                if (!title) return;
                const newSheet = await saveCustomSpreadsheetApi({
                  title,
                  columns: [
                    { key: 'colA', letter: 'A', label: 'Item', type: 'text' },
                    { key: 'colB', letter: 'B', label: 'Value', type: 'number' }
                  ],
                  rows: [{ id: '1', colA: 'Sample', colB: 100 }]
                });
                setCustomSheets(prev => [...prev, newSheet]);
                setActiveSheet(newSheet.id);
              }}
            >
              <i className="fa-solid fa-plus"></i>
            </button>
          </div>

          {/* Quick Math Telemetry Bar (like Excel status bar) */}
          <div className="spreadsheet-status-telemetry">
            <div className="telemetry-item">
              <span className="telemetry-label">Rows:</span>
              <span className="telemetry-val">{telemetry.rowCount}</span>
            </div>

            {telemetry.sum !== null && (
              <div className="telemetry-item">
                <span className="telemetry-label">Sum:</span>
                <span className="telemetry-val highlight">{telemetry.sum}</span>
              </div>
            )}

            {telemetry.avg !== null && (
              <div className="telemetry-item">
                <span className="telemetry-label">Average:</span>
                <span className="telemetry-val">{telemetry.avg}</span>
              </div>
            )}

            {telemetry.min !== null && (
              <div className="telemetry-item">
                <span className="telemetry-label">Min:</span>
                <span className="telemetry-val">{telemetry.min}</span>
              </div>
            )}

            {telemetry.max !== null && (
              <div className="telemetry-item">
                <span className="telemetry-label">Max:</span>
                <span className="telemetry-val">{telemetry.max}</span>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
