const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const rootDir = path.join(__dirname, '..');
const apiDir = path.join(rootDir, 'api');
const buildToolsDir = path.join(apiDir, 'buildTools');

// Ensure API dependencies (like adm-zip) are installed
console.log('[setup] Ensuring backend dependencies are installed...');
try {
  execSync('npm install', { cwd: apiDir, stdio: 'inherit' });
} catch (err) {
  console.error('[setup] Failed to install backend dependencies:', err.message);
}

const AdmZip = require(path.join(apiDir, 'node_modules', 'adm-zip'));

const winBinDir = path.join(buildToolsDir, 'windows', 'bin');
const winPythonDir = path.join(buildToolsDir, 'windows', 'python');
const linuxBinDir = path.join(buildToolsDir, 'linux', 'bin');
const linuxPythonDir = path.join(buildToolsDir, 'linux'); // Tarball will create 'python' folder inside it

// Create target directories
[winBinDir, winPythonDir, linuxBinDir, linuxPythonDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Resources config
const tools = [
  {
    name: 'Windows Make (xPack)',
    url: 'https://github.com/xpack-dev-tools/windows-build-tools-xpack/releases/download/v4.4.1-1/xpack-windows-build-tools-4.4.1-1-win32-x64.zip',
    type: 'zip',
    dest: path.join(buildToolsDir, 'windows', 'make.zip'),
    extract: (filePath) => {
      console.log(`[setup] Extracting Windows Make to ${winBinDir}...`);
      const zip = new AdmZip(filePath);
      const tempExtract = path.join(buildToolsDir, 'windows', 'make-temp');
      zip.extractAllTo(tempExtract, true);
      // Copy files from extracted bin/ to windows/bin/
      const binSrc = path.join(tempExtract, 'xpack-windows-build-tools-4.4.1-1', 'bin');
      if (fs.existsSync(binSrc)) {
        const files = fs.readdirSync(binSrc);
        files.forEach(file => {
          fs.copyFileSync(path.join(binSrc, file), path.join(winBinDir, file));
        });
      }
      // Cleanup temp
      fs.rmSync(tempExtract, { recursive: true, force: true });
    }
  },
  {
    name: 'Windows BusyBox (sh.exe)',
    url: 'https://frippery.org/files/busybox/busybox64.exe',
    type: 'binary',
    dest: path.join(winBinDir, 'sh.exe'),
    extract: () => {
      console.log('[setup] Windows BusyBox saved successfully.');
    }
  },
  {
    name: 'Windows Python',
    url: 'https://www.python.org/ftp/python/3.10.11/python-3.10.11-embed-amd64.zip',
    type: 'zip',
    dest: path.join(buildToolsDir, 'windows', 'python.zip'),
    extract: (filePath) => {
      console.log(`[setup] Extracting Windows Python to ${winPythonDir}...`);
      const zip = new AdmZip(filePath);
      zip.extractAllTo(winPythonDir, true);
      // Disable isolated path mode by renaming .pth file so Python resolves paths normally (including script directory)
      const pthFile = path.join(winPythonDir, 'python310._pth');
      if (fs.existsSync(pthFile)) {
        fs.renameSync(pthFile, path.join(winPythonDir, 'python310._pth.bak'));
        console.log('[setup] Disabled isolated path mode in Windows Python.');
      }
    }
  },
  {
    name: 'Linux Make (Static)',
    url: 'https://github.com/ryanwoodsmall/static-binaries/raw/master/x86_64/make',
    type: 'binary',
    dest: path.join(linuxBinDir, 'make'),
    extract: (filePath) => {
      if (process.platform !== 'win32') {
        fs.chmodSync(filePath, '755');
      }
      console.log('[setup] Linux Make saved successfully.');
    }
  },
  {
    name: 'Linux Python (Standalone)',
    url: 'https://github.com/indygreg/python-build-standalone/releases/download/20230507/cpython-3.10.11%2B20230507-x86_64-unknown-linux-gnu-install_only.tar.gz',
    type: 'tar.gz',
    dest: path.join(buildToolsDir, 'linux', 'python.tar.gz'),
    extract: (filePath) => {
      console.log(`[setup] Extracting Linux Python to ${linuxPythonDir}...`);
      try {
        execSync(`tar -xf "${filePath}" -C "${linuxPythonDir}"`);
        if (process.platform !== 'win32') {
          // Set execute permission on python binaries
          const pyBinDir = path.join(linuxPythonDir, 'python', 'bin');
          if (fs.existsSync(pyBinDir)) {
            const files = fs.readdirSync(pyBinDir);
            files.forEach(file => {
              const fullPath = path.join(pyBinDir, file);
              fs.chmodSync(fullPath, '755');
            });
          }
        }
      } catch (err) {
        console.error('[setup] Failed to extract Linux Python:', err.message);
      }
    }
  }
];

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        downloadFile(response.headers.location, destPath).then(resolve).catch(reject);
        return;
      }
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP Status ${response.statusCode}`));
        return;
      }
      const file = fs.createWriteStream(destPath);
      response.pipe(file);
      file.on('finish', () => {
        file.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }).on('error', (err) => {
      fs.unlink(destPath, () => {});
      reject(err);
    });
  });
}

async function run() {
  console.log('[setup] Starting download of portable build tools...');
  for (const tool of tools) {
    console.log(`[setup] Downloading ${tool.name}...`);
    try {
      await downloadFile(tool.url, tool.dest);
      console.log(`[setup] Downloaded ${tool.name}.`);
      tool.extract(tool.dest);
      if (tool.type !== 'binary' && fs.existsSync(tool.dest)) {
        fs.unlinkSync(tool.dest);
      }
    } catch (err) {
      console.error(`[setup] Error processing ${tool.name}:`, err.message);
    }
  }
  
  // Create true.bat to prevent Windows GNU Make shell bypass issues
  const trueBatPath = path.join(winBinDir, 'true.bat');
  try {
    fs.writeFileSync(trueBatPath, '@exit /b 0\n');
    console.log('[setup] Created true.bat utility successfully.');
  } catch (err) {
    console.error('[setup] Failed to create true.bat utility:', err.message);
  }

  console.log('[setup] Build tools setup completed successfully.');
}

run();
