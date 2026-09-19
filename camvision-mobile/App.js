import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import './src/i18n';
import HomeScreen from './src/screens/HomeScreen';
import ExploreScreen from './src/screens/ExploreScreen';
import MapScreen from './src/screens/MapScreen';
import ScanScreen from './src/screens/ScanScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import BrandingScreen from './src/screens/BrandingScreen';
import FloatingTabBar from './src/components/FloatingTabBar';

const Tab = createBottomTabNavigator();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#f8fafc',
    card: '#ffffff',
    primary: '#059669',
    text: '#0f172a',
    border: 'rgba(15, 23, 42, 0.08)',
    notification: '#10b981',
  },
};

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

export default function App() {
  const [hasStarted, setHasStarted] = useState(false);

  if (!hasStarted) {
    return <BrandingScreen onStart={() => setHasStarted(true)} />;
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer theme={navTheme}>
        <StatusBar style="dark" />
        <MainTabNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
