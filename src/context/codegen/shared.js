export function hexToRgbLocal(hex) {
  if (!hex) return null;
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (result) {
    return { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) };
  }
  const shorthandResult = /^#?([a-f\d])([a-f\d])([a-f\d])$/i.exec(hex);
  if (shorthandResult) {
    return {
      r: parseInt(shorthandResult[1] + shorthandResult[1], 16),
      g: parseInt(shorthandResult[2] + shorthandResult[2], 16),
      b: parseInt(shorthandResult[3] + shorthandResult[3], 16)
    };
  }
  return null;
}

export function compileTilesetCanvas(savedTiles) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(8, savedTiles.length * 8);
  canvas.height = 8;
  const tCtx = canvas.getContext('2d');
  tCtx.clearRect(0, 0, canvas.width, canvas.height);

  savedTiles.forEach((tile, index) => {
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const colorHex = tile.data[y][x];
        if (colorHex) {
          tCtx.fillStyle = colorHex;
          tCtx.fillRect(index * 8 + x, y, 1, 1);
        }
      }
    }
  });

  return canvas;
}

export function getTilesLayoutData(ctx, dimensions, rows, cols, savedTiles) {
  const imgData = ctx.getImageData(0, 0, dimensions.w, dimensions.h);
  const matchedTileIndices = [];
  const matchedTiles = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      let bestTile = null;
      let bestTileIdx = -1;
      let bestScore = -1;

      for (let tIdx = 0; tIdx < savedTiles.length; tIdx++) {
        const tile = savedTiles[tIdx];
        let match = true;
        let nonNullCount = 0;

        for (let py = 0; py < 8; py++) {
          for (let px = 0; px < 8; px++) {
            const tileColorHex = tile.data[py][px];
            const canvasIdx = (((r * 8) + py) * dimensions.w + ((c * 8) + px)) * 4;
            const canvasR = imgData.data[canvasIdx];
            const canvasG = imgData.data[canvasIdx + 1];
            const canvasB = imgData.data[canvasIdx + 2];
            const canvasA = imgData.data[canvasIdx + 3];

            if (tileColorHex !== null) {
              nonNullCount++;
              const tileColor = hexToRgbLocal(tileColorHex);
              if (canvasA < 128 || !tileColor || Math.abs(canvasR - tileColor.r) > 5 || Math.abs(canvasG - tileColor.g) > 5 || Math.abs(canvasB - tileColor.b) > 5) {
                match = false;
                break;
              }
            } else {
              if (canvasA >= 128) {
                match = false;
                break;
              }
            }
          }
          if (!match) break;
        }

        if (match && nonNullCount > bestScore) {
          bestTile = tile;
          bestTileIdx = tIdx;
          bestScore = nonNullCount;
        }
      }

      matchedTileIndices.push(bestTileIdx);
      matchedTiles.push(bestTile);
    }
  }

  return { matchedTileIndices, matchedTiles };
}

export function canvasToIndexedBmpBlob(canvas, predefinedPalette = null, forceBpp = null) {
  const width = canvas.width;
  const height = canvas.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  const palette = predefinedPalette ? [...predefinedPalette] : [];
  const colorMap = {};

  if (predefinedPalette) {
    predefinedPalette.forEach((c, idx) => {
      colorMap[`${c[0]},${c[1]},${c[2]}`] = idx;
    });
  } else {
    palette.push([255, 0, 255, 0]);
    colorMap['255,0,255'] = 0;
  }

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    if (a < 128) continue;
    const key = `${r},${g},${b}`;
    if (colorMap[key] === undefined) {
      if (!predefinedPalette && palette.length < 256) {
        colorMap[key] = palette.length;
        palette.push([r, g, b, 255]);
      } else {
        let minD = Infinity;
        let nearestIdx = 1;
        for (let j = 1; j < palette.length; j++) {
          const d = Math.pow(r - palette[j][0], 2) + Math.pow(g - palette[j][1], 2) + Math.pow(b - palette[j][2], 2);
          if (d < minD) {
            minD = d; nearestIdx = j;
          }
        }
        colorMap[key] = nearestIdx;
      }
    }
  }

  // Decide bpp based on actual unique color count so the BMP file header
  // matches the bpp_mode/colors_count the caller will write to the JSON.
  // If they disagree, grit produces a sprite item whose tile layout
  // (bytes per tile) doesn't match what the runtime expects, and any
  // later bn::sprite_tiles_ptr lookup ends up in bn_sprite_tiles_manager
  // with mismatched tiles data ("Tiles data does not match item tiles
  // data" in _find_impl).
  let usedColors = 0;
  for (const k in colorMap) {
    if (colorMap[k] > usedColors) usedColors = colorMap[k];
  }
  usedColors += 1;
  const bpp = forceBpp !== null
    ? forceBpp
    : (usedColors > 16 ? 8 : 4);

  // Pad palette to 256 entries with black so the BMP palette table is
  // always the same size regardless of bpp.
  while (palette.length < 256) palette.push([0, 0, 0, 255]);

  const rowSize = (bpp === 4)
    ? Math.floor((Math.ceil(width / 2) + 3) / 4) * 4
    : Math.floor((width + 3) / 4) * 4;
  const pixelDataSize = rowSize * height;
  const fileSize = 54 + 256 * 4 + pixelDataSize;
  const buffer = new ArrayBuffer(fileSize);
  const view = new DataView(buffer);
  view.setUint16(0, 0x4D42, true);
  view.setUint32(2, fileSize, true);
  view.setUint16(6, 0, true);
  view.setUint16(8, 0, true);
  view.setUint32(10, 54 + 256 * 4, true);
  view.setUint32(14, 40, true);
  view.setUint32(18, width, true);
  view.setUint32(22, height, true);
  view.setUint16(26, 1, true);
  view.setUint16(28, bpp, true);
  view.setUint32(30, 0, true);
  view.setUint32(34, pixelDataSize, true);
  view.setUint32(38, 0, true);
  view.setUint32(42, 0, true);
  view.setUint32(46, 256, true);
  view.setUint32(50, 0, true);
  let offset = 54;
  for (let i = 0; i < 256; i++) {
    const c = palette[i];
    view.setUint8(offset, c[2]);
    view.setUint8(offset + 1, c[1]);
    view.setUint8(offset + 2, c[0]);
    view.setUint8(offset + 3, 0);
    offset += 4;
  }

  const colorIdxFor = (idx) => {
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    const a = data[idx + 3];
    if (a < 128) return 0;
    const key = `${r},${g},${b}`;
    return colorMap[key] || 0;
  };

  if (bpp === 4) {
    for (let y = height - 1; y >= 0; y--) {
      const rowOffset = offset + (height - 1 - y) * rowSize;
      for (let x = 0; x < width; x += 2) {
        const hi = colorIdxFor((y * width + x) * 4) & 0x0F;
        const lo = (x + 1 < width)
          ? colorIdxFor((y * width + x + 1) * 4) & 0x0F
          : 0;
        view.setUint8(rowOffset + (x >> 1), (hi << 4) | lo);
      }
    }
  } else {
    for (let y = height - 1; y >= 0; y--) {
      const rowOffset = offset + (height - 1 - y) * rowSize;
      for (let x = 0; x < width; x++) {
        view.setUint8(rowOffset + x, colorIdxFor((y * width + x) * 4));
      }
    }
  }
  return new Blob([buffer], { type: 'image/bmp' });
}

export function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
