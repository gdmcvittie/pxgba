import JSZip from 'jszip';

function decompressCollisions(str) {
  if (!str || typeof str !== 'string') return [];
  const result = [];
  let i = 0;
  while (i < str.length) {
    let valueHex = '';
    if (str[i] === '!' && i + 1 < str.length) {
      result.push(0);
      i++;
      continue;
    }
    while (i < str.length && /[0-9a-f]/i.test(str[i]) && valueHex.length < 2) {
      valueHex += str[i];
      i++;
    }
    if (!valueHex) {
      i++;
      continue;
    }
    const value = parseInt(valueHex, 16);
    if (i < str.length && str[i] === '!') {
      result.push(value);
      i++;
    } else if (i < str.length && str[i] === '+') {
      result.push(value);
      i++;
    } else if (i < str.length && /[0-9a-f]/i.test(str[i])) {
      let countHex = '';
      while (i < str.length && /[0-9a-f]/i.test(str[i])) {
        countHex += str[i];
        i++;
      }
      const count = parseInt(countHex, 16);
      if (i < str.length && str[i] === '+') i++;
      for (let c = 0; c < count; c++) result.push(value);
    } else {
      result.push(value);
    }
  }
  return result;
}

/**
 * Extracts and converts a GB Studio project (.zip) into a PxGBA-compatible project object.
 * 
 * @param {File|Blob} zipFile The uploaded zip file containing the GB Studio project.
 * @param {Array} initialTiles The existing initial default tiles in PxGBA (to avoid conflicting IDs).
 * @param {Array} currentPalette The active color palette.
 * @returns {Promise<{ project: Object, warnings: string[] }>}
 */
