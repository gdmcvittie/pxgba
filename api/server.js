const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { exec, spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const AdmZip = require('adm-zip');
const { mockTilesetBmpBase64, mockSearchHtml, mockDetailsHtml, mockModSearchHtml } = require('./mockData');

// Resolve the downloads directory (with environment variable fallback for packaged apps like Linux AppImages)
const downloadDir = process.env.DOWNLOADS_DIR || path.join(__dirname, 'downloads');
try {
  if (!fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir, { recursive: true });
  }
} catch (err) {
  console.error(`[server] Failed to create downloads directory ${downloadDir}:`, err);
}

process.on('uncaughtException', (err) => {
  console.error('[server] Uncaught exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('[server] Unhandled rejection:', reason);
  process.exit(1);
});

const app = express();
const port = parseInt(process.env.PORT, 10) || 3001;

const isDesktop = process.env.NODE_ENV === 'production' || process.send !== undefined;

app.use(cors({
  origin: isDesktop
    ? '*'
    : ['https://pxgba.liftedpixel.ca', 'http://localhost:5173', 'http://localhost:3000'],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Disposition', 'Content-Type']
}));

const upload = multer({ dest: os.tmpdir() });

// Track compilation jobs for async polling
const jobs = new Map();

// Clean up stale jobs every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [jobId, job] of jobs) {
    if (now - job.createdAt > 60 * 60 * 1000) { // 1 hour
      jobs.delete(jobId);
    }
  }
}, 5 * 60 * 1000);

