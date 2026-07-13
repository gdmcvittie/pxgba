import { useState } from 'react';
import { usePxShop } from '../context/PxShopContext';
import { BsBoundingBox, BsPlus, BsTrash, BsTrashFill, BsChevronDown, BsChevronRight } from 'react-icons/bs';

const CollisionsPanel = ({ isCollapsed, onToggle, dragProps }) => {
  const [editingCollisionId, setEditingCollisionId] = useState(null);
  const [checkedIds, setCheckedIds] = useState([]);
  const [expandedGroupIds, setExpandedGroupIds] = useState(new Set());

  const {
    collisions, setCollisions,
    activeCollisionId, setActiveCollisionId,
    tool, setTool,
    saveHistory, layers, dimensions,
    selection, fillSelectionWithCollision
  } = usePxShop();

  const handleRenameComplete = () => {
    setEditingCollisionId(null);
  };

  const addCollision = (e) => {
    e.stopPropagation();
    const newCollision = {
      id: Date.now() + Math.random(),
      name: `Collision ${collisions.length + 1}`,
      type: 'solid',
      x: 0,
      y: 0,
      width: 8,
      height: 8
    };
    const nextCollisions = [...collisions, newCollision];
    setCollisions(nextCollisions);
    setActiveCollisionId(newCollision.id);
    setTool('collision');
    saveHistory("Add Collision", layers, dimensions, { collisions: nextCollisions });
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

  const groupSelectedCollisions = () => {
    if (checkedIds.length === 0) return;
    const groupId = Date.now() + Math.random();
    const nextGroup = {
      id: groupId,
      name: `Group ${collisions.filter(c => c.isGroup).length + 1}`,
      isGroup: true,
      type: 'solid',
      angle: 45
    };
    const nextCollisions = [
      ...collisions.map(c => checkedIds.includes(c.id) ? { ...c, groupId } : c),
      nextGroup
    ];
    setCollisions(nextCollisions);
    setActiveCollisionId(groupId);
    setCheckedIds([]);
    setExpandedGroupIds(prev => {
      const next = new Set(prev);
      next.add(groupId);
      return next;
    });
    saveHistory("Group Collisions", layers, dimensions, { collisions: nextCollisions });
  };

  const deleteCollision = (e, id) => {
    e.stopPropagation();
    const itemToDelete = collisions.find(c => c.id === id);
    let nextCollisions;
    if (itemToDelete?.isGroup) {
      nextCollisions = collisions
        .filter(c => c.id !== id)
        .map(c => c.groupId === id ? { ...c, groupId: null } : c);
    } else {
      nextCollisions = collisions.filter(c => c.id !== id);
    }
    setCollisions(nextCollisions);
    if (activeCollisionId === id) setActiveCollisionId(null);
    saveHistory(itemToDelete?.isGroup ? "Delete Group" : "Delete Collision", layers, dimensions, { collisions: nextCollisions });
  };

  const deleteGroupAndCollisions = (e, id) => {
    e.stopPropagation();
    const nextCollisions = collisions.filter(c => c.id !== id && c.groupId !== id);
    setCollisions(nextCollisions);
    if (activeCollisionId === id) setActiveCollisionId(null);
    saveHistory("Delete Group and Collisions", layers, dimensions, { collisions: nextCollisions });
  };

  const ungroupCollision = (e, id) => {
    e.stopPropagation();
    const nextCollisions = collisions.map(c => c.id === id ? { ...c, groupId: null } : c);
    setCollisions(nextCollisions);
    saveHistory("Ungroup Collision", layers, dimensions, { collisions: nextCollisions });
  };

  const updateCollision = (id, prop, value) => {
    setCollisions(collisions.map(c => {
      if (c.id === id) {
        return { ...c, [prop]: value };
      }
      return c;
    }));
  };

  const handleSelectAll = (e) => {
    e.stopPropagation();
    if (checkedIds.length === ungroupedCollisions.length) {
      setCheckedIds([]);
    } else {
      setCheckedIds(ungroupedCollisions.map(c => c.id));
    }
  };

  const groups = collisions.filter(c => c.isGroup);
  const ungroupedCollisions = collisions.filter(c => !c.isGroup && (!c.groupId || !groups.some(g => g.id === c.groupId)));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: isCollapsed ? 'none' : 1, borderBottom: '2px solid #222', minHeight: 0, background: isCollapsed ? 'transparent' : '#3c3733' }}>
      <div
        onClick={onToggle}
        style={{ padding: '15px', borderBottom: isCollapsed ? 'none' : '1px solid #3c3c3c', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'grab', userSelect: 'none', background: '#3b200e' }}
        {...dragProps}
      >
        <span style={{ fontWeight: 'bold', fontSize: '11px', textTransform: 'uppercase', color: isCollapsed ? '#aaa' : '#FF5722', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BsBoundingBox /> Collisions
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={e => { if (isCollapsed) { onToggle(); } e.stopPropagation(); }}>
          {selection && selection.size > 0 && (
            <button 
              onClick={(e) => { e.stopPropagation(); fillSelectionWithCollision(); }} 
              title="Fill Selection with Collision" 
              style={{ backgroundColor: 'transparent', border: '1px solid #555', color: '#888', padding: '3px 7px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', fontSize: '11px', fontWeight: 'bold', transition: 'all 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#2196F3'; e.currentTarget.style.color = '#2196F3'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#555'; e.currentTarget.style.color = '#888'; }}
            >
              Fill Sel
            </button>
          )}
          <button onClick={addCollision} title="Add Collision" style={{ backgroundColor: 'transparent', border: '1px solid #555', color: '#888', padding: '3px 7px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'all 0.2s' }} onMouseEnter={e => { e.currentTarget.style.borderColor = '#FF5722'; e.currentTarget.style.color = '#FF5722'; }} onMouseLeave={e => { e.currentTarget.style.borderColor = '#555'; e.currentTarget.style.color = '#888'; }}><BsPlus /></button>
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
                  onClick={groupSelectedCollisions}
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
            const groupChildren = collisions.filter(c => c.groupId === group.id);
            const isActive = activeCollisionId === group.id;

            return (
              <div key={group.id} style={{ display: 'flex', flexDirection: 'column', border: isActive ? '1px solid #2196F3' : '1px solid #333', borderRadius: '6px', backgroundColor: '#1e1e1e', overflow: 'auto' }}>
                {/* Group Header */}
                <div
                  onClick={() => { setActiveCollisionId(group.id); setTool('collision'); }}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 10px', backgroundColor: isActive ? '#2d2d2d' : '#1a1a1a',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, overflow: 'hidden', overflow: 'auto' }}>
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
                    
                    {editingCollisionId === group.id ? (
                      <input
                        autoFocus
                        value={group.name}
                        onChange={(e) => updateCollision(group.id, 'name', e.target.value)}
                        onBlur={handleRenameComplete}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === 'Escape') handleRenameComplete();
                        }}
                        style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #2196F3', outline: 'none', padding: '2px', fontSize: '13px' }}
                      />
                    ) : (
                      <span
                        onDoubleClick={(e) => { e.stopPropagation(); setEditingCollisionId(group.id); }}
                        style={{ fontSize: '13px', fontWeight: 'bold', color: '#2196F3', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                      >
                        {group.name} ({groupChildren.length})
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button onClick={(e) => deleteCollision(e, group.id)} title="Delete Group (Keep Collisions)" style={{ background: 'none', border: 'none', color: '#ff9800', cursor: 'pointer', opacity: 0.8, padding: 0 }}>
                      <BsTrash />
                    </button>
                    <button onClick={(e) => deleteGroupAndCollisions(e, group.id)} title="Delete Group and all Collisions" style={{ background: 'none', border: 'none', color: '#ff4444', cursor: 'pointer', opacity: 0.8, padding: 0 }}>
                      <BsTrashFill />
                    </button>
                  </div>
                </div>

                {/* Group Details (when active) */}
                {isActive && (
                  <div style={{ padding: '10px', borderTop: '1px solid #333', display: 'flex', flexDirection: 'column', gap: '8px', backgroundColor: '#222' }}>
                    <div style={{ fontSize: '10px', color: '#999', fontStyle: 'italic', marginBottom: '2px' }}>
                      Group properties override child collision types.
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <label style={{ fontSize: '11px', color: '#aaa', width: '30px' }}>Type:</label>
                      <select value={group.type || 'solid'} onChange={(e) => updateCollision(group.id, 'type', e.target.value)} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }}>
                        <option value="solid">Solid</option>
                        <option value="top">Top</option>
                        <option value="bottom">Bottom</option>
                        <option value="left">Left</option>
                        <option value="right">Right</option>
                        <option value="ladder">Ladder</option>
                        <option value="slope-up">Slope Up</option>
                        <option value="slope-down">Slope Down</option>
                      </select>
                    </div>

                    {((group.type || 'solid') === 'slope-up' || (group.type || 'solid') === 'slope-down') && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ fontSize: '11px', color: '#aaa', width: '35px' }}>Angle:</label>
                        <input
                          type="number"
                          min="1"
                          max="89"
                          value={group.angle !== undefined ? group.angle : 45}
                          onChange={(e) => updateCollision(group.id, 'angle', Math.max(1, Math.min(89, parseInt(e.target.value) || 0)))}
                          style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Group Children (indented list) */}
                {isExpanded && (
                  <div style={{ display: 'flex', flexDirection: 'column', backgroundColor: '#161616', borderTop: '1px solid #222' }}>
                    {groupChildren.length === 0 ? (
                      <div style={{ padding: '8px 25px', fontSize: '11px', color: '#666', fontStyle: 'italic' }}>
                        No collisions in this group.
                      </div>
                    ) : (
                      groupChildren.map(child => {
                        const isChildActive = activeCollisionId === child.id;
                        return (
                          <div
                            key={child.id}
                            onClick={(e) => { e.stopPropagation(); setActiveCollisionId(child.id); setTool('collision'); }}
                            style={{
                              display: 'flex', flexDirection: 'column', padding: '8px 10px 8px 25px',
                              backgroundColor: isChildActive ? '#2c2c2c' : 'transparent',
                              borderBottom: '1px solid #222', cursor: 'pointer'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <span style={{ fontSize: '12px', color: isChildActive ? '#f44336' : '#ccc' }}>
                                {child.name}
                              </span>
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <button
                                  onClick={(e) => ungroupCollision(e, child.id)}
                                  title="Ungroup collision"
                                  style={{ background: 'none', border: 'none', color: '#2196F3', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', padding: 0 }}
                                >
                                  Ungroup
                                </button>
                                <button
                                  onClick={(e) => deleteCollision(e, child.id)}
                                  title="Delete Collision"
                                  style={{ background: 'none', border: 'none', color: '#ff4444', cursor: 'pointer', opacity: 0.8, padding: 0 }}
                                >
                                  <BsTrash />
                                </button>
                              </div>
                            </div>

                            {/* Render coordinate display if child is active */}
                            {isChildActive && (
                              <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <div style={{ fontSize: '10px', color: '#ff9800', fontStyle: 'italic' }}>
                                  Type: {group.type} (Overridden by group)
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px' }}>
                                    <label style={{ fontSize: '10px', color: '#aaa', width: '45px' }}>X (tile):</label>
                                    <input type="number" value={Math.round(child.x / 8)} onChange={(e) => updateCollision(child.id, 'x', (parseInt(e.target.value) || 0) * 8)} style={{ width: '40px', background: '#111', color: '#fff', border: '1px solid #444', padding: '2px', fontSize: '10px', outline: 'none', borderRadius: '3px' }} />
                                  </div>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px' }}>
                                    <label style={{ fontSize: '10px', color: '#aaa', width: '45px' }}>Y (tile):</label>
                                    <input type="number" value={Math.round(child.y / 8)} onChange={(e) => updateCollision(child.id, 'y', (parseInt(e.target.value) || 0) * 8)} style={{ width: '40px', background: '#111', color: '#fff', border: '1px solid #444', padding: '2px', fontSize: '10px', outline: 'none', borderRadius: '3px' }} />
                                  </div>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px', opacity: child.isPainted ? 0.5 : 1 }} title={child.isPainted ? "Painted collisions have a fixed 8x8 size" : ""}>
                                    <label style={{ fontSize: '10px', color: '#aaa', width: '45px' }}>W (tile):</label>
                                    <input 
                                      type="number" 
                                      min="1" 
                                      disabled={child.isPainted} 
                                      value={Math.round((child.width || 8) / 8)} 
                                      onChange={(e) => updateCollision(child.id, 'width', Math.max(1, parseInt(e.target.value) || 1) * 8)} 
                                      style={{ 
                                        width: '40px', 
                                        background: '#111', 
                                        color: '#fff', 
                                        border: '1px solid #444', 
                                        padding: '2px', 
                                        fontSize: '10px', 
                                        outline: 'none', 
                                        borderRadius: '3px',
                                        cursor: child.isPainted ? 'not-allowed' : 'default'
                                      }} 
                                    />
                                  </div>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px', opacity: child.isPainted ? 0.5 : 1 }} title={child.isPainted ? "Painted collisions have a fixed 8x8 size" : ""}>
                                    <label style={{ fontSize: '10px', color: '#aaa', width: '45px' }}>H (tile):</label>
                                    <input 
                                      type="number" 
                                      min="1" 
                                      disabled={child.isPainted} 
                                      value={Math.round((child.height || 8) / 8)} 
                                      onChange={(e) => updateCollision(child.id, 'height', Math.max(1, parseInt(e.target.value) || 1) * 8)} 
                                      style={{ 
                                        width: '40px', 
                                        background: '#111', 
                                        color: '#fff', 
                                        border: '1px solid #444', 
                                        padding: '2px', 
                                        fontSize: '10px', 
                                        outline: 'none', 
                                        borderRadius: '3px',
                                        cursor: child.isPainted ? 'not-allowed' : 'default'
                                      }} 
                                    />
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

          {/* Ungrouped Collisions List */}
          {ungroupedCollisions.length > 0 && (
            <div 
              onClick={handleSelectAll}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', backgroundColor: '#1a1a1a', borderRadius: '4px', cursor: 'pointer', border: '1px solid #333' }}
            >
              <input
                type="checkbox"
                checked={checkedIds.length > 0 && checkedIds.length === ungroupedCollisions.length}
                onChange={handleSelectAll}
                onClick={(e) => e.stopPropagation()}
                style={{ cursor: 'pointer' }}
              />
              <span style={{ fontSize: '11px', color: '#aaa', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Select All ({ungroupedCollisions.length} Ungrouped)
              </span>
            </div>
          )}

          {ungroupedCollisions.map((collision) => {
            const isActive = activeCollisionId === collision.id;
            const isChecked = checkedIds.includes(collision.id);

            return (
              <div key={collision.id}
                onClick={() => { setActiveCollisionId(collision.id); setTool('collision'); }}
                style={{
                  display: 'flex', flexDirection: 'column', padding: '10px',
                  backgroundColor: isActive ? '#3c3c3c' : '#1e1e1e',
                  borderRadius: '6px', cursor: 'pointer',
                  border: isActive ? '1px solid #f44336' : '1px solid transparent'
                }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, overflow: 'hidden' }}>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => handleCheckboxChange(e, collision.id)}
                      onClick={(e) => e.stopPropagation()}
                      style={{ cursor: 'pointer' }}
                    />
                    
                    {editingCollisionId === collision.id ? (
                      <input
                        autoFocus
                        value={collision.name}
                        onChange={(e) => updateCollision(collision.id, 'name', e.target.value)}
                        onBlur={handleRenameComplete}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === 'Escape') handleRenameComplete();
                        }}
                        style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #f44336', outline: 'none', padding: '2px', fontSize: '13px' }}
                      />
                    ) : (
                      <span
                        onDoubleClick={(e) => { e.stopPropagation(); setEditingCollisionId(collision.id); }}
                        style={{ fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                      >
                        {collision.name}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={(e) => deleteCollision(e, collision.id)} style={{ background: 'none', border: 'none', color: '#ff4444', cursor: 'pointer', opacity: 0.8, padding: 0 }}>
                      <BsTrash />
                    </button>
                  </div>
                </div>

                {isActive && (
                  <div style={{ marginTop: '10px', borderTop: '1px solid #555', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <label style={{ fontSize: '11px', color: '#aaa', width: '30px' }}>Type:</label>
                      <select value={collision.type} onChange={(e) => updateCollision(collision.id, 'type', e.target.value)} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }}>
                        <option value="solid">Solid</option>
                        <option value="top">Top</option>
                        <option value="bottom">Bottom</option>
                        <option value="left">Left</option>
                        <option value="right">Right</option>
                        <option value="ladder">Ladder</option>
                        <option value="slope-up">Slope Up</option>
                        <option value="slope-down">Slope Down</option>
                      </select>
                    </div>

                    {(collision.type === 'slope-up' || collision.type === 'slope-down') && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ fontSize: '11px', color: '#aaa', width: '35px' }}>Angle:</label>
                        <input
                          type="number"
                          min="1"
                          max="89"
                          value={collision.angle !== undefined ? collision.angle : 45}
                          onChange={(e) => updateCollision(collision.id, 'angle', Math.max(1, Math.min(89, parseInt(e.target.value) || 0)))}
                          style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }}
                        />
                      </div>
                    )}

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px' }}>
                        <label style={{ fontSize: '11px', color: '#aaa', width: '45px' }}>X (tile):</label>
                        <input type="number" value={Math.round(collision.x / 8)} onChange={(e) => updateCollision(collision.id, 'x', (parseInt(e.target.value) || 0) * 8)} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px', minWidth: 0 }} />
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px' }}>
                        <label style={{ fontSize: '11px', color: '#aaa', width: '45px' }}>Y (tile):</label>
                        <input type="number" value={Math.round(collision.y / 8)} onChange={(e) => updateCollision(collision.id, 'y', (parseInt(e.target.value) || 0) * 8)} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px', minWidth: 0 }} />
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px', opacity: collision.isPainted ? 0.5 : 1 }} title={collision.isPainted ? "Painted collisions have a fixed 8x8 size" : ""}>
                        <label style={{ fontSize: '11px', color: '#aaa', width: '45px' }}>W (tile):</label>
                        <input 
                          type="number" 
                          min="1" 
                          disabled={collision.isPainted} 
                          value={Math.round((collision.width || 16) / 8)} 
                          onChange={(e) => updateCollision(collision.id, 'width', Math.max(1, parseInt(e.target.value) || 2) * 8)} 
                          style={{ 
                            flex: 1, 
                            background: '#111', 
                            color: '#fff', 
                            border: '1px solid #444', 
                            padding: '4px', 
                            fontSize: '11px', 
                            outline: 'none', 
                            borderRadius: '3px', 
                            minWidth: 0,
                            cursor: collision.isPainted ? 'not-allowed' : 'default'
                          }} 
                        />
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px', opacity: collision.isPainted ? 0.5 : 1 }} title={collision.isPainted ? "Painted collisions have a fixed 8x8 size" : ""}>
                        <label style={{ fontSize: '11px', color: '#aaa', width: '45px' }}>H (tile):</label>
                        <input 
                          type="number" 
                          min="1" 
                          disabled={collision.isPainted} 
                          value={Math.round((collision.height || 16) / 8)} 
                          onChange={(e) => updateCollision(collision.id, 'height', Math.max(1, parseInt(e.target.value) || 2) * 8)} 
                          style={{ 
                            flex: 1, 
                            background: '#111', 
                            color: '#fff', 
                            border: '1px solid #444', 
                            padding: '4px', 
                            fontSize: '11px', 
                            outline: 'none', 
                            borderRadius: '3px', 
                            minWidth: 0,
                            cursor: collision.isPainted ? 'not-allowed' : 'default'
                          }} 
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CollisionsPanel;