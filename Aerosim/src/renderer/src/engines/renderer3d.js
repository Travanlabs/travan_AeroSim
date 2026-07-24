/**
 * Travan Aero Simulator — 3D Renderer Engine
 * Clean perspective projection, correct view presets, proper camera math
 */

// ── Vector / Matrix math ──────────────────────────────────────
export const V3 = {
  add:   (a,b) => [a[0]+b[0], a[1]+b[1], a[2]+b[2]],
  sub:   (a,b) => [a[0]-b[0], a[1]-b[1], a[2]-b[2]],
  scale: (a,s) => [a[0]*s, a[1]*s, a[2]*s],
  dot:   (a,b) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2],
  cross: (a,b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]],
  len:   a => Math.sqrt(a[0]*a[0]+a[1]*a[1]+a[2]*a[2]),
  norm:  a => { const l=Math.sqrt(a[0]*a[0]+a[1]*a[1]+a[2]*a[2])||1; return [a[0]/l,a[1]/l,a[2]/l]; },
};

// ── View presets ──────────────────────────────────────────────
// Azimuth / elevation in degrees; distance is overridden at runtime
// by autoFitDistance() so these are just angular defaults.
export const VIEW_PRESETS = {
  '3d':    { azimuth: -30,  elevation: 22,  distance: 80 },
  'top':   { azimuth:   0,  elevation: 89.9,distance: 80 },
  'front': { azimuth:   0,  elevation:  0,  distance: 80 },
  'side':  { azimuth: -90,  elevation:  0,  distance: 80 },
};

/**
 * Compute a sensible camera distance so the whole aircraft fits the canvas.
 * fuse_length is the dominant dimension; span is secondary.
 * Returns distance in world units.
 */
export function autoFitDistance(params, fovDeg=55) {
  const L  = params?.fuse_length || 15;
  const S  = params?.span        || 30;
  const size = Math.max(L, S) * 0.7;          // bounding radius estimate
  const fovRad = fovDeg * Math.PI / 180;
  return size / Math.tan(fovRad / 2);          // distance so object fills ~60% of FOV
}

/**
 * Aircraft centroid in world space — used as the default camera target
 * so orbit rotates about the middle of the aircraft, not the nose.
 */
export function aircraftCentroid(params) {
  const L = params?.fuse_length || 15;
  // Mid-fuselage X, on centreline
  return [L * 0.5, 0, 0];
}

// ── Camera helpers ────────────────────────────────────────────
export function sphericalToEye(azimuth, elevation, distance, target) {
  const az = azimuth   * Math.PI / 180;
  const el = elevation * Math.PI / 180;
  return [
    target[0] + distance * Math.cos(el) * Math.sin(az),
    target[1] + distance * Math.sin(el),
    target[2] + distance * Math.cos(el) * Math.cos(az),
  ];
}

export function buildViewMatrix(eye, target, up=[0,1,0]) {
  const f = V3.norm(V3.sub(target, eye));
  let r = V3.norm(V3.cross(f, up));
  // Guard gimbal-lock when looking straight up/down
  if (V3.len(r) < 1e-6) r = V3.norm(V3.cross(f, [0,0,1]));
  const u2 = V3.cross(r, f);
  return { f, r, u: u2, eye };
}

/**
 * Perspective projection.
 * fovDeg — full vertical FOV in degrees (default 55 — natural, undistorted)
 */
export function projectPoint(p, cam, W, H, fovDeg=55) {
  const { f, r, u: uv, eye } = cam;
  const d  = V3.sub(p, eye);
  const pz = V3.dot(d, f);
  const px = V3.dot(d, r);
  const py = V3.dot(d, uv);
  if (pz <= 0.01) return null;
  const aspect  = W / H;
  const half    = Math.tan((fovDeg * Math.PI / 180) / 2);
  // NDC in [-1,1], then to screen pixels
  const ndcX =  px / (pz * half * aspect);
  const ndcY = -py / (pz * half);
  const sx = (ndcX + 1) * 0.5 * W;
  const sy = (ndcY + 1) * 0.5 * H;
  return { sx, sy, depth: pz };
}

/**
 * Orthographic projection.
 * zoom — world units visible per half-height (auto-scaled from distance)
 */
export function projectOrtho(p, cam, W, H, zoom=1) {
  const { f, r, u: uv, eye } = cam;
  const d  = V3.sub(p, eye);
  const pz = V3.dot(d, f);
  const px = V3.dot(d, r);
  const py = V3.dot(d, uv);
  // zoom = pixels per world unit; scale so aircraft fills view
  const scale = zoom * Math.min(W, H) * 0.45;
  const sx = px * scale + W / 2;
  const sy = -py * scale + H / 2;
  return { sx, sy, depth: pz };
}

// ── Colour utilities ──────────────────────────────────────────
export const clamp = (v,a,b) => Math.max(a, Math.min(b,v));
export const lerp  = (a,b,t) => a+(b-a)*t;
export const DEG   = Math.PI/180;

export function heatColor(t) {
  t = clamp(t,0,1);
  const colors = [[0,0,180],[0,180,255],[0,220,100],[255,220,0],[255,40,0]];
  const idx = t*(colors.length-1);
  const lo=Math.floor(idx), hi=Math.min(lo+1,colors.length-1);
  const f=idx-lo;
  const c=colors[lo].map((v,i)=>Math.round(v+(colors[hi][i]-v)*f));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

export function heatColorA(t, alpha=1) {
  t = clamp(t,0,1);
  const colors = [[0,0,180],[0,180,255],[0,220,100],[255,220,0],[255,40,0]];
  const idx=t*(colors.length-1);
  const lo=Math.floor(idx), hi=Math.min(lo+1,colors.length-1);
  const f=idx-lo;
  const c=colors[lo].map((v,i)=>Math.round(v+(colors[hi][i]-v)*f));
  return `rgba(${c[0]},${c[1]},${c[2]},${alpha})`;
}

export function cpColor(cp) {
  return heatColor(clamp((-cp+0.5)/3.5, 0,1));
}

// ── Lighting ──────────────────────────────────────────────────
const LIGHT_DIR = V3.norm([0.5, 0.8, 0.35]);
export function diffuseLight(normal) {
  const d = Math.max(0, V3.dot(V3.norm(normal), LIGHT_DIR));
  return 0.28 + d * 0.72;
}

export function faceNormal(a, b, c) {
  return V3.cross(V3.sub(b,a), V3.sub(c,a));
}
