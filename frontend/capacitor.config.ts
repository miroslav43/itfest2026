import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.solemtrix.app",
  appName: "Solemtrix",
  webDir: "out",
  server: {
    // Use https scheme so the WebView has a secure context (needed for
    // microphone access, Web Speech API, and Picovoice).
    androidScheme: "https",
  },
  android: {
    // Allow mixed content so the app can reach an HTTP backend during dev.
    // In production, point NEXT_PUBLIC_API_URL to an HTTPS endpoint and
    // remove this flag.
    allowMixedContent: true,
    backgroundColor: "#0a0a0f",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: "#0a0a0f",
      androidSplashResourceName: "splash",
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#0a0a0f",
    },
  },
};

export default config;
