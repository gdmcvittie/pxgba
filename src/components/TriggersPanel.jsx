import { useState } from 'react';
import { usePxShop } from '../context/PxShopContext';
import { BsLightningChargeFill, BsPlus, BsTrash, BsTrashFill, BsChevronDown, BsChevronRight, BsPencil } from 'react-icons/bs';

const TriggersPanel = ({ isCollapsed, onToggle, dragProps }) => {
  const [editingTriggerId, setEditingTriggerId] = useState(null);
  const [checkedIds, setCheckedIds] = useState([]);
  const [expandedGroupIds, setExpandedGroupIds] = useState(new Set());

  const {
    triggers, setTriggers,
    activeTriggerId, setActiveTriggerId,
    tool, setTool,
    setEditingScriptTriggerId,
    customScripts, setEditingCustomScriptId,
    variables,
    saveHistory, layers, dimensions
  } = usePxShop();

  const handleRenameComplete = () => {
    setEditingTriggerId(null);
  };

  const addTrigger = (e) => {
    e.stopPropagation();
    const newTrigger = {
      id: Date.now() + Math.random(),
      name: `Trigger ${triggers.length + 1}`,
      type: 'enter',
      x: 0,
      y: 0,
      useVarX: false,
      useVarY: false,
      varX: '',
      varY: '',
      width: 16,
      height: 16,
      script: { nodes: [{ id: 'start', position: { x: 250, y: 100 }, data: { label: 'On Enter' }, type: 'input' }], edges: [] }
    };
    const nextTriggers = [...triggers, newTrigger];
    setTriggers(nextTriggers);
    setActiveTriggerId(newTrigger.id);
    setTool('trigger');
    saveHistory("Add Trigger", layers, dimensions, { triggers: nextTriggers });
  };

  const handleCheckboxChange = (e, id) => {
    e.stopPropagation();
    setCheckedIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(x => x !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const groupSelectedTriggers = () => {
    if (checkedIds.length === 0) return;
    const groupId = Date.now() + Math.random();
    const nextGroup = {
      id: groupId,
      name: `Group ${triggers.filter(t => t.isGroup).length + 1}`,
      isGroup: true,
      type: 'enter',
      script: { nodes: [{ id: 'start', position: { x: 250, y: 100 }, data: { label: 'On Enter' }, type: 'input' }], edges: [] }
    };
    const nextTriggers = [
      ...triggers.map(t => checkedIds.includes(t.id) ? { ...t, groupId } : t),
      nextGroup
    ];
    setTriggers(nextTriggers);
    setActiveTriggerId(groupId);
    setCheckedIds([]);
    setExpandedGroupIds(prev => {
      const next = new Set(prev);
      next.add(groupId);
      return next;
    });
    saveHistory("Group Triggers", layers, dimensions, { triggers: nextTriggers });
  };

  const deleteTrigger = (e, id) => {
    e.stopPropagation();
    const itemToDelete = triggers.find(t => t.id === id);
    let nextTriggers;
    if (itemToDelete?.isGroup) {
      nextTriggers = triggers
        .filter(t => t.id !== id)
        .map(t => t.groupId === id ? { ...t, groupId: null } : t);
    } else {
      nextTriggers = triggers.filter(t => t.id !== id);
    }
    setTriggers(nextTriggers);
    if (activeTriggerId === id) setActiveTriggerId(null);
    saveHistory(itemToDelete?.isGroup ? "Delete Group" : "Delete Trigger", layers, dimensions, { triggers: nextTriggers });
  };

  const deleteGroupAndTriggers = (e, id) => {
    e.stopPropagation();
    const nextTriggers = triggers.filter(t => t.id !== id && t.groupId !== id);
    setTriggers(nextTriggers);
    if (activeTriggerId === id) setActiveTriggerId(null);
    saveHistory("Delete Group and Triggers", layers, dimensions, { triggers: nextTriggers });
  };

  const ungroupTrigger = (e, id) => {
    e.stopPropagation();
    const nextTriggers = triggers.map(t => t.id === id ? { ...t, groupId: null } : t);
    setTriggers(nextTriggers);
    saveHistory("Ungroup Trigger", layers, dimensions, { triggers: nextTriggers });
  };

  const updateTrigger = (id, prop, value) => {
    setTriggers(triggers.map(t => {
      if (t.id === id) {
        let updated = { ...t, [prop]: value };
        if (prop === 'type') {
          const labelMap = { 'enter': 'On Enter', 'leave': 'On Leave', 'interact': 'On Interact' };
          updated.script = { ...updated.script };
          if (updated.script.nodes && updated.script.nodes.length > 0 && updated.script.nodes[0].id === 'start') {
            updated.script.nodes[0].data = { ...updated.script.nodes[0].data, label: labelMap[value] };
          }
        }
        return updated;
      }
      return t;
    }));
  };

  const groups = triggers.filter(t => t.isGroup);
  const ungroupedTriggers = triggers.filter(t => !t.isGroup && (!t.groupId || !groups.some(g => g.id === t.groupId)));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: isCollapsed ? 'none' : 1, borderBottom: '2px solid #222', minHeight: 0, background: isCollapsed ? 'transparent' : '#3c3733' }}>
      <div
        onClick={onToggle}
        style={{ padding: '15px', borderBottom: isCollapsed ? 'none' : '1px solid #3c3c3c', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'grab', userSelect: 'none', background: '#3b200e' }}
        {...dragProps}
      >
        <span style={{ fontWeight: 'bold', fontSize: '11px', textTransform: 'uppercase', color: isCollapsed ? '#aaa' : '#FF5722', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BsLightningChargeFill /> Triggers
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={e => { if (isCollapsed) { onToggle(); } e.stopPropagation(); }}>
          <button onClick={addTrigger} title="Add Trigger" style={{ backgroundColor: 'transparent', border: '1px solid #555', color: '#888', padding: '3px 7px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'all 0.2s' }} onMouseEnter={e => { e.currentTarget.style.borderColor = '#FF5722'; e.currentTarget.style.color = '#FF5722'; }} onMouseLeave={e => { e.currentTarget.style.borderColor = '#555'; e.currentTarget.style.color = '#888'; }}><BsPlus /></button>
          <div onClick={e => { e.stopPropagation(); onToggle(); }} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            {isCollapsed ? <BsChevronRight style={{ color: '#aaa' }} /> : <BsChevronDown style={{ color: '#aaa' }} />}
          </div>
        </div>
      </div>
      {!isCollapsed && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          
          {/* Top Actions Panel for checked items */}
          {checkedIds.length > 0 && (
            <div style={{ display: 'flex', gap: '8px', padding: '10px', backgroundColor: '#2b2b2b', borderRadius: '4px', marginBottom: '4px', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', color: '#ccc' }}>{checkedIds.length} selected</span>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={groupSelectedTriggers}
                  style={{ backgroundColor: 'transparent', color: '#2196F3', border: '1px solid #2196F3', padding: '4px 8px', borderRadius: '3px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}
                  onMouseEnter={e => { e.target.style.background = '#2196F3'; e.target.style.color = '#fff'; }}
                  onMouseLeave={e => { e.target.style.background = 'transparent'; e.target.style.color = '#2196F3'; }}
                >
                  Group Selected
                </button>
                <button
                  onClick={() => setCheckedIds([])}
                  style={{ backgroundColor: '#555', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '3px', cursor: 'pointer', fontSize: '11px' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Groups List */}
          {groups.map((group) => {
            const isExpanded = expandedGroupIds.has(group.id);
            const groupChildren = triggers.filter(t => t.groupId === group.id);
            const isActive = activeTriggerId === group.id;

            return (
              <div key={group.id} style={{ display: 'flex', flexDirection: 'column', border: isActive ? '1px solid #ff9800' : '1px solid #333', borderRadius: '6px', backgroundColor: '#1e1e1e', overflow: 'auto' }}>
                {/* Group Header */}
                <div
                  onClick={() => { setActiveTriggerId(group.id); setTool('trigger'); }}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 10px', backgroundColor: isActive ? '#2d2d2d' : '#1a1a1a',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, overflow: 'auto' }}>
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedGroupIds(prev => {
                          const next = new Set(prev);
                          if (next.has(group.id)) next.delete(group.id);
                          else next.add(group.id);
                          return next;
                        });
                      }}
                      style={{ color: '#aaa', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px' }}
                    >
                      {isExpanded ? <BsChevronDown /> : <BsChevronRight />}
                    </div>
                    
                    {editingTriggerId === group.id ? (
                      <input
                        autoFocus
                        value={group.name}
                        onChange={(e) => updateTrigger(group.id, 'name', e.target.value)}
                        onBlur={handleRenameComplete}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === 'Escape') handleRenameComplete();
                        }}
                        style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #ff9800', outline: 'none', padding: '2px', fontSize: '13px' }}
                      />
                    ) : (
                      <span
                        onDoubleClick={(e) => { e.stopPropagation(); setEditingTriggerId(group.id); }}
                        style={{ fontSize: '13px', fontWeight: 'bold', color: '#ff9800', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                      >
                        {group.name} ({groupChildren.length})
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button onClick={(e) => deleteTrigger(e, group.id)} title="Delete Group (Keep Triggers)" style={{ background: 'none', border: 'none', color: '#ff9800', cursor: 'pointer', opacity: 0.8, padding: 0 }}>
                      <BsTrash />
                    </button>
                    <button onClick={(e) => deleteGroupAndTriggers(e, group.id)} title="Delete Group and all Triggers" style={{ background: 'none', border: 'none', color: '#ff4444', cursor: 'pointer', opacity: 0.8, padding: 0 }}>
                      <BsTrashFill />
                    </button>
                  </div>
                </div>

                {/* Group Details (when active) */}
                {isActive && (
                  <div style={{ padding: '10px', borderTop: '1px solid #333', display: 'flex', flexDirection: 'column', gap: '8px', backgroundColor: '#222' }}>
                    <div style={{ fontSize: '10px', color: '#999', fontStyle: 'italic', marginBottom: '2px' }}>
                      Group properties override child trigger types and scripts.
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <label style={{ fontSize: '11px', color: '#aaa', width: '30px' }}>Type:</label>
                      <select value={group.type || 'enter'} onChange={(e) => updateTrigger(group.id, 'type', e.target.value)} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }}>
                        <option value="enter">On Enter</option>
                        <option value="leave">On Leave</option>
                        <option value="interact">On Interact</option>
                      </select>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <label style={{ fontSize: '11px', color: '#aaa', width: '45px' }}>Script:</label>
                      <select 
                        value={group.scriptId || ''} 
                        onChange={(e) => updateTrigger(group.id, 'scriptId', e.target.value || null)} 
                        style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }}
                      >
                        <option value="">[Dedicated Visual Nodes]</option>
                        {customScripts.filter(cs => cs.type !== 'group').map(cs => (
                          <option key={cs.id} value={cs.id}>{cs.name}</option>
                        ))}
                      </select>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                        {group.scriptId ? (
                          <button onClick={() => { setEditingCustomScriptId(group.scriptId); setTool('script'); }} style={{ background: 'transparent', color: '#888', border: 'none', padding: '2px 4px', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', borderRadius: '3px', flexShrink: 0 }} title="Edit Custom Script"><BsPencil /></button>
                        ) : group.script?.nodes?.length > 0 ? (
                          <button onClick={() => setEditingScriptTriggerId(group.id)} style={{ background: 'transparent', color: '#888', border: 'none', padding: '2px 4px', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', borderRadius: '3px', flexShrink: 0 }} title="Edit Script Graph"><BsPencil /></button>
                        ) : (
                          <button onClick={() => setEditingScriptTriggerId(group.id)} style={{ background: 'transparent', color: '#FF5722', border: 'none', padding: '2px 4px', cursor: 'pointer', fontSize: '15px', display: 'flex', alignItems: 'center', borderRadius: '3px', flexShrink: 0 }} title="Add Script"><BsPlus /></button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Group Children (indented list) */}
                {isExpanded && (
                  <div style={{ display: 'flex', flexDirection: 'column', backgroundColor: '#161616', borderTop: '1px solid #222' }}>
                    {groupChildren.length === 0 ? (
                      <div style={{ padding: '8px 25px', fontSize: '11px', color: '#666', fontStyle: 'italic' }}>
                        No triggers in this group.
                      </div>
                    ) : (
                      groupChildren.map(child => {
                        const isChildActive = activeTriggerId === child.id;
                        return (
                          <div
                            key={child.id}
                            onClick={(e) => { e.stopPropagation(); setActiveTriggerId(child.id); setTool('trigger'); }}
                            style={{
                              display: 'flex', flexDirection: 'column', padding: '8px 10px 8px 25px',
                              backgroundColor: isChildActive ? '#2c2c2c' : 'transparent',
                              borderBottom: '1px solid #222', cursor: 'pointer'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <span style={{ fontSize: '12px', color: isChildActive ? '#ff9800' : '#ccc' }}>
                                {child.name}
                              </span>
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <button onClick={(e) => ungroupTrigger(e, child.id)} title="Ungroup Trigger" style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: '11px' }}>
                                  Ungroup
                                </button>
                                <button onClick={(e) => deleteTrigger(e, child.id)} title="Delete Trigger" style={{ background: 'none', border: 'none', color: '#ff4444', cursor: 'pointer', opacity: 0.8, padding: 0 }}>
                                  <BsTrash />
                                </button>
                              </div>
                            </div>

                            {isChildActive && (
                              <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <div style={{ fontSize: '10px', color: '#888' }}>
                                  Type: <span style={{ color: '#ff9800', fontWeight: 'bold' }}>Inherited from Group ({group.type || 'enter'})</span>
                                </div>
                                <div style={{ fontSize: '10px', color: '#888' }}>
                                  Script: <span style={{ color: '#ff9800', fontWeight: 'bold' }}>
                                    {group.scriptId ? `Inherited Custom Script (${customScripts.find(cs => String(cs.id) === String(group.scriptId))?.name || 'Unknown'})`
                                      : group.script?.nodes?.length ? 'Inherited Group Node Graph'
                                      : child.scriptId
                                        ? `${customScripts.find(cs => String(cs.id) === String(child.scriptId))?.name || 'Custom Script'}`
                                        : child.script?.nodes?.length ? 'Has Node Graph' : 'None'}
                                  </span>
                                </div>

                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px' }}>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px' }}>
                                    <label style={{ fontSize: '10px', color: '#aaa', width: '45px' }}>X (tile):</label>
                                    {child.useVarX ? (
                                      <select value={child.varX || ''} onChange={(e) => updateTrigger(child.id, 'varX', e.target.value)} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #444', padding: '2px', fontSize: '10px', outline: 'none', borderRadius: '3px', minWidth: 0 }}>
                                        <option value="">Select Var</option>
                                        {variables.filter(v => v.type !== 'group').map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
                                      </select>
                                    ) : (
                                      <input type="number" value={Math.round(child.x / 8)} onChange={(e) => updateTrigger(child.id, 'x', (parseInt(e.target.value) || 0) * 8)} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #444', padding: '2px', fontSize: '10px', outline: 'none', borderRadius: '3px', minWidth: 0 }} />
                                    )}
                                    <button onClick={(e) => { e.stopPropagation(); updateTrigger(child.id, 'useVarX', !child.useVarX); }} title="Toggle Variable" style={{ background: child.useVarX ? '#FF5722' : '#333', color: '#fff', border: 'none', borderRadius: '3px', padding: '2px 4px', cursor: 'pointer', fontSize: '9px' }}>V</button>
                                  </div>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px' }}>
                                    <label style={{ fontSize: '10px', color: '#aaa', width: '45px' }}>Y (tile):</label>
                                    {child.useVarY ? (
                                      <select value={child.varY || ''} onChange={(e) => updateTrigger(child.id, 'varY', e.target.value)} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #444', padding: '2px', fontSize: '10px', outline: 'none', borderRadius: '3px', minWidth: 0 }}>
                                        <option value="">Select Var</option>
                                        {variables.filter(v => v.type !== 'group').map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
                                      </select>
                                    ) : (
                                      <input type="number" value={Math.round(child.y / 8)} onChange={(e) => updateTrigger(child.id, 'y', (parseInt(e.target.value) || 0) * 8)} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #444', padding: '2px', fontSize: '10px', outline: 'none', borderRadius: '3px', minWidth: 0 }} />
                                    )}
                                    <button onClick={(e) => { e.stopPropagation(); updateTrigger(child.id, 'useVarY', !child.useVarY); }} title="Toggle Variable" style={{ background: child.useVarY ? '#FF5722' : '#333', color: '#fff', border: 'none', borderRadius: '3px', padding: '2px 4px', cursor: 'pointer', fontSize: '9px' }}>V</button>
                                  </div>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px' }}>
                                    <label style={{ fontSize: '10px', color: '#aaa', width: '45px' }}>W (tile):</label>
                                    <input type="number" min="1" value={Math.round((child.width || 16) / 8)} onChange={(e) => updateTrigger(child.id, 'width', Math.max(1, parseInt(e.target.value) || 2) * 8)} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #444', padding: '2px', fontSize: '10px', outline: 'none', borderRadius: '3px', minWidth: 0 }} />
                                  </div>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px' }}>
                                    <label style={{ fontSize: '10px', color: '#aaa', width: '45px' }}>H (tile):</label>
                                    <input type="number" min="1" value={Math.round((child.height || 16) / 8)} onChange={(e) => updateTrigger(child.id, 'height', Math.max(1, parseInt(e.target.value) || 2) * 8)} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #444', padding: '2px', fontSize: '10px', outline: 'none', borderRadius: '3px', minWidth: 0 }} />
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Ungrouped Triggers List */}
          {ungroupedTriggers.map((trigger) => (
            <div key={trigger.id}
              onClick={() => { setActiveTriggerId(trigger.id); setTool('trigger'); }}
              style={{
                display: 'flex', flexDirection: 'column', padding: '10px',
                backgroundColor: activeTriggerId === trigger.id ? '#3c3c3c' : '#1e1e1e',
                borderRadius: '6px', cursor: 'pointer',
                border: activeTriggerId === trigger.id ? '1px solid #ff9800' : '1px solid transparent'
              }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, overflow: 'hidden' }}>
                  <input
                    type="checkbox"
                    checked={checkedIds.includes(trigger.id)}
                    onChange={(e) => handleCheckboxChange(e, trigger.id)}
                    onClick={(e) => e.stopPropagation()}
                    style={{ cursor: 'pointer' }}
                  />
                  {editingTriggerId === trigger.id ? (
                    <input
                      autoFocus
                      value={trigger.name}
                      onChange={(e) => updateTrigger(trigger.id, 'name', e.target.value)}
                      onBlur={handleRenameComplete}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === 'Escape') handleRenameComplete();
                      }}
                      style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #ff9800', outline: 'none', padding: '2px', fontSize: '13px' }}
                    />
                  ) : (
                    <span
                      onDoubleClick={(e) => { e.stopPropagation(); setEditingTriggerId(trigger.id); }}
                      style={{ fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                    >
                      {trigger.name}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={(e) => deleteTrigger(e, trigger.id)} style={{ background: 'none', border: 'none', color: '#ff4444', cursor: 'pointer', opacity: 0.8, padding: 0 }}>
                    <BsTrash />
                  </button>
                </div>
              </div>

              {activeTriggerId === trigger.id && (
                <div style={{ marginTop: '10px', borderTop: '1px solid #555', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <label style={{ fontSize: '11px', color: '#aaa', width: '30px' }}>Type:</label>
                    <select value={trigger.type} onChange={(e) => updateTrigger(trigger.id, 'type', e.target.value)} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }}>
                      <option value="enter">On Enter</option>
                      <option value="leave">On Leave</option>
                      <option value="interact">On Interact</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px' }}>
                      <label style={{ fontSize: '11px', color: '#aaa', width: '45px' }}>X (tile):</label>
                      {trigger.useVarX ? (
                        <select value={trigger.varX || ''} onChange={(e) => updateTrigger(trigger.id, 'varX', e.target.value)} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px', minWidth: 0 }}>
                          <option value="">Select Var</option>
                          {variables.filter(v => v.type !== 'group').map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
                        </select>
                      ) : (
                        <input type="number" value={Math.round(trigger.x / 8)} onChange={(e) => updateTrigger(trigger.id, 'x', (parseInt(e.target.value) || 0) * 8)} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px', minWidth: 0 }} />
                      )}
                      <button onClick={(e) => { e.stopPropagation(); updateTrigger(trigger.id, 'useVarX', !trigger.useVarX); }} title="Toggle Variable" style={{ background: trigger.useVarX ? '#FF5722' : '#333', color: '#fff', border: 'none', borderRadius: '3px', padding: '4px 6px', cursor: 'pointer', fontSize: '10px' }}>V</button>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px' }}>
                      <label style={{ fontSize: '11px', color: '#aaa', width: '45px' }}>Y (tile):</label>
                      {trigger.useVarY ? (
                        <select value={trigger.varY || ''} onChange={(e) => updateTrigger(trigger.id, 'varY', e.target.value)} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px', minWidth: 0 }}>
                          <option value="">Select Var</option>
                          {variables.filter(v => v.type !== 'group').map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
                        </select>
                      ) : (
                        <input type="number" value={Math.round(trigger.y / 8)} onChange={(e) => updateTrigger(trigger.id, 'y', (parseInt(e.target.value) || 0) * 8)} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px', minWidth: 0 }} />
                      )}
                      <button onClick={(e) => { e.stopPropagation(); updateTrigger(trigger.id, 'useVarY', !trigger.useVarY); }} title="Toggle Variable" style={{ background: trigger.useVarY ? '#FF5722' : '#333', color: '#fff', border: 'none', borderRadius: '3px', padding: '4px 6px', cursor: 'pointer', fontSize: '10px' }}>V</button>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px' }}>
                      <label style={{ fontSize: '11px', color: '#aaa', width: '45px' }}>W (tile):</label>
                      <input type="number" min="1" value={Math.round((trigger.width || 16) / 8)} onChange={(e) => updateTrigger(trigger.id, 'width', Math.max(1, parseInt(e.target.value) || 2) * 8)} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px', minWidth: 0 }} />
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px' }}>
                      <label style={{ fontSize: '11px', color: '#aaa', width: '45px' }}>H (tile):</label>
                      <input type="number" min="1" value={Math.round((trigger.height || 16) / 8)} onChange={(e) => updateTrigger(trigger.id, 'height', Math.max(1, parseInt(e.target.value) || 2) * 8)} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px', minWidth: 0 }} />
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <label style={{ fontSize: '11px', color: '#aaa', width: '45px' }}>Script:</label>
                    <select 
                      value={trigger.scriptId || ''} 
                      onChange={(e) => updateTrigger(trigger.id, 'scriptId', e.target.value || null)} 
                      style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }}
                    >
                      <option value="">[Dedicated Visual Nodes]</option>
                      {customScripts.filter(cs => cs.type !== 'group').map(cs => (
                        <option key={cs.id} value={cs.id}>{cs.name}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                    {trigger.scriptId ? (
                      <button onClick={() => { setEditingCustomScriptId(trigger.scriptId); setTool('script'); }} style={{ background: 'transparent', color: '#888', border: 'none', padding: '2px 4px', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', borderRadius: '3px', flexShrink: 0 }} title="Edit Custom Script"><BsPencil /></button>
                    ) : (
                      <button onClick={() => setEditingScriptTriggerId(trigger.id)} style={{ background: 'transparent', color: '#FF5722', border: 'none', padding: '2px 4px', cursor: 'pointer', fontSize: '15px', display: 'flex', alignItems: 'center', borderRadius: '3px', flexShrink: 0 }} title="Edit Script"><BsPlus /></button>
                    )}
                  </div>

                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TriggersPanel;