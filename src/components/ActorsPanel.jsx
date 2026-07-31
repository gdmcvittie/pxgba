import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { usePxShop, INITIAL_DEFAULT_TILES } from '../context/PxShopContext';
import { BsPlus, BsTrash, BsChevronDown, BsChevronRight, BsCopy, BsPencil, BsSymmetryVertical, BsSymmetryHorizontal, BsFolder2Open, BsFiles, BsLayers, BsEye, BsEyeSlash, BsBoundingBox } from 'react-icons/bs';
import { ImMan } from 'react-icons/im';
import TileIcon from './TileIcon';
import PaletteColorPicker from './PaletteColorPicker';
import { TbArrowsLeftRight, TbArrowsUpDown} from 'react-icons/tb';
import { TileSelector } from './Dialogs';
import { getGroupBrushInfo as getGroupBrushInfoUtil } from '../context/utils';

const COLLISION_OPTIONS = [
  { value: 'solid', label: 'Solid' },
  { value: 'none', label: 'None' },
  { value: 'top', label: 'Top' },
  { value: 'bottom', label: 'Bottom' },
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
  { value: 'ladder', label: 'Ladder' },
  { value: 'slope-up', label: 'Slope Up' },
  { value: 'slope-down', label: 'Slope Down' }
];
const ACTOR_DEFAULT_TILE_MAP = {
  player: 1,
  npc: 2,
  platform: 3,
  ladder: 4,
  bonus: 5,
  spring: 6,
  hazard: 7,
  enemy: 8,
  destructible: 9,
  key: 10,
  door: 11,
  powerup: 12,
  sign: 13,
  conveyor: 14,
  checkpoint: 58,
  turret: 31,
  spawner: 32,
  pushable: 20,
  companion: 33,
  pressure_plate: 34,
  push_target: 35,
  teleporter: 36,
  crumbling_platform: 37,
  ice_block: 38,
  chest: 39,
  torch: 40,
  save_point: 42,
  xp_orb: 43,
  shield: 44,
  ammo_pickup: 45,
  grenade: 46,
  wall_jump_surface: 48,
  one_way_wall: 49,
  magnet: 50,
  gravity_flip_zone: 51,
  boost_pad: 56,
  checkpoint_gate: 57,
  grass_block: 59,
  health_pickup: 21,
  pass_wall: 15
};

const ACTOR_TYPE_TO_GROUP = {
  key: 'Pickups', bonus: 'Pickups', powerup: 'Pickups', ammo_pickup: 'Pickups',
  xp_orb: 'Pickups', shield: 'Pickups', grenade: 'Pickups', magnet: 'Pickups',
  health_pickup: 'Pickups',
  enemy: 'Enemies', turret: 'Enemies',
  hazard: 'Hazards',
  platform: 'Platforms', ladder: 'Platforms', crumbling_platform: 'Platforms', pass_wall: 'Platforms',
  npc: 'NPCs', companion: 'NPCs',
};

