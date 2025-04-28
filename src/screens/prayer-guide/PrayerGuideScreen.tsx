import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  Image,
  Dimensions,
  Animated,
  Modal,
  TextInput,
  Switch,
  FlatList,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons, MaterialCommunityIcons, FontAwesome5, AntDesign } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { 
  getPrayerInfo, 
  PrayerType, 
  getDailyPrayerTracking, 
  updatePrayerStatus,
  getPrayerName,
  PrayerStatus
} from '../../services/prayerGuideService';
import {
  checkAndUpdateStreak,
  getStreakCount,
  getDailyPrayerCompletion,
  updateDailyPrayerCompletion,
  getLastCompletedDate,
  resetDailyCompletions,
  resetStreak,
  forceUpdateStreak,
  getDailySurahCompletion,
  updateDailySurahCompletion
} from '../../services/streakService';
import {
  ZikirType,
  ZikirData,
  getZikirTypes,
  getTodayZikir,
  incrementZikir,
  saveZikirData,
  calculateZikirStats,
  getZikirHistory,
  setZikirReminder
} from '../../services/zikirService';
import { COLORS, SPACING, BORDER_RADIUS, SHADOW, FONT_SIZE, FONT_WEIGHT } from '../../constants/theme';
import * as Haptics from 'expo-haptics';

