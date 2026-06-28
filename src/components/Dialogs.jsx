import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { usePxShop, INITIAL_DEFAULT_TILES } from '../context/PxShopContext';
import { BsFolder2Open, BsPlayFill, BsCameraVideo, BsMusicNoteBeamed, BsBrush, BsReddit, BsDiscord, BsStars, BsYoutube } from 'react-icons/bs';
import { version } from '../../package.json';
import toast from 'react-hot-toast';
import { API_BASE_URL, isDesktop } from '../config';
import VideoPlayer from './VideoPlayer';
import { DEFAULT_16_PALETTE } from '../context/constants';
import PaletteColorPicker from './PaletteColorPicker';

const SceneThumbnail = ({ scene }) => {
  const canvasRef = useRef(null);
  const { renderLayersToCtx } = usePxShop();

  useEffect(() => {
    if (canvasRef.current && scene) {
      const ctx = canvasRef.current.getContext('2d');
      ctx.clearRect(0, 0, scene.dimensions.w, scene.dimensions.h);

      let layersToRender = [];
      if (scene.frames && scene.frames.length > 0) {
        layersToRender = scene.frames[0].layers;
      } else if (scene.layers) {
        layersToRender = scene.layers;
      }

      if (layersToRender && layersToRender.length > 0) {
        renderLayersToCtx(ctx, 1, layersToRender, scene.dimensions);
      }
    }
  }, [scene, renderLayersToCtx]);

  return <canvas ref={canvasRef} width={scene.dimensions.w} height={scene.dimensions.h} style={{ width: '100%', height: '100%', display: 'block', imageRendering: 'pixelated', pointerEvents: 'none' }} />;
};

