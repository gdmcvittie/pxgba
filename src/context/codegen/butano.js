import { hexToRgbLocal, canvasToIndexedBmpBlob } from './shared';
import { DEFAULT_16_PALETTE, BUTANO_COLLISION_ENUMS } from '../constants';
import { generateWav } from '../utils';
import { serializeToMod } from '../../utils/modSerializer';
import { autoDeclare, getTriggerScript, getValidSpriteSize, getCharSpriteItemName, fontBytes } from './butano/helpers';
import { generateScriptLogic } from './butano/scriptLogic';

export async function generateButano(ctx) {
  let {
    savedTiles, scenes, activeSceneId, dimensions, actors, globalActors, triggers, collisions,
    variables, animations, customScripts, globalScript, musicTracks,
    layers, frames, levelName, levelType, renderLayersToCtx,
    sanitizedName, cols, rows, tempCanvas, activeScene, sceneWorldX, sceneWorldY,
    hexToRgb, compress8bitNumberArray, parseColorTo32,
    JSZip, startingSceneIdx,
    includeCreditsScene, includedArtists, recentColors, creditsText, creditsBgColor, creditsTextColor, creditsMusicId, creditsEffect,
    hudSettings
  } = ctx;

  scenes = scenes.filter(s => s.type !== 'group');
  
  // Ensure PAUSE scene is always last
  const pauseSceneToMove = scenes.find(s => s.type === 'PAUSE');
  if (pauseSceneToMove) {
    scenes = scenes.filter(s => s.type !== 'PAUSE');
    scenes.push(pauseSceneToMove);
  }
  
  // Recalculate startingSceneIdx after reordering
  const newStartingIdx = scenes.findIndex(s => s.isStarting);
  if (newStartingIdx !== -1) {
    startingSceneIdx = newStartingIdx;
  }
  
  scenes = scenes.map(s => s.type === 'METROIDVANIA' ? { ...s, type: 'PLATFORMER' } : s);

  autoDeclare(variables, customScripts, globalScript, scenes);

      const zip = new JSZip();
      zip.folder("audio");
      zip.folder("dmg_audio");
      zip.folder("graphics");
      zip.folder("include");
      zip.folder("src");

      // Build a global sprite palette from all colors in savedTiles and DEFAULT_16_PALETTE
      const globalSpriteColors = [[255, 0, 255, 0]]; // Magenta for transparent key
      const globalSpriteColorSet = new Set();

      // Pre-calculate defeat colors for all actors across all scenes
      // Add them FIRST to ensure they're always in the palette
      const allActors = [];
      scenes.forEach(s => {
        if (s.type === 'INTRO' || s.type === 'PAUSE') return;
        const sceneGlobalIds = s.globalActorIds || [];
        const scenePositions = s.globalActorPositions || {};
        const sceneGlobalActors = (globalActors || [])
          .filter(a => sceneGlobalIds.includes(a.id) && !(s.type === 'POINTNCLICK' && a.type === 'player'))
          .map(a => {
            const override = scenePositions[a.id];
            return override ? { ...a, x: override.x, y: override.y } : a;
          });
        const sActors = [...sceneGlobalActors, ...(s.actors || [])].filter(a => a.type !== 'group');
        allActors.push(...sActors);
      });

      // Add defeat colors for each actor (up to 255 actors to stay within palette limit)
      const defeatColors = [];
      for (let i = 0; i < Math.min(allActors.length, 255); i++) {
        // HACK: Keep RGB values extremely low (1-20) so the pixel is visually
        // indistinguishable from pitch-black (#000000), hiding it from the player
        // while maintaining the mathematical uniqueness required by the GCC linker.
        const defeatR = 1;
        const defeatG = ((i * 13) % 20) + 1; 
        const defeatB = ((i * 47 + 7) % 20) + 1;
        defeatColors.push([defeatR, defeatG, defeatB, 255]);
        globalSpriteColors.push([defeatR, defeatG, defeatB, 255]);
      }

      // Ensure white is always in the set (for HUD text)
      globalSpriteColorSet.add('255,255,255');

      if (hudSettings && hudSettings.enabled && hudSettings.textColor) {
        const rgb = hexToRgb(hudSettings.textColor);
        if (rgb) {
          globalSpriteColorSet.add(`${rgb.r},${rgb.g},${rgb.b}`);
        }
      }

      savedTiles.forEach(tile => {
        if (tile && tile.data) {
          tile.data.forEach(row => {
            row.forEach(colorHex => {
              if (colorHex) {
                const rgb = hexToRgb(colorHex);
                if (rgb) {
                  globalSpriteColorSet.add(`${rgb.r},${rgb.g},${rgb.b}`);
                }
              }
            });
          });
        }
      });

      DEFAULT_16_PALETTE.forEach(colorHex => {
        const rgb = hexToRgb(colorHex);
        if (rgb) {
          globalSpriteColorSet.add(`${rgb.r},${rgb.g},${rgb.b}`);
        }
      });

      for (const colorStr of globalSpriteColorSet) {
        if (globalSpriteColors.length < 256) {
          const [r, g, b] = colorStr.split(',').map(Number);
          if (r === 255 && g === 0 && b === 255) continue; // skip magenta transparent key
          globalSpriteColors.push([r, g, b, 255]);
        }
      }

      const targetLen = Math.max(16, Math.ceil(globalSpriteColors.length / 16) * 16);
      while (globalSpriteColors.length < targetLen) {
        globalSpriteColors.push([0, 0, 0, 255]);
      }

      let globalBppMode = globalSpriteColors.length > 16 ? "bpp_8" : "bpp_4";
      let globalColorsCount = globalSpriteColors.length;

      let mainCppIncludes = `#include "bn_core.h"\n#include "bn_log.h"\n#include "bn_random.h"\n#include "bn_camera_ptr.h"\n#include "bn_keypad.h"\n#include "bn_optional.h"\n#include "bn_sprite_ptr.h"\n#include "bn_sprite_tiles_ptr.h"\n#include "bn_sprite_palette_ptr.h"\n#include "bn_sprite_affine_mat_ptr.h"\n#include "bn_music.h"\n#include "bn_bg_palettes.h"\n#include "bn_blending.h"\n#include "bn_string_view.h"\n#include "bn_sprite_item.h"\n#include "bn_vector.h"\n`;
      mainCppIncludes += `#include "bn_affine_mat_attributes.h"\n#include "bn_affine_bg_ptr.h"\n#include "bn_regular_bg_ptr.h"\n#include "bn_sram.h"\n`;
      let hasMusic = false;
      if (variables.some(v => v.type === 'string') || scenes.some(s => s.type === 'RACING')) {
        mainCppIncludes += `#include "bn_string.h"\n`;
      }
      if (scenes.some(s => s.type === 'RACING')) {
        mainCppIncludes += `#include "bn_sstream.h"\n`;
      }

      let mainCppDefinitions = `enum class SceneId { ${includeCreditsScene ? 'SCENE_CREDITS, ' : ''}${scenes.map((s, i) => `SCENE_${i}`).join(', ')} };\n\nSceneId paused_from_scene = SceneId::SCENE_${startingSceneIdx};\nconst int pause_scene_idx = ${scenes.findIndex(s => s.type === 'PAUSE')};\n\n`;
      if (variables.some(v => v.type === 'string')) {
        mainCppDefinitions += `struct SaveString {\n`;
        mainCppDefinitions += `    char data[33];\n`;
        mainCppDefinitions += `    SaveString() {\n        data[0] = 0;\n        data[32] = 0;\n    }\n`;
        mainCppDefinitions += `    SaveString(const bn::istring_base& str) {\n        int len = str.size();\n        if (len > 32) len = 32;\n        for (int i = 0; i < len; ++i) data[i] = str[i];\n        data[len] = 0;\n        data[32] = 0;\n    }\n`;
        mainCppDefinitions += `    SaveString(const char* str) {\n        int len = 0;\n        while (str && str[len] && len < 32) { data[len] = str[len]; len++; }\n        data[len] = 0;\n        data[32] = 0;\n    }\n`;
        mainCppDefinitions += `    SaveString& operator=(const bn::istring_base& str) {\n        int len = str.size();\n        if (len > 32) len = 32;\n        for (int i = 0; i < len; ++i) data[i] = str[i];\n        data[len] = 0;\n        data[32] = 0;\n        return *this;\n    }\n`;
        mainCppDefinitions += `    SaveString& operator=(const char* str) {\n        int len = 0;\n        while (str && str[len] && len < 32) { data[len] = str[len]; len++; }\n        data[len] = 0;\n        data[32] = 0;\n        return *this;\n    }\n`;
        mainCppDefinitions += `    operator const char*() const {\n        const_cast<SaveString*>(this)->data[32] = 0;\n        return data;\n    }\n`;
        mainCppDefinitions += `};\n\n`;
      }
      const seenSaveFields = new Set();
      mainCppDefinitions += `struct SaveData {\n`;
      variables.forEach(v => {
        if (v.type === 'group') return;
        const safeVarName = v.name.replace(/[^a-zA-Z0-9_]/g, '_');
        if (seenSaveFields.has(safeVarName)) return;
        seenSaveFields.add(safeVarName);
        if (v.type === 'boolean') {
          mainCppDefinitions += `    bool ${safeVarName};\n`;
        } else if (v.type === 'string') {
          mainCppDefinitions += `    SaveString ${safeVarName};\n`;
        } else if (v.type === 'float') {
          mainCppDefinitions += `    float ${safeVarName};\n`;
        } else if (v.type === 'number' || !v.type) {
          mainCppDefinitions += `    int ${safeVarName};\n`;
        }
      });
      mainCppDefinitions += `    int player_scene;\n    int player_x;\n    int player_y;\n};\n\n`;
      mainCppDefinitions += `int global_spawn_x = -1;\nint global_spawn_y = -1;\n\n`;
      const seenGlobalVars = new Set();
      variables.forEach(v => {
        if (v.type === 'group') return;
        const safeVarName = v.name.replace(/[^a-zA-Z0-9_]/g, '_');
        if (seenGlobalVars.has(safeVarName)) return;
        seenGlobalVars.add(safeVarName);
        if (v.type === 'boolean') {
          mainCppDefinitions += `bool ${safeVarName} = ${v.initialValue ? 'true' : 'false'};\n`;
        } else if (v.type === 'string') {
          const initVal = String(v.initialValue || '').replace(/"/g, '\\"');
          mainCppDefinitions += `bn::string<32> ${safeVarName} = "${initVal}";\n`;
        } else if (v.type === 'float') {
          const floatVal = parseFloat(v.initialValue);
          const safeFloat = isNaN(floatVal) ? 0.0 : floatVal;
          mainCppDefinitions += `float ${safeVarName} = ${safeFloat}f;\n`;
        } else if (v.type === 'number' || !v.type) {
          mainCppDefinitions += `int ${safeVarName} = ${parseInt(v.initialValue) || 0};\n`;
        } else if (v.type === 'random') {
          const min = parseInt(v.min) || 0;
          const max = parseInt(v.max) || 10;
          const range = max - min + 1;
          mainCppDefinitions += `#define ${safeVarName} (${min} + rng.get_int(${range}))\n`;
        }
      });
      // Auto-declare PLAYER_KEYS if there are keys or doors in any scene
      const hasKeysOrDoors = scenes.some(s => {
        const sceneActors = [...(s.actors || []), ...globalActors].filter(a => a && a.type !== 'group');
        return sceneActors.some(a => a.type === 'key' || a.type === 'door');
      });
      if (hasKeysOrDoors && !variables.some(v => v.name === 'PLAYER_KEYS')) {
        mainCppDefinitions += `int PLAYER_KEYS = 0;\n`;
      }
      mainCppDefinitions += '\n';

      mainCppDefinitions += `
bn::optional<bn::sprite_item> get_char_sprite_item(char c) {
    switch(c) {
        case 'a': case 'A': return bn::sprite_items::hud_a;
        case 'b': case 'B': return bn::sprite_items::hud_b;
        case 'c': case 'C': return bn::sprite_items::hud_c;
        case 'd': case 'D': return bn::sprite_items::hud_d;
        case 'e': case 'E': return bn::sprite_items::hud_e;
        case 'f': case 'F': return bn::sprite_items::hud_f;
        case 'g': case 'G': return bn::sprite_items::hud_g;
        case 'h': case 'H': return bn::sprite_items::hud_h;
        case 'i': case 'I': return bn::sprite_items::hud_i;
        case 'j': case 'J': return bn::sprite_items::hud_j;
        case 'k': case 'K': return bn::sprite_items::hud_k;
        case 'l': case 'L': return bn::sprite_items::hud_l;
        case 'm': case 'M': return bn::sprite_items::hud_m;
        case 'n': case 'N': return bn::sprite_items::hud_n;
        case 'o': case 'O': return bn::sprite_items::hud_o;
        case 'p': case 'P': return bn::sprite_items::hud_p;
        case 'q': case 'Q': return bn::sprite_items::hud_q;
        case 'r': case 'R': return bn::sprite_items::hud_r;
        case 's': case 'S': return bn::sprite_items::hud_s;
        case 't': case 'T': return bn::sprite_items::hud_t;
        case 'u': case 'U': return bn::sprite_items::hud_u;
        case 'v': case 'V': return bn::sprite_items::hud_v;
        case 'w': case 'W': return bn::sprite_items::hud_w;
        case 'x': case 'X': return bn::sprite_items::hud_x;
        case 'y': case 'Y': return bn::sprite_items::hud_y;
        case 'z': case 'Z': return bn::sprite_items::hud_z;
        case '0': return bn::sprite_items::hud_0;
        case '1': return bn::sprite_items::hud_1;
        case '2': return bn::sprite_items::hud_2;
        case '3': return bn::sprite_items::hud_3;
        case '4': return bn::sprite_items::hud_4;
        case '5': return bn::sprite_items::hud_5;
        case '6': return bn::sprite_items::hud_6;
        case '7': return bn::sprite_items::hud_7;
        case '8': return bn::sprite_items::hud_8;
        case '9': return bn::sprite_items::hud_9;
        case ':': return bn::sprite_items::hud_colon;
        case '/': return bn::sprite_items::hud_slash;
        case '-': return bn::sprite_items::hud_minus;
        case '+': return bn::sprite_items::hud_plus;
        case '!': return bn::sprite_items::hud_excl;
        case '?': return bn::sprite_items::hud_question;
        case '.': return bn::sprite_items::hud_dot;
        case ',': return bn::sprite_items::hud_comma;
        case '>': return bn::sprite_items::hud_gt;
        default: return bn::nullopt;
    }
}

bn::optional<bn::sprite_item> get_dialog_char_sprite_item(char c) {
    switch(c) {
        case 'a': case 'A': return bn::sprite_items::dialog_hud_a;
        case 'b': case 'B': return bn::sprite_items::dialog_hud_b;
        case 'c': case 'C': return bn::sprite_items::dialog_hud_c;
        case 'd': case 'D': return bn::sprite_items::dialog_hud_d;
        case 'e': case 'E': return bn::sprite_items::dialog_hud_e;
        case 'f': case 'F': return bn::sprite_items::dialog_hud_f;
        case 'g': case 'G': return bn::sprite_items::dialog_hud_g;
        case 'h': case 'H': return bn::sprite_items::dialog_hud_h;
        case 'i': case 'I': return bn::sprite_items::dialog_hud_i;
        case 'j': case 'J': return bn::sprite_items::dialog_hud_j;
        case 'k': case 'K': return bn::sprite_items::dialog_hud_k;
        case 'l': case 'L': return bn::sprite_items::dialog_hud_l;
        case 'm': case 'M': return bn::sprite_items::dialog_hud_m;
        case 'n': case 'N': return bn::sprite_items::dialog_hud_n;
        case 'o': case 'O': return bn::sprite_items::dialog_hud_o;
        case 'p': case 'P': return bn::sprite_items::dialog_hud_p;
        case 'q': case 'Q': return bn::sprite_items::dialog_hud_q;
        case 'r': case 'R': return bn::sprite_items::dialog_hud_r;
        case 's': case 'S': return bn::sprite_items::dialog_hud_s;
        case 't': case 'T': return bn::sprite_items::dialog_hud_t;
        case 'u': case 'U': return bn::sprite_items::dialog_hud_u;
        case 'v': case 'V': return bn::sprite_items::dialog_hud_v;
        case 'w': case 'W': return bn::sprite_items::dialog_hud_w;
        case 'x': case 'X': return bn::sprite_items::dialog_hud_x;
        case 'y': case 'Y': return bn::sprite_items::dialog_hud_y;
        case 'z': case 'Z': return bn::sprite_items::dialog_hud_z;
        case '0': return bn::sprite_items::dialog_hud_0;
        case '1': return bn::sprite_items::dialog_hud_1;
        case '2': return bn::sprite_items::dialog_hud_2;
        case '3': return bn::sprite_items::dialog_hud_3;
        case '4': return bn::sprite_items::dialog_hud_4;
        case '5': return bn::sprite_items::dialog_hud_5;
        case '6': return bn::sprite_items::dialog_hud_6;
        case '7': return bn::sprite_items::dialog_hud_7;
        case '8': return bn::sprite_items::dialog_hud_8;
        case '9': return bn::sprite_items::dialog_hud_9;
        case ':': return bn::sprite_items::dialog_hud_colon;
        case '/': return bn::sprite_items::dialog_hud_slash;
        case '-': return bn::sprite_items::dialog_hud_minus;
        case '+': return bn::sprite_items::dialog_hud_plus;
        case '!': return bn::sprite_items::dialog_hud_excl;
        case '?': return bn::sprite_items::dialog_hud_question;
        case '.': return bn::sprite_items::dialog_hud_dot;
        case ',': return bn::sprite_items::dialog_hud_comma;
        case '>': return bn::sprite_items::dialog_hud_gt;
        default: return bn::nullopt;
    }
}

void show_dialog_text(const bn::string_view& text, bn::vector<bn::sprite_ptr, 128>& text_sprites, const bn::sprite_palette_ptr& palette, int speed = 0) {
    int start_x = -110;
    int start_y = 26;
    int cur_x = start_x;
    int cur_y = start_y;
    
    if (speed <= 0) {
        for (char c : text) {
            if (c == '\\n') {
                cur_x = start_x;
                cur_y += 14;
                continue;
            }
            if (c == ' ') {
                cur_x += 8;
                continue;
            }
            auto item_opt = get_dialog_char_sprite_item(c);
            if (item_opt) {
                if (text_sprites.size() < text_sprites.max_size()) {
                    bn::sprite_ptr sprite = item_opt->create_sprite(cur_x, cur_y);
                    sprite.set_palette(palette);
                    sprite.set_bg_priority(0);
                    sprite.set_z_order(-32767);
                    text_sprites.push_back(sprite);
                }
                cur_x += 8;
            }
        }
    } else {
        for (char c : text) {
            if (c == '\\n') {
                cur_x = start_x;
                cur_y += 14;
                continue;
            }
            if (c == ' ') {
                cur_x += 8;
                continue;
            }
            auto item_opt = get_dialog_char_sprite_item(c);
            if (item_opt) {
                if (text_sprites.size() < text_sprites.max_size()) {
                    bn::sprite_ptr sprite = item_opt->create_sprite(cur_x, cur_y);
                    sprite.set_palette(palette);
                    sprite.set_bg_priority(0);
                    sprite.set_z_order(-32767);
                    text_sprites.push_back(sprite);
                }
                cur_x += 8;
            }
            for (int w = 0; w < speed; w++) {
                bn::core::update();
            }
        }
    }
}

`;

      const generatedSounds = new Set();
      const generatedProjectiles = new Set();

      // Export pause scene background as overlay
      const pauseScene = scenes.find(s => s.type === 'PAUSE');
      const pauseSceneIdx = scenes.indexOf(pauseScene);
      if (pauseScene) {
        const pauseDims = pauseScene.dimensions || { w: 256, h: 256 };
        const pauseFrames = pauseScene.frames || [];
        const pauseRawLayers = pauseFrames[0]?.layers || [];
        const pauseLayer = pauseRawLayers.find(l => l.type === 'layer' && l.visible && !l.groupId);
        if (pauseLayer && pauseLayer.data) {
          const pauseCanvas = document.createElement('canvas');
          pauseCanvas.width = 256;
          pauseCanvas.height = 256;
          const pauseCtx = pauseCanvas.getContext('2d', { willReadFrequently: true });
          for (let y = 0; y < 256; y++) {
            for (let x = 0; x < 256; x++) {
              const color = pauseLayer.data[y]?.[x];
              if (color) {
                pauseCtx.fillStyle = color;
                pauseCtx.fillRect(x, y, 1, 1);
              }
            }
          }
          const pauseColors = [[255, 0, 255, 0]];
          const pauseColorSet = new Set();
          const pauseImgData = pauseCtx.getImageData(0, 0, 256, 256);
          for (let i = 0; i < pauseImgData.data.length; i += 4) {
            if (pauseImgData.data[i + 3] < 128) continue;
            const r = pauseImgData.data[i];
            const g = pauseImgData.data[i + 1];
            const b = pauseImgData.data[i + 2];
            const key = `${r},${g},${b}`;
            if (!pauseColorSet.has(key)) {
              pauseColorSet.add(key);
              if (pauseColors.length < 256) {
                pauseColors.push([r, g, b, 255]);
              }
            }
          }
          const pauseBmpBlob = canvasToIndexedBmpBlob(pauseCanvas, pauseColors);
          zip.file('graphics/pause_overlay_bg.bmp', pauseBmpBlob);
          zip.file('graphics/pause_overlay_bg.json', JSON.stringify({
            type: "regular_bg",
            bpp_mode: pauseColors.length > 16 ? "bpp_8" : "bpp_4"
          }, null, 2));
          mainCppIncludes += `#include "bn_regular_bg_items_pause_overlay_bg.h"\n`;
        }
      }

      // Generate countdown digit sprites for racing scenes
      const hasRacingCountdown = scenes.some(s => s.type === 'RACING' && s.showCountdown);
      if (hasRacingCountdown) {
        // Generate large countdown digits (1, 2, 3) at 64x64 pixels
        for (let digit = 1; digit <= 3; digit++) {
          const countdownCanvas = document.createElement('canvas');
          countdownCanvas.width = 64;
          countdownCanvas.height = 64;
          const countdownCtx = countdownCanvas.getContext('2d');
          countdownCtx.clearRect(0, 0, 64, 64);
          
          countdownCtx.font = 'bold 56px monospace';
          countdownCtx.textAlign = 'center';
          countdownCtx.textBaseline = 'middle';
          countdownCtx.lineJoin = 'round';
          countdownCtx.miterLimit = 2;
          
          // Stroke (outline) in thick black
          countdownCtx.strokeStyle = '#000000';
          countdownCtx.lineWidth = 8;
          countdownCtx.strokeText(digit.toString(), 32, 32);
          
          // Fill in white
          countdownCtx.fillStyle = '#ffffff';
          countdownCtx.fillText(digit.toString(), 32, 32);
          
          const countdownBmpBlob = canvasToIndexedBmpBlob(countdownCanvas, [[255, 0, 255, 0], [0, 0, 0, 255], [255, 255, 255, 255]]);
          zip.file(`graphics/countdown_${digit}_sprite.bmp`, countdownBmpBlob);
          zip.file(`graphics/countdown_${digit}_sprite.json`, JSON.stringify({
            type: "sprite",
            width: 64,
            height: 64,
            bpp_mode: "bpp_4"
          }, null, 2));
        }
        mainCppIncludes += `#include "bn_sprite_items_countdown_1_sprite.h"\n`;
        mainCppIncludes += `#include "bn_sprite_items_countdown_2_sprite.h"\n`;
        mainCppIncludes += `#include "bn_sprite_items_countdown_3_sprite.h"\n`;
      }

      // Ensure pause_overlay_bg is available for racing countdown
      if (hasRacingCountdown && !pauseScene) {
        // Create a simple dark overlay for countdown if no pause scene exists
        const countdownCanvas = document.createElement('canvas');
        countdownCanvas.width = 256;
        countdownCanvas.height = 256;
        const countdownCtx = countdownCanvas.getContext('2d');
        countdownCtx.fillStyle = '#000000';
        countdownCtx.fillRect(0, 0, 256, 256);
        const countdownBmpBlob = canvasToIndexedBmpBlob(countdownCanvas, [[0, 0, 0, 255], [255, 0, 255, 0]]);
        zip.file('graphics/pause_overlay_bg.bmp', countdownBmpBlob);
        zip.file('graphics/pause_overlay_bg.json', JSON.stringify({
          type: "regular_bg",
          bpp_mode: "bpp_4"
        }, null, 2));
        mainCppIncludes += `#include "bn_regular_bg_items_pause_overlay_bg.h"\n`;
      }

      let currentSceneIdx = 0;
      for (let sIdx = 0; sIdx < scenes.length; sIdx++) {
        currentSceneIdx = sIdx;
        const scene = scenes[sIdx];
        const isActive = scene.id === activeSceneId;
        const sDims = isActive ? dimensions : (scene.dimensions || { w: 240, h: 160 });
        const sceneGlobalIds = scene.globalActorIds || [];
        const scenePositions = scene.globalActorPositions || {};
        const sceneGlobalActors = (globalActors || [])
          .filter(a => sceneGlobalIds.includes(a.id) && !(scene.type === 'POINTNCLICK' && a.type === 'player'))
          .map(a => {
            const override = scenePositions[a.id];
            return override ? { ...a, x: override.x, y: override.y } : a;
          });
        const sActors = [...sceneGlobalActors, ...(isActive ? actors : (scene.actors || []))].filter(a => a.type !== 'group' && scene.type !== 'INTRO' && scene.type !== 'PAUSE');
        const sTriggers = isActive ? triggers : (scene.triggers || []);
        const sCollisions = isActive ? collisions : (scene.collisions || []);
        const safeSceneName = `scene_${sIdx}`;
        const cols = Math.floor(sDims.w / 8);
        const rows = Math.floor(sDims.h / 8);

        if ((scene.type === 'RACING' || scene.type === 'SHMUP') && scene.mode7) {
          mainCppIncludes += `#include "bn_math.h"\n`;
          mainCppIncludes += `#include "bn_display.h"\n`;
          mainCppIncludes += `#include "bn_affine_bg_pa_register_hbe_ptr.h"\n`;
          mainCppIncludes += `#include "bn_affine_bg_pc_register_hbe_ptr.h"\n`;
          mainCppIncludes += `#include "bn_affine_bg_dx_register_hbe_ptr.h"\n`;
          mainCppIncludes += `#include "bn_affine_bg_dy_register_hbe_ptr.h"\n`;
        }

        let bgPriority = (hudSettings && hudSettings.enabled) ? 2 : 1;
        let bgDeclarations = '';
        let bgLogic = '';

        let sceneFrames = isActive ? frames : scene.frames;
        if (!sceneFrames || sceneFrames.length === 0) {
          sceneFrames = [{ id: 'frame-1', layers: isActive ? layers : (scene.layers || []) }];
        }

        const rawLayers = isActive ? layers : sceneFrames[0].layers;
        const currentLayers = [];
        for (let li = 0; li < rawLayers.length; li++) {
          const l = rawLayers[li];
          if (l.type === 'group') {
            if (!l.visible) continue;
            const groupChildren = rawLayers.filter(cl => cl && cl.groupId === l.id && cl.type !== 'group' && cl.visible);
            if (groupChildren.length === 0) continue;
            const mCanvas = document.createElement('canvas');
            mCanvas.width = sDims.w;
            mCanvas.height = sDims.h;
            const mCtx = mCanvas.getContext('2d', { willReadFrequently: true });
            renderLayersToCtx(mCtx, 1, groupChildren, sDims);
            const mImgData = mCtx.getImageData(0, 0, sDims.w, sDims.h);
            const mPixels = mImgData.data;
            const mergedData = Array.from({ length: sDims.h }, () => Array(sDims.w).fill(null));
            for (let my = 0; my < sDims.h; my++) {
              for (let mx = 0; mx < sDims.w; mx++) {
                const mi = (my * sDims.w + mx) * 4;
                if (mPixels[mi + 3] > 0) {
                  const mr = mPixels[mi].toString(16).padStart(2, '0');
                  const mg = mPixels[mi + 1].toString(16).padStart(2, '0');
                  const mb = mPixels[mi + 2].toString(16).padStart(2, '0');
                  mergedData[my][mx] = `#${mr}${mg}${mb}`;
                }
              }
            }
            currentLayers.push({
              id: l.id,
              type: 'layer',
              name: l.name,
              visible: true,
              groupId: null,
              data: mergedData,
              parallax: l.parallax,
              parallaxX: l.parallaxX,
              parallaxY: l.parallaxY,
              affine: l.affine,
              mode7: l.mode7,
              scaleX: l.scaleX,
              scaleY: l.scaleY,
              rotation: l.rotation,
              opacity: l.opacity,
              blendMode: l.blendMode
            });
          } else if (!l.groupId) {
            currentLayers.push(l);
          }
        }
        const specialLayers = [];
        const normalLayers = [];

        currentLayers.forEach(l => {
          if (l.type === 'group' || !l.visible) return;
          if (l.groupId) {
            const parentGroup = currentLayers.find(g => g && g.id === l.groupId);
            if (parentGroup && !parentGroup.visible) return;
          }

          if (l.parallax || l.affine) {
            specialLayers.push(l);
          } else {
            normalLayers.push(l);
          }
        });

        // Do not reverse specialLayers to keep the natural front-to-back order (foreground to background)

        // Build shared palette for the scene backgrounds
        // First pass: add colors from savedTiles for stable palette ordering
        // so existing tile colors keep the same palette indices across exports
        const sceneColors = [[255, 0, 255, 0]]; // Magenta as transparent key
        const colorSet = new Set();

        savedTiles.forEach(tile => {
          if (tile && tile.data) {
            tile.data.forEach(row => {
              row.forEach(colorHex => {
                if (colorHex) {
                  const rgb = hexToRgb(colorHex);
                  if (rgb) {
                    const key = `${rgb.r},${rgb.g},${rgb.b}`;
                    if (!colorSet.has(key) && sceneColors.length < 256) {
                      colorSet.add(key);
                      sceneColors.push([rgb.r, rgb.g, rgb.b, 255]);
                    }
                  }
                }
              });
            });
          }
        });

        if (!colorSet.has('0,0,0') && sceneColors.length < 256) {
          colorSet.add('0,0,0');
          sceneColors.push([0, 0, 0, 255]);
        }
        if (!colorSet.has('255,255,255') && sceneColors.length < 256) {
          colorSet.add('255,255,255');
          sceneColors.push([255, 255, 255, 255]);
        }

        // Second pass: add any additional colors from the rendered scene layers
        const addCanvasColors = (canvas) => {
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imgData.data;
          for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] < 128) continue;
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const key = `${r},${g},${b}`;
            if (!colorSet.has(key)) {
              colorSet.add(key);
              if (sceneColors.length < 256) {
                sceneColors.push([r, g, b, 255]);
              }
            }
          }
        };

        const scanW = Math.max(256, Math.ceil(sDims.w / 256) * 256);
        const scanH = Math.max(256, Math.ceil(sDims.h / 256) * 256);

        if (normalLayers.length > 0) {
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = scanW;
          tempCanvas.height = scanH;
          const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
          renderLayersToCtx(tempCtx, 1, normalLayers, sDims);
          addCanvasColors(tempCanvas);
        }

        specialLayers.forEach(sl => {
          if (!sl.affine) {
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = scanW;
            tempCanvas.height = scanH;
            const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
            renderLayersToCtx(tempCtx, 1, [sl], sDims);
            addCanvasColors(tempCanvas);
          }
        });

        const hasBgs = normalLayers.length > 0 || specialLayers.some(sl => !sl.affine) || ((scene.type === 'RACING' || scene.type === 'SHMUP') && scene.mode7);
        let bgBppMode = "bpp_4";
        if (hasBgs) {
          const palCanvas = document.createElement('canvas');
          palCanvas.width = 16;
          palCanvas.height = 16;
          const palCtx = palCanvas.getContext('2d', { willReadFrequently: true });
          const palImgData = palCtx.createImageData(16, 16);
          for (let i = 0; i < sceneColors.length; i++) {
            const c = sceneColors[i];
            palImgData.data[i * 4] = c[0];
            palImgData.data[i * 4 + 1] = c[1];
            palImgData.data[i * 4 + 2] = c[2];
            palImgData.data[i * 4 + 3] = c[3] !== undefined ? c[3] : 255;
          }
          palCtx.putImageData(palImgData, 0, 0);
          const palBmpBlob = canvasToIndexedBmpBlob(palCanvas, sceneColors);
          zip.file(`graphics/${safeSceneName}_palette.bmp`, palBmpBlob);
          bgBppMode = sceneColors.length > 16 ? "bpp_8" : "bpp_4";
          zip.file(`graphics/${safeSceneName}_palette.json`, JSON.stringify({
            type: "bg_palette",
            bpp_mode: bgBppMode,
            colors_count: bgBppMode === "bpp_8" ? Math.min(256, sceneColors.length) : Math.min(256, Math.max(16, Math.ceil(sceneColors.length / 16) * 16))
          }, null, 2));
        }

        if (normalLayers.length > 0) {

          const paddedW = Math.max(256, Math.ceil(sDims.w / 256) * 256);
          const paddedH = Math.max(256, Math.ceil(sDims.h / 256) * 256);
          const paddedCols = Math.floor(paddedW / 8);
          const paddedRows = Math.floor(paddedH / 8);

          const offCanvas = document.createElement('canvas');
          offCanvas.width = paddedW;
          offCanvas.height = paddedH;
          const offCtx = offCanvas.getContext('2d', { willReadFrequently: true });
          renderLayersToCtx(offCtx, 1, normalLayers, sDims);

          const collisionArray = new Array(paddedRows * paddedCols).fill('collision_type::NONE');

          sCollisions.forEach(col => {
            if (col.isGroup) return;
            const parentGroup = col.groupId ? sCollisions.find(g => g && g.id === col.groupId) : null;
            const effectiveType = parentGroup ? (parentGroup.type || col.type) : col.type;
            const startX = Math.floor(col.x / 8);
            const startY = Math.floor(col.y / 8);
            const endX = Math.floor((col.x + col.width) / 8);
            const endY = Math.floor((col.y + col.height) / 8);
            for (let y = startY; y < endY; y++) {
              for (let x = startX; x < endX; x++) {
                if (x >= 0 && x < paddedCols && y >= 0 && y < paddedRows) {
                  collisionArray[y * paddedCols + x] = `collision_type::${BUTANO_COLLISION_ENUMS[effectiveType || 'solid'] || 'SOLID'}`;
                }
              }
            }
          });

          const collisionsH = `#ifndef ${safeSceneName.toUpperCase()}_COLLISIONS_H\n#define ${safeSceneName.toUpperCase()}_COLLISIONS_H\n#include "bn_common.h"\nnamespace ${safeSceneName}_map {\n    constexpr int columns = ${paddedCols};\n    constexpr int rows = ${paddedRows};\n    enum class collision_type : uint8_t { NONE = 0, SOLID = 1, TOP = 2, BOTTOM = 3, LEFT = 4, RIGHT = 5, LADDER = 6, SLOPE_UP = 7, SLOPE_DOWN = 8 };\n    constexpr collision_type collisions[] = {\n        ${collisionArray.join(', ')}\n    };\n    inline collision_type get_collision(int x, int y) {\n        if(x < 0 || x >= columns || y < 0 || y >= rows) return collision_type::SOLID;\n        return collisions[y * columns + x];\n    }\n}\n#endif\n`;
          zip.file(`include/${safeSceneName}_collisions.h`, collisionsH);
          mainCppIncludes += `#include "${safeSceneName}_collisions.h"\n`;

          const bmpBlob = canvasToIndexedBmpBlob(offCanvas, sceneColors);
          zip.file(`graphics/${safeSceneName}_bg.bmp`, bmpBlob);
          zip.file(`graphics/${safeSceneName}_bg.json`, JSON.stringify({
            type: "regular_bg",
            bpp_mode: bgBppMode,
            palette_item: `${safeSceneName}_palette`
          }, null, 2));
          mainCppIncludes += `#include "bn_regular_bg_items_${safeSceneName}_bg.h"\n`;

          if (!((scene.type === 'RACING' || scene.type === 'SHMUP') && scene.mode7)) {
            bgDeclarations += `    bn::regular_bg_ptr base_bg = bn::regular_bg_items::${safeSceneName}_bg.create_bg(0, 0);\n`;
            bgDeclarations += `    base_bg.set_camera(camera);\n    base_bg.set_priority(${bgPriority});\n`;
          }
          bgPriority++;
          if (bgPriority > 3) bgPriority = 3;
        } else {
          const paddedW = Math.max(256, Math.ceil(sDims.w / 256) * 256);
          const paddedH = Math.max(256, Math.ceil(sDims.h / 256) * 256);
          const paddedCols = Math.floor(paddedW / 8);
          const paddedRows = Math.floor(paddedH / 8);
          const collisionArray = new Array(paddedRows * paddedCols).fill('collision_type::NONE');

          sCollisions.forEach(col => {
            if (col.isGroup) return;
            const parentGroup = col.groupId ? sCollisions.find(g => g && g.id === col.groupId) : null;
            const effectiveType = parentGroup ? (parentGroup.type || col.type) : col.type;
            const startX = Math.floor(col.x / 8);
            const startY = Math.floor(col.y / 8);
            const endX = Math.floor((col.x + col.width) / 8);
            const endY = Math.floor((col.y + col.height) / 8);
            for (let y = startY; y < endY; y++) {
              for (let x = startX; x < endX; x++) {
                if (x >= 0 && x < paddedCols && y >= 0 && y < paddedRows) {
                  collisionArray[y * paddedCols + x] = `collision_type::${BUTANO_COLLISION_ENUMS[effectiveType || 'solid'] || 'SOLID'}`;
                }
              }
            }
          });

          const collisionsH = `#ifndef ${safeSceneName.toUpperCase()}_COLLISIONS_H\n#define ${safeSceneName.toUpperCase()}_COLLISIONS_H\n#include "bn_common.h"\nnamespace ${safeSceneName}_map {\n    constexpr int columns = ${paddedCols};\n    constexpr int rows = ${paddedRows};\n    enum class collision_type : uint8_t { NONE = 0, SOLID = 1, TOP = 2, BOTTOM = 3, LEFT = 4, RIGHT = 5, LADDER = 6, SLOPE_UP = 7, SLOPE_DOWN = 8 };\n    constexpr collision_type collisions[] = {\n        ${collisionArray.join(', ')}\n    };\n    inline collision_type get_collision(int x, int y) {\n        if(x < 0 || x >= columns || y < 0 || y >= rows) return collision_type::SOLID;\n        return collisions[y * columns + x];\n    }\n}\n#endif\n`;
          zip.file(`include/${safeSceneName}_collisions.h`, collisionsH);
          mainCppIncludes += `#include "${safeSceneName}_collisions.h"\n`;
        }

        let m7LayerAssigned = false;
        let m7TexW = 256;
        let m7TexH = 256;
        let m7ContentW = 256;
        let m7ContentH = 256;
        for (let i = 0; i < specialLayers.length; i++) {
          const sl = specialLayers[i];
          const paddedW = Math.max(256, Math.ceil(sDims.w / 256) * 256);
          const paddedH = Math.max(256, Math.ceil(sDims.h / 256) * 256);
          const offCanvas = document.createElement('canvas');
          offCanvas.width = paddedW;
          offCanvas.height = paddedH;
          const offCtx = offCanvas.getContext('2d', { willReadFrequently: true });
          renderLayersToCtx(offCtx, 1, [sl], sDims);
          if (sl.mode7) {
            // Tile content vertically into padded area so camera wrapping
            // lands on road pixels rather than a solid grass block
            const contH = sDims.h;
            if (paddedH > contH) {
              const tempC = document.createElement('canvas');
              tempC.width = paddedW;
              tempC.height = contH;
              const tempCtx = tempC.getContext('2d');
              tempCtx.drawImage(offCanvas, 0, 0, paddedW, contH, 0, 0, paddedW, contH);
              for (let dstY = contH; dstY < paddedH; dstY += contH) {
                const copyH = Math.min(contH, paddedH - dstY);
                offCtx.drawImage(tempC, 0, 0, paddedW, copyH, 0, dstY, paddedW, copyH);
              }
            }
            // Fill any remaining transparent pixels (horizontal padding, gaps)
            const fD = offCtx.getImageData(0, 0, paddedW, paddedH);
            const fP = fD.data;
            for (let p = 0; p < fP.length; p += 4) {
              if (fP[p + 3] < 128) {
                fP[p] = 74; fP[p+1] = 117; fP[p+2] = 44; fP[p+3] = 255;
              }
            }
            offCtx.putImageData(fD, 0, 0);
          }
          const bmpBlob = canvasToIndexedBmpBlob(offCanvas, sl.affine ? null : sceneColors);

          const slName = `${safeSceneName}_sl_${i}`;
          zip.file(`graphics/${slName}.bmp`, bmpBlob);

          if (sl.affine) {
            const ctx7 = offCanvas.getContext('2d', { willReadFrequently: true });
            const img7 = ctx7.getImageData(0, 0, offCanvas.width, offCanvas.height);
            const d7 = img7.data;
            const unique7 = new Set();
            for (let p = 0; p < d7.length; p += 4) {
              if (d7[p + 3] < 128) continue;
              unique7.add(`${d7[p]},${d7[p+1]},${d7[p+2]}`);
            }
            const colorsCount = Math.min(256, Math.max(1, unique7.size + 1));
            zip.file(`graphics/${slName}.json`, JSON.stringify({ type: "affine_bg", colors_count: colorsCount }, null, 2));
            mainCppIncludes += `#include "bn_affine_bg_items_${slName}.h"\n`;
            if ((scene.type === 'RACING' || scene.type === 'SHMUP') && scene.mode7 && sl.mode7 && !m7LayerAssigned) {
              bgDeclarations += `    bn::affine_bg_ptr bg_mode7 = bn::affine_bg_items::${slName}.create_bg(-376, -336);\n`;
              bgDeclarations += `    bg_mode7.set_priority(0);\n`;
              m7LayerAssigned = true;
              m7TexW = paddedW;
              m7TexH = paddedH;
              m7ContentW = sDims.w;
              m7ContentH = sDims.h;
            } else {
              bgDeclarations += `    bn::affine_bg_ptr bg_${i} = bn::affine_bg_items::${slName}.create_bg(0, 0);\n`;
              bgDeclarations += `    bg_${i}.set_camera(camera);\n    bg_${i}.set_priority(${bgPriority});\n`;

              const scaleX = sl.scaleX ?? 1;
              const scaleY = sl.scaleY ?? 1;
              const rotation = sl.rotation ?? 0;

              bgDeclarations += `    bn::affine_mat_attributes mat_attr_${i};\n`;
              bgDeclarations += `    mat_attr_${i}.set_scale(${scaleX}, ${scaleY});\n`;
              bgDeclarations += `    mat_attr_${i}.set_rotation_angle(${rotation});\n`;
              bgDeclarations += `    bg_${i}.set_mat_attributes(mat_attr_${i});\n`;
            }
          } else {
            zip.file(`graphics/${slName}.json`, JSON.stringify({
              type: "regular_bg",
              bpp_mode: bgBppMode,
              palette_item: `${safeSceneName}_palette`
            }, null, 2));
            mainCppIncludes += `#include "bn_regular_bg_items_${slName}.h"\n`;
            bgDeclarations += `    bn::regular_bg_ptr bg_${i} = bn::regular_bg_items::${slName}.create_bg(0, 0);\n`;
            if ((scene.type === 'RACING' || scene.type === 'SHMUP') && scene.mode7) {
              bgDeclarations += `    bg_${i}.set_priority(0);\n`;
            } else {
              bgDeclarations += `    bg_${i}.set_camera(camera);\n    bg_${i}.set_priority(${bgPriority});\n`;
            }
          }

          if (sl.parallax) {
            const px = sl.parallaxX ?? 1;
            const py = sl.parallaxY ?? 1;
            if ((scene.type === 'RACING' || scene.type === 'SHMUP') && scene.mode7) {
              bgLogic += `        bg_${i}.set_x(-m7_cam_x * (bn::fixed(1) - bn::fixed(${px})));\n`;
              bgLogic += `        bg_${i}.set_y(-m7_cam_z * (bn::fixed(1) - bn::fixed(${py})));\n`;
            } else {
              bgLogic += `        bg_${i}.set_x(camera.x() * bn::fixed(${px}));\n`;
              bgLogic += `        bg_${i}.set_y(camera.y() * bn::fixed(${py}));\n`;
            }
          }

          bgPriority++;
          if (bgPriority > 3) bgPriority = 3;
        }

        if ((scene.type === 'RACING' || scene.type === 'SHMUP') && scene.mode7) {
          let hasMode7Bg = bgDeclarations.includes('bg_mode7');
          if (!hasMode7Bg) {
            function hexToRgba(h) { return [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16), 255]; }
            const m7HexColors = ['#4a752c','#5c8a36','#3d6423','#6b9a3e','#555555','#666666','#444444','#777777','#ffffff','#cccccc'];
            const m7Colors = m7HexColors.map(hexToRgba);
            const m7Canvas = document.createElement('canvas');
            m7Canvas.width = 256;
            m7Canvas.height = 256;
            const m7Ctx = m7Canvas.getContext('2d');
            for (let py = 0; py < 256; py++) {
              for (let px = 0; px < 256; px++) {
                let ci;
                const roadCenter = 128;
                const roadWidth = 48;
                const roadLeft = roadCenter - roadWidth;
                const roadRight = roadCenter + roadWidth;
                if (px >= roadLeft && px <= roadRight) {
                  const dash = Math.floor(py / 16) % 2;
                  if (px >= roadCenter - 2 && px <= roadCenter + 2 && dash === 0) {
                    ci = 8;
                  } else if (px >= roadLeft && px < roadLeft + 4) {
                    ci = 4;
                  } else if (px > roadRight - 4 && px <= roadRight) {
                    ci = 4;
                  } else {
                    ci = 7;
                  }
                } else if ((px - roadCenter) * (px - roadCenter) + (py - 128) * (py - 128) < 400) {
                  ci = 9;
                } else {
                  const check = (Math.floor(px / 16) + Math.floor(py / 16)) % 2;
                  ci = check === 0 ? 0 : 1;
                }
                m7Ctx.fillStyle = m7HexColors[ci];
                m7Ctx.fillRect(px, py, 1, 1);
              }
            }
            const m7BmpBlob = canvasToIndexedBmpBlob(m7Canvas, m7Colors);
            const m7Name = `${safeSceneName}_m7_road`;
            zip.file(`graphics/${m7Name}.bmp`, m7BmpBlob);
            zip.file(`graphics/${m7Name}.json`, JSON.stringify({ type: "affine_bg", colors_count: m7Colors.length }, null, 2));
            mainCppIncludes += `#include "bn_affine_bg_items_${m7Name}.h"\n`;
            bgDeclarations += `    bn::affine_bg_ptr bg_mode7 = bn::affine_bg_items::${m7Name}.create_bg(-376, -336);\n`;
            bgDeclarations += `    bg_mode7.set_priority(0);\n`;
          }

          bgDeclarations += `    int16_t m7_pa_values[bn::display::height()];\n`;
          bgDeclarations += `    bn::affine_bg_pa_register_hbe_ptr m7_pa_hbe = bn::affine_bg_pa_register_hbe_ptr::create(bg_mode7, m7_pa_values);\n`;
          bgDeclarations += `    int16_t m7_pc_values[bn::display::height()];\n`;
          bgDeclarations += `    bn::affine_bg_pc_register_hbe_ptr m7_pc_hbe = bn::affine_bg_pc_register_hbe_ptr::create(bg_mode7, m7_pc_values);\n`;
          bgDeclarations += `    int m7_dx_values[bn::display::height()];\n`;
          bgDeclarations += `    bn::affine_bg_dx_register_hbe_ptr m7_dx_hbe = bn::affine_bg_dx_register_hbe_ptr::create(bg_mode7, m7_dx_values);\n`;
          bgDeclarations += `    int m7_dy_values[bn::display::height()];\n`;
          bgDeclarations += `    bn::affine_bg_dy_register_hbe_ptr m7_dy_hbe = bn::affine_bg_dy_register_hbe_ptr::create(bg_mode7, m7_dy_values);\n`;
          const m7PlayerActor = sActors.find(a => a && a.type === 'player');
          const m7DefaultPhi = (scene.mode7Phi != null && scene.mode7Phi !== 1024) ? scene.mode7Phi : 0;
          const isShmup = scene.type === 'SHMUP';
          let m7StartX, m7StartZ, m7StartY, m7StartPhi;
          if (m7LayerAssigned && !m7PlayerActor) {
            const m7cols = m7ContentW / 8;
            const m7rows = m7ContentH / 8;
            const m7cx = m7cols / 2;
            const m7cy = m7rows / 2;
            const m7rx = Math.max(m7cols * 0.35, 4);
            const m7noise = 0.25 * Math.sin(1.2) * Math.sin(0.5);
            const m7targetR = m7rx * (1 + m7noise);
            m7StartX = Math.floor((m7cx + m7targetR) * 8);
            m7StartZ = Math.floor(m7cy * 8);
            m7StartY = isShmup ? 144 : 48;
            m7StartPhi = m7DefaultPhi;
          } else if (m7PlayerActor) {
            m7StartX = Math.floor(m7PlayerActor.x);
            m7StartZ = Math.floor(m7PlayerActor.y);
            m7StartY = isShmup ? 144 : 48;
            m7StartPhi = m7DefaultPhi;
          } else {
            m7StartX = 128;
            m7StartZ = 128;
            m7StartY = isShmup ? 144 : 48;
            m7StartPhi = 0;
          }
          bgDeclarations += `    bn::fixed m7_cam_x = ${m7StartX};\n`;
          bgDeclarations += `    bn::fixed m7_cam_y = ${m7StartY};\n`;
          bgDeclarations += `    bn::fixed m7_cam_z = ${m7StartZ};\n`;
          bgDeclarations += `    int m7_cam_phi = ${m7StartPhi};\n`;
        }

        let musicPlayCode = '';
        if (scene.musicId) {
          const mTrack = musicTracks.find(t => t && String(t.id) === String(scene.musicId));
          if (mTrack) {
            let baseName = mTrack.name;
            let ext = 'mod';
            if (mTrack.name.includes('.')) {
              const parts = mTrack.name.split('.');
              ext = parts.pop().toLowerCase().trim();
              baseName = parts.join('.');
            }
            if (mTrack.isComposed) {
              ext = 'mod';
            }
            const sanitizedMusicName = baseName.replace(/[^a-z0-9_]/gi, '_').toLowerCase() + `_${sIdx}`;
            let modBytes = null;
            if (mTrack.composerData && mTrack.composerData.notes && mTrack.isComposed) {
              const { notes, bpm, songLength, channelWaveforms } = mTrack.composerData;
              try {
                const buffer = serializeToMod(notes || [], bpm || 125, songLength || 64, channelWaveforms || ['square', 'pulse25', 'triangle', 'noise']);
                modBytes = new Uint8Array(buffer);
              } catch (err) {
                console.error(`Failed to regenerate MOD for scene ${sIdx}:`, err);
              }
            }
            if (!modBytes && mTrack.data) {
              const dataParts = mTrack.data.split(',');
              if (dataParts.length > 1) {
                try {
                  const binaryString = window.atob(dataParts[1]);
                  const bytes = new Uint8Array(binaryString.length);
                  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
                  modBytes = bytes;
                } catch (err) {
                  console.error(`Failed to decode saved music track ${mTrack.name}:`, err);
                }
              }
            }
            if (modBytes) {
              zip.file(`audio/${sanitizedMusicName}.${ext}`, modBytes);
              musicPlayCode = `    bn::music_items::${sanitizedMusicName}.play();\n`;
              hasMusic = true;
            } else {
              console.warn(`No usable music data for "${mTrack.name}" in scene ${sIdx}, skipping`);
            }
          }
        }

        const getMenuFormattedText = (message, options, selIndex) => {
          let text = message;
          const N = options.length;
          if (N === 0) return text;
          const numRows = Math.ceil(N / 2);
          for (let r = 0; r < numRows; r++) {
            const leftIdx = r;
            const rightIdx = numRows + r;
            const leftOpt = options[leftIdx];
            const leftPrefix = (leftIdx === selIndex) ? '> ' : '  ';
            const leftText = leftPrefix + (leftOpt.text || '');
            let line = '\n' + leftText;
            if (rightIdx < N) {
              const rightOpt = options[rightIdx];
              const rightPrefix = (rightIdx === selIndex) ? '> ' : '  ';
              const rightText = rightPrefix + (rightOpt.text || '');
              const spacesCount = Math.max(1, 26 - leftText.length - rightText.length);
              line += ' '.repeat(spacesCount) + rightText;
            }
            text += line;
          }
          return text;
        };

        const dialogs = [];
        const processNodeForDialogs = (n) => {
          if (!n) return;
          if (n.data?.label === 'Show Dialog' && n.data.message) {
            if (!dialogs.includes(n.data.message)) dialogs.push(n.data.message);
          } else if (n.data?.label === 'Show Menu' || n.data?.actionType === 'menu') {
            const msg = n.data.message || '';
            const opts = n.data.options || [];
            if (opts.length > 0) {
              opts.forEach((opt, oIdx) => {
                const variant = getMenuFormattedText(msg, opts, oIdx);
                if (!dialogs.includes(variant)) dialogs.push(variant);
              });
            }
          }
        };

        if (scene.script?.nodes) {
          scene.script.nodes.forEach(processNodeForDialogs);
        }
        sActors.forEach(a => {
          if (a.script?.nodes) {
            a.script.nodes.forEach(processNodeForDialogs);
          }
        });
        sTriggers.forEach(t => {
          if (t.isGroup) return;
          const tScript = getTriggerScript(t, sTriggers, customScripts);
          if (tScript?.nodes) {
            tScript.nodes.forEach(processNodeForDialogs);
          }
        });
        customScripts.forEach(cs => {
          if (cs.script?.nodes) {
            cs.script.nodes.forEach(processNodeForDialogs);
          }
        });
        if (globalScript?.nodes) {
          globalScript.nodes.forEach(processNodeForDialogs);
        }

        const hasSavePoint = sActors.some(act => act && act.type === 'save_point');
        if (hasSavePoint) {
          if (!dialogs.includes("Save the game?\n> Yes\n  No")) dialogs.push("Save the game?\n> Yes\n  No");
          if (!dialogs.includes("Save the game?\n  Yes\n> No")) dialogs.push("Save the game?\n  Yes\n> No");
        }



        const actorCustomAnims = {};
        sActors.forEach(a => actorCustomAnims[a.id] = new Set());

        const scanNodesForAnimations = (nodes, contextActorId) => {
          nodes.forEach(n => {
            if (n.data?.actionType === 'play_animation' && n.data.animId) {
              const tId = n.data.targetActorId;
              if (tId && actorCustomAnims[tId]) actorCustomAnims[tId].add(n.data.animId);
              else if (contextActorId === 'ALL') sActors.forEach(a => actorCustomAnims[a.id].add(n.data.animId));
              else if (contextActorId && actorCustomAnims[contextActorId]) actorCustomAnims[contextActorId].add(n.data.animId);
            }
          });
        };

        sActors.forEach(a => { if (a.script?.nodes) scanNodesForAnimations(a.script.nodes, a.id) });
        sActors.forEach(a => {
          if (a.attackAnimId) actorCustomAnims[a.id].add(a.attackAnimId);
          if (a.type === 'player' && a.playerAnimOnButton && a.playerAnimId) {
            actorCustomAnims[a.id].add(a.playerAnimId);
          }
        });
        sTriggers.forEach(t => {
          if (t.isGroup) return;
          const tScript = getTriggerScript(t, sTriggers, customScripts);
          if (tScript?.nodes) scanNodesForAnimations(tScript.nodes, null);
        });
        customScripts.forEach(cs => { if (cs.script?.nodes) scanNodesForAnimations(cs.script.nodes, 'ALL') });
        if (globalScript?.nodes) scanNodesForAnimations(globalScript.nodes, 'ALL');
        if (scene.script?.nodes) scanNodesForAnimations(scene.script.nodes, 'ALL');

        const gatherAudioAndProjectiles = (nodes) => {
          if (!nodes) return;
          nodes.forEach(n => {
            if (n.data?.actionType === 'sound') {
              if (n.data.soundSource === 'asset') {
                const sfxTrack = musicTracks.find(t => t && String(t.id) === String(n.data.sfxTrackId));
                if (sfxTrack) {
                  let baseName = sfxTrack.name;
                  if (sfxTrack.name.includes('.')) {
                    const parts = sfxTrack.name.split('.');
                    parts.pop();
                    baseName = parts.join('.');
                  }
                  const soundName = baseName.replace(/[^a-z0-9_]/gi, '_').toLowerCase();
                  if (!generatedSounds.has(soundName)) {
                    generatedSounds.add(soundName);
                    let wavBytes = null;
                    if (sfxTrack.data) {
                      const dataParts = sfxTrack.data.split(',');
                      if (dataParts.length > 1) {
                        try {
                          const binaryString = window.atob(dataParts[1]);
                          const bytes = new Uint8Array(binaryString.length);
                          for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
                          wavBytes = bytes;
                        } catch (err) {
                          console.error(`Failed to decode saved SFX track ${sfxTrack.name}:`, err);
                        }
                      }
                    }
                    if (wavBytes) {
                      zip.file(`audio/${soundName}.wav`, wavBytes);
                    } else if (sfxTrack.sfxParams) {
                      const { type, freq, durationMs, fadeOut } = sfxTrack.sfxParams;
                      zip.file(`audio/${soundName}.wav`, generateWav(type, freq, durationMs, fadeOut));
                    }
                  }
                  n.data.computedSoundName = soundName;
                } else {
                  const waveType = n.data.waveType || 'square';
                  const freq = n.data.freq || 440;
                  const durationMs = n.data.durationMs || 100;
                  const soundName = `snd_${waveType}_${freq}_${durationMs}`;
                  if (!generatedSounds.has(soundName)) {
                    generatedSounds.add(soundName);
                    zip.file(`audio/${soundName}.wav`, generateWav(waveType, freq, durationMs));
                  }
                  n.data.computedSoundName = soundName;
                }
              } else {
                const waveType = n.data.waveType || 'square';
                const freq = n.data.freq || 440;
                const durationMs = n.data.durationMs || 100;
                const soundName = `snd_${waveType}_${freq}_${durationMs}`;
                if (!generatedSounds.has(soundName)) {
                  generatedSounds.add(soundName);
                  zip.file(`audio/${soundName}.wav`, generateWav(waveType, freq, durationMs));
                }
                n.data.computedSoundName = soundName;
              }
            } else if (n.data?.actionType === 'shoot_projectile') {
              const spriteId = n.data.spriteId || null;
              const safeSpriteId = spriteId ? String(spriteId).replace(/[^a-zA-Z0-9_]/g, '_') : '';
              const projName = spriteId ? `proj_sprite_${safeSpriteId}` : 'bullet_sprite';
              if (!generatedProjectiles.has(projName)) {
                generatedProjectiles.add(projName);
              }
              n.data.computedProjName = projName;
            }
          });
        };

        sActors.forEach(a => gatherAudioAndProjectiles(a.script?.nodes));
        sTriggers.forEach(t => {
          if (t.isGroup) return;
          const tScript = getTriggerScript(t, sTriggers, customScripts);
          gatherAudioAndProjectiles(tScript?.nodes);
        });
        customScripts.forEach(cs => gatherAudioAndProjectiles(cs.script?.nodes));
        gatherAudioAndProjectiles(globalScript?.nodes);
        gatherAudioAndProjectiles(scene.script?.nodes);

        sActors.forEach(a => {
          if (a.type === 'enemy' && a.enemyFireProjectiles) {
            const spriteId = a.enemyProjectileSpriteId || null;
            const safeSpriteId = spriteId ? String(spriteId).replace(/[^a-zA-Z0-9_]/g, '_') : '';
            const projName = spriteId ? `proj_sprite_${safeSpriteId}` : 'bullet_sprite';
            if (!generatedProjectiles.has(projName)) {
              generatedProjectiles.add(projName);
            }
          }
          if (a.type === 'turret' && a.turretFires) {
            const spriteId = a.turretProjectileSpriteId || null;
            const safeSpriteId = spriteId ? String(spriteId).replace(/[^a-zA-Z0-9_]/g, '_') : '';
            const projName = spriteId ? `proj_sprite_${safeSpriteId}` : 'bullet_sprite';
            if (!generatedProjectiles.has(projName)) {
              generatedProjectiles.add(projName);
            }
          }
          if (a.type === 'player' && (a.playerFireProjectiles || a.playerAnimFireProjectile)) {
            const spriteId = a.playerProjectileSpriteId || null;
            const safeSpriteId = spriteId ? String(spriteId).replace(/[^a-zA-Z0-9_]/g, '_') : '';
            const projName = spriteId ? `proj_sprite_${safeSpriteId}` : 'bullet_sprite';
            if (!generatedProjectiles.has(projName)) {
              generatedProjectiles.add(projName);
            }
          }
          if (a.type === 'companion' && a.companionFireProjectiles) {
            const spriteId = a.companionProjectileSpriteId || null;
            const safeSpriteId = spriteId ? String(spriteId).replace(/[^a-zA-Z0-9_]/g, '_') : '';
            const projName = spriteId ? `proj_sprite_${safeSpriteId}` : 'bullet_sprite';
            if (!generatedProjectiles.has(projName)) {
              generatedProjectiles.add(projName);
            }
          }
        });

        if (!generatedSounds.has('snd_square_440_100')) {
          generatedSounds.add('snd_square_440_100');
          zip.file('audio/snd_square_440_100.wav', generateWav('square', 440, 100));
        }

        const scCtx = {
          dialogs, safeSceneName, scenes, sActors, sDims, customScripts, variables,
          currentSceneIdx, startingSceneIdx, scene
        };

        const spawnerTargetIds = new Set();
        sActors.forEach(a => {
          if (a.type === 'spawner') {
            if (a.spawnerActorIds) a.spawnerActorIds.forEach(id => spawnerTargetIds.add(String(id)));
            if (a.spawnerActorId) spawnerTargetIds.add(String(a.spawnerActorId));
          }
        });

        let actorDeclarations = '';
        let actorLogicCode = '';
        let postTriggerCode = '';
        let deferredFireProjLambdas = '';
        for (let i = 0; i < sActors.length; i++) {
          const a = sActors[i];
          const actName = `${safeSceneName}_actor_${i}_sprite`;

          let effectiveSpriteId = a.spriteId;
          let effectiveSpriteIds = a.spriteIds;

          let defaultIdx = 0;
          let idleIndices = [0];
          let walkIndices = [0];
          let jumpIndices = [];
          let customAnimData = [];
          const frameTiles = [];

          const addFrameTile = (framePayload) => {
            const payloadStr = typeof framePayload === 'object' ? JSON.stringify(framePayload) : String(framePayload);
            let idx = frameTiles.findIndex(t => (typeof t === 'object' ? JSON.stringify(t) : String(t)) === payloadStr);
            if (idx === -1) { frameTiles.push(framePayload); idx = frameTiles.length - 1; }
            return idx;
          };

          let idleAnim = null;
          let walkAnim = null;
          let jumpAnim = null;
          if (a.type === 'player' && scene.type === 'POINTNCLICK') {
            const ptrSpriteId = scene.pointerSpriteId ?? 22;
            const ptrHoverSpriteId = scene.pointerHoverSpriteId ?? 23;
            addFrameTile(ptrSpriteId);
            addFrameTile(ptrHoverSpriteId);
            effectiveSpriteId = ptrSpriteId;
            effectiveSpriteIds = null;
            defaultIdx = 0;
            idleIndices = [0];
            walkIndices = [0];
            customAnimData = [];
          } else {
            if (a.type === 'player' && scene.type === 'SHMUP') {
              const hasCustomSprite = a.spriteId || (a.spriteIds && a.spriteIds.some(id => id));
              if (!hasCustomSprite) {
                effectiveSpriteId = 24;
                effectiveSpriteIds = null;
              }
            } else if (a.type === 'player' && scene.type === 'RACING') {
              const hasCustomSprite = a.spriteId || (a.spriteIds && a.spriteIds.some(id => id));
              if (!hasCustomSprite) {
                effectiveSpriteId = 27;
                effectiveSpriteIds = null;
              }
            }
            idleAnim = animations.find(anim => anim && anim.id === a.idleAnimId);
            walkAnim = animations.find(anim => anim && anim.id === a.walkAnimId);
            jumpAnim = animations.find(anim => anim && anim.id === a.jumpAnimId);

            defaultIdx = addFrameTile(effectiveSpriteIds && effectiveSpriteIds.length > 0 ? effectiveSpriteIds : effectiveSpriteId);
            idleIndices = idleAnim && idleAnim.frames.length > 0 ? idleAnim.frames.map(addFrameTile) : [defaultIdx];
            walkIndices = walkAnim && walkAnim.frames.length > 0 ? walkAnim.frames.map(addFrameTile) : [defaultIdx];
            jumpIndices = jumpAnim && jumpAnim.frames.length > 0 ? jumpAnim.frames.map(addFrameTile) : [];

            const customAnimIds = Array.from(actorCustomAnims[a.id] || []);
            customAnimData = customAnimIds.map((animId, cIdx) => {
              const anim = animations.find(an => an && an.id === animId);
              return {
                animId, stateId: cIdx + 3,
                indices: anim && anim.frames.length > 0 ? anim.frames.map(addFrameTile) : [defaultIdx],
                fps: anim ? anim.fps : 8
              };
            });
          }
          a.__customAnimData = customAnimData;

          const [validW, validH] = getValidSpriteSize(a.width || 16, a.height || 16);
          const padX = Math.floor((validW - (a.width || 16)) / 2);
          const padY = Math.floor((validH - (a.height || 16)) / 2);

          // Get the pre-calculated defeat color for this actor
          const defeatR = 1;
          const defeatG = ((i * 13) % 20) + 1;
          const defeatB = ((i * 47 + 7) % 20) + 1;

          const sCanvas = document.createElement('canvas');
          sCanvas.width = validW;
          sCanvas.height = validH * Math.max(1, frameTiles.length);
          const sCtx = sCanvas.getContext('2d', { willReadFrequently: true });

          // GCC Linker identical-data-merge defeat pixel.
          // Each actor gets a UNIQUE color (pre-added to palette) so its sprite_item
          // never collides with another actor's at link time, otherwise butano's
          // bn::sprite_tiles_manager::_find_impl throws "tiles data does not match
          // items tiles data" (line 553) at runtime.
          // Defeat pixel is placed at the center of each frame.
          // We no longer shift the sprite to preserve the defeat pixel, as overwriting
          // a single near-black pixel at the center of the sprite is highly preferred
          // to shifting the sprite and cropping its edges or bleeding into other frames.
          const defeatPadX = padX;
          const defeatPadY = padY;

          if (frameTiles.length === 0 || (frameTiles.length === 1 && frameTiles[0] == null)) {
            sCtx.fillStyle = a.color || '#ff00ff';
            sCtx.fillRect(defeatPadX, defeatPadY, a.width || 16, a.height || 16);
            
            // Add defeat pixel at the center of the frame
            sCtx.fillStyle = `rgb(${defeatR}, ${defeatG}, ${defeatB})`;
            sCtx.fillRect(Math.floor(validW / 2), Math.floor(validH / 2), 1, 1);
          } else {
            frameTiles.forEach((tilePayload, fIdx) => {
              const fY = fIdx * validH;

              if (tilePayload === '__BASE_SPRITE__') {
                if (effectiveSpriteIds && effectiveSpriteIds.length > 0) {
                  const cols = Math.max(1, Math.floor((a.width || 16) / 8));
                  const rows = Math.max(1, Math.floor((a.height || 16) / 8));
                  for (let r = 0; r < rows; r++) {
                    for (let c = 0; c < cols; c++) {
                      const tId = effectiveSpriteIds[r * cols + c];
                      if (tId) {
                        const actualId = typeof tId === 'object' ? tId.id : tId;
                        const flipH = typeof tId === 'object' ? tId.flipH : false;
                        const flipV = typeof tId === 'object' ? tId.flipV : false;
                        const tile = savedTiles.find(t => t && String(t.id) === String(actualId));
                        if (tile) {
                          for (let py = 0; py < 8; py++) {
                            for (let px = 0; px < 8; px++) {
                              const srcY = flipV ? 7 - py : py;
                              const srcX = flipH ? 7 - px : px;
                              if (tile.data[srcY][srcX]) {
                                sCtx.fillStyle = tile.data[srcY][srcX];
                                sCtx.fillRect(defeatPadX + c * 8 + px, fY + defeatPadY + r * 8 + py, 1, 1);
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              } else if (Array.isArray(tilePayload)) {
                const cols = Math.max(1, Math.floor((a.width || 16) / 8));
                const rows = Math.max(1, Math.floor((a.height || 16) / 8));
                for (let r = 0; r < rows; r++) {
                  for (let c = 0; c < cols; c++) {
                    const tId = tilePayload[r * cols + c];
                    if (tId) {
                      const actualId = typeof tId === 'object' ? tId.id : tId;
                      const flipH = typeof tId === 'object' ? tId.flipH : false;
                      const flipV = typeof tId === 'object' ? tId.flipV : false;
                      const tile = savedTiles.find(t => t && String(t.id) === String(actualId));
                      if (tile) {
                        for (let py = 0; py < 8; py++) {
                          for (let px = 0; px < 8; px++) {
                            const srcY = flipV ? 7 - py : py;
                            const srcX = flipH ? 7 - px : px;
                            if (tile.data[srcY][srcX]) {
                              sCtx.fillStyle = tile.data[srcY][srcX];
                              sCtx.fillRect(defeatPadX + c * 8 + px, fY + defeatPadY + r * 8 + py, 1, 1);
                            }
                          }
                        }
                      }
                    }
                  }
                }
              } else {
                const tile = savedTiles.find(t => t && String(t.id) === String(tilePayload));
                if (tile) {
                  const scaleX = (a.width || 16) / 8; const scaleY = (a.height || 16) / 8;
                  for (let py = 0; py < 8; py++) for (let px = 0; px < 8; px++) if (tile.data[py][px]) { sCtx.fillStyle = tile.data[py][px]; sCtx.fillRect(defeatPadX + px * scaleX, fY + defeatPadY + py * scaleY, scaleX, scaleY); }
                } else {
                  sCtx.fillStyle = a.color || '#ff00ff'; sCtx.fillRect(defeatPadX, fY + defeatPadY, a.width || 16, a.height || 16);
                }
              }
            });
            
            // GCC Linker identical-data-merge defeat pixel - add one per frame
            // Placed at the center of each frame, overwriting the central pixel.
            // Each frame gets the actor's unique defeat color, making tile data byte-unique.
            frameTiles.forEach((_, fIdx) => {
              sCtx.fillStyle = `rgb(${defeatR}, ${defeatG}, ${defeatB})`;
              sCtx.fillRect(Math.floor(validW / 2), fIdx * validH + Math.floor(validH / 2), 1, 1);
            });
          }
          const imgDataTemp = sCtx.getImageData(0, 0, sCanvas.width, sCanvas.height);
          const uniqueColorsSet = new Set();
          for (let idx = 0; idx < imgDataTemp.data.length; idx += 4) {
            if (imgDataTemp.data[idx + 3] >= 128) {
              uniqueColorsSet.add(`${imgDataTemp.data[idx]},${imgDataTemp.data[idx + 1]},${imgDataTemp.data[idx + 2]}`);
            }
          }
          const uniqueCount = uniqueColorsSet.size + 1;
          const colorsCount = Math.min(256, Math.max(16, Math.ceil(uniqueCount / 16) * 16));
          const bppMode = colorsCount > 16 ? "bpp_8" : "bpp_4";

          const forceBpp = globalBppMode === 'bpp_8' ? 8 : 4;
          const bmpBlob = canvasToIndexedBmpBlob(sCanvas, globalSpriteColors, forceBpp);
          zip.file(`graphics/${actName}.bmp`, bmpBlob);
          // Butano's SpriteItem derives graphics_count from the BMP's full
          // dimensions divided by the per-graphic dimensions in the JSON.
          // The JSON width/height must describe ONE graphic; the BMP itself
          // is graphics_count graphics stacked vertically.
          zip.file(`graphics/${actName}.json`, JSON.stringify({
            type: "sprite",
            width: validW,
            height: validH,
            bpp_mode: globalBppMode,
            colors_count: globalColorsCount
          }, null, 2));
          zip.file(`graphics/${actName}.grit`, `-m!`);
          mainCppIncludes += `#include "bn_sprite_items_${actName}.h"\n`;

          if (a.type === 'player') {
            const spawnX = a.useVarX && a.varX ? `(${a.varX.replace(/[^a-zA-Z0-9_]/g, '_')} * 8)` : a.x;
            const spawnY = a.useVarY && a.varY ? `(${a.varY.replace(/[^a-zA-Z0-9_]/g, '_')} * 8)` : a.y;
            actorDeclarations += `    bn::fixed actor_${i}_float_x = global_spawn_x != -1 ? global_spawn_x : ${spawnX};\n`;
            actorDeclarations += `    bn::fixed actor_${i}_float_y = global_spawn_y != -1 ? global_spawn_y : ${spawnY};\n`;
          } else {
            const spawnX = a.useVarX && a.varX ? `(${a.varX.replace(/[^a-zA-Z0-9_]/g, '_')} * 8)` : a.x;
            const spawnY = a.useVarY && a.varY ? `(${a.varY.replace(/[^a-zA-Z0-9_]/g, '_')} * 8)` : a.y;
            actorDeclarations += `    bn::fixed actor_${i}_float_x = ${spawnX};\n`;
            actorDeclarations += `    bn::fixed actor_${i}_float_y = ${spawnY};\n`;
          }
          actorDeclarations += `    int actor_${i}_x = actor_${i}_float_x.integer();\n`;
          actorDeclarations += `    int actor_${i}_y = actor_${i}_float_y.integer();\n`;
          let initX = `actor_${i}_x - ${Math.floor(sDims.w / 2)} + ${Math.floor(a.width / 2)}`;
          let initY = `actor_${i}_y - ${Math.floor(sDims.h / 2)} + ${Math.floor(a.height / 2)}`;
          if (a.type === 'player' && (scene.type === 'RACING' || scene.type === 'SHMUP') && scene.mode7) {
            initX = '0';
            initY = scene.type === 'SHMUP' ? '40' : '50';
          }
          actorDeclarations += `    bn::sprite_ptr actor_${i}_sprite = bn::sprite_items::${actName}.create_sprite(${initX}, ${initY});\n`;
          actorDeclarations += `    actor_${i}_sprite.set_palette(shared_sprite_palette);
    actor_${i}_sprite.set_bg_priority(1);\n`;
          const isPlatformType = ['platform', 'staticPlatform', 'movingPlatform', 'conveyor', 'pushable', 'destructible', 'door', 'ladder', 'one_way_wall', 'ice_block', 'crumbling_platform', 'pass_wall'].includes(a.type);
          if (isPlatformType) {
            actorDeclarations += `    actor_${i}_sprite.set_z_order(1);\n`;
          }
          const cacheEntries = frameTiles.map((_, t) => `        bn::sprite_items::${actName}.tiles_item().create_tiles(${t})`);
          actorDeclarations += `    bn::sprite_tiles_ptr actor_${i}_tiles_cache[] = {\n${cacheEntries.join(',\n')}\n    };\n`;
          if (idleIndices.length > 0) {
            actorDeclarations += `    actor_${i}_sprite.set_tiles(actor_${i}_tiles_cache[${idleIndices[0]}]);\n`;
          }

          const sX = a.useVarScaleX && a.varScaleX ? a.varScaleX.replace(/[^a-zA-Z0-9_]/g, '_') : (a.scaleX ?? 1);
          const sY = a.useVarScaleY && a.varScaleY ? a.varScaleY.replace(/[^a-zA-Z0-9_]/g, '_') : (a.scaleY ?? 1);
          const rot = a.useVarRotation && a.varRotation ? a.varRotation.replace(/[^a-zA-Z0-9_]/g, '_') : (a.rotation ?? 0);

          const checkNodesForAffine = (nodes, ownerId) => {
            if (!nodes) return false;
            return nodes.some(n => {
              const type = n.data?.actionType;
              if (type !== 'set_actor_rotation' && type !== 'set_actor_scale') return false;
              const target = n.data?.targetActorId;
              if (!target) return ownerId && String(ownerId) === String(a.id);
              return String(target) === String(a.id);
            });
          };

          let needsAffine = (sX !== 1 || sY !== 1 || rot !== 0 || a.useVarScaleX || a.useVarScaleY || a.useVarRotation);
          if (a.type === 'player' && scene.type === 'RACING') {
            needsAffine = true;
          }
          if (!needsAffine) {
            if (checkNodesForAffine(a.script?.nodes, a.id)) needsAffine = true;
            else if (checkNodesForAffine(scene.script?.nodes, null)) needsAffine = true;
            else if (checkNodesForAffine(globalScript?.nodes, null)) needsAffine = true;
            else if (sTriggers.some(t => t && !t.isGroup && checkNodesForAffine(getTriggerScript(t, sTriggers, customScripts)?.nodes, null))) needsAffine = true;
            else if (customScripts.some(cs => cs && checkNodesForAffine(cs.script?.nodes, null))) needsAffine = true;
            else if (sActors.some(act => act && act.id !== a.id && checkNodesForAffine(act.script?.nodes, act.id))) needsAffine = true;
          }

          if (needsAffine) {
            actorDeclarations += `    bn::sprite_affine_mat_ptr actor_${i}_affine = bn::sprite_affine_mat_ptr::create();\n`;
            if (sX !== 1 || sY !== 1 || a.useVarScaleX || a.useVarScaleY) {
              actorDeclarations += `    actor_${i}_affine.set_scale(${sX}, ${sY});\n`;
            }
            if (rot !== 0 || a.useVarRotation) {
              actorDeclarations += `    actor_${i}_affine.set_rotation_angle(${rot});\n`;
            }
            if (a.type === 'player' && scene.type === 'RACING' && !scene.mode7 && !a.useVarRotation && rot === 0) {
              const pcx = sDims.w / 2;
              const pcy = sDims.h / 2;
              const pdx = (a.x || 0) - pcx;
              const pdy = (a.y || 0) - pcy;
              const trackAngleRad = Math.atan2(pdy, pdx);
              let spriteAngle = ((trackAngleRad * 180 / Math.PI) - 90 + 360) % 360;
              spriteAngle = Math.round(spriteAngle * 100) / 100;
              actorDeclarations += `    actor_${i}_affine.set_rotation_angle(${spriteAngle});\n`;
            }
            actorDeclarations += `    actor_${i}_sprite.set_affine_mat(actor_${i}_affine);\n`;
          }

          actorDeclarations += `    actor_${i}_sprite.set_camera(camera);\n`;
          if (a.type === 'player' && (scene.type === 'RACING' || scene.type === 'SHMUP') && scene.mode7) {
            actorDeclarations += `    actor_${i}_sprite.remove_camera();\n`;
          }
          const isHidden = a.isHidden || spawnerTargetIds.has(String(a.id));
          if (isHidden) {
            actorDeclarations += `    actor_${i}_sprite.set_visible(false);\n`;
          }
          actorDeclarations += `    int actor_${i}_timer = 0;\n    bn::fixed actor_${i}_dx = 0;\n    bn::fixed actor_${i}_dy = 0;\n    int actor_${i}_last_dx_dir = 1;\n    int actor_${i}_last_dy_dir = 0;\n    bool actor_${i}_active = ${isHidden ? 'false' : 'true'};\n`;
          actorDeclarations += `    bn::fixed actor_${i}_anim_speed = 1;\n    bn::fixed actor_${i}_movement_speed = 1;\n    bool actor_${i}_update_enabled = true;\n`;
          if (a.type === 'player' && scene.type === 'RACING') {
            actorDeclarations += `    bn::fixed actor_${i}_speed = 0;\n`;
            let racingStartAngle = 270;
            if (!scene.mode7) {
              const pcx = sDims.w / 2;
              const pcy = sDims.h / 2;
              const pdx = (a.x || 0) - pcx;
              const pdy = (a.y || 0) - pcy;
              const trackAngleRad = Math.atan2(pdy, pdx);
              racingStartAngle = ((trackAngleRad * 180 / Math.PI) - 90 + 360) % 360;
              racingStartAngle = Math.round(racingStartAngle * 100) / 100;
            }
            actorDeclarations += `    bn::fixed actor_${i}_angle = ${racingStartAngle};\n`;
            let steerVal = `bn::fixed(${scene.steeringSpeed ?? 0.5})`;
            if (scene.useVarSteeringSpeed && scene.steeringSpeedVar) {
              const cleanedVar = scene.steeringSpeedVar.replace(/[^a-zA-Z0-9_]/g, '_');
              steerVal = `${cleanedVar}`;
            }
            actorDeclarations += `    bn::fixed scene_steering_speed = ${steerVal};\n`;
          }
          if (a.type !== 'player' && a.onHitScriptId) {
            actorDeclarations += `    bool actor_${i}_hit_active = false;\n`;
          }
          if (a.type !== 'player' && (a.onInteractScriptId || a.script?.nodes?.some(n => n.id === 'start' && n.data?.label === 'On Interact'))) {
            actorDeclarations += `    bool actor_${i}_interact_active = false;\n`;
          }
          if (a.type === 'player' && a.script?.nodes?.some(n => n.id === 'start' && n.data?.label === 'On Interact')) {
            actorDeclarations += `    bool actor_${i}_interact_active = false;\n`;
          }
          let deathScriptCompiled = '';
          if (a.type === 'player') {
            const hpVar = (a.useVarPlayerHp && a.varPlayerHp) ? variables.find(v => v && v.name === a.varPlayerHp) : null;
            const hpVal = hpVar ? (hpVar.initialValue ?? 10) : (a.playerHp ?? 10);
            actorDeclarations += `    int actor_${i}_hp = ${hpVal};\n`;
            const maxHpVar = (a.useVarPlayerMaxHp && a.varPlayerMaxHp) ? variables.find(v => v && v.name === a.varPlayerMaxHp) : null;
            const maxHpVal = maxHpVar ? (maxHpVar.initialValue ?? 10) : (a.playerMaxHp ?? 10);
            actorDeclarations += `    int actor_${i}_max_hp = ${maxHpVal};\n`;
            const bonusVar = (a.useVarPlayerBonus && a.varPlayerBonus) ? variables.find(v => v && v.name === a.varPlayerBonus) : null;
            const bonusVal = bonusVar ? (bonusVar.initialValue ?? 0) : (a.playerBonus ?? 0);
            const maxBonusVar = (a.useVarPlayerMaxBonus && a.varPlayerMaxBonus) ? variables.find(v => v && v.name === a.varPlayerMaxBonus) : null;
            const maxBonusVal = maxBonusVar ? (maxBonusVar.initialValue ?? 10) : (a.playerMaxBonus ?? 10);
            const hudHasBonus = hudSettings && hudSettings.enabled && (hudSettings.displayItems || []).some(item => {
              const txt = (item.text || '').toUpperCase();
              return txt.includes('{BONUS}') || txt.includes('{COINS}') || txt.includes('{PLAYER_BONUS}');
            });
            const _hasBonus = sActors.some(act => act && act.type === 'coin' || act.type === 'bonus') || !!a.playerBonusMaxScriptId || !!a.displayBonusInHud || hudHasBonus;
            if (_hasBonus) {
              actorDeclarations += `    int actor_${i}_bonus = ${bonusVal};\n`;
              actorDeclarations += `    int actor_${i}_max_bonus = ${maxBonusVal};\n`;
            }
            if (a.playerDeathScriptId) {
              const deathScriptObj = customScripts.find(cs => cs && Number(cs.id) === Number(a.playerDeathScriptId));
              if (deathScriptObj) {
                deathScriptCompiled = generateScriptLogic(deathScriptObj.script, i, a.width, a.height, undefined, undefined, scCtx);
              }
            }
            if (scene.type === 'PLATFORMER') {
              actorDeclarations += `    int actor_${i}_drop_through_timer = 0;\n`;
              actorDeclarations += `    bool actor_${i}_climbing = false;\n`;
              if (a.doubleJump) {
                actorDeclarations += `    bool actor_${i}_double_jumped = false;\n`;
              }
              // actorDeclarations += `    int actor_${i}_on_wall = 0;\n`;
            }
            actorDeclarations += `    int actor_${i}_invincible_timer = 0;\n`;
            actorDeclarations += `    int actor_${i}_speed_timer = 0;\n`;
            const _hasGrenades = sActors.some(act => act && act.type === 'grenade');
            if (_hasGrenades) {
              actorDeclarations += `    int actor_${i}_grenade_timer = 0;\n`;
            }
            if (a.playerFireProjectiles || a.playerAnimFireProjectile) {
              actorDeclarations += `    int actor_${i}_shoot_timer = 0;\n`;
              const pName = a.playerProjectileSpriteId ? `proj_sprite_${String(a.playerProjectileSpriteId).replace(/[^a-zA-Z0-9_]/g, '_')}` : 'bullet_sprite';
              const dirMode = a.playerProjDirMode || 'vector';
              const speed = a.playerProjSpeed ?? 3;
              deferredFireProjLambdas += `    auto actor_${i}_fire_proj = [&] {\n`;
              deferredFireProjLambdas += `        for(int p=0; p<20; ++p) {\n`;
              deferredFireProjLambdas += `            if(!proj_active[p]) {\n`;
              if (scene.mode7 && (scene.type === 'SHMUP' || scene.type === 'RACING')) {
                const screenY = scene.type === 'SHMUP' ? 40 : 50;
                deferredFireProjLambdas += `                proj_x[p] = actor_${i}_x + ${Math.floor((a.width || 16) / 2)};\n`;
                deferredFireProjLambdas += `                proj_y[p] = actor_${i}_y + ${Math.floor((a.height || 16) / 2)} + ${screenY};\n`;
              } else {
                deferredFireProjLambdas += `                proj_x[p] = actor_${i}_x + ${Math.floor((a.width || 16) / 2)};\n`;
                deferredFireProjLambdas += `                proj_y[p] = actor_${i}_y + ${Math.floor((a.height || 16) / 2)};\n`;
              }
              if (dirMode === 'vector') {
                deferredFireProjLambdas += `                proj_dx[p] = ${a.playerProjDx ?? 1};\n`;
                deferredFireProjLambdas += `                proj_dy[p] = ${a.playerProjDy ?? 0};\n`;
              } else if (dirMode === 'facing') {
                deferredFireProjLambdas += `                bn::fixed dx_dir = 0; bn::fixed dy_dir = 0;\n`;
                deferredFireProjLambdas += `                if (actor_${i}_dx < 0) dx_dir = -1; else if (actor_${i}_dx > 0) dx_dir = 1;\n`;
                deferredFireProjLambdas += `                if (actor_${i}_dy < 0) dy_dir = -1; else if (actor_${i}_dy > 0) dy_dir = 1;\n`;
                deferredFireProjLambdas += `                if (dx_dir == 0 && dy_dir == 0) {\n`;
                deferredFireProjLambdas += `                    if (bn::keypad::left_held()) dx_dir = -1; else if (bn::keypad::right_held()) dx_dir = 1;\n`;
                deferredFireProjLambdas += `                    else if (bn::keypad::up_held()) dy_dir = -1; else if (bn::keypad::down_held()) dy_dir = 1;\n`;
                deferredFireProjLambdas += `                    else {\n`;
                deferredFireProjLambdas += `                        dx_dir = actor_${i}_last_dx_dir;\n`;
                deferredFireProjLambdas += `                        dy_dir = actor_${i}_last_dy_dir;\n`;
                deferredFireProjLambdas += `                    }\n`;
                deferredFireProjLambdas += `                }\n`;
                deferredFireProjLambdas += `                if (dx_dir != 0 && dy_dir != 0) {\n`;
                deferredFireProjLambdas += `                    proj_dx[p] = (dx_dir * bn::fixed(${speed}) * 707) / 1000;\n`;
                deferredFireProjLambdas += `                    proj_dy[p] = (dy_dir * bn::fixed(${speed}) * 707) / 1000;\n`;
                deferredFireProjLambdas += `                } else {\n`;
                deferredFireProjLambdas += `                    proj_dx[p] = dx_dir * bn::fixed(${speed});\n`;
                deferredFireProjLambdas += `                    proj_dy[p] = dy_dir * bn::fixed(${speed});\n`;
                deferredFireProjLambdas += `                }\n`;
              } else if (dirMode === 'angle') {
                deferredFireProjLambdas += `                proj_dx[p] = bn::degrees_lut_cos(bn::fixed(${a.playerProjAngle ?? 0})) * bn::fixed(${speed});\n`;
                deferredFireProjLambdas += `                proj_dy[p] = bn::degrees_lut_sin(bn::fixed(${a.playerProjAngle ?? 0})) * bn::fixed(${speed});\n`;
              } else if (dirMode === 'target_enemy') {
                deferredFireProjLambdas += `                int target_x = -1; int target_y = -1; int min_dist_sq = 9999999;\n`;
                deferredFireProjLambdas += `                int cur_x = proj_x[p]; int cur_y = proj_y[p];\n`;
                const enemyIndices = [];
                sActors.forEach((act, actIdx) => { if (act.type === 'enemy') enemyIndices.push(actIdx); });
                enemyIndices.forEach(kIdx => {
                    const enemyAct = sActors[kIdx];
                    deferredFireProjLambdas += `                if (actor_${kIdx}_active) {\n`;
                    deferredFireProjLambdas += `                    int edx = actor_${kIdx}_x + ${Math.floor((enemyAct.width || 16) / 2)} - cur_x;\n`;
                    deferredFireProjLambdas += `                    int edy = actor_${kIdx}_y + ${Math.floor((enemyAct.height || 16) / 2)} - cur_y;\n`;
                    deferredFireProjLambdas += `                    int dist_sq = edx*edx + edy*edy;\n`;
                    deferredFireProjLambdas += `                    if (dist_sq < min_dist_sq) {\n`;
                    deferredFireProjLambdas += `                        min_dist_sq = dist_sq;\n`;
                    deferredFireProjLambdas += `                        target_x = actor_${kIdx}_x + ${Math.floor((enemyAct.width || 16) / 2)};\n`;
                    deferredFireProjLambdas += `                        target_y = actor_${kIdx}_y + ${Math.floor((enemyAct.height || 16) / 2)};\n`;
                    deferredFireProjLambdas += `                    }\n`;
                    deferredFireProjLambdas += `                }\n`;
                });
                deferredFireProjLambdas += `                if (target_x != -1) {\n`;
                deferredFireProjLambdas += `                    bn::fixed tdx = target_x - cur_x; bn::fixed tdy = target_y - cur_y;\n`;
                deferredFireProjLambdas += `                    bn::fixed target_dist = bn::sqrt((tdx * tdx) + (tdy * tdy));\n`;
                deferredFireProjLambdas += `                    if (target_dist > 0) {\n`;
                deferredFireProjLambdas += `                        proj_dx[p] = (tdx / target_dist) * bn::fixed(${speed});\n`;
                deferredFireProjLambdas += `                        proj_dy[p] = (tdy / target_dist) * bn::fixed(${speed});\n`;
                deferredFireProjLambdas += `                    } else {\n`;
                deferredFireProjLambdas += `                        proj_dx[p] = bn::fixed(${speed}); proj_dy[p] = 0;\n`;
                deferredFireProjLambdas += `                    }\n`;
                deferredFireProjLambdas += `                } else {\n`;
                deferredFireProjLambdas += `                    bn::fixed dx_dir = 0; bn::fixed dy_dir = 0;\n`;
                deferredFireProjLambdas += `                    if (actor_${i}_dx < 0) dx_dir = -1; else if (actor_${i}_dx > 0) dx_dir = 1;\n`;
                deferredFireProjLambdas += `                    if (actor_${i}_dy < 0) dy_dir = -1; else if (actor_${i}_dy > 0) dy_dir = 1;\n`;
                deferredFireProjLambdas += `                    if (dx_dir == 0 && dy_dir == 0) {\n`;
                deferredFireProjLambdas += `                        if (bn::keypad::left_held()) dx_dir = -1; else if (bn::keypad::right_held()) dx_dir = 1;\n`;
                deferredFireProjLambdas += `                        else if (bn::keypad::up_held()) dy_dir = -1; else if (bn::keypad::down_held()) dy_dir = 1;\n`;
                deferredFireProjLambdas += `                        else {\n`;
                deferredFireProjLambdas += `                            dx_dir = actor_${i}_last_dx_dir;\n`;
                deferredFireProjLambdas += `                            dy_dir = actor_${i}_last_dy_dir;\n`;
                deferredFireProjLambdas += `                        }\n`;
                deferredFireProjLambdas += `                    }\n`;
                deferredFireProjLambdas += `                    if (dx_dir != 0 && dy_dir != 0) {\n`;
                deferredFireProjLambdas += `                        proj_dx[p] = (dx_dir * bn::fixed(${speed}) * 707) / 1000;\n`;
                deferredFireProjLambdas += `                        proj_dy[p] = (dy_dir * bn::fixed(${speed}) * 707) / 1000;\n`;
                deferredFireProjLambdas += `                    } else {\n`;
                deferredFireProjLambdas += `                        proj_dx[p] = dx_dir * bn::fixed(${speed});\n`;
                deferredFireProjLambdas += `                        proj_dy[p] = dy_dir * bn::fixed(${speed});\n`;
                deferredFireProjLambdas += `                    }\n`;
                deferredFireProjLambdas += `                }\n`;
              }
              deferredFireProjLambdas += `                proj_active[p] = true;\n`;
              deferredFireProjLambdas += `                proj_from_player[p] = true;\n`;
              deferredFireProjLambdas += `                proj_bouncing[p] = ${a.playerProjType === 'bouncing' ? 'true' : 'false'};\n`;
              deferredFireProjLambdas += `                proj_bounce_count[p] = 0;\n`;
              deferredFireProjLambdas += `                proj_sprites[p] = bn::sprite_items::${pName}.create_sprite(proj_x[p] - ${Math.floor(sDims.w / 2)}, proj_y[p] - ${Math.floor(sDims.h / 2)});\n`;
              deferredFireProjLambdas += `                proj_sprites[p]->set_palette(shared_sprite_palette);\n`;
              deferredFireProjLambdas += `                proj_sprites[p]->set_camera(camera);\n`;
              deferredFireProjLambdas += `                proj_sprites[p]->set_bg_priority(1);\n`;
              deferredFireProjLambdas += `                break;\n            }\n        }\n    };\n`;
            }
            if (a.playerAnimFireProjectile) {
              actorDeclarations += `    bool actor_${i}_anim_fired = false;\n`;
            }
          }
          if (a.type === 'enemy') {
            const enemyHp = a.enemyHp ?? 3;
            actorDeclarations += `    int actor_${i}_hp = ${enemyHp};\n`;
            if (a.isBoss) {
              actorDeclarations += `    [[maybe_unused]] int actor_${i}_max_hp = ${enemyHp};\n`;
            }
            if (a.enemyFireProjectiles) {
              actorDeclarations += `    int actor_${i}_shoot_timer = 0;\n`;
            }
          }
          if (a.type === 'destructible') {
            actorDeclarations += `    int actor_${i}_hp = ${a.destructibleHp ?? 1};\n`;
          }
          if (a.type === 'checkpoint') {
            const defaultActive = a.checkpointDefaultActive || false;
            actorDeclarations += `    bool actor_${i}_cp_activated = ${defaultActive ? 'true' : 'false'};\n`;
          }
          if (a.type === 'turret') {
            actorDeclarations += `    int actor_${i}_hp = ${a.turretHp ?? 3};\n`;
            if (a.turretFires) {
              actorDeclarations += `    int actor_${i}_shoot_timer = 0;\n`;
            }
          }
          if (a.type === 'spawner') {
            actorDeclarations += `    int actor_${i}_spawn_timer = ${a.spawnerInterval ?? 60};\n`;
          }
          if (a.type === 'companion') {
            if (a.companionFireProjectiles) {
              actorDeclarations += `    int actor_${i}_shoot_timer = 0;\n`;
            }
            const behav = a.companionBehavior || 'follow';
            if (behav === 'orbit') {
              actorDeclarations += `    bn::fixed actor_${i}_orbit_angle = 0;\n`;
            }
            if (behav === 'mimic') {
              const delay = a.companionMimicDelay ?? 15;
              actorDeclarations += `    bn::fixed actor_${i}_mimic_buf_x[${delay + 1}];\n`;
              actorDeclarations += `    bn::fixed actor_${i}_mimic_buf_y[${delay + 1}];\n`;
              actorDeclarations += `    int actor_${i}_mimic_write = 0;\n`;
            }
          }
          if (a.type === 'crumbling_platform') {
            actorDeclarations += `    int actor_${i}_crumble_timer = 0;\n`;
            actorDeclarations += `    bool actor_${i}_crumbling = false;\n`;
            actorDeclarations += `    bool actor_${i}_respawning = false;\n`;
            actorDeclarations += `    int actor_${i}_respawn_timer = 0;\n`;
          }
          if (a.type === 'pass_wall') {
            const passWallMode = a.passWallMode || 'passes';
            const initialPassCount = passWallMode === 'frames' ? ((a.solidAfterFrames || 60) > 0 ? 1 : 0) : (a.passCount ?? 0);
            const passWallStartOnTouch = a.passWallStartOnTouch || false;
            const initTimerVal = passWallMode === 'frames' && !passWallStartOnTouch ? (a.solidAfterFrames || 60) : -1;
            console.log(`[DECLARATIONS] pass_wall actor ${i}: mode=${passWallMode}, initialPassCount=${initialPassCount}, solidAfterFrames=${a.solidAfterFrames}, startOnTouch=${passWallStartOnTouch}, initTimerVal=${initTimerVal}`);
            actorDeclarations += `    int actor_${i}_pass_count = ${initialPassCount};\n`;
            actorDeclarations += `    bool actor_${i}_player_overlapping = false;\n`;
            actorDeclarations += `    int actor_${i}_solid_timer = ${initTimerVal};\n`;
          }
          if (a.type === 'push_target') {
            actorDeclarations += `    bool actor_${i}_filled = false;\n`;
          }
          if (a.type === 'pressure_plate') {
            actorDeclarations += `    bool actor_${i}_pressed = false;\n`;
          }
          if (a.type === 'teleporter') {
            actorDeclarations += `    int actor_${i}_teleport_cooldown = 0;\n`;
          }
          if (a.type === 'chest') {
            actorDeclarations += `    bool actor_${i}_opened = false;\n`;
          }
          if (a.type === 'torch') {
            actorDeclarations += `    bn::fixed actor_${i}_flicker_timer = 0;\n`;
          }
          if (a.type === 'save_point') {
            actorDeclarations += `    bool actor_${i}_activated = false;\n`;
          }
          if (a.type === 'grenade') {
            actorDeclarations += `    int actor_${i}_grenade_qty = ${a.grenadeQuantity ?? 3};\n`;
          }
          if (a.type === 'boost_pad') {
            actorDeclarations += `    bool actor_${i}_active_boost = false;\n`;
          }
          if (a.type === 'checkpoint_gate') {
            actorDeclarations += `    bool actor_${i}_passed = false;\n`;
          }
          if (a.type === 'gravity_flip_zone') {
            actorDeclarations += `    bool actor_${i}_player_inside = false;\n`;
          }
          if (a.type === 'magnet') {
            actorDeclarations += `    int actor_${i}_magnet_duration = ${a.magnetDuration ?? 300};\n`;
          }
          if (a.type === 'shield') {
            actorDeclarations += `    int actor_${i}_shield_duration = ${a.shieldDuration ?? 300};\n`;
            actorDeclarations += `    bool actor_${i}_shield_visual = ${a.shieldVisual !== false ? 'true' : 'false'};\n`;
          }
          if (a.type === 'health_pickup') {
            // No specific variables needed for health pickup, logic is direct.
            // This is a placeholder for future properties.
          }
          if (a.type === 'ice_block') {
            actorDeclarations += `    bn::fixed actor_${i}_slide_dx = 0;\n`;
            actorDeclarations += `    bn::fixed actor_${i}_slide_dy = 0;\n`;
          }
          const _startBehaviors = ['patrol', 'sine', 'zigzag'];
          const isMoving = a.type === 'enemy'
            ? ((a.enemyBehavior || 'patrol') !== 'idle')
            : (a.isMoving ?? (a.type === 'movingPlatform' || (a.npcBehavior && ['sine', 'zigzag', 'wander', 'follow'].includes(a.npcBehavior))));
          if (isMoving) {
            if (a.type !== 'enemy' || _startBehaviors.includes(a.enemyBehavior || 'patrol') || (a.enemyBehavior === 'follow' && (parseInt(a.followProximity) || 0) > 0)) {
              actorDeclarations += `    bn::fixed actor_${i}_start_x = actor_${i}_float_x;\n`;
              actorDeclarations += `    bn::fixed actor_${i}_start_y = actor_${i}_float_y;\n`;
            }
            actorDeclarations += `    int actor_${i}_dir = 1;\n`;
          }
          if ((a.type === 'platform' || a.type === 'staticPlatform' || a.type === 'movingPlatform' || a.type === 'destructible' || a.type === 'door' || a.type === 'conveyor') && a.moveOnlyOnStand) {
            actorDeclarations += `    bool actor_${i}_player_on = false;\n`;
          }
          const _needsAnim = !(scene.type === 'POINTNCLICK' && a.type === 'player');
          if (_needsAnim) {
            actorDeclarations += `    int actor_${i}_idle_frames[] = { ${idleIndices.join(', ')} };\n`;
            actorDeclarations += `    int actor_${i}_walk_frames[] = { ${walkIndices.join(', ')} };\n`;
            if (jumpIndices.length > 0) {
              actorDeclarations += `    int actor_${i}_jump_frames[] = { ${jumpIndices.join(', ')} };\n`;
            }
            customAnimData.forEach(cad => {
              actorDeclarations += `    int actor_${i}_custom_${cad.stateId}_frames[] = { ${cad.indices.join(', ')} };\n`;
            });
            actorDeclarations += `    int actor_${i}_anim_timer = 0;\n    int actor_${i}_anim_idx = 0;\n    int actor_${i}_anim_state = 0;\n`;
            actorDeclarations += `    int actor_${i}_anim_lock = 0;\n`;
          }
          actorDeclarations += `\n`;

          let scriptCode = generateScriptLogic(a.script, i, a.width, a.height, undefined, undefined, scCtx);
          let pushTargetScriptCompiled = '';
          if (a.type === 'push_target' && a.pushTargetScriptId) {
            const ptScriptObj = customScripts.find(cs => cs && Number(cs.id) === Number(a.pushTargetScriptId));
            if (ptScriptObj) {
              pushTargetScriptCompiled = generateScriptLogic(ptScriptObj.script, i, a.width, a.height, undefined, undefined, scCtx);
            }
          }
          let chestOpenScriptCompiled = '';
          if (a.type === 'chest' && a.chestOpenScriptId) {
            const coScriptObj = customScripts.find(cs => cs && Number(cs.id) === Number(a.chestOpenScriptId));
            if (coScriptObj) {
              chestOpenScriptCompiled = generateScriptLogic(coScriptObj.script, i, a.width, a.height, undefined, undefined, scCtx);
            }
          }
          const scriptIsInteract = a.script?.nodes?.some(n => n.id === 'start' && n.data?.label === 'On Interact');

          if (scene.type === 'SHMUP' && a.type !== 'player') {
            actorLogicCode += `            // SHMUP distance culling (always runs, supports reactivation)\n`;
            actorLogicCode += `            {\n`;
            actorLogicCode += `                int diff_x = actor_${i}_x - (cam_x + ${Math.floor(sDims.w / 2)});\n`;
            actorLogicCode += `                int diff_y = actor_${i}_y - (cam_y + ${Math.floor(sDims.h / 2)});\n`;
            actorLogicCode += `                if (diff_x < -180 || diff_x > 180 || diff_y < -120 || diff_y > 120) {\n`;
            actorLogicCode += `                    actor_${i}_active = false;\n`;
            actorLogicCode += `                    actor_${i}_sprite.set_visible(false);\n`;
            actorLogicCode += `                } else if (!actor_${i}_active) {\n`;
            actorLogicCode += `                    actor_${i}_active = true;\n`;
            actorLogicCode += `                    actor_${i}_sprite.set_visible(true);\n`;
            actorLogicCode += `                }\n`;
            actorLogicCode += `            }\n`;
          }
          if (a.type === 'crumbling_platform') {
            actorLogicCode += `        if (actor_${i}_active || actor_${i}_respawning) {\n`;
          } else {
            actorLogicCode += `        if (actor_${i}_active) {\n`;
          }
          if (a.useVarScaleX || a.useVarScaleY || a.useVarRotation) {
            const dynSX = a.useVarScaleX && a.varScaleX ? a.varScaleX.replace(/[^a-zA-Z0-9_]/g, '_') : (a.scaleX ?? 1);
            const dynSY = a.useVarScaleY && a.varScaleY ? a.varScaleY.replace(/[^a-zA-Z0-9_]/g, '_') : (a.scaleY ?? 1);
            const dynRot = a.useVarRotation && a.varRotation ? a.varRotation.replace(/[^a-zA-Z0-9_]/g, '_') : (a.rotation ?? 0);
            actorLogicCode += `            actor_${i}_affine.set_scale(${dynSX}, ${dynSY});\n`;
            actorLogicCode += `            actor_${i}_affine.set_rotation_angle(${dynRot});\n`;
          }
          if (a.type === 'player') {
            actorLogicCode += `            if (actor_${i}_invincible_timer > 0) {\n`;
            actorLogicCode += `                actor_${i}_invincible_timer--;\n`;
            actorLogicCode += `                actor_${i}_sprite.set_visible((actor_${i}_invincible_timer % 4) < 2);\n`;
            actorLogicCode += `            } else {\n`;
            actorLogicCode += `                actor_${i}_sprite.set_visible(true);\n`;
            actorLogicCode += `            }\n`;
            actorLogicCode += `            if (actor_${i}_speed_timer > 0) {\n`;
            actorLogicCode += `                actor_${i}_speed_timer--;\n`;
            actorLogicCode += `            }\n`;
            actorLogicCode += `            if (PLAYER_MAGNET > 0) {\n`;
            actorLogicCode += `                PLAYER_MAGNET--;\n`;
            // Pull all magnet target types toward player
            const allMagnetTargets = new Set();
            let mRadiusExpr = 'bn::fixed(32)';
            let mStrengthExpr = 'bn::fixed(1)';
            
            const allMagnets = [...scenes.flatMap(s => s.actors || []), ...(globalActors || [])].filter(act => act.type === 'magnet');
            allMagnets.forEach((act, mIdx) => {
              if (mIdx === 0) {
                if (act.useVarMagnetRadius && act.varMagnetRadius) {
                  mRadiusExpr = `bn::fixed(${act.varMagnetRadius.replace(/[^a-zA-Z0-9_]/g, '_')})`;
                } else if (act.magnetRadius !== undefined) {
                  mRadiusExpr = `bn::fixed(${act.magnetRadius})`;
                }
                if (act.useVarMagnetStrength && act.varMagnetStrength) {
                  mStrengthExpr = `bn::fixed(${act.varMagnetStrength.replace(/[^a-zA-Z0-9_]/g, '_')})`;
                } else if (act.magnetStrength !== undefined) {
                  mStrengthExpr = `bn::fixed(${act.magnetStrength})`;
                }
              }
              if (act.magnetTargets) {
                act.magnetTargets.forEach(t => allMagnetTargets.add(t));
              }
            });

            allMagnetTargets.forEach(targetType => {
              const targetActors = sActors.filter(act => act.type === targetType);
              targetActors.forEach(target => {
                const targetIdx = sActors.indexOf(target);
                actorLogicCode += `                if (actor_${targetIdx}_active) {\n`;
                actorLogicCode += `                    bn::fixed dx = actor_${i}_float_x - actor_${targetIdx}_float_x;\n`;
                actorLogicCode += `                    bn::fixed dy = actor_${i}_float_y - actor_${targetIdx}_float_y;\n`;
                actorLogicCode += `                    bn::fixed dist_sq = (dx * dx) + (dy * dy);\n`;
                actorLogicCode += `                    bn::fixed m_rad_sq = ${mRadiusExpr} * ${mRadiusExpr};\n`;
                actorLogicCode += `                    if (dist_sq > bn::fixed(16) && dist_sq < m_rad_sq) {\n`;
                actorLogicCode += `                        bn::fixed dist = bn::sqrt(dist_sq);\n`;
                actorLogicCode += `                        actor_${targetIdx}_float_x += (dx / dist) * ${mStrengthExpr};\n`;
                actorLogicCode += `                        actor_${targetIdx}_float_y += (dy / dist) * ${mStrengthExpr};\n`;
                  actorLogicCode += `                        actor_${targetIdx}_x = actor_${targetIdx}_float_x.integer();\n`;
                  actorLogicCode += `                        actor_${targetIdx}_y = actor_${targetIdx}_float_y.integer();\n`;
                actorLogicCode += `                    }\n`;
                actorLogicCode += `                }\n`;
              });
            });
            actorLogicCode += `            }\n`;
            if (a.playerFireProjectiles || a.playerAnimFireProjectile) {
              actorLogicCode += `            if (actor_${i}_shoot_timer > 0) { actor_${i}_shoot_timer--; }\n`;
            }
            if (a.playerFireProjectiles) {
              const fireRate = a.playerFireRate ?? 15;
              const button = a.playerFireButton || 'b';
              actorLogicCode += `            if (bn::keypad::${button}_held() && actor_${i}_shoot_timer == 0 && PLAYER_AMMO > 0) {\n`;
              actorLogicCode += `                actor_${i}_shoot_timer = ${fireRate};\n`;
              actorLogicCode += `                actor_${i}_fire_proj();\n`;
              actorLogicCode += `                PLAYER_AMMO--;\n`;
              actorLogicCode += `            }\n`;
            }
            // Check for grenade throwing
            const grenadeActors = sActors.filter(act => act.type === 'grenade');
            if (grenadeActors.length > 0) {
              actorLogicCode += `            if (PLAYER_GRENADES > 0) {\n`;
              grenadeActors.forEach(grenade => {
                const throwButton = grenade.grenadeThrowButton || 'b';
                const throwRate = grenade.grenadeThrowRate ?? 30;
                actorLogicCode += `                if (bn::keypad::${throwButton}_pressed() && actor_${i}_grenade_timer == 0) {\n`;
                actorLogicCode += `                    PLAYER_GRENADES--;\n`;
                actorLogicCode += `                    actor_${i}_grenade_timer = ${throwRate};\n`;
                actorLogicCode += `                    for(int g=0; g<5; ++g) {\n`;
                actorLogicCode += `                        if(!grenade_active[g]) {\n`;
                actorLogicCode += `                            grenade_x[g] = actor_${i}_x + ${Math.floor((a.width || 16) / 2)};\n`;
                actorLogicCode += `                            grenade_y[g] = actor_${i}_y + ${Math.floor((a.height || 16) / 2)};\n`;
                // Throw in the direction the player is facing
                actorLogicCode += `                            if (actor_${i}_dx > 0) grenade_dx[g] = bn::fixed(2);\n`;
                actorLogicCode += `                            else if (actor_${i}_dx < 0) grenade_dx[g] = bn::fixed(-2);\n`;
                actorLogicCode += `                            else grenade_dx[g] = bn::fixed(actor_${i}_sprite.horizontal_flip() ? -2 : 2);\n`;
                actorLogicCode += `                            grenade_dy[g] = bn::fixed(-3);\n`;
                actorLogicCode += `                            grenade_active[g] = true;\n`;
                actorLogicCode += `                            grenade_timer[g] = 60;\n`;
                actorLogicCode += `                            grenade_sprites[g] = bn::sprite_items::bullet_sprite.create_sprite(grenade_x[g] - ${Math.floor(sDims.w / 2)}, grenade_y[g] - ${Math.floor(sDims.h / 2)});\n`;
                actorLogicCode += `                            grenade_sprites[g]->set_palette(shared_sprite_palette);
                            grenade_sprites[g]->set_camera(camera);
                            grenade_sprites[g]->set_bg_priority(1);
                            break;\n`;
                actorLogicCode += `                            break;\n`;
                actorLogicCode += `                        }\n`;
                actorLogicCode += `                    }\n`;
                actorLogicCode += `                }\n`;
              });
              actorLogicCode += `            }\n`;
              actorLogicCode += `            if (actor_${i}_grenade_timer > 0) actor_${i}_grenade_timer--;\n`;
            }
            if (scene.type !== 'RACING') {
              actorLogicCode += `            bn::fixed target_dx = 0;\n`;
              if (scene.type !== 'PLATFORMER') {
                actorLogicCode += `            bn::fixed target_dy = 0;\n`;
              }
            }
            if (scene.type === 'PLATFORMER') {
              actorLogicCode += `            bool on_ground = false;\n`;
              actorLogicCode += `            bool on_ice = false;\n`;
              actorLogicCode += `            bn::fixed slide_friction = 0.05;\n`;
              // Ladder climbing state check
              actorLogicCode += `            bool on_ladder = false;\n`;
              for (let j = 0; j < sActors.length; j++) {
                const ladder = sActors[j];
                if (ladder.type === 'ladder') {
                  const lCW = ladder.collisionW ?? ladder.width ?? 16;
                  const lCH = ladder.collisionH ?? ladder.height ?? 16;
                  const lCX = ladder.collisionX ?? 0;
                  const lCY = ladder.collisionY ?? 0;
                  actorLogicCode += `            if (actor_${j}_active) {\n`;
                  actorLogicCode += `                int px_l = actor_${i}_float_x.integer() + ${a.collisionX ?? 0};\n`;
                  actorLogicCode += `                int px_r = px_l + ${a.collisionW ?? a.width ?? 16};\n`;
                  actorLogicCode += `                int py_t = actor_${i}_float_y.integer() + ${a.collisionY ?? 0};\n`;
                  actorLogicCode += `                int py_b = py_t + ${a.collisionH ?? a.height ?? 16};\n`;
                  actorLogicCode += `                int lx_l = actor_${j}_x + ${lCX};\n`;
                  actorLogicCode += `                int lx_r = lx_l + ${lCW};\n`;
                  actorLogicCode += `                int ly_t = actor_${j}_y + ${lCY};\n`;
                  actorLogicCode += `                int ly_b = ly_t + ${lCH};\n`;
                  actorLogicCode += `                if (px_r > lx_l && px_l < lx_r && py_b > ly_t && py_t < ly_b) {\n`;
                  actorLogicCode += `                    on_ladder = true;\n`;
                  actorLogicCode += `                }\n`;
                  actorLogicCode += `            }\n`;
                }
              }
              actorLogicCode += `            // Also check collision map tiles for ladders\n`;
              actorLogicCode += `            {\n`;
              actorLogicCode += `                int px_l = actor_${i}_float_x.integer() + ${a.collisionX ?? 0};\n`;
              actorLogicCode += `                int px_r = px_l + ${a.collisionW ?? a.width ?? 16} - 1;\n`;
              actorLogicCode += `                int py_t = actor_${i}_float_y.integer() + ${a.collisionY ?? 0};\n`;
              actorLogicCode += `                int py_b = py_t + ${a.collisionH ?? a.height ?? 16} - 1;\n`;
              actorLogicCode += `                for (int tx = px_l / 8; tx <= px_r / 8; ++tx) {\n`;
              actorLogicCode += `                    for (int ty = py_t / 8; ty <= py_b / 8; ++ty) {\n`;
              actorLogicCode += `                        if (${safeSceneName}_map::get_collision(tx, ty) == ${safeSceneName}_map::collision_type::LADDER) {\n`;
              actorLogicCode += `                            on_ladder = true;\n`;
              actorLogicCode += `                        }\n`;
              actorLogicCode += `                    }\n`;
              actorLogicCode += `                }\n`;
              actorLogicCode += `            }\n`;
              actorLogicCode += `            if (on_ladder && (bn::keypad::up_held() || bn::keypad::down_held())) {\n`;
              actorLogicCode += `                actor_${i}_climbing = true;\n`;
              actorLogicCode += `            }\n`;
              actorLogicCode += `            if (!on_ladder) {\n`;
              actorLogicCode += `                actor_${i}_climbing = false;\n`;
              actorLogicCode += `            }\n`;

              actorLogicCode += `            if (actor_${i}_climbing) {\n`;
              // actorLogicCode += `                actor_${i}_on_wall = 0;\n`;
              actorLogicCode += `                target_dx = 0;\n`;
              actorLogicCode += `                actor_${i}_dy = 0;\n`;
              actorLogicCode += `                if (bn::keypad::up_held()) actor_${i}_dy = -1;\n`;
              actorLogicCode += `                else if (bn::keypad::down_held()) actor_${i}_dy = 1;\n`;
              actorLogicCode += `                if (bn::keypad::left_held()) target_dx = -bn::fixed(${scene.horizontalSpeed ?? 1.5});\n`;
              actorLogicCode += `                else if (bn::keypad::right_held()) target_dx = bn::fixed(${scene.horizontalSpeed ?? 1.5});\n`;
              actorLogicCode += `                if (bn::keypad::a_pressed()) {\n`;
              actorLogicCode += `                    actor_${i}_climbing = false;\n`;
              actorLogicCode += `                    actor_${i}_dy = bn::fixed(${scene.jumpVelocity ?? -5.0});\n`;
              if (a.doubleJump) {
                actorLogicCode += `                    actor_${i}_double_jumped = false;\n`;
              }
              actorLogicCode += `                }\n`;
              actorLogicCode += `            } else {\n`;

              // actorLogicCode += `            actor_${i}_on_wall = 0;\n`;
              actorLogicCode += `            if (bn::keypad::left_held()) target_dx = -bn::fixed(${scene.horizontalSpeed ?? 1.5});\n`;
              actorLogicCode += `            else if (bn::keypad::right_held()) target_dx = bn::fixed(${scene.horizontalSpeed ?? 1.5});\n`;
              actorLogicCode += `            actor_${i}_dy += bn::fixed(${scene.gravity ?? 0.5});\n`;
              // actorLogicCode += `            if (actor_${i}_on_wall != 0 && actor_${i}_dy > bn::fixed(0.5)) { actor_${i}_dy = bn::fixed(0.5); }\n`;
              actorLogicCode += `            if (actor_${i}_dy < 0 && !bn::keypad::a_held()) {\n`;
              actorLogicCode += `                actor_${i}_dy /= 2;\n`;
              actorLogicCode += `            }\n`;
              actorLogicCode += `            if (actor_${i}_dy > bn::fixed(${scene.maxFallVelocity ?? 8.0})) actor_${i}_dy = bn::fixed(${scene.maxFallVelocity ?? 8.0});\n`;
              actorLogicCode += `            if (actor_${i}_drop_through_timer > 0) actor_${i}_drop_through_timer--;\n`;
              actorLogicCode += `            if (actor_${i}_speed_timer > 0) {\n`;
              actorLogicCode += `                target_dx = target_dx * 2;\n`;
              actorLogicCode += `                if (actor_${i}_climbing) actor_${i}_dy = actor_${i}_dy * 2;\n`;
              actorLogicCode += `            }\n`;
              actorLogicCode += `            on_ground = false;\n`;
              actorLogicCode += `            if (check_ground_collision(actor_${i}_float_x, actor_${i}_float_y + 1, ${a.collisionX ?? 0}, ${a.collisionY ?? 0}, ${a.collisionW ?? a.width ?? 16}, ${a.collisionH ?? a.height ?? 16})) {\n`;
              actorLogicCode += `                on_ground = true;\n`;
              actorLogicCode += `                if (actor_${i}_dy > 0) {\n`;
              actorLogicCode += `                    int ck_bottom = (actor_${i}_float_y + 1).integer() + ${a.collisionY ?? 0} + ${a.collisionH ?? a.height ?? 16};\n`;
              actorLogicCode += `                    int ck_ty = (ck_bottom - 1) / 8;\n`;
              actorLogicCode += `                    actor_${i}_float_y = (ck_ty * 8) - ${a.collisionY ?? 0} - ${a.collisionH ?? a.height ?? 16};\n`;
              actorLogicCode += `                    actor_${i}_dy = 0;\n`;
              actorLogicCode += `                }\n`;
              actorLogicCode += `            }\n`;
              for (let j = 0; j < sActors.length; j++) {
                if (i === j) continue;
                const platform = sActors[j];
                if (platform.type === 'platform' || platform.type === 'staticPlatform' || platform.type === 'movingPlatform' || platform.type === 'destructible' || platform.type === 'door' || platform.type === 'pushable' || platform.type === 'conveyor' || platform.type === 'ice_block' || platform.type === 'crumbling_platform' || platform.type === 'pass_wall' || (platform.type === 'one_way_wall' && platform.oneWayDirection === 'down')) {
                  const pCW = platform.collisionW ?? platform.width ?? 16;
                  const pCH = platform.collisionH ?? platform.height ?? 16;
                  const pCX = platform.collisionX ?? 0;
                  const pCY = platform.collisionY ?? 0;

                  const activeCond = platform.type === 'pass_wall' ? `actor_${j}_active && actor_${j}_pass_count == 0` : `actor_${j}_active`;
                  if (platform.jumpThrough && platform.jumpThroughDown) {
                    actorLogicCode += `            if (${activeCond} && actor_${i}_dy >= 0 && actor_${i}_drop_through_timer == 0) {\n`;
                    actorLogicCode += `                if (bn::keypad::down_held() && bn::keypad::a_pressed()) {\n`;
                    actorLogicCode += `                    actor_${i}_drop_through_timer = 15;\n`;
                    actorLogicCode += `                    actor_${i}_float_y += 4;\n`;
                    actorLogicCode += `                } else {\n`;
                  } else {
                    actorLogicCode += `            if (${activeCond} && actor_${i}_dy >= 0) {\n`;
                  }

                  actorLogicCode += `                int px = actor_${i}_float_x.integer() + ${a.collisionX ?? 0} + ${Math.floor((a.collisionW ?? a.width ?? 16) / 2)};\n`;
                  actorLogicCode += `                int py = actor_${i}_float_y.integer() + ${a.collisionY ?? 0} + ${a.collisionH ?? a.height ?? 16};\n`;
                  actorLogicCode += `                int plat_l = actor_${j}_x + ${pCX};\n`;
                  actorLogicCode += `                int plat_r = actor_${j}_x + ${pCX} + ${pCW};\n`;
                  actorLogicCode += `                int plat_t = actor_${j}_y + ${pCY};\n`;


                  if (platform.type === 'destructible') {
                    const breakBy = platform.destructibleBreakBy || 'any';
                    const canBreakFromStomp = (breakBy === 'any' || breakBy === 'stomp');
                    actorLogicCode += `                if (px >= plat_l && px <= plat_r && py >= plat_t && py < plat_t + 8) {\n`;
                    if (canBreakFromStomp) {
                      actorLogicCode += `                    actor_${j}_hp--;\n`;
                      actorLogicCode += `                    actor_${i}_dy = -3;\n`;
                      actorLogicCode += `                    bn::sound_items::snd_square_440_100.play();\n`;
                      actorLogicCode += `                    if (actor_${j}_hp <= 0) {\n`;
                      actorLogicCode += `                        actor_${j}_active = false;\n`;
                      actorLogicCode += `                        actor_${j}_sprite.set_visible(false);\n`;
                      if (platform.destructibleDropActorId) {
                        const dropIdx = sActors.findIndex(act => act && String(act.id) === String(platform.destructibleDropActorId));
                        if (dropIdx !== -1) {
                          actorLogicCode += `                        actor_${dropIdx}_float_x = actor_${j}_x;\n`;
                          actorLogicCode += `                        actor_${dropIdx}_float_y = actor_${j}_y;\n`;
                          actorLogicCode += `                        actor_${dropIdx}_x = actor_${j}_x;\n`;
                          actorLogicCode += `                        actor_${dropIdx}_y = actor_${j}_y;\n`;
                          actorLogicCode += `                        actor_${dropIdx}_active = true;\n`;
                          actorLogicCode += `                        actor_${dropIdx}_sprite.set_visible(true);\n`;
                        }
                      }
                      let blockScript = generateScriptLogic(platform.script, j, platform.width, platform.height, undefined, undefined, scCtx);
                      if (blockScript) {
                        actorLogicCode += blockScript;
                      }
                      actorLogicCode += `                    } else {\n`;
                      actorLogicCode += `                        on_ground = true;\n`;
                      actorLogicCode += `                        actor_${i}_float_y = plat_t - (${a.collisionY ?? 0} + ${a.collisionH ?? a.height ?? 16});\n`;
                      actorLogicCode += `                    }\n`;
                    } else {
                      actorLogicCode += `                    on_ground = true;\n`;
                      actorLogicCode += `                    actor_${i}_float_y = plat_t - (${a.collisionY ?? 0} + ${a.collisionH ?? a.height ?? 16});\n`;
                      actorLogicCode += `                    if (actor_${i}_dy > 0) actor_${i}_dy = 0;\n`;
                    }
                    actorLogicCode += `                }\n`;
                  } else {
                    actorLogicCode += `                if (px >= plat_l && px <= plat_r && py >= plat_t && py < plat_t + 8) {\n`;
                    actorLogicCode += `                    on_ground = true;\n`;
                    actorLogicCode += `                    actor_${i}_float_y = plat_t - (${a.collisionY ?? 0} + ${a.collisionH ?? a.height ?? 16});\n`;
                    actorLogicCode += `                    if (actor_${i}_dy > 0) actor_${i}_dy = 0;\n`;
                    const isMovingPlat = platform.isMoving ?? (platform.type === 'movingPlatform' || platform.type === 'pushable');
                    if (isMovingPlat) {
                      actorLogicCode += `                    actor_${i}_float_x += actor_${j}_dx;\n`;
                      actorLogicCode += `                    actor_${i}_float_y += actor_${j}_dy;\n`;
                    }
                    if (platform.moveOnlyOnStand) {
                      actorLogicCode += `                    actor_${j}_player_on = true;\n`;
                    }
                    if (platform.type === 'ice_block') {
                      actorLogicCode += `                    on_ice = true;\n`;
                      actorLogicCode += `                    slide_friction = bn::fixed(${platform.iceFriction ?? 0.05});\n`;
                    }
                    actorLogicCode += `                }\n`;
                  }

                  if (platform.jumpThrough && platform.jumpThroughDown) {
                    actorLogicCode += `                }\n`;
                  }
                  actorLogicCode += `            }\n`;
                }
              }
              if (a.doubleJump) {
                actorLogicCode += `            if (on_ground) {\n`;
                actorLogicCode += `                actor_${i}_double_jumped = false;\n`;
                actorLogicCode += `            }\n`;
                actorLogicCode += `            if (bn::keypad::a_pressed()) {\n`;
                actorLogicCode += `                if (on_ground) {\n`;
                actorLogicCode += `                    actor_${i}_dy = bn::fixed(${scene.jumpVelocity ?? -5.0});\n`;
                actorLogicCode += `                } else if (!actor_${i}_double_jumped) {\n`;
                actorLogicCode += `                    actor_${i}_dy = bn::fixed(${scene.jumpVelocity ?? -5.0});\n`;
                actorLogicCode += `                    actor_${i}_double_jumped = true;\n`;
                actorLogicCode += `                }\n`;
                actorLogicCode += `            }\n`;
              } else {
                actorLogicCode += `            if (on_ground && bn::keypad::a_pressed()) actor_${i}_dy = bn::fixed(${scene.jumpVelocity ?? -5.0});\n`;
              }
              actorLogicCode += `            }\n`;
            } else if (scene.type === 'SHMUP' && scene.mode7) {
              actorLogicCode += `            if (bn::keypad::left_held()) actor_${i}_float_x -= bn::fixed(${scene.horizontalSpeed ?? 1.5});\n`;
              actorLogicCode += `            else if (bn::keypad::right_held()) actor_${i}_float_x += bn::fixed(${scene.horizontalSpeed ?? 1.5});\n`;
              actorLogicCode += `            if (bn::keypad::up_held()) actor_${i}_float_y -= bn::fixed(${scene.verticalSpeed ?? scene.horizontalSpeed ?? 1.5});\n`;
              actorLogicCode += `            else if (bn::keypad::down_held()) actor_${i}_float_y += bn::fixed(${scene.verticalSpeed ?? scene.horizontalSpeed ?? 1.5});\n`;
              if (scene.autoScroll !== false) {
                actorLogicCode += `            actor_${i}_float_y += current_scroll_speed_y;\n`;
              }
              // Clamp to map boundaries
              actorLogicCode += `            if (actor_${i}_float_x < 0) actor_${i}_float_x = 0;\n`;
              actorLogicCode += `            if (actor_${i}_float_x > ${sDims.w}) actor_${i}_float_x = ${sDims.w};\n`;
              actorLogicCode += `            if (actor_${i}_float_y < 0) actor_${i}_float_y = 0;\n`;
              actorLogicCode += `            if (actor_${i}_float_y > ${sDims.h}) actor_${i}_float_y = ${sDims.h};\n`;
              // Sync camera
              actorLogicCode += `            m7_cam_x = actor_${i}_float_x;\n`;
              actorLogicCode += `            m7_cam_z = actor_${i}_float_y;\n`;
             } else if (scene.type === 'RACING' && scene.mode7) {
              let maxSpeedExpr = `bn::fixed(${scene.maxSpeed ?? 1.0})`;
              let maxSpeedHalfExpr = `bn::fixed(${Number(((scene.maxSpeed ?? 1.0) / 2).toFixed(4))})`;
              if (scene.useVarMaxSpeed && scene.maxSpeedVar) {
                const cleanedVar = scene.maxSpeedVar.replace(/[^a-zA-Z0-9_]/g, '_');
                maxSpeedExpr = `${cleanedVar}`;
                maxSpeedHalfExpr = `(${cleanedVar} / 2)`;
              }

              let accelExpr = `bn::fixed(${scene.acceleration ?? 0.01})`;
              if (scene.useVarAcceleration && scene.accelerationVar) {
                const cleanedVar = scene.accelerationVar.replace(/[^a-zA-Z0-9_]/g, '_');
                accelExpr = `${cleanedVar}`;
              }

              let frictionExpr = `bn::fixed(${scene.friction ?? 0.5})`;
              if (scene.useVarFriction && scene.frictionVar) {
                const cleanedVar = scene.frictionVar.replace(/[^a-zA-Z0-9_]/g, '_');
                frictionExpr = `${cleanedVar}`;
              }

               actorLogicCode += `            if (bn::keypad::left_held()) {\n`;
               actorLogicCode += `                m7_cam_phi -= 32;\n`;
               actorLogicCode += `            } else if (bn::keypad::right_held()) {\n`;
               actorLogicCode += `                m7_cam_phi += 32;\n`;
               actorLogicCode += `            }\n`;
               actorLogicCode += `            if (m7_cam_phi < 0) m7_cam_phi += 2048;\n`;
               actorLogicCode += `            if (m7_cam_phi >= 2048) m7_cam_phi -= 2048;\n`;
               actorLogicCode += `            bool accelerating = bn::keypad::up_held() || bn::keypad::a_held();\n`;
               actorLogicCode += `            bool braking = bn::keypad::down_held() || bn::keypad::b_held();\n`;
               actorLogicCode += `            if (accelerating) {\n`;
               actorLogicCode += `                actor_${i}_speed += ${accelExpr};\n`;
               actorLogicCode += `                if (actor_${i}_speed > ${maxSpeedExpr}) actor_${i}_speed = ${maxSpeedExpr};\n`;
               actorLogicCode += `            } else if (braking) {\n`;
               actorLogicCode += `                actor_${i}_speed -= ${accelExpr};\n`;
               actorLogicCode += `                if (actor_${i}_speed < -${maxSpeedHalfExpr}) actor_${i}_speed = -${maxSpeedHalfExpr};\n`;
               actorLogicCode += `            } else {\n`;
               actorLogicCode += `                if (actor_${i}_speed > 0) {\n`;
               actorLogicCode += `                    actor_${i}_speed -= ${frictionExpr};\n`;
               actorLogicCode += `                    if (actor_${i}_speed < 0) actor_${i}_speed = 0;\n`;
               actorLogicCode += `                } else if (actor_${i}_speed < 0) {\n`;
               actorLogicCode += `                    actor_${i}_speed += ${frictionExpr};\n`;
               actorLogicCode += `                    if (actor_${i}_speed > 0) actor_${i}_speed = 0;\n`;
               actorLogicCode += `                }\n`;
               actorLogicCode += `            }\n`;
               actorLogicCode += `            int m7_angle_deg = m7_cam_phi * 360 / 2048;\n`;
               actorLogicCode += `            {\n`;
               actorLogicCode += `                int m7_speed_int = actor_${i}_speed.data() >> 4;\n`;
               actorLogicCode += `                int m7_cos = bn::lut_cos(m7_cam_phi).data() >> 4;\n`;
               actorLogicCode += `                int m7_sin = bn::lut_sin(m7_cam_phi).data() >> 4;\n`;
               actorLogicCode += `                actor_${i}_float_x += bn::fixed::from_data((m7_speed_int * m7_sin) >> 4);\n`;
               actorLogicCode += `                actor_${i}_float_y -= bn::fixed::from_data((m7_speed_int * m7_cos) >> 4);\n`;
               actorLogicCode += `            }\n`;
               actorLogicCode += `            m7_cam_x = actor_${i}_float_x;\n`;
               actorLogicCode += `            m7_cam_z = actor_${i}_float_y;\n`;
               actorLogicCode += `            actor_${i}_affine.set_rotation_angle(0);\n`;
             } else if (scene.type === 'RACING') {
              let maxSpeedExpr = `bn::fixed(${scene.maxSpeed ?? 1.0})`;
              let maxSpeedHalfExpr = `bn::fixed(${Number(((scene.maxSpeed ?? 1.0) / 2).toFixed(4))})`;
              if (scene.useVarMaxSpeed && scene.maxSpeedVar) {
                const cleanedVar = scene.maxSpeedVar.replace(/[^a-zA-Z0-9_]/g, '_');
                maxSpeedExpr = `${cleanedVar}`;
                maxSpeedHalfExpr = `(${cleanedVar} / 2)`;
              }

              let accelExpr = `bn::fixed(${scene.acceleration ?? 0.01})`;
              if (scene.useVarAcceleration && scene.accelerationVar) {
                const cleanedVar = scene.accelerationVar.replace(/[^a-zA-Z0-9_]/g, '_');
                accelExpr = `${cleanedVar}`;
              }

              let frictionExpr = `bn::fixed(${scene.friction ?? 0.5})`;
              if (scene.useVarFriction && scene.frictionVar) {
                const cleanedVar = scene.frictionVar.replace(/[^a-zA-Z0-9_]/g, '_');
                frictionExpr = `${cleanedVar}`;
              }

               actorLogicCode += `            bn::fixed ratio_val = bn::abs(actor_${i}_speed) / ${maxSpeedExpr};\n`;
               actorLogicCode += `            bn::fixed current_speed_ratio = ratio_val > 1 ? bn::fixed(1) : ratio_val;\n`;
               actorLogicCode += `            bn::fixed current_steering = scene_steering_speed * (bn::fixed(1) - (current_speed_ratio * bn::fixed(0.5)));\n`;
               actorLogicCode += `            if (bn::keypad::left_held()) {\n`;
               actorLogicCode += `                actor_${i}_angle -= current_steering;\n`;
               actorLogicCode += `            } else if (bn::keypad::right_held()) {\n`;
               actorLogicCode += `                actor_${i}_angle += current_steering;\n`;
               actorLogicCode += `            }\n`;
               actorLogicCode += `            if (actor_${i}_angle < 0) actor_${i}_angle += 360;\n`;
               actorLogicCode += `            if (actor_${i}_angle >= 360) actor_${i}_angle -= 360;\n`;
               actorLogicCode += `            bool accelerating = bn::keypad::up_held() || bn::keypad::a_held();\n`;
               actorLogicCode += `            bool braking = bn::keypad::down_held() || bn::keypad::b_held();\n`;
               actorLogicCode += `            if (accelerating) {\n`;
               actorLogicCode += `                actor_${i}_speed += ${accelExpr};\n`;
               actorLogicCode += `                if (actor_${i}_speed > ${maxSpeedExpr}) actor_${i}_speed = ${maxSpeedExpr};\n`;
               actorLogicCode += `            } else if (braking) {\n`;
               actorLogicCode += `                actor_${i}_speed -= ${accelExpr};\n`;
               actorLogicCode += `                if (actor_${i}_speed < -${maxSpeedHalfExpr}) actor_${i}_speed = -${maxSpeedHalfExpr};\n`;
               actorLogicCode += `            } else {\n`;
               actorLogicCode += `                if (actor_${i}_speed > 0) {\n`;
               actorLogicCode += `                    actor_${i}_speed -= ${frictionExpr};\n`;
               actorLogicCode += `                    if (actor_${i}_speed < 0) actor_${i}_speed = 0;\n`;
               actorLogicCode += `                } else if (actor_${i}_speed < 0) {\n`;
               actorLogicCode += `                    actor_${i}_speed += ${frictionExpr};\n`;
               actorLogicCode += `                    if (actor_${i}_speed > 0) actor_${i}_speed = 0;\n`;
               actorLogicCode += `                }\n`;
               actorLogicCode += `            }\n`;
              actorLogicCode += `            {\n`;
              actorLogicCode += `                bn::fixed target_dx = bn::degrees_lut_cos_safe(actor_${i}_angle) * actor_${i}_speed;\n`;
              actorLogicCode += `                bn::fixed target_dy = bn::degrees_lut_sin_safe(actor_${i}_angle) * actor_${i}_speed;\n`;
              actorLogicCode += `                actor_${i}_dx = (actor_${i}_dx * bn::fixed(0.85)) + (target_dx * bn::fixed(0.15));\n`;
              actorLogicCode += `                actor_${i}_dy = (actor_${i}_dy * bn::fixed(0.85)) + (target_dy * bn::fixed(0.15));\n`;
              actorLogicCode += `            }\n`;
              actorLogicCode += `            actor_${i}_affine.set_rotation_angle(actor_${i}_angle);\n`;
            } else {
              actorLogicCode += `            if (bn::keypad::left_held()) target_dx = -bn::fixed(${scene.horizontalSpeed ?? 1.0});\n`;
              actorLogicCode += `            else if (bn::keypad::right_held()) target_dx = bn::fixed(${scene.horizontalSpeed ?? 1.0});\n`;
              actorLogicCode += `            if (bn::keypad::up_held()) target_dy = -bn::fixed(${scene.verticalSpeed ?? scene.horizontalSpeed ?? 1.0});\n`;
              actorLogicCode += `            else if (bn::keypad::down_held()) target_dy = bn::fixed(${scene.verticalSpeed ?? scene.horizontalSpeed ?? 1.0});\n`;
              actorLogicCode += `            if (actor_${i}_speed_timer > 0) {\n`;
              actorLogicCode += `                target_dx = target_dx * 2;\n`;
              actorLogicCode += `                target_dy = target_dy * 2;\n`;
              actorLogicCode += `            }\n`;
            }

            if (scene.type !== 'RACING') {
              const fVal = Number((scene.friction ?? 1.0).toFixed(4));
              if (scene.type === 'PLATFORMER') {
                actorLogicCode += `            bn::fixed current_friction = on_ice ? slide_friction : bn::fixed(${fVal});\n`;
                actorLogicCode += `            actor_${i}_dx = (actor_${i}_dx * (1 - current_friction)) + (target_dx * current_friction);\n`;
                actorLogicCode += `            if (actor_${i}_dx < 0.05 && actor_${i}_dx > -0.05) actor_${i}_dx = 0;\n`;
              } else {
                actorLogicCode += `            actor_${i}_dx = (actor_${i}_dx * bn::fixed(${Number((1 - fVal).toFixed(4))})) + (target_dx * bn::fixed(${fVal}));\n`;
                actorLogicCode += `            actor_${i}_dy = (actor_${i}_dy * bn::fixed(${Number((1 - fVal).toFixed(4))})) + (target_dy * bn::fixed(${fVal}));\n`;
                actorLogicCode += `            if (actor_${i}_dx < 0.05 && actor_${i}_dx > -0.05) actor_${i}_dx = 0;\n`;
                actorLogicCode += `            if (actor_${i}_dy < 0.05 && actor_${i}_dy > -0.05) actor_${i}_dy = 0;\n`;
              }
            }

            // Coin / Bonus interaction check
            for (let j = 0; j < sActors.length; j++) {
              const coin = sActors[j];
              if (coin.type === 'coin' || coin.type === 'bonus') {
                const cCW = coin.collisionW ?? coin.width ?? 16;
                const cCH = coin.collisionH ?? coin.height ?? 16;
                const cCX = coin.collisionX ?? 0;
                const cCY = coin.collisionY ?? 0;

                let maxBonusScriptCompiled = '';
                if (a.playerBonusMaxScriptId) {
                  const maxBonusScriptObj = customScripts.find(cs => cs && Number(cs.id) === Number(a.playerBonusMaxScriptId));
                  if (maxBonusScriptObj) {
                    maxBonusScriptCompiled = generateScriptLogic(maxBonusScriptObj.script, i, a.width, a.height, undefined, undefined, scCtx);
                  }
                }

                actorLogicCode += `            if (actor_${j}_active) {\n`;
                actorLogicCode += `                int px_l = actor_${i}_float_x.integer() + ${a.collisionX ?? 0};\n`;
                actorLogicCode += `                int px_r = px_l + ${a.collisionW ?? a.width ?? 16};\n`;
                actorLogicCode += `                int py_t = actor_${i}_float_y.integer() + ${a.collisionY ?? 0};\n`;
                actorLogicCode += `                int py_b = py_t + ${a.collisionH ?? a.height ?? 16};\n`;
                actorLogicCode += `                int cx_l = actor_${j}_x + ${cCX};\n`;
                actorLogicCode += `                int cx_r = cx_l + ${cCW};\n`;
                actorLogicCode += `                int cy_t = actor_${j}_y + ${cCY};\n`;
                actorLogicCode += `                int cy_b = cy_t + ${cCH};\n`;
                actorLogicCode += `                if (px_r > cx_l && px_l < cx_r && py_b > cy_t && py_t < cy_b) {\n`;
                actorLogicCode += `                    actor_${j}_active = false;\n`;
                actorLogicCode += `                    actor_${j}_sprite.set_visible(false);\n`;
                actorLogicCode += `                    bn::sound_items::snd_square_440_100.play();\n`;
                actorLogicCode += `                    actor_${i}_bonus++;\n`;
                actorLogicCode += `                    if (actor_${i}_bonus >= actor_${i}_max_bonus) {\n`;
                actorLogicCode += `                        actor_${i}_bonus = 0;\n`;
                if (maxBonusScriptCompiled) {
                  actorLogicCode += maxBonusScriptCompiled;
                }
                actorLogicCode += `                    }\n`;
                let coinScriptCode = generateScriptLogic(coin.script, j, coin.width, coin.height, undefined, undefined, scCtx);
                if (coinScriptCode) {
                  actorLogicCode += coinScriptCode;
                }
                actorLogicCode += `                }\n`;
                actorLogicCode += `            }\n`;
              }
            }

            // Key interaction check
            for (let j = 0; j < sActors.length; j++) {
              const key = sActors[j];
              if (key.type === 'key') {
                const kCW = key.collisionW ?? key.width ?? 16;
                const kCH = key.collisionH ?? key.height ?? 16;
                const kCX = key.collisionX ?? 0;
                const kCY = key.collisionY ?? 0;
                actorLogicCode += `            if (actor_${j}_active) {\n`;
                actorLogicCode += `                int px_l = actor_${i}_float_x.integer() + ${a.collisionX ?? 0};\n`;
                actorLogicCode += `                int px_r = px_l + ${a.collisionW ?? a.width ?? 16};\n`;
                actorLogicCode += `                int py_t = actor_${i}_float_y.integer() + ${a.collisionY ?? 0};\n`;
                actorLogicCode += `                int py_b = py_t + ${a.collisionH ?? a.height ?? 16};\n`;
                actorLogicCode += `                int kx_l = actor_${j}_x + ${kCX};\n`;
                actorLogicCode += `                int kx_r = kx_l + ${kCW};\n`;
                actorLogicCode += `                int ky_t = actor_${j}_y + ${kCY};\n`;
                actorLogicCode += `                int ky_b = ky_t + ${kCH};\n`;
                actorLogicCode += `                if (px_r > kx_l && px_l < kx_r && py_b > ky_t && py_t < ky_b) {\n`;
                actorLogicCode += `                    actor_${j}_active = false;\n`;
                actorLogicCode += `                    actor_${j}_sprite.set_visible(false);\n`;
                const targetsValidDoor = key.unlockDoorActorId && sActors.some(act => act && act.type === 'door' && act.id === key.unlockDoorActorId);
                if (!targetsValidDoor) {
                  actorLogicCode += `                    PLAYER_KEYS++;\n`;
                }
                actorLogicCode += `                    bn::sound_items::snd_square_440_100.play();\n`;
                let keyScriptCode = generateScriptLogic(key.script, j, key.width, key.height, undefined, undefined, scCtx);
                if (keyScriptCode) {
                  actorLogicCode += keyScriptCode;
                }
                actorLogicCode += `                }\n`;
                actorLogicCode += `            }\n`;
              }
            }

            // Door interaction check
            for (let j = 0; j < sActors.length; j++) {
              const door = sActors[j];
              if (door.type === 'door') {
                const dCW = door.collisionW ?? door.width ?? 16;
                const dCH = door.collisionH ?? door.height ?? 16;
                const dCX = door.collisionX ?? 0;
                const dCY = door.collisionY ?? 0;
                actorLogicCode += `            if (actor_${j}_active) {\n`;
                actorLogicCode += `                int px_l = actor_${i}_float_x.integer() + ${a.collisionX ?? 0};\n`;
                actorLogicCode += `                int px_r = px_l + ${a.collisionW ?? a.width ?? 16};\n`;
                actorLogicCode += `                int py_t = actor_${i}_float_y.integer() + ${a.collisionY ?? 0};\n`;
                actorLogicCode += `                int py_b = py_t + ${a.collisionH ?? a.height ?? 16};\n`;
                actorLogicCode += `                int dx_l = actor_${j}_x + ${dCX};\n`;
                actorLogicCode += `                int dx_r = dx_l + ${dCW};\n`;
                actorLogicCode += `                int dy_t = actor_${j}_y + ${dCY};\n`;
                actorLogicCode += `                int dy_b = actor_${j}_y + ${dCY} + ${dCH};\n`;
                actorLogicCode += `                if (px_r + 1 > dx_l && px_l - 1 < dx_r && py_b + 1 > dy_t && py_t - 1 < dy_b) {\n`;

                const targetingKeyIndices = [];
                for (let k = 0; k < sActors.length; k++) {
                  const keyActor = sActors[k];
                  if (keyActor.type === 'key' && keyActor.unlockDoorActorId === door.id) {
                    targetingKeyIndices.push(k);
                  }
                }

                if (targetingKeyIndices.length > 0) {
                  const keyCondition = targetingKeyIndices.map(kIdx => `!actor_${kIdx}_active`).join(' && ');
                  actorLogicCode += `                    if (${keyCondition}) {\n`;
                  actorLogicCode += `                        actor_${j}_active = false;\n`;
                  actorLogicCode += `                        actor_${j}_sprite.set_visible(false);\n`;
                  actorLogicCode += `                        bn::sound_items::snd_square_440_100.play();\n`;
                  let doorScriptCode = "";
                  const doorUnlockScriptObj = door.doorUnlockScriptId ? customScripts.find(cs => cs && Number(cs.id) === Number(door.doorUnlockScriptId)) : null;
                  if (doorUnlockScriptObj) {
                    doorScriptCode = generateScriptLogic(doorUnlockScriptObj.script, j, door.width, door.height, undefined, undefined, scCtx);
                  } else {
                    doorScriptCode = generateScriptLogic(door.script, j, door.width, door.height, undefined, undefined, scCtx);
                  }
                  if (doorScriptCode) {
                    actorLogicCode += doorScriptCode;
                  }
                  actorLogicCode += `                    }\n`;
                } else {
                  actorLogicCode += `                    if (PLAYER_KEYS > 0) {\n`;
                  actorLogicCode += `                        PLAYER_KEYS--;\n`;
                  actorLogicCode += `                        actor_${j}_active = false;\n`;
                  actorLogicCode += `                        actor_${j}_sprite.set_visible(false);\n`;
                  actorLogicCode += `                        bn::sound_items::snd_square_440_100.play();\n`;
                  let doorScriptCode = "";
                  const doorUnlockScriptObj = door.doorUnlockScriptId ? customScripts.find(cs => cs && Number(cs.id) === Number(door.doorUnlockScriptId)) : null;
                  if (doorUnlockScriptObj) {
                    doorScriptCode = generateScriptLogic(doorUnlockScriptObj.script, j, door.width, door.height, undefined, undefined, scCtx);
                  } else {
                    doorScriptCode = generateScriptLogic(door.script, j, door.width, door.height, undefined, undefined, scCtx);
                  }
                  if (doorScriptCode) {
                    actorLogicCode += doorScriptCode;
                  }
                  actorLogicCode += `                    }\n`;
                }
                actorLogicCode += `                }\n`;
                actorLogicCode += `            }\n`;
              }
            }

            // Power-up interaction check
            for (let j = 0; j < sActors.length; j++) {
              const powerup = sActors[j];
              if (powerup.type === 'powerup') {
                const pCW = powerup.collisionW ?? powerup.width ?? 16;
                const pCH = powerup.collisionH ?? powerup.height ?? 16;
                const pCX = powerup.collisionX ?? 0;
                const pCY = powerup.collisionY ?? 0;
                const pType = powerup.powerupType || 'shield';
                const pDuration = powerup.powerupDuration ?? 300;
                actorLogicCode += `            if (actor_${j}_active) {\n`;
                actorLogicCode += `                int px_l = actor_${i}_float_x.integer() + ${a.collisionX ?? 0};\n`;
                actorLogicCode += `                int px_r = px_l + ${a.collisionW ?? a.width ?? 16};\n`;
                actorLogicCode += `                int py_t = actor_${i}_float_y.integer() + ${a.collisionY ?? 0};\n`;
                actorLogicCode += `                int py_b = py_t + ${a.collisionH ?? a.height ?? 16};\n`;
                actorLogicCode += `                int pux_l = actor_${j}_x + ${pCX};\n`;
                actorLogicCode += `                int pux_r = pux_l + ${pCW};\n`;
                actorLogicCode += `                int puy_t = actor_${j}_y + ${pCY};\n`;
                actorLogicCode += `                int puy_b = puy_t + ${pCH};\n`;
                actorLogicCode += `                if (px_r > pux_l && px_l < pux_r && py_b > puy_t && py_t < puy_b) {\n`;
                actorLogicCode += `                    actor_${j}_active = false;\n`;
                actorLogicCode += `                    actor_${j}_sprite.set_visible(false);\n`;
                actorLogicCode += `                    bn::sound_items::snd_square_440_100.play();\n`;
                if (pType === 'shield') {
                  actorLogicCode += `                    actor_${i}_invincible_timer = ${pDuration};\n`;
                } else if (pType === 'speed') {
                  actorLogicCode += `                    actor_${i}_speed_timer = ${pDuration};\n`;
                }
                let powerupScriptCode = generateScriptLogic(powerup.script, j, powerup.width, powerup.height, undefined, undefined, scCtx);
                if (powerupScriptCode) {
                  actorLogicCode += powerupScriptCode;
                }
                actorLogicCode += `                }\n`;
                actorLogicCode += `            }\n`;
              }
            }

            // Spring interaction check
            for (let j = 0; j < sActors.length; j++) {
              const spring = sActors[j];
              if (spring.type === 'spring') {
                const sCW = spring.collisionW ?? spring.width ?? 16;
                const sCH = spring.collisionH ?? spring.height ?? 16;
                const sCX = spring.collisionX ?? 0;
                const sCY = spring.collisionY ?? 0;
                actorLogicCode += `            if (actor_${j}_active) {\n`;
                actorLogicCode += `                int px_l = actor_${i}_float_x.integer() + ${a.collisionX ?? 0};\n`;
                actorLogicCode += `                int px_r = px_l + ${a.collisionW ?? a.width ?? 16};\n`;
                actorLogicCode += `                int py_b = actor_${i}_float_y.integer() + ${a.collisionY ?? 0} + ${a.collisionH ?? a.height ?? 16};\n`;
                actorLogicCode += `                int sx_l = actor_${j}_x + ${sCX};\n`;
                actorLogicCode += `                int sx_r = sx_l + ${sCW};\n`;
                actorLogicCode += `                int sy_t = actor_${j}_y + ${sCY};\n`;
                actorLogicCode += `                if (actor_${i}_dy >= 0 && px_r > sx_l && px_l < sx_r && py_b >= sy_t && py_b <= sy_t + 8) {\n`;
                actorLogicCode += `                    actor_${i}_dy = bn::fixed(${spring.bounceForce ?? -8.0});\n`;
                actorLogicCode += `                    actor_${i}_float_y = sy_t - (${a.collisionY ?? 0} + ${a.collisionH ?? a.height ?? 16});\n`;
                actorLogicCode += `                    bn::sound_items::snd_square_440_100.play();\n`;
                let springScriptCode = generateScriptLogic(spring.script, j, spring.width, spring.height, undefined, undefined, scCtx);
                if (springScriptCode) {
                  actorLogicCode += springScriptCode;
                }
                actorLogicCode += `                }\n`;
                actorLogicCode += `            }\n`;
              }
            }

            // Hazard interaction check
            for (let j = 0; j < sActors.length; j++) {
              const hazard = sActors[j];
              if (hazard.type === 'hazard') {
                const hCW = hazard.collisionW ?? hazard.width ?? 16;
                const hCH = hazard.collisionH ?? hazard.height ?? 16;
                const hCX = hazard.collisionX ?? 0;
                const hCY = hazard.collisionY ?? 0;
                actorLogicCode += `            if (actor_${j}_active) {\n`;
                actorLogicCode += `                int px_l = actor_${i}_float_x.integer() + ${a.collisionX ?? 0};\n`;
                actorLogicCode += `                int px_r = px_l + ${a.collisionW ?? a.width ?? 16};\n`;
                actorLogicCode += `                int py_t = actor_${i}_float_y.integer() + ${a.collisionY ?? 0};\n`;
                actorLogicCode += `                int py_b = py_t + ${a.collisionH ?? a.height ?? 16};\n`;
                actorLogicCode += `                int hx_l = actor_${j}_x + ${hCX};\n`;
                actorLogicCode += `                int hx_r = hx_l + ${hCW};\n`;
                actorLogicCode += `                int hy_t = actor_${j}_y + ${hCY};\n`;
                actorLogicCode += `                int hy_b = hy_t + ${hCH};\n`;
                actorLogicCode += `                if (px_r > hx_l && px_l < hx_r && py_b > hy_t && py_t < hy_b) {\n`;
                actorLogicCode += `                    if (actor_${i}_invincible_timer == 0) {\n`;
                const spawnX = a.useVarX && a.varX ? `(${a.varX.replace(/[^a-zA-Z0-9_]/g, '_')} * 8)` : a.x;
                const spawnY = a.useVarY && a.varY ? `(${a.varY.replace(/[^a-zA-Z0-9_]/g, '_')} * 8)` : a.y;
                actorLogicCode += `                        actor_${i}_hp--;\n`;
                actorLogicCode += `                        actor_${i}_invincible_timer = 60;\n`;
                actorLogicCode += `                        bn::sound_items::snd_square_440_100.play();\n`;
                actorLogicCode += `                        if (actor_${i}_hp <= 0) {\n`;
                if (a.type === 'player' && deathScriptCompiled) {
                  actorLogicCode += deathScriptCompiled;
                }
                actorLogicCode += `                            actor_${i}_float_x = global_spawn_x != -1 ? global_spawn_x : ${spawnX};\n`;
                actorLogicCode += `                            actor_${i}_float_y = global_spawn_y != -1 ? global_spawn_y : ${spawnY};\n`;
                actorLogicCode += `                            actor_${i}_dy = 0;\n`;
                actorLogicCode += `                            actor_${i}_hp = actor_${i}_max_hp;\n`;
                actorLogicCode += `                        }\n`;
                actorLogicCode += `                    }\n`;
                let hazardScriptCode = generateScriptLogic(hazard.script, j, hazard.width, hazard.height, undefined, undefined, scCtx);
                if (hazardScriptCode) {
                  actorLogicCode += hazardScriptCode;
                }
                actorLogicCode += `                }\n`;
                actorLogicCode += `            }\n`;
              }
            }

            // Destructible block bottom hit check
            for (let j = 0; j < sActors.length; j++) {
              const block = sActors[j];
              if (block.type === 'destructible') {
                const bCW = block.collisionW ?? block.width ?? 16;
                const bCH = block.collisionH ?? block.height ?? 16;
                const bCX = block.collisionX ?? 0;
                const bCY = block.collisionY ?? 0;
                const breakBy = block.destructibleBreakBy || 'any';
                const canBreakFromBelow = (breakBy === 'any' || breakBy === 'below');

                actorLogicCode += `            if (actor_${j}_active && actor_${i}_dy < 0) {\n`;
                actorLogicCode += `                int px_l = actor_${i}_float_x.integer() + ${a.collisionX ?? 0};\n`;
                actorLogicCode += `                int px_r = px_l + ${a.collisionW ?? a.width ?? 16};\n`;
                actorLogicCode += `                int py_t = actor_${i}_float_y.integer() + ${a.collisionY ?? 0};\n`;
                actorLogicCode += `                int bx_l = actor_${j}_x + ${bCX};\n`;
                actorLogicCode += `                int bx_r = bx_l + ${bCW};\n`;
                actorLogicCode += `                int by_b = actor_${j}_y + ${bCY} + ${bCH};\n`;
                actorLogicCode += `                if (px_r > bx_l && px_l < bx_r && py_t + actor_${i}_dy <= by_b && py_t >= by_b - 6) {\n`;
                actorLogicCode += `                    actor_${i}_dy = bn::fixed(0.5);\n`;
                if (canBreakFromBelow) {
                  actorLogicCode += `                    actor_${j}_hp--;\n`;
                  actorLogicCode += `                    bn::sound_items::snd_square_440_100.play();\n`;
                  actorLogicCode += `                    if (actor_${j}_hp <= 0) {\n`;
                  actorLogicCode += `                        actor_${j}_active = false;\n`;
                  actorLogicCode += `                        actor_${j}_sprite.set_visible(false);\n`;
                  if (block.destructibleDropActorId) {
                    const dropIdx = sActors.findIndex(act => act && String(act.id) === String(block.destructibleDropActorId));
                    if (dropIdx !== -1) {
                      actorLogicCode += `                        actor_${dropIdx}_float_x = actor_${j}_x;\n`;
                      actorLogicCode += `                        actor_${dropIdx}_float_y = actor_${j}_y;\n`;
                      actorLogicCode += `                        actor_${dropIdx}_x = actor_${j}_x;\n`;
                      actorLogicCode += `                        actor_${dropIdx}_y = actor_${j}_y;\n`;
                      actorLogicCode += `                        actor_${dropIdx}_active = true;\n`;
                      actorLogicCode += `                        actor_${dropIdx}_sprite.set_visible(true);\n`;
                    }
                  }
                  let blockScript = generateScriptLogic(block.script, j, block.width, block.height, undefined, undefined, scCtx);
                  if (blockScript) {
                    actorLogicCode += blockScript;
                  }
                  actorLogicCode += `                    }\n`;
                }
                actorLogicCode += `                }\n`;
                actorLogicCode += `            }\n`;
              }
            }

            // Enemy interaction check
            for (let j = 0; j < sActors.length; j++) {
              const enemy = sActors[j];
              if (enemy.type === 'enemy') {
                const eCW = enemy.collisionW ?? enemy.width ?? 16;
                const eCH = enemy.collisionH ?? enemy.height ?? 16;
                const eCX = enemy.collisionX ?? 0;
                const eCY = enemy.collisionY ?? 0;
                const enemyDeathScriptObj = enemy.enemyDeathScriptId
                  ? (customScripts.find(c => c && String(c.id) === String(enemy.enemyDeathScriptId))?.script || { nodes: [], edges: [] })
                  : enemy.script;
                const enemyDeathScript = generateScriptLogic(enemyDeathScriptObj, j, enemy.width, enemy.height, undefined, undefined, scCtx);
                actorLogicCode += `            if (actor_${j}_active) {\n`;
                actorLogicCode += `                int px_l = actor_${i}_float_x.integer() + ${a.collisionX ?? 0};\n`;
                actorLogicCode += `                int px_r = px_l + ${a.collisionW ?? a.width ?? 16};\n`;
                actorLogicCode += `                int py_t = actor_${i}_float_y.integer() + ${a.collisionY ?? 0};\n`;
                actorLogicCode += `                int py_b = py_t + ${a.collisionH ?? a.height ?? 16};\n`;
                actorLogicCode += `                int ex_l = actor_${j}_x + ${eCX};\n`;
                actorLogicCode += `                int ex_r = ex_l + ${eCW};\n`;
                actorLogicCode += `                int ey_t = actor_${j}_y + ${eCY};\n`;
                actorLogicCode += `                int ey_b = ey_t + ${eCH};\n`;
                actorLogicCode += `                if (px_r > ex_l && px_l < ex_r && py_b > ey_t && py_t < ey_b) {\n`;
                actorLogicCode += `                    if (actor_${i}_invincible_timer > 0) {\n`;
                actorLogicCode += `                        // Invincible: skip collision\n`;
                actorLogicCode += `                    } else if (actor_${i}_dy > 0 && py_b <= ey_t + 8) {\n`;
                actorLogicCode += `                        actor_${j}_hp--;\n`;
                actorLogicCode += `                        actor_${i}_dy = -3;\n`;
                actorLogicCode += `                        bn::sound_items::snd_square_440_100.play();\n`;
                actorLogicCode += `                        if (actor_${j}_hp <= 0) {\n`;
                actorLogicCode += `                            actor_${j}_active = false;\n`;
                actorLogicCode += `                            actor_${j}_sprite.set_visible(false);\n`;
                if (enemyDeathScript) {
                  actorLogicCode += enemyDeathScript;
                }
                actorLogicCode += `                        }\n`;
                actorLogicCode += `                    } else {\n`;
                const spawnX = a.useVarX && a.varX ? `(${a.varX.replace(/[^a-zA-Z0-9_]/g, '_')} * 8)` : a.x;
                const spawnY = a.useVarY && a.varY ? `(${a.varY.replace(/[^a-zA-Z0-9_]/g, '_')} * 8)` : a.y;
                actorLogicCode += `                        if (actor_${i}_invincible_timer == 0) {\n`;
                actorLogicCode += `                            actor_${i}_hp--;\n`;
                actorLogicCode += `                            actor_${i}_invincible_timer = 60;\n`;
                actorLogicCode += `                            bn::sound_items::snd_square_440_100.play();\n`;
                actorLogicCode += `                            if (actor_${i}_hp <= 0) {\n`;
                if (a.type === 'player' && deathScriptCompiled) {
                  actorLogicCode += deathScriptCompiled;
                }
                actorLogicCode += `                                actor_${i}_float_x = global_spawn_x != -1 ? global_spawn_x : ${spawnX};\n`;
                actorLogicCode += `                                actor_${i}_float_y = global_spawn_y != -1 ? global_spawn_y : ${spawnY};\n`;
                actorLogicCode += `                                actor_${i}_hp = actor_${i}_max_hp;\n`;
                actorLogicCode += `                                actor_${i}_dy = 0;\n`;
                actorLogicCode += `                            }\n`;
                actorLogicCode += `                        }\n`;
                let enemyScriptCode = generateScriptLogic(enemy.script, j, enemy.width, enemy.height, undefined, undefined, scCtx);
                if (enemyScriptCode) {
                  actorLogicCode += enemyScriptCode;
                }
                actorLogicCode += `                    }\n`;
                actorLogicCode += `                }\n`;
                actorLogicCode += `            }\n`;
              }
            }

            // Enemy projectile collision check on player
            actorLogicCode += `            for(int p=0; p<20; ++p) {\n`;
            actorLogicCode += `                if(proj_active[p] && !proj_from_player[p]) {\n`;
            actorLogicCode += `                    int proj_w = 8; int proj_h = 8;\n`;
            actorLogicCode += `                    int px_l = actor_${i}_float_x.integer() + ${a.collisionX ?? 0};\n`;
            actorLogicCode += `                    int px_r = px_l + ${a.collisionW ?? a.width ?? 16};\n`;
            actorLogicCode += `                    int py_t = actor_${i}_float_y.integer() + ${a.collisionY ?? 0};\n`;
            actorLogicCode += `                    int py_b = py_t + ${a.collisionH ?? a.height ?? 16};\n`;
            actorLogicCode += `                    if (proj_x[p] + proj_w > px_l && proj_x[p] < px_r &&\n`;
            actorLogicCode += `                        proj_y[p] + proj_h > py_t && proj_y[p] < py_b) {\n`;
            actorLogicCode += `                        proj_active[p] = false;\n`;
            actorLogicCode += `                        proj_sprites[p].reset();\n`;
            actorLogicCode += `                        if (actor_${i}_invincible_timer == 0) {\n`;
            const spawnX = a.useVarX && a.varX ? `(${a.varX.replace(/[^a-zA-Z0-9_]/g, '_')} * 8)` : a.x;
            const spawnY = a.useVarY && a.varY ? `(${a.varY.replace(/[^a-zA-Z0-9_]/g, '_')} * 8)` : a.y;
            actorLogicCode += `                            actor_${i}_hp--;\n`;
            actorLogicCode += `                            actor_${i}_invincible_timer = 60;\n`;
            actorLogicCode += `                            bn::sound_items::snd_square_440_100.play();\n`;
            actorLogicCode += `                            if (actor_${i}_hp <= 0) {\n`;
            if (a.type === 'player' && deathScriptCompiled) {
              actorLogicCode += deathScriptCompiled;
            }
            actorLogicCode += `                                actor_${i}_float_x = global_spawn_x != -1 ? global_spawn_x : ${spawnX};\n`;
            actorLogicCode += `                                actor_${i}_float_y = global_spawn_y != -1 ? global_spawn_y : ${spawnY};\n`;
            actorLogicCode += `                                actor_${i}_hp = actor_${i}_max_hp;\n`;
            actorLogicCode += `                                actor_${i}_dy = 0;\n`;
            actorLogicCode += `                            }\n`;
            actorLogicCode += `                        }\n`;
            actorLogicCode += `                    }\n`;
            actorLogicCode += `                }\n`;
            actorLogicCode += `            }\n`;

            // Shield interaction check
            for (let j = 0; j < sActors.length; j++) {
              const shield = sActors[j];
              if (shield.type === 'shield') {
                const shCW = shield.collisionW ?? shield.width ?? 16;
                const shCH = shield.collisionH ?? shield.height ?? 16;
                const shCX = shield.collisionX ?? 0;
                const shCY = shield.collisionY ?? 0;
                actorLogicCode += `            if (actor_${j}_active) {\n`;
                actorLogicCode += `                int px_l = actor_${i}_float_x.integer() + ${a.collisionX ?? 0};\n`;
                actorLogicCode += `                int px_r = px_l + ${a.collisionW ?? a.width ?? 16};\n`;
                actorLogicCode += `                int py_t = actor_${i}_float_y.integer() + ${a.collisionY ?? 0};\n`;
                actorLogicCode += `                int py_b = py_t + ${a.collisionH ?? a.height ?? 16};\n`;
                actorLogicCode += `                int shx_l = actor_${j}_x + ${shCX};\n`;
                actorLogicCode += `                int shx_r = shx_l + ${shCW};\n`;
                actorLogicCode += `                int shy_t = actor_${j}_y + ${shCY};\n`;
                actorLogicCode += `                int shy_b = shy_t + ${shCH};\n`;
                actorLogicCode += `                if (px_r > shx_l && px_l < shx_r && py_b > shy_t && py_t < shy_b) {\n`;
                actorLogicCode += `                    actor_${j}_active = false;\n`;
                actorLogicCode += `                    actor_${j}_sprite.set_visible(false);\n`;
                actorLogicCode += `                    actor_${i}_invincible_timer = actor_${j}_shield_duration;\n`;
                actorLogicCode += `                    bn::sound_items::snd_square_440_100.play();\n`;
                actorLogicCode += `                }\n`;
                actorLogicCode += `            }\n`;
              }
            }

            // Custom On Hit / On Interact checks for other actors
            for (let j = 0; j < sActors.length; j++) {
              if (i === j) continue;
              const otherAct = sActors[j];
              if (otherAct.type === 'player') continue;
              if (otherAct.onHitScriptId || otherAct.onInteractScriptId) {
                const hitScriptObj = customScripts.find(cs => cs && Number(cs.id) === Number(otherAct.onHitScriptId));
                const interactScriptObj = customScripts.find(cs => cs && Number(cs.id) === Number(otherAct.onInteractScriptId));
                let onHitCompiled = hitScriptObj ? generateScriptLogic(hitScriptObj.script, j, otherAct.width, otherAct.height, undefined, undefined, scCtx) : '';
                let onInteractCompiled = interactScriptObj ? generateScriptLogic(interactScriptObj.script, j, otherAct.width, otherAct.height, undefined, undefined, scCtx) : '';

                if (onHitCompiled || onInteractCompiled) {
                  const oCW = otherAct.collisionW ?? otherAct.width ?? 16;
                  const oCH = otherAct.collisionH ?? otherAct.height ?? 16;
                  const oCX = otherAct.collisionX ?? 0;
                  const oCY = otherAct.collisionY ?? 0;
                  actorLogicCode += `            if (actor_${j}_active) {\n`;
                  actorLogicCode += `                int ox_l = actor_${j}_x + ${oCX};\n`;
                  actorLogicCode += `                int ox_r = ox_l + ${oCW};\n`;
                  actorLogicCode += `                int oy_t = actor_${j}_y + ${oCY};\n`;
                  actorLogicCode += `                int oy_b = oy_t + ${oCH};\n`;
                  if (scene.type === 'POINTNCLICK') {
                    actorLogicCode += `                bool inside_${j} = actor_${i}_x >= ox_l && actor_${i}_x < ox_r && actor_${i}_y >= oy_t && actor_${i}_y < oy_b;\n`;
                    actorLogicCode += `                if (inside_${j}) {\n`;
                    actorLogicCode += `                    is_hovering = true;\n`;
                    actorLogicCode += `                }\n`;
                  } else {
                    actorLogicCode += `                int px_l = actor_${i}_float_x.integer() + ${a.collisionX ?? 0};\n`;
                    actorLogicCode += `                int px_r = px_l + ${a.collisionW ?? a.width ?? 16};\n`;
                    actorLogicCode += `                int py_t = actor_${i}_float_y.integer() + ${a.collisionY ?? 0};\n`;
                    actorLogicCode += `                int py_b = py_t + ${a.collisionH ?? a.height ?? 16};\n`;
                    actorLogicCode += `                bool inside_${j} = px_r > ox_l && px_l < ox_r && py_b > oy_t && py_t < oy_b;\n`;
                  }
                  if (onHitCompiled) {
                    actorLogicCode += `                if (inside_${j} && !actor_${j}_hit_active) {\n`;
                    actorLogicCode += `                    actor_${j}_hit_active = true;\n`;
                    actorLogicCode += onHitCompiled;
                    actorLogicCode += `                } else if (!inside_${j}) {\n`;
                    actorLogicCode += `                    actor_${j}_hit_active = false;\n`;
                    actorLogicCode += `                }\n`;
                  }
                  if (onInteractCompiled) {
                    actorLogicCode += `                if (inside_${j} && bn::keypad::a_pressed() && !actor_${j}_interact_active) {\n`;
                    actorLogicCode += `                    actor_${j}_interact_active = true;\n`;
                    actorLogicCode += onInteractCompiled;
                    actorLogicCode += `                } else if (!inside_${j}) {\n`;
                    actorLogicCode += `                    actor_${j}_interact_active = false;\n`;
                    actorLogicCode += `                }\n`;
                  }
                  actorLogicCode += `            }\n`;
                }
              }
            }

            const aCW = a.collisionW ?? a.width ?? 16;
            const aCH = a.collisionH ?? a.height ?? 16;
            const aCX = a.collisionX ?? 0;
            const aCY = a.collisionY ?? 0;

            let pushCheckCode = '';
            for (let j = 0; j < sActors.length; j++) {
              if (i === j) continue;
              const block = sActors[j];
              if (block.type === 'pushable') {
                const bCW = block.collisionW ?? block.width ?? 16;
                const bCH = block.collisionH ?? block.height ?? 16;
                const bCX = block.collisionX ?? 0;
                const bCY = block.collisionY ?? 0;
                pushCheckCode += `                    if (actor_${j}_active && !push_blocked) {\n`;
                if (scene.type !== 'PLATFORMER') {
                  pushCheckCode += `                        int px_l = new_x.integer() + ${aCX};\n`;
                  pushCheckCode += `                        int px_r = px_l + ${aCW};\n`;
                  pushCheckCode += `                        int py_t = actor_${i}_float_y.integer() + ${aCY};\n`;
                  pushCheckCode += `                        int py_b = py_t + ${aCH};\n`;
                  pushCheckCode += `                        int bx_l = actor_${j}_x + ${bCX};\n`;
                  pushCheckCode += `                        int bx_r = bx_l + ${bCW};\n`;
                  pushCheckCode += `                        int by_t = actor_${j}_y + ${bCY};\n`;
                  pushCheckCode += `                        int by_b = by_t + ${bCH};\n`;
                  pushCheckCode += `                        if (px_r > bx_l && px_l < bx_r && py_b > by_t && py_t < by_b) {\n`;
                } else {
                  pushCheckCode += `                        int px_l = new_x.integer() + ${aCX};\n`;
                  pushCheckCode += `                        int px_r = px_l + ${aCW};\n`;
                  pushCheckCode += `                        int py_t = actor_${i}_float_y.integer() + ${aCY};\n`;
                  pushCheckCode += `                        int py_b = py_t + ${aCH};\n`;
                  pushCheckCode += `                        int bx_l = actor_${j}_x + ${bCX};\n`;
                  pushCheckCode += `                        int bx_r = bx_l + ${bCW};\n`;
                  pushCheckCode += `                        int by_t = actor_${j}_y + ${bCY};\n`;
                  pushCheckCode += `                        int by_b = by_t + ${bCH};\n`;
                  pushCheckCode += `                        if (px_r > bx_l && px_l < bx_r && py_b > by_t + 2 && py_t < by_b - 2) {\n`;
                }
                pushCheckCode += `                            pushed_block = true;\n`;
                pushCheckCode += `                            bn::fixed block_new_x = actor_${j}_float_x + actor_${i}_dx;\n`;
                pushCheckCode += `                            bool b_blocked = check_solid_collision(block_new_x, actor_${j}_float_y, ${bCX}, ${bCY}, ${bCW}, ${bCH});\n`;
                for (let k = 0; k < sActors.length; k++) {
                  if (k === j || k === i) continue;
                  const other = sActors[k];
                  if (other.type === 'platform' || other.type === 'staticPlatform' || other.type === 'movingPlatform' || other.type === 'destructible' || other.type === 'door' || other.type === 'pushable' || other.type === 'conveyor' || other.type === 'ice_block' || other.type === 'crumbling_platform' || other.type === 'pass_wall') {
                    const oCW = other.collisionW ?? other.width ?? 16;
                    const oCH = other.collisionH ?? other.height ?? 16;
                    const oCX = other.collisionX ?? 0;
                    const oCY = other.collisionY ?? 0;
                    const activeCond = other.type === 'pass_wall' ? `actor_${k}_active && actor_${k}_pass_count == 0` : `actor_${k}_active`;
                    pushCheckCode += `                            if (${activeCond} && !b_blocked) {\n`;
                    pushCheckCode += `                                int bx_l2 = block_new_x.integer() + ${bCX};\n`;
                    pushCheckCode += `                                int bx_r2 = bx_l2 + ${bCW};\n`;
                    pushCheckCode += `                                int by_t2 = actor_${j}_y + ${bCY};\n`;
                    pushCheckCode += `                                int by_b2 = by_t2 + ${bCH};\n`;
                    pushCheckCode += `                                int ox_l = actor_${k}_x + ${oCX};\n`;
                    pushCheckCode += `                                int ox_r = ox_l + ${oCW};\n`;
                    pushCheckCode += `                                int oy_t = actor_${k}_y + ${oCY};\n`;
                    pushCheckCode += `                                int oy_b = oy_t + ${oCH};\n`;
                    pushCheckCode += `                                if (bx_r2 > ox_l && bx_l2 < ox_r && by_b2 > oy_t && by_t2 < oy_b) {\n`;
                    pushCheckCode += `                                    b_blocked = true;\n`;
                    pushCheckCode += `                                }\n`;
                    pushCheckCode += `                            }\n`;
                  }
                }
                pushCheckCode += `                            if (!b_blocked) {\n`;
                pushCheckCode += `                                actor_${j}_float_x = block_new_x;\n`;
                pushCheckCode += `                                actor_${j}_dx = actor_${i}_dx;\n`;
                pushCheckCode += `                            } else {\n`;
                pushCheckCode += `                                push_blocked = true;\n`;
                pushCheckCode += `                            }\n`;
                pushCheckCode += `                        }\n`;
                pushCheckCode += `                    }\n`;
              }
            }

            let pushCheckCodeY = '';
            if (scene.type !== 'PLATFORMER') {
              for (let j = 0; j < sActors.length; j++) {
                if (i === j) continue;
                const block = sActors[j];
                if (block.type === 'pushable') {
                  const bCW = block.collisionW ?? block.width ?? 16;
                  const bCH = block.collisionH ?? block.height ?? 16;
                  const bCX = block.collisionX ?? 0;
                  const bCY = block.collisionY ?? 0;
                  pushCheckCodeY += `                    if (actor_${j}_active && !push_blocked_y) {\n`;
                  pushCheckCodeY += `                        int px_l = actor_${i}_float_x.integer() + ${aCX};\n`;
                  pushCheckCodeY += `                        int px_r = px_l + ${aCW};\n`;
                  pushCheckCodeY += `                        int py_t = new_y.integer() + ${aCY};\n`;
                  pushCheckCodeY += `                        int py_b = py_t + ${aCH};\n`;
                  pushCheckCodeY += `                        int bx_l = actor_${j}_x + ${bCX};\n`;
                  pushCheckCodeY += `                        int bx_r = bx_l + ${bCW};\n`;
                  pushCheckCodeY += `                        int by_t = actor_${j}_y + ${bCY};\n`;
                  pushCheckCodeY += `                        int by_b = by_t + ${bCH};\n`;
                  pushCheckCodeY += `                        if (px_r > bx_l && px_l < bx_r && py_b > by_t && py_t < by_b) {\n`;
                  pushCheckCodeY += `                            pushed_block_y = true;\n`;
                  pushCheckCodeY += `                            bn::fixed block_new_y = actor_${j}_float_y + actor_${i}_dy;\n`;
                  pushCheckCodeY += `                            bool b_blocked = check_solid_collision(actor_${j}_float_x, block_new_y, ${bCX}, ${bCY}, ${bCW}, ${bCH});\n`;
                  for (let k = 0; k < sActors.length; k++) {
                    if (k === j || k === i) continue;
                    const other = sActors[k];
                    if (other.type === 'platform' || other.type === 'staticPlatform' || other.type === 'movingPlatform' || other.type === 'destructible' || other.type === 'door' || other.type === 'pushable' || other.type === 'conveyor' || other.type === 'ice_block' || other.type === 'crumbling_platform' || other.type === 'pass_wall') {
                      const oCW = other.collisionW ?? other.width ?? 16;
                      const oCH = other.collisionH ?? other.height ?? 16;
                      const oCX = other.collisionX ?? 0;
                      const oCY = other.collisionY ?? 0;
                      const activeCond = other.type === 'pass_wall' ? `actor_${k}_active && actor_${k}_pass_count == 0` : `actor_${k}_active`;
                      pushCheckCodeY += `                            if (${activeCond} && !b_blocked) {\n`;
                      pushCheckCodeY += `                                int bx_l2 = actor_${j}_x + ${bCX};\n`;
                      pushCheckCodeY += `                                int bx_r2 = bx_l2 + ${bCW};\n`;
                      pushCheckCodeY += `                                int by_t2 = block_new_y.integer() + ${bCY};\n`;
                      pushCheckCodeY += `                                int by_b2 = by_t2 + ${bCH};\n`;
                      pushCheckCodeY += `                                int ox_l = actor_${k}_x + ${oCX};\n`;
                      pushCheckCodeY += `                                int ox_r = ox_l + ${oCW};\n`;
                      pushCheckCodeY += `                                int oy_t = actor_${k}_y + ${oCY};\n`;
                      pushCheckCodeY += `                                int oy_b = oy_t + ${oCH};\n`;
                      pushCheckCodeY += `                                if (bx_r2 > ox_l && bx_l2 < ox_r && by_b2 > oy_t && by_t2 < oy_b) {\n`;
                      pushCheckCodeY += `                                    b_blocked = true;\n`;
                      pushCheckCodeY += `                                }\n`;
                      pushCheckCodeY += `                            }\n`;
                    }
                  }
                  pushCheckCodeY += `                            if (!b_blocked) {\n`;
                  pushCheckCodeY += `                                actor_${j}_float_y = block_new_y;\n`;
                  pushCheckCodeY += `                                actor_${j}_dy = actor_${i}_dy;\n`;
                  pushCheckCodeY += `                            } else {\n`;
                  pushCheckCodeY += `                                push_blocked_y = true;\n`;
                  pushCheckCodeY += `                            }\n`;
                  pushCheckCodeY += `                        }\n`;
                  pushCheckCodeY += `                    }\n`;
                }
              }
            }

            if (scene.type === 'POINTNCLICK') {
              actorLogicCode += `            if (actor_${i}_dx != 0 || actor_${i}_dy != 0) {\n`;
              actorLogicCode += `                bn::fixed new_x = actor_${i}_float_x + actor_${i}_dx;\n`;
              actorLogicCode += `                bn::fixed new_y = actor_${i}_float_y + actor_${i}_dy;\n`;
              actorLogicCode += `                if (new_x >= 0 && new_x <= ${sDims.w - a.width}) actor_${i}_float_x = new_x;\n`;
              actorLogicCode += `                if (new_y >= 0 && new_y <= ${sDims.h - a.height}) actor_${i}_float_y = new_y;\n`;
              actorLogicCode += `            }\n`;
            } else {
              actorLogicCode += `            if (actor_${i}_dx != 0 || actor_${i}_dy != 0) {\n`;
              actorLogicCode += `                if (actor_${i}_dx != 0) {\n`;
              actorLogicCode += `                    bn::fixed new_x = actor_${i}_float_x + actor_${i}_dx;\n`;
              actorLogicCode += `                    bool pushed_block = false;\n`;
              actorLogicCode += `                    bool push_blocked = false;\n`;
              actorLogicCode += pushCheckCode;
              actorLogicCode += `                    if (pushed_block) {\n`;
              actorLogicCode += `                        if (!push_blocked) {\n`;
              actorLogicCode += `                            actor_${i}_float_x = new_x;\n`;
              actorLogicCode += `                        } else {\n`;
              actorLogicCode += `                            actor_${i}_dx = 0;\n`;
              actorLogicCode += `                        }\n`;
              actorLogicCode += `                    } else {\n`;
              actorLogicCode += `                        bool actor_blocked = false;\n`;
              if (scene.type !== 'PLATFORMER') {
                actorLogicCode += `                        bn::fixed new_y = actor_${i}_float_y + actor_${i}_dy;\n`;
              }
              for (let j = 0; j < sActors.length; j++) {
                if (i === j) continue;
                const other = sActors[j];
                if (['platform', 'staticPlatform', 'movingPlatform', 'destructible', 'door', 'conveyor', 'ice_block', 'crumbling_platform', 'one_way_wall', 'wall_jump_surface', 'pass_wall'].includes(other.type)) {
                  const oCW = other.collisionW ?? other.width ?? 16;
                  const oCH = other.collisionH ?? other.height ?? 16;
                  const oCX = other.collisionX ?? 0;
                  const oCY = other.collisionY ?? 0;
                  const activeCond = other.type === 'pass_wall' ? `actor_${j}_active && actor_${j}_pass_count == 0` : `actor_${j}_active`;
                  actorLogicCode += `                        if (${activeCond} && !actor_blocked) {\n`;
                  actorLogicCode += `                            int px_l = new_x.integer() + ${aCX} + (actor_${i}_dx > 0 ? 1 : -1);\n`;
                  actorLogicCode += `                            int px_r = px_l + ${aCW};\n`;
                  actorLogicCode += `                            int py_t = actor_${i}_float_y.integer() + ${aCY};\n`;
                  actorLogicCode += `                            int py_b = py_t + ${aCH};\n`;
                  actorLogicCode += `                            int ox_l = actor_${j}_x + ${oCX};\n`;
                  actorLogicCode += `                            int ox_r = ox_l + ${oCW};\n`;
                  actorLogicCode += `                            int oy_t = actor_${j}_y + ${oCY};\n`;
                  actorLogicCode += `                            int oy_b = oy_t + ${oCH};\n`;
                  if (scene.type === 'PLATFORMER') {
                    actorLogicCode += `                            if (px_r > ox_l && px_l < ox_r && py_b > oy_t + 2 && py_t < oy_b - 2) {\n`;
                  } else {
                    actorLogicCode += `                            if (px_r > ox_l && px_l < ox_r && py_b > oy_t && py_t < oy_b) {\n`;
                  }
                  if (other.type === 'one_way_wall') {
                    const passDir = other.oneWayDirection || 'right';
                    if (scene.type === 'PLATFORMER') {
                      if (passDir === 'left') {
                        actorLogicCode += `                                if (actor_${i}_dx < 0) actor_blocked = true;\n`;
                      } else if (passDir === 'right') {
                        actorLogicCode += `                                if (actor_${i}_dx > 0) actor_blocked = true;\n`;
                      }
                    } else {
                      if (passDir === 'left') {
                        actorLogicCode += `                                if (actor_${i}_dx < 0) actor_blocked = true;\n`;
                      } else if (passDir === 'right') {
                        actorLogicCode += `                                if (actor_${i}_dx > 0) actor_blocked = true;\n`;
                      } else {
                        actorLogicCode += `                                actor_blocked = true;\n`;
                      }
                    }
                  } else if (other.jumpThrough) {
                    actorLogicCode += `                                // jumpThrough doesn't block X\n`;
                  } else {
                    if (other.type === 'wall_jump_surface') {
                      // actorLogicCode += `                                if (actor_${i}_dy > 0) { actor_${i}_dy = bn::fixed(0.5); }\n`;
                      // if (scene.type === 'PLATFORMER') {
                      //   actorLogicCode += `                                if (actor_${i}_dx > 0) { actor_${i}_on_wall = -1; }\n`;
                      //   // actorLogicCode += `                                else { actor_${i}_on_wall = 1; }\n`;
                      // }
                    } else {
                      // if (scene.type === 'PLATFORMER') {
                      // actorLogicCode += `                                actor_${i}_on_wall = 0;\n`;
                      // }
                    }
                    actorLogicCode += `                                actor_blocked = true;\n`;
                  }
                  actorLogicCode += `                            }\n`;
                  actorLogicCode += `                        }\n`;
                }
              }
              actorLogicCode += `                        if (!check_solid_collision(new_x, actor_${i}_float_y, ${aCX}, ${aCY}, ${aCW}, ${aCH}) && !actor_blocked) {\n`;
              actorLogicCode += `                            actor_${i}_float_x = new_x;\n`;
              actorLogicCode += `                        } else {\n`;
              // if (scene.type === 'PLATFORMER') {
              //   actorLogicCode += `                            if (!actor_blocked) actor_${i}_on_wall = 0;\n`;
              // }
              actorLogicCode += `                            actor_${i}_dx = 0;\n`;
              actorLogicCode += `                        }\n`;
              actorLogicCode += `                    }\n`;
              actorLogicCode += `                }\n`;
              actorLogicCode += `                if (actor_${i}_dy != 0) {\n`;
              actorLogicCode += `                    bn::fixed new_y = actor_${i}_float_y + actor_${i}_dy;\n`;
              if (scene.type !== 'PLATFORMER') {
                actorLogicCode += `                    bool pushed_block_y = false;\n`;
                actorLogicCode += `                    bool push_blocked_y = false;\n`;
                actorLogicCode += pushCheckCodeY;
                actorLogicCode += `                    if (pushed_block_y) {\n`;
                actorLogicCode += `                        if (!push_blocked_y) {\n`;
                actorLogicCode += `                            actor_${i}_float_y = new_y;\n`;
                actorLogicCode += `                        } else {\n`;
                actorLogicCode += `                            actor_${i}_dy = 0;\n`;
                actorLogicCode += `                        }\n`;
                actorLogicCode += `                    } else {\n`;
                actorLogicCode += `                        bool actor_blocked_y = false;\n`;
                for (let j = 0; j < sActors.length; j++) {
                  if (i === j) continue;
                  const other = sActors[j];
                  if (['platform', 'staticPlatform', 'movingPlatform', 'destructible', 'door', 'conveyor', 'ice_block', 'crumbling_platform', 'one_way_wall', 'pass_wall'].includes(other.type)) {
                    const oCW = other.collisionW ?? other.width ?? 16;
                    const oCH = other.collisionH ?? other.height ?? 16;
                    const oCX = other.collisionX ?? 0;
                    const oCY = other.collisionY ?? 0;
                    const activeCond = other.type === 'pass_wall' ? `actor_${j}_active && actor_${j}_pass_count == 0` : `actor_${j}_active`;
                    actorLogicCode += `                        if (${activeCond} && !actor_blocked_y) {\n`;
                    actorLogicCode += `                            int px_l = actor_${i}_float_x.integer() + ${aCX};\n`;
                    actorLogicCode += `                            int px_r = px_l + ${aCW};\n`;
                    actorLogicCode += `                            int py_t = new_y.integer() + ${aCY};\n`;
                    actorLogicCode += `                            int py_b = py_t + ${aCH};\n`;
                    actorLogicCode += `                            int ox_l = actor_${j}_x + ${oCX};\n`;
                    actorLogicCode += `                            int ox_r = ox_l + ${oCW};\n`;
                    actorLogicCode += `                            int oy_t = actor_${j}_y + ${oCY};\n`;
                    actorLogicCode += `                            int oy_b = oy_t + ${oCH};\n`;
                    actorLogicCode += `                            if (px_r > ox_l && px_l < ox_r && py_b > oy_t && py_t < oy_b) {\n`;
                    if (other.type === 'one_way_wall') {
                      const passDir = other.oneWayDirection || 'right';
                      if (passDir === 'up') {
                        actorLogicCode += `                                if (actor_${i}_dy < 0) actor_blocked_y = true;\n`;
                      } else if (passDir === 'down') {
                        actorLogicCode += `                                if (actor_${i}_dy > 0) actor_blocked_y = true;\n`;
                      } else {
                        actorLogicCode += `                                actor_blocked_y = true;\n`;
                      }
                    } else if (other.jumpThrough) {
                      actorLogicCode += `                                // jumpThrough doesn't block Y in TopDown\n`;
                    } else {
                      actorLogicCode += `                                actor_blocked_y = true;\n`;
                    }
                    actorLogicCode += `                            }\n`;
                    actorLogicCode += `                        }\n`;
                  }
                }
                actorLogicCode += `                        if (!check_solid_collision(actor_${i}_float_x, new_y, ${aCX}, ${aCY}, ${aCW}, ${aCH}) && !actor_blocked_y) {\n`;
                actorLogicCode += `                            actor_${i}_float_y = new_y;\n`;
                actorLogicCode += `                        } else {\n`;
                actorLogicCode += `                            actor_${i}_dy = 0;\n`;
                actorLogicCode += `                        }\n`;
                actorLogicCode += `                    }\n`;
              } else {
              actorLogicCode += `                    bool _dy_blocked = false;\n`;
              actorLogicCode += `                    if (actor_${i}_dy >= 0) {\n`;
              actorLogicCode += `                        _dy_blocked = check_ground_collision(actor_${i}_float_x, new_y, ${aCX}, ${aCY}, ${aCW}, ${aCH});\n`;
              actorLogicCode += `                    } else {\n`;
              actorLogicCode += `                        _dy_blocked = check_ceiling_collision(actor_${i}_float_x, new_y, ${aCX}, ${aCY}, ${aCW}, ${aCH});\n`;
              actorLogicCode += `                    }\n`;
              actorLogicCode += `                    if (!_dy_blocked) {\n`;
              actorLogicCode += `                        bool hit_platform = false;\n`;
              for (let j = 0; j < sActors.length; j++) {
                if (i === j) continue;
                const platform = sActors[j];
                if (platform.type === 'platform' || platform.type === 'staticPlatform' || platform.type === 'movingPlatform' || platform.type === 'destructible' || platform.type === 'door' || platform.type === 'pushable' || platform.type === 'conveyor' || platform.type === 'pass_wall' || (platform.type === 'one_way_wall' && ((platform.oneWayDirection || 'right') === 'up' || (platform.oneWayDirection || 'right') === 'down')) || platform.type === 'ice_block' || platform.type === 'crumbling_platform') {
                  const pCW = platform.collisionW ?? platform.width ?? 16;
                  const pCH = platform.collisionH ?? platform.height ?? 16;
                  const pCX = platform.collisionX ?? 0;
                  const pCY = platform.collisionY ?? 0;
                  if (platform.type === 'one_way_wall' && ((platform.oneWayDirection || 'right') === 'up' || (platform.oneWayDirection || 'right') === 'down')) {
                    const passDir = platform.oneWayDirection || 'right';
                    if (passDir === 'up' || passDir === 'down') {
                      actorLogicCode += `                        if (actor_${j}_active) {\n`;
                      actorLogicCode += `                            int px_l = actor_${i}_float_x.integer() + ${aCX};\n`;
                      actorLogicCode += `                            int px_r = actor_${i}_float_x.integer() + ${aCX} + ${aCW};\n`;
                      actorLogicCode += `                            int py_t = new_y.integer() + ${aCY};\n`;
                      actorLogicCode += `                            int py_b = new_y.integer() + ${aCY} + ${aCH};\n`;
                      actorLogicCode += `                            int plat_l = actor_${j}_x + ${pCX};\n`;
                      actorLogicCode += `                            int plat_r = actor_${j}_x + ${pCX} + ${pCW};\n`;
                      actorLogicCode += `                            int plat_t = actor_${j}_y + ${pCY};\n`;
                      actorLogicCode += `                            int plat_b = actor_${j}_y + ${pCY} + ${pCH};\n`;
                      if (passDir === 'up') {
                        actorLogicCode += `                            if (actor_${i}_dy < 0 && px_r > plat_l && px_l < plat_r && py_t < plat_b && py_b > plat_b) {\n`;
                        actorLogicCode += `                                hit_platform = true;\n`;
                        actorLogicCode += `                            }\n`;
                      } else if (passDir === 'down') {
                        actorLogicCode += `                            if (actor_${i}_dy >= 0 && px_r > plat_l && px_l < plat_r && py_b > plat_t && py_t < plat_t) {\n`;
                        actorLogicCode += `                                hit_platform = true;\n`;
                        actorLogicCode += `                            }\n`;
                      }
                      actorLogicCode += `                        }\n`;
                    }
                  } else {
                    const activeCond = platform.type === 'pass_wall' ? `actor_${j}_active && actor_${j}_pass_count == 0` : `actor_${j}_active`;
                    actorLogicCode += `                        if (${activeCond}) {\n`;
                    actorLogicCode += `                            int px_l = actor_${i}_float_x.integer() + ${aCX};\n`;
                    actorLogicCode += `                            int px_r = actor_${i}_float_x.integer() + ${aCX} + ${aCW};\n`;
                    actorLogicCode += `                            int py_t = new_y.integer() + ${aCY};\n`;
                    actorLogicCode += `                            int py_b = new_y.integer() + ${aCY} + ${aCH};\n`;
                    actorLogicCode += `                            int plat_l = actor_${j}_x + ${pCX};\n`;
                    actorLogicCode += `                            int plat_r = actor_${j}_x + ${pCX} + ${pCW};\n`;
                    actorLogicCode += `                            int plat_t = actor_${j}_y + ${pCY};\n`;
                    actorLogicCode += `                            int plat_b = actor_${j}_y + ${pCY} + ${pCH};\n`;
                    if (platform.jumpThrough) {
                      if (!platform.jumpThroughUp) {
                        actorLogicCode += `                            if (actor_${i}_dy < 0 && px_r > plat_l && px_l < plat_r && py_t < plat_b && py_b > plat_b) {\n`;
                        actorLogicCode += `                                hit_platform = true;\n`;
                        actorLogicCode += `                            }\n`;
                      }
                    } else {
                      actorLogicCode += `                            if (px_r > plat_l && px_l < plat_r && py_b > plat_t && py_t < plat_b) {\n`;
                      actorLogicCode += `                                hit_platform = true;\n`;
                      actorLogicCode += `                            }\n`;
                    }
                    actorLogicCode += `                        }\n`;
                  }
                }
              }
              actorLogicCode += `                        if (!hit_platform) {\n`;
              actorLogicCode += `                            actor_${i}_float_y = new_y;\n`;
              actorLogicCode += `                        } else {\n`;
              actorLogicCode += `                            actor_${i}_dy = 0;\n`;
              actorLogicCode += `                        }\n`;
              actorLogicCode += `                    } else {\n`;
              actorLogicCode += `                        if (actor_${i}_dy > 0) {\n`;
              actorLogicCode += `                            int bottom_y = new_y.integer() + ${aCY} + ${aCH};\n`;
              actorLogicCode += `                            int ty = (bottom_y - 1) >> 3;\n`;
              actorLogicCode += `                            actor_${i}_float_y = (ty * 8) - ${aCY} - ${aCH};\n`;
              if (scene.type === 'PLATFORMER') {
                actorLogicCode += `                            on_ground = true;\n`;
              }
              actorLogicCode += `                        } else if (actor_${i}_dy < 0) {\n`;
              actorLogicCode += `                            int top_y = new_y.integer() + ${aCY};\n`;
              actorLogicCode += `                            int ty = top_y >> 3;\n`;
              actorLogicCode += `                            actor_${i}_float_y = ((ty + 1) * 8) - ${aCY};\n`;
              actorLogicCode += `                        }\n`;
              actorLogicCode += `                        actor_${i}_dy = 0;\n`;
              actorLogicCode += `                    }\n`;
              }
              actorLogicCode += `                }\n`;
              actorLogicCode += `            }\n`;
            }
            if ((scene.type === 'SHMUP' || scene.type === 'BEATEMUP') && scene.autoScroll !== false && !scene.mode7) {
              actorLogicCode += `            {\n`;
              actorLogicCode += `                bn::fixed scr_cam_world_x = scroll_cam_x + ${Math.floor(sDims.w / 2)};\n`;
              actorLogicCode += `                bn::fixed scr_cam_world_y = scroll_cam_y + ${Math.floor(sDims.h / 2)};\n`;
              actorLogicCode += `                bn::fixed min_px = scr_cam_world_x - 120;\n`;
              actorLogicCode += `                bn::fixed max_px = scr_cam_world_x + 120 - ${a.width};\n`;
              actorLogicCode += `                bn::fixed min_py = scr_cam_world_y - 80;\n`;
              actorLogicCode += `                bn::fixed max_py = scr_cam_world_y + 80 - ${a.height};\n`;
              if (a.type === 'player') {
                actorLogicCode += `                if (actor_${i}_float_x < min_px) actor_${i}_float_x = min_px;\n`;
                actorLogicCode += `                if (actor_${i}_float_x > max_px) actor_${i}_float_x = max_px;\n`;
                actorLogicCode += `                if (actor_${i}_float_y < min_py) actor_${i}_float_y = min_py;\n`;
                actorLogicCode += `                if (actor_${i}_float_y > max_py) actor_${i}_float_y = max_py;\n`;
              } else {
                actorLogicCode += `                bool crushed = false;\n`;
                actorLogicCode += `                if (current_scroll_speed_x > 0 && actor_${i}_float_x < min_px - 32) crushed = true;\n`;
                actorLogicCode += `                if (current_scroll_speed_x < 0 && actor_${i}_float_x > max_px + 32) crushed = true;\n`;
                actorLogicCode += `                if (current_scroll_speed_y > 0 && actor_${i}_float_y < min_py - 32) crushed = true;\n`;
                actorLogicCode += `                if (current_scroll_speed_y < 0 && actor_${i}_float_y > max_py + 32) crushed = true;\n`;
                actorLogicCode += `                if (crushed) {\n`;
                actorLogicCode += `                    actor_${i}_hp = 0;\n`;
                const spawnX = a.useVarX && a.varX ? `(${a.varX.replace(/[^a-zA-Z0-9_]/g, '_')} * 8)` : a.x;
                const spawnY = a.useVarY && a.varY ? `(${a.varY.replace(/[^a-zA-Z0-9_]/g, '_')} * 8)` : a.y;
                const playerMaxHp = a.playerHp ?? 10;
                actorLogicCode += `                    actor_${i}_float_x = ${spawnX};\n`;
                actorLogicCode += `                    actor_${i}_float_y = ${spawnY};\n`;
                actorLogicCode += `                    actor_${i}_hp = ${playerMaxHp};\n`;
                actorLogicCode += `                    bn::sound_items::snd_square_440_100.play();\n`;
                actorLogicCode += `                }\n`;
              }
              actorLogicCode += `            }\n`;
            }
            actorLogicCode += `            actor_${i}_x = actor_${i}_float_x.integer();\n`;
            actorLogicCode += `            actor_${i}_y = actor_${i}_float_y.integer();\n`;
            const conveyors = sActors.filter(act => act.type === 'conveyor');
            if (conveyors.length > 0) {
              actorLogicCode += `            // Universal conveyor overlap check\n`;
              conveyors.forEach(conv => {
                const j = sActors.indexOf(conv);
                const cCW = conv.collisionW ?? conv.width ?? 16;
                const cCH = conv.collisionH ?? conv.height ?? 16;
                const cCX = conv.collisionX ?? 0;
                const cCY = conv.collisionY ?? 0;
                const aCW = a.collisionW ?? a.width ?? 16;
                const aCH = a.collisionH ?? a.height ?? 16;
                const aCX = a.collisionX ?? 0;
                const aCY = a.collisionY ?? 0;
                const conveyorDir = conv.conveyorDir || 'right';
                const conveyorSpeed = conv.conveyorSpeed ?? 1;
                actorLogicCode += `            if (actor_${j}_active) {\n`;
                actorLogicCode += `                int px_l = actor_${i}_float_x.integer() + ${aCX};\n`;
                actorLogicCode += `                int px_r = px_l + ${aCW};\n`;
                actorLogicCode += `                int py_t = actor_${i}_float_y.integer() + ${aCY};\n`;
                actorLogicCode += `                int py_b = py_t + ${aCH};\n`;
                actorLogicCode += `                int cv_l = actor_${j}_x + ${cCX};\n`;
                actorLogicCode += `                int cv_r = cv_l + ${cCW};\n`;
                actorLogicCode += `                int cv_t = actor_${j}_y + ${cCY};\n`;
                actorLogicCode += `                int cv_b = cv_t + ${cCH};\n`;
                if (scene.type === 'PLATFORMER') {
                  actorLogicCode += `                bool on_top = (py_b >= cv_t && py_b <= cv_t + 4 && px_r > cv_l && px_l < cv_r);\n`;
                  actorLogicCode += `                if (on_top) {\n`;
                } else {
                  actorLogicCode += `                if (px_r > cv_l && px_l < cv_r && py_b > cv_t && py_t < cv_b) {\n`;
                }
                if (conveyorDir === 'left') {
                  actorLogicCode += `                    actor_${i}_float_x -= bn::fixed(${conveyorSpeed});\n`;
                } else if (conveyorDir === 'right') {
                  actorLogicCode += `                    actor_${i}_float_x += bn::fixed(${conveyorSpeed});\n`;
                } else if (conveyorDir === 'up') {
                  actorLogicCode += `                    actor_${i}_float_y -= bn::fixed(${conveyorSpeed});\n`;
                } else if (conveyorDir === 'down') {
                  actorLogicCode += `                    actor_${i}_float_y += bn::fixed(${conveyorSpeed});\n`;
                }
                actorLogicCode += `                }\n`;
                actorLogicCode += `            }\n`;
              });
            }
            actorLogicCode += (function() {
  const checkpoints = sActors.filter(a => a.type === 'checkpoint');
  if (checkpoints.length === 0) return '';
  let cpCode = '';
  checkpoints.forEach((cp, cpIdx) => {
    const j = sActors.indexOf(cp);
    const cpCW = cp.collisionW ?? cp.width ?? 16;
    const cpCH = cp.collisionH ?? cp.height ?? 16;
    const cpCX = cp.collisionX ?? 0;
    const cpCY = cp.collisionY ?? 0;
    const touchActivate = cp.checkpointTouchActivate || false;
    const activeTint = cp.checkpointActiveTint ?? null;
    const actName = `${safeSceneName}_actor_${j}_sprite`;
    cpCode += `            // Checkpoint ${cpIdx}\n`;
    cpCode += `            if (actor_${j}_active) {\n`;
    cpCode += `                if (!actor_${j}_cp_activated) {\n`;
    cpCode += `                    int px_l = actor_${i}_x + ${a.collisionX ?? 0};\n`;
    cpCode += `                    int px_r = px_l + ${a.collisionW ?? a.width ?? 16};\n`;
    cpCode += `                    int py_t = actor_${i}_y + ${a.collisionY ?? 0};\n`;
    cpCode += `                    int py_b = py_t + ${a.collisionH ?? a.height ?? 16};\n`;
    cpCode += `                    int cp_l = actor_${j}_x + ${cpCX};\n`;
    cpCode += `                    int cp_r = cp_l + ${cpCW};\n`;
    cpCode += `                    int cp_t = actor_${j}_y + ${cpCY};\n`;
    cpCode += `                    int cp_b = cp_t + ${cpCH};\n`;
    cpCode += `                    if (px_r > cp_l && px_l < cp_r && py_b > cp_t && py_t < cp_b) {\n`;
    if (touchActivate) {
      cpCode += `                        global_spawn_x = actor_${j}_x;\n`;
      cpCode += `                        global_spawn_y = actor_${j}_y;\n`;
      cpCode += `                        actor_${j}_cp_activated = true;\n`;
      if (activeTint !== null) {
        const r = Math.floor(parseInt(activeTint.slice(1, 3), 16) / 8);
        const g = Math.floor(parseInt(activeTint.slice(3, 5), 16) / 8);
        const b = Math.floor(parseInt(activeTint.slice(5, 7), 16) / 8);
        cpCode += `                        bn::sprite_palette_ptr actor_${j}_tinted_palette = bn::sprite_items::${actName}.palette_item().create_new_palette();\n`;
        cpCode += `                        actor_${j}_tinted_palette.set_fade(bn::color(${r}, ${g}, ${b}), bn::fixed(0.3));\n`;
        cpCode += `                        actor_${j}_sprite.set_palette(actor_${j}_tinted_palette);\n`;
      }
    } else {
      cpCode += `                        if (bn::keypad::a_pressed()) {\n`;
      cpCode += `                            global_spawn_x = actor_${j}_x;\n`;
      cpCode += `                            global_spawn_y = actor_${j}_y;\n`;
      cpCode += `                            actor_${j}_cp_activated = true;\n`;
      if (activeTint !== null) {
        const r = Math.floor(parseInt(activeTint.slice(1, 3), 16) / 8);
        const g = Math.floor(parseInt(activeTint.slice(3, 5), 16) / 8);
        const b = Math.floor(parseInt(activeTint.slice(5, 7), 16) / 8);
        cpCode += `                            bn::sprite_palette_ptr actor_${j}_tinted_palette = bn::sprite_items::${actName}.palette_item().create_new_palette();\n`;
        cpCode += `                            actor_${j}_tinted_palette.set_fade(bn::color(${r}, ${g}, ${b}), bn::fixed(0.3));\n`;
        cpCode += `                            actor_${j}_sprite.set_palette(actor_${j}_tinted_palette);\n`;
      }
      cpCode += `                        }\n`;
    }
    cpCode += `                    }\n`;
    cpCode += `                }\n`;
    cpCode += `            }\n`;
  });
  return cpCode;
})();
            if (scriptCode && scriptIsInteract) {
              actorLogicCode += `            if (bn::keypad::a_pressed() && !actor_${i}_interact_active) {\n`;
              actorLogicCode += `                actor_${i}_interact_active = true;\n`;
              actorLogicCode += scriptCode;
              actorLogicCode += `            } else if (!bn::keypad::a_held()) {\n`;
              actorLogicCode += `                actor_${i}_interact_active = false;\n`;
              actorLogicCode += `            }\n`;
            } else if (scriptCode) {
              actorLogicCode += scriptCode;
            }
          } else if (a.type === 'platform' || a.type === 'staticPlatform' || a.type === 'movingPlatform' || a.type === 'ladder' || a.type === 'coin' || a.type === 'bonus' || a.type === 'spring' || a.type === 'hazard' || a.type === 'destructible' || a.type === 'key' || a.type === 'door' || a.type === 'powerup' || a.type === 'sign' || a.type === 'pushable' || a.type === 'conveyor' || a.type === 'checkpoint' || a.type === 'ammo_pickup' || a.type === 'xp_orb' || a.type === 'shield' || a.type === 'grenade' || a.type === 'magnet' || a.type === 'health_pickup') {
            const isMoving = a.isMoving ?? (a.type === 'movingPlatform');
            if (isMoving) {
              const speedVal = a.moveSpeed ?? 1;
              const amountVal = a.moveAmount ?? 32;
            const dirVal = a.moveDir || 'horizontal';
            const isPlat = a.type === 'platform' || a.type === 'staticPlatform' || a.type === 'movingPlatform' || a.type === 'destructible' || a.type === 'door' || a.type === 'conveyor';

            actorLogicCode += `            bn::fixed speed_${i} = bn::fixed(${speedVal});\n`;
            if (isPlat && a.moveOnlyOnStand) {
              actorLogicCode += `            if (actor_${i}_player_on) {\n`;
            }

            if (dirVal === 'vertical' || dirVal === 'bounce' || dirVal === 'bounce') {
                actorLogicCode += `                actor_${i}_float_y += speed_${i} * actor_${i}_dir;\n`;
                actorLogicCode += `                if (actor_${i}_dir == 1 && actor_${i}_float_y >= actor_${i}_start_y + bn::fixed(${amountVal})) {\n`;
                actorLogicCode += `                    actor_${i}_float_y = actor_${i}_start_y + bn::fixed(${amountVal});\n`;
                actorLogicCode += `                    actor_${i}_dir = -1;\n`;
                actorLogicCode += `                } else if (actor_${i}_dir == -1 && actor_${i}_float_y <= actor_${i}_start_y) {\n`;
                actorLogicCode += `                    actor_${i}_float_y = actor_${i}_start_y;\n`;
                actorLogicCode += `                    actor_${i}_dir = 1;\n`;
                actorLogicCode += `                }\n`;
                actorLogicCode += `                actor_${i}_dy = speed_${i} * actor_${i}_dir;\n`;
                actorLogicCode += `                actor_${i}_dx = 0;\n`;
              } else {
                actorLogicCode += `                actor_${i}_float_x += speed_${i} * actor_${i}_dir;\n`;
                actorLogicCode += `                if (actor_${i}_dir == 1 && actor_${i}_float_x >= actor_${i}_start_x + bn::fixed(${amountVal})) {\n`;
                actorLogicCode += `                    actor_${i}_float_x = actor_${i}_start_x + bn::fixed(${amountVal});\n`;
                actorLogicCode += `                    actor_${i}_dir = -1;\n`;
                actorLogicCode += `                } else if (actor_${i}_dir == -1 && actor_${i}_float_x <= actor_${i}_start_x) {\n`;
                actorLogicCode += `                    actor_${i}_float_x = actor_${i}_start_x;\n`;
                actorLogicCode += `                    actor_${i}_dir = 1;\n`;
                actorLogicCode += `                }\n`;
                actorLogicCode += `                actor_${i}_dx = speed_${i} * actor_${i}_dir;\n`;
                actorLogicCode += `                actor_${i}_dy = 0;\n`;
              }

              if (isPlat && a.moveOnlyOnStand) {
                actorLogicCode += `            } else {\n`;
                actorLogicCode += `                actor_${i}_dx = 0;\n`;
                actorLogicCode += `                actor_${i}_dy = 0;\n`;
                actorLogicCode += `            }\n`;
                actorLogicCode += `            actor_${i}_player_on = false;\n`;
              }

              actorLogicCode += `            actor_${i}_x = actor_${i}_float_x.integer();\n`;
              actorLogicCode += `            actor_${i}_y = actor_${i}_float_y.integer();\n`;
            } else if (a.type === 'pushable') {
              if (scene.type === 'PLATFORMER') {
                actorLogicCode += `            actor_${i}_dy += bn::fixed(${scene.gravity ?? 0.5}) * bn::fixed(${a.weight ?? 1});\n`;
                actorLogicCode += `            if (actor_${i}_dy > bn::fixed(${scene.maxFallVelocity ?? 8.0})) actor_${i}_dy = bn::fixed(${scene.maxFallVelocity ?? 8.0});\n`;
                actorLogicCode += `            if (actor_${i}_dy != 0) {\n`;
                actorLogicCode += `                bn::fixed new_y = actor_${i}_float_y + actor_${i}_dy;\n`;
                actorLogicCode += `                bool blocked = false;\n`;
                actorLogicCode += `                if (actor_${i}_dy >= 0) {\n`;
                actorLogicCode += `                    blocked = check_ground_collision(actor_${i}_float_x, new_y, ${a.collisionX ?? 0}, ${a.collisionY ?? 0}, ${a.collisionW ?? a.width ?? 16}, ${a.collisionH ?? a.height ?? 16});\n`;
                actorLogicCode += `                } else {\n`;
                actorLogicCode += `                    blocked = check_solid_collision(actor_${i}_float_x, new_y, ${a.collisionX ?? 0}, ${a.collisionY ?? 0}, ${a.collisionW ?? a.width ?? 16}, ${a.collisionH ?? a.height ?? 16});\n`;
                actorLogicCode += `                }\n`;
                actorLogicCode += `                if (!blocked) {\n`;
                actorLogicCode += `                    bool hit_plat = false;\n`;
                for (let j = 0; j < sActors.length; j++) {
                  if (i === j) continue;
                  const platform = sActors[j];
                  if (platform.type === 'platform' || platform.type === 'staticPlatform' || platform.type === 'movingPlatform' || platform.type === 'destructible' || platform.type === 'door' || platform.type === 'pushable' || platform.type === 'conveyor' || platform.type === 'ice_block' || platform.type === 'crumbling_platform' || platform.type === 'pass_wall' || (platform.type === 'one_way_wall' && platform.oneWayDirection === 'down')) {
                    const pCW = platform.collisionW ?? platform.width ?? 16;
                    const pCH = platform.collisionH ?? platform.height ?? 16;
                    const pCX = platform.collisionX ?? 0;
                    const pCY = platform.collisionY ?? 0;
                    const activeCond = platform.type === 'pass_wall' ? `actor_${j}_active && actor_${j}_pass_count == 0` : `actor_${j}_active`;
                    actorLogicCode += `                    if (${activeCond} && actor_${i}_dy >= 0) {\n`;
                    actorLogicCode += `                        int px_l = actor_${i}_float_x.integer() + ${a.collisionX ?? 0};\n`;
                    actorLogicCode += `                        int px_r = actor_${i}_float_x.integer() + ${a.collisionX ?? 0} + ${a.collisionW ?? a.width ?? 16};\n`;
                    actorLogicCode += `                        int py_t = new_y.integer() + ${a.collisionY ?? 0};\n`;
                    actorLogicCode += `                        int py_b = new_y.integer() + ${a.collisionY ?? 0} + ${a.collisionH ?? a.height ?? 16};\n`;
                    actorLogicCode += `                        int plat_l = actor_${j}_x + ${pCX};\n`;
                    actorLogicCode += `                        int plat_r = actor_${j}_x + ${pCX} + ${pCW};\n`;
                    actorLogicCode += `                        int plat_t = actor_${j}_y + ${pCY};\n`;
                    actorLogicCode += `                        int plat_b = actor_${j}_y + ${pCY} + ${pCH};\n`;
                    actorLogicCode += `                        if (px_r > plat_l && px_l < plat_r && py_b > plat_t && py_t < plat_b) {\n`;
                    actorLogicCode += `                            hit_plat = true;\n`;
                    const isMovingPlat = platform.isMoving ?? (platform.type === 'movingPlatform' || platform.type === 'pushable');
                    if (isMovingPlat) {
                      actorLogicCode += `                            actor_${i}_float_x += actor_${j}_dx;\n`;
                      actorLogicCode += `                            actor_${i}_float_y += actor_${j}_dy;\n`;
                    }
                    actorLogicCode += `                        }\n`;
                    actorLogicCode += `                    }\n`;
                  }
                }
                actorLogicCode += `                    if (!hit_plat) {\n`;
                actorLogicCode += `                        actor_${i}_float_y = new_y;\n`;
                actorLogicCode += `                    } else {\n`;
                actorLogicCode += `                        actor_${i}_dy = 0;\n`;
                actorLogicCode += `                    }\n`;
                actorLogicCode += `                } else {\n`;
                actorLogicCode += `                    if (actor_${i}_dy > 0) {\n`;
                actorLogicCode += `                        int ty = (new_y + ${a.collisionY ?? 0} + ${a.collisionH ?? a.height ?? 16} - bn::fixed::from_data(1)).integer() / 8;\n`;
                actorLogicCode += `                        actor_${i}_float_y = (ty * 8) - ${a.collisionY ?? 0} - ${a.collisionH ?? a.height ?? 16};\n`;
                actorLogicCode += `                    } else if (actor_${i}_dy < 0) {\n`;
                actorLogicCode += `                        int top_y = new_y.integer() + ${a.collisionY ?? 0};\n`;
                actorLogicCode += `                        int ty = top_y / 8;\n`;
                actorLogicCode += `                        actor_${i}_float_y = ((ty + 1) * 8) - ${a.collisionY ?? 0};\n`;
                actorLogicCode += `                    }\n`;
                actorLogicCode += `                    actor_${i}_dy = 0;\n`;
                actorLogicCode += `                }\n`;
                actorLogicCode += `            }\n`;
              }
              actorLogicCode += `            actor_${i}_x = actor_${i}_float_x.integer();\n`;
              actorLogicCode += `            actor_${i}_y = actor_${i}_float_y.integer();\n`;
              actorLogicCode += `            actor_${i}_dx = 0;\n`;
              actorLogicCode += `            actor_${i}_dy = 0;\n`;
              // Squash actors on impact
              if (a.squashActors) {
                const bCW = a.collisionW ?? a.width ?? 16;
                const bCH = a.collisionH ?? a.height ?? 16;
                const bCX = a.collisionX ?? 0;
                const bCY = a.collisionY ?? 0;
                const squashTargets = a.squashTargets || [];
                sActors.forEach((target, targetIdx) => {
                  if (squashTargets.includes(target.type)) {
                    const tCW = target.collisionW ?? target.width ?? 16;
                    const tCH = target.collisionH ?? target.height ?? 16;
                    const tCX = target.collisionX ?? 0;
                    const tCY = target.collisionY ?? 0;
                    actorLogicCode += `            if (actor_${targetIdx}_active) {\n`;
                    actorLogicCode += `                int bx_l = actor_${i}_x + ${bCX};\n`;
                    actorLogicCode += `                int bx_r = bx_l + ${bCW};\n`;
                    actorLogicCode += `                int by_t = actor_${i}_y + ${bCY};\n`;
                    actorLogicCode += `                int by_b = by_t + ${bCH};\n`;
                    actorLogicCode += `                int tx_l = actor_${targetIdx}_x + ${tCX};\n`;
                    actorLogicCode += `                int tx_r = tx_l + ${tCW};\n`;
                    actorLogicCode += `                int ty_t = actor_${targetIdx}_y + ${tCY};\n`;
                    actorLogicCode += `                int ty_b = ty_t + ${tCH};\n`;
                    actorLogicCode += `                if (bx_r > tx_l && bx_l < tx_r && by_b > ty_t && by_t < ty_b) {\n`;
                    actorLogicCode += `                    actor_${targetIdx}_active = false;\n`;
                    actorLogicCode += `                    actor_${targetIdx}_sprite.set_visible(false);\n`;
                    actorLogicCode += `                }\n`;
                    actorLogicCode += `            }\n`;
                  }
                });
              }
            } else {
              actorLogicCode += `            actor_${i}_dx = 0;\n`;
              actorLogicCode += `            actor_${i}_dy = 0;\n`;
            }
            if (a.type === 'destructible') {
              const bCW = a.collisionW ?? a.width ?? 16;
              const bCH = a.collisionH ?? a.height ?? 16;
              const bCX = a.collisionX ?? 0;
              const bCY = a.collisionY ?? 0;
              const breakBy = a.destructibleBreakBy || 'any';
              const canBreakFromProjectile = (breakBy === 'any' || breakBy === 'projectile');
              actorLogicCode += `            for(int p=0; p<20; ++p) {\n`;
              actorLogicCode += `                if(proj_active[p] && proj_from_player[p]) {\n`;
              actorLogicCode += `                    int proj_w = 8; int proj_h = 8;\n`;
              actorLogicCode += `                    if (proj_x[p] + proj_w > actor_${i}_x + ${bCX} && proj_x[p] < actor_${i}_x + ${bCX} + ${bCW} &&\n`;
              actorLogicCode += `                        proj_y[p] + proj_h > actor_${i}_y + ${bCY} && proj_y[p] < actor_${i}_y + ${bCY} + ${bCH}) {\n`;
              actorLogicCode += `                        proj_active[p] = false;\n`;
              actorLogicCode += `                        proj_sprites[p].reset();\n`;
              if (canBreakFromProjectile) {
                actorLogicCode += `                        actor_${i}_hp--;\n`;
                actorLogicCode += `                        bn::sound_items::snd_square_440_100.play();\n`;
                actorLogicCode += `                        if (actor_${i}_hp <= 0) {\n`;
                actorLogicCode += `                            actor_${i}_active = false;\n`;
                actorLogicCode += `                            actor_${i}_sprite.set_visible(false);\n`;
                if (a.destructibleDropActorId) {
                  const dropIdx = sActors.findIndex(act => act && String(act.id) === String(a.destructibleDropActorId));
                  if (dropIdx !== -1) {
                    actorLogicCode += `                            actor_${dropIdx}_float_x = actor_${i}_x;\n`;
                    actorLogicCode += `                            actor_${dropIdx}_float_y = actor_${i}_y;\n`;
                    actorLogicCode += `                            actor_${dropIdx}_x = actor_${i}_x;\n`;
                    actorLogicCode += `                            actor_${dropIdx}_y = actor_${i}_y;\n`;
                    actorLogicCode += `                            actor_${dropIdx}_active = true;\n`;
                    actorLogicCode += `                            actor_${dropIdx}_sprite.set_visible(true);\n`;
                  }
                }
                let blockScript = generateScriptLogic(a.script, i, a.width, a.height, undefined, undefined, scCtx);
                if (blockScript) {
                  actorLogicCode += blockScript;
                }
                actorLogicCode += `                        }\n`;
              }
              actorLogicCode += `                    }\n`;
              actorLogicCode += `                }\n`;
              actorLogicCode += `            }\n`;
            }
            if (scriptCode && scriptIsInteract) {
              const sCW = a.collisionW ?? a.width ?? 16;
              const sCH = a.collisionH ?? a.height ?? 16;
              const sCX = a.collisionX ?? 0;
              const sCY = a.collisionY ?? 0;
              const playerIdx = sActors.findIndex(act => act && act.type === 'player');
              if (playerIdx !== -1) {
                const pActor = sActors[playerIdx];
                const pCW = pActor.collisionW ?? pActor.width ?? 16;
                const pCH = pActor.collisionH ?? pActor.height ?? 16;
                const pCX = pActor.collisionX ?? 0;
                const pCY = pActor.collisionY ?? 0;
                actorLogicCode += `            {\n`;
                actorLogicCode += `                int ox_l = actor_${i}_x + ${sCX};\n`;
                actorLogicCode += `                int ox_r = ox_l + ${sCW};\n`;
                actorLogicCode += `                int oy_t = actor_${i}_y + ${sCY};\n`;
                actorLogicCode += `                int oy_b = oy_t + ${sCH};\n`;
                actorLogicCode += `                int px_l = actor_${playerIdx}_float_x.integer() + ${pCX};\n`;
                actorLogicCode += `                int px_r = px_l + ${pCW};\n`;
                actorLogicCode += `                int py_t = actor_${playerIdx}_float_y.integer() + ${pCY};\n`;
                actorLogicCode += `                int py_b = py_t + ${pCH};\n`;
                actorLogicCode += `                bool inside = px_r > ox_l && px_l < ox_r && py_b > oy_t && py_t < oy_b;\n`;
                actorLogicCode += `                if (inside && bn::keypad::a_pressed() && !actor_${i}_interact_active) {\n`;
                actorLogicCode += `                    actor_${i}_interact_active = true;\n`;
                actorLogicCode += scriptCode;
                actorLogicCode += `                } else if (!inside) {\n`;
                actorLogicCode += `                    actor_${i}_interact_active = false;\n`;
                actorLogicCode += `                }\n`;
                actorLogicCode += `            }\n`;
              } else {
                actorLogicCode += scriptCode;
              }
            } else if (scriptCode) {
              actorLogicCode += scriptCode;
            }
          } else if (a.type === 'enemy') {
            const speedVal = a.moveSpeed ?? a.enemySpeed ?? 1;
            const amountVal = a.moveAmount ?? a.enemyRange ?? 32;
            const dirVal = a.moveDir || a.enemyDir || 'horizontal';
            const enemyBehavior = a.enemyBehavior || 'patrol';

            // 1. Calculate base velocity
            if (enemyBehavior === 'follow') {
              const playerIdx = sActors.findIndex(act => act && act.type === 'player');
              actorLogicCode += `            actor_${i}_dx = 0;\n`;
              actorLogicCode += `            actor_${i}_dy = 0;\n`;
              if (playerIdx !== -1) {
                actorLogicCode += `            if (actor_${playerIdx}_active) {\n`;
                actorLogicCode += `                bn::fixed speed_${i} = bn::fixed(${speedVal});\n`;

                const followX = a.moveDir === 'horizontal' || a.enemyDir === 'horizontal' || !a.moveDir || (scene.type === 'TOPDOWN' && a.moveDir !== 'vertical' && a.enemyDir !== 'vertical');
                const followY = a.moveDir === 'vertical' || a.enemyDir === 'vertical' || (scene.type === 'TOPDOWN' && a.moveDir !== 'horizontal' && a.enemyDir !== 'horizontal' && a.moveDir !== 'vertical' && a.enemyDir !== 'vertical');

                const proximityVal = parseInt(a.followProximity) || 0;
                if (proximityVal > 0) {
                  actorLogicCode += `                int diff_x = actor_${playerIdx}_x - actor_${i}_x;\n`;
                  actorLogicCode += `                int diff_y = actor_${playerIdx}_y - actor_${i}_y;\n`;
                  actorLogicCode += `                if ((diff_x * diff_x) + (diff_y * diff_y) <= ${proximityVal * proximityVal}) {\n`;
                  // Follow
                  if (followX) {
                    actorLogicCode += `                    if (actor_${playerIdx}_float_x > actor_${i}_float_x + 1) actor_${i}_dx = speed_${i};\n`;
                    actorLogicCode += `                    else if (actor_${playerIdx}_float_x < actor_${i}_float_x - 1) actor_${i}_dx = -speed_${i};\n`;
                  }
                  if (followY && scene.type !== 'PLATFORMER') {
                    actorLogicCode += `                    if (actor_${playerIdx}_float_y > actor_${i}_float_y + 1) actor_${i}_dy = speed_${i};\n`;
                    actorLogicCode += `                    else if (actor_${playerIdx}_float_y < actor_${i}_float_y - 1) actor_${i}_dy = -speed_${i};\n`;
                  }
                  actorLogicCode += `                } else {\n`;
                  // Patrol
                  if (dirVal === 'vertical' || dirVal === 'bounce') {
                    actorLogicCode += `                    if (actor_${i}_dir == 1 && actor_${i}_float_y >= actor_${i}_start_y + bn::fixed(${amountVal})) {\n`;
                    actorLogicCode += `                        actor_${i}_float_y = actor_${i}_start_y + bn::fixed(${amountVal});\n`;
                    actorLogicCode += `                        actor_${i}_dir = -1;\n`;
                    actorLogicCode += `                    } else if (actor_${i}_dir == -1 && actor_${i}_float_y <= actor_${i}_start_y) {\n`;
                    actorLogicCode += `                        actor_${i}_float_y = actor_${i}_start_y;\n`;
                    actorLogicCode += `                        actor_${i}_dir = 1;\n`;
                    actorLogicCode += `                    }\n`;
                    actorLogicCode += `                    actor_${i}_dy = speed_${i} * actor_${i}_dir;\n`;
                  } else {
                    actorLogicCode += `                    if (actor_${i}_dir == 1 && actor_${i}_float_x >= actor_${i}_start_x + bn::fixed(${amountVal})) {\n`;
                    actorLogicCode += `                        actor_${i}_float_x = actor_${i}_start_x + bn::fixed(${amountVal});\n`;
                    actorLogicCode += `                        actor_${i}_dir = -1;\n`;
                    actorLogicCode += `                    } else if (actor_${i}_dir == -1 && actor_${i}_float_x <= actor_${i}_start_x) {\n`;
                    actorLogicCode += `                        actor_${i}_float_x = actor_${i}_start_x;\n`;
                    actorLogicCode += `                        actor_${i}_dir = 1;\n`;
                    actorLogicCode += `                    }\n`;
                    actorLogicCode += `                    actor_${i}_dx = speed_${i} * actor_${i}_dir;\n`;
                  }
                  actorLogicCode += `                }\n`;
                } else {
                  // Follow unconditionally
                  if (followX) {
                    actorLogicCode += `                if (actor_${playerIdx}_float_x > actor_${i}_float_x + 1) actor_${i}_dx = speed_${i};\n`;
                    actorLogicCode += `                else if (actor_${playerIdx}_float_x < actor_${i}_float_x - 1) actor_${i}_dx = -speed_${i};\n`;
                  }
                  if (followY && scene.type !== 'PLATFORMER') {
                    actorLogicCode += `                if (actor_${playerIdx}_float_y > actor_${i}_float_y + 1) actor_${i}_dy = speed_${i};\n`;
                    actorLogicCode += `                else if (actor_${playerIdx}_float_y < actor_${i}_float_y - 1) actor_${i}_dy = -speed_${i};\n`;
                  }
                }
                actorLogicCode += `            }\n`;
              }
            } else if (enemyBehavior === 'patrol') {
              actorLogicCode += `            bn::fixed speed_${i} = bn::fixed(${speedVal});\n`;
              if (dirVal === 'vertical' || dirVal === 'bounce') {
                actorLogicCode += `            actor_${i}_dx = 0;\n`;
                actorLogicCode += `            if (actor_${i}_dir == 1 && actor_${i}_float_y >= actor_${i}_start_y + bn::fixed(${amountVal})) {\n`;
                actorLogicCode += `                actor_${i}_float_y = actor_${i}_start_y + bn::fixed(${amountVal});\n`;
                actorLogicCode += `                actor_${i}_dir = -1;\n`;
                actorLogicCode += `            } else if (actor_${i}_dir == -1 && actor_${i}_float_y <= actor_${i}_start_y) {\n`;
                actorLogicCode += `                actor_${i}_float_y = actor_${i}_start_y;\n`;
                actorLogicCode += `                actor_${i}_dir = 1;\n`;
                actorLogicCode += `            }\n`;
                actorLogicCode += `            actor_${i}_dy = speed_${i} * actor_${i}_dir;\n`;
              } else {
                actorLogicCode += `            actor_${i}_dy = 0;\n`;
                actorLogicCode += `            if (actor_${i}_dir == 1 && actor_${i}_float_x >= actor_${i}_start_x + bn::fixed(${amountVal})) {\n`;
                actorLogicCode += `                actor_${i}_float_x = actor_${i}_start_x + bn::fixed(${amountVal});\n`;
                actorLogicCode += `                actor_${i}_dir = -1;\n`;
                actorLogicCode += `            } else if (actor_${i}_dir == -1 && actor_${i}_float_x <= actor_${i}_start_x) {\n`;
                actorLogicCode += `                actor_${i}_float_x = actor_${i}_start_x;\n`;
                actorLogicCode += `                actor_${i}_dir = 1;\n`;
                actorLogicCode += `            }\n`;
                actorLogicCode += `            actor_${i}_dx = speed_${i} * actor_${i}_dir;\n`;
              }
            } else if (enemyBehavior === 'sine') {
              actorLogicCode += `            bn::fixed speed_${i} = bn::fixed(${speedVal});\n`;
              actorLogicCode += `            actor_${i}_timer++;\n`;
              if (dirVal === 'vertical' || dirVal === 'bounce') {
                actorLogicCode += `            actor_${i}_dy = speed_${i} * actor_${i}_dir;\n`;
                actorLogicCode += `            actor_${i}_dx = bn::degrees_lut_sin(bn::fixed((actor_${i}_timer * 4) % 360)) * bn::fixed(${amountVal} / 16.0);\n`;
                actorLogicCode += `            if (actor_${i}_dir == 1 && actor_${i}_float_y >= actor_${i}_start_y + bn::fixed(${amountVal})) {\n`;
                actorLogicCode += `                actor_${i}_float_y = actor_${i}_start_y + bn::fixed(${amountVal});\n`;
                actorLogicCode += `                actor_${i}_dir = -1;\n`;
                actorLogicCode += `            } else if (actor_${i}_dir == -1 && actor_${i}_float_y <= actor_${i}_start_y) {\n`;
                actorLogicCode += `                actor_${i}_float_y = actor_${i}_start_y;\n`;
                actorLogicCode += `                actor_${i}_dir = 1;\n`;
                actorLogicCode += `            }\n`;
              } else {
                actorLogicCode += `            actor_${i}_dx = speed_${i} * actor_${i}_dir;\n`;
                actorLogicCode += `            actor_${i}_dy = bn::degrees_lut_sin(bn::fixed((actor_${i}_timer * 4) % 360)) * bn::fixed(${amountVal} / 16.0);\n`;
                actorLogicCode += `            if (actor_${i}_dir == 1 && actor_${i}_float_x >= actor_${i}_start_x + bn::fixed(${amountVal})) {\n`;
                actorLogicCode += `                actor_${i}_float_x = actor_${i}_start_x + bn::fixed(${amountVal});\n`;
                actorLogicCode += `                actor_${i}_dir = -1;\n`;
                actorLogicCode += `            } else if (actor_${i}_dir == -1 && actor_${i}_float_x <= actor_${i}_start_x) {\n`;
                actorLogicCode += `                actor_${i}_float_x = actor_${i}_start_x;\n`;
                actorLogicCode += `                actor_${i}_dir = 1;\n`;
                actorLogicCode += `            }\n`;
              }
            } else if (enemyBehavior === 'zigzag') {
              actorLogicCode += `            bn::fixed speed_${i} = bn::fixed(${speedVal});\n`;
              actorLogicCode += `            actor_${i}_timer++;\n`;
              actorLogicCode += `            if (actor_${i}_timer >= 60) actor_${i}_timer = 0;\n`;
              if (dirVal === 'vertical' || dirVal === 'bounce') {
                actorLogicCode += `            actor_${i}_dy = speed_${i} * actor_${i}_dir;\n`;
                actorLogicCode += `            actor_${i}_dx = (actor_${i}_timer < 30) ? speed_${i} : -speed_${i};\n`;
                actorLogicCode += `            if (actor_${i}_dir == 1 && actor_${i}_float_y >= actor_${i}_start_y + bn::fixed(${amountVal})) {\n`;
                actorLogicCode += `                actor_${i}_float_y = actor_${i}_start_y + bn::fixed(${amountVal});\n`;
                actorLogicCode += `                actor_${i}_dir = -1;\n`;
                actorLogicCode += `            } else if (actor_${i}_dir == -1 && actor_${i}_float_y <= actor_${i}_start_y) {\n`;
                actorLogicCode += `                actor_${i}_float_y = actor_${i}_start_y;\n`;
                actorLogicCode += `                actor_${i}_dir = 1;\n`;
                actorLogicCode += `            }\n`;
              } else {
                actorLogicCode += `            actor_${i}_dx = speed_${i} * actor_${i}_dir;\n`;
                actorLogicCode += `            actor_${i}_dy = (actor_${i}_timer < 30) ? speed_${i} : -speed_${i};\n`;
                actorLogicCode += `            if (actor_${i}_dir == 1 && actor_${i}_float_x >= actor_${i}_start_x + bn::fixed(${amountVal})) {\n`;
                actorLogicCode += `                actor_${i}_float_x = actor_${i}_start_x + bn::fixed(${amountVal});\n`;
                actorLogicCode += `                actor_${i}_dir = -1;\n`;
                actorLogicCode += `            } else if (actor_${i}_dir == -1 && actor_${i}_float_x <= actor_${i}_start_x) {\n`;
                actorLogicCode += `                actor_${i}_float_x = actor_${i}_start_x;\n`;
                actorLogicCode += `                actor_${i}_dir = 1;\n`;
                actorLogicCode += `            }\n`;
              }
            } else if (enemyBehavior === 'random') {
              actorLogicCode += `            bn::fixed speed_${i} = bn::fixed(${speedVal});\n`;
              actorLogicCode += `            if (actor_${i}_timer > 0) { actor_${i}_timer--; }\n`;
              actorLogicCode += `            else {\n`;
              actorLogicCode += `                actor_${i}_timer = (rng.get_int(60) + 30);\n`;
              if (scene.type === 'PLATFORMER') {
                actorLogicCode += `                int r = rng.get_int(3);\n`;
                actorLogicCode += `                if (r == 0) { actor_${i}_dx = speed_${i}; actor_${i}_dy = 0; }\n`;
                actorLogicCode += `                else if (r == 1) { actor_${i}_dx = -speed_${i}; actor_${i}_dy = 0; }\n`;
                actorLogicCode += `                else { actor_${i}_dx = 0; actor_${i}_dy = 0; }\n`;
              } else {
                actorLogicCode += `                int r = rng.get_int(5);\n`;
                actorLogicCode += `                if (r == 0) { actor_${i}_dx = speed_${i}; actor_${i}_dy = 0; }\n`;
                actorLogicCode += `                else if (r == 1) { actor_${i}_dx = -speed_${i}; actor_${i}_dy = 0; }\n`;
                actorLogicCode += `                else if (r == 2) { actor_${i}_dx = 0; actor_${i}_dy = speed_${i}; }\n`;
                actorLogicCode += `                else if (r == 3) { actor_${i}_dx = 0; actor_${i}_dy = -speed_${i}; }\n`;
                actorLogicCode += `                else { actor_${i}_dx = 0; actor_${i}_dy = 0; }\n`;
              }
              actorLogicCode += `            }\n`;
             } else {
              actorLogicCode += `            actor_${i}_dx = 0;\n`;
              actorLogicCode += `            actor_${i}_dy = 0;\n`;
            }

            // 2. Apply gravity in Platformer mode (unless it's vertical flying patrol)
            const isFlyingPatrol = (enemyBehavior === 'patrol' && dirVal === 'vertical' || dirVal === 'bounce') || (enemyBehavior === 'follow' && (parseInt(a.followProximity) || 0) > 0 && dirVal === 'vertical' || dirVal === 'bounce');
            if (scene.type === 'PLATFORMER' && !isFlyingPatrol) {
              actorLogicCode += `            actor_${i}_dy += bn::fixed(${scene.gravity ?? 0.5});\n`;
              actorLogicCode += `            if (actor_${i}_dy > bn::fixed(${scene.maxFallVelocity ?? 8.0})) actor_${i}_dy = bn::fixed(${scene.maxFallVelocity ?? 8.0});\n`;

              // Ground detection â€” also snap float_y to tile top so the actor doesn't sink into solids
              actorLogicCode += `            [[maybe_unused]] bool actor_${i}_on_ground = false;\n`;
              actorLogicCode += `            if (check_solid_collision(actor_${i}_float_x, actor_${i}_float_y + 1, ${a.collisionX ?? 0}, ${a.collisionY ?? 0}, ${a.collisionW ?? a.width ?? 16}, ${a.collisionH ?? a.height ?? 16})) {\n`;
              actorLogicCode += `                actor_${i}_on_ground = true;\n`;
              actorLogicCode += `                if (actor_${i}_dy > 0) {\n`;
              actorLogicCode += `                    int ck_ty = (actor_${i}_float_y + 1 + ${a.collisionY ?? 0} + ${a.collisionH ?? a.height ?? 16} - bn::fixed::from_data(1)).integer() / 8;\n`;
              actorLogicCode += `                    actor_${i}_float_y = (ck_ty * 8) - ${a.collisionY ?? 0} - ${a.collisionH ?? a.height ?? 16};\n`;
              actorLogicCode += `                    actor_${i}_dy = 0;\n`;
              actorLogicCode += `                }\n`;
              actorLogicCode += `            }\n`;

              // Platform checks
              for (let j = 0; j < sActors.length; j++) {
                if (i === j) continue;
                const platform = sActors[j];
                if (platform.type === 'platform' || platform.type === 'staticPlatform' || platform.type === 'movingPlatform' || platform.type === 'destructible' || platform.type === 'door' || platform.type === 'pushable' || platform.type === 'conveyor' || platform.type === 'ice_block' || platform.type === 'crumbling_platform' || platform.type === 'pass_wall' || (platform.type === 'one_way_wall' && platform.oneWayDirection === 'down')) {
                  const pCW = platform.collisionW ?? platform.width ?? 16;
                  const pCH = platform.collisionH ?? platform.height ?? 16;
                  const pCX = platform.collisionX ?? 0;
                  const pCY = platform.collisionY ?? 0;
                  const activeCond = platform.type === 'pass_wall' ? `actor_${j}_active && actor_${j}_pass_count == 0` : `actor_${j}_active`;
                  actorLogicCode += `            if (${activeCond} && actor_${i}_dy >= 0) {\n`;
                  actorLogicCode += `                int px = actor_${i}_float_x.integer() + ${a.collisionX ?? 0} + ${Math.floor((a.collisionW ?? a.width ?? 16) / 2)};\n`;
                  actorLogicCode += `                int py = actor_${i}_float_y.integer() + ${a.collisionY ?? 0} + ${a.collisionH ?? a.height ?? 16};\n`;
                  actorLogicCode += `                int plat_l = actor_${j}_x + ${pCX};\n`;
                  actorLogicCode += `                int plat_r = actor_${j}_x + ${pCX} + ${pCW};\n`;
                  actorLogicCode += `                int plat_t = actor_${j}_y + ${pCY};\n`;

                  actorLogicCode += `                if (px >= plat_l && px <= plat_r && py >= plat_t && py < plat_t + 8) {\n`;
                  actorLogicCode += `                    actor_${i}_on_ground = true;\n`;
                  actorLogicCode += `                    actor_${i}_float_y = plat_t - (${a.collisionY ?? 0} + ${a.collisionH ?? a.height ?? 16});\n`;
                  actorLogicCode += `                    if (actor_${i}_dy > 0) actor_${i}_dy = 0;\n`;
                  const isMovingPlat = platform.isMoving ?? (platform.type === 'movingPlatform' || platform.type === 'pushable');
                  if (isMovingPlat) {
                    actorLogicCode += `                    actor_${i}_float_x += actor_${j}_dx;\n`;
                    actorLogicCode += `                    actor_${i}_float_y += actor_${j}_dy;\n`;
                  }
                    actorLogicCode += `                }\n`;
                    actorLogicCode += `            }\n`;
                }
              }
            }

            // 3. Move and check Solid tile collision
            const eCW = a.collisionW ?? a.width ?? 16;
            const eCH = a.collisionH ?? a.height ?? 16;
            const eCX = a.collisionX ?? 0;
            const eCY = a.collisionY ?? 0;
            actorLogicCode += `            if (actor_${i}_dx != 0 || actor_${i}_dy != 0) {\n`;
            actorLogicCode += `                if (actor_${i}_dx != 0) {\n`;
            actorLogicCode += `                    bn::fixed new_x = actor_${i}_float_x + actor_${i}_dx;\n`;
            actorLogicCode += `                    if (!check_solid_collision(new_x, actor_${i}_float_y, ${eCX}, ${eCY}, ${eCW}, ${eCH})) {\n`;
            actorLogicCode += `                        actor_${i}_float_x = new_x;\n`;
            actorLogicCode += `                    } else {\n`;
            if (['patrol', 'sine', 'zigzag'].includes(enemyBehavior)) {
              actorLogicCode += `                        actor_${i}_dir = -actor_${i}_dir;\n`;
            }
            actorLogicCode += `                        actor_${i}_dx = 0;\n`;
            actorLogicCode += `                    }\n`;
            actorLogicCode += `                }\n`;
            actorLogicCode += `                if (actor_${i}_dy != 0) {\n`;
            actorLogicCode += `                    bn::fixed new_y = actor_${i}_float_y + actor_${i}_dy;\n`;
            actorLogicCode += `                    if (!check_solid_collision(actor_${i}_float_x, new_y, ${eCX}, ${eCY}, ${eCW}, ${eCH})) {\n`;
            actorLogicCode += `                        actor_${i}_float_y = new_y;\n`;
            actorLogicCode += `                    } else {\n`;
            actorLogicCode += `                        if (actor_${i}_dy > 0) {\n`;
            actorLogicCode += `                            int ty = (new_y + ${eCY} + ${eCH} - bn::fixed::from_data(1)).integer() / 8;\n`;
            actorLogicCode += `                            actor_${i}_float_y = (ty * 8) - ${eCY} - ${eCH};\n`;
            const hasGroundVar = scene.type === 'PLATFORMER' && !isFlyingPatrol;
            if (hasGroundVar) {
              actorLogicCode += `                            actor_${i}_on_ground = true;\n`;
            }
            actorLogicCode += `                        } else if (actor_${i}_dy < 0) {\n`;
            actorLogicCode += `                            int top_y = new_y.integer() + ${eCY};\n`;
            actorLogicCode += `                            int ty = top_y / 8;\n`;
            actorLogicCode += `                            actor_${i}_float_y = ((ty + 1) * 8) - ${eCY};\n`;
            actorLogicCode += `                        }\n`;
            actorLogicCode += `                        actor_${i}_dy = 0;\n`;
            actorLogicCode += `                    }\n`;
            actorLogicCode += `                }\n`;
            actorLogicCode += `            }\n`;
            actorLogicCode += `            actor_${i}_x = actor_${i}_float_x.integer();\n`;
            actorLogicCode += `            actor_${i}_y = actor_${i}_float_y.integer();\n`;

            if (a.enemyFireProjectiles) {
              const playerIdx = sActors.findIndex(act => act && act.type === 'player');
              actorLogicCode += `            if (actor_${i}_shoot_timer > 0) {\n`;
              actorLogicCode += `                actor_${i}_shoot_timer--;\n`;
              actorLogicCode += `            } else {\n`;
              actorLogicCode += `                actor_${i}_shoot_timer = ${a.enemyFireRate ?? 60};\n`;
              if (playerIdx !== -1) {
                actorLogicCode += `                if (actor_${playerIdx}_active) {\n`;
                actorLogicCode += `                    int diff_x = actor_${playerIdx}_x - actor_${i}_x;\n`;
                actorLogicCode += `                    int diff_y = actor_${playerIdx}_y - actor_${i}_y;\n`;
                actorLogicCode += `                    int p_dx = 0;\n`;
                actorLogicCode += `                    int p_dy = 0;\n`;
                actorLogicCode += `                    if (diff_x > 8) p_dx = 2;\n`;
                actorLogicCode += `                    else if (diff_x < -8) p_dx = -2;\n`;
                actorLogicCode += `                    if (diff_y > 8) p_dy = 2;\n`;
                actorLogicCode += `                    else if (diff_y < -8) p_dy = -2;\n`;
                actorLogicCode += `                    if (p_dx == 0 && p_dy == 0) {\n`;
                actorLogicCode += `                        p_dx = -2;\n`;
                actorLogicCode += `                    }\n`;
                actorLogicCode += `                    for(int p=0; p<20; ++p) {\n`;
                actorLogicCode += `                        if(!proj_active[p]) {\n`;
                actorLogicCode += `                            proj_x[p] = actor_${i}_x + ${Math.floor((a.width || 16) / 2)};\n`;
                actorLogicCode += `                            proj_y[p] = actor_${i}_y + ${Math.floor((a.height || 16) / 2)};\n`;
                actorLogicCode += `                            proj_dx[p] = p_dx;\n`;
                actorLogicCode += `                            proj_dy[p] = p_dy;\n`;
                actorLogicCode += `                            proj_active[p] = true;\n`;
                actorLogicCode += `                            proj_from_player[p] = false;\n`;
                actorLogicCode += `                            proj_bounce_count[p] = 0;\n`;
                const pName = a.enemyProjectileSpriteId ? `proj_sprite_${String(a.enemyProjectileSpriteId).replace(/[^a-zA-Z0-9_]/g, '_')}` : 'bullet_sprite';
                actorLogicCode += `                            proj_sprites[p] = bn::sprite_items::${pName}.create_sprite(proj_x[p] - ${Math.floor(sDims.w / 2)}, proj_y[p] - ${Math.floor(sDims.h / 2)});\n`;
                actorLogicCode += `                            proj_sprites[p]->set_palette(shared_sprite_palette);\n`;
                actorLogicCode += `                            proj_sprites[p]->set_camera(camera);\n`;
                actorLogicCode += `                            proj_sprites[p]->set_bg_priority(1);\n`;
                actorLogicCode += `                            break;\n`;
                actorLogicCode += `                        }\n`;
                actorLogicCode += `                    }\n`;
                actorLogicCode += `                }\n`;
              }
              actorLogicCode += `            }\n`;
            }

            // Check player projectile hitting enemy
            actorLogicCode += `            for(int p=0; p<20; ++p) {\n`;
            actorLogicCode += `                if(proj_active[p] && proj_from_player[p]) {\n`;
            actorLogicCode += `                    int proj_w = 8; int proj_h = 8;\n`;
            actorLogicCode += `                    if (proj_x[p] + proj_w > actor_${i}_x + ${eCX} && proj_x[p] < actor_${i}_x + ${eCX} + ${eCW} &&\n`;
            actorLogicCode += `                        proj_y[p] + proj_h > actor_${i}_y + ${eCY} && proj_y[p] < actor_${i}_y + ${eCY} + ${eCH}) {\n`;
            actorLogicCode += `                        proj_active[p] = false;\n`;
            actorLogicCode += `                        proj_sprites[p].reset();\n`;
            actorLogicCode += `                        actor_${i}_hp--;\n`;
            actorLogicCode += `                        bn::sound_items::snd_square_440_100.play();\n`;
            actorLogicCode += `                        if (actor_${i}_hp <= 0) {\n`;
            actorLogicCode += `                            actor_${i}_active = false;\n`;
            actorLogicCode += `                            actor_${i}_sprite.set_visible(false);\n`;
            const enemyDeathScriptObj = a.enemyDeathScriptId
              ? (customScripts.find(c => c && String(c.id) === String(a.enemyDeathScriptId))?.script || { nodes: [], edges: [] })
              : a.script;
            let enemyDeathScript = generateScriptLogic(enemyDeathScriptObj, i, a.width, a.height, undefined, undefined, scCtx);
            if (enemyDeathScript) {
              actorLogicCode += enemyDeathScript;
            }
            actorLogicCode += `                        }\n`;
            actorLogicCode += `                    }\n`;
            actorLogicCode += `                }\n`;
            actorLogicCode += `            }\n`;

            if (scriptCode) actorLogicCode += scriptCode;
          } else if (a.type === 'turret') {
            const isMoving = a.isMoving ?? false;
            if (isMoving) {
              const speedVal = a.moveSpeed ?? 1;
              const amountVal = a.moveAmount ?? 32;
              const dirVal = a.moveDir || 'horizontal';
              actorLogicCode += `            bn::fixed speed_${i} = bn::fixed(${speedVal});\n`;
              if (dirVal === 'vertical' || dirVal === 'bounce') {
                actorLogicCode += `                actor_${i}_float_y += speed_${i} * actor_${i}_dir;\n`;
                actorLogicCode += `                if (actor_${i}_dir == 1 && actor_${i}_float_y >= actor_${i}_start_y + bn::fixed(${amountVal})) {\n`;
                actorLogicCode += `                    actor_${i}_float_y = actor_${i}_start_y + bn::fixed(${amountVal});\n`;
                actorLogicCode += `                    actor_${i}_dir = -1;\n`;
                actorLogicCode += `                } else if (actor_${i}_dir == -1 && actor_${i}_float_y <= actor_${i}_start_y) {\n`;
                actorLogicCode += `                    actor_${i}_float_y = actor_${i}_start_y;\n`;
                actorLogicCode += `                    actor_${i}_dir = 1;\n`;
                actorLogicCode += `                }\n`;
                actorLogicCode += `                actor_${i}_dy = speed_${i} * actor_${i}_dir;\n`;
                actorLogicCode += `                actor_${i}_dx = 0;\n`;
              } else {
                actorLogicCode += `                actor_${i}_float_x += speed_${i} * actor_${i}_dir;\n`;
                actorLogicCode += `                if (actor_${i}_dir == 1 && actor_${i}_float_x >= actor_${i}_start_x + bn::fixed(${amountVal})) {\n`;
                actorLogicCode += `                    actor_${i}_float_x = actor_${i}_start_x + bn::fixed(${amountVal});\n`;
                actorLogicCode += `                    actor_${i}_dir = -1;\n`;
                actorLogicCode += `                } else if (actor_${i}_dir == -1 && actor_${i}_float_x <= actor_${i}_start_x) {\n`;
                actorLogicCode += `                    actor_${i}_float_x = actor_${i}_start_x;\n`;
                actorLogicCode += `                    actor_${i}_dir = 1;\n`;
                actorLogicCode += `                }\n`;
                actorLogicCode += `                actor_${i}_dx = speed_${i} * actor_${i}_dir;\n`;
                actorLogicCode += `                actor_${i}_dy = 0;\n`;
              }
            }
            if (a.turretFires) {
              const trackMode = a.turretTrackMode || 'player';
              const fireRate = a.turretFireRate ?? 60;
              const projSpeed = a.turretProjSpeed ?? 2;
              const projType = a.turretProjType || 'normal';
              const pName = a.turretProjectileSpriteId ? `proj_sprite_${String(a.turretProjectileSpriteId).replace(/[^a-zA-Z0-9_]/g, '_')}` : 'bullet_sprite';
              actorLogicCode += `            if (actor_${i}_shoot_timer > 0) {\n`;
              actorLogicCode += `                actor_${i}_shoot_timer--;\n`;
              actorLogicCode += `            } else {\n`;
              actorLogicCode += `                actor_${i}_shoot_timer = ${fireRate};\n`;
              actorLogicCode += `                for(int p=0; p<20; ++p) {\n`;
              actorLogicCode += `                    if(!proj_active[p]) {\n`;
              actorLogicCode += `                        proj_x[p] = actor_${i}_x + ${Math.floor((a.width || 16) / 2)};\n`;
              actorLogicCode += `                        proj_y[p] = actor_${i}_y + ${Math.floor((a.height || 16) / 2)};\n`;
              if (trackMode === 'player') {
                const playerIdx = sActors.findIndex(act => act && act.type === 'player');
                if (playerIdx !== -1) {
                  actorLogicCode += `                        int diff_x = actor_${playerIdx}_x - actor_${i}_x;\n`;
                  actorLogicCode += `                        int diff_y = actor_${playerIdx}_y - actor_${i}_y;\n`;
                  actorLogicCode += `                        proj_dx[p] = 0;\n`;
                  actorLogicCode += `                        proj_dy[p] = 0;\n`;
                  actorLogicCode += `                        if (diff_x > 8) proj_dx[p] = ${projSpeed};\n`;
                  actorLogicCode += `                        else if (diff_x < -8) proj_dx[p] = -${projSpeed};\n`;
                  actorLogicCode += `                        if (diff_y > 8) proj_dy[p] = ${projSpeed};\n`;
                  actorLogicCode += `                        else if (diff_y < -8) proj_dy[p] = -${projSpeed};\n`;
                  actorLogicCode += `                        if (proj_dx[p] == 0 && proj_dy[p] == 0) proj_dx[p] = ${projSpeed};\n`;
                }
              } else if (trackMode === 'nearest') {
                const otherActors = sActors.filter((act, actIdx) => actIdx !== i);
                actorLogicCode += `                        int nearest_dist = 999999;\n`;
                actorLogicCode += `                        int nearest_x = 0;\n`;
                actorLogicCode += `                        int nearest_y = 0;\n`;
                otherActors.forEach((other, oi) => {
                  const otherIdx = sActors.indexOf(other);
                  actorLogicCode += `                        if (actor_${otherIdx}_active) {\n`;
                  actorLogicCode += `                            int d = abs(actor_${otherIdx}_x - actor_${i}_x) + abs(actor_${otherIdx}_y - actor_${i}_y);\n`;
                  actorLogicCode += `                            if (d < nearest_dist) { nearest_dist = d; nearest_x = actor_${otherIdx}_x; nearest_y = actor_${otherIdx}_y; }\n`;
                  actorLogicCode += `                        }\n`;
                });
                actorLogicCode += `                        if (nearest_dist < 999999) {\n`;
                actorLogicCode += `                            int diff_x = nearest_x - actor_${i}_x;\n`;
                actorLogicCode += `                            int diff_y = nearest_y - actor_${i}_y;\n`;
                actorLogicCode += `                            proj_dx[p] = 0;\n`;
                actorLogicCode += `                            proj_dy[p] = 0;\n`;
                actorLogicCode += `                            if (diff_x > 8) proj_dx[p] = ${projSpeed};\n`;
                actorLogicCode += `                            else if (diff_x < -8) proj_dx[p] = -${projSpeed};\n`;
                actorLogicCode += `                            if (diff_y > 8) proj_dy[p] = ${projSpeed};\n`;
                actorLogicCode += `                            else if (diff_y < -8) proj_dy[p] = -${projSpeed};\n`;
                actorLogicCode += `                            if (proj_dx[p] == 0 && proj_dy[p] == 0) proj_dx[p] = ${projSpeed};\n`;
                actorLogicCode += `                        } else {\n`;
                actorLogicCode += `                            proj_dx[p] = ${projSpeed};\n`;
                actorLogicCode += `                            proj_dy[p] = 0;\n`;
                actorLogicCode += `                        }\n`;
              } else if (trackMode === 'fixed_dir') {
                const projDir = a.turretProjDirMode || 'horizontal';
                let dx = projSpeed, dy = 0;
                if (projDir === 'vertical') { dx = 0; dy = projSpeed; }
                else if (projDir === 'left') { dx = -projSpeed; dy = 0; }
                else if (projDir === 'right') { dx = projSpeed; dy = 0; }
                else if (projDir === 'up') { dx = 0; dy = -projSpeed; }
                else if (projDir === 'down') { dx = 0; dy = projSpeed; }
                actorLogicCode += `                        proj_dx[p] = ${dx};\n`;
                actorLogicCode += `                        proj_dy[p] = ${dy};\n`;
              } else if (trackMode === 'fixed_angle') {
                const angle = a.turretAngle ?? 0;
                const angleRad = angle * Math.PI / 180;
                let dx = Math.round(projSpeed * Math.cos(angleRad)) || 0;
                let dy = Math.round(projSpeed * Math.sin(angleRad)) || 0;
                if (dx === 0 && dy === 0) dx = projSpeed;
                actorLogicCode += `                        proj_dx[p] = ${dx};\n`;
                actorLogicCode += `                        proj_dy[p] = ${dy};\n`;
              }
              if (a.turretProjDx) {
                actorLogicCode += `                        proj_dx[p] = ${a.turretProjDx};\n`;
              }
              if (a.turretProjDy) {
                actorLogicCode += `                        proj_dy[p] = ${a.turretProjDy};\n`;
              }
              actorLogicCode += `                        proj_active[p] = true;\n`;
              actorLogicCode += `                        proj_from_player[p] = false;\n`;
              actorLogicCode += `                        proj_bouncing[p] = ${projType === 'bouncing' ? 'true' : 'false'};\n`;
              actorLogicCode += `                        proj_bounce_count[p] = 0;\n`;
              actorLogicCode += `                        proj_sprites[p] = bn::sprite_items::${pName}.create_sprite(proj_x[p] - ${Math.floor(sDims.w / 2)}, proj_y[p] - ${Math.floor(sDims.h / 2)});\n`;
              actorLogicCode += `                        proj_sprites[p]->set_palette(shared_sprite_palette);\n`;
              actorLogicCode += `                        proj_sprites[p]->set_camera(camera);\n`;
              actorLogicCode += `                        proj_sprites[p]->set_bg_priority(1);\n`;
              actorLogicCode += `                        break;\n`;
              actorLogicCode += `                    }\n`;
              actorLogicCode += `                }\n`;
              actorLogicCode += `            }\n`;
            }
            // Check for projectile damage
            const bCW = a.collisionW ?? a.width ?? 16;
            const bCH = a.collisionH ?? a.height ?? 16;
            const bCX = a.collisionX ?? 0;
            const bCY = a.collisionY ?? 0;
            actorLogicCode += `            for(int p=0; p<20; ++p) {\n`;
            actorLogicCode += `                if(proj_active[p] && proj_from_player[p]) {\n`;
            actorLogicCode += `                    int proj_w = 8; int proj_h = 8;\n`;
            actorLogicCode += `                    if (proj_x[p] + proj_w > actor_${i}_x + ${bCX} && proj_x[p] < actor_${i}_x + ${bCX} + ${bCW} &&\n`;
            actorLogicCode += `                        proj_y[p] + proj_h > actor_${i}_y + ${bCY} && proj_y[p] < actor_${i}_y + ${bCY} + ${bCH}) {\n`;
            actorLogicCode += `                        proj_active[p] = false;\n`;
            actorLogicCode += `                        proj_sprites[p].reset();\n`;
            actorLogicCode += `                        actor_${i}_hp--;\n`;
            actorLogicCode += `                        bn::sound_items::snd_square_440_100.play();\n`;
            actorLogicCode += `                        if (actor_${i}_hp <= 0) {\n`;
            actorLogicCode += `                            actor_${i}_active = false;\n`;
            actorLogicCode += `                            actor_${i}_sprite.set_visible(false);\n`;
            const turretDeathScriptObj = a.turretDeathScriptId
              ? (customScripts.find(c => c && String(c.id) === String(a.turretDeathScriptId))?.script || { nodes: [], edges: [] })
              : a.script;
            let turretDeathScript = generateScriptLogic(turretDeathScriptObj, i, a.width, a.height, undefined, undefined, scCtx);
            if (turretDeathScript) {
              actorLogicCode += turretDeathScript;
            }
            actorLogicCode += `                        }\n`;
            actorLogicCode += `                    }\n`;
            actorLogicCode += `                }\n`;
            actorLogicCode += `            }\n`;
            if (scriptCode) actorLogicCode += scriptCode;
          } else if (a.type === 'spawner') {
            if (a.spawnerActorIds && a.spawnerActorIds.length > 0) {
              actorLogicCode += `            if (actor_${i}_spawn_timer > 0) {\n`;
              actorLogicCode += `                actor_${i}_spawn_timer--;\n`;
              actorLogicCode += `            } else {\n`;
              actorLogicCode += `                actor_${i}_spawn_timer = ${a.spawnerInterval ?? 60};\n`;
              actorLogicCode += `                bool spawned_${i} = false;\n`;
              
              let spawnerLocationMode = a.spawnerLocationMode || 'random';
              let pickRandom = a.spawnerPickRandom && a.spawnerActorIds.length > 1;

              if (pickRandom) {
                actorLogicCode += `                int random_pick_${i} = rng.get_int(${a.spawnerActorIds.length});\n`;
              }

              a.spawnerActorIds.forEach((targetId, tIdx) => {
                const targetActorIdx = sActors.findIndex(act => act && String(act.id) === String(targetId));
                if (targetActorIdx !== -1) {
                  const spawnActor = sActors[targetActorIdx];
                  if (pickRandom) {
                    actorLogicCode += `                if (random_pick_${i} == ${tIdx} && !actor_${targetActorIdx}_active) {\n`;
                  } else {
                    actorLogicCode += `                if (!spawned_${i} && !actor_${targetActorIdx}_active) {\n`;
                  }

                  if (spawnerLocationMode === 'random') {
                    actorLogicCode += `                    actor_${targetActorIdx}_float_x = bn::fixed(rng.get_int(${sDims.w}));\n`;
                    actorLogicCode += `                    actor_${targetActorIdx}_float_y = bn::fixed(rng.get_int(${sDims.h}));\n`;
                  } else if (spawnerLocationMode === 'current') {
                    // Do not overwrite current position
                  } else {
                    actorLogicCode += `                    actor_${targetActorIdx}_float_x = actor_${i}_float_x;\n`;
                    actorLogicCode += `                    actor_${targetActorIdx}_float_y = actor_${i}_float_y;\n`;
                  }
                  
                  if (spawnerLocationMode !== 'current') {
                    actorLogicCode += `                    actor_${targetActorIdx}_x = actor_${targetActorIdx}_float_x.integer();\n`;
                    actorLogicCode += `                    actor_${targetActorIdx}_y = actor_${targetActorIdx}_float_y.integer();\n`;
                  }

                  actorLogicCode += `                    actor_${targetActorIdx}_active = true;\n`;
                  actorLogicCode += `                    actor_${targetActorIdx}_dx = 0;\n`;
                  actorLogicCode += `                    actor_${targetActorIdx}_dy = 0;\n`;
                  actorLogicCode += `                    actor_${targetActorIdx}_timer = 0;\n`;
                  if (spawnActor.type === 'enemy') {
                    actorLogicCode += `                    actor_${targetActorIdx}_hp = ${spawnActor.enemyHp ?? 3};\n`;
                  } else if (spawnActor.type === 'destructible') {
                    actorLogicCode += `                    actor_${targetActorIdx}_hp = ${spawnActor.destructibleHp ?? 1};\n`;
                  }
                  actorLogicCode += `                    actor_${targetActorIdx}_sprite.set_visible(true);\n`;
                  const isMoving = spawnActor.type === 'enemy' ? ((spawnActor.enemyBehavior || 'patrol') !== 'idle') : (spawnActor.isMoving ?? (spawnActor.type === 'movingPlatform' || (spawnActor.npcBehavior && ['sine', 'zigzag', 'wander', 'follow'].includes(spawnActor.npcBehavior))));
                  if (isMoving) {
                    actorLogicCode += `                    actor_${targetActorIdx}_start_x = actor_${targetActorIdx}_float_x;\n`;
                    actorLogicCode += `                    actor_${targetActorIdx}_start_y = actor_${targetActorIdx}_float_y;\n`;
                    actorLogicCode += `                    actor_${targetActorIdx}_dir = 1;\n`;
                  }
                  if (!pickRandom) {
                    actorLogicCode += `                    spawned_${i} = true;\n`;
                  }
                  actorLogicCode += `                }\n`;
                }
              });
              actorLogicCode += `            }\n`;
            } else if (a.spawnerActorId) {
              actorLogicCode += `            if (actor_${i}_spawn_timer > 0) {\n`;
              actorLogicCode += `                actor_${i}_spawn_timer--;\n`;
              actorLogicCode += `            } else {\n`;
              actorLogicCode += `                actor_${i}_spawn_timer = ${a.spawnerInterval ?? 60};\n`;
              const targetActorIdx = sActors.findIndex(act => act && String(act.id) === String(a.spawnerActorId));
              if (targetActorIdx !== -1) {
                const spawnActor = sActors[targetActorIdx];
                let spawnerLocationMode = a.spawnerLocationMode || 'random';

                actorLogicCode += `                if (!actor_${targetActorIdx}_active) {\n`;
                
                if (spawnerLocationMode === 'random') {
                  actorLogicCode += `                    actor_${targetActorIdx}_float_x = bn::fixed(rng.get_int(${sDims.w}));\n`;
                  actorLogicCode += `                    actor_${targetActorIdx}_float_y = bn::fixed(rng.get_int(${sDims.h}));\n`;
                } else if (spawnerLocationMode === 'current') {
                  // Do not overwrite current position
                } else {
                  actorLogicCode += `                    actor_${targetActorIdx}_float_x = actor_${i}_float_x;\n`;
                  actorLogicCode += `                    actor_${targetActorIdx}_float_y = actor_${i}_float_y;\n`;
                }

                if (spawnerLocationMode !== 'current') {
                  actorLogicCode += `                    actor_${targetActorIdx}_x = actor_${targetActorIdx}_float_x.integer();\n`;
                  actorLogicCode += `                    actor_${targetActorIdx}_y = actor_${targetActorIdx}_float_y.integer();\n`;
                }

                actorLogicCode += `                    actor_${targetActorIdx}_active = true;\n`;
                actorLogicCode += `                    actor_${targetActorIdx}_dx = 0;\n`;
                actorLogicCode += `                    actor_${targetActorIdx}_dy = 0;\n`;
                actorLogicCode += `                    actor_${targetActorIdx}_timer = 0;\n`;
                if (spawnActor.type === 'enemy') {
                  actorLogicCode += `                    actor_${targetActorIdx}_hp = ${spawnActor.enemyHp ?? 3};\n`;
                } else if (spawnActor.type === 'destructible') {
                  actorLogicCode += `                    actor_${targetActorIdx}_hp = ${spawnActor.destructibleHp ?? 1};\n`;
                }
                actorLogicCode += `                    actor_${targetActorIdx}_sprite.set_visible(true);\n`;
                const isMoving = spawnActor.type === 'enemy' ? ((spawnActor.enemyBehavior || 'patrol') !== 'idle') : (spawnActor.isMoving ?? (spawnActor.type === 'movingPlatform' || (spawnActor.npcBehavior && ['sine', 'zigzag', 'wander', 'follow'].includes(spawnActor.npcBehavior))));
                if (isMoving) {
                  actorLogicCode += `                    actor_${targetActorIdx}_start_x = actor_${targetActorIdx}_float_x;\n`;
                  actorLogicCode += `                    actor_${targetActorIdx}_start_y = actor_${targetActorIdx}_float_y;\n`;
                  actorLogicCode += `                    actor_${targetActorIdx}_dir = 1;\n`;
                }
                actorLogicCode += `                }\n`;
              }
              actorLogicCode += `            }\n`;
            }
            if (scriptCode) actorLogicCode += scriptCode;
          } else if (a.type === 'companion') {
            const speedVal = a.moveSpeed ?? 1.5;
            const behav = a.companionBehavior || 'follow';
            const playerIdx = sActors.findIndex(act => act && act.type === 'player');

            if (behav === 'follow') {
              const followDist = a.companionFollowDistance ?? 24;
              actorLogicCode += `            actor_${i}_dx = 0;\n`;
              actorLogicCode += `            actor_${i}_dy = 0;\n`;
              if (playerIdx !== -1) {
                actorLogicCode += `            if (actor_${playerIdx}_active) {\n`;
                actorLogicCode += `                bn::fixed speed_${i} = bn::fixed(${speedVal});\n`;
                actorLogicCode += `                bn::fixed cdx = actor_${playerIdx}_float_x - actor_${i}_float_x;\n`;
                actorLogicCode += `                bn::fixed cdy = actor_${playerIdx}_float_y - actor_${i}_float_y;\n`;
                actorLogicCode += `                bn::fixed dist = bn::sqrt((cdx * cdx) + (cdy * cdy));\n`;
                actorLogicCode += `                if (dist > bn::fixed(${followDist})) {\n`;
                actorLogicCode += `                    if (dist > 0) { actor_${i}_dx = (cdx / dist) * speed_${i}; actor_${i}_dy = (cdy / dist) * speed_${i}; }\n`;
                actorLogicCode += `                }\n`;
                actorLogicCode += `            }\n`;
              }
            } else if (behav === 'orbit') {
              const orbitRadius = a.companionOrbitRadius ?? 32;
              const orbitSpeed = a.companionOrbitSpeed ?? 2;
              actorLogicCode += `            actor_${i}_orbit_angle += bn::fixed(${orbitSpeed});\n`;
              actorLogicCode += `            if (actor_${i}_orbit_angle >= bn::fixed(360)) actor_${i}_orbit_angle -= bn::fixed(360);\n`;
              if (playerIdx !== -1) {
                actorLogicCode += `            if (actor_${playerIdx}_active) {\n`;
                actorLogicCode += `                bn::fixed target_x = actor_${playerIdx}_float_x + bn::degrees_lut_cos(actor_${i}_orbit_angle) * bn::fixed(${orbitRadius});\n`;
                actorLogicCode += `                bn::fixed target_y = actor_${playerIdx}_float_y + bn::degrees_lut_sin(actor_${i}_orbit_angle) * bn::fixed(${orbitRadius});\n`;
                actorLogicCode += `                actor_${i}_dx = (target_x - actor_${i}_float_x) * bn::fixed(0.15);\n`;
                actorLogicCode += `                actor_${i}_dy = (target_y - actor_${i}_float_y) * bn::fixed(0.15);\n`;
                actorLogicCode += `            }\n`;
              }
            } else if (behav === 'mimic') {
              const delay = a.companionMimicDelay ?? 15;
              const bufSize = delay + 1;
              if (playerIdx !== -1) {
                actorLogicCode += `            actor_${i}_mimic_buf_x[actor_${i}_mimic_write] = actor_${playerIdx}_float_x;\n`;
                actorLogicCode += `            actor_${i}_mimic_buf_y[actor_${i}_mimic_write] = actor_${playerIdx}_float_y;\n`;
                actorLogicCode += `            actor_${i}_mimic_write = (actor_${i}_mimic_write + 1) % ${bufSize};\n`;
                actorLogicCode += `            int read_idx = (actor_${i}_mimic_write + 1) % ${bufSize};\n`;
                actorLogicCode += `            bn::fixed target_x = actor_${i}_mimic_buf_x[read_idx];\n`;
                actorLogicCode += `            bn::fixed target_y = actor_${i}_mimic_buf_y[read_idx];\n`;
                actorLogicCode += `            actor_${i}_dx = (target_x - actor_${i}_float_x) * bn::fixed(0.25);\n`;
                actorLogicCode += `            actor_${i}_dy = (target_y - actor_${i}_float_y) * bn::fixed(0.25);\n`;
              }
            }

            actorLogicCode += `            actor_${i}_float_x += actor_${i}_dx;\n`;
            actorLogicCode += `            actor_${i}_float_y += actor_${i}_dy;\n`;
            actorLogicCode += `            actor_${i}_x = actor_${i}_float_x.integer();\n`;
            actorLogicCode += `            actor_${i}_y = actor_${i}_float_y.integer();\n`;

            if (a.companionFireProjectiles) {
              const fireRate = a.companionFireRate ?? 45;
              const projSpeed = a.companionProjSpeed ?? 3;
              const pName = a.companionProjectileSpriteId ? `proj_sprite_${String(a.companionProjectileSpriteId).replace(/[^a-zA-Z0-9_]/g, '_')}` : 'bullet_sprite';
              actorLogicCode += `            if (actor_${i}_shoot_timer > 0) { actor_${i}_shoot_timer--; }\n`;
              actorLogicCode += `            else {\n`;
              actorLogicCode += `                int nearest_enemy = -1;\n`;
              actorLogicCode += `                int nearest_dist_sq = 9999999;\n`;
              sActors.forEach((act, actIdx) => {
                if (act.type === 'enemy') {
                  actorLogicCode += `                if (actor_${actIdx}_active) {\n`;
                  actorLogicCode += `                    int edx = actor_${actIdx}_x - actor_${i}_x;\n`;
                  actorLogicCode += `                    int edy = actor_${actIdx}_y - actor_${i}_y;\n`;
                  actorLogicCode += `                    int dist_sq = edx*edx + edy*edy;\n`;
                  actorLogicCode += `                    if (dist_sq < nearest_dist_sq && dist_sq < 120*120) { nearest_dist_sq = dist_sq; nearest_enemy = ${actIdx}; }\n`;
                  actorLogicCode += `                }\n`;
                }
              });
              actorLogicCode += `                if (nearest_enemy >= 0) {\n`;
              actorLogicCode += `                    actor_${i}_shoot_timer = ${fireRate};\n`;
              actorLogicCode += `                    for(int p=0; p<20; ++p) {\n`;
              actorLogicCode += `                        if(!proj_active[p]) {\n`;
              actorLogicCode += `                            int ex = 0; int ey = 0;\n`;
              sActors.forEach((act, actIdx) => {
                if (act.type === 'enemy') {
                  actorLogicCode += `                            if (nearest_enemy == ${actIdx}) { ex = actor_${actIdx}_x + ${Math.floor((act.width || 16) / 2)}; ey = actor_${actIdx}_y + ${Math.floor((act.height || 16) / 2)}; }\n`;
                }
              });
              actorLogicCode += `                            bn::fixed tdx = ex - (actor_${i}_x + ${Math.floor((a.width || 16) / 2)});\n`;
              actorLogicCode += `                            bn::fixed tdy = ey - (actor_${i}_y + ${Math.floor((a.height || 16) / 2)});\n`;
              actorLogicCode += `                            bn::fixed td = bn::sqrt((tdx * tdx) + (tdy * tdy));\n`;
              actorLogicCode += `                            if (td > 0) { proj_dx[p] = (tdx / td) * bn::fixed(${projSpeed}); proj_dy[p] = (tdy / td) * bn::fixed(${projSpeed}); }\n`;
              actorLogicCode += `                            else { proj_dx[p] = bn::fixed(${projSpeed}); proj_dy[p] = 0; }\n`;
              actorLogicCode += `                            proj_x[p] = actor_${i}_x + ${Math.floor((a.width || 16) / 2)};\n`;
              actorLogicCode += `                            proj_y[p] = actor_${i}_y + ${Math.floor((a.height || 16) / 2)};\n`;
              actorLogicCode += `                            proj_active[p] = true;\n`;
              actorLogicCode += `                            proj_from_player[p] = true;\n`;
              actorLogicCode += `                            proj_bouncing[p] = false;\n`;
              actorLogicCode += `                            proj_bounce_count[p] = 0;\n`;
              actorLogicCode += `                            proj_sprites[p] = bn::sprite_items::${pName}.create_sprite(proj_x[p] - ${Math.floor(sDims.w / 2)}, proj_y[p] - ${Math.floor(sDims.h / 2)});\n`;
              actorLogicCode += `                            proj_sprites[p]->set_palette(shared_sprite_palette);\n`;
              actorLogicCode += `                            proj_sprites[p]->set_camera(camera);\n`;
              actorLogicCode += `                            proj_sprites[p]->set_bg_priority(1);\n`;
              actorLogicCode += `                            break;\n`;
              actorLogicCode += `                        }\n`;
              actorLogicCode += `                    }\n`;
              actorLogicCode += `                }\n`;
              actorLogicCode += `            }\n`;
            }

            if (scriptCode) actorLogicCode += scriptCode;
          } else if (a.type === 'pressure_plate') {
            const playerIdx = sActors.findIndex(act => act && act.type === 'player');
            const linkedId = a.pressurePlateLinkedId;
            const linkedIdx = linkedId ? sActors.findIndex(act => act && String(act.id) === String(linkedId)) : -1;
            const action = a.pressurePlateAction || 'activate';
            if (playerIdx !== -1 && linkedIdx !== -1) {
              actorLogicCode += `            {\n`;
              actorLogicCode += `                int px = actor_${playerIdx}_x + ${Math.floor((sActors[playerIdx].width || 16) / 2)};\n`;
              actorLogicCode += `                int py = actor_${playerIdx}_y + ${Math.floor((sActors[playerIdx].height || 16) / 2)};\n`;
              actorLogicCode += `                int cx = actor_${i}_x + ${Math.floor((a.width || 16) / 2)};\n`;
              actorLogicCode += `                int cy = actor_${i}_y + ${Math.floor((a.height || 16) / 2)};\n`;
              actorLogicCode += `                bool overlap = (px >= actor_${i}_x && px <= actor_${i}_x + ${a.width || 16} && py >= actor_${i}_y && py <= actor_${i}_y + ${a.height || 16});\n`;
              actorLogicCode += `                if (overlap && !actor_${i}_pressed) {\n`;
              actorLogicCode += `                    actor_${i}_pressed = true;\n`;
              if (action === 'activate') {
                actorLogicCode += `                    actor_${linkedIdx}_active = true;\n`;
                actorLogicCode += `                    actor_${linkedIdx}_sprite.set_visible(true);\n`;
              } else if (action === 'deactivate') {
                actorLogicCode += `                    actor_${linkedIdx}_active = false;\n`;
                actorLogicCode += `                    actor_${linkedIdx}_sprite.set_visible(false);\n`;
              } else {
                actorLogicCode += `                    actor_${linkedIdx}_active = !actor_${linkedIdx}_active;\n`;
                actorLogicCode += `                    actor_${linkedIdx}_sprite.set_visible(actor_${linkedIdx}_active);\n`;
              }
              actorLogicCode += `                } else if (!overlap && actor_${i}_pressed) {\n`;
              actorLogicCode += `                    actor_${i}_pressed = false;\n`;
              if (action === 'activate') {
                actorLogicCode += `                    actor_${linkedIdx}_active = false;\n`;
                actorLogicCode += `                    actor_${linkedIdx}_sprite.set_visible(false);\n`;
              } else if (action === 'deactivate') {
                actorLogicCode += `                    actor_${linkedIdx}_active = true;\n`;
                actorLogicCode += `                    actor_${linkedIdx}_sprite.set_visible(true);\n`;
              }
              actorLogicCode += `                }\n`;
              actorLogicCode += `            }\n`;
            }
            if (scriptCode) actorLogicCode += scriptCode;
          } else if (a.type === 'teleporter') {
            const playerIdx = sActors.findIndex(act => act && act.type === 'player');
            const linkedId = a.teleporterLinkedId;
            const linkedIdx = linkedId ? sActors.findIndex(act => act && String(act.id) === String(linkedId)) : -1;
            if (playerIdx !== -1 && linkedIdx !== -1) {
              actorLogicCode += `            if (actor_${i}_teleport_cooldown > 0) actor_${i}_teleport_cooldown--;\n`;
              actorLogicCode += `            else {\n`;
              actorLogicCode += `                int px = actor_${playerIdx}_x + ${Math.floor((sActors[playerIdx].width || 16) / 2)};\n`;
              actorLogicCode += `                int py = actor_${playerIdx}_y + ${Math.floor((sActors[playerIdx].height || 16) / 2)};\n`;
              actorLogicCode += `                bool overlap = (px >= actor_${i}_x && px <= actor_${i}_x + ${a.width || 16} && py >= actor_${i}_y && py <= actor_${i}_y + ${a.height || 16});\n`;
              actorLogicCode += `                if (overlap) {\n`;
              actorLogicCode += `                    actor_${playerIdx}_float_x = actor_${linkedIdx}_float_x;\n`;
              actorLogicCode += `                    actor_${playerIdx}_float_y = actor_${linkedIdx}_float_y;\n`;
              actorLogicCode += `                    actor_${i}_teleport_cooldown = 30;\n`;
              actorLogicCode += `                    actor_${linkedIdx}_teleport_cooldown = 30;\n`;
              actorLogicCode += `                }\n`;
              actorLogicCode += `            }\n`;
            }
            if (scriptCode) actorLogicCode += scriptCode;
          } else if (a.type === 'crumbling_platform') {
            const playerIdx = sActors.findIndex(act => act && act.type === 'player');
            const crumbleTime = a.crumbleTime ?? 30;
            const respawnTime = a.respawnTime ?? 120;
            if (playerIdx !== -1) {
              actorLogicCode += `            if (actor_${i}_respawning) {\n`;
              actorLogicCode += `                actor_${i}_respawn_timer--;\n`;
              actorLogicCode += `                if (actor_${i}_respawn_timer <= 0) {\n`;
              actorLogicCode += `                    actor_${i}_respawning = false;\n`;
              actorLogicCode += `                    actor_${i}_crumbling = false;\n`;
              actorLogicCode += `                    actor_${i}_crumble_timer = 0;\n`;
              actorLogicCode += `                    actor_${i}_active = true;\n`;
              actorLogicCode += `                    actor_${i}_sprite.set_visible(true);\n`;
              actorLogicCode += `                }\n`;
              actorLogicCode += `            } else {\n`;
              const pCW = sActors[playerIdx].collisionW ?? sActors[playerIdx].width ?? 16;
              const pCH = sActors[playerIdx].collisionH ?? sActors[playerIdx].height ?? 16;
              const pCX = sActors[playerIdx].collisionX ?? 0;
              const pCY = sActors[playerIdx].collisionY ?? 0;
              const platCW = a.collisionW ?? a.width ?? 16;
              const platCH = a.collisionH ?? a.height ?? 16;
              const platCX = a.collisionX ?? 0;
              const platCY = a.collisionY ?? 0;

              actorLogicCode += `                int px_l = actor_${playerIdx}_x + ${pCX};\n`;
              actorLogicCode += `                int px_r = px_l + ${pCW};\n`;
              actorLogicCode += `                int py_t = actor_${playerIdx}_y + ${pCY};\n`;
              actorLogicCode += `                int py_b = py_t + ${pCH};\n`;
              actorLogicCode += `                int plat_l = actor_${i}_x + ${platCX};\n`;
              actorLogicCode += `                int plat_r = plat_l + ${platCW};\n`;
              actorLogicCode += `                int plat_t = actor_${i}_y + ${platCY};\n`;
              actorLogicCode += `                int plat_b = plat_t + ${platCH};\n`;
              if (scene.type === 'PLATFORMER') {
                actorLogicCode += `                bool on_top = (px_r > plat_l && px_l < plat_r && py_b >= plat_t && py_b <= plat_t + 2);\n`;
              } else {
                actorLogicCode += `                bool on_top = (px_r > plat_l && px_l < plat_r && py_b > plat_t && py_t < plat_b);\n`;
              }
              actorLogicCode += `                if (on_top && !actor_${i}_crumbling) {\n`;
              actorLogicCode += `                    actor_${i}_crumbling = true;\n`;
              actorLogicCode += `                }\n`;
              actorLogicCode += `                if (actor_${i}_crumbling) {\n`;
              actorLogicCode += `                    actor_${i}_crumble_timer++;\n`;
              actorLogicCode += `                    if (actor_${i}_crumble_timer >= ${crumbleTime}) {\n`;
              actorLogicCode += `                        actor_${i}_active = false;\n`;
              actorLogicCode += `                        actor_${i}_sprite.set_visible(false);\n`;
              actorLogicCode += `                        actor_${i}_respawning = true;\n`;
              actorLogicCode += `                        actor_${i}_respawn_timer = ${respawnTime};\n`;
              actorLogicCode += `                    }\n`;
              actorLogicCode += `                }\n`;
              actorLogicCode += `            }\n`;
            }
            if (scriptCode) actorLogicCode += scriptCode;
          } else if (a.type === 'pass_wall') {
            const playerIdx = sActors.findIndex(act => act && act.type === 'player');
            if (playerIdx !== -1) {
              const pCW = sActors[playerIdx].collisionW ?? sActors[playerIdx].width ?? 16;
              const pCH = sActors[playerIdx].collisionH ?? sActors[playerIdx].height ?? 16;
              const pCX = sActors[playerIdx].collisionX ?? 0;
              const pCY = sActors[playerIdx].collisionY ?? 0;
              const wallCW = a.collisionW ?? a.width ?? 16;
              const wallCH = a.collisionH ?? a.height ?? 16;
              const wallCX = a.collisionX ?? 0;
              const wallCY = a.collisionY ?? 0;

              const passWallMode = a.passWallMode || 'passes';
              const solidFrames = passWallMode === 'frames' ? (a.solidAfterFrames || 60) : 0;
              const passWallStartOnTouch = a.passWallStartOnTouch || false;
              console.log(`[CODEGEN] pass_wall actor ${i}: mode=${passWallMode}, solidFrames=${solidFrames}, passCount=${a.passCount}, startOnTouch=${passWallStartOnTouch}`);
              actorLogicCode += `            if (actor_${i}_active) {\n`;
              actorLogicCode += `                int px_l = actor_${playerIdx}_x + ${pCX};\n`;
              actorLogicCode += `                int px_r = px_l + ${pCW};\n`;
              actorLogicCode += `                int py_t = actor_${playerIdx}_y + ${pCY};\n`;
              actorLogicCode += `                int py_b = py_t + ${pCH};\n`;
              actorLogicCode += `                int wall_l = actor_${i}_x + ${wallCX};\n`;
              actorLogicCode += `                int wall_r = wall_l + ${wallCW};\n`;
              actorLogicCode += `                int wall_t = actor_${i}_y + ${wallCY};\n`;
              actorLogicCode += `                int wall_b = wall_t + ${wallCH};\n`;
              actorLogicCode += `                bool overlap = (px_r > wall_l && px_l < wall_r && py_b > wall_t && py_t < wall_b);\n`;
              actorLogicCode += `                if (overlap) {\n`;
              actorLogicCode += `                    if (!actor_${i}_player_overlapping) {\n`;
              actorLogicCode += `                        actor_${i}_player_overlapping = true;\n`;
              if (solidFrames > 0 && passWallStartOnTouch) {
                actorLogicCode += `                        if (actor_${i}_solid_timer == -1) {\n`;
                actorLogicCode += `                            actor_${i}_solid_timer = ${solidFrames};\n`;
                actorLogicCode += `                        }\n`;
              }
              actorLogicCode += `                    }\n`;
              actorLogicCode += `                } else {\n`;
              actorLogicCode += `                    if (actor_${i}_player_overlapping) {\n`;
              actorLogicCode += `                        actor_${i}_player_overlapping = false;\n`;
              if (passWallMode === 'passes') {
                actorLogicCode += `                        if (actor_${i}_pass_count > 0) {\n`;
                actorLogicCode += `                            actor_${i}_pass_count--;\n`;
                actorLogicCode += `                            bn::sound_items::snd_square_440_100.play();\n`;
                actorLogicCode += `                        }\n`;
              }
              actorLogicCode += `                    }\n`;
              actorLogicCode += `                }\n`;
              if (solidFrames > 0) {
                actorLogicCode += `                if (actor_${i}_solid_timer > 0) {\n`;
                actorLogicCode += `                    actor_${i}_solid_timer--;\n`;
                actorLogicCode += `                    if (actor_${i}_solid_timer == 0) {\n`;
                actorLogicCode += `                        actor_${i}_pass_count = 0;\n`;
                actorLogicCode += `                        bn::sound_items::snd_square_440_100.play();\n`;
                actorLogicCode += `                    }\n`;
                actorLogicCode += `                }\n`;
              }
              actorLogicCode += `            }\n`;
            }
            if (scriptCode) actorLogicCode += scriptCode;
          } else if (a.type === 'chest') {
            const playerIdx = sActors.findIndex(act => act && act.type === 'player');
            if (playerIdx !== -1) {
              actorLogicCode += `            if (!actor_${i}_opened) {\n`;
              actorLogicCode += `                int px = actor_${playerIdx}_x + ${Math.floor((sActors[playerIdx].width || 16) / 2)};\n`;
              actorLogicCode += `                int py = actor_${playerIdx}_y + ${Math.floor((sActors[playerIdx].height || 16) / 2)};\n`;
              actorLogicCode += `                bool near = (px >= actor_${i}_x - 8 && px <= actor_${i}_x + ${a.width || 16} + 8 && py >= actor_${i}_y - 8 && py <= actor_${i}_y + ${a.height || 16} + 8);\n`;
              actorLogicCode += `                if (near && bn::keypad::a_pressed()) {\n`;
              actorLogicCode += `                    actor_${i}_opened = true;\n`;
              if (chestOpenScriptCompiled) actorLogicCode += chestOpenScriptCompiled;
              actorLogicCode += `                }\n`;
              actorLogicCode += `            }\n`;
            }
            if (scriptCode) actorLogicCode += scriptCode;
          } else if (a.type === 'torch') {
            const flickerSpeed = a.torchFlickerSpeed ?? 0.5;
            actorLogicCode += `            actor_${i}_flicker_timer += bn::fixed(${flickerSpeed});\n`;
            actorLogicCode += `            if (actor_${i}_flicker_timer > bn::fixed(6.28)) actor_${i}_flicker_timer -= bn::fixed(6.28);\n`;
            if (scriptCode) actorLogicCode += scriptCode;
          } else if (a.type === 'xp_orb') {
            const playerIdx = sActors.findIndex(act => act && act.type === 'player');
            const xpValue = a.xpValue ?? 1;
            const xpVar = a.xpVarName || 'PLAYER_XP';
            if (playerIdx !== -1) {
              const playerActor = sActors[playerIdx];
              let maxXpScriptCompiled = '';
              if (playerActor.playerMaxXpScriptId) {
                const maxXpScriptObj = customScripts.find(cs => cs && Number(cs.id) === Number(playerActor.playerMaxXpScriptId));
                if (maxXpScriptObj) {
                  maxXpScriptCompiled = generateScriptLogic(maxXpScriptObj.script, playerIdx, playerActor.width, playerActor.height, undefined, undefined, scCtx);
                }
              }
              actorLogicCode += `            {\n`;
              actorLogicCode += `                int px = actor_${playerIdx}_x + ${Math.floor((sActors[playerIdx].width || 16) / 2)};\n`;
              actorLogicCode += `                int py = actor_${playerIdx}_y + ${Math.floor((sActors[playerIdx].height || 16) / 2)};\n`;
              actorLogicCode += `                bool overlap = (px >= actor_${i}_x && px <= actor_${i}_x + ${a.width || 16} && py >= actor_${i}_y && py <= actor_${i}_y + ${a.height || 16});\n`;
              actorLogicCode += `                if (overlap) {\n`;
              actorLogicCode += `                    actor_${i}_active = false;\n`;
              actorLogicCode += `                    actor_${i}_sprite.set_visible(false);\n`;
              actorLogicCode += `                    ${xpVar} += ${xpValue};\n`;
              actorLogicCode += `                    if (${xpVar} >= PLAYER_MAX_XP) {\n`;
              actorLogicCode += `                        ${xpVar} = 0;\n`;
              if (maxXpScriptCompiled) {
                actorLogicCode += maxXpScriptCompiled;
              }
              actorLogicCode += `                    }\n`;
              actorLogicCode += `                }\n`;
              actorLogicCode += `            }\n`;
            }
            if (scriptCode) actorLogicCode += scriptCode;
          } else if (a.type === 'ammo_pickup') {
            const playerIdx = sActors.findIndex(act => act && act.type === 'player');
            if (playerIdx !== -1) {
              actorLogicCode += `            {\n`;
              actorLogicCode += `                int px = actor_${playerIdx}_x + ${Math.floor((sActors[playerIdx].width || 16) / 2)};\n`;
              actorLogicCode += `                int py = actor_${playerIdx}_y + ${Math.floor((sActors[playerIdx].height || 16) / 2)};\n`;
              actorLogicCode += `                bool overlap = (px >= actor_${i}_x && px <= actor_${i}_x + ${a.width || 16} && py >= actor_${i}_y && py <= actor_${i}_y + ${a.height || 16});\n`;
              actorLogicCode += `                if (overlap) {\n`;
              actorLogicCode += `                    actor_${i}_active = false;\n`;
              actorLogicCode += `                    actor_${i}_sprite.set_visible(false);\n`;
              actorLogicCode += `                    PLAYER_AMMO = PLAYER_MAX_AMMO;\n`;
              actorLogicCode += `                }\n`;
              actorLogicCode += `            }\n`;
            }
            if (scriptCode) actorLogicCode += scriptCode;
          } else if (a.type === 'health_pickup') {
            const playerIdx = sActors.findIndex(act => act && act.type === 'player');
            if (playerIdx !== -1) {
              actorLogicCode += `            {\n`;
              actorLogicCode += `                int px = actor_${playerIdx}_x + ${Math.floor((sActors[playerIdx].width || 16) / 2)};\n`;
              actorLogicCode += `                int py = actor_${playerIdx}_y + ${Math.floor((sActors[playerIdx].height || 16) / 2)};\n`;
              actorLogicCode += `                bool overlap = (px >= actor_${i}_x && px <= actor_${i}_x + ${a.width || 16} && py >= actor_${i}_y && py <= actor_${i}_y + ${a.height || 16});\n`;
              actorLogicCode += `                if (overlap) {\n`;
              actorLogicCode += `                    PLAYER_HP = PLAYER_MAX_HP;\n`;
              actorLogicCode += `                    actor_${playerIdx}_hp = actor_${playerIdx}_max_hp;\n`;
              actorLogicCode += `                    actor_${i}_active = false;\n`;
              actorLogicCode += `                    actor_${i}_sprite.set_visible(false);\n`;
              actorLogicCode += `                }\n`;
              actorLogicCode += `            }\n`;
            }
            if (scriptCode) actorLogicCode += scriptCode;
          } else if (a.type === 'grenade') {
            const playerIdx = sActors.findIndex(act => act && act.type === 'player');
            if (playerIdx !== -1) {
              actorLogicCode += `            {\n`;
              actorLogicCode += `                int px = actor_${playerIdx}_x + ${Math.floor((sActors[playerIdx].width || 16) / 2)};\n`;
              actorLogicCode += `                int py = actor_${playerIdx}_y + ${Math.floor((sActors[playerIdx].height || 16) / 2)};\n`;
              actorLogicCode += `                bool overlap = (px >= actor_${i}_x && px <= actor_${i}_x + ${a.width || 16} && py >= actor_${i}_y && py <= actor_${i}_y + ${a.height || 16});\n`;
              actorLogicCode += `                if (overlap) {\n`;
              actorLogicCode += `                    actor_${i}_active = false;\n`;
              actorLogicCode += `                    actor_${i}_sprite.set_visible(false);\n`;
              actorLogicCode += `                    PLAYER_GRENADES += actor_${i}_grenade_qty;\n`;
              actorLogicCode += `                    if (PLAYER_GRENADES > PLAYER_MAX_GRENADES) PLAYER_GRENADES = PLAYER_MAX_GRENADES;\n`;
              actorLogicCode += `                }\n`;
              actorLogicCode += `            }\n`;
            }
            if (scriptCode) actorLogicCode += scriptCode;
          } else if (a.type === 'boost_pad') {
            const playerIdx = sActors.findIndex(act => act && act.type === 'player');
            if (playerIdx !== -1) {
              actorLogicCode += `            {\n`;
              actorLogicCode += `                int px = actor_${playerIdx}_x + ${Math.floor((sActors[playerIdx].width || 16) / 2)};\n`;
              actorLogicCode += `                int py = actor_${playerIdx}_y + ${Math.floor((sActors[playerIdx].height || 16) / 2)};\n`;
              actorLogicCode += `                bool overlap = (px >= actor_${i}_x && px <= actor_${i}_x + ${a.width || 16} && py >= actor_${i}_y && py <= actor_${i}_y + ${a.height || 16});\n`;
              actorLogicCode += `                if (overlap) {\n`;
              actorLogicCode += `                    actor_${playerIdx}_speed_timer = ${a.boostDuration ?? 30};\n`;
              actorLogicCode += `                }\n`;
              actorLogicCode += `            }\n`;
            }
            if (scriptCode) actorLogicCode += scriptCode;
          } else if (a.type === 'checkpoint_gate') {
            const playerIdx = sActors.findIndex(act => act && act.type === 'player');
            if (playerIdx !== -1) {
              actorLogicCode += `            if (!actor_${i}_passed) {\n`;
              actorLogicCode += `                int px = actor_${playerIdx}_x + ${Math.floor((sActors[playerIdx].width || 16) / 2)};\n`;
              actorLogicCode += `                int py = actor_${playerIdx}_y + ${Math.floor((sActors[playerIdx].height || 16) / 2)};\n`;
              actorLogicCode += `                bool overlap = (px >= actor_${i}_x && px <= actor_${i}_x + ${a.width || 16} && py >= actor_${i}_y && py <= actor_${i}_y + ${a.height || 16});\n`;
              actorLogicCode += `                if (overlap) {\n`;
              actorLogicCode += `                    actor_${i}_passed = true;\n`;
              actorLogicCode += `                }\n`;
              actorLogicCode += `            }\n`;
            }
            if (scriptCode) actorLogicCode += scriptCode;
          } else if (a.type === 'magnet') {
            const playerIdx = sActors.findIndex(act => act && act.type === 'player');
            if (playerIdx !== -1) {
              actorLogicCode += `            {\n`;
              actorLogicCode += `                int px = actor_${playerIdx}_x + ${Math.floor((sActors[playerIdx].width || 16) / 2)};\n`;
              actorLogicCode += `                int py = actor_${playerIdx}_y + ${Math.floor((sActors[playerIdx].height || 16) / 2)};\n`;
              actorLogicCode += `                bool overlap = (px >= actor_${i}_x && px <= actor_${i}_x + ${a.width || 16} && py >= actor_${i}_y && py <= actor_${i}_y + ${a.height || 16});\n`;
              actorLogicCode += `                if (overlap) {\n`;
              actorLogicCode += `                    actor_${i}_active = false;\n`;
              actorLogicCode += `                    actor_${i}_sprite.set_visible(false);\n`;
              actorLogicCode += `                    PLAYER_MAGNET = actor_${i}_magnet_duration;\n`;
              actorLogicCode += `                }\n`;
              actorLogicCode += `            }\n`;
            }
            if (scriptCode) actorLogicCode += scriptCode;
          } else if (a.type === 'shield') {
            const playerIdx = sActors.findIndex(act => act && act.type === 'player');
            if (playerIdx !== -1) {
              actorLogicCode += `            {\n`;
              actorLogicCode += `                int px = actor_${playerIdx}_x + ${Math.floor((sActors[playerIdx].width || 16) / 2)};\n`;
              actorLogicCode += `                int py = actor_${playerIdx}_y + ${Math.floor((sActors[playerIdx].height || 16) / 2)};\n`;
              actorLogicCode += `                bool overlap = (px >= actor_${i}_x && px <= actor_${i}_x + ${a.width || 16} && py >= actor_${i}_y && py <= actor_${i}_y + ${a.height || 16});\n`;
              actorLogicCode += `                if (overlap) {\n`;
              actorLogicCode += `                    actor_${i}_active = false;\n`;
              actorLogicCode += `                    actor_${i}_sprite.set_visible(false);\n`;
              actorLogicCode += `                    actor_${playerIdx}_invincible_timer = actor_${i}_shield_duration;\n`;
              actorLogicCode += `                    if (actor_${i}_shield_visual) {\n`;
              actorLogicCode += `                        // TODO: Add visual effect for shield\n`;
              actorLogicCode += `                    }\n`;
              actorLogicCode += `                    bn::sound_items::snd_square_440_100.play();\n`;
              actorLogicCode += `                }\n`;
              actorLogicCode += `            }\n`;
            }
            if (scriptCode) actorLogicCode += scriptCode;
          } else if (a.type === 'push_target') {
            const pushableIndices = [];
            sActors.forEach((act, actIdx) => {
              if (act.type === 'pushable') pushableIndices.push(actIdx);
            });
            actorLogicCode += `            bool currently_filled = false;\n`;
            if (pushableIndices.length > 0) {
              actorLogicCode += `            int tx_l = actor_${i}_x + ${a.collisionX ?? 0};\n`;
              actorLogicCode += `            int tx_r = tx_l + ${a.collisionW ?? a.width ?? 16};\n`;
              actorLogicCode += `            int ty_t = actor_${i}_y + ${a.collisionY ?? 0};\n`;
              actorLogicCode += `            int ty_b = ty_t + ${a.collisionH ?? a.height ?? 16};\n`;
              pushableIndices.forEach(pIdx => {
                const pAct = sActors[pIdx];
                const pCW = pAct.collisionW ?? pAct.width ?? 16;
                const pCH = pAct.collisionH ?? pAct.height ?? 16;
                const pCX = pAct.collisionX ?? 0;
                const pCY = pAct.collisionY ?? 0;
                actorLogicCode += `            if (actor_${pIdx}_active) {\n`;
                actorLogicCode += `                int bx_l = actor_${pIdx}_x + ${pCX};\n`;
                actorLogicCode += `                int bx_r = bx_l + ${pCW};\n`;
                actorLogicCode += `                int by_t = actor_${pIdx}_y + ${pCY};\n`;
                actorLogicCode += `                int by_b = by_t + ${pCH};\n`;
                actorLogicCode += `                if (bx_r > tx_l && bx_l < tx_r && by_b > ty_t && by_t < ty_b) {\n`;
                actorLogicCode += `                    currently_filled = true;\n`;
                actorLogicCode += `                }\n`;
                actorLogicCode += `            }\n`;
              });
            }
            actorLogicCode += `            if (currently_filled && !actor_${i}_filled) {\n`;
            actorLogicCode += `                actor_${i}_filled = true;\n`;
            if (pushTargetScriptCompiled) actorLogicCode += pushTargetScriptCompiled;
            if (scriptCode) actorLogicCode += scriptCode;
            actorLogicCode += `            } else if (!currently_filled) {\n`;
            actorLogicCode += `                actor_${i}_filled = false;\n`;
            actorLogicCode += `            }\n`;
          } else if (a.type === 'save_point') {
            const playerIdx = sActors.findIndex(act => act && act.type === 'player');
            if (playerIdx !== -1) {
              const spCW = a.collisionW ?? a.width ?? 16;
              const spCH = a.collisionH ?? a.height ?? 16;
              const spCX = a.collisionX ?? 0;
              const spCY = a.collisionY ?? 0;
                         actorLogicCode += `            {\n`;
              actorLogicCode += `                int px_l = actor_${playerIdx}_x + ${sActors[playerIdx].collisionX ?? 0};\n`;
              actorLogicCode += `                int px_r = px_l + ${sActors[playerIdx].collisionW ?? sActors[playerIdx].width ?? 16};\n`;
              actorLogicCode += `                int py_t = actor_${playerIdx}_y + ${sActors[playerIdx].collisionY ?? 0};\n`;
              actorLogicCode += `                int py_b = py_t + ${sActors[playerIdx].collisionH ?? sActors[playerIdx].height ?? 16};\n`;
              actorLogicCode += `                int sp_l = actor_${i}_x + ${spCX};\n`;
              actorLogicCode += `                int sp_r = sp_l + ${spCW};\n`;
              actorLogicCode += `                int sp_t = actor_${i}_y + ${spCY};\n`;
              actorLogicCode += `                int sp_b = sp_t + ${spCH};\n`;
              actorLogicCode += `                bool overlap = (px_r > sp_l && px_l < sp_r && py_b > sp_t && py_t < sp_b);\n`;
              actorLogicCode += `                if (overlap) {\n`;
              actorLogicCode += `                    if (!actor_${i}_activated) {\n`;
              actorLogicCode += `                        actor_${i}_activated = true;\n`;
              actorLogicCode += `                        bool save_choice = true;\n`;
              actorLogicCode += `                        {\n`;
              actorLogicCode += `                            if (!scene_dialog_bg) {\n`;
              actorLogicCode += `                                scene_dialog_bg = bn::regular_bg_items::dialog_bg.create_bg(0, 0);\n`;
              actorLogicCode += `                                scene_dialog_bg->set_priority(0);\n`;
              actorLogicCode += `                            }\n`;
              actorLogicCode += `                            bn::vector<bn::sprite_ptr, 128> prompt_text_sprites;\n`;
              actorLogicCode += `                            show_dialog_text("Save the game?\\n> Yes\\n  No", prompt_text_sprites, dialog_text_palette);\n`;
              actorLogicCode += `                            while(bn::keypad::a_held()) { bn::core::update(); }\n`;
              actorLogicCode += `                            while(true) {\n`;
              actorLogicCode += `                                if(bn::keypad::up_pressed() || bn::keypad::down_pressed() || bn::keypad::left_pressed() || bn::keypad::right_pressed()) {\n`;
              actorLogicCode += `                                    save_choice = !save_choice;\n`;
              actorLogicCode += `                                    prompt_text_sprites.clear();\n`;
              actorLogicCode += `                                    if(save_choice) {\n`;
              actorLogicCode += `                                        show_dialog_text("Save the game?\\n> Yes\\n  No", prompt_text_sprites, dialog_text_palette);\n`;
              actorLogicCode += `                                    } else {\n`;
              actorLogicCode += `                                        show_dialog_text("Save the game?\\n  Yes\\n> No", prompt_text_sprites, dialog_text_palette);\n`;
              actorLogicCode += `                                    }\n`;
              actorLogicCode += `                                }\n`;
              actorLogicCode += `                                if(bn::keypad::a_pressed()) {\n`;
              actorLogicCode += `                                    break;\n`;
              actorLogicCode += `                                }\n`;
              actorLogicCode += `                                bn::core::update();\n`;
              actorLogicCode += `                            }\n`;
              actorLogicCode += `                            while(bn::keypad::a_held()) { bn::core::update(); }\n`;
              actorLogicCode += `                            scene_dialog_bg.reset();\n`;
              actorLogicCode += `                        }\n`;
              actorLogicCode += `                        if(save_choice) {\n`;
              actorLogicCode += `                            global_spawn_x = actor_${i}_x;\n`;
              actorLogicCode += `                            global_spawn_y = actor_${i}_y;\n`;
              actorLogicCode += `                            SaveData _save = {};\n`;
              actorLogicCode += `                            _save.player_x = actor_${playerIdx}_x;\n`;
              actorLogicCode += `                            _save.player_y = actor_${playerIdx}_y;\n`;
              actorLogicCode += `                            _save.player_scene = ${currentSceneIdx};\n`;
              
              const playerActor = sActors[playerIdx];
              const playerHpVarName = playerActor?.varPlayerHp || 'PLAYER_HP';
              const playerBonusVarName = playerActor?.varPlayerBonus || 'PLAYER_BONUS';
              const resolveVarNameLocal = (name) => {
                if (!name) return '';
                const nameUpper = String(name).toUpperCase();
                if (nameUpper === String(playerHpVarName).toUpperCase() || nameUpper === 'HP' || nameUpper === 'HEALTH') {
                  return `actor_${playerIdx}_hp`;
                }
                if (nameUpper === String(playerBonusVarName).toUpperCase() || nameUpper === 'BONUS' || nameUpper === 'COINS') {
                  return `actor_${playerIdx}_bonus`;
                }
                return String(name).replace(/[^a-zA-Z0-9_]/g, '_');
              };

              variables.forEach(v => {
                if (v.type === 'group') return;
                if (v.type !== 'random') {
                  const sv = String(v.name ?? '').replace(/[^a-zA-Z0-9_]/g, '_');
                  const resolvedSv = resolveVarNameLocal(v.name);
                  if (sv) actorLogicCode += `                            _save.${sv} = ${resolvedSv};\n`;
                }
              });
              
              actorLogicCode += `                            bn::sram::write(_save);\n`;
              
              if (a.savePointScriptId) {
                const saveScriptObj = customScripts.find(cs => cs && Number(cs.id) === Number(a.savePointScriptId));
                if (saveScriptObj) {
                  const saveScriptCompiled = generateScriptLogic(saveScriptObj.script, i, a.width, a.height, undefined, undefined, scCtx);
                  if (saveScriptCompiled) {
                    actorLogicCode += saveScriptCompiled;
                  }
                }
              }
              actorLogicCode += `                        }\n`;
              actorLogicCode += `                    }\n`;
              actorLogicCode += `                } else {\n`;
              actorLogicCode += `                    actor_${i}_activated = false;\n`;
              actorLogicCode += `                }\n`;
              actorLogicCode += `            }\n`;
            }
            if (scriptCode) actorLogicCode += scriptCode;
          } else if (a.type === 'wall_jump_surface' || a.type === 'one_way_wall' || a.type === 'ice_block' || a.type === 'gravity_flip_zone') {
            if (scriptCode) actorLogicCode += scriptCode;
          } else { // npc
            const speedVal = a.moveSpeed ?? 1;
          const amountVal = a.moveAmount ?? 32;
          const dirVal = a.moveDir || 'horizontal';
            const npcBehavior = a.npcBehavior || 'wander';

            if (npcBehavior === 'follow') {
              const playerIdx = sActors.findIndex(act => act && act.type === 'player');
              actorLogicCode += `            actor_${i}_dx = 0;\n`;
              actorLogicCode += `            actor_${i}_dy = 0;\n`;
              if (playerIdx !== -1) {
                actorLogicCode += `            if (actor_${playerIdx}_active) {\n`;
                actorLogicCode += `                bn::fixed speed_${i} = bn::fixed(${speedVal});\n`;

                const proximityVal = parseInt(a.followProximity) || 0;
                if (proximityVal > 0) {
                  actorLogicCode += `                int diff_x = actor_${playerIdx}_x - actor_${i}_x;\n`;
                  actorLogicCode += `                int diff_y = actor_${playerIdx}_y - actor_${i}_y;\n`;
                  actorLogicCode += `                if ((diff_x * diff_x) + (diff_y * diff_y) <= ${proximityVal * proximityVal}) {\n`;
                  // Follow
                  actorLogicCode += `                    if (actor_${playerIdx}_float_x > actor_${i}_float_x + 1) actor_${i}_dx = speed_${i};\n`;
                  actorLogicCode += `                    else if (actor_${playerIdx}_float_x < actor_${i}_float_x - 1) actor_${i}_dx = -speed_${i};\n`;
                  if (scene.type === 'TOPDOWN') {
                    actorLogicCode += `                    if (actor_${playerIdx}_float_y > actor_${i}_float_y + 1) actor_${i}_dy = speed_${i};\n`;
                    actorLogicCode += `                    else if (actor_${playerIdx}_float_y < actor_${i}_float_y - 1) actor_${i}_dy = -speed_${i};\n`;
                  }
                  actorLogicCode += `                } else {\n`;
                  // Wander
                  actorLogicCode += `                    if (actor_${i}_timer > 0) { actor_${i}_timer--; }\n`;
                  actorLogicCode += `                    else {\n`;
                  actorLogicCode += `                        actor_${i}_timer = (rng.get_int(60) + 30);\n`;
                  if (scene.type === 'PLATFORMER') {
                    actorLogicCode += `                        int r = rng.get_int(3);\n`;
                    actorLogicCode += `                        if (r == 0) { actor_${i}_dx = speed_${i}; }\n`;
                    actorLogicCode += `                        else if (r == 1) { actor_${i}_dx = -speed_${i}; }\n`;
                    actorLogicCode += `                        else { actor_${i}_dx = 0; }\n`;
                  } else {
                    actorLogicCode += `                        int r = rng.get_int(5);\n`;
                    actorLogicCode += `                        if (r == 0) { actor_${i}_dx = speed_${i}; actor_${i}_dy = 0; }\n`;
                    actorLogicCode += `                        else if (r == 1) { actor_${i}_dx = -speed_${i}; actor_${i}_dy = 0; }\n`;
                    actorLogicCode += `                        else if (r == 2) { actor_${i}_dx = 0; actor_${i}_dy = speed_${i}; }\n`;
                    actorLogicCode += `                        else if (r == 3) { actor_${i}_dx = 0; actor_${i}_dy = -speed_${i}; }\n`;
                    actorLogicCode += `                        else { actor_${i}_dx = 0; actor_${i}_dy = 0; }\n`;
                  }
                  actorLogicCode += `                    }\n`;
                  actorLogicCode += `                }\n`;
                } else {
                  // Follow unconditionally
                  actorLogicCode += `                if (actor_${playerIdx}_float_x > actor_${i}_float_x + 1) actor_${i}_dx = speed_${i};\n`;
                  actorLogicCode += `                else if (actor_${playerIdx}_float_x < actor_${i}_float_x - 1) actor_${i}_dx = -speed_${i};\n`;
                  if (scene.type === 'TOPDOWN') {
                    actorLogicCode += `                if (actor_${playerIdx}_float_y > actor_${i}_float_y + 1) actor_${i}_dy = speed_${i};\n`;
                    actorLogicCode += `                else if (actor_${playerIdx}_float_y < actor_${i}_float_y - 1) actor_${i}_dy = -speed_${i};\n`;
                  }
                }
                actorLogicCode += `            }\n`;
              }
            } else if (npcBehavior === 'idle') {
              actorLogicCode += `            actor_${i}_dx = 0;\n`;
              actorLogicCode += `            actor_${i}_dy = 0;\n`;
          } else if (npcBehavior === 'sine') {
            actorLogicCode += `            bn::fixed speed_${i} = bn::fixed(${speedVal});\n`;
            actorLogicCode += `            actor_${i}_timer++;\n`;
            if (dirVal === 'vertical' || dirVal === 'bounce') {
              actorLogicCode += `            actor_${i}_dx = bn::degrees_lut_sin(bn::fixed((actor_${i}_timer * 4) % 360)) * bn::fixed(${amountVal} / 16.0);\n`;
              actorLogicCode += `            if (actor_${i}_dir == 1 && actor_${i}_float_y >= actor_${i}_start_y + bn::fixed(${amountVal})) {\n`;
              actorLogicCode += `                actor_${i}_float_y = actor_${i}_start_y + bn::fixed(${amountVal});\n`;
              actorLogicCode += `                actor_${i}_dir = -1;\n`;
              actorLogicCode += `            } else if (actor_${i}_dir == -1 && actor_${i}_float_y <= actor_${i}_start_y) {\n`;
              actorLogicCode += `                actor_${i}_float_y = actor_${i}_start_y;\n`;
              actorLogicCode += `                actor_${i}_dir = 1;\n`;
              actorLogicCode += `            }\n`;
              actorLogicCode += `            actor_${i}_dy = speed_${i} * actor_${i}_dir;\n`;
            } else {
              actorLogicCode += `            actor_${i}_dy = bn::degrees_lut_sin(bn::fixed((actor_${i}_timer * 4) % 360)) * bn::fixed(${amountVal} / 16.0);\n`;
              actorLogicCode += `            if (actor_${i}_dir == 1 && actor_${i}_float_x >= actor_${i}_start_x + bn::fixed(${amountVal})) {\n`;
              actorLogicCode += `                actor_${i}_float_x = actor_${i}_start_x + bn::fixed(${amountVal});\n`;
              actorLogicCode += `                actor_${i}_dir = -1;\n`;
              actorLogicCode += `            } else if (actor_${i}_dir == -1 && actor_${i}_float_x <= actor_${i}_start_x) {\n`;
              actorLogicCode += `                actor_${i}_float_x = actor_${i}_start_x;\n`;
              actorLogicCode += `                actor_${i}_dir = 1;\n`;
              actorLogicCode += `            }\n`;
              actorLogicCode += `            actor_${i}_dx = speed_${i} * actor_${i}_dir;\n`;
            }
          } else if (npcBehavior === 'zigzag') {
            actorLogicCode += `            bn::fixed speed_${i} = bn::fixed(${speedVal});\n`;
            actorLogicCode += `            actor_${i}_timer++;\n`;
            actorLogicCode += `            if (actor_${i}_timer >= 60) actor_${i}_timer = 0;\n`;
            if (dirVal === 'vertical' || dirVal === 'bounce') {
              actorLogicCode += `            actor_${i}_dx = (actor_${i}_timer < 30) ? speed_${i} : -speed_${i};\n`;
              actorLogicCode += `            if (actor_${i}_dir == 1 && actor_${i}_float_y >= actor_${i}_start_y + bn::fixed(${amountVal})) {\n`;
              actorLogicCode += `                actor_${i}_float_y = actor_${i}_start_y + bn::fixed(${amountVal});\n`;
              actorLogicCode += `                actor_${i}_dir = -1;\n`;
              actorLogicCode += `            } else if (actor_${i}_dir == -1 && actor_${i}_float_y <= actor_${i}_start_y) {\n`;
              actorLogicCode += `                actor_${i}_float_y = actor_${i}_start_y;\n`;
              actorLogicCode += `                actor_${i}_dir = 1;\n`;
              actorLogicCode += `            }\n`;
              actorLogicCode += `            actor_${i}_dy = speed_${i} * actor_${i}_dir;\n`;
            } else {
              actorLogicCode += `            actor_${i}_dy = (actor_${i}_timer < 30) ? speed_${i} : -speed_${i};\n`;
              actorLogicCode += `            if (actor_${i}_dir == 1 && actor_${i}_float_x >= actor_${i}_start_x + bn::fixed(${amountVal})) {\n`;
              actorLogicCode += `                actor_${i}_float_x = actor_${i}_start_x + bn::fixed(${amountVal});\n`;
              actorLogicCode += `                actor_${i}_dir = -1;\n`;
              actorLogicCode += `            } else if (actor_${i}_dir == -1 && actor_${i}_float_x <= actor_${i}_start_x) {\n`;
              actorLogicCode += `                actor_${i}_float_x = actor_${i}_start_x;\n`;
              actorLogicCode += `                actor_${i}_dir = 1;\n`;
              actorLogicCode += `            }\n`;
              actorLogicCode += `            actor_${i}_dx = speed_${i} * actor_${i}_dir;\n`;
            }
          } else { // wander or random
              actorLogicCode += `            bn::fixed speed_${i} = bn::fixed(${speedVal});\n`;
              actorLogicCode += `            if (actor_${i}_timer > 0) { actor_${i}_timer--; }\n`;
              actorLogicCode += `            else {\n`;
              actorLogicCode += `                actor_${i}_timer = (rng.get_int(60) + 30);\n`;
              if (scene.type === 'PLATFORMER') {
                actorLogicCode += `                int r = rng.get_int(3);\n`;
                actorLogicCode += `                if (r == 0) { actor_${i}_dx = speed_${i}; actor_${i}_dy = 0; }\n`;
                actorLogicCode += `                else if (r == 1) { actor_${i}_dx = -speed_${i}; actor_${i}_dy = 0; }\n`;
                actorLogicCode += `                else { actor_${i}_dx = 0; actor_${i}_dy = 0; }\n`;
              } else {
                actorLogicCode += `                int r = rng.get_int(5);\n`;
                actorLogicCode += `                if (r == 0) { actor_${i}_dx = speed_${i}; actor_${i}_dy = 0; }\n`;
                actorLogicCode += `                else if (r == 1) { actor_${i}_dx = -speed_${i}; actor_${i}_dy = 0; }\n`;
                actorLogicCode += `                else if (r == 2) { actor_${i}_dx = 0; actor_${i}_dy = speed_${i}; }\n`;
                actorLogicCode += `                else if (r == 3) { actor_${i}_dx = 0; actor_${i}_dy = -speed_${i}; }\n`;
                actorLogicCode += `                else { actor_${i}_dx = 0; actor_${i}_dy = 0; }\n`;
              }
              actorLogicCode += `            }\n`;
            }

          // 2. Apply gravity in Platformer mode
          const isFlyingMovement = (['sine', 'zigzag'].includes(npcBehavior) && dirVal === 'vertical' || dirVal === 'bounce') || (npcBehavior === 'follow' && (parseInt(a.followProximity) || 0) > 0 && dirVal === 'vertical' || dirVal === 'bounce');
          if (scene.type === 'PLATFORMER' && !isFlyingMovement) {
              actorLogicCode += `            actor_${i}_dy += bn::fixed(${scene.gravity ?? 0.5});\n`;
              actorLogicCode += `            if (actor_${i}_dy > bn::fixed(${scene.maxFallVelocity ?? 8.0})) actor_${i}_dy = bn::fixed(${scene.maxFallVelocity ?? 8.0});\n`;

               // Ground detection â€” also snap float_y to tile top
              actorLogicCode += `            [[maybe_unused]] bool actor_${i}_on_ground = false;\n`;
              actorLogicCode += `            if (check_solid_collision(actor_${i}_float_x, actor_${i}_float_y + 1, ${a.collisionX ?? 0}, ${a.collisionY ?? 0}, ${a.collisionW ?? a.width ?? 16}, ${a.collisionH ?? a.height ?? 16})) {\n`;
              actorLogicCode += `                actor_${i}_on_ground = true;\n`;
              actorLogicCode += `                if (actor_${i}_dy > 0) {\n`;
              actorLogicCode += `                    int ck_ty = (actor_${i}_float_y + 1 + ${a.collisionY ?? 0} + ${a.collisionH ?? a.height ?? 16} - bn::fixed::from_data(1)).integer() / 8;\n`;
              actorLogicCode += `                    actor_${i}_float_y = (ck_ty * 8) - ${a.collisionY ?? 0} - ${a.collisionH ?? a.height ?? 16};\n`;
              actorLogicCode += `                    actor_${i}_dy = 0;\n`;
              actorLogicCode += `                }\n`;
              actorLogicCode += `            }\n`;

              // Platform checks
              for (let j = 0; j < sActors.length; j++) {
                if (i === j) continue;
                const platform = sActors[j];
                if (platform.type === 'platform' || platform.type === 'staticPlatform' || platform.type === 'movingPlatform' || platform.type === 'destructible' || platform.type === 'door' || platform.type === 'pushable' || platform.type === 'conveyor' || platform.type === 'ice_block' || platform.type === 'crumbling_platform' || platform.type === 'pass_wall' || (platform.type === 'one_way_wall' && platform.oneWayDirection === 'down')) {
                  const pCW = platform.collisionW ?? platform.width ?? 16;
                  const pCH = platform.collisionH ?? platform.height ?? 16;
                  const pCX = platform.collisionX ?? 0;
                  const pCY = platform.collisionY ?? 0;
                  const activeCond = platform.type === 'pass_wall' ? `actor_${j}_active && actor_${j}_pass_count == 0` : `actor_${j}_active`;
                  actorLogicCode += `            if (${activeCond} && actor_${i}_dy >= 0) {\n`;
                  actorLogicCode += `                int px = actor_${i}_float_x.integer() + ${a.collisionX ?? 0} + ${Math.floor((a.collisionW ?? a.width ?? 16) / 2)};\n`;
                  actorLogicCode += `                int py = actor_${i}_float_y.integer() + ${a.collisionY ?? 0} + ${a.collisionH ?? a.height ?? 16};\n`;
                  actorLogicCode += `                int plat_l = actor_${j}_x + ${pCX};\n`;
                  actorLogicCode += `                int plat_r = actor_${j}_x + ${pCX} + ${pCW};\n`;
                  actorLogicCode += `                int plat_t = actor_${j}_y + ${pCY};\n`;

                  actorLogicCode += `                if (px >= plat_l && px <= plat_r && py >= plat_t && py < plat_t + 8) {\n`;
                  actorLogicCode += `                    actor_${i}_on_ground = true;\n`;
                  actorLogicCode += `                    actor_${i}_float_y = plat_t - (${a.collisionY ?? 0} + ${a.collisionH ?? a.height ?? 16});\n`;
                  actorLogicCode += `                    if (actor_${i}_dy > 0) actor_${i}_dy = 0;\n`;
                  const isMovingPlat = platform.isMoving ?? (platform.type === 'movingPlatform' || platform.type === 'pushable');
                  if (isMovingPlat) {
                    actorLogicCode += `                    actor_${i}_float_x += actor_${j}_dx;\n`;
                    actorLogicCode += `                    actor_${i}_float_y += actor_${j}_dy;\n`;
                  }
                    actorLogicCode += `                }\n`;
                    actorLogicCode += `            }\n`;
                }
              }
            }

            // 3. Move and check Solid tile collision
            const aCW2 = a.collisionW ?? a.width ?? 16;
            const aCH2 = a.collisionH ?? a.height ?? 16;
            const aCX2 = a.collisionX ?? 0;
            const aCY2 = a.collisionY ?? 0;
            actorLogicCode += `            if (actor_${i}_dx != 0 || actor_${i}_dy != 0) {\n`;
            actorLogicCode += `                if (actor_${i}_dx != 0) {\n`;
            actorLogicCode += `                    bn::fixed new_x = actor_${i}_float_x + actor_${i}_dx;\n`;
            actorLogicCode += `                    if (!check_solid_collision(new_x, actor_${i}_float_y, ${aCX2}, ${aCY2}, ${aCW2}, ${aCH2})) {\n`;
            actorLogicCode += `                        actor_${i}_float_x = new_x;\n`;
            actorLogicCode += `                    } else {\n`;
            actorLogicCode += `                        actor_${i}_timer = 0;\n`;
            actorLogicCode += `                        actor_${i}_dx = 0;\n`;
            actorLogicCode += `                    }\n`;
            actorLogicCode += `                }\n`;
            actorLogicCode += `                if (actor_${i}_dy != 0) {\n`;
            actorLogicCode += `                    bn::fixed new_y = actor_${i}_float_y + actor_${i}_dy;\n`;
            actorLogicCode += `                    if (!check_solid_collision(actor_${i}_float_x, new_y, ${aCX2}, ${aCY2}, ${aCW2}, ${aCH2})) {\n`;
            actorLogicCode += `                        actor_${i}_float_y = new_y;\n`;
            actorLogicCode += `                    } else {\n`;
            actorLogicCode += `                        if (actor_${i}_dy > 0) {\n`;
            actorLogicCode += `                            int ty = (new_y + ${aCY2} + ${aCH2} - bn::fixed::from_data(1)).integer() / 8;\n`;
            actorLogicCode += `                            actor_${i}_float_y = (ty * 8) - ${aCY2} - ${aCH2};\n`;
            if (scene.type === 'PLATFORMER') {
              actorLogicCode += `                            actor_${i}_on_ground = true;\n`;
            }
            actorLogicCode += `                        } else if (actor_${i}_dy < 0) {\n`;
            actorLogicCode += `                            int top_y = new_y.integer() + ${aCY2};\n`;
            actorLogicCode += `                            int ty = top_y / 8;\n`;
            actorLogicCode += `                            actor_${i}_float_y = ((ty + 1) * 8) - ${aCY2};\n`;
            actorLogicCode += `                        }\n`;
            actorLogicCode += `                        actor_${i}_dy = 0;\n`;
            actorLogicCode += `                    }\n`;
            actorLogicCode += `                }\n`;
            actorLogicCode += `            }\n`;
            actorLogicCode += `            actor_${i}_x = actor_${i}_float_x.integer();\n`;
            actorLogicCode += `            actor_${i}_y = actor_${i}_float_y.integer();\n`;
            if (scriptCode) actorLogicCode += scriptCode;
          }

          if (scene.type === 'POINTNCLICK' && a.type === 'player') {
            postTriggerCode += `            if (is_hovering) {\n`;
            postTriggerCode += `                actor_${i}_sprite.set_tiles(actor_${i}_tiles_cache[1]);\n`;
            postTriggerCode += `            } else {\n`;
            postTriggerCode += `                actor_${i}_sprite.set_tiles(actor_${i}_tiles_cache[0]);\n`;
            postTriggerCode += `            }\n`;
          } else {
            actorLogicCode += `            if (actor_${i}_anim_lock > 0) {\n`;
            actorLogicCode += `                actor_${i}_anim_lock--;\n`;
            actorLogicCode += `                if (actor_${i}_anim_lock == 0) {\n`;
            actorLogicCode += `                    actor_${i}_anim_state = 0;\n`;
            actorLogicCode += `                    actor_${i}_anim_idx = 0;\n`;
            actorLogicCode += `                    actor_${i}_anim_timer = 0;\n`;
                if (a.type === 'player' && a.playerAnimFireProjectile) {
                  actorLogicCode += `                    actor_${i}_anim_fired = false;\n`;
                }
            actorLogicCode += `                }\n`;
            actorLogicCode += `            } else {\n`;
            if (a.type === 'pass_wall') {
              const getAnimState = (val) => {
                if (val === 'idle') return 0;
                if (val === 'walk') return 1;
                if (val === 'jump') return 2;
                const found = customAnimData.find(c => String(c.animId) === String(val));
                return found ? found.stateId : 0;
              };
              const passState = getAnimState(a.passWallPassAnim || 'idle');
              const solidState = getAnimState(a.passWallSolidAnim || 'idle');
              actorLogicCode += `                int next_state_${i} = (actor_${i}_pass_count > 0) ? ${passState} : ${solidState};\n`;
            } else {
              actorLogicCode += `                int next_state_${i} = 0;\n`;
            }
            if (jumpAnim && walkAnim) {
              actorLogicCode += `                if (actor_${i}_dy != 0) {\n`;
              actorLogicCode += `                    next_state_${i} = 2;\n`;
              actorLogicCode += `                } else if (actor_${i}_dx != 0 || actor_${i}_dy != 0) {\n`;
              actorLogicCode += `                    next_state_${i} = 1;\n`;
              actorLogicCode += `                }\n`;
            } else if (jumpAnim) {
              actorLogicCode += `                if (actor_${i}_dy != 0) {\n`;
              actorLogicCode += `                    next_state_${i} = 2;\n`;
              actorLogicCode += `                }\n`;
            } else if (walkAnim) {
              actorLogicCode += `                if (actor_${i}_dx != 0 || actor_${i}_dy != 0) {\n`;
              actorLogicCode += `                    next_state_${i} = 1;\n`;
              actorLogicCode += `                }\n`;
            }
            actorLogicCode += `                if (next_state_${i} != actor_${i}_anim_state) {\n`;
            actorLogicCode += `                    actor_${i}_anim_state = next_state_${i};\n`;
            actorLogicCode += `                    actor_${i}_anim_idx = 0;\n`;
            actorLogicCode += `                    actor_${i}_anim_timer = 0;\n`;
            actorLogicCode += `                    int state_frame_${i} = 0;\n`;
            actorLogicCode += `                    if (actor_${i}_anim_state == 0 && ${idleIndices.length} > 0) state_frame_${i} = actor_${i}_idle_frames[0];\n`;
            actorLogicCode += `                    else if (actor_${i}_anim_state == 1 && ${walkIndices.length} > 0) state_frame_${i} = actor_${i}_walk_frames[0];\n`;
            if (jumpIndices.length > 0) {
              actorLogicCode += `                    else if (actor_${i}_anim_state == 2) state_frame_${i} = actor_${i}_jump_frames[0];\n`;
            }
            customAnimData.forEach(cad => {
              actorLogicCode += `                    else if (actor_${i}_anim_state == ${cad.stateId} && ${cad.indices.length} > 0) state_frame_${i} = actor_${i}_custom_${cad.stateId}_frames[0];\n`;
            });
            actorLogicCode += `                    actor_${i}_sprite.set_tiles(actor_${i}_tiles_cache[state_frame_${i}]);\n`;
            actorLogicCode += `                }\n`;
            actorLogicCode += `            }\n`;

            if (a.type === 'player' && a.playerAnimOnButton && a.playerAnimId) {
              const targetCustomAnim = customAnimData.find(cad => String(cad.animId) === String(a.playerAnimId));
              if (targetCustomAnim) {
                const lockFrames = targetCustomAnim.indices.length * Math.floor(60 / (targetCustomAnim.fps > 0 ? targetCustomAnim.fps : 8));
                actorLogicCode += `            if (bn::keypad::${a.playerAnimButton || 'b'}_pressed() && actor_${i}_anim_lock == 0) {\n`;
                actorLogicCode += `                actor_${i}_anim_state = ${targetCustomAnim.stateId};\n`;
                actorLogicCode += `                actor_${i}_anim_idx = 0;\n`;
                actorLogicCode += `                actor_${i}_anim_timer = 0;\n`;
                actorLogicCode += `                actor_${i}_anim_lock = ${lockFrames};\n`;
                actorLogicCode += `            }\n`;
              }
            }

            actorLogicCode += `            actor_${i}_anim_timer++;\n`;
            actorLogicCode += `            int fps_${i} = 8;\n`;
            actorLogicCode += `            int max_frames_${i} = 1;\n`;
            actorLogicCode += `            if (actor_${i}_anim_state == 0) { fps_${i} = ${idleAnim ? idleAnim.fps : 8}; max_frames_${i} = ${idleIndices.length}; }\n`;
            actorLogicCode += `            else if (actor_${i}_anim_state == 1) { fps_${i} = ${walkAnim ? walkAnim.fps : 8}; max_frames_${i} = ${walkIndices.length}; }\n`;
            if (jumpIndices.length > 0) {
              actorLogicCode += `            else if (actor_${i}_anim_state == 2) { fps_${i} = ${jumpAnim ? jumpAnim.fps : 8}; max_frames_${i} = ${jumpIndices.length}; }\n`;
            }
            customAnimData.forEach(cad => {
              actorLogicCode += `            else if (actor_${i}_anim_state == ${cad.stateId}) { fps_${i} = ${cad.fps}; max_frames_${i} = ${cad.indices.length}; }\n`;
            });
            actorLogicCode += `            int frames_per_update_${i} = 60 / (fps_${i} > 0 ? fps_${i} : 8);\n`;
            actorLogicCode += `            if (actor_${i}_anim_timer >= frames_per_update_${i}) {\n`;
            actorLogicCode += `                actor_${i}_anim_timer = 0;\n`;
            actorLogicCode += `                actor_${i}_anim_idx++;\n`;
            actorLogicCode += `                if (actor_${i}_anim_idx >= max_frames_${i}) actor_${i}_anim_idx = 0;\n`;
            actorLogicCode += `                int frame_to_show_${i} = 0;\n`;
            actorLogicCode += `                if (actor_${i}_anim_state == 0) frame_to_show_${i} = actor_${i}_idle_frames[actor_${i}_anim_idx];\n`;
            actorLogicCode += `                else if (actor_${i}_anim_state == 1) frame_to_show_${i} = actor_${i}_walk_frames[actor_${i}_anim_idx];\n`;
            if (jumpIndices.length > 0) {
              actorLogicCode += `                else if (actor_${i}_anim_state == 2) frame_to_show_${i} = actor_${i}_jump_frames[actor_${i}_anim_idx];\n`;
            }
            customAnimData.forEach(cad => {
              actorLogicCode += `                else if (actor_${i}_anim_state == ${cad.stateId}) frame_to_show_${i} = actor_${i}_custom_${cad.stateId}_frames[actor_${i}_anim_idx];\n`;
            });
            actorLogicCode += `                if (max_frames_${i} > 1 || (actor_${i}_anim_state == 1 && ${walkIndices.length} > 0) || (actor_${i}_anim_state == 0 && ${idleIndices.length} > 0) || actor_${i}_anim_state >= 2) actor_${i}_sprite.set_tiles(actor_${i}_tiles_cache[frame_to_show_${i}]);\n`;
            actorLogicCode += `            }\n`;

            if (a.type === 'player' && a.playerAnimOnButton && a.playerAnimId && a.playerAnimFireProjectile) {
              const targetCustomAnim = customAnimData.find(cad => String(cad.animId) === String(a.playerAnimId));
              if (targetCustomAnim) {
                const fireFrame = Math.max(0, (a.playerAnimFireFrame ?? 1) - 1);
                actorLogicCode += `            if (actor_${i}_anim_state == ${targetCustomAnim.stateId} && actor_${i}_anim_idx == ${fireFrame}) {\n`;
                actorLogicCode += `                if (!actor_${i}_anim_fired) {\n`;
                actorLogicCode += `                    actor_${i}_fire_proj();\n`;
                actorLogicCode += `                    actor_${i}_anim_fired = true;\n`;
                actorLogicCode += `                }\n`;
                actorLogicCode += `            }\n`;
              }
            }
          }

          if (a.type === 'player' && (scene.type === 'RACING' || scene.type === 'SHMUP') && scene.mode7) {
            actorLogicCode += `            actor_${i}_sprite.set_x(0);\n`;
            actorLogicCode += `            actor_${i}_sprite.set_y(${scene.type === 'SHMUP' ? 40 : 50});\n`;
          } else {
            actorLogicCode += `            actor_${i}_x = actor_${i}_float_x.integer();\n`;
            actorLogicCode += `            actor_${i}_y = actor_${i}_float_y.integer();\n`;
            actorLogicCode += `            actor_${i}_sprite.set_x(actor_${i}_x - ${Math.floor(sDims.w / 2)} + ${Math.floor(a.width / 2)});\n`;
            actorLogicCode += `            actor_${i}_sprite.set_y(actor_${i}_y - ${Math.floor(sDims.h / 2)} + ${Math.floor(a.height / 2)});\n`;
          }
          if (a.hflip !== false && (a.type === 'player' || a.type === 'npc' || a.type === 'enemy' || a.type === 'companion')) {
            actorLogicCode += `            if (actor_${i}_dx < 0) actor_${i}_sprite.set_horizontal_flip(true);\n`;
            actorLogicCode += `            else if (actor_${i}_dx > 0) actor_${i}_sprite.set_horizontal_flip(false);\n`;
          }
          if (a.vflip && (a.type === 'player' || a.type === 'npc' || a.type === 'enemy' || a.type === 'companion')) {
            actorLogicCode += `            if (actor_${i}_dy < 0) actor_${i}_sprite.set_vertical_flip(true);\n`;
            actorLogicCode += `            else if (actor_${i}_dy > 0) actor_${i}_sprite.set_vertical_flip(false);\n`;
          }
          actorLogicCode += `            if (actor_${i}_dx < 0) { actor_${i}_last_dx_dir = -1; if (actor_${i}_dy == 0) actor_${i}_last_dy_dir = 0; }\n`;
          actorLogicCode += `            else if (actor_${i}_dx > 0) { actor_${i}_last_dx_dir = 1; if (actor_${i}_dy == 0) actor_${i}_last_dy_dir = 0; }\n`;
          actorLogicCode += `            if (actor_${i}_dy < 0) { actor_${i}_last_dy_dir = -1; if (actor_${i}_dx == 0) actor_${i}_last_dx_dir = 0; }\n`;
          actorLogicCode += `            else if (actor_${i}_dy > 0) { actor_${i}_last_dy_dir = 1; if (actor_${i}_dx == 0) actor_${i}_last_dx_dir = 0; }\n`;
          actorLogicCode += `        }\n`;
        }

        actorDeclarations += deferredFireProjLambdas;

        // Generate extra sprite items for set_actor_sprite referenced sprite sheets
        const extraSpriteNames = new Set();
        const gatherSetActorSpriteRefs = (nodes) => {
          if (!nodes) return;
          nodes.forEach(n => {
            if (n.data?.actionType === 'set_actor_sprite' && n.data?.resolvedSpriteName) {
              extraSpriteNames.add(n.data.resolvedSpriteName);
            }
          });
        };
        sActors.forEach(a => {
          gatherSetActorSpriteRefs(a.script?.nodes);
        });
        sTriggers.forEach(t => {
          if (t.isGroup) return;
          const tScript = getTriggerScript(t, sTriggers, customScripts);
          gatherSetActorSpriteRefs(tScript?.nodes);
        });
        customScripts.forEach(cs => gatherSetActorSpriteRefs(cs.script?.nodes));
        gatherSetActorSpriteRefs(globalScript?.nodes);
        gatherSetActorSpriteRefs(scene.script?.nodes);

        const generatedExtraSpriteItems = new Set();
        extraSpriteNames.forEach(spriteName => {
          const safeSpriteName = spriteName.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
          if (!safeSpriteName || generatedExtraSpriteItems.has(safeSpriteName)) return;
          generatedExtraSpriteItems.add(safeSpriteName);

          // Find animations for this sprite
          const spriteAnims = animations.filter(a => a.name && a.name.startsWith(spriteName));
          if (spriteAnims.length === 0) return;

          // Collect all tile IDs from all frames
          const extraFrameTiles = [];
          const addExtraTile = (tileId) => {
            const key = String(tileId);
            let idx = extraFrameTiles.findIndex(t => String(t) === key);
            if (idx === -1) { extraFrameTiles.push(tileId); idx = extraFrameTiles.length - 1; }
            return idx;
          };
          let extraDefaultIdx = 0;
          spriteAnims.forEach(anim => {
            if (anim.frames) {
              anim.frames.forEach(frame => {
                if (Array.isArray(frame)) {
                  frame.forEach(tileId => {
                    if (tileId != null) {
                      const idx = addExtraTile(tileId);
                      if (extraDefaultIdx === 0) extraDefaultIdx = idx;
                    }
                  });
                }
              });
            }
          });

          if (extraFrameTiles.length === 0) return;

          // Determine sprite dimensions from first frame of first animation
          const firstAnim = spriteAnims.find(a => a.frames && a.frames.length > 0);
          const firstFrame = firstAnim?.frames?.[0];
          const frameTileCount = firstFrame ? firstFrame.filter(t => t != null).length : 1;
          let spriteW = 16, spriteH = 16;
          if (frameTileCount === 1) { spriteW = 8; spriteH = 8; }
          else if (frameTileCount === 4) { spriteW = 16; spriteH = 16; }
          else if (frameTileCount === 8) { spriteW = 16; spriteH = 32; }
          else if (frameTileCount === 12) { spriteW = 24; spriteH = 24; }
          else { spriteW = 32; spriteH = 32; }

          const extraActName = `${safeSceneName}_extra_sprite_${safeSpriteName}`;
          const extraValidSizes = [8, 16, 24, 32, 64];
          const extraValidW = extraValidSizes.includes(spriteW) ? spriteW : 16;
          const extraValidH = extraValidSizes.includes(spriteH) ? spriteH : 16;
          const tilesPerFrame = (extraValidW / 8) * (extraValidH / 8);
          const extraFrameCount = Math.max(1, Math.ceil(extraFrameTiles.length / tilesPerFrame));

          // Render sprite item BMP
          const extraSCanvas = document.createElement('canvas');
          extraSCanvas.width = extraValidW;
          extraSCanvas.height = extraValidH * extraFrameCount;
          const extraSctx = extraSCanvas.getContext('2d');
          extraSctx.imageSmoothingEnabled = false;

          for (let f = 0; f < extraFrameCount; f++) {
            for (let ty = 0; ty < extraValidH / 8; ty++) {
              for (let tx = 0; tx < extraValidW / 8; tx++) {
                const tileIdx = f * tilesPerFrame + ty * (extraValidW / 8) + tx;
                const tilePayload = tileIdx < extraFrameTiles.length ? extraFrameTiles[tileIdx] : null;
                if (tilePayload != null) {
                  const tile = savedTiles.find(t => t && String(t.id) === String(tilePayload));
                  if (tile && tile.data) {
                    for (let py = 0; py < 8; py++) {
                      for (let px = 0; px < 8; px++) {
                        const color = tile.data[py]?.[px];
                        if (color) {
                          const rgb = hexToRgb(color);
                          extraSctx.fillStyle = `rgb(${rgb.r},${rgb.g},${rgb.b})`;
                        } else {
                          extraSctx.fillStyle = 'transparent';
                        }
                        extraSctx.fillRect(tx * 8 + px, f * extraValidH + ty * 8 + py, 1, 1);
                      }
                    }
                  }
                }
              }
            }
          }

          const extraForceBpp = globalBppMode === 'bpp_8' ? 8 : 4;
          const extraBmpBlob = canvasToIndexedBmpBlob(extraSCanvas, globalSpriteColors, extraForceBpp);
          zip.file(`graphics/${extraActName}.bmp`, extraBmpBlob);
          zip.file(`graphics/${extraActName}.json`, JSON.stringify({
            type: "sprite",
            width: extraValidW,
            height: extraValidH,
            bpp_mode: globalBppMode,
            colors_count: globalColorsCount
          }, null, 2));
          zip.file(`graphics/${extraActName}.grit`, `-m!`);
          mainCppIncludes += `#include "bn_sprite_items_${extraActName}.h"\n`;

          // Store mapping on scene script nodes for use in script codegen
          const setActorSpriteNodes = [];
          const collectNodes = (nodes) => {
            if (!nodes) return;
            nodes.forEach(n => {
              if (n.data?.actionType === 'set_actor_sprite' && n.data?.resolvedSpriteName === spriteName) {
                setActorSpriteNodes.push(n);
              }
            });
          };
          sActors.forEach(a => collectNodes(a.script?.nodes));
          sTriggers.forEach(t => {
            if (t.isGroup) return;
            const tScript = getTriggerScript(t, sTriggers, customScripts);
            collectNodes(tScript?.nodes);
          });
          customScripts.forEach(cs => collectNodes(cs.script?.nodes));
          collectNodes(globalScript?.nodes);
          collectNodes(scene.script?.nodes);

          setActorSpriteNodes.forEach(n => {
            if (n.data) {
              n.data.computedSpriteItemName = extraActName;
              n.data.computedSpriteFrameCount = extraFrameCount;
              n.data.computedSpriteWidth = extraValidW;
              n.data.computedSpriteHeight = extraValidH;
            }
          });
        });

        let triggerDeclarations = '';
        let triggerLogicCode = '';

        sTriggers.forEach((t, i) => {
          if (t.isGroup) return;

          const group = sTriggers.find(g => g && g.isGroup && g.id === t.groupId);
          const tTypeDecl = group ? (group.type || t.type) : t.type;
          if (tTypeDecl === 'enter' || tTypeDecl === 'leave' || tTypeDecl === 'interact') {
            triggerDeclarations += `    bool trigger_${i}_active = false;\n`;
          }
          const tScript = getTriggerScript(t, sTriggers, customScripts);
          let scriptCode = generateScriptLogic(tScript, -1, 0, 0, undefined, undefined, scCtx);

          const playerIdx = sActors.findIndex(a => a && a.type === 'player');
          if (playerIdx !== -1) {
            const tX = t.useVarX && t.varX ? `(${t.varX.replace(/[^a-zA-Z0-9_]/g, '_')} * 8)` : t.x;
            const tY = t.useVarY && t.varY ? `(${t.varY.replace(/[^a-zA-Z0-9_]/g, '_')} * 8)` : t.y;
            triggerLogicCode += `        // Trigger Logic: ${t.name}\n`;
            triggerLogicCode += `        {\n`;
            const pCW = sActors[playerIdx].collisionW ?? sActors[playerIdx].width ?? 16;
            const pCH = sActors[playerIdx].collisionH ?? sActors[playerIdx].height ?? 16;
            const pCX = sActors[playerIdx].collisionX ?? 0;
            const pCY = sActors[playerIdx].collisionY ?? 0;
            if (scene.type === 'POINTNCLICK') {
              triggerLogicCode += `            int px = actor_${playerIdx}_x;\n`;
              triggerLogicCode += `            int py = actor_${playerIdx}_y;\n`;
            } else {
              triggerLogicCode += `            int px = actor_${playerIdx}_x + ${pCX} + ${Math.floor(pCW / 2)};\n`;
              triggerLogicCode += `            int py = actor_${playerIdx}_y + ${pCY} + ${Math.floor(pCH / 2)};\n`;
            }
            triggerLogicCode += `            int tx = ${tX};\n`;
            triggerLogicCode += `            int ty = ${tY};\n`;
            triggerLogicCode += `            bool inside = px >= tx && px < tx + ${t.width} && py >= ty && py < ty + ${t.height};\n`;
            let pushableInsideCheck = '';
            for (let j = 0; j < sActors.length; j++) {
              const actor = sActors[j];
              if (actor.type === 'pushable') {
                const aCW = actor.collisionW ?? actor.width ?? 16;
                const aCH = actor.collisionH ?? actor.height ?? 16;
                const aCX = actor.collisionX ?? 0;
                const aCY = actor.collisionY ?? 0;
                pushableInsideCheck += `            if (actor_${j}_active) {\n`;
                pushableInsideCheck += `                int bx = actor_${j}_x + ${aCX} + ${Math.floor(aCW / 2)};\n`;
                pushableInsideCheck += `                int by = actor_${j}_y + ${aCY} + ${Math.floor(aCH / 2)};\n`;
                pushableInsideCheck += `                if (bx >= tx && bx < tx + ${t.width} && by >= ty && by < ty + ${t.height}) {\n`;
                pushableInsideCheck += `                    inside = true;\n`;
                pushableInsideCheck += `                }\n`;
                pushableInsideCheck += `            }\n`;
              }
            }
            if (pushableInsideCheck) {
              triggerLogicCode += pushableInsideCheck;
            }
            if (scene.type === 'POINTNCLICK') {
              triggerLogicCode += `            if (inside) {\n`;
              triggerLogicCode += `                is_hovering = true;\n`;
              triggerLogicCode += `            }\n`;
            }

            const tType = group ? (group.type || t.type) : t.type;
            if (tType === 'enter') {
              triggerLogicCode += `            if (inside && !trigger_${i}_active) {\n`;
              triggerLogicCode += `                trigger_${i}_active = true;\n`;
              if (scriptCode) triggerLogicCode += scriptCode;
              triggerLogicCode += `            } else if (!inside && trigger_${i}_active) {\n`;
              triggerLogicCode += `                trigger_${i}_active = false;\n`;
              triggerLogicCode += `            }\n`;
            } else if (tType === 'leave') {
              triggerLogicCode += `            if (inside && !trigger_${i}_active) {\n`;
              triggerLogicCode += `                trigger_${i}_active = true;\n`;
              triggerLogicCode += `            } else if (!inside && trigger_${i}_active) {\n`;
              triggerLogicCode += `                trigger_${i}_active = false;\n`;
              const isFinishLine = scene.type === 'RACING' && (t.name === 'Finish Line' || (group && group.name === 'Finish Line'));
              if (isFinishLine) {
                let lapsLimitExpr = '3';
                if (scene.useVarLaps && scene.lapsVar) {
                  lapsLimitExpr = String(scene.lapsVar).replace(/[^a-zA-Z0-9_]/g, '_');
                } else if (scene.lapsToFinish !== undefined) {
                  lapsLimitExpr = String(scene.lapsToFinish);
                }
                triggerLogicCode += `                if (!_race_finished) {\n`;
                triggerLogicCode += `                    _laps_completed++;\n`;
                triggerLogicCode += `                    int current_lap_time = _lap_time_frames;\n`;
                triggerLogicCode += `                    if (_best_lap_frames == -1 || current_lap_time < _best_lap_frames) {\n`;
                triggerLogicCode += `                        _best_lap_frames = current_lap_time;\n`;
                triggerLogicCode += `                    }\n`;
                triggerLogicCode += `                    _lap_time_frames = 0;\n`;
                triggerLogicCode += `                    if (_laps_completed >= ${lapsLimitExpr}) {\n`;
                triggerLogicCode += `                        _race_finished = true;\n`;
                triggerLogicCode += `                        {\n`;
                triggerLogicCode += `                            if (!scene_dialog_bg) {\n`;
                triggerLogicCode += `                                scene_dialog_bg = bn::regular_bg_items::dialog_bg.create_bg(0, 0);\n`;
                triggerLogicCode += `                                scene_dialog_bg->set_priority(0);\n`;
                triggerLogicCode += `                            }\n`;
                triggerLogicCode += `                            bn::vector<bn::sprite_ptr, 128> text_sprites;\n`;
                triggerLogicCode += `                            int r_frames = _race_time_frames;\n`;
                triggerLogicCode += `                            int r_seconds = r_frames / 60;\n`;
                triggerLogicCode += `                            int r_centiseconds = ((r_frames % 60) * 100) / 60;\n`;
                triggerLogicCode += `                            int r_minutes = r_seconds / 60;\n`;
                triggerLogicCode += `                            r_seconds = r_seconds % 60;\n`;
                triggerLogicCode += `                            int b_frames = _best_lap_frames;\n`;
                triggerLogicCode += `                            int b_seconds = b_frames / 60;\n`;
                triggerLogicCode += `                            int b_centiseconds = ((b_frames % 60) * 100) / 60;\n`;
                triggerLogicCode += `                            int b_minutes = b_seconds / 60;\n`;
                triggerLogicCode += `                            b_seconds = b_seconds % 60;\n`;
                triggerLogicCode += `                            bn::string<128> msg = "Race Finished!\\nTotal: ";\n`;
                triggerLogicCode += `                            bn::ostringstream stream(msg);\n`;
                triggerLogicCode += `                            if (r_minutes < 10) stream.append("0");\n`;
                triggerLogicCode += `                            stream.append(r_minutes);\n`;
                triggerLogicCode += `                            stream.append(":");\n`;
                triggerLogicCode += `                            if (r_seconds < 10) stream.append("0");\n`;
                triggerLogicCode += `                            stream.append(r_seconds);\n`;
                triggerLogicCode += `                            stream.append(".");\n`;
                triggerLogicCode += `                            if (r_centiseconds < 10) stream.append("0");\n`;
                triggerLogicCode += `                            stream.append(r_centiseconds);\n`;
                triggerLogicCode += `                            stream.append("\\nBest Lap: ");\n`;
                triggerLogicCode += `                            if (b_minutes < 10) stream.append("0");\n`;
                triggerLogicCode += `                            stream.append(b_minutes);\n`;
                triggerLogicCode += `                            stream.append(":");\n`;
                triggerLogicCode += `                            if (b_seconds < 10) stream.append("0");\n`;
                triggerLogicCode += `                            stream.append(b_seconds);\n`;
                triggerLogicCode += `                            stream.append(".");\n`;
                triggerLogicCode += `                            if (b_centiseconds < 10) stream.append("0");\n`;
                triggerLogicCode += `                            stream.append(b_centiseconds);\n`;
                triggerLogicCode += `                            show_dialog_text(msg, text_sprites, dialog_text_palette, text_anim_speed);\n`;
                triggerLogicCode += `                            while(bn::keypad::a_held()) { bn::core::update(); }\n`;
                triggerLogicCode += `                            while(!bn::keypad::a_pressed()) { bn::core::update(); }\n`;
                triggerLogicCode += `                            while(bn::keypad::a_held()) { bn::core::update(); }\n`;
                triggerLogicCode += `                            scene_dialog_bg.reset();\n`;
                triggerLogicCode += `                        }\n`;
                triggerLogicCode += `                    }\n`;
                triggerLogicCode += `                }\n`;
              }
              if (scriptCode) triggerLogicCode += scriptCode;
              triggerLogicCode += `            }\n`;
            } else if (tType === 'interact') {
              triggerLogicCode += `            if (inside && bn::keypad::a_pressed() && !trigger_${i}_active) {\n`;
              triggerLogicCode += `                trigger_${i}_active = true;\n`;
              if (scriptCode) triggerLogicCode += scriptCode;
              triggerLogicCode += `            } else if (!inside) {\n`;
              triggerLogicCode += `                trigger_${i}_active = false;\n`;
              triggerLogicCode += `            }\n`;
            }
            triggerLogicCode += `        }\n`;
          }
        });

        const _needsRng = sActors.some(a => { if (!a) return false;
          if (a.type === 'player') return false;
          if (a.type === 'enemy' && (a.enemyBehavior || 'patrol') === 'random') return true;
          if (a.type === 'enemy') return false;
          if (['platform','staticPlatform','movingPlatform','ladder','coin','bonus','spring','hazard','destructible','key','door','powerup','sign','conveyor','checkpoint','turret','spawner','companion','pressure_plate','push_target','teleporter','crumbling_platform','ice_block','chest','torch','save_point','xp_orb','shield','ammo_pickup','grenade','wall_jump_surface','one_way_wall','magnet','gravity_flip_zone','boost_pad','checkpoint_gate','pass_wall'].includes(a.type)) return false;
          const nb = a.npcBehavior || 'wander';
          return nb === 'wander' || nb === 'random' || (nb === 'follow' && (parseInt(a.followProximity) || 0) > 0);
        });
        let sceneCode = `SceneId play_${safeSceneName}(bn::random& rng) {\n`;
        if (!_needsRng) sceneCode += `    (void)rng;\n`;
        sceneCode += `    bn::camera_ptr camera = bn::camera_ptr::create(0, 0);\n`;
        sceneCode += `    int cam_x = 0;\n`;
        sceneCode += `    int cam_y = 0;\n`;
        sceneCode += `    bool camera_custom_control = false;\n`;
        sceneCode += `    bn::fixed camera_target_x = 0;\n`;
        sceneCode += `    bn::fixed camera_target_y = 0;\n`;
        sceneCode += `    bn::fixed camera_speed = 2;\n`;
        sceneCode += `    bool camera_instant = false;\n`;
        sceneCode += `    int timer_1_frames = 0;\n`;
        sceneCode += `    int timer_2_frames = 0;\n`;
        sceneCode += `    int timer_3_frames = 0;\n`;
        sceneCode += `    int timer_4_frames = 0;\n`;
        sceneCode += `    global_spawn_x = -1;\n    global_spawn_y = -1;\n`;
        sceneCode += `    int key_held_up = 0; int cur_held_up = 0;\n`;
        sceneCode += `    int key_held_down = 0; int cur_held_down = 0;\n`;
        sceneCode += `    int key_held_left = 0; int cur_held_left = 0;\n`;
        sceneCode += `    int key_held_right = 0; int cur_held_right = 0;\n`;
        sceneCode += `    int key_held_a = 0; int cur_held_a = 0;\n`;
        sceneCode += `    int key_held_b = 0; int cur_held_b = 0;\n`;
        sceneCode += `    int key_held_l = 0; int cur_held_l = 0;\n`;
        sceneCode += `    int key_held_r = 0; int cur_held_r = 0;\n`;
        sceneCode += `    int key_held_start = 0; int cur_held_start = 0;\n`;
        sceneCode += `    int key_held_select = 0; int cur_held_select = 0;\n`;

        // Check if scene has a player with HUD enabled (before any HUD code)
        const playerIdx = sActors.findIndex(a => a && a.type === 'player');
        const bossActors = sActors.filter(a => a.type === 'enemy' && a.isBoss);
        let displayHealthInHud = false;
        let displayBonusInHud = false;
        let hudPosition = 'top';
        if (hudSettings && hudSettings.enabled) {
          hudPosition = hudSettings.position || 'top';
          const items = hudSettings.displayItems || [];
          items.forEach(item => {
            const txt = (item.text || '').toUpperCase();
            if (txt.includes('{HP}') || txt.includes('{HEALTH}') || txt.includes('{PLAYER_HP}')) {
              displayHealthInHud = true;
            }
            if (txt.includes('{BONUS}') || txt.includes('{COINS}') || txt.includes('{PLAYER_BONUS}')) {
              displayBonusInHud = true;
            }
          });
        } else if (playerIdx !== -1) {
          const pActor = sActors[playerIdx];
          if (pActor) {
            if (pActor.displayHealthInHud) displayHealthInHud = true;
            if (pActor.displayBonusInHud) displayBonusInHud = true;
            if (pActor.hudPosition) hudPosition = pActor.hudPosition;
          }
        }

        const parseHUDText = (text) => {
          const segments = [];
          const regex = /\{([^}]+)\}/g;
          let lastIndex = 0;
          let match;
          while ((match = regex.exec(text)) !== null) {
            if (match.index > lastIndex) {
              segments.push({
                type: 'static',
                value: text.substring(lastIndex, match.index).toUpperCase()
              });
            }
            segments.push({
              type: 'variable',
              name: match[1].trim()
            });
            lastIndex = regex.lastIndex;
          }
          if (lastIndex < text.length) {
            segments.push({
              type: 'static',
              value: text.substring(lastIndex).toUpperCase()
            });
          }
          return segments;
        };

        const spriteLayouts = [];
        if (hudSettings && hudSettings.enabled && scene.type !== 'INTRO' && scene.type !== 'PAUSE') {
          const items = hudSettings.displayItems || [];
          const pos = hudSettings.position || 'top';
          const isVertical = pos === 'left' || pos === 'right';
          const W = (hudSettings.width ?? (isVertical ? 2 : 30)) * 8;
          const H = (hudSettings.height ?? (isVertical ? 20 : 2)) * 8;
          const alignment = hudSettings.alignment || 'left';
          const spacing = hudSettings.spacing || 'space-between';

          if (pos === 'left' || pos === 'right') {
            const centerX = pos === 'left' ? (-120 + W / 2) : (120 - W / 2);

            if (hudSettings.verticalText) {
              let totalH = 0;
              const itemHeights = items.map(item => {
                const segments = parseHUDText(item.text || '');
                const templateLength = segments.reduce((sum, seg) => sum + (seg.type === 'static' ? seg.value.length : 2), 0);
                return (item.tileId ? 12 : 0) + templateLength * 8;
              });
              items.forEach((item, itemIdx) => {
                totalH += itemHeights[itemIdx] + 12;
              });
              totalH = Math.max(0, totalH - 12);

              let startY = -totalH / 2;
              if (alignment === 'left') {
                startY = -H / 2 + 8;
              } else if (alignment === 'right') {
                startY = H / 2 - 8 - totalH;
              }

              const sumItemH = itemHeights.reduce((s, h) => s + h, 0);
              const gapY = (items.length > 1) ? (H - 16 - sumItemH) / (items.length - 1) : 0;

              let accumY = startY;
              items.forEach((item, itemIdx) => {
                const segments = parseHUDText(item.text || '');
                const itemH = itemHeights[itemIdx];

                let drawY;
                if (spacing === 'space-between' && items.length > 1) {
                  let prevHSum = 0;
                  for (let j = 0; j < itemIdx; j++) {
                    prevHSum += itemHeights[j] + gapY;
                  }
                  drawY = -H / 2 + 8 + prevHSum;
                } else if (spacing === 'space-between' && items.length === 1) {
                  if (alignment === 'left') {
                    drawY = -H / 2 + 8;
                  } else if (alignment === 'right') {
                    drawY = H / 2 - 8 - itemH;
                  } else {
                    drawY = -itemH / 2;
                  }
                } else {
                  drawY = accumY;
                  accumY += itemH + 12;
                }

                const itemLayout = {
                  tile: null,
                  chars: [],
                  vars: []
                };

                if (item.tileId) {
                  itemLayout.tile = {
                    tileId: item.tileId,
                    x: Math.round(centerX),
                    y: Math.round(drawY + 4)
                  };
                  drawY += 12;
                }

                let charIdx = 0;
                let varIdx = 0;
                segments.forEach(seg => {
                  if (seg.type === 'static') {
                    for (let c = 0; c < seg.value.length; c++) {
                      const char = seg.value[c];
                      if (char !== ' ') {
                        itemLayout.chars.push({
                          char: char,
                          charIdx: charIdx++,
                          x: Math.round(centerX),
                          y: Math.round(drawY + 4)
                        });
                      }
                      drawY += 8;
                    }
                  } else if (seg.type === 'variable') {
                    itemLayout.vars.push({
                      name: seg.name,
                      varIdx: varIdx++,
                      x: Math.round(centerX),
                      d1_y: Math.round(drawY + 4),
                      d2_y: Math.round(drawY + 12),
                      d2_y_single: Math.round(drawY + 4)
                    });
                    drawY += 16;
                  }
                });

                spriteLayouts.push(itemLayout);
              });
            } else {
              // Horizontal text vertical layout
              const totalH = items.length * 20 - 4;
              let startY = -totalH / 2 + 4;
              if (alignment === 'left') {
                startY = -H / 2 + 12;
              } else if (alignment === 'right') {
                startY = H / 2 - 12 - totalH + 4;
              }

              const itemHeights = items.map(() => 8);
              const sumItemH = itemHeights.reduce((s, h) => s + h, 0);
              const gapY = (items.length > 1) ? (H - 16 - sumItemH) / (items.length - 1) : 0;

              items.forEach((item, itemIdx) => {
                const segments = parseHUDText(item.text || '');
                const templateLength = segments.reduce((sum, seg) => sum + (seg.type === 'static' ? seg.value.length : 2), 0);
                const itemW = (item.tileId ? 12 : 0) + templateLength * 8;
                let startX = centerX - itemW / 2;

                let currentY;
                if (spacing === 'space-between' && items.length > 1) {
                  let prevHSum = 0;
                  for (let j = 0; j < itemIdx; j++) {
                    prevHSum += itemHeights[j] + gapY;
                  }
                  const drawY = -H / 2 + 8 + prevHSum;
                  currentY = drawY + 4;
                } else if (spacing === 'space-between' && items.length === 1) {
                  if (alignment === 'left') {
                    currentY = -H / 2 + 8 + 4;
                  } else if (alignment === 'right') {
                    currentY = H / 2 - 8 - 4;
                  } else {
                    currentY = 0;
                  }
                } else {
                  currentY = startY + itemIdx * 20;
                }

                const itemLayout = {
                  tile: null,
                  chars: [],
                  vars: []
                };

                if (item.tileId) {
                  itemLayout.tile = {
                    tileId: item.tileId,
                    x: Math.round(startX + 4),
                    y: Math.round(currentY)
                  };
                  startX += 12;
                }

                let charIdx = 0;
                let varIdx = 0;
                segments.forEach(seg => {
                  if (seg.type === 'static') {
                    for (let c = 0; c < seg.value.length; c++) {
                      const char = seg.value[c];
                      if (char !== ' ') {
                        itemLayout.chars.push({
                          char: char,
                          charIdx: charIdx++,
                          x: Math.round(startX + 4),
                          y: Math.round(currentY)
                        });
                      }
                      startX += 8;
                    }
                  } else if (seg.type === 'variable') {
                    const d1_x = Math.round(startX + 4);
                    const d2_x = Math.round(startX + 12);
                    const d2_x_single = Math.round(startX + 8);
                    itemLayout.vars.push({
                      name: seg.name,
                      varIdx: varIdx++,
                      d1_x: d1_x,
                      d2_x: d2_x,
                      d2_x_single: d2_x_single,
                      y: Math.round(currentY)
                    });
                    startX += 16;
                  }
                });

                spriteLayouts.push(itemLayout);
              });
            }
          } else {
            const centerY = pos === 'top' ? (-80 + H / 2) : (80 - H / 2);

            let totalW = 0;
            const itemWidths = [];
            items.forEach(item => {
              const segments = parseHUDText(item.text || '');
              const templateLength = segments.reduce((sum, seg) => sum + (seg.type === 'static' ? seg.value.length : 2), 0);
              const itemW = (item.tileId ? 12 : 0) + templateLength * 8;
              itemWidths.push({ segments, itemW });
              totalW += itemW + 16;
            });
            totalW = Math.max(0, totalW - 16);

            let startX = -totalW / 2;
            if (alignment === 'left') {
              startX = -W / 2 + 8;
            } else if (alignment === 'right') {
              startX = W / 2 - 8 - totalW;
            }

            let accumX = startX;
            items.forEach((item, itemIdx) => {
              const { segments, itemW } = itemWidths[itemIdx];
              
              let currentX;
              if (spacing === 'space-between' && items.length > 1) {
                let prevW = 0;
                for (let j = 0; j < itemIdx; j++) {
                  prevW += itemWidths[j].itemW;
                }
                const totalItemsW = itemWidths.reduce((sum, it) => sum + it.itemW, 0);
                const gapX = ((W - 16) - totalItemsW) / (items.length - 1);
                currentX = -W / 2 + 8 + prevW + itemIdx * gapX;
              } else if (spacing === 'space-between' && items.length === 1) {
                if (alignment === 'left') {
                  currentX = -W / 2 + 8;
                } else if (alignment === 'right') {
                  currentX = W / 2 - 8 - itemW;
                } else {
                  currentX = -itemW / 2;
                }
              } else {
                currentX = accumX;
                accumX += itemW + 16;
              }

              const itemLayout = {
                tile: null,
                chars: [],
                vars: []
              };

              if (item.tileId) {
                itemLayout.tile = {
                  tileId: item.tileId,
                  x: Math.round(currentX + 4),
                  y: Math.round(centerY)
                };
                currentX += 12;
              }

              let charIdx = 0;
              let varIdx = 0;
              segments.forEach(seg => {
                if (seg.type === 'static') {
                  for (let c = 0; c < seg.value.length; c++) {
                    const char = seg.value[c];
                    if (char !== ' ') {
                      itemLayout.chars.push({
                        char: char,
                        charIdx: charIdx++,
                        x: Math.round(currentX + 4),
                        y: Math.round(centerY)
                      });
                    }
                    currentX += 8;
                  }
                } else if (seg.type === 'variable') {
                  const d1_x = Math.round(currentX + 4);
                  const d2_x = Math.round(currentX + 12);
                  const d2_x_single = Math.round(currentX + 8);
                  itemLayout.vars.push({
                    name: seg.name,
                    varIdx: varIdx++,
                    d1_x: d1_x,
                    d2_x: d2_x,
                    d2_x_single: d2_x_single,
                    y: Math.round(centerY)
                  });
                  currentX += 16;
                }
              });

              spriteLayouts.push(itemLayout);
            });
          }
        }

        let hudHIconX = -112;
        let hudHXX = -102;
        let hudHD1X = -94;
        let hudHD2X = -86;
        let hudHD2XOneDigit = -94;
        let hudH_y = hudPosition === 'bottom' ? 72 : -72;

        let hudBIconX = 86;
        let hudBXX = 96;
        let hudBD1X = 104;
        let hudBD2X = 112;
        let hudBD2XOneDigit = 104;
        let hudB_y = hudPosition === 'bottom' ? 72 : -72;

        if (hudSettings && hudSettings.enabled) {
          const isVertical = hudPosition === 'left' || hudPosition === 'right';
          const W = (hudSettings.width ?? (isVertical ? 2 : 30)) * 8;
          const H = (hudSettings.height ?? (isVertical ? 20 : 2)) * 8;
          if (hudPosition === 'top' || hudPosition === 'bottom') {
            hudH_y = hudPosition === 'top' ? (-80 + H / 2) : (80 - H / 2);
            hudB_y = hudH_y;
            hudHIconX = -W / 2 + 8;
            hudHXX = -W / 2 + 18;
            hudHD1X = -W / 2 + 26;
            hudHD2X = -W / 2 + 34;
            hudHD2XOneDigit = -W / 2 + 26;

            hudBIconX = W / 2 - 34;
            hudBXX = W / 2 - 24;
            hudBD1X = W / 2 - 16;
            hudBD2X = W / 2 - 8;
            hudBD2XOneDigit = W / 2 - 16;
          } else { // 'left' or 'right'
            const centerX = hudPosition === 'left' ? (-120 + W / 2) : (120 - W / 2);
            hudH_y = -20;
            hudB_y = 20;

            hudHIconX = centerX - 16;
            hudHXX = centerX - 6;
            hudHD1X = centerX + 2;
            hudHD2X = centerX + 10;
            hudHD2XOneDigit = centerX + 2;

            hudBIconX = centerX - 16;
            hudBXX = centerX - 6;
            hudBD1X = centerX + 2;
            hudBD2X = centerX + 10;
            hudBD2XOneDigit = centerX + 2;
          }
        }

        const fontColorHex = (hudSettings && hudSettings.enabled) ? (hudSettings.textColor || '#ffffff') : '#ffffff';
        const fontColorRgb = hexToRgb(fontColorHex) || { r: 255, g: 255, b: 255 };
        const fontColorIdx = globalSpriteColors.findIndex(c => c && c[0] === fontColorRgb.r && c[1] === fontColorRgb.g && c[2] === fontColorRgb.b);
        const safeFontColorIdx = fontColorIdx !== -1 ? fontColorIdx : 1;
        const fontR = Math.floor(fontColorRgb.r / 8);
        const fontG = Math.floor(fontColorRgb.g / 8);
        const fontB = Math.floor(fontColorRgb.b / 8);

        sceneCode += `    bn::sprite_palette_ptr shared_sprite_palette = bn::sprite_items::hud_0.palette_item().create_palette();\n`;
        sceneCode += `    shared_sprite_palette.set_color(${safeFontColorIdx}, bn::color(${fontR}, ${fontG}, ${fontB}));\n`;
        sceneCode += `    bn::sprite_palette_ptr dialog_text_palette = shared_sprite_palette;\n`;
        sceneCode += `    bn::optional<bn::regular_bg_ptr> scene_dialog_bg;\n`;
        sceneCode += `    bn::optional<bn::regular_bg_ptr> scene_overlay_bg;\n`;
        sceneCode += `    int text_anim_speed = 2;\n`;
        if (hudSettings && hudSettings.enabled && scene.type !== 'INTRO' && scene.type !== 'PAUSE') {
          bgDeclarations += `    bn::regular_bg_ptr hud_bg = bn::regular_bg_items::hud_bg.create_bg(0, 0);\n`;
          bgDeclarations += `    hud_bg.set_priority(1);\n`;
        }
        // Add pause overlay for non-INTRO/PAUSE scenes
        if (pauseScene && scene.type !== 'INTRO' && scene.type !== 'PAUSE') {
          bgDeclarations += `    bn::optional<bn::regular_bg_ptr> pause_overlay;\n`;
          bgDeclarations += `    bool _paused = false;\n`;
        }
        sceneCode += bgDeclarations;
        const _hasKeys = sActors.some(a => a && a.type === 'key' || a.type === 'door');
        const _hasGrenades = sActors.some(a => a && a.type === 'grenade');
        sceneCode += `    int proj_x[20];\n    int proj_y[20];\n    bn::fixed proj_dx[20];\n    bn::fixed proj_dy[20];\n    bool proj_active[20];\n    bool proj_from_player[20];\n    bool proj_bouncing[20];\n    int proj_bounce_count[20];\n    for(int i=0; i<20; ++i) {\n        proj_active[i] = false;\n        proj_from_player[i] = false;\n        proj_bouncing[i] = false;\n        proj_bounce_count[i] = 0;\n    }\n    bn::optional<bn::sprite_ptr> proj_sprites[20];\n`;
        if (_hasGrenades) {
          sceneCode += `    int grenade_x[5];\n    int grenade_y[5];\n    bn::fixed grenade_dx[5];\n    bn::fixed grenade_dy[5];\n    bool grenade_active[5];\n    int grenade_timer[5];\n    for(int i=0; i<5; ++i) {\n        grenade_active[i] = false;\n        grenade_timer[i] = 0;\n    }\n    bn::optional<bn::sprite_ptr> grenade_sprites[5];\n`;
        }
        sceneCode += (function() {
          const defaultActiveCPs = sActors.filter(a => a.type === 'checkpoint' && a.checkpointDefaultActive);
          if (defaultActiveCPs.length === 0) return '';
          let cpCode = '';
          defaultActiveCPs.forEach(cp => {
            const cpIdx = sActors.indexOf(cp);
            cpCode += `    global_spawn_x = ${cp.x};\n    global_spawn_y = ${cp.y};\n    actor_${cpIdx}_cp_activated = true;\n`;
          });
          return cpCode;
        })();
        sceneCode += actorDeclarations;
        if ((scene.type === 'RACING' || scene.type === 'SHMUP') && scene.mode7) {
          sceneCode += `    auto update_m7_hbe = [&]() {\n`;
          sceneCode += `        int m7_cam_x_int = m7_cam_x.data();\n`;
          sceneCode += `        int m7_cam_y_int = m7_cam_y.data() >> 4;\n`;
          sceneCode += `        int m7_cam_z_int = m7_cam_z.data();\n`;
          sceneCode += `        int m7_angle_deg = m7_cam_phi * 360 / 2048;\n`;
          sceneCode += `        int m7_cos = bn::lut_cos(m7_cam_phi).data() >> 4;\n`;
          sceneCode += `        int m7_sin = bn::lut_sin(m7_cam_phi).data() >> 4;\n`;
          if (scene.type === 'SHMUP') {
            sceneCode += `        int y_shift = 240;\n`;
          } else {
            sceneCode += `        int y_shift = 160;\n`;
          }
          sceneCode += `        for(int index = 0; index < bn::display::height(); ++index) {\n`;
          sceneCode += `            int reciprocal = bn::reciprocal_lut[index].data() >> 4;\n`;
          sceneCode += `            int lam = (m7_cam_y_int * reciprocal) >> 12;\n`;
          sceneCode += `            int lcf = (lam * m7_cos) >> 8;\n`;
          sceneCode += `            int lsf = (lam * m7_sin) >> 8;\n`;
          sceneCode += `            m7_pa_values[index] = int16_t(lcf >> 5);\n`;
          sceneCode += `            m7_pc_values[index] = int16_t(lsf >> 5);\n`;
          sceneCode += `            int lxr = (bn::display::width() / 4) * lcf;\n`;
          sceneCode += `            int lyr = y_shift * lsf;\n`;
          sceneCode += `            m7_dx_values[index] = (m7_cam_x_int - lxr + lyr) >> 4;\n`;
          sceneCode += `            lxr = (bn::display::width() / 4) * lsf;\n`;
          sceneCode += `            lyr = y_shift * lcf;\n`;
          sceneCode += `            m7_dy_values[index] = (m7_cam_z_int - lxr - lyr) >> 4;\n`;
          sceneCode += `        }\n`;
          sceneCode += `    };\n\n`;
        }
        sceneCode += triggerDeclarations;
        sceneCode += `    auto check_solid_collision = [&](bn::fixed x, bn::fixed y, int cx, int cy, int cw, int ch) {\n`;
        sceneCode += `        int x_start = (x.integer() + cx) >> 3;\n`;
        sceneCode += `        int x_end = (x.integer() + cx + cw - 1) >> 3;\n`;
        sceneCode += `        int y_start = (y.integer() + cy) >> 3;\n`;
        sceneCode += `        int y_end = (y.integer() + cy + ch - 1) >> 3;\n`;
        sceneCode += `        for (int tx = x_start; tx <= x_end; ++tx) {\n`;
        sceneCode += `            for (int ty = y_start; ty <= y_end; ++ty) {\n`;
        sceneCode += `                if (${safeSceneName}_map::get_collision(tx, ty) == ${safeSceneName}_map::collision_type::SOLID) {\n`;
        sceneCode += `                    return true;\n`;
        sceneCode += `                }\n`;
        sceneCode += `            }\n`;
        sceneCode += `        }\n`;
        sceneCode += `        return false;\n`;
        sceneCode += `    };\n`;
        sceneCode += `    auto check_ground_collision = [&](bn::fixed x, bn::fixed y, int cx, int cy, int cw, int ch) {\n`;
        sceneCode += `        int x_start = (x.integer() + cx) >> 3;\n`;
        sceneCode += `        int x_end = (x.integer() + cx + cw - 1) >> 3;\n`;
        sceneCode += `        int y_end = (y.integer() + cy + ch - 1) >> 3;\n`;
        sceneCode += `        for (int tx = x_start; tx <= x_end; ++tx) {\n`;
        sceneCode += `            auto ct = ${safeSceneName}_map::get_collision(tx, y_end);\n`;
        sceneCode += `            if (ct == ${safeSceneName}_map::collision_type::SOLID || ct == ${safeSceneName}_map::collision_type::TOP) {\n`;
        sceneCode += `                return true;\n`;
        sceneCode += `            }\n`;
        sceneCode += `        }\n`;
        sceneCode += `        return false;\n`;
        sceneCode += `    };\n`;
        sceneCode += `    auto check_ceiling_collision = [&](bn::fixed x, bn::fixed y, int cx, int cy, int cw, int ch) {\n`;
        sceneCode += `        int x_start = (x.integer() + cx) >> 3;\n`;
        sceneCode += `        int x_end = (x.integer() + cx + cw - 1) >> 3;\n`;
        sceneCode += `        int y_start = (y.integer() + cy) >> 3;\n`;
        sceneCode += `        for (int tx = x_start; tx <= x_end; ++tx) {\n`;
        sceneCode += `            if (${safeSceneName}_map::get_collision(tx, y_start) == ${safeSceneName}_map::collision_type::SOLID) {\n`;
        sceneCode += `                return true;\n`;
        sceneCode += `            }\n`;
        sceneCode += `        }\n`;
        sceneCode += `        return false;\n`;
        sceneCode += `    };\n\n`;

        if (hudSettings && hudSettings.enabled) {
          sceneCode += `    // Unified HUD Setup\n`;
          sceneCode += `    auto update_digit_sprite = [](bn::sprite_ptr& sprite, int val) {\n`;
          sceneCode += `        if (val == 0) sprite.set_item(bn::sprite_items::hud_0);\n`;
          sceneCode += `        else if (val == 1) sprite.set_item(bn::sprite_items::hud_1);\n`;
          sceneCode += `        else if (val == 2) sprite.set_item(bn::sprite_items::hud_2);\n`;
          sceneCode += `        else if (val == 3) sprite.set_item(bn::sprite_items::hud_3);\n`;
          sceneCode += `        else if (val == 4) sprite.set_item(bn::sprite_items::hud_4);\n`;
          sceneCode += `        else if (val == 5) sprite.set_item(bn::sprite_items::hud_5);\n`;
          sceneCode += `        else if (val == 6) sprite.set_item(bn::sprite_items::hud_6);\n`;
          sceneCode += `        else if (val == 7) sprite.set_item(bn::sprite_items::hud_7);\n`;
          sceneCode += `        else if (val == 8) sprite.set_item(bn::sprite_items::hud_8);\n`;
          sceneCode += `        else if (val == 9) sprite.set_item(bn::sprite_items::hud_9);\n`;
          sceneCode += `    };\n`;
          sceneCode += `    auto update_var_display = [&](bn::sprite_ptr& digit1, bn::sprite_ptr& digit2, int current_val, int& prev_val, int d1_x, int d2_x, int d2_x_one_digit) {\n`;
          sceneCode += `        if (current_val < 0) current_val = 0;\n`;
          sceneCode += `        if (current_val > 99) current_val = 99;\n`;
          sceneCode += `        if (current_val != prev_val) {\n`;
          sceneCode += `            prev_val = current_val;\n`;
          sceneCode += `            int tens = current_val / 10;\n`;
          sceneCode += `            int units = current_val % 10;\n`;
          sceneCode += `            if (tens > 0) {\n`;
          sceneCode += `                digit1.set_visible(true);\n`;
          sceneCode += `                update_digit_sprite(digit1, tens);\n`;
          sceneCode += `                digit2.set_x(d2_x);\n`;
          sceneCode += `            } else {\n`;
          sceneCode += `                digit1.set_visible(false);\n`;
          sceneCode += `                digit2.set_x(d2_x_one_digit);\n`;
          sceneCode += `            }\n`;
          sceneCode += `            update_digit_sprite(digit2, units);\n`;
          sceneCode += `        }\n`;
          sceneCode += `    };\n`;
          sceneCode += `    auto update_var_display_vertical = [&](bn::sprite_ptr& digit1, bn::sprite_ptr& digit2, int current_val, int& prev_val, int d1_y, int d2_y, int d2_y_one_digit) {\n`;
          sceneCode += `        if (current_val < 0) current_val = 0;\n`;
          sceneCode += `        if (current_val > 99) current_val = 99;\n`;
          sceneCode += `        if (current_val != prev_val) {\n`;
          sceneCode += `            prev_val = current_val;\n`;
          sceneCode += `            int tens = current_val / 10;\n`;
          sceneCode += `            int units = current_val % 10;\n`;
          sceneCode += `            if (tens > 0) {\n`;
          sceneCode += `                digit1.set_visible(true);\n`;
          sceneCode += `                update_digit_sprite(digit1, tens);\n`;
          sceneCode += `                digit2.set_y(d2_y);\n`;
          sceneCode += `            } else {\n`;
          sceneCode += `                digit1.set_visible(false);\n`;
          sceneCode += `                digit2.set_y(d2_y_one_digit);\n`;
          sceneCode += `            }\n`;
          sceneCode += `            update_digit_sprite(digit2, units);\n`;
          sceneCode += `        }\n`;
          sceneCode += `    };\n`;

          spriteLayouts.forEach((itemLayout, i) => {
            sceneCode += `    // HUD Item ${i}\n`;
            if (itemLayout.tile) {
              sceneCode += `    bn::sprite_ptr hud_item_${i}_tile_s = bn::sprite_items::hud_item_${i}_tile_sprite.create_sprite(${itemLayout.tile.x}, ${itemLayout.tile.y});\n`;
              sceneCode += `    hud_item_${i}_tile_s.set_palette(shared_sprite_palette);\n`;
              sceneCode += `    hud_item_${i}_tile_s.set_bg_priority(1);\n    hud_item_${i}_tile_s.set_z_order(-32767);\n`;
            }
            itemLayout.chars.forEach(char => {
              const spriteItemName = getCharSpriteItemName(char.char);
              if (spriteItemName) {
                sceneCode += `    bn::sprite_ptr hud_item_${i}_char_${char.charIdx}_s = bn::sprite_items::${spriteItemName}.create_sprite(${char.x}, ${char.y});\n`;
                sceneCode += `    hud_item_${i}_char_${char.charIdx}_s.set_palette(shared_sprite_palette);\n`;
                sceneCode += `    hud_item_${i}_char_${char.charIdx}_s.set_bg_priority(1);\n    hud_item_${i}_char_${char.charIdx}_s.set_z_order(-32767);\n`;
              }
            });
            itemLayout.vars.forEach(v => {
              if (hudSettings.verticalText) {
                sceneCode += `    bn::sprite_ptr hud_item_${i}_var_${v.varIdx}_digit1_s = bn::sprite_items::hud_0.create_sprite(${v.x}, ${v.d1_y});\n`;
                sceneCode += `    hud_item_${i}_var_${v.varIdx}_digit1_s.set_palette(shared_sprite_palette);\n`;
                sceneCode += `    hud_item_${i}_var_${v.varIdx}_digit1_s.set_bg_priority(1);\n    hud_item_${i}_var_${v.varIdx}_digit1_s.set_z_order(-32767);\n`;
                sceneCode += `    bn::sprite_ptr hud_item_${i}_var_${v.varIdx}_digit2_s = bn::sprite_items::hud_0.create_sprite(${v.x}, ${v.d2_y});\n`;
                sceneCode += `    hud_item_${i}_var_${v.varIdx}_digit2_s.set_palette(shared_sprite_palette);\n`;
                sceneCode += `    hud_item_${i}_var_${v.varIdx}_digit2_s.set_bg_priority(1);\n    hud_item_${i}_var_${v.varIdx}_digit2_s.set_z_order(-32767);\n`;
              } else {
                sceneCode += `    bn::sprite_ptr hud_item_${i}_var_${v.varIdx}_digit1_s = bn::sprite_items::hud_0.create_sprite(${v.d1_x}, ${v.y});\n`;
                sceneCode += `    hud_item_${i}_var_${v.varIdx}_digit1_s.set_palette(shared_sprite_palette);\n`;
                sceneCode += `    hud_item_${i}_var_${v.varIdx}_digit1_s.set_bg_priority(1);\n    hud_item_${i}_var_${v.varIdx}_digit1_s.set_z_order(-32767);\n`;
                sceneCode += `    bn::sprite_ptr hud_item_${i}_var_${v.varIdx}_digit2_s = bn::sprite_items::hud_0.create_sprite(${v.d2_x}, ${v.y});\n`;
                sceneCode += `    hud_item_${i}_var_${v.varIdx}_digit2_s.set_palette(shared_sprite_palette);\n`;
                sceneCode += `    hud_item_${i}_var_${v.varIdx}_digit2_s.set_bg_priority(1);\n    hud_item_${i}_var_${v.varIdx}_digit2_s.set_z_order(-32767);\n`;
              }
            });
          });
        } else {
          if (displayHealthInHud) {
            sceneCode += `    // HUD Health Display Sprites\n`;
            sceneCode += `    bn::sprite_ptr hud_heart_s = bn::sprite_items::hud_heart_sprite.create_sprite(${hudHIconX}, ${hudH_y});\n`;
            sceneCode += `    hud_heart_s.set_palette(shared_sprite_palette);\n`;
            sceneCode += `    hud_heart_s.set_bg_priority(1);\n    hud_heart_s.set_z_order(-32767);\n`;
            sceneCode += `    bn::sprite_ptr hud_x_s = bn::sprite_items::hud_x.create_sprite(${hudHXX}, ${hudH_y});\n`;
            sceneCode += `    hud_x_s.set_palette(shared_sprite_palette);\n`;
            sceneCode += `    hud_x_s.set_bg_priority(1);\n    hud_x_s.set_z_order(-32767);\n`;
            sceneCode += `    bn::sprite_ptr hud_digit1_s = bn::sprite_items::hud_0.create_sprite(${hudHD1X}, ${hudH_y});\n`;
            sceneCode += `    hud_digit1_s.set_palette(shared_sprite_palette);\n`;
            sceneCode += `    hud_digit1_s.set_bg_priority(1);\n    hud_digit1_s.set_z_order(-32767);\n`;
            sceneCode += `    bn::sprite_ptr hud_digit2_s = bn::sprite_items::hud_0.create_sprite(${hudHD2X}, ${hudH_y});\n`;
            sceneCode += `    hud_digit2_s.set_palette(shared_sprite_palette);\n`;
            sceneCode += `    hud_digit2_s.set_bg_priority(1);\n    hud_digit2_s.set_z_order(-32767);\n\n`;
          }

          if (displayBonusInHud) {
            sceneCode += `    // HUD Bonus Display Sprites\n`;
            sceneCode += `    bn::sprite_ptr hud_bonus_s = bn::sprite_items::hud_bonus_sprite.create_sprite(${hudBIconX}, ${hudB_y});\n`;
            sceneCode += `    hud_bonus_s.set_palette(shared_sprite_palette);\n`;
            sceneCode += `    hud_bonus_s.set_bg_priority(1);\n    hud_bonus_s.set_z_order(-32767);\n`;
            sceneCode += `    bn::sprite_ptr hud_bonus_x_s = bn::sprite_items::hud_x.create_sprite(${hudBXX}, ${hudB_y});\n`;
            sceneCode += `    hud_bonus_x_s.set_palette(shared_sprite_palette);\n`;
            sceneCode += `    hud_bonus_x_s.set_bg_priority(1);\n    hud_bonus_x_s.set_z_order(-32767);\n`;
            sceneCode += `    bn::sprite_ptr hud_bonus_digit1_s = bn::sprite_items::hud_0.create_sprite(${hudBD1X}, ${hudB_y});\n`;
            sceneCode += `    hud_bonus_digit1_s.set_palette(shared_sprite_palette);\n`;
            sceneCode += `    hud_bonus_digit1_s.set_bg_priority(1);\n    hud_bonus_digit1_s.set_z_order(-32767);\n`;
            sceneCode += `    bn::sprite_ptr hud_bonus_digit2_s = bn::sprite_items::hud_0.create_sprite(${hudBD2X}, ${hudB_y});\n`;
            sceneCode += `    hud_bonus_digit2_s.set_palette(shared_sprite_palette);\n`;
            sceneCode += `    hud_bonus_digit2_s.set_bg_priority(1);\n    hud_bonus_digit2_s.set_z_order(-32767);\n\n`;
          }
          if (bossActors.length > 0 && (displayHealthInHud || displayBonusInHud)) {
            sceneCode += `    // Boss HUD Display Sprites\n`;
            sceneCode += `    bn::sprite_ptr boss_hud_heart_s = bn::sprite_items::hud_heart_sprite.create_sprite(-50, ${hudH_y});\n`;
            sceneCode += `    boss_hud_heart_s.set_palette(shared_sprite_palette);\n`;
            sceneCode += `    boss_hud_heart_s.set_bg_priority(1);\n    boss_hud_heart_s.set_z_order(-32767);\n`;
            sceneCode += `    bn::sprite_ptr boss_hud_digit1_s = bn::sprite_items::hud_0.create_sprite(-40, ${hudH_y});\n`;
            sceneCode += `    boss_hud_digit1_s.set_palette(shared_sprite_palette);\n`;
            sceneCode += `    boss_hud_digit1_s.set_bg_priority(1);\n    boss_hud_digit1_s.set_z_order(-32767);\n`;
            sceneCode += `    bn::sprite_ptr boss_hud_digit2_s = bn::sprite_items::hud_0.create_sprite(-32, ${hudH_y});\n`;
            sceneCode += `    boss_hud_digit2_s.set_palette(shared_sprite_palette);\n`;
            sceneCode += `    boss_hud_digit2_s.set_bg_priority(1);\n    boss_hud_digit2_s.set_z_order(-32767);\n`;
          }
        }
        sceneCode += musicPlayCode;

        if ((scene.type === 'SHMUP' || scene.type === 'BEATEMUP') && scene.autoScroll !== false) {
          const initCamX = playerIdx !== -1 ? `actor_${playerIdx}_x - ${Math.floor(sDims.w / 2)} + ${Math.floor(sActors[playerIdx].width / 2)}` : '0';
          const initCamY = playerIdx !== -1 ? `actor_${playerIdx}_y - ${Math.floor(sDims.h / 2)} + ${Math.floor(sActors[playerIdx].height / 2)}` : '0';
          sceneCode += `    bn::fixed scroll_cam_x = ${initCamX};\n`;
          sceneCode += `    bn::fixed scroll_cam_y = ${initCamY};\n`;
          sceneCode += `    bn::fixed current_scroll_speed_x = bn::fixed(${scene.scrollSpeedX ?? 0});\n`;
          sceneCode += `    bn::fixed current_scroll_speed_y = bn::fixed(${scene.scrollSpeedY ?? 0});\n`;
          sceneCode += `    cam_x = scroll_cam_x.integer();\n`;
          sceneCode += `    cam_y = scroll_cam_y.integer();\n`;
          sceneCode += `    camera.set_x(cam_x);\n    camera.set_y(cam_y);\n`;
        } else if (playerIdx !== -1) {
          sceneCode += `    cam_x = actor_${playerIdx}_x - ${Math.floor(sDims.w / 2)} + ${Math.floor(sActors[playerIdx].width / 2)};\n`;
          sceneCode += `    cam_y = actor_${playerIdx}_y - ${Math.floor(sDims.h / 2)} + ${Math.floor(sActors[playerIdx].height / 2)};\n`;
          sceneCode += `    camera.set_x(cam_x);\n    camera.set_y(cam_y);\n`;
        }

        let sceneStartScriptCode = '';
        if (scene.startScriptId) {
          const customScriptObj = customScripts.find(cs => cs && String(cs.id) === String(scene.startScriptId));
          if (customScriptObj && customScriptObj.script) {
            let startScript = generateScriptLogic(customScriptObj.script, -1, 0, 0, undefined, undefined, scCtx);
            if (startScript) {
              sceneStartScriptCode += `    // Scene Start Script (Custom Script: ${customScriptObj.name || 'unnamed'})\n`;
              sceneStartScriptCode += startScript;
            }
          }
        } else if (scene.script) {
          let startScript = generateScriptLogic(scene.script, -1, 0, 0, undefined, undefined, scCtx);
          if (startScript) {
            sceneStartScriptCode += `    // Scene Start Script\n`;
            sceneStartScriptCode += startScript;
          }
        }
        sceneCode += sceneStartScriptCode;

        if (hudSettings && hudSettings.enabled && scene.type !== 'INTRO' && scene.type !== 'PAUSE') {
          spriteLayouts.forEach((itemLayout, i) => {
            itemLayout.vars.forEach(v => {
              sceneCode += `    int hud_item_${i}_var_${v.varIdx}_prev = -1;\n`;
            });
          });
        } else if (scene.type !== 'INTRO' && scene.type !== 'PAUSE') {
          if (displayHealthInHud) {
            sceneCode += `    int prev_hp = -1;\n`;
          }
          if (displayBonusInHud) {
            sceneCode += `    int prev_bonus = -1;\n`;
          }
          if (bossActors.length > 0 && (displayHealthInHud || displayBonusInHud)) {
            sceneCode += `    int prev_boss_hp = -1;\n`;
          }
        }

        if (scene.type === 'RACING') {
          sceneCode += `    bool _countdown_done = ${scene.showCountdown ? 'false' : 'true'};\n`;
          sceneCode += `    int _race_time_frames = 0;\n`;
          sceneCode += `    int _lap_time_frames = 0;\n`;
          sceneCode += `    int _best_lap_frames = -1;\n`;
          sceneCode += `    int _laps_completed = 0;\n`;
          sceneCode += `    bool _race_finished = false;\n`;
        }

        sceneCode += `    while(true) {\n`;
        sceneCode += `        cur_held_up = key_held_up; if (bn::keypad::up_held()) key_held_up++; else key_held_up = 0;\n`;
        sceneCode += `        cur_held_down = key_held_down; if (bn::keypad::down_held()) key_held_down++; else key_held_down = 0;\n`;
        sceneCode += `        cur_held_left = key_held_left; if (bn::keypad::left_held()) key_held_left++; else key_held_left = 0;\n`;
        sceneCode += `        cur_held_right = key_held_right; if (bn::keypad::right_held()) key_held_right++; else key_held_right = 0;\n`;
        sceneCode += `        cur_held_a = key_held_a; if (bn::keypad::a_held()) key_held_a++; else key_held_a = 0;\n`;
        sceneCode += `        cur_held_b = key_held_b; if (bn::keypad::b_held()) key_held_b++; else key_held_b = 0;\n`;
        sceneCode += `        cur_held_l = key_held_l; if (bn::keypad::l_held()) key_held_l++; else key_held_l = 0;\n`;
        sceneCode += `        cur_held_r = key_held_r; if (bn::keypad::r_held()) key_held_r++; else key_held_r = 0;\n`;
        sceneCode += `        cur_held_start = key_held_start; if (bn::keypad::start_held()) key_held_start++; else key_held_start = 0;\n`;
        sceneCode += `        cur_held_select = key_held_select; if (bn::keypad::select_held()) key_held_select++; else key_held_select = 0;\n`;
        sceneCode += `        if (timer_1_frames > 0) timer_1_frames--;\n`;
        sceneCode += `        if (timer_2_frames > 0) timer_2_frames--;\n`;
        sceneCode += `        if (timer_3_frames > 0) timer_3_frames--;\n`;
        sceneCode += `        if (timer_4_frames > 0) timer_4_frames--;\n`;
        if (scene.type === 'RACING' && scene.showCountdown) {
          sceneCode += `        if (!_countdown_done) {\n`;
          sceneCode += `            _countdown_done = true;\n`;
          sceneCode += `            for (int cd_digit = 3; cd_digit >= 1; --cd_digit) {\n`;
          sceneCode += `                bn::sprite_ptr cd_sprite = (cd_digit == 3) ? bn::sprite_items::countdown_3_sprite.create_sprite(0, 0) :\n`;
          sceneCode += `                                           ((cd_digit == 2) ? bn::sprite_items::countdown_2_sprite.create_sprite(0, 0) :\n`;
          sceneCode += `                                                             bn::sprite_items::countdown_1_sprite.create_sprite(0, 0));\n`;
          sceneCode += `                cd_sprite.set_bg_priority(0);\n`;
          sceneCode += `                cd_sprite.set_z_order(32767);\n`;
          sceneCode += `                for (int cd_frame = 0; cd_frame < 60; ++cd_frame) {\n`;
          if (scene.mode7) {
            sceneCode += `                    update_m7_hbe();\n`;
          }
          sceneCode += `                    bn::core::update();\n`;
          sceneCode += `                }\n`;
          sceneCode += `                cd_sprite.set_visible(false);\n`;
          sceneCode += `            }\n`;
          sceneCode += `        }\n`;
        }
        // Add pause toggle logic for non-INTRO/PAUSE scenes
        if (pauseScene && scene.type !== 'INTRO' && scene.type !== 'PAUSE') {
          sceneCode += `        if (bn::keypad::start_pressed()) {\n`;
          sceneCode += `            _paused = !_paused;\n`;
          sceneCode += `            if (_paused) {\n`;
          sceneCode += `                pause_overlay = bn::regular_bg_items::pause_overlay_bg.create_bg(0, 0);\n`;
          sceneCode += `                pause_overlay->set_priority(0);\n`;
          sceneCode += `            } else {\n`;
          sceneCode += `                pause_overlay.reset();\n`;
          sceneCode += `            }\n`;
          sceneCode += `        }\n`;
          sceneCode += `        if (_paused) {\n`;
          sceneCode += `            bn::core::update();\n`;
          sceneCode += `            continue;\n`;
          sceneCode += `        }\n`;
        }
        if (scene.type === 'POINTNCLICK') {
          sceneCode += `        bool is_hovering = false;\n`;
        }
        if ((scene.type === 'SHMUP' || scene.type === 'BEATEMUP') && scene.autoScroll !== false) {
          sceneCode += `        if (!camera_custom_control) {\n`;
          if (playerIdx !== -1) {
            sceneCode += `            bn::fixed prev_scroll_cam_x = scroll_cam_x;\n`;
            sceneCode += `            bn::fixed prev_scroll_cam_y = scroll_cam_y;\n`;
          }
          sceneCode += `            scroll_cam_x += current_scroll_speed_x;\n`;
          sceneCode += `            scroll_cam_y += current_scroll_speed_y;\n`;
          sceneCode += `            if (scroll_cam_x < -${Math.max(0, Math.floor((sDims.w - 240) / 2))}) scroll_cam_x = -${Math.max(0, Math.floor((sDims.w - 240) / 2))};\n`;
          sceneCode += `            if (scroll_cam_x > ${Math.max(0, Math.floor((sDims.w - 240) / 2))}) scroll_cam_x = ${Math.max(0, Math.floor((sDims.w - 240) / 2))};\n`;
          sceneCode += `            if (scroll_cam_y < -${Math.max(0, Math.floor((sDims.h - 160) / 2))}) scroll_cam_y = -${Math.max(0, Math.floor((sDims.h - 160) / 2))};\n`;
          sceneCode += `            if (scroll_cam_y > ${Math.max(0, Math.floor((sDims.h - 160) / 2))}) scroll_cam_y = ${Math.max(0, Math.floor((sDims.h - 160) / 2))};\n`;
          sceneCode += `            cam_x = scroll_cam_x.integer();\n`;
          sceneCode += `            cam_y = scroll_cam_y.integer();\n`;
          sceneCode += `            camera.set_x(cam_x);\n            camera.set_y(cam_y);\n`;
          if (playerIdx !== -1) {
            sceneCode += `            actor_${playerIdx}_float_x += (scroll_cam_x - prev_scroll_cam_x);\n`;
            sceneCode += `            actor_${playerIdx}_float_y += (scroll_cam_y - prev_scroll_cam_y);\n`;
            sceneCode += `            // Clamp player to screen bounds\n`;
            sceneCode += `            {\n`;
            sceneCode += `                bn::fixed _min_sx = scroll_cam_x + ${Math.floor(sDims.w / 2)} - 120;\n`;
            sceneCode += `                bn::fixed _max_sx = scroll_cam_x + ${Math.floor(sDims.w / 2)} + 120 - ${sActors[playerIdx].width};\n`;
            sceneCode += `                bn::fixed _min_sy = scroll_cam_y + ${Math.floor(sDims.h / 2)} - 80;\n`;
            sceneCode += `                bn::fixed _max_sy = scroll_cam_y + ${Math.floor(sDims.h / 2)} + 80 - ${sActors[playerIdx].height};\n`;
            sceneCode += `                if (actor_${playerIdx}_float_x < _min_sx) actor_${playerIdx}_float_x = _min_sx;\n`;
            sceneCode += `                if (actor_${playerIdx}_float_x > _max_sx) actor_${playerIdx}_float_x = _max_sx;\n`;
            sceneCode += `                if (actor_${playerIdx}_float_y < _min_sy) actor_${playerIdx}_float_y = _min_sy;\n`;
            sceneCode += `                if (actor_${playerIdx}_float_y > _max_sy) actor_${playerIdx}_float_y = _max_sy;\n`;
            sceneCode += `            }\n`;
          }
          sceneCode += `        }\n`;
        }

        if (scene.type === 'SHMUP' && scene.mode7) {
          // Handled inside actor control loop
        }

        let globalScriptCode = generateScriptLogic(globalScript, -1, 0, 0, undefined, undefined, scCtx);
        if (globalScriptCode) {
          sceneCode += `        // --- Global Script ---\n`;
          sceneCode += globalScriptCode;
        }

        sceneCode += actorLogicCode;
        sceneCode += triggerLogicCode;
        sceneCode += postTriggerCode;

        if (playerIdx !== -1) {
          const playerActor = sActors[playerIdx];
          const spawnX = playerActor.useVarX && playerActor.varX ? `(${playerActor.varX.replace(/[^a-zA-Z0-9_]/g, '_')} * 8)` : playerActor.x;
          const spawnY = playerActor.useVarY && playerActor.varY ? `(${playerActor.varY.replace(/[^a-zA-Z0-9_]/g, '_')} * 8)` : playerActor.y;
          
          sceneCode += `        // Player health zero/death check\n`;
          sceneCode += `        if (actor_${playerIdx}_active && actor_${playerIdx}_hp <= 0) {\n`;
          
          let deathScriptCompiled = '';
          if (playerActor.playerDeathScriptId) {
            const deathScriptObj = customScripts.find(cs => cs && Number(cs.id) === Number(playerActor.playerDeathScriptId));
            if (deathScriptObj) {
              deathScriptCompiled = generateScriptLogic(deathScriptObj.script, playerIdx, playerActor.width, playerActor.height, undefined, undefined, scCtx);
            }
          }
          if (deathScriptCompiled) {
            sceneCode += deathScriptCompiled;
          }
          
          sceneCode += `            actor_${playerIdx}_float_x = global_spawn_x != -1 ? global_spawn_x : ${spawnX};\n`;
          sceneCode += `            actor_${playerIdx}_float_y = global_spawn_y != -1 ? global_spawn_y : ${spawnY};\n`;
          sceneCode += `            actor_${playerIdx}_dx = 0;\n`;
          sceneCode += `            actor_${playerIdx}_dy = 0;\n`;
          sceneCode += `            actor_${playerIdx}_hp = actor_${playerIdx}_max_hp;\n`;
          sceneCode += `        }\n`;
        }
        sceneCode += `        for(int p=0; p<20; ++p) {\n`;
        sceneCode += `            if(proj_active[p]) {\n`;
        sceneCode += `                if(proj_bouncing[p]) {\n`;
        sceneCode += `                    proj_dy[p] += 0.20;\n`;
        sceneCode += `                    if(proj_dy[p] > 4) proj_dy[p] = 4;\n`;
        sceneCode += `                    bn::fixed next_px = proj_x[p] + proj_dx[p];\n`;
        sceneCode += `                    if(check_solid_collision(next_px, bn::fixed(proj_y[p]), -4, -4, 8, 8)) {\n`;
        sceneCode += `                        proj_dx[p] = -proj_dx[p];\n`;
        sceneCode += `                        proj_bounce_count[p]++;\n`;
        sceneCode += `                    } else {\n`;
        sceneCode += `                        proj_x[p] = next_px.integer();\n`;
        sceneCode += `                    }\n`;
        sceneCode += `                    bn::fixed next_py = proj_y[p] + proj_dy[p];\n`;
        sceneCode += `                    if(check_solid_collision(bn::fixed(proj_x[p]), next_py, -4, -4, 8, 8)) {\n`;
        sceneCode += `                        if(proj_dy[p] > 0) {\n`;
        sceneCode += `                            proj_dy[p] = -3.0;\n`;
        sceneCode += `                        } else {\n`;
        sceneCode += `                            proj_dy[p] = 0.5;\n`;
        sceneCode += `                        }\n`;
        sceneCode += `                        proj_bounce_count[p]++;\n`;
        sceneCode += `                    } else {\n`;
        sceneCode += `                        proj_y[p] = next_py.integer();\n`;
        sceneCode += `                    }\n`;
        sceneCode += `                    if(proj_bounce_count[p] >= 3) {\n`;
        sceneCode += `                        proj_active[p] = false;\n`;
        sceneCode += `                        proj_sprites[p].reset();\n`;
        sceneCode += `                    }\n`;
        sceneCode += `                } else {\n`;
        sceneCode += `                    proj_x[p] += proj_dx[p].integer();\n`;
        sceneCode += `                    proj_y[p] += proj_dy[p].integer();\n`;
        sceneCode += `                }\n`;
        sceneCode += `                if(proj_x[p] < -50 || proj_x[p] > ${sDims.w} + 50 || proj_y[p] < -50 || proj_y[p] > ${sDims.h} + 50) {\n`;
        sceneCode += `                    proj_active[p] = false;\n                    proj_sprites[p].reset();\n`;
        sceneCode += `                } else {\n`;
        sceneCode += `                    proj_sprites[p]->set_x(proj_x[p] - ${Math.floor(sDims.w / 2)});\n`;
        sceneCode += `                    proj_sprites[p]->set_y(proj_y[p] - ${Math.floor(sDims.h / 2)});\n`;
        sceneCode += `                }\n            }\n        }\n`;

        if (_hasGrenades) {
          sceneCode += `        for(int g=0; g<5; ++g) {\n`;
          sceneCode += `            if(grenade_active[g]) {\n`;
          sceneCode += `                grenade_x[g] += grenade_dx[g].integer();\n`;
          sceneCode += `                grenade_dy[g] += bn::fixed(0.15);\n`;
          sceneCode += `                grenade_y[g] += grenade_dy[g].integer();\n`;
          sceneCode += `                grenade_timer[g]--;\n`;
          sceneCode += `                if(grenade_timer[g] <= 0 || grenade_y[g] > ${sDims.h} + 20) {\n`;
          sceneCode += `                    grenade_active[g] = false;\n`;
          sceneCode += `                    grenade_sprites[g].reset();\n`;
          // Explosion damage to enemies
          const enemyActors = sActors.filter(act => act.type === 'enemy');
          if (enemyActors.length > 0) {
            enemyActors.forEach(enemy => {
              const enemyIdx = sActors.indexOf(enemy);
              const blastRadius = 32;
              sceneCode += `                        {\n`;
              sceneCode += `                            int edx = actor_${enemyIdx}_x + ${Math.floor((enemy.width || 16) / 2)} - grenade_x[g];\n`;
              sceneCode += `                            int edy = actor_${enemyIdx}_y + ${Math.floor((enemy.height || 16) / 2)} - grenade_y[g];\n`;
              sceneCode += `                            int dist_sq = edx*edx + edy*edy;\n`;
              sceneCode += `                            if (dist_sq < ${blastRadius * blastRadius} && actor_${enemyIdx}_active) {\n`;
              sceneCode += `                                actor_${enemyIdx}_hp--;\n`;
              sceneCode += `                                if (actor_${enemyIdx}_hp <= 0) {\n`;
              sceneCode += `                                    actor_${enemyIdx}_active = false;\n`;
              sceneCode += `                                    actor_${enemyIdx}_sprite.set_visible(false);\n`;
              sceneCode += `                                }\n`;
              sceneCode += `                            }\n`;
              sceneCode += `                        }\n`;
            });
          }
          sceneCode += `                } else {\n`;
          sceneCode += `                    grenade_sprites[g]->set_x(grenade_x[g] - ${Math.floor(sDims.w / 2)});\n`;
          sceneCode += `                    grenade_sprites[g]->set_y(grenade_y[g] - ${Math.floor(sDims.h / 2)});\n`;
          sceneCode += `                }\n`;
          sceneCode += `            }\n`;
          sceneCode += `        }\n`;
        }

        if (playerIdx !== -1 && ((scene.type !== 'SHMUP' && scene.type !== 'BEATEMUP') || scene.autoScroll === false || scene.mode7)) {
          sceneCode += `        if (!camera_custom_control) {\n`;
          if ((scene.type === 'RACING' || scene.type === 'SHMUP') && scene.mode7) {
            sceneCode += `            cam_x = actor_${playerIdx}_x - ${Math.floor(sDims.w / 2)} + ${Math.floor(sActors[playerIdx].width / 2)};\n`;
            sceneCode += `            cam_y = actor_${playerIdx}_y - ${Math.floor(sDims.h / 2)} + ${Math.floor(sActors[playerIdx].height / 2)};\n`;
          } else {
            sceneCode += `            cam_x = actor_${playerIdx}_x - ${Math.floor(sDims.w / 2)} + ${Math.floor(sActors[playerIdx].width / 2)};\n`;
            sceneCode += `            cam_y = actor_${playerIdx}_y - ${Math.floor(sDims.h / 2)} + ${Math.floor(sActors[playerIdx].height / 2)};\n`;
            sceneCode += `            if (cam_x < -${Math.max(0, Math.floor((sDims.w - 240) / 2))}) cam_x = -${Math.max(0, Math.floor((sDims.w - 240) / 2))};\n`;
            sceneCode += `            if (cam_x > ${Math.max(0, Math.floor((sDims.w - 240) / 2))}) cam_x = ${Math.max(0, Math.floor((sDims.w - 240) / 2))};\n`;
            sceneCode += `            if (cam_y < -${Math.max(0, Math.floor((sDims.h - 160) / 2))}) cam_y = -${Math.max(0, Math.floor((sDims.h - 160) / 2))};\n`;
            sceneCode += `            if (cam_y > ${Math.max(0, Math.floor((sDims.h - 160) / 2))}) cam_y = ${Math.max(0, Math.floor((sDims.h - 160) / 2))};\n`;
          }
          sceneCode += `            camera.set_x(cam_x);\n            camera.set_y(cam_y);\n`;
          sceneCode += `        }\n`;
        }

        if ((scene.type === 'RACING' || scene.type === 'SHMUP') && scene.mode7) {
          sceneCode += `        update_m7_hbe();\n`;
          sceneCode += `        m7_pa_hbe.reload_values_ref();\n`;
          sceneCode += `        m7_pc_hbe.reload_values_ref();\n`;
          sceneCode += `        m7_dx_hbe.reload_values_ref();\n`;
          sceneCode += `        m7_dy_hbe.reload_values_ref();\n`;
        }

        sceneCode += `        if (camera_custom_control) {\n`;
        sceneCode += `            bn::fixed current_cx = camera.x();\n`;
        sceneCode += `            bn::fixed current_cy = camera.y();\n`;
        sceneCode += `            if (camera_instant) {\n`;
        sceneCode += `                current_cx = camera_target_x;\n`;
        sceneCode += `                current_cy = camera_target_y;\n`;
        sceneCode += `            } else {\n`;
        sceneCode += `                bn::fixed dx = camera_target_x - current_cx;\n`;
        sceneCode += `                bn::fixed dy = camera_target_y - current_cy;\n`;
        sceneCode += `                bn::fixed dist = bn::sqrt((dx * dx) + (dy * dy));\n`;
        sceneCode += `                if (dist > 0) {\n`;
        sceneCode += `                    if (dist <= camera_speed) {\n`;
        sceneCode += `                        current_cx = camera_target_x;\n`;
        sceneCode += `                        current_cy = camera_target_y;\n`;
        sceneCode += `                    } else {\n`;
        sceneCode += `                        current_cx += (dx / dist) * camera_speed;\n`;
        sceneCode += `                        current_cy += (dy / dist) * camera_speed;\n`;
        sceneCode += `                    }\n`;
        sceneCode += `                } else {\n`;
        sceneCode += `                    current_cx = camera_target_x;\n`;
        sceneCode += `                    current_cy = camera_target_y;\n`;
        sceneCode += `                }\n`;
        sceneCode += `            }\n`;
        sceneCode += `            bn::fixed half_w = ${Math.max(0, Math.floor((sDims.w - 240) / 2))};\n`;
        sceneCode += `            bn::fixed half_h = ${Math.max(0, Math.floor((sDims.h - 160) / 2))};\n`;
        sceneCode += `            if (current_cx < -half_w) current_cx = -half_w;\n`;
        sceneCode += `            if (current_cx > half_w) current_cx = half_w;\n`;
        sceneCode += `            if (current_cy < -half_h) current_cy = -half_h;\n`;
        sceneCode += `            if (current_cy > half_h) current_cy = half_h;\n`;
        sceneCode += `            cam_x = current_cx.integer();\n`;
        sceneCode += `            cam_y = current_cy.integer();\n`;
        sceneCode += `            camera.set_x(cam_x);\n`;
        sceneCode += `            camera.set_y(cam_y);\n`;
        if ((scene.type === 'SHMUP' || scene.type === 'BEATEMUP') && scene.autoScroll !== false) {
          sceneCode += `            scroll_cam_x = current_cx;\n`;
          sceneCode += `            scroll_cam_y = current_cy;\n`;
        }
        sceneCode += `        }\n`;

        sceneCode += bgLogic;

        if (hudSettings && hudSettings.enabled && scene.type !== 'INTRO' && scene.type !== 'PAUSE') {
          sceneCode += `        // Update Unified HUD\n`;
          spriteLayouts.forEach((itemLayout, i) => {
            itemLayout.vars.forEach(v => {
              const varNameUpper = v.name.toUpperCase();
              let cppCurrentVal;
              if (varNameUpper === 'HP' || varNameUpper === 'HEALTH' || varNameUpper === 'PLAYER_HP') {
                cppCurrentVal = playerIdx !== -1 ? `actor_${playerIdx}_hp` : '0';
              } else if (varNameUpper === 'BONUS' || varNameUpper === 'COINS' || varNameUpper === 'PLAYER_BONUS') {
                cppCurrentVal = playerIdx !== -1 ? `actor_${playerIdx}_bonus` : '0';
              } else {
                const safeVarName = v.name.replace(/[^a-zA-Z0-9_]/g, '_');
                const varExists = variables.some(valObj => valObj.name.replace(/[^a-zA-Z0-9_]/g, '_') === safeVarName);
                cppCurrentVal = varExists ? safeVarName : '0';
              }
              if (hudSettings.verticalText) {
                sceneCode += `        update_var_display_vertical(hud_item_${i}_var_${v.varIdx}_digit1_s, hud_item_${i}_var_${v.varIdx}_digit2_s, ${cppCurrentVal}, hud_item_${i}_var_${v.varIdx}_prev, ${v.d1_y}, ${v.d2_y}, ${v.d2_y_single});\n`;
              } else {
                sceneCode += `        update_var_display(hud_item_${i}_var_${v.varIdx}_digit1_s, hud_item_${i}_var_${v.varIdx}_digit2_s, ${cppCurrentVal}, hud_item_${i}_var_${v.varIdx}_prev, ${v.d1_x}, ${v.d2_x}, ${v.d2_x_single});\n`;
              }
            });
          });
        } else if (scene.type !== 'INTRO' && scene.type !== 'PAUSE') {
          if (displayHealthInHud && playerIdx !== -1) {
            sceneCode += `        // Update HUD Health display\n`;
            sceneCode += `        {\n`;
            sceneCode += `            int current_hp = actor_${playerIdx}_hp;\n`;
            sceneCode += `            if (current_hp < 0) current_hp = 0;\n`;
            sceneCode += `            if (current_hp > 99) current_hp = 99;\n`;
            sceneCode += `            if (current_hp != prev_hp) {\n`;
            sceneCode += `                prev_hp = current_hp;\n`;
            sceneCode += `                int tens = current_hp / 10;\n`;
            sceneCode += `                int units = current_hp % 10;\n`;
            sceneCode += `                if (tens > 0) {\n`;
            sceneCode += `                    hud_digit1_s.set_visible(true);\n`;
            sceneCode += `                    if (tens == 1) hud_digit1_s.set_item(bn::sprite_items::hud_1);\n`;
            sceneCode += `                    else if (tens == 2) hud_digit1_s.set_item(bn::sprite_items::hud_2);\n`;
            sceneCode += `                    else if (tens == 3) hud_digit1_s.set_item(bn::sprite_items::hud_3);\n`;
            sceneCode += `                    else if (tens == 4) hud_digit1_s.set_item(bn::sprite_items::hud_4);\n`;
            sceneCode += `                    else if (tens == 5) hud_digit1_s.set_item(bn::sprite_items::hud_5);\n`;
            sceneCode += `                    else if (tens == 6) hud_digit1_s.set_item(bn::sprite_items::hud_6);\n`;
            sceneCode += `                    else if (tens == 7) hud_digit1_s.set_item(bn::sprite_items::hud_7);\n`;
            sceneCode += `                    else if (tens == 8) hud_digit1_s.set_item(bn::sprite_items::hud_8);\n`;
            sceneCode += `                    else if (tens == 9) hud_digit1_s.set_item(bn::sprite_items::hud_9);\n`;
            sceneCode += `                    hud_digit2_s.set_x(${hudHD2X});\n`;
            sceneCode += `                } else {\n`;
            sceneCode += `                    hud_digit1_s.set_visible(false);\n`;
            sceneCode += `                    hud_digit2_s.set_x(${hudHD2XOneDigit});\n`;
            sceneCode += `                }\n`;
            sceneCode += `                if (units == 0) hud_digit2_s.set_item(bn::sprite_items::hud_0);\n`;
            sceneCode += `                else if (units == 1) hud_digit2_s.set_item(bn::sprite_items::hud_1);\n`;
            sceneCode += `                else if (units == 2) hud_digit2_s.set_item(bn::sprite_items::hud_2);\n`;
            sceneCode += `                else if (units == 3) hud_digit2_s.set_item(bn::sprite_items::hud_3);\n`;
            sceneCode += `                else if (units == 4) hud_digit2_s.set_item(bn::sprite_items::hud_4);\n`;
            sceneCode += `                else if (units == 5) hud_digit2_s.set_item(bn::sprite_items::hud_5);\n`;
            sceneCode += `                else if (units == 6) hud_digit2_s.set_item(bn::sprite_items::hud_6);\n`;
            sceneCode += `                else if (units == 7) hud_digit2_s.set_item(bn::sprite_items::hud_7);\n`;
            sceneCode += `                else if (units == 8) hud_digit2_s.set_item(bn::sprite_items::hud_8);\n`;
            sceneCode += `                else if (units == 9) hud_digit2_s.set_item(bn::sprite_items::hud_9);\n`;
            sceneCode += `                hud_digit1_s.set_palette(shared_sprite_palette);\n`;
            sceneCode += `                hud_digit2_s.set_palette(shared_sprite_palette);\n`;
            sceneCode += `            }\n`;
            sceneCode += `        }\n`;
          }

          if (displayBonusInHud && playerIdx !== -1) {
            sceneCode += `        // Update HUD Bonus display\n`;
            sceneCode += `        {\n`;
            sceneCode += `            int current_bonus = actor_${playerIdx}_bonus;\n`;
            sceneCode += `            if (current_bonus < 0) current_bonus = 0;\n`;
            sceneCode += `            if (current_bonus > 99) current_bonus = 99;\n`;
            sceneCode += `            if (current_bonus != prev_bonus) {\n`;
            sceneCode += `                prev_bonus = current_bonus;\n`;
            sceneCode += `                int tens = current_bonus / 10;\n`;
            sceneCode += `                int units = current_bonus % 10;\n`;
            sceneCode += `                if (tens > 0) {\n`;
            sceneCode += `                    hud_bonus_digit1_s.set_visible(true);\n`;
            sceneCode += `                    if (tens == 1) hud_bonus_digit1_s.set_item(bn::sprite_items::hud_1);\n`;
            sceneCode += `                    else if (tens == 2) hud_bonus_digit1_s.set_item(bn::sprite_items::hud_2);\n`;
            sceneCode += `                    else if (tens == 3) hud_bonus_digit1_s.set_item(bn::sprite_items::hud_3);\n`;
            sceneCode += `                    else if (tens == 4) hud_bonus_digit1_s.set_item(bn::sprite_items::hud_4);\n`;
            sceneCode += `                    else if (tens == 5) hud_bonus_digit1_s.set_item(bn::sprite_items::hud_5);\n`;
            sceneCode += `                    else if (tens == 6) hud_bonus_digit1_s.set_item(bn::sprite_items::hud_6);\n`;
            sceneCode += `                    else if (tens == 7) hud_bonus_digit1_s.set_item(bn::sprite_items::hud_7);\n`;
            sceneCode += `                    else if (tens == 8) hud_bonus_digit1_s.set_item(bn::sprite_items::hud_8);\n`;
            sceneCode += `                    else if (tens == 9) hud_bonus_digit1_s.set_item(bn::sprite_items::hud_9);\n`;
            sceneCode += `                    hud_bonus_digit2_s.set_x(${hudBD2X});\n`;
            sceneCode += `                } else {\n`;
            sceneCode += `                    hud_bonus_digit1_s.set_visible(false);\n`;
            sceneCode += `                    hud_bonus_digit2_s.set_x(${hudBD2XOneDigit});\n`;
            sceneCode += `                }\n`;
            sceneCode += `                if (units == 0) hud_bonus_digit2_s.set_item(bn::sprite_items::hud_0);\n`;
            sceneCode += `                else if (units == 1) hud_bonus_digit2_s.set_item(bn::sprite_items::hud_1);\n`;
            sceneCode += `                else if (units == 2) hud_bonus_digit2_s.set_item(bn::sprite_items::hud_2);\n`;
            sceneCode += `                else if (units == 3) hud_bonus_digit2_s.set_item(bn::sprite_items::hud_3);\n`;
            sceneCode += `                else if (units == 4) hud_bonus_digit2_s.set_item(bn::sprite_items::hud_4);\n`;
            sceneCode += `                else if (units == 5) hud_bonus_digit2_s.set_item(bn::sprite_items::hud_5);\n`;
            sceneCode += `                else if (units == 6) hud_bonus_digit2_s.set_item(bn::sprite_items::hud_6);\n`;
            sceneCode += `                else if (units == 7) hud_bonus_digit2_s.set_item(bn::sprite_items::hud_7);\n`;
            sceneCode += `                else if (units == 8) hud_bonus_digit2_s.set_item(bn::sprite_items::hud_8);\n`;
            sceneCode += `                else if (units == 9) hud_bonus_digit2_s.set_item(bn::sprite_items::hud_9);\n`;
            sceneCode += `                hud_bonus_digit1_s.set_palette(shared_sprite_palette);\n`;
            sceneCode += `                hud_bonus_digit2_s.set_palette(shared_sprite_palette);\n`;
            sceneCode += `            }\n`;
            sceneCode += `        }\n`;
          }

          if (bossActors.length > 0 && (displayHealthInHud || displayBonusInHud)) {
            sceneCode += `        // Update Boss HUD display\n`;
            sceneCode += `        {\n`;
            sceneCode += `            int boss_hp = -1;\n`;
            bossActors.forEach((boss) => {
              const bossIdx = sActors.indexOf(boss);
              sceneCode += `            if (actor_${bossIdx}_active) boss_hp = actor_${bossIdx}_hp;\n`;
            });
            sceneCode += `            if (boss_hp >= 0) {\n`;
            sceneCode += `                boss_hud_heart_s.set_visible(true);\n`;
            sceneCode += `                if (boss_hp != prev_boss_hp) {\n`;
            sceneCode += `                    prev_boss_hp = boss_hp;\n`;
            sceneCode += `                    if (boss_hp > 99) boss_hp = 99;\n`;
            sceneCode += `                    int tens = boss_hp / 10;\n`;
            sceneCode += `                    int units = boss_hp % 10;\n`;
            sceneCode += `                    if (tens > 0) {\n`;
            sceneCode += `                        boss_hud_digit1_s.set_visible(true);\n`;
            sceneCode += `                        if (tens == 1) boss_hud_digit1_s.set_item(bn::sprite_items::hud_1);\n`;
            sceneCode += `                        else if (tens == 2) boss_hud_digit1_s.set_item(bn::sprite_items::hud_2);\n`;
            sceneCode += `                        else if (tens == 3) boss_hud_digit1_s.set_item(bn::sprite_items::hud_3);\n`;
            sceneCode += `                        else if (tens == 4) boss_hud_digit1_s.set_item(bn::sprite_items::hud_4);\n`;
            sceneCode += `                        else if (tens == 5) boss_hud_digit1_s.set_item(bn::sprite_items::hud_5);\n`;
            sceneCode += `                        else if (tens == 6) boss_hud_digit1_s.set_item(bn::sprite_items::hud_6);\n`;
            sceneCode += `                        else if (tens == 7) boss_hud_digit1_s.set_item(bn::sprite_items::hud_7);\n`;
            sceneCode += `                        else if (tens == 8) boss_hud_digit1_s.set_item(bn::sprite_items::hud_8);\n`;
            sceneCode += `                        else if (tens == 9) boss_hud_digit1_s.set_item(bn::sprite_items::hud_9);\n`;
            sceneCode += `                        boss_hud_digit2_s.set_x(-32);\n`;
            sceneCode += `                    } else {\n`;
            sceneCode += `                        boss_hud_digit1_s.set_visible(false);\n`;
            sceneCode += `                        boss_hud_digit2_s.set_x(-40);\n`;
            sceneCode += `                    }\n`;
            sceneCode += `                    if (units == 0) boss_hud_digit2_s.set_item(bn::sprite_items::hud_0);\n`;
            sceneCode += `                    else if (units == 1) boss_hud_digit2_s.set_item(bn::sprite_items::hud_1);\n`;
            sceneCode += `                    else if (units == 2) boss_hud_digit2_s.set_item(bn::sprite_items::hud_2);\n`;
            sceneCode += `                    else if (units == 3) boss_hud_digit2_s.set_item(bn::sprite_items::hud_3);\n`;
            sceneCode += `                    else if (units == 4) boss_hud_digit2_s.set_item(bn::sprite_items::hud_4);\n`;
            sceneCode += `                    else if (units == 5) boss_hud_digit2_s.set_item(bn::sprite_items::hud_5);\n`;
            sceneCode += `                    else if (units == 6) boss_hud_digit2_s.set_item(bn::sprite_items::hud_6);\n`;
            sceneCode += `                    else if (units == 7) boss_hud_digit2_s.set_item(bn::sprite_items::hud_7);\n`;
            sceneCode += `                    else if (units == 8) boss_hud_digit2_s.set_item(bn::sprite_items::hud_8);\n`;
            sceneCode += `                    else if (units == 9) boss_hud_digit2_s.set_item(bn::sprite_items::hud_9);\n`;
            sceneCode += `                    boss_hud_digit1_s.set_palette(shared_sprite_palette);\n`;
            sceneCode += `                    boss_hud_digit2_s.set_palette(shared_sprite_palette);\n`;
            sceneCode += `                }\n`;
            sceneCode += `            } else {\n`;
            sceneCode += `                boss_hud_heart_s.set_visible(false);\n`;
            sceneCode += `                boss_hud_digit1_s.set_visible(false);\n`;
            sceneCode += `                boss_hud_digit2_s.set_visible(false);\n`;
            sceneCode += `            }\n`;
            sceneCode += `        }\n`;
          }
        }

        if (scene.type === 'RACING') {
          sceneCode += `        if (!_race_finished && _countdown_done) {\n`;
          sceneCode += `            _race_time_frames++;\n`;
          sceneCode += `            _lap_time_frames++;\n`;
          sceneCode += `        }\n`;
        }
        sceneCode += `        bn::core::update();\n`;
        if (scene.type === 'INTRO') {
          const nextSceneIdx = currentSceneIdx + 1 < scenes.length ? currentSceneIdx + 1 : startingSceneIdx;
          sceneCode += `        if (bn::keypad::any_pressed()) {\n`;
          sceneCode += `            return SceneId::SCENE_${nextSceneIdx};\n`;
          sceneCode += `        }\n`;
        } else if (scene.type === 'PAUSE') {
          sceneCode += `        if (bn::keypad::start_pressed()) {\n`;
          sceneCode += `            return paused_from_scene;\n`;
          sceneCode += `        }\n`;
        }
        sceneCode += `    }\n}\n\n`;
        mainCppDefinitions += sceneCode;
      }

      // Credits Scene Generation
      if (includeCreditsScene) {
        const palette = recentColors && recentColors.length > 1 ? recentColors : DEFAULT_16_PALETTE;
        const colors = palette.map(hex => {
          const rgb = hexToRgbLocal(hex);
          return { hex, r: rgb?.r ?? 0, g: rgb?.g ?? 0, b: rgb?.b ?? 0 };
        });
        const luminance = c => 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
        const darkest = colors.reduce((a, b) => luminance(a) < luminance(b) ? a : b);
        const lightest = colors.reduce((a, b) => luminance(a) > luminance(b) ? a : b);
        const bgHex = creditsBgColor || darkest.hex;
        const textHex = creditsTextColor || lightest.hex;
        const bgRGB = hexToRgbLocal(bgHex);
        const textRGB = hexToRgbLocal(textHex);
        const bgRGBArr = [bgRGB.r, bgRGB.g, bgRGB.b, 255];
        const textRGBArr = [textRGB.r, textRGB.g, textRGB.b, 255];

        // Layout text on a temporary canvas to compute needed height
        const layoutCanvas = document.createElement('canvas');
        layoutCanvas.width = 256;
        layoutCanvas.height = 2560;
        const layoutCtx = layoutCanvas.getContext('2d');
        layoutCtx.font = 'bold 16px monospace';
        layoutCtx.letterSpacing = '3px';
        layoutCtx.font = '13px monospace';
        layoutCtx.letterSpacing = '1px';
        const staticCredits = ['PxGBA', 'mGBA', 'butano', 'devkitARM'];
        const creditItems = [
          ...staticCredits.map(s => ({ name: s, source: null })),
          ...includedArtists.filter(Boolean)
        ];
        const iconW = 11;
        const maxWidth = 230;
        const commaW = layoutCtx.measureText(', ').width;
        let lines = [];
        let curLine = [];
        let curW = 0;
        for (const item of creditItems) {
          const iw = item.source ? iconW : 0;
          const nw = layoutCtx.measureText(item.name).width;
          const total = iw + nw;
          if (curLine.length > 0) {
            if (curW + commaW + total > maxWidth) {
              lines.push(curLine);
              curLine = [item];
              curW = total;
            } else {
              curLine.push(item);
              curW += commaW + total;
            }
          } else {
            curLine = [item];
            curW = total;
          }
        }
        if (curLine.length > 0) lines.push(curLine);
        let credY = 48;
        for (const line of lines) credY += 18;
        if (creditsText) {
          credY = Math.max(credY + 8, 100);
          const items = creditsText.split(',').map(s => s.trim()).filter(Boolean);
          credY += items.length * 16;
        }

        const scrollTarget = Math.max(0, credY - 160 + 24);
        const needsScroll = scrollTarget > 0;
        const bgHeight = needsScroll ? Math.ceil(Math.max(credY + 48, 256) / 256) * 256 : 256;

        // Render credits to final canvas
        const creditsBgCanvas = document.createElement('canvas');
        creditsBgCanvas.width = 256;
        creditsBgCanvas.height = bgHeight;
        const creditsCtx = creditsBgCanvas.getContext('2d');

        creditsCtx.fillStyle = bgHex;
        creditsCtx.fillRect(0, 0, 256, bgHeight);
        creditsCtx.fillStyle = textHex;
        creditsCtx.textAlign = 'center';
        creditsCtx.textBaseline = 'top';

        creditsCtx.font = 'bold 16px monospace';
        creditsCtx.letterSpacing = '3px';
        creditsCtx.fillText('CREDITS', 128, 16);

        creditsCtx.font = '13px monospace';
        creditsCtx.letterSpacing = '1px';
        creditsCtx.textAlign = 'left';
        credY = 48;
        for (const line of lines) {
          const lineW = line.reduce((acc, item, idx) => {
            const iw = item.source ? iconW : 0;
            const nw = creditsCtx.measureText(item.name).width;
            return acc + (idx > 0 ? commaW : 0) + iw + nw;
          }, 0);
          let drawX = 128 - lineW / 2;
          for (let i = 0; i < line.length; i++) {
            const item = line[i];
            if (i > 0) {
              creditsCtx.fillText(', ', drawX, credY);
              drawX += commaW;
            }
            if (item.source === 'modarchive') {
              creditsCtx.fillText('\u266A', drawX, credY);
              drawX += iconW;
            } else if (item.source === 'opengameart') {
              creditsCtx.fillText('\u25C6', drawX, credY);
              drawX += iconW;
            }
            creditsCtx.fillText(item.name, drawX, credY);
            drawX += creditsCtx.measureText(item.name).width;
          }
          credY += 18;
        }

        if (creditsText) {
          credY = Math.max(credY + 8, 100);
          creditsCtx.textAlign = 'center';
          creditsCtx.font = '12px monospace';
          const items = creditsText.split(',').map(s => s.trim()).filter(Boolean);
          for (const item of items) {
            creditsCtx.fillText(item, 128, credY);
            credY += 16;
          }
          creditsCtx.textAlign = 'left';
        }

        const creditsPalette = [[255, 0, 255, 0], bgRGBArr, textRGBArr];
        const creditsBmpBlob = canvasToIndexedBmpBlob(creditsBgCanvas, creditsPalette);
        zip.file('graphics/credits_bg.bmp', creditsBmpBlob);
        zip.file('graphics/credits_bg.json', JSON.stringify({
          type: 'regular_bg',
          bpp_mode: 'bpp_4'
        }, null, 2));
        mainCppIncludes += `#include "bn_regular_bg_items_credits_bg.h"\n`;

        let creditsMusicPlayCode = '';
        if (creditsMusicId) {
          const mTrack = musicTracks.find(t => t && String(t.id) === String(creditsMusicId));
          if (mTrack) {
            let baseName = mTrack.name;
            let ext = 'mod';
            if (mTrack.name.includes('.')) {
              const parts = mTrack.name.split('.');
              ext = parts.pop().toLowerCase().trim();
              baseName = parts.join('.');
            }
            if (mTrack.isComposed) {
              ext = 'mod';
            }
            const sanitizedMusicName = baseName.replace(/[^a-z0-9_]/gi, '_').toLowerCase() + '_credits';
            let modBytes = null;
            if (mTrack.composerData && mTrack.composerData.notes && mTrack.isComposed) {
              const { notes, bpm, songLength, channelWaveforms } = mTrack.composerData;
              try {
                const buffer = serializeToMod(notes || [], bpm || 125, songLength || 64, channelWaveforms || ['square', 'pulse25', 'triangle', 'noise']);
                modBytes = new Uint8Array(buffer);
                console.log(`[creditsMusic] Regenerated MOD from composerData: ${modBytes.length} bytes`);
              } catch (err) {
                console.error(`[creditsMusic] Failed to regenerate MOD from composerData:`, err);
              }
            }
            if (!modBytes && mTrack.data) {
              const dataParts = mTrack.data.split(',');
              if (dataParts.length > 1) {
                try {
                  const binaryString = window.atob(dataParts[1]);
                  const bytes = new Uint8Array(binaryString.length);
                  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
                  modBytes = bytes;
                } catch (err) {
                  console.error(`[creditsMusic] Failed to decode saved MOD:`, err);
                }
              }
            }
            if (modBytes) {
              zip.file(`audio/${sanitizedMusicName}.${ext}`, modBytes);
              creditsMusicPlayCode = `bn::music_items::${sanitizedMusicName}.play();\n`;
              hasMusic = true;
            } else {
              console.warn(`[creditsMusic] No usable MOD data for "${mTrack.name}", skipping music`);
            }
          }
        }

        // Generate effect includes and declarations
        let creditsEffectCode = '';
        if (creditsEffect === 'wave') {
          mainCppIncludes += `#include "bn_regular_bg_position_hbe_ptr.h"\n`;
          mainCppIncludes += `#include "bn_math.h"\n`;
          creditsEffectCode = `    bn::fixed hbe_deltas[160];
    for(int y = 0; y < 160; ++y) { hbe_deltas[y] = 0; }
    auto hbe = bn::regular_bg_position_hbe_ptr::create_horizontal(credits_bg, hbe_deltas);
    int wave_phase = 0;
`;
        }

        // Generate scroll variables
        let scrollCode = '';
        let scrollUpdate = '';
        if (needsScroll) {
          scrollCode = `    int scroll_y = 0;
    const int scroll_target = ${scrollTarget};
`;
          scrollUpdate = `        if(scroll_y < scroll_target) {
            scroll_y += 1;
            if(scroll_y > scroll_target) scroll_y = scroll_target;
            credits_bg.set_top_left_position(0, -scroll_y);
        }
`;
        }

        // Generate effect update code
        let effectUpdate = '';
        if (creditsEffect === 'wave') {
          effectUpdate = `        wave_phase = (wave_phase + 4) % 360;
        for(int y = 0; y < 160; ++y) {
            hbe_deltas[y] = bn::degrees_sin(bn::fixed((y * 360 / 160 + wave_phase) % 360)) * 4;
        }
        hbe.reload_deltas_ref();
`;
        }

        mainCppDefinitions += `SceneId play_credits_scene(bn::random& rng) {
    (void)rng;
    bn::regular_bg_ptr credits_bg = bn::regular_bg_items::credits_bg.create_bg(0, 0);
    credits_bg.set_top_left_position(0, 0);
${creditsMusicPlayCode ? '    ' + creditsMusicPlayCode.trimEnd() + '\n' : ''}${creditsEffectCode}${scrollCode}    while(true) {
        bn::core::update();
${effectUpdate}${scrollUpdate}        if(bn::keypad::any_pressed()) {
            return SceneId::SCENE_${startingSceneIdx};
        }
    }
}\n\n`;
      }

      // HUD Graphics Export
      let anySceneDisplayHealthInHud = false;
      let hudTileId = 21;
      let anySceneDisplayBonusInHud = false;
      let hudBonusTileId = 5;
      const globalPlayer = scenes.flatMap(s => s.actors || []).find(a => a.type === 'player');

      if (hudSettings && hudSettings.enabled) {
        const items = hudSettings.displayItems || [];
        items.forEach(item => {
          const txt = (item.text || '').toUpperCase();
          if (txt.includes('{HP}') || txt.includes('{HEALTH}') || txt.includes('{PLAYER_HP}')) {
            anySceneDisplayHealthInHud = true;
          }
          if (txt.includes('{BONUS}') || txt.includes('{COINS}') || txt.includes('{PLAYER_BONUS}')) {
            anySceneDisplayBonusInHud = true;
          }
        });
        if (globalPlayer) {
          hudTileId = globalPlayer.hudHealthTileId ?? 21;
          hudBonusTileId = globalPlayer.hudBonusTileId ?? 5;
        }

        // Export HUD Background Layer
        const hudCanvas = document.createElement('canvas');
        hudCanvas.width = 256;
        hudCanvas.height = 256;
        const hudCtx = hudCanvas.getContext('2d');
        hudCtx.fillStyle = '#ff00ff'; // Transparent Magenta key
        hudCtx.fillRect(0, 0, 256, 256);

        // Draw HUD background rectangle relative to the 240x160 viewport centered on 256x256
        const screenLeft = 8;
        const screenTop = 48;
        const screenBottom = 208;
        const screenRight = 248;

        let rectX;
        let rectY;
        const isVertical = hudSettings.position === 'left' || hudSettings.position === 'right';
        const rectW = (hudSettings.width ?? (isVertical ? 2 : 30)) * 8;
        const rectH = (hudSettings.height ?? (isVertical ? 20 : 2)) * 8;

        if (hudSettings.position === 'bottom') {
          rectX = screenLeft;
          rectY = screenBottom - rectH;
        } else if (hudSettings.position === 'left') {
          rectX = screenLeft;
          rectY = screenTop;
        } else if (hudSettings.position === 'right') {
          rectX = screenRight - rectW;
          rectY = screenTop;
        } else { // 'top'
          rectX = screenLeft;
          rectY = screenTop;
        }

        if (hudSettings.backgroundColor) {
          hudCtx.fillStyle = hudSettings.backgroundColor;
          hudCtx.fillRect(rectX, rectY, rectW, rectH);
        }

        const hudBmpBlob = canvasToIndexedBmpBlob(hudCanvas, null);
        zip.file(`graphics/hud_bg.bmp`, hudBmpBlob);
        zip.file(`graphics/hud_bg.json`, JSON.stringify({
          type: "regular_bg",
          bpp_mode: "bpp_4"
        }, null, 2));
        mainCppIncludes += `#include "bn_regular_bg_items_hud_bg.h"\n`;

        // Export each item tile dynamically
        items.forEach((item, i) => {
          if (item.tileId) {
            const tileCanvas = document.createElement('canvas'); tileCanvas.width = 8; tileCanvas.height = 8;
            const tileCtx = tileCanvas.getContext('2d', { willReadFrequently: true });
            const tile = savedTiles.find(t => t && String(t.id) === String(item.tileId));
            if (tile) {
              for (let py = 0; py < 8; py++) {
                for (let px = 0; px < 8; px++) {
                  if (tile.data[py][px]) {
                    tileCtx.fillStyle = tile.data[py][px];
                    tileCtx.fillRect(px, py, 1, 1);
                  }
                }
              }
            }
            
            const imgDataTemp = tileCtx.getImageData(0, 0, 8, 8);
            const uniqueColorsSet = new Set();
            for (let idx = 0; idx < imgDataTemp.data.length; idx += 4) {
              if (imgDataTemp.data[idx + 3] >= 128) {
                uniqueColorsSet.add(`${imgDataTemp.data[idx]},${imgDataTemp.data[idx + 1]},${imgDataTemp.data[idx + 2]}`);
              }
            }
            const uniqueCount = uniqueColorsSet.size + 1;
            const colorsCount = Math.min(256, Math.max(16, Math.ceil(uniqueCount / 16) * 16));
            const bppMode = colorsCount > 16 ? "bpp_8" : "bpp_4";

            const forceBpp = globalBppMode === 'bpp_8' ? 8 : 4;
            const bmpBlob = canvasToIndexedBmpBlob(tileCanvas, globalSpriteColors, forceBpp);
            zip.file(`graphics/hud_item_${i}_tile_sprite.bmp`, bmpBlob);
            zip.file(`graphics/hud_item_${i}_tile_sprite.json`, JSON.stringify({
              type: "sprite",
              width: 8,
              height: 8,
              bpp_mode: globalBppMode,
              colors_count: globalColorsCount
            }, null, 2));
            zip.file(`graphics/hud_item_${i}_tile_sprite.grit`, `-m!`);
            mainCppIncludes += `#include "bn_sprite_items_hud_item_${i}_tile_sprite.h"\n`;
          }
        });

      } else if (globalPlayer) {
        if (globalPlayer.displayHealthInHud) {
          anySceneDisplayHealthInHud = true;
          hudTileId = globalPlayer.hudHealthTileId ?? 21;
        }
        if (globalPlayer.displayBonusInHud) {
          anySceneDisplayBonusInHud = true;
          hudBonusTileId = globalPlayer.hudBonusTileId ?? 5;
        }
      }

      if (!hudSettings || !hudSettings.enabled) {
        if (anySceneDisplayHealthInHud) {
          // Export selected HUD tile as hud_heart_sprite
          const hCanvas = document.createElement('canvas'); hCanvas.width = 8; hCanvas.height = 8;
          const hCtx = hCanvas.getContext('2d', { willReadFrequently: true });
          const tile = savedTiles.find(t => t && String(t.id) === String(hudTileId));
          if (tile) {
            for (let py = 0; py < 8; py++) {
              for (let px = 0; px < 8; px++) {
                if (tile.data[py][px]) {
                  hCtx.fillStyle = tile.data[py][px];
                  hCtx.fillRect(px, py, 1, 1);
                }
              }
            }
          }
          const imgDataTemp = hCtx.getImageData(0, 0, 8, 8);
          const uniqueColorsSet = new Set();
          for (let idx = 0; idx < imgDataTemp.data.length; idx += 4) {
            if (imgDataTemp.data[idx + 3] >= 128) {
              uniqueColorsSet.add(`${imgDataTemp.data[idx]},${imgDataTemp.data[idx + 1]},${imgDataTemp.data[idx + 2]}`);
            }
          }
          const uniqueCount = uniqueColorsSet.size + 1;
          const colorsCount = Math.min(256, Math.max(16, Math.ceil(uniqueCount / 16) * 16));
          const bppMode = colorsCount > 16 ? "bpp_8" : "bpp_4";

          const forceBpp = globalBppMode === 'bpp_8' ? 8 : 4;
          const bmpBlob = canvasToIndexedBmpBlob(hCanvas, globalSpriteColors, forceBpp);
          zip.file(`graphics/hud_heart_sprite.bmp`, bmpBlob);
          zip.file(`graphics/hud_heart_sprite.json`, JSON.stringify({
            type: "sprite",
            width: 8,
            height: 8,
            bpp_mode: globalBppMode,
            colors_count: globalColorsCount
          }, null, 2));
          zip.file(`graphics/hud_heart_sprite.grit`, `-m!`);
          mainCppIncludes += `#include "bn_sprite_items_hud_heart_sprite.h"\n`;
        }

        if (anySceneDisplayBonusInHud) {
          // Export selected HUD tile as hud_bonus_sprite
          const bCanvas = document.createElement('canvas'); bCanvas.width = 8; bCanvas.height = 8;
          const bCtx = bCanvas.getContext('2d', { willReadFrequently: true });
          const tile = savedTiles.find(t => t && String(t.id) === String(hudBonusTileId));
          if (tile) {
            for (let py = 0; py < 8; py++) {
              for (let px = 0; px < 8; px++) {
                if (tile.data[py][px]) {
                  bCtx.fillStyle = tile.data[py][px];
                  bCtx.fillRect(px, py, 1, 1);
                }
              }
            }
          }
          const imgDataTemp = bCtx.getImageData(0, 0, 8, 8);
          const uniqueColorsSet = new Set();
          for (let idx = 0; idx < imgDataTemp.data.length; idx += 4) {
            if (imgDataTemp.data[idx + 3] >= 128) {
              uniqueColorsSet.add(`${imgDataTemp.data[idx]},${imgDataTemp.data[idx + 1]},${imgDataTemp.data[idx + 2]}`);
            }
          }
          const uniqueCount = uniqueColorsSet.size + 1;
          const colorsCount = Math.min(256, Math.max(16, Math.ceil(uniqueCount / 16) * 16));
          const bppMode = colorsCount > 16 ? "bpp_8" : "bpp_4";

          const forceBpp = globalBppMode === 'bpp_8' ? 8 : 4;
          const bmpBlob = canvasToIndexedBmpBlob(bCanvas, globalSpriteColors, forceBpp);
          zip.file(`graphics/hud_bonus_sprite.bmp`, bmpBlob);
          zip.file(`graphics/hud_bonus_sprite.json`, JSON.stringify({
            type: "sprite",
            width: 8,
            height: 8,
            bpp_mode: globalBppMode,
            colors_count: globalColorsCount
          }, null, 2));
          zip.file(`graphics/hud_bonus_sprite.grit`, `-m!`);
          mainCppIncludes += `#include "bn_sprite_items_hud_bonus_sprite.h"\n`;
        }
      }

      // Export expanded 8x8 character font

      // Export expanded 8x8 character font

        const dialogPalette = recentColors && recentColors.length > 1 ? recentColors : DEFAULT_16_PALETTE;
        const dialogColors = dialogPalette.map(hex => {
          const rgb = hexToRgbLocal(hex);
          return { hex, r: rgb?.r ?? 0, g: rgb?.g ?? 0, b: rgb?.b ?? 0 };
        });
        const dialogLuminance = c => 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
        const dialogDarkest = dialogColors.reduce((a, b) => dialogLuminance(a) < dialogLuminance(b) ? a : b, { hex: '#000000', r: 0, g: 0, b: 0 });

        for (const [char, bytes] of Object.entries(fontBytes)) {
          const cCanvas = document.createElement('canvas'); cCanvas.width = 8; cCanvas.height = 8;
          const cCtx = cCanvas.getContext('2d', { willReadFrequently: true });
          
          const rowData = bytes.map(byte => {
            const row = [];
            for (let bit = 7; bit >= 0; bit--) {
              row.push((byte & (1 << bit)) ? "#ffffff" : null);
            }
            return row;
          });

          for (let py = 0; py < 8; py++) {
            for (let px = 0; px < 8; px++) {
              if (rowData[py][px]) {
                const drawColor = (hudSettings && hudSettings.enabled) ? (hudSettings.textColor || '#ffffff') : '#ffffff';
                cCtx.fillStyle = drawColor;
                cCtx.fillRect(px, py, 1, 1);
              }
            }
          }

          const forceBpp = globalBppMode === 'bpp_8' ? 8 : 4;
          const bmpBlob = canvasToIndexedBmpBlob(cCanvas, globalSpriteColors, forceBpp);
          const name = getCharSpriteItemName(char);
          if (name) {
            zip.file(`graphics/${name}.bmp`, bmpBlob);
            zip.file(`graphics/${name}.json`, JSON.stringify({
              type: "sprite",
              width: 8,
              height: 8,
              bpp_mode: globalBppMode,
              colors_count: globalColorsCount
            }, null, 2));
            zip.file(`graphics/${name}.grit`, `-m!`);
            mainCppIncludes += `#include "bn_sprite_items_${name}.h"\n`;

            // Export dialog font duplicate
            const dCanvas = document.createElement('canvas'); dCanvas.width = 8; dCanvas.height = 8;
            const dCtx = dCanvas.getContext('2d', { willReadFrequently: true });
            for (let py = 0; py < 8; py++) {
              for (let px = 0; px < 8; px++) {
                if (rowData[py][px]) {
                  dCtx.fillStyle = dialogDarkest.hex;
                  dCtx.fillRect(px, py, 1, 1);
                }
              }
            }
            const dBmpBlob = canvasToIndexedBmpBlob(dCanvas, globalSpriteColors, forceBpp);
            zip.file(`graphics/dialog_${name}.bmp`, dBmpBlob);
            zip.file(`graphics/dialog_${name}.json`, JSON.stringify({
              type: "sprite",
              width: 8,
              height: 8,
              bpp_mode: globalBppMode,
              colors_count: globalColorsCount
            }, null, 2));
            zip.file(`graphics/dialog_${name}.grit`, `-m!`);
            mainCppIncludes += `#include "bn_sprite_items_dialog_${name}.h"\n`;
          }
        }

        // Export single global dialog background layer
        {
          const dCanvas = document.createElement('canvas');
          dCanvas.width = 256; dCanvas.height = 256;
          const dCtx = dCanvas.getContext('2d', { willReadFrequently: true });
          const boxX = 8, boxY = 144, boxW = 240, boxH = 64;
          dCtx.fillStyle = '#000000'; dCtx.fillRect(boxX, boxY, boxW, boxH);
          dCtx.fillStyle = '#ffffff'; dCtx.fillRect(boxX + 2, boxY + 2, boxW - 4, boxH - 4);
          const bmpBlob = canvasToIndexedBmpBlob(dCanvas, null);
          zip.file('graphics/dialog_bg.bmp', bmpBlob);
          zip.file('graphics/dialog_bg.json', JSON.stringify({
            type: "regular_bg",
            bpp_mode: "bpp_4"
          }, null, 2));
          mainCppIncludes += '#include "bn_regular_bg_items_dialog_bg.h"\n';
        }

        // Export fade overlay background (full black for screen transitions)
        {
          const fadeCanvas = document.createElement('canvas');
          fadeCanvas.width = 256; fadeCanvas.height = 256;
          const fadeCtx = fadeCanvas.getContext('2d', { willReadFrequently: true });
          fadeCtx.fillStyle = '#000000'; fadeCtx.fillRect(0, 0, 256, 256);
          const fadeBmpBlob = canvasToIndexedBmpBlob(fadeCanvas, null);
          zip.file('graphics/fade_overlay_bg.bmp', fadeBmpBlob);
          zip.file('graphics/fade_overlay_bg.json', JSON.stringify({
            type: "regular_bg",
            bpp_mode: "bpp_4"
          }, null, 2));
          mainCppIncludes += '#include "bn_regular_bg_items_fade_overlay_bg.h"\n';
        }

      if (generatedProjectiles.size === 0) generatedProjectiles.add('bullet_sprite');
      for (const pName of generatedProjectiles) {
        let pSpriteId = null;
        if (pName.startsWith('proj_sprite_')) pSpriteId = pName.replace('proj_sprite_', '');
        const bCanvas = document.createElement('canvas'); bCanvas.width = 8; bCanvas.height = 8;
        const bCtx = bCanvas.getContext('2d', { willReadFrequently: true });
        if (pSpriteId) {
          const tile = savedTiles.find(t => t && String(t.id) === String(pSpriteId));
          if (tile) {
            for (let py = 0; py < 8; py++) for (let px = 0; px < 8; px++) if (tile.data[py][px]) { bCtx.fillStyle = tile.data[py][px]; bCtx.fillRect(px, py, 1, 1); }
          }
        } else {
          bCtx.fillStyle = '#ffffff'; bCtx.beginPath(); bCtx.arc(4, 4, 3, 0, 2 * Math.PI); bCtx.fill();
        }
        const imgDataTemp = bCtx.getImageData(0, 0, 8, 8);
        const uniqueColorsSet = new Set();
        for (let idx = 0; idx < imgDataTemp.data.length; idx += 4) {
          if (imgDataTemp.data[idx + 3] >= 128) {
            uniqueColorsSet.add(`${imgDataTemp.data[idx]},${imgDataTemp.data[idx + 1]},${imgDataTemp.data[idx + 2]}`);
          }
        }
        const uniqueCount = uniqueColorsSet.size + 1;
        const colorsCount = Math.min(256, Math.max(16, Math.ceil(uniqueCount / 16) * 16));
        const bppMode = colorsCount > 16 ? "bpp_8" : "bpp_4";

        const forceBpp = globalBppMode === 'bpp_8' ? 8 : 4;
        const bmpBlob = canvasToIndexedBmpBlob(bCanvas, globalSpriteColors, forceBpp);
        zip.file(`graphics/${pName}.bmp`, bmpBlob);
        zip.file(`graphics/${pName}.json`, JSON.stringify({
          type: "sprite",
          width: 8,
          height: 8,
          bpp_mode: globalBppMode,
          colors_count: globalColorsCount
        }, null, 2));
        zip.file(`graphics/${pName}.grit`, `-m!`);
        mainCppIncludes += `#include "bn_sprite_items_${pName}.h"\n`;
      }

      let finalIncludes = mainCppIncludes;
      if (generatedSounds.size > 0) {
        finalIncludes += `#include "bn_sound_items.h"\n`;
      }
      if (hasMusic) {
        finalIncludes += `#include "bn_music_items.h"\n`;
      }

      const creditsCase = includeCreditsScene ? `            case SceneId::SCENE_CREDITS: next_scene = play_credits_scene(rng); break;\n` : '';
      const initialScene = includeCreditsScene ? 'SCENE_CREDITS' : `SCENE_${startingSceneIdx}`;
      const mainCpp = `${finalIncludes}\n${mainCppDefinitions}\nint main() {\n    bn::core::init();\n    bn::random rng;\n    SceneId next_scene = SceneId::${initialScene};\n    while(true) {\n        switch(next_scene) {\n${creditsCase}${scenes.map((s, i) => `            case SceneId::SCENE_${i}: next_scene = play_scene_${i}(rng); break;`).join('\n')}\n            default: next_scene = play_scene_${startingSceneIdx}(rng); break;\n        }\n        bn::core::update();\n    }\n}\n`;

      // Standard Butano Makefile structure
      const makefile = `TARGET      :=  \${sanitizedName}
BUILD       :=  build
LIBBUTANO   :=  ../../butano
PYTHON      :=  python
SOURCES     :=  src
INCLUDES    :=  include
DATA        :=  
GRAPHICS    :=  graphics
AUDIO       :=  audio
AUDIOBACKEND:=  maxmod
DMGAUDIO    :=  dmg_audio
ROMTITLE    :=  \${sanitizedName.toUpperCase()}
ROMCODE     :=  ABCD

USERFLAGS   :=  -fno-lto
USERLDFLAGS :=  -fno-lto

ifndef LIBBUTANOABS
	export LIBBUTANOABS	:=	\$(realpath \$(LIBBUTANO))
endif

include \$(LIBBUTANOABS)/butano.mak
`;

      zip.file("src/main.cpp", mainCpp);
      zip.file("Makefile", makefile);

      return await zip.generateAsync({ type: "blob" });
}
