import { usePxShop } from '../context/PxShopContext';
import { BsTv, BsChevronDown, BsChevronRight, BsTextLeft, BsTextCenter, BsTextRight } from 'react-icons/bs';
import PaletteColorPicker from './PaletteColorPicker';
import { TileSelector } from './Dialogs';

const HUDPanel = ({ isCollapsed, onToggle, dragProps }) => {
  const {
    hudSettings, setHudSettings,
    saveHistory, layers, dimensions,
    recentColors, savedTiles
  } = usePxShop();

  const handleToggleField = (field, checked) => {
    const newSettings = { ...hudSettings, [field]: checked };
    setHudSettings(newSettings);
    saveHistory(`Toggle HUD ${field}`, layers, dimensions, { hudSettings: newSettings });
  };

  const handlePositionChange = (pos) => {
    const isVertical = pos === 'left' || pos === 'right';
    const defaultW = isVertical ? 2 : 30;
    const defaultH = isVertical ? 20 : 2;
    const newSettings = { ...hudSettings, position: pos, width: defaultW, height: defaultH };
    setHudSettings(newSettings);
    saveHistory("Update HUD Position", layers, dimensions, { hudSettings: newSettings });
  };

  const updateHUDField = (field, val) => {
    setHudSettings(prev => ({ ...prev, [field]: val }));
  };

  const commitHUDChanges = () => {
    saveHistory("Update HUD Dimensions/Colors", layers, dimensions, { hudSettings });
  };

  const handleAddItem = () => {
    const items = hudSettings.displayItems ? [...hudSettings.displayItems] : [];
    const newItem = {
      id: 'item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      tileId: null,
      text: 'x {PLAYER_HP}'
    };
    const newSettings = { ...hudSettings, displayItems: [...items, newItem] };
    setHudSettings(newSettings);
    saveHistory("Add HUD Display Item", layers, dimensions, { hudSettings: newSettings });
  };

  const handleRemoveItem = (id) => {
    const items = (hudSettings.displayItems || []).filter(item => item.id !== id);
    const newSettings = { ...hudSettings, displayItems: items };
    setHudSettings(newSettings);
    saveHistory("Remove HUD Display Item", layers, dimensions, { hudSettings: newSettings });
  };

  const handleUpdateItem = (id, field, val) => {
    const items = (hudSettings.displayItems || []).map(item => {
      if (item.id === id) {
        return { ...item, [field]: val };
      }
      return item;
    });
    setHudSettings(prev => ({ ...prev, displayItems: items }));
  };

  const handleMoveItem = (index, dir) => {
    const items = hudSettings.displayItems ? [...hudSettings.displayItems] : [];
    if (index + dir < 0 || index + dir >= items.length) return;
    const temp = items[index];
    items[index] = items[index + dir];
    items[index + dir] = temp;
    const newSettings = { ...hudSettings, displayItems: items };
    setHudSettings(newSettings);
    saveHistory("Reorder HUD Display Items", layers, dimensions, { hudSettings: newSettings });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', borderBottom: '2px solid #222', background: isCollapsed ? 'transparent' : '#334233' }}>
      <div 
        onClick={onToggle}
        style={{ padding: '15px', borderBottom: isCollapsed ? 'none' : '1px solid #3c3c3c', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'grab', userSelect: 'none', background: '#0e210e' }}
        {...dragProps}
      >
        <span style={{ fontWeight: 'bold', fontSize: '11px', textTransform: 'uppercase', color: isCollapsed ? '#aaa' : '#4CAF50', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BsTv /> HUD Settings
        </span>
        <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
          {isCollapsed ? <BsChevronRight style={{ color: '#aaa' }} /> : <BsChevronDown style={{ color: '#aaa' }} />}
        </div>
      </div>
      
      {!isCollapsed && (
        <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          
          {/* Enable/Disable checkbox */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#fff', fontSize: '12px', cursor: 'pointer', userSelect: 'none' }}>
            <input 
              type="checkbox" 
              checked={!!hudSettings.enabled} 
              onChange={(e) => handleToggleField('enabled', e.target.checked)} 
              style={{ cursor: 'pointer' }}
            />
            <span>Enable Game HUD</span>
          </label>

          {hudSettings.enabled && (
            <>
              {/* Position selector */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '10px', color: '#aaa', textTransform: 'uppercase', fontWeight: 'bold' }}>HUD Position</span>
                <div style={{ display: 'flex', background: '#111', borderRadius: '3px', border: '1px solid #444', overflow: 'hidden', height: '29px' }}>
                  {['top', 'bottom', 'left', 'right'].map(pos => (
                    <button
                      key={pos}
                      onClick={() => handlePositionChange(pos)}
                      style={{
                        background: (hudSettings.position || 'top') === pos ? '#4CAF50' : 'transparent',
                        color: '#fff', border: 'none', flex: 1, outline: 'none',
                        cursor: 'pointer', fontSize: '10px', fontWeight: 'bold',
                        textTransform: 'uppercase',
                        borderLeft: pos !== 'top' ? '1px solid #444' : 'none',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}
                    >
                      {pos}
                    </button>
                  ))}
                </div>
              </div>
              
              {(hudSettings.position === 'left' || hudSettings.position === 'right') && (
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#fff', fontSize: '11px', cursor: 'pointer', userSelect: 'none', marginTop: '2px' }}>
                  <input 
                    type="checkbox" 
                    checked={!!hudSettings.verticalText} 
                    onChange={(e) => handleToggleField('verticalText', e.target.checked)} 
                    style={{ cursor: 'pointer' }}
                  />
                  <span>Write Text Top-to-Bottom</span>
                </label>
              )}

              {/* Spacing & Alignment */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                  <span style={{ fontSize: '10px', color: '#aaa', textTransform: 'uppercase', fontWeight: 'bold' }}>Spacing</span>
                  <div style={{ display: 'flex', background: '#111', borderRadius: '3px', border: '1px solid #444', overflow: 'hidden', height: '29px' }}>
                    {[
                      { value: 'space-between', label: 'Spread' },
                      { value: 'packed', label: 'Packed' }
                    ].map(sp => (
                      <button
                        key={sp.value}
                        onClick={() => {
                          setHudSettings(prev => {
                            const s = { ...prev, spacing: sp.value };
                            saveHistory("Update HUD Spacing", layers, dimensions, { hudSettings: s });
                            return s;
                          });
                        }}
                        style={{
                          background: (hudSettings.spacing || 'space-between') === sp.value ? '#4CAF50' : 'transparent',
                          color: '#fff', border: 'none', flex: 1, outline: 'none',
                          cursor: 'pointer', fontSize: '10px', fontWeight: 'bold',
                          borderLeft: sp.value !== 'space-between' ? '1px solid #444' : 'none',
                          display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}
                      >
                        {sp.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                  <span style={{ fontSize: '10px', color: '#aaa', textTransform: 'uppercase', fontWeight: 'bold' }}>Alignment</span>
                  <div style={{ display: 'flex', background: '#111', borderRadius: '3px', border: '1px solid #444', overflow: 'hidden', height: '29px', opacity: (hudSettings.spacing || 'space-between') === 'space-between' ? 0.4 : 1 }}>
                    {[
                      { value: 'left', icon: BsTextLeft, title: 'Align Left' },
                      { value: 'center', icon: BsTextCenter, title: 'Align Center' },
                      { value: 'right', icon: BsTextRight, title: 'Align Right' }
                    ].map((al, idx) => {
                      const isSpread = (hudSettings.spacing || 'space-between') === 'space-between';
                      const Icon = al.icon;
                      return (
                        <button
                          key={al.value}
                          title={al.title}
                          onClick={() => {
                            if (isSpread) return;
                            setHudSettings(prev => {
                              const s = { ...prev, alignment: al.value };
                              saveHistory("Update HUD Alignment", layers, dimensions, { hudSettings: s });
                              return s;
                            });
                          }}
                          style={{
                            background: !isSpread && (hudSettings.alignment === al.value || (!hudSettings.alignment && al.value === 'left')) ? '#4CAF50' : 'transparent',
                            color: '#fff', border: 'none', flex: 1, outline: 'none',
                            cursor: isSpread ? 'default' : 'pointer',
                            borderLeft: idx > 0 ? '1px solid #444' : 'none',
                            borderRight: idx < 2 ? 'none' : 'none',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                          }}
                        >
                          <Icon size={14} />
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Dimensions */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                  <span style={{ fontSize: '10px', color: '#aaa', textTransform: 'uppercase', fontWeight: 'bold' }}>Width (tiles)</span>
                  <input 
                    type="number" 
                    min="1" 
                    max="32"
                    value={hudSettings.width ?? (hudSettings.position === 'left' || hudSettings.position === 'right' ? 2 : 30)}
                    onChange={(e) => updateHUDField('width', Math.max(1, Math.min(32, parseInt(e.target.value) || 0)))}
                    onBlur={commitHUDChanges}
                    style={{ background: '#111', color: '#fff', border: '1px solid #444', padding: '6px', fontSize: '11px', outline: 'none', borderRadius: '3px' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                  <span style={{ fontSize: '10px', color: '#aaa', textTransform: 'uppercase', fontWeight: 'bold' }}>Height (tiles)</span>
                  <input 
                    type="number" 
                    min="1" 
                    max="32"
                    value={hudSettings.height ?? (hudSettings.position === 'left' || hudSettings.position === 'right' ? 20 : 2)}
                    onChange={(e) => updateHUDField('height', Math.max(1, Math.min(32, parseInt(e.target.value) || 0)))}
                    onBlur={commitHUDChanges}
                    style={{ background: '#111', color: '#fff', border: '1px solid #444', padding: '6px', fontSize: '11px', outline: 'none', borderRadius: '3px'}}
                  />
                </div>
              </div>

              {/* Background Color Picker */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '10px', color: '#aaa', textTransform: 'uppercase', fontWeight: 'bold' }}>Background Color</span>
                <PaletteColorPicker
                  selectedColor={hudSettings.backgroundColor}
                  onChange={(c) => {
                    setHudSettings(prev => {
                      const s = { ...prev, backgroundColor: c };
                      saveHistory("Update HUD Background Color", layers, dimensions, { hudSettings: s });
                      return s;
                    });
                  }}
                  recentColors={recentColors}
                  label="HUD Background Color"
                  allowTransparent={true}
                />
              </div>

              {/* Text Color Picker */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                <span style={{ fontSize: '10px', color: '#aaa', textTransform: 'uppercase', fontWeight: 'bold' }}>Text / Digits Color</span>
                <PaletteColorPicker
                  selectedColor={hudSettings.textColor || '#ffffff'}
                  onChange={(c) => {
                    setHudSettings(prev => {
                      const s = { ...prev, textColor: c };
                      saveHistory("Update HUD Text Color", layers, dimensions, { hudSettings: s });
                      return s;
                    });
                  }}
                  recentColors={recentColors}
                  label="HUD Text Color"
                  allowTransparent={false}
                />
              </div>

              {/* Elements List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px', borderTop: '1px solid #444', paddingTop: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '10px', color: '#aaa', textTransform: 'uppercase', fontWeight: 'bold' }}>HUD Display Items</span>
                  <button 
                    onClick={handleAddItem}
                    style={{ background: 'transparent', border: '1px solid #4CAF50', color: '#4CAF50', padding: '3px 8px', fontSize: '10px', borderRadius: '3px', cursor: 'pointer', fontWeight: 'bold' }}
                    onMouseEnter={e => { e.target.style.background = '#4CAF50'; e.target.style.color = '#fff'; }}
                    onMouseLeave={e => { e.target.style.background = 'transparent'; e.target.style.color = '#4CAF50'; }}
                  >
                    + Add Item
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto' }}>
                  {(hudSettings.displayItems || []).map((item, idx) => (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#222', padding: '6px', borderRadius: '4px', border: '1px solid #333' }}>
                      {/* Reorder/Delete */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <button 
                          disabled={idx === 0} 
                          onClick={() => handleMoveItem(idx, -1)}
                          style={{ background: 'none', border: 'none', color: idx === 0 ? '#444' : '#aaa', fontSize: '10px', padding: 0, cursor: idx === 0 ? 'default' : 'pointer', height: '10px', display: 'flex', alignItems: 'center' }}
                        >
                          ▲
                        </button>
                        <button 
                          disabled={idx === (hudSettings.displayItems || []).length - 1} 
                          onClick={() => handleMoveItem(idx, 1)}
                          style={{ background: 'none', border: 'none', color: idx === (hudSettings.displayItems || []).length - 1 ? '#444' : '#aaa', fontSize: '10px', padding: 0, cursor: idx === (hudSettings.displayItems || []).length - 1 ? 'default' : 'pointer', height: '10px', display: 'flex', alignItems: 'center' }}
                        >
                          ▼
                        </button>
                      </div>

                      {/* Tile selection */}
                      <TileSelector
                        tiles={savedTiles || []}
                        value={item.tileId}
                        onChange={(v) => {
                          handleUpdateItem(item.id, 'tileId', v);
                          saveHistory("Update HUD Item Icon", layers, dimensions, { hudSettings: { ...hudSettings, displayItems: (hudSettings.displayItems || []).map(it => it.id === item.id ? { ...it, tileId: v } : it) } });
                        }}
                        label=""
                        hideLabel={true}
                        placeholder="[Icon]"
                        style={{ width: '130px', minWidth: '0' }}
                      />

                      {/* Text */}
                      <input 
                        type="text" 
                        value={item.text || ''} 
                        onChange={(e) => handleUpdateItem(item.id, 'text', e.target.value)}
                        onBlur={commitHUDChanges}
                        placeholder="x {PLAYER_HP}"
                        style={{ background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '10px', outline: 'none', borderRadius: '3px', flex: 1, minWidth: 0 }}
                      />

                      {/* Delete */}
                      <button 
                        onClick={() => handleRemoveItem(item.id)}
                        style={{ background: 'none', border: 'none', color: '#ff4444', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        title="Delete Item"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>

            </>
          )}

        </div>
      )}
    </div>
  );
};

export default HUDPanel;
