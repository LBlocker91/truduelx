// Per-zone walkable floor system.
// Coordinates are in normalized percentage space (0..100) of the visible stage,
// matching the cover-fit background renderer used by OverworldScreen.
//
// Each zone defines:
//   - polygon: ordered points of the walkable floor (clockwise or ccw — both work)
//   - spawn:   safe spawn point inside the polygon
//   - npcs:    per-NPC visual + interaction positions, anchored on the floor
//
// Tuned visually against the current background art for each zone. Adjust by
// pressing the backtick key in the overworld to toggle the debug overlay.

export interface Vec2 { x: number; y: number }

export interface NpcPlacement {
  /** Where the sprite/marker is drawn (may sit on a wall/terminal). */
  visual: Vec2;
  /** Where the player must stand to interact (always inside the floor polygon). */
  interaction: Vec2;
}

/** A traversal portal that connects to another zone (door/airlock/transport). */
export interface ZonePortal {
  /** Stable id for the portal (used for entry-spawn matching). */
  id: string;
  /** Target zone id this portal leads to. */
  to: string;
  /** Friendly label, e.g. "Neon District". */
  label: string;
  /** Visual icon kind. */
  kind: 'door' | 'airlock' | 'portal' | 'transport';
  /** Where the portal is rendered (% space). */
  visual: Vec2;
  /** Where the player must stand to trigger interaction (% space). */
  interaction: Vec2;
  /** Where the player should spawn when entering this zone via this portal. */
  arrival: Vec2;
}

export interface ZoneWalkable {
  /** Walkable floor polygon in % coords. */
  polygon: Vec2[];
  /** Safe spawn point. Must lie inside polygon. */
  spawn: Vec2;
  /** Per-NPC layout keyed by NPC name (matches seeded data). */
  npcs: Record<string, NpcPlacement>;
  /** Optional portals connecting this zone to others. */
  portals?: ZonePortal[];
}

// ---- Zone definitions --------------------------------------------------------
// All three zones use ~16:10 sci-fi backgrounds with a clear floor band in the
// lower half. The polygons are tuned trapezoids that match the visible perspective.

export const ZONE_WALKABLE: Record<string, ZoneWalkable> = {
  'station-hub': {
    polygon: [
      { x: 10, y: 48 },
      { x: 90, y: 48 },
      { x: 99, y: 96 },
      { x:  1, y: 96 },
    ],
    spawn: { x: 50, y: 78 },
    npcs: {
      'Scout Junko':       { visual: { x: 22, y: 60 }, interaction: { x: 24, y: 68 } },
      'Quartermaster Vex': { visual: { x: 36, y: 82 }, interaction: { x: 36, y: 88 } },
      'Commander Hale':    { visual: { x: 50, y: 56 }, interaction: { x: 50, y: 66 } },
      'Doc Circuits':      { visual: { x: 64, y: 82 }, interaction: { x: 64, y: 88 } },
      'Tinker Mira':       { visual: { x: 78, y: 60 }, interaction: { x: 76, y: 68 } },
      'Training Drone':    { visual: { x: 50, y: 74 }, interaction: { x: 50, y: 82 } },
    },
    portals: [
      { id: 'hub-to-neon', to: 'neon-district', label: 'Neon District', kind: 'door',
        visual: { x:  6, y: 56 }, interaction: { x: 10, y: 70 }, arrival: { x: 90, y: 84 } },
      { id: 'hub-to-wasteland', to: 'wasteland', label: 'Crimson Wasteland', kind: 'airlock',
        visual: { x: 94, y: 56 }, interaction: { x: 90, y: 70 }, arrival: { x: 10, y: 84 } },
    ],
  },

  'wasteland': {
    polygon: [
      { x: 14, y: 50 },
      { x: 86, y: 50 },
      { x: 99, y: 96 },
      { x:  1, y: 96 },
    ],
    spawn: { x: 50, y: 80 },
    npcs: {
      'Scrapper Drone':     { visual: { x: 22, y: 64 }, interaction: { x: 24, y: 72 } },
      'Stranded Survivor':  { visual: { x: 38, y: 84 }, interaction: { x: 38, y: 90 } },
      'Wasteland Marauder': { visual: { x: 52, y: 58 }, interaction: { x: 52, y: 68 } },
      'Rogue War-Mech':     { visual: { x: 64, y: 84 }, interaction: { x: 64, y: 90 } },
      'Wasteland Overlord': { visual: { x: 78, y: 64 }, interaction: { x: 76, y: 72 } },
    },
    portals: [
      { id: 'wasteland-to-hub', to: 'station-hub', label: 'Bazaar Station', kind: 'transport',
        visual: { x: 8, y: 58 }, interaction: { x: 12, y: 72 }, arrival: { x: 90, y: 84 } },
    ],
  },

  'neon-district': {
    polygon: [
      { x: 12, y: 50 },
      { x: 88, y: 50 },
      { x: 98, y: 96 },
      { x:  2, y: 96 },
    ],
    spawn: { x: 50, y: 80 },
    npcs: {
      'Whisper':            { visual: { x: 22, y: 62 }, interaction: { x: 24, y: 70 } },
      'Cyber-Doc Riku':     { visual: { x: 38, y: 84 }, interaction: { x: 38, y: 90 } },
      'Neon Gangster':      { visual: { x: 52, y: 58 }, interaction: { x: 52, y: 68 } },
      'Syndicate Enforcer': { visual: { x: 64, y: 84 }, interaction: { x: 64, y: 90 } },
      'The Fixer':          { visual: { x: 78, y: 62 }, interaction: { x: 76, y: 70 } },
    },
    portals: [
      { id: 'neon-to-hub', to: 'station-hub', label: 'Bazaar Station', kind: 'portal',
        visual: { x: 92, y: 58 }, interaction: { x: 88, y: 72 }, arrival: { x: 10, y: 84 } },
    ],
  },
};

