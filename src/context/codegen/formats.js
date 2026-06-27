import { getTilesLayoutData as _getTilesLayoutData, compileTilesetCanvas as _compileTilesetCanvas, generateUUID, hexToRgbLocal } from './shared';
import { compress8bitNumberArray } from '../utils';
import JSZip from 'jszip';

const COLLISION_MAPPING = {
  solid: 15, top: 1, left: 4, right: 8, ladder: 16, 'slope-up': 32, 'slope-down': 48,
};

const LEVEL_TYPE_MAPPING = {
  TOPDOWN: 'TOPDOWN', PLATFORMER: 'PLATFORM', METROIDVANIA: 'PLATFORM', 'POINT AND CLICK': 'POINTNCLICK', 'SHOOT EM UP': 'SHMUP', INTRO: 'INTRO', PAUSE: 'PAUSE'
};

const PICO8_PALETTE = [
  { r: 0, g: 0, b: 0 }, { r: 29, g: 43, b: 83 }, { r: 126, g: 37, b: 83 },
  { r: 0, g: 135, b: 81 }, { r: 171, g: 82, b: 54 }, { r: 95, g: 87, b: 79 },
  { r: 194, g: 195, b: 199 }, { r: 255, g: 241, b: 232 }, { r: 255, g: 0, b: 77 },
  { r: 255, g: 163, b: 0 }, { r: 255, g: 236, b: 39 }, { r: 0, g: 228, b: 54 },
  { r: 41, g: 173, b: 255 }, { r: 131, g: 118, b: 156 }, { r: 255, g: 119, b: 168 },
  { r: 255, g: 204, b: 170 },
  { r: 0, g: 8, b: 20 }, { r: 0, g: 53, b: 102 }, { r: 0, g: 180, b: 216 },
  { r: 202, g: 240, b: 248 }
];

const PICO8_COLLISION_MAPPING = {
  solid: 1, top: 2, left: 4, right: 8, ladder: 16, 'slope-up': 32, 'slope-down': 64,
};

const TILED_COLLISION_MAPPING = {
  solid: 'solid', top: 'top', left: 'left', right: 'right',
  ladder: 'ladder', 'slope-up': 'slope-up', 'slope-down': 'slope-down'
};

function getTilesLayoutData(ctx) {
  return _getTilesLayoutData(ctx.ctx, ctx.dimensions, ctx.rows, ctx.cols, ctx.savedTiles);
}

function compileTilesetCanvas(ctx) {
  return _compileTilesetCanvas(ctx.savedTiles);
}

async function generateGbStudio(ctx) {
  const { matchedTiles } = getTilesLayoutData(ctx);
  const collisionArray = [];

  matchedTiles.forEach(tile => {
    const collisionVal = (tile && tile.collisionType && COLLISION_MAPPING[tile.collisionType]) || 0;
    collisionArray.push(collisionVal);
  });

  const collisionsString = compress8bitNumberArray(collisionArray);
  const bgId = generateUUID();
  const sceneId = generateUUID();
  const eventId = generateUUID();

  const backgroundGbsres = {
    _resourceType: 'background',
    id: bgId,
    name: ctx.sanitizedName,
    symbol: `bg_${ctx.sanitizedName}`,
    tileColors: '',
    filename: `${ctx.sanitizedName}.png`,
    width: ctx.cols,
    height: ctx.rows,
    imageWidth: ctx.dimensions.w,
    imageHeight: ctx.dimensions.h
  };

  const mappedType = LEVEL_TYPE_MAPPING[ctx.levelType] || 'TOPDOWN';

  const sceneGbsres = {
    _resourceType: 'scene',
    id: sceneId,
    _index: 0,
    name: ctx.levelName.toUpperCase(),
    backgroundId: bgId,
    tilesetId: '',
    width: ctx.cols,
    height: ctx.rows,
    type: mappedType,
    colorModeOverride: 'none',
    paletteIds: [],
    spritePaletteIds: [],
    collisions: collisionsString,
    autoFadeSpeed: 1,
    symbol: `scene_${ctx.sanitizedName}`,
    x: ctx.sceneWorldX || 200,
    y: ctx.sceneWorldY || 200,
    script: [{ command: 'EVENT_MUSIC_STOP', args: { __collapse: true }, id: eventId }],
    playerHit1Script: [],
    playerHit2Script: [],
    playerHit3Script: [],
    playerSpriteSheetId: '',
    autoFadeEventCollapse: true
  };

  const zip = new JSZip();
  const pngBlob = await new Promise(resolve => ctx.tempCanvas.toBlob(resolve, 'image/png'));

  zip.file(`${ctx.sanitizedName}.png`, pngBlob);
  zip.file(`${ctx.sanitizedName}.gbsres`, JSON.stringify(backgroundGbsres, null, 2));
  zip.file('scene.gbsres', JSON.stringify(sceneGbsres, null, 2));

  return await zip.generateAsync({ type: 'blob' });
}

