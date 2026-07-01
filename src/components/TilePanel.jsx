import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { usePxShop, INITIAL_DEFAULT_TILES } from '../context/PxShopContext';
import { BsBorder, BsBoxArrowInDown, BsPlus, BsChevronDown, BsChevronRight, BsSearch, BsFileEarmarkZip, BsFileEarmarkImage, BsFileEarmarkText, BsArrowLeft, BsBoxArrowUp, BsTrash } from 'react-icons/bs';
import toast from 'react-hot-toast';
import JSZip from 'jszip';
import TileIcon from './TileIcon';
import { API_BASE_URL } from '../config';
import { getClosestPaletteColor, detectTransparencyColor } from '../context/utils';


const TilePanel = ({ isCollapsed, onToggle }) => {
  const {
    tileSheetInputRef,
    handleTileSheetUpload,
    saveSelectionAsTile,
    savedTiles, setSavedTiles,
    tileGroupNames, setTileGroupNames,
    activeSavedTileId, setActiveSavedTileId,
    tool, setTool,
    setActiveDraw,
    saveHistory,
    layers,
    dimensions,
    addOgaArtist,
    recentColors,
    setShowTileImportPaletteDialog,
    setPendingTileImportData,
    importTilesDirectly,
    pendingOgaImportData,
    setPendingOgaImportData,
    showTileImportSizeDialog,
    setShowTileImportSizeDialog,
    ogaImportTilesWide
  } = usePxShop();

  const [tilesWideFlow, setTilesWideFlow] = useState(() => {
    const saved = localStorage.getItem('px_shop_tilesWideFlow');
    return saved === 'true';
  });
  const [tilesWideAuto, setTilesWideAuto] = useState(() => {
    const saved = localStorage.getItem('px_shop_tilesWideAuto');
    return saved === 'true';
  });
  const [tilesWideManual, setTilesWideManual] = useState(() => {
    const saved = localStorage.getItem('px_shop_tilesWide');
    return saved && saved !== 'flow' ? parseInt(saved, 10) || 6 : 6;
  });
  const [hasImportedTileSheet, setHasImportedTileSheet] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState(null);
  const [editingGroupName, setEditingGroupName] = useState('');

  const handleTilesWideFlowChange = (val) => {
    setTilesWideFlow(val);
    localStorage.setItem('px_shop_tilesWideFlow', String(val));
    if (val) {
      setTilesWideAuto(false);
      localStorage.setItem('px_shop_tilesWideAuto', 'false');
    }
  };

  const handleTilesWideAutoChange = (val) => {
    setTilesWideAuto(val);
    localStorage.setItem('px_shop_tilesWideAuto', String(val));
    if (val) {
      setTilesWideFlow(false);
      localStorage.setItem('px_shop_tilesWideFlow', 'false');
    }
  };

  const handleTilesWideManualChange = (val) => {
    const clamped = Math.max(1, Math.min(20, val));
    setTilesWideManual(clamped);
    localStorage.setItem('px_shop_tilesWide', String(clamped));
  };

  useEffect(() => {
    if (ogaImportTilesWide != null) {
      setHasImportedTileSheet(true);
      if (tilesWideAuto) {
        handleTilesWideManualChange(ogaImportTilesWide);
      }
    }
  }, [ogaImportTilesWide]);

  const effectiveTilesWide = tilesWideFlow ? 'flow' : (tilesWideAuto && hasImportedTileSheet ? tilesWideManual : (tilesWideAuto ? 'flow' : tilesWideManual));

  const activeTile = savedTiles.find(t => t.id === activeSavedTileId);

  const updateActiveTileProp = (prop, val) => {
    setSavedTiles(prev => prev.map(t => t.id === activeSavedTileId ? { ...t, [prop]: val } : t));
  };

  // OpenGameArt Search States
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedTileset, setSelectedTileset] = useState(null);
  const [filesList, setFilesList] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [zipImages, setZipImages] = useState([]);
  const [filePreviews, setFilePreviews] = useState({});
  const [nameFilter, setNameFilter] = useState('');

  useEffect(() => {
    if (!filesList || filesList.length === 0) return;

    filesList.forEach(file => {
      const isZip = file.filename.toLowerCase().endsWith('.zip');
      if (isZip) {
        (async () => {
          try {
            const proxyUrl = `${API_BASE_URL}/proxy-oga?url=${encodeURIComponent(file.url)}`;
            const response = await fetch(proxyUrl);
            if (!response.ok) return;
            const buffer = await response.arrayBuffer();
            const zip = await JSZip.loadAsync(buffer);
            let firstImgUrl = null;

            for (const relativePath of Object.keys(zip.files)) {
              const zipEntry = zip.files[relativePath];
              const filename = relativePath.split('/').pop();
              if (!zipEntry.dir && relativePath.match(/\.(png|jpg|jpeg|gif|bmp)$/i) && !filename.startsWith('.')) {
                const ext = filename.split('.').pop().toLowerCase();
                const mimeTypes = {
                  'png': 'image/png',
                  'jpg': 'image/jpeg',
                  'jpeg': 'image/jpeg',
                  'gif': 'image/gif',
                  'bmp': 'image/bmp',
                  'webp': 'image/webp'
                };
                const mimeType = mimeTypes[ext] || 'image/png';
                const fileData = await zipEntry.async('uint8array');
                const blob = new Blob([fileData], { type: mimeType });
                firstImgUrl = URL.createObjectURL(blob);
                break;
              }
            }

            if (firstImgUrl) {
              setFilePreviews(prev => ({ ...prev, [file.url]: firstImgUrl }));
            }
          } catch (e) {
            console.error("Failed to generate background zip preview:", e);
          }
        })();
      }
    });
  }, [filesList]);

  // Search fetching & parsing logic
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearchModalOpen(true);
    setIsLoading(true);
    setError(null);
    setSearchResults([]);
    setFilesList([]);
    setSelectedFile(null);
    setZipImages([]);
    setSelectedTileset(null);

    const query = encodeURIComponent(searchQuery.trim() + ' tileset');
    const ogaSearchUrl = `https://opengameart.org/art-search-advanced?keys=${query}&title=&field_art_tags_tid_op=or&field_art_tags_tid=&name=&field_art_type_tid%5B%5D=9`;
    const proxyUrl = `${API_BASE_URL}/proxy-oga?url=${encodeURIComponent(ogaSearchUrl)}`;

    try {
      const response = await fetch(proxyUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.statusText}`);
      }
      const html = await response.text();

      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      const previewImgs = doc.querySelectorAll('img[alt="Preview"]');
      const results = [];

      previewImgs.forEach(img => {
        let linkEl = img.closest('a');
        let container = img.closest('.art-previews-inline') || img.closest('.art-preview') || img.parentElement;
        let titleEl = container ? container.querySelector('a') : null;

        const href = linkEl ? linkEl.getAttribute('href') : (titleEl ? titleEl.getAttribute('href') : '');
        const title = titleEl ? titleEl.textContent.trim() : (img.getAttribute('title') || 'Untitled Tileset');
        const src = img.getAttribute('src');

        if (href) {
          results.push({
            title,
            url: href.startsWith('http') ? href : `https://opengameart.org${href}`,
            previewUrl: src.startsWith('http') ? src : `https://opengameart.org${src}`
          });
        }
      });

      setSearchResults(results);
      if (results.length === 0) {
        setError("No results found. Try a different query (e.g. 'overworld' or 'dungeon').");
      }
    } catch (err) {
      console.error(err);
      setError(`Search failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Tileset details parsing (grabs the actual files from the field-name-field-art-files container)
  const handleSelectTileset = async (tileset) => {
    setIsLoading(true);
    setError(null);
    setSelectedTileset(tileset);
    setFilesList([]);
    setSelectedFile(null);
    setZipImages([]);

    const proxyUrl = `${API_BASE_URL}/proxy-oga?url=${encodeURIComponent(tileset.url)}`;

    try {
      const response = await fetch(proxyUrl);
      if (!response.ok) {
        throw new Error(`Failed to load details: ${response.statusText}`);
      }
      const html = await response.text();

      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      // Extract artist name from detail page
      let artistName = '';
      const artistEl = doc.querySelector('.field-name-field-artist a') || doc.querySelector('.field-name-upload-by a') || doc.querySelector('.submitted a[href*="/users/"]') || doc.querySelector('a[href*="/users/"]');
      if (artistEl) {
        artistName = artistEl.textContent.trim();
      }
      if (!artistName) {
        const submittedText = doc.querySelector('.submitted');
        if (submittedText) {
          const match = submittedText.textContent.match(/by\s+(.+?)(?:\s|$)/i);
          if (match) artistName = match[1].trim();
        }
      }
      if (artistName) {
        addOgaArtist(artistName);
      }

      // Parse actual files from field-name-field-art-files
      let filesContainer = doc.querySelector('.field-name-field-art-files');
      if (!filesContainer) {
        // Fallback to right column or general field items if class changes
        filesContainer = doc.querySelector('.group-right.right-column') || doc.querySelector('.field-items');
      }

      const files = [];
      if (filesContainer) {
        const fileLinks = filesContainer.querySelectorAll('a');
        fileLinks.forEach(a => {
          const href = a.getAttribute('href');
          const text = a.textContent.trim();
          if (href && !href.includes('mock-preview') && !href.startsWith('mailto:')) {
            const fullUrl = href.startsWith('http') ? href : `https://opengameart.org${href}`;
            if (!files.some(f => f.url === fullUrl)) {
              files.push({
                url: fullUrl,
                filename: text || href.split('/').pop() || 'Unknown File'
              });
            }
          }
        });
      }

      // Fallback: search anywhere in .field-items for valid download links
      if (files.length === 0) {
        const fallbackLinks = doc.querySelectorAll('.field-items a');
        fallbackLinks.forEach(a => {
          const href = a.getAttribute('href');
          if (href && (href.includes('sites/default/files') || href.match(/\.(png|jpg|jpeg|gif|zip)$/i))) {
            const fullUrl = href.startsWith('http') ? href : `https://opengameart.org${href}`;
            if (!files.some(f => f.url === fullUrl)) {
              files.push({
                url: fullUrl,
                filename: a.textContent.trim() || href.split('/').pop() || 'Unknown File'
              });
            }
          }
        });
      }

      if (files.length === 0) {
        throw new Error("No files found in the files section of this tileset.");
      }

      setFilesList(files);

      if (files.length === 1) {
        await handleProcessFile(files[0]);
      }
    } catch (err) {
      console.error(err);
      setError(`Failed to retrieve tileset details: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Downloads a chosen file and either unzips it or processes it as a direct image
  const handleProcessFile = async (file) => {
    setIsLoading(true);
    setError(null);
    setSelectedFile(file);
    setZipImages([]);

    const isZip = file.filename.toLowerCase().endsWith('.zip') || file.url.toLowerCase().endsWith('.zip') || file.url.toLowerCase().includes('zip');

    try {
      const proxyUrl = `${API_BASE_URL}/proxy-oga?url=${encodeURIComponent(file.url)}`;
      const response = await fetch(proxyUrl);
      if (!response.ok) {
        throw new Error(`Failed to download file: ${response.statusText}`);
      }

      if (isZip) {
        const buffer = await response.arrayBuffer();
        const zip = await JSZip.loadAsync(buffer);
        const filePromises = [];

        zip.forEach((relativePath, zipEntry) => {
          const filename = relativePath.split('/').pop();
          if (!zipEntry.dir && relativePath.match(/\.(png|jpg|jpeg|gif|bmp)$/i) && !filename.startsWith('.')) {
            filePromises.push((async () => {
              const ext = filename.split('.').pop().toLowerCase();
              const mimeTypes = {
                'png': 'image/png',
                'jpg': 'image/jpeg',
                'jpeg': 'image/jpeg',
                'gif': 'image/gif',
                'bmp': 'image/bmp',
                'webp': 'image/webp'
              };
              const mimeType = mimeTypes[ext] || 'image/png';
              const fileData = await zipEntry.async('uint8array');
              const blob = new Blob([fileData], { type: mimeType });
              const objectUrl = URL.createObjectURL(blob);
              return {
                name: relativePath,
                url: objectUrl
              };
            })());
          }
        });

        const extractedImages = await Promise.all(filePromises);

        if (extractedImages.length === 0) {
          throw new Error("No image files (.png, .jpg, .jpeg, .gif, .bmp) found inside this ZIP archive.");
        }

        setZipImages(extractedImages);

        if (extractedImages.length === 1) {
          await handleImportImage(extractedImages[0].url, extractedImages[0].name);
        }
      } else {
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        await handleImportImage(objectUrl, file.filename);
      }
    } catch (err) {
      console.error(err);
      setError(`Failed to process file: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Image processing and 8x8 parsing
  const handleImportImage = async (imgUrl, filename = 'Tileset') => {
    setIsLoading(true);
    const loadingToastId = toast.loading("Processing tileset image...");

    let objectUrl = imgUrl;
    let shouldRevoke = false;

    try {
      if (!imgUrl.startsWith('blob:')) {
        const proxyUrl = `${API_BASE_URL}/proxy-oga?url=${encodeURIComponent(imgUrl)}`;
        const response = await fetch(proxyUrl);
        if (!response.ok) throw new Error("Failed to download image from proxy.");
        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);
        shouldRevoke = true;
      }

      const img = new Image();
      img.onload = () => {
        try {
          let w = img.width;
          let h = img.height;
          const MAX_DIM = 1024;
          if (w > MAX_DIM || h > MAX_DIM) {
            const scale = Math.min(MAX_DIM / w, MAX_DIM / h);
            w = Math.floor(w * scale);
            h = Math.floor(h * scale);
          }

          const tempCanvas = document.createElement('canvas');
          const tempCtx = tempCanvas.getContext('2d');
          tempCanvas.width = w;
          tempCanvas.height = h;
          tempCtx.drawImage(img, 0, 0, w, h);

          const imageData = tempCtx.getImageData(0, 0, w, h).data;

          const maskColorHex = detectTransparencyColor(imageData, w, h);
          if (maskColorHex) {
            toast.success(`Masked background color (${maskColorHex}) as transparent.`, { id: loadingToastId });
          }

          // 1. Extract unique non-transparent colors and count frequencies
          const colorCounts = {};
          for (let i = 0; i < imageData.length; i += 4) {
            const a = imageData[i + 3];
            if (a >= 128) {
              const r = imageData[i];
              const g = imageData[i + 1];
              const b = imageData[i + 2];
              const hex = "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
              if (hex !== maskColorHex) {
                colorCounts[hex] = (colorCounts[hex] || 0) + 1;
              }
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
            const defaultPal = recentColors && recentColors.length > 0 ? recentColors : INITIAL_DEFAULT_TILES[0].data[0].filter(c => c !== null);
            const nextColor = defaultPal.find(c => !dominantColors.includes(c)) || '#000000';
            dominantColors.push(nextColor);
          }

          // Store processed data and prompt for tile size
          setPendingOgaImportData({
            imageData,
            w,
            h,
            filename,
            dominantColors,
            uniqueColors,
            loadingToastId,
            maskColorHex
          });
          setShowTileImportSizeDialog(true);
          setIsSearchModalOpen(false);
        } catch (error) {
          console.error("Error processing tileset image:", error);
          toast.error("Failed to process tileset image.", { id: loadingToastId });
        } finally {
          if (shouldRevoke) {
            URL.revokeObjectURL(objectUrl);
          }
          setIsLoading(false);
        }
      };
      img.onerror = () => {
        toast.error("Failed to load tileset image.", { id: loadingToastId });
        setIsLoading(false);
      };
      img.src = objectUrl;
    } catch (err) {
      console.error(err);
      toast.error(`Import failed: ${err.message}`, { id: loadingToastId });
      setIsLoading(false);
    }
  };

  const handleCloseModal = () => {
    zipImages.forEach(img => {
      if (img.url && img.url.startsWith('blob:')) {
        URL.revokeObjectURL(img.url);
      }
    });
    Object.values(filePreviews).forEach(url => {
      if (url && url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }
    });
    setFilePreviews({});
    setIsSearchModalOpen(false);
    setFilesList([]);
    setSelectedFile(null);
    setZipImages([]);
    setSelectedTileset(null);
    setError(null);
  };

  const handleBack = () => {
    zipImages.forEach(img => {
      if (img.url && img.url.startsWith('blob:')) {
        URL.revokeObjectURL(img.url);
      }
    });
    setZipImages([]);

    if (selectedFile && filesList.length > 1) {
      setSelectedFile(null);
    } else {
      Object.values(filePreviews).forEach(url => {
        if (url && url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      });
      setFilePreviews({});
      setSelectedFile(null);
      setFilesList([]);
      setSelectedTileset(null);
    }
    setError(null);
  };

  const downloadTilesAsSpritesheet = () => {
    if (savedTiles.length === 0) {
      toast.error("No tiles to export.");
      return;
    }

    try {
      const cols = Math.min(16, savedTiles.length);
      const rows = Math.ceil(savedTiles.length / cols);

      const canvas = document.createElement('canvas');
      canvas.width = cols * 8;
      canvas.height = rows * 8;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      savedTiles.forEach((tile, tIdx) => {
        const col = tIdx % cols;
        const row = Math.floor(tIdx / cols);
        const startX = col * 8;
        const startY = row * 8;

        for (let y = 0; y < 8; y++) {
          for (let x = 0; x < 8; x++) {
            const color = tile.data[y][x];
            if (color) {
              ctx.fillStyle = color;
              ctx.fillRect(startX + x, startY + y, 1, 1);
            }
          }
        }
      });

      canvas.toBlob((blob) => {
        if (!blob) {
          toast.error("Failed to generate spritesheet.");
          return;
        }
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'tileset.png';
        link.click();
        URL.revokeObjectURL(url);
        toast.success("Spritesheet downloaded successfully!");
      }, 'image/png');
    } catch (err) {
      console.error(err);
      toast.error("Failed to export spritesheet: " + err.message);
    }
  };

  const filteredTiles = savedTiles.filter(tile => {
    if (!nameFilter.trim()) return true;
    const filterLower = nameFilter.toLowerCase();
    if ((tile.name || '').toLowerCase().includes(filterLower)) return true;
    const gid = tile.groupId || tile.id;
    const groupName = tileGroupNames[gid] || '';
    return groupName.toLowerCase().includes(filterLower);
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: isCollapsed ? 'none' : 1, overflow: 'hidden', borderBottom: '2px solid #222', minHeight: 0, background: isCollapsed ? 'transparent' : '#3d3d3d' }}>
      <div
        onClick={onToggle}
        style={{ padding: '15px', borderBottom: isCollapsed ? 'none' : '1px solid #3c3c3c', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}
      >
        <span style={{ fontWeight: 'bold', fontSize: '11px', textTransform: 'uppercase', color: isCollapsed ? '#aaa' : '#4CAF50', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BsBorder /> Tiles
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={e => { if (isCollapsed) { onToggle(); } e.stopPropagation(); }}>
          <button onClick={downloadTilesAsSpritesheet} title="Download Spritesheet" style={{ backgroundColor: '#8522e8', border: 'none', color: '#fff', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><BsBoxArrowUp /></button>
          <button onClick={() => tileSheetInputRef.current?.click()} title="Import Sprite Sheet" style={{ backgroundColor: '#0078d4', border: 'none', color: '#fff', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><BsBoxArrowInDown /></button>
          <button onClick={saveSelectionAsTile} title="Capture Selection to Tile" style={{ backgroundColor: '#4CAF50', border: 'none', color: '#fff', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><BsPlus /></button>
          <button
            onClick={() => {
              if (window.confirm("Are you sure you want to clear all custom tiles? This will remove all custom captured or imported tiles and reset to the default tiles.")) {
                const activePalette = recentColors && recentColors.length > 0 ? recentColors : [];
                const resetTiles = INITIAL_DEFAULT_TILES.map(tile => {
                  const mappedData = tile.data.map(row => 
                    row.map(color => color ? getClosestPaletteColor(color, activePalette) : null)
                  );
                  return { ...tile, data: mappedData };
                });
                setSavedTiles(resetTiles);
                setActiveSavedTileId(1);
                setTool('tile');
                setActiveDraw('tile');
                saveHistory("Clear and Reset Default Tiles", layers, dimensions, { savedTiles: resetTiles });
                toast.success("Tiles reset to defaults");
              }
            }}
            title="Clear & Reset Default Tiles"
            style={{ backgroundColor: '#ff4444', border: 'none', color: '#fff', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
          >
            <BsTrash />
          </button>
          <div onClick={e => { e.stopPropagation(); onToggle(); }} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            {isCollapsed ? <BsChevronRight style={{ color: '#aaa' }} /> : <BsChevronDown style={{ color: '#aaa' }} />}
          </div>
        </div>
      </div>

      {!isCollapsed && (
        <>
          <input type="file" ref={tileSheetInputRef} onChange={handleTileSheetUpload} style={{ display: 'none' }} accept="image/*" />

          {/* Search OpenGameArt bar */}
          <div style={{ display: 'flex', padding: '10px', gap: '6px', borderBottom: '1px solid #3c3c3c', backgroundColor: '#202022' }}>
            <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
              <BsSearch style={{ position: 'absolute', left: '10px', color: '#888', pointerEvents: 'none' }} size={12} />
              <input
                type="text"
                placeholder="Search OpenGameArt..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
                style={{
                  width: '100%',
                  background: '#111',
                  color: '#fff',
                  border: '1px solid #444',
                  borderRadius: '4px',
                  padding: '6px 10px 6px 30px',
                  fontSize: '12px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>
            <button
              onClick={handleSearch}
              style={{
                background: '#0078d4',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                padding: '6px 12px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              Search
            </button>
          </div>

          {/* Filter by Name */}
          <div style={{ display: 'flex', padding: '8px 10px', gap: '6px', borderBottom: '1px solid #3c3c3c', backgroundColor: '#1d1d1f' }}>
            <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
              <BsSearch style={{ position: 'absolute', left: '10px', color: '#888', pointerEvents: 'none' }} size={12} />
              <input
                type="text"
                placeholder="Filter tiles by name..."
                value={nameFilter}
                onChange={(e) => setNameFilter(e.target.value)}
                style={{
                  width: '100%',
                  background: '#111',
                  color: '#fff',
                  border: '1px solid #444',
                  borderRadius: '4px',
                  padding: '6px 10px 6px 30px',
                  fontSize: '12px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
              {nameFilter && (
                <button
                  onClick={() => setNameFilter('')}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    background: 'none',
                    border: 'none',
                    color: '#888',
                    cursor: 'pointer',
                    fontSize: '12px',
                    padding: '4px'
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Tiles wide control */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', borderBottom: '1px solid #3c3c3c', backgroundColor: '#1d1d1f' }}>
            <div style={{ display: 'flex', fontSize: '10px', color: '#aaa' }}>Tile Display</div>
            <label style={{ display: 'flex', flexGrow: 1, alignItems: 'center', gap: '4px', fontSize: '10px', color: '#aaa', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={tilesWideFlow}
                onChange={(e) => handleTilesWideFlowChange(e.target.checked)}
                style={{ margin: 0, cursor: 'pointer' }}
              />
              Flow
            </label>
            <label style={{ display: 'flex', flexGrow: 1, alignItems: 'center', gap: '4px', fontSize: '10px', color: '#aaa', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={tilesWideAuto}
                onChange={(e) => handleTilesWideAutoChange(e.target.checked)}
                disabled={tilesWideFlow}
                style={{ margin: 0, cursor: tilesWideFlow ? 'not-allowed' : 'pointer' }}
              />
              Auto
            </label>
            <button
              onClick={() => handleTilesWideManualChange(tilesWideManual - 1)}
              disabled={tilesWideFlow || tilesWideAuto}
              style={{ background: '#444', border: 'none', color: (tilesWideFlow || tilesWideAuto) ? '#666' : '#fff', width: '18px', height: '18px', borderRadius: '3px', cursor: (tilesWideFlow || tilesWideAuto) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', padding: 0, lineHeight: 1 }}
            >-</button>
            <span style={{ minWidth: '20px', textAlign: 'center', color: (tilesWideFlow || tilesWideAuto) ? '#666' : '#fff', fontWeight: 'bold', fontSize: '10px' }}>{tilesWideManual}</span>
            <button
              onClick={() => handleTilesWideManualChange(tilesWideManual + 1)}
              disabled={tilesWideFlow || tilesWideAuto}
              style={{ background: '#444', border: 'none', color: (tilesWideFlow || tilesWideAuto) ? '#666' : '#fff', width: '18px', height: '18px', borderRadius: '3px', cursor: (tilesWideFlow || tilesWideAuto) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', padding: 0, lineHeight: 1 }}
            >+</button>
          </div>

          {(() => {
            const defaultTileIds = new Set(INITIAL_DEFAULT_TILES.map(t => t.id));
            const defaultTiles = filteredTiles.filter(t => defaultTileIds.has(t.id));
            const customTiles = filteredTiles.filter(t => !defaultTileIds.has(t.id));

            const groupOrder = [];
            const groupMap = {};
            for (const tile of customTiles) {
              const gid = tile.groupId || tile.id;
              if (!groupMap[gid]) {
                groupMap[gid] = [];
                groupOrder.push(gid);
              }
              groupMap[gid].push(tile);
            }

            const getSubGridSize = (group) => {
              if (group.length <= 1) return { cols: 1, rows: 1 };
              const name = group[0].name || '';
              if (/\(TL\)|\(TR\)|\(BL\)|\(BR\)/.test(name)) return { cols: 2, rows: 2 };
              if (/\(\d_\d\)/.test(name)) {
                const indices = group.map(t => {
                  const m = (t.name || '').match(/\((\d)_(\d)\)/);
                  return m ? { y: parseInt(m[1]), x: parseInt(m[2]) } : null;
                }).filter(Boolean);
                const maxY = Math.max(...indices.map(i => i.y));
                const maxX = Math.max(...indices.map(i => i.x));
                return { cols: maxX + 1, rows: maxY + 1 };
              }
              return { cols: group.length, rows: 1 };
            };

            const getTilePosition = (tile, cols) => {
              const name = tile.name || '';
              const tlMatch = name.match(/\((TL|TR|BL|BR)\)/);
              if (tlMatch) {
                const pos = { TL: 0, TR: 1, BL: 2, BR: 3 }[tlMatch[1]];
                return pos;
              }
              const gridMatch = name.match(/\((\d)_(\d)\)/);
              if (gridMatch) {
                return parseInt(gridMatch[1]) * cols + parseInt(gridMatch[2]);
              }
              return 0;
            };

            const renderTile = (tile) => (
              <div
                key={tile.id}
                onClick={() => { setActiveSavedTileId(tile.id); if (tool !== 'tileFill') { setTool('tile'); setActiveDraw('tile'); } }}
                style={{
                  width: '32px', height: '32px',
                  outline: activeSavedTileId === tile.id ? '2px solid #65ff00' : '1px solid #444',
                  outlineOffset: '2px',
                  cursor: 'pointer',
                  flexShrink: 0
                }}
                title={tile.name || "Unnamed Tile"}
              >
                <TileIcon tile={tile} size={32} />
              </div>
            );

            const isFlow = effectiveTilesWide === 'flow';
            const effectiveWidth = isFlow ? 999 : effectiveTilesWide;

            return (
              <div style={{
                padding: '10px',
                display: isFlow ? 'flex' : 'grid',
                ...(isFlow ? { flexWrap: 'wrap' } : { gridTemplateColumns: `repeat(${effectiveTilesWide}, 32px)` }),
                gap: '4px',
                flex: 1,
                overflowY: 'auto',
                alignContent: 'flex-start',
                minHeight: '100px',
                ...(isFlow ? {} : { justifyItems: 'center' })
              }}>
                {filteredTiles.length === 0 ? (
                  <div style={{ color: '#aaa', fontSize: '11px', padding: '10px', width: '100%', textAlign: 'center' }}>
                    No matching tiles found
                  </div>
                ) : (
                  <>
                    {defaultTiles.map(tile => renderTile(tile))}
                    {customTiles.length > 0 && defaultTiles.length > 0 && (
                      <div style={{
                        ...(isFlow ? { width: '100%' } : { gridColumn: '1 / -1' }),
                        height: '0',
                        borderTop: '1px dashed #555',
                        margin: '4px 0'
                      }} />
                    )}
                    {groupOrder.map(gid => {
                      const group = groupMap[gid];
                      const groupName = tileGroupNames[gid] || '';
                      const isEditing = editingGroupId === gid;

                      const renderGroupLabel = () => (
                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '2px', gap: '4px' }}>
                          {isEditing ? (
                            <input
                              autoFocus
                              type="text"
                              value={editingGroupName}
                              onChange={(e) => setEditingGroupName(e.target.value)}
                              onBlur={() => {
                                setTileGroupNames(prev => ({ ...prev, [gid]: editingGroupName }));
                                setEditingGroupId(null);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  setTileGroupNames(prev => ({ ...prev, [gid]: editingGroupName }));
                                  setEditingGroupId(null);
                                }
                                if (e.key === 'Escape') setEditingGroupId(null);
                              }}
                              style={{
                                background: '#111', color: '#ccc', border: '1px solid #555', borderRadius: '2px',
                                padding: '1px 4px', fontSize: '9px', width: '100%', outline: 'none'
                              }}
                            />
                          ) : (
                            <span
                              onDoubleClick={() => { setEditingGroupId(gid); setEditingGroupName(groupName); }}
                              style={{
                                fontSize: '9px', color: '#888', cursor: 'text', userSelect: 'none',
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1
                              }}
                              title={groupName || 'Double-click to name this group'}
                            >
                              {groupName || 'Unnamed group'}
                            </span>
                          )}
                        </div>
                      );

                      if (group.length <= 1 || isFlow) {
                        if (isFlow && group.length > 1) {
                          const { cols, rows } = getSubGridSize(group);
                          const sorted = new Array(cols * rows).fill(null);
                          for (const tile of group) {
                            const pos = getTilePosition(tile, cols);
                            sorted[pos] = tile;
                          }
                          return (
                            <div
                              key={gid}
                              style={{
                                display: 'flex', flexDirection: 'column',
                                padding: '4px', background: '#2a2a2a', border: '1px solid #555', borderRadius: '4px'
                              }}
                            >
                              {renderGroupLabel()}
                              <div
                                style={{
                                  display: 'grid',
                                  gridTemplateColumns: `repeat(${cols}, 32px)`,
                                  gridTemplateRows: `repeat(${rows}, 32px)`,
                                  gap: '2px',
                                  justifyItems: 'center',
                                  alignItems: 'center'
                                }}
                              >
                                {sorted.map((tile, i) => tile ? renderTile(tile) : <div key={`empty-${i}`} style={{ width: '32px', height: '32px' }} />)}
                              </div>
                            </div>
                          );
                        }
                        return renderTile(group[0]);
                      }
                      const { cols, rows } = getSubGridSize(group);
                      const sorted = new Array(cols * rows).fill(null);
                      for (const tile of group) {
                        const pos = getTilePosition(tile, cols);
                        sorted[pos] = tile;
                      }
                      return (
                        <div
                          key={gid}
                          style={{
                            gridColumn: `span ${Math.min(cols, effectiveWidth)}`,
                            display: 'flex', flexDirection: 'column',
                            padding: '4px', background: '#2a2a2a', border: '1px solid #555', borderRadius: '4px'
                          }}
                        >
                          {renderGroupLabel()}
                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: `repeat(${cols}, 32px)`,
                              gridTemplateRows: `repeat(${rows}, 32px)`,
                              gap: '2px',
                              justifyItems: 'center',
                              alignItems: 'center'
                            }}
                          >
                            {sorted.map((tile, i) => tile ? renderTile(tile) : <div key={`empty-${i}`} style={{ width: '32px', height: '32px' }} />)}
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            );
          })()}

          {activeTile && (
            <div style={{ padding: '10px', borderTop: '1px solid #444', display: 'flex', flexDirection: 'column', gap: '8px', backgroundColor: '#252525' }}>
              <div style={{ display: 'flex', flexGrow: 1, gap: '4px' }}>
                <input
                  type="text"
                  value={activeTile.name || ''}
                  onChange={(e) => updateActiveTileProp('name', e.target.value)}
                  style={{ maxWidth: '100%', width: '100%', background: '#111', color: '#fff', border: '1px solid #444', padding: '6px', outline: 'none', borderRadius: '3px', fontSize: '12px' }}
                />
              </div>
            </div>
          )}

          <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid #444', backgroundColor: '#2d2d2d' }}>
            <button
              disabled={!activeSavedTileId}
              onClick={() => {
                setSavedTiles(savedTiles.filter(t => t.id !== activeSavedTileId));
                setActiveSavedTileId(null);
                setTool('pen');
                setActiveDraw('pen');
              }}
              style={{ padding: '8px', background: '#ff4444', color: '#fff', border: 'none', borderRadius: '4px', cursor: activeSavedTileId ? 'pointer' : 'default', opacity: activeSavedTileId ? 1 : 0.5, fontWeight: 'bold' }}
            >
              Delete Tile
            </button>
          </div>
        </>
      )}

      {/* OPENGAMEART SEARCH MODAL */}
      {isSearchModalOpen && createPortal(
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 100000,
          backgroundColor: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '20px'
        }}>
          <div style={{
            width: '850px',
            maxWidth: '100%',
            height: '80%',
            maxHeight: '700px',
            background: '#202022',
            border: '1px solid #444',
            borderRadius: '8px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 15px 40px rgba(0,0,0,0.8)'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid #3c3c3c',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#2a2a2c'
            }}>
              <span style={{ fontWeight: 'bold', fontSize: '15px', color: '#fff', letterSpacing: '0.5px' }}>
                OpenGameArt 2D Tileset Search
              </span>
              <button
                onClick={handleCloseModal}
                style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', fontSize: '18px', padding: '4px' }}
              >
                ✕
              </button>
            </div>

            {/* Modal Search Bar */}
            <div style={{ padding: '15px 20px', borderBottom: '1px solid #2d2d2f', display: 'flex', gap: '8px', backgroundColor: '#18181a' }}>
              <input
                type="text"
                placeholder="Search queries (e.g. overworld, dungeon, castle)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
                style={{
                  flex: 1,
                  background: '#0d0d0e',
                  color: '#fff',
                  border: '1px solid #3a3a3c',
                  borderRadius: '4px',
                  padding: '8px 12px',
                  fontSize: '13px',
                  outline: 'none'
                }}
              />
              <button
                onClick={handleSearch}
                disabled={isLoading}
                style={{
                  background: '#0078d4',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '8px 18px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 'bold',
                  opacity: isLoading ? 0.6 : 1
                }}
              >
                {isLoading && !selectedTileset ? 'Searching...' : 'Search'}
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px', backgroundColor: '#131314' }}>
              {isLoading && (
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'center', alignItems: 'center', gap: '15px', color: '#aaa' }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    border: '3px solid #333',
                    borderTop: '3px solid #0078d4',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }} />
                  <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
                  <span>Loading data from OpenGameArt...</span>
                </div>
              )}

              {error && !isLoading && (
                <div style={{ padding: '15px', background: '#3c1c1c', border: '1px solid #ff4444', borderRadius: '6px', color: '#ff8888', fontSize: '13px', lineHeight: '1.5', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div><strong>Error:</strong> {error}</div>
                  <button
                    onClick={handleBack}
                    style={{ alignSelf: 'flex-start', background: '#ff4444', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}
                  >
                    Go Back
                  </button>
                </div>
              )}

              {!isLoading && !error && !selectedTileset && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                  gap: '20px'
                }}>
                  {searchResults.map((result, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: '#1d1d1f',
                        border: '1px solid #333',
                        borderRadius: '6px',
                        padding: '12px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '12px',
                        boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
                        transition: 'transform 0.15s',
                        cursor: 'pointer'
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = '#444'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.borderColor = '#333'; }}
                      onClick={() => handleSelectTileset(result)}
                    >
                      <div style={{
                        height: '140px',
                        background: '#0d0d0e',
                        borderRadius: '4px',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        overflow: 'hidden',
                        border: '1px solid #222'
                      }}>
                        <img
                          src={`${API_BASE_URL}/proxy-oga?url=${encodeURIComponent(result.previewUrl)}`}
                          alt="Preview"
                          style={{
                            maxWidth: '100%',
                            maxHeight: '100%',
                            objectFit: 'contain',
                            imageRendering: 'pixelated'
                          }}
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#fff', height: '36px', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: '1.4' }} title={result.title}>
                          {result.title}
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleSelectTileset(result); }}
                          style={{
                            width: '100%',
                            background: '#0078d4',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '6px 12px',
                            cursor: 'pointer',
                            fontSize: '11px',
                            fontWeight: 'bold'
                          }}
                        >
                          Load Tileset
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Multiple files list screen */}
              {selectedTileset && filesList.length > 1 && !selectedFile && !isLoading && !error && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <button
                      onClick={handleBack}
                      style={{ background: '#333', border: '1px solid #555', color: '#ccc', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <BsArrowLeft /> Back to Search
                    </button>
                    <span style={{ fontSize: '14px', color: '#aaa' }}>
                      Files available for <strong>{selectedTileset.title}</strong>:
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {filesList.map((file, idx) => {
                      const isZip = file.filename.toLowerCase().endsWith('.zip');
                      const isImg = file.filename.toLowerCase().match(/\.(png|jpg|jpeg|gif|bmp)$/i);

                      return (
                        <div
                          key={idx}
                          onClick={() => handleProcessFile(file)}
                          style={{
                            background: '#1d1d1f',
                            border: '1px solid #333',
                            borderRadius: '6px',
                            padding: '16px 20px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#0078d4'; e.currentTarget.style.background = '#252528'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#333'; e.currentTarget.style.background = '#1d1d1f'; }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            {isZip ? (
                              <div style={{ width: '100px', height: '100px', background: '#0d0d0e', borderRadius: '4px', display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', border: '1px solid #222', flexShrink: 0 }}>
                                <img
                                  src={filePreviews[file.url] || `${API_BASE_URL}/proxy-oga?url=${encodeURIComponent(selectedTileset.previewUrl)}`}
                                  alt="Preview"
                                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', imageRendering: 'pixelated' }}
                                />
                              </div>
                            ) : isImg ? (
                              <div style={{ width: '100px', height: '100px', background: '#0d0d0e', borderRadius: '4px', display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', border: '1px solid #222', flexShrink: 0 }}>
                                <img
                                  src={`${API_BASE_URL}/proxy-oga?url=${encodeURIComponent(file.url)}`}
                                  alt="Preview"
                                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', imageRendering: 'pixelated' }}
                                />
                              </div>
                            ) : (
                              <BsFileEarmarkText style={{ color: '#a0a0a0' }} size={24} />
                            )}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#fff' }}>{file.filename}</span>
                              <span style={{ fontSize: '11px', color: '#888' }}>
                                {isZip ? 'ZIP archive (extracts images)' : isImg ? 'Direct image file' : 'Document/other file'}
                              </span>
                            </div>
                          </div>
                          <button
                            style={{
                              background: '#0078d4',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '4px',
                              padding: '8px 16px',
                              fontWeight: 'bold',
                              fontSize: '12px',
                              cursor: 'pointer'
                            }}
                          >
                            Load File
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Multiple Images extracted from ZIP Selector View */}
              {selectedTileset && zipImages.length > 1 && !isLoading && !error && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <button
                      onClick={handleBack}
                      style={{ background: '#333', border: '1px solid #555', color: '#ccc', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <BsArrowLeft /> Back
                    </button>
                    <span style={{ fontSize: '14px', color: '#aaa' }}>
                      Select a sheet from ZIP file <strong>{selectedFile?.filename}</strong>:
                    </span>
                  </div>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                    gap: '20px'
                  }}>
                    {zipImages.map((img, idx) => (
                      <div
                        key={idx}
                        onClick={() => handleImportImage(img.url, img.name)}
                        style={{
                          background: '#1d1d1f',
                          border: '1px solid #333',
                          borderRadius: '6px',
                          padding: '12px',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          gap: '12px',
                          boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
                          transition: 'transform 0.15s',
                          cursor: 'pointer'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = '#444'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.borderColor = '#333'; }}
                      >
                        <div style={{
                          height: '140px',
                          background: '#0d0d0e',
                          borderRadius: '4px',
                          display: 'flex',
                          justifyContent: 'center',
                          alignItems: 'center',
                          overflow: 'hidden',
                          border: '1px solid #222'
                        }}>
                          <img
                            src={img.url}
                            alt={img.name}
                            style={{
                              maxWidth: '100%',
                              maxHeight: '100%',
                              objectFit: 'contain',
                              imageRendering: 'pixelated'
                            }}
                          />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#fff', height: '36px', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: '1.4' }} title={img.name}>
                            {img.name}
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleImportImage(img.url, img.name); }}
                            style={{
                              width: '100%',
                              background: '#0078d4',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '4px',
                              padding: '6px 12px',
                              cursor: 'pointer',
                              fontSize: '11px',
                              fontWeight: 'bold'
                        }}
                      >
                        Import This Sheet
                      </button>
                    </div>
                  </div>
                ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '12px 20px',
              borderTop: '1px solid #3c3c3c',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#202022',
              fontSize: '11px',
              color: '#888'
            }}>
              <span>Powered by OpenGameArt.org (filtered for 2D tilesets).</span>
              <button
                onClick={handleCloseModal}
                style={{ background: '#333', border: '1px solid #555', color: '#fff', padding: '6px 15px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default TilePanel;