// Ekran boyutlarını al
const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Namaz kılma rehberi ekranı
const PrayerGuideScreen: React.FC = () => {
  const [activeTab, setActiveTab] = useState<PrayerType | 'general' | 'beginners'>('general');
  const [prayerTracking, setPrayerTracking] = useState<PrayerStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [streakCount, setStreakCount] = useState<number>(0);
  const [streakUpdated, setStreakUpdated] = useState(false);
  const [completedSurahs, setCompletedSurahs] = useState<number>(0);
  const [completedPrayers, setCompletedPrayers] = useState<number>(0);
  const scaleAnim = useState(new Animated.Value(1))[0];
  const navigation = useNavigation();
  
  // Zikirmatik için state'ler
  const [zikirCount, setZikirCount] = useState<number>(0);
  const [zikirGoal, setZikirGoal] = useState<number>(100);
  const [zikirType, setZikirType] = useState<string>('Genel');
  const [showZikirModal, setShowZikirModal] = useState(false);
  const [showZikirTypesModal, setShowZikirTypesModal] = useState(false);
  const [showZikirStatsModal, setShowZikirStatsModal] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [zikirTypes, setZikirTypes] = useState<ZikirType[]>([]);
  const [activeZikirType, setActiveZikirType] = useState<ZikirType | null>(null);
  const [enableVibration, setEnableVibration] = useState<boolean>(true);
  const [enableSound, setEnableSound] = useState<boolean>(false);
  const [zikirStats, setZikirStats] = useState({
    todayTotal: 0,
    weeklyTotal: 0,
    monthlyTotal: 0,
    mostCommonZikir: '',
    streakDays: 0
  });
  const [zikirHistory, setZikirHistory] = useState<any[]>([]);
  const [reminderHour, setReminderHour] = useState<string>('08');
  const [reminderMinute, setReminderMinute] = useState<string>('00');
  const zikirScaleAnim = useState(new Animated.Value(1))[0];
  const soundRef = useRef(null);
  
  // State'lere ZikirData ekleyelim
  const [activeZikirData, setActiveZikirData] = useState<ZikirData | null>(null);
  const [showCalendarModal, setShowCalendarModal] = useState(false);

  // Streak sayısını yükle
  const loadStreakCount = async () => {
    try {
      const count = await getStreakCount();
      setStreakCount(count);
    } catch (error) {
      console.error('Streak sayısı yüklenirken hata oluştu:', error);
    }
  };

  // Zikir türlerini yükle
  const loadZikirTypes = async () => {
    try {
      const types = await getZikirTypes();
      setZikirTypes(types);
    } catch (error) {
      console.error('Zikir türleri yüklenirken hata:', error);
    }
  };
  
  // useEffect ile zikir türlerini yükle
  useEffect(() => {
    loadZikirTypes();
  }, []);
  
  // Zikirmatik verilerini yükle
  const loadZikirData = async () => {
    try {
      // Mevcut zikir türlerini yükle
      const types = await getZikirTypes();
      setZikirTypes(types);
      
      // Eğer aktif zikir türü seçilmemişse, varsayılan olarak ilkini seç
      if (!activeZikirType && types.length > 0) {
        setActiveZikirType(types[0]);
        
        // Bu zikir türü için veri varsa yükle
        const data = await getTodayZikir(types[0].id);
        
        if (data) {
          // Aktif zikir verisini ayarla
          setActiveZikirData(data);
          setZikirCount(data.count);
          setZikirGoal(data.goal);
          setZikirType(data.zikr_type);
        } else {
          // Eğer veri yoksa, varsayılan değerleri ayarla
          setZikirCount(0);
          setZikirGoal(types[0].recommended_count);
          setZikirType(types[0].name);
        }
      } else if (activeZikirType) {
        // Aktif zikir türü varsa, o türün verilerini yükle
        const data = await getTodayZikir(activeZikirType.id);
        
        if (data) {
          // Aktif zikir verisini ayarla
          setActiveZikirData(data);
          setZikirCount(data.count);
          setZikirGoal(data.goal);
        } else {
          // Veri yoksa varsayılan değerler
          setZikirCount(0);
          setZikirGoal(activeZikirType.recommended_count);
        }
      }
    } catch (error) {
      console.error('Zikir verileri yüklenirken hata:', error);
    }
  };
  
  // Zikir istatistiklerini yükle
  const loadZikirStats = async () => {
    try {
      const stats = await calculateZikirStats();
      setZikirStats(stats);
      
      const history = await getZikirHistory();
      setZikirHistory(history);
    } catch (error) {
      console.error('Zikir istatistikleri yüklenirken hata:', error);
    }
  };
  
  // Zikir sayacını artır
  const handleZikirIncrement = async (zikirSubType: string = 'general') => {
    try {
      // Aktif zikir türü yoksa işlem yapma
      if (!activeZikirType) {
        Alert.alert('Hata', 'Zikir türü seçilmemiş. Lütfen bir zikir türü seçin.');
        return;
      }
      
      // Sayıyı direk olarak artıralım (servis çağrısını beklemeden)
      setZikirCount(prevCount => prevCount + 1);
      
      // Animasyon efekti
      Animated.sequence([
        Animated.timing(zikirScaleAnim, {
          toValue: 1.1,
          duration: 100,
          useNativeDriver: true
        }),
        Animated.timing(zikirScaleAnim, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true
        })
      ]).start();
      
      // Titreşim geri bildirimi
      if (enableVibration) {
        try {
          if ((zikirCount + 1) % 33 === 0) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          } else if ((zikirCount + 1) % 10 === 0) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          } else {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
        } catch (error) {
          console.error('Titreşim çalışırken hata:', error);
        }
      }
      
      // Bugünkü zikir verilerini yükle
      const data = await getTodayZikir(activeZikirType.id);
      
      if (data) {
        // Zikir sayısını artır (arkaplanda)
        await incrementZikir(data, false, enableSound, zikirSubType); // titreşim zaten yaptık
        
        // Hedef tamamlandıysa bildirim göster
        if (zikirCount + 1 >= zikirGoal && !data.completed) {
          setTimeout(() => {
            Alert.alert(
              'Tebrikler!',
              `${activeZikirType.name} hedefinize ulaştınız! 🎉`,
              [{ text: 'Teşekkürler', style: 'default' }]
            );
          }, 500);
        }
      }
      
      // Zikir verilerini yeniden yükle
      await loadZikirData();
      
      // Zikir istatistiklerini güncelle
      await loadZikirStats();
    } catch (error) {
      console.error('Zikir artırılırken hata:', error);
    }
  };
  
  // Zikir türünü değiştir
  const handleZikirTypeChange = async (type: ZikirType) => {
    setActiveZikirType(type);
    setZikirType(type.name);
    setShowZikirTypesModal(false);
    
    // Yeni zikir türü için verileri yükle
    try {
      const data = await getTodayZikir(type.id);
      
      if (data) {
        setZikirCount(data.count);
        setZikirGoal(data.goal);
      } else {
        setZikirCount(0);
        setZikirGoal(type.recommended_count);
        
        const today = new Date().toISOString().split('T')[0];
        const newData: ZikirData = {
          id: `${today}_${type.id}`,
          user_id: 'default',
          date: today,
          count: 0,
          goal: type.recommended_count,
          zikr_type: type.name,
          completed: false,
          last_updated: new Date().toISOString()
        };
        
        await saveZikirData(newData);
      }
    } catch (error) {
      console.error('Zikir türü değiştirilirken hata:', error);
    }
  };
  
  // Zikir hedefini güncelle
  const handleGoalUpdate = async (newGoal: number) => {
    try {
      // Aktif zikir türü yoksa işlem yapma
      if (!activeZikirType) {
        return;
      }
      
      setZikirGoal(newGoal);
      
      // Bugünkü zikir verilerini yükle
      const data = await getTodayZikir(activeZikirType.id);
      
      if (data) {
        // Hedefi güncelle
        data.goal = newGoal;
        await saveZikirData(data);
      } else {
        // Yeni bir zikir kaydı oluştur
        const today = new Date().toISOString().split('T')[0];
        const newData: ZikirData = {
          id: `${today}_${activeZikirType.id}`,
          user_id: 'default',
          date: today,
          count: 0,
          goal: newGoal,
          zikr_type: activeZikirType.name,
          completed: false,
          last_updated: new Date().toISOString()
        };
        
        await saveZikirData(newData);
      }
    } catch (error) {
      console.error('Zikir hedefi güncellenirken hata:', error);
    }
  };
  
  // Hatırlatıcı ayarla
  const handleSetReminder = async () => {
    try {
      const hour = parseInt(reminderHour, 10);
      const minute = parseInt(reminderMinute, 10);
      
      if (isNaN(hour) || hour < 0 || hour > 23 || isNaN(minute) || minute < 0 || minute > 59) {
        Alert.alert('Hata', 'Lütfen geçerli bir saat ve dakika girin.');
        return;
      }
      
      const reminderTime = new Date();
      reminderTime.setHours(hour, minute, 0, 0);
      
      await setZikirReminder(reminderTime);
      
      Alert.alert('Başarılı', `Zikir hatırlatıcısı ${reminderHour}:${reminderMinute} için ayarlandı.`);
      setShowReminderModal(false);
    } catch (error) {
      console.error('Hatırlatıcı ayarlanırken hata:', error);
      Alert.alert('Hata', 'Hatırlatıcı ayarlanırken bir sorun oluştu.');
    }
  };

  // Tamamlanan sure sayısını yükle
  const loadCompletedSurahs = async () => {
    try {
      // Bugünün tarihini kontrol et
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD formatı
      const lastCompletedDate = await getLastCompletedDate();
      const lastLoadTime = await AsyncStorage.getItem('last_surah_load_time');
      const currentTime = new Date().getTime().toString();
      const lastResetDate = await AsyncStorage.getItem('last_surah_reset_date');
      
      // Eğer son yükleme zamanı son 10 saniye içindeyse kontrolü atla
      if (lastLoadTime && (parseInt(currentTime) - parseInt(lastLoadTime)) < 10000) {
        return;
      }
      
      // Son yükleme zamanını güncelle
      await AsyncStorage.setItem('last_surah_load_time', currentTime);
      
      // Eğer bugün için sure sayısı zaten kaydedilmişse, onu getir
      if (lastCompletedDate === today) {
        const completedSurahsStr = await AsyncStorage.getItem('completed_surahs_count');
        const completedCount = completedSurahsStr ? parseInt(completedSurahsStr, 10) : 0;
        setCompletedSurahs(completedCount);
      } else {
        // Eğer bugün için sure sayısı henüz sıfırlanmamışsa sıfırla
        if (lastResetDate !== today) {
        setCompletedSurahs(0);
        await AsyncStorage.setItem('completed_surahs_count', '0');
          await AsyncStorage.setItem('last_surah_reset_date', today);
        console.log('PrayerGuideScreen - Yeni gün, sure sayısı sıfırlandı');
        } else {
          // Bugün zaten sıfırlama yapılmış, mevcut değeri getir
          const completedSurahsStr = await AsyncStorage.getItem('completed_surahs_count');
          const completedCount = completedSurahsStr ? parseInt(completedSurahsStr, 10) : 0;
          setCompletedSurahs(completedCount);
          console.log('PrayerGuideScreen - Bugün zaten sure sayısı sıfırlanmış');
        }
      }
    } catch (error) {
      console.error('Sure sayısı yüklenirken hata oluştu:', error);
      setCompletedSurahs(0);
    }
  };

  // Namaz takibini yükle
  const loadPrayerTracking = async () => {
    try {
      setLoading(true);
      const tracking = await getDailyPrayerTracking();
      setPrayerTracking(tracking);
      
      // Tamamlanan namaz sayısını güncelle
      const completedCount = tracking.filter(p => p.completed).length;
      setCompletedPrayers(completedCount);
      
      // Namaz tamamlama durumunu kontrol et
      const allCompleted = checkPrayerCompletion(tracking);
      
      // Namaz tamamlama durumunu güncelle
      await updateDailyPrayerCompletion(allCompleted);
      
      // Güncel streak sayısını al
      const currentStreak = await getStreakCount();
      
      // Streak sayısını güncelle
      setStreakCount(currentStreak);
      
      console.log('Namaz takibi yüklendi:', tracking);
      console.log('Tamamlanan namaz sayısı:', completedCount);
      console.log('Streak sayısı:', currentStreak);
      
      return tracking;
    } catch (error) {
      console.error('Namaz takibi yüklenirken hata oluştu:', error);
      Alert.alert('Hata', 'Namaz takibi yüklenirken bir hata oluştu.');
      return [];
    } finally {
      setLoading(false);
    }
  };

  // Namaz tamamlama durumunu kontrol et
  const checkPrayerCompletion = (prayerTracking: PrayerStatus[]): boolean => {
    if (!prayerTracking || prayerTracking.length === 0) return false;
    return prayerTracking.every(prayer => prayer.completed);
  };

  // Namaz durumunu güncelle
  const handlePrayerStatusUpdate = async (
    prayerType: PrayerType,
    completed: boolean
  ) => {
    try {
      // Namaz durumunu güncelle
      await updatePrayerStatus(prayerType, completed);
      
      // Güncel namaz takibini yükle
      const updatedTracking = await getDailyPrayerTracking();
      setPrayerTracking(updatedTracking);
      
      // Tamamlanan namaz sayısını güncelle
      const completedCount = updatedTracking.filter(p => p.completed).length;
      setCompletedPrayers(completedCount);
      
      // Namaz tamamlama durumunu kontrol et
      const allCompleted = checkPrayerCompletion(updatedTracking);
      
      // Namaz tamamlama durumunu güncelle
      await updateDailyPrayerCompletion(allCompleted);
      
      // Sure tamamlama durumunu kontrol et
      const surahCompleted = await getDailySurahCompletion();
      
      // Animasyon efekti ekle
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.1,
          duration: 100,
          useNativeDriver: true
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true
        })
      ]).start();
      
      // Streak sayısını güncelle
      await loadStreakCount();
      
      // Eğer tüm namazlar ve sureler tamamlandıysa bildirim göster
      if (allCompleted && surahCompleted) {
        setStreakUpdated(true);
      } else if (allCompleted) {
        // Tüm namazlar tamamlandı ancak sureler tamamlanmadı
        Alert.alert(
          'Tebrikler!',
          'Tüm günlük namazlarınızı tamamladınız! Streak\'inizi artırmak için günlük sureleri de tamamlamayı unutmayın.',
          [{ text: 'Tamam', style: 'default' }]
        );
      }
    } catch (error) {
      console.error('Namaz durumu güncellenirken hata oluştu:', error);
      Alert.alert('Hata', 'Namaz durumu güncellenirken bir sorun oluştu.');
    }
  };

  // Ekran odaklandığında çalışacak
  useFocusEffect(
    useCallback(() => {
      console.log('PrayerGuideScreen - Ekran odaklandı');
      
      // Günlük tamamlama durumlarını sıfırla
      // resetDailyCompletions();
      
      // Namaz takibini ve streak sayısını yükle
      const loadData = async () => {
        try {
          console.log('PrayerGuideScreen - Veriler yükleniyor...');

          // Günün değişip değişmediğini kontrol et
          const today = new Date().toISOString().split('T')[0];
          const lastCheckedDay = await AsyncStorage.getItem('last_checked_day');
          
          // Eğer gün değiştiyse veya son kontrol günü yoksa
          if (lastCheckedDay !== today) {
            // Günlük tamamlama durumlarını sıfırla
            await resetDailyCompletions();
            // Son kontrol gününü güncelle
            await AsyncStorage.setItem('last_checked_day', today);
            console.log('PrayerGuideScreen - Yeni gün başladı, tamamlama durumları sıfırlandı');
          } else {
            console.log('PrayerGuideScreen - Aynı gün içinde, sıfırlama yapılmadı');
          }
          
          // Namaz takibini yükle
          const tracking = await loadPrayerTracking();
          console.log('PrayerGuideScreen - Namaz takibi yüklendi:', tracking);
          
          // Sure sayısını yükle
          await loadCompletedSurahs();
          console.log('PrayerGuideScreen - Sure sayısı yüklendi:', completedSurahs);
          
          // Zikir türlerini yükle
          await loadZikirTypes();
          console.log('PrayerGuideScreen - Zikir türleri yüklendi');
          
          // Zikirmatik verilerini yükle
          await loadZikirData();
          console.log('PrayerGuideScreen - Zikirmatik verileri yüklendi');
          
          // Zikir istatistiklerini yükle
          await loadZikirStats();
          console.log('PrayerGuideScreen - Zikir istatistikleri yüklendi');
          
          console.log('PrayerGuideScreen - Tüm veriler başarıyla yüklendi');
        } catch (error) {
          console.error('PrayerGuideScreen - Veri yüklenirken hata oluştu:', error);
        }
      };
      
      loadData();
      
      // Her 30 saniyede bir sure sayısını ve zikir verilerini güncelle
      const interval = setInterval(() => {
        loadCompletedSurahs();
        loadZikirData();
      }, 30000); // 30 saniye
      
      return () => {
        clearInterval(interval);
        console.log('PrayerGuideScreen - Ekrandan ayrıldı');
      };
    }, [])
  );

  // Streak güncellendiğinde bildirim göster
  useEffect(() => {
    if (streakUpdated) {
      Alert.alert(
        'Tebrikler!',
        `Streak'iniz ${streakCount} güne yükseldi! Her gün düzenli olarak ibadetlerinizi yapmaya devam edin.`,
        [{ text: 'Teşekkürler', style: 'default' }]
      );
      setStreakUpdated(false);
    }
  }, [streakUpdated, streakCount]);

  // Namaz bilgilerini getir
  const prayerInfo = getPrayerInfo();

  // Aktif namazın bilgilerini getir
  const getActivePrayerInfo = () => {
    if (activeTab === 'general') return null;
    return prayerInfo.find((prayer) => prayer.type === activeTab);
  };

  // Aktif namazın takip durumunu getir
  const getActivePrayerTracking = () => {
    if (activeTab === 'general') return null;
    return prayerTracking.find((prayer) => prayer.type === activeTab);
  };

  // Namaz için onay kutusu
  const PrayerCheckbox = ({
    prayerType,
    name,
    rakats,
  }: {
    prayerType: PrayerType;
    name: string;
    rakats: number;
  }) => {
    const tracking = prayerTracking.find((p) => p.type === prayerType);
    const isCompleted = tracking?.completed || false;

    return (
      <TouchableOpacity
        style={styles.checkboxContainer}
        onPress={() =>
          handlePrayerStatusUpdate(prayerType, !isCompleted)
        }
      >
        <View style={[styles.checkbox, isCompleted && styles.checkboxChecked]}>
          {isCompleted && <Ionicons name="checkmark" size={16} color="#fff" />}
        </View>
        <Text style={styles.checkboxLabel}>
          {name} ({rakats} rekat)
        </Text>
      </TouchableOpacity>
    );
  };

  // Streak göstergesi
  const StreakIndicator = () => (
    <View style={styles.streakIndicatorContainer}>
      <View style={styles.streakIndicatorContent}>
        <View style={styles.streakIndicatorIcon}>
          <FontAwesome5 name="fire" size={24} color="#FF9800" />
      </View>
        <View style={styles.streakIndicatorTextContainer}>
          <Text style={styles.streakIndicatorTitle}>{streakCount} Günlük Streak</Text>
          <Text style={styles.streakIndicatorDescription}>Düzenli ibadet alışkanlığınız</Text>
        </View>
        <View style={styles.streakIndicatorBadge}>
          <Text style={styles.streakIndicatorCount}>{streakCount}</Text>
        </View>
      </View>
    </View>
  );

  // Genel namaz bilgileri içeriği
  const GeneralContent = () => (
    <ScrollView style={styles.contentContainer}>
      {activeTab === 'general' ? (
        <View>
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Namazın Önemi</Text>
            <Text style={styles.paragraph}>
              Namaz, İslam'ın beş şartından biridir ve günde beş vakit kılınması farzdır. 
              Namaz, Allah ile kul arasındaki en önemli bağdır ve Müslümanların günlük hayatının 
              ayrılmaz bir parçasıdır.
            </Text>
            <Text style={styles.paragraph}>
              "Namazı dosdoğru kılın, zekâtı verin. Kendiniz için her ne iyilik hazırlarsanız Allah katında onu bulursunuz. Şüphesiz Allah bütün yaptıklarınızı görür." (Bakara Suresi, 110)
            </Text>
          </View>
          
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Namaza Hazırlık</Text>
            <View style={styles.itemContainer}>
              <View style={styles.infoCard}>
                <View style={styles.iconCircle}>
                  <FontAwesome5 name="hands-wash" size={24} color="#4CAF50" />
                </View>
                <Text style={styles.cardTitle}>1. Abdest Almak</Text>
                <Text style={styles.cardDescription}>
                  Namaz kılmadan önce abdest almak gerekir. Abdest, elleri, ağzı, burnu, yüzü, 
                  kolları, başı mesh etmeyi ve ayakları yıkamayı içerir.
                </Text>
              </View>
              
              <View style={styles.infoCard}>
                <View style={styles.iconCircle}>
                  <FontAwesome5 name="tshirt" size={24} color="#4CAF50" />
                </View>
                <Text style={styles.cardTitle}>2. Temiz Kıyafet</Text>
                <Text style={styles.cardDescription}>
                  Namaz kılarken temiz ve örtülü kıyafetler giyilmelidir. Erkekler için en az göbek ile diz kapağı arası, kadınlar için ise yüz, eller ve ayaklar hariç tüm vücut örtülmelidir.
                </Text>
              </View>
              
              <View style={styles.infoCard}>
                <View style={styles.iconCircle}>
                  <FontAwesome5 name="broom" size={24} color="#4CAF50" />
                </View>
                <Text style={styles.cardTitle}>3. Temiz Yer</Text>
                <Text style={styles.cardDescription}>
                  Namaz kılınacak yerin temiz olması gerekir. Namaz kılacağınız yer temiz olmalı ve seccadenin altı da necasetten arındırılmış olmalıdır.
                </Text>
              </View>
              
              <View style={styles.infoCard}>
                <View style={styles.iconCircle}>
                  <FontAwesome5 name="compass" size={24} color="#4CAF50" />
                </View>
                <Text style={styles.cardTitle}>4. Kıbleye Yönelmek</Text>
                <Text style={styles.cardDescription}>
                  Namaz kılarken Kâbe'ye (kıbleye) yönelmek gerekir. Kıble yönünü bulmak için pusula veya kıble bulucu uygulamalardan faydalanabilirsiniz.
                </Text>
              </View>
            </View>
          </View>
          
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Namazın Rükünleri</Text>
            
            <View style={styles.stepContainer}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>1</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Niyet</Text>
                <Text style={styles.stepDescription}>
                  Hangi namazı kılacağınıza dair niyet etmek. Niyet kalben yapılır, dil ile söylenmesi gerekmez.
                </Text>
              </View>
            </View>
            
            <View style={styles.stepContainer}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>2</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>İftitah Tekbiri</Text>
                <Text style={styles.stepDescription}>
                  "Allahu Ekber" diyerek namaza başlamak. Bu tekbir namaza başlarken eller kulak hizasına kaldırılarak yapılır.
                </Text>
              </View>
            </View>
            
            <View style={styles.stepContainer}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>3</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Kıyam</Text>
                <Text style={styles.stepDescription}>
                  Ayakta durmak. Kıyamda eller bağlanır ve gözler secde yerine bakacak şekilde durulur.
                </Text>
              </View>
            </View>
            
            <View style={styles.stepContainer}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>4</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Kıraat</Text>
                <Text style={styles.stepDescription}>
                  Fatiha suresini ve ardından Kur'an'dan bir sure veya ayet okumak. Her rekatta Fatiha suresi okunur.
                </Text>
              </View>
            </View>
            
            <View style={styles.stepContainer}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>5</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Rükû</Text>
                <Text style={styles.stepDescription}>
                  Eğilmek ve "Sübhane Rabbiyel Azim" demek. Rükûda sırt düz olmalı ve en az üç kez tesbih çekilmelidir.
                </Text>
              </View>
            </View>
            
            <View style={styles.stepContainer}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>6</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Secde</Text>
                <Text style={styles.stepDescription}>
                  Alnı, burnu, elleri, dizleri ve ayak parmaklarını yere koyarak secde etmek ve "Sübhane Rabbiyel Ala" demek. En az üç kez tesbih çekilmelidir.
                </Text>
              </View>
            </View>
            
            <View style={styles.stepContainer}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>7</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Oturuş (Ka'de)</Text>
                <Text style={styles.stepDescription}>
                  İki secde arasında ve namazın sonunda oturmak. Son oturuşta Ettehiyyatü, Salli-Barik ve dua okunur.
                </Text>
              </View>
            </View>
            
            <View style={styles.stepContainer}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>8</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Selam</Text>
                <Text style={styles.stepDescription}>
                  Namazın sonunda önce sağa sonra sola "Esselamü aleyküm ve rahmetullah" diyerek selam vermek.
                </Text>
              </View>
            </View>
          </View>
          
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Namaz Çeşitleri</Text>
            
            <View style={styles.infoContainer}>
              <View style={styles.infoItem}>
                <View style={styles.infoIconContainer}>
                  <FontAwesome5 name="star" size={20} color="#4CAF50" />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoTitle}>Farz Namazlar</Text>
                  <Text style={styles.infoDescription}>
                    Günde beş vakit kılınması zorunlu olan namazlar: Sabah (2 rekât), Öğle (4 rekât), İkindi (4 rekât), Akşam (3 rekât), Yatsı (4 rekât).
                  </Text>
                </View>
              </View>
              
              <View style={styles.infoItem}>
                <View style={styles.infoIconContainer}>
                  <FontAwesome5 name="star-half-alt" size={20} color="#4CAF50" />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoTitle}>Vacip Namazlar</Text>
                  <Text style={styles.infoDescription}>
                    Vitir namazı ve bayram namazları gibi kılınması vacip olan namazlar. Vacip namazlar, farz kadar kesin olmamakla birlikte, kılınması gereken namazlardır.
                  </Text>
                </View>
              </View>
              
              <View style={styles.infoItem}>
                <View style={styles.infoIconContainer}>
                  <FontAwesome5 name="check" size={20} color="#4CAF50" />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoTitle}>Sünnet Namazlar</Text>
                  <Text style={styles.infoDescription}>
                    Farz namazlardan önce veya sonra kılınan namazlar. Hz. Peygamber'in düzenli olarak kıldığı namazlardır.
                  </Text>
                </View>
              </View>
              
              <View style={styles.infoItem}>
                <View style={styles.infoIconContainer}>
                  <FontAwesome5 name="heart" size={20} color="#4CAF50" />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoTitle}>Nafile Namazlar</Text>
                  <Text style={styles.infoDescription}>
                    Farz, vacip ve sünnet dışında kılınan namazlar. Teheccüd, Duha (Kuşluk), Evvabin, Tehiyyetü'l-Mescid gibi namazlar bu kategoriye girer.
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      ) : null}
    </ScrollView>
  );

  // Aktif namazın içeriği
  const PrayerContent = () => {
    const prayer = getActivePrayerInfo();
    const tracking = getActivePrayerTracking();

    if (!prayer || !tracking) return null;

    return (
      <ScrollView style={styles.contentContainer}>
        <Text style={styles.title}>{prayer.name}</Text>
        <Text style={styles.arabicTitle}>{prayer.arabicName}</Text>
        
        <View style={styles.infoContainer}>
          <Text style={styles.infoLabel}>Namaz Vakti:</Text>
          <Text style={styles.infoValue}>{prayer.time}</Text>
        </View>
        
        <Text style={styles.sectionTitle}>Açıklama</Text>
        <Text style={styles.paragraph}>{prayer.description}</Text>
        
        <Text style={styles.sectionTitle}>Rekat Sayısı</Text>
        <View style={styles.rakatsContainer}>
          <View style={styles.rakatItem}>
            <Text style={styles.rakatLabel}>Toplam:</Text>
            <Text style={styles.rakatValue}>{prayer.rakats} rekat</Text>
          </View>
        </View>
      </ScrollView>
    );
  };

  // Namaz Takip Kartları
  const PrayerTrackingCards = ({ 
    completedPrayers, 
    completedSurahs, 
    streakCount, 
    onPrayerComplete, 
    onSurahComplete,
    prayerTrackingData
  }: { 
    completedPrayers: number; 
    completedSurahs: number; 
    streakCount: number; 
    onPrayerComplete: () => Promise<void>; 
    onSurahComplete: () => Promise<void>;
    prayerTrackingData?: PrayerStatus[];
  }) => {
    const [showPrayerModal, setShowPrayerModal] = useState(false);
    const [prayerTracking, setPrayerTracking] = useState<PrayerStatus[]>([]);
    const [localCompletedCount, setLocalCompletedCount] = useState(completedPrayers);
    const [isLoading, setIsLoading] = useState(false);
    
    // Ana bileşenden gelen namaz verilerini kullan
    useEffect(() => {
      if (prayerTrackingData && prayerTrackingData.length > 0) {
        setPrayerTracking(prayerTrackingData);
        const completedCount = prayerTrackingData.filter(p => p.completed).length;
        setLocalCompletedCount(completedCount);
        console.log('PrayerTrackingCards - Ana bileşenden gelen veriler kullanıldı:', prayerTrackingData);
        console.log('PrayerTrackingCards - Tamamlanan namaz sayısı:', completedCount);
      }
    }, [prayerTrackingData]);
    
    // Modal açıldığında verileri yeniden yükle
    useEffect(() => {
      if (showPrayerModal) {
        loadPrayerTracking();
      }
    }, [showPrayerModal]);
    
    const loadPrayerTracking = async () => {
      try {
        setIsLoading(true);
        
        // Varsayılan namaz durumunu oluştur
        const defaultTracking = [
          { type: PrayerType.FAJR, completed: false },
          { type: PrayerType.DHUHR, completed: false },
          { type: PrayerType.ASR, completed: false },
          { type: PrayerType.MAGHRIB, completed: false },
          { type: PrayerType.ISHA, completed: false }
        ];
        
        // Önce AsyncStorage'dan doğrudan verileri al
        const today = new Date().toISOString().split('T')[0];
        const storedDate = await AsyncStorage.getItem('prayer_tracking_date');
        let tracking: PrayerStatus[] = [];
        
        console.log('PrayerTrackingCards - Bugün:', today);
        console.log('PrayerTrackingCards - Kayıtlı tarih:', storedDate);
        
        if (storedDate === today) {
          const storedTracking = await AsyncStorage.getItem('prayer_tracking');
          console.log('PrayerTrackingCards - Kayıtlı takip verileri:', storedTracking);
          
          if (storedTracking) {
            tracking = JSON.parse(storedTracking);
          }
        }
        
        // Eğer AsyncStorage'dan veri alınamazsa veya boşsa, varsayılan verileri kullan
        if (!tracking || tracking.length === 0) {
          console.log('PrayerTrackingCards - AsyncStorage\'dan veri alınamadı, varsayılan veriler kullanılıyor');
          tracking = defaultTracking;
          
          // Varsayılan verileri kaydet
          await AsyncStorage.setItem('prayer_tracking', JSON.stringify(defaultTracking));
          await AsyncStorage.setItem('prayer_tracking_date', today);
        }
        
        console.log('PrayerTrackingCards - Namaz takibi yüklendi:', tracking);
        
        // Namaz verilerini ayarla
        setPrayerTracking(tracking);
        
        // Tamamlanan namaz sayısını güncelle
        const completedCount = tracking.filter(p => p.completed).length;
        setLocalCompletedCount(completedCount);
        console.log('PrayerTrackingCards - Tamamlanan namaz sayısı:', completedCount);
      } catch (error) {
        console.error('PrayerTrackingCards - Namaz takibi yüklenirken hata oluştu:', error);
        
        // Hata durumunda varsayılan namaz durumunu oluştur
        const defaultTracking = [
          { type: PrayerType.FAJR, completed: false },
          { type: PrayerType.DHUHR, completed: false },
          { type: PrayerType.ASR, completed: false },
          { type: PrayerType.MAGHRIB, completed: false },
          { type: PrayerType.ISHA, completed: false }
        ];
        
        setPrayerTracking(defaultTracking);
        setLocalCompletedCount(0);
        
        // Hata mesajı göster
        Alert.alert('Hata', 'Namaz takibi yüklenirken bir sorun oluştu. Varsayılan veriler kullanılıyor.');
      } finally {
        setIsLoading(false);
      }
    };
    
    const handlePrayerStatusUpdate = async (prayerType: PrayerType, completed: boolean) => {
      try {
        console.log(`PrayerTrackingCards - Namaz durumu güncelleniyor: ${prayerType}, tamamlandı: ${completed}`);
        
        // Önce yerel state'i güncelle (daha hızlı UI yanıtı için)
        const updatedTracking = prayerTracking.map(prayer => 
          prayer.type === prayerType ? { ...prayer, completed } : prayer
        );
        setPrayerTracking(updatedTracking);
        
        // Tamamlanan namaz sayısını güncelle
        const completedCount = updatedTracking.filter(p => p.completed).length;
        setLocalCompletedCount(completedCount);
        
        // Namaz durumunu AsyncStorage'a kaydet
        await AsyncStorage.setItem('prayer_tracking', JSON.stringify(updatedTracking));
        
        // Namaz durumunu servise güncelle
        await updatePrayerStatus(prayerType, completed);
        
        console.log('PrayerTrackingCards - Güncellenmiş namaz takibi:', updatedTracking);
        console.log('PrayerTrackingCards - Güncellenmiş tamamlanan namaz sayısı:', completedCount);
        
        // Tüm namazların tamamlanıp tamamlanmadığını kontrol et
        const allCompleted = updatedTracking.every(prayer => prayer.completed);
        
        if (allCompleted) {
          console.log('PrayerTrackingCards - Tüm namazlar tamamlandı');
          // Namaz tamamlama durumunu güncelle
          await updateDailyPrayerCompletion(true);
          
          // Eğer sureler de tamamlandıysa streak'i güncelle
          const surahCompleted = await getDailySurahCompletion();
          if (surahCompleted) {
            console.log('PrayerTrackingCards - Sureler de tamamlandı, streak güncelleniyor');
            const { streakCount: newStreakCount } = await checkAndUpdateStreak();
            onPrayerComplete();
          }
        }
        
        // Animasyon efekti ekle
        Animated.sequence([
          Animated.timing(scaleAnim, {
            toValue: 1.1,
            duration: 100,
            useNativeDriver: true
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 100,
            useNativeDriver: true
          })
        ]).start();
      } catch (error) {
        console.error('PrayerTrackingCards - Namaz durumu güncellenirken hata oluştu:', error);
        Alert.alert('Hata', 'Namaz durumu güncellenirken bir sorun oluştu.');
      }
    };
    
    return (
      <>
        <View style={styles.trackingCardsContainer}>
          <TouchableOpacity 
            style={styles.trackingCard}
            onPress={() => {
              setShowPrayerModal(true);
            }}
          >
            <View style={styles.trackingIconContainer}>
              <FontAwesome5 name="pray" size={24} color="#4CAF50" />
            </View>
            <View style={styles.trackingTextContainer}>
              <Text style={styles.trackingTitle}>Günlük Namazlar</Text>
              <Text style={styles.trackingCount}>{localCompletedCount}/5</Text>
            </View>
            <View style={styles.trackingButton}>
              <Text style={styles.trackingButtonText}>Görüntüle</Text>
            </View>
          </TouchableOpacity>
          
          <View style={styles.trackingCard}>
            <View style={styles.trackingIconContainer}>
              <FontAwesome5 name="book" size={24} color="#4CAF50" />
            </View>
            <View style={styles.trackingTextContainer}>
              <Text style={styles.trackingTitle}>Günlük Sureler</Text>
              <Text style={styles.trackingCount}>
                {completedSurahs}/5 Sure
              </Text>
            </View>
            <TouchableOpacity 
              style={[
                styles.trackingButton,
                completedSurahs >= 5 && styles.trackingButtonDisabled
              ]}
              onPress={onSurahComplete}
              disabled={completedSurahs >= 5}
            >
              <Text style={[
                styles.trackingButtonText,
                completedSurahs >= 5 && styles.trackingButtonTextDisabled
              ]}>
                {completedSurahs >= 5 ? 'Tamamlandı' : 'Tamamla'}
              </Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.trackingCard}>
            <View style={styles.trackingIconContainer}>
              <MaterialCommunityIcons name="calendar-check" size={24} color="#4CAF50" />
            </View>
            <View style={styles.trackingTextContainer}>
              <Text style={styles.trackingTitle}>Toplam</Text>
              <Text style={styles.trackingCount}>{localCompletedCount + completedSurahs}/10</Text>
            </View>
            <View style={styles.trackingProgressContainer}>
              <View 
                style={[
                  styles.trackingProgress, 
                  { width: `${((localCompletedCount + completedSurahs) / 10) * 100}%` }
                ]} 
              />
            </View>
          </View>
        </View>
        
        <Modal
          visible={showPrayerModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowPrayerModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Günlük Namazlar</Text>
                <TouchableOpacity 
                  style={styles.closeButton}
                  onPress={() => setShowPrayerModal(false)}
                >
                  <Ionicons name="close" size={24} color="#333" />
                </TouchableOpacity>
              </View>
              
              {isLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#4CAF50" />
                  <Text style={styles.loadingText}>Namaz bilgileri yükleniyor...</Text>
                </View>
              ) : prayerTracking.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <FontAwesome5 name="pray" size={48} color="#E0E0E0" />
                  <Text style={styles.emptyText}>Namaz bilgileri bulunamadı</Text>
                  <TouchableOpacity 
                    style={styles.reloadButton}
                    onPress={loadPrayerTracking}
                  >
                    <Text style={styles.reloadButtonText}>Yeniden Yükle</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <ScrollView style={styles.modalContent}>
                  {prayerTracking.map((prayer, index) => {
                    const prayerInfo = getPrayerInfo().find(p => p.type === prayer.type);
                    if (!prayerInfo) return null;
                    
                    return (
                      <TouchableOpacity 
                        key={index}
                        style={styles.prayerItem}
                        onPress={() => handlePrayerStatusUpdate(prayer.type, !prayer.completed)}
                      >
                        <View style={[
                          styles.prayerCheckbox,
                          prayer.completed && styles.prayerCheckboxChecked
                        ]}>
                          {prayer.completed && (
                            <Ionicons name="checkmark" size={18} color="#fff" />
                          )}
                        </View>
                        <View style={styles.prayerInfo}>
                          <Text style={styles.prayerName}>{prayerInfo.name || getPrayerName(prayer.type)}</Text>
                          <Text style={styles.prayerRakats}>{prayerInfo.rakats} rekat</Text>
                        </View>
                        <Text style={[
                          styles.prayerTime,
                          prayer.completed ? styles.prayerCompleted : styles.prayerNotCompleted
                        ]}>
                          {prayer.completed ? 'Tamamlandı' : 'Tamamlanmadı'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                  
                  <View style={styles.modalFooter}>
                    <Text style={styles.modalFooterText}>
                      Tamamlanan Namazlar: {localCompletedCount}/5
                    </Text>
                    <TouchableOpacity 
                      style={[
                        styles.completeAllButton,
                        localCompletedCount === 5 && styles.completeAllButtonDisabled
                      ]}
                      onPress={async () => {
                        if (localCompletedCount === 5) return;
                        
                        // Tüm namazları tamamla
                        const updatedTracking = prayerTracking.map(prayer => ({
                          ...prayer,
                          completed: true
                        }));
                        
                        // State'i güncelle
                        setPrayerTracking(updatedTracking);
                        setLocalCompletedCount(5);
                        
                        // AsyncStorage'a kaydet
                        await AsyncStorage.setItem('prayer_tracking', JSON.stringify(updatedTracking));
                        
                        // Servisi güncelle
                        for (const prayer of updatedTracking) {
                          await updatePrayerStatus(prayer.type, true);
                        }
                        
                        // Namaz tamamlama durumunu güncelle
                        await updateDailyPrayerCompletion(true);
                        
                        // Eğer sureler de tamamlandıysa streak'i güncelle
                        const surahCompleted = await getDailySurahCompletion();
                        if (surahCompleted) {
                          const { streakCount: newStreakCount } = await checkAndUpdateStreak();
                          onPrayerComplete();
                        }
                        
                        // Bildirim göster
                        Alert.alert('Başarılı', 'Tüm namazlar tamamlandı!');
                      }}
                      disabled={localCompletedCount === 5}
                    >
                      <Text style={[
                        styles.completeAllButtonText,
                        localCompletedCount === 5 && styles.completeAllButtonTextDisabled
                      ]}>
                        {localCompletedCount === 5 ? 'Tüm Namazlar Tamamlandı' : 'Tümünü Tamamla'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>
      </>
    );
  };

  const loadInitialData = async () => {
    try {
      setLoading(true);
      
      // Streak sayısını yükle
      const streak = await getStreakCount();
      setStreakCount(streak);
      
      // Tamamlanan sure sayısını yükle
      const completedSurahsStr = await AsyncStorage.getItem('completed_surahs_count');
      const completedCount = completedSurahsStr ? parseInt(completedSurahsStr, 10) : 0;
      setCompletedSurahs(completedCount);
      
      // Burada tamamlanan namazları da yükleyebilirsiniz
      // Örnek olarak 0 atıyorum, gerçek uygulamada bu değer bir servisten gelmelidir
      setCompletedPrayers(0);
    } catch (error) {
      console.error('Veri yüklenirken hata oluştu:', error);
      Alert.alert('Hata', 'Veriler yüklenirken bir sorun oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const handlePrayerCompletion = useCallback(async () => {
    try {
      // Namaz tamamlama durumunu güncelle
      await loadPrayerTracking();
      
      // Streak güncellemesi
      const newStreakCount = await getStreakCount();
      setStreakCount(newStreakCount);
      
      // Animasyon efekti ekle
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.1,
          duration: 100,
          useNativeDriver: true
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true
        })
      ]).start();
    } catch (error) {
      console.error('Namaz kaydedilirken hata oluştu:', error);
      Alert.alert('Hata', 'Namazınız kaydedilirken bir sorun oluştu.');
    }
  }, []);

  const handleSurahCompletion = useCallback(async () => {
    try {
      // Eğer sureler zaten tamamlanmışsa, işlem yapma
      if (completedSurahs >= 5) {
        Alert.alert('Bilgi', 'Bugünkü sureler zaten tamamlandı.');
        return;
      }
      
      // Tamamlanan sure sayısını bir artır
      const newCompletedCount = completedSurahs + 1;
      setCompletedSurahs(newCompletedCount);
      
      // Tamamlanan sure sayısını kaydet
      await AsyncStorage.setItem('completed_surahs_count', newCompletedCount.toString());
      console.log('PrayerGuideScreen - Tamamlanan sure sayısı güncellendi:', newCompletedCount);
      
      // Eğer tüm sureler tamamlandıysa, sure tamamlama durumunu güncelle
      if (newCompletedCount >= 5) {
        await updateDailySurahCompletion(true);
        console.log('PrayerGuideScreen - Tüm sureler tamamlandı, durum güncellendi');
        
        // Eğer namazlar da tamamlandıysa streak'i güncelle
        const prayerCompleted = await getDailyPrayerCompletion();
        if (prayerCompleted) {
          console.log('PrayerGuideScreen - Namazlar da tamamlandı, streak güncelleniyor');
          const { streakCount: newStreakCount } = await checkAndUpdateStreak();
          setStreakCount(newStreakCount);
        }
        
        // Bildirim göster
        Alert.alert('Tebrikler!', 'Günlük sureler tamamlandı!');
      } else {
        // Bildirim göster
        Alert.alert('Başarılı', `${newCompletedCount}. sure tamamlandı! ${5 - newCompletedCount} sure kaldı.`);
      }
      
      // Animasyon efekti ekle
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.1,
          duration: 100,
          useNativeDriver: true
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true
        })
      ]).start();
    } catch (error) {
      console.error('Sure tamamlanırken hata oluştu:', error);
      Alert.alert('Hata', 'Sureler tamamlanırken bir sorun oluştu.');
    }
  }, [completedSurahs]);

  const goBack = () => {
    navigation.goBack();
  };

  // Zikirmatik kartı bileşeni
  const ZikirCard = () => {
    const [zikirData, setZikirData] = useState({
      date: new Date().toISOString().split('T')[0],
      subhanallah: 0,
      elhamdulillah: 0,
      allahuekber: 0,
      total: 0
    });

    // Zikir verilerini yükle
    const loadZikirData = async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const storedData = await AsyncStorage.getItem(`zikir_${today}`);
        if (storedData) {
          setZikirData(JSON.parse(storedData));
        }
      } catch (error) {
        console.error('Zikir verileri yüklenirken hata:', error);
      }
    };

    // Zikir verilerini kaydet
    const saveZikirData = async (newData: typeof zikirData) => {
      try {
        await AsyncStorage.setItem(`zikir_${newData.date}`, JSON.stringify(newData));
      } catch (error) {
        console.error('Zikir verileri kaydedilirken hata:', error);
      }
    };

    // Zikir sayısını artır
    const handleZikirIncrement = async (type: 'subhanallah' | 'elhamdulillah' | 'allahuekber') => {
      const newData = {
        ...zikirData,
        [type]: zikirData[type] + 1,
        total: zikirData.total + 1
      };
      setZikirData(newData);
      await saveZikirData(newData);
    };

    // Component yüklendiğinde verileri getir
    useEffect(() => {
      loadZikirData();
    }, []);

    return (
      <View style={styles.zikirCardContainer}>
        <View style={styles.zikirCardHeader}>
          <FontAwesome5 name="pray" size={20} color="#4CAF50" solid />
          <Text style={styles.zikirCardTitle}>Zikir Sayacı</Text>
          <TouchableOpacity onPress={() => setShowCalendarModal(true)}>
            <MaterialCommunityIcons name="calendar-month" size={22} color="#757575" />
          </TouchableOpacity>
        </View>

        <View style={styles.zikirCountContainer}>
          <Text style={styles.zikirCountText}>
            {zikirData.total}/33 Zikir
          </Text>
          <View style={styles.zikirProgressBar}>
            <View
              style={[
                styles.zikirProgressBarFill,
                { width: `${Math.min(100, (zikirData.total / 33) * 100)}%` },
              ]}
            />
          </View>
        </View>

        <View style={styles.zikirButtonsContainer}>
          <TouchableOpacity 
            style={styles.zikirButton}
            onPress={() => handleZikirIncrement('subhanallah')}
            activeOpacity={0.7}
          >
            <View style={styles.zikirButtonTextContainer}>
              <Text style={styles.zikirButtonText}>Sübhanallah</Text>
            </View>
            <Text style={styles.zikirButtonCount}>{zikirData.subhanallah}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.zikirButton}
            onPress={() => handleZikirIncrement('elhamdulillah')}
            activeOpacity={0.7}
          >
            <View style={styles.zikirButtonTextContainer}>
              <Text style={styles.zikirButtonText} numberOfLines={1} ellipsizeMode="tail">
                Elhamdülillah
              </Text>
            </View>
            <Text style={styles.zikirButtonCount}>{zikirData.elhamdulillah}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.zikirButton}
            onPress={() => handleZikirIncrement('allahuekber')}
            activeOpacity={0.7}
          >
            <View style={styles.zikirButtonTextContainer}>
              <Text style={styles.zikirButtonText}>Allahu Ekber</Text>
            </View>
            <Text style={styles.zikirButtonCount}>{zikirData.allahuekber}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Takvim modalı
  const CalendarModal = () => {
    type ZikirData = {
      date: string;
      subhanallah: number;
      elhamdulillah: number;
      allahuekber: number;
      total: number;
    };

    const [calendarData, setCalendarData] = useState<Record<string, ZikirData>>({});

    // Takvim verilerini yükle
    const loadCalendarData = async () => {
      try {
        const keys = await AsyncStorage.getAllKeys();
        const zikirKeys = keys.filter(key => key.startsWith('zikir_'));
        const data: Record<string, ZikirData> = {};

        for (const key of zikirKeys) {
          const storedData = await AsyncStorage.getItem(key);
          if (storedData) {
            const zikirData = JSON.parse(storedData);
            data[zikirData.date] = zikirData;
          }
        }

        setCalendarData(data);
      } catch (error) {
        console.error('Takvim verileri yüklenirken hata:', error);
      }
    };

    useEffect(() => {
      if (showCalendarModal) {
        loadCalendarData();
      }
    }, [showCalendarModal]);

    return (
      <Modal
        visible={showCalendarModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowCalendarModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.calendarModalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Zikir Geçmişi</Text>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => setShowCalendarModal(false)}
              >
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.calendarContent}>
              {Object.entries(calendarData)
                .sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())
                .map(([date, data]) => (
                  <View key={date} style={styles.calendarItem}>
                    <View style={styles.calendarDateContainer}>
                      <Text style={styles.calendarDate}>
                        {new Date(date).toLocaleDateString('tr-TR')}
                      </Text>
                    </View>
                    <View style={styles.calendarStats}>
                      <View style={styles.calendarDetailsContainer}>
                        <Text style={styles.calendarDetailText}>
                          Sübhanallah: {data.subhanallah}
                        </Text>
                        <Text style={styles.calendarDetailText}>
                          Elhamdülillah: {data.elhamdulillah}
                        </Text>
                        <Text style={styles.calendarDetailText}>
                          Allahu Ekber: {data.allahuekber}
                        </Text>
                      </View>
                      <Text style={styles.calendarTotalCount}>
                        Toplam: {data.total}
                      </Text>
                    </View>
                  </View>
                ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  // Zikir türleri modalı
  const ZikirTypesModal = () => {
    return (
      <Modal
        visible={showZikirTypesModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowZikirTypesModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Zikir Türleri</Text>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => setShowZikirTypesModal(false)}
              >
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.zikirModalListContent}>
              {zikirTypes.map((type) => (
                <TouchableOpacity 
                  key={type.id}
                  style={[
                    styles.zikirTypeListItem,
                    activeZikirType?.id === type.id && styles.activeZikirTypeListItem
                  ]}
                  onPress={() => handleZikirTypeChange(type)}
                >
                  <View style={styles.zikirTypeItemContent}>
                    <View>
                      <Text style={styles.zikirTypeItemName}>{type.name}</Text>
                      {type.arabic && <Text style={styles.zikirTypeItemArabic}>{type.arabic}</Text>}
                      {type.description && <Text style={styles.zikirTypeItemDescription}>{type.description}</Text>}
                    </View>
                    
                    <View style={styles.zikirTypeCountItem}>
                      <Text style={styles.zikirTypeCountValue}>
                        {activeZikirData?.count || 0}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };
  
  // Zikir Modalı bileşeni düzenlemesi
  const ZikirModal = () => {
    return (
      <Modal
        visible={showZikirModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowZikirModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Zikir Sayacı</Text>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => setShowZikirModal(false)}
              >
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.zikirModalContent}>
              <View style={styles.zikirTypeSelector}>
                <Text style={styles.zikirSectionTitle}>Zikir Türü</Text>
                <TouchableOpacity 
                  style={styles.zikirModalTypeButton}
                  onPress={() => setShowZikirTypesModal(true)}
                >
                  <Text style={styles.zikirModalTypeButtonText}>{zikirType}</Text>
                  <AntDesign name="down" size={16} color="#4CAF50" />
                </TouchableOpacity>
              </View>
              
              <View style={styles.zikirCounterSection}>
                <Text style={styles.zikirSectionTitle}>Sayaç</Text>
                <Text style={styles.zikirCounter}>{zikirCount}</Text>
                <View style={styles.zikirProgressBar}>
                  <View 
                    style={[
                      styles.zikirProgressBarFill, 
                      { width: `${Math.min((zikirCount / zikirGoal) * 100, 100)}%` }
                    ]} 
                  />
                </View>
                <Text style={styles.zikirProgressText}>Hedef: {zikirGoal}</Text>
              </View>
              
              <View style={styles.zikirControlsSection}>
                <TouchableOpacity 
                  style={styles.zikirModalCountButton}
                  onPress={() => handleZikirIncrement()}
                >
                  <Text style={styles.zikirModalCountButtonText}>Zikir Çek (+1)</Text>
                </TouchableOpacity>
                
                <View style={styles.zikirSettingsContainer}>
                  <Text style={styles.zikirSectionTitle}>Ayarlar</Text>
                  
                  <View style={styles.zikirSetting}>
                    <Text style={styles.zikirSettingLabel}>Günlük Hedef</Text>
                    <View style={styles.zikirGoalInputContainer}>
                      <TextInput
                        style={styles.zikirGoalInput}
                        keyboardType="numeric"
                        value={zikirGoal.toString()}
                        onChangeText={(text) => {
                          const newGoal = parseInt(text) || 100;
                          handleGoalUpdate(newGoal);
                        }}
                      />
                    </View>
                  </View>
                  
                  <View style={styles.zikirSetting}>
                    <Text style={styles.zikirSettingLabel}>Titreşim</Text>
                    <Switch
                      value={enableVibration}
                      onValueChange={setEnableVibration}
                      trackColor={{ false: '#E0E0E0', true: '#A5D6A7' }}
                      thumbColor={enableVibration ? '#4CAF50' : '#BDBDBD'}
                    />
                  </View>
                  
                  <View style={styles.zikirSetting}>
                    <Text style={styles.zikirSettingLabel}>Ses</Text>
                    <Switch
                      value={enableSound}
                      onValueChange={setEnableSound}
                      trackColor={{ false: '#E0E0E0', true: '#A5D6A7' }}
                      thumbColor={enableSound ? '#4CAF50' : '#BDBDBD'}
                    />
                  </View>
                </View>
                
                <TouchableOpacity 
                  style={styles.zikirReminderButton}
                  onPress={() => setShowReminderModal(true)}
                >
                  <Text style={styles.zikirReminderButtonText}>Hatırlatıcı Ayarla</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.zikirStatsButton}
                  onPress={() => setShowZikirStatsModal(true)}
                >
                  <Text style={styles.zikirStatsButtonText}>İstatistikleri Görüntüle</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    );
  };
  
  // Hatırlatıcı modal bileşeni
  const ReminderModal = () => {
    return (
      <Modal
        visible={showReminderModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowReminderModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, styles.smallModalContainer]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Hatırlatıcı Ayarla</Text>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => setShowReminderModal(false)}
              >
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.reminderContent}>
              <Text style={styles.reminderLabel}>Zikir hatırlatıcısı için saat seçin:</Text>
              
              <View style={styles.timeInputContainer}>
                <TextInput
                  style={styles.timeInput}
                  keyboardType="numeric"
                  maxLength={2}
                  value={reminderHour}
                  onChangeText={setReminderHour}
                  placeholder="08"
                />
                <Text style={styles.timeSeparator}>:</Text>
                <TextInput
                  style={styles.timeInput}
                  keyboardType="numeric"
                  maxLength={2}
                  value={reminderMinute}
                  onChangeText={setReminderMinute}
                  placeholder="00"
                />
              </View>
              
              <TouchableOpacity 
                style={styles.reminderSetButton}
                onPress={handleSetReminder}
              >
                <Text style={styles.reminderSetButtonText}>Hatırlatıcıyı Ayarla</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };
  
  // İstatistikler modal bileşeni
  const StatsModal = () => {
    return (
      <Modal
        visible={showZikirStatsModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowZikirStatsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Zikir İstatistikleri</Text>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => setShowZikirStatsModal(false)}
              >
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.statsContent}>
              <View style={styles.statsSummaryContainer}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{zikirStats.todayTotal}</Text>
                  <Text style={styles.statLabel}>Bugün</Text>
                </View>
                
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{zikirStats.weeklyTotal}</Text>
                  <Text style={styles.statLabel}>Bu Hafta</Text>
                </View>
                
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{zikirStats.monthlyTotal}</Text>
                  <Text style={styles.statLabel}>Bu Ay</Text>
                </View>
                
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{zikirStats.streakDays}</Text>
                  <Text style={styles.statLabel}>Streak</Text>
                </View>
              </View>
              
              {zikirStats.mostCommonZikir && (
                <View style={styles.mostCommonContainer}>
                  <Text style={styles.statsSectionTitle}>En Çok Çekilen Zikir</Text>
                  <Text style={styles.mostCommonZikir}>{zikirStats.mostCommonZikir}</Text>
                </View>
              )}
              
              <Text style={styles.statsSectionTitle}>Geçmiş Kayıtlar</Text>
              
              {zikirHistory.length === 0 ? (
                <View style={styles.emptyHistoryContainer}>
                  <Text style={styles.emptyHistoryText}>Henüz zikir kaydı bulunmuyor.</Text>
                </View>
              ) : (
                <View style={styles.historyList}>
                  {zikirHistory.map((item, index) => (
                    <View key={index} style={styles.historyItem}>
                      <View style={styles.historyItemHeader}>
                        <Text style={styles.historyItemDate}>{item.date}</Text>
                        <Text style={styles.historyItemType}>{item.zikr_type}</Text>
                      </View>
                      <View style={styles.historyItemCounts}>
                        <Text style={styles.historyItemCount}>{item.count} / {item.goal}</Text>
                        {item.completed && (
                          <View style={styles.completedBadge}>
                            <Text style={styles.completedBadgeText}>Tamamlandı</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
      <View style={styles.topSection}>
        <View style={styles.placeholderLeft} />
        <Text style={styles.screenTitle}>Namaz Rehberi</Text>
        <View style={styles.placeholderRight} />
      </View>

        <View style={styles.streakBannerContainer}>
          <View style={styles.streakBannerIcon}>
          <FontAwesome5 name="fire" size={20} color="#FF9800" />
        </View>
          <Text style={styles.streakBannerText}>{streakCount} Günlük Streak</Text>
        <TouchableOpacity 
            style={styles.streakBannerButton}
          onPress={() => Alert.alert('Streak Bilgisi', 'Her gün namaz kılarak ve sure okuyarak streak\'inizi artırabilirsiniz. Streak, düzenli ibadet alışkanlığı kazanmanıza yardımcı olur.')}
        >
          <Ionicons name="information-circle-outline" size={20} color="#FF9800" />
        </TouchableOpacity>
      </View>

      <PrayerTrackingCards 
        completedPrayers={completedPrayers}
        completedSurahs={completedSurahs}
        streakCount={streakCount}
        onPrayerComplete={handlePrayerCompletion}
        onSurahComplete={handleSurahCompletion}
        prayerTrackingData={prayerTracking}
      />
        
        <ZikirCard />

      <View style={styles.contentWrapper}>
        <GeneralContent />
      </View>
      </ScrollView>
      
      {/* Zikirmatik Modalları */}
      <ZikirModal />
      <ZikirTypesModal />
      <ReminderModal />
      <StatsModal />
      <CalendarModal />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: SPACING.md,
    paddingTop: SPACING.md,
  },
  
  // Üst bölüm stilleri
  topSection: {
    flexDirection: "row",
    alignItems: "center",
    padding: SPACING.md,
  },
  placeholderLeft: {
    width: 40,
  },
  cardContainer: {
    backgroundColor: COLORS.card,
    borderRadius: 8,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 8,
  },
  stepContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  stepNumber: {
    backgroundColor: COLORS.primary,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  stepNumberText: {
    color: COLORS.card,
    fontSize: 16,
    fontWeight: 'bold',
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  stepDescription: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    backgroundColor: COLORS.card,
    borderRadius: 8,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  zikirModalListContent: {
    padding: SPACING.md,
  },
  zikirTypeListItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  zikirTypeItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  zikirTypeItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  zikirTypeItemArabic: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  zikirTypeItemDescription: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  zikirTypeCountItem: {
    alignItems: 'center',
  },
  zikirTypeCountValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  activeZikirTypeListItem: {
    backgroundColor: '#E8F5E9',
  },
  zikirModalContent: {
    padding: SPACING.md,
  },
  zikirTypeSelector: {
    marginBottom: SPACING.md,
  },
  zikirSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
  },
  zikirCounterSection: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  zikirCounter: {
    fontSize: 48,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginVertical: SPACING.md,
  },
  zikirControlsSection: {
    alignItems: 'center',
  },
  zikirSettingsContainer: {
    width: '100%',
    marginTop: SPACING.md,
  },
  zikirSetting: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  zikirSettingLabel: {
    fontSize: 16,
    color: COLORS.text,
  },
  zikirGoalInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  zikirGoalInput: {
    width: 80,
    height: 40,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    textAlign: 'center',
  },
  zikirReminderButton: {
    backgroundColor: COLORS.background,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zikirReminderButtonText: {
    fontSize: 16,
    color: COLORS.primary,
    marginLeft: 8,
  },
  zikirStatsButton: {
    backgroundColor: COLORS.background,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zikirStatsButtonText: {
    fontSize: 16,
    color: COLORS.primary,
    marginLeft: 8,
  },
  reminderContent: {
    padding: SPACING.md,
  },
  reminderLabel: {
    fontSize: 16,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  timeInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  timeInput: {
    width: 60,
    height: 40,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    textAlign: 'center',
  },
  timeSeparator: {
    fontSize: 24,
    marginHorizontal: 8,
    color: COLORS.text,
  },
  reminderSetButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  reminderSetButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.card,
  },
  statsContent: {
    padding: SPACING.md,
  },
  statsSummaryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
  },
  statItem: {
    alignItems: 'center',
    width: '48%',
    backgroundColor: COLORS.background,
    padding: SPACING.md,
    borderRadius: 8,
    marginBottom: SPACING.sm,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  mostCommonContainer: {
    backgroundColor: COLORS.background,
    padding: SPACING.md,
    borderRadius: 8,
    marginBottom: SPACING.md,
  },
  mostCommonZikir: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.primary,
    textAlign: 'center',
    marginTop: 8,
  },
  historyList: {
    marginTop: SPACING.md,
  },
  historyItem: {
    backgroundColor: COLORS.background,
    padding: SPACING.md,
    borderRadius: 8,
    marginBottom: SPACING.sm,
  },
  historyItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  historyItemDate: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  historyItemType: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.primary,
  },
  historyItemCounts: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  historyItemCount: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  completedBadge: {
    backgroundColor: '#E8F5E9',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  completedBadgeText: {
    fontSize: 12,
    color: COLORS.primary,
  },
  emptyHistoryContainer: {
    padding: SPACING.md,
    alignItems: 'center',
  },
  emptyHistoryText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  contentWrapper: {
    flex: 1,
    paddingHorizontal: SPACING.md,
  },
  screenTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.text,
  },
  placeholderRight: {
    width: 40,
  },
  streakBannerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    padding: SPACING.sm,
    borderRadius: 8,
    marginBottom: SPACING.md,
  },
  streakBannerIcon: {
    marginRight: SPACING.sm,
  },
  streakBannerText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FF9800',
    flex: 1,
  },
  streakBannerButton: {
    padding: SPACING.xs,
  },
  smallModalContainer: {
    width: '90%',
    maxHeight: '40%',
  },
  moreZikirButton: {
    backgroundColor: COLORS.background,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  moreZikirButtonText: {
    fontSize: 14,
    color: COLORS.primary,
  },
  statsSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  // Checkbox stilleri
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.primary,
    marginRight: SPACING.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: COLORS.primary,
  },
  checkboxLabel: {
    fontSize: 16,
    color: COLORS.text,
  },

  // Streak gösterge stilleri
  streakIndicatorContainer: {
    backgroundColor: '#FFF8E1',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  streakIndicatorContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  streakIndicatorIcon: {
    backgroundColor: '#FFF0C4',
    borderRadius: 30,
    width: 46,
    height: 46,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  streakIndicatorTextContainer: {
    flex: 1,
  },
  streakIndicatorTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  streakIndicatorDescription: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  streakIndicatorBadge: {
    backgroundColor: '#FF9800',
    borderRadius: 20,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  streakIndicatorCount: {
    color: COLORS.card,
    fontWeight: 'bold',
    fontSize: 16,
  },

  // İçerik stilleri
  contentContainer: {
    paddingBottom: 24,
  },
  sectionContainer: {
    marginTop: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  paragraph: {
    fontSize: 16,
    lineHeight: 24,
    color: COLORS.textSecondary,
    marginBottom: 12,
  },
  itemContainer: {
    marginBottom: 12,
  },
  // Kart stilleri
  infoCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  iconCircle: {
    backgroundColor: '#E8F5E9',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cardDescription: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  // Bilgi kartı stilleri
  infoContainer: {
    marginBottom: 16,
  },
  infoItem: {
    flexDirection: 'row',
    marginBottom: 16,
    backgroundColor: COLORS.background,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  infoIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  infoDescription: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },

  // Başlık stilleri
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    color: COLORS.text,
  },
  arabicTitle: {
    fontSize: 20,
    marginBottom: 16,
    color: COLORS.primary,
    textAlign: 'right',
    fontFamily: 'System',
  },
  infoLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    color: COLORS.primary,
  },

  // Rekat stilleri
  rakatsContainer: {
    backgroundColor: COLORS.card,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  rakatItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rakatLabel: {
    fontSize: 16,
    color: COLORS.text,
  },
  rakatValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.primary,
  },

  // Takip kartı stilleri
  trackingCardsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.md,
  },
  trackingCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 8,
    padding: SPACING.md,
    marginHorizontal: SPACING.xs,
  },
  trackingIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary + "20",
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  trackingTextContainer: {
    flex: 1,
  },
  trackingTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  trackingCount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.primary,
  },

  // Takip buton stilleri
  trackingButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackingButtonText: {
    color: COLORS.card,
    fontWeight: '600',
    marginLeft: 8,
    fontSize: 16,
  },
  trackingButtonDisabled: {
    backgroundColor: COLORS.background,
  },
  trackingButtonTextDisabled: {
    color: COLORS.textSecondary,
  },
  trackingProgressContainer: {
    height: 6,
    backgroundColor: COLORS.background,
    borderRadius: 3,
    overflow: 'hidden',
    width: '100%',
  },
  trackingProgress: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 3,
  },
  
  // Yükleme stilleri
  loadingContainer: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: COLORS.textSecondary,
  },

  // Boş durum stilleri
  emptyContainer: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: COLORS.textSecondary,
    marginBottom: 16,
  },
  reloadButton: {
    backgroundColor: '#E8F5E9',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  reloadButtonText: {
    color: COLORS.primary,
    fontWeight: '500',
  },

  // Modal içerik stilleri
  modalContent: {
    paddingBottom: SPACING.md,
  },

  // Namaz stilleri
  prayerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  prayerCheckbox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: COLORS.primary,
    marginRight: SPACING.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  prayerCheckboxChecked: {
    backgroundColor: COLORS.primary,
  },
  prayerInfo: {
    flex: 1,
  },
  prayerName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },

  // Namaz stilleri devamı
  prayerRakats: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  prayerTime: {
    fontSize: 14,
    fontWeight: '500',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: 12,
  },
  prayerCompleted: {
    color: COLORS.primary,
    backgroundColor: '#E8F5E9',
  },
  prayerNotCompleted: {
    color: '#FF5722',
    backgroundColor: '#FBE9E7',
  },

  // Modal footer stilleri
  modalFooter: {
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  modalFooterText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  completeAllButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  completeAllButtonDisabled: {
    backgroundColor: COLORS.background,
  },
  completeAllButtonText: {
    color: COLORS.card,
    fontWeight: '600',
    fontSize: 16,
  },
  completeAllButtonTextDisabled: {
    color: COLORS.textSecondary,
  },

  // Zikir kartı stilleri
  zikirCardContainer: {
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    ...SHADOW.sm,
  },
  zikirCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  zikirCardTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '600',
    color: COLORS.text,
  },
  zikirCountContainer: {
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  zikirCountText: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: SPACING.sm,
  },
  zikirProgressBar: {
    width: '100%',
    height: 8,
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.round,
    overflow: 'hidden',
  },
  zikirProgressBarFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.round,
  },
  zikirHorizontalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  zikirDetailCard: {
    flex: 1,
    marginRight: SPACING.md,
  },
  zikirTypeText: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  zikirDescriptionText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
  },
  zikirTypesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: SPACING.sm,
  },
  zikirCardTypeButton: {
    backgroundColor: COLORS.background,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.sm,
    marginRight: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  activeZikirTypeButton: {
    backgroundColor: COLORS.primary,
  },
  zikirCardTypeButtonText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
  },
  activeZikirTypeButtonText: {
    color: COLORS.white,
  },
  zikirModalTypeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.sm,
  },
  zikirModalTypeButtonText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.primary,
    marginRight: SPACING.sm,
  },
  zikirProgressText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  zikirModalCountButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.sm,
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  zikirModalCountButtonText: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.white,
  },
  zikirButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.sm,
  },
  zikirButton: {
    flex: 1,
    backgroundColor: COLORS.primary + '15', // Daha hafif arka plan rengi
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.md, // Daha yumuşak köşeler
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 4,
    height: 70, // Buton yüksekliği
    overflow: 'hidden',
    elevation: 1, // Android için hafif gölge
    shadowColor: "#000", // iOS için hafif gölge
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  zikirButtonTextContainer: {
    height: 20, 
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    marginBottom: 2,
  },
  zikirButtonText: {
    fontSize: 12, // Daha küçük yazı boyutu
    color: COLORS.primary,
    fontWeight: '600',
    textAlign: 'center',
    includeFontPadding: false,
  },
  zikirButtonCount: {
    fontSize: 22, // Daha büyük rakam
    color: COLORS.primary,
    fontWeight: '700',
    marginTop: 4,
  },

  // Takvim modal stilleri
  calendarModalContainer: {
    width: '90%',
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.lg,
    maxHeight: '80%',
  },
  calendarContent: {
    padding: SPACING.md,
  },
  calendarItem: {
    backgroundColor: COLORS.background,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.sm,
    marginBottom: SPACING.sm,
  },
  calendarDateContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  calendarDate: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  calendarStats: {
    marginTop: SPACING.xs,
  },
  calendarCount: {
    fontSize: FONT_SIZE.md,
    color: COLORS.primary,
    fontWeight: '600',
    marginBottom: SPACING.xs,
  },
  calendarProgress: {
    height: 4,
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.round,
    overflow: 'hidden',
  },
  calendarProgressFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.round,
  },
  calendarCompletedBadge: {
    backgroundColor: COLORS.primary + '20',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: BORDER_RADIUS.sm,
  },
  calendarCompletedBadgeText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.primary,
    fontWeight: '600',
  },
  calendarDetailsContainer: {
    marginTop: SPACING.xs,
  },
  calendarDetailText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  calendarTotalCount: {
    fontSize: FONT_SIZE.md,
    color: COLORS.primary,
    fontWeight: '600',
    marginTop: SPACING.xs,
  },
});

export { PrayerGuideScreen }; 