export const isPointInPolygon = (point, vs) => {
  let x = point.x, y = point.y;
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    let xi = vs[i].x, yi = vs[i].y;
    let xj = vs[j].x, yj = vs[j].y;
    let intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
};

export const combineCellsToRectangles = (cellCoords) => {
  const cellSet = new Set(cellCoords.map(c => `${c.x},${c.y}`));
  const rects = [];

  const sortedCells = [...cellCoords].sort((a, b) => {
    if (a.y !== b.y) return a.y - b.y;
    return a.x - b.x;
  });

  for (const cell of sortedCells) {
    const key = `${cell.x},${cell.y}`;
    if (!cellSet.has(key)) continue;

    let w = 8;
    while (cellSet.has(`${cell.x + w},${cell.y}`)) {
      w += 8;
    }

    let h = 8;
    let canExpandVertically = true;
    while (canExpandVertically) {
      for (let dx = 0; dx < w; dx += 8) {
        if (!cellSet.has(`${cell.x + dx},${cell.y + h}`)) {
          canExpandVertically = false;
          break;
        }
      }
      if (canExpandVertically) {
        h += 8;
      }
    }

    rects.push({ x: cell.x, y: cell.y, width: w, height: h });

    for (let dy = 0; dy < h; dy += 8) {
      for (let dx = 0; dx < w; dx += 8) {
        cellSet.delete(`${cell.x + dx},${cell.y + dy}`);
      }
    }
  }

  return rects;
};

export const compress8bitNumberArray = (arr) => {
  if (!arr) {
    return "";
  }
  let lastValue = -1;
  let output = "";
  let count = 0;

  for (let i = 0; i < arr.length; i++) {
    if (arr[i] !== lastValue) {
      if (count === 1) {
        output += "!";
      } else if (count > 0) {
        output += `${count.toString(16)}+`;
      }
      count = 0;
      lastValue = arr[i];
      output += (lastValue % 256).toString(16).padStart(2, "0");
    }
    count++;
  }
  if (count === 1) {
    output += "!";
  } else if (count > 0) {
    output += `${count.toString(16)}+`;
  }

  return output;
};
const hexToRgbCache = new Map();
export const hexToRgb = (hex) => {
  if (!hex) return null;
  let cached = hexToRgbCache.get(hex);
  if (cached !== undefined) return cached;
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  const val = result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : null;
  if (hexToRgbCache.size > 20000) hexToRgbCache.clear();
  hexToRgbCache.set(hex, val);
  return val;
};

export const rgbToHsl = (r, g, b) => {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
};

export const hslToRgb = (h, s, l) => {
  h /= 360; s /= 100; l /= 100;
  let r, g, b;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
};

export const rgbToHex = (r, g, b) => {
  return "#" + (1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1);
};

export const adjustHslHex = (hex, dh, ds, dl) => {
  if (!hex) return hex;
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

  let newH = (hsl.h + dh) % 360;
  if (newH < 0) newH += 360;

  let newS = Math.max(0, Math.min(100, hsl.s + ds));
  let newL = Math.max(0, Math.min(100, hsl.l + dl));

  const newRgb = hslToRgb(newH, newS, newL);
  return rgbToHex(newRgb.r, newRgb.g, newRgb.b);
};

export const adjustBrightnessContrastHex = (hex, brightness, contrast) => {
  if (!hex) return hex;
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;

  const b = brightness * 2.55;
  const c = contrast * 2.55;
  const factor = (259 * (c + 255)) / (255 * (259 - c));

  const apply = (val) => {
    let v = val + b;
    v = factor * (v - 128) + 128;
    return Math.max(0, Math.min(255, Math.round(v)));
  };

  return rgbToHex(apply(rgb.r), apply(rgb.g), apply(rgb.b));
};

export const blendHexColors = (bgHex, fgHex, opacity) => {
  if (opacity >= 100) return fgHex ? fgHex.substring(0, 7) : null;
  if (opacity <= 0) return bgHex;
  if (!bgHex) {
    const a = Math.round((opacity / 100) * 255).toString(16).padStart(2, '0');
    return fgHex.substring(0, 7) + a;
  }

  const parseHex = (h) => {
    if (!h) return { r: 0, g: 0, b: 0, a: 0 };
    const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})?$/i.exec(h);
    if (!match) return { r: 0, g: 0, b: 0, a: 0 };
    return { r: parseInt(match[1], 16), g: parseInt(match[2], 16), b: parseInt(match[3], 16), a: match[4] ? parseInt(match[4], 16) / 255 : 1 };
  };

  const bg = parseHex(bgHex);
  const fg = parseHex(fgHex.substring(0, 7));
  const fgA = opacity / 100;

  const outA = fgA + bg.a * (1 - fgA);
  if (outA === 0) return null;

  const r = Math.round((fg.r * fgA + bg.r * bg.a * (1 - fgA)) / outA);
  const g = Math.round((fg.g * fgA + bg.g * bg.a * (1 - fgA)) / outA);
  const b = Math.round((fg.b * fgA + bg.b * bg.a * (1 - fgA)) / outA);
  const aHex = Math.round(outA * 255).toString(16).padStart(2, '0');

  const rgbHex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  return outA >= 0.99 ? rgbHex : rgbHex + aHex;
};

