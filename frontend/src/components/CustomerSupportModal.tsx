import React, { useState, useEffect, useRef } from 'react';
import {
  getMySupportThreadsApi,
  replySupportThreadApi,
  sendSupportMessageApi,
  SupportThread,
  SupportMessageItem
} from '../utils/api';
import { formatNotificationTime } from '../utils/dateUtils';

interface CustomerSupportModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail?: string;
  userName?: string;
  initialTopic?: string;
}

export const CustomerSupportModal: React.FC<CustomerSupportModalProps> = ({
  isOpen,
  onClose,
  userEmail = '',
  userName = '',
  initialTopic = ''
}) => {
  const [activeTab, setActiveTab] = useState<'chat' | 'contact' | 'faq'>('chat');
  const [threads, setThreads] = useState<SupportThread[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [replyText, setReplyText] = useState('');
  
  // New ticket state
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newSubject, setNewSubject] = useState(initialTopic || '');
  const [newCategory, setNewCategory] = useState('support');
  const [newMessage, setNewMessage] = useState('');
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeThread = threads.find(t => t.id === selectedThreadId) || (threads.length > 0 && !isCreatingNew ? threads[0] : null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchThreads = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await getMySupportThreadsApi();
      if (res && res.data) {
        setThreads(res.data);
        if (!selectedThreadId && res.data.length > 0 && !isCreatingNew) {
          setSelectedThreadId(res.data[0].id);
        }
      }
    } catch (err) {
      console.warn('Could not load support threads:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchThreads();
      if (initialTopic) {
        setNewSubject(initialTopic);
        setIsCreatingNew(true);
      }
    }
  }, [isOpen, initialTopic]);

  // Polling for live updates when modal is open and on chat tab
  useEffect(() => {
    if (!isOpen || activeTab !== 'chat') return;
    const interval = setInterval(() => {
      fetchThreads(true);
    }, 10000);
    return () => clearInterval(interval);
  }, [isOpen, activeTab, selectedThreadId]);

  useEffect(() => {
    if (activeThread?.messages) {
      scrollToBottom();
    }
  }, [activeThread?.messages]);

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeThread || !replyText.trim() || sending) return;

    const textToSend = replyText.trim();
    setSending(true);
    try {
      const res = await replySupportThreadApi(activeThread.id, textToSend);
      if (res && res.data) {
        setReplyText('');
        // Update local state immediately
        setThreads(prev =>
          prev.map(t =>
            t.id === activeThread.id
              ? {
                  ...t,
                  updated_at: new Date().toISOString(),
                  messages: [...t.messages, res.data]
                }
              : t
          )
        );
      }
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Failed to send message. Please try again.' });
    } finally {
      setSending(false);
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubject.trim() || !newMessage.trim() || sending) return;

    setSending(true);
    setFeedbackMsg(null);
    try {
      const res = await sendSupportMessageApi({
        name: userName || (userEmail ? userEmail.split('@')[0] : 'Operator'),
        email: userEmail || 'user@axisblack.io',
        subject: newSubject.trim(),
        label: newCategory,
        message: newMessage.trim(),
      });

      setFeedbackMsg({ type: 'success', text: 'Inquiry dispatched to Axis Concierge desk.' });
      setNewSubject('');
      setNewMessage('');
      setIsCreatingNew(false);

      if (res && res.data) {
        setThreads(prev => [res.data!, ...prev]);
        setSelectedThreadId(res.data.id);
      } else {
        await fetchThreads(true);
      }
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Could not dispatch ticket. Please try again.' });
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay active"
      style={{
        zIndex: 1500,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        position: 'fixed',
        inset: 0
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="glass-card"
        style={{
          width: '740px',
          maxWidth: '96vw',
          height: '620px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--dropdown-bg, #0d1117)',
          border: '1px solid var(--dropdown-border, rgba(0, 212, 255, 0.35))',
          boxShadow: '0 24px 80px rgba(0, 0, 0, 0.95), 0 0 40px rgba(0, 212, 255, 0.15)',
          borderRadius: '20px',
          overflow: 'hidden'
        }}
      >
        {/* Top Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(90deg, rgba(0, 212, 255, 0.08) 0%, rgba(124, 95, 230, 0.04) 100%)',
            flexShrink: 0
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #00d4ff, #7c5fe6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: '1.1rem',
                boxShadow: '0 0 15px rgba(0, 212, 255, 0.4)',
                flexShrink: 0
              }}
            >
              <i className="fa-solid fa-headset"></i>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#ffffff', fontFamily: 'Plus Jakarta Sans' }}>
                  Axis Concierge &amp; Support Desk
                </h3>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '12px',
                    background: 'rgba(74, 222, 128, 0.15)',
                    color: '#4ade80',
                    border: '1px solid rgba(74, 222, 128, 0.3)'
                  }}
                >
                  <span
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: '#4ade80',
                      boxShadow: '0 0 6px #4ade80'
                    }}
                  />
                  ONLINE
                </span>
              </div>
              <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: '#9ca3af' }}>
                24/7 Financial operations concierge &bull; Direct access to enterprise desk
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '10px',
              width: '32px',
              height: '32px',
              color: '#9ca3af',
              fontSize: '1.2rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            title="Close Support Desk"
          >
            &times;
          </button>
        </div>

        {/* Tab Switcher */}
        <div
          style={{
            display: 'flex',
            padding: '8px 20px',
            gap: '8px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            background: 'rgba(0, 0, 0, 0.25)',
            flexShrink: 0
          }}
        >
          <button
            onClick={() => setActiveTab('chat')}
            style={{
              padding: '6px 14px',
              fontSize: '0.8rem',
              fontWeight: 600,
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              background: activeTab === 'chat' ? 'rgba(0, 212, 255, 0.2)' : 'transparent',
              color: activeTab === 'chat' ? '#00d4ff' : '#9ca3af',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease'
            }}
          >
            <i className="fa-solid fa-comments"></i>
            <span>Live Inquiries &amp; Tickets</span>
            {threads.length > 0 && (
              <span
                style={{
                  fontSize: '0.65rem',
                  padding: '1px 6px',
                  borderRadius: '10px',
                  background: activeTab === 'chat' ? '#00d4ff' : 'rgba(255, 255, 255, 0.1)',
                  color: activeTab === 'chat' ? '#000' : '#fff',
                  fontWeight: 700
                }}
              >
                {threads.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('contact')}
            style={{
              padding: '6px 14px',
              fontSize: '0.8rem',
              fontWeight: 600,
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              background: activeTab === 'contact' ? 'rgba(0, 212, 255, 0.2)' : 'transparent',
              color: activeTab === 'contact' ? '#00d4ff' : '#9ca3af',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease'
            }}
          >
            <i className="fa-solid fa-address-book"></i>
            <span>Direct Channels</span>
          </button>

          <button
            onClick={() => setActiveTab('faq')}
            style={{
              padding: '6px 14px',
              fontSize: '0.8rem',
              fontWeight: 600,
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              background: activeTab === 'faq' ? 'rgba(0, 212, 255, 0.2)' : 'transparent',
              color: activeTab === 'faq' ? '#00d4ff' : '#9ca3af',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease'
            }}
          >
            <i className="fa-solid fa-circle-question"></i>
            <span>FAQ &amp; Knowledgebase</span>
          </button>
        </div>

        {/* Tab Content */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          {/* TAB 1: LIVE CHAT & TICKETS */}
          {activeTab === 'chat' && (
            <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
              {/* Thread list sidebar (if multiple tickets or on demand) */}
              <div
                style={{
                  width: '230px',
                  borderRight: '1px solid rgba(255, 255, 255, 0.08)',
                  background: 'rgba(0, 0, 0, 0.2)',
                  display: 'flex',
                  flexDirection: 'column',
                  flexShrink: 0
                }}
              >
                <div style={{ padding: '10px', borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
                  <button
                    onClick={() => {
                      setIsCreatingNew(true);
                      setFeedbackMsg(null);
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      background: isCreatingNew ? 'linear-gradient(135deg, #00d4ff, #7c5fe6)' : 'rgba(0, 212, 255, 0.12)',
                      border: '1px solid rgba(0, 212, 255, 0.3)',
                      borderRadius: '8px',
                      color: isCreatingNew ? '#ffffff' : '#00d4ff',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <i className="fa-solid fa-plus"></i> New Inquiry
                  </button>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '6px' }}>
                  {loading && threads.length === 0 ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#9ca3af', fontSize: '0.75rem' }}>
                      <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: '6px' }}></i> Loading threads...
                    </div>
                  ) : threads.length === 0 ? (
                    <div style={{ padding: '20px 10px', textAlign: 'center', color: '#64748b', fontSize: '0.75rem' }}>
                      No support tickets yet. Click "New Inquiry" above to chat with concierge.
                    </div>
                  ) : (
                    threads.map(t => {
                      const isSelected = !isCreatingNew && (activeThread?.id === t.id);
                      const lastMsg = t.messages?.[t.messages.length - 1];
                      return (
                        <div
                          key={t.id}
                          onClick={() => {
                            setSelectedThreadId(t.id);
                            setIsCreatingNew(false);
                            setFeedbackMsg(null);
                          }}
                          style={{
                            padding: '10px 10px',
                            borderRadius: '10px',
                            background: isSelected ? 'rgba(0, 212, 255, 0.12)' : 'transparent',
                            border: isSelected ? '1px solid rgba(0, 212, 255, 0.35)' : '1px solid transparent',
                            cursor: 'pointer',
                            marginBottom: '4px',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                            <span
                              style={{
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                color: isSelected ? '#00d4ff' : '#ffffff',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                maxWidth: '130px'
                              }}
                            >
                              {t.subject || 'Support Ticket'}
                            </span>
                            <span
                              style={{
                                fontSize: '0.62rem',
                                padding: '1px 5px',
                                borderRadius: '6px',
                                fontWeight: 600,
                                background: t.status === 'resolved' ? 'rgba(74, 222, 128, 0.15)' : t.status === 'in_progress' ? 'rgba(0, 212, 255, 0.15)' : 'rgba(251, 191, 36, 0.15)',
                                color: t.status === 'resolved' ? '#4ade80' : t.status === 'in_progress' ? '#00d4ff' : '#fbbf24'
                              }}
                            >
                              {t.status === 'in_progress' ? 'Active' : t.status}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.7rem', color: '#9ca3af', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {lastMsg ? (lastMsg.sender === 'admin' ? `Admin: ${lastMsg.text}` : `You: ${lastMsg.text}`) : 'No messages'}
                          </div>
                          <div style={{ fontSize: '0.62rem', color: '#64748b', marginTop: '3px', fontFamily: 'JetBrains Mono' }}>
                            {formatNotificationTime(t.updated_at || t.created_at)}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Main Chat / New Ticket Panel */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: 'rgba(10, 14, 22, 0.6)' }}>
                {isCreatingNew ? (
                  /* NEW TICKET FORM */
                  <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                      <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#ffffff' }}>
                        <i className="fa-solid fa-pen-to-square" style={{ color: '#00d4ff', marginRight: '8px' }}></i>
                        Start a Direct Support Inquiry
                      </h4>
                      {threads.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setIsCreatingNew(false)}
                          style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: '0.75rem', cursor: 'pointer' }}
                        >
                          &larr; Back to ongoing chat
                        </button>
                      )}
                    </div>

                    {feedbackMsg && (
                      <div
                        style={{
                          padding: '10px 14px',
                          borderRadius: '8px',
                          fontSize: '0.8rem',
                          marginBottom: '16px',
                          background: feedbackMsg.type === 'success' ? 'rgba(74, 222, 128, 0.12)' : 'rgba(255, 142, 142, 0.12)',
                          color: feedbackMsg.type === 'success' ? '#4ade80' : '#ff8e8e',
                          border: feedbackMsg.type === 'success' ? '1px solid rgba(74, 222, 128, 0.3)' : '1px solid rgba(255, 142, 142, 0.3)'
                        }}
                      >
                        {feedbackMsg.text}
                      </div>
                    )}

                    <form onSubmit={handleCreateTicket} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      {/* Topic chips */}
                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#9ca3af', display: 'block', marginBottom: '6px' }}>
                          Select Inquiry Category
                        </label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {[
                            { key: 'billing', label: 'Billing & Receipt' },
                            { key: 'support', label: 'Technical Support' },
                            { key: 'team', label: 'Team & Permissions' },
                            { key: 'feature', label: 'Feature Request' },
                            { key: 'concierge', label: 'Enterprise Concierge' },
                          ].map(cat => (
                            <button
                              type="button"
                              key={cat.key}
                              onClick={() => setNewCategory(cat.key)}
                              style={{
                                padding: '5px 12px',
                                borderRadius: '16px',
                                fontSize: '0.74rem',
                                fontWeight: 600,
                                border: newCategory === cat.key ? '1px solid #00d4ff' : '1px solid rgba(255, 255, 255, 0.1)',
                                background: newCategory === cat.key ? 'rgba(0, 212, 255, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                                color: newCategory === cat.key ? '#00d4ff' : '#9ca3af',
                                cursor: 'pointer'
                              }}
                            >
                              {cat.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#9ca3af', display: 'block', marginBottom: '6px' }}>
                          Subject / Inquiry Summary
                        </label>
                        <input
                          type="text"
                          required
                          value={newSubject}
                          onChange={(e) => setNewSubject(e.target.value)}
                          placeholder="e.g. Question regarding recent Pro upgrade receipt or Runway projection..."
                          style={{
                            width: '100%',
                            padding: '10px 14px',
                            background: '#141822',
                            border: '1px solid rgba(255, 255, 255, 0.12)',
                            borderRadius: '10px',
                            color: '#ffffff',
                            fontSize: '0.85rem'
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#9ca3af', display: 'block', marginBottom: '6px' }}>
                          Detailed Message
                        </label>
                        <textarea
                          required
                          rows={4}
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          placeholder="Please describe how we can assist you. Include any relevant transaction references or details..."
                          style={{
                            width: '100%',
                            padding: '10px 14px',
                            background: '#141822',
                            border: '1px solid rgba(255, 255, 255, 0.12)',
                            borderRadius: '10px',
                            color: '#ffffff',
                            fontSize: '0.85rem',
                            resize: 'vertical',
                            lineHeight: 1.5
                          }}
                        />
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                        {threads.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setIsCreatingNew(false)}
                            style={{
                              padding: '10px 18px',
                              background: 'transparent',
                              border: '1px solid rgba(255, 255, 255, 0.15)',
                              borderRadius: '10px',
                              color: '#9ca3af',
                              fontSize: '0.82rem',
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                          >
                            Cancel
                          </button>
                        )}
                        <button
                          type="submit"
                          disabled={sending || !newSubject.trim() || !newMessage.trim()}
                          style={{
                            padding: '10px 22px',
                            background: 'linear-gradient(135deg, #00d4ff, #7c5fe6)',
                            border: 'none',
                            borderRadius: '10px',
                            color: '#ffffff',
                            fontSize: '0.82rem',
                            fontWeight: 700,
                            cursor: sending ? 'wait' : 'pointer',
                            opacity: sending || !newSubject.trim() || !newMessage.trim() ? 0.6 : 1,
                            boxShadow: '0 0 15px rgba(0, 212, 255, 0.3)'
                          }}
                        >
                          {sending ? (
                            <span><i className="fa-solid fa-spinner fa-spin"></i> Dispatching...</span>
                          ) : (
                            <span><i className="fa-solid fa-paper-plane"></i> Send to Support</span>
                          )}
                        </button>
                      </div>
                    </form>
                  </div>
                ) : activeThread ? (
                  /* ACTIVE THREAD CONVERSATION */
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                    {/* Thread header */}
                    <div
                      style={{
                        padding: '12px 18px',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: 'rgba(0, 0, 0, 0.15)',
                        flexShrink: 0
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#ffffff' }}>
                            {activeThread.subject}
                          </span>
                          <span
                            style={{
                              fontSize: '0.65rem',
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: '6px',
                              background: activeThread.status === 'resolved' ? 'rgba(74, 222, 128, 0.15)' : 'rgba(0, 212, 255, 0.15)',
                              color: activeThread.status === 'resolved' ? '#4ade80' : '#00d4ff',
                              textTransform: 'uppercase'
                            }}
                          >
                            {activeThread.status}
                          </span>
                        </div>
                        <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>
                          Category: <span style={{ color: '#00d4ff', textTransform: 'capitalize' }}>{activeThread.label || 'support'}</span> &bull; Ticket ID: {activeThread.id}
                        </span>
                      </div>

                      <button
                        onClick={() => fetchThreads(false)}
                        title="Refresh Conversation"
                        style={{
                          background: 'rgba(255, 255, 255, 0.04)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '8px',
                          color: '#9ca3af',
                          padding: '6px 10px',
                          cursor: 'pointer',
                          fontSize: '0.75rem'
                        }}
                      >
                        <i className="fa-solid fa-arrows-rotate"></i>
                      </button>
                    </div>

                    {/* Messages Scroll Area */}
                    <div
                      style={{
                        flex: 1,
                        overflowY: 'auto',
                        padding: '18px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '14px'
                      }}
                    >
                      {activeThread.messages && activeThread.messages.length > 0 ? (
                        activeThread.messages.map((m: SupportMessageItem) => {
                          const isAdmin = m.sender === 'admin';
                          return (
                            <div
                              key={m.id}
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: isAdmin ? 'flex-start' : 'flex-end',
                                maxWidth: '85%',
                                alignSelf: isAdmin ? 'flex-start' : 'flex-end'
                              }}
                            >
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  marginBottom: '4px',
                                  fontSize: '0.7rem',
                                  color: '#9ca3af'
                                }}
                              >
                                {isAdmin ? (
                                  <>
                                    <span
                                      style={{
                                        width: '18px',
                                        height: '18px',
                                        borderRadius: '50%',
                                        background: 'linear-gradient(135deg, #00d4ff, #7c5fe6)',
                                        color: '#fff',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '0.55rem',
                                        fontWeight: 800
                                      }}
                                    >
                                      A
                                    </span>
                                    <strong style={{ color: '#00d4ff' }}>Axis Support Concierge</strong>
                                  </>
                                ) : (
                                  <strong style={{ color: '#e2e8f0' }}>You</strong>
                                )}
                                <span>&bull;</span>
                                <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.65rem' }}>
                                  {formatNotificationTime(m.timestamp)}
                                </span>
                              </div>

                              <div
                                style={{
                                  padding: '12px 16px',
                                  borderRadius: isAdmin ? '4px 16px 16px 16px' : '16px 4px 16px 16px',
                                  background: isAdmin ? 'linear-gradient(145deg, #121927, #162033)' : 'linear-gradient(145deg, #1e2638, #182234)',
                                  border: isAdmin ? '1px solid rgba(0, 212, 255, 0.25)' : '1px solid rgba(255, 255, 255, 0.1)',
                                  boxShadow: isAdmin ? '0 4px 20px rgba(0, 212, 255, 0.08)' : '0 4px 15px rgba(0, 0, 0, 0.3)',
                                  color: '#ffffff',
                                  fontSize: '0.84rem',
                                  lineHeight: 1.55,
                                  whiteSpace: 'pre-wrap',
                                  wordBreak: 'break-word'
                                }}
                              >
                                {m.text}
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div style={{ textAlign: 'center', color: '#64748b', padding: '40px 0', fontSize: '0.8rem' }}>
                          No messages recorded in this conversation yet.
                        </div>
                      )}
                      <div ref={messagesEndRef} />
                    </div>

                    {/* Chat Input Bar */}
                    <form
                      onSubmit={handleSendReply}
                      style={{
                        padding: '12px 16px',
                        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                        background: 'rgba(0, 0, 0, 0.3)',
                        display: 'flex',
                        gap: '10px',
                        alignItems: 'center',
                        flexShrink: 0
                      }}
                    >
                      <input
                        type="text"
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Type your message to Axis Concierge..."
                        disabled={sending}
                        style={{
                          flex: 1,
                          padding: '10px 16px',
                          background: '#141822',
                          border: '1px solid rgba(255, 255, 255, 0.14)',
                          borderRadius: '12px',
                          color: '#ffffff',
                          fontSize: '0.84rem'
                        }}
                      />
                      <button
                        type="submit"
                        disabled={sending || !replyText.trim()}
                        style={{
                          padding: '10px 18px',
                          background: 'linear-gradient(135deg, #00d4ff, #7c5fe6)',
                          border: 'none',
                          borderRadius: '12px',
                          color: '#ffffff',
                          fontSize: '0.84rem',
                          fontWeight: 700,
                          cursor: sending || !replyText.trim() ? 'not-allowed' : 'pointer',
                          opacity: sending || !replyText.trim() ? 0.5 : 1,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: '0 0 12px rgba(0, 212, 255, 0.3)',
                          flexShrink: 0
                        }}
                      >
                        {sending ? (
                          <i className="fa-solid fa-spinner fa-spin"></i>
                        ) : (
                          <>
                            <span>Send</span>
                            <i className="fa-solid fa-paper-plane" style={{ fontSize: '0.75rem' }}></i>
                          </>
                        )}
                      </button>
                    </form>
                  </div>
                ) : (
                  /* NO THREADS & NOT CREATING */
                  <div
                    style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '30px',
                      textAlign: 'center'
                    }}
                  >
                    <div
                      style={{
                        width: '64px',
                        height: '64px',
                        borderRadius: '20px',
                        background: 'rgba(0, 212, 255, 0.1)',
                        border: '1px solid rgba(0, 212, 255, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#00d4ff',
                        fontSize: '1.8rem',
                        marginBottom: '16px'
                      }}
                    >
                      <i className="fa-solid fa-comments"></i>
                    </div>
                    <h4 style={{ margin: '0 0 6px', fontSize: '1.05rem', fontWeight: 700, color: '#ffffff' }}>
                      Welcome to Axis Concierge
                    </h4>
                    <p style={{ margin: '0 0 20px', fontSize: '0.82rem', color: '#9ca3af', maxWidth: '380px' }}>
                      Have a question regarding your subscription upgrade, ledger analytics, or team settings? Start a live conversation with our support team.
                    </p>
                    <button
                      onClick={() => setIsCreatingNew(true)}
                      style={{
                        padding: '10px 24px',
                        background: 'linear-gradient(135deg, #00d4ff, #7c5fe6)',
                        border: 'none',
                        borderRadius: '12px',
                        color: '#ffffff',
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        boxShadow: '0 0 20px rgba(0, 212, 255, 0.4)'
                      }}
                    >
                      <i className="fa-solid fa-pen-to-square" style={{ marginRight: '8px' }}></i>
                      Start New Inquiry
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: DIRECT CHANNELS */}
          {activeTab === 'contact' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ margin: '0 0 4px', fontSize: '1rem', fontWeight: 700, color: '#ffffff' }}>
                  Enterprise Communication Channels
                </h4>
                <p style={{ margin: 0, fontSize: '0.78rem', color: '#9ca3af' }}>
                  Direct contact endpoints for executive escalation, billing queries, and integration support.
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px', marginBottom: '24px' }}>
                {/* Email card */}
                <div
                  style={{
                    padding: '16px',
                    borderRadius: '14px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(0, 212, 255, 0.25)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '14px'
                  }}
                >
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '10px',
                      background: 'rgba(0, 212, 255, 0.15)',
                      color: '#00d4ff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.1rem',
                      flexShrink: 0
                    }}
                  >
                    <i className="fa-solid fa-envelope"></i>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#ffffff' }}>Concierge Email</div>
                    <div style={{ fontSize: '0.78rem', color: '#00d4ff', marginTop: '2px', fontFamily: 'JetBrains Mono' }}>
                      nairobi@axisblack.io
                    </div>
                    <p style={{ fontSize: '0.72rem', color: '#9ca3af', margin: '4px 0 10px' }}>
                      Official responses within 1-2 business hours.
                    </p>
                    <a
                      href="mailto:nairobi@axisblack.io?subject=Axis%20Black%20Support%20Inquiry"
                      style={{
                        display: 'inline-block',
                        padding: '4px 12px',
                        borderRadius: '6px',
                        background: 'rgba(0, 212, 255, 0.15)',
                        border: '1px solid rgba(0, 212, 255, 0.3)',
                        color: '#00d4ff',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        textDecoration: 'none'
                      }}
                    >
                      Compose Email &rarr;
                    </a>
                  </div>
                </div>

                {/* Direct Phone / WhatsApp card */}
                <div
                  style={{
                    padding: '16px',
                    borderRadius: '14px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(74, 222, 128, 0.25)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '14px'
                  }}
                >
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '10px',
                      background: 'rgba(74, 222, 128, 0.15)',
                      color: '#4ade80',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.1rem',
                      flexShrink: 0
                    }}
                  >
                    <i className="fa-solid fa-phone"></i>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#ffffff' }}>Direct Line &amp; WhatsApp</div>
                    <div style={{ fontSize: '0.78rem', color: '#4ade80', marginTop: '2px', fontFamily: 'JetBrains Mono' }}>
                      +254 700 000 000
                    </div>
                    <p style={{ fontSize: '0.72rem', color: '#9ca3af', margin: '4px 0 10px' }}>
                      Available Mon–Fri: 08:00 – 18:00 EAT
                    </p>
                    <a
                      href="https://wa.me/254700000000?text=Hello%20Axis%20Black%20Support"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-block',
                        padding: '4px 12px',
                        borderRadius: '6px',
                        background: 'rgba(74, 222, 128, 0.15)',
                        border: '1px solid rgba(74, 222, 128, 0.3)',
                        color: '#4ade80',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        textDecoration: 'none'
                      }}
                    >
                      Open WhatsApp &rarr;
                    </a>
                  </div>
                </div>

                {/* Physical Headquarters */}
                <div
                  style={{
                    padding: '16px',
                    borderRadius: '14px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(167, 139, 250, 0.25)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '14px'
                  }}
                >
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '10px',
                      background: 'rgba(167, 139, 250, 0.15)',
                      color: '#a78bfa',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.1rem',
                      flexShrink: 0
                    }}
                  >
                    <i className="fa-solid fa-building"></i>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#ffffff' }}>Regional Headquarters</div>
                    <div style={{ fontSize: '0.78rem', color: '#e2e8f0', marginTop: '2px' }}>
                      The Oval, Ring Road Parklands
                    </div>
                    <p style={{ fontSize: '0.72rem', color: '#9ca3af', margin: '4px 0 0' }}>
                      Westlands, Nairobi, Kenya &bull; Private Consultations by appointment.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: FAQ */}
          {activeTab === 'faq' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
              <div style={{ marginBottom: '18px' }}>
                <h4 style={{ margin: '0 0 4px', fontSize: '1rem', fontWeight: 700, color: '#ffffff' }}>
                  Frequently Asked Questions
                </h4>
                <p style={{ margin: 0, fontSize: '0.78rem', color: '#9ca3af' }}>
                  Instant answers to common billing, account tier, and collaborative access inquiries.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[
                  {
                    q: 'How does upgrading my account benefit my team members?',
                    a: 'All team members assigned to your business profile inherit your subscription tier immediately. When you upgrade to Starter or Pro, all team members gain access to advanced metrics, collaborative branch operations, and inventory features without requiring separate subscriptions.'
                  },
                  {
                    q: 'How do I receive my payment receipt and tax invoice?',
                    a: 'Upon successful payment verification (via M-Pesa STK push, Till approval, or Card), an official payment receipt is immediately dispatched to your account email address and saved as an in-app system notification.'
                  },
                  {
                    q: 'How do M-Pesa Till payments get verified?',
                    a: 'When you submit your M-Pesa transaction reference (e.g. QBC123XYZ) under Buy Goods Till 3645270, our admin operations team reviews the payment in real time and approves the tier, instantly firing your activation email and receipt.'
                  },
                  {
                    q: 'Can I extend my daily query limit when on the Pro tier?',
                    a: 'Yes. Pro tier subscribers have access to a daily limit extension button in the billing console, granting extra daily AI financial agent interactions.'
                  }
                ].map((faq, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '14px 16px',
                      borderRadius: '12px',
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.08)'
                    }}
                  >
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#00d4ff', marginBottom: '6px' }}>
                      {faq.q}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#cbd5e1', lineHeight: 1.55 }}>
                      {faq.a}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