export async function importGbStudioProject(zipFile, initialTiles = [], currentPalette = []) {
  const warnings = [];
  const zip = await JSZip.loadAsync(zipFile);

  // 1. Find the main project file
  const gbsprojFile = Object.keys(zip.files).find(name => name.endsWith('.gbsproj'));
  if (!gbsprojFile) {
    throw new Error('No .gbsproj file found in the uploaded archive.');
  }

  const projectText = await zip.files[gbsprojFile].async('text');
  const gbsProj = JSON.parse(projectText);

  // Shared group for all imported tiles
  const importGroupId = Date.now() + Math.random();

  // Expose variable and scene maps to link actor/trigger logic
  const sceneIdMap = {};
  const variableIdMap = {};
  const customScripts = [];
  const globalActors = [];
  const musicTracks = [];

  // Load modular background configs if not monolithic
  let gbsBackgrounds = gbsProj.backgrounds || [];
  if (gbsBackgrounds.length === 0) {
    const bgFiles = Object.keys(zip.files).filter(name => 
      name.includes('backgrounds/') && name.endsWith('.gbsres')
    );
    for (const sPath of bgFiles) {
      try {
        const text = await zip.files[sPath].async('text');
        gbsBackgrounds.push(JSON.parse(text));
      } catch (err) {
        warnings.push(`Failed to read background config "${sPath}": ${err.message}`);
      }
    }
  }

  // Load modular sprite configs if not monolithic
  let gbsSprites = gbsProj.sprites || [];
  if (gbsSprites.length === 0) {
    const spriteFiles = Object.keys(zip.files).filter(name => 
      name.includes('sprites/') && name.endsWith('.gbsres')
    );
    for (const sPath of spriteFiles) {
      try {
        const text = await zip.files[sPath].async('text');
        gbsSprites.push(JSON.parse(text));
      } catch (err) {
        warnings.push(`Failed to read sprite config "${sPath}": ${err.message}`);
      }
    }
  }

  // Load modular music configs if not monolithic
  let gbsMusic = gbsProj.music || [];
  if (gbsMusic.length === 0) {
    const musicFiles = Object.keys(zip.files).filter(name => 
      name.includes('music/') && name.endsWith('.gbsres')
    );
    for (const sPath of musicFiles) {
      try {
        const text = await zip.files[sPath].async('text');
        gbsMusic.push(JSON.parse(text));
      } catch (err) {
        warnings.push(`Failed to read music config "${sPath}": ${err.message}`);
      }
    }
  }

  // 1. Ingest Scenes first to determine referenced assets
  const scenes = [];
  let gbsScenes = [];
  const scenePathMap = {};

  if (gbsProj.scenes && Array.isArray(gbsProj.scenes)) {
    gbsProj.scenes.forEach(s => { gbsScenes.push(s); });
  }

  const sceneFiles = Object.keys(zip.files).filter(name => 
    name.includes('scenes/') && name.endsWith('.gbsres')
  );
  for (const sPath of sceneFiles) {
    try {
      const text = await zip.files[sPath].async('text');
      const parsed = JSON.parse(text);
      if (parsed && parsed._resourceType === 'scene') {
        gbsScenes.push(parsed);
        const dir = sPath.substring(0, sPath.lastIndexOf('/') + 1);
        scenePathMap[parsed.id] = dir;
      }
    } catch (err) {
      warnings.push(`Failed to read scene config "${sPath}": ${err.message}`);
    }
  }

  // Pre-map GBS scene IDs to target PxGBA scene IDs (sequential integers)
  gbsScenes.forEach((s, idx) => {
    if (s && s.id) {
      sceneIdMap[s.id] = idx + 1;
    }
  });

  // Collect used asset IDs (also scan modular actor files)
  const usedBackgroundIds = new Set();
  const usedSpriteSheetIds = new Set();
  const usedMusicIds = new Set();

  gbsScenes.forEach(scene => {
    if (scene.backgroundId) {
      usedBackgroundIds.add(scene.backgroundId);
    }
    if (scene.musicId) {
      usedMusicIds.add(scene.musicId);
    }
    if (scene.playerSpriteSheetId) {
      usedSpriteSheetIds.add(scene.playerSpriteSheetId);
    }
    if (scene.actors && Array.isArray(scene.actors)) {
      scene.actors.forEach(actor => {
        if (actor.spriteSheetId) {
          usedSpriteSheetIds.add(actor.spriteSheetId);
        }
      });
    }
  });

  // Scan modular actor files for used sprite IDs
  for (const zipPath of Object.keys(zip.files)) {
    if (zipPath.includes('scenes/') && zipPath.includes('/actors/') && zipPath.endsWith('.gbsres')) {
      try {
        const text = await zip.files[zipPath].async('text');
        const parsed = JSON.parse(text);
        if (parsed && parsed.spriteSheetId) {
          usedSpriteSheetIds.add(parsed.spriteSheetId);
        }
      } catch (e) {
        // skip unparseable
      }
    }
  }

  if (gbsProj.settings) {
    if (gbsProj.settings.defaultPlayerSpriteSheetId) {
      usedSpriteSheetIds.add(gbsProj.settings.defaultPlayerSpriteSheetId);
    }
    if (gbsProj.settings.defaultPlayerSprites) {
      Object.values(gbsProj.settings.defaultPlayerSprites).forEach(id => {
        if (id) usedSpriteSheetIds.add(id);
      });
    }
  }

  // Parse variables BEFORE any translateEventList calls (needed for variableIdMap)
  const variables = [];
  const playerGroup = { id: 9, type: 'group', name: 'PLAYER', isOpen: true };
  variables.push(playerGroup);

  const defaultPlayerVars = [
    { id: 1, name: 'PLAYER_HP', type: 'number', initialValue: 10, groupId: 9 },
    { id: 2, name: 'PLAYER_BONUS', type: 'number', initialValue: 0, groupId: 9 },
    { id: 3, name: 'PLAYER_KEYS', type: 'number', initialValue: 0, groupId: 9 },
    { id: 4, name: 'PLAYER_AMMO', type: 'number', initialValue: 100, groupId: 9 },
    { id: 5, name: 'PLAYER_MAX_AMMO', type: 'number', initialValue: 100, groupId: 9 },
    { id: 6, name: 'PLAYER_GRENADES', type: 'number', initialValue: 0, groupId: 9 },
    { id: 7, name: 'PLAYER_MAGNET', type: 'number', initialValue: 0, groupId: 9 },
    { id: 8, name: 'PLAYER_XP', type: 'number', initialValue: 0, groupId: 9 },
    { id: 10, name: 'PLAYER_MAX_HP', type: 'number', initialValue: 10, groupId: 9 },
    { id: 11, name: 'PLAYER_MAX_XP', type: 'number', initialValue: 100, groupId: 9 },
    { id: 12, name: 'PLAYER_MAX_BONUS', type: 'number', initialValue: 100, groupId: 9 },
    { id: 13, name: 'PLAYER_MAX_GRENADES', type: 'number', initialValue: 5, groupId: 9 }
  ];
  variables.push(...defaultPlayerVars);

  let gbsVariables = gbsProj.variables;
  if (!gbsVariables || !Array.isArray(gbsVariables)) {
    const varFilePath = Object.keys(zip.files).find(name => name.endsWith('variables.gbsres'));
    if (varFilePath) {
      try {
        const varText = await zip.files[varFilePath].async('text');
        const varData = JSON.parse(varText);
        gbsVariables = varData.variables;
      } catch (err) {
        warnings.push(`Failed to read variables file: ${err.message}`);
      }
    }
  }

  if (gbsVariables && Array.isArray(gbsVariables)) {
    const importedVars = [];
    gbsVariables.forEach((v, index) => {
      if (!v) return;
      const cleanName = String(v.name || `VAR_${v.id || index}`).replace(/[^a-zA-Z0-9_]/g, '_').toUpperCase();
      variableIdMap[v.id] = cleanName;
      if (!defaultPlayerVars.some(dpv => dpv.name === cleanName)) {
        importedVars.push(v);
      }
    });
    if (importedVars.length > 0) {
      const importedVarGroup = { id: Date.now() + Math.random() + 400, type: 'group', name: 'Imported Variables', isOpen: true };
      variables.push(importedVarGroup);
      importedVars.forEach((v, index) => {
        const cleanName = String(v.name || `VAR_${v.id || index}`).replace(/[^a-zA-Z0-9_]/g, '_').toUpperCase();
        variables.push({
          id: Date.now() + Math.random() + index,
          name: cleanName,
          type: 'number',
          initialValue: parseInt(v.defaultValue) || 0,
          groupId: importedVarGroup.id
        });
      });
    }
  }

  // Load custom scripts for EVENT_CALL_CUSTOM_EVENT resolution
  const customEventScripts = {};
  const scriptFiles = Object.keys(zip.files).filter(name =>
    name.includes('/scripts/') && name.endsWith('.gbsres')
  );
  const customScriptsGroup = { id: Date.now() + Math.random() + 300, type: 'group', name: 'Imported Scripts', isGroup: true, isOpen: true };
  customScripts.push(customScriptsGroup);
  for (const sPath of scriptFiles) {
    try {
      const text = await zip.files[sPath].async('text');
      const parsed = JSON.parse(text);
      if (parsed && parsed._resourceType === 'script') {
        customEventScripts[parsed.id] = parsed;
        const translatedScript = translateEventList(parsed.script || [], sceneIdMap, variableIdMap);
        customScripts.push({
          id: parsed.id,
          name: parsed.name || 'Unnamed Script',
          script: translatedScript,
          groupId: customScriptsGroup.id
        });
      }
    } catch (err) {
      // skip
    }
  }

  // Map GBS resource IDs to clean filename tokens
  const usedBackgroundFiles = new Set();
  usedBackgroundIds.forEach(id => {
    usedBackgroundFiles.add(id);
    const bgAsset = gbsBackgrounds?.find(b => b.id === id);
    if (bgAsset && bgAsset.filename) {
      usedBackgroundFiles.add(bgAsset.filename);
      usedBackgroundFiles.add(bgAsset.filename.replace(/\.[^/.]+$/, ''));
    }
  });

  const usedSpriteFiles = new Set();
  usedSpriteSheetIds.forEach(id => {
    usedSpriteFiles.add(id);
    const spriteAsset = gbsSprites?.find(s => s.id === id);
    if (spriteAsset && spriteAsset.filename) {
      usedSpriteFiles.add(spriteAsset.filename);
      usedSpriteFiles.add(spriteAsset.filename.replace(/\.[^/.]+$/, ''));
    }
    const spriteName = String(id).replace(/\.[^/.]+$/, '');
    usedSpriteFiles.add(spriteName);
  });

  const usedMusicFiles = new Set();
  usedMusicIds.forEach(id => {
    usedMusicFiles.add(id);
    const musicAsset = gbsMusic?.find(m => m.id === id);
    if (musicAsset && musicAsset.filename) {
      usedMusicFiles.add(musicAsset.filename);
      usedMusicFiles.add(musicAsset.filename.replace(/\.[^/.]+$/, ''));
    }
    const musicName = String(id).replace(/\.[^/.]+$/, '');
    usedMusicFiles.add(musicName);
  });

  // 2. Parse referenced Sprites & Slices only
  const savedTiles = [...initialTiles];
  const animations = [];
  const spriteIdMap = {};

  const spriteFiles = Object.keys(zip.files).filter(name => {
    if (!name.includes('assets/sprites/') || (!name.endsWith('.png') && !name.endsWith('.PNG'))) {
      return false;
    }
    const spriteName = name.split('/').pop().replace(/\.[^/.]+$/, '');
    const match = usedSpriteFiles.has(spriteName) || [...usedSpriteFiles].some(uf => name.includes(uf));
    return match;
  });

  let tileIdCounter = Date.now();

  // Helper: extract an 8x8 tile from image data
  const extractTileData = (imgData, imgWidth, imgHeight, px, py) => {
    const tileData = Array(8).fill(null).map(() => Array(8).fill(null));
    let hasPixels = false;
    for (let ty = 0; ty < 8; ty++) {
      for (let tx = 0; tx < 8; tx++) {
        const x = px + tx;
        const y = py + ty;
        if (x >= 0 && x < imgWidth && y >= 0 && y < imgHeight) {
          const idx = (y * imgWidth + x) * 4;
          const a = imgData[idx + 3];
          if (a > 128) {
            const r = imgData[idx];
            const g = imgData[idx + 1];
            const b = imgData[idx + 2];
            if (r === 101 && g === 255 && b === 0) continue;
            tileData[ty][tx] = '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
            hasPixels = true;
          }
        }
      }
    }
    return { data: tileData, hasPixels };
  };

  // Map (displayX, displayY) to frame slot index: 0=TL, 1=TR, 2=BL, 3=BR
  const displayPosToSlot = (x, y, cw) => {
    if (cw <= 8) {
      return y < 8 ? 0 : 2;
    }
    const col = x < 8 ? 0 : 1;
    const row = y < 8 ? 0 : 1;
    return row * 2 + col;
  };

  for (const spritePath of spriteFiles) {
    try {
      const spriteName = spritePath.split('/').pop().replace(/\.[^/.]+$/, '');
      const spriteBlob = await zip.files[spritePath].async('blob');
      const dataUrl = URL.createObjectURL(spriteBlob);
 
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = dataUrl;
      });

      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = img.width;
      tempCanvas.height = img.height;
      const ctx = tempCanvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, img.width, img.height).data;

      const spriteConfig = gbsSprites.find(s =>
        spriteName === s.name || spriteName === (s.filename && s.filename.replace(/\.[^/.]+$/, ''))
      );

      const animFrames = [];
      let frameIdx = 0;
      const tileCache = {};

      const gbsSpriteEntry = gbsSprites?.find(s => s.name === spriteName || s.filename === spriteName);

      if (spriteConfig && spriteConfig.states && spriteConfig.states.length > 0) {
        // Config-driven: create one animation per state per direction
        const canvasW = spriteConfig.canvasWidth || 16;
        const stateAnims = {};
        let firstTileId = null;

        // Direction labels for multi_movement
        const dirNames = ['down', 'down_left', 'left', 'up_left', 'up', 'up_right', 'right', 'down_right'];

        for (const state of spriteConfig.states) {
          const stateName = state.name || '';
          const dirAnims = [];
          const combinedFrames = [];
          const isMulti = state.animationType === 'multi_movement';

          state.animations.forEach((animation, dirIdx) => {
            const animFrames = [];

            for (const frame of animation.frames) {
              const frameGroupId = Date.now() + Math.random() + frameIdx;
              const frameTiles = [null, null, null, null];

              for (const tile of frame.tiles) {
                const px = tile.sliceX;
                const py = tile.sliceY < 0 ? 0 : tile.sliceY;
                const cacheKey = `${px},${py}`;
                const fallbackPy = py + 8;
                const fallbackCacheKey = `${px},${fallbackPy}`;

                if (!tileCache[cacheKey] && !tileCache[fallbackCacheKey]) {
                  let { data, hasPixels } = extractTileData(imgData, img.width, img.height, px, py);
                  let usedPy = py;
                  if (!hasPixels && fallbackPy < img.height && fallbackPy + 8 <= img.height) {
                    const fallback = extractTileData(imgData, img.width, img.height, px, fallbackPy);
                    if (fallback.hasPixels) {
                      data = fallback.data;
                      hasPixels = true;
                      usedPy = fallbackPy;
                    }
                  }
                  if (hasPixels) {
                    const tileId = tileIdCounter++;
                    savedTiles.push({
                      id: tileId,
                      name: `${spriteName}_frame_${frameIdx}_${px}_${usedPy}`,
                      collisionType: 'none',
                      data,
                      groupId: frameGroupId,
                      importGroupId
                    });
                    tileCache[cacheKey] = tileId;
                  } else {
                    tileCache[cacheKey] = null;
                  }
                }

                const tileId = tileCache[cacheKey];
                if (tileId != null) {
                  const slot = displayPosToSlot(tile.x, tile.y, canvasW);
                  frameTiles[slot] = tileId;
                }
              }

              animFrames.push(frameTiles);
              combinedFrames.push(frameTiles);
              frameIdx++;
            }

            const dirLabel = isMulti && dirIdx < dirNames.length ? dirNames[dirIdx] : String(dirIdx);
            const animName = stateName ? `${spriteName}_${stateName}_${dirLabel}` : `${spriteName}_${dirLabel}`;

            const animId = Date.now() + Math.random();
            animations.push({
              id: animId,
              name: animName,
              frames: animFrames,
              fps: spriteConfig?.animSpeed != null ? Math.round(60 / spriteConfig.animSpeed) : 8
            });

            dirAnims.push(animId);
            if (!firstTileId) {
              for (const f of animFrames) {
                for (const t of f) {
                  if (t != null) { firstTileId = t; break; }
                }
                if (firstTileId) break;
              }
            }
          });

          // Create combined animation with all frames from all directions
          if (combinedFrames.length > 0) {
            const combinedAnimId = Date.now() + Math.random();
            const combinedName = stateName ? `${spriteName}_${stateName}` : spriteName;
            animations.push({
              id: combinedAnimId,
              name: combinedName,
              frames: combinedFrames,
              fps: spriteConfig?.animSpeed != null ? Math.round(60 / spriteConfig.animSpeed) : 8
            });
            stateAnims[stateName] = [combinedAnimId, ...dirAnims];
          } else {
            stateAnims[stateName] = dirAnims;
          }
        }

        spriteIdMap[spriteName] = { tileId: firstTileId, stateAnims };
        if (gbsSpriteEntry) spriteIdMap[gbsSpriteEntry.id] = { tileId: firstTileId, stateAnims };
      } else {
        // Fallback: slice spritesheet into 8x8 tiles, group every 4 into a frame
        const tileCols = Math.floor(img.width / 8);
        const tileRows = Math.floor(img.height / 8);
        const totalTiles = tileCols * tileRows;

        if (totalTiles === 0) continue;

        for (let t = 0; t < totalTiles; t += 4) {
          const frameGroupId = Date.now() + Math.random() + frameIdx;
          const frameTiles = [null, null, null, null];

          for (let slot = 0; slot < 4; slot++) {
            const ti = t + slot;
            if (ti >= totalTiles) break;

            const tx = (ti % tileCols) * 8;
            const ty = Math.floor(ti / tileCols) * 8;

            const cacheKey = `${tx},${ty}`;
            const fallbackTy = ty + 8;
            const fallbackCacheKey = `${tx},${fallbackTy}`;
            if (!tileCache[cacheKey] && !tileCache[fallbackCacheKey]) {
              let { data, hasPixels } = extractTileData(imgData, img.width, img.height, tx, ty);
              let usedTy = ty;
              if (!hasPixels && fallbackTy < img.height && fallbackTy + 8 <= img.height) {
                const fallback = extractTileData(imgData, img.width, img.height, tx, fallbackTy);
                if (fallback.hasPixels) {
                  data = fallback.data;
                  hasPixels = true;
                  usedTy = fallbackTy;
                }
              }
              if (hasPixels) {
                const tileId = tileIdCounter++;
                savedTiles.push({
                  id: tileId,
                  name: `${spriteName}_tile_${tx}_${usedTy}`,
                  collisionType: 'none',
                  data,
                  groupId: frameGroupId,
                  importGroupId
                });
                tileCache[cacheKey] = tileId;
              } else {
                tileCache[cacheKey] = null;
              }
            }

            frameTiles[slot] = tileCache[cacheKey];
          }

          animFrames.push(frameTiles);
          frameIdx++;
        }

        if (animFrames.length === 0) continue;

        const fallbackAnimId = Date.now() + Math.random();
        animations.push({
          id: fallbackAnimId,
          name: `${spriteName}_anim`,
          frames: animFrames,
          fps: spriteConfig?.animSpeed != null ? Math.round(60 / spriteConfig.animSpeed) : 8
        });

        const spriteData = { tileId: animFrames[0]?.[0] || null, stateAnims: { '': [fallbackAnimId] } };
        spriteIdMap[spriteName] = spriteData;
        if (gbsSpriteEntry) spriteIdMap[gbsSpriteEntry.id] = spriteData;
      }

    } catch (spriteErr) {
      warnings.push(`Failed to import sprite sheet "${spritePath}": ${spriteErr.message}`);
    }
  }

  // Load project settings (modular or monolithic)
  if (!gbsProj.settings) {
    const settingsPath = Object.keys(zip.files).find(name => name.endsWith('settings.gbsres'));
    if (settingsPath) {
      try {
        const settingsText = await zip.files[settingsPath].async('text');
        gbsProj.settings = JSON.parse(settingsText);
      } catch (err) {
        warnings.push(`Failed to read settings: ${err.message}`);
      }
    }
  }

  // 3. Ingest referenced Music Assets (.mod / .uge files)
  const musicFiles = Object.keys(zip.files).filter(name => {
    if (!name.includes('assets/music/') || (!name.endsWith('.mod') && !name.endsWith('.uge'))) {
      return false;
    }
    const mName = name.split('/').pop().replace(/\.[^/.]+$/, '');
    return usedMusicFiles.has(mName) || [...usedMusicFiles].some(um => name.includes(um));
  });
  
  musicFiles.forEach((mPath, index) => {
    const mName = mPath.split('/').pop().replace(/\.[^/.]+$/, '');
    musicTracks.push({
      id: `music_${index + 1}`,
      name: mName,
      artist: 'Imported',
      isSfx: false
    });
  });

  // Build scene actor/trigger lookup from modular files
  const modularActors = {};
  const modularTriggers = {};
  for (const zipPath of Object.keys(zip.files)) {
    if (zipPath.includes('scenes/') && zipPath.endsWith('.gbsres')) {
      try {
        const text = await zip.files[zipPath].async('text');
        const parsed = JSON.parse(text);
        if (parsed._resourceType === 'actor') {
          const sceneFolder = zipPath.split('/').slice(0, -2).join('/');
          if (!modularActors[sceneFolder]) modularActors[sceneFolder] = [];
          modularActors[sceneFolder].push(parsed);
        } else if (parsed._resourceType === 'trigger') {
          const sceneFolder = zipPath.split('/').slice(0, -2).join('/');
          if (!modularTriggers[sceneFolder]) modularTriggers[sceneFolder] = [];
          modularTriggers[sceneFolder].push(parsed);
        }
      } catch (e) {
        // skip unparseable files
      }
    }
  }

  // Resolve which scene folder to use for each scene (keyed without trailing slash)
  const sceneFolderMap = {};
  for (const sPath of sceneFiles) {
    try {
      const text = await zip.files[sPath].async('text');
      const parsed = JSON.parse(text);
      if (parsed && parsed._resourceType === 'scene') {
        const dir = sPath.substring(0, sPath.lastIndexOf('/'));
        sceneFolderMap[parsed.id] = dir;
      }
    } catch (e) {
      // skip
    }
  }

  // Translate each Scene
  for (let sIdx = 0; sIdx < gbsScenes.length; sIdx++) {
    const gbsScene = gbsScenes[sIdx];
    if (!gbsScene) continue;

    const sceneId = sIdx + 1;
    const sceneName = gbsScene.name || `Scene ${sceneId}`;
    const sceneScriptGroup = {
      id: Date.now() + Math.random() + 250 + sIdx,
      type: 'group',
      name: `${sceneName} Imported Scripts`,
      isGroup: true,
      isOpen: true
    };
    customScripts.push(sceneScriptGroup);

    // Get background dimensions and pixel array
    let imgW = 0;
    let imgH = 0;
    let colorGrid = null;

    // Try finding the background file in zip
    let bgName = gbsScene.backgroundId || '';
    const bgAsset = gbsBackgrounds?.find(b => b.id === gbsScene.backgroundId);
    if (bgAsset) {
      bgName = bgAsset.filename || bgAsset.name || bgName;
    }

    const cleanBgName = bgName.replace(/\.[^/.]+$/, '');
    const bgPath = Object.keys(zip.files).find(name => 
      name.includes('assets/backgrounds/') && 
      name.includes(cleanBgName) && 
      (name.endsWith('.png') || name.endsWith('.PNG'))
    );

    if (bgPath) {
      try {
        const bgBlob = await zip.files[bgPath].async('blob');
        const dataUrl = URL.createObjectURL(bgBlob);
        
        const img = new Image();
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = dataUrl;
        });

        imgW = img.width;
        imgH = img.height;

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = imgW;
        tempCanvas.height = imgH;
        const ctx = tempCanvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        
        const imgData = ctx.getImageData(0, 0, imgW, imgH).data;
        colorGrid = Array(imgH).fill(null).map(() => Array(imgW).fill(null));
        
        for (let y = 0; y < imgH; y++) {
          for (let x = 0; x < imgW; x++) {
            const idx = (y * imgW + x) * 4;
            const a = imgData[idx + 3];
            if (a > 128) {
              const r = imgData[idx];
              const g = imgData[idx + 1];
              const b = imgData[idx + 2];
              if (r === 101 && g === 255 && b === 0) continue;
              colorGrid[y][x] = '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
            }
          }
        }

        // Slice background into 8x8 tiles and add to savedTiles in the shared tile group
        const bgCols = Math.ceil(imgW / 8);
        const bgRows = Math.ceil(imgH / 8);
        const addedBgTiles = new Set();

        for (let r = 0; r < bgRows; r++) {
          for (let c = 0; c < bgCols; c++) {
            const tileData = Array(8).fill(null).map(() => Array(8).fill(null));
            let hasPixels = false;
            let tileKey = '';

            for (let py = 0; py < 8; py++) {
              for (let px = 0; px < 8; px++) {
                const x = c * 8 + px;
                const y = r * 8 + py;
                if (x < imgW && y < imgH) {
                  const col = colorGrid[y][x];
                  if (col) {
                    tileData[py][px] = col;
                    hasPixels = true;
                    tileKey += col;
                  } else {
                    tileKey += 'null';
                  }
                }
              }
            }

            if (hasPixels && !addedBgTiles.has(tileKey)) {
              addedBgTiles.add(tileKey);
              const tileId = tileIdCounter++;
              savedTiles.push({
                id: tileId,
                name: `${cleanBgName}_tile_${r}_${c}`,
                collisionType: 'none',
                data: tileData,
                groupId: tileId,
                importGroupId
              });
            }
          }
        }

      } catch (bgErr) {
        warnings.push(`Could not read background image for scene "${sceneName}": ${bgErr.message}`);
      }
    }

    // --- Enforce minimum scene size of 32x32 tiles (256x256 px) ---
    const MIN_TILES = 32;
    const MIN_PX = MIN_TILES * 8;
    let sceneW = Math.max(imgW || 0, MIN_PX);
    let sceneH = Math.max(imgH || 0, MIN_PX);

    // Build the expanded color grid with background centered
    const expandedGrid = Array(sceneH).fill(null).map(() => Array(sceneW).fill(null));

    if (colorGrid && imgW > 0 && imgH > 0) {
      const offsetX = Math.floor((sceneW - imgW) / 2);
      const offsetY = Math.floor((sceneH - imgH) / 2);
      for (let y = 0; y < imgH; y++) {
        for (let x = 0; x < imgW; x++) {
          expandedGrid[offsetY + y][offsetX + x] = colorGrid[y][x];
        }
      }
    }
    colorGrid = expandedGrid;

    // --- Parse Collisions (handle compressed string format) ---
    const collisions = [];
    let colIdx = 0;
    let rawCollisions = [];

    if (typeof gbsScene.collisions === 'string') {
      rawCollisions = decompressCollisions(gbsScene.collisions);
    } else if (Array.isArray(gbsScene.collisions)) {
      rawCollisions = gbsScene.collisions;
    }

    // Create collision type groups
    const colGroupSolid = { id: Date.now() + Math.random() + 100, type: 'solid', name: 'Collisions (Solid)', isGroup: true, isOpen: true };
    const colGroupLadder = { id: Date.now() + Math.random() + 101, type: 'ladder', name: 'Collisions (Ladder)', isGroup: true, isOpen: true };

    if (rawCollisions.length > 0) {
      const originalTileCols = Math.ceil((imgW || sceneW) / 8);
      const originalTileRows = Math.ceil((imgH || sceneH) / 8);
      // Also expand collision grid to match the expanded scene
      const offsetCols = Math.floor((sceneW / 8 - originalTileCols) / 2);
      const offsetRows = Math.floor((sceneH / 8 - originalTileRows) / 2);

      collisions.push(colGroupSolid, colGroupLadder);

      rawCollisions.forEach((val, idx) => {
        if (!val) return;
        const col = idx % originalTileCols;
        const row = Math.floor(idx / originalTileCols);
        if (row >= originalTileRows) return;
        const isLadder = (val === 0x10 || val === 16);
        collisions.push({
          id: Date.now() + Math.random() + colIdx++,
          name: `Collision ${colIdx}`,
          type: isLadder ? 'ladder' : 'solid',
          x: (col + offsetCols) * 8,
          y: (row + offsetRows) * 8,
          width: 8,
          height: 8,
          isPainted: false,
          groupId: isLadder ? colGroupLadder.id : colGroupSolid.id
        });
      });
    }

    // --- Build actor groups ---
    const actors = [];
    const groupTypes = ['Pickups', 'Enemies', 'Hazards', 'Platforms', 'NPCs', 'Misc'];
    const actorGroups = groupTypes.map((grpName, index) => ({
      id: Date.now() + Math.random() + index,
      type: 'group',
      name: grpName,
      isOpen: true
    }));
    actors.push(...actorGroups);

    // --- Load Actors from modular files ---
    const sceneDir = sceneFolderMap[gbsScene.id];
    let gbsActors = [];
    if (gbsScene.actors && Array.isArray(gbsScene.actors)) {
      gbsActors = gbsScene.actors;
    } else if (sceneDir && modularActors[sceneDir]) {
      gbsActors = modularActors[sceneDir];
    }

    // Calculate actor offset (same as background offset)
    const actorOffsetX = Math.floor((sceneW - (imgW || sceneW)) / 2);
    const actorOffsetY = Math.floor((sceneH - (imgH || sceneH)) / 2);

    const actorIdMap = {};
    const actorUuidMap = {};
    gbsActors.forEach((act, actIdx) => {
      if (!act) return;

      const actorProjectId = Date.now() + Math.random() + actIdx;
      actorIdMap[actIdx] = actorProjectId;
      if (act.id) actorUuidMap[act.id] = actorProjectId;

      let spriteId = 1;
      let walkAnimId = null;
      let idleAnimId = null;
      const spriteRef = spriteIdMap[act.spriteSheetId];
      if (spriteRef) {
        spriteId = spriteRef.tileId || 1;
        const defaultAnims = spriteRef.stateAnims?.[''];
        if (defaultAnims && defaultAnims.length > 0) {
          walkAnimId = defaultAnims[0];
          idleAnimId = defaultAnims[0];
        }
      }

      const cleanType = 'npc';
      const parentGroup = actorGroups.find(g => g.name === 'Misc');

      // Script-level maps: actor sub-scripts use param 0 → self
      const actorSelfMap = { ...actorIdMap, 0: actorProjectId };
      const transOpts = { actorUuidMap, animations, spriteIdMap };

      const resolveAnims = (nodes) => {
        if (!spriteRef?.stateAnims) return nodes;
        return nodes.map(node => {
          if (!node.data || node.data.actionType !== 'play_animation') return node;
          const key = node.data.animId;
          if (!key || !isNaN(key) && key !== '') return node;
          const ids = spriteRef.stateAnims[key];
          if (ids && ids.length > 0) return { ...node, data: { ...node.data, animId: ids[0] } };
          return node;
        });
      };

      // Translate all script types (sub-scripts use actorSelfMap so param "0" → self)
      const mainScript = translateEventList(act.script, sceneIdMap, variableIdMap, actorIdMap, transOpts);
      let startScript = translateEventList(act.startScript, sceneIdMap, variableIdMap, actorSelfMap, transOpts);
      let updateScript = translateEventList(act.updateScript, sceneIdMap, variableIdMap, actorSelfMap, transOpts);
      let hit1Script = translateEventList(act.hit1Script, sceneIdMap, variableIdMap, actorSelfMap, transOpts);
      let hit2Script = translateEventList(act.hit2Script, sceneIdMap, variableIdMap, actorSelfMap, transOpts);
      let hit3Script = translateEventList(act.hit3Script, sceneIdMap, variableIdMap, actorSelfMap, transOpts);
      startScript.nodes = resolveAnims(startScript.nodes);
      updateScript.nodes = resolveAnims(updateScript.nodes);
      hit1Script.nodes = resolveAnims(hit1Script.nodes);
      hit2Script.nodes = resolveAnims(hit2Script.nodes);
      hit3Script.nodes = resolveAnims(hit3Script.nodes);

      const actName = (act.name || `Actor${actIdx + 1}`).replace(/[^a-zA-Z0-9_]/g, '_');
      let startScriptId = null;
      let updateScriptId = null;
      let onHitScriptId = null;
      let onHit2ScriptId = null;
      let onHit3ScriptId = null;

      if (startScript && (startScript.nodes?.length || startScript.edges?.length)) {
        startScriptId = Date.now() + Math.random() + 6000 + actIdx;
        customScripts.push({ id: startScriptId, name: `${sceneName}_${actName}_on_start`, script: startScript, groupId: sceneScriptGroup.id });
      }
      if (updateScript && (updateScript.nodes?.length || updateScript.edges?.length)) {
        updateScriptId = Date.now() + Math.random() + 7000 + actIdx;
        customScripts.push({ id: updateScriptId, name: `${sceneName}_${actName}_on_update`, script: updateScript, groupId: sceneScriptGroup.id });
      }
      if (hit1Script && (hit1Script.nodes?.length || hit1Script.edges?.length)) {
        onHitScriptId = Date.now() + Math.random() + 8000 + actIdx;
        customScripts.push({ id: onHitScriptId, name: `${sceneName}_${actName}_on_hit`, script: hit1Script, groupId: sceneScriptGroup.id });
      }
      if (hit2Script && (hit2Script.nodes?.length || hit2Script.edges?.length)) {
        onHit2ScriptId = Date.now() + Math.random() + 9000 + actIdx;
        customScripts.push({ id: onHit2ScriptId, name: `${sceneName}_${actName}_on_hit2`, script: hit2Script, groupId: sceneScriptGroup.id });
      }
      if (hit3Script && (hit3Script.nodes?.length || hit3Script.edges?.length)) {
        onHit3ScriptId = Date.now() + Math.random() + 10000 + actIdx;
        customScripts.push({ id: onHit3ScriptId, name: `${sceneName}_${actName}_on_hit3`, script: hit3Script, groupId: sceneScriptGroup.id });
      }

      const actX = ((parseInt(act.x) || 0) * 8) + actorOffsetX;
      const actY = ((parseInt(act.y) || 0) * 8) + actorOffsetY;

      actors.push({
        id: actorProjectId,
        name: act.name || `Actor ${actIdx + 1}`,
        type: cleanType,
        x: actX,
        y: actY,
        width: 16,
        height: 16,
        color: '#4CAF50',
        spriteId: spriteId,
        walkAnimId: walkAnimId,
        idleAnimId: idleAnimId,
        isHidden: false,
        hflip: true,
        groupId: parentGroup?.id || null,
        script: mainScript,
        startScriptId,
        updateScriptId,
        onHitScriptId,
        onHit2ScriptId,
        onHit3ScriptId
      });
    });

    // --- Create player actor if scene has one ---
    const playerSpriteId = gbsScene.playerSpriteSheetId || gbsProj.settings?.defaultPlayerSpriteSheetId;
    if (playerSpriteId) {
      const spriteRef = spriteIdMap[playerSpriteId];
      const playerTileX = Math.floor((imgW || sceneW) / 2 / 8);
      const playerTileY = Math.floor((imgH || sceneH) / 2 / 8);
      const playerGroup = { id: 9, type: 'group', name: 'PLAYER', isOpen: true };
      // Ensure PLAYER group is in actors array
      if (!actors.find(g => g.name === 'PLAYER')) actors.push(playerGroup);

      actors.push({
        id: Date.now() + Math.random(),
        name: 'Player',
        type: 'player',
        x: playerTileX * 8 + actorOffsetX,
        y: playerTileY * 8 + actorOffsetY,
        width: 16,
        height: 16,
        color: '#2196F3',
        spriteId: spriteRef?.tileId || 1,
        walkAnimId: spriteRef?.stateAnims?.['']?.[0] || null,
        idleAnimId: spriteRef?.stateAnims?.['']?.[0] || null,
        isHidden: false,
        hflip: true,
        groupId: playerGroup.id,
        script: null,
        startScript: null,
        updateScript: null,
        hit1Script: null,
        hit2Script: null,
        hit3Script: null
      });
    }

    // --- Load Triggers from modular files ---
    const triggers = [];
    let gbsTriggers = [];
    if (gbsScene.triggers && Array.isArray(gbsScene.triggers)) {
      gbsTriggers = gbsScene.triggers;
    } else if (sceneDir && modularTriggers[sceneDir]) {
      gbsTriggers = modularTriggers[sceneDir];
    }

    // Create trigger group
    const triggerGroup = { id: Date.now() + Math.random() + 200, type: 'group', name: 'Imported Triggers', isGroup: true, isOpen: true };

    if (gbsTriggers.length > 0) {
      triggers.push(triggerGroup);
    }

    gbsTriggers.forEach((trig, trigIdx) => {
      if (!trig) return;

      const trigX = ((parseInt(trig.x) || 0) * 8) + actorOffsetX;
      const trigY = ((parseInt(trig.y) || 0) * 8) + actorOffsetY;

      const trigScript = translateEventList(trig.script, sceneIdMap, variableIdMap, actorIdMap);
      let trigScriptId = null;
      if (trigScript && (trigScript.nodes?.length || trigScript.edges?.length)) {
        trigScriptId = Date.now() + Math.random() + 5000 + trigIdx;
        const scriptName = `${sceneName}_${(trig.name || `Trigger${trigIdx + 1}`).replace(/[^a-zA-Z0-9_]/g, '_')}_on_enter`;
        customScripts.push({
          id: trigScriptId,
          name: scriptName,
          script: trigScript,
          groupId: sceneScriptGroup.id
        });
      }
      triggers.push({
        id: Date.now() + Math.random() + trigIdx,
        name: trig.name || `Trigger ${trigIdx + 1}`,
        x: trigX,
        y: trigY,
        width: (parseInt(trig.width) || 2) * 8,
        height: (parseInt(trig.height) || 2) * 8,
        color: '#ffaa00',
        scriptId: trigScriptId,
        groupId: triggerGroup.id
      });
    });

    // --- Assemble PxGBA scene ---
    const sceneLayers = [{
      id: Date.now() + Math.random(),
      type: 'layer',
      name: 'Background',
      visible: true,
      data: colorGrid
    }];

    const sceneFrames = [{
      id: 'frame-1',
      layers: sceneLayers
    }];

    // Build scene script
    const sceneScript = translateEventList(gbsScene.script, sceneIdMap, variableIdMap, actorIdMap);
    let sceneScriptId = null;
    if (sceneScript && (sceneScript.nodes?.length || sceneScript.edges?.length)) {
      sceneScriptId = Date.now() + Math.random() + 11000 + sIdx;
      customScripts.push({
        id: sceneScriptId,
        name: `${sceneName}_on_start`,
        script: sceneScript,
        groupId: sceneScriptGroup.id
      });
    }

    // Map music ID correctly
    let musicId = null;
    if (gbsScene.musicId) {
      const musicAsset = gbsMusic?.find(m => m.id === gbsScene.musicId);
      if (musicAsset) {
        const musicIdx = gbsMusic.indexOf(musicAsset);
        musicId = `music_${musicIdx + 1}`;
      }
    }

    scenes.push({
      id: sceneId,
      name: sceneName,
      type: gbsScene.type || 'TOPDOWN',
      frames: sceneFrames,
      actors,
      triggers,
      collisions,
      musicId,
      dimensions: { w: sceneW, h: sceneH },
      worldX: parseInt(gbsScene.x) || 0,
      worldY: parseInt(gbsScene.y) || 0,
      startScriptId: sceneScriptId
    });
  }

  // Create default initial scene if project had none
  if (scenes.length === 0) {
    const MIN_TILES = 32;
    const MIN_PX = MIN_TILES * 8;
    const emptyGrid = Array(MIN_PX).fill(null).map(() => Array(MIN_PX).fill(null));
    scenes.push({
      id: 1,
      name: 'Scene 1',
      type: 'TOPDOWN',
      frames: [{ id: 'frame-1', layers: [{ id: Date.now(), type: 'layer', name: 'Background', visible: true, data: emptyGrid }] }],
      actors: [],
      triggers: [],
      collisions: [],
      dimensions: { w: MIN_PX, h: MIN_PX },
      worldX: 0,
      worldY: 0,
      script: translateEventList([], sceneIdMap, variableIdMap)
    });
  }

  // Set default active scene
  const activeSceneId = scenes[0].id;
  const activeScene = scenes[0];

  const projectData = {
    dimensions: activeScene.dimensions,
    layers: activeScene.frames[0].layers,
    savedTiles,
    tileGroupNames: { [importGroupId]: 'GB Studio Project Import Tiles' },
    scenes,
    actors: activeScene.actors,
    globalActors,
    triggers: activeScene.triggers,
    collisions: activeScene.collisions,
    variables,
    animations,
    customScripts,
    globalScript: { nodes: [{ id: 'start', position: { x: 250, y: 100 }, data: { label: 'On Update' }, type: 'input' }], edges: [] },
    musicTracks,
    activeSceneId,
    activeFrameId: 'frame-1',
    activeLayerId: activeScene.frames[0].layers[0].id,
    zoom: 1,
    panOffset: { x: 0, y: 0 },
    showGbaMask: true,
    gridSize: 8,
    isPixelated: true
  };

  return { project: projectData, warnings };
}

