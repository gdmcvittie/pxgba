import { useState, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { getClosestPaletteColor, filterSimilarColors, sortColorsByHue } from '../utils';

export function useImportImage({
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
}) {
  const imageInputRef = useRef(null);
  const importLayerInputRef = useRef(null);
  const paletteInputRef = useRef(null);

  const [showImportPaletteDialog, setShowImportPaletteDialog] = useState(false);
  const [pendingImportColors, setPendingImportColors] = useState([]);
  const [paletteImportFileName, setPaletteImportFileName] = useState('');
  const [showPaletteConvertDialog, setShowPaletteConvertDialog] = useState(false);
  const [pendingConvertData, setPendingConvertData] = useState(null);

  const applyPaletteConversion = (data, w, h) => {
    const colorCounts = {};
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (data[y] && data[y][x]) {
          const color = data[y][x];
          colorCounts[color] = (colorCounts[color] || 0) + 1;
        }
      }
    }
    
    const sortedUniqueColors = Object.keys(colorCounts).sort((a, b) => colorCounts[b] - colorCounts[a]);
    const currentPalette = recentColors && recentColors.length > 0 ? [...recentColors] : [];
    const currentPaletteSet = new Set(currentPalette);
    const newColors = [];
    for (const color of sortedUniqueColors) {
      if (!currentPaletteSet.has(color)) {
        newColors.push(color);
      }
    }

    let updatedPalette = currentPalette;
    const uniqueImgColors = Object.keys(colorCounts);
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
        setRecentColors(updatedPalette);
      }
    }

    const cacheMap = new Map();
    for (const color of uniqueImgColors) {
      cacheMap.set(color, getClosestPaletteColor(color, updatedPalette));
    }

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (data[y][x]) {
          data[y][x] = cacheMap.get(data[y][x]);
        }
      }
    }
    return data;
  };

  const executePaletteConvertDirectly = async (pending, shouldConvert, fitToScene, importMode) => {
    let { originalData, fitData, w, h, name, source, loadingToastId, dataUrl, sourceWidth, sourceHeight } = pending;
    
    if (importMode === 'palette') {
      const uniqueColorsSet = new Set();
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (originalData[y] && originalData[y][x]) {
            uniqueColorsSet.add(originalData[y][x]);
          }
        }
      }
      const hexToHsl = (hex) => {
        let r = parseInt(hex.slice(1, 3), 16) / 255;
        let g = parseInt(hex.slice(3, 5), 16) / 255;
        let b = parseInt(hex.slice(5, 7), 16) / 255;
        let max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;
        if (max === min) { h = s = 0; } else {
          let d = max - min;
          s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
          switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
          }
          h /= 6;
        }
        return [h, s, l];
      };
      const sortedColors = Array.from(uniqueColorsSet).sort((a, b) => {
        const hslA = hexToHsl(a);
        const hslB = hexToHsl(b);
        if (Math.abs(hslA[0] - hslB[0]) > 0.05) return hslA[0] - hslB[0];
        if (Math.abs(hslA[1] - hslB[1]) > 0.05) return hslA[1] - hslB[1];
        return hslA[2] - hslB[2];
      });
      setPendingImportColors(sortedColors);
      setPaletteImportFileName(name);
      setShowImportPaletteDialog(true);
      toast.success(`Found ${sortedColors.length} colors!`, { id: loadingToastId });
      return;
    }

    if (importMode === 'tiles') {
      const cols = Math.floor(w / 8);
      const rows = Math.floor(h / 8);
      const newTiles = [];
      const currentTiles = savedTiles || [];
      const existingFingerprints = new Set(currentTiles.map(t => JSON.stringify(t.data)));

      for (let ty = 0; ty < rows; ty++) {
        for (let tx = 0; tx < cols; tx++) {
          const tileData = Array(8).fill(null).map(() => Array(8).fill(null));
          let hasPixels = false;
          for (let py = 0; py < 8; py++) {
            for (let px = 0; px < 8; px++) {
              const y = ty * 8 + py;
              const x = tx * 8 + px;
              const color = originalData[y]?.[x];
              if (color) {
                tileData[py][px] = color;
                hasPixels = true;
              }
            }
          }
          if (hasPixels) {
            const fingerprint = JSON.stringify(tileData);
            if (!existingFingerprints.has(fingerprint)) {
              newTiles.push({
                id: Date.now() + Math.random(),
                name: `Tile ${currentTiles.length + newTiles.length + 1}`,
                collisionType: "none",
                data: tileData
              });
              existingFingerprints.add(fingerprint);
            }
          }
        }
      }

      if (newTiles.length > 0) {
        setSavedTiles([...currentTiles, ...newTiles]);
        toast.success(`Imported ${newTiles.length} tiles!`, { id: loadingToastId });
      } else {
        toast.success("No new unique tiles found.", { id: loadingToastId });
      }
      return;
    }

    if (importMode) {
      source = importMode === 'scene' ? 'fullImport' : 'importToLayer';
    }

    let useData = originalData;

    if (source === 'importToLayer' || fitToScene) {
        const sceneW = dimensions.w;
        const sceneH = dimensions.h;
        
        const safeSourceWidth = sourceWidth || w;
        const safeSourceHeight = sourceHeight || h;
        
        const fitScale = Math.min(sceneW / safeSourceWidth, sceneH / safeSourceHeight);
        const fitW = fitToScene ? Math.round(safeSourceWidth * fitScale) : safeSourceWidth;
        const fitH = fitToScene ? Math.round(safeSourceHeight * fitScale) : safeSourceHeight;
        const fitX = fitToScene ? Math.round((sceneW - fitW) / 2) : 0;
        const fitY = fitToScene ? Math.round((sceneH - fitH) / 2) : 0;

        if (dataUrl && (fitW !== safeSourceWidth || fitH !== safeSourceHeight || source === 'importToLayer')) {
          const img = await new Promise((resolve, reject) => {
            const i = new Image();
            i.onload = () => resolve(i);
            i.onerror = reject;
            i.src = dataUrl;
          });
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = sceneW;
          tempCanvas.height = sceneH;
          const ctx = tempCanvas.getContext('2d', { willReadFrequently: true });
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(img, fitX, fitY, fitW, fitH);
          const imgData = ctx.getImageData(0, 0, sceneW, sceneH).data;
          useData = Array(sceneH).fill(null).map(() => Array(sceneW).fill(null));
          for (let y = 0; y < sceneH; y++) {
            for (let x = 0; x < sceneW; x++) {
              const i = (y * sceneW + x) * 4;
              if (imgData[i + 3] > 128) {
                useData[y][x] = '#' + ((1 << 24) + (imgData[i] << 16) + (imgData[i + 1] << 8) + imgData[i + 2]).toString(16).slice(1);
              }
            }
          }
          w = sceneW;
          h = sceneH;
        } else if (source === 'importToLayer') {
          useData = fitData || originalData;
          w = sceneW;
          h = sceneH;
        } else if (fitToScene && source === 'fullImport') {
          useData = fitData || originalData;
          w = sceneW;
          h = sceneH;
        }
    }

    if (shouldConvert) {
      applyPaletteConversion(useData, w, h);
    }

    if (source === 'fullImport') {
      const newLayer = { id: Date.now() + Math.random(), type: 'layer', name, visible: true, groupId: null, data: useData };
      const newDims = { w, h };
      setDimensions(newDims);
      setLayers([newLayer]);
      setActiveLayerId(newLayer.id);
      if (containerRef.current) {
        const containerW = containerRef.current.clientWidth - 40;
        const containerH = containerRef.current.clientHeight - 40;
        const zW = containerW / w;
        const zH = containerH / h;
        setZoom(Math.max(0.1, Math.min(50, Math.min(zW, zH))));
        setPanOffset({ x: 0, y: 0 });
      }
      saveHistory("Import Image", [newLayer], newDims);
      toast.success("Image loaded!", { id: loadingToastId });
    } else if (source === 'importToLayer') {
      const activeL = layers.find(l => l.id === activeLayerId);
      const groupId = activeL ? (activeL.type === 'group' ? activeL.id : activeL.groupId) : null;
      const newLayer = { id: Date.now() + Math.random(), type: 'layer', name, visible: true, groupId, data: useData };
      const activeIndex = layers.findIndex(l => l.id === activeLayerId);
      const nextLayers = [...layers];
      nextLayers.splice(activeIndex !== -1 ? activeIndex : 0, 0, newLayer);
      setLayers(nextLayers);
      setActiveLayerId(newLayer.id);
      saveHistory("Import to Layer", nextLayers);
      toast.success("Image imported to new layer!", { id: loadingToastId });
    }
  };

  const confirmPaletteConvert = async (shouldConvert, fitToScene, importMode) => {
    const pending = pendingConvertData;
    setPendingConvertData(null);
    setShowPaletteConvertDialog(false);
    if (!pending) return;
    executePaletteConvertDirectly(pending, shouldConvert, fitToScene, importMode);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();

    const loadingToastId = toast.loading("Loading image...");
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        let w = img.width;
        let h = img.height;

        // Auto-scale huge images to a maximum of 1024px to prevent browser thread freezes
        const maxDim = 1024;
        if (w > maxDim || h > maxDim) {
          const scale = Math.min(maxDim / w, maxDim / h);
          w = Math.round(w * scale);
          h = Math.round(h * scale);
        }

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = w;
        tempCanvas.height = h;
        const ctx = tempCanvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, w, h);

        const imgData = ctx.getImageData(0, 0, w, h).data;
        const newData = Array(h);

        let y = 0;
        const processChunk = () => {
          const start = performance.now();
          while (y < h && performance.now() - start < 15) {
            const row = new Array(w).fill(null);
            for (let x = 0; x < w; x++) {
              const i = (y * w + x) * 4;
              if (imgData[i + 3] > 128) {
                row[x] = '#' + ((1 << 24) + (imgData[i] << 16) + (imgData[i + 1] << 8) + imgData[i + 2]).toString(16).slice(1);
              }
            }
            newData[y] = row;
            y++;
          }

          if (y < h) {
            requestAnimationFrame(processChunk);
          } else {
            // 1. Count frequencies of colors
            const colorCounts = {};
            for (let cy = 0; cy < h; cy++) {
              for (let cx = 0; cx < w; cx++) {
                const color = newData[cy][cx];
                if (color) {
                  colorCounts[color] = (colorCounts[color] || 0) + 1;
                }
              }
            }

            // 2. Sort by frequency descending
            const sortedColors = Object.keys(colorCounts).sort((a, b) => colorCounts[b] - colorCounts[a]);

            // 3. Filter for similarity to keep at most 256 colors
            let filteredColors = filterSimilarColors(sortedColors, 100);
            if (filteredColors.length === 0 && sortedColors.length > 0) {
              filteredColors = sortedColors.slice(0, 256);
            } else if (filteredColors.length > 256) {
              filteredColors = filteredColors.slice(0, 256);
            }

            // 4. Map every color in the image to the closest filtered color
            const mappingCache = new Map();
            for (const color of sortedColors) {
              mappingCache.set(color, getClosestPaletteColor(color, filteredColors));
            }

            // Apply mapping to image data
            for (let cy = 0; cy < h; cy++) {
              for (let cx = 0; cx < w; cx++) {
                if (newData[cy][cx]) {
                  newData[cy][cx] = mappingCache.get(newData[cy][cx]);
                }
              }
            }

            setPendingConvertData({
              originalData: newData, fitData: null,
              w, h, name: file.name,
              source: 'fullImport',
              loadingToastId,
              dataUrl: event.target.result,
              sourceWidth: img.width,
              sourceHeight: img.height
            });
            setShowPaletteConvertDialog(true);
          }
        };

        setTimeout(processChunk, 50);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  const handlePaletteUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const fileExtension = file.name.split('.').pop().toLowerCase();

    const standardizeColor = (hex) => {
      hex = hex.trim().replace(/^#/, '');
      if (hex.length === 3) {
        hex = hex.split('').map(c => c + c).join('');
      }
      if (hex.length === 6) {
        return '#' + hex.toLowerCase();
      }
      return null;
    };

    const rgbToHex = (r, g, b) => {
      const clamp = (val) => Math.max(0, Math.min(255, parseInt(val, 10) || 0));
      r = clamp(r);
      g = clamp(g);
      b = clamp(b);
      return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toLowerCase();
    };

    const hexToHsl = (hex) => {
      let r = parseInt(hex.slice(1, 3), 16) / 255;
      let g = parseInt(hex.slice(3, 5), 16) / 255;
      let b = parseInt(hex.slice(5, 7), 16) / 255;
      let max = Math.max(r, g, b), min = Math.min(r, g, b);
      let h, s, l = (max + min) / 2;
      if (max === min) {
        h = s = 0;
      } else {
        let d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
          case r: h = (g - b) / d + (g < b ? 6 : 0); break;
          case g: h = (b - r) / d + 2; break;
          case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
      }
      return [h, s, l];
    };

    const sortColorsHsl = (colorsArray) => {
      return [...colorsArray].sort((a, b) => {
        const hslA = hexToHsl(a);
        const hslB = hexToHsl(b);
        if (Math.abs(hslA[0] - hslB[0]) > 0.05) {
          return hslA[0] - hslB[0];
        }
        if (Math.abs(hslA[1] - hslB[1]) > 0.05) {
          return hslA[1] - hslB[1];
        }
        return hslA[2] - hslB[2];
      });
    };

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          let pw = img.width;
          let ph = img.height;

          // Auto-scale huge palette images to a maximum of 512px to keep it fast
          if (pw > 512 || ph > 512) {
            const scale = Math.min(512 / pw, 512 / ph);
            pw = Math.round(pw * scale);
            ph = Math.round(ph * scale);
          }

          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = pw;
          tempCanvas.height = ph;
          const ctx = tempCanvas.getContext('2d', { willReadFrequently: true });
          ctx.drawImage(img, 0, 0, pw, ph);

          const imgData = ctx.getImageData(0, 0, pw, ph).data;
          const colorCounts = {};

          for (let i = 0; i < imgData.length; i += 4) {
            const r = imgData[i];
            const g = imgData[i + 1];
            const b = imgData[i + 2];
            const a = imgData[i + 3];

            if (a >= 128) {
              const hex = rgbToHex(r, g, b);
              colorCounts[hex] = (colorCounts[hex] || 0) + 1;
            }
          }

          const sortedUnique = Object.keys(colorCounts).sort((a, b) => colorCounts[b] - colorCounts[a]);

          // Filter for similarity to keep at most 256 colors
          let filteredColors = filterSimilarColors(sortedUnique, 100);
          if (filteredColors.length === 0 && sortedUnique.length > 0) {
            filteredColors = sortedUnique.slice(0, 256);
          } else if (filteredColors.length > 256) {
            filteredColors = filteredColors.slice(0, 256);
          }

          const sortedColors = sortColorsHsl(filteredColors);
          if (sortedColors.length === 0) {
            alert("No colors found in image.");
            return;
          }

          setPendingImportColors(sortedColors);
          setPaletteImportFileName(file.name);
          setShowImportPaletteDialog(true);
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
      if (paletteInputRef.current) paletteInputRef.current.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      let colors = [];

      if (fileExtension === 'gpl') {
        const lines = text.split(/\r?\n/);
        for (let line of lines) {
          line = line.trim();
          if (!line || line.startsWith('#') || line.toLowerCase().startsWith('gimp') || line.toLowerCase().startsWith('name:') || line.toLowerCase().startsWith('columns:')) {
            continue;
          }
          const match = line.match(/^\s*(\d+)\s+(\d+)\s+(\d+)/);
          if (match) {
            const hex = rgbToHex(match[1], match[2], match[3]);
            if (hex) colors.push(hex);
          }
        }
      } else if (fileExtension === 'json') {
        try {
          const parsed = JSON.parse(text);
          const gatherHexes = (obj) => {
            if (typeof obj === 'string') {
              const std = standardizeColor(obj);
              if (std) colors.push(std);
            } else if (Array.isArray(obj)) {
              obj.forEach(gatherHexes);
            } else if (obj && typeof obj === 'object') {
              Object.values(obj).forEach(gatherHexes);
            }
          };
          gatherHexes(parsed);
        } catch {
          alert("Invalid JSON format");
          return;
        }
      } else {
        const lines = text.split(/\r?\n/);
        for (let line of lines) {
          line = line.trim();
          if (!line || (line.startsWith('#') && line.length < 4)) continue;
          const hexPattern = /#?([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g;
          let match;
          while ((match = hexPattern.exec(line)) !== null) {
            const std = standardizeColor(match[0]);
            if (std) colors.push(std);
          }
        }
      }

      const uniqueColors = Array.from(new Set(colors));
      if (uniqueColors.length === 0) {
        alert("No valid hex colors found in file.");
        return;
      }

      let filteredColors = filterSimilarColors(uniqueColors, 100);
      if (filteredColors.length === 0 && uniqueColors.length > 0) {
        filteredColors = uniqueColors.slice(0, 256);
      } else if (filteredColors.length > 256) {
        filteredColors = filteredColors.slice(0, 256);
      }

      setPendingImportColors(sortColorsByHue(filteredColors));
      setPaletteImportFileName(file.name);
      setShowImportPaletteDialog(true);
    };

    reader.readAsText(file);
    if (paletteInputRef.current) paletteInputRef.current.value = "";
  };

  const confirmPaletteImport = (mode) => {
    if (mode === 'overwrite') {
      const loadingToastId = toast.loading("Updating palette and mapping colors...");
      setTimeout(() => {
        const finalPalette = pendingImportColors.slice(0, 256);
        setRecentColors(finalPalette);
        
        // Update currentColor and secondaryColor to closest match
        if (currentColor) {
          setCurrentColor(getClosestPaletteColor(currentColor, finalPalette));
        } else if (finalPalette.length > 0) {
          setCurrentColor(finalPalette[0]);
        }

        if (secondaryColor) {
          setSecondaryColor(getClosestPaletteColor(secondaryColor, finalPalette));
        }

        // Update hudSettings
        let updatedHudSettings = hudSettings;
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

        // Update textSettings outlineColor
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

        // Convert existing tiles to use the new palette
        const updatedTiles = savedTiles ? savedTiles.map(tile => {
          const newData = tile.data.map(row => 
            row.map(color => color ? getClosestPaletteColor(color, finalPalette) : null)
          );
          return { ...tile, data: newData };
        }) : [];

        // Convert all scenes (including frames and layers) to use the new palette
        const updatedScenes = scenes ? scenes.map(scene => {
          if (scene.type === 'group') return scene;
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
        }) : [];

        // Convert active workspace layers to use the new palette
        const updatedActiveLayers = layers ? layers.map(layer => {
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
        }) : [];

        if (setSavedTiles) setSavedTiles(updatedTiles);
        if (setScenes) setScenes(updatedScenes);
        if (setLayers) setLayers(updatedActiveLayers);

        saveHistory("Overwrite Palette & Convert Assets", updatedActiveLayers, dimensions, {
          savedTiles: updatedTiles,
          recentColors: finalPalette,
          scenes: updatedScenes,
          hudSettings: updatedHudSettings
        });

        toast.success("Palette replaced and assets updated!", { id: loadingToastId });
      }, 50);
    } else if (mode === 'append') {
      setRecentColors(prev => {
        const uniquePrev = new Set(prev);
        const added = pendingImportColors.filter(c => !uniquePrev.has(c));
        return [...prev, ...added].slice(0, 256);
      });
    }
    setShowImportPaletteDialog(false);
    setPendingImportColors([]);
    setPaletteImportFileName('');
  };

  const importFileAsLayer = async (file) => {
    if (!file) return;

    const loadingToastId = toast.loading("Loading image to new layer...");
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const sw = dimensions.w;
        const sh = dimensions.h;
        const iw = img.width;
        const ih = img.height;

        let origScale = 1;
        if (iw > sw || ih > sh) {
          origScale = Math.min(sw / iw, sh / ih);
        }
        const origW = Math.round(iw * origScale);
        const origH = Math.round(ih * origScale);

        const fitScale = Math.min(sw / iw, sh / ih);
        const fitW = Math.round(iw * fitScale);
        const fitH = Math.round(ih * fitScale);
        const fitX = Math.round((sw - fitW) / 2);
        const fitY = Math.round((sh - fitH) / 2);

        const extractHexData = (ctx) => {
          const data = ctx.getImageData(0, 0, sw, sh).data;
          const result = Array(sh).fill(null).map(() => Array(sw).fill(null));
          for (let y = 0; y < sh; y++) {
            for (let x = 0; x < sw; x++) {
              const i = (y * sw + x) * 4;
              if (data[i + 3] > 128) {
                result[y][x] = '#' + ((1 << 24) + (data[i] << 16) + (data[i + 1] << 8) + data[i + 2]).toString(16).slice(1);
              }
            }
          }
          return result;
        };

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = sw;
        tempCanvas.height = sh;
        const ctx = tempCanvas.getContext('2d', { willReadFrequently: true });

        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, 0, 0, origW, origH);
        const originalData = extractHexData(ctx);

        const isFitSame = Math.abs(fitScale - origScale) < 0.001;
        let fitData;
        if (isFitSame) {
          fitData = originalData;
        } else {
          ctx.clearRect(0, 0, sw, sh);
          ctx.drawImage(img, fitX, fitY, fitW, fitH);
          fitData = extractHexData(ctx);
        }

        executePaletteConvertDirectly({
          originalData, fitData,
          w: sw, h: sh, name: file.name,
          source: 'importToLayer',
          loadingToastId
        }, true, false, 'layer');
      };
      img.onerror = () => toast.error("Failed to load image.", { id: loadingToastId });
      img.src = event.target.result;
    };
    reader.onerror = () => toast.error("Failed to read file.", { id: loadingToastId });
    reader.readAsDataURL(file);
  };

  const handleImportToLayer = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    await importFileAsLayer(file);
    if (importLayerInputRef.current) importLayerInputRef.current.value = "";
  };

  return {
    imageInputRef, importLayerInputRef, paletteInputRef,
    showImportPaletteDialog, setShowImportPaletteDialog,
    pendingImportColors, setPendingImportColors,
    paletteImportFileName, setPaletteImportFileName,
    showPaletteConvertDialog, setShowPaletteConvertDialog,
    pendingConvertData, setPendingConvertData,
    handleImageUpload, handlePaletteUpload, confirmPaletteImport,
    confirmPaletteConvert, importFileAsLayer, handleImportToLayer
  };
}
