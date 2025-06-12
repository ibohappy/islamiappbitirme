import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { COLORS, SPACING } from '../../constants/theme';

export function ChatListScreen() {
  const navigation = useNavigation();

  useEffect(() => {
    // Kısa bir bekleme süresi sonra ImamAIScreen'e yönlendir
    const timer = setTimeout(() => {
      navigation.reset({
        index: 0,
        routes: [{ name: 'ImamAIScreen' }],
      });
    }, 300);
    
    return () => clearTimeout(timer);
  }, [navigation]);

  return (
    <SafeAreaView style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={COLORS.primary} />
      <Text style={styles.loadingText}>Yükleniyor...</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: 16,
    color: COLORS.text,
  },
}); 