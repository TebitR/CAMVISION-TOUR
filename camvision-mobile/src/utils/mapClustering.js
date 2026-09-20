/**
 * Clustering léger des marqueurs (équivalent clusterRadius Mapbox) pour react-native-maps.
 * Au-delà d'un certain dézoom, regroupe les points proches en clusters numérotés.
 */

function cellKey(lat, lng, cellSize) {
  return `${Math.floor(lat / cellSize)}:${Math.floor(lng / cellSize)}`;
}

/**
 * @param {Array} monuments
 * @param {{ latitudeDelta?: number }} region
 * @param {{ clusterDelta?: number, cellSize?: number }} options
 * @returns {Array<{ type: 'cluster'|'point', id: string, coordinate: {latitude,longitude}, count?: number, monuments?: Array, monument?: object }>}
 */
export function buildMapMarkers(monuments, region, options = {}) {
  const list = Array.isArray(monuments) ? monuments : [];
  const latitudeDelta = region?.latitudeDelta ?? 0.08;
  const clusterDelta = options.clusterDelta ?? 0.045;

  if (list.length === 0) return [];

  // Zoom proche → marqueurs individuels
  if (latitudeDelta < clusterDelta) {
    return list.map((m) => ({
      type: 'point',
      id: `p-${m.id}`,
      coordinate: { latitude: m.latitude, longitude: m.longitude },
      monument: m,
    }));
  }

  // Grille proportionnelle au niveau de zoom
  const cellSize = options.cellSize ?? Math.max(latitudeDelta / 8, 0.008);
  const buckets = new Map();

  list.forEach((m) => {
    const key = cellKey(m.latitude, m.longitude, cellSize);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(m);
  });

  const markers = [];
  buckets.forEach((group, key) => {
    if (group.length === 1) {
      const m = group[0];
      markers.push({
        type: 'point',
        id: `p-${m.id}`,
        coordinate: { latitude: m.latitude, longitude: m.longitude },
        monument: m,
      });
      return;
    }

    const lat = group.reduce((s, m) => s + m.latitude, 0) / group.length;
    const lng = group.reduce((s, m) => s + m.longitude, 0) / group.length;
    markers.push({
      type: 'cluster',
      id: `c-${key}`,
      coordinate: { latitude: lat, longitude: lng },
      count: group.length,
      monuments: group,
    });
  });

  return markers;
}