export const invertHex = (hex) => {
  if (!hex) return null;
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const r = 255 - rgb.r;
  const g = 255 - rgb.g;
  const b = 255 - rgb.b;
  return rgbToHex(r, g, b);
};

export const getNextZoom = (z, dir) => {
  let nextZ;
  if (dir > 0) {
    if (z >= 1) nextZ = z + 1;
    else if (z >= 0.1) nextZ = z + 0.1;
    else nextZ = z + 0.01;
  } else {
    if (z > 1) nextZ = z - 1;
    else if (z > 0.1) nextZ = z - 0.1;
    else nextZ = z - 0.01;
  }
  return Math.max(0.1, Math.min(50, Math.round(nextZ * 100) / 100));
};

const isLittleEndian = new Uint8Array(new Uint32Array([0x12345678]).buffer)[0] === 0x78;
const colorCache32 = new Map();

export const parseColorTo32 = (color) => {
  let cached = colorCache32.get(color);
  if (cached !== undefined) return cached;
  let r = 0, g = 0, b = 0, a = 255;
  if (color.startsWith('#')) {
    if (color.length === 4) {
      r = parseInt(color[1] + color[1], 16);
      g = parseInt(color[2] + color[2], 16);
      b = parseInt(color[3] + color[3], 16);
    } else {
      r = parseInt(color.slice(1, 3), 16);
      g = parseInt(color.slice(3, 5), 16);
      b = parseInt(color.slice(5, 7), 16);
      if (color.length === 9) a = parseInt(color.slice(7, 9), 16);
    }
  } else if (color.startsWith('rgb')) {
    const match = color.match(/[\d.]+/g);
    if (match) {
      r = parseInt(match[0]); g = parseInt(match[1]); b = parseInt(match[2]);
      if (match[3]) a = Math.round(parseFloat(match[3]) * 255);
    }
  }
  const val = isLittleEndian ? (a << 24) | (b << 16) | (g << 8) | r : (r << 24) | (g << 16) | (b << 8) | a;
  if (colorCache32.size > 5000) colorCache32.clear();
  colorCache32.set(color, val);
  return val;
};

export const generateWav = (type, freq, durationMs, fadeOut = true) => {
  const sampleRate = 16000;
  const numSamples = Math.floor(sampleRate * (durationMs / 1000));
  const buffer = new ArrayBuffer(44 + numSamples);
  const view = new DataView(buffer);

  const writeString = (offset, string) => {
    for (let i = 0; i < string.length; i++) view.setUint8(offset + i, string.charCodeAt(i));
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + numSamples, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate, true);
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true);
  writeString(36, 'data');
  view.setUint32(40, numSamples, true);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let sample = 0;
    if (type === 'square') {
      sample = Math.sin(2 * Math.PI * freq * t) > 0 ? 1 : -1;
    } else if (type === 'sine') {
      sample = Math.sin(2 * Math.PI * freq * t);
    } else if (type === 'sawtooth') {
      sample = 2 * (t * freq - Math.floor(t * freq + 0.5));
    } else if (type === 'noise') {
      sample = Math.random() * 2 - 1;
    }
    const envelope = fadeOut ? 1 - (i / numSamples) : 1;
    const val = Math.max(0, Math.min(255, Math.floor((sample * envelope * 127) + 128)));
    view.setUint8(44 + i, val);
  }
  return buffer;
};

export const cloneLayersForHistory = (layersList) => layersList.map(l => ({
  ...l,
  data: l.data ? l.data.map(row => row.slice()) : null
}));

export const createEmptyLayer = (name, groupId, w, h) => ({
  id: Date.now() + Math.random(),
  textData: null,
  type: 'layer',
  name,
  visible: true,
  groupId,
  data: Array(h).fill(null).map(() => Array(w).fill(null))
});
const paletteCache = new Map();

function getPaletteRgbList(palette) {
  const key = palette.join(',');
  let cached = paletteCache.get(key);
  if (cached) return cached;

  const list = [];
  for (let i = 0; i < palette.length; i++) {
    const hex = palette[i];
    const rgb = hexToRgb(hex);
    if (rgb) {
      list.push({ hex, rgb });
    }
  }

  if (paletteCache.size > 100) paletteCache.clear();
  paletteCache.set(key, list);
  return list;
}

