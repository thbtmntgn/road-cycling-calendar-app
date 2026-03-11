import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer } from '@react-navigation/native';
import CalendarScreen from '../screens/CalendarScreen';
import RaceDetailScreen from '../screens/RaceDetailScreen';
import { CalendarStackParamList } from './types';

const CalendarStack = createNativeStackNavigator<CalendarStackParamList>();

const stackScreenOptions = {
  headerStyle: { backgroundColor: '#111111' },
  headerTintColor: '#ffffff',
  contentStyle: { backgroundColor: '#1a1a1a' },
};

function CalendarStackNavigator() {
  return (
    <CalendarStack.Navigator screenOptions={stackScreenOptions}>
      <CalendarStack.Screen
        name="Calendar"
        component={CalendarScreen}
        options={{ headerShown: false }}
      />
      <CalendarStack.Screen
        name="RaceDetail"
        component={RaceDetailScreen}
        options={{ title: '', headerBackTitle: 'Calendar', headerTitleAlign: 'center' }}
      />
    </CalendarStack.Navigator>
  );
}

const AppNavigator = () => {
  return (
    <NavigationContainer>
      <CalendarStackNavigator />
    </NavigationContainer>
  );
};

export default AppNavigator;
