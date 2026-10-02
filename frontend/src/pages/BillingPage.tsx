import React, { useState, useEffect, useCallback } from 'react';
import { UserSubscription, PlanKey } from '../types';
import { 
  getSubscriptionApi, 
  getPlansApi, 
  initiatePaymentApi, 
  verifyPaymentApi, 
  cancelPaymentApi,
  extendDailyLimitApi,
  getPaymentHistoryApi 
} from '../utils/api';
import { USD_TO_KES_RATE } from '../utils/currencyUtils';

// Helper to display only clean, necessary messages to the user
const formatUserPaymentMessage = (raw?: string): string => {
  if (!raw) return 'Payment was not completed.';
  const lower = raw.toLowerCase();
  if (lower.includes('cancel')) {
    return 'Payment was cancelled on phone.';
  }
  if (lower.includes('timed out') || lower.includes('timeout')) {
    return 'Prompt timed out. Please try again.';
  }
  if (lower.includes('insufficient') || lower.includes('balance')) {
    return 'Insufficient M-Pesa balance.';
  }
  if (lower.includes('not completed') || lower.includes('abandoned')) {
    return 'Payment was not completed.';
  }
  return 'Payment was not completed. Please try again.';
};

interface BillingPageProps {
  user?: any;
  currency?: string;
  onRefreshUserData?: () => void;
  showToast?: (msg: string) => void;
}

