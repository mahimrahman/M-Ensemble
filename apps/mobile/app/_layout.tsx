import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DialogProvider, Loading } from '@/components';
import { LangProvider, useLang } from '@/i18n';
import { AdminMosqueProvider } from '@/store/adminMosque';
import { AuthProvider, useAuth } from '@/store/auth';
import { LocationProvider } from '@/store/location';
import { SavedProvider } from '@/store/saved';
import { StarredProvider } from '@/store/starred';
import { colors } from '@/theme';
import { usePushSetup } from '@/hooks/usePushSetup';
import { useAppFonts } from '@/theme/fonts';

// Held until the fonts are in — the design lands wrong for a frame otherwise.
void SplashScreen.preventAutoHideAsync();

/**
 * Sends you where the session says you belong:
 *   no session      → auth stack
 *   new account     → onboarding (follow a mosque, pick interests)
 *   coordinator     → the mosque-side app
 *   otherwise       → the member tabs
 *
 * The two shells are separate apps that happen to share a bundle. A
 * coordinator has no use for a feed of other mosques, and a member has no
 * business in the dashboard — so nobody sees the other side's tab bar.
 */
function RootNavigator() {
  const { status, needsOnboarding, adminMosqueIds } = useAuth();
  const { t } = useLang();
  const segments = useSegments();
  const router = useRouter();

  // Registers the device and routes notification taps. At the root, so a
  // coordinator who never opens the Profile tab still gets a token.
  usePushSetup(status === 'authenticated');

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

    // Which home this session gets. Memberships load a tick after the user
    // does, so an admin briefly looks like a member — landing on the member
    // tabs first and correcting is better than blocking the whole app on it.
    if (inAuthGroup || inOnboarding) {
      router.replace(adminMosqueIds.length > 0 ? '/(admin)' : '/(tabs)');
      return;
    }

    // A coordinator who ends up on the member tabs (first load, or the roles
    // arriving late) gets moved across.
    if (adminMosqueIds.length > 0 && segments[0] === '(tabs)') {
      router.replace('/(admin)');
    }
  }, [status, needsOnboarding, adminMosqueIds.length, segments, router]);

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
      <Stack.Screen name="(admin)" options={{ animation: 'fade' }} />
      {/* member */}
      <Stack.Screen name="post/[id]" />
      <Stack.Screen name="mosque/[id]" />
      <Stack.Screen name="prayer-month/[mosqueId]" />
      <Stack.Screen name="cities" options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="checkin/[postId]" options={{ animation: 'slide_from_bottom' }} />
      {/* The camera scanner: both sides of the check-in handshake open it. */}
      <Stack.Screen name="scan" options={{ animation: 'slide_from_bottom' }} />
      {/* coordinator - every screen re-checks the role through the API */}
      <Stack.Screen name="manage/create" options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="manage/posts" />
      <Stack.Screen name="manage/iqamah" />
      <Stack.Screen name="manage/profile" />
      <Stack.Screen name="manage/coverage/[id]" />
      <Stack.Screen name="manage/checkin/[id]" options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="manage/member/[id]" />
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
          {/* Inside LangProvider so dialogs get the app's strings and reading
              direction; outside everything else so any screen, and any error
              thrown in a store, can raise one. */}
          <DialogProvider>
            <AuthProvider>
              {/* Above the navigator so the manage/* screens - pushed on the root
                  stack, outside the (admin) tab group - can read it too. It only
                  fetches when the session actually coordinates a mosque. */}
              <AdminMosqueProvider>
                <SavedProvider>
                  <StarredProvider>
                    <LocationProvider>
                      <RootNavigator />
                    </LocationProvider>
                  </StarredProvider>
                </SavedProvider>
              </AdminMosqueProvider>
            </AuthProvider>
          </DialogProvider>
        </LangProvider>
      </View>
    </SafeAreaProvider>
  );
}
