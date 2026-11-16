import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Animated,
  Easing,
  TouchableOpacity,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

export default function BrandingScreen({ onStart }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isAndroid = Platform.OS === 'android';

  const fadeLogo = useRef(new Animated.Value(0)).current;
  const scaleLogo = useRef(new Animated.Value(isAndroid ? 0.92 : 0.82)).current;
  const floatY = useRef(new Animated.Value(0)).current;
  const fadeText = useRef(new Animated.Value(0)).current;
  const fadeBtn = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0.4)).current;

  const logoSize = Math.min(
    width * (isAndroid ? 0.72 : 0.82),
    height * (isAndroid ? 0.36 : 0.42),
    isAndroid ? 280 : 360
  );

  useEffect(() => {
    const enter = isAndroid
      ? Animated.parallel([
          Animated.timing(fadeLogo, {
            toValue: 1,
            duration: 520,
            useNativeDriver: true,
            easing: Easing.out(Easing.cubic),
          }),
          Animated.timing(scaleLogo, {
            toValue: 1,
            duration: 520,
            useNativeDriver: true,
            easing: Easing.out(Easing.cubic),
          }),
        ])
      : Animated.parallel([
          Animated.timing(fadeLogo, {
            toValue: 1,
            duration: 900,
            useNativeDriver: true,
            easing: Easing.out(Easing.cubic),
          }),
          Animated.spring(scaleLogo, {
            toValue: 1,
            friction: 6,
            tension: 50,
            useNativeDriver: true,
          }),
        ]);

    Animated.sequence([
      enter,
      Animated.timing(fadeText, {
        toValue: 1,
        duration: isAndroid ? 280 : 500,
        useNativeDriver: true,
      }),
      Animated.timing(fadeBtn, {
        toValue: 1,
        duration: isAndroid ? 240 : 450,
        useNativeDriver: true,
      }),
    ]).start();

    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatY, {
          toValue: isAndroid ? -5 : -10,
          duration: isAndroid ? 1600 : 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatY, {
          toValue: 0,
          duration: isAndroid ? 1600 : 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    floatLoop.start();

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1400,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.35,
          duration: 1400,
          useNativeDriver: true,
        }),
      ])
    );
    pulseLoop.start();

    return () => {
      floatLoop.stop();
      pulseLoop.stop();
    };
  }, [fadeLogo, scaleLogo, floatY, fadeText, fadeBtn, pulse, isAndroid]);

  const handleStart = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onStart?.();
  };

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top + (isAndroid ? 8 : 0),
          paddingBottom: Math.max(insets.bottom, isAndroid ? 16 : 24) + 12,
        },
      ]}
    >
      <StatusBar style="dark" />

      <View style={styles.stage}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.halo,
            {
              width: logoSize * 1.08,
              height: logoSize * 1.08,
              borderRadius: logoSize,
              opacity: pulse,
              transform: [
                {
                  scale: pulse.interpolate({
                    inputRange: [0.35, 1],
                    outputRange: [0.94, 1.06],
                  }),
                },
              ],
            },
          ]}
        />

        <Animated.View
          style={{
            opacity: fadeLogo,
            transform: [{ scale: scaleLogo }, { translateY: floatY }],
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Image
            source={require('../../assets/splash-accueil.png')}
            style={{ width: logoSize, height: logoSize }}
            resizeMode="contain"
          />
        </Animated.View>
      </View>

      <Animated.View style={[styles.copyBlock, { opacity: fadeText }]}>
        <Text style={styles.kicker}>{t('branding.kicker')}</Text>
        <Text style={styles.subtitle}>{t('branding.subtitle')}</Text>
      </Animated.View>

      <Animated.View style={{ opacity: fadeBtn, width: '100%', paddingHorizontal: isAndroid ? 24 : 36 }}>
        <TouchableOpacity
          style={[styles.cta, isAndroid && styles.ctaAndroid]}
          activeOpacity={0.85}
          onPress={handleStart}
          accessibilityRole="button"
          accessibilityLabel={t('branding.cta')}
        >
          <Text style={styles.ctaText}>{t('branding.cta')}</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  stage: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
    backgroundColor: 'rgba(6, 102, 140, 0.1)',
  },
  copyBlock: {
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 20,
    paddingHorizontal: 24,
  },
  kicker: {
    fontSize: 13,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: '#06668C',
    fontWeight: '700',
    marginBottom: 6,
    includeFontPadding: false,
  },
  subtitle: {
    fontSize: 16,
    color: '#374151',
    textAlign: 'center',
    fontWeight: '500',
    includeFontPadding: false,
  },
  cta: {
    backgroundColor: '#06668C',
    paddingVertical: 16,
    borderRadius: 28,
    alignItems: 'center',
    shadowColor: '#06668C',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  ctaAndroid: {
    borderRadius: 10,
    elevation: 3,
    minHeight: 52,
    justifyContent: 'center',
  },
  ctaText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
    includeFontPadding: false,
  },
});
