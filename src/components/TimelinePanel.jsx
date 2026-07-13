import { useState, useEffect, useRef } from 'react';
import { usePxShop } from '../context/PxShopContext';
import { BsPlus, BsFiles, BsTrash, BsPlayFill, BsPauseFill, BsFilm, BsChevronDown, BsChevronUp } from 'react-icons/bs';

const ThumbnailCanvas = ({ frame }) => {
  const canvasRef = useRef(null);
  const { dimensions, renderLayersToCtx } = usePxShop();

  useEffect(() => {
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      const scale = Math.min(56 / dimensions.w, 56 / dimensions.h);
      ctx.clearRect(0, 0, 56, 56);
      
      ctx.save();
      const offsetX = (56 - (dimensions.w * scale)) / 2;
      const offsetY = (56 - (dimensions.h * scale)) / 2;
      ctx.translate(offsetX, offsetY);
      
      renderLayersToCtx(ctx, scale, frame.layers);
      
      ctx.restore();
    }
  }, [frame.layers, dimensions, renderLayersToCtx]);

  return <canvas ref={canvasRef} width={56} height={56} style={{ position: 'absolute', top: 2, left: 2, borderRadius: '2px', pointerEvents: 'none', zIndex: 1, imageRendering: 'pixelated' }} />;
};

const TimelinePanel = () => {
  const {
    frames,
    activeFrameId,
    switchFrame,
    addFrame,
    deleteFrame,
    duplicateFrame,
    onionSkinEnabled, setOnionSkinEnabled
  } = usePxShop();

  const [isPlaying, setIsPlaying] = useState(false);
  const [fps, setFps] = useState(8);
  const [hoveredFrameId, setHoveredFrameId] = useState(null);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('px_shop_timeline_collapsed');
    return saved !== null ? saved === 'true' : true;
  });

  useEffect(() => {
    localStorage.setItem('px_shop_timeline_collapsed', isCollapsed);
  }, [isCollapsed]);

  useEffect(() => {
    let timeout;
    if (isPlaying && frames.length > 1) {
      timeout = setTimeout(() => {
        const currentIdx = frames.findIndex(f => f.id === activeFrameId);
        const nextIdx = (currentIdx + 1) % frames.length;
        switchFrame(frames[nextIdx].id, true);
      }, 1000 / fps);
    } else if (isPlaying && frames.length <= 1) {
      setIsPlaying(false);
    }
    return () => clearTimeout(timeout);
  }, [isPlaying, frames, activeFrameId, fps, switchFrame]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', backgroundColor: '#2d2d2d', borderTop: '2px solid #222', flexShrink: 0, zIndex: 10 }}>
      <div 
        onClick={() => setIsCollapsed(!isCollapsed)}
        style={{ padding: '8px 15px', borderBottom: isCollapsed ? 'none' : '1px solid #3c3c3c', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none', background: '#252528' }}
      >
        <span style={{ fontWeight: 'bold', fontSize: '11px', textTransform: 'uppercase', color: '#aaa', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BsFilm /> Animation Timeline
        </span>
        <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
          {isCollapsed ? <BsChevronUp style={{ color: '#aaa' }} /> : <BsChevronDown style={{ color: '#aaa' }} />}
        </div>
      </div>

      {!isCollapsed && (
        <div style={{ height: '100px', display: 'flex', alignItems: 'center', padding: '0 10px', gap: '10px', overflowX: 'auto', flexShrink: 0 }}>
          {/* Playback Controls */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0px', paddingRight: '10px', borderRight: '1px solid #444', marginRight: '5px' }}>
            <button 
              onClick={() => setIsPlaying(!isPlaying)}
              style={{ background: isPlaying ? '#ff9800' : '#4CAF50', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', gap: '4px' }}
            >
              {isPlaying ? <><BsPauseFill size={16} /> Pause</> : <><BsPlayFill size={16} /> Play</>}
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
              <span style={{ fontSize: '10px', color: '#aaa' }}>FPS:</span>
              <input 
                type="number" 
                min="1" max="60" 
                value={fps} 
                onChange={e => setFps(parseInt(e.target.value) || 12)}
                style={{ width: '40px', background: '#111', color: '#fff', border: '1px solid #444', padding: '2px 4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }}
              />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#ccc', fontSize: '10px', cursor: 'pointer', marginTop: '4px' }}>
              <input type="checkbox" checked={onionSkinEnabled} onChange={e => setOnionSkinEnabled(e.target.checked)} />
              Onion Skin
            </label>
          </div>

          {frames.map((frame, idx) => (
            <div 
              key={frame.id}
              onMouseEnter={() => setHoveredFrameId(frame.id)}
              onMouseLeave={() => setHoveredFrameId(null)}
              onClick={() => switchFrame(frame.id)}
              style={{ 
                minWidth: '60px', 
                height: '60px', 
                backgroundColor: activeFrameId === frame.id ? '#4CAF50' : '#1e1e1e', 
                border: activeFrameId === frame.id ? '2px solid #fff' : '2px solid transparent', 
                borderRadius: '4px', 
                display: 'flex', 
                flexDirection: 'column',
                alignItems: 'center', 
                justifyContent: 'center',
                cursor: 'pointer',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              <ThumbnailCanvas frame={frame} />
              
              <span style={{ position: 'absolute', top: 2, left: 4, fontSize: '10px', fontWeight: 'bold', color: '#fff', zIndex: 2, textShadow: '0 1px 2px #000' }}>{idx + 1}</span>
              
              {hoveredFrameId === frame.id && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', zIndex: 5 }}>
                  <button onClick={(e) => { e.stopPropagation(); duplicateFrame(frame.id); }} style={{ background: 'transparent', border: '1px solid #4CAF50', color: '#4CAF50', cursor: 'pointer', padding: '6px', borderRadius: '4px', display: 'flex', alignItems: 'center' }} title="Duplicate" onMouseEnter={e => { e.target.style.background = '#4CAF50'; e.target.style.color = '#fff'; }} onMouseLeave={e => { e.target.style.background = 'transparent'; e.target.style.color = '#4CAF50'; }}><BsFiles size={12} /></button>
                  {frames.length > 1 && (
                    <button onClick={(e) => { e.stopPropagation(); deleteFrame(frame.id); }} style={{ background: 'transparent', border: '1px solid #ff4444', color: '#ff4444', cursor: 'pointer', padding: '6px', borderRadius: '4px', display: 'flex', alignItems: 'center' }} title="Delete" onMouseEnter={e => { e.target.style.background = '#ff4444'; e.target.style.color = '#fff'; }} onMouseLeave={e => { e.target.style.background = 'transparent'; e.target.style.color = '#ff4444'; }}><BsTrash size={12} /></button>
                  )}
                </div>
              )}
            </div>
          ))}
          <button 
            onClick={addFrame}
            style={{ minWidth: '60px', height: '60px', backgroundColor: '#1e1e1e', border: '2px dashed #4CAF50', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#4CAF50' }}
            title="Add Frame"
          >
            <BsPlus size={24} />
          </button>
        </div>
      )}
    </div>
  );
};

export default TimelinePanel;