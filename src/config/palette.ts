export const palette = {
  background: 0x101820,
  accent: 0xf05a36,
  buttonBorder: 0xff936f,
  textPrimary: 0xf3f5f7,
  textSecondary: 0xaab4bb,
  textMuted: 0x79868e,
  track: 0x19242d,
  trackBorder: 0x35434d,
  trackDash: 0x55616a,
  sportsCoupe: 0xf47721,
  deliveryVan: 0xd62832,
  carWindow: 0xa9d2dc,
  carTrim: 0x34383a,
  carDetail: 0x9d4b1b,
  vanDetail: 0x8f1d24,
  headlight: 0xf5e76e,
  wheel: 0x25292c,
  wheelHub: 0xb9bec1,
  wheelCenter: 0x777d80,
} as const;

export function toCssColor(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}
