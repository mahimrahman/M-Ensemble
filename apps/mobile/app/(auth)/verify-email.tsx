/**
 * Verify email — the landing page for `mensemble://verify-email?token=…`.
 *
 * Fires the token at the server as soon as it mounts; there is nothing for
 * the reader to type. If somebody is signed in on this phone, the refreshed
 * user (now `emailVerified: true`) replaces the cached one so the "not
 * verified" banner on Profile goes away without a reload.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { api } from '@/api/client';
import { AuthCover, Button, Loading } from '@/components';
import { useLang } from '@/i18n';
import { describeApiError } from '@/lib/apiError';
import { success, warn } from '@/lib/haptics';
import { useAuth } from '@/store/auth';
import { colors, type } from '@/theme';

type Outcome = 'verifying' | 'done' | 'failed';

export default function VerifyEmailScreen() {
  const router = useRouter();
  const { t, align, font } = useLang();
  const { status, user, setUser } = useAuth();
  const { token } = useLocalSearchParams<{ token?: string }>();
  const [outcome, setOutcome] = useState<Outcome>(token ? 'verifying' : 'failed');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    api
      .verifyEmail(token)
      .then((fresh) => {
        if (cancelled) return;
        success();
        // Only adopt the server's user if it is the one signed in here: the
        // link may have been opened on somebody else's phone.
        if (status === 'authenticated' && user && fresh._id === user._id) setUser(fresh);
        setOutcome('done');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        warn();
        setMessage(describeApiError(err, t, t.verifyEmailFailed));
        setOutcome('failed');
      });
    return () => {
      cancelled = true;
    };
    // Runs once per token; the auth values are read, not reacted to.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const signedIn = status === 'authenticated';
  const goOn = () => router.replace(signedIn ? '/' : '/login');

  return (
    <AuthCover title={t.verifyEmailTitle}>
      {outcome === 'verifying' ? (
        <Loading variant="inline" label={t.verifyingEmail} />
      ) : (
        <>
          <Text style={[font(styles.body), align]}>
            {outcome === 'done' ? t.emailVerified : (message ?? t.verifyEmailFailed)}
          </Text>
          <Button label={signedIn ? t.continue : t.backToLogin} size="lg" onPress={goOn} />
        </>
      )}
    </AuthCover>
  );
}

const styles = StyleSheet.create({
  body: { ...type.body, color: colors.ink },
});
