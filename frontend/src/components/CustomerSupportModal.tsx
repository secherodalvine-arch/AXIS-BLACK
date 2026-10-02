import React, { useState, useEffect, useRef } from 'react';
import {
  getMySupportThreadsApi,
  replySupportThreadApi,
  sendSupportMessageApi,
  SupportThread
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

      setFeedbackMsg({ type: 'success', text: 'Message sent to customer support. Our team will reply shortly.' });
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
      setFeedbackMsg({ type: 'error', text: err.message || 'Could not send message. Please try again.' });
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="support-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="support-modal-card">
        {/* Top Header */}
        <div className="support-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #00d4ff, #7c5fe6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: '1rem',
                boxShadow: '0 0 15px rgba(0, 212, 255, 0.4)',
                flexShrink: 0
              }}
            >
              <i className="fa-solid fa-headset"></i>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 className="support-modal-title">
                  Customer Support Desk
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
                    background: 'rgba(34, 197, 94, 0.15)',
                    color: '#22c55e',
                    border: '1px solid rgba(34, 197, 94, 0.3)'
                  }}
                >
                  <span
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: '#22c55e',
                      boxShadow: '0 0 6px #22c55e'
                    }}
                  />
                  ONLINE
                </span>
              </div>
              <p className="support-modal-subtitle">
                24/7 Financial operations support
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="support-modal-close-btn"
            title="Close Support Desk"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="support-tabs-bar">
          <button
            onClick={() => setActiveTab('chat')}
            className={`support-tab-btn ${activeTab === 'chat' ? 'active' : ''}`}
          >
            <i className="fa-solid fa-comments"></i>
            <span>Messages</span>
            {threads.length > 0 && (
              <span
                style={{
                  fontSize: '0.65rem',
                  padding: '1px 6px',
                  borderRadius: '10px',
                  background: activeTab === 'chat' ? '#00d4ff' : 'rgba(255, 255, 255, 0.12)',
                  color: activeTab === 'chat' ? '#000' : 'inherit',
                  fontWeight: 700
                }}
              >
                {threads.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('contact')}
            className={`support-tab-btn ${activeTab === 'contact' ? 'active' : ''}`}
          >
            <i className="fa-solid fa-address-book"></i>
            <span>Direct Channels</span>
          </button>

          <button
            onClick={() => setActiveTab('faq')}
            className={`support-tab-btn ${activeTab === 'faq' ? 'active' : ''}`}
          >
            <i className="fa-solid fa-circle-question"></i>
            <span>Help &amp; FAQs</span>
          </button>
        </div>

        {/* Tab Content */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          {/* TAB 1: LIVE CHAT & TICKETS */}
          {activeTab === 'chat' && (
            <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
              {/* Thread list sidebar */}
              <div className="support-thread-sidebar">
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
                    <i className="fa-solid fa-plus"></i> New Message
                  </button>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '6px' }}>
                  {loading && threads.length === 0 ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted, #9ca3af)', fontSize: '0.75rem' }}>
                      <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: '6px' }}></i> Loading...
                    </div>
                  ) : threads.length === 0 ? (
                    <div style={{ padding: '20px 10px', textAlign: 'center', color: 'var(--text-dim, #64748b)', fontSize: '0.75rem' }}>
                      No messages yet. Click "New Message" to chat with support.
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
                                color: isSelected ? '#00d4ff' : 'inherit',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                maxWidth: '130px'
                              }}
                            >
                              {t.subject || 'Support Request'}
                            </span>
                            <span
                              style={{
                                fontSize: '0.62rem',
                                padding: '1px 5px',
                                borderRadius: '6px',
                                fontWeight: 600,
                                background: t.status === 'resolved' ? 'rgba(74, 222, 128, 0.15)' : t.status === 'in_progress' ? 'rgba(0, 212, 255, 0.15)' : 'rgba(251, 191, 36, 0.15)',
                                color: t.status === 'resolved' ? '#22c55e' : t.status === 'in_progress' ? '#00d4ff' : '#fbbf24'
                              }}
                            >
                              {t.status === 'in_progress' ? 'Active' : t.status}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted, #9ca3af)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {lastMsg ? (lastMsg.sender === 'admin' ? `Support: ${lastMsg.text}` : `You: ${lastMsg.text}`) : 'No messages'}
                          </div>
                          <div style={{ fontSize: '0.62rem', color: 'var(--text-dim, #64748b)', marginTop: '3px', fontFamily: 'JetBrains Mono, monospace' }}>
                            {formatNotificationTime(t.updated_at || t.created_at)}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Main Chat / New Ticket Panel */}
              <div className="support-chat-panel">
                {isCreatingNew ? (
                  /* NEW TICKET FORM */
                  <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                      <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'inherit' }}>
                        <i className="fa-solid fa-pen-to-square" style={{ color: '#00d4ff', marginRight: '8px' }}></i>
                        Send a Message to Support
                      </h4>
                      {threads.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setIsCreatingNew(false)}
                          style={{ background: 'none', border: 'none', color: 'var(--text-muted, #9ca3af)', fontSize: '0.75rem', cursor: 'pointer' }}
                        >
                          &larr; Back to conversation
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
                          color: feedbackMsg.type === 'success' ? '#22c55e' : '#ef4444',
                          border: feedbackMsg.type === 'success' ? '1px solid rgba(74, 222, 128, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)'
                        }}
                      >
                        {feedbackMsg.text}
                      </div>
                    )}

                    <form onSubmit={handleCreateTicket} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      {/* Topic chips */}
                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted, #9ca3af)', display: 'block', marginBottom: '6px' }}>
                          Category
                        </label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {[
                            { key: 'billing', label: 'Billing & Receipt' },
                            { key: 'support', label: 'Technical Support' },
                            { key: 'team', label: 'Team & Permissions' },
                            { key: 'general', label: 'General Inquiry' },
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
                                border: newCategory === cat.key ? '1px solid #00d4ff' : '1px solid var(--glass-border, rgba(255, 255, 255, 0.1))',
                                background: newCategory === cat.key ? 'rgba(0, 212, 255, 0.15)' : 'transparent',
                                color: newCategory === cat.key ? '#00d4ff' : 'var(--text-muted, #9ca3af)',
                                cursor: 'pointer'
                              }}
                            >
                              {cat.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted, #9ca3af)', display: 'block', marginBottom: '6px' }}>
                          Subject
                        </label>
                        <input
                          type="text"
                          required
                          value={newSubject}
                          onChange={(e) => setNewSubject(e.target.value)}
                          placeholder="What can we help you with?"
                          className="support-input-field"
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted, #9ca3af)', display: 'block', marginBottom: '6px' }}>
                          Message
                        </label>
                        <textarea
                          required
                          rows={4}
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          placeholder="Write your message or question here..."
                          className="support-input-field"
                          style={{ resize: 'vertical', lineHeight: 1.5 }}
                        />
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                        {threads.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setIsCreatingNew(false)}
                            style={{
                              padding: '8px 16px',
                              background: 'transparent',
                              border: '1px solid var(--glass-border, rgba(255, 255, 255, 0.15))',
                              borderRadius: '10px',
                              color: 'var(--text-muted, #9ca3af)',
                              fontSize: '0.8rem',
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
                            padding: '8px 20px',
                            background: 'linear-gradient(135deg, #00d4ff, #7c5fe6)',
                            border: 'none',
                            borderRadius: '10px',
                            color: '#ffffff',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            cursor: sending ? 'not-allowed' : 'pointer',
                            opacity: sending ? 0.6 : 1,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          {sending ? (
                            <>
                              <i className="fa-solid fa-spinner fa-spin"></i>
                              <span>Sending...</span>
                            </>
                          ) : (
                            <>
                              <i className="fa-solid fa-paper-plane"></i>
                              <span>Send Message</span>
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  </div>
                ) : activeThread ? (
                  /* CONVERSATION THREAD VIEW */
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                    {/* Active Thread Banner */}
                    <div
                      style={{
                        padding: '12px 18px',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: 'rgba(0, 0, 0, 0.1)',
                        flexShrink: 0
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'inherit' }}>
                          {activeThread.subject}
                        </div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted, #9ca3af)' }}>
                          Ticket ID: <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{activeThread.id}</span>
                        </div>
                      </div>
                      <span
                        style={{
                          fontSize: '0.68rem',
                          padding: '3px 8px',
                          borderRadius: '8px',
                          fontWeight: 700,
                          background: activeThread.status === 'resolved' ? 'rgba(74, 222, 128, 0.15)' : 'rgba(0, 212, 255, 0.15)',
                          color: activeThread.status === 'resolved' ? '#22c55e' : '#00d4ff',
                          border: activeThread.status === 'resolved' ? '1px solid rgba(74, 222, 128, 0.3)' : '1px solid rgba(0, 212, 255, 0.3)'
                        }}
                      >
                        {activeThread.status === 'in_progress' ? 'Active' : activeThread.status}
                      </span>
                    </div>

                    {/* Chat Bubble Scroll Area */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {activeThread.messages && activeThread.messages.length > 0 ? (
                        activeThread.messages.map((m, idx) => {
                          const isAdmin = m.sender === 'admin';
                          return (
                            <div
                              key={idx}
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
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
                                  color: 'var(--text-muted, #9ca3af)'
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
                                    <strong style={{ color: '#00d4ff' }}>Axis Support</strong>
                                  </>
                                ) : (
                                  <strong>You</strong>
                                )}
                                <span>&bull;</span>
                                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem' }}>
                                  {formatNotificationTime(m.timestamp)}
                                </span>
                              </div>

                              <div
                                style={{
                                  padding: '12px 16px',
                                  borderRadius: isAdmin ? '4px 16px 16px 16px' : '16px 4px 16px 16px',
                                  background: isAdmin ? 'var(--bg-surface-high, #141b29)' : 'var(--bg-surface, #1e2638)',
                                  border: isAdmin ? '1px solid rgba(0, 212, 255, 0.25)' : '1px solid var(--glass-border, rgba(255, 255, 255, 0.1))',
                                  color: 'inherit',
                                  fontSize: '0.84rem',
                                  lineHeight: 1.55,
                                  whiteSpace: 'pre-wrap',
                                  wordBreak: 'break-word',
                                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)'
                                }}
                              >
                                {m.text}
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div style={{ textAlign: 'center', color: 'var(--text-dim, #64748b)', padding: '40px 0', fontSize: '0.8rem' }}>
                          No messages in this conversation yet.
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
                        background: 'rgba(0, 0, 0, 0.15)',
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
                        placeholder="Type a message..."
                        disabled={sending}
                        className="support-input-field"
                        style={{ flex: 1 }}
                      />
                      <button
                        type="submit"
                        disabled={sending || !replyText.trim()}
                        style={{
                          padding: '10px 18px',
                          background: 'linear-gradient(135deg, #00d4ff, #7c5fe6)',
                          border: 'none',
                          borderRadius: '10px',
                          color: '#ffffff',
                          fontSize: '0.84rem',
                          fontWeight: 700,
                          cursor: sending || !replyText.trim() ? 'not-allowed' : 'pointer',
                          opacity: sending || !replyText.trim() ? 0.5 : 1,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
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
                        width: '56px',
                        height: '56px',
                        borderRadius: '16px',
                        background: 'rgba(0, 212, 255, 0.1)',
                        border: '1px solid rgba(0, 212, 255, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#00d4ff',
                        fontSize: '1.6rem',
                        marginBottom: '14px'
                      }}
                    >
                      <i className="fa-solid fa-comments"></i>
                    </div>
                    <h4 style={{ margin: '0 0 6px', fontSize: '1.05rem', fontWeight: 700, color: 'inherit' }}>
                      Welcome to Customer Support
                    </h4>
                    <p style={{ margin: '0 0 18px', fontSize: '0.82rem', color: 'var(--text-muted, #9ca3af)', maxWidth: '380px' }}>
                      Have a question about your subscription, payments, or account? Send us a message and our team will get back to you.
                    </p>
                    <button
                      onClick={() => setIsCreatingNew(true)}
                      style={{
                        padding: '10px 22px',
                        background: 'linear-gradient(135deg, #00d4ff, #7c5fe6)',
                        border: 'none',
                        borderRadius: '10px',
                        color: '#ffffff',
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        boxShadow: '0 0 20px rgba(0, 212, 255, 0.35)'
                      }}
                    >
                      <i className="fa-solid fa-pen-to-square" style={{ marginRight: '8px' }}></i>
                      New Message
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: DIRECT CHANNELS (Using Homepage Contact Details) */}
          {activeTab === 'contact' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ margin: '0 0 4px', fontSize: '1rem', fontWeight: 700, color: 'inherit' }}>
                  Direct Support Channels
                </h4>
                <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted, #9ca3af)' }}>
                  Reach our team directly via WhatsApp, email, or phone.
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
                {/* WhatsApp Chat card */}
                <div className="support-channel-card">
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '10px',
                      background: 'rgba(34, 197, 94, 0.15)',
                      color: '#22c55e',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.2rem',
                      flexShrink: 0
                    }}
                  >
                    <i className="fa-brands fa-whatsapp"></i>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'inherit' }}>WhatsApp Support</div>
                    <div style={{ fontSize: '0.82rem', color: '#22c55e', marginTop: '2px', fontWeight: 600, fontFamily: 'JetBrains Mono, monospace' }}>
                      +254 769 231 760
                    </div>
                    <p style={{ fontSize: '0.74rem', color: 'var(--text-muted, #9ca3af)', margin: '4px 0 10px' }}>
                      Fast reply within minutes • Mon–Sat
                    </p>
                    <a
                      href="https://wa.me/254769231760?text=Hello%20Axis%20Black%20Support"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-block',
                        padding: '6px 14px',
                        borderRadius: '8px',
                        background: 'rgba(34, 197, 94, 0.15)',
                        border: '1px solid rgba(34, 197, 94, 0.35)',
                        color: '#22c55e',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        textDecoration: 'none'
                      }}
                    >
                      Open WhatsApp &rarr;
                    </a>
                  </div>
                </div>

                {/* Email Support card */}
                <div className="support-channel-card">
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
                    <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'inherit' }}>Email Support</div>
                    <div style={{ fontSize: '0.82rem', color: '#00d4ff', marginTop: '2px', fontWeight: 600 }}>
                      secherodalvine@gmail.com
                    </div>
                    <p style={{ fontSize: '0.74rem', color: 'var(--text-muted, #9ca3af)', margin: '4px 0 10px' }}>
                      Direct email assistance • Response within business hours
                    </p>
                    <a
                      href="mailto:secherodalvine@gmail.com?subject=Axis%20Black%20Support%20Inquiry"
                      style={{
                        display: 'inline-block',
                        padding: '6px 14px',
                        borderRadius: '8px',
                        background: 'rgba(0, 212, 255, 0.15)',
                        border: '1px solid rgba(0, 212, 255, 0.35)',
                        color: '#00d4ff',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        textDecoration: 'none'
                      }}
                    >
                      Send Email &rarr;
                    </a>
                  </div>
                </div>

                {/* Direct Phone Line */}
                <div className="support-channel-card">
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
                    <i className="fa-solid fa-phone"></i>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'inherit' }}>Phone &amp; SMS</div>
                    <div style={{ fontSize: '0.82rem', color: '#a78bfa', marginTop: '2px', fontWeight: 600, fontFamily: 'JetBrains Mono, monospace' }}>
                      +254 769 231 760
                    </div>
                    <p style={{ fontSize: '0.74rem', color: 'var(--text-muted, #9ca3af)', margin: '4px 0 10px' }}>
                      Direct phone line for immediate support
                    </p>
                    <a
                      href="tel:+254769231760"
                      style={{
                        display: 'inline-block',
                        padding: '6px 14px',
                        borderRadius: '8px',
                        background: 'rgba(167, 139, 250, 0.15)',
                        border: '1px solid rgba(167, 139, 250, 0.35)',
                        color: '#a78bfa',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        textDecoration: 'none'
                      }}
                    >
                      Call Now &rarr;
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: FAQ (Simplified & Streamlined) */}
          {activeTab === 'faq' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
              <div style={{ marginBottom: '18px' }}>
                <h4 style={{ margin: '0 0 4px', fontSize: '1rem', fontWeight: 700, color: 'inherit' }}>
                  Frequently Asked Questions
                </h4>
                <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted, #9ca3af)' }}>
                  Quick answers to common questions.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[
                  {
                    q: 'How does upgrading my account benefit my team members?',
                    a: 'When you upgrade your business to Starter or Pro, all team members assigned to your business profile automatically gain access to the same upgraded features without needing separate subscriptions.'
                  },
                  {
                    q: 'How do I receive my payment receipt?',
                    a: 'Upon successful payment verification, your official payment receipt is immediately emailed to you and saved in your notification drawer.'
                  },
                  {
                    q: 'How do M-Pesa payments get verified?',
                    a: 'After paying to Buy Goods Till 3645270, submit your M-Pesa transaction reference in the billing modal. Your payment is verified and your tier is immediately activated.'
                  },
                  {
                    q: 'How do I contact customer support directly?',
                    a: 'You can chat with us right here, message us on WhatsApp at +254 769 231 760, or email secherodalvine@gmail.com.'
                  }
                ].map((faq, idx) => (
                  <div key={idx} className="support-faq-card">
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#00d4ff', marginBottom: '6px' }}>
                      {faq.q}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted, #94a3b8)', lineHeight: 1.55 }}>
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
