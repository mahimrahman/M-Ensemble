import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect } from 'react-native-svg';
import { colors, radius, teal } from '@/theme';

interface PosterProps {
  /** A poster the mosque uploaded. When absent, a motif is drawn instead. */
  imageUrl?: string;
  /** Seeds which motif and colourway — pass the post id so it stays stable. */
  seed: string;
  aspect?: number;
  /** A fixed height instead of an aspect ratio — the feed's 200px band. */
  height?: number;
  /** Override the corner radius. The feed's full-bleed poster passes 0. */
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

/** Stable small hash, so a post keeps the same motif between renders. */
function hash(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h;
}

/** Ink on ground. Never two darks or two lights together. */
const COLOURWAYS = [
  { ground: teal[950], ink: teal[400] },
  { ground: teal[700], ink: teal[200] },
  { ground: teal[100], ink: teal[700] },
  { ground: teal[900], ink: teal[300] },
] as const;

const SIZE = 120;

/**
 * The placeholder a mosque's poster sits in until it uploads one.
 *
 * Four geometric motifs drawn from the same square grid Islamic tiling uses,
 * picked by the post id. Deliberately abstract — it decorates the feed without
 * pretending to be a photograph.
 */
function Motif({ variant, ink }: { variant: number; ink: string }) {
  switch (variant) {
    // Eight-pointed star (khatim) on a repeating grid.
    case 0:
      return (
        <G stroke={ink} strokeWidth={1.6} fill="none" opacity={0.9}>
          {[0, 1, 2].map((row) =>
            [0, 1, 2, 3].map((col) => {
              const cx = col * 40 + 20;
              const cy = row * 40 + 20;
              const r = 15;
              return (
                <G key={`${row}-${col}`}>
                  <Rect x={cx - r} y={cy - r} width={r * 2} height={r * 2} />
                  <Rect
                    x={cx - r}
                    y={cy - r}
                    width={r * 2}
                    height={r * 2}
                    transform={`rotate(45 ${cx} ${cy})`}
                  />
                </G>
              );
            }),
          )}
        </G>
      );

    // Layered arches — the mihrab silhouette, repeated.
    case 1:
      return (
        <G stroke={ink} strokeWidth={1.8} fill="none" opacity={0.85}>
          {[0, 1, 2, 3].map((i) => {
            const x = i * 40 + 20;
            return (
              <G key={i}>
                <Path
                  d={`M ${x - 14} 120 L ${x - 14} 62 A 14 14 0 0 1 ${x + 14} 62 L ${x + 14} 120`}
                />
                <Path d={`M ${x - 7} 120 L ${x - 7} 68 A 7 7 0 0 1 ${x + 7} 68 L ${x + 7} 120`} />
              </G>
            );
          })}
          <Line x1={0} y1={44} x2={160} y2={44} />
        </G>
      );

    // Interlaced diamonds.
    case 2:
      return (
        <G stroke={ink} strokeWidth={1.4} fill="none" opacity={0.9}>
          {[0, 1, 2, 3, 4, 5].map((row) =>
            [0, 1, 2, 3, 4, 5].map((col) => {
              const cx = col * 32;
              const cy = row * 26;
              return (
                <Path
                  key={`${row}-${col}`}
                  d={`M ${cx} ${cy - 13} L ${cx + 16} ${cy} L ${cx} ${cy + 13} L ${cx - 16} ${cy} Z`}
                />
              );
            }),
          )}
        </G>
      );

    // Concentric rings, offset — a rosette.
    default:
      return (
        <G stroke={ink} fill="none" opacity={0.85}>
          {[14, 28, 42, 56, 70].map((r, i) => (
            <Circle key={r} cx={120} cy={30} r={r} strokeWidth={i % 2 ? 1 : 2} />
          ))}
          {[10, 22, 34, 46].map((r, i) => (
            <Circle key={`b${r}`} cx={24} cy={104} r={r} strokeWidth={i % 2 ? 1 : 2} />
          ))}
        </G>
      );
  }
}

export function Poster({
  imageUrl,
  seed,
  aspect = 16 / 9,
  height,
  radius: corner,
  style,
}: PosterProps) {
  const h = hash(seed);
  const colourway = COLOURWAYS[h % COLOURWAYS.length] ?? COLOURWAYS[0];
  const variant = Math.floor(h / 7) % 4;

  return (
    <View
      style={[
        styles.frame,
        height !== undefined ? { height } : { aspectRatio: aspect },
        corner !== undefined && { borderRadius: corner },
        style,
      ]}
    >
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="cover" />
      ) : (
        <View style={[styles.motif, { backgroundColor: colourway.ground }]}>
          <Svg
            width="100%"
            height="100%"
            viewBox={`0 0 160 ${SIZE}`}
            preserveAspectRatio="xMidYMid slice"
          >
            <Motif variant={variant} ink={colourway.ink} />
          </Svg>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surfaceSunken,
  },
  image: { width: '100%', height: '100%' },
  motif: { width: '100%', height: '100%' },
});
