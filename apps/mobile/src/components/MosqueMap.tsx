import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';
import { colors, radius, rule } from '@/theme';
import { buildMapHtml } from './mapHtml';
import type { Coordinates, Mosque } from '@/types';

interface MosqueMapProps {
  mosques: Mosque[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  height?: number;
  /** Static header map — no gestures. */
  interactive?: boolean;
  /** The reader's own position, drawn as the blue dot. */
  me?: Coordinates | null;
  meLabel?: string;
  /**
   * Bump this to re-centre the map on `me`. A counter rather than a boolean
   * because "centre on me" is an event, and the reader may want it twice after
   * panning away — a flag that is already `true` fires nothing the second time.
   */
  focusMe?: number;
  /**
   * Open centred on `me` rather than fitting every pin. Unlike `focusMe` this
   * is baked into the page, so it survives the reload that changing the mosque
   * list causes — see the note in `buildMapHtml`.
   */
  centreOnMe?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * OpenStreetMap through Leaflet in a WebView.
 *
 * No API key, no native map SDK, no per-platform setup — it works the same in
 * Expo Go on both platforms and in a standalone build. Tiles come from OSM's
 * public servers, so the map needs network (the rest of the app doesn't).
 *
 * Marker taps come back over `postMessage` and turn into `onSelect`.
 */
export function MosqueMap({
  mosques,
  selectedId = null,
  onSelect,
  height = 260,
  interactive = true,
  me = null,
  meLabel,
  focusMe = 0,
  centreOnMe = false,
  style,
}: MosqueMapProps) {
  const webRef = useRef<WebView>(null);

  // Rebuilding the HTML would reload the map, so the selected pin is styled by
  // an injected call instead of a re-render.
  const html = useMemo(
    () => buildMapHtml(mosques, interactive, me, meLabel, centreOnMe),
    [mosques, interactive, me, meLabel, centreOnMe],
  );
  const selectScript = `window.__select && window.__select(${JSON.stringify(selectedId)}); true;`;

  useEffect(() => {
    webRef.current?.injectJavaScript(selectScript);
  }, [selectScript]);

  // Skips the first render: mounting is not a request to centre on anybody.
  const focused = useRef(focusMe);
  useEffect(() => {
    if (focusMe === focused.current) return;
    focused.current = focusMe;
    webRef.current?.injectJavaScript('window.__focusMe && window.__focusMe(); true;');
  }, [focusMe]);

  return (
    <View style={[styles.frame, { height }, style]}>
      <WebView
        ref={webRef}
        originWhitelist={['*']}
        source={{ html }}
        style={styles.web}
        scrollEnabled={false}
        overScrollMode="never"
        // Applies the initial selection once the page is up.
        injectedJavaScript={selectScript}
        onMessage={(event) => {
          const id = event.nativeEvent.data;
          if (id) onSelect?.(id);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surfaceSunken,
    borderWidth: rule,
    borderColor: colors.rule,
  },
  web: { flex: 1, backgroundColor: colors.surfaceSunken },
});
