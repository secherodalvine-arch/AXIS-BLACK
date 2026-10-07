import React, { useEffect, useRef, useState } from 'react';
import { ChatMessage, Currency, MetricData } from '../types';
import { getAgentSessionsApi, saveAgentSessionApi, deleteAgentSessionApi } from '../utils/api';
import { formatRelativeTime, extractValidDate, formatMessageTime } from '../utils/dateUtils';

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

const createDefaultSession = (): ChatSession => ({
  id: `session-${Date.now()}`,
  title: 'New Chat',
  timestamp: new Date().toISOString(),
  messages: []
});

// Heal and migrate any session with legacy "Just now" or invalid timestamps
const healSession = (s: any): ChatSession => {
  const extractedDate = extractValidDate(s.timestamp, s.id, s.messages);
  const isoTimestamp = extractedDate ? extractedDate.toISOString() : (s.timestamp && s.timestamp !== 'Just now' ? s.timestamp : new Date().toISOString());
  return {
    id: s.id || `session-${Date.now()}`,
    title: s.title || 'New Chat',
    timestamp: isoTimestamp,
    messages: Array.isArray(s.messages) ? s.messages : []
  };
};

const loadSessionsFromStorage = (userId?: string): ChatSession[] => {
  const key = userId ? `axis_chats_${userId}` : 'axis_chats_guest';
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(s => healSession(s));
      }
    }
  } catch (e) {
    console.error('Error reading local chat sessions:', e);
  }
  return [];
};

