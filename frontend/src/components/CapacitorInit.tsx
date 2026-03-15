"use client";

import { useEffect } from "react";

/**
 * Initialises Capacitor native plugins (StatusBar, SplashScreen) on app mount.
 * Plugins are imported lazily so the web build is unaffected when they are absent.
 * This component renders nothing — mount it once in the root layout.
 */
export default function CapacitorInit() {
  useEffect(() => {
    async function init() {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (!Capacitor.isNativePlatform()) return;

        const [{ StatusBar, Style }, { SplashScreen }] = await Promise.all([
          import("@capacitor/status-bar"),
          import("@capacitor/splash-screen"),
        ]);

        await StatusBar.setStyle({ style: Style.Dark });
        await StatusBar.setBackgroundColor({ color: "#0a0a0f" });

        // Hide the splash screen after the first render completes.
        await SplashScreen.hide({ fadeOutDuration: 300 });
      } catch {
        // Not running on a native platform — ignore gracefully.
      }
    }

    init();
  }, []);

  return null;
}
