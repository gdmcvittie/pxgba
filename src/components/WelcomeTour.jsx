import { useState, useEffect, useCallback } from 'react';
import { usePxShop } from '../context/PxShopContext';

const TOUR_STEPS = [
  {
    title: "Welcome to PxGBA!",
    description: "PxGBA is a complete game builder for Game Boy Advance games. You can create your own Game Boy Advance game with pixel art, levels, characters, music, and logic - then export it as a real ROM file you can play anywhere. No coding experience needed! Let's walk through everything step by step.",
    target: null,
    placement: "center"
  },
  {
    title: "The Workspace Layout",
    description: "Your workspace has 4 main areas: The Toolbar on the far left (drawing tools), three Side Panels in the middle (scenes, actors, scripts, etc.), the Canvas in the center (where you draw), and the Header bar at the top (play, compile, save). Let's explore each one.",
    target: null,
    placement: "center"
  },
  {
    title: "The Toolbar - Your Drawing Kit",
    description: "This vertical strip on the left holds all your drawing tools. Think of it like a digital art kit. You'll use these tools to draw directly on the canvas. Let's look at what each tool does.",
    target: "tour-toolbar",
    placement: "right"
  },
  {
    title: "Pen & Brush Tools",
    description: "The Pen draws single pixels - perfect for fine detail work. The Brush draws larger strokes (you can set the brush size). Use these for painting individual pixels or small areas on your canvas.",
    target: "tour-toolbar",
    placement: "right"
  },
  {
    title: "Eraser & Fill Tools",
    description: "The Eraser removes pixels (makes them transparent). The Fill Bucket floods an area with a single color - great for quickly coloring large regions. The Gradient tool creates smooth color transitions.",
    target: "tour-toolbar",
    placement: "right"
  },
  {
    title: "Shape & Selection Tools",
    description: "Draw perfect lines, rectangles, circles, and triangles with the shape tools. The selection tools (Rectangle, Lasso, Magic Wand) let you select parts of your drawing to move, copy, or recolor.",
    target: "tour-toolbar",
    placement: "right"
  },
  {
    title: "Color Picker & Symmetry",
    description: "Click the color swatch at the bottom to choose your drawing color from a 16-color palette (GBA games use limited colors for that retro look!). The Symmetry tool mirrors your drawing automatically - perfect for characters and symmetric designs.",
    target: "tour-toolbar",
    placement: "right"
  },
  {
    title: "The Canvas - Your Drawing Space",
    description: "The big area in the center is your canvas. This is where you draw your game's graphics pixel by pixel. You can zoom in/out with the mouse wheel, and pan around by holding the middle mouse button or Space+drag. Everything you draw here becomes part of your game.",
    target: "tour-canvas-container",
    placement: "left"
  },
  {
    title: "Scenes Panel - Your Game Levels",
    description: "Now let's explore the side panels. A 'Scene' is a single screen or level in your game. You can have multiple scenes - like a title screen, level 1, level 2, a boss fight, etc. Each scene has its own type (Platformer, Top-Down, Racing, etc.) and physics settings.",
    target: "tour-sidebar-col1",
    placement: "left",
    action: (ctx) => {
      ctx.setActiveCol1Panel('scenes');
    }
  },
  {
    title: "Scene Types & Settings",
    description: "Each scene has a type that determines how the game plays in that screen. Choose from: Top-Down (Zelda-style), Platformer (Mario-style), Metroidvania, Shoot 'Em Up, Racing, Point & Click, Beat 'Em Up, or special types like Intro/Logo and Pause Screen. You can also set physics like gravity, jump height, and movement speed.",
    target: "tour-sidebar-col1",
    placement: "left",
    action: (ctx) => {
      ctx.setActiveCol1Panel('scenes');
    }
  },
  {
    title: "Starting Scene & Scene Order",
    description: "The flag icon next to each scene marks which scene starts first when the player launches the game. Click it to change the starting scene. You can drag scenes to reorder them, and use the + button to add new scenes. The green robot icon opens the Level Generator to auto-create a level for that scene.",
    target: "tour-sidebar-col1",
    placement: "left",
    action: (ctx) => {
      ctx.setActiveCol1Panel('scenes');
    }
  },
  {
    title: "Tiles Panel - Your Building Blocks",
    description: "Tiles are 8x8 pixel blocks that you use to build levels. Think of them like stamps - you draw a tile once, then stamp it repeatedly to create walls, floors, decorations, etc. The Tiles panel shows your collection of tiles. Click one to select it, then use the Tile Stamp tool in the toolbar to place it on the canvas.",
    target: "tour-sidebar-col1",
    placement: "left",
    action: (ctx) => {
      ctx.setActiveCol1Panel('tiles');
    }
  },
  {
    title: "Creating & Editing Tiles",
    description: "Click the + button to create a new tile. You can draw directly on the tile preview to design it. Each tile can have a collision type (Solid, Ladder, Hazard, etc.) which determines how the player interacts with it. Tiles are the foundation of your level design - draw walls, floors, platforms, decorations, and more.",
    target: "tour-sidebar-col1",
    placement: "left",
    action: (ctx) => {
      ctx.setActiveCol1Panel('tiles');
    }
  },
  {
    title: "Layers Panel - Organizing Your Art",
    description: "Layers let you organize your drawing into separate sheets stacked on top of each other. Think of them like transparent sheets of paper. You might have a 'Background' layer for sky, a 'Tiles' layer for the level, and a 'Foreground' layer for decorations. Each layer can be shown/hidden, locked, or have its opacity adjusted.",
    target: "tour-sidebar-col1",
    placement: "left",
    action: (ctx) => {
      ctx.setActiveCol1Panel('layers');
    }
  },
  {
    title: "Layer Groups & Blending",
    description: "You can group layers together to keep things organized. Each layer has a blend mode (Normal, Multiply, Screen, etc.) that controls how it visually combines with layers below it. The GBA supports up to 4 background layers, so plan your layer structure carefully!",
    target: "tour-sidebar-col1",
    placement: "left",
    action: (ctx) => {
      ctx.setActiveCol1Panel('layers');
    }
  },
  {
    title: "Actors Panel - Characters & Objects",
    description: "Actors are interactive objects in your game - the player character, enemies, NPCs, items, moving platforms, etc. Unlike tiles (which are static scenery), actors can move, have behaviors, and respond to the player. Place them by clicking on the canvas when the actor is selected.",
    target: "tour-sidebar-col2",
    placement: "left",
    action: (ctx) => {
      ctx.setActiveCol2Panel('actors');
    }
  },
  {
    title: "Actor Types & Properties",
    description: "Each actor has a type: Player, Enemy, NPC, Platform, Collectible, Door, etc. You can customize their sprite (which tile they look like), movement speed, patrol paths, and attach scripts to them. The player actor is special - it's the character the user controls.",
    target: "tour-sidebar-col2",
    placement: "left",
    action: (ctx) => {
      ctx.setActiveCol2Panel('actors');
    }
  },
  {
    title: "Global Actors",
    description: "Some actors can be 'Global' - meaning they appear in multiple scenes. This is useful for a player character that persists across levels, or a companion NPC. Toggle the globe icon to make an actor global. Their position can be set separately for each scene.",
    target: "tour-sidebar-col2",
    placement: "left",
    action: (ctx) => {
      ctx.setActiveCol2Panel('actors');
    }
  },
  {
    title: "Collisions Panel - Physical Boundaries",
    description: "Collisions define what the player can and cannot walk through. Paint solid walls, slopes, ladders, ice patches, or jump-through platforms. The player will physically interact with these - they can't walk through solid walls, will slide on ice, climb ladders, etc.",
    target: "tour-sidebar-col2",
    placement: "left",
    action: (ctx) => {
      ctx.setActiveCol2Panel('collisions');
    }
  },
  {
    title: "Collision Types",
    description: "Each collision region has a type: Solid (impassable wall), Slope (angled surface), Ladder (climbable), Hazard (damages player), Ice (slippery), Jump-Through (can jump up through but not fall through), and more. Paint these over your tiles to define how the level behaves physically.",
    target: "tour-sidebar-col2",
    placement: "left",
    action: (ctx) => {
      ctx.setActiveCol2Panel('collisions');
    }
  },
  {
    title: "Triggers Panel - Invisible Event Zones",
    description: "Triggers are invisible zones that fire events when the player enters or exits them. Use them to trigger cutscenes, open doors, spawn enemies, change music, show dialog, or transition to another scene. They're how you add interactivity and storytelling to your game.",
    target: "tour-sidebar-col2",
    placement: "left",
    action: (ctx) => {
      ctx.setActiveCol2Panel('triggers');
    }
  },
  {
    title: "Music Panel - Game Audio",
    description: "Create authentic retro music with the built-in tracker. Music is organized into tracks, each with multiple channels playing different instruments. You can compose note-by-note, set tempo, and create loops. The GBA has specific audio capabilities, and the tracker produces authentic chiptune sounds.",
    target: "tour-sidebar-col3",
    placement: "left",
    action: (ctx) => {
      ctx.setActiveCol3Panel('music');
    }
  },
  {
    title: "Scripts Panel - Visual Programming",
    description: "This is where you make your game come alive! Scripts control what happens in your game - dialog boxes, character movements, item collection, level transitions, etc. You build scripts visually by dragging and dropping code blocks, no typing required. Think of it like building with LEGO blocks.",
    target: "tour-sidebar-col3",
    placement: "left",
    action: (ctx) => {
      ctx.setActiveCol3Panel('scripts');
    }
  },
  {
    title: "Script Blocks & Connections",
    description: "Scripts are made of blocks connected by arrows. Each block does one thing: 'Show Dialog', 'Move Actor', 'Play Sound', 'Change Scene', 'If/Then' conditions, etc. Connect blocks in sequence to create complex behaviors. Click 'Edit Visual Graph' in a scene to open the script editor.",
    target: "tour-sidebar-col3",
    placement: "left",
    action: (ctx) => {
      ctx.setActiveCol3Panel('scripts');
    }
  },
  {
    title: "Variables Panel - Game Data",
    description: "Variables store information about your game state - player health, score, number of keys collected, which doors are unlocked, etc. Scripts can read and change variables. For example, when the player collects a coin, a script adds 1 to the 'score' variable. Variables persist across scenes.",
    target: "tour-sidebar-col3",
    placement: "left",
    action: (ctx) => {
      ctx.setActiveCol3Panel('variables');
    }
  },
  {
    title: "Variable Types",
    description: "Variables can be Numbers (health, score, counters), Strings (player name, dialog text), or Booleans (hasKey, isDoorOpen). Group related variables together to stay organized. Use variables in scripts to create conditional logic - 'If player has key, then open door'.",
    target: "tour-sidebar-col3",
    placement: "left",
    action: (ctx) => {
      ctx.setActiveCol3Panel('variables');
    }
  },
  {
    title: "The Header Bar - Top Controls",
    description: "The header at the top has important buttons: File menu (save/load projects, export assets), Play button (test your game), and Compile button (build the final ROM). Let's look at the most important ones.",
    target: null,
    placement: "center"
  },
  {
    title: "Play Testing - Try Your Game",
    description: "Click the green Play button to instantly test your game in a built-in GBA emulator. Your controls work exactly as they will on real hardware. Use this frequently to check physics, scripts, collisions, and overall feel. Press Escape to return to the editor.",
    target: "tour-play-btn",
    placement: "bottom-left"
  },
  {
    title: "Compile & Export - Build Your ROM",
    description: "When your game is ready, click the blue Compile button. PxGBA will package all your art, levels, music, and scripts into a real .gba ROM file. This file works on actual GBA hardware, emulators, and flash carts. You can share it with friends or play it on your phone with an emulator!",
    target: "tour-compile-btn",
    placement: "bottom-left"
  },
  {
    title: "Saving Your Work",
    description: "Don't forget to save! Use the File menu (top-left) to save your project as a .pxg file. This preserves all your scenes, tiles, actors, scripts, and music. You can reopen it later to continue working. Export options let you save individual assets as PNG images.",
    target: null,
    placement: "center"
  },
  {
    title: "Level Generator - Quick Levels",
    description: "Need a level fast? Click the robot icon on any scene to open the Level Generator. It automatically creates a complete level based on your scene type - platformer levels with platforms and pits, top-down maps with paths and water, racing tracks, caves, and more. You can customize the tiles, colors, and layout parameters.",
    target: null,
    placement: "center"
  },
  {
    title: "Project Wizard - Start Fresh",
    description: "Starting a new project? The Project Wizard helps you set up multiple scenes at once. Choose how many of each scene type you want (platformer levels, cutscenes, etc.), and it creates them all with sensible defaults. You can find it in the File menu under 'New Project'.",
    target: null,
    placement: "center"
  },
  {
    title: "Tips for Success",
    description: "Start small - make a simple 2-3 scene game first. Use the Level Generator to quickly prototype levels, then customize them. Test frequently with the Play button. Organize your layers and use groups. Save often! Remember: tiles for scenery, actors for interactive objects, scripts for behavior, collisions for physics.",
    target: null,
    placement: "center"
  },
  {
    title: "You're Ready!",
    description: "You now know everything you need to create your own GBA game! Remember: you can always restart this tour from the File menu. The community is here to help if you get stuck. Now go make something amazing - click Finish and start building your game!",
    target: null,
    placement: "center"
  }
];

