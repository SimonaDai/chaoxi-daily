import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.chaoxi.daily',
  appName: '朝夕●一日一记',
  webDir: 'dist',
  android: { backgroundColor: '#faf9f5', allowMixedContent: false },
  plugins: { LocalNotifications: { smallIcon: 'ic_stat_calendar', iconColor: '#335c46' } },
};

export default config;
