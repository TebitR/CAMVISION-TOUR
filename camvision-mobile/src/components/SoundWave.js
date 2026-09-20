import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';

const BARS = [0.35, 0.7, 1, 0.55, 0.85, 0.45, 0.9];

/** Onde sonore animée pendant la lecture. */
export default function SoundWave({ active, color = '#6ee7b7' }) {
  const anims = useRef(BARS.map(() => new Animated.Value(0.3))).current;

  useEffect(() => {
    const loops = anims.map((val, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(val, {
            toValue: BARS[i],
            duration: 280 + i * 40,
            useNativeDriver: true,
          }),
          Animated.timing(val, {
            toValue: 0.25,
            duration: 280 + i * 40,
            useNativeDriver: true,
          }),
        ])
      )
    );
    if (active) loops.forEach((l) => l.start());
    else anims.forEach((v) => v.setValue(0.28));
    return () => loops.forEach((l) => l.stop());
  }, [active, anims]);

  return (
    <View style={styles.row}>
      {anims.map((val, i) => (
        <Animated.View
          key={i}
          style={[
            styles.bar,
            {
              backgroundColor: color,
              opacity: active ? 1 : 0.35,
              transform: [{ scaleY: val }],
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 22,
    gap: 3,
  },
  bar: {
    width: 3,
    height: 18,
    borderRadius: 2,
  },
});
