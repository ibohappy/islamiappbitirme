import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Dimensions,
  Platform,
  Animated,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Magnetometer } from 'expo-sensors';
import * as Location from 'expo-location';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { COLORS } from '../../constants/theme';

// Low-pass filtresi için faktör (0-1 arası, 1'e yaklaştıkça daha az filtreleme yapar)
const SMOOTHING_FACTOR = 0.2;

// LoadingAnimation bileşeni
const LoadingAnimation = ({ 
  size = 'large', 
  color = '#4CAF50' 
}: { 
  size?: number | 'small' | 'large';
  color?: string;
}) => {
  return (
    <View style={{ justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size={size} color={color} />
    </View>
  );
};

const { width, height } = Dimensions.get('window');
const SCREEN_WIDTH = width < height ? width : height;
const COMPASS_SIZE = SCREEN_WIDTH * 0.85;

const QiblaScreen: React.FC = () => {
  const [subscription, setSubscription] = useState<any>(null);
  const [qiblaDirection, setQiblaDirection] = useState<number | null>(null);
  const [currentDegree, setCurrentDegree] = useState<number>(0);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isCalibrating, setIsCalibrating] = useState<boolean>(false);
  const [isCalibrated, setIsCalibrated] = useState<boolean>(false);
  
  // Son ölçülen değerler için referans (düşük geçişli filtre uygulamak için)
  const lastMeasurement = useRef<{x: number, y: number, z: number}>({ x: 0, y: 0, z: 0 });
  const compassRotation = useRef(new Animated.Value(0)).current;
  const needleRotation = useRef(new Animated.Value(0)).current;

  // Konum izni ve konum bilgisini al
  const getLocationPermission = async () => {
    try {
      setLoading(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        setErrorMsg('Konum izni verilmedi');
        setLoading(false);
        return;
      }
      
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      
      setLocation(location);
      
      // Kıble yönünü hesapla
      const qiblaDir = calculateQiblaDirection(
        location.coords.latitude,
        location.coords.longitude
      );
      
      setQiblaDirection(qiblaDir);
      setLoading(false);
    } catch (error) {
      console.error('Konum alınırken hata oluştu:', error);
      setErrorMsg('Konum alınamadı. Lütfen konum servislerinizi kontrol edin.');
      setLoading(false);
    }
  };

  // Pusula verilerini al
  const _subscribe = () => {
    // Manyetometre okuma hızını ayarla
    Magnetometer.setUpdateInterval(100);
    
    setSubscription(
      Magnetometer.addListener((data) => {
        // Veri sağlam değilse işleme
        if (!data || !isValidData(data)) return;
        
        // Düşük geçişli filtre uygula (veriyi yumuşat)
        const filteredData = applyLowPassFilter(data, lastMeasurement.current);
        lastMeasurement.current = filteredData;
        
        // Pusula açısını hesapla
        let angle = Math.atan2(filteredData.y, filteredData.x) * (180 / Math.PI);
        if (angle < 0) {
          angle += 360;
        }
        
        // Platform'a göre açıyı ayarla
        if (Platform.OS === 'ios') {
          angle = 360 - angle;
        }
        
        setCurrentDegree(angle);
        
        // Pusula animasyonu - Sadece pusulanın kendisini döndür
        // Pusula her zaman cihazın yönünü gösterir
        Animated.spring(compassRotation, {
          toValue: -angle,
          useNativeDriver: true,
          friction: 9,
          tension: 30,
        }).start();
        
        // Kıble yönü varsa, Kabe göstergesi için doğru açıyı hesapla
        if (qiblaDirection !== null) {
          // Kabe göstergesi her zaman kıble yönünü göstermelidir
          // compassRotation Kuzey'i gösterir, buna kıble açısını ekleyerek
          // Kabe'nin kıble yönünü göstermesini sağlarız
          const fixedAngle = qiblaDirection; // Kıblenin kuzeyden açısı
          const needleAngle = fixedAngle - angle; // Cihaz yönüne göre kıble açısı
          
          Animated.spring(needleRotation, {
            toValue: needleAngle,
            useNativeDriver: true,
            friction: 9,
            tension: 30,
          }).start();
        }
      })
    );
  };

  // Sensör verisinin geçerli olup olmadığını kontrol et
  const isValidData = (data: {x: number, y: number, z: number}) => {
    return (
      !isNaN(data.x) && isFinite(data.x) && 
      !isNaN(data.y) && isFinite(data.y) && 
      !isNaN(data.z) && isFinite(data.z)
    );
  };

  // Düşük geçişli filtre uygula (sensör verisini yumuşat)
  const applyLowPassFilter = (
    currentReading: {x: number, y: number, z: number}, 
    lastReading: {x: number, y: number, z: number}
  ) => {
    return {
      x: lastReading.x + SMOOTHING_FACTOR * (currentReading.x - lastReading.x),
      y: lastReading.y + SMOOTHING_FACTOR * (currentReading.y - lastReading.y),
      z: lastReading.z + SMOOTHING_FACTOR * (currentReading.z - lastReading.z)
    };
  };

  // Aboneliği kaldır
  const _unsubscribe = () => {
    subscription && subscription.remove();
    setSubscription(null);
  };

  // Pusulayı kalibre et
  const calibrateCompass = () => {
    setIsCalibrating(true);
    setIsCalibrated(false);
    
    // Manyetometre takibini durdur
    _unsubscribe();
    
    Alert.alert(
      'Pusula Kalibrasyonu',
      'Telefonunuzu 8 şeklinde hareket ettirerek pusulayı kalibre edin. Tam kalibrasyon için telefonunuzu her yöne çevirin.',
      [
        {
          text: 'Tamam',
          onPress: () => {
            setTimeout(() => {
              // Manyetometre takibini yeniden başlat
              _subscribe();
              
              // Konumu da yenile
              refreshLocation();
              
              setIsCalibrated(true);
              setIsCalibrating(false);
            }, 6000); // Kalibrasyon için süre
          },
        },
      ]
    );
  };

  // Konumu yenile
  const refreshLocation = () => {
    getLocationPermission();
  };

  // Bileşen yüklendiğinde
  useEffect(() => {
    getLocationPermission();
    _subscribe();
    
    return () => {
      _unsubscribe();
    };
  }, []);

  // Kıble yönünü hesapla (güncellenmiş formül)
  const calculateQiblaDirection = (lat: number, lng: number) => {
    // Kabe'nin koordinatları (hassas değer)
    const kabaLat = 21.4225;
    const kabaLng = 39.8262;
    
    // Radyan cinsinden hesaplama
    const lat1 = (lat * Math.PI) / 180;
    const lon1 = (lng * Math.PI) / 180;
    const lat2 = (kabaLat * Math.PI) / 180;
    const lon2 = (kabaLng * Math.PI) / 180;
    
    // Büyük daire formülünü kullanarak kıble açısını hesapla
    const dLon = lon2 - lon1;
    
    const y = Math.sin(dLon) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
    
    // Açıyı derece cinsine çevir
    let qiblaAngle = Math.atan2(y, x) * (180 / Math.PI);
    
    // Açıyı 0-360 aralığına getir
    qiblaAngle = (qiblaAngle + 360) % 360;
    
    // Konum bazlı tahmini manyetik sapma değeri
    let magneticDeclination = 4.5; // Varsayılan değer
    
    if (lat >= 36 && lat <= 42 && lng >= 26 && lng <= 45) {
      // Türkiye için genel değer
      magneticDeclination = 5.0;
    } else if (lat >= 20 && lat <= 23 && lng >= 38 && lng <= 41) {
      // Suudi Arabistan (Mekke) için
      magneticDeclination = 3.0;
    }
    
    // Manyetik sapma düzeltmesi
    qiblaAngle = (qiblaAngle + magneticDeclination) % 360;
    
    return qiblaAngle;
  };

  // Kıble yönünü göster
  const renderQiblaDirection = () => {
    if (qiblaDirection === null || currentDegree === null) {
      return <Text style={styles.directionText}>Kıble yönü hesaplanıyor...</Text>;
    }
    
    // Kıble ile mevcut yön arasındaki fark
    const diff = Math.abs(qiblaDirection - currentDegree) % 360;
    const smallerDiff = Math.min(diff, 360 - diff);
    const isFacingQibla = smallerDiff < 5;
    const isNearQibla = smallerDiff < 15;
    
    // Dönüş yönünü belirle
    let turnDirection;
    
    if (diff <= 180) {
      // Saat yönünde dönüş (sağa)
      if ((qiblaDirection > currentDegree) || 
          (currentDegree > 270 && qiblaDirection < 90)) {
        turnDirection = 'sağa';
      } else {
        turnDirection = 'sola';
      }
    } else {
      // Saat yönünün tersine dönüş (sola)
      if ((qiblaDirection < currentDegree) || 
          (currentDegree < 90 && qiblaDirection > 270)) {
        turnDirection = 'sola';
      } else {
        turnDirection = 'sağa';
      }
    }
    
    return (
      <View style={styles.directionContainer}>
        {/* Kıbleye dönüş yönü bilgisi */}
        <View style={styles.directionStatusContainer}>
          <Text style={[
            styles.directionText, 
            isFacingQibla ? styles.directionTextSuccess : {}
          ]}>
            {isFacingQibla 
              ? 'Kıbleye Dönüksünüz!' 
              : isNearQibla 
                ? 'Kıbleye Yakınsınız!' 
                : `Yeşil çizgiyi Kabe simgesine doğru ${turnDirection} çevirin`
            }
          </Text>
        </View>
        
        {/* Kıble konumu ve açı bilgisi */}
        <View style={styles.qiblaInfoContainer}>
          <View style={styles.qiblaInfoItem}>
            <Text style={styles.qiblaInfoLabel}>Kıble:</Text>
            <Text style={styles.directionDegree}>
              {Math.round(qiblaDirection)}° {getDirectionName(qiblaDirection)}
            </Text>
          </View>
          
          <View style={styles.qiblaInfoItem}>
            <FontAwesome5 name="map-marker-alt" size={14} color="#4CAF50" style={styles.locationIcon} />
            <Text style={styles.locationText} numberOfLines={1} ellipsizeMode="tail">
              Mekke, Suudi Arabistan
            </Text>
          </View>
        </View>
      </View>
    );
  };

  // Yön adını al
  const getDirectionName = (degree: number) => {
    const directions = ['K', 'KD', 'D', 'GD', 'G', 'GB', 'B', 'KB'];
    const index = Math.round(degree / 45) % 8;
    return directions[index];
  };

  // Yükleniyor veya hata durumları
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Kıble Pusulası</Text>
          <Text style={styles.headerSubtitle}>Doğru Kıble Yönü</Text>
        </View>
        
        <View style={styles.loadingContainer}>
          <LoadingAnimation size={80} color="#4CAF50" />
          <Text style={styles.loadingText}>Kıble yönü hesaplanıyor...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (errorMsg) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Kıble Pusulası</Text>
          <Text style={styles.headerSubtitle}>Doğru Kıble Yönü</Text>
        </View>
        
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={50} color="#F44336" />
          <Text style={styles.errorText}>{errorMsg}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={refreshLocation}>
            <Text style={styles.retryButtonText}>Tekrar Dene</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#4CAF50" barStyle="light-content" />
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Kıble Pusulası</Text>
        <Text style={styles.headerSubtitle}>Doğru Kıble Yönü</Text>
      </View>
      
      {isCalibrating && (
        <View style={styles.calibratingContainer}>
          <View style={styles.calibratingOverlay}>
            <LoadingAnimation size={50} color="#FFFFFF" />
            <Text style={styles.calibratingText}>
              Kalibre ediliyor...
            </Text>
            <Text style={styles.calibratingSubText}>
              Telefonunuzu 8 şeklinde hareket ettirin ve her yöne çevirin
            </Text>
          </View>
        </View>
      )}
      
      <ScrollView 
        contentContainerStyle={styles.scrollViewContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.compassContainer}>
          {renderQiblaDirection()}
          
          <View style={styles.compassWrapper}>
            {/* Pusula Dış Halkası */}
            <View style={styles.compassOuterRing} />
            
            {/* Pusula Görseli */}
            <Animated.View
              style={[
                styles.compassBackground,
                {
                  transform: [{ rotate: compassRotation.interpolate({
                    inputRange: [0, 360],
                    outputRange: ['0deg', '360deg']
                  }) }],
                },
              ]}
            >
              {/* Pusula Yön Harfleri */}
              <Text style={[styles.compassDirectionText, styles.compassNorth]}>K</Text>
              <Text style={[styles.compassDirectionText, styles.compassEast]}>D</Text>
              <Text style={[styles.compassDirectionText, styles.compassSouth]}>G</Text>
              <Text style={[styles.compassDirectionText, styles.compassWest]}>B</Text>
            </Animated.View>
            
            {/* Yeşil Çizgi - Kullanıcı Yönü (Sabit, Yukarı) */}
            <View style={styles.userDirectionLine}>
              <View style={styles.userDirectionLineInner} />
            </View>
            
            {/* Kıble işareti - Kabe Simgesi (Pusula dönüşüne göre konumunu korur) */}
            {qiblaDirection !== null && (
              <Animated.View 
                style={[
                  styles.qiblaMarkerDotContainer,
                  {
                    transform: [
                      { rotate: compassRotation.interpolate({
                        inputRange: [0, 360],
                        outputRange: ['0deg', '360deg']
                      }) },
                      { rotate: `${qiblaDirection}deg` },
                      { translateY: -COMPASS_SIZE * 0.45 }
                    ]
                  }
                ]}
              >
                <View style={styles.qiblaKaabaContainer}>
                  <FontAwesome5 name="kaaba" size={20} color="#000000" />
                </View>
              </Animated.View>
            )}
          </View>
          
          <View style={styles.infoContainer}>
            <Text style={styles.infoText}>
              Telefonunuzu düz tutarak yavaşça döndürün. Sabit yeşil çizgi telefonunuzun yönünü gösterir.
              Kabe simgesi ise kıble yönünü işaret eder. Yeşil çizgiyi Kabe simgesine doğru çevirerek kıbleyi bulabilirsiniz.
            </Text>
          </View>
          
          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.actionButton} onPress={calibrateCompass}>
              <Ionicons name="sync" size={24} color="#4CAF50" />
              <Text style={styles.actionButtonText}>Kalibre Et</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.actionButton} onPress={refreshLocation}>
              <Ionicons name="location" size={24} color="#4CAF50" />
              <Text style={styles.actionButtonText}>Konumu Yenile</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
  header: {
    backgroundColor: '#4CAF50',
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#E8F5E9',
    textAlign: 'center',
    marginTop: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#424242',
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: '#424242',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  compassContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  scrollViewContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 20,
  },
  directionContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 16,
  },
  directionStatusContainer: {
    backgroundColor: '#f9f9f9',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginBottom: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  directionText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#424242',
    textAlign: 'center',
  },
  directionTextSuccess: {
    color: '#4CAF50',
  },
  qiblaInfoContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 4,
  },
  qiblaInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  qiblaInfoLabel: {
    fontSize: 14,
    color: '#757575',
    marginRight: 4,
  },
  directionDegree: {
    fontSize: 14,
    color: '#757575',
    fontWeight: '500',
  },
  distanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationIcon: {
    marginRight: 4,
  },
  locationText: {
    fontSize: 14,
    color: '#757575',
    maxWidth: 150, // Sınırlı genişlik
  },
  compassWrapper: {
    position: 'relative',
    width: COMPASS_SIZE,
    height: COMPASS_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 20,
    overflow: 'hidden', // Taşan öğeleri gizle
  },
  compassOuterRing: {
    position: 'absolute',
    width: COMPASS_SIZE,
    height: COMPASS_SIZE,
    borderRadius: COMPASS_SIZE / 2,
    borderWidth: 3,
    borderColor: '#4CAF50',
    alignItems: 'center',
    justifyContent: 'center',
  },
  northMarker: {
    position: 'absolute',
    top: -10,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#F44336',
    display: 'none', // Kuzey işaretini gizle
  },
  compassBackground: {
    position: 'absolute',
    width: COMPASS_SIZE - 8, // Dış halkadan biraz daha küçük
    height: COMPASS_SIZE - 8,
    borderRadius: (COMPASS_SIZE - 8) / 2,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  compassLines: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    display: 'none', // Çizgili yapıyı gizleme
  },
  compassLine: {
    position: 'absolute',
    left: '50%',
    bottom: '50%',
    width: 1,
    height: '45%',
    backgroundColor: '#BDBDBD',
    display: 'none', // Çizgileri gizleme
  },
  compassDirectionText: {
    position: 'absolute',
    fontSize: 16,
    fontWeight: 'bold',
    color: '#424242',
  },
  compassNorth: {
    top: '5%',
    color: '#424242',
  },
  compassEast: {
    right: '5%',
  },
  compassSouth: {
    bottom: '5%',
  },
  compassWest: {
    left: '5%',
  },
  qiblaMarker: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
  },
  qiblaArrow: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  qiblaArrowLine: {
    position: 'absolute',
    top: -70,
    width: 2,
    height: 70,
    backgroundColor: '#4CAF50',
  },
  centerPoint: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#424242',
    display: 'none', // Merkez noktayı gizle
  },
  qiblaMarkerFixed: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  qiblaMarkerDotContainer: {
    position: 'absolute',
    width: 28,
    height: 28,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  qiblaKaabaContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  userDirectionLine: {
    position: 'absolute',
    top: 0,
    left: COMPASS_SIZE / 2 - 2,
    height: COMPASS_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'flex-start',
    zIndex: 4,
  },
  userDirectionLineInner: {
    width: 4,
    height: COMPASS_SIZE * 0.45,
    backgroundColor: '#4CAF50',
    borderRadius: 2,
  },
  infoContainer: {
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    padding: 14,
    marginVertical: 12,
    marginHorizontal: 20,
    borderLeftWidth: 3,
    borderLeftColor: '#4CAF50',
  },
  infoText: {
    fontSize: 13,
    color: '#424242',
    textAlign: 'center',
    lineHeight: 18,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingHorizontal: 40,
    marginTop: 16,
  },
  actionButton: {
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    width: 120,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  actionButtonText: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '500',
    color: '#424242',
  },
  calibratingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)', // Arkaplanı karartma
  },
  calibratingOverlay: {
    width: '75%', // Genişliği azalttım
    maxWidth: 280, // Maksimum genişlik sınırlaması
    minHeight: 180, // Minimum yükseklik
    padding: 24, // İç boşluğu artırdım
    backgroundColor: 'rgba(0, 0, 0, 0.85)', // Arkaplan rengini koyulaştırdım
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  calibratingText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
  },
  calibratingSubText: {
    color: '#FFFFFF',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
});

export { QiblaScreen };