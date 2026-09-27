export type NavTab = 
  | 'dashboard'
  | 'inventory'
  | 'analytics'
  | 'transactions'
  | 'agent'
  | 'forecast'
  | 'business'
  | 'activities'
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
  branch_id?: string;
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

// ── Business & Branches ───────────────────────────────────────────────────────

export interface Branch {
  id: string;
  name: string;
  location?: string;
  manager_user_id?: string;
  phone?: string;
  email?: string;
  is_active: boolean;
  is_main?: boolean;
  created_at?: string;
}

export interface BusinessRole {
  id: string;
  role_name: string;
  permissions: string[];
  description?: string;
  branch_id?: string;
}

export interface SubUser {
  id: string;
  name: string;
  email: string;
  role_id: string;
  branch_id?: string;
  is_active: boolean;
  must_change_password?: boolean;
  created_at?: string;
}

export interface BusinessProfile {
  owner_id?: string;
  business_name: string;
  business_category: string;
  industry: string;
  number_of_employees: number;
  description: string;
  location: string;
  phone: string;
  email: string;
  website: string;
  founded_year?: number;
  logo_url: string;
  branches: Branch[];
  roles: BusinessRole[];
  sub_users: SubUser[];
}

export interface BranchPerformance {
  branch_id: string;
  total_revenue: number;
  total_expenses: number;
  net_cash: number;
  gross_margin_percent: number;
  transaction_count: number;
}

export interface ActivityLog {
  id: string;
  owner_id: string;
  actor_id: string;
  actor_name: string;
  actor_role: string;
  action: string;
  title: string;
  details: string;
  branch_id?: string;
  branch_name?: string;
  timestamp: string;
}

