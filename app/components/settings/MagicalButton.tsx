/**
 * MagicalButton
 *
 * A theme-aware pressable card/button used throughout Settings (and potentially
 * other screens). Accepts children, an optional glow color, and forwards
 * standard TouchableOpacity props.
 */
import React from 'react';
import { TouchableOpacity, ViewStyle, StyleProp } from 'react-native';
import { useTheme } from '../../../contexts/ThemeContext';

interface MagicalButtonProps {
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
  /** Border glow tint — defaults to theme accent gold */
  glowColor?: string;
}

export const MagicalButton: React.FC<MagicalButtonProps> = ({
  onPress,
  disabled = false,
  style,
  children,
  glowColor,
}) => {
  const { isDark, colors } = useTheme();
  const glow = glowColor ?? colors.accent.gold;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[
        {
          backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
          borderWidth: 0.5,
          borderColor: `${glow}30`,
          borderRadius: 16,
          overflow: 'hidden',
        },
        style,
      ]}
      activeOpacity={0.8}
    >
      {children}
    </TouchableOpacity>
  );
};

export default MagicalButton;