/**
 * Translates a GB Studio script array into a PxGBA React Flow node sequence.
 */
function translateEventList(events, sceneIdMap, variableIdMap, actorIdMap = {}) {
  const nodes = [{ id: 'start', position: { x: 420, y: 20 }, data: { label: 'On Update' }, type: 'customStart' }];
  const edges = [];

  if (!events || !Array.isArray(events)) {
    return { nodes, edges };
  }

  let lastNodeId = 'start';
  let xOffset = 640;
  let nodeCount = 0;

  function resolveVariableRef(variableField) {
    if (variableField && typeof variableField === 'object') {
      if (variableField.type === 'variable') return variableIdMap[variableField.value] || variableField.value;
      if (variableField.type === 'number') return variableIdMap[String(variableField.value)] || String(variableField.value);
      return undefined;
    }
    return variableIdMap[variableField] || undefined;
  }

  function resolveValue(val) {
    if (val && typeof val === 'object') {
      if (val.type === 'variable') return variableIdMap[val.value] || val.value;
      if (val.type === 'number') return String(val.value);
      if (val.type === 'string') return val.value;
      if (val.type === 'true') return 'true';
      if (val.type === 'add') return `${resolveValue(val.valueA)} + ${resolveValue(val.valueB)}`;
      if (val.type === 'sub') return `${resolveValue(val.valueA)} - ${resolveValue(val.valueB)}`;
      if (val.type === 'rnd') return `random(0, ${resolveValue(val.value)})`;
      return String(val.value || '');
    }
    return val !== undefined ? String(val) : '';
  }

  function flattenAndMap(eventList) {
    for (const ev of eventList) {
      if (!ev || !ev.command) continue;

      const nodeId = `imported_${ev.id || Math.random().toString(36).substr(2, 9)}_${nodeCount++}`;
      let label = '';
      let actionType = '';
      let data = {};
      let isMapped = false;

      switch (ev.command) {
        case 'EVENT_TEXT':
          label = 'Show Dialog';
          actionType = 'dialog';
          data = {
            label,
            actionType,
            message: Array.isArray(ev.args?.text) ? ev.args.text.join('\n') : (ev.args?.text || '')
          };
          isMapped = true;
          break;

        case 'EVENT_SWITCH_SCENE':
          label = 'Change Scene';
          actionType = 'change_scene';
          data = {
            label,
            actionType,
            sceneId: sceneIdMap[ev.args?.sceneId] || ev.args?.sceneId || ''
          };
          isMapped = true;
          break;

        case 'EVENT_WAIT':
          label = 'Wait';
          actionType = 'wait';
          let waitFrames = 60;
          if (ev.args?.frames !== undefined) {
            waitFrames = parseInt(ev.args.frames);
          } else if (ev.args?.time !== undefined) {
            waitFrames = Math.round(parseFloat(ev.args.time) * 60);
          }
          data = { label, actionType, frames: waitFrames };
          isMapped = true;
          break;

        case 'EVENT_SET_VALUE':
        case 'EVENT_SET_INPUT_VAR':
        case 'EVENT_VARIABLE_SET':
          label = 'Set Variable';
          actionType = 'set_var';
          const setVarVarName = resolveVariableRef(ev.args?.variable) || `VAR_${typeof ev.args?.variable === 'object' ? 'OBJ' : (ev.args?.variable || 'UNKNOWN')}`;
          const setVarVarValue = ev.args?.value !== undefined ? resolveValue(ev.args.value) : '1';
          data = {
            label,
            actionType,
            varName: setVarVarName,
            varValue: setVarVarValue
          };
          isMapped = true;
          break;

        case 'EVENT_INC_VALUE':
          label = 'Math Operation';
          actionType = 'math_op';
          const incVarName = resolveVariableRef(ev.args?.variable) || `VAR_${typeof ev.args?.variable === 'object' ? 'OBJ' : (ev.args?.variable || 'UNKNOWN')}`;
          data = {
            label,
            actionType,
            varName: incVarName,
            operator: '+=',
            value: '1'
          };
          isMapped = true;
          break;

        case 'EVENT_DEC_VALUE':
          label = 'Math Operation';
          actionType = 'math_op';
          const decVarName = resolveVariableRef(ev.args?.variable) || `VAR_${typeof ev.args?.variable === 'object' ? 'OBJ' : (ev.args?.variable || 'UNKNOWN')}`;
          data = {
            label,
            actionType,
            varName: decVarName,
            operator: '-=',
            value: '1'
          };
          isMapped = true;
          break;

        case 'EVENT_IF':
          label = 'Check Variable';
          actionType = 'check_var';
          const cond = ev.args?.condition || {};
          const opMap = { 'eq': '==', 'ne': '!=', 'lt': '<', 'gt': '>', 'lte': '<=', 'gte': '>=' };
          const ifVarName = resolveValue(cond.valueA);
          const ifVarValue = resolveValue(cond.valueB);
          data = {
            label,
            actionType,
            varName: ifVarName,
            varValue: ifVarValue,
            operator: opMap[cond.type] || '=='
          };
          isMapped = true;
          break;

        case 'EVENT_CHOICE':
          label = 'Show Menu';
          actionType = 'menu';
          data = {
            label,
            actionType,
            options: [{ text: ev.args?.trueText || 'Yes' }, { text: ev.args?.falseText || 'No' }]
          };
          isMapped = true;
          break;

        case 'EVENT_MUSIC_PLAY':
          label = 'Music Control';
          actionType = 'music_control';
          data = { label, actionType, musicAction: 'resume' };
          isMapped = true;
          break;

        case 'EVENT_MUSIC_STOP':
          label = 'Music Control';
          actionType = 'music_control';
          data = { label, actionType, musicAction: 'stop' };
          isMapped = true;
          break;

        case 'EVENT_MUSIC_PLAY_EFFECT':
          label = 'Play Sound';
          actionType = 'play_sound';
          data = { label, actionType, computedSoundName: ev.args?.sound || 'snd_square_440_100' };
          isMapped = true;
          break;

        case 'EVENT_ACTOR_HIDE':
          label = 'Destroy Actor';
          actionType = 'destroy_actor';
          data = { label, actionType, targetActorId: actorIdMap[ev.args?.actorId] || null };
          isMapped = true;
          break;

        case 'EVENT_ACTOR_SHOW':
          label = 'Spawn Actor';
          actionType = 'spawn_actor';
          data = { label, actionType, targetActorId: actorIdMap[ev.args?.actorId] || null, useCurrentPos: true };
          isMapped = true;
          break;

        case 'EVENT_ACTOR_SET_FRAME':
          label = 'Play Animation';
          actionType = 'play_animation';
          data = {
            label,
            actionType,
            targetActorId: actorIdMap[ev.args?.actorId] || null,
            animId: resolveValue(ev.args?.frame) || '0'
          };
          isMapped = true;
          break;

        case 'EVENT_SOUND_PLAY_EFFECT':
          label = 'Play Sound';
          actionType = 'play_sound';
          data = { label, actionType, computedSoundName: ev.args?.sound || 'snd_square_440_100' };
          isMapped = true;
          break;

        case 'EVENT_CAMERA_SHAKE':
          label = 'Camera Shake';
          actionType = 'camera_shake';
          data = {
            label,
            actionType,
            time: ev.args?.time || 0.2,
            direction: ev.args?.shakeDirection || 'horizontal'
          };
          isMapped = true;
          break;

        case 'EVENT_SET_TIMER_SCRIPT':
          label = 'Set Timer';
          actionType = 'set_timer';
          data = {
            label,
            actionType,
            duration: ev.args?.duration || 0.5,
            frames: ev.args?.frames || 30
          };
          isMapped = true;
          break;

        case 'EVENT_RNG_SEED':
          label = 'Seed RNG';
          actionType = 'rng_seed';
          data = { label, actionType };
          isMapped = true;
          break;

        case 'EVENT_CALL_CUSTOM_EVENT':
          label = 'Run Script';
          actionType = 'run_script';
          data = { label, actionType, scriptId: ev.args?.customEventId || '' };
          isMapped = true;
          break;

        case 'EVENT_ACTOR_MOVE_TO':
          label = 'Move Actor';
          actionType = 'move';
          data = {
            label,
            actionType,
            targetActorId: actorIdMap[ev.args?.actorId] || null,
            x: resolveValue(ev.args?.x),
            y: resolveValue(ev.args?.y)
          };
          isMapped = true;
          break;

        case 'EVENT_ACTOR_SET_POSITION':
          label = 'Move Actor';
          actionType = 'move';
          data = {
            label,
            actionType,
            targetActorId: actorIdMap[ev.args?.actorId] || null,
            x: resolveValue(ev.args?.x),
            y: resolveValue(ev.args?.y)
          };
          isMapped = true;
          break;

        case 'EVENT_VARIABLE_MATH_EVALUATE':
          label = 'Math Equation';
          actionType = 'math_equation';
          const mathEqTargetVar = resolveVariableRef(ev.args?.variable) || `VAR_${typeof ev.args?.variable === 'object' ? 'OBJ' : (ev.args?.variable || 'UNKNOWN')}`;
          data = {
            label,
            actionType,
            targetVar: mathEqTargetVar,
            equation: ev.args?.expression || ''
          };
          isMapped = true;
          break;

        case 'EVENT_ACTOR_SET_STATE':
          label = 'Play Animation';
          actionType = 'play_animation';
          data = {
            label,
            actionType,
            targetActorId: actorIdMap[ev.args?.actorId] || null,
            animId: ev.args?.spriteStateId || ''
          };
          isMapped = true;
          break;

        case 'EVENT_ACTOR_ACTIVATE':
          label = 'Spawn Actor';
          actionType = 'spawn_actor';
          data = { label, actionType, targetActorId: actorIdMap[ev.args?.actorId] || null, useCurrentPos: true };
          isMapped = true;
          break;

        case 'EVENT_ACTOR_DEACTIVATE':
          label = 'Destroy Actor';
          actionType = 'destroy_actor';
          data = { label, actionType, targetActorId: actorIdMap[ev.args?.actorId] || null };
          isMapped = true;
          break;

        case 'EVENT_LAUNCH_PROJECTILE':
          label = 'Shoot Projectile';
          actionType = 'shoot_projectile';
          data = {
            label,
            actionType,
            targetActorId: actorIdMap[ev.args?.actorId] || null,
            dirMode: ev.args?.direction === 'fixed' ? 'vector' : 'facing',
            dx: ev.args?.x || 0,
            dy: ev.args?.y || -1,
            speed: 3
          };
          isMapped = true;
          break;

        default:
          break;
      }

      if (isMapped) {
        nodes.push({
          id: nodeId,
          position: { x: xOffset, y: 20 },
          type: 'customAction',
          data
        });

        edges.push({
          id: `edge_${lastNodeId}_to_${nodeId}`,
          source: lastNodeId,
          target: nodeId
        });

        lastNodeId = nodeId;
        xOffset += 260;
      }

      // Recursively flatten children if present
      if (ev.children) {
        if (ev.children.true && ev.children.true.length > 0) {
          flattenAndMap(ev.children.true);
        }
        if (ev.children.false && ev.children.false.length > 0) {
          flattenAndMap(ev.children.false);
        }
        if (ev.children.script && ev.children.script.length > 0) {
          flattenAndMap(ev.children.script);
        }
      }
    }
  }

  flattenAndMap(events);
  
  if (nodes.length > 1) {
    nodes[0].data.label = 'On Start';
  }

  return { nodes, edges };
}
