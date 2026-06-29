import { usePxShop } from '../context/PxShopContext';

const formatBytes = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const StatusBar = () => {
  const { estimatedRomSize } = usePxShop();

  if (!estimatedRomSize) return null;

  const { bytes, maxBytes, percent } = estimatedRomSize;

  let barColor = '#4CAF50';
  if (percent > 80) barColor = '#ff9800';
  if (percent > 95) barColor = '#f44336';

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
    </div>
  );
};

export default StatusBar;
