import { useState } from 'react';
import { usePxShop } from '../context/PxShopContext';
import { BsCodeSlash, BsPlus, BsTrash, BsChevronDown, BsChevronRight, BsFiles, BsGlobe, BsFolder2Open, BsSearch } from 'react-icons/bs';

const ScriptsPanel = ({ isCollapsed, onToggle }) => {
  const [editingScriptId, setEditingScriptId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const {
    customScripts, setCustomScripts,
    setEditingCustomScriptId,
    setEditingGlobalScript,
    saveHistory, layers, dimensions
  } = usePxShop();

  const handleRenameComplete = () => {
    setEditingScriptId(null);
  };

  const addScript = (e) => {
    e.stopPropagation();
    const newScript = {
      id: Date.now() + Math.random(),
      name: `Script ${customScripts.length + 1}`,
      script: { nodes: [{ id: 'start', position: { x: 250, y: 100 }, data: { label: 'On Call' }, type: 'input' }], edges: [] }
    };
    const nextScripts = [...customScripts, newScript];
    setCustomScripts(nextScripts);
    saveHistory("Add Script", layers, dimensions, { customScripts: nextScripts });
  };

  const addScriptGroup = (e) => {
    e.stopPropagation();
    const newGroup = {
      id: Date.now() + Math.random(),
      type: 'group',
      name: `Group ${customScripts.filter(s => s.type === 'group').length + 1}`,
      isOpen: true
    };
    const nextScripts = [...customScripts, newGroup];
    setCustomScripts(nextScripts);
    saveHistory("Add Script Group", layers, dimensions, { customScripts: nextScripts });
  };

  const toggleGroup = (groupId) => {
    const nextScripts = customScripts.map(s => s.id === groupId ? { ...s, isOpen: !s.isOpen } : s);
    setCustomScripts(nextScripts);
    saveHistory("Toggle Script Group", layers, dimensions, { customScripts: nextScripts });
  };

  const deleteScript = (e, id) => {
    e.stopPropagation();
    const nextScripts = customScripts.filter(s => s.id !== id);
    setCustomScripts(nextScripts);
    saveHistory("Delete Script", layers, dimensions, { customScripts: nextScripts });
  };

  const deleteScriptGroup = (e, id) => {
    e.stopPropagation();
    const nextScripts = customScripts.filter(s => s.id !== id && String(s.groupId) !== String(id));
    setCustomScripts(nextScripts);
    saveHistory("Delete Script Group", layers, dimensions, { customScripts: nextScripts });
  };

  const duplicateScript = (e, scriptToCopy) => {
    e.stopPropagation();
    if (scriptToCopy.type === 'group') {
      const newGroupId = Date.now() + Math.random();
      const groupScripts = customScripts.filter(s => String(s.groupId) === String(scriptToCopy.id));
      
      const newGroupObj = {
        ...scriptToCopy,
        id: newGroupId,
        name: `${scriptToCopy.name} (Copy)`
      };
      
      const duplicatedScripts = groupScripts.map((s, idx) => ({
        ...JSON.parse(JSON.stringify(s)),
        id: Date.now() + Math.random() + idx,
        groupId: newGroupId,
        name: `${s.name} (Copy)`
      }));
      
      const groupIndex = customScripts.findIndex(s => s.id === scriptToCopy.id);
      const nextScripts = [...customScripts];
      nextScripts.splice(groupIndex, 0, newGroupObj, ...duplicatedScripts);
      
      setCustomScripts(nextScripts);
      saveHistory("Duplicate Script Group", layers, dimensions, { customScripts: nextScripts });
      return;
    }
    
    const duplicatedScript = {
      ...JSON.parse(JSON.stringify(scriptToCopy)),
      id: Date.now() + Math.random(),
      name: `${scriptToCopy.name} (Copy)`
    };
    
    const scriptIndex = customScripts.findIndex(s => s.id === scriptToCopy.id);
    const nextScripts = [...customScripts];
    if (scriptIndex !== -1) {
      nextScripts.splice(scriptIndex + 1, 0, duplicatedScript);
    } else {
      nextScripts.push(duplicatedScript);
    }
    setCustomScripts(nextScripts);
    saveHistory("Duplicate Script", layers, dimensions, { customScripts: nextScripts });
  };

  const moveScriptUp = (e, id) => {
    e.stopPropagation();
    const index = customScripts.findIndex(s => s.id === id);
    if (index <= 0) return;
    
    const nextScripts = [...customScripts];
    const temp = nextScripts[index - 1];
    nextScripts[index - 1] = nextScripts[index];
    nextScripts[index] = temp;
    
    setCustomScripts(nextScripts);
    saveHistory("Move Script Up", layers, dimensions, { customScripts: nextScripts });
  };

  const moveScriptDown = (e, id) => {
    e.stopPropagation();
    const index = customScripts.findIndex(s => s.id === id);
    if (index === -1 || index >= customScripts.length - 1) return;
    
    const nextScripts = [...customScripts];
    const temp = nextScripts[index + 1];
    nextScripts[index + 1] = nextScripts[index];
    nextScripts[index] = temp;
    
    setCustomScripts(nextScripts);
    saveHistory("Move Script Down", layers, dimensions, { customScripts: nextScripts });
  };

  const updateScript = (id, prop, value) => {
    setCustomScripts(customScripts.map(s => s.id === id ? { ...s, [prop]: value } : s));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: isCollapsed ? 'none' : 1, borderBottom: '2px solid #222', minHeight: 0, background: isCollapsed ? 'transparent' : '#3d3d3d' }}>
      <div 
        onClick={onToggle}
        style={{ padding: '15px', borderBottom: isCollapsed ? 'none' : '1px solid #3c3c3c', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}
      >
        <span style={{ fontWeight: 'bold', fontSize: '11px', textTransform: 'uppercase', color: isCollapsed ? '#aaa' : '#4CAF50', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BsCodeSlash /> Scripts
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={e => { if (isCollapsed) { onToggle(); } e.stopPropagation(); }}>
          <button onClick={() => setEditingGlobalScript(true)} title="Edit Global Script" style={{ backgroundColor: '#0078d4', border: 'none', color: '#fff', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><BsGlobe /></button>
          <button onClick={addScriptGroup} title="Add Group" style={{ backgroundColor: '#ff9800', border: 'none', color: '#fff', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><BsFolder2Open /></button>
          <button onClick={addScript} title="Add Script" style={{ backgroundColor: '#4CAF50', border: 'none', color: '#fff', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><BsPlus /></button>
          <div onClick={e => { e.stopPropagation(); onToggle(); }} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            {isCollapsed ? <BsChevronRight style={{ color: '#aaa' }} /> : <BsChevronDown style={{ color: '#aaa' }} />}
          </div>
        </div>
      </div>
      {!isCollapsed && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', osition: 'relative', marginBottom: '4px' }}>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value.toLowerCase())}
            placeholder="Search scripts..."
            style={{ flexGrow:1,width: '100%', background: '#111', color: '#fff', border: '1px solid #444', borderRadius: '4px', padding: '6px 8px 6px 8x', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
        {customScripts.filter(s => {
          if (!searchQuery) return true;
          if (s.type === 'group') {
            if (s.name.toLowerCase().includes(searchQuery)) return true;
            return customScripts.some(cs => !cs.type && String(cs.groupId) === String(s.id) && cs.name.toLowerCase().includes(searchQuery));
          }
          return s.name.toLowerCase().includes(searchQuery);
        }).map((script, index) => {
          if (script.type === 'group') {
            return (
              <div key={script.id} 
                style={{ 
                  display: 'flex', flexDirection: 'column', padding: '8px', 
                  backgroundColor: '#2a2a2a', 
                  borderRadius: '6px',
                  border: '1px solid #555',
                  marginTop: '4px'
                }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button onClick={(e) => { e.stopPropagation(); toggleGroup(script.id); }} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 0 }}>
                    {script.isOpen ? '▼' : '▶'}
                  </button>
                  {editingScriptId === script.id ? (
                    <input
                      autoFocus
                      value={script.name}
                      onChange={(e) => updateScript(script.id, 'name', e.target.value)}
                      onBlur={handleRenameComplete}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === 'Escape') handleRenameComplete();
                      }}
                      style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #ff9800', outline: 'none', padding: '2px', fontSize: '13px', textAlign: 'left' }}
                    />
                  ) : (
                    <span
                      onDoubleClick={(e) => { e.stopPropagation(); setEditingScriptId(script.id); }}
                      style={{ fontSize: '13px', fontWeight: 'bold', color: '#ff9800', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'pointer', textAlign: 'left' }}
                    >
                      📁 {script.name}
                    </span>
                  )}
                  <button title="Duplicate Group" onClick={(e) => duplicateScript(e, script)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}><BsFiles size={14} /></button>
                  <button title="Move Up" onClick={(e) => moveScriptUp(e, script.id)} disabled={index === 0} style={{ background: 'none', border: 'none', color: index === 0 ? '#555' : '#fff', cursor: index === 0 ? 'default' : 'pointer', padding: 0 }}>▲</button>
                  <button title="Move Down" onClick={(e) => moveScriptDown(e, script.id)} disabled={index === customScripts.length - 1} style={{ background: 'none', border: 'none', color: index === customScripts.length - 1 ? '#555' : '#fff', cursor: index === customScripts.length - 1 ? 'default' : 'pointer', padding: 0 }}>▼</button>
                  <button onClick={(e) => deleteScriptGroup(e, script.id)} style={{ background: 'none', border: 'none', color: '#ff4444', cursor: 'pointer', padding: 0, marginLeft: '5px', display: 'flex', alignItems: 'center' }}>
                    <BsTrash />
                  </button>
                </div>
              </div>
            );
          }

          const group = script.groupId ? customScripts.find(s => String(s.id) === String(script.groupId)) : null;
          if (group && !group.isOpen && !searchQuery) return null;

          return (
            <div key={script.id} 
              style={{ 
                marginLeft: script.groupId ? '15px' : '0',
                display: 'flex', flexDirection: 'column', padding: '10px', 
                backgroundColor: '#1e1e1e', 
                borderRadius: '6px',
                border: '1px solid #333'
              }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, overflow: 'hidden' }}>
                  {editingScriptId === script.id ? (
                    <input
                      autoFocus
                      value={script.name}
                      onChange={(e) => updateScript(script.id, 'name', e.target.value)}
                      onBlur={handleRenameComplete}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === 'Escape') handleRenameComplete();
                      }}
                      style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #4CAF50', outline: 'none', padding: '2px', fontSize: '13px' }}
                    />
                  ) : (
                    <span
                      onDoubleClick={(e) => { e.stopPropagation(); setEditingScriptId(script.id); }}
                      style={{ fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                    >
                      {script.name}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button title="Duplicate Script" onClick={(e) => duplicateScript(e, script)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', opacity: 0.8, padding: 0, display: 'flex', alignItems: 'center' }}>
                    <BsFiles size={14} />
                  </button>
                  <button title="Move Up" onClick={(e) => moveScriptUp(e, script.id)} disabled={index === 0} style={{ background: 'none', border: 'none', color: index === 0 ? '#555' : '#fff', cursor: index === 0 ? 'default' : 'pointer', padding: 0 }}>▲</button>
                  <button title="Move Down" onClick={(e) => moveScriptDown(e, script.id)} disabled={index === customScripts.length - 1} style={{ background: 'none', border: 'none', color: index === customScripts.length - 1 ? '#555' : '#fff', cursor: index === customScripts.length - 1 ? 'default' : 'pointer', padding: 0 }}>▼</button>
                  <button title="Delete Script" onClick={(e) => deleteScript(e, script.id)} style={{ background: 'none', border: 'none', color: '#ff4444', cursor: 'pointer', opacity: 0.8, padding: 0, display: 'flex', alignItems: 'center' }}>
                    <BsTrash size={14} />
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                <select 
                  value={script.groupId || ""} 
                  onChange={(e) => {
                    e.stopPropagation();
                    const newGroupId = e.target.value ? Number(e.target.value) : null;
                    
                    let nextScripts = customScripts.map(s => s.id === script.id ? { ...s, groupId: newGroupId } : s);
                    
                    if (newGroupId) {
                      const movedScript = nextScripts.find(s => s.id === script.id);
                      nextScripts = nextScripts.filter(s => s.id !== script.id);
                      
                      const groupIndex = nextScripts.findIndex(s => s.id === newGroupId);
                      if (groupIndex !== -1) {
                        let insertIndex = groupIndex + 1;
                        while (insertIndex < nextScripts.length && nextScripts[insertIndex].groupId === newGroupId) {
                          insertIndex++;
                        }
                        nextScripts.splice(insertIndex, 0, movedScript);
                      }
                    } else {
                      const oldGroupId = script.groupId;
                      if (oldGroupId) {
                        const movedScript = nextScripts.find(s => s.id === script.id);
                        nextScripts = nextScripts.filter(s => s.id !== script.id);
                        
                        const oldGroupIndex = nextScripts.findIndex(s => s.id === oldGroupId);
                        if (oldGroupIndex !== -1) {
                          let insertIndex = oldGroupIndex + 1;
                          while (insertIndex < nextScripts.length && nextScripts[insertIndex].groupId === oldGroupId) {
                            insertIndex++;
                          }
                          nextScripts.splice(insertIndex, 0, movedScript);
                        } else {
                          nextScripts.push(movedScript);
                        }
                      }
                    }
                    
                    setCustomScripts(nextScripts);
                    saveHistory("Change Script Group", layers, dimensions, { customScripts: nextScripts });
                  }}
                  onClick={(e) => e.stopPropagation()}
                  style={{ background: 'transparent', color: '#aaa', border: '1px solid #444', borderRadius: '3px', maxWidth: '120px', fontSize: '10px', outline: 'none' }}
                >
                  <option value="">No Group</option>
                  {customScripts.filter(s => s.type === 'group').map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
                <button onClick={() => setEditingCustomScriptId(script.id)} style={{ background: '#0078d4', color: '#fff', border: 'none', padding: '6px 12px', fontSize: '11px', outline: 'none', borderRadius: '3px', cursor: 'pointer', fontWeight: 'bold' }}>Edit Script</button>
              </div>

            </div>
          );
        })}
        {customScripts.length === 0 && <div style={{ fontSize: '11px', color: '#666', textAlign: 'center', padding: '10px 0' }}>No scripts defined</div>}
        </div>
      )}
    </div>
  );
};

export default ScriptsPanel;