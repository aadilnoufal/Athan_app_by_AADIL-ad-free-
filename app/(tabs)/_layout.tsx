import { Tabs } from 'expo-router';
import { useColorScheme, View, Dimensions } from 'react-native';
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
  
  // Calculate responsive values
  const getTabBarHeight = () => {
    if (isTablet) return isLandscape ? 70 : 85;
    if (isLargeScreen) return isLandscape ? 65 : 75;
    if (isSmallScreen) return isLandscape ? 50 : 60;
    return isLandscape ? 60 : 70;
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
    if (isTablet) return { top: isLandscape ? 8 : 15, bottom: isLandscape ? 8 : 15 };
    if (isLargeScreen) return { top: isLandscape ? 6 : 12, bottom: isLandscape ? 6 : 12 };
    if (isSmallScreen) return { top: isLandscape ? 2 : 6, bottom: isLandscape ? 2 : 6 };
    return { top: isLandscape ? 4 : 10, bottom: isLandscape ? 4 : 10 };
  };

  const padding = getPadding();

  return (
    <>
      {/* Status bar background for edge-to-edge - sepia theme */}
      <View 
        style={{ 
          height: insets.top, 
          backgroundColor: SepiaColors.background.primary
        }} 
      />
      <Tabs
        screenOptions={{
          headerShown: false, // This hides the header for all tab screens
          tabBarActiveTintColor: SepiaColors.accent.gold, // Gold for active tabs
          tabBarInactiveTintColor: SepiaColors.text.tertiary, // Muted brown for inactive tabs
          tabBarStyle: {
            backgroundColor: SepiaColors.surface.elevated, // Light sepia background
            borderTopColor: SepiaColors.border.medium, // Subtle brown border
            borderTopWidth: 1,
            height: getTabBarHeight(), // Responsive height based on device
            paddingBottom: padding.bottom + (insets.bottom > 0 ? Math.min(insets.bottom / 2, 8) : 0), // Adaptive bottom padding
            paddingTop: padding.top,
            paddingHorizontal: isTablet ? 20 : isSmallScreen ? 4 : 8, // Responsive horizontal padding
            // Add shadow for better visual separation with sepia tones
            shadowColor: SepiaColors.shadow.medium,
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.3,
            shadowRadius: 4,
            elevation: 5, // Android shadow
          },
          tabBarLabelStyle: {
            fontSize: getFontSize(),
            fontWeight: '500',
            marginTop: isSmallScreen ? 2 : 4, // Adjust label spacing
          },
          tabBarIconStyle: {
            marginBottom: isSmallScreen ? -1 : -3, // Adjust icon position
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
    </>
  );
}

function TabBarIcon(props: { 
  name: React.ComponentProps<typeof FontAwesome>['name']; 
  color: string; 
  iconSize: number;
}) {
  const { iconSize, ...restProps } = props;
  return <FontAwesome size={iconSize} style={{ marginBottom: -3 }} {...restProps} />;
}
