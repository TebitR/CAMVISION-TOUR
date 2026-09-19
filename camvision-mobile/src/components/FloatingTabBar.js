import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const TAB_META = {
  Accueil: { icon: 'home', label: 'Accueil' },
  Découverte: { icon: 'compass', label: 'Explorer' },
  Carte: { icon: 'map', label: 'Carte' },
  Scan: { icon: 'scan', label: 'Scan' },
  Profil: { icon: 'person', label: 'Profil' },
};

export default function FloatingTabBar({ state, descriptors, navigation }) {
  const insets = useSafeAreaInsets();
  // Rapprocher du bas : petit espace au-dessus de l'indicateur home
  const bottomOffset = Platform.OS === 'ios' ? Math.min(insets.bottom, 14) : 10;

  return (
    <View style={[styles.wrap, { bottom: bottomOffset }]}>
      <BlurView intensity={70} tint="light" style={styles.blur}>
        <View style={styles.inner}>
          {state.routes.map((route, index) => {
            const meta = TAB_META[route.name] || { icon: 'ellipse', label: route.name };
            const isFocused = state.index === index;
            const iconName = isFocused ? meta.icon : `${meta.icon}-outline`;

            const onPress = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            };

            return (
              <TouchableOpacity
                key={route.key}
                accessibilityRole="button"
                accessibilityState={isFocused ? { selected: true } : {}}
                onPress={onPress}
                style={styles.item}
                activeOpacity={0.85}
              >
                <View style={[styles.itemInner, isFocused && styles.itemActive]}>
                  <Ionicons
                    name={iconName}
                    size={route.name === 'Scan' ? 24 : 22}
                    color={isFocused ? '#059669' : '#64748b'}
                  />
                  <Text style={[styles.label, isFocused && styles.labelActive]} numberOfLines={1}>
                    {meta.label}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 12,
    right: 12,
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(15, 23, 42, 0.08)',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 10,
    ...Platform.select({
      android: { backgroundColor: 'rgba(255, 255, 255, 0.94)' },
      default: {},
    }),
  },
  blur: {
    borderRadius: 28,
    overflow: 'hidden',
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingVertical: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
  },
  item: {
    flex: 1,
    alignItems: 'center',
  },
  itemInner: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderRadius: 20,
    minWidth: 56,
  },
  itemActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.14)',
  },
  label: {
    marginTop: 1,
    fontSize: 10,
    fontWeight: '600',
    color: '#64748b',
  },
  labelActive: {
    color: '#047857',
    fontWeight: '700',
  },
});
