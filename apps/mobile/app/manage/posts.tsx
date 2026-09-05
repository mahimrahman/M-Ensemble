/** Manage posts — everything this mosque has posted: upcoming, past, cancelled. */

import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pencil, Plus, Users, XCircle } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Alert } from '@/lib/alert';
import { api } from '@/api/client';
import {
  BackBar,
  Badge,
  Button,
  Card,
  EmptyState,
  GradientHeader,
  Loading,
  Screen,
  SectionTitle,
  postTypeLabel,
} from '@/components';
import { useApi } from '@/hooks/useApi';
import { useLang } from '@/i18n';
import { formatWhen } from '@/lib/format';
import { success, warn } from '@/lib/haptics';
import { colors, screenPadding, spacing, type } from '@/theme';
import type { Post } from '@/types';

export default function ManagePostsScreen() {
  const { mosqueId } = useLocalSearchParams<{ mosqueId: string }>();
  const router = useRouter();
  const { t, lang, align, row, font } = useLang();
  const [busyId, setBusyId] = useState<string | null>(null);

  const posts = useApi(() => api.getMosquePostsForAdmin(mosqueId), [mosqueId]);

  function confirmCancel(post: Post) {
    Alert.alert(t.cancelPostConfirm, `${post.title}\n\n${t.cancelPostBody}`, [
      { text: t.keepIt, style: 'cancel' },
      { text: t.cancelPost, style: 'destructive', onPress: () => void cancel(post._id) },
    ]);
  }

  async function cancel(id: string) {
    setBusyId(id);
    try {
      await api.cancelPost(id);
      success();
      await posts.reload();
    } catch {
      warn();
      Alert.alert(t.couldNotSave, t.tryAgain);
    } finally {
      setBusyId(null);
    }
  }

  if (posts.loading) {
    return (
      <Screen padded={false} edges={['left', 'right']}>
        <GradientHeader back={<BackBar />} title={t.managePosts} />
        <Loading label={t.loading} />
      </Screen>
    );
  }

  const now = Date.now();
  const all = posts.data ?? [];
  const upcoming = all.filter((p) => !p.cancelledAt && new Date(p.endAt).getTime() >= now);
  const past = all.filter((p) => !p.cancelledAt && new Date(p.endAt).getTime() < now).reverse();
  const cancelled = all.filter((p) => p.cancelledAt);

  const Row = ({ post, actions }: { post: Post; actions: boolean }) => (
    <Card style={styles.card}>
      <View style={[styles.badges, row]}>
        <Badge label={postTypeLabel(t, post.type)} />
        {post.cancelledAt ? <Badge label={t.cancelled} tone="danger" /> : null}
        {post.type === 'volunteer' && post.slotsNeeded !== undefined && !post.cancelledAt ? (
          <Badge
            label={`${post.slotsFilled}/${post.slotsNeeded}`}
            tone={post.slotsFilled >= post.slotsNeeded ? 'accent' : 'attention'}
          />
        ) : null}
      </View>

      <Text style={[font(styles.title), align]} numberOfLines={2}>
        {post.title}
      </Text>
      <Text style={[font(styles.meta), align]} numberOfLines={1}>
        {post.type === 'announcement'
          ? postTypeLabel(t, post.type)
          : formatWhen(post.startAt, post.endAt, lang)}
      </Text>

      {actions ? (
        <View style={[styles.actions, row]}>
          {post.type !== 'announcement' ? (
            <Button
              label={t.coverage}
              icon={Users}
              variant="secondary"
              size="sm"
              fullWidth={false}
              onPress={() =>
                router.push({ pathname: '/manage/coverage/[id]', params: { id: post._id } })
              }
            />
          ) : null}
          <Button
            label={t.edit}
            icon={Pencil}
            variant="ghost"
            size="sm"
            fullWidth={false}
            onPress={() =>
              router.push({ pathname: '/manage/create', params: { editId: post._id } })
            }
          />
          <Button
            label={t.cancel}
            icon={XCircle}
            variant="ghost"
            size="sm"
            fullWidth={false}
            loading={busyId === post._id}
            onPress={() => confirmCancel(post)}
          />
        </View>
      ) : null}
    </Card>
  );

  return (
    <Screen padded={false} edges={['left', 'right']}>
      <GradientHeader
        back={<BackBar />}
        title={t.managePosts}
        right={
          <Button
            label={t.createPost}
            icon={Plus}
            variant="inverse"
            size="sm"
            fullWidth={false}
            onPress={() => router.push({ pathname: '/manage/create', params: { mosqueId } })}
          />
        }
      />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <SectionTitle title={t.comingUp} />
        {upcoming.length === 0 ? (
          <EmptyState
            title={t.noPosts}
            message={t.nothingComingUpBody}
            actionLabel={t.createPost}
            onAction={() => router.push({ pathname: '/manage/create', params: { mosqueId } })}
          />
        ) : (
          upcoming.map((post) => <Row key={post._id} post={post} actions />)
        )}

        {past.length > 0 ? (
          <>
            <SectionTitle title={t.past} style={styles.sectionGap} />
            {past.map((post) => (
              <Row key={post._id} post={post} actions={false} />
            ))}
          </>
        ) : null}

        {cancelled.length > 0 ? (
          <>
            <SectionTitle title={t.cancelled} style={styles.sectionGap} />
            {cancelled.map((post) => (
              <Row key={post._id} post={post} actions={false} />
            ))}
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: screenPadding,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  sectionGap: { marginTop: spacing.xl },
  card: { marginBottom: spacing.md },
  badges: { gap: spacing.sm, flexWrap: 'wrap' },
  title: { ...type.h3, color: colors.ink },
  meta: { ...type.caption, color: colors.inkMuted },
  actions: { flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
});
