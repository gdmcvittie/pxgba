import { useState } from 'react';
import { createPortal } from 'react-dom';
import { usePxShop } from '../context/PxShopContext';
import {
  BsLayers, BsBoxArrowInDown, BsFolder2Open, BsCardImage, BsPlus,
  BsEye, BsEyeSlash, BsFiles, BsTrash, BsType, BsStars, BsLayerBackward, BsDownload,
  BsChevronDown, BsChevronRight
} from 'react-icons/bs';

const LayersPanel = ({ isCollapsed, onToggle, dragProps }) => {
  const {
    viewActiveOnly, setViewActiveOnly,
    flattenLayers,
    addGroup,
    addLayer,
    importLayerInputRef,
    layers, setLayers,
    activeLayerId, setActiveLayerId,
    draggedLayerId,
    dragOverLayerId,
    dragPosition,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    editingLayerId, setEditingLayerId,
    renameLayer,
    handleRenameComplete,
    duplicateLayer,
    moveLayerUp,
    moveLayerDown,
    editLayerText,
    setFxLayerId,
    applyMaskToLayer,
    selection,
    mergeLayerDown,
    exportLayerAsPNG,
    saveHistory,
    setTool
  } = usePxShop();

  const [contextMenu, setContextMenu] = useState(null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: isCollapsed ? 'none' : 1, borderBottom: '2px solid #222', minHeight: 0, background: isCollapsed ? 'transparent' : '#373339' }}>
      <div 
        onClick={onToggle}
        style={{ padding: '15px', borderBottom: isCollapsed ? 'none' : '1px solid #3c3c3c', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'grab', userSelect: 'none', background: '#1f0f2f' }}
        {...dragProps}
      >
        <span style={{ fontWeight: 'bold', fontSize: '11px', textTransform: 'uppercase', color: isCollapsed ? '#aaa' : '#40c9f1', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BsLayers /> Layers
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={e => { if (isCollapsed) { onToggle(); } e.stopPropagation(); }}>
          {!isCollapsed && (
            <>
              {/* <button onClick={() => setViewActiveOnly(!viewActiveOnly)} title="View Active Layer Only" style={{ backgroundColor: 'transparent', border: viewActiveOnly ? '1px solid #65ff00' : '1px solid #555', color: viewActiveOnly ? '#65ff00' : '#888', padding: '3px 7px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'all 0.2s' }} onMouseEnter={e => { e.currentTarget.style.borderColor = '#65ff00'; e.currentTarget.style.color = '#65ff00'; }} onMouseLeave={e => { e.currentTarget.style.borderColor = viewActiveOnly ? '#65ff00' : '#555'; e.currentTarget.style.color = viewActiveOnly ? '#65ff00' : '#888'; }}><BsLayers /></button> */}
              <button onClick={flattenLayers} title="Flatten Image" style={{ backgroundColor: 'transparent', border: '1px solid #555', color: '#888', padding: '3px 7px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'all 0.2s' }} onMouseEnter={e => { e.currentTarget.style.borderColor = '#0078d4'; e.currentTarget.style.color = '#0078d4'; }} onMouseLeave={e => { e.currentTarget.style.borderColor = '#555'; e.currentTarget.style.color = '#888'; }}><BsBoxArrowInDown /></button>
              <button onClick={addGroup} title="Add Group" style={{ backgroundColor: 'transparent', border: '1px solid #555', color: '#888', padding: '3px 7px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'all 0.2s' }} onMouseEnter={e => { e.currentTarget.style.borderColor = '#ff9800'; e.currentTarget.style.color = '#ff9800'; }} onMouseLeave={e => { e.currentTarget.style.borderColor = '#555'; e.currentTarget.style.color = '#888'; }}><BsFolder2Open /></button>
              <button onClick={() => importLayerInputRef.current?.click()} title="Import to New Layer" style={{ backgroundColor: 'transparent', border: '1px solid #555', color: '#888', padding: '3px 7px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'all 0.2s' }} onMouseEnter={e => { e.currentTarget.style.borderColor = '#40c9f1'; e.currentTarget.style.color = '#40c9f1'; }} onMouseLeave={e => { e.currentTarget.style.borderColor = '#555'; e.currentTarget.style.color = '#888'; }}><BsCardImage /></button>
              <button onClick={addLayer} title="Add Layer" style={{ backgroundColor: 'transparent', border: '1px solid #555', color: '#888', padding: '3px 7px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'all 0.2s' }} onMouseEnter={e => { e.currentTarget.style.borderColor = '#40c9f1'; e.currentTarget.style.color = '#40c9f1'; }} onMouseLeave={e => { e.currentTarget.style.borderColor = '#555'; e.currentTarget.style.color = '#888'; }}><BsPlus /></button>
            </>
          )}
          <div onClick={e => { e.stopPropagation(); onToggle(); }} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            {isCollapsed ? <BsChevronRight style={{ color: '#aaa' }} /> : <BsChevronDown style={{ color: '#aaa' }} />}
          </div>
        </div>
      </div>

      {!isCollapsed && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {layers.map((layer, index) => {
            if (layer.type === 'group') {
              return (
                <div key={layer.id} 
                  draggable
                  onDragStart={(e) => handleDragStart(e, layer.id)}
                  onDragOver={(e) => handleDragOver(e, layer.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, layer.id)}
                  onClick={() => setActiveLayerId(layer.id)} 
                  onDoubleClick={() => { setActiveLayerId(layer.id); setTool('moveLayer'); }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setActiveLayerId(layer.id);
                    setContextMenu({ x: e.clientX, y: e.clientY, layer, index });
                  }}
                  style={{ 
                    opacity: draggedLayerId === layer.id ? 0.5 : 1,
                    display: 'flex', flexDirection: 'column', padding: '8px 10px', 
                    backgroundColor: '#2a2a2a', 
                    borderRadius: '6px', cursor: 'pointer', 
                    border: activeLayerId === layer.id ? '1px solid #ff9800' : (dragOverLayerId === layer.id && dragPosition === 'inside' ? '1px dashed #65ff00' : '1px solid #555'),
                    boxShadow: (dragOverLayerId === layer.id && dragPosition === 'before') ? '0 -2px 0 #65ff00' : (dragOverLayerId === layer.id && dragPosition === 'after') ? '0 2px 0 #65ff00' : 'none',
                    marginTop: '4px'
                  }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <button onClick={(e) => { e.stopPropagation(); setLayers(ls => ls.map(l => l.id === layer.id ? { ...l, isOpen: !l.isOpen } : l)) }} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 0 }}>
                      {layer.isOpen ? '▼' : '▶'}
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setLayers(ls => ls.map(l => l.id === layer.id ? { ...l, visible: !l.visible } : l)) }} style={{ background: 'none', border: 'none', color: layer.visible ? '#fff' : '#666', cursor: 'pointer', padding: 0 }}>
                      {layer.visible ? <BsEye /> : <BsEyeSlash />}
                    </button>
                    {editingLayerId === layer.id ? (
                      <input
                        autoFocus
                        value={layer.name}
                        onChange={(e) => renameLayer(layer.id, e.target.value)}
                        onBlur={handleRenameComplete}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRenameComplete();
                          if (e.key === 'Escape') setEditingLayerId(null);
                        }}
                        style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #ff9800', outline: 'none', padding: '2px', fontSize: '13px', textAlign: 'left' }}
                      />
                    ) : (
                      <span
                        onDoubleClick={(e) => { e.stopPropagation(); setEditingLayerId(layer.id); }}
                        style={{ fontSize: '13px', fontWeight: 'bold', color: layer.isOpen ? '#ff9800' : '#fff', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'left' }}
                      >
                        📁 {layer.name}
                      </span>
                    )}
                    <button title="Duplicate Group" onClick={(e) => duplicateLayer(e, layer.id)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 0 }}><BsFiles size={14} /></button>
                    <button title="Move Up" onClick={(e) => moveLayerUp(e, layer.id)} disabled={index === 0} style={{ background: 'none', border: 'none', color: index === 0 ? '#555' : '#fff', cursor: index === 0 ? 'default' : 'pointer', padding: 0 }}>▲</button>
                    <button title="Move Down" onClick={(e) => moveLayerDown(e, layer.id)} disabled={index === layers.length - 1} style={{ background: 'none', border: 'none', color: index === layers.length - 1 ? '#555' : '#fff', cursor: index === layers.length - 1 ? 'default' : 'pointer', padding: 0 }}>▼</button>
                    <button onClick={(e) => {
                      e.stopPropagation();
                      const nextLayers = layers.filter(l => l.id !== layer.id && String(l.groupId) !== String(layer.id));
                      setLayers(nextLayers);
                      if (activeLayerId === layer.id || String(layers.find(l=>l.id===activeLayerId)?.groupId) === String(layer.id)) {
                        setActiveLayerId(nextLayers.find(l => l.type !== 'group')?.id || nextLayers[0]?.id);
                      }
                      saveHistory("Delete Group", nextLayers);
                    }} style={{ background: 'none', border: 'none', color: '#ff4444', cursor: 'pointer', padding: 0, marginLeft: '5px' }}>
                      <BsTrash />
                    </button>
                  </div>
                </div>
              );
            }

            const group = layer.groupId ? layers.find(l => String(l.id) === String(layer.groupId)) : null;
            if (group && !group.isOpen) return null;

            const hasLayerBelow = layers.slice(index + 1).some(l => l.type !== 'group');

            return (
              <div key={layer.id} 
                draggable
                onDragStart={(e) => handleDragStart(e, layer.id)}
                onDragOver={(e) => handleDragOver(e, layer.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, layer.id)}
                onClick={() => setActiveLayerId(layer.id)} 
                onDoubleClick={() => { setActiveLayerId(layer.id); setTool('moveLayer'); }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setActiveLayerId(layer.id);
                  setContextMenu({ x: e.clientX, y: e.clientY, layer, index });
                }}
                style={{ 
                  opacity: draggedLayerId === layer.id ? 0.5 : 1,
                  marginLeft: layer.groupId ? '15px' : '0', display: 'flex', flexDirection: 'column', padding: '10px', 
                  backgroundColor: activeLayerId === layer.id ? '#3c3c3c' : '#1e1e1e', 
                  borderRadius: '6px', cursor: 'pointer', 
                  border: activeLayerId === layer.id ? '1px solid #40c9f1' : '1px solid transparent',
                  boxShadow: (dragOverLayerId === layer.id && dragPosition === 'before') ? '0 -2px 0 #65ff00' : (dragOverLayerId === layer.id && dragPosition === 'after') ? '0 2px 0 #65ff00' : 'none'
                }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, overflow: 'hidden' }}>
                    <button onClick={(e) => { e.stopPropagation(); setLayers(ls => ls.map(l => l.id === layer.id ? { ...l, visible: !l.visible } : l)) }} style={{ background: 'none', border: 'none', color: (layer.visible && (!viewActiveOnly || layer.id === activeLayerId)) ? '#fff' : '#666', cursor: 'pointer', padding: 0 }}>
                      {(layer.visible && (!viewActiveOnly || layer.id === activeLayerId)) ? <BsEye /> : <BsEyeSlash />}
                    </button>
                    {editingLayerId === layer.id ? (
                      <input
                        autoFocus
                        value={layer.name}
                        onChange={(e) => renameLayer(layer.id, e.target.value)}
                        onBlur={handleRenameComplete}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRenameComplete();
                          if (e.key === 'Escape') setEditingLayerId(null);
                        }}
                        style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #40c9f1', outline: 'none', padding: '2px', fontSize: '13px' }}
                      />
                    ) : (
                      <span
                        onDoubleClick={(e) => { e.stopPropagation(); setEditingLayerId(layer.id); }}
                        style={{ fontSize: '13px', opacity: (layer.visible && (!viewActiveOnly || layer.id === activeLayerId)) ? 1 : 0.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                      >
                        {layer.name}
                      </span>
                    )}
                  </div>
                  {layers.filter(l => l.type !== 'group').length > 1 && (
                    <button onClick={(e) => { 
                      e.stopPropagation(); 
                      const nextLayers = layers.filter(l => l.id !== layer.id);
                      setLayers(nextLayers); 
                      if (activeLayerId === layer.id) setActiveLayerId(nextLayers.find(l=>l.type!=='group')?.id || nextLayers[0]?.id); 
                      saveHistory("Delete Layer", nextLayers);
                    }} style={{ background: 'none', border: 'none', color: '#ff4444', cursor: 'pointer', opacity: 0.8, marginLeft: '5px' }}>
                      <BsTrash />
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', borderTop: '1px solid #444', paddingTop: '8px' }}>
                  <select 
                    value={layer.groupId || ""} 
                    onChange={(e) => {
                      e.stopPropagation();
                    const nextLayers = layers.map(l => l.id === layer.id ? { ...l, groupId: e.target.value ? Number(e.target.value) : null } : l);
                      setLayers(nextLayers);
                      saveHistory("Change Group", nextLayers);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    style={{ background: 'transparent', color: '#aaa', border: '1px solid #444', borderRadius: '3px', maxWidth: '90px', fontSize: '10px', outline: 'none' }}
                  >
                    <option value="">No Group</option>
                    {layers.filter(l => l.type === 'group').map(g => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {layer.textData && (
                       <button title="Edit Text" onClick={(e) => { e.stopPropagation(); editLayerText(layer); }} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 0 }}><BsType size={14} /></button>
                    )}
                    <button title="Layer Effects (FX)" onClick={(e) => { e.stopPropagation(); setFxLayerId(layer.id); }} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 0 }}><BsStars size={14} /></button>
                    <button title="Mask Layer with Selection" onClick={(e) => { e.stopPropagation(); applyMaskToLayer(layer.id); }} disabled={!selection} style={{ background: 'none', border: 'none', color: !selection ? '#555' : '#fff', cursor: !selection ? 'default' : 'pointer', padding: 0 }}>
                      <div style={{ width: '14px', height: '14px', borderRadius: '2px', border: '1px solid currentColor', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'currentColor' }} />
                      </div>
                    </button>
                    <button title="Merge Down" onClick={(e) => { e.stopPropagation(); mergeLayerDown(layer.id); }} disabled={!hasLayerBelow} style={{ background: 'none', border: 'none', color: !hasLayerBelow ? '#555' : '#fff', cursor: !hasLayerBelow ? 'default' : 'pointer', padding: 0 }}><BsLayerBackward size={14} /></button>
                    <button title="Move Up" onClick={(e) => moveLayerUp(e, layer.id)} disabled={index === 0} style={{ background: 'none', border: 'none', color: index === 0 ? '#555' : '#fff', cursor: index === 0 ? 'default' : 'pointer', padding: 0 }}>▲</button>
                    <button title="Move Down" onClick={(e) => moveLayerDown(e, layer.id)} disabled={index === layers.length - 1} style={{ background: 'none', border: 'none', color: index === layers.length - 1 ? '#555' : '#fff', cursor: index === layers.length - 1 ? 'default' : 'pointer', padding: 0 }}>▼</button>
                    <button title="Duplicate Layer" onClick={(e) => duplicateLayer(e, layer.id)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 0 }}><BsFiles size={14} /></button>
                    <button title="Export Layer as PNG" onClick={(e) => { e.stopPropagation(); exportLayerAsPNG(layer); }} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 0 }}><BsDownload size={14} /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Custom Context Menu */}
      {contextMenu && createPortal(
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 99999 }} onClick={() => setContextMenu(null)} onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }} />
          <div style={{ position: 'fixed', top: Math.min(contextMenu.y, window.innerHeight - 300), left: Math.min(contextMenu.x, window.innerWidth - 180), zIndex: 100000, backgroundColor: '#2a2a2a', border: '1px solid #40c9f1', borderRadius: '6px', padding: '6px', display: 'flex', flexDirection: 'column', gap: '2px', minWidth: '160px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
            <div style={{ padding: '4px 8px', fontSize: '11px', color: '#40c9f1', fontWeight: 'bold', borderBottom: '1px solid #444', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {contextMenu.layer.name}
            </div>
            
            <button onClick={() => { setEditingLayerId(contextMenu.layer.id); setContextMenu(null); }} style={{ background: 'transparent', border: 'none', color: '#fff', padding: '6px 12px', textAlign: 'left', cursor: 'pointer', fontSize: '12px', borderRadius: '3px', width: '100%' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#3c3c3c'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>Rename</button>
            <button onClick={(e) => { duplicateLayer(e, contextMenu.layer.id); setContextMenu(null); }} style={{ background: 'transparent', border: 'none', color: '#fff', padding: '6px 12px', textAlign: 'left', cursor: 'pointer', fontSize: '12px', borderRadius: '3px', width: '100%' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#3c3c3c'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>Duplicate</button>
            
            <button disabled={contextMenu.index === 0} onClick={(e) => { moveLayerUp(e, contextMenu.layer.id); setContextMenu(null); }} style={{ background: 'transparent', border: 'none', color: contextMenu.index === 0 ? '#666' : '#fff', padding: '6px 12px', textAlign: 'left', cursor: contextMenu.index === 0 ? 'default' : 'pointer', fontSize: '12px', borderRadius: '3px', width: '100%' }} onMouseEnter={e => { if(contextMenu.index !== 0) e.currentTarget.style.backgroundColor = '#3c3c3c'; }} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>Move Up</button>
            <button disabled={contextMenu.index === layers.length - 1} onClick={(e) => { moveLayerDown(e, contextMenu.layer.id); setContextMenu(null); }} style={{ background: 'transparent', border: 'none', color: contextMenu.index === layers.length - 1 ? '#666' : '#fff', padding: '6px 12px', textAlign: 'left', cursor: contextMenu.index === layers.length - 1 ? 'default' : 'pointer', fontSize: '12px', borderRadius: '3px', width: '100%' }} onMouseEnter={e => { if(contextMenu.index !== layers.length - 1) e.currentTarget.style.backgroundColor = '#3c3c3c'; }} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>Move Down</button>
            
            {contextMenu.layer.type !== 'group' && (
              <>
                <div style={{ height: '1px', background: '#444', margin: '4px 0' }} />
                {contextMenu.layer.textData && <button onClick={() => { editLayerText(contextMenu.layer); setContextMenu(null); }} style={{ background: 'transparent', border: 'none', color: '#fff', padding: '6px 12px', textAlign: 'left', cursor: 'pointer', fontSize: '12px', borderRadius: '3px', width: '100%' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#3c3c3c'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>Edit Text</button>}
                <button onClick={() => { setFxLayerId(contextMenu.layer.id); setContextMenu(null); }} style={{ background: 'transparent', border: 'none', color: '#fff', padding: '6px 12px', textAlign: 'left', cursor: 'pointer', fontSize: '12px', borderRadius: '3px', width: '100%' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#3c3c3c'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>Layer Effects (FX)</button>
                <button disabled={!selection} onClick={() => { applyMaskToLayer(contextMenu.layer.id); setContextMenu(null); }} style={{ background: 'transparent', border: 'none', color: !selection ? '#666' : '#fff', padding: '6px 12px', textAlign: 'left', cursor: !selection ? 'default' : 'pointer', fontSize: '12px', borderRadius: '3px', width: '100%' }} onMouseEnter={e => { if(selection) e.currentTarget.style.backgroundColor = '#3c3c3c'; }} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>Mask with Selection</button>
                <button disabled={!layers.slice(contextMenu.index + 1).some(l => l.type !== 'group')} onClick={() => { mergeLayerDown(contextMenu.layer.id); setContextMenu(null); }} style={{ background: 'transparent', border: 'none', color: !layers.slice(contextMenu.index + 1).some(l => l.type !== 'group') ? '#666' : '#fff', padding: '6px 12px', textAlign: 'left', cursor: !layers.slice(contextMenu.index + 1).some(l => l.type !== 'group') ? 'default' : 'pointer', fontSize: '12px', borderRadius: '3px', width: '100%' }} onMouseEnter={e => { if(layers.slice(contextMenu.index + 1).some(l => l.type !== 'group')) e.currentTarget.style.backgroundColor = '#3c3c3c'; }} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>Merge Down</button>
                <button onClick={(e) => { e.stopPropagation(); exportLayerAsPNG(contextMenu.layer); setContextMenu(null); }} style={{ background: 'transparent', border: 'none', color: '#fff', padding: '6px 12px', textAlign: 'left', cursor: 'pointer', fontSize: '12px', borderRadius: '3px', width: '100%' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#3c3c3c'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>Export as PNG</button>
              </>
            )}

            <div style={{ height: '1px', background: '#444', margin: '4px 0' }} />
            {layers.filter(l => l.type !== 'group').length > 1 && (
              <button onClick={(e) => {
                e.stopPropagation();
                if (contextMenu.layer.type === 'group') {
                  const nextLayers = layers.filter(l => l.id !== contextMenu.layer.id && String(l.groupId) !== String(contextMenu.layer.id));
                  setLayers(nextLayers);
                  if (activeLayerId === contextMenu.layer.id || String(layers.find(l=>l.id===activeLayerId)?.groupId) === String(contextMenu.layer.id)) setActiveLayerId(nextLayers.find(l => l.type !== 'group')?.id || nextLayers[0]?.id);
                  saveHistory("Delete Group", nextLayers);
                } else {
                  const nextLayers = layers.filter(l => l.id !== contextMenu.layer.id);
                  setLayers(nextLayers);
                  if (activeLayerId === contextMenu.layer.id) setActiveLayerId(nextLayers.find(l=>l.type!=='group')?.id || nextLayers[0]?.id);
                  saveHistory("Delete Layer", nextLayers);
                }
                setContextMenu(null);
              }} style={{ background: 'transparent', border: 'none', color: '#ff4444', padding: '6px 12px', textAlign: 'left', cursor: 'pointer', fontSize: '12px', borderRadius: '3px', width: '100%' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#3c3c3c'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>Delete</button>
            )}
          </div>
        </>,
        document.body
      )}
    </div>
  );
};

export default LayersPanel;
