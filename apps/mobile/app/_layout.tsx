// First, so the SDK is initialised before anything that could throw. It is a
// no-op in dev or without a DSN (see src/lib/sentry.ts).
import { withSentry } from '@/lib/sentry';
import { Stack, useRouter, useSegments } from 'expo-router';
import Head from 'expo-router/head';
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
    // Readable without an account: the privacy policy and terms have to be
    // open before anyone agrees to them.
    const isPublic = segments[0] === 'legal';
    // The two email-link landings. A phone that is already signed in opens
    // them too, and must not be bounced to its home before the token is used.
    const isDeepLinkLanding =
      inAuthGroup && (segments[1] === 'reset-password' || segments[1] === 'verify-email');

    if (status === 'unauthenticated') {
      if (!inAuthGroup && !isPublic) router.replace('/login');
      return;
    }

    if (isPublic || isDeepLinkLanding) return;

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
      <Stack.Screen name="notifications" />
      {/* account - reached from Profile and from the coordinator's Settings */}
      <Stack.Screen name="account/change-password" />
      <Stack.Screen name="account/export" />
      <Stack.Screen name="account/delete" />
      {/* open to everyone, signed in or not */}
      <Stack.Screen name="legal/[kind]" options={{ animation: 'slide_from_bottom' }} />
      {/* donations - the form, and the two deep-link landings Stripe's page sends back to */}
      <Stack.Screen name="donate/[mosqueId]" options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="donate/success" options={{ animation: 'fade' }} />
      <Stack.Screen name="donate/cancelled" options={{ animation: 'fade' }} />
      {/* coordinator - every screen re-checks the role through the API */}
      <Stack.Screen name="manage/create" options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="manage/posts" />
      <Stack.Screen name="manage/notify" options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="manage/iqamah" />
      <Stack.Screen name="manage/profile" />
      <Stack.Screen name="manage/coverage/[id]" />
      <Stack.Screen name="manage/checkin/[id]" options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="manage/member/[id]" />
    </Stack>
  );
}

function RootLayout() {
  const fontsReady = useAppFonts();

  const onLayout = useCallback(() => {
    if (fontsReady) void SplashScreen.hideAsync();
  }, [fontsReady]);

  if (!fontsReady) return null;

  return (
    <SafeAreaProvider>
      {/*
        The browser tab, and the name an installed web app is saved under.
        expo-router always emits a <title> on web and it lands ahead of
        anything `+html.tsx` writes, so this is the only place that can fill
        it. On native the component renders nothing.
      */}
      <Head>
        <title>M’Ensemble</title>
      </Head>
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

// Sentry's error boundary and touch breadcrumbs around the whole tree — only
// in a release build with a DSN; otherwise this is `RootLayout` untouched.
export default withSentry(RootLayout);
