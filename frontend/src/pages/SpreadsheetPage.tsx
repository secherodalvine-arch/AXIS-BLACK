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

export interface ColumnDef {
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
  month?: string;
}

interface WorksheetTab {
  id: string;
  title: string;
  sheetType: 'ledger' | 'inventory' | 'blank' | 'custom';
  icon: string;
  columns: ColumnDef[];
  rows: any[];
  saveTarget: 'workbook' | 'inventory' | 'ledger';
  monthFilter?: string;
  isStructuredTable?: boolean; // true for Inventory / Ledger with dedicated Row 1 field headers
}

// Generate Excel Column Letter: 0->A, 25->Z, 26->AA, 27->AB...
export const getColumnLetter = (colIdx: number): string => {
  let letter = '';
  let temp = colIdx;
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
};

// Available months helper (Current month + last 11 months)
export const getAvailableMonthsList = () => {
  const months = [{ value: 'ALL', label: 'All Months / Complete History' }];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const val = d.toISOString().slice(0, 7); // e.g. "2026-10"
    const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    months.push({ value: val, label });
  }
  return months;
};

export const SpreadsheetPage: React.FC<SpreadsheetPageProps> = ({
  currency = 'USD',
  user: currentUser,
  onRefreshData
}) => {
  // ── Navigation State: 'hub' (Home Screen) or 'editor' (Workbook Interface) ──
  const [viewMode, setViewMode] = useState<'hub' | 'editor'>('hub');
  const [workbookTitle, setWorkbookTitle] = useState('Enterprise Financial Model');
  const [isEditingTitle, setIsEditingTitle] = useState(false);

  // ── Month Filter for Opening Records ──
  const availableMonths = useMemo(() => getAvailableMonthsList(), []);
  const [hubInvMonth, setHubInvMonth] = useState<string>(new Date().toISOString().slice(0, 7));
  const [hubLedgerMonth, setHubLedgerMonth] = useState<string>(new Date().toISOString().slice(0, 7));
  const [csvImportMonth, setCsvImportMonth] = useState<string>(new Date().toISOString().slice(0, 7));

  // ── Raw Data Stores ──
  const [liveLedger, setLiveLedger] = useState<any[]>([]);
  const [liveInventory, setLiveInventory] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  // ── Worksheets Tabs in Current Workbook ──
  const [openTabs, setOpenTabs] = useState<WorksheetTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>('');
  const [dirtyTabs, setDirtyTabs] = useState<Record<string, boolean>>({});

  // ── Tab Renaming Inline State ──
  const [renamingTabId, setRenamingTabId] = useState<string | null>(null);
  const [tabRenameValue, setTabRenameValue] = useState<string>('');

  // ── Unsaved Changes Modal State ──
  const [unsavedModal, setUnsavedModal] = useState<{
    isOpen: boolean;
    tabIdToClose?: string;
    navigateToHub?: boolean;
  }>({ isOpen: false });

  // ── Toolbar Dropdown Menus ──
  const [openInsertRowMenu, setOpenInsertRowMenu] = useState(false);
  const [openInsertColMenu, setOpenInsertColMenu] = useState(false);

  // ── History Tracking ──
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('axis_sheets_history');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      { id: 'h-ledger', title: 'Ledger & Cashflow Records', sheetType: 'ledger', recordCount: 0, lastModified: 'Today', timestamp: Date.now() - 3600000, month: 'All' },
      { id: 'h-inventory', title: 'Inventory & Stock Catalog', sheetType: 'inventory', recordCount: 0, lastModified: 'Today', timestamp: Date.now() - 7200000, month: 'All' }
    ];
  });
  const [historySearch, setHistorySearch] = useState('');

  // ── Sync State ──
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'error'>('synced');
  const [syncMessage, setSyncMessage] = useState<string>('Live Sync Active');
  const [lastSyncTime, setLastSyncTime] = useState<string>(new Date().toLocaleTimeString());

  // ── Grid Selection & Formatting State ──
  const [selectedCell, setSelectedCell] = useState<{ rowIdx: number; colKey: string } | null>({ rowIdx: 0, colKey: 'col_A' });
  const [selectionRange, setSelectionRange] = useState<{ startRow: number; startColIdx: number; endRow: number; endColIdx: number } | null>(null);
  const [isMouseDownSelecting, setIsMouseDownSelecting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState<string>('');
  const [formulaBarValue, setFormulaBarValue] = useState<string>('');

  // ── Context Menu State ──
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; rowIdx: number; colKey: string } | null>(null);

  // Cell formatting store: key format `${tabId}_${rowIdx}_${colKey}`
  const [cellStyles, setCellStyles] = useState<Record<string, { bold?: boolean; italic?: boolean; underline?: boolean; align?: 'left' | 'center' | 'right'; format?: string }>>({});

  const cellInputRef = useRef<HTMLInputElement | null>(null);
  const formulaInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const gridContainerRef = useRef<HTMLDivElement | null>(null);

  // ── Standard Input Form Column Schemas ──
  // Matching "Add Transaction" fields exactly
  const ledgerColumns: ColumnDef[] = useMemo(() => [
    { key: 'date', letter: 'A', label: 'Date (YYYY-MM-DD)', type: 'date', width: 130 },
    { key: 'counterparty', letter: 'B', label: 'Description / Counterparty', type: 'text', width: 240 },
    { key: 'type', letter: 'C', label: 'Flow Type', type: 'select', options: ['Expense', 'Revenue'], width: 120 },
    { key: 'accountType', letter: 'D', label: 'Account Ledger', type: 'select', options: ['Cash', 'Bank', 'Accounts Receivable', 'Accounts Payable', 'Revenue', 'Expense'], width: 160 },
    { key: 'category', letter: 'E', label: 'Category', type: 'select', options: [
      'Operations & Logistics', 'Revenue & Sales', 'Software & Subscriptions', 
      'Cloud & Infrastructure', 'Payroll & Compensation', 'Marketing & Growth', 
      'Office & Facilities', 'Professional Services', 'Equipment & Assets', 'Treasury & Capital'
    ], width: 190 },
    { key: 'amount', letter: 'F', label: `Amount (${currency})`, type: 'currency', width: 130 },
    { key: 'status', letter: 'G', label: 'Status', type: 'select', options: ['Cleared', 'Pending', 'Processing'], width: 110 },
    { key: 'notes', letter: 'H', label: 'Notes / Reference Memo', type: 'text', width: 230 },
    { key: 'branch_id', letter: 'I', label: 'Branch Location', type: 'select', options: branches.map(b => b.name), width: 150 },
    { key: 'id', letter: 'J', label: 'Ref Code', type: 'code', readOnly: true, width: 110 }
  ], [currency, branches]);

  // Matching "Add Inventory Item" modal fields exactly
  const inventoryColumns: ColumnDef[] = useMemo(() => [
    { key: 'name', letter: 'A', label: 'Item Name / Description', type: 'text', width: 240 },
    { key: 'category', letter: 'B', label: 'Category', type: 'select', options: [
      'Hardware & Devices', 'Finished Goods & Products', 'Raw Materials & Parts', 
      'Office Equipment & Facilities', 'Packaging & Logistics', 'General Stock'
    ], width: 190 },
    { key: 'stock_quantity', letter: 'C', label: 'Initial Stock Units', type: 'number', width: 140 },
    { key: 'reorder_point', letter: 'D', label: 'Reorder Alert Threshold', type: 'number', width: 140 },
    { key: 'unit_cost', letter: 'E', label: `Unit Cost ($)`, type: 'currency', width: 120 },
    { key: 'selling_price', letter: 'F', label: `Selling Price ($)`, type: 'currency', width: 130 },
    { key: 'margin', letter: 'G', label: 'Gross Margin %', type: 'formula', readOnly: true, width: 120 },
    { key: 'supplier', letter: 'H', label: 'Supplier / Vendor', type: 'text', width: 190 },
    { key: 'branch_id', letter: 'I', label: 'Assign to Branch', type: 'select', options: branches.map(b => b.name), width: 150 },
    { key: 'sku', letter: 'J', label: 'SKU Code', type: 'code', readOnly: true, width: 110 }
  ], [branches]);

  // Generate blank columns beyond Z (e.g. 52 columns: A..Z, AA..AZ)
  const generateBlankColumns = useCallback((count: number = 52): ColumnDef[] => {
    return Array.from({ length: count }, (_, i) => {
      const letter = getColumnLetter(i);
      return {
        key: `col_${letter}`,
        letter: letter,
        label: `Column ${letter}`,
        type: 'text',
        width: 120
      };
    });
  }, []);

  // Generate clean empty rows with NO fake IDs or ghost data
  const generateCleanRows = useCallback((columns: ColumnDef[], count: number = 100): any[] => {
    return Array.from({ length: count }, (_, idx) => {
      const row: any = { _id: `row-${Date.now()}-${idx + 1}` };
      columns.forEach(col => {
        row[col.key] = '';
      });
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

      // Update history record counts
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

  // Close context menu on outside click
  useEffect(() => {
    const handleClickOutside = () => {
      setContextMenu(null);
      setOpenInsertRowMenu(false);
      setOpenInsertColMenu(false);
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  // Save history to localStorage (only when user actually saves work)
  const recordHistory = (title: string, sheetType: 'ledger' | 'inventory' | 'blank' | 'custom', count: number, month?: string) => {
    const now = Date.now();
    const newItem: HistoryItem = {
      id: `hist-${Date.now()}`,
      title,
      sheetType,
      recordCount: count,
      lastModified: 'Just now',
      timestamp: now,
      month: month || 'All'
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

  // ══════════════════════════════════════════════════════════════════════════
  // OPEN WORKBOOK WORKFLOWS
  // ══════════════════════════════════════════════════════════════════════════

  // 1. New Inventory Entry (Add Inventory Item)
  const openNewInventoryEntry = () => {
    const emptyRows = generateCleanRows(inventoryColumns, 80);
    const newTab: WorksheetTab = {
      id: `tab-new-inv-${Date.now()}`,
      title: 'New Inventory Entry',
      sheetType: 'inventory',
      icon: 'fa-boxes-stacked',
      columns: inventoryColumns,
      rows: emptyRows,
      saveTarget: 'inventory',
      isStructuredTable: true
    };
    setOpenTabs([newTab]);
    setActiveTabId(newTab.id);
    setWorkbookTitle('Add Inventory Items - Data Entry');
    setSelectedCell({ rowIdx: 0, colKey: 'name' });
    setSelectionRange(null);
    setViewMode('editor');
  };

  // 2. New Ledger Entry (Add Transaction)
  const openNewLedgerEntry = () => {
    const emptyRows = generateCleanRows(ledgerColumns, 80);
    // Pre-populate today's date on first row for convenience
    if (emptyRows[0]) {
      emptyRows[0].date = new Date().toISOString().split('T')[0];
      emptyRows[0].type = 'Expense';
      emptyRows[0].status = 'Cleared';
    }
    const newTab: WorksheetTab = {
      id: `tab-new-ledger-${Date.now()}`,
      title: 'New Ledger Entry',
      sheetType: 'ledger',
      icon: 'fa-receipt',
      columns: ledgerColumns,
      rows: emptyRows,
      saveTarget: 'ledger',
      isStructuredTable: true
    };
    setOpenTabs([newTab]);
    setActiveTabId(newTab.id);
    setWorkbookTitle('Record Ledger Transactions - Data Entry');
    setSelectedCell({ rowIdx: 0, colKey: 'counterparty' });
    setSelectionRange(null);
    setViewMode('editor');
  };

  // 3. Blank Workbook (Clean Endless Calculation Grid)
  const openBlankWorkbook = () => {
    const blankCols = generateBlankColumns(52);
    const blankRows = generateCleanRows(blankCols, 120);
    const newTab: WorksheetTab = {
      id: `tab-sheet-1`,
      title: 'Sheet 1',
      sheetType: 'blank',
      icon: 'fa-file-lines',
      columns: blankCols,
      rows: blankRows,
      saveTarget: 'workbook',
      isStructuredTable: false
    };
    setOpenTabs([newTab]);
    setActiveTabId(newTab.id);
    setWorkbookTitle('Untitled Workbook');
    setSelectedCell({ rowIdx: 0, colKey: 'col_A' });
    setSelectionRange(null);
    setViewMode('editor');
  };

  // 4. Edit Inventory Records (Filtered by Month)
  const openEditInventoryRecords = (month: string = hubInvMonth) => {
    // Filter actual records by month without injecting any fake SKUs!
    const filteredRecords = month === 'ALL'
      ? [...liveInventory]
      : liveInventory.filter(item => {
          const itemDate = item.created_at || item.date || '';
          return itemDate.startsWith(month);
        });

    // Clean padding: only add clean empty rows if less than 60, with NO fake SKUs!
    const rows = [...filteredRecords];
    while (rows.length < 80) {
      const emptyRow: any = { _id: `empty-inv-${rows.length + 1}` };
      inventoryColumns.forEach(c => { emptyRow[c.key] = ''; });
      rows.push(emptyRow);
    }

    const monthLabel = availableMonths.find(m => m.value === month)?.label || month;
    const invTab: WorksheetTab = {
      id: 'tab-inventory',
      title: month === 'ALL' ? 'Inventory (All)' : `Inventory (${month})`,
      sheetType: 'inventory',
      icon: 'fa-boxes-stacked',
      columns: inventoryColumns,
      rows: rows,
      saveTarget: 'inventory',
      monthFilter: month,
      isStructuredTable: true
    };

    setOpenTabs([invTab]);
    setActiveTabId(invTab.id);
    setWorkbookTitle(`Inventory Catalog - ${monthLabel}`);
    setSelectedCell({ rowIdx: 0, colKey: 'name' });
    setSelectionRange(null);
    setViewMode('editor');
    recordHistory(`Inventory Catalog (${month})`, 'inventory', filteredRecords.length, month);
  };

  // 5. Edit Ledger Records (Filtered by Month)
  const openEditLedgerRecords = (month: string = hubLedgerMonth) => {
    // Filter actual records by month without injecting any fake transactions!
    const filteredRecords = month === 'ALL'
      ? [...liveLedger]
      : liveLedger.filter(txn => txn.date && txn.date.startsWith(month));

    const rows = [...filteredRecords];
    while (rows.length < 80) {
      const emptyRow: any = { _id: `empty-txn-${rows.length + 1}` };
      ledgerColumns.forEach(c => { emptyRow[c.key] = ''; });
      rows.push(emptyRow);
    }

    const monthLabel = availableMonths.find(m => m.value === month)?.label || month;
    const ledgerTab: WorksheetTab = {
      id: 'tab-ledger',
      title: month === 'ALL' ? 'Ledger (All)' : `Ledger (${month})`,
      sheetType: 'ledger',
      icon: 'fa-receipt',
      columns: ledgerColumns,
      rows: rows,
      saveTarget: 'ledger',
      monthFilter: month,
      isStructuredTable: true
    };

    setOpenTabs([ledgerTab]);
    setActiveTabId(ledgerTab.id);
    setWorkbookTitle(`Financial Ledger - ${monthLabel}`);
    setSelectedCell({ rowIdx: 0, colKey: 'counterparty' });
    setSelectionRange(null);
    setViewMode('editor');
    recordHistory(`Financial Ledger (${month})`, 'ledger', filteredRecords.length, month);
  };

  // 6. Business Scratchpad
  const openScratchpadWorkbook = async () => {
    setIsLoading(true);
    let rows: any[] = [];
    let cols = generateBlankColumns(26).slice(0, 8);
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
        { _id: 'sc-1', col_A: 'Cloud Server Clusters', col_B: 'Infrastructure', col_C: 4, col_D: 850, col_E: '=C1*D1' },
        { _id: 'sc-2', col_A: 'Enterprise Software Licenses', col_B: 'Software', col_C: 12, col_D: 45, col_E: '=C2*D2' },
        { _id: 'sc-3', col_A: 'Ad Campaign & Growth', col_B: 'Marketing', col_C: 1, col_D: 3500, col_E: '=C3*D3' },
        { _id: 'sc-4', col_A: 'Logistics Courier Contract', col_B: 'Operations', col_C: 25, col_D: 60, col_E: '=C4*D4' }
      ];
      while (rows.length < 60) {
        rows.push({ _id: `sc-${rows.length + 1}`, col_A: '', col_B: '', col_C: 0, col_D: 0, col_E: '' });
      }
    }

    const scratchTab: WorksheetTab = {
      id: 'tab-scratchpad',
      title: 'Business Scratchpad',
      sheetType: 'custom',
      icon: 'fa-bolt',
      columns: cols,
      rows: rows,
      saveTarget: 'workbook',
      isStructuredTable: false
    };

    setOpenTabs([scratchTab]);
    setActiveTabId(scratchTab.id);
    setWorkbookTitle('Business Model & Scratchpad');
    setSelectedCell({ rowIdx: 0, colKey: cols[0].key });
    setSelectionRange(null);
    setViewMode('editor');
    setIsLoading(false);
    recordHistory('Business Scratchpad', 'custom', rows.length);
  };

  // ── Tab Management: Close (`×`), Add Blank (`+`), Rename ──
  const requestCloseTab = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    if (dirtyTabs[tabId]) {
      setUnsavedModal({ isOpen: true, tabIdToClose: tabId });
    } else {
      executeCloseTab(tabId);
    }
  };

  const executeCloseTab = (tabId: string) => {
    const remaining = openTabs.filter(t => t.id !== tabId);
    setDirtyTabs(prev => {
      const copy = { ...prev };
      delete copy[tabId];
      return copy;
    });

    if (remaining.length === 0) {
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

  const requestNavigateToHub = () => {
    const hasAnyDirty = Object.values(dirtyTabs).some(v => v);
    if (hasAnyDirty) {
      setUnsavedModal({ isOpen: true, navigateToHub: true });
    } else {
      setViewMode('hub');
    }
  };

  const handleAddNewBlankTab = () => {
    // Plus creates a brand new blank worksheet with clean cells
    const newIdx = openTabs.length + 1;
    const blankCols = generateBlankColumns(52);
    const blankRows = generateCleanRows(blankCols, 100);

    const newTab: WorksheetTab = {
      id: `tab-blank-${Date.now()}`,
      title: `Sheet ${newIdx}`,
      sheetType: 'blank',
      icon: 'fa-table',
      columns: blankCols,
      rows: blankRows,
      saveTarget: 'workbook',
      isStructuredTable: false
    };

    setOpenTabs(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);
    setSelectedCell({ rowIdx: 0, colKey: 'col_A' });
    setSelectionRange(null);
  };

  const startRenameTab = (e: React.MouseEvent, tabId: string, currentTitle: string) => {
    e.stopPropagation();
    setRenamingTabId(tabId);
    setTabRenameValue(currentTitle);
  };

  const commitTabRename = () => {
    if (!renamingTabId || !tabRenameValue.trim()) {
      setRenamingTabId(null);
      return;
    }
    setOpenTabs(prev => prev.map(t => t.id === renamingTabId ? { ...t, title: tabRenameValue.trim() } : t));
    setRenamingTabId(null);
  };

  // Current active worksheet
  const currentTab = useMemo(() => {
    return openTabs.find(t => t.id === activeTabId) || openTabs[0];
  }, [openTabs, activeTabId]);

  const activeColumns: ColumnDef[] = currentTab ? currentTab.columns : [];
  const activeRows: any[] = currentTab ? currentTab.rows : [];
  const isCurrentTabDirty = Boolean(currentTab && dirtyTabs[currentTab.id]);

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
            const match = ref.match(/^([A-Z]+)(\d+)$/);
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

        // SUM formula: =SUM(F1:F10)
        if (expr.startsWith('SUM(')) {
          const inside = expr.replace('SUM(', '').replace(')', '');
          if (inside.includes(':')) {
            const [start] = inside.split(':');
            const colLetter = start.replace(/[0-9]/g, '');
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

  // ── Cell Editing & Local Dirty Tracking ──
  const updateCellValue = (rowIdx: number, colKey: string, newValue: any) => {
    if (!currentTab) return;

    // Update local worksheet rows
    const updatedRows = activeRows.map((r, idx) => {
      if (idx === rowIdx) {
        return { ...r, [colKey]: newValue };
      }
      return r;
    });

    setOpenTabs(prev => prev.map(t => t.id === currentTab.id ? { ...t, rows: updatedRows } : t));
    setDirtyTabs(prev => ({ ...prev, [currentTab.id]: true }));
  };

  // ── Explicit Save Function (Toolbar Save / Ctrl+S) ──
  const handleSaveWorkbook = async () => {
    if (!currentTab) return;
    setSyncStatus('syncing');
    setSyncMessage('Saving changes...');

    try {
      const target = currentTab.saveTarget;

      // 1. Save to Live Inventory
      if (target === 'inventory') {
        const rowsWithContent = activeRows.filter(r => 
          (r.name && String(r.name).trim()) || (r.sku && String(r.sku).trim())
        );

        for (const row of rowsWithContent) {
          const sku = row.sku || row.id;
          const updates = {
            name: row.name || 'New Item',
            category: row.category || 'Hardware & Devices',
            stock_quantity: parseInt(row.stock_quantity) || 0,
            reorder_point: parseInt(row.reorder_point) || 5,
            unit_cost: parseFloat(row.unit_cost) || 0,
            selling_price: parseFloat(row.selling_price) || 0,
            supplier: row.supplier || 'Global Supplier',
            branch_id: row.branch_id || currentUser?.branch_id || undefined
          };

          const existsOnServer = liveInventory.some(i => i.sku === sku || i.id === sku);
          if (existsOnServer) {
            await updateInventoryItemApi(sku, updates);
          } else {
            const itemCode = sku || `SKU-${Math.floor(1000 + Math.random() * 9000)}`;
            await createInventoryItemApi({ sku: itemCode, ...updates });
          }
        }

        await fetchPlatformData();
        window.dispatchEvent(new CustomEvent('axis-data-updated'));
        if (onRefreshData) onRefreshData();

      // 2. Save to Live Ledger
      } else if (target === 'ledger') {
        const rowsWithContent = activeRows.filter(r => 
          (r.counterparty && String(r.counterparty).trim()) || (r.amount && Number(r.amount) !== 0)
        );

        for (const row of rowsWithContent) {
          const id = row.id;
          const numAmount = parseFloat(row.amount) || 0;
          const updates = {
            counterparty: row.counterparty || 'New Record',
            type: row.type || 'Expense',
            accountType: row.accountType || 'Expense',
            category: row.category || 'Operations & Logistics',
            date: row.date || new Date().toISOString().split('T')[0],
            amount: row.type === 'Expense' ? -Math.abs(numAmount) : Math.abs(numAmount),
            status: row.status || 'Cleared',
            notes: row.notes || '',
            branch_id: row.branch_id || currentUser?.branch_id || undefined
          };

          const existsOnServer = liveLedger.some(t => t.id === id);
          if (existsOnServer) {
            await updateTransactionApi(id, updates);
          } else {
            await createTransactionApi(updates);
          }
        }

        await fetchPlatformData();
        window.dispatchEvent(new CustomEvent('axis-data-updated'));
        if (onRefreshData) onRefreshData();

      // 3. Save as Custom Workbook Model (Does NOT pollute Inventory or Ledger)
      } else {
        await saveCustomSpreadsheetApi({
          id: currentTab.id,
          title: currentTab.title,
          columns: currentTab.columns,
          rows: activeRows.filter(r => Object.values(r).some(v => v !== null && v !== undefined && String(v).trim() !== ''))
        });
      }

      // Mark tab clean
      setDirtyTabs(prev => ({ ...prev, [currentTab.id]: false }));
      setSyncStatus('synced');
      setSyncMessage('All Changes Saved');
      setLastSyncTime(new Date().toLocaleTimeString());
      recordHistory(currentTab.title, currentTab.sheetType, activeRows.filter(r => Object.values(r).some(v => v !== null && v !== undefined && String(v).trim() !== '')).length, currentTab.monthFilter);

    } catch (err: any) {
      setSyncStatus('error');
      setSyncMessage(err.message || 'Save failed');
    }
  };

  // ── Cell Selection & Navigation ──
  const handleSelectCell = (rowIdx: number, colKey: string) => {
    if (selectedCell?.rowIdx === rowIdx && selectedCell?.colKey === colKey && isEditing) return;
    if (isEditing) commitEdit();

    setSelectedCell({ rowIdx, colKey });
    const colIdx = activeColumns.findIndex(c => c.key === colKey);
    setSelectionRange({ startRow: rowIdx, startColIdx: colIdx, endRow: rowIdx, endColIdx: colIdx });
    setIsEditing(false);

    const row = activeRows[rowIdx];
    if (row) {
      setFormulaBarValue(String(row[colKey] ?? ''));
    }
  };

  const handleCellMouseDown = (rowIdx: number, colKey: string) => {
    const colIdx = activeColumns.findIndex(c => c.key === colKey);
    setSelectedCell({ rowIdx, colKey });
    setSelectionRange({ startRow: rowIdx, startColIdx: colIdx, endRow: rowIdx, endColIdx: colIdx });
    setIsMouseDownSelecting(true);
    setIsEditing(false);
  };

  const handleCellMouseEnter = (rowIdx: number, colKey: string) => {
    if (!isMouseDownSelecting || !selectionRange) return;
    const colIdx = activeColumns.findIndex(c => c.key === colKey);
    setSelectionRange(prev => prev ? { ...prev, endRow: rowIdx, endColIdx: colIdx } : null);
  };

  const handleMouseUp = () => {
    setIsMouseDownSelecting(false);
  };

  useEffect(() => {
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, []);

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
      updateCellValue(rowIdx, colKey, editValue);
    }
    setIsEditing(false);
  };

  const cancelEdit = () => {
    setIsEditing(false);
  };

  // ── Keyboard Shortcuts (Ctrl+S, Ctrl+C, Ctrl+V, Shift+Arrows, Delete) ──
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Ctrl+S / Cmd+S: Save
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      handleSaveWorkbook();
      return;
    }

    // Ctrl+B / Ctrl+I / Ctrl+U
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      toggleStyle('bold');
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') {
      e.preventDefault();
      toggleStyle('italic');
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'u') {
      e.preventDefault();
      toggleStyle('underline');
      return;
    }

    if (!selectedCell) return;
    const { rowIdx, colKey } = selectedCell;
    const colIdx = activeColumns.findIndex(c => c.key === colKey);

    // When editing inside input
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

    // Shift + Arrow (Expand Range Selection)
    if (e.shiftKey && ['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft'].includes(e.key)) {
      e.preventDefault();
      setSelectionRange(prev => {
        if (!prev) return { startRow: rowIdx, startColIdx: colIdx, endRow: rowIdx, endColIdx: colIdx };
        let newEndRow = prev.endRow;
        let newEndCol = prev.endColIdx;
        if (e.key === 'ArrowDown' && newEndRow < activeRows.length - 1) newEndRow++;
        if (e.key === 'ArrowUp' && newEndRow > 0) newEndRow--;
        if (e.key === 'ArrowRight' && newEndCol < activeColumns.length - 1) newEndCol++;
        if (e.key === 'ArrowLeft' && newEndCol > 0) newEndCol--;
        return { ...prev, endRow: newEndRow, endColIdx: newEndCol };
      });
      return;
    }

    // Navigation Arrows
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
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      clearSelectedCells();
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const col = activeColumns[colIdx];
      if (col && !col.readOnly) {
        setIsEditing(true);
        setEditValue(e.key);
        setTimeout(() => cellInputRef.current?.focus(), 30);
      }
    }
  };

  // Clear highlighted / selected cells
  const clearSelectedCells = () => {
    if (!selectionRange) {
      if (selectedCell) updateCellValue(selectedCell.rowIdx, selectedCell.colKey, '');
      return;
    }
    const minR = Math.min(selectionRange.startRow, selectionRange.endRow);
    const maxR = Math.max(selectionRange.startRow, selectionRange.endRow);
    const minC = Math.min(selectionRange.startColIdx, selectionRange.endColIdx);
    const maxC = Math.max(selectionRange.startColIdx, selectionRange.endColIdx);

    const updatedRows = activeRows.map((r, rIdx) => {
      if (rIdx >= minR && rIdx <= maxR) {
        const copy = { ...r };
        for (let c = minC; c <= maxC; c++) {
          const colKey = activeColumns[c]?.key;
          if (colKey) copy[colKey] = '';
        }
        return copy;
      }
      return r;
    });

    setOpenTabs(prev => prev.map(t => t.id === currentTab.id ? { ...t, rows: updatedRows } : t));
    setDirtyTabs(prev => ({ ...prev, [currentTab.id]: true }));
  };

  // ── Context Menu (Right-Click) Handler ──
  const handleContextMenu = (e: React.MouseEvent, rowIdx: number, colKey: string) => {
    e.preventDefault();
    handleSelectCell(rowIdx, colKey);
    setContextMenu({
      x: Math.min(e.clientX, window.innerWidth - 220),
      y: Math.min(e.clientY, window.innerHeight - 300),
      rowIdx,
      colKey
    });
  };

  // ── Toolbar Styling Operations ──
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

  // ── Row & Column Insertion from Toolbar (Position Selection) ──
  const handleInsertRowAt = (position: 'above' | 'below' | 'top' | 'bottom') => {
    if (!currentTab) return;
    const activeIdx = selectedCell ? selectedCell.rowIdx : 0;
    let insertIndex = 0;

    if (position === 'above') insertIndex = activeIdx;
    else if (position === 'below') insertIndex = activeIdx + 1;
    else if (position === 'top') insertIndex = 0;
    else if (position === 'bottom') {
      // Find last row with actual data
      const lastDataIdx = activeRows.reduce((last, r, idx) => {
        return Object.values(r).some(v => v !== null && v !== undefined && String(v).trim() !== '') ? idx : last;
      }, 0);
      insertIndex = lastDataIdx + 1;
    }

    const newRow: any = { _id: `row-${Date.now()}` };
    activeColumns.forEach(c => { newRow[c.key] = ''; });

    const updated = [...activeRows];
    updated.splice(insertIndex, 0, newRow);

    setOpenTabs(prev => prev.map(t => t.id === currentTab.id ? { ...t, rows: updated } : t));
    setDirtyTabs(prev => ({ ...prev, [currentTab.id]: true }));
    setSelectedCell({ rowIdx: insertIndex, colKey: activeColumns[0]?.key || 'col_A' });
    setOpenInsertRowMenu(false);
  };

  const handleDeleteActiveRow = async () => {
    if (!selectedCell || !currentTab) return;
    const { rowIdx } = selectedCell;
    const row = activeRows[rowIdx];
    if (!row) return;

    if (!window.confirm(`Delete row ${rowIdx + 1}?`)) return;

    try {
      if (currentTab.saveTarget === 'ledger' && row.id && liveLedger.some(t => t.id === row.id)) {
        await deleteTransactionApi(row.id).catch(() => {});
        setLiveLedger(prev => prev.filter(t => t.id !== row.id));
      } else if (currentTab.saveTarget === 'inventory' && (row.sku || row.id) && liveInventory.some(i => (i.sku === row.sku || i.id === row.id))) {
        await deleteInventoryItemApi(row.sku || row.id).catch(() => {});
        setLiveInventory(prev => prev.filter(i => i.sku !== row.sku && i.id !== row.id));
      }
    } catch {}

    const updated = activeRows.filter((_, idx) => idx !== rowIdx);
    setOpenTabs(prev => prev.map(t => t.id === currentTab.id ? { ...t, rows: updated } : t));
    setDirtyTabs(prev => ({ ...prev, [currentTab.id]: true }));
  };

  const handleInsertColumnAt = (position: 'left' | 'right' | 'end') => {
    if (!currentTab) return;
    const activeIdx = selectedCell ? activeColumns.findIndex(c => c.key === selectedCell.colKey) : 0;
    let insertIndex = activeColumns.length;

    if (position === 'left') insertIndex = activeIdx;
    else if (position === 'right') insertIndex = activeIdx + 1;

    const newLetter = getColumnLetter(activeColumns.length);
    const newCol: ColumnDef = {
      key: `col_${Date.now()}`,
      letter: newLetter,
      label: `Column ${newLetter}`,
      type: 'text',
      width: 130
    };

    const updatedCols = [...activeColumns];
    updatedCols.splice(insertIndex, 0, newCol);

    // Re-letter all columns
    const relettered = updatedCols.map((c, idx) => ({ ...c, letter: getColumnLetter(idx) }));

    setOpenTabs(prev => prev.map(t => t.id === currentTab.id ? { ...t, columns: relettered } : t));
    setDirtyTabs(prev => ({ ...prev, [currentTab.id]: true }));
    setOpenInsertColMenu(false);
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

  // Import CSV with Month / Period selection
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
        letter: getColumnLetter(i),
        label: h,
        type: 'text',
        width: 140
      }));

      const newRows = lines.slice(1).map((line, rIdx) => {
        const cells = line.split(',').map(c => c.replace(/(^"|"$)/g, '').trim());
        const rowObj: any = { _id: `import-row-${rIdx + 1}` };
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
        rows: newRows,
        saveTarget: 'workbook',
        monthFilter: csvImportMonth,
        isStructuredTable: false
      };

      setOpenTabs(prev => [...prev, importTab]);
      setActiveTabId(importTab.id);
      setViewMode('editor');
      recordHistory(file.name, 'custom', newRows.length, csvImportMonth);
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

  const activeCellId = selectedCell && currentTab ? `${currentTab.id}_${selectedCell.rowIdx}_${selectedCell.colKey}` : '';
  const currentFormat = cellStyles[activeCellId] || {};

  // Filtered History
  const filteredHistory = historyItems.filter(h => 
    !historySearch.trim() || h.title.toLowerCase().includes(historySearch.toLowerCase())
  );

  // ══════════════════════════════════════════════════════════════════════════
  // VIEW 1: SPREADSHEET HUB (Workbooks Home)
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
              <p>Select what you want to do: enter new records, open &amp; edit business data by month, or build financial models</p>
            </div>
          </div>

          {/* Section 1: Create New Worksheet / Data Entry */}
          <div>
            <div className="sheet-section-title">
              <div className="sheet-section-title-left">
                <i className="fa-solid fa-pen-to-square" style={{ color: '#00d4ff' }}></i>
                <span>Data Entry &amp; New Worksheets</span>
              </div>
              <span className="sheet-section-badge">Fast Recording</span>
            </div>

            <div className="sheet-templates-grid">
              {/* New Inventory Item Entry */}
              <div className="sheet-template-card">
                <div className="template-icon-wrapper" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#10b981' }}>
                  <i className="fa-solid fa-boxes-stacked"></i>
                </div>
                <div className="template-title">New Inventory Entry</div>
                <div className="template-desc">
                  Opens a clean worksheet with exact headers from <strong>Add Inventory Item</strong> (Item Name, Category, Stock Units, Unit Cost, Selling Price, Supplier).
                </div>
                <div className="sheet-card-action-row">
                  <button className="sheet-card-btn primary" onClick={openNewInventoryEntry}>
                    <i className="fa-solid fa-plus"></i> Start Inventory Entry
                  </button>
                </div>
              </div>

              {/* New Ledger / Cashflow Entry */}
              <div className="sheet-template-card">
                <div className="template-icon-wrapper" style={{ background: 'rgba(99, 102, 241, 0.12)', color: '#6366f1' }}>
                  <i className="fa-solid fa-receipt"></i>
                </div>
                <div className="template-title">New Ledger Entry</div>
                <div className="template-desc">
                  Opens a clean worksheet with exact headers from <strong>Add Transaction</strong> (Date, Counterparty, Flow Type, Account, Category, Amount, Status, Memo).
                </div>
                <div className="sheet-card-action-row">
                  <button className="sheet-card-btn primary" onClick={openNewLedgerEntry}>
                    <i className="fa-solid fa-plus"></i> Start Ledger Entry
                  </button>
                </div>
              </div>

              {/* Blank Workbook */}
              <div className="sheet-template-card blank">
                <div className="template-icon-wrapper" style={{ background: 'rgba(0, 212, 255, 0.12)', color: '#00d4ff' }}>
                  <i className="fa-solid fa-table"></i>
                </div>
                <div className="template-title">Blank Workbook</div>
                <div className="template-desc">
                  Fresh endless worksheet with clean columns A to AZ and 100+ rows, formulas, and custom save targeting.
                </div>
                <div className="sheet-card-action-row">
                  <button className="sheet-card-btn" onClick={openBlankWorkbook}>
                    <i className="fa-solid fa-plus"></i> Blank Sheet
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Open & Edit Live Records (Filtered by Month) */}
          <div>
            <div className="sheet-section-title">
              <div className="sheet-section-title-left">
                <i className="fa-solid fa-folder-open" style={{ color: '#10b981' }}></i>
                <span>Open &amp; Edit Live Business Records</span>
              </div>
              <span className="sheet-section-badge">Month Filtered</span>
            </div>

            <div className="sheet-templates-grid">
              {/* Edit Inventory Records by Month */}
              <div className="sheet-template-card">
                <div className="template-icon-wrapper" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#10b981' }}>
                  <i className="fa-solid fa-layer-group"></i>
                </div>
                <div className="template-title">Edit Inventory Records</div>
                <div className="template-desc">
                  Select a month to load only items for that period. No duplicate or ghost records. Edit in-grid and save to update live stock.
                </div>
                <div className="sheet-card-action-row">
                  <select 
                    className="sheet-month-select" 
                    value={hubInvMonth} 
                    onChange={e => setHubInvMonth(e.target.value)}
                  >
                    {availableMonths.map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                  <button className="sheet-card-btn" onClick={() => openEditInventoryRecords(hubInvMonth)}>
                    <i className="fa-solid fa-arrow-up-right-from-square"></i> Open
                  </button>
                </div>
              </div>

              {/* Edit Ledger & Cashflow by Month */}
              <div className="sheet-template-card">
                <div className="template-icon-wrapper" style={{ background: 'rgba(99, 102, 241, 0.12)', color: '#6366f1' }}>
                  <i className="fa-solid fa-money-bill-transfer"></i>
                </div>
                <div className="template-title">Edit Ledger &amp; Cashflow</div>
                <div className="template-desc">
                  Select a month to load verified cash movements for that month. Edit transactions and reconcile balances in real time.
                </div>
                <div className="sheet-card-action-row">
                  <select 
                    className="sheet-month-select" 
                    value={hubLedgerMonth} 
                    onChange={e => setHubLedgerMonth(e.target.value)}
                  >
                    {availableMonths.map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                  <button className="sheet-card-btn" onClick={() => openEditLedgerRecords(hubLedgerMonth)}>
                    <i className="fa-solid fa-arrow-up-right-from-square"></i> Open
                  </button>
                </div>
              </div>

              {/* Business Scratchpad */}
              <div className="sheet-template-card">
                <div className="template-icon-wrapper" style={{ background: 'rgba(236, 72, 153, 0.12)', color: '#ec4899' }}>
                  <i className="fa-solid fa-calculator"></i>
                </div>
                <div className="template-title">Business Scratchpad</div>
                <div className="template-desc">
                  Flexible financial modeling worksheet with custom multiplier math, rates, and unit revenue projections.
                </div>
                <div className="sheet-card-action-row">
                  <button className="sheet-card-btn" onClick={openScratchpadWorkbook}>
                    <i className="fa-solid fa-bolt"></i> Open Scratchpad
                  </button>
                </div>
              </div>

              {/* Import CSV / Excel File */}
              <div className="sheet-template-card">
                <div className="template-icon-wrapper" style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b' }}>
                  <i className="fa-solid fa-file-import"></i>
                </div>
                <div className="template-title">Import CSV File</div>
                <div className="template-desc">
                  Tag imported rows with a specific month/period and open them into a custom worksheet.
                </div>
                <div className="sheet-card-action-row">
                  <input ref={fileInputRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleImportCSV} />
                  <select 
                    className="sheet-month-select" 
                    value={csvImportMonth} 
                    onChange={e => setCsvImportMonth(e.target.value)}
                  >
                    {availableMonths.map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                  <button className="sheet-card-btn" onClick={() => fileInputRef.current?.click()}>
                    <i className="fa-solid fa-upload"></i> Upload
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Recent Workbooks & History */}
          <div className="sheet-history-card">
            <div className="sheet-history-toolbar">
              <div className="sheet-section-title" style={{ margin: 0 }}>
                <div className="sheet-section-title-left">
                  <i className="fa-solid fa-clock-rotate-left"></i>
                  <span>Recent Workbooks &amp; History</span>
                </div>
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
                    <th>Period</th>
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
                            if (item.sheetType === 'inventory') openEditInventoryRecords(item.month || 'ALL');
                            else if (item.sheetType === 'ledger') openEditLedgerRecords(item.month || 'ALL');
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
                      <td style={{ fontSize: '0.82rem', color: 'var(--sheet-text-muted)' }}>
                        {item.month || 'All'}
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
                            if (item.sheetType === 'inventory') openEditInventoryRecords(item.month || 'ALL');
                            else if (item.sheetType === 'ledger') openEditLedgerRecords(item.month || 'ALL');
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
  // VIEW 2: WORKBOOK EDITOR VIEW (Endless Grid, Excel Pro Ribbon)
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="tab-view active" style={{ padding: 0 }} onKeyDown={handleKeyDown} tabIndex={0}>
      <div className="axis-spreadsheet-container">
        
        {/* ── 1. Top App Header / File Bar ── */}
        <div className="spreadsheet-app-header">
          <div className="spreadsheet-header-left">
            <button 
              className="sheet-back-btn" 
              onClick={requestNavigateToHub} 
              title="Return to Workbooks Hub"
            >
              <i className="fa-solid fa-arrow-left"></i> Workbooks
            </button>

            <div className="excel-badge">
              <i className="fa-solid fa-table"></i>
            </div>

            {/* Editable Workbook Title */}
            {isEditingTitle ? (
              <input
                type="text"
                className="spreadsheet-title-input"
                value={workbookTitle}
                autoFocus
                onChange={e => setWorkbookTitle(e.target.value)}
                onBlur={() => setIsEditingTitle(false)}
                onKeyDown={e => { if (e.key === 'Enter') setIsEditingTitle(false); }}
              />
            ) : (
              <div 
                className="spreadsheet-title-input" 
                onClick={() => setIsEditingTitle(true)}
                title="Click to rename workbook"
                style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
              >
                <span>{workbookTitle}</span>
                <i className="fa-solid fa-pen" style={{ fontSize: '0.7rem', opacity: 0.5 }}></i>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {/* Save Target Selector (For Blank Workbook mapping) */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--sheet-text-muted)' }}>Save as:</span>
              <select
                className="tool-select"
                value={currentTab?.saveTarget || 'workbook'}
                onChange={e => {
                  const target = e.target.value as 'workbook' | 'inventory' | 'ledger';
                  setOpenTabs(prev => prev.map(t => t.id === currentTab.id ? { ...t, saveTarget: target } : t));
                }}
                title="Select where to sync this worksheet"
              >
                <option value="workbook">Workbook Only (Axis Sheets)</option>
                <option value="inventory">Inventory Catalog</option>
                <option value="ledger">Ledger Transactions</option>
              </select>
            </div>

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

            <button className="tool-btn" onClick={handleExportWorkbook} title="Export CSV">
              <i className="fa-solid fa-file-excel"></i> Export
            </button>
          </div>
        </div>

        {/* ── 2. Pro Spreadsheet Feature Ribbon / Toolbar ── */}
        <div className="spreadsheet-pro-toolbar">
          {/* Explicit Save Button with Dirty Animation */}
          <div className="tool-group">
            <button 
              className={`tool-btn save-btn ${isCurrentTabDirty ? 'dirty' : ''}`}
              onClick={handleSaveWorkbook}
              title="Save changes to database / workbook (Ctrl+S)"
            >
              <i className="fa-solid fa-floppy-disk"></i>
              <span>{isCurrentTabDirty ? 'Save *' : 'Save'}</span>
            </button>
          </div>

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

          {/* Formats: Currency, Percent */}
          <div className="tool-group">
            <button 
              className="tool-btn" 
              onClick={() => {
                if (selectedCell) {
                  const r = activeRows[selectedCell.rowIdx];
                  const val = r ? r[selectedCell.colKey] : 0;
                  const num = parseFloat(val) || 0;
                  updateCellValue(selectedCell.rowIdx, selectedCell.colKey, num.toFixed(2));
                }
              }} 
              title="Format as Currency ($)"
            >
              <i className="fa-solid fa-dollar-sign"></i>
            </button>
            <button 
              className="tool-btn" 
              onClick={() => {
                if (selectedCell) {
                  const r = activeRows[selectedCell.rowIdx];
                  const val = r ? r[selectedCell.colKey] : 0;
                  updateCellValue(selectedCell.rowIdx, selectedCell.colKey, `${val}%`);
                }
              }} 
              title="Format as Percentage (%)"
            >
              <i className="fa-solid fa-percent"></i>
            </button>
          </div>

          {/* Row Placement Dropdown */}
          <div className="tool-group">
            <div className="tool-dropdown">
              <button 
                className="tool-btn primary" 
                onClick={(e) => { e.stopPropagation(); setOpenInsertRowMenu(!openInsertRowMenu); }}
                title="Add Row Placement Options"
              >
                <i className="fa-solid fa-plus"></i> Row <i className="fa-solid fa-chevron-down" style={{ fontSize: '0.65rem', marginLeft: '4px' }}></i>
              </button>
              {openInsertRowMenu && (
                <div className="tool-dropdown-menu" onClick={e => e.stopPropagation()}>
                  <div className="tool-dropdown-item" onClick={() => handleInsertRowAt('above')}>
                    <i className="fa-solid fa-arrow-up"></i> Insert Row Above Active Cell
                  </div>
                  <div className="tool-dropdown-item" onClick={() => handleInsertRowAt('below')}>
                    <i className="fa-solid fa-arrow-down"></i> Insert Row Below Active Cell
                  </div>
                  <div className="tool-dropdown-item" onClick={() => handleInsertRowAt('top')}>
                    <i className="fa-solid fa-angles-up"></i> Insert Row at Top (First Row)
                  </div>
                  <div className="tool-dropdown-item" onClick={() => handleInsertRowAt('bottom')}>
                    <i className="fa-solid fa-angles-down"></i> Insert Row at Bottom (End)
                  </div>
                </div>
              )}
            </div>

            <button className="tool-btn danger" onClick={handleDeleteActiveRow} title="Delete Selected Row">
              <i className="fa-solid fa-trash-can"></i> Row
            </button>

            {/* Column Placement Dropdown */}
            <div className="tool-dropdown">
              <button 
                className="tool-btn" 
                onClick={(e) => { e.stopPropagation(); setOpenInsertColMenu(!openInsertColMenu); }}
                title="Add Column Placement Options"
              >
                <i className="fa-solid fa-plus"></i> Col <i className="fa-solid fa-chevron-down" style={{ fontSize: '0.65rem', marginLeft: '4px' }}></i>
              </button>
              {openInsertColMenu && (
                <div className="tool-dropdown-menu" onClick={e => e.stopPropagation()}>
                  <div className="tool-dropdown-item" onClick={() => handleInsertColumnAt('left')}>
                    <i className="fa-solid fa-arrow-left"></i> Insert Column Left of Active Cell
                  </div>
                  <div className="tool-dropdown-item" onClick={() => handleInsertColumnAt('right')}>
                    <i className="fa-solid fa-arrow-right"></i> Insert Column Right of Active Cell
                  </div>
                  <div className="tool-dropdown-item" onClick={() => handleInsertColumnAt('end')}>
                    <i className="fa-solid fa-angles-right"></i> Insert Column at End
                  </div>
                </div>
              )}
            </div>
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
              onClick={clearSelectedCells} 
              title="Clear Selected Cells (Delete / Backspace)"
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
              placeholder="Type value or formula (e.g. =SUM(F1:F20), =C2*D2)..."
            />
          </div>
        </div>

        {/* ── 4. The Endless 2D Grid Table Viewport ── */}
        <div className="spreadsheet-grid-viewport" ref={gridContainerRef}>
          <table className="spreadsheet-grid-table">
            <thead>
              {/* Row 0: Pure Excel Column Letters (A, B, C... end-to-end) */}
              <tr>
                <th className="grid-corner-cell"></th>
                {activeColumns.map(col => {
                  const isSelectedCol = selectedCell?.colKey === col.key;
                  return (
                    <th 
                      key={col.key} 
                      className={`grid-col-header ${isSelectedCol ? 'selected-col' : ''}`}
                      style={{ width: col.width ? `${col.width}px` : undefined }}
                    >
                      {col.letter}
                    </th>
                  );
                })}
              </tr>

              {/* Row 1: Dedicated Field Header Row for Structured Tables (Inventory / Ledger) */}
              {currentTab?.isStructuredTable && (
                <tr className="grid-field-header-row">
                  <th className="grid-row-header" style={{ fontWeight: 700, fontSize: '0.72rem' }}>
                    #
                  </th>
                  {activeColumns.map(col => (
                    <th key={col.key} className="grid-field-header-cell">
                      <i className="fa-solid fa-tag"></i>
                      <span>{col.label}</span>
                    </th>
                  ))}
                </tr>
              )}
            </thead>
            <tbody>
              {activeRows.map((row, rowIdx) => {
                const isSelectedRow = selectedCell?.rowIdx === rowIdx;
                const minR = selectionRange ? Math.min(selectionRange.startRow, selectionRange.endRow) : rowIdx;
                const maxR = selectionRange ? Math.max(selectionRange.startRow, selectionRange.endRow) : rowIdx;
                const minC = selectionRange ? Math.min(selectionRange.startColIdx, selectionRange.endColIdx) : -1;
                const maxC = selectionRange ? Math.max(selectionRange.startColIdx, selectionRange.endColIdx) : -1;

                return (
                  <tr key={row._id || row.id || row.sku || `row-${rowIdx}`}>
                    {/* Sticky Row Number (1, 2, 3... end-to-end) */}
                    <td 
                      className={`grid-row-header ${isSelectedRow ? 'selected-row' : ''}`}
                      onClick={() => handleSelectCell(rowIdx, activeColumns[0]?.key || 'col_A')}
                    >
                      {rowIdx + 1}
                    </td>

                    {/* Columns A, B, C... */}
                    {activeColumns.map((col, colIdx) => {
                      const isCellActive = selectedCell?.rowIdx === rowIdx && selectedCell?.colKey === col.key;
                      const cellVal = row[col.key];
                      const isCellEditingNow = isCellActive && isEditing;

                      const isInRange = selectionRange && rowIdx >= minR && rowIdx <= maxR && colIdx >= minC && colIdx <= maxC;
                      const isRangeTop = isInRange && rowIdx === minR;
                      const isRangeBottom = isInRange && rowIdx === maxR;
                      const isRangeLeft = isInRange && colIdx === minC;
                      const isRangeRight = isInRange && colIdx === maxC;

                      const cellStyleKey = `${currentTab?.id}_${rowIdx}_${col.key}`;
                      const st = cellStyles[cellStyleKey] || {};

                      let classes = 'grid-cell';
                      if (isCellActive) classes += ' active-cell';
                      if (isInRange) classes += ' in-range';
                      if (isRangeTop) classes += ' range-top';
                      if (isRangeBottom) classes += ' range-bottom';
                      if (isRangeLeft) classes += ' range-left';
                      if (isRangeRight) classes += ' range-right';

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
                          onMouseDown={() => handleCellMouseDown(rowIdx, col.key)}
                          onMouseEnter={() => handleCellMouseEnter(rowIdx, col.key)}
                          onDoubleClick={() => handleDoubleClickCell(rowIdx, col.key)}
                          onContextMenu={(e) => handleContextMenu(e, rowIdx, col.key)}
                        >
                          {isCellEditingNow ? (
                            col.type === 'select' && col.options ? (
                              <select
                                className="cell-inline-select"
                                value={editValue}
                                autoFocus
                                onChange={e => {
                                  setEditValue(e.target.value);
                                  updateCellValue(rowIdx, col.key, e.target.value);
                                  setIsEditing(false);
                                }}
                                onBlur={commitEdit}
                              >
                                <option value="">-- Select --</option>
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
                            col.type === 'select' && (col.key === 'type' || col.key === 'status') && cellVal ? (
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

        {/* ── 5. Right-Click Context Menu ── */}
        {contextMenu && (
          <div 
            className="sheet-context-menu" 
            style={{ top: contextMenu.y, left: contextMenu.x }}
            onClick={e => e.stopPropagation()}
          >
            <div className="sheet-context-item" onClick={() => {
              if (selectedCell) {
                const val = activeRows[selectedCell.rowIdx]?.[selectedCell.colKey] ?? '';
                navigator.clipboard.writeText(String(val));
              }
              setContextMenu(null);
            }}>
              <span><i className="fa-solid fa-copy" style={{ marginRight: '8px' }}></i> Copy</span>
              <span style={{ opacity: 0.6, fontSize: '0.72rem' }}>Ctrl+C</span>
            </div>

            <div className="sheet-context-item" onClick={async () => {
              try {
                const text = await navigator.clipboard.readText();
                if (selectedCell && text) {
                  updateCellValue(selectedCell.rowIdx, selectedCell.colKey, text);
                }
              } catch {}
              setContextMenu(null);
            }}>
              <span><i className="fa-solid fa-paste" style={{ marginRight: '8px' }}></i> Paste</span>
              <span style={{ opacity: 0.6, fontSize: '0.72rem' }}>Ctrl+V</span>
            </div>

            <div className="sheet-context-divider"></div>

            <div className="sheet-context-item" onClick={() => { handleInsertRowAt('above'); setContextMenu(null); }}>
              <span><i className="fa-solid fa-arrow-up" style={{ marginRight: '8px' }}></i> Insert Row Above</span>
            </div>
            <div className="sheet-context-item" onClick={() => { handleInsertRowAt('below'); setContextMenu(null); }}>
              <span><i className="fa-solid fa-arrow-down" style={{ marginRight: '8px' }}></i> Insert Row Below</span>
            </div>
            <div className="sheet-context-item" onClick={() => { handleInsertColumnAt('left'); setContextMenu(null); }}>
              <span><i className="fa-solid fa-arrow-left" style={{ marginRight: '8px' }}></i> Insert Column Left</span>
            </div>
            <div className="sheet-context-item" onClick={() => { handleInsertColumnAt('right'); setContextMenu(null); }}>
              <span><i className="fa-solid fa-arrow-right" style={{ marginRight: '8px' }}></i> Insert Column Right</span>
            </div>

            <div className="sheet-context-divider"></div>

            <div className="sheet-context-item danger" onClick={() => { handleDeleteActiveRow(); setContextMenu(null); }}>
              <span><i className="fa-solid fa-trash" style={{ marginRight: '8px' }}></i> Delete Row</span>
            </div>
            <div className="sheet-context-item" onClick={() => { clearSelectedCells(); setContextMenu(null); }}>
              <span><i className="fa-solid fa-eraser" style={{ marginRight: '8px' }}></i> Clear Cell</span>
              <span style={{ opacity: 0.6, fontSize: '0.72rem' }}>Del</span>
            </div>
          </div>
        )}

        {/* ── 6. Bottom Worksheet Tabs & Status Bar ── */}
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
                  setSelectionRange(null);
                }}
                onDoubleClick={(e) => startRenameTab(e, tab.id, tab.title)}
              >
                <i className={`fa-solid ${tab.icon}`}></i>

                {/* Inline Tab Renaming */}
                {renamingTabId === tab.id ? (
                  <input
                    type="text"
                    className="sheet-tab-rename-input"
                    value={tabRenameValue}
                    autoFocus
                    onChange={e => setTabRenameValue(e.target.value)}
                    onBlur={commitTabRename}
                    onKeyDown={e => {
                      if (e.key === 'Enter') commitTabRename();
                      if (e.key === 'Escape') setRenamingTabId(null);
                    }}
                    onClick={e => e.stopPropagation()}
                  />
                ) : (
                  <span>
                    {tab.title}
                    {dirtyTabs[tab.id] && <span style={{ color: '#f59e0b', marginLeft: '3px' }}>*</span>}
                  </span>
                )}

                {/* Close Tab (×) closes worksheet from view WITHOUT deleting data */}
                <span 
                  className="sheet-tab-close" 
                  onClick={e => requestCloseTab(e, tab.id)}
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

      {/* ── 7. Unsaved Changes Confirmation Modal ── */}
      {unsavedModal.isOpen && (
        <div className="unsaved-modal-overlay">
          <div className="unsaved-modal-card">
            <div className="unsaved-modal-title">
              <i className="fa-solid fa-triangle-exclamation"></i>
              <span>Unsaved Changes</span>
            </div>
            <div className="unsaved-modal-text">
              You have unsaved edits in this worksheet. Would you like to save your changes before leaving?
            </div>
            <div className="unsaved-modal-actions">
              <button 
                className="sheet-card-btn"
                onClick={() => setUnsavedModal({ isOpen: false })}
              >
                Cancel
              </button>
              <button 
                className="sheet-card-btn"
                style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                onClick={() => {
                  if (unsavedModal.tabIdToClose) executeCloseTab(unsavedModal.tabIdToClose);
                  if (unsavedModal.navigateToHub) setViewMode('hub');
                  setUnsavedModal({ isOpen: false });
                }}
              >
                Discard Changes
              </button>
              <button 
                className="sheet-card-btn primary"
                onClick={async () => {
                  await handleSaveWorkbook();
                  if (unsavedModal.tabIdToClose) executeCloseTab(unsavedModal.tabIdToClose);
                  if (unsavedModal.navigateToHub) setViewMode('hub');
                  setUnsavedModal({ isOpen: false });
                }}
              >
                <i className="fa-solid fa-floppy-disk"></i> Save &amp; Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
