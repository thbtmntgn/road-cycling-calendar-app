import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import AppNavigator from './src/navigation/AppNavigator';
import { useFavoritesStore } from './src/store/favoritesStore';

export default function App() {
  // Get the loadFavorites function from the favorites store
  const { loadFavorites } = useFavoritesStore();
  
  // Load favorites on app start
  useEffect(() => {
    loadFavorites();
  }, [loadFavorites]);
  
  return (
    <>
      <StatusBar style="light" />
      <AppNavigator />
    </>
  );
}