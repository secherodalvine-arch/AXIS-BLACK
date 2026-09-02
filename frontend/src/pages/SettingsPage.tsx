import React, { useState, useEffect, useRef } from 'react';
import { Currency } from '../types';
import { getUserProfileApi, updateUserProfileApi, uploadAssetApi, UserProfile } from '../utils/api';

interface SettingsViewProps {
  currency?: Currency;
  onCurrencyChange?: (c: Currency) => void;
  user?: UserProfile | null;
  onUserUpdate?: (updatedUser: UserProfile) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ 
  currency = 'USD', 
  onCurrencyChange,
  user,
  onUserUpdate 
}) => {
  const [profile, setProfile] = useState<any>({
    name: user?.name || 'Dalvine',
    email: user?.email || 'secherodalvine@gmail.com',
    role: user?.role || 'Chief Financial Officer',
    company: user?.company || 'Axis Black Inc.',
    salary: user?.salary || 150000,
    income_frequency: user?.income_frequency || 'monthly',
    city: user?.location?.city || 'Nairobi',
    country: user?.location?.country || 'Kenya',
    currency: user?.currency || currency,
    avatar_url: user?.avatar_url || '',
    personality: user?.personality || 'Precision-Driven',
  });

  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let mounted = true;
    getUserProfileApi()
      .then((res) => {
        if (mounted && res) {
          const loaded: any = {
            name: res.name || user?.name || 'Dalvine',
            email: res.email || user?.email || 'secherodalvine@gmail.com',
            role: res.role || user?.role || 'Chief Financial Officer',
            company: res.company || user?.company || 'Axis Black Inc.',
            salary: res.salary ?? user?.salary ?? 150000,
            income_frequency: res.income_frequency || user?.income_frequency || 'monthly',
            city: res.location?.city || user?.location?.city || 'Nairobi',
            country: res.location?.country || user?.location?.country || 'Kenya',
            currency: res.currency || user?.currency || currency,
            avatar_url: res.avatar_url || user?.avatar_url || '',
            personality: res.personality || user?.personality || 'Precision-Driven',
          };
          setProfile(loaded);
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
      });

      setSaveSuccess('User profile and settings persisted to database successfully!');
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
        });
      }
      setTimeout(() => setSaveSuccess(null), 4000);
    } catch (err: any) {
      setSaveError(err.message || 'Failed to update user profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="tab-view active">
      <div className="view-header">
        <h2>System Settings & User Profile</h2>
        <p className="subtitle">Manage executive identity, role, income targets, profile photo, and currency persistence</p>
      </div>


      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', maxWidth: '1100px' }}>
        
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
                <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#ffffff', fontFamily: 'Plus Jakarta Sans', margin: 0 }}>
                  {profile.name || 'Dalvine'}
                </h3>
                <p style={{ fontSize: '0.88rem', color: '#9ca3af', margin: '4px 0 0' }}>
                  {profile.role || 'Chief Financial Officer'} • {profile.company || 'Axis Black Inc.'}
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
                  background: '#141418',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#ffffff',
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
                  background: '#141418',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#ffffff',
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
                  background: '#141418',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#ffffff',
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
                  background: '#141418',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#ffffff',
                  fontSize: '0.95rem',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#9ca3af', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Monthly Target Salary / Revenue ({profile.currency || currency})
              </label>
              <input
                type="number"
                value={profile.salary}
                onChange={(e) => setProfile({ ...profile, salary: e.target.value })}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  background: '#141418',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#ffffff',
                  fontSize: '0.95rem',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#9ca3af', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Payout Frequency
              </label>
              <select
                value={profile.income_frequency}
                onChange={(e) => setProfile({ ...profile, income_frequency: e.target.value })}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  background: '#141418',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#ffffff',
                  fontSize: '0.95rem',
                }}
              >
                <option value="monthly" style={{ background: '#141418', color: '#ffffff' }}>Monthly</option>
                <option value="weekly" style={{ background: '#141418', color: '#ffffff' }}>Weekly</option>
                <option value="daily" style={{ background: '#141418', color: '#ffffff' }}>Daily</option>
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
                  background: '#141418',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#ffffff',
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
                  background: '#141418',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#ffffff',
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
                  <><i className="fa-solid fa-user-check"></i> Save Profile Changes</>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* CURRENCY & LOCALIZATION CARD */}
        <div className="glass-card" style={{ padding: '28px', gridColumn: 'span 2' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#ffffff', fontFamily: 'Plus Jakarta Sans', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <i className="fa-solid fa-coins" style={{ color: '#00d4ff' }}></i>
            Currency & Localization Preferences
          </h3>
          <p style={{ fontSize: '0.88rem', color: '#9ca3af', marginTop: '6px', marginBottom: '20px', lineHeight: '1.5' }}>
            Select your preferred base display currency for all financial cards, ledger entries, and business unit analytics. Changes save directly to your database profile.
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
            <span className="pill-tag cyan" style={{ fontSize: '0.7rem' }}>LIVE SYNC & DB PERSISTED</span>
          </div>
        </div>

      </div>
    </div>
  );
};

