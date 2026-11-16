import { Platform } from 'react-native';

export const IS_IOS = Platform.OS === 'ios';
export const IS_ANDROID = Platform.OS === 'android';

/** Marge sous le contenu : la barre iOS flotte, la barre Android est dans le flux. */
export function tabOverlayPadding(insetsBottom = 0) {
  if (IS_IOS) return 110 + Math.max(insetsBottom, 8);
  return 20;
}

/** Padding du dock carte au-dessus de la tab bar. */
export function mapDockTabPadding(insetsBottom = 0) {
  if (IS_IOS) return 88 + Math.max(insetsBottom, 8);
  return 12;
}

/** Offset des boutons Scan (galerie) au-dessus de la tab bar. */
export function scanTabClearance(insetsBottom = 0) {
  if (IS_IOS) return 72 + Math.max(insetsBottom, 8);
  return 12;
}
