import React, { useState, useEffect } from 'react';
import { USD_TO_KES_RATE } from '../utils/currencyUtils';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToBilling: () => void;
  isSubUser?: boolean;
  reason?: string;
  featureName?: string;
  currency?: string;
}

export const UpgradeModal: React.FC<UpgradeModalProps> = ({
  isOpen,
  onClose,
  onNavigateToBilling,
  isSubUser = false,
  reason,
  featureName,
  currency = 'KES'
}) => {
  // Theme detector for Light / Dark adaptation
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

  if (!isOpen) return null;

  const textMain = isLight ? '#0f172a' : '#ffffff';
  const textMuted = isLight ? '#475569' : '#94a3b8';
  const modalBg = isLight ? '#ffffff' : 'linear-gradient(145deg, rgba(14, 20, 32, 0.98), rgba(9, 13, 22, 0.98))';
  const modalBorder = isLight ? '1px solid rgba(203, 213, 225, 0.9)' : '1px solid rgba(0, 212, 255, 0.3)';
  const modalShadow = isLight 
    ? '0 24px 60px rgba(0, 0, 0, 0.15), 0 0 20px rgba(0, 0, 0, 0.05)' 
    : '0 24px 60px rgba(0, 0, 0, 0.8), 0 0 40px rgba(0, 212, 255, 0.15)';

  const formatPrice = (kesAmount: number, periodSuffix: string) => {
    if (currency === 'USD') {
      const usd = (kesAmount / USD_TO_KES_RATE).toFixed(2);
      return (
        <>
          ${usd} <span style={{ fontSize: '0.75rem', color: textMuted, fontWeight: 400 }}>{periodSuffix}</span>
        </>
      );
    }
    return (
      <>
        KES {kesAmount.toLocaleString()} <span style={{ fontSize: '0.75rem', color: textMuted, fontWeight: 400 }}>{periodSuffix}</span>
      </>
    );
  };

  return (
    <div className="modal-overlay active" onClick={onClose} style={{ zIndex: 1100 }}>
      <div 
        className="modal-card" 
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: '560px',
          background: modalBg,
          border: modalBorder,
          boxShadow: modalShadow,
          borderRadius: '20px',
          padding: '28px',
          color: textMain,
          position: 'relative',
          overflow: 'visible'
        }}
      >
        {/* Glow ambient circle (Dark mode only) */}
        {!isLight && (
          <div style={{
            position: 'absolute',
            top: '-60px',
            right: '-60px',
            width: '200px',
            height: '200px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(0, 212, 255, 0.25) 0%, transparent 70%)',
            pointerEvents: 'none'
          }} />
        )}

        {/* Modal Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              background: isLight ? 'rgba(2, 132, 199, 0.12)' : 'linear-gradient(135deg, rgba(0, 212, 255, 0.2), rgba(201, 169, 110, 0.3))',
              border: isLight ? '1px solid rgba(2, 132, 199, 0.3)' : '1px solid rgba(0, 212, 255, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.3rem',
              color: isLight ? '#0284c7' : '#00d4ff'
            }}>
              <i className="fa-solid fa-crown" style={{ color: '#d97706' }}></i>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 800, letterSpacing: '1.5px', color: '#d97706', textTransform: 'uppercase' }}>
                {isSubUser ? 'Team Account' : 'Axis Subscription'}
              </div>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: textMain, margin: '2px 0 0' }}>
                {isSubUser
                  ? 'Feature Requires Upgrade'
                  : featureName ? `Unlock ${featureName}` : 'Upgrade Your Package'}
              </h3>
            </div>
          </div>
          <button 
            onClick={onClose}
            style={{
              background: isLight ? '#f1f5f9' : 'rgba(255, 255, 255, 0.06)',
              border: isLight ? '1px solid #cbd5e1' : '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: textMuted,
              cursor: 'pointer'
            }}
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* Reason banner if triggered by a limit */}
        {reason && (
          <div style={{
            padding: '12px 16px',
            borderRadius: '12px',
            background: isLight ? 'rgba(245, 158, 11, 0.12)' : 'rgba(251, 191, 36, 0.1)',
            border: isLight ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid rgba(251, 191, 36, 0.3)',
            color: isLight ? '#b45309' : '#fbbf24',
            fontSize: '0.86rem',
            lineHeight: 1.5,
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: '1.1rem', flexShrink: 0 }}></i>
            <span>{reason}</span>
          </div>
        )}

        {isSubUser ? (
          <div style={{
            padding: '14px 18px',
            borderRadius: '12px',
            background: isLight ? 'rgba(124, 58, 237, 0.08)' : 'rgba(167, 139, 250, 0.10)',
            border: isLight ? '1px solid rgba(124, 58, 237, 0.3)' : '1px solid rgba(167, 139, 250, 0.3)',
            color: isLight ? '#5b21b6' : '#c4b5fd',
            fontSize: '0.9rem',
            lineHeight: 1.6,
            marginBottom: '22px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px'
          }}>
            <i className="fa-solid fa-users" style={{ marginTop: '2px', fontSize: '1.1rem', flexShrink: 0 }} />
            <span>
              You are signed in as a <strong>team member</strong>. Feature access is determined by your business owner's subscription plan.
              Ask your <strong>account owner</strong> to upgrade your workspace plan — features will automatically activate for your account.
            </span>
          </div>
        ) : (
          <p style={{ color: textMuted, fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '22px' }}>
            Take your business operations and financial intelligence to the next level with full capacity, team access, and priority support.
          </p>
        )}

        {/* Package Highlights Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '24px' }}>
          
          {/* Starter Plan Box */}
          <div style={{
            padding: '18px 16px',
            borderRadius: '14px',
            background: isLight ? 'linear-gradient(145deg, rgba(2, 132, 199, 0.06), #ffffff)' : 'rgba(0, 212, 255, 0.05)',
            border: isLight ? '1px solid rgba(2, 132, 199, 0.3)' : '1px solid rgba(0, 212, 255, 0.25)',
            position: 'relative'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontWeight: 800, fontSize: '1rem', color: '#0284c7' }}>Starter</span>
              <span style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: '10px', background: isLight ? 'rgba(2, 132, 199, 0.15)' : 'rgba(0, 212, 255, 0.2)', color: '#0284c7', fontWeight: 700 }}>
                MONTHLY
              </span>
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: textMain, marginBottom: '12px', fontFamily: 'monospace' }}>
              {formatPrice(899, '/ mo')}
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '0.8rem', color: textMain, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa-solid fa-check" style={{ color: '#0284c7', fontSize: '0.75rem' }}></i> Unlimited branches
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa-solid fa-check" style={{ color: '#0284c7', fontSize: '0.75rem' }}></i> Team members &amp; roles
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa-solid fa-check" style={{ color: '#0284c7', fontSize: '0.75rem' }}></i> Interactive Spreadsheet
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa-solid fa-check" style={{ color: '#0284c7', fontSize: '0.75rem' }}></i> Unlimited Inventory &amp; Ledger
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa-solid fa-check" style={{ color: '#0284c7', fontSize: '0.75rem' }}></i> Voice Agent (400/mo)
              </li>
            </ul>
          </div>

          {/* Pro Plan Box */}
          <div style={{
            padding: '18px 16px',
            borderRadius: '14px',
            background: isLight ? 'linear-gradient(145deg, rgba(217, 119, 6, 0.08), #ffffff)' : 'linear-gradient(145deg, rgba(201, 169, 110, 0.08), rgba(124, 95, 230, 0.08))',
            border: isLight ? '1px solid rgba(217, 119, 6, 0.4)' : '1px solid rgba(201, 169, 110, 0.4)',
            position: 'relative'
          }}>
            <div style={{ 
              position: 'absolute', 
              top: '-11px', 
              right: '12px', 
              background: 'linear-gradient(135deg, #e8c97a, #c9a96e)', 
              color: '#000', 
              fontSize: '0.62rem', 
              fontWeight: 800, 
              padding: '2px 8px', 
              borderRadius: '6px', 
              letterSpacing: '0.5px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
            }}>
              BEST VALUE
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontWeight: 800, fontSize: '1rem', color: '#d97706' }}>Pro</span>
              <span style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: '10px', background: isLight ? 'rgba(217, 119, 6, 0.15)' : 'rgba(201, 169, 110, 0.2)', color: '#d97706', fontWeight: 700 }}>
                3 MONTHS
              </span>
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: textMain, marginBottom: '12px', fontFamily: 'monospace' }}>
              {formatPrice(2299, '/ 3 mo')}
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '0.8rem', color: textMain, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa-solid fa-check" style={{ color: '#d97706', fontSize: '0.75rem' }}></i> All in Starter tier
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa-solid fa-check" style={{ color: '#d97706', fontSize: '0.75rem' }}></i> <strong>Double Daily Agent Boost</strong>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa-solid fa-check" style={{ color: '#d97706', fontSize: '0.75rem' }}></i> 1,200 AI exchanges/mo
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa-solid fa-check" style={{ color: '#d97706', fontSize: '0.75rem' }}></i> Voice Agent + Daily Ext.
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa-solid fa-star" style={{ color: '#d97706', fontSize: '0.75rem' }}></i> Priority VIP Support
              </li>
            </ul>
          </div>
        </div>

        {/* Modal Action CTA */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px' }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 18px',
              borderRadius: '10px',
              background: isLight ? '#f1f5f9' : 'transparent',
              border: isLight ? '1px solid #cbd5e1' : '1px solid rgba(255, 255, 255, 0.15)',
              color: textMuted,
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Later
          </button>
          {isSubUser ? (
            <button
              onClick={onClose}
              style={{
                padding: '11px 24px',
                borderRadius: '10px',
                background: isLight ? 'rgba(124,58,237,0.12)' : 'rgba(167,139,250,0.15)',
                border: isLight ? '1px solid rgba(124,58,237,0.4)' : '1px solid rgba(167,139,250,0.4)',
                color: isLight ? '#5b21b6' : '#c4b5fd',
                fontSize: '0.88rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Got it
            </button>
          ) : (
            <button
              onClick={() => {
                onClose();
                onNavigateToBilling();
              }}
              style={{
                padding: '11px 24px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #00d4ff, #0099ff)',
                border: 'none',
                color: '#040d1a',
                fontSize: '0.88rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 18px rgba(0, 212, 255, 0.4)'
              }}
            >
              <span>Upgrade Workspace</span>
              <i className="fa-solid fa-arrow-right" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default UpgradeModal;