app.post('/compile', upload.single('project'), (req, res) => {
  if (!req.file) {
    return res.status(400).send('No project zip file uploaded.');
  }

  const jobId = crypto.randomUUID();
  const job = { status: 'running', createdAt: Date.now(), downloadFile: null, error: null, diagnosticsInfo: null };
  jobs.set(jobId, job);

  // Return 202 immediately so the connection isn't held open for the full compilation
  res.status(202).json({ jobId });

  // Run compilation in background
  setImmediate(() => {
    const zipPath = req.file.path;
    const extractPath = path.join(os.tmpdir(), `pxgba-${Date.now()}`);

    const failJob = (msg) => {
      job.status = 'error';
      job.error = msg;
      jobs.set(jobId, job);
    };

    let didCleanup = false;
    const doCleanup = () => {
      if (didCleanup) return;
      didCleanup = true;
      try {
        if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
        if (fs.existsSync(extractPath)) fs.rmSync(extractPath, { recursive: true, force: true });
      } catch (cleanupErr) {
        console.error(`Cleanup error: ${cleanupErr}`);
      }
    };

    try {
      const zip = new AdmZip(zipPath);
      zip.extractAllTo(extractPath, true);

      console.log(`Extracted to: ${extractPath}`);
      console.log(`Compiling...`);

      const isWindows = process.platform === 'win32';
      const pathSeparator = isWindows ? ';' : ':';

      // Resolve buildTools path
      let buildToolsPath = path.join(__dirname, 'buildTools');
      if (!fs.existsSync(buildToolsPath)) {
        const siblingPath = path.resolve(__dirname, '../buildTools');
        if (fs.existsSync(siblingPath)) {
          buildToolsPath = siblingPath;
        } else {
          buildToolsPath = path.resolve(__dirname, '../..', 'buildTools');
        }
      }

      // If we are on Windows, we create/ensure a space-free directory junction to buildTools
      if (isWindows) {
        const junctionPath = 'C:\\Users\\Public\\pxgba-build-tools';
        try {
          let shouldCreate = true;
          if (fs.existsSync(junctionPath)) {
            try {
              const currentTarget = fs.readlinkSync(junctionPath);
              if (path.resolve(currentTarget) === path.resolve(buildToolsPath)) {
                shouldCreate = false;
              } else {
                fs.rmdirSync(junctionPath);
              }
            } catch (readErr) {
              try {
                fs.rmdirSync(junctionPath);
              } catch (rmErr) {}
            }
          }
          if (shouldCreate) {
            fs.symlinkSync(buildToolsPath, junctionPath, 'junction');
          }
          buildToolsPath = junctionPath;
          console.log(`[server] Using buildTools directory junction at ${junctionPath}`);
        } catch (e) {
          console.error('[server] Failed to setup buildTools directory junction:', e.message);
        }
      }

      // Resolve devkitARM and devkitPRO paths strictly from the bundled buildTools folder
      const devkitarmPath = isWindows
        ? path.join(buildToolsPath, 'windows', 'devkitpro', 'devkitARM')
        : path.join(buildToolsPath, 'linux', 'devkitpro', 'devkitARM');

      const devkitproPath = isWindows
        ? path.join(buildToolsPath, 'windows', 'devkitpro')
        : path.join(buildToolsPath, 'linux', 'devkitpro');

      let libButanoPath = path.join(buildToolsPath, 'butano', 'butano');

      let formattedDevkitarm = devkitarmPath;
      let formattedDevkitpro = devkitproPath;

      if (isWindows) {
        libButanoPath = libButanoPath.replace(/\\/g, '/');
        formattedDevkitarm = formattedDevkitarm.replace(/\\/g, '/');
        formattedDevkitpro = formattedDevkitpro.replace(/\\/g, '/');
      }

      // Convert Windows paths to short format (8.3) to avoid spaces
      const getShortPath = (longPath) => {
        if (!isWindows) return longPath;
        try {
          const { execSync } = require('child_process');
          const result = execSync(`for %I in ("${longPath}") do @echo %~sI`, { 
            encoding: 'utf8', 
            windowsHide: true,
            stdio: ['pipe', 'pipe', 'pipe']
          }).trim();
          return result || longPath;
        } catch (e) {
          console.warn(`Failed to get short path for ${longPath}:`, e.message);
          return longPath;
        }
      };

      // Use short paths on Windows to avoid space issues in Makefiles
      if (isWindows) {
        libButanoPath = getShortPath(libButanoPath).replace(/\\/g, '/');
        formattedDevkitarm = getShortPath(formattedDevkitarm).replace(/\\/g, '/');
        formattedDevkitpro = getShortPath(formattedDevkitpro).replace(/\\/g, '/');
      }

      // Escape spaces for Make (Make interprets unescaped spaces as separators)
      // Note: We use short paths on Windows to avoid spaces entirely, but this is a fallback
      const escapeForMake = (p) => p.replace(/ /g, '\\ ');
      const libButanoPathEscaped = escapeForMake(libButanoPath);
      const formattedDevkitarmEscaped = escapeForMake(formattedDevkitarm);
      const formattedDevkitproEscaped = escapeForMake(formattedDevkitpro);

      const dkaBin = path.join(devkitarmPath, 'bin');
      let newPath = getShortPath(dkaBin);
      if (isWindows) {
        // Convert paths to short format to avoid space issues
        const devkitproToolsBin = getShortPath(path.join(devkitproPath, 'tools', 'bin'));
        const gitUsrBin = getShortPath('C:\\Program Files\\Git\\usr\\bin');
        newPath += ';' + devkitproToolsBin + ';' + gitUsrBin;
      } else {
        const possibleToolsBinPaths = [
          path.join(devkitproPath, 'tools', 'bin')
        ];
        possibleToolsBinPaths.forEach(p => {
          if (fs.existsSync(p)) {
            newPath += pathSeparator + p;
          }
        });
      }
      newPath += pathSeparator + process.env.PATH;

      // Resolve makeCmd and pythonCmd (prioritizing the bundled ones inside buildTools)
      let makeCmd = 'make';
      let pythonCmd = isWindows ? 'python' : 'python3';

      if (isWindows) {
        const bundledMakeDir = path.join(buildToolsPath, 'windows', 'bin');
        const bundledMake = path.join(bundledMakeDir, 'make.exe');
        if (fs.existsSync(bundledMake)) {
          makeCmd = bundledMake;
          newPath = getShortPath(bundledMakeDir) + ';' + newPath;
        }

        const bundledPythonDir = path.join(buildToolsPath, 'windows', 'python');
        const bundledPython = path.join(bundledPythonDir, 'python.exe');
        if (fs.existsSync(bundledPython)) {
          pythonCmd = bundledPython;
          newPath = getShortPath(bundledPythonDir) + ';' + newPath;
        }
      } else {
        const bundledMakeDir = path.join(buildToolsPath, 'linux', 'bin');
        const bundledMake = path.join(bundledMakeDir, 'make');
        if (fs.existsSync(bundledMake)) {
          makeCmd = bundledMake;
          newPath = bundledMakeDir + ':' + newPath;
        }

        const bundledPythonDir = path.join(buildToolsPath, 'linux', 'python', 'bin');
        const bundledPython = path.join(bundledPythonDir, 'python3');
        if (fs.existsSync(bundledPython)) {
          pythonCmd = bundledPython;
          newPath = bundledPythonDir + ':' + newPath;
        }
      }

      if (isWindows) {
        makeCmd = makeCmd.replace(/\\/g, '/');
        pythonCmd = pythonCmd.replace(/\\/g, '/');
        // Convert makeCmd and pythonCmd to short paths to avoid space issues
        makeCmd = getShortPath(makeCmd).replace(/\\/g, '/');
        pythonCmd = getShortPath(pythonCmd).replace(/\\/g, '/');
      }

      let diagnosticsInfo = `[Diagnostic] Platform: ${process.platform}\n`;
      diagnosticsInfo += `[Diagnostic] __dirname: ${__dirname}\n`;
      diagnosticsInfo += `[Diagnostic] DEVKITARM env: ${process.env.DEVKITARM || 'not set'}\n`;
      diagnosticsInfo += `[Diagnostic] DEVKITPRO env: ${process.env.DEVKITPRO || 'not set'}\n`;
      diagnosticsInfo += `[Diagnostic] resolved buildToolsPath: ${buildToolsPath}\n`;
      diagnosticsInfo += `[Diagnostic] resolved devkitarmPath: ${devkitarmPath}\n`;
      diagnosticsInfo += `[Diagnostic] resolved devkitproPath: ${devkitproPath}\n`;
      diagnosticsInfo += `[Diagnostic] formatted libButanoPath: ${libButanoPath}\n`;
      diagnosticsInfo += `[Diagnostic] formatted devkitarm: ${formattedDevkitarm}\n`;
      diagnosticsInfo += `[Diagnostic] formatted devkitpro: ${formattedDevkitpro}\n`;
      diagnosticsInfo += `[Diagnostic] calculated PATH: ${newPath}\n`;

      const pathsToCheck = [
        path.join(devkitproPath, 'tools', 'bin', isWindows ? 'mmutil.exe' : 'mmutil'),
        path.join(devkitarmPath, 'bin', isWindows ? 'mmutil.exe' : 'mmutil')
      ];
      pathsToCheck.forEach(p => {
        diagnosticsInfo += `[Diagnostic] Path check: ${p} -> ${fs.existsSync(p) ? 'EXISTS' : 'NOT FOUND'}\n`;
      });

      job.diagnosticsInfo = diagnosticsInfo;
      jobs.set(jobId, job);

      const env = {
        ...process.env,
        DEVKITARM: formattedDevkitarmEscaped,
        DEVKITPRO: formattedDevkitproEscaped,
        PATH: newPath
      };

      const runMake = () => {
        const jobsCount = os.cpus().length > 1 ? 2 : 1;
        console.log(`Running make with LIBBUTANO=${libButanoPath} (jobs: ${jobsCount})...`);
        exec(`"${makeCmd}" -j${jobsCount} LIBBUTANO="${libButanoPathEscaped}" LIBBUTANOABS="${libButanoPathEscaped}" PYTHON="${pythonCmd}"`, { cwd: extractPath, env, timeout: 600000 }, (error, stdout, stderr) => {
          console.log('stdout:', stdout);
          console.error('stderr:', stderr);

          if (error) {
            doCleanup();
            if (error.killed) {
              console.error(`Compilation timed out and was killed.`);
              failJob(`Compilation timed out after 10 minutes.\n${diagnosticsInfo}\n${stdout}\n${stderr}`);
            } else {
              console.error(`Compilation error: ${error.message}`);
              failJob(`Compilation failed:\n${diagnosticsInfo}\n${stdout}\n${stderr}`);
            }
            return;
          }

          // Find the compiled .gba file
          let gbaFile;
          let files = fs.readdirSync(extractPath);
          gbaFile = files.find(file => file.endsWith('.gba'));

          if (!gbaFile) {
            const buildPath = path.join(extractPath, 'build');
            if (fs.existsSync(buildPath)) {
              files = fs.readdirSync(buildPath);
              gbaFile = files.find(file => file.endsWith('.gba'));
            }
          }

          if (!gbaFile) {
            doCleanup();
            failJob('.gba file not found after compilation');
            return;
          }

          let gbaPath;
          if (gbaFile.includes('/') || gbaFile.includes('\\') || fs.existsSync(path.join(extractPath, gbaFile))) {
            gbaPath = path.join(extractPath, gbaFile);
          } else {
            gbaPath = path.join(extractPath, 'build', gbaFile);
          }

          const isHtml5 = req.body.html5 === 'true';
          const isExe = req.body.exe === 'true';

          try {
            if (!fs.existsSync(downloadDir)) {
              fs.mkdirSync(downloadDir, { recursive: true });
            }

            if (isExe) {
              try {
                const winExeDir = path.join(buildToolsPath, 'windows_exe');
                if (!fs.existsSync(winExeDir)) {
                  throw new Error('windows_exe folder not found in buildTools');
                }

                const outputZip = new AdmZip();

                // Add compiled game.gba
                outputZip.addFile('game.gba', fs.readFileSync(gbaPath));

                // Add files from windows_exe directory
                const files = fs.readdirSync(winExeDir);
                for (const file of files) {
                  const filePath = path.join(winExeDir, file);
                  if (fs.statSync(filePath).isFile()) {
                    outputZip.addFile(file, fs.readFileSync(filePath));
                  }
                }

                const zipDownloadFile = `${crypto.randomUUID()}_windows.zip`;
                const zipPath = path.join(downloadDir, zipDownloadFile);
                fs.writeFileSync(zipPath, outputZip.toBuffer());

                job.status = 'ready';
                job.downloadFile = zipDownloadFile;
                jobs.set(jobId, job);
                console.log(`EXE export ready (ZIP): ${zipDownloadFile}`);
              } catch (exeErr) {
                console.error(`EXE export error: ${exeErr}`);
                failJob(`EXE export failed: ${exeErr.message}`);
              } finally {
                doCleanup();
              }
            } else {
              let downloadFile;
              if (isHtml5) {
                const bgColor = req.body.bgColor || '#1a1a2e';
                const containerColor = req.body.containerColor || '#16213e';
                const userCredits = req.body.credits || '';
                const gbaData = fs.readFileSync(gbaPath);

                const searchDirs = [
                  path.join(__dirname, '..', 'public'),
                  path.join(__dirname, '..', 'dist'),
                  path.join(__dirname, 'public'),
                  __dirname,
                ];
                let iodineBundleSrc = searchDirs.find(d => fs.existsSync(path.join(d, 'iodine-gba.bundle.js')));
                let biosSrc = searchDirs.find(d => fs.existsSync(path.join(d, 'gba_bios.bin')));

                if (!iodineBundleSrc) throw new Error('iodine-gba.bundle.js not found');
                if (!biosSrc) throw new Error('gba_bios.bin not found');

                const iodineJs = fs.readFileSync(path.join(iodineBundleSrc, 'iodine-gba.bundle.js'), 'utf-8');
                const biosBuf = fs.readFileSync(path.join(biosSrc, 'gba_bios.bin'));

                const title = gbaFile.replace(/\.gba$/i, '');
                const indexHtml = generateHtml5ExportIndexHtml(
                  title, bgColor, containerColor, userCredits,
                  iodineJs,
                  biosBuf.toString('base64'),
                  gbaData.toString('base64')
                );

                const outputZip = new AdmZip();
                outputZip.addFile('index.html', Buffer.from(indexHtml, 'utf-8'));

                downloadFile = `${crypto.randomUUID()}_${title}-html5.zip`;
                fs.writeFileSync(path.join(downloadDir, downloadFile), outputZip.toBuffer());
                console.log(`HTML5 export ready: ${downloadFile}`);
              } else {
                downloadFile = `${crypto.randomUUID()}_${gbaFile}`;
                fs.copyFileSync(gbaPath, path.join(downloadDir, downloadFile));
                console.log(`Download ready: ${downloadFile}`);
              }

              job.status = 'ready';
              job.downloadFile = downloadFile;
              jobs.set(jobId, job);
            }
          } catch (err) {
            console.error(`Response error: ${err}`);
            failJob(`Failed to prepare response: ${err.message}`);
          } finally {
            doCleanup();
          }
        });
      };

      runMake();
    } catch (err) {
      doCleanup();
      console.error(err);
      failJob('Error extracting or compiling project.');
    }
  });
});

