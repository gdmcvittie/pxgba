import { useState, useRef } from 'react';
import { usePxShop } from '../context/PxShopContext';
import { BsPlayFill, BsFillSaveFill, BsExclamationTriangleFill, BsBorder, BsDice1, BsChevronDown } from 'react-icons/bs';

const Header = () => {
  const [showWarnings, setShowWarnings] = useState(false);
  const [showSceneMenu, setShowSceneMenu] = useState(false);
  const lastClickRef = useRef(0);
  const {
    warnings,
    dismissedWarnings, setDismissedWarnings,
    hideWarningBadge, setHideWarningBadge,
    isPixelated, setIsPixelated,
    guides, setGuides,
    dimensions,
    handleResizeImage,
    zoom, setZoom,
    getNextZoom,
    showGbaMask, setShowGbaMask,
    setTool,
    projectInputRef, handleProjectUpload,
    gbStudioInputRef, handleGbStudioUpload,
    imageInputRef, handleImageUpload,
    importLayerInputRef, handleImportToLayer,
    paletteInputRef, handlePaletteUpload,
    setShowEmulatorDialog,
    publishRom,
    validateScenesLayers,
    isBusy,
    containerRef,
    setPanOffset,
    scenes,
    activeSceneId,
    switchScene,
    gridSize, setGridSize,
    showGridMenu, setShowGridMenu
  } = usePxShop();

  const activeScene = scenes ? scenes.find(s => s.id === activeSceneId) : null;
  const activeSceneName = activeScene ? activeScene.name : 'Scene';

  const handleFitZoom = () => {
    if (containerRef?.current && dimensions.w > 0 && dimensions.h > 0) {
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        const availableW = rect.width - 60;
        const availableH = rect.height - 60;
        const fitZoom = Math.min(availableW / dimensions.w, availableH / dimensions.h);
        const optimalZoom = Math.max(0.1, Math.min(4, fitZoom));
        setZoom(optimalZoom);
        if (setPanOffset) setPanOffset({ x: 0, y: 0 });
      }
    }
  };

  const visibleWarnings = warnings ? warnings.filter(w => !dismissedWarnings.includes(w)) : [];

  return (
    <div onMouseDown={() => { const now = Date.now(); if (now - lastClickRef.current < 400) { window.__toggleSidebarMinimize?.(); window.dispatchEvent(new Event('toggle-sidebar-minimize')); lastClickRef.current = 0; } else { lastClickRef.current = now; } }} style={{
      height: '45px',
      backgroundColor: '#2d2d2d',
      borderBottom: '1px solid #3c3c3c',
      display: 'grid',
      gridTemplateColumns: '1fr auto 1fr',
      alignItems: 'center',
      padding: '0 15px',
      zIndex: 10
    }}>
      {/* Left controls */}
      <div style={{ display: 'flex', gap: '15px', alignItems: 'center', justifyContent: 'flex-start' }}>
        {(guides.x.length > 0 || guides.y.length > 0) && (
          <button onClick={() => setGuides({ x: [], y: [] })} style={{ background: 'transparent', border: '1px solid #555', color: '#ccc', padding: '2px 8px', borderRadius: '3px', cursor: 'pointer', fontSize: '11px' }}>Clear Guides</button>
        )}

        <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
          <select
            value={Math.round(dimensions.w / 8)}
            onChange={e => {
              const val = parseInt(e.target.value);
              handleResizeImage(val * 8, dimensions.h);
            }}
            style={{ backgroundColor: '#1e1e1e', color: '#fff', border: '1px solid #3c3c3c', padding: '4px', borderRadius: '3px', outline: 'none', cursor: 'pointer' }}
          >
            {[32, 64, 96, 128, 160, 192, 224, 256].map(t => <option key={t} value={t}>{t}</option>)}
            {!([32, 64, 96, 128, 160, 192, 224, 256].includes(Math.round(dimensions.w / 8))) && <option value={Math.round(dimensions.w / 8)}>{Math.round(dimensions.w / 8)}</option>}
          </select>
          <span style={{ fontSize: '12px', color: '#aaa' }}>x</span>
          <select
            value={Math.round(dimensions.h / 8)}
            onChange={e => {
              const val = parseInt(e.target.value);
              handleResizeImage(dimensions.w, val * 8);
            }}
            style={{ backgroundColor: '#1e1e1e', color: '#fff', border: '1px solid #3c3c3c', padding: '4px', borderRadius: '3px', outline: 'none', cursor: 'pointer' }}
          >
            {[32, 64, 96, 128, 160, 192, 224, 256].map(t => <option key={t} value={t}>{t}</option>)}
            {!([32, 64, 96, 128, 160, 192, 224, 256].includes(Math.round(dimensions.h / 8))) && <option value={Math.round(dimensions.h / 8)}>{Math.round(dimensions.h / 8)}</option>}
          </select>
        </div>
        <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
          <button onClick={() => setZoom(z => getNextZoom(z, -1))} style={{ background: '#1e1e1e', border: '1px solid #3c3c3c', color: '#fff', padding: '2px 8px', borderRadius: '3px', cursor: 'pointer' }}>-</button>
          <span onDoubleClick={handleFitZoom} title="Double-click to fit screen" style={{ fontSize: '12px', width: '40px', textAlign: 'center', cursor: 'pointer', userSelect: 'none' }}>{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => getNextZoom(z, 1))} style={{ background: '#1e1e1e', border: '1px solid #3c3c3c', color: '#fff', padding: '2px 8px', borderRadius: '3px', cursor: 'pointer' }}>+</button>
        </div>
        <button onClick={handleFitZoom} title="Zoom to fill" style={{ background: '#1e1e1e', border: '1px solid #3c3c3c', color: '#fff', padding: '2px 6px', borderRadius: '3px', cursor: 'pointer', fontSize: '11px', lineHeight: '1' }}>⛶</button>
        <button
          onClick={() => {
            const nextVal = !showGbaMask;
            setShowGbaMask(nextVal);
            if (nextVal && setTool) {
              setTool('grab');
            }
          }}
          title="Toggle GBA Screen Mask (240x160)"
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#4CAF50';
            e.currentTarget.style.borderColor = '#4CAF50';
            e.currentTarget.style.color = '#fff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.borderColor = showGbaMask ? '#4CAF50' : '#555';
            e.currentTarget.style.color = showGbaMask ? '#4CAF50' : '#888';
          }}
          style={{
            background: 'transparent',
            border: showGbaMask ? '1px solid #4CAF50' : '1px solid #555',
            color: showGbaMask ? '#4CAF50' : '#888',
            padding: '4px 7px',
            borderRadius: '3px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <BsDice1 size={12} />
        </button>
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => {
              if (gridSize === 0) setGridSize(1);
              else setShowGridMenu(!showGridMenu);
            }}
            onContextMenu={(e) => { e.preventDefault(); setShowGridMenu(!showGridMenu); }}
            style={{ background: '#1e1e1e', border: '1px solid #3c3c3c', color: gridSize > 0 ? '#fff' : '#666', padding: '4px 7px', borderRadius: '3px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            title="Grid Options (Click again or Right-click for more)"
          >
            <BsBorder size={12} />
          </button>
          {showGridMenu && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setShowGridMenu(false)} onContextMenu={(e) => { e.preventDefault(); setShowGridMenu(false); }} />
              <div style={{ position: 'absolute', left: 0, top: '100%', marginTop: '4px', backgroundColor: '#333', border: '1px solid #444', borderRadius: '4px', display: 'flex', gap: '5px', padding: '5px', zIndex: 100, boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
                <button onClick={() => { setGridSize(1); setShowGridMenu(false); }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#4CAF50'; e.currentTarget.style.borderColor = '#4CAF50'; e.currentTarget.style.color = '#fff'; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = gridSize === 1 ? '#4CAF50' : '#333'; e.currentTarget.style.color = gridSize === 1 ? '#4CAF50' : '#888'; }} style={{ padding: '6px 8px', backgroundColor: 'transparent', border: gridSize === 1 ? '1px solid #4CAF50' : '1px solid #333', color: gridSize === 1 ? '#4CAF50' : '#888', cursor: 'pointer', borderRadius: '4px', whiteSpace: 'nowrap', fontSize: '11px' }}>1x1</button>
                <button onClick={() => { setGridSize(8); setShowGridMenu(false); }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#4CAF50'; e.currentTarget.style.borderColor = '#4CAF50'; e.currentTarget.style.color = '#fff'; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = gridSize === 8 ? '#4CAF50' : '#333'; e.currentTarget.style.color = gridSize === 8 ? '#4CAF50' : '#888'; }} style={{ padding: '6px 8px', backgroundColor: 'transparent', border: gridSize === 8 ? '1px solid #4CAF50' : '1px solid #333', color: gridSize === 8 ? '#4CAF50' : '#888', cursor: 'pointer', borderRadius: '4px', whiteSpace: 'nowrap', fontSize: '11px' }}>8x8</button>
                <button onClick={() => { setGridSize(16); setShowGridMenu(false); }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#4CAF50'; e.currentTarget.style.borderColor = '#4CAF50'; e.currentTarget.style.color = '#fff'; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = gridSize === 16 ? '#4CAF50' : '#333'; e.currentTarget.style.color = gridSize === 16 ? '#4CAF50' : '#888'; }} style={{ padding: '6px 8px', backgroundColor: 'transparent', border: gridSize === 16 ? '1px solid #4CAF50' : '1px solid #333', color: gridSize === 16 ? '#4CAF50' : '#888', cursor: 'pointer', borderRadius: '4px', whiteSpace: 'nowrap', fontSize: '11px' }}>16x16</button>
                <button onClick={() => { setGridSize(0); setShowGridMenu(false); }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#4CAF50'; e.currentTarget.style.borderColor = '#4CAF50'; e.currentTarget.style.color = '#fff'; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = gridSize === 0 ? '#4CAF50' : '#333'; e.currentTarget.style.color = gridSize === 0 ? '#4CAF50' : '#888'; }} style={{ padding: '6px 8px', backgroundColor: 'transparent', border: gridSize === 0 ? '1px solid #4CAF50' : '1px solid #333', color: gridSize === 0 ? '#4CAF50' : '#888', cursor: 'pointer', borderRadius: '4px', whiteSpace: 'nowrap', fontSize: '11px' }}>Off</button>
              </div>
            </>
          )}
        </div>
        <input type="file" ref={projectInputRef} onChange={handleProjectUpload} style={{ display: 'none' }} accept=".pxg,.json" />
        <input type="file" ref={gbStudioInputRef} onChange={handleGbStudioUpload} style={{ display: 'none' }} accept=".zip" />
        <input type="file" ref={imageInputRef} onChange={handleImageUpload} style={{ display: 'none' }} accept="image/*,.psd" />
        <input type="file" ref={importLayerInputRef} onChange={handleImportToLayer} style={{ display: 'none' }} accept="image/*" />
        <input type="file" ref={paletteInputRef} onChange={handlePaletteUpload} style={{ display: 'none' }} accept=".gpl,.json,.hex,.txt,image/*" />
      </div>

      {/* Center Active Scene Name */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        <div 
          onClick={() => setShowSceneMenu(!showSceneMenu)}
          style={{
            backgroundColor: '#1e1e1e',
            border: '1px solid #3c3c3c',
            borderRadius: '20px',
            padding: '4px 14px',
            color: '#4CAF50',
            fontWeight: 'bold',
            fontSize: '11px',
            letterSpacing: '0.5px',
            boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            textTransform: 'uppercase',
            cursor: 'pointer',
            userSelect: 'none',
            transition: 'border-color 0.2s, background-color 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#4CAF50';
            e.currentTarget.style.backgroundColor = '#252525';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#3c3c3c';
            e.currentTarget.style.backgroundColor = '#1e1e1e';
          }}
        >
          <span style={{ display: 'inline-block', width: '6px', height: '6px', backgroundColor: '#4CAF50', borderRadius: '50%', boxShadow: '0 0 8px #4CAF50' }}></span>
          {activeSceneName}
          <BsChevronDown size={10} style={{ color: '#4CAF50', marginLeft: '2px' }} />
        </div>
        {showSceneMenu && (
          <>
            <div 
              style={{ position: 'fixed', inset: 0, zIndex: 99 }} 
              onClick={() => setShowSceneMenu(false)} 
            />
            <div style={{
              position: 'absolute',
              top: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              marginTop: '6px',
              backgroundColor: '#1e1e1e',
              border: '1px solid #3c3c3c',
              borderRadius: '8px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
              minWidth: '200px',
              maxHeight: '300px',
              overflowY: 'auto',
              padding: '6px',
              zIndex: 100,
              display: 'flex',
              flexDirection: 'column',
              gap: '2px'
            }}>
              {scenes && scenes.filter(s => s.type !== 'group').map(s => {
                const isActive = s.id === activeSceneId;
                const typeLabel = (s.type || 'TOPDOWN').toUpperCase();
                return (
                  <button
                    key={s.id}
                    onClick={() => {
                      switchScene(s.id);
                      setShowSceneMenu(false);
                    }}
                    style={{
                      background: isActive ? 'rgba(76, 175, 80, 0.15)' : 'transparent',
                      border: 'none',
                      color: isActive ? '#4CAF50' : '#ccc',
                      padding: '8px 12px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontSize: '12px',
                      fontWeight: isActive ? 'bold' : 'normal',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '12px',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = '#2c2c2c';
                        e.currentTarget.style.color = '#fff';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = '#ccc';
                      }
                    }}
                  >
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px' }}>
                      {s.name}
                    </span>
                    <span style={{ fontSize: '9px', color: isActive ? '#4CAF50' : '#888', opacity: 0.8, textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                      {typeLabel}
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Right controls */}
      <div style={{ display: 'flex', gap: '15px', alignItems: 'center', justifyContent: 'flex-end' }}>
        {!hideWarningBadge && visibleWarnings.length > 0 && (
          <div
            style={{ position: 'relative' }}
            onMouseEnter={() => setShowWarnings(true)}
            onMouseLeave={() => setShowWarnings(false)}
          >
            <button
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#ff9800';
                e.currentTarget.style.borderColor = '#ff9800';
                e.currentTarget.style.color = '#fff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.borderColor = '#ff9800';
                e.currentTarget.style.color = '#ff9800';
              }}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'transparent', border: '1px solid #ff9800', color: '#ff9800', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}
            >
              <BsExclamationTriangleFill size={16} />
            </button>
            {showWarnings && (
    <div style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: '4px',
                backgroundColor: '#333',
                border: '1px solid #ff9800',
                borderRadius: '4px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                width: '300px',
                display: 'flex',
                flexDirection: 'column',
                padding: '8px',
                zIndex: 100,
                gap: '8px'
              }}>
                <div style={{ color: '#ff9800', fontWeight: 'bold', borderBottom: '1px solid #555', paddingBottom: '4px', marginBottom: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>GBA Hardware Limits</span>
                </div>
                {visibleWarnings.map((w, idx) => (
                  <div key={idx} style={{ color: '#fff', fontSize: '11px', lineHeight: '1.4', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <button id="tour-compile-btn" title={isBusy ? "Already compiling..." : "Compile ROM"}
          onClick={() => {
            if (isBusy) return;
            if (validateScenesLayers()) {
              publishRom();
            }
          }}
          disabled={isBusy}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', background: isBusy ? '#555' : '#0078d4', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: '4px', cursor: isBusy ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '12px', boxShadow: '0 2px 5px rgba(0,0,0,0.2)' }}
        >
          <BsFillSaveFill size={16} />
        </button>

        <button id="tour-play-btn" title={isBusy ? "Already compiling..." : "Play Test"}
          onClick={() => {
            if (isBusy) return;
            if (validateScenesLayers()) {
              setShowEmulatorDialog(true);
            }
          }}
          disabled={isBusy}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', background: isBusy ? '#555' : '#4CAF50', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: '4px', cursor: isBusy ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '12px', boxShadow: '0 2px 5px rgba(0,0,0,0.2)' }}
        >
          <BsPlayFill size={16} />
        </button>
      </div>
    </div>
  );
};

export default Header;
