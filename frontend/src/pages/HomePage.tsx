import React, { useEffect, useRef, useState } from 'react';
import { sendSupportMessageApi } from '../utils/api';

interface HomePageProps {
  onEnterDashboard: () => void;
  onNavigateLogin?: () => void;
  onNavigateRegister?: () => void;
}

export type HomeView = 'home' | 'learn-more' | 'about' | 'contact' | 'privacy';

const XIcon: React.FC<{ size?: number; color?: string; style?: React.CSSProperties }> = ({ size = 16, color = 'currentColor', style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={{ display: 'inline-block', verticalAlign: 'middle', ...style }}>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const FEATURES = [
  { icon: 'fa-chart-line', color: '#00d4ff', glow: 'rgba(0, 212, 255, 0.3)', title: 'Financial Growth', desc: 'Track your revenue, profit margins, and daily expenses in clear, easy-to-read charts.', badge: 'Visual Charts' },
  { icon: 'fa-boxes-stacked', color: '#cebdff', glow: 'rgba(206, 189, 255, 0.3)', title: 'Inventory Management', desc: 'Real-time stock tracking, low-inventory alerts, and simple product management across your business.', badge: 'Live Stock' },
  { icon: 'fa-coins', color: '#a78bfa', glow: 'rgba(167, 139, 250, 0.3)', title: 'Multi-Currency Flow', desc: 'Keep all transactions organized with built-in support for US Dollars (USD) and Kenya Shillings (KES).', badge: 'USD & KES' },
  { icon: 'fa-square-poll-vertical', color: '#00d4ff', glow: 'rgba(0, 212, 255, 0.3)', title: 'Business Analytics', desc: '12-month business performance tracking with simple monthly summaries and helpful trend insights.', badge: 'Analytics' },
  { icon: 'fa-cubes-stacked', color: '#cebdff', glow: 'rgba(206, 189, 255, 0.3)', title: 'Runway Simulator', desc: 'Plan ahead to see how long your cash will last, track monthly spending, and test new hiring or costs safely.', badge: 'Cash Planning' },
  { icon: 'fa-receipt', color: '#a78bfa', glow: 'rgba(167, 139, 250, 0.3)', title: 'Ledger & Transactions', desc: 'Simple record-keeping for money coming in and going out, with one-click downloads whenever you need them.', badge: 'Clean Records' },
];

const OFFICES = [
  { city: 'Ruiru', country: 'Kenya', address: 'Ruiru, Kiambu County, Kenya', email: 'secherodalvine@gmail.com', phone: '+254 769 231 760', icon: 'fa-location-dot' },
  { city: 'Nairobi', country: 'Kenya', address: 'Westlands Business Park, Waiyaki Way, Nairobi 00100', email: 'secherodalvine@gmail.com', phone: '+254 769 231 760', icon: 'fa-building' },
];

const PRIVACY_SECTIONS = [
  {
    id: '1',
    title: '1. Information We Collect',
    content: [
      { sub: 'Account & Identity Data', text: 'When you register for Axis Black, we collect your name, email address, company name, job title, and billing information to provide access to our platform.' },
      { sub: 'Financial & Operational Data', text: 'We process financial data that you input or import into the platform, including transaction records, revenue figures, expense data, inventory records, and cash flow projections.' },
      { sub: 'Usage & Communication Data', text: 'We collect standard app usage information to keep the platform fast and reliable, along with messages sent to our support team.' },
    ],
  },
  {
    id: '2',
    title: '2. How We Use Your Information',
    content: [
      { sub: 'Service Delivery & Business Insights', text: 'Your business numbers are processed privately to calculate your profits, cash flow, and runway estimates. We never sell your data or share it with third parties.' },
      { sub: 'Security & Compliance', text: 'To detect unauthorized access and comply with applicable data protection regulations including the Kenya Data Protection Act (2019) and GDPR.' },
    ],
  },
  {
    id: '3',
    title: '3. Data Security & Your Rights',
    content: [
      { sub: 'Security Standard', text: 'Bank-grade encryption protects your information at all times, both in storage and during transmission.' },
      { sub: 'Your Rights', text: 'Full right to view, download, correct, or delete your information at any time by contacting secherodalvine@gmail.com.' },
    ],
  },
];

const PREVIEW_MONTHS = [
  { month: 'Jan', revenue: 68, expenses: 38, net: 30 },
  { month: 'Feb', revenue: 75, expenses: 40, net: 35 },
  { month: 'Mar', revenue: 84, expenses: 42, net: 42 },
  { month: 'Apr', revenue: 92, expenses: 45, net: 47 },
  { month: 'May', revenue: 102, expenses: 48, net: 54 },
  { month: 'Jun', revenue: 112, expenses: 51, net: 61 },
];

export const HomePage: React.FC<HomePageProps> = ({
  onEnterDashboard,
  onNavigateLogin,
  onNavigateRegister
}) => {
  const [currentView, setCurrentView] = useState<HomeView>('home');
  const [visible, setVisible] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeFeature, setActiveFeature] = useState<number | null>(null);
  const [contactForm, setContactForm] = useState({ name: '', email: '', company: '', subject: '', message: '' });
  const [contactSubmitted, setContactSubmitted] = useState(false);
  const [submittingContact, setSubmittingContact] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);
  const [hoveredPreviewMonth, setHoveredPreviewMonth] = useState<number | null>(5); // default Jun
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 60);
    return () => clearTimeout(t);
  }, []);

  const navigateTo = (view: HomeView) => {
    setCurrentView(view);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const scrollToTop = () => {
    if (currentView !== 'home') {
      setCurrentView('home');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
          }
        });
      },
      { threshold: 0.12 }
    );

    const elements = document.querySelectorAll('.scroll-reveal');
    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [visible, currentView]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf: number;
    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; };
    resize();
    window.addEventListener('resize', resize);
    const particles = Array.from({ length: 45 }, () => ({
      x: Math.random() * canvas.width, y: Math.random() * canvas.height,
      r: Math.random() * 1.4 + 0.4, vx: (Math.random() - 0.5) * 0.25, vy: (Math.random() - 0.5) * 0.25,
      color: Math.random() > 0.5 ? '#00d4ff' : '#cebdff', alpha: Math.random() * 0.5 + 0.15,
    }));
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = canvas.width; if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height; if (p.y > canvas.height) p.y = 0;
        ctx.save(); ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.color; ctx.globalAlpha = p.alpha;
        ctx.shadowBlur = 8; ctx.shadowColor = p.color; ctx.fill(); ctx.restore();
      });
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { window.removeEventListener('resize', resize); cancelAnimationFrame(raf); };
  }, []);

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactForm.name || !contactForm.email || !contactForm.message) return;

    setSubmittingContact(true);
    setContactError(null);

    try {
      await sendSupportMessageApi({
        name: contactForm.name,
        email: contactForm.email,
        message: contactForm.message,
        label: contactForm.subject || 'support',
      });
      setContactSubmitted(true);
    } catch (err: any) {
      setContactError(err.message || 'Failed to send message. Please try again.');
    } finally {
      setSubmittingContact(false);
    }
  };

  const activeMonthData = hoveredPreviewMonth !== null ? PREVIEW_MONTHS[hoveredPreviewMonth] : PREVIEW_MONTHS[5];

  return (
    <div className="home-page" style={{ opacity: visible ? 1 : 0, transition: 'opacity 0.6s ease' }}>
      <canvas ref={canvasRef} className="home-particle-canvas" />
      <div className="home-glow home-glow-cyan" />
      <div className="home-glow home-glow-lilac" />

      {/* HEADER NAV */}
      <header className="home-nav">
        <div
          className="home-nav-brand"
          onClick={scrollToTop}
          style={{ cursor: 'pointer' }}
          title="Back to Home"
        >
          <img src="/compass_icon.png" alt="Axis Black" className="home-nav-logo" />
          <span className="home-nav-wordmark">AXIS<span>BLACK</span></span>
        </div>

        {/* Desktop Nav Links */}
        <nav className="home-nav-links">
          <button className={`home-nav-link ${currentView === 'home' ? 'active' : ''}`} onClick={() => navigateTo('home')}>Home</button>
          <button className={`home-nav-link ${currentView === 'learn-more' ? 'active' : ''}`} onClick={() => navigateTo('learn-more')}>Learn More</button>
          <button className={`home-nav-link ${currentView === 'about' ? 'active' : ''}`} onClick={() => navigateTo('about')}>About Us</button>
          <button className={`home-nav-link ${currentView === 'contact' ? 'active' : ''}`} onClick={() => navigateTo('contact')}>Contact</button>
          {onNavigateLogin && (
            <button className="home-nav-link" onClick={onNavigateLogin}>
              <i className="fa-solid fa-right-to-bracket"></i> Sign In
            </button>
          )}
          {onNavigateRegister ? (
            <button className="home-nav-cta" onClick={onNavigateRegister}>
              <i className="fa-solid fa-rocket"></i> Get Started
            </button>
          ) : (
            <button className="home-nav-cta" onClick={onNavigateLogin}>
              <i className="fa-solid fa-right-to-bracket"></i> Sign In
            </button>
          )}
        </nav>

        {/* Mobile Hamburger Toggle Button */}
        <button
          className={`home-mobile-menu-btn ${mobileMenuOpen ? 'open' : ''}`}
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle Mobile Menu"
        >
          <i className={`fa-solid ${mobileMenuOpen ? 'fa-xmark' : 'fa-bars'}`}></i>
        </button>
      </header>

      {/* MOBILE NAVIGATION DRAWER */}
      <div className={`home-mobile-drawer ${mobileMenuOpen ? 'open' : ''}`}>
        <div className="home-mobile-drawer-inner">
          <button className={`home-mobile-nav-link ${currentView === 'home' ? 'active' : ''}`} onClick={() => navigateTo('home')}>
            <i className="fa-solid fa-house"></i> Home
          </button>
          <button className={`home-mobile-nav-link ${currentView === 'learn-more' ? 'active' : ''}`} onClick={() => navigateTo('learn-more')}>
            <i className="fa-solid fa-compass"></i> Learn More
          </button>
          <button className={`home-mobile-nav-link ${currentView === 'about' ? 'active' : ''}`} onClick={() => navigateTo('about')}>
            <i className="fa-solid fa-circle-info"></i> About Us
          </button>
          <button className={`home-mobile-nav-link ${currentView === 'contact' ? 'active' : ''}`} onClick={() => navigateTo('contact')}>
            <i className="fa-solid fa-envelope"></i> Contact
          </button>
          <div className="home-mobile-drawer-divider"></div>
          {onNavigateLogin && (
            <button className="home-mobile-nav-link" onClick={() => { onNavigateLogin?.(); setMobileMenuOpen(false); }}>
              <i className="fa-solid fa-right-to-bracket"></i> Sign In
            </button>
          )}
          {onNavigateRegister ? (
            <button className="home-mobile-cta-btn" onClick={() => { onNavigateRegister?.(); setMobileMenuOpen(false); }}>
              <i className="fa-solid fa-rocket"></i> Get Started
            </button>
          ) : (
            <button className="home-mobile-cta-btn" onClick={() => { onNavigateLogin?.(); setMobileMenuOpen(false); }}>
              <i className="fa-solid fa-right-to-bracket"></i> Sign In
            </button>
          )}
        </div>
      </div>

      {/* VIEW: HOME LANDING VIEW */}
      {currentView === 'home' && (
        <>
          {/* HERO SECTION CONTAINER */}
          <section
            className="home-hero-container scroll-reveal"
            style={{
              width: '100%',
              maxWidth: '100%',
              margin: '0',
              padding: '70px 4% 60px 4%',
              borderRadius: '0',
              overflow: 'hidden',
              position: 'relative',
              borderBottom: '1px solid rgba(0, 212, 255, 0.2)',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.7)',
              backgroundImage: 'linear-gradient(180deg, rgba(10, 10, 15, 0.86) 0%, rgba(10, 10, 15, 0.97) 100%), url("/hero_financial_bg.png")',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat'
            }}
          >
            <div style={{ textAlign: 'center', maxWidth: '960px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <h1 className="home-hero-title">
                Take Control of Your<br />
                <span className="home-hero-gradient">Business Finances</span>
              </h1>
              <p className="home-hero-sub">
                Axis Black brings your transactions, inventory, cash flow, and runway predictions into one clear workspace. Built for business owners and operators who want clarity, control, and peace of mind.
              </p>
              <div className="home-hero-actions">
                <button className="home-btn-primary" onClick={onNavigateRegister || onNavigateLogin}>
                  <i className="fa-solid fa-user-plus"></i> Create Account
                </button>
                <button className="home-btn-ghost" onClick={() => navigateTo('learn-more')}>
                  <i className="fa-solid fa-circle-info"></i> Learn More
                </button>
              </div>
            </div>

            {/* NEW ATTRACTIVE EXECUTIVE DASHBOARD PREVIEW (COPYING APP DASHBOARD DESIGN) */}
            <div className="home-hero-preview" style={{ marginTop: '48px', maxWidth: '1120px', width: '100%', margin: '48px auto 0 auto' }}>
              
              {/* MacOS Mockup Window Bar */}
              <div className="home-preview-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px', background: 'rgba(18, 18, 24, 0.95)', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="home-preview-dot" style={{ background: '#ff5f57' }}></span>
                  <span className="home-preview-dot" style={{ background: '#febc2e' }}></span>
                  <span className="home-preview-dot" style={{ background: '#28c840' }}></span>
                  <span style={{ fontSize: '0.8rem', color: '#9ca3af', fontFamily: 'JetBrains Mono', marginLeft: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <i className="fa-solid fa-gauge-high" style={{ color: '#00d4ff' }}></i> Dashboard · Live Financial Overview
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: '#4ade80', background: 'rgba(74, 222, 128, 0.12)', border: '1px solid rgba(74, 222, 128, 0.3)', padding: '3px 10px', borderRadius: '12px', fontFamily: 'JetBrains Mono', fontWeight: 600 }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 6px #4ade80' }}></span>
                    LIVE METRICS (USD)
                  </span>
                </div>
              </div>

              <div className="home-preview-body" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', background: '#0e0e13' }}>
                
                {/* 1. Automated Business Financial Insight Banner */}
                <div style={{ background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.12), rgba(167, 139, 250, 0.08))', border: '1px solid rgba(0, 212, 255, 0.25)', borderRadius: '12px', padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: 'rgba(0, 212, 255, 0.2)', color: '#00d4ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', flexShrink: 0 }}>
                      <i className="fa-solid fa-wand-magic-sparkles"></i>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#ffffff', fontFamily: 'Plus Jakarta Sans' }}>
                        Automated Financial Summary: Positive Cash Position &amp; Healthy Runway
                      </div>
                      <div style={{ fontSize: '0.76rem', color: '#9ca3af', marginTop: '2px' }}>
                        Operating profit margin is healthy at 56.2%. Cash reserves are projected to last 14.8 months at current spending.
                      </div>
                    </div>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: '#00d4ff', fontFamily: 'JetBrains Mono', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <i className="fa-solid fa-arrow-trend-up"></i> +18.4% MOM
                  </span>
                </div>

                {/* 2. Executive 4 KPI Summary Cards (Identical to DashboardPage) */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px' }}>
                  
                  {/* Total Revenue */}
                  <div style={{ background: 'rgba(255, 255, 255, 0.025)', border: '1px solid rgba(0, 212, 255, 0.25)', borderRadius: '14px', padding: '16px 18px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontSize: '0.72rem', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total Revenue</span>
                      <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'rgba(0, 212, 255, 0.15)', color: '#00d4ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem' }}>
                        <i className="fa-solid fa-arrow-trend-up"></i>
                      </div>
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ffffff', fontFamily: 'JetBrains Mono' }}>$452,000</div>
                    <div style={{ fontSize: '0.72rem', color: '#4ade80', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <i className="fa-solid fa-circle-check"></i> Money In · Verified
                    </div>
                  </div>

                  {/* Operating Expenses */}
                  <div style={{ background: 'rgba(255, 255, 255, 0.025)', border: '1px solid rgba(206, 189, 255, 0.25)', borderRadius: '14px', padding: '16px 18px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontSize: '0.72rem', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Operating Expenses</span>
                      <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'rgba(206, 189, 255, 0.15)', color: '#cebdff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem' }}>
                        <i className="fa-solid fa-receipt"></i>
                      </div>
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ffffff', fontFamily: 'JetBrains Mono' }}>$198,000</div>
                    <div style={{ fontSize: '0.72rem', color: '#cebdff', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <i className="fa-solid fa-arrow-trend-down"></i> Money Out · Running Costs &amp; Bills
                    </div>
                  </div>

                  {/* Net Cash */}
                  <div style={{ background: 'rgba(255, 255, 255, 0.025)', border: '1px solid rgba(74, 222, 128, 0.28)', borderRadius: '14px', padding: '16px 18px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontSize: '0.72rem', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Net Cash / Profit</span>
                      <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'rgba(74, 222, 128, 0.15)', color: '#4ade80', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem' }}>
                        <i className="fa-solid fa-wallet"></i>
                      </div>
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#4ade80', fontFamily: 'JetBrains Mono' }}>+$254,000</div>
                    <div style={{ fontSize: '0.72rem', color: '#4ade80', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <i className="fa-solid fa-percent"></i> 56.2% Retained Margin
                    </div>
                  </div>

                  {/* Projected Runway */}
                  <div style={{ background: 'rgba(255, 255, 255, 0.025)', border: '1px solid rgba(0, 212, 255, 0.25)', borderRadius: '14px', padding: '16px 18px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontSize: '0.72rem', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Cash Runway</span>
                      <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'rgba(0, 212, 255, 0.15)', color: '#00d4ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem' }}>
                        <i className="fa-solid fa-hourglass-half"></i>
                      </div>
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#00d4ff', fontFamily: 'JetBrains Mono' }}>14.8 Months</div>
                    <div style={{ fontSize: '0.72rem', color: '#4ade80', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <i className="fa-solid fa-shield-halved"></i> Healthy Cash Buffer
                    </div>
                  </div>

                </div>

                {/* 3. Secondary Row: Financial Growth Chart + Capital Distribution */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
                  
                  {/* Left: Financial Growth & Cash Flow Chart */}
                  <div style={{ background: 'rgba(255, 255, 255, 0.02)', borderRadius: '14px', padding: '20px', border: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                        <div>
                          <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#fff', fontFamily: 'Plus Jakarta Sans', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <i className="fa-solid fa-chart-column" style={{ color: '#00d4ff' }}></i>
                            Financial Growth &amp; Cash Flow
                          </div>
                          <div style={{ fontSize: '0.74rem', color: '#9ca3af', marginTop: '2px' }}>
                            Monthly revenue vs. operating expenses with net margin
                          </div>
                        </div>

                        {/* Legend */}
                        <div style={{ display: 'flex', gap: '12px', fontSize: '0.74rem' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#e5e2e1' }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#00d4ff' }}></span> Revenue
                          </span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#e5e2e1' }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#cebdff' }}></span> Expenses
                          </span>
                        </div>
                      </div>

                      {/* Visual Bars Container */}
                      <div style={{ position: 'relative', height: '140px', width: '100%', display: 'flex', alignItems: 'flex-end', gap: '12px', paddingTop: '16px', paddingBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                        {PREVIEW_MONTHS.map((m, idx) => {
                          const isHovered = hoveredPreviewMonth === idx;
                          const revHeight = (m.revenue / 120) * 110;
                          const expHeight = (m.expenses / 120) * 110;
                          return (
                            <div
                              key={m.month}
                              onMouseEnter={() => setHoveredPreviewMonth(idx)}
                              style={{
                                flex: 1,
                                height: '100%',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'flex-end',
                                alignItems: 'center',
                                cursor: 'pointer',
                                transition: 'opacity 0.2s ease',
                                opacity: hoveredPreviewMonth !== null && !isHovered ? 0.7 : 1
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '100%', width: '100%', justifyContent: 'center' }}>
                                <div
                                  style={{
                                    width: '42%',
                                    maxWidth: '22px',
                                    height: `${revHeight}px`,
                                    background: isHovered ? '#3cd7ff' : '#00d4ff',
                                    borderRadius: '3px 3px 0 0',
                                    transition: 'all 0.2s ease'
                                  }}
                                />
                                <div
                                  style={{
                                    width: '42%',
                                    maxWidth: '22px',
                                    height: `${expHeight}px`,
                                    background: isHovered ? '#e0d4ff' : '#cebdff',
                                    borderRadius: '3px 3px 0 0',
                                    transition: 'all 0.2s ease'
                                  }}
                                />
                              </div>
                              <span style={{ fontSize: '0.72rem', color: isHovered ? '#00d4ff' : '#9ca3af', marginTop: '6px', fontFamily: 'JetBrains Mono', fontWeight: isHovered ? 700 : 500 }}>
                                {m.month}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Chart bottom inspect banner */}
                    <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', fontFamily: 'JetBrains Mono', color: '#9ca3af' }}>
                      <span>Selected: <strong style={{ color: '#00d4ff' }}>{activeMonthData.month}</strong> · Rev: ${activeMonthData.revenue}K</span>
                      <span style={{ color: '#4ade80', fontWeight: 700 }}>Net: +${activeMonthData.net}K</span>
                    </div>
                  </div>

                  {/* Right: Asset Allocation & Verified Activity */}
                  <div style={{ background: 'rgba(255, 255, 255, 0.02)', borderRadius: '14px', padding: '20px', border: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#fff', fontFamily: 'Plus Jakarta Sans', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <i className="fa-solid fa-pie-chart" style={{ color: '#a78bfa' }}></i>
                        Cash &amp; Asset Breakdown
                      </div>
                      <span style={{ fontSize: '0.72rem', color: '#9ca3af', fontFamily: 'JetBrains Mono' }}>Total: $740,000</span>
                    </div>

                    {/* Allocation Progress Bars */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#cbd5e1', marginBottom: '3px' }}>
                          <span>Available Cash in Bank</span>
                          <span style={{ color: '#00d4ff', fontFamily: 'JetBrains Mono', fontWeight: 600 }}>45% ($333,000)</span>
                        </div>
                        <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: '45%', height: '100%', background: '#00d4ff', borderRadius: '3px' }}></div>
                        </div>
                      </div>

                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#cbd5e1', marginBottom: '3px' }}>
                          <span>Inventory &amp; Stock on Hand</span>
                          <span style={{ color: '#cebdff', fontFamily: 'JetBrains Mono', fontWeight: 600 }}>35% ($259,000)</span>
                        </div>
                        <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: '35%', height: '100%', background: '#cebdff', borderRadius: '3px' }}></div>
                        </div>
                      </div>

                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#cbd5e1', marginBottom: '3px' }}>
                          <span>Money Owed by Customers</span>
                          <span style={{ color: '#a78bfa', fontFamily: 'JetBrains Mono', fontWeight: 600 }}>20% ($148,000)</span>
                        </div>
                        <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: '20%', height: '100%', background: '#a78bfa', borderRadius: '3px' }}></div>
                        </div>
                      </div>
                    </div>

                    {/* Quick Verified Ledger Entries Snippet */}
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span style={{ fontSize: '0.7rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Recent Verified Transactions</span>
                      
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', padding: '4px 0' }}>
                        <span style={{ color: '#ffffff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <i className="fa-solid fa-circle-check" style={{ color: '#4ade80', fontSize: '0.7rem' }}></i> Stripe Sales Settlement
                        </span>
                        <span style={{ color: '#4ade80', fontFamily: 'JetBrains Mono', fontWeight: 700 }}>+$14,200</span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', padding: '4px 0' }}>
                        <span style={{ color: '#ffffff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <i className="fa-solid fa-circle-check" style={{ color: '#4ade80', fontSize: '0.7rem' }}></i> Inventory Batch Restock
                        </span>
                        <span style={{ color: '#cebdff', fontFamily: 'JetBrains Mono', fontWeight: 700 }}>-$6,400</span>
                      </div>
                    </div>

                  </div>

                </div>

              </div>
            </div>
          </section>

          {/* FEATURES SECTION CONTAINER (WITHOUT "Platform Capabilities" EYEBROW BADGE) */}
          <section id="features" className="home-features scroll-reveal">
            <div className="home-section-header">
              <h2 className="home-section-title">Everything you need to run<br /><span className="home-hero-gradient">a thriving business</span></h2>
              <p className="home-section-sub">Six simple, connected tools to keep your money, stock, and records organized.</p>
            </div>
            <div className="home-features-grid">
              {FEATURES.map((f, i) => (
                <div
                  key={i}
                  className={`home-feature-card ${activeFeature === i ? 'hovered' : ''}`}
                  onMouseEnter={() => setActiveFeature(i)}
                  onMouseLeave={() => setActiveFeature(null)}
                  onClick={() => navigateTo('learn-more')}
                  style={{ '--f-color': f.color, '--f-glow': f.glow, cursor: 'pointer' } as React.CSSProperties}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '16px' }}>
                    <div className="home-feature-icon" style={{ background: f.glow, color: f.color, margin: 0 }}>
                      <i className={`fa-solid ${f.icon}`}></i>
                    </div>
                    <span style={{ fontSize: '0.72rem', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: f.color, padding: '4px 10px', borderRadius: '12px', fontWeight: 600 }}>
                      {f.badge}
                    </span>
                  </div>
                  <h3 className="home-feature-title">{f.title}</h3>
                  <p className="home-feature-desc">{f.desc}</p>
                  <div className="home-feature-arrow"><i className="fa-solid fa-arrow-right"></i></div>
                </div>
              ))}
            </div>
          </section>

          {/* CTA SECTION CONTAINER (WITHOUT "Ready to launch" BADGE) */}
          <section className="home-cta-section scroll-reveal">
            <div className="home-cta-card">
              <div className="home-cta-glow-cyan" />
              <div className="home-cta-glow-lilac" />
              <h2 className="home-cta-title">Your business dashboard<br />is ready</h2>
              <p className="home-cta-sub">Step into Axis Black and get clear, real-time control of your business finances.</p>
              <button className="home-btn-primary home-cta-btn" onClick={onEnterDashboard}>
                <i className="fa-solid fa-gauge-high"></i> Launch Dashboard
              </button>
            </div>
          </section>
        </>
      )}

      {/* VIEW: LEARN MORE PAGE */}
      {currentView === 'learn-more' && (
        <section className="info-section scroll-reveal" style={{ padding: '60px 5%', maxWidth: '1100px', width: '100%', margin: '0 auto' }}>
          <button className="home-back-btn" onClick={() => navigateTo('home')}>
            <i className="fa-solid fa-arrow-left"></i> Back to Home
          </button>
          
          <div className="home-section-header" style={{ textAlign: 'left', marginBottom: '40px' }}>
            <h1 className="home-section-title" style={{ fontSize: '2.5rem' }}>
              The Clear Workspace for<br />
              <span className="home-hero-gradient">Modern Business Operations</span>
            </h1>
            <p className="home-section-sub" style={{ margin: '14px 0 0 0', maxWidth: '800px', fontSize: '1.05rem', lineHeight: 1.6 }}>
              Axis Black brings your transactions, inventory, cash flow, and runway predictions into one real-time workspace. Built for business owners and operators who want clarity, control, and peace of mind.
            </p>
          </div>

          {/* Core Pillars in Depth */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '48px' }}>
            {FEATURES.map((f, i) => (
              <div key={i} style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', padding: '26px' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: f.glow, color: f.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', marginBottom: '16px' }}>
                  <i className={`fa-solid ${f.icon}`}></i>
                </div>
                <h3 style={{ color: '#fff', fontSize: '1.25rem', marginBottom: '8px', fontFamily: 'Plus Jakarta Sans' }}>{f.title}</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.6 }}>{f.desc}</p>
              </div>
            ))}
          </div>

          {/* 3 Step Workflow */}
          <div style={{ background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.08), rgba(167, 139, 250, 0.05))', border: '1px solid rgba(0, 212, 255, 0.2)', borderRadius: '20px', padding: '36px', marginBottom: '48px' }}>
            <h2 style={{ color: '#fff', fontSize: '1.6rem', marginBottom: '8px', fontFamily: 'Plus Jakarta Sans' }}>How It Works</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '28px', fontSize: '0.92rem' }}>From recording daily numbers to making smart business decisions in seconds.</p>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px' }}>
              <div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#00d4ff', fontFamily: 'JetBrains Mono', marginBottom: '8px' }}>01</div>
                <h4 style={{ color: '#fff', fontSize: '1.1rem', marginBottom: '6px' }}>Log or Import Data</h4>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.5 }}>Record daily sales, supplier costs, stock arrivals, or import CSV spreadsheets directly into your records.</p>
              </div>
              <div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#cebdff', fontFamily: 'JetBrains Mono', marginBottom: '8px' }}>02</div>
                <h4 style={{ color: '#fff', fontSize: '1.1rem', marginBottom: '6px' }}>Instant Automatic Calculations</h4>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.5 }}>Calculations happen in real time — profit margins, stock levels, and monthly spending adjust automatically.</p>
              </div>
              <div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#4ade80', fontFamily: 'JetBrains Mono', marginBottom: '8px' }}>03</div>
                <h4 style={{ color: '#fff', fontSize: '1.1rem', marginBottom: '6px' }}>Take Confident Action</h4>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.5 }}>Order inventory before stock runs out, test new hiring plans safely, and protect business profitability.</p>
              </div>
            </div>
          </div>

          {/* Bottom Action Card */}
          <div style={{ textAlign: 'center', padding: '32px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <h3 style={{ color: '#fff', fontSize: '1.4rem', marginBottom: '10px' }}>Experience Axis Black Today</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '20px', maxWidth: '560px', margin: '0 auto 24px auto' }}>
              Join business operators who have replaced scattered spreadsheets with real-time financial control.
            </p>
            <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="home-btn-primary" onClick={onNavigateRegister || onNavigateLogin}>
                <i className="fa-solid fa-rocket"></i> Create Account
              </button>
              <button className="home-btn-ghost" onClick={() => navigateTo('contact')}>
                <i className="fa-solid fa-envelope"></i> Talk to Us
              </button>
            </div>
          </div>
        </section>
      )}

      {/* VIEW: ABOUT US PAGE */}
      {currentView === 'about' && (
        <section className="info-section scroll-reveal" style={{ padding: '60px 5%', maxWidth: '1100px', width: '100%', margin: '0 auto' }}>
          <button className="home-back-btn" onClick={() => navigateTo('home')}>
            <i className="fa-solid fa-arrow-left"></i> Back to Home
          </button>

          <div className="home-section-header" style={{ textAlign: 'left', marginBottom: '40px' }}>
            <h1 className="home-section-title" style={{ fontSize: '2.5rem' }}>
              Built for businesses<br />
              <span className="home-hero-gradient">of every kind</span>
            </h1>
            <p className="home-section-sub" style={{ margin: '14px 0 0 0', maxWidth: '780px', fontSize: '1.05rem', lineHeight: 1.6 }}>
              Axis Black was built to eliminate spreadsheet chaos and bring clear, professional financial management to business owners and operators across Africa and worldwide.
            </p>
          </div>

          {/* Mission & Vision Containers */}
          <div className="info-two-col" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', marginBottom: '40px' }}>
            <div className="info-card info-card-cyan" style={{ background: 'rgba(0, 212, 255, 0.04)', border: '1px solid rgba(0, 212, 255, 0.2)', borderRadius: '16px', padding: '32px' }}>
              <div style={{ color: '#00d4ff', fontSize: '2rem', marginBottom: '16px' }}><i className="fa-solid fa-bullseye"></i></div>
              <h3 style={{ color: '#fff', fontSize: '1.4rem', marginBottom: '12px' }}>Our Mission</h3>
              <p style={{ color: 'var(--text-muted)', lineHeight: 1.7 }}>
                To make simple, powerful business financial tools accessible to every business — from local shops and startups to multi-branch companies — with clear visual tracking, honest bookkeeping, and easy multi-currency support at every stage of growth.
              </p>
            </div>
            <div className="info-card info-card-lilac" style={{ background: 'rgba(206, 189, 255, 0.04)', border: '1px solid rgba(206, 189, 255, 0.2)', borderRadius: '16px', padding: '32px' }}>
              <div style={{ color: '#cebdff', fontSize: '2rem', marginBottom: '16px' }}><i className="fa-solid fa-eye"></i></div>
              <h3 style={{ color: '#fff', fontSize: '1.4rem', marginBottom: '12px' }}>Our Vision</h3>
              <p style={{ color: 'var(--text-muted)', lineHeight: 1.7 }}>
                A world where every business owner has total clarity on their money, profits, and stock — with easy multi-currency support and tools built for real businesses.
              </p>
            </div>
          </div>

          {/* Regional Offices */}
          <div style={{ marginTop: '20px' }}>
            <h3 style={{ color: '#fff', fontSize: '1.3rem', marginBottom: '18px', fontFamily: 'Plus Jakarta Sans' }}>Our Regional Presence</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '18px' }}>
              {OFFICES.map((o, i) => (
                <div key={i} style={{ background: 'rgba(255, 255, 255, 0.025)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '14px', padding: '24px' }}>
                  <div style={{ fontSize: '1.15rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', fontWeight: 'bold' }}>
                    <i className={`fa-solid ${o.icon}`} style={{ color: '#00d4ff' }}></i>
                    <span>{o.city}, {o.country}</span>
                  </div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '14px', lineHeight: 1.5 }}>{o.address}</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem' }}>
                    <a href={`mailto:${o.email}`} style={{ color: '#00d4ff', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                      <i className="fa-solid fa-envelope"></i> {o.email}
                    </a>
                    <a href={`tel:${o.phone}`} style={{ color: '#cebdff', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                      <i className="fa-solid fa-phone"></i> {o.phone}
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* VIEW: CONTACT PAGE */}
      {currentView === 'contact' && (
        <section className="info-section scroll-reveal" style={{ padding: '60px 5%', maxWidth: '1100px', width: '100%', margin: '0 auto' }}>
          <button className="home-back-btn" onClick={() => navigateTo('home')}>
            <i className="fa-solid fa-arrow-left"></i> Back to Home
          </button>

          <div className="home-section-header" style={{ textAlign: 'left', marginBottom: '32px' }}>
            <h1 className="home-section-title" style={{ fontSize: '2.5rem' }}>
              We'd love to<br />
              <span className="home-hero-gradient">hear from you</span>
            </h1>
            <p className="home-section-sub" style={{ margin: '12px 0 0 0', maxWidth: '780px', fontSize: '1.05rem', lineHeight: 1.6 }}>
              Have questions, want a product walk-through, or ready to get started? Connect with our team directly or send us a message below.
            </p>
          </div>

          {/* PROMINENT DIRECT CONTACT CHANNELS CARD (AS REQUESTED) */}
          <div style={{ background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.1), rgba(167, 139, 250, 0.08))', border: '1px solid rgba(0, 212, 255, 0.3)', borderRadius: '18px', padding: '28px', marginBottom: '36px' }}>
            <h3 style={{ color: '#ffffff', fontSize: '1.25rem', marginBottom: '16px', fontFamily: 'Plus Jakarta Sans', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <i className="fa-solid fa-headset" style={{ color: '#00d4ff' }}></i> Direct Contact Channels
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
              
              {/* WhatsApp */}
              <a
                href="https://wa.me/254769231760"
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  background: 'rgba(37, 211, 102, 0.1)',
                  border: '1px solid rgba(37, 211, 102, 0.35)',
                  borderRadius: '12px',
                  padding: '14px 18px',
                  textDecoration: 'none',
                  color: '#ffffff',
                  transition: 'all 0.2s ease'
                }}
              >
                <i className="fa-brands fa-whatsapp" style={{ fontSize: '1.5rem', color: '#25D366' }}></i>
                <div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 700 }}>WhatsApp Chat</div>
                  <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Fast reply within minutes</div>
                </div>
              </a>

              {/* X (Twitter) */}
              <a
                href="https://x.com/Reino Forms"
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '12px',
                  padding: '14px 18px',
                  textDecoration: 'none',
                  color: '#ffffff',
                  transition: 'all 0.2s ease'
                }}
              >
                <XIcon size={20} color="#00d4ff" />
                <div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 700 }}>@axisblack</div>
                  <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Official announcements</div>
                </div>
              </a>

              {/* Email */}
              <a
                href="mailto:secherodalvine@gmail.com"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  background: 'rgba(206, 189, 255, 0.1)',
                  border: '1px solid rgba(206, 189, 255, 0.35)',
                  borderRadius: '12px',
                  padding: '14px 18px',
                  textDecoration: 'none',
                  color: '#ffffff',
                  transition: 'all 0.2s ease'
                }}
              >
                <i className="fa-solid fa-envelope" style={{ fontSize: '1.3rem', color: '#cebdff' }}></i>
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ fontSize: '0.88rem', fontWeight: 700 }}>secherodalvine@gmail.com</div>
                  <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Formal correspondence</div>
                </div>
              </a>

              {/* Phone */}
              <a
                href="tel:+254769231760"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  background: 'rgba(74, 222, 128, 0.1)',
                  border: '1px solid rgba(74, 222, 128, 0.35)',
                  borderRadius: '12px',
                  padding: '14px 18px',
                  textDecoration: 'none',
                  color: '#ffffff',
                  transition: 'all 0.2s ease'
                }}
              >
                <i className="fa-solid fa-phone" style={{ fontSize: '1.3rem', color: '#4ade80' }}></i>
                <div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 700 }}>+254 769 231 760</div>
                  <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Phone &amp; SMS support</div>
                </div>
              </a>

            </div>
          </div>

          {/* Form and Regional Offices Layout */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '32px' }}>
            
            {/* Contact Form */}
            <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '20px', padding: '32px' }}>
              <h3 style={{ color: '#fff', fontSize: '1.25rem', marginBottom: '16px' }}>Send Us a Direct Message</h3>
              {contactSubmitted ? (
                <div style={{ textAlign: 'center', padding: '24px 0' }}>
                  <i className="fa-solid fa-circle-check" style={{ fontSize: '3rem', color: '#00d4ff', marginBottom: '16px' }}></i>
                  <h3 style={{ color: '#fff', fontSize: '1.4rem' }}>Message Received!</h3>
                  <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>Thank you, <strong>{contactForm.name}</strong>. Our team will contact <strong>{contactForm.email}</strong> within 24 hours.</p>
                  <button className="home-btn-primary" style={{ marginTop: '24px' }} onClick={() => setContactSubmitted(false)}>
                    Send Another Message
                  </button>
                </div>
              ) : (
                <form onSubmit={handleContactSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {contactError && (
                    <div className="auth-error-banner" style={{ marginBottom: '4px' }}>
                      <i className="fa-solid fa-triangle-exclamation"></i>
                      <span>{contactError}</span>
                    </div>
                  )}
                  <div>
                    <label style={{ color: '#cebdff', fontSize: '0.85rem', marginBottom: '6px', display: 'block' }}>Full Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="Your full name"
                      value={contactForm.name}
                      onChange={e => setContactForm({ ...contactForm, name: e.target.value })}
                      style={{ width: '100%', padding: '12px 16px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', color: '#fff' }}
                    />
                  </div>
                  <div>
                    <label style={{ color: '#cebdff', fontSize: '0.85rem', marginBottom: '6px', display: 'block' }}>Email Address *</label>
                    <input
                      type="email"
                      required
                      placeholder="email@company.com"
                      value={contactForm.email}
                      onChange={e => setContactForm({ ...contactForm, email: e.target.value })}
                      style={{ width: '100%', padding: '12px 16px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', color: '#fff' }}
                    />
                  </div>
                  <div>
                    <label style={{ color: '#cebdff', fontSize: '0.85rem', marginBottom: '6px', display: 'block' }}>Subject *</label>
                    <select
                      required
                      value={contactForm.subject}
                      onChange={e => setContactForm({ ...contactForm, subject: e.target.value })}
                      style={{ width: '100%', padding: '12px 16px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', color: '#fff' }}
                    >
                      <option value="">Select a subject...</option>
                      <option value="Demo">Product Walkthrough</option>
                      <option value="Pricing">Pricing &amp; Plans</option>
                      <option value="Support">Customer Support</option>
                      <option value="Partnership">Partnerships</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ color: '#cebdff', fontSize: '0.85rem', marginBottom: '6px', display: 'block' }}>Message *</label>
                    <textarea
                      required
                      rows={4}
                      placeholder="Tell us how we can help..."
                      value={contactForm.message}
                      onChange={e => setContactForm({ ...contactForm, message: e.target.value })}
                      style={{ width: '100%', padding: '12px 16px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', color: '#fff' }}
                    />
                  </div>
                  <button
                    type="submit"
                    className="home-btn-primary"
                    disabled={submittingContact}
                    style={{ width: '100%', justifyContent: 'center', marginTop: '8px', opacity: submittingContact ? 0.7 : 1 }}
                  >
                    {submittingContact ? (
                      <>
                        <i className="fa-solid fa-circle-notch fa-spin"></i> Sending Message...
                      </>
                    ) : (
                      <>
                        <i className="fa-solid fa-paper-plane"></i> Send Message
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>

            {/* Regional Offices Column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <h3 style={{ color: '#fff', fontSize: '1.25rem' }}>Our Regional Offices</h3>
              {OFFICES.map((o, i) => (
                <div key={i} style={{ background: 'rgba(255, 255, 255, 0.025)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '14px', padding: '22px' }}>
                  <div style={{ fontSize: '1.15rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', fontWeight: 'bold' }}>
                    <i className={`fa-solid ${o.icon}`} style={{ color: '#00d4ff' }}></i>
                    <span>{o.city}, {o.country}</span>
                  </div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '14px', lineHeight: 1.5 }}>{o.address}</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem' }}>
                    <a href={`mailto:${o.email}`} style={{ color: '#00d4ff', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                      <i className="fa-solid fa-envelope"></i> {o.email}
                    </a>
                    <a href={`tel:${o.phone}`} style={{ color: '#cebdff', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                      <i className="fa-solid fa-phone"></i> {o.phone}
                    </a>
                  </div>
                </div>
              ))}
            </div>

          </div>
        </section>
      )}

      {/* VIEW: PRIVACY POLICY PAGE (NO MODAL) */}
      {currentView === 'privacy' && (
        <section className="info-section scroll-reveal" style={{ padding: '60px 5%', maxWidth: '960px', width: '100%', margin: '0 auto' }}>
          <button className="home-back-btn" onClick={() => navigateTo('home')}>
            <i className="fa-solid fa-arrow-left"></i> Back to Home
          </button>

          <div className="home-section-header" style={{ textAlign: 'left', marginBottom: '32px' }}>
            <span className="pill-tag cyan" style={{ fontSize: '0.72rem' }}>DATA TRUST &amp; COMPLIANCE</span>
            <h1 className="home-section-title" style={{ fontSize: '2.5rem', marginTop: '10px' }}>
              Privacy Policy &amp; Data Trust
            </h1>
            <p className="home-section-sub" style={{ margin: '10px 0 0 0', maxWidth: '780px', fontSize: '1.02rem', lineHeight: 1.6 }}>
              At Axis Black, we treat your business financial data with extreme confidentiality. We never monetize, sell, or train public models on your transaction records.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: '40px' }}>
            {PRIVACY_SECTIONS.map(s => (
              <div key={s.id} style={{ background: 'rgba(255, 255, 255, 0.025)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', padding: '28px' }}>
                <h3 style={{ color: '#00d4ff', fontSize: '1.25rem', marginBottom: '16px', fontFamily: 'Plus Jakarta Sans' }}>{s.title}</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {s.content.map((c, ci) => (
                    <div key={ci}>
                      <div style={{ color: '#ffffff', fontSize: '0.95rem', fontWeight: 700, marginBottom: '4px' }}>{c.sub}</div>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: 1.6, margin: 0 }}>{c.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div style={{ background: 'rgba(0, 212, 255, 0.05)', border: '1px solid rgba(0, 212, 255, 0.2)', borderRadius: '14px', padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
            <div>
              <h4 style={{ color: '#fff', fontSize: '1.1rem', margin: 0 }}>Have questions regarding data protection?</h4>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '4px 0 0 0' }}>Our compliance team is ready to answer any questions.</p>
            </div>
            <a href="mailto:secherodalvine@gmail.com" className="home-btn-primary" style={{ textDecoration: 'none' }}>
              <i className="fa-solid fa-envelope"></i> Contact Compliance
            </a>
          </div>
        </section>
      )}

      {/* FOOTER CONTAINER */}
      <footer id="footer" className="home-footer-full">
        <div className="home-footer-inner" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '36px' }}>
          
          {/* Brand & Direct Contact Actions */}
          <div className="home-footer-col home-footer-col-brand">
            <div
              className="home-footer-brand"
              onClick={scrollToTop}
              style={{ cursor: 'pointer' }}
              title="Back to Top"
            >
              <img src="/compass_icon.png" alt="Axis Black" className="home-nav-logo" />
              <span className="home-nav-wordmark">AXIS<span>BLACK</span></span>
            </div>
            <p className="home-footer-tagline">
              Simple financial management for business owners who want clarity and peace of mind.
              Real-time numbers. Built for any business.
            </p>
            <div className="home-footer-socials">
              <a
                href="https://wa.me/254769231760"
                target="_blank"
                rel="noreferrer"
                className="footer-social-btn"
                title="WhatsApp Us"
                style={{ textDecoration: 'none' }}
              >
                <i className="fa-brands fa-whatsapp"></i>
              </a>
              <a
                href="https://x.com/Reino Forms"
                target="_blank"
                rel="noreferrer"
                className="footer-social-btn"
                title="X (Twitter)"
                style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <XIcon size={15} color="#cebdff" />
              </a>
              <a
                href="mailto:secherodalvine@gmail.com"
                className="footer-social-btn"
                title="Email Support"
                style={{ textDecoration: 'none' }}
              >
                <i className="fa-solid fa-envelope"></i>
              </a>
              <a
                href="tel:+254769231760"
                className="footer-social-btn"
                title="Call Support"
                style={{ textDecoration: 'none' }}
              >
                <i className="fa-solid fa-phone"></i>
              </a>
            </div>
          </div>

          {/* Platform Navigation (Replacing old Navigation and removing previous Platform items) */}
          <div className="home-footer-col">
            <div className="home-footer-col-title">Platform</div>
            <ul className="home-footer-links">
              <li><button onClick={() => navigateTo('home')} className="home-footer-link">Home</button></li>
              <li><button onClick={() => navigateTo('learn-more')} className="home-footer-link">Learn More</button></li>
              <li><button onClick={() => navigateTo('about')} className="home-footer-link">About Us</button></li>
              <li><button onClick={() => navigateTo('contact')} className="home-footer-link">Contact</button></li>
              <li><button onClick={() => navigateTo('privacy')} className="home-footer-link">Privacy Policy</button></li>
            </ul>
          </div>
        </div>

        {/* Bottom bar (With "Home · Features · Contact · About" REMOVED) */}
        <div className="home-footer-bottom" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p className="home-footer-copy">© 2026 Axis Black Technologies Ltd. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;
