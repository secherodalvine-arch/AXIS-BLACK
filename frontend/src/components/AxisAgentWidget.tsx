import React, { useState } from 'react';
import { AIStreamItem } from '../types';

interface AxisAgentWidgetProps {
  streamItems: AIStreamItem[];
  onActionClick: (title: string) => void;
  onQuickSubmit: (query: string) => void;
}

export const AxisAgentWidget: React.FC<AxisAgentWidgetProps> = ({
  streamItems,
  onActionClick,
  onQuickSubmit
}) => {
  const [inputVal, setInputVal] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim()) return;
    onQuickSubmit(inputVal);
    setInputVal('');
  };

  return (
    <div className="glass-card ai-insights-card">
      <div className="card-header">
        <div className="card-title-group">
          <h3><i className="fa-solid fa-brain accent-icon-cyan"></i> Axis Agent Stream</h3>
          <p className="subtitle">Live SME Intelligence & Business Telemetry Stream</p>
        </div>
        <span className="pulse-badge"><span className="pulse-dot"></span> Active</span>
      </div>

      <div className="ai-stream-list">
        {streamItems.map(item => (
          <div key={item.id} className={`ai-stream-item ${item.isHighlight ? 'highlight' : ''}`}>
            <div className="stream-icon"><i className="fa-solid fa-chart-line"></i></div>
            <div className="stream-content">
              <span className="stream-time">{item.time}</span>
              <h5>{item.title}</h5>
              <p>{item.content}</p>
              {item.tags && (
                <div className="stream-tags">
                  {item.tags.map((t, idx) => (
                    <span key={idx} className={`tag tag-${t.type}`}>{t.text}</span>
                  ))}
                </div>
              )}
              {item.actionLabel && (
                <button 
                  className="btn-text-action"
                  onClick={() => onActionClick(item.actionLabel!)}
                >
                  {item.actionLabel} <i className="fa-solid fa-arrow-right"></i>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="card-footer-ai">
        <form onSubmit={handleSubmit} className="ai-input-wrapper">
          <input 
            type="text" 
            placeholder="Ask Axis Agent a business query..."
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
          />
          <button type="submit" className="ai-send-btn" title="Send Message">
            <i className="fa-solid fa-arrow-up"></i>
          </button>
        </form>
      </div>
    </div>
  );
};
