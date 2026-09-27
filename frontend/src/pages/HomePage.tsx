import React, { useEffect, useRef, useState } from 'react';
import { sendSupportMessageApi } from '../utils/api';

interface HomePageProps {
  onEnterDashboard: () => void;
  onNavigateLogin?: () => void;
  onNavigateRegister?: () => void;
}

const XIcon: React.FC<{ size?: number; color?: string; style?: React.CSSProperties }> = ({ size = 16, color = 'currentColor', style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={{ display: 'inline-block', verticalAlign: 'middle', ...style }}>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const FEATURES = [
  { icon: 'fa-chart-line', color: '#00d4ff', glow: 'rgba(0, 212, 255, 0.3)', title: 'Financial Growth', desc: 'Real-time revenue tracking, gross margin growth, and expense breakdowns in clear visual charts.', badge: 'Visual Charts' },
  { icon: 'fa-boxes-stacked', color: '#cebdff', glow: 'rgba(206, 189, 255, 0.3)', title: 'Inventory Management', desc: 'Real-time stock tracking, reorder alerts, and product inventory management across your business.', badge: 'Live Stock' },
  { icon: 'fa-coins', color: '#a78bfa', glow: 'rgba(167, 139, 250, 0.3)', title: 'Multi-Currency Flow', desc: 'Unified transaction records with native multi-currency support in US Dollars (USD) and Kenya Shillings (KES).', badge: 'USD & KES' },
  { icon: 'fa-square-poll-vertical', color: '#00d4ff', glow: 'rgba(0, 212, 255, 0.3)', title: 'Business Analytics', desc: '12-month business performance tracking with monthly historical breakdowns and trend insights.', badge: 'Analytics' },
  { icon: 'fa-cubes-stacked', color: '#cebdff', glow: 'rgba(206, 189, 255, 0.3)', title: 'Runway Simulator', desc: 'Financial scenario planning to project your cash runway, monthly burn rate, and growth impact.', badge: 'Simulations' },
  { icon: 'fa-receipt', color: '#a78bfa', glow: 'rgba(167, 139, 250, 0.3)', title: 'Ledger & Transactions', desc: 'Double-entry transaction records with categorical tracking and instantaneous audit-ready exports.', badge: 'Ledger Data' },
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
      { sub: 'Usage & Communication Data', text: 'We automatically collect interaction metrics to continuously improve platform performance, along with support message archives.' },
    ],
  },
  {
    id: '2',
    title: '2. How We Use Your Information',
    content: [
      { sub: 'Service Delivery & Business Intelligence', text: 'Your financial data is processed securely to generate cash flow analytics, unit economics, and runway forecasts without training third-party public models.' },
      { sub: 'Security & Compliance', text: 'To detect anomalous access and comply with applicable data protection regulations including the Kenya Data Protection Act (2019) and GDPR.' },
    ],
  },
  {
    id: '3',
    title: '3. Data Security & Your Rights',
    content: [
      { sub: 'Security Standard', text: 'AES-256 encryption at rest and TLS 1.3 in transit with dedicated regional infrastructure nodes.' },
      { sub: 'Your Rights', text: 'Full right of access, portability, correction, and deletion at any time by contacting privacy@axisblack.io.' },
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
  const [visible, setVisible] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeFeature, setActiveFeature] = useState<number | null>(null);
  const [contactForm, setContactForm] = useState({ name: '', email: '', company: '', subject: '', message: '' });
  const [contactSubmitted, setContactSubmitted] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [hoveredPreviewMonth, setHoveredPreviewMonth] = useState<number | null>(5); // default Jun
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 60);
    return () => clearTimeout(t);
  }, []);

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
  }, [visible]);

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

  const [submittingContact, setSubmittingContact] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);

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
        subject: contactForm.subject || 'Platform Inquiry',
        label: contactForm.subject || 'support',
      });
      setContactSubmitted(true);
    } catch (err: any) {
      setContactError(err.message || 'Failed to send message. Please try again.');
    } finally {
      setSubmittingContact(false);
    }
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
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
          title="Back to Top"
        >
          <img src="/compass_icon.png" alt="Axis Black" className="home-nav-logo" />
          <span className="home-nav-wordmark">AXIS<span>BLACK</span></span>
        </div>

        {/* Desktop Nav Links */}
        <nav className="home-nav-links">
          <button className="home-nav-link" onClick={scrollToTop}>Home</button>
          <button className="home-nav-link" onClick={() => scrollToSection('features')}>Features</button>
          <button className="home-nav-link" onClick={() => scrollToSection('about')}>About Us</button>
          <button className="home-nav-link" onClick={() => scrollToSection('contact')}>Contact</button>
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
          <button className="home-mobile-nav-link" onClick={() => { scrollToTop(); setMobileMenuOpen(false); }}>
            <i className="fa-solid fa-house"></i> Home
          </button>
          <button className="home-mobile-nav-link" onClick={() => { scrollToSection('features'); setMobileMenuOpen(false); }}>
            <i className="fa-solid fa-layer-group"></i> Features
          </button>
          <button className="home-mobile-nav-link" onClick={() => { scrollToSection('about'); setMobileMenuOpen(false); }}>
            <i className="fa-solid fa-circle-info"></i> About Us
          </button>
          <button className="home-mobile-nav-link" onClick={() => { scrollToSection('contact'); setMobileMenuOpen(false); }}>
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

      {/* HERO SECTION CONTAINER WITH FINANCIAL PLATFORM BACKGROUND IMAGE */}
      <section
        className="home-hero-container scroll-reveal"
        style={{
          width: '100%',
          maxWidth: '100%',
          margin: '0',
          padding: '80px 4% 60px 4%',
          borderRadius: '0',
          overflow: 'hidden',
          position: 'relative',
          borderBottom: '1px solid rgba(0, 212, 255, 0.2)',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.7)',
          backgroundImage: 'linear-gradient(180deg, rgba(10, 10, 15, 0.84) 0%, rgba(10, 10, 15, 0.96) 100%), url("/hero_financial_bg.png")',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      >
        <div style={{ textAlign: 'center', maxWidth: '960px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <h1 className="home-hero-title">
            Optimize Your<br />
            <span className="home-hero-gradient">Financial Operations</span>
          </h1>
          <p className="home-hero-sub">
            Axis Black is a business management platform built for founders,
            operators, and teams who need clear, real-time visibility across revenue, inventory,
            cash flow, and growth — all in one place.
          </p>
          <div className="home-hero-actions">
            <button className="home-btn-primary" onClick={onNavigateRegister || onNavigateLogin}>
              <i className="fa-solid fa-user-plus"></i> Create Account
            </button>
            <button className="home-btn-ghost" onClick={() => scrollToSection('about')}>
              <i className="fa-solid fa-circle-info"></i> Learn More
            </button>
          </div>
        </div>

        {/* Clean, Decent, Easy to Understand Interactive Dashboard Preview Container */}
        <div className="home-hero-preview" style={{ marginTop: '48px', maxWidth: '100%', width: '100%' }}>
          <div className="home-preview-bar">
            <span className="home-preview-dot" style={{ background: '#ff5f57' }}></span>
            <span className="home-preview-dot" style={{ background: '#febc2e' }}></span>
            <span className="home-preview-dot" style={{ background: '#28c840' }}></span>
            <span className="home-preview-title">Axis Black — Executive Dashboard Preview</span>
          </div>

          <div className="home-preview-body">
            {/* Top 4 KPI Metrics */}
            <div className="home-preview-metrics">
              {[
                { label: 'Total Revenue', val: '$533,000', color: '#00d4ff', change: '+18.4% vs H1' },
                { label: 'Operating Expenses', val: '$264,000', color: '#cebdff', change: '49.5% of rev' },
                { label: 'Net Profit Margin', val: '$269,000', color: '#4ade80', change: '50.4% net margin' },
                { label: 'Projected Runway', val: '14.8 Months', color: '#00d4ff', change: 'Healthy cash flow' },
              ].map((m, i) => (
                <div key={i} className="home-preview-card" style={{ borderColor: m.color + '33' }}>
                  <div className="home-preview-card-val" style={{ color: m.color }}>{m.val}</div>
                  <div className="home-preview-card-label">{m.label}</div>
                  <div style={{ fontSize: '0.68rem', color: '#9ca3af', marginTop: '6px', fontFamily: 'JetBrains Mono' }}>
                    {m.change}
                  </div>
                  <div className="home-preview-sparkline" style={{ background: `linear-gradient(90deg, transparent, ${m.color}60)` }}></div>
                </div>
              ))}
            </div>

            {/* Clear, Decent & Understandable Financial Chart */}
            <div className="home-preview-chart-area" style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '12px', padding: '20px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff', fontFamily: 'Plus Jakarta Sans', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <i className="fa-solid fa-chart-column" style={{ color: '#00d4ff' }}></i>
                    Cash Flow &amp; Performance Overview (Jan – Jun)
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '2px' }}>
                    Monthly revenue vs. expenses comparison with net margin trajectory
                  </div>
                </div>

                {/* Legend & Hover inspector indicator */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', fontSize: '0.78rem' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#e5e2e1' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#00d4ff' }}></span>
                    Revenue
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#e5e2e1' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#cebdff' }}></span>
                    Expenses
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#4ade80', fontWeight: 600 }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4ade80' }}></span>
                    Net Profit
                  </span>
                  {activeMonthData && (
                    <div style={{ background: 'rgba(0, 212, 255, 0.12)', border: '1px solid rgba(0, 212, 255, 0.3)', padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', fontFamily: 'JetBrains Mono', color: '#00d4ff' }}>
                      <strong>{activeMonthData.month}</strong>: ${activeMonthData.revenue}K Rev · ${activeMonthData.expenses}K Exp · <span style={{ color: '#4ade80' }}>+${activeMonthData.net}K Net</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Simplified Bar Chart Grid */}
              <div style={{ position: 'relative', height: '160px', width: '100%', display: 'flex', alignItems: 'flex-end', gap: '16px', paddingTop: '20px', paddingBottom: '24px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                {/* Horizontal reference guide */}
                <div style={{ position: 'absolute', top: '20px', left: 0, right: 0, borderTop: '1px dashed rgba(255,255,255,0.06)' }}>
                  <span style={{ position: 'absolute', right: 0, top: '-14px', fontSize: '0.65rem', color: '#64748b', fontFamily: 'JetBrains Mono' }}>$120K</span>
                </div>
                <div style={{ position: 'absolute', top: '75px', left: 0, right: 0, borderTop: '1px dashed rgba(255,255,255,0.06)' }}>
                  <span style={{ position: 'absolute', right: 0, top: '-14px', fontSize: '0.65rem', color: '#64748b', fontFamily: 'JetBrains Mono' }}>$60K</span>
                </div>

                {PREVIEW_MONTHS.map((m, idx) => {
                  const isHovered = hoveredPreviewMonth === idx;
                  const revHeight = (m.revenue / 120) * 120;
                  const expHeight = (m.expenses / 120) * 120;
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
                        opacity: hoveredPreviewMonth !== null && !isHovered ? 0.65 : 1
                      }}
                    >
                      {/* Bars Group */}
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '100%', width: '100%', justifyContent: 'center' }}>
                        {/* Revenue Bar */}
                        <div
                          style={{
                            width: '28%',
                            maxWidth: '26px',
                            height: `${revHeight}px`,
                            background: isHovered ? 'linear-gradient(180deg, #38e1ff 0%, #0099cc 100%)' : 'linear-gradient(180deg, #00d4ff 0%, rgba(0, 212, 255, 0.4) 100%)',
                            borderRadius: '4px 4px 0 0',
                            boxShadow: isHovered ? '0 0 12px rgba(0, 212, 255, 0.5)' : 'none',
                            transition: 'all 0.25s ease'
                          }}
                          title={`${m.month} Revenue: $${m.revenue}K`}
                        />
                        {/* Expenses Bar */}
                        <div
                          style={{
                            width: '28%',
                            maxWidth: '26px',
                            height: `${expHeight}px`,
                            background: isHovered ? 'linear-gradient(180deg, #e0d4ff 0%, #9980cc 100%)' : 'linear-gradient(180deg, #cebdff 0%, rgba(206, 189, 255, 0.35) 100%)',
                            borderRadius: '4px 4px 0 0',
                            boxShadow: isHovered ? '0 0 12px rgba(206, 189, 255, 0.4)' : 'none',
                            transition: 'all 0.25s ease'
                          }}
                          title={`${m.month} Expenses: $${m.expenses}K`}
                        />
                      </div>
                      {/* Month label */}
                      <div style={{
                        marginTop: '8px',
                        fontSize: '0.78rem',
                        fontWeight: isHovered ? 700 : 500,
                        color: isHovered ? '#00d4ff' : '#9ca3af',
                        fontFamily: 'JetBrains Mono',
                        transition: 'color 0.2s ease'
                      }}>
                        {m.month}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Chart footer takeaway */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', fontSize: '0.75rem', color: '#9ca3af', flexWrap: 'wrap', gap: '8px' }}>
                <span>
                  <i className="fa-solid fa-arrow-trend-up" style={{ color: '#4ade80', marginRight: '6px' }}></i>
                  Revenue grew <strong>+64.7%</strong> from Jan ($68K) to Jun ($112K) while maintaining a steady 50%+ profit margin.
                </span>
                <span style={{ fontFamily: 'JetBrains Mono', color: '#cebdff' }}>
                  H1 Net Cash Added: +$269,000
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES SECTION CONTAINER */}
      <section id="features" className="home-features scroll-reveal">
        <div className="home-section-header">
          <div className="home-section-eyebrow">Platform Capabilities</div>
          <h2 className="home-section-title">Everything you need to run<br /><span className="home-hero-gradient">a world-class operation</span></h2>
          <p className="home-section-sub">Six powerful connected financial and management tools built for clear decision making.</p>
        </div>
        <div className="home-features-grid">
          {FEATURES.map((f, i) => (
            <div
              key={i}
              className={`home-feature-card ${activeFeature === i ? 'hovered' : ''}`}
              onMouseEnter={() => setActiveFeature(i)}
              onMouseLeave={() => setActiveFeature(null)}
              style={{ '--f-color': f.color, '--f-glow': f.glow } as React.CSSProperties}
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

      {/* ABOUT US SECTION CONTAINER */}
      <section id="about" className="info-section scroll-reveal" style={{ padding: '80px 4%', maxWidth: '100%', width: '100%', margin: '0' }}>
        <div className="home-section-header">
          <div className="home-section-eyebrow">Who We Are</div>
          <h2 className="home-section-title">Built for businesses<br /><span className="home-hero-gradient">of every kind</span></h2>
          <p className="home-section-sub" style={{ maxWidth: '720px', margin: '16px auto' }}>
            Axis Black is a business management platform built for founders, operators, and teams
            who need clarity, speed, and confidence in every financial decision.
          </p>
        </div>

        {/* Mission & Vision Containers */}
        <div className="info-two-col" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', marginTop: '40px' }}>
          <div className="info-card info-card-cyan" style={{ background: 'rgba(0, 212, 255, 0.04)', border: '1px solid rgba(0, 212, 255, 0.2)', borderRadius: '16px', padding: '32px' }}>
            <div style={{ color: '#00d4ff', fontSize: '2rem', marginBottom: '16px' }}><i className="fa-solid fa-bullseye"></i></div>
            <h3 style={{ color: '#fff', fontSize: '1.4rem', marginBottom: '12px' }}>Our Mission</h3>
            <p style={{ color: 'var(--text-muted)', lineHeight: 1.7 }}>
              To make powerful business financial tools accessible to every business — from startups to multi-branch enterprises — with real-time analytics, transparent bookkeeping, and multi-currency support at every stage of growth.
            </p>
          </div>
          <div className="info-card info-card-lilac" style={{ background: 'rgba(206, 189, 255, 0.04)', border: '1px solid rgba(206, 189, 255, 0.2)', borderRadius: '16px', padding: '32px' }}>
            <div style={{ color: '#cebdff', fontSize: '2rem', marginBottom: '16px' }}><i className="fa-solid fa-eye"></i></div>
            <h3 style={{ color: '#fff', fontSize: '1.4rem', marginBottom: '12px' }}>Our Vision</h3>
            <p style={{ color: 'var(--text-muted)', lineHeight: 1.7 }}>
              A world where every business operator has access to the same financial transparency and operational intelligence that power the world's most sophisticated companies — with seamless multi-currency support and local context.
            </p>
          </div>
        </div>
      </section>

      {/* CONTACT SECTION CONTAINER */}
      <section id="contact" className="info-section scroll-reveal" style={{ padding: '80px 4%', maxWidth: '100%', width: '100%', margin: '0', borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
        <div className="home-section-header">
          <div className="home-section-eyebrow">Get In Touch</div>
          <h2 className="home-section-title">We'd love to<br /><span className="home-hero-gradient">hear from you</span></h2>
          <p className="home-section-sub">Have questions or ready to onboard your business? Reach out to our team.</p>
        </div>

        <div className="contact-layout" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '32px', marginTop: '40px' }}>
          {/* Contact Form Container */}
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '20px', padding: '32px' }}>
            {contactSubmitted ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
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
                    placeholder="Full Name"
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
                    <option value="Demo">Platform Demo</option>
                    <option value="Pricing">Enterprise Pricing</option>
                    <option value="Support">Technical Support</option>
                    <option value="Partnership">Partnership</option>
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

          {/* Regional Offices */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h3 style={{ color: '#fff', fontSize: '1.3rem' }}>Our Regional Offices</h3>
            {OFFICES.map((o, i) => (
              <div key={i} style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '14px', padding: '20px' }}>
                <div style={{ fontSize: '1.15rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', fontWeight: 'bold' }}>
                  <i className={`fa-solid ${o.icon}`} style={{ color: '#00d4ff' }}></i>
                  <span>{o.city}, {o.country}</span>
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '12px', lineHeight: 1.5 }}>{o.address}</p>
                <div style={{ display: 'flex', gap: '16px', fontSize: '0.85rem', flexWrap: 'wrap' }}>
                  <a href={`mailto:${o.email}`} style={{ color: '#00d4ff', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <i className="fa-solid fa-envelope"></i> {o.email}
                  </a>
                  <a href={`tel:${o.phone}`} style={{ color: '#cebdff', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <i className="fa-solid fa-phone"></i> {o.phone}
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA SECTION CONTAINER */}
      <section className="home-cta-section scroll-reveal">
        <div className="home-cta-card">
          <div className="home-cta-glow-cyan" />
          <div className="home-cta-glow-lilac" />
          <div className="home-cta-badge"><i className="fa-solid fa-star"></i> Ready to launch</div>
          <h2 className="home-cta-title">Your business dashboard<br />is ready</h2>
          <p className="home-cta-sub">Step into Axis Black and get clear, real-time visibility into your business finances.</p>
          <button className="home-btn-primary home-cta-btn" onClick={onEnterDashboard}>
            <i className="fa-solid fa-gauge-high"></i> Launch Dashboard
          </button>
        </div>
      </section>

      {/* FOOTER CONTAINER */}
      <footer id="footer" className="home-footer-full">
        <div className="home-footer-inner">
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
              Business financial management for operators who need clarity and control.
              Real-time visibility. Built for any business.
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

          {/* Quick Navigation Links */}
          <div className="home-footer-col">
            <div className="home-footer-col-title">Navigation</div>
            <ul className="home-footer-links">
              <li><button onClick={scrollToTop} className="home-footer-link">Home</button></li>
              <li><button onClick={() => scrollToSection('features')} className="home-footer-link">Features</button></li>
              <li><button onClick={() => scrollToSection('about')} className="home-footer-link">About Us</button></li>
              <li><button onClick={() => scrollToSection('contact')} className="home-footer-link">Contact</button></li>
              <li><button onClick={() => setShowPrivacyModal(true)} className="home-footer-link">Privacy Policy</button></li>
            </ul>
          </div>

          {/* Platform Capabilities */}
          <div className="home-footer-col">
            <div className="home-footer-col-title">Platform</div>
            <ul className="home-footer-links">
              <li><button onClick={() => scrollToSection('features')} className="home-footer-link">Overview Dashboard</button></li>
              <li><button onClick={() => scrollToSection('features')} className="home-footer-link">Business Analytics</button></li>
              <li><button onClick={() => scrollToSection('features')} className="home-footer-link">Runway Simulator</button></li>
              <li><button onClick={() => scrollToSection('features')} className="home-footer-link">Inventory Tracking</button></li>
              <li><button onClick={() => scrollToSection('features')} className="home-footer-link">Multi-Currency (USD/KES)</button></li>
            </ul>
          </div>

          {/* Direct Contact Links */}
          <div className="home-footer-col">
            <div className="home-footer-col-title">Contact Us</div>
            <ul className="home-footer-links">
              <li>
                <a href="https://wa.me/254769231760" target="_blank" rel="noreferrer" className="home-footer-link" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fa-brands fa-whatsapp" style={{ color: '#25D366' }}></i> WhatsApp Chat
                </a>
              </li>
              <li>
                <a href="https://x.com/Reino Forms" target="_blank" rel="noreferrer" className="home-footer-link" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                  <XIcon size={14} color="#00d4ff" /> @axisblack
                </a>
              </li>
              <li>
                <a href="mailto:secherodalvine@gmail.com" className="home-footer-link" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fa-solid fa-envelope" style={{ color: '#cebdff' }}></i> secherodalvine@gmail.com
                </a>
              </li>
              <li>
                <a href="tel:+254769231760" className="home-footer-link" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fa-solid fa-phone" style={{ color: '#4ade80' }}></i> +254 769 231 760
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="home-footer-bottom">
          <p className="home-footer-copy">© 2026 Axis Black Technologies Ltd. All rights reserved.</p>
          <div className="home-footer-bottom-links">
            <button onClick={scrollToTop} className="home-footer-link">Home</button>
            <span className="home-footer-divider">·</span>
            <button onClick={() => scrollToSection('features')} className="home-footer-link">Features</button>
            <span className="home-footer-divider">·</span>
            <button onClick={() => scrollToSection('contact')} className="home-footer-link">Contact</button>
            <span className="home-footer-divider">·</span>
            <button onClick={() => scrollToSection('about')} className="home-footer-link">About</button>
          </div>
        </div>
      </footer>

      {/* PRIVACY POLICY MODAL */}
      {showPrivacyModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
          onClick={() => setShowPrivacyModal(false)}
        >
          <div
            style={{
              background: '#121217',
              border: '1px solid rgba(0, 212, 255, 0.3)',
              borderRadius: '20px',
              maxWidth: '680px',
              width: '100%',
              maxHeight: '85vh',
              overflowY: 'auto',
              padding: '32px',
              boxShadow: '0 24px 60px rgba(0,0,0,0.8)'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <span className="pill-tag cyan" style={{ fontSize: '0.7rem' }}>DATA TRUST &amp; COMPLIANCE</span>
                <h3 style={{ color: '#fff', fontSize: '1.4rem', margin: '6px 0 0 0' }}>Privacy &amp; Policy Highlights</h3>
              </div>
              <button
                onClick={() => setShowPrivacyModal(false)}
                style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: '#fff', width: '36px', height: '36px', borderRadius: '50%', cursor: 'pointer', fontSize: '1.1rem' }}
              >
                &times;
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {PRIVACY_SECTIONS.map(s => (
                <div key={s.id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '16px' }}>
                  <h4 style={{ color: '#00d4ff', fontSize: '1rem', marginBottom: '10px' }}>{s.title}</h4>
                  {s.content.map((c, ci) => (
                    <div key={ci} style={{ marginBottom: '8px' }}>
                      <div style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 600 }}>{c.sub}</div>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', lineHeight: 1.5, margin: '2px 0 0 0' }}>{c.text}</p>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <button
              className="home-btn-primary"
              style={{ width: '100%', justifyContent: 'center', marginTop: '24px' }}
              onClick={() => setShowPrivacyModal(false)}
            >
              Close Privacy Summary
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default HomePage;
