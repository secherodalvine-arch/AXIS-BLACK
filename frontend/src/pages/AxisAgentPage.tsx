import React, { useEffect, useRef, useState } from 'react';
import { ChatMessage, Currency, MetricData } from '../types';
import { getAgentSessionsApi, saveAgentSessionApi, deleteAgentSessionApi } from '../utils/api';

export interface ChatSession {
  id: string;
  title: string;
  timestamp: string;
  messages: ChatMessage[];
}

interface AxisAgentWorkspaceProps {
  messages: ChatMessage[];
  currency?: Currency;
  metrics?: MetricData[];
  isProcessing?: boolean;
  processingStep?: string;
  onSendMessage: (msgText: string) => void;
  onAdvisorAction?: (actionTitle: string) => void;
  onNewChat?: () => void;
  user?: any;
}

const TEMPLATES = [
  { title: 'Q3 Burn Rate Variance', prompt: 'Analyze burn rate variance for Q3 vs Q2' },
  { title: 'Hiring 4 Senior Engineers', prompt: 'Simulate hiring 4 senior engineers in October ($180k avg)' },
  { title: 'Tax Loss Harvesting', prompt: 'Generate tax-loss harvesting recommendations for treasury' },
  { title: 'SaaS Spend Audit', prompt: 'Audit all software vendor contracts exceeding $1,000/mo' }
];

const createDefaultSession = (): ChatSession => ({
  id: `session-${Date.now()}`,
  title: 'Active Intelligence Workspace',
  timestamp: 'Just now',
  messages: []
});

const loadSessionsFromStorage = (userId?: string): ChatSession[] => {
  const key = userId ? `axis_chats_${userId}` : 'axis_chats_guest';
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Error reading local chat sessions:', e);
  }
  return [createDefaultSession()];
};

const renderFormattedText = (text: string) => {
  const lines = text.split('\n');
  return lines.map((line, index) => {
    const parts = line.split(/(\*\*.*?\*\*)/g);
    const renderedLine = parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} style={{ color: '#ffffff', fontWeight: 700 }}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });

    if (line.startsWith('### ')) {
      return (
        <h4 key={index} style={{ fontSize: '0.98rem', fontWeight: 700, color: '#00d4ff', marginTop: index > 0 ? '0.75rem' : 0, marginBottom: '0.4rem', fontFamily: 'Plus Jakarta Sans' }}>
          {line.replace('### ', '')}
        </h4>
      );
    }
    if (line.startsWith('- ')) {
      return (
        <div key={index} style={{ display: 'flex', gap: '8px', marginLeft: '0.5rem', marginBottom: '0.3rem', color: '#e5e2e1' }}>
          <span style={{ color: '#00d4ff' }}>•</span>
          <div>{renderedLine.slice(1)}</div>
        </div>
      );
    }
    if (line.match(/^\d+\.\s/)) {
      return (
        <div key={index} style={{ display: 'flex', gap: '8px', marginLeft: '0.5rem', marginBottom: '0.3rem', color: '#e5e2e1' }}>
          <div>{renderedLine}</div>
        </div>
      );
    }
    if (!line.trim()) {
      return <div key={index} style={{ height: '0.35rem' }} />;
    }
    return <p key={index} style={{ marginBottom: '0.4rem', lineHeight: '1.5', color: '#e5e2e1' }}>{renderedLine}</p>;
  });
};

const TypewriterMessage: React.FC<{ text: string; isLatestAI: boolean }> = ({ text, isLatestAI }) => {
  const [displayedText, setDisplayedText] = useState(isLatestAI ? '' : text);
  const [isTyping, setIsTyping] = useState(isLatestAI);

  useEffect(() => {
    if (!isLatestAI) {
      setDisplayedText(text);
      setIsTyping(false);
      return;
    }

    let currentIndex = 0;
    setDisplayedText('');
    setIsTyping(true);

    const interval = setInterval(() => {
      currentIndex += Math.floor(Math.random() * 3) + 2;
      if (currentIndex >= text.length) {
        setDisplayedText(text);
        setIsTyping(false);
        clearInterval(interval);
      } else {
        setDisplayedText(text.slice(0, currentIndex));
      }
    }, 16);

    return () => clearInterval(interval);
  }, [text, isLatestAI]);

  return (
    <>
      {renderFormattedText(displayedText)}
      {isTyping && <span className="typewriter-cursor"></span>}
    </>
  );
};

