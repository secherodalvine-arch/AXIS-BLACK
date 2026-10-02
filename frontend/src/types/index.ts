export type NavTab = 
  | 'dashboard'
  | 'spreadsheet'
  | 'inventory'
  | 'analytics'
  | 'transactions'
  | 'agent'
  | 'forecast'
  | 'business'
  | 'activities'
  | 'billing'
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

export interface CustomSpreadsheet {
  id: string;
  title: string;
  description?: string;
  columns: { key: string; label: string; width?: number; type?: 'text' | 'number' | 'currency' | 'date' }[];
  rows: Record<string, any>[];
  updated_at?: string;
}

export type PlanKey = 'free' | 'starter' | 'pro';

export interface SubscriptionPlan {
  key: PlanKey;
  name: string;
  amount_kes: number;
  duration_days: number;
  billing_period: string;
  description: string;
  features: string[];
  branches_limit: number;
  inventory_limit: number;
  runway_simulator: boolean;
  business_summary: boolean;
  voice_agent: boolean;
  spreadsheet: boolean;
  team_roles: boolean;
  axis_agent_daily_limit: number;
  axis_agent_monthly_limit: number;
  voice_agent_daily_limit: number;
  voice_agent_monthly_limit: number;
  can_extend_agent: boolean;
  can_extend_voice: boolean;
  priority_support: boolean;
}

export interface UserSubscription {
  plan: PlanKey;
  plan_key?: PlanKey;
  name: string;
  plan_name?: string;
  is_active: boolean;
  is_paid: boolean;
  expires_at: string | null;
  days_left: number;
  receipt_number?: string;
  payment_mode?: string;
  payment_id?: string;
  amount_kes: number;
  billing_period: string;
  entitlements: {
    runway_simulator: boolean;
    business_summary: boolean;
    voice_agent: boolean;
    spreadsheet: boolean;
    team_roles: boolean;
    priority_support: boolean;
    branches_limit: number;
    inventory_limit: number;
  };
  resources: {
    branches_count: number;
    branches_limit: number;
    can_add_branch: boolean;
    inventory_count: number;
    inventory_limit: number;
    can_add_inventory: boolean;
  };
  usage: {
    axis_agent_chat: {
      used_today: number;
      daily_limit: number;
      base_daily_limit: number;
      used_month: number;
      monthly_limit: number;
      daily_limit_reached: boolean;
      can_extend: boolean;
      is_extended: boolean;
    };
    voice_agent: {
      used_today: number;
      daily_limit: number;
      base_daily_limit: number;
      used_month: number;
      monthly_limit: number;
      daily_limit_reached: boolean;
      can_extend: boolean;
      is_extended: boolean;
    };
  };
}

export interface PaymentRecord {
  _id: string;
  user_id: string;
  user_name?: string;
  user_email?: string;
  plan: PlanKey;
  amount_kes: number;
  fee_kes?: number;
  net_kes?: number;
  receipt_number?: string;
  payment_mode?: string;
  paid_at?: string;
  currency: string;
  channel?: string;
  status: 'pending' | 'paid' | 'failed' | 'rejected' | 'cancelled';
  provider: string;
  reference?: string;
  description?: string;
  expires_at?: string;
  created_at: string;
}



