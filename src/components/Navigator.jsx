import { useEffect } from 'react';
import { usePxShop } from '../context/PxShopContext';
import { IoNavigateCircleOutline } from 'react-icons/io5';
import { BsChevronDown, BsChevronRight } from 'react-icons/bs';

const Navigator = ({ isCollapsed, onToggle }) => {
  const {
    dimensions,
    isPixelated,
    isNavDragging, setIsNavDragging,
    updatePanFromNav,
    navigatorRef,
    navScale,
    navBox,
    viewActiveOnly,
    activeLayerId,
    layers,
    renderLayersToCtx,
    actors
  } = usePxShop();

  // Rendering Navigator Mini-map Loop
  useEffect(() => {
    const canvas = navigatorRef.current;
    if (!canvas || navScale === 0) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, dimensions.w, dimensions.h);
    const layersToDraw = viewActiveOnly ? layers.filter(l => l.id === activeLayerId) : layers;
    renderLayersToCtx(ctx, 1, layersToDraw);
  }, [renderLayersToCtx, dimensions, layers, viewActiveOnly, activeLayerId, navScale, navigatorRef]);

  let gbaX = 0;
  let gbaY = 50;
  const player = actors?.find(a => a.type === 'player');

  if (player) {
    gbaX = player.x + ((player.width || 16) / 2) - 120;
    gbaY = player.y + ((player.height || 16) / 2) - 80;
    
    gbaX = Math.max(0, Math.min(gbaX, Math.max(0, dimensions.w - 240)));
    gbaY = Math.max(0, Math.min(gbaY, Math.max(0, dimensions.h - 160)));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: isCollapsed ? 'auto' : '160px', borderBottom: '2px solid #222', flexShrink: 0 }}>
      <div 
        onClick={onToggle}
        style={{ padding: '15px', borderBottom: isCollapsed ? 'none' : '1px solid #3c3c3c', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}
      >
        <span style={{ fontWeight: 'bold', fontSize: '11px', textTransform: 'uppercase', color: '#aaa', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <IoNavigateCircleOutline /> Navigator
        </span>
        <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
          {isCollapsed ? <BsChevronRight style={{ color: '#aaa' }} /> : <BsChevronDown style={{ color: '#aaa' }} />}
        </div>
      </div>
      {!isCollapsed && (
        <div 
          style={{ flex: 1, backgroundColor: '#121212', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: isNavDragging ? 'grabbing' : 'grab' }}
          onMouseDown={(e) => { setIsNavDragging(true); updatePanFromNav(e); }}
        >
          <div style={{ position: 'relative', width: dimensions.w * navScale, height: dimensions.h * navScale, boxShadow: '0 0 10px rgba(0,0,0,0.5)', overflow: 'hidden' }}>
            <canvas ref={navigatorRef} width={dimensions.w} height={dimensions.h} style={{ width: '100%', height: '100%', imageRendering: isPixelated ? 'pixelated' : 'auto' }} />
            
            {/* GBA Screen Bounds Indicator */}
            <div style={{
              position: 'absolute',
              border: '1px dashed #00ffff',
              top: gbaY * navScale,
              left: gbaX * navScale,
              width: Math.min(dimensions.w, 240) * navScale,
              height: Math.min(dimensions.h, 160) * navScale,
              boxSizing: 'border-box',
              pointerEvents: 'none',
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'flex-end',
              padding: '2px',
              boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.6)'
            }}>
              <span style={{ fontSize: '8px', color: '#00ffff', textShadow: '1px 1px 0 #000' }}>GBA</span>
            </div>

            <div style={{
              position: 'absolute',
              border: '1px solid #ff0000',
              top: navBox.y,
              left: navBox.x,
              width: navBox.w,
              height: navBox.h,
              boxSizing: 'border-box',
              pointerEvents: 'none',
              backgroundColor: 'rgba(255, 0, 0, 0.1)'
            }} />
          </div>
        </div>
      )}
    </div>
  );
};

export default Navigator;
