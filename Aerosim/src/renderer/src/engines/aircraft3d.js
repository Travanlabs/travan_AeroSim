/**
 * Travan Aero Simulator — Aircraft 3D Geometry Builder
 * Coordinate frame:  +X = aft (tail), +Y = up, +Z = starboard
 *
 * LAYOUT CONVENTION (wing-centred):
 *   • Fuselage runs  x = 0 (nose tip) → fuse_length (tail)
 *   • wing_le_x  = X position of wing root leading-edge on the fuselage
 *     (default ≈ 35 % of fuse_length — adjustable via slider)
 *   • Wing LE root is placed at  x = wing_le_x,  y = 0,  z = 0
 *   • Nacelles follow wing_le_x automatically
 *   • H-tail & V-tail are placed at a fixed aft fraction of fuse_length
 *   • CG marker rendered separately at  x = cg_x_frac * fuse_length
 */

import { V3, faceNormal, diffuseLight, heatColor, cpColor, lerp, clamp } from './renderer3d.js';

// ── NACA 4-digit airfoil coords ─────────────────────────────────
export function naca4(m_str, p_str, t_str, N=32) {
  const m = parseInt(m_str||'0')/100;
  const p = parseInt(p_str||'0')/10;
  const t = parseInt(t_str||'12')/100;
  const pts_upper=[], pts_lower=[];
  for (let i=0;i<=N;i++) {
    const x = 0.5*(1-Math.cos(i*Math.PI/N));
    const yt = (t/0.2)*(0.2969*Math.sqrt(x)-0.1260*x-0.3516*x*x+0.2843*x*x*x-0.1015*x*x*x*x);
    let yc=0, dyc_dx=0;
    if(m>0&&p>0) {
      if(x<p){ yc=(m/(p*p))*(2*p*x-x*x); dyc_dx=(2*m/(p*p))*(p-x); }
      else   { yc=(m/((1-p)*(1-p)))*(1-2*p+2*p*x-x*x); dyc_dx=(2*m/((1-p)*(1-p)))*(p-x); }
    }
    const theta=Math.atan(dyc_dx);
    pts_upper.push([x - yt*Math.sin(theta), yc + yt*Math.cos(theta)]);
    pts_lower.push([x + yt*Math.sin(theta), yc - yt*Math.cos(theta)]);
  }
  return { upper: pts_upper, lower: pts_lower };
}

// ── Airfoil lookup ───────────────────────────────────────────────
export function getAirfoilCoords(key, N=24) {
  const k = key.replace(/\s+/g,'').toUpperCase();
  const m4 = k.match(/^NACA(\d)(\d)(\d{2})$/);
  if(m4) return naca4(m4[1], m4[2], m4[3], N);
  const m5 = k.match(/^NACA(\d{5})$/);
  if(m5) return naca4('2','4','12',N);
  if(k.includes('RAE')||k.includes('SUPER')) return naca4('2','4','11',N);
  if(k.includes('0006')) return naca4('0','0','06',N);
  if(k.includes('0008')) return naca4('0','0','08',N);
  if(k.includes('0009')) return naca4('0','0','09',N);
  if(k.includes('0010')) return naca4('0','0','10',N);
  if(k.includes('0012')) return naca4('0','0','12',N);
  if(k.includes('0015')) return naca4('0','0','15',N);
  if(k.includes('0018')) return naca4('0','0','18',N);
  if(k.includes('64A'))  return naca4('0','0','10',N);
  if(k.includes('CLARKY')) return naca4('3','6','12',N);
  return naca4('2','4','12',N);
}

