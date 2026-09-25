import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  Image,
  Modal,
  Pressable,
  TextInput,
  Keyboard,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { useTheme } from '../theme/ThemeContext';
import { resolveAppLanguage } from '../i18n';
import { getApiUrl } from '../config';
import { monumentImageSource } from '../utils/imageUtils';
import {
  MAP_CATEGORY_FILTERS,
  filterMonumentsByCategory,
} from '../utils/mapCategories';
import { buildMapMarkers } from '../utils/mapClustering';
import MapMonumentSheet from '../components/MapMonumentSheet';
import UserHeadingMarker from '../components/UserHeadingMarker';
import ItineraryModal from '../components/ItineraryModal';
import {
  getCurrentPosition,
  getFreshPosition,
  watchPosition,
  watchHeading,
  formatDistance,
  openNativeDirections,
  GEOFENCE_RADIUS_M,
  haversineMeters,
} from '../services/locationService';
import {
  fetchMapboxRoute,
  fetchMapboxWalkingMulti,
  formatWalkDuration,
  getNextInstruction,
} from '../services/navigationService';
import { notifyMonumentNearby } from '../services/notificationService';
import { loadNearbyCache, saveNearbyCache } from '../services/nearbyCache';

const FALLBACK_REGION = {
  latitude: 3.848,
  longitude: 11.5021,
  latitudeDelta: 0.35,
  longitudeDelta: 0.35,
};

/**
 * Modes de vision (équivalents Mapbox StyleURL via react-native-maps / Expo Go).
 * Street → standard · SatelliteStreet → hybrid · Dark/Light → UI · Outdoors → terrain
 */
const MAP_VISION_MODES = [
  {
    id: 'street',
    labelKey: 'map.styleStreet',
    icon: 'map-outline',
    mapType: 'standard',
    uiStyle: 'light',
  },
  {
    id: 'satellite',
    labelKey: 'map.styleSatellite',
    icon: 'earth-outline',
    mapType: 'hybrid',
    uiStyle: 'light',
  },
  {
    id: 'dark',
    labelKey: 'map.styleDark',
    icon: 'moon-outline',
    mapType: 'standard',
    uiStyle: 'dark',
  },
  {
    id: 'light',
    labelKey: 'map.styleLight',
    icon: 'sunny-outline',
    mapType: Platform.OS === 'ios' ? 'mutedStandard' : 'standard',
    uiStyle: 'light',
  },
  {
    id: 'outdoors',
    labelKey: 'map.styleOutdoors',
    icon: 'trail-sign-outline',
    mapType: Platform.OS === 'android' ? 'terrain' : 'standard',
    uiStyle: 'light',
  },
];

