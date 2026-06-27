import { useState, useRef, useEffect } from 'react';
import { usePxShop } from '../context/PxShopContext';
import { BsPalette, BsPen, BsPlus, BsChevronDown, BsChevronRight } from 'react-icons/bs';

const Palette = ({ isCollapsed, onToggle }) => {
  const {
    currentColor, setCurrentColor,
    secondaryColor, setSecondaryColor,
    recentColors, setRecentColors,
    drawWidth, setDrawWidth,
    brushOpacity, setBrushOpacity,
    brushType, setBrushType,
    colorJitter, setColorJitter,
    tool,
    paletteInputRef
  } = usePxShop();

  const addColorRef = useRef(null);

  useEffect(() => {
    const input = addColorRef.current;
    if (!input) return;
    const handler = () => {
      const color = input.value;
      if (color && !recentColors.includes(color)) {
        setRecentColors([...recentColors, color]);
      }
    };
    input.addEventListener('change', handler);
    return () => input.removeEventListener('change', handler);
  }, [recentColors]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', borderBottom: '2px solid #222', background: isCollapsed ? 'transparent' : '#3d3d3d' }}>
      <div 
        onClick={onToggle}
        style={{ padding: '15px', borderBottom: isCollapsed ? 'none' : '1px solid #3c3c3c', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}
      >
        <span style={{ fontWeight: 'bold', fontSize: '11px', textTransform: 'uppercase', color: isCollapsed ? '#aaa' : '#4CAF50', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BsPalette /> Palette
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={e => { if (isCollapsed) { onToggle(); } e.stopPropagation(); }}>
          <button
            onClick={() => paletteInputRef.current?.click()}
            title="Import Palette" 
            style={{ backgroundColor: '#4CAF50', border: 'none', color: '#fff', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
          >
            <BsPlus />
          </button>
          <div onClick={e => { e.stopPropagation(); onToggle(); }} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            {isCollapsed ? <BsChevronRight style={{ color: '#aaa' }} /> : <BsChevronDown style={{ color: '#aaa' }} />}
          </div>
        </div>
      </div>
      {!isCollapsed && (
        <>
          <div style={{ padding: '10px', display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '200px', overflowY: 'auto', paddingRight: '2px' }}>
            {recentColors.map(c => (
              <div key={c} onClick={() => setCurrentColor(c)} onContextMenu={(e) => { e.preventDefault(); setSecondaryColor(c); }} style={{ width: '22px', height: '22px', backgroundColor: c, cursor: 'pointer', border: currentColor === c ? '2px solid #fff' : secondaryColor === c ? '1px solid #000' : '1px solid #000', borderRadius: '2px', flexShrink: 0 }} title={c} />
            ))}
            {recentColors.length <= 255 && (
              <>
                <div onClick={() => addColorRef.current?.click()} style={{ width: '22px', height: '22px', cursor: 'pointer', border: '1px dashed #666', borderRadius: '2px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', color: '#888', background: '#2a2a2a', userSelect: 'none' }} title="Add Color">+</div>
                <input ref={addColorRef} type="color" style={{ position: 'absolute', width: 0, height: 0, padding: 0, border: 'none', opacity: 0, pointerEvents: 'none' }} />
              </>
            )}
          </div>
          <div style={{ padding: '15px', borderBottom: '1px solid #3c3c3c', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 'bold', fontSize: '11px', textTransform: 'uppercase', color: '#aaa', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BsPen /> SIZE & BRUSH
            </span>
          </div>
          <div style={{ padding: '10px', paddingTop: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '11px', color: '#888', width: '35px' }}>Size</span>
              <input type="range" min="1" max="32" value={drawWidth} onChange={(e) => setDrawWidth(parseInt(e.target.value))} style={{ flex: 1 }} />
              <span style={{ fontSize: '11px', width: '20px', textAlign: 'right' }}>{drawWidth}</span>
            </div>
            {['pen', 'brush', 'drawRect', 'drawRectFill', 'drawRoundRect', 'drawRoundRectFill', 'drawCircle', 'drawCircleFill', 'drawLine', 'gradient'].includes(tool) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '11px', color: '#888', width: '35px' }}>Opacity</span>
                <input type="range" min="1" max="100" value={brushOpacity} onChange={(e) => setBrushOpacity(parseInt(e.target.value))} style={{ flex: 1 }} />
                <span style={{ fontSize: '11px', width: '20px', textAlign: 'right' }}>{brushOpacity}%</span>
              </div>
            )}
            {tool === 'brush' && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '11px', color: '#888', width: '35px' }}>Type</span>
                  <select value={brushType} onChange={e => setBrushType(e.target.value)} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #444', outline: 'none', padding: '2px 4px', fontSize: '11px', borderRadius: '3px' }}>
                    <option value="round">Hard Round</option>
                    <option value="square">Square Block</option>
                    <option value="calligraphy">Calligraphy</option>
                    <option value="dither">Dither Pattern</option>
                    <option value="spray">Spray / Noise</option>
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '11px', color: '#888', width: '35px' }}>Jitter</span>
                  <input type="range" min="0" max="100" value={colorJitter} onChange={(e) => setColorJitter(parseInt(e.target.value))} style={{ flex: 1 }} />
                  <span style={{ fontSize: '11px', width: '20px', textAlign: 'right' }}>{colorJitter}</span>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default Palette;
