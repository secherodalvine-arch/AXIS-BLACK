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

const STATS = [
  { label: 'Active Business Units', value: '12+', icon: 'fa-building' },
  { label: 'Transactions Tracked', value: '48K', icon: 'fa-receipt' },
  { label: 'Reports Generated', value: '2.4M', icon: 'fa-chart-bar' },
  { label: 'Accuracy Rate', value: '99.7%', icon: 'fa-shield-halved' },
];

const FEATURES = [
  { icon: 'fa-chart-line', color: '#00d4ff', glow: 'rgba(0, 212, 255, 0.3)', title: 'Financial Growth', desc: 'Real-time revenue tracking, gross margin growth, and expense breakdowns in clear visual charts.', badge: 'Visual Charts' },
  { icon: 'fa-boxes-stacked', color: '#cebdff', glow: 'rgba(206, 189, 255, 0.3)', title: 'Inventory Management', desc: 'Real-time stock tracking, reorder alerts, and product inventory management across your business.', badge: 'Live Stock' },
  { icon: 'fa-wand-magic-sparkles', color: '#a78bfa', glow: 'rgba(167, 139, 250, 0.3)', title: 'Axis Agent', desc: 'Your business assistant — ask questions, get summaries, and receive clear recommendations based on your actual data.', badge: 'Smart Assistant' },
  { icon: 'fa-square-poll-vertical', color: '#00d4ff', glow: 'rgba(0, 212, 255, 0.3)', title: 'Business Analytics', desc: '12-month business performance tracking with monthly historical breakdowns and trend insights.', badge: 'Analytics' },
  { icon: 'fa-cubes-stacked', color: '#cebdff', glow: 'rgba(206, 189, 255, 0.3)', title: 'Runway Simulator', desc: 'Financial scenario planning to project your cash runway, monthly burn rate, and growth impact.', badge: 'Simulations' },
  { icon: 'fa-receipt', color: '#a78bfa', glow: 'rgba(167, 139, 250, 0.3)', title: 'Ledger & Transactions', desc: 'Double-entry transaction records with multi-currency support in USD and Kenya Shillings (KES).', badge: 'Ledger Data' },
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
      { sub: 'Service Delivery & AI Processing', text: 'Your financial data is processed by our Business Intelligence Engine to generate insights and forecasts. AI processing occurs in secure isolated environments and is never used to train shared client models.' },
      { sub: 'Security & Compliance', text: 'To detect anomalous access and comply with applicable regulations including the Kenya Data Protection Act (2019) and GDPR.' },
    ],
  },
  {
    id: '3',
    title: '3. Data Security & Your Rights',
    content: [
      { sub: 'Security Standard', text: 'AES-256 encryption at rest and TLS 1.3 in transit with primary servers in EU and regional nodes in Nairobi.' },
      { sub: 'Your Rights', text: 'Full right of access, portability, correction, and deletion by contacting privacy@axisblack.io.' },
    ],
  },
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
    const particles = Array.from({ length: 60 }, () => ({
      x: Math.random() * canvas.width, y: Math.random() * canvas.height,
      r: Math.random() * 1.5 + 0.4, vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3,
      color: Math.random() > 0.5 ? '#00d4ff' : '#cebdff', alpha: Math.random() * 0.6 + 0.2,
    }));
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = canvas.width; if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height; if (p.y > canvas.height) p.y = 0;
        ctx.save(); ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.color; ctx.globalAlpha = p.alpha * (0.7 + 0.3 * Math.sin(Date.now() * 0.002 + p.x));
        ctx.shadowBlur = 10; ctx.shadowColor = p.color; ctx.fill(); ctx.restore();
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

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="home-page" style={{ opacity: visible ? 1 : 0, transition: 'opacity 0.6s ease' }}>
      <canvas ref={canvasRef} className="home-particle-canvas" />
      <div className="home-glow home-glow-cyan" />
      <div className="home-glow home-glow-lilac" />

      {/* HEADER NAV */}
      <header className="home-nav">
        <div
          className="home-nav-brand"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          style={{ cursor: 'pointer' }}
          title="Back to Top"
        >
          <img src="/compass_icon.png" alt="Axis Black" className="home-nav-logo" />
          <span className="home-nav-wordmark">AXIS<span>BLACK</span></span>
        </div>

        {/* Desktop Nav Links */}
        <nav className="home-nav-links">
          <button className="home-nav-link" onClick={() => scrollToSection('features')}>Features</button>
          <button className="home-nav-link" onClick={() => scrollToSection('multimodal')}>Axis Agent</button>
          <button className="home-nav-link" onClick={() => scrollToSection('stats')}>Metrics</button>
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
          <button className="home-mobile-nav-link" onClick={() => { scrollToSection('features'); setMobileMenuOpen(false); }}>
            <i className="fa-solid fa-layer-group"></i> Features
          </button>
          <button className="home-mobile-nav-link" onClick={() => { scrollToSection('multimodal'); setMobileMenuOpen(false); }}>
            <i className="fa-solid fa-brain"></i> Axis Agent
          </button>
          <button className="home-mobile-nav-link" onClick={() => { scrollToSection('stats'); setMobileMenuOpen(false); }}>
            <i className="fa-solid fa-chart-line"></i> Metrics
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
          padding: '80px 4%',
          borderRadius: '0',
          overflow: 'hidden',
          position: 'relative',
          borderBottom: '1px solid rgba(0, 212, 255, 0.25)',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.7)',
          backgroundImage: 'linear-gradient(180deg, rgba(10, 10, 15, 0.82) 0%, rgba(10, 10, 15, 0.95) 100%), url("/hero_financial_bg.png")',
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

        {/* Interactive Dashboard Preview Container */}
        <div className="home-hero-preview" style={{ marginTop: '48px', maxWidth: '100%', width: '100%' }}>
          <div className="home-preview-bar">
            <span className="home-preview-dot" style={{ background: '#ff5f57' }}></span>
            <span className="home-preview-dot" style={{ background: '#febc2e' }}></span>
            <span className="home-preview-dot" style={{ background: '#28c840' }}></span>
            <span className="home-preview-title">Axis Black — Overview Dashboard</span>
          </div>
          <div className="home-preview-body">
            <div className="home-preview-metrics">
              {[
                { label: 'Total Revenue', val: '$528K', color: '#00d4ff' },
                { label: 'Net Margin', val: '$290K', color: '#cebdff' },
                { label: 'Cash Balance', val: '$1.84M', color: '#a78bfa' },
                { label: 'Runway', val: '14.8mo', color: '#00d4ff' },
              ].map((m, i) => (
                <div key={i} className="home-preview-card" style={{ borderColor: m.color + '40' }}>
                  <div className="home-preview-card-val" style={{ color: m.color }}>{m.val}</div>
                  <div className="home-preview-card-label">{m.label}</div>
                  <div className="home-preview-sparkline" style={{ background: `linear-gradient(90deg, transparent, ${m.color}50)` }}></div>
                </div>
              ))}
            </div>
            <div className="home-preview-chart-area">
              <div className="home-preview-chart-label">Financial Performance & Growth</div>
              <svg viewBox="0 0 400 100" className="home-preview-svg" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="cyanGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00d4ff" stopOpacity="0.5" />
                    <stop offset="100%" stopColor="#00d4ff" stopOpacity="0" />
                  </linearGradient>
                  <linearGradient id="lilacGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#cebdff" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#cebdff" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d="M0,80 C50,65 80,55 120,45 S200,25 250,18 S320,12 400,8 L400,100 L0,100 Z" fill="url(#cyanGrad)" />
                <path d="M0,80 C50,65 80,55 120,45 S200,25 250,18 S320,12 400,8" fill="none" stroke="#00d4ff" strokeWidth="2" />
                <path d="M0,90 C50,80 80,72 120,65 S200,52 250,46 S320,42 400,40 L400,100 L0,100 Z" fill="url(#lilacGrad)" />
                <path d="M0,90 C50,80 80,72 120,65 S200,52 250,46 S320,42 400,40" fill="none" stroke="#cebdff" strokeWidth="1.5" strokeDasharray="5,3" />
              </svg>
            </div>
          </div>
        </div>
      </section>

      {/* STATS SECTION CONTAINER */}
      <section id="stats" className="home-stats scroll-reveal">
        {STATS.map((s, i) => (
          <div key={i} className="home-stat-card">
            <div className="home-stat-icon"><i className={`fa-solid ${s.icon}`}></i></div>
            <div className="home-stat-val">{s.value}</div>
            <div className="home-stat-label">{s.label}</div>
          </div>
        ))}
      </section>

      {/* FEATURES SECTION CONTAINER */}
      <section id="features" className="home-features scroll-reveal">
        <div className="home-section-header">
          <div className="home-section-eyebrow">Platform Capabilities</div>
          <h2 className="home-section-title">Everything you need to run<br /><span className="home-hero-gradient">a world-class operation</span></h2>
          <p className="home-section-sub">Six powerful connected tools ready from day one.</p>
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

      {/* MULTIMODAL AI INTELLIGENCE SHOWCASE CONTAINER */}
      <section id="multimodal" className="home-multimodal-container scroll-reveal" style={{
        width: '100%',
        maxWidth: '100%',
        margin: '0',
        padding: '60px 4%',
        background: 'rgba(19, 19, 24, 0.75)',
        backdropFilter: 'blur(16px)',
        borderTop: '1px solid rgba(206, 189, 255, 0.2)',
        borderBottom: '1px solid rgba(206, 189, 255, 0.2)',
        borderRadius: '0',
        boxShadow: '0 16px 48px rgba(0,0,0,0.5)'
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '32px', alignItems: 'center' }}>
          <div>
            <div className="home-section-eyebrow" style={{ color: '#cebdff' }}>Your Business Assistant</div>
            <h2 style={{ color: '#fff', fontSize: '2rem', marginTop: '8px', marginBottom: '16px', lineHeight: 1.3 }}>
              Ask Questions, Analyze Data,<br />
              <span className="home-hero-gradient">Get Actionable Answers</span>
            </h2>
            <p style={{ color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: '24px' }}>
              Axis Agent understands plain language, works with your financial data, and gives you clear summaries, charts, and recommendations — without needing technical expertise.
            </p>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ background: 'rgba(0, 212, 255, 0.1)', border: '1px solid rgba(0, 212, 255, 0.3)', borderRadius: '8px', padding: '8px 14px', color: '#00d4ff', fontSize: '0.85rem' }}>
                <i className="fa-solid fa-comments" style={{ marginRight: '6px' }}></i> Plain Language Chat
              </div>
              <div style={{ background: 'rgba(206, 189, 255, 0.1)', border: '1px solid rgba(206, 189, 255, 0.3)', borderRadius: '8px', padding: '8px 14px', color: '#cebdff', fontSize: '0.85rem' }}>
                <i className="fa-solid fa-chart-line" style={{ marginRight: '6px' }}></i> Multi-Chart Analytics
              </div>
              <div style={{ background: 'rgba(167, 139, 250, 0.1)', border: '1px solid rgba(167, 139, 250, 0.3)', borderRadius: '8px', padding: '8px 14px', color: '#a78bfa', fontSize: '0.85rem' }}>
                <i className="fa-solid fa-coins" style={{ marginRight: '6px' }}></i> USD & KES Support
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <img
              src="/ai_advisor_multimodal.png"
              alt="Axis Agent business assistant"
              style={{ width: '100%', maxHeight: '340px', objectFit: 'cover', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.15)', boxShadow: '0 12px 36px rgba(0,0,0,0.6)' }}
            />
          </div>
        </div>
      </section>

      {/* ABOUT US SECTION CONTAINER */}
      <section id="about" className="info-section scroll-reveal" style={{ padding: '80px 4%', maxWidth: '100%', width: '100%', margin: '0' }}>
        <div className="home-section-header">
          <div className="home-section-eyebrow">Who We Are</div>
          <h2 className="home-section-title">Built for businesses<br /><span className="home-hero-gradient">of every kind</span></h2>
          <p className="home-section-sub" style={{ maxWidth: '720px', margin: '16px auto' }}>
            Axis Black is a business management platform built for founders, operators, and teams
            who need clarity and speed in every financial decision.
          </p>
        </div>

        {/* Mission & Vision Containers */}
        <div className="info-two-col" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', marginTop: '40px' }}>
          <div className="info-card info-card-cyan" style={{ background: 'rgba(0, 212, 255, 0.04)', border: '1px solid rgba(0, 212, 255, 0.2)', borderRadius: '16px', padding: '32px' }}>
            <div style={{ color: '#00d4ff', fontSize: '2rem', marginBottom: '16px' }}><i className="fa-solid fa-bullseye"></i></div>
            <h3 style={{ color: '#fff', fontSize: '1.4rem', marginBottom: '12px' }}>Our Mission</h3>
            <p style={{ color: 'var(--text-muted)', lineHeight: 1.7 }}>
              To make powerful business financial tools accessible to every business — from startups to established enterprises — with real-time analytics, smart advisory, and multi-currency support at every stage of growth.
            </p>
          </div>
          <div className="info-card info-card-lilac" style={{ background: 'rgba(206, 189, 255, 0.04)', border: '1px solid rgba(206, 189, 255, 0.2)', borderRadius: '16px', padding: '32px' }}>
            <div style={{ color: '#cebdff', fontSize: '2rem', marginBottom: '16px' }}><i className="fa-solid fa-eye"></i></div>
            <h3 style={{ color: '#fff', fontSize: '1.4rem', marginBottom: '12px' }}>Our Vision</h3>
            <p style={{ color: 'var(--text-muted)', lineHeight: 1.7 }}>
              A world where every business operator has access to the same financial tools that power the world's most sophisticated companies — with multi-currency support and local context.
            </p>
          </div>
        </div>
      </section>

      {/* CONTACT SECTION CONTAINER */}
      <section id="contact" className="info-section scroll-reveal" style={{ padding: '80px 4%', maxWidth: '100%', width: '100%', margin: '0', borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
        <div className="home-section-header">
          <div className="home-section-eyebrow">Get In Touch</div>
          <h2 className="home-section-title">We'd love to<br /><span className="home-hero-gradient">hear from you</span></h2>
          <p className="home-section-sub">Have questions or ready to onboard your enterprise? Reach out to our team.</p>
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

          {/* Office Containers */}
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

      {/* PRIVACY SECTION CONTAINER */}
      <section id="privacy" className="info-section scroll-reveal" style={{ padding: '80px 4%', maxWidth: '100%', width: '100%', margin: '0', borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
        <div className="home-section-header">
          <div className="home-section-eyebrow">Data Trust &amp; Governance</div>
          <h2 className="home-section-title">Privacy &amp;<br /><span className="home-hero-gradient">Policy Highlights</span></h2>
          <p className="home-section-sub">We adhere to global data protection standards (GDPR, ODPC Act 2019).</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginTop: '40px' }}>
          {PRIVACY_SECTIONS.map((s) => (
            <div key={s.id} style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', padding: '24px' }}>
              <h3 style={{ color: '#00d4ff', fontSize: '1.1rem', marginBottom: '16px' }}>{s.title}</h3>
              {s.content.map((c, ci) => (
                <div key={ci} style={{ marginBottom: '12px' }}>
                  <div style={{ color: '#fff', fontSize: '0.9rem', fontWeight: '600' }}>{c.sub}</div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', lineHeight: 1.5, marginTop: '4px' }}>{c.text}</p>
                </div>
              ))}
            </div>
          ))}
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
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
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
              <li><button onClick={() => scrollToSection('features')} className="home-footer-link">Features</button></li>
              <li><button onClick={() => scrollToSection('multimodal')} className="home-footer-link">Axis Agent</button></li>
              <li><button onClick={() => scrollToSection('stats')} className="home-footer-link">Metrics</button></li>
              <li><button onClick={() => scrollToSection('about')} className="home-footer-link">About Us</button></li>
              <li><button onClick={() => scrollToSection('contact')} className="home-footer-link">Contact</button></li>
              <li><button onClick={() => scrollToSection('privacy')} className="home-footer-link">Privacy Policy</button></li>
            </ul>
          </div>

          {/* Platform */}
          <div className="home-footer-col">
            <div className="home-footer-col-title">Platform</div>
            <ul className="home-footer-links">
              <li><button onClick={() => scrollToSection('features')} className="home-footer-link">Overview Dashboard</button></li>
              <li><button onClick={() => scrollToSection('features')} className="home-footer-link">Business Analytics</button></li>
              <li><button onClick={() => scrollToSection('multimodal')} className="home-footer-link">Axis Agent</button></li>
              <li><button onClick={() => scrollToSection('features')} className="home-footer-link">Runway Simulator</button></li>
              <li><button onClick={() => scrollToSection('features')} className="home-footer-link">Inventory Intelligence</button></li>
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
            <button onClick={() => scrollToSection('privacy')} className="home-footer-link">Privacy</button>
            <span className="home-footer-divider">·</span>
            <button onClick={() => scrollToSection('contact')} className="home-footer-link">Contact</button>
            <span className="home-footer-divider">·</span>
            <button onClick={() => scrollToSection('about')} className="home-footer-link">About</button>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;
