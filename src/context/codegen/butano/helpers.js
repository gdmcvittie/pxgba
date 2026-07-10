export function autoDeclare(variables, customScripts, globalScript, scenes) {
  var referenced = {};
  var scriptsById = {};
  for (var ci = 0; ci < customScripts.length; ci++) {
    if (customScripts[ci] && customScripts[ci].id != null) scriptsById[customScripts[ci].id] = customScripts[ci];
  }

  var scriptStack = new Set();

  function processNode(nd) {
    if (!nd || !nd.data) return;
    var lbl = nd.data.label || '';
    var vn = nd.data.varName || nd.data.targetVar || '';
    if (vn && (lbl === 'Set Variable' || lbl === 'Check Variable' || lbl === 'Math Operation' || lbl === 'Set Random Var' || lbl === 'Math Equation')) {
      referenced[vn] = true;
    }
    var fl = nd.data.flag || '';
    if (fl && (lbl === 'Set Flag' || lbl === 'Clear Flag' || lbl === 'Check Flag')) {
      referenced[fl] = true;
    }
    if (nd.data.script) {
      if (nd.data.script.nodes) collectFromScript(nd.data.script);
      else if (Array.isArray(nd.data.script)) collectFromScript({ nodes: nd.data.script });
    }
    if (nd.data.scriptId != null && scriptsById[nd.data.scriptId]) {
      collectFromScript(scriptsById[nd.data.scriptId].script);
    }
  }

  function collectFromScript(script) {
    if (!script || !script.nodes || !script.nodes.length) return;
    if (scriptStack.has(script)) return;
    scriptStack.add(script);
    var startNode = script.nodes.find(function (n) { return n && n.id === 'start'; }) || script.nodes[0];
    if (!startNode) { scriptStack.delete(script); return; }
    var visited = new Set();
    var stack = [startNode];
    while (stack.length) {
      var cur = stack.pop();
      if (!cur || visited.has(cur.id)) continue;
      visited.add(cur.id);
      processNode(cur);
      var outs = (script.edges || []).filter(function (e) { return e && e.source === cur.id; });
      for (var oi = 0; oi < outs.length; oi++) {
        var tgt = script.nodes.find(function (n) { return n && n.id === outs[oi].target; });
        if (tgt && !visited.has(tgt.id)) stack.push(tgt);
      }
    }
    scriptStack.delete(script);
  }

  for (var ci2 = 0; ci2 < customScripts.length; ci2++) {
    if (customScripts[ci2] && customScripts[ci2].script) collectFromScript(customScripts[ci2].script);
  }
  if (globalScript) collectFromScript(globalScript);
  for (var si = 0; si < scenes.length; si++) {
    var trigs = scenes[si].triggers || [];
    for (var ti = 0; ti < trigs.length; ti++) {
      var t = trigs[ti];
      var target = t;
      if (t.groupId) {
        for (var gi = 0; gi < trigs.length; gi++) {
          if (trigs[gi].isGroup && trigs[gi].id === t.groupId && (trigs[gi].script || trigs[gi].scriptId)) { target = trigs[gi]; break; }
        }
      }
      if (target.scriptId != null) {
        for (var csi = 0; csi < customScripts.length; csi++) {
          if (customScripts[csi] && String(customScripts[csi].id) === String(target.scriptId)) {
            if (customScripts[csi].script) collectFromScript(customScripts[csi].script);
            break;
          }
        }
      } else if (target.script) {
        collectFromScript(target.script);
      }
    }
  }
  var existing = {};
  for (var vi = 0; vi < variables.length; vi++) {
    if (variables[vi].type === 'group') continue;
    existing[variables[vi].name] = true;
  }
  for (var rv in referenced) {
    if (!existing[rv]) {
      variables.push({ name: rv, type: 'number', initialValue: 0 });
    }
  }
}

export function getTriggerScript(t, currentTriggersList, customScripts) {
  let target = t;
  if (t.groupId && currentTriggersList) {
    const group = currentTriggersList.find(g => g.isGroup && g.id === t.groupId);
    if (group && (group.script || group.scriptId)) target = group;
  }
  if (target.scriptId) {
    const cs = customScripts.find(c => c && String(c.id) === String(target.scriptId));
    if (cs && cs.script) return cs.script;
  }
  if (target !== t && target.script) return target.script;
  return t.script;
}

export function getValidSpriteSize(w, h) {
  const validSizes = [
    [8, 8], [16, 16], [32, 32], [64, 64],
    [16, 8], [32, 8], [32, 16], [64, 32],
    [8, 16], [8, 32], [16, 32], [32, 64]
  ];
  let best = [64, 64];
  let minArea = Infinity;
  for (let i = 0; i < validSizes.length; i++) {
    const [vw, vh] = validSizes[i];
    if (vw >= w && vh >= h && vw * vh < minArea) {
      best = [vw, vh];
      minArea = vw * vh;
    }
  }
  return best;
}

export function getCharSpriteItemName(char) {
  const c = char.toUpperCase();
  if (c >= 'A' && c <= 'Z') return `hud_${c.toLowerCase()}`;
  if (c >= '0' && c <= '9') return `hud_${c}`;
  if (c === ':') return 'hud_colon';
  if (c === '/') return 'hud_slash';
  if (c === '-') return 'hud_minus';
  if (c === '+') return 'hud_plus';
  if (c === '!') return 'hud_excl';
  if (c === '?') return 'hud_question';
  if (c === '.') return 'hud_dot';
  if (c === ',') return 'hud_comma';
  if (c === '>') return 'hud_gt';
  return null;
}

