import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tradeplaza.app',
  appName: 'TradePlaza',
  webDir: 'dist',
  // Loads the live site instead of a bundled snapshot — every future
  // App.jsx update just needs a normal GitHub upload + Vercel redeploy,
  // no Xcode rebuild required, unless you change something native
  // (permissions, plugins, app icon, etc).
  // IMPORTANT: this points at tradeplaza.app — only works once that domain
  // is actually connected to your Vercel project (Vercel → Settings →
  // Domains → add tradeplaza.app, then update its DNS as Vercel instructs).
  // Until that's done, this will fail to load — check with your Vercel
  // dashboard, or temporarily point this back at your working
  // *.vercel.app URL if tradeplaza.app isn't live yet.
  server: {
    url: 'https://tradeplaza.app',
    cleartext: true,
  },
};

export default config;
