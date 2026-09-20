/**
 * The design's own icon set, drawn on a 24px grid from four primitives. It is
 * deliberately not lucide: these are squarer and flatter, and the nav reads as
 * one hand. Stroke inherits `currentColor`.
 */
type Shape =
  | { path: string }
  | { circle: [number, number, number] }
  | { rect: [number, number, number, number, number?] }
  | { line: [number, number, number, number] };

const P = (path: string): Shape => ({ path });
const C = (cx: number, cy: number, r: number): Shape => ({ circle: [cx, cy, r] });
const R = (x: number, y: number, w: number, h: number, rx = 2): Shape => ({ rect: [x, y, w, h, rx] });
const LN = (x1: number, y1: number, x2: number, y2: number): Shape => ({ line: [x1, y1, x2, y2] });

export const SHAPES = {
  today: [C(12, 12, 8.5), P("M12 7.5v5l3.5 2")],
  people: [C(12, 8, 3.6), P("M4.8 20a7.4 7.4 0 0 1 14.4 0")],
  convs: [P("M4 5.5h16v10.5H9.5L4.5 20V5.5z")],
  know: [R(4, 10, 3.6, 10, 1.4), R(10.2, 6, 3.6, 14, 1.4), R(16.4, 13.5, 3.6, 6.5, 1.4)],
  ask: [P("M9 9.2a3 3 0 1 1 3 3v1.8"), C(12, 17.6, 0.9)],
  // Envelope: the flap is drawn as a separate stroke so it stays legible at
  // 13px, where a single closed path collapses into a filled-looking wedge.
  mail: [R(3.2, 5.5, 17.6, 13, 2), P("M3.8 7 12 13 20.2 7")],
  phone: [R(6.5, 2.8, 11, 18.4, 2.4), LN(10.2, 18.2, 13.8, 18.2)],
  groups: [R(3.5, 4, 7, 7, 2), R(13.5, 4, 7, 7, 2), R(3.5, 13, 7, 7, 2), R(13.5, 13, 7, 7, 2)],
  backlog: [R(3.5, 15, 17, 5, 1.6), R(5.5, 9.5, 13, 4, 1.4), R(7.5, 4.5, 9, 3, 1.2)],
  settings: [LN(4, 7, 20, 7), C(9, 7, 2.2), LN(4, 13, 20, 13), C(15, 13, 2.2), LN(4, 19, 20, 19), C(10.5, 19, 2.2)],
  dev: [P("M8.5 8 4.5 12l4 4"), P("M15.5 8l4 4-4 4")],
  search: [C(11, 11, 6.5), LN(16, 16, 20.5, 20.5)],
  plus: [LN(12, 5.5, 12, 18.5), LN(5.5, 12, 18.5, 12)],
  send: [P("M20.5 3.5 10 14"), P("M20.5 3.5 14 20.5l-4-6.5-6.5-4z")],
  check: [P("m5 12.5 4.5 4.5L19 7.5")],
  trash: [LN(4.5, 7, 19.5, 7), P("M9.5 7V5h5v2"), P("M6.5 7l1 13h9l1-13")],
  warn: [P("M12 4 2.8 20h18.4z"), LN(12, 10, 12, 14.2), C(12, 17.2, 0.7)],
  split: [P("M5 5v3c0 2 1.4 3 3.4 3H15"), P("M5 19v-3c0-2 1.4-3 3.4-3H15"), P("m13 8 2.8 3L13 14")],
  quote: [P("M8.5 7.5c-2 1-3 2.7-3 5v4h5v-5H7c0-1.6.6-2.7 2-3.4z"), P("M17 7.5c-2 1-3 2.7-3 5v4h5v-5h-3.5c0-1.6.6-2.7 2-3.4z")],
  branch: [C(7, 6, 2.2), C(7, 18, 2.2), C(17, 12, 2.2), P("M7 8.2v7.6"), P("M9.2 6.6c4 .6 5.6 2.4 5.8 5")],
  waves: [P("M3 9c2-1.6 4-1.6 6 0s4 1.6 6 0 4-1.6 6 0"), P("M3 15c2-1.6 4-1.6 6 0s4 1.6 6 0 4-1.6 6 0")],
  bank: [P("M3.5 9.5 12 4.5l8.5 5"), P("M5.5 10v8M10 10v8M14 10v8M18.5 10v8"), LN(3.5, 19.5, 20.5, 19.5)],
  wallet: [R(3, 6, 18, 13, 2.5), P("M16.5 12.5h2")],
  clock: [C(12, 12, 8.5), P("M12 7.5V12l3 1.8")],
  shield: [P("M12 3.2 5 6v5.5c0 4 3 7.3 7 9.3 4-2 7-5.3 7-9.3V6z"), LN(12, 9, 12, 12.8), C(12, 16, 0.7)],
  spark: [P("M12 3.5 13.7 9l5.5 1.7-5.5 1.7L12 18l-1.7-5.6L4.8 10.7 10.3 9z")],
  hook: [P("M9 17H6.5a4 4 0 1 1 3.4-6.1"), P("M15 7h2.5a4 4 0 0 1 2.6 7"), LN(8.5, 12, 15.5, 12)],
  key: [C(8, 12, 4), LN(12, 12, 21, 12), P("M17 12v3.5M20 12v2.5")],
  lang: [P("M4 6h9"), P("M8.5 4v2c0 4-2 6.5-4.5 8"), P("M6 11c1.6 2.4 3.6 3.8 6 4.6"), P("M12.5 20l4-9 4 9"), LN(14, 17, 19, 17)],
  refresh: [P("M20 11a8 8 0 1 0-.7 4.3"), P("M20 5v6h-6")],
  external: [P("M14 4h6v6"), LN(20, 4, 11, 13), P("M18 14v5.5H4.5V6H10")],
  copy: [R(8.5, 8.5, 11.5, 11.5, 2.5), P("M15.5 8.5v-3H4v11.5h3")],
  close: [LN(6, 6, 18, 18), LN(18, 6, 6, 18)],
  chevron: [P("m9 6 6 6-6 6")],
  updown: [P("m8 9 4-4 4 4"), P("m8 15 4 4 4-4")],
  menu: [LN(4, 7, 20, 7), LN(4, 12, 20, 12), LN(4, 17, 20, 17)],
  play: [P("M8 5.5 18 12 8 18.5z")],
} satisfies Record<string, Shape[]>;

export type IconName = keyof typeof SHAPES;

export function Icon({
  name, size = 16, className, style, strokeWidth = 1.7,
}: {
  name: IconName;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  strokeWidth?: number;
}) {
  return (
    <svg
      viewBox="0 0 24 24" width={size} height={size} fill="none"
      stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round"
      className={className} style={{ flexShrink: 0, ...style }}
      aria-hidden
    >
      {SHAPES[name].map((sh, i) => {
        if ("path" in sh) return <path key={i} d={sh.path} />;
        if ("circle" in sh) { const [cx, cy, r] = sh.circle; return <circle key={i} cx={cx} cy={cy} r={r} />; }
        if ("rect" in sh) { const [x, y, w, h, rx] = sh.rect; return <rect key={i} x={x} y={y} width={w} height={h} rx={rx} />; }
        const [x1, y1, x2, y2] = sh.line;
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />;
      })}
    </svg>
  );
}