export default function MapScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const navigation = useNavigation();
  const lang = resolveAppLanguage(i18n.language);

  const mapRef = useRef(null);
  const searchInputRef = useRef(null);
  const watchRef = useRef(null);
  const headingWatchRef = useRef(null);
  const alertedRef = useRef(new Set());
  const didCenterRef = useRef(false);
  const navigatingRef = useRef(false);
  const isFollowingUserRef = useRef(true);
  const searchCenterRef = useRef(null);
  const cachedMonumentsRef = useRef([]);
  const langBootRef = useRef(true);

  const dismissKeyboard = useCallback(() => {
    Keyboard.dismiss();
    searchInputRef.current?.blur();
  }, []);

  const [loading, setLoading] = useState(false);
  const [refreshingGps, setRefreshingGps] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [userCoords, setUserCoords] = useState(null);
  const [userHeading, setUserHeading] = useState(0);
  const [monuments, setMonuments] = useState([]);
  const [selected, setSelected] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [mapRegion, setMapRegion] = useState(FALLBACK_REGION);
  const [showSearchArea, setShowSearchArea] = useState(false);
  const [areaLoading, setAreaLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [usingCache, setUsingCache] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [highlightedIds, setHighlightedIds] = useState(null); // Set|null — null = pas de filtre sémantique
  const [tourModalOpen, setTourModalOpen] = useState(false);
  const [tourLoading, setTourLoading] = useState(false);
  const [aiTour, setAiTour] = useState(null); // { waypoints, routeCoords, meta }
  const [autoStartAudio, setAutoStartAudio] = useState(false);

  const [navigating, setNavigating] = useState(false);
  const [navTarget, setNavTarget] = useState(null);
  const [routeCoords, setRouteCoords] = useState([]);
  const [routeMeta, setRouteMeta] = useState(null); // { distanceM, durationS, steps }
  const [navLoading, setNavLoading] = useState(false);
  /** true = caméra suit le GPS ; false = exploration libre (zoom / pan) */
  const [isFollowingUser, setIsFollowingUser] = useState(true);
  const [mapStyleId, setMapStyleId] = useState('street');
  const [styleMenuOpen, setStyleMenuOpen] = useState(false);

  navigatingRef.current = navigating;
  isFollowingUserRef.current = isFollowingUser;

  const activeMapStyle =
    MAP_VISION_MODES.find((m) => m.id === mapStyleId) || MAP_VISION_MODES[0];
  const routeStrokeColor =
    mapStyleId === 'satellite' || mapStyleId === 'dark' ? '#38BDF8' : '#0284C7';
  const routeStrokeWidth = mapStyleId === 'satellite' ? 6 : 5;

  const filteredMonuments = useMemo(() => {
    let list = filterMonumentsByCategory(monuments, categoryFilter);
    if (highlightedIds) {
      list = list.filter((m) => highlightedIds.has(m.id));
    }
    return list;
  }, [monuments, categoryFilter, highlightedIds]);

  const mapMarkers = useMemo(
    () => buildMapMarkers(filteredMonuments, mapRegion),
    [filteredMonuments, mapRegion]
  );

  const fetchNearby = useCallback(
    async (lat, lng, { fromAreaSearch = false, silent = false } = {}) => {
      if (fromAreaSearch) setAreaLoading(true);
      else if (!silent) setLoading(true);
      try {
        const { data } = await axios.get(`${getApiUrl()}/api/monuments/nearby`, {
          params: { lat, lng, radius: 500, lang, limit: 30, light: true },
          timeout: 12000,
        });
        const next = data.monuments || [];
        cachedMonumentsRef.current = next;
        setMonuments(next);
        setErrorMsg(null);
        setIsOnline(true);
        setUsingCache(false);
        searchCenterRef.current = { latitude: lat, longitude: lng };
        setShowSearchArea(false);
        saveNearbyCache(next, lat, lng, lang);
      } catch (e) {
        console.warn('nearby monuments:', e?.message || e);
        setIsOnline(false);
        if (cachedMonumentsRef.current.length > 0) {
          setMonuments(cachedMonumentsRef.current);
          setUsingCache(true);
          setErrorMsg(null);
        } else {
          setErrorMsg(t('map.errorLoad'));
        }
      } finally {
        if (fromAreaSearch) setAreaLoading(false);
        else if (!silent) setLoading(false);
      }
    },
    [lang, t]
  );

  const onLocation = useCallback(
    async (coords, { silent = false } = {}) => {
      setUserCoords(coords);
      await fetchNearby(coords.latitude, coords.longitude, { silent });
    },
    [fetchNearby]
  );

  useEffect(() => {
    if (!isFocused) return undefined;
    let cancelled = false;

    (async () => {
      // 1) Cache local immédiat (pas d'écran vide)
      const cached = await loadNearbyCache(lang);
      if (cancelled) return;
      if (cached?.monuments?.length) {
        cachedMonumentsRef.current = cached.monuments;
        setMonuments(cached.monuments);
        setUsingCache(!cached.fresh);
        if (cached.lat != null && cached.lng != null) {
          searchCenterRef.current = { latitude: cached.lat, longitude: cached.lng };
          setUserCoords((prev) => prev || { latitude: cached.lat, longitude: cached.lng });
        }
      } else {
        // Cache absent ou autre langue → éviter titres obsolètes (ex. zh après switch de)
        cachedMonumentsRef.current = [];
        setMonuments([]);
        setUsingCache(false);
        setSelected(null);
      }

      // 2) Position rapide : lastKnown → sinon Yaoundé, fetch réseau tout de suite
      setRefreshingGps(true);
      const quick =
        (await getCurrentPosition({ preferLastKnown: true })) || {
          latitude: FALLBACK_REGION.latitude,
          longitude: FALLBACK_REGION.longitude,
          fromCache: true,
        };
      if (cancelled) return;

      if (quick.latitude === FALLBACK_REGION.latitude && !cached) {
        setPermissionDenied(true);
      } else {
        setPermissionDenied(false);
      }

      const needNetwork =
        !cached?.fresh ||
        !cached?.monuments?.length ||
        cached?.lang !== lang ||
        (cached.lat != null &&
          haversineMeters(cached.lat, cached.lng, quick.latitude, quick.longitude) > 800);

      setUserCoords(quick);
      if (needNetwork) {
        await fetchNearby(quick.latitude, quick.longitude, {
          silent: !!cached?.monuments?.length,
        });
      } else {
        setLoading(false);
      }
      if (cancelled) return;
      setRefreshingGps(false);

      // 3) Affinage GPS Balanced en arrière-plan (sans bloquer l'UI)
      getFreshPosition().then(async (fresh) => {
        if (cancelled || !fresh) return;
        setUserCoords(fresh);
        const moved =
          haversineMeters(quick.latitude, quick.longitude, fresh.latitude, fresh.longitude) > 120;
        if (moved || needNetwork) {
          await fetchNearby(fresh.latitude, fresh.longitude, { silent: true });
        }
      });

      watchRef.current = await watchPosition(async (next) => {
        if (cancelled) return;
        setUserCoords(next);
        if (typeof next.heading === 'number' && next.heading >= 0) {
          setUserHeading(next.heading);
        }
        setMonuments((prev) =>
          [...prev]
            .map((m) => {
              const km =
                haversineMeters(next.latitude, next.longitude, m.latitude, m.longitude) / 1000;
              return {
                ...m,
                distance_km: Math.round(km * 1000) / 1000,
                distance_m: Math.round(km * 1000),
              };
            })
            .sort((a, b) => a.distance_km - b.distance_km)
        );

        if (
          navigatingRef.current &&
          isFollowingUserRef.current &&
          mapRef.current
        ) {
          const heading = next.heading;
          mapRef.current.animateCamera(
            {
              center: { latitude: next.latitude, longitude: next.longitude },
              pitch: 45,
              heading:
                typeof heading === 'number' && !Number.isNaN(heading) && heading >= 0
                  ? heading
                  : 0,
            },
            { duration: 600 }
          );
        }
      });

      headingWatchRef.current = await watchHeading((h) => {
        if (!cancelled) setUserHeading(h);
      });
    })();

    return () => {
      cancelled = true;
      if (watchRef.current) {
        watchRef.current.remove();
        watchRef.current = null;
      }
      if (headingWatchRef.current) {
        headingWatchRef.current.remove();
        headingWatchRef.current = null;
      }
    };
  }, [isFocused, fetchNearby, lang]);

  // Recharger les métadonnées localisées dès qu'on change de langue
  useEffect(() => {
    if (langBootRef.current) {
      langBootRef.current = false;
      return;
    }
    if (!isFocused) return;
    const center =
      userCoords ||
      searchCenterRef.current ||
      (mapRegion
        ? { latitude: mapRegion.latitude, longitude: mapRegion.longitude }
        : null);
    if (!center) return;
    setSelected(null);
    setHighlightedIds(null);
    cachedMonumentsRef.current = [];
    setMonuments([]);
    fetchNearby(center.latitude, center.longitude, { silent: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- volontairement déclenché par lang seulement
  }, [lang]);

  useEffect(() => {
    if (!userCoords || !mapRef.current || didCenterRef.current) return;
    didCenterRef.current = true;
    mapRef.current.animateToRegion(
      {
        latitude: userCoords.latitude,
        longitude: userCoords.longitude,
        latitudeDelta: 0.08,
        longitudeDelta: 0.08,
      },
      450
    );
  }, [userCoords]);

  // Geofence → notification + écoute audio sur place (Scan optionnel)
  useEffect(() => {
    if (!userCoords || monuments.length === 0) return;

    monuments.forEach((m) => {
      const meters =
        m.distance_m ??
        haversineMeters(userCoords.latitude, userCoords.longitude, m.latitude, m.longitude);
      if (meters <= GEOFENCE_RADIUS_M && !alertedRef.current.has(m.id)) {
        alertedRef.current.add(m.id);
        notifyMonumentNearby(m).catch(() => {});
        Alert.alert(
          t('map.geofenceTitle'),
          t('map.geofenceMsg', { name: m.title, distance: formatDistance(meters / 1000) }),
          [
            { text: t('map.dismiss'), style: 'cancel' },
            {
              text: t('map.listenGuide'),
              onPress: () => {
                setSelected(m);
                setAutoStartAudio(true);
              },
            },
            {
              text: t('map.goScan'),
              onPress: () => navigation.navigate('Scan'),
            },
          ]
        );
      }
    });
  }, [userCoords, monuments, t, navigation]);

  const stopNavigation = () => {
    dismissKeyboard();
    setNavigating(false);
    setNavTarget(null);
    setRouteCoords([]);
    setRouteMeta(null);
    setIsFollowingUser(false);
  };

  const pauseFollowForExploration = () => {
    if (isFollowingUserRef.current) {
      setIsFollowingUser(false);
    }
  };

  const recenterOnUser = () => {
    dismissKeyboard();
    if (!userCoords || !mapRef.current) return;
    setIsFollowingUser(true);
    if (navigating) {
      mapRef.current.animateCamera(
        {
          center: {
            latitude: userCoords.latitude,
            longitude: userCoords.longitude,
          },
          pitch: 45,
          zoom: 16,
          heading: 0,
        },
        { duration: 1000 }
      );
    } else {
      mapRef.current.animateCamera(
        {
          center: {
            latitude: userCoords.latitude,
            longitude: userCoords.longitude,
          },
          zoom: 16,
          pitch: 0,
          heading: 0,
        },
        { duration: 1000 }
      );
    }
  };

  const startInAppNavigation = async (monument) => {
    if (!userCoords) {
      Alert.alert(t('map.errorLoad'), t('map.needGps'));
      return;
    }
    setNavLoading(true);
    try {
      const route = await fetchMapboxRoute(userCoords, {
        latitude: monument.latitude,
        longitude: monument.longitude,
      });
      setRouteCoords(route.coordinates);
      setRouteMeta({
        distanceM: route.distanceM,
        durationS: route.durationS,
        steps: route.steps,
      });
      setNavTarget(monument);
      setNavigating(true);
      setIsFollowingUser(true);
      setSelected(null);

      mapRef.current?.animateCamera(
        {
          center: {
            latitude: userCoords.latitude,
            longitude: userCoords.longitude,
          },
          pitch: 45,
          zoom: 16,
          heading: 0,
        },
        { duration: 1000 }
      );
    } catch (e) {
      console.warn('Mapbox route:', e?.message || e);
      Alert.alert(t('map.routeErrorTitle'), t('map.routeErrorMsg'), [
        { text: t('map.dismiss'), style: 'cancel' },
        {
          text: t('map.openExternal'),
          onPress: () =>
            openNativeDirections(monument.latitude, monument.longitude, monument.title),
        },
      ]);
    } finally {
      setNavLoading(false);
    }
  };

  const remainingM = (() => {
    if (!navigating || !userCoords || !navTarget) return routeMeta?.distanceM || 0;
    return haversineMeters(
      userCoords.latitude,
      userCoords.longitude,
      navTarget.latitude,
      navTarget.longitude
    );
  })();

  const nextInstruction =
    navigating && routeMeta
      ? getNextInstruction(routeMeta.steps, remainingM)
      : '';

  const clearSemanticSearch = () => {
    dismissKeyboard();
    setSearchQuery('');
    setHighlightedIds(null);
  };

  const runSemanticSearch = async () => {
    dismissKeyboard();
    const q = searchQuery.trim();
    if (q.length < 2) return;
    setSearchLoading(true);
    pauseFollowForExploration();
    try {
      const { data } = await axios.post(
        `${getApiUrl()}/api/v1/search/semantic`,
        {
          query: q,
          user_lat: userCoords?.latitude,
          user_lng: userCoords?.longitude,
          limit: 10,
          lang,
        },
        { timeout: 45000 }
      );
      const hits = data.monuments || [];
      if (hits.length === 0) {
        Alert.alert(t('map.searchTitle'), t('map.searchEmpty'));
        return;
      }
      setMonuments((prev) => {
        const byId = new Map(prev.map((m) => [m.id, m]));
        hits.forEach((h) => {
          byId.set(h.id, { ...byId.get(h.id), ...h });
        });
        return Array.from(byId.values()).sort(
          (a, b) => (a.distance_km ?? 99) - (b.distance_km ?? 99)
        );
      });
      setHighlightedIds(new Set(hits.map((h) => h.id)));
      const first = hits[0];
      mapRef.current?.animateToRegion(
        {
          latitude: first.latitude,
          longitude: first.longitude,
          latitudeDelta: 0.06,
          longitudeDelta: 0.06,
        },
        700
      );
      setSelected(first);
    } catch (e) {
      console.warn('semantic search:', e?.message || e);
      Alert.alert(t('map.searchTitle'), t('map.searchError'));
    } finally {
      setSearchLoading(false);
    }
  };

  const clearAiTour = () => {
    dismissKeyboard();
    setAiTour(null);
    setHighlightedIds(null);
  };

  const generateAiTour = async ({ max_duration_minutes, preferences }) => {
    if (!userCoords) {
      Alert.alert(t('map.errorLoad'), t('map.needGps'));
      return;
    }
    setTourLoading(true);
    try {
      const { data } = await axios.post(
        `${getApiUrl()}/api/v1/itinerary/generate`,
        {
          user_lat: userCoords.latitude,
          user_lng: userCoords.longitude,
          max_duration_minutes,
          preferences,
          max_pois: 6,
          lang,
        },
        { timeout: 60000 }
      );

      let routeCoordsAi = [];
      const geom = data.route_geometry?.geometry?.coordinates;
      if (Array.isArray(geom) && geom.length > 1) {
        routeCoordsAi = geom.map(([lng, lat]) => ({ latitude: lat, longitude: lng }));
      } else {
        try {
          const pts = [
            userCoords,
            ...(data.waypoints || []).map((w) => ({
              latitude: w.latitude,
              longitude: w.longitude,
            })),
          ];
          const route = await fetchMapboxWalkingMulti(pts);
          routeCoordsAi = route.coordinates;
        } catch (err) {
          console.warn('AI tour fallback route:', err?.message || err);
        }
      }

      setAiTour({
        waypoints: data.waypoints || [],
        routeCoords: routeCoordsAi,
        meta: {
          distanceM: data.total_distance_meters,
          durationMin: data.total_duration_minutes,
        },
      });
      setMonuments((prev) => {
        const byId = new Map(prev.map((m) => [m.id, m]));
        (data.waypoints || []).forEach((w) => {
          byId.set(w.id, {
            ...(byId.get(w.id) || {}),
            id: w.id,
            title: w.title,
            category: w.category,
            latitude: w.latitude,
            longitude: w.longitude,
            image_url: w.image_url,
            explanation: w.description,
            distance_m: w.distance_from_previous_meters,
            distance_km: (w.distance_from_previous_meters || 0) / 1000,
          });
        });
        return Array.from(byId.values());
      });
      setTourModalOpen(false);
      setHighlightedIds(new Set((data.waypoints || []).map((w) => w.id)));
      setCategoryFilter('all');
      pauseFollowForExploration();

      if (data.waypoints?.[0]) {
        mapRef.current?.animateToRegion(
          {
            latitude: data.waypoints[0].latitude,
            longitude: data.waypoints[0].longitude,
            latitudeDelta: 0.12,
            longitudeDelta: 0.12,
          },
          800
        );
      }
    } catch (e) {
      const detail =
        e?.response?.data?.detail ||
        e?.message ||
        t('map.tourError');
      Alert.alert(t('map.tourTitle'), String(detail));
    } finally {
      setTourLoading(false);
    }
  };

  const startAiTourVisit = async () => {
    dismissKeyboard();
    if (!aiTour?.waypoints?.length) return;
    const first = aiTour.waypoints[0];
    const monument = monuments.find((m) => m.id === first.id) || {
      id: first.id,
      title: first.title,
      category: first.category,
      latitude: first.latitude,
      longitude: first.longitude,
      image_url: first.image_url,
      explanation: first.description,
      distance_m: first.distance_from_previous_meters,
      distance_km: (first.distance_from_previous_meters || 0) / 1000,
    };
    if (aiTour.routeCoords?.length > 1) {
      setRouteCoords(aiTour.routeCoords);
      setRouteMeta({
        distanceM: aiTour.meta?.distanceM || 0,
        durationS: (aiTour.meta?.durationMin || 0) * 60,
        steps: [],
      });
      setNavTarget(monument);
      setNavigating(true);
      setIsFollowingUser(true);
      setSelected(null);
    } else {
      await startInAppNavigation(monument);
    }
  };

  const handleClusterPress = (cluster) => {
    pauseFollowForExploration();
    const group = cluster.monuments || [];
    if (group.length === 0) return;
    const lats = group.map((m) => m.latitude);
    const lngs = group.map((m) => m.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    mapRef.current?.animateToRegion(
      {
        latitude: (minLat + maxLat) / 2,
        longitude: (minLng + maxLng) / 2,
        latitudeDelta: Math.max((maxLat - minLat) * 2.2, 0.02),
        longitudeDelta: Math.max((maxLng - minLng) * 2.2, 0.02),
      },
      400
    );
  };

  const onMapRegionComplete = (region, details) => {
    setMapRegion(region);
    if (details?.isGesture) {
      pauseFollowForExploration();
      const center = searchCenterRef.current || userCoords;
      if (center) {
        const movedM = haversineMeters(
          center.latitude,
          center.longitude,
          region.latitude,
          region.longitude
        );
        setShowSearchArea(movedM > 900);
      } else {
        setShowSearchArea(true);
      }
    }
  };

  const searchThisArea = () => {
    dismissKeyboard();
    if (!mapRegion) return;
    fetchNearby(mapRegion.latitude, mapRegion.longitude, { fromAreaSearch: true });
  };

  const dockPadBottom = 88 + Math.max(insets.bottom, 8);
  // Hauteur dock ≈ titre+cartes (220) + padding tab. bottom FAB doit être ≥ ce total.
  const listDockHeight = 220 + dockPadBottom;
  const mapBottomClearance = selected ? 310 : listDockHeight + 8;
  const fabBottom = (navigating ? 28 : mapBottomClearance) + 8;

  const selectMapStyle = (id) => {
    setMapStyleId(id);
    setStyleMenuOpen(false);
  };

  const openMonumentCard = (m) => {
    dismissKeyboard();
    setSelected(m);
    pauseFollowForExploration();
    mapRef.current?.animateToRegion(
      {
        latitude: m.latitude,
        longitude: m.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      },
      350
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_DEFAULT}
        initialRegion={FALLBACK_REGION}
        mapType={activeMapStyle.mapType}
        showsUserLocation={false}
        showsMyLocationButton={false}
        followsUserLocation={false}
        scrollEnabled
        zoomEnabled
        rotateEnabled
        pitchEnabled
        minZoomLevel={3}
        maxZoomLevel={20}
        userInterfaceStyle={activeMapStyle.uiStyle}
        onPanDrag={() => {
          dismissKeyboard();
          pauseFollowForExploration();
        }}
        onTouchStart={() => {
          dismissKeyboard();
          pauseFollowForExploration();
        }}
        onPress={() => {
          dismissKeyboard();
          if (selected) setSelected(null);
        }}
        mapPadding={{
          top: navigating ? insets.top + 80 : insets.top + 160,
          right: 12,
          bottom: navigating ? 40 : mapBottomClearance,
          left: 12,
        }}
        onRegionChangeComplete={onMapRegionComplete}
      >
        <UserHeadingMarker
          coordinate={userCoords}
          heading={userHeading}
          title={t('map.youAreHere')}
        />
        {mapMarkers.map((marker) => {
          if (marker.type === 'cluster') {
            return (
              <Marker
                key={marker.id}
                coordinate={marker.coordinate}
                onPress={() => {
                  dismissKeyboard();
                  handleClusterPress(marker);
                }}
                tracksViewChanges={false}
              >
                <View style={styles.clusterBubble}>
                  <Text style={styles.clusterText}>{marker.count}</Text>
                </View>
              </Marker>
            );
          }
          const m = marker.monument;
          const isHit = highlightedIds?.has(m.id);
          const tourOrder = aiTour?.waypoints?.find((w) => w.id === m.id)?.order;
          return (
            <Marker
              key={marker.id}
              coordinate={marker.coordinate}
              title={m.title}
              description={formatDistance(m.distance_km)}
              pinColor={isHit || tourOrder ? '#F59E0B' : '#059669'}
              onPress={() => {
                dismissKeyboard();
                if (navigating) return;
                pauseFollowForExploration();
                setSelected(m);
              }}
            >
              {tourOrder ? (
                <View style={styles.stepBubble}>
                  <Text style={styles.stepBubbleText}>{tourOrder}</Text>
                </View>
              ) : isHit ? (
                <View style={styles.hitBubble}>
                  <Ionicons name="sparkles" size={14} color="#fff" />
                </View>
              ) : null}
            </Marker>
          );
        })}
        {routeCoords.length > 1 && (
          <Polyline
            coordinates={routeCoords}
            strokeColor={routeStrokeColor}
            strokeWidth={routeStrokeWidth}
          />
        )}
        {!navigating && aiTour?.routeCoords?.length > 1 && (
          <Polyline
            coordinates={aiTour.routeCoords}
            strokeColor="#06B6D4"
            strokeWidth={5}
          />
        )}
      </MapView>

      {/* Colonne droite : Locate → Calques (vision) → Parcours IA */}
      {!navigating && (
        <View style={[styles.fabColumn, { bottom: fabBottom }]}>
          <TouchableOpacity
            style={[
              styles.fabBtn,
              {
                backgroundColor: isFollowingUser ? colors.primary : colors.card,
              },
            ]}
            onPress={recenterOnUser}
            disabled={!userCoords}
            activeOpacity={0.85}
            accessibilityLabel={t('map.youAreHere')}
          >
            <Ionicons
              name="locate"
              size={22}
              color={
                !userCoords
                  ? colors.textMuted
                  : isFollowingUser
                    ? '#ffffff'
                    : colors.primary
              }
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.fabBtn, { backgroundColor: colors.card }]}
            onPress={() => {
              dismissKeyboard();
              setStyleMenuOpen(true);
            }}
            activeOpacity={0.85}
            accessibilityLabel={t('map.styleTitle')}
          >
            <Ionicons name="layers" size={22} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.fabBtn, { backgroundColor: colors.primary }]}
            onPress={() => {
              dismissKeyboard();
              setTourModalOpen(true);
            }}
            activeOpacity={0.85}
          >
            <Ionicons name="sparkles" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      {tourLoading && (
        <View
          style={[
            styles.tourLoadingBanner,
            { top: insets.top + 168, backgroundColor: colors.card },
          ]}
        >
          <ActivityIndicator color={colors.primary} />
          <Text style={[styles.tourLoadingText, { color: colors.text }]}>
            {t('map.tourOptimizing')}
          </Text>
        </View>
      )}

      {/* Indicateur réseau / cache */}
      {!navigating && (usingCache || !isOnline) && (
        <View
          style={[
            styles.networkBadge,
            {
              top: insets.top + 152,
              backgroundColor: usingCache ? '#92400e' : '#7f1d1d',
            },
          ]}
        >
          <Ionicons name={usingCache ? 'cloud-offline-outline' : 'warning-outline'} size={12} color="#fff" />
          <Text style={styles.networkBadgeText}>
            {usingCache ? t('map.offlineCache') : t('map.offline')}
          </Text>
        </View>
      )}

      <Modal
        visible={styleMenuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setStyleMenuOpen(false)}
      >
        <Pressable style={styles.styleModalBackdrop} onPress={() => setStyleMenuOpen(false)}>
          <Pressable
            style={[
              styles.styleSheet,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                paddingBottom: 16 + Math.min(insets.bottom, 20),
              },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.styleSheetHandle} />
            <Text style={[styles.styleSheetTitle, { color: colors.text }]}>
              {t('map.styleTitle')}
            </Text>
            <Text style={[styles.styleSheetHint, { color: colors.textMuted }]}>
              {t('map.styleHint')}
            </Text>
            {MAP_VISION_MODES.map((mode) => {
              const active = mode.id === mapStyleId;
              return (
                <TouchableOpacity
                  key={mode.id}
                  style={[
                    styles.styleOption,
                    {
                      backgroundColor: active ? colors.primary : colors.bg,
                      borderColor: active ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => selectMapStyle(mode.id)}
                  activeOpacity={0.85}
                >
                  <Ionicons
                    name={mode.icon}
                    size={22}
                    color={active ? '#ffffff' : colors.primary}
                  />
                  <Text
                    style={[
                      styles.styleOptionLabel,
                      { color: active ? '#ffffff' : colors.text },
                    ]}
                  >
                    {t(mode.labelKey)}
                  </Text>
                  {active && <Ionicons name="checkmark-circle" size={20} color="#ffffff" />}
                </TouchableOpacity>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>

      {navigating ? (
        <>
          <View style={[styles.navBanner, { paddingTop: insets.top + 8, backgroundColor: colors.card }]}>
            <View style={styles.navBannerRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.navDist, { color: colors.primary }]}>
                  {formatDistance(remainingM / 1000)}
                  {' · '}
                  {formatWalkDuration(
                    routeMeta
                      ? (routeMeta.durationS * remainingM) / Math.max(routeMeta.distanceM, 1)
                      : 0
                  )}
                </Text>
                <Text style={[styles.navInstruction, { color: colors.text }]} numberOfLines={2}>
                  {nextInstruction || t('map.followRoute')}
                </Text>
                {!!navTarget && (
                  <Text style={[styles.navTarget, { color: colors.textMuted }]} numberOfLines={1}>
                    → {navTarget.title}
                  </Text>
                )}
              </View>
              <TouchableOpacity style={styles.navExit} onPress={stopNavigation}>
                <Text style={styles.navExitText}>{t('map.exitNav')}</Text>
              </TouchableOpacity>
            </View>
          </View>
          <TouchableOpacity
            style={[
              styles.fabBtn,
              styles.fabNavLocate,
              {
                backgroundColor: isFollowingUser ? colors.primary : colors.card,
                top: insets.top + 110,
              },
            ]}
            onPress={recenterOnUser}
            disabled={!userCoords}
            activeOpacity={0.85}
          >
            <Ionicons
              name="locate"
              size={22}
              color={isFollowingUser ? '#ffffff' : colors.primary}
            />
          </TouchableOpacity>
        </>
      ) : (
        <>
          <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
            <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons name="search" size={16} color={colors.primary} />
              <TextInput
                ref={searchInputRef}
                style={[styles.searchInput, { color: colors.text }]}
                placeholder={t('map.searchPlaceholder')}
                placeholderTextColor={colors.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={runSemanticSearch}
                returnKeyType="search"
                blurOnSubmit
                editable={!searchLoading}
              />
              {searchLoading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : searchQuery || highlightedIds ? (
                <TouchableOpacity onPress={clearSemanticSearch} hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              ) : null}
            </View>
            <Text
              style={[styles.nearbyHint, { color: colors.textMuted }]}
              onPress={dismissKeyboard}
            >
              {loading
                ? t('map.locating')
                : refreshingGps && monuments.length === 0
                  ? t('map.locating')
                  : permissionDenied
                    ? t('map.permissionDenied')
                    : t('map.nearbyCount', { count: filteredMonuments.length })}
            </Text>
          </View>
          {!aiTour && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={[styles.chipsRow, { top: insets.top + 108 }]}
              contentContainerStyle={styles.chipsContent}
              keyboardShouldPersistTaps="handled"
            >
              {MAP_CATEGORY_FILTERS.map((f) => {
                const active = categoryFilter === f.id;
                return (
                  <TouchableOpacity
                    key={f.id}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: active ? colors.primary : colors.card,
                        borderColor: active ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => {
                      dismissKeyboard();
                      setCategoryFilter(f.id);
                    }}
                    activeOpacity={0.85}
                  >
                    <Ionicons
                      name={f.icon}
                      size={14}
                      color={active ? '#fff' : colors.primary}
                    />
                    <Text
                      style={[styles.chipText, { color: active ? '#fff' : colors.text }]}
                      numberOfLines={1}
                    >
                      {t(f.labelKey)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </>
      )}

      {showSearchArea && !navigating && !aiTour && (
        <TouchableOpacity
          style={[
            styles.searchAreaBtn,
            {
              top: insets.top + 158,
              backgroundColor: colors.card,
              borderColor: colors.primary,
            },
          ]}
          onPress={searchThisArea}
          disabled={areaLoading}
          activeOpacity={0.9}
        >
          {areaLoading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <>
              <Ionicons name="search" size={16} color={colors.primary} />
              <Text style={[styles.searchAreaText, { color: colors.primary }]}>
                {t('map.searchThisArea')}
              </Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {errorMsg && !navigating && (
        <View style={[styles.errorBanner, { top: insets.top + 56 }]}>
          <Text style={styles.errorText}>{errorMsg}</Text>
        </View>
      )}

      {selected && !navigating && (
        <MapMonumentSheet
          monument={selected}
          colors={colors}
          apiUrl={getApiUrl()}
          language={lang}
          bottomInset={insets.bottom}
          navLoading={navLoading}
          autoStartAudio={autoStartAudio}
          onAutoAudioConsumed={() => setAutoStartAudio(false)}
          onClose={() => {
            setSelected(null);
            setAutoStartAudio(false);
          }}
          onDirections={(m) => startInAppNavigation(m)}
        />
      )}

      <ItineraryModal
        visible={tourModalOpen}
        colors={colors}
        loading={tourLoading}
        onClose={() => !tourLoading && setTourModalOpen(false)}
        onGenerate={generateAiTour}
      />

      {/* Dock bas : parcours IA OU liste proximité — jamais les deux superposés */}
      {!navigating && !selected && (
        <View
          style={[
            styles.listDock,
            {
              paddingBottom: dockPadBottom,
              backgroundColor: colors.bg,
            },
          ]}
        >
          {aiTour ? (
            <>
              <View style={styles.tourDockHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.listTitle, { color: colors.text, marginBottom: 2 }]}>
                    {t('map.tourReady', { count: aiTour.waypoints.length })}
                  </Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '600' }}>
                    {formatDistance((aiTour.meta?.distanceM || 0) / 1000)}
                    {' · '}
                    {Math.round(aiTour.meta?.durationMin || 0)} min
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.tourStartBtn, { backgroundColor: colors.primary }]}
                  onPress={startAiTourVisit}
                >
                  <Text style={styles.tourStartText}>{t('map.tourStart')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={clearAiTour} hitSlop={10} style={{ padding: 4 }}>
                  <Ionicons name="close" size={20} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.listContent}
              >
                {aiTour.waypoints.map((w) => {
                  const m =
                    monuments.find((x) => x.id === w.id) || {
                      id: w.id,
                      title: w.title,
                      category: w.category,
                      latitude: w.latitude,
                      longitude: w.longitude,
                      image_url: w.image_url,
                      explanation: w.description,
                    };
                  return (
                    <TouchableOpacity
                      key={`tour-${w.id}`}
                      style={[
                        styles.card,
                        {
                          backgroundColor: colors.card,
                          borderColor: colors.border,
                        },
                      ]}
                      onPress={() => openMonumentCard(m)}
                      activeOpacity={0.9}
                    >
                      <View style={styles.stepBadge}>
                        <Text style={styles.stepBadgeText}>{w.order}</Text>
                      </View>
                      {m.image_url ? (
                        <Image
                          source={monumentImageSource(m.image_url)}
                          style={styles.cardImage}
                          resizeMode="cover"
                        />
                      ) : (
                        <View
                          style={[
                            styles.cardImage,
                            { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.border },
                          ]}
                        >
                          <Ionicons name="image-outline" size={22} color={colors.textMuted} />
                        </View>
                      )}
                      <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={2}>
                        {w.title}
                      </Text>
                      <Text style={[styles.cardDist, { color: colors.textMuted }]}>
                        {t('map.tourStepVisit', {
                          count: w.estimated_visit_time_minutes || 20,
                        })}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </>
          ) : (
            <>
              <Text style={[styles.listTitle, { color: colors.text }]}>{t('map.nearbyList')}</Text>
              {loading && monuments.length === 0 ? (
                <ActivityIndicator color={colors.primary} style={{ marginVertical: 12 }} />
              ) : filteredMonuments.length === 0 ? (
                <Text style={[styles.empty, { color: colors.textMuted }]}>{t('map.empty')}</Text>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.listContent}
                >
                  {filteredMonuments.map((m) => {
                    const active = selected?.id === m.id;
                    return (
                      <View
                        key={m.id}
                        style={[
                          styles.card,
                          {
                            backgroundColor: colors.card,
                            borderColor: active ? colors.primary : colors.border,
                          },
                        ]}
                      >
                        <TouchableOpacity
                          onPress={() => openMonumentCard(m)}
                          activeOpacity={0.9}
                          accessibilityRole="button"
                        >
                          {m.image_url ? (
                            <Image
                              source={monumentImageSource(m.image_url)}
                              style={styles.cardImage}
                              resizeMode="cover"
                            />
                          ) : (
                            <View
                              style={[
                                styles.cardImage,
                                { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.border },
                              ]}
                            >
                              <Ionicons name="image-outline" size={22} color={colors.textMuted} />
                            </View>
                          )}
                          <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={2}>
                            {m.title}
                          </Text>
                          <Text style={[styles.cardDist, { color: colors.primary }]}>
                            {formatDistance(m.distance_km)}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.cardDir}
                          onPress={() => {
                            dismissKeyboard();
                            startInAppNavigation(m);
                          }}
                          hitSlop={8}
                          accessibilityRole="button"
                          accessibilityLabel={t('map.directions')}
                        >
                          <Text style={[styles.cardDirText, { color: colors.primary }]}>
                            {t('map.directions')}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </ScrollView>
              )}
            </>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    position: 'absolute',
    left: 16,
    right: 72,
    zIndex: 10,
    gap: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    paddingVertical: 2,
  },
  nearbyHint: {
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 4,
  },
  chipsRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 10,
    maxHeight: 44,
  },
  chipsContent: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
    paddingVertical: 2,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    flexShrink: 0,
  },
  chipText: { fontSize: 12, fontWeight: '700' },
  clusterBubble: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#ffffff',
  },
  clusterText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    maxWidth: '100%',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.12,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
      },
      android: { elevation: 3 },
    }),
  },
  badgeText: { flexShrink: 1, fontWeight: '700', fontSize: 13 },
  fabColumn: {
    position: 'absolute',
    right: 16,
    zIndex: 14,
    alignItems: 'center',
    gap: 10,
  },
  fabBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
      },
      android: { elevation: 4 },
    }),
  },
  fabNavLocate: {
    position: 'absolute',
    right: 16,
    zIndex: 14,
  },
  tourDockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
    paddingRight: 4,
  },
  stepBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    zIndex: 2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#0891B2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  tourLoadingBanner: {
    position: 'absolute',
    alignSelf: 'center',
    left: 40,
    right: 40,
    zIndex: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
  },
  tourLoadingText: { fontWeight: '700', fontSize: 13, flexShrink: 1 },
  stepBubble: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#0891B2',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  stepBubbleText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  hitBubble: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  tourBanner: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  tourBannerTitle: { fontWeight: '800', fontSize: 14 },
  tourStartBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  tourStartText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  styleModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'flex-end',
  },
  styleSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 8,
  },
  styleSheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#94a3b8',
    marginBottom: 8,
  },
  styleSheetTitle: { fontSize: 17, fontWeight: '800', marginBottom: 2 },
  styleSheetHint: { fontSize: 13, marginBottom: 8, lineHeight: 18 },
  styleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  styleOptionLabel: { flex: 1, fontSize: 15, fontWeight: '700' },
  navBanner: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 6 },
    }),
  },
  navBannerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  navDist: { fontSize: 16, fontWeight: '800' },
  navInstruction: { fontSize: 14, fontWeight: '600', marginTop: 4, lineHeight: 20 },
  navTarget: { fontSize: 12, marginTop: 4 },
  navExit: {
    backgroundColor: '#dc2626',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  navExitText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  errorBanner: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: 'rgba(220,38,38,0.92)',
    padding: 10,
    borderRadius: 12,
  },
  errorText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  searchAreaBtn: {
    position: 'absolute',
    alignSelf: 'center',
    left: 48,
    right: 48,
    zIndex: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 22,
    borderWidth: 1.5,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.12,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
      },
      android: { elevation: 4 },
    }),
  },
  searchAreaText: { fontWeight: '800', fontSize: 13 },
  networkBadge: {
    position: 'absolute',
    left: 16,
    zIndex: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  networkBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  listDock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 10,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },
  listTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginLeft: 16,
    marginBottom: 10,
  },
  listContent: { paddingHorizontal: 16, paddingRight: 72, gap: 10, paddingBottom: 4 },
  empty: { marginHorizontal: 16, marginBottom: 12, fontSize: 13 },
  card: {
    width: 160,
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 10,
    overflow: 'hidden',
  },
  cardImage: {
    width: '100%',
    height: 72,
    borderRadius: 10,
    marginBottom: 8,
    backgroundColor: '#e2e8f0',
  },
  cardTitle: { fontSize: 13, fontWeight: '800', minHeight: 34 },
  cardDist: { fontSize: 13, fontWeight: '700', marginTop: 6 },
  cardDir: { marginTop: 8 },
  cardDirText: { fontSize: 12, fontWeight: '700' },
});
