import { useEffect, useState, useLayoutEffect } from 'react';
import { usePxShop } from '../context/PxShopContext';
import { BsUpload } from 'react-icons/bs';

const Canvas = () => {
  const [dragCounter, setDragCounter] = useState(0);

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setDragCounter(prev => prev + 1);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter(prev => Math.max(0, prev - 1));
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter(0);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        if (handleImageUpload) {
          handleImageUpload({ target: { files: [file] } });
        } else {
          importFileAsLayer(file);
        }
      }
    }
  };

  const {
    containerRef, handleWheel,
    rulerXRef, rulerYRef,
    viewX, viewY,
    cursorPos, zoom,
    panOffset, dimensions,
    isPixelated, gridSize,
    canvasRef, selectionRef,
    handleMouseDown, handleMouseMove, handleMouseUp,
    isPanning, tool,
    setDraggingGuide,
    importFileAsLayer, handleImageUpload,

    // Destructured variables for drawing effects
    viewActiveOnly, activeLayerId, layers, renderLayersToCtx,
    viewportSize, guides, draggingGuide, isDrawing, selectionStart,
    currentColor, drawWidth, brushType, colorJitter, symmetryMode,
    getSymmetricPixels, brushOpacity, getShapePixels, getGradientPixels,
    savedTiles, activeSavedTileId, textSettings, lassoPath, transformData,
    getTileById,
    selection, isShiftPressed, getBrushPixels, editingTextLayerId,
    actors, globalActors, activeActorId,
    triggers, activeTriggerId,
    collisions, activeCollisionId, tempPaintedCollisions, tempPaintedTriggers,
    onionSkinEnabled, frames, activeFrameId, setZoom,
    scenes, activeSceneId, hudSettings, variables,
    showGbaMask,
    initialZoomSet, setInitialZoomSet
  } = usePxShop();

  const activeScene = scenes.find(s => s.id === activeSceneId);
  const sceneGlobalActorIds = activeScene?.globalActorIds || [];
  const scenePositions = activeScene?.globalActorPositions || {};
  const sceneGlobalActors = globalActors
    .filter(a => sceneGlobalActorIds.includes(a.id) && !(activeScene?.type === 'POINTNCLICK' && a.type === 'player'))
    .map(a => {
      const override = scenePositions[a.id];
      return override ? { ...a, x: override.x, y: override.y } : a;
    });

  // Rendering Canvas Layer Loop
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      console.log("[Canvas Render] No canvas ref found.");
      return;
    }
    try {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, dimensions.w * zoom, dimensions.h * zoom);

      // Render Onion Skin
      if (onionSkinEnabled && frames && frames.length > 1) {
        const currentIdx = frames.findIndex(f => f.id === activeFrameId);
        if (currentIdx > 0) {
          const prevFrame = frames[currentIdx - 1];
          const prevLayersToDraw = viewActiveOnly ? prevFrame.layers.filter(l => l.id === activeLayerId) : prevFrame.layers;
          
          const onionCanvas = document.createElement('canvas');
          onionCanvas.width = dimensions.w * zoom;
          onionCanvas.height = dimensions.h * zoom;
          const onionCtx = onionCanvas.getContext('2d');
          
          renderLayersToCtx(onionCtx, zoom, prevLayersToDraw);
          
          ctx.globalAlpha = 0.3;
          ctx.drawImage(onionCanvas, 0, 0);
          ctx.globalAlpha = 1.0;
        }
      }

      const layersToDraw = viewActiveOnly ? layers.filter(l => l.id === activeLayerId) : layers;
      renderLayersToCtx(ctx, zoom, layersToDraw);
      
      // Render actors on top
      const activeScene = scenes?.find(s => s.id === activeSceneId);
      [...actors, ...sceneGlobalActors].filter(actor => actor.type !== 'group').forEach(actor => {
        let baseAlpha = actor.isHidden ? 0.4 : 1.0;
        ctx.globalAlpha = ((tool === 'actor' || tool === 'spawn') && activeActorId !== actor.id) ? baseAlpha * 0.6 : baseAlpha;
        
        let effectiveSpriteId = actor.spriteId;
        let effectiveSpriteIds = actor.spriteIds;
        if (actor.type === 'player' && activeScene?.type === 'POINTNCLICK') {
          const ptrSpriteId = activeScene?.pointerSpriteId ?? 22;
          const ptrTile = getTileById(ptrSpriteId) || savedTiles?.find(t => t.name === 'Pointer');
          if (ptrTile) {
            effectiveSpriteId = ptrTile.id;
            effectiveSpriteIds = null;
          }
        } else if (actor.type === 'player' && activeScene?.type === 'SHMUP') {
          const hasCustomSprite = actor.spriteId || (actor.spriteIds && actor.spriteIds.some(id => id));
          if (!hasCustomSprite) {
            const shmupTile = getTileById(24) || savedTiles?.find(t => t.name === 'SHMUP Player Ship');
            if (shmupTile) {
              effectiveSpriteId = shmupTile.id;
              effectiveSpriteIds = null;
            }
          }
        } else if (actor.type === 'player' && activeScene?.type === 'RACING') {
          const hasCustomSprite = actor.spriteId || (actor.spriteIds && actor.spriteIds.some(id => id));
          if (!hasCustomSprite) {
            const racingTile = getTileById(27) || savedTiles?.find(t => t.name === 'Racing Car');
            if (racingTile) {
              effectiveSpriteId = racingTile.id;
              effectiveSpriteIds = null;
            }
          }
        }

        if (effectiveSpriteIds && effectiveSpriteIds.length > 0) {
          const cols = Math.max(1, Math.floor(actor.width / 8));
          const rows = Math.max(1, Math.floor(actor.height / 8));
          for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
              const tId = effectiveSpriteIds[r * cols + c];
              if (tId) {
                const actualId = typeof tId === 'object' ? tId.id : tId;
                const flipH = typeof tId === 'object' ? tId.flipH : false;
                const flipV = typeof tId === 'object' ? tId.flipV : false;
                const tile = getTileById(actualId);
                if (tile) {
                  for (let py = 0; py < 8; py++) {
                    for (let px = 0; px < 8; px++) {
                      const srcY = flipV ? 7 - py : py;
                      const srcX = flipH ? 7 - px : px;
                      const color = tile.data[srcY][srcX];
                      if (color) {
                        ctx.fillStyle = color;
                        ctx.fillRect((actor.x + c * 8 + px) * zoom, (actor.y + r * 8 + py) * zoom, zoom, zoom);
                      }
                    }
                  }
                }
              }
            }
          }
        } else if (effectiveSpriteId) {
          const tile = getTileById(effectiveSpriteId);
          if (tile) {
            const scaleX = actor.width / 8;
            const scaleY = actor.height / 8;
            for (let py = 0; py < 8; py++) {
              for (let px = 0; px < 8; px++) {
                const color = tile.data[py][px];
                if (color) {
                  ctx.fillStyle = color;
                  ctx.fillRect((actor.x + px * scaleX) * zoom, (actor.y + py * scaleY) * zoom, scaleX * zoom, scaleY * zoom);
                }
              }
            }
          }
        } else {
          ctx.fillStyle = actor.color || '#ff00ff';
          ctx.fillRect(actor.x * zoom, actor.y * zoom, actor.width * zoom, actor.height * zoom);
        }

        // Draw health bar above boss enemies
        if (actor.type === 'enemy' && actor.isBoss) {
          const barW = actor.width * zoom;
          const barH = 4 * zoom;
          const barX = actor.x * zoom;
          const barY = (actor.y - 6) * zoom;
          const hp = actor.enemyHp ?? 3;
          const maxHp = actor.enemyHp ?? 3;
          const ratio = hp / maxHp;
          ctx.save();
          ctx.globalAlpha = 0.8;
          ctx.fillStyle = '#333';
          ctx.fillRect(barX, barY, barW, barH);
          ctx.fillStyle = ratio > 0.5 ? '#4caf50' : ratio > 0.25 ? '#ff9800' : '#f44336';
          ctx.fillRect(barX, barY, barW * ratio, barH);
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 1;
          ctx.strokeRect(barX, barY, barW, barH);
          ctx.restore();
        }

        if (actor.type === 'player') {
          ctx.font = `bold ${Math.max(10, 8 * zoom)}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = '#fff';
          ctx.strokeStyle = '#000';
          ctx.lineWidth = 2;
          ctx.strokeText('P', (actor.x + actor.width / 2) * zoom, (actor.y + actor.height / 2) * zoom);
          ctx.fillText('P', (actor.x + actor.width / 2) * zoom, (actor.y + actor.height / 2) * zoom);
          
          if (tool === 'actor' || tool === 'spawn') {
            ctx.font = `bold 10px sans-serif`;
            ctx.strokeText('Player Start', (actor.x + actor.width / 2) * zoom, (actor.y + actor.height) * zoom + 12);
            ctx.fillText('Player Start', (actor.x + actor.width / 2) * zoom, (actor.y + actor.height) * zoom + 12);
          }
        }

        // Draw movement range visualization for selected moving actors
        if ((tool === 'actor' || tool === 'spawn') && activeActorId === actor.id && (actor.isMoving || (actor.type === 'enemy' && (actor.enemyBehavior || 'patrol') === 'patrol'))) {
          const moveAmount = actor.moveAmount ?? actor.enemyRange ?? 0;
          const moveDir = actor.moveDir || actor.enemyDir || 'horizontal';
          
          if (moveAmount > 0) {
            ctx.save();
            ctx.globalAlpha = 0.3;
            ctx.lineWidth = 2 * zoom;
            ctx.setLineDash([4 * zoom, 4 * zoom]);
            
            if (moveDir === 'horizontal') {
              // Draw horizontal movement range
              const rangeX = actor.x - moveAmount;
              const rangeY = actor.y;
              const rangeW = actor.width + moveAmount * 2;
              const rangeH = actor.height;
              
              ctx.fillStyle = '#4CAF50';
              ctx.fillRect(rangeX * zoom, rangeY * zoom, rangeW * zoom, rangeH * zoom);
              ctx.strokeStyle = '#4CAF50';
              ctx.strokeRect(rangeX * zoom, rangeY * zoom, rangeW * zoom, rangeH * zoom);
            } else if (moveDir === 'vertical') {
              // Draw vertical movement range
              const rangeX = actor.x;
              const rangeY = actor.y - moveAmount;
              const rangeW = actor.width;
              const rangeH = actor.height + moveAmount * 2;
              
              ctx.fillStyle = '#2196F3';
              ctx.fillRect(rangeX * zoom, rangeY * zoom, rangeW * zoom, rangeH * zoom);
              ctx.strokeStyle = '#2196F3';
              ctx.strokeRect(rangeX * zoom, rangeY * zoom, rangeW * zoom, rangeH * zoom);
            } else if (moveDir === 'bounce') {
              // Draw bounce movement range (both directions)
              const rangeX = actor.x - moveAmount;
              const rangeY = actor.y - moveAmount;
              const rangeW = actor.width + moveAmount * 2;
              const rangeH = actor.height + moveAmount * 2;
              
              ctx.fillStyle = '#FF9800';
              ctx.fillRect(rangeX * zoom, rangeY * zoom, rangeW * zoom, rangeH * zoom);
              ctx.strokeStyle = '#FF9800';
              ctx.strokeRect(rangeX * zoom, rangeY * zoom, rangeW * zoom, rangeH * zoom);
            }
            
            ctx.restore();
          }
        }
      });

      // Render triggers if tool is trigger
      if (tool === 'trigger') {
        triggers.forEach(trigger => {
          if (trigger.isGroup) return;

          ctx.globalAlpha = activeTriggerId === trigger.id ? 0.8 : 0.4;
          ctx.fillStyle = '#ff9800';
          ctx.fillRect(trigger.x * zoom, trigger.y * zoom, trigger.width * zoom, trigger.height * zoom);
          
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 2]);
          ctx.strokeRect(trigger.x * zoom, trigger.y * zoom, trigger.width * zoom, trigger.height * zoom);
          ctx.setLineDash([]);
          
          ctx.font = `bold ${Math.max(10, 8 * zoom)}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = '#fff';
          ctx.strokeStyle = '#000';
          ctx.lineWidth = 2;
          ctx.strokeText('T', (trigger.x + trigger.width / 2) * zoom, (trigger.y + trigger.height / 2) * zoom);
          ctx.fillText('T', (trigger.x + trigger.width / 2) * zoom, (trigger.y + trigger.height / 2) * zoom);
        });

        // Render preview of painted triggers
        if (tempPaintedTriggers && tempPaintedTriggers.length > 0) {
          tempPaintedTriggers.forEach(p => {
            ctx.globalAlpha = 0.5;
            ctx.fillStyle = '#ff9800';
            ctx.fillRect(p.x * zoom, p.y * zoom, 8 * zoom, 8 * zoom);

            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 2]);
            ctx.strokeRect(p.x * zoom, p.y * zoom, 8 * zoom, 8 * zoom);
            ctx.setLineDash([]);
          });
        }
      }

      // Render collisions if tool is collision or collisionFill
      if (tool === 'collision' || tool === 'collisionFill') {
        collisions.forEach(col => {
          if (col.isGroup) return;

          const parentGroup = col.groupId ? collisions.find(g => g.id === col.groupId) : null;
          const colType = parentGroup ? (parentGroup.type || col.type) : col.type;
          const colAngle = parentGroup ? (parentGroup.angle !== undefined ? parentGroup.angle : col.angle) : col.angle;

          ctx.globalAlpha = activeCollisionId === col.id ? 0.8 : 0.4;
          ctx.fillStyle = '#f44336';
          if (colType === 'slope-up' || colType === 'slope-down') {
            const angle = colAngle !== undefined ? colAngle : 45;
            const rad = (angle * Math.PI) / 180;
            const rise = Math.min(col.height, col.width * Math.tan(rad));
            
            ctx.beginPath();
            if (colType === 'slope-up') {
              ctx.moveTo(col.x * zoom, (col.y + col.height) * zoom);
              ctx.lineTo((col.x + col.width) * zoom, (col.y + col.height) * zoom);
              ctx.lineTo((col.x + col.width) * zoom, (col.y + col.height - rise) * zoom);
            } else {
              ctx.moveTo((col.x + col.width) * zoom, (col.y + col.height) * zoom);
              ctx.lineTo(col.x * zoom, (col.y + col.height) * zoom);
              ctx.lineTo(col.x * zoom, (col.y + col.height - rise) * zoom);
            }
            ctx.closePath();
            ctx.fill();
            
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 2]);
            ctx.stroke();
            ctx.setLineDash([]);
          } else {
            ctx.fillRect(col.x * zoom, col.y * zoom, col.width * zoom, col.height * zoom);
            
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 2]);
            ctx.strokeRect(col.x * zoom, col.y * zoom, col.width * zoom, col.height * zoom);
            ctx.setLineDash([]);
          }

          ctx.font = `bold ${Math.max(10, 8 * zoom)}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = '#fff';
          ctx.strokeStyle = '#000';
          ctx.lineWidth = 2;
          ctx.strokeText('C', (col.x + col.width / 2) * zoom, (col.y + col.height / 2) * zoom);
          ctx.fillText('C', (col.x + col.width / 2) * zoom, (col.y + col.height / 2) * zoom);
        });

        // Render preview of painted collisions
        if (tempPaintedCollisions && tempPaintedCollisions.length > 0) {
          const activeCol = collisions.find(c => c.id === activeCollisionId);
          const paintType = activeCol ? activeCol.type : 'solid';
          const paintAngle = activeCol ? activeCol.angle : undefined;

          tempPaintedCollisions.forEach(p => {
            ctx.globalAlpha = 0.5;
            ctx.fillStyle = '#f44336';
            if (paintType === 'slope-up' || paintType === 'slope-down') {
              const angle = paintAngle !== undefined ? paintAngle : 45;
              const rad = (angle * Math.PI) / 180;
              const rise = Math.min(8, 8 * Math.tan(rad));
              
              ctx.beginPath();
              if (paintType === 'slope-up') {
                ctx.moveTo(p.x * zoom, (p.y + 8) * zoom);
                ctx.lineTo((p.x + 8) * zoom, (p.y + 8) * zoom);
                ctx.lineTo((p.x + 8) * zoom, (p.y + 8 - rise) * zoom);
              } else {
                ctx.moveTo((p.x + 8) * zoom, (p.y + 8) * zoom);
                ctx.lineTo(p.x * zoom, (p.y + 8) * zoom);
                ctx.lineTo(p.x * zoom, (p.y + 8 - rise) * zoom);
              }
              ctx.closePath();
              ctx.fill();
              
              ctx.strokeStyle = '#4CAF50';
              ctx.lineWidth = 1;
              ctx.setLineDash([2, 2]);
              ctx.stroke();
              ctx.setLineDash([]);
            } else {
              ctx.fillRect(p.x * zoom, p.y * zoom, 8 * zoom, 8 * zoom);
              
              ctx.strokeStyle = '#4CAF50';
              ctx.lineWidth = 1;
              ctx.setLineDash([2, 2]);
              ctx.strokeRect(p.x * zoom, p.y * zoom, 8 * zoom, 8 * zoom);
              ctx.setLineDash([]);
            }

            ctx.font = `bold ${Math.max(6, 4 * zoom)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#fff';
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 1;
            ctx.strokeText('C', (p.x + 4) * zoom, (p.y + 4) * zoom);
            ctx.fillText('C', (p.x + 4) * zoom, (p.y + 4) * zoom);
          });
        }
      }

      // Render Unified HUD if enabled, fallback to original actor HUD if disabled
      const player = actors.find(a => a.type === 'player') || sceneGlobalActors.find(a => a.type === 'player');

      const isIntroOrPause = activeScene?.type === 'INTRO' || activeScene?.type === 'PAUSE';

      const boundaryX = showGbaMask ? ((dimensions.w - 240) / 2 - (panOffset.x / zoom)) : 0;
      const boundaryY = showGbaMask ? ((dimensions.h - 160) / 2 - (panOffset.y / zoom)) : 0;
      const boundaryW = showGbaMask ? 240 : dimensions.w;
      const boundaryH = showGbaMask ? 160 : dimensions.h;

      if (!isIntroOrPause && hudSettings && hudSettings.enabled) {
        // Calculate positions
        const isVertical = hudSettings.position === 'left' || hudSettings.position === 'right';
        const rectW = (hudSettings.width ?? (isVertical ? 2 : 30)) * 8;
        const rectH = (hudSettings.height ?? (isVertical ? 20 : 2)) * 8;

        let rectX = 0;
        let rectY = 0;

        if (hudSettings.position === 'bottom') {
          rectX = boundaryX + Math.max(0, (boundaryW - rectW) / 2);
          rectY = boundaryY + Math.max(0, boundaryH - rectH);
        } else if (hudSettings.position === 'left') {
          rectX = boundaryX;
          rectY = boundaryY + Math.max(0, (boundaryH - rectH) / 2);
        } else if (hudSettings.position === 'right') {
          rectX = boundaryX + Math.max(0, boundaryW - rectW);
          rectY = boundaryY + Math.max(0, (boundaryH - rectH) / 2);
        } else { // 'top'
          rectX = boundaryX + Math.max(0, (boundaryW - rectW) / 2);
          rectY = boundaryY;
        }

        ctx.save();
        // Background box
        if (hudSettings.backgroundColor) {
          ctx.fillStyle = hudSettings.backgroundColor;
          ctx.fillRect(rectX * zoom, rectY * zoom, rectW * zoom, rectH * zoom);
        }
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1;
        ctx.strokeRect(rectX * zoom, rectY * zoom, rectW * zoom, rectH * zoom);

        const drawTileIcon = (tileId, x, y) => {
          const tile = getTileById(tileId);
          if (tile) {
            for (let py = 0; py < 8; py++) {
              for (let px = 0; px < 8; px++) {
                const color = tile.data[py][px];
                if (color) {
                  ctx.fillStyle = color;
                  ctx.fillRect((x + px) * zoom, (y - 4 + py) * zoom, zoom, zoom);
                }
              }
            }
          }
        };

        ctx.font = `bold ${Math.max(10, 8 * zoom)}px monospace`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = hudSettings.textColor || '#ffffff';

        const items = hudSettings.displayItems || [];

        // Helper function to resolve dynamic variables in the workspace preview
        const getResolvedText = (textTemplate) => {
          return textTemplate.replace(/\{([^}]+)\}/g, (match, varName) => {
            const upper = varName.trim().toUpperCase();
            if (upper === 'HP' || upper === 'HEALTH' || upper === 'PLAYER_HP') {
              return player ? (player.playerHp ?? 10) : 10;
            }
            if (upper === 'BONUS' || upper === 'COINS' || upper === 'PLAYER_BONUS') {
              return player ? (player.playerMaxBonus ?? 10) : 10;
            }
            // Custom global variable lookup:
            const variableObj = variables?.find(v => v.name.replace(/[^a-zA-Z0-9_]/g, '_') === varName.trim().replace(/[^a-zA-Z0-9_]/g, '_'));
            if (variableObj) {
              return variableObj.initialValue ?? 0;
            }
            return '0';
          });
        };

        const alignment = hudSettings.alignment || 'left';
        const spacing = hudSettings.spacing || 'space-between';

        if (hudSettings.position === 'left' || hudSettings.position === 'right') {
          if (hudSettings.verticalText) {
            const getTemplateLength = (itemText) => {
              const textVal = itemText || '';
              const regexVal = /\{([^}]+)\}/g;
              let len = 0;
              let lastIdx = 0;
              let matchVal;
              while ((matchVal = regexVal.exec(textVal)) !== null) {
                len += matchVal.index - lastIdx;
                len += 2;
                lastIdx = regexVal.lastIndex;
              }
              len += textVal.length - lastIdx;
              return len;
            };

            // Pre-calculate heights for packed spacing
            let totalH = 0;
            const itemHeights = items.map(item => {
              return (item.tileId ? 12 : 0) + getTemplateLength(item.text) * 8;
            });
            items.forEach((item, idx) => {
              totalH += itemHeights[idx] + 12;
            });
            totalH = Math.max(0, totalH - 12);

            const sumItemH = itemHeights.reduce((s, h) => s + h, 0);
            const gapY = (items.length > 1) ? (rectH - 16 - sumItemH) / (items.length - 1) : 0;

            let startY = rectY + (rectH - totalH) / 2;
            if (alignment === 'left') {
              startY = rectY + 8;
            } else if (alignment === 'right') {
              startY = rectY + rectH - 8 - totalH;
            }

            let accumY = startY;
            items.forEach((item, idx) => {
              const resolvedText = getResolvedText(item.text || '');
              const itemH = itemHeights[idx];
              const centerX = rectX + rectW / 2;

              let drawY;
              if (spacing === 'space-between' && items.length > 1) {
                let prevHSum = 0;
                for (let j = 0; j < idx; j++) {
                  prevHSum += itemHeights[j] + gapY;
                }
                drawY = rectY + 8 + prevHSum;
              } else if (spacing === 'space-between' && items.length === 1) {
                if (alignment === 'left') {
                  drawY = rectY + 8;
                } else if (alignment === 'right') {
                  drawY = rectY + rectH - 8 - itemH;
                } else {
                  drawY = rectY + (rectH - itemH) / 2;
                }
              } else {
                drawY = accumY;
                accumY += itemH + 12;
              }

              if (item.tileId) {
                drawTileIcon(item.tileId, centerX - 4, drawY + 4);
                drawY += 12;
              }

              // Parse template text
              const regex = /\{([^}]+)\}/g;
              let lastIndex = 0;
              let match;
              const parts = [];
              const text = item.text || '';
              while ((match = regex.exec(text)) !== null) {
                if (match.index > lastIndex) {
                  parts.push({ type: 'static', value: text.substring(lastIndex, match.index) });
                }
                parts.push({ type: 'variable', name: match[1].trim() });
                lastIndex = regex.lastIndex;
              }
              if (lastIndex < text.length) {
                parts.push({ type: 'static', value: text.substring(lastIndex) });
              }

              ctx.save();
              ctx.textAlign = 'center';
              ctx.fillStyle = hudSettings.textColor || '#ffffff';

              parts.forEach(part => {
                if (part.type === 'static') {
                  const staticText = part.value.toUpperCase();
                  for (let c = 0; c < staticText.length; c++) {
                    const char = staticText[c];
                    if (char !== ' ') {
                      ctx.fillText(char, centerX * zoom, (drawY + 4) * zoom);
                    }
                    drawY += 8;
                  }
                } else if (part.type === 'variable') {
                  const valStr = String(getResolvedText('{' + part.name + '}'));
                  if (valStr.length === 2) {
                    ctx.fillText(valStr[0], centerX * zoom, (drawY + 4) * zoom);
                    ctx.fillText(valStr[1], centerX * zoom, (drawY + 12) * zoom);
                  } else if (valStr.length === 1) {
                    ctx.fillText(valStr[0], centerX * zoom, (drawY + 4) * zoom);
                  }
                  drawY += 16;
                }
              });
              ctx.restore();
            });
          } else {
            // Vertical stacking - horizontal text
            const totalH = items.length * 20 - 4;
            let startY = rectY + (rectH - totalH) / 2 + 4;
            if (alignment === 'left') {
              startY = rectY + 8 + 4;
            } else if (alignment === 'right') {
              startY = rectY + rectH - totalH + 4 - 8;
            }

            const itemHeights = items.map(() => 8);
            const sumItemH = itemHeights.reduce((s, h) => s + h, 0);
            const gapY = (items.length > 1) ? (rectH - 16 - sumItemH) / (items.length - 1) : 0;

            items.forEach((item, idx) => {
              const resolvedText = getResolvedText(item.text || '');
              const itemW = (item.tileId ? 12 : 0) + resolvedText.length * 8;
              const centerX = rectX + rectW / 2;
              let startX = centerX - itemW / 2;
              
              let currentY;
              if (spacing === 'space-between' && items.length > 1) {
                let prevHSum = 0;
                for (let j = 0; j < idx; j++) {
                  prevHSum += itemHeights[j] + gapY;
                }
                const drawY = rectY + 8 + prevHSum;
                currentY = drawY + 4;
              } else if (spacing === 'space-between' && items.length === 1) {
                if (alignment === 'left') {
                  currentY = rectY + 8 + 4;
                } else if (alignment === 'right') {
                  currentY = rectY + rectH - 8 - 4;
                } else {
                  currentY = rectY + rectH / 2;
                }
              } else {
                currentY = startY + idx * 20;
              }

              if (item.tileId) {
                drawTileIcon(item.tileId, startX, currentY);
                startX += 12;
              }
              ctx.fillStyle = hudSettings.textColor || '#ffffff';
              ctx.fillText(resolvedText, startX * zoom, currentY * zoom);
            });
          }
        } else {
          // Horizontal layout
          let totalW = 0;
          items.forEach(item => {
            const resolvedText = getResolvedText(item.text || '');
            const itemW = (item.tileId ? 12 : 0) + resolvedText.length * 8;
            totalW += itemW + 16;
          });
          totalW = Math.max(0, totalW - 16);

          let startX = rectX + (rectW - totalW) / 2;
          if (alignment === 'left') {
            startX = rectX + 8;
          } else if (alignment === 'right') {
            startX = rectX + rectW - 8 - totalW;
          }

          let accumX = startX;
          items.forEach((item, idx) => {
            const resolvedText = getResolvedText(item.text || '');
            const itemW = (item.tileId ? 12 : 0) + resolvedText.length * 8;
            
            let currentX;
            if (spacing === 'space-between' && items.length > 1) {
              let prevW = 0;
              for (let j = 0; j < idx; j++) {
                const prevRes = getResolvedText(items[j].text || '');
                prevW += (items[j].tileId ? 12 : 0) + prevRes.length * 8;
              }
              const totalItemsW = items.reduce((sum, it) => {
                const res = getResolvedText(it.text || '');
                return sum + (it.tileId ? 12 : 0) + res.length * 8;
              }, 0);
              const gapX = ((rectW - 16) - totalItemsW) / (items.length - 1);
              currentX = rectX + 8 + prevW + idx * gapX;
            } else if (spacing === 'space-between' && items.length === 1) {
              if (alignment === 'left') {
                currentX = rectX + 8;
              } else if (alignment === 'right') {
                currentX = rectX + rectW - 8 - itemW;
              } else {
                currentX = rectX + (rectW - itemW) / 2;
              }
            } else {
              currentX = accumX;
              accumX += itemW + 16;
            }

            const centerY = rectY + rectH / 2;
            let drawX = currentX;
            if (item.tileId) {
               drawTileIcon(item.tileId, drawX, centerY);
               drawX += 12;
            }
            ctx.fillStyle = hudSettings.textColor || '#ffffff';
            ctx.fillText(resolvedText, drawX * zoom, centerY * zoom);
          });
        }

        ctx.restore();
      } else if (!isIntroOrPause) {
        // Fallback: Render HUD if player has displayHealthInHud enabled
        if (player && player.displayHealthInHud) {
          const hudTileId = player.hudHealthTileId ?? 21;
          const tile = getTileById(hudTileId);
          const maxHp = player.playerHp ?? 10;
          const hudPosition = player.hudPosition || 'top';
          
          ctx.save();
          const hudX = boundaryX + 8;
          const hudY = hudPosition === 'bottom' ? boundaryY + boundaryH - 16 : boundaryY + 8;
          
          if (tile) {
            for (let py = 0; py < 8; py++) {
              for (let px = 0; px < 8; px++) {
                const color = tile.data[py][px];
                if (color) {
                  ctx.fillStyle = color;
                  ctx.fillRect((hudX + px) * zoom, (hudY + py) * zoom, zoom, zoom);
                }
              }
            }
          }
          
          ctx.font = `bold ${Math.max(10, 8 * zoom)}px monospace`;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 2;
          const hudText = `x ${maxHp}`;
          ctx.strokeText(hudText, (hudX + 12) * zoom, (hudY + 4) * zoom);
          ctx.fillText(hudText, (hudX + 12) * zoom, (hudY + 4) * zoom);
          ctx.restore();
        }

        // Render HUD if player has displayBonusInHud enabled
        if (player && player.displayBonusInHud) {
          const hudTileId = player.hudBonusTileId ?? 5;
          const tile = getTileById(hudTileId);
          const maxBonus = player.playerMaxBonus ?? 10;
          const hudPosition = player.hudPosition || 'top';
          
          ctx.save();
          ctx.font = `bold ${Math.max(10, 8 * zoom)}px monospace`;
          const hudText = `x ${maxBonus}`;
          const textWidth = ctx.measureText(hudText).width;
          
          const rightMargin = 8 * zoom;
          const tileWidth = 8 * zoom;
          const spacing = 4 * zoom;
          
          const canvasWidth = boundaryW * zoom;
          const hudX = boundaryX * zoom + canvasWidth - rightMargin - tileWidth - spacing - textWidth;
          const hudY = (hudPosition === 'bottom' ? boundaryY + boundaryH - 16 : boundaryY + 8) * zoom;
          
          if (tile) {
            for (let py = 0; py < 8; py++) {
              for (let px = 0; px < 8; px++) {
                const color = tile.data[py][px];
                if (color) {
                  ctx.fillStyle = color;
                  ctx.fillRect(hudX + px * zoom, hudY + py * zoom, zoom, zoom);
                }
              }
            }
          }
          
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 2;
          ctx.strokeText(hudText, hudX + (8 + 4) * zoom, hudY + 4 * zoom);
          ctx.fillText(hudText, hudX + (8 + 4) * zoom, hudY + 4 * zoom);
          ctx.restore();
        }
      }

      ctx.globalAlpha = 1.0;
    } catch (e) {
      console.error("[Canvas Render] Error during rendering:", e);
    }
  }, [renderLayersToCtx, dimensions, zoom, viewActiveOnly, activeLayerId, layers, tool, isDrawing, panOffset, selection, canvasRef, actors, activeActorId, triggers, activeTriggerId, collisions, activeCollisionId, tempPaintedCollisions, tempPaintedTriggers, savedTiles, getTileById, onionSkinEnabled, frames, activeFrameId, scenes, activeSceneId, hudSettings, variables, showGbaMask]);

  // Set initial zoom based on available canvas area
  useEffect(() => {
    if (!initialZoomSet && containerRef.current && dimensions.w > 0 && dimensions.h > 0 && setZoom) {
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        // Leave some space for rulers (20px) and a small margin
        const availableW = rect.width - 60; 
        const availableH = rect.height - 60;
        const fitZoom = Math.min(availableW / dimensions.w, availableH / dimensions.h);
        const initialZoom = Math.max(0.1, Math.min(4, fitZoom)); // 400% max, or whatever fits
        setZoom(initialZoom);
        setInitialZoomSet(true);
      }
    }
  }, [dimensions.w, dimensions.h, initialZoomSet, setZoom, containerRef]);

  // Ruler rendering loop
  useEffect(() => {
    if (!rulerXRef.current || !rulerYRef.current || viewportSize.w === 0) return;

    const ctxX = rulerXRef.current.getContext('2d');
    const ctxY = rulerYRef.current.getContext('2d');

    rulerXRef.current.width = viewportSize.w - 20;
    rulerXRef.current.height = 20;
    rulerYRef.current.width = 20;
    rulerYRef.current.height = viewportSize.h - 20;

    ctxX.clearRect(0, 0, rulerXRef.current.width, 20);
    ctxY.clearRect(0, 0, 20, rulerYRef.current.height);

    ctxX.fillStyle = '#888';
    ctxX.font = '10px sans-serif';
    ctxX.textBaseline = 'top';

    ctxY.fillStyle = '#888';
    ctxY.font = '10px sans-serif';
    ctxY.textAlign = 'center';
    ctxY.textBaseline = 'middle';

    const step = zoom >= 10 ? 1 : zoom >= 5 ? 5 : zoom >= 2 ? 10 : zoom >= 0.5 ? 50 : zoom >= 0.1 ? 100 : zoom >= 0.05 ? 500 : 1000;

    const startCanvasX = -(viewX - 20) / zoom;
    const endCanvasX = startCanvasX + (viewportSize.w - 20) / zoom;
    const firstX = Math.floor(startCanvasX / step) * step;

    for (let x = firstX; x <= endCanvasX; x += step) {
      const px = viewX - 20 + x * zoom;
      if (px >= 0 && px <= viewportSize.w - 20) {
        ctxX.fillRect(px, 15, 1, 5);
        if (x % (step * (zoom >= 10 ? 5 : 2)) === 0 || step >= 10) {
          ctxX.fillText(x.toString(), px + 2, 2);
        }
      }
    }

    const startCanvasY = -(viewY - 20) / zoom;
    const endCanvasY = startCanvasY + (viewportSize.h - 20) / zoom;
    const firstY = Math.floor(startCanvasY / step) * step;

    for (let y = firstY; y <= endCanvasY; y += step) {
      const py = viewY - 20 + y * zoom;
      if (py >= 0 && py <= viewportSize.h - 20) {
        ctxY.fillRect(15, py, 5, 1);
        if (y % (step * (zoom >= 10 ? 5 : 2)) === 0 || step >= 10) {
          ctxY.save();
          ctxY.translate(10, py);
          ctxY.rotate(-Math.PI / 2);
          ctxY.fillText(y.toString(), 0, 0);
          ctxY.restore();
        }
      }
    }
  }, [zoom, viewX, viewY, viewportSize, rulerXRef, rulerYRef]);

  // Rendering Selection Overlay Loop
  useEffect(() => {
    let animationFrameId;
    const drawSelection = () => {
      animationFrameId = requestAnimationFrame(drawSelection);
      if (!selectionRef.current) return;
      const ctx = selectionRef.current.getContext('2d');
      ctx.imageSmoothingEnabled = isPixelated ? false : true;
      ctx.clearRect(0, 0, dimensions.w * zoom, dimensions.h * zoom);

      if (['drawRect', 'drawRectFill', 'drawRoundRect', 'drawRoundRectFill', 'drawCircle', 'drawCircleFill', 'drawLine'].includes(tool) && isDrawing && selectionStart) {
        let targetX = cursorPos.x;
        let targetY = cursorPos.y;
        if (isShiftPressed) {
          const dx = targetX - selectionStart.x;
          const dy = targetY - selectionStart.y;
          const size = Math.max(Math.abs(dx), Math.abs(dy));
          targetX = selectionStart.x + (Math.sign(dx) || 1) * size;
          targetY = selectionStart.y + (Math.sign(dy) || 1) * size;
        }
        let pixels = getShapePixels(tool, selectionStart.x, selectionStart.y, targetX, targetY);
        pixels = pixels.map(p => ({ ...p, color: currentColor }));
        pixels = getBrushPixels(pixels, drawWidth, brushType, colorJitter);
        pixels = getSymmetricPixels(pixels, dimensions.w, dimensions.h, symmetryMode);
        ctx.globalAlpha = brushOpacity / 100;
        pixels.forEach(p => {
          ctx.fillStyle = p.color || currentColor;
          ctx.fillRect(p.x * zoom, p.y * zoom, zoom, zoom);
        });
        ctx.globalAlpha = 1.0;
      }

      if (tool === 'gradient' && isDrawing && selectionStart) {
        let targetX = cursorPos.x;
        let targetY = cursorPos.y;
        if (isShiftPressed) {
          const dx = targetX - selectionStart.x;
          const dy = targetY - selectionStart.y;
          const size = Math.max(Math.abs(dx), Math.abs(dy));
          targetX = selectionStart.x + (Math.sign(dx) || 1) * size;
          targetY = selectionStart.y + (Math.sign(dy) || 1) * size;
        }
        let pixels = getGradientPixels(selectionStart.x, selectionStart.y, targetX, targetY);
        pixels = getSymmetricPixels(pixels, dimensions.w, dimensions.h, symmetryMode);
        ctx.globalAlpha = brushOpacity / 100;
        pixels.forEach(p => {
          ctx.fillStyle = p.color;
          ctx.fillRect(p.x * zoom, p.y * zoom, zoom, zoom);
        });
        ctx.globalAlpha = 1.0;

        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo((selectionStart.x + 0.5) * zoom, (selectionStart.y + 0.5) * zoom);
        ctx.lineTo((targetX + 0.5) * zoom, (targetY + 0.5) * zoom);
        ctx.strokeStyle = '#fff';
        ctx.setLineDash([]);
        ctx.stroke();
        ctx.strokeStyle = '#4CAF50';
        ctx.setLineDash([2, 2]);
        ctx.lineDashOffset = -(performance.now() / 100);
        ctx.stroke();
      }

      if (tool === 'tile' && cursorPos.x >= 0 && cursorPos.x < dimensions.w && cursorPos.y >= 0 && cursorPos.y < dimensions.h) {
        const activeTile = savedTiles?.find(t => t.id === activeSavedTileId);
        const points = getSymmetricPixels([{ x: cursorPos.x, y: cursorPos.y }], dimensions.w, dimensions.h, symmetryMode);

        points.forEach(p => {
          const snapX = Math.floor(p.x / 8) * 8;
          const snapY = Math.floor(p.y / 8) * 8;
          if (activeTile) {
            ctx.globalAlpha = 0.6;
            for (let py = 0; py < 8; py++) {
              for (let px = 0; px < 8; px++) {
                const pixelVal = activeTile.data[py][px];
                if (pixelVal !== null) {
                  ctx.fillStyle = pixelVal;
                  ctx.fillRect((snapX + px) * zoom, (snapY + py) * zoom, zoom, zoom);
                }
              }
            }
            ctx.globalAlpha = 1.0;
          } else {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.fillRect(snapX * zoom, snapY * zoom, 8 * zoom, 8 * zoom);
          }
          ctx.strokeStyle = '#fff';
          ctx.setLineDash([]);
          ctx.strokeRect(snapX * zoom, snapY * zoom, 8 * zoom, 8 * zoom);
          ctx.strokeStyle = '#4CAF50';
          ctx.setLineDash([2, 2]);
          ctx.lineDashOffset = -(performance.now() / 100);
          ctx.strokeRect(snapX * zoom, snapY * zoom, 8 * zoom, 8 * zoom);
        });
      }

      if (tool === 'text') {
        if (textSettings.text) {
          let activeFont = textSettings.font;
          if (activeFont === 'custom' && textSettings.customFont) {
            activeFont = `'${textSettings.customFont}', sans-serif`;
          }
          ctx.globalAlpha = 0.6;
          const fontStyle = `${textSettings.italic ? 'italic ' : ''}${textSettings.bold ? 'bold ' : ''}${textSettings.size}px ${activeFont}`;
          ctx.font = fontStyle;
          ctx.textBaseline = 'top';
          ctx.textAlign = textSettings.align || 'left';
          ctx.fillStyle = currentColor;

          ctx.save();
          ctx.scale(zoom, zoom);
          if (textSettings.outline) {
            ctx.lineJoin = 'round';
            ctx.lineWidth = 2; // Scales with zoom automatically to exactly a 1px outline
            ctx.strokeStyle = textSettings.outlineColor || '#000000';
            ctx.strokeText(textSettings.text || "Text...", textSettings.x, textSettings.y);
          }
          ctx.fillText(textSettings.text || "Text...", textSettings.x, textSettings.y);
          ctx.restore();

          ctx.globalAlpha = 1.0;
        } else if (cursorPos.x >= 0 && cursorPos.x < dimensions.w && cursorPos.y >= 0 && cursorPos.y < dimensions.h) {
          ctx.strokeStyle = currentColor;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(cursorPos.x * zoom, (cursorPos.y - 4) * zoom);
          ctx.lineTo(cursorPos.x * zoom, (cursorPos.y + 12) * zoom);
          ctx.stroke();
        }
      }

      if (tool === 'lasso' && lassoPath && lassoPath.length > 0) {
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo((lassoPath[0].x + 0.5) * zoom, (lassoPath[0].y + 0.5) * zoom);
        for (let i = 1; i < lassoPath.length; i++) {
          ctx.lineTo((lassoPath[i].x + 0.5) * zoom, (lassoPath[i].y + 0.5) * zoom);
        }
        ctx.closePath();
        ctx.strokeStyle = '#fff';
        ctx.setLineDash([]);
        ctx.stroke();
        ctx.strokeStyle = '#4CAF50';
        ctx.setLineDash([2, 2]);
        ctx.lineDashOffset = -(performance.now() / 100);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.fill();
      }

      if (guides.x.length > 0 || guides.y.length > 0 || draggingGuide) {
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = Math.max(1, 1 / zoom);
        ctx.setLineDash([]);

        guides.x.forEach(gx => {
          ctx.beginPath();
          ctx.moveTo(gx * zoom, 0);
          ctx.lineTo(gx * zoom, dimensions.h * zoom);
          ctx.stroke();
        });

        guides.y.forEach(gy => {
          ctx.beginPath();
          ctx.moveTo(0, gy * zoom);
          ctx.lineTo(dimensions.w * zoom, gy * zoom);
          ctx.stroke();
        });

        if (draggingGuide && draggingGuide.val !== null) {
          ctx.strokeStyle = 'rgba(0, 255, 255, 0.5)';
          ctx.beginPath();
          if (draggingGuide.axis === 'x') { ctx.moveTo(draggingGuide.val * zoom, 0); ctx.lineTo(draggingGuide.val * zoom, dimensions.h * zoom); }
          else { ctx.moveTo(0, draggingGuide.val * zoom); ctx.lineTo(dimensions.w * zoom, draggingGuide.val * zoom); }
          ctx.stroke();
        }
      }

      if (transformData) {
        ctx.imageSmoothingEnabled = false;
        for (let dy = 0; dy < transformData.h; dy++) {
          for (let dx = 0; dx < transformData.w; dx++) {
            const sX = Math.floor((dx / transformData.w) * transformData.origW);
            const sY = Math.floor((dy / transformData.h) * transformData.origH);
            const color = transformData.pixels[sY]?.[sX];
            if (color) {
              ctx.fillStyle = color;
              ctx.fillRect((transformData.x + dx) * zoom, (transformData.y + dy) * zoom, zoom, zoom);
            }
          }
        }

        ctx.strokeStyle = '#4CAF50';
        ctx.setLineDash([]);
        ctx.strokeRect(transformData.x * zoom, transformData.y * zoom, transformData.w * zoom, transformData.h * zoom);
        ctx.fillStyle = '#4CAF50';
        const hs = 8;
        const hhs = hs / 2;
        ctx.fillRect(transformData.x * zoom - hhs, transformData.y * zoom - hhs, hs, hs);
        ctx.fillRect((transformData.x + transformData.w) * zoom - hhs, transformData.y * zoom - hhs, hs, hs);
        ctx.fillRect(transformData.x * zoom - hhs, (transformData.y + transformData.h) * zoom - hhs, hs, hs);
        ctx.fillRect((transformData.x + transformData.w) * zoom - hhs, (transformData.y + transformData.h) * zoom - hhs, hs, hs);
        return;
      }

      if ((tool === 'pen' || tool === 'brush' || tool === 'eraser') && !isDrawing) {
        if (cursorPos.x >= 0 && cursorPos.x < dimensions.w && cursorPos.y >= 0 && cursorPos.y < dimensions.h) {
          let points = getBrushPixels([{ x: cursorPos.x, y: cursorPos.y, color: currentColor }], drawWidth, brushType, colorJitter);
          points = getSymmetricPixels(points, dimensions.w, dimensions.h, symmetryMode);
          ctx.globalAlpha = tool === 'eraser' ? 0.5 : (brushOpacity / 100) * 0.8;
          points.forEach(p => {
            if (tool === 'eraser') {
              ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
            } else {
              ctx.fillStyle = p.color || currentColor;
            }
            ctx.fillRect(p.x * zoom, p.y * zoom, zoom, zoom);
          });
          ctx.globalAlpha = 1.0;
        }
      }

      if ((tool === 'actor' || tool === 'spawn') && activeActorId) {
        const actor = actors.find(a => a.id === activeActorId && a.type !== 'group') || sceneGlobalActors.find(a => a.id === activeActorId && a.type !== 'group');
        if (actor) {
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 1;
          ctx.setLineDash([]);
          ctx.strokeRect(actor.x * zoom, actor.y * zoom, actor.width * zoom, actor.height * zoom);
          ctx.strokeStyle = '#65ff00';
          ctx.setLineDash([2, 2]);
          ctx.lineDashOffset = -(performance.now() / 100);
          ctx.strokeRect(actor.x * zoom, actor.y * zoom, actor.width * zoom, actor.height * zoom);
        }
      }

      if (tool === 'trigger' && activeTriggerId) {
        const trigger = triggers.find(t => t.id === activeTriggerId);
        if (trigger) {
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 1;
          ctx.setLineDash([]);
          ctx.strokeRect(trigger.x * zoom, trigger.y * zoom, trigger.width * zoom, trigger.height * zoom);
          ctx.strokeStyle = '#ff9800';
          ctx.setLineDash([2, 2]);
          ctx.lineDashOffset = -(performance.now() / 100);
          ctx.strokeRect(trigger.x * zoom, trigger.y * zoom, trigger.width * zoom, trigger.height * zoom);
        }
      }

      if (!selection) return;
      ctx.lineWidth = 1;
      ctx.beginPath();
      selection.forEach(key => {
        const [x, y] = key.split(',').map(Number);
        const px = x * zoom;
        const py = y * zoom;
        if (!selection.has(`${x},${y - 1}`)) {
          ctx.moveTo(px, py);
          ctx.lineTo(px + zoom, py);
        }
        if (!selection.has(`${x + 1},${y}`)) {
          ctx.moveTo(px + zoom, py);
          ctx.lineTo(px + zoom, py + zoom);
        }
        if (!selection.has(`${x},${y + 1}`)) {
          ctx.moveTo(px, py + zoom);
          ctx.lineTo(px + zoom, py + zoom);
        }
        if (!selection.has(`${x - 1},${y}`)) {
          ctx.moveTo(px, py);
          ctx.lineTo(px, py + zoom);
        }
      });
      ctx.strokeStyle = '#fff';
      ctx.setLineDash([]);
      ctx.stroke();
      ctx.strokeStyle = '#4CAF50';
      ctx.setLineDash([2, 2]);
      ctx.lineDashOffset = -(performance.now() / 100);
      ctx.stroke();
    };
    animationFrameId = requestAnimationFrame(drawSelection);
    return () => cancelAnimationFrame(animationFrameId);
  }, [selection, zoom, dimensions.w, dimensions.h, tool, cursorPos, savedTiles, activeSavedTileId, currentColor, isDrawing, selectionStart, getShapePixels, getGradientPixels, editingTextLayerId, textSettings, lassoPath, transformData, symmetryMode, getSymmetricPixels, drawWidth, getBrushPixels, brushType, colorJitter, brushOpacity, isShiftPressed, guides, draggingGuide, isPixelated, selectionRef]);

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      style={{ flex: 1, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#121212', position: 'relative' }}
    >
      {/* Rulers */}
      <div onMouseDown={() => setDraggingGuide({ axis: 'y', val: null })} style={{ position: 'absolute', top: 0, left: 20, right: 0, height: 20, background: '#111', borderBottom: '1px solid #333', zIndex: 5, overflow: 'hidden', cursor: 'row-resize' }}>
        <canvas ref={rulerXRef} style={{ display: 'block' }} />
        <div style={{ position: 'absolute', top: 0, left: viewX - 20 + cursorPos.x * zoom, width: 1, height: 20, backgroundColor: '#4CAF50', pointerEvents: 'none' }} />
      </div>

      <div onMouseDown={() => setDraggingGuide({ axis: 'x', val: null })} style={{ position: 'absolute', top: 20, left: 0, bottom: 0, width: 20, background: '#111', borderRight: '1px solid #333', zIndex: 5, overflow: 'hidden', cursor: 'col-resize' }}>
        <canvas ref={rulerYRef} style={{ display: 'block' }} />
        <div style={{ position: 'absolute', top: viewY - 20 + cursorPos.y * zoom, left: 0, width: 20, height: 1, backgroundColor: '#4CAF50', pointerEvents: 'none' }} />
      </div>

      <div style={{ position: 'absolute', top: 0, left: 0, width: 20, height: 20, background: '#111', borderRight: '1px solid #333', borderBottom: '1px solid #333', zIndex: 6 }} />

      <div style={{
        position: 'absolute',
        transform: `translate(${panOffset.x}px, ${panOffset.y}px)`,
        boxShadow: '0 0 20px rgba(0,0,0,0.8)',
        width: dimensions.w * zoom,
        height: dimensions.h * zoom,
        backgroundImage: `linear-gradient(45deg, #333 25%, transparent 25%), linear-gradient(-45deg, #333 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #333 75%), linear-gradient(-45deg, transparent 75%, #333 75%)`,
        backgroundSize: `${zoom * 2}px ${zoom * 2}px`,
        backgroundPosition: `0 0, 0 ${zoom}px, ${zoom}px -${zoom}px, -${zoom}px 0px`
      }}>
        {isPixelated && gridSize > 0 && (
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1,
            backgroundImage: `linear-gradient(to right, rgba(0, 0, 0, 0.2) 1px, transparent 1px), linear-gradient(to bottom, rgba(0, 0, 0, 0.2) 1px, transparent 1px)`,
            backgroundSize: `${gridSize * zoom}px ${gridSize * zoom}px`
          }} />
        )}
        <canvas
          ref={canvasRef}
          width={Math.ceil(dimensions.w * zoom)}
          height={Math.ceil(dimensions.h * zoom)}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{ imageRendering: isPixelated ? 'pixelated' : 'auto', cursor: isPanning || tool === 'grab' ? (isPanning ? 'grabbing' : 'grab') : ['pen', 'brush', 'eraser', 'fill', 'gradient', 'tile', 'tileFill', 'collisionFill', 'lasso'].includes(tool) ? 'crosshair' : tool === 'text' ? 'text' : 'default', width: '100%', height: '100%', display: 'block' }}
        />
        <canvas
          ref={selectionRef}
          width={Math.ceil(dimensions.w * zoom)}
          height={Math.ceil(dimensions.h * zoom)}
          style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', imageRendering: isPixelated ? 'pixelated' : 'auto', zIndex: 2 }}
        />
      </div>
      {showGbaMask && (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: `${240 * zoom}px`,
            height: `${160 * zoom}px`,
            pointerEvents: 'none',
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.6)',
            border: '1px solid rgba(255, 255, 255, 0.4)',
            boxSizing: 'border-box',
            zIndex: 4
          }}
        />
      )}

      {/* Debug Info Overlay */}
      {/* <div style={{ position: 'absolute', bottom: 10, left: 30, background: 'rgba(0,0,0,0.85)', color: '#fff', padding: '12px', fontSize: '11px', zIndex: 100, pointerEvents: 'none', borderRadius: '6px', border: '1px solid #444', fontFamily: 'monospace', display: 'flex', flexDirection: 'column', gap: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
        <div style={{ fontWeight: 'bold', color: '#4CAF50', borderBottom: '1px solid #444', paddingBottom: '4px', marginBottom: '4px' }}>Canvas Debug Info</div>
        <div>Zoom: {Math.round(zoom * 100)}%</div>
        <div>Layers: {layers.length}</div>
        <div>Active ID: {activeLayerId}</div>
        <div>Dimensions: {dimensions.w}x{dimensions.h}</div>
        <div>Canvas Size: {Math.ceil(dimensions.w * zoom)}x{Math.ceil(dimensions.h * zoom)}</div>
        <div>Renders: {renderCount}</div>
        {lastError && <div style={{ color: '#ff4444', marginTop: '4px' }}>Error: {lastError}</div>}
      </div> */}

      {/* Drag overlay */}
      {dragCounter > 0 && (
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(76, 175, 80, 0.15)',
          border: '3px dashed #4CAF50',
          borderRadius: '8px',
          margin: '10px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          pointerEvents: 'none',
          boxSizing: 'border-box',
          backdropFilter: 'blur(3px)',
          transition: 'all 0.2s ease-in-out'
        }}>
          <div style={{
            background: '#222',
            border: '1px solid #4CAF50',
            color: '#fff',
            padding: '16px 28px',
            borderRadius: '6px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px'
          }}>
            <BsUpload size={28} style={{ color: '#4CAF50' }} />
            <span style={{ fontWeight: 'bold', fontSize: '14px', letterSpacing: '0.5px' }}>Drop Image to Import as Layer</span>
            <span style={{ color: '#888', fontSize: '11px' }}>Will fit within: {dimensions.w}x{dimensions.h} px (maintaining aspect ratio)</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default Canvas;
