/** Filtres puces carte → catégories TouristObject (valeurs libres côté API). */

export const MAP_CATEGORY_FILTERS = [
  {
    id: 'all',
    labelKey: 'map.filterAll',
    icon: 'apps-outline',
    match: null,
  },
  {
    id: 'histoire',
    labelKey: 'map.filterHistory',
    icon: 'business-outline',
    match: ['monument', 'histoire', 'history', 'patrimoine'],
  },
  {
    id: 'nature',
    labelKey: 'map.filterNature',
    icon: 'leaf-outline',
    match: ['nature', 'parc', 'park', 'jardin', 'garden', 'outdoor'],
  },
  {
    id: 'culture',
    labelKey: 'map.filterCulture',
    icon: 'color-palette-outline',
    match: ['masque', 'sculpture', 'culture', 'art', 'artifact', 'musee', 'musée', 'museum'],
  },
];

export function filterMonumentsByCategory(monuments, filterId) {
  const list = Array.isArray(monuments) ? monuments : [];
  const filter = MAP_CATEGORY_FILTERS.find((f) => f.id === filterId);
  if (!filter || !filter.match) return list;

  const keys = filter.match.map((k) => k.toLowerCase());
  return list.filter((m) => {
    const cat = String(m.category || '').toLowerCase();
    return keys.some((k) => cat.includes(k));
  });
}

/** Estimation marche ~5 km/h → minutes. */
export function estimateWalkMinutes(distanceM) {
  if (distanceM == null || Number.isNaN(distanceM)) return null;
  return Math.max(1, Math.round(Number(distanceM) / 83));
}
