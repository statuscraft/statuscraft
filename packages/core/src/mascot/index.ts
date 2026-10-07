export const MASCOT_NAME = 'Pip';

export type Mood = 'happy' | 'content' | 'uneasy' | 'worried' | 'panic';

export const FACE_STYLES = {
  kaomoji: { happy: '(^_^)', content: '(^-^)', uneasy: '(•_•)', worried: '(°o°)', panic: '(×_×)' },
  emoji: { happy: '😄', content: '🙂', uneasy: '😐', worried: '😟', panic: '😱' },
  ascii: { happy: ':D', content: ':)', uneasy: ':|', worried: ':/', panic: ':O' },
} as const satisfies Record<string, Record<Mood, string>>;

export type FaceStyle = keyof typeof FACE_STYLES;

export function moodFor(pressure: number): Mood {
  if (pressure >= 90) return 'panic';
  if (pressure >= 75) return 'worried';
  if (pressure >= 55) return 'uneasy';
  if (pressure >= 25) return 'content';
  return 'happy';
}

export function faceFor(pressure: number, style: string = 'kaomoji'): string {
  const faces = FACE_STYLES[style as FaceStyle] ?? FACE_STYLES.kaomoji;
  return faces[moodFor(pressure)];
}

export const PIP_BANNER = [
  '  ▄▄   ▄▄  ',
  ' ████████  ',
  ' █ ●  ● █  ',
  ' █  ‿‿  █  ',
  ' ████████  ',
];
