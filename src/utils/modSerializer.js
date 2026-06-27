// ProTracker MOD binary serializer for PxGBA

const PERIODS = [
  // Octave 3 (C3 to B3)
  856, 808, 762, 720, 680, 642, 606, 570, 538, 508, 480, 453,
  // Octave 4 (C4 to B4)
  428, 404, 381, 360, 340, 321, 303, 285, 269, 254, 240, 226,
  // Octave 5 (C5 to B5)
  214, 202, 190, 180, 170, 160, 151, 143, 135, 127, 120, 113
];

const NOTE_NAMES = [
  "C-3", "C#3", "D-3", "D#3", "E-3", "F-3", "F#3", "G-3", "G#3", "A-3", "A#3", "B-3",
  "C-4", "C#4", "D-4", "D#4", "E-4", "F-4", "F#4", "G-4", "G#4", "A-4", "A#4", "B-4",
  "C-5", "C#5", "D-5", "D#5", "E-5", "F-5", "F#5", "G-5", "G#5", "A-5", "A#5", "B-5"
];

export { PERIODS, NOTE_NAMES };

export function serializeToMod(notes, bpm, songLength, channelWaveforms) {
  const WAVEFORM_MAP = {
    'square': 1,
    'pulse25': 2,
    'triangle': 3,
    'sawtooth': 4,
    'noise': 5,
    'sine': 6
  };

  const numPatterns = Math.ceil(songLength / 64);
  const totalSize = 1084 + (numPatterns * 1024) + 1344;
  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  // Write Title (20 bytes)
  const titleStr = "PxGBA Song";
  for (let i = 0; i < 20; i++) {
    view.setUint8(i, i < titleStr.length ? titleStr.charCodeAt(i) : 0);
  }

  // Write 31 Instruments (30 bytes each)
  const instruments = [
    { name: "Square 50%", len: 64, repeatLen: 64 },
    { name: "Pulse 25%", len: 64, repeatLen: 64 },
    { name: "Triangle", len: 64, repeatLen: 64 },
    { name: "Sawtooth", len: 64, repeatLen: 64 },
    { name: "Noise", len: 1024, repeatLen: 1024 },
    { name: "Sine", len: 64, repeatLen: 64 }
  ];

  let offset = 20;
  for (let instIdx = 0; instIdx < 31; instIdx++) {
    const inst = instruments[instIdx];
    if (inst) {
      // Name (22 bytes)
      for (let i = 0; i < 22; i++) {
        view.setUint8(offset + i, i < inst.name.length ? inst.name.charCodeAt(i) : 0);
      }
      // Sample length in words (2 bytes)
      view.setUint16(offset + 22, inst.len / 2, false); // big endian
      // Finetune (1 byte)
      view.setUint8(offset + 24, 0);
      // Volume (1 byte)
      view.setUint8(offset + 25, 64); // max volume
      // Repeat offset in words (2 bytes)
      view.setUint16(offset + 26, 0, false);
      // Repeat length in words (2 bytes)
      view.setUint16(offset + 28, inst.repeatLen / 2, false);
    } else {
      // Empty instrument
      for (let i = 0; i < 22; i++) view.setUint8(offset + i, 0);
      view.setUint16(offset + 22, 0, false);
      view.setUint8(offset + 24, 0);
      view.setUint8(offset + 25, 0);
      view.setUint16(offset + 26, 0, false);
      view.setUint16(offset + 28, 1, false); // loop length = 1 word (safety)
    }
    offset += 30;
  }

  // Playlist length (1 byte)
  view.setUint8(offset, numPatterns);
  // Restart position (1 byte) — must be valid playlist index, 127 causes maxmod hang
  view.setUint8(offset + 1, 0);
  offset += 2;

  // Playlist (128 bytes)
  for (let i = 0; i < 128; i++) {
    view.setUint8(offset + i, i < numPatterns ? i : 0);
  }
  offset += 128;

  // Format Tag (4 bytes) - "M.K."
  view.setUint8(offset, 77); // M
  view.setUint8(offset + 1, 46); // .
  view.setUint8(offset + 2, 75); // K
  view.setUint8(offset + 3, 46); // .
  offset += 4; // offset is now 1084

  // Prepare patterns array
  const patterns = [];
  for (let p = 0; p < numPatterns; p++) {
    const pattern = [];
    for (let r = 0; r < 64; r++) {
      const row = [];
      for (let c = 0; c < 4; c++) {
        row.push({ period: 0, instrument: 0, effectCmd: 0, effectParam: 0 });
      }
      pattern.push(row);
    }
    patterns.push(pattern);
  }

  // Write BPM at Row 0, Channel 0
  patterns[0][0][0].effectCmd = 0xF;
  patterns[0][0][0].effectParam = Math.max(32, Math.min(255, bpm));

  // Populate patterns with notes
  notes.forEach(note => {
    const startStep = note.step;
    const startPattern = Math.floor(startStep / 64);
    const startRow = startStep % 64;

    if (startPattern < numPatterns) {
      const channel = note.channel;
      const wf = channelWaveforms[channel] || 'square';
      const instNum = WAVEFORM_MAP[wf] || 1;
      const period = PERIODS[note.pitch] || 0;

      patterns[startPattern][startRow][channel].period = period;
      patterns[startPattern][startRow][channel].instrument = instNum;

      // Handle note cut at end of duration
      const endStep = startStep + note.duration;
      const endPattern = Math.floor(endStep / 64);
      const endRow = endStep % 64;

      if (endStep < songLength && endPattern < numPatterns) {
        // Check if there is another note starting at this exact step on the same channel
        const noteAtEnd = notes.find(n => n.channel === channel && n.step === endStep);
        if (!noteAtEnd) {
          // Put note cut effect (C00)
          patterns[endPattern][endRow][channel].effectCmd = 0xC;
          patterns[endPattern][endRow][channel].effectParam = 0;
        }
      }
    }
  });

  // Serialize pattern data (each cell is 4 bytes)
  for (let p = 0; p < numPatterns; p++) {
    for (let r = 0; r < 64; r++) {
      for (let c = 0; c < 4; c++) {
        const cell = patterns[p][r][c];
        const inst = cell.instrument;
        const period = cell.period;
        const eff = cell.effectCmd;
        const param = cell.effectParam;

        const b0 = (inst & 0xF0) | ((period >> 8) & 0x0F);
        const b1 = period & 0xFF;
        const b2 = ((inst & 0x0F) << 4) | (eff & 0x0F);
        const b3 = param & 0xFF;

        view.setUint8(offset, b0);
        view.setUint8(offset + 1, b1);
        view.setUint8(offset + 2, b2);
        view.setUint8(offset + 3, b3);
        offset += 4;
      }
    }
  }

  // Write Sample Data (raw 8-bit signed PCM)
  // Instrument 1: Square 50% (64 bytes)
  for (let i = 0; i < 64; i++) {
    bytes[offset + i] = i < 32 ? 127 : -128;
  }
  offset += 64;

  // Instrument 2: Pulse 25% (64 bytes)
  for (let i = 0; i < 64; i++) {
    bytes[offset + i] = i < 16 ? 127 : -128;
  }
  offset += 64;

  // Instrument 3: Triangle (64 bytes)
  for (let i = 0; i < 32; i++) {
    bytes[offset + i] = Math.floor(-128 + (i / 31) * 255);
  }
  for (let i = 32; i < 64; i++) {
    bytes[offset + i] = Math.floor(127 - ((i - 32) / 31) * 255);
  }
  offset += 64;

  // Instrument 4: Sawtooth (64 bytes)
  for (let i = 0; i < 64; i++) {
    bytes[offset + i] = Math.floor(-128 + (i / 63) * 255);
  }
  offset += 64;

  // Instrument 5: Noise (1024 bytes)
  for (let i = 0; i < 1024; i++) {
    bytes[offset + i] = Math.floor((Math.random() * 2 - 1) * 100);
  }
  offset += 1024;

  // Instrument 6: Sine (64 bytes)
  for (let i = 0; i < 64; i++) {
    bytes[offset + i] = Math.floor(Math.sin((i / 64) * 2 * Math.PI) * 127);
  }
  offset += 64;

  return buffer;
}
