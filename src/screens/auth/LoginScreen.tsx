import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  StyleSheet,
  Text,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/types';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { COLORS, SPACING } from '../../constants/theme';
import { signInUser } from '../../lib/supabase';
import NetInfo from '@react-native-community/netinfo';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext, useAuth } from '../../contexts/AuthContext';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [isCheckingConnection, setIsCheckingConnection] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState(0);
  
  // Yeni Auth Context'ten fonksiyonları al
  const { refreshSession } = useAuth();

  // Ağ durumu kontrolü için useEffect
  useEffect(() => {
    let netInfoSubscription: any = null;
    
    const initializeNetworkListener = () => {
      try {
        netInfoSubscription = NetInfo.addEventListener(state => {
          setIsConnected(state.isConnected);
        });
        
        // İlk kontrol
        checkNetworkConnection();
      } catch (error) {
        console.warn('NetInfo listener başlatılırken hata (görmezden geliniyor):', error);
      }
    };
    
    initializeNetworkListener();
    
    // Güvenli temizleme işlevi
    return () => {
      try {
        if (netInfoSubscription) {
          if (typeof netInfoSubscription.remove === 'function') {
            netInfoSubscription.remove();
          } else if (typeof netInfoSubscription === 'function') {
            netInfoSubscription();
          }
          netInfoSubscription = null;
        }
      } catch (error) {
        console.warn('NetInfo listener temizlenirken hata (görmezden geliniyor):', error);
      }
    };
  }, []);

  // İnternet bağlantısını kontrol eden fonksiyon
  const checkNetworkConnection = async () => {
    setIsCheckingConnection(true);
    try {
      const networkState = await NetInfo.fetch();
      setIsConnected(networkState.isConnected);
      console.log('Ağ durumu:', networkState);
      
      if (!networkState.isConnected) {
        setError('İnternet bağlantınız yok. Lütfen bağlantınızı kontrol edin ve tekrar deneyin.');
      } else {
        // Eğer bağlantı var ama bir ağ hatası gösteriliyor ise temizle
        if (error.includes('İnternet bağlantınızı')) {
          setError('');
        }
      }
    } catch (netError) {
      console.error('Ağ durumu kontrolü hatası:', netError);
    } finally {
      setIsCheckingConnection(false);
    }
  };

  // Türkçe karakterleri destekleyen e-posta validasyonu
  // Bazı özel Türkçe karakterler e-posta adreslerinde kullanılamaz ama bu fonksiyon
  // kullanıcı girişini kontrol ederken daha esnek davranır
  const validateEmail = (email: string) => {
    // Basit e-posta doğrulama
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Türkçe karakterler için input handler
  const handleTextInput = (text: string, setter: (text: string) => void) => {
    // Türkçe karakterlerin doğru işlenmesi için text'i olduğu gibi set ediyoruz
    setter(text);
  };

  const navigateToMain = () => {
    try {
      console.log('Giriş başarılı, kimlik durumu değiştiriliyor...');
      
      // Context7 best practice: Form verilerini temizle
      setEmail('');
      setPassword('');
      setError('');
      setLoginAttempts(0);
      
      // Success alert göster
      Alert.alert(
        "Giriş Başarılı",
        "Hoş geldiniz! Ana sayfaya yönlendiriliyorsunuz.",
        [{ 
          text: "Tamam",
          onPress: () => {
            // Alert onaylandıktan sonra kimlik durumunu değiştir
            refreshSession();
          }
        }]
      );
    } catch (error) {
      console.error('Kimlik durum değişimi hatası:', error);
      Alert.alert(
        "Giriş Hatası",
        "Giriş yapıldı ancak ana ekrana yönlendirilemedi. Lütfen uygulamayı yeniden başlatın."
      );
    }
  };

  const handleLogin = async () => {
    // Önce ağ bağlantısını kontrol et
    await checkNetworkConnection();
    if (!isConnected) {
      setError('İnternet bağlantınız yok. Lütfen bağlantınızı kontrol edin ve tekrar deneyin.');
      return;
    }
    
    setError('');
    
    // Form doğrulama
    if (!email || !password) {
      setError('Lütfen e-posta ve şifrenizi giriniz');
      return;
    }

    // E-posta formatı kontrolü
    if (!validateEmail(email)) {
      setError('Lütfen geçerli bir e-posta adresi giriniz');
      return;
    }

    setIsLoading(true);
    setLoginAttempts(prev => prev + 1);

    try {
      // Supabase ile giriş yapma - artık retry mekanizması ile
      const userData = await signInUser(email, password);
      console.log('Giriş işlemi başarılı:', userData ? 'Kullanıcı verileri alındı' : 'Veri yok');
      
      if (!userData || !userData.session) {
        console.error('Oturum bilgisi alınamadı');
        setError('E-posta veya şifre hatalı. Lütfen kontrol edip tekrar deneyin.');
        setIsLoading(false);
        return;
      }
      
      // Başarılı giriş durumunda, kullanıcıyı ana ekrana yönlendir
      console.log('Kimlik doğrulama başarılı, oturum durumu güncelleniyor...');
      
      // Kısa bir gecikme ekleyerek işlemin tamamlanmasını sağlayalım
      setTimeout(() => {
        try {
          navigateToMain();
        } catch (navError) {
          console.error('Navigasyon hatası:', navError);
          // Herhangi bir navigasyon hatası olursa kullanıcıyı bilgilendir
          Alert.alert(
            "Giriş Başarılı",
            "Ancak ana sayfaya yönlendirme sırasında bir sorun oluştu. Lütfen uygulamayı yeniden başlatın.",
            [{ text: "Tamam" }]
          );
        } finally {
          setIsLoading(false);
        }
      }, 500);
    } catch (err: any) {
      console.log('Giriş hatası:', err);
      setIsLoading(false);
      
      // Tüm işlemleri tek bir hata mesajına yönlendir
        setError('E-posta veya şifre hatalı. Lütfen kontrol edip tekrar deneyin.');
      
      // 3 veya daha fazla başarısız giriş denemesinde kullanıcıya ekstra yardım göster
      if (loginAttempts >= 3) {
        Alert.alert(
          "Giriş Sorunu",
          "Birkaç başarısız giriş denemesi yaptınız. İnternet bağlantınızı kontrol etmek ve önbelleği temizlemek ister misiniz?",
          [
            {
              text: "Hayır",
              style: "cancel"
            },
            { 
              text: "Evet", 
              onPress: () => {
                // İnternet bağlantısı kontrolü ve önbellek temizleme işlemi
                checkNetworkConnection();
                clearAppCache();
              }
            }
          ]
        );
      }
    }
  };
  
  // Önbelleği temizlemek için fonksiyon (basit bir önbellek temizliği)
  const clearAppCache = async () => {
    try {
      // Supabase oturum önbelleğini temizle
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      await AsyncStorage.removeItem('supabase.auth.token');
      await AsyncStorage.removeItem('supabase.auth.refreshToken');
      
      // E-posta ve şifre alanlarını temizle
      setEmail('');
      setPassword('');
      setError('');
      setLoginAttempts(0);
      
      Alert.alert(
        "Önbellek Temizlendi",
        "Uygulama önbelleği temizlendi. Şimdi tekrar giriş yapmayı deneyebilirsiniz."
      );
    } catch (error) {
      console.error('Önbellek temizleme hatası:', error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text style={styles.title}>İslami App'e Hoş Geldiniz</Text>
            <Text style={styles.subtitle}>
              Hesabınıza giriş yaparak devam edin
            </Text>
          </View>

          {error ? (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={20} color={COLORS.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.form}>
            <Input
              label="E-posta"
              placeholder="E-posta adresinizi girin"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
            />

            <Input
              label="Şifre"
              placeholder="Şifrenizi girin"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCorrect={false}
            />

            <Button
              title="Giriş Yap"
              onPress={handleLogin}
              isLoading={isLoading}
              style={styles.loginButton}
            />
            
            {/* Sorun yaşayanlar için yardım düğmesi */}
            {loginAttempts >= 2 && (
              <TouchableOpacity 
                style={styles.helpButton}
                onPress={() => {
                  Alert.alert(
                    "Giriş Yapamıyor musunuz?",
                    "1. İnternet bağlantınızı kontrol edin\n2. E-posta ve şifrenizi doğru girdiğinizden emin olun\n3. Uygulamayı kapatıp yeniden açmayı deneyin",
                    [
                      { text: "Tamam" },
                      { 
                        text: "Önbelleği Temizle", 
                        onPress: clearAppCache
                      }
                    ]
                  );
                }}
              >
                <Text style={styles.helpButtonText}>Giriş sorunu mu yaşıyorsunuz?</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Hesabınız yok mu?</Text>
            <Button
              title="Kayıt Ol"
              variant="outline"
              onPress={() => navigation.navigate('Register')}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: SPACING.lg,
  },
  header: {
    marginTop: SPACING.xl,
    marginBottom: SPACING.xl,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  form: {
    marginBottom: SPACING.xl,
  },
  loginButton: {
    marginTop: SPACING.md,
  },
  footer: {
    marginTop: SPACING.xl,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffebee',
    padding: SPACING.md,
    borderRadius: 8,
    marginBottom: SPACING.md,
  },
  errorText: {
    color: COLORS.error,
    marginLeft: 8,
    flex: 1,
  },
  helpButton: {
    marginTop: SPACING.md,
    alignItems: 'center',
    padding: SPACING.sm,
  },
  helpButtonText: {
    color: COLORS.primary,
    fontSize: 14,
    textDecorationLine: 'underline',
  },
}); 