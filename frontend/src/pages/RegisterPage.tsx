import React, { useState } from 'react';
import { Currency } from '../types';
import { registerApi } from '../utils/api';

interface RegisterPageProps {
  onVerificationRequired: (email: string) => void;
  onNavigateLogin: () => void;
  onBackToHome: () => void;
}

const CURRENCIES: { value: Currency; label: string }[] = [
  { value: 'USD', label: '🇺🇸 USD — US Dollar' },
  { value: 'KES', label: '🇰🇪 KES — Kenya Shilling' },
];

export const RegisterPage: React.FC<RegisterPageProps> = ({
  onVerificationRequired,
  onNavigateLogin,
  onBackToHome,
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currency, setCurrency] = useState<Currency>('USD');
  const [salary, setSalary] = useState<number | ''>('');
  const [incomeFrequency, setIncomeFrequency] = useState<'monthly' | 'weekly' | 'daily'>('monthly');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getPasswordStrength = (pwd: string): { label: string; color: string; width: string } => {
    if (pwd.length === 0) return { label: '', color: 'transparent', width: '0%' };
    if (pwd.length < 6) return { label: 'Too short', color: '#ef4444', width: '20%' };
    if (pwd.length < 8) return { label: 'Weak', color: '#f97316', width: '40%' };
    if (!/[A-Z]/.test(pwd) || !/[0-9]/.test(pwd)) return { label: 'Fair', color: '#eab308', width: '60%' };
    if (!/[^A-Za-z0-9]/.test(pwd)) return { label: 'Good', color: '#22c55e', width: '80%' };
    return { label: 'Strong', color: '#00d4ff', width: '100%' };
  };

  const strength = getPasswordStrength(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) {
      setError('Please fill in all required fields.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (!salary || Number(salary) <= 0) {
      setError('Please enter your monthly income or revenue.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const res = await registerApi({
        name,
        email,
        password,
        currency,
        salary: Number(salary),
        income_frequency: incomeFrequency,
        city: 'Nairobi',
        country: 'Kenya',
      });
      // Navigate to verification page with the registered email
      onVerificationRequired(res.email || email.toLowerCase().trim());
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-glow auth-glow-cyan"></div>
      <div className="auth-glow auth-glow-lilac"></div>

      <button className="auth-back-btn" onClick={onBackToHome}>
        <i className="fa-solid fa-arrow-left"></i> Back to Axis Black
      </button>

      <div className="auth-card glass-card" style={{ maxWidth: '500px' }}>
        <div className="auth-header">
          <div className="auth-brand" onClick={onBackToHome} style={{ cursor: 'pointer' }} title="Return to Homepage">
            <img src="/compass_icon.png" alt="Axis Black" className="auth-logo" />
            <span className="auth-wordmark">AXIS<span>BLACK</span></span>
          </div>
          <h2 className="auth-title">Create Account</h2>
          <p className="auth-subtitle">Join Africa's boldest operators & unlock AI financial intelligence</p>
        </div>

        {error && (
          <div className="auth-error-banner">
            <i className="fa-solid fa-triangle-exclamation"></i>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          {/* Full Name */}
          <div className="auth-field">
            <label htmlFor="reg-name">Full Name <span className="auth-required">*</span></label>
            <div className="auth-input-wrapper">
              <i className="fa-solid fa-user auth-input-icon"></i>
              <input
                id="reg-name"
                type="text"
                required
                placeholder="Your full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
              />
            </div>
          </div>

          {/* Email */}
          <div className="auth-field">
            <label htmlFor="reg-email">Email Address <span className="auth-required">*</span></label>
            <div className="auth-input-wrapper">
              <i className="fa-solid fa-envelope auth-input-icon"></i>
              <input
                id="reg-email"
                type="email"
                required
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
          </div>

          {/* Password */}
          <div className="auth-field">
            <label htmlFor="reg-password">Password <span className="auth-required">*</span></label>
            <div className="auth-input-wrapper">
              <i className="fa-solid fa-lock auth-input-icon"></i>
              <input
                id="reg-password"
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="Min. 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
            {password && (
              <div className="auth-password-strength">
                <div className="auth-password-bar">
                  <div className="auth-password-fill" style={{ width: strength.width, background: strength.color }} />
                </div>
                <span style={{ color: strength.color, fontSize: '11px' }}>{strength.label}</span>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div className="auth-field">
            <label htmlFor="reg-confirm">Confirm Password <span className="auth-required">*</span></label>
            <div className="auth-input-wrapper">
              <i className="fa-solid fa-shield-halved auth-input-icon"></i>
              <input
                id="reg-confirm"
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
              {confirmPassword && (
                <i
                  className={`fa-solid ${confirmPassword === password ? 'fa-check auth-match-ok' : 'fa-xmark auth-match-err'}`}
                  style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)' }}
                ></i>
              )}
            </div>
          </div>

          {/* Income */}
          <div className="auth-row-two">
            <div className="auth-field">
              <label htmlFor="reg-frequency">Income Frequency</label>
              <select
                id="reg-frequency"
                value={incomeFrequency}
                onChange={(e) => setIncomeFrequency(e.target.value as any)}
                className="auth-select"
              >
                <option value="monthly">Monthly</option>
                <option value="weekly">Weekly</option>
                <option value="daily">Daily</option>
              </select>
            </div>

            <div className="auth-field">
              <label htmlFor="reg-salary">Income Amount <span className="auth-required">*</span></label>
              <div className="auth-input-wrapper">
                <i className="fa-solid fa-money-bill-wave auth-input-icon"></i>
                <input
                  id="reg-salary"
                  type="number"
                  required
                  placeholder="e.g. 5000"
                  min={1}
                  value={salary}
                  onChange={(e) => setSalary(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </div>
            </div>
          </div>

          {/* Currency */}
          <div className="auth-field">
            <label htmlFor="reg-currency">Base Currency</label>
            <select
              id="reg-currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value as Currency)}
              className="auth-select"
            >
              {CURRENCIES.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            className="auth-btn-primary"
            disabled={loading}
            style={{ marginTop: '8px' }}
          >
            {loading ? (
              <>
                <i className="fa-solid fa-circle-notch fa-spin"></i> Creating Account...
              </>
            ) : (
              <>
                <i className="fa-solid fa-user-plus"></i> Create Account
              </>
            )}
          </button>

          <p className="auth-terms">
            By creating an account, you agree to our{' '}
            <span className="auth-link-inline">Terms of Service</span> and{' '}
            <span className="auth-link-inline">Privacy Policy</span>.
          </p>
        </form>

        <div className="auth-footer">
          Already have an account?{' '}
          <button type="button" className="auth-link" onClick={onNavigateLogin}>
            Sign In
          </button>
        </div>
      </div>
    </div>
  );
};
