import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function ensureNotificationPermissions() {
  const current = await Notifications.getPermissionsAsync();
  if (current.status === 'granted') return true;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.status === 'granted';
}

/**
 * Notification locale de proximité patrimoniale.
 */
export async function notifyMonumentNearby(monument) {
  const ok = await ensureNotificationPermissions();
  if (!ok || !monument?.id) return;

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
    trigger: null, // immédiat
  });
}

export function addNotificationResponseListener(handler) {
  return Notifications.addNotificationResponseReceivedListener(handler);
}
