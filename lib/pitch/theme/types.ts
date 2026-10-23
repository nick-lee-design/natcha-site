export type DeckTheme = {
  id: string;
  name: string;
  wordmark: string;
  color: {
    accent: string;
    onAccent: string;
    ink: string;
    muted: string;
    paper: string;
    surface: string;
    surfaceAlt: string;
    line: string;
    gridLine: string;
    field: string;
    frame: string;
    glow: string;
    halo: string;
  };
  gradient: { cover: string };
  // Font sizes in canvas pixels
  type: {
    display: number;
    title: number;
    heading: number;
    lead: number;
    body: number;
    small: number;
    caption: number;
    label: number;
    micro: number;
  };
  space: { frame: number; margin: number; top: number };
  radius: { card: number; field: number };
  shadow: { card: string };
};
