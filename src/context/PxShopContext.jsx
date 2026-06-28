/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import JSZip from 'jszip';
import { readPsd, writePsd } from 'ag-psd';
import { API_BASE_URL } from '../config';
import { RAW_DEFAULT_TILES, DEFAULT_16_PALETTE, BUTANO_COLLISION_ENUMS } from './constants';
import {
  isPointInPolygon, combineCellsToRectangles, compress8bitNumberArray,
  hexToRgb, rgbToHsl, hslToRgb, rgbToHex, adjustHslHex,
  adjustBrightnessContrastHex, blendHexColors, invertHex, getNextZoom,
  parseColorTo32, generateWav, cloneLayersForHistory, createEmptyLayer,
  getClosestPaletteColor, filterSimilarColors, generateUniqueId, sortColorsByHue
} from './utils';
import { generateButano } from './codegen/butano';
import { generateFormat, getFormatLabel, getFormatFilename } from './codegen/formats';
import { hexToRgbLocal } from './codegen/shared';
import { useHistory } from './hooks/useHistory';
import { useImportImage } from './hooks/useImportImage';

export function getLuminance(hex) {
  if (!hex || hex === 'transparent') return 0;
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16) || 0;
  const g = parseInt(clean.substring(2, 4), 16) || 0;
  const b = parseInt(clean.substring(4, 6), 16) || 0;
  return r * 0.299 + g * 0.587 + b * 0.114;
}

export function getDarkestColor(palette) {
  if (!palette || palette.length === 0) return '#000000';
  let darkest = palette[0];
  let minL = getLuminance(darkest);
  for (let i = 1; i < palette.length; i++) {
    const l = getLuminance(palette[i]);
    if (l < minL) {
      minL = l;
      darkest = palette[i];
    }
  }
  return darkest;
}

export function getLightestColor(palette) {
  if (!palette || palette.length === 0) return '#ffffff';
  let lightest = palette[0];
  let maxL = getLuminance(lightest);
  for (let i = 1; i < palette.length; i++) {
    const l = getLuminance(palette[i]);
    if (l > maxL) {
      maxL = l;
      lightest = palette[i];
    }
  }
  return lightest;
}

export function getEffectiveLayerCount(layersList) {
  if (!layersList) return 0;
  const groupVisibility = {};
  layersList.forEach(l => {
    if (l.type === 'group') groupVisibility[String(l.id)] = l.visible;
  });

  let normalCount = 0;
  const specialGroups = new Set();
  let specialUngroupedCount = 0;

  layersList.forEach(l => {
    if (l.type === 'group' || !l.visible) return;
    if (l.groupId) {
      const parentGroup = layersList.find(g => g.id === l.groupId);
      if (parentGroup && !parentGroup.visible) return;
    }
    const isGroupVisible = l.groupId ? groupVisibility[String(l.groupId)] !== false : true;
    if (!isGroupVisible) return;

    if (l.parallax || l.affine) {
      if (l.groupId) {
        specialGroups.add(String(l.groupId));
      } else {
        specialUngroupedCount++;
      }
    } else {
      normalCount++;
    }
  });

  return (normalCount > 0 ? 1 : 0) + specialGroups.size + specialUngroupedCount;
}

const PxShopContext = createContext(null);

export const usePxShop = () => {
  const context = useContext(PxShopContext);
  if (!context) throw new Error("usePxShop must be used within a PxShopProvider");
  return context;
};



let sharedOffCanvas = null;
let sharedOutlineCanvas = null;
let sharedPCanvas = null;

export const INITIAL_DEFAULT_TILES = RAW_DEFAULT_TILES.map(tile => ({
  ...tile,
  data: tile.data.map(row => row.map(color => color ? getClosestPaletteColor(color, DEFAULT_16_PALETTE) : null))
}));

export const PxShopProvider = ({ children }) => {
  // Basic state
  const [showNewProjectOnStartup, setShowNewProjectOnStartup] = useState(() => {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('px_shop_show_new_project');
      return saved !== null ? saved === 'true' : true;
    }
    return true;
  });
  const [showVideoPlayerDialog, setShowVideoPlayerDialog] = useState(false);
  const [videoPlayerSource, setVideoPlayerSource] = useState('walkthrough');
  const [showNewProjectDialog, setShowNewProjectDialog] = useState(showNewProjectOnStartup);
  const [newProjectSettings, setNewProjectSettings] = useState({ w: 256, h: 256, bgColor: '#fff1e8', transparentBg: false });
  const [showWizardDialog, setShowWizardDialog] = useState(false);
  const [wizardSettings, setWizardSettings] = useState({ topdown: 1, platformer: 1, metroidvania: 1, pointnclick: 1, shmup: 1, racing: 1, beatemup: 1, intro: 2, pause: true, randomBg: true, globalPlayer: true, generateLevels: true });
  const [dimensions, setDimensions] = useState({ w: 256, h: 256 });
  const dimensionsRef = useRef(dimensions);
  dimensionsRef.current = dimensions;
  const [maintainAspectRatio, setMaintainAspectRatio] = useState(true);
  const [sizeInput, setSizeInput] = useState({ w: dimensions.w, h: dimensions.h });

  const [prevDimensions, setPrevDimensions] = useState(dimensions);
  if (dimensions.w !== prevDimensions.w || dimensions.h !== prevDimensions.h) {
    setPrevDimensions(dimensions);
    setSizeInput({ w: dimensions.w, h: dimensions.h });
  }

  const handleResizeImage = (newW, newH) => {
    if (newW === dimensions.w && newH === dimensions.h) return;
    if (newW < 1 || newH < 1) {
      setSizeInput({ w: dimensions.w, h: dimensions.h });
      return;
    }

    const resizeLayers = (layerList) => layerList.map(l => {
      if (l.type === 'group') return l;
      const oldH = l.data?.length || 0;
      const oldW = l.data?.[0]?.length || 0;

      const newData = Array(newH).fill(null).map((_, y) => {
        const row = Array(newW).fill(null);
        const srcY = Math.min(oldH - 1, Math.floor((y / newH) * oldH));
        const srcRow = l.data?.[srcY];
        if (!srcRow) return row;
        for (let x = 0; x < newW; x++) {
          const srcX = Math.min(oldW - 1, Math.floor((x / newW) * oldW));
          row[x] = srcRow[srcX] || null;
        }
        return row;
      });
      return { ...l, data: newData };
    });

    const nextFrames = frames.map(f => ({ ...f, layers: resizeLayers(f.layers) }));
    setFrames(nextFrames);
    const newLayers = nextFrames.find(f => f.id === activeFrameId).layers;
    setLayers(newLayers);
    setDimensions({ w: newW, h: newH });
    saveHistory("Resize Image", newLayers, { w: newW, h: newH });

    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        const availableW = rect.width - 60;
        const availableH = rect.height - 60;
        setZoom(Math.max(0.1, Math.min(4, Math.min(availableW / newW, availableH / newH))));
        setPanOffset({ x: 0, y: 0 });
      }
    }
  };

  const [zoom, setZoom] = useState(10);
  const [isPixelated, setIsPixelated] = useState(true);
  const [activeDraw, setActiveDraw] = useState('pen');
  const [showDrawMenu, setShowDrawMenu] = useState(false);
  const [activeGameTool, setActiveGameTool] = useState('actor');
  const [showGameMenu, setShowGameMenu] = useState(false);
  const [tool, setTool] = useState('grab');
  const [brushType, setBrushType] = useState('round');
  const [colorJitter, setColorJitter] = useState(0);
  const [brushOpacity, setBrushOpacity] = useState(100);
  const [currentColor, setCurrentColor] = useState('#000000');
  const [secondaryColor, setSecondaryColor] = useState('#fff1e8');
  const [recentColors, setRecentColors] = useState(DEFAULT_16_PALETTE);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawWidth, setDrawWidth] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0 });

  // Tools state
  const [selection, setSelection] = useState(null);
  const [selectionStart, setSelectionStart] = useState(null);
  const [moveOffset, setMoveOffset] = useState({ x: 0, y: 0 });
  const [gridSize, setGridSize] = useState(8);
  const [showGridMenu, setShowGridMenu] = useState(false);
  const [clipboard, setClipboard] = useState(null);
  const [transformData, setTransformData] = useState(null);
  const [isResizing, setIsResizing] = useState(false);
  const [showAboutDialog, setShowAboutDialog] = useState(false);
  const [textSettings, setTextSettings] = useState({ text: "", size: 12, font: "'Roboto', sans-serif", customFont: "", x: 0, y: 0, bold: false, italic: false, align: 'left', outline: false, outlineColor: '#000000' });
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
  const [showFileMenu, setShowFileMenu] = useState(false);
  const [activeShape, setActiveShape] = useState('drawCircle');
  const [showShapesMenu, setShowShapesMenu] = useState(false);
  const [activeFill, setActiveFill] = useState('fill');
  const [showFillsMenu, setShowFillsMenu] = useState(false);
  const [lassoPath, setLassoPath] = useState([]);
  const [activeSelection, setActiveSelection] = useState('rect');
  const [showSelectionsMenu, setShowSelectionsMenu] = useState(false);
  const [activeModifySelection, setActiveModifySelection] = useState('adjust');
  const [showModifySelectionMenu, setShowModifySelectionMenu] = useState(false);
  const [symmetryMode, setSymmetryMode] = useState('none');
  const [showSymmetryMenu, setShowSymmetryMenu] = useState(false);
  const [isShiftPressed, setIsShiftPressed] = useState(false);

  // UI Enhancements state
  const [viewportSize, setViewportSize] = useState({ w: 0, h: 0 });
  const [isNavDragging, setIsNavDragging] = useState(false);
  const [guides, setGuides] = useState({ x: [], y: [] });
  const [draggingGuide, setDraggingGuide] = useState(null);
  const navigatorRef = useRef(null);
  const rulerXRef = useRef(null);
  const rulerYRef = useRef(null);

  // Tiles state
  const [savedTiles, setSavedTiles] = useState(INITIAL_DEFAULT_TILES);
  const [activeSavedTileId, setActiveSavedTileId] = useState(1);
  const tileSheetInputRef = useRef(null);

  // Tile import palette choices
  const [showTileImportPaletteDialog, setShowTileImportPaletteDialog] = useState(false);
  const [pendingTileImportData, setPendingTileImportData] = useState(null);

  // Sidebar panel layout states
  const [activeCol1Panel, setActiveCol1Panel] = useState(() => {
    const saved = localStorage.getItem('px_shop_activeCol1Panel');
    return saved !== null ? (saved === '' ? null : saved) : 'layers';
  });

  const [activeCol2Panel, setActiveCol2Panel] = useState(() => {
    const saved = localStorage.getItem('px_shop_activeCol2Panel');
    return saved !== null ? (saved === '' ? null : saved) : 'actors';
  });

  const [activeCol3Panel, setActiveCol3Panel] = useState(() => {
    const saved = localStorage.getItem('px_shop_activeCol3Panel');
    return saved !== null ? (saved === '' ? null : saved) : 'music';
  });

  const [showWelcomeTour, setShowWelcomeTour] = useState(false);
  const [showGbaMask, setShowGbaMask] = useState(true);

  const [hudSettings, setHudSettings] = useState({
    enabled: true,
    position: 'top',
    width: 30, // 30 tiles (240px)
    height: 2,  // 2 tiles (16px)
    backgroundColor: null,
    textColor: getLightestColor(DEFAULT_16_PALETTE),
    alignment: 'left',
    spacing: 'space-between',
    verticalText: false,
    displayItems: [
      { id: 'item_hp', tileId: 21, text: 'x {PLAYER_HP}' },
      { id: 'item_bonus', tileId: 5, text: 'x {PLAYER_BONUS}' }
    ]
  });

  useEffect(() => {
    if (recentColors && recentColors.length > 0) {
      setHudSettings(prev => {
        const lightest = getLightestColor(recentColors);
        
        let needsUpdate = false;
        const newSettings = { ...prev };
        
        if (!prev.textColor || !recentColors.includes(prev.textColor)) {
          newSettings.textColor = lightest;
          needsUpdate = true;
        }
        
        return needsUpdate ? newSettings : prev;
      });
    }
  }, [recentColors]);

  useEffect(() => {
    localStorage.setItem('px_shop_activeCol1Panel', activeCol1Panel || '');
  }, [activeCol1Panel]);

  useEffect(() => {
    localStorage.setItem('px_shop_activeCol2Panel', activeCol2Panel || '');
  }, [activeCol2Panel]);

  useEffect(() => {
    localStorage.setItem('px_shop_activeCol3Panel', activeCol3Panel || '');
  }, [activeCol3Panel]);

  // Unified Game Assets Export state
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportLevelName, setExportLevelName] = useState('game');
  const [exportLevelType, setExportLevelType] = useState('TOPDOWN');
  const [exportFormat, setExportFormat] = useState('butano');
  const [showEmulatorDialog, setShowEmulatorDialog] = useState(false);
  const [isPublishingRom, setIsPublishingRom] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [showHtml5ExportDialog, setShowHtml5ExportDialog] = useState(false);
  const [html5BgColor, setHtml5BgColor] = useState('#1a1a2e');
  const [html5ContainerColor, setHtml5ContainerColor] = useState('#16213e');


  // Scenes state
  const [scenes, setScenes] = useState(() => [{
    id: 'scene-1',
    name: 'Scene 1',
    frames: [{
      id: 'frame-1',
      layers: [createEmptyLayer('Background', null, 240, 160)]
    }],
    actors: [],
    triggers: [],
    musicId: null,
    dimensions: { w: 240, h: 160 },
    worldX: 0,
    worldY: 0,
    script: { nodes: [{ id: 'start', position: { x: 250, y: 100 }, data: { label: 'On Start' }, type: 'input' }], edges: [] }
  }]);
  const [activeSceneId, setActiveSceneId] = useState('scene-1');
  const scenesRef = useRef(scenes);
  const activeSceneIdRef = useRef(activeSceneId);
  useEffect(() => { scenesRef.current = scenes; }, [scenes]);
  useEffect(() => { activeSceneIdRef.current = activeSceneId; }, [activeSceneId]);
  const [showLevelGenDialog, setShowLevelGenDialog] = useState(false);
  const [levelGenSceneId, setLevelGenSceneId] = useState(null);

  // Frames state
  const [frames, setFrames] = useState(() => scenes[0].frames);
  const [activeFrameId, setActiveFrameId] = useState('frame-1');

  // Music state
  const [musicTracks, setMusicTracks] = useState([]);
  const [editingMusicTrackId, setEditingMusicTrackId] = useState(null);

  // Variables state (Project-wide)
  const [variables, setVariables] = useState([
    { id: 9, type: 'group', name: 'PLAYER', isOpen: true },
    { id: 1, name: 'PLAYER_HP', type: 'number', initialValue: 10, groupId: 9 },
    { id: 2, name: 'PLAYER_BONUS', type: 'number', initialValue: 0, groupId: 9 },
    { id: 3, name: 'PLAYER_KEYS', type: 'number', initialValue: 0, groupId: 9 },
    { id: 4, name: 'PLAYER_AMMO', type: 'number', initialValue: 100, groupId: 9 },
    { id: 5, name: 'PLAYER_MAX_AMMO', type: 'number', initialValue: 100, groupId: 9 },
    { id: 6, name: 'PLAYER_GRENADES', type: 'number', initialValue: 0, groupId: 9 },
    { id: 7, name: 'PLAYER_MAGNET', type: 'number', initialValue: 0, groupId: 9 },
    { id: 8, name: 'PLAYER_XP', type: 'number', initialValue: 0, groupId: 9 }
  ]);

  // Animations state (Project-wide)
  const [animations, setAnimations] = useState([]);

  // Custom Scripts state (Project-wide)
  const [customScripts, setCustomScripts] = useState([]);
  const [editingCustomScriptId, setEditingCustomScriptId] = useState(null);

  // Global Script state (Project-wide)
  const [globalScript, setGlobalScript] = useState({ nodes: [{ id: 'start', position: { x: 250, y: 100 }, data: { label: 'On Update' }, type: 'input' }], edges: [] });
  const [editingGlobalScript, setEditingGlobalScript] = useState(false);

  // Credits tracking
  const [includedArtists, setIncludedArtists] = useState([]);
  const [includeCreditsScene, setIncludeCreditsScene] = useState(true);
  const [creditsText, setCreditsText] = useState('');
  const [creditsBgColor, setCreditsBgColor] = useState(null);
  const [creditsTextColor, setCreditsTextColor] = useState(null);
  const [creditsMusicId, setCreditsMusicId] = useState(null);
  const [creditsEffect, setCreditsEffect] = useState('none');

  const addOgaArtist = useCallback((name) => {
    if (!name || name === 'Unknown') return;
    setIncludedArtists(prev => prev.some(a => a.name === name) ? prev : [...prev, { name, source: 'opengameart' }]);
  }, []);

  const addModArchiveArtist = useCallback((name) => {
    if (!name || name === 'Unknown') return;
    setIncludedArtists(prev => prev.some(a => a.name === name) ? prev : [...prev, { name, source: 'modarchive' }]);
  }, []);

  // Triggers state
  const [triggers, setTriggers] = useState(() => scenes[0].triggers || []);
  const [activeTriggerId, setActiveTriggerId] = useState(null);
  const [editingScriptTriggerId, setEditingScriptTriggerId] = useState(null);
  const [tempPaintedTriggers, setTempPaintedTriggers] = useState([]);
  const [isPaintingTriggers, setIsPaintingTriggers] = useState(false);

  // Collisions state
  const [collisions, setCollisions] = useState(() => scenes[0].collisions || []);
  const [activeCollisionId, setActiveCollisionId] = useState(null);
  const [tempPaintedCollisions, setTempPaintedCollisions] = useState([]);
  const [isPaintingCollisions, setIsPaintingCollisions] = useState(false);

  // Onion skin
  const [onionSkinEnabled, setOnionSkinEnabled] = useState(false);

  // Layers state
  const [layers, setLayers] = useState(() => frames[0].layers);
  const [actors, setActors] = useState(() => scenes[0].actors || []);
  const [globalActors, setGlobalActors] = useState([]);
  const globalActorsRef = useRef(globalActors);
  useEffect(() => { globalActorsRef.current = globalActors; }, [globalActors]);
  const [activeActorId, setActiveActorId] = useState(null);
  const [editingScriptActorId, setEditingScriptActorId] = useState(null);
  const [editingScriptSceneId, setEditingScriptSceneId] = useState(null);
  const [activeLayerId, setActiveLayerId] = useState('background-layer');
  const [editingLayerId, setEditingLayerId] = useState(null);
  const [viewActiveOnly, setViewActiveOnly] = useState(false);
  const [editingTextLayerId, setEditingTextLayerId] = useState(null);

  const [draggedLayerId, setDraggedLayerId] = useState(null);
  const [dragOverLayerId, setDragOverLayerId] = useState(null);
  const [dragPosition, setDragPosition] = useState(null);

  const {
    history, setHistory, historyIndex, setHistoryIndex,
    saveHistory, jumpToHistory, undo, redo
  } = useHistory({
    layers, dimensions, savedTiles, scenes, actors, globalActors, triggers, collisions,
    variables, animations, customScripts, globalScript, musicTracks,
    activeSceneId, frames, activeFrameId, activeLayerId,
    hudSettings, setHudSettings,
    setLayers, setDimensions, setSavedTiles, setScenes, setActors, setGlobalActors, setTriggers,
    setCollisions, setVariables, setAnimations, setCustomScripts, setGlobalScript,
    setMusicTracks, setActiveSceneId, setFrames, setActiveFrameId, setActiveLayerId
  });

  // Sync layers to the active frame
  useEffect(() => {
    setFrames(prev => {
      const frame = prev.find(f => f.id === activeFrameId);
      if (frame && frame.layers === layers) return prev;
      return prev.map(f => f.id === activeFrameId ? { ...f, layers } : f);
    });
  }, [layers, activeFrameId]);

  // Sync frames, actors, triggers, collisions, dimensions to the active scene
  useEffect(() => {
    setScenes(prev => {
      const scene = prev.find(s => s.id === activeSceneId);
      if (scene && scene.frames === frames && scene.actors === actors && scene.triggers === triggers && scene.collisions === collisions && scene.dimensions === dimensions) return prev;
      return prev.map(s => s.id === activeSceneId ? { ...s, frames, actors, triggers, collisions, dimensions } : s);
    });
  }, [frames, actors, triggers, collisions, dimensions, activeSceneId]);

  // Warnings state
  const [warnings, setWarnings] = useState([]);
  const [dismissedWarnings, setDismissedWarnings] = useState([]);
  const [hideWarningBadge, setHideWarningBadge] = useState(false);

  useEffect(() => {
    const newWarnings = [];

    // Memory / Size limits
    if (dimensions.w > 512 || dimensions.h > 512) {
      newWarnings.push(`Large dimensions (${dimensions.w}x${dimensions.h}px). Small regular backgrounds must be square or rectangular: 256x256, 256x512, 512x256, or 512x512 pixels. Larger sizes will force a Big Map with CPU penalties.`);
    } else if (![256, 512].includes(dimensions.w) || ![256, 512].includes(dimensions.h)) {
      newWarnings.push(`Dimensions (${dimensions.w}x${dimensions.h}px) are non-standard. Small regular backgrounds must be square or rectangular: 256x256, 256x512, 512x256, or 512x512 pixels. Unused space will be padded.`);
    }

    // Color limits
    const uniqueColors = new Set();
    layers.forEach(l => {
      if (l.type === 'group' || !l.visible || !l.data) return;
      l.data.forEach(row => {
        row.forEach(color => {
          if (color) uniqueColors.add(color);
        });
      });
    });

    if (uniqueColors.size > 256) {
      newWarnings.push(`Color count exceeds GBA 8BPP limit (256 colors). Current: ${uniqueColors.size}`);
    }

    // Unique 8x8 tiles limit (1024 unique tiles max for regular background)
    const groupVisibility = {};
    layers.forEach(l => {
      if (l.type === 'group') groupVisibility[String(l.id)] = l.visible;
    });

    const flattened = Array.from({ length: dimensions.h }, () => Array(dimensions.w).fill(null));

    // Iterate in reverse (bottom layer to top layer) to overlay them
    [...layers].reverse().forEach(layer => {
      if (layer.type === 'group' || !layer.data) return;
      const isGroupVisible = layer.groupId ? groupVisibility[String(layer.groupId)] !== false : true;
      if (!layer.visible || !isGroupVisible) return;

      for (let y = 0; y < dimensions.h; y++) {
        const row = layer.data[y];
        if (!row) continue;
        for (let x = 0; x < dimensions.w; x++) {
          const color = row[x];
          if (color) {
            flattened[y][x] = color;
          }
        }
      }
    });

    const uniqueTiles = new Set();
    const cols = Math.floor(dimensions.w / 8);
    const rows = Math.floor(dimensions.h / 8);

    for (let ty = 0; ty < rows; ty++) {
      for (let tx = 0; tx < cols; tx++) {
        let tileKey = '';
        for (let py = 0; py < 8; py++) {
          const y = ty * 8 + py;
          for (let px = 0; px < 8; px++) {
            const x = tx * 8 + px;
            const color = flattened[y]?.[x] || 'transparent';
            tileKey += color + ',';
          }
        }
        uniqueTiles.add(tileKey);
      }
    }

    if (uniqueTiles.size > 1024) {
      newWarnings.push(`Scene contains too many unique 8x8 tiles (${uniqueTiles.size}). GBA hardware limit is 1024 unique tiles for a regular background.`);
    }

    // Sprite Limits
    if (actors.length > 128) {
      newWarnings.push(`Total actors (${actors.length}) exceeds GBA hardware limit of 128 sprites on screen.`);
    }

    const scanlines = new Array(dimensions.h).fill(0);
    actors.forEach(actor => {
      const startY = Math.max(0, Math.floor(actor.y));
      const endY = Math.min(dimensions.h - 1, Math.floor(actor.y + (actor.height || 16)));
      for (let y = startY; y <= endY; y++) {
        scanlines[y]++;
      }
    });

    const maxScanlineSprites = Math.max(0, ...scanlines);
    if (maxScanlineSprites > 32) {
      newWarnings.push(`Too many actors on a single horizontal line. GBA limit is 32 per scanline, but found ${maxScanlineSprites} overlapping.`);
    }

    // Layer count limits (GBA has 4 BG slots; HUD uses 1)
    const hudEnabled = hudSettings && hudSettings.enabled;
    const maxLayers = hudEnabled ? 2 : 3;
    scenes.filter(s => s.type !== 'group').forEach(scene => {
      let sceneLayers;
      if (scene.id === activeSceneId) {
        sceneLayers = layers;
      } else {
        let sceneFrames = scene.frames;
        if (!sceneFrames || sceneFrames.length === 0) {
          sceneLayers = scene.layers || [];
        } else {
          sceneLayers = sceneFrames[0]?.layers || [];
        }
      }

      const count = getEffectiveLayerCount(sceneLayers);
      if (count > maxLayers) {
        newWarnings.push(`Scene "${scene.name}" has too many background layers (${count}/${maxLayers}). ${hudEnabled ? 'HUD is enabled, which uses 1 BG slot.' : ''} Merge layers into groups to prevent game crashes or disable the HUD.`);
      }
    });

    setWarnings(newWarnings);
  }, [layers, actors, dimensions, hudSettings, scenes, activeSceneId]);

  const activeLayer = layers.find(l => l.id === activeLayerId);
  const canvasRef = useRef(null);
  const selectionRef = useRef(null);
  const containerRef = useRef(null);
  const projectInputRef = useRef(null);

  const {
    imageInputRef, importLayerInputRef, paletteInputRef,
    showImportPaletteDialog, setShowImportPaletteDialog,
    pendingImportColors, setPendingImportColors,
    paletteImportFileName, setPaletteImportFileName,
    showPaletteConvertDialog, setShowPaletteConvertDialog,
    pendingConvertData, setPendingConvertData,
    handleImageUpload, handlePaletteUpload, confirmPaletteImport,
    confirmPaletteConvert, importFileAsLayer, handleImportToLayer
  } = useImportImage({
    dimensions, layers, activeLayerId, recentColors,
    setDimensions, setLayers, setActiveLayerId, setZoom, setPanOffset,
    setRecentColors, currentColor, setCurrentColor,
    saveHistory, containerRef,
    savedTiles, setSavedTiles,
    scenes, setScenes,
    secondaryColor, setSecondaryColor,
    hudSettings, setHudSettings,
    creditsBgColor, setCreditsBgColor,
    creditsTextColor, setCreditsTextColor,
    textSettings, setTextSettings
  });

  const isDrawingRef = useRef(false);
  const [fxLayerId, setFxLayerId] = useState(null);

  const updateLayerProp = (id, prop, value) => {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, [prop]: value } : l));
  };

  const handleDragStart = (e, id) => {
    e.stopPropagation();
    setDraggedLayerId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, targetId) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedLayerId === targetId) return;

    setDragOverLayerId(targetId);
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const targetLayer = layers.find(l => l.id === targetId);

    if (targetLayer.type === 'group') {
      if (y < rect.height * 0.25) setDragPosition('before');
      else if (y > rect.height * 0.75) setDragPosition('after');
      else setDragPosition('inside');
    } else {
      if (y < rect.height * 0.5) setDragPosition('before');
      else setDragPosition('after');
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverLayerId(null);
    setDragPosition(null);
  };

  const handleDrop = (e, targetId) => {
    e.preventDefault();
    e.stopPropagation();

    if (!draggedLayerId || draggedLayerId === targetId) {
      setDraggedLayerId(null);
      setDragOverLayerId(null);
      setDragPosition(null);
      return;
    }

    const draggedIndex = layers.findIndex(l => l.id === draggedLayerId);
    const targetIndex = layers.findIndex(l => l.id === targetId);
    if (draggedIndex === -1 || targetIndex === -1) return;

    const draggedLayer = layers[draggedIndex];
    const targetLayer = layers[targetIndex];

    if (draggedLayer.type === 'group') {
      const isTargetChild = targetLayer.groupId && String(targetLayer.groupId) === String(draggedLayer.id);
      if (isTargetChild) {
        setDraggedLayerId(null);
        setDragOverLayerId(null);
        setDragPosition(null);
        return;
      }
    }

    let itemsToMove = [draggedLayer];
    if (draggedLayer.type === 'group') {
      itemsToMove = [draggedLayer, ...layers.filter(l => l.groupId && String(l.groupId) === String(draggedLayer.id))];
    }

    let nextLayers = layers.filter(l => !itemsToMove.find(item => item.id === l.id));

    let newTargetIndex = nextLayers.findIndex(l => l.id === targetId);
    let newGroupId = draggedLayer.groupId;

    if (targetLayer.type === 'group') {
      if (dragPosition === 'inside' && draggedLayer.type !== 'group') {
        newGroupId = targetLayer.id;
        nextLayers.splice(newTargetIndex + 1, 0, { ...draggedLayer, groupId: newGroupId });
      } else {
        newGroupId = targetLayer.groupId;
        const insertIndex = dragPosition === 'before' ? newTargetIndex : newTargetIndex + 1;
        nextLayers.splice(insertIndex, 0, ...itemsToMove.map(item => item.id === draggedLayer.id ? { ...item, groupId: draggedLayer.type === 'group' ? null : newGroupId } : item));
      }
    } else {
      newGroupId = targetLayer.groupId;
      const insertIndex = dragPosition === 'before' ? newTargetIndex : newTargetIndex + 1;
      nextLayers.splice(insertIndex, 0, ...itemsToMove.map(item => item.id === draggedLayer.id ? { ...item, groupId: draggedLayer.type === 'group' ? null : newGroupId } : item));
    }

    setLayers(nextLayers);
    saveHistory("Reorder Layers", nextLayers);

    setDraggedLayerId(null);
    setDragOverLayerId(null);
    setDragPosition(null);
  };

  const applyMaskToLayer = (id) => {
    if (!selection) return;
    const newLayers = layers.map(l => {
      if (l.id !== id || l.type === 'group') return l;
      const newData = l.data.map((row, y) => row.map((color, x) => selection.has(`${x},${y}`) ? color : null));
      return { ...l, data: newData, textData: null };
    });
    setLayers(newLayers);
    saveHistory("Apply Mask", newLayers);
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setViewportSize({ w: width, h: height });
      const dims = dimensionsRef.current;
      if (dims.w > 0 && dims.h > 0 && width > 0 && height > 0) {
        const availableW = width - 60;
        const availableH = height - 60;
        const fitZoom = Math.min(availableW / dims.w, availableH / dims.h);
        setZoom(Math.max(0.1, Math.min(4, fitZoom)));
        setPanOffset({ x: 0, y: 0 });
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const MAX_NAV_W = 280;
  const MAX_NAV_H = 150;
  const navScale = viewportSize.w > 0 ? Math.min(MAX_NAV_W / dimensions.w, MAX_NAV_H / dimensions.h) : 1;
  const canvasDisplayW = dimensions.w * zoom;
  const canvasDisplayH = dimensions.h * zoom;
  const viewX = (viewportSize.w / 2) - (canvasDisplayW / 2) + panOffset.x;
  const viewY = (viewportSize.h / 2) - (canvasDisplayH / 2) + panOffset.y;

  const navBox = {
    x: (-viewX / zoom) * navScale,
    y: (-viewY / zoom) * navScale,
    w: viewportSize.w > 0 ? (viewportSize.w / zoom) * navScale : 0,
    h: viewportSize.h > 0 ? (viewportSize.h / zoom) * navScale : 0
  };

  const updatePanFromNav = useCallback((e) => {
    if (!navigatorRef.current) return;
    const rect = navigatorRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const newPanX = ((dimensions.w / 2) * navScale - x) * zoom / navScale;
    const newPanY = ((dimensions.h / 2) * navScale - y) * zoom / navScale;

    setPanOffset({ x: newPanX, y: newPanY });
  }, [dimensions, navScale, zoom]);

  useEffect(() => {
    const handleMouseUp = () => {
      if (isNavDragging) setIsNavDragging(false);
      if (draggingGuide) {
        if (draggingGuide.val !== null) {
          if (draggingGuide.axis === 'x') {
            if (draggingGuide.val >= 0 && draggingGuide.val <= dimensions.w) {
              setGuides(prev => ({ ...prev, x: [...new Set([...prev.x, draggingGuide.val])] }));
            }
          } else {
            if (draggingGuide.val >= 0 && draggingGuide.val <= dimensions.h) {
              setGuides(prev => ({ ...prev, y: [...new Set([...prev.y, draggingGuide.val])] }));
            }
          }
        }
        setDraggingGuide(null);
      }
    };

    const handleMouseMove = (e) => {
      if (isNavDragging) updatePanFromNav(e);

      if (draggingGuide && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        let val;
        if (draggingGuide.axis === 'x') {
          val = Math.round((mouseX - viewX) / zoom);
        } else {
          val = Math.round((mouseY - viewY) / zoom);
        }
        setDraggingGuide({ ...draggingGuide, val });
      }
    };

    if (isNavDragging || draggingGuide) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isNavDragging, updatePanFromNav, draggingGuide, dimensions, zoom, viewX, viewY]);

  useEffect(() => {
    const loadFont = async (fontFamily) => {
      if (!fontFamily) return;
      const cleanFontName = fontFamily.split(',')[0].replace(/['"]/g, '').trim();
      if (['monospace', 'sans-serif', 'serif', 'Impact', 'custom'].indexOf(cleanFontName) === -1) {
        const linkId = `font-${cleanFontName.replace(/\s+/g, '-').toLowerCase()}`;
        if (!document.getElementById(linkId)) {
          const link = document.createElement('link');
          link.id = linkId;
          link.rel = 'stylesheet';
          link.href = `https://fonts.googleapis.com/css2?family=${cleanFontName.replace(/\s+/g, '+')}&display=swap`;
          document.head.appendChild(link);
        }
      }
      try { await document.fonts.load(`12px ${fontFamily}`); } catch { // Ignore font load error
      }
    };

    if (textSettings.font === 'custom' && textSettings.customFont) loadFont(`'${textSettings.customFont}', sans-serif`);
    else loadFont(textSettings.font);
  }, [textSettings.font, textSettings.customFont]);

  const getShapePixels = useCallback((toolType, startX, startY, endX, endY) => {
    const pixels = [];
    const minX = Math.min(startX, endX);
    const maxX = Math.max(startX, endX);
    const minY = Math.min(startY, endY);
    const maxY = Math.max(startY, endY);

    if (toolType === 'drawLine') {
      let x0 = startX;
      let y0 = startY;
      let x1 = endX;
      let y1 = endY;

      const dx = Math.abs(x1 - x0);
      const dy = Math.abs(y1 - y0);
      const sx = (x0 < x1) ? 1 : -1;
      const sy = (y0 < y1) ? 1 : -1;
      let err = dx - dy;

      while (true) {
        pixels.push({ x: x0, y: y0 });
        if ((x0 === x1) && (y0 === y1)) break;
        const e2 = 2 * err;
        if (e2 > -dy) { err -= dy; x0 += sx; }
        if (e2 < dx) { err += dx; y0 += sy; }
      }
    } else if (toolType === 'drawRoundRect' || toolType === 'drawRoundRectFill') {
      const w = maxX - minX;
      const h = maxY - minY;
      const r = Math.max(0, Math.min(Math.floor(w / 4), Math.floor(h / 4), 8));

      if (r === 0) {
        for (let y = minY; y <= maxY; y++) {
          for (let x = minX; x <= maxX; x++) {
            if (toolType === 'drawRoundRectFill' || x === minX || x === maxX || y === minY || y === maxY) {
              pixels.push({ x, y });
            }
          }
        }
        return pixels;
      }

      const isInsideRR = (x, y) => {
        if (x < minX || x > maxX || y < minY || y > maxY) return false;
        if (x >= minX + r && x <= maxX - r) return true;
        if (y >= minY + r && y <= maxY - r) return true;
        const cx = x < minX + r ? minX + r : maxX - r;
        const cy = y < minY + r ? minY + r : maxY - r;
        return Math.pow(x - cx, 2) + Math.pow(y - cy, 2) <= r * r;
      };

      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          if (isInsideRR(x, y)) {
            pixels.push({ x, y });
          }
        }
      }

      if (toolType === 'drawRoundRect') {
        return pixels.filter(p => !isInsideRR(p.x - 1, p.y) || !isInsideRR(p.x + 1, p.y) || !isInsideRR(p.x, p.y - 1) || !isInsideRR(p.x, p.y + 1));
      }
    } else if (toolType === 'drawRect' || toolType === 'drawRectFill') {
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          if (toolType === 'drawRectFill' || x === minX || x === maxX || y === minY || y === maxY) {
            pixels.push({ x, y });
          }
        }
      }
    } else if (toolType === 'drawCircle' || toolType === 'drawCircleFill') {
      const rx = (maxX - minX) / 2;
      const ry = (maxY - minY) / 2;
      const cx = minX + rx;
      const cy = minY + ry;

      if (rx === 0 && ry === 0) return [{ x: minX, y: minY }];

      const isInside = (x, y) => {
        const dx = x - cx;
        const dy = y - cy;
        return ((rx === 0 ? 0 : (dx * dx) / (rx * rx)) + (ry === 0 ? 0 : (dy * dy) / (ry * ry))) <= 1;
      };

      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          if (isInside(x, y)) {
            pixels.push({ x, y });
          }
        }
      }

      if (toolType === 'drawCircle') {
        return pixels.filter(p => !isInside(p.x - 1, p.y) || !isInside(p.x + 1, p.y) || !isInside(p.x, p.y - 1) || !isInside(p.x, p.y + 1));
      }
    }
    return pixels;
  }, []);

  const getGradientPixels = useCallback((startX, startY, endX, endY) => {
    const pixels = [];
    const rgb1 = hexToRgb(currentColor);
    const rgb2 = hexToRgb(secondaryColor);
    if (!rgb1 || !rgb2) return pixels;

    const dx = endX - startX;
    const dy = endY - startY;
    const lenSq = dx * dx + dy * dy;

    for (let y = 0; y < dimensions.h; y++) {
      for (let x = 0; x < dimensions.w; x++) {
        if (selection && selection.size > 0 && !selection.has(`${x},${y}`)) continue;
        let t = 0;
        if (lenSq > 0) {
          const dot = (x - startX) * dx + (y - startY) * dy;
          t = Math.max(0, Math.min(1, dot / lenSq));
        }
        const r = Math.round(rgb1.r + t * (rgb2.r - rgb1.r));
        const g = Math.round(rgb1.g + t * (rgb2.g - rgb1.g));
        const b = Math.round(rgb1.b + t * (rgb2.b - rgb1.b));
        const hex = "#" + (1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1);
        pixels.push({ x, y, color: hex });
      }
    }
    return pixels;
  }, [dimensions, selection, currentColor, secondaryColor]);

  const getSymmetricPixels = useCallback((pixels, w, h, mode) => {
    if (mode === 'none') return pixels;
    const res = [...pixels];
    const len = pixels.length;
    for (let i = 0; i < len; i++) {
      const p = pixels[i];
      if (mode === 'horizontal' || mode === 'both') {
        res.push({ ...p, x: w - 1 - p.x });
      }
      if (mode === 'vertical' || mode === 'both') {
        res.push({ ...p, y: h - 1 - p.y });
      }
      if (mode === 'both') {
        res.push({ ...p, x: w - 1 - p.x, y: h - 1 - p.y });
      }
    }
    return res;
  }, []);

  const getBrushPixels = useCallback((pixels, width, type, jitterAmount = 0) => {
    if (width <= 1 && (type === 'round' || type === 'square') && jitterAmount === 0) return pixels;
    const brushPixels = new Map();
    const half = Math.floor(width / 2);
    const offsetStart = -half;
    const offsetEnd = width % 2 === 0 ? half - 1 : half;

    pixels.forEach(p => {
      if (type === 'spray') {
        const count = width * 2;
        for (let i = 0; i < count; i++) {
          const dx = Math.floor(Math.random() * width) - half;
          const dy = Math.floor(Math.random() * width) - half;
          if (width >= 5 && (dx * dx + dy * dy > (width / 2) * (width / 2))) continue;

          let speckleColor = p.color;
          if (jitterAmount > 0 && speckleColor) {
            const dh = (Math.random() * 2 - 1) * jitterAmount;
            const ds = (Math.random() * 2 - 1) * (jitterAmount / 2);
            const dl = (Math.random() * 2 - 1) * (jitterAmount / 2);
            speckleColor = adjustHslHex(speckleColor, dh, ds, dl);
          }
          brushPixels.set(`${p.x + dx},${p.y + dy}`, speckleColor);
        }
        return;
      }

      let dabColor = p.color;
      if (jitterAmount > 0 && dabColor) {
        const dh = (Math.random() * 2 - 1) * jitterAmount;
        const ds = (Math.random() * 2 - 1) * (jitterAmount / 2);
        const dl = (Math.random() * 2 - 1) * (jitterAmount / 2);
        dabColor = adjustHslHex(dabColor, dh, ds, dl);
      }

      for (let dy = offsetStart; dy <= offsetEnd; dy++) {
        for (let dx = offsetStart; dx <= offsetEnd; dx++) {
          const px = p.x + dx;
          const py = p.y + dy;

          if (type === 'round') {
            if (width >= 5 && (dx * dx + dy * dy > (width / 2) * (width / 2))) continue;
          } else if (type === 'dither') {
            if (width >= 5 && (dx * dx + dy * dy > (width / 2) * (width / 2))) continue;
            if ((px + py) % 2 !== 0) continue;
          } else if (type === 'calligraphy') {
            if (Math.abs(dx + dy) > Math.max(1, Math.floor(width / 4))) continue;
          }
          brushPixels.set(`${px},${py}`, dabColor);
        }
      }
    });
    return Array.from(brushPixels.entries()).map(([pt, color]) => {
      const [x, y] = pt.split(',').map(Number);
      return { x, y, color };
    });
  }, []);

  const switchFrame = useCallback((id, skipHistory = false) => {
    if (id === activeFrameId) return;
    const frame = frames.find(f => f.id === id);
    if (!frame) return;
    setLayers(frame.layers);
    setActiveLayerId(frame.layers.find(l => l.type !== 'group')?.id || frame.layers[0]?.id);
    setActiveFrameId(id);
    setSelection(null);
    if (!skipHistory) {
      saveHistory("Switch Frame", frame.layers, dimensions, {
        activeFrameId: id,
        activeLayerId: frame.layers.find(l => l.type !== 'group')?.id || frame.layers[0]?.id
      });
    }
  }, [frames, activeFrameId, dimensions, saveHistory]);

  const addFrame = useCallback(() => {
    const newLayer = createEmptyLayer('Background', null, dimensions.w, dimensions.h);
    const newFrame = {
      id: Date.now() + Math.random(),
      layers: [newLayer]
    };
    setFrames(prev => [...prev, newFrame]);
    setActiveFrameId(newFrame.id);
    setLayers(newFrame.layers);
    setActiveLayerId(newLayer.id);
    saveHistory("Add Frame", newFrame.layers, dimensions, {
      frames: [...frames, newFrame],
      activeFrameId: newFrame.id,
      activeLayerId: newLayer.id
    });
  }, [dimensions, frames, saveHistory]);

  const duplicateFrame = useCallback((id) => {
    const frameToCopy = frames.find(f => f.id === id);
    if (!frameToCopy) return;
    const deepClone = JSON.parse(JSON.stringify(frameToCopy));
    const idMap = {};
    deepClone.layers.forEach(l => {
      const newId = Date.now() + Math.random();
      idMap[l.id] = newId;
      l.id = newId;
    });
    deepClone.layers.forEach(l => {
      if (l.groupId && idMap[l.groupId]) {
        l.groupId = idMap[l.groupId];
      }
    });
    deepClone.id = Date.now() + Math.random();

    let nextFrames;
    setFrames(prev => {
      const idx = prev.findIndex(f => f.id === id);
      const next = [...prev];
      next.splice(idx + 1, 0, deepClone);
      nextFrames = next;
      return next;
    });
    setActiveFrameId(deepClone.id);
    setLayers(deepClone.layers);
    setActiveLayerId(deepClone.layers.find(l => l.type !== 'group')?.id || deepClone.layers[0]?.id);
    saveHistory("Duplicate Frame", deepClone.layers, dimensions, {
      frames: nextFrames,
      activeFrameId: deepClone.id,
      activeLayerId: deepClone.layers.find(l => l.type !== 'group')?.id || deepClone.layers[0]?.id
    });
  }, [frames, dimensions, saveHistory]);

  const deleteFrame = useCallback((id) => {
    if (frames.length <= 1) return;
    const newFrames = frames.filter(f => f.id !== id);
    setFrames(newFrames);
    if (activeFrameId === id) {
      const frame = newFrames[0];
      setActiveFrameId(frame.id);
      setLayers(frame.layers);
      setActiveLayerId(frame.layers.find(l => l.type !== 'group')?.id || frame.layers[0]?.id);
      saveHistory("Delete Frame", frame.layers, dimensions, {
        frames: newFrames,
        activeFrameId: frame.id,
        activeLayerId: frame.layers.find(l => l.type !== 'group')?.id || frame.layers[0]?.id
      });
    } else {
      saveHistory("Delete Frame", layers, dimensions, { frames: newFrames });
    }
  }, [frames, activeFrameId, dimensions, saveHistory, layers]);

  const switchScene = useCallback((id) => {
    if (id === activeSceneId) return;
    const scene = scenes.find(s => s.id === id);
    if (!scene || scene.type === 'group') return;

    let sceneFrames = scene.frames;
    if (!sceneFrames || sceneFrames.length === 0) {
      sceneFrames = [{ id: 'frame-1', layers: scene.layers || [] }];
    }

    setFrames(sceneFrames);
    setActiveFrameId(sceneFrames[0].id);
    setLayers(sceneFrames[0].layers);
    setActors(scene.actors || []);
    setTriggers(scene.triggers || []);
    setCollisions(scene.collisions || []);
    setActiveActorId(null);
    setActiveTriggerId(null);
    setActiveCollisionId(null);
    setDimensions(scene.dimensions);
    setActiveLayerId(sceneFrames[0].layers.find(l => l.type !== 'group')?.id || sceneFrames[0].layers[0]?.id);
    setActiveSceneId(id);
    setSelection(null);
    saveHistory("Switch Scene", sceneFrames[0].layers, scene.dimensions, {
      activeSceneId: id,
      frames: sceneFrames,
      activeFrameId: sceneFrames[0].id,
      layers: sceneFrames[0].layers,
      activeLayerId: sceneFrames[0].layers.find(l => l.type !== 'group')?.id || sceneFrames[0].layers[0]?.id,
      actors: scene.actors || [],
      triggers: scene.triggers || [],
      collisions: scene.collisions || []
    });
  }, [scenes, activeSceneId, saveHistory]);

  const addScene = useCallback(() => {
    const actualScenes = scenes.filter(s => s.type !== 'group');
    const newDims = dimensions ? { w: dimensions.w, h: dimensions.h } : { w: 240, h: 160 };
    const newLayer = createEmptyLayer('Background', null, newDims.w, newDims.h);
    const newFrame = { id: 'frame-1', layers: [newLayer] };
    const newScene = {
      id: Date.now() + Math.random(),
      name: `Scene ${actualScenes.length + 1}`,
      frames: [newFrame],
      globalActorIds: [],
      globalActorPositions: {},
      actors: [{
        id: Date.now() + Math.random(),
        name: 'Player',
        type: 'player',
        x: Math.floor(newDims.w / 2 / 8) * 8,
        y: Math.floor(newDims.h / 2 / 8) * 8,
        width: 8,
        height: 8,
        color: '#65ff00',
        spriteId: 1,
        isHidden: false,
        hflip: true,
        attackAnimId: null,
        script: { nodes: [{ id: 'start', position: { x: 250, y: 100 }, data: { label: 'On Update' }, type: 'input' }], edges: [] }
      }],
      triggers: [],
      collisions: [],
      musicId: null,
      dimensions: newDims,
      worldX: 0,
      worldY: 0,
      script: { nodes: [{ id: 'start', position: { x: 250, y: 100 }, data: { label: 'On Start' }, type: 'input' }], edges: [] }
    };
    const nextScenes = [...scenes, newScene];
    setScenes(nextScenes);

    setFrames(newScene.frames);
    setActiveFrameId(newScene.frames[0].id);
    setLayers(newScene.frames[0].layers);
    setActors(newScene.actors);
    setTriggers(newScene.triggers);
    setCollisions(newScene.collisions);
    setActiveActorId(null);
    setActiveTriggerId(null);
    setActiveCollisionId(null);
    setDimensions(newScene.dimensions);
    const newActiveLayerId = newScene.frames[0].layers.find(l => l.type !== 'group')?.id || newScene.frames[0].layers[0]?.id;
    setActiveLayerId(newActiveLayerId);
    setActiveSceneId(newScene.id);
    setSelection(null);

    setLevelGenSceneId(newScene.id);
    setShowLevelGenDialog(true);

    saveHistory("Add Scene", newScene.frames[0].layers, newScene.dimensions, {
      scenes: nextScenes,
      activeSceneId: newScene.id,
      frames: newScene.frames,
      activeFrameId: newScene.frames[0].id,
      layers: newScene.frames[0].layers,
      activeLayerId: newActiveLayerId,
      actors: newScene.actors,
      triggers: newScene.triggers,
      collisions: newScene.collisions
    });
  }, [scenes, layers, dimensions, saveHistory, setScenes, setFrames, setActiveFrameId, setLayers, setActors, setTriggers, setCollisions, setActiveActorId, setActiveTriggerId, setActiveCollisionId, setDimensions, setActiveLayerId, setActiveSceneId, setSelection, setLevelGenSceneId, setShowLevelGenDialog]);

  const deleteScene = useCallback((id) => {
    const actualScenes = scenes.filter(s => s.type !== 'group');
    if (actualScenes.length <= 1) return;
    const newScenes = scenes.filter(s => s.id !== id);
    setScenes(newScenes);
    if (activeSceneId === id) {
      const scene = newScenes[0];
      let sceneFrames = scene.frames;
      if (!sceneFrames || sceneFrames.length === 0) {
        sceneFrames = [{ id: 'frame-1', layers: scene.layers || [] }];
      }
      setFrames(sceneFrames);
      setActiveFrameId(sceneFrames[0].id);
      setLayers(sceneFrames[0].layers);
      setActors(scene.actors || []);
      setTriggers(scene.triggers || []);
      setCollisions(scene.collisions || []);
      setActiveActorId(null);
      setActiveTriggerId(null);
      setActiveCollisionId(null);
      setDimensions(scene.dimensions);
      setActiveLayerId(sceneFrames[0].layers.find(l => l.type !== 'group')?.id || sceneFrames[0].layers[0]?.id);
      setActiveSceneId(scene.id);
      setSelection(null);
      saveHistory("Delete Scene", sceneFrames[0].layers, scene.dimensions, {
        scenes: newScenes,
        activeSceneId: scene.id,
        frames: sceneFrames,
        activeFrameId: sceneFrames[0].id,
        layers: sceneFrames[0].layers,
        activeLayerId: sceneFrames[0].layers.find(l => l.type !== 'group')?.id || sceneFrames[0].layers[0]?.id,
        actors: scene.actors || [],
        triggers: scene.triggers || [],
        collisions: scene.collisions || []
      });
    } else {
      saveHistory("Delete Scene", layers, dimensions, { scenes: newScenes });
    }
  }, [scenes, activeSceneId, layers, dimensions, saveHistory]);

  const toggleGlobalActorInScene = useCallback((actorId) => {
    setScenes(prev => {
      const updated = prev.map(s => {
        if (s.id !== activeSceneId) return s;
        const ids = s.globalActorIds || [];
        const adding = !ids.includes(actorId);
        const next = adding ? [...ids, actorId] : ids.filter(id => id !== actorId);
        let scene = { ...s, globalActorIds: next };
        if (adding) {
          const globalActor = globalActors.find(a => a.id === actorId);
          if (globalActor && globalActor.type === 'player') {
            scene.actors = (s.actors || []).filter(a => a.type !== 'player');
          }
        }
        return scene;
      });
      const activeScene = updated.find(s => s.id === activeSceneId);
      if (activeScene && activeScene.actors) {
        setActors(activeScene.actors);
      }
      return updated;
    });
  }, [activeSceneId, globalActors]);

  const setGlobalActorPosition = useCallback((actorId, x, y) => {
    setScenes(prev => prev.map(s => {
      if (s.id !== activeSceneId) return s;
      const positions = { ...(s.globalActorPositions || {}) };
      positions[actorId] = { x, y };
      return { ...s, globalActorPositions: positions };
    }));
  }, [activeSceneId]);

  const renameScene = useCallback((id, newName) => {
    const nextScenes = scenes.map(s => s.id === id ? { ...s, name: newName } : s);
    setScenes(nextScenes);
    saveHistory("Rename Scene", layers, dimensions, { scenes: nextScenes });
  }, [scenes, layers, dimensions, saveHistory]);

  const duplicateScene = useCallback((id) => {
    const sceneToCopy = scenes.find(s => s.id === id);
    if (!sceneToCopy) return;

    const deepClone = JSON.parse(JSON.stringify(sceneToCopy));
    const idMap = {};
    if (!deepClone.frames) {
      deepClone.frames = [{ id: Date.now() + Math.random(), layers: deepClone.layers }];
      delete deepClone.layers;
    }

    deepClone.frames.forEach(f => {
      f.id = Date.now() + Math.random();
      const localIdMap = {};
      f.layers.forEach(l => {
        const newId = Date.now() + Math.random() + Math.random();
        localIdMap[l.id] = newId;
        l.id = newId;
      });
      f.layers.forEach(l => {
        if (l.groupId && localIdMap[l.groupId]) {
          l.groupId = localIdMap[l.groupId];
        }
      });
    });

    deepClone.actors = (deepClone.actors || []).map(a => ({ ...a, id: Date.now() + Math.random(), script: a.script ? JSON.parse(JSON.stringify(a.script)) : { nodes: [], edges: [] } }));
    deepClone.triggers = (deepClone.triggers || []).map(t => ({ ...t, id: Date.now() + Math.random(), script: t.script ? JSON.parse(JSON.stringify(t.script)) : { nodes: [], edges: [] } }));

    const newScene = {
      ...deepClone,
      id: Date.now() + Math.random(),
      name: `${sceneToCopy.name} (Copy)`,
      worldX: (sceneToCopy.worldX || 0) + 16,
      worldY: (sceneToCopy.worldY || 0) + 16
    };
    setScenes(prev => {
      const idx = prev.findIndex(s => s.id === id);
      const next = [...prev];
      next.splice(idx + 1, 0, newScene);
      saveHistory("Duplicate Scene", layers, dimensions, { scenes: next });
      return next;
    });
  }, [scenes, layers, dimensions, saveHistory]);

  const addSceneGroup = useCallback(() => {
    const actualScenes = scenes.filter(s => s.type !== 'group');
    const newGroup = {
      id: Date.now() + Math.random(),
      type: 'group',
      name: `Group ${scenes.filter(s => s.type === 'group').length + 1}`,
      isOpen: true
    };
    const nextScenes = [...scenes, newGroup];
    setScenes(nextScenes);
    saveHistory("Add Scene Group", layers, dimensions, { scenes: nextScenes });
  }, [scenes, layers, dimensions, saveHistory]);

  const toggleSceneGroup = useCallback((groupId) => {
    const nextScenes = scenes.map(s => s.id === groupId ? { ...s, isOpen: !s.isOpen } : s);
    setScenes(nextScenes);
    saveHistory("Toggle Scene Group", layers, dimensions, { scenes: nextScenes });
  }, [scenes, layers, dimensions, saveHistory]);

  const deleteSceneGroup = useCallback((groupId) => {
    const actualScenes = scenes.filter(s => s.type !== 'group' && s.id !== groupId && String(s.groupId) !== String(groupId));
    if (actualScenes.length === 0) return;
    const nextScenes = scenes.filter(s => s.id !== groupId && String(s.groupId) !== String(groupId));
    setScenes(nextScenes);
    if (activeSceneId) {
      const deletedScene = scenes.find(s => s.id === activeSceneId && (s.id === groupId || String(s.groupId) === String(groupId)));
      if (deletedScene) {
        const remaining = nextScenes.filter(s => s.type !== 'group');
        if (remaining.length > 0) {
          const scene = remaining[0];
          let sceneFrames = scene.frames;
          if (!sceneFrames || sceneFrames.length === 0) {
            sceneFrames = [{ id: 'frame-1', layers: scene.layers || [] }];
          }
          setFrames(sceneFrames);
          setActiveFrameId(sceneFrames[0].id);
          setLayers(sceneFrames[0].layers);
          setActors(scene.actors || []);
          setTriggers(scene.triggers || []);
          setCollisions(scene.collisions || []);
          setActiveActorId(null);
          setActiveTriggerId(null);
          setActiveCollisionId(null);
          setDimensions(scene.dimensions);
          setActiveLayerId(sceneFrames[0].layers.find(l => l.type !== 'group')?.id || sceneFrames[0].layers[0]?.id);
          setActiveSceneId(scene.id);
          setSelection(null);
        }
      }
    }
    saveHistory("Delete Scene Group", layers, dimensions, { scenes: nextScenes });
  }, [scenes, activeSceneId, layers, dimensions, saveHistory]);

  const duplicateSceneGroup = useCallback((groupId) => {
    const groupItem = scenes.find(s => s.id === groupId);
    if (!groupItem) return;
    const newGroupId = Date.now() + Math.random();
    const childScenes = scenes.filter(s => String(s.groupId) === String(groupId));
    const newGroup = { ...groupItem, id: newGroupId, name: `${groupItem.name} (Copy)` };
    const duplicatedChildren = childScenes.map((s, idx) => {
      const cloned = JSON.parse(JSON.stringify(s));
      cloned.id = Date.now() + Math.random() + idx;
      cloned.groupId = newGroupId;
      cloned.name = `${s.name} (Copy)`;
      if (cloned.frames) {
        cloned.frames.forEach(f => {
          f.id = Date.now() + Math.random() + Math.random();
          const localIdMap = {};
          f.layers.forEach(l => {
            const newId = Date.now() + Math.random() + Math.random();
            localIdMap[l.id] = newId;
            l.id = newId;
          });
          f.layers.forEach(l => {
            if (l.groupId && localIdMap[l.groupId]) {
              l.groupId = localIdMap[l.groupId];
            }
          });
        });
      }
      cloned.actors = (cloned.actors || []).map(a => ({ ...a, id: Date.now() + Math.random(), script: a.script ? JSON.parse(JSON.stringify(a.script)) : { nodes: [], edges: [] } }));
      cloned.triggers = (cloned.triggers || []).map(t => ({ ...t, id: Date.now() + Math.random(), script: t.script ? JSON.parse(JSON.stringify(t.script)) : { nodes: [], edges: [] } }));
      return cloned;
    });
    const groupIndex = scenes.findIndex(s => s.id === groupId);
    const nextScenes = [...scenes];
    nextScenes.splice(groupIndex + 1 + childScenes.length, 0, newGroup, ...duplicatedChildren);
    setScenes(nextScenes);
    saveHistory("Duplicate Scene Group", layers, dimensions, { scenes: nextScenes });
  }, [scenes, layers, dimensions, saveHistory]);

  const renameSceneGroup = useCallback((groupId, newName) => {
    const nextScenes = scenes.map(s => s.id === groupId ? { ...s, name: newName } : s);
    setScenes(nextScenes);
    saveHistory("Rename Scene Group", layers, dimensions, { scenes: nextScenes });
  }, [scenes, layers, dimensions, saveHistory]);

  const generateLevelForScene = useCallback(async (sceneId, config) => {
    const currentScenes = scenesRef.current;
    const scene = currentScenes.find(s => s.id === sceneId);
    if (!scene) return;

    const cfg = config || {};
    const newDims = {
      w: (cfg.width != null) ? cfg.width : (scene.dimensions?.w || 256),
      h: (cfg.height != null) ? cfg.height : (scene.dimensions?.h || 256)
    };
    const cols = Math.floor(newDims.w / 8);
    const rows = Math.floor(newDims.h / 8);

    if (cols <= 0 || rows <= 0) return;

    let updatedPalette = recentColors && recentColors.length > 0 ? recentColors : DEFAULT_16_PALETTE;

    const isActive = sceneId === activeSceneIdRef.current;
    const baseCollisions = scene.collisions || [];
    const baseTriggers = scene.triggers || [];

    const filteredCollisions = baseCollisions.filter(c => !c.isGenerated);
    const filteredTriggers = baseTriggers.filter(t => !t.isGenerated);

    let updatedCollisions = [...filteredCollisions];
    let updatedTriggers = [...filteredTriggers];

    const targetFrame = scene.frames && scene.frames[0] ? scene.frames[0] : null;
    if (!targetFrame) return;

    const newLayerData = Array(newDims.h).fill(null).map(() => Array(newDims.w).fill(null));
    let cloudLayer = null;
    let skyBgLayer = null;
    let caveBgLayer = null;
    let platformCloudLayer = null;

    const sceneType = (scene.type || 'TOPDOWN').toUpperCase();

    const findTileStr = (names, tileId, fallbackIdx = 0) => {
      const tilesList = savedTiles && savedTiles.length > 0 ? savedTiles : INITIAL_DEFAULT_TILES;
      if (tileId != null && tileId !== '') {
        const byId = tilesList.find(t => String(t.id) === String(tileId)) || INITIAL_DEFAULT_TILES.find(t => String(t.id) === String(tileId));
        if (byId) return byId;
      }
      for (const name of names) {
        const found = tilesList.find(t => t.name.toLowerCase().includes(name.toLowerCase())) || 
                      INITIAL_DEFAULT_TILES.find(t => t.name.toLowerCase().includes(name.toLowerCase()));
        if (found) return found;
      }
      return tilesList[fallbackIdx] || tilesList[0] || INITIAL_DEFAULT_TILES[0];
    };

    const tileGrid = Array(rows).fill(null).map(() => Array(cols).fill(null));

    // cfg is defined above
    const waterSizeMultiplier = cfg.waterBodySize !== undefined && cfg.waterBodySize !== '' && !isNaN(parseFloat(cfg.waterBodySize)) ? parseFloat(cfg.waterBodySize) / 100 : 0.16;
    const gapTriggerCells = [];

    if (sceneType === 'TOPDOWN') {
      // 1. Water Block (one cluster) - randomized size and location
      const waterCX = Math.floor(cols * (0.15 + Math.random() * 0.7));
      const waterCY = Math.floor(rows * (0.15 + Math.random() * 0.7));
      const waterRadius = Math.min(cols, rows) * (waterSizeMultiplier + Math.random() * 0.08);

      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const dx = x - waterCX;
          const dy = y - waterCY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const noise = (Math.sin(x * 1.5) * Math.cos(y * 1.5) + Math.cos(x * 0.7) * Math.sin(y * 0.7)) * 0.8;
          if (dist + noise < waterRadius) {
            tileGrid[y][x] = 'water';
          }
        }
      }

      // 2. Walkways (Mud Block) - Winding road in a single direction (avoiding water)
      const generateHorizontal = cfg.pathDirection === 'both' || cfg.pathDirection === 'ew' || (cfg.pathDirection === 'random' && Math.random() > 0.5);
      const generateVertical = cfg.pathDirection === 'both' || cfg.pathDirection === 'ns' || (cfg.pathDirection === 'random' && !generateHorizontal);

      if (generateHorizontal) {
        let y = Math.floor(rows * (0.35 + Math.random() * 0.3));
        for (let x = 0; x < cols; x++) {
          if (tileGrid[y][x] !== 'water') tileGrid[y][x] = 'mud';
          if (y + 1 < rows && tileGrid[y + 1][x] !== 'water') tileGrid[y + 1][x] = 'mud';
          
          // Smoothly wind the path every few steps
          if (x % 3 === 0 && Math.random() > 0.4) {
            const dir = Math.random() > 0.5 ? 1 : -1;
            if (y + dir >= 2 && y + dir < rows - 3) {
              y += dir;
              if (tileGrid[y][x] !== 'water') tileGrid[y][x] = 'mud';
              if (y + 1 < rows && tileGrid[y + 1][x] !== 'water') tileGrid[y + 1][x] = 'mud';
            }
          }
        }
      }
      if (generateVertical) {
        let x = Math.floor(cols * (0.35 + Math.random() * 0.3));
        for (let y = 0; y < rows; y++) {
          if (tileGrid[y][x] !== 'water') tileGrid[y][x] = 'mud';
          if (x + 1 < cols && tileGrid[y][x + 1] !== 'water') tileGrid[y][x + 1] = 'mud';
          
          // Smoothly wind the path every few steps
          if (y % 3 === 0 && Math.random() > 0.4) {
            const dir = Math.random() > 0.5 ? 1 : -1;
            if (x + dir >= 2 && x + dir < cols - 3) {
              x += dir;
              if (tileGrid[y][x] !== 'water') tileGrid[y][x] = 'mud';
              if (x + 1 < cols && tileGrid[y][x + 1] !== 'water') tileGrid[y][x + 1] = 'mud';
            }
          }
        }
      }

      // 3. Sand Block clusters (around water beach)
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          if (tileGrid[y][x] === 'water' || tileGrid[y][x] === 'mud') continue;
          
          let nearWater = false;
          // Randomize beach width check slightly
          const checkDist = Math.random() > 0.3 ? 2 : 1;
          for (let dy = -checkDist; dy <= checkDist; dy++) {
            for (let dx = -checkDist; dx <= checkDist; dx++) {
              const ny = y + dy;
              const nx = x + dx;
              if (ny >= 0 && ny < rows && nx >= 0 && nx < cols) {
                if (tileGrid[ny][nx] === 'water') {
                  nearWater = true;
                  break;
                }
              }
            }
            if (nearWater) break;
          }
          
          if (nearWater) {
            tileGrid[y][x] = 'sand';
          }
        }
      }

      // Separate sand cluster (random location)
      const sandCX = Math.floor(cols * (0.15 + Math.random() * 0.7));
      const sandCY = Math.floor(rows * (0.15 + Math.random() * 0.7));
      const sandRadius = Math.min(cols, rows) * (0.08 + Math.random() * 0.08);
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          if (tileGrid[y][x] && tileGrid[y][x] !== 'grass') continue;
          const dx = x - sandCX;
          const dy = y - sandCY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const noise = (Math.sin(x * 2) + Math.cos(y * 2)) * 0.5;
          if (dist + noise < sandRadius) {
            tileGrid[y][x] = 'sand';
          }
        }
      }

      // Fill remaining with grass
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          if (!tileGrid[y][x]) {
            tileGrid[y][x] = 'grass';
          }
        }
      }

      // Draw the tiles
      const grassTile = findTileStr(['grass block', 'grass'], cfg.grassTileId, 0);
      const sandTile = findTileStr(['sand block', 'sand'], cfg.sandTileId, 1);
      const waterTile = findTileStr(['water block', 'water'], cfg.waterTileId, 2);
      const mudTile = findTileStr(['mud block', 'mud'], cfg.mudTileId, 3);

      for (let ty = 0; ty < rows; ty++) {
        for (let tx = 0; tx < cols; tx++) {
          const type = tileGrid[ty][tx];
          let tile = grassTile;
          if (type === 'sand') tile = sandTile;
          if (type === 'water') tile = waterTile;
          if (type === 'mud') tile = mudTile;

          if (tile && tile.data) {
            for (let r = 0; r < 8; r++) {
              for (let c = 0; c < 8; c++) {
                const px = tx * 8 + c;
                const py = ty * 8 + r;
                if (py < newDims.h && px < newDims.w) {
                  newLayerData[py][px] = tile.data[r][c];
                }
              }
            }
          }
        }
      }
    } else if (sceneType === 'BEATEMUP') {
      // Beat 'Em Up level generator
      // 0. Inject background colors for palette
      if (cfg.platformBgType === 'solid' || cfg.platformBgType === 'clouds' || cfg.platformBgType === 'starry') {
        const targetColors = [
          cfg.platformSkyColor,
          cfg.platformCloudColor1,
          cfg.platformCloudColor2,
          cfg.platformStarColor
        ].filter(Boolean);
        let paletteChanged = false;
        const paletteCopy = [...updatedPalette];
        for (const col of targetColors) {
          if (!paletteCopy.includes(col)) {
            const emptyIdx = paletteCopy.indexOf('#000000');
            if (emptyIdx !== -1) {
              paletteCopy[emptyIdx] = col;
              paletteChanged = true;
            }
          }
        }
        if (paletteChanged) {
          updatedPalette = paletteCopy;
        }
      }

      const paletteToUse = updatedPalette;
      const mapColor = (hex) => getClosestPaletteColor(hex, paletteToUse);

      // Get palette-derived colors for fallbacks
      const sortedColors = [...paletteToUse].map(c => ({ hex: c, lum: getLuminance(c) })).sort((a, b) => b.lum - a.lum);
      const lightestPalColor = sortedColors[0]?.hex || '#ffffff';
      const secondLightestPalColor = sortedColors[1]?.hex || sortedColors[0]?.hex || '#ffffff';
      const darkestPalColor = sortedColors[sortedColors.length - 1]?.hex || '#000000';

      const bluePalColor = paletteToUse.find(c => {
        const rgb = hexToRgb(c);
        if (!rgb) return false;
        const { r, g, b } = rgb;
        return b > r && g > r * 0.5 && c.toLowerCase() !== '#000000';
      }) || (sortedColors.find(x => x.lum > 80 && x.lum < 200)?.hex) || lightestPalColor;

      // 1. Build Background layers (sky/clouds/stars/planets) with parallax!
      if (cfg.platformBgType === 'solid' || cfg.platformBgType === 'clouds' || cfg.platformBgType === 'starry') {
        const skyBgLayerData = Array(newDims.h).fill(null).map(() => Array(newDims.w).fill(mapColor(cfg.platformSkyColor || (cfg.platformBgType === 'starry' ? darkestPalColor : bluePalColor))));
        
        let skyLayerName = 'Sky Background';
        let skyParallaxX = 0.5; // Enable parallax
        let skyParallaxY = 0.5;

        if (cfg.platformBgType === 'clouds') {
          skyLayerName = 'Sky & Clouds';
          const cloudCount = 3 + Math.floor(Math.random() * 3);
          const cloudColor1 = mapColor(cfg.platformCloudColor1 || lightestPalColor);
          const cloudColor2 = mapColor(cfg.platformCloudColor2 || secondLightestPalColor);

          for (let i = 0; i < cloudCount; i++) {
            const cx = Math.random() * newDims.w;
            const cy = newDims.h * (0.1 + Math.random() * 0.4); // keep clouds in upper portion
            const size = 12 + Math.random() * 16;
            const puffs = 3 + Math.floor(Math.random() * 2);
            for (let p = 0; p < puffs; p++) {
              const pcx = cx + (p - (puffs - 1) / 2) * (size * 0.6);
              const pcy = cy + (Math.random() - 0.5) * (size * 0.2);
              const pr = size * (0.6 + Math.random() * 0.4);
              
              for (let dy = -pr; dy <= pr; dy++) {
                for (let dx = -pr; dx <= pr; dx++) {
                  const px = Math.round(pcx + dx);
                  const py = Math.round(pcy + dy);
                  if (px >= 0 && px < newDims.w && py >= 0 && py < newDims.h) {
                    const dist = Math.sqrt(dx*dx + dy*dy);
                    if (dist < pr) {
                      const shadeRatio = dist / pr;
                      let color = cloudColor1;
                      if (shadeRatio > 0.6) color = cloudColor2;
                      skyBgLayerData[py][px] = color;
                    }
                  }
                }
              }
            }
          }
        }

        skyBgLayer = {
          id: Date.now() + Math.random() + 0.05,
          textData: null,
          type: 'layer',
          name: skyLayerName,
          visible: true,
          groupId: null,
          data: skyBgLayerData,
          parallax: true,
          parallaxX: skyParallaxX,
          parallaxY: skyParallaxY
        };

        if (cfg.platformBgType === 'starry') {
          const starColorHex = cfg.platformStarColor || lightestPalColor;
          const starColor = mapColor(starColorHex);
          const starCount = 25 + Math.floor(Math.random() * 20);

          for (let i = 0; i < starCount; i++) {
            const sx = Math.floor(Math.random() * newDims.w);
            const sy = Math.floor(Math.random() * (newDims.h * 0.6));
            if (sx >= 0 && sx < newDims.w && sy >= 0 && sy < newDims.h) {
              skyBgLayerData[sy][sx] = starColor;
              if (Math.random() > 0.7) {
                if (sx > 0) skyBgLayerData[sy][sx - 1] = starColor;
                if (sx < newDims.w - 1) skyBgLayerData[sy][sx + 1] = starColor;
                if (sy > 0) skyBgLayerData[sy - 1][sx] = starColor;
                if (sy < newDims.h - 1) skyBgLayerData[sy + 1][sx] = starColor;
              }
            }
          }

          if (cfg.platformPlanets) {
            const planetCount = 1 + Math.floor(Math.random() * 2);
            const maxR = (cfg.platformMaxPlanetSize || 4) * 4;
            const planetColorPool = recentColors && recentColors.length > 1 ? recentColors.slice(2, 8) : [];
            const finalPlanetPool = planetColorPool.length > 0 ? planetColorPool : updatedPalette;

            for (let i = 0; i < planetCount; i++) {
              const pr = 4 + Math.random() * (maxR - 4);
              const pcx = pr + Math.random() * (newDims.w - pr * 2);
              const pcy = pr + Math.random() * (newDims.h * 0.4 - pr);
              const planetHex = finalPlanetPool[Math.floor(Math.random() * finalPlanetPool.length)];
              const rgb = { r: 128, g: 128, b: 128 };
              const clean = planetHex.replace('#', '');
              const num = parseInt(clean, 16);
              if (!isNaN(num)) {
                rgb.r = (num >> 16) & 255;
                rgb.g = (num >> 8) & 255;
                rgb.b = num & 255;
              }
              const hasRing = Math.random() > 0.6 && pr > 10;

              for (let dy = -pr; dy <= pr; dy++) {
                for (let dx = -pr; dx <= pr; dx++) {
                  const px = Math.round(pcx + dx);
                  const py = Math.round(pcy + dy);
                  if (px >= 0 && px < newDims.w && py >= 0 && py < newDims.h) {
                    const dist = Math.sqrt(dx*dx + dy*dy);
                    if (dist < pr) {
                      const lx = -0.5;
                      const ly = -0.5;
                      const nx = dx / pr;
                      const ny = dy / pr;
                      const intensity = 0.5 * (nx * lx + ny * ly + 1.0);
                      
                      let r = Math.round(rgb.r * (0.4 + intensity * 0.9));
                      let g = Math.round(rgb.g * (0.4 + intensity * 0.9));
                      let b = Math.round(rgb.b * (0.4 + intensity * 0.9));
                      r = Math.max(0, Math.min(255, r));
                      g = Math.max(0, Math.min(255, g));
                      b = Math.max(0, Math.min(255, b));
                      const hex = "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
                      skyBgLayerData[py][px] = mapColor(hex);
                    }
                  }
                }
              }

              if (hasRing) {
                const a = pr * 1.5;
                const b = pr * 0.4;
                const angle = -0.2;
                for (let rx = -a; rx <= a; rx++) {
                  const ryVal = b * Math.sqrt(Math.max(0, 1 - (rx*rx) / (a*a)));
                  const points = [
                    { dx: rx * Math.cos(angle) - ryVal * Math.sin(angle), dy: rx * Math.sin(angle) + ryVal * Math.cos(angle) },
                    { dx: rx * Math.cos(angle) + ryVal * Math.sin(angle), dy: rx * Math.sin(angle) - ryVal * Math.cos(angle) }
                  ];
                  points.forEach(pt => {
                    const px = Math.round(pcx + pt.dx);
                    const py = Math.round(pcy + pt.dy);
                    if (px >= 0 && px < newDims.w && py >= 0 && py < newDims.h) {
                      const isBehind = pt.dy < 0 && Math.sqrt(pt.dx*pt.dx + pt.dy*pt.dy) < pr;
                      if (!isBehind) {
                        skyBgLayerData[py][px] = mapColor(secondLightestPalColor);
                      }
                    }
                  });
                }
              }
            }
          }
        }
      }

      // 2. Select street, curb, sidewalk, and building tiles
      const streetTile = findTileStr(['road', 'racing floor', 'stone wall', 'brick'], cfg.streetTileId || cfg.trackTileId, 1);
      const curbTile = findTileStr(['cave wall', 'curb', 'stone wall', 'brick', 'border'], cfg.curbTileId || cfg.borderTileId, 8);
      const sidewalkTile = findTileStr(['conveyor belt', 'sidewalk', 'stone wall', 'brick', 'sand'], cfg.sidewalkTileId, 3);
      const brickTile = findTileStr(['brick', 'stone wall', 'mud'], cfg.brickTileId, 10);
      const brick2Tile = findTileStr(['wood', 'stone wall', 'brick'], cfg.brick2TileId, 9);
      const windowTile = findTileStr(['ice block', 'window', 'glass', 'door'], cfg.windowTileId, 11);
      const doorTile = findTileStr(['locked door', 'door', 'entrance'], cfg.doorTileId, 12);

      // Layout design grid
      const streetStartRow = Math.floor(rows * 2 / 3);
      const curbRow = streetStartRow - 1;
      const sidewalkStartRow = Math.max(0, streetStartRow - 3);
      const buildingBaseRow = sidewalkStartRow - 1;

      // Fill remaining rows (top) with building base blocks initially
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          if (y >= streetStartRow) {
            tileGrid[y][x] = 'street';
          } else if (y === curbRow) {
            tileGrid[y][x] = 'curb';
          } else if (y >= sidewalkStartRow) {
            tileGrid[y][x] = 'sidewalk';
          }
        }
      }

      // Procedural buildings
      let x = 0;
      let firstBuilding = true;
      while (x < cols) {
        if (!firstBuilding) {
          x += 1;
          if (x >= cols) break;
        }
        firstBuilding = false;

        const bWidth = 6 + Math.floor(Math.random() * 5); // 6 to 10 tiles wide
        const bHeight = 8 + Math.floor(Math.random() * 5); // 8 to 12 tiles tall
        const bTopRow = Math.max(0, buildingBaseRow - bHeight + 1);

        const useSecondType = Math.random() > 0.5;
        const wallTileType = useSecondType ? 'brick2' : 'brick';

        for (let bx = 0; bx < bWidth; bx++) {
          const tx = x + bx;
          if (tx >= cols) break;

          for (let ty = bTopRow; ty <= buildingBaseRow; ty++) {
            tileGrid[ty][tx] = wallTileType;
          }
        }

        // Place a door centered horizontally at buildingBaseRow
        const doorOffset = Math.floor(bWidth / 2);
        const doorX = x + doorOffset;
        if (doorX < cols) {
          tileGrid[buildingBaseRow][doorX] = 'door';
        }

        // Place some windows on upper floors (every 3 rows)
        for (let floorY = buildingBaseRow - 2; floorY > bTopRow; floorY -= 3) {
          for (let bx = 1; bx < bWidth - 1; bx += 2) {
            const wx = x + bx;
            if (wx < cols) {
              tileGrid[floorY][wx] = 'window';
            }
          }
        }

        x += bWidth;
      }

      // Write grid tiles into the level design layer
      for (let ty = 0; ty < rows; ty++) {
        for (let tx = 0; tx < cols; tx++) {
          const type = tileGrid[ty][tx];
          let tile = null;
          if (type === 'street') tile = streetTile;
          else if (type === 'curb') tile = curbTile;
          else if (type === 'sidewalk') tile = sidewalkTile;
          else if (type === 'brick') tile = brickTile;
          else if (type === 'brick2') tile = brick2Tile;
          else if (type === 'window') tile = windowTile;
          else if (type === 'door') tile = doorTile;

          if (tile && tile.data) {
            for (let r = 0; r < 8; r++) {
              for (let c = 0; c < 8; c++) {
                const px = tx * 8 + c;
                const py = ty * 8 + r;
                if (py < newDims.h && px < newDims.w) {
                  newLayerData[py][px] = tile.data[r][c];
                }
              }
            }
          }
        }
      }
    } else if (sceneType === 'PLATFORMER') {
      // Platformer generator
      // 0. Inject target colors for background
      if (cfg.platformBgType === 'solid' || cfg.platformBgType === 'clouds' || cfg.platformBgType === 'starry') {
        const targetColors = [
          cfg.platformSkyColor,
          cfg.platformCloudColor1,
          cfg.platformCloudColor2,
          cfg.platformStarColor
        ].filter(Boolean);
        let paletteChanged = false;
        const paletteCopy = [...updatedPalette];
        for (const col of targetColors) {
          if (!paletteCopy.includes(col)) {
            if (paletteCopy.length < 256) {
              paletteCopy.push(col);
              paletteChanged = true;
            }
          }
        }
        if (paletteChanged) {
          updatedPalette = paletteCopy;
          setRecentColors(updatedPalette);
        }
      }

      const paletteToUse = updatedPalette;
      const mapColor = (hex) => getClosestPaletteColor(hex, paletteToUse);

      // Get palette-derived colors for fallbacks
      const sortedColors = [...paletteToUse].map(c => ({ hex: c, lum: getLuminance(c) })).sort((a, b) => b.lum - a.lum);
      const lightestPalColor = sortedColors[0]?.hex || '#ffffff';
      const secondLightestPalColor = sortedColors[1]?.hex || sortedColors[0]?.hex || '#ffffff';
      const darkestPalColor = sortedColors[sortedColors.length - 1]?.hex || '#000000';

      const bluePalColor = paletteToUse.find(c => {
        const rgb = hexToRgb(c);
        if (!rgb) return false;
        const { r, g, b } = rgb;
        return b > r && g > r * 0.5 && c.toLowerCase() !== '#000000';
      }) || (sortedColors.find(x => x.lum > 80 && x.lum < 200)?.hex) || lightestPalColor;

      const greenPalColor = paletteToUse.find(c => {
        const rgb = hexToRgb(c);
        if (!rgb) return false;
        const { r, g, b } = rgb;
        return g > r && g > b && c.toLowerCase() !== '#000000';
      }) || (sortedColors.find(x => x.lum > 60 && x.lum < 180)?.hex) || lightestPalColor;

      const isColorful = (hex) => {
        const rgb = hexToRgb(hex);
        if (!rgb) return false;
        const { r, g, b } = rgb;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        return (max - min) > 30;
      };

      const planetCandidates = paletteToUse.filter(isColorful);
      const planetColorPool = planetCandidates.length > 0 ? planetCandidates : paletteToUse.filter(c => {
        const lum = getLuminance(c);
        return lum > 40 && lum < 220;
      });
      const finalPlanetPool = planetColorPool.length > 0 ? planetColorPool : paletteToUse;

      if (cfg.platformBgType === 'solid' || cfg.platformBgType === 'clouds' || cfg.platformBgType === 'starry') {
        const skyBgLayerData = Array(newDims.h).fill(null).map(() => Array(newDims.w).fill(mapColor(cfg.platformSkyColor || (cfg.platformBgType === 'starry' ? darkestPalColor : bluePalColor))));
        
        let skyLayerName = 'Sky Background';
        let skyParallaxX = 0.05;
        let skyParallaxY = 0.05;

        if (cfg.platformBgType === 'clouds') {
          skyLayerName = 'Sky & Clouds';
          skyParallaxX = 0.5;
          skyParallaxY = 0.5;

          const cloudCount = 3 + Math.floor(Math.random() * 3); // fewer clouds, spread out
          const cloudColor1 = mapColor(cfg.platformCloudColor1 || lightestPalColor);
          const cloudColor2 = mapColor(cfg.platformCloudColor2 || secondLightestPalColor);

          for (let i = 0; i < cloudCount; i++) {
            const cx = Math.random() * newDims.w;
            const cy = newDims.h * (0.1 + Math.random() * 0.5);
            const size = 12 + Math.random() * 16;
            const puffs = 3 + Math.floor(Math.random() * 2);
            for (let p = 0; p < puffs; p++) {
              const pcx = cx + (p - (puffs - 1) / 2) * (size * 0.6);
              const pcy = cy + (Math.random() - 0.5) * (size * 0.2);
              const pr = size * (0.6 + Math.random() * 0.4);
              
              for (let dy = -pr; dy <= pr; dy++) {
                for (let dx = -pr; dx <= pr; dx++) {
                  const px = Math.round(pcx + dx);
                  const py = Math.round(pcy + dy);
                  if (px >= 0 && px < newDims.w && py >= 0 && py < newDims.h) {
                    const dist = Math.sqrt(dx*dx + dy*dy);
                    if (dist < pr) {
                      const shadeRatio = dist / pr;
                      let color = cloudColor1;
                      if (shadeRatio > 0.6) color = cloudColor2;
                      skyBgLayerData[py][px] = color;
                    }
                  }
                }
              }
            }
          }
        }

        skyBgLayer = {
          id: Date.now() + Math.random() + 0.05,
          textData: null,
          type: 'layer',
          name: skyLayerName,
          visible: true,
          groupId: null,
          data: skyBgLayerData,
          parallax: true,
          parallaxX: skyParallaxX,
          parallaxY: skyParallaxY
        };

        if (cfg.platformBgType === 'starry') {
          const starColorHex = cfg.platformStarColor || lightestPalColor;
          const starColor = mapColor(starColorHex);
          const starCount = 25 + Math.floor(Math.random() * 20);

          for (let i = 0; i < starCount; i++) {
            const sx = Math.floor(Math.random() * newDims.w);
            const sy = Math.floor(Math.random() * newDims.h);
            if (sx >= 0 && sx < newDims.w && sy >= 0 && sy < newDims.h) {
              skyBgLayerData[sy][sx] = starColor;
              if (Math.random() > 0.9) {
                if (sx > 0) skyBgLayerData[sy][sx - 1] = starColor;
                if (sx < newDims.w - 1) skyBgLayerData[sy][sx + 1] = starColor;
                if (sy > 0) skyBgLayerData[sy - 1][sx] = starColor;
                if (sy < newDims.h - 1) skyBgLayerData[sy + 1][sx] = starColor;
              }
            }
          }

          if (cfg.platformPlanets) {
            const planetCount = 1 + Math.floor(Math.random() * 2);
            const maxR = (cfg.platformMaxPlanetSize || 4) * 4;

            for (let i = 0; i < planetCount; i++) {
              const pr = 4 + Math.random() * (maxR - 4);
              const pcx = pr + Math.random() * (newDims.w - pr * 2);
              const pcy = pr + Math.random() * (newDims.h * 0.6 - pr);
              const planetHex = finalPlanetPool[Math.floor(Math.random() * finalPlanetPool.length)];
              const rgb = hexToRgb(planetHex) || { r: 128, g: 128, b: 128 };
              const hasRing = Math.random() > 0.6 && pr > 10;

              for (let dy = -pr; dy <= pr; dy++) {
                for (let dx = -pr; dx <= pr; dx++) {
                  const px = Math.round(pcx + dx);
                  const py = Math.round(pcy + dy);
                  if (px >= 0 && px < newDims.w && py >= 0 && py < newDims.h) {
                    const dist = Math.sqrt(dx*dx + dy*dy);
                    if (dist < pr) {
                      const lx = -0.5;
                      const ly = -0.5;
                      const nx = dx / pr;
                      const ny = dy / pr;
                      const intensity = 0.5 * (nx * lx + ny * ly + 1.0);
                      
                      let r = Math.round(rgb.r * (0.4 + intensity * 0.9));
                      let g = Math.round(rgb.g * (0.4 + intensity * 0.9));
                      let b = Math.round(rgb.b * (0.4 + intensity * 0.9));
                      r = Math.max(0, Math.min(255, r));
                      g = Math.max(0, Math.min(255, g));
                      b = Math.max(0, Math.min(255, b));
                      const hex = "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
                      skyBgLayerData[py][px] = mapColor(hex);
                    }
                  }
                }
              }

              if (hasRing) {
                const a = pr * 1.5;
                const b = pr * 0.4;
                const angle = -0.2;
                for (let rx = -a; rx <= a; rx++) {
                  const ryVal = b * Math.sqrt(Math.max(0, 1 - (rx*rx) / (a*a)));
                  const points = [
                    { dx: rx * Math.cos(angle) - ryVal * Math.sin(angle), dy: rx * Math.sin(angle) + ryVal * Math.cos(angle) },
                    { dx: rx * Math.cos(angle) + ryVal * Math.sin(angle), dy: rx * Math.sin(angle) - ryVal * Math.cos(angle) }
                  ];
                  points.forEach(pt => {
                    const px = Math.round(pcx + pt.dx);
                    const py = Math.round(pcy + pt.dy);
                    if (px >= 0 && px < newDims.w && py >= 0 && py < newDims.h) {
                      const isBehind = pt.dy < 0 && Math.sqrt(pt.dx*pt.dx + pt.dy*pt.dy) < pr;
                      if (!isBehind) {
                        skyBgLayerData[py][px] = mapColor(secondLightestPalColor);
                      }
                    }
                  });
                }
              }
            }
          }
        }
      }

      const brickTile = findTileStr(['brick block', 'stone wall', 'brick'], cfg.brickTileId, 8);
      const groundTopTile = findTileStr(['ground top', 'grass block', 'grass'], cfg.groundTopTileId, 0);
      const platformTile = findTileStr(['platform', 'wood block', 'wood'], cfg.platformTileId, 3);
      const ladderTile = findTileStr(['ladder'], cfg.ladderTileId, 4);
      const hazardTile = findTileStr(['hazard', 'spike', 'lava'], cfg.hazardTileId, 6);

      // 1. Ground (bottom rows) - with optional hazard 'death pits'
      const baseGroundHeight = cfg.maxGroundHeight !== undefined && cfg.maxGroundHeight !== '' && !isNaN(parseInt(cfg.maxGroundHeight)) ? parseInt(cfg.maxGroundHeight) : 2;
      const pitCount = cfg.deathPitCount !== undefined && cfg.deathPitCount !== '' && !isNaN(parseInt(cfg.deathPitCount)) ? parseInt(cfg.deathPitCount) : 1;

      // Build set of pit column ranges
      const pitRanges = [];
      for (let p = 0; p < pitCount; p++) {
        const pitWidth = Math.random() > 0.5 ? 3 : 2;
        let pitStart;
        let attempts = 0;
        do {
          pitStart = 4 + Math.floor(Math.random() * (cols - 8 - pitWidth));
          attempts++;
        } while (attempts < 20 && pitRanges.some(r => !(pitStart + pitWidth <= r.start || pitStart >= r.end)));
        pitRanges.push({ start: pitStart, end: pitStart + pitWidth });
      }

      let prevHeight = 1;

      for (let x = 0; x < cols; x++) {
        const isPitCol = pitRanges.some(r => x >= r.start && x < r.end);
        if (isPitCol) {
          tileGrid[rows - 1][x] = 'hazard';
        } else {
          const colHeight = baseGroundHeight > 1
            ? (x === 0
                ? 1 + Math.floor(Math.random() * baseGroundHeight)
                : Math.max(1, Math.min(baseGroundHeight, prevHeight + Math.floor(Math.random() * 3) - 1)))
            : 1;
          prevHeight = colHeight;
          for (let g = 0; g < colHeight; g++) {
            tileGrid[rows - 1 - g][x] = g === colHeight - 1 ? 'groundTop' : 'brick';
          }
        }
      }

      // 2. Generate random floating platforms
      const numPlatforms = cfg.platformCount !== undefined && cfg.platformCount !== '' && !isNaN(parseInt(cfg.platformCount)) ? parseInt(cfg.platformCount) : (2 + Math.floor(Math.random() * 3));
      const stepHeight = Math.floor((rows - 4) / numPlatforms);
      const generatedPlatforms = [];

      for (let i = 0; i < numPlatforms; i++) {
        const py = rows - (baseGroundHeight + 1) - (i * stepHeight) - 2 - Math.floor(Math.random() * 2);
        if (py < 2) continue;

        // Occasional 2 tile wide platform (20% chance), otherwise 4 to 11 tiles
        const pWidth = Math.random() < 0.2 ? 2 : (4 + Math.floor(Math.random() * 8));
        const pStartX = 1 + Math.floor(Math.random() * (cols - pWidth - 2));

        for (let x = pStartX; x < pStartX + pWidth; x++) {
          tileGrid[py][x] = 'platform';
        }

        generatedPlatforms.push({ py, pStartX, pWidth });
      }

      // 3. Assign ladders to a subset of candidate platforms (platforms NOT near the ground)
      // Platforms within 4 rows of the ground surface do not need ladders.
      const candidatePlatforms = generatedPlatforms.filter(p => (rows - baseGroundHeight - p.py) > 4);
      const totalCandidates = candidatePlatforms.length;

      if (totalCandidates > 0) {
        // Ensure at least one platform gets a ladder, but not all (unless only 1 candidate exists)
        const maxLadders = Math.max(1, totalCandidates - 1);
        const numLadders = Math.max(1, Math.min(maxLadders, 1 + Math.floor(Math.random() * maxLadders)));

        // Shuffle candidate indices to select platforms randomly
        const candidateIndices = Array.from({ length: totalCandidates }, (_, idx) => idx);
        for (let i = candidateIndices.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          const temp = candidateIndices[i];
          candidateIndices[i] = candidateIndices[j];
          candidateIndices[j] = temp;
        }

        const ladderPlatformIndices = new Set(candidateIndices.slice(0, numLadders));

        for (let i = 0; i < totalCandidates; i++) {
          if (ladderPlatformIndices.has(i)) {
            const { py, pStartX, pWidth } = candidatePlatforms[i];
            // Place ladder at a random offset from start, avoiding the edges of the platform if width >= 3
            const ladderX = pWidth > 2 
              ? pStartX + 1 + Math.floor(Math.random() * (pWidth - 2))
              : pStartX + Math.floor(Math.random() * pWidth);
            
            let endY = rows - baseGroundHeight - 1;
            for (let checkY = py + 1; checkY < rows - baseGroundHeight; checkY++) {
              if (tileGrid[checkY][ladderX] === 'platform') {
                endY = checkY;
                break;
              }
            }

            for (let ly = py + 1; ly <= endY; ly++) {
              tileGrid[ly][ladderX] = 'ladder';
            }
          }
        }
      }

      // Draw the tiles
      for (let ty = 0; ty < rows; ty++) {
        for (let tx = 0; tx < cols; tx++) {
          const type = tileGrid[ty][tx];
          let tile = null;
          if (type === 'brick') tile = brickTile;
          if (type === 'groundTop') tile = groundTopTile;
          if (type === 'platform') tile = platformTile;
          if (type === 'ladder') tile = ladderTile;
          if (type === 'hazard') tile = hazardTile;

          if (tile && tile.data) {
            for (let r = 0; r < 8; r++) {
              for (let c = 0; c < 8; c++) {
                const px = tx * 8 + c;
                const py = ty * 8 + r;
                if (py < newDims.h && px < newDims.w) {
                  newLayerData[py][px] = tile.data[r][c];
                }
              }
            }
          }
        }
      }
    } else if (sceneType === 'METROIDVANIA') {
      const caveWallTile = findTileStr(['cave wall'], cfg.caveWallTileId, 60);
      const cavePlatformTile = findTileStr(['cave platform'], cfg.cavePlatformTileId, 61);
      const caveCrystalTile = findTileStr(['cave crystal'], cfg.caveCrystalTileId, 62);
      const caveMushroomTile = findTileStr(['cave mushroom'], cfg.caveMushroomTileId, 63);
      const caveVineTile = findTileStr(['cave vine'], cfg.caveVineTileId, 64);
      const caveStalactiteTile = findTileStr(['cave stalactite'], cfg.caveStalactiteTileId, 65);
      const cavePillarTile = findTileStr(['cave pillar'], cfg.cavePillarTileId, 66);

      const paletteToUse = updatedPalette;
      const mapColor = (hex) => getClosestPaletteColor(hex, paletteToUse);
      const sortedColors = [...paletteToUse].map(c => ({ hex: c, lum: getLuminance(c) })).sort((a, b) => b.lum - a.lum);
      const darkestPalColor = sortedColors[sortedColors.length - 1]?.hex || '#000000';
      const bgColor = mapColor(cfg.caveBgColor || darkestPalColor);
      const tunnelWidth = cfg.caveTunnelWidth !== undefined ? cfg.caveTunnelWidth : 4;

      const caveBgTile = findTileStr(['cave background'], cfg.caveBgTileId, 66);
      const caveBgLayerData = Array(newDims.h).fill(null).map(() => Array(newDims.w).fill(null));

      if (caveBgTile && caveBgTile.data) {
        for (let py = 0; py < newDims.h; py++) {
          for (let px = 0; px < newDims.w; px++) {
            const r = py % 8;
            const c = px % 8;
            caveBgLayerData[py][px] = caveBgTile.data[r][c];
          }
        }
      } else {
        for (let py = 0; py < newDims.h; py++) {
          for (let px = 0; px < newDims.w; px++) {
            caveBgLayerData[py][px] = bgColor;
          }
        }
      }

      caveBgLayer = {
        id: Date.now() + Math.random() + 0.06,
        textData: null,
        type: 'layer',
        name: 'Cave Background',
        visible: true,
        groupId: null,
        data: caveBgLayerData,
        parallax: true,
        parallaxX: 0.5,
        parallaxY: 0.5
      };

      // Initialize the entire cave grid as solid wall
      const caveGrid = Array(rows).fill(null).map(() => Array(cols).fill('wall'));

      // Helper to carve circular empty spaces (null) in the grid, leaving a 2-tile border
      const carveCircle = (cx, cy, radius) => {
        const rCeil = Math.ceil(radius);
        for (let dy = -rCeil; dy <= rCeil; dy++) {
          for (let dx = -rCeil; dx <= rCeil; dx++) {
            const nx = Math.round(cx + dx);
            const ny = Math.round(cy + dy);
            if (nx >= 2 && nx < cols - 2 && ny >= 2 && ny < rows - 2) {
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist <= radius) {
                caveGrid[ny][nx] = null;
              }
            }
          }
        }
      };

      // Helper to carve organic tunnels from start to end points
      const carveTunnel = (xStart, yStart, xEnd, yEnd, radius) => {
        const steps = Math.max(10, Math.round(Math.sqrt((xEnd - xStart)**2 + (yEnd - yStart)**2) * 1.5));
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          const targetX = xStart + (xEnd - xStart) * t;
          const targetY = yStart + (yEnd - yStart) * t;
          
          // Add organic winding noise
          const angle = t * Math.PI * 2 * (1 + Math.random());
          const offsetX = Math.sin(angle) * (1 + Math.random() * 2);
          const offsetY = Math.cos(angle) * (1 + Math.random() * 2);
          
          let curX = targetX + offsetX;
          let curY = targetY + offsetY;
          
          // Clamp to boundaries (maintaining border)
          curX = Math.max(2, Math.min(cols - 3, curX));
          curY = Math.max(2, Math.min(rows - 3, curY));
          
          carveCircle(curX, curY, radius);
        }
      };

      // 1. Carve horizontal tunnels depending on rows
      const tRadius = tunnelWidth / 2;
      if (rows >= 24) {
        carveTunnel(3, Math.floor(rows * 0.28), cols - 4, Math.floor(rows * 0.28), tRadius * 0.9);
        carveTunnel(3, Math.floor(rows * 0.5), cols - 4, Math.floor(rows * 0.5), tRadius);
        carveTunnel(3, Math.floor(rows * 0.72), cols - 4, Math.floor(rows * 0.72), tRadius * 0.9);
      } else if (rows >= 16) {
        carveTunnel(3, Math.floor(rows * 0.33), cols - 4, Math.floor(rows * 0.33), tRadius);
        carveTunnel(3, Math.floor(rows * 0.67), cols - 4, Math.floor(rows * 0.67), tRadius);
      } else {
        carveTunnel(3, Math.floor(rows * 0.5), cols - 4, Math.floor(rows * 0.5), tRadius);
      }

      // 2. Carve vertical shafts to connect levels
      const numVerticalShafts = cols >= 24 ? 2 : 1;
      const verticalXCoords = [];
      if (numVerticalShafts === 1) {
        verticalXCoords.push(Math.floor(cols * 0.5));
      } else {
        verticalXCoords.push(Math.floor(cols * 0.3));
        verticalXCoords.push(Math.floor(cols * 0.7));
      }
      for (const xVal of verticalXCoords) {
        carveTunnel(xVal, 3, xVal, rows - 4, tRadius * 1.1);
      }

      // 3. Carve side branches ending in wider chambers (nooks and crannies)
      const numNooks = Math.max(3, Math.floor((cols * rows) / 100));
      let nooksPlaced = 0;
      let nookAttempts = 0;
      while (nooksPlaced < numNooks && nookAttempts < 100) {
        nookAttempts++;
        const rx = 3 + Math.floor(Math.random() * (cols - 6));
        const ry = 3 + Math.floor(Math.random() * (rows - 6));
        if (caveGrid[ry][rx] === null) {
          const angle = Math.random() * Math.PI * 2;
          const branchLength = 5 + Math.floor(Math.random() * 6);
          const radius = tRadius * 0.8;
          
          let curX = rx;
          let curY = ry;
          for (let step = 0; step < branchLength; step++) {
            curX += Math.cos(angle);
            curY += Math.sin(angle);
            curX = Math.max(2, Math.min(cols - 3, curX));
            curY = Math.max(2, Math.min(rows - 3, curY));
            carveCircle(curX, curY, radius);
          }
          // The nook/chamber at the end
          carveCircle(curX, curY, radius * 1.6);
          nooksPlaced++;
        }
      }

      // 4. Place floating platforms organically
      const numPlatforms = cfg.cavePlatformCount !== undefined ? cfg.cavePlatformCount : 8;
      let platformsPlaced = 0;
      let platformAttempts = 0;
      while (platformsPlaced < numPlatforms && platformAttempts < 200) {
        platformAttempts++;
        const px = 3 + Math.floor(Math.random() * (cols - 8));
        const py = 3 + Math.floor(Math.random() * (rows - 6));
        const pWidth = 3 + Math.floor(Math.random() * 3);
        
        let canPlace = true;
        for (let dx = 0; dx < pWidth; dx++) {
          const tx = px + dx;
          if (caveGrid[py][tx] !== null || caveGrid[py + 1][tx] !== null || (py > 0 && caveGrid[py - 1][tx] !== null)) {
            canPlace = false;
            break;
          }
        }
        if (canPlace) {
          for (let dx = 0; dx < pWidth; dx++) {
            caveGrid[py][px + dx] = 'platform';
          }
          platformsPlaced++;
        }
      }

      // Collect potential floor and ceiling cells for organic placement
      const floorCells = [];
      const ceilingCells = [];
      for (let ty = 2; ty < rows - 2; ty++) {
        for (let tx = 2; tx < cols - 2; tx++) {
          if (caveGrid[ty][tx] === null) {
            const under = caveGrid[ty + 1][tx];
            if (under === 'wall' || under === 'platform') {
              floorCells.push({ x: tx, y: ty });
            }
            if (caveGrid[ty - 1][tx] === 'wall') {
              ceilingCells.push({ x: tx, y: ty });
            }
          }
        }
      }

      // Shuffle floor cells
      for (let i = floorCells.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [floorCells[i], floorCells[j]] = [floorCells[j], floorCells[i]];
      }
      // Shuffle ceiling cells
      for (let i = ceilingCells.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [ceilingCells[i], ceilingCells[j]] = [ceilingCells[j], ceilingCells[i]];
      }

      // 5. Place Mushrooms on the floor (gems/crystals are removed)
      const numMushrooms = cfg.caveMushroomCount !== undefined ? cfg.caveMushroomCount : 4;
      let mushroomsPlaced = 0;
      for (let i = 0; i < floorCells.length && mushroomsPlaced < numMushrooms; i++) {
        const cell = floorCells[i];
        if (caveGrid[cell.y][cell.x] === null) {
          caveGrid[cell.y][cell.x] = 'mushroom';
          mushroomsPlaced++;
        }
      }

      // 6. Place Stalactites & Vines hanging from the ceiling
      // Upper half ceiling: sparse stalactites (25% probability)
      for (let ty = 2; ty < Math.floor(rows / 2); ty++) {
        for (let tx = 2; tx < cols - 2; tx++) {
          if (caveGrid[ty][tx] === null && caveGrid[ty - 1][tx] === 'wall') {
            if (Math.random() < 0.25) {
              caveGrid[ty][tx] = 'stalactite';
            }
          }
        }
      }

      // Lower half ceiling: place a few stalactites
      const lowerCeilingCells = ceilingCells.filter(c => c.y >= Math.floor(rows / 2));
      const numStalactites = cfg.caveStalactiteCount !== undefined ? cfg.caveStalactiteCount : 5;
      let stalactitesPlaced = 0;
      for (let i = 0; i < lowerCeilingCells.length && stalactitesPlaced < numStalactites; i++) {
        const cell = lowerCeilingCells[i];
        if (caveGrid[cell.y][cell.x] === null) {
          caveGrid[cell.y][cell.x] = 'stalactite';
          stalactitesPlaced++;
        }
      }

      // Vines: place them on any remaining empty ceiling cells
      const numVines = cfg.caveVineCount !== undefined ? cfg.caveVineCount : 3;
      let vinesPlaced = 0;
      for (let i = 0; i < ceilingCells.length && vinesPlaced < numVines; i++) {
        const cell = ceilingCells[i];
        if (caveGrid[cell.y][cell.x] === null) {
          const length = 4 + Math.floor(Math.random() * 5);
          for (let len = 0; len < length; len++) {
            const cy = cell.y + len;
            if (cy < rows - 2 && caveGrid[cy][cell.x] === null) {
              caveGrid[cy][cell.x] = 'vine';
            } else {
              break;
            }
          }
          vinesPlaced++;
        }
      }

      // 7. Place Pillars connecting floor to ceiling
      const numPillars = cfg.cavePillarCount !== undefined ? cfg.cavePillarCount : 3;
      let pillarsPlaced = 0;
      let pillarAttempts = 0;
      while (pillarsPlaced < numPillars && pillarAttempts < 100) {
        pillarAttempts++;
        const px = 4 + Math.floor(Math.random() * (cols - 8));
        let startY = -1;
        let endY = -1;
        for (let ty = 2; ty < rows - 2; ty++) {
          if (caveGrid[ty][px] === null) {
            if (startY === -1 && caveGrid[ty - 1][px] === 'wall') {
              startY = ty;
            }
            if (startY !== -1 && caveGrid[ty + 1][px] === 'wall') {
              endY = ty;
              break;
            }
          } else {
            startY = -1;
          }
        }
        if (startY !== -1 && endY !== -1 && (endY - startY + 1) >= 3 && (endY - startY + 1) <= 8) {
          for (let ty = startY; ty <= endY; ty++) {
            caveGrid[ty][px] = 'pillar';
          }
          pillarsPlaced++;
        }
      }

      // Copy cave grid back to main tileGrid so other layers (like collision detection) can read it
      for (let ty = 0; ty < rows; ty++) {
        for (let tx = 0; tx < cols; tx++) {
          tileGrid[ty][tx] = caveGrid[ty][tx];
        }
      }

      // Draw the tiles onto newLayerData
      for (let ty = 0; ty < rows; ty++) {
        for (let tx = 0; tx < cols; tx++) {
          const type = caveGrid[ty][tx];
          let tile = null;
          if (type === 'wall') tile = caveWallTile;
          if (type === 'platform') tile = cavePlatformTile;
          if (type === 'mushroom') tile = caveMushroomTile;
          if (type === 'vine') tile = caveVineTile;
          if (type === 'stalactite') tile = caveStalactiteTile;
          if (type === 'pillar') tile = cavePillarTile;

          if (tile && tile.data) {
            for (let r = 0; r < 8; r++) {
              for (let c = 0; c < 8; c++) {
                const px = tx * 8 + c;
                const py = ty * 8 + r;
                if (py < newDims.h && px < newDims.w) {
                  const pixelColor = tile.data[r][c];
                  if (pixelColor !== 'transparent' && pixelColor !== '#ff00ff' && pixelColor !== '#FF00FF' && pixelColor !== null && pixelColor !== undefined) {
                    newLayerData[py][px] = pixelColor;
                  }
                }
              }
            }
          }
        }
      }
    } else if (sceneType === 'RACING') {
      const trackTile = findTileStr(['road', 'racing floor', 'stone wall', 'brick'], cfg.trackTileId, 1);
      const grassTile = findTileStr(['grass block', 'grass'], cfg.grassTileId, 0);
      const finishTile = findTileStr(['racing finish line', 'finish'], cfg.finishTileId, 4);
      const borderTile = findTileStr(['cave wall', 'curb', 'stone wall', 'brick', 'border'], cfg.borderTileId, 8);
      const obstacleTile = findTileStr(['racing obstacle', 'hazard'], cfg.obstacleTileId, 6);
      const trackHW = cfg.trackWidth !== undefined && cfg.trackWidth !== '' && !isNaN(parseFloat(cfg.trackWidth)) ? parseFloat(cfg.trackWidth) / 2 : 3;
      const waviness = cfg.trackWaviness !== undefined && cfg.trackWaviness !== '' && !isNaN(parseFloat(cfg.trackWaviness)) ? parseFloat(cfg.trackWaviness) / 100 : 0.25;
      const trackStyle = cfg.trackStyle || 'wavy';

      const getTrackNoise = (param) => {
        if (trackStyle === 'twisty') {
          return waviness * (Math.sin(param * 0.6 + 0.3) * 0.7 + Math.sin(param * 0.9 + 1.5) * 0.3);
        } else if (trackStyle === 'serpentine') {
          return waviness * Math.sin(param * 0.15 + Math.PI / 2);
        }
        return waviness * Math.sin(param * 0.3 + 1.2) * Math.sin(param * 0.2 + 0.5);
      };
      const getOvalNoise = (angle) => {
        if (trackStyle === 'twisty') {
          return waviness * (Math.sin(5 * angle + 0.3) * 0.7 + Math.sin(7 * angle + 1.5) * 0.3);
        } else if (trackStyle === 'serpentine') {
          return waviness * Math.sin(2.5 * angle + Math.PI / 2);
        }
        return waviness * Math.sin(3 * angle + 1.2) * Math.sin(2 * angle + 0.5);
      };

      if (cfg.mode7Layout) {
        const cx = cols / 2;
        const gapRows1 = cfg.trackGaps ? [Math.floor(rows * 0.35), Math.floor(rows * 0.35) + 1, Math.floor(rows * 0.35) + 2] : [];
        const gapRows2 = cfg.trackGaps ? [Math.floor(rows * 0.65), Math.floor(rows * 0.65) + 1, Math.floor(rows * 0.65) + 2] : [];

        for (let ty = 0; ty < rows; ty++) {
          const noise = getTrackNoise(ty);
          const trackCenter = cx + noise * cols * 0.3;
          for (let tx = 0; tx < cols; tx++) {
            if (Math.abs(tx - trackCenter) <= trackHW) {
              const isGap = cfg.trackGaps && (gapRows1.includes(ty) || gapRows2.includes(ty));
              if (isGap) {
                tileGrid[ty][tx] = 'gap';
              } else {
                tileGrid[ty][tx] = 'track';
              }

              if (cfg.trackGaps) {
                const isTrigger = (gapRows1.length > 0 && (gapRows1.includes(ty) || ty === gapRows1[gapRows1.length - 1] + 1)) ||
                                  (gapRows2.length > 0 && (gapRows2.includes(ty) || ty === gapRows2[gapRows2.length - 1] + 1));
                if (isTrigger) {
                  gapTriggerCells.push({ x: tx * 8, y: ty * 8 });
                }
              }
            } else {
              tileGrid[ty][tx] = 'grass';
            }
          }
        }

        // Border: grass tiles adjacent to track become border
        const borderPositions = [];
        for (let ty = 0; ty < rows; ty++) {
          for (let tx = 0; tx < cols; tx++) {
            if (tileGrid[ty][tx] !== 'grass') continue;
            let adjacent = false;
            for (let dy = -1; dy <= 1 && !adjacent; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                if (dy === 0 && dx === 0) continue;
                const ny = ty + dy;
                const nx = tx + dx;
                if (ny >= 0 && ny < rows && nx >= 0 && nx < cols && (tileGrid[ny][nx] === 'track' || tileGrid[ny][nx] === 'gap')) {
                  adjacent = true;
                  break;
                }
              }
            }
            if (adjacent) borderPositions.push([ty, tx]);
          }
        }
        for (const [ty, tx] of borderPositions) {
          tileGrid[ty][tx] = 'border';
        }

        // Finish line at the top
        if (finishTile) {
          for (let tx = 0; tx < cols; tx++) {
            if (tileGrid[0][tx] === 'track') {
              tileGrid[0][tx] = 'finish';
            }
          }
        }

        // Scatter obstacles on random track tiles (skip top rows near finish & avoid trigger zones)
        if (obstacleTile) {
          const trackCells = [];
          for (let ty = 2; ty < rows; ty++) {
            for (let tx = 0; tx < cols; tx++) {
              if (tileGrid[ty][tx] === 'track') {
                const isTrigger = (gapRows1.length > 0 && (gapRows1.includes(ty) || ty === gapRows1[gapRows1.length - 1] + 1)) ||
                                  (gapRows2.length > 0 && (gapRows2.includes(ty) || ty === gapRows2[gapRows2.length - 1] + 1));
                if (!isTrigger) {
                  trackCells.push([ty, tx]);
                }
              }
            }
          }
          for (let i = trackCells.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [trackCells[i], trackCells[j]] = [trackCells[j], trackCells[i]];
          }
          const numObstacles = cfg.obstacleCount !== undefined && cfg.obstacleCount !== '' && !isNaN(parseInt(cfg.obstacleCount)) ? parseInt(cfg.obstacleCount) : Math.max(1, Math.min(15, Math.floor(trackCells.length * 0.02)));
          for (let i = 0; i < numObstacles; i++) {
            const [ty, tx] = trackCells[i];
            tileGrid[ty][tx] = 'obstacle';
          }
        }
      } else {
        const cx = cols / 2;
        const cy = rows / 2;
        const rx = Math.max(cols * 0.35, 4);
        const ry = Math.max(rows * 0.35, 4);

        for (let ty = 0; ty < rows; ty++) {
          for (let tx = 0; tx < cols; tx++) {
            const dx = tx - cx;
            const dy = ty - cy;
            const angle = Math.atan2(dy, dx);
            const baseR = rx * ry / Math.sqrt(Math.pow(ry * Math.cos(angle), 2) + Math.pow(rx * Math.sin(angle), 2));
            const noise = getOvalNoise(angle);
            const targetR = baseR * (1 + noise);

            const dist = Math.sqrt(dx * dx + dy * dy);
            if (Math.abs(dist - targetR) <= trackHW) {
              const isGap = cfg.trackGaps && (
                (angle >= -Math.PI / 2 - 0.12 && angle <= -Math.PI / 2 + 0.12) ||
                (angle >= Math.PI / 2 - 0.12 && angle <= Math.PI / 2 + 0.12)
              );
              if (isGap) {
                tileGrid[ty][tx] = 'gap';
              } else {
                tileGrid[ty][tx] = 'track';
              }

              if (cfg.trackGaps) {
                const isTrigger = (
                  (angle >= -Math.PI / 2 - 0.20 && angle <= -Math.PI / 2 + 0.20) ||
                  (angle >= Math.PI / 2 - 0.20 && angle <= Math.PI / 2 + 0.20)
                );
                if (isTrigger) {
                  gapTriggerCells.push({ x: tx * 8, y: ty * 8 });
                }
              }
            } else {
              tileGrid[ty][tx] = 'grass';
            }
          }
        }

        // Border: grass tiles adjacent to track become border
        const borderPositions = [];
        for (let ty = 0; ty < rows; ty++) {
          for (let tx = 0; tx < cols; tx++) {
            if (tileGrid[ty][tx] !== 'grass') continue;
            let adjacent = false;
            for (let dy = -1; dy <= 1 && !adjacent; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                if (dy === 0 && dx === 0) continue;
                const ny = ty + dy;
                const nx = tx + dx;
                if (ny >= 0 && ny < rows && nx >= 0 && nx < cols && (tileGrid[ny][nx] === 'track' || tileGrid[ny][nx] === 'gap')) {
                  adjacent = true;
                  break;
                }
              }
            }
            if (adjacent) borderPositions.push([ty, tx]);
          }
        }
        for (const [ty, tx] of borderPositions) {
          tileGrid[ty][tx] = 'border';
        }

        // Place finish line across the track on the right side (angle ≈ 0)
        if (finishTile) {
          for (let ty = 0; ty < rows; ty++) {
            for (let tx = 0; tx < cols; tx++) {
              if (tileGrid[ty][tx] !== 'track') continue;
              const dx = tx - cx;
              const dy = ty - cy;
              const angle = Math.atan2(dy, dx);
              if (Math.abs(angle) < 0.15 || Math.abs(angle - Math.PI * 2) < 0.15 || Math.abs(angle + Math.PI * 2) < 0.15) {
                tileGrid[ty][tx] = 'finish';
              }
            }
          }
        }

        // Scatter obstacles on random track tiles (avoiding trigger zones)
        if (obstacleTile) {
          const trackCells = [];
          for (let ty = 0; ty < rows; ty++) {
            for (let tx = 0; tx < cols; tx++) {
              if (tileGrid[ty][tx] === 'track') {
                const dx = tx - cx;
                const dy = ty - cy;
                const angle = Math.atan2(dy, dx);
                const isTrigger = (
                  (angle >= -Math.PI / 2 - 0.20 && angle <= -Math.PI / 2 + 0.20) ||
                  (angle >= Math.PI / 2 - 0.20 && angle <= Math.PI / 2 + 0.20)
                );
                if (!cfg.trackGaps || !isTrigger) {
                  trackCells.push([ty, tx]);
                }
              }
            }
          }
          // Shuffle and pick up to ~5% of track cells (min 1, max ~15)
          for (let i = trackCells.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [trackCells[i], trackCells[j]] = [trackCells[j], trackCells[i]];
          }
          const numObstacles = cfg.obstacleCount !== undefined && cfg.obstacleCount !== '' && !isNaN(parseInt(cfg.obstacleCount)) ? parseInt(cfg.obstacleCount) : Math.max(1, Math.min(15, Math.floor(trackCells.length * 0.02)));
          for (let i = 0; i < numObstacles; i++) {
            const [ty, tx] = trackCells[i];
            tileGrid[ty][tx] = 'obstacle';
          }
        }
      }

      // Draw the tiles
      for (let ty = 0; ty < rows; ty++) {
        for (let tx = 0; tx < cols; tx++) {
          const type = tileGrid[ty][tx];
          let tile = grassTile;
          if (type === 'track') tile = trackTile;
          if (type === 'border') tile = borderTile;
          if (type === 'finish') tile = finishTile;
          if (type === 'obstacle') tile = obstacleTile;
          if (type === 'gap') tile = grassTile;

          if (tile && tile.data) {
            for (let r = 0; r < 8; r++) {
              for (let c = 0; c < 8; c++) {
                const px = tx * 8 + c;
                const py = ty * 8 + r;
                if (py < newDims.h && px < newDims.w && tile.data[r][c] != null) {
                  newLayerData[py][px] = tile.data[r][c];
                }
              }
            }
          }

          // For obstacle cells, draw the track tile underneath where obstacle has null pixels
          if (type === 'obstacle' && trackTile && trackTile.data) {
            for (let r = 0; r < 8; r++) {
              for (let c = 0; c < 8; c++) {
                const px = tx * 8 + c;
                const py = ty * 8 + r;
                if (py < newDims.h && px < newDims.w && (!obstacleTile || obstacleTile.data[r][c] == null)) {
                  newLayerData[py][px] = trackTile.data[r][c];
                }
              }
            }
          }
        }
      }
    } else if (sceneType === 'POINTNCLICK') {
      // Point & Click level generator
      // Fill interior with user-selected tile (default: road), border with a solid color
      const fillTile = findTileStr(['road', 'grass'], cfg.fillTileId, 0);
      const borderColorHex = cfg.borderColor || getDarkestColor(updatedPalette);
      const bottomThickness = cfg.bottomThickness != null ? cfg.bottomThickness : 2;

      for (let ty = 0; ty < rows; ty++) {
        for (let tx = 0; tx < cols; tx++) {
          const isBorder = ty < 2 || ty >= rows - (2 + bottomThickness) || tx < 2 || tx >= cols - 2;
          if (isBorder) {
            tileGrid[ty][tx] = 'border';
            for (let r = 0; r < 8; r++) {
              for (let c = 0; c < 8; c++) {
                const px = tx * 8 + c;
                const py = ty * 8 + r;
                if (py < newDims.h && px < newDims.w) {
                  newLayerData[py][px] = borderColorHex;
                }
              }
            }
          } else if (fillTile && fillTile.data) {
            for (let r = 0; r < 8; r++) {
              for (let c = 0; c < 8; c++) {
                const px = tx * 8 + c;
                const py = ty * 8 + r;
                if (py < newDims.h && px < newDims.w) {
                  newLayerData[py][px] = fillTile.data[r][c];
                }
              }
            }
          }
        }
      }

      // Generate solid collision group covering the border
      const borderCells = [];
      for (let ty = 0; ty < rows; ty++) {
        for (let tx = 0; tx < cols; tx++) {
          const isBorder = ty < 2 || ty >= rows - (2 + bottomThickness) || tx < 2 || tx >= cols - 2;
          if (isBorder) {
            borderCells.push({ x: tx * 8, y: ty * 8 });
          }
        }
      }
      if (borderCells.length > 0) {
        const rects = combineCellsToRectangles(borderCells);
        const groupId = Date.now() + Math.random();
        const c0 = updatedCollisions.length;
        rects.forEach((rect, idx) => {
          updatedCollisions.push({
            id: Date.now() + Math.random() + idx,
            name: `Collision ${c0 + idx + 1}`,
            type: 'solid',
            x: rect.x, y: rect.y,
            width: rect.width, height: rect.height,
            isPainted: false, groupId,
            isGenerated: true
          });
        });
        updatedCollisions.push({
          id: groupId,
          name: 'Solid',
          isGroup: true, type: 'solid',
          isGenerated: true
        });
      }    } else if (sceneType === 'SHMUP') {
      // 1. Determine day/night and top-down
      const isTopDown = !!cfg.shmupTopDown || !!cfg.mode7Layout;

      const targetColors = [
        cfg.shmupSkyColor,
        cfg.shmupCloudColor1,
        cfg.shmupCloudColor2,
        cfg.shmupStarColor,
        cfg.shmupNightSkyColor
      ].filter(Boolean);
      let paletteChanged = false;
      const paletteCopy = [...updatedPalette];
      for (const col of targetColors) {
        if (!paletteCopy.includes(col)) {
          if (paletteCopy.length < 256) {
            paletteCopy.push(col);
            paletteChanged = true;
          }
        }
      }
      if (paletteChanged) {
        updatedPalette = paletteCopy;
        setRecentColors(updatedPalette);
      }

      const paletteToUse = updatedPalette;
      const mapColor = (hex) => getClosestPaletteColor(hex, paletteToUse);

      // Get palette-derived colors for fallbacks
      const sortedColors = [...paletteToUse].map(c => ({ hex: c, lum: getLuminance(c) })).sort((a, b) => b.lum - a.lum);
      const lightestPalColor = sortedColors[0]?.hex || '#ffffff';
      const secondLightestPalColor = sortedColors[1]?.hex || sortedColors[0]?.hex || '#ffffff';
      const darkestPalColor = sortedColors[sortedColors.length - 1]?.hex || '#000000';

      const bluePalColor = paletteToUse.find(c => {
        const rgb = hexToRgb(c);
        if (!rgb) return false;
        const { r, g, b } = rgb;
        return b > r && g > r * 0.5 && c.toLowerCase() !== '#000000';
      }) || (sortedColors.find(x => x.lum > 80 && x.lum < 200)?.hex) || lightestPalColor;

      const greenPalColor = paletteToUse.find(c => {
        const rgb = hexToRgb(c);
        if (!rgb) return false;
        const { r, g, b } = rgb;
        return g > r && g > b && c.toLowerCase() !== '#000000';
      }) || (sortedColors.find(x => x.lum > 60 && x.lum < 180)?.hex) || lightestPalColor;

      const isColorful = (hex) => {
        const rgb = hexToRgb(hex);
        if (!rgb) return false;
        const { r, g, b } = rgb;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        return (max - min) > 30;
      };

      const planetCandidates = paletteToUse.filter(isColorful);
      const planetColorPool = planetCandidates.length > 0 ? planetCandidates : paletteToUse.filter(c => {
        const lum = getLuminance(c);
        return lum > 40 && lum < 220;
      });
      const finalPlanetPool = planetColorPool.length > 0 ? planetColorPool : paletteToUse;

      // Extract blue-ish colors for day gradient
      const blueColorsForGrad = paletteToUse.filter(c => {
        const rgb = hexToRgb(c);
        if (!rgb) return false;
        const { r, g, b } = rgb;
        return b > r && g > r * 0.4 && c.toLowerCase() !== '#000000';
      });
      
      let skyTopHex, skyBottomHex;
      if (blueColorsForGrad.length >= 2) {
        const sortedBlues = blueColorsForGrad.map(c => ({ hex: c, lum: getLuminance(c) })).sort((a, b) => b.lum - a.lum);
        skyBottomHex = sortedBlues[0].hex;
        skyTopHex = sortedBlues[sortedBlues.length - 1].hex;
      } else if (blueColorsForGrad.length === 1) {
        skyTopHex = blueColorsForGrad[0];
        skyBottomHex = lightestPalColor;
      } else {
        skyTopHex = secondLightestPalColor;
        skyBottomHex = lightestPalColor;
      }

      const dayTopRgb = hexToRgb(skyTopHex) || { r: 74, g: 144, b: 226 };
      const dayBottomRgb = hexToRgb(skyBottomHex) || { r: 191, g: 227, b: 249 };

      // Night gradient: darkest color to second-darkest color
      const sortedDarks = [...sortedColors].reverse(); // darkest to lightest
      const nightTopHex = sortedDarks[0]?.hex || '#0a081a';
      const nightBottomHex = sortedDarks[1]?.hex || sortedDarks[0]?.hex || '#181236';
      
      const nightTopRgb = hexToRgb(nightTopHex) || { r: 10, g: 8, b: 26 };
      const nightBottomRgb = hexToRgb(nightBottomHex) || { r: 24, g: 18, b: 54 };

      // Night mode stars pool: high-luminance colors
      const brightStarColors = sortedColors.filter(c => c.lum > 150).map(c => c.hex);
      const starColorsPool = brightStarColors.length >= 2 ? brightStarColors : sortedColors.slice(0, 4).map(c => c.hex);

      const skyBgLayerData = Array(newDims.h).fill(null).map(() => Array(newDims.w).fill(null));

      // Generate background based on type
      let skyLayerName = 'Sky Background';
      let skyParallaxX = 0.05;
      let skyParallaxY = 0.05;

      if (cfg.shmupBgType === 'sky_clouds' || cfg.shmupBgType === 'clouds') {
        // Fill sky background if sky_clouds mode
        if (cfg.shmupBgType === 'sky_clouds') {
          skyLayerName = 'Sky & Clouds';
          skyParallaxX = 0.5;
          skyParallaxY = 0.5;
          const skyHex = cfg.shmupSkyColor || '#29adff';
          for (let py = 0; py < newDims.h; py++) {
            for (let px = 0; px < newDims.w; px++) {
              skyBgLayerData[py][px] = mapColor(skyHex);
            }
          }
        } else {
          skyLayerName = 'Clouds';
          skyParallaxX = 0.5;
          skyParallaxY = 0.5;
        }

        // Generate ground/water for top-down view if requested
        if (isTopDown && cfg.shmupGround) {
          const groundTile = findTileStr(['grass block', 'grass', 'brick'], cfg.shmupGroundTileId, 0);
          const waterTile = findTileStr(['water', 'sea', 'river'], cfg.shmupWaterTileId, 2);
          
          for (let ty = 0; ty < rows; ty++) {
            for (let tx = 0; tx < cols; tx++) {
              const val = Math.sin(tx * 0.15) * Math.cos(ty * 0.15) + 
                          Math.sin(tx * 0.05 + ty * 0.05) * 0.5 + 
                          (Math.random() - 0.5) * 0.15;
              const isGround = val > -0.15;
              const type = isGround ? 'ground' : 'water';
              tileGrid[ty][tx] = type;
              
              const tile = type === 'ground' ? groundTile : waterTile;
              if (tile && tile.data) {
                for (let r = 0; r < 8; r++) {
                  for (let c = 0; c < 8; c++) {
                    const px = tx * 8 + c;
                    const py = ty * 8 + r;
                    if (py < newDims.h && px < newDims.w) {
                      newLayerData[py][px] = tile.data[r][c];
                    }
                  }
                }
              } else {
                const fallbackColor = type === 'ground' ? greenPalColor : bluePalColor;
                for (let r = 0; r < 8; r++) {
                  for (let c = 0; c < 8; c++) {
                    const px = tx * 8 + c;
                    const py = ty * 8 + r;
                    if (py < newDims.h && px < newDims.w) {
                      newLayerData[py][px] = mapColor(fallbackColor);
                    }
                  }
                }
              }
            }
          }
        }

        // Generate ground/water for side view if requested
        if (!isTopDown && cfg.shmupGround) {
          const groundTile = findTileStr(['grass block', 'grass', 'brick'], cfg.shmupGroundTileId, 0);
          const waterTile = findTileStr(['water', 'sea', 'river'], cfg.shmupWaterTileId, 2);
          
          let isCurrentWater = false;
          let runLength = 0;
          
          for (let tx = 0; tx < cols; tx++) {
            if (runLength <= 0) {
              if (isCurrentWater) {
                isCurrentWater = false;
                runLength = 6 + Math.floor(Math.random() * 8);
              } else {
                if (Math.random() < 0.25) {
                  isCurrentWater = true;
                  runLength = 2 + Math.floor(Math.random() * 3);
                } else {
                  isCurrentWater = false;
                  runLength = 4 + Math.floor(Math.random() * 6);
                }
              }
            }
            runLength--;
            
            const type = isCurrentWater ? 'water' : 'ground';
            const startRow = rows - 3;
            for (let ty = startRow; ty < rows; ty++) {
              tileGrid[ty][tx] = type;
              const tile = type === 'ground' ? groundTile : waterTile;
              if (tile && tile.data) {
                for (let r = 0; r < 8; r++) {
                  for (let c = 0; c < 8; c++) {
                    const px = tx * 8 + c;
                    const py = ty * 8 + r;
                    if (py < newDims.h && px < newDims.w) {
                      newLayerData[py][px] = tile.data[r][c];
                    }
                  }
                }
              } else {
                const fallbackColor = type === 'ground' ? greenPalColor : bluePalColor;
                for (let r = 0; r < 8; r++) {
                  for (let c = 0; c < 8; c++) {
                    const px = tx * 8 + c;
                    const py = ty * 8 + r;
                    if (py < newDims.h && px < newDims.w) {
                      newLayerData[py][px] = mapColor(fallbackColor);
                    }
                  }
                }
              }
            }
          }
        }

        // Generate clouds (same logic as platform generator) directly into skyBgLayerData
        const cloudCount = 3 + Math.floor(Math.random() * 3);
        const cloudColor1 = mapColor(cfg.shmupCloudColor1 || '#fff1e8');
        const cloudColor2 = mapColor(cfg.shmupCloudColor2 || '#c2c3c7');

        for (let i = 0; i < cloudCount; i++) {
          const cx = Math.random() * newDims.w;
          const cy = newDims.h * (0.1 + Math.random() * 0.5);
          const size = 12 + Math.random() * 16;
          const puffs = 3 + Math.floor(Math.random() * 2);
          for (let p = 0; p < puffs; p++) {
            const pcx = cx + (p - (puffs - 1) / 2) * (size * 0.6);
            const pcy = cy + (Math.random() - 0.5) * (size * 0.2);
            const pr = size * (0.6 + Math.random() * 0.4);
            
            for (let dy = -pr; dy <= pr; dy++) {
              for (let dx = -pr; dx <= pr; dx++) {
                const px = Math.round(pcx + dx);
                const py = Math.round(pcy + dy);
                if (px >= 0 && px < newDims.w && py >= 0 && py < newDims.h) {
                  const dist = Math.sqrt(dx*dx + dy*dy);
                  if (dist < pr) {
                    const shadeRatio = dist / pr;
                    let color = cloudColor1;
                    if (shadeRatio > 0.6) color = cloudColor2;
                    skyBgLayerData[py][px] = color;
                  }
                }
              }
            }
          }
        }
      } else if (cfg.shmupBgType === 'starry') {
        // --- STARRY NIGHT MODE ---
        const nightSkyHex = cfg.shmupNightSkyColor || '#000000';
        for (let py = 0; py < newDims.h; py++) {
          for (let px = 0; px < newDims.w; px++) {
            skyBgLayerData[py][px] = mapColor(nightSkyHex);
          }
        }
        
        // Star generator (low density in Mode 7)
        const starCount = cfg.mode7Layout ? 15 : (80 + Math.floor(Math.random() * 70));
        for (let i = 0; i < starCount; i++) {
          const sx = Math.floor(Math.random() * newDims.w);
          const sy = Math.floor(Math.random() * newDims.h);
          
          const color = cfg.shmupStarColor || starColorsPool[0] || '#ffffff';
          
          if (sx >= 0 && sx < newDims.w && sy >= 0 && sy < newDims.h) {
            newLayerData[sy][sx] = mapColor(color);
            if (!cfg.mode7Layout && Math.random() > 0.92) {
              if (sx > 0) newLayerData[sy][sx - 1] = mapColor(color);
              if (sx < newDims.w - 1) newLayerData[sy][sx + 1] = mapColor(color);
              if (sy > 0) newLayerData[sy - 1][sx] = mapColor(color);
              if (sy < newDims.h - 1) newLayerData[sy + 1][sx] = mapColor(color);
            }
          }
        }
        
        // Planets option (low density / smaller size in Mode 7)
        if (cfg.shmupPlanets) {
          const planetCount = cfg.mode7Layout ? 1 : (2 + Math.floor(Math.random() * 3));
          const maxR = cfg.mode7Layout ? 8 : (cfg.shmupMaxPlanetSize || 4) * 4;
          for (let i = 0; i < planetCount; i++) {
            const pr = cfg.mode7Layout ? (4 + Math.random() * 4) : (6 + Math.random() * (maxR - 6));
            const pcx = pr + Math.random() * (newDims.w - pr * 2);
            const pcy = pr + Math.random() * (newDims.h - pr * 2);
            const planetHex = finalPlanetPool[Math.floor(Math.random() * finalPlanetPool.length)];
            const rgb = hexToRgb(planetHex) || { r: 128, g: 128, b: 128 };
            const hasRing = !cfg.mode7Layout && Math.random() > 0.6 && pr > 10;
            
            for (let dy = -pr; dy <= pr; dy++) {
              for (let dx = -pr; dx <= pr; dx++) {
                const px = Math.round(pcx + dx);
                const py = Math.round(pcy + dy);
                if (px >= 0 && px < newDims.w && py >= 0 && py < newDims.h) {
                  const dist = Math.sqrt(dx*dx + dy*dy);
                  if (dist < pr) {
                    const lx = -0.5;
                    const ly = -0.5;
                    const nx = dx / pr;
                    const ny = dy / pr;
                    const intensity = 0.5 * (nx * lx + ny * ly + 1.0);
                    
                    let r = Math.round(rgb.r * (0.4 + intensity * 0.9));
                    let g = Math.round(rgb.g * (0.4 + intensity * 0.9));
                    let b = Math.round(rgb.b * (0.4 + intensity * 0.9));
                    r = Math.max(0, Math.min(255, r));
                    g = Math.max(0, Math.min(255, g));
                    b = Math.max(0, Math.min(255, b));
                    const hex = "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
                    newLayerData[py][px] = mapColor(hex);
                  }
                }
              }
            }
            
            if (hasRing) {
              const a = pr * 1.5;
              const b = pr * 0.4;
              const angle = -0.2;
              for (let rx = -a; rx <= a; rx++) {
                const ryVal = b * Math.sqrt(Math.max(0, 1 - (rx*rx) / (a*a)));
                const points = [
                  { dx: rx * Math.cos(angle) - ryVal * Math.sin(angle), dy: rx * Math.sin(angle) + ryVal * Math.cos(angle) },
                  { dx: rx * Math.cos(angle) + ryVal * Math.sin(angle), dy: rx * Math.sin(angle) - ryVal * Math.cos(angle) }
                ];
                points.forEach(pt => {
                  const px = Math.round(pcx + pt.dx);
                  const py = Math.round(pcy + pt.dy);
                  if (px >= 0 && px < newDims.w && py >= 0 && py < newDims.h) {
                    const isBehind = pt.dy < 0 && Math.sqrt(pt.dx*pt.dx + pt.dy*pt.dy) < pr;
                    if (!isBehind) {
                      newLayerData[py][px] = mapColor(secondLightestPalColor);
                    }
                  }
                });
              }
            }
          }
        }
      }

      skyBgLayer = {
        id: Date.now() + Math.random() + 0.05,
        textData: null,
        type: 'layer',
        name: skyLayerName,
        visible: true,
        groupId: null,
        data: skyBgLayerData,
        parallax: true,
        parallaxX: skyParallaxX,
        parallaxY: skyParallaxY
      };
    }

    const enableM7 = scene.mode7 || cfg.mode7Layout;

    // Create a new layer with the generated level data
    const newLayer = {
      id: Date.now() + Math.random(),
      textData: null,
      type: 'layer',
      name: 'Level Design',
      visible: true,
      groupId: null,
      data: newLayerData,
      ...(enableM7 && { affine: true, mode7: true })
    };

    // Determine player start position
    let startX, startY;
    if (sceneType === 'RACING' && (scene.mode7 || cfg.mode7Layout)) {
      // Mode7 3D racing: track-based positioning (leave as-is)
      const m7cols = newDims.w / 8;
      const m7rows = newDims.h / 8;
      const m7cx = m7cols / 2;
      const m7waviness = cfg.trackWaviness != null ? cfg.trackWaviness / 100 : 0.25;
      const m7Style = cfg.trackStyle || 'wavy';
      if (cfg.mode7Layout) {
        const lastRow = m7rows - 1;
        let noise;
        if (m7Style === 'twisty') {
          noise = m7waviness * (Math.sin(lastRow * 0.6 + 0.3) * 0.7 + Math.sin(lastRow * 0.9 + 1.5) * 0.3);
        } else if (m7Style === 'serpentine') {
          noise = m7waviness * Math.sin(lastRow * 0.15 + Math.PI / 2);
        } else {
          noise = m7waviness * Math.sin(lastRow * 0.3 + 1.2) * Math.sin(lastRow * 0.2 + 0.5);
        }
        const trackCenter = m7cx + noise * m7cols * 0.3;
        startX = Math.floor(trackCenter * 8);
        startY = Math.floor(lastRow * 8);
      } else {
        const m7cy = m7rows / 2;
        const m7rx = Math.max(m7cols * 0.35, 4);
        let m7noise;
        if (m7Style === 'twisty') {
          m7noise = 0.25 * (Math.sin(5 * 0 + 0.3) * 0.7 + Math.sin(7 * 0 + 1.5) * 0.3);
        } else if (m7Style === 'serpentine') {
          m7noise = 0.25 * Math.sin(Math.PI / 2);
        } else {
          m7noise = 0.25 * Math.sin(1.2) * Math.sin(0.5);
        }
        const m7targetR = m7rx * (1 + m7noise);
        startX = Math.floor((m7cx + m7targetR) * 8);
        startY = Math.floor(m7cy * 8);
      }
    } else if (sceneType === 'RACING') {
      // Non-mode7 oval track: place on the track just before the finish line
      const racingCx = cols / 2;
      const racingCy = rows / 2;
      const targetAngle = -0.3;
      const angleTolerance = 0.15;
      const nearbyCells = [];
      for (let ty = 0; ty < rows; ty++) {
        for (let tx = 0; tx < cols; tx++) {
          if (tileGrid[ty][tx] !== 'track') continue;
          const dx = tx - racingCx;
          const dy = ty - racingCy;
          const angle = Math.atan2(dy, dx);
          if (Math.abs(angle - targetAngle) < angleTolerance) {
            nearbyCells.push({ tx, ty, dist: Math.sqrt(dx * dx + dy * dy) });
          }
        }
      }
      if (nearbyCells.length > 0) {
        nearbyCells.sort((a, b) => a.dist - b.dist);
        const centerCell = nearbyCells[Math.floor(nearbyCells.length / 2)];
        startX = centerCell.tx * 8;
        startY = centerCell.ty * 8;
      } else {
        startX = Math.floor(newDims.w / 2) - 4;
        startY = 24;
      }
    } else if (sceneType === 'INTRO' || sceneType === 'PAUSE') {
      const useImage = (sceneType === 'INTRO' && (cfg.introUseLpLogo || cfg.introImgData)) ||
                       (sceneType === 'PAUSE' && (cfg.pauseUseLpPause || cfg.pauseImgData));
      if (useImage) {
        try {
          let imageSrc;
          if (sceneType === 'INTRO') {
            imageSrc = cfg.introUseLpLogo ? '/lp-gb.png' : cfg.introImgData;
          } else {
            imageSrc = cfg.pauseUseLpPause ? '/lp-pause-gb.png' : cfg.pauseImgData;
          }
          const img = new Image();
          img.crossOrigin = 'anonymous';
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = () => reject(new Error("Failed to load image"));
            img.src = imageSrc;
          });

          const fitScale = Math.min(256 / img.width, 256 / img.height);
          const fitW = Math.round(img.width * fitScale);
          const fitH = Math.round(img.height * fitScale);
          const fitX = Math.round((newDims.w - fitW) / 2);
          const fitY = Math.round((newDims.h - fitH) / 2);

          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = newDims.w;
          tempCanvas.height = newDims.h;
          const ctx = tempCanvas.getContext('2d', { willReadFrequently: true });
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(img, fitX, fitY, fitW, fitH);

          const imgData = ctx.getImageData(0, 0, newDims.w, newDims.h).data;
          
          const rawLayerPixels = Array(newDims.h).fill(null).map(() => Array(newDims.w).fill(null));
          const colorCounts = {};

          const useDefaultImage = (sceneType === 'INTRO' && cfg.introUseLpLogo) ||
                                  (sceneType === 'PAUSE' && cfg.pauseUseLpPause);

          for (let y = 0; y < newDims.h; y++) {
            for (let x = 0; x < newDims.w; x++) {
              const idx = (y * newDims.w + x) * 4;
              if (imgData[idx + 3] > 128) {
                const hex = '#' + ((1 << 24) + (imgData[idx] << 16) + (imgData[idx + 1] << 8) + imgData[idx + 2]).toString(16).slice(1).toLowerCase();
                rawLayerPixels[y][x] = hex;
                colorCounts[hex] = (colorCounts[hex] || 0) + 1;
              } else if (!useDefaultImage) {
                const hex = '#000000';
                rawLayerPixels[y][x] = hex;
                colorCounts[hex] = (colorCounts[hex] || 0) + 1;
              }
            }
          }

          // Apply palette conversions as we do when importing an image
          const sortedUniqueColors = Object.keys(colorCounts).sort((a, b) => colorCounts[b] - colorCounts[a]);
          const currentPalette = updatedPalette && updatedPalette.length > 0 ? [...updatedPalette] : [];
          const currentPaletteSet = new Set(currentPalette);
          const newColors = [];
          for (const color of sortedUniqueColors) {
            if (!currentPaletteSet.has(color)) {
              newColors.push(color);
            }
          }

          if (newColors.length > 0) {
            const spaceLeft = 256 - currentPalette.length;
            if (spaceLeft > 0) {
              let colorsToAdd = filterSimilarColors(newColors, 100, currentPalette);
              if (colorsToAdd.length === 0) {
                colorsToAdd = newColors.slice(0, spaceLeft);
              } else if (colorsToAdd.length > spaceLeft) {
                colorsToAdd = colorsToAdd.slice(0, spaceLeft);
              }
              updatedPalette = [...currentPalette, ...colorsToAdd];
              // Update state
              setRecentColors(updatedPalette);
            }
          }

          const cacheMap = new Map();
          for (const color of Object.keys(colorCounts)) {
            cacheMap.set(color, getClosestPaletteColor(color, updatedPalette));
          }

          for (let y = 0; y < newDims.h; y++) {
            for (let x = 0; x < newDims.w; x++) {
              if (rawLayerPixels[y][x]) {
                newLayerData[y][x] = cacheMap.get(rawLayerPixels[y][x]);
              }
            }
          }
        } catch (err) {
          console.error("Failed to load / process image", err);
          toast.error("Failed to load or process the image.");
          // Fallback: fill with bg color
          const bgColor = newProjectSettings.bgColor || '#000000';
          for (let y = 0; y < newDims.h; y++) {
            for (let x = 0; x < newDims.w; x++) {
              newLayerData[y][x] = bgColor;
            }
          }
        }
      } else {
        // Just fill with background color
        const bgColor = (sceneType === 'PAUSE' && cfg.pauseBgColor) ? cfg.pauseBgColor : (newProjectSettings.bgColor || '#000000');
        for (let ty = 0; ty < rows; ty++) {
          for (let tx = 0; tx < cols; tx++) {
            for (let r = 0; r < 8; r++) {
              for (let c = 0; c < 8; c++) {
                const px = tx * 8 + c;
                const py = ty * 8 + r;
                if (py < newDims.h && px < newDims.w) {
                  newLayerData[py][px] = bgColor;
                }
              }
            }
          }
        }
      }
    } else if (sceneType === 'SHMUP') {
      // SHMUP: near bottom, centered
      startX = Math.floor(newDims.w / 2) - 4;
      startY = newDims.h - 32;
    } else if (sceneType === 'METROIDVANIA') {
      // Find a walkable spot (null) with a solid floor (wall) underneath
      let foundStart = false;
      for (let tx = 3; tx < cols - 3 && !foundStart; tx++) {
        for (let ty = rows - 4; ty > 3; ty--) {
          if (tileGrid[ty][tx] === null && tileGrid[ty + 1][tx] === 'wall') {
            startX = tx * 8;
            startY = ty * 8;
            foundStart = true;
            break;
          }
        }
      }
      if (!foundStart) {
        startX = Math.floor(newDims.w / 2) - 4;
        startY = Math.floor(newDims.h / 2) - 4;
      }
    } else if (sceneType === 'BEATEMUP') {
      const streetStartRow = Math.floor(rows * 2 / 3);
      const sidewalkStartRow = Math.max(0, streetStartRow - 3);
      startX = 16;
      startY = (sidewalkStartRow + 1) * 8;
    } else if (sceneType === 'PLATFORMER') {
      // Near lower left corner, 2 tiles above the ground
      let groundRow = rows - 1;
      for (let checkTx = 0; checkTx < Math.min(4, cols); checkTx++) {
        for (let ty = 0; ty < rows; ty++) {
          if (tileGrid[ty][checkTx] === 'groundTop') {
            groundRow = ty;
            break;
          }
        }
        if (groundRow < rows - 1) break;
      }
      startX = 16;
      startY = Math.max(0, (groundRow - 2) * 8);
    } else {
      // TOPDOWN, POINTNCLICK: center of scene
      startX = Math.floor(newDims.w / 2) - 4;
      startY = Math.floor(newDims.h / 2) - 4;
    }

    // Generate collisions and triggers
    if (cfg.generateCollisions) {
      const cellSize = 8;
      const collectCells = (...types) => {
        const cells = [];
        for (let ty = 0; ty < rows; ty++) {
          for (let tx = 0; tx < cols; tx++) {
            if (types.includes(tileGrid[ty][tx])) {
              cells.push({ x: tx * cellSize, y: ty * cellSize });
            }
          }
        }
        return cells;
      };

      if (sceneType === 'TOPDOWN') {
        const waterCells = collectCells('water');
        if (waterCells.length > 0) {
          const rects = combineCellsToRectangles(waterCells);
          const groupId = Date.now() + Math.random();
          const t0 = updatedTriggers.length;
          rects.forEach((rect, idx) => {
            updatedTriggers.push({
              id: Date.now() + Math.random() + idx,
              name: `Trigger ${t0 + idx + 1}`,
              type: 'enter',
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height,
              groupId,
              isGenerated: true
            });
          });
          updatedTriggers.push({
            id: groupId,
            name: 'Water',
            isGroup: true,
            type: 'enter',
            script: { nodes: [{ id: 'start', position: { x: 250, y: 100 }, data: { label: 'On Enter' }, type: 'input' }], edges: [] },
            isGenerated: true
          });
        }
      } else if (sceneType === 'BEATEMUP') {
        const streetStartRow = Math.floor(rows * 2 / 3);
        const curbRow = streetStartRow - 1;
        const sidewalkStartRow = Math.max(0, streetStartRow - 3);
        const buildingBaseRow = sidewalkStartRow - 1;

        const solidCells = [];
        for (let ty = 0; ty < buildingBaseRow; ty++) {
          for (let tx = 0; tx < cols; tx++) {
            solidCells.push({ x: tx * cellSize, y: ty * cellSize });
          }
        }
        if (solidCells.length > 0) {
          const rects = combineCellsToRectangles(solidCells);
          const groupId = Date.now() + Math.random();
          const c0 = updatedCollisions.length;
          rects.forEach((rect, idx) => {
            updatedCollisions.push({
              id: Date.now() + Math.random() + idx,
              name: `Collision ${c0 + idx + 1}`,
              type: 'solid',
              x: rect.x, y: rect.y,
              width: rect.width, height: rect.height,
              isPainted: false, groupId,
              isGenerated: true
            });
          });
          updatedCollisions.push({
            id: groupId,
            name: 'Solid',
            isGroup: true, type: 'solid',
            isGenerated: true
          });
        }

        const doorCells = collectCells('door');
        if (doorCells.length > 0) {
          const rects = combineCellsToRectangles(doorCells);
          const groupId = Date.now() + Math.random();
          const t0 = updatedTriggers.length;
          rects.forEach((rect, idx) => {
            updatedTriggers.push({
              id: Date.now() + Math.random() + idx,
              name: `Trigger ${t0 + idx + 1}`,
              type: 'enter',
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height,
              groupId,
              isGenerated: true
            });
          });
          updatedTriggers.push({
            id: groupId,
            name: 'Door',
            isGroup: true,
            type: 'enter',
            script: { nodes: [{ id: 'start', position: { x: 250, y: 100 }, data: { label: 'On Enter' }, type: 'input' }], edges: [] },
            isGenerated: true
          });
        }
      } else if (sceneType === 'METROIDVANIA') {
        const solidCells = collectCells('wall', 'pillar');
        const platformCells = collectCells('platform');

        if (solidCells.length > 0) {
          const rects = combineCellsToRectangles(solidCells);
          const groupId = Date.now() + Math.random();
          const c0 = updatedCollisions.length;
          rects.forEach((rect, idx) => {
            updatedCollisions.push({
              id: Date.now() + Math.random() + idx,
              name: `Collision ${c0 + idx + 1}`,
              type: 'solid',
              x: rect.x, y: rect.y,
              width: rect.width, height: rect.height,
              isPainted: false, groupId,
              isGenerated: true
            });
          });
          updatedCollisions.push({
            id: groupId,
            name: 'Solid',
            isGroup: true, type: 'solid',
            isGenerated: true
          });
        }

        if (platformCells.length > 0) {
          const rects = combineCellsToRectangles(platformCells);
          const groupId = Date.now() + Math.random();
          const c0 = updatedCollisions.length;
          rects.forEach((rect, idx) => {
            updatedCollisions.push({
              id: Date.now() + Math.random() + idx,
              name: `Collision ${c0 + idx + 1}`,
              type: 'top',
              x: rect.x, y: rect.y,
              width: rect.width, height: rect.height,
              isPainted: false, groupId,
              isGenerated: true
            });
          });
          updatedCollisions.push({
            id: groupId,
            name: 'Top',
            isGroup: true, type: 'top',
            isGenerated: true
          });
        }

        const stalactiteCells = collectCells('stalactite');
        if (stalactiteCells.length > 0) {
          const rects = combineCellsToRectangles(stalactiteCells);
          const groupId = Date.now() + Math.random();
          const t0 = updatedTriggers.length;
          rects.forEach((rect, idx) => {
            updatedTriggers.push({
              id: Date.now() + Math.random() + idx,
              name: `Trigger ${t0 + idx + 1}`,
              type: 'enter',
              x: rect.x, y: rect.y,
              width: rect.width, height: rect.height,
              groupId,
              isGenerated: true
            });
          });
          updatedTriggers.push({
            id: groupId,
            name: 'Stalactites',
            isGroup: true, type: 'enter',
            script: { nodes: [{ id: 'start', position: { x: 250, y: 100 }, data: { label: 'On Enter' }, type: 'input' }], edges: [] },
            isGenerated: true
          });
        }

        const vineCells = collectCells('vine');
        if (vineCells.length > 0) {
          const rects = combineCellsToRectangles(vineCells);
          const groupId = Date.now() + Math.random();
          const c0 = updatedCollisions.length;
          rects.forEach((rect, idx) => {
            updatedCollisions.push({
              id: Date.now() + Math.random() + idx,
              name: `Collision ${c0 + idx + 1}`,
              type: 'ladder',
              x: rect.x, y: rect.y,
              width: rect.width, height: rect.height,
              isPainted: false, groupId,
              isGenerated: true
            });
          });
          updatedCollisions.push({
            id: groupId,
            name: 'Ladder',
            isGroup: true, type: 'ladder',
            isGenerated: true
          });
        }
      } else if (sceneType === 'PLATFORMER') {
        const solidCells = collectCells('brick', 'groundTop');
        const hazardCells = collectCells('hazard');
        const platformCells = collectCells('platform');
        const ladderCells = collectCells('ladder');

        if (solidCells.length > 0) {
          const rects = combineCellsToRectangles(solidCells);
          const groupId = Date.now() + Math.random();
          const c0 = updatedCollisions.length;
          rects.forEach((rect, idx) => {
            updatedCollisions.push({
              id: Date.now() + Math.random() + idx,
              name: `Collision ${c0 + idx + 1}`,
              type: 'solid',
              x: rect.x, y: rect.y,
              width: rect.width, height: rect.height,
              isPainted: false, groupId,
              isGenerated: true
            });
          });
          updatedCollisions.push({
            id: groupId,
            name: 'Solid',
            isGroup: true, type: 'solid',
            isGenerated: true
          });
        }

        if (hazardCells.length > 0) {
          const rects = combineCellsToRectangles(hazardCells);
          const groupId = Date.now() + Math.random();
          const t0 = updatedTriggers.length;
          rects.forEach((rect, idx) => {
            updatedTriggers.push({
              id: Date.now() + Math.random() + idx,
              name: `Trigger ${t0 + idx + 1}`,
              type: 'enter',
              x: rect.x, y: rect.y,
              width: rect.width, height: rect.height,
              groupId,
              isGenerated: true
            });
          });
          updatedTriggers.push({
            id: groupId,
            name: 'Death Pits',
            isGroup: true, type: 'enter',
            script: { nodes: [{ id: 'start', position: { x: 250, y: 100 }, data: { label: 'On Enter' }, type: 'input' }], edges: [] },
            isGenerated: true
          });
        }

        if (platformCells.length > 0) {
          const rects = combineCellsToRectangles(platformCells);
          const groupId = Date.now() + Math.random();
          const c0 = updatedCollisions.length;
          rects.forEach((rect, idx) => {
            updatedCollisions.push({
              id: Date.now() + Math.random() + idx,
              name: `Collision ${c0 + idx + 1}`,
              type: 'top',
              x: rect.x, y: rect.y,
              width: rect.width, height: rect.height,
              isPainted: false, groupId,
              isGenerated: true
            });
          });
          updatedCollisions.push({
            id: groupId,
            name: 'Top',
            isGroup: true, type: 'top',
            isGenerated: true
          });
        }

        if (ladderCells.length > 0) {
          const rects = combineCellsToRectangles(ladderCells);
          const groupId = Date.now() + Math.random();
          const c0 = updatedCollisions.length;
          rects.forEach((rect, idx) => {
            updatedCollisions.push({
              id: Date.now() + Math.random() + idx,
              name: `Collision ${c0 + idx + 1}`,
              type: 'ladder',
              x: rect.x, y: rect.y,
              width: rect.width, height: rect.height,
              isPainted: false, groupId,
              isGenerated: true
            });
          });
          updatedCollisions.push({
            id: groupId,
            name: 'Ladder',
            isGroup: true, type: 'ladder',
            isGenerated: true
          });
        }
      } else if (sceneType === 'RACING') {
        const borderCells = collectCells('border');
        const borderEdgeSet = new Set();
        for (let ty = 0; ty < rows; ty++) {
          for (let tx = 0; tx < cols; tx++) {
            if (tileGrid[ty][tx] !== 'border') continue;
            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                if (dy === 0 && dx === 0) continue;
                const ny = ty + dy;
                const nx = tx + dx;
                if (ny >= 0 && ny < rows && nx >= 0 && nx < cols) {
                  const nt = tileGrid[ny][nx];
                  if (nt !== 'track' && nt !== 'border' && nt !== 'gap') {
                    borderEdgeSet.add(`${ny},${nx}`);
                  }
                }
              }
            }
          }
        }
        const borderEdgeCells = [...borderEdgeSet].map(k => {
          const [y, x] = k.split(',').map(Number);
          return { x: x * 8, y: y * 8 };
        });
        const obstacleCells = collectCells('obstacle');
        const finishCells = collectCells('finish');

        if (borderCells.length > 0) {
          const rects = combineCellsToRectangles(borderCells);
          const groupId = Date.now() + Math.random();
          const t0 = updatedTriggers.length;
          rects.forEach((rect, idx) => {
            updatedTriggers.push({
              id: Date.now() + Math.random() + idx,
              name: `Trigger ${t0 + idx + 1}`,
              type: 'enter',
              x: rect.x, y: rect.y,
              width: rect.width, height: rect.height,
              groupId,
              isGenerated: true
            });
          });
          updatedTriggers.push({
            id: groupId,
            name: 'Border',
            isGroup: true, type: 'enter',
            script: { nodes: [{ id: 'start', position: { x: 250, y: 100 }, data: { label: 'On Enter' }, type: 'input' }], edges: [] },
            isGenerated: true
          });
        }

        if (borderEdgeCells.length > 0) {
          const rects = combineCellsToRectangles(borderEdgeCells);
          const groupId = Date.now() + Math.random();
          const c0 = updatedCollisions.length;
          rects.forEach((rect, idx) => {
            updatedCollisions.push({
              id: Date.now() + Math.random() + idx,
              name: `Collision ${c0 + idx + 1}`,
              type: 'solid',
              x: rect.x, y: rect.y,
              width: rect.width, height: rect.height,
              isPainted: false, groupId,
              isGenerated: true
            });
          });
          updatedCollisions.push({
            id: groupId,
            name: 'Solid',
            isGroup: true, type: 'solid',
            isGenerated: true
          });
        }

        if (obstacleCells.length > 0) {
          const rects = combineCellsToRectangles(obstacleCells);
          const groupId = Date.now() + Math.random();
          const t0 = updatedTriggers.length;
          rects.forEach((rect, idx) => {
            updatedTriggers.push({
              id: Date.now() + Math.random() + idx,
              name: `Trigger ${t0 + idx + 1}`,
              type: 'enter',
              x: rect.x, y: rect.y,
              width: rect.width, height: rect.height,
              groupId,
              isGenerated: true
            });
          });
          updatedTriggers.push({
            id: groupId,
            name: 'Obstacles',
            isGroup: true, type: 'enter',
            script: { nodes: [{ id: 'start', position: { x: 250, y: 100 }, data: { label: 'On Enter' }, type: 'input' }], edges: [] },
            isGenerated: true
          });
        }

        if (finishCells.length > 0) {
          const rects = combineCellsToRectangles(finishCells);
          const groupId = Date.now() + Math.random();
          const t0 = updatedTriggers.length;
          rects.forEach((rect, idx) => {
            updatedTriggers.push({
              id: Date.now() + Math.random() + idx,
              name: `Trigger ${t0 + idx + 1}`,
              type: 'leave',
              x: rect.x, y: rect.y,
              width: rect.width, height: rect.height,
              groupId,
              isGenerated: true
            });
          });
          updatedTriggers.push({
            id: groupId,
            name: 'Finish Line',
            isGroup: true, type: 'leave',
            script: { nodes: [{ id: 'start', position: { x: 250, y: 100 }, data: { label: 'On Leave' }, type: 'input' }], edges: [] },
            isGenerated: true
          });
        }

        if (cfg.trackGaps && gapTriggerCells.length > 0) {
          const rects = combineCellsToRectangles(gapTriggerCells);
          const groupId = Date.now() + Math.random();
          const t0 = updatedTriggers.length;
          rects.forEach((rect, idx) => {
            updatedTriggers.push({
              id: Date.now() + Math.random() + idx,
              name: `Trigger ${t0 + idx + 1}`,
              type: 'enter',
              x: rect.x, y: rect.y,
              width: rect.width, height: rect.height,
              groupId,
              isGenerated: true
            });
          });
          updatedTriggers.push({
            id: groupId,
            name: 'Gaps',
            isGroup: true, type: 'enter',
            script: { nodes: [{ id: 'start', position: { x: 250, y: 100 }, data: { label: 'On Enter' }, type: 'input' }], edges: [] },
            isGenerated: true
          });
        }
      } else if (sceneType === 'SHMUP') {
        if (cfg.shmupGround && !cfg.shmupTopDown) {
          const groundCells = collectCells('ground');
          if (groundCells.length > 0) {
            const rects = combineCellsToRectangles(groundCells);
            const groupId = Date.now() + Math.random();
            const c0 = updatedCollisions.length;
            rects.forEach((rect, idx) => {
              updatedCollisions.push({
                id: Date.now() + Math.random() + idx,
                name: `Collision ${c0 + idx + 1}`,
                type: 'solid',
                x: rect.x, y: rect.y,
                width: rect.width, height: rect.height,
                isPainted: false, groupId,
                isGenerated: true
              });
            });
            updatedCollisions.push({
              id: groupId,
              name: 'Solid',
              isGroup: true, type: 'solid',
              isGenerated: true
            });
          }
        }
      }
    }

    // Update state — append new layer and ensure player actor exists
    let generatedSceneData = null;
    currentScenes.forEach(s => {
      if (s.id === sceneId) {
        let hasPlayer = (s.actors || []).some(a => a.type === 'player') || 
          (globalActorsRef.current || []).some(a => a.type === 'player' && (s.globalActorIds || []).includes(a.id));
        let updatedActors = s.actors || [];
        if (!hasPlayer) {
          const newPlayer = {
            id: Date.now() + Math.random(),
            name: 'Player',
            type: 'player',
            x: startX,
            y: startY,
            width: 8,
            height: 8,
            color: '#65ff00',
            spriteId: sceneType === 'SHMUP' ? 24 : (sceneType === 'RACING' ? 27 : 1),
            isHidden: false,
            hflip: true,
            attackAnimId: null,
            script: { nodes: [{ id: 'start', position: { x: 250, y: 100 }, data: { label: 'On Update' }, type: 'input' }], edges: [] }
          };
          updatedActors = [...updatedActors, newPlayer];
        } else {
          updatedActors = updatedActors.map(a => {
            if (a.type === 'player') {
              let newSpriteId = a.spriteId;
              if (sceneType === 'SHMUP' && (a.spriteId === 1 || a.spriteId === '1')) {
                newSpriteId = 24;
              } else if (sceneType === 'RACING' && (a.spriteId === 1 || a.spriteId === '1')) {
                newSpriteId = 27;
              }
              return {
                ...a,
                x: startX,
                y: startY,
                spriteId: newSpriteId
              };
            }
            return a;
          });
        }
        const generatedLayers = [];
        generatedLayers.push(newLayer);
        if (caveBgLayer) {
          generatedLayers.push(caveBgLayer);
        }
        if (cloudLayer) {
          generatedLayers.push(cloudLayer);
        }
        if (platformCloudLayer) {
          generatedLayers.push(platformCloudLayer);
        }
        if (skyBgLayer) {
          generatedLayers.push(skyBgLayer);
        }
        generatedSceneData = {
          ...s,
          ...(sceneType === 'RACING' && { 
            showCountdown: cfg.showCountdown !== undefined ? cfg.showCountdown : true,
            lapsToFinish: cfg.lapsToFinish !== undefined ? cfg.lapsToFinish : 3,
            useVarLaps: cfg.useVarLaps !== undefined ? cfg.useVarLaps : false,
            lapsVar: cfg.lapsVar || '',
            maxSpeed: s.maxSpeed !== undefined ? s.maxSpeed : 1.0,
            acceleration: s.acceleration !== undefined ? s.acceleration : 0.01,
            steeringSpeed: s.steeringSpeed !== undefined ? s.steeringSpeed : 0.5,
            friction: s.friction !== undefined ? s.friction : 0.5
          }),
          ...(sceneType === 'BEATEMUP' && {
            horizontalSpeed: s.horizontalSpeed !== undefined ? s.horizontalSpeed : 1.5,
            verticalSpeed: s.verticalSpeed !== undefined ? s.verticalSpeed : 1.0,
            friction: s.friction !== undefined ? s.friction : 0.2
          }),
          ...(cfg.mode7Layout && { mode7: true, mode7Phi: 0 }),
          actors: updatedActors,
          collisions: updatedCollisions,
          triggers: updatedTriggers,
          frames: [{ ...s.frames[0], layers: [...generatedLayers, ...s.frames[0].layers.filter(l => l.name !== 'Level Design' && l.name !== 'Cave Background' && l.name !== 'Sky Background' && l.name !== 'Clouds' && l.name !== 'Sky & Clouds' && l.name !== 'Background')] }]
        };
      }
    });

    const latestScenes = scenesRef.current;
    const updatedScenes = latestScenes.map(s => s.id === sceneId && generatedSceneData ? { ...generatedSceneData, globalActorIds: s.globalActorIds, globalActorPositions: s.globalActorPositions } : s);
    if (!latestScenes.some(s => s.id === sceneId) && generatedSceneData) {
      updatedScenes.push(generatedSceneData);
    }

    scenesRef.current = updatedScenes;
    setScenes(updatedScenes);

    if (isActive) {
      const generatedLayers = [];
      generatedLayers.push(newLayer);
      if (caveBgLayer) {
        generatedLayers.push(caveBgLayer);
      }
      if (cloudLayer) {
        generatedLayers.push(cloudLayer);
      }
      if (platformCloudLayer) {
        generatedLayers.push(platformCloudLayer);
      }
      if (skyBgLayer) {
        generatedLayers.push(skyBgLayer);
      }
      const updatedActiveLayers = [...generatedLayers, ...targetFrame.layers.filter(l => l.name !== 'Level Design' && l.name !== 'Cave Background' && l.name !== 'Sky Background' && l.name !== 'Clouds' && l.name !== 'Sky & Clouds' && l.name !== 'Background')];
      setLayers(updatedActiveLayers);
      setDimensions(newDims);
      const activeSceneObj = updatedScenes.find(s => s.id === sceneId);
      if (activeSceneObj && activeSceneObj.actors) {
        setActors(activeSceneObj.actors);
      }
      setCollisions(updatedCollisions);
      setTriggers(updatedTriggers);
      
      // Auto-create pause scene for racing scenes if none exists
      if (sceneType === 'RACING') {
        const hasPauseScene = updatedScenes.some(s => s.type === 'PAUSE');
        if (!hasPauseScene) {
          const pauseDims = { w: 256, h: 256 };
          const pauseLayer = createEmptyLayer('Background', null, pauseDims.w, pauseDims.h);
          // Fill with black
          for (let y = 0; y < pauseDims.h; y++) {
            for (let x = 0; x < pauseDims.w; x++) {
              pauseLayer.data[y][x] = '#000000';
            }
          }
          const pauseFrame = { id: 'frame-1', layers: [pauseLayer] };
          const pauseScene = {
            id: Date.now() + Math.random(),
            name: 'Pause Screen',
            type: 'PAUSE',
            frames: [pauseFrame],
            globalActorIds: [],
            globalActorPositions: {},
            actors: [],
            triggers: [],
            collisions: [],
            musicId: null,
            dimensions: pauseDims,
            worldX: 0,
            worldY: 0,
            script: { nodes: [{ id: 'start', position: { x: 250, y: 100 }, data: { label: 'On Start' }, type: 'input' }], edges: [] }
          };
          updatedScenes.push(pauseScene);
        }
      }
      
      saveHistory("Procedurally Generate Level", updatedActiveLayers, newDims, {
        scenes: updatedScenes,
        recentColors: updatedPalette,
        collisions: updatedCollisions,
        triggers: updatedTriggers
      });
    } else {
      saveHistory("Procedurally Generate Level", targetFrame.layers, newDims, {
        scenes: updatedScenes,
        recentColors: updatedPalette,
        collisions: updatedCollisions,
        triggers: updatedTriggers
      });
    }

    toast.success(`Procedurally generated ${sceneType.toLowerCase()} level design!`);
  }, [savedTiles, activeSceneId, layers, dimensions, setScenes, setLayers, saveHistory, triggers, setTriggers, collisions, setCollisions, recentColors, globalActors, setRecentColors]);

  const [showAdjustSelectionDialog, setShowAdjustSelectionDialog] = useState(false);
  const [adjustSelectionAmount, setAdjustSelectionAmount] = useState(0);
  const [originalSelection, setOriginalSelection] = useState(null);

  const openAdjustSelectionDialog = useCallback(() => {
    if (!selection || selection.size === 0) return;
    setOriginalSelection(new Set(selection));
    setAdjustSelectionAmount(0);
    setShowAdjustSelectionDialog(true);
  }, [selection]);

  const closeAdjustSelectionDialog = useCallback((apply) => {
    if (!apply && originalSelection) {
      setSelection(new Set(originalSelection));
    }
    setShowAdjustSelectionDialog(false);
    setOriginalSelection(null);
  }, [originalSelection]);

  const updateAdjustedSelection = useCallback((amount) => {
    setAdjustSelectionAmount(amount);
    if (!originalSelection) return;
    if (amount === 0) {
      setSelection(new Set(originalSelection));
      return;
    }

    const newSelection = new Set();
    const absAmount = Math.abs(amount);

    if (amount > 0) {
      originalSelection.forEach(key => {
        const [x, y] = key.split(',').map(Number);
        for (let dy = -absAmount; dy <= absAmount; dy++) {
          for (let dx = -absAmount; dx <= absAmount; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < dimensions.w && ny >= 0 && ny < dimensions.h) {
              newSelection.add(`${nx},${ny}`);
            }
          }
        }
      });
    } else {
      originalSelection.forEach(key => {
        const [x, y] = key.split(',').map(Number);
        let keep = true;
        for (let dy = -absAmount; dy <= absAmount; dy++) {
          for (let dx = -absAmount; dx <= absAmount; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || nx >= dimensions.w || ny < 0 || ny >= dimensions.h || !originalSelection.has(`${nx},${ny}`)) {
              keep = false;
              break;
            }
          }
          if (!keep) break;
        }
        if (keep) newSelection.add(key);
      });
    }
    setSelection(newSelection);
  }, [originalSelection, dimensions]);

  const [showImageMenu, setShowImageMenu] = useState(false);
  const [showHSLDialog, setShowHSLDialog] = useState(false);
  const [hslSettings, setHslSettings] = useState({ h: 0, s: 0, l: 0 });
  const [hslOriginalData, setHslOriginalData] = useState(null);

  const openHSLDialog = useCallback(() => {
    if (!activeLayer) return;
    setHslOriginalData(activeLayer.data.map(row => [...row]));
    setHslSettings({ h: 0, s: 0, l: 0 });
    setShowHSLDialog(true);
  }, [activeLayer]);

  const closeHSLDialog = useCallback((apply) => {
    if (apply) {
      saveHistory("Hue/Saturation", layers);
    } else {
      setLayers(prev => prev.map(layer => layer.id === activeLayerId ? { ...layer, data: hslOriginalData.map(row => [...row]) } : layer));
    }
    setShowHSLDialog(false);
    setHslOriginalData(null);
  }, [hslOriginalData, activeLayerId, saveHistory, layers]);

  useEffect(() => {
    if (!showHSLDialog || !hslOriginalData || !activeLayer) return;
    const { h, s, l } = hslSettings;

    const newData = hslOriginalData.map((row, y) => row.map((color, x) => {
      if (!color) return null;
      if (selection && selection.size > 0 && !selection.has(`${x},${y}`)) return color;
      if (h === 0 && s === 0 && l === 0) return color;
      return adjustHslHex(color, h, s, l);
    }));

    setLayers(prev => prev.map(layer => layer.id === activeLayerId ? { ...layer, data: newData } : layer));
  }, [hslSettings, showHSLDialog, hslOriginalData, activeLayerId, selection, activeLayer]);

  const [showBCDialog, setShowBCDialog] = useState(false);
  const [bcSettings, setBcSettings] = useState({ b: 0, c: 0 });
  const [bcOriginalData, setBcOriginalData] = useState(null);

  const openBCDialog = useCallback(() => {
    if (!activeLayer) return;
    setBcOriginalData(activeLayer.data.map(row => [...row]));
    setBcSettings({ b: 0, c: 0 });
    setShowBCDialog(true);
  }, [activeLayer]);

  const closeBCDialog = useCallback((apply) => {
    if (apply) {
      saveHistory("Brightness/Contrast", layers);
    } else {
      setLayers(prev => prev.map(layer => layer.id === activeLayerId ? { ...layer, data: bcOriginalData.map(row => [...row]) } : layer));
    }
    setShowBCDialog(false);
    setBcOriginalData(null);
  }, [bcOriginalData, activeLayerId, saveHistory, layers]);

  useEffect(() => {
    if (!showBCDialog || !bcOriginalData || !activeLayer) return;
    const { b, c } = bcSettings;

    const newData = bcOriginalData.map((row, y) => row.map((color, x) => {
      if (!color) return null;
      if (selection && selection.size > 0 && !selection.has(`${x},${y}`)) return color;
      if (b === 0 && c === 0) return color;
      return adjustBrightnessContrastHex(color, b, c);
    }));

    setLayers(prev => prev.map(layer => layer.id === activeLayerId ? { ...layer, data: newData } : layer));
  }, [bcSettings, showBCDialog, bcOriginalData, activeLayerId, selection, activeLayer]);

  const invertColors = useCallback(() => {
    if (!activeLayer || activeLayer.type === 'group') return;

    const newLayers = layers.map(layer => {
      if (layer.id !== activeLayerId || layer.type === 'group') return layer;

      const newData = layer.data.map((row, y) => {
        return row.map((color, x) => {
          if (selection && selection.size > 0 && !selection.has(`${x},${y}`)) {
            return color;
          }
          return invertHex(color);
        });
      });
      return { ...layer, data: newData, textData: null };
    });

    setLayers(newLayers);
    saveHistory("Invert", newLayers);
  }, [activeLayer, activeLayerId, layers, selection, saveHistory]);

  const [showMagicBgDialog, setShowMagicBgDialog] = useState(false);
  const [magicBgSettings, setMagicBgSettings] = useState({ tolerance: 0, fuzziness: 0, contiguous: true });
  const [magicBgOriginalData, setMagicBgOriginalData] = useState(null);
  const [showMapOverviewDialog, setShowMapOverviewDialog] = useState(false);
  const [isMusicEditorOpen, setIsMusicEditorOpen] = useState(false);

  const [showResizeCanvasDialog, setShowResizeCanvasDialog] = useState(false);
  const [resizeCanvasSettings, setResizeCanvasSettings] = useState({ w: 240, h: 160, anchor: 'center' });

  const openResizeCanvasDialog = useCallback(() => {
    setResizeCanvasSettings({ w: dimensions.w, h: dimensions.h, anchor: 'center' });
    setShowResizeCanvasDialog(true);
  }, [dimensions]);

  const handleResizeCanvas = useCallback((apply) => {
    if (apply) {
      const { w: newW, h: newH, anchor } = resizeCanvasSettings;
      if (newW === dimensions.w && newH === dimensions.h) {
        setShowResizeCanvasDialog(false);
        return;
      }
      if (newW < 1 || newH < 1) return;

      const oldW = dimensions.w;
      const oldH = dimensions.h;

      let offsetX = 0;
      let offsetY = 0;

      if (anchor === 'top-left') { offsetX = 0; offsetY = 0; }
      else if (anchor === 'top-center') { offsetX = Math.floor((newW - oldW) / 2); offsetY = 0; }
      else if (anchor === 'top-right') { offsetX = newW - oldW; offsetY = 0; }
      else if (anchor === 'center-left') { offsetX = 0; offsetY = Math.floor((newH - oldH) / 2); }
      else if (anchor === 'center') { offsetX = Math.floor((newW - oldW) / 2); offsetY = Math.floor((newH - oldH) / 2); }
      else if (anchor === 'center-right') { offsetX = newW - oldW; offsetY = Math.floor((newH - oldH) / 2); }
      else if (anchor === 'bottom-left') { offsetX = 0; offsetY = newH - oldH; }
      else if (anchor === 'bottom-center') { offsetX = Math.floor((newW - oldW) / 2); offsetY = newH - oldH; }
      else if (anchor === 'bottom-right') { offsetX = newW - oldW; offsetY = newH - oldH; }

      const resizeLayers = (layerList) => layerList.map(l => {
        if (l.type === 'group') return l;

        const newData = Array(newH).fill(null).map(() => Array(newW).fill(null));

        for (let y = 0; y < oldH; y++) {
          for (let x = 0; x < oldW; x++) {
            const targetX = x + offsetX;
            const targetY = y + offsetY;
            if (targetX >= 0 && targetX < newW && targetY >= 0 && targetY < newH) {
              if (l.data[y] && l.data[y][x] !== undefined) {
                newData[targetY][targetX] = l.data[y][x];
              }
            }
          }
        }
        return { ...l, data: newData };
      });

      const nextFrames = frames.map(f => ({ ...f, layers: resizeLayers(f.layers) }));
      setFrames(nextFrames);
      const newLayers = nextFrames.find(f => f.id === activeFrameId).layers;
      setLayers(newLayers);
      setDimensions({ w: newW, h: newH });
      setSelection(null);
      saveHistory("Resize Canvas", newLayers, { w: newW, h: newH });

      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          const availableW = rect.width - 60;
          const availableH = rect.height - 60;
          setZoom(Math.max(0.1, Math.min(4, Math.min(availableW / newW, availableH / newH))));
          setPanOffset({ x: 0, y: 0 });
        }
      }
    }
    setShowResizeCanvasDialog(false);
  }, [resizeCanvasSettings, dimensions, layers, saveHistory]);

  const openMagicBgDialog = useCallback(() => {
    if (!activeLayer || activeLayer.type === 'group') return;
    setMagicBgOriginalData(activeLayer.data.map(row => [...row]));
    setMagicBgSettings({ tolerance: 0, fuzziness: 0, contiguous: true });
    setShowMagicBgDialog(true);
  }, [activeLayer]);

  const closeMagicBgDialog = useCallback((apply) => {
    if (apply) {
      saveHistory("Magic BG Removal", layers);
      toast.success("Background removed!");
    } else {
      setLayers(prev => prev.map(layer => layer.id === activeLayerId ? { ...layer, data: magicBgOriginalData.map(row => [...row]) } : layer));
    }
    setShowMagicBgDialog(false);
    setMagicBgOriginalData(null);
  }, [magicBgOriginalData, activeLayerId, saveHistory, layers]);

  useEffect(() => {
    if (!showMagicBgDialog || !magicBgOriginalData || !activeLayer) return;
    const { tolerance = 0, fuzziness = 0, contiguous = true } = magicBgSettings;

    const w = dimensions.w;
    const h = dimensions.h;

    const borderColors = {};
    for (let x = 0; x < w; x++) {
      const c1 = magicBgOriginalData[0][x];
      const c2 = magicBgOriginalData[h - 1][x];
      if (c1) borderColors[c1] = (borderColors[c1] || 0) + 1;
      if (c2) borderColors[c2] = (borderColors[c2] || 0) + 1;
    }
    for (let y = 0; y < h; y++) {
      const c1 = magicBgOriginalData[y][0];
      const c2 = magicBgOriginalData[y][w - 1];
      if (c1) borderColors[c1] = (borderColors[c1] || 0) + 1;
      if (c2) borderColors[c2] = (borderColors[c2] || 0) + 1;
    }

    let bgColor = null;
    let maxCount = 0;
    for (const [color, count] of Object.entries(borderColors)) {
      if (count > maxCount) {
        maxCount = count;
        bgColor = color;
      }
    }

    if (!bgColor) {
      return;
    }

    const parseHexLocal = (hexStr) => {
      if (!hexStr) return null;
      const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})?$/i.exec(hexStr);
      if (!match) return null;
      return {
        r: parseInt(match[1], 16),
        g: parseInt(match[2], 16),
        b: parseInt(match[3], 16),
        a: match[4] ? parseInt(match[4], 16) : 255
      };
    };

    const bgRgb = parseHexLocal(bgColor);
    if (!bgRgb) return;

    const getColorDistance = (hex) => {
      if (!hex) return Infinity;
      if (hex === bgColor) return 0;
      const rgb = parseHexLocal(hex);
      if (!rgb) return Infinity;
      return Math.sqrt(Math.pow(rgb.r - bgRgb.r, 2) + Math.pow(rgb.g - bgRgb.g, 2) + Math.pow(rgb.b - bgRgb.b, 2));
    };

    const newData = magicBgOriginalData.map(row => [...row]);

    if (contiguous) {
      const stack = [];
      const visited = new Set();

      // Start flood fill from all border pixels matching bgColor within total fuzzy radius
      for (let x = 0; x < w; x++) {
        if (getColorDistance(newData[0][x]) <= tolerance + fuzziness) stack.push([x, 0]);
        if (getColorDistance(newData[h - 1][x]) <= tolerance + fuzziness) stack.push([x, h - 1]);
      }
      for (let y = 0; y < h; y++) {
        if (getColorDistance(newData[y][0]) <= tolerance + fuzziness) stack.push([0, y]);
        if (getColorDistance(newData[y][w - 1]) <= tolerance + fuzziness) stack.push([w - 1, y]);
      }

      while (stack.length > 0) {
        const [cx, cy] = stack.pop();
        const key = `${cx},${cy}`;
        if (visited.has(key)) continue;
        visited.add(key);

        if (cx >= 0 && cx < w && cy >= 0 && cy < h) {
          const hex = newData[cy][cx];
          if (!hex) continue;
          const dist = getColorDistance(hex);

          if (dist <= tolerance) {
            newData[cy][cx] = null;
            stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
          } else if (dist <= tolerance + fuzziness) {
            const alphaRatio = 1 - ((dist - tolerance) / fuzziness);
            const rgb = parseHexLocal(hex);
            const newAlpha = Math.round((rgb.a / 255) * alphaRatio * 255);
            if (newAlpha === 0) newData[cy][cx] = null;
            else newData[cy][cx] = hex.substring(0, 7) + newAlpha.toString(16).padStart(2, '0');
          }
        }
      }
    } else {
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const hex = newData[y][x];
          if (!hex) continue;
          const dist = getColorDistance(hex);
          if (dist <= tolerance) {
            newData[y][x] = null;
          } else if (dist <= tolerance + fuzziness) {
            const alphaRatio = 1 - ((dist - tolerance) / fuzziness);
            const rgb = parseHexLocal(hex);
            const newAlpha = Math.round((rgb.a / 255) * alphaRatio * 255);
            if (newAlpha === 0) newData[y][x] = null;
            else newData[y][x] = hex.substring(0, 7) + newAlpha.toString(16).padStart(2, '0');
          }
        }
      }
    }

    setLayers(prev => prev.map(layer => layer.id === activeLayerId ? { ...layer, data: newData } : layer));
  }, [magicBgSettings, showMagicBgDialog, magicBgOriginalData, activeLayerId, dimensions, activeLayer]);

  const renderLayersToCtx = useCallback((ctx, zoomLevel, layersToRender = layers, customDims = null) => {
    ctx.imageSmoothingEnabled = isPixelated ? false : true;

    const dims = customDims || dimensions;
    const groupVisibility = {};
    layers.forEach(l => {
      if (l.type === 'group') groupVisibility[String(l.id)] = l.visible;
    });

    if (!sharedOffCanvas) {
      sharedOffCanvas = document.createElement('canvas');
      sharedOutlineCanvas = document.createElement('canvas');
      sharedPCanvas = document.createElement('canvas');
    }

    const offCanvas = sharedOffCanvas;
    if (offCanvas.width !== dims.w) offCanvas.width = dims.w;
    if (offCanvas.height !== dims.h) offCanvas.height = dims.h;
    const offCtx = offCanvas.getContext('2d', { willReadFrequently: true });

    [...layersToRender].reverse().forEach(layer => {
      if (layer.type === 'group') return;
      if (tool === 'text' && layer.id === editingTextLayerId) return;
      const isGroupVisible = layer.groupId ? groupVisibility[String(layer.groupId)] !== false : true;
      if (!layer.visible && layersToRender === layers) return;
      if (!isGroupVisible && layersToRender === layers) return;

      offCtx.clearRect(0, 0, dims.w, dims.h);

      const imgData = offCtx.createImageData(dims.w, dims.h);
      const data32 = new Uint32Array(imgData.data.buffer);

      const isMovingLayer = (tool === 'moveLayer' && layer.id === activeLayerId && isDrawing);
      const isMovingSelection = (tool === 'move' && layer.id === activeLayerId && isDrawing);

      for (let y = 0; y < dims.h; y++) {
        const row = layer.data[y];
        if (!row) continue;
        for (let x = 0; x < dims.w; x++) {
          const color = row[x];
          if (color) {
            let drawX = x;
            let drawY = y;

            if (isMovingLayer) {
              drawX += moveOffset.x;
              drawY += moveOffset.y;
            } else if (isMovingSelection && selection?.has(`${x},${y}`)) {
              drawX += moveOffset.x;
              drawY += moveOffset.y;
            }

            if (drawX >= 0 && drawX < dims.w && drawY >= 0 && drawY < dims.h) {
              data32[drawY * dims.w + drawX] = parseColorTo32(color);
            }
          }
        }
      }
      offCtx.putImageData(imgData, 0, 0);

      if (layer.pixelate && layer.pixelateSize > 1) {
        const pSize = layer.pixelateSize;
        const pW = Math.max(1, Math.ceil(dims.w / pSize));
        const pH = Math.max(1, Math.ceil(dims.h / pSize));
        const pCanvas = sharedPCanvas;
        if (pCanvas.width !== pW) pCanvas.width = pW;
        if (pCanvas.height !== pH) pCanvas.height = pH;
        const pCtx = pCanvas.getContext('2d');
        pCtx.imageSmoothingEnabled = false;
        pCtx.clearRect(0, 0, pW, pH);
        pCtx.drawImage(offCanvas, 0, 0, dims.w, dims.h, 0, 0, pW, pH);
        offCtx.clearRect(0, 0, dims.w, dims.h);
        offCtx.imageSmoothingEnabled = false;
        offCtx.drawImage(pCanvas, 0, 0, pW, pH, 0, 0, dims.w, dims.h);
      }

      if (layer.distort && layer.distortAmount > 0) {
        const dAmount = layer.distortAmount;
        const dScale = layer.distortScale || 10;
        const currentImgData = offCtx.getImageData(0, 0, dims.w, dims.h);
        const outData = offCtx.createImageData(dims.w, dims.h);
        for (let y = 0; y < dims.h; y++) {
          const xOffset = Math.sin(y / dScale) * dAmount;
          for (let x = 0; x < dims.w; x++) {
            const srcX = Math.floor(x - xOffset);
            if (srcX >= 0 && srcX < dims.w) {
              const srcIdx = (y * dims.w + srcX) * 4;
              const dstIdx = (y * dims.w + x) * 4;
              outData.data[dstIdx] = currentImgData.data[srcIdx];
              outData.data[dstIdx + 1] = currentImgData.data[srcIdx + 1];
              outData.data[dstIdx + 2] = currentImgData.data[srcIdx + 2];
              outData.data[dstIdx + 3] = currentImgData.data[srcIdx + 3];
            }
          }
        }
        offCtx.putImageData(outData, 0, 0);
      }

      if (layer.colorOverlay) {
        offCtx.save();
        offCtx.globalCompositeOperation = 'source-atop';
        offCtx.globalAlpha = layer.colorOverlayOpacity ?? 1;
        offCtx.fillStyle = layer.colorOverlayColor || '#ff0000';
        offCtx.fillRect(0, 0, dims.w, dims.h);
        offCtx.restore();
      }

      if (layer.gradientOverlay) {
        offCtx.save();
        offCtx.globalCompositeOperation = 'source-atop';
        offCtx.globalAlpha = layer.gradientOverlayOpacity ?? 1;
        const grad = offCtx.createLinearGradient(0, 0, 0, dims.h);
        grad.addColorStop(0, layer.gradientOverlayColor1 || '#ffffff');
        grad.addColorStop(1, layer.gradientOverlayColor2 || '#000000');
        offCtx.fillStyle = grad;
        offCtx.fillRect(0, 0, dims.w, dims.h);
        offCtx.restore();
      }

      ctx.save();
      ctx.globalAlpha = layer.opacity ?? 1;
      ctx.globalCompositeOperation = layer.clipping ? 'source-atop' : (layer.blendMode || 'source-over');

      if (layer.blur) {
        ctx.filter = `blur(${(layer.blurAmount ?? 1) * zoomLevel}px)`;
      }

      if (layer.outline) {
        const outlineCanvas = sharedOutlineCanvas;
        if (outlineCanvas.width !== dims.w) outlineCanvas.width = dims.w;
        if (outlineCanvas.height !== dims.h) outlineCanvas.height = dims.h;
        const outCtx = outlineCanvas.getContext('2d');
        outCtx.clearRect(0, 0, dims.w, dims.h);
        outCtx.fillStyle = layer.outlineColor || '#ffffff';
        outCtx.fillRect(0, 0, dims.w, dims.h);
        outCtx.globalCompositeOperation = 'destination-in';
        outCtx.drawImage(offCanvas, 0, 0);

        const oW = layer.outlineWidth || 1;
        for (let dy = -oW; dy <= oW; dy++) {
          for (let dx = -oW; dx <= oW; dx++) {
            if (dx === 0 && dy === 0) continue;
            if (dx * dx + dy * dy <= oW * oW + (oW === 1 ? 0 : oW)) {
              ctx.drawImage(outlineCanvas, dx * zoomLevel, dy * zoomLevel, dims.w * zoomLevel, dims.h * zoomLevel);
            }
          }
        }
      }

      if (layer.dropShadow) {
        ctx.shadowColor = layer.shadowColor || '#000000';
        ctx.shadowOffsetX = (layer.shadowOffsetX ?? 1) * zoomLevel;
        ctx.shadowOffsetY = (layer.shadowOffsetY ?? 1) * zoomLevel;
        ctx.shadowBlur = 0;
      }

      ctx.drawImage(offCanvas, 0, 0, dims.w * zoomLevel, dims.h * zoomLevel);
      ctx.restore();
    });
  }, [layers, dimensions, tool, activeLayerId, isDrawing, moveOffset, selection, editingTextLayerId, isPixelated]);

  const getSnappedPos = useCallback((clientX, clientY, altKey) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    let unroundedX = (clientX - rect.left) / zoom;
    let unroundedY = (clientY - rect.top) / zoom;

    let x = Math.floor(unroundedX);
    let y = Math.floor(unroundedY);

    if (!altKey) {
      const snapThreshold = 5 / zoom;
      let minDiffX = snapThreshold;
      for (let g of guides.x) {
        const diff = Math.abs(unroundedX - g);
        if (diff < minDiffX) { minDiffX = diff; x = g; }
      }
      let minDiffY = snapThreshold;
      for (let g of guides.y) {
        const diff = Math.abs(unroundedY - g);
        if (diff < minDiffY) { minDiffY = diff; y = g; }
      }
    }
    return { x, y };
  }, [zoom, guides]);

  // Canvas Drawing Actions
  const handleInput = (e, isFirstClick = false) => {
    if (isPanning) return;
    const { x, y } = getSnappedPos(e.clientX, e.clientY, e?.altKey);

    if (tool === 'collisionFill') {
      if (isFirstClick) fillSelectionWithCollision(x, y);
      return;
    }

    if (tool === 'text') {
      if (isFirstClick) {
        if (textSettings.text) {
          renderText(textSettings, editingTextLayerId);
        }
        setTextSettings(prev => ({ ...prev, x, y, text: "" }));
        setEditingTextLayerId(null);
      }
      return;
    }

    if (tool === 'lasso') {
      const clampedX = Math.max(0, Math.min(x, dimensions.w - 1));
      const clampedY = Math.max(0, Math.min(y, dimensions.h - 1));
      if (isFirstClick) {
        setLassoPath([{ x: clampedX, y: clampedY }]);
      } else {
        setLassoPath(prev => {
          const last = prev[prev.length - 1];
          if (last && last.x === clampedX && last.y === clampedY) return prev;
          return [...prev, { x: clampedX, y: clampedY }];
        });
      }
      return;
    }

    if (tool === 'actor') {
      if (isFirstClick) {
        const clickedActor = [...actors, ...globalActors].filter(a => a.type !== 'group').reverse().find(a =>
          x >= a.x && x < a.x + a.width && y >= a.y && y < a.y + a.height
        );

        if (clickedActor) {
          setActiveActorId(clickedActor.id);
          setSelectionStart({ x, y, actorOriginalX: clickedActor.x, actorOriginalY: clickedActor.y });
        } else {
          if (activeActorId) {
            setActiveActorId(null);
          } else {
            const newActor = {
              id: Date.now() + Math.random(),
              name: `Actor ${actors.length + 1}`,
              type: actors.length === 0 ? 'player' : 'npc',
              x: Math.floor(x / 8) * 8,
              y: Math.floor(y / 8) * 8,
              width: 8,
              height: 8,
              color: currentColor || '#ff00ff',
              spriteId: null,
              isHidden: false,
              hflip: true,
              attackAnimId: null,
              script: { nodes: [], edges: [] }
            };
            const nextActors = [...actors, newActor];
            setActors(nextActors);
            setActiveActorId(newActor.id);
            setSelectionStart({ x, y, actorOriginalX: newActor.x, actorOriginalY: newActor.y });
            saveHistory("Add Actor", layers, dimensions, { actors: nextActors });
          }
        }
      } else if (selectionStart && activeActorId) {
        const dx = x - selectionStart.x;
        const dy = y - selectionStart.y;
        let newX = selectionStart.actorOriginalX + dx;
        let newY = selectionStart.actorOriginalY + dy;
        if (e?.shiftKey || isShiftPressed) { newX = Math.floor(newX / 8) * 8; newY = Math.floor(newY / 8) * 8; }
        else { newX = Math.floor(newX); newY = Math.floor(newY); }
        const isGlobal = globalActors.some(a => a.id === activeActorId);
        if (isGlobal) {
          setGlobalActorPosition(activeActorId, newX, newY);
        } else {
          setActors(prev => prev.map(a => a.id === activeActorId ? { ...a, x: newX, y: newY } : a));
        }
      }
      return;
    }

    if (tool === 'spawn') {
      if (isFirstClick) {
        const playerActor = actors.find(a => a.type === 'player') || globalActors.find(a => a.type === 'player');
        const snapX = Math.floor(x / 8) * 8;
        const snapY = Math.floor(y / 8) * 8;
        if (playerActor) {
          const isGlobalPlayer = globalActors.some(a => a.id === playerActor.id);
          if (isGlobalPlayer) {
            setGlobalActorPosition(playerActor.id, snapX, snapY);
          } else {
            setActors(prev => prev.map(a => a.id === playerActor.id ? { ...a, x: snapX, y: snapY } : a));
          }
          setActiveActorId(playerActor.id);
          setSelectionStart({ x, y, actorOriginalX: snapX, actorOriginalY: snapY });
        } else {
          const newActor = {
            id: Date.now() + Math.random(),
            name: `Player`,
            type: 'player',
            x: snapX,
            y: snapY,
            width: 8,
            height: 8,
            color: '#65ff00',
            spriteId: null,
            isHidden: false,
            hflip: true,
            attackAnimId: null,
            script: { nodes: [{ id: 'start', position: { x: 250, y: 100 }, data: { label: 'On Update' }, type: 'input' }], edges: [] }
          };
          const nextActors = [...actors, newActor];
          setActors(nextActors);
          setActiveActorId(newActor.id);
          setSelectionStart({ x, y, actorOriginalX: newActor.x, actorOriginalY: newActor.y });
          saveHistory("Set Player Spawn", layers, dimensions, { actors: nextActors });
        }
      } else if (selectionStart && activeActorId) {
        const dx = x - selectionStart.x;
        const dy = y - selectionStart.y;
        let newX = selectionStart.actorOriginalX + dx;
        let newY = selectionStart.actorOriginalY + dy;
        if (e?.shiftKey || isShiftPressed) { newX = Math.floor(newX / 8) * 8; newY = Math.floor(newY / 8) * 8; }
        else { newX = Math.floor(newX); newY = Math.floor(newY); }
        const isGlobal = globalActors.some(a => a.id === activeActorId);
        if (isGlobal) {
          setGlobalActorPosition(activeActorId, newX, newY);
        } else {
          setActors(prev => prev.map(a => a.id === activeActorId ? { ...a, x: newX, y: newY } : a));
        }
      }
      return;
    }

    if (tool === 'trigger') {
      if (isFirstClick) {
        const clickedTrigger = [...triggers].reverse().find(t =>
          !t.isGroup && x >= t.x && x < t.x + t.width && y >= t.y && y < t.y + t.height
        );

        if (clickedTrigger) {
          setActiveTriggerId(clickedTrigger.id);
          setSelectionStart({ x, y, originalX: clickedTrigger.x, originalY: clickedTrigger.y });
          setIsPaintingTriggers(false);
        } else {
          setIsPaintingTriggers(true);
          const snapX = Math.floor(x / 8) * 8;
          const snapY = Math.floor(y / 8) * 8;
          setTempPaintedTriggers([{ x: snapX, y: snapY }]);
          setSelectionStart({ x, y });
        }
      } else if (isPaintingTriggers) {
        const snapX = Math.floor(x / 8) * 8;
        const snapY = Math.floor(y / 8) * 8;
        setTempPaintedTriggers(prev => {
          if (prev.some(p => p.x === snapX && p.y === snapY)) return prev;
          return [...prev, { x: snapX, y: snapY }];
        });
      } else if (selectionStart && activeTriggerId) {
        const dx = x - selectionStart.x;
        const dy = y - selectionStart.y;
        let newX = selectionStart.originalX + dx;
        let newY = selectionStart.originalY + dy;
        if (e?.shiftKey || isShiftPressed) { newX = Math.floor(newX / 8) * 8; newY = Math.floor(newY / 8) * 8; }
        else { newX = Math.floor(newX); newY = Math.floor(newY); }
        setTriggers(prev => prev.map(t => t.id === activeTriggerId ? { ...t, x: newX, y: newY } : t));
      }
      return;
    }

    if (tool === 'collision') {
      if (isFirstClick) {
        const clickedCollision = [...collisions].reverse().find(c =>
          !c.isGroup && x >= c.x && x < c.x + c.width && y >= c.y && y < c.y + c.height
        );

        if (clickedCollision) {
          setActiveCollisionId(clickedCollision.id);
          setSelectionStart({ x, y, originalX: clickedCollision.x, originalY: clickedCollision.y });
          setIsPaintingCollisions(false);
        } else {
          setIsPaintingCollisions(true);
          const snapX = Math.floor(x / 8) * 8;
          const snapY = Math.floor(y / 8) * 8;
          setTempPaintedCollisions([{ x: snapX, y: snapY }]);
          setSelectionStart({ x, y });
        }
      } else if (isPaintingCollisions) {
        const snapX = Math.floor(x / 8) * 8;
        const snapY = Math.floor(y / 8) * 8;
        setTempPaintedCollisions(prev => {
          if (prev.some(p => p.x === snapX && p.y === snapY)) return prev;
          return [...prev, { x: snapX, y: snapY }];
        });
      } else if (selectionStart && activeCollisionId) {
        const dx = x - selectionStart.x;
        const dy = y - selectionStart.y;
        let newX = selectionStart.originalX + dx;
        let newY = selectionStart.originalY + dy;
        if (e?.shiftKey || isShiftPressed) { newX = Math.floor(newX / 8) * 8; newY = Math.floor(newY / 8) * 8; }
        else { newX = Math.floor(newX); newY = Math.floor(newY); }
        setCollisions(prev => prev.map(c => c.id === activeCollisionId ? { ...c, x: newX, y: newY } : c));
      }
      return;
    }

    if (tool === 'move' || tool === 'moveLayer') {
      if (selectionStart) {
        setMoveOffset({
          x: x - selectionStart.x,
          y: y - selectionStart.y
        });
      }
      return;
    }

    if (tool === 'rect') {
      if (isFirstClick) {
        setSelectionStart({ x, y });
      }

      if (selectionStart || isFirstClick) {
        const startX = selectionStart ? selectionStart.x : x;
        const startY = selectionStart ? selectionStart.y : y;

        let targetX = x;
        let targetY = y;
        if (e?.shiftKey || isShiftPressed) {
          const dx = targetX - startX;
          const dy = targetY - startY;
          const size = Math.max(Math.abs(dx), Math.abs(dy));
          targetX = startX + (Math.sign(dx) || 1) * size;
          targetY = startY + (Math.sign(dy) || 1) * size;
        }

        let minX = Math.min(targetX, startX);
        let maxX = Math.max(targetX, startX);
        let minY = Math.min(targetY, startY);
        let maxY = Math.max(targetY, startY);

        const newSelection = new Set();
        for (let ix = minX; ix <= maxX; ix++) {
          for (let iy = minY; iy <= maxY; iy++) {
            if (ix >= 0 && ix < dimensions.w && iy >= 0 && iy < dimensions.h) {
              newSelection.add(`${ix},${iy}`);
            }
          }
        }
        setSelection(newSelection);
      }
      return;
    }

    if (tool === 'tile') {
      const activeTile = savedTiles.find(t => t.id === activeSavedTileId);
      if (!activeTile) return;
      if (!activeLayer || activeLayer.type === 'group' || !activeLayer.visible) return;

      const points = getSymmetricPixels([{ x, y }], dimensions.w, dimensions.h, symmetryMode);
      const ctx = canvasRef.current?.getContext('2d');

      points.forEach(p => {
        const snapX = Math.floor(p.x / 8) * 8;
        const snapY = Math.floor(p.y / 8) * 8;
        for (let py = 0; py < 8; py++) {
          for (let px = 0; px < 8; px++) {
            const targetY = snapY + py;
            const targetX = snapX + px;
            if (targetY >= 0 && targetY < dimensions.h && targetX >= 0 && targetX < dimensions.w) {
              const pxVal = activeTile.data[py][px];
              if (pxVal !== null && activeLayer.data[targetY][targetX] !== pxVal) {
                activeLayer.data[targetY][targetX] = pxVal;
                if (ctx) {
                  ctx.fillStyle = pxVal;
                  ctx.fillRect(targetX * zoom, targetY * zoom, zoom, zoom);
                }
              }
            }
          }
        }
      });
      return;
    }

    if (tool === 'tileFill') {
      if (!isFirstClick) return;
      const activeTile = savedTiles.find(t => t.id === activeSavedTileId);
      if (!activeTile) return;
      if (!activeLayer || activeLayer.type === 'group' || !activeLayer.visible) return;

      const points = getSymmetricPixels([{ x, y }], dimensions.w, dimensions.h, symmetryMode);
      const ctx = canvasRef.current?.getContext('2d');

      points.forEach(p => {
        if (p.x >= 0 && p.x < dimensions.w && p.y >= 0 && p.y < dimensions.h) {
          if (selection && selection.size > 0 && !selection.has(`${p.x},${p.y}`)) return;
          const targetColor = activeLayer.data[p.y][p.x];
          const stack = [[p.x, p.y]];
          const visited = new Set();
          while (stack.length > 0) {
            const [cx, cy] = stack.pop();
            const key = `${cx},${cy}`;
            if (cx >= 0 && cx < dimensions.w && cy >= 0 && cy < dimensions.h && !visited.has(key) && activeLayer.data[cy][cx] === targetColor) {
              if (!selection || selection.size === 0 || selection.has(key)) {
                visited.add(key);
                const tileY = cy % 8;
                const tileX = cx % 8;
                const pxVal = activeTile.data[tileY][tileX];
                if (pxVal !== null && activeLayer.data[cy][cx] !== pxVal) {
                  activeLayer.data[cy][cx] = pxVal;
                }
                stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
              }
            }
          }
        }
      });
      if (ctx) renderLayersToCtx(ctx, zoom, viewActiveOnly ? layers.filter(l => l.id === activeLayerId) : layers);
      return;
    }

    if (tool === 'wand') {
      if (isFirstClick && x >= 0 && x < dimensions.w && y >= 0 && y < dimensions.h) {
        const targetColor = activeLayer?.data[y][x];
        const selectedSet = new Set();
        const stack = [[x, y]];
        const visited = new Uint8Array(dimensions.w * dimensions.h);

        while (stack.length > 0) {
          const [cx, cy] = stack.pop();
          const idx = cy * dimensions.w + cx;

          if (cx < 0 || cx >= dimensions.w || cy < 0 || cy >= dimensions.h) continue;
          if (visited[idx] || activeLayer?.data[cy][cx] !== targetColor) continue;

          visited[idx] = 1;
          selectedSet.add(`${cx},${cy}`);
          stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
        }
        setSelection(selectedSet);
      }
      return;
    }

    if (!activeLayer || activeLayer.type === 'group' || !activeLayer.visible) return;

    if (tool === 'pen' || tool === 'brush' || tool === 'eraser') {
      const targetColor = (tool === 'pen' || tool === 'brush') ? currentColor : null;
      let points = getBrushPixels([{ x, y, color: targetColor }], drawWidth, brushType, colorJitter);
      points = getSymmetricPixels(points, dimensions.w, dimensions.h, symmetryMode);
      const ctx = canvasRef.current?.getContext('2d');

      points.forEach(p => {
        if (p.x >= 0 && p.x < dimensions.w && p.y >= 0 && p.y < dimensions.h) {
          if (!selection || selection.size === 0 || selection.has(`${p.x},${p.y}`)) {
            let applyColor = p.color !== undefined ? p.color : targetColor;
            let finalColor = applyColor;
            if (tool !== 'eraser' && applyColor && brushOpacity < 100) {
              finalColor = blendHexColors(activeLayer.data[p.y][p.x], applyColor, brushOpacity);
            }
            if (activeLayer.data[p.y][p.x] !== finalColor) {
              activeLayer.data[p.y][p.x] = finalColor;
              if (ctx) {
                if (finalColor === null) {
                  ctx.clearRect(p.x * zoom, p.y * zoom, zoom, zoom);
                } else {
                  ctx.fillStyle = finalColor;
                  ctx.fillRect(p.x * zoom, p.y * zoom, zoom, zoom);
                }
              }
            }
          }
        }
      });
      return;
    }

    if (tool === 'fill' && isFirstClick) {
      const points = getSymmetricPixels([{ x, y }], dimensions.w, dimensions.h, symmetryMode);
      const ctx = canvasRef.current?.getContext('2d');

      points.forEach(p => {
        if (p.x >= 0 && p.x < dimensions.w && p.y >= 0 && p.y < dimensions.h) {
          if (selection && selection.size > 0 && !selection.has(`${p.x},${p.y}`)) return;
          const targetColor = activeLayer.data[p.y][p.x];
          if (targetColor === currentColor) return;

          const stack = [[p.x, p.y]];
          const visited = new Set();
          while (stack.length > 0) {
            const [cx, cy] = stack.pop();
            const key = `${cx},${cy}`;
            if (cx >= 0 && cx < dimensions.w && cy >= 0 && cy < dimensions.h && !visited.has(key) && activeLayer.data[cy][cx] === targetColor) {
              if (!selection || selection.size === 0 || selection.has(key)) {
                visited.add(key);
                activeLayer.data[cy][cx] = currentColor;
                stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
              }
            }
          }
        }
      });
      if (ctx) renderLayersToCtx(ctx, zoom, viewActiveOnly ? layers.filter(l => l.id === activeLayerId) : layers);
      return;
    }
  };

  const handleMouseDown = (e) => {
    if (showHSLDialog || showBCDialog) return;
    if (tool === 'grab' || e.button === 1) {
      e.preventDefault();
      setIsPanning(true);
      panStart.current = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y };
      return;
    }

    const { x, y } = getSnappedPos(e.clientX, e.clientY, e?.altKey);

    if (cursorPos.x !== x || cursorPos.y !== y) setCursorPos({ x, y });

    if (tool === 'cursor') {
      const selectableLayers = viewActiveOnly ? layers.filter(l => l.id === activeLayerId) : layers;
      for (let i = 0; i < selectableLayers.length; i++) {
        if (selectableLayers[i].visible && selectableLayers[i].data[y]?.[x] !== null) {
          setActiveLayerId(selectableLayers[i].id);
          toast.success(`Active Layer: ${selectableLayers[i].name}`, { id: 'layer-select' });
          break;
        }
      }
      return;
    }

    if (['drawRect', 'drawRectFill', 'drawRoundRect', 'drawRoundRectFill', 'drawCircle', 'drawCircleFill', 'drawLine', 'gradient'].includes(tool)) {
      setSelectionStart({ x, y });
      setIsDrawing(true);
      isDrawingRef.current = true;
      return;
    }

    if (tool === 'moveLayer') {
      setSelectionStart({ x, y });
      setIsDrawing(true);
      isDrawingRef.current = true;
      return;
    }

    if (tool === 'move' && selection && selection.has(`${x},${y}`)) {
      setSelectionStart({ x, y });
      setIsDrawing(true);
      isDrawingRef.current = true;
      return;
    }

    if (tool === 'transform' && transformData) {
      const handleSize = Math.max(1, 10 / zoom);
      const { x: tx, y: ty, w: tw, h: th } = transformData;
      if (Math.abs(x - tx) <= handleSize && Math.abs(y - ty) <= handleSize) {
        setIsResizing('tl');
        return;
      } else if (Math.abs(x - (tx + tw)) <= handleSize && Math.abs(y - ty) <= handleSize) {
        setIsResizing('tr');
        return;
      } else if (Math.abs(x - tx) <= handleSize && Math.abs(y - (ty + th)) <= handleSize) {
        setIsResizing('bl');
        return;
      } else if (Math.abs(x - (tx + tw)) <= handleSize && Math.abs(y - (ty + th)) <= handleSize) {
        setIsResizing('br');
        return;
      } else {
        applyTransform();
        return;
      }
    }

    setIsDrawing(true);
    isDrawingRef.current = true;
    handleInput(e, true);
  };

  const handleMouseMove = (e) => {
    const { x, y } = getSnappedPos(e.clientX, e.clientY, e?.altKey);

    if (cursorPos.x !== x || cursorPos.y !== y) {
      setCursorPos({ x, y });
    }

    if (e.shiftKey !== isShiftPressed) {
      setIsShiftPressed(e.shiftKey);
    }

    if (isPanning) {
      setPanOffset({ x: e.clientX - panStart.current.x, y: e.clientY - panStart.current.y });
    } else if (isResizing && transformData) {
      let newW = transformData.w;
      let newH = transformData.h;
      let newX = transformData.x;
      let newY = transformData.y;

      const origAspect = transformData.origW / transformData.origH;

      if (isResizing === 'br') {
        newW = Math.max(1, x - transformData.x);
        newH = Math.max(1, y - transformData.y);
        if (e.shiftKey || isShiftPressed) {
          if (newW / newH > origAspect) newH = Math.max(1, Math.round(newW / origAspect));
          else newW = Math.max(1, Math.round(newH * origAspect));
        }
      } else if (isResizing === 'bl') {
        newW = Math.max(1, transformData.x + transformData.w - x);
        newH = Math.max(1, y - transformData.y);
        if (e.shiftKey || isShiftPressed) {
          if (newW / newH > origAspect) newH = Math.max(1, Math.round(newW / origAspect));
          else newW = Math.max(1, Math.round(newH * origAspect));
        }
        newX = transformData.x + transformData.w - newW;
      } else if (isResizing === 'tr') {
        newW = Math.max(1, x - transformData.x);
        newH = Math.max(1, transformData.y + transformData.h - y);
        if (e.shiftKey || isShiftPressed) {
          if (newW / newH > origAspect) newH = Math.max(1, Math.round(newW / origAspect));
          else newW = Math.max(1, Math.round(newH * origAspect));
        }
        newY = transformData.y + transformData.h - newH;
      } else if (isResizing === 'tl') {
        newW = Math.max(1, transformData.x + transformData.w - x);
        newH = Math.max(1, transformData.y + transformData.h - y);
        if (e.shiftKey || isShiftPressed) {
          if (newW / newH > origAspect) newH = Math.max(1, Math.round(newW / origAspect));
          else newW = Math.max(1, Math.round(newH * origAspect));
        }
        newX = transformData.x + transformData.w - newW;
        newY = transformData.y + transformData.h - newH;
      }

      setTransformData(prev => ({
        ...prev,
        x: newX,
        y: newY,
        w: newW,
        h: newH
      }));
    } else if (isDrawingRef.current || isDrawing) {
      if (cursorPos.x !== x || cursorPos.y !== y) {
        handleInput(e, false);
      }
    }
  };

  const handleMouseUp = (e) => {
    const wasDrawing = isDrawingRef.current || isDrawing;
    if (wasDrawing && ['pen', 'brush', 'eraser', 'fill', 'tile', 'tileFill'].includes(tool)) {
      const actionName = tool === 'pen' ? "Draw" : tool === 'brush' ? "Brush" : tool === 'eraser' ? "Erase" : tool === 'fill' ? "Fill" : tool === 'tile' ? "Tile Stamp" : "Tile Fill";
      const updatedLayers = layers.map(l => l.id === activeLayerId ? { ...l, data: l.data ? l.data.map(row => row.slice()) : null } : l);
      setLayers(updatedLayers);
      saveHistory(actionName, updatedLayers, dimensions);
    }

    if (wasDrawing && ['drawRect', 'drawRectFill', 'drawRoundRect', 'drawRoundRectFill', 'drawCircle', 'drawCircleFill', 'drawLine', 'gradient'].includes(tool) && selectionStart) {
      let targetX = cursorPos.x;
      let targetY = cursorPos.y;
      if (e?.shiftKey || isShiftPressed) {
        const dx = targetX - selectionStart.x;
        const dy = targetY - selectionStart.y;
        const size = Math.max(Math.abs(dx), Math.abs(dy));
        targetX = selectionStart.x + (Math.sign(dx) || 1) * size;
        targetY = selectionStart.y + (Math.sign(dy) || 1) * size;
      }

      let pixels = [];
      if (tool === 'gradient') {
        pixels = getGradientPixels(selectionStart.x, selectionStart.y, targetX, targetY);
      } else {
        pixels = getShapePixels(tool, selectionStart.x, selectionStart.y, targetX, targetY);
        pixels = pixels.map(p => ({ ...p, color: currentColor }));
        pixels = getBrushPixels(pixels, drawWidth, brushType, colorJitter);
      }
      pixels = getSymmetricPixels(pixels, dimensions.w, dimensions.h, symmetryMode);

      const newLayers = layers.map(layer => {
        if (layer.id !== activeLayerId) return layer;
        const newData = [...layer.data];
        pixels.forEach(p => {
          if (p.y >= 0 && p.y < dimensions.h && p.x >= 0 && p.x < dimensions.w) {
            if (!selection || selection.size === 0 || selection.has(`${p.x},${p.y}`)) {
              if (newData[p.y] === layer.data[p.y]) newData[p.y] = [...layer.data[p.y]];
              let applyColor = p.color !== undefined ? p.color : currentColor;
              let finalColor = applyColor;
              if (tool !== 'gradient' && applyColor && brushOpacity < 100) {
                finalColor = blendHexColors(newData[p.y][p.x], applyColor, brushOpacity);
              }
              newData[p.y][p.x] = finalColor;
            }
          }
        });
        return { ...layer, data: newData, textData: null };
      });
      setLayers(newLayers);
      const actionMap = {
        'drawRect': 'Draw Rect',
        'drawRectFill': 'Draw Filled Rect',
        'drawRoundRect': 'Draw Rounded Rect',
        'drawRoundRectFill': 'Draw Filled Rounded Rect',
        'drawCircle': 'Draw Circle',
        'drawCircleFill': 'Draw Filled Circle',
        'drawLine': 'Draw Line',
        'gradient': 'Gradient'
      };
      saveHistory(actionMap[tool], newLayers);
    }

    if (wasDrawing && tool === 'lasso') {
      const path = [...lassoPath];
      if (path.length > 2) {
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        path.forEach(p => {
          minX = Math.min(minX, p.x);
          maxX = Math.max(maxX, p.x);
          minY = Math.min(minY, p.y);
          maxY = Math.max(maxY, p.y);
        });
        const newSelection = new Set();
        path.forEach(p => newSelection.add(`${p.x},${p.y}`));
        for (let y = minY; y <= maxY; y++) {
          for (let x = minX; x <= maxX; x++) {
            if (x >= 0 && x < dimensions.w && y >= 0 && y < dimensions.h) {
              if (isPointInPolygon({ x, y }, path)) {
                newSelection.add(`${x},${y}`);
              }
            }
          }
        }
        setSelection(newSelection);
      }
      setLassoPath([]);
    }

    if (tool === 'move' && selectionStart && wasDrawing) commitMove();
    if (tool === 'moveLayer' && selectionStart && wasDrawing) commitMoveLayer();

    if ((tool === 'actor' || tool === 'spawn') && selectionStart && wasDrawing) {
      saveHistory("Move Actor");
    }
    if (tool === 'trigger' && selectionStart && wasDrawing) {
      if (isPaintingTriggers) {
        const activeTrig = triggers.find(t => t.id === activeTriggerId);
        const paintType = activeTrig ? (activeTrig.type || 'enter') : 'enter';
        const paintScriptId = activeTrig ? activeTrig.scriptId : null;

        if (tempPaintedTriggers.length > 0) {
          const combinedRects = combineCellsToRectangles(tempPaintedTriggers);

          const filteredTriggers = triggers.filter(t => {
            if (t.isGroup) return true;
            const overlapsAny = combinedRects.some(r => {
              return t.x < r.x + r.width &&
                t.x + t.width > r.x &&
                t.y < r.y + r.height &&
                t.y + t.height > r.y;
            });
            return !overlapsAny;
          });

          const updatedTriggers = [...filteredTriggers];

          const groupId = Date.now() + Math.random();
          const groupCount = triggers.filter(t => t.isGroup).length + 1;
          const labelMap = { 'enter': 'On Enter', 'leave': 'On Leave', 'interact': 'On Interact' };
          const newGroup = {
            id: groupId,
            name: `Group ${groupCount}`,
            isGroup: true,
            type: paintType,
            scriptId: paintScriptId,
            script: { nodes: [{ id: 'start', position: { x: 250, y: 100 }, data: { label: labelMap[paintType] || 'On Enter' }, type: 'input' }], edges: [] }
          };

          combinedRects.forEach((rect, idx) => {
            updatedTriggers.push({
              id: Date.now() + Math.random() + idx,
              name: `Trigger ${triggers.length + idx + 1}`,
              type: paintType,
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height,
              groupId: groupId
            });
          });

          updatedTriggers.push(newGroup);
          setActiveTriggerId(groupId);
          setTriggers(updatedTriggers);
          saveHistory("Paint Triggers", layers, dimensions, { triggers: updatedTriggers });
        }
      } else {
        saveHistory("Move Trigger");
      }
    }
    if (tool === 'collision' && selectionStart && wasDrawing) {
      if (isPaintingCollisions) {
        const activeCol = collisions.find(c => c.id === activeCollisionId);
        const paintType = activeCol ? activeCol.type : 'solid';
        const paintAngle = activeCol ? activeCol.angle : undefined;

        if (tempPaintedCollisions.length > 0) {
          const combinedRects = combineCellsToRectangles(tempPaintedCollisions);

          const filteredCollisions = collisions.filter(c => {
            if (c.isGroup) return true;
            const overlapsAny = combinedRects.some(r => {
              return c.x < r.x + r.width &&
                c.x + c.width > r.x &&
                c.y < r.y + r.height &&
                c.y + c.height > r.y;
            });
            return !overlapsAny;
          });

          const updatedCollisions = [...filteredCollisions];

          const groupId = Date.now() + Math.random();
          const groupCount = collisions.filter(c => c.isGroup).length + 1;
          const newGroup = {
            id: groupId,
            name: `Group ${groupCount}`,
            isGroup: true,
            type: paintType,
            angle: paintAngle
          };

          combinedRects.forEach((rect, idx) => {
            updatedCollisions.push({
              id: Date.now() + Math.random() + idx,
              name: `Collision ${collisions.length + idx + 1}`,
              type: paintType,
              angle: paintAngle,
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height,
              isPainted: false,
              groupId: groupId
            });
          });

          updatedCollisions.push(newGroup);
          setActiveCollisionId(groupId);
          setCollisions(updatedCollisions);
          saveHistory("Paint Collisions", layers, dimensions, { collisions: updatedCollisions });
        }
      } else {
        saveHistory("Move Collision");
      }
    }

    setIsResizing(false);
    setIsDrawing(false);
    isDrawingRef.current = false;
    setIsPanning(false);
    setSelectionStart(null);
    setMoveOffset({ x: 0, y: 0 });
    setIsPaintingCollisions(false);
    setTempPaintedCollisions([]);
    setIsPaintingTriggers(false);
    setTempPaintedTriggers([]);
  };

  const commitMove = () => {
    if (!selection || selection.size === 0 || (moveOffset.x === 0 && moveOffset.y === 0)) return;
    const newLayers = layers.map(layer => {
      if (layer.id !== activeLayerId || layer.type === 'group') return layer;
      const movingPixels = [];
      selection.forEach(key => {
        const [x, y] = key.split(',').map(Number);
        movingPixels.push({ x, y, color: layer.data[y][x] });
      });
      const newData = [...layer.data];
      selection.forEach(key => {
        const [x, y] = key.split(',').map(Number);
        if (newData[y] === layer.data[y]) newData[y] = [...layer.data[y]];
        newData[y][x] = null;
      });
      const newSelection = new Set();
      movingPixels.forEach(p => {
        const nx = p.x + moveOffset.x;
        const ny = p.y + moveOffset.y;
        if (nx >= 0 && nx < dimensions.w && ny >= 0 && ny < dimensions.h) {
          if (p.color !== null) {
            if (newData[ny] === layer.data[ny]) newData[ny] = [...layer.data[ny]];
            newData[ny][nx] = p.color;
          }
          newSelection.add(`${nx},${ny}`);
        }
      });
      setSelection(newSelection);
      return { ...layer, data: newData, textData: null };
    });
    setLayers(newLayers);
    saveHistory("Move Selection", newLayers);
  };

  const commitMoveLayer = () => {
    if (moveOffset.x === 0 && moveOffset.y === 0) return;
    const newLayers = layers.map(layer => {
      if (layer.id !== activeLayerId || layer.type === 'group') return layer;
      const newData = Array.from({ length: dimensions.h }, () => Array(dimensions.w).fill(null));
      layer.data.forEach((row, y) => {
        row.forEach((color, x) => {
          const nx = x + moveOffset.x;
          const ny = y + moveOffset.y;
          if (nx >= 0 && nx < dimensions.w && ny >= 0 && ny < dimensions.h) newData[ny][nx] = color;
        });
      });

      let newTextData = layer.textData;
      if (newTextData) {
        newTextData = { ...newTextData, x: newTextData.x + moveOffset.x, y: newTextData.y + moveOffset.y };
      }

      return { ...layer, data: newData, textData: newTextData };
    });
    setLayers(newLayers);
    saveHistory("Move Layer", newLayers);
  };

  const startTransform = useCallback(() => {
    if (!activeLayer || activeLayer.type === 'group') return;

    let activeSelection = selection;
    if (!activeSelection || activeSelection.size === 0) {
      activeSelection = new Set();
      for (let y = 0; y < dimensions.h; y++) {
        for (let x = 0; x < dimensions.w; x++) {
          if (activeLayer.data[y] && activeLayer.data[y][x] !== null) {
            activeSelection.add(`${x},${y}`);
          }
        }
      }
      if (activeSelection.size === 0) {
        toast.error("Layer is empty!");
        return;
      }
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    activeSelection.forEach(key => {
      const [x, y] = key.split(',').map(Number);
      minX = Math.min(minX, x); minY = Math.min(minY, y);
      maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    });
    const w = (maxX - minX) + 1;
    const h = (maxY - minY) + 1;
    const grid = Array(h).fill(null).map(() => Array(w).fill(null));
    activeSelection.forEach(key => {
      const [x, y] = key.split(',').map(Number);
      grid[y - minY][x - minX] = activeLayer.data[y][x];
    });
    const newLayers = layers.map(l => {
      if (l.id !== activeLayerId || l.type === 'group') return l;
      const newData = l.data.map((row, y) => row.map((px, x) => activeSelection.has(`${x},${y}`) ? null : px));
      return { ...l, data: newData, textData: null };
    });
    setLayers(newLayers);
    setTransformData({ pixels: grid, x: minX, y: minY, w, h, origW: w, origH: h });
    setTool('transform');
    setSelection(activeSelection);
    saveHistory("Transform Start", newLayers);
  }, [selection, layers, activeLayerId, activeLayer, saveHistory, dimensions]);

  const applyTransform = useCallback(() => {
    if (!transformData) return;
    const newLayers = layers.map(l => {
      if (l.id !== activeLayerId || l.type === 'group') return l;
      const newData = [...l.data];
      for (let dy = 0; dy < transformData.h; dy++) {
        for (let dx = 0; dx < transformData.w; dx++) {
          const targetX = transformData.x + dx;
          const targetY = transformData.y + dy;
          if (targetX >= 0 && targetX < dimensions.w && targetY >= 0 && targetY < dimensions.h) {
            const sourceX = Math.floor((dx / transformData.w) * transformData.origW);
            const sourceY = Math.floor((dy / transformData.h) * transformData.origH);
            const color = transformData.pixels[sourceY]?.[sourceX];
            if (color) {
              if (newData[targetY] === l.data[targetY]) newData[targetY] = [...l.data[targetY]];
              newData[targetY][targetX] = color;
            }
          }
        }
      }
      return { ...l, data: newData };
    });
    setLayers(newLayers);
    setTransformData(null);
    setSelection(null);
    setTool('rect');
    saveHistory("Apply Transform", newLayers);
  }, [transformData, layers, activeLayerId, dimensions, saveHistory]);

  const handleWheel = (e) => {
    const newZoom = getNextZoom(zoom, e.deltaY > 0 ? -1 : 1);
    if (newZoom === zoom) return;

    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left - rect.width / 2;
    const mouseY = e.clientY - rect.top - rect.height / 2;

    const canvasX = (mouseX - panOffset.x) / zoom;
    const canvasY = (mouseY - panOffset.y) / zoom;

    setZoom(newZoom);
    setPanOffset({ x: mouseX - canvasX * newZoom, y: mouseY - canvasY * newZoom });
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const preventDefault = (e) => e.preventDefault();
    container.addEventListener('wheel', preventDefault, { passive: false });
    return () => container.removeEventListener('wheel', preventDefault);
  }, []);

  const invertSelection = useCallback(() => {
    const newSelection = new Set();
    for (let y = 0; y < dimensions.h; y++) {
      for (let x = 0; x < dimensions.w; x++) {
        const key = `${x},${y}`;
        if (!selection || !selection.has(key)) newSelection.add(key);
      }
    }
    setSelection(newSelection);
  }, [selection, dimensions]);

  const deleteSelection = useCallback(() => {
    if (!selection) return;
    const newLayers = layers.map(layer => {
      if (layer.id !== activeLayerId || layer.type === 'group') return layer;
      const newData = layer.data.map((row, y) => row.map((pixel, x) => selection.has(`${x},${y}`) ? null : pixel));
      return { ...layer, data: newData, textData: null };
    });
    setLayers(newLayers);
    setSelection(null);
    saveHistory("Delete Selection", newLayers);
  }, [selection, layers, activeLayerId, saveHistory]);

  const handleCopy = useCallback(() => {
    if (!selection || !activeLayer || activeLayer.type === 'group') return;
    const copiedData = [];
    selection.forEach(key => {
      const [x, y] = key.split(',').map(Number);
      copiedData.push({ x, y, color: activeLayer.data[y][x] });
    });
    setClipboard(copiedData);
  }, [selection, activeLayer]);

  const handlePaste = useCallback(() => {
    if (!clipboard) return;
    const newData = Array(dimensions.h).fill(null).map(() => Array(dimensions.w).fill(null));
    clipboard.forEach(item => {
      if (item.y < dimensions.h && item.x < dimensions.w) newData[item.y][item.x] = item.color;
    });

    const activeL = layers.find(l => l.id === activeLayerId);
    const groupId = activeL ? (activeL.type === 'group' ? activeL.id : activeL.groupId) : null;
    const newLayer = {
      id: Date.now() + Math.random(),
      type: 'layer',
      name: `Pasted Layer ${layers.length + 1}`,
      visible: true,
      groupId,
      data: newData
    };
    const nextLayers = [newLayer, ...layers];
    setLayers(nextLayers);
    setActiveLayerId(newLayer.id);
    setSelection(null);
    saveHistory("Paste Layer", nextLayers);
  }, [clipboard, layers, dimensions, saveHistory, activeLayerId]);

  const duplicateSelectionAsLayer = useCallback(() => {
    if (!selection || !activeLayer || activeLayer.type === 'group' || selection.size === 0) return;
    const newData = Array.from({ length: dimensions.h }, () => Array(dimensions.w).fill(null));
    let hasPixels = false;

    selection.forEach(key => {
      const [x, y] = key.split(',').map(Number);
      if (y >= 0 && y < dimensions.h && x >= 0 && x < dimensions.w) {
        const pixel = activeLayer.data[y][x];
        if (pixel !== null) {
          newData[y][x] = pixel;
          hasPixels = true;
        }
      }
    });

    if (!hasPixels) {
      toast.error("Selection is empty!");
      return;
    }

    const newLayer = {
      id: Date.now() + Math.random(),
      type: 'layer',
      name: `Selection Copy`,
      visible: true,
      groupId: activeLayer.groupId || null,
      data: newData
    };

    const activeIndex = layers.findIndex(l => l.id === activeLayerId);
    const nextLayers = [...layers];
    nextLayers.splice(activeIndex !== -1 ? activeIndex : 0, 0, newLayer);

    setLayers(nextLayers);
    setActiveLayerId(newLayer.id);
    saveHistory("Layer via Copy", nextLayers);
  }, [selection, activeLayer, dimensions, layers, activeLayerId, saveHistory]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) || e.target.isContentEditable) return;
      if (showHSLDialog) {
        if (e.key === 'Escape') { e.preventDefault(); closeHSLDialog(false); }
        if (e.key === 'Enter') { e.preventDefault(); closeHSLDialog(true); }
        return;
      }
      if (showBCDialog) {
        if (e.key === 'Escape') { e.preventDefault(); closeBCDialog(false); }
        if (e.key === 'Enter') { e.preventDefault(); closeBCDialog(true); }
        return;
      }
      if (showAdjustSelectionDialog) {
        if (e.key === 'Escape') { e.preventDefault(); closeAdjustSelectionDialog(false); }
        if (e.key === 'Enter') { e.preventDefault(); closeAdjustSelectionDialog(true); }
        return;
      }
      if (showMagicBgDialog) {
        if (e.key === 'Escape') { e.preventDefault(); closeMagicBgDialog(false); }
        if (e.key === 'Enter') { e.preventDefault(); closeMagicBgDialog(true); }
        return;
      }
      if (showResizeCanvasDialog) {
        if (e.key === 'Escape') { e.preventDefault(); handleResizeCanvas(false); }
        if (e.key === 'Enter') { e.preventDefault(); handleResizeCanvas(true); }
        return;
      }
      if (e.key === 'Shift') setIsShiftPressed(true);
      if ((e.key === 'Delete' || e.key === 'Backspace') && selection) {
        e.preventDefault();
        deleteSelection();
      }
      if (e.key.toLowerCase() === 'a') setTool("cursor");
      if (e.key.toLowerCase() === 'p') { setTool("pen"); setActiveDraw("pen"); }
      if (e.key.toLowerCase() === 'b') { setTool("brush"); setActiveDraw("brush"); }
      if (e.key.toLowerCase() === 'e') { setTool("eraser"); setActiveDraw("eraser"); }
      if (e.key.toLowerCase() === 'k') { setTool("fill"); setActiveFill("fill"); }
      if (e.key.toLowerCase() === 'g') { setTool("gradient"); setActiveFill("gradient"); }
      if (e.key.toLowerCase() === 's') { setTool("tile"); setActiveDraw("tile"); }
      if (e.key.toLowerCase() === 'f') { setTool("tileFill"); setActiveFill("tileFill"); }
      if (e.key.toLowerCase() === 't') setTool("text");
      if (e.key.toLowerCase() === 'v') setTool("moveLayer");
      if (e.key.toLowerCase() === 'm') setTool("move");
      if (e.key.toLowerCase() === 'r') { setTool("rect"); setActiveSelection("rect"); }
      if (e.key.toLowerCase() === 'w') { setTool("wand"); setActiveSelection("wand"); }
      if (e.key.toLowerCase() === 'h') setTool("grab");
      if (e.key.toLowerCase() === 'l' && !e.ctrlKey && !e.metaKey) { setTool("lasso"); setActiveSelection("lasso"); }
      if (e.key.toLowerCase() === 'c' && selection && !e.ctrlKey && !e.metaKey) setTool("crop");

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') {
        e.preventDefault();
        if (e.shiftKey) {
          invertSelection();
        } else {
          invertColors();
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); redo(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') { if (selection) { e.preventDefault(); handleCopy(); } }
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') { if (clipboard) { e.preventDefault(); handlePaste(); } }
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') { if (selection) { e.preventDefault(); setSelection(null); } }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'j') { if (selection) { e.preventDefault(); duplicateSelectionAsLayer(); } }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 't') {
        e.preventDefault();
        if (!transformData) {
          startTransform();
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'u') {
        e.preventDefault();
        if (!showHSLDialog) openHSLDialog();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        if (!showBCDialog) openBCDialog();
      }
    };

    const handleKeyUp = (e) => {
      if (e.key === 'Shift') setIsShiftPressed(false);
    };
    const handleBlur = () => setIsShiftPressed(false);

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [selection, clipboard, deleteSelection, handleCopy, handlePaste, dimensions, layers, undo, redo, invertSelection, duplicateSelectionAsLayer, startTransform, transformData, showHSLDialog, closeHSLDialog, openHSLDialog, showBCDialog, closeBCDialog, openBCDialog, invertColors, showAdjustSelectionDialog, closeAdjustSelectionDialog, showMagicBgDialog, closeMagicBgDialog, showResizeCanvasDialog, handleResizeCanvas]);

  const fillSelectionWithCollision = useCallback((clickX, clickY) => {
    const cells = new Set();

    if (selection && selection.size > 0) {
      selection.forEach(key => {
        const [px, py] = key.split(',').map(Number);
        const cx = Math.floor(px / 8) * 8;
        const cy = Math.floor(py / 8) * 8;
        cells.add(`${cx},${cy}`);
      });
    } else if (clickX !== undefined && clickY !== undefined && activeLayer && activeLayer.type !== 'group') {
      const w = dimensions.w;
      const h = dimensions.h;
      if (clickX >= 0 && clickX < w && clickY >= 0 && clickY < h) {
        const visited = new Uint8Array(w * h);
        const stack = [[clickX, clickY]];
        const targetColor = activeLayer.data[clickY]?.[clickX] ?? null;

        while (stack.length > 0) {
          const [cx, cy] = stack.pop();
          if (cx < 0 || cx >= w || cy < 0 || cy >= h) continue;

          const idx = cy * w + cx;
          if (visited[idx]) continue;
          visited[idx] = 1;

          const color = activeLayer.data[cy]?.[cx] ?? null;
          if (color === targetColor) {
            const cellX = Math.floor(cx / 8) * 8;
            const cellY = Math.floor(cy / 8) * 8;
            cells.add(`${cellX},${cellY}`);

            stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
          }
        }
      }
    } else {
      return;
    }

    if (cells.size === 0) return;

    const cellCoords = Array.from(cells).map(key => {
      const [x, y] = key.split(',').map(Number);
      return { x, y };
    });
    const combinedRects = combineCellsToRectangles(cellCoords);

    const activeCol = collisions.find(c => c.id === activeCollisionId);
    const paintType = activeCol ? activeCol.type : 'solid';
    const paintAngle = activeCol ? activeCol.angle : undefined;

    const filteredCollisions = collisions.filter(c => {
      if (c.isGroup) return true;
      const overlapsAny = combinedRects.some(r => {
        return c.x < r.x + r.width &&
          c.x + c.width > r.x &&
          c.y < r.y + r.height &&
          c.y + c.height > r.y;
      });
      return !overlapsAny;
    });

    const updatedCollisions = [...filteredCollisions];

    // Grouping
    const groupId = Date.now() + Math.random();
    const groupCount = collisions.filter(c => c.isGroup).length + 1;
    const newGroup = {
      id: groupId,
      name: `Group ${groupCount}`,
      isGroup: true,
      type: paintType,
      angle: paintAngle
    };

    combinedRects.forEach((rect, idx) => {
      updatedCollisions.push({
        id: Date.now() + Math.random() + idx,
        name: `Collision ${collisions.length + idx + 1}`,
        type: paintType,
        angle: paintAngle,
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        isPainted: false,
        groupId: groupId
      });
    });

    updatedCollisions.push(newGroup);
    setActiveCollisionId(groupId);
    setCollisions(updatedCollisions);
    saveHistory("Fill Selection with Collision", layers, dimensions, { collisions: updatedCollisions });
  }, [selection, collisions, activeCollisionId, layers, dimensions, saveHistory, activeLayer]);

  const saveSelectionAsTile = () => {
    if (!selection || selection.size === 0) {
      alert("Please make a selection first!");
      return;
    }

    let minX = Infinity, minY = Infinity;
    selection.forEach(key => {
      const [x, y] = key.split(',').map(Number);
      if (x < minX) minX = x;
      if (y < minY) minY = y;
    });

    const tileData = Array(8).fill(null).map(() => Array(8).fill(null));
    let hasPixels = false;

    for (let py = 0; py < 8; py++) {
      for (let px = 0; px < 8; px++) {
        const sy = minY + py;
        const sx = minX + px;

        if (sy >= 0 && sy < dimensions.h && sx >= 0 && sx < dimensions.w) {
          let pixelVal = null;
          const visibleLayers = viewActiveOnly ? layers.filter(l => l.id === activeLayerId) : layers;
          for (let i = 0; i < visibleLayers.length; i++) {
            if (visibleLayers[i].visible && visibleLayers[i].data[sy] && visibleLayers[i].data[sy][sx] !== null) {
              pixelVal = visibleLayers[i].data[sy][sx];
              break;
            }
          }

          tileData[py][px] = pixelVal;
          if (pixelVal !== null) hasPixels = true;
        }
      }
    }

    if (!hasPixels) {
      alert("The captured area is completely empty!");
      return;
    }

    const newTile = {
      id: Date.now() + Math.random(),
      name: "Custom Tile",
      collisionType: "none",
      data: tileData
    };

    setSavedTiles([...savedTiles, newTile]);
    setActiveSavedTileId(newTile.id);
    setSelection(null);
    setTool('tile');
    setActiveDraw('tile');
  };

  const handleTileSheetUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const loadingToastId = toast.loading("Loading image...");

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        try {
          let w = img.width;
          let h = img.height;
          const MAX_DIM = 1024;
          if (w > MAX_DIM || h > MAX_DIM) {
            const scale = Math.min(MAX_DIM / w, MAX_DIM / h);
            w = Math.floor(w * scale / 8) * 8;
            h = Math.floor(h * scale / 8) * 8;
          }

          const tempCanvas = document.createElement('canvas');
          const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
          tempCanvas.width = w;
          tempCanvas.height = h;
          tempCtx.drawImage(img, 0, 0, w, h);

          const imageData = tempCtx.getImageData(0, 0, w, h).data;

          // 1. Extract unique non-transparent colors and count frequencies
          const colorCounts = {};
          for (let i = 0; i < imageData.length; i += 4) {
            const a = imageData[i + 3];
            if (a >= 128) {
              const r = imageData[i];
              const g = imageData[i + 1];
              const b = imageData[i + 2];
              const hex = "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
              colorCounts[hex] = (colorCounts[hex] || 0) + 1;
            }
          }

          const uniqueColors = Object.keys(colorCounts);

          // Group similar colors together to avoid duplicate slots for similar shades
          const hexToRgb = (hex) => {
            const r = parseInt(hex.substring(1, 3), 16) || 0;
            const g = parseInt(hex.substring(3, 5), 16) || 0;
            const b = parseInt(hex.substring(5, 7), 16) || 0;
            return { r, g, b };
          };

          const getDistance = (c1, c2) => {
            const dr = c1.r - c2.r;
            const dg = c1.g - c2.g;
            const db = c1.b - c2.b;
            return Math.sqrt(dr * dr + dg * dg + db * db);
          };

          const colorList = uniqueColors.map(hex => ({
            hex,
            count: colorCounts[hex],
            rgb: hexToRgb(hex)
          }));

          // Sort by count descending
          colorList.sort((a, b) => b.count - a.count);

          const dominantColors = colorList.map(c => c.hex).slice(0, 256);

          // Pad to 16 if needed
          while (dominantColors.length < 16) {
            const defaultPal = recentColors && recentColors.length > 0 ? recentColors : DEFAULT_16_PALETTE;
            const nextColor = defaultPal.find(c => !dominantColors.includes(c)) || '#000000';
            dominantColors.push(nextColor);
          }

          // Import tileset directly without prompting
          importTilesDirectly({
            imageData,
            w,
            h,
            filename: file.name,
            dominantColors,
            uniqueColors,
            loadingToastId
          }, 'keep');
          if (tileSheetInputRef.current) tileSheetInputRef.current.value = "";
        } catch (error) {
          console.error("Error processing sprite sheet:", error);
          toast.error("Failed to process sprite sheet.", { id: loadingToastId });
        }
      };
      img.onerror = () => toast.error("Failed to load image.", { id: loadingToastId });
      img.src = event.target.result;
    };
    reader.onerror = () => toast.error("Failed to read file.", { id: loadingToastId });
    reader.readAsDataURL(file);
  };

  const importTilesDirectly = useCallback((importData, choice) => {
    const { imageData, w, h, filename, dominantColors, uniqueColors, loadingToastId } = importData;
    
    let finalPalette;
    let dominantColorsList = [...dominantColors];

    let updatedTiles = savedTiles;
    let updatedScenes = scenes;
    let updatedActiveLayers = layers;
    let updatedHudSettings = hudSettings;

    if (choice === 'replace') {
      // 1. Update the project palette to match the imported image, filtering out near-identical colors
      let filteredDominant = filterSimilarColors(dominantColorsList, 100);
      if (filteredDominant.length < 16) {
        for (const col of dominantColorsList) {
          if (!filteredDominant.includes(col)) {
            filteredDominant.push(col);
          }
          if (filteredDominant.length >= 16) break;
        }
      }
      finalPalette = sortColorsByHue(filteredDominant.slice(0, 256));
      dominantColorsList = finalPalette;

      // 2. Convert all other/existing tiles to use the new palette
      updatedTiles = savedTiles.map(tile => {
        const newData = tile.data.map(row => 
          row.map(color => color ? getClosestPaletteColor(color, finalPalette) : null)
        );
        return { ...tile, data: newData };
      });

      // 3. Convert all scene level designs to use the new palette
      updatedScenes = scenes.map(scene => {
        const updatedFrames = scene.frames.map(frame => {
          const updatedLayers = frame.layers.map(layer => {
            if (layer.type === 'layer') {
              const updatedLayer = { ...layer };
              if (layer.data) {
                updatedLayer.data = layer.data.map(row => 
                  row.map(color => color ? getClosestPaletteColor(color, finalPalette) : null)
                );
              }
              if (layer.textData) {
                const updatedTextData = { ...layer.textData };
                if (layer.textData.color) {
                  updatedTextData.color = getClosestPaletteColor(layer.textData.color, finalPalette);
                }
                if (layer.textData.outlineColor) {
                  updatedTextData.outlineColor = getClosestPaletteColor(layer.textData.outlineColor, finalPalette);
                }
                updatedLayer.textData = updatedTextData;
              }
              return updatedLayer;
            }
            return layer;
          });
          return { ...frame, layers: updatedLayers };
        });
        return { ...scene, frames: updatedFrames };
      });

      // 4. Convert the active layers
      updatedActiveLayers = layers.map(layer => {
        if (layer.type === 'layer') {
          const updatedLayer = { ...layer };
          if (layer.data) {
            updatedLayer.data = layer.data.map(row => 
              row.map(color => color ? getClosestPaletteColor(color, finalPalette) : null)
            );
          }
          if (layer.textData) {
            const updatedTextData = { ...layer.textData };
            if (layer.textData.color) {
              updatedTextData.color = getClosestPaletteColor(layer.textData.color, finalPalette);
            }
            if (layer.textData.outlineColor) {
              updatedTextData.outlineColor = getClosestPaletteColor(layer.textData.outlineColor, finalPalette);
            }
            updatedLayer.textData = updatedTextData;
          }
          return updatedLayer;
        }
        return layer;
      });

      // Update currentColor and secondaryColor
      if (currentColor) {
        setCurrentColor(getClosestPaletteColor(currentColor, finalPalette));
      } else if (finalPalette.length > 0) {
        setCurrentColor(finalPalette[0]);
      }

      if (secondaryColor) {
        setSecondaryColor(getClosestPaletteColor(secondaryColor, finalPalette));
      }

      // Update hudSettings
      if (hudSettings) {
        updatedHudSettings = { ...hudSettings };
        let hudChanged = false;
        if (hudSettings.backgroundColor) {
          updatedHudSettings.backgroundColor = getClosestPaletteColor(hudSettings.backgroundColor, finalPalette);
          hudChanged = true;
        }
        if (hudSettings.textColor) {
          updatedHudSettings.textColor = getClosestPaletteColor(hudSettings.textColor, finalPalette);
          hudChanged = true;
        }
        if (hudChanged && setHudSettings) {
          setHudSettings(updatedHudSettings);
        }
      }

      // Update creditsBgColor and creditsTextColor
      if (creditsBgColor && setCreditsBgColor) {
        setCreditsBgColor(getClosestPaletteColor(creditsBgColor, finalPalette));
      }
      if (creditsTextColor && setCreditsTextColor) {
        setCreditsTextColor(getClosestPaletteColor(creditsTextColor, finalPalette));
      }

      // Update textSettings
      if (textSettings && setTextSettings) {
        const updatedTextSettings = { ...textSettings };
        let textSettingsChanged = false;
        if (textSettings.outlineColor) {
          updatedTextSettings.outlineColor = getClosestPaletteColor(textSettings.outlineColor, finalPalette);
          textSettingsChanged = true;
        }
        if (textSettingsChanged) {
          setTextSettings(updatedTextSettings);
        }
      }

      setSavedTiles(updatedTiles);
      setScenes(updatedScenes);
      setLayers(updatedActiveLayers);
      setRecentColors(finalPalette);

      saveHistory("Convert Palette & Tiles/Scenes", updatedActiveLayers, dimensions, { 
        savedTiles: updatedTiles, 
        recentColors: finalPalette,
        scenes: updatedScenes,
        hudSettings: updatedHudSettings
      });
    } else {
      // Keep existing project palette, but check if we can add any missing colors from the imported image's dominant colors (up to 256 total)
      const currentPalette = recentColors && recentColors.length > 0 ? [...recentColors] : [...DEFAULT_16_PALETTE];
      const newColors = dominantColorsList.filter(color => !currentPalette.includes(color));
      const spaceLeft = 256 - currentPalette.length;

      if (newColors.length > 0 && spaceLeft > 0) {
        let colorsToAdd = filterSimilarColors(newColors, 100, currentPalette);
        if (colorsToAdd.length === 0) {
          colorsToAdd = newColors.slice(0, spaceLeft);
        } else if (colorsToAdd.length > spaceLeft) {
          colorsToAdd = colorsToAdd.slice(0, spaceLeft);
        }
        finalPalette = sortColorsByHue([...currentPalette, ...colorsToAdd]);
        setRecentColors(finalPalette);
      } else {
        finalPalette = currentPalette;
      }
    }

    // Now, build the colorMap to convert the imported image colors
    const colorMap = {};
    for (const origColor of uniqueColors) {
      colorMap[origColor] = getClosestPaletteColor(origColor, finalPalette);
    }

    // Parse the image into 8x8 tiles using the colorMap
    const cols = Math.floor(w / 8);
    const rows = Math.floor(h / 8);
    const newTiles = [];
    
    const currentSavedTiles = updatedTiles;

    const existingTileFingerprints = new Set(currentSavedTiles.map(tile => JSON.stringify(tile.data)));

    for (let ty = 0; ty < rows; ty++) {
      for (let tx = 0; tx < cols; tx++) {
        const tileData = Array(8).fill(null).map(() => Array(8).fill(null));
        let hasPixels = false;

        for (let py = 0; py < 8; py++) {
          for (let px = 0; px < 8; px++) {
            const srcX = tx * 8 + px;
            const srcY = ty * 8 + py;
            const i = (srcY * w + srcX) * 4;
            const r = imageData[i], g = imageData[i + 1], b = imageData[i + 2], a = imageData[i + 3];

            if (a < 128) {
              tileData[py][px] = null;
            } else {
              const hex = "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
              tileData[py][px] = colorMap[hex] || null;
              hasPixels = true;
            }
          }
        }

        if (hasPixels) {
          const fingerprint = JSON.stringify(tileData);
          if (!existingTileFingerprints.has(fingerprint)) {
            newTiles.push({
              id: generateUniqueId(),
              name: `Tile ${currentSavedTiles.length + newTiles.length + 1}`,
              collisionType: "none",
              data: tileData
            });
            existingTileFingerprints.add(fingerprint);
          }
        }
      }
    }

    if (newTiles.length > 0) {
      const finalTiles = [...currentSavedTiles, ...newTiles];
      setSavedTiles(finalTiles);
      
      if (choice !== 'replace') {
        saveHistory("Import Tileset", layers, dimensions, { savedTiles: finalTiles });
      } else {
        saveHistory("Convert Palette & Import Tileset", updatedActiveLayers, dimensions, { 
          savedTiles: finalTiles,
          recentColors: finalPalette,
          scenes: updatedScenes,
          hudSettings: updatedHudSettings
        });
      }
      toast.success(`Imported ${newTiles.length} tiles!`, { id: loadingToastId });
    } else {
      toast.success("No new unique tiles found.", { id: loadingToastId });
    }
  }, [savedTiles, scenes, layers, recentColors, dimensions, saveHistory, currentColor, secondaryColor, hudSettings, creditsBgColor, creditsTextColor, textSettings, setCurrentColor, setSecondaryColor, setHudSettings, setCreditsBgColor, setCreditsTextColor, setTextSettings]);

  const executeTileImport = useCallback((choice) => {
    if (!pendingTileImportData) return;
    importTilesDirectly(pendingTileImportData, choice);
    setShowTileImportPaletteDialog(false);
    setPendingTileImportData(null);
  }, [pendingTileImportData, importTilesDirectly]);

  // Tools Logic
  const cropSelection = () => {
    if (!selection || selection.size === 0) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    selection.forEach(key => {
      const [x, y] = key.split(',').map(Number);
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    });
    const cropW = (maxX - minX) + 1;
    const cropH = (maxY - minY) + 1;
    const croppedLayers = layers.map(layer => {
      if (layer.type === 'group') return layer;
      const newData = Array.from({ length: cropH }, (_, y) => {
        const row = new Array(cropW).fill(null);
        for (let x = 0; x < cropW; x++) {
          const srcX = minX + x;
          const srcY = minY + y;
          if (layer.data[srcY] && layer.data[srcY][srcX] !== undefined) row[x] = layer.data[srcY][srcX];
        }
        return row;
      });
      return { ...layer, data: newData };
    });
    setDimensions({ w: cropW, h: cropH });
    setLayers(croppedLayers);
    setSelection(null);
    setTool('pen');
    saveHistory("Crop", croppedLayers, { w: cropW, h: cropH });
  };

  const outlineSelection = useCallback(() => {
    if (!selection || !activeLayer || activeLayer.type === 'group' || selection.size === 0) return;

    const newLayers = layers.map(layer => {
      if (layer.id !== activeLayerId || layer.type === 'group') return layer;

      const newData = [...layer.data];
      let changed = false;
      let edgePixels = [];

      selection.forEach(key => {
        const [x, y] = key.split(',').map(Number);
        let isEdge = false;
        const neighbors = [
          [x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]
        ];

        for (const [nx, ny] of neighbors) {
          if (nx < 0 || nx >= dimensions.w || ny < 0 || ny >= dimensions.h || (selection.size > 0 && !selection.has(`${nx},${ny}`))) {
            isEdge = true;
            break;
          }
        }

        if (isEdge) {
          edgePixels.push({ x, y, color: currentColor });
        }
      });

      if (drawWidth > 1 || brushType !== 'round' || colorJitter > 0) {
        edgePixels = getBrushPixels(edgePixels, drawWidth, brushType, colorJitter);
      }

      edgePixels = getSymmetricPixels(edgePixels, dimensions.w, dimensions.h, symmetryMode);

      edgePixels.forEach(p => {
        if (p.y >= 0 && p.y < dimensions.h && p.x >= 0 && p.x < dimensions.w) {
          if (newData[p.y] === layer.data[p.y]) newData[p.y] = [...layer.data[p.y]];
          let applyColor = p.color !== undefined ? p.color : currentColor;
          let finalColor = applyColor;
          if (applyColor && brushOpacity < 100) {
            finalColor = blendHexColors(newData[p.y][p.x], applyColor, brushOpacity);
          }
          if (newData[p.y][p.x] !== finalColor) { newData[p.y][p.x] = finalColor; changed = true; }
        }
      });

      return changed ? { ...layer, data: newData, textData: null } : layer;
    });

    setLayers(newLayers);
    saveHistory("Outline Selection", newLayers);
  }, [selection, layers, activeLayerId, activeLayer, currentColor, dimensions, saveHistory, drawWidth, getBrushPixels, brushType, colorJitter, brushOpacity, symmetryMode, getSymmetricPixels]);

  const addLayer = () => {
    const activeL = layers.find(l => l.id === activeLayerId);
    const groupId = activeL ? (activeL.type === 'group' ? activeL.id : activeL.groupId) : null;
    const newLayer = createEmptyLayer(`Layer ${layers.filter(l => l.type !== 'group').length + 1}`, groupId, dimensions.w, dimensions.h);

    const activeIndex = layers.findIndex(l => l.id === activeLayerId);
    const nextLayers = [...layers];
    nextLayers.splice(activeIndex !== -1 ? activeIndex : 0, 0, newLayer);

    setLayers(nextLayers);
    setActiveLayerId(newLayer.id);
    saveHistory("Add Layer", nextLayers);
  };

  const addGroup = () => {
    const newGroup = {
      id: Date.now() + Math.random(),
      type: 'group',
      name: `Group ${layers.filter(l => l.type === 'group').length + 1}`,
      visible: true,
      isOpen: true
    };
    const activeIndex = layers.findIndex(l => l.id === activeLayerId);
    const nextLayers = [...layers];
    nextLayers.splice(activeIndex !== -1 ? activeIndex : 0, 0, newGroup);

    setLayers(nextLayers);
    saveHistory("Add Group", nextLayers);
  };

  const moveLayerUp = (e, id) => {
    e.stopPropagation();
    const index = layers.findIndex(l => l.id === id);
    if (index <= 0) return;

    const newLayers = [...layers];
    const temp = newLayers[index - 1];
    newLayers[index - 1] = newLayers[index];
    newLayers[index] = temp;

    setLayers(newLayers);
    saveHistory("Move Layer Up", newLayers);
  };

  const moveLayerDown = (e, id) => {
    e.stopPropagation();
    const index = layers.findIndex(l => l.id === id);
    if (index === -1 || index === layers.length - 1) return;

    const newLayers = [...layers];
    const temp = newLayers[index + 1];
    newLayers[index + 1] = newLayers[index];
    newLayers[index] = temp;

    setLayers(newLayers);
    saveHistory("Move Layer Down", newLayers);
  };

  const mergeLayerDown = (id) => {
    const index = layers.findIndex(l => l.id === id);
    if (index === -1 || index === layers.length - 1 || layers[index].type === 'group') return;

    let bottomIndex = index + 1;
    while (bottomIndex < layers.length && layers[bottomIndex].type === 'group') bottomIndex++;

    if (bottomIndex >= layers.length) return;

    const topLayer = layers[index];
    const bottomLayer = layers[bottomIndex];

    const mergedData = bottomLayer.data.map((row, y) =>
      row.map((bottomPixel, x) => {
        const topPixel = topLayer.data[y][x];
        return topPixel === null ? bottomPixel : topPixel;
      })
    );

    const newMergedLayer = {
      ...bottomLayer,
      id: Date.now() + Math.random(),
      data: mergedData,
      name: `${bottomLayer.name} (Merged)`
    };

    const newLayers = [...layers];
    newLayers[bottomIndex] = newMergedLayer;
    newLayers.splice(index, 1);

    setLayers(newLayers);
    setActiveLayerId(newMergedLayer.id);
    saveHistory("Merge Down", newLayers);
  };

  const duplicateLayer = (e, id) => {
    e.stopPropagation();
    const index = layers.findIndex(l => l.id === id);
    if (index === -1) return;

    const original = layers[index];

    if (original.type === 'group') {
      const newGroupId = Date.now() + Math.random();
      const itemsToDuplicate = [original, ...layers.filter(l => String(l.groupId) === String(original.id))];

      const duplicatedItems = itemsToDuplicate.map((item, i) => {
        if (item.type === 'group') {
          return {
            ...item,
            id: newGroupId,
            name: `${item.name} (Copy)`
          };
        } else {
          return {
            ...item,
            id: Date.now() + Math.random() + i,
            groupId: newGroupId,
            data: item.data ? item.data.map(row => [...row]) : undefined,
            name: `${item.name} (Copy)`
          };
        }
      });

      const newLayers = [...layers];
      newLayers.splice(index, 0, ...duplicatedItems);

      setLayers(newLayers);
      setActiveLayerId(newGroupId);
      saveHistory("Duplicate Group", newLayers);
      return;
    }

    const duplicatedData = original.data.map(row => [...row]);

    const newLayer = {
      ...original,
      id: Date.now() + Math.random(),
      name: `${original.name} (Copy)`,
      data: duplicatedData,
      visible: true
    };

    const newLayers = [...layers];
    newLayers.splice(index, 0, newLayer);

    setLayers(newLayers);
    setActiveLayerId(newLayer.id);
    saveHistory("Duplicate Layer", newLayers);
  };

  const flattenLayers = () => {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = dimensions.w;
    tempCanvas.height = dimensions.h;
    const ctx = tempCanvas.getContext('2d', { willReadFrequently: true });
    renderLayersToCtx(ctx, 1);

    const imgData = ctx.getImageData(0, 0, dimensions.w, dimensions.h).data;
    const flattenedData = Array.from({ length: dimensions.h }, () => Array(dimensions.w).fill(null));

    for (let y = 0; y < dimensions.h; y++) {
      for (let x = 0; x < dimensions.w; x++) {
        const i = (y * dimensions.w + x) * 4;
        if (imgData[i + 3] > 0) {
          const r = imgData[i].toString(16).padStart(2, '0');
          const g = imgData[i + 1].toString(16).padStart(2, '0');
          const b = imgData[i + 2].toString(16).padStart(2, '0');
          flattenedData[y][x] = `#${r}${g}${b}`;
        }
      }
    }

    const flattenedLayer = {
      id: Date.now() + Math.random(),
      type: 'layer',
      name: "Flattened Image",
      visible: true,
      groupId: null,
      data: flattenedData
    };

    const nextLayers = [flattenedLayer];
    setLayers(nextLayers);
    setActiveLayerId(flattenedLayer.id);
    saveHistory("Flatten Layers", nextLayers);
  };

  const renameLayer = (id, newName) => {
    setLayers(layers.map(l => l.id === id ? { ...l, name: newName } : l));
  };

  const handleRenameComplete = () => {
    setEditingLayerId(null);
    saveHistory("Rename Layer", layers);
  };

  const generateProjectData = (state) => {
    const currentFrames = state.frames.map(f => f.id === state.activeFrameId ? { ...f, layers: state.layers } : f);
    const updatedScenes = state.scenes.map(s => s.id === state.activeSceneId ? { ...s, frames: currentFrames, actors: state.actors, triggers: state.triggers, collisions: state.collisions, dimensions: state.dimensions, worldX: s.worldX || 0, worldY: s.worldY || 0 } : s);
    return {
      version: "3.0",
      recentColors: state.recentColors || recentColors,
      dimensions: state.dimensions,
      savedTiles: state.savedTiles,
      variables: state.variables,
      animations: state.animations,
      customScripts: state.customScripts,
      globalScript: state.globalScript,
      musicTracks: state.musicTracks,
      activeSceneId: state.activeSceneId,
      activeFrameId: state.activeFrameId,
      activeLayerId: state.activeLayerId,
      guides: state.guides,
      gridSize: state.gridSize,
      isPixelated: state.isPixelated,
      onionSkinEnabled: state.onionSkinEnabled,
      scenes: updatedScenes,
      globalActors: state.globalActors,
      hudSettings: state.hudSettings,
      includeCreditsScene: state.includeCreditsScene,
      creditsText: state.creditsText,
      includedArtists: state.includedArtists,
      creditsBgColor: state.creditsBgColor,
      creditsTextColor: state.creditsTextColor,
      creditsMusicId: state.creditsMusicId,
      creditsEffect: state.creditsEffect,
      layers: state.layers.map(l => ({
        id: l.id,
        type: l.type || 'layer',
        name: l.name,
        visible: l.visible,
        isOpen: l.isOpen,
        groupId: l.groupId,
        opacity: l.opacity,
        blendMode: l.blendMode,
        outline: l.outline,
        outlineColor: l.outlineColor,
        outlineWidth: l.outlineWidth,
        dropShadow: l.dropShadow,
        shadowColor: l.shadowColor,
        shadowOffsetX: l.shadowOffsetX,
        shadowOffsetY: l.shadowOffsetY,
        blur: l.blur,
        blurAmount: l.blurAmount,
        colorOverlay: l.colorOverlay,
        colorOverlayColor: l.colorOverlayColor,
        colorOverlayOpacity: l.colorOverlayOpacity,
        gradientOverlay: l.gradientOverlay,
        gradientOverlayColor1: l.gradientOverlayColor1,
        gradientOverlayColor2: l.gradientOverlayColor2,
        gradientOverlayOpacity: l.gradientOverlayOpacity,
        clipping: l.clipping,
        pixelate: l.pixelate,
        pixelateSize: l.pixelateSize,
        distort: l.distort,
        distortAmount: l.distortAmount,
        distortScale: l.distortScale,
        textData: l.textData,
        data: l.data
      })),
      timestamp: Date.now()
    };
  };

  const exportProjectJSON = () => {
    const projectData = generateProjectData({
      frames, activeFrameId, layers, scenes, activeSceneId, actors, globalActors, triggers, collisions, dimensions, savedTiles, variables, animations, customScripts, globalScript, musicTracks, activeLayerId, guides, gridSize, isPixelated, onionSkinEnabled,
      hudSettings, includeCreditsScene, creditsText, includedArtists, creditsBgColor, creditsTextColor, creditsMusicId, creditsEffect,
      recentColors
    });

    const blob = new Blob([JSON.stringify(projectData)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `PxGBA-${Date.now()}.pxg`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const pollCompileJob = async (jobId, toastId, onProgress) => {
    const timeoutMs = 30 * 60 * 1000;
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      await new Promise(r => setTimeout(r, 2000));
      const statusRes = await fetch(`${API_BASE_URL}/compile-status/${jobId}`);
      if (!statusRes.ok) throw new Error(`Failed to check compilation status: ${statusRes.status}`);
      const job = await statusRes.json();
      if (onProgress) onProgress(job);
      if (job.status === 'ready') return job;
      if (job.status === 'error') throw new Error(job.error || 'Compilation failed');
    }
    throw new Error('Compilation timed out');
  };

  const publishRom = async () => {
    if (isBusy) return;
    if (!validateScenesLayers()) return;
    setIsBusy(true);
    setIsPublishingRom(true);
    const toastId = toast.loading("Generating project data...");
    try {
      const zipBlob = await exportGameAssets(exportLevelName || 'game', 'butano', exportLevelType || 'TOPDOWN', true);
      if (!zipBlob) throw new Error("Failed to generate project data.");

      toast.loading("Compiling project... This may take a minute.", { id: toastId });
      const formData = new FormData();
      formData.append('project', new File([zipBlob], 'project.zip', { type: 'application/zip' }));

      const response = await fetch(`${API_BASE_URL}/compile`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Compilation Error:", errorText);
        throw new Error(`Compilation failed: ${response.status}. See console for details.`);
      }

      const { jobId } = await response.json();
      const job = await pollCompileJob(jobId, toastId);

      toast.loading("Downloading ROM...", { id: toastId });
      const downloadUrl = `${API_BASE_URL}${job.downloadUrl}`;
      const downloadRes = await fetch(downloadUrl);
      if (!downloadRes.ok) throw new Error(`Download failed: ${downloadRes.status}`);
      const blob = await downloadRes.blob();

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `game-${Date.now()}.gba`;
      link.click();
      URL.revokeObjectURL(url);

      toast.success("ROM Published and Downloaded!", { id: toastId });
      setShowExportDialog(false);
    } catch (err) {
      toast.error(err.message, { id: toastId });
    } finally {
      setIsPublishingRom(false);
      setIsBusy(false);
    }
  };

  const exportHtml5 = async () => {
    if (isBusy) return;
    if (!validateScenesLayers()) return;
    setIsBusy(true);
    const toastId = toast.loading("Generating project data...");
    try {
      const zipBlob = await exportGameAssets(exportLevelName || 'game', 'butano', exportLevelType || 'TOPDOWN', true);
      if (!zipBlob) throw new Error("Failed to generate project data.");

      toast.loading("Compiling project... This may take a minute.", { id: toastId });
      const formData = new FormData();
      formData.append('project', new File([zipBlob], 'project.zip', { type: 'application/zip' }));
      formData.append('html5', 'true');
      formData.append('bgColor', html5BgColor);
      formData.append('containerColor', html5ContainerColor);
      formData.append('credits', creditsText);

      const response = await fetch(`${API_BASE_URL}/compile`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("HTML5 Export Error:", errorText);
        throw new Error(`HTML5 export failed: ${response.status}. See console for details.`);
      }

      const { jobId } = await response.json();
      const job = await pollCompileJob(jobId, toastId);

      toast.loading("Downloading HTML5 export...", { id: toastId });
      const downloadUrl = `${API_BASE_URL}${job.downloadUrl}`;
      const downloadRes = await fetch(downloadUrl);
      if (!downloadRes.ok) throw new Error(`Download failed: ${downloadRes.status}`);
      const blob = await downloadRes.blob();

      let filename = `game-${Date.now()}-html5-export.zip`;
      const cdHeader = downloadRes.headers.get('Content-Disposition');
      if (cdHeader) {
        const match = cdHeader.match(/filename\*?=(?:UTF-8'')?["']?([^;"'\s]+)["']?/i);
        if (match) filename = match[1];
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);

      toast.success("HTML5 Export Downloaded!", { id: toastId });
      setShowHtml5ExportDialog(false);
    } catch (err) {
      toast.error(err.message, { id: toastId });
    } finally {
      setIsBusy(false);
    }
  };

  const exportExe = async () => {
    if (isBusy) return;
    if (!validateScenesLayers()) return;
    setIsBusy(true);
    const toastId = toast.loading("Generating project data...");
    try {
      const zipBlob = await exportGameAssets(exportLevelName || 'game', 'butano', exportLevelType || 'TOPDOWN', true);
      if (!zipBlob) throw new Error("Failed to generate project data.");

      toast.loading("Compiling project... This may take a minute.", { id: toastId });
      const formData = new FormData();
      formData.append('project', new File([zipBlob], 'project.zip', { type: 'application/zip' }));
      formData.append('exe', 'true');

      const response = await fetch(`${API_BASE_URL}/compile`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("EXE Export Error:", errorText);
        throw new Error(`EXE export failed: ${response.status}. See console for details.`);
      }

      const { jobId } = await response.json();
      const job = await pollCompileJob(jobId, toastId);

      toast.loading("Downloading Windows package...", { id: toastId });
      const downloadUrl = `${API_BASE_URL}${job.downloadUrl}`;
      const downloadRes = await fetch(downloadUrl);
      if (!downloadRes.ok) throw new Error(`Download failed: ${downloadRes.status}`);
      const blob = await downloadRes.blob();

      let filename = `game-${Date.now()}-windows-export.zip`;
      const cdHeader = downloadRes.headers.get('Content-Disposition');
      if (cdHeader) {
        const match = cdHeader.match(/filename\*?=(?:UTF-8'')?["']?([^;"'\s]+)["']?/i);
        if (match) filename = match[1];
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);

      toast.success("Windows Export Downloaded!", { id: toastId });
      setShowExportDialog(false);
    } catch (err) {
      toast.error(err.message, { id: toastId });
    } finally {
      setIsBusy(false);
    }
  };

  const loadProjectData = useCallback((project) => {
    if (!project.layers || !project.dimensions) throw new Error("Invalid project file");

    if (project.recentColors) {
      setRecentColors(project.recentColors);
    }

    const loadedTilesMap = new Map();
    const customTiles = [];
    (project.savedTiles || []).forEach((t, idx) => {
      const tile = {
        ...t,
        name: t.name || `Tile ${idx + 1}`,
        collisionType: t.collisionType || 'none'
      };
      const isDefault = INITIAL_DEFAULT_TILES.some(def => def.id === tile.id);
      if (isDefault) {
        loadedTilesMap.set(tile.id, tile);
      } else {
        customTiles.push(tile);
      }
    });

    const activePalette = project.recentColors || recentColors || DEFAULT_16_PALETTE;
    const loadedTiles = INITIAL_DEFAULT_TILES.map(defTile => {
      if (loadedTilesMap.has(defTile.id)) {
        return loadedTilesMap.get(defTile.id);
      }
      const copiedTile = JSON.parse(JSON.stringify(defTile));
      copiedTile.data = copiedTile.data.map(row =>
        row.map(color => color ? getClosestPaletteColor(color, activePalette) : null)
      );
      return copiedTile;
    });
    loadedTiles.push(...customTiles);

    const fallbackTiles = INITIAL_DEFAULT_TILES.map(defTile => {
      const copiedTile = JSON.parse(JSON.stringify(defTile));
      copiedTile.data = copiedTile.data.map(row =>
        row.map(color => color ? getClosestPaletteColor(color, activePalette) : null)
      );
      return copiedTile;
    });
    setSavedTiles(loadedTiles.length > 0 ? loadedTiles : fallbackTiles);
    if (loadedTiles.length > 0) {
      setActiveSavedTileId(loadedTiles[0].id);
    } else {
      setActiveSavedTileId(1);
    }
    const loadedVars = (project.variables || []).map((v, index) => ({
      id: v.id || Date.now() + Math.random() + index,
      ...v
    }));

    // Ensure PLAYER group exists
    let playerGroup = loadedVars.find(v => v.type === 'group' && v.name === 'PLAYER');
    if (!playerGroup) {
      const hasId9 = loadedVars.some(v => v.id === 9);
      playerGroup = { id: hasId9 ? (Date.now() + Math.random()) : 9, type: 'group', name: 'PLAYER', isOpen: true };
      loadedVars.unshift(playerGroup);
    }

    const defaultPlayerVars = [
      { id: 1, name: 'PLAYER_HP', type: 'number', initialValue: 10 },
      { id: 2, name: 'PLAYER_BONUS', type: 'number', initialValue: 0 },
      { id: 3, name: 'PLAYER_KEYS', type: 'number', initialValue: 0 },
      { id: 4, name: 'PLAYER_AMMO', type: 'number', initialValue: 100 },
      { id: 5, name: 'PLAYER_MAX_AMMO', type: 'number', initialValue: 100 },
      { id: 6, name: 'PLAYER_GRENADES', type: 'number', initialValue: 0 },
      { id: 7, name: 'PLAYER_MAGNET', type: 'number', initialValue: 0 },
      { id: 8, name: 'PLAYER_XP', type: 'number', initialValue: 0 }
    ];

    defaultPlayerVars.forEach(defaultVar => {
      const existing = loadedVars.find(v => v.name === defaultVar.name);
      if (!existing) {
        // Insert right after the playerGroup
        const groupIndex = loadedVars.indexOf(playerGroup);
        let insertIndex = groupIndex + 1;
        while (insertIndex < loadedVars.length && loadedVars[insertIndex].groupId === playerGroup.id) {
          insertIndex++;
        }
        loadedVars.splice(insertIndex, 0, {
          ...defaultVar,
          groupId: playerGroup.id
        });
      } else {
        if (!existing.id) existing.id = defaultVar.id;
        existing.groupId = playerGroup.id;
      }
    });

    setVariables(loadedVars);
    setAnimations(project.animations || []);
    setCustomScripts(project.customScripts || []);
    setGlobalScript(project.globalScript || { nodes: [{ id: 'start', position: { x: 250, y: 100 }, data: { label: 'On Update' }, type: 'input' }], edges: [] });
    setMusicTracks(project.musicTracks || []);
    if (project.guides) setGuides(project.guides);
    if (project.gridSize !== undefined) setGridSize(project.gridSize);
    if (project.isPixelated !== undefined) setIsPixelated(project.isPixelated);
    if (project.onionSkinEnabled !== undefined) setOnionSkinEnabled(project.onionSkinEnabled);
    if (project.includeCreditsScene !== undefined) setIncludeCreditsScene(project.includeCreditsScene);
    if (project.creditsText !== undefined) setCreditsText(project.creditsText);
    if (project.includedArtists !== undefined) setIncludedArtists(project.includedArtists);
    if (project.creditsBgColor !== undefined) setCreditsBgColor(project.creditsBgColor);
    if (project.creditsTextColor !== undefined) setCreditsTextColor(project.creditsTextColor);
    if (project.creditsMusicId !== undefined) setCreditsMusicId(project.creditsMusicId);
    if (project.creditsEffect !== undefined) setCreditsEffect(project.creditsEffect);
    if (project.hudSettings !== undefined) {
      const loaded = project.hudSettings;
      const isVertical = loaded.position === 'left' || loaded.position === 'right';
      const defaultW = isVertical ? 2 : 30;
      const defaultH = isVertical ? 20 : 2;
      const normalizedW = (loaded.width > 32) ? Math.round(loaded.width / 8) : (loaded.width ?? defaultW);
      const normalizedH = (loaded.height > 32) ? Math.round(loaded.height / 8) : (loaded.height ?? defaultH);
      const defaultBg = getDarkestColor(project.recentColors || recentColors || DEFAULT_16_PALETTE);
      const defaultTxt = getLightestColor(project.recentColors || recentColors || DEFAULT_16_PALETTE);
      setHudSettings({
        enabled: loaded.enabled ?? false,
        position: loaded.position || 'top',
        width: normalizedW,
        height: normalizedH,
        backgroundColor: loaded.backgroundColor !== undefined ? loaded.backgroundColor : null,
        textColor: loaded.textColor || defaultTxt,
        alignment: loaded.alignment || 'left',
        spacing: loaded.spacing || 'space-between',
        verticalText: loaded.verticalText ?? false,
        displayItems: loaded.displayItems || [
          { id: 'item_hp', tileId: 21, text: 'x {PLAYER_HP}' },
          { id: 'item_bonus', tileId: 5, text: 'x {PLAYER_BONUS}' }
        ]
      });
    } else {
      setHudSettings({
        enabled: true,
        position: 'top',
        width: 30,
        height: 2,
        backgroundColor: null,
        textColor: getLightestColor(recentColors || DEFAULT_16_PALETTE),
        alignment: 'left',
        spacing: 'space-between',
        verticalText: false,
        displayItems: [
          { id: 'item_hp', tileId: 21, text: 'x {PLAYER_HP}' },
          { id: 'item_bonus', tileId: 5, text: 'x {PLAYER_BONUS}' }
        ]
      });
    }

    let loadedLayers = [];
    let activeScene = null;
    let sceneFrames = [];
    let restoredFrameId = null;
    let restoredLayers = [];
    let newFrame = null;
    let newScene = null;
    let newLayers = [];

    if (project.scenes) {
      setScenes(project.scenes);
      activeScene = project.scenes.find(s => s.id === project.activeSceneId) || project.scenes[0];
      setDimensions(activeScene.dimensions);

      sceneFrames = activeScene.frames;
      if (!sceneFrames || sceneFrames.length === 0) {
        sceneFrames = [{ id: 'frame-1', layers: activeScene.layers || [] }];
      }

      setFrames(sceneFrames);

      restoredFrameId = project.activeFrameId && sceneFrames.find(f => f.id === project.activeFrameId) ? project.activeFrameId : sceneFrames[0].id;
      setActiveFrameId(restoredFrameId);

      restoredLayers = sceneFrames.find(f => f.id === restoredFrameId)?.layers || sceneFrames[0].layers;
      setLayers(restoredLayers);
      loadedLayers = restoredLayers;

      setActiveSceneId(activeScene.id);
        setActors(activeScene.actors || []);
        setGlobalActors(project.globalActors || []);
        setTriggers(activeScene.triggers || []);
      setCollisions(activeScene.collisions || []);
      setActiveActorId(null);
      setActiveTriggerId(null);
      setActiveCollisionId(null);
      setActiveLayerId(project.activeLayerId && restoredLayers.find(l => l.id === project.activeLayerId) ? project.activeLayerId : (restoredLayers.find(l => l.type !== 'group')?.id || restoredLayers[0].id));
    } else {
      // Backwards compatibility
      newLayers = project.layers.map(l => ({
        ...l,
        id: Date.now() + Math.random(),
        type: l.type || 'layer',
        groupId: l.groupId || null
      }));
      newFrame = { id: 'frame-1', layers: newLayers };
      setDimensions(project.dimensions);
      setFrames([newFrame]);
      setActiveFrameId(newFrame.id);
      setLayers(newLayers);
      loadedLayers = newLayers;
      newScene = {
        id: Date.now() + Math.random(),
        name: 'Imported Scene',
        frames: [newFrame],
        actors: [],
        triggers: [],
        collisions: [],
        musicId: null,
        dimensions: project.dimensions,
        worldX: 0,
        worldY: 0
      };
      setScenes([newScene]);
      setActiveSceneId(newScene.id);
    setActors(newScene.actors);
      setTriggers([]);
      setCollisions([]);
      setActiveActorId(null);
      setActiveTriggerId(null);
      setActiveCollisionId(null);
      setActiveLayerId(newLayers.find(l => l.type !== 'group')?.id || newLayers[0].id);
    }

    if (containerRef.current) {
      const containerW = containerRef.current.clientWidth - 40;
      const containerH = containerRef.current.clientHeight - 40;
      const zW = containerW / project.dimensions.w;
      const zH = containerH / project.dimensions.h;
      setZoom(Math.max(0.1, Math.min(50, Math.min(zW, zH))));
      setPanOffset({ x: 0, y: 0 });
    }

    setTimeout(() => {
      saveHistory("Open Project", loadedLayers, project.dimensions, {
        savedTiles: loadedTiles,
        scenes: project.scenes ? project.scenes : [
          {
            id: newScene.id,
            name: 'Imported Scene',
            frames: [newFrame],
      actors: [{
        id: Date.now() + Math.random(),
        name: 'Player',
        type: 'player',
        x: Math.floor(project.dimensions.w / 2 / 8) * 8,
        y: Math.floor(project.dimensions.h / 2 / 8) * 8,
        width: 8,
        height: 8,
        color: '#65ff00',
        spriteId: 1,
        isHidden: false,
        hflip: true,
        attackAnimId: null,
        script: { nodes: [{ id: 'start', position: { x: 250, y: 100 }, data: { label: 'On Update' }, type: 'input' }], edges: [] }
      }],
            triggers: [],
            collisions: [],
            musicId: null,
            dimensions: project.dimensions,
            worldX: 0,
            worldY: 0
          }
        ],
        actors: project.scenes ? (activeScene?.actors || []) : [],
        triggers: project.scenes ? (activeScene?.triggers || []) : [],
        collisions: project.scenes ? (activeScene?.collisions || []) : [],
        variables: project.variables || [],
        animations: project.animations || [],
        customScripts: project.customScripts || [],
        globalScript: project.globalScript || { nodes: [{ id: 'start', position: { x: 250, y: 100 }, data: { label: 'On Update' }, type: 'input' }], edges: [] },
        musicTracks: project.musicTracks || [],
        frames: project.scenes ? sceneFrames : [newFrame],
        activeSceneId: project.scenes ? activeScene.id : newScene.id,
        activeFrameId: project.scenes ? restoredFrameId : newFrame.id,
        activeLayerId: project.scenes ? (project.activeLayerId && restoredLayers.find(l => l.id === project.activeLayerId) ? project.activeLayerId : (restoredLayers.find(l => l.type !== 'group')?.id || restoredLayers[0].id)) : (newLayers.find(l => l.type !== 'group')?.id || newLayers[0].id)
      });
    }, 10);
  }, [saveHistory]);

  const handleProjectUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const project = JSON.parse(event.target.result);
        loadProjectData(project);
      } catch (err) { alert("Failed to load project: " + err.message); }
    };
    reader.readAsText(file);
    if (projectInputRef.current) projectInputRef.current.value = "";
  };


  const exportLayerAsPNG = (layer) => {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = dimensions.w;
    tempCanvas.height = dimensions.h;
    const ctx = tempCanvas.getContext('2d');
    renderLayersToCtx(ctx, 1, [layer]);

    const link = document.createElement('a');
    link.download = `${layer.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-${Date.now()}.png`;
    link.href = tempCanvas.toDataURL('image/png');
    link.click();
  };

  const exportPNG = async () => {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = dimensions.w;
    tempCanvas.height = dimensions.h;
    const ctx = tempCanvas.getContext('2d');
    renderLayersToCtx(ctx, 1);

    const link = document.createElement('a');
    link.download = `PxGBA-${dimensions.w}x${dimensions.h}.png`;
    link.href = tempCanvas.toDataURL('image/png');
    link.click();
  };

  const exportAllLayersZipped = async () => {
    const zip = new JSZip();
    const folder = zip.folder("scenes");
    const toastId = toast.loading("Exporting scenes as PNGs...");

    const actualScenes = scenes.filter(s => s.type !== 'group');
    for (let i = 0; i < actualScenes.length; i++) {
      const scene = actualScenes[i];
      const sceneLayers = scene.frames && scene.frames.length > 0 ? scene.frames[0].layers : [];
      const tempCanvas = document.createElement('canvas');
      const sceneDims = scene.dimensions || dimensions;
      tempCanvas.width = sceneDims.w;
      tempCanvas.height = sceneDims.h;
      renderLayersToCtx(tempCanvas.getContext('2d'), 1, sceneLayers, sceneDims);

      const blob = await new Promise(resolve => tempCanvas.toBlob(resolve, 'image/png'));
      const safeName = scene.name.replace(/[^a-z0-9_ ]/gi, '_').replace(/\s+/g, '_').toLowerCase() || `scene_${i + 1}`;
      folder.file(`${safeName}.png`, blob);
    }

    const content = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(content);
    const link = document.createElement('a');
    link.href = url;
    link.download = `scenes-${Date.now()}.zip`;
    link.click();
    URL.revokeObjectURL(url);

    toast.success("Scenes exported!", { id: toastId });
  };

  const validateScenesLayers = useCallback(() => {
    const hudEnabled = hudSettings && hudSettings.enabled;
    const maxLayers = hudEnabled ? 2 : 3;
    const invalidScenes = [];

    scenes.forEach(scene => {
      let sceneLayers;
      if (scene.id === activeSceneId) {
        sceneLayers = layers;
      } else {
        let sceneFrames = scene.frames;
        if (!sceneFrames || sceneFrames.length === 0) {
          sceneLayers = scene.layers || [];
        } else {
          sceneLayers = sceneFrames[0]?.layers || [];
        }
      }

      const count = getEffectiveLayerCount(sceneLayers);
      if (count > maxLayers) {
        invalidScenes.push({
          name: scene.name,
          count: count
        });
      }
    });

    if (invalidScenes.length > 0) {
      const sceneDetails = invalidScenes.map(s => `- ${s.name} (has ${s.count} layers, limit is ${maxLayers})`).join('\n');
      const hudMsg = hudEnabled
        ? "If the HUD is enabled, you can only have a total of 2 layers per scene."
        : "If the HUD is disabled, you can only have a total of 3 layers per scene.";
      const errorMsg = `Cannot export or play test. The following scenes exceed the background layer limit:\n${sceneDetails}\n\n${hudMsg}\nPlease merge layers into groups or delete/disable layers to fix this.`;
      toast.error(errorMsg, { duration: 6000 });
      return false;
    }
    return true;
  }, [scenes, layers, activeSceneId, hudSettings]);

  const exportGameAssets = async (levelName, format, levelType, skipDownload = false) => {
    if (!validateScenesLayers()) {
      return null;
    }
    if (savedTiles.length === 0) {
      toast.error("Please capture or import tiles in the Tiles Panel first.");
      return;
    }

    let currentSceneIdx = -1;
    let startingSceneIdx = scenes.findIndex(s => s.isStarting);
    if (startingSceneIdx === -1) startingSceneIdx = 0;
    const sanitizedName = levelName.replace(/[^a-z0-9_]/gi, '_').toLowerCase() || 'game';

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = dimensions.w;
    tempCanvas.height = dimensions.h;
    const ctx = tempCanvas.getContext('2d', { willReadFrequently: true });
    renderLayersToCtx(ctx, 1);

    const cols = Math.floor(dimensions.w / 8);
    const rows = Math.floor(dimensions.h / 8);

    const activeScene = scenes.find(s => s.id === activeSceneId);
    const sceneWorldX = activeScene ? activeScene.worldX || 0 : 0;
    const sceneWorldY = activeScene ? activeScene.worldY || 0 : 0;

    const formatCtx = {
      savedTiles, scenes, activeSceneId, dimensions, actors, globalActors, triggers, collisions,
      variables, animations, customScripts, globalScript, musicTracks,
      layers, frames, levelName, levelType, renderLayersToCtx,
      sanitizedName, cols, rows, tempCanvas, ctx, activeScene, sceneWorldX, sceneWorldY,
      hexToRgb, hexToRgbLocal, compress8bitNumberArray, parseColorTo32,
      JSZip, toast, document, startingSceneIdx,
      includeCreditsScene, includedArtists, recentColors, creditsText, creditsBgColor, creditsTextColor, creditsMusicId, creditsEffect,
      hudSettings,
    };

    const content = format === 'butano'
      ? await generateButano(formatCtx)
      : await generateFormat(format, formatCtx);

    if (skipDownload) {
      return content;
    }

    const toastLabel = format === 'butano' ? 'Butano GBA Project' : getFormatLabel(format);
    const toastId = toast.loading(`Generating ${toastLabel}...`);
    const url = URL.createObjectURL(content);
    const link = document.createElement('a');
    link.href = url;
    link.download = format === 'butano'
      ? `butano-${sanitizedName}-${Date.now()}.zip`
      : getFormatFilename(format, sanitizedName);
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`${toastLabel} exported successfully!`, { id: toastId });


  };

  const handleCreateNewProject = () => {
    const newDims = { w: newProjectSettings.w, h: newProjectSettings.h };
    const newLayer = createEmptyLayer('Background', null, newDims.w, newDims.h);

    if (!newProjectSettings.transparentBg) {
      newLayer.data = newLayer.data.map(row => row.map(() => newProjectSettings.bgColor));
    }

    const newFrame = { id: 'frame-1', layers: [newLayer] };

    setDimensions(newDims);
    setFrames([newFrame]);
    setActiveFrameId(newFrame.id);
    setLayers([newLayer]);
    setActiveLayerId(newLayer.id);

    const newScene = {
      id: Date.now() + Math.random(),
      name: 'Scene 1',
      frames: [newFrame],
      actors: [{
        id: Date.now() + Math.random(),
        name: 'Player',
        type: 'player',
        x: Math.floor(newDims.w / 2 / 8) * 8,
        y: Math.floor(newDims.h / 2 / 8) * 8,
        width: 8,
        height: 8,
        color: '#65ff00',
        spriteId: 1,
        isHidden: false,
        hflip: true,
        attackAnimId: null,
        script: { nodes: [{ id: 'start', position: { x: 250, y: 100 }, data: { label: 'On Update' }, type: 'input' }], edges: [] }
      }],
      triggers: [],
      collisions: [],
      musicId: null,
      dimensions: newDims,
      worldX: 0,
      worldY: 0
    };
    setScenes([newScene]);
    setActiveSceneId(newScene.id);

    if (containerRef.current) {
      const containerW = containerRef.current.clientWidth - 40;
      const containerH = containerRef.current.clientHeight - 40;
      if (containerW > 0 && containerH > 0) {
        const zW = containerW / newDims.w;
        const zH = containerH / newDims.h;
        const optimalZoom = Math.min(zW, zH);
        setZoom(Math.max(0.1, Math.min(50, optimalZoom >= 1 ? Math.floor(optimalZoom) : Math.floor(optimalZoom * 100) / 100)));
      } else {
        setZoom(15);
      }
      setPanOffset({ x: 0, y: 0 });
    }

    setHistory([{
      label: "New Project",
      layers: [newLayer],
      dimensions: newDims,
      timestamp: Date.now()
    }]);
    setHistoryIndex(0);

    setSavedTiles(JSON.parse(JSON.stringify(INITIAL_DEFAULT_TILES)));
    setActiveSavedTileId(1);
    setVariables([
      { id: 9, type: 'group', name: 'PLAYER', isOpen: true },
      { id: 1, name: 'PLAYER_HP', type: 'number', initialValue: 10, groupId: 9 },
      { id: 2, name: 'PLAYER_BONUS', type: 'number', initialValue: 0, groupId: 9 },
      { id: 3, name: 'PLAYER_KEYS', type: 'number', initialValue: 0, groupId: 9 },
      { id: 4, name: 'PLAYER_AMMO', type: 'number', initialValue: 100, groupId: 9 },
      { id: 5, name: 'PLAYER_MAX_AMMO', type: 'number', initialValue: 100, groupId: 9 },
      { id: 6, name: 'PLAYER_GRENADES', type: 'number', initialValue: 0, groupId: 9 },
      { id: 7, name: 'PLAYER_MAGNET', type: 'number', initialValue: 0, groupId: 9 },
      { id: 8, name: 'PLAYER_XP', type: 'number', initialValue: 0, groupId: 9 }
    ]);
    setAnimations([]);
    setCustomScripts([]);
    setGlobalScript({ nodes: [{ id: 'start', position: { x: 250, y: 100 }, data: { label: 'On Update' }, type: 'input' }], edges: [] });
    setMusicTracks([]);
    setGuides({ x: [], y: [] });
    setActors(newScene.actors);
    setActiveActorId(newScene.actors[0]?.id || null);
    setTriggers([]);
    setActiveTriggerId(null);
    setCollisions([]);
    setActiveCollisionId(null);
    setSelection(null);
    setClipboard(null);
    setShowNewProjectDialog(false);
    setLevelGenSceneId(newScene.id);
    setShowLevelGenDialog(true);
  };

const handleWizardCreate = () => {
    const { topdown, platformer, metroidvania, pointnclick, shmup, racing, beatemup, intro, pause, randomBg, globalPlayer, generateLevels } = wizardSettings;

    const sceneTypes = [
      ...(intro > 0 ? Array(intro).fill('INTRO') : []),
      ...Array(topdown).fill('TOPDOWN'),
      ...Array(platformer).fill('PLATFORMER'),
      ...Array(metroidvania).fill('METROIDVANIA'),
      ...Array(pointnclick).fill('POINTNCLICK'),
      ...Array(shmup).fill('SHMUP'),
      ...Array(racing).fill('RACING'),
      ...Array(beatemup || 0).fill('BEATEMUP'),
      ...(pause ? ['PAUSE'] : [])
    ];
    if (sceneTypes.length === 0) return;

    const newDims = { w: newProjectSettings.w, h: newProjectSettings.h };
    const newLayer = createEmptyLayer('Background', null, newDims.w, newDims.h);
    if (!newProjectSettings.transparentBg) {
      newLayer.data = newLayer.data.map(row => row.map(() => newProjectSettings.bgColor));
    }
    const newFrame = { id: 'frame-1', layers: [newLayer] };

    setDimensions(newDims);
    setFrames([newFrame]);
    setActiveFrameId(newFrame.id);
    setLayers([newLayer]);
    setActiveLayerId(newLayer.id);

    const makePlayerActor = (dims) => ({
      id: Date.now() + Math.random(),
      name: 'Player',
      type: 'player',
      x: Math.floor(dims.w / 2 / 8) * 8,
      y: Math.floor(dims.h / 2 / 8) * 8,
      width: 8,
      height: 8,
      color: '#65ff00',
      spriteId: 1,
      isHidden: false,
      hflip: true,
      attackAnimId: null,
      script: { nodes: [{ id: 'start', position: { x: 250, y: 100 }, data: { label: 'On Update' }, type: 'input' }], edges: [] }
    });

    const getSceneDimensions = (type) => {
      if (type === 'INTRO' || type === 'PAUSE') {
        return { w: 256, h: 256 };
      }
      if (type === 'PLATFORMER' || type === 'BEATEMUP') {
        return { w: 2048, h: 256 };
      }
      return { w: 256, h: 256 };
    };

    let introCount = 0;
    let sceneIndex = 0;

    const makeScene = (type, index) => {
      const sceneDims = getSceneDimensions(type);
      const layer = createEmptyLayer('Background', null, sceneDims.w, sceneDims.h);
      if (!newProjectSettings.transparentBg) {
        layer.data = layer.data.map(row => row.map(() => newProjectSettings.bgColor));
      }
      const frame = { id: `frame-${index + 1}-${Date.now()}`, layers: [layer] };
      const isIntroOrPause = type === 'INTRO' || type === 'PAUSE';

      let sceneName;
      if (type === 'INTRO') {
        introCount++;
        sceneName = introCount === 1 ? 'Intro' : `Intro ${introCount}`;
      } else if (type === 'PAUSE') {
        sceneName = 'Pause Screen';
      } else {
        sceneIndex++;
        sceneName = `Scene ${sceneIndex}`;
      }

      const playerActor = (globalPlayer || isIntroOrPause) ? null : makePlayerActor(sceneDims);

      const scene = {
        id: Date.now() + Math.random() + index,
        name: sceneName,
        type,
        frames: [frame],
        globalActorIds: [],
        globalActorPositions: {},
        actors: playerActor ? [playerActor] : [],
        triggers: [],
        collisions: [],
        musicId: null,
        dimensions: sceneDims,
        worldX: 0,
        worldY: 0,
        script: { nodes: [{ id: 'start', position: { x: 250, y: 100 }, data: { label: 'On Start' }, type: 'input' }], edges: [] }
      };

      return scene;
    };

    const newScenes = sceneTypes.map((type, i) => makeScene(type, i));

    const platformBgTypes = ['clouds', 'starry'];
    const shmupBgTypes = ['sky_clouds', 'clouds', 'starry'];
    const trackStyles = ['wavy', 'twisty', 'serpentine'];
    const pathDirections = ['both', 'ew', 'ns', 'random'];

    const getAutoGenConfig = (scene) => {
      const st = (scene.type || '').toUpperCase();
      if (st === 'PLATFORMER') {
        const bgType = randomBg ? platformBgTypes[Math.floor(Math.random() * platformBgTypes.length)] : 'clouds';
        return {
          platformBgType: bgType,
          platformSkyColor: bgType === 'starry' ? '#000000' : '#29adff',
          platformCloudColor1: '#fff1e8',
          platformCloudColor2: '#c2c3c7',
          platformStarColor: '#fff1e8',
          platformPlanets: bgType === 'starry' ? Math.random() > 0.5 : false,
          platformMaxPlanetSize: 4,
          maxGroundHeight: 2,
          platformCount: 3,
          deathPitCount: 1,
          generateCollisions: true
        };
      } else if (st === 'METROIDVANIA') {
        return {
          caveBgType: 'tile',
          caveBgTileId: 67,
          caveBgColor: '#000000',
          caveDensity: 0.4,
          caveTunnelWidth: 4,
          cavePlatformCount: 6,
          caveCrystalCount: 3,
          caveMushroomCount: 3,
          caveVineCount: 2,
          cavePillarCount: 3,
          caveStalactiteCount: 4,
          generateCollisions: true
        };
      } else if (st === 'SHMUP') {
        const bgType = randomBg ? shmupBgTypes[Math.floor(Math.random() * shmupBgTypes.length)] : 'sky_clouds';
        return {
          shmupBgType: bgType,
          shmupSkyColor: bgType === 'starry' ? '#000000' : '#29adff',
          shmupCloudColor1: '#fff1e8',
          shmupCloudColor2: '#c2c3c7',
          shmupStarColor: '#fff1e8',
          shmupNightSkyColor: '#000000',
          shmupPlanets: bgType === 'starry' ? Math.random() > 0.5 : false,
          shmupMaxPlanetSize: 4,
          shmupGround: false,
          shmupTopDown: false,
          mode7Layout: false,
          generateCollisions: true
        };
      } else if (st === 'TOPDOWN') {
        return {
          waterBodySize: 16,
          pathDirection: 'random',
          generateCollisions: true
        };
      } else if (st === 'POINTNCLICK') {
        return {
          borderColor: '#000000',
          bottomThickness: 2,
          generateCollisions: true
        };
      } else if (st === 'RACING') {
        return {
          obstacleCount: 5,
          trackWidth: 6,
          trackWaviness: 25,
          trackStyle: 'wavy',
          mode7Layout: false,
          trackGaps: false,
          showCountdown: true,
          generateCollisions: true,
          lapsToFinish: 3,
          useVarLaps: false,
          lapsVar: ''
        };
      } else if (st === 'BEATEMUP') {
        return {
          streetTileId: undefined,
          curbTileId: undefined,
          sidewalkTileId: undefined,
          brickTileId: undefined,
          brick2TileId: undefined,
          windowTileId: undefined,
          doorTileId: undefined,
          platformBgType: 'clouds',
          platformSkyColor: '#29adff',
          platformCloudColor1: '#fff1e8',
          platformCloudColor2: '#c2c3c7',
          platformStarColor: '#fff1e8',
          platformPlanets: false,
          platformMaxPlanetSize: 4,
          generateCollisions: true
        };
      } else if (st === 'INTRO' || st === 'PAUSE') {
        return null;
      }
      return null;
    };

    if (generateLevels) {
      newScenes.forEach(scene => {
        scene._autoGenConfig = getAutoGenConfig(scene);
      });
    } else if (randomBg) {
      newScenes.forEach(scene => {
        const st = (scene.type || '').toUpperCase();
        if (st === 'PLATFORMER' || st === 'METROIDVANIA' || st === 'SHMUP' || st === 'BEATEMUP') {
          scene._autoGenConfig = getAutoGenConfig(scene);
        }
      });
    }

    let globalPlayerActor = null;
    if (globalPlayer) {
      globalPlayerActor = makePlayerActor(newScenes[0].dimensions);
      newScenes.forEach(scene => {
        scene.globalActorIds = [globalPlayerActor.id];
        scene.globalActorPositions = { [globalPlayerActor.id]: { x: globalPlayerActor.x, y: globalPlayerActor.y } };
      });
    }

    setScenes(newScenes);
    setActiveSceneId(newScenes[0].id);

    if (globalPlayerActor) {
      setGlobalActors([globalPlayerActor]);
    }

    const firstIntroScene = newScenes.find(s => s.type === 'INTRO');
    if (firstIntroScene) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = 256;
        tempCanvas.height = 256;
        const ctx = tempCanvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, 256, 256);
        const imgData = ctx.getImageData(0, 0, 256, 256).data;

        const layerData = Array(256).fill(null).map((_, y) =>
          Array(256).fill(null).map((_, x) => {
            const i = (y * 256 + x) * 4;
            if (imgData[i + 3] > 128) {
              return '#' + ((1 << 24) + (imgData[i] << 16) + (imgData[i + 1] << 8) + imgData[i + 2]).toString(16).slice(1);
            }
            return null;
          })
        );

        setScenes(prevScenes => {
          const updatedScenes = prevScenes.map(s => {
            if (s.id === firstIntroScene.id) {
              const updatedLayer = { ...s.frames[0].layers[0], data: layerData };
              return {
                ...s,
                frames: [{ ...s.frames[0], layers: [updatedLayer] }]
              };
            }
            return s;
          });
          return updatedScenes;
        });

        if (firstIntroScene.id === activeSceneIdRef.current) {
          setLayers(prevLayers => {
            if (prevLayers.length > 0) {
              return [{ ...prevLayers[0], data: layerData }];
            }
            return prevLayers;
          });
        }
      };
      img.src = '/lp-gb.png';
    }

    const firstPauseScene = newScenes.find(s => s.type === 'PAUSE');
    if (firstPauseScene) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = 256;
        tempCanvas.height = 256;
        const ctx = tempCanvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, 256, 256);
        const imgData = ctx.getImageData(0, 0, 256, 256).data;

        const layerData = Array(256).fill(null).map((_, y) =>
          Array(256).fill(null).map((_, x) => {
            const i = (y * 256 + x) * 4;
            if (imgData[i + 3] > 128) {
              return '#' + ((1 << 24) + (imgData[i] << 16) + (imgData[i + 1] << 8) + imgData[i + 2]).toString(16).slice(1);
            }
            return null;
          })
        );

        setScenes(prevScenes => {
          const updatedScenes = prevScenes.map(s => {
            if (s.id === firstPauseScene.id) {
              const updatedLayer = { ...s.frames[0].layers[0], data: layerData };
              return {
                ...s,
                frames: [{ ...s.frames[0], layers: [updatedLayer] }]
              };
            }
            return s;
          });
          return updatedScenes;
        });

        if (firstPauseScene.id === activeSceneIdRef.current) {
          setLayers(prevLayers => {
            if (prevLayers.length > 0) {
              return [{ ...prevLayers[0], data: layerData }];
            }
            return prevLayers;
          });
        }
      };
      img.src = '/lp-pause-gb.png';
    }

    const firstScene = newScenes[0];
    setFrames(firstScene.frames);
    setActiveFrameId(firstScene.frames[0].id);
    setLayers(firstScene.frames[0].layers);
    const firstActiveLayerId = firstScene.frames[0].layers.find(l => l.type !== 'group')?.id || firstScene.frames[0].layers[0]?.id;
    setActiveLayerId(firstActiveLayerId);
    setActors(firstScene.actors);
    setActiveActorId(globalPlayer ? null : firstScene.actors[0]?.id || null);
    setTriggers(firstScene.triggers);
    setActiveTriggerId(null);
    setCollisions(firstScene.collisions);
    setActiveCollisionId(null);
    setSelection(null);
    setClipboard(null);

    if (containerRef.current) {
      const containerW = containerRef.current.clientWidth - 40;
      const containerH = containerRef.current.clientHeight - 40;
      if (containerW > 0 && containerH > 0) {
        const zW = containerW / newDims.w;
        const zH = containerH / newDims.h;
        const optimalZoom = Math.min(zW, zH);
        setZoom(Math.max(0.1, Math.min(50, optimalZoom >= 1 ? Math.floor(optimalZoom) : Math.floor(optimalZoom * 100) / 100)));
      } else {
        setZoom(15);
      }
      setPanOffset({ x: 0, y: 0 });
    }

    setHistory([{
      label: "New Project (Wizard)",
      layers: [newLayer],
      dimensions: newDims,
      timestamp: Date.now()
    }]);
    setHistoryIndex(0);

    setSavedTiles(JSON.parse(JSON.stringify(INITIAL_DEFAULT_TILES)));
    setActiveSavedTileId(1);
    setVariables([
      { id: 9, type: 'group', name: 'PLAYER', isOpen: true },
      { id: 1, name: 'PLAYER_HP', type: 'number', initialValue: 10, groupId: 9 },
      { id: 2, name: 'PLAYER_BONUS', type: 'number', initialValue: 0, groupId: 9 },
      { id: 3, name: 'PLAYER_KEYS', type: 'number', initialValue: 0, groupId: 9 },
      { id: 4, name: 'PLAYER_AMMO', type: 'number', initialValue: 100, groupId: 9 },
      { id: 5, name: 'PLAYER_MAX_AMMO', type: 'number', initialValue: 100, groupId: 9 },
      { id: 6, name: 'PLAYER_GRENADES', type: 'number', initialValue: 0, groupId: 9 },
      { id: 7, name: 'PLAYER_MAGNET', type: 'number', initialValue: 0, groupId: 9 },
      { id: 8, name: 'PLAYER_XP', type: 'number', initialValue: 0, groupId: 9 }
    ]);
    setAnimations([]);
    setCustomScripts([]);
    setGlobalScript({ nodes: [{ id: 'start', position: { x: 250, y: 100 }, data: { label: 'On Update' }, type: 'input' }], edges: [] });
    setMusicTracks([]);
    setGuides({ x: [], y: [] });

    setShowNewProjectDialog(false);
    setShowWizardDialog(false);

    const scenesToAutoGen = newScenes.filter(s => s._autoGenConfig);
    const scenesWithoutAutoGen = newScenes.filter(s => !s._autoGenConfig);
    const allScenesGenerated = generateLevels && scenesToAutoGen.length === newScenes.length;

    setTimeout(() => {
      scenesToAutoGen.forEach(scene => {
        const config = scene._autoGenConfig;
        delete scene._autoGenConfig;
        generateLevelForScene(scene.id, config);
      });
      newScenes.forEach(s => { delete s._autoGenConfig; });
    }, 100);
  };

  const renderText = useCallback(async (settings, targetLayerId = null) => {
    const { text, x: startX, y: startY, size: fontSize, font: fontFamily, customFont, bold, italic, align } = settings;
    if (!text) return;

    let activeFont = fontFamily;
    if (fontFamily === 'custom' && customFont) {
      activeFont = `'${customFont}', sans-serif`;
    }

    const fontStyle = `${italic ? 'italic ' : ''}${bold ? 'bold ' : ''}${fontSize}px ${activeFont}`;
    try { await document.fonts.load(fontStyle); } catch { // Ignore font loading error
    }

    const newLayerData = Array(dimensions.h).fill(null).map(() => Array(dimensions.w).fill(null));
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });

    tempCtx.font = fontStyle;
    const metrics = tempCtx.measureText(text);
    const textW = Math.ceil(metrics.width);
    const textH = fontSize + Math.ceil(fontSize * 0.4);

    tempCanvas.width = Math.max(1, textW);
    tempCanvas.height = Math.max(1, textH);
    tempCtx.font = fontStyle;
    tempCtx.textBaseline = 'top';
    tempCtx.textAlign = 'left';
    tempCtx.fillStyle = currentColor;
    tempCtx.fillText(text, 0, 0);

    const imgData = tempCtx.getImageData(0, 0, textW, textH).data;

    let offsetX = 0;
    if (align === 'center') offsetX = -Math.floor(textW / 2);
    else if (align === 'right') offsetX = -textW;

    const textPixels = [];

    for (let ty = 0; ty < tempCanvas.height; ty++) {
      for (let tx = 0; tx < tempCanvas.width; tx++) {
        const alpha = imgData[(ty * tempCanvas.width + tx) * 4 + 3];
        const targetX = startX + tx + offsetX;
        const targetY = startY + ty;
        if (alpha > 128 && targetX >= 0 && targetX < dimensions.w && targetY >= 0 && targetY < dimensions.h) {
          newLayerData[targetY][targetX] = currentColor;
          textPixels.push({ x: targetX, y: targetY });
        }
      }
    }

    if (settings.outline) {
      const outColor = settings.outlineColor || '#000000';
      const edgePixels = [];
      const neighbors = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];

      textPixels.forEach(p => {
        neighbors.forEach(([dx, dy]) => {
          const nx = p.x + dx;
          const ny = p.y + dy;
          if (nx >= 0 && nx < dimensions.w && ny >= 0 && ny < dimensions.h && newLayerData[ny][nx] === null) {
            edgePixels.push({ x: nx, y: ny });
          }
        });
      });

      edgePixels.forEach(p => {
        newLayerData[p.y][p.x] = outColor;
      });
    }

    const finalSettings = { ...settings, color: currentColor };

    if (targetLayerId) {
      const nextLayers = layers.map(l => l.id === targetLayerId ? { ...l, data: newLayerData, textData: finalSettings, name: `Text: ${text.substring(0, 12)}` } : l);
      setLayers(nextLayers);
      saveHistory("Update Text", nextLayers);
    } else {
      const newLayer = { id: Date.now() + Math.random(), type: 'layer', name: `Text: ${text.substring(0, 12)}`, visible: true, groupId: null, data: newLayerData, textData: finalSettings };
      const nextLayers = [newLayer, ...layers];
      setLayers(nextLayers);
      setActiveLayerId(newLayer.id);
      saveHistory("Add Text", nextLayers);
    }
  }, [dimensions, currentColor, layers, saveHistory]);

  const editLayerText = (layer) => {
    if (!layer.textData) return;
    setTextSettings(layer.textData);
    setCurrentColor(layer.textData.color);
    setEditingTextLayerId(layer.id);
    setActiveLayerId(layer.id);
    setTool('text');
  };

  const value = {
    warnings,
    dismissedWarnings, setDismissedWarnings,
    hideWarningBadge, setHideWarningBadge,
    showNewProjectOnStartup, setShowNewProjectOnStartup,
    showNewProjectDialog, setShowNewProjectDialog,
    showVideoPlayerDialog, setShowVideoPlayerDialog,
    videoPlayerSource, setVideoPlayerSource,
    newProjectSettings, setNewProjectSettings,
    dimensions, setDimensions,
    maintainAspectRatio, setMaintainAspectRatio,
    sizeInput, setSizeInput,
    zoom, setZoom,
    showGbaMask, setShowGbaMask,
    isPixelated, setIsPixelated,
    activeDraw, setActiveDraw,
    showDrawMenu, setShowDrawMenu,
    activeGameTool, setActiveGameTool,
    showGameMenu, setShowGameMenu,
    tool, setTool,
    brushType, setBrushType,
    colorJitter, setColorJitter,
    brushOpacity, setBrushOpacity,
    currentColor, setCurrentColor,
    secondaryColor, setSecondaryColor,
    recentColors, setRecentColors,
    isDrawing, setIsDrawing,
    drawWidth, setDrawWidth,
    panOffset, setPanOffset,
    isPanning, setIsPanning,
    selection, setSelection,
    selectionStart, setSelectionStart,
    moveOffset, setMoveOffset,
    gridSize, setGridSize,
    showGridMenu, setShowGridMenu,
    clipboard, setClipboard,
    transformData, setTransformData,
    isResizing, setIsResizing,
    showAboutDialog, setShowAboutDialog,
    textSettings, setTextSettings,
    cursorPos, setCursorPos,
    showFileMenu, setShowFileMenu,
    showImageMenu, setShowImageMenu,
    activeShape, setActiveShape,
    showShapesMenu, setShowShapesMenu,
    activeFill, setActiveFill,
    showFillsMenu, setShowFillsMenu,
    lassoPath, setLassoPath,
    activeSelection, setActiveSelection,
    showSelectionsMenu, setShowSelectionsMenu,
    activeModifySelection, setActiveModifySelection,
    showModifySelectionMenu, setShowModifySelectionMenu,
    symmetryMode, setSymmetryMode,
    showSymmetryMenu, setShowSymmetryMenu,
    isShiftPressed, setIsShiftPressed,
    viewportSize, setViewportSize,
    isNavDragging, setIsNavDragging,
    guides, setGuides,
    draggingGuide, setDraggingGuide,
    savedTiles, setSavedTiles,
    activeSavedTileId, setActiveSavedTileId,
    showTileImportPaletteDialog, setShowTileImportPaletteDialog,
    pendingTileImportData, setPendingTileImportData,
    executeTileImport,
    importTilesDirectly,
    scenes, setScenes, activeSceneId, switchScene, addScene, deleteScene, renameScene, duplicateScene, generateLevelForScene,
    addSceneGroup, toggleSceneGroup, deleteSceneGroup, duplicateSceneGroup, renameSceneGroup,
    frames, setFrames,
    activeFrameId, setActiveFrameId,
    switchFrame, addFrame, duplicateFrame, deleteFrame,
    onionSkinEnabled, setOnionSkinEnabled,
    musicTracks, setMusicTracks,
    editingMusicTrackId, setEditingMusicTrackId,
    variables, setVariables,
    actors, setActors,
    globalActors, setGlobalActors,
    toggleGlobalActorInScene,
    setGlobalActorPosition,
    activeActorId, setActiveActorId,
    triggers, setTriggers,
    activeTriggerId, setActiveTriggerId,
    editingScriptTriggerId, setEditingScriptTriggerId,
    tempPaintedTriggers, setTempPaintedTriggers,
    isPaintingTriggers, setIsPaintingTriggers,
    collisions, setCollisions,
    activeCollisionId, setActiveCollisionId,
    tempPaintedCollisions, setTempPaintedCollisions,
    isPaintingCollisions, setIsPaintingCollisions,
    animations, setAnimations,
    customScripts, setCustomScripts,
    editingCustomScriptId, setEditingCustomScriptId,
    globalScript, setGlobalScript,
    editingGlobalScript, setEditingGlobalScript,
    editingScriptActorId, setEditingScriptActorId,
    editingScriptSceneId, setEditingScriptSceneId,
    layers, setLayers,
    activeLayerId, setActiveLayerId,
    editingLayerId, setEditingLayerId,
    viewActiveOnly, setViewActiveOnly,
    editingTextLayerId, setEditingTextLayerId,
    draggedLayerId, setDraggedLayerId,
    dragOverLayerId, setDragOverLayerId,
    dragPosition, setDragPosition,
    history, setHistory,
    historyIndex, setHistoryIndex,
    fxLayerId, setFxLayerId,
    activeLayer,

    // Refs
    panStart,
    navigatorRef,
    rulerXRef,
    rulerYRef,
    canvasRef,
    selectionRef,
    containerRef,
    projectInputRef,
    imageInputRef,
    importLayerInputRef,
    tileSheetInputRef,
    isDrawingRef,

    // Layout dimensions / helpers
    MAX_NAV_W, MAX_NAV_H, navScale, canvasDisplayW, canvasDisplayH, viewX, viewY, navBox,

    // Functions
    handleResizeImage,
    updateLayerProp,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    applyMaskToLayer,
    updatePanFromNav,
    getShapePixels,
    getGradientPixels,
    getSymmetricPixels,
    getBrushPixels,
    saveHistory,
    showAdjustSelectionDialog, setShowAdjustSelectionDialog,
    adjustSelectionAmount, setAdjustSelectionAmount,
    originalSelection, setOriginalSelection,
    openAdjustSelectionDialog, closeAdjustSelectionDialog, updateAdjustedSelection,
    showHSLDialog, setShowHSLDialog,
    hslSettings, setHslSettings,
    hslOriginalData, setHslOriginalData,
    openHSLDialog, closeHSLDialog,
    showBCDialog, setShowBCDialog,
    bcSettings, setBcSettings,
    bcOriginalData, setBcOriginalData,
    openBCDialog, closeBCDialog,
    invertColors,
    showMagicBgDialog, setShowMagicBgDialog,
    magicBgSettings, setMagicBgSettings,
    magicBgOriginalData, setMagicBgOriginalData,
    showMapOverviewDialog, setShowMapOverviewDialog,
    showLevelGenDialog, setShowLevelGenDialog,
    levelGenSceneId, setLevelGenSceneId,
    isMusicEditorOpen, setIsMusicEditorOpen,
    showResizeCanvasDialog, setShowResizeCanvasDialog,
    resizeCanvasSettings, setResizeCanvasSettings,
    openResizeCanvasDialog, handleResizeCanvas,
    openMagicBgDialog, closeMagicBgDialog,
    renderLayersToCtx,
    getSnappedPos,
    handleInput,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    commitMove,
    commitMoveLayer,
    startTransform,
    applyTransform,
    handleWheel,
    invertSelection,
    deleteSelection,
    handleCopy,
    handlePaste,
    duplicateSelectionAsLayer,
    jumpToHistory,
    undo,
    redo,
    saveSelectionAsTile,
    fillSelectionWithCollision,
    handleTileSheetUpload,
    cropSelection,
    outlineSelection,
    addLayer,
    addGroup,
    moveLayerUp,
    moveLayerDown,
    mergeLayerDown,
    duplicateLayer,
    flattenLayers,
    renameLayer,
    handleRenameComplete,
    exportProjectJSON,
    loadProjectData,
    handleProjectUpload,
    handleImageUpload,
    handleImportToLayer,
    importFileAsLayer,
    paletteInputRef,
    showImportPaletteDialog, setShowImportPaletteDialog,
    pendingImportColors, setPendingImportColors,
    paletteImportFileName, setPaletteImportFileName,
    handlePaletteUpload,
    confirmPaletteImport,
    showPaletteConvertDialog, setShowPaletteConvertDialog,
    pendingConvertData, setPendingConvertData,
    confirmPaletteConvert,
    exportLayerAsPNG,
    exportPNG,
    exportAllLayersZipped,
    handleCreateNewProject,
    showWizardDialog, setShowWizardDialog,
    wizardSettings, setWizardSettings,
    handleWizardCreate,
    renderText,
    editLayerText,
    showExportDialog, setShowExportDialog,
    exportLevelName, setExportLevelName,
    exportLevelType, setExportLevelType,
    exportFormat, setExportFormat,
    exportGameAssets,
    validateScenesLayers,
    showEmulatorDialog, setShowEmulatorDialog,
    isPublishingRom,
    isBusy, setIsBusy,
    publishRom,
    showHtml5ExportDialog, setShowHtml5ExportDialog,
    html5BgColor, setHtml5BgColor,
    html5ContainerColor, setHtml5ContainerColor,
    exportHtml5,
    exportExe,
    generateWav,
    getNextZoom,
    includedArtists,
    includeCreditsScene, setIncludeCreditsScene,
    creditsText, setCreditsText,
    creditsBgColor, setCreditsBgColor, creditsTextColor, setCreditsTextColor,
    creditsMusicId, setCreditsMusicId,
    creditsEffect, setCreditsEffect,
    addOgaArtist, addModArchiveArtist,
    activeCol1Panel, setActiveCol1Panel,
    activeCol2Panel, setActiveCol2Panel,
    activeCol3Panel, setActiveCol3Panel,
    showWelcomeTour, setShowWelcomeTour,
    hudSettings, setHudSettings
  };

  return (
    <PxShopContext.Provider value={value}>
      {children}
    </PxShopContext.Provider>
  );
};

// End of PxShopContext - Refreshed
