import { useState, useEffect, useRef } from 'react';
import { BsChevronLeft, BsChevronRight, BsMap, BsPalette, BsType, BsBorder, BsLayers, BsBoundingBox, BsLightningChargeFill, BsMusicNoteBeamed, BsCalculator, BsCodeSlash, BsClockHistory, BsTv, BsSoundwave } from 'react-icons/bs';
import { ImMan } from 'react-icons/im';
import Navigator from './Navigator';
import Palette from './Palette';
import TextSettings from './TextSettings';
import TilePanel from './TilePanel';
import LayersPanel from './LayersPanel';
import HistoryPanel from './HistoryPanel';
import ScenesPanel from './ScenesPanel';
import ActorsPanel from './ActorsPanel';
import TriggersPanel from './TriggersPanel';
import CollisionsPanel from './CollisionsPanel';
import MusicPanel from './MusicPanel';
import SfxPanel from './SfxPanel';
import VariablesPanel from './VariablesPanel';
import ScriptsPanel from './ScriptsPanel';
import AnimationsPanel from './AnimationsPanel';
import HUDPanel from './HUDPanel';
import { usePxShop } from '../context/PxShopContext';

const Sidebar = () => {
  const {
    tool,
    activeCol1Panel, setActiveCol1Panel,
    activeCol2Panel, setActiveCol2Panel,
    activeCol3Panel, setActiveCol3Panel
  } = usePxShop();

  const col1Panels = [
    { key: 'scenes', icon: BsMap, title: 'Scenes' },
    { key: 'palette', icon: BsPalette, title: 'Palette' },
    { key: 'text', icon: BsType, title: 'Text Settings' },
    { key: 'tiles', icon: BsBorder, title: 'Tiles' },
    { key: 'layers', icon: BsLayers, title: 'Layers' },
  ];

  const col2Panels = [
    { key: 'hud', icon: BsTv, title: 'HUD Settings' },
    { key: 'actors', icon: ImMan, title: 'Actors' },
    { key: 'collisions', icon: BsBoundingBox, title: 'Collisions' },
    { key: 'triggers', icon: BsLightningChargeFill, title: 'Triggers' },
  ];

  const col3Panels = [
    { key: 'music', icon: BsMusicNoteBeamed, title: 'Music' },
    { key: 'sfx', icon: BsSoundwave, title: 'SFX' },
    { key: 'variables', icon: BsCalculator, title: 'Variables' },
    { key: 'scripts', icon: BsCodeSlash, title: 'Scripts' },
    { key: 'history', icon: BsClockHistory, title: 'History' },
  ];

  const [col1Width, setCol1Width] = useState(() => {
    const saved = localStorage.getItem('px_shop_col1Width');
    return saved !== null ? parseInt(saved, 10) : 320;
  });
  const [col2Width, setCol2Width] = useState(() => {
    const saved = localStorage.getItem('px_shop_col2Width');
    return saved !== null ? parseInt(saved, 10) : 260;
  });
  const [col3Width, setCol3Width] = useState(() => {
    const saved = localStorage.getItem('px_shop_col3Width');
    return saved !== null ? parseInt(saved, 10) : 300;
  });

  const dragRef = useRef({ index: null, startX: 0, startWidth: 0 });
  const [draggingCol, setDraggingCol] = useState(null);

  const [col1Collapsed, setCol1Collapsed] = useState(() => localStorage.getItem('px_shop_col1_collapsed') === 'true');
  const [col2Collapsed, setCol2Collapsed] = useState(() => localStorage.getItem('px_shop_col2_collapsed') === 'true');
  const [col3Collapsed, setCol3Collapsed] = useState(() => localStorage.getItem('px_shop_col3_collapsed') === 'true');

  useEffect(() => { localStorage.setItem('px_shop_col1_collapsed', col1Collapsed); }, [col1Collapsed]);
  useEffect(() => { localStorage.setItem('px_shop_col2_collapsed', col2Collapsed); }, [col2Collapsed]);
  useEffect(() => { localStorage.setItem('px_shop_col3_collapsed', col3Collapsed); }, [col3Collapsed]);

  const [isNavCollapsed, setIsNavCollapsed] = useState(() => {
    const saved = localStorage.getItem('px_shop_nav_collapsed');
    return saved === 'true';
  });

  useEffect(() => { localStorage.setItem('px_shop_nav_collapsed', isNavCollapsed); }, [isNavCollapsed]);

  const startDrag = (index, currentWidth) => (e) => {
    e.preventDefault();
    dragRef.current = { index, startX: e.clientX, startWidth: currentWidth };
    setDraggingCol(index);
  };

  useEffect(() => { localStorage.setItem('px_shop_col1Width', col1Width); }, [col1Width]);
  useEffect(() => { localStorage.setItem('px_shop_col2Width', col2Width); }, [col2Width]);
  useEffect(() => { localStorage.setItem('px_shop_col3Width', col3Width); }, [col3Width]);

  useEffect(() => {
    if (draggingCol === null) return;
    const handleMouseMove = (e) => {
      const deltaX = e.clientX - dragRef.current.startX;
      const newWidth = Math.max(150, dragRef.current.startWidth - deltaX);
      if (draggingCol === 1) setCol1Width(newWidth);
      else if (draggingCol === 2) setCol2Width(newWidth);
      else if (draggingCol === 3) setCol3Width(newWidth);
    };
    const handleMouseUp = () => setDraggingCol(null);

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => { document.removeEventListener('mousemove', handleMouseMove); document.removeEventListener('mouseup', handleMouseUp); };
  }, [draggingCol]);

  useEffect(() => {
    if (['text'].includes(tool)) {
      setActiveCol1Panel('text');
      setCol1Collapsed(false);
    } else if (['pen', 'brush', 'eraser', 'fill', 'gradient', 'drawLine', 'drawRect', 'drawRectFill', 'drawRoundRect', 'drawRoundRectFill', 'drawCircle', 'drawCircleFill'].includes(tool)) {
      setActiveCol1Panel('palette');
      setCol1Collapsed(false);
    }

    if (['tile', 'tileFill'].includes(tool)) {
      setActiveCol1Panel('tiles');
      setCol1Collapsed(false);
    } else if (['actor', 'spawn'].includes(tool)) {
      setActiveCol2Panel('actors');
      setCol2Collapsed(false);
    }

    if (['trigger'].includes(tool)) {
      setActiveCol2Panel('triggers');
      setCol2Collapsed(false);
    } else if (['collision', 'collisionFill'].includes(tool)) {
      setActiveCol2Panel('collisions');
      setCol2Collapsed(false);
    }
  }, [tool]);

  return (
    <>
      <style>{`
        ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        ::-webkit-scrollbar-track {
          background: #1e1e1e;
        }
        ::-webkit-scrollbar-thumb {
          background: #555;
          border-radius: 4px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #777;
        }
        * {
          scrollbar-width: thin;
          scrollbar-color: #555 #1e1e1e;
        }
        ${draggingCol !== null ? `* { cursor: col-resize !important; user-select: none !important; }` : ''}
        .collapsed-icon-btn:hover { background: #1a3a1a !important; }
        .collapsed-icon-btn:hover svg { color: #4CAF50 !important; }
      `}</style>
      
      {/* Column 1 */}
      <div id="tour-sidebar-col1" style={{ position: 'relative', width: `${col1Collapsed ? 30 : col1Width}px`, backgroundColor: '#2d2d2d', borderLeft: '1px solid #1a1a1a', display: 'flex', flexDirection: 'column', zIndex: 10, flexShrink: 0, transition: 'width 0.2s ease' }}>
        {!col1Collapsed && <div onMouseDown={startDrag(1, col1Width)} style={{ position: 'absolute', top: 0, left: -3, width: 6, bottom: 0, cursor: 'col-resize', zIndex: 20 }} />}
        
        <div 
          onClick={() => setCol1Collapsed(!col1Collapsed)}
          style={{ height: '24px', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', background: '#1a1a1a', borderBottom: col1Collapsed ? 'none' : '1px solid #3c3c3c', flexShrink: 0 }}
          title={col1Collapsed ? "Expand Column" : "Collapse Column"}
        >
          {col1Collapsed ? <BsChevronLeft color="#aaa" size={12} /> : <BsChevronRight color="#aaa" size={12} />}
        </div>

        {col1Collapsed && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '10px 0', flex: 1 }}>
            {col1Panels.map(p => {
              const Icon = p.icon;
              return (
                <div key={p.key} className="collapsed-icon-btn" title={p.title} onClick={() => { setCol1Collapsed(false); setActiveCol1Panel(p.key); }} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '22px', height: '22px', borderRadius: '4px', background: activeCol1Panel === p.key ? '#3d3d3d' : 'transparent' }}>
                  <Icon size={14} color="#aaa" />
                </div>
              );
            })}
          </div>
        )}

        <div style={{ display: col1Collapsed ? 'none' : 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <ScenesPanel isCollapsed={activeCol1Panel !== 'scenes'} onToggle={() => setActiveCol1Panel(activeCol1Panel === 'scenes' ? null : 'scenes')} />
          <Palette isCollapsed={activeCol1Panel !== 'palette'} onToggle={() => setActiveCol1Panel(activeCol1Panel === 'palette' ? null : 'palette')} />
          <TextSettings isCollapsed={activeCol1Panel !== 'text'} onToggle={() => setActiveCol1Panel(activeCol1Panel === 'text' ? null : 'text')} />
          <TilePanel isCollapsed={activeCol1Panel !== 'tiles'} onToggle={() => setActiveCol1Panel(activeCol1Panel === 'tiles' ? null : 'tiles')} />
          <LayersPanel isCollapsed={activeCol1Panel !== 'layers'} onToggle={() => setActiveCol1Panel(activeCol1Panel === 'layers' ? null : 'layers')} />
        </div>
      </div>

      {/* Column 2 */}
      <div id="tour-sidebar-col2" style={{ position: 'relative', width: `${col2Collapsed ? 30 : col2Width}px`, backgroundColor: '#252528', borderLeft: '1px solid #1a1a1a', display: 'flex', flexDirection: 'column', zIndex: 10, flexShrink: 0, transition: 'width 0.2s ease' }}>
        {!col2Collapsed && <div onMouseDown={startDrag(2, col2Width)} style={{ position: 'absolute', top: 0, left: -3, width: 6, bottom: 0, cursor: 'col-resize', zIndex: 20 }} />}
        
        <div 
          onClick={() => setCol2Collapsed(!col2Collapsed)}
          style={{ height: '24px', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', background: '#1a1a1a', borderBottom: col2Collapsed ? 'none' : '1px solid #3c3c3c', flexShrink: 0 }}
          title={col2Collapsed ? "Expand Column" : "Collapse Column"}
        >
          {col2Collapsed ? <BsChevronLeft color="#aaa" size={12} /> : <BsChevronRight color="#aaa" size={12} />}
        </div>

        {col2Collapsed && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '10px 0', flex: 1 }}>
            {col2Panels.map(p => {
              const Icon = p.icon;
              return (
                <div key={p.key} className="collapsed-icon-btn" title={p.title} onClick={() => { setCol2Collapsed(false); setActiveCol2Panel(p.key); }} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '22px', height: '22px', borderRadius: '4px', background: activeCol2Panel === p.key ? '#3d3d3d' : 'transparent' }}>
                  <Icon size={14} color="#aaa" />
                </div>
              );
            })}
          </div>
        )}

        <div style={{ display: col2Collapsed ? 'none' : 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <HUDPanel isCollapsed={activeCol2Panel !== 'hud'} onToggle={() => setActiveCol2Panel(activeCol2Panel === 'hud' ? null : 'hud')} />
          <ActorsPanel isCollapsed={activeCol2Panel !== 'actors'} onToggle={() => setActiveCol2Panel(activeCol2Panel === 'actors' ? null : 'actors')} />
          <CollisionsPanel isCollapsed={activeCol2Panel !== 'collisions'} onToggle={() => setActiveCol2Panel(activeCol2Panel === 'collisions' ? null : 'collisions')} />
          <TriggersPanel isCollapsed={activeCol2Panel !== 'triggers'} onToggle={() => setActiveCol2Panel(activeCol2Panel === 'triggers' ? null : 'triggers')} />
        </div>
      </div>

      {/* Column 3 */}
      <div id="tour-sidebar-col3" style={{ position: 'relative', width: `${col3Collapsed ? 30 : col3Width}px`, backgroundColor: '#252528', borderLeft: '1px solid #1a1a1a', display: 'flex', flexDirection: 'column', zIndex: 10, flexShrink: 0, transition: 'width 0.2s ease' }}>
        {!col3Collapsed && <div onMouseDown={startDrag(3, col3Width)} style={{ position: 'absolute', top: 0, left: -3, width: 6, bottom: 0, cursor: 'col-resize', zIndex: 20 }} />}
        
        <div 
          onClick={() => setCol3Collapsed(!col3Collapsed)}
          style={{ height: '24px', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', background: '#1a1a1a', borderBottom: col3Collapsed ? 'none' : '1px solid #3c3c3c', flexShrink: 0 }}
          title={col3Collapsed ? "Expand Column" : "Collapse Column"}
        >
          {col3Collapsed ? <BsChevronLeft color="#aaa" size={12} /> : <BsChevronRight color="#aaa" size={12} />}
        </div>

        {col3Collapsed && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '10px 0', flex: 1 }}>
            {col3Panels.map(p => {
              const Icon = p.icon;
              return (
                <div key={p.key} className="collapsed-icon-btn" title={p.title} onClick={() => { setCol3Collapsed(false); setActiveCol3Panel(p.key); }} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '22px', height: '22px', borderRadius: '4px', background: activeCol3Panel === p.key ? '#3d3d3d' : 'transparent' }}>
                  <Icon size={14} color="#aaa" />
                </div>
              );
            })}
          </div>
        )}

        <div style={{ display: col3Collapsed ? 'none' : 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <MusicPanel isCollapsed={activeCol3Panel !== 'music'} onToggle={() => setActiveCol3Panel(activeCol3Panel === 'music' ? null : 'music')} />
          <SfxPanel isCollapsed={activeCol3Panel !== 'sfx'} onToggle={() => setActiveCol3Panel(activeCol3Panel === 'sfx' ? null : 'sfx')} />
          <VariablesPanel isCollapsed={activeCol3Panel !== 'variables'} onToggle={() => setActiveCol3Panel(activeCol3Panel === 'variables' ? null : 'variables')} />
          <ScriptsPanel isCollapsed={activeCol3Panel !== 'scripts'} onToggle={() => setActiveCol3Panel(activeCol3Panel === 'scripts' ? null : 'scripts')} />
          <HistoryPanel isCollapsed={activeCol3Panel !== 'history'} onToggle={() => setActiveCol3Panel(activeCol3Panel === 'history' ? null : 'history')} />
        </div>
      </div>
    </>
  );
};

export default Sidebar;
