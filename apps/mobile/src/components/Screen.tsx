import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { useTopInset } from '@/hooks/useTopInset';
import { useLang } from '@/i18n';
import { colors, gradients, screenPadding, spacing, type } from '@/theme';

interface ScreenProps {
  children: ReactNode;
  /** Wrap the content in a ScrollView. Never do this around a FlatList. */
  scroll?: boolean;
  padded?: boolean;
  edges?: readonly Edge[];
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}

/**
 * The page body. Every screen in the prototype is a dark gradient masthead on
 * a pale `--background` body, so `Screen` owns the body and `GradientHeader`
 * owns the masthead — a screen composes the two.
 *
 * The top edge is deliberately NOT safe-area inset here: the masthead runs up
 * under the status bar exactly as it does in the prototype, and insets itself.
 */
export function Screen({
  children,
  scroll = false,
  padded = true,
  edges = ['left', 'right'],
  style,
  contentStyle,
}: ScreenProps) {
  const inner = padded ? styles.padded : undefined;

  return (
    <SafeAreaView style={[styles.safe, style]} edges={edges}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[inner, styles.scrollContent, contentStyle]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.flex, inner, contentStyle]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

interface GradientHeaderProps {
  title?: string;
  /** Small uppercase line above the title. */
  eyebrow?: string;
  /** Muted line under the title. */
  subtitle?: string;
  /** Rendered instead of the title block — for the prayer masthead. */
  children?: ReactNode;
  /** A back button, rendered above everything, when the screen is pushed. */
  back?: ReactNode;
  right?: ReactNode;
  /** `header` is the 135° two-stop; `flat` is the solid darkest (coordinator). */
  variant?: 'header' | 'masthead' | 'flat';
  style?: StyleProp<ViewStyle>;
  /** Extra bottom padding — a taller masthead. */
  tall?: boolean;
}

/**
 * The dark teal gradient every screen opens with. It runs full-bleed to the
 * top of the display and pads itself past the notch, so the status-bar text
 * sits on the gradient the way it does in the prototype.
 */
export function GradientHeader({
  title,
  eyebrow,
  subtitle,
  children,
  back,
  right,
  variant = 'header',
  style,
  tall = false,
}: GradientHeaderProps) {
  const top = useTopInset();
  const { isAr, align, row, font } = useLang();

  return (
    <LinearGradient
      colors={[...gradients[variant === 'masthead' ? 'masthead' : variant]]}
      start={variant === 'masthead' ? { x: 0, y: 0 } : { x: 0, y: 0 }}
      end={variant === 'masthead' ? { x: 1, y: 1 } : { x: 1, y: 1 }}
      style={[styles.header, { paddingTop: top + spacing.md }, tall && styles.headerTall, style]}
    >
      {back}
      {children ?? (
        <View style={[styles.headerRow, row]}>
          <View style={styles.headerText}>
            {eyebrow ? (
              <Text style={[styles.eyebrow, align, font(styles.eyebrow)]}>
                {eyebrow.toUpperCase()}
              </Text>
            ) : null}
            {title ? (
              <Text style={[styles.title, align, font(styles.title)]} numberOfLines={2}>
                {title}
              </Text>
            ) : null}
            {subtitle ? (
              <Text style={[styles.subtitle, align, font(styles.subtitle)]}>{subtitle}</Text>
            ) : null}
          </View>
          {right}
        </View>
      )}
    </LinearGradient>
  );
}

/** A ruled section label — the prototype's uppercase, letter-spaced overline. */
export function SectionTitle({
  title,
  right,
  style,
}: {
  title: string;
  right?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { align, row, font } = useLang();
  return (
    <View style={[styles.section, row, style]}>
      <Text style={[styles.sectionTitle, align, font(styles.sectionTitle)]}>
        {title.toUpperCase()}
      </Text>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  padded: { paddingHorizontal: screenPadding },
  scrollContent: { paddingBottom: spacing.xxxl, gap: spacing.lg, paddingTop: spacing.lg },

  header: {
    paddingHorizontal: screenPadding,
    paddingBottom: spacing.lg,
  },
  headerTall: { paddingBottom: spacing.xxl },
  headerRow: { alignItems: 'flex-end', justifyContent: 'space-between', gap: spacing.md },
  headerText: { flex: 1, gap: 2 },
  eyebrow: { ...type.overline, color: colors.inkOnDarkFaint },
  title: { ...type.h1, color: colors.inkInverse },
  subtitle: { ...type.caption, color: colors.inkOnDark },

  section: {
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingBottom: spacing.md,
  },
  sectionTitle: { ...type.overline, color: colors.inkMuted, flex: 1 },
});
