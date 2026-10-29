import { StyleSheet, Text, View } from 'react-native';
import { useLang } from '@/i18n';
import { colors, spacing, type } from '@/theme';

/**
 * Just enough Markdown for the legal documents.
 *
 * `#` / `##` / `###` headings, paragraphs separated by blank lines, `- ` or
 * `* ` bullets, and `**bold**` inline. Nothing else is rendered specially: a
 * line the parser does not recognise is a paragraph, so an unexpected
 * construct degrades to plain text rather than disappearing. The server's
 * `LegalDocument.body` promises no more than this.
 */

type Block =
  | { kind: 'heading'; level: 1 | 2 | 3; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'bullets'; items: string[] };

export function parseMarkdown(source: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let bullets: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ kind: 'paragraph', text: paragraph.join(' ') });
    paragraph = [];
  };
  const flushBullets = () => {
    if (bullets.length) blocks.push({ kind: 'bullets', items: bullets });
    bullets = [];
  };

  for (const raw of source.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trimEnd();
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);

    if (!line.trim()) {
      flushParagraph();
      flushBullets();
    } else if (heading) {
      flushParagraph();
      flushBullets();
      blocks.push({
        kind: 'heading',
        level: heading[1]!.length as 1 | 2 | 3,
        text: heading[2]!.trim(),
      });
    } else if (bullet) {
      flushParagraph();
      bullets.push(bullet[1]!.trim());
    } else {
      flushBullets();
      paragraph.push(line.trim());
    }
  }
  flushParagraph();
  flushBullets();
  return blocks;
}

/** `**bold**` runs become nested <Text> with the strong face. */
function Inline({ text }: { text: string }) {
  const { font } = useLang();
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith('**') && part.endsWith('**') ? (
          <Text key={i} style={font(styles.bold)}>
            {part.slice(2, -2)}
          </Text>
        ) : (
          part
        ),
      )}
    </>
  );
}

export function Markdown({ source }: { source: string }) {
  const { align, row, font } = useLang();
  const blocks = parseMarkdown(source);

  return (
    <View style={styles.doc}>
      {blocks.map((block, i) => {
        switch (block.kind) {
          case 'heading':
            return (
              <Text
                key={i}
                accessibilityRole="header"
                style={[
                  font(block.level === 1 ? styles.h1 : block.level === 2 ? styles.h2 : styles.h3),
                  align,
                  i > 0 && styles.headingGap,
                ]}
              >
                {block.text}
              </Text>
            );
          case 'bullets':
            return (
              <View key={i} style={styles.list}>
                {block.items.map((item, j) => (
                  <View key={j} style={[styles.bulletRow, row]}>
                    <View style={styles.bullet} />
                    <Text style={[font(styles.body), align, styles.grow]}>
                      <Inline text={item} />
                    </Text>
                  </View>
                ))}
              </View>
            );
          default:
            return (
              <Text key={i} style={[font(styles.body), align]}>
                <Inline text={block.text} />
              </Text>
            );
        }
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  doc: { gap: spacing.md },
  h1: { ...type.h1, color: colors.ink },
  h2: { ...type.h2, color: colors.ink },
  h3: { ...type.h3, color: colors.ink },
  headingGap: { marginTop: spacing.sm },
  body: { ...type.body, color: colors.ink },
  bold: { ...type.bodyStrong, color: colors.ink },
  list: { gap: spacing.sm },
  bulletRow: { alignItems: 'flex-start', gap: spacing.md },
  bullet: {
    width: 5,
    height: 5,
    borderRadius: 999,
    backgroundColor: colors.accent,
    // On the first line's optical centre, as on the mosque page's services.
    marginTop: 9,
  },
  grow: { flex: 1 },
});
