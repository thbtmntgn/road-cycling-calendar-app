import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const NoConnection: React.FC = () => {
  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Ionicons name="bicycle" size={60} color="#666666" />
        <Ionicons 
          name="close-circle" 
          size={30} 
          color="#e74c3c" 
          style={styles.errorIcon} 
        />
      </View>
      <Text style={styles.title}>No Internet Connection</Text>
      <Text style={styles.message}>
        Check your connection and try again
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111111',
    padding: 20,
  },
  iconContainer: {
    position: 'relative',
    marginBottom: 20,
  },
  errorIcon: {
    position: 'absolute',
    bottom: 0,
    right: -5,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 10,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: '#999999',
    textAlign: 'center',
  },
});

export default NoConnection;