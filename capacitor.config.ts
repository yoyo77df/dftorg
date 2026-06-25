import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.dftorg',
  appName: 'FFPBL MATCH',
  webDir: 'dist',
  server: {
    url: 'https://dftorftour.lovable.app',
    cleartext: true,
  },
};

export default config;