import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { usePxShop } from '../context/PxShopContext';
import { BsSoundwave, BsUpload, BsTrash, BsChevronDown, BsChevronRight, BsPlayFill, BsPauseFill, BsSearch, BsPencil, BsCheck, BsX, BsPlus, BsFolder2Open } from 'react-icons/bs';
import toast from 'react-hot-toast';
import { API_BASE_URL } from '../config';

const SfxPanel = ({ isCollapsed, onToggle }) => {
  const { musicTracks, setMusicTracks, saveHistory, layers, dimensions, generateWav, addFreesoundArtist } = usePxShop();

  // SFX Generator States
  const [sfxType, setSfxType] = useState('square');
  const [sfxFreq, setSfxFreq] = useState(440);
  const [sfxDur, setSfxDur] = useState(150);
  const [sfxFadeOut, setSfxFadeOut] = useState(true);

  // Playback & Upload States
  const [playingSfxId, setPlayingSfxId] = useState(null);
  const sfxAudioRef = useRef(null);
  const sfxFileInputRef = useRef(null);

  // Renaming states
  const [renamingTrackId, setRenamingTrackId] = useState(null);
  const [renamingName, setRenamingName] = useState('');

  // Freesound Search States
  const [sfxSearchQuery, setSfxSearchQuery] = useState('');
  const [isSfxSearchModalOpen, setIsSfxSearchModalOpen] = useState(false);
  const [sfxSearchResults, setSfxSearchResults] = useState([]);
  const [isSfxLoading, setIsSfxLoading] = useState(false);
  const [sfxError, setSfxError] = useState(null);
  const [previewSfxId, setPreviewSfxId] = useState(null);
  const previewSfxIdRef = useRef(null);
  const [isSfxPaused, setIsSfxPaused] = useState(false);
  const [sfxPlayPosition, setSfxPlayPosition] = useState(0);
  const [sfxTrackDuration, setSfxTrackDuration] = useState(0);

  // Sync Freesound preview ref
  useEffect(() => {
    previewSfxIdRef.current = previewSfxId;
  }, [previewSfxId]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (sfxAudioRef.current) {
        sfxAudioRef.current.pause();
      }
    };
  }, []);

  const handleCloseSfxModal = () => {
    setIsSfxSearchModalOpen(false);
    setSfxSearchResults([]);
    handleStopSfxPreview();
    setSfxError(null);
  };

  const handleStopSfxPreview = () => {
    setPreviewSfxId(null);
    if (sfxAudioRef.current) {
      sfxAudioRef.current.pause();
    }
  };

  const handlePlaySfx = () => {
    const buffer = generateWav(sfxType, sfxFreq, sfxDur, sfxFadeOut);
    const blob = new Blob([buffer], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.play();
  };

  const handleSaveSfxToProject = () => {
    const buffer = generateWav(sfxType, sfxFreq, sfxDur, sfxFadeOut);
    const blob = new Blob([buffer], { type: 'audio/wav' });
    const reader = new FileReader();
    reader.onload = (event) => {
      const trackName = `sfx_${sfxType}_${sfxFreq}Hz.wav`;
      const newSfx = {
        id: Date.now().toString(),
        name: trackName,
        data: event.target.result, // base64 Data URL
        isComposed: false,
        isSfx: true,
        sfxParams: {
          type: sfxType,
          freq: sfxFreq,
          durationMs: sfxDur,
          fadeOut: sfxFadeOut
        }
      };
      const nextTracks = [...musicTracks, newSfx];
      setMusicTracks(nextTracks);
      saveHistory("Generate SFX", layers, dimensions, { musicTracks: nextTracks });
      toast.success(`Saved SFX "${trackName}" to project!`);
    };
    reader.readAsDataURL(blob);
  };

  const handleSfxWavUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.wav')) {
      toast.error('Only .wav files are supported for SFX import.');
      if (sfxFileInputRef.current) sfxFileInputRef.current.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      if (!window.confirm(`This WAV file is ${sizeMB}MB. Large WAV files can significantly increase GBA ROM size. Continue?`)) {
        if (sfxFileInputRef.current) sfxFileInputRef.current.value = '';
        return;
      }
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const newSfx = {
        id: Date.now().toString(),
        name: file.name,
        data: event.target.result,
        isComposed: false,
        isSfx: true
      };
      const nextTracks = [...musicTracks, newSfx];
      setMusicTracks(nextTracks);
      saveHistory("Import SFX WAV", layers, dimensions, { musicTracks: nextTracks });
      toast.success(`Imported SFX "${file.name}"`);
    };
    reader.readAsDataURL(file);
    if (sfxFileInputRef.current) sfxFileInputRef.current.value = '';
  };

  const handlePlayTrackSfx = (track) => {
    if (playingSfxId === track.id) {
      if (sfxAudioRef.current) {
        sfxAudioRef.current.pause();
      }
      setPlayingSfxId(null);
      return;
    }
    if (sfxAudioRef.current) {
      sfxAudioRef.current.pause();
    }
    const audio = new Audio(track.data);
    sfxAudioRef.current = audio;
    setPlayingSfxId(track.id);
    audio.play().catch(err => {
      console.error("Failed to play audio:", err);
      toast.error("Failed to play sound effect.");
      setPlayingSfxId(null);
    });
    audio.addEventListener('ended', () => {
      setPlayingSfxId(null);
    });
  };

  const handleRenameTrack = (trackId, newName) => {
    if (!newName.trim()) return;
    const track = musicTracks.find(t => String(t.id) === String(trackId));
    let finalName = newName.trim();
    if (track) {
      const originalExt = '.wav';
      if (!finalName.toLowerCase().endsWith(originalExt.toLowerCase())) {
        finalName = `${finalName}${originalExt}`;
      }
    }
    const nextTracks = musicTracks.map(t => String(t.id) === String(trackId) ? { ...t, name: finalName } : t);
    setMusicTracks(nextTracks);
    saveHistory("Rename SFX Track", layers, dimensions, { musicTracks: nextTracks });
    setRenamingTrackId(null);
  };

  const addSfxGroup = (e) => {
    e.stopPropagation();
    const newGroup = {
      id: (Date.now() + Math.random()).toString(),
      type: 'group',
      isGroup: true,
      isSfx: true,
      name: `Group ${musicTracks.filter(t => t.type === 'group' && t.isSfx).length + 1}`,
      isOpen: false
    };
    const nextTracks = [...musicTracks, newGroup];
    setMusicTracks(nextTracks);
    saveHistory("Add SFX Group", layers, dimensions, { musicTracks: nextTracks });
  };

  const toggleGroup = (groupId) => {
    const nextTracks = musicTracks.map(t => t.id === groupId ? { ...t, isOpen: !t.isOpen } : t);
    setMusicTracks(nextTracks);
    saveHistory("Toggle SFX Group", layers, dimensions, { musicTracks: nextTracks });
  };

  const deleteSfxGroup = (e, id) => {
    e.stopPropagation();
    const nextTracks = musicTracks.filter(t => t.id !== id && String(t.groupId) !== String(id));
    setMusicTracks(nextTracks);
    saveHistory("Delete SFX Group", layers, dimensions, { musicTracks: nextTracks });
  };

  const moveTrackUp = (e, id) => {
    e.stopPropagation();
    const index = musicTracks.findIndex(t => t.id === id);
    if (index <= 0) return;
    const nextTracks = [...musicTracks];
    const temp = nextTracks[index - 1];
    nextTracks[index - 1] = nextTracks[index];
    nextTracks[index] = temp;
    setMusicTracks(nextTracks);
    saveHistory("Move SFX Track Up", layers, dimensions, { musicTracks: nextTracks });
  };

  const moveTrackDown = (e, id) => {
    e.stopPropagation();
    const index = musicTracks.findIndex(t => t.id === id);
    if (index === -1 || index >= musicTracks.length - 1) return;
    const nextTracks = [...musicTracks];
    const temp = nextTracks[index + 1];
    nextTracks[index + 1] = nextTracks[index];
    nextTracks[index] = temp;
    setMusicTracks(nextTracks);
    saveHistory("Move SFX Track Down", layers, dimensions, { musicTracks: nextTracks });
  };

  const handleSfxSearch = async () => {
    if (!sfxSearchQuery.trim()) return;
    setIsSfxSearchModalOpen(true);
    setIsSfxLoading(true);
    setSfxError(null);
    setSfxSearchResults([]);
    setPreviewSfxId(null);

    const query = encodeURIComponent(sfxSearchQuery.trim());
    const searchUrl = `https://freesound.org/search/?q=${query}&f=license%3A%28%22Attribution%22+OR+%22Creative+Commons+0%22%29+license%3A%22Creative+Commons+0%22+category%3A%22Sound+effects%22+type%3A%22wav%22`;
    const proxyUrl = `${API_BASE_URL}/proxy-oga?url=${encodeURIComponent(searchUrl)}`;

    try {
      const response = await fetch(proxyUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.statusText}`);
      }
      const html = await response.text();
      
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      const players = doc.querySelectorAll('.bw-player');
      const results = [];
      
      players.forEach(player => {
        const id = player.getAttribute('data-sound-id');
        const artist = player.getAttribute('data-username') || 'Unknown';
        const title = player.getAttribute('data-title') || 'Untitled';
        const previewUrl = player.getAttribute('data-mp3') || player.getAttribute('data-ogg') || '';
        const duration = parseFloat(player.getAttribute('data-duration') || '0');
        
        if (id && previewUrl) {
          results.push({
            id,
            artist,
            title,
            previewUrl,
            duration
          });
        }
      });
      
      setSfxSearchResults(results);
      if (results.length === 0) {
        setSfxError("No free WAV sound effects found. Try a different query (e.g. 'explosion' or 'laser').");
      }
    } catch (err) {
      console.error(err);
      setSfxError(`Search failed: ${err.message}`);
    } finally {
      setIsSfxLoading(false);
    }
  };

  const handlePlaySfxPreview = (result) => {
    if (previewSfxId === result.id) {
      handleStopSfxPreview();
      return;
    }
    
    if (sfxAudioRef.current) {
      sfxAudioRef.current.pause();
    }
    
    setPreviewSfxId(result.id);
    setSfxPlayPosition(0);
    setSfxTrackDuration(result.duration || 0);
    setIsSfxPaused(false);
    
    const proxyUrl = `${API_BASE_URL}/proxy-oga?url=${encodeURIComponent(result.previewUrl)}`;
    const audio = new Audio(proxyUrl);
    sfxAudioRef.current = audio;
    
    audio.play().catch(err => {
      console.error("Playback failed:", err);
      toast.error("Failed to play preview.");
      setPreviewSfxId(null);
    });
    
    audio.addEventListener('timeupdate', () => {
      if (previewSfxIdRef.current === result.id) {
        setSfxPlayPosition(audio.currentTime);
        if (audio.duration && !isNaN(audio.duration)) {
          setSfxTrackDuration(audio.duration);
        }
      }
    });
    
    audio.addEventListener('ended', () => {
      if (previewSfxIdRef.current === result.id) {
        setPreviewSfxId(null);
      }
    });
  };

  const handleToggleSfxPause = () => {
    if (sfxAudioRef.current) {
      if (sfxAudioRef.current.paused) {
        sfxAudioRef.current.play().catch(() => {});
        setIsSfxPaused(false);
      } else {
        sfxAudioRef.current.pause();
        setIsSfxPaused(true);
      }
    }
  };

  const handleSfxSeek = (val) => {
    if (sfxAudioRef.current) {
      sfxAudioRef.current.currentTime = val;
      setSfxPlayPosition(val);
    }
  };

  const handleSelectSfx = async (result) => {
    setIsSfxLoading(true);
    const loadingToastId = toast.loading(`Downloading & converting ${result.title}...`);

    try {
      const proxyUrl = `${API_BASE_URL}/proxy-oga?url=${encodeURIComponent(result.previewUrl)}`;
      
      const response = await fetch(proxyUrl);
      if (!response.ok) {
        throw new Error(`Failed to download preview: ${response.statusText}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        throw new Error("Web Audio API is not supported in this environment.");
      }
      
      const audioCtx = new AudioContextClass();
      let decodedBuffer;
      try {
        decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      } catch (decodeErr) {
        throw new Error(`Failed to decode audio data: ${decodeErr.message}`);
      }
      
      // Resample to 16000Hz mono
      const targetSampleRate = 16000;
      const duration = decodedBuffer.duration;
      const numSamples = Math.ceil(duration * targetSampleRate);
      
      const offlineCtx = new OfflineAudioContext(1, numSamples, targetSampleRate);
      
      const bufferSource = offlineCtx.createBufferSource();
      bufferSource.buffer = decodedBuffer;
      bufferSource.connect(offlineCtx.destination);
      bufferSource.start();
      
      const renderedBuffer = await offlineCtx.startRendering();
      const channelData = renderedBuffer.getChannelData(0); // Float32Array
      
      // Encode to 8-bit mono WAV
      const wavBuffer = new ArrayBuffer(44 + numSamples);
      const view = new DataView(wavBuffer);
      
      const writeString = (offset, string) => {
        for (let i = 0; i < string.length; i++) {
          view.setUint8(offset + i, string.charCodeAt(i));
        }
      };
      
      writeString(0, 'RIFF');
      view.setUint32(4, 36 + numSamples, true);
      writeString(8, 'WAVE');
      writeString(12, 'fmt ');
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true); // PCM
      view.setUint16(22, 1, true); // Mono
      view.setUint32(24, targetSampleRate, true);
      view.setUint32(28, targetSampleRate, true); // Byte rate
      view.setUint16(32, 1, true); // Block align
      view.setUint16(34, 8, true); // 8-bit
      writeString(36, 'data');
      view.setUint32(40, numSamples, true);
      
      // Write samples: Float32 [-1, 1] to Uint8 [0, 255]
      for (let i = 0; i < numSamples; i++) {
        let sample = channelData[i];
        if (sample < -1) sample = -1;
        if (sample > 1) sample = 1;
        const u8 = Math.round((sample + 1) * 127.5);
        view.setUint8(44 + i, u8);
      }
      
      const wavBlob = new Blob([wavBuffer], { type: 'audio/wav' });
      const reader = new FileReader();
      
      reader.onload = (event) => {
        if (result.artist && result.artist !== 'Unknown') {
          addFreesoundArtist(result.artist);
        }
        
        const cleanArtist = result.artist && result.artist !== 'Unknown'
          ? result.artist.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '')
          : '';
        
        let targetFilename = `${result.title.toLowerCase().replace(/[^a-z0-9]/g, '_')}.wav`;
        if (cleanArtist) {
          const lowerFilename = targetFilename.toLowerCase();
          if (!lowerFilename.startsWith(cleanArtist)) {
            targetFilename = `${cleanArtist}_${targetFilename}`;
          }
        }
        
        const newSfx = {
          id: Date.now().toString(),
          name: targetFilename,
          data: event.target.result, // base64 Data URL
          isComposed: false,
          isSfx: true
        };
        
        const nextTracks = [...musicTracks, newSfx];
        setMusicTracks(nextTracks);
        saveHistory("Import Freesound SFX", layers, dimensions, { musicTracks: nextTracks });
        toast.success(`Imported SFX ${targetFilename} successfully!`, { id: loadingToastId });
        setIsSfxSearchModalOpen(false);
        setPreviewSfxId(null);
      };
      
      reader.readAsDataURL(wavBlob);
      
    } catch (err) {
      console.error(err);
      toast.error(`Import failed: ${err.message}`, { id: loadingToastId });
    } finally {
      setIsSfxLoading(false);
    }
  };

  const sfxTracks = musicTracks ? musicTracks.filter(t => t.isSfx) : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: isCollapsed ? 'none' : 1, borderBottom: '2px solid #222', minHeight: 0, background: isCollapsed ? 'transparent' : '#3d3d3d' }}>
      <div 
        onClick={onToggle}
        style={{ padding: '15px', borderBottom: isCollapsed ? 'none' : '1px solid #3c3c3c', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}
      >
        <span style={{ fontWeight: 'bold', fontSize: '11px', textTransform: 'uppercase', color: isCollapsed ? '#aaa' : '#e040fb', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BsSoundwave /> Sound Effects
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={e => { if (isCollapsed) { onToggle(); } e.stopPropagation(); }}>
          {!isCollapsed && (
            <button onClick={addSfxGroup} title="Add Group" style={{ backgroundColor: '#ff9800', border: 'none', color: '#fff', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              <BsFolder2Open />
            </button>
          )}
          <div onClick={e => { e.stopPropagation(); onToggle(); }} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            {isCollapsed ? <BsChevronRight style={{ color: '#aaa' }} /> : <BsChevronDown style={{ color: '#aaa' }} />}
          </div>
        </div>
      </div>
      {!isCollapsed && (
        <div style={{ flex: 1, padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto' }}>
          <input type="file" ref={sfxFileInputRef} onChange={handleSfxWavUpload} style={{ display: 'none' }} accept=".wav" />

          {/* Search Freesound bar */}
          <div style={{ display: 'flex', gap: '6px', borderBottom: '1px solid #3c3c3c', backgroundColor: '#202022', padding: '10px', margin: '-10px -10px 10px -10px' }}>
            <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
              <BsSearch style={{ position: 'absolute', left: '10px', color: '#888', pointerEvents: 'none' }} size={12} />
              <input
                type="text"
                placeholder="Search Freesound (.wav)..."
                value={sfxSearchQuery}
                onChange={(e) => setSfxSearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSfxSearch(); }}
                style={{
                  width: '100%',
                  background: '#111',
                  color: '#fff',
                  border: '1px solid #444',
                  borderRadius: '4px',
                  padding: '6px 10px 6px 30px',
                  fontSize: '12px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>
            <button
              onClick={handleSfxSearch}
              style={{
                background: '#e040fb',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                padding: '6px 12px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              Search
            </button>
          </div>

          {/* SFX Tracks List */}
          {sfxTracks && sfxTracks.length > 0 ? (
            sfxTracks.map((track) => {
              const index = musicTracks.findIndex(t => t.id === track.id);
              
              if (track.type === 'group') {
                return (
                  <div key={track.id} 
                    style={{ 
                      display: 'flex', flexDirection: 'column', padding: '6px 10px', 
                      backgroundColor: '#2d2d2d', 
                      borderRadius: '4px',
                      borderLeft: '3px solid #ff9800',
                      marginTop: '4px'
                    }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button onClick={(e) => { e.stopPropagation(); toggleGroup(track.id); }} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 0, fontSize: '12px', width: '15px', textAlign: 'left' }}>
                        {track.isOpen ? '▼' : '▶'}
                      </button>
                      {renamingTrackId === track.id ? (
                        <input
                          autoFocus
                          value={renamingName}
                          onChange={(e) => setRenamingName(e.target.value)}
                          onBlur={() => handleRenameTrack(track.id, renamingName)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRenameTrack(track.id, renamingName);
                            if (e.key === 'Escape') setRenamingTrackId(null);
                          }}
                          style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #ff9800', outline: 'none', padding: '2px', fontSize: '12px', borderRadius: '3px', textAlign: 'left' }}
                        />
                      ) : (
                        <span
                          onDoubleClick={(e) => { e.stopPropagation(); setRenamingTrackId(track.id); setRenamingName(track.name); }}
                          style={{ fontSize: '12px', fontWeight: 'bold', color: '#ff9800', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'pointer', textAlign: 'left' }}
                        >
                          📁 {track.name}
                        </span>
                      )}
                      <button title="Move Up" onClick={(e) => moveTrackUp(e, track.id)} disabled={index === 0} style={{ background: 'none', border: 'none', color: index === 0 ? '#555' : '#fff', cursor: index === 0 ? 'default' : 'pointer', padding: 0 }}>▲</button>
                      <button title="Move Down" onClick={(e) => moveTrackDown(e, track.id)} disabled={index === musicTracks.length - 1} style={{ background: 'none', border: 'none', color: index === musicTracks.length - 1 ? '#555' : '#fff', cursor: index === musicTracks.length - 1 ? 'default' : 'pointer', padding: 0 }}>▼</button>
                      <button onClick={(e) => deleteSfxGroup(e, track.id)} style={{ background: 'none', border: 'none', color: '#ff4444', cursor: 'pointer', padding: 0, marginLeft: '5px', display: 'flex', alignItems: 'center' }}>
                        <BsTrash />
                      </button>
                    </div>
                  </div>
                );
              }

              const group = track.groupId ? musicTracks.find(g => String(g.id) === String(track.groupId)) : null;
              if (group && !group.isOpen) return null;

              return (
                <div key={track.id} style={{ marginLeft: track.groupId ? '15px' : '0', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#111', padding: '6px 8px', borderRadius: '4px', border: '1px solid #e040fb', gap: '8px' }}>
                    {renamingTrackId === track.id ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
                        <input
                          type="text"
                          value={renamingName}
                          onChange={e => setRenamingName(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleRenameTrack(track.id, renamingName);
                            if (e.key === 'Escape') setRenamingTrackId(null);
                          }}
                          autoFocus
                          style={{
                            flex: 1,
                            background: '#222',
                            color: '#fff',
                            border: '1px solid #e040fb',
                            borderRadius: '3px',
                            padding: '2px 6px',
                            fontSize: '12px',
                            outline: 'none'
                          }}
                        />
                        <button onClick={() => handleRenameTrack(track.id, renamingName)} style={{ background: '#e040fb', border: 'none', color: '#fff', borderRadius: '3px', padding: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                          <BsCheck size={14} />
                        </button>
                        <button onClick={() => setRenamingTrackId(null)} style={{ background: '#333', border: '1px solid #555', color: '#ff4444', borderRadius: '3px', padding: '3px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                          <BsX size={14} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', flex: 1 }}>
                          <button
                            onClick={() => handlePlayTrackSfx(track)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#e040fb',
                              cursor: 'pointer',
                              padding: '2px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              marginRight: '2px'
                            }}
                            title={playingSfxId === track.id ? "Pause Sound" : "Play Sound"}
                          >
                            {playingSfxId === track.id ? <BsPauseFill size={14} /> : <BsPlayFill size={14} />}
                          </button>
                          <span style={{ fontSize: '12px', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={track.name}>{track.name}</span>
                          <button onClick={() => { setRenamingTrackId(track.id); setRenamingName(track.name.replace(/\.wav$/i, '')); }} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }} title="Rename Track">
                            <BsPencil size={11} />
                          </button>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <button title="Move Up" onClick={(e) => moveTrackUp(e, track.id)} disabled={index === 0} style={{ background: 'none', border: 'none', color: index === 0 ? '#555' : '#fff', cursor: index === 0 ? 'default' : 'pointer', padding: 0 }}>▲</button>
                          <button title="Move Down" onClick={(e) => moveTrackDown(e, track.id)} disabled={index === musicTracks.length - 1} style={{ background: 'none', border: 'none', color: index === musicTracks.length - 1 ? '#555' : '#fff', cursor: index === musicTracks.length - 1 ? 'default' : 'pointer', padding: 0 }}>▼</button>
                          <button onClick={() => { 
                            const nextTracks = musicTracks.filter(t => t.id !== track.id);
                            setMusicTracks(nextTracks); 
                            saveHistory("Remove SFX Track", layers, dimensions, { musicTracks: nextTracks }); 
                          }} style={{ background: 'none', border: 'none', color: '#ff4444', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}>
                             <BsTrash />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                  
                  {/* Group Assignment Selector */}
                  <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', padding: '2px 0 6px 0' }}>
                    <select 
                      value={track.groupId || ""} 
                      onChange={(e) => {
                        e.stopPropagation();
                        const newGroupId = e.target.value ? e.target.value : null;
                        
                        let nextTracks = musicTracks.map(item => item.id === track.id ? { ...item, groupId: newGroupId } : item);
                        
                        if (newGroupId) {
                          const movedTrack = nextTracks.find(item => item.id === track.id);
                          nextTracks = nextTracks.filter(item => item.id !== track.id);
                          
                          const groupIndex = nextTracks.findIndex(item => item.id === newGroupId);
                          if (groupIndex !== -1) {
                            let insertIndex = groupIndex + 1;
                            while (insertIndex < nextTracks.length && nextTracks[insertIndex].groupId === newGroupId) {
                              insertIndex++;
                            }
                            nextTracks.splice(insertIndex, 0, movedTrack);
                          }
                        } else {
                          const oldGroupId = track.groupId;
                          if (oldGroupId) {
                            const movedTrack = nextTracks.find(item => item.id === track.id);
                            nextTracks = nextTracks.filter(item => item.id !== track.id);
                            
                            const oldGroupIndex = nextTracks.findIndex(item => item.id === oldGroupId);
                            if (oldGroupIndex !== -1) {
                              let insertIndex = oldGroupIndex + 1;
                              while (insertIndex < nextTracks.length && nextTracks[insertIndex].groupId === oldGroupId) {
                                insertIndex++;
                              }
                              nextTracks.splice(insertIndex, 0, movedTrack);
                            } else {
                              nextTracks.push(movedTrack);
                            }
                          }
                        }
                        
                        setMusicTracks(nextTracks);
                        saveHistory("Change SFX Track Group", layers, dimensions, { musicTracks: nextTracks });
                      }}
                      onClick={(e) => e.stopPropagation()}
                      style={{ background: 'transparent', color: '#aaa', border: '1px solid #444', borderRadius: '3px', maxWidth: '120px', fontSize: '10px', outline: 'none' }}
                    >
                      <option value="">No Group</option>
                      {musicTracks.filter(item => item.type === 'group' && item.isSfx).map(g => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              );
            })
          ) : <div style={{ fontSize: '11px', color: '#666', textAlign: 'center', padding: '10px 0' }}>No sound effects added</div>}

          {/* SFX Generator Controls */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px', background: '#1a1a1a', padding: '10px', borderRadius: '4px', border: '1px solid #444' }}>
            <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#e040fb', textTransform: 'uppercase' }}>Generate SFX</span>
            
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '10px', color: '#aaa' }}>Waveform:</span>
              <select value={sfxType} onChange={e => setSfxType(e.target.value)} style={{ background: '#111', color: '#fff', border: '1px solid #333', borderRadius: '3px', padding: '2px', fontSize: '10px', outline: 'none' }}>
                <option value="square">Square (Blip/Jump)</option>
                <option value="sine">Sine (Smooth/Coin)</option>
                <option value="sawtooth">Sawtooth (Harsh/Laser)</option>
                <option value="noise">Noise (Crash/Hit)</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '10px', color: '#aaa' }}>Freq:</span>
              <input type="range" min="50" max="2000" value={sfxFreq} onChange={e => setSfxFreq(Number(e.target.value))} style={{ width: '60px' }} />
              <span style={{ fontSize: '10px', color: '#fff', width: '35px', textAlign: 'right' }}>{sfxFreq}Hz</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '10px', color: '#aaa' }}>Length:</span>
              <input type="range" min="50" max="1000" value={sfxDur} onChange={e => setSfxDur(Number(e.target.value))} style={{ width: '60px' }} />
              <span style={{ fontSize: '10px', color: '#fff', width: '35px', textAlign: 'right' }}>{sfxDur}ms</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
               <input type="checkbox" id="sfx-fade" checked={sfxFadeOut} onChange={e => setSfxFadeOut(e.target.checked)} />
               <label htmlFor="sfx-fade" style={{ fontSize: '10px', color: '#aaa', cursor: 'pointer' }}>Apply Fade Out</label>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '5px' }}>
              <button onClick={handlePlaySfx} style={{ flex: 1, background: '#0078d4', border: 'none', color: '#fff', padding: '6px', borderRadius: '3px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}><BsPlayFill /> Play</button>
              <button onClick={handleSaveSfxToProject} style={{ flex: 1, background: '#333', border: '1px solid #555', color: '#fff', padding: '6px', borderRadius: '3px', cursor: 'pointer', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}><BsPlus /> Save</button>
            </div>
          </div>

          {/* WAV Import Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px', borderTop: '1px solid #333', paddingTop: '10px' }}>
            <button onClick={() => sfxFileInputRef.current?.click()} style={{ width: '100%', background: '#333', color: '#fff', border: '1px solid #555', padding: '10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <BsUpload /> Import WAV File
            </button>
          </div>
        </div>
      )}

      {/* FREESOUND SFX SEARCH MODAL */}
      {isSfxSearchModalOpen && createPortal(
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 100000,
          backgroundColor: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '20px'
        }}>
          <div style={{
            width: '850px',
            maxWidth: '100%',
            height: '80%',
            maxHeight: '700px',
            background: '#202022',
            border: '1px solid #444',
            borderRadius: '8px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 15px 40px rgba(0,0,0,0.8)'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid #3c3c3c',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#2a2a2c'
            }}>
              <span style={{ fontWeight: 'bold', fontSize: '15px', color: '#fff', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BsSoundwave style={{ color: '#e040fb' }} /> Freesound Sound Effects Search
              </span>
              <button
                onClick={handleCloseSfxModal}
                style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', fontSize: '18px', padding: '4px' }}
              >
                ✕
              </button>
            </div>

            {/* Modal Search Bar */}
            <div style={{ padding: '15px 20px', borderBottom: '1px solid #2d2d2f', display: 'flex', gap: '8px', backgroundColor: '#18181a' }}>
              <input
                type="text"
                placeholder="Search sound effects (e.g. explosion, coin, jump)..."
                value={sfxSearchQuery}
                onChange={(e) => setSfxSearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSfxSearch(); }}
                style={{
                  flex: 1,
                  background: '#0d0d0e',
                  color: '#fff',
                  border: '1px solid #3a3a3c',
                  borderRadius: '4px',
                  padding: '8px 12px',
                  fontSize: '13px',
                  outline: 'none'
                }}
              />
              <button
                onClick={handleSfxSearch}
                disabled={isSfxLoading}
                style={{
                  background: '#e040fb',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '8px 18px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 'bold',
                  opacity: isSfxLoading ? 0.6 : 1
                }}
              >
                {isSfxLoading && !previewSfxId ? 'Searching...' : 'Search'}
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px', backgroundColor: '#131314' }}>
              {isSfxLoading && !previewSfxId && (
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'center', alignItems: 'center', gap: '15px', color: '#aaa' }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    border: '3px solid #333',
                    borderTop: '3px solid #e040fb',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }} />
                  <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
                  <span>Loading data from Freesound...</span>
                </div>
              )}

              {sfxError && !isSfxLoading && (
                <div style={{ padding: '15px', background: '#3c1c1c', border: '1px solid #ff4444', borderRadius: '6px', color: '#ff8888', fontSize: '13px', lineHeight: '1.5' }}>
                  <strong>Error:</strong> {sfxError}
                </div>
              )}

              {/* Search Results list with Inline Preview Player */}
              {!isSfxLoading && !sfxError && sfxSearchResults.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {sfxSearchResults.map((result) => {
                    const isPreviewing = previewSfxId === result.id;
                    return (
                      <div
                        key={result.id}
                        style={{
                          background: '#1d1d1f',
                          border: '1px solid #333',
                          borderRadius: '6px',
                          padding: '16px 20px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '12px',
                          transition: 'all 0.2s',
                          borderColor: isPreviewing ? '#e040fb' : '#333',
                          backgroundColor: isPreviewing ? '#282028' : '#1d1d1f'
                        }}
                        onMouseEnter={(e) => {
                          if (!isPreviewing) {
                            e.currentTarget.style.borderColor = '#e040fb';
                            e.currentTarget.style.background = '#252528';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isPreviewing) {
                            e.currentTarget.style.borderColor = '#333';
                            e.currentTarget.style.background = '#1d1d1f';
                          }
                        }}
                      >
                        {/* Top Row: Track info and actions */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                            <div style={{
                              background: '#e040fb',
                              color: '#fff',
                              padding: '4px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 'bold',
                              minWidth: '36px',
                              textAlign: 'center'
                            }}>
                              WAV
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                              <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#fff' }}>{result.title}</span>
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <span style={{ fontSize: '11px', color: '#888' }}>Duration: {result.duration.toFixed(2)}s</span>
                                {result.artist && result.artist !== 'Unknown' && (
                                  <span style={{ fontSize: '10px', color: '#e040fb', backgroundColor: 'rgba(224,64,251,0.1)', padding: '1px 6px', borderRadius: '3px', border: '1px solid rgba(224,64,251,0.2)' }}>
                                    By: {result.artist}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              onClick={() => handlePlaySfxPreview(result)}
                              style={{
                                background: isPreviewing ? '#ff4444' : '#333',
                                border: isPreviewing ? '1px solid #ff4444' : '1px solid #555',
                                color: '#fff',
                                borderRadius: '4px',
                                padding: '6px 12px',
                                cursor: 'pointer',
                                fontSize: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontWeight: 'bold'
                              }}
                            >
                              {isPreviewing ? <BsX size={14} /> : <BsPlayFill />}
                              {isPreviewing ? 'Stop' : 'Preview'}
                            </button>
                            <button
                              onClick={() => { handleStopSfxPreview(); handleSelectSfx(result); }}
                              disabled={isSfxLoading}
                              style={{
                                background: '#e040fb',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '4px',
                                padding: '6px 16px',
                                cursor: 'pointer',
                                fontSize: '12px',
                                fontWeight: 'bold',
                                boxShadow: '0 2px 6px rgba(224,64,251,0.3)',
                                opacity: isSfxLoading ? 0.6 : 1
                              }}
                            >
                              Select
                            </button>
                          </div>
                        </div>

                        {/* Bottom Row: Custom native player shown inline under selected sound */}
                        {isPreviewing && (
                          <div style={{
                            border: '1px solid #e040fb',
                            borderRadius: '6px',
                            padding: '12px 16px',
                            marginTop: '4px',
                            background: '#111',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '10px',
                            boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.6)'
                          }}>
                            {/* Player Header / Metadata */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '11px', color: '#aaa', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '75%' }}>
                                Title: <span style={{ color: '#fff' }}>{result.title || 'Loading...'}</span>
                              </span>
                              <span style={{ fontSize: '11px', color: '#aaa', fontFamily: 'monospace' }}>
                                {Math.floor(sfxPlayPosition / 60)}:{(Math.floor(sfxPlayPosition % 60) < 10 ? '0' : '') + Math.floor(sfxPlayPosition % 60)} / {Math.floor(sfxTrackDuration / 60)}:{(Math.floor(sfxTrackDuration % 60) < 10 ? '0' : '') + Math.floor(sfxTrackDuration % 60)}
                              </span>
                            </div>

                            {/* Seekbar and controls */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%' }}>
                              <button
                                onClick={handleToggleSfxPause}
                                style={{
                                  background: '#e040fb',
                                  border: 'none',
                                  color: '#fff',
                                  width: '28px',
                                  height: '28px',
                                  borderRadius: '50%',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0
                                }}
                                title={isSfxPaused ? "Play" : "Pause"}
                              >
                                {isSfxPaused ? <BsPlayFill size={14} style={{ marginLeft: '1px' }} /> : <BsPauseFill size={14} />}
                              </button>
                              
                              <input
                                type="range"
                                min="0"
                                max={sfxTrackDuration || 100}
                                step="0.01"
                                value={sfxPlayPosition}
                                onChange={e => handleSfxSeek(Number(e.target.value))}
                                style={{
                                  flex: 1,
                                  height: '4px',
                                  cursor: 'pointer',
                                  accentColor: '#e040fb',
                                  background: '#333',
                                  borderRadius: '2px',
                                  outline: 'none'
                                }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default SfxPanel;
