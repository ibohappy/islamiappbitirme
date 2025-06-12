// React Native Vector Icons için tip tanımları
declare module 'react-native-vector-icons/MaterialCommunityIcons';
declare module 'react-native-vector-icons/Ionicons';
declare module 'react-native-vector-icons/FontAwesome';
declare module 'react-native-vector-icons/FontAwesome5';
declare module 'react-native-vector-icons/Octicons';
declare module 'react-native-vector-icons/AntDesign';

// React Navigation için güncellenmiş tip tanımları
declare module '@react-navigation/native' {
  // React Navigation 7 ile NavigationContainerRef generic artık farklı
  export interface NavigationContainerRef {
    navigate: (name: string, params?: any) => void;
    resetRoot: (state: any) => void;
    dispatch: (action: any) => void;
    getRootState: () => any;
    getCurrentRoute: () => any;
    getCurrentOptions: () => any;
  }
  
  export function NavigationContainer(props: any): JSX.Element;
  export function useNavigation(): any;
  export function useRoute(): any;
  export function useFocusEffect(effect: () => (() => void) | undefined | void): void;
}

declare module '@react-navigation/native-stack' {
  export function createNativeStackNavigator(): {
    Navigator: React.ComponentType<any>;
    Screen: React.ComponentType<any>;
  };
  
  // NativeStackScreenProps type'ını ekledik
  export type NativeStackScreenProps<
    ParamList extends Record<string, object | undefined>,
    RouteName extends keyof ParamList = string
  > = {
    navigation: any;
    route: {
      key: string;
      name: RouteName;
      params: ParamList[RouteName];
    };
  };
}

declare module '@react-navigation/bottom-tabs' {
  export function createBottomTabNavigator(): {
    Navigator: React.ComponentType<any>;
    Screen: React.ComponentType<any>;
  };
}

// Diğer kütüphaneler için tip tanımları
declare module '@react-native-community/netinfo' {
  export interface NetInfoState {
    isConnected: boolean;
    isInternetReachable: boolean | null;
    type: string;
    details: any;
  }
  
  // addEventListener güncellendi - fonksiyon çağrılabilir değil
  export function addEventListener(
    listener: (state: NetInfoState) => void
  ): { remove: () => void };
  
  export function fetch(): Promise<NetInfoState>;
}

declare module 'expo-splash-screen' {
  export function preventAutoHideAsync(): Promise<void>;
  export function hideAsync(): Promise<void>;
}

// Babel için tip tanımları
declare module '@babel/core';
declare module '@babel/generator';
declare module '@babel/template';
declare module '@babel/traverse';

// Istanbul için tip tanımları
declare module 'istanbul-lib-coverage';
declare module 'istanbul-lib-report';
declare module 'istanbul-reports';

// Diğer tip tanımları
declare module 'phoenix';
declare module 'ws';

// Font dosyaları için tip tanımları
declare module '*.ttf' {
  const content: any;
  export default content;
}

// İkon dosyaları için tip tanımları
declare module '*.png';
declare module '*.jpg';
declare module '*.jpeg';
declare module '*.svg'; 