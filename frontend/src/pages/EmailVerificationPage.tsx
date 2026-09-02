import React, { useState, useEffect, useCallback } from 'react';
import { resendVerificationApi } from '../utils/api';

interface EmailVerificationPageProps {
  email: string;
  onNavigateLogin: () => void;
  onBackToHome: () => void;
}

const RESEND_COOLDOWN = 60;

export const EmailVerificationPage: React.FC<EmailVerificationPageProps> = ({
  email,
  onNavigateLogin,
  onBackToHome,
}) => {
  const [resendCooldown, setResendCooldown] = useState(RESEND_COOLDOWN);
  const [resendLoading, setResendLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [pulseActive, setPulseActive] = useState(true);

  // Countdown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Pulse animation reset
  useEffect(() => {
    const t = setTimeout(() => setPulseActive(false), 2000);
    return () => clearTimeout(t);
  }, []);

  const handleResend = useCallback(async () => {
    if (resendCooldown > 0 || resendLoading) return;
    setResendLoading(true);
    setStatusMessage(null);

    try {
      const res = await resendVerificationApi(email);
      setStatusMessage({ type: 'success', text: res.message || 'Verification email resent. Check your inbox.' });
      setResendCooldown(RESEND_COOLDOWN);
    } catch (err: any) {
      if (err.status === 429) {
        const retryAfter = parseInt(err.message.match(/\d+/)?.[0] || '60');
        setStatusMessage({ type: 'error', text: err.message });
        setResendCooldown(retryAfter);
      } else {
        setStatusMessage({ type: 'error', text: err.message || 'Failed to resend. Please try again.' });
      }
    } finally {
      setResendLoading(false);
    }
  }, [email, resendCooldown, resendLoading]);

  const canResend = resendCooldown === 0 && !resendLoading;

  return (
    <div className="auth-page">
      <div className="auth-glow auth-glow-cyan"></div>
      <div className="auth-glow auth-glow-lilac"></div>

      <button className="auth-back-btn" onClick={onBackToHome}>
        <i className="fa-solid fa-arrow-left"></i> Back to Axis Black
      </button>

      <div className="auth-card glass-card" style={{ maxWidth: '480px' }}>
        <div className="auth-header">
          <div className="auth-brand" onClick={onBackToHome} style={{ cursor: 'pointer' }} title="Return to Homepage">
            <img src="/compass_icon.png" alt="Axis Black" className="auth-logo" />
            <span className="auth-wordmark">AXIS<span>BLACK</span></span>
          </div>
          <div className="verify-icon-wrap">
            <div className={`verify-icon-ring ${pulseActive ? 'pulse' : ''}`}>
              <i className="fa-solid fa-envelope-open-text verify-icon"></i>
            </div>
          </div>
          <h2 className="auth-title">Check Your Inbox</h2>
          <p className="auth-subtitle">
            We've sent a verification email to
          </p>
          <div className="verify-email-display">
            <i className="fa-solid fa-at"></i>
            <span>{email}</span>
          </div>
        </div>

        <div className="verify-body">
          <div className="verify-steps">
            <div className="verify-step">
              <div className="verify-step-num">1</div>
              <p>Open the email from <strong>Axis Black</strong></p>
            </div>
            <div className="verify-step">
              <div className="verify-step-num">2</div>
              <p>Click <strong>"Verify My Account"</strong> or copy the link</p>
            </div>
            <div className="verify-step">
              <div className="verify-step-num">3</div>
              <p>Return here and <strong>sign in</strong> to your dashboard</p>
            </div>
          </div>

          {statusMessage && (
            <div className={statusMessage.type === 'success' ? 'auth-success-banner' : 'auth-error-banner'} style={{ marginTop: '16px' }}>
              <i className={`fa-solid ${statusMessage.type === 'success' ? 'fa-circle-check' : 'fa-triangle-exclamation'}`}></i>
              <span>{statusMessage.text}</span>
            </div>
          )}

          <div className="verify-resend-section">
            <p className="verify-hint">Didn't receive it? Check your spam folder or resend.</p>
            <button
              type="button"
              className={`auth-btn-secondary verify-resend-btn ${canResend ? '' : 'disabled'}`}
              onClick={handleResend}
              disabled={!canResend}
            >
              {resendLoading ? (
                <>
                  <i className="fa-solid fa-circle-notch fa-spin"></i> Sending...
                </>
              ) : resendCooldown > 0 ? (
                <>
                  <i className="fa-solid fa-clock"></i> Resend in {resendCooldown}s
                </>
              ) : (
                <>
                  <i className="fa-solid fa-paper-plane"></i> Resend Verification Email
                </>
              )}
            </button>

            {resendCooldown > 0 && (
              <div className="verify-cooldown-bar">
                <div
                  className="verify-cooldown-fill"
                  style={{ width: `${((RESEND_COOLDOWN - resendCooldown) / RESEND_COOLDOWN) * 100}%` }}
                />
              </div>
            )}
          </div>
        </div>

        <div className="auth-footer" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '20px', marginTop: '4px' }}>
          Already verified?{' '}
          <button type="button" className="auth-link" onClick={onNavigateLogin}>
            Sign In
          </button>
        </div>
      </div>
    </div>
  );
};