export const fontBytes = {
  'A': [0x1C, 0x22, 0x3E, 0x22, 0x22, 0x22, 0x00, 0x00],
  'B': [0x3C, 0x22, 0x3C, 0x22, 0x22, 0x3C, 0x00, 0x00],
  'C': [0x1C, 0x22, 0x20, 0x20, 0x22, 0x1C, 0x00, 0x00],
  'D': [0x38, 0x24, 0x22, 0x22, 0x24, 0x38, 0x00, 0x00],
  'E': [0x3E, 0x20, 0x3C, 0x20, 0x20, 0x3E, 0x00, 0x00],
  'F': [0x3E, 0x20, 0x3C, 0x20, 0x20, 0x20, 0x00, 0x00],
  'G': [0x1C, 0x22, 0x20, 0x2E, 0x22, 0x1C, 0x00, 0x00],
  'H': [0x22, 0x22, 0x3E, 0x22, 0x22, 0x22, 0x00, 0x00],
  'I': [0x1C, 0x08, 0x08, 0x08, 0x08, 0x1C, 0x00, 0x00],
  'J': [0x0E, 0x02, 0x02, 0x02, 0x22, 0x1C, 0x00, 0x00],
  'K': [0x22, 0x24, 0x38, 0x24, 0x22, 0x22, 0x00, 0x00],
  'L': [0x20, 0x20, 0x20, 0x20, 0x20, 0x3E, 0x00, 0x00],
  'M': [0x22, 0x36, 0x2A, 0x22, 0x22, 0x22, 0x00, 0x00],
  'N': [0x22, 0x32, 0x2A, 0x26, 0x22, 0x22, 0x00, 0x00],
  'O': [0x1C, 0x22, 0x22, 0x22, 0x22, 0x1C, 0x00, 0x00],
  'P': [0x3C, 0x22, 0x3C, 0x20, 0x20, 0x20, 0x00, 0x00],
  'Q': [0x1C, 0x22, 0x22, 0x2A, 0x24, 0x1A, 0x00, 0x00],
  'R': [0x3C, 0x22, 0x3C, 0x24, 0x22, 0x22, 0x00, 0x00],
  'S': [0x1C, 0x20, 0x1C, 0x02, 0x22, 0x1C, 0x00, 0x00],
  'T': [0x3E, 0x08, 0x08, 0x08, 0x08, 0x08, 0x00, 0x00],
  'U': [0x22, 0x22, 0x22, 0x22, 0x22, 0x1C, 0x00, 0x00],
  'V': [0x22, 0x22, 0x22, 0x22, 0x14, 0x08, 0x00, 0x00],
  'W': [0x22, 0x22, 0x22, 0x2A, 0x36, 0x22, 0x00, 0x00],
  'X': [0x22, 0x22, 0x14, 0x08, 0x14, 0x22, 0x00, 0x00],
  'Y': [0x22, 0x22, 0x14, 0x08, 0x08, 0x08, 0x00, 0x00],
  'Z': [0x3E, 0x04, 0x08, 0x10, 0x20, 0x3E, 0x00, 0x00],
  '0': [0x1C, 0x22, 0x22, 0x22, 0x22, 0x1C, 0x00, 0x00],
  '1': [0x08, 0x18, 0x08, 0x08, 0x08, 0x1C, 0x00, 0x00],
  '2': [0x1C, 0x22, 0x04, 0x08, 0x10, 0x3E, 0x00, 0x00],
  '3': [0x1C, 0x22, 0x0C, 0x02, 0x22, 0x1C, 0x00, 0x00],
  '4': [0x12, 0x12, 0x3E, 0x02, 0x02, 0x02, 0x00, 0x00],
  '5': [0x3E, 0x20, 0x3C, 0x02, 0x22, 0x1C, 0x00, 0x00],
  '6': [0x1C, 0x20, 0x3C, 0x22, 0x22, 0x1C, 0x00, 0x00],
  '7': [0x3E, 0x02, 0x04, 0x08, 0x10, 0x10, 0x00, 0x00],
  '8': [0x1C, 0x22, 0x1C, 0x22, 0x22, 0x1C, 0x00, 0x00],
  '9': [0x1C, 0x22, 0x1E, 0x02, 0x02, 0x1C, 0x00, 0x00],
  'x': [0x00, 0x22, 0x14, 0x08, 0x14, 0x22, 0x00, 0x00],
  ':': [0x00, 0x08, 0x00, 0x00, 0x08, 0x00, 0x00, 0x00],
  '/': [0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x00, 0x00],
  '-': [0x00, 0x00, 0x00, 0x3E, 0x00, 0x00, 0x00, 0x00],
  '+': [0x00, 0x08, 0x08, 0x3E, 0x08, 0x08, 0x00, 0x00],
  '!': [0x08, 0x08, 0x08, 0x08, 0x00, 0x08, 0x00, 0x00],
  '?': [0x1C, 0x22, 0x04, 0x08, 0x00, 0x08, 0x00, 0x00],
  '.': [0x00, 0x00, 0x00, 0x00, 0x00, 0x0c, 0x0c, 0x00],
  ',': [0x00, 0x00, 0x00, 0x00, 0x00, 0x0c, 0x04, 0x08],
  '>': [0x00, 0x30, 0x38, 0x3C, 0x38, 0x30, 0x00, 0x00]
};