// ── Wing mesh builder ────────────────────────────────────────────
// Wing is built in its own local frame (LE root at origin) then
// translated to wing_le_x by the caller (buildAircraftMesh).
export function buildWingMesh(params, side=1) {
  const {
    span, chord_root, chord_tip, sweep_deg, dihedral_deg, twist_deg,
    airfoilKey, span_panels=20, chord_panels=16,
  } = params;
  const sweep = sweep_deg * Math.PI/180;
  const dih   = dihedral_deg * Math.PI/180;
  const halfSpan = span/2;

  const foil = getAirfoilCoords(airfoilKey||'NACA 2412', chord_panels);
  const faces = [];
  const spanStations = span_panels + 1;
  const chordPoints  = foil.upper.length;

  function stationGeom(eta) {
    const y_span = side * halfSpan * eta;
    const chord  = lerp(chord_root, chord_tip, eta);
    const x_le   = Math.abs(y_span) * Math.tan(sweep);
    const y_dih  = Math.abs(y_span) * Math.tan(dih);
    const twist  = twist_deg * eta * Math.PI/180;

    const pts_upper=[], pts_lower=[];
    for(let i=0;i<chordPoints;i++) {
      const [xc_u, yc_u] = foil.upper[i];
      const [xc_l, yc_l] = foil.lower[i];
      const qc = 0.25;
      const xu = xc_u - qc, yu = yc_u;
      const xl = xc_l - qc, yl = yc_l;
      const xu_t = xu*Math.cos(twist) - yu*Math.sin(twist) + qc;
      const yu_t = xu*Math.sin(twist) + yu*Math.cos(twist);
      const xl_t = xl*Math.cos(twist) - yl*Math.sin(twist) + qc;
      const yl_t = xl*Math.sin(twist) + yl*Math.cos(twist);
      // Local: LE root at x=0, chord along +X, span along +Z
      pts_upper.push([x_le + xu_t*chord, y_dih + yu_t*chord, y_span]);
      pts_lower.push([x_le + xl_t*chord, y_dih + yl_t*chord, y_span]);
    }
    return { upper: pts_upper, lower: pts_lower };
  }

  const grid = [];
  for(let si=0;si<spanStations;si++) grid.push(stationGeom(si/(spanStations-1)));

  for(let si=0;si<spanStations-1;si++) {
    const g0=grid[si], g1=grid[si+1];
    for(let ci=0;ci<chordPoints-1;ci++) {
      const a=g0.upper[ci], b=g0.upper[ci+1], c=g1.upper[ci+1], d=g1.upper[ci];
      faces.push({verts:[a,b,c], normal:faceNormal(a,b,c), surface:'upper', eta:(si+0.5)/(spanStations-1), xc:(ci+0.5)/(chordPoints-1)});
      faces.push({verts:[a,c,d], normal:faceNormal(a,c,d), surface:'upper', eta:(si+0.5)/(spanStations-1), xc:(ci+0.5)/(chordPoints-1)});
    }
    for(let ci=0;ci<chordPoints-1;ci++) {
      const a=g0.lower[ci], b=g0.lower[ci+1], c=g1.lower[ci+1], d=g1.lower[ci];
      faces.push({verts:[c,b,a], normal:faceNormal(c,b,a), surface:'lower', eta:(si+0.5)/(spanStations-1), xc:(ci+0.5)/(chordPoints-1)});
      faces.push({verts:[d,c,a], normal:faceNormal(d,c,a), surface:'lower', eta:(si+0.5)/(spanStations-1), xc:(ci+0.5)/(chordPoints-1)});
    }
    if(si===spanStations-2) {
      for(let ci=0;ci<chordPoints-1;ci++) {
        const a=g1.upper[ci], b=g1.upper[ci+1], c=g1.lower[ci+1], d=g1.lower[ci];
        const n=faceNormal(a,b,c);
        faces.push({verts:[a,b,c], normal:n, surface:'tip', eta:1, xc:0.5});
        faces.push({verts:[a,c,d], normal:n, surface:'tip', eta:1, xc:0.5});
      }
    }
  }
  return faces;
}

