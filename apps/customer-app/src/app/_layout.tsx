import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useAppFonts, useTheme } from '@hillexpress/ui';
import { AuthProvider, useAuth } from '../lib/auth';
import { QueryProvider } from '../lib/query';
import { themeStorage } from '../lib/theme-storage';
import { APP_THEME_FORCE } from '../config';
import '../i18n';
import '../global.css';

// Splash holds until fonts AND session restore are done — no flash of system
// font, no flash of the wrong screen. First paint is the real app.
void SplashScreen.preventAutoHideAsync();

function Root() {
  const { colors, mode } = useTheme();
  const { status } = useAuth();
  const fontsLoaded = useAppFonts();
  const ready = fontsLoaded && status !== 'loading';

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.ground },
          animation: 'slide_from_right',
        }}
      />
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        {/* defaultMode="light": the app opens bright regardless of the phone's
            system theme; the Account screen toggle overrides and persists. */}
        <ThemeProvider force={APP_THEME_FORCE} defaultMode="light" storage={themeStorage}>
          <QueryProvider>
            <AuthProvider>
              <Root />
            </AuthProvider>
          </QueryProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
