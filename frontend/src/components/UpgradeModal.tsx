import React from 'react';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToBilling: () => void;
  reason?: string;
  featureName?: string;
}

export const UpgradeModal: React.FC<UpgradeModalProps> = ({
  isOpen,
  onClose,
  onNavigateToBilling,
  reason,
  featureName
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay active" onClick={onClose} style={{ zIndex: 1100 }}>
      <div 
        className="modal-card" 
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: '560px',
          background: 'linear-gradient(145deg, rgba(14, 20, 32, 0.98), rgba(9, 13, 22, 0.98))',
          border: '1px solid rgba(0, 212, 255, 0.3)',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.8), 0 0 40px rgba(0, 212, 255, 0.15)',
          borderRadius: '20px',
          padding: '28px',
          color: '#fff',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {/* Glow ambient circle */}
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

        {/* Modal Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.2), rgba(201, 169, 110, 0.3))',
              border: '1px solid rgba(0, 212, 255, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.3rem',
              color: '#00d4ff'
            }}>
              <i className="fa-solid fa-crown" style={{ color: '#e8c97a' }}></i>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 800, letterSpacing: '1.5px', color: '#e8c97a', textTransform: 'uppercase' }}>
                Axis Black Subscription
              </div>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#fff', margin: '2px 0 0' }}>
                {featureName ? `Unlock ${featureName}` : 'Upgrade Your Package'}
              </h3>
            </div>
          </div>
          <button 
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#94a3b8',
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
            background: 'rgba(251, 191, 36, 0.1)',
            border: '1px solid rgba(251, 191, 36, 0.3)',
            color: '#fbbf24',
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

        <p style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '22px' }}>
          Take your business operations and financial intelligence to the next level with full capacity, team access, and priority support.
        </p>

        {/* Package Highlights Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '24px' }}>
          {/* Starter Plan Box */}
          <div style={{
            padding: '18px 16px',
            borderRadius: '14px',
            background: 'rgba(0, 212, 255, 0.05)',
            border: '1px solid rgba(0, 212, 255, 0.25)',
            position: 'relative'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontWeight: 800, fontSize: '1rem', color: '#00d4ff' }}>Starter</span>
              <span style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: '10px', background: 'rgba(0, 212, 255, 0.2)', color: '#00d4ff', fontWeight: 700 }}>
                MONTHLY
              </span>
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', marginBottom: '12px', fontFamily: 'monospace' }}>
              KES 899 <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 400 }}>/ mo</span>
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '0.8rem', color: '#cbd5e1', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa-solid fa-check" style={{ color: '#00d4ff', fontSize: '0.75rem' }}></i> Unlimited branches
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa-solid fa-check" style={{ color: '#00d4ff', fontSize: '0.75rem' }}></i> Team members &amp; roles
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa-solid fa-check" style={{ color: '#00d4ff', fontSize: '0.75rem' }}></i> Interactive Spreadsheet
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa-solid fa-check" style={{ color: '#00d4ff', fontSize: '0.75rem' }}></i> Unlimited Inventory &amp; Ledger
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa-solid fa-check" style={{ color: '#00d4ff', fontSize: '0.75rem' }}></i> Voice Agent (400/mo)
              </li>
            </ul>
          </div>

          {/* Pro Plan Box */}
          <div style={{
            padding: '18px 16px',
            borderRadius: '14px',
            background: 'linear-gradient(145deg, rgba(201, 169, 110, 0.08), rgba(124, 95, 230, 0.08))',
            border: '1px solid rgba(201, 169, 110, 0.4)',
            position: 'relative'
          }}>
            <div style={{ position: 'absolute', top: '-9px', right: '12px', background: 'linear-gradient(135deg, #e8c97a, #c9a96e)', color: '#000', fontSize: '0.62rem', fontWeight: 800, padding: '2px 8px', borderRadius: '6px', letterSpacing: '0.5px' }}>
              BEST VALUE
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontWeight: 800, fontSize: '1rem', color: '#e8c97a' }}>Pro</span>
              <span style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: '10px', background: 'rgba(201, 169, 110, 0.2)', color: '#e8c97a', fontWeight: 700 }}>
                3 MONTHS
              </span>
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', marginBottom: '12px', fontFamily: 'monospace' }}>
              KES 2,299 <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 400 }}>/ 3 mo</span>
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '0.8rem', color: '#cbd5e1', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <i className="fa-solid fa-check" style={{ color: '#e8c97a', fontSize: '0.75rem' }}></i> All in Starter tier
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <i className="fa-solid fa-bolt" style={{ color: '#e8c97a', fontSize: '0.75rem' }}></i> <strong>Double Daily Agent Boost</strong>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <i className="fa-solid fa-check" style={{ color: '#e8c97a', fontSize: '0.75rem' }}></i> 1,200 AI exchanges/mo
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <i className="fa-solid fa-check" style={{ color: '#e8c97a', fontSize: '0.75rem' }}></i> Voice Agent + Daily Ext.
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa-solid fa-star" style={{ color: '#e8c97a', fontSize: '0.75rem' }}></i> Priority VIP Support
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
              background: 'transparent',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#94a3b8',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Later
          </button>
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
            <i className="fa-solid fa-arrow-right"></i>
          </button>
        </div>
      </div>
    </div>
  );
};
export default UpgradeModal;