const renderFormattedText = (text: string) => {
  const lines = text.split('\n');
  return lines.map((line, index) => {
    const parts = line.split(/(\*\*.*?\*\*)/g);
    const renderedLine = parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} style={{ color: 'var(--text-main, #ffffff)', fontWeight: 700 }}>{part.slice(2, -2)}</strong>;
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
        <div key={index} style={{ display: 'flex', gap: '8px', marginLeft: '0.5rem', marginBottom: '0.3rem', color: 'var(--text-main, #e5e2e1)' }}>
          <span style={{ color: '#00d4ff' }}>•</span>
          <div>{renderedLine.slice(1)}</div>
        </div>
      );
    }
    if (line.match(/^\d+\.\s/)) {
      return (
        <div key={index} style={{ display: 'flex', gap: '8px', marginLeft: '0.5rem', marginBottom: '0.3rem', color: 'var(--text-main, #e5e2e1)' }}>
          <div>{renderedLine}</div>
        </div>
      );
    }
    if (!line.trim()) {
      return <div key={index} style={{ height: '0.35rem' }} />;
    }
    return <p key={index} style={{ marginBottom: '0.4rem', lineHeight: '1.5', color: 'var(--text-main, #e5e2e1)' }}>{renderedLine}</p>;
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
  
  // Initial empty new session always created on page entry
  const [initialSession] = useState<ChatSession>(createDefaultSession);
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    const stored = loadSessionsFromStorage(user?.user_id);
    return [initialSession, ...stored];
  });
  // ALWAYS default to the clean empty session on entering the page
  const [activeSessionId, setActiveSessionId] = useState<string>(initialSession.id);
  const [inputVal, setInputVal] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Fetch live chat sessions from MongoDB backend on mount & user change
  useEffect(() => {
    let mounted = true;
    if (user?.user_id) {
      getAgentSessionsApi()
        .then((mongoSessions) => {
          if (mounted && Array.isArray(mongoSessions)) {
            const healed = mongoSessions.map(s => healSession(s));
            setSessions(prev => {
              const currentActive = prev.find(s => s.id === activeSessionId) || initialSession;
              const remoteOthers = healed.filter(s => s.id !== currentActive.id);
              return [currentActive, ...remoteOthers];
            });
            // Intentionally DO NOT overwrite activeSessionId with mongoSessions[0].id
            // This ensures every page load opens a clean, empty new chat!
          }
        })
        .catch(() => {
          // Keep existing local sessions
        });
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

  const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0] || initialSession;
  const activeMessages = activeSession ? activeSession.messages : [];

  // Filter history to ONLY show sessions where user-AI exchanges have occurred
  const historySessions = sessions.filter(s => s.messages && s.messages.some(m => m.sender === 'user'));

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

    const nowIso = new Date().toISOString();
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: cleanText,
      timestamp: nowIso
    };

    setSessions(prev => prev.map(s => {
      if (s.id === activeSessionId) {
        const isGenericTitle = s.title === 'New Chat' || s.title === 'Active Intelligence Workspace' || s.title === 'New Intelligence Chat';
        const newTitle = isGenericTitle ? (cleanText.length > 32 ? cleanText.slice(0, 32) + '...' : cleanText) : s.title;
        const updated = {
          ...s,
          title: newTitle,
          // Update timestamp to real current ISO time
          timestamp: nowIso,
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
      <div className={`copilot-workspace ${sidebarOpen ? 'sidebar-expanded' : 'sidebar-collapsed'}`} style={{ marginTop: '0.5rem' }}>
        
        {/* SIDEBAR: NEW CHAT & CLICKABLE SCROLLABLE CHAT HISTORY */}
        {sidebarOpen && (
        <div className="copilot-sidebar glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0 }}>
          
          {/* Sidebar header with collapse button */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--primary-lilac-glow, #cebdff)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Workspace</span>
            <button
              onClick={() => setSidebarOpen(false)}
              title="Collapse panel"
              style={{ background: 'transparent', border: 'none', color: 'var(--text-dim, #64748b)', cursor: 'pointer', fontSize: '0.85rem', padding: '2px 4px', borderRadius: '4px' }}
            >
              <i className="fa-solid fa-angles-left"></i>
            </button>
          </div>

          {/* Single Primary Action Button */}
          <button 
            className="action-btn-primary" 
            onClick={handleCreateNewChat}
            style={{ width: '100%', justifyContent: 'center', gap: '8px', padding: '10px', borderRadius: '10px', fontSize: '0.88rem', fontWeight: 700 }}
          >
            <i className="fa-solid fa-plus"></i>
            New Chat Session
          </button>

          {/* Clickable Scrollable Chat History - ONLY SHOW SESSIONS WITH EXCHANGES */}
          <div>
            <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary-lilac-glow, #cebdff)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="fa-solid fa-clock-rotate-left" style={{ color: '#00d4ff' }}></i> Chat History ({historySessions.length})
            </h3>
            <div className="copilot-sidebar-scroll">
              {historySessions.length === 0 ? (
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted, #9ca3af)', fontStyle: 'italic', padding: '6px 4px' }}>
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
                        background: isActive ? 'rgba(0, 212, 255, 0.12)' : 'var(--glass-bg, rgba(255, 255, 255, 0.03))',
                        border: isActive ? '1px solid rgba(0, 212, 255, 0.35)' : '1px solid var(--glass-border, rgba(255, 255, 255, 0.06))',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden', flex: 1 }}>
                        <i className="fa-solid fa-comments" style={{ color: isActive ? '#00d4ff' : 'var(--text-muted)', fontSize: '0.9rem', flexShrink: 0 }}></i>
                        <div style={{ overflow: 'hidden' }}>
                          <div style={{ color: isActive ? '#00d4ff' : 'var(--text-main)', fontSize: '0.85rem', fontWeight: isActive ? 700 : 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {s.title}
                          </div>
                          <div style={{ color: 'var(--text-dim)', fontSize: '0.72rem', marginTop: '2px' }}>
                            {formatRelativeTime(s.timestamp, { fallbackId: s.id, fallbackItems: s.messages })}
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
        </div>
        )}

        {/* MAIN CHAT CONTAINER */}
        <div className="copilot-chat-container glass-card">
          <div className="chat-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              
              {/* Workspace Action Icons when sidebar is collapsed */}
              {!sidebarOpen && (
                <div className="workspace-collapsed-icons">
                  <button
                    onClick={() => setSidebarOpen(true)}
                    title="Expand Workspace Panel"
                    className="workspace-collapsed-btn primary"
                  >
                    <i className="fa-solid fa-angles-right"></i>
                  </button>
                  <button
                    onClick={handleCreateNewChat}
                    title="New Chat Session"
                    className="workspace-collapsed-btn"
                  >
                    <i className="fa-solid fa-plus"></i>
                  </button>
                  <button
                    onClick={() => setSidebarOpen(true)}
                    title={`Chat History (${historySessions.length})`}
                    className="workspace-collapsed-btn"
                  >
                    <i className="fa-solid fa-clock-rotate-left"></i>
                  </button>
                  <div className="workspace-header-divider" />
                </div>
              )}

              <div>
                <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main, #ffffff)', fontFamily: 'Plus Jakarta Sans' }}>
                  {activeSession ? activeSession.title : 'New Chat'}
                </h4>
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
                  <p style={{ marginBottom: '0.4rem', lineHeight: '1.5', color: 'var(--text-main, #e5e2e1)' }}>
                    Greetings! I am Axis, your business financial intelligence assistant. How can I assist your strategy today?
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
                    {msg.timestamp && (
                      <div style={{ display: 'flex', justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start', marginTop: '6px' }}>
                        <span style={{ fontSize: '0.66rem', color: 'var(--text-dim, rgba(255, 255, 255, 0.4))', fontFamily: 'JetBrains Mono' }}>
                          {formatMessageTime(msg.timestamp)}
                        </span>
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
                    <span>Thinking<span className="thinking-dots"></span></span>
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
