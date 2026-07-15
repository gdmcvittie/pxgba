import { useState } from 'react';
import { usePxShop } from '../context/PxShopContext';
import {
  BsFileEarmark, BsFolder2Open, BsFloppy2Fill,
  BsGrid3X3GapFill, BsFiles, BsInfoCircle, BsPencilFill, BsBrush, BsEraserFill,
  BsPaintBucket, BsCircleHalf, BsSlashLg, BsSquare, BsSquareFill, BsPersonFill,
  BsCircle, BsCircleFill, BsFullscreen, BsMagic, BsArrowsExpand, BsCrop, BsGeoAltFill, BsLightningChargeFill,
  BsBorderOuter, BsType, BsUpload, BsBoundingBox, BsStars,
  BsInfo
} from 'react-icons/bs';
import { LuStamp as LuStampIcon } from 'react-icons/lu';
import { GiStamper, GiLasso } from 'react-icons/gi';
import { FaHandPaper, FaMousePointer } from 'react-icons/fa';
import { ImPacman, ImMan } from "react-icons/im";
import { RiCheckboxBlankLine, RiCheckboxBlankFill, RiDragMove2Line, RiDragMoveFill } from 'react-icons/ri';
import { HiAdjustmentsHorizontal } from 'react-icons/hi2';
import { TbButterfly, TbButterflyFilled } from 'react-icons/tb';
import TextSettings from './TextSettings';

