import { BUTANO_COLLISION_ENUMS } from '../../constants';

function translateExpr(str) {
  if (!str) return str;
  let result = str.replace(/\brnd\b\(([^)]+)\)/gi, (match, arg) => {
    return `rng.get_int(${arg} + 1)`;
  });
  return result;
}

export function generateScriptLogic(script, actorIndex, actorWidth, actorHeight, baseIndent = 0, callStack = new Set(), options = {}) {
  const {
    dialogs, safeSceneName, scenes, sActors, sDims, customScripts, variables,
    currentSceneIdx, startingSceneIdx, scene, animations, startNodeId = 'start'
  } = options;
  let code = '';
  if (!script?.nodes?.length) return code;
  let currentNode = script.nodes.find(n => n && n.id === startNodeId);
  if (!currentNode) return code;
  const visited = new Set();
  const safeStr = str => String(str ?? '').replace(/"/g, '\\"').replace(/\n/g, '\\n');
  let openBraces = 0;

  const playerIdx = sActors ? sActors.findIndex(act => act && act.type === 'player') : -1;
  const playerActor = playerIdx !== -1 ? sActors[playerIdx] : null;
  const playerHpVarName = playerActor?.varPlayerHp || 'PLAYER_HP';
  const playerBonusVarName = playerActor?.varPlayerBonus || 'PLAYER_BONUS';

  const resolveVarName = (name) => {
    if (!name) return '';
    const nameUpper = String(name).toUpperCase();
    if (playerIdx !== -1) {
      if (nameUpper === String(playerHpVarName).toUpperCase() || nameUpper === 'HP' || nameUpper === 'HEALTH') {
        return `actor_${playerIdx}_hp`;
      }
      if (nameUpper === String(playerBonusVarName).toUpperCase() || nameUpper === 'BONUS' || nameUpper === 'COINS') {
        return `actor_${playerIdx}_bonus`;
      }
    }
    return String(name).replace(/[^a-zA-Z0-9_]/g, '_');
  };

  while (currentNode && !visited.has(currentNode.id)) {
    visited.add(currentNode.id);
    const label = currentNode.data?.label || '';
    const indent = '                ' + '    '.repeat(openBraces + baseIndent);

    if (label === 'Show Dialog') {
      code += `${indent}BN_LOG("Action: Show Dialog: ${safeStr(currentNode.data.message)}");\n`;
      code += `${indent}{\n`;
      code += `${indent}    if (!scene_dialog_bg) {\n`;
      code += `${indent}        scene_dialog_bg = bn::regular_bg_items::dialog_bg.create_bg(0, 0);\n`;
      code += `${indent}        scene_dialog_bg->set_priority(0);\n`;
      code += `${indent}    }\n`;
      code += `${indent}    bn::vector<bn::sprite_ptr, 128> text_sprites;\n`;
      code += `${indent}    show_dialog_text("${safeStr(currentNode.data.message)}", text_sprites, dialog_text_palette, text_anim_speed);\n`;
      code += `${indent}    while(bn::keypad::a_held()) { bn::core::update(); }\n`;
      code += `${indent}    while(!bn::keypad::a_pressed()) { bn::core::update(); }\n`;
      code += `${indent}    while(bn::keypad::a_held()) { bn::core::update(); }\n`;
      code += `${indent}    scene_dialog_bg.reset();\n`;
      code += `${indent}}\n`;
    } else if (label === 'Show Menu' || currentNode.data?.actionType === 'menu') {
      const msg = currentNode.data.message || '';
      const opts = currentNode.data.options || [];
      const numOptions = opts.length;
      const choiceVar = "menu_choice_" + currentNode.id.replace(/[^a-zA-Z0-9_]/g, "_");

      code += `${indent}BN_LOG("Action: Show Menu");\n`;
      if (numOptions > 0) {
        code += `${indent}{\n`;
        code += `${indent}    int ${choiceVar} = 0;\n`;

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

        // Generate recreateSwitch logic
        let recreateSwitch = '';
        recreateSwitch += `${indent}            text_sprites.clear();\n`;
        recreateSwitch += `${indent}            switch (${choiceVar}) {\n`;
        opts.forEach((opt, oIdx) => {
          const variant = getMenuFormattedText(msg, opts, oIdx);
          recreateSwitch += `${indent}                case ${oIdx}:\n`;
          recreateSwitch += `${indent}                    show_dialog_text("${safeStr(variant)}", text_sprites, dialog_text_palette, text_anim_speed);\n`;
          recreateSwitch += `${indent}                    break;\n`;
        });
        recreateSwitch += `${indent}            }\n`;

        // Generate dispatchSwitch logic
        let dispatchSwitch = '';
        dispatchSwitch += `${indent}    switch (${choiceVar}) {\n`;
        opts.forEach((opt, oIdx) => {
          dispatchSwitch += `${indent}        case ${oIdx}: {\n`;
          
          const optionEdge = (script.edges || []).find(e => e && e.source === currentNode.id && e.sourceHandle === `option-${oIdx}`);
          let branchCode = '';
          if (optionEdge) {
            branchCode = generateScriptLogic(script, actorIndex, actorWidth, actorHeight, baseIndent + openBraces + 2, callStack, { ...options, startNodeId: optionEdge.target });
          }
          
          if (branchCode) {
            dispatchSwitch += branchCode;
          }
          dispatchSwitch += `${indent}            break;\n`;
          dispatchSwitch += `${indent}        }\n`;
        });
        dispatchSwitch += `${indent}    }\n`;

        // Write the loop and dispatcher to code
        let initialVariant = getMenuFormattedText(msg, opts, 0);
        code += `${indent}    if (!scene_dialog_bg) {\n`;
        code += `${indent}        scene_dialog_bg = bn::regular_bg_items::dialog_bg.create_bg(0, 0);\n`;
        code += `${indent}        scene_dialog_bg->set_priority(0);\n`;
        code += `${indent}    }\n`;
        code += `${indent}    bn::vector<bn::sprite_ptr, 128> text_sprites;\n`;
        code += `${indent}    show_dialog_text("${safeStr(initialVariant)}", text_sprites, dialog_text_palette, text_anim_speed);\n`;
        code += `${indent}    while(bn::keypad::a_held() || bn::keypad::b_held()) { bn::core::update(); }\n`;
        code += `${indent}    while(true) {\n`;
        code += `${indent}        int num_rows = (${numOptions} + 1) / 2;\n`;
        code += `${indent}        int col = ${choiceVar} < num_rows ? 0 : 1;\n`;
        code += `${indent}        int row = col == 0 ? ${choiceVar} : ${choiceVar} - num_rows;\n`;
        code += `${indent}        bool changed = false;\n`;
        code += `${indent}        if (bn::keypad::left_pressed()) {\n`;
        code += `${indent}            col = (col - 1 + 2) % 2;\n`;
        code += `${indent}            int next_c = col == 0 ? row : num_rows + row;\n`;
        code += `${indent}            if (next_c < ${numOptions}) ${choiceVar} = next_c;\n`;
        code += `${indent}            else ${choiceVar} = ${numOptions} - 1;\n`;
        code += `${indent}            changed = true;\n`;
        code += `${indent}        } else if (bn::keypad::right_pressed()) {\n`;
        code += `${indent}            col = (col + 1) % 2;\n`;
        code += `${indent}            int next_c = col == 0 ? row : num_rows + row;\n`;
        code += `${indent}            if (next_c < ${numOptions}) ${choiceVar} = next_c;\n`;
        code += `${indent}            else ${choiceVar} = ${numOptions} - 1;\n`;
        code += `${indent}            changed = true;\n`;
        code += `${indent}        } else if (bn::keypad::up_pressed()) {\n`;
        code += `${indent}            row = (row - 1 + num_rows) % num_rows;\n`;
        code += `${indent}            int next_c = col == 0 ? row : num_rows + row;\n`;
        code += `${indent}            if (next_c < ${numOptions}) ${choiceVar} = next_c;\n`;
        code += `${indent}            else ${choiceVar} = ${numOptions} - 1;\n`;
        code += `${indent}            changed = true;\n`;
        code += `${indent}        } else if (bn::keypad::down_pressed()) {\n`;
        code += `${indent}            row = (row + 1) % num_rows;\n`;
        code += `${indent}            int next_c = col == 0 ? row : num_rows + row;\n`;
        code += `${indent}            if (next_c < ${numOptions}) ${choiceVar} = next_c;\n`;
        code += `${indent}            else ${choiceVar} = ${numOptions} - 1;\n`;
        code += `${indent}            changed = true;\n`;
        code += `${indent}        } else if (bn::keypad::a_pressed()) {\n`;
        code += `${indent}            break;\n`;
        code += `${indent}        }\n`;
        code += `${indent}        if (changed) {\n`;
        code += recreateSwitch;
        code += `${indent}        }\n`;
        code += `${indent}        bn::core::update();\n`;
        code += `${indent}    }\n`;
        code += `${indent}    while(bn::keypad::a_held()) { bn::core::update(); }\n`;
        code += `${indent}    text_sprites.clear();\n`;
        code += dispatchSwitch;
        code += `${indent}    scene_dialog_bg.reset();\n`;
        code += `${indent}}\n`;
      }
      continue;
    } else if (label === 'Show Image') {
      const targetSceneId = currentNode.data.sceneId;
      const targetSceneIdx = scenes.findIndex(s => s.id === targetSceneId);
      if (targetSceneIdx !== -1) {
        code += `${indent}BN_LOG("Action: Show Image scene_${targetSceneIdx}");\n`;
        code += `${indent}{\n`;
        code += `${indent}    bn::regular_bg_ptr img_bg = bn::regular_bg_items::scene_${targetSceneIdx}_bg.create_bg(0, 0);\n`;
        code += `${indent}    img_bg.set_priority(0);\n`;
        if (currentNode.data.waitInput !== false) {
          code += `${indent}    while(bn::keypad::a_held()) { bn::core::update(); }\n`;
          code += `${indent}    while(!bn::keypad::a_pressed()) { bn::core::update(); }\n`;
          code += `${indent}    while(bn::keypad::a_held()) { bn::core::update(); }\n`;
        } else if (currentNode.data.waitFrames > 0) {
          code += `${indent}    for(int f=0; f<${currentNode.data.waitFrames}; ++f) { bn::core::update(); }\n`;
        } else {
          code += `${indent}    bn::core::update();\n`;
        }
        code += `${indent}}\n`;
      }
    } else if (label === 'Wait') {
      const waitFrames = currentNode.data.frames || 60;
      code += `${indent}BN_LOG("Action: Wait ${waitFrames} frames");\n`;
      code += `${indent}for(int f=0; f<${waitFrames}; ++f) { bn::core::update(); }\n`;
    } else if (label === 'Move Actor' || currentNode.data?.actionType === 'move') {
      const targetActorId = currentNode.data.targetActorId;
      const isVar = variables.some(v => v && v.name === String(targetActorId));
      let xVal = variables.some(v => v && v.name === String(currentNode.data.x))
        ? `(${resolveVarName(currentNode.data.x)} * 8)`
        : ((parseInt(currentNode.data.x) || 0) * 8);
      let yVal = variables.some(v => v && v.name === String(currentNode.data.y))
        ? `(${resolveVarName(currentNode.data.y)} * 8)`
        : ((parseInt(currentNode.data.y) || 0) * 8);

      const isMoving = (a) => a.type === 'enemy'
        ? ((a.enemyBehavior || 'patrol') !== 'idle')
        : (a.isMoving ?? (a.type === 'movingPlatform'));

      if (isVar) {
        const varName = resolveVarName(targetActorId);
        code += `${indent}BN_LOG("Action: Move Actor by Variable Index");\n`;
        code += `${indent}switch(${varName}) {\n`;
        sActors.forEach((a, idx) => {
          if (!a) return;
          code += `${indent}    case ${idx}:\n`;
          code += `${indent}        actor_${idx}_float_x = ${xVal};\n`;
          code += `${indent}        actor_${idx}_float_y = ${yVal};\n`;
          code += `${indent}        actor_${idx}_x = ${xVal};\n`;
          code += `${indent}        actor_${idx}_y = ${yVal};\n`;
          if (isMoving(a)) {
            code += `${indent}        actor_${idx}_start_x = ${xVal};\n`;
            code += `${indent}        actor_${idx}_start_y = ${yVal};\n`;
            code += `${indent}        actor_${idx}_dir = 1;\n`;
          }
          code += `${indent}        break;\n`;
        });
        code += `${indent}}\n`;
      } else {
        const targetActorIdx = targetActorId ? sActors.findIndex(a => a &&  a && String(a.id) === String(targetActorId)) : actorIndex;
        if (targetActorIdx >= 0) {
          const targetAct = sActors[targetActorIdx];
          code += `${indent}BN_LOG("Action: Move Actor ${targetAct.name}");\n`;
          code += `${indent}actor_${targetActorIdx}_float_x = ${xVal};\n`;
          code += `${indent}actor_${targetActorIdx}_float_y = ${yVal};\n`;
          code += `${indent}actor_${targetActorIdx}_x = ${xVal};\n`;
          code += `${indent}actor_${targetActorIdx}_y = ${yVal};\n`;
          if (isMoving(targetAct)) {
            code += `${indent}actor_${targetActorIdx}_start_x = ${xVal};\n`;
            code += `${indent}actor_${targetActorIdx}_start_y = ${yVal};\n`;
            code += `${indent}actor_${targetActorIdx}_dir = 1;\n`;
          }
        }
      }
    } else if (label === 'Shoot Projectile') {
      if (actorIndex >= 0) {
        const pName = currentNode.data.computedProjName || 'bullet_sprite';
        const playerIdx = sActors.findIndex(a => a && a.type === 'player');
        const isPlayer = actorIndex === playerIdx;
        const dirMode = currentNode.data.dirMode || 'vector';
        const speed = currentNode.data.speed ?? 3;

        code += `${indent}for(int p=0; p<20; ++p) {\n`;
        code += `${indent}    if(!proj_active[p]) {\n`;
        if ((scene.type === 'SHMUP' || scene.type === 'RACING') && scene.mode7 && isPlayer) {
          const screenY = scene.type === 'SHMUP' ? 40 : 50;
          code += `${indent}        proj_x[p] = actor_${actorIndex}_x + ${Math.floor((actorWidth || 16) / 2)};\n`;
          code += `${indent}        proj_y[p] = actor_${actorIndex}_y + ${Math.floor((actorHeight || 16) / 2)} + ${screenY};\n`;
        } else {
          code += `${indent}        proj_x[p] = actor_${actorIndex}_x + ${Math.floor((actorWidth || 16) / 2)};\n`;
          code += `${indent}        proj_y[p] = actor_${actorIndex}_y + ${Math.floor((actorHeight || 16) / 2)};\n`;
        }

        if (dirMode === 'vector') {
          code += `${indent}        proj_dx[p] = ${currentNode.data.dx || 0};\n`;
          code += `${indent}        proj_dy[p] = ${currentNode.data.dy || 0};\n`;
        } else if (dirMode === 'facing') {
          code += `${indent}        {\n`;
          code += `${indent}            bn::fixed dx_dir = 0;\n`;
          code += `${indent}            bn::fixed dy_dir = 0;\n`;
          code += `${indent}            if (actor_${actorIndex}_dx < 0) dx_dir = -1;\n`;
          code += `${indent}            else if (actor_${actorIndex}_dx > 0) dx_dir = 1;\n`;
          code += `${indent}            if (actor_${actorIndex}_dy < 0) dy_dir = -1;\n`;
          code += `${indent}            else if (actor_${actorIndex}_dy > 0) dy_dir = 1;\n`;
          if (isPlayer) {
            code += `${indent}            if (dx_dir == 0 && dy_dir == 0) {\n`;
            code += `${indent}                if (bn::keypad::left_held()) dx_dir = -1;\n`;
            code += `${indent}                else if (bn::keypad::right_held()) dx_dir = 1;\n`;
            code += `${indent}                else if (bn::keypad::up_held()) dy_dir = -1;\n`;
            code += `${indent}                else if (bn::keypad::down_held()) dy_dir = 1;\n`;
            code += `${indent}                else {\n`;
            code += `${indent}                    dx_dir = actor_${actorIndex}_last_dx_dir;\n`;
            code += `${indent}                    dy_dir = actor_${actorIndex}_last_dy_dir;\n`;
            code += `${indent}                }\n`;
            code += `${indent}            }\n`;
          } else {
            code += `${indent}            if (dx_dir == 0 && dy_dir == 0) {\n`;
            code += `${indent}                dx_dir = actor_${actorIndex}_last_dx_dir;\n`;
            code += `${indent}                dy_dir = actor_${actorIndex}_last_dy_dir;\n`;
            code += `${indent}            }\n`;
          }
          code += `${indent}            if (dx_dir != 0 && dy_dir != 0) {\n`;
          code += `${indent}                proj_dx[p] = (dx_dir * bn::fixed(${speed}) * 707) / 1000;\n`;
          code += `${indent}                proj_dy[p] = (dy_dir * bn::fixed(${speed}) * 707) / 1000;\n`;
          code += `${indent}            } else {\n`;
          code += `${indent}                proj_dx[p] = dx_dir * bn::fixed(${speed});\n`;
          code += `${indent}                proj_dy[p] = dy_dir * bn::fixed(${speed});\n`;
          code += `${indent}            }\n`;
          code += `${indent}        }\n`;
        } else if (dirMode === 'angle') {
          const angleVal = currentNode.data.angle ?? 0;
          code += `${indent}        proj_dx[p] = bn::degrees_lut_cos(bn::fixed(${angleVal})) * bn::fixed(${speed});\n`;
          code += `${indent}        proj_dy[p] = bn::degrees_lut_sin(bn::fixed(${angleVal})) * bn::fixed(${speed});\n`;
        } else if (dirMode === 'target_enemy') {
          const enemyIndices = [];
          sActors.forEach((act, actIdx) => {
            if (act.type === 'enemy') {
              enemyIndices.push(actIdx);
            }
          });

          if (enemyIndices.length > 0) {
            code += `${indent}        {\n`;
            code += `${indent}            int target_x = -1;\n`;
            code += `${indent}            int target_y = -1;\n`;
            code += `${indent}            int min_dist_sq = 9999999;\n`;
            code += `${indent}            int cur_x = proj_x[p];\n`;
            code += `${indent}            int cur_y = proj_y[p];\n`;
            enemyIndices.forEach(kIdx => {
              const enemyAct = sActors[kIdx];
              code += `${indent}            if (actor_${kIdx}_active) {\n`;
              code += `${indent}                int edx = actor_${kIdx}_x + ${Math.floor((enemyAct.width || 16) / 2)} - cur_x;\n`;
              code += `${indent}                int edy = actor_${kIdx}_y + ${Math.floor((enemyAct.height || 16) / 2)} - cur_y;\n`;
              code += `${indent}                int dist_sq = edx*edx + edy*edy;\n`;
              code += `${indent}                if (dist_sq < min_dist_sq) {\n`;
              code += `${indent}                    min_dist_sq = dist_sq;\n`;
              code += `${indent}                    target_x = actor_${kIdx}_x + ${Math.floor((enemyAct.width || 16) / 2)};\n`;
              code += `${indent}                    target_y = actor_${kIdx}_y + ${Math.floor((enemyAct.height || 16) / 2)};\n`;
              code += `${indent}                }\n`;
              code += `${indent}            }\n`;
            });
            code += `${indent}            if (target_x != -1) {\n`;
            code += `${indent}                bn::fixed target_dx = target_x - cur_x;\n`;
            code += `${indent}                bn::fixed target_dy = target_y - cur_y;\n`;
            code += `${indent}                bn::fixed target_dist = bn::sqrt((target_dx * target_dx) + (target_dy * target_dy));\n`;
            code += `${indent}                if (target_dist > 0) {\n`;
            code += `${indent}                    proj_dx[p] = (target_dx / target_dist) * bn::fixed(${speed});\n`;
            code += `${indent}                    proj_dy[p] = (target_dy / target_dist) * bn::fixed(${speed});\n`;
            code += `${indent}                } else {\n`;
            code += `${indent}                    proj_dx[p] = bn::fixed(${speed});\n`;
            code += `${indent}                    proj_dy[p] = 0;\n`;
            code += `${indent}                }\n`;
            code += `${indent}            } else {\n`;
            code += `${indent}                bn::fixed dx_dir = 0;\n`;
            code += `${indent}                bn::fixed dy_dir = 0;\n`;
            code += `${indent}                if (actor_${actorIndex}_dx < 0) dx_dir = -1;\n`;
            code += `${indent}                else if (actor_${actorIndex}_dx > 0) dx_dir = 1;\n`;
            code += `${indent}                if (actor_${actorIndex}_dy < 0) dy_dir = -1;\n`;
            code += `${indent}                else if (actor_${actorIndex}_dy > 0) dy_dir = 1;\n`;
            if (isPlayer) {
              code += `${indent}                if (dx_dir == 0 && dy_dir == 0) {\n`;
              code += `${indent}                    if (bn::keypad::left_held()) dx_dir = -1;\n`;
              code += `${indent}                    else if (bn::keypad::right_held()) dx_dir = 1;\n`;
              code += `${indent}                    else if (bn::keypad::up_held()) dy_dir = -1;\n`;
              code += `${indent}                    else if (bn::keypad::down_held()) dy_dir = 1;\n`;
              code += `${indent}                    else dx_dir = 1;\n`;
              code += `${indent}                }\n`;
            } else {
              code += `${indent}                if (dx_dir == 0 && dy_dir == 0) dx_dir = 1;\n`;
            }
            code += `${indent}                if (dx_dir != 0 && dy_dir != 0) {\n`;
            code += `${indent}                    proj_dx[p] = (dx_dir * bn::fixed(${speed}) * 707) / 1000;\n`;
            code += `${indent}                    proj_dy[p] = (dy_dir * bn::fixed(${speed}) * 707) / 1000;\n`;
            code += `${indent}                } else {\n`;
            code += `${indent}                    proj_dx[p] = dx_dir * bn::fixed(${speed});\n`;
            code += `${indent}                    proj_dy[p] = dy_dir * bn::fixed(${speed});\n`;
            code += `${indent}                }\n`;
            code += `${indent}            }\n`;
            code += `${indent}        }\n`;
          } else {
            code += `${indent}        {\n`;
            code += `${indent}            bn::fixed dx_dir = 0;\n`;
            code += `${indent}            bn::fixed dy_dir = 0;\n`;
            code += `${indent}            if (actor_${actorIndex}_dx < 0) dx_dir = -1;\n`;
            code += `${indent}            else if (actor_${actorIndex}_dx > 0) dx_dir = 1;\n`;
            code += `${indent}            if (actor_${actorIndex}_dy < 0) dy_dir = -1;\n`;
            code += `${indent}            else if (actor_${actorIndex}_dy > 0) dy_dir = 1;\n`;
            if (isPlayer) {
              code += `${indent}            if (dx_dir == 0 && dy_dir == 0) {\n`;
              code += `${indent}                if (bn::keypad::left_held()) dx_dir = -1;\n`;
              code += `${indent}                else if (bn::keypad::right_held()) dx_dir = 1;\n`;
              code += `${indent}                else if (bn::keypad::up_held()) dy_dir = -1;\n`;
              code += `${indent}                else if (bn::keypad::down_held()) dy_dir = 1;\n`;
              code += `${indent}                else dx_dir = 1;\n`;
              code += `${indent}            }\n`;
            } else {
              code += `${indent}            if (dx_dir == 0 && dy_dir == 0) dx_dir = 1;\n`;
            }
            code += `${indent}            if (dx_dir != 0 && dy_dir != 0) {\n`;
            code += `${indent}                proj_dx[p] = (dx_dir * bn::fixed(${speed}) * 707) / 1000;\n`;
            code += `${indent}                proj_dy[p] = (dy_dir * bn::fixed(${speed}) * 707) / 1000;\n`;
            code += `${indent}            } else {\n`;
            code += `${indent}                proj_dx[p] = dx_dir * bn::fixed(${speed});\n`;
            code += `${indent}                proj_dy[p] = dy_dir * bn::fixed(${speed});\n`;
            code += `${indent}            }\n`;
            code += `${indent}        }\n`;
          }
        } else if (dirMode === 'target_player') {
          const playerIdx = sActors.findIndex(act => act && act.type === 'player');
          if (playerIdx !== -1) {
            const pAct = sActors[playerIdx];
            code += `${indent}        if (actor_${playerIdx}_active) {\n`;
            code += `${indent}            int cur_x = proj_x[p];\n`;
            code += `${indent}            int cur_y = proj_y[p];\n`;
            code += `${indent}            int target_x = actor_${playerIdx}_x + ${Math.floor((pAct.width || 16) / 2)};\n`;
            code += `${indent}            int target_y = actor_${playerIdx}_y + ${Math.floor((pAct.height || 16) / 2)};\n`;
            code += `${indent}            bn::fixed target_dx = target_x - cur_x;\n`;
            code += `${indent}            bn::fixed target_dy = target_y - cur_y;\n`;
            code += `${indent}            bn::fixed target_dist = bn::sqrt((target_dx * target_dx) + (target_dy * target_dy));\n`;
            code += `${indent}            if (target_dist > 0) {\n`;
            code += `${indent}                proj_dx[p] = (target_dx / target_dist) * bn::fixed(${speed});\n`;
            code += `${indent}                proj_dy[p] = (target_dy / target_dist) * bn::fixed(${speed});\n`;
            code += `${indent}            } else {\n`;
            code += `${indent}                proj_dx[p] = bn::fixed(${speed});\n`;
            code += `${indent}                proj_dy[p] = 0;\n`;
            code += `${indent}            }\n`;
            code += `${indent}        } else {\n`;
            code += `${indent}            bn::fixed dx_dir = 0;\n`;
            code += `${indent}            bn::fixed dy_dir = 0;\n`;
            code += `${indent}            if (actor_${actorIndex}_dx < 0) dx_dir = -1;\n`;
            code += `${indent}            else if (actor_${actorIndex}_dx > 0) dx_dir = 1;\n`;
            code += `${indent}            if (actor_${actorIndex}_dy < 0) dy_dir = -1;\n`;
            code += `${indent}            else if (actor_${actorIndex}_dy > 0) dy_dir = 1;\n`;
            if (isPlayer) {
              code += `${indent}            if (dx_dir == 0 && dy_dir == 0) {\n`;
              code += `${indent}                if (bn::keypad::left_held()) dx_dir = -1;\n`;
              code += `${indent}                else if (bn::keypad::right_held()) dx_dir = 1;\n`;
              code += `${indent}                else if (bn::keypad::up_held()) dy_dir = -1;\n`;
              code += `${indent}                else if (bn::keypad::down_held()) dy_dir = 1;\n`;
              code += `${indent}                else dx_dir = 1;\n`;
              code += `${indent}            }\n`;
            } else {
              code += `${indent}            if (dx_dir == 0 && dy_dir == 0) dx_dir = 1;\n`;
            }
            code += `${indent}            if (dx_dir != 0 && dy_dir != 0) {\n`;
            code += `${indent}                proj_dx[p] = (dx_dir * bn::fixed(${speed}) * 707) / 1000;\n`;
            code += `${indent}                proj_dy[p] = (dy_dir * bn::fixed(${speed}) * 707) / 1000;\n`;
            code += `${indent}            } else {\n`;
            code += `${indent}                proj_dx[p] = dx_dir * bn::fixed(${speed});\n`;
            code += `${indent}                proj_dy[p] = dy_dir * bn::fixed(${speed});\n`;
            code += `${indent}            }\n`;
            code += `${indent}        }\n`;
          } else {
            code += `${indent}        {\n`;
            code += `${indent}            bn::fixed dx_dir = 0;\n`;
            code += `${indent}            bn::fixed dy_dir = 0;\n`;
            code += `${indent}            if (actor_${actorIndex}_dx < 0) dx_dir = -1;\n`;
            code += `${indent}            else if (actor_${actorIndex}_dx > 0) dx_dir = 1;\n`;
            code += `${indent}            if (actor_${actorIndex}_dy < 0) dy_dir = -1;\n`;
            code += `${indent}            else if (actor_${actorIndex}_dy > 0) dy_dir = 1;\n`;
            if (isPlayer) {
              code += `${indent}            if (dx_dir == 0 && dy_dir == 0) {\n`;
              code += `${indent}                if (bn::keypad::left_held()) dx_dir = -1;\n`;
              code += `${indent}                else if (bn::keypad::right_held()) dx_dir = 1;\n`;
              code += `${indent}                else if (bn::keypad::up_held()) dy_dir = -1;\n`;
              code += `${indent}                else if (bn::keypad::down_held()) dy_dir = 1;\n`;
              code += `${indent}                else dx_dir = 1;\n`;
              code += `${indent}            }\n`;
            } else {
              code += `${indent}            if (dx_dir == 0 && dy_dir == 0) dx_dir = 1;\n`;
            }
            code += `${indent}            if (dx_dir != 0 && dy_dir != 0) {\n`;
            code += `${indent}                proj_dx[p] = (dx_dir * bn::fixed(${speed}) * 707) / 1000;\n`;
            code += `${indent}                proj_dy[p] = (dy_dir * bn::fixed(${speed}) * 707) / 1000;\n`;
            code += `${indent}            } else {\n`;
            code += `${indent}                proj_dx[p] = dx_dir * bn::fixed(${speed});\n`;
            code += `${indent}                proj_dy[p] = dy_dir * bn::fixed(${speed});\n`;
            code += `${indent}            }\n`;
            code += `${indent}        }\n`;
          }
        }

        code += `${indent}        proj_active[p] = true;\n`;
        code += `${indent}        proj_lifetime[p] = 180;\n`;
        code += `${indent}        proj_from_player[p] = ${isPlayer};\n`;
        code += `${indent}        proj_sprites[p] = bn::sprite_items::${pName}.create_sprite(proj_x[p] - ${Math.floor(sDims.w / 2)}, proj_y[p] - ${Math.floor(sDims.h / 2)});\n`;
        code += `${indent}        proj_sprites[p]->set_palette(shared_sprite_palette);\n`;
        code += `${indent}        proj_sprites[p]->set_camera(camera);\n`;
        code += `${indent}        proj_sprites[p]->set_bg_priority(1);\n`;
        code += `${indent}        break;\n    }\n}\n`;
      }
    } else if (label === 'Check Projectile Hit') {
      if (actorIndex >= 0) {
        code += `${indent}bool proj_hit = false;\n${indent}for(int p=0; p<20; ++p) {\n${indent}    if(proj_active[p]) {\n`;
        const aCW = sActors[actorIndex]?.collisionW ?? actorWidth ?? 16;
        const aCH = sActors[actorIndex]?.collisionH ?? actorHeight ?? 16;
        const aCX = sActors[actorIndex]?.collisionX ?? 0;
        const aCY = sActors[actorIndex]?.collisionY ?? 0;
        code += `${indent}        if (proj_x[p] > actor_${actorIndex}_x + ${aCX} - 8 && proj_x[p] < actor_${actorIndex}_x + ${aCX} + ${aCW} + 8 &&\n`;
        code += `${indent}            proj_y[p] > actor_${actorIndex}_y + ${aCY} - 8 && proj_y[p] < actor_${actorIndex}_y + ${aCY} + ${aCH} + 8) {\n`;
        code += `${indent}            proj_active[p] = false;\n${indent}            proj_sprites[p].reset();\n${indent}            proj_hit = true;\n${indent}            break;\n`;
        code += `${indent}        }\n${indent}    }\n${indent}}\n${indent}if (proj_hit) {\n`;
        openBraces++;
      } else {
        code += `${indent}if (false) {\n`;
        openBraces++;
      }
    } else if (label === 'Check Map Boundary') {
      if (actorIndex >= 0) {
        const bnd = currentNode.data.boundary || 'left';
        const aCW = sActors[actorIndex]?.collisionW ?? actorWidth ?? 16;
        const aCH = sActors[actorIndex]?.collisionH ?? actorHeight ?? 16;
        const aCX = sActors[actorIndex]?.collisionX ?? 0;
        const aCY = sActors[actorIndex]?.collisionY ?? 0;
        if (bnd === 'left') code += `${indent}if (actor_${actorIndex}_x + ${aCX} < 0) {\n`;
        else if (bnd === 'right') code += `${indent}if (actor_${actorIndex}_x + ${aCX} + ${aCW} > ${sDims.w}) {\n`;
        else if (bnd === 'top') code += `${indent}if (actor_${actorIndex}_y + ${aCY} < 0) {\n`;
        else if (bnd === 'bottom') code += `${indent}if (actor_${actorIndex}_y + ${aCY} + ${aCH} > ${sDims.h}) {\n`;
        openBraces++;
      } else {
        code += `${indent}if (false) {\n`;
        openBraces++;
      }
    } else if (label === 'Check Collision') {
      code += `${indent}BN_LOG("Action: Check Collision");\n`;
      const enumVal = BUTANO_COLLISION_ENUMS[currentNode.data.collisionType || 'none'] || 'NONE';
      const tIdx = actorIndex >= 0 ? actorIndex : sActors.findIndex(a => a && a.type === 'player');
      if (tIdx !== -1) {
        const tw = Math.floor((sActors[tIdx].collisionW ?? sActors[tIdx].width ?? 16) / 2);
        const th = Math.floor((sActors[tIdx].collisionH ?? sActors[tIdx].height ?? 16) / 2);
        const cx = sActors[tIdx].collisionX ?? 0;
        const cy = sActors[tIdx].collisionY ?? 0;
        code += `${indent}if (${safeSceneName}_map::get_collision((actor_${tIdx}_x + ${cx} + ${tw}) / 8, (actor_${tIdx}_y + ${cy} + ${th}) / 8) == ${safeSceneName}_map::collision_type::${enumVal}) {\n`;
        openBraces++;
      } else {
        code += `${indent}if (false) {\n`;
        openBraces++;
      }
    } else if (label === 'Change Scene') {
      const targetSceneId = currentNode.data.sceneId;
      const targetSceneIdx = scenes.findIndex(s => s.id === targetSceneId);
      if (targetSceneIdx !== -1) {
        code += `${indent}return SceneId::SCENE_${targetSceneIdx};\n`;
      }
    } else if (label === 'Push Scene' || currentNode.data?.actionType === 'push_scene') {
      const targetSceneId = currentNode.data.sceneId;
      const targetSceneIdx = scenes.findIndex(s => s.id === targetSceneId);
      if (targetSceneIdx !== -1) {
        code += `${indent}BN_LOG("Action: Push Scene - scene_${targetSceneIdx}");\n`;
        code += `${indent}scene_stack[scene_stack_depth++] = static_cast<int>(current_scene_id);\n`;
        code += `${indent}return SceneId::SCENE_${targetSceneIdx};\n`;
      }
    } else if (label === 'Pop Scene' || currentNode.data?.actionType === 'pop_scene') {
      code += `${indent}BN_LOG("Action: Pop Scene");\n`;
      code += `${indent}if (scene_stack_depth > 0) {\n`;
      code += `${indent}    return static_cast<SceneId>(scene_stack[--scene_stack_depth]);\n`;
      code += `${indent}} else {\n`;
      code += `${indent}    return current_scene_id;\n`;
      code += `${indent}}\n`;
    } else if (label === 'Replace Scene' || currentNode.data?.actionType === 'replace_scene') {
      const targetSceneId = currentNode.data.sceneId;
      const targetSceneIdx = scenes.findIndex(s => s.id === targetSceneId);
      if (targetSceneIdx !== -1) {
        code += `${indent}BN_LOG("Action: Replace Scene - scene_${targetSceneIdx}");\n`;
        code += `${indent}return SceneId::SCENE_${targetSceneIdx};\n`;
      }
    } else if (label === 'Restart Current Scene' || label === 'Restart Scene' || currentNode.data?.actionType === 'restart_scene') {
      code += `${indent}BN_LOG("Action: Restart Scene");\n`;
      code += `${indent}return SceneId::SCENE_${currentSceneIdx};\n`;
    } else if (label === 'Spawn Actor' || currentNode.data?.actionType === 'spawn_actor') {
      const targetActorId = currentNode.data.targetActorId;
      const isVar = variables.some(v => v.name === String(targetActorId));
      let xVal = variables.some(v => v.name === String(currentNode.data.x))
        ? `(${resolveVarName(currentNode.data.x)} * 8)`
        : ((parseInt(currentNode.data.x) || 0) * 8);
      let yVal = variables.some(v => v.name === String(currentNode.data.y))
        ? `(${resolveVarName(currentNode.data.y)} * 8)`
        : ((parseInt(currentNode.data.y) || 0) * 8);
      if (currentNode.data.useCurrentPos && actorIndex >= 0) {
        xVal = `actor_${actorIndex}_float_x.integer()`;
        yVal = `actor_${actorIndex}_float_y.integer()`;
      }

      const isMoving = (a) => a.type === 'enemy'
        ? ((a.enemyBehavior || 'patrol') !== 'idle')
        : (a.isMoving ?? (a.type === 'movingPlatform'));
      if (isVar) {
        const varName = resolveVarName(targetActorId);
        code += `${indent}switch(${varName}) {\n`;
        sActors.forEach((a, idx) => {
          code += `${indent}    case ${idx}:\n`;
          code += `${indent}        actor_${idx}_float_x = ${xVal};\n`;
          code += `${indent}        actor_${idx}_float_y = ${yVal};\n`;
          code += `${indent}        actor_${idx}_x = ${xVal};\n`;
          code += `${indent}        actor_${idx}_y = ${yVal};\n`;
          code += `${indent}        actor_${idx}_active = true;\n`;
          code += `${indent}        actor_${idx}_dx = 0;\n`;
          code += `${indent}        actor_${idx}_dy = 0;\n`;
          code += `${indent}        actor_${idx}_timer = 0;\n`;
          code += `${indent}        actor_${idx}_sprite.set_visible(true);\n`;
          if (isMoving(a)) {
            code += `${indent}        actor_${idx}_start_x = ${xVal};\n`;
            code += `${indent}        actor_${idx}_start_y = ${yVal};\n`;
            code += `${indent}        actor_${idx}_dir = 1;\n`;
          }
          code += `${indent}        break;\n`;
        });
        code += `${indent}}\n`;
      } else {
        const targetActorIdx = sActors.findIndex(a => a && String(a.id) === String(targetActorId));
        if (targetActorIdx !== -1) {
          const spawnActor = sActors[targetActorIdx];
          code += `${indent}actor_${targetActorIdx}_float_x = ${xVal};\n`;
          code += `${indent}actor_${targetActorIdx}_float_y = ${yVal};\n`;
          code += `${indent}actor_${targetActorIdx}_x = ${xVal};\n`;
          code += `${indent}actor_${targetActorIdx}_y = ${yVal};\n`;
          code += `${indent}actor_${targetActorIdx}_active = true;\n`;
          code += `${indent}actor_${targetActorIdx}_dx = 0;\n`;
          code += `${indent}actor_${targetActorIdx}_dy = 0;\n`;
          code += `${indent}actor_${targetActorIdx}_timer = 0;\n`;
          code += `${indent}actor_${targetActorIdx}_sprite.set_visible(true);\n`;
          if (isMoving(spawnActor)) {
            code += `${indent}actor_${targetActorIdx}_start_x = ${xVal};\n`;
            code += `${indent}actor_${targetActorIdx}_start_y = ${yVal};\n`;
            code += `${indent}actor_${targetActorIdx}_dir = 1;\n`;
          }
        }
      }
    } else if (label === 'Destroy Actor' || currentNode.data?.actionType === 'destroy_actor') {
      const targetActorId = currentNode.data.targetActorId;
      const isVar = variables.some(v => v && v.name === String(targetActorId));
      if (isVar) {
        const varName = resolveVarName(targetActorId);
        code += `${indent}BN_LOG("Action: Destroy Actor by Variable Index");\n`;
        code += `${indent}switch(${varName}) {\n`;
        sActors.forEach((a, idx) => {
          if (!a) return;
          code += `${indent}    case ${idx}:\n`;
          code += `${indent}        actor_${idx}_active = false;\n`;
          code += `${indent}        actor_${idx}_sprite.set_visible(false);\n`;
          code += `${indent}        break;\n`;
        });
        code += `${indent}}\n`;
      } else {
        const targetActorIdx = targetActorId ? sActors.findIndex(a => a &&  a && String(a.id) === String(targetActorId)) : actorIndex;
        if (targetActorIdx >= 0) {
          code += `${indent}BN_LOG("Action: Destroy Actor");\n`;
          code += `${indent}actor_${targetActorIdx}_active = false;\n`;
          code += `${indent}actor_${targetActorIdx}_sprite.set_visible(false);\n`;
        }
      }
    } else if (label === 'Play Animation' || currentNode.data?.actionType === 'play_animation') {
      const targetActorId = currentNode.data.targetActorId;
      const animId = currentNode.data.animId;
      const targetActorIdx = targetActorId ? sActors.findIndex(a => a && String(a.id) === String(targetActorId)) : actorIndex;
      
      if (targetActorIdx !== -1) {
        const targetActor = sActors[targetActorIdx];
        let stateId = 0;
        let lockFrames = 0;
        
        if (targetActor.walkAnimId && String(targetActor.walkAnimId) === String(animId)) {
          stateId = 1;
        } else if (targetActor.jumpAnimId && String(targetActor.jumpAnimId) === String(animId)) {
          stateId = 2;
          const jumpAnim = animations.find(an => an && an.id === animId);
          if (jumpAnim) {
            const fps = jumpAnim.fps > 0 ? jumpAnim.fps : 8;
            const framesCount = jumpAnim.frames ? jumpAnim.frames.length : 1;
            lockFrames = framesCount * Math.floor(60 / fps);
          } else {
            lockFrames = 60;
          }
        } else if (targetActor.__customAnimData) {
          const cad = targetActor.__customAnimData.find(c => String(c.animId) === String(animId));
          if (cad) {
            stateId = cad.stateId;
            const fps = cad.fps > 0 ? cad.fps : 8;
            const framesCount = cad.indices ? cad.indices.length : 1;
            lockFrames = framesCount * Math.floor(60 / fps);
          }
        }
        
        code += `${indent}actor_${targetActorIdx}_anim_state = ${stateId};\n`;
        code += `${indent}actor_${targetActorIdx}_anim_idx = 0;\n`;
        code += `${indent}actor_${targetActorIdx}_anim_timer = 0;\n`;
        code += `${indent}actor_${targetActorIdx}_anim_lock = ${lockFrames};\n`;
        if (targetActor.type === 'player' && targetActor.playerAnimFireProjectile) {
          code += `${indent}actor_${targetActorIdx}_anim_fired = false;\n`;
        }
      }
    } else if (label === 'Set Animation Speed' || currentNode.data?.actionType === 'set_anim_speed') {
      const targetActorId = currentNode.data?.targetActorId;
      const speedVal = parseFloat(currentNode.data?.speed) || 1;
      if (targetActorId !== null && targetActorId !== undefined) {
        const targetActorIdx = sActors.findIndex(a => a && a.id === targetActorId);
        if (targetActorIdx !== -1) {
          code += `${indent}actor_${targetActorIdx}_anim_speed = bn::fixed(${speedVal});\n`;
        }
      }
    } else if (label === 'Set Movement Speed' || currentNode.data?.actionType === 'set_movement_speed') {
      const targetActorId = currentNode.data?.targetActorId;
      const speedVal = parseFloat(currentNode.data?.speed) || 1;
      if (targetActorId !== null && targetActorId !== undefined) {
        const targetActorIdx = sActors.findIndex(a => a && a.id === targetActorId);
        if (targetActorIdx !== -1) {
          code += `${indent}actor_${targetActorIdx}_movement_speed = bn::fixed(${speedVal});\n`;
        }
      }
    } else if (label === 'Start Update' || currentNode.data?.actionType === 'start_update') {
      const targetActorId = currentNode.data?.targetActorId;
      if (targetActorId !== null && targetActorId !== undefined) {
        const targetActorIdx = sActors.findIndex(a => a && a.id === targetActorId);
        if (targetActorIdx !== -1) {
          code += `${indent}actor_${targetActorIdx}_update_enabled = true;\n`;
        }
      }
    } else if (label === 'Stop Update' || currentNode.data?.actionType === 'stop_update') {
      const targetActorId = currentNode.data?.targetActorId;
      if (targetActorId !== null && targetActorId !== undefined) {
        const targetActorIdx = sActors.findIndex(a => a && a.id === targetActorId);
        if (targetActorIdx !== -1) {
          code += `${indent}actor_${targetActorIdx}_update_enabled = false;\n`;
        }
      }
    } else if (label === 'Attach Input Script' || currentNode.data?.actionType === 'attach_input_script') {
      const btn = (Array.isArray(currentNode.data?.input) ? currentNode.data.input[0] : 'a') || 'a';
      code += `${indent}BN_LOG("Action: Attach Input Script - ${btn}");\n`;
    } else if (label === 'Draw Text' || currentNode.data?.actionType === 'draw_text') {
      const drawText = safeStr(currentNode.data?.text || '');
      const drawX = parseInt(currentNode.data?.x) || 0;
      const drawY = parseInt(currentNode.data?.y) || 0;
      const drawLoc = currentNode.data?.location || 'background';
      code += `${indent}BN_LOG("Action: Draw Text - ${drawText} at (${drawX},${drawY}) on ${drawLoc}");\n`;
    } else if (label === 'Move Camera' || currentNode.data?.actionType === 'move_camera') {
      const targetType = currentNode.data?.targetType || 'custom';
      if (targetType === 'reset') {
        code += `${indent}camera_custom_control = false;\n`;
      } else {
        const mapW = sDims?.w ?? 240;
        const mapH = sDims?.h ?? 160;
        let xVal;
        if (variables.some(v => v.name === String(currentNode.data?.x))) {
          xVal = `(bn::fixed(${resolveVarName(currentNode.data.x)}) * 8 + 4 - ${Math.floor(mapW / 2)})`;
        } else {
          xVal = `bn::fixed(${(parseInt(currentNode.data?.x) || 0) * 8 + 4 - Math.floor(mapW / 2)})`;
        }

        let yVal;
        if (variables.some(v => v.name === String(currentNode.data?.y))) {
          yVal = `(bn::fixed(${resolveVarName(currentNode.data.y)}) * 8 + 4 - ${Math.floor(mapH / 2)})`;
        } else {
          yVal = `bn::fixed(${(parseInt(currentNode.data?.y) || 0) * 8 + 4 - Math.floor(mapH / 2)})`;
        }

        let speedVal;
        if (variables.some(v => v.name === String(currentNode.data?.speed))) {
          speedVal = `bn::fixed(${resolveVarName(currentNode.data.speed)})`;
        } else {
          speedVal = `bn::fixed(${parseFloat(currentNode.data?.speed) || 2.0})`;
        }

        const instantVal = currentNode.data?.instant === true;

        code += `${indent}camera_target_x = ${xVal};\n`;
        code += `${indent}camera_target_y = ${yVal};\n`;
        code += `${indent}camera_speed = ${speedVal};\n`;
        code += `${indent}camera_instant = ${instantVal ? 'true' : 'false'};\n`;
        code += `${indent}camera_custom_control = true;\n`;
      }
    } else if (label === 'Camera Shake' || currentNode.data?.actionType === 'camera_shake') {
      const shakeTime = parseFloat(currentNode.data?.time) || 0.2;
      const shakeFrames = Math.round(shakeTime * 60);
      const magnitude = parseFloat(currentNode.data?.magnitude) || 2;
      const direction = currentNode.data?.direction || 'horizontal';
      code += `${indent}{\n`;
      code += `${indent}    bn::fixed orig_x = camera_target_x;\n`;
      code += `${indent}    bn::fixed orig_y = camera_target_y;\n`;
      code += `${indent}    for (int i = 0; i < ${shakeFrames}; i++) {\n`;
      if (direction === 'horizontal') {
        code += `${indent}        camera_target_x = orig_x + (i % 2 == 0 ? bn::fixed(${magnitude}) : bn::fixed(-${magnitude}));\n`;
      } else if (direction === 'vertical') {
        code += `${indent}        camera_target_y = orig_y + (i % 2 == 0 ? bn::fixed(${magnitude}) : bn::fixed(-${magnitude}));\n`;
      } else {
        code += `${indent}        camera_target_x = orig_x + (i % 2 == 0 ? bn::fixed(${magnitude}) : bn::fixed(-${magnitude}));\n`;
        code += `${indent}        camera_target_y = orig_y + (i % 2 == 0 ? bn::fixed(${magnitude}) : bn::fixed(-${magnitude}));\n`;
      }
      code += `${indent}        bn::core::update();\n`;
      code += `${indent}    }\n`;
      code += `${indent}    camera_target_x = orig_x;\n`;
      code += `${indent}    camera_target_y = orig_y;\n`;
      code += `${indent}}\n`;
    } else if (label === 'Fade In' || currentNode.data?.actionType === 'fade_in') {
      const fadeSpeed = parseInt(currentNode.data?.speed) || 1;
      const speedFrames = fadeSpeed === 0 ? 0 : fadeSpeed === 1 ? 15 : fadeSpeed === 2 ? 30 : 60;
      code += `${indent}{\n`;
      code += `${indent}    bn::regular_bg_ptr fade_bg = bn::regular_bg_items::fade_overlay_bg.create_bg(0, 0);\n`;
      code += `${indent}    fade_bg.set_blending_enabled(true);\n`;
      code += `${indent}    fade_bg.set_priority(0);\n`;
      if (speedFrames > 0) {
        code += `${indent}    for (int f = ${speedFrames}; f >= 0; f--) {\n`;
        code += `${indent}        fade_bg.set_alpha(bn::fixed(f) / ${speedFrames});\n`;
        code += `${indent}        bn::core::update();\n`;
        code += `${indent}    }\n`;
      }
      code += `${indent}}\n`;
    } else if (label === 'Fade Out' || currentNode.data?.actionType === 'fade_out') {
      const fadeSpeed = parseInt(currentNode.data?.speed) || 1;
      const speedFrames = fadeSpeed === 0 ? 0 : fadeSpeed === 1 ? 15 : fadeSpeed === 2 ? 30 : 60;
      code += `${indent}{\n`;
      code += `${indent}    bn::regular_bg_ptr fade_bg = bn::regular_bg_items::fade_overlay_bg.create_bg(0, 0);\n`;
      code += `${indent}    fade_bg.set_blending_enabled(true);\n`;
      code += `${indent}    fade_bg.set_priority(0);\n`;
      if (speedFrames > 0) {
        code += `${indent}    fade_bg.set_alpha(bn::fixed(0));\n`;
        code += `${indent}    for (int f = 1; f <= ${speedFrames}; f++) {\n`;
        code += `${indent}        fade_bg.set_alpha(bn::fixed(f) / ${speedFrames});\n`;
        code += `${indent}        bn::core::update();\n`;
        code += `${indent}    }\n`;
      } else {
        code += `${indent}    fade_bg.set_alpha(bn::fixed(1));\n`;
      }
      code += `${indent}}\n`;
    } else if (label === 'Camera Lock' || currentNode.data?.actionType === 'camera_lock') {
      code += `${indent}camera_custom_control = false;\n`;
    } else if (label === 'Set Direction' || currentNode.data?.actionType === 'set_direction') {
      const targetActorId = currentNode.data?.targetActorId;
      const direction = currentNode.data?.direction || 'down';
      if (targetActorId !== null && targetActorId !== undefined) {
        const targetActorIdx = sActors.findIndex(a => a && a.id === targetActorId);
        if (targetActorIdx !== -1) {
          if (direction === 'up') {
            code += `${indent}actor_${targetActorIdx}_last_dx_dir = 0;\n`;
            code += `${indent}actor_${targetActorIdx}_last_dy_dir = -1;\n`;
          } else if (direction === 'down') {
            code += `${indent}actor_${targetActorIdx}_last_dx_dir = 0;\n`;
            code += `${indent}actor_${targetActorIdx}_last_dy_dir = 1;\n`;
          } else if (direction === 'left') {
            code += `${indent}actor_${targetActorIdx}_last_dx_dir = -1;\n`;
            code += `${indent}actor_${targetActorIdx}_last_dy_dir = 0;\n`;
          } else if (direction === 'right') {
            code += `${indent}actor_${targetActorIdx}_last_dx_dir = 1;\n`;
            code += `${indent}actor_${targetActorIdx}_last_dy_dir = 0;\n`;
          }
        }
      }
    } else if (label === 'Await Input' || currentNode.data?.actionType === 'await_input') {
      code += `${indent}while (!bn::keypad::a_pressed() && !bn::keypad::b_pressed() && !bn::keypad::start_pressed()) { bn::core::update(); }\n`;
    } else if (label === 'Actor Emote' || currentNode.data?.actionType === 'actor_emote') {
      const targetActorId = currentNode.data?.targetActorId;
      const emote = currentNode.data?.emote || 'exclamation';
      if (targetActorId !== null && targetActorId !== undefined) {
        const targetActorIdx = sActors.findIndex(a => a && a.id === targetActorId);
        if (targetActorIdx !== -1) {
          const charMap = { exclamation: '!', question: '?', music: '>', sleep: '.' };
          const ch = charMap[emote] || '!';
          code += `${indent}{\n`;
          code += `${indent}    bn::vector<bn::sprite_ptr, 4> emote_sprites;\n`;
          code += `${indent}    int ex = actor_${targetActorIdx}_sprite.x().integer() - camera.x().integer();\n`;
          code += `${indent}    int ey = actor_${targetActorIdx}_sprite.y().integer() - camera.y().integer() - 20;\n`;
          code += `${indent}    auto e_item = get_dialog_char_sprite_item('${ch}');\n`;
          code += `${indent}    if (e_item) {\n`;
          code += `${indent}        bn::sprite_ptr es = e_item->create_sprite(ex, ey);\n`;
          code += `${indent}        es.set_palette(dialog_text_palette);\n`;
          code += `${indent}        es.set_bg_priority(0);\n`;
          code += `${indent}        es.set_z_order(-32767);\n`;
          code += `${indent}        emote_sprites.push_back(es);\n`;
          code += `${indent}    }\n`;
          code += `${indent}    for (int w = 0; w < 60; w++) { bn::core::update(); }\n`;
          code += `${indent}}\n`;
        }
      }
    } else if (label === 'Overlay Show' || currentNode.data?.actionType === 'overlay_show') {
      const overlayX = parseInt(currentNode.data?.x) || 0;
      const overlayY = parseInt(currentNode.data?.y) || 0;
      const overlayColor = currentNode.data?.color || 'white';
      code += `${indent}if (!scene_overlay_bg) {\n`;
      if (overlayColor === 'black') {
        code += `${indent}    scene_overlay_bg = bn::regular_bg_items::fade_overlay_bg.create_bg(${overlayX * 8 - 120}, ${overlayY * 8 - 80});\n`;
      } else {
        code += `${indent}    scene_overlay_bg = bn::regular_bg_items::dialog_bg.create_bg(${overlayX * 8 - 120}, ${overlayY * 8 - 80});\n`;
      }
      code += `${indent}    scene_overlay_bg->set_priority(0);\n`;
      code += `${indent}}\n`;
    } else if (label === 'Overlay Hide' || currentNode.data?.actionType === 'overlay_hide') {
      code += `${indent}scene_overlay_bg.reset();\n`;
    } else if (label === 'Set Text Speed' || currentNode.data?.actionType === 'text_set_anim_speed') {
      const textSpeed = parseInt(currentNode.data?.speed) || 1;
      const speedFrames = textSpeed === 0 ? 0 : textSpeed === 1 ? 1 : textSpeed === 2 ? 3 : 6;
      code += `${indent}text_anim_speed = ${speedFrames};\n`;
    } else if (label === 'Set Actor Sprite' || currentNode.data?.actionType === 'set_actor_sprite') {
      const targetActorId = currentNode.data?.targetActorId;
      if (targetActorId !== null && targetActorId !== undefined) {
        const targetActorIdx = sActors.findIndex(a => a && a.id === targetActorId);
        if (targetActorIdx !== -1) {
          const spriteItemName = currentNode.data?.computedSpriteItemName;
          if (spriteItemName) {
            code += `${indent}// Set Actor Sprite: change actor ${targetActorIdx} to ${spriteItemName}\n`;
            code += `${indent}actor_${targetActorIdx}_sprite.set_tiles(bn::sprite_items::${spriteItemName}.tiles_item().create_tiles(0));\n`;
          } else {
            code += `${indent}// Set Actor Sprite: actor ${targetActorIdx} (sprite item not generated - try using a sprite sheet that exists in the project)\n`;
          }
        }
      }
    } else if (label === 'Set Actor Flip' || currentNode.data?.actionType === 'set_actor_flip') {
      const targetActorId = currentNode.data?.targetActorId;
      const flipX = currentNode.data?.flipX || false;
      const flipY = currentNode.data?.flipY || false;
      if (targetActorId !== null && targetActorId !== undefined) {
        const targetActorIdx = sActors.findIndex(a => a && a.id === targetActorId);
        if (targetActorIdx !== -1) {
          code += `${indent}actor_${targetActorIdx}_sprite.set_horizontal_flip(${flipX ? 'true' : 'false'});\n`;
          code += `${indent}actor_${targetActorIdx}_sprite.set_vertical_flip(${flipY ? 'true' : 'false'});\n`;
        }
      }
    } else if (label === 'Play Sound') {
      code += `${indent}bn::sound_items::${currentNode.data.computedSoundName || 'snd_square_440_100'}.play();\n`;
    } else if (label === 'Music Control') {
      const mAction = currentNode.data.musicAction || 'pause';
      code += `${indent}BN_LOG("Action: Music Control ${mAction}");\n`;
      if (mAction === 'pause') code += `${indent}if(bn::music::playing()){bn::music::pause();}\n`;
      else if (mAction === 'resume') code += `${indent}if(bn::music::paused()){bn::music::resume();}\n`;
      else if (mAction === 'stop') code += `${indent}bn::music::stop();\n`;
    } else if (label === 'Set Timer' || currentNode.data?.actionType === 'set_timer') {
      const timerIdx = currentNode.data?.timerIndex || 1;
      const durationFrames = Math.round((parseFloat(currentNode.data?.duration) || 0.5) * 60);
      code += `${indent}timer_${timerIdx}_frames = ${durationFrames};\n`;
    } else if (label === 'Timer Disable' || currentNode.data?.actionType === 'timer_disable') {
      const timerIdx = currentNode.data?.timerIndex || 1;
      code += `${indent}BN_LOG("Action: Timer Disable ${timerIdx}");\n`;
      code += `${indent}timer_${timerIdx}_frames = 0;\n`;
      code += `${indent}timer_${timerIdx}_active = false;\n`;
    } else if (label === 'Timer Restart' || currentNode.data?.actionType === 'timer_restart') {
      const timerIdx = currentNode.data?.timerIndex || 1;
      code += `${indent}BN_LOG("Action: Timer Restart ${timerIdx}");\n`;
      code += `${indent}timer_${timerIdx}_frames = timer_${timerIdx}_max_frames;\n`;
      code += `${indent}timer_${timerIdx}_active = true;\n`;
    } else if (label === 'Run Script') {
      const targetScriptId = currentNode.data.scriptId;
      if (targetScriptId && !callStack.has(targetScriptId)) {
        const targetScript = customScripts.find(s => s &&  s && s.id === targetScriptId);
        if (targetScript) {
          code += `${indent}// --- Run Script: ${safeStr(targetScript.name)} ---\n`;
          const nextCallStack = new Set(callStack);
          nextCallStack.add(targetScriptId);
          code += generateScriptLogic(targetScript.script, actorIndex, actorWidth, actorHeight, baseIndent + openBraces, nextCallStack, {
            dialogs, safeSceneName, scenes, sActors, sDims, customScripts, variables,
            currentSceneIdx, startingSceneIdx, scene
          });
        }
      }
    } else if (label === 'Set Variable') {
      const sv = resolveVarName(currentNode.data.varName);
      if (sv) {
        const variable = variables.find(v => v &&  v && v.name === currentNode.data.varName);
        let val = translateExpr(safeStr(currentNode.data.varValue));
        if (variable && variable.type === 'string') {
          val = `"${val.replace(/"/g, '\\"')}"`;
        } else if (variable && variable.type === 'float') {
          if (!val.endsWith('f') && !isNaN(parseFloat(val))) {
            val = `${val}f`;
          }
        }
        if (!val) {
          val = (variable && variable.type === 'string') ? '""' : (variable && variable.type === 'float') ? '0.0f' : '0';
        }
        code += `${indent}${sv} = ${val};\n`;
      }
    } else if (label === 'Check Variable') {
      const sv = resolveVarName(currentNode.data.varName);
      if (sv) {
        const variable = variables.find(v => v &&  v && v.name === currentNode.data.varName);
        let val = translateExpr(safeStr(currentNode.data.varValue));
        if (variable && variable.type === 'string') {
          val = `"${val.replace(/"/g, '\\"')}"`;
        } else if (variable && variable.type === 'float') {
          if (!val.endsWith('f') && !isNaN(parseFloat(val))) {
            val = `${val}f`;
          }
        }
        if (!val) {
          val = (variable && variable.type === 'string') ? '""' : (variable && variable.type === 'float') ? '0.0f' : '0';
        }
        code += `${indent}if (${sv} == ${val}) {\n`; openBraces++;
      }
    } else if (label === 'Set Flag' || currentNode.data?.actionType === 'set_flag') {
      const flagName = resolveVarName(currentNode.data.flag);
      if (flagName) {
        code += `${indent}BN_LOG("Action: Set Flag ${flagName}");\n`;
        code += `${indent}${flagName} = 1;\n`;
      }
    } else if (label === 'Clear Flag' || currentNode.data?.actionType === 'clear_flag') {
      const flagName = resolveVarName(currentNode.data.flag);
      if (flagName) {
        code += `${indent}BN_LOG("Action: Clear Flag ${flagName}");\n`;
        code += `${indent}${flagName} = 0;\n`;
      }
    } else if (label === 'Check Flag' || currentNode.data?.actionType === 'check_flag') {
      const flagName = resolveVarName(currentNode.data.flag);
      const shouldMatch = currentNode.data.matches !== false;
      if (flagName) {
        code += `${indent}BN_LOG("Action: Check Flag ${flagName} == ${shouldMatch ? 1 : 0}");\n`;
        code += `${indent}if (${flagName} ${shouldMatch ? '==' : '!='} 1) {\n`; openBraces++;
      }
    } else if (label === 'Math Operation') {
      const safeVarName = resolveVarName(currentNode.data.varName);
      const safeOp = currentNode.data.operator || '+=';
      const safeVal = safeStr(currentNode.data.value);
      code += `${indent}BN_LOG("Action: Math Operation ${safeVarName} ${safeOp} ${safeVal}");\n`;
      if (safeVarName && safeVal) code += `${indent}${safeVarName} ${safeOp} ${safeVal};\n`;
    } else if (label === 'Set Random Var') {
      const safeVarName = resolveVarName(currentNode.data.varName);
      const min = parseInt(currentNode.data.min) || 0;
      const max = parseInt(currentNode.data.max) || 10;
      const range = max - min + 1;
      code += `${indent}BN_LOG("Action: Set Random Var ${safeVarName} between ${min} and ${max}");\n`;
      if (safeVarName) code += `${indent}${safeVarName} = ${min} + rng.get_int(${range});\n`;
    } else if (label === 'Math Equation') {
      const safeVarName = resolveVarName(currentNode.data.targetVar);
      const rawEq = currentNode.data.equation || '';
      let sanitizedEq = rawEq;
      const sortedVars = variables.filter(v => v.type !== 'group').sort((a, b) => b.name.length - a.name.length);
      sortedVars.forEach(v => {
        const safeName = resolveVarName(v.name);
        const escapedName = v.name.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const regex = new RegExp(`\\b${escapedName}\\b`, 'g');
        sanitizedEq = sanitizedEq.replace(regex, safeName);
      });
      sanitizedEq = translateExpr(sanitizedEq);
      code += `${indent}BN_LOG("Action: Math Equation ${safeVarName} = ${safeStr(rawEq)}");\n`;
      if (safeVarName && sanitizedEq) {
        code += `${indent}${safeVarName} = ${sanitizedEq};\n`;
      }
    } else if (label === 'Save Game') {
      code += `${indent}BN_LOG("Action: Save Game");\n`;
      code += `${indent}{\n`;
      code += `${indent}    SaveData _save = {};\n`;
      const playerIdx = sActors.findIndex(a => a && a.type === 'player');
      if (playerIdx !== -1) {
        code += `${indent}    _save.player_x = actor_${playerIdx}_x;\n`;
        code += `${indent}    _save.player_y = actor_${playerIdx}_y;\n`;
      } else {
        code += `${indent}    _save.player_x = 0;\n`;
        code += `${indent}    _save.player_y = 0;\n`;
      }
      code += `${indent}    _save.player_scene = ${currentSceneIdx};\n`;
      variables.forEach(v => {
        if (v.type === 'group') return;
        if (v.type !== 'random') {
          const sv = String(v.name ?? '').replace(/[^a-zA-Z0-9_]/g, '_');
          const resolvedSv = resolveVarName(v.name);
          if (sv) code += `${indent}    _save.${sv} = ${resolvedSv};\n`;
        }
      });
      code += `${indent}    bn::sram::write(_save);\n`;
      code += `${indent}}\n`;
    } else if (label === 'Load Game') {
      code += `${indent}BN_LOG("Action: Load Game");\n`;
      code += `${indent}{\n`;
      code += `${indent}    SaveData _save = {};\n`;
      code += `${indent}    bn::sram::read(_save);\n`;
      code += `${indent}    if (_save.player_scene < 0 || _save.player_scene >= ${scenes.length}) _save.player_scene = ${startingSceneIdx};\n`;
      variables.forEach(v => {
        if (v.type === 'group') return;
        if (v.type !== 'random') {
          const sv = String(v.name ?? '').replace(/[^a-zA-Z0-9_]/g, '_');
          const resolvedSv = resolveVarName(v.name);
          if (sv) code += `${indent}    ${resolvedSv} = _save.${sv};\n`;
        }
      });
      code += `${indent}    global_spawn_x = _save.player_x;\n`;
      code += `${indent}    global_spawn_y = _save.player_y;\n`;
      const playerIdx = sActors.findIndex(a => a && a.type === 'player');
      if (playerIdx !== -1) {
        code += `${indent}    if (_save.player_scene == ${currentSceneIdx}) {\n`;
        code += `${indent}        actor_${playerIdx}_float_x = _save.player_x;\n`;
        code += `${indent}        actor_${playerIdx}_float_y = _save.player_y;\n`;
        code += `${indent}        actor_${playerIdx}_x = _save.player_x;\n`;
        code += `${indent}        actor_${playerIdx}_y = _save.player_y;\n`;
        code += `${indent}        actor_${playerIdx}_sprite.set_x(actor_${playerIdx}_x - ${Math.floor(sDims.w / 2)} + ${Math.floor((sActors[playerIdx].width || 16) / 2)});\n`;
        code += `${indent}        actor_${playerIdx}_sprite.set_y(actor_${playerIdx}_y - ${Math.floor(sDims.h / 2)} + ${Math.floor((sActors[playerIdx].height || 16) / 2)});\n`;
        code += `${indent}    } else {\n`;
        code += `${indent}        return static_cast<SceneId>(_save.player_scene);\n`;
        code += `${indent}    }\n`;
      } else {
        code += `${indent}    return static_cast<SceneId>(_save.player_scene);\n`;
      }
      code += `${indent}}\n`;
    } else if (label === 'Restart Game') {
      code += `${indent}BN_LOG("Action: Restart Game");\n`;
      code += `${indent}{\n`;
      code += `${indent}    SaveData _save = {};\n`;
      variables.forEach(v => {
        if (v.type === 'group') return;
        if (v.type !== 'random') {
          const sv = String(v.name ?? '').replace(/[^a-zA-Z0-9_]/g, '_');
          if (sv) {
            if (v.type === 'boolean') {
              code += `${indent}    _save.${sv} = ${v.initialValue ? 'true' : 'false'};\n`;
            } else if (v.type === 'string') {
              const initVal = String(v.initialValue || '').replace(/"/g, '\\"');
              code += `${indent}    _save.${sv} = "${initVal}";\n`;
            } else if (v.type === 'float') {
              const floatVal = parseFloat(v.initialValue);
              const safeFloat = isNaN(floatVal) ? 0.0 : floatVal;
              const floatStr = String(safeFloat).includes('.') ? String(safeFloat) : safeFloat.toFixed(1);
              code += `${indent}    _save.${sv} = ${floatStr}f;\n`;
            } else {
              code += `${indent}    _save.${sv} = ${parseInt(v.initialValue) || 0};\n`;
            }
          }
        }
      });
      code += `${indent}    _save.player_x = 0;\n`;
      code += `${indent}    _save.player_y = 0;\n`;
      code += `${indent}    _save.player_scene = ${startingSceneIdx};\n`;
      code += `${indent}    bn::sram::write(_save);\n`;
      code += `${indent}    bn::core::reset();\n`;
      code += `${indent}}\n`;
    } else if (label === 'Check Random') {
      const chance = parseInt(currentNode.data.chance) || 2;
      code += `${indent}if (rng.get_int(${chance}) == 0) {\n`; openBraces++;
    } else if (label === 'Check Distance') {
      const a1Id = currentNode.data.actor1Id;
      const a2Id = currentNode.data.actor2Id;
      const a1Idx = a1Id ? sActors.findIndex(a => a && String(a.id) === String(a1Id)) : actorIndex;
      const a2Idx = a2Id ? sActors.findIndex(a => a && String(a.id) === String(a2Id)) : -1;
      const dist = currentNode.data.distance !== undefined ? parseInt(currentNode.data.distance) : 32;
      let op = currentNode.data.operator || '<';
      if (!['<', '<=', '>', '>=', '=='].includes(op)) op = '<';
      code += `${indent}BN_LOG("Action: Check Distance");\n`;
      if (a1Idx !== -1 && a2Idx !== -1) {
        code += `${indent}if (((actor_${a1Idx}_x - actor_${a2Idx}_x) * (actor_${a1Idx}_x - actor_${a2Idx}_x) + (actor_${a1Idx}_y - actor_${a2Idx}_y) * (actor_${a1Idx}_y - actor_${a2Idx}_y)) ${op} ${dist * dist}) {\n`;
        openBraces++;
      } else {
        code += `${indent}if (false) {\n`;
        openBraces++;
      }
    } else if (label === 'Check Hovering Actor') {
      const targetActorId = currentNode.data.targetActorId;
      const targetActorIdx = targetActorId ? sActors.findIndex(a => a && String(a.id) === String(targetActorId)) : actorIndex;
      const playerIdx = sActors.findIndex(a => a && a.type === 'player');
      code += `${indent}BN_LOG("Action: Check Hovering Actor");\n`;
      if (targetActorIdx !== -1 && playerIdx !== -1) {
        const targetAct = sActors[targetActorIdx];
        const oCX = targetAct.collisionX ?? 0;
        const oCY = targetAct.collisionY ?? 0;
        const oCW = targetAct.collisionW ?? targetAct.width ?? 16;
        const oCH = targetAct.collisionH ?? targetAct.height ?? 16;
        code += `${indent}if (actor_${targetActorIdx}_active &&\n`;
        code += `${indent}    actor_${playerIdx}_x >= actor_${targetActorIdx}_x + ${oCX} && actor_${playerIdx}_x < actor_${targetActorIdx}_x + ${oCX} + ${oCW} &&\n`;
        code += `${indent}    actor_${playerIdx}_y >= actor_${targetActorIdx}_y + ${oCY} && actor_${playerIdx}_y < actor_${targetActorIdx}_y + ${oCY} + ${oCH}) {\n`;
        openBraces++;
      } else {
        code += `${indent}if (false) {\n`;
        openBraces++;
      }
    } else if (label === 'Get Cursor Position') {
      const playerIdx = sActors.findIndex(a => a && a.type === 'player');
      const svX = resolveVarName(currentNode.data.varXName);
      const svY = resolveVarName(currentNode.data.varYName);
      code += `${indent}BN_LOG("Action: Get Cursor Position");\n`;
      if (playerIdx !== -1) {
        if (svX) code += `${indent}${svX} = actor_${playerIdx}_x;\n`;
        if (svY) code += `${indent}${svY} = actor_${playerIdx}_y;\n`;
      }
    } else if (label === 'Get Actor Position' || currentNode.data?.actionType === 'get_actor_pos') {
      const targetActorId = currentNode.data.targetActorId;
      const targetActorIdx = targetActorId ? sActors.findIndex(a => a && String(a.id) === String(targetActorId)) : actorIndex;
      const svX = resolveVarName(currentNode.data.varXName);
      const svY = resolveVarName(currentNode.data.varYName);
      const inTiles = currentNode.data.positionUnit === 'tiles';
      code += `${indent}BN_LOG("Action: Get Actor Position");\n`;
      if (targetActorIdx !== -1) {
        if (svX) code += `${indent}${svX} = ${inTiles ? `actor_${targetActorIdx}_x / 8` : `actor_${targetActorIdx}_x`};\n`;
        if (svY) code += `${indent}${svY} = ${inTiles ? `actor_${targetActorIdx}_y / 8` : `actor_${targetActorIdx}_y`};\n`;
      }
    } else if (label === 'Set Cursor Position') {
      const playerIdx = sActors.findIndex(a => a && a.type === 'player');
      const xVal = variables.some(v => v.name === String(currentNode.data.x))
        ? resolveVarName(currentNode.data.x)
        : (parseInt(currentNode.data.x) ?? 120);
      const yVal = variables.some(v => v.name === String(currentNode.data.y))
        ? resolveVarName(currentNode.data.y)
        : (parseInt(currentNode.data.y) ?? 80);
      code += `${indent}BN_LOG("Action: Set Cursor Position");\n`;
      if (playerIdx !== -1) {
        const pcActor = sActors[playerIdx];
        code += `${indent}actor_${playerIdx}_float_x = ${xVal};\n`;
        code += `${indent}actor_${playerIdx}_float_y = ${yVal};\n`;
        code += `${indent}actor_${playerIdx}_x = ${xVal};\n`;
        code += `${indent}actor_${playerIdx}_y = ${yVal};\n`;
        code += `${indent}actor_${playerIdx}_sprite.set_x(actor_${playerIdx}_x - ${Math.floor(sDims.w / 2)} + ${Math.floor((pcActor.width || 16) / 2)});\n`;
        code += `${indent}actor_${playerIdx}_sprite.set_y(actor_${playerIdx}_y - ${Math.floor(sDims.h / 2)} + ${Math.floor((pcActor.height || 16) / 2)});\n`;
      }
    } else if (label === 'Set Pointer Visibility') {
      const playerIdx = sActors.findIndex(a => a && a.type === 'player');
      const visible = currentNode.data.visible !== false ? 'true' : 'false';
      code += `${indent}BN_LOG("Action: Set Pointer Visibility");\n`;
      if (playerIdx !== -1) {
        code += `${indent}actor_${playerIdx}_sprite.set_visible(${visible});\n`;
      }
    } else if (label === 'Set BG Color') {
      let hex = currentNode.data.color || '#000000';
      if (!/^#[0-9A-Fa-f]{6}$/i.test(hex)) hex = '#000000';
      const r = Math.floor(parseInt(hex.slice(1, 3), 16) / 8);
      const g = Math.floor(parseInt(hex.slice(3, 5), 16) / 8);
      const b = Math.floor(parseInt(hex.slice(5, 7), 16) / 8);
      code += `${indent}BN_LOG("Action: Set BG Color to ${hex}");\n`;
      code += `${indent}bn::bg_palettes::set_transparent_color(bn::color(${r}, ${g}, ${b}));\n`;
    } else if (label === 'Set BG Palette' || currentNode.data?.actionType === 'set_bg_palette') {
      const palIdx = parseInt(currentNode.data.paletteIndex) || 0;
      const colorHex = currentNode.data.color || '#000000';
      if (/^#[0-9A-Fa-f]{6}$/i.test(colorHex)) {
        const r = Math.floor(parseInt(colorHex.slice(1, 3), 16) / 8);
        const g = Math.floor(parseInt(colorHex.slice(3, 5), 16) / 8);
        const b = Math.floor(parseInt(colorHex.slice(5, 7), 16) / 8);
        code += `${indent}BN_LOG("Action: Set BG Palette ${palIdx} to ${colorHex}");\n`;
        code += `${indent}bn::bg_palettes::set_palette_color(${palIdx}, bn::color(${r}, ${g}, ${b}));\n`;
      }
    } else if (label === 'Set Sprite Palette' || currentNode.data?.actionType === 'set_sprite_palette') {
      const palIdx = parseInt(currentNode.data.paletteIndex) || 0;
      const colorHex = currentNode.data.color || '#000000';
      if (/^#[0-9A-Fa-f]{6}$/i.test(colorHex)) {
        const r = Math.floor(parseInt(colorHex.slice(1, 3), 16) / 8);
        const g = Math.floor(parseInt(colorHex.slice(3, 5), 16) / 8);
        const b = Math.floor(parseInt(colorHex.slice(5, 7), 16) / 8);
        code += `${indent}BN_LOG("Action: Set Sprite Palette ${palIdx} to ${colorHex}");\n`;
        code += `${indent}bn::sprite_palettes::set_palette_color(${palIdx}, bn::color(${r}, ${g}, ${b}));\n`;
      }
    } else if (label === 'Check Input') {
      const keyState = currentNode.data.keyState || 'held';
      const keyName = currentNode.data.keyName || 'a';
      const useThreshold = !!currentNode.data.useThreshold;
      const branchByThreshold = useThreshold && !!currentNode.data.branchByThreshold;
      const threshold = currentNode.data.threshold || 500;
      const thresholdFrames = Math.round(threshold * 60 / 1000);
      const operator = currentNode.data.operator || '>=';

      if (branchByThreshold) {
        const condition = `bn::keypad::${keyName}_${keyState}()`;
        code += `${indent}if (${condition}) {\n`;
        const underEdge = (script.edges || []).find(e => e && e.source === currentNode.id && e.sourceHandle === 'under');
        if (underEdge) {
          code += `${indent}    if (cur_held_${keyName} < ${thresholdFrames}) {\n`;
          const underBranch = generateScriptLogic(script, actorIndex, actorWidth, actorHeight, baseIndent + openBraces + 2, callStack, { ...options, startNodeId: underEdge.target });
          code += underBranch;
          code += `${indent}    }\n`;
        }
        
        const overEdge = (script.edges || []).find(e => e && e.source === currentNode.id && e.sourceHandle === 'over');
        if (overEdge) {
          code += `${indent}    if (cur_held_${keyName} >= ${thresholdFrames}) {\n`;
          const overBranch = generateScriptLogic(script, actorIndex, actorWidth, actorHeight, baseIndent + openBraces + 2, callStack, { ...options, startNodeId: overEdge.target });
          code += overBranch;
          code += `${indent}    }\n`;
        }
        code += `${indent}}\n`;
        continue;
      } else {
        let condStr = `bn::keypad::${keyName}_${keyState}()`;
        if (useThreshold) {
          condStr += ` && cur_held_${keyName} ${operator} ${thresholdFrames}`;
        }
        code += `${indent}if (${condStr}) {\n`;
        openBraces++;
      }
    } else if (label === 'Set Scroll Speed') {
      const parseScrollSpeed = (val) => {
        if (val === undefined || val === null || val === '') return '0';
        const isVar = variables.some(v => v.name === String(val));
        if (isVar) return resolveVarName(val);
        const parsed = parseFloat(val);
        return isNaN(parsed) ? '0' : `${parsed}`;
      };
      const scrollSpeedX = parseScrollSpeed(currentNode.data.scrollSpeedX);
      const scrollSpeedY = parseScrollSpeed(currentNode.data.scrollSpeedY);
      code += `${indent}current_scroll_speed_x = ${scrollSpeedX};\n`;
      code += `${indent}current_scroll_speed_y = ${scrollSpeedY};\n`;
    } else if (label === 'Set Actor Rotation') {
      const targetActorId = currentNode.data.targetActorId;
      const targetActorIdx = targetActorId ? sActors.findIndex(act => act && String(act.id) === String(targetActorId)) : actorIndex;
      const angleVal = variables.some(v => v.name === String(currentNode.data.angle))
        ? resolveVarName(currentNode.data.angle)
        : (parseFloat(currentNode.data.angle) ?? 0.0);

      if (targetActorIdx !== -1) {
        const angleExpr = typeof angleVal === 'number' ? `bn::fixed(${angleVal})` : angleVal;
        code += `${indent}actor_${targetActorIdx}_affine.set_rotation_angle(${angleExpr});\n`;
      }
    } else if (label === 'Set Actor Scale') {
      const targetActorId = currentNode.data.targetActorId;
      const targetActorIdx = targetActorId ? sActors.findIndex(act => act && String(act.id) === String(targetActorId)) : actorIndex;
      const scaleXVal = variables.some(v => v.name === String(currentNode.data.scaleX))
        ? resolveVarName(currentNode.data.scaleX)
        : (parseFloat(currentNode.data.scaleX) ?? 1.0);
      const scaleYVal = variables.some(v => v.name === String(currentNode.data.scaleY))
        ? resolveVarName(currentNode.data.scaleY)
        : (parseFloat(currentNode.data.scaleY) ?? 1.0);

      if (targetActorIdx !== -1) {
        const sxExpr = typeof scaleXVal === 'number' ? `bn::fixed(${scaleXVal})` : scaleXVal;
        const syExpr = typeof scaleYVal === 'number' ? `bn::fixed(${scaleYVal})` : scaleYVal;
        code += `${indent}actor_${targetActorIdx}_affine.set_scale(${sxExpr}, ${syExpr});\n`;
      }
    } else if (label === 'Set Car Speed') {
      const speedVal = variables.some(v => v.name === String(currentNode.data.speed))
        ? resolveVarName(currentNode.data.speed)
        : (parseFloat(currentNode.data.speed) || 0.0);

      const playerIdx = sActors.findIndex(act => act && act.type === 'player');
      if (playerIdx !== -1) {
        const speedExpr = typeof speedVal === 'number' ? `bn::fixed(${speedVal})` : speedVal;
        code += `${indent}actor_${playerIdx}_speed = ${speedExpr};\n`;
      }
    } else if (label === 'Set Car Steering') {
      const steeringSpeedVal = variables.some(v => v.name === String(currentNode.data.steeringSpeed))
        ? resolveVarName(currentNode.data.steeringSpeed)
        : (parseFloat(currentNode.data.steeringSpeed) || 0.0);
      const angleVal = variables.some(v => v.name === String(currentNode.data.angle))
        ? resolveVarName(currentNode.data.angle)
        : (parseFloat(currentNode.data.angle) || 0.0);

      const playerIdx = sActors.findIndex(act => act && act.type === 'player');
      if (playerIdx !== -1) {
        if (currentNode.data.steeringSpeed !== undefined && currentNode.data.steeringSpeed !== '') {
          const steerExpr = typeof steeringSpeedVal === 'number' ? `bn::fixed(${steeringSpeedVal})` : steeringSpeedVal;
          code += `${indent}scene_steering_speed = ${steerExpr};\n`;
        }
        if (currentNode.data.angle !== undefined && currentNode.data.angle !== '') {
          const angleExpr = typeof angleVal === 'number' ? `bn::fixed(${angleVal})` : angleVal;
          code += `${indent}actor_${playerIdx}_angle = ${angleExpr};\n`;
          code += `${indent}actor_${playerIdx}_affine.set_rotation_angle(actor_${playerIdx}_angle);\n`;
        }
      }
    }

    const edge = (script.edges || []).find(e => e && e.source === currentNode.id);
    currentNode = edge ? script.nodes.find(n => n && n.id === edge.target) : null;
  }
  while (openBraces > 0) { openBraces--; code += '                ' + '    '.repeat(openBraces + baseIndent) + '}\n'; }
  return code;
}
