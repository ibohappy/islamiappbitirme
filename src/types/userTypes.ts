/**
 * Kullanıcı profil bilgilerini içeren arayüz
 */
export interface UserProfile {
  user_id?: string;
  email?: string;
  name?: string;
  surname?: string;
  gender?: string;  // 'male', 'female', 'other'
  sect?: string;    // 'Hanefi', 'Şafi', 'Maliki', 'Hanbeli' gibi
  city?: string;
  age?: number;
  created_at?: string;
  updated_at?: string;
} 

/**
 * Global namespace için type tanımlamaları
 */
declare global {
  var profileUpdateListeners: (() => void)[] | undefined;
} 