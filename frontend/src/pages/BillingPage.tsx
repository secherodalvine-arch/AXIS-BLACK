import React, { useState, useEffect, useCallback } from 'react';
import { UserSubscription, PlanKey } from '../types';
import { 
  getSubscriptionApi, 
  getPlansApi, 
  initiatePaymentApi, 
  verifyPaymentApi, 
  getTillInfoApi, 
  submitTillPaymentApi, 
  extendDailyLimitApi,
  getPaymentHistoryApi 
} from '../utils/api';

interface BillingPageProps {
  user?: any;
  currency?: string;
  onRefreshUserData?: () => void;
  showToast?: (msg: string) => void;
}

export const BillingPage: React.FC<BillingPageProps> = ({
  user: _user,
  currency: _currency = 'KES',
  onRefreshUserData,
  showToast = (msg: string) => console.log(msg)
}) => {
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [, setPlans] = useState<Record<string, any>>({});
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tillInfo, setTillInfo] = useState<{ till: string; name: string; instructions: string } | null>(null);

  // Checkout modal states
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [selectedPlanKey, setSelectedPlanKey] = useState<PlanKey>('starter');
  const [paymentMethod, setPaymentMethod] = useState<'mpesa_stk' | 'card' | 'mpesa_till'>('mpesa_stk');
  const [phone, setPhone] = useState('');
  const [tillRef, setTillRef] = useState('');
  const [tillPhone, setTillPhone] = useState('');
  const [processing, setProcessing] = useState(false);
  const [stkStatus, setStkStatus] = useState<string | null>(null);
  const [pendingRef, setPendingRef] = useState<string | null>(null);
  const [celebrationModalOpen, setCelebrationModalOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<any>(null);

  // Load active subscription, plans, and till info
  const loadSubscriptionData = useCallback(async () => {
    try {
      const [subData, plansData, histData, tillData] = await Promise.all([
        getSubscriptionApi().catch(() => null),
        getPlansApi().catch(() => null),
        getPaymentHistoryApi().catch(() => []),
        getTillInfoApi().catch(() => null)
      ]);

      if (subData) setSubscription(subData);
      if (plansData?.plans) setPlans(plansData.plans);
      if (histData) setHistory(histData);
      if (tillData) setTillInfo(tillData);
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
            // Clean URL query param
            const cleanUrl = window.location.origin + window.location.pathname;
            window.history.replaceState({}, document.title, cleanUrl);
          }
        })
        .catch((err: any) => {
          console.warn('Callback verification note:', err);
        })
        .finally(() => setProcessing(false));
    }
  }, [showToast]);

  // Polling after M-Pesa STK prompt is sent
  useEffect(() => {
    if (!pendingRef || !checkoutModalOpen) return;
    let cancelled = false;
    let attempts = 0;

    const interval = setInterval(async () => {
      attempts += 1;
      if (attempts > 20 || cancelled) {
        clearInterval(interval);
        return;
      }
      try {
        const verifyRes = await verifyPaymentApi(pendingRef);
        if (verifyRes?.status === 'success' && !cancelled) {
          clearInterval(interval);
          setSubscription(verifyRes.data);
          setReceiptData(verifyRes.data);
          setCheckoutModalOpen(false);
          setCelebrationModalOpen(true);
          setStkStatus(null);
          setPendingRef(null);
          showToast(`M-Pesa payment confirmed! ${verifyRes.data?.name} activated.`);
          if (onRefreshUserData) onRefreshUserData();
        }
      } catch (err) {
        // Continue polling until expiration
      }
    }, 3500);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [pendingRef, checkoutModalOpen, onRefreshUserData, showToast]);

  // Open checkout modal for a plan
  const handleOpenCheckout = (planKey: PlanKey) => {
    setSelectedPlanKey(planKey);
    setStkStatus(null);
    setPendingRef(null);
    setCheckoutModalOpen(true);
  };

  // Submit Payment
  const handleInitiatePayment = async () => {
    setProcessing(true);
    setStkStatus(null);

    try {
      if (paymentMethod === 'card') {
        const res = await initiatePaymentApi(selectedPlanKey, 'card');
        if (res?.authorization_url) {
          showToast('Redirecting to Paystack Secure Checkout...');
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
          setStkStatus(`Prompt sent to ${rawPhone}. Enter your M-Pesa PIN on your phone.`);
          showToast(`M-Pesa prompt dispatched to ${rawPhone}`);
        }
      } else if (paymentMethod === 'mpesa_till') {
        if (!tillRef.trim()) {
          showToast('Please enter the M-Pesa transaction code from your SMS.');
          setProcessing(false);
          return;
        }
        const res = await submitTillPaymentApi(selectedPlanKey, tillRef.trim(), tillPhone.trim());
        showToast(res?.message || 'M-Pesa reference submitted for verification.');
        setCheckoutModalOpen(false);
        setTillRef('');
        setTillPhone('');
        await loadSubscriptionData();
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
      <div className="tab-view active" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: '#94a3b8', flexDirection: 'column', gap: '16px' }}>
        <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '2.4rem', color: '#00d4ff' }}></i>
        <div style={{ fontSize: '0.95rem', fontWeight: 600 }}>Loading subscription status &amp; packages...</div>
      </div>
    );
  }

  return (
    <div className="tab-view active" style={{ maxWidth: '1200px', margin: '0 auto', paddingBottom: '60px' }}>
      
      {/* ── Page Header ────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px', marginBottom: '28px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, letterSpacing: '1.5px', color: '#00d4ff', textTransform: 'uppercase' }}>
              Financial Intelligence Workspace
            </span>
            <span style={{
              fontSize: '0.7rem',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: '6px',
              background: currentPlanKey === 'pro' ? 'rgba(201, 169, 110, 0.2)' : currentPlanKey === 'starter' ? 'rgba(0, 212, 255, 0.2)' : 'rgba(255, 255, 255, 0.08)',
              color: currentPlanKey === 'pro' ? '#e8c97a' : currentPlanKey === 'starter' ? '#00d4ff' : '#94a3b8',
              border: `1px solid ${currentPlanKey === 'pro' ? 'rgba(201, 169, 110, 0.4)' : currentPlanKey === 'starter' ? 'rgba(0, 212, 255, 0.4)' : 'rgba(255, 255, 255, 0.15)'}`
            }}>
              {subscription?.name ? subscription.name.toUpperCase() : 'FREE TIER'}
            </span>
          </div>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 800, color: '#fff', margin: 0, letterSpacing: '-0.5px' }}>
            Upgrade &amp; Billing Management
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: '6px 0 0' }}>
            Manage active packages, live usage quotas, M-Pesa and Card payments powered by Paystack
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
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6ee7b7' }}>Subscription Active</div>
              <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#fff' }}>
                {subscription.days_left} days remaining
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Active Plan Status & Live Resource Meters Strip ────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: '16px',
        marginBottom: '36px'
      }}>
        {/* Card 1: Axis Agent Chat Quota */}
        <div className="glass-card" style={{ padding: '20px', borderRadius: '16px', border: '1px solid rgba(0, 212, 255, 0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(0, 212, 255, 0.15)', color: '#00d4ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="fa-solid fa-brain"></i>
              </div>
              <div>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#fff' }}>Axis Agent Queries</span>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Today's Usage</div>
              </div>
            </div>
            <span style={{
              fontSize: '0.72rem',
              fontWeight: 800,
              padding: '2px 8px',
              borderRadius: '6px',
              background: chatUsage?.daily_limit_reached ? 'rgba(239, 68, 68, 0.2)' : 'rgba(0, 212, 255, 0.1)',
              color: chatUsage?.daily_limit_reached ? '#ef4444' : '#00d4ff'
            }}>
              {chatUsage?.used_today || 0} / {chatUsage?.daily_limit || 8}
            </span>
          </div>

          {/* Progress Bar */}
          <div style={{ width: '100%', height: '6px', borderRadius: '4px', background: 'rgba(255, 255, 255, 0.08)', overflow: 'hidden', marginBottom: '8px' }}>
            <div style={{
              width: `${Math.min(100, (((chatUsage?.used_today || 0) / (chatUsage?.daily_limit || 8)) * 100))}%`,
              height: '100%',
              background: chatUsage?.daily_limit_reached ? '#ef4444' : 'linear-gradient(90deg, #00d4ff, #7c5fe6)',
              borderRadius: '4px',
              transition: 'width 0.3s ease'
            }} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#64748b' }}>
            <span>Monthly: {chatUsage?.used_month || 0} / {chatUsage?.monthly_limit || 240}</span>
            <span>{chatUsage?.is_extended ? '⚡ Extended' : 'Standard'}</span>
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
        <div className="glass-card" style={{ padding: '20px', borderRadius: '16px', border: '1px solid rgba(124, 95, 230, 0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(124, 95, 230, 0.15)', color: '#a78bfa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="fa-solid fa-microphone-lines"></i>
              </div>
              <div>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#fff' }}>Voice Support Agent</span>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Conversational AI</div>
              </div>
            </div>
            <span style={{
              fontSize: '0.72rem',
              fontWeight: 800,
              padding: '2px 8px',
              borderRadius: '6px',
              background: currentPlanKey === 'free' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(124, 95, 230, 0.15)',
              color: currentPlanKey === 'free' ? '#94a3b8' : '#a78bfa'
            }}>
              {currentPlanKey === 'free' ? 'LOCKED' : `${voiceUsage?.used_today || 0} / ${voiceUsage?.daily_limit || 13}`}
            </span>
          </div>

          <div style={{ width: '100%', height: '6px', borderRadius: '4px', background: 'rgba(255, 255, 255, 0.08)', overflow: 'hidden', marginBottom: '8px' }}>
            <div style={{
              width: currentPlanKey === 'free' ? '0%' : `${Math.min(100, (((voiceUsage?.used_today || 0) / (voiceUsage?.daily_limit || 13)) * 100))}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #7c5fe6, #c084fc)',
              borderRadius: '4px'
            }} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#64748b' }}>
            <span>{currentPlanKey === 'free' ? 'Available on Starter & Pro' : `Monthly: ${voiceUsage?.used_month || 0} / ${voiceUsage?.monthly_limit || 400}`}</span>
            <span>{voiceUsage?.is_extended ? '⚡ Extended' : ''}</span>
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
        <div className="glass-card" style={{ padding: '20px', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.08)', color: '#38bdf8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="fa-solid fa-building"></i>
              </div>
              <div>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#fff' }}>Branch Locations</span>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Multi-store network</div>
              </div>
            </div>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#38bdf8' }}>
              {resources?.branches_limit === -1 ? 'UNLIMITED' : `${resources?.branches_count || 1} / ${resources?.branches_limit || 1}`}
            </span>
          </div>
          <div style={{ fontSize: '0.82rem', color: '#cbd5e1', lineHeight: 1.5, marginTop: '8px' }}>
            {resources?.branches_limit === -1 
              ? 'Multi-branch operations enabled without any store restriction.' 
              : 'Free tier includes 1 active branch. Upgrade to unlock multi-location.'}
          </div>
        </div>

        {/* Card 4: Inventory SKUs */}
        <div className="glass-card" style={{ padding: '20px', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="fa-solid fa-boxes-stacked"></i>
              </div>
              <div>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#fff' }}>Inventory Items</span>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Catalog SKUs</div>
              </div>
            </div>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#fbbf24' }}>
              {resources?.inventory_limit === -1 ? 'UNLIMITED' : `${resources?.inventory_count || 0} / ${resources?.inventory_limit || 2}`}
            </span>
          </div>
          <div style={{ fontSize: '0.82rem', color: '#cbd5e1', lineHeight: 1.5, marginTop: '8px' }}>
            {resources?.inventory_limit === -1 
              ? 'Unlimited warehouse catalog & automatic reorder alerts.' 
              : 'Free tier allows up to 2 items. Upgrade for full inventory & CSV import.'}
          </div>
        </div>
      </div>

      {/* ── Pricing Tier Cards (The Core 3 Packages) ───────────────────────── */}
      <div style={{ marginBottom: '40px' }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#fff', margin: '0 0 8px' }}>
            Choose the Package Tailored for Your Growth
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem', maxWidth: '580px', margin: '0 auto' }}>
            Seamless upgrades with local M-Pesa STK Push or instant Card checkout powered by Paystack.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '24px',
          alignItems: 'stretch'
        }}>
          {/* TIER 1: FREE */}
          <div className="glass-card" style={{
            borderRadius: '20px',
            padding: '30px 24px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            border: currentPlanKey === 'free' ? '1px solid rgba(255, 255, 255, 0.25)' : '1px solid rgba(255, 255, 255, 0.08)',
            background: 'rgba(14, 20, 32, 0.6)'
          }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff' }}>Free</span>
                {currentPlanKey === 'free' && (
                  <span style={{ fontSize: '0.65rem', fontWeight: 800, padding: '3px 8px', borderRadius: '6px', background: 'rgba(255, 255, 255, 0.1)', color: '#cbd5e1' }}>
                    CURRENT PLAN
                  </span>
                )}
              </div>
              <p style={{ color: '#94a3b8', fontSize: '0.85rem', lineHeight: 1.5, minHeight: '40px' }}>
                Essential runway simulator and basic exploration for solo entrepreneurs.
              </p>
              <div style={{ margin: '20px 0 24px', fontFamily: 'monospace' }}>
                <span style={{ fontSize: '2rem', fontWeight: 900, color: '#fff' }}>KES 0</span>
                <span style={{ color: '#64748b', fontSize: '0.85rem' }}> / forever</span>
              </div>

              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>
                Included Capabilities
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '0.85rem', color: '#cbd5e1' }}>
                <li style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '10px' }}>
                  <i className="fa-solid fa-check" style={{ color: '#00d4ff', marginTop: '3px' }}></i>
                  <span>Create business profile</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '10px' }}>
                  <i className="fa-solid fa-check" style={{ color: '#00d4ff', marginTop: '3px' }}></i>
                  <span>Create 1 branch location</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '10px' }}>
                  <i className="fa-solid fa-check" style={{ color: '#00d4ff', marginTop: '3px' }}></i>
                  <span>Runway Simulator &amp; hiring models</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '10px' }}>
                  <i className="fa-solid fa-check" style={{ color: '#00d4ff', marginTop: '3px' }}></i>
                  <span>Inventory manager (2 items limit)</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '10px' }}>
                  <i className="fa-solid fa-check" style={{ color: '#00d4ff', marginTop: '3px' }}></i>
                  <span>Axis Agent (up to 8 queries/day, 240/mo)</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', color: '#64748b', marginBottom: '10px' }}>
                  <i className="fa-solid fa-xmark" style={{ marginTop: '3px' }}></i>
                  <span>Interactive spreadsheet locked</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', color: '#64748b' }}>
                  <i className="fa-solid fa-xmark" style={{ marginTop: '3px' }}></i>
                  <span>Voice agent &amp; Team roles locked</span>
                </li>
              </ul>
            </div>

            <div style={{ marginTop: '28px' }}>
              <button
                disabled={currentPlanKey === 'free'}
                className="action-btn-secondary"
                style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
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
            background: 'linear-gradient(145deg, rgba(0, 212, 255, 0.08), rgba(14, 20, 32, 0.95))',
            border: currentPlanKey === 'starter' ? '2px solid #00d4ff' : '1px solid rgba(0, 212, 255, 0.35)',
            boxShadow: '0 12px 36px rgba(0, 212, 255, 0.12)'
          }}>
            <div style={{ position: 'absolute', top: '-11px', right: '20px', background: '#00d4ff', color: '#040d1a', fontSize: '0.65rem', fontWeight: 900, padding: '3px 10px', borderRadius: '8px', letterSpacing: '0.5px' }}>
              MOST POPULAR
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '1.35rem', fontWeight: 800, color: '#00d4ff' }}>Starter</span>
                {currentPlanKey === 'starter' && (
                  <span style={{ fontSize: '0.65rem', fontWeight: 800, padding: '3px 8px', borderRadius: '6px', background: 'rgba(0, 212, 255, 0.2)', color: '#00d4ff' }}>
                    CURRENT PLAN
                  </span>
                )}
              </div>
              <p style={{ color: '#94a3b8', fontSize: '0.85rem', lineHeight: 1.5, minHeight: '40px' }}>
                Complete operations suite with interactive spreadsheet, voice AI, and multi-branch team collaboration.
              </p>
              <div style={{ margin: '20px 0 24px', fontFamily: 'monospace' }}>
                <span style={{ fontSize: '2.1rem', fontWeight: 900, color: '#fff' }}>KES 899</span>
                <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}> / month</span>
              </div>

              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#00d4ff', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>
                All in Free, Plus:
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '0.85rem', color: '#cbd5e1' }}>
                <li style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '10px' }}>
                  <i className="fa-solid fa-check" style={{ color: '#00d4ff', marginTop: '3px' }}></i>
                  <span><strong>Unlimited branches</strong> &amp; locations</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '10px' }}>
                  <i className="fa-solid fa-check" style={{ color: '#00d4ff', marginTop: '3px' }}></i>
                  <span><strong>Team members &amp; roles assignment</strong></span>
                </li>
                <li style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '10px' }}>
                  <i className="fa-solid fa-check" style={{ color: '#00d4ff', marginTop: '3px' }}></i>
                  <span><strong>Interactive Spreadsheet feature</strong></span>
                </li>
                <li style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '10px' }}>
                  <i className="fa-solid fa-check" style={{ color: '#00d4ff', marginTop: '3px' }}></i>
                  <span><strong>Unlimited Inventory &amp; Ledger</strong> entries</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '10px' }}>
                  <i className="fa-solid fa-check" style={{ color: '#00d4ff', marginTop: '3px' }}></i>
                  <span><strong>Business Summary feature</strong> (6 PM dispatch)</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '10px' }}>
                  <i className="fa-solid fa-check" style={{ color: '#00d4ff', marginTop: '3px' }}></i>
                  <span><strong>Voice Agent</strong> (up to 400/mo, 13 max daily)</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <i className="fa-solid fa-check" style={{ color: '#00d4ff', marginTop: '3px' }}></i>
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
                  color: currentPlanKey === 'starter' ? '#00d4ff' : '#040d1a',
                  fontWeight: 800,
                  fontSize: '0.9rem',
                  border: 'none',
                  cursor: currentPlanKey === 'starter' ? 'default' : 'pointer',
                  boxShadow: currentPlanKey === 'starter' ? 'none' : '0 4px 20px rgba(0, 212, 255, 0.4)',
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
            background: 'linear-gradient(145deg, rgba(201, 169, 110, 0.09), rgba(124, 95, 230, 0.08), rgba(14, 20, 32, 0.95))',
            border: currentPlanKey === 'pro' ? '2px solid #e8c97a' : '1px solid rgba(201, 169, 110, 0.4)',
            boxShadow: '0 12px 36px rgba(201, 169, 110, 0.15)'
          }}>
            <div style={{ position: 'absolute', top: '-11px', right: '20px', background: 'linear-gradient(135deg, #e8c97a, #c9a96e)', color: '#000', fontSize: '0.65rem', fontWeight: 900, padding: '3px 10px', borderRadius: '8px', letterSpacing: '0.5px' }}>
              BEST VALUE (3 MONTHS)
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '1.35rem', fontWeight: 800, color: '#e8c97a' }}>Pro</span>
                  <i className="fa-solid fa-crown" style={{ color: '#e8c97a', fontSize: '1rem' }}></i>
                </div>
                {currentPlanKey === 'pro' && (
                  <span style={{ fontSize: '0.65rem', fontWeight: 800, padding: '3px 8px', borderRadius: '6px', background: 'rgba(201, 169, 110, 0.2)', color: '#e8c97a' }}>
                    CURRENT PLAN
                  </span>
                )}
              </div>
              <p style={{ color: '#94a3b8', fontSize: '0.85rem', lineHeight: 1.5, minHeight: '40px' }}>
                High-capacity power tier for multi-branch companies requiring double daily AI extensions and VIP priority care.
              </p>
              <div style={{ margin: '20px 0 24px', fontFamily: 'monospace' }}>
                <span style={{ fontSize: '2.1rem', fontWeight: 900, color: '#e8c97a' }}>KES 2,299</span>
                <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}> / 3 months</span>
              </div>

              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#e8c97a', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>
                All in Starter, Plus:
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '0.85rem', color: '#cbd5e1' }}>
                <li style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '10px' }}>
                  <i className="fa-solid fa-star" style={{ color: '#e8c97a', marginTop: '3px' }}></i>
                  <span><strong>Priority VIP Customer Support</strong></span>
                </li>
                <li style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '10px' }}>
                  <i className="fa-solid fa-bolt" style={{ color: '#e8c97a', marginTop: '3px' }}></i>
                  <span>Axis Agent (1,200/mo, 40 daily max)</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '10px' }}>
                  <i className="fa-solid fa-angles-up" style={{ color: '#e8c97a', marginTop: '3px' }}></i>
                  <span><strong>Can extend by DOUBLE (+40 daily)</strong> when daily limit reached</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '10px' }}>
                  <i className="fa-solid fa-microphone-lines" style={{ color: '#e8c97a', marginTop: '3px' }}></i>
                  <span>Voice Agent (800/mo, 26 daily max)</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '10px' }}>
                  <i className="fa-solid fa-plus" style={{ color: '#e8c97a', marginTop: '3px' }}></i>
                  <span><strong>Can extend Voice by quarter (+7 daily)</strong> when daily limit reached</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <i className="fa-solid fa-check" style={{ color: '#e8c97a', marginTop: '3px' }}></i>
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
                  color: currentPlanKey === 'pro' ? '#e8c97a' : '#040d1a',
                  fontWeight: 900,
                  fontSize: '0.9rem',
                  border: 'none',
                  cursor: currentPlanKey === 'pro' ? 'default' : 'pointer',
                  boxShadow: currentPlanKey === 'pro' ? 'none' : '0 4px 20px rgba(201, 169, 110, 0.4)',
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
      <div className="glass-card" style={{ padding: '28px', borderRadius: '20px', marginBottom: '40px' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <i className="fa-solid fa-table-list" style={{ color: '#00d4ff' }}></i> Comprehensive Feature Comparison
        </h3>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', textAlign: 'left', color: '#94a3b8' }}>
                <th style={{ padding: '12px 14px' }}>Feature Capability</th>
                <th style={{ padding: '12px 14px', width: '22%' }}>Free</th>
                <th style={{ padding: '12px 14px', width: '25%', color: '#00d4ff' }}>Starter (899 KES/mo)</th>
                <th style={{ padding: '12px 14px', width: '25%', color: '#e8c97a' }}>Pro (2,299 KES/3 mo)</th>
              </tr>
            </thead>
            <tbody style={{ color: '#cbd5e1' }}>
              <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <td style={{ padding: '12px 14px' }}>Business Creation</td>
                <td style={{ padding: '12px 14px', color: '#10b981' }}><i className="fa-solid fa-check"></i> Yes</td>
                <td style={{ padding: '12px 14px', color: '#10b981' }}><i className="fa-solid fa-check"></i> Yes</td>
                <td style={{ padding: '12px 14px', color: '#10b981' }}><i className="fa-solid fa-check"></i> Yes</td>
              </tr>
              <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <td style={{ padding: '12px 14px' }}>Branch Locations</td>
                <td style={{ padding: '12px 14px' }}>1 Branch</td>
                <td style={{ padding: '12px 14px', color: '#00d4ff', fontWeight: 700 }}>Unlimited</td>
                <td style={{ padding: '12px 14px', color: '#e8c97a', fontWeight: 700 }}>Unlimited</td>
              </tr>
              <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <td style={{ padding: '12px 14px' }}>Runway Scenario Simulator</td>
                <td style={{ padding: '12px 14px', color: '#10b981' }}><i className="fa-solid fa-check"></i> Yes</td>
                <td style={{ padding: '12px 14px', color: '#10b981' }}><i className="fa-solid fa-check"></i> Yes</td>
                <td style={{ padding: '12px 14px', color: '#10b981' }}><i className="fa-solid fa-check"></i> Yes</td>
              </tr>
              <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <td style={{ padding: '12px 14px' }}>Inventory SKUs Limit</td>
                <td style={{ padding: '12px 14px' }}>2 Uploads</td>
                <td style={{ padding: '12px 14px', color: '#00d4ff', fontWeight: 700 }}>Unlimited</td>
                <td style={{ padding: '12px 14px', color: '#e8c97a', fontWeight: 700 }}>Unlimited</td>
              </tr>
              <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <td style={{ padding: '12px 14px' }}>Interactive Spreadsheet Engine</td>
                <td style={{ padding: '12px 14px', color: '#64748b' }}><i className="fa-solid fa-lock"></i> Locked</td>
                <td style={{ padding: '12px 14px', color: '#10b981' }}><i className="fa-solid fa-check"></i> Included</td>
                <td style={{ padding: '12px 14px', color: '#10b981' }}><i className="fa-solid fa-check"></i> Included</td>
              </tr>
              <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <td style={{ padding: '12px 14px' }}>Team Members &amp; Role Assignments</td>
                <td style={{ padding: '12px 14px', color: '#64748b' }}><i className="fa-solid fa-lock"></i> Locked</td>
                <td style={{ padding: '12px 14px', color: '#10b981' }}><i className="fa-solid fa-check"></i> Included</td>
                <td style={{ padding: '12px 14px', color: '#10b981' }}><i className="fa-solid fa-check"></i> Included</td>
              </tr>
              <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <td style={{ padding: '12px 14px' }}>Business Summary Feature</td>
                <td style={{ padding: '12px 14px', color: '#64748b' }}><i className="fa-solid fa-lock"></i> Locked</td>
                <td style={{ padding: '12px 14px', color: '#10b981' }}><i className="fa-solid fa-check"></i> Included</td>
                <td style={{ padding: '12px 14px', color: '#10b981' }}><i className="fa-solid fa-check"></i> Included</td>
              </tr>
              <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <td style={{ padding: '12px 14px' }}>Axis AI Chat Queries</td>
                <td style={{ padding: '12px 14px' }}>8/day (240/mo)</td>
                <td style={{ padding: '12px 14px' }}>20/day (600/mo)</td>
                <td style={{ padding: '12px 14px', color: '#e8c97a', fontWeight: 700 }}>40/day (1,200/mo)</td>
              </tr>
              <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <td style={{ padding: '12px 14px' }}>AI Daily Limit Double Extension</td>
                <td style={{ padding: '12px 14px', color: '#64748b' }}>No</td>
                <td style={{ padding: '12px 14px', color: '#64748b' }}>No</td>
                <td style={{ padding: '12px 14px', color: '#e8c97a', fontWeight: 800 }}>⚡ Double to 80/day</td>
              </tr>
              <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <td style={{ padding: '12px 14px' }}>Voice Support Agent</td>
                <td style={{ padding: '12px 14px', color: '#64748b' }}><i className="fa-solid fa-lock"></i> Locked</td>
                <td style={{ padding: '12px 14px' }}>13/day (400/mo)</td>
                <td style={{ padding: '12px 14px', color: '#e8c97a' }}>26/day (800/mo)</td>
              </tr>
              <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <td style={{ padding: '12px 14px' }}>Voice Daily Limit Quarter Extension</td>
                <td style={{ padding: '12px 14px', color: '#64748b' }}>No</td>
                <td style={{ padding: '12px 14px', color: '#64748b' }}>No</td>
                <td style={{ padding: '12px 14px', color: '#e8c97a', fontWeight: 800 }}>⚡ +7 queries daily</td>
              </tr>
              <tr>
                <td style={{ padding: '12px 14px' }}>Support Escalation</td>
                <td style={{ padding: '12px 14px' }}>Community</td>
                <td style={{ padding: '12px 14px' }}>Standard Email</td>
                <td style={{ padding: '12px 14px', color: '#e8c97a', fontWeight: 800 }}>Priority VIP Care</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Transaction History ────────────────────────────────────────────── */}
      {history.length > 0 && (
        <div className="glass-card" style={{ padding: '24px', borderRadius: '20px' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#fff', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fa-solid fa-receipt" style={{ color: '#00d4ff' }}></i> Payment &amp; Receipt Records
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', color: '#94a3b8', textAlign: 'left' }}>
                  <th style={{ padding: '10px' }}>Receipt #</th>
                  <th style={{ padding: '10px' }}>Plan</th>
                  <th style={{ padding: '10px' }}>Amount KES</th>
                  <th style={{ padding: '10px' }}>Channel</th>
                  <th style={{ padding: '10px' }}>Status</th>
                  <th style={{ padding: '10px' }}>Date</th>
                </tr>
              </thead>
              <tbody style={{ color: '#cbd5e1' }}>
                {history.map((h, i) => (
                  <tr key={h._id || i} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <td style={{ padding: '10px', fontFamily: 'monospace', color: '#00d4ff' }}>{h.receipt_number || h.reference}</td>
                    <td style={{ padding: '10px', textTransform: 'capitalize' }}>{h.plan}</td>
                    <td style={{ padding: '10px', fontFamily: 'monospace', fontWeight: 700 }}>KES {h.amount_kes}</td>
                    <td style={{ padding: '10px' }}>{h.payment_mode || h.channel}</td>
                    <td style={{ padding: '10px' }}>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        background: h.status === 'paid' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(251, 191, 36, 0.2)',
                        color: h.status === 'paid' ? '#10b981' : '#fbbf24'
                      }}>
                        {h.status.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '10px', color: '#94a3b8' }}>{new Date(h.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Interactive Checkout Drawer / Modal ─────────────────────────────── */}
      {checkoutModalOpen && (
        <div className="modal-overlay active" onClick={() => setCheckoutModalOpen(false)} style={{ zIndex: 1200 }}>
          <div 
            className="modal-card" 
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '520px',
              background: 'linear-gradient(145deg, rgba(14, 20, 32, 0.98), rgba(9, 13, 22, 0.98))',
              border: '1px solid rgba(0, 212, 255, 0.3)',
              borderRadius: '20px',
              padding: '28px',
              color: '#fff'
            }}
          >
            {/* Modal Title */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '14px' }}>
              <div>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#00d4ff', letterSpacing: '1px' }}>PAYSTACK GATEWAY CHECKOUT</span>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '2px 0 0' }}>
                  Activate {selectedPlanKey === 'pro' ? 'Pro Tier (2,299 KES)' : 'Starter Tier (899 KES)'}
                </h3>
              </div>
              <button onClick={() => setCheckoutModalOpen(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '1.2rem', cursor: 'pointer' }}>
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            {/* Payment Method Selector Tabs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '20px' }}>
              <button
                type="button"
                onClick={() => setPaymentMethod('mpesa_stk')}
                style={{
                  padding: '12px 8px',
                  borderRadius: '12px',
                  border: paymentMethod === 'mpesa_stk' ? '1px solid #10b981' : '1px solid rgba(255, 255, 255, 0.1)',
                  background: paymentMethod === 'mpesa_stk' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                  color: paymentMethod === 'mpesa_stk' ? '#10b981' : '#94a3b8',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <i className="fa-solid fa-mobile-screen-button" style={{ fontSize: '1.1rem' }}></i>
                <span>M-Pesa STK</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('card')}
                style={{
                  padding: '12px 8px',
                  borderRadius: '12px',
                  border: paymentMethod === 'card' ? '1px solid #00d4ff' : '1px solid rgba(255, 255, 255, 0.1)',
                  background: paymentMethod === 'card' ? 'rgba(0, 212, 255, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                  color: paymentMethod === 'card' ? '#00d4ff' : '#94a3b8',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <i className="fa-solid fa-credit-card" style={{ fontSize: '1.1rem' }}></i>
                <span>Visa / Card</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('mpesa_till')}
                style={{
                  padding: '12px 8px',
                  borderRadius: '12px',
                  border: paymentMethod === 'mpesa_till' ? '1px solid #fbbf24' : '1px solid rgba(255, 255, 255, 0.1)',
                  background: paymentMethod === 'mpesa_till' ? 'rgba(251, 191, 36, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                  color: paymentMethod === 'mpesa_till' ? '#fbbf24' : '#94a3b8',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <i className="fa-solid fa-store" style={{ fontSize: '1.1rem' }}></i>
                <span>Buy Goods Till</span>
              </button>
            </div>

            {/* Method Content 1: M-Pesa STK Push */}
            {paymentMethod === 'mpesa_stk' && (
              <div style={{ marginBottom: '22px' }}>
                <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '12px', padding: '14px', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981', fontWeight: 700, fontSize: '0.85rem', marginBottom: '4px' }}>
                    <i className="fa-solid fa-bolt"></i> Instant M-Pesa STK Prompt
                  </div>
                  <p style={{ color: '#cbd5e1', fontSize: '0.8rem', margin: 0, lineHeight: 1.5 }}>
                    Enter your Safaricom phone number. A PIN prompt will pop up on your phone automatically.
                  </p>
                </div>

                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '8px' }}>
                  Safaricom Phone Number
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="tel"
                    placeholder="e.g. 0712345678 or 2547..."
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      color: '#fff',
                      fontSize: '0.9rem',
                      fontFamily: 'monospace'
                    }}
                  />
                </div>

                {stkStatus && (
                  <div style={{ marginTop: '12px', padding: '10px 14px', borderRadius: '8px', background: 'rgba(0, 212, 255, 0.15)', border: '1px solid rgba(0, 212, 255, 0.4)', color: '#00d4ff', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <i className="fa-solid fa-spinner fa-spin"></i>
                    <span>{stkStatus}</span>
                  </div>
                )}
              </div>
            )}

            {/* Method Content 2: Card Checkout */}
            {paymentMethod === 'card' && (
              <div style={{ marginBottom: '22px' }}>
                <div style={{ background: 'rgba(0, 212, 255, 0.08)', border: '1px solid rgba(0, 212, 255, 0.25)', borderRadius: '12px', padding: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#00d4ff', fontWeight: 700, fontSize: '0.85rem', marginBottom: '4px' }}>
                    <i className="fa-solid fa-shield-halved"></i> Paystack Encrypted Checkout
                  </div>
                  <p style={{ color: '#cbd5e1', fontSize: '0.8rem', margin: 0, lineHeight: 1.5 }}>
                    You will be securely routed to Paystack to complete payment with Visa, Mastercard, or Bank Transfer.
                  </p>
                </div>
              </div>
            )}

            {/* Method Content 3: Manual M-Pesa Till */}
            {paymentMethod === 'mpesa_till' && (
              <div style={{ marginBottom: '22px' }}>
                <div style={{ background: 'rgba(251, 191, 36, 0.08)', border: '1px solid rgba(251, 191, 36, 0.3)', borderRadius: '12px', padding: '14px', marginBottom: '14px' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#fbbf24', marginBottom: '6px' }}>
                    Buy Goods Till Instructions:
                  </div>
                  <ol style={{ paddingLeft: '20px', margin: 0, fontSize: '0.8rem', color: '#cbd5e1', lineHeight: 1.6 }}>
                    <li>Open M-Pesa &gt; Lipa na M-Pesa &gt; <strong>Buy Goods and Services</strong></li>
                    <li>Enter Till Number: <strong style={{ color: '#00d4ff', fontSize: '0.95rem' }}>{tillInfo?.till || '3645270'}</strong></li>
                    <li>Account Name: <strong>{tillInfo?.name || 'IAN WABWIRE'}</strong></li>
                    <li>Amount: <strong>KES {selectedPlanKey === 'pro' ? '2,299' : '899'}</strong></li>
                    <li>Enter your PIN, then paste the confirmation code below:</li>
                  </ol>
                </div>

                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '6px' }}>
                  M-Pesa Reference / Code
                </label>
                <input
                  type="text"
                  placeholder="e.g. SLD98F2XYZ"
                  value={tillRef}
                  onChange={e => setTillRef(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#fff',
                    fontSize: '0.9rem',
                    textTransform: 'uppercase',
                    fontFamily: 'monospace'
                  }}
                />
              </div>
            )}

            {/* Total and Submit CTA */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '16px', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
              <div>
                <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Total Payable</span>
                <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#fff', fontFamily: 'monospace' }}>
                  KES {selectedPlanKey === 'pro' ? '2,299' : '899'}
                </div>
              </div>

              <button
                onClick={handleInitiatePayment}
                disabled={processing}
                style={{
                  padding: '12px 28px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #00d4ff, #0088cc)',
                  color: '#040d1a',
                  fontWeight: 800,
                  fontSize: '0.9rem',
                  border: 'none',
                  cursor: processing ? 'wait' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 18px rgba(0, 212, 255, 0.4)'
                }}
              >
                {processing ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin"></i>
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <span>Pay KES {selectedPlanKey === 'pro' ? '2,299' : '899'}</span>
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
              background: 'linear-gradient(145deg, #0f1829, #080c14)',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.9), 0 0 40px rgba(16, 185, 129, 0.2)',
              color: '#fff'
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

            <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff', margin: '0 0 6px' }}>
              Welcome to {receiptData?.name || 'Your Upgraded Tier'}!
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '0.88rem', margin: '0 0 20px', lineHeight: 1.5 }}>
              Your payment has been successfully recorded. All tier features, capacity limits, and intelligence modules are now live.
            </p>

            <div style={{ background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '14px', padding: '16px', marginBottom: '24px', textAlign: 'left', fontSize: '0.82rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#94a3b8' }}>Receipt Number:</span>
                <span style={{ color: '#00d4ff', fontFamily: 'monospace', fontWeight: 700 }}>{receiptData?.receipt_number || 'AXIS-REC-PAID'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#94a3b8' }}>Amount Paid:</span>
                <span style={{ color: '#fff', fontWeight: 800, fontFamily: 'monospace' }}>KES {receiptData?.amount_kes || '—'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8' }}>Active Until:</span>
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