async function generateTiled(ctx) {
  const { matchedTileIndices } = getTilesLayoutData(ctx);
  const tiledData = matchedTileIndices.map(idx => idx + 1);
  const tiledTiles = [];

  ctx.savedTiles.forEach((tile, index) => {
    if (tile.collisionType && tile.collisionType !== 'none') {
      tiledTiles.push({
        id: index,
        properties: [{
          name: 'collisionType',
          type: 'string',
          value: TILED_COLLISION_MAPPING[tile.collisionType] || tile.collisionType
        }]
      });
    }
  });

  const mapTmj = {
    compressionlevel: -1,
    height: ctx.rows,
    width: ctx.cols,
    infinite: false,
    layers: [{
      data: tiledData,
      height: ctx.rows,
      width: ctx.cols,
      id: 1,
      name: 'Tile Layer 1',
      opacity: 1,
      type: 'tilelayer',
      visible: true,
      x: 0,
      y: 0
    }],
    nextlayerid: 2,
    nextobjectid: 1,
    orientation: 'orthogonal',
    renderorder: 'right-down',
    tiledversion: '1.8.0',
    tilewidth: 8,
    tileheight: 8,
    type: 'map',
    version: '1.8',
    tilesets: [{
      columns: ctx.savedTiles.length,
      firstgid: 1,
      image: 'tileset.png',
      imagewidth: ctx.savedTiles.length * 8,
      imageheight: 8,
      margin: 0,
      name: 'tileset',
      spacing: 0,
      tilecount: ctx.savedTiles.length,
      tiledversion: '1.8.0',
      tilewidth: 8,
      tileheight: 8,
      type: 'tileset',
      version: '1.8',
      tiles: tiledTiles
    }]
  };

  const zip = new JSZip();
  const tilesetCanvas = compileTilesetCanvas(ctx);
  const pngBlob = await new Promise(resolve => tilesetCanvas.toBlob(resolve, 'image/png'));

  zip.file('tileset.png', pngBlob);
  zip.file('map.tmj', JSON.stringify(mapTmj, null, 2));

  return await zip.generateAsync({ type: 'blob' });
}