const Toolbar = () => {
  const [showExportGameAssetsMenu, setShowExportGameAssetsMenu] = useState(false);
  const {
    tool, setTool,
    activeDraw, setActiveDraw,
    showDrawMenu, setShowDrawMenu,
    activeGameTool, setActiveGameTool,
    showGameMenu, setShowGameMenu,
    showFileMenu, setShowFileMenu,
    showImageMenu, setShowImageMenu,
    showShapesMenu, setShowShapesMenu,
    activeShape, setActiveShape,
    showSymmetryMenu, setShowSymmetryMenu,
    symmetryMode, setSymmetryMode,
    showSelectionsMenu, setShowSelectionsMenu,
    activeSelection, setActiveSelection,
    showModifySelectionMenu, setShowModifySelectionMenu,
    activeModifySelection, setActiveModifySelection,
    selection,
    activeFill, setActiveFill,
    showFillsMenu, setShowFillsMenu,

    // Functions
    setShowNewProjectDialog,
    projectInputRef,
    imageInputRef,
    paletteInputRef,
    exportProjectJSON,
    setShowAboutDialog,
    setShowExportDialog,
    isBusy,
    openBCDialog,
    openHSLDialog,
    invertColors,
    openMagicBgDialog,
    openResizeCanvasDialog,
    startTransform,
    openAdjustSelectionDialog,
    cropSelection,
    duplicateSelectionAsLayer,
    outlineSelection,
    fillSelectionWithCollision,
    showAdjustSelectionDialog,
    setShowWizardDialog
  } = usePxShop();

  return (
    <div id="tour-toolbar" style={{ width: '40px', backgroundColor: '#2d2d2d', borderRight: '1px solid #3c3c3c', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 0', gap: '2px', zIndex: 10 }}>
      {/* File Menu */}
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setShowFileMenu(!showFileMenu)}
          style={{ background: showFileMenu ? '#444' : 'transparent', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '12px', padding: '6px 10px', borderRadius: '4px' }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#444'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = showFileMenu ? '#444' : 'transparent'}
          title="File Options"
        >
          <BsFileEarmark size={14} />
        </button>
        <div style={{ height: '1px', background: '#3c3c3c', width: '80%', margin: '10px 0' }} />
        {showFileMenu && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setShowFileMenu(false)} />
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              marginTop: '4px',
              backgroundColor: '#333',
              border: '1px solid #444',
              borderRadius: '4px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
              minWidth: '180px',
              display: 'flex',
              flexDirection: 'column',
              padding: '4px 0',
              zIndex: 100
            }}>
              <button onClick={() => { setShowNewProjectDialog(true); setShowFileMenu(false); }} style={{ background: 'transparent', border: 'none', color: '#fff', padding: '8px 12px', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4CAF50'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}><BsFileEarmark size={14} /> New Project</button>
              <button onClick={() => { setShowNewProjectDialog(false); setShowWizardDialog(true); setShowFileMenu(false); }} style={{ background: 'transparent', border: 'none', color: '#fff', padding: '8px 12px', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4CAF50'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}><BsStars size={14} /> Game Wizard</button>
              <div style={{ height: '1px', background: '#444', margin: '4px 0' }} />
              <button onClick={() => { projectInputRef.current?.click(); setShowFileMenu(false); }} style={{ background: 'transparent', border: 'none', color: '#fff', padding: '8px 12px', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4CAF50'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}><BsFolder2Open size={14} /> Open Project</button>
              <button onClick={() => { exportProjectJSON(); setShowFileMenu(false); }} style={{ background: 'transparent', border: 'none', color: '#fff', padding: '8px 12px', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4CAF50'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}><BsFloppy2Fill size={14} /> Save Project</button>
              <div style={{ height: '1px', background: '#444', margin: '4px 0' }} />
              <button onClick={() => { imageInputRef.current?.click(); setShowFileMenu(false); }} style={{ background: 'transparent', border: 'none', color: '#fff', padding: '8px 12px', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4CAF50'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}><BsUpload size={14} /> Import</button>
              <button onClick={() => { if (!isBusy) setShowExportDialog(true); setShowFileMenu(false); }} style={{ background: 'transparent', border: 'none', color: isBusy ? '#666' : '#fff', padding: '8px 12px', textAlign: 'left', cursor: isBusy ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px', width: '100%', outline: 'none' }} onMouseEnter={(e) => { if (!isBusy) e.currentTarget.style.backgroundColor = '#4CAF50'; }} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}><BsGrid3X3GapFill size={14} /> Export</button>
              <div style={{ height: '1px', background: '#444', margin: '4px 0' }} />
              <button onClick={() => { setShowAboutDialog(true); setShowFileMenu(false); }} style={{ background: 'transparent', border: 'none', color: '#fff', padding: '8px 12px', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4CAF50'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}><BsInfoCircle size={14} /> About</button>
            </div>
          </>
        )}
      </div>

      {/* Image adjustments menu */}
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setShowImageMenu(!showImageMenu)}
          style={{ background: showImageMenu ? '#444' : 'transparent', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '12px', padding: '6px 10px', borderRadius: '4px' }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#444'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = showImageMenu ? '#444' : 'transparent'}
          title="Image Adjustments"
        >
          <HiAdjustmentsHorizontal size={14} />
        </button>
        <div style={{ height: '1px', background: '#3c3c3c', width: '80%', margin: '10px 0' }} />
        {showImageMenu && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setShowImageMenu(false)} />
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              marginTop: '4px',
              backgroundColor: '#333',
              border: '1px solid #444',
              borderRadius: '4px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
              minWidth: '180px',
              display: 'flex',
              flexDirection: 'column',
              padding: '4px 0',
              zIndex: 100
            }}>
              <button onClick={() => { openBCDialog(); setShowImageMenu(false); }} style={{ background: 'transparent', border: 'none', color: '#fff', padding: '8px 12px', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4CAF50'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>Brightness/Contrast</button>
              <button onClick={() => { openHSLDialog(); setShowImageMenu(false); }} style={{ background: 'transparent', border: 'none', color: '#fff', padding: '8px 12px', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4CAF50'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>Hue/Saturation</button>
              <button onClick={() => { invertColors(); setShowImageMenu(false); }} style={{ background: 'transparent', border: 'none', color: '#fff', padding: '8px 12px', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4CAF50'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>Invert</button>
              <button onClick={() => { openMagicBgDialog(); setShowImageMenu(false); }} style={{ background: 'transparent', border: 'none', color: '#fff', padding: '8px 12px', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4CAF50'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>Magic Background Removal</button>
              <div style={{ height: '1px', background: '#444', margin: '4px 0' }} />
              <button onClick={() => { openResizeCanvasDialog(); setShowImageMenu(false); }} style={{ background: 'transparent', border: 'none', color: '#fff', padding: '8px 12px', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4CAF50'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>Resize Canvas...</button>
            </div>
          </>
        )}
      </div>

      {/* Game Tools Menu */}
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => {
            if (['actor', 'trigger', 'spawn', 'collision'].includes(tool)) setShowGameMenu(!showGameMenu);
            else setTool(activeGameTool);
          }}
          onContextMenu={(e) => { e.preventDefault(); setShowGameMenu(!showGameMenu); }}
          style={{ padding: '10px', backgroundColor: 'transparent', border: ['actor', 'trigger', 'spawn', 'collision'].includes(tool) ? '1px solid #4CAF50' : '1px solid #333', color: ['actor', 'trigger', 'spawn', 'collision'].includes(tool) ? '#4CAF50' : '#888', cursor: 'pointer', borderRadius: '5px' }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#4CAF50'; e.currentTarget.style.borderColor = '#4CAF50'; e.currentTarget.style.color = '#fff'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = ['actor', 'trigger', 'spawn', 'collision'].includes(tool) ? '#4CAF50' : '#333'; e.currentTarget.style.color = ['actor', 'trigger', 'spawn', 'collision'].includes(tool) ? '#4CAF50' : '#888'; }}
          title="Game Tools (Click again or Right-click for more)"
        >
          <ImPacman size={14} />
        </button>
        {showGameMenu && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setShowGameMenu(false)} onContextMenu={(e) => { e.preventDefault(); setShowGameMenu(false); }} />
            <div style={{ position: 'absolute', left: '100%', top: 0, marginLeft: '10px', backgroundColor: '#333', border: '1px solid #444', borderRadius: '4px', display: 'flex', gap: '5px', padding: '5px', zIndex: 100, boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
              <button onClick={() => { setActiveGameTool('actor'); setTool('actor'); setShowGameMenu(false); }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#4CAF50'; e.currentTarget.style.borderColor = '#4CAF50'; e.currentTarget.style.color = '#fff'; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = activeGameTool === 'actor' ? '#4CAF50' : '#333'; e.currentTarget.style.color = activeGameTool === 'actor' ? '#4CAF50' : '#888'; }} style={{ padding: '8px', backgroundColor: 'transparent', border: activeGameTool === 'actor' ? '1px solid #4CAF50' : '1px solid #333', color: activeGameTool === 'actor' ? '#4CAF50' : '#888', cursor: 'pointer', borderRadius: '4px' }} title="Place Actor"><ImMan size={14} /></button>
              <button onClick={() => { setActiveGameTool('collision'); setTool('collision'); setShowGameMenu(false); }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#4CAF50'; e.currentTarget.style.borderColor = '#4CAF50'; e.currentTarget.style.color = '#fff'; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = activeGameTool === 'collision' ? '#4CAF50' : '#333'; e.currentTarget.style.color = activeGameTool === 'collision' ? '#4CAF50' : '#888'; }} style={{ padding: '8px', backgroundColor: 'transparent', border: activeGameTool === 'collision' ? '1px solid #4CAF50' : '1px solid #333', color: activeGameTool === 'collision' ? '#4CAF50' : '#888', cursor: 'pointer', borderRadius: '4px' }} title="Place Collision"><BsBoundingBox size={14} /></button>
              <button onClick={() => { setActiveGameTool('trigger'); setTool('trigger'); setShowGameMenu(false); }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#4CAF50'; e.currentTarget.style.borderColor = '#4CAF50'; e.currentTarget.style.color = '#fff'; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = activeGameTool === 'trigger' ? '#4CAF50' : '#333'; e.currentTarget.style.color = activeGameTool === 'trigger' ? '#4CAF50' : '#888'; }} style={{ padding: '8px', backgroundColor: 'transparent', border: activeGameTool === 'trigger' ? '1px solid #4CAF50' : '1px solid #333', color: activeGameTool === 'trigger' ? '#4CAF50' : '#888', cursor: 'pointer', borderRadius: '4px' }} title="Place Trigger"><BsLightningChargeFill size={14} /></button>
              <button onClick={() => { setActiveGameTool('spawn'); setTool('spawn'); setShowGameMenu(false); }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#4CAF50'; e.currentTarget.style.borderColor = '#4CAF50'; e.currentTarget.style.color = '#fff'; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = activeGameTool === 'spawn' ? '#4CAF50' : '#333'; e.currentTarget.style.color = activeGameTool === 'spawn' ? '#4CAF50' : '#888'; }} style={{ padding: '8px', backgroundColor: 'transparent', border: activeGameTool === 'spawn' ? '1px solid #4CAF50' : '1px solid #333', color: activeGameTool === 'spawn' ? '#4CAF50' : '#888', cursor: 'pointer', borderRadius: '4px' }} title="Set Player Spawn"><BsGeoAltFill size={14} /></button>
            </div>
          </>
        )}
      </div>

      <button onClick={() => setTool('cursor')} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#4CAF50'; e.currentTarget.style.borderColor = '#4CAF50'; e.currentTarget.style.color = '#fff'; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = tool === 'cursor' ? '#4CAF50' : '#333'; e.currentTarget.style.color = tool === 'cursor' ? '#4CAF50' : '#888'; }} style={{ padding: '10px', backgroundColor: 'transparent', border: tool === 'cursor' ? '1px solid #4CAF50' : '1px solid #333', color: tool === 'cursor' ? '#4CAF50' : '#888', cursor: 'pointer', borderRadius: '5px' }} title="Select Layer (A)"><FaMousePointer size={12} /></button>
      <button onClick={() => setTool('grab')} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#4CAF50'; e.currentTarget.style.borderColor = '#4CAF50'; e.currentTarget.style.color = '#fff'; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = tool === 'grab' ? '#4CAF50' : '#333'; e.currentTarget.style.color = tool === 'grab' ? '#4CAF50' : '#888'; }} style={{ padding: '10px', backgroundColor: 'transparent', border: tool === 'grab' ? '1px solid #4CAF50' : '1px solid #333', color: tool === 'grab' ? '#4CAF50' : '#888', cursor: 'pointer', borderRadius: '5px' }} title="Grab (H)"><FaHandPaper size={12} /></button>

      {/* Draw Menu */}
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => {
            if (['pen', 'brush', 'eraser', 'tile'].includes(tool)) setShowDrawMenu(!showDrawMenu);
            else setTool(activeDraw);
          }}
          onContextMenu={(e) => { e.preventDefault(); setShowDrawMenu(!showDrawMenu); }}
          style={{ padding: '10px', backgroundColor: 'transparent', border: ['pen', 'brush', 'eraser', 'tile'].includes(tool) ? '1px solid #4CAF50' : '1px solid #333', color: ['pen', 'brush', 'eraser', 'tile'].includes(tool) ? '#4CAF50' : '#888', cursor: 'pointer', borderRadius: '5px' }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#4CAF50'; e.currentTarget.style.borderColor = '#4CAF50'; e.currentTarget.style.color = '#fff'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = ['pen', 'brush', 'eraser', 'tile'].includes(tool) ? '#4CAF50' : '#333'; e.currentTarget.style.color = ['pen', 'brush', 'eraser', 'tile'].includes(tool) ? '#4CAF50' : '#888'; }}
          title="Draw Tools (Click again or Right-click for more)"
        >
          {activeDraw === 'pen' && <BsPencilFill size={12} />}
          {activeDraw === 'brush' && <BsBrush size={12} />}
          {activeDraw === 'eraser' && <BsEraserFill size={12} />}
          {activeDraw === 'tile' && <LuStampIcon size={12} />}
        </button>
        {showDrawMenu && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setShowDrawMenu(false)} onContextMenu={(e) => { e.preventDefault(); setShowDrawMenu(false); }} />
            <div style={{ position: 'absolute', left: '100%', top: 0, marginLeft: '10px', backgroundColor: '#333', border: '1px solid #444', borderRadius: '4px', display: 'flex', gap: '5px', padding: '5px', zIndex: 100, boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
              <button onClick={() => { setActiveDraw('pen'); setTool('pen'); setShowDrawMenu(false); }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#4CAF50'; e.currentTarget.style.borderColor = '#4CAF50'; e.currentTarget.style.color = '#fff'; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = activeDraw === 'pen' ? '#4CAF50' : '#333'; e.currentTarget.style.color = activeDraw === 'pen' ? '#4CAF50' : '#888'; }} style={{ padding: '8px', backgroundColor: 'transparent', border: activeDraw === 'pen' ? '1px solid #4CAF50' : '1px solid #333', color: activeDraw === 'pen' ? '#4CAF50' : '#888', cursor: 'pointer', borderRadius: '4px' }} title="Pen (P)"><BsPencilFill size={14} /></button>
              <button onClick={() => { setActiveDraw('brush'); setTool('brush'); setShowDrawMenu(false); }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#4CAF50'; e.currentTarget.style.borderColor = '#4CAF50'; e.currentTarget.style.color = '#fff'; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = activeDraw === 'brush' ? '#4CAF50' : '#333'; e.currentTarget.style.color = activeDraw === 'brush' ? '#4CAF50' : '#888'; }} style={{ padding: '8px', backgroundColor: 'transparent', border: activeDraw === 'brush' ? '1px solid #4CAF50' : '1px solid #333', color: activeDraw === 'brush' ? '#4CAF50' : '#888', cursor: 'pointer', borderRadius: '4px' }} title="Brush (B)"><BsBrush size={14} /></button>
              <button onClick={() => { setActiveDraw('eraser'); setTool('eraser'); setShowDrawMenu(false); }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#4CAF50'; e.currentTarget.style.borderColor = '#4CAF50'; e.currentTarget.style.color = '#fff'; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = activeDraw === 'eraser' ? '#4CAF50' : '#333'; e.currentTarget.style.color = activeDraw === 'eraser' ? '#4CAF50' : '#888'; }} style={{ padding: '8px', backgroundColor: 'transparent', border: activeDraw === 'eraser' ? '1px solid #4CAF50' : '1px solid #333', color: activeDraw === 'eraser' ? '#4CAF50' : '#888', cursor: 'pointer', borderRadius: '4px' }} title="Eraser (E)"><BsEraserFill size={14} /></button>
              <button onClick={() => { setActiveDraw('tile'); setTool('tile'); setShowDrawMenu(false); }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#4CAF50'; e.currentTarget.style.borderColor = '#4CAF50'; e.currentTarget.style.color = '#fff'; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = activeDraw === 'tile' ? '#4CAF50' : '#333'; e.currentTarget.style.color = activeDraw === 'tile' ? '#4CAF50' : '#888'; }} style={{ padding: '8px', backgroundColor: 'transparent', border: activeDraw === 'tile' ? '1px solid #4CAF50' : '1px solid #333', color: activeDraw === 'tile' ? '#4CAF50' : '#888', cursor: 'pointer', borderRadius: '4px' }} title="Tile Stamp (S)"><LuStampIcon size={14} /></button>
            </div>
          </>
        )}
      </div>


      {/* Fills Menu */}
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => {
            if (['fill', 'gradient', 'tileFill', 'collisionFill'].includes(tool)) setShowFillsMenu(!showFillsMenu);
            else setTool(activeFill);
          }}
          onContextMenu={(e) => { e.preventDefault(); setShowFillsMenu(!showFillsMenu); }}
          style={{ padding: '10px', backgroundColor: 'transparent', border: ['fill', 'gradient', 'tileFill', 'collisionFill'].includes(tool) ? '1px solid #4CAF50' : '1px solid #333', color: ['fill', 'gradient', 'tileFill', 'collisionFill'].includes(tool) ? '#4CAF50' : '#888', cursor: 'pointer', borderRadius: '5px' }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#4CAF50'; e.currentTarget.style.borderColor = '#4CAF50'; e.currentTarget.style.color = '#fff'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = ['fill', 'gradient', 'tileFill', 'collisionFill'].includes(tool) ? '#4CAF50' : '#333'; e.currentTarget.style.color = ['fill', 'gradient', 'tileFill', 'collisionFill'].includes(tool) ? '#4CAF50' : '#888'; }}
          title="Fills (Click again or Right-click for more)"
        >
          {activeFill === 'fill' && <BsPaintBucket size={12} />}
          {activeFill === 'gradient' && <BsCircleHalf size={12} />}
          {activeFill === 'tileFill' && <GiStamper size={12} />}
          {activeFill === 'collisionFill' && <BsBoundingBox size={12} />}
        </button>
        {showFillsMenu && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setShowFillsMenu(false)} onContextMenu={(e) => { e.preventDefault(); setShowFillsMenu(false); }} />
            <div style={{ position: 'absolute', left: '100%', top: 0, marginLeft: '10px', backgroundColor: '#333', border: '1px solid #444', borderRadius: '4px', display: 'flex', gap: '5px', padding: '5px', zIndex: 100, boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
              <button onClick={() => { setActiveFill('fill'); setTool('fill'); setShowFillsMenu(false); }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#4CAF50'; e.currentTarget.style.borderColor = '#4CAF50'; e.currentTarget.style.color = '#fff'; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = activeFill === 'fill' ? '#4CAF50' : '#333'; e.currentTarget.style.color = activeFill === 'fill' ? '#4CAF50' : '#888'; }} style={{ padding: '8px', backgroundColor: 'transparent', border: activeFill === 'fill' ? '1px solid #4CAF50' : '1px solid #333', color: activeFill === 'fill' ? '#4CAF50' : '#888', cursor: 'pointer', borderRadius: '4px' }} title="Fill Bucket (K)"><BsPaintBucket size={14} /></button>
              <button onClick={() => { setActiveFill('gradient'); setTool('gradient'); setShowFillsMenu(false); }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#4CAF50'; e.currentTarget.style.borderColor = '#4CAF50'; e.currentTarget.style.color = '#fff'; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = activeFill === 'gradient' ? '#4CAF50' : '#333'; e.currentTarget.style.color = activeFill === 'gradient' ? '#4CAF50' : '#888'; }} style={{ padding: '8px', backgroundColor: 'transparent', border: activeFill === 'gradient' ? '1px solid #4CAF50' : '1px solid #333', color: activeFill === 'gradient' ? '#4CAF50' : '#888', cursor: 'pointer', borderRadius: '4px' }} title="Linear Gradient (G)"><BsCircleHalf size={14} /></button>
              <button onClick={() => { setActiveFill('tileFill'); setTool('tileFill'); setShowFillsMenu(false); }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#4CAF50'; e.currentTarget.style.borderColor = '#4CAF50'; e.currentTarget.style.color = '#fff'; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = activeFill === 'tileFill' ? '#4CAF50' : '#333'; e.currentTarget.style.color = activeFill === 'tileFill' ? '#4CAF50' : '#888'; }} style={{ padding: '8px', backgroundColor: 'transparent', border: activeFill === 'tileFill' ? '1px solid #4CAF50' : '1px solid #333', color: activeFill === 'tileFill' ? '#4CAF50' : '#888', cursor: 'pointer', borderRadius: '4px' }} title="Tile Fill (F)"><GiStamper size={14} /></button>
              <button onClick={() => { setActiveFill('collisionFill'); setTool('collisionFill'); setShowFillsMenu(false); }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#4CAF50'; e.currentTarget.style.borderColor = '#4CAF50'; e.currentTarget.style.color = '#fff'; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = activeFill === 'collisionFill' ? '#4CAF50' : '#333'; e.currentTarget.style.color = activeFill === 'collisionFill' ? '#4CAF50' : '#888'; }} style={{ padding: '8px', backgroundColor: 'transparent', border: activeFill === 'collisionFill' ? '1px solid #4CAF50' : '1px solid #333', color: activeFill === 'collisionFill' ? '#4CAF50' : '#888', cursor: 'pointer', borderRadius: '4px' }} title="Collision Fill"><BsBoundingBox size={14} /></button>
            </div>
          </>
        )}
      </div>

      {/* Shapes Menu */}
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => {
            if (['drawRect', 'drawRectFill', 'drawRoundRect', 'drawRoundRectFill', 'drawCircle', 'drawCircleFill', 'drawLine'].includes(tool)) setShowShapesMenu(!showShapesMenu);
            else setTool(activeShape);
          }}
          onContextMenu={(e) => { e.preventDefault(); setShowShapesMenu(!showShapesMenu); }}
          style={{ padding: '10px', backgroundColor: 'transparent', border: ['drawRect', 'drawRectFill', 'drawRoundRect', 'drawRoundRectFill', 'drawCircle', 'drawCircleFill', 'drawLine'].includes(tool) ? '1px solid #4CAF50' : '1px solid #333', color: ['drawRect', 'drawRectFill', 'drawRoundRect', 'drawRoundRectFill', 'drawCircle', 'drawCircleFill', 'drawLine'].includes(tool) ? '#4CAF50' : '#888', cursor: 'pointer', borderRadius: '5px' }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#4CAF50'; e.currentTarget.style.borderColor = '#4CAF50'; e.currentTarget.style.color = '#fff'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = ['drawRect', 'drawRectFill', 'drawRoundRect', 'drawRoundRectFill', 'drawCircle', 'drawCircleFill', 'drawLine'].includes(tool) ? '#4CAF50' : '#333'; e.currentTarget.style.color = ['drawRect', 'drawRectFill', 'drawRoundRect', 'drawRoundRectFill', 'drawCircle', 'drawCircleFill', 'drawLine'].includes(tool) ? '#4CAF50' : '#888'; }}
          title="Shapes (Click again or Right-click for more)"
        >
          {activeShape === 'drawLine' && <BsSlashLg size={12} />}
          {activeShape === 'drawRect' && <BsSquare size={12} />}
          {activeShape === 'drawRectFill' && <BsSquareFill size={12} />}
          {activeShape === 'drawRoundRect' && <RiCheckboxBlankLine size={12} />}
          {activeShape === 'drawRoundRectFill' && <RiCheckboxBlankFill size={12} />}
          {activeShape === 'drawCircle' && <BsCircle size={12} />}
          {activeShape === 'drawCircleFill' && <BsCircleFill size={12} />}
        </button>
        {showShapesMenu && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setShowShapesMenu(false)} onContextMenu={(e) => { e.preventDefault(); setShowShapesMenu(false); }} />
            <div style={{ position: 'absolute', left: '100%', top: 0, marginLeft: '10px', backgroundColor: '#333', border: '1px solid #444', borderRadius: '4px', display: 'flex', gap: '5px', padding: '5px', zIndex: 100, boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
              <button onClick={() => { setActiveShape('drawLine'); setTool('drawLine'); setShowShapesMenu(false); }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#4CAF50'; e.currentTarget.style.borderColor = '#4CAF50'; e.currentTarget.style.color = '#fff'; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = activeShape === 'drawLine' ? '#4CAF50' : '#333'; e.currentTarget.style.color = activeShape === 'drawLine' ? '#4CAF50' : '#888'; }} style={{ padding: '8px', backgroundColor: 'transparent', border: activeShape === 'drawLine' ? '1px solid #4CAF50' : '1px solid #333', color: activeShape === 'drawLine' ? '#4CAF50' : '#888', cursor: 'pointer', borderRadius: '4px' }} title="Line"><BsSlashLg size={14} /></button>
              <button onClick={() => { setActiveShape('drawRect'); setTool('drawRect'); setShowShapesMenu(false); }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#4CAF50'; e.currentTarget.style.borderColor = '#4CAF50'; e.currentTarget.style.color = '#fff'; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = activeShape === 'drawRect' ? '#4CAF50' : '#333'; e.currentTarget.style.color = activeShape === 'drawRect' ? '#4CAF50' : '#888'; }} style={{ padding: '8px', backgroundColor: 'transparent', border: activeShape === 'drawRect' ? '1px solid #4CAF50' : '1px solid #333', color: activeShape === 'drawRect' ? '#4CAF50' : '#888', cursor: 'pointer', borderRadius: '4px' }} title="Rectangle Outline"><BsSquare size={14} /></button>
              <button onClick={() => { setActiveShape('drawRectFill'); setTool('drawRectFill'); setShowShapesMenu(false); }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#4CAF50'; e.currentTarget.style.borderColor = '#4CAF50'; e.currentTarget.style.color = '#fff'; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = activeShape === 'drawRectFill' ? '#4CAF50' : '#333'; e.currentTarget.style.color = activeShape === 'drawRectFill' ? '#4CAF50' : '#888'; }} style={{ padding: '8px', backgroundColor: 'transparent', border: activeShape === 'drawRectFill' ? '1px solid #4CAF50' : '1px solid #333', color: activeShape === 'drawRectFill' ? '#4CAF50' : '#888', cursor: 'pointer', borderRadius: '4px' }} title="Filled Rectangle"><BsSquareFill size={14} /></button>
              <button onClick={() => { setActiveShape('drawRoundRect'); setTool('drawRoundRect'); setShowShapesMenu(false); }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#4CAF50'; e.currentTarget.style.borderColor = '#4CAF50'; e.currentTarget.style.color = '#fff'; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = activeShape === 'drawRoundRect' ? '#4CAF50' : '#333'; e.currentTarget.style.color = activeShape === 'drawRoundRect' ? '#4CAF50' : '#888'; }} style={{ padding: '8px', backgroundColor: 'transparent', border: activeShape === 'drawRoundRect' ? '1px solid #4CAF50' : '1px solid #333', color: activeShape === 'drawRoundRect' ? '#4CAF50' : '#888', cursor: 'pointer', borderRadius: '4px' }} title="Rounded Rectangle Outline"><RiCheckboxBlankLine size={14} /></button>
              <button onClick={() => { setActiveShape('drawRoundRectFill'); setTool('drawRoundRectFill'); setShowShapesMenu(false); }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#4CAF50'; e.currentTarget.style.borderColor = '#4CAF50'; e.currentTarget.style.color = '#fff'; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = activeShape === 'drawRoundRectFill' ? '#4CAF50' : '#333'; e.currentTarget.style.color = activeShape === 'drawRoundRectFill' ? '#4CAF50' : '#888'; }} style={{ padding: '8px', backgroundColor: 'transparent', border: activeShape === 'drawRoundRectFill' ? '1px solid #4CAF50' : '1px solid #333', color: activeShape === 'drawRoundRectFill' ? '#4CAF50' : '#888', cursor: 'pointer', borderRadius: '4px' }} title="Filled Rounded Rectangle"><RiCheckboxBlankFill size={14} /></button>
              <button onClick={() => { setActiveShape('drawCircle'); setTool('drawCircle'); setShowShapesMenu(false); }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#4CAF50'; e.currentTarget.style.borderColor = '#4CAF50'; e.currentTarget.style.color = '#fff'; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = activeShape === 'drawCircle' ? '#4CAF50' : '#333'; e.currentTarget.style.color = activeShape === 'drawCircle' ? '#4CAF50' : '#888'; }} style={{ padding: '8px', backgroundColor: 'transparent', border: activeShape === 'drawCircle' ? '1px solid #4CAF50' : '1px solid #333', color: activeShape === 'drawCircle' ? '#4CAF50' : '#888', cursor: 'pointer', borderRadius: '4px' }} title="Circle Outline"><BsCircle size={14} /></button>
              <button onClick={() => { setActiveShape('drawCircleFill'); setTool('drawCircleFill'); setShowShapesMenu(false); }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#4CAF50'; e.currentTarget.style.borderColor = '#4CAF50'; e.currentTarget.style.color = '#fff'; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = activeShape === 'drawCircleFill' ? '#4CAF50' : '#333'; e.currentTarget.style.color = activeShape === 'drawCircleFill' ? '#4CAF50' : '#888'; }} style={{ padding: '8px', backgroundColor: 'transparent', border: activeShape === 'drawCircleFill' ? '1px solid #4CAF50' : '1px solid #333', color: activeShape === 'drawCircleFill' ? '#4CAF50' : '#888', cursor: 'pointer', borderRadius: '4px' }} title="Filled Circle"><BsCircleFill size={14} /></button>
            </div>
          </>
        )}
      </div>

      {/* Symmetry Menu */}
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => {
            if (symmetryMode === 'none') setSymmetryMode('horizontal');
            else setShowSymmetryMenu(!showSymmetryMenu);
          }}
          onContextMenu={(e) => { e.preventDefault(); setShowSymmetryMenu(!showSymmetryMenu); }}
          style={{ padding: '10px', backgroundColor: 'transparent', border: symmetryMode !== 'none' ? '1px solid #4CAF50' : '1px solid #333', color: symmetryMode !== 'none' ? '#4CAF50' : '#888', cursor: 'pointer', borderRadius: '5px' }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#4CAF50'; e.currentTarget.style.borderColor = '#4CAF50'; e.currentTarget.style.color = '#fff'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = symmetryMode !== 'none' ? '#4CAF50' : '#333'; e.currentTarget.style.color = symmetryMode !== 'none' ? '#4CAF50' : '#888'; }}
          title="Symmetry Options (Click again or Right-click for more)"
        >
          <TbButterflyFilled size={12}/>
        </button>
        {showSymmetryMenu && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setShowSymmetryMenu(false)} onContextMenu={(e) => { e.preventDefault(); setShowSymmetryMenu(false); }} />
            <div style={{ position: 'absolute', left: '100%', top: 0, marginLeft: '10px', backgroundColor: '#333', border: '1px solid #444', borderRadius: '4px', display: 'flex', flexDirection: 'column', gap: '5px', padding: '5px', zIndex: 100, boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
              <button onClick={() => { setSymmetryMode('none'); setShowSymmetryMenu(false); }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#4CAF50'; e.currentTarget.style.borderColor = '#4CAF50'; e.currentTarget.style.color = '#fff'; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = symmetryMode === 'none' ? '#4CAF50' : '#333'; e.currentTarget.style.color = symmetryMode === 'none' ? '#4CAF50' : '#888'; }} style={{ padding: '8px', backgroundColor: 'transparent', border: symmetryMode === 'none' ? '1px solid #4CAF50' : '1px solid #333', color: symmetryMode === 'none' ? '#4CAF50' : '#888', cursor: 'pointer', borderRadius: '4px', textAlign: 'left', whiteSpace: 'nowrap' }}>No Symmetry</button>
              <button onClick={() => { setSymmetryMode('horizontal'); setShowSymmetryMenu(false); }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#4CAF50'; e.currentTarget.style.borderColor = '#4CAF50'; e.currentTarget.style.color = '#fff'; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = symmetryMode === 'horizontal' ? '#4CAF50' : '#333'; e.currentTarget.style.color = symmetryMode === 'horizontal' ? '#4CAF50' : '#888'; }} style={{ padding: '8px', backgroundColor: 'transparent', border: symmetryMode === 'horizontal' ? '1px solid #4CAF50' : '1px solid #333', color: symmetryMode === 'horizontal' ? '#4CAF50' : '#888', cursor: 'pointer', borderRadius: '4px', textAlign: 'left', whiteSpace: 'nowrap' }}>Horizontal (Left/Right)</button>
              <button onClick={() => { setSymmetryMode('vertical'); setShowSymmetryMenu(false); }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#4CAF50'; e.currentTarget.style.borderColor = '#4CAF50'; e.currentTarget.style.color = '#fff'; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = symmetryMode === 'vertical' ? '#4CAF50' : '#333'; e.currentTarget.style.color = symmetryMode === 'vertical' ? '#4CAF50' : '#888'; }} style={{ padding: '8px', backgroundColor: 'transparent', border: symmetryMode === 'vertical' ? '1px solid #4CAF50' : '1px solid #333', color: symmetryMode === 'vertical' ? '#4CAF50' : '#888', cursor: 'pointer', borderRadius: '4px', textAlign: 'left', whiteSpace: 'nowrap' }}>Vertical (Top/Bottom)</button>
              <button onClick={() => { setSymmetryMode('both'); setShowSymmetryMenu(false); }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#4CAF50'; e.currentTarget.style.borderColor = '#4CAF50'; e.currentTarget.style.color = '#fff'; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = symmetryMode === 'both' ? '#4CAF50' : '#333'; e.currentTarget.style.color = symmetryMode === 'both' ? '#4CAF50' : '#888'; }} style={{ padding: '8px', backgroundColor: 'transparent', border: symmetryMode === 'both' ? '1px solid #4CAF50' : '1px solid #333', color: symmetryMode === 'both' ? '#4CAF50' : '#888', cursor: 'pointer', borderRadius: '4px', textAlign: 'left', whiteSpace: 'nowrap' }}>4-Way Radial Symmetry</button>
            </div>
          </>
        )}
      </div>

      <div style={{ height: '1px', background: '#3c3c3c', width: '80%', margin: '10px 0' }} />

      {/* Selections Menu */}
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => {
            if (['rect', 'lasso', 'wand'].includes(tool)) setShowSelectionsMenu(!showSelectionsMenu);
            else setTool(activeSelection);
          }}
          onContextMenu={(e) => { e.preventDefault(); setShowSelectionsMenu(!showSelectionsMenu); }}
          style={{ padding: '10px', backgroundColor: 'transparent', border: ['rect', 'lasso', 'wand'].includes(tool) ? '1px solid #4CAF50' : '1px solid #333', color: ['rect', 'lasso', 'wand'].includes(tool) ? '#4CAF50' : '#888', cursor: 'pointer', borderRadius: '5px' }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#4CAF50'; e.currentTarget.style.borderColor = '#4CAF50'; e.currentTarget.style.color = '#fff'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = ['rect', 'lasso', 'wand'].includes(tool) ? '#4CAF50' : '#333'; e.currentTarget.style.color = ['rect', 'lasso', 'wand'].includes(tool) ? '#4CAF50' : '#888'; }}
          title="Selections (Click again or Right-click for more)"
        >
          {activeSelection === 'rect' && <BsFullscreen size={12} />}
          {activeSelection === 'lasso' && <GiLasso size={12} />}
          {activeSelection === 'wand' && <BsMagic size={12} />}
        </button>
        {showSelectionsMenu && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setShowSelectionsMenu(false)} onContextMenu={(e) => { e.preventDefault(); setShowSelectionsMenu(false); }} />
            <div style={{ position: 'absolute', left: '100%', top: 0, marginLeft: '10px', backgroundColor: '#333', border: '1px solid #444', borderRadius: '4px', display: 'flex', gap: '5px', padding: '5px', zIndex: 100, boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
              <button onClick={() => { setActiveSelection('rect'); setTool('rect'); setShowSelectionsMenu(false); }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#4CAF50'; e.currentTarget.style.borderColor = '#4CAF50'; e.currentTarget.style.color = '#fff'; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = activeSelection === 'rect' ? '#4CAF50' : '#333'; e.currentTarget.style.color = activeSelection === 'rect' ? '#4CAF50' : '#888'; }} style={{ padding: '8px', backgroundColor: 'transparent', border: activeSelection === 'rect' ? '1px solid #4CAF50' : '1px solid #333', color: activeSelection === 'rect' ? '#4CAF50' : '#888', cursor: 'pointer', borderRadius: '4px' }} title="Rectangular Selection (R)"><BsFullscreen size={14} /></button>
              <button onClick={() => { setActiveSelection('lasso'); setTool('lasso'); setShowSelectionsMenu(false); }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#4CAF50'; e.currentTarget.style.borderColor = '#4CAF50'; e.currentTarget.style.color = '#fff'; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = activeSelection === 'lasso' ? '#4CAF50' : '#333'; e.currentTarget.style.color = activeSelection === 'lasso' ? '#4CAF50' : '#888'; }} style={{ padding: '8px', backgroundColor: 'transparent', border: activeSelection === 'lasso' ? '1px solid #4CAF50' : '1px solid #333', color: activeSelection === 'lasso' ? '#4CAF50' : '#888', cursor: 'pointer', borderRadius: '4px' }} title="Lasso Selection (L)"><GiLasso size={14} /></button>
              <button onClick={() => { setActiveSelection('wand'); setTool('wand'); setShowSelectionsMenu(false); }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#4CAF50'; e.currentTarget.style.borderColor = '#4CAF50'; e.currentTarget.style.color = '#fff'; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = activeSelection === 'wand' ? '#4CAF50' : '#333'; e.currentTarget.style.color = activeSelection === 'wand' ? '#4CAF50' : '#888'; }} style={{ padding: '8px', backgroundColor: 'transparent', border: activeSelection === 'wand' ? '1px solid #4CAF50' : '1px solid #333', color: activeSelection === 'wand' ? '#4CAF50' : '#888', cursor: 'pointer', borderRadius: '4px' }} title="Magic Wand (W)"><BsMagic size={14} /></button>
            </div>
          </>
        )}
      </div>

      {/* Modify Selection Menu */}
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => {
            if (activeModifySelection === 'transform') startTransform();
            else if (activeModifySelection === 'adjust') openAdjustSelectionDialog();
            else if (activeModifySelection === 'crop') cropSelection();
            else if (activeModifySelection === 'copy') duplicateSelectionAsLayer();
            else if (activeModifySelection === 'outline') outlineSelection();
          }}
          onContextMenu={(e) => { e.preventDefault(); setShowModifySelectionMenu(!showModifySelectionMenu); }}
          disabled={!selection}
          style={{ padding: '10px', backgroundColor: 'transparent', border: (tool === 'transform' || showAdjustSelectionDialog) ? '1px solid #4CAF50' : '1px solid #333', color: selection ? ((tool === 'transform' || showAdjustSelectionDialog) ? '#4CAF50' : '#888') : '#666', cursor: selection ? 'pointer' : 'default', borderRadius: '5px' }}
          onMouseEnter={(e) => { if (selection) { e.currentTarget.style.backgroundColor = '#4CAF50'; e.currentTarget.style.borderColor = '#4CAF50'; e.currentTarget.style.color = '#fff'; } }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = (tool === 'transform' || showAdjustSelectionDialog) ? '#4CAF50' : '#333'; e.currentTarget.style.color = selection ? ((tool === 'transform' || showAdjustSelectionDialog) ? '#4CAF50' : '#888') : '#666'; }}
          title="Modify Selection (Click again or Right-click for more)"
        >
          {activeModifySelection === 'adjust' && <BsBorderOuter size={12} />}
          {activeModifySelection === 'transform' && <BsArrowsExpand size={12} />}
          {activeModifySelection === 'crop' && <BsCrop size={12} />}
          {activeModifySelection === 'copy' && <BsFiles size={12} />}
          {activeModifySelection === 'outline' && <BsSquare size={12} />}
        </button>
        {showModifySelectionMenu && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setShowModifySelectionMenu(false)} onContextMenu={(e) => { e.preventDefault(); setShowModifySelectionMenu(false); }} />
            <div style={{ position: 'absolute', left: '100%', top: 0, marginLeft: '10px', backgroundColor: '#333', border: '1px solid #444', borderRadius: '4px', display: 'flex', gap: '5px', padding: '5px', zIndex: 100, boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
              <button onClick={() => { setActiveModifySelection('transform'); startTransform(); setShowModifySelectionMenu(false); }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#4CAF50'; e.currentTarget.style.borderColor = '#4CAF50'; e.currentTarget.style.color = '#fff'; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = activeModifySelection === 'transform' ? '#4CAF50' : '#333'; e.currentTarget.style.color = activeModifySelection === 'transform' ? '#4CAF50' : '#888'; }} style={{ padding: '8px', backgroundColor: 'transparent', border: activeModifySelection === 'transform' ? '1px solid #4CAF50' : '1px solid #333', color: activeModifySelection === 'transform' ? '#4CAF50' : '#888', cursor: 'pointer', borderRadius: '4px' }} title="Free Transform (Resize)"><BsArrowsExpand size={14} /></button>
              <button onClick={() => { setActiveModifySelection('adjust'); openAdjustSelectionDialog(); setShowModifySelectionMenu(false); }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#4CAF50'; e.currentTarget.style.borderColor = '#4CAF50'; e.currentTarget.style.color = '#fff'; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = activeModifySelection === 'adjust' ? '#4CAF50' : '#333'; e.currentTarget.style.color = activeModifySelection === 'adjust' ? '#4CAF50' : '#888'; }} style={{ padding: '8px', backgroundColor: 'transparent', border: activeModifySelection === 'adjust' ? '1px solid #4CAF50' : '1px solid #333', color: activeModifySelection === 'adjust' ? '#4CAF50' : '#888', cursor: 'pointer', borderRadius: '4px' }} title="Expand/Contract Selection"><BsBorderOuter size={14} /></button>
              <button onClick={() => { setActiveModifySelection('crop'); cropSelection(); setShowModifySelectionMenu(false); }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#4CAF50'; e.currentTarget.style.borderColor = '#4CAF50'; e.currentTarget.style.color = '#fff'; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = activeModifySelection === 'crop' ? '#4CAF50' : '#333'; e.currentTarget.style.color = activeModifySelection === 'crop' ? '#4CAF50' : '#888'; }} style={{ padding: '8px', backgroundColor: 'transparent', border: activeModifySelection === 'crop' ? '1px solid #4CAF50' : '1px solid #333', color: activeModifySelection === 'crop' ? '#4CAF50' : '#888', cursor: 'pointer', borderRadius: '4px' }} title="Crop (C)"><BsCrop size={14} /></button>
              <button onClick={() => { setActiveModifySelection('copy'); duplicateSelectionAsLayer(); setShowModifySelectionMenu(false); }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#4CAF50'; e.currentTarget.style.borderColor = '#4CAF50'; e.currentTarget.style.color = '#fff'; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = activeModifySelection === 'copy' ? '#4CAF50' : '#333'; e.currentTarget.style.color = activeModifySelection === 'copy' ? '#4CAF50' : '#888'; }} style={{ padding: '8px', backgroundColor: 'transparent', border: activeModifySelection === 'copy' ? '1px solid #4CAF50' : '1px solid #333', color: activeModifySelection === 'copy' ? '#4CAF50' : '#888', cursor: 'pointer', borderRadius: '4px' }} title="Layer via Copy (Ctrl+J)"><BsFiles size={14} /></button>
              <button onClick={() => { setActiveModifySelection('outline'); outlineSelection(); setShowModifySelectionMenu(false); }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#4CAF50'; e.currentTarget.style.borderColor = '#4CAF50'; e.currentTarget.style.color = '#fff'; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = activeModifySelection === 'outline' ? '#4CAF50' : '#333'; e.currentTarget.style.color = activeModifySelection === 'outline' ? '#4CAF50' : '#888'; }} style={{ padding: '8px', backgroundColor: 'transparent', border: activeModifySelection === 'outline' ? '1px solid #4CAF50' : '1px solid #333', color: activeModifySelection === 'outline' ? '#4CAF50' : '#888', cursor: 'pointer', borderRadius: '4px' }} title="Outline Selection"><BsSquare size={14} /></button>
            </div>
          </>
        )}
      </div>

      <div style={{ height: '1px', background: '#3c3c3c', width: '80%', margin: '10px 0' }} />
      <button onClick={() => setTool('move')} disabled={!selection} onMouseEnter={(e) => { if (selection) { e.currentTarget.style.backgroundColor = '#4CAF50'; e.currentTarget.style.borderColor = '#4CAF50'; e.currentTarget.style.color = '#fff'; } }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = tool === 'move' ? '#4CAF50' : '#333'; e.currentTarget.style.color = selection ? (tool === 'move' ? '#4CAF50' : '#888') : '#666'; }} style={{ padding: '10px', backgroundColor: 'transparent', border: tool === 'move' ? '1px solid #4CAF50' : '1px solid #333', color: selection ? (tool === 'move' ? '#4CAF50' : '#888') : '#666', cursor: selection ? 'pointer' : 'default', borderRadius: '5px' }} title="Move Selection (M)"><RiDragMoveFill size={12} /></button>
      <button onClick={() => setTool('moveLayer')} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#4CAF50'; e.currentTarget.style.borderColor = '#4CAF50'; e.currentTarget.style.color = '#fff'; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = tool === 'moveLayer' ? '#4CAF50' : '#333'; e.currentTarget.style.color = tool === 'moveLayer' ? '#4CAF50' : '#888'; }} style={{ padding: '10px', backgroundColor: 'transparent', border: tool === 'moveLayer' ? '1px solid #4CAF50' : '1px solid #333', color: tool === 'moveLayer' ? '#4CAF50' : '#888', cursor: 'pointer', borderRadius: '5px' }} title="Move Layer (V)"><RiDragMove2Line size={12} /></button>
      <div style={{ height: '1px', background: '#3c3c3c', width: '80%', margin: '10px 0' }} />
      <div style={{ position: 'relative' }}>
        <button onClick={() => setTool('text')} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#4CAF50'; e.currentTarget.style.borderColor = '#4CAF50'; e.currentTarget.style.color = '#fff'; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = tool === 'text' ? '#4CAF50' : '#333'; e.currentTarget.style.color = tool === 'text' ? '#4CAF50' : '#888'; }} style={{ padding: '10px', backgroundColor: 'transparent', border: tool === 'text' ? '1px solid #4CAF50' : '1px solid #333', color: tool === 'text' ? '#4CAF50' : '#888', cursor: 'pointer', borderRadius: '5px' }} title="Text Tool (T)"><BsType size={12} /></button>
        {tool === 'text' && (
          <div style={{ position: 'absolute', left: '100%', top: '50%', transform: 'translateY(-50%)', marginLeft: '10px', backgroundColor: '#333', border: '1px solid #444', borderRadius: '6px', padding: '12px', zIndex: 1000, boxShadow: '0 4px 16px rgba(0,0,0,0.6)', width: '250px' }}>
            <TextSettings />
          </div>
        )}
      </div>
      <div style={{ height: '1px', background: '#3c3c3c', width: '80%', margin: '10px 0' }} />

      <div style={{ margin: '10px 0', width: '80%', height: '1px', backgroundColor: '#3c3c3c' }} />
    </div>
  );
};

export default Toolbar;
