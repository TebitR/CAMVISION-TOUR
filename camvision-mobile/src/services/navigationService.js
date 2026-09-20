import axios from 'axios';
import { getMapboxToken } from '../config';

/**
 * Itinéraire piéton Mapbox Directions.
 * @returns {{ coordinates, distanceM, durationS, steps, raw } | null}
 */
export async function fetchMapboxRoute(userCoords, monumentCoords) {
  const token = getMapboxToken();
  if (!token || token.startsWith('votre_')) {
    throw new Error('MAPBOX_TOKEN_MISSING');
  }

  const from = `${userCoords.longitude},${userCoords.latitude}`;
  const to = `${monumentCoords.longitude},${monumentCoords.latitude}`;
  const url =
    `https://api.mapbox.com/directions/v5/mapbox/walking/${from};${to}` +
    `?geometries=geojson&steps=true&overview=full&language=fr&access_token=${token}`;

  const { data } = await axios.get(url, { timeout: 20000 });
  const route = data?.routes?.[0];
  if (!route?.geometry?.coordinates?.length) {
    throw new Error('MAPBOX_NO_ROUTE');
  }

  const coordinates = route.geometry.coordinates.map(([lng, lat]) => ({
    latitude: lat,
    longitude: lng,
  }));

  const steps = (route.legs?.[0]?.steps || []).map((s) => ({
    instruction: s.maneuver?.instruction || s.name || '',
    distance: s.distance || 0,
    duration: s.duration || 0,
    type: s.maneuver?.type,
    modifier: s.maneuver?.modifier,
  }));

  return {
    coordinates,
    distanceM: route.distance || 0,
    durationS: route.duration || 0,
    steps,
    raw: route,
  };
}

export function formatWalkDuration(seconds) {
  const s = Math.max(0, Math.round(seconds || 0));
  if (s < 60) return `${s} s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return `${h} h ${rm} min`;
}

/** Instruction courante selon la distance restante le long des steps. */
export function getNextInstruction(steps, remainingRouteM) {
  if (!steps?.length) return '';
  let traveledApprox = 0;
  const total = steps.reduce((a, s) => a + (s.distance || 0), 0);
  const done = Math.max(0, total - (remainingRouteM || total));

  for (const step of steps) {
    traveledApprox += step.distance || 0;
    if (traveledApprox >= done) {
      return step.instruction || '';
    }
  }
  return steps[steps.length - 1]?.instruction || '';
}