// ── Fuselage mesh ────────────────────────────────────────────────
// x = 0 (nose tip) → fuse_length (tail).  No dependency on wing position.
export function buildFuselageMesh(params) {
  const { fuse_length=15, fuse_diameter=1.8, fuse_nose_length=3, fuse_tail_taper=0.3 } = params;
  const R = fuse_diameter/2;
  const N_circ = 24;
  const N_long = 40;

  const nose_frac = Math.min(0.45, Math.max(0.04, fuse_nose_length / fuse_length));
  const tail_start = nose_frac + (1 - nose_frac) * 0.85;

  const faces = [];

  function sectionRadius(t) {
    if (t < nose_frac) {
      const nt = t / nose_frac;
      return R * Math.sqrt(1 - (1 - nt) * (1 - nt));
    } else if (t > tail_start) {
      const tt = (t - tail_start) / (1 - tail_start);
      return R * lerp(1, fuse_tail_taper, tt);
    }
    return R;
  }

  function sectionPoint(t, angle) {
    const r  = sectionRadius(t);
    const x  = t * fuse_length;
    const ry = t > nose_frac && t < tail_start ? r * 1.05 : r;
    return [x, ry*Math.sin(angle), r*Math.cos(angle)];
  }

  const grid = [];
  for(let li=0;li<=N_long;li++) {
    const t=li/N_long;
    const ring=[];
    for(let ci=0;ci<=N_circ;ci++) ring.push(sectionPoint(t,(ci/N_circ)*2*Math.PI));
    grid.push(ring);
  }

  for(let li=0;li<N_long;li++) {
    for(let ci=0;ci<N_circ;ci++) {
      const a=grid[li][ci], b=grid[li][ci+1], c=grid[li+1][ci+1], d=grid[li+1][ci];
      const t=(li+0.5)/N_long;
      faces.push({verts:[a,b,c],normal:faceNormal(a,b,c),surface:'fuse',t});
      faces.push({verts:[a,c,d],normal:faceNormal(a,c,d),surface:'fuse',t});
    }
  }
  return faces;
}

// ── Horizontal stabiliser ────────────────────────────────────────
export function buildHTailMesh(params, side=1) {
  const {
    fuse_length=15,
    htail_span=4.0, htail_chord_root=1.4, htail_chord_tip=0.7,
    htail_sweep=35, htail_dihedral=3,
    htail_airfoilKey='NACA 0012',
  } = params;
  const tailParams = {
    span: htail_span, chord_root: htail_chord_root, chord_tip: htail_chord_tip,
    sweep_deg: htail_sweep, dihedral_deg: htail_dihedral, twist_deg: 0,
    airfoilKey: htail_airfoilKey, span_panels: 10, chord_panels: 10,
  };
  const faces = buildWingMesh(tailParams, side);
  // H-tail LE root placed at 82 % of fuselage length, slightly low
  const x_tail = fuse_length * 0.82;
  const y_tail = -fuse_length * 0.004;
  return faces.map(f => ({
    ...f,
    verts: f.verts.map(v => [v[0]+x_tail, v[1]+y_tail, v[2]]),
    surface: 'htail',
  }));
}

// ── Vertical stabiliser ──────────────────────────────────────────
export function buildVTailMesh(params) {
  const {
    fuse_length=15, fuse_diameter=1.8,
    vtail_height=3.2, vtail_chord_root=2.0, vtail_chord_tip=0.8,
    vtail_sweep=40, vtail_airfoilKey='NACA 0009',
  } = params;
  const N_span=12, N_chord=12;
  const foil  = getAirfoilCoords(vtail_airfoilKey, N_chord);
  const sweep  = vtail_sweep * Math.PI/180;
  const R      = fuse_diameter/2;
  // V-tail LE root at 78 % of fuselage length, sitting on top of fuselage
  const x_tail = fuse_length * 0.78;
  const faces  = [];
  const chordPts = foil.upper.length;
  const spanPts  = N_span + 1;

  function stationGeom(eta) {
    const y    = R + vtail_height * eta;
    const chord = lerp(vtail_chord_root, vtail_chord_tip, eta);
    const x_le  = x_tail + vtail_height * eta * Math.tan(sweep);
    const pts_left=[], pts_right=[];
    for(let i=0;i<chordPts;i++) {
      const [xc_u,yc_u]=foil.upper[i];
      const [xc_l,yc_l]=foil.lower[i];
      pts_right.push([x_le+xc_u*chord, y, yc_u*chord]);
      pts_left.push( [x_le+xc_l*chord, y, yc_l*chord]);
    }
    return {right:pts_right, left:pts_left};
  }

  const grid=[];
  for(let si=0;si<spanPts;si++) grid.push(stationGeom(si/(spanPts-1)));

  for(let si=0;si<spanPts-1;si++) {
    const g0=grid[si],g1=grid[si+1];
    for(let ci=0;ci<chordPts-1;ci++) {
      const a=g0.right[ci],b=g0.right[ci+1],c=g1.right[ci+1],d=g1.right[ci];
      faces.push({verts:[a,b,c],normal:faceNormal(a,b,c),surface:'vtail'});
      faces.push({verts:[a,c,d],normal:faceNormal(a,c,d),surface:'vtail'});
      const p=g0.left[ci],q=g0.left[ci+1],r=g1.left[ci+1],s=g1.left[ci];
      faces.push({verts:[r,q,p],normal:faceNormal(r,q,p),surface:'vtail'});
      faces.push({verts:[s,r,p],normal:faceNormal(s,r,p),surface:'vtail'});
    }
  }
  return faces;
}