export const BillingPage: React.FC<BillingPageProps> = ({
  user: _user,
  currency = 'KES',
  onRefreshUserData,
  showToast = (msg: string) => console.log(msg)
}) => {
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [, setPlans] = useState<Record<string, any>>({});
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Responsive Light / Dark Theme Detector
  const [isLight, setIsLight] = useState<boolean>(() => {
    return document.body.classList.contains('light-theme') || 
           document.documentElement.getAttribute('data-theme') === 'light';
  });

  useEffect(() => {
    const checkTheme = () => {
      const light = document.body.classList.contains('light-theme') || 
                    document.documentElement.getAttribute('data-theme') === 'light';
      setIsLight(light);
    };
    checkTheme();
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  // Checkout modal states
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [selectedPlanKey, setSelectedPlanKey] = useState<PlanKey>('starter');
  const [paymentMethod, setPaymentMethod] = useState<'mpesa_stk' | 'card'>('mpesa_stk');
  const [phone, setPhone] = useState('');
  const [processing, setProcessing] = useState(false);
  const [stkStatus, setStkStatus] = useState<string | null>(null);
  const [stkError, setStkError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number>(60);
  const [pendingRef, setPendingRef] = useState<string | null>(null);
  const [syncingHistory, setSyncingHistory] = useState<boolean>(false);
  const [verifyingRef, setVerifyingRef] = useState<string | null>(null);
  const [celebrationModalOpen, setCelebrationModalOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<any>(null);

  // Theme-aware color palette
  const themeColors = {
    textMain: isLight ? '#0f172a' : '#ffffff',
    textMuted: isLight ? '#475569' : '#94a3b8',
    textDim: isLight ? '#64748b' : '#64748b',
    cardBg: isLight ? '#ffffff' : 'rgba(14, 20, 32, 0.65)',
    cardBgStarter: isLight 
      ? 'linear-gradient(145deg, rgba(2, 132, 199, 0.06), #ffffff)' 
      : 'linear-gradient(145deg, rgba(0, 212, 255, 0.08), rgba(14, 20, 32, 0.95))',
    cardBgPro: isLight 
      ? 'linear-gradient(145deg, rgba(201, 169, 110, 0.08), #ffffff)' 
      : 'linear-gradient(145deg, rgba(201, 169, 110, 0.09), rgba(124, 95, 230, 0.08), rgba(14, 20, 32, 0.95))',
    cardBorder: isLight ? 'rgba(203, 213, 225, 0.75)' : 'rgba(255, 255, 255, 0.08)',
    borderLight: isLight ? 'rgba(203, 213, 225, 0.9)' : 'rgba(255, 255, 255, 0.15)',
    tableRowBorder: isLight ? '#f1f5f9' : 'rgba(255, 255, 255, 0.05)',
    tableHeaderBorder: isLight ? '#e2e8f0' : 'rgba(255, 255, 255, 0.1)',
    tableThColor: isLight ? '#475569' : '#94a3b8',
    tableTdColor: isLight ? '#1e293b' : '#cbd5e1',
    tableTdMuted: isLight ? '#64748b' : '#94a3b8',
    inputBg: isLight ? '#f8fafc' : 'rgba(255, 255, 255, 0.05)',
    inputBorder: isLight ? '#cbd5e1' : 'rgba(255, 255, 255, 0.15)',
    modalBg: isLight ? '#ffffff' : 'linear-gradient(145deg, rgba(14, 20, 32, 0.98), rgba(9, 13, 22, 0.98))',
    modalBorder: isLight ? '#e2e8f0' : 'rgba(0, 212, 255, 0.3)',
    barTrack: isLight ? '#e2e8f0' : 'rgba(255, 255, 255, 0.08)',
    tagBg: isLight ? '#f1f5f9' : 'rgba(255, 255, 255, 0.08)',
    cardShadow: isLight ? '0 4px 20px -2px rgba(15, 23, 42, 0.06)' : '0 12px 36px rgba(0, 0, 0, 0.4)',
    modalBoxShadow: isLight ? '0 24px 60px rgba(0, 0, 0, 0.15), 0 0 20px rgba(0, 0, 0, 0.05)' : '0 24px 60px rgba(0, 0, 0, 0.8), 0 0 40px rgba(0, 212, 255, 0.15)'
  };

  // Currency Formatter Helper
  const formatPriceDisplay = (kesAmount: number) => {
    if (kesAmount === 0) return currency === 'USD' ? '$0' : 'KES 0';
    if (currency === 'USD') {
      const usd = (kesAmount / USD_TO_KES_RATE).toFixed(2);
      return `$${usd}`;
    }
    return `KES ${kesAmount.toLocaleString()}`;
  };

  // Load active subscription, plans, and history
  const loadSubscriptionData = useCallback(async () => {
    try {
      const [subData, plansData, histData] = await Promise.all([
        getSubscriptionApi().catch(() => null),
        getPlansApi().catch(() => null),
        getPaymentHistoryApi().catch(() => [])
      ]);

      if (subData) setSubscription(subData);
      if (plansData?.plans) setPlans(plansData.plans);
      if (histData) setHistory(histData);
    } catch (err) {
      console.error('Error fetching billing data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSubscriptionData();
  }, [loadSubscriptionData]);

  // Handle Paystack callback redirect (?ref=... or ?reference=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref') || params.get('reference');
    if (ref) {
      setProcessing(true);
      verifyPaymentApi(ref)
        .then((res: any) => {
          if (res?.status === 'success') {
            setSubscription(res.data);
            setReceiptData(res.data);
            setCelebrationModalOpen(true);
            showToast(`Congratulations! Your ${res.data?.name || 'plan'} is now active.`);
            const cleanUrl = window.location.origin + window.location.pathname;
            window.history.replaceState({}, document.title, cleanUrl);
          } else if (res?.status === 'failed') {
            showToast('Payment was not completed.');
          }
        })
        .catch((err: any) => {
          console.warn('Callback verification note:', err);
        })
        .finally(() => setProcessing(false));
    }
  }, [showToast]);

  // Countdown timer for active STK push
  useEffect(() => {
    if (!pendingRef || !stkStatus) return;
    setCountdown(60);
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [pendingRef, stkStatus]);

  // Polling after M-Pesa STK prompt is sent
  useEffect(() => {
    if (!pendingRef || !checkoutModalOpen) return;
    let cancelled = false;
    let attempts = 0;

    const interval = setInterval(async () => {
      attempts += 1;
      if (cancelled) {
        clearInterval(interval);
        return;
      }

      // Timeout after 20 attempts (~60 seconds)
      if (attempts > 20) {
        clearInterval(interval);
        if (!cancelled) {
          setStkStatus(null);
          setStkError('Prompt timed out. Please try again.');
          setProcessing(false);
          setPendingRef(null);
          showToast('Prompt timed out. Please try again.');
          getPaymentHistoryApi().then((hist) => { if (hist) setHistory(hist); });
        }
        return;
      }

      try {
        const verifyRes = await verifyPaymentApi(pendingRef);
        if (cancelled) return;

        if (verifyRes?.status === 'success') {
          clearInterval(interval);
          setSubscription(verifyRes.data);
          setReceiptData(verifyRes.data);
          setCheckoutModalOpen(false);
          setCelebrationModalOpen(true);
          setStkStatus(null);
          setStkError(null);
          setPendingRef(null);
          setProcessing(false);
          showToast(`Payment confirmed! ${verifyRes.data?.name || 'Plan'} activated.`);
          if (onRefreshUserData) onRefreshUserData();
          getPaymentHistoryApi().then((hist) => { if (hist) setHistory(hist); });
        } else if (verifyRes?.status === 'failed') {
          clearInterval(interval);
          setStkStatus(null);
          const failureMsg = formatUserPaymentMessage(verifyRes.gateway_response || verifyRes.message);
          setStkError(failureMsg);
          setProcessing(false);
          setPendingRef(null);
          showToast(failureMsg);
          getPaymentHistoryApi().then((hist) => { if (hist) setHistory(hist); });
        }
      } catch (err) {
        // Continue polling until expiration
      }
    }, 3000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [pendingRef, checkoutModalOpen, onRefreshUserData, showToast]);

  // Open checkout modal for a plan
  const handleOpenCheckout = (planKey: PlanKey) => {
    setSelectedPlanKey(planKey);
    setStkStatus(null);
    setStkError(null);
    setPendingRef(null);
    setProcessing(false);
    setCheckoutModalOpen(true);
  };

  // Close checkout modal cleanly
  const handleCloseCheckout = () => {
    if (stkStatus && pendingRef) {
      cancelPaymentApi(pendingRef).catch(() => null);
      getPaymentHistoryApi().then((hist) => { if (hist) setHistory(hist); });
    }
    setCheckoutModalOpen(false);
    setStkStatus(null);
    setStkError(null);
    setPendingRef(null);
    setProcessing(false);
  };

  // Explicitly Cancel an active M-Pesa STK Prompt
  const handleCancelStk = async () => {
    if (!pendingRef) return;
    const refToCancel = pendingRef;
    setStkStatus(null);
    setProcessing(false);
    setPendingRef(null);
    setStkError('Payment cancelled.');
    showToast('Payment cancelled.');
    try {
      await cancelPaymentApi(refToCancel);
    } catch {
      // Ignored
    }
    const hist = await getPaymentHistoryApi().catch(() => null);
    if (hist) setHistory(hist);
  };

  // Check on-demand status of a specific transaction row
  const handleCheckStatus = async (ref: string) => {
    setVerifyingRef(ref);
    try {
      const res = await verifyPaymentApi(ref);
      if (res?.status === 'success') {
        showToast('Payment verified successfully!');
        await loadSubscriptionData();
        if (onRefreshUserData) onRefreshUserData();
      } else if (res?.status === 'failed') {
        const msg = formatUserPaymentMessage(res.gateway_response || res.message);
        showToast(msg);
        const hist = await getPaymentHistoryApi().catch(() => null);
        if (hist) setHistory(hist);
      } else {
        showToast('Transaction is still pending.');
      }
    } catch (err: any) {
      showToast(err?.message || 'Verification check failed.');
    } finally {
      setVerifyingRef(null);
    }
  };

  // Manually sync transaction history with Paystack
  const handleSyncHistory = async () => {
    setSyncingHistory(true);
    try {
      await loadSubscriptionData();
      showToast('Payment records updated.');
    } catch {
      showToast('Could not update records.');
    } finally {
      setSyncingHistory(false);
    }
  };

  // Submit Payment (STK or Card)
  const handleInitiatePayment = async () => {
    setProcessing(true);
    setStkStatus(null);
    setStkError(null);

    try {
      if (paymentMethod === 'card') {
        const res = await initiatePaymentApi(selectedPlanKey, 'card');
        if (res?.authorization_url) {
          showToast('Redirecting to secure card checkout...');
          window.location.href = res.authorization_url;
        } else {
          showToast('Card payment setup completed.');
          await loadSubscriptionData();
          setCheckoutModalOpen(false);
        }
      } else if (paymentMethod === 'mpesa_stk') {
        const rawPhone = phone.trim().replace(/\s+/g, '');
        if (!rawPhone) {
          showToast('Please enter your Safaricom phone number.');
          setProcessing(false);
          return;
        }
        const res = await initiatePaymentApi(selectedPlanKey, 'mobile_money', rawPhone);
        if (res?.reference) {
          setPendingRef(res.reference);
          setStkStatus('Enter your M-Pesa PIN on your phone.');
          showToast('Enter your M-Pesa PIN on your phone.');
        }
      }
    } catch (err: any) {
      showToast(err?.message || 'Payment initiation failed. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  // Extend Pro Daily Limit
  const handleExtendDailyLimit = async (type: 'chat' | 'voice') => {
    try {
      const res = await extendDailyLimitApi(type);
      if (res?.data) {
        setSubscription(res.data);
        showToast(res.message || 'Daily quota extended successfully!');
      }
    } catch (err: any) {
      showToast(err?.message || 'Could not extend limit.');
    }
  };

  const currentPlanKey = subscription?.plan || 'free';
  const chatUsage = subscription?.usage?.axis_agent_chat;
  const voiceUsage = subscription?.usage?.voice_agent;
  const resources = subscription?.resources;

  if (loading && !subscription) {
    return (
      <div className="tab-view active" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: themeColors.textMuted, flexDirection: 'column', gap: '16px' }}>
        <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '2.4rem', color: '#00d4ff' }}></i>
        <div style={{ fontSize: '0.95rem', fontWeight: 600 }}>Loading subscription status &amp; packages...</div>
      </div>
    );
  }

  return (
    <div className="tab-view active" style={{ maxWidth: '1200px', margin: '0 auto', paddingBottom: '60px' }}>
      
      {/* ── Page Embedded Responsive CSS Styles ── */}
      <style>{`
        .billing-quotas-strip {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 32px;
        }
        @media (max-width: 960px) {
          .billing-quotas-strip {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        @media (max-width: 520px) {
          .billing-quotas-strip {
            grid-template-columns: 1fr;
          }
        }
        .billing-tiers-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
          align-items: stretch;
          padding-top: 14px;
        }
        @media (max-width: 980px) {
          .billing-tiers-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      {/* ── Page Header (Cleaned, no "Financial Intelligence Workspace") ─────── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px', marginBottom: '28px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <span style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              padding: '3px 10px',
              borderRadius: '6px',
              background: currentPlanKey === 'pro' ? 'rgba(201, 169, 110, 0.2)' : currentPlanKey === 'starter' ? 'rgba(0, 212, 255, 0.2)' : themeColors.tagBg,
              color: currentPlanKey === 'pro' ? '#e8c97a' : currentPlanKey === 'starter' ? '#00d4ff' : themeColors.textMuted,
              border: `1px solid ${currentPlanKey === 'pro' ? 'rgba(201, 169, 110, 0.4)' : currentPlanKey === 'starter' ? 'rgba(0, 212, 255, 0.4)' : themeColors.borderLight}`
            }}>
              {subscription?.name ? subscription.name.toUpperCase() : 'FREE TIER'}
            </span>
          </div>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 800, color: themeColors.textMain, margin: '4px 0 0', letterSpacing: '-0.5px' }}>
            Upgrade &amp; Billing
          </h1>
          <p style={{ color: themeColors.textMuted, fontSize: '0.9rem', margin: '4px 0 0' }}>
            Manage your subscription package, live resource quotas, and payment history.
          </p>
        </div>

        {subscription?.is_paid && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '10px 18px',
            borderRadius: '12px',
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            color: '#10b981'
          }}>
            <i className="fa-solid fa-circle-check" style={{ fontSize: '1.2rem' }}></i>
            <div>
              <div style={{ fontSize: '0.74rem', fontWeight: 600, color: isLight ? '#047857' : '#6ee7b7' }}>Subscription Active</div>
              <div style={{ fontSize: '0.85rem', fontWeight: 800, color: themeColors.textMain }}>
                {subscription.days_left} days remaining
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Active Plan Status & Live Resource Meters Strip ────────────────── */}
      {/* (Large screen: 1 horizontal line / 4 columns. Small screen: 2 by 2) */}
      <div className="billing-quotas-strip">
        
        {/* Card 1: Axis Agent Chat Quota */}
        <div className="glass-card" style={{ padding: '20px', borderRadius: '16px', border: `1px solid ${themeColors.cardBorder}`, background: themeColors.cardBg, boxShadow: themeColors.cardShadow }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(0, 212, 255, 0.15)', color: '#00d4ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="fa-solid fa-brain"></i>
              </div>
              <div>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: themeColors.textMain }}>Axis Agent Queries</span>
                <div style={{ fontSize: '0.7rem', color: themeColors.textMuted }}>Today's Usage</div>
              </div>
            </div>
            <span style={{
              fontSize: '0.72rem',
              fontWeight: 800,
              padding: '2px 8px',
              borderRadius: '6px',
              background: chatUsage?.daily_limit_reached ? 'rgba(239, 68, 68, 0.18)' : 'rgba(0, 212, 255, 0.12)',
              color: chatUsage?.daily_limit_reached ? '#ef4444' : '#00d4ff'
            }}>
              {chatUsage?.used_today || 0} / {chatUsage?.daily_limit || 8}
            </span>
          </div>

          {/* Progress Bar */}
          <div style={{ width: '100%', height: '6px', borderRadius: '4px', background: themeColors.barTrack, overflow: 'hidden', marginBottom: '8px' }}>
            <div style={{
              width: `${Math.min(100, (((chatUsage?.used_today || 0) / (chatUsage?.daily_limit || 8)) * 100))}%`,
              height: '100%',
              background: chatUsage?.daily_limit_reached ? '#ef4444' : 'linear-gradient(90deg, #00d4ff, #7c5fe6)',
              borderRadius: '4px',
              transition: 'width 0.3s ease'
            }} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: themeColors.textDim }}>
            <span>Monthly: {chatUsage?.used_month || 0} / {chatUsage?.monthly_limit || 240}</span>
            <span>
              {chatUsage?.is_extended ? (
                <span style={{ color: '#00d4ff', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <i className="fa-solid fa-bolt"></i> Extended
                </span>
              ) : 'Standard'}
            </span>
          </div>

          {/* Pro Extension Button */}
          {currentPlanKey === 'pro' && chatUsage?.can_extend && (
            <button
              onClick={() => handleExtendDailyLimit('chat')}
              style={{
                width: '100%',
                marginTop: '12px',
                padding: '6px 12px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, rgba(201, 169, 110, 0.2), rgba(201, 169, 110, 0.1))',
                border: '1px solid rgba(201, 169, 110, 0.4)',
                color: '#e8c97a',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <i className="fa-solid fa-bolt"></i> Double Daily Limit (+40)
            </button>
          )}
        </div>

        {/* Card 2: Voice Support Agent */}
        <div className="glass-card" style={{ padding: '20px', borderRadius: '16px', border: `1px solid ${themeColors.cardBorder}`, background: themeColors.cardBg, boxShadow: themeColors.cardShadow }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(124, 95, 230, 0.15)', color: '#a78bfa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="fa-solid fa-microphone-lines"></i>
              </div>
              <div>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: themeColors.textMain }}>Voice Support Agent</span>
                <div style={{ fontSize: '0.7rem', color: themeColors.textMuted }}>Conversational AI</div>
              </div>
            </div>
            <span style={{
              fontSize: '0.72rem',
              fontWeight: 800,
              padding: '2px 8px',
              borderRadius: '6px',
              background: currentPlanKey === 'free' ? themeColors.tagBg : 'rgba(124, 95, 230, 0.15)',
              color: currentPlanKey === 'free' ? themeColors.textMuted : '#a78bfa'
            }}>
              {currentPlanKey === 'free' ? 'LOCKED' : `${voiceUsage?.used_today || 0} / ${voiceUsage?.daily_limit || 13}`}
            </span>
          </div>

          <div style={{ width: '100%', height: '6px', borderRadius: '4px', background: themeColors.barTrack, overflow: 'hidden', marginBottom: '8px' }}>
            <div style={{
              width: currentPlanKey === 'free' ? '0%' : `${Math.min(100, (((voiceUsage?.used_today || 0) / (voiceUsage?.daily_limit || 13)) * 100))}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #7c5fe6, #c084fc)',
              borderRadius: '4px'
            }} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: themeColors.textDim }}>
            <span>{currentPlanKey === 'free' ? 'Available on Starter & Pro' : `Monthly: ${voiceUsage?.used_month || 0} / ${voiceUsage?.monthly_limit || 400}`}</span>
            <span>
              {voiceUsage?.is_extended ? (
                <span style={{ color: '#a78bfa', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <i className="fa-solid fa-bolt"></i> Extended
                </span>
              ) : ''}
            </span>
          </div>

          {currentPlanKey === 'pro' && voiceUsage?.can_extend && (
            <button
              onClick={() => handleExtendDailyLimit('voice')}
              style={{
                width: '100%',
                marginTop: '12px',
                padding: '6px 12px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, rgba(201, 169, 110, 0.2), rgba(201, 169, 110, 0.1))',
                border: '1px solid rgba(201, 169, 110, 0.4)',
                color: '#e8c97a',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <i className="fa-solid fa-bolt"></i> Extend Daily Quota (+7)
            </button>
          )}
        </div>

        {/* Card 3: Branches Capacity */}
        <div className="glass-card" style={{ padding: '20px', borderRadius: '16px', border: `1px solid ${themeColors.cardBorder}`, background: themeColors.cardBg, boxShadow: themeColors.cardShadow }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: isLight ? 'rgba(2, 132, 199, 0.12)' : 'rgba(255, 255, 255, 0.08)', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="fa-solid fa-building"></i>
              </div>
              <div>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: themeColors.textMain }}>Branch Locations</span>
                <div style={{ fontSize: '0.7rem', color: themeColors.textMuted }}>Multi-store network</div>
              </div>
            </div>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#0284c7' }}>
              {resources?.branches_limit === -1 ? 'UNLIMITED' : `${resources?.branches_count || 1} / ${resources?.branches_limit || 1}`}
            </span>
          </div>
          <div style={{ fontSize: '0.82rem', color: themeColors.textMuted, lineHeight: 1.5, marginTop: '8px' }}>
            {resources?.branches_limit === -1 
              ? 'Multi-branch operations enabled without any store restriction.' 
              : 'Free tier includes 1 active branch. Upgrade to unlock multi-location.'}
          </div>
        </div>

        {/* Card 4: Inventory SKUs */}
        <div className="glass-card" style={{ padding: '20px', borderRadius: '16px', border: `1px solid ${themeColors.cardBorder}`, background: themeColors.cardBg, boxShadow: themeColors.cardShadow }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="fa-solid fa-boxes-stacked"></i>
              </div>
              <div>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: themeColors.textMain }}>Inventory Items</span>
                <div style={{ fontSize: '0.7rem', color: themeColors.textMuted }}>Catalog SKUs</div>
              </div>
            </div>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#d97706' }}>
              {resources?.inventory_limit === -1 ? 'UNLIMITED' : `${resources?.inventory_count || 0} / ${resources?.inventory_limit || 2}`}
            </span>
          </div>
          <div style={{ fontSize: '0.82rem', color: themeColors.textMuted, lineHeight: 1.5, marginTop: '8px' }}>
            {resources?.inventory_limit === -1 
              ? 'Unlimited warehouse catalog & automatic reorder alerts.' 
              : 'Free tier allows up to 2 items. Upgrade for full inventory & CSV import.'}
          </div>
        </div>
      </div>

      {/* ── Pricing Tier Cards (The Core 3 Packages) ───────────────────────── */}
      <div style={{ marginBottom: '40px' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: themeColors.textMain, margin: '0 0 6px' }}>
            Choose the Package Tailored for Your Growth
          </h2>
          <p style={{ color: themeColors.textMuted, fontSize: '0.9rem', maxWidth: '580px', margin: '0 auto' }}>
            Seamless upgrades with local M-Pesa STK Push or instant Card checkout.
          </p>
        </div>

        <div className="billing-tiers-grid">
          
          {/* TIER 1: FREE */}
          <div className="glass-card" style={{
            borderRadius: '20px',
            padding: '30px 24px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            border: currentPlanKey === 'free' ? '2px solid rgba(148, 163, 184, 0.5)' : `1px solid ${themeColors.cardBorder}`,
            background: themeColors.cardBg,
            boxShadow: themeColors.cardShadow,
            overflow: 'visible',
            position: 'relative'
          }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '1.25rem', fontWeight: 800, color: themeColors.textMain }}>Free</span>
                {currentPlanKey === 'free' && (
                  <span style={{ fontSize: '0.68rem', fontWeight: 800, padding: '3px 8px', borderRadius: '6px', background: themeColors.tagBg, color: themeColors.textMuted }}>
                    CURRENT PLAN
                  </span>
                )}
              </div>
              <p style={{ color: themeColors.textMuted, fontSize: '0.85rem', lineHeight: 1.5, minHeight: '40px' }}>
                Essential runway simulator and basic exploration for solo entrepreneurs.
              </p>
              <div style={{ margin: '18px 0 22px', fontFamily: 'monospace' }}>
                <span style={{ fontSize: '1.95rem', fontWeight: 900, color: themeColors.textMain }}>{formatPriceDisplay(0)}</span>
                <span style={{ color: themeColors.textDim, fontSize: '0.85rem' }}> / forever</span>
              </div>

              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: themeColors.textDim, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>
                Included Capabilities
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '0.85rem', color: themeColors.textMain }}>
                <li style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '10px' }}>
                  <i className="fa-solid fa-check" style={{ color: '#0284c7', marginTop: '3px' }}></i>
                  <span>Create business profile</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '10px' }}>
                  <i className="fa-solid fa-check" style={{ color: '#0284c7', marginTop: '3px' }}></i>
                  <span>Create 1 branch location</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '10px' }}>
                  <i className="fa-solid fa-check" style={{ color: '#0284c7', marginTop: '3px' }}></i>
                  <span>Runway Simulator &amp; hiring models</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '10px' }}>
                  <i className="fa-solid fa-check" style={{ color: '#0284c7', marginTop: '3px' }}></i>
                  <span>Inventory manager (2 items limit)</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '10px' }}>
                  <i className="fa-solid fa-check" style={{ color: '#0284c7', marginTop: '3px' }}></i>
                  <span>Axis Agent (up to 8 queries/day, 240/mo)</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', color: themeColors.textDim, marginBottom: '10px' }}>
                  <i className="fa-solid fa-xmark" style={{ marginTop: '3px' }}></i>
                  <span>Interactive spreadsheet locked</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', color: themeColors.textDim }}>
                  <i className="fa-solid fa-xmark" style={{ marginTop: '3px' }}></i>
                  <span>Voice agent &amp; Team roles locked</span>
                </li>
              </ul>
            </div>

            <div style={{ marginTop: '28px' }}>
              <button
                disabled={currentPlanKey === 'free'}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '12px',
                  background: themeColors.tagBg,
                  color: themeColors.textMuted,
                  border: `1px solid ${themeColors.borderLight}`,
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  cursor: 'default'
                }}
              >
                {currentPlanKey === 'free' ? 'Currently Active' : 'Basic Tier'}
              </button>
            </div>
          </div>

          {/* TIER 2: STARTER (899 KES - MONTHLY) */}
          <div className="glass-card" style={{
            borderRadius: '20px',
            padding: '30px 24px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            position: 'relative',
            overflow: 'visible',
            background: themeColors.cardBgStarter,
            border: currentPlanKey === 'starter' ? '2px solid #00d4ff' : isLight ? '1px solid rgba(2, 132, 199, 0.4)' : '1px solid rgba(0, 212, 255, 0.35)',
            boxShadow: isLight ? '0 8px 30px rgba(2, 132, 199, 0.12)' : '0 12px 36px rgba(0, 212, 255, 0.15)'
          }}>
            {/* Fully visible badge, elevated above card */}
            <div style={{
              position: 'absolute',
              top: '-13px',
              right: '20px',
              zIndex: 3,
              background: '#00d4ff',
              color: '#040d1a',
              fontSize: '0.68rem',
              fontWeight: 900,
              padding: '4px 12px',
              borderRadius: '12px',
              letterSpacing: '0.5px',
              boxShadow: '0 4px 14px rgba(0, 212, 255, 0.4)'
            }}>
              MOST POPULAR
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0284c7' }}>Starter</span>
                {currentPlanKey === 'starter' && (
                  <span style={{ fontSize: '0.68rem', fontWeight: 800, padding: '3px 8px', borderRadius: '6px', background: 'rgba(0, 212, 255, 0.15)', color: '#0284c7' }}>
                    CURRENT PLAN
                  </span>
                )}
              </div>
              <p style={{ color: themeColors.textMuted, fontSize: '0.85rem', lineHeight: 1.5, minHeight: '40px' }}>
                Complete operations suite with interactive spreadsheet, voice AI, and multi-branch team collaboration.
              </p>
              <div style={{ margin: '18px 0 22px', fontFamily: 'monospace' }}>
                <span style={{ fontSize: '2.05rem', fontWeight: 900, color: themeColors.textMain }}>{formatPriceDisplay(899)}</span>
                <span style={{ color: themeColors.textMuted, fontSize: '0.85rem' }}> / month</span>
                {currency === 'USD' && (
                  <div style={{ fontSize: '0.72rem', color: themeColors.textDim, marginTop: '2px' }}>(approx. KES 899)</div>
                )}
              </div>

              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0284c7', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>
                All in Free, Plus:
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '0.85rem', color: themeColors.textMain }}>
                <li style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '10px' }}>
                  <i className="fa-solid fa-check" style={{ color: '#0284c7', marginTop: '3px' }}></i>
                  <span><strong>Unlimited branches</strong> &amp; locations</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '10px' }}>
                  <i className="fa-solid fa-check" style={{ color: '#0284c7', marginTop: '3px' }}></i>
                  <span><strong>Team members &amp; roles assignment</strong></span>
                </li>
                <li style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '10px' }}>
                  <i className="fa-solid fa-check" style={{ color: '#0284c7', marginTop: '3px' }}></i>
                  <span><strong>Interactive Spreadsheet feature</strong></span>
                </li>
                <li style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '10px' }}>
                  <i className="fa-solid fa-check" style={{ color: '#0284c7', marginTop: '3px' }}></i>
                  <span><strong>Unlimited Inventory &amp; Ledger</strong> entries</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '10px' }}>
                  <i className="fa-solid fa-check" style={{ color: '#0284c7', marginTop: '3px' }}></i>
                  <span><strong>Business Summary feature</strong> (6 PM dispatch)</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '10px' }}>
                  <i className="fa-solid fa-check" style={{ color: '#0284c7', marginTop: '3px' }}></i>
                  <span><strong>Voice Agent</strong> (up to 400/mo, 13 max daily)</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <i className="fa-solid fa-check" style={{ color: '#0284c7', marginTop: '3px' }}></i>
                  <span>Axis Agent (up to 600/mo, 20 max daily)</span>
                </li>
              </ul>
            </div>

            <div style={{ marginTop: '28px' }}>
              <button
                onClick={() => handleOpenCheckout('starter')}
                disabled={currentPlanKey === 'starter'}
                style={{
                  width: '100%',
                  padding: '13px',
                  borderRadius: '12px',
                  background: currentPlanKey === 'starter' ? 'rgba(0, 212, 255, 0.2)' : 'linear-gradient(135deg, #00d4ff, #0088cc)',
                  color: currentPlanKey === 'starter' ? '#0284c7' : '#040d1a',
                  fontWeight: 800,
                  fontSize: '0.9rem',
                  border: 'none',
                  cursor: currentPlanKey === 'starter' ? 'default' : 'pointer',
                  boxShadow: currentPlanKey === 'starter' ? 'none' : '0 4px 20px rgba(0, 212, 255, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <span>{currentPlanKey === 'starter' ? 'Current Package' : 'Upgrade to Starter'}</span>
                {currentPlanKey !== 'starter' && <i className="fa-solid fa-arrow-right"></i>}
              </button>
            </div>
          </div>

          {/* TIER 3: PRO (2,299 KES - 3 MONTHS) */}
          <div className="glass-card" style={{
            borderRadius: '20px',
            padding: '30px 24px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            position: 'relative',
            overflow: 'visible',
            background: themeColors.cardBgPro,
            border: currentPlanKey === 'pro' ? '2px solid #d97706' : isLight ? '1px solid rgba(217, 119, 6, 0.4)' : '1px solid rgba(201, 169, 110, 0.4)',
            boxShadow: isLight ? '0 8px 30px rgba(217, 119, 6, 0.12)' : '0 12px 36px rgba(201, 169, 110, 0.15)'
          }}>
            {/* Fully visible badge, elevated above card */}
            <div style={{
              position: 'absolute',
              top: '-13px',
              right: '20px',
              zIndex: 3,
              background: 'linear-gradient(135deg, #e8c97a, #c9a96e)',
              color: '#000',
              fontSize: '0.68rem',
              fontWeight: 900,
              padding: '4px 12px',
              borderRadius: '12px',
              letterSpacing: '0.5px',
              boxShadow: '0 4px 14px rgba(201, 169, 110, 0.4)'
            }}>
              BEST VALUE (3 MONTHS)
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '1.35rem', fontWeight: 800, color: '#d97706' }}>Pro</span>
                  <i className="fa-solid fa-crown" style={{ color: '#d97706', fontSize: '1rem' }}></i>
                </div>
                {currentPlanKey === 'pro' && (
                  <span style={{ fontSize: '0.68rem', fontWeight: 800, padding: '3px 8px', borderRadius: '6px', background: 'rgba(201, 169, 110, 0.2)', color: '#d97706' }}>
                    CURRENT PLAN
                  </span>
                )}
              </div>
              <p style={{ color: themeColors.textMuted, fontSize: '0.85rem', lineHeight: 1.5, minHeight: '40px' }}>
                High-capacity power tier for multi-branch companies requiring double daily AI extensions and VIP priority care.
              </p>
              <div style={{ margin: '18px 0 22px', fontFamily: 'monospace' }}>
                <span style={{ fontSize: '2.05rem', fontWeight: 900, color: themeColors.textMain }}>{formatPriceDisplay(2299)}</span>
                <span style={{ color: themeColors.textMuted, fontSize: '0.85rem' }}> / 3 months</span>
                {currency === 'USD' && (
                  <div style={{ fontSize: '0.72rem', color: themeColors.textDim, marginTop: '2px' }}>(approx. KES 2,299)</div>
                )}
              </div>

              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#d97706', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>
                All in Starter, Plus:
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '0.85rem', color: themeColors.textMain }}>
                <li style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '10px' }}>
                  <i className="fa-solid fa-star" style={{ color: '#d97706', marginTop: '3px' }}></i>
                  <span><strong>Priority VIP Customer Support</strong></span>
                </li>
                <li style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '10px' }}>
                  <i className="fa-solid fa-bolt" style={{ color: '#d97706', marginTop: '3px' }}></i>
                  <span>Axis Agent (1,200/mo, 40 daily max)</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '10px' }}>
                  <i className="fa-solid fa-angles-up" style={{ color: '#d97706', marginTop: '3px' }}></i>
                  <span><strong>Can extend by DOUBLE (+40 daily)</strong> when daily limit reached</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '10px' }}>
                  <i className="fa-solid fa-microphone-lines" style={{ color: '#d97706', marginTop: '3px' }}></i>
                  <span>Voice Agent (800/mo, 26 daily max)</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '10px' }}>
                  <i className="fa-solid fa-plus" style={{ color: '#d97706', marginTop: '3px' }}></i>
                  <span><strong>Can extend Voice by quarter (+7 daily)</strong> when daily limit reached</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <i className="fa-solid fa-check" style={{ color: '#d97706', marginTop: '3px' }}></i>
                  <span>Interactive Spreadsheet engine unlimited</span>
                </li>
              </ul>
            </div>

            <div style={{ marginTop: '28px' }}>
              <button
                onClick={() => handleOpenCheckout('pro')}
                disabled={currentPlanKey === 'pro'}
                style={{
                  width: '100%',
                  padding: '13px',
                  borderRadius: '12px',
                  background: currentPlanKey === 'pro' ? 'rgba(201, 169, 110, 0.2)' : 'linear-gradient(135deg, #e8c97a, #c9a96e)',
                  color: currentPlanKey === 'pro' ? '#d97706' : '#040d1a',
                  fontWeight: 900,
                  fontSize: '0.9rem',
                  border: 'none',
                  cursor: currentPlanKey === 'pro' ? 'default' : 'pointer',
                  boxShadow: currentPlanKey === 'pro' ? 'none' : '0 4px 20px rgba(201, 169, 110, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <span>{currentPlanKey === 'pro' ? 'Active Pro Tier' : 'Upgrade to Pro (3 Mo)'}</span>
                {currentPlanKey !== 'pro' && <i className="fa-solid fa-crown"></i>}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Feature Comparison Matrix ───────────────────────────────────────── */}
      <div className="glass-card" style={{ padding: '28px', borderRadius: '20px', marginBottom: '40px', background: themeColors.cardBg, border: `1px solid ${themeColors.cardBorder}`, boxShadow: themeColors.cardShadow }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: themeColors.textMain, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <i className="fa-solid fa-table-list" style={{ color: '#0284c7' }}></i> Comprehensive Feature Comparison
        </h3>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${themeColors.tableHeaderBorder}`, textAlign: 'left', color: themeColors.tableThColor }}>
                <th style={{ padding: '12px 14px' }}>Feature Capability</th>
                <th style={{ padding: '12px 14px', width: '22%' }}>Free</th>
                <th style={{ padding: '12px 14px', width: '25%', color: '#0284c7' }}>
                  Starter ({formatPriceDisplay(899)}/mo)
                </th>
                <th style={{ padding: '12px 14px', width: '25%', color: '#d97706' }}>
                  Pro ({formatPriceDisplay(2299)}/3 mo)
                </th>
              </tr>
            </thead>
            <tbody style={{ color: themeColors.tableTdColor }}>
              <tr style={{ borderBottom: `1px solid ${themeColors.tableRowBorder}` }}>
                <td style={{ padding: '12px 14px' }}>Business Creation</td>
                <td style={{ padding: '12px 14px', color: '#10b981' }}><i className="fa-solid fa-check"></i> Yes</td>
                <td style={{ padding: '12px 14px', color: '#10b981' }}><i className="fa-solid fa-check"></i> Yes</td>
                <td style={{ padding: '12px 14px', color: '#10b981' }}><i className="fa-solid fa-check"></i> Yes</td>
              </tr>
              <tr style={{ borderBottom: `1px solid ${themeColors.tableRowBorder}` }}>
                <td style={{ padding: '12px 14px' }}>Branch Locations</td>
                <td style={{ padding: '12px 14px' }}>1 Branch</td>
                <td style={{ padding: '12px 14px', color: '#0284c7', fontWeight: 700 }}>Unlimited</td>
                <td style={{ padding: '12px 14px', color: '#d97706', fontWeight: 700 }}>Unlimited</td>
              </tr>
              <tr style={{ borderBottom: `1px solid ${themeColors.tableRowBorder}` }}>
                <td style={{ padding: '12px 14px' }}>Runway Scenario Simulator</td>
                <td style={{ padding: '12px 14px', color: '#10b981' }}><i className="fa-solid fa-check"></i> Yes</td>
                <td style={{ padding: '12px 14px', color: '#10b981' }}><i className="fa-solid fa-check"></i> Yes</td>
                <td style={{ padding: '12px 14px', color: '#10b981' }}><i className="fa-solid fa-check"></i> Yes</td>
              </tr>
              <tr style={{ borderBottom: `1px solid ${themeColors.tableRowBorder}` }}>
                <td style={{ padding: '12px 14px' }}>Inventory SKUs Limit</td>
                <td style={{ padding: '12px 14px' }}>2 Uploads</td>
                <td style={{ padding: '12px 14px', color: '#0284c7', fontWeight: 700 }}>Unlimited</td>
                <td style={{ padding: '12px 14px', color: '#d97706', fontWeight: 700 }}>Unlimited</td>
              </tr>
              <tr style={{ borderBottom: `1px solid ${themeColors.tableRowBorder}` }}>
                <td style={{ padding: '12px 14px' }}>Interactive Spreadsheet Engine</td>
                <td style={{ padding: '12px 14px', color: themeColors.textDim }}><i className="fa-solid fa-lock"></i> Locked</td>
                <td style={{ padding: '12px 14px', color: '#10b981' }}><i className="fa-solid fa-check"></i> Included</td>
                <td style={{ padding: '12px 14px', color: '#10b981' }}><i className="fa-solid fa-check"></i> Included</td>
              </tr>
              <tr style={{ borderBottom: `1px solid ${themeColors.tableRowBorder}` }}>
                <td style={{ padding: '12px 14px' }}>Team Members &amp; Role Assignments</td>
                <td style={{ padding: '12px 14px', color: themeColors.textDim }}><i className="fa-solid fa-lock"></i> Locked</td>
                <td style={{ padding: '12px 14px', color: '#10b981' }}><i className="fa-solid fa-check"></i> Included</td>
                <td style={{ padding: '12px 14px', color: '#10b981' }}><i className="fa-solid fa-check"></i> Included</td>
              </tr>
              <tr style={{ borderBottom: `1px solid ${themeColors.tableRowBorder}` }}>
                <td style={{ padding: '12px 14px' }}>Business Summary Feature</td>
                <td style={{ padding: '12px 14px', color: themeColors.textDim }}><i className="fa-solid fa-lock"></i> Locked</td>
                <td style={{ padding: '12px 14px', color: '#10b981' }}><i className="fa-solid fa-check"></i> Included</td>
                <td style={{ padding: '12px 14px', color: '#10b981' }}><i className="fa-solid fa-check"></i> Included</td>
              </tr>
              <tr style={{ borderBottom: `1px solid ${themeColors.tableRowBorder}` }}>
                <td style={{ padding: '12px 14px' }}>Axis AI Chat Queries</td>
                <td style={{ padding: '12px 14px' }}>8/day (240/mo)</td>
                <td style={{ padding: '12px 14px' }}>20/day (600/mo)</td>
                <td style={{ padding: '12px 14px', color: '#d97706', fontWeight: 700 }}>40/day (1,200/mo)</td>
              </tr>
              <tr style={{ borderBottom: `1px solid ${themeColors.tableRowBorder}` }}>
                <td style={{ padding: '12px 14px' }}>AI Daily Limit Double Extension</td>
                <td style={{ padding: '12px 14px', color: themeColors.textDim }}>No</td>
                <td style={{ padding: '12px 14px', color: themeColors.textDim }}>No</td>
                <td style={{ padding: '12px 14px', color: '#d97706', fontWeight: 800 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                    <i className="fa-solid fa-bolt" style={{ color: '#d97706' }}></i> Double to 80/day
                  </span>
                </td>
              </tr>
              <tr style={{ borderBottom: `1px solid ${themeColors.tableRowBorder}` }}>
                <td style={{ padding: '12px 14px' }}>Voice Support Agent</td>
                <td style={{ padding: '12px 14px', color: themeColors.textDim }}><i className="fa-solid fa-lock"></i> Locked</td>
                <td style={{ padding: '12px 14px' }}>13/day (400/mo)</td>
                <td style={{ padding: '12px 14px', color: '#d97706' }}>26/day (800/mo)</td>
              </tr>
              <tr style={{ borderBottom: `1px solid ${themeColors.tableRowBorder}` }}>
                <td style={{ padding: '12px 14px' }}>Voice Daily Limit Quarter Extension</td>
                <td style={{ padding: '12px 14px', color: themeColors.textDim }}>No</td>
                <td style={{ padding: '12px 14px', color: themeColors.textDim }}>No</td>
                <td style={{ padding: '12px 14px', color: '#d97706', fontWeight: 800 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                    <i className="fa-solid fa-bolt" style={{ color: '#d97706' }}></i> +7 queries daily
                  </span>
                </td>
              </tr>
              <tr>
                <td style={{ padding: '12px 14px' }}>Support Escalation</td>
                <td style={{ padding: '12px 14px' }}>Community</td>
                <td style={{ padding: '12px 14px' }}>Standard Email</td>
                <td style={{ padding: '12px 14px', color: '#d97706', fontWeight: 800 }}>Priority VIP Care</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Transaction History Table ────────────────────────────────────────── */}
      {history.length > 0 && (
        <div className="glass-card" style={{ padding: '24px', borderRadius: '20px', background: themeColors.cardBg, border: `1px solid ${themeColors.cardBorder}`, boxShadow: themeColors.cardShadow }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: themeColors.textMain, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="fa-solid fa-receipt" style={{ color: '#0284c7' }}></i> Payment &amp; Receipt Records
            </h3>
            <button
              onClick={handleSyncHistory}
              disabled={syncingHistory}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: isLight ? 'rgba(2, 132, 199, 0.1)' : 'rgba(0, 212, 255, 0.1)',
                border: `1px solid ${isLight ? 'rgba(2, 132, 199, 0.3)' : 'rgba(0, 212, 255, 0.3)'}`,
                color: '#0284c7',
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: syncingHistory ? 'wait' : 'pointer'
              }}
            >
              <i className={`fa-solid fa-arrows-rotate ${syncingHistory ? 'fa-spin' : ''}`}></i>
              <span>{syncingHistory ? 'Updating...' : 'Refresh Status'}</span>
            </button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${themeColors.tableHeaderBorder}`, color: themeColors.tableThColor, textAlign: 'left' }}>
                  <th style={{ padding: '12px 10px' }}>Receipt #</th>
                  <th style={{ padding: '12px 10px' }}>Plan</th>
                  <th style={{ padding: '12px 10px' }}>Amount</th>
                  <th style={{ padding: '12px 10px' }}>Channel</th>
                  <th style={{ padding: '12px 10px' }}>Status</th>
                  <th style={{ padding: '12px 10px' }}>Date</th>
                </tr>
              </thead>
              <tbody style={{ color: themeColors.tableTdColor }}>
                {history.map((h, i) => {
                  const rawStatus = (h.status || '').toLowerCase();
                  const isPaid = rawStatus === 'paid' || rawStatus === 'success';
                  const isPending = rawStatus === 'pending';
                  const isFailed = rawStatus === 'failed' || rawStatus === 'abandoned';
                  const isCancelled = rawStatus === 'cancelled';

                  const badgeBg = isPaid 
                    ? 'rgba(16, 185, 129, 0.16)' 
                    : isPending 
                    ? 'rgba(245, 158, 11, 0.16)' 
                    : isFailed 
                    ? 'rgba(239, 68, 68, 0.16)' 
                    : isLight ? 'rgba(100, 116, 139, 0.12)' : 'rgba(148, 163, 184, 0.16)';

                  const badgeColor = isPaid 
                    ? (isLight ? '#047857' : '#10b981') 
                    : isPending 
                    ? (isLight ? '#b45309' : '#fbbf24') 
                    : isFailed 
                    ? (isLight ? '#b91c1c' : '#f87171') 
                    : (isLight ? '#475569' : '#94a3b8');

                  const badgeBorder = isPaid 
                    ? 'rgba(16, 185, 129, 0.35)' 
                    : isPending 
                    ? 'rgba(245, 158, 11, 0.35)' 
                    : isFailed 
                    ? 'rgba(239, 68, 68, 0.35)' 
                    : 'rgba(148, 163, 184, 0.35)';

                  const reasonTooltip = h.failure_reason || h.gateway_response || undefined;

                  return (
                    <tr key={h._id || i} style={{ borderBottom: `1px solid ${themeColors.tableRowBorder}` }}>
                      <td style={{ padding: '12px 10px', fontFamily: 'monospace', color: '#0284c7', fontWeight: 600 }}>{h.receipt_number || h.reference}</td>
                      <td style={{ padding: '12px 10px', textTransform: 'capitalize', fontWeight: 600 }}>{h.plan}</td>
                      <td style={{ padding: '12px 10px', fontFamily: 'monospace', fontWeight: 800 }}>
                        {currency === 'USD' ? (
                          <span title={`KES ${h.amount_kes}`}>
                            ${(h.amount_kes / USD_TO_KES_RATE).toFixed(2)}
                          </span>
                        ) : (
                          `KES ${h.amount_kes}`
                        )}
                      </td>
                      <td style={{ padding: '12px 10px' }}>{h.payment_mode || h.channel}</td>
                      <td style={{ padding: '12px 10px' }}>
                        <span 
                          onClick={() => isPending && handleCheckStatus(h.reference)}
                          title={reasonTooltip}
                          style={{
                            padding: '3px 8px',
                            borderRadius: '5px',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            background: badgeBg,
                            color: badgeColor,
                            border: `1px solid ${badgeBorder}`,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            cursor: isPending ? 'pointer' : 'default'
                          }}
                        >
                          {isPending && <i className={`fa-solid fa-rotate ${verifyingRef === h.reference ? 'fa-spin' : ''}`} style={{ fontSize: '0.65rem' }}></i>}
                          {isPaid && <i className="fa-solid fa-check" style={{ fontSize: '0.65rem' }}></i>}
                          {isFailed && <i className="fa-solid fa-xmark" style={{ fontSize: '0.65rem' }}></i>}
                          {isCancelled && <i className="fa-solid fa-ban" style={{ fontSize: '0.65rem' }}></i>}
                          {rawStatus.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: '12px 10px', color: themeColors.tableTdMuted }}>
                        {h.created_at ? new Date(h.created_at).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Interactive Checkout Modal (Cleaned up, no Till, no Paystack Header) ── */}
      {checkoutModalOpen && (
        <div className="modal-overlay active" onClick={handleCloseCheckout} style={{ zIndex: 1200 }}>
          <div 
            className="modal-card" 
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '500px',
              background: themeColors.modalBg,
              border: `1px solid ${themeColors.modalBorder}`,
              borderRadius: '20px',
              padding: '28px',
              color: themeColors.textMain,
              boxShadow: themeColors.modalBoxShadow
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', borderBottom: `1px solid ${themeColors.tableHeaderBorder}`, paddingBottom: '14px' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: themeColors.textMain }}>
                  Activate {selectedPlanKey === 'pro' ? 'Pro Tier' : 'Starter Tier'}
                </h3>
                <p style={{ color: themeColors.textMuted, fontSize: '0.82rem', margin: '4px 0 0' }}>
                  Select your preferred payment method to proceed.
                </p>
              </div>
              <button onClick={handleCloseCheckout} style={{ background: 'transparent', border: 'none', color: themeColors.textMuted, fontSize: '1.2rem', cursor: 'pointer' }}>
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            {/* Payment Method Selector Tabs (2 clean options: M-Pesa STK & Card) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginBottom: '20px' }}>
              <button
                type="button"
                onClick={() => setPaymentMethod('mpesa_stk')}
                style={{
                  padding: '12px 10px',
                  borderRadius: '12px',
                  border: paymentMethod === 'mpesa_stk' ? '1px solid #10b981' : `1px solid ${themeColors.borderLight}`,
                  background: paymentMethod === 'mpesa_stk' ? 'rgba(16, 185, 129, 0.15)' : themeColors.inputBg,
                  color: paymentMethod === 'mpesa_stk' ? '#10b981' : themeColors.textMuted,
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <i className="fa-solid fa-mobile-screen-button" style={{ fontSize: '1.2rem' }}></i>
                <span>M-Pesa STK</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('card')}
                style={{
                  padding: '12px 10px',
                  borderRadius: '12px',
                  border: paymentMethod === 'card' ? '1px solid #00d4ff' : `1px solid ${themeColors.borderLight}`,
                  background: paymentMethod === 'card' ? 'rgba(0, 212, 255, 0.15)' : themeColors.inputBg,
                  color: paymentMethod === 'card' ? '#00d4ff' : themeColors.textMuted,
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <i className="fa-solid fa-credit-card" style={{ fontSize: '1.2rem' }}></i>
                <span>Visa / Card</span>
              </button>
            </div>

            {/* Option 1: M-Pesa STK Push */}
            {paymentMethod === 'mpesa_stk' && (
              <div style={{ marginBottom: '22px' }}>
                <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '12px', padding: '14px', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981', fontWeight: 700, fontSize: '0.85rem', marginBottom: '4px' }}>
                    <i className="fa-solid fa-bolt"></i> Instant M-Pesa STK Prompt
                  </div>
                  <p style={{ color: themeColors.textMuted, fontSize: '0.8rem', margin: 0, lineHeight: 1.5 }}>
                    Enter your Safaricom phone number. A PIN prompt will pop up on your phone automatically.
                  </p>
                </div>

                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: themeColors.textMuted, marginBottom: '8px' }}>
                  Safaricom Phone Number
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="tel"
                    placeholder="e.g. 0712345678 or 2547..."
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    disabled={Boolean(stkStatus)}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      background: stkStatus ? themeColors.tagBg : themeColors.inputBg,
                      border: `1px solid ${themeColors.inputBorder}`,
                      color: themeColors.textMain,
                      fontSize: '0.9rem',
                      fontFamily: 'monospace',
                      opacity: stkStatus ? 0.7 : 1
                    }}
                  />
                </div>

                {/* Active M-Pesa STK Prompt Message */}
                {stkStatus && (
                  <div style={{ 
                    marginTop: '12px', 
                    padding: '12px 14px', 
                    borderRadius: '10px', 
                    background: 'rgba(0, 212, 255, 0.1)', 
                    border: '1px solid rgba(0, 212, 255, 0.3)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between', 
                    gap: '10px' 
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0284c7', fontSize: '0.84rem' }}>
                      <i className="fa-solid fa-spinner fa-spin"></i>
                      <span>Enter your M-Pesa PIN on your phone ({countdown}s)</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleCancelStk}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#f87171',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        padding: 0
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                )}

                {/* Necessary Failure / Cancel Message */}
                {stkError && !stkStatus && (
                  <div style={{
                    marginTop: '12px',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: isLight ? '#b91c1c' : '#fca5a5',
                    fontSize: '0.84rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <i className="fa-solid fa-circle-exclamation" style={{ color: '#f87171' }}></i>
                      <span>{stkError}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setStkError(null)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: themeColors.textMuted,
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        padding: 0
                      }}
                    >
                      <i className="fa-solid fa-xmark"></i>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Option 2: Card Checkout */}
            {paymentMethod === 'card' && (
              <div style={{ marginBottom: '22px' }}>
                <div style={{ background: 'rgba(0, 212, 255, 0.08)', border: '1px solid rgba(0, 212, 255, 0.25)', borderRadius: '12px', padding: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#00d4ff', fontWeight: 700, fontSize: '0.85rem', marginBottom: '4px' }}>
                    <i className="fa-solid fa-shield-halved"></i> Encrypted Checkout
                  </div>
                  <p style={{ color: themeColors.textMuted, fontSize: '0.8rem', margin: 0, lineHeight: 1.5 }}>
                    You will be securely routed to complete payment with Visa, Mastercard, or Bank Transfer.
                  </p>
                </div>
              </div>
            )}

            {/* Total and Submit CTA */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '16px', borderTop: `1px solid ${themeColors.tableHeaderBorder}` }}>
              <div>
                <span style={{ fontSize: '0.72rem', color: themeColors.textMuted }}>Total Payable</span>
                <div style={{ fontSize: '1.25rem', fontWeight: 900, color: themeColors.textMain, fontFamily: 'monospace' }}>
                  {formatPriceDisplay(selectedPlanKey === 'pro' ? 2299 : 899)}
                </div>
              </div>

              <button
                onClick={handleInitiatePayment}
                disabled={processing || Boolean(stkStatus)}
                style={{
                  padding: '12px 28px',
                  borderRadius: '12px',
                  background: stkStatus ? themeColors.tagBg : 'linear-gradient(135deg, #00d4ff, #0088cc)',
                  color: stkStatus ? themeColors.textMuted : '#040d1a',
                  fontWeight: 800,
                  fontSize: '0.9rem',
                  border: stkStatus ? `1px solid ${themeColors.borderLight}` : 'none',
                  cursor: (processing || stkStatus) ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: stkStatus ? 'none' : '0 4px 18px rgba(0, 212, 255, 0.4)'
                }}
              >
                {stkStatus ? (
                  <>
                    <i className="fa-solid fa-mobile-screen-button"></i>
                    <span>Waiting for PIN ({countdown}s)...</span>
                  </>
                ) : processing ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin"></i>
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <span>Pay {formatPriceDisplay(selectedPlanKey === 'pro' ? 2299 : 899)}</span>
                    <i className="fa-solid fa-arrow-right"></i>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Celebration / Receipt Modal ─────────────────────────────────────── */}
      {celebrationModalOpen && (
        <div className="modal-overlay active" onClick={() => setCelebrationModalOpen(false)} style={{ zIndex: 1300 }}>
          <div
            className="modal-card"
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '480px',
              textAlign: 'center',
              padding: '36px 28px',
              borderRadius: '24px',
              background: themeColors.modalBg,
              border: '1px solid rgba(16, 185, 129, 0.4)',
              boxShadow: themeColors.modalBoxShadow,
              color: themeColors.textMain
            }}
          >
            <div style={{
              width: '68px',
              height: '68px',
              borderRadius: '50%',
              background: 'rgba(16, 185, 129, 0.2)',
              color: '#10b981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '2rem',
              margin: '0 auto 18px',
              border: '2px solid rgba(16, 185, 129, 0.4)'
            }}>
              <i className="fa-solid fa-crown" style={{ color: '#e8c97a' }}></i>
            </div>

            <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: themeColors.textMain, margin: '0 0 6px' }}>
              Welcome to {receiptData?.name || 'Your Upgraded Tier'}!
            </h3>
            <p style={{ color: themeColors.textMuted, fontSize: '0.88rem', margin: '0 0 20px', lineHeight: 1.5 }}>
              Your payment has been successfully recorded. All tier features, capacity limits, and intelligence modules are now live.
            </p>

            <div style={{ background: themeColors.tagBg, border: `1px solid ${themeColors.borderLight}`, borderRadius: '14px', padding: '16px', marginBottom: '24px', textAlign: 'left', fontSize: '0.82rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: themeColors.textMuted }}>Receipt Number:</span>
                <span style={{ color: '#0284c7', fontFamily: 'monospace', fontWeight: 700 }}>{receiptData?.receipt_number || 'AXIS-REC-PAID'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: themeColors.textMuted }}>Amount Paid:</span>
                <span style={{ color: themeColors.textMain, fontWeight: 800, fontFamily: 'monospace' }}>
                  {receiptData?.amount_kes ? formatPriceDisplay(receiptData.amount_kes) : '—'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: themeColors.textMuted }}>Active Until:</span>
                <span style={{ color: '#10b981', fontWeight: 700 }}>{receiptData?.expires_at ? new Date(receiptData.expires_at).toLocaleDateString() : 'Active'}</span>
              </div>
            </div>

            <button
              onClick={() => setCelebrationModalOpen(false)}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #10b981, #059669)',
                color: '#fff',
                fontSize: '0.9rem',
                fontWeight: 800,
                border: 'none',
                cursor: 'pointer'
              }}
            >
              Continue to Workspace
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BillingPage;
