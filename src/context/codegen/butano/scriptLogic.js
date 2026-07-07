import { BUTANO_COLLISION_ENUMS } from '../../constants';

export function generateScriptLogic(script, actorIndex, actorWidth, actorHeight, baseIndent = 0, callStack = new Set(), options = {}) {
  const {
    dialogs, safeSceneName, scenes, sActors, sDims, customScripts, variables,
    currentSceneIdx, startingSceneIdx, scene, startNodeId = 'start'
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
      code += `${indent}    show_dialog_text("${safeStr(currentNode.data.message)}", text_sprites, dialog_text_palette);\n`;
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
          recreateSwitch += `${indent}                    show_dialog_text("${safeStr(variant)}", text_sprites, dialog_text_palette);\n`;
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
        code += `${indent}    show_dialog_text("${safeStr(initialVariant)}", text_sprites, dialog_text_palette);\n`;
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
    } else if (label === 'Play Sound') {
      code += `${indent}bn::sound_items::${currentNode.data.computedSoundName || 'snd_square_440_100'}.play();\n`;
    } else if (label === 'Music Control') {
      const mAction = currentNode.data.musicAction || 'pause';
      code += `${indent}BN_LOG("Action: Music Control ${mAction}");\n`;
      if (mAction === 'pause') code += `${indent}bn::music::pause();\n`;
      else if (mAction === 'resume') code += `${indent}bn::music::resume();\n`;
      else if (mAction === 'stop') code += `${indent}bn::music::stop();\n`;
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
        let val = safeStr(currentNode.data.varValue);
        if (variable && variable.type === 'string') {
          val = `"${val.replace(/"/g, '\\"')}"`;
        } else if (variable && variable.type === 'float') {
          if (!val.endsWith('f') && !isNaN(parseFloat(val))) {
            val = `${val}f`;
          }
        }
        code += `${indent}${sv} = ${val};\n`;
      }
    } else if (label === 'Check Variable') {
      const sv = resolveVarName(currentNode.data.varName);
      if (sv) {
        const variable = variables.find(v => v &&  v && v.name === currentNode.data.varName);
        let val = safeStr(currentNode.data.varValue);
        if (variable && variable.type === 'string') {
          val = `"${val.replace(/"/g, '\\"')}"`;
        } else if (variable && variable.type === 'float') {
          if (!val.endsWith('f') && !isNaN(parseFloat(val))) {
            val = `${val}f`;
          }
        }
        code += `${indent}if (${sv} == ${val}) {\n`; openBraces++;
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
              code += `${indent}    _save.${sv} = ${safeFloat}f;\n`;
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
    } else if (label === 'Check Input') {
      const keyState = currentNode.data.keyState || 'held';
      const keyName = currentNode.data.keyName || 'a';
      if (keyState === 'pressed') {
        code += `${indent}if (bn::keypad::${keyName}_pressed()) {\n`; openBraces++;
      } else if (keyState === 'released') {
        code += `${indent}if (bn::keypad::${keyName}_released()) {\n`; openBraces++;
      } else {
        code += `${indent}if (bn::keypad::${keyName}_held()) {\n`; openBraces++;
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
