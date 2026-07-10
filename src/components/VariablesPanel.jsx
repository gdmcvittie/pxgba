import { useState } from 'react';
import { usePxShop } from '../context/PxShopContext';
import { BsCalculator, BsPlus, BsTrash, BsChevronDown, BsChevronRight, BsFiles, BsFolder2Open } from 'react-icons/bs';

const VariablesPanel = ({ isCollapsed, onToggle }) => {
  const { variables, setVariables, saveHistory, layers, dimensions } = usePxShop();
  const [editingGroupId, setEditingGroupId] = useState(null);

  // Default PLAYER and SCENE SETTINGS variables/groups are protected
  const PROTECTED_VAR_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13, 30, 31, 32, 33, 34, 35, 36, 37, 38];
  const PROTECTED_GROUP_IDS = [9, 20];

  const isProtectedVar = (id) => PROTECTED_VAR_IDS.includes(id);
  const isProtectedGroup = (id) => PROTECTED_GROUP_IDS.includes(id);

  const handleRenameComplete = () => {
    setEditingGroupId(null);
  };

  const addVariable = (e) => {
    e.stopPropagation();
    const newVar = {
      id: Date.now() + Math.random(),
      name: `var_${variables.length + 1}`,
      type: 'number',
      initialValue: 0,
      min: 0,
      max: 10
    };
    const newVars = [...variables, newVar];
    setVariables(newVars);
    saveHistory("Add Variable", layers, dimensions, { variables: newVars });
  };

  const addVariableGroup = (e) => {
    e.stopPropagation();
    const newGroup = {
      id: Date.now() + Math.random(),
      type: 'group',
      name: `Group_${variables.filter(v => v.type === 'group').length + 1}`,
      isOpen: false
    };
    const newVars = [...variables, newGroup];
    setVariables(newVars);
    saveHistory("Add Variable Group", layers, dimensions, { variables: newVars });
  };

  const toggleGroup = (groupId) => {
    const newVars = variables.map(v => v.id === groupId ? { ...v, isOpen: !v.isOpen } : v);
    setVariables(newVars);
    saveHistory("Toggle Variable Group", layers, dimensions, { variables: newVars });
  };

  const deleteVariable = (e, id) => {
    e.stopPropagation();
    
    // Prevent deletion of default PLAYER variables and PLAYER group
    if (isProtectedVar(id) || isProtectedGroup(id)) {
      return;
    }
    
    const targetVar = variables.find(v => v.id === id);
    let newVars;
    if (targetVar && targetVar.type === 'group') {
      newVars = variables.filter(v => v.id !== id && String(v.groupId) !== String(id));
    } else {
      newVars = variables.filter(v => v.id !== id);
    }
    setVariables(newVars);
    saveHistory("Delete Variable", layers, dimensions, { variables: newVars });
  };

  const duplicateVariable = (e, varToCopy) => {
    e.stopPropagation();
    if (varToCopy.type === 'group') {
      const newGroupId = Date.now() + Math.random();
      const groupVars = variables.filter(v => String(v.groupId) === String(varToCopy.id));
      
      const newGroupObj = {
        ...varToCopy,
        id: newGroupId,
        name: `${varToCopy.name}_copy`
      };
      
      const duplicatedVars = groupVars.map((v, idx) => {
        const baseName = `${v.name}_copy`;
        let name = baseName;
        let count = 1;
        while (variables.some(x => x.name === name) || groupVars.some((x, xidx) => xidx < idx && `${x.name}_copy` === name)) {
          name = `${baseName}_${count}`;
          count++;
        }
        return {
          ...JSON.parse(JSON.stringify(v)),
          id: Date.now() + Math.random() + idx,
          groupId: newGroupId,
          name: name
        };
      });
      
      const groupIndex = variables.findIndex(v => v.id === varToCopy.id);
      const nextVars = [...variables];
      nextVars.splice(groupIndex, 0, newGroupObj, ...duplicatedVars);
      
      setVariables(nextVars);
      saveHistory("Duplicate Variable Group", layers, dimensions, { variables: nextVars });
      return;
    }
    
    const baseName = `${varToCopy.name}_copy`;
    let name = baseName;
    let count = 1;
    while (variables.some(x => x.name === name)) {
      name = `${baseName}_${count}`;
      count++;
    }
    
    const duplicatedVar = {
      ...JSON.parse(JSON.stringify(varToCopy)),
      id: Date.now() + Math.random(),
      name: name
    };
    
    const varIndex = variables.findIndex(v => v.id === varToCopy.id);
    const nextVars = [...variables];
    if (varIndex !== -1) {
      nextVars.splice(varIndex + 1, 0, duplicatedVar);
    } else {
      nextVars.push(duplicatedVar);
    }
    setVariables(nextVars);
    saveHistory("Duplicate Variable", layers, dimensions, { variables: nextVars });
  };

  const moveVariableUp = (e, id) => {
    e.stopPropagation();
    const index = variables.findIndex(v => v.id === id);
    if (index <= 0) return;
    
    const nextVars = [...variables];
    const temp = nextVars[index - 1];
    nextVars[index - 1] = nextVars[index];
    nextVars[index] = temp;
    
    setVariables(nextVars);
    saveHistory("Move Variable Up", layers, dimensions, { variables: nextVars });
  };

  const moveVariableDown = (e, id) => {
    e.stopPropagation();
    const index = variables.findIndex(v => v.id === id);
    if (index === -1 || index >= variables.length - 1) return;
    
    const nextVars = [...variables];
    const temp = nextVars[index + 1];
    nextVars[index + 1] = nextVars[index];
    nextVars[index] = temp;
    
    setVariables(nextVars);
    saveHistory("Move Variable Down", layers, dimensions, { variables: nextVars });
  };

  const updateVariable = (id, prop, value) => {
    setVariables(variables.map(v => v.id === id ? { ...v, [prop]: value } : v));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: isCollapsed ? 'none' : 1, borderBottom: '2px solid #222', minHeight: 0, background: isCollapsed ? 'transparent' : '#3d3d3d' }}>
      <div 
        onClick={onToggle}
        style={{ padding: '15px', borderBottom: isCollapsed ? 'none' : '1px solid #3c3c3c', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}
      >
        <span style={{ fontWeight: 'bold', fontSize: '11px', textTransform: 'uppercase', color: isCollapsed ? '#aaa' : '#4CAF50', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BsCalculator /> Variables
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={e => { if (isCollapsed) { onToggle(); } e.stopPropagation(); }}>
          <button onClick={addVariableGroup} title="Add Group" style={{ backgroundColor: '#ff9800', border: 'none', color: '#fff', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><BsFolder2Open /></button>
          <button onClick={addVariable} title="Add Variable" style={{ backgroundColor: '#4CAF50', border: 'none', color: '#fff', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><BsPlus /></button>
          <div onClick={e => { e.stopPropagation(); onToggle(); }} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            {isCollapsed ? <BsChevronRight style={{ color: '#aaa' }} /> : <BsChevronDown style={{ color: '#aaa' }} />}
          </div>
        </div>
      </div>
      {!isCollapsed && (
        <div style={{ flex: 1, padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto' }}>
        {variables.map((v, index) => {
          if (v.type === 'group') {
            return (
              <div key={v.id} style={{ display: 'flex', flexDirection: 'column', padding: '6px 10px', backgroundColor: '#2d2d2d', borderRadius: '4px', borderLeft: '3px solid #ff9800' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button 
                    onClick={() => toggleGroup(v.id)} 
                    style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 0, fontSize: '12px', width: '15px', textAlign: 'left' }}
                  >
                    {v.isOpen ? '▼' : '▶'}
                  </button>
                  {editingGroupId === v.id ? (
                    <input
                      autoFocus
                      value={v.name}
                      onChange={(e) => updateVariable(v.id, 'name', e.target.value.replace(/[^a-zA-Z0-9_]/g, '_'))}
                      onBlur={handleRenameComplete}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === 'Escape') handleRenameComplete();
                      }}
                      style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #ff9800', outline: 'none', padding: '2px', fontSize: '12px', borderRadius: '3px', textAlign: 'left' }}
                    />
                  ) : (
                    <span
                      onDoubleClick={(e) => { if (!isProtectedGroup(v.id)) { e.stopPropagation(); setEditingGroupId(v.id); } }}
                      style={{ fontSize: '12px', fontWeight: 'bold', color: '#ff9800', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: isProtectedGroup(v.id) ? 'default' : 'pointer', textAlign: 'left' }}
                    >
                      📁 {v.name}
                    </span>
                  )}
                  <button title="Duplicate Group" onClick={(e) => duplicateVariable(e, v)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}><BsFiles size={14} /></button>
                  <button title="Move Up" onClick={(e) => moveVariableUp(e, v.id)} disabled={index === 0} style={{ background: 'none', border: 'none', color: index === 0 ? '#555' : '#fff', cursor: index === 0 ? 'default' : 'pointer', padding: 0 }}>▲</button>
                  <button title="Move Down" onClick={(e) => moveVariableDown(e, v.id)} disabled={index === variables.length - 1} style={{ background: 'none', border: 'none', color: index === variables.length - 1 ? '#555' : '#fff', cursor: index === variables.length - 1 ? 'default' : 'pointer', padding: 0 }}>▼</button>
                  {!isProtectedGroup(v.id) && (
                    <button onClick={(e) => deleteVariable(e, v.id)} style={{ background: 'none', border: 'none', color: '#ff4444', cursor: 'pointer', padding: 0, marginLeft: '5px', display: 'flex', alignItems: 'center' }}>
                      <BsTrash />
                    </button>
                  )}
                </div>
              </div>
            );
          }

          const group = v.groupId ? variables.find(g => String(g.id) === String(v.groupId)) : null;
          if (group && !group.isOpen) return null;

          return (
            <div key={v.id} style={{ marginLeft: v.groupId ? '15px' : '0', display: 'flex', flexDirection: 'column', padding: '8px', backgroundColor: '#1e1e1e', borderRadius: '4px', border: '1px solid #333' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <input
                  value={v.name}
                  disabled={isProtectedVar(v.id)}
                  onChange={(e) => updateVariable(v.id, 'name', e.target.value.replace(/[^a-zA-Z0-9_]/g, '_'))}
                  style={{ width: '120px', background: isProtectedVar(v.id) ? '#2a2a2a' : '#111', color: isProtectedVar(v.id) ? '#888' : '#fff', border: '1px solid #4CAF50', outline: 'none', padding: '2px 4px', fontSize: '12px', borderRadius: '3px', cursor: isProtectedVar(v.id) ? 'not-allowed' : 'text' }}
                  placeholder="Variable Name"
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button title="Duplicate Variable" onClick={(e) => duplicateVariable(e, v)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', opacity: 0.8, padding: 0, display: 'flex', alignItems: 'center' }}><BsFiles size={12} /></button>
                  <button title="Move Up" onClick={(e) => moveVariableUp(e, v.id)} disabled={index === 0} style={{ background: 'none', border: 'none', color: index === 0 ? '#555' : '#fff', cursor: index === 0 ? 'default' : 'pointer', padding: 0 }}>▲</button>
                  <button title="Move Down" onClick={(e) => moveVariableDown(e, v.id)} disabled={index === variables.length - 1} style={{ background: 'none', border: 'none', color: index === variables.length - 1 ? '#555' : '#fff', cursor: index === variables.length - 1 ? 'default' : 'pointer', padding: 0 }}>▼</button>
                  {!isProtectedVar(v.id) && (
                    <button onClick={(e) => deleteVariable(e, v.id)} style={{ background: 'none', border: 'none', color: '#ff4444', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}><BsTrash size={12} /></button>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <select 
                    value={v.type} 
                    disabled={isProtectedVar(v.id)}
                    onChange={(e) => {
                      const newType = e.target.value;
                      let initialVal = 0;
                      if (newType === 'boolean') initialVal = false;
                      else if (newType === 'string') initialVal = '';
                      else if (newType === 'float') initialVal = 0.0;
                      const nextVars = variables.map(item => item.id === v.id ? { ...item, type: newType, initialValue: initialVal } : item);
                      setVariables(nextVars);
                      saveHistory("Update Variable Type", layers, dimensions, { variables: nextVars });
                    }} 
                    style={{ flex: 1, background: isProtectedVar(v.id) ? '#2a2a2a' : '#111', color: isProtectedVar(v.id) ? '#888' : '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px', cursor: isProtectedVar(v.id) ? 'not-allowed' : 'pointer' }}
                  >
                     <option value="number">Number</option>
                     <option value="float">Float</option>
                     <option value="boolean">Boolean</option>
                     <option value="string">String</option>
                     <option value="random">Random Number</option>
                  </select>
                  {v.type === 'random' ? (
                    <>
                      <input type="number" title="Min" value={v.min ?? 0} onChange={(e) => updateVariable(v.id, 'min', parseInt(e.target.value) || 0)} style={{ flex: 1, width: '30px', background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px', minWidth: 0 }} />
                      <span style={{color: '#aaa', fontSize:'11px'}}>to</span>
                      <input type="number" title="Max" value={v.max ?? 10} onChange={(e) => updateVariable(v.id, 'max', parseInt(e.target.value) || 0)} style={{ flex: 1, width: '30px', background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px', minWidth: 0 }} />
                    </>
                  ) : v.type === 'number' ? (
                    <input type="number" value={v.initialValue} onChange={(e) => updateVariable(v.id, 'initialValue', parseInt(e.target.value) || 0)} style={{ flex: 1, width: '40px', background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }} />
                  ) : v.type === 'float' ? (
                    <input type="number" step="any" value={v.initialValue} onChange={(e) => updateVariable(v.id, 'initialValue', parseFloat(e.target.value) || 0.0)} style={{ flex: 1, width: '40px', background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }} />
                  ) : v.type === 'string' ? (
                    <input type="text" value={v.initialValue || ''} onChange={(e) => updateVariable(v.id, 'initialValue', e.target.value)} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px', minWidth: 0 }} />
                  ) : (
                    <select value={v.initialValue ? "true" : "false"} onChange={(e) => updateVariable(v.id, 'initialValue', e.target.value === "true")} style={{ flex: 1, width: '40px', background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }}>
                       <option value="true">True</option>
                       <option value="false">False</option>
                    </select>
                  )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', borderTop: '1px solid #2d2d2d', paddingTop: '6px' }}>
                <select 
                  value={v.groupId || ""} 
                  disabled={isProtectedVar(v.id)}
                  onChange={(e) => {
                    e.stopPropagation();
                    const newGroupId = e.target.value ? Number(e.target.value) : null;
                    
                    let nextVars = variables.map(item => item.id === v.id ? { ...item, groupId: newGroupId } : item);
                    
                    if (newGroupId) {
                      const movedVar = nextVars.find(item => item.id === v.id);
                      nextVars = nextVars.filter(item => item.id !== v.id);
                      
                      const groupIndex = nextVars.findIndex(item => item.id === newGroupId);
                      if (groupIndex !== -1) {
                        let insertIndex = groupIndex + 1;
                        while (insertIndex < nextVars.length && nextVars[insertIndex].groupId === newGroupId) {
                          insertIndex++;
                        }
                        nextVars.splice(insertIndex, 0, movedVar);
                      }
                    } else {
                      const oldGroupId = v.groupId;
                      if (oldGroupId) {
                        const movedVar = nextVars.find(item => item.id === v.id);
                        nextVars = nextVars.filter(item => item.id !== v.id);
                        
                        const oldGroupIndex = nextVars.findIndex(item => item.id === oldGroupId);
                        if (oldGroupIndex !== -1) {
                          let insertIndex = oldGroupIndex + 1;
                          while (insertIndex < nextVars.length && nextVars[insertIndex].groupId === oldGroupId) {
                            insertIndex++;
                          }
                          nextVars.splice(insertIndex, 0, movedVar);
                        } else {
                          nextVars.push(movedVar);
                        }
                      }
                    }
                    
                    setVariables(nextVars);
                    saveHistory("Change Variable Group", layers, dimensions, { variables: nextVars });
                  }}
                  onClick={(e) => e.stopPropagation()}
                  style={{ background: isProtectedVar(v.id) ? '#2a2a2a' : 'transparent', color: isProtectedVar(v.id) ? '#888' : '#aaa', border: '1px solid #444', borderRadius: '3px', maxWidth: '120px', fontSize: '10px', outline: 'none', cursor: isProtectedVar(v.id) ? 'not-allowed' : 'pointer' }}
                >
                  <option value="">No Group</option>
                  {variables.filter(item => item.type === 'group').map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>
            </div>
          );
        })}
        {variables.length === 0 && <div style={{ fontSize: '11px', color: '#666', textAlign: 'center', padding: '10px 0' }}>No variables defined</div>}
        </div>
      )}
    </div>
  );
};

export default VariablesPanel;