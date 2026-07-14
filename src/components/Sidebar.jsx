import { useState, useEffect, useRef, useCallback } from 'react';
import { BsChevronLeft, BsChevronRight, BsMap, BsPalette, BsType, BsBorder, BsLayers, BsBoundingBox, BsLightningChargeFill, BsMusicNoteBeamed, BsCalculator, BsCodeSlash, BsClockHistory, BsTv, BsSoundwave } from 'react-icons/bs';
import { ImMan } from 'react-icons/im';
import Navigator from './Navigator';
import Palette from './Palette';
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

const PANEL_META = {
  scenes:     { icon: BsMap,                  title: 'Scenes' },
  palette:    { icon: BsPalette,              title: 'Palette' },
  tiles:      { icon: BsBorder,               title: 'Tiles' },
  layers:     { icon: BsLayers,               title: 'Layers' },
  hud:        { icon: BsTv,                   title: 'HUD Settings' },
  actors:     { icon: ImMan,                  title: 'Actors' },
  collisions: { icon: BsBoundingBox,          title: 'Collisions' },
  triggers:   { icon: BsLightningChargeFill,  title: 'Triggers' },
  music:      { icon: BsMusicNoteBeamed,      title: 'Music' },
  sfx:        { icon: BsSoundwave,            title: 'SFX' },
  variables:  { icon: BsCalculator,           title: 'Variables' },
  scripts:    { icon: BsCodeSlash,            title: 'Scripts' },
  history:    { icon: BsClockHistory,         title: 'History' },
};

const PANEL_COMPONENTS = {
  scenes: ScenesPanel, palette: Palette, tiles: TilePanel, layers: LayersPanel,
  hud: HUDPanel, actors: ActorsPanel, collisions: CollisionsPanel,
  triggers: TriggersPanel, music: MusicPanel, sfx: SfxPanel,
  variables: VariablesPanel, scripts: ScriptsPanel, history: HistoryPanel,
};

const DEFAULT_LAYOUT = {
  col1: ['hud', 'scenes', 'actors', 'variables', 'scripts', 'collisions', 'triggers'],
  col2: ['palette', 'tiles', 'layers', 'music', 'sfx', 'history'],
};

const DropIndicator = () => (
  <div style={{ position: 'absolute', top: -1, left: 0, right: 0, height: '2px', background: '#4CAF50', zIndex: 10, pointerEvents: 'none' }} />
);

