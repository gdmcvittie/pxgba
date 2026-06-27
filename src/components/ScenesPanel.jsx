import { useState } from 'react';
import { usePxShop } from '../context/PxShopContext';
import { BsMap, BsPlus, BsTrash, BsFiles, BsChevronDown, BsChevronRight, BsGlobe, BsCodeSlash, BsFlag, BsFlagFill, BsRobot, BsPencil, BsFolder2Open, BsFolder2 } from 'react-icons/bs';
import { TileSelector } from './Dialogs';
import { toast } from 'react-hot-toast';

const ScenesPanel = ({ isCollapsed, onToggle }) => {
  const [editingSceneId, setEditingSceneId] = useState(null);
  const [editingGroupId, setEditingGroupId] = useState(null);
  const [draggedSceneId, setDraggedSceneId] = useState(null);
  const [dragOverSceneId, setDragOverSceneId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const {
    scenes,
    activeSceneId,
    switchScene,
    addScene,
    deleteScene,
    renameScene,
    duplicateScene,
    setShowMapOverviewDialog,
    setEditingScriptSceneId,
    customScripts,
    setEditingCustomScriptId,
    setScenes,
    saveHistory,
    layers,
    dimensions,
    musicTracks,
    savedTiles,
    setShowLevelGenDialog,
    setLevelGenSceneId,
    setTool,
    setCustomScripts,
    setLayers,
    variables,
    addSceneGroup,
    toggleSceneGroup,
    deleteSceneGroup,
    duplicateSceneGroup,
    renameSceneGroup
  } = usePxShop();

  const [scriptPrompt, setScriptPrompt] = useState(null);
  const [scriptPromptName, setScriptPromptName] = useState('');

  const confirmAddSceneScript = (sceneId, name) => {
    const scene = scenes.find(s => s.id === sceneId);
    const sceneName = scene?.name || 'Unknown Scene';
    const existingGroup = customScripts.find(s => s.type === 'group' && s.name === sceneName);
    let groupId = existingGroup?.id;
    let nextScripts = customScripts;
    if (!existingGroup) {
      const newGroup = {
        id: Date.now() + Math.random(),
        type: 'group',
        name: sceneName,
        isOpen: true
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
    const nextScenes = scenes.map(s => s.id === sceneId ? { ...s, startScriptId: newScript.id } : s);
    setScenes(nextScenes);
    saveHistory("Add Scene Script", layers, dimensions, { customScripts: nextScripts, scenes: nextScenes });
    setEditingCustomScriptId(newScript.id);
    setTool('script');
    setScriptPrompt(null);
  };

  const handleRenameComplete = () => {
    setEditingSceneId(null);
  };

  const handleDragStart = (e, id) => {
    e.dataTransfer.setData('text/plain', id);
    setDraggedSceneId(id);
  };

  const handleDragOver = (e, id) => {
    e.preventDefault();
    if (draggedSceneId && draggedSceneId !== id) {
      setDragOverSceneId(id);
    }
  };

  const handleDragEnd = () => {
    setDraggedSceneId(null);
    setDragOverSceneId(null);
  };

  const handleDrop = (e, targetId) => {
    e.preventDefault();
    if (!draggedSceneId || draggedSceneId === targetId) return;

    const draggedItem = scenes.find(s => s.id === draggedSceneId);
    if (!draggedItem) return;

    const sourceIndex = scenes.findIndex(s => s.id === draggedSceneId);
    const targetIndex = scenes.findIndex(s => s.id === targetId);

    if (sourceIndex !== -1 && targetIndex !== -1) {
      const reorderedScenes = [...scenes];
      const [removed] = reorderedScenes.splice(sourceIndex, 1);

      if (draggedItem.type === 'group') {
        const childIds = scenes.filter(s => String(s.groupId) === String(draggedSceneId)).map(s => s.id);
        const children = reorderedScenes.filter(s => childIds.includes(s.id));
        children.forEach(child => {
          const childIdx = reorderedScenes.findIndex(s => s.id === child.id);
          if (childIdx !== -1) reorderedScenes.splice(childIdx, 1);
        });
        const newTargetIndex = reorderedScenes.findIndex(s => s.id === targetId);
        reorderedScenes.splice(newTargetIndex, 0, removed, ...children);
      } else {
        reorderedScenes.splice(targetIndex, 0, removed);
      }

      setScenes(reorderedScenes);
      saveHistory("Reorder Scenes", layers, dimensions, { scenes: reorderedScenes });
    }

    setDraggedSceneId(null);
    setDragOverSceneId(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: isCollapsed ? 'none' : 1, borderBottom: '2px solid #222', minHeight: 0, background: isCollapsed ? 'transparent' : '#3d3d3d' }}>
      <div 
        onClick={onToggle}
        style={{ padding: '15px', borderBottom: isCollapsed ? 'none' : '1px solid #3c3c3c', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}
      >
        <span style={{ fontWeight: 'bold', fontSize: '11px', textTransform: 'uppercase', color: isCollapsed ? '#aaa' : '#4CAF50', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BsMap /> Scenes
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={e => { if (isCollapsed) { onToggle(); } e.stopPropagation(); }}>
          <button onClick={() => setShowMapOverviewDialog(true)} title="Map Overview" style={{ backgroundColor: '#0078d4', border: 'none', color: '#fff', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><BsGlobe /></button>
          <button onClick={addSceneGroup} title="Add Group" style={{ backgroundColor: '#ff9800', border: 'none', color: '#fff', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><BsFolder2Open /></button>
          <button onClick={addScene} title="Add Scene" style={{ backgroundColor: '#4CAF50', border: 'none', color: '#fff', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><BsPlus /></button>
          <div onClick={e => { e.stopPropagation(); onToggle(); }} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            {isCollapsed ? <BsChevronRight style={{ color: '#aaa' }} /> : <BsChevronDown style={{ color: '#aaa' }} />}
          </div>
        </div>
      </div>
      {!isCollapsed && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value.toLowerCase())}
            placeholder="Search scenes..."
            style={{ flexGrow:1, width: '100%', background: '#111', color: '#fff', border: '1px solid #444', borderRadius: '4px', padding: '6px 8px', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
        {scenes.filter(scene => {
          if (!searchQuery) return true;
          if (scene.type === 'group') {
            if (scene.name.toLowerCase().includes(searchQuery)) return true;
            return scenes.some(s => s.type !== 'group' && String(s.groupId) === String(scene.id) && s.name.toLowerCase().includes(searchQuery));
          }
          return scene.name.toLowerCase().includes(searchQuery);
        }).map((scene) => {
            const actualScenes = scenes.filter(s => s.type !== 'group');

            if (scene.type === 'group') {
              const isDragged = draggedSceneId === scene.id;
              const isDragOver = dragOverSceneId === scene.id;
              const childCount = scenes.filter(s => String(s.groupId) === String(scene.id)).length;

              return (
                <div key={scene.id}
                  draggable={editingGroupId !== scene.id}
                  onDragStart={(e) => handleDragStart(e, scene.id)}
                  onDragOver={(e) => handleDragOver(e, scene.id)}
                  onDragEnd={handleDragEnd}
                  onDrop={(e) => handleDrop(e, scene.id)}
                  style={{
                    display: 'flex', flexDirection: 'column', padding: '8px 10px',
                    backgroundColor: '#2a2a2a',
                    borderRadius: '6px', cursor: 'pointer',
                    opacity: isDragged ? 0.4 : 1,
                    transition: 'border 0.15s, opacity 0.15s',
                    border: isDragOver ? '2px dashed #ff9800' : '1px solid #444'
                  }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleSceneGroup(scene.id); }}
                      style={{ background: 'none', border: 'none', color: '#ff9800', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
                    >
                      {scene.isOpen ? <BsChevronDown size={12} /> : <BsChevronRight size={12} />}
                    </button>
                    <span style={{ color: '#ff9800', display: 'flex', alignItems: 'center' }}>
                      {scene.isOpen ? <BsFolder2Open size={14} /> : <BsFolder2 size={14} />}
                    </span>
                    {editingGroupId === scene.id ? (
                      <input
                        autoFocus
                        value={scene.name}
                        onChange={(e) => renameSceneGroup(scene.id, e.target.value)}
                        onBlur={() => setEditingGroupId(null)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === 'Escape') setEditingGroupId(null);
                        }}
                        onClick={e => e.stopPropagation()}
                        style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #ff9800', outline: 'none', padding: '2px', fontSize: '12px', fontWeight: 'bold' }}
                      />
                    ) : (
                      <span
                        onDoubleClick={(e) => { e.stopPropagation(); setEditingGroupId(scene.id); }}
                        style={{ fontSize: '12px', fontWeight: 'bold', color: '#ff9800', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                      >
                        {scene.name}
                      </span>
                    )}
                    <span style={{ fontSize: '10px', color: '#666' }}>{childCount}</span>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <button title="Duplicate Group" onClick={(e) => { e.stopPropagation(); duplicateSceneGroup(scene.id); }} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}><BsFiles size={12} /></button>
                      <button
                        title={actualScenes.length > 1 ? "Delete Group & Scenes" : "Cannot Delete Last Scene"}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (actualScenes.length > 1) deleteSceneGroup(scene.id);
                        }}
                        style={{
                          background: 'none', border: 'none',
                          color: '#ff4444',
                          cursor: actualScenes.length > 1 ? 'pointer' : 'not-allowed',
                          opacity: actualScenes.length > 1 ? 0.8 : 0.3,
                          display: 'flex', alignItems: 'center', padding: 0
                        }}
                      >
                        <BsTrash size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            }

            const group = scene.groupId ? scenes.find(g => g.type === 'group' && String(g.id) === String(scene.groupId)) : null;
            if (group && !group.isOpen && !searchQuery) return null;

            const hasExplicitStarting = actualScenes.some(s => s.isStarting);
            const isStarting = scene.isStarting || (!hasExplicitStarting && actualScenes[0]?.id === scene.id);
            const isDragged = draggedSceneId === scene.id;
            const isDragOver = dragOverSceneId === scene.id;

            return (
              <div key={scene.id} 
                onClick={() => switchScene(scene.id)} 
                draggable={editingSceneId !== scene.id}
                onDragStart={(e) => handleDragStart(e, scene.id)}
                onDragOver={(e) => handleDragOver(e, scene.id)}
                onDragEnd={handleDragEnd}
                onDrop={(e) => handleDrop(e, scene.id)}
                style={{ 
                  display: 'flex', flexDirection: 'column', padding: '10px', 
                  marginLeft: scene.groupId ? '15px' : '0',
                  backgroundColor: activeSceneId === scene.id ? '#3c3c3c' : '#1e1e1e', 
                  borderRadius: '6px', cursor: 'pointer', 
                  opacity: isDragged ? 0.4 : 1,
                  transition: 'border 0.15s, opacity 0.15s, background-color 0.15s',
                  border: isDragged
                    ? '1px dashed #555'
                    : isDragOver
                    ? '2px dashed #4CAF50'
                    : activeSceneId === scene.id
                    ? '1px solid #4CAF50'
                    : '1px solid transparent'
                }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, overflow: 'hidden' }}>
                    <button
                      title={isStarting ? "Starting Scene" : "Set as Starting Scene"}
                      onClick={(e) => {
                        e.stopPropagation();
                        const nextScenes = scenes.map(s => ({
                          ...s,
                          isStarting: s.id === scene.id
                        }));
                        setScenes(nextScenes);
                        saveHistory("Set Starting Scene", layers, dimensions, { scenes: nextScenes });
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: isStarting ? '#4CAF50' : '#555',
                        cursor: 'pointer',
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center',
                        opacity: isStarting ? 1 : 0.4,
                        transition: 'opacity 0.2s, color 0.2s'
                      }}
                    >
                      {isStarting ? <BsFlagFill size={14} /> : <BsFlag size={14} />}
                    </button>
                    {editingSceneId === scene.id ? (
                      <input
                        autoFocus
                        value={scene.name}
                        onChange={(e) => renameScene(scene.id, e.target.value)}
                        onBlur={handleRenameComplete}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === 'Escape') handleRenameComplete();
                        }}
                        style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #4CAF50', outline: 'none', padding: '2px', fontSize: '13px' }}
                      />
                    ) : (
                      <span
                        onDoubleClick={(e) => { e.stopPropagation(); setEditingSceneId(scene.id); }}
                        style={{ fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                      >
                        {scene.name}
                      </span>
                    )}
                  </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button title="Procedurally Generate Level" onClick={(e) => { e.stopPropagation(); setLevelGenSceneId(scene.id); setShowLevelGenDialog(true); }} style={{ background: 'none', border: 'none', color: '#00e436', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}><BsRobot size={14} /></button>
                  <button title="Duplicate Scene" onClick={(e) => { e.stopPropagation(); duplicateScene(scene.id); }} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}><BsFiles size={14} /></button>
                  <button 
                    title={actualScenes.length > 1 ? "Delete Scene" : "Cannot Delete Last Scene"} 
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      if (actualScenes.length > 1) deleteScene(scene.id);
                    }} 
                    style={{ 
                      background: 'none', 
                      border: 'none', 
                      color: '#ff4444', 
                      cursor: actualScenes.length > 1 ? 'pointer' : 'not-allowed', 
                      opacity: actualScenes.length > 1 ? 0.8 : 0.3,
                      display: 'flex',
                      alignItems: 'center',
                      padding: 0
                    }}
                  >
                    <BsTrash size={14} />
                  </button>
                </div>
              </div>
              {activeSceneId === scene.id && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px', borderTop: '1px solid #333', paddingTop: '10px' }}>
                   <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '10px', color: '#aaa', textAlign: 'left' }}>Group:</label>
                      <select
                        className="nodrag"
                        value={scene.groupId || ''}
                        onChange={(e) => {
                          const newGroupId = e.target.value ? Number(e.target.value) : null;
                          let nextScenes = scenes.map(s => s.id === scene.id ? { ...s, groupId: newGroupId } : s);
                          if (newGroupId) {
                            const movedScene = nextScenes.find(s => s.id === scene.id);
                            nextScenes = nextScenes.filter(s => s.id !== scene.id);
                            const groupIndex = nextScenes.findIndex(s => s.id === newGroupId);
                            if (groupIndex !== -1) {
                              let insertIndex = groupIndex + 1;
                              while (insertIndex < nextScenes.length && nextScenes[insertIndex].groupId === newGroupId) {
                                insertIndex++;
                              }
                              nextScenes.splice(insertIndex, 0, movedScene);
                            }
                          }
                          setScenes(nextScenes);
                          saveHistory("Change Scene Group", layers, dimensions, { scenes: nextScenes });
                        }}
                        style={{
                          width: '100%',
                          background: '#111',
                          color: '#fff',
                          border: '1px solid #555',
                          borderRadius: '4px',
                          padding: '6px',
                          fontSize: '11px',
                          outline: 'none',
                          boxSizing: 'border-box'
                        }}
                      >
                        <option value="">No Group</option>
                        {scenes.filter(s => s.type === 'group').map(g => (
                          <option key={g.id} value={g.id}>{g.name}</option>
                        ))}
                      </select>
                   </div>
                   <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '10px', color: '#aaa', textAlign: 'left' }}>Scene Type:</label>
                      <select
                        className="nodrag"
                        value={scene.type || 'TOPDOWN'}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === 'PAUSE') {
                            const pauseCount = scenes.filter(s => s.type === 'PAUSE' && s.id !== scene.id).length;
                            if (pauseCount > 0) {
                              toast.error('Only one Pause Screen scene is allowed per project.');
                              return;
                            }
                          }
                          const isIntroOrPause = val === 'INTRO' || val === 'PAUSE';
                          const newDims = isIntroOrPause ? { w: 256, h: 256 } : (scene.dimensions || { w: 256, h: 256 });
                          const nextScenes = scenes.map(s => s.id === scene.id ? { ...s, type: val, dimensions: newDims } : s);
                          setScenes(nextScenes);
                          saveHistory("Set Scene Type", layers, dimensions, { scenes: nextScenes });
                        }}
                        style={{
                          width: '100%',
                          background: '#111',
                          color: '#fff',
                          border: '1px solid #555',
                          borderRadius: '4px',
                          padding: '6px',
                          fontSize: '11px',
                          outline: 'none',
                          boxSizing: 'border-box'
                        }}
                      >
                         <option value="TOPDOWN">Top Down</option>
                         <option value="PLATFORMER">Platformer</option>
                         <option value="METROIDVANIA">Metroidvania</option>
                         <option value="POINTNCLICK">Point & Click</option>
                         <option value="SHMUP">Shoot 'Em Up</option>
                         <option value="RACING">Racing</option>
                         <option value="INTRO">Intro/Logo</option>
                         <option value="PAUSE" disabled={scenes.filter(s => s.type === 'PAUSE' && s.id !== scene.id).length > 0}>Pause Screen</option>
                         <option value="BEATEMUP">Beat 'Em Up</option>
                      </select>
                   </div>
                    {scene.type !== 'PLATFORMER' && scene.type !== 'METROIDVANIA' && scene.type !== 'RACING' && scene.type !== 'INTRO' && scene.type !== 'PAUSE' && (
                     <>
                        {scene.type === 'POINTNCLICK' && (
                          <>
                            <TileSelector
                              tiles={savedTiles || []}
                              value={scene.pointerSpriteId ?? 22}
                              onChange={(val) => {
                                const nextScenes = scenes.map(s => s.id === scene.id ? { ...s, pointerSpriteId: val ?? null } : s);
                                setScenes(nextScenes);
                                saveHistory("Set Cursor Sprite", layers, dimensions, { scenes: nextScenes });
                              }}
                              label="Cursor Sprite"
                              style={{ width: '100%' }}
                            />
                            <TileSelector
                              tiles={savedTiles || []}
                              value={scene.pointerHoverSpriteId ?? 23}
                              onChange={(val) => {
                                const nextScenes = scenes.map(s => s.id === scene.id ? { ...s, pointerHoverSpriteId: val ?? null } : s);
                                setScenes(nextScenes);
                                saveHistory("Set Hover Cursor Sprite", layers, dimensions, { scenes: nextScenes });
                              }}
                              label="Hover Cursor Sprite"
                              style={{ width: '100%' }}
                            />
                          </>
                        )}
                       <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '10px', color: '#aaa', textAlign: 'left' }}>Horizontal Speed:</label>
                          <input 
                            className="nodrag" 
                            type="number"
                            step="0.1"
                            value={scene.horizontalSpeed ?? 1.0} 
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              const nextScenes = scenes.map(s => s.id === scene.id ? { ...s, horizontalSpeed: val } : s);
                              setScenes(nextScenes);
                              saveHistory("Set Scene Horizontal Speed", layers, dimensions, { scenes: nextScenes });
                            }}
                            style={{ 
                              width: '100%', 
                              background: '#111', 
                              color: '#fff', 
                              border: '1px solid #555', 
                              borderRadius: '4px', 
                              padding: '6px', 
                              fontSize: '11px', 
                              outline: 'none',
                              boxSizing: 'border-box'
                            }}
                          />
                       </div>
                       <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '10px', color: '#aaa', textAlign: 'left' }}>Vertical Speed:</label>
                          <input 
                            className="nodrag" 
                            type="number"
                            step="0.1"
                            value={scene.verticalSpeed ?? 1.0} 
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              const nextScenes = scenes.map(s => s.id === scene.id ? { ...s, verticalSpeed: val } : s);
                              setScenes(nextScenes);
                              saveHistory("Set Scene Vertical Speed", layers, dimensions, { scenes: nextScenes });
                            }}
                            style={{ 
                              width: '100%', 
                              background: '#111', 
                              color: '#fff', 
                              border: '1px solid #555', 
                              borderRadius: '4px', 
                              padding: '6px', 
                              fontSize: '11px', 
                              outline: 'none',
                              boxSizing: 'border-box'
                            }}
                          />
                       </div>
                       <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '10px', color: '#aaa', textAlign: 'left' }}>Friction (0.01 - 1.0):</label>
                          <input 
                            className="nodrag" 
                            type="number"
                            step="0.05"
                            min="0.01"
                            max="1.0"
                            value={scene.friction ?? 1.0} 
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 1.0;
                              const clampedVal = Math.min(1.0, Math.max(0.01, val));
                              const nextScenes = scenes.map(s => s.id === scene.id ? { ...s, friction: clampedVal } : s);
                              setScenes(nextScenes);
                              saveHistory("Set Scene Friction", layers, dimensions, { scenes: nextScenes });
                            }}
                            style={{ 
                              width: '100%', 
                              background: '#111', 
                              color: '#fff', 
                              border: '1px solid #555', 
                              borderRadius: '4px', 
                              padding: '6px', 
                              fontSize: '11px', 
                              outline: 'none',
                              boxSizing: 'border-box'
                            }}
                          />
                       </div>
                     </>
                   )}
                   {(scene.type === 'PLATFORMER' || scene.type === 'METROIDVANIA') && (
                     <>
                       <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '10px', color: '#aaa', textAlign: 'left' }}>Gravity:</label>
                          <input 
                            className="nodrag" 
                            type="number"
                            step="0.1"
                            value={scene.gravity ?? 0.5} 
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              const nextScenes = scenes.map(s => s.id === scene.id ? { ...s, gravity: val } : s);
                              setScenes(nextScenes);
                              saveHistory("Set Scene Gravity", layers, dimensions, { scenes: nextScenes });
                            }}
                            style={{ 
                              width: '100%', 
                              background: '#111', 
                              color: '#fff', 
                              border: '1px solid #555', 
                              borderRadius: '4px', 
                              padding: '6px', 
                              fontSize: '11px', 
                              outline: 'none',
                              boxSizing: 'border-box'
                            }}
                          />
                       </div>
                       <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '10px', color: '#aaa', textAlign: 'left' }}>Jump Velocity:</label>
                          <input 
                            className="nodrag" 
                            type="number"
                            step="0.1"
                            value={scene.jumpVelocity ?? -5.0} 
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              const nextScenes = scenes.map(s => s.id === scene.id ? { ...s, jumpVelocity: val } : s);
                              setScenes(nextScenes);
                              saveHistory("Set Scene Jump Velocity", layers, dimensions, { scenes: nextScenes });
                            }}
                            style={{ 
                              width: '100%', 
                              background: '#111', 
                              color: '#fff', 
                              border: '1px solid #555', 
                              borderRadius: '4px', 
                              padding: '6px', 
                              fontSize: '11px', 
                              outline: 'none',
                              boxSizing: 'border-box'
                            }}
                          />
                       </div>
                       <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '10px', color: '#aaa', textAlign: 'left' }}>Horizontal Speed:</label>
                          <input 
                            className="nodrag" 
                            type="number"
                            step="0.1"
                            value={scene.horizontalSpeed ?? 1.5} 
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              const nextScenes = scenes.map(s => s.id === scene.id ? { ...s, horizontalSpeed: val } : s);
                              setScenes(nextScenes);
                              saveHistory("Set Scene Horizontal Speed", layers, dimensions, { scenes: nextScenes });
                            }}
                            style={{ 
                              width: '100%', 
                              background: '#111', 
                              color: '#fff', 
                              border: '1px solid #555', 
                              borderRadius: '4px', 
                              padding: '6px', 
                              fontSize: '11px', 
                              outline: 'none',
                              boxSizing: 'border-box'
                            }}
                          />
                       </div>
                       <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '10px', color: '#aaa', textAlign: 'left' }}>Max Fall Velocity:</label>
                          <input 
                            className="nodrag" 
                            type="number"
                            step="0.1"
                            value={scene.maxFallVelocity ?? 8.0} 
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              const nextScenes = scenes.map(s => s.id === scene.id ? { ...s, maxFallVelocity: val } : s);
                              setScenes(nextScenes);
                              saveHistory("Set Scene Max Fall", layers, dimensions, { scenes: nextScenes });
                            }}
                            style={{ 
                              width: '100%', 
                              background: '#111', 
                              color: '#fff', 
                              border: '1px solid #555', 
                              borderRadius: '4px', 
                              padding: '6px', 
                              fontSize: '11px', 
                              outline: 'none',
                              boxSizing: 'border-box'
                            }}
                          />
                       </div>
                       <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '10px', color: '#aaa', textAlign: 'left' }}>Friction (0.01 - 1.0):</label>
                          <input 
                            className="nodrag" 
                            type="number"
                            step="0.05"
                            min="0.01"
                            max="1.0"
                            value={scene.friction ?? 1.0} 
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 1.0;
                              const clampedVal = Math.min(1.0, Math.max(0.01, val));
                              const nextScenes = scenes.map(s => s.id === scene.id ? { ...s, friction: clampedVal } : s);
                              setScenes(nextScenes);
                              saveHistory("Set Scene Friction", layers, dimensions, { scenes: nextScenes });
                            }}
                            style={{ 
                              width: '100%', 
                              background: '#111', 
                              color: '#fff', 
                              border: '1px solid #555', 
                              borderRadius: '4px', 
                              padding: '6px', 
                              fontSize: '11px', 
                              outline: 'none',
                              boxSizing: 'border-box'
                            }}
                          />
                       </div>
                     </>
                   )}
                    {(scene.type === 'SHMUP' || scene.type === 'BEATEMUP') && (
                      <>
                        {scene.type === 'SHMUP' && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                             <label style={{ fontSize: '10px', color: '#aaa', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <input type="checkbox" className="nodrag" checked={!!scene.mode7} onChange={(e) => {
                                  const val = e.target.checked;
                                  const nextScenes = scenes.map(s => s.id === scene.id ? { ...s, mode7: val } : s);
                                  setScenes(nextScenes);
                                  saveHistory("Toggle Mode 7", layers, dimensions, { scenes: nextScenes });
                                }} /> Mode 7 (3D Perspective)
                             </label>
                          </div>
                        )}
                         <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={{ fontSize: '10px', color: '#aaa', textAlign: 'left' }}>Auto Scroll:</label>
                            <select className="nodrag" value={scene.autoScroll === false ? 'off' : scene.autoScroll === 'horizontal' ? 'horizontal' : 'vertical'} onChange={(e) => {
                              const val = e.target.value === 'off' ? false : e.target.value;
                              const nextScenes = scenes.map(s => s.id === scene.id ? { ...s, autoScroll: val } : s);
                              setScenes(nextScenes);
                              saveHistory("Set Auto Scroll", layers, dimensions, { scenes: nextScenes });
                            }}
                            style={{ width: '100%', background: '#111', color: '#fff', border: '1px solid #555', borderRadius: '4px', padding: '6px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }}>
                              <option value="off">Off</option>
                              <option value="vertical">Vertical</option>
                              <option value="horizontal">Horizontal</option>
                            </select>
                         </div>
                          {scene.autoScroll !== false && (
                          <>
                         <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={{ fontSize: '10px', color: '#aaa', textAlign: 'left' }}>Scroll Speed X:</label>
                           <input 
                             className="nodrag" 
                             type="number"
                             step="0.1"
                             value={scene.scrollSpeedX ?? 0.0} 
                             onChange={(e) => {
                               const val = parseFloat(e.target.value) || 0;
                               const nextScenes = scenes.map(s => s.id === scene.id ? { ...s, scrollSpeedX: val } : s);
                               setScenes(nextScenes);
                               saveHistory("Set Scene Scroll Speed X", layers, dimensions, { scenes: nextScenes });
                             }}
                             style={{ 
                               width: '100%', 
                               background: '#111', 
                               color: '#fff', 
                               border: '1px solid #555', 
                               borderRadius: '4px', 
                               padding: '6px', 
                               fontSize: '11px', 
                               outline: 'none',
                               boxSizing: 'border-box'
                             }}
                           />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                           <label style={{ fontSize: '10px', color: '#aaa', textAlign: 'left' }}>Scroll Speed Y:</label>
                           <input 
                             className="nodrag" 
                             type="number"
                             step="0.1"
                             value={scene.scrollSpeedY ?? 0.0} 
                             onChange={(e) => {
                               const val = parseFloat(e.target.value) || 0;
                               const nextScenes = scenes.map(s => s.id === scene.id ? { ...s, scrollSpeedY: val } : s);
                               setScenes(nextScenes);
                               saveHistory("Set Scene Scroll Speed Y", layers, dimensions, { scenes: nextScenes });
                             }}
                             style={{ 
                               width: '100%', 
                               background: '#111', 
                               color: '#fff', 
                               border: '1px solid #555', 
                               borderRadius: '4px', 
                               padding: '6px', 
                               fontSize: '11px', 
                               outline: 'none',
                               boxSizing: 'border-box'
                             }}
                           />
                        </div>
                          </>
                        )}
                      </>
                    )}
                     {scene.type === 'RACING' && (
                       <>
                         <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <label style={{ fontSize: '10px', color: '#aaa', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                               <input type="checkbox" className="nodrag" checked={!!scene.mode7} onChange={(e) => {
                                 const val = e.target.checked;
                                 const nextScenes = scenes.map(s => {
                                   if (s.id === scene.id) {
                                     return {
                                       ...s,
                                       mode7: val,
                                       frames: s.frames.map(f => ({
                                         ...f,
                                         layers: f.layers.map(l =>
                                           l.name === 'Level Design'
                                             ? { ...l, mode7: val ? true : undefined, affine: val ? true : undefined }
                                             : l
                                         )
                                       }))
                                     };
                                   }
                                   return s;
                                 });
                                 setScenes(nextScenes);
                                 saveHistory("Toggle Mode 7", layers, dimensions, { scenes: nextScenes });
                                 if (scene.id === activeSceneId) {
                                   setLayers(layers.map(l =>
                                     l.name === 'Level Design'
                                       ? { ...l, mode7: val ? true : undefined, affine: val ? true : undefined }
                                       : l
                                   ));
                                 }
                               }} /> Mode 7 (3D Perspective)
                            </label>
                         </div>
                         <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '10px', color: '#aaa', textAlign: 'left' }}>Max Speed:</label>
                          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                            {scene.useVarMaxSpeed ? (
                              <select
                                className="nodrag"
                                value={scene.maxSpeedVar || ''}
                                onChange={(e) => {
                                  const nextScenes = scenes.map(s => s.id === scene.id ? { ...s, maxSpeedVar: e.target.value } : s);
                                  setScenes(nextScenes);
                                  saveHistory("Set Scene Max Speed Variable", layers, dimensions, { scenes: nextScenes });
                                }}
                                style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #555', borderRadius: '4px', padding: '6px', fontSize: '11px', outline: 'none' }}
                              >
                                <option value="">[Select Variable]</option>
                                {variables.filter(v => v.type !== 'group').map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
                              </select>
                            ) : (
                              <input 
                                className="nodrag" 
                                type="number"
                                step="0.1"
                                value={scene.maxSpeed ?? 1.0} 
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  const nextScenes = scenes.map(s => s.id === scene.id ? { ...s, maxSpeed: val } : s);
                                  setScenes(nextScenes);
                                  saveHistory("Set Scene Max Speed", layers, dimensions, { scenes: nextScenes });
                                }}
                                style={{ 
                                  flex: 1, 
                                  background: '#111', 
                                  color: '#fff', 
                                  border: '1px solid #555', 
                                  borderRadius: '4px', 
                                  padding: '6px', 
                                  fontSize: '11px', 
                                  outline: 'none',
                                  boxSizing: 'border-box'
                                }}
                              />
                            )}
                            <button
                              className="nodrag"
                              onClick={(e) => {
                                e.stopPropagation();
                                const useVar = !(scene.useVarMaxSpeed ?? false);
                                const nextScenes = scenes.map(s => s.id === scene.id ? { ...s, useVarMaxSpeed: useVar } : s);
                                setScenes(nextScenes);
                                saveHistory("Toggle Max Speed Variable", layers, dimensions, { scenes: nextScenes });
                              }}
                              title="Toggle Variable"
                              style={{
                                background: scene.useVarMaxSpeed ? '#4CAF50' : '#333',
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
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '10px', color: '#aaa', textAlign: 'left' }}>Acceleration:</label>
                          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                            {scene.useVarAcceleration ? (
                              <select
                                className="nodrag"
                                value={scene.accelerationVar || ''}
                                onChange={(e) => {
                                  const nextScenes = scenes.map(s => s.id === scene.id ? { ...s, accelerationVar: e.target.value } : s);
                                  setScenes(nextScenes);
                                  saveHistory("Set Scene Acceleration Variable", layers, dimensions, { scenes: nextScenes });
                                }}
                                style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #555', borderRadius: '4px', padding: '6px', fontSize: '11px', outline: 'none' }}
                              >
                                <option value="">[Select Variable]</option>
                                {variables.filter(v => v.type !== 'group').map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
                              </select>
                            ) : (
                              <input 
                                className="nodrag" 
                                type="number"
                                step="0.01"
                                value={scene.acceleration ?? 0.01} 
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  const nextScenes = scenes.map(s => s.id === scene.id ? { ...s, acceleration: val } : s);
                                  setScenes(nextScenes);
                                  saveHistory("Set Scene Acceleration", layers, dimensions, { scenes: nextScenes });
                                }}
                                style={{ 
                                  flex: 1, 
                                  background: '#111', 
                                  color: '#fff', 
                                  border: '1px solid #555', 
                                  borderRadius: '4px', 
                                  padding: '6px', 
                                  fontSize: '11px', 
                                  outline: 'none',
                                  boxSizing: 'border-box'
                                }}
                              />
                            )}
                            <button
                              className="nodrag"
                              onClick={(e) => {
                                e.stopPropagation();
                                const useVar = !(scene.useVarAcceleration ?? false);
                                const nextScenes = scenes.map(s => s.id === scene.id ? { ...s, useVarAcceleration: useVar } : s);
                                setScenes(nextScenes);
                                saveHistory("Toggle Acceleration Variable", layers, dimensions, { scenes: nextScenes });
                              }}
                              title="Toggle Variable"
                              style={{
                                background: scene.useVarAcceleration ? '#4CAF50' : '#333',
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
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '10px', color: '#aaa', textAlign: 'left' }}>Steering Speed (deg/frame):</label>
                          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                            {scene.useVarSteeringSpeed ? (
                              <select
                                className="nodrag"
                                value={scene.steeringSpeedVar || ''}
                                onChange={(e) => {
                                  const nextScenes = scenes.map(s => s.id === scene.id ? { ...s, steeringSpeedVar: e.target.value } : s);
                                  setScenes(nextScenes);
                                  saveHistory("Set Scene Steering Speed Variable", layers, dimensions, { scenes: nextScenes });
                                }}
                                style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #555', borderRadius: '4px', padding: '6px', fontSize: '11px', outline: 'none' }}
                              >
                                <option value="">[Select Variable]</option>
                                {variables.filter(v => v.type !== 'group').map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
                              </select>
                            ) : (
                              <input 
                                className="nodrag" 
                                type="number"
                                step="0.5"
                                value={scene.steeringSpeed ?? 0.5} 
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  const nextScenes = scenes.map(s => s.id === scene.id ? { ...s, steeringSpeed: val } : s);
                                  setScenes(nextScenes);
                                  saveHistory("Set Scene Steering Speed", layers, dimensions, { scenes: nextScenes });
                                }}
                                style={{ 
                                  flex: 1, 
                                  background: '#111', 
                                  color: '#fff', 
                                  border: '1px solid #555', 
                                  borderRadius: '4px', 
                                  padding: '6px', 
                                  fontSize: '11px', 
                                  outline: 'none',
                                  boxSizing: 'border-box'
                                }}
                              />
                            )}
                            <button
                              className="nodrag"
                              onClick={(e) => {
                                e.stopPropagation();
                                const useVar = !(scene.useVarSteeringSpeed ?? false);
                                const nextScenes = scenes.map(s => s.id === scene.id ? { ...s, useVarSteeringSpeed: useVar } : s);
                                setScenes(nextScenes);
                                saveHistory("Toggle Steering Speed Variable", layers, dimensions, { scenes: nextScenes });
                              }}
                              title="Toggle Variable"
                              style={{
                                background: scene.useVarSteeringSpeed ? '#4CAF50' : '#333',
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
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '10px', color: '#aaa', textAlign: 'left' }}>Friction (0.01 - 1.0):</label>
                          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                            {scene.useVarFriction ? (
                              <select
                                className="nodrag"
                                value={scene.frictionVar || ''}
                                onChange={(e) => {
                                  const nextScenes = scenes.map(s => s.id === scene.id ? { ...s, frictionVar: e.target.value } : s);
                                  setScenes(nextScenes);
                                  saveHistory("Set Scene Friction Variable", layers, dimensions, { scenes: nextScenes });
                                }}
                                style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #555', borderRadius: '4px', padding: '6px', fontSize: '11px', outline: 'none' }}
                              >
                                <option value="">[Select Variable]</option>
                                {variables.filter(v => v.type !== 'group').map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
                              </select>
                            ) : (
                              <input 
                                className="nodrag" 
                                type="number"
                                step="0.01"
                                min="0.01"
                                max="1.0"
                                value={scene.friction ?? 0.5} 
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0.05;
                                  const clampedVal = Math.min(1.0, Math.max(0.01, val));
                                  const nextScenes = scenes.map(s => s.id === scene.id ? { ...s, friction: clampedVal } : s);
                                  setScenes(nextScenes);
                                  saveHistory("Set Scene Friction", layers, dimensions, { scenes: nextScenes });
                                }}
                                style={{ 
                                  flex: 1, 
                                  background: '#111', 
                                  color: '#fff', 
                                  border: '1px solid #555', 
                                  borderRadius: '4px', 
                                  padding: '6px', 
                                  fontSize: '11px', 
                                  outline: 'none',
                                  boxSizing: 'border-box'
                                }}
                              />
                            )}
                            <button
                              className="nodrag"
                              onClick={(e) => {
                                e.stopPropagation();
                                const useVar = !(scene.useVarFriction ?? false);
                                const nextScenes = scenes.map(s => s.id === scene.id ? { ...s, useVarFriction: useVar } : s);
                                setScenes(nextScenes);
                                saveHistory("Toggle Friction Variable", layers, dimensions, { scenes: nextScenes });
                              }}
                              title="Toggle Variable"
                              style={{
                                background: scene.useVarFriction ? '#4CAF50' : '#333',
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
                       </div>
                     </>
                   )}
                   <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '10px', color: '#aaa', textAlign: 'left' }}>Scene Music:</label>
                      <select 
                        className="nodrag" 
                        value={scene.musicId || ''} 
                        onChange={(e) => {
                          const val = e.target.value || null;
                          const nextScenes = scenes.map(s => s.id === scene.id ? { ...s, musicId: val } : s);
                          setScenes(nextScenes);
                          saveHistory("Set Scene Music", layers, dimensions, { scenes: nextScenes });
                        }}
                        style={{ width: '100%', background: '#111', color: '#fff', border: '1px solid #555', borderRadius: '4px', padding: '6px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }}
                      >
                         <option value="">[No Music]</option>
                         {musicTracks && musicTracks.filter(mt => mt.type !== 'group').map(mt => (
                             <option key={mt.id} value={mt.id}>{mt.name}</option>
                         ))}
                      </select>
                    </div>
                     <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '10px', color: '#aaa' }}>On Scene Start:</label>
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <select 
                              className="nodrag" 
                              value={scene.startScriptId || ''} 
                              onChange={(e) => {
                                const val = e.target.value ? Number(e.target.value) : null;
                                const nextScenes = scenes.map(s => s.id === scene.id ? { ...s, startScriptId: val } : s);
                                setScenes(nextScenes);
                                saveHistory("Set Scene Start Script", layers, dimensions, { scenes: nextScenes });
                              }}
                              style={{ 
                                width: '100%', 
                                background: '#111', 
                                color: '#fff', 
                                border: '1px solid #555', 
                                borderRadius: '4px', 
                                padding: '6px', 
                                fontSize: '11px', 
                                outline: 'none',
                                boxSizing: 'border-box'
                              }}
                            >
                               <option value="">[Unique Visual Graph]</option>
                                {customScripts && customScripts.filter(cs => cs.type !== 'group').length > 0 && (
                                  <optgroup label="Custom Scripts">
                                    {customScripts.filter(cs => cs.type !== 'group').map(cs => (
                                      <option key={cs.id} value={cs.id}>{cs.name}</option>
                                    ))}
                                  </optgroup>
                                )}
                            </select>
                          </div>
                          {scene.startScriptId && (
                            <button onClick={() => { setEditingCustomScriptId(scene.startScriptId); setTool('script'); }} style={{ background: 'transparent', color: '#888', border: 'none', padding: '2px 4px', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', borderRadius: '3px', flexShrink: 0 }} title="Edit Script"><BsPencil /></button>
                          )}
                          {!scene.startScriptId && (
                            <button onClick={() => { setScriptPromptName('On Scene Start'); setScriptPrompt(scene.id); }} style={{ background: 'transparent', color: '#4CAF50', border: 'none', padding: '2px 4px', cursor: 'pointer', fontSize: '15px', display: 'flex', alignItems: 'center', borderRadius: '3px', flexShrink: 0 }} title="Add Script"><BsPlus /></button>
                          )}
                        </div>
                   </div>
                   
                   {!scene.startScriptId ? (
                     <button 
                       onClick={(e) => { 
                         e.stopPropagation(); 
                         setEditingScriptSceneId(scene.id); 
                       }} 
                       style={{ 
                         width: '100%',
                         background: '#0078d4', 
                         color: '#fff', 
                         border: 'none', 
                         padding: '6px', 
                         fontSize: '11px', 
                         outline: 'none', 
                         borderRadius: '3px', 
                         cursor: 'pointer', 
                         fontWeight: 'bold',
                         display: 'flex',
                         alignItems: 'center',
                         justifyContent: 'center',
                         gap: '4px'
                       }}
                     >
                       <BsCodeSlash size={12} /> Edit Visual Graph
                     </button>
                   ) : (
                     <button 
                       onClick={(e) => { 
                         e.stopPropagation(); 
                         setEditingCustomScriptId(scene.startScriptId); 
                       }} 
                       style={{ 
                         width: '100%',
                         background: '#9c27b0', 
                         color: '#fff', 
                         border: 'none', 
                         padding: '6px', 
                         fontSize: '11px', 
                         outline: 'none', 
                         borderRadius: '3px', 
                         cursor: 'pointer', 
                         fontWeight: 'bold',
                         display: 'flex',
                         alignItems: 'center',
                         justifyContent: 'center',
                         gap: '4px'
                       }}
                     >
                       <BsCodeSlash size={12} /> Edit Selected Script
                     </button>
                   )}
                </div>
              )}
            </div>
          );
        })}
        </div>
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
                  confirmAddSceneScript(scriptPrompt, scriptPromptName.trim());
                } else if (e.key === 'Escape') {
                  setScriptPrompt(null);
                }
              }}
              style={{ background: '#111', color: '#fff', border: '1px solid #4CAF50', padding: '8px', fontSize: '13px', outline: 'none', borderRadius: '4px' }}
            />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => setScriptPrompt(null)} style={{ background: '#333', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>Cancel</button>
              <button onClick={() => { if (scriptPromptName.trim()) confirmAddSceneScript(scriptPrompt, scriptPromptName.trim()); }} style={{ background: '#4CAF50', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScenesPanel;