import React, { useState, useEffect, useRef } from 'react';
import { Currency } from '../types';
import { getUserProfileApi, updateUserProfileApi, uploadAssetApi, dispatchSummaryNotificationApi, UserProfile } from '../utils/api';

interface SettingsViewProps {
  currency?: Currency;
  onCurrencyChange?: (c: Currency) => void;
  theme?: 'light' | 'dark' | 'system';
  onThemeChange?: (t: 'light' | 'dark' | 'system') => void;
  user?: UserProfile | null;
  onUserUpdate?: (updatedUser: UserProfile) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ 
  currency = 'USD', 
  onCurrencyChange,
  theme = 'system',
  onThemeChange,
  user,
  onUserUpdate 
}) => {
  const [profile, setProfile] = useState<any>({
    name: user?.name || '',
    email: user?.email || '',
    role: user?.role || '',
    company: user?.company || '',
    salary: user?.salary || 0,
    income_frequency: user?.income_frequency || 'monthly',
    city: user?.location?.city || '',
    country: user?.location?.country || '',
    currency: user?.currency || currency,
    avatar_url: user?.avatar_url || '',
    personality: user?.personality || 'Precision-Driven',
    theme: user?.theme || theme,
  });

  const [currentTheme, setCurrentTheme] = useState<'light' | 'dark' | 'system'>(user?.theme || theme);

  // Business summary notification preferences
  const [notifSettings, setNotifSettings] = useState(() => {
    const existing = user?.notification_settings;
    return {
      enabled: existing?.enabled ?? true,
      frequency: existing?.frequency || 'daily', // 'daily' | 'weekly' | 'monthly'
      dispatch_time: '18:00', // 6:00 PM
      topics: {
        performance: existing?.topics?.performance ?? true,
        stock: existing?.topics?.stock ?? true,
        ledger: existing?.topics?.ledger ?? true,
      },
      channels: {
        in_app: existing?.channels?.in_app ?? true,
        email: existing?.channels?.email ?? true,
        sms: existing?.channels?.sms ?? false,
      },
      email_mode: existing?.email_mode || 'profile', // 'profile' | 'custom'
      custom_email: existing?.custom_email || '',
      phone_number: existing?.phone_number || '',
    };
  });

  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [savingNotif, setSavingNotif] = useState(false);
  const [dispatchingNotif, setDispatchingNotif] = useState(false);
  const [notifSuccess, setNotifSuccess] = useState<string | null>(null);
  const [notifError, setNotifError] = useState<string | null>(null);
  const [lastDispatchResult, setLastDispatchResult] = useState<any>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let mounted = true;
    getUserProfileApi()
      .then((res) => {
        if (mounted && res) {
          const loaded: any = {
            name: res.name || user?.name || '',
            email: res.email || user?.email || '',
            role: res.role || user?.role || '',
            company: res.company || user?.company || '',
            salary: res.salary ?? user?.salary ?? 0,
            income_frequency: res.income_frequency || user?.income_frequency || 'monthly',
            city: res.location?.city || user?.location?.city || '',
            country: res.location?.country || user?.location?.country || '',
            currency: res.currency || user?.currency || currency,
            avatar_url: res.avatar_url || user?.avatar_url || '',
            personality: res.personality || user?.personality || 'Precision-Driven',
            theme: res.theme || user?.theme || theme,
          };
          setProfile(loaded);
          
          if (res.theme && (res.theme === 'light' || res.theme === 'dark' || res.theme === 'system')) {
            setCurrentTheme(res.theme);
            if (onThemeChange && res.theme !== theme) {
              onThemeChange(res.theme);
            }
          }

          if (res.notification_settings) {
            setNotifSettings(prev => ({
              ...prev,
              ...res.notification_settings,
              topics: { ...prev.topics, ...(res.notification_settings.topics || {}) },
              channels: { ...prev.channels, ...(res.notification_settings.channels || {}) }
            }));
          }

          if (res.currency && onCurrencyChange && res.currency !== currency) {
            onCurrencyChange(res.currency as Currency);
          }
        }
      })
      .catch((err) => console.log('Profile fetch notice:', err));

    return () => { mounted = false; };
  }, []);

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    setSaveSuccess(null);
    setSaveError(null);

    try {
      const result = await uploadAssetApi(file);
      if (result && result.url) {
        const updatedProfile = { ...profile, avatar_url: result.url };
        setProfile(updatedProfile);
        
        // Save immediately to DB
        const updatedUserDoc = await updateUserProfileApi({
          avatar_url: result.url
        });
        
        if (onUserUpdate && updatedUserDoc) {
          onUserUpdate({
            user_id: updatedUserDoc.user_id || user?.user_id || 'usr_active',
            name: updatedUserDoc.name,
            email: updatedUserDoc.email,
            role: updatedUserDoc.role,
            company: updatedUserDoc.company,
            currency: updatedUserDoc.currency as Currency,
            salary: updatedUserDoc.salary,
            income_frequency: updatedUserDoc.income_frequency,
            location: updatedUserDoc.location,
            avatar_url: updatedUserDoc.avatar_url,
            theme: updatedUserDoc.theme,
            notification_settings: updatedUserDoc.notification_settings
          });
        }
        setSaveSuccess('Profile photo uploaded and saved to database successfully!');
        setTimeout(() => setSaveSuccess(null), 4000);
      }
    } catch (err: any) {
      setSaveError(err.message || 'Failed to upload profile photo.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleThemeSelect = async (newTheme: 'light' | 'dark' | 'system') => {
    setCurrentTheme(newTheme);
    setProfile((prev: any) => ({ ...prev, theme: newTheme }));
    if (onThemeChange) {
      onThemeChange(newTheme);
    }
    try {
      const updated = await updateUserProfileApi({ theme: newTheme });
      if (onUserUpdate && updated) {
        onUserUpdate({
          user_id: updated.user_id || user?.user_id || 'usr_active',
          name: updated.name,
          email: updated.email,
          role: updated.role,
          company: updated.company,
          currency: updated.currency as Currency,
          salary: updated.salary,
          income_frequency: updated.income_frequency,
          location: updated.location,
          avatar_url: updated.avatar_url,
          theme: updated.theme,
          notification_settings: updated.notification_settings
        });
      }
      setSaveSuccess(`Theme set to ${newTheme === 'light' ? 'Light' : newTheme === 'dark' ? 'Dark' : 'System'} mode.`);
      setTimeout(() => setSaveSuccess(null), 3000);
    } catch (err) {
      console.error('Failed to persist theme preference:', err);
    }
  };

  const handleCurrencySelect = async (newCurrency: Currency) => {
    setProfile((prev: any) => ({ ...prev, currency: newCurrency }));
    if (onCurrencyChange) {
      onCurrencyChange(newCurrency);
    }
    try {
      const updated = await updateUserProfileApi({ currency: newCurrency });
      if (onUserUpdate && updated) {
        onUserUpdate({
          user_id: updated.user_id || user?.user_id || 'usr_active',
          name: updated.name,
          email: updated.email,
          role: updated.role,
          company: updated.company,
          currency: updated.currency as Currency,
          salary: updated.salary,
          income_frequency: updated.income_frequency,
          location: updated.location,
          avatar_url: updated.avatar_url,
          theme: updated.theme,
          notification_settings: updated.notification_settings
        });
      }
    } catch (err) {
      console.error('Failed to persist currency change to DB:', err);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(null);
    setSaveError(null);

    try {
      const updated = await updateUserProfileApi({
        name: profile.name,
        email: profile.email,
        role: profile.role,
        company: profile.company,
        salary: Number(profile.salary),
        income_frequency: profile.income_frequency,
        currency: profile.currency,
        city: profile.city,
        country: profile.country,
        avatar_url: profile.avatar_url,
        personality: profile.personality,
        theme: currentTheme,
      });

      setSaveSuccess('User profile updated successfully!');
      if (onUserUpdate && updated) {
        onUserUpdate({
          user_id: updated.user_id || user?.user_id || 'usr_active',
          name: updated.name,
          email: updated.email,
          role: updated.role,
          company: updated.company,
          currency: updated.currency as Currency,
          salary: updated.salary,
          income_frequency: updated.income_frequency,
          location: updated.location,
          avatar_url: updated.avatar_url,
          theme: updated.theme,
          notification_settings: updated.notification_settings
        });
      }
      setTimeout(() => setSaveSuccess(null), 4000);
    } catch (err: any) {
      setSaveError(err.message || 'Failed to update user profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNotifications = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSavingNotif(true);
    setNotifSuccess(null);
    setNotifError(null);

    try {
      const updated = await updateUserProfileApi({
        notification_settings: notifSettings
      });

      if (onUserUpdate && updated) {
        onUserUpdate({
          user_id: updated.user_id || user?.user_id || 'usr_active',
          name: updated.name,
          email: updated.email,
          role: updated.role,
          company: updated.company,
          currency: updated.currency as Currency,
          salary: updated.salary,
          income_frequency: updated.income_frequency,
          location: updated.location,
          avatar_url: updated.avatar_url,
          theme: updated.theme,
          notification_settings: updated.notification_settings
        });
      }

      setNotifSuccess('Notification settings saved! Your business summary report will dispatch at 6:00 PM.');
      setTimeout(() => setNotifSuccess(null), 5000);
    } catch (err: any) {
      setNotifError(err.message || 'Failed to save notification settings.');
    } finally {
      setSavingNotif(false);
    }
  };

  const handleDispatchSummary = async () => {
    const activeModes = Object.entries(notifSettings.channels)
      .filter(([_, active]) => active)
      .map(([name]) => name);

    if (activeModes.length === 0) {
      setNotifError('Please activate at least one delivery mode below (In-App, Email, or SMS).');
      return;
    }

    if (notifSettings.channels.sms && !notifSettings.phone_number.trim()) {
      setNotifError('Please provide a mobile phone number for SMS delivery.');
      return;
    }

    if (notifSettings.channels.email && notifSettings.email_mode === 'custom' && !notifSettings.custom_email.trim()) {
      setNotifError('Please enter a recipient email address for email delivery.');
      return;
    }

    setDispatchingNotif(true);
    setNotifSuccess(null);
    setNotifError(null);
    setLastDispatchResult(null);

    try {
      const res = await dispatchSummaryNotificationApi(notifSettings);
      setLastDispatchResult(res);
      const readableModes = activeModes.map(m => m === 'in_app' ? 'In-App' : m === 'sms' ? 'SMS' : 'Email').join(' & ');
      setNotifSuccess(`Business summary report delivered to activated mode(s): ${readableModes}! Check your active channels.`);
      setTimeout(() => setNotifSuccess(null), 6000);
    } catch (err: any) {
      setNotifError(err.message || 'Failed to dispatch business summary.');
    } finally {
      setDispatchingNotif(false);
    }
  };

  return (
    <div className="tab-view active">
      <div className="view-header">
        <h2>Settings & Preferences</h2>
        <p className="subtitle">Manage theme, business summary notifications, user profile, and currency</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', maxWidth: '1100px' }}>
        
        {/* THEME CARD: LIGHT, DARK, SYSTEM */}
        <div className="glass-card" style={{ padding: '28px', gridColumn: 'span 2' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: 'Plus Jakarta Sans', display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
                <i className="fa-solid fa-palette" style={{ color: '#00d4ff' }}></i>
                Theme
              </h3>
              <p style={{ fontSize: '0.88rem', color: '#9ca3af', marginTop: '6px', marginBottom: 0, lineHeight: '1.5' }}>
                Select your preferred appearance for pages, modals, menus, and text.
              </p>
            </div>
            <span className="pill-tag cyan" style={{ fontSize: '0.75rem', padding: '6px 14px', textTransform: 'uppercase' }}>
              Current: {currentTheme}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginTop: '16px' }}>
            
            {/* Light Option */}
            <div
              onClick={() => handleThemeSelect('light')}
              style={{
                cursor: 'pointer',
                padding: '18px',
                borderRadius: '14px',
                background: currentTheme === 'light' ? 'rgba(0, 212, 255, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                border: currentTheme === 'light' ? '2px solid #00d4ff' : '1px solid rgba(255, 255, 255, 0.1)',
                transition: 'all 0.2s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <i className="fa-solid fa-sun" style={{ color: '#fbbf24', fontSize: '1.2rem' }}></i>
                  <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Light</h4>
                </div>
                {currentTheme === 'light' && <i className="fa-solid fa-circle-check" style={{ color: '#00d4ff' }}></i>}
              </div>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#9ca3af' }}>Crisp white background with dark text</p>
            </div>

            {/* Dark Option */}
            <div
              onClick={() => handleThemeSelect('dark')}
              style={{
                cursor: 'pointer',
                padding: '18px',
                borderRadius: '14px',
                background: currentTheme === 'dark' ? 'rgba(0, 212, 255, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                border: currentTheme === 'dark' ? '2px solid #00d4ff' : '1px solid rgba(255, 255, 255, 0.1)',
                transition: 'all 0.2s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <i className="fa-solid fa-moon" style={{ color: '#a78bfa', fontSize: '1.2rem' }}></i>
                  <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Dark</h4>
                </div>
                {currentTheme === 'dark' && <i className="fa-solid fa-circle-check" style={{ color: '#00d4ff' }}></i>}
              </div>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#9ca3af' }}>Dark background with soft accents</p>
            </div>

            {/* System Option */}
            <div
              onClick={() => handleThemeSelect('system')}
              style={{
                cursor: 'pointer',
                padding: '18px',
                borderRadius: '14px',
                background: currentTheme === 'system' ? 'rgba(0, 212, 255, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                border: currentTheme === 'system' ? '2px solid #00d4ff' : '1px solid rgba(255, 255, 255, 0.1)',
                transition: 'all 0.2s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <i className="fa-solid fa-desktop" style={{ color: '#00d4ff', fontSize: '1.2rem' }}></i>
                  <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>System</h4>
                </div>
                {currentTheme === 'system' && <i className="fa-solid fa-circle-check" style={{ color: '#00d4ff' }}></i>}
              </div>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#9ca3af' }}>Matches your device appearance automatically</p>
            </div>

          </div>
        </div>

        {/* BUSINESS NOTIFICATIONS SETTINGS CARD */}
        <div className="glass-card" style={{ padding: '28px', gridColumn: 'span 2' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '14px', marginBottom: '20px' }}>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: 'Plus Jakarta Sans', display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
                <i className="fa-solid fa-bell" style={{ color: '#00d4ff' }}></i>
                Business Summary & Alert Notifications
              </h3>
              <p style={{ fontSize: '0.88rem', color: '#9ca3af', marginTop: '6px', marginBottom: 0, lineHeight: '1.5' }}>
                Receive automated business summary reports covering your profit or loss margin, inventory stock health, and ledger records delivered at 6:00 PM.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.88rem', fontWeight: 600 }}>
                <input 
                  type="checkbox" 
                  checked={notifSettings.enabled} 
                  onChange={(e) => setNotifSettings({ ...notifSettings, enabled: e.target.checked })}
                  style={{ width: '18px', height: '18px', accentColor: '#00d4ff', cursor: 'pointer' }}
                />
                Enable Business Notifications
              </label>
            </div>
          </div>

          {notifSuccess && (
            <div style={{ padding: '12px 16px', borderRadius: '10px', background: 'rgba(0, 212, 255, 0.12)', border: '1px solid rgba(0, 212, 255, 0.3)', color: '#00d4ff', marginBottom: '20px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <i className="fa-solid fa-circle-check"></i>
              <span>{notifSuccess}</span>
            </div>
          )}

          {notifError && (
            <div style={{ padding: '12px 16px', borderRadius: '10px', background: 'rgba(255, 87, 87, 0.12)', border: '1px solid rgba(255, 87, 87, 0.3)', color: '#ff6b6b', marginBottom: '20px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <i className="fa-solid fa-triangle-exclamation"></i>
              <span>{notifError}</span>
            </div>
          )}

          {/* Business Summary Live Breakdown Card */}
          {lastDispatchResult && lastDispatchResult.summary && (
            <div style={{ padding: '18px', borderRadius: '14px', background: 'rgba(0, 212, 255, 0.05)', border: '1px solid rgba(0, 212, 255, 0.25)', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#00d4ff' }}>
                  <i className="fa-solid fa-bolt" style={{ marginRight: '6px' }}></i> Latest Business Summary Delivered
                </span>
                <span className="pill-tag cyan" style={{ fontSize: '0.72rem', padding: '3px 8px' }}>
                  Dispatch Schedule: 6:00 PM
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '12px' }}>
                <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                  <span style={{ fontSize: '0.75rem', color: '#9ca3af', display: 'block' }}>Revenue (Income)</span>
                  <strong style={{ fontSize: '1.1rem', color: '#4ade80' }}>${lastDispatchResult.summary.total_revenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
                </div>

                <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                  <span style={{ fontSize: '0.75rem', color: '#9ca3af', display: 'block' }}>Expenses (Costs)</span>
                  <strong style={{ fontSize: '1.1rem', color: '#ff8e8e' }}>${lastDispatchResult.summary.total_expenses.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
                </div>

                <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                  <span style={{ fontSize: '0.75rem', color: '#9ca3af', display: 'block' }}>
                    {lastDispatchResult.summary.is_profit ? 'Net Profit & Margin' : 'Net Loss & Margin'}
                  </span>
                  <strong style={{ fontSize: '1.1rem', color: lastDispatchResult.summary.is_profit ? '#4ade80' : '#ff8e8e' }}>
                    ${Math.abs(lastDispatchResult.summary.net_margin).toLocaleString('en-US', { minimumFractionDigits: 2 })} ({lastDispatchResult.summary.is_profit ? '+' : '-'}{Math.abs(lastDispatchResult.summary.margin_percentage).toFixed(1)}%)
                  </strong>
                </div>

                <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                  <span style={{ fontSize: '0.75rem', color: '#9ca3af', display: 'block' }}>Products in Stock / Low</span>
                  <strong style={{ fontSize: '1.1rem' }}>
                    {lastDispatchResult.summary.total_inventory_items} items ({lastDispatchResult.summary.low_stock_items} low)
                  </strong>
                </div>
              </div>

              {/* Delivery Channel Status */}
              <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', fontSize: '0.8rem', paddingTop: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
                <span>In-App: <strong style={{ color: lastDispatchResult.channels?.in_app?.success ? '#4ade80' : '#ff8e8e' }}>{lastDispatchResult.channels?.in_app?.success ? 'Delivered' : 'Inactive'}</strong></span>
                {notifSettings.channels.email && (
                  <span>Email: <strong style={{ color: lastDispatchResult.channels?.email?.success ? '#4ade80' : '#ff8e8e' }}>{lastDispatchResult.channels?.email?.success ? `Sent to ${lastDispatchResult.channels.email.recipient}` : 'Not sent'}</strong></span>
                )}
                {notifSettings.channels.sms && (
                  <span>SMS (TalkSasa): <strong style={{ color: lastDispatchResult.channels?.sms?.success ? '#4ade80' : '#ff8e8e' }}>{lastDispatchResult.channels?.sms?.success ? `Sent to ${lastDispatchResult.channels.sms.recipient || 'recipient'}` : (lastDispatchResult.channels?.sms?.error || 'Failed')}</strong></span>
                )}
              </div>
            </div>
          )}

          <div style={{ opacity: notifSettings.enabled ? 1 : 0.45, pointerEvents: notifSettings.enabled ? 'auto' : 'none', transition: 'opacity 0.2s ease' }}>
            
            {/* Section 1: Frequency & Fixed Dispatch Time */}
            <div style={{ padding: '18px', borderRadius: '14px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.08)', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  1. How Often to Send
                </span>
                <span className="pill-tag cyan" style={{ fontSize: '0.75rem', padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <i className="fa-solid fa-clock"></i> Delivery Time: 6:00 PM (18:00)
                </span>
              </div>

              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                {(['daily', 'weekly', 'monthly'] as const).map((freq) => (
                  <button
                    key={freq}
                    type="button"
                    onClick={() => setNotifSettings({ ...notifSettings, frequency: freq })}
                    className={notifSettings.frequency === freq ? 'action-btn-primary' : 'action-btn-secondary'}
                    style={{ flex: 1, minWidth: '120px', padding: '12px', justifyContent: 'center', textTransform: 'capitalize', fontSize: '0.9rem' }}
                  >
                    <i className={`fa-solid ${freq === 'daily' ? 'fa-calendar-day' : freq === 'weekly' ? 'fa-calendar-week' : 'fa-calendar'}`}></i>
                    {freq} (at 6:00 PM)
                  </button>
                ))}
              </div>
              <p style={{ fontSize: '0.78rem', color: '#9ca3af', margin: '10px 0 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <i className="fa-solid fa-circle-info" style={{ color: '#00d4ff' }}></i>
                Summaries are compiled from live business numbers and sent automatically at 6:00 PM.
              </p>
            </div>

            {/* Section 2: Summary Content Included */}
            <div style={{ padding: '18px', borderRadius: '14px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.08)', marginBottom: '20px' }}>
              <span style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '14px' }}>
                2. Information Included in Summary
              </span>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px', borderRadius: '10px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={notifSettings.topics.performance}
                    onChange={(e) => setNotifSettings({
                      ...notifSettings,
                      topics: { ...notifSettings.topics, performance: e.target.checked }
                    })}
                    style={{ marginTop: '3px', accentColor: '#00d4ff', width: '16px', height: '16px' }}
                  />
                  <div>
                    <span style={{ display: 'block', fontSize: '0.88rem', fontWeight: 600 }}>
                      <i className="fa-solid fa-chart-line" style={{ color: '#4ade80', marginRight: '6px' }}></i> Profit or Loss Margin
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Revenue, expenses, net profit/loss & margin %</span>
                  </div>
                </label>

                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px', borderRadius: '10px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={notifSettings.topics.stock}
                    onChange={(e) => setNotifSettings({
                      ...notifSettings,
                      topics: { ...notifSettings.topics, stock: e.target.checked }
                    })}
                    style={{ marginTop: '3px', accentColor: '#00d4ff', width: '16px', height: '16px' }}
                  />
                  <div>
                    <span style={{ display: 'block', fontSize: '0.88rem', fontWeight: 600 }}>
                      <i className="fa-solid fa-boxes-stacked" style={{ color: '#fbbf24', marginRight: '6px' }}></i> Products in Stock
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Total items in stock & items needing reorder</span>
                  </div>
                </label>

                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px', borderRadius: '10px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={notifSettings.topics.ledger}
                    onChange={(e) => setNotifSettings({
                      ...notifSettings,
                      topics: { ...notifSettings.topics, ledger: e.target.checked }
                    })}
                    style={{ marginTop: '3px', accentColor: '#00d4ff', width: '16px', height: '16px' }}
                  />
                  <div>
                    <span style={{ display: 'block', fontSize: '0.88rem', fontWeight: 600 }}>
                      <i className="fa-solid fa-book" style={{ color: '#cebdff', marginRight: '6px' }}></i> Ledger Transactions
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Money in, money out & total transaction count</span>
                  </div>
                </label>
              </div>
            </div>

            {/* Section 3: Delivery Mode (In-App, Email, SMS) */}
            <div style={{ padding: '18px', borderRadius: '14px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.08)', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '10px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  3. Delivery Modes (Toggle Each Mode On or Off)
                </span>
                {(() => {
                  const activeNames: string[] = [];
                  if (notifSettings.channels.in_app) activeNames.push('In-App');
                  if (notifSettings.channels.email) activeNames.push('Email');
                  if (notifSettings.channels.sms) activeNames.push('SMS');
                  return (
                    <span className={`pill-tag ${activeNames.length > 0 ? 'cyan' : 'warning'}`} style={{ fontSize: '0.74rem', padding: '4px 12px' }}>
                      {activeNames.length > 0 ? `Active: ${activeNames.join(' + ')}` : '⚠️ No delivery mode selected'}
                    </span>
                  );
                })()}
              </div>
              <p style={{ fontSize: '0.78rem', color: '#9ca3af', margin: '0 0 16px', lineHeight: '1.4' }}>
                Toggle any combination of delivery channels (e.g. <strong>SMS and In-App</strong>, or <strong>Email and SMS</strong>). The system automatically checks which modes are enabled and dispatches only to those.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                
                {/* Mode 1: In-App Notification */}
                <div style={{
                  padding: '14px 18px',
                  borderRadius: '12px',
                  background: notifSettings.channels.in_app ? 'rgba(0, 212, 255, 0.05)' : 'rgba(255, 255, 255, 0.015)',
                  border: notifSettings.channels.in_app ? '1px solid rgba(0, 212, 255, 0.35)' : '1px solid rgba(255, 255, 255, 0.06)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '12px',
                  transition: 'all 0.2s ease'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(0, 212, 255, 0.12)', color: '#00d4ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.05rem' }}>
                      <i className="fa-solid fa-bell"></i>
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '0.92rem', fontWeight: 700 }}>In-App Notification</span>
                        <span className={`pill-tag ${notifSettings.channels.in_app ? 'cyan' : 'gray'}`} style={{ fontSize: '0.65rem', padding: '2px 6px' }}>
                          {notifSettings.channels.in_app ? 'ON' : 'OFF'}
                        </span>
                      </div>
                      <span style={{ fontSize: '0.76rem', color: '#9ca3af' }}>Delivered directly to the top bar notification bell</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setNotifSettings({
                      ...notifSettings,
                      channels: { ...notifSettings.channels, in_app: !notifSettings.channels.in_app }
                    })}
                    className={notifSettings.channels.in_app ? 'action-btn-primary' : 'action-btn-secondary'}
                    style={{ padding: '8px 16px', fontSize: '0.82rem', borderRadius: '8px', cursor: 'pointer' }}
                  >
                    <i className={`fa-solid ${notifSettings.channels.in_app ? 'fa-toggle-on' : 'fa-toggle-off'}`}></i>
                    {notifSettings.channels.in_app ? 'Active' : 'Disabled'}
                  </button>
                </div>

                {/* Mode 2: Email Notification */}
                <div style={{
                  padding: '16px 18px',
                  borderRadius: '12px',
                  background: notifSettings.channels.email ? 'rgba(167, 139, 250, 0.05)' : 'rgba(255, 255, 255, 0.015)',
                  border: notifSettings.channels.email ? '1px solid rgba(167, 139, 250, 0.35)' : '1px solid rgba(255, 255, 255, 0.06)',
                  transition: 'all 0.2s ease'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: notifSettings.channels.email ? '14px' : '0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(167, 139, 250, 0.12)', color: '#a78bfa', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.05rem' }}>
                        <i className="fa-solid fa-envelope"></i>
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '0.92rem', fontWeight: 700 }}>Email Notification</span>
                          <span className={`pill-tag ${notifSettings.channels.email ? 'lilac' : 'gray'}`} style={{ fontSize: '0.65rem', padding: '2px 6px' }}>
                            {notifSettings.channels.email ? 'ON' : 'OFF'}
                          </span>
                        </div>
                        <span style={{ fontSize: '0.76rem', color: '#9ca3af' }}>Sends a complete executive business report by email</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setNotifSettings({
                        ...notifSettings,
                        channels: { ...notifSettings.channels, email: !notifSettings.channels.email }
                      })}
                      className={notifSettings.channels.email ? 'action-btn-primary' : 'action-btn-secondary'}
                      style={{ padding: '8px 16px', fontSize: '0.82rem', borderRadius: '8px', cursor: 'pointer' }}
                    >
                      <i className={`fa-solid ${notifSettings.channels.email ? 'fa-toggle-on' : 'fa-toggle-off'}`}></i>
                      {notifSettings.channels.email ? 'Active' : 'Disabled'}
                    </button>
                  </div>

                  {notifSettings.channels.email && (
                    <div style={{ marginLeft: '50px', marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
                      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
                          <input
                            type="radio"
                            name="email_mode"
                            value="profile"
                            checked={notifSettings.email_mode === 'profile'}
                            onChange={() => setNotifSettings({ ...notifSettings, email_mode: 'profile' })}
                            style={{ accentColor: '#a78bfa' }}
                          />
                          <span>Use profile email as default: <strong>{profile.email || user?.email || 'Registered email'}</strong></span>
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
                          <input
                            type="radio"
                            name="email_mode"
                            value="custom"
                            checked={notifSettings.email_mode === 'custom'}
                            onChange={() => setNotifSettings({ ...notifSettings, email_mode: 'custom' })}
                            style={{ accentColor: '#a78bfa' }}
                          />
                          <span>Provide another email address</span>
                        </label>
                      </div>

                      {notifSettings.email_mode === 'custom' && (
                        <div style={{ maxWidth: '420px', marginTop: '4px' }}>
                          <input
                            type="email"
                            placeholder="e.g. reports@company.com"
                            value={notifSettings.custom_email}
                            onChange={(e) => setNotifSettings({ ...notifSettings, custom_email: e.target.value })}
                            style={{
                              width: '100%',
                              padding: '10px 14px',
                              borderRadius: '8px',
                              fontSize: '0.88rem'
                            }}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Mode 3: SMS Notification */}
                <div style={{
                  padding: '16px 18px',
                  borderRadius: '12px',
                  background: notifSettings.channels.sms ? 'rgba(74, 222, 128, 0.05)' : 'rgba(255, 255, 255, 0.015)',
                  border: notifSettings.channels.sms ? '1px solid rgba(74, 222, 128, 0.35)' : '1px solid rgba(255, 255, 255, 0.06)',
                  transition: 'all 0.2s ease'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: notifSettings.channels.sms ? '14px' : '0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(74, 222, 128, 0.12)', color: '#4ade80', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.05rem' }}>
                        <i className="fa-solid fa-comment-sms"></i>
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '0.92rem', fontWeight: 700 }}>SMS Notification</span>
                          <span className={`pill-tag ${notifSettings.channels.sms ? 'green' : 'gray'}`} style={{ fontSize: '0.65rem', padding: '2px 6px' }}>
                            {notifSettings.channels.sms ? 'ON' : 'OFF'}
                          </span>
                        </div>
                        <span style={{ fontSize: '0.76rem', color: '#9ca3af' }}>Text message with revenue, profit or loss margin, and stock</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setNotifSettings({
                        ...notifSettings,
                        channels: { ...notifSettings.channels, sms: !notifSettings.channels.sms }
                      })}
                      className={notifSettings.channels.sms ? 'action-btn-primary' : 'action-btn-secondary'}
                      style={{ padding: '8px 16px', fontSize: '0.82rem', borderRadius: '8px', cursor: 'pointer' }}
                    >
                      <i className={`fa-solid ${notifSettings.channels.sms ? 'fa-toggle-on' : 'fa-toggle-off'}`}></i>
                      {notifSettings.channels.sms ? 'Active' : 'Disabled'}
                    </button>
                  </div>

                  {notifSettings.channels.sms && (
                    <div style={{ marginLeft: '50px', marginTop: '10px', maxWidth: '420px', paddingTop: '12px', borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
                      <label style={{ display: 'block', fontSize: '0.78rem', color: '#9ca3af', marginBottom: '6px' }}>
                        Mobile Phone Number (e.g. +254 700 123 456 or 0700 123 456)
                      </label>
                      <input
                        type="tel"
                        placeholder="+254 700 123 456"
                        value={notifSettings.phone_number}
                        onChange={(e) => setNotifSettings({ ...notifSettings, phone_number: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          borderRadius: '8px',
                          fontSize: '0.88rem'
                        }}
                      />
                    </div>
                  )}
                </div>

              </div>
            </div>

            {/* Notification Actions: Save & Send Real Test */}
            <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'center', marginTop: '12px' }}>
              <button
                type="button"
                className="action-btn-primary"
                onClick={handleSaveNotifications}
                disabled={savingNotif}
                style={{ padding: '12px 24px', fontSize: '0.92rem' }}
              >
                {savingNotif ? (
                  <><i className="fa-solid fa-circle-notch fa-spin"></i> Saving Settings...</>
                ) : (
                  <><i className="fa-solid fa-check"></i> Save Notification Settings</>
                )}
              </button>

              <button
                type="button"
                className="action-btn-secondary"
                onClick={handleDispatchSummary}
                disabled={dispatchingNotif}
                style={{ padding: '12px 20px', fontSize: '0.92rem' }}
                title="Dispatches your business summary report across all active delivery channels immediately"
              >
                {dispatchingNotif ? (
                  <><i className="fa-solid fa-spinner fa-spin"></i> Dispatching Summary...</>
                ) : (
                  <><i className="fa-solid fa-paper-plane"></i> Send Business Summary Now</>
                )}
              </button>
            </div>

          </div>
        </div>

        {/* USER PROFILE SECTION */}
        <div className="glass-card" style={{ padding: '28px', gridColumn: 'span 2' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div 
                style={{ position: 'relative', cursor: 'pointer' }}
                onClick={() => fileInputRef.current?.click()}
                title="Click to change profile picture"
              >
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.name}
                    style={{
                      width: '68px',
                      height: '68px',
                      borderRadius: '20px',
                      objectFit: 'cover',
                      border: '2px solid #00d4ff',
                      boxShadow: '0 0 16px rgba(0, 212, 255, 0.3)'
                    }}
                  />
                ) : (
                  <div style={{
                    width: '68px',
                    height: '68px',
                    borderRadius: '20px',
                    background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.3), rgba(167, 139, 250, 0.3))',
                    border: '1px solid rgba(0, 212, 255, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#00d4ff',
                    fontSize: '1.8rem',
                    fontWeight: 700
                  }}>
                    {profile.name ? profile.name.charAt(0).toUpperCase() : <i className="fa-solid fa-user-tie"></i>}
                  </div>
                )}
                
                <div style={{
                  position: 'absolute',
                  bottom: '-4px',
                  right: '-4px',
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: '#00d4ff',
                  color: '#000',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.75rem',
                  fontWeight: 'bold',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.5)'
                }}>
                  {uploadingImage ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-camera"></i>}
                </div>
              </div>

              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleAvatarFileChange} 
                accept="image/*" 
                style={{ display: 'none' }} 
              />

              <div>
                <h3 style={{ fontSize: '1.3rem', fontWeight: 800, fontFamily: 'Plus Jakarta Sans', margin: 0 }}>
                  {profile.name || 'Dalvine'}
                </h3>
                <p style={{ fontSize: '0.88rem', color: '#9ca3af', margin: '4px 0 0' }}>
                  {profile.role || 'Business Executive'} • {profile.company || 'REINOSERVICES'}
                </p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#00d4ff',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: 0,
                    marginTop: '6px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <i className="fa-solid fa-cloud-arrow-up"></i> {uploadingImage ? 'Uploading photo...' : 'Upload Profile Photo'}
                </button>
              </div>
            </div>

            <span className="pill-tag cyan" style={{ fontSize: '0.75rem', padding: '6px 14px' }}>
              <i className="fa-solid fa-shield-halved" style={{ marginRight: '6px' }}></i> VERIFIED OPERATOR
            </span>
          </div>

          {saveSuccess && (
            <div style={{ padding: '12px 16px', borderRadius: '10px', background: 'rgba(0, 212, 255, 0.12)', border: '1px solid rgba(0, 212, 255, 0.3)', color: '#00d4ff', marginBottom: '20px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <i className="fa-solid fa-circle-check"></i>
              <span>{saveSuccess}</span>
            </div>
          )}

          {saveError && (
            <div style={{ padding: '12px 16px', borderRadius: '10px', background: 'rgba(255, 87, 87, 0.12)', border: '1px solid rgba(255, 87, 87, 0.3)', color: '#ff6b6b', marginBottom: '20px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <i className="fa-solid fa-triangle-exclamation"></i>
              <span>{saveError}</span>
            </div>
          )}

          <form onSubmit={handleSaveProfile} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '18px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#9ca3af', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Full Name
              </label>
              <input
                type="text"
                value={profile.name}
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                required
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  fontSize: '0.95rem',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#9ca3af', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Work Email Address
              </label>
              <input
                type="email"
                value={profile.email}
                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                required
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  fontSize: '0.95rem',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#9ca3af', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Executive Role / Title
              </label>
              <input
                type="text"
                value={profile.role}
                onChange={(e) => setProfile({ ...profile, role: e.target.value })}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  fontSize: '0.95rem',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#9ca3af', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Company / Organization
              </label>
              <input
                type="text"
                value={profile.company}
                onChange={(e) => setProfile({ ...profile, company: e.target.value })}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  fontSize: '0.95rem',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#9ca3af', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Monthly Target Revenue ({profile.currency || currency})
              </label>
              <input
                type="number"
                value={profile.salary}
                onChange={(e) => setProfile({ ...profile, salary: e.target.value })}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  fontSize: '0.95rem',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#9ca3af', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Revenue Cycle Frequency
              </label>
              <select
                value={profile.income_frequency}
                onChange={(e) => setProfile({ ...profile, income_frequency: e.target.value })}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  fontSize: '0.95rem',
                }}
              >
                <option value="monthly">Monthly</option>
                <option value="weekly">Weekly</option>
                <option value="daily">Daily</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#9ca3af', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Operating City
              </label>
              <input
                type="text"
                value={profile.city}
                onChange={(e) => setProfile({ ...profile, city: e.target.value })}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  fontSize: '0.95rem',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#9ca3af', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Operating Country
              </label>
              <input
                type="text"
                value={profile.country}
                onChange={(e) => setProfile({ ...profile, country: e.target.value })}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  fontSize: '0.95rem',
                }}
              />
            </div>

            <div style={{ gridColumn: 'span 2', marginTop: '10px' }}>
              <button
                type="submit"
                className="action-btn-primary"
                disabled={saving}
                style={{ padding: '14px 28px', fontSize: '0.95rem', width: 'auto' }}
              >
                {saving ? (
                  <><i className="fa-solid fa-circle-notch fa-spin"></i> Saving Profile...</>
                ) : (
                  <><i className="fa-solid fa-check"></i> Save Profile Details</>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* CURRENCY & LOCALIZATION CARD */}
        <div className="glass-card" style={{ padding: '28px', gridColumn: 'span 2' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, fontFamily: 'Plus Jakarta Sans', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <i className="fa-solid fa-coins" style={{ color: '#00d4ff' }}></i>
            Currency & Localization Preferences
          </h3>
          <p style={{ fontSize: '0.88rem', color: '#9ca3af', marginTop: '6px', marginBottom: '20px', lineHeight: '1.5' }}>
            Select your preferred base display currency for all financial cards, ledger entries, and business unit analytics.
          </p>

          <div style={{ display: 'flex', gap: '14px', marginBottom: '20px' }}>
            <button
              type="button"
              onClick={() => handleCurrencySelect('USD')}
              className={(profile.currency || currency) === 'USD' ? 'action-btn-primary' : 'action-btn-secondary'}
              style={{ flex: 1, padding: '14px', justifyContent: 'center', fontSize: '0.95rem' }}
            >
              <i className="fa-solid fa-dollar-sign"></i> US Dollar ($ USD)
            </button>
            <button
              type="button"
              onClick={() => handleCurrencySelect('KES')}
              className={(profile.currency || currency) === 'KES' ? 'action-btn-primary' : 'action-btn-secondary'}
              style={{ flex: 1, padding: '14px', justifyContent: 'center', fontSize: '0.95rem' }}
            >
              <i className="fa-solid fa-coins"></i> Kenya Shillings (KSh KES)
            </button>
          </div>

          <div style={{ padding: '14px 16px', background: 'rgba(0, 212, 255, 0.06)', borderRadius: '10px', border: '1px solid rgba(0, 212, 255, 0.25)', fontSize: '0.88rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ color: '#00d4ff', fontWeight: 600 }}>Active Exchange Rate:</span> 1 USD = <strong>130.00 KES</strong>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
