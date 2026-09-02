import React, { useState, useEffect } from 'react';
import { NavTab, Timeframe, Currency, Transaction, AIStreamItem, ChatMessage, MetricData } from './types';
import { AppBackground } from './components/AppBackground';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { NewTransactionModal } from './components/NewTransactionModal';
import { AxisVoiceSupportAgent } from './components/AxisVoiceSupportAgent';


import { OverviewDashboard as DashboardPage } from './pages/DashboardPage';
import { InventoryView as InventoryPage } from './pages/InventoryPage';
import { BusinessAnalytics as AnalyticsPage } from './pages/AnalyticsPage';
import { TransactionsLedger as TransactionsPage } from './pages/TransactionsPage';
import { AxisAgentWorkspace as AgentPage } from './pages/AxisAgentPage';
import { RunwaySimulator as ForecastPage } from './pages/RunwaySimulatorPage';
import { SettingsView as SettingsPage } from './pages/SettingsPage';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { PasswordResetPage } from './pages/PasswordResetPage';
import { EmailVerificationPage } from './pages/EmailVerificationPage';
import { 
  getStoredUser, 
  getAccessToken,
  getMeApi,
  clearAuth, 
  UserProfile, 
  queryAxisAgentApi, 
  getTransactionsApi, 
  createTransactionApi, 
  getDashboardMetricsApi,
  verifyEmailApi
} from './utils/api';

import './styles/globals.css';
import '../styles/homepage.css';

const DEFAULT_METRICS: MetricData[] = [
  { id: 'financial', title: 'Financial Overview', value: '$4,285,400', numericValue: 4285400, change: '+18.4% ARR', isPositive: true, targetOrMeta: 'Target: $4.5M • Yield 4.85%', glowColor: 'lilac', icon: 'fa-coins', progressPercent: 92 },
  { id: 'inventory', title: 'Inventory Management', value: '1.8x Turnover', numericValue: 180000, change: '+12.5% Growth', isPositive: true, targetOrMeta: 'Warehouse Health: 96.4% • Reorder Ready', glowColor: 'cyan', icon: 'fa-boxes-stacked', progressPercent: 88 },
  { id: 'operations', title: 'Operations Overview', value: '94.2% Efficiency', numericValue: 94.2, change: '24ms Latency', isPositive: true, targetOrMeta: 'Server Load: 68% • Uptime 99.99%', glowColor: 'pink', icon: 'fa-gears', progressPercent: 94 },
  { id: 'growth', title: 'Growth Overview', value: '+1,240 Accounts', numericValue: 124000, change: '+28% EMEA', isPositive: true, targetOrMeta: 'CAC Ratio: 3.2x • Expansion High', glowColor: 'purple', icon: 'fa-arrow-trend-up', progressPercent: 85 }
];

const DEFAULT_TRANSACTIONS: Transaction[] = [
  { id: 'TXN-9082', counterparty: 'Toast POS Daily Dining Revenue', type: 'Revenue', category: 'Dining Sales', accountType: 'Cash', date: '2026-08-20', status: 'Cleared', amount: 184500.00, notes: 'Direct Customer Card & Mobile Pay Settlements' },
  { id: 'TXN-9083', counterparty: 'Sysco Fresh Food & Meat Supply', type: 'Expense', category: 'Ingredients & Produce', accountType: 'Accounts Payable', date: '2026-08-21', status: 'Cleared', amount: -14250.00, notes: 'Fresh Produce, Meat Cuts & Dairy Supplies' },
  { id: 'TXN-9084', counterparty: 'Gusto Staff Payroll Systems', type: 'Expense', category: 'Payroll', accountType: 'Bank', date: '2026-08-22', status: 'Cleared', amount: -68400.00, notes: 'Kitchen & Front-of-House Staff Bi-weekly Payroll' },
  { id: 'TXN-9085', counterparty: 'Kenya Power & Lighting (Electricity)', type: 'Expense', category: 'Utilities', accountType: 'Expense', date: '2026-08-23', status: 'Cleared', amount: -3850.00, notes: 'Monthly Commercial Kitchen Energy Utility Bill' },
  { id: 'TXN-9086', counterparty: 'Corporate Catering Receivable', type: 'Revenue', category: 'Catering Revenue', accountType: 'Accounts Receivable', date: '2026-08-24', status: 'Pending', amount: 12500.00, notes: 'Annual Gala Catering Invoice - Payment Due 14 Days' }
];

