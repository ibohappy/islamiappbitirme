import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  useWindowDimensions,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio, AVPlaybackStatus, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';
import { MaterialCommunityIcons, FontAwesome5, Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SPACING } from '../../constants/theme';
import { SurahData, getDailySurahs, resetDailySurahs } from '../../services/quranService';
import { LoadingAnimation } from '../../components/ui/LoadingAnimation';
import { updateDailySurahCompletion } from '../../services/streakService';

// Tamamlanan sureler için AsyncStorage anahtarı
const COMPLETED_SURAHS_KEY = 'completed_surahs';

export function DailySurahsScreen() {
  const [surahs, setSurahs] = useState<SurahData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [playingSurahId, setPlayingSurahId] = useState<number | null>(null);
  const [isLoadingAudio, setIsLoadingAudio] = useState<number | null>(null);
  const [completedSurahs, setCompletedSurahs] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { width } = useWindowDimensions();

  // Tamamlanan sureleri yükle
  const loadCompletedSurahs = async () => {
    try {
      const storedSurahs = await AsyncStorage.getItem(COMPLETED_SURAHS_KEY);
      if (storedSurahs) {
        const parsedSurahs = JSON.parse(storedSurahs);
        setCompletedSurahs(parsedSurahs);
      }
    } catch (error) {
      console.error('Tamamlanan sureler yüklenirken hata oluştu:', error);
    }
  };

  // Sureleri yükle
  const loadSurahs = async (forceRefresh = false) => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Eğer zorla yenileme isteniyorsa, önce sureleri sıfırla
      if (forceRefresh) {
        await resetDailySurahs();
        // Tamamlanan sureleri de sıfırla
        await AsyncStorage.setItem(COMPLETED_SURAHS_KEY, JSON.stringify([]));
        setCompletedSurahs([]);
      }
      
      const dailySurahs = await getDailySurahs();
      
      if (!dailySurahs || dailySurahs.length === 0) {
        setError('Sureler yüklenemedi. Lütfen internet bağlantınızı kontrol edin ve tekrar deneyin.');
        setIsLoading(false);
        setRefreshing(false);
        return;
      }
      
      setSurahs(dailySurahs);
      
      // Tamamlanan sureleri yükle
      await loadCompletedSurahs();
    } catch (error) {
      console.error('Sureler yüklenirken hata oluştu:', error);
      setError('Sureler yüklenirken bir hata oluştu. Lütfen tekrar deneyin.');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  // Ekran odaklandığında sureleri yükle
  useFocusEffect(
    useCallback(() => {
      // Sureleri yükle
      loadSurahs();
      
      // Temizlik fonksiyonu
      return () => {
        if (sound) {
          sound.unloadAsync();
          setSound(null);
          setPlayingSurahId(null);
        }
      };
    }, [])
  );

  // Yenileme işlemi
  const onRefresh = () => {
    setRefreshing(true);
    loadSurahs();
  };
  
  // Zorla yenileme işlemi
  const onForceRefresh = () => {
    Alert.alert(
      'Sureleri Yenile',
      'Yeni rastgele sureler görmek istiyor musunuz? Bu işlem tamamlanan sureleri de sıfırlayacaktır.',
      [
        {
          text: 'İptal',
          style: 'cancel',
        },
        {
          text: 'Evet',
          onPress: () => {
            setRefreshing(true);
            loadSurahs(true);
          },
        },
      ]
    );
  };

  // Ses modunu ayarla - bileşen yüklendiğinde çağrılsın
  useEffect(() => {
    const configureAudio = async () => {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
          interruptionModeIOS: InterruptionModeIOS.DuckOthers,
          interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });
      } catch (error) {
        console.error('Ses modu ayarlanırken hata oluştu:', error);
      }
    };

    configureAudio();
  }, []);

  // Ses çalma fonksiyonu
  const playSurah = async (surahId: number, audioUrl: string, hasAudio: boolean) => {
    try {
      // Eğer zaten bir ses çalıyorsa, durdur
      if (sound) {
        await sound.unloadAsync();
        setSound(null);
        
        // Eğer aynı sure tekrar çalınıyorsa, sadece durdur
        if (playingSurahId === surahId) {
          setPlayingSurahId(null);
          return;
        }
      }
      
      // Ses yükleniyor durumunu ayarla
      setIsLoadingAudio(surahId);
      
      try {
        console.log(`Ses dosyası yükleniyor: ${audioUrl}`);
        
        // Yeni ses yükle ve çal
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: audioUrl },
          { 
            shouldPlay: true,
            volume: 1.0 // Ses seviyesini maksimum yap
          }
        );
        
        console.log('Ses dosyası başarıyla yüklendi ve çalınıyor');
        
        setSound(newSound);
        setPlayingSurahId(surahId);
        setIsLoadingAudio(null);
        
        // Ses bittiğinde
        newSound.setOnPlaybackStatusUpdate((status: AVPlaybackStatus) => {
          if (status.isLoaded && status.didJustFinish) {
            console.log('Ses dosyası çalma tamamlandı');
            newSound.unloadAsync();
            setSound(null);
            setPlayingSurahId(null);
          }
        });
      } catch (error) {
        console.error('Ses dosyası yüklenemedi:', error);
        Alert.alert(
          'Ses Çalma Hatası',
          'Ses dosyası yüklenirken bir hata oluştu. Lütfen internet bağlantınızı kontrol edin.',
          [{ text: 'Tamam', style: 'default' }]
        );
        setIsLoadingAudio(null);
        setPlayingSurahId(null);
      }
    } catch (error) {
      console.error('Ses çalınırken hata oluştu:', error);
      setIsLoadingAudio(null);
      setPlayingSurahId(null);
    }
  };

  // Sure tamamlama işlemi
  const handleSurahCompletion = async (surahId: number, isCompleted: boolean) => {
    try {
      // Tamamlanan sureler dizisini kontrol et
      if (!completedSurahs || !Array.isArray(completedSurahs)) {
        // Eğer dizi yoksa veya array değilse, boş bir dizi oluştur
        console.log('completedSurahs geçerli bir dizi değil, yeni dizi oluşturuluyor');
        setCompletedSurahs([]);
        await AsyncStorage.setItem(COMPLETED_SURAHS_KEY, JSON.stringify([]));
      }
      
      // Eğer sure zaten tamamlanmışsa, işlemi iptal et
      const isSurahCompleted = completedSurahs && Array.isArray(completedSurahs) && completedSurahs.includes(surahId);
      if (isSurahCompleted && !isCompleted) {
        return;
      }
      
      const newCompletedSurahs = isCompleted 
        ? [...(Array.isArray(completedSurahs) ? completedSurahs : []), surahId]
        : Array.isArray(completedSurahs) ? completedSurahs : [];
      
      setCompletedSurahs(newCompletedSurahs);
      
      // Tamamlanan sure sayısını kaydet
      await AsyncStorage.setItem(COMPLETED_SURAHS_KEY, JSON.stringify(newCompletedSurahs));
      await AsyncStorage.setItem('completed_surahs_count', newCompletedSurahs.length.toString());
      
      // Streak servisini güncelle (en az 5 sure tamamlandıysa)
      await updateDailySurahCompletion(newCompletedSurahs.length >= 5);
      
      // Animasyon efekti
      if (isCompleted) {
        Alert.alert(
          'Sure Tamamlandı',
          `Tebrikler! ${newCompletedSurahs.length} sure tamamlandı. ${Math.max(0, 5 - newCompletedSurahs.length)} sure daha okuyarak günlük hedefinize ulaşabilirsiniz.`,
          [{ text: 'Tamam', style: 'default' }]
        );
      }
    } catch (error) {
      console.error('Sure durumu güncellenirken hata oluştu:', error);
      Alert.alert('Hata', 'Sure durumu güncellenirken bir sorun oluştu.');
    }
  };

  // Yükleniyor göstergesi
  if (isLoading && !refreshing) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <LoadingAnimation size={80} color={COLORS.primary} />
        <Text style={styles.loadingText}>Günlük Sureler Yükleniyor...</Text>
      </SafeAreaView>
    );
  }

  // Hata durumu göstergesi
  if (error) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <MaterialCommunityIcons name="alert-circle" size={50} color="#F44336" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => loadSurahs(true)}>
          <Text style={styles.retryButtonText}>Tekrar Dene</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
          />
        }
      >
        <View style={styles.header}>
          <Text style={styles.title}>Günlük Sureler</Text>
          <View style={styles.headerRight}>
            <Text style={styles.completionCount}>
              {Array.isArray(completedSurahs) ? completedSurahs.length : 0}/5 Sure
            </Text>
            <TouchableOpacity
              style={styles.refreshButton}
              onPress={onForceRefresh}
            >
              <MaterialCommunityIcons
                name="refresh"
                size={24}
                color={COLORS.primary}
              />
            </TouchableOpacity>
          </View>
        </View>

        {surahs.map((surah) => (
          <View key={surah.id} style={styles.surahCard}>
            <View style={styles.surahHeader}>
              <View style={styles.surahTitleContainer}>
                <Text style={styles.surahNameTr}>{surah.name_tr}</Text>
                <Text style={styles.surahNameAr}>{surah.name}</Text>
              </View>
              {surah.has_audio && (
                <TouchableOpacity
                  style={styles.audioButton}
                  onPress={() => playSurah(surah.id, surah.audio_url, true)}
                  disabled={isLoadingAudio === surah.id}
                >
                  {isLoadingAudio === surah.id ? (
                    <ActivityIndicator color={COLORS.primary} />
                  ) : (
                    <MaterialCommunityIcons
                      name={playingSurahId === surah.id ? "pause" : "play"}
                      size={28}
                      color={COLORS.primary}
                    />
                  )}
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.surahContent}>
              <Text style={styles.transcriptionText}>{surah.transcription_tr}</Text>
              <Text style={styles.translationText}>{surah.translation}</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.surahFooter}>
              <Text style={styles.surahDetails}>
                {surah.juz_number}. Cüz • {surah.verse_count} Ayet
              </Text>
              <TouchableOpacity
                style={[
                  styles.completionButton,
                  Array.isArray(completedSurahs) && completedSurahs.includes(surah.id) && styles.completionButtonActive
                ]}
                onPress={() => handleSurahCompletion(surah.id, !(Array.isArray(completedSurahs) && completedSurahs.includes(surah.id)))}
              >
                <View style={[
                  styles.checkbox,
                  Array.isArray(completedSurahs) && completedSurahs.includes(surah.id) && styles.checkboxActive
                ]}>
                  {Array.isArray(completedSurahs) && completedSurahs.includes(surah.id) && (
                    <Ionicons name="checkmark" size={16} color={COLORS.primary} />
                  )}
                </View>
                <Text style={[
                  styles.completionButtonText,
                  Array.isArray(completedSurahs) && completedSurahs.includes(surah.id) && styles.completionButtonTextActive
                ]}>
                  {Array.isArray(completedSurahs) && completedSurahs.includes(surah.id) ? "Okundu" : "Okunmadı"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scrollContent: {
    flexGrow: 1,
    padding: SPACING.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#212121',
  },
  completionCount: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.primary,
    marginRight: SPACING.md,
  },
  refreshButton: {
    padding: SPACING.sm,
  },
  surahCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  surahHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
  },
  surahTitleContainer: {
    flex: 1,
  },
  surahNameTr: {
    fontSize: 24,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 4,
  },
  surahNameAr: {
    fontSize: 20,
    color: '#4CAF50',
    fontFamily: 'System',
  },
  audioButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: SPACING.md,
  },
  surahContent: {
    marginVertical: SPACING.md,
  },
  transcriptionText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#424242',
    fontStyle: 'italic',
    marginBottom: SPACING.md,
  },
  translationText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#616161',
  },
  divider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: SPACING.md,
  },
  surahFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  surahDetails: {
    fontSize: 14,
    color: '#757575',
  },
  completionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  completionButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: COLORS.primary,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  checkboxActive: {
    backgroundColor: '#FFFFFF',
    borderColor: COLORS.primary,
  },
  completionButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.primary,
  },
  completionButtonTextActive: {
    color: '#FFFFFF',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  errorText: {
    fontSize: 16,
    color: '#D32F2F',
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  retryButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '500',
  },
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