// ── Engine nacelle ───────────────────────────────────────────────
// Nacelles are anchored relative to wing_le_x so they move with the wing.
export function buildNacelleMesh(params, side=1) {
  const {
    span, chord_root, chord_tip, sweep_deg, dihedral_deg,
    engine_count=2, nacelle_length=3.5, nacelle_diameter=1.2,
    nacelle_span_pos=0.35,
    wing_le_x=0,           // ← wing anchor offset
  } = params;
  if(engine_count===0) return [];

  const sweep=sweep_deg*Math.PI/180, dih=dihedral_deg*Math.PI/180;
  const halfSpan=span/2;
  const eta=nacelle_span_pos;
  const y_span=side*halfSpan*eta;
  const x_le_local=Math.abs(y_span)*Math.tan(sweep);
  const y_dih=Math.abs(y_span)*Math.tan(dih);
  const chord=lerp(chord_root, chord_tip||chord_root*0.5, eta);

  // Nacelle centre in world space — offset by wing_le_x
  const x_center = wing_le_x + x_le_local + chord*0.35;
  const y_center = y_dih - nacelle_diameter*0.6;
  const z_center = y_span;

  const N=20, M=18, R=nacelle_diameter/2, L=nacelle_length;
  const faces=[];
  function nacellePoint(t, angle) {
    let r=R;
    if(t<0.15) r=R*Math.sqrt(t/0.15);
    if(t>0.85) r=R*lerp(1,0.7,(t-0.85)/0.15);
    return [x_center+t*L-L/2, y_center+r*Math.sin(angle), z_center+r*Math.cos(angle)];
  }
  const grid=[];
  for(let li=0;li<=N;li++){
    const t=li/N; const ring=[];
    for(let ci=0;ci<=M;ci++) ring.push(nacellePoint(t,(ci/M)*2*Math.PI));
    grid.push(ring);
  }
  for(let li=0;li<N;li++) for(let ci=0;ci<M;ci++) {
    const a=grid[li][ci],b=grid[li][ci+1],c=grid[li+1][ci+1],d=grid[li+1][ci];
    faces.push({verts:[a,b,c],normal:faceNormal(a,b,c),surface:'nacelle'});
    faces.push({verts:[a,c,d],normal:faceNormal(a,c,d),surface:'nacelle'});
  }
  return faces;
}

// ── Full aircraft builder ────────────────────────────────────────
// wing_le_x : X-coord of wing root LE on the fuselage (metres from nose)
// cg_x_frac : centre-of-gravity position as fraction of fuse_length  (0=nose, 1=tail)
export function buildAircraftMesh(params) {
  const wing_le_x = params.wing_le_x ?? (params.fuse_length ?? 15) * 0.35;
  const paramsWithWing = { ...params, wing_le_x };

  const all = [];
  // Fuselage (nose at x=0, tail at x=fuse_length — independent of wing)
  all.push(...buildFuselageMesh(paramsWithWing));

  // Wings translated to wing_le_x
  const wingFaces = [
    ...buildWingMesh(paramsWithWing, +1),
    ...buildWingMesh(paramsWithWing, -1),
  ];
  const wingOffset = f => ({ ...f, verts: f.verts.map(v => [v[0]+wing_le_x, v[1], v[2]]) });
  all.push(...wingFaces.map(wingOffset));

  // Empennage (self-contained — uses fuse_length fractions)
  all.push(...buildHTailMesh(paramsWithWing, +1));
  all.push(...buildHTailMesh(paramsWithWing, -1));
  all.push(...buildVTailMesh(paramsWithWing));

  // Nacelles (anchored to wing via wing_le_x inside buildNacelleMesh)
  if((paramsWithWing.engine_count||2)>0) {
    all.push(...buildNacelleMesh(paramsWithWing, +1));
    all.push(...buildNacelleMesh(paramsWithWing, -1));
    if((paramsWithWing.engine_count||2)===4) {
      const p2={...paramsWithWing, nacelle_span_pos:(paramsWithWing.nacelle_span_pos||0.35)*1.7};
      all.push(...buildNacelleMesh(p2, +1));
      all.push(...buildNacelleMesh(p2, -1));
    }
  }
  return all;
}

