import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import CalendarScreen from '../screens/CalendarScreen';
import FavoritesScreen from '../screens/FavoritesScreen';
import RaceDetailScreen from '../screens/RaceDetailScreen';
import { CalendarStackParamList, FavoritesStackParamList } from './types';

const CalendarStack = createNativeStackNavigator<CalendarStackParamList>();
const FavoritesStack = createNativeStackNavigator<FavoritesStackParamList>();
const Tab = createBottomTabNavigator();

const stackScreenOptions = {
  headerStyle: { backgroundColor: '#111111' },
  headerTintColor: '#ffffff',
  contentStyle: { backgroundColor: '#1a1a1a' },
};

function CalendarStackNavigator() {
  return (
    <CalendarStack.Navigator screenOptions={stackScreenOptions}>
      <CalendarStack.Screen
        name="CalendarMain"
        component={CalendarScreen}
        options={{ title: 'Race Calendar' }}
      />
      <CalendarStack.Screen
        name="RaceDetail"
        component={RaceDetailScreen}
        options={{ title: '' }}
      />
    </CalendarStack.Navigator>
  );
}

function FavoritesStackNavigator() {
  return (
    <FavoritesStack.Navigator screenOptions={stackScreenOptions}>
      <FavoritesStack.Screen
        name="FavoritesMain"
        component={FavoritesScreen}
        options={{ title: 'My Favorites' }}
      />
      <FavoritesStack.Screen
        name="RaceDetail"
        component={RaceDetailScreen}
        options={{ title: '' }}
      />
    </FavoritesStack.Navigator>
  );
}

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
          headerShown: false,
        }}
      >
        <Tab.Screen
          name="Calendar"
          component={CalendarStackNavigator}
          options={{
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="calendar" color={color} size={size} />
            ),
          }}
        />
        <Tab.Screen
          name="Favorites"
          component={FavoritesStackNavigator}
          options={{
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
