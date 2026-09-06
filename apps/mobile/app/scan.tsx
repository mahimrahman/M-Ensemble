/**
 * The camera scanner. One screen, both directions of the check-in handshake:
 *
 *   coordinator scans a member's code   → `?post=` comes from the screen they
 *                                          opened it from, the user id from the
 *                                          code. Checks that person in.
 *   member scans the event's code       → the post id comes from the code, the
 *                                          user is whoever is signed in. Checks
 *                                          themselves in.
 *
 * Which one it is depends on what the code contains, not on who is scanning:
 * a code carrying `?user=` is a person, a code without one is an event. That
 * keeps the two QR artworks already in the app working unchanged.
 *
 * Both land on the same `POST /posts/:id/checkin`, which already allows either
 * "myself" or "an admin of this post's mosque" — so the permission rule is the
 * server's, not this screen's.
 */

import { CameraView, useCameraPermissions } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CheckCircle2, CircleAlert } from 'lucide-react-native';
import { useCallback, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { API_ERROR, api, isApiError } from '@/api/client';
import { BackBar, Button, GradientHeader, Loading, Screen } from '@/components';
import { useLang } from '@/i18n';
import { success, warn } from '@/lib/haptics';
import { useAuth } from '@/store/auth';
import { colors, radius, screenPadding, spacing, type } from '@/theme';

type Outcome =
  | { kind: 'scanning' }
  | { kind: 'working' }
  | { kind: 'done'; who: string }
  | { kind: 'failed'; message: string };

/**
 * Pull the ids out of a scanned code.
 *
 * Handles every shape the app itself produces — `mensemble://checkin/post_001`,
 * the `exp://…/--/checkin/post_001` that Expo Go hands out, and either with a
 * `?user=` on the end. Anything else is somebody else's QR code and is
 * rejected rather than guessed at.
 */
function parseCheckInCode(raw: string): { postId: string; userId?: string } | null {
  const match = /\/checkin\/([A-Za-z0-9_-]+)/.exec(raw);
  if (!match) return null;

  const user = /[?&]user=([A-Za-z0-9_-]+)/.exec(raw);
  return { postId: match[1]!, ...(user ? { userId: user[1]! } : {}) };
}

export default function ScanScreen() {
  // `post` is set when a coordinator opens this from a specific event's screen:
  // their member's code names a person, not an event, so the event has to come
  // from context.
  const { post: postFromContext } = useLocalSearchParams<{ post?: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { t, align, font } = useLang();
  const [permission, requestPermission] = useCameraPermissions();
  const [outcome, setOutcome] = useState<Outcome>({ kind: 'scanning' });

  // The camera fires this many times a second while a code is in frame. One
  // scan per screen visit is all we want — the ref latches before any await, so
  // a second frame can't slip past while the first request is still open.
  const handled = useRef(false);

  const onScanned = useCallback(
    async ({ data }: { data: string }) => {
      if (handled.current) return;

      const parsed = parseCheckInCode(data);
      if (!parsed) {
        handled.current = true;
        warn();
        setOutcome({ kind: 'failed', message: t.notACheckInCode });
        return;
      }

      // A member's code names the person; an event's code doesn't, so the
      // person is whoever is holding the phone.
      const postId = parsed.userId ? (postFromContext ?? parsed.postId) : parsed.postId;
      const userId = parsed.userId ?? user?._id;
      if (!userId) return;

      handled.current = true;
      setOutcome({ kind: 'working' });

      try {
        await api.checkIn(postId, userId);
        success();
        setOutcome({ kind: 'done', who: parsed.userId ? t.checkedIn : t.youreIn });
      } catch (err) {
        warn();
        setOutcome({
          kind: 'failed',
          message: isApiError(err, API_ERROR.NOT_FOUND)
            ? t.notSignedUpForThis
            : isApiError(err, API_ERROR.FORBIDDEN)
              ? t.onlyCoordinators
              : t.couldNotSave,
        });
      }
    },
    [postFromContext, user?._id, t],
  );

  function scanAgain() {
    handled.current = false;
    setOutcome({ kind: 'scanning' });
  }

  // Permission is asked for on the screen that needs it, not at launch — the
  // camera is only ever used here.
  if (!permission) {
    return (
      <Screen padded={false} edges={['left', 'right']}>
        <GradientHeader title={t.scanQr} />
        <Loading label={t.loading} />
      </Screen>
    );
  }

  if (!permission.granted) {
    return (
      <Screen padded={false} edges={['left', 'right']}>
        <GradientHeader title={t.scanQr}>
          <BackBar />
        </GradientHeader>
        <View style={styles.body}>
          <Text style={[font(styles.heading), align]}>{t.cameraNeeded}</Text>
          <Text style={[font(styles.calm), align]}>{t.cameraNeededBody}</Text>
          <Button label={t.allowCamera} onPress={() => void requestPermission()} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false} edges={['left', 'right']}>
      <GradientHeader title={t.scanToCheckIn}>
        <BackBar />
      </GradientHeader>

      <View style={styles.body}>
        {outcome.kind === 'scanning' ? (
          <>
            <View style={styles.viewfinder}>
              {/*
                Web has no native camera scanner in Expo Go; the fallback keeps
                the route openable in the browser preview rather than crashing.
              */}
              {Platform.OS === 'web' ? (
                <View style={styles.webFallback}>
                  <Text style={[font(styles.calm), align]}>{t.cameraNeededBody}</Text>
                </View>
              ) : (
                <CameraView
                  style={StyleSheet.absoluteFill}
                  facing="back"
                  barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                  onBarcodeScanned={(e) => void onScanned(e)}
                />
              )}
            </View>
            <Text style={[font(styles.calm), align]}>{t.scanToCheckIn}</Text>
          </>
        ) : outcome.kind === 'working' ? (
          <Loading label={t.loading} />
        ) : outcome.kind === 'done' ? (
          <View style={styles.result}>
            <CheckCircle2 color={colors.live} size={56} strokeWidth={1.6} />
            <Text style={[font(styles.heading), align]}>{outcome.who}</Text>
            <Button label={t.scanQr} onPress={scanAgain} />
            <Button label={t.done} variant="ghost" onPress={() => router.back()} />
          </View>
        ) : (
          <View style={styles.result}>
            <CircleAlert color={colors.danger} size={56} strokeWidth={1.6} />
            <Text style={[font(styles.heading), align]}>{outcome.message}</Text>
            <Button label={t.tryAgain} onPress={scanAgain} />
            <Button label={t.done} variant="ghost" onPress={() => router.back()} />
          </View>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, padding: screenPadding, gap: spacing.lg, justifyContent: 'center' },
  viewfinder: {
    aspectRatio: 1,
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: colors.dark,
  },
  webFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  result: { alignItems: 'center', gap: spacing.lg },
  heading: { ...type.h2, color: colors.ink, textAlign: 'center' },
  calm: { ...type.body, color: colors.inkFaint, textAlign: 'center' },
});
