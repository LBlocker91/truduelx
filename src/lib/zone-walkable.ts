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

export interface ZoneWalkable {
  /** Walkable floor polygon in % coords. */
  polygon: Vec2[];
  /** Safe spawn point. Must lie inside polygon. */
  spawn: Vec2;
  /** Per-NPC layout keyed by NPC name (matches seeded data). */
  npcs: Record<string, NpcPlacement>;
}

// ---- Zone definitions --------------------------------------------------------
// All three zones use ~16:10 sci-fi backgrounds with a clear floor band in the
// lower half. The polygons are tuned trapezoids that match the visible perspective.

export const ZONE_WALKABLE: Record<string, ZoneWalkable> = {
  'station-hub': {
    // Bazaar floor: wide trapezoid across the lower half; tighter at the back wall.
    polygon: [
      { x: 22, y: 58 },  // back-left
      { x: 78, y: 58 },  // back-right
      { x: 96, y: 92 },  // front-right
      { x:  4, y: 92 },  // front-left
    ],
    spawn: { x: 50, y: 80 },
    npcs: {
      // Vendors / quest-givers stand on the floor in front of their stalls.
      'Scout Junko':       { visual: { x: 16, y: 70 }, interaction: { x: 18, y: 78 } },
      'Quartermaster Vex': { visual: { x: 32, y: 74 }, interaction: { x: 32, y: 82 } },
      'Commander Hale':    { visual: { x: 52, y: 70 }, interaction: { x: 52, y: 82 } },
      'Doc Circuits':      { visual: { x: 68, y: 74 }, interaction: { x: 68, y: 82 } },
      'Tinker Mira':       { visual: { x: 84, y: 70 }, interaction: { x: 82, y: 78 } },
    },
  },

  'wasteland': {
    // Open desert path: gently curving, wide in front, narrow at horizon.
    polygon: [
      { x: 28, y: 60 },
      { x: 72, y: 60 },
      { x: 98, y: 94 },
      { x:  2, y: 94 },
    ],
    spawn: { x: 50, y: 82 },
    npcs: {
      'Scrapper Drone':     { visual: { x: 18, y: 72 }, interaction: { x: 20, y: 80 } },
      'Stranded Survivor':  { visual: { x: 36, y: 76 }, interaction: { x: 36, y: 84 } },
      'Wasteland Marauder': { visual: { x: 52, y: 72 }, interaction: { x: 52, y: 82 } },
      'Rogue War-Mech':     { visual: { x: 68, y: 76 }, interaction: { x: 68, y: 84 } },
      'Wasteland Overlord': { visual: { x: 84, y: 72 }, interaction: { x: 82, y: 80 } },
    },
  },

  'neon-district': {
    // Wet neon street: trapezoidal sidewalk strip, slightly higher horizon.
    polygon: [
      { x: 24, y: 62 },
      { x: 76, y: 62 },
      { x: 96, y: 93 },
      { x:  4, y: 93 },
    ],
    spawn: { x: 50, y: 80 },
    npcs: {
      'Whisper':            { visual: { x: 16, y: 72 }, interaction: { x: 18, y: 80 } },
      'Cyber-Doc Riku':     { visual: { x: 34, y: 76 }, interaction: { x: 34, y: 84 } },
      'Neon Gangster':      { visual: { x: 52, y: 72 }, interaction: { x: 52, y: 82 } },
      'Syndicate Enforcer': { visual: { x: 68, y: 76 }, interaction: { x: 68, y: 84 } },
      'The Fixer':          { visual: { x: 84, y: 72 }, interaction: { x: 82, y: 80 } },
    },
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
