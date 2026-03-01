import React from 'react';
import { Animated, Easing } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface AnimatedPrayerIconProps {
  prayer: string;
  active: boolean;
  size?: number;
  color: string;
  subtle?: boolean;
}

/**
 * Animated prayer icon component (supports subtle mode for countdown center).
 * Standalone — no dependency on Home state.
 */
const AnimatedPrayerIcon = ({ prayer, active, size = 24, color, subtle = false }: AnimatedPrayerIconProps) => {
  const scale = React.useRef(new Animated.Value(1)).current;
  const rotate = React.useRef(new Animated.Value(0)).current;
  const isSolar = prayer === 'Sunrise' || prayer === 'Dhuhr' || prayer === 'Asr';

  React.useEffect(() => {
    scale.stopAnimation();
    rotate.stopAnimation();

    // Subtle mode: keep icon still (outer container may already have breathing animation)
    if (subtle) {
      scale.setValue(1);
      rotate.setValue(0);
      return;
    }

    // Reduced pulse magnitude overall
    const from = 1;
    const to = active ? 1.10 : 1.04;
    Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: to, duration: active ? 1400 : 2000, useNativeDriver: true, easing: Easing.inOut(Easing.quad) }),
        Animated.timing(scale, { toValue: from, duration: active ? 1400 : 2000, useNativeDriver: true, easing: Easing.inOut(Easing.quad) })
      ])
    ).start();

    // Further slow rotation
    if (isSolar) {
      Animated.loop(
        Animated.timing(rotate, { toValue: 1, duration: active ? 16000 : 22000, useNativeDriver: true, easing: Easing.linear })
      ).start();
    } else if (prayer === 'Isha' || prayer === 'Maghrib') {
      Animated.loop(
        Animated.timing(rotate, { toValue: 1, duration: active ? 24000 : 32000, useNativeDriver: true, easing: Easing.linear })
      ).start();
    } else {
      rotate.setValue(0);
    }
  }, [prayer, active, isSolar, subtle]);

  const rotation = rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const iconName = (
    prayer === 'Fajr' ? 'weather-sunset-up' :
      prayer === 'Sunrise' ? 'white-balance-sunny' :
        prayer === 'Dhuhr' ? 'sun-wireless' :
          prayer === 'Asr' ? 'weather-sunny' :
            prayer === 'Maghrib' ? 'weather-sunset-down' :
              'weather-night'
  );

  const transforms: any[] = subtle ? [] : [{ scale }];
  if (!subtle && isSolar) transforms.push({ rotate: rotation });

  return (
    <Animated.View style={{ transform: transforms }}>
      <MaterialCommunityIcons name={iconName as any} size={size} color={color} />
    </Animated.View>
  );
};

export default AnimatedPrayerIcon;