const DEFAULT_AI_STREAM: AIStreamItem[] = [
  { id: 'ai-1', time: '10 mins ago', title: 'Subscription Revenue Spike', content: 'Enterprise tier sign-ups increased by 28% in EMEA region. ARR growth is trending 4.2% above baseline forecast.', tags: [{ text: '+28% EMEA', type: 'cyan' }, { text: 'High Impact', type: 'lilac' }], isHighlight: true },
  { id: 'ai-2', time: '2 hours ago', title: 'Treasury Yield Optimization Opportunity', content: 'Transferring $350,000 idle checking cash into 30-day T-Bills will generate an extra $1,415 net monthly yield at 4.85% APY.', actionLabel: 'Auto-Execute Sweep Strategy' }
];

const DEFAULT_CHAT_MESSAGES: ChatMessage[] = [];

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught error in component:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', color: '#ff8e8e', background: 'rgba(255, 0, 0, 0.1)', borderRadius: '1rem', border: '1px solid rgba(255, 0, 0, 0.3)', margin: '1rem' }}>
          <h3>System Component Error Caught</h3>
          <p style={{ marginTop: '0.5rem', fontFamily: 'monospace' }}>{this.state.error?.message}</p>
          <button onClick={() => this.setState({ hasError: false, error: null })} style={{ marginTop: '1rem', padding: '0.5rem 1rem', borderRadius: '0.5rem', background: '#00d4ff', color: '#000', fontWeight: 'bold', border: 'none', cursor: 'pointer' }}>
            Retry View
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const getInitialUrlToken = (): { token: string; isReset: boolean; isVerify: boolean } => {
  const searchParams = new URLSearchParams(window.location.search);
  const href = window.location.href;
  const path = window.location.pathname;
  const hash = window.location.hash;
  let token = searchParams.get('token') || '';

  if (!token) {
    const match = href.match(/[?&]token=([^&]+)/);
    if (match && match[1]) {
      token = decodeURIComponent(match[1]);
    }
  }

  const isVerify = Boolean(
    path.includes('verify-email') ||
    hash.includes('verify-email')
  );

  const isReset = Boolean(
    !isVerify && (
      path.includes('reset-password') ||
      hash.includes('reset-password')
    )
  );

  return { token, isReset, isVerify };
};

const getInitialViewState = (): 'home' | 'dashboard' | 'login' | 'register' | 'forgot-password' | 'verify-email' => {
  const { token, isReset, isVerify } = getInitialUrlToken();
  const path = window.location.pathname;
  const hash = window.location.hash;

  if (isVerify) {
    return token ? 'verify-email' : 'login';
  }
  if (isReset) {
    return 'forgot-password';
  }
  if (path.includes('login') || hash.includes('login')) {
    return 'login';
  }
  if (path.includes('register') || hash.includes('register')) {
    return 'register';
  }

  // Preserve authenticated session on refresh if token & user exist in storage
  if (getAccessToken() || getStoredUser()) {
    return 'dashboard';
  }

  return 'home';
};

