// Read the local version from package.json or any other place where you store it.
import { version } from '../../package.json';
import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';


const VERSION_URL = import.meta.env.DEV
  ? '/pxgba-proxy/version.txt'
  : 'https://pxgba.liftedpixel.ca/version.txt';

export async function checkForUpdates(onStatus) {
  try {
    onStatus?.('checking');
    const response = await fetch(VERSION_URL);
    if (!response.ok) throw new Error('Could not fetch version file');

    const remoteVersion = await response.text();

    if (remoteVersion !== version) {
      onStatus?.('downloading');
      await downloadAndApplyUpdate();
      onStatus?.('ready');
    } else {
      onStatus?.('up-to-date');
    }
  } catch (error) {
    onStatus?.('error', error.message);
  }
}

export async function downloadAndApplyUpdate() {
  try {
    const DOWNLOAD_URL = import.meta.env.DEV
      ? `/lp-proxy?proxy-oga?url=${encodeURIComponent('/latest.zip')}`
      : `https://lpbackend.liftedpixel.ca?proxy-oga?url=${encodeURIComponent('https://pxgba.liftedpixel.ca/latest.zip')}`;
    const response = await fetch(DOWNLOAD_URL);
    if (!response.ok) throw new Error('Could not download update');
    
    // Get the content of the response
    const zipBuffer = Buffer.from(await response.arrayBuffer());

    // Load zip with JSZip
    const zip = await JSZip.loadAsync(zipBuffer);

    // Set the destination directory where files will be extracted
    const tempDir = process.env.TEMP || '/tmp';
    const extractPath = `${tempDir}/app-update`;

    // Create the extraction directory if it doesn't exist
    if (!fs.existsSync(extractPath)) {
      fs.mkdirSync(extractPath, { recursive: true });
    }

    // Extract all files to the destination directory
    await Promise.all(
      Object.keys(zip.files).map(async (filename) => {
        const file = zip.files[filename];
        const filePath = `${extractPath}/${filename}`;
        if (file.dir) {
          fs.mkdirSync(filePath, { recursive: true });
        } else {
          const data = await file.async('nodebuffer');
          fs.mkdirSync(path.dirname(filePath), { recursive: true });
          fs.writeFileSync(filePath, data);
        }
      })
    );

    console.log('Files extracted successfully.');

    // Copy files from extraction path to your app's root directory
    const appRootDir = process.cwd();
    fs.readdirSync(extractPath).forEach(file => {
      const filePathSource = `${extractPath}/${file}`;
      const filePathDest = `${appRootDir}/${file}`;

      // Check if it's a directory or file and copy accordingly
      if (fs.statSync(filePathSource).isDirectory()) {
        fs.renameSync(filePathSource, filePathDest);
      } else {
        fs.copyFileSync(filePathSource, filePathDest);
      }
    });

    console.log('Files overwritten in your application directory.');

    await new Promise(resolve => setTimeout(resolve, 5000)); // Add a slight delay before restarting to ensure everything's written

    // Prompt the user for restart or continue
    return {
      content: 'Update applied. Restarting app...',
      status: 'in_progress'
    };
  } catch (error) {
    console.error('Error applying update:', error);
    throw new Error('Failed to apply update');
  }
}