app.get('/compile-status/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ status: 'not_found' });
  }
  res.json({
    status: job.status,
    downloadUrl: job.downloadFile ? `/downloads/${job.downloadFile}` : null,
    error: job.error,
  });
});

function generateHtml5ExportIndexHtml(title, bgColor, containerColor, userCredits, iodineJs, biosBase64, romBase64) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>PxGBA HTML Export</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  background: ${bgColor};
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  padding: 16px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  user-select: none;
  -webkit-user-select: none;
}
#player-container {
  background: ${containerColor};
  padding: 24px;
  border-radius: 16px;
  box-shadow: 0 8px 40px rgba(0,0,0,0.5);
  position: relative;
  width: 100%;
  max-width: 528px;
}
#screen-wrapper {
  position: relative;
  width: 100%;
  aspect-ratio: 3 / 2;
  background: #000;
  border-radius: 4px;
  overflow: hidden;
}
#gba-canvas {
  display: block;
  width: 100%;
  height: 100%;
  image-rendering: pixelated;
  image-rendering: crisp-edges;
}
#player-container:fullscreen, #player-container:fullscreen #overlay {
  border-radius: 0;
}
#player-container:fullscreen {
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${bgColor};
  max-width: none;
}
#player-container:fullscreen #screen-wrapper {
  width: min(100vw, calc(100vh * 3 / 2));
  height: min(100vh, calc(100vw * 2 / 3));
  border-radius: 0;
  aspect-ratio: auto;
}
#player-container:fullscreen #controls-hint {
  display: none;
}
#fs-toggle {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 36px;
  height: 36px;
  background: rgba(0,0,0,0.5);
  border: 1px solid rgba(255,255,255,0.2);
  border-radius: 8px;
  color: #fff;
  font-size: 18px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 20;
  transition: background 0.2s;
}
#fs-toggle:hover { background: rgba(0,0,0,0.75); }
#player-container:fullscreen #fs-toggle { bottom: 16px; right: 16px; }
#overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background: rgba(0,0,0,0.6);
  cursor: pointer;
  transition: opacity 0.3s;
  z-index: 10;
}
#overlay.hidden { opacity: 0; pointer-events: none; }
#overlay .icon { font-size: 48px; margin-bottom: 12px; opacity: 0.8; }
#overlay .label { color: #fff; font-size: 18px; font-weight: bold; }
#overlay .sub { color: #aaa; font-size: 13px; margin-top: 6px; }
#controls-hint {
  text-align: center;
  margin-top: 12px;
  color: #888;
  font-size: 12px;
  font-family: monospace;
}
@media (max-width: 540px) {
  #player-container { padding: 12px; border-radius: 8px; }
}
</style>
</head>
<body>
<div id="player-container">
  <div id="screen-wrapper">
    <canvas id="gba-canvas" width="240" height="160"></canvas>
    <div id="overlay">
      <div class="icon">🎮</div>
      <div class="label">Click to Start</div>
    </div>
  </div>
  <div id="controls-hint">Arrow Keys &middot; Z=B &middot; X=A &middot; Enter=Start &middot; Shift=Select &middot; Q=L &middot; W=R</div>
  ${userCredits ? `<div id="credits-text" style="text-align:center;margin-top:8px;color:#aaa;font-size:11px;font-family:monospace">${userCredits.split(',').map(s => s.trim()).filter(Boolean).join('<br>')}</div>` : ''}
  <button id="fs-toggle" title="Toggle Fullscreen">⛶</button>
