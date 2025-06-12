import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  Modal,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { COLORS, SPACING } from '../../constants/theme';
import { updateUserProfile } from '../../lib/supabase';

interface EditProfileModalProps {
  visible: boolean;
  onClose: () => void;
  currentProfile: {
    name?: string;
    surname?: string;
    age?: number;
    gender?: string;
    sect?: string;
    city?: string;
  };
  onProfileUpdated: () => void;
}

const genderOptions = [
  { label: 'Erkek', value: 'male' },
  { label: 'Kadın', value: 'female' }
];

const sectOptions = [
  { label: 'Hanefi', value: 'hanefi' },
  { label: 'Şafii', value: 'safii' },
  { label: 'Maliki', value: 'maliki' },
  { label: 'Hanbeli', value: 'hanbeli' }
];

export function EditProfileModal({ 
  visible, 
  onClose, 
  currentProfile, 
  onProfileUpdated 
}: EditProfileModalProps) {
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('male');
  const [sect, setSect] = useState('hanefi');
  const [city, setCity] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showGenderPicker, setShowGenderPicker] = useState(false);
  const [showSectPicker, setShowSectPicker] = useState(false);

  // Sadece harf girişi için doğrulama fonksiyonu - Türkçe karakterleri destekleyen versiyon
  const onlyLettersRegex = /^[a-zA-ZçÇğĞıİöÖşŞüÜ\s]+$/;

  // Modal açıldığında mevcut profil verilerini set et
  useEffect(() => {
    if (visible && currentProfile) {
      setName(currentProfile.name || '');
      setSurname(currentProfile.surname || '');
      setAge(currentProfile.age ? currentProfile.age.toString() : '');
      setGender(currentProfile.gender || 'male');
      setSect(currentProfile.sect || 'hanefi');
      setCity(currentProfile.city || '');
    }
  }, [visible, currentProfile]);

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

  // Cinsiyet seçimi için custom picker
  const renderGenderSelector = () => {
    const selectedGenderLabel = genderOptions.find(option => option.value === gender)?.label || 'Seçiniz';
    
    return (
      <TouchableOpacity 
        style={styles.customPickerButton}
        onPress={() => setShowGenderPicker(true)}
        activeOpacity={0.7}
      >
        <Text style={styles.customPickerText}>{selectedGenderLabel}</Text>
        <MaterialIcons name="keyboard-arrow-down" size={24} color={COLORS.text} />
      </TouchableOpacity>
    );
  };

  // Mezhep seçimi için custom picker
  const renderSectSelector = () => {
    const selectedSectLabel = sectOptions.find(option => option.value === sect)?.label || 'Seçiniz';
    
    return (
      <TouchableOpacity 
        style={styles.customPickerButton}
        onPress={() => setShowSectPicker(true)}
        activeOpacity={0.7}
      >
        <Text style={styles.customPickerText}>{selectedSectLabel}</Text>
        <MaterialIcons name="keyboard-arrow-down" size={24} color={COLORS.text} />
      </TouchableOpacity>
    );
  };

  const handleSave = async () => {
    // Form validasyonu
    if (!name || !surname || !age || !city) {
      Alert.alert('Hata', 'Lütfen tüm gerekli alanları doldurunuz');
      return;
    }

    // Ad ve soyad sadece harflerden oluşmalı
    if (!onlyLettersRegex.test(name)) {
      Alert.alert('Hata', 'Ad sadece harflerden oluşmalıdır');
      return;
    }

    if (!onlyLettersRegex.test(surname)) {
      Alert.alert('Hata', 'Soyad sadece harflerden oluşmalıdır');
      return;
    }

    // Yaş sayısal değer olmalı
    if (isNaN(Number(age)) || Number(age) <= 0 || Number(age) > 120) {
      Alert.alert('Hata', 'Lütfen geçerli bir yaş giriniz (1-120)');
      return;
    }

    // Şehir sadece harflerden oluşmalı
    if (!onlyLettersRegex.test(city)) {
      Alert.alert('Hata', 'Şehir sadece harflerden oluşmalıdır');
      return;
    }

    setIsLoading(true);

    try {
      await updateUserProfile({
        name,
        surname,
        age: parseInt(age),
        gender,
        sect,
        city,
      });

      Alert.alert(
        'Başarılı',
        'Profiliniz başarıyla güncellendi!',
        [{ 
          text: 'Tamam', 
          onPress: () => {
            onProfileUpdated();
            onClose();
          }
        }]
      );
    } catch (error: any) {
      console.error('Profil güncelleme hatası:', error);
      Alert.alert(
        'Hata',
        error.message || 'Profil güncellenirken bir hata oluştu',
        [{ text: 'Tamam' }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <MaterialIcons name="close" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Profili Düzenle</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
          {/* Form */}
          <View style={styles.form}>
            {/* Ad */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Ad *</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={handleNameChange}
                placeholder="Adınızı girin"
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>

            {/* Soyad */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Soyad *</Text>
              <TextInput
                style={styles.input}
                value={surname}
                onChangeText={handleSurnameChange}
                placeholder="Soyadınızı girin"
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>

            {/* Yaş */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Yaş *</Text>
              <TextInput
                style={styles.input}
                value={age}
                onChangeText={handleAgeInput}
                placeholder="Yaşınızı girin"
                keyboardType="numeric"
              />
            </View>

            {/* Cinsiyet */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Cinsiyet</Text>
              {renderGenderSelector()}
            </View>

            {/* Mezhep */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Mezhep</Text>
              {renderSectSelector()}
            </View>

            {/* Şehir */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Şehir *</Text>
              <TextInput
                style={styles.input}
                value={city}
                onChangeText={handleCityChange}
                placeholder="Şehrinizi girin"
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>
          </View>

          {/* Kaydet Butonu */}
          <TouchableOpacity 
            style={[styles.saveButton, isLoading && styles.saveButtonDisabled]} 
            onPress={handleSave}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <MaterialIcons name="save" size={20} color="#fff" />
                <Text style={styles.saveButtonText}>Kaydet</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>

        {/* Cinsiyet Picker Modal */}
        <Modal
          visible={showGenderPicker}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowGenderPicker(false)}
        >
          <TouchableOpacity 
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowGenderPicker(false)}
          >
            <View style={styles.pickerModal}>
              <View style={styles.pickerHeader}>
                <TouchableOpacity onPress={() => setShowGenderPicker(false)}>
                  <Text style={styles.pickerCancelText}>İptal</Text>
                </TouchableOpacity>
                <Text style={styles.pickerTitle}>Cinsiyet Seçin</Text>
                <TouchableOpacity onPress={() => setShowGenderPicker(false)}>
                  <Text style={styles.pickerDoneText}>Tamam</Text>
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.optionsContainer}>
                {genderOptions.map((item) => (
                  <TouchableOpacity
                    key={item.value}
                    style={[
                      styles.optionItem,
                      gender === item.value && styles.selectedOptionItem
                    ]}
                    onPress={() => {
                      setGender(item.value);
                      setShowGenderPicker(false);
                    }}
                  >
                    <Text style={[
                      styles.optionText,
                      gender === item.value && styles.selectedOptionText
                    ]}>
                      {item.label}
                    </Text>
                    {gender === item.value && (
                      <MaterialIcons name="check" size={24} color={COLORS.primary} />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Mezhep Picker Modal */}
        <Modal
          visible={showSectPicker}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowSectPicker(false)}
        >
          <TouchableOpacity 
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowSectPicker(false)}
          >
            <View style={styles.pickerModal}>
              <View style={styles.pickerHeader}>
                <TouchableOpacity onPress={() => setShowSectPicker(false)}>
                  <Text style={styles.pickerCancelText}>İptal</Text>
                </TouchableOpacity>
                <Text style={styles.pickerTitle}>Mezhep Seçin</Text>
                <TouchableOpacity onPress={() => setShowSectPicker(false)}>
                  <Text style={styles.pickerDoneText}>Tamam</Text>
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.optionsContainer}>
                {sectOptions.map((item) => (
                  <TouchableOpacity
                    key={item.value}
                    style={[
                      styles.optionItem,
                      sect === item.value && styles.selectedOptionItem
                    ]}
                    onPress={() => {
                      setSect(item.value);
                      setShowSectPicker(false);
                    }}
                  >
                    <Text style={[
                      styles.optionText,
                      sect === item.value && styles.selectedOptionText
                    ]}>
                      {item.label}
                    </Text>
                    {sect === item.value && (
                      <MaterialIcons name="check" size={24} color={COLORS.primary} />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  closeButton: {
    padding: SPACING.sm,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
  },
  form: {
    paddingVertical: SPACING.lg,
  },
  inputGroup: {
    marginBottom: SPACING.lg,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: SPACING.md,
    fontSize: 16,
    color: COLORS.text,
    backgroundColor: COLORS.card,
  },
  customPickerButton: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: SPACING.md,
    backgroundColor: COLORS.card,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 50,
  },
  customPickerText: {
    fontSize: 16,
    color: COLORS.text,
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  pickerModal: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  pickerCancelText: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  pickerDoneText: {
    fontSize: 16,
    color: COLORS.primary,
    fontWeight: '600',
  },
  optionsContainer: {
    maxHeight: 300,
    paddingHorizontal: SPACING.lg,
  },
  optionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    marginVertical: SPACING.xs,
    borderRadius: 8,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  selectedOptionItem: {
    backgroundColor: COLORS.primary + '10',
    borderColor: COLORS.primary,
  },
  optionText: {
    fontSize: 16,
    color: COLORS.text,
    flex: 1,
  },
  selectedOptionText: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    padding: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xl,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: SPACING.sm,
  },
}); 