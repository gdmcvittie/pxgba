import { useState } from 'react';
import { usePxShop } from '../context/PxShopContext';
import { BsClockHistory, BsChevronDown, BsChevronRight, BsTrash } from 'react-icons/bs';

const HistoryPanel = ({ isCollapsed, onToggle, dragProps }) => {
  const {
    history,
    historyIndex,
    jumpToHistory,
    setHistory,
    setHistoryIndex,
    clearHistory
  } = usePxShop();

  const handleClearHistory = (e) => {
    if (isCollapsed) {
      onToggle();
    }
    e.stopPropagation();
    if (clearHistory) {
      clearHistory();
    } else if (setHistory && setHistoryIndex) {
      setHistory([history[historyIndex]]);
      setHistoryIndex(0);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: isCollapsed ? 'none' : 1, minHeight: 0, borderTop: '2px solid #222', background: isCollapsed ? 'transparent' : '#3d3d3d' }}>
      <div 
        onClick={onToggle}
        style={{ padding: '10px 15px', fontWeight: 'bold', borderBottom: isCollapsed ? 'none' : '1px solid #3c3c3c', background: '#2d2d2d', textAlign: 'left', fontSize: '11px', textTransform: 'uppercase', color: isCollapsed ? '#aaa' : '#4CAF50', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'grab', userSelect: 'none' }}
        {...dragProps}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BsClockHistory /> HISTORY
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {history.length > 1 && (
            <button 
              onClick={handleClearHistory} 
              title="Clear History" 
              style={{ background: 'none', border: 'none', color: '#ff4444', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', opacity: 0.8 }}
            ><BsTrash size={14} /></button>
          )}
          {isCollapsed ? <BsChevronRight style={{ color: '#aaa' }} /> : <BsChevronDown style={{ color: '#aaa' }} />}
        </div>
      </div>
      {!isCollapsed && (
        <div style={{ flex: 1, overflowY: 'auto', background: '#222' }}>
          {[...history].reverse().map((step, revIndex) => {
            const originalIndex = history.length - 1 - revIndex;
            const isActive = originalIndex === historyIndex;
            const isFuture = originalIndex > historyIndex;
            return (
              <div
                key={step.timestamp + '-' + revIndex}
                onClick={() => jumpToHistory(originalIndex)}
                style={{
                  padding: '8px 12px',
                  fontSize: '12px',
                  borderBottom: '1px solid #333',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  background: isActive ? '#3a3a3a' : 'transparent',
                  color: isActive ? '#4CAF50' : isFuture ? '#666' : '#ccc',
                  borderLeft: isActive ? '3px solid #4CAF50' : '3px solid transparent'
                }}
              >
                <span>{step.label}</span>
                <span style={{ opacity: 0.4, fontSize: '10px' }}>
                  {new Date(step.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default HistoryPanel;
