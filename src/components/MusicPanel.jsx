import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { usePxShop } from '../context/PxShopContext';
import { BsMusicNoteBeamed, BsUpload, BsTrash, BsChevronDown, BsChevronRight, BsPlayFill, BsPauseFill, BsDownload, BsSoundwave, BsSearch, BsPencil, BsCheck, BsX, BsPlus, BsFolder2Open, BsFiles } from 'react-icons/bs';
import toast from 'react-hot-toast';
import { API_BASE_URL } from '../config';

const MusicPanel = ({ isCollapsed, onToggle, dragProps }) => {
  const { musicTracks, setMusicTracks, saveHistory, layers, dimensions, setIsMusicEditorOpen, setEditingMusicTrackId, addModArchiveArtist } = usePxShop();
  const fileInputRef = useRef(null);

  // ModArchive Search States
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [previewModuleId, setPreviewModuleId] = useState(null);
  const previewModuleIdRef = useRef(null);
  const playerRef = useRef(null);
  const progressIntervalRef = useRef(null);
  const [playPosition, setPlayPosition] = useState(0);
  const [trackDuration, setTrackDuration] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [trackTitle, setTrackTitle] = useState('');

  // Renaming states
  const [renamingTrackId, setRenamingTrackId] = useState(null);
  const [renamingName, setRenamingName] = useState('');

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearchModalOpen(true);
    setIsLoading(true);
    setError(null);
    setSearchResults([]);
    setPreviewModuleId(null);

    const query = encodeURIComponent(searchQuery.trim());
    const searchUrl = `https://modarchive.org/index.php?request=search&query=${query}&submit=Find&search_type=filename_or_songtitle`;
    const proxyUrl = `https://lpbackend.liftedpixel.ca/proxy-oga?url=${encodeURIComponent(searchUrl)}`;

    try {
      const response = await fetch(proxyUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.statusText}`);
      }
      const html = await response.text();
      
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      const rows = doc.querySelectorAll('table tr');
      const results = [];
      
      rows.forEach(row => {
        const formatEl = row.querySelector('.format-icon');
        if (!formatEl) return;
        
        const format = formatEl.textContent.trim().toUpperCase();
        // Filter for only MOD and S3M formats
        if (format !== 'MOD' && format !== 'S3M') return;
        
        const filenameEl = row.querySelector('.standard-link');
        if (!filenameEl) return;
        const filename = filenameEl.textContent.trim();
        
        // Extract module ID from the link href (e.g. index.php?request=view_by_moduleid&query=92118)
        const href = filenameEl.getAttribute('href') || '';
        const match = href.match(/query=(\d+)/);
        if (!match) return;
        const id = match[1];
        
        // Extract song title from the third cell or title attribute
        const titleEl = row.querySelector('.module-listing');
        const title = titleEl ? titleEl.textContent.trim() : filename;
        
        // Extract artist name from member link
        let artist = 'Unknown';
        const memberLink = row.querySelector('a[href*="member.php"], a[href*="member/"], a[href*="/member"], a[href*="?member"]');
        if (memberLink) {
          artist = memberLink.textContent.trim();
        } else {
          // Try to find artist in table cells
          const cells = row.querySelectorAll('td');
          for (const cell of cells) {
            const text = cell.textContent.trim();
            if (text && text !== filename && text !== title && text !== format && !cell.querySelector('a')) {
              const link = cell.querySelector('a[href]');
              if (!link && text.length < 40) {
                artist = text;
                break;
              }
            }
          }
        }

        results.push({
          id,
          filename,
          title,
          format,
          artist
        });
      });
      
      setSearchResults(results);
      if (results.length === 0) {
        setError("No .mod or .s3m files found. Try a different query (e.g. 'overworld' or 'castle').");
      }
    } catch (err) {
      console.error(err);
      setError(`Search failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectTrack = async (trackInfo) => {
    setIsLoading(true);
    const loadingToastId = toast.loading(`Downloading ${trackInfo.filename}...`);

    // Try to extract artist from module detail page if not found in search results
    let resolvedArtist = trackInfo.artist;
    if (!resolvedArtist || resolvedArtist === 'Unknown') {
      try {
        const detailUrl = `https://modarchive.org/index.php?request=view_by_moduleid&query=${trackInfo.id}`;
        const detailProxyUrl = `https://lpbackend.liftedpixel.ca/proxy-oga?url=${encodeURIComponent(detailUrl)}`;
        const detailRes = await fetch(detailProxyUrl);
        if (detailRes.ok) {
          const detailHtml = await detailRes.text();
          const detailDoc = new DOMParser().parseFromString(detailHtml, 'text/html');
          const detailMemberLink = detailDoc.querySelector('a[href*="member.php"], a[href*="member/"], a[href*="/member"], a[href*="?member"]');
          if (detailMemberLink) {
            resolvedArtist = detailMemberLink.textContent.trim();
          } else {
            const uploadInfo = detailDoc.querySelector('.module-info, .module-details, .details');
            if (uploadInfo) {
              const match = uploadInfo.textContent.match(/by\s+(.+?)(?:\s|$)/i);
              if (match) resolvedArtist = match[1].trim();
            }
          }
        }
      } catch {
        // Silently fall back to 'Unknown'
      }
    }
    
    const downloadUrl = `https://api.modarchive.org/downloads.php?moduleid=${trackInfo.id}#${trackInfo.filename}`;
    const proxyUrl = `https://lpbackend.liftedpixel.ca/proxy-oga?url=${encodeURIComponent(downloadUrl)}`;
    
    try {
      const response = await fetch(proxyUrl);
      if (!response.ok) {
        throw new Error(`Failed to download tracker file: ${response.statusText}`);
      }
      
      const blob = await response.blob();
      const reader = new FileReader();
      
      reader.onload = (event) => {
        // Track artist for credits
        if (resolvedArtist && resolvedArtist !== 'Unknown') {
          addModArchiveArtist(resolvedArtist);
        }

        // Prepend cleaned artist name to the filename if available
        const cleanArtist = resolvedArtist && resolvedArtist !== 'Unknown'
          ? resolvedArtist.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '')
          : '';
        
        let targetFilename = trackInfo.filename;
        if (cleanArtist) {
          const lowerFilename = trackInfo.filename.toLowerCase();
          if (!lowerFilename.startsWith(cleanArtist)) {
            targetFilename = `${cleanArtist}_${trackInfo.filename}`;
          }
        }

        const newMusic = {
          id: Date.now().toString(),
          name: targetFilename,
          data: event.target.result, // base64 Data URL
          isComposed: false
        };
        const nextTracks = [...musicTracks, newMusic];
        setMusicTracks(nextTracks);
        saveHistory("Import ModArchive Music", layers, dimensions, { musicTracks: nextTracks });
        toast.success(`Imported ${targetFilename} successfully!`, { id: loadingToastId });
        setIsSearchModalOpen(false);
        setPreviewModuleId(null);
      };
      
      reader.readAsDataURL(blob);
    } catch (err) {
      console.error(err);
      toast.error(`Download failed: ${err.message}`, { id: loadingToastId });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlayPreview = async (result) => {
    // 1. If we are clicking on the already previewing track, stop it
    if (previewModuleId === result.id) {
      handleStopPreview();
      return;
    }

    // 2. Stop any existing playback and clear interval
    if (playerRef.current) {
      playerRef.current.stop();
    }
    clearInterval(progressIntervalRef.current);
    
    setPreviewModuleId(result.id);
    setPlayPosition(0);
    setTrackDuration(0);
    setTrackTitle(result.filename);
    setIsPaused(false);

    // 3. Initialize player
    if (typeof window === 'undefined' || !window.ChiptuneJsPlayer) {
      toast.error("Audio player library not loaded yet. Please wait a moment.");
      setPreviewModuleId(null);
      return;
    }

    let player = playerRef.current;
    if (!player) {
      const config = new window.ChiptuneJsConfig(-1);
      player = new window.ChiptuneJsPlayer(config);
      playerRef.current = player;
      
      // Handle end of song
      player.onEnded(() => {
        setPreviewModuleId(null);
        clearInterval(progressIntervalRef.current);
      });
      
      player.onError((err) => {
        console.error("Player error:", err);
        toast.error("Error playing music track.");
        setPreviewModuleId(null);
        clearInterval(progressIntervalRef.current);
      });
    }

    try {
      const downloadUrl = `https://api.modarchive.org/downloads.php?moduleid=${result.id}#${result.filename}`;
      const proxyUrl = `https://lpbackend.liftedpixel.ca/proxy-oga?url=${encodeURIComponent(downloadUrl)}`;
      
      const response = await fetch(proxyUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const arrayBuffer = await response.arrayBuffer();

      // Check if user changed track or stopped while downloading
      if (previewModuleIdRef.current !== result.id) {
        return;
      }

      player.play(arrayBuffer);

      // Extract metadata
      setTimeout(() => {
        if (previewModuleIdRef.current === result.id) {
          const duration = player.duration() || 0;
          setTrackDuration(duration);
          
          try {
            const meta = player.metadata();
            setTrackTitle(meta.title || result.filename);
          } catch (e) {
            setTrackTitle(result.filename);
          }

          // Start position tracker interval
          clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = setInterval(() => {
            if (playerRef.current && !playerRef.current.touchLocked) {
              setPlayPosition(playerRef.current.getPosition() || 0);
            }
          }, 333);
        }
      }, 200);

    } catch (err) {
      console.error(err);
      toast.error("Failed to load music preview: " + err.message);
      setPreviewModuleId(null);
    }
  };

  const handleStopPreview = () => {
    setPreviewModuleId(null);
    clearInterval(progressIntervalRef.current);
    if (playerRef.current) {
      playerRef.current.stop();
    }
  };

  const handleTogglePause = () => {
    if (playerRef.current) {
      const isPlaying = playerRef.current.togglePause();
      setIsPaused(!isPlaying);
    }
  };

  const handleSeek = (val) => {
    if (playerRef.current) {
      playerRef.current.seek(val);
      setPlayPosition(val);
    }
  };

  // Sync ref
  useEffect(() => {
    previewModuleIdRef.current = previewModuleId;
  }, [previewModuleId]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      clearInterval(progressIntervalRef.current);
      if (playerRef.current) {
        playerRef.current.stop();
      }
    };
  }, []);

  const handleCloseModal = () => {
    setIsSearchModalOpen(false);
    setSearchResults([]);
    handleStopPreview();
    setError(null);
  };



  const handleMusicUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.name.toLowerCase().endsWith('.wav') && file.size > 5 * 1024 * 1024) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      if (!window.confirm(`This WAV file is ${sizeMB}MB. Large WAV files can significantly increase GBA ROM size. Continue?`)) {
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const newMusic = {
        id: Date.now().toString(),
        name: file.name,
        data: event.target.result,
        isComposed: false
      };
      const nextTracks = [...musicTracks, newMusic];
      setMusicTracks(nextTracks);
      saveHistory("Upload Music", layers, dimensions, { musicTracks: nextTracks });
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRenameTrack = (trackId, newName) => {
    if (!newName.trim()) return;
    const track = musicTracks.find(t => String(t.id) === String(trackId));
    let finalName = newName.trim();
    if (track && track.type !== 'group') {
      const originalExt = track.name.includes('.') ? '.' + track.name.split('.').pop() : '.mod';
      if (!finalName.toLowerCase().endsWith(originalExt.toLowerCase())) {
        finalName = `${finalName}${originalExt}`;
      }
    }
    const nextTracks = musicTracks.map(t => String(t.id) === String(trackId) ? { ...t, name: finalName } : t);
    setMusicTracks(nextTracks);
    saveHistory("Rename Music Track", layers, dimensions, { musicTracks: nextTracks });
    setRenamingTrackId(null);
  };

  const addMusicGroup = (e) => {
    e.stopPropagation();
    const newGroup = {
      id: (Date.now() + Math.random()).toString(),
      type: 'group',
      isGroup: true,
      name: `Group ${musicTracks.filter(t => t.type === 'group' && !t.isSfx).length + 1}`,
      isOpen: false
    };
    const nextTracks = [...musicTracks, newGroup];
    setMusicTracks(nextTracks);
    saveHistory("Add Music Group", layers, dimensions, { musicTracks: nextTracks });
  };

  const toggleGroup = (groupId) => {
    const nextTracks = musicTracks.map(t => t.id === groupId ? { ...t, isOpen: !t.isOpen } : t);
    setMusicTracks(nextTracks);
    saveHistory("Toggle Music Group", layers, dimensions, { musicTracks: nextTracks });
  };

  const deleteMusicGroup = (e, id) => {
    e.stopPropagation();
    const nextTracks = musicTracks.filter(t => t.id !== id && String(t.groupId) !== String(id));
    setMusicTracks(nextTracks);
    saveHistory("Delete Music Group", layers, dimensions, { musicTracks: nextTracks });
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
    saveHistory("Move Music Track Up", layers, dimensions, { musicTracks: nextTracks });
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
    saveHistory("Move Music Track Down", layers, dimensions, { musicTracks: nextTracks });
  };

  const createNewComposed = () => {
     const newMusic = {
        id: Date.now().toString(),
        name: `composed_track_${Date.now().toString().slice(-4)}.mod`,
        data: "",
        isComposed: true,
        composerData: {
          notes: [],
          bpm: 125,
          songLength: 64,
          channelWaveforms: ['square', 'pulse25', 'triangle', 'noise'],
          channelVolumes: [64, 64, 64, 64]
        }
      };
      const nextTracks = [...musicTracks, newMusic];
      setMusicTracks(nextTracks);
      setEditingMusicTrackId(newMusic.id);
      setIsMusicEditorOpen(true);
      saveHistory("Create Music", layers, dimensions, { musicTracks: nextTracks });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: isCollapsed ? 'none' : 1, borderBottom: '2px solid #222', minHeight: 0, background: isCollapsed ? 'transparent' : '#383238' }}>
      <div
        onClick={onToggle}
        style={{ padding: '15px', borderBottom: isCollapsed ? 'none' : '1px solid #3c3c3c', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'grab', userSelect: 'none', background: '#270d27' }}
        {...dragProps}
      >
        <span style={{ fontWeight: 'bold', fontSize: '11px', textTransform: 'uppercase', color: isCollapsed ? '#aaa' : '#e040fb', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BsMusicNoteBeamed /> Music
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={e => { if (isCollapsed) { onToggle(); } e.stopPropagation(); }}>
          {!isCollapsed && (
            <button onClick={addMusicGroup} title="Add Group" style={{ backgroundColor: 'transparent', border: '1px solid #555', color: '#888', padding: '3px 7px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'all 0.2s' }} onMouseEnter={e => { e.currentTarget.style.borderColor = '#ff9800'; e.currentTarget.style.color = '#ff9800'; }} onMouseLeave={e => { e.currentTarget.style.borderColor = '#555'; e.currentTarget.style.color = '#888'; }}>
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
          <input type="file" ref={fileInputRef} onChange={handleMusicUpload} style={{ display: 'none' }} accept=".mod,.s3m,.xm,.it,.wav" />

          {/* Search ModArchive bar */}
          <div style={{ display: 'flex', gap: '6px', borderBottom: '1px solid #3c3c3c', backgroundColor: '#202022', padding: '10px', margin: '-10px -10px 10px -10px' }}>
            <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
              <BsSearch style={{ position: 'absolute', left: '10px', color: '#888', pointerEvents: 'none' }} size={12} />
              <input
                type="text"
                placeholder="Search ModArchive (.mod/.s3m)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
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
              onClick={handleSearch}
              style={{
                background: 'transparent',
                color: '#0078d4',
                border: '1px solid #0078d4',
                borderRadius: '4px',
                padding: '6px 12px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#0078d4'; e.currentTarget.style.color = '#fff'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#0078d4'; }}
            >
              Search
            </button>
          </div>
          {musicTracks && musicTracks.filter(t => !t.isSfx).length > 0 ? (
            musicTracks.filter(t => !t.isSfx).map((track, index) => {
              if (track.type === 'group') {
                return (
                  <div key={track.id} 
                    style={{ 
                      display: 'flex', flexDirection: 'column', padding: '8px 10px', 
                      backgroundColor: '#2a2a2a', 
                      borderRadius: '6px',
                      border: '1px solid #555',
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
                          style={{ fontSize: '12px', fontWeight: 'bold', color: track.isOpen ? '#ff9800' : '#fff', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'pointer', textAlign: 'left' }}
                        >
                          📁 {track.name}
                        </span>
                      )}
                      <button title="Move Up" onClick={(e) => moveTrackUp(e, track.id)} disabled={index === 0} style={{ background: 'none', border: 'none', color: index === 0 ? '#555' : '#fff', cursor: index === 0 ? 'default' : 'pointer', padding: 0 }}>▲</button>
                      <button title="Move Down" onClick={(e) => moveTrackDown(e, track.id)} disabled={index === musicTracks.length - 1} style={{ background: 'none', border: 'none', color: index === musicTracks.length - 1 ? '#555' : '#fff', cursor: index === musicTracks.length - 1 ? 'default' : 'pointer', padding: 0 }}>▼</button>
                      <button onClick={(e) => deleteMusicGroup(e, track.id)} style={{ background: 'none', border: 'none', color: '#ff4444', cursor: 'pointer', padding: 0, marginLeft: '5px', display: 'flex', alignItems: 'center' }}>
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
                        <button onClick={() => handleRenameTrack(track.id, renamingName)} style={{ background: 'transparent', border: '1px solid #e040fb', color: '#e040fb', borderRadius: '3px', padding: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center' }} onMouseEnter={e => { e.currentTarget.style.background = '#e040fb'; e.currentTarget.style.color = '#fff'; }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#e040fb'; }}>
                          <BsCheck size={14} />
                        </button>
                        <button onClick={() => setRenamingTrackId(null)} style={{ background: '#333', border: '1px solid #555', color: '#ff4444', borderRadius: '3px', padding: '3px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                          <BsX size={14} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', flex: 1 }}>
                          <span style={{ fontSize: '12px', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={track.name}>{track.name}</span>
                          <button onClick={() => { setRenamingTrackId(track.id); setRenamingName(track.name.replace(/\.wav$/i, '').replace(/\.mod$/i, '')); }} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }} title="Rename Track">
                            <BsPencil size={11} />
                          </button>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <button title="Move Up" onClick={(e) => moveTrackUp(e, track.id)} disabled={index === 0} style={{ background: 'none', border: 'none', color: index === 0 ? '#555' : '#fff', cursor: index === 0 ? 'default' : 'pointer', padding: 0 }}>▲</button>
                          <button title="Move Down" onClick={(e) => moveTrackDown(e, track.id)} disabled={index === musicTracks.length - 1} style={{ background: 'none', border: 'none', color: index === musicTracks.length - 1 ? '#555' : '#fff', cursor: index === musicTracks.length - 1 ? 'default' : 'pointer', padding: 0 }}>▼</button>
                          <button onClick={() => { 
                            const nextTracks = musicTracks.filter(t => t.id !== track.id);
                            setMusicTracks(nextTracks); 
                            saveHistory("Remove Music", layers, dimensions, { musicTracks: nextTracks }); 
                          }} style={{ background: 'none', border: 'none', color: '#ff4444', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}>
                             <BsTrash />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                  {track.isComposed && (
                    <button onClick={() => { setEditingMusicTrackId(track.id); setIsMusicEditorOpen(true); }} style={{ background: 'transparent', color: '#e040fb', border: '1px solid #e040fb', padding: '6px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 'bold', marginBottom: '4px' }} onMouseEnter={e => { e.currentTarget.style.background = '#e040fb'; e.currentTarget.style.color = '#fff'; }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#e040fb'; }}>
                      <BsMusicNoteBeamed /> Edit Composed Music
                    </button>
                  )}
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
                        saveHistory("Change Music Track Group", layers, dimensions, { musicTracks: nextTracks });
                      }}
                      onClick={(e) => e.stopPropagation()}
                      style={{ background: 'transparent', color: '#aaa', border: '1px solid #444', borderRadius: '3px', maxWidth: '120px', fontSize: '10px', outline: 'none' }}
                    >
                      <option value="">No Group</option>
                      {musicTracks.filter(item => item.type === 'group' && !item.isSfx).map(g => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              );
            })
          ) : <div style={{ fontSize: '11px', color: '#666', textAlign: 'center', padding: '10px 0' }}>No music tracks added</div>}
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px', borderTop: '1px solid #333', paddingTop: '10px' }}>
            <button onClick={createNewComposed} style={{ background: 'transparent', color: '#e040fb', border: '1px solid #e040fb', padding: '10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 'bold' }} onMouseEnter={e => { e.currentTarget.style.background = '#e040fb'; e.currentTarget.style.color = '#fff'; }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#e040fb'; }}>
              <BsMusicNoteBeamed /> Compose Music (Piano Roll)
            </button>
            <button onClick={() => fileInputRef.current?.click()} style={{ background: '#333', color: '#fff', border: '1px solid #555', padding: '10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <BsUpload /> Add Track (.mod, .s3m, .wav)
            </button>
          </div>
        </div>
      )}

      {/* MODARCHIVE SEARCH MODAL */}
      {isSearchModalOpen && createPortal(
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
                <BsMusicNoteBeamed /> ModArchive Tracker Music Search
              </span>
              <button
                onClick={handleCloseModal}
                style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', fontSize: '18px', padding: '4px' }}
              >
                ✕
              </button>
            </div>

            {/* Modal Search Bar */}
            <div style={{ padding: '15px 20px', borderBottom: '1px solid #2d2d2f', display: 'flex', gap: '8px', backgroundColor: '#18181a' }}>
              <input
                type="text"
                placeholder="Search queries (e.g. overworld, dungeon, castle)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
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
                onClick={handleSearch}
                disabled={isLoading}
                style={{
                  background: 'transparent',
                  color: '#0078d4',
                  border: '1px solid #0078d4',
                  borderRadius: '4px',
                  padding: '8px 18px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 'bold',
                  opacity: isLoading ? 0.6 : 1
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#0078d4'; e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#0078d4'; }}
              >
                {isLoading && !previewModuleId ? 'Searching...' : 'Search'}
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px', backgroundColor: '#131314' }}>
              {isLoading && !previewModuleId && (
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'center', alignItems: 'center', gap: '15px', color: '#aaa' }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    border: '3px solid #333',
                    borderTop: '3px solid #0078d4',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }} />
                  <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
                  <span>Loading data from ModArchive...</span>
                </div>
              )}

              {error && !isLoading && (
                <div style={{ padding: '15px', background: '#3c1c1c', border: '1px solid #ff4444', borderRadius: '6px', color: '#ff8888', fontSize: '13px', lineHeight: '1.5' }}>
                  <strong>Error:</strong> {error}
                </div>
              )}

              {/* Search Results list with Inline Preview Player */}
              {!isLoading && !error && searchResults.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {searchResults.map((result) => {
                    const isPreviewing = previewModuleId === result.id;
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
                          backgroundColor: isPreviewing ? '#202820' : '#1d1d1f'
                        }}
                        onMouseEnter={(e) => {
                          if (!isPreviewing) {
                            e.currentTarget.style.borderColor = '#0078d4';
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
                              background: result.format === 'MOD' ? '#0078d4' : '#e000ff',
                              color: '#fff',
                              padding: '4px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 'bold',
                              minWidth: '36px',
                              textAlign: 'center'
                            }}>
                              {result.format}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                              <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#fff' }}>{result.filename}</span>
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <span style={{ fontSize: '11px', color: '#888' }}>Title: {result.title}</span>
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
                              onClick={() => handlePlayPreview(result)}
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
                              onClick={() => { handleStopPreview(); handleSelectTrack(result); }}
                              style={{
                                background: 'transparent',
                                color: '#e040fb',
                                border: '1px solid #e040fb',
                                borderRadius: '4px',
                                padding: '6px 16px',
                                cursor: 'pointer',
                                fontSize: '12px',
                                fontWeight: 'bold'
                              }}
                              onMouseEnter={e => { e.currentTarget.style.background = '#e040fb'; e.currentTarget.style.color = '#fff'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#e040fb'; }}
                            >
                              Select
                            </button>
                          </div>
                        </div>

                        {/* Bottom Row: Custom native player shown inline under selected song */}
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
                                Title: <span style={{ color: '#fff' }}>{trackTitle || 'Loading...'}</span>
                              </span>
                              <span style={{ fontSize: '11px', color: '#aaa', fontFamily: 'monospace' }}>
                                {Math.floor(playPosition / 60)}:{(Math.floor(playPosition % 60) < 10 ? '0' : '') + Math.floor(playPosition % 60)} / {Math.floor(trackDuration / 60)}:{(Math.floor(trackDuration % 60) < 10 ? '0' : '') + Math.floor(trackDuration % 60)}
                              </span>
                            </div>

                            {/* Seekbar and controls */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%' }}>
                              <button
                                onClick={handleTogglePause}
                                style={{
                                  background: 'transparent',
                                  border: '1px solid #e040fb',
                                  color: '#e040fb',
                                  width: '28px',
                                  height: '28px',
                                  borderRadius: '50%',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = '#e040fb'; e.currentTarget.style.color = '#fff'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#e040fb'; }}
                                title={isPaused ? "Play" : "Pause"}
                              >
                                {isPaused ? <BsPlayFill size={14} style={{ marginLeft: '1px' }} /> : <BsPauseFill size={14} />}
                              </button>
                              
                              <input
                                type="range"
                                min="0"
                                max={trackDuration || 100}
                                value={playPosition}
                                onChange={e => handleSeek(Number(e.target.value))}
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

export default MusicPanel;