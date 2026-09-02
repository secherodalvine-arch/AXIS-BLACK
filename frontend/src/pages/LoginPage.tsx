import React, { useState } from 'react';
import { loginApi, resendVerificationApi } from '../utils/api';

interface LoginPageProps {
  onLoginSuccess: (name: string, email: string) => void;
  onNavigateRegister: () => void;
  onNavigateForgotPassword: () => void;
  onBackToHome: () => void;
  onVerificationRequired?: (email: string) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onLoginSuccess,
  onNavigateRegister,
  onNavigateForgotPassword,
  onBackToHome,
  onVerificationRequired,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }
    setError(null);
    setUnverifiedEmail(null);
    setResendMessage(null);
    setLoading(true);

    try {
      const res = await loginApi(email, password);
      onLoginSuccess(res.name, res.email);
    } catch (err: any) {
      if (err.status === 403 || err.requiresVerification) {
        // Unverified account
        setUnverifiedEmail(err.email || email.toLowerCase().trim());
        setError(null);
      } else {
        setError(err.message || 'Login failed. Please check your credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!unverifiedEmail || resendLoading) return;
    setResendLoading(true);
    setResendMessage(null);
    try {
      const res = await resendVerificationApi(unverifiedEmail);
      setResendMessage(res.message || 'Verification email sent. Check your inbox.');
      if (onVerificationRequired) {
        setTimeout(() => onVerificationRequired(unverifiedEmail), 1500);
      }
    } catch (err: any) {
      setResendMessage(err.message || 'Failed to resend. Please try again.');
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-glow auth-glow-cyan"></div>
      <div className="auth-glow auth-glow-lilac"></div>

      <button className="auth-back-btn" onClick={onBackToHome}>
        <i className="fa-solid fa-arrow-left"></i> Back to Axis Black
      </button>

      <div className="auth-card glass-card">
        <div className="auth-header">
          <div className="auth-brand" onClick={onBackToHome} style={{ cursor: 'pointer' }} title="Return to Homepage">
            <img src="/compass_icon.png" alt="Axis Black" className="auth-logo" />
            <span className="auth-wordmark">AXIS<span>BLACK</span></span>
          </div>
          <h2 className="auth-title">Welcome Back</h2>
          <p className="auth-subtitle">Sign in to your business intelligence command center</p>
        </div>

        {/* Unverified account banner */}
        {unverifiedEmail && (
          <div className="auth-verify-banner">
            <div className="auth-verify-banner-header">
              <i className="fa-solid fa-envelope-circle-check"></i>
              <strong>Email not verified</strong>
            </div>
            <p>Your account (<strong>{unverifiedEmail}</strong>) hasn't been verified yet. Check your inbox for the verification link.</p>
            {resendMessage ? (
              <p className="auth-verify-resent">{resendMessage}</p>
            ) : (
              <button
                type="button"
                className="auth-verify-resend-btn"
                onClick={handleResendVerification}
                disabled={resendLoading}
              >
                {resendLoading ? (
                  <><i className="fa-solid fa-circle-notch fa-spin"></i> Sending...</>
                ) : (
                  <><i className="fa-solid fa-paper-plane"></i> Resend verification email</>
                )}
              </button>
            )}
          </div>
        )}

        {error && (
          <div className="auth-error-banner">
            <i className="fa-solid fa-triangle-exclamation"></i>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-field">
            <label htmlFor="login-email">Email Address</label>
            <div className="auth-input-wrapper">
              <i className="fa-solid fa-envelope auth-input-icon"></i>
              <input
                id="login-email"
                type="email"
                required
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
          </div>

          <div className="auth-field">
            <div className="auth-field-header">
              <label htmlFor="login-password">Password</label>
              <button
                type="button"
                className="auth-link-sm"
                onClick={onNavigateForgotPassword}
              >
                Forgot password?
              </button>
            </div>
            <div className="auth-input-wrapper">
              <i className="fa-solid fa-lock auth-input-icon"></i>
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="auth-toggle-pwd"
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? 'Hide Password' : 'Show Password'}
              >
                <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="auth-btn-primary"
            disabled={loading}
          >
            {loading ? (
              <>
                <i className="fa-solid fa-circle-notch fa-spin"></i> Signing in...
              </>
            ) : (
              <>
                <i className="fa-solid fa-right-to-bracket"></i> Sign In
              </>
            )}
          </button>
        </form>

        <div className="auth-footer">
          Don't have an account?{' '}
          <button type="button" className="auth-link" onClick={onNavigateRegister}>
            Create an Account
          </button>
        </div>
      </div>
    </div>
  );
};
