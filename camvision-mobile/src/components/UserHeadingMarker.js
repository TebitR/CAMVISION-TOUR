import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Marker } from 'react-native-maps';

/**
 * Position utilisateur + cône d'orientation (heading / boussole).
 */
export default function UserHeadingMarker({ coordinate, heading = 0, title }) {
  if (!coordinate?.latitude || !coordinate?.longitude) return null;

  const rotation =
    typeof heading === 'number' && !Number.isNaN(heading) ? heading : 0;

  return (
    <Marker
      coordinate={coordinate}
      title={title}
      anchor={{ x: 0.5, y: 0.5 }}
      flat
      rotation={rotation}
      tracksViewChanges={false}
      zIndex={999}
      identifier="user-heading"
    >
      <View style={styles.wrap}>
        <View style={styles.cone} />
        <View style={styles.dotOuter}>
          <View style={styles.dotInner} />
        </View>
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  cone: {
    width: 0,
    height: 0,
    borderLeftWidth: 14,
    borderRightWidth: 14,
    borderBottomWidth: 28,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: 'rgba(37, 99, 235, 0.35)',
    marginBottom: -10,
  },
  dotOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(37, 99, 235, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  dotInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#2563eb',
  },
});