const MapOverviewDialog = () => {
  const { scenes, setShowMapOverviewDialog, setScenes, switchScene, activeSceneId, saveHistory, layers, dimensions, renderLayersToCtx } = usePxShop();
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [draggingSceneId, setDraggingSceneId] = useState(null);
  const [dragStart, setDragStart] = useState(null);
  const [isPanning, setIsPanning] = useState(false);
  const containerRef = useRef(null);
  const hasInitializedPan = useRef(false);

  useEffect(() => {
    if (hasInitializedPan.current) return;

    // Check if we need to auto-arrange
    const actualScenes = scenes.filter(s => s.type !== 'group');
    const allAtZero = actualScenes.every(s => (s.worldX || 0) === 0 && (s.worldY || 0) === 0);
    let currentScenes = scenes;
    if (allAtZero && actualScenes.length > 1) {
      let currentX = 0;
      const spacing = 32;
      const arrangedScenes = scenes.map(s => {
        if (s.type === 'group') return s;
        const sceneX = currentX;
        currentX += s.dimensions.w + spacing;
        return {
          ...s,
          worldX: sceneX,
          worldY: 0
        };
      });
      currentScenes = arrangedScenes;
      setScenes(arrangedScenes);
      saveHistory("Auto Arrange Map Scenes", layers, dimensions, { scenes: arrangedScenes });
    }

    // Center on active scene
    if (containerRef.current) {
      hasInitializedPan.current = true;
      const rect = containerRef.current.getBoundingClientRect();
      const hh = rect.height / 2;
      const firstScene = currentScenes[0];
      const hhScene = firstScene ? firstScene.dimensions.h : 160;
      setPan({
        x: 50,
        y: hh - (hhScene / 2) * zoom
      });
    }
  }, [scenes, zoom, setScenes, saveHistory, layers, dimensions]);

  const handleAutoArrange = () => {
    let currentX = 0;
    const spacing = 32;
    const arrangedScenes = scenes.map(s => {
      if (s.type === 'group') return s;
      const sceneX = currentX;
      currentX += s.dimensions.w + spacing;
      return {
        ...s,
        worldX: sceneX,
        worldY: 0
      };
    });
    setScenes(arrangedScenes);
    saveHistory("Auto Arrange Map Scenes", layers, dimensions, { scenes: arrangedScenes });

    // Pan to the left
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const hh = rect.height / 2;
      const firstScene = arrangedScenes[0];
      const hhScene = firstScene ? firstScene.dimensions.h : 160;
      setPan({
        x: 50,
        y: hh - (hhScene / 2) * zoom
      });
    }
  };

  const handleExportWorldMap = () => {
    const actualScenes = scenes.filter(s => s.type !== 'group');
    if (actualScenes.length === 0) return;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    actualScenes.forEach(s => {
      const x = s.worldX || 0;
      const y = s.worldY || 0;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + s.dimensions.w);
      maxY = Math.max(maxY, y + s.dimensions.h);
    });

    const totalW = maxX - minX;
    const totalH = maxY - minY;

    if (totalW <= 0 || totalH <= 0 || !isFinite(totalW) || !isFinite(totalH)) {
      toast.error("Invalid map bounds. Arrange the scenes first.");
      return;
    }

    const toastId = toast.loading("Generating world map PNG...");

    try {
      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = totalW;
      exportCanvas.height = totalH;
      const exportCtx = exportCanvas.getContext('2d');

      scenes.forEach(s => {
        const x = (s.worldX || 0) - minX;
        const y = (s.worldY || 0) - minY;

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = s.dimensions.w;
        tempCanvas.height = s.dimensions.h;
        const tempCtx = tempCanvas.getContext('2d');

        let layersToRender = [];
        if (s.frames && s.frames.length > 0) {
          layersToRender = s.frames[0].layers;
        } else if (s.layers) {
          layersToRender = s.layers;
        }

        if (layersToRender && layersToRender.length > 0) {
          renderLayersToCtx(tempCtx, 1, layersToRender, s.dimensions);
        }

        exportCtx.drawImage(tempCanvas, x, y);
      });

      const dataUrl = exportCanvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = 'world_map.png';
      link.href = dataUrl;
      link.click();

      toast.success("World map exported successfully!", { id: toastId });
    } catch (e) {
      console.error(e);
      toast.error("Failed to export world map: " + e.message, { id: toastId });
    }
  };

  const handleMouseDown = (e, scene) => {
    e.stopPropagation();
    if (e.button === 1 || e.altKey || (!scene && e.button === 0)) {
      setIsPanning(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    } else if (scene) {
      setDraggingSceneId(scene.id);
      setDragStart({
        x: (e.clientX - pan.x) / zoom - (scene.worldX || 0),
        y: (e.clientY - pan.y) / zoom - (scene.worldY || 0)
      });
    }
  };

  const handleMouseMove = (e) => {
    if (isPanning) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    } else if (draggingSceneId) {
      const newX = (e.clientX - pan.x) / zoom - dragStart.x;
      const newY = (e.clientY - pan.y) / zoom - dragStart.y;
      const snap = 8;
      const snapX = Math.round(newX / snap) * snap;
      const snapY = Math.round(newY / snap) * snap;

      setScenes(prev => prev.map(s =>
        s.id === draggingSceneId ? { ...s, worldX: snapX, worldY: snapY } : s
      ));
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    if (draggingSceneId) {
      saveHistory("Arrange Map Scenes", layers, dimensions, { scenes });
    }
    setDraggingSceneId(null);
  };

  const handleWheel = (e) => {
    e.preventDefault();
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomDelta = e.deltaY > 0 ? -0.1 : 0.1;
    let newZoom = Math.max(0.1, Math.min(5, zoom + zoomDelta));
    newZoom = Math.round(newZoom * 10) / 10;

    const scaleChange = newZoom / zoom;
    setPan({
      x: mouseX - (mouseX - pan.x) * scaleChange,
      y: mouseY - (mouseY - pan.y) * scaleChange
    });
    setZoom(newZoom);
  };

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false });
      return () => container.removeEventListener('wheel', handleWheel);
    }
  }, [zoom, pan]);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '15px 20px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#2a2a2a' }}>
        <span style={{ fontWeight: 'bold', color: '#4CAF50', fontSize: '16px' }}>Map Overview</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={handleAutoArrange}
            style={{
              background: '#2a4a2a',
              border: '1px solid #4CAF50',
              color: '#fff',
              padding: '6px 12px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 'bold',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#4CAF50'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#2a4a2a'; }}
          >
            Auto Arrange
          </button>
          <button
            onClick={handleExportWorldMap}
            style={{
              background: '#005a9e',
              border: '1px solid #0078d4',
              color: '#fff',
              padding: '6px 12px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 'bold',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#0078d4'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#005a9e'; }}
          >
            Export PNG
          </button>
          <button onClick={() => setShowMapOverviewDialog(false)} style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', fontSize: '18px' }}>✕</button>
        </div>
      </div>
      <div
        ref={containerRef}
        onMouseDown={(e) => handleMouseDown(e, null)}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ flex: 1, position: 'relative', overflow: 'hidden', cursor: isPanning ? 'grabbing' : 'grab' }}
      >
        <div style={{
          position: 'absolute',
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0'
        }}>
          {scenes.filter(scene => scene.type !== 'group').map(scene => (
            <div
              key={scene.id}
              onMouseDown={(e) => handleMouseDown(e, scene)}
              onDoubleClick={(e) => { e.stopPropagation(); switchScene(scene.id); setShowMapOverviewDialog(false); }}
              style={{
                position: 'absolute',
                left: scene.worldX || 0,
                top: scene.worldY || 0,
                width: scene.dimensions.w,
                height: scene.dimensions.h,
                border: activeSceneId === scene.id ? '2px solid #65ff00' : '1px solid #555',
                backgroundColor: '#111',
                boxShadow: '0 4px 8px rgba(0,0,0,0.5)',
                cursor: draggingSceneId === scene.id ? 'grabbing' : 'grab',
                boxSizing: 'content-box'
              }}
            >
              <SceneThumbnail scene={scene} />
              <div style={{ position: 'absolute', top: -20, left: 0, color: activeSceneId === scene.id ? '#65ff00' : '#aaa', fontSize: '12px', whiteSpace: 'nowrap', textShadow: '1px 1px 0 #000' }}>
                {scene.name}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ padding: '10px 20px', background: '#2a2a2a', borderTop: '1px solid #333', fontSize: '12px', color: '#aaa', display: 'flex', justifyContent: 'space-between' }}>
        <span>Drag scenes to arrange them. Middle-click or drag background to pan. Scroll to zoom. Double-click a scene to edit it.</span>
        <span>Zoom: {Math.round(zoom * 100)}%</span>
      </div>
    </div>
  );
};

const Dialogs = () => {
  const {
    showAboutDialog, setShowAboutDialog,
    showNewProjectDialog, setShowNewProjectDialog,
    setShowVideoPlayerDialog, setVideoPlayerSource,
    newProjectSettings, setNewProjectSettings,
    isPixelated, setIsPixelated,
    showNewProjectOnStartup, setShowNewProjectOnStartup,
    handleCreateNewProject,
    showWizardDialog, setShowWizardDialog,
    wizardSettings, setWizardSettings,
    handleWizardCreate,
    imageInputRef,
    projectInputRef,
    loadProjectData,

    // Adjust Selection
    showAdjustSelectionDialog, closeAdjustSelectionDialog,
    adjustSelectionAmount, updateAdjustedSelection,

    // Resize Canvas
    showResizeCanvasDialog, handleResizeCanvas,
    resizeCanvasSettings, setResizeCanvasSettings,

    // HSL
    showHSLDialog, closeHSLDialog,
    hslSettings, setHslSettings,

    // Brightness/Contrast
    showBCDialog, closeBCDialog,
    bcSettings, setBcSettings,

    // Magic BG
    showMagicBgDialog, closeMagicBgDialog,
    magicBgSettings, setMagicBgSettings,

    // Layer FX
    fxLayerId, setFxLayerId,
    layers, updateLayerProp,
    saveHistory,

    // Import Palette
    showImportPaletteDialog, setShowImportPaletteDialog,
    pendingImportColors, confirmPaletteImport,
    paletteImportFileName,

    // Palette Convert
    showPaletteConvertDialog, setShowPaletteConvertDialog,
    pendingConvertData,
    confirmPaletteConvert,

    // Tile Import Palette Choice Dialog
    showTileImportPaletteDialog, setShowTileImportPaletteDialog,
    pendingTileImportData, setPendingTileImportData,
    executeTileImport,
    showTileImportSizeDialog, setShowTileImportSizeDialog,
    pendingTileImportFile, setPendingTileImportFile,
    pendingOgaImportData, setPendingOgaImportData,
    setOgaImportTilesWide,
    processTileImport,
    importTilesDirectly,

    // Game Assets Export
    showExportDialog, setShowExportDialog,
    exportLevelName, setExportLevelName,
    exportLevelType, setExportLevelType,
    exportFormat, setExportFormat,
    exportGameAssets,
    isPublishingRom,
    isBusy, setIsBusy,
    publishRom,
    validateScenesLayers,
    showEmulatorDialog, setShowEmulatorDialog,
    showMapOverviewDialog, setShowMapOverviewDialog,
    showHtml5ExportDialog, setShowHtml5ExportDialog,
    html5BgColor, setHtml5BgColor,
    html5ContainerColor, setHtml5ContainerColor,
    exportHtml5,
    exportExe,
    exportPNG,
    exportAllLayersZipped,
    includedArtists,
    includeCreditsScene, setIncludeCreditsScene,
    creditsText, setCreditsText,
    creditsBgColor, setCreditsBgColor, creditsTextColor, setCreditsTextColor,
    creditsMusicId, setCreditsMusicId,
    creditsEffect, setCreditsEffect,
    musicTracks,
    recentColors,
    showLevelGenDialog, setShowLevelGenDialog,
    levelGenSceneId,
    generateLevelForScene,
    scenes,
    savedTiles
  } = usePxShop();

  const [isCompiling, setIsCompiling] = useState(false);
  const [compileLog, setCompileLog] = useState([]);
  const logEndRef = useRef(null);
  const [fitToScene, setFitToScene] = useState(false);
  const [importMode, setImportMode] = useState('scene');

  useEffect(() => {
    if (showPaletteConvertDialog) {
      setFitToScene(false);
      setImportMode('scene');
    }
  }, [showPaletteConvertDialog, pendingConvertData]);

  const emulatorCanvasRef = useRef(null);
  const audioContextRef = useRef(null);
  const audioCleanupRef = useRef(null);
  const [emulatorModule, setEmulatorModule] = useState(null);
  const [romLoaded, setRomLoaded] = useState(false);

  useEffect(() => {
    if (logEndRef.current) logEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [compileLog]);

  useEffect(() => {
    if (!showEmulatorDialog) {
      setRomLoaded(false);
      if (emulatorModule) {
        try {
          if (typeof emulatorModule.pause === 'function') emulatorModule.pause();
          if (typeof emulatorModule.stop === 'function') emulatorModule.stop();
          if (typeof emulatorModule.quit === 'function') emulatorModule.quit();
        } catch (e) { }
      }
      setEmulatorModule(null);
      if (audioContextRef.current) {
        try {
          audioContextRef.current.close();
        } catch (e) { }
        audioContextRef.current = null;
      }
      if (audioCleanupRef.current) {
        audioCleanupRef.current();
        audioCleanupRef.current = null;
      }
    }
  }, [showEmulatorDialog, emulatorModule]);

  useEffect(() => {
    if (showEmulatorDialog) {
      handleRemoteCompile();
    }
  }, [showEmulatorDialog]);

  // handleRemoteCompile moved to PxShopContext or handled otherwise, we can use it to fetch the ROM into emulator if needed.
  // Actually, since the prompt only requested 'Publish ROM' button, we can remove handleRemoteCompile from Dialogs if we want to handle it externally, but let's keep it here to play in browser via node.js local server if needed.

  const handleRomUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      const toastId = toast.loading(`Loading ${file.name}... Launching Emulator...`);
      try {
        let IodineGBA;
        try {
          await import('iodine-gba/user_css/main.css');
          const iodineModule = await import('iodine-gba');
          IodineGBA = iodineModule.default || iodineModule.IodineGBA || iodineModule.GameBoyAdvance || iodineModule;
        } catch (err) {
          if (window.IodineGBA) IodineGBA = window.IodineGBA;
          else if (window.GameBoyAdvance) IodineGBA = window.GameBoyAdvance;
          else throw new Error("iodine-gba package not found. Please run 'npm install iodine-gba' first.");
        }

        const biosResponse = await fetch('/gba_bios.bin');
        if (!biosResponse.ok) throw new Error("Could not load BIOS from /gba_bios.bin");
        const biosBuffer = await biosResponse.arrayBuffer();
        const biosData = new Uint8Array(biosBuffer);

        const buffer = await file.arrayBuffer();
        const data = new Uint8Array(buffer);

        const iodine = new IodineGBA();
        if (typeof iodine.attachCanvas === 'function') iodine.attachCanvas(emulatorCanvasRef.current);
        else if (typeof iodine.attachGraphicsFrameHandler === 'function') {
          const ctx = emulatorCanvasRef.current.getContext('2d');
          const imgData = ctx.createImageData(240, 160);
          iodine.attachGraphicsFrameHandler((frameBuffer) => {
            if (!frameBuffer) return;
            if (frameBuffer.length === 240 * 160 * 4) {
              imgData.data.set(frameBuffer);
            } else if (frameBuffer.length === 240 * 160 * 3) {
              for (let i = 0, j = 0; i < frameBuffer.length; i += 3, j += 4) {
                imgData.data[j] = frameBuffer[i];
                imgData.data[j + 1] = frameBuffer[i + 1];
                imgData.data[j + 2] = frameBuffer[i + 2];
                imgData.data[j + 3] = 255;
              }
            }
            ctx.putImageData(imgData, 0, 0);
          });
        }

        // Audio Setup
        try {
          const AudioContext = window.AudioContext || window.webkitAudioContext;
          if (AudioContext) {
            if (audioContextRef.current) {
              try {
                audioContextRef.current.close();
              } catch (e) { }
            }

            const audioCtx = new AudioContext();
            audioContextRef.current = audioCtx;

            let resampleBuffer = [];
            let emuSampleRate = 44100;
            let ctxSampleRate = audioCtx.sampleRate;
            let resamplePos = 0;
            let volume = 0.3;

            // Resume audio context if the browser suspended it (autoplay policy)
            if (audioCtx.state === 'suspended') {
              audioCtx.resume();
            }

            const resumeAudio = () => {
              if (audioCtx.state === 'suspended') {
                audioCtx.resume();
              }
            };
            window.addEventListener('click', resumeAudio);
            window.addEventListener('keydown', resumeAudio);
            if (audioCleanupRef.current) {
              audioCleanupRef.current();
            }
            audioCleanupRef.current = () => {
              window.removeEventListener('click', resumeAudio);
              window.removeEventListener('keydown', resumeAudio);
            };

            // Set up a fully iodine-conforming audio handler with resampling
            const audioHandler = {
              initialize: (channels, sRate, bAmount, vol, errCallback) => {
                emuSampleRate = sRate;
                volume = vol;
              },
              register: () => {
                const scriptNode = audioCtx.createScriptProcessor(4096, 0, 2);
                const ratio = emuSampleRate / ctxSampleRate;
                scriptNode.onaudioprocess = (e) => {
                  const left = e.outputBuffer.getChannelData(0);
                  const right = e.outputBuffer.getChannelData(1);
                  const len = left.length;
                  let pos = resamplePos;
                  const buf = resampleBuffer;
                  const bufLen = buf.length;
                  for (let i = 0; i < len; i++) {
                    const idx = Math.floor(pos) * 2;
                    if (idx + 1 < bufLen) {
                      const frac = pos - Math.floor(pos);
                      const nextIdx = idx + 2;
                      if (nextIdx + 1 < bufLen) {
                        left[i] = (buf[idx] + (buf[nextIdx] - buf[idx]) * frac) * volume;
                        right[i] = (buf[idx + 1] + (buf[nextIdx + 1] - buf[idx + 1]) * frac) * volume;
                      } else {
                        left[i] = buf[idx] * volume;
                        right[i] = buf[idx + 1] * volume;
                      }
                    } else {
                      left[i] = 0;
                      right[i] = 0;
                    }
                    pos += ratio;
                  }
                  const consumed = Math.floor(pos) * 2;
                  if (consumed > 0) {
                    resampleBuffer.splice(0, Math.min(consumed, resampleBuffer.length));
                  }
                  resamplePos = pos - Math.floor(pos);
                };
                scriptNode.connect(audioCtx.destination);
                audioHandler.scriptNode = scriptNode;
              },
              unregister: () => {
                if (audioHandler.scriptNode) {
                  audioHandler.scriptNode.disconnect();
                  audioHandler.scriptNode.onaudioprocess = null;
                  audioHandler.scriptNode = null;
                }
                resampleBuffer = [];
                resamplePos = 0;
              },
              changeVolume: (vol) => {
                volume = vol;
              },
              remainingBuffer: () => {
                return (resampleBuffer.length / 2) | 0;
              },
              play: () => { },
              pause: () => { },
              setVolume: () => { },
              push: (buffer) => {
                if (!buffer || buffer.length === 0) return;
                for (let i = 0; i < buffer.length; i++) {
                  resampleBuffer.push(buffer[i]);
                }
              }
            };

            // Force emulator audio state re-initialization
            if (typeof iodine.disableAudio === 'function') {
              iodine.disableAudio();
            }
            if (typeof iodine.attachAudioHandler === 'function') {
              iodine.attachAudioHandler(audioHandler);
            } else {
              iodine.audio = audioHandler;
            }
            if (typeof iodine.enableAudio === 'function') {
              iodine.enableAudio();
            }
          } else {
            console.warn("AudioContext not supported in this browser.");
            if (typeof iodine.disableAudio === 'function') iodine.disableAudio();
          }
        } catch (audioErr) {
          console.error("Failed to initialize audio:", audioErr);
          if (typeof iodine.disableAudio === 'function') iodine.disableAudio();
        }

        if (typeof iodine.attachBIOS === 'function') iodine.attachBIOS(biosData);
        if (typeof iodine.attachROM === 'function') iodine.attachROM(data);
        if (typeof iodine.play === 'function') iodine.play();

        setEmulatorModule(iodine);

        setRomLoaded(true);
        toast.success("Game started! Use arrow keys and Z/X for A/B.", { id: toastId });
      } catch (error) {
        console.error("Emulator error:", error);
        toast.error(error.message || "Failed to start the emulator.", { id: toastId });
      }
    }
  };

  const triggerKey = (keyName, isDown) => {
    let gbaKey = null;
    if (keyName === 'ArrowUp') { gbaKey = 'up'; }
    else if (keyName === 'ArrowDown') { gbaKey = 'down'; }
    else if (keyName === 'ArrowLeft') { gbaKey = 'left'; }
    else if (keyName === 'ArrowRight') { gbaKey = 'right'; }
    else if (keyName === 'Enter') { gbaKey = 'start'; }
    else if (keyName === 'Backspace') { gbaKey = 'select'; }
    else if (keyName === 'x') { gbaKey = 'a'; }
    else if (keyName === 'z') { gbaKey = 'b'; }
    else if (keyName === 'a') { gbaKey = 'l'; }
    else if (keyName === 's') { gbaKey = 'r'; }

    if (emulatorModule && gbaKey !== null) {
      if (isDown && typeof emulatorModule.keyDown === 'function') emulatorModule.keyDown(gbaKey);
      else if (!isDown && typeof emulatorModule.keyUp === 'function') emulatorModule.keyUp(gbaKey);
    }
  };

  useEffect(() => {
    if (!emulatorModule) return;

    const keyMap = {
      'ArrowUp': 'up',
      'ArrowDown': 'down',
      'ArrowLeft': 'left',
      'ArrowRight': 'right',
      'Enter': 'start',
      'Backspace': 'select',
      'x': 'a',
      'z': 'b',
      'a': 'l',
      's': 'r'
    };

    const handleKeyDown = (e) => {
      if (e.repeat) return;
      const gbaKey = keyMap[e.key] !== undefined ? keyMap[e.key] : keyMap[e.key.toLowerCase()];
      if (gbaKey !== undefined && typeof emulatorModule.keyDown === 'function') {
        emulatorModule.keyDown(gbaKey);
        e.preventDefault();
      }
    };

    const handleKeyUp = (e) => {
      const gbaKey = keyMap[e.key] !== undefined ? keyMap[e.key] : keyMap[e.key.toLowerCase()];
      if (gbaKey !== undefined && typeof emulatorModule.keyUp === 'function') {
        emulatorModule.keyUp(gbaKey);
        e.preventDefault();
      }
    };

    const handleBlur = () => {
      if (typeof emulatorModule.keyUp === 'function') {
        Object.values(keyMap).forEach((gbaKey) => {
          emulatorModule.keyUp(gbaKey);
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [emulatorModule]);

  const handleRemoteCompile = async () => {
    if (isBusy) return;
    setIsCompiling(true);
    setIsBusy(true);
    setCompileLog(["[BUILDER] Generating project data in memory..."]);

    try {
      const zipBlob = await exportGameAssets(exportLevelName || 'game', 'butano', 'TOPDOWN', true);
      if (!zipBlob) throw new Error("Failed to generate project data.");

      setCompileLog(prev => [...prev, `[BUILDER] Compiling project data...`]);

      const formData = new FormData();
      formData.append('project', new File([zipBlob], 'project.zip', { type: 'application/zip' }));

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 900000);

      const response = await fetch(`${API_BASE_URL}/compile`, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });

      if (controller.signal.aborted) return;

      if (!response.ok) {
        clearTimeout(timeoutId);
        const errorText = await response.text();
        const errorLines = errorText.split('\n');
        setCompileLog(prev => [...prev, `[ERROR] Compilation failed: ${response.status}`, ...errorLines]);
        return;
      }

      const { jobId } = await response.json();
      setCompileLog(prev => [...prev, "[BUILDER] Compilation started, waiting for completion..."]);
      clearTimeout(timeoutId);

      // Poll for compilation completion with abort support
      let job;
      const pollTimeout = 30 * 60 * 1000;
      const pollStart = Date.now();
      while (true) {
        if (controller.signal.aborted) return;
        if (Date.now() - pollStart > pollTimeout) {
          setCompileLog(prev => [...prev, `[ERROR] Compilation timed out after 30 minutes.`]);
          return;
        }
        await new Promise(r => setTimeout(r, 2000));
        if (controller.signal.aborted) return;
        const statusRes = await fetch(`${API_BASE_URL}/compile-status/${jobId}`, { signal: controller.signal });
        if (!statusRes.ok) {
          setCompileLog(prev => [...prev, `[ERROR] Failed to check compilation status: ${statusRes.status}`]);
          return;
        }
        job = await statusRes.json();
        if (job.status === 'ready') break;
        if (job.status === 'error') {
          setCompileLog(prev => [...prev, `[ERROR] ${job.error || 'Compilation failed'}`]);
          return;
        }
      }

      setCompileLog(prev => [...prev, "[BUILDER] Success!"]);
      const downloadUrl = `${API_BASE_URL}${job.downloadUrl}`;
      const downloadRes = await fetch(downloadUrl);
      if (!downloadRes.ok) {
        setCompileLog(prev => [...prev, `[ERROR] Download failed: ${downloadRes.status}`]);
        return;
      }
      const blob = await downloadRes.blob();

      setCompileLog(prev => [...prev, "[BUILDER] Loading ROM into emulator..."]);

      const dummyFile = new File([blob], 'game.gba');
      await handleRomUpload({ target: { files: [dummyFile] } });
    } catch (err) {
      if (err.name === 'AbortError') {
        setCompileLog(prev => [...prev, `[ERROR] Compilation timed out after 15 minutes. The server may be busy or the project too large.`]);
      } else {
        setCompileLog(prev => [...prev, `[ERROR] ${err.message}`]);
      }
    } finally {
      setIsCompiling(false);
      setIsBusy(false);
    }
  };

  return (
    <>
      {/* ABOUT DIALOG */}
      {showAboutDialog && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.7)' }}>
          <div style={{ background: '#2a2a2a', border: '1px solid #4CAF50', borderRadius: '8px', boxShadow: '0 10px 30px rgba(0,0,0,0.8)', padding: '30px', width: '500px', textAlign: 'center' }}>
            <div style={{display:'flex', flexDirection:'row', gap:'10px', marginBottom: '10px', padding: '10px', borderRadius: '10px', backgroundColor: '#1a1a1a'}}>
              <div style={{flexGrow: 0}}>
                <img src="/lp-thumb.png" style={{height:'125px'}}/>
              </div>
              <div style={{flexGrow: 1}}>
                <div style={{ textAlign: 'left', fontSize: '28px', fontWeight: 'bold', color: '#0078d4', marginBottom: '5px', marginTop: '10px' }}>PxGBA</div>
                <div style={{ textAlign: 'left', fontSize: '14px', color: '#0078d4' }}>Game Boy Advance Game Studio</div>
                <div style={{ textAlign: 'left', fontSize: '14px', color: '#888', marginBottom: '10px' }}>&copy;2026 LIFTED PIXEL</div>
                <div style={{ textAlign: 'left', fontSize: '12px', color: '#f0c15cff' }}>v{version}</div>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', padding: '20px', borderRadius: '10px', backgroundColor: '#1a1a1a' }}>
              <div style={{ flexGrow: 1, fontSize: '12px', color: '#ccc', textAlign: 'left', lineHeight: '1.5' }}>
                <strong>Powered by Open Source:</strong><br />
                • <a href="https://github.com/GValiente/butano" target="_blank" style={{ color: '#4CAF50' }}>Butano Engine</a> (GBA C++)<br />
                • <a href="https://devkitpro.org/" target="_blank" style={{ color: '#4CAF50' }}>devkitARM</a> (Compiler)<br />
                • <a href="https://github.com/taisel/IodineGBA" target="_blank" style={{ color: '#4CAF50' }}>iodineGBA</a> (Web Emulator)<br />
                • <a href="https://github.com/ez-me/gba-bios" target="_blank" style={{ color: '#4CAF50' }}>ez-me</a> (Open Source GBA Bios)<br />
                • <a href="https://github.com/antoniourtza/maxmod" target="_blank" style={{ color: '#4CAF50' }}>Maxmod</a> (Audio)<br />
                • <a href="https://opengameart.org/" target="_blank" style={{ color: '#4CAF50' }}>Open Game Art</a> (Tile Search)<br />
                • <a href="https://modarchive.org/" target="_blank" style={{ color: '#4CAF50' }}>The Mod Archive</a> (Music Search)
              </div>
              <div style={{ flexGrow: 1, fontSize: '12px', color: '#ccc', textAlign: 'right', lineHeight: '1.5' }}>
                <strong>Shoutouts:</strong><br />
                <a href="https://gbstudio.dev/" target="_blank" style={{ color: '#4CAF50' }}>GB Studio</a><br />
                Athena <br />
                Gage <br />
                Grant2 <br />
                Cool Man Chiu <br />
                Phred.er.rick <br/>
                Bucko91
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'space-between' }}>
              <a title="Support Development" href="https://paypal.me/gdmcvittie" target='_blank' rel="noreferrer" style={{ fontSize: '12px', flex: 1, padding: '11px', background: '#aa3bff', border: 'none', color: '#fff', borderRadius: '4px', marginRight: '10px', cursor: 'pointer', fontWeight: 'bold', textDecoration: 'none' }}>DONATE</a>
              <a title="Visit Community Forum" href="https://reddit.com/r/pxgba" target='_blank' rel="noreferrer" style={{ padding: '10px 20px', background: '#FF4500', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', textDecoration: 'none' }}><BsReddit size={14} /></a>
              <a title="Join Discord" href="https://discord.gg/4zPChaMc" target='_blank' rel="noreferrer" style={{ padding: '10px 20px', background: '#5865F2', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', textDecoration: 'none' }}><BsDiscord size={14} /></a>
              <a title="YouTube Tutorials" href="https://www.youtube.com/@LiftedPixel_ca/videos" target='_blank' rel="noreferrer" style={{ padding: '10px 20px', background: '#FF0000', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', textDecoration: 'none' }}><BsYoutube size={14} /></a>
              <button onClick={() => setShowAboutDialog(false)} style={{ padding: '10px 30px', background: '#4CAF50', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* NEW PROJECT DIALOG */}
      {showNewProjectDialog && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.7)' }}>
          <div style={{ background: '#2a2a2a', border: '1px solid #4CAF50', borderRadius: '8px', boxShadow: '0 10px 30px rgba(0,0,0,0.8)', padding: '20px', width: '400px' }}>
            <div style={{ fontSize: '14px', marginBottom: '20px', color: '#fff', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between' }}>
              <span>NEW PROJECT</span>
              <button onClick={() => setShowNewProjectDialog(false)} style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', fontSize: '16px' }}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div style={{ display: 'flex', gap: '5px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', flex: 1, width: '165px' }}>
                  <label style={{ fontSize: '12px', color: '#aaa' }}>Width (tiles)</label>
                  <select value={Math.round(newProjectSettings.w / 8)} onChange={(e) => setNewProjectSettings(prev => ({ ...prev, w: Math.max(1, parseInt(e.target.value) || 1) * 8 }))} style={{ background: '#111', color: '#fff', border: '1px solid #444', padding: '8px', borderRadius: '4px', outline: 'none', cursor: 'pointer' }}>
                    {[32, 64, 96, 128, 160, 192, 224, 256].map(t => <option key={t} value={t}>{t}</option>)}
                    {!([32, 64, 96, 128, 160, 192, 224, 256].includes(Math.round(newProjectSettings.w / 8))) && <option value={Math.round(newProjectSettings.w / 8)}>{Math.round(newProjectSettings.w / 8)}</option>}
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', flex: 1, width: '165px' }}>
                  <label style={{ fontSize: '12px', color: '#aaa' }}>Height (tiles)</label>
                  <select value={Math.round(newProjectSettings.h / 8)} onChange={(e) => setNewProjectSettings(prev => ({ ...prev, h: Math.max(1, parseInt(e.target.value) || 1) * 8 }))} style={{ background: '#111', color: '#fff', border: '1px solid #444', padding: '8px', borderRadius: '4px', outline: 'none', cursor: 'pointer' }}>
                    {[32, 64, 96, 128, 160, 192, 224, 256].map(t => <option key={t} value={t}>{t}</option>)}
                    {!([32, 64, 96, 128, 160, 192, 224, 256].includes(Math.round(newProjectSettings.h / 8))) && <option value={Math.round(newProjectSettings.h / 8)}>{Math.round(newProjectSettings.h / 8)}</option>}
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(16, 1fr)', gap: '4px', background: '#111', padding: '10px', borderRadius: '4px', border: '1px solid #444' }}>
                  {(recentColors || []).slice(0, 64).map(c => (
                    <div
                      key={c}
                      onClick={() => setNewProjectSettings(prev => ({ ...prev, bgColor: c }))}
                      style={{
                        aspectRatio: '1',
                        backgroundColor: c,
                        cursor: 'pointer',
                        border: newProjectSettings.bgColor === c ? '2px solid #fff' : '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '3px',
                        boxShadow: newProjectSettings.bgColor === c ? '0 0 4px #fff' : 'none',
                        boxSizing: 'border-box',
                        transition: 'all 0.1s ease'
                      }}
                      title={c}
                    />
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'row', gap: '6px' }}>
              <button onClick={() => { projectInputRef.current?.click(); setShowNewProjectDialog(false); }} style={{ width: '100%', padding: '10px', background: '#333', border: '1px solid #444', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#0078d4'; e.currentTarget.style.borderColor = '#0078d4'; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#333'; e.currentTarget.style.borderColor = '#444'; }}>
                <BsFolder2Open size={16} /> Open Project
              </button>

              <button onClick={async () => {
                const toastId = toast.loading('Loading sample game...');
                try {
                  const url = isDesktop ? `${API_BASE_URL}/game.pxg` : '/game.pxg';
                  const res = await fetch(url);
                  if (!res.ok) throw new Error('Could not load sample game.');
                  const project = await res.json();
                  loadProjectData(project);
                  setShowNewProjectDialog(false);
                  toast.success('Sample game loaded!', { id: toastId });
                } catch (e) {
                  toast.error(e.message, { id: toastId });
                }
              }} style={{ width: '100%', padding: '10px', background: '#333', border: '1px solid #444', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#9c27b0'; e.currentTarget.style.borderColor = '#9c27b0'; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#333'; e.currentTarget.style.borderColor = '#444'; }}>
                <BsPlayFill size={18} /> Example Project
              </button>
</div>
              <div style={{ display: 'flex', gap: '5px', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0px', flexGrow: 1 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#ccc', fontSize: '10px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={showNewProjectOnStartup}
                      onChange={(e) => {
                        const isChecked = e.target.checked;
                        setShowNewProjectOnStartup(isChecked);
                        if (typeof localStorage !== 'undefined') {
                          localStorage.setItem('px_shop_show_new_project', isChecked.toString());
                        }
                      }}
                    />
                    Show at startup
                  </label>
                </div>
                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                  <a href="https://paypal.me/gdmcvittie" target='_blank' rel="noreferrer" style={{ fontSize: '10px', flex: 1, padding: '10px', background: '#aa3bff', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', textDecoration: 'none' }}>DONATE</a>
                  <a title="YouTube Tutorials" href="https://www.youtube.com/@LiftedPixel_ca/videos" target='_blank' rel="noreferrer" style={{ padding: '10px 20px', background: '#FF0000', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', flex:1, textDecoration: 'none' }}><BsYoutube size={14} /></a>

                  <button title="Launch Game Wizard" onClick={() => { setShowNewProjectDialog(false); setShowWizardDialog(true); }} style={{ flex: 1, padding: '10px', background: '#65ff00', border: 'none', color: '#000', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}><BsStars size={14} style={{marginLeft:'5px',marginRight:'5px'}} /></button>
                  <button title="Create a new project" onClick={handleCreateNewProject} style={{ flex: 1, padding: '10px', background: '#4CAF50', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Create</button>
                </div>

              </div>

            </div>
          </div>
        </div>
      )}

      {/* WIZARD DIALOG */}
      {showWizardDialog && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.85)' }}>
          <div style={{ width: '750px', background: '#333', border: '1px solid #65ff00', boxShadow: '0 0 20px rgba(101, 255, 0, 0.2)', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#222', borderBottom: '1px solid #65ff00' }}>
              <span style={{ fontWeight: 'bold', color: '#65ff00', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}><BsStars size={16} /> PROJECT WIZARD</span>
              <button onClick={() => { setShowWizardDialog(false); setShowNewProjectDialog(false); }} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '16px' }}>{'\u2715'}</button>
            </div>
            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '11px', color: '#aaa', marginBottom: '4px' }}>Select how many scenes of each type to create:</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {[
                  { key: 'intro', label: 'Intro/Logo', color: '#607D8B' },
                  { key: 'topdown', label: 'Top Down', color: '#4CAF50' },
                  { key: 'platformer', label: 'Platformer', color: '#2196F3' },
                  { key: 'metroidvania', label: 'Metroidvania', color: '#E91E63' },
                  { key: 'pointnclick', label: 'Point & Click', color: '#FF9800' },
                  { key: 'shmup', label: "Shoot 'Em Up", color: '#9C27B0' },
                  { key: 'racing', label: 'Racing', color: '#F44336' },
                  { key: 'beatemup', label: "Beat 'Em Up", color: '#FF5722' }
                ].map(({ key, label, color }) => (
                  <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', background: '#2a2a2a', borderRadius: '3px' }}>
                    <span style={{ color: '#ccc', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, display: 'inline-block' }}></span>
                      {label}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button
                        onClick={() => setWizardSettings(prev => ({ ...prev, [key]: Math.max(0, prev[key] - 1) }))}
                        style={{ width: '24px', height: '24px', background: '#444', border: '1px solid #555', color: '#fff', borderRadius: '3px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 'bold' }}
                      >{'\u2212'}</button>
                      <span style={{ color: '#fff', fontSize: '14px', fontWeight: 'bold', minWidth: '20px', textAlign: 'center' }}>{wizardSettings[key]}</span>
                      <button
                        onClick={() => setWizardSettings(prev => ({ ...prev, [key]: prev[key] + 1 }))}
                        style={{ width: '24px', height: '24px', background: '#444', border: '1px solid #555', color: '#fff', borderRadius: '3px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 'bold' }}>+</button>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ borderTop: '1px solid #444', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ccc', fontSize: '12px', cursor: 'pointer', padding: '6px 8px', background: '#2a2a2a', borderRadius: '3px' }}>
                  <input
                    type="checkbox"
                    checked={wizardSettings.generateLevels}
                    onChange={(e) => setWizardSettings(prev => ({ ...prev, generateLevels: e.target.checked }))}
                  />
                  <span style={{ fontWeight: 'bold', color: '#65ff00' }}>Generate Level Designs</span>
                  <span style={{ color: '#888', fontSize: '10px', marginLeft: '4px' }}>Auto-generate procedural levels for all scenes</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ccc', fontSize: '12px', cursor: 'pointer', padding: '6px 8px', background: '#2a2a2a', borderRadius: '3px' }}>
                  <input
                    type="checkbox"
                    checked={wizardSettings.randomBg}
                    onChange={(e) => setWizardSettings(prev => ({ ...prev, randomBg: e.target.checked }))}
                  />
                  <span style={{ fontWeight: 'bold', color: '#65ff00' }}>Random Backgrounds</span>
                  <span style={{ color: '#888', fontSize: '10px', marginLeft: '4px' }}>Auto-generate sky, clouds, or starry backgrounds for Platformer & Shoot 'Em Up scenes</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ccc', fontSize: '12px', cursor: 'pointer', padding: '6px 8px', background: '#2a2a2a', borderRadius: '3px' }}>
                  <input
                    type="checkbox"
                    checked={wizardSettings.globalPlayer}
                    onChange={(e) => setWizardSettings(prev => ({ ...prev, globalPlayer: e.target.checked }))}
                  />
                  <span style={{ fontWeight: 'bold', color: '#65ff00' }}>Global Player</span>
                  <span style={{ color: '#888', fontSize: '10px', marginLeft: '4px' }}>Make the default player a global actor shared across all scenes</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ccc', fontSize: '12px', cursor: 'pointer', padding: '6px 8px', background: '#2a2a2a', borderRadius: '3px' }}>
                  <input
                    type="checkbox"
                    checked={wizardSettings.pause}
                    onChange={(e) => setWizardSettings(prev => ({ ...prev, pause: e.target.checked }))}
                  />
                  <span style={{ fontWeight: 'bold', color: '#65ff00' }}>Add Pause Screen</span>
                  <span style={{ color: '#888', fontSize: '10px', marginLeft: '4px' }}>Add a pause screen scene (press Start to pause/resume during gameplay)</span>
                </label>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                <button onClick={() => { setShowWizardDialog(false); setShowNewProjectDialog(true); }} style={{ padding: '10px 20px', background: 'transparent', border: '1px solid #555', color: '#fff', borderRadius: '4px', cursor: 'pointer' }}>Back</button>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <span style={{ color: '#888', fontSize: '11px' }}>
                    {Object.entries(wizardSettings).filter(([k, v]) => ['topdown', 'platformer', 'metroidvania', 'pointnclick', 'shmup', 'racing', 'intro', 'beatemup'].includes(k) && v > 0).reduce((sum, [, v]) => sum + v, 0) + (wizardSettings.pause ? 1 : 0)} scene(s)
                  </span>
                  <button
                    onClick={() => {
                      const total = ['topdown', 'platformer', 'metroidvania', 'pointnclick', 'shmup', 'racing', 'intro', 'beatemup'].reduce((sum, k) => sum + (wizardSettings[k] || 0), 0) + (wizardSettings.pause ? 1 : 0);
                      if (total === 0) { toast.error('Add at least one scene!'); return; }
                      handleWizardCreate();
                    }}
                    style={{ padding: '10px 30px', background: '#65ff00', border: 'none', color: '#000', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                  >Create</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LAYER FX POPUP */}
      {fxLayerId && layers.find(l => l.id === fxLayerId) && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div style={{ background: '#2a2a2a', border: '1px solid #4CAF50', borderRadius: '8px', padding: '15px', width: '560px', maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 10px 30px rgba(0,0,0,0.8)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
              <span style={{ fontWeight: 'bold' }}>Layer FX: {layers.find(l => l.id === fxLayerId).name}</span>
              <button onClick={() => { setFxLayerId(null); saveHistory("Layer FX", layers); }} style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer' }}>✕</button>
            </div>

            {(() => {
              const l = layers.find(l => l.id === fxLayerId);
              return (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '12px' }}>
                  {/* Blending */}
                  <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <label style={{ color: '#888' }}>Opacity & Blend Mode</label>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <input type="range" min="0" max="1" step="0.05" value={l.opacity ?? 1} onChange={e => updateLayerProp(l.id, 'opacity', parseFloat(e.target.value))} style={{ flex: 1 }} />
                      <select value={l.blendMode || 'source-over'} onChange={e => updateLayerProp(l.id, 'blendMode', e.target.value)} style={{ background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', outline: 'none' }}>
                        <option value="source-over">Normal</option>
                        <option value="multiply">Multiply</option>
                        <option value="screen">Screen</option>
                        <option value="overlay">Overlay</option>
                        <option value="darken">Darken</option>
                        <option value="lighten">Lighten</option>
                        <option value="color-dodge">Color Dodge</option>
                        <option value="color-burn">Color Burn</option>
                        <option value="hard-light">Hard Light</option>
                        <option value="soft-light">Soft Light</option>
                        <option value="difference">Difference</option>
                        <option value="exclusion">Exclusion</option>
                      </select>
                    </div>
                  </div>

                  {/* Color Overlay */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', borderTop: '1px solid #444', paddingTop: '10px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={!!l.colorOverlay} onChange={e => updateLayerProp(l.id, 'colorOverlay', e.target.checked)} />
                      <b>Color Overlay</b>
                    </label>
                    {l.colorOverlay && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginLeft: '20px' }}>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                          <PaletteColorPicker
                            selectedColor={l.colorOverlayColor || '#ff0000'}
                            onChange={val => updateLayerProp(l.id, 'colorOverlayColor', val)}
                            recentColors={recentColors || []}
                            label="Color Overlay"
                            allowTransparent={false}
                          />
                          <span>Color</span>
                        </div>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                          <span style={{ width: '50px' }}>Opacity</span>
                          <input type="range" min="0" max="1" step="0.05" value={l.colorOverlayOpacity ?? 1} onChange={e => updateLayerProp(l.id, 'colorOverlayOpacity', parseFloat(e.target.value))} style={{ flex: 1 }} />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Gradient Overlay */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', borderTop: '1px solid #444', paddingTop: '10px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={!!l.gradientOverlay} onChange={e => updateLayerProp(l.id, 'gradientOverlay', e.target.checked)} />
                      <b>Gradient Overlay</b>
                    </label>
                    {l.gradientOverlay && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginLeft: '20px' }}>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                          <PaletteColorPicker
                            selectedColor={l.gradientOverlayColor1 || '#fff1e8'}
                            onChange={val => updateLayerProp(l.id, 'gradientOverlayColor1', val)}
                            recentColors={recentColors || []}
                            label="Gradient Top Color"
                            allowTransparent={false}
                          />
                          <span>Top Color</span>
                        </div>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                          <PaletteColorPicker
                            selectedColor={l.gradientOverlayColor2 || '#000000'}
                            onChange={val => updateLayerProp(l.id, 'gradientOverlayColor2', val)}
                            recentColors={recentColors || []}
                            label="Gradient Bottom Color"
                            allowTransparent={false}
                          />
                          <span>Bottom Color</span>
                        </div>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                          <span style={{ width: '50px' }}>Opacity</span>
                          <input type="range" min="0" max="1" step="0.05" value={l.gradientOverlayOpacity ?? 1} onChange={e => updateLayerProp(l.id, 'gradientOverlayOpacity', parseFloat(e.target.value))} style={{ flex: 1 }} />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Clipping Mask */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', borderTop: '1px solid #444', paddingTop: '10px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={!!l.clipping} onChange={e => updateLayerProp(l.id, 'clipping', e.target.checked)} />
                      <b>Clipping Mask (Clip to layer below)</b>
                    </label>
                  </div>

                  {/* Outline */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', borderTop: '1px solid #444', paddingTop: '10px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={!!l.outline} onChange={e => updateLayerProp(l.id, 'outline', e.target.checked)} />
                      <b>Stroke / Outline</b>
                    </label>
                    {l.outline && (
                      <>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginLeft: '20px' }}>
                          <PaletteColorPicker
                            selectedColor={l.outlineColor || '#fff1e8'}
                            onChange={val => updateLayerProp(l.id, 'outlineColor', val)}
                            recentColors={recentColors || []}
                            label="Stroke Color"
                            allowTransparent={false}
                          />
                          <span>Color</span>
                        </div>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginLeft: '20px', marginTop: '5px' }}>
                          <span style={{ width: '40px' }}>Width</span>
                          <input type="range" min="1" max="20" value={l.outlineWidth ?? 1} onChange={e => updateLayerProp(l.id, 'outlineWidth', parseInt(e.target.value))} style={{ flex: 1 }} />
                          <span style={{ width: '20px', textAlign: 'right' }}>{l.outlineWidth ?? 1}</span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Drop Shadow */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', borderTop: '1px solid #444', paddingTop: '10px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={!!l.dropShadow} onChange={e => updateLayerProp(l.id, 'dropShadow', e.target.checked)} />
                      <b>Drop Shadow</b>
                    </label>
                    {l.dropShadow && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginLeft: '20px' }}>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                          <PaletteColorPicker
                            selectedColor={l.shadowColor || '#000000'}
                            onChange={val => updateLayerProp(l.id, 'shadowColor', val)}
                            recentColors={recentColors || []}
                            label="Shadow Color"
                            allowTransparent={false}
                          />
                          <span>Shadow Color</span>
                        </div>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                          <span style={{ width: '40px' }}>X Offset</span>
                          <input type="range" min="-10" max="10" value={l.shadowOffsetX ?? 1} onChange={e => updateLayerProp(l.id, 'shadowOffsetX', parseInt(e.target.value))} style={{ flex: 1 }} />
                          <span style={{ width: '20px', textAlign: 'right' }}>{l.shadowOffsetX ?? 1}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                          <span style={{ width: '40px' }}>Y Offset</span>
                          <input type="range" min="-10" max="10" value={l.shadowOffsetY ?? 1} onChange={e => updateLayerProp(l.id, 'shadowOffsetY', parseInt(e.target.value))} style={{ flex: 1 }} />
                          <span style={{ width: '20px', textAlign: 'right' }}>{l.shadowOffsetY ?? 1}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Blur */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', borderTop: '1px solid #444', paddingTop: '10px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={!!l.blur} onChange={e => updateLayerProp(l.id, 'blur', e.target.checked)} />
                      <b>Blur</b>
                    </label>
                    {l.blur && (
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginLeft: '20px' }}>
                        <span style={{ width: '40px' }}>Amount</span>
                        <input type="range" min="1" max="20" value={l.blurAmount ?? 1} onChange={e => updateLayerProp(l.id, 'blurAmount', parseInt(e.target.value))} style={{ flex: 1 }} />
                        <span style={{ width: '20px', textAlign: 'right' }}>{l.blurAmount ?? 1}</span>
                      </div>
                    )}
                  </div>

                  {/* Pixelate */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', borderTop: '1px solid #444', paddingTop: '10px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={!!l.pixelate} onChange={e => updateLayerProp(l.id, 'pixelate', e.target.checked)} />
                      <b>Pixelate (Mosaic)</b>
                    </label>
                    {l.pixelate && (
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginLeft: '20px' }}>
                        <span style={{ width: '40px' }}>Size</span>
                        <input type="range" min="2" max="32" value={l.pixelateSize ?? 2} onChange={e => updateLayerProp(l.id, 'pixelateSize', parseInt(e.target.value))} style={{ flex: 1 }} />
                        <span style={{ width: '20px', textAlign: 'right' }}>{l.pixelateSize ?? 2}</span>
                      </div>
                    )}
                  </div>

                  {/* Distort */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', borderTop: '1px solid #444', paddingTop: '10px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={!!l.distort} onChange={e => updateLayerProp(l.id, 'distort', e.target.checked)} />
                      <b>Distort (Wave)</b>
                    </label>
                    {l.distort && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginLeft: '20px' }}>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                          <span style={{ width: '50px' }}>Amount</span>
                          <input type="range" min="1" max="50" value={l.distortAmount ?? 5} onChange={e => updateLayerProp(l.id, 'distortAmount', parseInt(e.target.value))} style={{ flex: 1 }} />
                          <span style={{ width: '20px', textAlign: 'right' }}>{l.distortAmount ?? 5}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                          <span style={{ width: '50px' }}>Scale</span>
                          <input type="range" min="1" max="50" value={l.distortScale ?? 10} onChange={e => updateLayerProp(l.id, 'distortScale', parseInt(e.target.value))} style={{ flex: 1 }} />
                          <span style={{ width: '20px', textAlign: 'right' }}>{l.distortScale ?? 10}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Parallax */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', borderTop: '1px solid #444', paddingTop: '10px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={!!l.parallax} onChange={e => updateLayerProp(l.id, 'parallax', e.target.checked)} />
                      <b>Parallax Scrolling</b>
                    </label>
                    {l.parallax && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginLeft: '20px' }}>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                          <span style={{ width: '60px' }}>X Multiplier</span>
                          <input type="range" min="0" max="2" step="0.1" value={l.parallaxX ?? 1} onChange={e => updateLayerProp(l.id, 'parallaxX', parseFloat(e.target.value))} style={{ flex: 1 }} />
                          <span style={{ width: '20px', textAlign: 'right' }}>{l.parallaxX ?? 1}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                          <span style={{ width: '60px' }}>Y Multiplier</span>
                          <input type="range" min="0" max="2" step="0.1" value={l.parallaxY ?? 1} onChange={e => updateLayerProp(l.id, 'parallaxY', parseFloat(e.target.value))} style={{ flex: 1 }} />
                          <span style={{ width: '20px', textAlign: 'right' }}>{l.parallaxY ?? 1}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Affine Transform */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', borderTop: '1px solid #444', paddingTop: '10px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={!!l.affine} onChange={e => updateLayerProp(l.id, 'affine', e.target.checked)} />
                      <b>Affine Transform (Scale/Rotate)</b>
                    </label>
                    {l.affine && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginLeft: '20px' }}>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                          <span style={{ width: '60px' }}>Scale X</span>
                          <input type="range" min="0.1" max="5" step="0.1" value={l.scaleX ?? 1} onChange={e => updateLayerProp(l.id, 'scaleX', parseFloat(e.target.value))} style={{ flex: 1 }} />
                          <span style={{ width: '20px', textAlign: 'right' }}>{l.scaleX ?? 1}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                          <span style={{ width: '60px' }}>Scale Y</span>
                          <input type="range" min="0.1" max="5" step="0.1" value={l.scaleY ?? 1} onChange={e => updateLayerProp(l.id, 'scaleY', parseFloat(e.target.value))} style={{ flex: 1 }} />
                          <span style={{ width: '20px', textAlign: 'right' }}>{l.scaleY ?? 1}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                          <span style={{ width: '60px' }}>Rotation</span>
                          <input type="range" min="0" max="360" value={l.rotation ?? 0} onChange={e => updateLayerProp(l.id, 'rotation', parseInt(e.target.value))} style={{ flex: 1 }} />
                          <span style={{ width: '20px', textAlign: 'right' }}>{l.rotation ?? 0}°</span>
                        </div>
                        <div style={{ borderTop: '1px solid #555', paddingTop: '8px', marginTop: '4px' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px' }}>
                            <input type="checkbox" checked={!!l.mode7} onChange={e => {
                              const val = e.target.checked;
                              updateLayerProp(l.id, 'mode7', val);
                              if (val) updateLayerProp(l.id, 'affine', true);
                            }} />
                            <span style={{ color: '#ff8800' }}>Mode 7 Road Texture</span>
                          </label>
                        </div>
                      </div>
                    )}
                  </div>

                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ADJUST SELECTION DIALOG */}
      {showAdjustSelectionDialog && (
        <div style={{
          position: 'absolute',
          top: '70px',
          left: '60px',
          zIndex: 100,
          width: '250px',
          background: '#2a2a2a',
          border: '1px solid #4CAF50',
          borderRadius: '8px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.8)',
          padding: '15px'
        }}>
          <div style={{ fontSize: '10px', marginBottom: '15px', color: '#888', display: 'flex', justifyContent: 'space-between' }}>
            <span>ADJUST SELECTION</span>
            <button onClick={() => closeAdjustSelectionDialog(false)} style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer' }}>✕</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <span>Amount (px)</span>
                <span>{adjustSelectionAmount > 0 ? '+' : ''}{adjustSelectionAmount}</span>
              </div>
              <input type="range" min="-20" max="20" value={adjustSelectionAmount} onChange={(e) => updateAdjustedSelection(parseInt(e.target.value))} />
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <button onClick={() => closeAdjustSelectionDialog(false)} style={{ flex: 1, padding: '8px', background: 'transparent', border: '1px solid #555', color: '#fff', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => closeAdjustSelectionDialog(true)} style={{ flex: 1, padding: '8px', background: '#4CAF50', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer' }}>OK</button>
            </div>
          </div>
        </div>
      )}

      {/* RESIZE CANVAS DIALOG */}
      {showResizeCanvasDialog && (
        <div style={{
          position: 'absolute',
          top: '70px',
          right: '280px',
          zIndex: 100,
          width: '300px',
          background: '#2a2a2a',
          border: '1px solid #4CAF50',
          borderRadius: '8px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.8)',
          padding: '15px'
        }}>
          <div style={{ fontSize: '10px', marginBottom: '15px', color: '#888', display: 'flex', justifyContent: 'space-between' }}>
            <span>RESIZE CANVAS</span>
            <button onClick={() => handleResizeCanvas(false)} style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer' }}>✕</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div style={{ display: 'flex', gap: '10px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', flexGrow: 1, maxWidth: '48%' }}>
                <span style={{ fontSize: '12px' }}>Width (tiles)</span>
                <select value={Math.round(resizeCanvasSettings.w / 8)} onChange={(e) => setResizeCanvasSettings(prev => ({ ...prev, w: Math.max(1, parseInt(e.target.value) || 1) * 8 }))} style={{ background: '#111', color: '#fff', border: '1px solid #444', padding: '6px', borderRadius: '4px', outline: 'none', cursor: 'pointer' }}>
                  {[32, 64, 96, 128, 160, 192, 224, 256].map(t => <option key={t} value={t}>{t}</option>)}
                  {!([32, 64, 96, 128, 160, 192, 224, 256].includes(Math.round(resizeCanvasSettings.w / 8))) && <option value={Math.round(resizeCanvasSettings.w / 8)}>{Math.round(resizeCanvasSettings.w / 8)}</option>}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', flexGrow: 1, maxWidth: '48%' }}>
                <span style={{ fontSize: '12px' }}>Height (tiles)</span>
                <select value={Math.round(resizeCanvasSettings.h / 8)} onChange={(e) => setResizeCanvasSettings(prev => ({ ...prev, h: Math.max(1, parseInt(e.target.value) || 1) * 8 }))} style={{ background: '#111', color: '#fff', border: '1px solid #444', padding: '6px', borderRadius: '4px', outline: 'none', cursor: 'pointer' }}>
                  {[32, 64, 96, 128, 160, 192, 224, 256].map(t => <option key={t} value={t}>{t}</option>)}
                  {!([32, 64, 96, 128, 160, 192, 224, 256].includes(Math.round(resizeCanvasSettings.h / 8))) && <option value={Math.round(resizeCanvasSettings.h / 8)}>{Math.round(resizeCanvasSettings.h / 8)}</option>}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <span style={{ fontSize: '12px' }}>Anchor</span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px', width: '120px', margin: '0 auto' }}>
                {['top-left', 'top-center', 'top-right', 'center-left', 'center', 'center-right', 'bottom-left', 'bottom-center', 'bottom-right'].map(anchor => (
                  <button key={anchor} onClick={() => setResizeCanvasSettings(prev => ({ ...prev, anchor }))} style={{ width: '30px', height: '30px', background: resizeCanvasSettings.anchor === anchor ? '#4CAF50' : '#111', border: '1px solid #444', cursor: 'pointer', borderRadius: '3px' }} title={anchor.replace('-', ' ')} />
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <button onClick={() => handleResizeCanvas(false)} style={{ flex: 1, padding: '8px', background: 'transparent', border: '1px solid #555', color: '#fff', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => handleResizeCanvas(true)} style={{ flex: 1, padding: '8px', background: '#4CAF50', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer' }}>OK</button>
            </div>
          </div>
        </div>
      )}

      {/* HUE/SATURATION DIALOG */}
      {showHSLDialog && (
        <div style={{
          position: 'absolute',
          top: '70px',
          right: '280px',
          zIndex: 100,
          width: '300px',
          background: '#2a2a2a',
          border: '1px solid #4CAF50',
          borderRadius: '8px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.8)',
          padding: '15px'
        }}>
          <div style={{ fontSize: '10px', marginBottom: '15px', color: '#888', display: 'flex', justifyContent: 'space-between' }}>
            <span>HUE / SATURATION</span>
            <button onClick={() => closeHSLDialog(false)} style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer' }}>✕</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <span>Hue</span>
                <span>{hslSettings.h}</span>
              </div>
              <input type="range" min="-180" max="180" value={hslSettings.h} onChange={(e) => setHslSettings(prev => ({ ...prev, h: parseInt(e.target.value) }))} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <span>Saturation</span>
                <span>{hslSettings.s}</span>
              </div>
              <input type="range" min="-100" max="100" value={hslSettings.s} onChange={(e) => setHslSettings(prev => ({ ...prev, s: parseInt(e.target.value) }))} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <span>Lightness</span>
                <span>{hslSettings.l}</span>
              </div>
              <input type="range" min="-100" max="100" value={hslSettings.l} onChange={(e) => setHslSettings(prev => ({ ...prev, l: parseInt(e.target.value) }))} />
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <button onClick={() => closeHSLDialog(false)} style={{ flex: 1, padding: '8px', background: 'transparent', border: '1px solid #555', color: '#fff', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => closeHSLDialog(true)} style={{ flex: 1, padding: '8px', background: '#4CAF50', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer' }}>OK</button>
            </div>
          </div>
        </div>
      )}

      {/* BRIGHTNESS/CONTRAST DIALOG */}
      {showBCDialog && (
        <div style={{
          position: 'absolute',
          top: '70px',
          right: '280px',
          zIndex: 100,
          width: '300px',
          background: '#2a2a2a',
          border: '1px solid #4CAF50',
          borderRadius: '8px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.8)',
          padding: '15px'
        }}>
          <div style={{ fontSize: '10px', marginBottom: '15px', color: '#888', display: 'flex', justifyContent: 'space-between' }}>
            <span>BRIGHTNESS / CONTRAST</span>
            <button onClick={() => closeBCDialog(false)} style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer' }}>✕</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}><span>Brightness</span><span>{bcSettings.b}</span></div>
              <input type="range" min="-100" max="100" value={bcSettings.b} onChange={(e) => setBcSettings(prev => ({ ...prev, b: parseInt(e.target.value) }))} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}><span>Contrast</span><span>{bcSettings.c}</span></div>
              <input type="range" min="-100" max="100" value={bcSettings.c} onChange={(e) => setBcSettings(prev => ({ ...prev, c: parseInt(e.target.value) }))} />
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <button onClick={() => closeBCDialog(false)} style={{ flex: 1, padding: '8px', background: 'transparent', border: '1px solid #555', color: '#fff', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => closeBCDialog(true)} style={{ flex: 1, padding: '8px', background: '#4CAF50', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer' }}>OK</button>
            </div>
          </div>
        </div>
      )}

      {/* MAGIC BG DIALOG */}
      {showMagicBgDialog && (
        <div style={{
          position: 'absolute',
          top: '70px',
          right: '280px',
          zIndex: 100,
          width: '320px',
          background: '#2a2a2a',
          border: '1px solid #4CAF50',
          borderRadius: '8px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.8)',
          padding: '15px'
        }}>
          <div style={{ fontSize: '10px', marginBottom: '15px', color: '#888', display: 'flex', justifyContent: 'space-between' }}>
            <span>MAGIC BACKGROUND REMOVAL</span>
            <button onClick={() => closeMagicBgDialog(false)} style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer' }}>✕</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}><span>Tolerance</span><span>{magicBgSettings.tolerance || 0}</span></div>
              <input type="range" min="0" max="255" value={magicBgSettings.tolerance || 0} onChange={(e) => setMagicBgSettings(prev => ({ ...prev, tolerance: parseInt(e.target.value) }))} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}><span>Fuzziness (Soft Edge)</span><span>{magicBgSettings.fuzziness || 0}</span></div>
              <input type="range" min="0" max="255" value={magicBgSettings.fuzziness || 0} onChange={(e) => setMagicBgSettings(prev => ({ ...prev, fuzziness: parseInt(e.target.value) }))} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '5px' }}>
              <input type="checkbox" id="contiguous-cb" checked={magicBgSettings.contiguous ?? true} onChange={(e) => setMagicBgSettings(prev => ({ ...prev, contiguous: e.target.checked }))} />
              <label htmlFor="contiguous-cb" style={{ fontSize: '12px', cursor: 'pointer' }}>Contiguous (Connected pixels only)</label>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '5px' }}>
              <button onClick={() => closeMagicBgDialog(false)} style={{ flex: 1, padding: '8px', background: 'transparent', border: '1px solid #555', color: '#fff', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => closeMagicBgDialog(true)} style={{ flex: 1, padding: '8px', background: '#4CAF50', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer' }}>OK</button>
            </div>
          </div>
        </div>
      )}

      {showImportPaletteDialog && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.7)' }}>
          <div style={{ background: '#2a2a2a', border: '1px solid #4CAF50', borderRadius: '8px', boxShadow: '0 10px 30px rgba(0,0,0,0.8)', padding: '20px', width: '380px' }}>
            <div style={{ fontSize: '14px', marginBottom: '15px', color: '#fff', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>IMPORT PALETTE</span>
              <button onClick={() => setShowImportPaletteDialog(false)} style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', fontSize: '16px' }}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div style={{ fontSize: '13px', color: '#ccc', lineHeight: '1.4' }}>
                Found <strong style={{ color: '#4CAF50' }}>{pendingImportColors.length}</strong> colors in <span style={{ color: '#aaa', fontStyle: 'italic' }}>{paletteImportFileName}</span>.
              </div>

              {/* Color preview grid (limited height, scrollable) */}
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '4px',
                maxHeight: '120px',
                overflowY: 'auto',
                background: '#1a1a1a',
                padding: '8px',
                borderRadius: '4px',
                border: '1px solid #333'
              }}>
                {pendingImportColors.map((color, idx) => (
                  <div
                    key={color + '-' + idx}
                    style={{
                      width: '16px',
                      height: '16px',
                      backgroundColor: color,
                      borderRadius: '2px',
                      border: '1px solid #000'
                    }}
                    title={color}
                  />
                ))}
              </div>

              <div style={{ fontSize: '12px', color: '#888' }}>
                Choose how you want to apply these colors to your current palette:
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '5px' }}>
                <button
                  onClick={() => confirmPaletteImport('overwrite')}
                  style={{
                    padding: '10px',
                    background: '#4CAF50',
                    border: 'none',
                    color: '#fff',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#43a047'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#4CAF50'}
                >
                  Replace Current Palette
                </button>

                <button
                  onClick={() => confirmPaletteImport('append')}
                  style={{
                    padding: '10px',
                    background: '#333',
                    border: '1px solid #444',
                    color: '#fff',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#444'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#333'}
                >
                  Append to Current Palette
                </button>

                <button
                  onClick={() => setShowImportPaletteDialog(false)}
                  style={{
                    padding: '8px',
                    background: 'transparent',
                    border: 'none',
                    color: '#888',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#fff'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#888'}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PALETTE CONVERT DIALOG */}
      {showPaletteConvertDialog && pendingConvertData && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.7)' }}>
          <div style={{ background: '#2a2a2a', border: '1px solid #4CAF50', borderRadius: '8px', boxShadow: '0 10px 30px rgba(0,0,0,0.8)', padding: '20px', width: '380px' }}>
            <div style={{ fontSize: '14px', marginBottom: '15px', color: '#fff', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>IMPORT IMAGE</span>
              <button onClick={() => { setShowPaletteConvertDialog(false); setPendingConvertData(null); }} style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', fontSize: '16px' }}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div style={{ fontSize: '13px', color: '#ccc', lineHeight: '1.4' }}>
                Image: <strong style={{ color: '#fff' }}>{pendingConvertData.sourceWidth || pendingConvertData.w}×{pendingConvertData.sourceHeight || pendingConvertData.h}</strong> pixels
              </div>

              {/* Row 1: Quick actions — Palette or Tiles */}
              <div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    onClick={() => confirmPaletteConvert(false, false, 'palette')}
                    style={{
                      flex: 1, padding: '8px', border: 'none', borderRadius: '4px', cursor: 'pointer',
                      fontSize: '12px', fontWeight: 'bold',
                      background: '#7c3aed',
                      color: '#fff'
                    }}
                  >
                    As Palette
                  </button>
                  <button
                    onClick={() => confirmPaletteConvert(false, false, 'tiles')}
                    style={{
                      flex: 1, padding: '8px', border: 'none', borderRadius: '4px', cursor: 'pointer',
                      fontSize: '12px', fontWeight: 'bold',
                      background: '#e67e22',
                      color: '#fff'
                    }}
                  >
                    As Tiles
                  </button>
                </div>
              </div>

              {/* Row 2: Where to import */}
              <div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    onClick={() => setImportMode('scene')}
                    style={{
                      flex: 1, padding: '8px', border: 'none', borderRadius: '4px', cursor: 'pointer',
                      fontSize: '12px', fontWeight: 'bold',
                      background: importMode === 'scene' ? '#4CAF50' : '#444',
                      color: '#fff'
                    }}
                  >
                    New Scene
                  </button>
                  <button
                    onClick={() => setImportMode('layer')}
                    style={{
                      flex: 1, padding: '8px', border: 'none', borderRadius: '4px', cursor: 'pointer',
                      fontSize: '12px', fontWeight: 'bold',
                      background: importMode === 'layer' ? '#0078d4' : '#444',
                      color: '#fff'
                    }}
                  >
                    New Layer
                  </button>
                </div>
              </div>

              {/* Options for New Scene / New Layer */}
              {(importMode === 'scene' || importMode === 'layer') && (
                <>
                  <div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        onClick={() => setFitToScene(false)}
                        style={{
                          flex: 1, padding: '8px', border: 'none', borderRadius: '4px', cursor: 'pointer',
                          fontSize: '12px', fontWeight: 'bold',
                          background: !fitToScene ? (importMode === 'scene' ? '#4CAF50' : '#0078d4') : '#444',
                          color: '#fff'
                        }}
                      >
                        Original Size
                      </button>
                      <button
                        onClick={() => setFitToScene(true)}
                        style={{
                          flex: 1, padding: '8px', border: 'none', borderRadius: '4px', cursor: 'pointer',
                          fontSize: '12px', fontWeight: 'bold',
                          background: fitToScene ? (importMode === 'scene' ? '#4CAF50' : '#0078d4') : '#444',
                          color: '#fff'
                        }}
                      >
                        Fit to Scene
                      </button>
                    </div>
                  </div>

                  <div style={{ fontSize: '13px', color: '#ccc', lineHeight: '1.4' }}>
                    Convert colors to match the current palette? This will posterize the image and replace each color with the closest palette match.
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '5px' }}>
                    <button
                      onClick={() => confirmPaletteConvert(true, fitToScene, importMode)}
                      style={{
                        padding: '10px',
                        background: importMode === 'scene' ? '#4CAF50' : '#0078d4',
                        border: 'none',
                        color: '#fff',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: 'bold'
                      }}
                    >
                      Convert Colors
                    </button>
                    <button
                      onClick={() => confirmPaletteConvert(false, fitToScene, importMode)}
                      style={{
                        padding: '10px',
                        background: '#555',
                        border: 'none',
                        color: '#fff',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: 'bold'
                      }}
                    >
                      Keep Original Colors
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* GAME ASSET EXPORT DIALOG */}
      {showExportDialog && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 10000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(10, 10, 10, 0.75)',
          backdropFilter: 'blur(6px)',
          transition: 'all 0.3s ease'
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #2c2c2c 0%, #1e1e1e 100%)',
            border: '1px solid #4CAF50',
            borderRadius: '12px',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
            padding: '25px',
            width: '50%',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            color: '#fff',
            fontFamily: "'Outfit', 'Inter', sans-serif"
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1px solid #3c3c3c',
              paddingBottom: '12px'
            }}>
              <span style={{ fontWeight: 'bold', fontSize: '15px', color: '#4CAF50', letterSpacing: '0.5px' }}>EXPORT</span>
              <button
                onClick={() => !isPublishingRom && setShowExportDialog(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#aaa',
                  cursor: 'pointer',
                  fontSize: '18px',
                  transition: 'color 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#ffffff'}
                onMouseLeave={(e) => e.currentTarget.style.color = '#aaa'}
              >✕</button>
            </div>

            {isPublishingRom ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '15px', padding: '40px 0', color: '#ccc' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  border: '3px solid #333',
                  borderTop: '3px solid #4CAF50',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }} />
                <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
                <span>Publishing ROM... Please wait.</span>
                <span style={{ fontSize: '11px', color: '#888' }}>This may take a bit</span>
              </div>
            ) : (
              <>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  gap: '15px',
                  alignItems: 'start'
                }}>
                  {/* Column 1 — Butano, ROM */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <button
                      onClick={() => {
                        if (validateScenesLayers()) {
                          exportGameAssets(exportLevelName, exportFormat, exportLevelType);
                          setShowExportDialog(false);
                        }
                      }}
                      style={{
                        width: '100%',
                        padding: '15px',
                        background: '#333',
                        border: '1px solid #4CAF50',
                        color: '#fff',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: 'bold',
                        boxShadow: '0 4px 10px rgba(0, 0, 0, 0.3)',
                        transition: 'all 0.2s',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '5px',
                        alignItems: 'center'
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#444'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#333'; }}
                    >
                      <span>Export Butano Project</span>
                      <span style={{ fontSize: '11px', color: '#aaa', fontWeight: 'normal' }}>Download C++ Source Code & Assets</span>
                    </button>

                    <button
                      onClick={() => {
                        if (validateScenesLayers()) {
                          publishRom();
                          setShowExportDialog(false);
                        }
                      }}
                      style={{
                        width: '100%',
                        padding: '15px',
                        background: '#525de3',
                        border: 'none',
                        color: '#fff',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: 'bold',
                        boxShadow: 'rgb(36 35 101 / 30%) 0px 4px 10px',
                        transition: 'all 0.2s',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '5px',
                        alignItems: 'center'
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#45a049'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#4CAF50'; }}
                    >
                      <span>Publish ROM</span>
                      <span style={{ fontSize: '11px', color: '#ddd', fontWeight: 'normal' }}>Compile & Download .GBA File</span>
                    </button>
                  </div>

                  {/* Column 2 — EXE, HTML5 */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <button
                      onClick={() => {
                        if (validateScenesLayers()) {
                          exportExe();
                          setShowExportDialog(false);
                        }
                      }}
                      style={{
                        width: '100%',
                        padding: '15px',
                        background: '#e64a19',
                        border: 'none',
                        color: '#fff',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: 'bold',
                        boxShadow: 'rgba(100, 30, 10, 0.3) 0px 4px 10px',
                        transition: 'all 0.2s',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '5px',
                        alignItems: 'center'
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#d84315'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#e64a19'; }}
                    >
                      <span>Export Windows EXE</span>
                      <span style={{ fontSize: '11px', color: '#ddd', fontWeight: 'normal' }}>Compile & Download Windows Executable</span>
                    </button>

                    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <button
                        onClick={() => setShowHtml5ExportDialog(!showHtml5ExportDialog)}
                        style={{
                          width: '100%',
                          padding: '15px',
                          background: '#7c3aed',
                          border: showHtml5ExportDialog ? '2px solid #9d7aef' : 'none',
                          color: '#fff',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '14px',
                          fontWeight: 'bold',
                          boxShadow: 'rgb(36 35 101 / 30%) 0px 4px 10px',
                          transition: 'all 0.2s',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '5px',
                          alignItems: 'center'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#6d28d9'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#7c3aed'; }}
                      >
                        <span>Export HTML5</span>
                        <span style={{ fontSize: '11px', color: '#ddd', fontWeight: 'normal' }}>Compile & Download Standalone HTML</span>
                      </button>
                    </div>
                  </div>

                  {/* Column 3 — PNG exports */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <button
                      onClick={() => { exportPNG(); setShowExportDialog(false); }}
                      style={{
                        width: '100%',
                        padding: '15px',
                        background: '#0891b2',
                        border: 'none',
                        color: '#fff',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: 'bold',
                        boxShadow: 'rgba(8, 145, 178, 0.3) 0px 4px 10px',
                        transition: 'all 0.2s',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '5px',
                        alignItems: 'center'
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#0e7490'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#0891b2'; }}
                    >
                      <span>Export Scene as PNG</span>
                      <span style={{ fontSize: '11px', color: '#bae6fd', fontWeight: 'normal' }}>Download current frame as PNG image</span>
                    </button>

                    <button
                      onClick={() => { exportAllLayersZipped(); setShowExportDialog(false); }}
                      style={{
                        width: '100%',
                        padding: '15px',
                        background: '#0d9488',
                        border: 'none',
                        color: '#fff',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: 'bold',
                        boxShadow: 'rgba(13, 148, 136, 0.3) 0px 4px 10px',
                        transition: 'all 0.2s',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '5px',
                        alignItems: 'center'
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#0f766e'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#0d9488'; }}
                    >
                      <span>All Scenes as PNGs</span>
                      <span style={{ fontSize: '11px', color: '#99f6e4', fontWeight: 'normal' }}>Download all frames as individual PNGs in ZIP</span>
                    </button>
                  </div>
                </div>

                {showHtml5ExportDialog && (
                  <div style={{
                    background: '#2d295c',
                    border: '1px solid #5c55a5',
                    borderRadius: '6px',
                    padding: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ color: '#ddd', fontSize: '13px', fontWeight: 'bold' }}>Page Background</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: '#aaa', fontSize: '12px', fontFamily: 'monospace' }}>{html5BgColor}</span>
                        <input
                          type="color"
                          value={html5BgColor}
                          onChange={(e) => setHtml5BgColor(e.target.value)}
                          style={{ width: '40px', height: '32px', border: '1px solid #555', borderRadius: '4px', padding: '2px', cursor: 'pointer', background: 'none' }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ color: '#ddd', fontSize: '13px', fontWeight: 'bold' }}>Player Background</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: '#aaa', fontSize: '12px', fontFamily: 'monospace' }}>{html5ContainerColor}</span>
                        <input
                          type="color"
                          value={html5ContainerColor}
                          onChange={(e) => setHtml5ContainerColor(e.target.value)}
                          style={{ width: '40px', height: '32px', border: '1px solid #555', borderRadius: '4px', padding: '2px', cursor: 'pointer', background: 'none' }}
                        />
                      </div>
                    </div>

                    <div style={{ fontSize: '11px', color: '#aaa', fontStyle: 'italic', textAlign: 'center' }}>
                      The exported HTML file is self-contained and works offline.
                    </div>

                    <button
                      onClick={() => {
                        if (validateScenesLayers()) {
                          exportHtml5();
                          setShowExportDialog(false);
                        }
                      }}
                      style={{
                        padding: '10px',
                        background: '#7c3aed',
                        border: 'none',
                        color: '#fff',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: 'bold',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#6d28d9'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#7c3aed'; }}
                    >
                      Export
                    </button>
                  </div>
                )}

                <div style={{
                  marginTop: '14px',
                  borderTop: '1px solid #3c3c3c',
                  paddingTop: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}>
                  <div style={{
                    background: includeCreditsScene ? 'rgba(76,175,80,0.08)' : 'transparent',
                    borderRadius: '6px',
                    border: '1px solid ' + (includeCreditsScene ? '#4CAF50' : '#444'),
                    transition: 'all 0.2s',
                    overflow: 'hidden', display: 'flex', alignItems:"flex-start" }}>
                    <label style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      color: '#ccc',
                      padding: '8px 12px'
                    }}>
                      <input
                        type="checkbox"
                        checked={includeCreditsScene}
                        onChange={(e) => setIncludeCreditsScene(e.target.checked)}
                        style={{ accentColor: '#4CAF50' }}
                      />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0px', textAlign:'left' }}>
                        <span style={{ fontWeight: 'bold' }}>Include Credits Screen</span>
                        <span style={{ fontSize: '11px', color: '#888' }}>Shows credits at game start for tools and assets</span>
                        {includeCreditsScene && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '10px' }}>
                              <span style={{ marginTop: '5px', fontSize: '10px', lineHeight:1.2, color: '#aaa', textTransform: 'uppercase', fontWeight: 'bold', textAlign:'left' }}>Background Music:</span>
                              <select
                                value={creditsMusicId || ''}
                                onChange={e => setCreditsMusicId(e.target.value ? Number(e.target.value) : null)}
                                style={{ width: '100%', background: '#111', color: '#fff', border: '1px solid #444', borderRadius: '4px', padding: '6px', fontSize: '11px', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                              >
                                <option value="">[No Music]</option>
                                {musicTracks && musicTracks.filter(mt => mt.type !== 'group').map(mt => (
                                  <option key={mt.id} value={mt.id}>{mt.name}</option>
                                ))}
                              </select>
                            </div>
                        )}
                      </div>
                    </label>
                    {includeCreditsScene && (
                      <div style={{ padding: '0 12px 10px 12px', flexGrow: 1 }}>
                        <div style={{ display: 'flex', gap: '16px' }}>
                          {/* Colors */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, width: 210, maxWidth: 210 }}>
                            {/* Background Color */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', textAlign:'left',marginTop: '5px' }}>
                              <span style={{ fontSize: '10px', color: '#aaa', textTransform: 'uppercase', fontWeight: 'bold' }}>Background Color{!creditsBgColor && ' (darkest)'}</span>
                              <PaletteColorPicker
                                selectedColor={creditsBgColor}
                                onChange={(c) => setCreditsBgColor(c === creditsBgColor ? null : c)}
                                recentColors={recentColors}
                                label="Credits Background Color"
                                allowTransparent={true}
                              />
                            </div>
                            {/* Text Color */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', textAlign:'left' }}>
                              <span style={{ fontSize: '10px', color: '#aaa', textTransform: 'uppercase', fontWeight: 'bold' }}>Text Color{!creditsTextColor && ' (lightest)'}</span>
                              <PaletteColorPicker
                                selectedColor={creditsTextColor}
                                onChange={(c) => setCreditsTextColor(c === creditsTextColor ? null : c)}
                                recentColors={recentColors}
                                label="Credits Text Color"
                                allowTransparent={true}
                              />
                            </div>
                          </div>
                          {/* Custom credits */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: 0, flexGrow: 1 }}>
                            
                            {includedArtists.length > 0 && (
                              <div style={{ fontSize: '11px', color: '#888', display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: '8px', marginTop: '5px', textAlign:'left' }}>
                                <span style={{ marginTop: '5px', fontSize: '10px', lineHeight:1.2, color: '#aaa', textTransform: 'uppercase', fontWeight: 'bold', textAlign:'left' }}>OpenGameArt / ModArchive Artists to Credit:</span>
                                <div style={{ display: 'flex', flexDirection: 'row', gap: '4px', marginTop: '4px' }}>
                                  {includedArtists.map((artist, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                      {artist.source === 'modarchive'
                                        ? <BsMusicNoteBeamed size={11} style={{ color: '#ed3ae4ff', flexShrink: 0 }} />
                                        : <BsBrush size={11} style={{ color: '#1db8dfff', flexShrink: 0 }} />}
                                      <span style={{color:'white'}}>{artist.name}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            <span style={{ marginTop: '5px', fontSize: '10px', lineHeight:1.2, color: '#aaa', textTransform: 'uppercase', fontWeight: 'bold', textAlign:'left' }}>CUSTOM CREDITS / SHOUT OUTS &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;(optional, comma-separated):</span>
                            <input
                              type="text"
                              value={creditsText}
                              onChange={e => setCreditsText(e.target.value)}
                              placeholder="e.g. Design by John, Music by Jane"
                              style={{ background: '#111', color: '#fff', border: '1px solid #444', borderRadius: '4px', padding: '6px', fontSize: '11px', outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' }}
                            />
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '5px', fontSize: '11px', color: '#ccc', cursor: 'pointer', userSelect: 'none' }}>
                              <input
                                type="checkbox"
                                checked={creditsEffect === 'wave'}
                                onChange={e => setCreditsEffect(e.target.checked ? 'wave' : 'none')}
                                style={{ accentColor: '#4CAF50' }}
                              />
                              <span style={{ fontWeight: 'bold', color: '#aaa', textTransform: 'uppercase', fontSize: '10px' }}>Add Text Wave Effect</span>
                            </label>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div style={{
                  display: 'flex',
                  gap: '12px',
                  marginTop: '10px',
                  borderTop: '1px solid #3c3c3c',
                  paddingTop: '16px'
                }}>
                  <button
                    onClick={() => setShowExportDialog(false)}
                    style={{
                      flex: 1,
                      padding: '10px',
                      background: 'transparent',
                      border: '1px solid #555',
                      color: '#fff',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: '500',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#aaa'; e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#555'; e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* EMULATOR DIALOG */}
      {showEmulatorDialog && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 10000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            background: 'linear-gradient(180deg, #5c55a5 0%, #3e3878 100%)',
            border: '2px solid #2d295c',
            borderRadius: '16px 16px 40px 40px',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.9), inset 0 5px 15px rgba(255,255,255,0.15)',
            padding: '20px 30px',
            width: '600px',
            display: 'flex',
            flexDirection: 'column',
            gap: '0px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px', marginBottom: '10px' }}>
              <span style={{ fontWeight: 'bold', color: '#fff', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px', opacity: 0.8 }}><BsPlayFill size={20} /> PxGBA Play Test</span>
              <button onClick={() => setShowEmulatorDialog(false)} style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', fontSize: '18px' }}>✕</button>
            </div>

            <div style={{ margin: '0 auto', width: '540px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 10px', marginBottom: '-10px', zIndex: 1, position: 'relative', touchAction: 'none' }}>
                <div
                  onPointerDown={() => triggerKey('a', true)}
                  onPointerUp={() => triggerKey('a', false)}
                  onPointerOut={() => triggerKey('a', false)}
                  onPointerCancel={() => triggerKey('a', false)}
                  style={{ width: '100px', height: '24px', background: '#d0d0d0', border: '2px solid #888', borderBottom: 'none', borderRadius: '12px 12px 0 0', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#444', fontSize: '12px', fontWeight: 'bold', boxShadow: 'inset 0 4px 6px rgba(255,255,255,0.6)' }}
                >L</div>
                <div
                  onPointerDown={() => triggerKey('s', true)}
                  onPointerUp={() => triggerKey('s', false)}
                  onPointerOut={() => triggerKey('s', false)}
                  onPointerCancel={() => triggerKey('s', false)}
                  style={{ width: '100px', height: '24px', background: '#d0d0d0', border: '2px solid #888', borderBottom: 'none', borderRadius: '12px 12px 0 0', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#444', fontSize: '12px', fontWeight: 'bold', boxShadow: 'inset 0 4px 6px rgba(255,255,255,0.6)' }}
                >R</div>
              </div>

              <div style={{ background: '#222', borderRadius: '15px 15px 40px 15px', padding: '25px 25px 40px 25px', position: 'relative', border: '2px solid #111', boxShadow: 'inset 0 0 15px rgba(0,0,0,0.8), 0 2px 5px rgba(255,255,255,0.1)' }}>
                <div style={{ position: 'absolute', bottom: '10px', width: '100%', textAlign: 'center', left: 0, color: '#aaa', fontSize: '14px', fontWeight: 'bold', fontStyle: 'italic', letterSpacing: '2px' }}>GAME BOY <span style={{ color: '#fff' }}>ADVANCE</span></div>
                <div style={{ width: '480px', height: '320px', backgroundColor: '#000', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden', boxShadow: 'inset 0 0 10px rgba(0,0,0,1)' }}>
                  {!romLoaded && isCompiling && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '15px', background: '#222', borderRadius: '6px', border: '1px solid #333' }}>
                      <div style={{
                        width: '24px',
                        height: '24px',
                        border: '3px solid #333',
                        borderTop: '3px solid #4CAF50',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                      }} />
                      <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
                      <span style={{ fontSize: '13px', color: '#ccc', fontWeight: 'bold' }}>Compiling Game...</span>
                    </div>
                  )}
                  <canvas
                    ref={emulatorCanvasRef}
                    width={240}
                    height={160}
                    tabIndex="0"
                    style={{
                      width: '100%',
                      height: '100%',
                      position: romLoaded ? 'relative' : 'absolute',
                      opacity: romLoaded ? 1 : 0,
                      pointerEvents: romLoaded ? 'auto' : 'none',
                      imageRendering: 'pixelated',
                      outline: 'none'
                    }}
                  />
                </div>
              </div>

              {/* Gamepad Controls */}
              <div style={{ display: 'flex', width: '100%', padding: '20px 20px 10px 20px', justifyContent: 'space-between', alignItems: 'center', userSelect: 'none', touchAction: 'none', boxSizing: 'border-box' }}>
                {/* D-Pad */}
                <div style={{ position: 'relative', width: '90px', height: '90px' }}>
                  <div style={{ position: 'absolute', top: 0, left: '30px', width: '30px', height: '30px', background: '#333', borderRadius: '4px 4px 0 0', cursor: 'pointer', boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.2)' }} onPointerDown={() => triggerKey('ArrowUp', true)} onPointerUp={() => triggerKey('ArrowUp', false)} onPointerOut={() => triggerKey('ArrowUp', false)} onPointerCancel={() => triggerKey('ArrowUp', false)} />
                  <div style={{ position: 'absolute', bottom: 0, left: '30px', width: '30px', height: '30px', background: '#333', borderRadius: '0 0 4px 4px', cursor: 'pointer', boxShadow: 'inset 0 -2px 4px rgba(0,0,0,0.4)' }} onPointerDown={() => triggerKey('ArrowDown', true)} onPointerUp={() => triggerKey('ArrowDown', false)} onPointerOut={() => triggerKey('ArrowDown', false)} onPointerCancel={() => triggerKey('ArrowDown', false)} />
                  <div style={{ position: 'absolute', top: '30px', left: 0, width: '30px', height: '30px', background: '#333', borderRadius: '4px 0 0 4px', cursor: 'pointer', boxShadow: 'inset 2px 0 4px rgba(255,255,255,0.2)' }} onPointerDown={() => triggerKey('ArrowLeft', true)} onPointerUp={() => triggerKey('ArrowLeft', false)} onPointerOut={() => triggerKey('ArrowLeft', false)} onPointerCancel={() => triggerKey('ArrowLeft', false)} />
                  <div style={{ position: 'absolute', top: '30px', right: 0, width: '30px', height: '30px', background: '#333', borderRadius: '0 4px 4px 0', cursor: 'pointer', boxShadow: 'inset -2px 0 4px rgba(0,0,0,0.4)' }} onPointerDown={() => triggerKey('ArrowRight', true)} onPointerUp={() => triggerKey('ArrowRight', false)} onPointerOut={() => triggerKey('ArrowRight', false)} onPointerCancel={() => triggerKey('ArrowRight', false)} />
                  <div style={{ position: 'absolute', top: '30px', left: '30px', width: '30px', height: '30px', background: '#333' }} />
                </div>

                {/* Select / Start */}
                <div style={{ display: 'flex', gap: '15px', alignSelf: 'flex-end', marginBottom: '15px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
                    <div style={{ width: '35px', height: '10px', background: '#aaa', borderRadius: '5px', transform: 'rotate(-20deg)', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.4), inset 0 2px 2px rgba(255,255,255,0.5)' }} onPointerDown={() => triggerKey('Backspace', true)} onPointerUp={() => triggerKey('Backspace', false)} onPointerOut={() => triggerKey('Backspace', false)} onPointerCancel={() => triggerKey('Backspace', false)} />
                    <span style={{ fontSize: '10px', color: '#aaa', fontWeight: 'bold', textShadow: '1px 1px 0 rgba(0,0,0,0.5)' }}>SELECT</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
                    <div style={{ width: '35px', height: '10px', background: '#aaa', borderRadius: '5px', transform: 'rotate(-20deg)', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.4), inset 0 2px 2px rgba(255,255,255,0.5)' }} onPointerDown={() => triggerKey('Enter', true)} onPointerUp={() => triggerKey('Enter', false)} onPointerOut={() => triggerKey('Enter', false)} onPointerCancel={() => triggerKey('Enter', false)} />
                    <span style={{ fontSize: '10px', color: '#aaa', fontWeight: 'bold', textShadow: '1px 1px 0 rgba(0,0,0,0.5)' }}>START</span>
                  </div>
                </div>

                {/* A / B */}
                <div style={{ position: 'relative', width: '100px', height: '90px' }}>
                  <div style={{ position: 'absolute', bottom: '15px', left: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
                    <div style={{ width: '40px', height: '40px', background: '#b0b0b0', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#333', fontWeight: 'bold', fontSize: '16px', boxShadow: '0 4px 0 #777, inset 0 2px 4px rgba(255,255,255,0.6)' }} onPointerDown={(e) => { e.currentTarget.style.transform = 'translateY(4px)'; e.currentTarget.style.boxShadow = 'inset 0 2px 4px rgba(255,255,255,0.6)'; triggerKey('z', true); }} onPointerUp={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 0 #777, inset 0 2px 4px rgba(255,255,255,0.6)'; triggerKey('z', false); }} onPointerOut={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 0 #777, inset 0 2px 4px rgba(255,255,255,0.6)'; triggerKey('z', false); }} onPointerCancel={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 0 #777, inset 0 2px 4px rgba(255,255,255,0.6)'; triggerKey('z', false); }}>B</div>
                  </div>
                  <div style={{ position: 'absolute', top: '15px', right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
                    <div style={{ width: '40px', height: '40px', background: '#b0b0b0', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#333', fontWeight: 'bold', fontSize: '16px', boxShadow: '0 4px 0 #777, inset 0 2px 4px rgba(255,255,255,0.6)' }} onPointerDown={(e) => { e.currentTarget.style.transform = 'translateY(4px)'; e.currentTarget.style.boxShadow = 'inset 0 2px 4px rgba(255,255,255,0.6)'; triggerKey('x', true); }} onPointerUp={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 0 #777, inset 0 2px 4px rgba(255,255,255,0.6)'; triggerKey('x', false); }} onPointerOut={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 0 #777, inset 0 2px 4px rgba(255,255,255,0.6)'; triggerKey('x', false); }} onPointerCancel={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 0 #777, inset 0 2px 4px rgba(255,255,255,0.6)'; triggerKey('x', false); }}>A</div>
                  </div>
                </div>
              </div>
            </div>

            {compileLog.length > 0 && compileLog.some(line => line.startsWith('[ERROR]')) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: '#1a1a1a', padding: '15px', borderRadius: '8px', border: '1px solid #444', width: '600px', boxSizing: 'border-box', marginTop: '15px' }}>
                <div style={{ background: '#000', padding: '10px', borderRadius: '6px', border: '1px solid #444', height: '100px', overflowY: 'auto', fontFamily: 'monospace', fontSize: '11px', display: 'flex', flexDirection: 'column' }}>
                  {compileLog.map((line, idx) => {
                    const isError = line.startsWith('[ERROR]') || line.toLowerCase().includes('error:');
                    const isWarning = line.toLowerCase().includes('warning:');
                    let textColor = '#ccc';
                    if (isError) textColor = '#ff4444';
                    else if (isWarning) textColor = '#ff9800';
                    else if (line.startsWith('[BUILDER]')) textColor = '#4CAF50';
                    return (
                      <span key={idx} style={{ textAlign: 'left', color: textColor, marginBottom: '4px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{line}</span>
                    );
                  })}
                  <div ref={logEndRef} />
                </div>
                <button
                  onClick={() => {
                    const logText = compileLog.join('\n');
                    const subject = encodeURIComponent("PxGBA Build Failure Log");
                    const body = encodeURIComponent("Please review the following build failure log:\n\n" + logText);
                    window.location.href = `mailto:dev@liftedpixel.ca?subject=${subject}&body=${body}`;
                  }}
                  style={{
                    background: '#0078d4',
                    color: '#fff',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    alignSelf: 'flex-end'
                  }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = '#005a9e'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = '#0078d4'}
                >
                  Send to Developer
                </button>
              </div>
            )}

          </div>
        </div>
      )}

      {/* MAP OVERVIEW DIALOG */}
      {showMapOverviewDialog && (
        <MapOverviewDialog />
      )}

      {/* VIDEO PLAYER */}
      <VideoPlayer />

      {/* TILE IMPORT SIZE DIALOG */}
      {showTileImportSizeDialog && (pendingTileImportFile || pendingOgaImportData) && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 110000, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(3px)' }}>
          <div style={{ background: '#242426', border: '1px solid #4CAF50', borderRadius: '8px', boxShadow: '0 15px 40px rgba(0,0,0,0.8)', padding: '24px', width: '400px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ fontSize: '15px', color: '#fff', fontWeight: 'bold', borderBottom: '1px solid #3c3c3c', paddingBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>SELECT TILE IMPORT SIZE</span>
              <button onClick={() => { setShowTileImportSizeDialog(false); setPendingTileImportFile(null); if (pendingOgaImportData) { if (pendingOgaImportData.loadingToastId) toast.dismiss(pendingOgaImportData.loadingToastId); setPendingOgaImportData(null); } }} style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', fontSize: '16px' }}>✕</button>
            </div>

            <div style={{ fontSize: '13px', color: '#ccc', lineHeight: '1.5' }}>
              Select the grid size of the tiles in the spritesheet you are importing:
            </div>

            <div style={{ display: 'flex', flexDirection: 'row', gap: '10px' }}>
              <button
                onClick={() => {
                  if (pendingOgaImportData) {
                    importTilesDirectly(pendingOgaImportData, 'keep', 8);
                    setOgaImportTilesWide(Math.floor(pendingOgaImportData.w / 8));
                    setPendingOgaImportData(null);
                  } else {
                    processTileImport(pendingTileImportFile, 8);
                    setPendingTileImportFile(null);
                  }
                  setShowTileImportSizeDialog(false);
                }}
                style={{
                  background: '#4CAF50',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '12px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  fontSize: '12px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                  transition: 'background 0.2s',
                  flexGrow: 1
                }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#45a049'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = '#4CAF50'}
              >
                8x8 Tiles
              </button>

              <button
                onClick={() => {
                  if (pendingOgaImportData) {
                    importTilesDirectly(pendingOgaImportData, 'keep', 16);
                    setOgaImportTilesWide(Math.floor(pendingOgaImportData.w / 8));
                    setPendingOgaImportData(null);
                  } else {
                    processTileImport(pendingTileImportFile, 16);
                    setPendingTileImportFile(null);
                  }
                  setShowTileImportSizeDialog(false);
                }}
                style={{
                  background: '#0078d4',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '12px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  fontSize: '12px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                  transition: 'background 0.2s',
                  flexGrow: 1
                }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#005a9e'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = '#0078d4'}
              >
                16x16 Tiles
              </button>

              <button
                onClick={() => {
                  if (pendingOgaImportData) {
                    importTilesDirectly(pendingOgaImportData, 'keep', 32);
                    setOgaImportTilesWide(Math.floor(pendingOgaImportData.w / 8));
                    setPendingOgaImportData(null);
                  } else {
                    processTileImport(pendingTileImportFile, 32);
                    setPendingTileImportFile(null);
                  }
                  setShowTileImportSizeDialog(false);
                }}
                style={{
                  background: '#ff9800',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '12px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  fontSize: '12px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                  transition: 'background 0.2s',
                  flexGrow: 1
                }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#e68a00'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = '#ff9800'}
              >
                32x32 Tiles
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TILE IMPORT PALETTE DIALOG */}
      {showTileImportPaletteDialog && pendingTileImportData && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 110000, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(3px)' }}>
          <div style={{ background: '#242426', border: '1px solid #4CAF50', borderRadius: '8px', boxShadow: '0 15px 40px rgba(0,0,0,0.8)', padding: '24px', width: '450px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ fontSize: '15px', color: '#fff', fontWeight: 'bold', borderBottom: '1px solid #3c3c3c', paddingBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>IMPORT TILESET PALETTE CHOICE</span>
              <button onClick={() => { setShowTileImportPaletteDialog(false); setPendingTileImportData(null); if (pendingTileImportData.loadingToastId) toast.dismiss(pendingTileImportData.loadingToastId); }} style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', fontSize: '16px' }}>✕</button>
            </div>

            <div style={{ fontSize: '13px', color: '#ccc', lineHeight: '1.5' }}>
              The imported image <strong style={{ color: '#fff' }}>({pendingTileImportData.w}×{pendingTileImportData.h}px)</strong> contains colors that don't match your current project palette.
              <br /><br />
              How would you like to handle this?
            </div>

            {/* Dominant Colors in Imported Image */}
            <div>
              <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: '8px' }}>Imported Image Colors (up to 256):</div>
              <div style={{ maxHeight: '100px', overflowY: 'auto', paddingRight: '4px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(16, 1fr)', gap: '4px' }}>
                  {pendingTileImportData.dominantColors.map((color, idx) => (
                    <div key={idx} style={{ aspectRatio: '1', backgroundColor: color, border: '1px solid #111', borderRadius: '2px' }} title={color} />
                  ))}
                </div>
              </div>
            </div>

            {/* Current Project Palette */}
            <div>
              <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: '8px' }}>Current Project Palette (up to 256):</div>
              <div style={{ maxHeight: '100px', overflowY: 'auto', paddingRight: '4px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(16, 1fr)', gap: '4px' }}>
                  {(recentColors && recentColors.length > 0 ? recentColors : DEFAULT_16_PALETTE).map((color, idx) => (
                    <div key={idx} style={{ aspectRatio: '1', backgroundColor: color, border: '1px solid #111', borderRadius: '2px' }} title={color} />
                  ))}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
              <button
                onClick={() => executeTileImport('replace')}
                style={{
                  background: '#4CAF50',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '12px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  fontSize: '12px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#45a049'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = '#4CAF50'}
              >
                Update Project Palette to Match Image (re-index existing tiles & scenes)
              </button>
              
              <button
                onClick={() => executeTileImport('keep')}
                style={{
                  background: '#0078d4',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '12px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  fontSize: '12px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#005a9e'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = '#0078d4'}
              >
                Keep Current Palette (re-index imported tiles to fit current palette)
              </button>

              <button
                onClick={() => {
                  setShowTileImportPaletteDialog(false);
                  setPendingTileImportData(null);
                  if (pendingTileImportData.loadingToastId) {
                    toast.dismiss(pendingTileImportData.loadingToastId);
                  }
                }}
                style={{
                  background: 'transparent',
                  color: '#aaa',
                  border: '1px solid #555',
                  borderRadius: '4px',
                  padding: '10px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = '#888'; }}
                onMouseLeave={e => { e.currentTarget.style.color = '#aaa'; e.currentTarget.style.borderColor = '#555'; }}
              >
                Cancel Import
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LEVEL GENERATION DIALOG */}
      {showLevelGenDialog && levelGenSceneId != null && (
        <LevelGenDialog
          sceneId={levelGenSceneId}
          scenes={scenes}
          savedTiles={savedTiles}
          recentColors={recentColors}
          generateLevelForScene={generateLevelForScene}
          onClose={() => { setShowLevelGenDialog(false); }}
        />
      )}
    </>
  );
};

export const TilePreview = ({ tile, size }) => {
  const canvasRef = useRef(null);
  const s = size || 16;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 8, 8);

    if (tile && tile.data) {
      for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
          const color = tile.data[y]?.[x];
          if (color && color !== 'transparent') {
            ctx.fillStyle = color;
            ctx.fillRect(x, y, 1, 1);
          }
        }
      }
    }
  }, [tile]);

  return (
    <canvas
      ref={canvasRef}
      width={8}
      height={8}
      style={{
        width: `${s}px`,
        height: `${s}px`,
        imageRendering: 'pixelated',
        border: '1px solid #444',
        borderRadius: '2px',
        background: '#1a1a1a',
        flexShrink: 0,
        display: 'block',
        pointerEvents: 'none'
      }}
    />
  );
};

export const TileSelector = ({ tiles, value, onChange, label = '', style, hideLabel = false, placeholder = 'Auto-detect' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const inputRef = useRef(null);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });

  const selectedTile = tiles.find(t => t.id === value);
  const matchLabel = ((label || '').match(/\(([^)]+)\)/) || [null, label || ''])[1];
  const defaultTile = selectedTile || (() => {
    if (!matchLabel) return tiles[0];
    const parts = matchLabel.toLowerCase().split(/[\/\s]+/).filter(Boolean);
    const keywordMap = { ground: 'grass', track: 'road', border: 'stone', fill: 'road' };
    let firstKeyword = keywordMap[parts[0]] || parts[0];
    if (firstKeyword === 'cave' && parts.length > 1) {
      firstKeyword = 'cave ' + parts[1];
    }
    return tiles.find(t => t.name.toLowerCase().includes(firstKeyword));
  })() || tiles[0];

  const filtered = search
    ? tiles.filter(t => t.name.toLowerCase().includes(search.toLowerCase()))
    : tiles;

  const defaultTileIds = new Set(INITIAL_DEFAULT_TILES.map(t => t.id));
  const defaultFiltered = filtered.filter(t => defaultTileIds.has(t.id));
  const customFiltered = filtered.filter(t => !defaultTileIds.has(t.id));

  const groupOrder = [];
  const groupMap = {};
  for (const tile of customFiltered) {
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

  const renderTileRow = (t) => (
    <div
      key={t.id}
      onClick={() => { onChange(t.id); setIsOpen(false); setSearch(''); }}
      style={{
        padding: '6px 8px', fontSize: '12px', cursor: 'pointer', color: '#ccc',
        display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0,
        background: value === t.id ? '#2a4a2a' : 'transparent',
        borderRadius: '3px'
      }}
      onMouseEnter={e => e.currentTarget.style.background = value === t.id ? '#2a4a2a' : '#333'}
      onMouseLeave={e => e.currentTarget.style.background = value === t.id ? '#2a4a2a' : 'transparent'}
    >
      <TilePreview tile={t} size={24} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
    </div>
  );

  const updateCoords = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom,
        left: rect.left,
        width: rect.width
      });
    }
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        if (e.target.closest('.tile-selector-portal')) return;
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen) {
      updateCoords();
      if (inputRef.current) {
        inputRef.current.focus();
      }
      window.addEventListener('resize', updateCoords);
      window.addEventListener('scroll', updateCoords, true);
      return () => {
        window.removeEventListener('resize', updateCoords);
        window.removeEventListener('scroll', updateCoords, true);
      };
    }
  }, [isOpen]);

  const displayText = selectedTile ? selectedTile.name : placeholder;

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '8px', ...style }}>
      <TilePreview tile={defaultTile} size={24} />
      {!hideLabel && <span style={{ fontSize: '12px', color: '#ccc', minWidth: '40px', textAlign: 'left' }}>{label}</span>}
      <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
        <div
          ref={triggerRef}
          onClick={() => setIsOpen(!isOpen)}
          style={{
            background: '#1a1a1a', color: '#ccc', border: '1px solid #444', borderRadius: '3px',
            padding: '4px 6px', fontSize: '12px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '6px', userSelect: 'none'
          }}
        >
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayText}</span>
          <span style={{ fontSize: '9px', color: '#888' }}>▼</span>
        </div>
        {isOpen && createPortal(
          <div 
            className="tile-selector-portal"
            style={{
              position: 'fixed',
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              width: `${coords.width}px`,
              zIndex: 999999,
              background: '#1a1a1a', border: '1px solid #555', borderRadius: '3px',
              maxHeight: '200px', overflow: 'hidden', display: 'flex', flexDirection: 'column',
              boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
            }}
          >
            <input
              ref={inputRef}
              type="text"
              placeholder="Search tiles..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                background: '#111', color: '#ccc', border: 'none', borderBottom: '1px solid #333',
                padding: '6px 8px', fontSize: '12px', outline: 'none', width: '100%', boxSizing: 'border-box'
              }}
            />
            <div style={{ overflowY: 'auto', flex: 1 }}>
              <div
                onClick={() => { onChange(null); setIsOpen(false); setSearch(''); }}
                style={{
                  padding: '5px 8px', fontSize: '12px', cursor: 'pointer', color: '#888',
                  display: 'flex', alignItems: 'center', gap: '6px',
                  background: value == null ? '#333' : 'transparent'
                }}
              >
                {placeholder}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', padding: '4px', gap: '4px' }}>
                {defaultFiltered.map(t => renderTileRow(t))}
                {customFiltered.length > 0 && defaultFiltered.length > 0 && (
                  <div style={{ height: '0', borderTop: '1px dashed #555', margin: '2px 0' }} />
                )}
                {groupOrder.map(gid => {
                  const group = groupMap[gid];
                  if (group.length <= 1) {
                    return renderTileRow(group[0]);
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
                        display: 'grid',
                        gridTemplateColumns: `repeat(${cols}, 24px)`,
                        gap: '2px',
                        padding: '4px',
                        background: '#2a2a2a',
                        border: '1px solid #555',
                        borderRadius: '4px',
                        justifyItems: 'center',
                        alignItems: 'center'
                      }}
                      title={`Tile group (${cols}x${rows})`}
                    >
                      {sorted.map((tile, i) => tile ? (
                        <div
                          key={tile.id}
                          onClick={() => { onChange(tile.id); setIsOpen(false); setSearch(''); }}
                          style={{ cursor: 'pointer' }}
                          title={tile.name || "Unnamed Tile"}
                        >
                          <TilePreview tile={tile} size={24} />
                        </div>
                      ) : <div key={`empty-${i}`} style={{ width: '24px', height: '24px' }} />)}
                    </div>
                  );
                })}
              </div>
              {filtered.length === 0 && (
                <div style={{ padding: '8px', fontSize: '11px', color: '#666', textAlign: 'center' }}>No tiles found</div>
              )}
            </div>
          </div>,
          document.body
        )}
      </div>
    </div>
  );
};

const LevelGenDialog = ({ sceneId, scenes, savedTiles, recentColors, generateLevelForScene, onClose }) => {
  const { setScenes, saveHistory, layers, dimensions, variables } = usePxShop();
  const scene = scenes.find(s => s.id === sceneId);
  const sceneType = (scene?.type || 'TOPDOWN').toUpperCase();
  const tiles = savedTiles && savedTiles.length > 0 ? savedTiles : [];

  const [grassTileId, setGrassTileId] = useState(null);
  const [sandTileId, setSandTileId] = useState(null);
  const [waterTileId, setWaterTileId] = useState(null);
  const [mudTileId, setMudTileId] = useState(null);
  const [waterBodySize, setWaterBodySize] = useState(16);
  const [pathDirection, setPathDirection] = useState('random');

  const [brickTileId, setBrickTileId] = useState(null);
  const [groundTopTileId, setGroundTopTileId] = useState(null);
  const [platformTileId, setPlatformTileId] = useState(null);
  const [ladderTileId, setLadderTileId] = useState(null);
  const [hazardTileId, setHazardTileId] = useState(null);
  const [maxGroundHeight, setMaxGroundHeight] = useState(0);
  const [platformCount, setPlatformCount] = useState(0);
  const [deathPitCount, setDeathPitCount] = useState(0);
  const [platformBgType, setPlatformBgType] = useState('clouds');
  const [platformSkyColor, setPlatformSkyColor] = useState('#29adff');
  const [platformCloudColor1, setPlatformCloudColor1] = useState('#fff1e8');
  const [platformCloudColor2, setPlatformCloudColor2] = useState('#c2c3c7');
  const [platformStarColor, setPlatformStarColor] = useState('#fff1e8');
  const [platformPlanets, setPlatformPlanets] = useState(false);
  const [platformMaxPlanetSize, setPlatformMaxPlanetSize] = useState(4);

  const [introUseLpLogo, setIntroUseLpLogo] = useState(true);
  const [introImgData, setIntroImgData] = useState(null);
  const [introImgName, setIntroImgName] = useState('');
  const [pauseUseLpPause, setPauseUseLpPause] = useState(true);
  const [pauseImgData, setPauseImgData] = useState(null);
  const [pauseImgName, setPauseImgName] = useState('');
  const [pauseBgColor, setPauseBgColor] = useState('#000000');

  const [genWidthTiles, setGenWidthTiles] = useState(32);
  const [genHeightTiles, setGenHeightTiles] = useState(32);

  useEffect(() => {
    if (scene) {
      setGenWidthTiles(Math.round(scene.dimensions.w / 8));
      setGenHeightTiles(Math.round(scene.dimensions.h / 8));
    }
  }, [sceneId, scene?.dimensions?.w, scene?.dimensions?.h]);

  const [caveBgType, setCaveBgType] = useState('tile');
  const [caveBgColor, setCaveBgColor] = useState('#000000');
  const [caveBgTileId, setCaveBgTileId] = useState(null);
  const [caveWallTileId, setCaveWallTileId] = useState(null);
  const [cavePlatformTileId, setCavePlatformTileId] = useState(null);

  useEffect(() => {
    if (caveBgTileId === null && tiles && tiles.length > 0) {
      const bgTile = tiles.find(t => t.name.toLowerCase().includes('cave background'));
      if (bgTile) {
        setCaveBgTileId(bgTile.id);
      }
    }
  }, [tiles, caveBgTileId]);

  const [caveCrystalTileId, setCaveCrystalTileId] = useState(null);
  const [caveMushroomTileId, setCaveMushroomTileId] = useState(null);
  const [caveVineTileId, setCaveVineTileId] = useState(null);
  const [cavePillarTileId, setCavePillarTileId] = useState(null);
  const [caveStalactiteTileId, setCaveStalactiteTileId] = useState(null);
  const [caveDensity, setCaveDensity] = useState(0.4);
  const [caveTunnelWidth, setCaveTunnelWidth] = useState(4);
  const [cavePlatformCount, setCavePlatformCount] = useState(6);
  const [caveCrystalCount, setCaveCrystalCount] = useState(3);
  const [caveMushroomCount, setCaveMushroomCount] = useState(3);

  const [streetTileId, setStreetTileId] = useState(null);
  const [curbTileId, setCurbTileId] = useState(null);
  const [sidewalkTileId, setSidewalkTileId] = useState(null);
  const [brick2TileId, setBrick2TileId] = useState(null);
  const [windowTileId, setWindowTileId] = useState(null);
  const [doorTileId, setDoorTileId] = useState(null);

  // 1. Reset on sceneType transition to ensure correct default loaders run
  const prevSceneTypeRef = useRef(sceneType);
  useEffect(() => {
    if (prevSceneTypeRef.current !== sceneType) {
      setStreetTileId(null);
      setCurbTileId(null);
      setSidewalkTileId(null);
      setBrickTileId(null);
      setBrick2TileId(null);
      setWindowTileId(null);
      setDoorTileId(null);
      
      setGrassTileId(null);
      setSandTileId(null);
      setWaterTileId(null);
      setMudTileId(null);
      
      setCaveBgTileId(null);
      setCaveWallTileId(null);
      setCavePlatformTileId(null);
      setCaveCrystalTileId(null);
      setCaveMushroomTileId(null);
      setCaveVineTileId(null);
      setCavePillarTileId(null);
      setCaveStalactiteTileId(null);
      
      setPlatformBgType('clouds');
      setPlatformSkyColor('#29adff');
      setPlatformCloudColor1('#fff1e8');
      setPlatformCloudColor2('#c2c3c7');
      setPlatformStarColor('#fff1e8');
      setPlatformPlanets(false);
      setPlatformMaxPlanetSize(4);
      
      prevSceneTypeRef.current = sceneType;
    }
  }, [sceneType]);

  // 2. Load configurations from scene._autoGenConfig
  useEffect(() => {
    if (!scene) return;
    const cfg = scene?._autoGenConfig;
    if (cfg) {
      setStreetTileId(cfg.streetTileId ?? null);
      setCurbTileId(cfg.curbTileId ?? null);
      setSidewalkTileId(cfg.sidewalkTileId ?? null);
      setBrickTileId(cfg.brickTileId ?? null);
      setBrick2TileId(cfg.brick2TileId ?? null);
      setWindowTileId(cfg.windowTileId ?? null);
      setDoorTileId(cfg.doorTileId ?? null);
      
      setGrassTileId(cfg.grassTileId ?? null);
      setSandTileId(cfg.sandTileId ?? null);
      setWaterTileId(cfg.waterTileId ?? null);
      setMudTileId(cfg.mudTileId ?? null);
      
      setCaveBgTileId(cfg.caveBgTileId ?? null);
      setCaveWallTileId(cfg.caveWallTileId ?? null);
      setCavePlatformTileId(cfg.cavePlatformTileId ?? null);
      setCaveCrystalTileId(cfg.caveCrystalTileId ?? null);
      setCaveMushroomTileId(cfg.caveMushroomTileId ?? null);
      setCaveVineTileId(cfg.caveVineTileId ?? null);
      setCavePillarTileId(cfg.cavePillarTileId ?? null);
      setCaveStalactiteTileId(cfg.caveStalactiteTileId ?? null);
      
      setTrackTileId(cfg.trackTileId ?? null);
      setRacingGrassTileId(cfg.grassTileId ?? null);
      setFinishTileId(cfg.finishTileId ?? null);
      setBorderTileId(cfg.borderTileId ?? null);
      setObstacleTileId(cfg.obstacleTileId ?? null);
      
      setPlatformBgType(cfg.platformBgType ?? 'clouds');
      setPlatformSkyColor(cfg.platformSkyColor ?? '#29adff');
      setPlatformCloudColor1(cfg.platformCloudColor1 ?? '#fff1e8');
      setPlatformCloudColor2(cfg.platformCloudColor2 ?? '#c2c3c7');
      setPlatformStarColor(cfg.platformStarColor ?? '#fff1e8');
      setPlatformPlanets(cfg.platformPlanets ?? false);
      setPlatformMaxPlanetSize(cfg.platformMaxPlanetSize ?? 4);
    } else {
      setStreetTileId(null);
      setCurbTileId(null);
      setSidewalkTileId(null);
      setBrickTileId(null);
      setBrick2TileId(null);
      setWindowTileId(null);
      setDoorTileId(null);
      
      setGrassTileId(null);
      setSandTileId(null);
      setWaterTileId(null);
      setMudTileId(null);
      
      setCaveBgTileId(null);
      setCaveWallTileId(null);
      setCavePlatformTileId(null);
      setCaveCrystalTileId(null);
      setCaveMushroomTileId(null);
      setCaveVineTileId(null);
      setCavePillarTileId(null);
      setCaveStalactiteTileId(null);
      
      setTrackTileId(null);
      setRacingGrassTileId(null);
      setFinishTileId(null);
      setBorderTileId(null);
      setObstacleTileId(null);
      
      setPlatformBgType('clouds');
      setPlatformSkyColor('#29adff');
      setPlatformCloudColor1('#fff1e8');
      setPlatformCloudColor2('#c2c3c7');
      setPlatformStarColor('#fff1e8');
      setPlatformPlanets(false);
      setPlatformMaxPlanetSize(4);
    }
  }, [sceneId, scene?._autoGenConfig]);

  useEffect(() => {
    if (!scene) return;
    if (tiles && tiles.length > 0) {
      const getName = t => (t && t.name ? String(t.name).toLowerCase() : '');
      const cfg = scene?._autoGenConfig;
      if (sceneType === 'BEATEMUP') {
        if (streetTileId === null && (!cfg || cfg.streetTileId === undefined)) {
          let streetTile = tiles.find(t => getName(t).includes('road'));
          if (!streetTile) streetTile = tiles.find(t => getName(t).includes('track'));
          if (!streetTile) streetTile = tiles.find(t => getName(t).includes('finish'));
          if (streetTile) setStreetTileId(streetTile.id);
        }
        if (curbTileId === null && (!cfg || cfg.curbTileId === undefined)) {
          let curbTile = tiles.find(t => getName(t).includes('cave wall'));
          if (!curbTile) curbTile = tiles.find(t => getName(t).includes('curb'));
          if (!curbTile) curbTile = tiles.find(t => getName(t).includes('border'));
          if (!curbTile) curbTile = tiles.find(t => getName(t).includes('stone'));
          if (curbTile) setCurbTileId(curbTile.id);
        }
        if (sidewalkTileId === null && (!cfg || cfg.sidewalkTileId === undefined)) {
          let sidewalkTile = tiles.find(t => getName(t).includes('conveyor belt'));
          if (!sidewalkTile) sidewalkTile = tiles.find(t => getName(t).includes('sidewalk'));
          if (!sidewalkTile) sidewalkTile = tiles.find(t => getName(t).includes('floor'));
          if (!sidewalkTile) sidewalkTile = tiles.find(t => getName(t).includes('ground'));
          if (sidewalkTile) setSidewalkTileId(sidewalkTile.id);
        }
        
        let resolvedBrickId = brickTileId;
        if (resolvedBrickId === null && (!cfg || cfg.brickTileId === undefined)) {
          const brickTile = tiles.find(t => getName(t).includes('brick') || getName(t).includes('wall'));
          if (brickTile) {
            resolvedBrickId = brickTile.id;
            setBrickTileId(brickTile.id);
          }
        }
        if (brick2TileId === null && (!cfg || cfg.brick2TileId === undefined)) {
          const brick2Tile = tiles.find(t => (getName(t).includes('wall') || getName(t).includes('stone') || getName(t).includes('wood') || getName(t).includes('concrete')) && t.id !== resolvedBrickId);
          if (brick2Tile) setBrick2TileId(brick2Tile.id);
        }
        if (windowTileId === null && (!cfg || cfg.windowTileId === undefined)) {
          let windowTile = tiles.find(t => getName(t).includes('ice block'));
          if (!windowTile) windowTile = tiles.find(t => getName(t).includes('window'));
          if (!windowTile) windowTile = tiles.find(t => getName(t).includes('glass'));
          if (windowTile) setWindowTileId(windowTile.id);
        }
        if (doorTileId === null && (!cfg || cfg.doorTileId === undefined)) {
          let doorTile = tiles.find(t => getName(t).includes('locked door'));
          if (!doorTile) doorTile = tiles.find(t => getName(t).includes('door'));
          if (!doorTile) doorTile = tiles.find(t => getName(t).includes('entrance'));
          if (doorTile) setDoorTileId(doorTile.id);
        }
      } else if (sceneType === 'RACING') {
        if (trackTileId === null && (!cfg || cfg.trackTileId === undefined)) {
          let trackTile = tiles.find(t => getName(t).includes('road'));
          if (!trackTile) trackTile = tiles.find(t => getName(t).includes('racing floor'));
          if (!trackTile) trackTile = tiles.find(t => getName(t).includes('stone wall'));
          if (trackTile) setTrackTileId(trackTile.id);
        }
        if (racingGrassTileId === null && (!cfg || cfg.grassTileId === undefined)) {
          let grassTile = tiles.find(t => getName(t).includes('grass block'));
          if (!grassTile) grassTile = tiles.find(t => getName(t).includes('grass'));
          if (grassTile) setRacingGrassTileId(grassTile.id);
        }
        if (finishTileId === null && (!cfg || cfg.finishTileId === undefined)) {
          let finishTile = tiles.find(t => getName(t).includes('racing finish line'));
          if (!finishTile) finishTile = tiles.find(t => getName(t).includes('finish'));
          if (finishTile) setFinishTileId(finishTile.id);
        }
        if (borderTileId === null && (!cfg || cfg.borderTileId === undefined)) {
          let borderTile = tiles.find(t => getName(t).includes('cave wall'));
          if (!borderTile) borderTile = tiles.find(t => getName(t).includes('border'));
          if (borderTile) setBorderTileId(borderTile.id);
        }
        if (obstacleTileId === null && (!cfg || cfg.obstacleTileId === undefined)) {
          let obstacleTile = tiles.find(t => getName(t).includes('racing obstacle'));
          if (!obstacleTile) obstacleTile = tiles.find(t => getName(t).includes('hazard'));
          if (obstacleTile) setObstacleTileId(obstacleTile.id);
        }
      } else {
        if (streetTileId === null && (!cfg || cfg.streetTileId === undefined)) {
          const streetTile = tiles.find(t => getName(t).includes('road') || getName(t).includes('track') || getName(t).includes('finish'));
          if (streetTile) setStreetTileId(streetTile.id);
        }
        if (curbTileId === null && (!cfg || cfg.curbTileId === undefined)) {
          const curbTile = tiles.find(t => getName(t).includes('curb') || getName(t).includes('border') || getName(t).includes('stone'));
          if (curbTile) setCurbTileId(curbTile.id);
        }
        if (sidewalkTileId === null && (!cfg || cfg.sidewalkTileId === undefined)) {
          const sidewalkTile = tiles.find(t => getName(t).includes('sidewalk') || getName(t).includes('floor') || getName(t).includes('ground'));
          if (sidewalkTile) setSidewalkTileId(sidewalkTile.id);
        }
        let resolvedBrickId = brickTileId;
        if (resolvedBrickId === null && (!cfg || cfg.brickTileId === undefined)) {
          const brickTile = tiles.find(t => getName(t).includes('brick') || getName(t).includes('wall'));
          if (brickTile) {
            resolvedBrickId = brickTile.id;
            setBrickTileId(brickTile.id);
          }
        }
        if (brick2TileId === null && (!cfg || cfg.brick2TileId === undefined)) {
          const brick2Tile = tiles.find(t => (getName(t).includes('wall') || getName(t).includes('stone') || getName(t).includes('wood') || getName(t).includes('concrete')) && t.id !== resolvedBrickId);
          if (brick2Tile) setBrick2TileId(brick2Tile.id);
        }
        if (windowTileId === null && (!cfg || cfg.windowTileId === undefined)) {
          const windowTile = tiles.find(t => getName(t).includes('window') || getName(t).includes('glass'));
          if (windowTile) setWindowTileId(windowTile.id);
        }
        if (doorTileId === null && (!cfg || cfg.doorTileId === undefined)) {
          const doorTile = tiles.find(t => getName(t).includes('door') || getName(t).includes('entrance'));
          if (doorTile) setDoorTileId(doorTile.id);
        }
      }
    }
  }, [tiles, streetTileId, curbTileId, sidewalkTileId, brickTileId, brick2TileId, windowTileId, doorTileId, sceneType, scene?._autoGenConfig]);


  const [colorsInitialized, setColorsInitialized] = useState(false);

  useEffect(() => {
    if (colorsInitialized) return;
    const palette = recentColors && recentColors.length > 0 ? recentColors : DEFAULT_16_PALETTE;
    if (palette && palette.length > 0) {
      const hexToRgb = (hex) => {
        if (!hex) return { r: 0, g: 0, b: 0 };
        const clean = hex.replace('#', '');
        const num = parseInt(clean, 16);
        return {
          r: (num >> 16) & 255,
          g: (num >> 8) & 255,
          b: num & 255
        };
      };

      const getLuminance = (hex) => {
        const { r, g, b } = hexToRgb(hex);
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };

      const sorted = [...palette].map(c => ({ hex: c, lum: getLuminance(c) })).sort((a, b) => b.lum - a.lum);
      const lightest = sorted[0]?.hex || '#fff1e8';
      const secondLightest = sorted[1]?.hex || sorted[0]?.hex || '#c2c3c7';
      const darkest = sorted[sorted.length - 1]?.hex || '#000000';

      const blueColor = palette.find(c => {
        const { r, g, b } = hexToRgb(c);
        return b > r && g > r * 0.5 && c.toLowerCase() !== '#000000';
      });

      const skyDefault = blueColor || (sorted.find(x => x.lum > 80 && x.lum < 200)?.hex) || lightest;

      setPlatformSkyColor(platformBgType === 'starry' ? darkest : '#29adff');
      setPlatformCloudColor1('#fff1e8');
      setPlatformCloudColor2('#c2c3c7');
      setPlatformStarColor('#fff1e8');
      setCaveBgColor(darkest);
      setPauseBgColor(darkest);
      setColorsInitialized(true);
    }
  }, [recentColors, colorsInitialized, platformBgType]);

  const handleBgTypeChange = (val) => {
    setPlatformBgType(val);
    const palette = recentColors && recentColors.length > 0 ? recentColors : DEFAULT_16_PALETTE;
    const hexToRgb = (hex) => {
      if (!hex) return { r: 0, g: 0, b: 0 };
      const clean = hex.replace('#', '');
      const num = parseInt(clean, 16);
      return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
    };
    const getLuminance = (hex) => {
      const { r, g, b } = hexToRgb(hex);
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const sorted = [...palette].map(c => ({ hex: c, lum: getLuminance(c) })).sort((a, b) => b.lum - a.lum);
    const lightest = sorted[0]?.hex || '#fff1e8';
    const darkest = sorted[sorted.length - 1]?.hex || '#000000';

    if (val === 'starry') {
      setPlatformSkyColor(darkest);
    } else if (val === 'solid' || val === 'clouds') {
      setPlatformSkyColor('#29adff');
    }
  };

  const [generateCollisions, setGenerateCollisions] = useState(true);

  const [trackTileId, setTrackTileId] = useState(null);
  const [racingGrassTileId, setRacingGrassTileId] = useState(null);
  const [finishTileId, setFinishTileId] = useState(null);
  const [borderTileId, setBorderTileId] = useState(null);
  const [obstacleTileId, setObstacleTileId] = useState(null);
  const [obstacleCount, setObstacleCount] = useState(5);
  const [trackWidth, setTrackWidth] = useState(6);
  const [trackWaviness, setTrackWaviness] = useState(25);
  const [trackStyle, setTrackStyle] = useState('wavy');
  const [mode7Layout, setMode7Layout] = useState(false);
  const [trackGaps, setTrackGaps] = useState(false);
  const [showCountdown, setShowCountdown] = useState(scene && scene.showCountdown !== undefined ? scene.showCountdown : true);
  const [lapsToFinish, setLapsToFinish] = useState(scene && scene.lapsToFinish !== undefined ? scene.lapsToFinish : 3);
  const [useVarLaps, setUseVarLaps] = useState(scene && scene.useVarLaps !== undefined ? scene.useVarLaps : false);
  const [lapsVar, setLapsVar] = useState(scene && scene.lapsVar !== undefined ? scene.lapsVar : '');
  const [shmupBgType, setShmupBgType] = useState('sky_clouds');
  const [shmupGround, setShmupGround] = useState(false);
  const [shmupGroundTileId, setShmupGroundTileId] = useState(null);
  const [shmupWaterTileId, setShmupWaterTileId] = useState(null);
  const [shmupPlanets, setShmupPlanets] = useState(false);
  const [shmupMaxPlanetSize, setShmupMaxPlanetSize] = useState(4);
  const [shmupTopDown, setShmupTopDown] = useState(false);
  const [shmupSkyColor, setShmupSkyColor] = useState('#29adff');
  const [shmupCloudColor1, setShmupCloudColor1] = useState('#fff1e8');
  const [shmupCloudColor2, setShmupCloudColor2] = useState('#c2c3c7');
  const [shmupStarColor, setShmupStarColor] = useState('#fff1e8');
  const [shmupNightSkyColor, setShmupNightSkyColor] = useState('#000000');

  const [fillTileId, setFillTileId] = useState(null);
  const [borderColor, setBorderColor] = useState('#000000');
  const [bottomThickness, setBottomThickness] = useState(2);

  const handleGenerate = () => {
    const config = {};
    if (sceneType === 'TOPDOWN') {
      config.grassTileId = grassTileId || undefined;
      config.sandTileId = sandTileId || undefined;
      config.waterTileId = waterTileId || undefined;
      config.mudTileId = mudTileId || undefined;
      config.waterBodySize = waterBodySize;
      config.pathDirection = pathDirection;
    } else if (sceneType === 'METROIDVANIA') {
      config.caveWallTileId = caveWallTileId || undefined;
      config.cavePlatformTileId = cavePlatformTileId || undefined;
      config.caveMushroomTileId = caveMushroomTileId || undefined;
      config.caveVineTileId = caveVineTileId || undefined;
      config.cavePillarTileId = cavePillarTileId || undefined;
      config.caveStalactiteTileId = caveStalactiteTileId || undefined;
      config.caveDensity = caveDensity;
      config.caveTunnelWidth = caveTunnelWidth;
      config.cavePlatformCount = cavePlatformCount;
      config.caveMushroomCount = caveMushroomCount;
      config.caveBgType = caveBgType;
      config.caveBgColor = caveBgColor;
      config.caveBgTileId = caveBgTileId || undefined;
    } else if (sceneType === 'RACING') {
      config.trackTileId = trackTileId || undefined;
      config.grassTileId = racingGrassTileId || undefined;
      config.finishTileId = finishTileId || undefined;
      config.borderTileId = borderTileId || undefined;
      config.obstacleTileId = obstacleTileId || undefined;
      config.obstacleCount = obstacleCount || undefined;
      config.trackWidth = trackWidth;
      config.trackWaviness = trackWaviness;
      config.trackStyle = trackStyle;
      config.mode7Layout = mode7Layout;
      config.trackGaps = trackGaps;
      config.showCountdown = showCountdown;
      config.lapsToFinish = lapsToFinish;
      config.useVarLaps = useVarLaps;
      config.lapsVar = lapsVar;
    } else if (sceneType === 'BEATEMUP') {
      config.streetTileId = streetTileId || undefined;
      config.curbTileId = curbTileId || undefined;
      config.sidewalkTileId = sidewalkTileId || undefined;
      config.brickTileId = brickTileId || undefined;
      config.brick2TileId = brick2TileId || undefined;
      config.windowTileId = windowTileId || undefined;
      config.doorTileId = doorTileId || undefined;
      config.platformBgType = platformBgType;
      config.platformSkyColor = platformSkyColor;
      config.platformCloudColor1 = platformCloudColor1;
      config.platformCloudColor2 = platformCloudColor2;
      config.platformStarColor = platformStarColor;
      config.platformPlanets = platformPlanets;
      config.platformMaxPlanetSize = platformMaxPlanetSize;
    } else if (sceneType === 'POINTNCLICK') {
      config.fillTileId = fillTileId || undefined;
      config.borderColor = borderColor || undefined;
      config.bottomThickness = bottomThickness;
    } else if (sceneType === 'SHMUP') {
      config.shmupBgType = shmupBgType;
      config.shmupGround = shmupGround;
      config.shmupGroundTileId = shmupGroundTileId || undefined;
      config.shmupWaterTileId = shmupWaterTileId || undefined;
      config.shmupPlanets = shmupPlanets;
      config.shmupMaxPlanetSize = shmupMaxPlanetSize;
      config.shmupTopDown = shmupTopDown || mode7Layout;
      config.mode7Layout = mode7Layout;
      config.shmupSkyColor = shmupSkyColor;
      config.shmupCloudColor1 = shmupCloudColor1;
      config.shmupCloudColor2 = shmupCloudColor2;
      config.shmupStarColor = shmupStarColor;
      config.shmupNightSkyColor = shmupNightSkyColor;
    } else if (sceneType === 'INTRO') {
      config.introUseLpLogo = introUseLpLogo;
      config.introImgData = introImgData;
    } else if (sceneType === 'PAUSE') {
      config.pauseBgColor = pauseBgColor;
      config.pauseUseLpPause = pauseUseLpPause;
      config.pauseImgData = pauseImgData;
    } else {
      config.brickTileId = brickTileId || undefined;
      config.groundTopTileId = groundTopTileId || undefined;
      config.platformTileId = platformTileId || undefined;
      config.ladderTileId = ladderTileId || undefined;
      config.hazardTileId = hazardTileId || undefined;
      config.maxGroundHeight = maxGroundHeight || undefined;
      config.platformCount = platformCount || undefined;
      config.deathPitCount = deathPitCount || undefined;
      config.platformBgType = platformBgType;
      config.platformSkyColor = platformSkyColor;
      config.platformCloudColor1 = platformCloudColor1;
      config.platformCloudColor2 = platformCloudColor2;
      config.platformStarColor = platformStarColor;
      config.platformPlanets = platformPlanets;
      config.platformMaxPlanetSize = platformMaxPlanetSize;
    }
    config.width = genWidthTiles * 8;
    config.height = genHeightTiles * 8;
    config.generateCollisions = generateCollisions;
    generateLevelForScene(sceneId, config);
    onClose();
  };

  if (!scene) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 110000, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(3px)' }}>
      <div style={{ background: '#242426', border: '1px solid #4CAF50', borderRadius: '8px', boxShadow: '0 15px 40px rgba(0,0,0,0.8)', padding: '24px', width: '55%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ fontSize: '15px', color: '#fff', fontWeight: 'bold', borderBottom: '1px solid #3c3c3c', paddingBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>GENERATE LEVEL — {scene.name}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', fontSize: '16px' }}>✕</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '1px' }}>Scene Type</div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {[
              { value: 'TOPDOWN', label: 'Top Down' },
              { value: 'PLATFORMER', label: 'Platformer' },
              { value: 'METROIDVANIA', label: 'Metroidvania' },
              { value: 'POINTNCLICK', label: 'Point & Click' },
              { value: 'SHMUP', label: "Shoot 'Em Up" },
              { value: 'BEATEMUP', label: "Beat 'Em Up" },
              { value: 'RACING', label: 'Racing' },
              { value: 'INTRO', label: 'Intro/Logo' },
              { value: 'PAUSE', label: 'Pause Screen' },
            ].map(opt => (
              <button
                key={opt.value}
                disabled={opt.value === 'PAUSE' && scenes.filter(s => s.type === 'PAUSE' && s.id !== scene.id).length > 0}
                onClick={() => {
                  const val = opt.value;
                  if (val === 'PAUSE') {
                    const pauseCount = scenes.filter(s => s.type === 'PAUSE' && s.id !== scene.id).length;
                    if (pauseCount > 0) {
                      toast.error('Only one Pause Screen scene is allowed per project.');
                      return;
                    }
                  }
                  const isIntroOrPause = val === 'INTRO' || val === 'PAUSE';
                  const newDims = isIntroOrPause ? { w: 256, h: 256 } : (scene.dimensions || { w: 256, h: 256 });
                  const nextScenes = scenes.map(s => {
                    if (s.id === scene.id) {
                      let newName = s.name;
                      if (val === 'INTRO' && (s.name.startsWith('Scene ') || s.name === 'Pause Screen' || s.name === 'Pause' || s.name === 'Intro/Logo')) {
                        newName = 'Intro';
                      } else if (val === 'PAUSE' && (s.name.startsWith('Scene ') || s.name === 'Intro/Logo' || s.name === 'Intro' || s.name === 'Pause')) {
                        newName = 'Pause Screen';
                      }
                      return { ...s, type: val, dimensions: newDims, name: newName };
                    }
                    return s;
                  });
                  setScenes(nextScenes);
                  saveHistory("Set Scene Type", layers, dimensions, { scenes: nextScenes });
                }}
                style={{
                  flex: 1,
                  padding: '8px 10px',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  border: `1px solid ${sceneType === opt.value ? '#4CAF50' : '#444'}`,
                  borderRadius: '6px',
                  cursor: opt.value === 'PAUSE' && scenes.filter(s => s.type === 'PAUSE' && s.id !== scene.id).length > 0 ? 'not-allowed' : 'pointer',
                  color: sceneType === opt.value ? '#fff' : (opt.value === 'PAUSE' && scenes.filter(s => s.type === 'PAUSE' && s.id !== scene.id).length > 0 ? '#555' : '#aaa'),
                  background: sceneType === opt.value ? '#2a4a2a' : '#1a1a1c',
                  transition: 'all 0.15s ease',
                  outline: 'none',
                  opacity: opt.value === 'PAUSE' && scenes.filter(s => s.type === 'PAUSE' && s.id !== scene.id).length > 0 ? 0.5 : 1,
                }}
                onMouseEnter={e => {
                  if (sceneType !== opt.value) {
                    e.currentTarget.style.borderColor = '#666';
                    e.currentTarget.style.color = '#fff';
                  }
                }}
                onMouseLeave={e => {
                  if (sceneType !== opt.value) {
                    e.currentTarget.style.borderColor = '#444';
                    e.currentTarget.style.color = '#aaa';
                  }
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {sceneType !== 'INTRO' && sceneType !== 'PAUSE' && (
          <div style={{ display: 'flex', flexDirection: 'row', gap: '12px', borderBottom: '1px solid #333', paddingBottom: '12px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
              <span style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.8px' }}>Width (tiles)</span>
              <select
                value={genWidthTiles}
                onChange={e => setGenWidthTiles(Number(e.target.value))}
                style={{ background: '#111', color: '#fff', border: '1px solid #444', padding: '6px', borderRadius: '4px', outline: 'none', cursor: 'pointer', fontSize: '12px' }}
              >
                {[32, 64, 96, 128, 160, 192, 224, 256].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
              <span style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.8px' }}>Height (tiles)</span>
              <select
                value={genHeightTiles}
                onChange={e => setGenHeightTiles(Number(e.target.value))}
                style={{ background: '#111', color: '#fff', border: '1px solid #444', padding: '6px', borderRadius: '4px', outline: 'none', cursor: 'pointer', fontSize: '12px' }}
              >
                {[32, 64, 96, 128, 160, 192, 224, 256].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
        )}

        {sceneType === 'TOPDOWN' && (
          <>
            <div style={{ display: 'flex', flexDirection: 'row', gap: '8px' }}>
              <TileSelector tiles={tiles} value={grassTileId} onChange={setGrassTileId} label="Grass" style={{ flexGrow: 1, flexBasis: '50%' }} />
              <TileSelector tiles={tiles} value={sandTileId} onChange={setSandTileId} label="Sand" style={{ flexGrow: 1, flexBasis: '50%' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'row', gap: '8px' }}>
              <TileSelector tiles={tiles} value={waterTileId} onChange={setWaterTileId} label="Water" style={{ flexGrow: 1, flexBasis: '50%' }} />
              <TileSelector tiles={tiles} value={mudTileId} onChange={setMudTileId} label="Path (Mud)" style={{ flexGrow: 1, flexBasis: '50%' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'row', gap: '8px', marginTop: '8px', }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexGrow:1, fontSize: '12px', color: '#aaa', marginBottom: '4px' }}>
                <span>Water Body Size</span>
                <input type="range" min="0" max="50" value={waterBodySize} onChange={e => setWaterBodySize(Number(e.target.value))} style={{ maxWidth:'70%',flexGrow:1, accentColor: '#4CAF50' }} />
                <span>{waterBodySize}%</span>
              </div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: '#aaa', marginBottom: '4px' }}>Path Direction</div>
              <div style={{ display: 'flex', gap: '6px' }}>
                {[
                  { value: 'random', label: 'Random' },
                  { value: 'ew', label: 'East-West' },
                  { value: 'ns', label: 'North-South' },
                  { value: 'both', label: 'Both' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setPathDirection(opt.value)}
                    style={{
                      flex: 1, padding: '6px 8px', fontSize: '11px', fontWeight: 'bold',
                      border: `1px solid ${pathDirection === opt.value ? '#4CAF50' : '#444'}`,
                      borderRadius: '4px', cursor: 'pointer', color: pathDirection === opt.value ? '#fff' : '#aaa',
                      background: pathDirection === opt.value ? '#2a4a2a' : 'transparent'
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#ccc', cursor: 'pointer', userSelect: 'none' }}>
              <input type="checkbox" checked={generateCollisions} onChange={e => setGenerateCollisions(e.target.checked)} style={{ accentColor: '#4CAF50' }} />
              Generate Collisions & Triggers
            </label>
          </>
        )}

        {sceneType === 'PLATFORMER' && (
          <>
            <div style={{ display: 'flex', flexDirection: 'row', gap: '8px' }}>
              <TileSelector tiles={tiles} value={brickTileId} onChange={setBrickTileId} label="Brick/Ground" style={{ flexGrow: 1, flexBasis: '50%' }} />
              <TileSelector tiles={tiles} value={groundTopTileId} onChange={setGroundTopTileId} label="Ground Top" style={{ flexGrow: 1, flexBasis: '50%' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'row', gap: '8px' }}>
              <TileSelector tiles={tiles} value={platformTileId} onChange={setPlatformTileId} label="Platform" style={{ flexGrow: 1, flexBasis: '33%' }} />
              <TileSelector tiles={tiles} value={ladderTileId} onChange={setLadderTileId} label="Ladder" style={{ flexGrow: 1, flexBasis: '33%' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'row', gap: '8px' }}>
              <TileSelector tiles={tiles} value={hazardTileId} onChange={setHazardTileId} label="Hazard" style={{ flexGrow: 1, flexBasis: '33%' }} />
            </div>
            <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#aaa', marginBottom: '4px' }}>
                  <span>Max Ground Height</span>
                  <input type="range" min="0" max="5" value={maxGroundHeight} onChange={e => setMaxGroundHeight(Number(e.target.value))} style={{ flexGrow:1, maxWidth: '70%', accentColor: '#4CAF50' }} />
                  <span>{maxGroundHeight === 0 ? 'Auto' : `${maxGroundHeight} row${maxGroundHeight > 1 ? 's' : ''}`}</span>
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#aaa', marginBottom: '4px' }}>
                  <span>Platform Count</span>
                  <input type="range" min="0" max="20" value={platformCount} onChange={e => setPlatformCount(Number(e.target.value))} style={{ flexGrow:1, maxWidth: '70%', accentColor: '#4CAF50' }} />
                  <span>{platformCount === 0 ? 'Auto' : platformCount}</span>
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#aaa', marginBottom: '4px' }}>
                  <span>Death Pits</span>
                  <input type="range" min="0" max="10" value={deathPitCount} onChange={e => setDeathPitCount(Number(e.target.value))} style={{ flexGrow:1, maxWidth: '70%', accentColor: '#4CAF50' }} />
                  <span>{deathPitCount === 0 ? 'Auto' : deathPitCount}</span>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderTop: '1px solid #3c3c3c', paddingTop: '8px', marginTop: '4px' }}>
              <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '1px' }}>Background</div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <select
                  value={platformBgType}
                  onChange={e => handleBgTypeChange(e.target.value)}
                  style={{
                    background: '#111', color: '#fff', border: '1px solid #444',
                    padding: '4px', fontSize: '12px', outline: 'none', borderRadius: '3px'
                  }}
                >
                  <option value="none">None (Transparent)</option>
                  <option value="solid">Solid Color</option>
                  <option value="clouds">Solid Color + Clouds</option>
                  <option value="starry">Starry Night Sky</option>
                </select>

                {(platformBgType === 'solid' || platformBgType === 'clouds') && (
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '12px', color: '#aaa' }}>Sky:</span>
                    <PaletteColorPicker
                      selectedColor={platformSkyColor}
                      onChange={setPlatformSkyColor}
                      recentColors={recentColors || []}
                      label="Sky Color"
                      allowTransparent={false}
                    />
                  </div>
                  {platformBgType === 'clouds' && (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '12px', color: '#aaa' }}>Cloud Main:</span>
                        <PaletteColorPicker
                          selectedColor={platformCloudColor1}
                          onChange={setPlatformCloudColor1}
                          recentColors={recentColors || []}
                          label="Cloud Main Color"
                          allowTransparent={false}
                        />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '12px', color: '#aaa' }}>Cloud Accent:</span>
                        <PaletteColorPicker
                          selectedColor={platformCloudColor2}
                          onChange={setPlatformCloudColor2}
                          recentColors={recentColors || []}
                          label="Cloud Accent Color"
                          allowTransparent={false}
                        />
                      </div>
                    </>
                  )}
                </div>
              )}

              {platformBgType === 'starry' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '12px', color: '#aaa' }}>Sky:</span>
                      <PaletteColorPicker
                        selectedColor={platformSkyColor}
                        onChange={setPlatformSkyColor}
                        recentColors={recentColors || []}
                        label="Sky Color"
                        allowTransparent={false}
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '12px', color: '#aaa' }}>Stars:</span>
                      <PaletteColorPicker
                        selectedColor={platformStarColor}
                        onChange={setPlatformStarColor}
                        recentColors={recentColors || []}
                        label="Star Color"
                        allowTransparent={false}
                      />
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px', color: '#ccc' }}>
                      <input
                        type="checkbox"
                        checked={platformPlanets}
                        onChange={e => setPlatformPlanets(e.target.checked)}
                        style={{ accentColor: '#4CAF50' }}
                      />
                      Add Planets
                    </label>

                    {platformPlanets && (
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', paddingLeft: '20px' }}>
                        <span style={{ fontSize: '11px', color: '#aaa' }}>Max Planet Size:</span>
                        <input
                          type="range"
                          min="2"
                          max="8"
                          value={platformMaxPlanetSize}
                          onChange={e => setPlatformMaxPlanetSize(Number(e.target.value))}
                          style={{ flexGrow: 1, maxWidth: '120px', accentColor: '#4CAF50' }}
                        />
                        <span style={{ fontSize: '11px', color: '#fff', fontWeight: 'bold' }}>
                          {platformMaxPlanetSize} tiles
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              </div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#ccc', cursor: 'pointer', userSelect: 'none', marginTop: '8px' }}>
              <input type="checkbox" checked={generateCollisions} onChange={e => setGenerateCollisions(e.target.checked)} style={{ accentColor: '#4CAF50' }} />
              Generate Collisions & Triggers
            </label>
          </>
        )}

        {sceneType === 'METROIDVANIA' && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px', borderBottom: '1px solid #333', paddingBottom: '8px' }}>
              <span style={{ fontSize: '11px', color: '#aaa', fontWeight: 'bold' }}>BACKGROUND STYLE</span>
              <div style={{ marginTop: '4px', display: 'flex' }}>
                <TileSelector tiles={tiles} value={caveBgTileId} onChange={setCaveBgTileId} label="Cave Background" style={{ flexGrow: 1 }} />
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'row', gap: '8px' }}>
              <TileSelector tiles={tiles} value={caveWallTileId} onChange={setCaveWallTileId} label="Cave Wall" style={{ flexGrow: 1, flexBasis: '50%' }} />
              <TileSelector tiles={tiles} value={cavePlatformTileId} onChange={setCavePlatformTileId} label="Cave Platform" style={{ flexGrow: 1, flexBasis: '50%' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'row', gap: '8px' }}>
              <TileSelector tiles={tiles} value={caveMushroomTileId} onChange={setCaveMushroomTileId} label="Mushroom" style={{ flexGrow: 1, flexBasis: '50%' }} />
              <TileSelector tiles={tiles} value={caveVineTileId} onChange={setCaveVineTileId} label="Vine" style={{ flexGrow: 1, flexBasis: '50%' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'row', gap: '8px' }}>
              <TileSelector tiles={tiles} value={cavePillarTileId} onChange={setCavePillarTileId} label="Pillar" style={{ flexGrow: 1, flexBasis: '50%' }} />
              <TileSelector tiles={tiles} value={caveStalactiteTileId} onChange={setCaveStalactiteTileId} label="Stalactite" style={{ flexGrow: 1, flexBasis: '50%' }} />
            </div>
            <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#aaa', marginBottom: '4px' }}>
                  <span>Cave Density</span>
                  <input type="range" min="20" max="70" value={caveDensity * 100} onChange={e => setCaveDensity(Number(e.target.value) / 100)} style={{ flexGrow:1, maxWidth: '70%', accentColor: '#E91E63' }} />
                  <span>{Math.round(caveDensity * 100)}%</span>
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#aaa', marginBottom: '4px' }}>
                  <span>Tunnel Width</span>
                  <input type="range" min="2" max="8" value={caveTunnelWidth} onChange={e => setCaveTunnelWidth(Number(e.target.value))} style={{ flexGrow:1, maxWidth: '70%', accentColor: '#E91E63' }} />
                  <span>{caveTunnelWidth} tiles</span>
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#aaa', marginBottom: '4px' }}>
                  <span>Platform Count</span>
                  <input type="range" min="0" max="15" value={cavePlatformCount} onChange={e => setCavePlatformCount(Number(e.target.value))} style={{ flexGrow:1, maxWidth: '70%', accentColor: '#E91E63' }} />
                  <span>{cavePlatformCount}</span>
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#aaa', marginBottom: '4px' }}>
                  <span>Mushroom Count</span>
                  <input type="range" min="0" max="10" value={caveMushroomCount} onChange={e => setCaveMushroomCount(Number(e.target.value))} style={{ flexGrow:1, maxWidth: '70%', accentColor: '#E91E63' }} />
                  <span>{caveMushroomCount}</span>
                </div>
              </div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#ccc', cursor: 'pointer', userSelect: 'none', marginTop: '8px' }}>
              <input type="checkbox" checked={generateCollisions} onChange={e => setGenerateCollisions(e.target.checked)} style={{ accentColor: '#4CAF50' }} />
              Generate Collisions & Triggers
            </label>
          </>
        )}

        {sceneType === 'RACING' && (
          <>
            <div style={{ display: 'flex', flexDirection: 'row', gap: '8px' }}>
              <TileSelector tiles={tiles} value={trackTileId} onChange={setTrackTileId} label="Track" style={{ flexGrow: 1, flexBasis: '50%' }} />
              <TileSelector tiles={tiles} value={racingGrassTileId} onChange={setRacingGrassTileId} label="Grass" style={{ flexGrow: 1, flexBasis: '50%' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'row', gap: '8px' }}>
              <TileSelector tiles={tiles} value={finishTileId} onChange={setFinishTileId} label="Finish Line" style={{ flexGrow: 1, flexBasis: '50%' }} />
              <TileSelector tiles={tiles} value={borderTileId} onChange={setBorderTileId} label="Border" style={{ flexGrow: 1, flexBasis: '50%' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'row', gap: '8px', }}>
              <TileSelector tiles={tiles} value={obstacleTileId} onChange={setObstacleTileId} label="Obstacle" />
            </div>
            <div style={{ marginTop: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#aaa', marginBottom: '4px' }}>
                <span>Track Width</span>
                <input type="range" min="2" max="12" value={trackWidth} onChange={e => setTrackWidth(Number(e.target.value))} style={{ flexGrow:1, maxWidth: '70%', accentColor: '#4CAF50' }} />
                <span>{trackWidth} tiles</span>
              </div>
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#aaa', marginBottom: '4px' }}>
                <span>Waviness</span>
                <input type="range" min="0" max="80" value={trackWaviness} onChange={e => setTrackWaviness(Number(e.target.value))} style={{ flexGrow:1, maxWidth: '70%', accentColor: '#4CAF50' }} />
                <span>{trackWaviness}%</span>
              </div>
            </div>
            <div style={{ marginTop: '8px' }}>
              <div style={{ fontSize: '12px', color: '#aaa', marginBottom: '4px' }}>Track Style</div>
              <div style={{ display: 'flex', gap: '6px' }}>
                {[
                  { value: 'wavy', label: 'Wavy' },
                  { value: 'twisty', label: 'Twisty' },
                  { value: 'serpentine', label: 'Serpentine' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setTrackStyle(opt.value)}
                    style={{
                      flex: 1, padding: '6px 8px', fontSize: '11px', fontWeight: 'bold',
                      border: `1px solid ${trackStyle === opt.value ? '#4CAF50' : '#444'}`,
                      borderRadius: '4px', cursor: 'pointer', color: trackStyle === opt.value ? '#fff' : '#aaa',
                      background: trackStyle === opt.value ? '#2a4a2a' : 'transparent'
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#aaa', marginBottom: '4px' }}>
                <span>Obstacle Count</span>
                <input type="range" min="0" max="30" value={obstacleCount} onChange={e => setObstacleCount(Number(e.target.value))} style={{ flexGrow:1, maxWidth: '70%', accentColor: '#4CAF50' }} />
                <span>{obstacleCount === 0 ? 'Auto' : obstacleCount}</span>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'row', gap: '4px', marginTop: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#aaa', marginBottom: '4px' }}>
                <span>Laps to Finish</span>
              </div>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                {useVarLaps ? (
                  <select
                    value={lapsVar}
                    onChange={(e) => setLapsVar(e.target.value)}
                    style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #555', borderRadius: '4px', padding: '6px', fontSize: '11px', outline: 'none' }}
                  >
                    <option value="">[Select Variable]</option>
                    {(variables || []).filter(v => v && v.type !== 'group').map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
                  </select>
                ) : (
                  <input
                    type="number"
                    min="1"
                    value={lapsToFinish}
                    onChange={(e) => setLapsToFinish(parseInt(e.target.value) || 1)}
                    style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #555', borderRadius: '4px', padding: '6px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }}
                  />
                )}
                <button
                  type="button"
                  onClick={() => setUseVarLaps(!useVarLaps)}
                  title="Toggle Variable"
                  style={{
                    background: useVarLaps ? '#4CAF50' : '#333',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '3px',
                    padding: '6px 8px',
                    cursor: 'pointer',
                    fontSize: '10px',
                    height: '27px',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  V
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'row', gap: '8px', marginTop: '8px', }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#eee', cursor: 'pointer', userSelect: 'none', padding: '6px 8px', background: '#2a4a2a', borderRadius: '4px', border: '1px solid #4a8a4a' }}>
                <input type="checkbox" checked={mode7Layout} onChange={e => {
                  const checked = e.target.checked;
                  setMode7Layout(checked);
                  if (checked) {
                    setTrackWidth(12);
                    setGenerateCollisions(false);
                  }
                }} style={{ accentColor: '#4CAF50' }} />
                Mode 7 3D Perspective
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#eee', cursor: 'pointer', userSelect: 'none', padding: '6px 8px', background: '#2a4a2a', borderRadius: '4px', border: '1px solid #4a8a4a' }}>
                <input type="checkbox" checked={trackGaps} onChange={e => setTrackGaps(e.target.checked)} style={{ accentColor: '#4CAF50' }} />
                Add Gaps in Track
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#eee', cursor: 'pointer', userSelect: 'none', padding: '6px 8px', background: '#2a4a2a', borderRadius: '4px', border: '1px solid #4a8a4a' }}>
                <input type="checkbox" checked={showCountdown} onChange={e => setShowCountdown(e.target.checked)} style={{ accentColor: '#4CAF50' }} />
                Show Countdown
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: mode7Layout ? '#666' : '#ccc', cursor: mode7Layout ? 'not-allowed' : 'pointer', userSelect: 'none' }}>
                <input type="checkbox" checked={generateCollisions} disabled={mode7Layout} onChange={e => setGenerateCollisions(e.target.checked)} style={{ accentColor: '#4CAF50' }} />
                Generate Collisions & Triggers
              </label>              
            </div>
          </>
        )}

        {sceneType === 'BEATEMUP' && (
          <>
            <div style={{ display: 'flex', flexDirection: 'row', gap: '8px' }}>
              <TileSelector tiles={tiles} value={streetTileId} onChange={setStreetTileId} label="Street" style={{ flexGrow: 1, flexBasis: '50%' }} />
              <TileSelector tiles={tiles} value={curbTileId} onChange={setCurbTileId} label="Curb" style={{ flexGrow: 1, flexBasis: '50%' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'row', gap: '8px' }}>
              <TileSelector tiles={tiles} value={sidewalkTileId} onChange={setSidewalkTileId} label="Sidewalk" style={{ flexGrow: 1, flexBasis: '33%' }} />
              <TileSelector tiles={tiles} value={brickTileId} onChange={setBrickTileId} label="Building Wall 1" style={{ flexGrow: 1, flexBasis: '33%' }} />
              <TileSelector tiles={tiles} value={brick2TileId} onChange={setBrick2TileId} label="Building Wall 2" style={{ flexGrow: 1, flexBasis: '33%' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'row', gap: '8px' }}>
              <TileSelector tiles={tiles} value={windowTileId} onChange={setWindowTileId} label="Window" style={{ flexGrow: 1, flexBasis: '50%' }} />
              <TileSelector tiles={tiles} value={doorTileId} onChange={setDoorTileId} label="Door" style={{ flexGrow: 1, flexBasis: '50%' }} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderTop: '1px solid #3c3c3c', paddingTop: '8px', marginTop: '4px' }}>
              <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '1px' }}>Background</div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <select
                  value={platformBgType}
                  onChange={e => handleBgTypeChange(e.target.value)}
                  style={{
                    background: '#111', color: '#fff', border: '1px solid #444',
                    padding: '4px', fontSize: '12px', outline: 'none', borderRadius: '3px'
                  }}
                >
                  <option value="none">None (Transparent)</option>
                  <option value="solid">Solid Color</option>
                  <option value="clouds">Solid Color + Clouds</option>
                  <option value="starry">Starry Night Sky</option>
                </select>

                {(platformBgType === 'solid' || platformBgType === 'clouds') && (
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '12px', color: '#aaa' }}>Sky:</span>
                      <PaletteColorPicker
                        selectedColor={platformSkyColor}
                        onChange={setPlatformSkyColor}
                        recentColors={recentColors || []}
                        label="Sky Color"
                        allowTransparent={false}
                      />
                    </div>
                    {platformBgType === 'clouds' && (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '12px', color: '#aaa' }}>Cloud Main:</span>
                          <PaletteColorPicker
                            selectedColor={platformCloudColor1}
                            onChange={setPlatformCloudColor1}
                            recentColors={recentColors || []}
                            label="Cloud Main Color"
                            allowTransparent={false}
                          />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '12px', color: '#aaa' }}>Cloud Accent:</span>
                          <PaletteColorPicker
                            selectedColor={platformCloudColor2}
                            onChange={setPlatformCloudColor2}
                            recentColors={recentColors || []}
                            label="Cloud Accent Color"
                            allowTransparent={false}
                          />
                        </div>
                      </>
                    )}
                  </div>
                )}

                {platformBgType === 'starry' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '12px', color: '#aaa' }}>Sky:</span>
                        <PaletteColorPicker
                          selectedColor={platformSkyColor}
                          onChange={setPlatformSkyColor}
                          recentColors={recentColors || []}
                          label="Sky Color"
                          allowTransparent={false}
                        />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '12px', color: '#aaa' }}>Stars:</span>
                        <PaletteColorPicker
                          selectedColor={platformStarColor}
                          onChange={setPlatformStarColor}
                          recentColors={recentColors || []}
                          label="Star Color"
                          allowTransparent={false}
                        />
                      </div>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px', color: '#ccc' }}>
                        <input
                          type="checkbox"
                          checked={platformPlanets}
                          onChange={e => setPlatformPlanets(e.target.checked)}
                          style={{ accentColor: '#4CAF50' }}
                        />
                        Add Planets
                      </label>

                      {platformPlanets && (
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', paddingLeft: '20px' }}>
                          <span style={{ fontSize: '11px', color: '#aaa' }}>Max Planet Size:</span>
                          <input
                            type="range"
                            min="2"
                            max="8"
                            value={platformMaxPlanetSize}
                            onChange={e => setPlatformMaxPlanetSize(Number(e.target.value))}
                            style={{ flexGrow: 1, accentColor: '#4CAF50' }}
                          />
                          <span style={{ fontSize: '11px', color: '#ccc' }}>{platformMaxPlanetSize} tiles</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#ccc', cursor: 'pointer', userSelect: 'none', marginTop: '8px' }}>
              <input type="checkbox" checked={generateCollisions} onChange={e => setGenerateCollisions(e.target.checked)} style={{ accentColor: '#4CAF50' }} />
              Generate Collisions & Triggers
            </label>
          </>
        )}

        {sceneType === 'POINTNCLICK' && (
          <>
          <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'center', fontSize: '12px', color: '#aaa', marginBottom: '4px', gap: '10px' }}>

            
              <div style={{ fontSize: '12px', color: '#aaa', marginBottom: '4px' }}>Border Color</div>
              <PaletteColorPicker
                selectedColor={borderColor}
                onChange={setBorderColor}
                recentColors={recentColors || []}
                label="Border Color"
                allowTransparent={false}
              />
            

            <div style={{ display: 'flex', flexDirection: 'row', gap: '8px' }}>
              <TileSelector tiles={tiles} value={fillTileId} onChange={setFillTileId} label="Fill Tile" style={{ flexGrow: 1, flexBasis: '50%' }} />
            </div>

          </div>
            
            <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#aaa', marginBottom: '4px' }}>
                  <span>Extra Bottom Border Rows</span>
                  <input type="range" min="0" max="10" value={bottomThickness} onChange={e => setBottomThickness(Number(e.target.value))} style={{ flexGrow:1, maxWidth: '70%', accentColor: '#4CAF50' }} />
                  <span>{(2 + bottomThickness)} tiles</span>
                </div>
              </div>
            </div>
            
          </>
        )}

        {sceneType === 'SHMUP' && (
          <>
            <div>
              <div style={{ fontSize: '12px', color: '#aaa', marginBottom: '4px' }}>Background</div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '4px', flexWrap: 'wrap' }}>
              <select
                value={shmupBgType}
                onChange={e => setShmupBgType(e.target.value)}
                style={{
                  background: '#111', color: '#fff', border: '1px solid #444',
                  padding: '4px', fontSize: '12px', outline: 'none', borderRadius: '3px'
                }}
              >
                <option value="none">None (Transparent)</option>
                <option value="clouds">Clouds Only</option>
                <option value="sky_clouds">Sky + Clouds</option>
                <option value="starry">Starry Night</option>
              </select>
            

            {(shmupBgType === 'sky_clouds') && (
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '12px', color: '#aaa' }}>Sky:</span>
                  <PaletteColorPicker
                    selectedColor={shmupSkyColor}
                    onChange={setShmupSkyColor}
                    recentColors={recentColors || []}
                    label="Sky Color"
                    allowTransparent={false}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '12px', color: '#aaa' }}>Cloud Main:</span>
                  <PaletteColorPicker
                    selectedColor={shmupCloudColor1}
                    onChange={setShmupCloudColor1}
                    recentColors={recentColors || []}
                    label="Cloud Main Color"
                    allowTransparent={false}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '12px', color: '#aaa' }}>Cloud Accent:</span>
                  <PaletteColorPicker
                    selectedColor={shmupCloudColor2}
                    onChange={setShmupCloudColor2}
                    recentColors={recentColors || []}
                    label="Cloud Accent Color"
                    allowTransparent={false}
                  />
                </div>
              </div>
            )}

            {shmupBgType === 'clouds' && (
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '12px', color: '#aaa' }}>Cloud Main:</span>
                  <PaletteColorPicker
                    selectedColor={shmupCloudColor1}
                    onChange={setShmupCloudColor1}
                    recentColors={recentColors || []}
                    label="Cloud Main Color"
                    allowTransparent={false}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '12px', color: '#aaa' }}>Cloud Accent:</span>
                  <PaletteColorPicker
                    selectedColor={shmupCloudColor2}
                    onChange={setShmupCloudColor2}
                    recentColors={recentColors || []}
                    label="Cloud Accent Color"
                    allowTransparent={false}
                  />
                </div>
              </div>
            )}

            {shmupBgType === 'starry' && (
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '12px', color: '#aaa' }}>Sky:</span>
                  <PaletteColorPicker
                    selectedColor={shmupNightSkyColor}
                    onChange={setShmupNightSkyColor}
                    recentColors={recentColors || []}
                    label="Sky Color"
                    allowTransparent={false}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '12px', color: '#aaa' }}>Stars:</span>
                  <PaletteColorPicker
                    selectedColor={shmupStarColor}
                    onChange={setShmupStarColor}
                    recentColors={recentColors || []}
                    label="Star Color"
                    allowTransparent={false}
                  />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px', color: '#ccc' }}>
                  <input
                    type="checkbox"
                    checked={shmupPlanets}
                    onChange={e => setShmupPlanets(e.target.checked)}
                    style={{ accentColor: '#4CAF50' }}
                  />
                  Add Planets
                </label>
                {shmupPlanets && (
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', paddingLeft: '20px' }}>
                    <span style={{ fontSize: '11px', color: '#aaa' }}>Max Planet Size:</span>
                    <input
                      type="range"
                      min="2"
                      max="8"
                      value={shmupMaxPlanetSize}
                      onChange={e => setShmupMaxPlanetSize(Number(e.target.value))}
                      style={{ flexGrow: 1, maxWidth: '120px', accentColor: '#4CAF50' }}
                    />
                    <span style={{ fontSize: '11px', color: '#fff', fontWeight: 'bold' }}>
                      {shmupMaxPlanetSize} tiles
                    </span>
                  </div>
                )}
              </div>
            )}
</div>
</div>
            <div style={{ display: 'flex', flexDirection: 'row', gap: '8px', marginTop: '8px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#eee', cursor: 'pointer', userSelect: 'none', padding: '6px 8px', background: '#2a4a2a', borderRadius: '4px', border: '1px solid #4a8a4a' }}>
                <input type="checkbox" checked={mode7Layout} onChange={e => {
                  const checked = e.target.checked;
                  setMode7Layout(checked);
                  if (checked) {
                    setShmupTopDown(true);
                    setGenerateCollisions(false);
                  }
                }} style={{ accentColor: '#4CAF50' }} />
                Mode 7 3D Perspective
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: mode7Layout ? '#666' : '#ccc', cursor: mode7Layout ? 'not-allowed' : 'pointer', userSelect: 'none' }}>
                <input type="checkbox" checked={shmupTopDown || mode7Layout} disabled={mode7Layout} onChange={e => {
                  const checked = e.target.checked;
                  setShmupTopDown(checked);
                  if (checked) {
                    setGenerateCollisions(false);
                  }
                }} style={{ accentColor: '#4CAF50' }} />
                Top Down View (Birds Eye)
              </label>
            </div>

            {(shmupBgType === 'clouds' || shmupBgType === 'sky_clouds') && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#ccc', cursor: 'pointer', userSelect: 'none' }}>
                  <input type="checkbox" checked={shmupGround} onChange={e => setShmupGround(e.target.checked)} style={{ accentColor: '#4CAF50' }} />
                  Add Ground below Clouds
                </label>
                {shmupGround && (
                  <div style={{ display: 'flex', flexDirection: 'row', gap: '8px', marginTop: '4px' }}>
                    <TileSelector tiles={tiles} value={shmupGroundTileId} onChange={setShmupGroundTileId} label="Ground Tile" style={{ flexGrow: 1, flexBasis: '50%' }} />
                    <TileSelector tiles={tiles} value={shmupWaterTileId} onChange={setShmupWaterTileId} label="Water Tile" style={{ flexGrow: 1, flexBasis: '50%' }} />
                  </div>
                )}
              </div>
            )}

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: (shmupTopDown || mode7Layout) ? '#666' : '#ccc', cursor: (shmupTopDown || mode7Layout) ? 'not-allowed' : 'pointer', userSelect: 'none', marginTop: '4px' }}>
              <input type="checkbox" checked={!shmupTopDown && !mode7Layout && generateCollisions} disabled={shmupTopDown || mode7Layout} onChange={e => setGenerateCollisions(e.target.checked)} style={{ accentColor: '#4CAF50' }} />
              Generate Collisions & Triggers
            </label>
          </>
        )}

        {sceneType === 'INTRO' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: '#1e1e20', padding: '16px', borderRadius: '6px', border: '1px solid #333' }}>
            <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#fff', borderBottom: '1px solid #2a2a2c', paddingBottom: '6px', marginBottom: '4px' }}>
              Intro/Logo Image Settings
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'row', gap: '12px'}}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#ccc', cursor: 'pointer', userSelect: 'none' }}>
              <input
                type="checkbox"
                checked={introUseLpLogo}
                onChange={e => setIntroUseLpLogo(e.target.checked)}
                style={{ accentColor: '#4CAF50' }}
              />
              Use Lifted Pixel Logo
            </label>
            
            {!introUseLpLogo && (
              <div style={{ marginLeft: '10px', display: 'flex', flexDirection: 'row', gap: '6px', flexGrow: 1 }}>
                
                <input
                  type="file"
                  accept="image/*"
                  onChange={e => {
                    const file = e.target.files[0];
                    if (file) {
                      setIntroImgName(file.name);
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        setIntroImgData(event.target.result);
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  style={{
                    background: '#111',
                    color: '#fff',
                    border: '1px solid #444',
                    padding: '6px',
                    fontSize: '12px',
                    borderRadius: '4px',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                />
                {introImgName && (
                  <span style={{ fontSize: '11px', color: '#4CAF50', wordBreak: 'break-all' }}>
                    Selected: {introImgName}
                  </span>
                )}
              </div>
            )}
            </div>
          </div>
        )}

        {sceneType === 'PAUSE' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: '#1e1e20', padding: '16px', borderRadius: '6px', border: '1px solid #333' }}>
            <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#fff', borderBottom: '1px solid #2a2a2c', paddingBottom: '6px', marginBottom: '4px' }}>
              Pause Screen Settings
            </div>
            <div style={{ display: 'flex', flexDirection: 'row', gap: '12px'}}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#ccc', cursor: 'pointer', userSelect: 'none' }}>
              <input
                type="checkbox"
                checked={pauseUseLpPause}
                onChange={e => setPauseUseLpPause(e.target.checked)}
                style={{ accentColor: '#4CAF50' }}
              />
              Use Lifted Pixel Pause Screen
            </label>
            
            {!pauseUseLpPause && (
              <div style={{ marginLeft: '10px', display: 'flex', flexDirection: 'row', gap: '6px', flexGrow: 1 }}>
                
                <input
                  type="file"
                  accept="image/*"
                  onChange={e => {
                    const file = e.target.files[0];
                    if (file) {
                      setPauseImgName(file.name);
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        setPauseImgData(event.target.result);
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  style={{
                    background: '#111',
                    color: '#fff',
                    border: '1px solid #444',
                    padding: '6px',
                    fontSize: '12px',
                    borderRadius: '4px',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                />
                {pauseImgName && (
                  <span style={{ fontSize: '11px', color: '#4CAF50', wordBreak: 'break-all' }}>
                    Selected: {pauseImgName}
                  </span>
                )}
              </div>
            )}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px', marginTop: '12px', justifyContent: 'flex-end' }}>
          <button
            onClick={handleGenerate}
            style={{
              background: '#4CAF50', color: '#fff', border: 'none', borderRadius: '4px',
              padding: '10px 24px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px'
            }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#45a049'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = '#4CAF50'}
          >
            Generate
          </button>
          <button
            onClick={onClose}
            style={{
              background: 'transparent', color: '#aaa', border: '1px solid #555', borderRadius: '4px',
              padding: '10px 24px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px'
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = '#888'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#aaa'; e.currentTarget.style.borderColor = '#555'; }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dialogs;
