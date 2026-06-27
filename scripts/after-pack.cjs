const path = require('path');
const fs = require('fs');

exports.default = async function (context) {
  const { appOutDir, packager, electronPlatformName } = context;
  const appName = packager.appInfo.productName;
  const resourcesPath = path.join(appOutDir, 'resources');

  const apiDest = path.join(resourcesPath, 'api');
  const nodeModulesSrc = path.join(__dirname, '..', 'api', 'node_modules');
  const nodeModulesDest = path.join(apiDest, 'node_modules');

  if (!fs.existsSync(nodeModulesSrc)) {
    console.error('ERROR: api/node_modules not found.');
    console.error('Run: cd api && npm install');
    throw new Error('Missing api/node_modules - run `npm install` in the api/ directory first.');
  }

  if (!fs.existsSync(nodeModulesDest)) {
    console.log('Copying api/node_modules to packaged app...');
    fs.cpSync(nodeModulesSrc, nodeModulesDest, { recursive: true });
    console.log('node_modules copied.');
  }

  const buildToolsDest = path.join(apiDest, 'buildTools');
  let devkitArmDir = '';
  if (electronPlatformName === 'win32') {
    devkitArmDir = path.join(buildToolsDest, 'windows', 'devkitpro', 'devkitARM');
  } else if (electronPlatformName === 'linux') {
    devkitArmDir = path.join(buildToolsDest, 'linux', 'devkitpro', 'devkitARM');
  } else if (electronPlatformName === 'darwin') {
    devkitArmDir = path.join(buildToolsDest, 'mac', 'devkitpro', 'devkitARM');
  }

  if (devkitArmDir && fs.existsSync(devkitArmDir)) {
    const totalSize = getDirSize(devkitArmDir);
    console.log(`devkitARM (${electronPlatformName}) size: ${(totalSize / 1024 / 1024).toFixed(1)} MB`);
  } else {
    if (electronPlatformName === 'linux') {
      console.log('devkitARM not bundled (system devkitARM will be used on Linux).');
    } else {
      console.log(`Warning: devkitARM not bundled for ${electronPlatformName}. Set DEVKITARM env var on the user machine or bundle devkitARM.`);
    }
  }
};

function getDirSize(dirPath) {
  let size = 0;
  try {
    const items = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const item of items) {
      const fullPath = path.join(dirPath, item.name);
      if (item.isDirectory()) {
        size += getDirSize(fullPath);
      } else if (item.isFile()) {
        size += fs.statSync(fullPath).size;
      }
    }
  } catch (e) {}
  return size;
}
