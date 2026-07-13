import { usePxShop } from '../context/PxShopContext';
import { BsFilm, BsPlus, BsTrash, BsChevronDown, BsChevronRight } from 'react-icons/bs';
import TileIcon from './TileIcon';


const AnimationsPanel = ({ isCollapsed, onToggle }) => {
  const { animations, setAnimations, savedTiles, saveHistory, layers, dimensions } = usePxShop();

  const addAnimation = (e) => {
    e.stopPropagation();
    const newAnim = {
      id: Date.now() + Math.random(),
      name: `Anim ${animations.length + 1}`,
      frames: [],
      fps: 8
    };
    const nextAnims = [...animations, newAnim];
    setAnimations(nextAnims);
    saveHistory("Add Animation", layers, dimensions, { animations: nextAnims });
  };

  const deleteAnimation = (e, id) => {
    e.stopPropagation();
    const nextAnims = animations.filter(a => a.id !== id);
    setAnimations(nextAnims);
    saveHistory("Delete Animation", layers, dimensions, { animations: nextAnims });
  };

  const updateAnimation = (id, prop, value) => {
    setAnimations(animations.map(a => a.id === id ? { ...a, [prop]: value } : a));
  };

  const addFrame = (animId, tileId) => {
    const nextAnims = animations.map(a => {
      if (a.id === animId) {
        return { ...a, frames: [...a.frames, tileId] };
      }
      return a;
    });
    setAnimations(nextAnims);
    saveHistory("Add Anim Frame", layers, dimensions, { animations: nextAnims });
  };

  const removeFrame = (animId, frameIndex) => {
    const nextAnims = animations.map(a => {
      if (a.id === animId) {
        const newFrames = [...a.frames];
        newFrames.splice(frameIndex, 1);
        return { ...a, frames: newFrames };
      }
      return a;
    });
    setAnimations(nextAnims);
    saveHistory("Remove Anim Frame", layers, dimensions, { animations: nextAnims });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: isCollapsed ? 'none' : 1, borderBottom: '2px solid #222', minHeight: 0, background: isCollapsed ? 'transparent' : '#3d3d3d' }}>
      <div 
        onClick={onToggle}
        style={{ padding: '15px', borderBottom: isCollapsed ? 'none' : '1px solid #3c3c3c', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}
      >
        <span style={{ fontWeight: 'bold', fontSize: '11px', textTransform: 'uppercase', color: isCollapsed ? '#aaa' : '#4CAF50', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BsFilm /> Animations
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={e => { if (isCollapsed) { onToggle(); } e.stopPropagation(); }}>
          <button onClick={addAnimation} title="Add Animation" style={{ backgroundColor: 'transparent', border: '1px solid #555', color: '#888', padding: '3px 7px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'all 0.2s' }} onMouseEnter={e => { e.currentTarget.style.borderColor = '#4CAF50'; e.currentTarget.style.color = '#4CAF50'; }} onMouseLeave={e => { e.currentTarget.style.borderColor = '#555'; e.currentTarget.style.color = '#888'; }}><BsPlus /></button>
          <div onClick={e => { e.stopPropagation(); onToggle(); }} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            {isCollapsed ? <BsChevronRight style={{ color: '#aaa' }} /> : <BsChevronDown style={{ color: '#aaa' }} />}
          </div>
        </div>
      </div>
      {!isCollapsed && (
        <div style={{ flex: 1, padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto' }}>
        {animations.map((anim) => (
            <div key={anim.id} style={{ display: 'flex', flexDirection: 'column', padding: '8px', backgroundColor: '#1e1e1e', borderRadius: '4px', border: '1px solid #333', gap: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <input value={anim.name} onChange={(e) => updateAnimation(anim.id, 'name', e.target.value)} style={{ width: '120px', background: '#111', color: '#fff', border: '1px solid #4CAF50', outline: 'none', padding: '2px 4px', fontSize: '12px', borderRadius: '3px' }} placeholder="Anim Name" />
                <button onClick={(e) => deleteAnimation(e, anim.id)} style={{ background: 'none', border: 'none', color: '#ff4444', cursor: 'pointer', padding: 0 }}><BsTrash /></button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                 <label style={{ fontSize: '10px', color: '#aaa' }}>FPS:</label>
                 <input type="number" min="1" max="60" value={anim.fps} onChange={(e) => updateAnimation(anim.id, 'fps', parseInt(e.target.value) || 8)} style={{ width: '40px', background: '#111', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px', outline: 'none', borderRadius: '3px' }} />
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', padding: '4px', background: '#111', borderRadius: '3px', border: '1px solid #222', minHeight: '34px' }}>
                 {anim.frames.map((frameData, idx) => {
                   const isArray = Array.isArray(frameData);
                   return (
                     <div key={idx} style={{ position: 'relative', width: '24px', height: '24px', border: '1px solid #444', overflow: 'hidden' }}>
                        {isArray ? (
                           <div style={{ color: '#fff', fontSize: '8px', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>[Grid]</div>
                        ) : (
                           (() => {
                             const tile = savedTiles.find(t => String(t.id) === String(frameData));
                             return tile ? (
                                <TileIcon tile={tile} size={24} />
                             ) : null;
                           })()
                        )}
                        <div onClick={() => removeFrame(anim.id, idx)} style={{ position: 'absolute', top: -4, right: -4, background: '#ff4444', color: '#fff', fontSize: '8px', width: '12px', height: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', cursor: 'pointer' }}>✕</div>
                     </div>
                   )
                 })}
              <select value="" onChange={(e) => addFrame(anim.id, e.target.value ? Number(e.target.value) : null)} style={{ width: '24px', height: '24px', background: '#333', color: '#fff', border: '1px dashed #666', outline: 'none', cursor: 'pointer' }} title="Add Frame">
                    <option value="" disabled>+</option>
                    {savedTiles.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                 </select>
              </div>
            </div>
        ))}
        {animations.length === 0 && <div style={{ fontSize: '11px', color: '#666', textAlign: 'center', padding: '10px 0' }}>No animations defined</div>}
        </div>
      )}
    </div>
  );
};
export default AnimationsPanel;