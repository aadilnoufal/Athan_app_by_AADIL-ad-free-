import { Tabs } from 'expo-router';
import { useColorScheme } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <Tabs
      screenOptions={{
        headerShown: false, // This hides the header for all tab screens
        tabBarActiveTintColor: '#FFD700', // Gold color for active tabs to match the app theme
        tabBarInactiveTintColor: '#AAAAAA', // Light gray for inactive tabs
        tabBarStyle: {
          backgroundColor: '#1E1E1E', // Dark background to match the app's dark theme
          borderTopColor: 'rgba(255, 215, 0, 0.1)', // Subtle gold border like other elements
          borderTopWidth: 1,
          height: 60, // Make tab bar slightly smaller
          paddingBottom: 8, // Add some bottom padding for icons
          paddingTop: 8, // Add some top padding
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Prayer Times',
          headerShown: false, // Explicitly hiding the header for this screen
          tabBarIcon: ({ color }) => <TabBarIcon name="clock-o" color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          headerShown: false, // Explicitly hiding the header for this screen
          tabBarIcon: ({ color }) => <TabBarIcon name="cog" color={color} />,
        }}
      />
    </Tabs>
  );
}

function TabBarIcon(props: { name: string; color: string }) {
  return <FontAwesome size={24} style={{ marginBottom: -3 }} {...props} />;
}
