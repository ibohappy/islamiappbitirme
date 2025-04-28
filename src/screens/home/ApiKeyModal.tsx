import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  Linking,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SPACING } from '../../constants/theme';
import { saveApiKey } from '../../services/prayerTimesService';

interface ApiKeyModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: () => void;
}

export function ApiKeyModal({
  visible,
  onClose,
  onSave,
}: ApiKeyModalProps) {
  const [apiKey, setApiKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!apiKey.trim()) {
      setError('API anahtarı boş olamaz');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const success = await saveApiKey(apiKey.trim());
      
      if (success) {
        setApiKey('');
        onSave();
      } else {
        setError('API anahtarı kaydedilemedi');
      }
    } catch (error) {
      setError('Bir hata oluştu');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const openApiWebsite = () => {
    Linking.openURL('https://collectapi.com/tr/api/pray/namaz-vakitleri-api');
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>API Anahtarı Girin</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <MaterialCommunityIcons
                name="close"
                size={24}
                color={COLORS.text}
              />
            </TouchableOpacity>
          </View>

          <Text style={styles.description}>
            Namaz vakitlerini görüntülemek için CollectAPI'den bir API anahtarı gereklidir.
          </Text>

          <TouchableOpacity onPress={openApiWebsite} style={styles.linkButton}>
            <Text style={styles.linkText}>
              API anahtarı almak için tıklayın
            </Text>
            <MaterialCommunityIcons
              name="open-in-new"
              size={16}
              color={COLORS.primary}
            />
          </TouchableOpacity>

          <TextInput
            style={styles.input}
            placeholder="API anahtarınızı girin"
            value={apiKey}
            onChangeText={setApiKey}
            autoCapitalize="none"
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onClose}
            >
              <Text style={styles.cancelButtonText}>İptal</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.button,
                styles.saveButton,
                (!apiKey.trim() || isLoading) && styles.disabledButton,
              ]}
              onPress={handleSave}
              disabled={!apiKey.trim() || isLoading}
            >
              <Text style={styles.saveButtonText}>
                {isLoading ? 'Kaydediliyor...' : 'Kaydet'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    backgroundColor: COLORS.background,
    borderRadius: SPACING.md,
    padding: SPACING.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  closeButton: {
    padding: SPACING.xs,
  },
  description: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  linkText: {
    fontSize: 14,
    color: COLORS.primary,
    marginRight: SPACING.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: SPACING.sm,
    padding: SPACING.md,
    fontSize: 16,
    marginBottom: SPACING.md,
  },
  errorText: {
    color: COLORS.error,
    marginBottom: SPACING.md,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  button: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: SPACING.sm,
    marginLeft: SPACING.sm,
  },
  cancelButton: {
    backgroundColor: COLORS.card,
  },
  saveButton: {
    backgroundColor: COLORS.primary,
  },
  disabledButton: {
    backgroundColor: COLORS.textSecondary,
  },
  cancelButtonText: {
    color: COLORS.text,
    fontWeight: '500',
  },
  saveButtonText: {
    color: COLORS.background,
    fontWeight: '500',
  },
}); 