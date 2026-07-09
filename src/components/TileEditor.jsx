import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { usePxShop } from '../context/PxShopContext';
import { BsPencilFill, BsEraserFill, BsPaintBucket, BsEye, BsArrowsMove } from 'react-icons/bs';
import { blendHexColors } from '../context/utils';

const CELL = 30; // px per tile pixel -> 240x240 canvas
const SIZE = 8;

const TOOLS = [
  { id: 'pen', label: 'Pen', icon: BsPencilFill },
  { id: 'eraser', label: 'Eraser', icon: BsEraserFill },
  { id: 'fill', label: 'Fill', icon: BsPaintBucket }
];

const emptyGrid = () => Array(SIZE).fill(null).map(() => Array(SIZE).fill(null));

const floodFill = (grid, x, y, newColor) => {
  const target = grid[y][x];
  if (target === newColor) return;
  const stack = [[x, y]];
  while (stack.length) {
    const [cx, cy] = stack.pop();
    if (cx < 0 || cx > 7 || cy < 0 || cy > 7) continue;
    if (grid[cy][cx] !== target) continue;
    grid[cy][cx] = newColor;
    stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
  }
};

const TileEditor = () => {
  const {
    tileEditor, setTileEditor,
    setLiveTilePreview,
    getTileById, savedTiles, commitTileEdit,
    tool, setTool,
    currentColor, setCurrentColor,
    drawWidth, brushType, brushOpacity, colorJitter, symmetryMode,
    getBrushPixels, getSymmetricPixels,
    recentColors,
    saveHistory, layers, dimensions
  } = usePxShop();

  const tileId = tileEditor?.tileId;

  const buildInitial = () => {
    if (!tileEditor) return emptyGrid();
    const tile = getTileById(tileEditor.tileId);
    return tile?.data ? tile.data.map(r => r.map(c => (c ? c : null))) : emptyGrid();
  };

  const [editBuffer, setEditBuffer] = useState(buildInitial);
  const bufferRef = useRef(null);
  if (bufferRef.current === null) bufferRef.current = buildInitial();
  const [livePreview, setLivePreview] = useState(false);
  const [pos, setPos] = useState(() => ({
    x: typeof window !== 'undefined' ? Math.max(20, window.innerWidth / 2 - 150) : 320,
    y: 120
  }));
  const [showGrid] = useState(true);

  const canvasRef = useRef(null);
  const drawingRef = useRef({ active: false, lastX: null, lastY: null, startX: null, startY: null });
  const dragRef = useRef(null);

  // Ensure a supported tool is selected when the editor opens
  useEffect(() => { setTool('pen'); }, [setTool]);

  // Redraw the canvas whenever the buffer changes
  useEffect(() => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, SIZE * CELL, SIZE * CELL);
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const color = editBuffer[y][x];
        if (color) {
          ctx.fillStyle = color;
          ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
        }
      }
    }
    if (showGrid) {
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 1;
      for (let i = 0; i <= SIZE; i++) {
        ctx.beginPath();
        ctx.moveTo(i * CELL + 0.5, 0);
        ctx.lineTo(i * CELL + 0.5, SIZE * CELL);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i * CELL + 0.5);
        ctx.lineTo(SIZE * CELL, i * CELL + 0.5);
        ctx.stroke();
      }
    }
  }, [editBuffer, showGrid]);

  // Window dragging
  useEffect(() => {
    const onMove = (e) => {
      if (!dragRef.current) return;
      setPos({
        x: Math.max(0, dragRef.current.origX + (e.clientX - dragRef.current.startX)),
        y: Math.max(0, dragRef.current.origY + (e.clientY - dragRef.current.startY))
      });
    };
    const onUp = () => { dragRef.current = null; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  // Coalesce live-preview updates to at most one per animation frame so that a
  // continuous stroke doesn't trigger a full rescan on every mouse move.
  const liveRAFRef = useRef(null);
  const liveSnapRef = useRef(null);
  const syncBuffer = useCallback(() => {
    const snap = bufferRef.current.map(r => [...r]);
    setEditBuffer(snap);
    if (livePreview && tileId != null) {
      liveSnapRef.current = snap;
      if (liveRAFRef.current == null) {
        liveRAFRef.current = requestAnimationFrame(() => {
          liveRAFRef.current = null;
          setLiveTilePreview({ tileId, data: liveSnapRef.current });
        });
      }
    }
  }, [livePreview, tileId, setLiveTilePreview]);

  const applyBrushAt = useCallback((cx, cy, erase) => {
    const color = erase ? null : (currentColor || null);
    if (!color && !erase) return;
    const base = [{ x: cx, y: cy, color }];
    let pixels = getBrushPixels(base, drawWidth, brushType, colorJitter);
    pixels = getSymmetricPixels(pixels, SIZE, SIZE, symmetryMode);
    pixels.forEach(p => {
      const x = p.x, y = p.y;
      if (x < 0 || x > 7 || y < 0 || y > 7) return;
      let c = p.color || null;
      if (c && brushOpacity < 100) {
        const existing = bufferRef.current[y][x];
        c = blendHexColors(existing || '#000000', c, brushOpacity / 100);
      }
      bufferRef.current[y][x] = c;
    });
  }, [currentColor, drawWidth, brushType, colorJitter, symmetryMode, brushOpacity, getBrushPixels, getSymmetricPixels]);

  const cellFromEvent = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / CELL);
    const y = Math.floor((e.clientY - rect.top) / CELL);
    return [x < 0 ? 0 : x > 7 ? 7 : x, y < 0 ? 0 : y > 7 ? 7 : y];
  };

  const onMouseDown = (e) => {
    e.preventDefault();
    const [x, y] = cellFromEvent(e);
    if (tool === 'fill') {
      const grid = bufferRef.current.map(r => [...r]);
      floodFill(grid, x, y, currentColor || null);
      bufferRef.current = grid;
      syncBuffer();
      return;
    }
    drawingRef.current = { active: true, lastX: x, lastY: y, startX: x, startY: y };
    if (tool === 'pen' || tool === 'eraser') {
      applyBrushAt(x, y, tool === 'eraser');
      syncBuffer();
    }
  };

  const onMouseMove = (e) => {
    const d = drawingRef.current;
    if (!d.active) return;
    const [x, y] = cellFromEvent(e);
    if (tool === 'pen' || tool === 'eraser') {
      let lx = d.lastX, ly = d.lastY;
      const dx = Math.abs(x - lx), dy = Math.abs(y - ly);
      const sx = lx < x ? 1 : -1, sy = ly < y ? 1 : -1;
      let err = dx - dy;
      while (true) {
        applyBrushAt(lx, ly, tool === 'eraser');
        if (lx === x && ly === y) break;
        const e2 = 2 * err;
        if (e2 > -dy) { err -= dy; lx += sx; }
        if (e2 < dx) { err += dx; ly += sy; }
      }
      d.lastX = x; d.lastY = y;
      syncBuffer();
    }
  };

  const onMouseUp = () => {
    const d = drawingRef.current;
    if (!d.active) return;
    drawingRef.current = { active: false, lastX: null, lastY: null, startX: null, startY: null };
  };

  const cancelLiveRAF = () => {
    if (liveRAFRef.current != null) {
      cancelAnimationFrame(liveRAFRef.current);
      liveRAFRef.current = null;
    }
  };

  const handleSave = () => {
    if (!tileEditor) return;
    cancelLiveRAF();
    const id = tileEditor.tileId;
    const data = bufferRef.current.map(r => [...r]);
    const updated = savedTiles.map(t => String(t.id) === String(id) ? { ...t, data } : t);
    commitTileEdit(id, data);
    setTileEditor(null);
    saveHistory('Edit Tile', layers, dimensions, { savedTiles: updated });
  };

  const handleClose = () => {
    cancelLiveRAF();
    setLiveTilePreview(null);
    setTileEditor(null);
  };

  const handleLivePreviewToggle = (v) => {
    setLivePreview(v);
    if (v && tileId != null) {
      cancelLiveRAF();
      setLiveTilePreview({ tileId, data: bufferRef.current.map(r => [...r]) });
    } else {
      cancelLiveRAF();
      setLiveTilePreview(null);
    }
  };

  if (!tileEditor) return null;

  const activeTile = getTileById(tileId);

  return createPortal(
    <div
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        zIndex: 90000,
        width: '300px',
        background: '#1d1d1f',
        border: '1px solid #4CAF50',
        borderRadius: '8px',
        boxShadow: '0 12px 40px rgba(0,0,0,0.7)',
        color: '#eee',
        fontFamily: 'sans-serif',
        userSelect: 'none',
        overflow: 'hidden'
      }}
    >
      {/* Header (draggable) */}
      <div
        onMouseDown={(e) => {
          dragRef.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y };
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '8px 10px',
          background: '#2a2a2c',
          borderBottom: '1px solid #3c3c3c',
          cursor: 'move'
        }}
      >
        <BsArrowsMove style={{ color: '#888', flexShrink: 0 }} size={14} />
        <span style={{ fontWeight: 'bold', fontSize: '12px', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          Edit Tile: {activeTile?.name || tileId}
        </span>
        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: '#aaa', cursor: 'pointer' }} title="Live Preview (updates the canvas where this tile is used)">
          <BsEye size={12} /> Live
          <input type="checkbox" checked={livePreview} onChange={(e) => handleLivePreviewToggle(e.target.checked)} style={{ margin: 0, cursor: 'pointer' }} />
        </label>
        <button onClick={handleSave} title="Save" style={{ background: '#4CAF50', border: 'none', color: '#fff', borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '11px' }}>Save</button>
        <button onClick={handleClose} title="Close (discard changes)" style={{ background: '#444', border: 'none', color: '#fff', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', fontSize: '12px' }}>✕</button>
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', padding: '8px 10px', borderBottom: '1px solid #3c3c3c', alignItems: 'center' }}>
        {TOOLS.map(t => (
          <button
            key={t.id}
            onClick={() => setTool(t.id)}
            title={t.label}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '28px', height: '28px',
              background: tool === t.id ? '#4CAF50' : '#333',
              border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer'
            }}
          >
            {t.icon ? <t.icon size={14} /> : <span style={{ fontSize: '9px' }}>{t.label.slice(0, 3)}</span>}
          </button>
        ))}
      </div>

      {/* Palette swatches (no color picker) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 10px', borderBottom: '1px solid #3c3c3c' }}>
        <span style={{ fontSize: '10px', color: '#aaa', flexShrink: 0 }}>Palette</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxWidth: '210px' }}>
          {(recentColors || []).slice(0, 32).map((c, i) => (
            <div
              key={i}
              onClick={() => setCurrentColor(c)}
              title={c}
              style={{ width: '16px', height: '16px', background: c, border: currentColor === c ? '2px solid #fff' : '1px solid #555', borderRadius: '2px', cursor: 'pointer', flexShrink: 0 }}
            />
          ))}
        </div>
      </div>

      {/* Canvas */}
      <div style={{ display: 'flex', justifyContent: 'center', padding: '10px' }}>
        <canvas
          ref={canvasRef}
          width={SIZE * CELL}
          height={SIZE * CELL}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          style={{ width: SIZE * CELL, height: SIZE * CELL, imageRendering: 'pixelated', border: '1px solid #555', borderRadius: '4px', cursor: tool === 'eraser' ? 'cell' : 'crosshair', background: '#000' }}
        />
      </div>
    </div>,
    document.body
  );
};

export default TileEditor;
