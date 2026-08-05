import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Panel,
  Handle,
  Position,
  useReactFlow,
  ReactFlowProvider
} from 'reactflow';
import 'reactflow/dist/style.css';
import { usePxShop } from '../context/PxShopContext';

const CustomStartNode = ({ id, data }) => {
  const { setNodes } = useReactFlow();

  const updateData = (newData) => {
    setNodes((nds) =>
      nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...newData } } : n))
    );
  };

  return (
    <div style={{ background: '#222', border: '2px solid #4CAF50', borderRadius: '5px', padding: '10px', minWidth: '160px', color: '#fff' }}>
      <div style={{ fontWeight: 'bold', fontSize: '12px', marginBottom: '8px', borderBottom: '1px solid #555', paddingBottom: '4px', color: '#4CAF50', textAlign: 'center' }}>Trigger Event</div>

      {data.options && data.options.length > 1 ? (
        <select
          className="nodrag"
          value={data.label || ''}
          onChange={(e) => updateData({ label: e.target.value })}
          style={{ width: '100%', background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }}
        >
          {data.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      ) : (
        <div style={{ fontSize: '12px', textAlign: 'center', color: '#fff', padding: '4px 0' }}>{data.label}</div>
      )}

      <Handle type="source" position={Position.Right} />
    </div>
  );
};

