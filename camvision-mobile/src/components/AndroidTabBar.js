import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme/ThemeContext';

const TAB_META = {
  Accueil: { icon: 'home', labelKey: 'tabs.home' },
  Découverte: { icon: 'compass', labelKey: 'tabs.explore' },
  Carte: { icon: 'map', labelKey: 'tabs.map' },
  Scan: { icon: 'scan', labelKey: 'tabs.scan' },
  Profil: { icon: 'person', labelKey: 'tabs.profile' },
};

export default function AndroidTabBar({ state, navigation }) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: isDark ? '#0f172a' : '#ffffff',
          borderTopColor: colors.border,
          paddingBottom: Math.max(insets.bottom, 8),
        },
      ]}
    >
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
            Haptics.selectionAsync().catch(() => {});
            navigation.navigate(route.name);
          }
        };

        return (
          <Pressable
            key={route.key}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={isFocused ? { selected: true } : {}}
            onPress={onPress}
            android_ripple={{ color: 'rgba(6, 102, 140, 0.18)', borderless: false }}
            style={styles.item}
          >
            <View
              style={[
                styles.indicator,
                isFocused && { backgroundColor: 'rgba(6, 102, 140, 0.16)' },
              ]}
            >
              <Ionicons
                name={iconName}
                size={route.name === 'Scan' ? 24 : 22}
                color={isFocused ? '#06668C' : colors.textMuted}
              />
            </View>
            <Text
              style={[
                styles.label,
                { color: isFocused ? '#06668C' : colors.textMuted },
                isFocused && styles.labelActive,
              ]}
              numberOfLines={1}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderTopWidth: StyleSheet.hairlineWidth,
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -2 },
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
    minHeight: 56,
  },
  indicator: {
    minWidth: 56,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '600',
    includeFontPadding: false,
  },
  labelActive: {
    fontWeight: '800',
  },
});