async function generatePico8(ctx) {
  const { matchedTileIndices } = getTilesLayoutData(ctx);
  const getNearestPico8Color = (hex) => {
    const rgb = hexToRgbLocal(hex);
    if (!rgb) return 0;
    let minDistance = Infinity;
    let nearestIdx = 0;
    for (let i = 0; i < PICO8_PALETTE.length; i++) {
      const p = PICO8_PALETTE[i];
      const dist = Math.sqrt(Math.pow(rgb.r - p.r, 2) + Math.pow(rgb.g - p.g, 2) + Math.pow(rgb.b - p.b, 2));
      if (dist < minDistance) { minDistance = dist; nearestIdx = i; }
    }
    return nearestIdx;
  };

  let gfxLines = [];
  for (let y = 0; y < 128; y++) {
    let line = '';
    for (let x = 0; x < 128; x++) {
      const spriteCol = Math.floor(x / 8);
      const spriteRow = Math.floor(y / 8);
      const spriteId = spriteRow * 16 + spriteCol;
      const px = x % 8;
      const py = y % 8;
      let colorIdx = 0;
      if (spriteId > 0 && (spriteId - 1) < ctx.savedTiles.length) {
        const tile = ctx.savedTiles[spriteId - 1];
        const colorHex = tile.data[py][px];
        if (colorHex) colorIdx = getNearestPico8Color(colorHex);
      }
      line += colorIdx.toString(16);
    }
    gfxLines.push(line);
  }
  const gfxSection = gfxLines.join('\n');

  let gffBytes = [];
  for (let s = 0; s < 256; s++) {
    let val = 0;
    if (s > 0 && (s - 1) < ctx.savedTiles.length) {
      const tile = ctx.savedTiles[s - 1];
      val = (tile.collisionType && PICO8_COLLISION_MAPPING[tile.collisionType]) || 0;
    }
    gffBytes.push(val.toString(16).padStart(2, '0'));
  }
  const gffSection = gffBytes.slice(0, 128).join('') + '\n' + gffBytes.slice(128, 256).join('');

  let mapLines = [];
  for (let r = 0; r < 32; r++) {
    let line = '';
    for (let c = 0; c < 128; c++) {
      let spriteId = 0;
      if (r < ctx.rows && c < ctx.cols) {
        const tileIdx = matchedTileIndices[r * ctx.cols + c];
        if (tileIdx >= 0) spriteId = tileIdx + 1;
      }
      line += spriteId.toString(16).padStart(2, '0');
    }
    mapLines.push(line);
  }
  const mapSection = mapLines.join('\n');

  const p8Content = `pico-8 cartridge // http://www.pico-8.com
version 8
__lua__

__gfx__
${gfxSection}
__gff__
${gffSection}
__map__
${mapSection}
`;

  return new Blob([p8Content], { type: 'text/plain' });
}

async function generateLdtk(ctx) {
  const { matchedTileIndices } = getTilesLayoutData(ctx);
  const customData = [];

  ctx.savedTiles.forEach((tile, index) => {
    if (tile.collisionType && tile.collisionType !== 'none') {
      customData.push({ tileId: index, data: tile.collisionType });
    }
  });

  const gridTiles = [];
  for (let r = 0; r < ctx.rows; r++) {
    for (let c = 0; c < ctx.cols; c++) {
      const tileIdx = matchedTileIndices[r * ctx.cols + c];
      if (tileIdx >= 0) {
        const coordId = c + r * ctx.cols;
        gridTiles.push({
          px: [c * 8, r * 8],
          src: [tileIdx * 8, 0],
          f: 0,
          t: tileIdx,
          d: [coordId]
        });
      }
    }
  }

  const ldtkProject = {
    jsonVersion: '1.5.3',
    iid: generateUUID(),
    worldLayout: 'Free',
    defs: {
      layers: [{
        __type: 'Tiles',
        identifier: 'Tiles',
        type: 'Tiles',
        uid: 1,
        gridSize: 8,
        tilesetDefUid: 100,
        pxOffsetX: 0,
        pxOffsetY: 0
      }],
      entities: [],
      tilesets: [{
        identifier: 'Tileset',
        uid: 100,
        relPath: 'tileset.png',
        pxWidth: ctx.savedTiles.length * 8,
        pxHeight: 8,
        tileGridSize: 8,
        spacing: 0,
        padding: 0,
        tags: [],
        customData: customData,
        savedSelections: [],
        cachedPixelData: null
      }],
      enums: [],
      externalEnums: [],
      levelFields: []
    },
    levels: [{
      identifier: ctx.sanitizedName.toUpperCase(),
      iid: generateUUID(),
      uid: 200,
      pxWid: ctx.dimensions.w,
      pxHei: ctx.dimensions.h,
      worldX: ctx.sceneWorldX || 0,
      worldY: ctx.sceneWorldY || 0,
      layerInstances: [{
        __identifier: 'Tiles',
        __type: 'Tiles',
        __cWid: ctx.cols,
        __cHei: ctx.rows,
        __gridSize: 8,
        __opacity: 1,
        __pxOffsetX: 0,
        __pxOffsetY: 0,
        __tilesetDefUid: 100,
        __tilesetRelPath: 'tileset.png',
        layerDefUid: 1,
        levelId: 200,
        gridTiles: gridTiles
      }]
    }]
  };

  const zip = new JSZip();
  const tilesetCanvas = compileTilesetCanvas(ctx);
  const pngBlob = await new Promise(resolve => tilesetCanvas.toBlob(resolve, 'image/png'));

  zip.file('tileset.png', pngBlob);
  zip.file('project.ldtk', JSON.stringify(ldtkProject, null, 2));

  return await zip.generateAsync({ type: 'blob' });
}

