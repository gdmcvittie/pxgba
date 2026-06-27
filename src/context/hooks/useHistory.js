import { useState, useCallback, useEffect } from 'react';
import { cloneLayersForHistory } from '../utils';

export function useHistory({
  layers, dimensions, savedTiles, scenes, actors, globalActors, triggers, collisions,
  variables, animations, customScripts, globalScript, musicTracks,
  activeSceneId, frames, activeFrameId, activeLayerId,
  hudSettings, setHudSettings,
  setLayers, setDimensions, setSavedTiles, setScenes, setActors, setGlobalActors, setTriggers,
  setCollisions, setVariables, setAnimations, setCustomScripts, setGlobalScript,
  setMusicTracks, setActiveSceneId, setFrames, setActiveFrameId, setActiveLayerId
}) {
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const saveHistory = useCallback((label = "Action", nextLayers = layers, nextDims = dimensions, nextAdditionalState = {}) => {
    const actSceneId = nextAdditionalState.activeSceneId || activeSceneId;
    const actFrameId = nextAdditionalState.activeFrameId || activeFrameId;
    const actLayerId = nextAdditionalState.activeLayerId || activeLayerId;
    const currentSavedTiles = nextAdditionalState.savedTiles || savedTiles;

    const clonedNextLayers = cloneLayersForHistory(nextLayers);

    const rawFrames = nextAdditionalState.frames || frames;
    const snapshotFrames = rawFrames.map(f =>
      f.id === actFrameId
        ? { ...f, layers: cloneLayersForHistory(nextLayers) }
        : f
    );

    const rawScenes = nextAdditionalState.scenes || scenes;
    const snapshotScenes = rawScenes.map(s =>
      s.id === actSceneId
        ? {
            ...s,
            frames: JSON.parse(JSON.stringify(snapshotFrames)),
            actors: JSON.parse(JSON.stringify(nextAdditionalState.actors || actors)),
            triggers: JSON.parse(JSON.stringify(nextAdditionalState.triggers || triggers)),
            collisions: JSON.parse(JSON.stringify(nextAdditionalState.collisions || collisions)),
            dimensions: { ...nextDims }
          }
        : s
    );

    const snapshot = {
      label,
      layers: clonedNextLayers,
      dimensions: { ...nextDims },
      savedTiles: JSON.parse(JSON.stringify(currentSavedTiles)),
      scenes: snapshotScenes,
      actors: JSON.parse(JSON.stringify(nextAdditionalState.actors || actors)),
      triggers: JSON.parse(JSON.stringify(nextAdditionalState.triggers || triggers)),
      collisions: JSON.parse(JSON.stringify(nextAdditionalState.collisions || collisions)),
      variables: JSON.parse(JSON.stringify(nextAdditionalState.variables || variables)),
      animations: JSON.parse(JSON.stringify(nextAdditionalState.animations || animations)),
      customScripts: JSON.parse(JSON.stringify(nextAdditionalState.customScripts || customScripts)),
      globalScript: JSON.parse(JSON.stringify(nextAdditionalState.globalScript || globalScript)),
      musicTracks: JSON.parse(JSON.stringify(nextAdditionalState.musicTracks || musicTracks)),
      activeSceneId: actSceneId,
      frames: snapshotFrames,
      activeFrameId: actFrameId,
      activeLayerId: actLayerId,
      hudSettings: JSON.parse(JSON.stringify(nextAdditionalState.hudSettings || hudSettings)),
      timestamp: Date.now()
    };

    setHistory(prev => {
      const truncatedHistory = prev.slice(0, historyIndex + 1);
      const newHistory = [...truncatedHistory, snapshot].slice(-30);
      setHistoryIndex(newHistory.length - 1);
      return newHistory;
    });
  }, [layers, dimensions, historyIndex, scenes, actors, triggers, collisions, variables, animations, customScripts, globalScript, musicTracks, activeSceneId, frames, activeFrameId, activeLayerId, savedTiles, hudSettings]);

  const jumpToHistory = useCallback((index) => {
    if (index < 0 || index >= history.length) return;

    const target = history[index];
    const restoredLayers = cloneLayersForHistory(target.layers);

    setLayers(restoredLayers);
    setDimensions({ ...target.dimensions });

    if (target.savedTiles) setSavedTiles(JSON.parse(JSON.stringify(target.savedTiles)));
    if (target.scenes) setScenes(JSON.parse(JSON.stringify(target.scenes)));
    if (target.actors) setActors(JSON.parse(JSON.stringify(target.actors)));
    if (target.globalActors) setGlobalActors(JSON.parse(JSON.stringify(target.globalActors)));
    if (target.triggers) setTriggers(JSON.parse(JSON.stringify(target.triggers)));
    if (target.collisions) setCollisions(JSON.parse(JSON.stringify(target.collisions)));
    if (target.variables) setVariables(JSON.parse(JSON.stringify(target.variables)));
    if (target.animations) setAnimations(JSON.parse(JSON.stringify(target.animations)));
    if (target.customScripts) setCustomScripts(JSON.parse(JSON.stringify(target.customScripts)));
    if (target.globalScript) setGlobalScript(JSON.parse(JSON.stringify(target.globalScript)));
    if (target.musicTracks !== undefined) setMusicTracks(target.musicTracks);
    if (target.activeSceneId) setActiveSceneId(target.activeSceneId);
    if (target.frames) setFrames(JSON.parse(JSON.stringify(target.frames)));
    if (target.activeFrameId) setActiveFrameId(target.activeFrameId);
    if (target.hudSettings !== undefined) setHudSettings(JSON.parse(JSON.stringify(target.hudSettings)));

    setHistoryIndex(index);

    if (target.activeLayerId) {
      setActiveLayerId(target.activeLayerId);
    } else if (!restoredLayers.find(l => l.id === activeLayerId)) {
      setActiveLayerId(restoredLayers[0].id);
    }
  }, [history, activeLayerId]);

  const undo = useCallback(() => jumpToHistory(historyIndex - 1), [historyIndex, jumpToHistory]);
  const redo = useCallback(() => jumpToHistory(historyIndex + 1), [historyIndex, jumpToHistory]);

  useEffect(() => {
    if (history.length === 0) {
      saveHistory("Initial Canvas", layers, dimensions);
    }
  }, []);

  return { history, historyIndex, setHistory, setHistoryIndex, saveHistory, jumpToHistory, undo, redo };
}
