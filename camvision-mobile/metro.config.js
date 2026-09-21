/**
 * Chargé par Expo/Metro à CHAQUE démarrage (npm start, npx expo start, Cursor)
 * — force l'IP Wi‑Fi courante pour le QR / exp://
 */
const { getDefaultConfig } = require('expo/metro-config');
const { applyPackagerHostname, listIpv4, scoreCandidate } = require('./scripts/lan-ip');

const ip = applyPackagerHostname();
if (ip) {
  // eslint-disable-next-line no-console
  console.log(`[CAMVISION] Metro host forcé → ${ip}`);
  listIpv4()
    .sort((a, b) => scoreCandidate(b) - scoreCandidate(a))
    .slice(0, 4)
    // eslint-disable-next-line no-console
    .forEach((c) => console.log(`  · ${c.address}  ${c.name}`));
} else {
  // eslint-disable-next-line no-console
  console.warn('[CAMVISION] Aucune IPv4 LAN — Expo choisira seul.');
}

const config = getDefaultConfig(__dirname);

// Stabilise la résolution des packages ESM (@react-navigation) sous Windows/Metro
config.resolver.unstable_enablePackageExports = false;
config.resolver.sourceExts = [...new Set([...config.resolver.sourceExts, 'mjs', 'cjs'])];

module.exports = config;
