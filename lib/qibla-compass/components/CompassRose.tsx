/**
 * CompassRose Component
 * 
 * Displays a compass rose with cardinal directions and degree markers.
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import Svg, { Circle, Line, Text as SvgText, G } from 'react-native-svg';

interface CompassRoseProps {
  /** Size of the compass (width and height) */
  size?: number;
  /** Current rotation in degrees */
  rotation?: number;
  /** Primary color for cardinal directions */
  primaryColor?: string;
  /** Secondary color for intermediate directions */
  secondaryColor?: string;
  /** Background color */
  backgroundColor?: string;
  /** Text color */
  textColor?: string;
  /** North indicator color */
  northColor?: string;
  /** Whether to show degree markers */
  showDegrees?: boolean;
  /** Whether to show intermediate directions (NE, SE, SW, NW) */
  showIntermediateDirections?: boolean;
  /** Container style */
  style?: ViewStyle;
}

export const CompassRose: React.FC<CompassRoseProps> = ({
  size = 280,
  rotation = 0,
  primaryColor = '#D4AF37',
  secondaryColor = '#888888',
  backgroundColor = '#1a1a1a',
  textColor = '#FFFFFF',
  northColor = '#FF4444',
  showDegrees = true,
  showIntermediateDirections = true,
  style,
}) => {
  const center = size / 2;
  const radius = size / 2 - 20;
  const innerRadius = radius - 30;
  const tickRadius = radius - 8;

  // Generate degree markers
  const degreeMarkers = useMemo(() => {
    const markers = [];
    for (let i = 0; i < 360; i += 30) {
      const angle = (i - 90) * (Math.PI / 180);
      const x1 = center + (tickRadius - 10) * Math.cos(angle);
      const y1 = center + (tickRadius - 10) * Math.sin(angle);
      const x2 = center + tickRadius * Math.cos(angle);
      const y2 = center + tickRadius * Math.sin(angle);
      
      const textX = center + (innerRadius - 15) * Math.cos(angle);
      const textY = center + (innerRadius - 15) * Math.sin(angle);

      markers.push({
        degree: i,
        x1,
        y1,
        x2,
        y2,
        textX,
        textY,
      });
    }
    return markers;
  }, [center, tickRadius, innerRadius]);

  // Small tick marks
  const smallTicks = useMemo(() => {
    const ticks = [];
    for (let i = 0; i < 360; i += 10) {
      if (i % 30 !== 0) {
        const angle = (i - 90) * (Math.PI / 180);
        const x1 = center + (tickRadius - 5) * Math.cos(angle);
        const y1 = center + (tickRadius - 5) * Math.sin(angle);
        const x2 = center + tickRadius * Math.cos(angle);
        const y2 = center + tickRadius * Math.sin(angle);
        ticks.push({ x1, y1, x2, y2, key: i });
      }
    }
    return ticks;
  }, [center, tickRadius]);

  // Cardinal directions
  const cardinalDirections = useMemo(() => {
    const directions = [
      { label: 'N', degree: 0, color: northColor },
      { label: 'E', degree: 90, color: primaryColor },
      { label: 'S', degree: 180, color: primaryColor },
      { label: 'W', degree: 270, color: primaryColor },
    ];

    return directions.map((dir) => {
      const angle = (dir.degree - 90) * (Math.PI / 180);
      const x = center + (innerRadius + 5) * Math.cos(angle);
      const y = center + (innerRadius + 5) * Math.sin(angle);
      return { ...dir, x, y };
    });
  }, [center, innerRadius, primaryColor, northColor]);

  // Intermediate directions
  const intermediateDirections = useMemo(() => {
    if (!showIntermediateDirections) return [];

    const directions = [
      { label: 'NE', degree: 45 },
      { label: 'SE', degree: 135 },
      { label: 'SW', degree: 225 },
      { label: 'NW', degree: 315 },
    ];

    return directions.map((dir) => {
      const angle = (dir.degree - 90) * (Math.PI / 180);
      const x = center + (innerRadius - 5) * Math.cos(angle);
      const y = center + (innerRadius - 5) * Math.sin(angle);
      return { ...dir, x, y };
    });
  }, [center, innerRadius, showIntermediateDirections]);

  return (
    <View style={[styles.container, { width: size, height: size }, style]}>
      <Svg width={size} height={size}>
        {/* Background circle */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          fill={backgroundColor}
          stroke={primaryColor}
          strokeWidth={2}
          opacity={0.3}
        />

        {/* Inner decorative circle */}
        <Circle
          cx={center}
          cy={center}
          r={innerRadius}
          fill="none"
          stroke={secondaryColor}
          strokeWidth={1}
          opacity={0.3}
        />

        {/* Rotating group */}
        <G rotation={rotation} origin={`${center}, ${center}`}>
          {/* Small tick marks */}
          {smallTicks.map((tick) => (
            <Line
              key={tick.key}
              x1={tick.x1}
              y1={tick.y1}
              x2={tick.x2}
              y2={tick.y2}
              stroke={secondaryColor}
              strokeWidth={1}
              opacity={0.5}
            />
          ))}

          {/* Degree markers */}
          {showDegrees &&
            degreeMarkers.map((marker) => (
              <G key={marker.degree}>
                <Line
                  x1={marker.x1}
                  y1={marker.y1}
                  x2={marker.x2}
                  y2={marker.y2}
                  stroke={marker.degree === 0 ? northColor : secondaryColor}
                  strokeWidth={marker.degree % 90 === 0 ? 2 : 1}
                />
                {marker.degree % 90 !== 0 && (
                  <SvgText
                    x={marker.textX}
                    y={marker.textY}
                    fill={textColor}
                    fontSize={10}
                    textAnchor="middle"
                    alignmentBaseline="middle"
                    opacity={0.6}
                  >
                    {marker.degree}
                  </SvgText>
                )}
              </G>
            ))}

          {/* Cardinal directions */}
          {cardinalDirections.map((dir) => (
            <SvgText
              key={dir.label}
              x={dir.x}
              y={dir.y}
              fill={dir.color}
              fontSize={dir.label === 'N' ? 22 : 18}
              fontWeight="bold"
              textAnchor="middle"
              alignmentBaseline="middle"
            >
              {dir.label}
            </SvgText>
          ))}

          {/* Intermediate directions */}
          {intermediateDirections.map((dir) => (
            <SvgText
              key={dir.label}
              x={dir.x}
              y={dir.y}
              fill={secondaryColor}
              fontSize={12}
              textAnchor="middle"
              alignmentBaseline="middle"
            >
              {dir.label}
            </SvgText>
          ))}

          {/* North indicator triangle */}
          <G>
            <Line
              x1={center}
              y1={center - innerRadius + 35}
              x2={center - 8}
              y2={center - innerRadius + 55}
              stroke={northColor}
              strokeWidth={2}
            />
            <Line
              x1={center}
              y1={center - innerRadius + 35}
              x2={center + 8}
              y2={center - innerRadius + 55}
              stroke={northColor}
              strokeWidth={2}
            />
          </G>
        </G>

        {/* Center point */}
        <Circle cx={center} cy={center} r={4} fill={primaryColor} />
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