// ── CG marker geometry ───────────────────────────────────────────
// Returns a list of face-like objects that render as a diamond marker
// at the CG position in world space.
export function buildCGMarker(params) {
  const fuse_length = params.fuse_length ?? 15;
  const cg_x_frac   = params.cg_x_frac  ?? 0.38;
  const cg_x = cg_x_frac * fuse_length;
  const cg_y = 0;
  const cg_z = 0;

  // Octahedron-ish diamond: 6 verts, 8 triangles
  const s  = Math.max(0.3, fuse_length * 0.014);  // scale with aircraft size
  const verts = [
    [cg_x,     cg_y+s, cg_z  ],  // top
    [cg_x,     cg_y-s, cg_z  ],  // bottom
    [cg_x-s,   cg_y,   cg_z  ],  // fore
    [cg_x+s,   cg_y,   cg_z  ],  // aft
    [cg_x,     cg_y,   cg_z+s],  // starboard
    [cg_x,     cg_y,   cg_z-s],  // port
  ];
  const tris = [
    [0,2,4],[0,4,3],[0,3,5],[0,5,2],
    [1,4,2],[1,3,4],[1,5,3],[1,2,5],
  ];
  return tris.map(([i,j,k]) => ({
    verts: [verts[i],verts[j],verts[k]],
    normal: faceNormal(verts[i],verts[j],verts[k]),
    surface: 'cg',
  }));
}

// ── Colour face by mode ──────────────────────────────────────────
export function colorFace(face, mode, results, theme='dark') {
  const surf = face.surface;
  const lum  = diffuseLight(face.normal);

  // CG marker — always vivid magenta regardless of mode/theme
  if(surf === 'cg') return `rgb(255,50,220)`;

  if(mode==='airflow' && results?.aero && (surf==='upper'||surf==='lower')) {
    const eta = face.eta||0.5;
    const xc  = face.xc||0.5;
    const cpDist = results.aero.cpDistribution||[];
    const idx  = clamp(Math.round(xc*(cpDist.length-1)),0,cpDist.length-1);
    const cp   = surf==='upper' ? (cpDist[idx]?.upper||(-1+eta)) : (cpDist[idx]?.lower||0.2);
    return cpColor(cp);
  }

  if(mode==='fea' && results?.fea && surf!=='fuse') {
    const nodes=results.fea.nodes||[];
    if(nodes.length) {
      const eta=face.eta||0.5;
      const ni=clamp(Math.round(eta*(nodes.length-1)),0,nodes.length-1);
      const norm=(nodes[ni]?.sigma_vm||0)/(results.fea.maxStress_MPa+0.001);
      return heatColor(clamp(norm,0,1));
    }
  }

  if(mode==='mach' && results?.mach && surf!=='fuse') {
    const t=clamp((face.xc||0.5),0,1);
    if(results.mach.isSupercritical && t>0.45) return heatColor(0.8+Math.random()*0.2);
    return heatColor(t*0.5);
  }

  const baseColors = {
    dark: {
      upper:[30,90,160], lower:[25,75,140], tip:[40,110,180],
      fuse:[35,85,150], htail:[28,80,145], vtail:[28,80,145], nacelle:[20,55,100],
    },
    light: {
      upper:[140,175,220], lower:[120,155,200], tip:[150,185,225],
      fuse:[130,165,210], htail:[125,160,205], vtail:[125,160,205], nacelle:[100,135,185],
    },
  };
  const bc = baseColors[theme]?.[surf] || baseColors[theme]?.upper || [80,120,180];
  const r=clamp(Math.round(bc[0]*lum),0,255);
  const g=clamp(Math.round(bc[1]*lum),0,255);
  const b=clamp(Math.round(bc[2]*lum),0,255);
  return `rgb(${r},${g},${b})`;
}
