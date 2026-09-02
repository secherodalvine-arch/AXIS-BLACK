import React, { useState, useEffect, useCallback } from 'react';
import { forgotPasswordApi, resetPasswordApi, resendResetOtpApi } from '../utils/api';

interface PasswordResetPageProps {
  onNavigateLogin: () => void;
  onBackToHome: () => void;
  tokenFromUrl?: string;
}

const RESEND_COOLDOWN = 60;

export const PasswordResetPage: React.FC<PasswordResetPageProps> = ({
  onNavigateLogin,
  onBackToHome,
  tokenFromUrl,
}) => {
  const getActiveToken = (): string => {
    if (tokenFromUrl) return tokenFromUrl;
    const params = new URLSearchParams(window.location.search);
    let t = params.get('token');
    if (t) return t;
    const match = window.location.href.match(/[?&]token=([^&]+)/);
    return match && match[1] ? decodeURIComponent(match[1]) : '';
  };

  const [token, setToken] = useState<string>(getActiveToken);
  const [step, setStep] = useState<'request' | 'sent' | 'new-password'>(token ? 'new-password' : 'request');
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Resend cooldown
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMsg, setResendMsg] = useState<string | null>(null);

  // Update step if token arrives
  useEffect(() => {
    const activeT = getActiveToken();
    if (activeT) {
      setToken(activeT);
      setStep('new-password');
    }
  }, [tokenFromUrl]);

  // Countdown timer for resend
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown(prev => {
        if (prev <= 1) { clearInterval(timer); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Handle Requesting Reset Link
  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Please enter your email address.');
      return;
    }
    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      const res = await forgotPasswordApi(email);
      setMessage(res.message || 'Password reset link sent to your email.');
      setStep('sent');
      setResendCooldown(RESEND_COOLDOWN);
    } catch (err: any) {
      setError(err.message || 'Failed to send reset link. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Resending Reset Link
  const handleResendLink = useCallback(async () => {
    if (resendCooldown > 0 || resendLoading) return;
    setResendLoading(true);
    setResendMsg(null);
    try {
      const res = await resendResetOtpApi(email);
      setResendMsg(res.message || 'New reset link sent! Check your inbox.');
      setResendCooldown(RESEND_COOLDOWN);
    } catch (err: any) {
      if (err.status === 429) {
        const secs = parseInt(err.message.match(/\d+/)?.[0] || '60');
        setResendCooldown(secs);
        setResendMsg(err.message);
      } else {
        setResendMsg(err.message || 'Failed to resend. Please try again.');
      }
    } finally {
      setResendLoading(false);
    }
  }, [email, resendCooldown, resendLoading]);

  // Handle Setting New Password with Token
  const handleNewPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setError('Missing or invalid reset token. Please request a new password reset link.');
      return;
    }
    if (!newPassword) {
      setError('Please enter your new password.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const res = await resetPasswordApi(token, newPassword);
      setSuccess(true);
      setMessage(res.message || 'Password updated successfully!');
      setTimeout(() => onNavigateLogin(), 3000);
    } catch (err: any) {
      setError(err.message || 'Invalid or expired password reset link. Please request a new one.');
    } finally {
      setLoading(false);
    }
  };

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

          <h2 className="auth-title">
            {step === 'request' && 'Reset Password'}
            {step === 'sent' && 'Check Your Inbox'}
            {step === 'new-password' && 'Set New Password'}
          </h2>
          <p className="auth-subtitle">
            {step === 'request' && 'Enter your email address to receive a password reset link'}
            {step === 'sent' && `We've sent a password reset link to ${email}`}
            {step === 'new-password' && 'Choose a strong new password for your account'}
          </p>
        </div>

        {/* Success State */}
        {success ? (
          <div className="auth-success-banner auth-success-large">
            <i className="fa-solid fa-circle-check" style={{ fontSize: '2rem', color: '#00d4ff' }}></i>
            <div>
              <strong>Password Updated Successfully!</strong>
              <p style={{ margin: '6px 0 0', fontSize: '0.85rem' }}>{message}</p>
              <p style={{ fontSize: '12px', opacity: 0.7, marginTop: '8px' }}>Redirecting to sign in...</p>
            </div>
          </div>
        ) : (
          <>
            {error && (
              <div className="auth-error-banner">
                <i className="fa-solid fa-triangle-exclamation"></i>
                <span>{error}</span>
              </div>
            )}

            {/* STEP 1: Enter Email */}
            {step === 'request' && (
              <form onSubmit={handleRequestSubmit} className="auth-form">
                <div className="auth-field">
                  <label htmlFor="reset-email">Work Email Address</label>
                  <div className="auth-input-wrapper">
                    <i className="fa-solid fa-envelope auth-input-icon"></i>
                    <input
                      id="reset-email"
                      type="email"
                      required
                      placeholder="you@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                    />
                  </div>
                </div>

                <button type="submit" className="auth-btn-primary" disabled={loading}>
                  {loading ? (
                    <><i className="fa-solid fa-circle-notch fa-spin"></i> Sending Link...</>
                  ) : (
                    <><i className="fa-solid fa-paper-plane"></i> Send Password Reset Link</>
                  )}
                </button>
              </form>
            )}

            {/* STEP 2: Link Sent State */}
            {step === 'sent' && (
              <div className="verify-body">
                <div className="verify-icon-wrap">
                  <div className="verify-icon-ring">
                    <i className="fa-solid fa-key verify-icon"></i>
                  </div>
                </div>

                <div className="verify-steps">
                  <div className="verify-step">
                    <div className="verify-step-num">1</div>
                    <p>Open the password reset email sent to <strong>{email}</strong></p>
                  </div>
                  <div className="verify-step">
                    <div className="verify-step-num">2</div>
                    <p>Click <strong>"Reset My Password"</strong> in the email</p>
                  </div>
                  <div className="verify-step">
                    <div className="verify-step-num">3</div>
                    <p>Enter and save your new password</p>
                  </div>
                </div>

                {resendMsg && (
                  <div className="auth-success-banner" style={{ marginTop: '12px' }}>
                    <i className="fa-solid fa-circle-check"></i>
                    <span>{resendMsg}</span>
                  </div>
                )}

                <div className="verify-resend-section">
                  <p className="verify-hint">Didn't get the email? Check spam or resend link.</p>
                  <button
                    type="button"
                    className={`auth-btn-secondary verify-resend-btn ${canResend ? '' : 'disabled'}`}
                    onClick={handleResendLink}
                    disabled={!canResend}
                  >
                    {resendLoading ? (
                      <><i className="fa-solid fa-circle-notch fa-spin"></i> Sending...</>
                    ) : resendCooldown > 0 ? (
                      <><i className="fa-solid fa-clock"></i> Resend link in {resendCooldown}s</>
                    ) : (
                      <><i className="fa-solid fa-rotate-right"></i> Resend Reset Link</>
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

                <button
                  type="button"
                  className="auth-btn-secondary"
                  style={{ marginTop: '16px' }}
                  onClick={() => { setStep('request'); setError(null); setMessage(null); }}
                >
                  <i className="fa-solid fa-arrow-left"></i> Enter Different Email
                </button>
              </div>
            )}

            {/* STEP 3: Enter New Password (when link token clicked) */}
            {step === 'new-password' && (
              <form onSubmit={handleNewPasswordSubmit} className="auth-form">
                <div className="auth-field">
                  <label htmlFor="new-password">New Password</label>
                  <div className="auth-input-wrapper">
                    <i className="fa-solid fa-lock auth-input-icon"></i>
                    <input
                      id="new-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="Min. 6 characters"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="auth-toggle-pwd"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                    </button>
                  </div>
                </div>

                <div className="auth-field">
                  <label htmlFor="confirm-password">Confirm New Password</label>
                  <div className="auth-input-wrapper">
                    <i className="fa-solid fa-shield-halved auth-input-icon"></i>
                    <input
                      id="confirm-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="Re-enter new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      autoComplete="new-password"
                    />
                    {confirmPassword && (
                      <i
                        className={`fa-solid ${confirmPassword === newPassword ? 'fa-check auth-match-ok' : 'fa-xmark auth-match-err'}`}
                        style={{ position: 'absolute', right: '44px', top: '50%', transform: 'translateY(-50%)' }}
                      ></i>
                    )}
                  </div>
                </div>

                <button type="submit" className="auth-btn-primary" disabled={loading}>
                  {loading ? (
                    <><i className="fa-solid fa-circle-notch fa-spin"></i> Saving Password...</>
                  ) : (
                    <><i className="fa-solid fa-check-double"></i> Save New Password</>
                  )}
                </button>
              </form>
            )}
          </>
        )}

        <div className="auth-footer" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '18px', marginTop: '14px' }}>
          Remember your password?{' '}
          <button type="button" className="auth-link" onClick={onNavigateLogin}>
            Sign In
          </button>
        </div>
      </div>
    </div>
  );
};
