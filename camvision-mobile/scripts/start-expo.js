/**
 * Démarre Expo en forçant l'IP LAN + mode --lan.
 * Usage : npm start   |   npm run start:clear
 */
const { spawn } = require('child_process');
const { applyPackagerHostname, listIpv4, scoreCandidate, pickLanIp } = require('./lan-ip');

const ip = applyPackagerHostname(pickLanIp());
if (ip) {
  console.log(`\n[CAMVISION] Hôte Expo / Metro → ${ip}`);
  console.log('[CAMVISION] Interfaces :');
  listIpv4()
    .sort((a, b) => scoreCandidate(b) - scoreCandidate(a))
    .slice(0, 5)
    .forEach((c) => console.log(`  ${c.address}  (${c.name})`));
  console.log('');
} else {
  console.warn('[CAMVISION] Aucune IPv4 LAN trouvée — Expo choisira seul.');
}

const extraArgs = process.argv.slice(2);
const hasHostFlag = extraArgs.some(
  (a) => a === '--lan' || a === '--tunnel' || a === '--localhost' || a.startsWith('--host')
);
const args = ['expo', 'start', ...(hasHostFlag ? [] : ['--lan']), ...extraArgs];

const child = spawn('npx', args, {
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    REACT_NATIVE_PACKAGER_HOSTNAME: ip || process.env.REACT_NATIVE_PACKAGER_HOSTNAME || '',
  },
});

child.on('exit', (code) => process.exit(code ?? 0));
