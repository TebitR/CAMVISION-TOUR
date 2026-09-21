import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Sur Expo Go Android (SDK 53+) : pas de push distant — le module
 * expo-notifications peut lever une Error dès l'usage des APIs push.
 * iOS Expo Go et les builds natifs (dev/APK) gardent le comportement complet.
 */
export function isExpoGo() {
  return Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
}

/** Désactiver uniquement le chemin « push Android + Expo Go ». */
export function shouldDisableAndroidExpoGoPush() {
  return isExpoGo() && Platform.OS === 'android';
}

let Notifications = null;

if (!shouldDisableAndroidExpoGoPush()) {
  try {
    // Chargement conditionnel : iOS Expo Go + builds natifs OK
    // eslint-disable-next-line global-require
    Notifications = require('expo-notifications');
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  } catch (error) {
    Notifications = null;
    console.warn('expo-notifications indisponible:', error?.message || error);
  }
} else {
  console.log(
    '[CAMVISION] Expo Go Android : push distant désactivé (SDK 53+). ' +
      'Geofence via Alert ; iOS / development build inchangés.'
  );
}

/**
 * Token push distant.
 * - Android + Expo Go → null (évite le crash)
 * - iOS Expo Go / APK / iOS → tentative d'enregistrement
 */
export async function registerForPushNotificationsAsync() {
  if (shouldDisableAndroidExpoGoPush() || !Notifications) {
    console.log(
      'Les push notifications distantes Android sont désactivées sur Expo Go (SDK 53+).'
    );
    return null;
  }

  try {
    const current = await Notifications.getPermissionsAsync();
    let finalStatus = current.status;
    if (finalStatus !== 'granted') {
      const asked = await Notifications.requestPermissionsAsync();
      finalStatus = asked.status;
    }
    if (finalStatus !== 'granted') {
      console.warn('Permission notifications refusée.');
      return null;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
      });
    }

    // Push distant : uniquement hors Expo Go Android (déjà filtré plus haut).
    // Sur iOS Expo Go, le push reste supporté par Expo.
    if (isExpoGo() && Platform.OS === 'android') {
      return null;
    }

    const projectId =
      Constants.easConfig?.projectId ||
      Constants.expoConfig?.extra?.eas?.projectId;

    let tokenResponse;
    try {
      tokenResponse = projectId
        ? await Notifications.getExpoPushTokenAsync({ projectId })
        : await Notifications.getExpoPushTokenAsync();
    } catch (pushErr) {
      // iOS Expo Go sans projet EAS, ou API push indisponible
      console.warn('Push token indisponible:', pushErr?.message || pushErr);
      return null;
    }

    const token = tokenResponse?.data;
    if (token) console.log('Push Token:', token);
    return token || null;
  } catch (error) {
    console.warn("Erreur d'enregistrement notification:", error?.message || error);
    return null;
  }
}

/** Permissions (locales). No-op sûr sur Android Expo Go. */
export async function ensureNotificationPermissions() {
  if (!Notifications) return false;
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.status === 'granted') return true;
    const asked = await Notifications.requestPermissionsAsync();
    return asked.status === 'granted';
  } catch (error) {
    console.warn('Permission notifications:', error?.message || error);
    return false;
  }
}

/**
 * Notification locale geofence.
 * Sur Android Expo Go : no-op (MapScreen garde l'Alert).
 * Sur iOS / builds natifs : notification locale normale.
 */
export async function notifyMonumentNearby(monument) {
  if (!Notifications || !monument?.id) return;
  try {
    const ok = await ensureNotificationPermissions();
    if (!ok) return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'CAMVISION TOUR',
        body: `Vous êtes à proximité de ${monument.title} ! Cliquez pour lancer la visite vocale.`,
        data: {
          type: 'geofence',
          monumentId: monument.id,
          screen: 'Scan',
        },
        sound: true,
      },
      trigger: null,
    });
  } catch (error) {
    console.warn('notifyMonumentNearby:', error?.message || error);
  }
}

export function addNotificationResponseListener(handler) {
  if (!Notifications) {
    return { remove() {} };
  }
  try {
    return Notifications.addNotificationResponseReceivedListener(handler);
  } catch (error) {
    console.warn('Notification listener:', error?.message || error);
    return { remove() {} };
  }
}
