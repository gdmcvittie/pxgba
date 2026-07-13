import { useState, useEffect, useRef } from 'react';
import { usePxShop } from '../context/PxShopContext';
import { 
  BsPlayFill, BsPauseFill, BsStopFill, BsArrowClockwise, 
  BsTrash, BsXCircle, BsCheckCircle 
} from 'react-icons/bs';
import toast from 'react-hot-toast';
import { serializeToMod, NOTE_NAMES } from '../utils/modSerializer';

// Helper to create NES/GBA style pulse waves in Web Audio
function createPulseWave(audioCtx, duty) {
  const real = new Float32Array(64);
  const imag = new Float32Array(64);
  for (let n = 1; n < 64; n++) {
    imag[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * duty);
  }
  return audioCtx.createPeriodicWave(real, imag);
}

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

// Pre-generate random noise data outside the component to satisfy ESLint purity rules
const NOISE_RANDOM_DATA = new Float32Array(44100 * 2);
for (let i = 0; i < NOISE_RANDOM_DATA.length; i++) {
  NOISE_RANDOM_DATA[i] = Math.random() * 2 - 1;
}

// Generate unique ID outside the component to satisfy ESLint purity rules
function generateUniqueId() {
  return Date.now().toString() + Math.random().toString(36).substr(2, 5);
}

