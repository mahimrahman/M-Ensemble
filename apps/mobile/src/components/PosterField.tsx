/**
 * The poster picker on the create/edit form.
 *
 * **It uploads on pick, not on publish.** Choosing the image and writing the
 * rest of the form are the two things a coordinator does here, and doing them
 * in that order means the slow part — a photo over mobile data — happens while
 * they are still typing the description. Publishing then only ever sends JSON,
 * so the button that says "Publish" cannot spend twenty seconds on a network
 * upload and cannot fail for a reason that has nothing to do with the post.
 *
 * The cost is an orphan: pick a poster, abandon the form, and the file stays
 * on the server attached to nothing. That is a sweep to write later, not a
 * reason to make everyone wait at the end.
 */

import * as ImagePicker from 'expo-image-picker';
import { Camera, ImagePlus, X } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { api } from '@/api/client';
import { ApiRequestError } from '@/api/errors';
import { useLang } from '@/i18n';
import { tap, warn } from '@/lib/haptics';
import { colors, icon as iconSize, radius, spacing, type } from '@/theme';
import { Poster } from './Poster';

interface PosterFieldProps {
  /** Which mosque is publishing. Uploading is admin-only, so this is required. */
  mosqueId?: string;
  /** The stored path, or undefined for no poster. */
  value?: string;
  /** Fires with the new path, or undefined when the poster is removed. */
  onChange: (url: string | undefined) => void;
}

/**
 * What the picker is asked for.
 *
 * `allowsEditing` with a 16:9 crop is the whole reason this looks like the
 * bundled posters rather than a wall of mismatched phone photos — the feed
 * renders every poster into a fixed 200px band, so an image the coordinator
 * did not crop gets cropped anyway, just not by them and not around the part
 * that matters. Better they choose which part survives.
 *
 * `quality` is the client's half of the size story: the server caps the
 * request at 8MB and downscales to 1200px regardless, but sending 5MB to have
 * it thrown away is a minute of someone's tethering.
 */
const PICKER_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  allowsEditing: true,
  aspect: [16, 9],
  quality: 0.85,
};

export function PosterField({ mosqueId, value, onChange }: PosterFieldProps) {
  const { t, align, row, font } = useLang();
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  // The local file shows the instant it is picked and is replaced by the
  // stored path once the upload lands. Without it the tile sits empty through
  // the whole upload and the tap reads as having done nothing.
  const shown = preview ?? value;

  async function choose(source: 'library' | 'camera') {
    if (!mosqueId || uploading) return;
    tap();
    setError(undefined);

    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError(source === 'camera' ? t.posterNeedsCamera : t.posterNeedsLibrary);
      return;
    }

    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(PICKER_OPTIONS)
        : await ImagePicker.launchImageLibraryAsync(PICKER_OPTIONS);
    const asset = result.canceled ? undefined : result.assets[0];
    if (!asset) return;

    setPreview(asset.uri);
    setUploading(true);
    try {
      const stored = await api.uploadPoster(mosqueId, {
        uri: asset.uri,
        // The web picker leaves both of these empty often enough that a
        // fallback is the normal path, not the edge case. The server renames
        // the file and re-reads the format from the bytes, so neither value
        // decides anything — they only have to be present and plausible.
        name: asset.fileName ?? 'poster.jpg',
        mimeType: asset.mimeType ?? 'image/jpeg',
      });
      onChange(stored.url);
    } catch (err) {
      warn();
      // The server's own message is the useful one — "over 8MB", "not an image
      // we can read" — and it is written for a reader. Only fall back to the
      // generic line when the failure was the network.
      const fromServer = err instanceof ApiRequestError && err.code !== 'NETWORK_ERROR';
      setError(fromServer ? (err as ApiRequestError).message : t.posterFailed);
    } finally {
      setUploading(false);
      setPreview(undefined);
    }
  }

  function remove() {
    tap();
    setError(undefined);
    setPreview(undefined);
    onChange(undefined);
  }

  return (
    <View style={styles.wrap}>
      <Text style={[font(styles.label), align]}>{t.poster.toUpperCase()}</Text>

      {shown ? (
        <View>
          <Poster imageUrl={shown} aspect={16 / 9} />

          {uploading ? (
            <View style={styles.veil}>
              <ActivityIndicator color={colors.inkInverse} />
              <Text style={font(styles.veilText)}>{t.posterUploading}</Text>
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t.posterRemove}
              onPress={remove}
              hitSlop={8}
              style={({ pressed }) => [styles.remove, pressed && styles.pressed]}
            >
              <X size={iconSize.md} color={colors.inkInverse} strokeWidth={2.5} />
            </Pressable>
          )}
        </View>
      ) : (
        <View style={[styles.actions, row]}>
          <PickerTile
            label={t.posterChoose}
            Icon={ImagePlus}
            disabled={!mosqueId || uploading}
            onPress={() => void choose('library')}
          />
          {/*
            No camera on web. `launchCameraAsync` there opens the same file
            dialog as the library, so a second button that does the identical
            thing is a button that lies about what it is for.
          */}
          {Platform.OS !== 'web' ? (
            <PickerTile
              label={t.posterCamera}
              Icon={Camera}
              disabled={!mosqueId || uploading}
              onPress={() => void choose('camera')}
            />
          ) : null}
        </View>
      )}

      {error ? (
        <Text style={[font(styles.error), align]}>{error}</Text>
      ) : (
        <Text style={[font(styles.hint), align]}>{t.posterHint}</Text>
      )}
    </View>
  );
}

interface PickerTileProps {
  label: string;
  Icon: typeof ImagePlus;
  disabled: boolean;
  onPress: () => void;
}

function PickerTile({ label, Icon, disabled, onPress }: PickerTileProps) {
  const { font } = useLang();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, pressed && styles.pressed, disabled && styles.faded]}
    >
      <Icon size={iconSize.lg} color={colors.accent} strokeWidth={1.75} />
      <Text style={font(styles.tileLabel)}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { ...type.overline, color: colors.inkMuted, letterSpacing: 0.8 },

  actions: { gap: spacing.sm },
  tile: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    // Dashed, so an empty poster slot reads as a place something goes rather
    // than as a control that is already filled in.
    borderStyle: 'dashed',
    borderColor: colors.rule,
    backgroundColor: colors.surface,
  },
  tileLabel: { ...type.captionStrong, color: colors.accent },

  remove: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: 'rgba(6, 30, 27, 0.62)',
  },
  veil: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(6, 30, 27, 0.55)',
  },

  pressed: { opacity: 0.72 },
  faded: { opacity: 0.5 },
  veilText: { ...type.captionStrong, color: colors.inkInverse },
  error: { ...type.caption, color: colors.danger },
  hint: { ...type.caption, color: colors.inkMuted },
});
