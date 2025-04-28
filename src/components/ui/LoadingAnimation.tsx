import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

interface LoadingAnimationProps {
  size?: number | 'small' | 'large';
  color?: string;
}

export const LoadingAnimation: React.FC<LoadingAnimationProps> = ({ 
  size = 'large', 
  color = '#4CAF50' 
}) => {
  return (
    <View style={styles.container}>
      <ActivityIndicator size={size} color={color} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
}); 