const MusicEditor = () => {
  const { 
    isMusicEditorOpen, setIsMusicEditorOpen, 
    musicTracks, setMusicTracks, editingMusicTrackId,
    saveHistory, layers, dimensions 
  } = usePxShop();

  const [notes, setNotes] = useState([]);
  const [bpm, setBpm] = useState(125);
  const [songLength, setSongLength] = useState(64);
  const [activeChannel, setActiveChannel] = useState(0);
  const [channelWaveforms, setChannelWaveforms] = useState(['square', 'pulse25', 'triangle', 'noise']);
  const [channelVolumes, setChannelVolumes] = useState([64, 64, 64, 64]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLooping, setIsLooping] = useState(true);
  const [currentPlayingStep, setCurrentPlayingStep] = useState(-1);
  const [draggedNoteId, setDraggedNoteId] = useState(null);
  const [resizedNoteId, setResizedNoteId] = useState(null);

  // Audio Context & Scheduling Refs
  const audioContextRef = useRef(null);
  const schedulerTimerRef = useRef(null);
  const nextNoteTimeRef = useRef(0);
  const currentStepRef = useRef(0);
  const isPlayingRef = useRef(false);
  const activeNodesRef = useRef([]);
  const pulse25WaveRef = useRef(null);
  const pulse125WaveRef = useRef(null);
  const [noiseBuffer, setNoiseBuffer] = useState(null);

  // Refs to sync state with the audio scheduler loop to avoid stale closures
  const notesRef = useRef(notes);
  const bpmRef = useRef(bpm);
  const songLengthRef = useRef(songLength);
  const isLoopingRef = useRef(isLooping);
  const channelWaveformsRef = useRef(channelWaveforms);
  const channelVolumesRef = useRef(channelVolumes);
  const noiseBufferRef = useRef(null);

  // Stop playback function defined early to avoid access-before-declaration warnings
  const stopPlayback = () => {
    setIsPlaying(false);
    isPlayingRef.current = false;
    clearTimeout(schedulerTimerRef.current);
    setCurrentPlayingStep(-1);
    currentStepRef.current = 0;
    
    // Stop all active sound nodes
    activeNodesRef.current.forEach(node => {
      try { node.stop(); } catch { /* ignore */ }
    });
    activeNodesRef.current = [];
  };

  // Clean up Audio on unmount
  useEffect(() => {
    return () => {
      stopPlayback();
    };
  }, []);

  // Sync state variables with refs
  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  useEffect(() => {
    bpmRef.current = bpm;
  }, [bpm]);

  useEffect(() => {
    songLengthRef.current = songLength;
  }, [songLength]);

  useEffect(() => {
    isLoopingRef.current = isLooping;
  }, [isLooping]);

  useEffect(() => {
    channelWaveformsRef.current = channelWaveforms;
  }, [channelWaveforms]);

  useEffect(() => {
    channelVolumesRef.current = channelVolumes;
  }, [channelVolumes]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // Layout & Drag Scroll Refs
  const gridContainerRef = useRef(null);

  // Load existing composer data if editing
  useEffect(() => {
    const track = musicTracks.find(t => String(t.id) === String(editingMusicTrackId));
    if (isMusicEditorOpen && track && track.isComposed && track.composerData) {
      const data = track.composerData;
      setNotes(data.notes || []);
      setBpm(data.bpm || 125);
      setSongLength(data.songLength || 64);
      setChannelWaveforms(data.channelWaveforms || ['square', 'pulse25', 'triangle', 'noise']);
      setChannelVolumes(data.channelVolumes || [64, 64, 64, 64]);
    } else if (isMusicEditorOpen) {
      // Reset to defaults for a new composition
      setNotes([]);
      setBpm(125);
      setSongLength(64);
      setChannelWaveforms(['square', 'pulse25', 'triangle', 'noise']);
      setChannelVolumes([64, 64, 64, 64]);
    }
  }, [isMusicEditorOpen, musicTracks, editingMusicTrackId]);

  if (!isMusicEditorOpen) return null;

  // Initialize Web Audio Context
  const initAudio = () => {
    if (audioContextRef.current) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const audioCtx = new AudioContextClass();
    audioContextRef.current = audioCtx;

    // Pre-generate noise buffer for chiptune percussion
    const bufferSize = audioCtx.sampleRate * 2;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = NOISE_RANDOM_DATA[i % NOISE_RANDOM_DATA.length];
    }
    noiseBufferRef.current = buffer;
    setNoiseBuffer(buffer);

    // Fourier synthesized custom GBA/NES waveforms
    pulse25WaveRef.current = createPulseWave(audioCtx, 0.25);
    pulse125WaveRef.current = createPulseWave(audioCtx, 0.125);
  };

  const triggerSynthNode = (channel, pitch, waveform, volume, durationSec, time) => {
    if (!audioContextRef.current) return;
    const audioCtx = audioContextRef.current;
    const midi = 48 + pitch; // C3 is midi 48
    const freq = 440 * Math.pow(2, (midi - 69) / 12);

    const gainNode = audioCtx.createGain();
    gainNode.connect(audioCtx.destination);

    // Apply chiptune ADSR envelope (avoid clicks)
    const maxGain = (volume / 64) * 0.15; // Scaled to prevent clipping
    gainNode.gain.setValueAtTime(0, time);
    gainNode.gain.linearRampToValueAtTime(maxGain, time + 0.005);
    gainNode.gain.setValueAtTime(maxGain, time + durationSec - 0.015);
    gainNode.gain.linearRampToValueAtTime(0, time + durationSec);

    let sourceNode;

    if (waveform === 'noise') {
      const buffer = noiseBufferRef.current || noiseBuffer;
      if (!buffer) return;
      sourceNode = audioCtx.createBufferSource();
      sourceNode.buffer = buffer;

      // Bandpass envelope sweeps to make noise sound like hi-hats/snares
      const filter = audioCtx.createBiquadFilter();
      filter.type = 'bandpass';
      
      const startFreq = pitch > 18 ? 9000 : 2500;
      const endFreq = pitch > 18 ? 3000 : 300;
      
      filter.frequency.setValueAtTime(startFreq, time);
      filter.frequency.exponentialRampToValueAtTime(endFreq, time + durationSec);

      sourceNode.connect(filter);
      filter.connect(gainNode);
      sourceNode.start(time);
      sourceNode.stop(time + durationSec);
    } else {
      sourceNode = audioCtx.createOscillator();
      if (waveform === 'square') {
        sourceNode.type = 'square';
      } else if (waveform === 'pulse25') {
        const wave = pulse25WaveRef.current || createPulseWave(audioCtx, 0.25);
        sourceNode.setPeriodicWave(wave);
      } else if (waveform === 'pulse125') {
        const wave = pulse125WaveRef.current || createPulseWave(audioCtx, 0.125);
        sourceNode.setPeriodicWave(wave);
      } else if (waveform === 'triangle') {
        sourceNode.type = 'triangle';
      } else if (waveform === 'sawtooth') {
        sourceNode.type = 'sawtooth';
      } else if (waveform === 'sine') {
        sourceNode.type = 'sine';
      }

      sourceNode.frequency.setValueAtTime(freq, time);
      sourceNode.connect(gainNode);
      sourceNode.start(time);
      sourceNode.stop(time + durationSec);
    }

    activeNodesRef.current.push(sourceNode);
    
    // Cleanup reference after note ends
    sourceNode.onended = () => {
      activeNodesRef.current = activeNodesRef.current.filter(n => n !== sourceNode);
    };
  };

  const playPreview = (pitchIndex) => {
    initAudio();
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
    const wf = channelWaveforms[activeChannel] || 'square';
    const vol = channelVolumes[activeChannel] !== undefined ? channelVolumes[activeChannel] : 64;
    triggerSynthNode(activeChannel, pitchIndex, wf, vol, 0.25, audioContextRef.current.currentTime);
  };

  // Scheduler Loop
  const scheduleStep = (stepIndex, time) => {
    // Schedule visual playhead updates in main thread
    const delay = (time - audioContextRef.current.currentTime) * 1000;
    setTimeout(() => {
      if (isPlayingRef.current) {
        setCurrentPlayingStep(stepIndex);
      }
    }, Math.max(0, delay));

    // Schedule all notes trigger on this step
    notesRef.current.forEach(note => {
      if (note.step === stepIndex) {
        const wf = channelWaveformsRef.current[note.channel] || 'square';
        const vol = channelVolumesRef.current[note.channel] !== undefined ? channelVolumesRef.current[note.channel] : 64;
        const durationSec = note.duration * (60 / bpmRef.current / 4);
        triggerSynthNode(note.channel, note.pitch, wf, vol, durationSec, time);
      }
    });
  };

  const runScheduler = () => {
    const scheduleAheadTime = 0.12; // 120ms schedule window
    const lookahead = 25.0; // 25ms timer ticks

    const tick = () => {
      if (!isPlayingRef.current) return;
      const audioCtx = audioContextRef.current;

      while (nextNoteTimeRef.current < audioCtx.currentTime + scheduleAheadTime) {
        scheduleStep(currentStepRef.current, nextNoteTimeRef.current);
        
        // Move to next step
        const stepDuration = 60 / bpmRef.current / 4; // 16th note duration
        nextNoteTimeRef.current += stepDuration;
        
        const nextStep = currentStepRef.current + 1;
        if (nextStep >= songLengthRef.current) {
          if (isLoopingRef.current) {
            currentStepRef.current = 0;
          } else {
            setIsPlaying(false);
            isPlayingRef.current = false;
            setCurrentPlayingStep(-1);
            return;
          }
        } else {
          currentStepRef.current = nextStep;
        }
      }
      
      schedulerTimerRef.current = setTimeout(tick, lookahead);
    };

    tick();
  };

  const startPlayback = () => {
    initAudio();
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }

    if (isPlaying) return;

    // Reset playing head
    currentStepRef.current = currentPlayingStep >= 0 ? currentPlayingStep : 0;
    nextNoteTimeRef.current = audioContextRef.current.currentTime + 0.05;
    
    setIsPlaying(true);
    isPlayingRef.current = true;
    runScheduler();
  };

  const pausePlayback = () => {
    setIsPlaying(false);
    isPlayingRef.current = false;
    clearTimeout(schedulerTimerRef.current);
    // Stop all active sound nodes
    activeNodesRef.current.forEach(node => {
      try { node.stop(); } catch { /* ignore */ }
    });
    activeNodesRef.current = [];
  };

  // stopPlayback is defined at the top of the component to avoid pre-declaration issues

  // Grid Cell Interaction
  const handleCellClick = (rowIndex, stepIndex) => {
    const pitch = 35 - rowIndex;
    // Check if there is already a note for this step on activeChannel
    const existingIndex = notes.findIndex(n => n.channel === activeChannel && n.step === stepIndex);

    if (existingIndex >= 0) {
      // Remove existing note
      setNotes(prev => prev.filter((_, idx) => idx !== existingIndex));
    } else {
      // Place new note
      const newNote = {
        id: generateUniqueId(),
        channel: activeChannel,
        step: stepIndex,
        pitch: pitch,
        duration: 2 // Default 2 steps (8th note)
      };
      setNotes(prev => [...prev, newNote]);
      playPreview(pitch);
    }
  };

  const handleNoteDelete = (noteId) => {
    setNotes(prev => prev.filter(n => n.id !== noteId));
  };

  // Drag to Move Notes
  const handleNoteMouseDown = (e, noteId) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    initAudio();

    const startX = e.clientX;
    const startY = e.clientY;
    const note = notes.find(n => n.id === noteId);
    if (!note) return;

    const startStep = note.step;
    const startPitch = note.pitch;
    let currentPitch = startPitch;

    setDraggedNoteId(noteId);

    const handleMouseMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      const stepWidth = 40; // width of a step column
      const rowHeight = 24; // height of a pitch row

      const deltaSteps = Math.round(deltaX / stepWidth);
      const deltaPitches = Math.round(deltaY / rowHeight);

      const newStep = Math.max(0, Math.min(songLength - note.duration, startStep + deltaSteps));
      const newPitch = Math.max(0, Math.min(35, startPitch - deltaPitches));

      if (newPitch !== currentPitch) {
        currentPitch = newPitch;
        playPreview(newPitch);
      }

      setNotes(prev => prev.map(n => n.id === noteId ? { ...n, step: newStep, pitch: newPitch } : n));
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      setDraggedNoteId(null);

      // Clean up overlaps: if there's another note on the exact same step & channel, delete the other note!
      setNotes(prev => {
        const currentNote = prev.find(n => n.id === noteId);
        if (!currentNote) return prev;
        return prev.filter(n => n.id === noteId || !(n.channel === currentNote.channel && n.step === currentNote.step));
      });
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Drag to Resize Notes
  const handleResizeMouseDown = (e, noteId) => {
    e.stopPropagation();
    e.preventDefault();
    initAudio();

    const startX = e.clientX;
    const note = notes.find(n => n.id === noteId);
    if (!note) return;
    const startDuration = note.duration;

    setResizedNoteId(noteId);

    const handleMouseMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const stepWidth = 40; // width of a step column
      const deltaSteps = Math.round(deltaX / stepWidth);
      const newDuration = Math.max(1, startDuration + deltaSteps);
      
      // Keep duration within remaining song space
      const maxDuration = songLength - note.step;
      const finalDuration = Math.min(newDuration, maxDuration);
      
      setNotes(prev => prev.map(n => n.id === noteId ? { ...n, duration: finalDuration } : n));
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      setResizedNoteId(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Close & Save Composition
  const handleSave = () => {
    stopPlayback();
    
    // Compile binary MOD file
    try {
      const modBuffer = serializeToMod(notes, bpm, songLength, channelWaveforms);
      const base64 = arrayBufferToBase64(modBuffer);
      const dataUrl = `data:audio/x-mod;base64,${base64}`;

      const updatedTrack = {
        ...musicTracks.find(t => String(t.id) === String(editingMusicTrackId)),
        data: dataUrl,
        composerData: {
          notes,
          bpm,
          songLength,
          channelWaveforms,
          channelVolumes
        }
      };

      const nextTracks = musicTracks.map(t => String(t.id) === String(editingMusicTrackId) ? updatedTrack : t);
      setMusicTracks(nextTracks);
      saveHistory("Compose Tracker Music", layers, dimensions, { musicTracks: nextTracks });
      setIsMusicEditorOpen(false);
      toast.success("Composition saved successfully!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate MOD file.");
    }
  };

  const handleClear = () => {
    if (window.confirm("Are you sure you want to clear the entire song?")) {
      setNotes([]);
      stopPlayback();
    }
  };

  // Constants for Colors
  const CHANNEL_GRADIENTS = [
    'linear-gradient(90deg, #00d2ff, #0066ff)', // CH 1: Cyan
    'linear-gradient(90deg, #e000ff, #8000ff)', // CH 2: Purple
    'linear-gradient(90deg, #00ff66, #009933)', // CH 3: Green
    'linear-gradient(90deg, #ffcc00, #ff6600)'  // CH 4: Orange
  ];
  
  const CHANNEL_SOLID_COLORS = ['#00d2ff', '#e000ff', '#00ff66', '#ffcc00'];

  const WAVEFORMS = [
    { id: 'square', name: 'Square (50% Duty)' },
    { id: 'pulse25', name: 'Pulse (25% Duty)' },
    { id: 'pulse125', name: 'Pulse (12.5% Duty)' },
    { id: 'triangle', name: 'Triangle' },
    { id: 'sawtooth', name: 'Sawtooth' },
    { id: 'sine', name: 'Sine' },
    { id: 'noise', name: 'Noise (Percussion)' }
  ];

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 20000,
      backgroundColor: '#161618',
      color: '#fff',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      userSelect: 'none'
    }}>
      {/* HEADER CONTROLS */}
      <div style={{
        height: '64px',
        backgroundColor: '#202023',
        borderBottom: '1px solid #333',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        flexShrink: 0,
        boxShadow: '0 4px 10px rgba(0,0,0,0.3)'
      }}>
        {/* Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#4CAF50', letterSpacing: '0.5px' }}>
            Music Editor
          </span>
          <span style={{ fontSize: '12px', background: '#333', padding: '4px 8px', borderRadius: '4px', color: '#aaa' }}>
            Piano Roll Sequencer
          </span>
        </div>

        {/* Playback Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isPlaying ? (
            <button onClick={pausePlayback} style={{
              background: 'transparent', border: '1px solid #b8860b', color: '#b8860b', width: '36px', height: '36px',
              borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }} title="Pause"
              onMouseEnter={e => { e.currentTarget.style.background = '#b8860b'; e.currentTarget.style.color = '#fff'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#b8860b'; }}
            >
              <BsPauseFill size={18} />
            </button>
          ) : (
            <button onClick={startPlayback} style={{
              background: 'transparent', border: '1px solid #4CAF50', color: '#4CAF50', width: '36px', height: '36px',
              borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }} title="Play"
              onMouseEnter={e => { e.currentTarget.style.background = '#4CAF50'; e.currentTarget.style.color = '#fff'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#4CAF50'; }}
            >
              <BsPlayFill size={20} style={{ marginLeft: '2px' }} />
            </button>
          )}

          <button onClick={stopPlayback} style={{
            background: '#444', border: 'none', color: '#fff', width: '36px', height: '36px',
            borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }} title="Stop">
            <BsStopFill size={16} />
          </button>

          <button 
            onClick={() => setIsLooping(!isLooping)} 
            style={{
              background: isLooping ? '#0078d4' : '#333', border: '1px solid #555', color: '#fff', width: '36px', height: '36px',
              borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }} 
            title="Toggle Loop"
          >
            <BsArrowClockwise size={16} style={{ transform: isLooping ? 'none' : 'rotate(45deg)', transition: 'all 0.2s' }} />
          </button>

          {/* BPM Slider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '15px', background: '#2d2d30', padding: '6px 12px', borderRadius: '20px', border: '1px solid #444' }}>
            <span style={{ fontSize: '11px', color: '#aaa', fontWeight: 'bold' }}>BPM</span>
            <input 
              type="range" min="60" max="240" value={bpm} 
              onChange={e => setBpm(parseInt(e.target.value))} 
              style={{ width: '80px', height: '4px', cursor: 'pointer', accentColor: '#4CAF50' }}
            />
            <span style={{ fontSize: '12px', minWidth: '28px', textAlign: 'right', fontWeight: 'monospace' }}>{bpm}</span>
          </div>

          {/* Song Length Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#2d2d30', padding: '6px 12px', borderRadius: '20px', border: '1px solid #444' }}>
            <span style={{ fontSize: '11px', color: '#aaa', fontWeight: 'bold' }}>Steps</span>
            <select 
              value={songLength} 
              onChange={e => {
                const newLength = parseInt(e.target.value);
                setSongLength(newLength);
                // Trim notes extending past new boundary
                setNotes(prev => prev.filter(n => n.step < newLength).map(n => {
                  if (n.step + n.duration > newLength) {
                    return { ...n, duration: newLength - n.step };
                  }
                  return n;
                }));
              }}
              style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '12px', outline: 'none', cursor: 'pointer', fontWeight: 'bold' }}
            >
              <option value="32" style={{ backgroundColor: '#2d2d30' }}>32 Steps</option>
              <option value="64" style={{ backgroundColor: '#2d2d30' }}>64 Steps</option>
              <option value="128" style={{ backgroundColor: '#2d2d30' }}>128 Steps</option>
              <option value="256" style={{ backgroundColor: '#2d2d30' }}>256 Steps</option>
            </select>
          </div>
        </div>

        {/* Save / Close */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button onClick={handleClear} style={{
            background: '#3a1a1a', border: '1px solid #ff4444', color: '#ff4444', 
            padding: '8px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px',
            display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold'
          }}>
            <BsTrash size={14} /> Clear
          </button>
          
          <button onClick={() => { stopPlayback(); setIsMusicEditorOpen(false); }} style={{
            background: '#333', border: '1px solid #555', color: '#ccc', 
            padding: '8px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px',
            display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold'
          }}>
            <BsXCircle size={14} /> Cancel
          </button>

          <button onClick={handleSave} style={{
            background: 'transparent', border: '1px solid #4CAF50', color: '#4CAF50', 
            padding: '8px 18px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px',
            display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold'
          }}
            onMouseEnter={e => { e.currentTarget.style.background = '#4CAF50'; e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#4CAF50'; }}
          >
            <BsCheckCircle size={14} /> Save & Close
          </button>
        </div>
      </div>

      {/* SYNTH CONFIGURATION BAR */}
      <div style={{
        height: '52px',
        backgroundColor: '#1b1b1e',
        borderBottom: '1px solid #2d2d30',
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px',
        gap: '20px',
        overflowX: 'auto',
        flexShrink: 0
      }}>
        {/* Tabs for active track */}
        <div style={{ display: 'flex', gap: '4px', background: '#111', padding: '3px', borderRadius: '8px', border: '1px solid #333' }}>
          {[0, 1, 2, 3].map(ch => (
            <button
              key={ch}
              onClick={() => setActiveChannel(ch)}
              style={{
                background: activeChannel === ch ? CHANNEL_SOLID_COLORS[ch] : 'transparent',
                color: activeChannel === ch ? '#000' : '#888',
                border: 'none',
                padding: '6px 14px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: 'bold',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                transition: 'all 0.15s'
              }}
            >
              Channel {ch + 1}
            </button>
          ))}
        </div>

        {/* Selected Channel Settings */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', borderLeft: '1px solid #333', paddingLeft: '20px' }}>
          {/* Waveform Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11px', color: '#888', fontWeight: 'bold', textTransform: 'uppercase' }}>Waveform</span>
            {activeChannel === 3 ? (
              <span style={{ fontSize: '12px', color: '#ffcc00', fontWeight: 'bold', background: '#3a2d10', padding: '4px 10px', borderRadius: '4px', border: '1px solid #665015' }}>
                Noise (Percussion Only)
              </span>
            ) : (
              <select
                value={channelWaveforms[activeChannel]}
                onChange={e => {
                  const newWfs = [...channelWaveforms];
                  newWfs[activeChannel] = e.target.value;
                  setChannelWaveforms(newWfs);
                }}
                style={{
                  background: '#2d2d30',
                  color: '#fff',
                  border: '1px solid #444',
                  borderRadius: '4px',
                  padding: '5px 10px',
                  fontSize: '12px',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                {WAVEFORMS.filter(w => w.id !== 'noise').map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* Volume Slider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11px', color: '#888', fontWeight: 'bold', textTransform: 'uppercase' }}>Track Vol</span>
            <input
              type="range" min="0" max="64" value={channelVolumes[activeChannel]}
              onChange={e => {
                const newVols = [...channelVolumes];
                newVols[activeChannel] = parseInt(e.target.value);
                setChannelVolumes(newVols);
              }}
              style={{
                width: '70px',
                height: '4px',
                cursor: 'pointer',
                accentColor: CHANNEL_SOLID_COLORS[activeChannel]
              }}
            />
            <span style={{ fontSize: '11px', fontWeight: 'monospace', minWidth: '15px' }}>{channelVolumes[activeChannel]}</span>
          </div>
        </div>

        {/* Legend */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '10px', alignItems: 'center', fontSize: '10px', color: '#777' }}>
          <span>Tip: Click cell to add note. Right-click note to delete. Drag right edge of note to change length.</span>
        </div>
      </div>

      {/* SEQUENCER WORKSPACE */}
      <div 
        ref={gridContainerRef}
        style={{
          flex: 1,
          overflow: 'auto',
          position: 'relative',
          display: 'flex',
          backgroundColor: '#121214'
        }}
      >
        {/* Sticky Piano Keys Column */}
        <div style={{
          position: 'sticky',
          left: 0,
          zIndex: 100,
          width: '64px',
          backgroundColor: '#1a1a1c',
          borderRight: '2px solid #333',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '4px 0 10px rgba(0,0,0,0.4)',
          flexShrink: 0
        }}>
          {Array.from({ length: 36 }).map((_, i) => {
            const pitch = 35 - i;
            const noteName = NOTE_NAMES[pitch];
            const isBlack = noteName.includes('#');
            return (
              <div
                key={pitch}
                onClick={() => playPreview(pitch)}
                onMouseEnter={e => { if (e.buttons === 1) playPreview(pitch); }}
                style={{
                  height: '24px',
                  backgroundColor: isBlack ? '#151515' : '#eaeaea',
                  color: isBlack ? '#777' : '#222',
                  borderBottom: '1px solid #333',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  paddingRight: '8px',
                  fontSize: '9px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  boxSizing: 'border-box',
                  transition: 'background-color 0.1s',
                  '&:hover': {
                    backgroundColor: isBlack ? '#333' : '#bbb'
                  }
                }}
              >
                {noteName}
              </div>
            );
          })}
        </div>

        {/* Scrollable Note Grid */}
        <div style={{
          position: 'relative',
          width: `${songLength * 40}px`,
          height: `${36 * 24}px`,
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)',
          backgroundSize: '100% 24px',
          boxSizing: 'border-box'
        }}>
          {/* Grid Background Gridlines */}
          <div style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            display: 'flex'
          }}>
            {Array.from({ length: songLength }).map((_, c) => {
              const isBar = c % 16 === 0;
              const isBeat = c % 4 === 0;
              return (
                <div
                  key={c}
                  style={{
                    width: '40px',
                    height: '100%',
                    borderRight: isBar ? '2px solid rgba(255,255,255,0.18)' : isBeat ? '1px solid rgba(255,255,255,0.09)' : '1px solid rgba(255,255,255,0.03)',
                    boxSizing: 'border-box',
                    flexShrink: 0
                  }}
                />
              );
            })}
          </div>

          {/* Interactive grid cells */}
          {Array.from({ length: 36 }).map((_, r) => {
            const isBlack = NOTE_NAMES[35 - r].includes('#');
            return (
              <div
                key={r}
                style={{
                  height: '24px',
                  display: 'flex',
                  position: 'relative',
                  backgroundColor: isBlack ? 'rgba(0,0,0,0.15)' : 'transparent',
                  borderBottom: '1px solid rgba(255,255,255,0.02)',
                  boxSizing: 'border-box'
                }}
              >
                {Array.from({ length: songLength }).map((_, c) => (
                  <div
                    key={c}
                    onClick={() => handleCellClick(r, c)}
                    style={{
                      width: '40px',
                      height: '100%',
                      cursor: 'crosshair',
                      boxSizing: 'border-box',
                      flexShrink: 0,
                      '&:hover': {
                        backgroundColor: 'rgba(255,255,255,0.04)'
                      }
                    }}
                  />
                ))}
              </div>
            );
          })}

          {/* GHOST NOTES (Faint inactive channel notes) */}
          {notes
            .filter(note => note.channel !== activeChannel)
            .map(note => {
              const rowIndex = 35 - note.pitch;
              return (
                <div
                  key={`ghost-${note.id}`}
                  style={{
                    position: 'absolute',
                    left: `${note.step * 40}px`,
                    top: `${rowIndex * 24}px`,
                    width: `${note.duration * 40}px`,
                    height: '24px',
                    padding: '2px 0',
                    boxSizing: 'border-box',
                    pointerEvents: 'none'
                  }}
                >
                  <div style={{
                    width: '100%',
                    height: '100%',
                    backgroundColor: CHANNEL_SOLID_COLORS[note.channel],
                    opacity: 0.15,
                    borderRadius: '3px'
                  }} />
                </div>
              );
            })}

          {/* ACTIVE NOTES (Highlight and editable) */}
          {notes
            .filter(note => note.channel === activeChannel)
            .map(note => {
              const rowIndex = 35 - note.pitch;
              const isDragged = note.id === draggedNoteId;
              const isResized = note.id === resizedNoteId;
              return (
                <div
                  key={note.id}
                  onMouseDown={(e) => handleNoteMouseDown(e, note.id)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    handleNoteDelete(note.id);
                  }}
                  style={{
                    position: 'absolute',
                    left: `${note.step * 40}px`,
                    top: `${rowIndex * 24}px`,
                    width: `${note.duration * 40}px`,
                    height: '24px',
                    padding: '2px 0',
                    boxSizing: 'border-box',
                    cursor: 'move',
                    zIndex: isDragged || isResized ? 100 : 10,
                    transform: isDragged ? 'scale(1.02)' : 'scale(1)',
                    opacity: isDragged ? 0.9 : 1,
                    transition: 'transform 0.1s, opacity 0.1s'
                  }}
                >
                  <div style={{
                    width: '100%',
                    height: '100%',
                    background: CHANNEL_GRADIENTS[activeChannel],
                    border: isDragged ? '1.5px solid #fff' : '1px solid rgba(255,255,255,0.5)',
                    borderRadius: '4px',
                    boxSizing: 'border-box',
                    boxShadow: isDragged 
                      ? `0 0 12px ${CHANNEL_SOLID_COLORS[activeChannel]}` 
                      : `0 0 6px ${CHANNEL_SOLID_COLORS[activeChannel]}40`,
                    display: 'flex',
                    alignItems: 'center',
                    paddingLeft: '6px',
                    fontSize: '9px',
                    fontWeight: 'bold',
                    color: '#000',
                    position: 'relative',
                    overflow: 'hidden'
                  }}>
                    {/* Pitch name inside note block */}
                    {NOTE_NAMES[note.pitch]}

                    {/* Drag resize handle on right edge */}
                    <div
                      onMouseDown={(e) => handleResizeMouseDown(e, note.id)}
                      style={{
                        position: 'absolute',
                        right: 0,
                        top: 0,
                        bottom: 0,
                        width: '6px',
                        cursor: 'ew-resize',
                        backgroundColor: 'rgba(0, 0, 0, 0.25)',
                        borderLeft: '1px solid rgba(255,255,255,0.3)',
                        transition: 'background-color 0.1s',
                        '&:hover': {
                          backgroundColor: 'rgba(0, 0, 0, 0.4)'
                        }
                      }}
                    />
                  </div>
                </div>
              );
            })}

          {/* PLAYHEAD (Visual Red line indicator) */}
          {currentPlayingStep >= 0 && (
            <div style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: `${currentPlayingStep * 40}px`,
              width: '2px',
              backgroundColor: '#ff3333',
              boxShadow: '0 0 10px #ff3333, 0 0 4px #ff3333',
              pointerEvents: 'none',
              zIndex: 90
            }} />
          )}
        </div>
      </div>
    </div>
  );
};

export default MusicEditor;