const WelcomeTour = () => {
  const {
    showWelcomeTour, setShowWelcomeTour,
    setActiveCol1Panel, setActiveCol2Panel, setActiveCol3Panel,
    setShowNewProjectDialog
  } = usePxShop();

  const [stepIndex, setStepIndex] = useState(0);
  const [showPrompt, setShowPrompt] = useState(false);
  const [spotlightStyle, setSpotlightStyle] = useState({
    top: '50%',
    left: '50%',
    width: 0,
    height: 0,
    opacity: 0
  });

  // Close new project dialog if the tour starts
  useEffect(() => {
    if (showWelcomeTour && setShowNewProjectDialog) {
      setShowNewProjectDialog(false);
    }
  }, [showWelcomeTour, setShowNewProjectDialog]);

  // Check if first-time load
  useEffect(() => {
    const isCompleted = localStorage.getItem('px_shop_tour_completed');
    if (isCompleted !== 'true') {
      // Small delay to let initial editor settle
      const timer = setTimeout(() => {
        setShowPrompt(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const updateSpotlight = useCallback(() => {
    const currentStep = TOUR_STEPS[stepIndex];
    if (!currentStep || !currentStep.target) {
      setSpotlightStyle({
        position: 'fixed',
        top: '50%',
        left: '50%',
        width: 0,
        height: 0,
        opacity: 0,
        borderRadius: '50%'
      });
      return;
    }
    const el = document.getElementById(currentStep.target);
    if (el) {
      const rect = el.getBoundingClientRect();
      setSpotlightStyle({
        position: 'fixed',
        top: rect.top - 6,
        left: rect.left - 6,
        width: rect.width + 12,
        height: rect.height + 12,
        opacity: 1,
        borderRadius: '8px'
      });
    } else {
      setSpotlightStyle({
        position: 'fixed',
        top: '50%',
        left: '50%',
        width: 0,
        height: 0,
        opacity: 0,
        borderRadius: '50%'
      });
    }
  }, [stepIndex]);

  // Execute step actions (e.g. opening panels)
  useEffect(() => {
    if (!showWelcomeTour) return;
    const currentStep = TOUR_STEPS[stepIndex];
    if (currentStep && currentStep.action) {
      currentStep.action({
        setActiveCol1Panel,
        setActiveCol2Panel,
        setActiveCol3Panel
      });
      // Delay measurement slightly to wait for layout shift transition
      const timer = setTimeout(() => {
        updateSpotlight();
      }, 150);
      return () => clearTimeout(timer);
    } else {
      updateSpotlight();
    }
  }, [stepIndex, showWelcomeTour, updateSpotlight, setActiveCol1Panel, setActiveCol2Panel, setActiveCol3Panel]);

  // Watch for resize/scroll to keep spotlight aligned
  useEffect(() => {
    if (showWelcomeTour) {
      window.addEventListener('resize', updateSpotlight);
      window.addEventListener('scroll', updateSpotlight, true);
      return () => {
        window.removeEventListener('resize', updateSpotlight);
        window.removeEventListener('scroll', updateSpotlight, true);
      };
    }
  }, [showWelcomeTour, updateSpotlight]);

  const handleStartTour = () => {
    setShowPrompt(false);
    setStepIndex(0);
    setShowWelcomeTour(true);
  };

  const handleSkipPrompt = () => {
    setShowPrompt(false);
    localStorage.setItem('px_shop_tour_completed', 'true');
  };

  const handleNext = () => {
    if (stepIndex < TOUR_STEPS.length - 1) {
      setStepIndex(prev => prev + 1);
    } else {
      handleFinish();
    }
  };

  const handleBack = () => {
    if (stepIndex > 0) {
      setStepIndex(prev => prev - 1);
    }
  };

  const handleFinish = () => {
    setShowWelcomeTour(false);
    localStorage.setItem('px_shop_tour_completed', 'true');
  };

  const getTooltipStyle = () => {
    const currentStep = TOUR_STEPS[stepIndex];
    if (!currentStep || !currentStep.target) {
      return {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 10001
      };
    }
    const el = document.getElementById(currentStep.target);
    if (!el) {
      return {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 10001
      };
    }
    const rect = el.getBoundingClientRect();
    const placement = currentStep.placement;

    if (placement === 'right') {
      return {
        position: 'fixed',
        top: Math.max(20, Math.min(window.innerHeight - 260, rect.top + rect.height / 2 - 100)),
        left: rect.right + 20,
        zIndex: 10001
      };
    }
    if (placement === 'left') {
      return {
        position: 'fixed',
        top: Math.max(20, Math.min(window.innerHeight - 260, rect.top + rect.height / 2 - 100)),
        left: Math.max(20, rect.left - 345),
        zIndex: 10001
      };
    }
    if (placement === 'bottom-left') {
      return {
        position: 'fixed',
        top: rect.bottom + 15,
        left: Math.max(20, rect.left - 160),
        zIndex: 10001
      };
    }
    return {
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      zIndex: 10001
    };
  };

  if (!showPrompt && !showWelcomeTour) return null;

  return (
    <>
      <style>{`
        @keyframes tourPulse {
          0% { transform: scale(1); opacity: 0.8; }
          50% { transform: scale(1.02); opacity: 0.3; }
          100% { transform: scale(1.04); opacity: 0; }
        }
        @keyframes tourFloat {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-4px); }
          100% { transform: translateY(0px); }
        }
      `}</style>

      {/* First-time welcome prompt */}
      {showPrompt && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.65)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 10005,
          backdropFilter: 'blur(4px)',
          transition: 'all 0.3s'
        }}>
          <div style={{
            width: '400px',
            backgroundColor: 'rgba(30, 30, 32, 0.9)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 12px 40px rgba(0, 0, 0, 0.6)',
            color: '#fff',
            fontFamily: 'system-ui, sans-serif',
            textAlign: 'center',
            backdropFilter: 'blur(16px)'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '15px', animation: 'tourFloat 2.5s ease-in-out infinite' }}>🎮</div>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', margin: '0 0 10px 0', color: '#fff' }}>Welcome to PxGBA!</h2>
            <p style={{ fontSize: '13px', color: '#ccc', lineHeight: '1.6', margin: '0 0 24px 0' }}>
              Would you like a quick interactive tour to guide you through the workspace and explain all of its features?
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={handleSkipPrompt}
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#ccc',
                  padding: '10px 20px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: '6px',
                  transition: 'all 0.2s',
                  outline: 'none'
                }}
                onMouseEnter={e => { e.target.style.background = 'rgba(255,255,255,0.12)'; e.target.style.color = '#fff'; }}
                onMouseLeave={e => { e.target.style.background = 'rgba(255,255,255,0.06)'; e.target.style.color = '#ccc'; }}
              >
                Maybe Later
              </button>
              <button
                onClick={handleStartTour}
                style={{
                  background: 'linear-gradient(135deg, #0078d4, #005a9e)',
                  border: 'none',
                  color: '#fff',
                  padding: '10px 24px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 'bold',
                  boxShadow: '0 4px 12px rgba(0, 120, 212, 0.3)',
                  transition: 'all 0.2s',
                  outline: 'none'
                }}
                onMouseEnter={e => { e.target.style.transform = 'translateY(-1px)'; e.target.style.boxShadow = '0 6px 16px rgba(0, 120, 212, 0.4)'; }}
                onMouseLeave={e => { e.target.style.transform = 'none'; e.target.style.boxShadow = '0 4px 12px rgba(0, 120, 212, 0.3)'; }}
              >
                Start Tour
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Tour Overlay */}
      {showWelcomeTour && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, pointerEvents: 'none' }}>
          {/* Spotlight mask element */}
          <div style={{
            position: 'fixed',
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.65)',
            border: spotlightStyle.opacity ? '2px solid #0078d4' : 'none',
            borderRadius: spotlightStyle.borderRadius,
            top: spotlightStyle.top,
            left: spotlightStyle.left,
            width: spotlightStyle.width,
            height: spotlightStyle.height,
            opacity: spotlightStyle.opacity,
            transition: 'all 0.3s cubic-bezier(0.25, 1, 0.5, 1)',
            pointerEvents: 'none',
            zIndex: 10000
          }}>
            {/* Spotlight pulse ring */}
            {spotlightStyle.opacity > 0 && (
              <div style={{
                position: 'absolute',
                inset: '-4px',
                border: '2px solid #0078d4',
                borderRadius: '12px',
                animation: 'tourPulse 1.8s infinite ease-out',
                pointerEvents: 'none'
              }} />
            )}
          </div>

          {/* Background blocker (only blocks clicks when tooltip is centered, otherwise user can click buttons inside the tour container only) */}
          <div style={{
            position: 'fixed',
            inset: 0,
            pointerEvents: TOUR_STEPS[stepIndex].target ? 'none' : 'auto',
            zIndex: 9998
          }} />

          {/* Tooltip Card */}
          <div style={{
            ...getTooltipStyle(),
            width: '500px',
            backgroundColor: 'rgba(25, 25, 27, 0.88)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '12px',
            padding: '20px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            color: '#fff',
            fontFamily: 'system-ui, sans-serif',
            backdropFilter: 'blur(12px)',
            transition: 'all 0.3s cubic-bezier(0.25, 1, 0.5, 1)',
            pointerEvents: 'auto'
          }}>
            {/* Header info */}
            <h3 style={{ margin: '0 0 8px 0', fontSize: '15px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
              {TOUR_STEPS[stepIndex].title}
            </h3>
            <p style={{ margin: '0 0 20px 0', fontSize: '12px', color: '#ddd', lineHeight: '1.5', minHeight: '60px' }}>
              {TOUR_STEPS[stepIndex].description}
            </p>

            {/* Bottom Actions Row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {/* Skip button */}
              <button
                onClick={handleFinish}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#aaa',
                  fontSize: '11px',
                  cursor: 'pointer',
                  padding: 0,
                  outline: 'none'
                }}
                onMouseEnter={e => e.target.style.color = '#fff'}
                onMouseLeave={e => e.target.style.color = '#aaa'}
              >
                Skip Tour
              </button>

              {/* Progress Indicator dots / text */}
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', color: '#888', marginRight: '4px' }}>
                  {stepIndex + 1}/{TOUR_STEPS.length}
                </span>
                {TOUR_STEPS.map((_, i) => (
                  <div
                    key={i}
                    onClick={() => setStepIndex(i)}
                    style={{
                      width: '5px',
                      height: '5px',
                      borderRadius: '50%',
                      backgroundColor: i === stepIndex ? '#0078d4' : '#444',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s'
                    }}
                  />
                ))}
              </div>

              {/* Back / Next buttons */}
              <div style={{ display: 'flex', gap: '8px' }}>
                {stepIndex > 0 && (
                  <button
                    onClick={handleBack}
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '6px',
                      color: '#eee',
                      padding: '5px 10px',
                      fontSize: '11px',
                      cursor: 'pointer',
                      outline: 'none'
                    }}
                    onMouseEnter={e => { e.target.style.background = 'rgba(255,255,255,0.1)'; e.target.style.color = '#fff'; }}
                    onMouseLeave={e => { e.target.style.background = 'rgba(255,255,255,0.05)'; e.target.style.color = '#eee'; }}
                  >
                    Back
                  </button>
                )}
                <button
                  onClick={handleNext}
                  style={{
                    background: stepIndex === TOUR_STEPS.length - 1 ? '#4CAF50' : '#0078d4',
                    border: 'none',
                    borderRadius: '6px',
                    color: '#fff',
                    padding: '5px 14px',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    outline: 'none',
                    boxShadow: stepIndex === TOUR_STEPS.length - 1 ? '0 2px 6px rgba(76,175,80,0.3)' : '0 2px 6px rgba(0,120,212,0.3)'
                  }}
                >
                  {stepIndex === TOUR_STEPS.length - 1 ? 'Finish' : 'Next'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default WelcomeTour;
