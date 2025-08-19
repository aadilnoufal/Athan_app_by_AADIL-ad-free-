import { Tabs } from 'expo-router';
import { useColorScheme, View, Dimensions, StyleSheet } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useState } from 'react';
import { SepiaColors } from '../../constants/sepiaColors';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  
  // Dynamic screen dimensions that update on orientation change
  const [screenData, setScreenData] = useState(Dimensions.get('window'));
  
  useEffect(() => {
    const onChange = (result: { window: any }) => {
      setScreenData(result.window);
    };
    
    const subscription = Dimensions.addEventListener('change', onChange);
    return () => subscription?.remove();
  }, []);
  
  // Get current screen dimensions for responsive design
  const { width, height } = screenData;
  const isLandscape = width > height;
  const isTablet = width >= 768; // Consider tablets as devices with width >= 768
  const isSmallScreen = width < 375; // Small phones like iPhone SE
  const isLargeScreen = width >= 414; // Large phones like iPhone Pro Max
  
  // Calculate optimized responsive values
  const getTabBarHeight = () => {
    // Base height plus safe area insets for proper spacing
    let baseHeight = 0;
    if (isTablet) baseHeight = isLandscape ? 60 : 75;
    else if (isLargeScreen) baseHeight = isLandscape ? 55 : 65;
    else if (isSmallScreen) baseHeight = isLandscape ? 45 : 55;
    else baseHeight = isLandscape ? 50 : 60;
    
    // Add bottom inset to ensure tab bar is above system navigation
    return baseHeight + (insets?.bottom || 0);
  };
  
  const getIconSize = () => {
    if (isTablet) return isLandscape ? 26 : 30;
    if (isLargeScreen) return isLandscape ? 22 : 26;
    if (isSmallScreen) return isLandscape ? 18 : 22;
    return isLandscape ? 20 : 24;
  };
  
  const getFontSize = () => {
    if (isTablet) return isLandscape ? 13 : 15;
    if (isLargeScreen) return isLandscape ? 11 : 13;
    if (isSmallScreen) return isLandscape ? 9 : 11;
    return isLandscape ? 10 : 12;
  };
  
  const getPadding = () => {
    // Optimize padding values to reduce unused space
    if (isTablet) return { top: isLandscape ? 6 : 12, bottom: isLandscape ? 6 : 12 }; // Reduced padding
    if (isLargeScreen) return { top: isLandscape ? 4 : 10, bottom: isLandscape ? 4 : 10 }; // Reduced padding
    if (isSmallScreen) return { top: isLandscape ? 2 : 4, bottom: isLandscape ? 2 : 4 }; // Reduced padding
    return { top: isLandscape ? 3 : 8, bottom: isLandscape ? 3 : 8 }; // Reduced padding
  };

  const padding = getPadding();

  return (
    <View style={styles.container}>
      <Tabs
        screenOptions={{
          headerShown: false, // This hides the header for all tab screens
          tabBarActiveTintColor: SepiaColors.accent.gold, // Gold for active tabs
          tabBarInactiveTintColor: SepiaColors.text.secondary, // Elegant muted color for inactive tabs
          tabBarStyle: {
            backgroundColor: SepiaColors.surface.elevated, // Use sepia surface color instead of transparent
            borderTopColor: SepiaColors.border.accent, // Light gold border
            borderTopWidth: 0.5,
            height: getTabBarHeight(), // Height includes safe area insets
            paddingTop: padding.top,
            paddingBottom: Math.max(padding.bottom, 8), // Minimum padding for tap targets
            paddingHorizontal: isTablet ? 16 : isSmallScreen ? 2 : 6,
            // Ensure proper positioning above system navigation
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            // Soft sepia shadow
            shadowColor: SepiaColors.shadow.light,
            shadowOffset: { width: 0, height: -1 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            elevation: 3,
          },
          tabBarLabelStyle: {
            fontSize: getFontSize(),
            fontWeight: '600', // Slightly bolder for better readability
            marginTop: isSmallScreen ? 1 : 2, // Reduced label spacing
            letterSpacing: 0.3, // Add elegant letter spacing
          },
          tabBarIconStyle: {
            marginBottom: isSmallScreen ? 0 : -2, // Adjusted icon position
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Prayer Times',
            headerShown: false, // Explicitly hiding the header for this screen
            tabBarIcon: ({ color }) => <TabBarIcon name="clock-o" color={color} iconSize={getIconSize()} />,
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Settings',
            headerShown: false, // Explicitly hiding the header for this screen
            tabBarIcon: ({ color }) => <TabBarIcon name="cog" color={color} iconSize={getIconSize()} />,
          }}
        />
      </Tabs>
    </View>
  );
}

function TabBarIcon(props: { 
  name: React.ComponentProps<typeof FontAwesome>['name']; 
  color: string; 
  iconSize: number;
}) {
  const { iconSize, ...restProps } = props;
  return <FontAwesome size={iconSize} style={{ marginBottom: -2 }} {...restProps} />; // Adjusted icon margin
}

// Styles for optimal tab bar positioning
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SepiaColors.background.primary, // Match background color to avoid visual gaps
    paddingBottom: 0, // Let the tab bar handle its own positioning
  }
});