export const AxisAgentWorkspace: React.FC<AxisAgentWorkspaceProps> = ({
  messages: propMessages,
  currency: _currency = 'USD',
  metrics: _metrics = [],
  isProcessing = false,
  processingStep: _processingStep,
  onSendMessage,
  onAdvisorAction: _onAdvisorAction,
  onNewChat,
  user
}) => {
  const storageKey = user?.user_id ? `axis_chats_${user.user_id}` : 'axis_chats_guest';
  const [sessions, setSessions] = useState<ChatSession[]>(() => loadSessionsFromStorage(user?.user_id));
  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    const s = loadSessionsFromStorage(user?.user_id);
    return s[0]?.id || 'session-default';
  });
  const [inputVal, setInputVal] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Fetch live chat sessions from MongoDB backend on mount & user change
  useEffect(() => {
    let mounted = true;
    if (user?.user_id) {
      getAgentSessionsApi()
        .then((mongoSessions) => {
          if (mounted && Array.isArray(mongoSessions) && mongoSessions.length > 0) {
            setSessions(mongoSessions);
            setActiveSessionId(mongoSessions[0].id);
          }
        })
        .catch(() => {
          const fallback = loadSessionsFromStorage(user?.user_id);
          if (mounted) {
            setSessions(fallback);
            if (fallback.length) setActiveSessionId(fallback[0].id);
          }
        });
    } else {
      const fallback = loadSessionsFromStorage();
      setSessions(fallback);
      if (fallback.length) setActiveSessionId(fallback[0].id);
    }
    return () => { mounted = false; };
  }, [user?.user_id]);

  // Persist sessions to local fallback cache
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(sessions));
    } catch (e) {
      console.error('Error caching chat sessions:', e);
    }
  }, [sessions, storageKey]);

  // Sync latest AI response from parent propMessages into active session & save to MongoDB
  useEffect(() => {
    if (propMessages && propMessages.length > 0) {
      const latestMsg = propMessages[propMessages.length - 1];
      if (latestMsg.sender === 'ai' && !latestMsg.id.startsWith('msg-1') && !latestMsg.id.startsWith('welcome-')) {
        setSessions(prevSessions => {
          return prevSessions.map(s => {
            if (s.id === activeSessionId) {
              const hasMessage = s.messages.some(m => m.id === latestMsg.id);
              if (!hasMessage) {
                const updatedSession = {
                  ...s,
                  messages: [...s.messages, latestMsg]
                };
                if (user?.user_id && updatedSession.messages.some(m => m.sender === 'user')) {
                  saveAgentSessionApi(updatedSession).catch(err => console.log('Mongo session save:', err));
                }
                return updatedSession;
              }
            }
            return s;
          });
        });
      }
    }
  }, [propMessages, activeSessionId, user?.user_id]);

  const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0];
  const activeMessages = activeSession ? activeSession.messages : [];

  // Filter history to ONLY show sessions where user-AI exchanges have occurred
  const historySessions = sessions.filter(s => s.messages.some(m => m.sender === 'user'));

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeMessages, isProcessing]);

  const handleCreateNewChat = () => {
    if (onNewChat) onNewChat();
    const newSession = createDefaultSession();
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
    setInputVal('');
  };

  const handleSelectSession = (sessionId: string) => {
    if (onNewChat) onNewChat();
    setActiveSessionId(sessionId);
  };

  const handleDeleteSession = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    if (user?.user_id) {
      deleteAgentSessionApi(sessionId).catch(err => console.log('Mongo session delete:', err));
    }
    setSessions(prev => {
      const filtered = prev.filter(s => s.id !== sessionId);
      const remaining = filtered.length > 0 ? filtered : [createDefaultSession()];
      if (activeSessionId === sessionId) {
        setActiveSessionId(remaining[0].id);
      }
      return remaining;
    });
  };

  const handlePromptSubmit = (textToSubmit: string) => {
    if (!textToSubmit.trim() || isProcessing) return;
    const cleanText = textToSubmit.trim();
    setInputVal('');

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: cleanText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setSessions(prev => prev.map(s => {
      if (s.id === activeSessionId) {
        const isGenericTitle = s.title === 'New Intelligence Chat' || s.title === 'Active Intelligence Workspace';
        const newTitle = isGenericTitle ? (cleanText.length > 32 ? cleanText.slice(0, 32) + '...' : cleanText) : s.title;
        const updated = {
          ...s,
          title: newTitle,
          messages: [...s.messages, userMsg]
        };
        if (user?.user_id) {
          saveAgentSessionApi(updated).catch(err => console.log('Mongo session save on prompt:', err));
        }
        return updated;
      }
      return s;
    }));

    onSendMessage(cleanText);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handlePromptSubmit(inputVal);
  };

  return (
    <div className="tab-view active">
      {/* Interactive Axis Agent Workspace */}
      <div className="copilot-workspace" style={{ marginTop: '0.5rem' }}>
        
        {/* SIDEBAR: NEW CHAT & CLICKABLE SCROLLABLE CHAT HISTORY */}
        <div className="copilot-sidebar glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Single Primary Action Button */}
          <button 
            className="action-btn-primary" 
            onClick={handleCreateNewChat}
            style={{ width: '100%', justifyContent: 'center', gap: '8px', padding: '12px', borderRadius: '12px', fontSize: '0.9rem', fontWeight: 700 }}
          >
            <i className="fa-solid fa-plus"></i> + New Chat Session
          </button>

          {/* Clickable Scrollable Chat History - ONLY SHOW SESSIONS WITH EXCHANGES */}
          <div>
            <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#cebdff', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="fa-solid fa-clock-rotate-left" style={{ color: '#00d4ff' }}></i> Chat History ({historySessions.length})
            </h3>
            <div className="copilot-sidebar-scroll">
              {historySessions.length === 0 ? (
                <div style={{ fontSize: '0.78rem', color: '#9ca3af', fontStyle: 'italic', padding: '6px 4px' }}>
                  No session history yet. History is recorded when you send a query.
                </div>
              ) : (
                historySessions.map(s => {
                  const isActive = s.id === activeSessionId;
                  return (
                    <div 
                      key={s.id}
                      className={`template-item ${isActive ? 'active' : ''}`}
                      onClick={() => handleSelectSession(s.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 12px',
                        borderRadius: '10px',
                        background: isActive ? 'rgba(0, 212, 255, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                        border: isActive ? '1px solid rgba(0, 212, 255, 0.35)' : '1px solid rgba(255, 255, 255, 0.06)',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden', flex: 1 }}>
                        <i className="fa-solid fa-comments" style={{ color: isActive ? '#00d4ff' : 'var(--text-muted)', fontSize: '0.9rem', flexShrink: 0 }}></i>
                        <div style={{ overflow: 'hidden' }}>
                          <div style={{ color: isActive ? '#fff' : 'var(--text-main)', fontSize: '0.85rem', fontWeight: isActive ? 700 : 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {s.title}
                          </div>
                          <div style={{ color: 'var(--text-dim)', fontSize: '0.72rem', marginTop: '2px' }}>
                            {s.timestamp}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={(e) => handleDeleteSession(e, s.id)}
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '4px', fontSize: '0.75rem', borderRadius: '4px' }}
                        title="Delete Session"
                      >
                        <i className="fa-solid fa-trash-can"></i>
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Clickable Scrollable Saved Prompt Templates */}
          <div>
            <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#cebdff', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="fa-solid fa-brain" style={{ color: '#00d4ff' }}></i> Saved Templates
            </h3>
            <div className="copilot-sidebar-scroll" style={{ maxHeight: '180px' }}>
              {TEMPLATES.map((tmpl, idx) => (
                <button 
                  key={idx}
                  className="template-item"
                  onClick={() => handlePromptSubmit(tmpl.prompt)}
                  style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}
                >
                  <i className="fa-solid fa-sparkles" style={{ color: '#cebdff', flexShrink: 0 }}></i>
                  <span style={{ fontSize: '0.82rem' }}>{tmpl.title}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* MAIN CHAT CONTAINER */}
        <div className="copilot-chat-container glass-card">
          <div className="chat-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div className="ai-avatar-badge" style={{ background: 'rgba(0, 212, 255, 0.15)', color: '#00d4ff' }}>
                <i className="fa-solid fa-brain"></i>
              </div>
              <div>
                <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                  {activeSession ? activeSession.title : 'Axis Agent'}
                  <span className="pulse-badge"><span className="pulse-dot"></span> Live</span>
                </h4>
                <span className="status-subtitle">Connected to Axis Real-Time Business Data Intelligence</span>
              </div>
            </div>
          </div>

          <div className="chat-messages">
            {/* INITIAL CLEAN WELCOME BANNER IF NO MESSAGES IN ACTIVE SESSION YET */}
            {activeMessages.length === 0 && (
              <div className="chat-msg ai-msg">
                <div className="msg-avatar" style={{ background: 'rgba(0, 212, 255, 0.15)', color: '#00d4ff' }}>
                  <i className="fa-solid fa-brain"></i>
                </div>
                <div className="msg-bubble">
                  <p style={{ marginBottom: '0.4rem', lineHeight: '1.5', color: '#e5e2e1' }}>
                    Greetings! I am Axis, your real-time business data intelligence assistant. How can I assist your financial strategy today?
                  </p>
                  <div className="quick-chips" style={{ marginTop: '12px' }}>
                    {['What is our projected cash balance in 90 days?', 'Show top 3 cost optimization targets', 'Simulate hiring 3 engineers in October'].map((sug, i) => (
                      <button key={i} className="chip-btn" onClick={() => handlePromptSubmit(sug)}>
                        {sug}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeMessages.map((msg, index) => {
              const isLatestAI = msg.sender === 'ai' && index === activeMessages.length - 1;
              return (
                <div key={msg.id} className={`chat-msg ${msg.sender === 'user' ? 'user-msg' : 'ai-msg'}`}>
                  <div className="msg-avatar" style={{ background: msg.sender === 'user' ? 'rgba(255,255,255,0.1)' : 'rgba(0,212,255,0.15)', color: msg.sender === 'user' ? '#fff' : '#00d4ff' }}>
                    <i className={`fa-solid ${msg.sender === 'user' ? 'fa-user' : 'fa-brain'}`}></i>
                  </div>
                  <div className="msg-bubble">
                    <TypewriterMessage text={msg.text} isLatestAI={isLatestAI} />
                    {msg.suggestions && (
                      <div className="quick-chips" style={{ marginTop: '12px' }}>
                        {msg.suggestions.map((sug, i) => (
                          <button key={i} className="chip-btn" onClick={() => handlePromptSubmit(sug)}>
                            {sug}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Processing Indicator: "Axis is thinking..." with animated dots */}
            {isProcessing && (
              <div className="chat-msg ai-msg">
                <div className="msg-avatar" style={{ background: 'rgba(0,212,255,0.15)', color: '#00d4ff' }}>
                  <i className="fa-solid fa-brain"></i>
                </div>
                <div className="msg-bubble" style={{ background: 'transparent', border: 'none', padding: 0 }}>
                  <div className="axis-spinner-container">
                    <div className="axis-spinner-ring"></div>
                    <span>Axis is thinking<span className="thinking-dots"></span></span>
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <form onSubmit={handleSubmit} className="chat-input-area" style={{ alignItems: 'center' }}>
            <textarea 
              rows={2}
              placeholder="Ask Axis Agent a business scenario or query..."
              value={inputVal}
              disabled={isProcessing}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
            />
            <button 
              type="submit" 
              className="action-btn-primary" 
              disabled={isProcessing || !inputVal.trim()}
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                padding: 0,
                justifyContent: 'center',
                flexShrink: 0,
                opacity: isProcessing || !inputVal.trim() ? 0.6 : 1,
                cursor: isProcessing || !inputVal.trim() ? 'not-allowed' : 'pointer'
              }}
              title={isProcessing ? "Processing..." : "Send Message"}
            >
              {isProcessing ? (
                <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: '1rem' }}></i>
              ) : (
                <i className="fa-solid fa-arrow-up" style={{ fontSize: '1rem' }}></i>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
