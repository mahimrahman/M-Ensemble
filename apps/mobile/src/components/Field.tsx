import { useState } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { useLang } from '@/i18n';
import { colors, hitSize, radius, rule, spacing, type } from '@/theme';

interface FieldProps extends TextInputProps {
  label: string;
  error?: string;
  hint?: string;
}

/**
 * A labelled input. The border goes teal while it has focus — the one bit of
 * state feedback a text field needs, and the prototype's accent doing the work.
 */
export function Field({ label, error, hint, style, onFocus, onBlur, ...input }: FieldProps) {
  const { align, font } = useLang();
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.wrap}>
      <Text style={[font(styles.label), align]}>{label.toUpperCase()}</Text>
      <TextInput
        placeholderTextColor={colors.inkFaint}
        style={[
          styles.input,
          input.multiline && styles.multiline,
          align,
          focused && styles.inputFocused,
          !!error && styles.inputError,
          style,
        ]}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        {...input}
      />
      {error ? <Text style={[font(styles.error), align]}>{error}</Text> : null}
      {!error && hint ? <Text style={[font(styles.hint), align]}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { ...type.overline, color: colors.inkMuted, letterSpacing: 0.8 },
  // A fixed height with the text centred in it, and no line height: a single
  // line input given the body text's 23px line height draws the text at the
  // bottom of the box on both platforms, which read as "sinking" while typing.
  input: {
    height: hitSize + 4,
    paddingHorizontal: 14,
    paddingVertical: 0,
    borderWidth: 1.5,
    borderColor: colors.rule,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    color: colors.ink,
    ...type.body,
    lineHeight: undefined,
    textAlignVertical: 'center',
    includeFontPadding: false,
  },
  // Multi-line fields grow from the top instead, and keep the body leading.
  multiline: {
    height: undefined,
    minHeight: 96,
    paddingVertical: spacing.md,
    lineHeight: type.body.lineHeight,
    textAlignVertical: 'top',
  },
  inputFocused: { borderColor: colors.accent },
  inputError: { borderColor: colors.danger },
  error: { ...type.caption, color: colors.danger },
  hint: { ...type.caption, color: colors.inkMuted },
});
