import { createContext } from 'react';

// Auth context için tip tanımı
export type AuthContextType = {
  isAuthenticated: boolean;
  setIsAuthenticated: (value: boolean) => void;
  isLoading: boolean;
};

// Varsayılan değerlerle AuthContext oluştur
export const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  setIsAuthenticated: () => {},
  isLoading: true,
}); 