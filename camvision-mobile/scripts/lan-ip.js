/**
 * Détecte l'IPv4 LAN active (Wi‑Fi prioritaire) pour Expo / Metro.
 * Pénalise fortement le partage iPhone / USB (souvent 172.20.10.x).
 */
const os = require('os');

function listIpv4() {
  const out = [];
  const ifaces = os.networkInterfaces();
  for (const [name, addrs] of Object.entries(ifaces || {})) {
    for (const a of addrs || []) {
      const family = a.family === 'IPv4' || a.family === 4;
      if (!family || a.internal) continue;
      out.push({ name, address: a.address });
    }
  }
  return out;
}

function scoreCandidate({ name, address }) {
  let score = 0;
  const n = String(name).toLowerCase();

  if (/wi-?fi|wlan|wireless/.test(n)) score += 60;
  if (/ethernet|eth/.test(n) && !/virtual|vethernet|hyper-v|docker|wsl|vmware|virtualbox/.test(n)) {
    score += 25;
  }
  if (/virtual|vethernet|hyper-v|docker|wsl|vpn|bluetooth|vmware|virtualbox|loopback/.test(n)) {
    score -= 50;
  }

  // Réseaux domestiques / box
  if (address.startsWith('192.168.')) score += 40;
  else if (address.startsWith('10.')) score += 20;
  // 172.16–31 = privé RFC1918, mais 172.20.10.x = très souvent hotspot iPhone
  else if (/^172\.20\./.test(address)) score -= 80;
  else if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(address)) score -= 10;

  return score;
}

function pickLanIp() {
  const list = listIpv4();
  if (list.length === 0) return null;
  list.sort((a, b) => scoreCandidate(b) - scoreCandidate(a));
  return list[0].address;
}

/** Applique l'IP au process Expo / Metro (à appeler au démarrage). */
function applyPackagerHostname(ip = pickLanIp()) {
  if (!ip) return null;
  process.env.REACT_NATIVE_PACKAGER_HOSTNAME = ip;
  return ip;
}

module.exports = { pickLanIp, listIpv4, scoreCandidate, applyPackagerHostname };

if (require.main === module) {
  const ip = pickLanIp();
  console.log(ip || '');
  if (ip) {
    console.error('[lan-ip] interfaces:');
    listIpv4()
      .sort((a, b) => scoreCandidate(b) - scoreCandidate(a))
      .forEach((c) => console.error(`  ${scoreCandidate(c)}\t${c.address}\t${c.name}`));
  }
}
