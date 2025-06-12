import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../constants/theme';

// Ikon türleri
type IconType = 'MaterialCommunityIcons' | 'FontAwesome5' | 'AntDesign' | 'Ionicons';

// Komponent props
interface IconWithFallbackProps {
  type: IconType;
  name: string;
  size: number;
  color: string;
  style?: any;
}

// Yedek ikonlar - ikon bulunamazsa, bu ikonlar kullanılacak
const defaultIcons: Record<string, string> = {
  kaaba: "🕋",  // Kabe emoji
  fire: "🔥",   // Ateş emoji
  'hands-wash': "💧", // Su damlası
  tshirt: "👕",  // Tişört emoji
  broom: "🧹",   // Süpürge emoji
  compass: "🧭",  // Pusula emoji
  star: "⭐",    // Yıldız emoji
  'star-half-alt': "✨", // Parlama emoji
  check: "✓",    // Onay işareti
  heart: "❤️",    // Kalp emoji
  pray: "🙏",    // Dua eden eller emoji  
  book: "📚",    // Kitap emoji
  sync: "🔄",    // Yenileme emoji
  location: "📍",  // Konum iğnesi emoji
  'map-marker-alt': "📍",  // Konum iğnesi emoji
};

export const IconWithFallback: React.FC<IconWithFallbackProps> = ({ 
  type, 
  name, 
  size, 
  color,
  style
}) => {
  // Emoji ile yedek ikon göster (basit, güvenilir çözüm)
  const fallbackIcon = defaultIcons[name] || "?";
  
  return (
    <View style={styles.container}>
      <View style={[styles.fallbackIcon, { width: size, height: size, borderColor: color }]}>
        <Text style={[styles.fallbackText, { color, fontSize: size * 0.6 }]}>{fallbackIcon}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackIcon: {
    borderWidth: 1,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
  },
  fallbackText: {
    fontWeight: 'bold',
  },
}); 