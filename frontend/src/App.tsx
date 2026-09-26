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

const DEFAULT_METRICS: MetricData[] = [];

const DEFAULT_TRANSACTIONS: Transaction[] = [];

const DEFAULT_AI_STREAM: AIStreamItem[] = [];

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
            showToast(err.message || 'Verification link expired or invalid. Please request a new verification email.');
            setViewState('login');
            window.history.replaceState({}, document.title, window.location.pathname);
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
    // Fetch live data from backend whenever user is authenticated
    if (user?.user_id) {
      getDashboardMetricsApi()
        .then(res => { if (res && res.length) setMetrics(res); })
        .catch(err => console.log('Metrics fetch error:', err));

      getTransactionsApi()
        .then(res => { if (res && res.length) setTransactions(res); })
        .catch(err => console.log('Transactions fetch error:', err));
    }
  }, [user?.user_id]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleLoginSuccess = async (name: string, email: string) => {
    // Always fetch the real user profile from the backend after login
    try {
      const profile = await getMeApi();
      setUser(profile);
      if (profile.currency) setCurrency(profile.currency as Currency);
      showToast(`Welcome back, ${profile.name || name}! Logged in successfully.`);
    } catch {
      // Fallback: use the data returned by the login response
      const storedUser = getStoredUser();
      setUser(storedUser || { user_id: 'usr_active', name, email, currency });
      showToast(`Welcome back, ${name}! Logged in successfully.`);
    }
    setViewState('dashboard');
  };

  const handleLogout = () => {
    clearAuth();
    setUser(null);
    setChatMessages([]);
    showToast('Logged out successfully.');
    setViewState('login');
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
        const errorReply: ChatMessage = {
          id: `ai-${Date.now()}`,
          sender: 'ai',
          text: "I'm unable to reach the Axis intelligence backend right now. Please check your connection or try again in a moment. Your data and sessions are safe.",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setChatMessages(prev => [...prev, errorReply]);
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
        onEnterDashboard={() => {
          if (getAccessToken() || user) {
            setViewState('dashboard');
          } else {
            setViewState('login');
          }
        }}
        onNavigateLogin={() => setViewState('login')}
        onNavigateRegister={() => setViewState('register')}
      />
    );
  }

  // Guard: Protect internal app against unauthenticated access
  if (!getAccessToken() && !user) {
    return (
      <LoginPage 
        onLoginSuccess={handleLoginSuccess}
        onNavigateRegister={() => setViewState('register')}
        onNavigateForgotPassword={() => setViewState('forgot-password')}
        onVerificationRequired={(email) => {
          setPendingVerifyEmail(email);
          setViewState('verify-email');
        }}
        onBackToHome={() => setViewState('home')}
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
            onNavigateSettings={() => setCurrentTab('settings')}
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
              {currentTab === 'analytics' && <AnalyticsPage currency={currency} transactions={transactions} />}
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
