import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius, rule } from '@/theme';
import type { Coordinates, Mosque } from '@/types';
import { buildMapHtml } from './mapHtml';

interface MosqueMapProps {
  mosques: Mosque[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  height?: number;
  interactive?: boolean;
  me?: Coordinates | null;
  meLabel?: string;
  /** Bump to re-centre on `me` — see the native file for why it's a counter. */
  focusMe?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * The same Leaflet page the native map runs, in an iframe. Metro picks this
 * file for the web target, so a browser preview shows the real OSM map with
 * the same teardrop pins instead of a placeholder.
 */
export function MosqueMap({
  mosques,
  selectedId = null,
  onSelect,
  height = 220,
  interactive = true,
  me = null,
  meLabel,
  focusMe = 0,
  style,
}: MosqueMapProps) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const html = useMemo(
    () => buildMapHtml(mosques, interactive, me, meLabel),
    [mosques, interactive, me, meLabel],
  );

  // Pin taps arrive from the iframe as window messages.
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const data: unknown = event.data;
      if (
        typeof data === 'object' &&
        data !== null &&
        (data as { type?: unknown }).type === 'mosque-select' &&
        typeof (data as { id?: unknown }).id === 'string'
      ) {
        onSelect?.((data as { id: string }).id);
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [onSelect]);

  // Selection goes the other way as the same message.
  useEffect(() => {
    frameRef.current?.contentWindow?.postMessage({ type: 'mosque-select', id: selectedId }, '*');
  }, [selectedId, html]);

  // Skips the first render: mounting is not a request to centre on anybody.
  const focused = useRef(focusMe);
  useEffect(() => {
    if (focusMe === focused.current) return;
    focused.current = focusMe;
    frameRef.current?.contentWindow?.postMessage({ type: 'focus-me' }, '*');
  }, [focusMe]);

  return (
    <View style={[styles.frame, { height }, style]}>
      <iframe
        ref={frameRef}
        title="map"
        srcDoc={html}
        style={iframeStyle}
        // Re-apply the selection once the page has loaded.
        onLoad={() =>
          frameRef.current?.contentWindow?.postMessage(
            { type: 'mosque-select', id: selectedId },
            '*',
          )
        }
      />
    </View>
  );
}

const iframeStyle = { border: 0, width: '100%', height: '100%', display: 'block' } as const;

const styles = StyleSheet.create({
  frame: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surfaceSunken,
    borderWidth: rule,
    borderColor: colors.rule,
  },
});
