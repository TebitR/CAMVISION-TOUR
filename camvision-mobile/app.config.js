import path from 'path';
import { existsSync, readFileSync } from 'fs';

function readEnvKey(filePath, key) {
  if (!existsSync(filePath)) return '';
  try {
    const text = readFileSync(filePath, 'utf8');
    const re = new RegExp(`^\\s*${key}\\s*=\\s*(.+)\\s*$`, 'm');
    const m = text.match(re);
    if (!m) return '';
    return m[1].trim().replace(/^['"]|['"]$/g, '');
  } catch {
    return '';
  }
}

const token =
  process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ||
  process.env.MAPBOX_ACCESS_TOKEN ||
  readEnvKey(path.resolve(__dirname, '.env'), 'EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN') ||
  readEnvKey(path.resolve(__dirname, '.env'), 'MAPBOX_ACCESS_TOKEN') ||
  readEnvKey(path.resolve(__dirname, '..', '.env'), 'MAPBOX_ACCESS_TOKEN') ||
  '';

export default ({ config }) => ({
  ...config,
  plugins: [...(config.plugins || []), 'expo-notifications'],
  extra: {
    ...(config.extra || {}),
    mapboxAccessToken: token,
  },
});