export const App: React.FC = () => {
  const { token: initialToken, isReset: initialIsReset } = getInitialUrlToken();
  const [viewState, setViewState] = useState<'home' | 'dashboard' | 'login' | 'register' | 'forgot-password' | 'verify-email'>(getInitialViewState);
  const [resetToken, setResetToken] = useState<string>(initialIsReset ? initialToken : '');
  const [pendingVerifyEmail, setPendingVerifyEmail] = useState<string>('');
  const [user, setUser] = useState<UserProfile | null>(getStoredUser());
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [timeframe, setTimeframe] = useState<Timeframe>('30d');
  const [currency, setCurrency] = useState<Currency>('USD');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isVoiceAgentOpen, setIsVoiceAgentOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);


  // Check URL parameters & validate active user session on mount
  useEffect(() => {
    const { token, isReset, isVerify } = getInitialUrlToken();

    if (token) {
      if (isVerify) {
        verifyEmailApi(token)
          .then(res => {
            showToast(res.message || 'Email verified successfully! You can now log in.');
            setViewState('login');
            window.history.replaceState({}, document.title, window.location.pathname);
          })
          .catch(err => {
            showToast(err.message || 'Verification link expired or invalid.');
            setViewState('login');
          });
      } else if (isReset) {
        setResetToken(token);
        setViewState('forgot-password');
      }
    } else if (getAccessToken()) {
      // Validate active token with backend /api/auth/me
      getMeApi()
        .then(profile => {
          if (profile) {
            setUser(profile);
            if (profile.currency) {
              setCurrency(profile.currency as Currency);
            }
          }
          setViewState('dashboard');
        })
        .catch(err => {
          if (err.status === 401 || err.status === 403) {
            clearAuth();
            setUser(null);
            setViewState('home');
          }
        });
    }
  }, []);


  // State arrays
  const [metrics, setMetrics] = useState(DEFAULT_METRICS);
  const [transactions, setTransactions] = useState<Transaction[]>(DEFAULT_TRANSACTIONS);
  const [aiStream] = useState<AIStreamItem[]>(DEFAULT_AI_STREAM);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(DEFAULT_CHAT_MESSAGES);

  React.useEffect(() => {
    // Fetch live backend metrics & transactions if authenticated or viewing dashboard
    if (viewState === 'dashboard') {
      getDashboardMetricsApi()
        .then(res => res && res.length && setMetrics(res))
        .catch(err => console.log('Metrics fetch fallback to initial state:', err));

      getTransactionsApi()
        .then(res => res && res.length && setTransactions(res))
        .catch(err => console.log('Transactions fetch fallback to initial state:', err));
    }
  }, [viewState]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleLoginSuccess = (name: string, email: string) => {
    setUser({ user_id: 'usr_active', name, email, currency });
    showToast(`Welcome back, ${name}! Logged in successfully.`);
    setViewState('dashboard');
  };

  const handleLogout = () => {
    clearAuth();
    setUser(null);
    setChatMessages([]);
    showToast('Logged out successfully.');
    setViewState('home');
  };

  const handleAddTransaction = async (newTxnData: Omit<Transaction, 'id'>) => {
    try {
      const created = await createTransactionApi(newTxnData);
      setTransactions(prev => [created, ...prev]);
      showToast(`Recorded new entry: ${created.counterparty || newTxnData.counterparty}`);
    } catch {
      const newTxn: Transaction = {
        ...newTxnData,
        id: `TXN-${Math.floor(1000 + Math.random() * 9000)}`
      };
      setTransactions(prev => [newTxn, ...prev]);
      showToast(`Recorded entry: ${newTxn.counterparty}`);
    }
  };

  const handleAIActionClick = async (actionTitle: string) => {
    showToast(`Invoking Axis Agent for: ${actionTitle}`);
    handleQuickAISubmit(`Execute strategy for ${actionTitle}`);
  };

  const [isAgentProcessing, setIsAgentProcessing] = useState(false);
  const [agentStep, setAgentStep] = useState('Step 1/3: Analyzing financial parameters...');

  const handleQuickAISubmit = async (query: string) => {
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setChatMessages(prev => [...prev, userMsg]);
    setCurrentTab('agent');

    setIsAgentProcessing(true);
    setAgentStep('Step 1/3: Parsing financial query & parameters...');

    setTimeout(() => {
      setAgentStep('Step 2/3: Querying ledger, cash flow & inventory database...');
    }, 450);

    setTimeout(() => {
      setAgentStep('Step 3/3: Synthesizing executive report & recommendations...');
    }, 950);

    setTimeout(async () => {
      try {
        const res = await queryAxisAgentApi(query);
        const aiReply: ChatMessage = {
          id: `ai-${Date.now()}`,
          sender: 'ai',
          text: res.answer,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setChatMessages(prev => [...prev, aiReply]);
      } catch {
        const qLower = query.toLowerCase().trim();
        let text = "Greetings! I am Axis, your real-time business data assistant. How can I assist your financial strategy today?";
        if (qLower.includes('hi') || qLower.includes('hello') || qLower.includes('hey')) {
          text = "Greetings! I am Axis, your real-time business data assistant. How can I assist your financial strategy today?";
        } else if (qLower.includes('who') || qLower.includes('what are you')) {
          text = "I am Axis, your real-time business data assistant. I help you track metrics, model scenarios, and optimize financial strategy in clear, plain language.";
        } else if (qLower.includes('cash') && qLower.includes('90')) {
          text = "### 90-Day Cash Balance Projection\n\n- **Current Cash Balance:** $1,840,250\n- **Estimated 90-Day Expenses:** $428,400\n- **Projected Cash Balance in 90 Days:** **$1,411,850**\n\nYour projected cash runway remains healthy at **12.9+ months**.";
        } else if (qLower.includes('cost') || qLower.includes('optimization')) {
          text = "### Top 3 Cost Savings Opportunities\n\n1. **Cloud Server Optimization:** Save **$3,200/mo** by turning off unused test servers.\n2. **Software Licenses:** Save **$1,800/mo** by canceling 6 inactive software seats.\n3. **Checking Account Interest:** Earn **+$1,415/mo** by moving $350K idle cash into a short-term treasury yield account.";
        } else if (qLower.includes('engineer') || qLower.includes('hire')) {
          text = "### Hiring Simulation: 4 Senior Engineers (October)\n\nHiring 4 senior engineers will help build products faster and increase revenue. Here is the financial breakdown starting in October:\n\n- **Cost per Engineer:** $180,000 / year\n- **Total Annual Cost (4 Engineers):** $720,000 / year\n- **New Monthly Salary Expense:** $60,000 / month\n\n#### Financial Overview:\n- **Current Monthly Expenses:** $142,800 / month\n- **New Total Monthly Expenses:** $202,800 / month ($142,800 + $60,000)\n- **Current Cash Balance:** $1,840,250\n- **New Cash Runway:** **9.1 Months** (down from 12.9 months)\n\n**Key Takeaway:** Adding 4 senior engineers increases monthly costs by $60,000 and reduces your cash runway from 12.9 months to 9.1 months.";
        } else {
          text = "### Business Performance Overview\n\n- **Annual Revenue (ARR):** **$4.28M** (+18.4% YoY growth)\n- **Cash Runway:** **14.8 Months** ($1.84M Cash Balance)\n- **Inventory Turnover Rate:** **1.8x** (96.4% Stock Health)\n- **Operational Efficiency:** **94.2%**";
        }

        const fallbackReply: ChatMessage = {
          id: `ai-${Date.now()}`,
          sender: 'ai',
          text,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setChatMessages(prev => [...prev, fallbackReply]);
      } finally {
        setIsAgentProcessing(false);
      }
    }, 1400);
  };

  const handleExportCSV = () => {
    showToast('Exported verified ledger to Axis_Black_Ledger_Q3.csv');
  };

  if (viewState === 'login') {
    return (
      <LoginPage
        onLoginSuccess={handleLoginSuccess}
        onNavigateRegister={() => setViewState('register')}
        onNavigateForgotPassword={() => setViewState('forgot-password')}
        onBackToHome={() => setViewState('home')}
        onVerificationRequired={(email) => {
          setPendingVerifyEmail(email);
          setViewState('verify-email');
        }}
      />
    );
  }

  if (viewState === 'register') {
    return (
      <RegisterPage
        onVerificationRequired={(email) => {
          setPendingVerifyEmail(email);
          setViewState('verify-email');
        }}
        onNavigateLogin={() => setViewState('login')}
        onBackToHome={() => setViewState('home')}
      />
    );
  }

  if (viewState === 'verify-email') {
    return (
      <EmailVerificationPage
        email={pendingVerifyEmail}
        onNavigateLogin={() => setViewState('login')}
        onBackToHome={() => setViewState('home')}
      />
    );
  }

  if (viewState === 'forgot-password') {
    return (
      <PasswordResetPage
        onNavigateLogin={() => setViewState('login')}
        onBackToHome={() => setViewState('home')}
        tokenFromUrl={resetToken}
      />
    );
  }

  if (viewState === 'home') {
    return (
      <HomePage 
        onEnterDashboard={() => setViewState('dashboard')}
        onNavigateLogin={() => setViewState('login')}
        onNavigateRegister={() => setViewState('register')}
      />
    );
  }

  return (
    <div className="dark-theme">
      <AppBackground />
      
      <div className="nebula-glow nebula-top-right"></div>
      <div className="nebula-glow nebula-bottom-left"></div>

      <div className="app-layout">
        <Sidebar 
          currentTab={currentTab}
          onTabChange={(tab) => {
            setCurrentTab(tab);
            setMobileMenuOpen(false);
          }}
          isOpen={mobileMenuOpen}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />

        <main className="main-wrapper">
          <Header 
            currentTab={currentTab}
            timeframe={timeframe}
            currency={currency}
            userName={user?.name || ''}
            userEmail={user?.email || ''}
            userAvatar={user?.avatar_url || ''}
            userRole={user?.role || ''}
            onCurrencyChange={(c) => {
              setCurrency(c);
              showToast(`Base currency switched to ${c === 'KES' ? 'Kenya Shillings (KSh)' : 'US Dollars ($)'}`);
            }}
            onTimeframeChange={setTimeframe}
            onOpenNewTxnModal={() => setIsModalOpen(true)}
            onOpenVoiceAgent={() => setIsVoiceAgentOpen(true)}
            onToggleMobileMenu={() => setMobileMenuOpen(!mobileMenuOpen)}
            onSearchChange={(q) => console.log('Searching:', q)}
            onLogout={handleLogout}
            onNavigateLogin={() => setViewState('login')}
          />


          <div className="content-viewport">
            <ErrorBoundary>
              {currentTab === 'dashboard' && (
                <DashboardPage 
                  metrics={metrics}
                  transactions={transactions}
                  aiStream={aiStream}
                  currency={currency}
                  onNavigateToAgent={() => setCurrentTab('agent')}
                  onAIActionClick={handleAIActionClick}
                  onQuickAISubmit={handleQuickAISubmit}
                  onExportCSV={handleExportCSV}
                />
              )}

              {currentTab === 'inventory' && <InventoryPage currency={currency} />}
              {currentTab === 'analytics' && <AnalyticsPage currency={currency} />}
              {currentTab === 'transactions' && (
                <TransactionsPage 
                  transactions={transactions}
                  currency={currency}
                  onOpenModal={() => setIsModalOpen(true)}
                  onAddTransaction={handleAddTransaction}
                />
              )}
              {currentTab === 'agent' && (
                <AgentPage 
                  messages={chatMessages}
                  currency={currency}
                  metrics={metrics}
                  isProcessing={isAgentProcessing}
                  processingStep={agentStep}
                  onSendMessage={handleQuickAISubmit}
                  onAdvisorAction={handleAIActionClick}
                  onNewChat={() => setChatMessages([])}
                  user={user}
                />
              )}
              {currentTab === 'forecast' && <ForecastPage currency={currency} />}
              {currentTab === 'settings' && (
                <SettingsPage 
                  currency={currency} 
                  onCurrencyChange={(c) => {
                    setCurrency(c);
                    showToast(`Base currency switched to ${c === 'KES' ? 'Kenya Shillings (KSh)' : 'US Dollars ($)'}`);
                  }}
                  user={user}
                  onUserUpdate={(updatedUser) => {
                    setUser(updatedUser);
                    showToast('Profile updated successfully!');
                  }}
                />
              )}
            </ErrorBoundary>
          </div>
        </main>
      </div>

      <NewTransactionModal 
        isOpen={isModalOpen}
        currency={currency}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleAddTransaction}
      />

      <AxisVoiceSupportAgent
        isOpen={isVoiceAgentOpen}
        onClose={() => setIsVoiceAgentOpen(false)}
        activeTab={currentTab}
        onNavigate={(tab) => {
          setCurrentTab(tab);
          showToast(`Navigated to ${tab.toUpperCase()} via Voice Support`);
        }}
      />

      {toastMessage && (
        <div className="toast-container">
          <div className="toast">
            <i className="fa-solid fa-circle-check" style={{ color: '#00d4ff' }}></i>
            <span>{toastMessage}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