const ActorDesignerModal = ({ actor, savedTiles, setSavedTiles, saveHistory, layers, dimensions, animations, onClose, onSave }) => {
  const [designerW, setDesignerW] = useState(actor.width || 8);
  const [designerH, setDesignerH] = useState(actor.height || 8);

  const cols = Math.max(1, Math.floor(designerW / 8));
  const rows = Math.max(1, Math.floor(designerH / 8));

  const cloneAnim = (anim) => {
    if (!anim) return null;
    return {
      ...anim,
      frames: anim.frames.map(f => Array.isArray(f) ? [...f] : (f ? [f] : []))
    };
  };

  const initialLayers = useMemo(() => {
    if (actor.designerLayers && Array.isArray(actor.designerLayers) && actor.designerLayers.length > 0) {
      return actor.designerLayers.map(l => ({ ...l }));
    }
    return [{ id: 'layer1', name: 'Layer 1', visible: true }];
  }, [actor.designerLayers]);

  const [layersMetadata, setLayersMetadata] = useState(initialLayers);
  const [activeLayerId, setActiveLayerId] = useState(() => initialLayers[0]?.id || 'layer1');
  const [useGroupStamp, setUseGroupStamp] = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState(null);

  const getGroupBrushInfo = useCallback((tileId) => {
    return getGroupBrushInfoUtil(tileId, savedTiles);
  }, [savedTiles]);

  const flattenFrame = useCallback((fl, layersList) => {
    const flat = Array(cols * rows).fill(null);
    for (let i = 0; i < cols * rows; i++) {
      for (const layer of layersList) {
        if (layer.visible && fl[layer.id] && fl[layer.id][i]) {
          flat[i] = fl[layer.id][i];
          break;
        }
      }
    }
    return flat;
  }, [cols, rows]);

  const flattenAnim = useCallback((anim, layersList) => {
    if (!anim) return null;
    return {
      ...anim,
      frames: anim.framesLayers.map(fl => flattenFrame(fl, layersList))
    };
  }, [flattenFrame]);

  const initAnim = useCallback((anim) => {
    if (!anim) return null;
    const cloned = cloneAnim(anim);
    let framesLayers = anim.framesLayers;
    
    if (!framesLayers || !Array.isArray(framesLayers) || framesLayers.length !== cloned.frames.length) {
      framesLayers = cloned.frames.map(f => {
        const fl = {};
        initialLayers.forEach(layer => {
          fl[layer.id] = layer.id === initialLayers[0].id 
            ? (Array.isArray(f) ? [...f] : Array(cols * rows).fill(null))
            : Array(cols * rows).fill(null);
        });
        return fl;
      });
    } else {
      framesLayers = framesLayers.map(fl => {
        const nextFL = {};
        initialLayers.forEach(layer => {
          if (Array.isArray(fl[layer.id])) {
            nextFL[layer.id] = [...fl[layer.id]];
          } else {
            nextFL[layer.id] = Array(cols * rows).fill(null);
          }
        });
        return nextFL;
      });
    }
    
    return {
      ...cloned,
      framesLayers
    };
  }, [initialLayers, cols, rows]);

  const [idleAnim, setIdleAnim] = useState(() => {
    const original = animations.find(a => a.id === actor.idleAnimId);
    if (original) return initAnim(original);

    // Create a new default idle animation using the actor's current base sprite/layout
    const defaultFrame = Array(cols * rows).fill(null);
    if (actor.spriteIds) {
      for (let i = 0; i < Math.min(defaultFrame.length, actor.spriteIds.length); i++) {
        const item = actor.spriteIds[i];
        if (item) {
          defaultFrame[i] = typeof item === 'object' 
            ? { ...item } 
            : { id: item, flipH: false, flipV: false };
        }
      }
    } else if (actor.spriteId) {
      defaultFrame.fill({ id: actor.spriteId, flipH: false, flipV: false });
    }
    const defaultAnim = {
      id: Date.now() + Math.random(),
      name: `${actor.name} Idle`,
      frames: [defaultFrame],
      fps: 8
    };
    return initAnim(defaultAnim);
  });
  const [walkAnim, setWalkAnim] = useState(() => initAnim(animations.find(a => a.id === actor.walkAnimId)));
  const [attackAnim, setAttackAnim] = useState(() => initAnim(animations.find(a => a.id === actor.attackAnimId)));
  const [jumpAnim, setJumpAnim] = useState(() => initAnim(animations.find(a => a.id === actor.jumpAnimId)));
  const [customAnims, setCustomAnims] = useState(() => (actor.customAnimIds || []).map(id => initAnim(animations.find(a => a.id === id))).filter(Boolean));

  const [activeTab, setActiveTab] = useState('idle');
  const [activeFrameIdx, setActiveFrameIdx] = useState(0);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [previewFrameIdx, setPreviewFrameIdx] = useState(0);
  const [hflip, setHflip] = useState(() => actor.hflip !== false);
  const [vflip, setVflip] = useState(() => !!actor.vflip);

  const [colX, setColX] = useState(() => actor.collisionX !== undefined ? actor.collisionX : 0);
  const [colY, setColY] = useState(() => actor.collisionY !== undefined ? actor.collisionY : 0);
  const [colW, setColW] = useState(() => actor.collisionW !== undefined ? actor.collisionW : (actor.width || 8));
  const [colH, setColH] = useState(() => actor.collisionH !== undefined ? actor.collisionH : (actor.height || 8));
  const [colType, setColType] = useState(() => actor.collisionType || 'solid');
  const [showCollisionMenu, setShowCollisionMenu] = useState(false);

  const getCurrentAnim = useCallback(() => {
    if (activeTab === 'idle') return idleAnim;
    if (activeTab === 'walk') return walkAnim;
    if (activeTab === 'attack') return attackAnim;
    if (activeTab === 'jump') return jumpAnim;
    return customAnims.find(a => a.id === activeTab) || null;
  }, [activeTab, idleAnim, walkAnim, attackAnim, jumpAnim, customAnims]);

  const autoFitCollisionBox = useCallback(() => {
    let minX = designerW;
    let maxX = -1;
    let minY = designerH;
    let maxY = -1;
    let hasPixels = false;

    const firstFrame = idleAnim && idleAnim.frames ? idleAnim.frames[0] : null;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const payload = firstFrame ? firstFrame[r * cols + c] : null;
        if (payload) {
          const actualId = typeof payload === 'object' ? payload.id : payload;
          const flipH = typeof payload === 'object' ? payload.flipH : false;
          const flipV = typeof payload === 'object' ? payload.flipV : false;
          const tile = savedTiles.find(t => String(t.id) === String(actualId));
          if (tile && tile.data) {
            for (let py = 0; py < 8; py++) {
              for (let px = 0; px < 8; px++) {
                const srcY = flipV ? 7 - py : py;
                const srcX = flipH ? 7 - px : px;
                if (tile.data[srcY] && tile.data[srcY][srcX] !== null && tile.data[srcY][srcX] !== undefined) {
                  const absX = c * 8 + px;
                  const absY = r * 8 + py;
                  if (absX < minX) minX = absX;
                  if (absX > maxX) maxX = absX;
                  if (absY < minY) minY = absY;
                  if (absY > maxY) maxY = absY;
                  hasPixels = true;
                }
              }
            }
          }
        }
      }
    }

    if (hasPixels) {
      setColX(minX);
      setColY(minY);
      setColW(maxX - minX + 1);
      setColH(maxY - minY + 1);
    } else {
      setColX(0);
      setColY(0);
      setColW(designerW);
      setColH(designerH);
    }
  }, [designerW, designerH, cols, rows, idleAnim, savedTiles]);

  useEffect(() => {
    if (!isPlayingPreview) return;
    const anim = getCurrentAnim();
    if (!anim || !anim.frames || anim.frames.length <= 1) {
      setTimeout(() => setIsPlayingPreview(false), 0);
      return;
    }

    const intervalTime = 1000 / (anim.fps || 8);
    const interval = setInterval(() => {
      setPreviewFrameIdx(prev => (prev + 1) % anim.frames.length);
    }, intervalTime);

    return () => clearInterval(interval);
  }, [isPlayingPreview, getCurrentAnim]);

  useEffect(() => {
    if (actor.collisionX === undefined || actor.collisionY === undefined || actor.collisionW === undefined || actor.collisionH === undefined) {
      setTimeout(() => autoFitCollisionBox(), 0);
    }
  }, [actor, autoFitCollisionBox]);

  const getCurrentSpriteIds = () => {
    const anim = getCurrentAnim();
    if (anim && anim.frames[activeFrameIdx]) return anim.frames[activeFrameIdx];
    return Array(cols * rows).fill(null);
  };

  const setCurrentSpriteIds = (next) => {
    if (activeTab === 'idle') {
      setIdleAnim(prev => {
        const nextFrames = [...prev.frames];
        nextFrames[activeFrameIdx] = next;
        return { ...prev, frames: nextFrames };
      });
    } else if (activeTab === 'walk') {
      setWalkAnim(prev => {
        const nextFrames = [...prev.frames];
        nextFrames[activeFrameIdx] = next;
        return { ...prev, frames: nextFrames };
      });
    } else if (activeTab === 'attack') {
      setAttackAnim(prev => {
        const nextFrames = [...prev.frames];
        nextFrames[activeFrameIdx] = next;
        return { ...prev, frames: nextFrames };
      });
    } else if (activeTab === 'jump') {
      setJumpAnim(prev => {
        const nextFrames = [...prev.frames];
        nextFrames[activeFrameIdx] = next;
        return { ...prev, frames: nextFrames };
      });
    } else {
      setCustomAnims(prev => prev.map(a => {
        if (a.id === activeTab) {
          const nextFrames = [...a.frames];
          nextFrames[activeFrameIdx] = next;
          return { ...a, frames: nextFrames };
        }
        return a;
      }));
    }
  };

  const selectTab = (tabId) => {
    setIsPlayingPreview(false);
    setActiveTab(tabId);
    setActiveFrameIdx(0);
  };

  const handleResize = (newW, newH) => {
    const newCols = Math.max(1, Math.floor(newW / 8));
    const newRows = Math.max(1, Math.floor(newH / 8));
    const oldCols = Math.max(1, Math.floor(designerW / 8));
    const oldRows = Math.max(1, Math.floor(designerH / 8));

    setDesignerW(newW);
    setDesignerH(newH);

    const resizeFrame = (prevFrame) => {
      if (!Array.isArray(prevFrame)) return Array(newCols * newRows).fill(null);
      const nextFrame = Array(newCols * newRows).fill(null);
      for (let r = 0; r < Math.min(oldRows, newRows); r++) {
        for (let c = 0; c < Math.min(oldCols, newCols); c++) {
          nextFrame[r * newCols + c] = prevFrame[r * oldCols + c];
        }
      }
      return nextFrame;
    };

    const resizeLayers = (fl) => {
      const nextFL = {};
      for (const key in fl) {
        nextFL[key] = resizeFrame(fl[key]);
      }
      return nextFL;
    };

    const resizeAnim = (anim) => {
      if (!anim) return null;
      const nextFramesLayers = anim.framesLayers.map(resizeLayers);
      return {
        ...anim,
        framesLayers: nextFramesLayers,
        frames: nextFramesLayers.map(fl => flattenFrame(fl, layersMetadata))
      };
    };

    if (idleAnim) setIdleAnim(resizeAnim);
    if (walkAnim) setWalkAnim(resizeAnim);
    if (attackAnim) setAttackAnim(resizeAnim);
    if (jumpAnim) setJumpAnim(resizeAnim);
    setCustomAnims(prev => prev.map(resizeAnim).filter(Boolean));
  };

  const [activeTileId, setActiveTileId] = useState(() => {
    if (actor.spriteIds && actor.spriteIds.length > 0) {
      const first = actor.spriteIds[0];
      if (first) {
        const id = typeof first === 'object' ? first.id : first;
        if (id !== null && id !== undefined) return id;
      }
    }
    if (actor.spriteId !== null && actor.spriteId !== undefined) {
      return actor.spriteId;
    }
    const defaultTileId = ACTOR_DEFAULT_TILE_MAP[actor.type];
    if (defaultTileId !== undefined && defaultTileId !== null) {
      return defaultTileId;
    }
    return savedTiles.length > 0 ? savedTiles[0].id : null;
  });
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushFlipH, setBrushFlipH] = useState(false);
  const [brushFlipV, setBrushFlipV] = useState(false);

  const uniqueColorsInActor = useMemo(() => {
    const usedTileIds = new Set();
    const collectTileIds = (anim) => {
      if (!anim || !anim.frames) return;
      anim.frames.forEach(frame => {
        if (Array.isArray(frame)) {
          frame.forEach(t => {
            if (t) {
              const id = typeof t === 'object' ? t.id : t;
              if (id !== null && id !== undefined) {
                usedTileIds.add(String(id));
              }
            }
          });
        }
      });
    };
    
    collectTileIds(idleAnim);
    collectTileIds(walkAnim);
    collectTileIds(attackAnim);
    collectTileIds(jumpAnim);
    customAnims.forEach(collectTileIds);

    if (activeTileId !== null && activeTileId !== undefined) {
      usedTileIds.add(String(activeTileId));
    }

    const colors = new Set();
    usedTileIds.forEach(id => {
      const tile = savedTiles.find(t => String(t.id) === id);
      if (tile && tile.data) {
        tile.data.forEach(row => {
          row.forEach(color => {
            if (color) {
              colors.add(color);
            }
          });
        });
      }
    });
    return Array.from(colors);
  }, [idleAnim, walkAnim, attackAnim, customAnims, savedTiles, activeTileId]);

  const suggestedBgColor = useMemo(() => {
    const usedTileIds = new Set();
    const collectTileIds = (anim) => {
      if (!anim || !anim.frames) return;
      anim.frames.forEach(frame => {
        if (Array.isArray(frame)) {
          frame.forEach(t => {
            if (t) {
              const id = typeof t === 'object' ? t.id : t;
              if (id !== null && id !== undefined) {
                usedTileIds.add(String(id));
              }
            }
          });
        }
      });
    };
    
    collectTileIds(idleAnim);
    collectTileIds(walkAnim);
    collectTileIds(attackAnim);
    collectTileIds(jumpAnim);
    customAnims.forEach(collectTileIds);

    if (activeTileId !== null && activeTileId !== undefined) {
      usedTileIds.add(String(activeTileId));
    }

    const cornerColorCounts = {};
    usedTileIds.forEach(id => {
      const tile = savedTiles.find(t => String(t.id) === id);
      if (tile && tile.data) {
        const corners = [
          tile.data[0]?.[0],
          tile.data[0]?.[7],
          tile.data[7]?.[0],
          tile.data[7]?.[7]
        ];
        corners.forEach(color => {
          if (color) {
            cornerColorCounts[color] = (cornerColorCounts[color] || 0) + 1;
          }
        });
      }
    });

    let bestColor = null;
    let maxCount = 0;
    for (const color in cornerColorCounts) {
      if (cornerColorCounts[color] > maxCount) {
        maxCount = cornerColorCounts[color];
        bestColor = color;
      }
    }
    return bestColor;
  }, [idleAnim, walkAnim, attackAnim, customAnims, savedTiles, activeTileId]);

  const handleRemoveColor = (colorToRemove) => {
    const usedTileIds = new Set();
    const collectTileIds = (anim) => {
      if (!anim || !anim.frames) return;
      anim.frames.forEach(frame => {
        if (Array.isArray(frame)) {
          frame.forEach(t => {
            if (t) {
              const id = typeof t === 'object' ? t.id : t;
              if (id !== null && id !== undefined) {
                usedTileIds.add(String(id));
              }
            }
          });
        }
      });
    };
    
    collectTileIds(idleAnim);
    collectTileIds(walkAnim);
    collectTileIds(attackAnim);
    collectTileIds(jumpAnim);
    customAnims.forEach(collectTileIds);

    if (activeTileId !== null && activeTileId !== undefined) {
      usedTileIds.add(String(activeTileId));
    }
    
    if (usedTileIds.size === 0) return;
    
    const nextTiles = savedTiles.map(tile => {
      if (usedTileIds.has(String(tile.id))) {
        if (!tile.data) return tile;
        const nextData = tile.data.map(row => 
          row.map(color => color === colorToRemove ? null : color)
        );
        return { ...tile, data: nextData };
      }
      return tile;
    });
    
    setSavedTiles(nextTiles);
    if (saveHistory) {
      saveHistory("Remove Tile Background Color", layers, dimensions, { savedTiles: nextTiles });
    }
  };

  const applyTile = (idx) => {
    setIsPlayingPreview(false);
    
    const clickedRow = Math.floor(idx / cols);
    const clickedCol = idx % cols;

    const updateFrameLayer = (prev) => {
      if (!prev) return null;
      
      const nextFramesLayers = [...prev.framesLayers];
      const nextFrameLayersData = { ...nextFramesLayers[activeFrameIdx] };
      const nextLayerTiles = [...(nextFrameLayersData[activeLayerId] || Array(cols * rows).fill(null))];
      
      const info = useGroupStamp ? getGroupBrushInfo(activeTileId) : null;
      if (info) {
        for (let r = 0; r < info.rows; r++) {
          for (let c = 0; c < info.cols; c++) {
            const targetRow = clickedRow + r;
            const targetCol = clickedCol + c;
            if (targetRow < rows && targetCol < cols) {
              const targetIdx = targetRow * cols + targetCol;
              const brushTile = info.tiles[r * info.cols + c];
              nextLayerTiles[targetIdx] = brushTile ? { id: brushTile.id, flipH: brushFlipH, flipV: brushFlipV } : null;
            }
          }
        }
      } else {
        if (activeTileId === null) {
          nextLayerTiles[idx] = null;
        } else {
          nextLayerTiles[idx] = { id: activeTileId, flipH: brushFlipH, flipV: brushFlipV };
        }
      }
      
      nextFrameLayersData[activeLayerId] = nextLayerTiles;
      nextFramesLayers[activeFrameIdx] = nextFrameLayersData;
      
      const nextFrames = [...prev.frames];
      nextFrames[activeFrameIdx] = flattenFrame(nextFrameLayersData, layersMetadata);
      
      return {
        ...prev,
        frames: nextFrames,
        framesLayers: nextFramesLayers
      };
    };

    if (activeTab === 'idle') setIdleAnim(updateFrameLayer);
    else if (activeTab === 'walk') setWalkAnim(updateFrameLayer);
    else if (activeTab === 'attack') setAttackAnim(updateFrameLayer);
    else if (activeTab === 'jump') setJumpAnim(updateFrameLayer);
    else setCustomAnims(prev => prev.map(a => a.id === activeTab ? updateFrameLayer(a) : a));
  };

  const flipArrayHorizontal = (arr) => {
    const next = [...arr];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < Math.floor(cols / 2); c++) {
        const leftIdx = r * cols + c;
        const rightIdx = r * cols + (cols - 1 - c);
        const leftTile = next[leftIdx];
        const rightTile = next[rightIdx];

        next[leftIdx] = rightTile ? (typeof rightTile === 'object' ? { ...rightTile, flipH: !rightTile.flipH } : { id: rightTile, flipH: true, flipV: false }) : null;
        next[rightIdx] = leftTile ? (typeof leftTile === 'object' ? { ...leftTile, flipH: !leftTile.flipH } : { id: leftTile, flipH: true, flipV: false }) : null;
      }
    }
    if (cols % 2 !== 0) {
      for (let r = 0; r < rows; r++) {
        const centerIdx = r * cols + Math.floor(cols / 2);
        const centerTile = next[centerIdx];
        if (centerTile) {
          next[centerIdx] = typeof centerTile === 'object' ? { ...centerTile, flipH: !centerTile.flipH } : { id: centerTile, flipH: true, flipV: false };
        }
      }
    }
    return next;
  };

  const flipArrayVertical = (arr) => {
    const next = [...arr];
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < Math.floor(rows / 2); r++) {
        const topIdx = r * cols + c;
        const bottomIdx = (rows - 1 - r) * cols + c;
        const topTile = next[topIdx];
        const bottomTile = next[bottomIdx];

        next[topIdx] = bottomTile ? (typeof bottomTile === 'object' ? { ...bottomTile, flipV: !bottomTile.flipV } : { id: bottomTile, flipH: false, flipV: true }) : null;
        next[bottomIdx] = topTile ? (typeof topTile === 'object' ? { ...topTile, flipV: !topTile.flipV } : { id: topTile, flipH: false, flipV: true }) : null;
      }
    }
    if (rows % 2 !== 0) {
      for (let c = 0; c < cols; c++) {
        const centerIdx = Math.floor(rows / 2) * cols + c;
        const centerTile = next[centerIdx];
        if (centerTile) {
          next[centerIdx] = typeof centerTile === 'object' ? { ...centerTile, flipV: !centerTile.flipV } : { id: centerTile, flipH: false, flipV: true };
        }
      }
    }
    return next;
  };

  const flipLayoutHorizontal = () => {
    setIsPlayingPreview(false);
    const updateAnimFlip = (prev) => {
      if (!prev) return null;
      const nextFramesLayers = [...prev.framesLayers];
      const nextFrameLayersData = { ...nextFramesLayers[activeFrameIdx] };
      for (const key in nextFrameLayersData) {
        if (Array.isArray(nextFrameLayersData[key])) {
          nextFrameLayersData[key] = flipArrayHorizontal(nextFrameLayersData[key]);
        }
      }
      nextFramesLayers[activeFrameIdx] = nextFrameLayersData;
      const nextFrames = [...prev.frames];
      nextFrames[activeFrameIdx] = flattenFrame(nextFrameLayersData, layersMetadata);
      return { ...prev, frames: nextFrames, framesLayers: nextFramesLayers };
    };

    if (activeTab === 'idle') setIdleAnim(updateAnimFlip);
    else if (activeTab === 'walk') setWalkAnim(updateAnimFlip);
    else if (activeTab === 'attack') setAttackAnim(updateAnimFlip);
    else if (activeTab === 'jump') setJumpAnim(updateAnimFlip);
    else setCustomAnims(prev => prev.map(a => a.id === activeTab ? updateAnimFlip(a) : a));
  };

  const flipLayoutVertical = () => {
    setIsPlayingPreview(false);
    const updateAnimFlip = (prev) => {
      if (!prev) return null;
      const nextFramesLayers = [...prev.framesLayers];
      const nextFrameLayersData = { ...nextFramesLayers[activeFrameIdx] };
      for (const key in nextFrameLayersData) {
        if (Array.isArray(nextFrameLayersData[key])) {
          nextFrameLayersData[key] = flipArrayVertical(nextFrameLayersData[key]);
        }
      }
      nextFramesLayers[activeFrameIdx] = nextFrameLayersData;
      const nextFrames = [...prev.frames];
      nextFrames[activeFrameIdx] = flattenFrame(nextFrameLayersData, layersMetadata);
      return { ...prev, frames: nextFrames, framesLayers: nextFramesLayers };
    };

    if (activeTab === 'idle') setIdleAnim(updateAnimFlip);
    else if (activeTab === 'walk') setWalkAnim(updateAnimFlip);
    else if (activeTab === 'attack') setAttackAnim(updateAnimFlip);
    else if (activeTab === 'jump') setJumpAnim(updateAnimFlip);
    else setCustomAnims(prev => prev.map(a => a.id === activeTab ? updateAnimFlip(a) : a));
  };

  const createNewAnimObject = (name) => {
    const defaultFrame = Array(cols * rows).fill(null);
    const fl = {};
    layersMetadata.forEach(layer => {
      fl[layer.id] = Array(cols * rows).fill(null);
    });
    return {
      id: Date.now() + Math.random(),
      name,
      frames: [defaultFrame],
      framesLayers: [fl],
      fps: 8
    };
  };

  const createWalkAnim = () => {
    setIsPlayingPreview(false);
    setWalkAnim(createNewAnimObject(`${actor.name} Walk`));
    setActiveTab('walk'); setActiveFrameIdx(0);
  };

  const createAttackAnim = () => {
    setIsPlayingPreview(false);
    setAttackAnim(createNewAnimObject(`${actor.name} Attack`));
    setActiveTab('attack'); setActiveFrameIdx(0);
  };

  const createJumpAnim = () => {
    setIsPlayingPreview(false);
    setJumpAnim(createNewAnimObject(`${actor.name} Jump`));
    setActiveTab('jump'); setActiveFrameIdx(0);
  };

  const createCustomAnim = () => {
    setIsPlayingPreview(false);
    const newAnim = createNewAnimObject(`${actor.name} Custom ${customAnims.length + 1}`);
    setCustomAnims(prev => [...prev, newAnim]);
    setActiveTab(newAnim.id); setActiveFrameIdx(0);
  };

  const addFrame = () => {
    setIsPlayingPreview(false);
    const updateAnimFrames = (anim) => {
      if (!anim) return null;
      const newFrameLayersData = {};
      layersMetadata.forEach(layer => {
        newFrameLayersData[layer.id] = Array(cols * rows).fill(null);
      });
      return {
        ...anim,
        frames: [...anim.frames, Array(cols * rows).fill(null)],
        framesLayers: [...anim.framesLayers, newFrameLayersData]
      };
    };
    if (activeTab === 'idle') setIdleAnim(updateAnimFrames);
    else if (activeTab === 'walk') setWalkAnim(updateAnimFrames);
    else if (activeTab === 'attack') setAttackAnim(updateAnimFrames);
    else if (activeTab === 'jump') setJumpAnim(updateAnimFrames);
    else setCustomAnims(prev => prev.map(a => a.id === activeTab ? updateAnimFrames(a) : a));
    
    const currentAnim = getCurrentAnim();
    if (currentAnim && currentAnim.frames) {
      setActiveFrameIdx(currentAnim.frames.length);
    }
  };

  const deleteFrame = (idx) => {
    setIsPlayingPreview(false);
    const updateAnimFrames = (anim) => {
      if (!anim) return null;
      const nextFrames = [...anim.frames];
      nextFrames.splice(idx, 1);
      const nextFramesLayers = [...anim.framesLayers];
      nextFramesLayers.splice(idx, 1);
      return {
        ...anim,
        frames: nextFrames,
        framesLayers: nextFramesLayers
      };
    };
    if (activeTab === 'idle') setIdleAnim(updateAnimFrames);
    else if (activeTab === 'walk') setWalkAnim(updateAnimFrames);
    else if (activeTab === 'attack') setAttackAnim(updateAnimFrames);
    else if (activeTab === 'jump') setJumpAnim(updateAnimFrames);
    else setCustomAnims(prev => prev.map(a => a.id === activeTab ? updateAnimFrames(a) : a));
    if (activeFrameIdx >= idx && activeFrameIdx > 0) setActiveFrameIdx(activeFrameIdx - 1);
  };

  const handleTileSelect = (tileId) => {
    setActiveTileId(tileId);
    if (tileId === null) {
      setUseGroupStamp(false);
      return;
    }
    const info = getGroupBrushInfo(tileId);
    if (info) {
      setUseGroupStamp(true);
    } else {
      setUseGroupStamp(false);
    }
  };

  const updateAnimationsWithNewLayers = (nextLayersList) => {
    setIdleAnim(prev => flattenAnim(prev, nextLayersList));
    if (walkAnim) setWalkAnim(prev => flattenAnim(prev, nextLayersList));
    if (attackAnim) setAttackAnim(prev => flattenAnim(prev, nextLayersList));
    if (jumpAnim) setJumpAnim(prev => flattenAnim(prev, nextLayersList));
    setCustomAnims(prev => prev.map(a => flattenAnim(a, nextLayersList)).filter(Boolean));
  };

  const addDesignerLayer = () => {
    const newId = 'layer_' + Date.now() + Math.random().toString(36).substr(2, 5);
    const newLayer = { id: newId, name: `Layer ${layersMetadata.length + 1}`, visible: true };
    const nextLayers = [newLayer, ...layersMetadata];
    setLayersMetadata(nextLayers);
    setActiveLayerId(newId);

    const addLayerToAnim = (prev) => {
      if (!prev) return null;
      const nextFramesLayers = prev.framesLayers.map(fl => ({
        ...fl,
        [newId]: Array(cols * rows).fill(null)
      }));
      return {
        ...prev,
        framesLayers: nextFramesLayers,
        frames: nextFramesLayers.map(fl => flattenFrame(fl, nextLayers))
      };
    };

    setIdleAnim(addLayerToAnim);
    if (walkAnim) setWalkAnim(addLayerToAnim);
    if (attackAnim) setAttackAnim(addLayerToAnim);
    if (jumpAnim) setJumpAnim(addLayerToAnim);
    setCustomAnims(prev => prev.map(addLayerToAnim).filter(Boolean));
  };

  const deleteDesignerLayer = (layerId) => {
    if (layersMetadata.length <= 1) return;
    const nextLayers = layersMetadata.filter(l => l.id !== layerId);
    setLayersMetadata(nextLayers);
    if (activeLayerId === layerId) {
      setActiveLayerId(nextLayers[0].id);
    }

    const removeLayerFromAnim = (prev) => {
      if (!prev) return null;
      const nextFramesLayers = prev.framesLayers.map(fl => {
        const nextFL = { ...fl };
        delete nextFL[layerId];
        return nextFL;
      });
      return {
        ...prev,
        framesLayers: nextFramesLayers,
        frames: nextFramesLayers.map(fl => flattenFrame(fl, nextLayers))
      };
    };

    setIdleAnim(removeLayerFromAnim);
    if (walkAnim) setWalkAnim(removeLayerFromAnim);
    if (attackAnim) setAttackAnim(removeLayerFromAnim);
    if (jumpAnim) setJumpAnim(removeLayerFromAnim);
    setCustomAnims(prev => prev.map(removeLayerFromAnim).filter(Boolean));
  };

  const nudgeLayer = useCallback((dx, dy) => {
    setIsPlayingPreview(false);
    
    const nudgeFrameLayers = (prev) => {
      if (!prev) return null;
      const nextFramesLayers = [...prev.framesLayers];
      const nextFrameLayersData = { ...nextFramesLayers[activeFrameIdx] };
      const currentLayerTiles = nextFrameLayersData[activeLayerId];
      if (!currentLayerTiles) return prev;
      
      const nextLayerTiles = Array(cols * rows).fill(null);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const srcIdx = r * cols + c;
          const tile = currentLayerTiles[srcIdx];
          if (tile) {
            const targetR = r + dy;
            const targetC = c + dx;
            if (targetR >= 0 && targetR < rows && targetC >= 0 && targetC < cols) {
              nextLayerTiles[targetR * cols + targetC] = tile;
            }
          }
        }
      }
      
      nextFrameLayersData[activeLayerId] = nextLayerTiles;
      nextFramesLayers[activeFrameIdx] = nextFrameLayersData;
      
      const nextFrames = [...prev.frames];
      nextFrames[activeFrameIdx] = flattenFrame(nextFrameLayersData, layersMetadata);
      
      return {
        ...prev,
        frames: nextFrames,
        framesLayers: nextFramesLayers
      };
    };
    
    if (activeTab === 'idle') setIdleAnim(nudgeFrameLayers);
    else if (activeTab === 'walk') setWalkAnim(nudgeFrameLayers);
    else if (activeTab === 'attack') setAttackAnim(nudgeFrameLayers);
    else if (activeTab === 'jump') setJumpAnim(nudgeFrameLayers);
    else setCustomAnims(prev => prev.map(a => a.id === activeTab ? nudgeFrameLayers(a) : a));
  }, [activeFrameIdx, activeLayerId, activeTab, cols, rows, flattenFrame, layersMetadata]);

  const isActiveLayerSmallerThanActor = useMemo(() => {
    const anim = getCurrentAnim();
    if (!anim) return false;
    const frameLayerData = anim.framesLayers[activeFrameIdx];
    if (!frameLayerData) return false;
    const layerTiles = frameLayerData[activeLayerId];
    if (!layerTiles) return false;

    let minR = rows, maxR = -1, minC = cols, maxC = -1;
    let hasTiles = false;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (layerTiles[r * cols + c]) {
          hasTiles = true;
          if (r < minR) minR = r;
          if (r > maxR) maxR = r;
          if (c < minC) minC = c;
          if (c > maxC) maxC = c;
        }
      }
    }
    if (!hasTiles) return false;
    const layerW = maxC - minC + 1;
    const layerH = maxR - minR + 1;
    return layerW < cols || layerH < rows;
  }, [getCurrentAnim, activeFrameIdx, activeLayerId, cols, rows]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
        return;
      }
      if (!isActiveLayerSmallerThanActor) return;
      
      let dx = 0, dy = 0;
      if (e.key === 'ArrowUp') {
        dy = -1;
      } else if (e.key === 'ArrowDown') {
        dy = 1;
      } else if (e.key === 'ArrowLeft') {
        dx = -1;
      } else if (e.key === 'ArrowRight') {
        dx = 1;
      }
      
      if (dx !== 0 || dy !== 0) {
        e.preventDefault();
        nudgeLayer(dx, dy);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeLayerId, activeFrameIdx, activeTab, cols, rows, layersMetadata, isActiveLayerSmallerThanActor, nudgeLayer]);

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 100000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onMouseUp={() => setIsDrawing(false)} onMouseLeave={() => setIsDrawing(false)}>
      <div style={{ background: '#222', border: '1px solid #444', borderRadius: '8px', width: '90%', height: '90%', display: 'flex', flexDirection: 'column', padding: '16px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#4CAF50', fontWeight: 'bold', fontSize: '14px', alignItems: 'center' }}>
          <span>Actor Designer: {actor.name}</span>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', fontSize: '11px', color: '#aaa', fontWeight: 'normal' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <label>Size:</label>
              <select
                value={`${designerW}x${designerH}`}
                onChange={e => {
                  const [w, h] = e.target.value.split('x').map(Number);
                  handleResize(w, h);
                }}
                style={{ background: '#111', color: '#fff', border: '1px solid #444', padding: '2px 4px', borderRadius: '3px', outline: 'none' }}
              >
                {!["8x8", "16x16", "32x32", "48x48", "64x64", "16x8", "32x8", "32x16", "64x32", "8x16", "8x32", "16x32", "32x64"].includes(`${designerW}x${designerH}`) && (
                  <option value={`${designerW}x${designerH}`}>{designerW} x {designerH} (Invalid)</option>
                )}
                <option value="8x8">8 x 8</option>
                <option value="16x16">16 x 16</option>
                <option value="32x32">32 x 32</option>
                <option value="48x48">48 x 48</option>
                <option value="64x64">64 x 64</option>
                <option value="16x8">16 x 8</option>
                <option value="32x8">32 x 8</option>
                <option value="32x16">32 x 16</option>
                <option value="64x32">64 x 32</option>
                <option value="8x16">8 x 16</option>
                <option value="8x32">8 x 32</option>
                <option value="16x32">16 x 32</option>
                <option value="32x64">32 x 64</option>
              </select>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', fontSize: '14px', marginLeft: '5px', fontWeight: 'bold' }}>✕</button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '20px', flexGrow: 1 }}>
          <div style={{ width: '15%', minWidth: '220px', display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '84vh', overflowY: 'auto', paddingRight: '4px' }}>
            {activeTab !== 'base' && (
              <div style={{ background: '#151515', border: '1px solid #333', borderRadius: '6px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
                <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#4CAF50', alignSelf: 'flex-start' }}>Animation Preview</div>
                <div style={{
                  width: '96px',
                  height: '96px',
                  background: 'transparent',
                  border: '1px solid #444',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  position: 'relative'
                }}>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${cols}, 16px)`,
                    gridTemplateRows: `repeat(${rows}, 16px)`,
                    gap: '0px',
                    transform: `scale(${Math.min(3, 48 / Math.max(designerW, designerH))})`,
                    transformOrigin: 'center'
                  }}>
                    {(() => {
                      const anim = getCurrentAnim();
                      const currentFrameIdx = isPlayingPreview ? previewFrameIdx : activeFrameIdx;
                      const frameTiles = anim?.frames[currentFrameIdx] || Array(cols * rows).fill(null);

                      return frameTiles.map((tId, idx) => {
                        const actualId = tId ? (typeof tId === 'object' ? tId.id : tId) : null;
                        const flipH = tId && typeof tId === 'object' ? tId.flipH : false;
                        const flipV = tId && typeof tId === 'object' ? tId.flipV : false;
                        const tile = actualId ? savedTiles.find(t => String(t.id) === String(actualId)) : null;

                        return (
                          <div key={idx} style={{
                            width: '16px',
                            height: '16px',
                            background: 'transparent',
                            transform: `scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1})`
                          }}>
                            {tile && <TileIcon tile={tile} size={16} />}
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
                <button
                  onClick={() => setIsPlayingPreview(!isPlayingPreview)}
                  style={{
                    width: '100%',
                    background: isPlayingPreview ? '#ff4444' : '#4CAF50',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '4px 8px',
                    fontSize: '10px',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  {isPlayingPreview ? '■ Stop Playback' : '▶ Play Animation'}
                </button>
              </div>
            )}
            <div style={{ display: 'flex', gap: '4px' }}>
              <button onClick={() => setHflip(!hflip)} style={{ flex: 1, background: hflip ? '#4CAF50' : '#111', color: '#fff', border: '1px solid #444', borderRadius: '3px', cursor: 'pointer', fontSize: '10px', padding: '4px' }} title="Auto Flip Left-Right depending on movement direction"><TbArrowsLeftRight /></button>
              <button onClick={() => setVflip(!vflip)} style={{ flex: 1, background: vflip ? '#4CAF50' : '#111', color: '#fff', border: '1px solid #444', borderRadius: '3px', cursor: 'pointer', fontSize: '10px', padding: '4px' }} title="Auto Flip Up-Down depending on movement direction"><TbArrowsUpDown /></button>
            </div>
            <div style={{ background: '#151515', border: '1px solid #333', borderRadius: '6px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#4CAF50' }}>Collision Box</div>
              {/* Actor collision selector disabled for now
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setShowCollisionMenu(!showCollisionMenu)}
                  title={`Collision Type: ${colType}`}
                  style={{
                    background: 'transparent',
                    border: colType !== 'none' ? '1px solid #FF5722' : '1px solid #555',
                    color: colType !== 'none' ? '#FF5722' : '#aaa',
                    padding: '2px 6px',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    fontSize: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <BsBoundingBox size={10} />
                  <span style={{ textTransform: 'capitalize' }}>
                    {colType !== 'none' ? colType : 'None'}
                  </span>
                </button>

                {showCollisionMenu && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '100%',
                      right: 0,
                      marginBottom: '4px',
                      backgroundColor: '#222',
                      border: '1px solid #444',
                      borderRadius: '4px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                      zIndex: 1000,
                      display: 'flex',
                      flexDirection: 'column',
                      minWidth: '100px',
                      overflow: 'hidden'
                    }}
                  >
                    {COLLISION_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => {
                          setColType(opt.value);
                          setShowCollisionMenu(false);
                        }}
                        style={{
                          background: colType === opt.value ? '#333' : 'transparent',
                          color: colType === opt.value ? '#FF5722' : '#ccc',
                          border: 'none',
                          padding: '6px 10px',
                          textAlign: 'left',
                          fontSize: '11px',
                          cursor: 'pointer',
                          transition: 'background 0.15s'
                        }}
                        onMouseEnter={(e) => e.target.style.background = '#383838'}
                        onMouseLeave={(e) => e.target.style.background = colType === opt.value ? '#333' : 'transparent'}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '10px', color: '#aaa', width: '12px' }}>X:</span>
                  <input
                    type="number"
                    value={colX}
                    onChange={(e) => setColX(Math.max(0, Math.min(designerW - 1, parseInt(e.target.value) || 0)))}
                    style={{ width: '100%', background: '#222', color: '#fff', border: '1px solid #444', padding: '2px', fontSize: '10px', borderRadius: '3px', outline: 'none' }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '10px', color: '#aaa', width: '12px' }}>Y:</span>
                  <input
                    type="number"
                    value={colY}
                    onChange={(e) => setColY(Math.max(0, Math.min(designerH - 1, parseInt(e.target.value) || 0)))}
                    style={{ width: '100%', background: '#222', color: '#fff', border: '1px solid #444', padding: '2px', fontSize: '10px', borderRadius: '3px', outline: 'none' }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '10px', color: '#aaa', width: '12px' }}>W:</span>
                  <input
                    type="number"
                    min="1"
                    value={colW}
                    onChange={(e) => setColW(Math.max(1, Math.min(designerW - colX, parseInt(e.target.value) || 1)))}
                    style={{ width: '100%', background: '#222', color: '#fff', border: '1px solid #444', padding: '2px', fontSize: '10px', borderRadius: '3px', outline: 'none' }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '10px', color: '#aaa', width: '12px' }}>H:</span>
                  <input
                    type="number"
                    min="1"
                    value={colH}
                    onChange={(e) => setColH(Math.max(1, Math.min(designerH - colY, parseInt(e.target.value) || 1)))}
                    style={{ width: '100%', background: '#222', color: '#fff', border: '1px solid #444', padding: '2px', fontSize: '10px', borderRadius: '3px', outline: 'none' }}
                  />
                </div>
              </div>
              <button
                onClick={autoFitCollisionBox}
                style={{
                  width: '100%',
                  background: '#333',
                  color: '#4CAF50',
                  border: '1px solid #4CAF50',
                  borderRadius: '4px',
                  padding: '4px 8px',
                  fontSize: '10px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  textAlign: 'center'
                }}
              >
                Auto-fit to Sprite
              </button>
            </div>
            



          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', borderBottom: '1px solid #444', paddingBottom: '4px' }}>
              <button onClick={() => selectTab('idle')} style={{ background: activeTab === 'idle' ? '#4CAF50' : '#222', color: '#fff', border: '1px solid #444', padding: '4px 8px', fontSize: '11px', borderRadius: '3px', cursor: 'pointer', whiteSpace: 'nowrap' }}>Idle Anim</button>
              {walkAnim ? (
                <button onClick={() => selectTab('walk')} style={{ background: activeTab === 'walk' ? '#4CAF50' : '#222', color: '#fff', border: '1px solid #444', padding: '4px 8px', fontSize: '11px', borderRadius: '3px', cursor: 'pointer', whiteSpace: 'nowrap' }}>Walk Anim</button>
              ) : (
                <button onClick={createWalkAnim} style={{ background: '#222', color: '#888', border: '1px dashed #555', padding: '4px 8px', fontSize: '11px', borderRadius: '3px', cursor: 'pointer', whiteSpace: 'nowrap' }}>+ Walk</button>
              )}
              {attackAnim ? (
                <button onClick={() => selectTab('attack')} style={{ background: activeTab === 'attack' ? '#4CAF50' : '#222', color: '#fff', border: '1px solid #444', padding: '4px 8px', fontSize: '11px', borderRadius: '3px', cursor: 'pointer', whiteSpace: 'nowrap' }}>Attack Anim</button>
              ) : (
                <button onClick={createAttackAnim} style={{ background: '#222', color: '#888', border: '1px dashed #555', padding: '4px 8px', fontSize: '11px', borderRadius: '3px', cursor: 'pointer', whiteSpace: 'nowrap' }}>+ Attack</button>
              )}
              {jumpAnim ? (
                <button onClick={() => selectTab('jump')} style={{ background: activeTab === 'jump' ? '#4CAF50' : '#222', color: '#fff', border: '1px solid #444', padding: '4px 8px', fontSize: '11px', borderRadius: '3px', cursor: 'pointer', whiteSpace: 'nowrap' }}>Jump Anim</button>
              ) : (
                <button onClick={createJumpAnim} style={{ background: '#222', color: '#888', border: '1px dashed #555', padding: '4px 8px', fontSize: '11px', borderRadius: '3px', cursor: 'pointer', whiteSpace: 'nowrap' }}>+ Jump</button>
              )}
              {customAnims.map(ca => (
                <button key={ca.id} onClick={() => selectTab(ca.id)} style={{ background: activeTab === ca.id ? '#4CAF50' : '#222', color: '#fff', border: '1px solid #444', padding: '4px 8px', fontSize: '11px', borderRadius: '3px', cursor: 'pointer', whiteSpace: 'nowrap' }}>{ca.name}</button>
              ))}
              <button onClick={createCustomAnim} style={{ background: '#222', color: '#888', border: '1px dashed #555', padding: '4px 8px', fontSize: '11px', borderRadius: '3px', cursor: 'pointer', whiteSpace: 'nowrap' }}>+ Custom</button>
            </div>
            <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#111', border: '1px solid #333', borderRadius: '4px', padding: '20px', overflow: 'auto', width: '100%', height: '100%', boxSizing: 'border-box' }}>
                <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: `repeat(${cols}, 32px)`, gridTemplateRows: `repeat(${rows}, 32px)`, gap: '1px', background: '#444', border: '1px solid #444' }}>
                  <div style={{
                    position: 'absolute',
                    left: `${colX * 4}px`,
                    top: `${colY * 4}px`,
                    width: `${colW * 4}px`,
                    height: `${colH * 4}px`,
                    border: '2px solid #4CAF50',
                    background: 'rgba(76, 175, 80, 0.15)',
                    pointerEvents: 'none',
                    zIndex: 10,
                    boxSizing: 'border-box',
                    transition: 'all 0.1s ease-out'
                  }} />
                  {getCurrentSpriteIds().map((tId, idx) => {
                    const actualId = tId ? (typeof tId === 'object' ? tId.id : tId) : null;
                    const flipH = tId && typeof tId === 'object' ? tId.flipH : false;
                    const flipV = tId && typeof tId === 'object' ? tId.flipV : false;
                    const tile = actualId ? savedTiles.find(t => String(t.id) === String(actualId)) : null;

                    const isHoveredStampCell = (() => {
                      if (!useGroupStamp || hoveredIdx === null) return null;
                      const info = getGroupBrushInfo(activeTileId);
                      if (!info) return null;
                      const hoverRow = Math.floor(hoveredIdx / cols);
                      const hoverCol = hoveredIdx % cols;
                      const cellRow = Math.floor(idx / cols);
                      const cellCol = idx % cols;
                      const dr = cellRow - hoverRow;
                      const dc = cellCol - hoverCol;
                      if (dr >= 0 && dr < info.rows && dc >= 0 && dc < info.cols) {
                        return info.tiles[dr * info.cols + dc];
                      }
                      return null;
                    })();

                    return (
                      <div 
                        key={idx} 
                        onMouseDown={() => { setIsDrawing(true); applyTile(idx); }} 
                        onMouseEnter={() => { setHoveredIdx(idx); if (isDrawing) applyTile(idx); }} 
                        onMouseLeave={() => setHoveredIdx(null)}
                        style={{ 
                          width: '32px', 
                          height: '32px', 
                          background: 'transparent', 
                          cursor: 'crosshair', 
                          position: 'relative',
                          outline: hoveredIdx === idx ? '1px dashed #4CAF50' : 'none'
                        }}
                      >
                        {tile && (
                          <div style={{ 
                            width: '32px', 
                            height: '32px', 
                            transform: `scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1})` 
                          }}>
                            <TileIcon tile={tile} size={32} />
                          </div>
                        )}
                        
                        {isHoveredStampCell && (() => {
                          const previewTile = savedTiles.find(t => String(t.id) === String(isHoveredStampCell.id));
                          return previewTile ? (
                            <div style={{ 
                              position: 'absolute', 
                              inset: 0, 
                              opacity: 0.6, 
                              pointerEvents: 'none',
                              transform: `scaleX(${brushFlipH ? -1 : 1}) scaleY(${brushFlipV ? -1 : 1})`
                            }}>
                              <TileIcon tile={previewTile} size={32} />
                            </div>
                          ) : null;
                        })()}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Nudge Active Layer Controls overlay */}
              {isActiveLayerSmallerThanActor && (
                <div style={{
                  position: 'absolute',
                  bottom: '10px',
                  right: '10px',
                  background: 'rgba(20, 20, 20, 0.85)',
                  backdropFilter: 'blur(4px)',
                  border: '1px solid #444',
                  borderRadius: '6px',
                  padding: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                  zIndex: 20
                }}>
                  <div style={{ fontSize: '9px', color: '#888', fontWeight: 'bold', textAlign: 'center' }}>Nudge Layer</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 18px)', gap: '4px', justifyContent: 'center' }}>
                    <div />
                    <button
                      onClick={() => nudgeLayer(0, -1)}
                      style={{ background: '#222', border: '1px solid #444', color: '#fff', borderRadius: '3px', cursor: 'pointer', fontSize: '8px', padding: '2px 0', textAlign: 'center', lineHeight: '1', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#4CAF50'; e.currentTarget.style.background = '#333'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#444'; e.currentTarget.style.background = '#222'; }}
                      title="Nudge Up"
                    >▲</button>
                    <div />
                    <button
                      onClick={() => nudgeLayer(-1, 0)}
                      style={{ background: '#222', border: '1px solid #444', color: '#fff', borderRadius: '3px', cursor: 'pointer', fontSize: '8px', padding: '2px 0', textAlign: 'center', lineHeight: '1', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#4CAF50'; e.currentTarget.style.background = '#333'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#444'; e.currentTarget.style.background = '#222'; }}
                      title="Nudge Left"
                    >◀</button>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', color: '#666' }}>✥</div>
                    <button
                      onClick={() => nudgeLayer(1, 0)}
                      style={{ background: '#222', border: '1px solid #444', color: '#fff', borderRadius: '3px', cursor: 'pointer', fontSize: '8px', padding: '2px 0', textAlign: 'center', lineHeight: '1', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#4CAF50'; e.currentTarget.style.background = '#333'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#444'; e.currentTarget.style.background = '#222'; }}
                      title="Nudge Right"
                    >▶</button>
                    <div />
                    <button
                      onClick={() => nudgeLayer(0, 1)}
                      style={{ background: '#222', border: '1px solid #444', color: '#fff', borderRadius: '3px', cursor: 'pointer', fontSize: '8px', padding: '2px 0', textAlign: 'center', lineHeight: '1', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#4CAF50'; e.currentTarget.style.background = '#333'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#444'; e.currentTarget.style.background = '#222'; }}
                      title="Nudge Down"
                    >▼</button>
                    <div />
                  </div>
                </div>
              )}
            </div>
            {activeTab !== 'base' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', background: '#111', border: '1px solid #333', borderRadius: '4px', overflowX: 'auto' }}>
                {getCurrentAnim()?.frames.map((frame, idx) => (
                  <div key={idx} onClick={() => { setIsPlayingPreview(false); setActiveFrameIdx(idx); }} style={{ width: '32px', height: '32px', border: activeFrameIdx === idx ? '2px solid #4CAF50' : '1px solid #444', background: 'transparent', cursor: 'pointer', display: 'flex', flexWrap: 'wrap', position: 'relative', flexShrink: 0 }}>
                    <div style={{ width: '100%', height: '100%', display: 'flex', flexWrap: 'wrap' }}>
                      <div style={{ color: '#fff', fontSize: '10px', width: '100%', textAlign: 'center', lineHeight: '32px' }}>F{idx + 1}</div>
                    </div>
                    {getCurrentAnim().frames.length > 1 && (
                      <div onClick={(e) => { e.stopPropagation(); deleteFrame(idx); }} style={{ position: 'absolute', top: -4, right: -4, background: '#ff4444', color: '#fff', fontSize: '8px', width: '12px', height: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}>✕</div>
                    )}
                  </div>
                ))}
                <button onClick={addFrame} style={{ width: '32px', height: '32px', background: '#222', border: '1px dashed #555', color: '#888', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>+</button>
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <label style={{ fontSize: '10px', color: '#aaa' }}>FPS:</label>
                  <input type="number" min="1" max="60" value={getCurrentAnim()?.fps || 8} onChange={(e) => {
                    const fps = parseInt(e.target.value) || 8;
                    if (activeTab === 'idle') setIdleAnim(prev => ({ ...prev, fps }));
                    else if (activeTab === 'walk') setWalkAnim(prev => ({ ...prev, fps }));
                    else if (activeTab === 'attack') setAttackAnim(prev => ({ ...prev, fps }));
                    else if (activeTab === 'jump') setJumpAnim(prev => ({ ...prev, fps }));
                    else setCustomAnims(prev => prev.map(a => a.id === activeTab ? { ...a, fps } : a));
                  }} style={{ width: '40px', background: '#222', color: '#fff', border: '1px solid #444', padding: '2px', fontSize: '10px', borderRadius: '3px' }} />
                </div>
              </div>
            )}
          </div>

          {/* Right Panel: Layers, Tile Selector & Remove BG color */}
          <div style={{ width: '25%', minWidth: '220px', display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '84vh', overflowY: 'auto', paddingLeft: '4px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ fontSize: '11px', color: '#aaa' }}>Select Tile:</div>
              <TileSelector
                tiles={savedTiles}
                value={activeTileId}
                onChange={handleTileSelect}
                hideLabel={true}
                placeholder="Eraser"
                style={{ width: '100%' }}
              />
              <div
                onClick={() => handleTileSelect(null)}
                style={{ 
                  padding: '6px', 
                  border: activeTileId === null ? '2px solid #4CAF50' : '1px solid #444', 
                  cursor: 'pointer', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  fontSize: '10px', 
                  color: '#ff4444', 
                  background: '#111',
                  borderRadius: '3px'
                }}
              >Eraser</div>

              {/* Group Brush Settings Panel */}
              {(() => {
                const brushInfo = getGroupBrushInfo(activeTileId);
                if (brushInfo) {
                  return (
                    <div style={{ background: '#1c1c1c', border: '1px solid #ff9800', borderRadius: '4px', padding: '6px', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '9px', marginTop: '4px' }}>
                      <div style={{ color: '#ff9800', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Group Brush ({brushInfo.cols * 8}x{brushInfo.rows * 8})</span>
                        <input
                          type="checkbox"
                          checked={useGroupStamp}
                          onChange={(e) => setUseGroupStamp(e.target.checked)}
                          id="use-group-stamp"
                          style={{ cursor: 'pointer' }}
                        />
                      </div>
                      <label htmlFor="use-group-stamp" style={{ color: '#aaa', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        Stamp entire group
                      </label>
                      <button
                        onClick={() => {
                          if (window.confirm(`Fit canvas to group size (${brushInfo.cols * 8}x${brushInfo.rows * 8}) and overwrite current frame?`)) {
                            handleResize(brushInfo.cols * 8, brushInfo.rows * 8);
                            const nextLayerTiles = Array(brushInfo.cols * brushInfo.rows).fill(null);
                            brushInfo.tiles.forEach((t, i) => {
                              if (t) nextLayerTiles[i] = { id: t.id, flipH: false, flipV: false };
                            });
                            
                            const updateFrameLayer = (prev) => {
                              if (!prev) return null;
                              const nextFramesLayers = [...prev.framesLayers];
                              const nextFrameLayersData = { ...nextFramesLayers[activeFrameIdx] };
                              nextFrameLayersData[activeLayerId] = nextLayerTiles;
                              nextFramesLayers[activeFrameIdx] = nextFrameLayersData;
                              
                              const nextFrames = [...prev.frames];
                              nextFrames[activeFrameIdx] = flattenFrame(nextFrameLayersData, layersMetadata);
                              return {
                                ...prev,
                                frames: nextFrames,
                                framesLayers: nextFramesLayers
                              };
                            };
                            if (activeTab === 'idle') setIdleAnim(updateFrameLayer);
                            else if (activeTab === 'walk') setWalkAnim(updateFrameLayer);
                            else if (activeTab === 'attack') setAttackAnim(updateFrameLayer);
                            else if (activeTab === 'jump') setJumpAnim(updateFrameLayer);
                            else setCustomAnims(prev => prev.map(a => a.id === activeTab ? updateFrameLayer(a) : a));
                          }
                        }}
                        style={{
                          background: '#333', border: '1px solid #555', color: '#fff', borderRadius: '3px', padding: '4px', cursor: 'pointer', fontSize: '9px', fontWeight: 'bold', marginTop: '2px'
                        }}
                      >
                        Fit Canvas & Fill
                      </button>
                    </div>
                  );
                }
                return null;
              })()}
            </div>

            {/* Layers List Panel */}
            <div style={{ background: '#151515', border: '1px solid #333', borderRadius: '6px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#4CAF50', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><BsLayers /> Layers</span>
                <button
                  onClick={addDesignerLayer}
                  style={{
                    background: 'none', border: 'none', color: '#4CAF50', cursor: 'pointer', fontSize: '12px', padding: '0 2px', display: 'flex', alignItems: 'center'
                  }}
                  title="Add Layer"
                >
                  <BsPlus size={16} />
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '150px', overflowY: 'auto' }}>
                {layersMetadata.map((layer, index) => {
                  const isActive = activeLayerId === layer.id;
                  return (
                    <div
                      key={layer.id}
                      onClick={() => setActiveLayerId(layer.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 6px',
                        background: isActive ? '#333' : '#1e1e1e',
                        border: isActive ? '1px solid #4CAF50' : '1px solid #2a2a2a',
                        borderRadius: '3px',
                        cursor: 'pointer'
                      }}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const next = layersMetadata.map(l => l.id === layer.id ? { ...l, visible: !l.visible } : l);
                          setLayersMetadata(next);
                          updateAnimationsWithNewLayers(next);
                        }}
                        style={{ background: 'none', border: 'none', color: layer.visible ? '#fff' : '#666', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
                      >
                        {layer.visible ? <BsEye size={12} /> : <BsEyeSlash size={12} />}
                      </button>
                      <span
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          const newName = window.prompt(`Rename ${layer.name} to:`, layer.name);
                          if (newName && newName.trim()) {
                            const next = layersMetadata.map(l => l.id === layer.id ? { ...l, name: newName.trim() } : l);
                            setLayersMetadata(next);
                          }
                        }}
                        style={{ fontSize: '10px', color: isActive ? '#fff' : '#aaa', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                        title="Double-click to rename"
                      >
                        {layer.name}
                      </span>
                      <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
                        <button
                          disabled={index === 0}
                          onClick={(e) => {
                            e.stopPropagation();
                            const next = [...layersMetadata];
                            const temp = next[index - 1];
                            next[index - 1] = next[index];
                            next[index] = temp;
                            setLayersMetadata(next);
                            updateAnimationsWithNewLayers(next);
                          }}
                          style={{ background: 'none', border: 'none', color: index === 0 ? '#444' : '#aaa', cursor: index === 0 ? 'default' : 'pointer', padding: 0, fontSize: '8px' }}
                          title="Move Up"
                        >
                          ▲
                        </button>
                        <button
                          disabled={index === layersMetadata.length - 1}
                          onClick={(e) => {
                            e.stopPropagation();
                            const next = [...layersMetadata];
                            const temp = next[index + 1];
                            next[index + 1] = next[index];
                            next[index] = temp;
                            setLayersMetadata(next);
                            updateAnimationsWithNewLayers(next);
                          }}
                          style={{ background: 'none', border: 'none', color: index === layersMetadata.length - 1 ? '#444' : '#aaa', cursor: index === layersMetadata.length - 1 ? 'default' : 'pointer', padding: 0, fontSize: '8px' }}
                          title="Move Down"
                        >
                          ▼
                        </button>
                        {layersMetadata.length > 1 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (window.confirm(`Delete ${layer.name}?`)) {
                                deleteDesignerLayer(layer.id);
                              }
                            }}
                            style={{ background: 'none', border: 'none', color: '#ff4444', cursor: 'pointer', padding: 0, display: 'flex', fontStyle: 'normal' }}
                            title="Delete Layer"
                          >
                            <BsTrash size={10} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            {uniqueColorsInActor.length > 0 && (
              <div style={{
                background: '#1a1a1a',
                border: '1px solid #333',
                borderRadius: '8px',
                padding: '10px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.5)',
                marginTop: '10px'
              }}>
                <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#4CAF50', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Remove Bg Color</span>
                  <span style={{ fontSize: '9px', color: '#888', fontWeight: 'normal' }}>Click to erase</span>
                </div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(12, 1fr)',
                  gap: '6px',
                  maxHeight: '100px',
                  overflowY: 'auto',
                  paddingRight: '2px'
                }}>
                  {uniqueColorsInActor.map(color => {
                    const isSuggested = color === suggestedBgColor;
                    return (
                      <button
                        key={color}
                        onClick={() => {
                          if (window.confirm(`Convert all pixels of color ${color} to transparent in this actor's tiles?`)) {
                            handleRemoveColor(color);
                          }
                        }}
                        style={{
                          width: '100%',
                          aspectRatio: '1',
                          backgroundColor: color,
                          border: isSuggested ? '1px solid #4CAF50' : '1px solid #444',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          padding: 0,
                          position: 'relative',
                          transition: 'transform 0.1s ease, border-color 0.1s ease',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.3)'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'scale(1)';
                          if (!isSuggested) e.currentTarget.style.borderColor = '#4CAF50';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'scale(1)';
                          if (!isSuggested) e.currentTarget.style.borderColor = '#444';
                        }}
                        title={isSuggested ? `Suggested BG color: ${color} (Click to remove)` : `Make color ${color} transparent`}
                      >
                        {isSuggested && (
                          <div style={{
                            position: 'absolute',
                            top: '-3px',
                            right: '-3px',
                            background: '#4CAF50',
                            color: '#fff',
                            fontSize: '6px',
                            padding: '1px 2px',
                            borderRadius: '2px',
                            lineHeight: '1',
                            fontWeight: 'bold'
                          }}>BG</div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={flipLayoutHorizontal} style={{ background: '#333', border: '1px solid #555', color: '#fff', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }} title="Flip design horizontally"><BsSymmetryVertical/></button>
            <button onClick={flipLayoutVertical} style={{ background: '#333', border: '1px solid #555', color: '#fff', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }} title="Flip design vertically"><BsSymmetryHorizontal/></button>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={onClose} style={{ background: 'transparent', border: '1px solid #555', color: '#fff', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
            <button
              onClick={() => onSave(idleAnim ? idleAnim.frames[0] : Array(cols * rows).fill(null), designerW, designerH, idleAnim, walkAnim, attackAnim, jumpAnim, customAnims, colX, colY, colW, colH, hflip, vflip, layersMetadata, colType)}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#4CAF50'; e.currentTarget.style.color = '#fff'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#4CAF50'; }}
              style={{ background: 'transparent', border: '1px solid #4CAF50', color: '#4CAF50', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
            >Save Layout</button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

const ActorsPanel = ({ isCollapsed, onToggle, dragProps }) => {
  const [editingActorId, setEditingActorId] = useState(null);
  const [designerActorId, setDesignerActorId] = useState(null);
  const [scriptPrompt, setScriptPrompt] = useState(null);
  const [scriptPromptName, setScriptPromptName] = useState('');
  const [actorTypeModalOpen, setActorTypeModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [actorTypeModalContext, setActorTypeModalContext] = useState({ mode: 'add', actorId: null });
  const [actorTypeSearchQuery, setActorTypeSearchQuery] = useState('');

  const listRef = useRef(null);

  useEffect(() => {
    if (!actorTypeModalOpen) {
      setActorTypeSearchQuery('');
    }
  }, [actorTypeModalOpen]);

  const {
    actors, setActors,
    globalActors, setGlobalActors,
    toggleGlobalActorInScene, setGlobalActorPosition, scenes, activeSceneId,
    activeActorId, setActiveActorId,
    setTool,
    savedTiles, setSavedTiles,
    recentColors,
    setEditingScriptActorId,
    setEditingCustomScriptId,
    animations, setAnimations,
    variables,
    customScripts, setCustomScripts,
    saveHistory, layers, dimensions,
    zoom, viewX, viewY, viewportSize
  } = usePxShop();

  useEffect(() => {
    if (activeActorId) {
      setTimeout(() => {
        const activeEl = document.getElementById(`actor-item-${activeActorId}`);
        if (activeEl) {
          activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 50);
    }
  }, [activeActorId]);

  const handleRenameComplete = () => {
    setEditingActorId(null);
  };

  const addActorGroup = (e) => {
    e.stopPropagation();
    const newGroup = {
      id: Date.now() + Math.random(),
      type: 'group',
      name: `Group ${actors.filter(a => a.type === 'group').length + 1}`,
      isOpen: false
    };
    const nextActors = [...actors, newGroup];
    setActors(nextActors);
    saveHistory("Add Actor Group", layers, dimensions, { actors: nextActors });
  };

  const toggleActorGroup = (groupId) => {
    const nextActors = actors.map(a => a.id === groupId ? { ...a, isOpen: !a.isOpen } : a);
    setActors(nextActors);
    saveHistory("Toggle Actor Group", layers, dimensions, { actors: nextActors });
  };

  const deleteActorGroup = (e, id) => {
    e.stopPropagation();
    const nextActors = actors.filter(a => a.id !== id && String(a.groupId) !== String(id));
    setActors(nextActors);
    if (activeActorId === id || (activeActorId && String(actors.find(a => a.id === activeActorId)?.groupId) === String(id))) {
      setActiveActorId(null);
    }
    saveHistory("Delete Actor Group", layers, dimensions, { actors: nextActors });
  };

  const moveActorUp = (e, id) => {
    e.stopPropagation();
    const index = actors.findIndex(a => a.id === id);
    if (index <= 0) return;
    
    const nextActors = [...actors];
    const temp = nextActors[index - 1];
    nextActors[index - 1] = nextActors[index];
    nextActors[index] = temp;
    
    setActors(nextActors);
    saveHistory("Move Actor Up", layers, dimensions, { actors: nextActors });
  };

  const moveActorDown = (e, id) => {
    e.stopPropagation();
    const index = actors.findIndex(a => a.id === id);
    if (index === -1 || index >= actors.length - 1) return;
    
    const nextActors = [...actors];
    const temp = nextActors[index + 1];
    nextActors[index + 1] = nextActors[index];
    nextActors[index] = temp;
    
    setActors(nextActors);
    saveHistory("Move Actor Down", layers, dimensions, { actors: nextActors });
  };

  const confirmAddScript = (actorId, prop, name) => {
    const activeScene = scenes.find(s => s.id === activeSceneId);
    const sceneName = activeScene?.name || 'Unknown Scene';
    const existingGroup = customScripts.find(s => s.type === 'group' && s.name === sceneName);
    let groupId = existingGroup?.id;
    let nextScripts = customScripts;
    if (!existingGroup) {
      const newGroup = {
        id: Date.now() + Math.random(),
        type: 'group',
        name: sceneName,
        isOpen: false
      };
      groupId = newGroup.id;
      nextScripts = [...nextScripts, newGroup];
    }
    const newScript = {
      id: Date.now() + Math.random(),
      name,
      groupId,
      script: { nodes: [{ id: 'start', position: { x: 250, y: 100 }, data: { label: 'On Call' }, type: 'input' }], edges: [] }
    };
    nextScripts = [...nextScripts, newScript];
    setCustomScripts(nextScripts);
    updateActor(actorId, prop, newScript.id);
    saveHistory("Add Script", layers, dimensions, { customScripts: nextScripts });
    setEditingCustomScriptId(newScript.id);
    setTool('script');
    setScriptPrompt(null);
  };

  const ACTOR_TYPE_GROUPS = [
    {
      label: 'Characters',
      types: ['player', 'npc', 'companion']
    },
    {
      label: 'Enemies & Combat',
      types: ['enemy', 'turret', 'spawner']
    },
    {
      label: 'Terrain',
      types: ['platform', 'ladder', 'conveyor', 'ice_block', 'crumbling_platform', 'pass_wall']
    },
    {
      label: 'Level Elements',
      types: ['checkpoint', 'save_point', 'hazard', 'spring', 'sign', 'destructible', 'pushable', 'push_target']
    },
    {
      label: 'Items',
      types: ['key', 'door', 'bonus', 'powerup', 'ammo_pickup', 'xp_orb', 'shield', 'grenade', 'magnet', 'health_pickup']
    },
    {
      label: 'Racing',
      types: ['boost_pad', 'checkpoint_gate']
    }
  ];



  const ACTOR_TYPE_NAMES = {
    player: 'Player',
    npc: 'NPC',
    enemy: 'Enemy',
    platform: 'Platform',
    ladder: 'Ladder',
    grass_block: 'Grass Block',
    spring: 'Spring',
    hazard: 'Hazard',
    destructible: 'Destructible Block',
    pushable: 'Pushable Block',
    key: 'Key',
    door: 'Locked Door',
    bonus: 'Bonus',
    powerup: 'Power-up',
    sign: 'Sign',
    conveyor: 'Conveyor Belt',
    checkpoint: 'Checkpoint',
    turret: 'Turret',
    spawner: 'Spawner',
    companion: 'Companion',
    pressure_plate: 'Pressure Plate',
    push_target: 'Push Target',
    teleporter: 'Teleporter',
    crumbling_platform: 'Crumbling Platform',
    ice_block: 'Ice Block',
    chest: 'Chest',
    torch: 'Torch',
    save_point: 'Save Point',
    xp_orb: 'XP Orb',
    shield: 'Shield',
    ammo_pickup: 'Ammo Pickup',
    grenade: 'Grenade',
    wall_jump_surface: 'Wall Jump',
    one_way_wall: 'One-Way Wall',
    magnet: 'Magnet',
    gravity_flip_zone: 'Gravity Flip',
    boost_pad: 'Boost Pad',
    checkpoint_gate: 'Checkpoint Gate',
    health_pickup: 'Health Pickup',
    pass_wall: 'Pass Wall'
  };

  const createActorWithType = (type) => {
    const defaultSpriteId = ACTOR_DEFAULT_TILE_MAP[type] || null;

    let targetX = Math.floor(dimensions.w / 2) - 4;
    let targetY = Math.floor(dimensions.h / 2) - 4;

    if (viewportSize && viewportSize.w > 0 && viewportSize.h > 0 && zoom) {
      const cx = (viewportSize.w / 2 - viewX) / zoom;
      const cy = (viewportSize.h / 2 - viewY) / zoom;
      targetX = Math.floor(cx) - 4;
      targetY = Math.floor(cy) - 4;
    }

    // Clamp coordinates to stay within level dimensions
    targetX = Math.max(0, Math.min(dimensions.w - 8, targetX));
    targetY = Math.max(0, Math.min(dimensions.h - 8, targetY));

    const newActor = {
      id: Date.now() + Math.random(),
      name: ACTOR_TYPE_NAMES[type] || 'Actor',
      type: type,
      x: targetX,
      y: targetY,
      useVarX: false,
      useVarY: false,
      varX: '',
      varY: '',
      width: 8,
      height: 8,
      collisionType: 'solid',
      color: '#ff00ff',
      spriteId: defaultSpriteId,
      isHidden: false,
      hflip: true,
      attackAnimId: null,
      jumpAnimId: null,
      script: { nodes: [], edges: [] },
      ...(type === 'xp_orb' ? { xpVarName: 'PLAYER_XP', xpValue: 1 } : {}),
      ...(type === 'pass_wall' ? { passCount: 0, passWallPassAnim: 'idle', passWallSolidAnim: 'idle', solidAfterFrames: 60, passWallMode: 'passes', passWallStartOnTouch: false } : {})
    };

    const targetGroupName = ACTOR_TYPE_TO_GROUP[type];
    if (targetGroupName) {
      const targetGroup = actors.find(a => a.type === 'group' && a.name === targetGroupName);
      if (targetGroup) {
        newActor.groupId = targetGroup.id;
      }
    } else if (type !== 'player') {
      const miscGroup = actors.find(a => a.type === 'group' && a.name === 'Misc');
      if (miscGroup) {
        newActor.groupId = miscGroup.id;
      }
    }

    let nextActors;
    if (newActor.groupId) {
      const groupIndex = actors.findIndex(a => a.id === newActor.groupId);
      let insertIndex = groupIndex + 1;
      while (insertIndex < actors.length && String(actors[insertIndex].groupId) === String(newActor.groupId)) {
        insertIndex++;
      }
      nextActors = [...actors];
      nextActors.splice(insertIndex, 0, newActor);
    } else {
      nextActors = [...actors, newActor];
    }
    setActors(nextActors);
    setActiveActorId(newActor.id);
    setTool('actor');
    saveHistory("Add Actor", layers, dimensions, { actors: nextActors });
  };

  const addActor = (e) => {
    e.stopPropagation();
    setActorTypeModalContext({ mode: 'add', actorId: null });
    setActorTypeModalOpen(true);
  };

  const handleActorTypeSelect = (type) => {
    if (actorTypeModalContext.mode === 'add') {
      createActorWithType(type);
    } else if (actorTypeModalContext.mode === 'change' && actorTypeModalContext.actorId) {
      updateActor(actorTypeModalContext.actorId, 'type', type);
    }
    setActorTypeModalOpen(false);
  };

  const deleteActor = (e, id) => {
    e.stopPropagation();
    const nextActors = actors.filter(a => a.id !== id);
    setActors(nextActors);
    if (activeActorId === id) setActiveActorId(null);
    saveHistory("Delete Actor", layers, dimensions, { actors: nextActors });
  };

  const duplicateActor = (e, actorToDuplicate) => {
    e.stopPropagation();

    if (actorToDuplicate.type === 'group') {
      const newGroupId = Date.now() + Math.random();
      const groupActors = actors.filter(a => String(a.groupId) === String(actorToDuplicate.id));
      
      const newGroupObj = {
        ...actorToDuplicate,
        id: newGroupId,
        name: `${actorToDuplicate.name} (Copy)`,
        isOpen: false
      };

      const duplicatedActors = groupActors.map((a, idx) => {
        const newId = Date.now() + Math.random() + idx;
        let copyIndex = 1;
        let newName = `${a.name} Copy`;
        while (actors.some(act => act.name === newName)) {
          newName = `${a.name} Copy ${copyIndex}`;
          copyIndex++;
        }
        
        return {
          ...JSON.parse(JSON.stringify(a)),
          id: newId,
          groupId: newGroupId,
          name: newName,
          script: a.script ? JSON.parse(JSON.stringify(a.script)) : { nodes: [], edges: [] }
        };
      });

      const groupIndex = actors.findIndex(a => a.id === actorToDuplicate.id);
      const nextActors = [...actors];
      nextActors.splice(groupIndex, 0, newGroupObj, ...duplicatedActors);

      setActors(nextActors);
      saveHistory("Duplicate Actor Group", layers, dimensions, { actors: nextActors });
      return;
    }

    // Generate unique ID and unique name
    const newId = Date.now() + Math.random();
    let copyIndex = 1;
    let newName = `${actorToDuplicate.name} Copy`;
    while (actors.some(a => a.name === newName)) {
      newName = `${actorToDuplicate.name} Copy ${copyIndex}`;
      copyIndex++;
    }

    // Clone animations if they exist
    const newGlobalAnims = [...animations];
    let newIdleAnimId = actorToDuplicate.idleAnimId;
    let newWalkAnimId = actorToDuplicate.walkAnimId;
    let newAttackAnimId = actorToDuplicate.attackAnimId;
    let newJumpAnimId = actorToDuplicate.jumpAnimId;
    let newCustomAnimIds = actorToDuplicate.customAnimIds ? [...actorToDuplicate.customAnimIds] : [];

    if (actorToDuplicate.idleAnimId) {
      const originalIdle = animations.find(a => a.id === actorToDuplicate.idleAnimId);
      if (originalIdle) {
        const clonedIdle = {
          ...originalIdle,
          id: Date.now() + Math.random() + 0.1,
          name: `${newName} Idle`,
          frames: originalIdle.frames.map(f => Array.isArray(f) ? [...f] : (f ? [f] : [])),
          framesLayers: originalIdle.framesLayers ? originalIdle.framesLayers.map(fl => {
            const nextFL = {};
            for (const key in fl) {
              if (Array.isArray(fl[key])) nextFL[key] = [...fl[key]];
            }
            return nextFL;
          }) : undefined
        };
        newGlobalAnims.push(clonedIdle);
        newIdleAnimId = clonedIdle.id;
      }
    }

    if (actorToDuplicate.walkAnimId) {
      const originalWalk = animations.find(a => a.id === actorToDuplicate.walkAnimId);
      if (originalWalk) {
        const clonedWalk = {
          ...originalWalk,
          id: Date.now() + Math.random() + 0.2,
          name: `${newName} Walk`,
          frames: originalWalk.frames.map(f => Array.isArray(f) ? [...f] : (f ? [f] : [])),
          framesLayers: originalWalk.framesLayers ? originalWalk.framesLayers.map(fl => {
            const nextFL = {};
            for (const key in fl) {
              if (Array.isArray(fl[key])) nextFL[key] = [...fl[key]];
            }
            return nextFL;
          }) : undefined
        };
        newGlobalAnims.push(clonedWalk);
        newWalkAnimId = clonedWalk.id;
      }
    }

    if (actorToDuplicate.attackAnimId) {
      const originalAttack = animations.find(a => a.id === actorToDuplicate.attackAnimId);
      if (originalAttack) {
        const clonedAttack = {
          ...originalAttack,
          id: Date.now() + Math.random() + 0.25,
          name: `${newName} Attack`,
          frames: originalAttack.frames.map(f => Array.isArray(f) ? [...f] : (f ? [f] : [])),
          framesLayers: originalAttack.framesLayers ? originalAttack.framesLayers.map(fl => {
            const nextFL = {};
            for (const key in fl) {
              if (Array.isArray(fl[key])) nextFL[key] = [...fl[key]];
            }
            return nextFL;
          }) : undefined
        };
        newGlobalAnims.push(clonedAttack);
        newAttackAnimId = clonedAttack.id;
      }
    }

    if (actorToDuplicate.jumpAnimId) {
      const originalJump = animations.find(a => a.id === actorToDuplicate.jumpAnimId);
      if (originalJump) {
        const clonedJump = {
          ...originalJump,
          id: Date.now() + Math.random() + 0.26,
          name: `${newName} Jump`,
          frames: originalJump.frames.map(f => Array.isArray(f) ? [...f] : (f ? [f] : [])),
          framesLayers: originalJump.framesLayers ? originalJump.framesLayers.map(fl => {
            const nextFL = {};
            for (const key in fl) {
              if (Array.isArray(fl[key])) nextFL[key] = [...fl[key]];
            }
            return nextFL;
          }) : undefined
        };
        newGlobalAnims.push(clonedJump);
        newJumpAnimId = clonedJump.id;
      }
    }

    if (actorToDuplicate.customAnimIds && actorToDuplicate.customAnimIds.length > 0) {
      newCustomAnimIds = actorToDuplicate.customAnimIds.map((id, idx) => {
        const originalCustom = animations.find(a => a.id === id);
        if (originalCustom) {
          const clonedCustom = {
            ...originalCustom,
            id: Date.now() + Math.random() + 0.3 + idx * 0.05,
            name: `${newName} Custom ${idx + 1}`,
            frames: originalCustom.frames.map(f => Array.isArray(f) ? [...f] : (f ? [f] : [])),
            framesLayers: originalCustom.framesLayers ? originalCustom.framesLayers.map(fl => {
              const nextFL = {};
              for (const key in fl) {
                if (Array.isArray(fl[key])) nextFL[key] = [...fl[key]];
              }
              return nextFL;
            }) : undefined
          };
          newGlobalAnims.push(clonedCustom);
          return clonedCustom.id;
        }
        return null;
      }).filter(Boolean);
    }

    if (newGlobalAnims.length > animations.length) {
      setAnimations(newGlobalAnims);
    }

    // Position duplication: offset slightly if not using variables to make it visible
    const newX = actorToDuplicate.useVarX ? actorToDuplicate.x : Math.min(dimensions.w - (actorToDuplicate.width || 8), (actorToDuplicate.x || 0) + 8);
    const newY = actorToDuplicate.useVarY ? actorToDuplicate.y : Math.min(dimensions.h - (actorToDuplicate.height || 8), (actorToDuplicate.y || 0) + 8);

    const newActor = {
      ...actorToDuplicate,
      id: newId,
      name: newName,
      x: newX,
      y: newY,
      idleAnimId: newIdleAnimId,
      walkAnimId: newWalkAnimId,
      attackAnimId: newAttackAnimId,
      jumpAnimId: newJumpAnimId,
      customAnimIds: newCustomAnimIds,
      designerLayers: actorToDuplicate.designerLayers ? actorToDuplicate.designerLayers.map(l => ({ ...l })) : undefined,
      script: actorToDuplicate.script ? JSON.parse(JSON.stringify(actorToDuplicate.script)) : { nodes: [], edges: [] }
    };

    const nextActors = [...actors, newActor];
    setActors(nextActors);
    setActiveActorId(newActor.id);

    saveHistory("Duplicate Actor", layers, dimensions, {
      actors: nextActors,
      animations: newGlobalAnims
    });
  };

  const makeActorGlobal = (actor) => {
    const nextActors = actors.filter(a => a.id !== actor.id);
    const nextGlobal = [...globalActors, actor];
    setActors(nextActors);
    setGlobalActors(nextGlobal);
    if (activeActorId === actor.id) setActiveActorId(null);
    saveHistory("Make Actor Global", layers, dimensions, { actors: nextActors, globalActors: nextGlobal });
  };

  const removeGlobalActor = (actor) => {
    const nextGlobal = globalActors.filter(a => a.id !== actor.id);
    const nextActors = [...actors, actor];
    setActors(nextActors);
    setGlobalActors(nextGlobal);
    setActiveActorId(actor.id);
    saveHistory("Unlink Global Actor", layers, dimensions, { actors: nextActors, globalActors: nextGlobal });
  };

  const updateActor = (id, prop, value) => {
    const isGlobal = globalActors.some(a => a.id === id);
    const setter = isGlobal ? setGlobalActors : setActors;
    setter(prev => prev.map(a => {
      if (a.id === id) {
        let updated = { ...a, [prop]: value };
        if (prop === 'type') {
          if (a.spriteId === null || Object.values(ACTOR_DEFAULT_TILE_MAP).includes(a.spriteId)) {
            updated.spriteId = ACTOR_DEFAULT_TILE_MAP[value] || null;
            updated.spriteIds = null;
          }
          updated.name = ACTOR_TYPE_NAMES[value] || 'Actor';
        }
        return updated;
      }
      return a;
    }));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: isCollapsed ? 'none' : 1, borderBottom: '2px solid #222', minHeight: 0, background: isCollapsed ? 'transparent' : '#334233' }}>
      <div
        onClick={onToggle}
        style={{ padding: '10px', borderBottom: isCollapsed ? 'none' : '1px solid #3c3c3c', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'grab', userSelect: 'none', background: '#0e210e' }}
        {...dragProps}
      >
        <span style={{ fontWeight: 'bold', fontSize: '11px', textTransform: 'uppercase', color: isCollapsed ? '#aaa' : '#4CAF50', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ImMan /> Actors
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={e => { if (isCollapsed) { onToggle(); } e.stopPropagation(); }}>
          {!isCollapsed && (
            <button onClick={addActorGroup} title="Add Group" style={{ backgroundColor: 'transparent', border: '1px solid #555', color: '#888', padding: '3px 7px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'all 0.2s' }} onMouseEnter={e => { e.currentTarget.style.borderColor = '#ff9800'; e.currentTarget.style.color = '#ff9800'; }} onMouseLeave={e => { e.currentTarget.style.borderColor = '#555'; e.currentTarget.style.color = '#888'; }}><BsFolder2Open /></button>
          )}
          <button onClick={addActor} title="Add Actor" style={{ backgroundColor: 'transparent', border: '1px solid #555', color: '#888', padding: '3px 7px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'all 0.2s' }} onMouseEnter={e => { e.currentTarget.style.borderColor = '#4CAF50'; e.currentTarget.style.color = '#4CAF50'; }} onMouseLeave={e => { e.currentTarget.style.borderColor = '#555'; e.currentTarget.style.color = '#888'; }}><BsPlus /></button>
          <div onClick={e => { e.stopPropagation(); onToggle(); }} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            {isCollapsed ? <BsChevronRight style={{ color: '#aaa' }} /> : <BsChevronDown style={{ color: '#aaa' }} />}
          </div>
        </div>
      </div>
      {!isCollapsed && (
        <>
          <div style={{ textAlign:'left',padding: '10px', borderBottom: '1px solid #222' }}>
            <input
              type="text"
              placeholder="Search actors..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                background: '#111',
                color: '#fff',
                border: '1px solid #444',
                borderRadius: '4px',
                padding: '6px 8px',
                fontSize: '11px',
                outline: 'none',
                boxSizing: 'border-box'
              }} />
          </div>
          <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {actors.filter(actor => {
              if (!searchQuery) return true;
              if (actor.type === 'group') {
                if (actor.name.toLowerCase().includes(searchQuery.toLowerCase())) return true;
                return actors.some(a => a.type !== 'group' && String(a.groupId) === String(actor.id) && a.name.toLowerCase().includes(searchQuery.toLowerCase()));
              }
              return actor.name.toLowerCase().includes(searchQuery.toLowerCase());
            }).map((actor, index) => {
              if (actor.type === 'group') {
                return (
                  <div key={actor.id} id={`actor-item-${actor.id}`}
                    style={{ 
                      display: 'flex', flexDirection: 'column', padding: '8px 10px', 
                      backgroundColor: '#2a2a2a', 
                      borderRadius: '6px',
                      border: activeActorId === actor.id ? '1px solid #ff9800' : '1px solid #555',
                      marginTop: '4px'
                    }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <button onClick={(e) => { e.stopPropagation(); toggleActorGroup(actor.id); }} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 0 }}>
                        {actor.isOpen ? '▼' : '▶'}
                      </button>
                      {editingActorId === actor.id ? (
                        <input
                          autoFocus
                          value={actor.name}
                          onChange={(e) => updateActor(actor.id, 'name', e.target.value)}
                          onBlur={handleRenameComplete}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === 'Escape') handleRenameComplete();
                          }}
                          style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #ff9800', outline: 'none', padding: '2px', fontSize: '13px', textAlign: 'left' }}
                        />
                      ) : (
                        <span
                          onDoubleClick={(e) => { e.stopPropagation(); setEditingActorId(actor.id); }}
                          style={{ fontSize: '13px', fontWeight: 'bold', color: actor.isOpen ? '#ff9800' : '#fff', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'pointer', textAlign: 'left' }}
                        >
                          📁 {actor.name}
                        </span>
                      )}
                      <button title="Duplicate Group" onClick={(e) => duplicateActor(e, actor)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}><BsFiles size={14} /></button>
                      <button title="Move Up" onClick={(e) => moveActorUp(e, actor.id)} disabled={actors.findIndex(a => a.id === actor.id) === 0} style={{ background: 'none', border: 'none', color: actors.findIndex(a => a.id === actor.id) === 0 ? '#555' : '#fff', cursor: actors.findIndex(a => a.id === actor.id) === 0 ? 'default' : 'pointer', padding: 0 }}>▲</button>
                      <button title="Move Down" onClick={(e) => moveActorDown(e, actor.id)} disabled={actors.findIndex(a => a.id === actor.id) === actors.length - 1} style={{ background: 'none', border: 'none', color: actors.findIndex(a => a.id === actor.id) === actors.length - 1 ? '#555' : '#fff', cursor: actors.findIndex(a => a.id === actor.id) === actors.length - 1 ? 'default' : 'pointer', padding: 0 }}>▼</button>
                      <button onClick={(e) => deleteActorGroup(e, actor.id)} style={{ background: 'none', border: 'none', color: '#ff4444', cursor: 'pointer', padding: 0, marginLeft: '5px', display: 'flex', alignItems: 'center' }}>
                        <BsTrash />
                      </button>
                    </div>
                  </div>
                );
              }

              const group = actor.groupId ? actors.find(a => String(a.id) === String(actor.groupId)) : null;
              if (group && !group.isOpen && !searchQuery) return null;

              return (
                <div key={actor.id} id={`actor-item-${actor.id}`}
                  onClick={() => { setActiveActorId(actor.id); setTool('actor'); }}
                  style={{
                    marginLeft: actor.groupId ? '15px' : '0',
                    display: 'flex', flexDirection: 'column', padding: '10px',
                    backgroundColor: activeActorId === actor.id ? '#3c3c3c' : '#1e1e1e',
                    borderRadius: '6px', cursor: 'pointer',
                    border: activeActorId === actor.id ? '1px solid #4CAF50' : '1px solid transparent'
                  }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, overflow: 'hidden' }}>
                  {(() => {
                    const firstSpriteId = (actor.spriteIds && actor.spriteIds.length > 0 && actor.spriteIds[0]) ? (typeof actor.spriteIds[0] === 'object' ? actor.spriteIds[0].id : actor.spriteIds[0]) : null;
                    const tileId = firstSpriteId ?? actor.spriteId ?? ACTOR_DEFAULT_TILE_MAP[actor.type];
                    const tile = savedTiles.find(t => String(t.id) === String(tileId) || t.id === Number(tileId));
                    return tile ? (
                      <TileIcon tile={tile} size={16} />
                    ) : (
                      <div style={{ width: '16px', height: '16px', backgroundColor: actor.color || '#ff00ff', borderRadius: '3px', flexShrink: 0 }} />
                    );
                  })()}
                  {editingActorId === actor.id ? (
                    <input
                      autoFocus
                      value={actor.name}
                      onChange={(e) => updateActor(actor.id, 'name', e.target.value)}
                      onBlur={handleRenameComplete}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === 'Escape') handleRenameComplete();
                      }}
                      style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #4CAF50', outline: 'none', padding: '2px', fontSize: '13px' }}
                    />
                  ) : (
                    <span
                      onDoubleClick={(e) => { e.stopPropagation(); setEditingActorId(actor.id); }}
                      style={{ fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                    >
                      {actor.name}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    onClick={(e) => duplicateActor(e, actor)}
                    title="Duplicate Actor"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#aaa',
                      cursor: 'pointer',
                      opacity: 0.8,
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center',
                      transition: 'color 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.color = '#fff'}
                    onMouseLeave={(e) => e.currentTarget.style.color = '#aaa'}
                  >
                    <BsCopy size={13} />
                  </button>
                  <button title="Move Up" onClick={(e) => moveActorUp(e, actor.id)} disabled={actors.findIndex(a => a.id === actor.id) === 0} style={{ background: 'none', border: 'none', color: actors.findIndex(a => a.id === actor.id) === 0 ? '#555' : '#fff', cursor: actors.findIndex(a => a.id === actor.id) === 0 ? 'default' : 'pointer', padding: 0 }}>▲</button>
                  <button title="Move Down" onClick={(e) => moveActorDown(e, actor.id)} disabled={actors.findIndex(a => a.id === actor.id) === actors.length - 1} style={{ background: 'none', border: 'none', color: actors.findIndex(a => a.id === actor.id) === actors.length - 1 ? '#555' : '#fff', cursor: actors.findIndex(a => a.id === actor.id) === actors.length - 1 ? 'default' : 'pointer', padding: 0 }}>▼</button>
                  <button
                    onClick={(e) => { e.stopPropagation(); makeActorGlobal(actor); }}
                    title="Make Global (appears in all scenes)"
                    style={{ background: 'none', border: 'none', color: '#4CAF50', cursor: 'pointer', opacity: 0.8, padding: 0, display: 'flex', alignItems: 'center', fontSize: '12px' }}
                  >
                    🌐
                  </button>
                  <button onClick={(e) => deleteActor(e, actor.id)} style={{ background: 'none', border: 'none', color: '#ff4444', cursor: 'pointer', opacity: 0.8, padding: 0 }}>
                    <BsTrash />
                  </button>
                </div>
              </div>

              {activeActorId === actor.id && (
                <div style={{ marginTop: '10px', borderTop: '1px solid #555', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <label style={{ fontSize: '11px', color: '#aaa', width: '30px' }}>Type:</label>
                    <button
                      onClick={() => { setActorTypeModalContext({ mode: 'change', actorId: actor.id }); setActorTypeModalOpen(true); }}
                      style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #444', padding: '4px 8px', fontSize: '11px', outline: 'none', borderRadius: '3px', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      {(() => {
                        const tile = savedTiles.find(t => t.id === ACTOR_DEFAULT_TILE_MAP[actor.type]);
                        return tile ? <TileIcon tile={tile} size={16} /> : null;
                      })()}
                      {ACTOR_TYPE_NAMES[actor.type] || 'Actor'}
                    </button>
                  </div>
                  {/* Collision dropdown disabled for now
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <label style={{ fontSize: '11px', color: '#aaa', width: '60px' }}>Collision:</label>
                    <select
                      value={actor.collisionType || 'solid'}
                      onChange={(e) => updateActor(actor.id, 'collisionType', e.target.value)}
                      style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #444', padding: '4px 8px', fontSize: '11px', outline: 'none', borderRadius: '3px', textTransform: 'capitalize' }}
                    >
                      {COLLISION_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  */}

                  {actor.type === 'player' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px', background: '#222', padding: '8px', borderRadius: '4px', border: '1px solid #444' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ fontSize: '11px', color: '#aaa', width: '80px' }}>Movement:</label>
                        <select value={actor.moveDir || 'input'} onChange={(e) => updateActor(actor.id, 'moveDir', e.target.value)} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }}>
                          <option value="input">Player Input</option>
                          <option value="sine">Sine</option>
                          <option value="zigzag">Zigzag</option>
                          <option value="random">Random</option>
                        </select>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderTop: '1px solid #333', paddingTop: '6px', marginTop: '4px' }}>
                        <label style={{ fontSize: '11px', color: '#aaa', width: '80px' }}>On Max Bonus:</label>
                        <select value={actor.playerBonusMaxScriptId || ""} onChange={(e) => updateActor(actor.id, 'playerBonusMaxScriptId', e.target.value ? Number(e.target.value) : null)} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }}>
                          <option value="">[None / Default]</option>
                          {customScripts.filter(cs => cs.type !== 'group').map(cs => <option key={cs.id} value={cs.id}>{cs.name}</option>)}
                        </select>
                        {actor.playerBonusMaxScriptId ? (
                          <button onClick={() => { setEditingCustomScriptId(actor.playerBonusMaxScriptId); setTool('script'); }} style={{ background: 'transparent', color: '#888', border: 'none', padding: '2px 4px', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', borderRadius: '3px', flexShrink: 0 }} title="Edit Script"><BsPencil /></button>
                        ) : (
                          <button onClick={() => { setScriptPromptName('On Max Bonus'); setScriptPrompt({ actorId: actor.id, prop: 'playerBonusMaxScriptId' }); }} style={{ background: 'transparent', color: '#4CAF50', border: 'none', padding: '2px 4px', cursor: 'pointer', fontSize: '15px', display: 'flex', alignItems: 'center', borderRadius: '3px', flexShrink: 0 }} title="Add Script"><BsPlus /></button>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ fontSize: '11px', color: '#aaa', width: '80px' }}>On Max XP:</label>
                        <select value={actor.playerMaxXpScriptId || ""} onChange={(e) => updateActor(actor.id, 'playerMaxXpScriptId', e.target.value ? Number(e.target.value) : null)} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }}>
                          <option value="">[None / Default]</option>
                          {customScripts.filter(cs => cs.type !== 'group').map(cs => <option key={cs.id} value={cs.id}>{cs.name}</option>)}
                        </select>
                        {actor.playerMaxXpScriptId ? (
                          <button onClick={() => { setEditingCustomScriptId(actor.playerMaxXpScriptId); setTool('script'); }} style={{ background: 'transparent', color: '#888', border: 'none', padding: '2px 4px', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', borderRadius: '3px', flexShrink: 0 }} title="Edit Script"><BsPencil /></button>
                        ) : (
                          <button onClick={() => { setScriptPromptName('On Max XP'); setScriptPrompt({ actorId: actor.id, prop: 'playerMaxXpScriptId' }); }} style={{ background: 'transparent', color: '#4CAF50', border: 'none', padding: '2px 4px', cursor: 'pointer', fontSize: '15px', display: 'flex', alignItems: 'center', borderRadius: '3px', flexShrink: 0 }} title="Add Script"><BsPlus /></button>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ fontSize: '11px', color: '#aaa', width: '80px' }}>On Death:</label>
                        <select value={actor.playerDeathScriptId || ""} onChange={(e) => updateActor(actor.id, 'playerDeathScriptId', e.target.value ? Number(e.target.value) : null)} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }}>
                          <option value="">[None / Default]</option>
                          {customScripts.filter(cs => cs.type !== 'group').map(cs => <option key={cs.id} value={cs.id}>{cs.name}</option>)}
                        </select>
                        {actor.playerDeathScriptId ? (
                          <button onClick={() => { setEditingCustomScriptId(actor.playerDeathScriptId); setTool('script'); }} style={{ background: 'transparent', color: '#888', border: 'none', padding: '2px 4px', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', borderRadius: '3px', flexShrink: 0 }} title="Edit Script"><BsPencil /></button>
                        ) : (
                          <button onClick={() => { setScriptPromptName('On Death'); setScriptPrompt({ actorId: actor.id, prop: 'playerDeathScriptId' }); }} style={{ background: 'transparent', color: '#4CAF50', border: 'none', padding: '2px 4px', cursor: 'pointer', fontSize: '15px', display: 'flex', alignItems: 'center', borderRadius: '3px', flexShrink: 0 }} title="Add Script"><BsPlus /></button>
                        )}
                      </div>

                      {/* Double Jump Option */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderTop: '1px solid #333', paddingTop: '6px', marginTop: '4px' }}>
                        <input type="checkbox" id={`doubleJump-${actor.id}`} checked={actor.doubleJump || false} onChange={(e) => updateActor(actor.id, 'doubleJump', e.target.checked)} />
                        <label htmlFor={`doubleJump-${actor.id}`} style={{ fontSize: '11px', color: '#aaa', cursor: 'pointer' }}>Enable Double Jump</label>
                      </div>

                      {/* Player Anim On Button Settings */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderTop: '1px solid #333', paddingTop: '6px', marginTop: '4px' }}>
                        <input type="checkbox" id={`playerAnimOnButton-${actor.id}`} checked={actor.playerAnimOnButton || false} onChange={(e) => updateActor(actor.id, 'playerAnimOnButton', e.target.checked)} />
                        <label htmlFor={`playerAnimOnButton-${actor.id}`} style={{ fontSize: '11px', color: '#aaa', cursor: 'pointer' }}>Play Anim on Button Press</label>
                      </div>
                      {actor.playerAnimOnButton && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', paddingLeft: '10px', paddingTop: '4px', borderTop: '1px solid #333' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', width: '100%' }}>
                            <label style={{ fontSize: '11px', color: '#aaa', width: '80px' }}>Button:</label>
                            <select value={actor.playerAnimButton || 'b'} onChange={(e) => updateActor(actor.id, 'playerAnimButton', e.target.value)} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }}>
                              <option value="a">A</option>
                              <option value="b">B</option>
                              <option value="l">L</option>
                              <option value="r">R</option>
                              <option value="start">Start</option>
                              <option value="select">Select</option>
                            </select>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', width: '100%' }}>
                            <label style={{ fontSize: '11px', color: '#aaa', width: '80px' }}>Animation:</label>
                            <select value={actor.playerAnimId || ""} onChange={(e) => updateActor(actor.id, 'playerAnimId', e.target.value ? Number(e.target.value) : null)} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }}>
                              <option value="">[Select Animation]</option>
                              {Array.from(new Set([
                                actor.idleAnimId,
                                actor.walkAnimId,
                                actor.attackAnimId,
                                actor.jumpAnimId,
                                ...(actor.customAnimIds || [])
                              ].filter(Boolean))).map(animId => {
                                const anim = animations.find(a => a.id === animId);
                                return <option key={animId} value={animId}>{anim ? anim.name : 'Animation'}</option>
                              })}
                            </select>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', marginTop: '4px' }}>
                            <input type="checkbox" id={`playerAnimFireProjectile-${actor.id}`} checked={actor.playerAnimFireProjectile || false} onChange={(e) => updateActor(actor.id, 'playerAnimFireProjectile', e.target.checked)} />
                            <label htmlFor={`playerAnimFireProjectile-${actor.id}`} style={{ fontSize: '11px', color: '#aaa', cursor: 'pointer' }}>Fire Projectile on Specific Frame</label>
                          </div>
                          {actor.playerAnimFireProjectile && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', width: '100%', paddingLeft: '20px' }}>
                              <label style={{ fontSize: '11px', color: '#aaa', width: '80px' }}>Frame Index:</label>
                              <input type="number" min="1" value={actor.playerAnimFireFrame ?? 1} onChange={(e) => updateActor(actor.id, 'playerAnimFireFrame', parseInt(e.target.value) || 1)} style={{ width: '50px', background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }} />
                              <span style={{ fontSize: '9px', color: '#666' }}> (Starts at 1, uses settings below)</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Player Projectile Settings */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderTop: '1px solid #333', paddingTop: '6px', marginTop: '4px' }}>
                        <input type="checkbox" id={`playerFire-${actor.id}`} checked={actor.playerFireProjectiles || false} onChange={(e) => updateActor(actor.id, 'playerFireProjectiles', e.target.checked)} />
                        <label htmlFor={`playerFire-${actor.id}`} style={{ fontSize: '11px', color: '#aaa', cursor: 'pointer' }}>Fire Projectile on Button Press</label>
                      </div>
                      {actor.playerFireProjectiles && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', paddingLeft: '10px', paddingTop: '4px', borderTop: '1px solid #333' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', width: '100%' }}>
                            <label style={{ fontSize: '11px', color: '#aaa', width: '80px' }}>Button:</label>
                            <select value={actor.playerFireButton || 'b'} onChange={(e) => updateActor(actor.id, 'playerFireButton', e.target.value)} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }}>
                              <option value="a">A</option>
                              <option value="b">B</option>
                              <option value="l">L</option>
                              <option value="r">R</option>
                              <option value="start">Start</option>
                              <option value="select">Select</option>
                            </select>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', width: '100%' }}>
                            <label style={{ fontSize: '11px', color: '#aaa', width: '80px' }}>Dir Mode:</label>
                            <select value={actor.playerProjDirMode || 'vector'} onChange={(e) => updateActor(actor.id, 'playerProjDirMode', e.target.value)} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }}>
                              <option value="vector">Manual Vector</option>
                              <option value="facing">Facing / Movement</option>
                              <option value="angle">Angle (Degrees)</option>
                              <option value="target_enemy">Toward Nearest Enemy</option>
                            </select>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', width: '100%' }}>
                            <label style={{ fontSize: '11px', color: '#aaa', width: '80px' }}>Proj Type:</label>
                            <select value={actor.playerProjType || 'normal'} onChange={(e) => updateActor(actor.id, 'playerProjType', e.target.value)} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }}>
                              <option value="normal">Normal (Straight)</option>
                              <option value="bouncing">Bouncing Fireball</option>
                            </select>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', width: '100%' }}>
                            <label style={{ fontSize: '11px', color: '#aaa', width: '80px' }}>Lock Axis:</label>
                            <select value={actor.playerProjLockAxis || 'none'} onChange={(e) => updateActor(actor.id, 'playerProjLockAxis', e.target.value)} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }}>
                              <option value="none">None</option>
                              <option value="horizontal">Horizontal</option>
                              <option value="vertical">Vertical</option>
                            </select>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', width: '100%' }}>
                            <label style={{ fontSize: '11px', color: '#aaa', width: '80px' }}>Proj Life (f):</label>
                            {actor.useVarPlayerProjLifetime ? (
                              <select value={actor.varPlayerProjLifetime || ''} onChange={(e) => updateActor(actor.id, 'varPlayerProjLifetime', e.target.value)} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px', minWidth: 0 }}>
                                <option value="">Select Var</option>
                                {variables.filter(v => v.type !== 'group').map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
                              </select>
                            ) : (
                              <input type="number" min="1" value={actor.playerProjLifetime ?? 180} onChange={(e) => updateActor(actor.id, 'playerProjLifetime', parseInt(e.target.value) || 180)} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px', minWidth: 0 }} />
                            )}
                            <button onClick={(e) => { e.stopPropagation(); updateActor(actor.id, 'useVarPlayerProjLifetime', !actor.useVarPlayerProjLifetime); }} title="Toggle Variable" style={{ background: actor.useVarPlayerProjLifetime ? '#4CAF50' : '#333', color: '#fff', border: 'none', borderRadius: '3px', padding: '4px 6px', cursor: 'pointer', fontSize: '10px' }}>V</button>
                          </div>
                          {(actor.playerProjDirMode === 'vector' || !actor.playerProjDirMode) && (
                            <>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <label style={{ fontSize: '11px', color: '#aaa', width: '80px' }}>Vel X:</label>
                                <input type="number" step="0.1" value={actor.playerProjDx ?? 1} onChange={(e) => updateActor(actor.id, 'playerProjDx', parseFloat(e.target.value) || 0)} style={{ width: '50px', background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }} />
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <label style={{ fontSize: '11px', color: '#aaa', width: '80px' }}>Vel Y:</label>
                                <input type="number" step="0.1" value={actor.playerProjDy ?? 0} onChange={(e) => updateActor(actor.id, 'playerProjDy', parseFloat(e.target.value) || 0)} style={{ width: '50px', background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }} />
                              </div>
                            </>
                          )}
                          {actor.playerProjDirMode && actor.playerProjDirMode !== 'vector' && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <label style={{ fontSize: '11px', color: '#aaa', width: '80px' }}>Speed:</label>
                              <input type="number" step="0.1" value={actor.playerProjSpeed ?? 3} onChange={(e) => updateActor(actor.id, 'playerProjSpeed', parseFloat(e.target.value) || 0)} style={{ width: '50px', background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }} />
                            </div>
                          )}
                          {actor.playerProjDirMode === 'angle' && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <label style={{ fontSize: '11px', color: '#aaa', width: '80px' }}>Angle:</label>
                              <input type="number" step="1" value={actor.playerProjAngle ?? 0} onChange={(e) => updateActor(actor.id, 'playerProjAngle', parseFloat(e.target.value) || 0)} style={{ width: '50px', background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }} />
                            </div>
                          )}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', width: '100%' }}>
                            <label style={{ fontSize: '11px', color: '#aaa', width: '80px' }}>Projectile:</label>
                            <select value={actor.playerProjectileSpriteId || ""} onChange={(e) => updateActor(actor.id, 'playerProjectileSpriteId', e.target.value ? Number(e.target.value) : null)} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }}>
                              <option value="">Default Bullet</option>
                              {savedTiles.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <label style={{ fontSize: '11px', color: '#aaa', width: '80px' }}>Interval (f):</label>
                            <input type="number" min="1" value={actor.playerFireRate ?? 15} onChange={(e) => updateActor(actor.id, 'playerFireRate', parseInt(e.target.value) || 15)} style={{ width: '50px', background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }} />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {actor.type === 'platform' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px', background: '#222', padding: '8px', borderRadius: '4px', border: '1px solid #444' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input type="checkbox" id={`jumpThrough-${actor.id}`} checked={actor.jumpThrough || false} onChange={(e) => updateActor(actor.id, 'jumpThrough', e.target.checked)} />
                        <label htmlFor={`jumpThrough-${actor.id}`} style={{ fontSize: '11px', color: '#aaa', cursor: 'pointer' }}>Jump Through</label>
                      </div>
                      {actor.jumpThrough && (
                        <div style={{ display: 'flex', gap: '15px', paddingLeft: '20px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <input type="checkbox" id={`jumpThroughUp-${actor.id}`} checked={actor.jumpThroughUp ?? true} onChange={(e) => updateActor(actor.id, 'jumpThroughUp', e.target.checked)} />
                            <label htmlFor={`jumpThroughUp-${actor.id}`} style={{ fontSize: '11px', color: '#aaa', cursor: 'pointer' }}>Jump Up</label>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <input type="checkbox" id={`jumpThroughDown-${actor.id}`} checked={actor.jumpThroughDown ?? true} onChange={(e) => updateActor(actor.id, 'jumpThroughDown', e.target.checked)} />
                            <label htmlFor={`jumpThroughDown-${actor.id}`} style={{ fontSize: '11px', color: '#aaa', cursor: 'pointer' }}>Jump Down</label>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {actor.type === 'conveyor' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px', background: '#222', padding: '8px', borderRadius: '4px', border: '1px solid #444' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ fontSize: '11px', color: '#aaa', width: '60px' }}>Direction:</label>
                        <select value={actor.conveyorDir || 'right'} onChange={(e) => updateActor(actor.id, 'conveyorDir', e.target.value)} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }}>
                          <option value="left">Left</option>
                          <option value="right">Right</option>
                          <option value="up">Up</option>
                          <option value="down">Down</option>
                        </select>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ fontSize: '11px', color: '#aaa', width: '60px' }}>Speed:</label>
                        <input type="number" step="0.1" min="0" value={actor.conveyorSpeed ?? 1} onChange={(e) => updateActor(actor.id, 'conveyorSpeed', parseFloat(e.target.value) || 0)} style={{ width: '60px', background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }} />
                      </div>
                    </div>
                  )}
 
                   {actor.type === 'pushable' && (
                     <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px', background: '#222', padding: '8px', borderRadius: '4px', border: '1px solid #444' }}>
                       <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                         <label style={{ fontSize: '11px', color: '#aaa', width: '60px' }}>Weight:</label>
                         <input type="number" step="0.5" min="0.5" value={actor.weight ?? 1} onChange={(e) => updateActor(actor.id, 'weight', parseFloat(e.target.value) || 1)} style={{ width: '60px', background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }} />
                         <span style={{ fontSize: '9px', color: '#666' }}>(1.0 = normal)</span>
                       </div>
                       <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                         <input type="checkbox" id={`squashActors-${actor.id}`} checked={actor.squashActors || false} onChange={(e) => updateActor(actor.id, 'squashActors', e.target.checked)} />
                         <label htmlFor={`squashActors-${actor.id}`} style={{ fontSize: '11px', color: '#aaa', cursor: 'pointer' }}>Squash Actors on Impact</label>
                       </div>
                       {actor.squashActors && (
                         <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingLeft: '10px' }}>
                           <label style={{ fontSize: '11px', color: '#aaa' }}>Squash Actor Types:</label>
                           <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', paddingLeft: '10px' }}>
                             {(() => {
                               const allSceneActors = [...actors, ...globalActors];
                               const typeSet = new Set(allSceneActors.map(a => a.type).filter(t => t !== 'player'));
                               const types = Array.from(typeSet);
                               const targets = actor.squashTargets || [];
                               if (types.length === 0) {
                                 return <span style={{ fontSize: '10px', color: '#666' }}>No other actors in scene</span>;
                               }
                               return types.map(type => {
                                 const isSelected = targets.includes(type);
                                 const tile = savedTiles.find(t => t.id === ACTOR_DEFAULT_TILE_MAP[type]);
                                 return (
                                   <button
                                     key={type}
                                     className="nodrag"
                                     onClick={() => {
                                       const current = actor.squashTargets || [];
                                       const next = isSelected ? current.filter(t => t !== type) : [...current, type];
                                       updateActor(actor.id, 'squashTargets', next);
                                     }}
                                     title={ACTOR_TYPE_NAMES[type] || type}
                                     style={{
                                       display: 'flex',
                                       flexDirection: 'column',
                                       alignItems: 'center',
                                       gap: '2px',
                                       padding: '4px',
                                       background: isSelected ? '#2a3a2a' : '#111',
                                       border: isSelected ? '2px solid #4CAF50' : '1px solid #444',
                                       borderRadius: '4px',
                                       cursor: 'pointer',
                                       minWidth: '40px',
                                       opacity: isSelected ? 1 : 0.7
                                     }}
                                   >
                                     {tile ? <TileIcon tile={tile} size={12} /> : <div style={{ width: 12, height: 12, background: '#444', borderRadius: '2px' }} />}
                                     <span style={{ fontSize: '8px', color: '#aaa', maxWidth: '48px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }}>
                                       {ACTOR_TYPE_NAMES[type] || type}
                                     </span>
                                   </button>
                                 );
                               });
                             })()}
                           </div>
                         </div>
                       )}
                     </div>
                   )}
 
                   {actor.type === 'enemy' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px', background: '#222', padding: '8px', borderRadius: '4px', border: '1px solid #444' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ fontSize: '11px', color: '#aaa', width: '60px' }}>HP:</label>
                        <input type="number" min="1" value={actor.enemyHp ?? 3} onChange={(e) => updateActor(actor.id, 'enemyHp', parseInt(e.target.value) || 3)} style={{ width: '50px', background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }} />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input type="checkbox" id={`isBoss-${actor.id}`} checked={actor.isBoss || false} onChange={(e) => updateActor(actor.id, 'isBoss', e.target.checked)} />
                        <label htmlFor={`isBoss-${actor.id}`} style={{ fontSize: '11px', color: '#aaa', cursor: 'pointer' }}>Is Boss (Show Health Bar)</label>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ fontSize: '11px', color: '#aaa', width: '60px' }}>Behavior:</label>
                        <select value={actor.enemyBehavior || 'patrol'} onChange={(e) => {
                          updateActor(actor.id, 'enemyBehavior', e.target.value);
                          updateActor(actor.id, 'isMoving', e.target.value !== 'idle');
                        }} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }}>
                          <option value="patrol">Patrol</option>
                          <option value="follow">Follow Player</option>
                          <option value="sine">Sine</option>
                          <option value="zigzag">Zigzag</option>
                          <option value="random">Random</option>
                          <option value="idle">Idle / Stationary</option>
                        </select>
                      </div>

                      {((actor.enemyBehavior || 'patrol') !== 'idle') && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', paddingLeft: '10px', paddingTop: '4px', borderTop: '1px solid #333' }}>
                          {actor.enemyBehavior === 'follow' && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', width: '100%', marginBottom: '4px' }}>
                              <label style={{ fontSize: '11px', color: '#aaa', width: '80px' }}>Proximity (px):</label>
                              <input type="number" min="0" value={actor.followProximity ?? 0} onChange={(e) => updateActor(actor.id, 'followProximity', parseInt(e.target.value) || 0)} style={{ width: '60px', background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }} />
                              <span style={{ fontSize: '9px', color: '#666', marginLeft: '4px' }}>(0 = always follow)</span>
                            </div>
                          )}

                          {(actor.enemyBehavior !== 'follow' || (actor.followProximity > 0)) && (
                            <>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <label style={{ fontSize: '11px', color: '#aaa' }}>Move Dir:</label>
                                <select value={actor.moveDir || actor.enemyDir || 'horizontal'} onChange={(e) => {
                                  updateActor(actor.id, 'moveDir', e.target.value);
                                  updateActor(actor.id, 'enemyDir', e.target.value);
                                  updateActor(actor.id, 'isMoving', true);
                                }} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px', minWidth: 0 }}>
                                  <option value="horizontal">Horizontal</option>
                                  <option value="vertical">Vertical</option>
                                </select>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <label style={{ fontSize: '11px', color: '#aaa' }}>Range (px):</label>
                                <input type="number" value={actor.moveAmount ?? actor.enemyRange ?? 32} onChange={(e) => {
                                  const val = parseInt(e.target.value) || 0;
                                  updateActor(actor.id, 'moveAmount', val);
                                  updateActor(actor.id, 'enemyRange', val);
                                  updateActor(actor.id, 'isMoving', true);
                                }} style={{ width: '60px', background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }} />
                              </div>
                            </>
                          )}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <label style={{ fontSize: '11px', color: '#aaa' }}>Speed:</label>
                            <input type="number" step="0.1" value={actor.moveSpeed ?? actor.enemySpeed ?? 1} onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              updateActor(actor.id, 'moveSpeed', val);
                              updateActor(actor.id, 'enemySpeed', val);
                              updateActor(actor.id, 'isMoving', true);
                            }} style={{ width: '50px', background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }} />
                          </div>
                        </div>
                      )}

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input type="checkbox" id={`enemyFire-${actor.id}`} checked={actor.enemyFireProjectiles || false} onChange={(e) => updateActor(actor.id, 'enemyFireProjectiles', e.target.checked)} />
                        <label htmlFor={`enemyFire-${actor.id}`} style={{ fontSize: '11px', color: '#aaa', cursor: 'pointer' }}>Fire Projectiles</label>
                      </div>
                      {actor.enemyFireProjectiles && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', paddingLeft: '10px', paddingTop: '4px', borderTop: '1px solid #333' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <label style={{ fontSize: '11px', color: '#aaa' }}>Projectile:</label>
                            <select value={actor.enemyProjectileSpriteId || ""} onChange={(e) => updateActor(actor.id, 'enemyProjectileSpriteId', e.target.value ? Number(e.target.value) : null)} style={{ background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px', minWidth: 0, flex: 1 }}>
                              <option value="">Default Bullet</option>
                              {savedTiles.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <label style={{ fontSize: '11px', color: '#aaa' }}>Interval (f):</label>
                            <input type="number" min="1" value={actor.enemyFireRate ?? 60} onChange={(e) => updateActor(actor.id, 'enemyFireRate', parseInt(e.target.value) || 60)} style={{ width: '50px', background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }} />
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <label style={{ fontSize: '11px', color: '#aaa' }}>Lock Axis:</label>
                            <select value={actor.enemyProjLockAxis || 'none'} onChange={(e) => updateActor(actor.id, 'enemyProjLockAxis', e.target.value)} style={{ background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px', minWidth: 0, flex: 1 }}>
                              <option value="none">None</option>
                              <option value="horizontal">Horizontal</option>
                              <option value="vertical">Vertical</option>
                            </select>
                          </div>
                        </div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderTop: '1px solid #333', paddingTop: '6px', marginTop: '4px' }}>
                        <label style={{ fontSize: '11px', color: '#aaa', width: '80px' }}>On Death:</label>
                        <select value={actor.enemyDeathScriptId || ""} onChange={(e) => updateActor(actor.id, 'enemyDeathScriptId', e.target.value ? Number(e.target.value) : null)} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }}>
                          <option value="">[Dedicated Visual Nodes]</option>
                          {customScripts.filter(cs => cs.type !== 'group').map(cs => <option key={cs.id} value={cs.id}>{cs.name}</option>)}
                        </select>
                        {actor.enemyDeathScriptId ? (
                          <button onClick={() => { setEditingCustomScriptId(actor.enemyDeathScriptId); setTool('script'); }} style={{ background: 'transparent', color: '#888', border: 'none', padding: '2px 4px', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', borderRadius: '3px', flexShrink: 0 }} title="Edit Script"><BsPencil /></button>
                        ) : (
                          <button onClick={() => { setScriptPromptName('Enemy On Death'); setScriptPrompt({ actorId: actor.id, prop: 'enemyDeathScriptId' }); }} style={{ background: 'transparent', color: '#4CAF50', border: 'none', padding: '2px 4px', cursor: 'pointer', fontSize: '15px', display: 'flex', alignItems: 'center', borderRadius: '3px', flexShrink: 0 }} title="Add Script"><BsPlus /></button>
                        )}
                      </div>
                    </div>
                  )}

                  {actor.type === 'turret' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px', background: '#222', padding: '8px', borderRadius: '4px', border: '1px solid #444' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ fontSize: '11px', color: '#aaa', width: '60px' }}>HP:</label>
                        <input type="number" min="1" value={actor.turretHp ?? 3} onChange={(e) => updateActor(actor.id, 'turretHp', parseInt(e.target.value) || 3)} style={{ width: '50px', background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }} />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input type="checkbox" id={`turretFires-${actor.id}`} checked={actor.turretFires || false} onChange={(e) => updateActor(actor.id, 'turretFires', e.target.checked)} />
                        <label htmlFor={`turretFires-${actor.id}`} style={{ fontSize: '11px', color: '#aaa', cursor: 'pointer' }}>Fire Projectiles</label>
                      </div>
                      {actor.turretFires && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', paddingLeft: '10px', paddingTop: '4px', borderTop: '1px solid #333' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', width: '100%' }}>
                            <label style={{ fontSize: '11px', color: '#aaa', width: '80px' }}>Track Mode:</label>
                            <select value={actor.turretTrackMode || 'player'} onChange={(e) => updateActor(actor.id, 'turretTrackMode', e.target.value)} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }}>
                              <option value="player">Player</option>
                              <option value="nearest">Nearest Actor</option>
                              <option value="fixed_dir">Fixed Direction</option>
                              <option value="fixed_angle">Fixed Angle</option>
                            </select>
                          </div>
                          {actor.turretTrackMode === 'fixed_dir' && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <label style={{ fontSize: '11px', color: '#aaa', width: '80px' }}>Dir Mode:</label>
                              <select value={actor.turretProjDirMode || 'horizontal'} onChange={(e) => updateActor(actor.id, 'turretProjDirMode', e.target.value)} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }}>
                                <option value="horizontal">Horizontal</option>
                                <option value="vertical">Vertical</option>
                                <option value="left">Left</option>
                                <option value="right">Right</option>
                                <option value="up">Up</option>
                                <option value="down">Down</option>
                              </select>
                            </div>
                          )}
                          {actor.turretTrackMode === 'fixed_angle' && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <label style={{ fontSize: '11px', color: '#aaa', width: '80px' }}>Angle:</label>
                              <input type="number" step="1" value={actor.turretAngle ?? 0} onChange={(e) => updateActor(actor.id, 'turretAngle', parseFloat(e.target.value) || 0)} style={{ width: '50px', background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }} />
                            </div>
                          )}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <label style={{ fontSize: '11px', color: '#aaa' }}>Proj Type:</label>
                            <select value={actor.turretProjType || 'normal'} onChange={(e) => updateActor(actor.id, 'turretProjType', e.target.value)} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }}>
                              <option value="normal">Normal (Straight)</option>
                              <option value="bouncing">Bouncing Fireball</option>
                            </select>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <label style={{ fontSize: '11px', color: '#aaa' }}>Speed:</label>
                            <input type="number" step="0.1" value={actor.turretProjSpeed ?? 2} onChange={(e) => updateActor(actor.id, 'turretProjSpeed', parseFloat(e.target.value) || 0)} style={{ width: '50px', background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }} />
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <label style={{ fontSize: '11px', color: '#aaa' }}>Vel X:</label>
                            <input type="number" step="0.1" value={actor.turretProjDx ?? 1} onChange={(e) => updateActor(actor.id, 'turretProjDx', parseFloat(e.target.value) || 0)} style={{ width: '50px', background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }} />
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <label style={{ fontSize: '11px', color: '#aaa' }}>Vel Y:</label>
                            <input type="number" step="0.1" value={actor.turretProjDy ?? 0} onChange={(e) => updateActor(actor.id, 'turretProjDy', parseFloat(e.target.value) || 0)} style={{ width: '50px', background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }} />
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <label style={{ fontSize: '11px', color: '#aaa' }}>Projectile:</label>
                            <select value={actor.turretProjectileSpriteId || ""} onChange={(e) => updateActor(actor.id, 'turretProjectileSpriteId', e.target.value ? Number(e.target.value) : null)} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }}>
                              <option value="">Default Bullet</option>
                              {savedTiles.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <label style={{ fontSize: '11px', color: '#aaa' }}>Interval (f):</label>
                            <input type="number" min="1" value={actor.turretFireRate ?? 60} onChange={(e) => updateActor(actor.id, 'turretFireRate', parseInt(e.target.value) || 60)} style={{ width: '50px', background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }} />
                          </div>
                        </div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderTop: '1px solid #333', paddingTop: '6px', marginTop: '4px' }}>
                        <label style={{ fontSize: '11px', color: '#aaa', width: '80px' }}>On Death:</label>
                        <select value={actor.turretDeathScriptId || ""} onChange={(e) => updateActor(actor.id, 'turretDeathScriptId', e.target.value ? Number(e.target.value) : null)} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }}>
                          <option value="">[Dedicated Visual Nodes]</option>
                          {customScripts.filter(cs => cs.type !== 'group').map(cs => <option key={cs.id} value={cs.id}>{cs.name}</option>)}
                        </select>
                        {actor.turretDeathScriptId ? (
                          <button onClick={() => { setEditingCustomScriptId(actor.turretDeathScriptId); setTool('script'); }} style={{ background: 'transparent', color: '#888', border: 'none', padding: '2px 4px', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', borderRadius: '3px', flexShrink: 0 }} title="Edit Script"><BsPencil /></button>
                        ) : (
                          <button onClick={() => { setScriptPromptName('Turret On Death'); setScriptPrompt({ actorId: actor.id, prop: 'turretDeathScriptId' }); }} style={{ background: 'transparent', color: '#4CAF50', border: 'none', padding: '2px 4px', cursor: 'pointer', fontSize: '15px', display: 'flex', alignItems: 'center', borderRadius: '3px', flexShrink: 0 }} title="Add Script"><BsPlus /></button>
                        )}
                      </div>
                    </div>
                  )}

                  {actor.type === 'spawner' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px', background: '#222', padding: '8px', borderRadius: '4px', border: '1px solid #444' }}>
                      <label style={{ fontSize: '11px', color: '#aaa', display: 'block' }}>Actors to Spawn:</label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {[...actors, ...globalActors].filter(a => a.id !== actor.id && a.type !== 'player' && a.type !== 'spawner').map(a => {
                          const isSelected = (actor.spawnerActorIds || []).includes(String(a.id));
                          const cols = a.spriteIds && a.spriteIds.length > 0 ? Math.max(1, Math.floor((a.width || 8) / 8)) : 1;
                          const rows = a.spriteIds && a.spriteIds.length > 0 ? Math.max(1, Math.floor((a.height || 8) / 8)) : 1;
                          const previewSize = cols <= 2 && rows <= 2 ? 12 : 8;
                          return (
                            <div
                              key={a.id}
                              className="nodrag"
                              onClick={() => {
                                const current = actor.spawnerActorIds || [];
                                const id = String(a.id);
                                const next = isSelected ? current.filter(x => x !== id) : [...current, id];
                                updateActor(actor.id, 'spawnerActorIds', next);
                              }}
                              title={`${a.name} (${a.type})`}
                              style={{
                                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
                                padding: '4px', borderRadius: '4px', cursor: 'pointer',
                                background: isSelected ? '#2a3a2a' : '#111',
                                border: isSelected ? '2px solid #4a4' : '1px solid #444',
                                opacity: isSelected ? 1 : 0.6,
                                minWidth: '40px',
                              }}
                            >
                              {a.spriteIds && a.spriteIds.length > 0 ? (
                                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, ${previewSize}px)`, gridTemplateRows: `repeat(${rows}, ${previewSize}px)` }}>
                                  {a.spriteIds.map((tId, idx) => {
                                    const actualId = tId ? (typeof tId === 'object' ? tId.id : tId) : null;
                                    const flipH = tId && typeof tId === 'object' ? tId.flipH : false;
                                    const flipV = tId && typeof tId === 'object' ? tId.flipV : false;
                                    const tile = actualId ? savedTiles.find(t => String(t.id) === String(actualId)) : null;
                                    return (
                                      <div key={idx} style={{ width: `${previewSize}px`, height: `${previewSize}px`, transform: `scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1})` }}>
                                        {tile && <TileIcon tile={tile} size={previewSize} />}
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : a.spriteId ? (
                                (() => {
                                  const tile = savedTiles.find(t => String(t.id) === String(a.spriteId));
                                  return tile ? <TileIcon tile={tile} size={previewSize * Math.max(1, Math.floor((a.width || 8) / 8))} /> : <div style={{ width: previewSize * 2, height: previewSize * 2, background: a.color || '#ff00ff', borderRadius: '2px' }} />;
                                })()
                              ) : (
                                <div style={{ width: previewSize * 2, height: previewSize * 2, background: a.color || '#ff00ff', borderRadius: '2px' }} />
                              )}
                              <span style={{ fontSize: '8px', color: '#aaa', maxWidth: '48px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }}>{a.name}</span>
                            </div>
                          );
                        })}
                      </div>
                      <div style={{ fontSize: '9px', color: '#888', marginTop: '2px' }}>Click actors to toggle. Selected actors will spawn hidden.</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                        <label style={{ fontSize: '11px', color: '#aaa', width: '100px' }}>Spawn Location:</label>
                        <select value={actor.spawnerLocationMode || 'random'} onChange={(e) => updateActor(actor.id, 'spawnerLocationMode', e.target.value)} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }}>
                          <option value="random">Random</option>
                          <option value="current">Actor's Placed Position</option>
                          <option value="spawner">Spawner's Position</option>
                        </select>
                      </div>
                      {actor.spawnerActorIds && actor.spawnerActorIds.length > 1 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                          <input type="checkbox" id={`spawnerPickRandom-${actor.id}`} checked={actor.spawnerPickRandom || false} onChange={(e) => updateActor(actor.id, 'spawnerPickRandom', e.target.checked)} style={{ accentColor: '#4CAF50' }} />
                          <label htmlFor={`spawnerPickRandom-${actor.id}`} style={{ fontSize: '11px', color: '#aaa', cursor: 'pointer' }}>Pick One at Random</label>
                        </div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                        <label style={{ fontSize: '11px', color: '#aaa', width: '100px' }}>Spawn Interval (f):</label>
                        <input type="number" min="1" value={actor.spawnerInterval ?? 60} onChange={(e) => updateActor(actor.id, 'spawnerInterval', parseInt(e.target.value) || 60)} style={{ width: '50px', background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }} />
                      </div>
                    </div>
                  )}

                  {actor.type === 'companion' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px', background: '#222', padding: '8px', borderRadius: '4px', border: '1px solid #444' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ fontSize: '11px', color: '#aaa', width: '60px' }}>Behavior:</label>
                        <select value={actor.companionBehavior || 'follow'} onChange={(e) => updateActor(actor.id, 'companionBehavior', e.target.value)} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }}>
                          <option value="follow">Follow Player</option>
                          <option value="orbit">Orbit Player</option>
                          <option value="mimic">Mimic Player</option>
                        </select>
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', paddingLeft: '10px', paddingTop: '4px', borderTop: '1px solid #333' }}>
                        {actor.companionBehavior === 'follow' && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <label style={{ fontSize: '11px', color: '#aaa' }}>Follow Dist (px):</label>
                            <input type="number" min="0" value={actor.companionFollowDistance ?? 24} onChange={(e) => updateActor(actor.id, 'companionFollowDistance', parseInt(e.target.value) || 0)} style={{ width: '60px', background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }} />
                          </div>
                        )}
                        {actor.companionBehavior === 'orbit' && (
                          <>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <label style={{ fontSize: '11px', color: '#aaa' }}>Orbit Radius (px):</label>
                              <input type="number" min="1" value={actor.companionOrbitRadius ?? 32} onChange={(e) => updateActor(actor.id, 'companionOrbitRadius', parseInt(e.target.value) || 32)} style={{ width: '60px', background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }} />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <label style={{ fontSize: '11px', color: '#aaa' }}>Orbit Speed:</label>
                              <input type="number" step="0.5" min="0.5" value={actor.companionOrbitSpeed ?? 2} onChange={(e) => updateActor(actor.id, 'companionOrbitSpeed', parseFloat(e.target.value) || 2)} style={{ width: '50px', background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }} />
                            </div>
                          </>
                        )}
                        {actor.companionBehavior === 'mimic' && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <label style={{ fontSize: '11px', color: '#aaa' }}>Delay (frames):</label>
                            <input type="number" min="1" value={actor.companionMimicDelay ?? 15} onChange={(e) => updateActor(actor.id, 'companionMimicDelay', parseInt(e.target.value) || 15)} style={{ width: '60px', background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }} />
                          </div>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <label style={{ fontSize: '11px', color: '#aaa' }}>Speed:</label>
                          <input type="number" step="0.1" value={actor.moveSpeed ?? 1.5} onChange={(e) => updateActor(actor.id, 'moveSpeed', parseFloat(e.target.value) || 0)} style={{ width: '50px', background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }} />
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input type="checkbox" id={`companionFire-${actor.id}`} checked={actor.companionFireProjectiles || false} onChange={(e) => updateActor(actor.id, 'companionFireProjectiles', e.target.checked)} />
                        <label htmlFor={`companionFire-${actor.id}`} style={{ fontSize: '11px', color: '#aaa', cursor: 'pointer' }}>Fire at Enemies</label>
                      </div>
                      {actor.companionFireProjectiles && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', paddingLeft: '10px', paddingTop: '4px', borderTop: '1px solid #333' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <label style={{ fontSize: '11px', color: '#aaa' }}>Projectile:</label>
                            <select value={actor.companionProjectileSpriteId || ""} onChange={(e) => updateActor(actor.id, 'companionProjectileSpriteId', e.target.value ? Number(e.target.value) : null)} style={{ background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px', minWidth: 0, flex: 1 }}>
                              <option value="">Default Bullet</option>
                              {savedTiles.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <label style={{ fontSize: '11px', color: '#aaa' }}>Interval (f):</label>
                            <input type="number" min="1" value={actor.companionFireRate ?? 45} onChange={(e) => updateActor(actor.id, 'companionFireRate', parseInt(e.target.value) || 45)} style={{ width: '50px', background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }} />
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <label style={{ fontSize: '11px', color: '#aaa' }}>Proj Speed:</label>
                            <input type="number" step="0.5" min="0.5" value={actor.companionProjSpeed ?? 3} onChange={(e) => updateActor(actor.id, 'companionProjSpeed', parseFloat(e.target.value) || 3)} style={{ width: '50px', background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }} />
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <label style={{ fontSize: '11px', color: '#aaa' }}>Lock Axis:</label>
                            <select value={actor.companionProjLockAxis || 'none'} onChange={(e) => updateActor(actor.id, 'companionProjLockAxis', e.target.value)} style={{ background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px', minWidth: 0, flex: 1 }}>
                              <option value="none">None</option>
                              <option value="horizontal">Horizontal</option>
                              <option value="vertical">Vertical</option>
                            </select>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {actor.type === 'pressure_plate' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px', background: '#222', padding: '8px', borderRadius: '4px', border: '1px solid #444' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ fontSize: '11px', color: '#aaa', width: '80px' }}>Linked Actor:</label>
                        <select value={actor.pressurePlateLinkedId || ""} onChange={(e) => updateActor(actor.id, 'pressurePlateLinkedId', e.target.value ? Number(e.target.value) : null)} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }}>
                          <option value="">None</option>
                          {[...actors, ...globalActors].filter(a => a.id !== actor.id).map(a => <option key={a.id} value={a.id}>{a.name} ({a.type})</option>)}
                        </select>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ fontSize: '11px', color: '#aaa', width: '80px' }}>Action:</label>
                        <select value={actor.pressurePlateAction || 'activate'} onChange={(e) => updateActor(actor.id, 'pressurePlateAction', e.target.value)} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }}>
                          <option value="activate">Activate</option>
                          <option value="deactivate">Deactivate</option>
                          <option value="toggle">Toggle</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {actor.type === 'push_target' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px', background: '#222', padding: '8px', borderRadius: '4px', border: '1px solid #444' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ fontSize: '11px', color: '#aaa', width: '80px' }}>On Complete:</label>
                        <select value={actor.pushTargetScriptId || ""} onChange={(e) => updateActor(actor.id, 'pushTargetScriptId', e.target.value ? Number(e.target.value) : null)} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }}>
                          <option value="">None</option>
                          {customScripts.filter(cs => cs.type !== 'group').map(cs => <option key={cs.id} value={cs.id}>{cs.name}</option>)}
                        </select>
                        {actor.pushTargetScriptId ? (
                          <button onClick={() => { setEditingCustomScriptId(actor.pushTargetScriptId); setTool('script'); }} style={{ background: 'transparent', color: '#888', border: 'none', padding: '2px 4px', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', borderRadius: '3px', flexShrink: 0 }} title="Edit Script"><BsPencil /></button>
                        ) : (
                          <button onClick={() => { setScriptPromptName('Target Complete'); setScriptPrompt({ actorId: actor.id, prop: 'pushTargetScriptId' }); }} style={{ background: 'transparent', color: '#4CAF50', border: 'none', padding: '2px 4px', cursor: 'pointer', fontSize: '15px', display: 'flex', alignItems: 'center', borderRadius: '3px', flexShrink: 0 }} title="Add Script"><BsPlus /></button>
                        )}
                      </div>
                    </div>
                  )}

                  {actor.type === 'teleporter' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px', background: '#222', padding: '8px', borderRadius: '4px', border: '1px solid #444' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ fontSize: '11px', color: '#aaa', width: '80px' }}>Linked Portal:</label>
                        <select value={actor.teleporterLinkedId || ""} onChange={(e) => updateActor(actor.id, 'teleporterLinkedId', e.target.value ? Number(e.target.value) : null)} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }}>
                          <option value="">None</option>
                          {[...actors, ...globalActors].filter(a => a.id !== actor.id && a.type === 'teleporter').map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                      </div>
                    </div>
                  )}

                  {actor.type === 'crumbling_platform' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px', background: '#222', padding: '8px', borderRadius: '4px', border: '1px solid #444' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ fontSize: '11px', color: '#aaa', width: '80px' }}>Crumble (f):</label>
                        <input type="number" min="1" value={actor.crumbleTime ?? 30} onChange={(e) => updateActor(actor.id, 'crumbleTime', parseInt(e.target.value) || 30)} style={{ width: '60px', background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }} />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ fontSize: '11px', color: '#aaa', width: '80px' }}>Respawn (f):</label>
                        <input type="number" min="1" value={actor.respawnTime ?? 120} onChange={(e) => updateActor(actor.id, 'respawnTime', parseInt(e.target.value) || 120)} style={{ width: '60px', background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }} />
                      </div>
                    </div>
                  )}

                  {actor.type === 'pass_wall' && (() => {
                    const animOptions = [{ value: 'idle', label: 'Idle' }];
                    if (actor.walkAnimId) animOptions.push({ value: 'walk', label: 'Walk' });
                    if (actor.jumpAnimId) animOptions.push({ value: 'jump', label: 'Jump' });
                    if (actor.customAnimIds) {
                      actor.customAnimIds.forEach(id => {
                        const anim = animations.find(a => a && a.id === id);
                        if (anim) animOptions.push({ value: String(id), label: anim.name || `Custom (${id})` });
                      });
                    }
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px', background: '#222', padding: '8px', borderRadius: '4px', border: '1px solid #444' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <label style={{ fontSize: '11px', color: '#aaa', width: '90px' }}>Solid Mode:</label>
                          <select value={actor.passWallMode || 'passes'} onChange={(e) => {
                            const val = e.target.value;
                            updateActor(actor.id, 'passWallMode', val);
                            if (val === 'frames' && !actor.solidAfterFrames) {
                              updateActor(actor.id, 'solidAfterFrames', 60);
                            }
                          }} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }}>
                            <option value="passes">Solid after X passes</option>
                            <option value="frames">Solid after X frames</option>
                          </select>
                        </div>
                        {(actor.passWallMode || 'passes') === 'passes' ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <label style={{ fontSize: '11px', color: '#aaa', width: '90px' }}>Pass Count:</label>
                            <input type="number" min="0" value={actor.passCount ?? 0} onChange={(e) => updateActor(actor.id, 'passCount', parseInt(e.target.value) || 0)} style={{ width: '60px', background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }} />
                            <span style={{ fontSize: '9px', color: '#888' }}>(0 = solid wall)</span>
                          </div>
                        ) : (
                          <>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <label style={{ fontSize: '11px', color: '#aaa', width: '90px' }}>Frames:</label>
                              <input type="number" min="1" value={actor.solidAfterFrames ?? 60} onChange={(e) => updateActor(actor.id, 'solidAfterFrames', parseInt(e.target.value) || 60)} style={{ width: '60px', background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }} />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <input type="checkbox" id={`startTouch-${actor.id}`} checked={actor.passWallStartOnTouch || false} onChange={(e) => updateActor(actor.id, 'passWallStartOnTouch', e.target.checked)} style={{ cursor: 'pointer' }} />
                              <label htmlFor={`startTouch-${actor.id}`} style={{ fontSize: '11px', color: '#aaa', cursor: 'pointer' }}>Start timer on touch</label>
                            </div>
                          </>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <label style={{ fontSize: '11px', color: '#aaa', width: '90px' }}>Passable Anim:</label>
                          <select value={actor.passWallPassAnim || 'idle'} onChange={(e) => updateActor(actor.id, 'passWallPassAnim', e.target.value)} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }}>
                            {animOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                          </select>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <label style={{ fontSize: '11px', color: '#aaa', width: '90px' }}>Solid Anim:</label>
                          <select value={actor.passWallSolidAnim || 'idle'} onChange={(e) => updateActor(actor.id, 'passWallSolidAnim', e.target.value)} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }}>
                            {animOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                          </select>
                        </div>
                      </div>
                    );
                  })()}

                  {actor.type === 'ice_block' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px', background: '#222', padding: '8px', borderRadius: '4px', border: '1px solid #444' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ fontSize: '11px', color: '#aaa', width: '80px' }}>Friction:</label>
                        <input type="number" step="0.01" min="0" max="1" value={actor.iceFriction ?? 0.05} onChange={(e) => updateActor(actor.id, 'iceFriction', parseFloat(e.target.value) || 0.05)} style={{ width: '60px', background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }} />
                        <span style={{ fontSize: '9px', color: '#666' }}>(lower = more slippery)</span>
                      </div>
                    </div>
                  )}

                  {actor.type === 'chest' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px', background: '#222', padding: '8px', borderRadius: '4px', border: '1px solid #444' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ fontSize: '11px', color: '#aaa', width: '80px' }}>On Open:</label>
                        <select value={actor.chestOpenScriptId || ""} onChange={(e) => updateActor(actor.id, 'chestOpenScriptId', e.target.value ? Number(e.target.value) : null)} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }}>
                          <option value="">None</option>
                          {customScripts.filter(cs => cs.type !== 'group').map(cs => <option key={cs.id} value={cs.id}>{cs.name}</option>)}
                        </select>
                      </div>
                    </div>
                  )}

                  {actor.type === 'torch' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px', background: '#222', padding: '8px', borderRadius: '4px', border: '1px solid #444' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ fontSize: '11px', color: '#aaa', width: '80px' }}>Light Radius:</label>
                        <input type="number" min="0" value={actor.torchLightRadius ?? 40} onChange={(e) => updateActor(actor.id, 'torchLightRadius', parseInt(e.target.value) || 40)} style={{ width: '60px', background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }} />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ fontSize: '11px', color: '#aaa', width: '80px' }}>Flicker Speed:</label>
                        <input type="number" step="0.1" min="0" value={actor.torchFlickerSpeed ?? 0.5} onChange={(e) => updateActor(actor.id, 'torchFlickerSpeed', parseFloat(e.target.value) || 0.5)} style={{ width: '60px', background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }} />
                      </div>
                    </div>
                  )}

                  {actor.type === 'save_point' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px', background: '#222', padding: '8px', borderRadius: '4px', border: '1px solid #444' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ fontSize: '11px', color: '#aaa', width: '80px' }}>On Save:</label>
                        <select value={actor.savePointScriptId || ""} onChange={(e) => updateActor(actor.id, 'savePointScriptId', e.target.value ? Number(e.target.value) : null)} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }}>
                          <option value="">None</option>
                          {customScripts.filter(cs => cs.type !== 'group').map(cs => <option key={cs.id} value={cs.id}>{cs.name}</option>)}
                        </select>
                      </div>
                    </div>
                  )}

                  {actor.type === 'xp_orb' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px', background: '#222', padding: '8px', borderRadius: '4px', border: '1px solid #444' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ fontSize: '11px', color: '#aaa', width: '80px' }}>XP Value:</label>
                        <input type="number" min="1" value={actor.xpValue ?? 1} onChange={(e) => updateActor(actor.id, 'xpValue', parseInt(e.target.value) || 1)} style={{ width: '60px', background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }} />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ fontSize: '11px', color: '#aaa', width: '80px' }}>Variable:</label>
                        <input type="text" value={actor.xpVarName || 'PLAYER_XP'} onChange={(e) => updateActor(actor.id, 'xpVarName', e.target.value)} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }} />
                      </div>
                    </div>
                  )}

                  {actor.type === 'shield' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px', background: '#222', padding: '8px', borderRadius: '4px', border: '1px solid #444' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ fontSize: '11px', color: '#aaa', width: '80px' }}>Duration (f):</label>
                        <input type="number" min="1" value={actor.shieldDuration ?? 300} onChange={(e) => updateActor(actor.id, 'shieldDuration', parseInt(e.target.value) || 300)} style={{ width: '60px', background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }} />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input type="checkbox" id={`shieldVisual-${actor.id}`} checked={actor.shieldVisual ?? true} onChange={(e) => updateActor(actor.id, 'shieldVisual', e.target.checked)} />
                        <label htmlFor={`shieldVisual-${actor.id}`} style={{ fontSize: '11px', color: '#aaa', cursor: 'pointer' }}>Show Shield Visual</label>
                      </div>
                    </div>
                  )}

                  {actor.type === 'ammo_pickup' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px', background: '#222', padding: '8px', borderRadius: '4px', border: '1px solid #444' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ fontSize: '11px', color: '#aaa', width: '80px' }}>Ammo Amount:</label>
                        <input type="number" min="1" value={actor.ammoAmount ?? 5} onChange={(e) => updateActor(actor.id, 'ammoAmount', parseInt(e.target.value) || 5)} style={{ width: '60px', background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }} />
                      </div>
                    </div>
                  )}

                  {actor.type === 'grenade' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px', background: '#222', padding: '8px', borderRadius: '4px', border: '1px solid #444' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ fontSize: '11px', color: '#aaa', width: '80px' }}>Quantity:</label>
                        <input type="number" min="1" value={actor.grenadeQuantity ?? 3} onChange={(e) => updateActor(actor.id, 'grenadeQuantity', parseInt(e.target.value) || 3)} style={{ width: '60px', background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }} />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ fontSize: '11px', color: '#aaa', width: '80px' }}>Throw Button:</label>
                        <select value={actor.grenadeThrowButton || 'b'} onChange={(e) => updateActor(actor.id, 'grenadeThrowButton', e.target.value)} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }}>
                          <option value="b">B Button</option>
                          <option value="a">A Button</option>
                          <option value="l">L Button</option>
                          <option value="r">R Button</option>
                        </select>
                      </div>
                    </div>
                  )}


                  {actor.type === 'wall_jump_surface' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px', background: '#222', padding: '8px', borderRadius: '4px', border: '1px solid #444' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ fontSize: '11px', color: '#aaa', width: '80px' }}>Wall Side:</label>
                        <select value={actor.wallJumpSide || 'both'} onChange={(e) => updateActor(actor.id, 'wallJumpSide', e.target.value)} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }}>
                          <option value="both">Both Sides</option>
                          <option value="left">Left Only</option>
                          <option value="right">Right Only</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {actor.type === 'one_way_wall' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px', background: '#222', padding: '8px', borderRadius: '4px', border: '1px solid #444' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ fontSize: '11px', color: '#aaa', width: '80px' }}>Pass From:</label>
                        <select value={actor.oneWayDirection || 'right'} onChange={(e) => updateActor(actor.id, 'oneWayDirection', e.target.value)} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }}>
                          <option value="left">Left</option>
                          <option value="right">Right</option>
                          <option value="up">Up</option>
                          <option value="down">Down</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {actor.type === 'magnet' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px', background: '#222', padding: '8px', borderRadius: '4px', border: '1px solid #444' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ fontSize: '11px', color: '#aaa', width: '80px' }}>Duration (f):</label>
                        <input type="number" min="1" value={actor.magnetDuration ?? 300} onChange={(e) => updateActor(actor.id, 'magnetDuration', parseInt(e.target.value) || 300)} style={{ width: '60px', background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }} />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ fontSize: '11px', color: '#aaa', width: '80px' }}>Radius:</label>
                        {(actor.useVarMagnetRadius ?? false) ? (
                          <select value={actor.varMagnetRadius || ''} onChange={(e) => updateActor(actor.id, 'varMagnetRadius', e.target.value)} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px', minWidth: 0 }}>
                            <option value="">Select Var</option>
                            {variables.filter(v => v.type !== 'group').map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
                          </select>
                        ) : (
                          <input type="number" min="1" value={actor.magnetRadius ?? 32} onChange={(e) => updateActor(actor.id, 'magnetRadius', parseInt(e.target.value) || 32)} style={{ width: '50px', background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }} />
                        )}
                        <button onClick={(e) => { e.stopPropagation(); updateActor(actor.id, 'useVarMagnetRadius', !(actor.useVarMagnetRadius ?? false)); }} title="Toggle Variable" style={{ background: (actor.useVarMagnetRadius ?? false) ? '#4CAF50' : '#333', color: '#fff', border: 'none', borderRadius: '3px', padding: '4px 6px', cursor: 'pointer', fontSize: '10px' }}>V</button>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ fontSize: '11px', color: '#aaa', width: '80px' }}>Strength:</label>
                        {(actor.useVarMagnetStrength ?? false) ? (
                          <select value={actor.varMagnetStrength || ''} onChange={(e) => updateActor(actor.id, 'varMagnetStrength', e.target.value)} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px', minWidth: 0 }}>
                            <option value="">Select Var</option>
                            {variables.filter(v => v.type !== 'group').map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
                          </select>
                        ) : (
                          <input type="number" step="0.1" min="0.1" value={actor.magnetStrength ?? 1} onChange={(e) => updateActor(actor.id, 'magnetStrength', parseFloat(e.target.value) || 1)} style={{ width: '50px', background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }} />
                        )}
                        <button onClick={(e) => { e.stopPropagation(); updateActor(actor.id, 'useVarMagnetStrength', !(actor.useVarMagnetStrength ?? false)); }} title="Toggle Variable" style={{ background: (actor.useVarMagnetStrength ?? false) ? '#4CAF50' : '#333', color: '#fff', border: 'none', borderRadius: '3px', padding: '4px 6px', cursor: 'pointer', fontSize: '10px' }}>V</button>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '11px', color: '#aaa' }}>Attract Actor Types:</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', paddingLeft: '10px' }}>
                          {(() => {
                            const allSceneActors = [...actors, ...globalActors];
                            const typeSet = new Set(allSceneActors.map(a => a.type).filter(t => t !== 'player'));
                            const types = Array.from(typeSet);
                            const targets = actor.magnetTargets || [];
                            if (types.length === 0) {
                              return <span style={{ fontSize: '10px', color: '#666' }}>No other actors in scene</span>;
                            }
                            return types.map(type => {
                              const isSelected = targets.includes(type);
                              const tile = savedTiles.find(t => t.id === ACTOR_DEFAULT_TILE_MAP[type]);
                              return (
                                <button
                                  key={type}
                                  className="nodrag"
                                  onClick={() => {
                                    const current = actor.magnetTargets || [];
                                    const next = isSelected ? current.filter(t => t !== type) : [...current, type];
                                    updateActor(actor.id, 'magnetTargets', next);
                                  }}
                                  title={ACTOR_TYPE_NAMES[type] || type}
                                  style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: '2px',
                                    padding: '4px',
                                    background: isSelected ? '#2a3a2a' : '#111',
                                    border: isSelected ? '2px solid #4CAF50' : '1px solid #444',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    minWidth: '40px',
                                    opacity: isSelected ? 1 : 0.7
                                  }}
                                >
                                  {tile ? <TileIcon tile={tile} size={12} /> : <div style={{ width: 12, height: 12, background: '#444', borderRadius: '2px' }} />}
                                  <span style={{ fontSize: '8px', color: '#aaa', maxWidth: '48px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }}>
                                    {ACTOR_TYPE_NAMES[type] || type}
                                  </span>
                                </button>
                              );
                            });
                          })()}
                        </div>
                      </div>
                    </div>
                  )}

                  {actor.type === 'gravity_flip_zone' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px', background: '#222', padding: '8px', borderRadius: '4px', border: '1px solid #444' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ fontSize: '11px', color: '#aaa', width: '80px' }}>On Exit:</label>
                        <select value={actor.gravityFlipExitScriptId || ""} onChange={(e) => updateActor(actor.id, 'gravityFlipExitScriptId', e.target.value ? Number(e.target.value) : null)} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }}>
                          <option value="">None</option>
                          {customScripts.filter(cs => cs.type !== 'group').map(cs => <option key={cs.id} value={cs.id}>{cs.name}</option>)}
                        </select>
                      </div>
                    </div>
                  )}



                  {actor.type === 'boost_pad' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px', background: '#222', padding: '8px', borderRadius: '4px', border: '1px solid #444' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ fontSize: '11px', color: '#aaa', width: '80px' }}>Boost Amount:</label>
                        <input type="number" step="0.1" min="0.1" value={actor.boostAmount ?? 2} onChange={(e) => updateActor(actor.id, 'boostAmount', parseFloat(e.target.value) || 2)} style={{ width: '60px', background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }} />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ fontSize: '11px', color: '#aaa', width: '80px' }}>Duration (f):</label>
                        <input type="number" min="1" value={actor.boostDuration ?? 30} onChange={(e) => updateActor(actor.id, 'boostDuration', parseInt(e.target.value) || 30)} style={{ width: '60px', background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }} />
                      </div>
                    </div>
                  )}

                  {actor.type === 'checkpoint_gate' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px', background: '#222', padding: '8px', borderRadius: '4px', border: '1px solid #444' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ fontSize: '11px', color: '#aaa', width: '80px' }}>Checkpoint #:</label>
                        <input type="number" min="0" value={actor.checkpointIndex ?? 0} onChange={(e) => updateActor(actor.id, 'checkpointIndex', parseInt(e.target.value) || 0)} style={{ width: '60px', background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }} />
                      </div>
                    </div>
                  )}

                  {(actor.type === 'platform' || actor.type === 'ladder' || actor.type === 'bonus' || actor.type === 'spring' || actor.type === 'hazard' || actor.type === 'destructible' || actor.type === 'key' || actor.type === 'door' || actor.type === 'powerup' || actor.type === 'sign' || actor.type === 'checkpoint' || actor.type === 'turret' || actor.type === 'spawner' || actor.type === 'ammo_pickup' || actor.type === 'xp_orb' || actor.type === 'shield' || actor.type === 'grenade' || actor.type === 'magnet' || actor.type === 'health_pickup') && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px', background: '#222', padding: '8px', borderRadius: '4px', border: '1px solid #444' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input type="checkbox" id={`isMoving-${actor.id}`} checked={actor.isMoving ?? (actor.type === 'movingPlatform')} onChange={(e) => updateActor(actor.id, 'isMoving', e.target.checked)} />
                        <label htmlFor={`isMoving-${actor.id}`} style={{ fontSize: '11px', color: '#aaa', cursor: 'pointer' }}>Is Moving</label>
                      </div>
                      {(actor.isMoving ?? (actor.type === 'movingPlatform')) && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', paddingLeft: '10px', paddingTop: '4px', borderTop: '1px solid #333' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <label style={{ fontSize: '11px', color: '#aaa' }}>Move Dir:</label>
                            <select value={actor.moveDir || 'horizontal'} onChange={(e) => {
                              updateActor(actor.id, 'moveDir', e.target.value);
                              if (e.target.value === 'bounce') {
                                updateActor(actor.id, 'moveAmount', 6);
                                updateActor(actor.id, 'moveSpeed', 0.3);
                              }
                            }} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px', minWidth: 0 }}>
                              <option value="horizontal">Horizontal</option>
                              <option value="vertical">Vertical</option>
                              <option value="bounce">Bounce</option>
                              <option value="sine">Sine</option>
                              <option value="zigzag">Zigzag</option>
                              <option value="random">Random</option>
                            </select>
                          </div>
                          {(actor.moveDir || 'horizontal') !== 'bounce' && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <label style={{ fontSize: '11px', color: '#aaa' }}>Range (px):</label>
                            <input type="number" value={actor.moveAmount ?? 32} onChange={(e) => updateActor(actor.id, 'moveAmount', parseInt(e.target.value) || 0)} style={{ width: '60px', background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }} />
                          </div>
                          )}
                          {(actor.moveDir || 'horizontal') !== 'bounce' && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <label style={{ fontSize: '11px', color: '#aaa' }}>Speed:</label>
                            <input type="number" step="0.1" value={actor.moveSpeed ?? 1} onChange={(e) => updateActor(actor.id, 'moveSpeed', parseFloat(e.target.value) || 0)} style={{ width: '50px', background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }} />
                          </div>
                          )}
                          {actor.type === 'platform' && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', marginTop: '4px' }}>
                              <input type="checkbox" id={`moveOnlyOnStand-${actor.id}`} checked={actor.moveOnlyOnStand || false} onChange={(e) => updateActor(actor.id, 'moveOnlyOnStand', e.target.checked)} />
                              <label htmlFor={`moveOnlyOnStand-${actor.id}`} style={{ fontSize: '11px', color: '#aaa', cursor: 'pointer' }}>Move only when stood on</label>
                            </div>
                          )}
                        </div>
                      )}

                      {actor.type === 'key' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderTop: '1px solid #333', paddingTop: '6px', marginTop: '4px' }}>
                          <label style={{ fontSize: '11px', color: '#aaa', width: '80px' }}>Unlocks Door:</label>
                          <select value={actor.unlockDoorActorId || ""} onChange={(e) => updateActor(actor.id, 'unlockDoorActorId', e.target.value ? Number(e.target.value) : null)} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }}>
                            <option value="">[Generic Door / Any]</option>
                            {[...actors, ...globalActors].filter(a => a.type === 'door' && a.id !== actor.id).map(d => (
                              <option key={d.id} value={d.id}>{d.name}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      {actor.type === 'door' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderTop: '1px solid #333', paddingTop: '6px', marginTop: '4px' }}>
                          <label style={{ fontSize: '11px', color: '#aaa', width: '80px' }}>On Unlock:</label>
                          <select value={actor.doorUnlockScriptId || ""} onChange={(e) => updateActor(actor.id, 'doorUnlockScriptId', e.target.value ? Number(e.target.value) : null)} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }}>
                            <option value="">[Dedicated Visual Nodes]</option>
                            {customScripts.filter(cs => cs.type !== 'group').map(cs => <option key={cs.id} value={cs.id}>{cs.name}</option>)}
                          </select>
                          {actor.doorUnlockScriptId ? (
                            <button onClick={() => { setEditingCustomScriptId(actor.doorUnlockScriptId); setTool('script'); }} style={{ background: 'transparent', color: '#888', border: 'none', padding: '2px 4px', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', borderRadius: '3px', flexShrink: 0 }} title="Edit Script"><BsPencil /></button>
                          ) : (
                            <button onClick={() => { setScriptPromptName('Door On Unlock'); setScriptPrompt({ actorId: actor.id, prop: 'doorUnlockScriptId' }); }} style={{ background: 'transparent', color: '#4CAF50', border: 'none', padding: '2px 4px', cursor: 'pointer', fontSize: '15px', display: 'flex', alignItems: 'center', borderRadius: '3px', flexShrink: 0 }} title="Add Script"><BsPlus /></button>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {actor.type === 'checkpoint' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px', background: '#222', padding: '8px', borderRadius: '4px', border: '1px solid #444' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ fontSize: '11px', color: '#aaa', width: '100px' }}>Activate on Touch:</label>
                        <input type="checkbox" checked={actor.checkpointTouchActivate || false} onChange={(e) => updateActor(actor.id, 'checkpointTouchActivate', e.target.checked)} />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ fontSize: '11px', color: '#aaa', width: '100px' }}>Default Active:</label>
                        <input type="checkbox" checked={actor.checkpointDefaultActive || false} onChange={(e) => updateActor(actor.id, 'checkpointDefaultActive', e.target.checked)} />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ fontSize: '11px', color: '#aaa', width: '100px' }}>Active Tint:</label>
                        <PaletteColorPicker
                          selectedColor={actor.checkpointActiveTint ?? null}
                          onChange={(color) => updateActor(actor.id, 'checkpointActiveTint', color)}
                          recentColors={recentColors || []}
                          label="Active Tint"
                          allowTransparent={true}
                        />
                      </div>
                    </div>
                  )}

                  {actor.type === 'spring' && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px', background: '#222', padding: '8px', borderRadius: '4px', border: '1px solid #444' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <label style={{ fontSize: '11px', color: '#aaa' }}>Bounce Force:</label>
                        <input type="number" step="0.5" value={actor.bounceForce ?? -8} onChange={(e) => updateActor(actor.id, 'bounceForce', parseFloat(e.target.value) || -8)} style={{ width: '60px', background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }} />
                      </div>
                    </div>
                  )}

                  {actor.type === 'destructible' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px', background: '#222', padding: '8px', borderRadius: '4px', border: '1px solid #444' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ fontSize: '11px', color: '#aaa', width: '80px' }}>HP:</label>
                        <input type="number" min="1" value={actor.destructibleHp ?? 1} onChange={(e) => updateActor(actor.id, 'destructibleHp', parseInt(e.target.value) || 1)} style={{ width: '50px', background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }} />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ fontSize: '11px', color: '#aaa', width: '80px' }}>Broken By:</label>
                        <select value={actor.destructibleBreakBy || 'any'} onChange={(e) => updateActor(actor.id, 'destructibleBreakBy', e.target.value)} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }}>
                          <option value="any">Any</option>
                          <option value="stomp">Stomp</option>
                          <option value="below">Hit From Below</option>
                          <option value="projectile">Player Projectile</option>
                        </select>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ fontSize: '11px', color: '#aaa', width: '80px' }}>Spawn Drop:</label>
                        <select value={actor.destructibleDropActorId || ""} onChange={(e) => updateActor(actor.id, 'destructibleDropActorId', e.target.value || null)} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px', minWidth: 0 }}>
                          <option value="">None</option>
                          {[...actors, ...globalActors].filter(a => a.id !== actor.id).map(a => <option key={a.id} value={a.id}>{a.name} ({a.type})</option>)}
                        </select>
                      </div>
                    </div>
                  )}

                  {actor.type === 'powerup' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px', background: '#222', padding: '8px', borderRadius: '4px', border: '1px solid #444' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ fontSize: '11px', color: '#aaa', width: '80px' }}>Subtype:</label>
                        <select value={actor.powerupType || 'shield'} onChange={(e) => updateActor(actor.id, 'powerupType', e.target.value)} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }}>
                          <option value="shield">Shield (Invincible)</option>
                          <option value="speed">Speed Boost</option>
                        </select>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ fontSize: '11px', color: '#aaa', width: '80px' }}>Duration (f):</label>
                        <input type="number" min="1" value={actor.powerupDuration ?? 300} onChange={(e) => updateActor(actor.id, 'powerupDuration', parseInt(e.target.value) || 300)} style={{ width: '60px', background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }} />
                      </div>
                    </div>
                  )}

                  {actor.type === 'npc' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px', background: '#222', padding: '8px', borderRadius: '4px', border: '1px solid #444' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ fontSize: '11px', color: '#aaa', width: '60px' }}>Behavior:</label>
                        <select value={actor.npcBehavior || 'wander'} onChange={(e) => updateActor(actor.id, 'npcBehavior', e.target.value)} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }}>
                          <option value="wander">Wander / Random</option>
                          <option value="follow">Follow Player</option>
                          <option value="sine">Sine</option>
                          <option value="zigzag">Zigzag</option>
                          <option value="random">Random</option>
                          <option value="idle">Idle / Stationary</option>
                        </select>
                      </div>

                      {((actor.npcBehavior || 'wander') !== 'idle') && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', paddingLeft: '10px', paddingTop: '4px', borderTop: '1px solid #333' }}>
                          {actor.npcBehavior === 'follow' && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', width: '100%', marginBottom: '4px' }}>
                            <label style={{ fontSize: '11px', color: '#aaa', width: '80px' }}>Proximity (px):</label>
                            <input type="number" min="0" value={actor.followProximity ?? 0} onChange={(e) => updateActor(actor.id, 'followProximity', parseInt(e.target.value) || 0)} style={{ width: '60px', background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }} />
                            <span style={{ fontSize: '9px', color: '#666', marginLeft: '4px' }}>(0 = always follow)</span>
                          </div>
                          )}

                          {['sine', 'zigzag'].includes(actor.npcBehavior) && (
                            <>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <label style={{ fontSize: '11px', color: '#aaa' }}>Move Dir:</label>
                                <select value={actor.moveDir || 'horizontal'} onChange={(e) => {
                                  updateActor(actor.id, 'moveDir', e.target.value);
                                  updateActor(actor.id, 'isMoving', true);
                                }} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px', minWidth: 0 }}>
                                  <option value="horizontal">Horizontal</option>
                                  <option value="vertical">Vertical</option>
                                </select>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <label style={{ fontSize: '11px', color: '#aaa' }}>Range (px):</label>
                                <input type="number" value={actor.moveAmount ?? 32} onChange={(e) => {
                                  const val = parseInt(e.target.value) || 0;
                                  updateActor(actor.id, 'moveAmount', val);
                                  updateActor(actor.id, 'isMoving', true);
                                }} style={{ width: '60px', background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }} />
                              </div>
                            </>
                          )}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <label style={{ fontSize: '11px', color: '#aaa' }}>Speed:</label>
                            <input type="number" step="0.1" value={actor.moveSpeed ?? 1} onChange={(e) => updateActor(actor.id, 'moveSpeed', parseFloat(e.target.value) || 0)} style={{ width: '50px', background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }} />
                          </div>
                        </div>
                      )}
        </div>
                  )}

                    {actor.type !== 'player' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px', background: '#222', padding: '8px', borderRadius: '4px', border: '1px solid #444' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ fontSize: '11px', color: '#aaa', width: '80px' }}>On Hit:</label>
                        <select value={actor.onHitScriptId || ""} onChange={(e) => updateActor(actor.id, 'onHitScriptId', e.target.value ? Number(e.target.value) : null)} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }}>
                          <option value="">{actor.type === 'sign' ? 'None' : '[None / Default]'}</option>
                          {customScripts.filter(cs => cs.type !== 'group').map(cs => <option key={cs.id} value={cs.id}>{cs.name}</option>)}
                        </select>
                        {actor.onHitScriptId ? (
                          <button onClick={() => { setEditingCustomScriptId(actor.onHitScriptId); setTool('script'); }} style={{ background: 'transparent', color: '#888', border: 'none', padding: '2px 4px', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', borderRadius: '3px', flexShrink: 0 }} title="Edit Script"><BsPencil /></button>
                        ) : (
                          <button onClick={() => { setScriptPromptName('On Hit'); setScriptPrompt({ actorId: actor.id, prop: 'onHitScriptId' }); }} style={{ background: 'transparent', color: '#4CAF50', border: 'none', padding: '2px 4px', cursor: 'pointer', fontSize: '15px', display: 'flex', alignItems: 'center', borderRadius: '3px', flexShrink: 0 }} title="Add Script"><BsPlus /></button>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ fontSize: '11px', color: '#aaa', width: '80px' }}>On Interact:</label>
                        <select value={actor.onInteractScriptId || ""} onChange={(e) => updateActor(actor.id, 'onInteractScriptId', e.target.value ? Number(e.target.value) : null)} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }}>
                          <option value="">{actor.type === 'sign' ? 'None' : '[None / Default]'}</option>
                          {customScripts.filter(cs => cs.type !== 'group').map(cs => <option key={cs.id} value={cs.id}>{cs.name}</option>)}
                        </select>
                        {actor.onInteractScriptId ? (
                          <button onClick={() => { setEditingCustomScriptId(actor.onInteractScriptId); setTool('script'); }} style={{ background: 'transparent', color: '#888', border: 'none', padding: '2px 4px', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', borderRadius: '3px', flexShrink: 0 }} title="Edit Script"><BsPencil /></button>
                        ) : (
                          <button onClick={() => { setScriptPromptName('On Interact'); setScriptPrompt({ actorId: actor.id, prop: 'onInteractScriptId' }); }} style={{ background: 'transparent', color: '#4CAF50', border: 'none', padding: '2px 4px', cursor: 'pointer', fontSize: '15px', display: 'flex', alignItems: 'center', borderRadius: '3px', flexShrink: 0 }} title="Add Script"><BsPlus /></button>
                        )}
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); setDesignerActorId(actor.id); }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#0078d4'; e.currentTarget.style.color = '#fff'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#0078d4'; }}
                      style={{
                        flex: 1,
                        background: 'transparent',
                        color: '#0078d4',
                        border: '1px solid #0078d4',
                        padding: '6px',
                        fontSize: '11px',
                        outline: 'none',
                        borderRadius: '3px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        textAlign: 'center'
                      }}
                    >
                      Design Sprite
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <label style={{ fontSize: '11px', color: '#aaa' }}>X (tile):</label>
                      {actor.useVarX ? (
                        <select value={actor.varX || ''} onChange={(e) => updateActor(actor.id, 'varX', e.target.value)} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px', minWidth: 0 }}>
                          <option value="">Select Var</option>
                          {variables.filter(v => v.type !== 'group').map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
                        </select>
                      ) : (
                        <input type="number" value={Math.round(actor.x / 8)} onChange={(e) => updateActor(actor.id, 'x', (parseInt(e.target.value) || 0) * 8)} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px', minWidth: 0 }} />
                      )}
                      <button onClick={(e) => { e.stopPropagation(); updateActor(actor.id, 'useVarX', !actor.useVarX); }} title="Toggle Variable" style={{ background: actor.useVarX ? '#4CAF50' : '#333', color: '#fff', border: 'none', borderRadius: '3px', padding: '4px 6px', cursor: 'pointer', fontSize: '10px' }}>V</button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <label style={{ fontSize: '11px', color: '#aaa' }}>Y (tile):</label>
                      {actor.useVarY ? (
                        <select value={actor.varY || ''} onChange={(e) => updateActor(actor.id, 'varY', e.target.value)} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px', minWidth: 0 }}>
                          <option value="">Select Var</option>
                          {variables.filter(v => v.type !== 'group').map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
                        </select>
                      ) : (
                        <input type="number" value={Math.round(actor.y / 8)} onChange={(e) => updateActor(actor.id, 'y', (parseInt(e.target.value) || 0) * 8)} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px', minWidth: 0 }} />
                      )}
                      <button onClick={(e) => { e.stopPropagation(); updateActor(actor.id, 'useVarY', !actor.useVarY); }} title="Toggle Variable" style={{ background: actor.useVarY ? '#4CAF50' : '#333', color: '#fff', border: 'none', borderRadius: '3px', padding: '4px 6px', cursor: 'pointer', fontSize: '10px' }}>V</button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <label style={{ fontSize: '11px', color: '#aaa' }}>ScaleX:</label>
                      {actor.useVarScaleX ? (
                        <select value={actor.varScaleX || ''} onChange={(e) => updateActor(actor.id, 'varScaleX', e.target.value)} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px', minWidth: 0 }}>
                          <option value="">Select Var</option>
                          {variables.filter(v => v.type !== 'group').map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
                        </select>
                      ) : (
                        <input type="number" step="0.1" value={actor.scaleX ?? 1} onChange={(e) => updateActor(actor.id, 'scaleX', parseFloat(e.target.value) || 1)} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px', minWidth: 0 }} />
                      )}
                      <button onClick={(e) => { e.stopPropagation(); updateActor(actor.id, 'useVarScaleX', !actor.useVarScaleX); }} title="Toggle Variable" style={{ background: actor.useVarScaleX ? '#4CAF50' : '#333', color: '#fff', border: 'none', borderRadius: '3px', padding: '4px 6px', cursor: 'pointer', fontSize: '10px' }}>V</button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <label style={{ fontSize: '11px', color: '#aaa' }}>ScaleY:</label>
                      {actor.useVarScaleY ? (
                        <select value={actor.varScaleY || ''} onChange={(e) => updateActor(actor.id, 'varScaleY', e.target.value)} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px', minWidth: 0 }}>
                          <option value="">Select Var</option>
                          {variables.filter(v => v.type !== 'group').map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
                        </select>
                      ) : (
                        <input type="number" step="0.1" value={actor.scaleY ?? 1} onChange={(e) => updateActor(actor.id, 'scaleY', parseFloat(e.target.value) || 1)} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px', minWidth: 0 }} />
                      )}
                      <button onClick={(e) => { e.stopPropagation(); updateActor(actor.id, 'useVarScaleY', !actor.useVarScaleY); }} title="Toggle Variable" style={{ background: actor.useVarScaleY ? '#4CAF50' : '#333', color: '#fff', border: 'none', borderRadius: '3px', padding: '4px 6px', cursor: 'pointer', fontSize: '10px' }}>V</button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <label style={{ fontSize: '11px', color: '#aaa' }}>Rotate:</label>
                      {actor.useVarRotation ? (
                        <select value={actor.varRotation || ''} onChange={(e) => updateActor(actor.id, 'varRotation', e.target.value)} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px', minWidth: 0 }}>
                          <option value="">Select Var</option>
                          {variables.filter(v => v.type !== 'group').map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
                        </select>
                      ) : (
                        <input type="number" value={actor.rotation ?? 0} onChange={(e) => updateActor(actor.id, 'rotation', parseInt(e.target.value) || 0)} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px', minWidth: 0 }} title="Rotation in degrees" />
                      )}
                      <button onClick={(e) => { e.stopPropagation(); updateActor(actor.id, 'useVarRotation', !actor.useVarRotation); }} title="Toggle Variable" style={{ background: actor.useVarRotation ? '#4CAF50' : '#333', color: '#fff', border: 'none', borderRadius: '3px', padding: '4px 6px', cursor: 'pointer', fontSize: '10px' }}>V</button>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <input type="checkbox" id={`hflip-${actor.id}`} checked={actor.hflip !== false} onChange={(e) => updateActor(actor.id, 'hflip', e.target.checked)} />
                        <label htmlFor={`hflip-${actor.id}`} style={{ fontSize: '11px', color: '#aaa', cursor: 'pointer' }}>Auto Flip H</label>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <input type="checkbox" id={`vflip-${actor.id}`} checked={actor.vflip || false} onChange={(e) => updateActor(actor.id, 'vflip', e.target.checked)} />
                        <label htmlFor={`vflip-${actor.id}`} style={{ fontSize: '11px', color: '#aaa', cursor: 'pointer' }}>Auto Flip V</label>
                      </div>
                    </div>

                    {!actor.spriteId && !(actor.spriteIds && actor.spriteIds.length > 0) && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                        <label style={{ fontSize: '11px', color: '#aaa', width: '50px' }}>Color:</label>
                        <input type="color" value={actor.color || '#ff00ff'} onChange={(e) => updateActor(actor.id, 'color', e.target.value)} style={{ width: '20px', height: '20px', padding: 0, border: 'none', background: 'transparent', cursor: 'pointer' }} />
                      </div>
                    )}
                  </div>


                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                    <input type="checkbox" id={`hidden-${actor.id}`} checked={actor.isHidden || false} onChange={(e) => updateActor(actor.id, 'isHidden', e.target.checked)} />
                    <label htmlFor={`hidden-${actor.id}`} style={{ fontSize: '11px', color: '#aaa', cursor: 'pointer' }}>Start Hidden (Spawn Later)</label>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginTop: '8px', borderTop: '1px solid #444', paddingTop: '8px' }}>
                    <select 
                      value={actor.groupId || ""} 
                      onChange={(e) => {
                        e.stopPropagation();
                        const newGroupId = e.target.value ? Number(e.target.value) : null;
                        
                        let nextActors = actors.map(a => a.id === actor.id ? { ...a, groupId: newGroupId } : a);
                        
                        if (newGroupId) {
                          const movedActor = nextActors.find(a => a.id === actor.id);
                          nextActors = nextActors.filter(a => a.id !== actor.id);
                          
                          const groupIndex = nextActors.findIndex(a => a.id === newGroupId);
                          if (groupIndex !== -1) {
                            let insertIndex = groupIndex + 1;
                            while (insertIndex < nextActors.length && nextActors[insertIndex].groupId === newGroupId) {
                              insertIndex++;
                            }
                            nextActors.splice(insertIndex, 0, movedActor);
                          }
                        } else {
                          const oldGroupId = actor.groupId;
                          if (oldGroupId) {
                            const movedActor = nextActors.find(a => a.id === actor.id);
                            nextActors = nextActors.filter(a => a.id !== actor.id);
                            
                            const oldGroupIndex = nextActors.findIndex(a => a.id === oldGroupId);
                            if (oldGroupIndex !== -1) {
                              let insertIndex = oldGroupIndex + 1;
                              while (insertIndex < nextActors.length && nextActors[insertIndex].groupId === oldGroupId) {
                                insertIndex++;
                              }
                              nextActors.splice(insertIndex, 0, movedActor);
                            } else {
                              nextActors.push(movedActor);
                            }
                          }
                        }
                        
                        setActors(nextActors);
                        saveHistory("Change Actor Group", layers, dimensions, { actors: nextActors });
                      }}
                      onClick={(e) => e.stopPropagation()}
                      style={{ background: 'transparent', color: '#aaa', border: '1px solid #444', borderRadius: '3px', maxWidth: '120px', fontSize: '10px', outline: 'none' }}
                    >
                      <option value="">No Group</option>
                      {actors.filter(a => a.type === 'group').map(g => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                    {actor.type === 'enemy' && actor.enemyDeathScriptId ? (
                      <button
                        onClick={() => {
                          setEditingCustomScriptId(actor.enemyDeathScriptId);
                          setTool('script');
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#2196F3'; e.currentTarget.style.color = '#fff'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#2196F3'; }}
                        style={{ flex: 1, background: 'transparent', color: '#2196F3', border: '1px solid #2196F3', padding: '6px', fontSize: '11px', outline: 'none', borderRadius: '3px', cursor: 'pointer', fontWeight: 'bold' }}
                      >
                        Edit Custom Script
                      </button>
                    ) : actor.type === 'door' && actor.doorUnlockScriptId ? (
                      <button
                        onClick={() => {
                          setEditingCustomScriptId(actor.doorUnlockScriptId);
                          setTool('script');
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#2196F3'; e.currentTarget.style.color = '#fff'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#2196F3'; }}
                        style={{ flex: 1, background: 'transparent', color: '#2196F3', border: '1px solid #2196F3', padding: '6px', fontSize: '11px', outline: 'none', borderRadius: '3px', cursor: 'pointer', fontWeight: 'bold' }}
                      >
                        Edit Custom Script
                      </button>
                    ) : actor.type !== 'sign' ? (
                      <button
                        onClick={() => setEditingScriptActorId(actor.id)}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#4CAF50'; e.currentTarget.style.color = '#fff'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#4CAF50'; }}
                        style={{ flex: 1, background: 'transparent', color: '#4CAF50', border: '1px solid #4CAF50', padding: '6px', fontSize: '11px', outline: 'none', borderRadius: '3px', cursor: 'pointer', fontWeight: 'bold' }}
                      >Edit Script</button>
                    ) : null}
                  </div>

                </div>
              )}
            </div>
              );
            })}
            {globalActors.length > 0 && (
              <>
                <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '12px', padding: '4px 0', borderTop: '1px solid #444' }}>
                  Global Actors
                </div>
                {globalActors.filter(actor => actor.name.toLowerCase().includes(searchQuery.toLowerCase())).map((actor) => (
                <div key={actor.id}
                  onClick={() => { setActiveActorId(actor.id); setTool('actor'); }}
                  style={{
                    display: 'flex', flexDirection: 'column', padding: '10px',
                    backgroundColor: activeActorId === actor.id ? '#3c3c3c' : '#1e1e1e',
                    borderRadius: '6px', cursor: 'pointer',
                    border: activeActorId === actor.id ? '1px solid #4CAF50' : '1px solid transparent',
                    opacity: 0.85
                  }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, overflow: 'hidden' }}>
                      <input
                        type="checkbox"
                        checked={(scenes.find(s => s.id === activeSceneId)?.globalActorIds || []).includes(actor.id)}
                        onChange={(e) => { e.stopPropagation(); toggleGlobalActorInScene(actor.id); }}
                        onClick={(e) => e.stopPropagation()}
                        title="Include in this scene"
                        style={{ cursor: 'pointer', accentColor: '#4CAF50' }}
                      />
                      {(() => {
                        const firstSpriteId = (actor.spriteIds && actor.spriteIds.length > 0 && actor.spriteIds[0]) ? (typeof actor.spriteIds[0] === 'object' ? actor.spriteIds[0].id : actor.spriteIds[0]) : null;
                        const tileId = firstSpriteId ?? actor.spriteId ?? ACTOR_DEFAULT_TILE_MAP[actor.type];
                        const tile = savedTiles.find(t => String(t.id) === String(tileId) || t.id === Number(tileId));
                        return tile ? (
                          <TileIcon tile={tile} size={16} />
                        ) : (
                          <div style={{ width: '16px', height: '16px', backgroundColor: actor.color || '#ff00ff', borderRadius: '3px', flexShrink: 0 }} />
                        );
                      })()}
                      {editingActorId === actor.id ? (
                        <input
                          autoFocus
                          value={actor.name}
                          onChange={(e) => updateActor(actor.id, 'name', e.target.value)}
                          onBlur={handleRenameComplete}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === 'Escape') handleRenameComplete();
                          }}
                          style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #4CAF50', outline: 'none', padding: '2px', fontSize: '13px' }}
                        />
                      ) : (
                        <span
                          onDoubleClick={(e) => { e.stopPropagation(); setEditingActorId(actor.id); }}
                          style={{ fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                        >
                          {actor.name}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); setDesignerActorId(actor.id); }}
                        title="Edit Actor Properties"
                        style={{ background: 'none', border: 'none', color: '#4CAF50', cursor: 'pointer', opacity: 0.8, padding: 0, display: 'flex', alignItems: 'center', fontSize: '10px' }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); removeGlobalActor(actor); }}
                        title="Remove from Global (moves to current scene)"
                        style={{ background: 'none', border: 'none', color: '#ff9800', cursor: 'pointer', opacity: 0.8, padding: 0, display: 'flex', alignItems: 'center', fontSize: '10px' }}
                      >
                        Unlink
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); const next = globalActors.filter(a => a.id !== actor.id); setGlobalActors(next); saveHistory("Delete Global Actor", layers, dimensions, { globalActors: next }); }} style={{ background: 'none', border: 'none', color: '#ff4444', cursor: 'pointer', opacity: 0.8, padding: 0 }}>
                        <BsTrash />
                      </button>
                    </div>
                  </div>
                  {activeActorId === actor.id && (
                    <div style={{ marginTop: '10px', borderTop: '1px solid #555', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ fontSize: '11px', color: '#aaa', width: '30px' }}>Type:</label>
                        <button
                          onClick={() => { setActorTypeModalContext({ mode: 'change', actorId: actor.id }); setActorTypeModalOpen(true); }}
                          style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #444', padding: '4px 8px', fontSize: '11px', outline: 'none', borderRadius: '3px', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                          {(() => {
                            const tile = savedTiles.find(t => t.id === ACTOR_DEFAULT_TILE_MAP[actor.type]);
                            return tile ? <TileIcon tile={tile} size={16} /> : null;
                          })()}
                          {ACTOR_TYPE_NAMES[actor.type] || 'Actor'}
                        </button>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ fontSize: '11px', color: '#aaa', width: '30px' }}>X:</label>
                        <input type="number" value={((scenes.find(s => s.id === activeSceneId)?.globalActorPositions || {})[actor.id]?.x ?? actor.x)} onChange={(e) => { const val = parseInt(e.target.value) || 0; setGlobalActorPosition(actor.id, val, ((scenes.find(s => s.id === activeSceneId)?.globalActorPositions || {})[actor.id]?.y ?? actor.y)); }} style={{ width: '50px', background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }} />
                        <label style={{ fontSize: '11px', color: '#aaa', width: '30px' }}>Y:</label>
                        <input type="number" value={((scenes.find(s => s.id === activeSceneId)?.globalActorPositions || {})[actor.id]?.y ?? actor.y)} onChange={(e) => { const val = parseInt(e.target.value) || 0; setGlobalActorPosition(actor.id, ((scenes.find(s => s.id === activeSceneId)?.globalActorPositions || {})[actor.id]?.x ?? actor.x), val); }} style={{ width: '50px', background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }} />
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); setDesignerActorId(actor.id); }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = '#4CAF50'; e.currentTarget.style.color = '#fff'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#4CAF50'; }}
                          style={{ flex: 1, background: 'transparent', color: '#4CAF50', border: '1px solid #4CAF50', padding: '6px', fontSize: '11px', outline: 'none', borderRadius: '3px', cursor: 'pointer', fontWeight: 'bold' }}
                        >Design Sprite</button>
                        <button
                          onClick={() => setEditingScriptActorId(actor.id)}
                          onMouseEnter={(e) => { e.currentTarget.style.background = '#4CAF50'; e.currentTarget.style.color = '#fff'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#4CAF50'; }}
                          style={{ flex: 1, background: 'transparent', color: '#4CAF50', border: '1px solid #4CAF50', padding: '6px', fontSize: '11px', outline: 'none', borderRadius: '3px', cursor: 'pointer', fontWeight: 'bold' }}
                        >Edit Script</button>
                      </div>
                    </div>
                  )}
                </div>
                ))}
              </>
            )}
          {designerActorId && (
            <ActorDesignerModal
              actor={actors.find(a => a.id === designerActorId) || globalActors.find(a => a.id === designerActorId)}
              savedTiles={savedTiles}
              setSavedTiles={setSavedTiles}
              saveHistory={saveHistory}
              layers={layers}
              dimensions={dimensions}
              animations={animations}
              onClose={() => setDesignerActorId(null)}
              onSave={(newSpriteIds, newW, newH, newIdle, newWalk, newAttack, newJump, newCustoms, newColX, newColY, newColW, newColH, newHFlip, newVFlip, newLayersMetadata, newColType) => {
                const expectedLength = Math.max(1, Math.floor(newW / 8) * Math.floor(newH / 8));
                let trimmedSpriteIds = Array.isArray(newSpriteIds) ? newSpriteIds.slice(0, expectedLength) : Array(expectedLength).fill(null);
                while (trimmedSpriteIds.length < expectedLength) {
                  trimmedSpriteIds.push(null);
                }

                const trimAnim = (anim) => {
                  if (!anim) return null;
                  return {
                    ...anim,
                    frames: anim.frames.map(f => {
                      let trimmed = Array.isArray(f) ? f.slice(0, expectedLength) : (f ? [f].slice(0, expectedLength) : Array(expectedLength).fill(null));
                      while (trimmed.length < expectedLength) {
                        trimmed.push(null);
                      }
                      return trimmed;
                    }),
                    framesLayers: Array.isArray(anim.framesLayers) ? anim.framesLayers.map(fl => {
                      const nextFL = {};
                      for (const key in fl) {
                        if (Array.isArray(fl[key])) {
                          let trimmed = fl[key].slice(0, expectedLength);
                          while (trimmed.length < expectedLength) {
                            trimmed.push(null);
                          }
                          nextFL[key] = trimmed;
                        }
                      }
                      return nextFL;
                    }) : []
                  };
                };

                const trimmedIdle = trimAnim(newIdle);
                const trimmedWalk = trimAnim(newWalk);
                const trimmedAttack = trimAnim(newAttack);
                const trimmedJump = trimAnim(newJump);
                const trimmedCustoms = newCustoms.map(trimAnim).filter(Boolean);

                const newGlobalAnims = [...animations];
                const updateOrAddAnim = (anim) => {
                  if (!anim) return null;
                  const idx = newGlobalAnims.findIndex(a => a.id === anim.id);
                  if (idx !== -1) newGlobalAnims[idx] = anim;
                  else newGlobalAnims.push(anim);
                  return anim.id;
                };

                const idleId = updateOrAddAnim(trimmedIdle);
                const walkId = updateOrAddAnim(trimmedWalk);
                const attackId = updateOrAddAnim(trimmedAttack);
                const jumpId = updateOrAddAnim(trimmedJump);
                const customIds = trimmedCustoms.map(updateOrAddAnim).filter(Boolean);

                setAnimations(newGlobalAnims);

                const isGlobal = globalActors.some(a => a.id === designerActorId);
                if (isGlobal) {
                  const nextGlobal = globalActors.map(a => a.id === designerActorId ? {
                    ...a, spriteIds: trimmedSpriteIds, spriteId: null, width: newW, height: newH,
                    idleAnimId: idleId, walkAnimId: walkId, attackAnimId: attackId, jumpAnimId: jumpId, customAnimIds: customIds,
                    collisionX: newColX, collisionY: newColY, collisionW: newColW, collisionH: newColH,
                    collisionType: newColType || 'solid',
                    hflip: newHFlip, vflip: newVFlip,
                    designerLayers: newLayersMetadata
                  } : a);
                  setGlobalActors(nextGlobal);
                  saveHistory("Design Actor", layers, dimensions, { globalActors: nextGlobal, animations: newGlobalAnims });
                } else {
                  const nextActors = actors.map(a => a.id === designerActorId ? {
                    ...a, spriteIds: trimmedSpriteIds, spriteId: null, width: newW, height: newH,
                    idleAnimId: idleId, walkAnimId: walkId, attackAnimId: attackId, jumpAnimId: jumpId, customAnimIds: customIds,
                    collisionX: newColX, collisionY: newColY, collisionW: newColW, collisionH: newColH,
                    collisionType: newColType || 'solid',
                    hflip: newHFlip, vflip: newVFlip,
                    designerLayers: newLayersMetadata
                  } : a);
                  setActors(nextActors);
                  saveHistory("Design Actor", layers, dimensions, { actors: nextActors, animations: newGlobalAnims });
                }
                setDesignerActorId(null);
              }}
            />
          )}
          {scriptPrompt && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100000 }} onClick={() => setScriptPrompt(null)}>
              <div style={{ background: '#1e1e1e', border: '1px solid #444', borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '300px' }} onClick={e => e.stopPropagation()}>
                <span style={{ fontSize: '13px', color: '#fff', fontWeight: 'bold' }}>Script Name</span>
                <input
                  autoFocus
                  value={scriptPromptName}
                  onChange={e => setScriptPromptName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && scriptPromptName.trim()) {
                      confirmAddScript(scriptPrompt.actorId, scriptPrompt.prop, scriptPromptName.trim());
                    } else if (e.key === 'Escape') {
                      setScriptPrompt(null);
                    }
                  }}
                  style={{ background: '#111', color: '#fff', border: '1px solid #4CAF50', padding: '8px', fontSize: '13px', outline: 'none', borderRadius: '4px' }}
                />
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button onClick={() => setScriptPrompt(null)} style={{ background: '#333', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>Cancel</button>
                  <button
                    onClick={() => { if (scriptPromptName.trim()) confirmAddScript(scriptPrompt.actorId, scriptPrompt.prop, scriptPromptName.trim()); }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#4CAF50'; e.currentTarget.style.color = '#fff'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#4CAF50'; }}
                    style={{ background: 'transparent', color: '#4CAF50', border: '1px solid #4CAF50', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                  >Create</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </>
    )}

      {actorTypeModalOpen && createPortal(
        <div
          onClick={() => setActorTypeModalOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 10000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.7)'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#2a2a2a', border: '1px solid #4CAF50', borderRadius: '8px',
              boxShadow: '0 10px 30px rgba(0,0,0,0.8)', padding: '20px',
              width: '50%', maxWidth: '90vw', maxHeight: '80vh', overflowY: 'auto', position: 'relative'
            }}
          >
            <button
              onClick={() => setActorTypeModalOpen(false)}
              style={{
                position: 'absolute', top: '10px', right: '10px',
                background: 'none', border: 'none', color: '#888',
                fontSize: '24px', cursor: 'pointer', padding: '0',
                width: '30px', height: '30px', display: 'flex',
                alignItems: 'center', justifyContent: 'center'
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#fff'}
              onMouseLeave={(e) => e.currentTarget.style.color = '#888'}
            >
              ×
            </button>
            <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#4CAF50', marginBottom: '15px', textAlign: 'center' }}>
              {actorTypeModalContext.mode === 'add' ? 'Select Actor Type' : 'Change Actor Type'}
            </div>

            {/* Premium Search Filter Input */}
            <div style={{ marginBottom: '20px', position: 'relative' }}>
              <input
                type="text"
                value={actorTypeSearchQuery}
                onChange={(e) => setActorTypeSearchQuery(e.target.value)}
                placeholder="Search actor types..."
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: '#1a1a1a',
                  border: '1px solid #444',
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '13px',
                  outline: 'none',
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#4CAF50';
                  e.target.style.boxShadow = '0 0 8px rgba(76, 175, 80, 0.4)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#444';
                  e.target.style.boxShadow = 'none';
                }}
                autoFocus
              />
              {actorTypeSearchQuery && (
                <button
                  onClick={() => setActorTypeSearchQuery('')}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: '#888',
                    cursor: 'pointer',
                    fontSize: '12px',
                    padding: '0 4px',
                    lineHeight: 1
                  }}
                  onMouseEnter={(e) => e.target.style.color = '#fff'}
                  onMouseLeave={(e) => e.target.style.color = '#888'}
                >
                  Clear
                </button>
              )}
            </div>

            {(() => {
              const searchVal = actorTypeSearchQuery.toLowerCase().trim();
              const filteredGroups = ACTOR_TYPE_GROUPS.map(group => {
                const types = group.types.filter(type => {
                  const name = (ACTOR_TYPE_NAMES[type] || type).toLowerCase();
                  const key = type.toLowerCase();
                  return name.includes(searchVal) || key.includes(searchVal);
                });
                return { ...group, types };
              }).filter(group => group.types.length > 0);

              if (filteredGroups.length === 0) {
                return (
                  <div style={{ textAlign: 'center', color: '#888', padding: '30px 0', fontSize: '13px' }}>
                    No actor types found matching "{actorTypeSearchQuery}"
                  </div>
                );
              }

              return filteredGroups.map((group, idx) => (
                <div key={idx} style={{ marginBottom: '15px' }}>
                  <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', borderBottom: '1px solid #444', paddingBottom: '4px' }}>
                    {group.label}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '8px' }}>
                    {group.types.map(type => {
                      const tile = savedTiles.find(t => t.id === ACTOR_DEFAULT_TILE_MAP[type]);
                      return (
                        <button
                          key={type}
                          onClick={() => handleActorTypeSelect(type)}
                          style={{
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                            padding: '8px', background: '#1a1a1a', border: '1px solid #444',
                            borderRadius: '4px', cursor: 'pointer', transition: 'all 0.15s'
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#4CAF50'; e.currentTarget.style.background = '#252525'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#444'; e.currentTarget.style.background = '#1a1a1a'; }}
                        >
                          {tile ? <TileIcon tile={tile} size={24} /> : <div style={{ width: 24, height: 24, background: '#444', borderRadius: '2px' }} />}
                          <span style={{ fontSize: '10px', color: '#ccc', textAlign: 'center', lineHeight: '1.2' }}>
                            {ACTOR_TYPE_NAMES[type] || type}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ));
            })()}
            <div style={{ textAlign: 'center', marginTop: '10px' }}>
              <button
                onClick={() => setActorTypeModalOpen(false)}
                style={{ padding: '8px 20px', background: '#444', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default ActorsPanel;