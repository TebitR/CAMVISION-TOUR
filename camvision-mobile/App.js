import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme, DarkTheme, createNavigationContainerRef } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { storageGet } from './src/utils/safeStorage';

import './src/i18n';
import i18n, { resolveAppLanguage } from './src/i18n';
import HomeScreen from './src/screens/HomeScreen';
import ExploreScreen from './src/screens/ExploreScreen';
import MapScreen from './src/screens/MapScreen';
import ScanScreen from './src/screens/ScanScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import BrandingScreen from './src/screens/BrandingScreen';
import OnboardingScreen, { LANG_STORAGE_KEY } from './src/screens/OnboardingScreen';
import FloatingTabBar from './src/components/FloatingTabBar';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import {
  addNotificationResponseListener,
  ensureNotificationPermissions,
  registerForPushNotificationsAsync,
} from './src/services/notificationService';

const Tab = createBottomTabNavigator();
const navigationRef = createNavigationContainerRef();

function MainTabNavigator() {
  const { t } = useTranslation();

  return (
    <Tab.Navigator
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tab.Screen name="Accueil" component={HomeScreen} options={{ title: t('tabs.home') }} />
      <Tab.Screen name="Découverte" component={ExploreScreen} options={{ title: t('tabs.explore') }} />
      <Tab.Screen name="Carte" component={MapScreen} options={{ title: t('tabs.map') }} />
      <Tab.Screen name="Scan" component={ScanScreen} options={{ title: t('tabs.scan') }} />
      <Tab.Screen name="Profil" component={ProfileScreen} options={{ title: t('tabs.profile') }} />
    </Tab.Navigator>
  );
}

function AppRoot() {
  const { colors, isDark } = useTheme();
  const [phase, setPhase] = useState('loading');

  useEffect(() => {
    (async () => {
      try {
        const savedLang = await storageGet(LANG_STORAGE_KEY);
        if (savedLang) {
          await i18n.changeLanguage(resolveAppLanguage(savedLang));
        }
      } catch (e) {
        console.warn('Chargement langue:', e?.message || e);
      }
      setPhase('branding');
    })();
  }, []);

  useEffect(() => {
    if (phase !== 'main') return undefined;
    ensureNotificationPermissions().catch(() => {});
    // Push distant uniquement hors Expo Go (évite le crash Android SDK 53+)
    registerForPushNotificationsAsync().catch(() => {});
    const sub = addNotificationResponseListener((response) => {
      const data = response?.notification?.request?.content?.data;
      if (data?.screen === 'Scan' || data?.type === 'geofence') {
        if (navigationRef.isReady()) {
          navigationRef.navigate('Scan');
        }
      }
    });
    return () => sub.remove();
  }, [phase]);

  const navTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
      background: colors.bg,
      card: colors.card,
      primary: colors.primary,
      text: colors.text,
      border: colors.border,
      notification: colors.accent,
    },
  };

  if (phase === 'loading') {
    return null;
  }

  if (phase === 'branding') {
    return <BrandingScreen onStart={() => setPhase('onboarding')} />;
  }

  if (phase === 'onboarding') {
    return <OnboardingScreen onDone={() => setPhase('main')} />;
  }

  return (
    <NavigationContainer theme={navTheme} ref={navigationRef}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <MainTabNavigator />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppRoot />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