</div>

<script>${iodineJs.replace(/<\/script>/gi, '<\\/script>')}<\/script>
<script>
(function() {
  'use strict';
  const canvas = document.getElementById('gba-canvas');
  const overlay = document.getElementById('overlay');
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(240, 160);

  let iodine = null;
  let audioCtx = null;
  let resampleBuffer = [];
  let resamplePos = 0;
  let emuSampleRate = 44100;
  let ctxSampleRate = 44100;
  let volume = 1.0;

  function base64ToBytes(b64) {
    var binary = atob(b64);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  function initAudio() {
    try {
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtor) return;
      audioCtx = new AudioCtor();
      ctxSampleRate = audioCtx.sampleRate;
      iodine.audio = {
        initialize: function(channels, sRate, bAmount, vol, errCallback) {
          emuSampleRate = sRate;
          volume = vol;
        },
        register: function() {
          var scriptNode = audioCtx.createScriptProcessor(4096, 0, 2);
          var ratio = emuSampleRate / ctxSampleRate;
          scriptNode.onaudioprocess = function(e) {
            var left = e.outputBuffer.getChannelData(0);
            var right = e.outputBuffer.getChannelData(1);
            var len = left.length;
            var pos = resamplePos;
            var buf = resampleBuffer;
            var bufLen = buf.length;
            for (var i = 0; i < len; i++) {
              var idx = Math.floor(pos) * 2;
              if (idx + 1 < bufLen) {
                var frac = pos - Math.floor(pos);
                var nextIdx = idx + 2;
                if (nextIdx + 1 < bufLen) {
                  left[i] = (buf[idx] + (buf[nextIdx] - buf[idx]) * frac) * volume;
                  right[i] = (buf[idx + 1] + (buf[nextIdx + 1] - buf[idx + 1]) * frac) * volume;
                } else {
                  left[i] = buf[idx] * volume;
                  right[i] = buf[idx + 1] * volume;
                }
              } else {
                left[i] = 0;
                right[i] = 0;
              }
              pos += ratio;
            }
            var consumed = Math.floor(pos) * 2;
            if (consumed > 0) {
              resampleBuffer.splice(0, Math.min(consumed, resampleBuffer.length));
            }
            resamplePos = pos - Math.floor(pos);
          };
          scriptNode.connect(audioCtx.destination);
        },
        unregister: function() {},
        changeVolume: function(vol) { volume = vol; },
        remainingBuffer: function() { return (resampleBuffer.length / 2) | 0; },
        play: function() {},
        pause: function() {},
        setVolume: function() {},
        push: function(buffer) {
          if (!buffer || buffer.length === 0) return;
          for (var i = 0; i < buffer.length; i++) {
            resampleBuffer.push(buffer[i]);
          }
        }
      };
    } catch(e) { console.warn('Audio init failed:', e); }
  }

  function startEmulator() {
    try {
      overlay.classList.add('hidden');

      if (!window.IodineGBA) {
        overlay.querySelector('.label').textContent = 'Emulator failed to load';
        return;
      }

      var biosData = base64ToBytes('${biosBase64}');
      var romData = base64ToBytes('${romBase64}');

      iodine = new window.IodineGBA();

      if (typeof iodine.setCanvas === 'function') {
        iodine.setCanvas(canvas);
      } else if (typeof iodine.attachCanvas === 'function') {
        iodine.attachCanvas(canvas);
      } else if (typeof iodine.attachGraphicsFrameHandler === 'function') {
        iodine.attachGraphicsFrameHandler(function(frameBuffer) {
          if (!frameBuffer) return;
          if (frameBuffer.length === 240 * 160 * 4) {
            imgData.data.set(frameBuffer);
          } else if (frameBuffer.length === 240 * 160 * 3) {
            for (var i = 0, j = 0; i < frameBuffer.length; i += 3, j += 4) {
              imgData.data[j] = frameBuffer[i];
              imgData.data[j + 1] = frameBuffer[i + 1];
              imgData.data[j + 2] = frameBuffer[i + 2];
              imgData.data[j + 3] = 255;
            }
          }
          ctx.putImageData(imgData, 0, 0);
        });
      }

      if (typeof iodine.disableAudio === 'function') iodine.disableAudio();
      initAudio();

      if (typeof iodine.setBios === 'function') {
        iodine.setBios(biosData);
      } else if (typeof iodine.attachBIOS === 'function') {
        iodine.attachBIOS(biosData);
      }

      if (typeof iodine.setRom === 'function') {
        iodine.setRom(romData);
      } else if (typeof iodine.setROM === 'function') {
        iodine.setROM(romData);
      } else if (typeof iodine.attachROM === 'function') {
        iodine.attachROM(romData);
      } else if (typeof iodine.loadRom === 'function') {
        iodine.loadRom(romData);
      }

      if (typeof iodine.play === 'function') {
        iodine.play();
      } else if (typeof iodine.start === 'function') {
        iodine.start();
      } else if (typeof iodine.run === 'function') {
        iodine.run();
      }

      // Keyboard input
      var keyMap = {
        'ArrowUp': 'UP', 'ArrowDown': 'DOWN', 'ArrowLeft': 'LEFT', 'ArrowRight': 'RIGHT',
        'KeyZ': 'B', 'KeyX': 'A', 'KeyS': 'B', 'KeyA': 'A',
        'Enter': 'START', 'ShiftLeft': 'SELECT', 'ShiftRight': 'SELECT',
        'KeyQ': 'L', 'KeyW': 'R'
      };
      function onKey(e) {
        var gbaKey = keyMap[e.code];
        if (!gbaKey) return;
        e.preventDefault();
        if (e.type === 'keydown') {
          if (typeof iodine.keyDown === 'function') iodine.keyDown(gbaKey);
        } else {
          if (typeof iodine.keyUp === 'function') iodine.keyUp(gbaKey);
        }
      }
      document.addEventListener('keydown', onKey);
      document.addEventListener('keyup', onKey);

      // Gamepad input polling
      var prevGamepadState = {
        'UP': false, 'DOWN': false, 'LEFT': false, 'RIGHT': false,
        'A': false, 'B': false, 'START': false, 'SELECT': false, 'L': false, 'R': false
      };
      function pollGamepad() {
        if (!iodine) {
          requestAnimationFrame(pollGamepad);
          return;
        }
        var gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
        var activeGamepad = null;
        for (var i = 0; i < gamepads.length; i++) {
          if (gamepads[i] && gamepads[i].connected) {
            activeGamepad = gamepads[i];
            break;
          }
        }
        if (activeGamepad) {
          var currentState = {
            'UP': false, 'DOWN': false, 'LEFT': false, 'RIGHT': false,
            'A': false, 'B': false, 'START': false, 'SELECT': false, 'L': false, 'R': false
          };

          if (activeGamepad.buttons[12] && activeGamepad.buttons[12].pressed) currentState['UP'] = true;
          if (activeGamepad.buttons[13] && activeGamepad.buttons[13].pressed) currentState['DOWN'] = true;
          if (activeGamepad.buttons[14] && activeGamepad.buttons[14].pressed) currentState['LEFT'] = true;
          if (activeGamepad.buttons[15] && activeGamepad.buttons[15].pressed) currentState['RIGHT'] = true;

          if (activeGamepad.axes[0] !== undefined) {
            if (activeGamepad.axes[0] < -0.5) currentState['LEFT'] = true;
            if (activeGamepad.axes[0] > 0.5) currentState['RIGHT'] = true;
          }
          if (activeGamepad.axes[1] !== undefined) {
            if (activeGamepad.axes[1] < -0.5) currentState['UP'] = true;
            if (activeGamepad.axes[1] > 0.5) currentState['DOWN'] = true;
          }

          if (activeGamepad.buttons[0] && activeGamepad.buttons[0].pressed) currentState['A'] = true;
          if (activeGamepad.buttons[1] && activeGamepad.buttons[1].pressed) currentState['B'] = true;
          if (activeGamepad.buttons[2] && activeGamepad.buttons[2].pressed) currentState['B'] = true;
          if (activeGamepad.buttons[3] && activeGamepad.buttons[3].pressed) currentState['A'] = true;

          if (activeGamepad.buttons[4] && activeGamepad.buttons[4].pressed) currentState['L'] = true;
          if (activeGamepad.buttons[5] && activeGamepad.buttons[5].pressed) currentState['R'] = true;

          if (activeGamepad.buttons[8] && activeGamepad.buttons[8].pressed) currentState['SELECT'] = true;
          if (activeGamepad.buttons[9] && activeGamepad.buttons[9].pressed) currentState['START'] = true;

          Object.keys(currentState).forEach(function(key) {
            var isPressed = currentState[key];
            var wasPressed = prevGamepadState[key];
            if (isPressed !== wasPressed) {
              if (isPressed) {
                if (typeof iodine.keyDown === 'function') iodine.keyDown(key);
              } else {
                if (typeof iodine.keyUp === 'function') iodine.keyUp(key);
              }
            }
          });
          prevGamepadState = currentState;
        }
        requestAnimationFrame(pollGamepad);
      }
      requestAnimationFrame(pollGamepad);
    } catch (err) {
      console.error('Emulator error:', err);
      overlay.querySelector('.label').textContent = 'Error: ' + err.message;
      overlay.classList.remove('hidden');
    }
  }

  overlay.addEventListener('click', startEmulator);

  // Fullscreen toggle
  var fsBtn = document.getElementById('fs-toggle');
  var playerContainer = document.getElementById('player-container');
  fsBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    if (!document.fullscreenElement) {
      if (playerContainer.requestFullscreen) {
        playerContainer.requestFullscreen();
      } else if (playerContainer.webkitRequestFullscreen) {
        playerContainer.webkitRequestFullscreen();
      } else if (playerContainer.msRequestFullscreen) {
        playerContainer.msRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      }
    }
  });
})();
<\/script>
</body>
</html>`;
}

// Helper to generate a minimal valid 2104-byte ProTracker .mod file dynamically
const generateEmptyModBuffer = () => {
  const buffer = Buffer.alloc(2104);
  // Write Title
  buffer.write("Mock Song", 0);

  // Set instrument sample loop properties to prevent crashes in players
  for (let inst = 0; inst < 31; inst++) {
    const instOffset = 20 + inst * 30;
    buffer.writeUInt16BE(1, instOffset + 28); // Loop length = 1 word (2 bytes)
  }

  // Song length: 1 pattern
  buffer[950] = 1;
  // Format tag: "M.K." at offset 1080
  buffer.write("M.K.", 1080);

  return buffer;
};

app.get('/proxy-oga', async (req, res) => {
  let targetUrl = req.query.url;
  if (!targetUrl) {
    return res.status(400).send('Missing url parameter');
  }

  // Extract the raw URL parameter robustly in case the frontend missed encodeURIComponent()
  const urlParamIndex = req.url.indexOf('url=');
  if (urlParamIndex !== -1) {
    try { targetUrl = decodeURIComponent(req.url.substring(urlParamIndex + 4)); } catch (e) { }
  }

  // Prevent the browser from caching the mock fallback or identical search results
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

  // Helper to serve the mock tileset image
  const serveMockBmp = () => {
    res.setHeader('Content-Type', 'image/bmp');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(Buffer.from(mockTilesetBmpBase64, 'base64'));
  };

  // Helper to serve the mock ZIP file
  const serveMockZip = () => {
    try {
      const zip = new AdmZip();
      const bmpBuffer = Buffer.from(mockTilesetBmpBase64, 'base64');
      zip.addFile("mock-tileset.bmp", bmpBuffer);
      zip.addFile("mock-tileset-alt.bmp", bmpBuffer);
      const zipBuffer = zip.toBuffer();
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.send(zipBuffer);
    } catch (err) {
      console.error('Error generating mock ZIP:', err);
      res.status(500).send('Error generating mock ZIP');
    }
  };

  // Intercept explicit mock URLs or offline fallback
  if (targetUrl.includes('mock-file-tileset.zip')) {
    return serveMockZip();
  }
  if (targetUrl.includes('mock-preview') || targetUrl.includes('mock-file-tileset') || targetUrl.includes('mock-file-single.png')) {
    return serveMockBmp();
  }
  if (targetUrl.includes('mock-overworld-tileset') || targetUrl.includes('mock-dungeon-tileset') || targetUrl.includes('mock-castle-tileset')) {
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.send(mockDetailsHtml);
  }

  try {
    const parsedUrl = new URL(targetUrl);
    const hostname = parsedUrl.hostname.toLowerCase();

    // Safety check: allow opengameart.org and modarchive.org domains
    const isOga = hostname === 'opengameart.org' || hostname.endsWith('.opengameart.org');
    const isModArchive = hostname === 'modarchive.org' || hostname.endsWith('.modarchive.org');
    if (!isOga && !isModArchive) {
      return res.status(400).send('Invalid target host. Only opengameart.org and modarchive.org are allowed.');
    }

    // Force HTTPS to prevent redirects that strip the Cookie header, and automatically encode unescaped spaces
    if (parsedUrl.protocol === 'http:') {
      parsedUrl.protocol = 'https:';
    }
    targetUrl = parsedUrl.href;

    const requestHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Upgrade-Insecure-Requests': '1',
      'Referer': 'https://modarchive.org/'
    };

    // Instantiate the timeout controller early and increase it to 45 seconds.
    // ModArchive searches can be very slow, and we need the pre-fetch to share this timeout so it doesn't hang forever.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);

    // If it's a ModArchive search, make an initial request to enable detailed view
    if (isModArchive && targetUrl.includes('request=search')) {
      try {
        console.log('Pre-fetching ModArchive detail toggle to set session cookie...');
        const detailRes = await fetch('https://modarchive.org/index.php?detail=1', {
          headers: requestHeaders,
          redirect: 'manual',
          signal: controller.signal
        });
        const setCookies = detailRes.headers.getSetCookie ? detailRes.headers.getSetCookie() : detailRes.headers.get('set-cookie');
        if (setCookies) {
          let cookiesArray = [];
          if (Array.isArray(setCookies)) {
            cookiesArray = setCookies;
          } else if (typeof setCookies === 'string') {
            // Split combined cookie strings safely, ignoring commas inside expiration dates
            cookiesArray = setCookies.split(/,(?=\s*[a-zA-Z0-9_-]+\=)/);
          }
          const cookiesList = cookiesArray.map(c => c.split(';')[0]).filter(Boolean);
          if (cookiesList.length > 0) {
            requestHeaders['Cookie'] = cookiesList.join('; ');
            console.log('Set Cookie header for search:', requestHeaders['Cookie']);
          }
        }
      } catch (err) {
        console.warn('Failed to pre-fetch ModArchive detail toggle:', err.message);
      }
    }

    const response = await fetch(targetUrl, {
      headers: requestHeaders,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP Error ${response.status}`);
    }

    const contentType = response.headers.get('content-type');
    let dataBuffer = await response.arrayBuffer();

    if (contentType && contentType.includes('text/html') && targetUrl.includes('modarchive.org')) {
      let html = new TextDecoder('utf-8').decode(dataBuffer);

      // Rewrite style assets to go through the proxy
      html = html.replace(/(href|src)=["'](style\/[^"']+)["']/g, (m, attr, val) => {
        return `${attr}="/proxy-oga?url=${encodeURIComponent(`https://modarchive.org/${val}`)}"`;
      });

      // Rewrite jsplayer path to go through the proxy
      html = html.replace(/path\s*=\s*["'](jsplayer\.php[^"']+)["']/g, (m, val) => {
        return `path = "/proxy-oga?url=" + encodeURIComponent("https://modarchive.org/${val}")`;
      });

      // Rewrite Emscripten locateFile function to go through the proxy
      html = html.replace(/return\s+s\s*\+\s*['"]\?(\d+)['"]\s*;/g, (m, val) => {
        return `return "/proxy-oga?url=" + encodeURIComponent("https://modarchive.org/style/js/" + s + "?${val}");`;
      });

      dataBuffer = Buffer.from(html, 'utf-8');
    }

    if (contentType) {
      res.setHeader('Content-Type', contentType);
    }
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(Buffer.from(dataBuffer));
  } catch (error) {
    console.warn(`Proxy fetch failed for ${targetUrl}: ${error.message}. Serving offline mock fallback.`);

    // Determine offline fallback based on URL structure
    if (targetUrl.includes('art-search-advanced')) {
      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.send(mockSearchHtml);
    } else if (targetUrl.includes('/content/')) {
      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.send(mockDetailsHtml);
    } else if (targetUrl.includes('modarchive.org') && targetUrl.includes('request=search')) {
      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.send(mockModSearchHtml);
    } else if (targetUrl.includes('downloads.php') || targetUrl.includes('jsplayer.php')) {
      res.setHeader('Content-Type', 'audio/x-mod');
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.send(generateEmptyModBuffer());
    } else {
      // Fallback for files/images
      if (targetUrl.endsWith('.zip') || targetUrl.includes('zip') || targetUrl.includes('.zip')) {
        return serveMockZip();
      }
      return serveMockBmp();
    }
  }
});