async function generateGodot4(ctx) {
  const { matchedTileIndices } = getTilesLayoutData(ctx);

  const writeInt16LE = (val) => {
    const arr = new Uint8Array(2);
    new DataView(arr.buffer).setInt16(0, val, true);
    return [arr[0], arr[1]];
  };

  const writeUint16LE = (val) => {
    const arr = new Uint8Array(2);
    new DataView(arr.buffer).setUint16(0, val, true);
    return [arr[0], arr[1]];
  };

  const bytes = [];
  for (let r = 0; r < ctx.rows; r++) {
    for (let c = 0; c < ctx.cols; c++) {
      const tileIdx = matchedTileIndices[r * ctx.cols + c];
      if (tileIdx >= 0) {
        bytes.push(...writeInt16LE(c), ...writeInt16LE(r), ...writeUint16LE(0), ...writeUint16LE(tileIdx), ...writeUint16LE(0), ...writeUint16LE(0));
      }
    }
  }

  const tileMapDataStr = bytes.join(', ');
  let atlasTilesDefs = '';
  ctx.savedTiles.forEach((tile, index) => {
    atlasTilesDefs += `${index}:0/0 = 0\n`;
  });

  const tscnContent = `[gd_scene load_steps=4 format=3]

[ext_resource type="Texture2D" path="res://tileset.png" id="1_tileset"]

[sub_resource type="TileSetAtlasSource" id="TileSetAtlasSource_atlas"]
texture = ExtResource("1_tileset")
texture_region_size = Vector2i(8, 8)
${atlasTilesDefs}
[sub_resource type="TileSet" id="TileSet_main"]
tile_size = Vector2i(8, 8)
sources/0 = SubResource("TileSetAtlasSource_atlas")

[node name="Level" type="Node2D"]

[node name="TileMapLayer" type="TileMapLayer" parent="."]
tile_set = SubResource("TileSet_main")
tile_map_data = PackedByteArray(${tileMapDataStr})
`;

  const zip = new JSZip();
  const tilesetCanvas = compileTilesetCanvas(ctx);
  const pngBlob = await new Promise(resolve => tilesetCanvas.toBlob(resolve, 'image/png'));

  zip.file('tileset.png', pngBlob);
  zip.file('level.tscn', tscnContent);

  return await zip.generateAsync({ type: 'blob' });
}

async function generateNesmaker(ctx) {
  const { matchedTileIndices } = getTilesLayoutData(ctx);

  const buffer = new Uint8Array(1024);
  for (let r = 0; r < 30; r++) {
    for (let c = 0; c < 32; c++) {
      const bufferIdx = r * 32 + c;
      if (r < ctx.rows && c < ctx.cols) {
        const tileIdx = matchedTileIndices[r * ctx.cols + c];
        buffer[bufferIdx] = tileIdx >= 0 ? tileIdx : 0;
      } else {
        buffer[bufferIdx] = 0;
      }
    }
  }

  const zip = new JSZip();
  const tilesetCanvas = compileTilesetCanvas(ctx);
  const pngBlob = await new Promise(resolve => tilesetCanvas.toBlob(resolve, 'image/png'));

  zip.file('tileset.png', pngBlob);
  zip.file('screen.nam', buffer);

  return await zip.generateAsync({ type: 'blob' });
}

