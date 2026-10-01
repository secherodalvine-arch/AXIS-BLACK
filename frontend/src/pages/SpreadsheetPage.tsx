import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
  UserProfile 
} from '../utils/api';
import '../styles/spreadsheet.css';

interface SpreadsheetPageProps {
  currency?: Currency;
  transactions?: Transaction[];
  user?: UserProfile | null;
  onRefreshData?: () => void;
}

interface ColumnDef {
  key: string;
  letter: string;
  label: string;
  type: 'text' | 'number' | 'currency' | 'select' | 'date' | 'code' | 'formula';
  options?: string[];
  readOnly?: boolean;
  width?: number;
}

interface HistoryItem {
  id: string;
  title: string;
  sheetType: 'ledger' | 'inventory' | 'blank' | 'custom';
  recordCount: number;
  lastModified: string;
  timestamp: number;
}

interface WorksheetTab {
  id: string;
  title: string;
  sheetType: 'ledger' | 'inventory' | 'blank' | 'custom';
  icon: string;
  columns: ColumnDef[];
  rows: any[];
}

export const SpreadsheetPage: React.FC<SpreadsheetPageProps> = ({
  currency = 'USD',
  user: _user,
  onRefreshData
}) => {
  // ── Navigation State: 'hub' (Home Screen) or 'editor' (Workbook Interface) ──
  const [viewMode, setViewMode] = useState<'hub' | 'editor'>('hub');
  const [workbookTitle, setWorkbookTitle] = useState('Enterprise Financial Model');

  // ── Raw Data Stores ──
  const [liveLedger, setLiveLedger] = useState<any[]>([]);
  const [liveInventory, setLiveInventory] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  // ── Worksheets Tabs in Current Workbook ──
  const [openTabs, setOpenTabs] = useState<WorksheetTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>('');

  // ── History Tracking ──
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('axis_sheets_history');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      { id: 'h-ledger', title: 'Ledger & Cashflow Records', sheetType: 'ledger', recordCount: 0, lastModified: 'Today', timestamp: Date.now() - 3600000 },
      { id: 'h-inventory', title: 'Inventory & Stock Catalog', sheetType: 'inventory', recordCount: 0, lastModified: 'Today', timestamp: Date.now() - 7200000 }
    ];
  });
  const [historySearch, setHistorySearch] = useState('');

  // ── Sync State ──
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'error'>('synced');
  const [syncMessage, setSyncMessage] = useState<string>('Live Sync Active');
  const [lastSyncTime, setLastSyncTime] = useState<string>(new Date().toLocaleTimeString());

  // ── Grid Selection & Formatting State ──
  const [selectedCell, setSelectedCell] = useState<{ rowIdx: number; colKey: string } | null>({ rowIdx: 0, colKey: 'col_A' });
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState<string>('');
  const [formulaBarValue, setFormulaBarValue] = useState<string>('');

  // Cell formatting store: key format `${tabId}_${rowIdx}_${colKey}`
  const [cellStyles, setCellStyles] = useState<Record<string, { bold?: boolean; italic?: boolean; underline?: boolean; align?: 'left' | 'center' | 'right'; format?: string }>>({});

  const cellInputRef = useRef<HTMLInputElement | null>(null);
  const formulaInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // ── Standard Input Form Column Schemas ──
  const ledgerColumns: ColumnDef[] = useMemo(() => [
    { key: 'id', letter: 'A', label: 'Ref Code', type: 'code', readOnly: true, width: 110 },
    { key: 'date', letter: 'B', label: 'Date', type: 'date', width: 120 },
    { key: 'counterparty', letter: 'C', label: 'Description / Counterparty', type: 'text', width: 230 },
    { key: 'type', letter: 'D', label: 'Flow Type', type: 'select', options: ['Expense', 'Revenue'], width: 120 },
    { key: 'accountType', letter: 'E', label: 'Account Ledger', type: 'select', options: ['Cash', 'Bank', 'Accounts Receivable', 'Accounts Payable', 'Revenue', 'Expense'], width: 160 },
    { key: 'category', letter: 'F', label: 'Category', type: 'select', options: [
      'Operations & Logistics', 'Revenue & Sales', 'Software & Subscriptions', 
      'Cloud & Infrastructure', 'Payroll & Compensation', 'Marketing & Growth', 
      'Office & Facilities', 'Professional Services', 'Equipment & Assets', 'Treasury & Capital'
    ], width: 190 },
    { key: 'amount', letter: 'G', label: `Amount (${currency})`, type: 'currency', width: 130 },
    { key: 'status', letter: 'H', label: 'Status', type: 'select', options: ['Cleared', 'Pending', 'Processing'], width: 110 },
    { key: 'notes', letter: 'I', label: 'Notes / Reference Memo', type: 'text', width: 220 },
    { key: 'branch_id', letter: 'J', label: 'Branch Location', type: 'select', options: branches.map(b => b.name), width: 140 }
  ], [currency, branches]);

  const inventoryColumns: ColumnDef[] = useMemo(() => [
    { key: 'sku', letter: 'A', label: 'SKU Code', type: 'code', readOnly: true, width: 110 },
    { key: 'name', letter: 'B', label: 'Item Name / Description', type: 'text', width: 230 },
    { key: 'category', letter: 'C', label: 'Category', type: 'select', options: [
      'Hardware & Devices', 'Finished Goods & Products', 'Raw Materials & Parts', 
      'Office Equipment & Facilities', 'Packaging & Logistics', 'General Stock'
    ], width: 180 },
    { key: 'stock_quantity', letter: 'D', label: 'Stock Quantity Units', type: 'number', width: 130 },
    { key: 'reorder_point', letter: 'E', label: 'Reorder Alert Point', type: 'number', width: 130 },
    { key: 'unit_cost', letter: 'F', label: `Unit Cost ($)`, type: 'currency', width: 120 },
    { key: 'selling_price', letter: 'G', label: `Selling Price ($)`, type: 'currency', width: 130 },
    { key: 'margin', letter: 'H', label: 'Gross Margin %', type: 'formula', readOnly: true, width: 120 },
    { key: 'supplier', letter: 'I', label: 'Supplier / Vendor', type: 'text', width: 180 },
    { key: 'branch_id', letter: 'J', label: 'Branch Location', type: 'select', options: branches.map(b => b.name), width: 140 }
  ], [branches]);

  // Generate blank columns A through Z
  const generateBlankColumns = useCallback((): ColumnDef[] => {
    return Array.from({ length: 26 }, (_, i) => {
      const letter = String.fromCharCode(65 + i);
      return {
        key: `col_${letter}`,
        letter: letter,
        label: `Column ${letter}`,
        type: 'text',
        width: 120
      };
    });
  }, []);

  // Generate empty blank rows
  const generateBlankRows = useCallback((count: number = 60) => {
    return Array.from({ length: count }, (_, idx) => {
      const row: any = { id: `blank-row-${idx + 1}` };
      for (let i = 0; i < 26; i++) {
        const letter = String.fromCharCode(65 + i);
        row[`col_${letter}`] = '';
      }
      return row;
    });
  }, []);

  // ── Load Server Data ──
  const fetchPlatformData = useCallback(async () => {
    setIsLoading(true);
    setSyncStatus('syncing');
    setSyncMessage('Fetching latest records...');
    try {
      const [txns, inv, bList] = await Promise.all([
        getTransactionsApi(selectedBranch || undefined).catch(() => []),
        getInventoryApi(selectedBranch || undefined).catch(() => []),
        getBranchesApi().catch(() => [])
      ]);

      const tList = Array.isArray(txns) ? txns : [];
      const iList = Array.isArray(inv) ? inv : [];
      setLiveLedger(tList);
      setLiveInventory(iList);
      setBranches(Array.isArray(bList) ? bList : []);

      // Update history count
      setHistoryItems(prev => prev.map(h => {
        if (h.sheetType === 'ledger') return { ...h, recordCount: tList.length };
        if (h.sheetType === 'inventory') return { ...h, recordCount: iList.length };
        return h;
      }));

      setSyncStatus('synced');
      setSyncMessage('Live Sync Active');
      setLastSyncTime(new Date().toLocaleTimeString());
    } catch {
      setSyncStatus('error');
      setSyncMessage('Offline / Sync Error');
    } finally {
      setIsLoading(false);
    }
  }, [selectedBranch]);

  useEffect(() => {
    fetchPlatformData();
  }, [fetchPlatformData]);

  useEffect(() => {
    const handleRemoteUpdate = () => fetchPlatformData();
    window.addEventListener('axis-data-updated', handleRemoteUpdate);
    return () => window.removeEventListener('axis-data-updated', handleRemoteUpdate);
  }, [fetchPlatformData]);

  // Save history to localStorage
  const recordHistory = (title: string, sheetType: 'ledger' | 'inventory' | 'blank' | 'custom', count: number) => {
    const now = Date.now();
    const newItem: HistoryItem = {
      id: `hist-${Date.now()}`,
      title,
      sheetType,
      recordCount: count,
      lastModified: 'Just now',
      timestamp: now
    };
    setHistoryItems(prev => {
      const filtered = prev.filter(p => p.title !== title);
      const updated = [newItem, ...filtered].slice(0, 15);
      try {
        localStorage.setItem('axis_sheets_history', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  // ── Open Workbook Functions ──
  const openBlankWorkbook = () => {
    const blankCols = generateBlankColumns();
    const blankRows = generateBlankRows(70);
    const newTab: WorksheetTab = {
      id: `tab-sheet-1`,
      title: 'Sheet 1',
      sheetType: 'blank',
      icon: 'fa-file-lines',
      columns: blankCols,
      rows: blankRows
    };
    setOpenTabs([newTab]);
    setActiveTabId(newTab.id);
    setWorkbookTitle('Untitled Workbook');
    setSelectedCell({ rowIdx: 0, colKey: 'col_A' });
    setViewMode('editor');
    recordHistory('Untitled Blank Workbook', 'blank', blankRows.length);
  };

  const openInventoryWorkbook = () => {
    // Ensure at least 60 rows for endless feel
    const paddedRows = [...liveInventory];
    while (paddedRows.length < 60) {
      paddedRows.push({
        sku: `SKU-${1000 + paddedRows.length + 1}`,
        name: '',
        category: 'Hardware & Devices',
        stock_quantity: 0,
        reorder_point: 10,
        unit_cost: 0,
        selling_price: 0,
        supplier: '',
        branch_id: ''
      });
    }

    const invTab: WorksheetTab = {
      id: 'tab-inventory',
      title: 'Inventory & Stock Catalog',
      sheetType: 'inventory',
      icon: 'fa-boxes-stacked',
      columns: inventoryColumns,
      rows: paddedRows
    };

    setOpenTabs([invTab]);
    setActiveTabId(invTab.id);
    setWorkbookTitle('Inventory Management Model');
    setSelectedCell({ rowIdx: 0, colKey: 'name' });
    setViewMode('editor');
    recordHistory('Inventory & Stock Catalog', 'inventory', liveInventory.length);
  };

  const openLedgerWorkbook = () => {
    // Ensure at least 60 rows for endless feel
    const paddedRows = [...liveLedger];
    while (paddedRows.length < 60) {
      paddedRows.push({
        id: `TXN-${1000 + paddedRows.length + 1}`,
        date: new Date().toISOString().split('T')[0],
        counterparty: '',
        type: 'Expense',
        accountType: 'Expense',
        category: 'Operations & Logistics',
        amount: 0,
        status: 'Cleared',
        notes: '',
        branch_id: ''
      });
    }

    const ledgerTab: WorksheetTab = {
      id: 'tab-ledger',
      title: 'Ledger & Cashflow',
      sheetType: 'ledger',
      icon: 'fa-receipt',
      columns: ledgerColumns,
      rows: paddedRows
    };

    setOpenTabs([ledgerTab]);
    setActiveTabId(ledgerTab.id);
    setWorkbookTitle('Company Financial Ledger');
    setSelectedCell({ rowIdx: 0, colKey: 'counterparty' });
    setViewMode('editor');
    recordHistory('Ledger & Cashflow Records', 'ledger', liveLedger.length);
  };

  const openScratchpadWorkbook = async () => {
    setIsLoading(true);
    let rows: any[] = [];
    let cols = generateBlankColumns().slice(0, 10);
    cols[0].label = 'Item / Code';
    cols[1].label = 'Category';
    cols[2].label = 'Units';
    cols[2].type = 'number';
    cols[3].label = 'Unit Rate ($)';
    cols[3].type = 'currency';
    cols[4].label = 'Total ($)';
    cols[4].type = 'formula';

    try {
      const custom = await getCustomSpreadsheetsApi();
      const scratch = custom.find((c: any) => c.id === 'scratchpad');
      if (scratch && scratch.rows && scratch.rows.length) {
        rows = scratch.rows;
        if (scratch.columns) cols = scratch.columns;
      }
    } catch {}

    if (rows.length === 0) {
      rows = [
        { id: 'sc-1', col_A: 'Cloud Server Clusters', col_B: 'Infrastructure', col_C: 4, col_D: 850, col_E: '=C1*D1' },
        { id: 'sc-2', col_A: 'Enterprise Software Licenses', col_B: 'Software', col_C: 12, col_D: 45, col_E: '=C2*D2' },
        { id: 'sc-3', col_A: 'Ad Campaign & Growth', col_B: 'Marketing', col_C: 1, col_D: 3500, col_E: '=C3*D3' },
        { id: 'sc-4', col_A: 'Logistics Courier Contract', col_B: 'Operations', col_C: 25, col_D: 60, col_E: '=C4*D4' }
      ];
      while (rows.length < 50) {
        rows.push({ id: `sc-${rows.length + 1}`, col_A: '', col_B: '', col_C: 0, col_D: 0, col_E: '' });
      }
    }

    const scratchTab: WorksheetTab = {
      id: 'tab-scratchpad',
      title: 'Business Scratchpad',
      sheetType: 'custom',
      icon: 'fa-bolt',
      columns: cols,
      rows: rows
    };

    setOpenTabs([scratchTab]);
    setActiveTabId(scratchTab.id);
    setWorkbookTitle('Business Model & Scratchpad');
    setSelectedCell({ rowIdx: 0, colKey: cols[0].key });
    setViewMode('editor');
    setIsLoading(false);
    recordHistory('Business Scratchpad', 'custom', rows.length);
  };

  // ── Tab Management: Close (`×`) and Add Blank (`+`) ──
  const handleCloseTab = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    // Closes the worksheet tab from view WITHOUT deleting underlying database records!
    const remaining = openTabs.filter(t => t.id !== tabId);
    if (remaining.length === 0) {
      // If user closes all tabs, return to Hub
      setViewMode('hub');
      setOpenTabs([]);
      setActiveTabId('');
    } else {
      setOpenTabs(remaining);
      if (activeTabId === tabId) {
        setActiveTabId(remaining[remaining.length - 1].id);
      }
    }
  };

  const handleAddNewBlankTab = () => {
    // Plus creates a brand new blank worksheet, NOT replicating data that is not in existence!
    const newIdx = openTabs.length + 1;
    const blankCols = generateBlankColumns();
    const blankRows = generateBlankRows(60);

    const newTab: WorksheetTab = {
      id: `tab-blank-${Date.now()}`,
      title: `Sheet ${newIdx}`,
      sheetType: 'blank',
      icon: 'fa-table',
      columns: blankCols,
      rows: blankRows
    };

    setOpenTabs(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);
    setSelectedCell({ rowIdx: 0, colKey: 'col_A' });
  };

  // Current active worksheet
  const currentTab = useMemo(() => {
    return openTabs.find(t => t.id === activeTabId) || openTabs[0];
  }, [openTabs, activeTabId]);

  // Current columns and rows
  const activeColumns: ColumnDef[] = currentTab ? currentTab.columns : [];
  const activeRows: any[] = currentTab ? currentTab.rows : [];

  // ── Formula Engine ──
  const evaluateFormula = useCallback((val: any, row: any, colKey: string): any => {
    if (typeof val === 'string' && val.startsWith('=')) {
      try {
        const expr = val.substring(1).trim().toUpperCase();

        // Multiplication (=C1*D1 or =C2*D2)
        if (expr.includes('*')) {
          const parts = expr.split('*');
          const getVal = (ref: string) => {
            ref = ref.trim();
            const match = ref.match(/^([A-Z])(\d+)$/);
            if (match) {
              const letter = match[1];
              const col = activeColumns.find(c => c.letter === letter);
              if (col) return Number(row[col.key] ?? 0);
            }
            return parseFloat(ref) || 0;
          };
          return getVal(parts[0]) * getVal(parts[1]);
        }

        // Margin % formula for inventory
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
            const col = activeColumns.find(c => c.letter === colLetter);
            if (col) {
              return activeRows.reduce((acc, r) => acc + (Number(r[col.key]) || 0), 0);
            }
          }
        }
      } catch {
        return val;
      }
    }

    // Auto-computed gross profit margin for inventory
    if (colKey === 'margin' && currentTab?.sheetType === 'inventory') {
      const cost = Number(row.unit_cost ?? 0);
      const sell = Number(row.selling_price ?? 0);
      if (sell > 0) {
        return `${(((sell - cost) / sell) * 100).toFixed(1)}%`;
      }
      return '0.0%';
    }

    return val;
  }, [activeColumns, activeRows, currentTab]);

  const formatCellValue = (val: any, col: ColumnDef, row: any) => {
    const computed = evaluateFormula(val, row, col.key);
    if (computed === null || computed === undefined || computed === '') return '';
    if (col.type === 'currency') {
      const num = Number(computed);
      return isNaN(num) ? computed : formatCurrency(num, currency);
    }
    if (col.type === 'number') {
      const num = Number(computed);
      return isNaN(num) ? computed : num.toLocaleString();
    }
    return String(computed);
  };

  // ── Sync Cell Changes in Real Time ──
  const syncCellChange = async (rowIdx: number, colKey: string, newValue: any) => {
    if (!currentTab) return;
    const targetRow = activeRows[rowIdx];
    if (!targetRow) return;

    setSyncStatus('syncing');
    setSyncMessage(`Saving cell...`);

    // Optimistically update local worksheet rows
    const updatedRows = activeRows.map((r, idx) => {
      if (idx === rowIdx) {
        return { ...r, [colKey]: newValue };
      }
      return r;
    });

    setOpenTabs(prev => prev.map(t => t.id === currentTab.id ? { ...t, rows: updatedRows } : t));

    try {
      // 1. Sync Live Ledger
      if (currentTab.sheetType === 'ledger') {
        const id = targetRow.id;
        const updates: any = {};
        if (colKey === 'amount') {
          const num = parseFloat(newValue) || 0;
          updates.amount = targetRow.type === 'Expense' ? -Math.abs(num) : Math.abs(num);
        } else if (colKey === 'type') {
          updates.type = newValue;
          if (targetRow.amount) {
            updates.amount = newValue === 'Expense' ? -Math.abs(targetRow.amount) : Math.abs(targetRow.amount);
          }
        } else {
          updates[colKey] = newValue;
        }

        // Check if row already exists on server or is new
        const existsOnServer = liveLedger.some(t => t.id === id);
        if (existsOnServer) {
          await updateTransactionApi(id, updates);
        } else if (newValue && String(newValue).trim()) {
          // Auto-create new transaction on backend!
          const created = await createTransactionApi({
            counterparty: targetRow.counterparty || 'New Record',
            type: targetRow.type || 'Expense',
            category: targetRow.category || 'Operations & Logistics',
            accountType: targetRow.accountType || 'Expense',
            date: targetRow.date || new Date().toISOString().split('T')[0],
            amount: targetRow.amount || -10,
            status: targetRow.status || 'Cleared',
            notes: targetRow.notes || '',
            ...updates
          });
          // Update id
          setOpenTabs(prev => prev.map(t => t.id === currentTab.id ? {
            ...t,
            rows: t.rows.map((r, i) => i === rowIdx ? { ...r, id: created.id } : r)
          } : t));
        }

      // 2. Sync Live Inventory
      } else if (currentTab.sheetType === 'inventory') {
        const sku = targetRow.sku || targetRow.id;
        const updates: any = {};
        if (colKey === 'stock_quantity' || colKey === 'reorder_point') {
          updates[colKey] = parseInt(newValue) || 0;
        } else if (colKey === 'unit_cost' || colKey === 'selling_price') {
          updates[colKey] = parseFloat(newValue) || 0;
        } else {
          updates[colKey] = newValue;
        }

        const existsOnServer = liveInventory.some(i => i.sku === sku || i.id === sku);
        if (existsOnServer) {
          await updateInventoryItemApi(sku, updates);
        } else if (newValue && String(newValue).trim()) {
          // Auto-create SKU on backend!
          const created = await createInventoryItemApi({
            sku,
            name: targetRow.name || 'New Item',
            category: targetRow.category || 'Hardware & Devices',
            stock_quantity: targetRow.stock_quantity || 1,
            reorder_point: targetRow.reorder_point || 5,
            unit_cost: targetRow.unit_cost || 10,
            selling_price: targetRow.selling_price || 20,
            supplier: targetRow.supplier || 'Global Supplier',
            ...updates
          });
          if (created.item?.sku) {
            setOpenTabs(prev => prev.map(t => t.id === currentTab.id ? {
              ...t,
              rows: t.rows.map((r, i) => i === rowIdx ? { ...r, sku: created.item.sku } : r)
            } : t));
          }
        }

      // 3. Custom / Blank Workbook Persistence
      } else {
        await saveCustomSpreadsheetApi({
          id: currentTab.id,
          title: currentTab.title,
          columns: currentTab.columns,
          rows: updatedRows.slice(0, 100)
        });
      }

      setSyncStatus('synced');
      setSyncMessage('Saved in Realtime');
      setLastSyncTime(new Date().toLocaleTimeString());
      window.dispatchEvent(new CustomEvent('axis-data-updated'));
      if (onRefreshData) onRefreshData();

    } catch (err: any) {
      setSyncStatus('error');
      setSyncMessage(err.message || 'Sync failed');
    }
  };

  // ── Cell Selection & Editing ──
  const handleSelectCell = (rowIdx: number, colKey: string) => {
    if (selectedCell?.rowIdx === rowIdx && selectedCell?.colKey === colKey && isEditing) return;
    if (isEditing) commitEdit();

    setSelectedCell({ rowIdx, colKey });
    setIsEditing(false);

    const row = activeRows[rowIdx];
    if (row) {
      setFormulaBarValue(String(row[colKey] ?? ''));
    }
  };

  const handleDoubleClickCell = (rowIdx: number, colKey: string) => {
    const col = activeColumns.find(c => c.key === colKey);
    if (col?.readOnly) return;

    setSelectedCell({ rowIdx, colKey });
    const row = activeRows[rowIdx];
    setEditValue(String(row ? (row[colKey] ?? '') : ''));
    setIsEditing(true);

    setTimeout(() => {
      cellInputRef.current?.focus();
      cellInputRef.current?.select();
    }, 40);
  };

  const commitEdit = () => {
    if (!selectedCell || !isEditing) return;
    const { rowIdx, colKey } = selectedCell;
    const row = activeRows[rowIdx];
    if (!row) return;

    if (String(row[colKey] ?? '') !== editValue) {
      syncCellChange(rowIdx, colKey, editValue);
    }
    setIsEditing(false);
  };

  const cancelEdit = () => {
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!selectedCell) return;
    const { rowIdx, colKey } = selectedCell;
    const colIdx = activeColumns.findIndex(c => c.key === colKey);

    if (isEditing) {
      if (e.key === 'Enter') {
        e.preventDefault();
        commitEdit();
        if (rowIdx < activeRows.length - 1) handleSelectCell(rowIdx + 1, colKey);
      } else if (e.key === 'Tab') {
        e.preventDefault();
        commitEdit();
        if (e.shiftKey) {
          if (colIdx > 0) handleSelectCell(rowIdx, activeColumns[colIdx - 1].key);
        } else {
          if (colIdx < activeColumns.length - 1) handleSelectCell(rowIdx, activeColumns[colIdx + 1].key);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancelEdit();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (rowIdx < activeRows.length - 1) handleSelectCell(rowIdx + 1, colKey);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (rowIdx > 0) handleSelectCell(rowIdx - 1, colKey);
    } else if (e.key === 'ArrowRight' || e.key === 'Tab') {
      e.preventDefault();
      if (colIdx < activeColumns.length - 1) handleSelectCell(rowIdx, activeColumns[colIdx + 1].key);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      if (colIdx > 0) handleSelectCell(rowIdx, activeColumns[colIdx - 1].key);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleDoubleClickCell(rowIdx, colKey);
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const col = activeColumns[colIdx];
      if (!col.readOnly) {
        setIsEditing(true);
        setEditValue(e.key);
        setTimeout(() => cellInputRef.current?.focus(), 30);
      }
    }
  };

  // ── Pro Toolbar Operations ──
  const toggleStyle = (styleKey: 'bold' | 'italic' | 'underline') => {
    if (!selectedCell || !currentTab) return;
    const cellId = `${currentTab.id}_${selectedCell.rowIdx}_${selectedCell.colKey}`;
    setCellStyles(prev => {
      const curr = prev[cellId] || {};
      return { ...prev, [cellId]: { ...curr, [styleKey]: !curr[styleKey] } };
    });
  };

  const setCellAlignment = (align: 'left' | 'center' | 'right') => {
    if (!selectedCell || !currentTab) return;
    const cellId = `${currentTab.id}_${selectedCell.rowIdx}_${selectedCell.colKey}`;
    setCellStyles(prev => ({
      ...prev,
      [cellId]: { ...(prev[cellId] || {}), align }
    }));
  };

  const insertFormula = (func: string) => {
    const val = `=${func}(`;
    setFormulaBarValue(val);
    if (selectedCell) {
      setEditValue(val);
      setIsEditing(true);
      setTimeout(() => formulaInputRef.current?.focus(), 40);
    }
  };

  // Add Row
  const handleInsertRow = async () => {
    if (!currentTab) return;
    setSyncStatus('syncing');
    setSyncMessage('Inserting row...');

    try {
      if (currentTab.sheetType === 'ledger') {
        const todayStr = new Date().toISOString().split('T')[0];
        const newTxn = await createTransactionApi({
          counterparty: 'New Entry',
          type: 'Expense',
          category: 'Operations & Logistics',
          accountType: 'Expense',
          date: todayStr,
          status: 'Cleared',
          amount: -100,
          notes: 'Entered via Axis Spreadsheet'
        });
        const updated = [newTxn, ...activeRows];
        setOpenTabs(prev => prev.map(t => t.id === currentTab.id ? { ...t, rows: updated } : t));
        setLiveLedger(prev => [newTxn, ...prev]);

      } else if (currentTab.sheetType === 'inventory') {
        const itemCode = `SKU-${Math.floor(1000 + Math.random() * 9000)}`;
        const res = await createInventoryItemApi({
          sku: itemCode,
          name: 'New SKU Item',
          category: 'Hardware & Devices',
          stock_quantity: 10,
          reorder_point: 5,
          unit_cost: 50,
          selling_price: 100,
          supplier: 'Direct Supplier'
        });
        const created = res.item || { sku: itemCode, name: 'New SKU Item', category: 'Hardware & Devices', stock_quantity: 10, reorder_point: 5, unit_cost: 50, selling_price: 100, supplier: 'Direct Supplier' };
        const updated = [created, ...activeRows];
        setOpenTabs(prev => prev.map(t => t.id === currentTab.id ? { ...t, rows: updated } : t));
        setLiveInventory(prev => [created, ...prev]);

      } else {
        const newRow: any = { id: `row-${Date.now()}` };
        activeColumns.forEach(c => { newRow[c.key] = ''; });
        const updated = [newRow, ...activeRows];
        setOpenTabs(prev => prev.map(t => t.id === currentTab.id ? { ...t, rows: updated } : t));
      }

      setSelectedCell({ rowIdx: 0, colKey: activeColumns[1]?.key || activeColumns[0]?.key });
      setSyncStatus('synced');
      setSyncMessage('Row inserted and synced');
      setLastSyncTime(new Date().toLocaleTimeString());
      window.dispatchEvent(new CustomEvent('axis-data-updated'));
    } catch {
      setSyncStatus('error');
      setSyncMessage('Failed to insert row');
    }
  };

  // Delete Row
  const handleDeleteRow = async () => {
    if (!selectedCell || !currentTab) return;
    const { rowIdx } = selectedCell;
    const row = activeRows[rowIdx];
    if (!row) return;

    if (!window.confirm(`Delete row ${rowIdx + 1} from this worksheet and platform?`)) return;

    setSyncStatus('syncing');
    setSyncMessage(`Deleting row ${rowIdx + 1}...`);

    try {
      if (currentTab.sheetType === 'ledger' && row.id) {
        await deleteTransactionApi(row.id);
        setLiveLedger(prev => prev.filter(r => r.id !== row.id));
      } else if (currentTab.sheetType === 'inventory' && (row.sku || row.id)) {
        await deleteInventoryItemApi(row.sku || row.id);
        setLiveInventory(prev => prev.filter(r => (r.sku !== row.sku && r.id !== row.id)));
      }

      const updated = activeRows.filter((_, idx) => idx !== rowIdx);
      setOpenTabs(prev => prev.map(t => t.id === currentTab.id ? { ...t, rows: updated } : t));

      setSyncStatus('synced');
      setSyncMessage('Row deleted');
      setLastSyncTime(new Date().toLocaleTimeString());
      window.dispatchEvent(new CustomEvent('axis-data-updated'));
    } catch {
      setSyncStatus('error');
      setSyncMessage('Failed to delete row');
    }
  };

  // Add Column
  const handleInsertColumn = () => {
    if (!currentTab) return;
    const nextIdx = activeColumns.length;
    const letter = String.fromCharCode(65 + (nextIdx % 26)) + (nextIdx >= 26 ? Math.floor(nextIdx / 26) : '');
    const newCol: ColumnDef = {
      key: `col_${letter}_${Date.now()}`,
      letter,
      label: `Column ${letter}`,
      type: 'text',
      width: 130
    };
    const updatedCols = [...activeColumns, newCol];
    setOpenTabs(prev => prev.map(t => t.id === currentTab.id ? { ...t, columns: updatedCols } : t));
  };

  // Export CSV
  const handleExportWorkbook = () => {
    if (!currentTab) return;
    const headers = activeColumns.map(c => `"${c.label}"`).join(',');
    const rows = activeRows
      .filter(r => Object.values(r).some(v => v !== null && v !== undefined && String(v).trim() !== ''))
      .map(r => {
        return activeColumns.map(c => {
          const val = evaluateFormula(r[c.key], r, c.key) ?? '';
          return `"${String(val).replace(/"/g, '""')}"`;
        }).join(',');
      });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${workbookTitle.replace(/\s+/g, '_')}_${currentTab.title}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Import CSV
  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const lines = text.split('\n').filter(l => l.trim().length > 0);
      if (lines.length <= 1) return;

      const headers = lines[0].split(',').map(h => h.replace(/(^"|"$)/g, '').trim());
      const newCols: ColumnDef[] = headers.map((h, i) => ({
        key: `col_${i}`,
        letter: String.fromCharCode(65 + (i % 26)),
        label: h,
        type: 'text',
        width: 140
      }));

      const newRows = lines.slice(1).map((line, rIdx) => {
        const cells = line.split(',').map(c => c.replace(/(^"|"$)/g, '').trim());
        const rowObj: any = { id: `import-row-${rIdx + 1}` };
        headers.forEach((_, cIdx) => {
          rowObj[`col_${cIdx}`] = cells[cIdx] || '';
        });
        return rowObj;
      });

      const importTab: WorksheetTab = {
        id: `tab-import-${Date.now()}`,
        title: file.name.replace(/\.[^/.]+$/, ''),
        sheetType: 'custom',
        icon: 'fa-file-import',
        columns: newCols,
        rows: newRows
      };

      setOpenTabs(prev => [...prev, importTab]);
      setActiveTabId(importTab.id);
      setViewMode('editor');
      recordHistory(file.name, 'custom', newRows.length);
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Telemetry (Bottom status bar)
  const telemetry = useMemo(() => {
    const rowCount = activeRows.filter(r => Object.values(r).some(v => v !== null && v !== undefined && String(v).trim() !== '')).length;
    let sum = 0;
    let numCount = 0;
    let min = Infinity;
    let max = -Infinity;

    const activeColKey = selectedCell ? selectedCell.colKey : null;
    const colDef = activeColumns.find(c => c.key === activeColKey);

    activeRows.forEach(r => {
      if (activeColKey) {
        const val = evaluateFormula(r[activeColKey], r, activeColKey);
        const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/[^0-9.-]+/g, ''));
        if (!isNaN(num) && num !== 0) {
          sum += num;
          numCount++;
          if (num < min) min = num;
          if (num > max) max = num;
        }
      }
    });

    const avg = numCount > 0 ? sum / numCount : 0;
    const isCurrency = colDef?.type === 'currency' || (!colDef && currentTab?.sheetType === 'ledger');

    return {
      rowCount,
      sum: numCount > 0 ? (isCurrency ? formatCurrency(sum, currency) : sum.toLocaleString()) : null,
      avg: numCount > 0 ? (isCurrency ? formatCurrency(avg, currency) : avg.toFixed(2)) : null,
      min: min !== Infinity ? (isCurrency ? formatCurrency(min, currency) : min.toLocaleString()) : null,
      max: max !== -Infinity ? (isCurrency ? formatCurrency(max, currency) : max.toLocaleString()) : null,
    };
  }, [activeRows, selectedCell, activeColumns, evaluateFormula, currentTab, currency]);

  // Active cell coordinate label (e.g. C4)
  const activeCellCoord = useMemo(() => {
    if (!selectedCell) return 'None';
    const col = activeColumns.find(c => c.key === selectedCell.colKey);
    return `${col ? col.letter : 'A'}${selectedCell.rowIdx + 1}`;
  }, [selectedCell, activeColumns]);

  // Active cell format
  const activeCellId = selectedCell && currentTab ? `${currentTab.id}_${selectedCell.rowIdx}_${selectedCell.colKey}` : '';
  const currentFormat = cellStyles[activeCellId] || {};

  // Filtered History
  const filteredHistory = historyItems.filter(h => 
    !historySearch.trim() || h.title.toLowerCase().includes(historySearch.toLowerCase())
  );

  // ══════════════════════════════════════════════════════════════════════════
  // VIEW 1: SPREADSHEET HUB / WORKBOOKS START SCREEN
  // ══════════════════════════════════════════════════════════════════════════
  if (viewMode === 'hub') {
    return (
      <div className="tab-view active">
        <div className="sheet-hub-container">
          
          {/* Header */}
          <div className="sheet-hub-header">
            <div className="sheet-hub-title-group">
              <h2>
                <div className="excel-badge">
                  <i className="fa-solid fa-table"></i>
                </div>
                Axis Sheets
                <span className="sheet-hub-badge">EXCEL PRO</span>
              </h2>
              <p>Create blank workbooks, open live business records, or resume recent financial models</p>
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input ref={fileInputRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleImportCSV} />
              <button 
                className="sheet-back-btn" 
                onClick={() => fileInputRef.current?.click()}
                style={{ padding: '8px 14px', fontSize: '0.85rem' }}
              >
                <i className="fa-solid fa-file-import" style={{ marginRight: '6px' }}></i>
                Import CSV / Excel
              </button>
              <button 
                className="action-btn-primary" 
                onClick={openBlankWorkbook}
                style={{ padding: '8px 16px', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <i className="fa-solid fa-plus"></i> Blank Workbook
              </button>
            </div>
          </div>

          {/* New Workbook Templates Grid */}
          <div>
            <div className="sheet-section-title">
              <i className="fa-solid fa-wand-magic-sparkles" style={{ color: '#00d4ff' }}></i>
              Start a New Workbook
            </div>

            <div className="sheet-templates-grid">
              {/* Blank Workbook */}
              <div className="sheet-template-card blank" onClick={openBlankWorkbook}>
                <div className="template-icon-wrapper" style={{ background: 'rgba(0, 212, 255, 0.12)', color: '#00d4ff' }}>
                  <i className="fa-solid fa-plus"></i>
                </div>
                <div className="template-title">Blank Workbook</div>
                <div className="template-desc">Fresh endless worksheet with clean cells ready for calculation and data entry.</div>
                <div className="template-tag">
                  <i className="fa-solid fa-grid-2"></i> Clean Sheet
                </div>
              </div>

              {/* Inventory Records */}
              <div className="sheet-template-card" onClick={openInventoryWorkbook}>
                <div className="template-icon-wrapper" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#10b981' }}>
                  <i className="fa-solid fa-boxes-stacked"></i>
                </div>
                <div className="template-title">Inventory &amp; Stock</div>
                <div className="template-desc">Live two-way spreadsheet with SKU, Stock Units, Costs, Pricing, and Margins.</div>
                <div className="template-tag" style={{ color: '#10b981' }}>
                  <i className="fa-solid fa-link"></i> Live {liveInventory.length} SKUs
                </div>
              </div>

              {/* Ledger Records */}
              <div className="sheet-template-card" onClick={openLedgerWorkbook}>
                <div className="template-icon-wrapper" style={{ background: 'rgba(99, 102, 241, 0.12)', color: '#6366f1' }}>
                  <i className="fa-solid fa-receipt"></i>
                </div>
                <div className="template-title">Ledger &amp; Cashflow</div>
                <div className="template-desc">Live financial ledger with accounts, revenue, expenses, running balances, and status.</div>
                <div className="template-tag" style={{ color: '#6366f1' }}>
                  <i className="fa-solid fa-link"></i> Live {liveLedger.length} Records
                </div>
              </div>

              {/* Scratchpad */}
              <div className="sheet-template-card" onClick={openScratchpadWorkbook}>
                <div className="template-icon-wrapper" style={{ background: 'rgba(236, 72, 153, 0.12)', color: '#ec4899' }}>
                  <i className="fa-solid fa-bolt"></i>
                </div>
                <div className="template-title">Business Scratchpad</div>
                <div className="template-desc">Flexible modeling worksheet with custom formulas, multiplier math, and projections.</div>
                <div className="template-tag">
                  <i className="fa-solid fa-calculator"></i> Formulas Enabled
                </div>
              </div>
            </div>
          </div>

          {/* Recent Workbooks History */}
          <div className="sheet-history-card">
            <div className="sheet-history-toolbar">
              <div className="sheet-section-title" style={{ margin: 0 }}>
                <i className="fa-solid fa-clock-rotate-left"></i>
                Recent Workbooks &amp; History
              </div>

              <div className="sheet-history-search">
                <i className="fa-solid fa-magnifying-glass"></i>
                <input
                  type="text"
                  placeholder="Search workbooks history..."
                  value={historySearch}
                  onChange={e => setHistorySearch(e.target.value)}
                />
              </div>
            </div>

            <div className="table-responsive">
              <table className="sheet-history-table">
                <thead>
                  <tr>
                    <th>Workbook Name</th>
                    <th>Type / Source</th>
                    <th>Records</th>
                    <th>Last Worked On</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.map(item => (
                    <tr key={item.id}>
                      <td>
                        <div 
                          className="history-item-title"
                          onClick={() => {
                            if (item.sheetType === 'inventory') openInventoryWorkbook();
                            else if (item.sheetType === 'ledger') openLedgerWorkbook();
                            else if (item.sheetType === 'custom') openScratchpadWorkbook();
                            else openBlankWorkbook();
                          }}
                        >
                          <i className={`fa-solid ${item.sheetType === 'inventory' ? 'fa-boxes-stacked' : item.sheetType === 'ledger' ? 'fa-receipt' : 'fa-table'}`} style={{ color: '#00d4ff' }}></i>
                          <span>{item.title}</span>
                        </div>
                      </td>
                      <td>
                        <span className="template-tag" style={{ textTransform: 'capitalize' }}>
                          {item.sheetType}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'JetBrains Mono', fontSize: '0.82rem' }}>
                        {item.recordCount} rows
                      </td>
                      <td style={{ color: 'var(--sheet-text-muted)', fontSize: '0.82rem' }}>
                        {item.lastModified}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="sheet-back-btn"
                          onClick={() => {
                            if (item.sheetType === 'inventory') openInventoryWorkbook();
                            else if (item.sheetType === 'ledger') openLedgerWorkbook();
                            else if (item.sheetType === 'custom') openScratchpadWorkbook();
                            else openBlankWorkbook();
                          }}
                        >
                          <i className="fa-solid fa-arrow-up-right-from-square"></i> Open
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // VIEW 2: WORKBOOK EDITOR VIEW (Grid, Ribbon, Formula Bar, Tabs)
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="tab-view active" style={{ padding: 0 }} onKeyDown={handleKeyDown} tabIndex={0}>
      <div className="axis-spreadsheet-container">
        
        {/* ── 1. Top App Header / File Bar ── */}
        <div className="spreadsheet-app-header">
          <div className="spreadsheet-header-left">
            <button 
              className="sheet-back-btn" 
              onClick={() => setViewMode('hub')} 
              title="Return to Workbooks Hub"
            >
              <i className="fa-solid fa-arrow-left"></i> Workbooks
            </button>

            <div className="excel-badge">
              <i className="fa-solid fa-table"></i>
            </div>

            <input
              type="text"
              className="spreadsheet-title-input"
              value={workbookTitle}
              onChange={e => setWorkbookTitle(e.target.value)}
              title="Click to rename workbook"
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {/* Live Sync Status Indicator */}
            <div className={`spreadsheet-sync-indicator ${syncStatus}`}>
              <span className={`sync-dot ${syncStatus === 'syncing' ? 'pulse' : ''}`}></span>
              <span>{syncMessage}</span>
              <span style={{ opacity: 0.6, fontSize: '0.7rem' }}>({lastSyncTime})</span>
            </div>

            {branches.length > 1 && (
              <select
                value={selectedBranch}
                onChange={e => setSelectedBranch(e.target.value)}
                className="tool-select"
                title="Branch filter"
              >
                <option value="">All Branches</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            )}

            <button className="tool-btn" onClick={fetchPlatformData} title="Force sync from database">
              <i className={`fa-solid fa-arrows-rotate ${isLoading ? 'fa-spin' : ''}`}></i>
            </button>

            <input ref={fileInputRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleImportCSV} />
            <button className="tool-btn" onClick={() => fileInputRef.current?.click()} title="Import CSV">
              <i className="fa-solid fa-file-import"></i>
            </button>

            <button className="tool-btn" onClick={handleExportWorkbook} title="Export CSV">
              <i className="fa-solid fa-file-excel"></i> Export
            </button>
          </div>
        </div>

        {/* ── 2. Pro Spreadsheet Feature Ribbon / Toolbar ── */}
        <div className="spreadsheet-pro-toolbar">
          {/* Font Styles */}
          <div className="tool-group">
            <button 
              className={`tool-btn ${currentFormat.bold ? 'active' : ''}`} 
              onClick={() => toggleStyle('bold')} 
              title="Bold (Ctrl+B)"
            >
              <i className="fa-solid fa-bold"></i>
            </button>
            <button 
              className={`tool-btn ${currentFormat.italic ? 'active' : ''}`} 
              onClick={() => toggleStyle('italic')} 
              title="Italic (Ctrl+I)"
            >
              <i className="fa-solid fa-italic"></i>
            </button>
            <button 
              className={`tool-btn ${currentFormat.underline ? 'active' : ''}`} 
              onClick={() => toggleStyle('underline')} 
              title="Underline (Ctrl+U)"
            >
              <i className="fa-solid fa-underline"></i>
            </button>
          </div>

          {/* Alignment */}
          <div className="tool-group">
            <button 
              className={`tool-btn ${currentFormat.align === 'left' ? 'active' : ''}`} 
              onClick={() => setCellAlignment('left')} 
              title="Align Left"
            >
              <i className="fa-solid fa-align-left"></i>
            </button>
            <button 
              className={`tool-btn ${currentFormat.align === 'center' ? 'active' : ''}`} 
              onClick={() => setCellAlignment('center')} 
              title="Align Center"
            >
              <i className="fa-solid fa-align-center"></i>
            </button>
            <button 
              className={`tool-btn ${currentFormat.align === 'right' ? 'active' : ''}`} 
              onClick={() => setCellAlignment('right')} 
              title="Align Right"
            >
              <i className="fa-solid fa-align-right"></i>
            </button>
          </div>

          {/* Formats: Currency, Percent, Decimals */}
          <div className="tool-group">
            <button 
              className="tool-btn" 
              onClick={() => {
                if (selectedCell) {
                  const r = activeRows[selectedCell.rowIdx];
                  const val = r ? r[selectedCell.colKey] : 0;
                  const num = parseFloat(val) || 0;
                  syncCellChange(selectedCell.rowIdx, selectedCell.colKey, num.toFixed(2));
                }
              }} 
              title="Format as Currency"
            >
              <i className="fa-solid fa-dollar-sign"></i>
            </button>
            <button 
              className="tool-btn" 
              onClick={() => {
                if (selectedCell) {
                  const r = activeRows[selectedCell.rowIdx];
                  const val = r ? r[selectedCell.colKey] : 0;
                  syncCellChange(selectedCell.rowIdx, selectedCell.colKey, `${val}%`);
                }
              }} 
              title="Format as Percentage"
            >
              <i className="fa-solid fa-percent"></i>
            </button>
          </div>

          {/* Row & Column Controls */}
          <div className="tool-group">
            <button className="tool-btn primary" onClick={handleInsertRow} title="Add Row Below">
              <i className="fa-solid fa-plus"></i> Row
            </button>
            <button className="tool-btn danger" onClick={handleDeleteRow} title="Delete Selected Row">
              <i className="fa-solid fa-trash-can"></i> Row
            </button>
            <button className="tool-btn" onClick={handleInsertColumn} title="Add Column Right">
              <i className="fa-solid fa-plus"></i> Col
            </button>
          </div>

          {/* Functions Menu */}
          <div className="tool-group">
            <select
              className="tool-select"
              onChange={e => {
                if (e.target.value) {
                  insertFormula(e.target.value);
                  e.target.value = '';
                }
              }}
              defaultValue=""
            >
              <option value="" disabled>Σ Functions</option>
              <option value="SUM">SUM (Total)</option>
              <option value="AVERAGE">AVERAGE (Mean)</option>
              <option value="COUNT">COUNT (Tally)</option>
              <option value="MAX">MAX (Maximum)</option>
              <option value="MIN">MIN (Minimum)</option>
            </select>
          </div>

          {/* Quick Clear */}
          <div className="tool-group">
            <button 
              className="tool-btn" 
              onClick={() => {
                if (selectedCell) {
                  syncCellChange(selectedCell.rowIdx, selectedCell.colKey, '');
                }
              }} 
              title="Clear Cell"
            >
              <i className="fa-solid fa-eraser"></i>
            </button>
          </div>
        </div>

        {/* ── 3. Clean Formula Bar ── */}
        <div className="spreadsheet-formula-bar">
          <div className="formula-cell-box" title="Active Cell Reference">
            {activeCellCoord}
          </div>

          <div className="formula-fx-symbol" title="Formula">
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
              placeholder="Type value or formula (e.g. =SUM(G1:G20), =C2*D2)..."
            />
          </div>
        </div>

        {/* ── 4. The Endless 2D Grid Table Viewport ── */}
        <div className="spreadsheet-grid-viewport">
          <table className="spreadsheet-grid-table">
            <thead>
              <tr>
                {/* Corner Cell (Fixed Top-Left) */}
                <th className="grid-corner-cell"></th>
                {activeColumns.map(col => {
                  const isSelectedCol = selectedCell?.colKey === col.key;
                  return (
                    <th 
                      key={col.key} 
                      className={`grid-col-header ${isSelectedCol ? 'selected-col' : ''}`}
                      style={{ width: col.width ? `${col.width}px` : undefined }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>{col.letter}</span>
                        <span style={{ fontSize: '0.68rem', opacity: 0.7, fontWeight: 400, marginLeft: '6px' }}>
                          {col.label}
                        </span>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {activeRows.map((row, rowIdx) => {
                const isSelectedRow = selectedCell?.rowIdx === rowIdx;
                return (
                  <tr key={row.id || row.sku || `row-${rowIdx}`}>
                    {/* Sticky Row Number (1, 2, 3...) */}
                    <td 
                      className={`grid-row-header ${isSelectedRow ? 'selected-row' : ''}`}
                      onClick={() => handleSelectCell(rowIdx, activeColumns[0]?.key || 'col_A')}
                    >
                      {rowIdx + 1}
                    </td>

                    {/* Columns A, B, C... */}
                    {activeColumns.map(col => {
                      const isCellActive = selectedCell?.rowIdx === rowIdx && selectedCell?.colKey === col.key;
                      const cellVal = row[col.key];
                      const isCellEditingNow = isCellActive && isEditing;

                      const cellStyleKey = `${currentTab?.id}_${rowIdx}_${col.key}`;
                      const st = cellStyles[cellStyleKey] || {};

                      // Classes
                      let classes = 'grid-cell';
                      if (isCellActive) classes += ' active-cell';
                      if (col.type === 'currency' || col.type === 'number') classes += ' cell-numeric';
                      if (col.type === 'code') classes += ' cell-code';
                      if (col.key === 'amount') {
                        classes += Number(cellVal) >= 0 ? ' cell-positive' : ' cell-negative';
                      }
                      if (st.bold) classes += ' cell-bold';
                      if (st.italic) classes += ' cell-italic';
                      if (st.underline) classes += ' cell-underline';
                      if (st.align) classes += ` cell-align-${st.align}`;

                      return (
                        <td
                          key={col.key}
                          className={classes}
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
                                  <option key={opt} value={opt}>
                                    {opt}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <input
                                ref={cellInputRef}
                                type={col.type === 'date' ? 'date' : 'text'}
                                className="cell-inline-input"
                                value={editValue}
                                onChange={e => setEditValue(e.target.value)}
                                onBlur={commitEdit}
                              />
                            )
                          ) : (
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
              })}
            </tbody>
          </table>
        </div>

        {/* ── 5. Bottom Worksheet Tabs & Status Bar ── */}
        <div className="spreadsheet-bottom-bar">
          {/* Tabs bar */}
          <div className="spreadsheet-tabs">
            {openTabs.map(tab => (
              <button
                key={tab.id}
                className={`sheet-tab ${activeTabId === tab.id ? 'active' : ''}`}
                onClick={() => {
                  setActiveTabId(tab.id);
                  setSelectedCell({ rowIdx: 0, colKey: tab.columns[0]?.key || 'col_A' });
                }}
              >
                <i className={`fa-solid ${tab.icon}`}></i>
                <span>{tab.title}</span>
                <span 
                  className="sheet-tab-close" 
                  onClick={e => handleCloseTab(e, tab.id)}
                  title="Close worksheet from view"
                >
                  &times;
                </span>
              </button>
            ))}

            {/* Plus creates a new clean blank worksheet */}
            <button 
              className="sheet-tab-add" 
              onClick={handleAddNewBlankTab}
              title="Create new blank worksheet"
            >
              <i className="fa-solid fa-plus"></i>
            </button>
          </div>

          {/* Quick Telemetry (Status Bar) */}
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
                <span className="telemetry-label">Avg:</span>
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
