import { useState } from 'react';
import { usePxShop } from '../context/PxShopContext';
import { BsType, BsTextLeft, BsTextCenter, BsTextRight, BsChevronDown, BsChevronRight } from 'react-icons/bs';
import PaletteColorPicker from './PaletteColorPicker';

const TextSettings = ({ isCollapsed, onToggle }) => {
  const {
    textSettings, setTextSettings,
    tool, setTool,
    editingTextLayerId, setEditingTextLayerId,
    currentColor, setCurrentColor,
    recentColors, setRecentColors,
    renderText
  } = usePxShop();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', borderBottom: '2px solid #222', background: isCollapsed ? 'transparent' : '#3d3d3d' }}>
      <div 
        onClick={onToggle}
        style={{ padding: '15px', borderBottom: isCollapsed ? 'none' : '1px solid #3c3c3c', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}
      >
        <span style={{ fontWeight: 'bold', fontSize: '11px', textTransform: 'uppercase', color: isCollapsed ? '#aaa' : '#4CAF50', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BsType /> Text Settings
        </span>
        <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
          {isCollapsed ? <BsChevronRight style={{ color: '#aaa' }} /> : <BsChevronDown style={{ color: '#aaa' }} />}
        </div>
      </div>
      {!isCollapsed && (
        <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', background: '#111', borderRadius: '3px', border: '1px solid #444', overflow: 'hidden' }}>
              <button title="Align Left" onClick={() => setTextSettings(prev => ({...prev, align: 'left'}))} style={{ background: (!textSettings.align || textSettings.align === 'left') ? '#4CAF50' : 'transparent', color: '#fff', border: 'none', padding: '6px 8px', outline: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><BsTextLeft size={12} /></button>
              <button title="Align Center" onClick={() => setTextSettings(prev => ({...prev, align: 'center'}))} style={{ background: textSettings.align === 'center' ? '#4CAF50' : 'transparent', color: '#fff', border: 'none', borderLeft: '1px solid #444', borderRight: '1px solid #444', padding: '6px 8px', outline: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><BsTextCenter size={12} /></button>
              <button title="Align Right" onClick={() => setTextSettings(prev => ({...prev, align: 'right'}))} style={{ background: textSettings.align === 'right' ? '#4CAF50' : 'transparent', color: '#fff', border: 'none', padding: '6px 8px', outline: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><BsTextRight size={12} /></button>
            </div>
            <button title="Bold" onClick={() => setTextSettings(prev => ({...prev, bold: !prev.bold}))} style={{ background: textSettings.bold ? '#4CAF50' : '#111', color: '#fff', border: '1px solid #444', padding: '6px 8px', borderRadius: '3px', outline: 'none', cursor: 'pointer', fontWeight: 'bold' }}>B</button>
            <button title="Italic" onClick={() => setTextSettings(prev => ({...prev, italic: !prev.italic}))} style={{ background: textSettings.italic ? '#4CAF50' : '#111', color: '#fff', border: '1px solid #444', padding: '6px 8px', borderRadius: '3px', outline: 'none', cursor: 'pointer', fontStyle: 'italic', fontFamily: 'serif' }}>I</button>
            <input type="number" min="4" value={textSettings.size} onChange={(e) => setTextSettings({ ...textSettings, size: parseInt(e.target.value) || 12 })} style={{ width: '40px', background: '#111', color: '#fff', border: '1px solid #444', padding: '6px 4px', outline: 'none', borderRadius: '3px', fontSize: '11px' }} />
          </div>
          <PaletteColorPicker
            selectedColor={currentColor}
            onChange={setCurrentColor}
            recentColors={recentColors}
            label="Text Color"
            allowTransparent={false}
          />
          <select value={textSettings.font} onChange={(e) => setTextSettings({ ...textSettings, font: e.target.value })} style={{ background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', flexGrow: 1, minWidth: '100px', outline: 'none', borderRadius: '3px', fontSize: '11px', width: '100%' }}>
            <optgroup label="Popular Google Fonts">
              <option value="'Roboto', sans-serif">Roboto</option>
              <option value="'Open Sans', sans-serif">Open Sans</option>
              <option value="'Lato', sans-serif">Lato</option>
              <option value="'Montserrat', sans-serif">Montserrat</option>
              <option value="'Oswald', sans-serif">Oswald</option>
              <option value="'Source Code Pro', monospace">Source Code Pro</option>
              <option value="'Playfair Display', serif">Playfair Display</option>
            </optgroup>
            <optgroup label="Pixel & Retro">
              <option value="'Press Start 2P', system-ui">Press Start 2P</option>
              <option value="'VT323', monospace">VT323 (Terminal)</option>
              <option value="'Silkscreen', sans-serif">Silkscreen</option>
              <option value="'Pixelify Sans', sans-serif">Pixelify Sans</option>
              <option value="'Jersey 10', sans-serif">Jersey 10</option>
              <option value="'DotGothic16', sans-serif">DotGothic16</option>
            </optgroup>
            <optgroup label="Other Cool Fonts">
              <option value="'Bungee', display">Bungee (Chunky)</option>
              <option value="'Righteous', display">Righteous (Sci-Fi)</option>
              <option value="'Rubik Glitch', display">Rubik Glitch (Cyberpunk)</option>
              <option value="'Black Ops One', display">Black Ops One (Stencil)</option>
              <option value="'Permanent Marker', cursive">Permanent Marker</option>
              <option value="'Creepster', display">Creepster (Spooky)</option>
              <option value="'Nosifer', display">Nosifer (Swampy/Dripping)</option>
            </optgroup>
            <optgroup label="Standard">
              <option value="monospace">Monospace</option>
              <option value="sans-serif">Sans-Serif</option>
              <option value="serif">Serif</option>
              <option value="Impact">Impact</option>
            </optgroup>
            <option value="custom">Custom Google Font...</option>
          </select>
          
          {textSettings.font === 'custom' && (
            <input 
              type="text" 
              placeholder="Google Font name..." 
              value={textSettings.customFont}
              onChange={(e) => setTextSettings({ ...textSettings, customFont: e.target.value })}
              style={{ background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', outline: 'none', fontSize: '11px', borderRadius: '3px', width: '100%' }}
            />
          )}
          
          {textSettings.customFont && textSettings.font !== 'custom' && (
            <optgroup label="Loaded Font">
              <option value={textSettings.customFont}>{textSettings.customFont}</option>
            </optgroup>
          )}

          <input
            type="text"
            value={textSettings.text}
            onChange={(e) => {
              setTextSettings(prev => ({ ...prev, text: e.target.value }));
              if (tool !== 'text') setTool('text');
            }}
            placeholder="Enter text..."
            style={{ background: '#111', color: '#fff', border: '1px solid #444', padding: '6px', outline: 'none', borderRadius: '3px', fontSize: '12px' }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && textSettings.text) {
                renderText(textSettings, editingTextLayerId);
                setEditingTextLayerId(null);
                setTextSettings(prev => ({ ...prev, text: "" }));
              }
              if (e.key === 'Escape') {
                setEditingTextLayerId(null);
                setTextSettings(prev => ({ ...prev, text: "" }));
              }
            }}
          />

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#ccc', fontSize: '11px', cursor: 'pointer' }}>
              <input type="checkbox" checked={!!textSettings.outline} onChange={e => setTextSettings(prev => ({...prev, outline: e.target.checked}))} />
              Text Outline
            </label>
            {textSettings.outline && (
              <PaletteColorPicker
                selectedColor={textSettings.outlineColor || '#000000'}
                onChange={(c) => setTextSettings(prev => ({...prev, outlineColor: c}))}
                recentColors={recentColors}
                label="Outline Color"
                allowTransparent={false}
              />
            )}
          </div>
          <button disabled={!textSettings.text} onClick={() => { renderText(textSettings, editingTextLayerId); setEditingTextLayerId(null); setTextSettings(prev => ({ ...prev, text: "" })); }} style={{ padding: '6px', background: '#4CAF50', color: '#fff', border: 'none', borderRadius: '3px', cursor: textSettings.text ? 'pointer' : 'default', opacity: textSettings.text ? 1 : 0.5, fontSize: '11px', fontWeight: 'bold' }}>{editingTextLayerId ? 'Update Text' : 'Draw Text'}</button>
        </div>
      )}
    </div>
  );
};

export default TextSettings;
