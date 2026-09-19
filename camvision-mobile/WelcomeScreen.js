import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Animated,
  Easing,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

const { width } = Dimensions.get('window');

export default function WelcomeScreen({ onContinue }) {
  const fadeLogo = useRef(new Animated.Value(0)).current;
  const scaleLogo = useRef(new Animated.Value(0.82)).current;
  const floatY = useRef(new Animated.Value(0)).current;
  const fadeText = useRef(new Animated.Value(0)).current;
  const fadeBtn = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0.4)).current;
  const pinDrop = useRef(new Animated.Value(-24)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
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
        Animated.timing(pinDrop, {
          toValue: 0,
          duration: 700,
          delay: 200,
          useNativeDriver: true,
          easing: Easing.out(Easing.back(1.4)),
        }),
      ]),
      Animated.timing(fadeText, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(fadeBtn, {
        toValue: 1,
        duration: 450,
        useNativeDriver: true,
      }),
    ]).start();

    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatY, {
          toValue: -10,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatY, {
          toValue: 0,
          duration: 1800,
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
  }, [fadeLogo, scaleLogo, floatY, fadeText, fadeBtn, pulse, pinDrop]);

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      {/* Halo touristique doux */}
      <Animated.View
        style={[
          styles.halo,
          {
            opacity: pulse,
            transform: [{ scale: pulse.interpolate({ inputRange: [0.35, 1], outputRange: [0.92, 1.08] }) }],
          },
        ]}
      />

      {/* Points de destination décoratifs */}
      <Animated.View style={[styles.pin, styles.pinLeft, { opacity: pulse, transform: [{ translateY: pinDrop }] }]} />
      <Animated.View style={[styles.pin, styles.pinRight, { opacity: pulse }]} />

      <Animated.View
        style={{
          opacity: fadeLogo,
          transform: [{ scale: scaleLogo }, { translateY: floatY }],
          alignItems: 'center',
        }}
      >
        <Image
          source={require('./assets/splash-accueil.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>

      <Animated.View style={[styles.copyBlock, { opacity: fadeText }]}>
        <Text style={styles.kicker}>Votre guide culturel intelligent</Text>
        <Text style={styles.subtitle}>Explorez le Cameroun autrement</Text>
      </Animated.View>

      <Animated.View style={{ opacity: fadeBtn, width: '100%', paddingHorizontal: 36 }}>
        <TouchableOpacity style={styles.cta} activeOpacity={0.85} onPress={onContinue}>
          <Text style={styles.ctaText}>Commencer l'aventure</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 40,
  },
  halo: {
    position: 'absolute',
    width: width * 0.72,
    height: width * 0.72,
    borderRadius: width,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
  },
  pin: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#d4a017',
  },
  pinLeft: {
    top: '28%',
    left: '14%',
  },
  pinRight: {
    top: '34%',
    right: '16%',
    backgroundColor: '#059669',
  },
  logo: {
    width: width * 0.82,
    height: width * 0.82,
    maxWidth: 360,
    maxHeight: 360,
  },
  copyBlock: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 28,
    paddingHorizontal: 24,
  },
  kicker: {
    fontSize: 13,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: '#059669',
    fontWeight: '600',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 16,
    color: '#374151',
    textAlign: 'center',
    fontWeight: '500',
  },
  cta: {
    backgroundColor: '#047857',
    paddingVertical: 16,
    borderRadius: 28,
    alignItems: 'center',
    shadowColor: '#047857',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  ctaText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
