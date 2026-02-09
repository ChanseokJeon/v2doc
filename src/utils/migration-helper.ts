/* eslint-disable no-console */
import * as fs from 'fs';
import * as path from 'path';

/**
 * Check for legacy yt2pdf directories and prompt user to migrate to v2doc
 */
export function checkLegacyPaths(): boolean {
  const home = process.env.HOME || process.env.USERPROFILE;
  if (!home) return false;

  const oldCache = path.join(home, '.cache', 'yt2pdf');
  const oldConfig = path.join(home, '.config', 'yt2pdf');

  const cacheExists = fs.existsSync(oldCache);
  const configExists = fs.existsSync(oldConfig);

  if (cacheExists || configExists) {
    console.log('\n⚠️  Legacy yt2pdf directories detected! Please migrate to v2doc.\n');
    console.log('To migrate your data, run these commands:\n');

    if (cacheExists) {
      console.log('  mv ~/.cache/yt2pdf ~/.cache/v2doc');
    }
    if (configExists) {
      console.log('  mv ~/.config/yt2pdf ~/.config/v2doc');
    }

    console.log('\nThis preserves your cached data and configuration.\n');
    return true;
  }

  return false;
}
