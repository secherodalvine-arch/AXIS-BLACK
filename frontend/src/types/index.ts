export type NavTab = 
  | 'dashboard'
  | 'inventory'
  | 'analytics'
  | 'transactions'
  | 'agent'
  | 'forecast'
  | 'settings';

export type Currency = 'USD' | 'KES';

export type Timeframe = '24h' | '7d' | '30d' | '1y';

export interface MetricData {
  id: string;
  title: string;
  value: string;
  numericValue?: number;
  change: string;
  isPositive: boolean;
  targetOrMeta: string;
  glowColor: 'lilac' | 'cyan' | 'pink' | 'purple';
  icon: string;
  progressPercent?: number;
}

export interface Transaction {
  id: string;
  counterparty: string;
  type: 'Expense' | 'Revenue';
  category: string;
  accountType?: 'Cash' | 'Bank' | 'Accounts Receivable' | 'Accounts Payable' | 'Revenue' | 'Expense';
  date: string;
  status: 'Cleared' | 'Pending' | 'Processing';
  amount: number;
  notes?: string;
}

export interface AIStreamItem {
  id: string;
  time: string;
  title: string;
  content: string;
  tags?: { text: string; type: 'cyan' | 'lilac' }[];
  actionLabel?: string;
  actionType?: string;
  isHighlight?: boolean;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  suggestions?: string[];
}
