import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

const TAB_META = {
  Accueil: { icon: 'home', labelKey: 'tabs.home' },
  Découverte: { icon: 'compass', labelKey: 'tabs.explore' },
  Carte: { icon: 'map', labelKey: 'tabs.map' },
  Scan: { icon: 'scan', labelKey: 'tabs.scan' },
  Profil: { icon: 'person', labelKey: 'tabs.profile' },
};

export default function FloatingTabBar({ state, descriptors, navigation }) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const bottomOffset = Platform.OS === 'ios' ? Math.min(insets.bottom, 14) : 10;

  return (
    <View style={[styles.wrap, { bottom: bottomOffset }]}>
      <BlurView intensity={70} tint="light" style={styles.blur}>
        <View style={styles.inner}>
          {state.routes.map((route, index) => {
            const meta = TAB_META[route.name] || { icon: 'ellipse', labelKey: null };
            const isFocused = state.index === index;
            const iconName = isFocused ? meta.icon : `${meta.icon}-outline`;
            const label = meta.labelKey ? t(meta.labelKey) : route.name;

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
                    {label}
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
    elevation: 8,
  },
  blur: { overflow: 'hidden' },
  inner: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.82)',
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  item: { flex: 1, alignItems: 'center' },
  itemInner: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 18,
    minWidth: 56,
  },
  itemActive: { backgroundColor: 'rgba(16, 185, 129, 0.12)' },
  label: { marginTop: 2, fontSize: 10, color: '#64748b', fontWeight: '600' },
  labelActive: { color: '#059669', fontWeight: '800' },
});
