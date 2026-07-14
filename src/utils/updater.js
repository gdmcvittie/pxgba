export async function checkForUpdates(onStatus) {
  if (!window.electronAPI?.checkVersion) {
    onStatus?.('error', 'Updates not available');
    return;
  }

  try {
    onStatus?.('checking');
    const versionResult = await window.electronAPI.checkVersion();

    if (versionResult.status === 'up-to-date') {
      onStatus?.('up-to-date');
      return;
    }

    if (versionResult.status === 'error') {
      onStatus?.('error', versionResult.message);
      return;
    }

    onStatus?.('downloading');
    const updateResult = await window.electronAPI.applyUpdate();

    if (updateResult.status === 'updated') {
      onStatus?.('ready', updateResult.changelog);
    } else {
      onStatus?.('error', updateResult.message);
    }
  } catch (error) {
    onStatus?.('error', error.message);
  }
}