const CustomActionNode = ({ id, data }) => {
  const { setNodes, setEdges } = useReactFlow();
  const {
    variables,
    savedTiles,
    scenes,
    customScripts,
    animations,
    actors,
    globalActors,
    musicTracks
  } = usePxShop();

  const updateData = useCallback((newData) => {
    setNodes((nds) =>
      nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...newData } } : n))
    );
  }, [id, setNodes]);

  const handleDeleteNode = () => {
    setNodes((nds) => nds.filter((n) => n.id !== id));
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
  };

  return (
    <div style={{ background: '#333', border: '1px solid #555', borderRadius: '5px', padding: '10px', minWidth: '160px', color: '#fff', position: 'relative' }}>
      <Handle type="target" position={Position.Left} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', borderBottom: '1px solid #555', paddingBottom: '4px' }}>
        <div style={{ fontWeight: 'bold', fontSize: '12px', color: '#4CAF50' }}>{data.label}</div>
        <button
          className="nodrag"
          onClick={handleDeleteNode}
          style={{
            background: 'none',
            border: 'none',
            color: '#ff4444',
            cursor: 'pointer',
            fontSize: '11px',
            padding: '0 4px',
            fontWeight: 'bold',
            lineHeight: 1
          }}
          title="Delete Node"
        >
          ✕
        </button>
      </div>

      {data.actionType === 'dialog' && (
        <textarea
          className="nodrag"
          value={data.message || ''}
          onChange={(e) => updateData({ message: e.target.value })}
          placeholder="Enter dialog text..."
          style={{ width: '100%', minHeight: '50px', background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', resize: 'vertical' }}
        />
      )}

      {data.actionType === 'move' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div>
            <label style={{ fontSize: '10px', color: '#aaa', display: 'block', marginBottom: '2px' }}>Actor:</label>
            <select
              className="nodrag"
              value={data.targetActorId || ''}
              onChange={(e) => {
                const val = e.target.value;
                updateData({ targetActorId: val ? (isNaN(val) ? val : Number(val)) : null });
              }}
              style={{ width: '100%', background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }}
            >
              <option value="">Self (If Actor Script)</option>
              {actors && actors.filter(a => a.type !== 'group').length > 0 && (
                <optgroup label="Scene Actors">
                  {actors.filter(a => a.type !== 'group').map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </optgroup>
              )}
              {globalActors && globalActors.filter(a => a.type !== 'group').length > 0 && (
                <optgroup label="Global Actors">
                  {globalActors.filter(a => a.type !== 'group').map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </optgroup>
              )}
            </select>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '10px', color: '#aaa', display: 'block', marginBottom: '2px' }}>X Coord:</label>
              <input className="nodrag" type="number" value={data.x || 0} onChange={(e) => updateData({ x: parseInt(e.target.value) || 0 })} style={{ width: '100%', background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '10px', color: '#aaa', display: 'block', marginBottom: '2px' }}>Y Coord:</label>
              <input className="nodrag" type="number" value={data.y || 0} onChange={(e) => updateData({ y: parseInt(e.target.value) || 0 })} style={{ width: '100%', background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
          </div>
        </div>
      )}

      {data.actionType === 'destroy_actor' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div>
            <label style={{ fontSize: '10px', color: '#aaa', display: 'block', marginBottom: '2px' }}>Actor:</label>
            <select
              className="nodrag"
              value={data.targetActorId || ''}
              onChange={(e) => {
                const val = e.target.value;
                updateData({ targetActorId: val ? (isNaN(val) ? val : Number(val)) : null });
              }}
              style={{ width: '100%', background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }}
            >
              <option value="">Self (If Actor Script)</option>
              {actors && actors.filter(a => a.type !== 'group').length > 0 && (
                <optgroup label="Scene Actors">
                  {actors.filter(a => a.type !== 'group').map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </optgroup>
              )}
              {globalActors && globalActors.filter(a => a.type !== 'group').length > 0 && (
                <optgroup label="Global Actors">
                  {globalActors.filter(a => a.type !== 'group').map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </optgroup>
              )}
            </select>
          </div>
        </div>
      )}

      {data.actionType === 'show_image' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div>
            <label style={{ fontSize: '10px', color: '#aaa', display: 'block', marginBottom: '2px' }}>Image (Scene):</label>
            {scenes && scenes.filter(s => s.type !== 'group').length > 0 ? (
              <select className="nodrag" value={data.sceneId || ''} onChange={(e) => updateData({ sceneId: e.target.value ? (isNaN(e.target.value) ? e.target.value : Number(e.target.value)) : null })} style={{ width: '100%', background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }}>
                <option value="">Select a scene...</option>
                {scenes.filter(s => s.type !== 'group').map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            ) : (
              <span style={{ fontSize: '10px', color: '#888' }}>No scenes available</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <input type="checkbox" className="nodrag" checked={data.waitInput !== false} onChange={(e) => updateData({ waitInput: e.target.checked })} />
              <label style={{ fontSize: '10px', color: '#aaa' }}>Wait for A</label>
            </div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <label style={{ fontSize: '10px', color: '#aaa' }}>Frames:</label>
              <input className="nodrag" type="number" min="0" value={data.waitFrames || 0} onChange={(e) => updateData({ waitFrames: parseInt(e.target.value) || 0 })} style={{ width: '50px', background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none' }} />
            </div>
          </div>
        </div>
      )}

      {data.actionType === 'wait' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div>
            <label style={{ fontSize: '10px', color: '#aaa', display: 'block', marginBottom: '2px' }}>Frames (60 = 1s):</label>
            <input className="nodrag" type="number" min="1" value={data.frames || 60} onChange={(e) => updateData({ frames: parseInt(e.target.value) || 60 })} style={{ width: '100%', background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }} />
          </div>
        </div>
      )}

      {data.actionType === 'set_bg_color' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <label style={{ fontSize: '10px', color: '#aaa', width: '60px' }}>Color:</label>
            <input className="nodrag" type="color" value={data.color || '#000000'} onChange={(e) => updateData({ color: e.target.value })} style={{ flex: 1, height: '24px', padding: 0, border: 'none', background: 'transparent', cursor: 'pointer' }} />
          </div>
        </div>
      )}

      {data.actionType === 'shoot_projectile' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div>
            <label style={{ fontSize: '10px', color: '#aaa', display: 'block', marginBottom: '2px' }}>Dir Mode:</label>
            <select className="nodrag" value={data.dirMode || "vector"} onChange={(e) => updateData({ dirMode: e.target.value })} style={{ width: '100%', background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }}>
              <option value="vector">Manual Vector</option>
              <option value="facing">Facing / Movement</option>
              <option value="angle">Angle (Degrees)</option>
              <option value="target_enemy">Toward Nearest Enemy</option>
              <option value="target_player">Toward Player</option>
            </select>
          </div>
          {(data.dirMode === 'vector' || !data.dirMode) && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '10px', color: '#aaa', display: 'block', marginBottom: '2px' }}>Vel X:</label>
                <input className="nodrag" type="number" value={data.dx || 0} onChange={(e) => updateData({ dx: parseInt(e.target.value) || 0 })} style={{ width: '100%', background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '10px', color: '#aaa', display: 'block', marginBottom: '2px' }}>Vel Y:</label>
                <input className="nodrag" type="number" value={data.dy || 0} onChange={(e) => updateData({ dy: parseInt(e.target.value) || 0 })} style={{ width: '100%', background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
            </div>
          )}
          {data.dirMode && data.dirMode !== 'vector' && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '10px', color: '#aaa', display: 'block', marginBottom: '2px' }}>Speed:</label>
                <input className="nodrag" type="number" step="0.5" value={data.speed ?? 3} onChange={(e) => updateData({ speed: parseFloat(e.target.value) || 0 })} style={{ width: '100%', background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              {data.dirMode === 'angle' && (
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '10px', color: '#aaa', display: 'block', marginBottom: '2px' }}>Angle (°):</label>
                  <input className="nodrag" type="number" value={data.angle ?? 0} onChange={(e) => updateData({ angle: parseInt(e.target.value) || 0 })} style={{ width: '100%', background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
              )}
            </div>
          )}
          <div>
            <label style={{ fontSize: '10px', color: '#aaa', display: 'block', marginBottom: '2px' }}>Sprite:</label>
            <select className="nodrag" value={data.spriteId || ""} onChange={(e) => updateData({ spriteId: e.target.value ? Number(e.target.value) : null })} style={{ width: '100%', background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }}>
              <option value="">Default (White Circle)</option>
              {savedTiles && savedTiles.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        </div>
      )}

      {data.actionType === 'move_camera' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div>
            <label style={{ fontSize: '10px', color: '#aaa', display: 'block', marginBottom: '2px' }}>Target:</label>
            <select className="nodrag" value={data.targetType || 'custom'} onChange={(e) => updateData({ targetType: e.target.value })} style={{ width: '100%', background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }}>
              <option value="custom">Move to Coordinates</option>
              <option value="reset">Reset / Follow Player</option>
            </select>
          </div>
          {(data.targetType || 'custom') === 'custom' && (
            <>
              <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '10px', color: '#aaa', display: 'block', marginBottom: '2px' }}>X Tile:</label>
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    {data.useVarX ? (
                      <select className="nodrag" value={data.x || ''} onChange={(e) => updateData({ x: e.target.value })} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }}>
                        <option value="">Select Var</option>
                        {variables && variables.filter(v => v.type !== 'group').map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
                      </select>
                    ) : (
                      <input className="nodrag" type="text" placeholder="e.g. 15" value={data.x ?? '0'} onChange={(e) => updateData({ x: e.target.value.replace(/[^0-9]/g, '') })} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }} />
                    )}
                    <button className="nodrag" onClick={(e) => { e.stopPropagation(); updateData({ useVarX: !data.useVarX, x: data.useVarX ? '0' : '' }); }} title="Toggle Variable" style={{ background: data.useVarX ? '#4CAF50' : '#333', color: '#fff', border: 'none', borderRadius: '3px', padding: '4px 6px', cursor: 'pointer', fontSize: '10px', height: '23px', display: 'flex', alignItems: 'center' }}>V</button>
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '10px', color: '#aaa', display: 'block', marginBottom: '2px' }}>Y Tile:</label>
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    {data.useVarY ? (
                      <select className="nodrag" value={data.y || ''} onChange={(e) => updateData({ y: e.target.value })} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }}>
                        <option value="">Select Var</option>
                        {variables && variables.filter(v => v.type !== 'group').map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
                      </select>
                    ) : (
                      <input className="nodrag" type="text" placeholder="e.g. 10" value={data.y ?? '0'} onChange={(e) => updateData({ y: e.target.value.replace(/[^0-9]/g, '') })} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }} />
                    )}
                    <button className="nodrag" onClick={(e) => { e.stopPropagation(); updateData({ useVarY: !data.useVarY, y: data.useVarY ? '0' : '' }); }} title="Toggle Variable" style={{ background: data.useVarY ? '#4CAF50' : '#333', color: '#fff', border: 'none', borderRadius: '3px', padding: '4px 6px', cursor: 'pointer', fontSize: '10px', height: '23px', display: 'flex', alignItems: 'center' }}>V</button>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <div style={{ flex: 1.2 }}>
                  <label style={{ fontSize: '10px', color: '#aaa', display: 'block', marginBottom: '2px' }}>Speed (px/f):</label>
                  <input className="nodrag" type="text" placeholder="e.g. 2" value={data.speed ?? '2'} onChange={(e) => {
                    let val = e.target.value.replace(/[^0-9.]/g, '');
                    const parts = val.split('.');
                    if (parts.length > 2) {
                      val = parts[0] + '.' + parts.slice(1).join('');
                    }
                    updateData({ speed: val });
                  }} style={{ width: '100%', background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div style={{ flex: 0.8, display: 'flex', flexDirection: 'column', alignItems: 'start' }}>
                  <label style={{ fontSize: '10px', color: '#aaa', display: 'block', marginBottom: '2px' }}>Instant:</label>
                  <div style={{ display: 'flex', alignItems: 'center', height: '23px' }}>
                    <input type="checkbox" className="nodrag" checked={!!data.instant} onChange={(e) => updateData({ instant: e.target.checked })} style={{ margin: 0 }} />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {data.actionType === 'spawn_actor' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div>
            <label style={{ fontSize: '10px', color: '#aaa', display: 'block', marginBottom: '2px' }}>Actor:</label>
            <select
              className="nodrag"
              value={data.targetActorId || ''}
              onChange={(e) => {
                const val = e.target.value;
                updateData({ targetActorId: val ? (isNaN(val) ? val : Number(val)) : null });
              }}
              style={{ width: '100%', background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }}
            >
              <option value="">Select target...</option>
              {actors && actors.filter(a => a.type !== 'group').length > 0 && (
                <optgroup label="Scene Actors">
                  {actors.filter(a => a.type !== 'group').map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </optgroup>
              )}
              {globalActors && globalActors.filter(a => a.type !== 'group').length > 0 && (
                <optgroup label="Global Actors">
                  {globalActors.filter(a => a.type !== 'group').map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </optgroup>
              )}
            </select>
          </div>
          <div style={{ marginBottom: '4px' }}>
            <label style={{ fontSize: '10px', color: '#aaa', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
              <input type="checkbox" className="nodrag" checked={!!data.useCurrentPos} onChange={(e) => updateData({ useCurrentPos: e.target.checked })} />
              Use current actor's position
            </label>
          </div>
          {!data.useCurrentPos && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '10px', color: '#aaa', display: 'block', marginBottom: '2px' }}>X Coord:</label>
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  {data.useVarX ? (
                    <select className="nodrag" value={data.x || ''} onChange={(e) => updateData({ x: e.target.value })} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }}>
                      <option value="">Select Var</option>
                      {variables && variables.filter(v => v.type !== 'group').map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
                    </select>
                  ) : (
                    <input className="nodrag" type="text" placeholder="e.g. 8" value={data.x ?? '0'} onChange={(e) => updateData({ x: e.target.value.replace(/[^0-9]/g, '') })} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }} />
                  )}
                  <button className="nodrag" onClick={(e) => { e.stopPropagation(); updateData({ useVarX: !data.useVarX, x: data.useVarX ? '0' : '' }); }} title="Toggle Variable" style={{ background: data.useVarX ? '#4CAF50' : '#333', color: '#fff', border: 'none', borderRadius: '3px', padding: '4px 6px', cursor: 'pointer', fontSize: '10px', height: '23px', display: 'flex', alignItems: 'center' }}>V</button>
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '10px', color: '#aaa', display: 'block', marginBottom: '2px' }}>Y Coord:</label>
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  {data.useVarY ? (
                    <select className="nodrag" value={data.y || ''} onChange={(e) => updateData({ y: e.target.value })} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }}>
                      <option value="">Select Var</option>
                      {variables && variables.filter(v => v.type !== 'group').map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
                    </select>
                  ) : (
                    <input className="nodrag" type="text" placeholder="e.g. 5" value={data.y ?? '0'} onChange={(e) => updateData({ y: e.target.value.replace(/[^0-9]/g, '') })} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }} />
                  )}
                  <button className="nodrag" onClick={(e) => { e.stopPropagation(); updateData({ useVarY: !data.useVarY, y: data.useVarY ? '0' : '' }); }} title="Toggle Variable" style={{ background: data.useVarY ? '#4CAF50' : '#333', color: '#fff', border: 'none', borderRadius: '3px', padding: '4px 6px', cursor: 'pointer', fontSize: '10px', height: '23px', display: 'flex', alignItems: 'center' }}>V</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {data.actionType === 'check_input' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '10px', color: '#aaa', display: 'block', marginBottom: '2px' }}>Key:</label>
              <select className="nodrag" value={data.keyName || 'a'} onChange={(e) => updateData({ keyName: e.target.value })} style={{ width: '100%', background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }}>
                <option value="up">Up</option>
                <option value="down">Down</option>
                <option value="left">Left</option>
                <option value="right">Right</option>
                <option value="a">A</option>
                <option value="b">B</option>
                <option value="l">L</option>
                <option value="r">R</option>
                <option value="start">Start</option>
                <option value="select">Select</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '10px', color: '#aaa', display: 'block', marginBottom: '2px' }}>State:</label>
              <select className="nodrag" value={data.keyState || 'held'} onChange={(e) => updateData({ keyState: e.target.value })} style={{ width: '100%', background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }}>
                <option value="held">Held</option>
                <option value="pressed">Pressed</option>
                <option value="released">Released</option>
              </select>
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
            <input
              type="checkbox"
              className="nodrag"
              id={`use-thresh-${id}`}
              checked={!!data.useThreshold}
              onChange={(e) => {
                const nextVal = e.target.checked;
                const updates = { useThreshold: nextVal };
                if (!nextVal) {
                  updates.branchByThreshold = false;
                  setEdges((eds) => eds.filter(edge => !(edge.source === id && (edge.sourceHandle === 'under' || edge.sourceHandle === 'over'))));
                }
                updateData(updates);
              }}
              style={{ cursor: 'pointer' }}
            />
            <label htmlFor={`use-thresh-${id}`} style={{ fontSize: '10px', color: '#ccc', cursor: 'pointer' }}>Compare duration</label>
          </div>

          {data.useThreshold && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderLeft: '2px solid #4CAF50', paddingLeft: '6px', marginLeft: '4px' }}>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '9px', color: '#999', display: 'block' }}>Time (ms):</label>
                  <input
                    type="number"
                    className="nodrag"
                    value={data.threshold ?? 500}
                    onChange={(e) => updateData({ threshold: parseInt(e.target.value) || 0 })}
                    style={{ width: '100%', background: '#111', color: '#fff', border: '1px solid #444', borderRadius: '3px', padding: '3px', fontSize: '10px', outline: 'none' }}
                  />
                </div>
                {!data.branchByThreshold && (
                  <div style={{ width: '60px' }}>
                    <label style={{ fontSize: '9px', color: '#999', display: 'block' }}>Op:</label>
                    <select
                      className="nodrag"
                      value={data.operator || '>='}
                      onChange={(e) => updateData({ operator: e.target.value })}
                      style={{ width: '100%', background: '#111', color: '#fff', border: '1px solid #444', borderRadius: '3px', padding: '3px', fontSize: '10px', outline: 'none' }}
                    >
                      <option value="<">&lt;</option>
                      <option value="<=">&lt;=</option>
                      <option value=">">&gt;</option>
                      <option value=">=">&gt;=</option>
                      <option value="==">==</option>
                    </select>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                <input
                  type="checkbox"
                  className="nodrag"
                  id={`branch-thresh-${id}`}
                  checked={!!data.branchByThreshold}
                  onChange={(e) => {
                    const nextVal = e.target.checked;
                    updateData({ branchByThreshold: nextVal });
                    if (!nextVal) {
                      setEdges((eds) => eds.filter(edge => !(edge.source === id && (edge.sourceHandle === 'under' || edge.sourceHandle === 'over'))));
                    }
                  }}
                  style={{ cursor: 'pointer' }}
                />
                <label htmlFor={`branch-thresh-${id}`} style={{ fontSize: '10px', color: '#ccc', cursor: 'pointer' }}>Branch (Under/Over)</label>
              </div>
            </div>
          )}

          {data.useThreshold && data.branchByThreshold && (
            <div style={{ borderTop: '1px solid #555', marginTop: '8px', paddingTop: '6px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ position: 'relative', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', height: '20px', paddingRight: '8px', fontSize: '9px', color: '#aaa' }}>
                Under ({`<`} {data.threshold ?? 500}ms)
                <Handle
                  type="source"
                  position={Position.Right}
                  id="under"
                  style={{ top: '50%', transform: 'translateY(-50%)', right: '-14px', background: '#e0a800' }}
                />
              </div>
              <div style={{ position: 'relative', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', height: '20px', paddingRight: '8px', fontSize: '9px', color: '#aaa' }}>
                Over/Equal ({`>=`} {data.threshold ?? 500}ms)
                <Handle
                  type="source"
                  position={Position.Right}
                  id="over"
                  style={{ top: '50%', transform: 'translateY(-50%)', right: '-14px', background: '#008000' }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {data.actionType === 'check_map_boundary' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div>
            <label style={{ fontSize: '10px', color: '#aaa', display: 'block', marginBottom: '2px' }}>Boundary:</label>
            <select className="nodrag" value={data.boundary || 'left'} onChange={(e) => updateData({ boundary: e.target.value })} style={{ width: '100%', background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }}>
              <option value="left">Left Edge</option>
              <option value="right">Right Edge</option>
              <option value="top">Top Edge</option>
              <option value="bottom">Bottom Edge</option>
            </select>
          </div>
        </div>
      )}

      {data.actionType === 'change_scene' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div>
            <label style={{ fontSize: '10px', color: '#aaa', display: 'block', marginBottom: '2px' }}>Scene:</label>
            {scenes && scenes.filter(s => s.type !== 'group').length > 0 ? (
              <select className="nodrag" value={data.sceneId || ''} onChange={(e) => updateData({ sceneId: e.target.value ? (isNaN(e.target.value) ? e.target.value : Number(e.target.value)) : null })} style={{ width: '100%', background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }}>
                <option value="">Select a scene...</option>
                {scenes.filter(s => s.type !== 'group').map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            ) : (
              <input className="nodrag" type="text" placeholder="Scene ID" value={data.sceneId || ''} onChange={(e) => updateData({ sceneId: e.target.value ? (isNaN(e.target.value) ? e.target.value : Number(e.target.value)) : null })} style={{ width: '100%', background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }} />
            )}
          </div>
        </div>
      )}

      {data.actionType === 'sound' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div>
            <label style={{ fontSize: '10px', color: '#aaa', display: 'block', marginBottom: '2px' }}>Sound Source:</label>
            <select className="nodrag" value={data.soundSource || 'custom'} onChange={(e) => updateData({ soundSource: e.target.value })} style={{ width: '100%', background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }}>
              <option value="custom">Custom Tone</option>
              <option value="asset">SFX Asset</option>
            </select>
          </div>
          {data.soundSource === 'asset' ? (
            <div>
              <label style={{ fontSize: '10px', color: '#aaa', display: 'block', marginBottom: '2px' }}>SFX Asset:</label>
              {musicTracks && musicTracks.filter(t => t.isSfx && t.type !== 'group').length > 0 ? (
                <select className="nodrag" value={data.sfxTrackId || ''} onChange={(e) => updateData({ sfxTrackId: e.target.value })} style={{ width: '100%', background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }}>
                  <option value="">Select SFX...</option>
                  {musicTracks.filter(t => t.isSfx && t.type !== 'group').map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              ) : (
                <div style={{ fontSize: '10px', color: '#ff4444', fontStyle: 'italic', marginTop: '2px' }}>No SFX generated yet. Use SFX Generator.</div>
              )}
            </div>
          ) : (
            <>
              <div>
                <label style={{ fontSize: '10px', color: '#aaa', display: 'block', marginBottom: '2px' }}>Waveform Type:</label>
                <select className="nodrag" value={data.waveType || 'square'} onChange={(e) => updateData({ waveType: e.target.value })} style={{ width: '100%', background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }}>
                  <option value="square">Square (Retro/Jump)</option>
                  <option value="sine">Sine (Smooth/Coin)</option>
                  <option value="sawtooth">Sawtooth (Harsh/Laser)</option>
                  <option value="noise">Noise (Crash/Hit)</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '10px', color: '#aaa', display: 'block', marginBottom: '2px' }}>Freq (Hz):</label>
                  <input className="nodrag" type="number" value={data.freq || 440} onChange={(e) => updateData({ freq: parseInt(e.target.value) || 440 })} style={{ width: '100%', background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '10px', color: '#aaa', display: 'block', marginBottom: '2px' }}>Dur (ms):</label>
                  <input className="nodrag" type="number" value={data.durationMs || 100} onChange={(e) => updateData({ durationMs: parseInt(e.target.value) || 100 })} style={{ width: '100%', background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {data.actionType === 'play_animation' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div>
            <label style={{ fontSize: '10px', color: '#aaa', display: 'block', marginBottom: '2px' }}>Actor:</label>
            {actors && actors.length > 0 ? (
              <select className="nodrag" value={data.targetActorId || ''} onChange={(e) => updateData({ targetActorId: e.target.value ? Number(e.target.value) : null })} style={{ width: '100%', background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }}>
                <option value="">Self (If Actor Script)</option>
                {[...actors.filter(a => a.type !== 'group'), ...globalActors.filter(a => a.type !== 'group')].map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            ) : (
              <span style={{ fontSize: '10px', color: '#888' }}>No actors available</span>
            )}
          </div>
          <div>
            <label style={{ fontSize: '10px', color: '#aaa', display: 'block', marginBottom: '2px' }}>Animation:</label>
            {animations && animations.length > 0 ? (
              <select className="nodrag" value={data.animId || ''} onChange={(e) => updateData({ animId: e.target.value ? Number(e.target.value) : null })} style={{ width: '100%', background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }}>
                <option value="">Select Animation...</option>
                {animations.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            ) : (
              <span style={{ fontSize: '10px', color: '#888' }}>No animations available</span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <input type="checkbox" className="nodrag" checked={data.waitAnim !== false} onChange={(e) => updateData({ waitAnim: e.target.checked })} />
            <label style={{ fontSize: '10px', color: '#aaa' }}>Wait until finished</label>
          </div>
        </div>
      )}

      {data.actionType === 'music_control' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div>
            <label style={{ fontSize: '10px', color: '#aaa', display: 'block', marginBottom: '2px' }}>Action:</label>
            <select className="nodrag" value={data.musicAction || 'pause'} onChange={(e) => updateData({ musicAction: e.target.value })} style={{ width: '100%', background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }}>
              <option value="pause">Pause Music</option>
              <option value="resume">Resume Music</option>
              <option value="stop">Stop Music</option>
            </select>
          </div>
        </div>
      )}

      {data.actionType === 'run_script' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div>
            <label style={{ fontSize: '10px', color: '#aaa', display: 'block', marginBottom: '2px' }}>Script:</label>
            {customScripts && customScripts.filter(s => s.type !== 'group').length > 0 ? (
              <select className="nodrag" value={data.scriptId || ''} onChange={(e) => updateData({ scriptId: e.target.value ? Number(e.target.value) : null })} style={{ width: '100%', background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }}>
                <option value="">Select a script...</option>
                {customScripts.filter(s => s.type !== 'group').map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            ) : (
              <span style={{ fontSize: '10px', color: '#888' }}>No custom scripts available</span>
            )}
          </div>
        </div>
      )}

      {data.actionType === 'check_collision' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div>
            <label style={{ fontSize: '10px', color: '#aaa', display: 'block', marginBottom: '2px' }}>Collision Type:</label>
            <select className="nodrag" value={data.collisionType || 'none'} onChange={(e) => updateData({ collisionType: e.target.value })} style={{ width: '100%', background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }}>
              <option value="none">No Collision</option>
              <option value="solid">Solid (All Sides)</option>
              <option value="top">Collision Top</option>
              <option value="bottom">Collision Bottom</option>
              <option value="left">Collision Left</option>
              <option value="right">Collision Right</option>
              <option value="slope-up">Slope Up</option>
              <option value="slope-down">Slope Down</option>
              <option value="ladder">Ladder</option>
            </select>
          </div>
        </div>
      )}

      {data.actionType === 'math_operation' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div>
            <label style={{ fontSize: '10px', color: '#aaa', display: 'block', marginBottom: '2px' }}>Variable:</label>
            {variables && variables.filter(v => v.type !== 'group').length > 0 ? (() => {
              const varNames = variables.filter(v => v.type !== 'group').map(v => v.name);
              console.log(`[ScriptEditor Debug] math_op dropdown: data.varName="${data.varName}" availableNames=[${varNames.join(',')}] match=${varNames.includes(data.varName)}`);
              return (
              <select className="nodrag" value={data.varName || ''} onChange={(e) => updateData({ varName: e.target.value })} style={{ width: '100%', background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }}>
                <option value="">Select a variable...</option>
                {variables.filter(v => v.type !== 'group').map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
              </select>);
            })() : (
              <input className="nodrag" type="text" placeholder="e.g. has_key" value={data.varName || ''} onChange={(e) => updateData({ varName: e.target.value })} style={{ width: '100%', background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }} />
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <select className="nodrag" value={data.operator || '+='} onChange={(e) => updateData({ operator: e.target.value })} style={{ width: '50px', background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }}>
              <option value="+=">+=</option>
              <option value="-=">-=</option>
              <option value="*=">*=</option>
              <option value="/=">/=</option>
              <option value="%=">%=</option>
              <option value="=">=</option>
            </select>
            <input className="nodrag" type="text" placeholder="e.g. 1" value={data.value || ''} onChange={(e) => updateData({ value: e.target.value })} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }} />
          </div>
        </div>
      )}

      {data.actionType === 'math_equation' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div>
            <label style={{ fontSize: '10px', color: '#aaa', display: 'block', marginBottom: '2px' }}>Target Variable:</label>
            {variables && variables.filter(v => v.type !== 'group').length > 0 ? (
              <select className="nodrag" value={data.targetVar || ''} onChange={(e) => updateData({ targetVar: e.target.value })} style={{ width: '100%', background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }}>
                <option value="">Select a variable...</option>
                {variables.filter(v => v.type !== 'group').map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
              </select>
            ) : (
              <input className="nodrag" type="text" placeholder="e.g. my_var" value={data.targetVar || ''} onChange={(e) => updateData({ targetVar: e.target.value })} style={{ width: '100%', background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }} />
            )}
          </div>
          <div>
            <label style={{ fontSize: '10px', color: '#aaa', display: 'block', marginBottom: '2px' }}>Equation / Expression:</label>
            <input
              className="nodrag"
              type="text"
              placeholder="e.g. health * 2 + strength"
              value={data.equation || ''}
              onChange={(e) => updateData({ equation: e.target.value })}
              style={{ width: '100%', background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }}
            />
            <span style={{ fontSize: '9px', color: '#888', marginTop: '2px', display: 'block' }}>
              Use variables, numbers, operators (+, -, *, /, %).
            </span>
          </div>
        </div>
      )}

      {data.actionType === 'save_game' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ fontSize: '10px', color: '#aaa', fontStyle: 'italic', display: 'block', whiteSpace: 'normal' }}>
            Saves variables and player position to the cartridge SRAM.
          </span>
        </div>
      )}

      {data.actionType === 'load_game' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ fontSize: '10px', color: '#aaa', fontStyle: 'italic', display: 'block', whiteSpace: 'normal' }}>
            Restores variables and player position from the cartridge SRAM.
          </span>
        </div>
      )}

      {data.actionType === 'restart_game' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ fontSize: '10px', color: '#aaa', fontStyle: 'italic', display: 'block', whiteSpace: 'normal' }}>
            Clears SRAM and resets the game console.
          </span>
        </div>
      )}

      {data.actionType === 'restart_scene' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ fontSize: '10px', color: '#aaa', fontStyle: 'italic', display: 'block', whiteSpace: 'normal' }}>
            Restarts the current scene, reloading it to its initial state.
          </span>
        </div>
      )}

      {(data.actionType === 'set_var' || data.actionType === 'check_var') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div>
            <label style={{ fontSize: '10px', color: '#aaa', display: 'block', marginBottom: '2px' }}>Variable:</label>
            {variables && variables.filter(v => v.type !== 'group').length > 0 ? (() => {
              const varNames = variables.filter(v => v.type !== 'group').map(v => v.name);
              console.log(`[ScriptEditor Debug] set_var/check_var dropdown: data.varName="${data.varName}" availableNames=[${varNames.join(',')}] match=${varNames.includes(data.varName)}`);
              return (
              <select className="nodrag" value={data.varName || ''} onChange={(e) => updateData({ varName: e.target.value })} style={{ width: '100%', background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }}>
                <option value="">Select a variable...</option>
                {variables.filter(v => v.type !== 'group').map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
              </select>);
            })() : (
              <input className="nodrag" type="text" placeholder="e.g. has_key" value={data.varName || ''} onChange={(e) => updateData({ varName: e.target.value })} style={{ width: '100%', background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }} />
            )}
          </div>
          {data.actionType === 'check_var' && (
             <select className="nodrag" value={data.operator || '=='} onChange={(e) => updateData({ operator: e.target.value })} style={{ width: '100%', background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }}>
               <option value="==">is equal to (==)</option>
               <option value="!=">is not equal to (!=)</option>
               <option value=">">is greater than (&gt;)</option>
               <option value=">=">is greater or equal (&gt;=)</option>
               <option value="<">is less than (&lt;)</option>
               <option value="<=">is less or equal (&lt;=)</option>
             </select>
           )}
           <div>
             <label style={{ fontSize: '10px', color: '#aaa', display: 'block', marginBottom: '2px' }}>Value:</label>
             <input className="nodrag" type="text" placeholder="e.g. 1" value={data.varValue || ''} onChange={(e) => updateData({ varValue: e.target.value })} style={{ width: '100%', background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }} />
           </div>
         </div>
       )}

      {data.actionType === 'set_random_var' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div>
            <label style={{ fontSize: '10px', color: '#aaa', display: 'block', marginBottom: '2px' }}>Target Variable:</label>
            {variables && variables.filter(v => v.type !== 'random' && v.type !== 'group').length > 0 ? (
              <select className="nodrag" value={data.varName || ''} onChange={(e) => updateData({ varName: e.target.value })} style={{ width: '100%', background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }}>
                <option value="">Select a variable...</option>
                {variables.filter(v => v.type !== 'random' && v.type !== 'group').map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
              </select>
            ) : (
              <input className="nodrag" type="text" placeholder="e.g. my_var" value={data.varName || ''} onChange={(e) => updateData({ varName: e.target.value })} style={{ width: '100%', background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }} />
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '10px', color: '#aaa', display: 'block', marginBottom: '2px' }}>Min:</label>
              <input className="nodrag" type="number" value={data.min ?? 0} onChange={(e) => updateData({ min: parseInt(e.target.value) || 0 })} style={{ width: '100%', background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '10px', color: '#aaa', display: 'block', marginBottom: '2px' }}>Max:</label>
              <input className="nodrag" type="number" value={data.max ?? 10} onChange={(e) => updateData({ max: parseInt(e.target.value) || 0 })} style={{ width: '100%', background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
          </div>
        </div>
      )}

      {data.actionType === 'check_random' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <label style={{ fontSize: '10px', color: '#aaa', width: '60px' }}>1 in:</label>
            <input className="nodrag" type="number" min="1" value={data.chance || 2} onChange={(e) => updateData({ chance: parseInt(e.target.value) || 2 })} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }} />
          </div>
        </div>
      )}

      {data.actionType === 'check_distance' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '10px', color: '#aaa', display: 'block', marginBottom: '2px' }}>Actor 1:</label>
              <select className="nodrag" value={data.actor1Id || ''} onChange={(e) => updateData({ actor1Id: e.target.value ? Number(e.target.value) : null })} style={{ width: '100%', background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }}>
                <option value="">Self (If Actor Script)</option>
                {[...actors.filter(a => a.type !== 'group'), ...globalActors.filter(a => a.type !== 'group')].map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '10px', color: '#aaa', display: 'block', marginBottom: '2px' }}>Actor 2:</label>
              <select className="nodrag" value={data.actor2Id || ''} onChange={(e) => updateData({ actor2Id: e.target.value ? Number(e.target.value) : null })} style={{ width: '100%', background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }}>
                <option value="">Select an actor...</option>
                {[...actors.filter(a => a.type !== 'group'), ...globalActors.filter(a => a.type !== 'group')].map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <select className="nodrag" value={data.operator || '<'} onChange={(e) => updateData({ operator: e.target.value })} style={{ width: '50px', background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }}>
              <option value="<">&lt;</option>
              <option value="<=">&lt;=</option>
              <option value=">">&gt;</option>
              <option value=">=">&gt;=</option>
            </select>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <input className="nodrag" type="number" min="0" value={data.distance !== undefined ? data.distance : 32} onChange={(e) => updateData({ distance: parseInt(e.target.value) || 0 })} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }} />
              <span style={{ fontSize: '10px', color: '#aaa' }}>px</span>
            </div>
          </div>
        </div>
      )}

      {data.actionType === 'check_hover' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div>
            <label style={{ fontSize: '10px', color: '#aaa', display: 'block', marginBottom: '2px' }}>Target Actor:</label>
            <select className="nodrag" value={data.targetActorId || ''} onChange={(e) => updateData({ targetActorId: e.target.value ? Number(e.target.value) : null })} style={{ width: '100%', background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }}>
              <option value="">Self (If Actor Script)</option>
              {[...actors.filter(a => a.type !== 'group'), ...globalActors.filter(a => a.type !== 'group')].map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
        </div>
      )}

      {data.actionType === 'get_cursor_pos' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div>
            <label style={{ fontSize: '10px', color: '#aaa', display: 'block', marginBottom: '2px' }}>Save X to:</label>
            <select className="nodrag" value={data.varXName || ''} onChange={(e) => updateData({ varXName: e.target.value })} style={{ width: '100%', background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }}>
              <option value="">Select variable...</option>
              {variables.filter(v => v.type !== 'group').map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: '10px', color: '#aaa', display: 'block', marginBottom: '2px' }}>Save Y to:</label>
            <select className="nodrag" value={data.varYName || ''} onChange={(e) => updateData({ varYName: e.target.value })} style={{ width: '100%', background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }}>
              <option value="">Select variable...</option>
              {variables.filter(v => v.type !== 'group').map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
            </select>
          </div>
        </div>
      )}

      {data.actionType === 'get_actor_pos' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div>
            <label style={{ fontSize: '10px', color: '#aaa', display: 'block', marginBottom: '2px' }}>Actor:</label>
            <select
              className="nodrag"
              value={data.targetActorId || ''}
              onChange={(e) => {
                const val = e.target.value;
                updateData({ targetActorId: val ? (isNaN(val) ? val : Number(val)) : null });
              }}
              style={{ width: '100%', background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }}
            >
              <option value="">Self (If Actor Script)</option>
              {actors && actors.filter(a => a.type !== 'group').length > 0 && (
                <optgroup label="Scene Actors">
                  {actors.filter(a => a.type !== 'group').map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </optgroup>
              )}
              {globalActors && globalActors.filter(a => a.type !== 'group').length > 0 && (
                <optgroup label="Global Actors">
                  {globalActors.filter(a => a.type !== 'group').map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </optgroup>
              )}
            </select>
          </div>
          <div>
            <label style={{ fontSize: '10px', color: '#aaa', display: 'block', marginBottom: '2px' }}>Position Unit:</label>
            <select
              className="nodrag"
              value={data.positionUnit || 'pixels'}
              onChange={(e) => updateData({ positionUnit: e.target.value })}
              style={{ width: '100%', background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }}
            >
              <option value="pixels">Pixels</option>
              <option value="tiles">Tiles</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: '10px', color: '#aaa', display: 'block', marginBottom: '2px' }}>Save X to:</label>
            <select className="nodrag" value={data.varXName || ''} onChange={(e) => updateData({ varXName: e.target.value })} style={{ width: '100%', background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }}>
              <option value="">Select variable...</option>
              {variables.filter(v => v.type !== 'group').map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: '10px', color: '#aaa', display: 'block', marginBottom: '2px' }}>Save Y to:</label>
            <select className="nodrag" value={data.varYName || ''} onChange={(e) => updateData({ varYName: e.target.value })} style={{ width: '100%', background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }}>
              <option value="">Select variable...</option>
              {variables.filter(v => v.type !== 'group').map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
            </select>
          </div>
        </div>
      )}

      {data.actionType === 'set_cursor_pos' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '10px', color: '#aaa', display: 'block', marginBottom: '2px' }}>X Coord:</label>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                {data.useVarX ? (
                  <select className="nodrag" value={data.x || ''} onChange={(e) => updateData({ x: e.target.value })} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }}>
                    <option value="">Select Var</option>
                    {variables && variables.filter(v => v.type !== 'group').map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
                  </select>
                ) : (
                  <input className="nodrag" type="text" placeholder="e.g. 120" value={data.x ?? '120'} onChange={(e) => updateData({ x: e.target.value.replace(/[^0-9]/g, '') })} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }} />
                )}
                <button className="nodrag" onClick={(e) => { e.stopPropagation(); updateData({ useVarX: !data.useVarX, x: data.useVarX ? '120' : '' }); }} title="Toggle Variable" style={{ background: data.useVarX ? '#4CAF50' : '#333', color: '#fff', border: 'none', borderRadius: '3px', padding: '4px 6px', cursor: 'pointer', fontSize: '10px', height: '23px', display: 'flex', alignItems: 'center' }}>V</button>
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '10px', color: '#aaa', display: 'block', marginBottom: '2px' }}>Y Coord:</label>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                {data.useVarY ? (
                  <select className="nodrag" value={data.y || ''} onChange={(e) => updateData({ y: e.target.value })} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }}>
                    <option value="">Select Var</option>
                    {variables && variables.filter(v => v.type !== 'group').map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
                  </select>
                ) : (
                  <input className="nodrag" type="text" placeholder="e.g. 80" value={data.y ?? '80'} onChange={(e) => updateData({ y: e.target.value.replace(/[^0-9]/g, '') })} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }} />
                )}
                <button className="nodrag" onClick={(e) => { e.stopPropagation(); updateData({ useVarY: !data.useVarY, y: data.useVarY ? '80' : '' }); }} title="Toggle Variable" style={{ background: data.useVarY ? '#4CAF50' : '#333', color: '#fff', border: 'none', borderRadius: '3px', padding: '4px 6px', cursor: 'pointer', fontSize: '10px', height: '23px', display: 'flex', alignItems: 'center' }}>V</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {data.actionType === 'set_pointer_visible' && (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input type="checkbox" className="nodrag" checked={data.visible !== false} onChange={(e) => updateData({ visible: e.target.checked })} />
          <label style={{ fontSize: '10px', color: '#aaa' }}>Pointer Visible</label>
        </div>
      )}

      {data.actionType === 'set_scroll_speed' && (
        <div style={{ display: 'flex', gap: '8px' }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '10px', color: '#aaa', display: 'block', marginBottom: '2px' }}>Speed X:</label>
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              {data.useVarScrollSpeedX ? (
                <select className="nodrag" value={data.scrollSpeedX || ''} onChange={(e) => updateData({ scrollSpeedX: e.target.value })} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }}>
                  <option value="">Select Var</option>
                  {variables && variables.filter(v => v.type !== 'group').map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
                </select>
              ) : (
                <input className="nodrag" type="text" placeholder="e.g. 1.0" value={data.scrollSpeedX ?? '0.0'} onChange={(e) => {
                  let val = e.target.value.replace(/[^0-9.]/g, '');
                  const parts = val.split('.');
                  if (parts.length > 2) val = parts[0] + '.' + parts.slice(1).join('');
                  updateData({ scrollSpeedX: val });
                }} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }} />
              )}
              <button className="nodrag" onClick={(e) => { e.stopPropagation(); updateData({ useVarScrollSpeedX: !data.useVarScrollSpeedX, scrollSpeedX: data.useVarScrollSpeedX ? '0.0' : '' }); }} title="Toggle Variable" style={{ background: data.useVarScrollSpeedX ? '#4CAF50' : '#333', color: '#fff', border: 'none', borderRadius: '3px', padding: '4px 6px', cursor: 'pointer', fontSize: '10px', height: '23px', display: 'flex', alignItems: 'center' }}>V</button>
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '10px', color: '#aaa', display: 'block', marginBottom: '2px' }}>Speed Y:</label>
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              {data.useVarScrollSpeedY ? (
                <select className="nodrag" value={data.scrollSpeedY || ''} onChange={(e) => updateData({ scrollSpeedY: e.target.value })} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }}>
                  <option value="">Select Var</option>
                  {variables && variables.filter(v => v.type !== 'group').map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
                </select>
              ) : (
                <input className="nodrag" type="text" placeholder="e.g. 0.0" value={data.scrollSpeedY ?? '0.0'} onChange={(e) => {
                  let val = e.target.value.replace(/[^0-9.]/g, '');
                  const parts = val.split('.');
                  if (parts.length > 2) val = parts[0] + '.' + parts.slice(1).join('');
                  updateData({ scrollSpeedY: val });
                }} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }} />
              )}
              <button className="nodrag" onClick={(e) => { e.stopPropagation(); updateData({ useVarScrollSpeedY: !data.useVarScrollSpeedY, scrollSpeedY: data.useVarScrollSpeedY ? '0.0' : '' }); }} title="Toggle Variable" style={{ background: data.useVarScrollSpeedY ? '#4CAF50' : '#333', color: '#fff', border: 'none', borderRadius: '3px', padding: '4px 6px', cursor: 'pointer', fontSize: '10px', height: '23px', display: 'flex', alignItems: 'center' }}>V</button>
            </div>
          </div>
        </div>
      )}

      {data.actionType === 'set_actor_rotation' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div>
            <label style={{ fontSize: '10px', color: '#aaa', display: 'block', marginBottom: '2px' }}>Actor:</label>
            {actors && actors.length > 0 ? (
              <select className="nodrag" value={data.targetActorId || ''} onChange={(e) => updateData({ targetActorId: e.target.value ? Number(e.target.value) : null })} style={{ width: '100%', background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }}>
                <option value="">Self (If Actor Script)</option>
                {[...actors.filter(a => a.type !== 'group'), ...globalActors.filter(a => a.type !== 'group')].map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            ) : (
              <span style={{ fontSize: '10px', color: '#888' }}>No actors available</span>
            )}
          </div>
          <div>
            <label style={{ fontSize: '10px', color: '#aaa', display: 'block', marginBottom: '2px' }}>Angle (0-360):</label>
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              {data.useVarAngle ? (
                <select className="nodrag" value={data.angle || ''} onChange={(e) => updateData({ angle: e.target.value })} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }}>
                  <option value="">Select Var</option>
                  {variables && variables.filter(v => v.type !== 'group').map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
                </select>
              ) : (
                <input className="nodrag" type="text" placeholder="e.g. 90" value={data.angle ?? '0'} onChange={(e) => updateData({ angle: e.target.value.replace(/[^0-9]/g, '') })} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }} />
              )}
              <button className="nodrag" onClick={(e) => { e.stopPropagation(); updateData({ useVarAngle: !data.useVarAngle, angle: data.useVarAngle ? '0' : '' }); }} title="Toggle Variable" style={{ background: data.useVarAngle ? '#4CAF50' : '#333', color: '#fff', border: 'none', borderRadius: '3px', padding: '4px 6px', cursor: 'pointer', fontSize: '10px', height: '23px', display: 'flex', alignItems: 'center' }}>V</button>
            </div>
          </div>
        </div>
      )}

      {data.actionType === 'set_actor_scale' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div>
            <label style={{ fontSize: '10px', color: '#aaa', display: 'block', marginBottom: '2px' }}>Actor:</label>
            {actors && actors.length > 0 ? (
              <select className="nodrag" value={data.targetActorId || ''} onChange={(e) => updateData({ targetActorId: e.target.value ? Number(e.target.value) : null })} style={{ width: '100%', background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }}>
                <option value="">Self (If Actor Script)</option>
                {[...actors.filter(a => a.type !== 'group'), ...globalActors.filter(a => a.type !== 'group')].map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            ) : (
              <span style={{ fontSize: '10px', color: '#888' }}>No actors available</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '10px', color: '#aaa', display: 'block', marginBottom: '2px' }}>Scale X:</label>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                {data.useVarScaleX ? (
                  <select className="nodrag" value={data.scaleX || ''} onChange={(e) => updateData({ scaleX: e.target.value })} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }}>
                    <option value="">Select Var</option>
                    {variables && variables.filter(v => v.type !== 'group').map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
                  </select>
                ) : (
                  <input className="nodrag" type="text" placeholder="e.g. 1.0" value={data.scaleX ?? '1.0'} onChange={(e) => {
                    let val = e.target.value.replace(/[^0-9.]/g, '');
                    const parts = val.split('.');
                    if (parts.length > 2) val = parts[0] + '.' + parts.slice(1).join('');
                    updateData({ scaleX: val });
                  }} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }} />
                )}
                <button className="nodrag" onClick={(e) => { e.stopPropagation(); updateData({ useVarScaleX: !data.useVarScaleX, scaleX: data.useVarScaleX ? '1.0' : '' }); }} title="Toggle Variable" style={{ background: data.useVarScaleX ? '#4CAF50' : '#333', color: '#fff', border: 'none', borderRadius: '3px', padding: '4px 6px', cursor: 'pointer', fontSize: '10px', height: '23px', display: 'flex', alignItems: 'center' }}>V</button>
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '10px', color: '#aaa', display: 'block', marginBottom: '2px' }}>Scale Y:</label>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                {data.useVarScaleY ? (
                  <select className="nodrag" value={data.scaleY || ''} onChange={(e) => updateData({ scaleY: e.target.value })} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }}>
                    <option value="">Select Var</option>
                    {variables && variables.filter(v => v.type !== 'group').map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
                  </select>
                ) : (
                  <input className="nodrag" type="text" placeholder="e.g. 1.0" value={data.scaleY ?? '1.0'} onChange={(e) => {
                    let val = e.target.value.replace(/[^0-9.]/g, '');
                    const parts = val.split('.');
                    if (parts.length > 2) val = parts[0] + '.' + parts.slice(1).join('');
                    updateData({ scaleY: val });
                  }} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }} />
                )}
                <button className="nodrag" onClick={(e) => { e.stopPropagation(); updateData({ useVarScaleY: !data.useVarScaleY, scaleY: data.useVarScaleY ? '1.0' : '' }); }} title="Toggle Variable" style={{ background: data.useVarScaleY ? '#4CAF50' : '#333', color: '#fff', border: 'none', borderRadius: '3px', padding: '4px 6px', cursor: 'pointer', fontSize: '10px', height: '23px', display: 'flex', alignItems: 'center' }}>V</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {data.actionType === 'set_car_steering' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div>
            <label style={{ fontSize: '10px', color: '#aaa', display: 'block', marginBottom: '2px' }}>Steering Speed (deg/frame):</label>
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              {data.useVarSteeringSpeed ? (
                <select className="nodrag" value={data.steeringSpeed || ''} onChange={(e) => updateData({ steeringSpeed: e.target.value })} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }}>
                  <option value="">Select Var</option>
                  {variables && variables.filter(v => v.type !== 'group').map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
                </select>
              ) : (
                <input className="nodrag" type="text" placeholder="e.g. 4.0" value={data.steeringSpeed ?? '0.0'} onChange={(e) => {
                  let val = e.target.value.replace(/[^0-9.]/g, '');
                  const parts = val.split('.');
                  if (parts.length > 2) val = parts[0] + '.' + parts.slice(1).join('');
                  updateData({ steeringSpeed: val });
                }} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }} />
              )}
              <button className="nodrag" onClick={(e) => { e.stopPropagation(); updateData({ useVarSteeringSpeed: !data.useVarSteeringSpeed, steeringSpeed: data.useVarSteeringSpeed ? '0.0' : '' }); }} title="Toggle Variable" style={{ background: data.useVarSteeringSpeed ? '#4CAF50' : '#333', color: '#fff', border: 'none', borderRadius: '3px', padding: '4px 6px', cursor: 'pointer', fontSize: '10px', height: '23px', display: 'flex', alignItems: 'center' }}>V</button>
            </div>
          </div>
          <div>
            <label style={{ fontSize: '10px', color: '#aaa', display: 'block', marginBottom: '2px' }}>Heading Angle:</label>
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              {data.useVarAngle ? (
                <select className="nodrag" value={data.angle || ''} onChange={(e) => updateData({ angle: e.target.value })} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }}>
                  <option value="">Select Var</option>
                  {variables && variables.filter(v => v.type !== 'group').map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
                </select>
              ) : (
                <input className="nodrag" type="text" placeholder="e.g. 90" value={data.angle ?? '0'} onChange={(e) => updateData({ angle: e.target.value.replace(/[^0-9]/g, '') })} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }} />
              )}
              <button className="nodrag" onClick={(e) => { e.stopPropagation(); updateData({ useVarAngle: !data.useVarAngle, angle: data.useVarAngle ? '0' : '' }); }} title="Toggle Variable" style={{ background: data.useVarAngle ? '#4CAF50' : '#333', color: '#fff', border: 'none', borderRadius: '3px', padding: '4px 6px', cursor: 'pointer', fontSize: '10px', height: '23px', display: 'flex', alignItems: 'center' }}>V</button>
            </div>
          </div>
        </div>
      )}

      {data.actionType === 'menu' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <textarea
            className="nodrag"
            value={data.message || ''}
            onChange={(e) => updateData({ message: e.target.value })}
            placeholder="Enter menu message..."
            style={{ width: '100%', minHeight: '50px', background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', resize: 'vertical' }}
          />
          <div style={{ fontSize: '10px', color: '#aaa', fontWeight: 'bold' }}>Options:</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {(data.options || []).map((opt, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '4px', position: 'relative', width: '100%', boxSizing: 'border-box' }}>
                <input
                  type="text"
                  className="nodrag"
                  value={opt.text || ''}
                  onChange={(e) => {
                    const newOpts = [...data.options];
                    newOpts[idx] = { ...newOpts[idx], text: e.target.value };
                    updateData({ options: newOpts });
                  }}
                  placeholder={`Option ${idx + 1}`}
                  style={{ flex: 1, minWidth: '40px', background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '3px 4px', fontSize: '11px', outline: 'none' }}
                />
                <button
                  className="nodrag"
                  disabled={data.options.length <= 1}
                  onClick={(e) => {
                    e.stopPropagation();
                    const newOpts = data.options.filter((_, oIdx) => oIdx !== idx);
                    updateData({ options: newOpts });
                    setEdges((eds) => {
                      return eds
                        .filter(edge => !(edge.source === id && edge.sourceHandle === `option-${idx}`))
                        .map(edge => {
                          if (edge.source === id && edge.sourceHandle && edge.sourceHandle.startsWith('option-')) {
                            const edgeOptIdx = parseInt(edge.sourceHandle.split('-')[1]);
                            if (edgeOptIdx > idx) {
                              return { ...edge, sourceHandle: `option-${edgeOptIdx - 1}` };
                            }
                          }
                          return edge;
                        });
                    });
                  }}
                  title="Delete Option"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: data.options.length <= 1 ? '#555' : '#ff4444',
                    cursor: data.options.length <= 1 ? 'default' : 'pointer',
                    fontSize: '10px',
                    padding: '0 2px'
                  }}
                >
                  ✕
                </button>
                <Handle
                  type="source"
                  position={Position.Right}
                  id={`option-${idx}`}
                  style={{ top: '50%', transform: 'translateY(-50%)', right: '-14px', background: '#4CAF50' }}
                />
              </div>
            ))}
            <button
              className="nodrag"
              onClick={() => {
                const newOpts = [...(data.options || []), { text: `Option ${(data.options || []).length + 1}` }];
                updateData({ options: newOpts });
              }}
              style={{
                background: '#222',
                border: '1px solid #4CAF50',
                color: '#4CAF50',
                padding: '4px',
                borderRadius: '3px',
                cursor: 'pointer',
                fontSize: '10px',
                marginTop: '4px',
                width: '100%'
              }}
            >
              + Add Option
            </button>
          </div>
        </div>
      )}

      {data.actionType === 'set_anim_speed' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div>
            <label style={{ fontSize: '10px', color: '#aaa', display: 'block', marginBottom: '2px' }}>Actor:</label>
            <select className="nodrag" value={data.targetActorId ?? ''} onChange={(e) => updateData({ targetActorId: e.target.value ? parseInt(e.target.value) : null })} style={{ width: '100%', background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }}>
              <option value="">Self</option>
              {actors && actors.filter(a => a.type !== 'group').map(a => <option key={a.id} value={a.id}>{a.name || `Actor ${a.id}`}</option>)}
              {globalActors && globalActors.filter(a => a.type !== 'group').map(a => <option key={a.id} value={a.id}>{a.name || `Global Actor ${a.id}`}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: '10px', color: '#aaa', display: 'block', marginBottom: '2px' }}>Speed:</label>
            <input className="nodrag" type="text" value={data.speed ?? '1'} onChange={(e) => { let val = e.target.value.replace(/[^0-9.]/g, ''); const parts = val.split('.'); if (parts.length > 2) val = parts[0] + '.' + parts.slice(1).join(''); updateData({ speed: val }); }} style={{ width: '100%', background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }} />
          </div>
        </div>
      )}

      {data.actionType === 'set_movement_speed' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div>
            <label style={{ fontSize: '10px', color: '#aaa', display: 'block', marginBottom: '2px' }}>Actor:</label>
            <select className="nodrag" value={data.targetActorId ?? ''} onChange={(e) => updateData({ targetActorId: e.target.value ? parseInt(e.target.value) : null })} style={{ width: '100%', background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }}>
              <option value="">Self</option>
              {actors && actors.filter(a => a.type !== 'group').map(a => <option key={a.id} value={a.id}>{a.name || `Actor ${a.id}`}</option>)}
              {globalActors && globalActors.filter(a => a.type !== 'group').map(a => <option key={a.id} value={a.id}>{a.name || `Global Actor ${a.id}`}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: '10px', color: '#aaa', display: 'block', marginBottom: '2px' }}>Speed:</label>
            <input className="nodrag" type="text" value={data.speed ?? '1'} onChange={(e) => { let val = e.target.value.replace(/[^0-9.]/g, ''); const parts = val.split('.'); if (parts.length > 2) val = parts[0] + '.' + parts.slice(1).join(''); updateData({ speed: val }); }} style={{ width: '100%', background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }} />
          </div>
        </div>
      )}

      {data.actionType === 'start_update' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div>
            <label style={{ fontSize: '10px', color: '#aaa', display: 'block', marginBottom: '2px' }}>Actor:</label>
            <select className="nodrag" value={data.targetActorId ?? ''} onChange={(e) => updateData({ targetActorId: e.target.value ? parseInt(e.target.value) : null })} style={{ width: '100%', background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }}>
              <option value="">Self</option>
              {actors && actors.filter(a => a.type !== 'group').map(a => <option key={a.id} value={a.id}>{a.name || `Actor ${a.id}`}</option>)}
              {globalActors && globalActors.filter(a => a.type !== 'group').map(a => <option key={a.id} value={a.id}>{a.name || `Global Actor ${a.id}`}</option>)}
            </select>
          </div>
        </div>
      )}

      {data.actionType === 'stop_update' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div>
            <label style={{ fontSize: '10px', color: '#aaa', display: 'block', marginBottom: '2px' }}>Actor:</label>
            <select className="nodrag" value={data.targetActorId ?? ''} onChange={(e) => updateData({ targetActorId: e.target.value ? parseInt(e.target.value) : null })} style={{ width: '100%', background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }}>
              <option value="">Self</option>
              {actors && actors.filter(a => a.type !== 'group').map(a => <option key={a.id} value={a.id}>{a.name || `Actor ${a.id}`}</option>)}
              {globalActors && globalActors.filter(a => a.type !== 'group').map(a => <option key={a.id} value={a.id}>{a.name || `Global Actor ${a.id}`}</option>)}
            </select>
          </div>
        </div>
      )}

      {data.actionType === 'attach_input_script' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div>
            <label style={{ fontSize: '10px', color: '#aaa', display: 'block', marginBottom: '2px' }}>Button:</label>
            <select className="nodrag" value={Array.isArray(data.input) ? data.input[0] || 'a' : 'a'} onChange={(e) => updateData({ input: [e.target.value] })} style={{ width: '100%', background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }}>
              <option value="a">A</option>
              <option value="b">B</option>
              <option value="start">Start</option>
              <option value="select">Select</option>
              <option value="left">Left</option>
              <option value="right">Right</option>
              <option value="up">Up</option>
              <option value="down">Down</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: '10px', color: '#aaa', display: 'block', marginBottom: '2px' }}>
              <input className="nodrag" type="checkbox" checked={data.override !== false} onChange={(e) => updateData({ override: e.target.checked })} /> Override default action
            </label>
          </div>
        </div>
      )}

      {data.actionType === 'draw_text' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div>
            <label style={{ fontSize: '10px', color: '#aaa', display: 'block', marginBottom: '2px' }}>Text:</label>
            <input className="nodrag" type="text" value={data.text ?? ''} onChange={(e) => updateData({ text: e.target.value })} style={{ width: '100%', background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '10px', color: '#aaa', display: 'block', marginBottom: '2px' }}>X:</label>
              <input className="nodrag" type="text" value={data.x ?? '0'} onChange={(e) => { let val = e.target.value.replace(/[^0-9]/g, ''); updateData({ x: val }); }} style={{ width: '100%', background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '10px', color: '#aaa', display: 'block', marginBottom: '2px' }}>Y:</label>
              <input className="nodrag" type="text" value={data.y ?? '0'} onChange={(e) => { let val = e.target.value.replace(/[^0-9]/g, ''); updateData({ y: val }); }} style={{ width: '100%', background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
          </div>
          <div>
            <label style={{ fontSize: '10px', color: '#aaa', display: 'block', marginBottom: '2px' }}>Location:</label>
            <select className="nodrag" value={data.location || 'background'} onChange={(e) => updateData({ location: e.target.value })} style={{ width: '100%', background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }}>
              <option value="background">Background</option>
              <option value="window">Window</option>
            </select>
          </div>
        </div>
      )}

      {data.actionType === 'camera_shake' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '10px', color: '#aaa', display: 'block', marginBottom: '2px' }}>Time (s):</label>
              <input className="nodrag" type="text" placeholder="e.g. 0.2" value={data.time ?? '0.2'} onChange={(e) => { let val = e.target.value.replace(/[^0-9.]/g, ''); const parts = val.split('.'); if (parts.length > 2) val = parts[0] + '.' + parts.slice(1).join(''); updateData({ time: val }); }} style={{ width: '100%', background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '10px', color: '#aaa', display: 'block', marginBottom: '2px' }}>Magnitude:</label>
              <input className="nodrag" type="text" placeholder="e.g. 2" value={data.magnitude ?? '2'} onChange={(e) => { let val = e.target.value.replace(/[^0-9.]/g, ''); const parts = val.split('.'); if (parts.length > 2) val = parts[0] + '.' + parts.slice(1).join(''); updateData({ magnitude: val }); }} style={{ width: '100%', background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
          </div>
          <div>
            <label style={{ fontSize: '10px', color: '#aaa', display: 'block', marginBottom: '2px' }}>Direction:</label>
            <select className="nodrag" value={data.direction || 'horizontal'} onChange={(e) => updateData({ direction: e.target.value })} style={{ width: '100%', background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }}>
              <option value="horizontal">Horizontal</option>
              <option value="vertical">Vertical</option>
              <option value="both">Both</option>
            </select>
          </div>
        </div>
      )}

      {data.actionType === 'set_timer' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '10px', color: '#aaa', display: 'block', marginBottom: '2px' }}>Timer:</label>
              <select className="nodrag" value={String(data.timerIndex ?? '1')} onChange={(e) => updateData({ timerIndex: parseInt(e.target.value) || 1 })} style={{ width: '100%', background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }}>
                <option value="1">Timer 1</option>
                <option value="2">Timer 2</option>
                <option value="3">Timer 3</option>
                <option value="4">Timer 4</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '10px', color: '#aaa', display: 'block', marginBottom: '2px' }}>Duration (s):</label>
              <input className="nodrag" type="text" placeholder="e.g. 2" value={data.duration ?? '0.5'} onChange={(e) => { let val = e.target.value.replace(/[^0-9.]/g, ''); const parts = val.split('.'); if (parts.length > 2) val = parts[0] + '.' + parts.slice(1).join(''); updateData({ duration: val }); }} style={{ width: '100%', background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
          </div>
        </div>
      )}

      {data.actionType === 'fade_in' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div>
            <label style={{ fontSize: '10px', color: '#aaa', display: 'block', marginBottom: '2px' }}>Speed:</label>
            <select className="nodrag" value={String(data.speed ?? 1)} onChange={(e) => updateData({ speed: parseInt(e.target.value) || 1 })} style={{ width: '100%', background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }}>
              <option value="0">Instant</option>
              <option value="1">Fast</option>
              <option value="2">Normal</option>
              <option value="3">Slow</option>
            </select>
          </div>
        </div>
      )}

      {data.actionType === 'fade_out' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div>
            <label style={{ fontSize: '10px', color: '#aaa', display: 'block', marginBottom: '2px' }}>Speed:</label>
            <select className="nodrag" value={String(data.speed ?? 1)} onChange={(e) => updateData({ speed: parseInt(e.target.value) || 1 })} style={{ width: '100%', background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }}>
              <option value="0">Instant</option>
              <option value="1">Fast</option>
              <option value="2">Normal</option>
              <option value="3">Slow</option>
            </select>
          </div>
        </div>
      )}

      {data.actionType === 'set_direction' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div>
            <label style={{ fontSize: '10px', color: '#aaa', display: 'block', marginBottom: '2px' }}>Actor:</label>
            <select className="nodrag" value={data.targetActorId ?? ''} onChange={(e) => updateData({ targetActorId: e.target.value || null })} style={{ width: '100%', background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }}>
              <option value="">Select Actor</option>
              {actors && actors.filter(a => a.type !== 'group').map(a => <option key={a.id} value={a.id}>{a.name || `Actor ${a.id}`}</option>)}
              {globalActors && globalActors.filter(a => a.type !== 'group').map(a => <option key={a.id} value={a.id}>{a.name || `Global Actor ${a.id}`}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: '10px', color: '#aaa', display: 'block', marginBottom: '2px' }}>Direction:</label>
            <select className="nodrag" value={data.direction || 'down'} onChange={(e) => updateData({ direction: e.target.value })} style={{ width: '100%', background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }}>
              <option value="up">Up</option>
              <option value="down">Down</option>
              <option value="left">Left</option>
              <option value="right">Right</option>
            </select>
          </div>
        </div>
      )}

      {data.actionType === 'await_input' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ fontSize: '10px', color: '#888' }}>Pauses script execution until any button is pressed.</div>
        </div>
      )}

      {data.actionType === 'actor_emote' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div>
            <label style={{ fontSize: '10px', color: '#aaa', display: 'block', marginBottom: '2px' }}>Actor:</label>
            <select className="nodrag" value={data.targetActorId ?? ''} onChange={(e) => updateData({ targetActorId: e.target.value || null })} style={{ width: '100%', background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }}>
              <option value="">Select Actor</option>
              {actors && actors.filter(a => a.type !== 'group').map(a => <option key={a.id} value={a.id}>{a.name || `Actor ${a.id}`}</option>)}
              {globalActors && globalActors.filter(a => a.type !== 'group').map(a => <option key={a.id} value={a.id}>{a.name || `Global Actor ${a.id}`}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: '10px', color: '#aaa', display: 'block', marginBottom: '2px' }}>Emote:</label>
            <select className="nodrag" value={data.emote || 'exclamation'} onChange={(e) => updateData({ emote: e.target.value })} style={{ width: '100%', background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }}>
              <option value="exclamation">Exclamation</option>
              <option value="question">Question</option>
              <option value="music">Music</option>
              <option value="sleep">Sleep</option>
            </select>
          </div>
        </div>
      )}

      {data.actionType === 'camera_lock' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ fontSize: '10px', color: '#888' }}>Locks camera to follow the player.</div>
        </div>
      )}

      {data.actionType === 'overlay_show' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '10px', color: '#aaa', display: 'block', marginBottom: '2px' }}>X:</label>
              <input className="nodrag" type="text" placeholder="0" value={data.x ?? 0} onChange={(e) => updateData({ x: e.target.value.replace(/[^0-9]/g, '') })} style={{ width: '100%', background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '10px', color: '#aaa', display: 'block', marginBottom: '2px' }}>Y:</label>
              <input className="nodrag" type="text" placeholder="0" value={data.y ?? 0} onChange={(e) => updateData({ y: e.target.value.replace(/[^0-9]/g, '') })} style={{ width: '100%', background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '10px', color: '#aaa', display: 'block', marginBottom: '2px' }}>Color:</label>
              <select className="nodrag" value={data.color || 'white'} onChange={(e) => updateData({ color: e.target.value })} style={{ width: '100%', background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }}>
                <option value="white">White</option>
                <option value="black">Black</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {data.actionType === 'overlay_hide' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ fontSize: '10px', color: '#888' }}>Hides the overlay window.</div>
        </div>
      )}

      {data.actionType === 'text_set_anim_speed' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div>
            <label style={{ fontSize: '10px', color: '#aaa', display: 'block', marginBottom: '2px' }}>Speed:</label>
            <select className="nodrag" value={String(data.speed ?? 1)} onChange={(e) => updateData({ speed: parseInt(e.target.value) || 1 })} style={{ width: '100%', background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }}>
              <option value="0">Instant</option>
              <option value="1">Fast</option>
              <option value="2">Normal</option>
              <option value="3">Slow</option>
            </select>
          </div>
          <label style={{ fontSize: '10px', color: '#aaa', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
            <input type="checkbox" className="nodrag" checked={data.allowFastForward !== false} onChange={(e) => updateData({ allowFastForward: e.target.checked })} />
            Allow Fast Forward
          </label>
        </div>
      )}

      {data.actionType === 'set_actor_sprite' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div>
            <label style={{ fontSize: '10px', color: '#aaa', display: 'block', marginBottom: '2px' }}>Actor:</label>
            <select className="nodrag" value={data.targetActorId ?? ''} onChange={(e) => updateData({ targetActorId: e.target.value || null })} style={{ width: '100%', background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }}>
              <option value="">Select Actor</option>
              {actors && actors.filter(a => a.type !== 'group').map(a => <option key={a.id} value={a.id}>{a.name || `Actor ${a.id}`}</option>)}
              {globalActors && globalActors.filter(a => a.type !== 'group').map(a => <option key={a.id} value={a.id}>{a.name || `Global Actor ${a.id}`}</option>)}
            </select>
          </div>
        </div>
      )}

      {data.actionType === 'set_actor_flip' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div>
            <label style={{ fontSize: '10px', color: '#aaa', display: 'block', marginBottom: '2px' }}>Actor:</label>
            <select className="nodrag" value={data.targetActorId ?? ''} onChange={(e) => updateData({ targetActorId: e.target.value || null })} style={{ width: '100%', background: '#111', color: '#fff', border: '1px solid #4CAF50', borderRadius: '3px', padding: '4px', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }}>
              <option value="">Select Actor</option>
              {actors && actors.filter(a => a.type !== 'group').map(a => <option key={a.id} value={a.id}>{a.name || `Actor ${a.id}`}</option>)}
              {globalActors && globalActors.filter(a => a.type !== 'group').map(a => <option key={a.id} value={a.id}>{a.name || `Global Actor ${a.id}`}</option>)}
            </select>
          </div>
          <label style={{ fontSize: '10px', color: '#aaa', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
            <input type="checkbox" className="nodrag" checked={data.flipX || false} onChange={(e) => updateData({ flipX: e.target.checked })} />
            Flip Horizontal
          </label>
          <label style={{ fontSize: '10px', color: '#aaa', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
            <input type="checkbox" className="nodrag" checked={data.flipY || false} onChange={(e) => updateData({ flipY: e.target.checked })} />
            Flip Vertical
          </label>
        </div>
      )}

      {data.actionType !== 'menu' && !(data.actionType === 'check_input' && data.useThreshold && data.branchByThreshold) && (
        <Handle type="source" position={Position.Right} />
      )}
    </div>
  );
};

const NODE_TYPES = { customAction: CustomActionNode, customStart: CustomStartNode };

const nodeGroups = [
  {
    id: 'flow',
    name: 'Flow & Inputs',
    items: [
      { type: 'dialog', label: 'Show Dialog' },
      { type: 'menu', label: 'Show Menu' },
      { type: 'show_image', label: 'Show Image' },
      { type: 'wait', label: 'Wait' },
      { type: 'run_script', label: 'Run Script' },
      { type: 'check_input', label: 'Check Input' },
      { type: 'check_random', label: 'Check Random' },
      { type: 'set_timer', label: 'Set Timer' },
      { type: 'attach_input_script', label: 'Attach Input Script' },
      { type: 'draw_text', label: 'Draw Text' },
      { type: 'await_input', label: 'Await Input' }
    ]
  },
  {
    id: 'pointnclick',
    name: 'Point & Click',
    items: [
      { type: 'check_hover', label: 'Check Hovering Actor' },
      { type: 'get_cursor_pos', label: 'Get Cursor Position' },
      { type: 'set_cursor_pos', label: 'Set Cursor Position' },
      { type: 'set_pointer_visible', label: 'Set Pointer Visibility' }
    ]
  },
  {
    id: 'shmup',
    name: 'Shoot \'Em Up',
    items: [
      { type: 'set_scroll_speed', label: 'Set Scroll Speed' },
      { type: 'set_actor_rotation', label: 'Set Actor Rotation' },
      { type: 'set_actor_scale', label: 'Set Actor Scale' }
    ]
  },
  {
    id: 'racing',
    name: 'Racing',
    items: [
      { type: 'set_car_speed', label: 'Set Car Speed' },
      { type: 'set_car_steering', label: 'Set Car Steering' }
    ]
  },
  {
    id: 'actors',
    name: 'Actors & Motion',
    items: [
      { type: 'move', label: 'Move Actor' },
      { type: 'spawn_actor', label: 'Spawn Actor' },
      { type: 'destroy_actor', label: 'Destroy Actor' },
      { type: 'play_animation', label: 'Play Animation' },
      { type: 'shoot_projectile', label: 'Shoot Projectile' },
      { type: 'set_anim_speed', label: 'Set Animation Speed' },
      { type: 'set_movement_speed', label: 'Set Movement Speed' },
      { type: 'start_update', label: 'Start Update' },
      { type: 'stop_update', label: 'Stop Update' },
      { type: 'set_direction', label: 'Set Direction' },
      { type: 'actor_emote', label: 'Actor Emote' },
      { type: 'set_actor_sprite', label: 'Set Actor Sprite' },
      { type: 'set_actor_flip', label: 'Set Actor Flip' },
      { type: 'get_actor_pos', label: 'Get Actor Position' }
    ]
  },
  {
    id: 'collision',
    name: 'Collision & Triggers',
    items: [
      { type: 'check_collision', label: 'Check Collision' },
      { type: 'check_proj_hit', label: 'Check Proj Hit' },
      { type: 'check_map_boundary', label: 'Check Boundary' },
      { type: 'check_distance', label: 'Check Distance' }
    ]
  },
  {
    id: 'math',
    name: 'Variables & Math',
    items: [
      { type: 'set_var', label: 'Set Variable' },
      { type: 'check_var', label: 'Check Variable' },
      { type: 'math_operation', label: 'Math Operation' },
      { type: 'set_random_var', label: 'Set Random Var' },
      { type: 'math_equation', label: 'Math Equation' }
    ]
  },
  {
    id: 'audio',
    name: 'Audio & Scenes',
    items: [
      { type: 'sound', label: 'Play Sound' },
      { type: 'music_control', label: 'Music Control' },
      { type: 'change_scene', label: 'Change Scene' },
      { type: 'set_bg_color', label: 'Set BG Color' },
      { type: 'fade_in', label: 'Fade In' },
      { type: 'fade_out', label: 'Fade Out' },
      { type: 'move_camera', label: 'Move Camera' },
      { type: 'camera_lock', label: 'Camera Lock' },
      { type: 'camera_shake', label: 'Camera Shake' },
      { type: 'overlay_show', label: 'Overlay Show' },
      { type: 'overlay_hide', label: 'Overlay Hide' },
      { type: 'text_set_anim_speed', label: 'Set Text Speed' }
    ]
  },
  {
    id: 'system',
    name: 'Game State',
    items: [
      { type: 'save_game', label: 'Save Game' },
      { type: 'load_game', label: 'Load Game' },
      { type: 'restart_game', label: 'Restart Game' }
    ]
  }
];

const ScriptEditor = () => {
  const { actors, setActors, globalActors, setGlobalActors, editingScriptActorId, setEditingScriptActorId, triggers, setTriggers, editingScriptTriggerId, setEditingScriptTriggerId, customScripts, setCustomScripts, editingCustomScriptId, setEditingCustomScriptId, globalScript, setGlobalScript, editingGlobalScript, setEditingGlobalScript, scenes, setScenes, editingScriptSceneId, setEditingScriptSceneId, saveHistory, layers, dimensions } = usePxShop();

  const entity = useMemo(() => {
    return editingScriptActorId ? (actors.find(a => String(a.id) === String(editingScriptActorId)) || globalActors.find(a => String(a.id) === String(editingScriptActorId)))
      : editingScriptTriggerId ? triggers.find(t => String(t.id) === String(editingScriptTriggerId))
        : editingCustomScriptId ? customScripts.find(s => String(s.id) === String(editingCustomScriptId))
          : editingScriptSceneId ? scenes.find(s => String(s.id) === String(editingScriptSceneId))
            : editingGlobalScript ? { name: "Global Game Script", script: globalScript }
              : null;
  }, [editingScriptActorId, actors, globalActors, editingScriptTriggerId, triggers, editingCustomScriptId, customScripts, editingScriptSceneId, scenes, editingGlobalScript, globalScript]);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const lastLoadedIdRef = useRef(null);

  const [openGroup, setOpenGroup] = useState('flow');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const currentEditTargetKey = editingScriptActorId
      ? `actor-${editingScriptActorId}`
      : editingScriptTriggerId
        ? `trigger-${editingScriptTriggerId}`
        : editingCustomScriptId
          ? `custom-${editingCustomScriptId}`
          : editingScriptSceneId
            ? `scene-${editingScriptSceneId}`
            : editingGlobalScript
              ? 'global'
              : null;

    if (!currentEditTargetKey) {
      lastLoadedIdRef.current = null;
      return;
    }

    if (lastLoadedIdRef.current === currentEditTargetKey) {
      return;
    }

    if (entity) {
      lastLoadedIdRef.current = currentEditTargetKey;
      if (entity.script && entity.script.nodes && entity.script.nodes.length > 0) {
        // Backwards compatibility migration for nodes previously created as 'default' or 'input'
        const migratedNodes = entity.script.nodes.map(n => {
          let node = { ...n };

          if (node.id === 'start') {
            node.deletable = false;
            let options = [];
            if (editingScriptActorId) {
              options = ['On Update', 'On Init', 'On Interact'];
              if (!options.includes(node.data.label)) node.data = { ...node.data, label: 'On Update' };
            } else if (editingScriptSceneId) {
              options = ['On Start', 'On Update'];
            } else if (editingGlobalScript) {
              options = ['On Update', 'On Init'];
            } else if (editingScriptTriggerId) {
              options = ['On Enter', 'On Leave', 'On Interact'];
            } else if (editingCustomScriptId) {
              options = ['On Call'];
            }
            node = { ...node, type: 'customStart', data: { ...node.data, options } };
          }

          if (node.type === 'default' || node.type === 'action' || (node.type === 'customAction' && !node.data?.actionType)) {
            const actionType = node.data.label === 'Show Dialog' ? 'dialog'
              : node.data.label === 'Show Menu' ? 'menu'
                : node.data.label === 'Show Image' ? 'show_image'
                  : node.data.label === 'Wait' ? 'wait'
                    : node.data.label === 'Set BG Color' ? 'set_bg_color'
                      : node.data.label === 'Move Actor' ? 'move'
                        : node.data.label === 'Check Input' ? 'check_input'
                          : node.data.label === 'Run Script' ? 'run_script'
                            : node.data.label === 'Play Sound' ? 'sound'
                              : node.data.label === 'Set Variable' ? 'set_var'
                                : node.data.label === 'Shoot Projectile' ? 'shoot_projectile'
                                  : node.data.label === 'Check Projectile Hit' ? 'check_proj_hit'
                                    : node.data.label === 'Check Map Boundary' ? 'check_map_boundary'
                                      : node.data.label === 'Check Collision' ? 'check_collision'
                                        : node.data.label === 'Change Scene' ? 'change_scene'
                                          : node.data.label === 'Restart Current Scene' ? 'restart_scene'
                                            : node.data.label === 'Spawn Actor' ? 'spawn_actor'
                                              : node.data.label === 'Destroy Actor' ? 'destroy_actor'
                                                : node.data.label === 'Music Control' ? 'music_control'
                                                  : node.data.label === 'Play Animation' ? 'play_animation'
                                                    : node.data.label === 'Check Variable' ? 'check_var'
                                                      : node.data.label === 'Set Random Var' ? 'set_random_var'
                                                        : node.data.label === 'Math Operation' ? 'math_operation'
                                                          : node.data.label === 'Math Equation' ? 'math_equation'
                                                            : node.data.label === 'Save Game' ? 'save_game'
                                                              : node.data.label === 'Load Game' ? 'load_game'
                                                                : node.data.label === 'Restart Game' ? 'restart_game'
                                                                  : node.data.label === 'Check Random' ? 'check_random'
                                                                    : node.data.label === 'Check Distance' ? 'check_distance'
                                                                      : node.data.label === 'Check Hovering Actor' ? 'check_hover'
                                                                        : node.data.label === 'Get Cursor Position' ? 'get_cursor_pos'
                                                                          : node.data.label === 'Set Cursor Position' ? 'set_cursor_pos'
                                                                            : node.data.label === 'Set Pointer Visibility' ? 'set_pointer_visible'
                                                                              : node.data.label === 'Set Scroll Speed' ? 'set_scroll_speed'
                                                                                : node.data.label === 'Set Actor Rotation' ? 'set_actor_rotation'
                                                                                  : node.data.label === 'Set Actor Scale' ? 'set_actor_scale'
                                                                                    : node.data.label === 'Set Car Speed' ? 'set_car_speed'
                                                                                      : node.data.label === 'Set Car Steering' ? 'set_car_steering'
                                                                                         : node.data.label === 'Set Animation Speed' ? 'set_anim_speed'
                                                                                           : node.data.label === 'Set Movement Speed' ? 'set_movement_speed'
                                                                                             : node.data.label === 'Start Update' ? 'start_update'
                                                                                               : node.data.label === 'Stop Update' ? 'stop_update'
                                                                                                 : node.data.label === 'Attach Input Script' ? 'attach_input_script'
                                                                                                   : node.data.label === 'Draw Text' ? 'draw_text'
                                                                                                     : node.data.label === 'Camera Shake' ? 'camera_shake'
                                                                                       : node.data.label === 'Set Timer' ? 'set_timer'
                                                                                          : node.data.label === 'Move Camera' ? 'move_camera'
                                                                                            : node.data.label === 'Fade In' ? 'fade_in'
                                                                                              : node.data.label === 'Fade Out' ? 'fade_out'
                                                                                                : node.data.label === 'Set Direction' ? 'set_direction'
                                                                                                  : node.data.label === 'Await Input' ? 'await_input'
                                                                                                    : node.data.label === 'Actor Emote' ? 'actor_emote'
                                                                                                      : node.data.label === 'Camera Lock' ? 'camera_lock'
                                                                                                        : node.data.label === 'Overlay Show' ? 'overlay_show'
                                                                                                          : node.data.label === 'Overlay Hide' ? 'overlay_hide'
                                                                                                            : node.data.label === 'Set Text Speed' ? 'text_set_anim_speed'
                                                                                                              : node.data.label === 'Set Actor Sprite' ? 'set_actor_sprite'
                                                                                                                : node.data.label === 'Set Actor Flip' ? 'set_actor_flip'
                                                                                           : node.data.label === 'Get Actor Position' ? 'get_actor_pos' : 'default';
            return { ...node, type: 'customAction', data: { ...node.data, actionType } };
          }
          return node;
        });
        setNodes(migratedNodes);
        setEdges(entity.script.edges || []);
      } else {
        let startLabel = 'On Interact';
        let options = [];

        if (editingScriptActorId) {
          startLabel = 'On Update';
          options = ['On Update', 'On Init', 'On Interact'];
        } else if (editingScriptTriggerId) {
          startLabel = entity.type === 'enter' ? 'On Enter' : (entity.type === 'leave' ? 'On Leave' : 'On Interact');
          options = ['On Enter', 'On Leave', 'On Interact'];
        } else if (editingCustomScriptId) {
          startLabel = 'On Call';
          options = ['On Call'];
        } else if (editingGlobalScript) {
          startLabel = 'On Update';
          options = ['On Update', 'On Init'];
        } else if (editingScriptSceneId) {
          startLabel = 'On Start';
          options = ['On Start', 'On Update'];
        }

        setNodes([{ id: 'start', position: { x: 420, y: 20 }, data: { label: startLabel, options }, type: 'customStart', deletable: false }]);
        setEdges([]);
      }
    }
  }, [entity, setNodes, setEdges, editingScriptActorId, editingScriptTriggerId, editingCustomScriptId, editingScriptSceneId, editingGlobalScript]);

  const onConnect = useCallback((params) => setEdges((eds) => addEdge(params, eds)), [setEdges]);

  const handleClose = () => {
    if (editingScriptActorId) {
      const isGlobal = globalActors.some(a => String(a.id) === String(editingScriptActorId));
      if (isGlobal) {
        const newGlobal = globalActors.map(a => String(a.id) === String(editingScriptActorId) ? { ...a, script: { nodes, edges } } : a);
        setGlobalActors(newGlobal);
        setEditingScriptActorId(null);
        saveHistory("Edit Actor Script", layers, dimensions, { globalActors: newGlobal });
      } else {
        const newActors = actors.map(a => String(a.id) === String(editingScriptActorId) ? { ...a, script: { nodes, edges } } : a);
        setActors(newActors);
        setEditingScriptActorId(null);
        saveHistory("Edit Actor Script", layers, dimensions, { actors: newActors });
      }
    } else if (editingScriptTriggerId) {
      const newTriggers = triggers.map(t => String(t.id) === String(editingScriptTriggerId) ? { ...t, script: { nodes, edges } } : t);
      setTriggers(newTriggers);
      setEditingScriptTriggerId(null);
      saveHistory("Edit Trigger Script", layers, dimensions, { triggers: newTriggers });
    } else if (editingCustomScriptId) {
      const newScripts = customScripts.map(s => String(s.id) === String(editingCustomScriptId) ? { ...s, script: { nodes, edges } } : s);
      setCustomScripts(newScripts);
      setEditingCustomScriptId(null);
      saveHistory("Edit Custom Script", layers, dimensions, { customScripts: newScripts });
    } else if (editingGlobalScript) {
      const newGlobal = { nodes, edges };
      setGlobalScript(newGlobal);
      setEditingGlobalScript(false);
      saveHistory("Edit Global Script", layers, dimensions, { globalScript: newGlobal });
    } else if (editingScriptSceneId) {
      const newScenes = scenes.map(s => String(s.id) === String(editingScriptSceneId) ? { ...s, script: { nodes, edges } } : s);
      setScenes(newScenes);
      setEditingScriptSceneId(null);
      saveHistory("Edit Scene Start Script", layers, dimensions, { scenes: newScenes });
    }
  };

  const addNode = useCallback((actionType, label) => {
    const prevNode = nodes.length > 0 ? nodes[nodes.length - 1] : null;
    const data = { label, actionType };
    if (actionType === 'menu') {
      data.options = [
        { text: 'Yes' },
        { text: 'No' }
      ];
      data.message = '';
    }
    const newNode = {
      id: Date.now().toString(),
      type: 'customAction',
      position: { x: prevNode ? prevNode.position.x + 220 : 420, y: prevNode ? prevNode.position.y : 20 },
      data
    };
    setNodes((nds) => [...nds, newNode]);
    const hasBranchingNode = nodes.some(n => n.data?.actionType === 'menu' || n.data?.actionType === 'check_input');
    if (prevNode && !hasBranchingNode) {
      const edgeId = `e-${prevNode.id}-${newNode.id}`;
      const newEdge = {
        id: edgeId,
        source: prevNode.id,
        target: newNode.id,
        sourceHandle: null,
        targetHandle: null
      };
      setEdges((eds) => [...eds, newEdge]);
    }
  }, [nodes, setNodes, setEdges]);

  if ((!editingScriptActorId && !editingScriptTriggerId && !editingCustomScriptId && !editingGlobalScript && !editingScriptSceneId) || !entity) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 20000, backgroundColor: '#1e1e1e', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '10px 20px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#2a2a2a' }}>
        <div style={{ color: '#fff', fontWeight: 'bold', fontSize: '16px' }}>Script Editor: {entity.name}</div>
        <button onClick={handleClose} style={{ background: 'transparent', border: '1px solid #ff4444', color: '#ff4444', padding: '6px 16px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }} onMouseEnter={e => { e.target.style.background = '#ff4444'; e.target.style.color = '#fff'; }} onMouseLeave={e => { e.target.style.background = 'transparent'; e.target.style.color = '#ff4444'; }}>Close & Save</button>
      </div>
      <div style={{ flex: 1, position: 'relative' }}>
        <ReactFlowProvider>
          <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} defaultViewport={{ x: 0, y: 0, zoom: 1.0 }} nodeTypes={NODE_TYPES}>
            <Panel position="top-left" style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              background: '#2a2a2a',
              padding: '12px',
              borderRadius: '8px',
              border: '1px solid #444',
              color: '#fff',
              maxHeight: 'calc(100vh - 120px)',
              overflowY: 'auto',
              width: '230px',
              boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
              boxSizing: 'border-box'
            }}>
              <div style={{ color: '#aaa', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', borderBottom: '1px solid #3d3d3d', paddingBottom: '6px' }}>Add Script Node</div>

              <input
                type="text"
                className="nodrag"
                placeholder="Search nodes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  background: '#111',
                  color: '#fff',
                  border: '1px solid #444',
                  borderRadius: '4px',
                  padding: '6px 8px',
                  fontSize: '11px',
                  outline: 'none',
                  marginBottom: '8px',
                  width: '100%',
                  boxSizing: 'border-box'
                }}
              />

              {nodeGroups.map((group) => {
                const filteredItems = searchQuery ? group.items.filter(item => item.label.toLowerCase().includes(searchQuery.toLowerCase())) : group.items;
                if (searchQuery && filteredItems.length === 0) return null;

                const isOpen = searchQuery ? true : openGroup === group.id;

                return (
                  <div key={group.id} style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '4px' }}>
                    <div
                      onClick={() => {
                        if (!searchQuery) {
                          setOpenGroup(prev => prev === group.id ? null : group.id);
                        }
                      }}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: '#333',
                        padding: '6px 8px',
                        borderRadius: '4px',
                        cursor: searchQuery ? 'default' : 'pointer',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        userSelect: 'none',
                        color: isOpen ? '#4CAF50' : '#fff',
                        border: '1px solid #444',
                        transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={(e) => { if (!searchQuery) e.currentTarget.style.background = '#3a3a3a'; }}
                      onMouseLeave={(e) => { if (!searchQuery) e.currentTarget.style.background = '#333'; }}
                    >
                      <span>{group.name}</span>
                      <span style={{ fontSize: '9px' }}>{isOpen ? '▼' : '▶'}</span>
                    </div>
                    {isOpen && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingLeft: '6px', marginTop: '2px', borderLeft: '2px solid #3a3a3a' }}>
                        {filteredItems.map((item) => (
                          <button
                            key={item.type}
                            onClick={() => addNode(item.type, item.label)}
                            style={{
                              background: '#222',
                              border: '1px solid #444',
                              color: '#ddd',
                              padding: '6px 10px',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '11px',
                              textAlign: 'left',
                              width: '100%',
                              transition: 'all 0.15s ease',
                              boxSizing: 'border-box'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = '#333';
                              e.currentTarget.style.color = '#fff';
                              e.currentTarget.style.borderColor = '#4CAF50';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = '#222';
                              e.currentTarget.style.color = '#ddd';
                              e.currentTarget.style.borderColor = '#444';
                            }}
                          >
                            + {item.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </Panel>
            <MiniMap style={{ background: '#2a2a2a' }} nodeColor="#4CAF50" maskColor="rgba(0,0,0,0.5)" />
            <Controls />
            <Background color="#444" gap={16} />
          </ReactFlow>
        </ReactFlowProvider>
      </div>
    </div>
  );
};

export default ScriptEditor;