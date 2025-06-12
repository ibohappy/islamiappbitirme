import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SPACING } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import { getUserProfile } from '../../lib/supabase';
import { EditProfileModal } from './EditProfileModal';
import { ChangePasswordModal } from './ChangePasswordModal';

interface UserProfile {
  user_id: string;
  email: string;
  name?: string;
  surname?: string;
  age?: number;
  gender?: string;
  sect?: string;
  city?: string;
}



export function ProfileScreen() {
  const { user, signOut, isLoading: authLoading } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);

  // Profil verilerini yükle
  const loadProfile = async () => {
    try {
      setIsLoading(true);
      
      // Profil verilerini getir
      const profileData = await getUserProfile();
      if (profileData) {
        setProfile(profileData);
      }
    } catch (error) {
      console.error('Profil yükleme hatası:', error);
      Alert.alert(
        'Hata',
        'Profil bilgileri yüklenirken bir hata oluştu.',
        [{ text: 'Tamam' }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Pull to refresh
  const onRefresh = async () => {
    setRefreshing(true);
    await loadProfile();
    setRefreshing(false);
  };

  // Logout işlemi
  const handleLogout = () => {
    Alert.alert(
      'Çıkış Yap',
      'Hesabınızdan çıkış yapmak istediğinizden emin misiniz?',
      [
        {
          text: 'İptal',
          style: 'cancel',
        },
        {
          text: 'Çıkış Yap',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
              Alert.alert(
                'Başarılı',
                'Hesabınızdan başarıyla çıkış yaptınız.',
                [{ text: 'Tamam' }]
              );
            } catch (error) {
              console.error('Logout hatası:', error);
              Alert.alert(
                'Hata',
                'Çıkış yaparken bir hata oluştu. Lütfen tekrar deneyin.',
                [{ text: 'Tamam' }]
              );
            }
          },
        },
      ]
    );
  };

  // Profil düzenleme modalını aç
  const handleEditProfile = () => {
    setEditModalVisible(true);
  };

  // Şifre değiştirme modalını aç
  const handleChangePassword = () => {
    setPasswordModalVisible(true);
  };

  // Profil güncellendikten sonra verileri yenile
  const handleProfileUpdated = () => {
    loadProfile();
    
    // İmamAI ekranına profil güncellendiği bilgisini gönder (global event)
    // Bu sayede açık olan ImamAI ekranları profil değişikliğini anlayacak
    if (global.profileUpdateListeners) {
      global.profileUpdateListeners.forEach((listener: () => void) => listener());
    }
  };

  useEffect(() => {
    if (user) {
      loadProfile();
    }
  }, [user]);

  if (authLoading || isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Profil yükleniyor...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            <MaterialCommunityIcons
              name="account-circle"
              size={80}
              color={COLORS.primary}
            />
          </View>
          <Text style={styles.welcomeText}>Hoş Geldiniz</Text>
          <Text style={styles.nameText}>
            {profile?.name && profile?.surname
              ? `${profile.name} ${profile.surname}`
              : 'Kullanıcı'}
          </Text>
        </View>

        {/* Profil Bilgileri */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Kişisel Bilgiler</Text>
          
          <View style={styles.infoCard}>
            <ProfileInfoItem
              icon="email"
              label="E-posta"
              value={profile?.email || user?.email || 'Belirtilmemiş'}
            />
            
            {profile?.age && (
              <ProfileInfoItem
                icon="cake"
                label="Yaş"
                value={profile.age.toString()}
              />
            )}
            
            {profile?.gender && (
              <ProfileInfoItem
                icon="human-male-female"
                label="Cinsiyet"
                value={profile.gender === 'male' ? 'Erkek' : 'Kadın'}
              />
            )}
            
            {profile?.sect && (
              <ProfileInfoItem
                icon="book-open-variant"
                label="Mezhep"
                value={
                  profile.sect === 'hanefi' ? 'Hanefi' :
                  profile.sect === 'safii' ? 'Şafii' :
                  profile.sect === 'maliki' ? 'Maliki' :
                  profile.sect === 'hanbeli' ? 'Hanbeli' :
                  profile.sect.charAt(0).toUpperCase() + profile.sect.slice(1)
                }
              />
            )}
            
            {profile?.city && (
              <ProfileInfoItem
                icon="map-marker"
                label="Şehir"
                value={profile.city}
              />
            )}
          </View>
        </View>



        {/* Ayarlar */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Hesap İşlemleri</Text>
          
          <TouchableOpacity style={styles.settingsItem} onPress={handleEditProfile}>
            <MaterialIcons name="edit" size={24} color={COLORS.text} />
            <Text style={styles.settingsText}>Profili Düzenle</Text>
            <MaterialIcons name="arrow-forward-ios" size={16} color={COLORS.textSecondary} />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.settingsItem} onPress={handleChangePassword}>
            <MaterialIcons name="security" size={24} color={COLORS.text} />
            <Text style={styles.settingsText}>Şifre Değiştir</Text>
            <MaterialIcons name="arrow-forward-ios" size={16} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Logout Button */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <MaterialIcons name="logout" size={24} color="#fff" />
            <Text style={styles.logoutText}>Çıkış Yap</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Profil Düzenleme Modalı */}
      <EditProfileModal
        visible={editModalVisible}
        onClose={() => setEditModalVisible(false)}
        currentProfile={{
          name: profile?.name,
          surname: profile?.surname,
          age: profile?.age,
          gender: profile?.gender,
          sect: profile?.sect,
          city: profile?.city,
        }}
        onProfileUpdated={handleProfileUpdated}
      />

      {/* Şifre Değiştirme Modalı */}
      <ChangePasswordModal
        visible={passwordModalVisible}
        onClose={() => setPasswordModalVisible(false)}
      />
    </SafeAreaView>
  );
}

// Profil bilgi öğesi bileşeni
const ProfileInfoItem: React.FC<{
  icon: string;
  label: string;
  value: string;
}> = ({ icon, label, value }) => (
  <View style={styles.infoItem}>
    <MaterialCommunityIcons name={icon as any} size={20} color={COLORS.primary} />
    <View style={styles.infoContent}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: SPACING.xl,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: SPACING.md,
    color: COLORS.text,
    fontSize: 16,
  },
  header: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    backgroundColor: COLORS.card,
    marginBottom: SPACING.lg,
  },
  avatarContainer: {
    marginBottom: SPACING.md,
  },
  welcomeText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  nameText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  section: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  infoCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: SPACING.md,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  infoContent: {
    marginLeft: SPACING.md,
    flex: 1,
  },
  infoLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 16,
    color: COLORS.text,
    fontWeight: '500',
  },

  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  settingsText: {
    flex: 1,
    marginLeft: SPACING.md,
    fontSize: 16,
    color: COLORS.text,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.error,
    borderRadius: 12,
    padding: SPACING.md,
  },
  logoutText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: SPACING.sm,
  },
}); 