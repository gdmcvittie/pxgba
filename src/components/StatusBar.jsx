import { useState, useEffect } from 'react';
import { usePxShop } from '../context/PxShopContext';
import { BsDownload, BsExclamationTriangleFill } from 'react-icons/bs';
import { checkForUpdates } from '../utils/updater';

const formatBytes = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const formatTimeSince = (timestamp, now) => {
  if (!timestamp) return 'Never';
  const seconds = Math.floor((now - timestamp) / 1000);
  if (seconds < 5) return 'Just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m ago`;
};

const StatusBar = () => {
  const { estimatedRomSize, lastSavedTime, setSaveWarningShown, exportProjectJSON } = usePxShop();
  const [now, setNow] = useState(Date.now());
  const [updateStatus, setUpdateStatus] = useState('idle');
  const [updateMessage, setUpdateMessage] = useState('');

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (updateStatus === 'up-to-date' || updateStatus === 'error') {
      const timer = setTimeout(() => {
        setUpdateStatus('idle');
        setUpdateMessage('');
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [updateStatus]);

  const handleUpdate = () => {
    if (updateStatus === 'ready') {
      window.location.reload();
      return;
    }
    setUpdateStatus('checking');
    checkForUpdates((status, message) => {
      setUpdateStatus(status);
      if (message) setUpdateMessage(message);
    });
  };

  if (!estimatedRomSize) return null;

  const { bytes, maxBytes, percent } = estimatedRomSize;

  let barColor = '#4CAF50';
  if (percent > 80) barColor = '#ff9800';
  if (percent > 95) barColor = '#f44336';

  const elapsed = lastSavedTime ? now - lastSavedTime : Infinity;
  const isOverdue = elapsed > 5 * 60 * 1000;
  const timeText = formatTimeSince(lastSavedTime, now);

  let saveColor = '#888';
  if (isOverdue) saveColor = '#ff9800';

  return (
    <div style={{
      height: '24px',
      backgroundColor: '#252525',
      borderTop: '1px solid #3c3c3c',
      display: 'flex',
      alignItems: 'center',
      padding: '0 12px',
      gap: '10px',
      fontSize: '11px',
      color: '#aaa',
      userSelect: 'none',
      flexShrink: 0,
    }}>
      <span style={{ color: '#888', whiteSpace: 'nowrap' }}>ROM SIZE</span>
      <div style={{
        flex: 1,
        maxWidth: '200px',
        height: '10px',
        backgroundColor: '#1e1e1e',
        borderRadius: '5px',
        overflow: 'hidden',
        border: '1px solid #3c3c3c',
      }}>
        <div style={{
          width: `${Math.max(0.5, percent)}%`,
          height: '100%',
          backgroundColor: barColor,
          borderRadius: '5px',
          transition: 'width 0.3s ease, background-color 0.3s ease',
        }} />
      </div>
      <span style={{ whiteSpace: 'nowrap', color: '#ccc', minWidth: '100px' }}>
        {formatBytes(bytes)} / {formatBytes(maxBytes)}
      </span>
      <span style={{
        whiteSpace: 'nowrap',
        color: barColor,
        fontWeight: 'bold',
        minWidth: '40px',
        textAlign: 'right',
      }}>
        {percent.toFixed(1)}%
      </span>

      <div style={{ flex: 1 }} />


      <button
        onClick={handleUpdate}
        disabled={updateStatus === 'checking' || updateStatus === 'downloading'}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          background: 'transparent',
          border: 'none',
          color: updateStatus === 'ready' ? '#4CAF50' : updateStatus === 'error' ? '#f44336' : '#0084ffff',
          cursor: updateStatus === 'checking' || updateStatus === 'downloading' ? 'default' : 'pointer',
          padding: '0 4px',
          fontSize: '11px',
          opacity: updateStatus === 'checking' || updateStatus === 'downloading' ? 0.6 : 1,
        }}
        title={updateStatus === 'ready' ? 'Restart the app to apply the update' : 'Check for Updates'}
      >
        {updateStatus === 'ready' ? null : <BsDownload size={12} />}
        <span>
          {updateStatus === 'idle' && 'Check for Updates'}
          {updateStatus === 'checking' && 'Checking...'}
          {updateStatus === 'downloading' && 'Downloading...'}
          {updateStatus === 'up-to-date' && 'Up to date'}
          {updateStatus === 'ready' && 'Restart to Update'}
          {updateStatus === 'error' && (updateMessage || 'Update failed')}
        </span>
      </button>

      <div style={{ flex: 1 }} />

      {isOverdue && (
        <button
          onClick={() => { exportProjectJSON(); setSaveWarningShown(false); }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            background: 'transparent',
            border: 'none',
            color: '#ff9800',
            cursor: 'pointer',
            padding: '0 4px',
            fontSize: '11px',
          }}
          title="You haven't saved in over 5 minutes"
        >
          <BsExclamationTriangleFill size={12} />
          <span>Save your work!</span>
        </button>
      )}

      <span style={{ whiteSpace: 'nowrap', color: saveColor }}>
        Saved: {timeText}
      </span>
    </div>
  );
};

export default StatusBar;
