import React, { useState, useContext } from 'react';
import {
  View,
  StyleSheet,
  Text,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/types';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { COLORS, SPACING } from '../../constants/theme';
import { Picker } from '@react-native-picker/picker';
import { signUpUser } from '../../lib/supabase';
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AuthContext } from '../../contexts/AuthContext';
import { MaterialIcons } from '@expo/vector-icons';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

// Cinsiyet seçenekleri
const genderOptions = [
  { label: 'Erkek', value: 'male' },
  { label: 'Kadın', value: 'female' }
];

// Mezhep seçenekleri
const sectOptions = [
  { label: 'Hanefi', value: 'hanefi' },
  { label: 'Şafii', value: 'safii' },
  { label: 'Maliki', value: 'maliki' },
  { label: 'Hanbeli', value: 'hanbeli' }
];

// .env dosyasından değerleri doğru şekilde aldığından emin olun
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || '';
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || '';

// Supabase istemcisini oluştur
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage as any,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export function RegisterScreen({ navigation }: Props) {
  // Form state'leri
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('male');
  const [sect, setSect] = useState('hanefi');
  const [city, setCity] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // UI state'leri
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState('');
  
  // Picker modali için state'ler
  const [showGenderPicker, setShowGenderPicker] = useState(false);
  const [showSectPicker, setShowSectPicker] = useState(false);

  // AuthContext'ten setIsAuthenticated fonksiyonunu al
  const { setIsAuthenticated } = useContext(AuthContext);

  // Sadece harf girişi için doğrulama fonksiyonu - Türkçe karakterleri destekleyen versiyon
  const onlyLettersRegex = /^[a-zA-ZçÇğĞıİöÖşŞüÜ\s]+$/;
  
  // Ad için doğrulama
  const handleNameChange = (text: string) => {
    if (text === '' || onlyLettersRegex.test(text)) {
      setName(text);
    }
  };

  // Soyad için doğrulama
  const handleSurnameChange = (text: string) => {
    if (text === '' || onlyLettersRegex.test(text)) {
      setSurname(text);
    }
  };

  // Yaş alanı için özel handler
  const handleAgeInput = (text: string) => {
    // Sadece sayıları kabul et
    if (text === '' || /^\d+$/.test(text)) {
      setAge(text);
    }
  };

  // Şehir için doğrulama
  const handleCityChange = (text: string) => {
    if (text === '' || onlyLettersRegex.test(text)) {
      setCity(text);
    }
  };

  // E-posta için doğrulama
  const handleEmailChange = (text: string) => {
    setEmail(text);
    setEmailError('');
  };

  // E-posta doğrulaması (API ile)
  const validateEmail = async (email: string) => {
    // Basit e-posta doğrulama
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setEmailError('Lütfen geçerli bir e-posta adresi giriniz');
      return false;
    }

    try {
      // E-posta doğrulama servisi kullanımı - örnek bir API çağrısı
      // Gerçek bir API kullanabilirsiniz, şimdilik sadece format kontrolü yapıyoruz
      const [username, domain] = email.split('@');
      
      // Popüler e-posta domainleri için basit bir kontrol
      const popularDomains = ['gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com', 'icloud.com', 'yandex.com', 'protonmail.com'];
      
      if (!popularDomains.includes(domain.toLowerCase()) && domain.split('.').length < 2) {
        setEmailError('Geçersiz e-posta domaini');
        return false;
      }

      return true;
    } catch (error) {
      setEmailError('E-posta doğrulaması sırasında bir hata oluştu');
      return false;
    }
  };

  const handleRegister = async () => {
    setError('');
    setEmailError('');

    // Form validasyonu
    if (!name || !surname || !age || !city || !email || !password || !confirmPassword) {
      setError('Lütfen tüm gerekli alanları doldurunuz');
      return;
    }

    // Ad ve soyad sadece harflerden oluşmalı
    if (!onlyLettersRegex.test(name)) {
      setError('Ad sadece harflerden oluşmalıdır');
      return;
    }

    if (!onlyLettersRegex.test(surname)) {
      setError('Soyad sadece harflerden oluşmalıdır');
      return;
    }

    // Yaş sayısal değer olmalı
    if (isNaN(Number(age)) || Number(age) <= 0) {
      setError('Lütfen geçerli bir yaş giriniz');
      return;
    }

    // Şehir sadece harflerden oluşmalı
    if (!onlyLettersRegex.test(city)) {
      setError('Şehir sadece harflerden oluşmalıdır');
      return;
    }

    // E-posta validasyonu
    const isEmailValid = await validateEmail(email);
    if (!isEmailValid) {
      return;
    }

    // Şifre kontrolü
    if (password.length < 6) {
      setError('Şifre en az 6 karakter olmalıdır');
      return;
    }

    if (password !== confirmPassword) {
      setError('Şifreler eşleşmiyor');
      return;
    }

    setIsLoading(true);

    try {
      console.log('Gönderilecek kullanıcı verileri:', {
        name,
        surname,
        age: parseInt(age),
        gender,
        sect,
        city,
      });
      
      // Supabase ile Kayıt İşlemi
      const result = await signUpUser(email, password, {
        name,
        surname,
        age: parseInt(age),
        gender,
        sect,
        city,
      });
      
      console.log('Kayıt sonucu:', result?.user ? 'Kullanıcı oluşturuldu' : 'Kullanıcı oluşturulamadı');
      
      // Başarılı kayıt için kullanıcıya bildirim
      Alert.alert(
        "Kayıt Başarılı", 
        "Hesabınız başarıyla oluşturuldu! Otomatik olarak giriş yapılıyor...",
        [{ 
          text: "Tamam", 
          onPress: () => {
            // Auth Context kullanarak kimlik durumunu değiştir
            // Bu, AppNavigator'da isAuthenticated değerini değiştirecek ve 
            // otomatik olarak Main ekranına yönlendirecek
            setIsAuthenticated(true);
          }
        }]
      );
      
    } catch (err: any) {
      // Hata mesajını kontrol edip kullanıcıya anlaşılır mesaj göster
      let errorMessage = 'Kayıt sırasında bir hata oluştu';
      
      if (err.message?.includes('already registered')) {
        errorMessage = 'Bu e-posta adresi ile daha önce kayıt yapılmış.';
      } else if (err.message?.includes('Email not confirmed')) {
        errorMessage = 'E-posta adresiniz henüz doğrulanmamış. Lütfen e-postanızı kontrol edin.';
      } else if (err.message?.includes('Bu e-posta adresi zaten kullanılıyor')) {
        errorMessage = 'Bu e-posta adresi ile daha önce kayıt yapılmış.';
      } else if (err.message?.includes('network') || 
                err.message?.includes('Network') || 
                err.message?.includes('İnternet bağlantınızı')) {
        errorMessage = 'İnternet bağlantınızı kontrol edin ve tekrar deneyin.';
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Seçenek bulma işlevi
  const findOptionLabel = (options: Array<{label: string, value: string}>, value: string) => {
    const option = options.find(option => option.value === value);
    return option ? option.label : '';
  };

  // Platform bazlı Picker bileşeni
  const renderPicker = (value: string, options: Array<{label: string, value: string}>, showModal: boolean, setShowModal: (show: boolean) => void, onValueChange: (value: string) => void, label: string) => {
    if (Platform.OS === 'ios') {
      // iOS için özel bir çözüm
      return (
        <View style={styles.pickerContainer}>
          <Text style={styles.inputLabel}>{label}</Text>
          <TouchableOpacity 
            style={styles.pickerButton}
            onPress={() => setShowModal(true)}
          >
            <Text style={styles.pickerButtonText}>{findOptionLabel(options, value)}</Text>
          </TouchableOpacity>
          
          <Modal
            visible={showModal}
            animationType="slide"
            transparent={true}
          >
            <View style={styles.modalContainer}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{label} Seçin</Text>
                  <TouchableOpacity 
                    onPress={() => setShowModal(false)}
                    style={styles.modalCloseButton}
                  >
                    <Text style={styles.modalCloseText}>Tamam</Text>
                  </TouchableOpacity>
                </View>
                
                <View style={styles.pickerWrapperInModal}>
                  {options.map((item) => (
                    <TouchableOpacity
                      key={item.value}
                      style={[
                        styles.pickerOption,
                        value === item.value && styles.pickerOptionSelected
                      ]}
                      onPress={() => {
                        onValueChange(item.value);
                        setShowModal(false);
                      }}
                    >
                      <Text style={[
                        styles.pickerOptionText,
                        value === item.value && styles.pickerOptionTextSelected
                      ]}>
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          </Modal>
        </View>
      );
    } else { // Android için
      return (
        <View style={styles.pickerContainer}>
          <Text style={styles.inputLabel}>{label}</Text>
          <View style={styles.pickerWrapper}>
            <Picker
              selectedValue={value}
              onValueChange={onValueChange}
              style={styles.picker}
              dropdownIconColor={COLORS.text}
              mode="dropdown"
            >
              {options.map((item) => (
                <Picker.Item key={item.value} label={item.label} value={item.value} color={COLORS.text} />
              ))}
            </Picker>
          </View>
        </View>
      );
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
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => navigation.navigate('Login')}
            hitSlop={{top: 15, bottom: 15, left: 15, right: 15}}
          >
            <MaterialIcons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          
          <View style={styles.header}>
            <Text style={styles.title}>Yeni Hesap Oluştur</Text>
            <Text style={styles.subtitle}>
              İslami App'i kullanmak için hesap oluşturun
            </Text>
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.form}>
            <Input
              label="Ad"
              placeholder="Adınızı girin"
              value={name}
              onChangeText={handleNameChange}
              autoCapitalize="words"
              autoCorrect={false}
            />

            <Input
              label="Soyad"
              placeholder="Soyadınızı girin"
              value={surname}
              onChangeText={handleSurnameChange}
              autoCapitalize="words"
              autoCorrect={false}
            />

            <Input
              label="Yaş"
              placeholder="Yaşınızı girin"
              value={age}
              onChangeText={handleAgeInput}
              keyboardType="numeric"
            />

            {renderPicker(gender, genderOptions, showGenderPicker, setShowGenderPicker, setGender, "Cinsiyet")}
            
            {renderPicker(sect, sectOptions, showSectPicker, setShowSectPicker, setSect, "Mezhep")}

            <Input
              label="Şehir"
              placeholder="Şehrinizi girin"
              value={city}
              onChangeText={handleCityChange}
              autoCapitalize="words"
              autoCorrect={false}
            />

            <Input
              label="E-posta"
              placeholder="E-posta adresinizi girin"
              value={email}
              onChangeText={handleEmailChange}
              autoCapitalize="none"
              keyboardType="email-address"
              error={emailError}
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

            <Input
              label="Şifre Tekrar"
              placeholder="Şifrenizi tekrar girin"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoCorrect={false}
            />

            <Button
              title="Kayıt Ol"
              onPress={handleRegister}
              isLoading={isLoading}
              style={styles.registerButton}
            />
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Zaten hesabınız var mı?</Text>
            <Button
              title="Giriş Yap"
              variant="outline"
              onPress={() => navigation.navigate('Login')}
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
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: SPACING.sm,
  },
  header: {
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
  registerButton: {
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
  errorText: {
    color: COLORS.error,
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
    marginBottom: 6,
  },
  pickerContainer: {
    marginBottom: SPACING.md,
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    backgroundColor: COLORS.card,
  },
  picker: {
    height: 50,
    color: COLORS.text,
  },
  pickerButton: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    backgroundColor: COLORS.card,
    height: 50,
    justifyContent: 'center',
    paddingHorizontal: SPACING.md,
  },
  pickerButtonText: {
    color: COLORS.text,
    fontSize: 16,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: SPACING.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  modalCloseButton: {
    padding: SPACING.sm,
  },
  modalCloseText: {
    color: COLORS.primary,
    fontWeight: 'bold',
  },
  pickerItemStyle: {
    fontSize: 16,
    height: 120,
    color: COLORS.text
  },
  pickerWrapperInModal: {
    paddingVertical: SPACING.md,
  },
  pickerOption: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  pickerOptionSelected: {
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
  },
  pickerOptionText: {
    fontSize: 16,
    color: COLORS.text,
    textAlign: 'center',
  },
  pickerOptionTextSelected: {
    color: COLORS.primary,
    fontWeight: 'bold',
  },
}); 