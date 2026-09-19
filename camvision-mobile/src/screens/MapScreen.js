import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function MapScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Ionicons name="map" size={36} color="#059669" />
      </View>
      <Text style={styles.title}>Carte</Text>
      <Text style={styles.subtitle}>
        Carte Mapbox interactive centrée sur votre position et les POI — à venir.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 28,
    paddingBottom: 120,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: '#0f172a', fontSize: 22, fontWeight: '800', marginTop: 16 },
  subtitle: { color: '#64748b', fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 },
});
