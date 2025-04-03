import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import CalendarScreen from '../screens/CalendarScreen';
import FavoritesScreen from '../screens/FavoritesScreen';

// Define the navigator parameter list
type TabParamList = {
  Calendar: undefined;
  Favorites: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();

const AppNavigator = () => {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          tabBarActiveTintColor: '#ffffff',
          tabBarInactiveTintColor: '#888888',
          tabBarStyle: {
            backgroundColor: '#1a1a1a',
            borderTopColor: '#333333',
            borderTopWidth: 1,
            paddingBottom: 5,
            paddingTop: 5,
          },
          headerStyle: {
            backgroundColor: '#111111',
            shadowColor: '#333333',
          },
          headerTintColor: '#ffffff',
        }}
      >
        <Tab.Screen
          name="Calendar"
          component={CalendarScreen}
          options={{
            title: 'Race Calendar',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="calendar" color={color} size={size} />
            ),
          }}
        />
        <Tab.Screen
          name="Favorites"
          component={FavoritesScreen}
          options={{
            title: 'My Favorites',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="star" color={color} size={size} />
            ),
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;