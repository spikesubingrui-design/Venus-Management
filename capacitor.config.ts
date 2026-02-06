import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.venus.kindergarten',
  appName: '金星幼儿园',
  webDir: 'dist',
  android: {
    backgroundColor: '#1e293b',
    allowMixedContent: true
  },
  server: {
    androidScheme: 'https'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#1e293b',
      showSpinner: false,
      androidSpinnerStyle: 'large',
      spinnerColor: '#f59e0b'
    }
  }
};

export default config;