async function generateGbc(ctx) {
  const { matchedTileIndices } = getTilesLayoutData(ctx);

  const mapBuffer = new Uint8Array(360);
  const attrBuffer = new Uint8Array(360);

  for (let r = 0; r < 18; r++) {
    for (let c = 0; c < 20; c++) {
      const idx = r * 20 + c;
      if (r < ctx.rows && c < ctx.cols) {
        const tileIdx = matchedTileIndices[r * ctx.cols + c];
        mapBuffer[idx] = tileIdx >= 0 ? tileIdx : 0;
      } else {
        mapBuffer[idx] = 0;
      }
      attrBuffer[idx] = 0;
    }
  }

  const zip = new JSZip();
  const tilesetCanvas = compileTilesetCanvas(ctx);
  const pngBlob = await new Promise(resolve => tilesetCanvas.toBlob(resolve, 'image/png'));

  zip.file('tileset.png', pngBlob);
  zip.file('map.bin', mapBuffer);
  zip.file('attr.bin', attrBuffer);

  return await zip.generateAsync({ type: 'blob' });
}

async function generateGenesis(ctx) {
  const { matchedTileIndices } = getTilesLayoutData(ctx);

  const buffer = new Uint8Array(2240);
  for (let r = 0; r < 28; r++) {
    for (let c = 0; c < 40; c++) {
      const cellIdx = r * 40 + c;
      const byteIdx = cellIdx * 2;
      let tileIdx = 0;
      if (r < ctx.rows && c < ctx.cols) {
        const idx = matchedTileIndices[r * ctx.cols + c];
        tileIdx = idx >= 0 ? idx : 0;
      }
      buffer[byteIdx] = (tileIdx >> 8) & 0xff;
      buffer[byteIdx + 1] = tileIdx & 0xff;
    }
  }

  const zip = new JSZip();
  const tilesetCanvas = compileTilesetCanvas(ctx);
  const pngBlob = await new Promise(resolve => tilesetCanvas.toBlob(resolve, 'image/png'));

  zip.file('tileset.png', pngBlob);
  zip.file('map.bin', buffer);

  return await zip.generateAsync({ type: 'blob' });
}

const FORMAT_LABELS = {
  gbstudio: 'GB Studio Scene',
  tiled: 'Tiled Map',
  pico8: 'PICO-8 Cartridge',
  ldtk: 'LDtk Project',
  godot4: 'Godot 4 Scene',
  nesmaker: 'NESmaker Project',
  gbc: 'Game Boy Color Project',
  genesis: 'Sega Genesis Project',
};

const FORMAT_FILENAMES = {
  gbstudio: (name) => `gb-studio-scene-${name}-${Date.now()}.zip`,
  tiled: (name) => `tiled-${name}-${Date.now()}.zip`,
  pico8: (name) => `${name}.p8`,
  ldtk: (name) => `ldtk-${name}-${Date.now()}.zip`,
  godot4: (name) => `godot4-${name}-${Date.now()}.zip`,
  nesmaker: (name) => `nesmaker-${name}-${Date.now()}.zip`,
  gbc: (name) => `gbc-${name}-${Date.now()}.zip`,
  genesis: (name) => `genesis-${name}-${Date.now()}.zip`,
};

export function getFormatLabel(format) {
  return FORMAT_LABELS[format] || 'Export';
}

export function getFormatFilename(format, sanitizedName) {
  return FORMAT_FILENAMES[format](sanitizedName);
}

export async function generateFormat(format, ctx) {
  switch (format) {
    case 'gbstudio': return await generateGbStudio(ctx);
    case 'tiled': return await generateTiled(ctx);
    case 'pico8': return await generatePico8(ctx);
    case 'ldtk': return await generateLdtk(ctx);
    case 'godot4': return await generateGodot4(ctx);
    case 'nesmaker': return await generateNesmaker(ctx);
    case 'gbc': return await generateGbc(ctx);
    case 'genesis': return await generateGenesis(ctx);
    default: throw new Error(`Unknown format: ${format}`);
  }
}