const Sidebar = () => {
  const {
    tool,
    activeCol1Panel, setActiveCol1Panel,
    activeCol2Panel, setActiveCol2Panel,
    activeCol3Panel, setActiveCol3Panel
  } = usePxShop();

  const [layout, setLayout] = useState(() => {
    try {
      const saved = localStorage.getItem('px_shop_panel_layout');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.col1 && parsed.col2) return parsed;
      }
    } catch {}
    return DEFAULT_LAYOUT;
  });

  useEffect(() => {
    localStorage.setItem('px_shop_panel_layout', JSON.stringify(layout));
  }, [layout]);

  useEffect(() => {
    const handleResetLayout = () => setLayout(DEFAULT_LAYOUT);
    window.addEventListener('reset-panel-layout', handleResetLayout);
    return () => window.removeEventListener('reset-panel-layout', handleResetLayout);
  }, []);

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
  const allCollapsedRef = useRef(null);

  useEffect(() => { localStorage.setItem('px_shop_col1_collapsed', col1Collapsed); }, [col1Collapsed]);
  useEffect(() => { localStorage.setItem('px_shop_col2_collapsed', col2Collapsed); }, [col2Collapsed]);
  useEffect(() => { localStorage.setItem('px_shop_col3_collapsed', col3Collapsed); }, [col3Collapsed]);
  allCollapsedRef.current = [col1Collapsed, col2Collapsed, col3Collapsed];

  useEffect(() => {
    const handleToggleMinimize = () => {
      const next = !allCollapsedRef.current[0];
      setCol1Collapsed(next);
      setCol2Collapsed(next);
      setCol3Collapsed(next);
    };
    window.addEventListener('toggle-sidebar-minimize', handleToggleMinimize);
    window.__toggleSidebarMinimize = handleToggleMinimize;
    return () => { window.removeEventListener('toggle-sidebar-minimize', handleToggleMinimize); delete window.__toggleSidebarMinimize; };
  }, []);

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
      const colWidthSetters = [setCol1Width, setCol2Width, setCol3Width];
      if (colWidthSetters[draggingCol - 1]) colWidthSetters[draggingCol - 1](newWidth);
    };
    const handleMouseUp = () => setDraggingCol(null);

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => { document.removeEventListener('mousemove', handleMouseMove); document.removeEventListener('mouseup', handleMouseUp); };
  }, [draggingCol]);

  const findColumnForPanel = useCallback((panelKey) => {
    for (const colKey of Object.keys(layout)) {
      if (layout[colKey].includes(panelKey)) return colKey;
    }
    return null;
  }, [layout]);

  const setActiveForColumn = useCallback((colName, panelKey) => {
    const setters = { col1: [setActiveCol1Panel, setCol1Collapsed], col2: [setActiveCol2Panel, setCol2Collapsed], col3: [setActiveCol3Panel, setCol3Collapsed] };
    const pair = setters[colName];
    if (pair) { pair[0](panelKey); pair[1](false); }
  }, [setActiveCol1Panel, setActiveCol2Panel, setActiveCol3Panel, setCol1Collapsed, setCol2Collapsed, setCol3Collapsed]);

  useEffect(() => {
    const activatePanel = (panelKey) => {
      const col = findColumnForPanel(panelKey);
      if (col) setActiveForColumn(col, panelKey);
    };

    if (['tile', 'tileFill'].includes(tool)) {
      activatePanel('tiles');
    } else if (['actor', 'spawn'].includes(tool)) {
      activatePanel('actors');
    }

    if (['trigger'].includes(tool)) {
      activatePanel('triggers');
    } else if (['collision', 'collisionFill'].includes(tool)) {
      activatePanel('collisions');
    }
  }, [tool, findColumnForPanel, setActiveForColumn]);

  const draggedPanelRef = useRef(null);
  const [draggingPanelKey, setDraggingPanelKey] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);

  const movePanel = useCallback((draggedKey, fromCol, targetKey, toCol, position) => {
    setLayout(prev => {
      if (draggedKey === targetKey && fromCol === toCol) return prev;
      if (fromCol !== toCol && prev[fromCol].length <= 1) return prev;
      const next = {};
      for (const k of Object.keys(prev)) next[k] = [...prev[k]];
      const fromArr = next[fromCol];
      const dragIndex = fromArr.indexOf(draggedKey);
      if (dragIndex === -1) return prev;
      fromArr.splice(dragIndex, 1);
      const toArr = next[toCol];
      let insertIndex = toArr.indexOf(targetKey);
      if (insertIndex === -1) {
        toArr.push(draggedKey);
      } else {
        if (position === 'after') insertIndex += 1;
        toArr.splice(insertIndex, 0, draggedKey);
      }
      return next;
    });
    setDropTarget(null);
    setDraggingPanelKey(null);
  }, []);

  const movePanelToColumnEnd = useCallback((draggedKey, fromCol, toCol) => {
    setLayout(prev => {
      if (fromCol !== toCol && prev[fromCol].length <= 1) return prev;
      const next = {};
      for (const k of Object.keys(prev)) next[k] = [...prev[k]];
      const fromArr = next[fromCol];
      const dragIndex = fromArr.indexOf(draggedKey);
      if (dragIndex === -1) return prev;
      fromArr.splice(dragIndex, 1);
      next[toCol].push(draggedKey);
      return next;
    });
    setDropTarget(null);
    setDraggingPanelKey(null);
  }, []);

  const makeDragProps = useCallback((panelKey, colName) => ({
    draggable: true,
    onDragStart: (e) => {
      draggedPanelRef.current = { key: panelKey, fromCol: colName };
      setDraggingPanelKey(panelKey);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', panelKey);
    },
    onDragEnd: () => {
      draggedPanelRef.current = null;
      setDraggingPanelKey(null);
      setDropTarget(null);
    },
  }), []);

  const handlePanelDragOver = useCallback((e, panelKey, colName) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const dragged = draggedPanelRef.current;
    if (!dragged || (dragged.key === panelKey && dragged.fromCol === colName)) return;
    if (dragged.fromCol !== colName && layout[dragged.fromCol].length <= 1) {
      e.dataTransfer.dropEffect = 'none';
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const position = e.clientY < midY ? 'before' : 'after';
    setDropTarget(prev => {
      if (prev?.key === panelKey && prev?.position === position && prev?.col === colName) return prev;
      return { key: panelKey, col: colName, position };
    });
  }, [layout]);

  const handlePanelDrop = useCallback((e, panelKey, colName) => {
    e.preventDefault();
    const dragged = draggedPanelRef.current;
    if (!dragged || !dropTarget) return;
    movePanel(dragged.key, dragged.fromCol, dropTarget.key, dropTarget.col, dropTarget.position);
  }, [dropTarget, movePanel]);

  const renderColumnPanels = useCallback((colName, activePanel, setActivePanel) => {
    const panels = layout[colName];
    return panels.map(panelKey => {
      const Component = PANEL_COMPONENTS[panelKey];
      if (!Component) return null;
      const isActive = activePanel === panelKey;
      const isDragging = draggingPanelKey === panelKey;
      return (
        <div
          key={panelKey}
          onDragOver={(e) => handlePanelDragOver(e, panelKey, colName)}
          onDragLeave={() => setDropTarget(null)}
          onDrop={(e) => handlePanelDrop(e, panelKey, colName)}
          style={{ position: 'relative', flex: isActive ? 1 : 'none', minHeight: 0, display: 'flex', flexDirection: 'column', opacity: isDragging ? 0.4 : 1, overflow: 'hidden' }}
        >
          {dropTarget?.key === panelKey && dropTarget?.position === 'before' && <DropIndicator />}
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            <Component
              isCollapsed={!isActive}
              onToggle={() => setActivePanel(isActive ? null : panelKey)}
              dragProps={makeDragProps(panelKey, colName)}
            />
          </div>
          {dropTarget?.key === panelKey && dropTarget?.position === 'after' && <DropIndicator />}
        </div>
      );
    });
  }, [layout, draggingPanelKey, handlePanelDragOver, handlePanelDrop, makeDragProps]);

  const renderCollapsedIcons = useCallback((colName, activePanel, setActivePanel, setCollapsed) => {
    const panels = layout[colName];
    return (
      <div
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '10px 0', flex: 1 }}
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDropTarget({ key: '__drop_' + colName + '__', col: colName, position: 'end' }); }}
        onDragLeave={() => setDropTarget(null)}
        onDrop={(e) => {
          e.preventDefault();
          const dragged = draggedPanelRef.current;
          if (!dragged) return;
          movePanelToColumnEnd(dragged.key, dragged.fromCol, colName);
          setCollapsed(false);
        }}
      >
        {panels.map(p => {
          const meta = PANEL_META[p];
          if (!meta) return null;
          const Icon = meta.icon;
          return (
            <div key={p} className="collapsed-icon-btn" title={meta.title}
              onClick={() => { setCollapsed(false); setActivePanel(p); }}
              style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '22px', height: '22px', borderRadius: '4px', background: activePanel === p ? '#3d3d3d' : 'transparent' }}>
              <Icon size={14} color="#aaa" />
            </div>
          );
        })}
      </div>
    );
  }, [layout, movePanelToColumnEnd]);

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
      
      {/* Dynamic columns */}
      {Object.keys(layout).map((colKey, i) => {
        const colNum = i + 1;
        const colWidth = [col1Width, col2Width, col3Width][i] ?? 260;
        const colCollapsed = [col1Collapsed, col2Collapsed, col3Collapsed][i];
        const setColCollapsed = [setCol1Collapsed, setCol2Collapsed, setCol3Collapsed][i];
        const activePanel = [activeCol1Panel, activeCol2Panel, activeCol3Panel][i];
        const setActivePanel = [setActiveCol1Panel, setActiveCol2Panel, setActiveCol3Panel][i];
        const setColWidth = [setCol1Width, setCol2Width, setCol3Width][i];
        const defaultBg = i === 0 ? '#2d2d2d' : '#252528';
        return (
          <div key={colKey} id={`tour-sidebar-${colKey}`} style={{ position: 'relative', width: `${colCollapsed ? 30 : colWidth}px`, backgroundColor: defaultBg, borderLeft: '1px solid #1a1a1a', display: 'flex', flexDirection: 'column', zIndex: 10, flexShrink: 0, transition: 'width 0.2s ease' }}>
            {!colCollapsed && <div onMouseDown={startDrag(colNum, colWidth)} style={{ position: 'absolute', top: 0, left: -3, width: 6, bottom: 0, cursor: 'col-resize', zIndex: 20 }} />}
            <div
              onClick={() => setColCollapsed(!colCollapsed)}
              style={{ height: '24px', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', background: '#1a1a1a', borderBottom: colCollapsed ? 'none' : '1px solid #3c3c3c', flexShrink: 0 }}
              title={colCollapsed ? "Expand Column" : "Collapse Column"}
            >
              {colCollapsed ? <BsChevronLeft color="#aaa" size={12} /> : <BsChevronRight color="#aaa" size={12} />}
            </div>
            {colCollapsed && renderCollapsedIcons(colKey, activePanel, setActivePanel, setColCollapsed)}
            <div style={{ display: colCollapsed ? 'none' : 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              {renderColumnPanels(colKey, activePanel, setActivePanel)}
            </div>
          </div>
        );
      })}
    </>
  );
};

export default Sidebar;
