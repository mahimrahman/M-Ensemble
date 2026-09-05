import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Loading } from '@/components';
import { LangProvider, useLang } from '@/i18n';
import { AuthProvider, useAuth } from '@/store/auth';
import { SavedProvider } from '@/store/saved';
import { colors } from '@/theme';
import { useAppFonts } from '@/theme/fonts';

// Held until the fonts are in — the design lands wrong for a frame otherwise.
void SplashScreen.preventAutoHideAsync();

/**
 * Sends you where the session says you belong:
 *   no session      → auth stack
 *   new account     → onboarding (follow a mosque, pick interests)
 *   otherwise       → the tabs
 */
function RootNavigator() {
  const { status, needsOnboarding } = useAuth();
  const { t } = useLang();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return;

    const inAuthGroup = segments[0] === '(auth)';
    const inOnboarding = segments[0] === 'onboarding';

    if (status === 'unauthenticated') {
      if (!inAuthGroup) router.replace('/login');
      return;
    }

    if (needsOnboarding) {
      if (!inOnboarding) router.replace('/onboarding');
      return;
    }

    if (inAuthGroup || inOnboarding) router.replace('/');
  }, [status, needsOnboarding, segments, router]);

  if (status === 'loading') {
    return <Loading label={t.loading} />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        // The prototype slides between screens; this is that, natively.
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
      <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
      <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
      {/* member */}
      <Stack.Screen name="post/[id]" />
      <Stack.Screen name="mosque/[id]" />
      <Stack.Screen name="prayer-month/[mosqueId]" />
      <Stack.Screen name="checkin/[postId]" options={{ animation: 'slide_from_bottom' }} />
      {/* coordinator — every screen re-checks the role through the API */}
      <Stack.Screen name="manage/create" options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="manage/posts" />
      <Stack.Screen name="manage/iqamah" />
      <Stack.Screen name="manage/coverage/[id]" />
      <Stack.Screen name="manage/checkin/[id]" options={{ animation: 'slide_from_bottom' }} />
    </Stack>
  );
}

export default function RootLayout() {
  const fontsReady = useAppFonts();

  const onLayout = useCallback(() => {
    if (fontsReady) void SplashScreen.hideAsync();
  }, [fontsReady]);

  if (!fontsReady) return null;

  return (
    <SafeAreaProvider>
      <View style={{ flex: 1, backgroundColor: colors.background }} onLayout={onLayout}>
        {/* The masthead runs under the status bar, so its text is light. */}
        <StatusBar style="light" />
        <LangProvider>
          <AuthProvider>
            <SavedProvider>
              <RootNavigator />
            </SavedProvider>
          </AuthProvider>
        </LangProvider>
      </View>
    </SafeAreaProvider>
  );
}