app.get('/game.pxg', (req, res) => {
  // In development: __dirname = <project>/api/
  // In packaged (extraResources): __dirname = <install>/resources/api/
  const dir = __dirname;
  const searchPaths = [
    // Packaged: resources/app.asar.unpacked/dist/game.pxg (net.fetch compatible)
    path.join(dir, '..', 'app.asar.unpacked', 'dist', 'game.pxg'),
    // Dev: project/public/game.pxg
    path.join(dir, '..', 'public', 'game.pxg'),
    // Fallback: project/game.pxg
    path.join(dir, '..', '..', 'game.pxg'),
  ];
  for (const p of searchPaths) {
    if (fs.existsSync(p)) {
      return res.sendFile(p);
    }
  }
  res.status(404).send('game.pxg not found');
});

// Serve the built frontend (dist/) so Electron can load via HTTP.
// This avoids Chromium's CORS restrictions on file:// and custom protocols.
const distDir = (() => {
  const serverDir = __dirname;
  // In production (extraResources): server at resources/api/, frontend at resources/app.asar.unpacked/dist/
  if (serverDir.includes('.asar') || serverDir.includes('resources')) {
    return path.join(serverDir, '..', 'app.asar.unpacked', 'dist');
  }
  // In development: server at project/api/, frontend at project/dist/
  return path.join(serverDir, '..', 'dist');
})();
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
}

// Serve compiled .gba files for download (decoupled from the compile connection)
app.use('/downloads', express.static(downloadDir));

// Clean up old download files every 5 minutes (keep files up to 30 minutes)
setInterval(() => {
  try {
    const files = fs.readdirSync(downloadDir);
    const now = Date.now();
    for (const file of files) {
      const filePath = path.join(downloadDir, file);
      const stat = fs.statSync(filePath);
      if (now - stat.mtimeMs > 30 * 60 * 1000) {
        fs.unlinkSync(filePath);
        console.log(`Cleaned up old download: ${file}`);
      }
    }
  } catch (err) {
    console.error('Download cleanup error:', err);
  }
}, 5 * 60 * 1000);

// SPA fallback: serve index.html for any unmatched GET route (client-side routing)
app.get('*', (req, res) => {
  res.sendFile(path.join(distDir, 'index.html'));
});

const serverPort = process.env.PORT || port;

app.listen(serverPort, () => {
  console.log(`PxGBA Compilation Server running at http://localhost:${serverPort}`);
  if (process.send) {
    process.send({ type: 'ready', port: serverPort });
  }
});