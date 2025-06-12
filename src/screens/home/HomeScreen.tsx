import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { COLORS } from '../../constants/theme';
import { 
  PrayerTimeData, 
  fetchPrayerTimes,
  fetchPrayerTimesRange,
  WeeklyPrayerTimes,
  getCityFromCoordinates,
  TURKISH_CITIES
} from '../../services/prayerTimesService';
import { CitySelectionModal } from './CitySelectionModal';
import { StatusBar } from 'expo-status-bar';
import { Button } from '../../components/ui/Button';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { MainTabParamList } from '../../navigation/types';

export function HomeScreen() {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [cityName, setCityName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [prayerTimesRange, setPrayerTimesRange] = useState<WeeklyPrayerTimes[] | null>(null);
  const [selectedDayIndex, setSelectedDayIndex] = useState(7); // Ortadaki gün (bugün) için varsayılan indeks
  const [showCityModal, setShowCityModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [locationPermissionRequested, setLocationPermissionRequested] = useState(false);
  const navigation = useNavigation();

  useEffect(() => {
    requestLocationPermission();
  }, []);

  useEffect(() => {
    if (cityName) {
      fetchPrayerTimesForCityRange(cityName);
    }
  }, [cityName]);

  const requestLocationPermission = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      console.log('Konum izni isteniyor...');
      
      const { status: existingStatus } = await Location.getForegroundPermissionsAsync();
      console.log('Mevcut konum izni durumu:', existingStatus);
      
      if (existingStatus === 'granted') {
        console.log('Konum izni zaten verilmiş, konum alınıyor...');
        await getLocationAndSetCity();
        return;
      }
      
      if (existingStatus === 'denied' && locationPermissionRequested) {
        console.log('Konum izni daha önce reddedilmiş, ayarları açma seçeneği sunuluyor...');
        Alert.alert(
          'Konum İzni Gerekli',
          'Bulunduğunuz şehre göre namaz vakitlerini göstermek için konum izni gereklidir. Ayarlardan konum iznini etkinleştirebilirsiniz.',
          [
            { text: 'İptal', style: 'cancel', onPress: () => {
              if (!cityName) {
                setCityName('İstanbul');
                setIsLoading(false);
              }
            }},
            { text: 'Ayarları Aç', onPress: () => Linking.openSettings() }
          ]
        );
        return;
      }
      
      console.log('Konum izni ilk kez isteniyor...');
      setLocationPermissionRequested(true);
      
      if (Platform.OS === 'ios') {
        const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
        console.log('iOS konum izni sonucu:', foregroundStatus);
        
        if (foregroundStatus === 'granted') {
          console.log('iOS konum izni verildi, konum alınıyor...');
          await getLocationAndSetCity();
        } else {
          console.log('iOS konum izni reddedildi, varsayılan şehir kullanılıyor...');
          setCityName('İstanbul');
          Alert.alert(
            'Konum İzni Reddedildi',
            'Bulunduğunuz şehre göre namaz vakitlerini göstermek için konum izni gereklidir. Varsayılan olarak İstanbul için namaz vakitleri gösteriliyor.',
            [{ text: 'Tamam' }]
          );
          setIsLoading(false);
        }
      } else {
        const { status } = await Location.requestForegroundPermissionsAsync();
        console.log('Android konum izni sonucu:', status);
        
        if (status === 'granted') {
          console.log('Android konum izni verildi, konum alınıyor...');
          await getLocationAndSetCity();
        } else {
          console.log('Android konum izni reddedildi, varsayılan şehir kullanılıyor...');
          setCityName('İstanbul');
          Alert.alert(
            'Konum İzni Reddedildi',
            'Bulunduğunuz şehre göre namaz vakitlerini göstermek için konum izni gereklidir. Varsayılan olarak İstanbul için namaz vakitleri gösteriliyor.',
            [{ text: 'Tamam' }]
          );
          setIsLoading(false);
        }
      }
    } catch (err) {
      console.error('Konum izni hatası:', err);
      setCityName('İstanbul');
      setError('Konum bilgisi alınamadı. Varsayılan olarak İstanbul için namaz vakitleri gösteriliyor.');
      setIsLoading(false);
    }
  };

  const getLocationAndSetCity = async () => {
    try {
      console.log('Konum alınıyor...');
      
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      
      console.log('Konum alındı:', location.coords);
      setLocation(location);
      
      const city = await getCityFromCoordinates(
        location.coords.latitude,
        location.coords.longitude
      );
      
      if (city) {
        console.log('Şehir tespit edildi:', city);
        setCityName(city);
        
        // Context7 best practice: Kullanıcı ayarlarına tespit edilen şehri kaydet
        try {
          const { getUserSettings, storeUserSettings } = await import('../../services/storageService');
          const currentSettings = await getUserSettings();
          
          if (currentSettings && currentSettings.city !== city) {
            const updatedSettings = { ...currentSettings, city: city };
            await storeUserSettings(updatedSettings);
            console.log('Kullanıcı ayarlarında şehir güncellendi:', city);
            
            // Context7 best practice: Şehir değişince bildirimleri yeniden başlat
            if (currentSettings.notificationsEnabled) {
              try {
                const { initializePrayerNotifications } = await import('../../services/backgroundTaskService');
                await initializePrayerNotifications();
                console.log('Bildirimleri yeni şehir için yeniden başlatıldı');
              } catch (notificationError) {
                console.error('Bildirimler yeniden başlatılamadı:', notificationError);
              }
            }
          }
        } catch (settingsError) {
          console.error('Kullanıcı ayarları güncellenirken hata:', settingsError);
        }
        
        await fetchPrayerTimesForCityRange(city);
      } else {
        console.log('Şehir tespit edilemedi, varsayılan olarak İstanbul kullanılıyor');
        setCityName('İstanbul');
        
        await fetchPrayerTimesForCityRange('İstanbul');
      }
    } catch (err) {
      console.error('Konum alma hatası:', err);
      setCityName('İstanbul');
      setError('Konum bilgisi alınamadı. Varsayılan olarak İstanbul için namaz vakitleri gösteriliyor.');
      
      await fetchPrayerTimesForCityRange('İstanbul');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPrayerTimesForCityRange = async (city: string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      console.log(`${city} için namaz vakitleri aralığı getiriliyor...`);
      
      if (!city) {
        setError('Geçerli bir şehir adı belirtilmedi.');
        setIsLoading(false);
        return;
      }
      
      // 7 gün öncesi ve 7 gün sonrası için namaz vakitlerini al
      const times = await fetchPrayerTimesRange(city, 7, 7);
      
      if (times && times.length > 0) {
        console.log('Namaz vakitleri aralığı alındı:', times);
        setPrayerTimesRange(times);
        
        // Bugünü bul ve seçili gün olarak ayarla
        const todayIndex = times.findIndex(time => time.isToday);
        if (todayIndex !== -1) {
          setSelectedDayIndex(todayIndex);
        } else {
          setSelectedDayIndex(Math.min(7, times.length - 1)); // Varsayılan olarak ortadaki gün
        }
      } else {
        console.error(`${city} için namaz vakitleri aralığı alınamadı veya boş dizi döndü.`);
        setError(`${city} için namaz vakitleri alınamadı.`);
      }
    } catch (err) {
      console.error('Namaz vakitleri aralığı getirme hatası:', err);
      setError(`${city} için namaz vakitleri alınamadı: ${err instanceof Error ? err.message : 'Bilinmeyen hata'}`);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status === 'granted') {
      await getLocationAndSetCity();
    } else {
      if (cityName) {
        await fetchPrayerTimesForCityRange(cityName);
      } else {
        setCityName('İstanbul');
        await fetchPrayerTimesForCityRange('İstanbul');
      }
    }
  };

  const handleCitySelect = async (city: string) => {
    console.log('Şehir seçildi:', city);
    setCityName(city);
    setShowCityModal(false);
    
    // Context7 best practice: Kullanıcı ayarlarına seçilen şehri kaydet
    try {
      const { getUserSettings, storeUserSettings } = await import('../../services/storageService');
      const currentSettings = await getUserSettings();
      
      if (currentSettings) {
        const updatedSettings = { ...currentSettings, city: city };
        await storeUserSettings(updatedSettings);
        console.log('Kullanıcı ayarlarında şehir güncellendi:', city);
      }
    } catch (settingsError) {
      console.error('Kullanıcı ayarları güncellenirken hata:', settingsError);
    }
    
    // Yeni şehir için namaz vakitlerini al
    await fetchPrayerTimesForCityRange(city);
  };

  // Önceki güne git
  const navigateToPreviousDay = () => {
    if (selectedDayIndex > 0) {
      setSelectedDayIndex(selectedDayIndex - 1);
    }
  };

  // Sonraki güne git
  const navigateToNextDay = () => {
    if (prayerTimesRange && selectedDayIndex < prayerTimesRange.length - 1) {
      setSelectedDayIndex(selectedDayIndex + 1);
    }
  };

  // Bugüne dön
  const navigateToToday = () => {
    if (prayerTimesRange) {
      const todayIndex = prayerTimesRange.findIndex(time => time.isToday);
      if (todayIndex !== -1) {
        setSelectedDayIndex(todayIndex);
      }
    }
  };

  // Kıble ekranına git
  const navigateToQibla = () => {
    navigation.navigate('Qibla');
  };

  // Namaz rehberi ekranına git
  const navigateToPrayerGuide = () => {
    navigation.navigate('PrayerGuide');
  };

  // Günlük sureler ekranına git
  const navigateToDailySurahs = () => {
    navigation.navigate('DailySurahs');
  };

  // Bildirim ayarlarına git
  const navigateToNotificationSettings = () => {
    navigation.navigate('NotificationSettings');
  };

  // Seçilen günün namaz vakitlerini al
  const getSelectedDayPrayerTimes = () => {
    if (prayerTimesRange && prayerTimesRange.length > selectedDayIndex) {
      return prayerTimesRange[selectedDayIndex].times;
    }
    return null;
  };

  // Seçilen günün tarih bilgilerini al
  const getSelectedDayInfo = () => {
    if (prayerTimesRange && prayerTimesRange.length > selectedDayIndex) {
      return {
        date: prayerTimesRange[selectedDayIndex].formattedDate,
        dayName: prayerTimesRange[selectedDayIndex].dayName,
        isToday: prayerTimesRange[selectedDayIndex].isToday
      };
    }
    return { date: '', dayName: '', isToday: false };
  };

  // Tarih aralığını göster
  const getDateRangeInfo = () => {
    if (!prayerTimesRange || prayerTimesRange.length === 0) return '';
    
    const first = prayerTimesRange[0].formattedDate;
    const last = prayerTimesRange[prayerTimesRange.length - 1].formattedDate;
    
    return `${first} - ${last}`;
  };

  if (isLoading || !cityName) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>
            {isLoading ? 'Namaz vakitleri yükleniyor...' : 'Konum belirleniyor...'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>İslami</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity 
              style={styles.cityButton}
              onPress={() => setShowCityModal(true)}
            >
              <MaterialCommunityIcons name="map-marker" size={18} color="#fff" />
              <Text style={styles.cityButtonText}>{cityName}</Text>
              <Ionicons name="chevron-down" size={16} color="#fff" />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.notificationButton} 
              onPress={navigateToNotificationSettings}
            >
              <MaterialCommunityIcons 
                name="bell-outline" 
                size={22} 
                color="#fff" 
              />
            </TouchableOpacity>
          </View>
        </View>
        
        <View style={styles.dateContainer}>
          <TouchableOpacity
            style={[styles.dateNavigationButton, selectedDayIndex === 0 && styles.dateNavigationButtonDisabled]}
            onPress={navigateToPreviousDay}
            disabled={selectedDayIndex === 0}
          >
            <Ionicons name="chevron-back" size={24} color={selectedDayIndex === 0 ? "rgba(255,255,255,0.4)" : "#fff"} />
          </TouchableOpacity>
          
          <TouchableOpacity onPress={navigateToToday} style={styles.dateTextContainer}>
            <Text style={styles.dayNameText}>{getSelectedDayInfo().dayName}</Text>
            <Text style={styles.dateText}>{getSelectedDayInfo().date}</Text>
            {!getSelectedDayInfo().isToday && (
              <Text style={styles.todayText}>Bugüne dön</Text>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.dateNavigationButton,
              prayerTimesRange && selectedDayIndex >= prayerTimesRange.length - 1 && styles.dateNavigationButtonDisabled
            ]}
            onPress={navigateToNextDay}
            disabled={prayerTimesRange && selectedDayIndex >= prayerTimesRange.length - 1}
          >
            <Ionicons 
              name="chevron-forward" 
              size={24} 
              color={prayerTimesRange && selectedDayIndex >= prayerTimesRange.length - 1 ? "rgba(255,255,255,0.4)" : "#fff"} 
            />
          </TouchableOpacity>
        </View>
        
        <View style={styles.dateRangeContainer}>
          <Text style={styles.dateRangeText}>{getDateRangeInfo()}</Text>
        </View>
      </View>
      
      <ScrollView 
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
          />
        }
      >
        {error ? (
          <View style={styles.errorContainer}>
            <MaterialCommunityIcons name="alert-circle-outline" size={48} color={COLORS.error} />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity 
              style={styles.retryButton}
              onPress={() => cityName && fetchPrayerTimesForCityRange(cityName)}
            >
              <Text style={styles.retryButtonText}>Tekrar Dene</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Namaz Vakitleri</Text>
              <Text style={styles.sectionSubtitle}>
                {cityName} için {getSelectedDayInfo().isToday ? 'bugünkü' : getSelectedDayInfo().dayName} vakitler
              </Text>
            </View>
            
            <View style={styles.timesContainer}>
              {getSelectedDayPrayerTimes() ? (
                getSelectedDayPrayerTimes()!.map((prayer, index) => {
                  // Namaz vakti için ikon belirle
                  let iconName: any = "clock-outline";
                  let iconColor = prayer.isNext ? COLORS.primary : "#757575";
                  
                  switch (prayer.name) {
                    case 'İmsak':
                      iconName = "weather-sunset-up";
                      iconColor = prayer.isNext ? COLORS.primary : "#757575";
                      break;
                    case 'Güneş':
                      iconName = "weather-sunny";
                      iconColor = prayer.isNext ? COLORS.primary : "#FF9800";
                      break;
                    case 'Öğle':
                      iconName = "weather-sunny";
                      iconColor = prayer.isNext ? COLORS.primary : "#FF9800";
                      break;
                    case 'İkindi':
                      iconName = "weather-partly-cloudy";
                      iconColor = prayer.isNext ? COLORS.primary : "#757575";
                      break;
                    case 'Akşam':
                      iconName = "weather-sunset-down";
                      iconColor = prayer.isNext ? COLORS.primary : "#5D4037";
                      break;
                    case 'Yatsı':
                      iconName = "weather-night";
                      iconColor = prayer.isNext ? COLORS.primary : "#303F9F";
                      break;
                  }
                  
                  return (
                    <View 
                      key={index} 
                      style={[
                        styles.prayerItem, 
                        prayer.isNext && styles.nextPrayer
                      ]}
                    >
                      <View style={styles.prayerIconContainer}>
                        <MaterialCommunityIcons name={iconName} size={24} color={iconColor} />
                      </View>
                      <View style={styles.prayerInfo}>
                        <Text style={[styles.prayerName, prayer.isNext && styles.nextPrayerText]}>
                          {prayer.name}
                        </Text>
                        {prayer.isNext && getSelectedDayInfo().isToday && (
                          <Text style={styles.prayerRemainingTime}>
                            Sıradaki namaz vakti
                          </Text>
                        )}
                      </View>
                      <Text style={[styles.prayerTime, prayer.isNext && styles.nextPrayerText]}>
                        {prayer.time}
                      </Text>
                      {prayer.isNext && getSelectedDayInfo().isToday && (
                        <View style={styles.nextIndicator}>
                          <Text style={styles.nextIndicatorText}>Sıradaki</Text>
                        </View>
                      )}
                    </View>
                  );
                })
              ) : (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color={COLORS.primary} />
                  <Text style={styles.loadingText}>Namaz vakitleri yükleniyor...</Text>
                </View>
              )}
            </View>
            
            {/* Tarihler dizilimi */}
            <View style={styles.datesList}>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.datesScrollContent}
              >
                {prayerTimesRange && prayerTimesRange.map((item, index) => (
                  <TouchableOpacity
                    key={item.date}
                    style={[
                      styles.dateItem,
                      selectedDayIndex === index && styles.selectedDateItem,
                      item.isToday && styles.todayDateItem
                    ]}
                    onPress={() => setSelectedDayIndex(index)}
                  >
                    <Text 
                      style={[
                        styles.dateItemDay, 
                        selectedDayIndex === index && styles.selectedDateItemText,
                        item.isToday && styles.todayDateItemText
                      ]}
                    >
                      {item.formattedDate.split(' ')[0]}
                    </Text>
                    <Text 
                      style={[
                        styles.dateItemMonth, 
                        selectedDayIndex === index && styles.selectedDateItemText,
                        item.isToday && styles.todayDateItemText
                      ]}
                    >
                      {item.formattedDate.split(' ')[1].substring(0, 3)}
                    </Text>
                    {item.isToday && (
                      <View style={styles.todayIndicator} />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </>
        )}
      </ScrollView>
      
      <CitySelectionModal
        visible={showCityModal}
        onClose={() => setShowCityModal(false)}
        onSelectCity={handleCitySelect}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    backgroundColor: COLORS.primary,
    paddingTop: 16,
    paddingBottom: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  cityButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginRight: 8,
  },
  cityButtonText: {
    color: '#fff',
    fontWeight: '500',
    marginHorizontal: 6,
  },
  notificationButton: {
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
    width: 38,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingHorizontal: 16,
  },
  dateNavigationButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  dateNavigationButtonDisabled: {
    opacity: 0.5,
  },
  dateTextContainer: {
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: 8,
  },
  dateText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 16,
    fontWeight: '500',
  },
  dayNameText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  todayText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    marginTop: 4,
    fontStyle: 'italic',
  },
  dateRangeContainer: {
    alignItems: 'center',
    marginTop: 8,
  },
  dateRangeText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 24,
  },
  sectionHeader: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  timesContainer: {
    paddingHorizontal: 16,
  },
  prayerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
    position: 'relative',
  },
  nextPrayer: {
    backgroundColor: '#E8F5E9',
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  prayerIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  prayerInfo: {
    flex: 1,
  },
  prayerName: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.text,
  },
  prayerRemainingTime: {
    fontSize: 12,
    color: COLORS.primary,
    marginTop: 2,
  },
  prayerTime: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  nextPrayerText: {
    color: COLORS.primary,
  },
  nextIndicator: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderTopRightRadius: 12,
    borderBottomLeftRadius: 8,
  },
  nextIndicatorText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  datesList: {
    marginTop: 24,
    paddingLeft: 16,
  },
  datesScrollContent: {
    paddingRight: 16,
  },
  dateItem: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginRight: 10,
    width: 60,
    height: 60,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    justifyContent: 'center',
  },
  selectedDateItem: {
    backgroundColor: COLORS.primary,
  },
  todayDateItem: {
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  dateItemDay: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  dateItemMonth: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  selectedDateItemText: {
    color: '#FFFFFF',
  },
  todayDateItemText: {
    color: COLORS.primary,
  },
  todayIndicator: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.primary,
    bottom: 4,
  },
  quickActionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 24,
    paddingHorizontal: 16,
  },
  quickActionButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    width: '30%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  quickActionText: {
    marginTop: 8,
    fontSize: 12,
    color: COLORS.text,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    minHeight: 300,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: COLORS.text,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    minHeight: 300,
  },
  errorText: {
    marginTop: 16,
    marginBottom: 16,
    fontSize: 16,
    color: COLORS.error,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 16,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
}); 