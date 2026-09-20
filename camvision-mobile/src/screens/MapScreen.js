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
import {
  getCurrentPosition,
  watchPosition,
  watchHeading,
  formatDistance,
  openNativeDirections,
  GEOFENCE_RADIUS_M,
  haversineMeters,
} from '../services/locationService';
import {
  fetchMapboxRoute,
  formatWalkDuration,
  getNextInstruction,
} from '../services/navigationService';
import { notifyMonumentNearby } from '../services/notificationService';

const API_URL = getApiUrl();

const FALLBACK_REGION = {
  latitude: 3.8667,
  longitude: 11.5167,
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
  const watchRef = useRef(null);
  const headingWatchRef = useRef(null);
  const alertedRef = useRef(new Set());
  const didCenterRef = useRef(false);
  const navigatingRef = useRef(false);
  const isFollowingUserRef = useRef(true);
  const searchCenterRef = useRef(null);
  const cachedMonumentsRef = useRef([]);

  const [loading, setLoading] = useState(true);
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

  const filteredMonuments = useMemo(
    () => filterMonumentsByCategory(monuments, categoryFilter),
    [monuments, categoryFilter]
  );

  const mapMarkers = useMemo(
    () => buildMapMarkers(filteredMonuments, mapRegion),
    [filteredMonuments, mapRegion]
  );

  const fetchNearby = useCallback(
    async (lat, lng, { fromAreaSearch = false } = {}) => {
      if (fromAreaSearch) setAreaLoading(true);
      try {
        const { data } = await axios.get(`${API_URL}/api/monuments/nearby`, {
          params: { lat, lng, radius: 500, lang },
          timeout: 20000,
        });
        const next = data.monuments || [];
        cachedMonumentsRef.current = next;
        setMonuments(next);
        setErrorMsg(null);
        setIsOnline(true);
        setUsingCache(false);
        searchCenterRef.current = { latitude: lat, longitude: lng };
        setShowSearchArea(false);
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
      }
    },
    [lang, t]
  );

  const onLocation = useCallback(
    async (coords) => {
      setUserCoords(coords);
      await fetchNearby(coords.latitude, coords.longitude);
    },
    [fetchNearby]
  );

  useEffect(() => {
    if (!isFocused) return undefined;
    let cancelled = false;

    (async () => {
      setLoading(true);
      const pos = await getCurrentPosition();
      if (cancelled) return;

      if (!pos) {
        setPermissionDenied(true);
        setLoading(false);
        setUserCoords(null);
        await fetchNearby(FALLBACK_REGION.latitude, FALLBACK_REGION.longitude);
        return;
      }

      setPermissionDenied(false);
      await onLocation(pos);
      setLoading(false);

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

        // Suivi auto : recentre seulement — ne force pas le zoom (exploration libre préservée)
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
  }, [isFocused, fetchNearby, onLocation]);

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

  // Geofence → notification locale + Alert
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
              text: t('map.goScan'),
              onPress: () => navigation.navigate('Scan'),
            },
          ]
        );
      }
    });
  }, [userCoords, monuments, t, navigation]);

  const stopNavigation = () => {
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
    if (!mapRegion) return;
    fetchNearby(mapRegion.latitude, mapRegion.longitude, { fromAreaSearch: true });
  };

  const layersFabTop = navigating ? insets.top + 110 : insets.top + 58;
  const chipsTop = navigating ? insets.top + 118 : insets.top + 108;

  const selectMapStyle = (id) => {
    setMapStyleId(id);
    setStyleMenuOpen(false);
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
        onPanDrag={pauseFollowForExploration}
        onTouchStart={pauseFollowForExploration}
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
                onPress={() => handleClusterPress(marker)}
                tracksViewChanges={false}
              >
                <View style={styles.clusterBubble}>
                  <Text style={styles.clusterText}>{marker.count}</Text>
                </View>
              </Marker>
            );
          }
          const m = marker.monument;
          return (
            <Marker
              key={marker.id}
              coordinate={marker.coordinate}
              title={m.title}
              description={formatDistance(m.distance_km)}
              pinColor="#059669"
              onPress={() => {
                if (navigating) return;
                pauseFollowForExploration();
                setSelected(m);
              }}
            />
          );
        })}
        {routeCoords.length > 1 && (
          <Polyline
            coordinates={routeCoords}
            strokeColor={routeStrokeColor}
            strokeWidth={routeStrokeWidth}
          />
        )}
      </MapView>

      {/* Sélecteur de calques — haut droite, sous la zone du menu Expo « … » */}
      <TouchableOpacity
        style={[
          styles.fabLayers,
          {
            backgroundColor: colors.card,
            top: layersFabTop,
          },
        ]}
        onPress={() => setStyleMenuOpen(true)}
        activeOpacity={0.85}
        accessibilityLabel={t('map.styleTitle')}
      >
        <Ionicons name="layers" size={22} color={colors.primary} />
      </TouchableOpacity>

      {/* Indicateur réseau / cache */}
      {!navigating && (usingCache || !isOnline) && (
        <View
          style={[
            styles.networkBadge,
            {
              top: insets.top + 8,
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
              styles.fabLocate,
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
            <View style={[styles.badge, { backgroundColor: colors.card }]}>
              <Ionicons name="navigate" size={16} color={colors.primary} />
              <Text style={[styles.badgeText, { color: colors.text }]} numberOfLines={1}>
                {loading
                  ? t('map.locating')
                  : permissionDenied
                    ? t('map.permissionDenied')
                    : t('map.nearbyCount', { count: filteredMonuments.length })}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={[
              styles.fabLocate,
              {
                backgroundColor: isFollowingUser ? colors.primary : colors.card,
                top: insets.top + 58,
              },
            ]}
            onPress={recenterOnUser}
            disabled={!userCoords}
            activeOpacity={0.85}
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

          {/* Filtres catégories */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={[styles.chipsRow, { top: chipsTop }]}
            contentContainerStyle={styles.chipsContent}
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
                  onPress={() => setCategoryFilter(f.id)}
                  activeOpacity={0.85}
                >
                  <Ionicons
                    name={f.icon}
                    size={14}
                    color={active ? '#fff' : colors.primary}
                  />
                  <Text style={[styles.chipText, { color: active ? '#fff' : colors.text }]}>
                    {t(f.labelKey)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </>
      )}

      {showSearchArea && !navigating && (
        <TouchableOpacity
          style={[
            styles.searchAreaBtn,
            {
              top: chipsTop + 44,
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
          apiUrl={API_URL}
          language={lang}
          bottomInset={insets.bottom}
          navLoading={navLoading}
          onClose={() => setSelected(null)}
          onDirections={(m) => startInAppNavigation(m)}
        />
      )}

      {!navigating && (
        <View
          style={[
            styles.listDock,
            {
              paddingBottom: 88 + Math.min(insets.bottom, 14),
              backgroundColor: colors.bg,
            },
          ]}
        >
          <Text style={[styles.listTitle, { color: colors.text }]}>{t('map.nearbyList')}</Text>
          {loading ? (
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
                  <TouchableOpacity
                    key={m.id}
                    style={[
                      styles.card,
                      {
                        backgroundColor: colors.card,
                        borderColor: active ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => {
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
                    }}
                    activeOpacity={0.9}
                  >
                    <Image
                      source={monumentImageSource(m.image_url)}
                      style={styles.cardImage}
                      resizeMode="cover"
                    />
                    <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={2}>
                      {m.title}
                    </Text>
                    <Text style={[styles.cardDist, { color: colors.primary }]}>
                      {formatDistance(m.distance_km)}
                    </Text>
                    <TouchableOpacity
                      style={styles.cardDir}
                      onPress={() => startInAppNavigation(m)}
                    >
                      <Text style={[styles.cardDirText, { color: colors.primary }]}>
                        {t('map.directions')}
                      </Text>
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
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
    // Zone réservée au menu Expo Go (trois points) en haut à droite
    right: 72,
    zIndex: 10,
  },
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
  fabLocate: {
    position: 'absolute',
    left: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
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
  fabLayers: {
    position: 'absolute',
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
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
  chipsRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 10,
    maxHeight: 40,
  },
  chipsContent: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
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
    right: 64,
    zIndex: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 8,
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
  listContent: { paddingHorizontal: 16, gap: 10, paddingBottom: 4 },
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
