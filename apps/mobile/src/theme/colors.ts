export const colors = {
  background: '#ffffff',
  surface: '#f5f5f7',
  text: '#11181c',
  textMuted: '#687076',
  border: '#e3e5e8',
  primary: '#2f6feb',
  danger: '#d1242f',
} as const;

export type ColorName = keyof typeof colors;