// ---- Polygon helpers ---------------------------------------------------------

/** Standard ray-cast point-in-polygon test. */
export function pointInPolygon(p: Vec2, poly: Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    const intersect =
      ((yi > p.y) !== (yj > p.y)) &&
      (p.x < ((xj - xi) * (p.y - yi)) / ((yj - yi) || 1e-9) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Squared distance from point p to segment a-b. */
function distSqToSegment(p: Vec2, a: Vec2, b: Vec2): { d2: number; point: Vec2 } {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy || 1e-9;
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const point = { x: a.x + t * dx, y: a.y + t * dy };
  const ddx = p.x - point.x, ddy = p.y - point.y;
  return { d2: ddx * ddx + ddy * ddy, point };
}

/** Returns the closest point on the polygon's boundary to p. */
export function closestPointOnPolygon(p: Vec2, poly: Vec2[]): Vec2 {
  let best = poly[0];
  let bestD2 = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const r = distSqToSegment(p, poly[j], poly[i]);
    if (r.d2 < bestD2) { bestD2 = r.d2; best = r.point; }
  }
  return best;
}

/**
 * Clamp a point so it always lies inside the walkable polygon.
 * If already inside, returns it unchanged. Otherwise returns the nearest
 * boundary point with a tiny inward bias to avoid floating-point edge bugs.
 */
export function clampToWalkable(p: Vec2, poly: Vec2[]): Vec2 {
  if (pointInPolygon(p, poly)) return p;
  const nearest = closestPointOnPolygon(p, poly);
  // Nudge a hair toward the polygon centroid so we don't sit exactly on the edge.
  const c = polygonCentroid(poly);
  const dx = c.x - nearest.x, dy = c.y - nearest.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: nearest.x + (dx / len) * 0.25, y: nearest.y + (dy / len) * 0.25 };
}

export function polygonCentroid(poly: Vec2[]): Vec2 {
  let sx = 0, sy = 0;
  for (const v of poly) { sx += v.x; sy += v.y; }
  return { x: sx / poly.length, y: sy / poly.length };
}

/** Returns the walkable definition for a zone, or a permissive fallback. */
export function walkableFor(zoneId: string): ZoneWalkable {
  return ZONE_WALKABLE[zoneId] ?? {
    polygon: [
      { x: 5, y: 55 }, { x: 95, y: 55 }, { x: 99, y: 95 }, { x: 1, y: 95 },
    ],
    spawn: { x: 50, y: 80 },
    npcs: {},
  };
}

/** SVG path string for a polygon (for the debug overlay). */
export function polygonToSvgPath(poly: Vec2[]): string {
  if (poly.length === 0) return '';
  return poly.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';
}