export function getClosestPaletteColor(hex, palette = DEFAULT_16_PALETTE) {
  if (!hex) return null;
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;

  const rgbList = getPaletteRgbList(palette);
  let closestColor = palette[0];
  let minDistance = Infinity;

  for (let i = 0; i < rgbList.length; i++) {
    const p = rgbList[i];
    const dr = rgb.r - p.rgb.r;
    const dg = rgb.g - p.rgb.g;
    const db = rgb.b - p.rgb.b;
    const distance = dr * dr + dg * dg + db * db;
    if (distance < minDistance) {
      minDistance = distance;
      closestColor = p.hex;
    }
  }
  return closestColor;
}

export function filterSimilarColors(colors, threshold = 100, existingPalette = []) {
  const selectedColors = [];
  const selectedRgb = [];

  const existingRgb = existingPalette.map(hexToRgb).filter(Boolean);
  const maxLimit = 256 - existingRgb.length;

  for (let i = 0; i < colors.length; i++) {
    if (selectedColors.length >= maxLimit) break;

    const color = colors[i];
    const rgb = hexToRgb(color);
    if (!rgb) continue;

    let tooClose = false;
    // Check against existing palette colors
    for (let j = 0; j < existingRgb.length; j++) {
      const pRgb = existingRgb[j];
      const dr = rgb.r - pRgb.r;
      const dg = rgb.g - pRgb.g;
      const db = rgb.b - pRgb.b;
      if (dr * dr + dg * dg + db * db < threshold) {
        tooClose = true;
        break;
      }
    }

    if (tooClose) continue;

    // Check against already selected new colors
    for (let j = 0; j < selectedRgb.length; j++) {
      const sRgb = selectedRgb[j];
      const dr = rgb.r - sRgb.r;
      const dg = rgb.g - sRgb.g;
      const db = rgb.b - sRgb.b;
      if (dr * dr + dg * dg + db * db < threshold) {
        tooClose = true;
        break;
      }
    }

    if (!tooClose) {
      selectedColors.push(color);
      selectedRgb.push(rgb);
    }
  }

  return selectedColors;
}

let uniqueIdCounter = 0;
export function hexToHsl(hex) {
  let r = parseInt(hex.slice(1, 3), 16) / 255;
  let g = parseInt(hex.slice(3, 5), 16) / 255;
  let b = parseInt(hex.slice(5, 7), 16) / 255;
  let max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  if (max === min) {
    h = s = 0;
  } else {
    let d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return [h, s, l];
}

export function sortColorsByHue(colors) {
  return [...colors].sort((a, b) => {
    const hslA = hexToHsl(a);
    const hslB = hexToHsl(b);
    if (Math.abs(hslA[0] - hslB[0]) > 0.05) {
      return hslA[0] - hslB[0];
    }
    if (Math.abs(hslA[1] - hslB[1]) > 0.05) {
      return hslA[1] - hslB[1];
    }
    return hslA[2] - hslB[2];
  });
}

export function generateUniqueId() {
  uniqueIdCounter = (uniqueIdCounter + 1) % 1000000;
  return Date.now() * 1000 + uniqueIdCounter;
}

export const detectTransparencyColor = (imageData, w, h) => {
  let hasTransparentPixels = false;
  for (let i = 3; i < imageData.length; i += 4) {
    if (imageData[i] < 128) {
      hasTransparentPixels = true;
      break;
    }
  }

  const getPixelHex = (x, y) => {
    const idx = (y * w + x) * 4;
    const r = imageData[idx];
    const g = imageData[idx + 1];
    const b = imageData[idx + 2];
    const a = imageData[idx + 3];
    return {
      hex: "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1),
      opaque: a >= 128
    };
  };

  const corners = [
    getPixelHex(0, 0),
    getPixelHex(w - 1, 0),
    getPixelHex(0, h - 1),
    getPixelHex(w - 1, h - 1)
  ];

  if (hasTransparentPixels) {
    const magentaCorner = corners.find(c => c.opaque && c.hex === '#ff00ff');
    if (magentaCorner) {
      return magentaCorner.hex;
    }
    return null;
  }

  const colorGroups = {};
  corners.forEach(c => {
    if (c.opaque) {
      colorGroups[c.hex] = (colorGroups[c.hex] || 0) + 1;
    }
  });

  let consensusColor = null;
  let maxCount = 0;
  for (const hex in colorGroups) {
    if (colorGroups[hex] > maxCount) {
      maxCount = colorGroups[hex];
      consensusColor = hex;
    }
  }

  if (maxCount >= 3) {
    return consensusColor;
  }

  return null;
};
