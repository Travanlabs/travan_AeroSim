/**
 * Travan Aero Simulator — Geometry Import Engine
 * Supports: ASCII STL, Binary STL, OBJ (Wavefront), Simple Assembly JSON
 *
 * Returns a normalised GeometryModel:
 * {
 *   vertices: Float32Array,   // [x,y,z, x,y,z, ...]
 *   normals:  Float32Array,   // per-vertex normals
 *   triangles: Uint32Array,   // index triples
 *   bbox: { min, max, center, size },
 *   stats: { triCount, vertCount, surfaceArea, volume },
 *   name: string,
 *   format: string,
 * }
 */

// ── Bounding box ───────────────────────────────────────────────
function computeBBox(vertices) {
  const min = { x: Infinity, y: Infinity, z: Infinity }
  const max = { x: -Infinity, y: -Infinity, z: -Infinity }
  for (let i = 0; i < vertices.length; i += 3) {
    const x = vertices[i], y = vertices[i + 1], z = vertices[i + 2]
    if (x < min.x) min.x = x; if (x > max.x) max.x = x
    if (y < min.y) min.y = y; if (y > max.y) max.y = y
    if (z < min.z) min.z = z; if (z > max.z) max.z = z
  }
  const center = { x: (min.x + max.x) / 2, y: (min.y + max.y) / 2, z: (min.z + max.z) / 2 }
  const size = { x: max.x - min.x, y: max.y - min.y, z: max.z - min.z }
  return { min, max, center, size }
}

// ── Centre and normalise geometry ─────────────────────────────
function normaliseGeometry(vertices) {
  const bbox = computeBBox(vertices)
  const maxDim = Math.max(bbox.size.x, bbox.size.y, bbox.size.z)
  const scale = maxDim > 0 ? 8.0 / maxDim : 1  // fit in ±4 units
  const out = new Float32Array(vertices.length)
  for (let i = 0; i < vertices.length; i += 3) {
    out[i]     = (vertices[i]     - bbox.center.x) * scale
    out[i + 1] = (vertices[i + 1] - bbox.center.y) * scale
    out[i + 2] = (vertices[i + 2] - bbox.center.z) * scale
  }
  return { vertices: out, scale, bbox }
}

// ── Compute per-face normals ───────────────────────────────────
function computeNormals(vertices, triangles) {
  const normals = new Float32Array(vertices.length)
  const nTri = triangles ? triangles.length / 3 : vertices.length / 9

  if (triangles) {
    for (let i = 0; i < triangles.length; i += 3) {
      const a = triangles[i] * 3, b = triangles[i + 1] * 3, c = triangles[i + 2] * 3
      const ax = vertices[b] - vertices[a], ay = vertices[b+1] - vertices[a+1], az = vertices[b+2] - vertices[a+2]
      const bx = vertices[c] - vertices[a], by = vertices[c+1] - vertices[a+1], bz = vertices[c+2] - vertices[a+2]
      const nx = ay*bz - az*by, ny = az*bx - ax*bz, nz = ax*by - ay*bx
      const len = Math.sqrt(nx*nx + ny*ny + nz*nz) || 1
      for (const idx of [triangles[i], triangles[i+1], triangles[i+2]]) {
        normals[idx*3]   += nx/len
        normals[idx*3+1] += ny/len
        normals[idx*3+2] += nz/len
      }
    }
  } else {
    // Flat face normals for unindexed meshes
    for (let i = 0; i < vertices.length; i += 9) {
      const ax = vertices[i+3]-vertices[i], ay = vertices[i+4]-vertices[i+1], az = vertices[i+5]-vertices[i+2]
      const bx = vertices[i+6]-vertices[i], by = vertices[i+7]-vertices[i+1], bz = vertices[i+8]-vertices[i+2]
      const nx = ay*bz - az*by, ny = az*bx - ax*bz, nz = ax*by - ay*bx
      const len = Math.sqrt(nx*nx + ny*ny + nz*nz) || 1
      normals[i]=nx/len; normals[i+1]=ny/len; normals[i+2]=nz/len
      normals[i+3]=nx/len; normals[i+4]=ny/len; normals[i+5]=nz/len
      normals[i+6]=nx/len; normals[i+7]=ny/len; normals[i+8]=nz/len
    }
  }
  return normals
}

// ── Surface area & volume (divergence theorem) ─────────────────
function computeStats(vertices, triangles) {
  let area = 0, volume = 0
  const nTri = triangles ? triangles.length / 3 : vertices.length / 9

  const getVert = (idx) => {
    if (triangles) {
      const i = triangles[idx] * 3
      return [vertices[i], vertices[i+1], vertices[i+2]]
    }
    return [vertices[idx*3], vertices[idx*3+1], vertices[idx*3+2]]
  }

  for (let i = 0; i < nTri; i++) {
    const [ax, ay, az] = getVert(i*3)
    const [bx, by, bz] = getVert(i*3+1)
    const [cx, cy, cz] = getVert(i*3+2)
    const ex = bx-ax, ey = by-ay, ez = bz-az
    const fx = cx-ax, fy = cy-ay, fz = cz-az
    const nx = ey*fz - ez*fy, ny = ez*fx - ex*fz, nz = ex*fy - ey*fx
    area += Math.sqrt(nx*nx + ny*ny + nz*nz) / 2
    volume += (ax*(by*cz - bz*cy) + bx*(cy*az - cz*ay) + cx*(ay*bz - az*by)) / 6
  }
  return { surfaceArea: area, volume: Math.abs(volume), triCount: nTri, vertCount: triangles ? vertices.length/3 : nTri*3 }
}

// ── ASCII STL parser ───────────────────────────────────────────
function parseASCII_STL(text) {
  const verts = []
  const re = /vertex\s+([-\d.eE+]+)\s+([-\d.eE+]+)\s+([-\d.eE+]+)/g
  let m
  while ((m = re.exec(text)) !== null) {
    verts.push(parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3]))
  }
  return new Float32Array(verts)
}

// ── Binary STL parser ──────────────────────────────────────────
function parseBinary_STL(buffer) {
  const view = new DataView(buffer)
  const nTri = view.getUint32(80, true)
  const verts = new Float32Array(nTri * 9)
  let offset = 84
  for (let i = 0; i < nTri; i++) {
    offset += 12 // skip normal
    for (let j = 0; j < 9; j++) {
      verts[i * 9 + j] = view.getFloat32(offset, true)
      offset += 4
    }
    offset += 2 // attribute
  }
  return verts
}

// ── OBJ parser ────────────────────────────────────────────────
function parseOBJ(text) {
  const positions = []
  const indices = []
  const lines = text.split('\n')

  for (const line of lines) {
    const parts = line.trim().split(/\s+/)
    if (parts[0] === 'v') {
      positions.push(parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3]))
    } else if (parts[0] === 'f') {
      // Triangulate polygon faces
      const faceVerts = parts.slice(1).map(p => parseInt(p.split('/')[0]) - 1)
      for (let i = 1; i < faceVerts.length - 1; i++) {
        indices.push(faceVerts[0], faceVerts[i], faceVerts[i + 1])
      }
    }
  }

  const vertices = new Float32Array(positions)
  const triangles = new Uint32Array(indices)
  return { vertices, triangles }
}

// ── Assembly JSON parser ───────────────────────────────────────
function parseAssemblyJSON(text) {
  const asm = JSON.parse(text)
  // Expected: { name, components: [{ name, vertices:[], triangles:[] }, ...] }
  const allVerts = []
  const allTris = []
  let offset = 0

  const components = asm.components || [asm]
  for (const comp of components) {
    const v = comp.vertices || []
    const t = comp.triangles || comp.faces || []
    for (const val of v) allVerts.push(val)
    for (const idx of t) allTris.push(idx + offset)
    offset += v.length / 3
  }
  return {
    vertices: new Float32Array(allVerts),
    triangles: new Uint32Array(allTris),
    name: asm.name || 'Assembly',
  }
}

// ── Aerodynamic feature extraction ────────────────────────────
export function extractAeroFeatures(model) {
  const { bbox, stats } = model

  // Estimate wingspan from largest dimension
  const dims = [bbox.size.x, bbox.size.y, bbox.size.z].sort((a, b) => b - a)
  const span = dims[0]
  const chord = dims[1]
  const thickness = dims[2]

  // Fineness ratio estimate
  const t_c = thickness / chord

  // Approximate projected area
  const S_ref = span * chord * 0.85  // planform factor

  // Aspect ratio estimate
  const AR = span * span / S_ref

  return {
    span: parseFloat(span.toFixed(3)),
    chord_root: parseFloat(chord.toFixed(3)),
    chord_tip: parseFloat((chord * 0.55).toFixed(3)),
    t_c: parseFloat(t_c.toFixed(4)),
    S_ref: parseFloat(S_ref.toFixed(3)),
    AR: parseFloat(AR.toFixed(3)),
    volume_m3: stats.volume,
    surface_m2: stats.surfaceArea,
    estimated_mass_kg: stats.volume * 2700, // Al density assumption
  }
}

// ── Main entry point ──────────────────────────────────────────
export async function parseGeometryFile(file) {
  const name = file.name
  const ext = name.split('.').pop().toLowerCase()

  let vertices, triangles, modelName

  if (ext === 'stl') {
    const buffer = await file.arrayBuffer()
    const headerText = new TextDecoder().decode(buffer.slice(0, 80))
    const isASCII = headerText.toLowerCase().includes('solid') &&
      new TextDecoder().decode(buffer.slice(0, 256)).includes('facet')

    if (isASCII) {
      const text = new TextDecoder().decode(buffer)
      vertices = parseASCII_STL(text)
      triangles = null
    } else {
      vertices = parseBinary_STL(buffer)
      triangles = null
    }
    modelName = name.replace('.stl', '')

  } else if (ext === 'obj') {
    const text = await file.text()
    const parsed = parseOBJ(text)
    vertices = parsed.vertices
    triangles = parsed.triangles
    modelName = name.replace('.obj', '')

  } else if (ext === 'json' || ext === 'asm') {
    const text = await file.text()
    const parsed = parseAssemblyJSON(text)
    vertices = parsed.vertices
    triangles = parsed.triangles
    modelName = parsed.name || name

  } else {
    throw new Error(`Unsupported format: .${ext}. Use .stl, .obj, or .json`)
  }

  // Validate
  if (!vertices || vertices.length < 9) {
    throw new Error('File contains no valid geometry. Check the file is not empty or corrupt.')
  }

  // Normalise to simulator coordinate space
  const { vertices: normVerts, scale, bbox: rawBbox } = normaliseGeometry(vertices)
  const normals = computeNormals(normVerts, triangles)
  const stats = computeStats(normVerts, triangles)

  // Scale bbox back to real units (assume metres)
  const bbox = computeBBox(normVerts)

  const model = {
    vertices: normVerts,
    normals,
    triangles: triangles || null,
    bbox,
    stats,
    name: modelName,
    format: ext.toUpperCase(),
    rawScale: scale,
  }

  const aeroFeatures = extractAeroFeatures(model)

  return { model, aeroFeatures }
}

// ── Render imported geometry on Canvas 2D ─────────────────────
export function renderImportedGeometry(ctx, model, cx, cy, scale, rx, ry, colourMode, results) {
  if (!model) return

  const { vertices, triangles, normals } = model
  const nTri = triangles ? triangles.length / 3 : vertices.length / 9

  // Collect faces with depth for painter's algorithm
  const faces = []

  for (let i = 0; i < nTri; i++) {
    let ai, bi, ci
    if (triangles) {
      ai = triangles[i * 3] * 3
      bi = triangles[i * 3 + 1] * 3
      ci = triangles[i * 3 + 2] * 3
    } else {
      ai = i * 9; bi = i * 9 + 3; ci = i * 9 + 6
    }

    const ax = vertices[ai], ay = vertices[ai+1], az = vertices[ai+2]
    const bx = vertices[bi], by = vertices[bi+1], bz = vertices[bi+2]
    const cx2 = vertices[ci], cy2 = vertices[ci+1], cz2 = vertices[ci+2]

    const avgZ = (az + bz + cz2) / 3

    // Normal for lighting
    const ex = bx-ax, ey = by-ay, ez = bz-az
    const fx = cx2-ax, fy = cy2-ay, fz = cz2-az
    const nx = ey*fz - ez*fy, ny = ez*fx - ex*fz, nz = ex*fy - ey*fx
    const nl = Math.sqrt(nx*nx + ny*ny + nz*nz) || 1

    // Diffuse lighting
    const lx = 0.577, ly = 0.577, lz = 0.577
    const diffuse = Math.max(0, (nx*lx + ny*ly + nz*lz) / nl)

    faces.push({ ax, ay, az, bx, by, bz, cx: cx2, cy: cy2, cz: cz2, avgZ, diffuse, idx: i, nTri })
  }

  // Sort back-to-front
  faces.sort((a, b) => a.avgZ - b.avgZ)

  // Project helper
  function proj(x, y, z) {
    const cY = Math.cos(ry), sY = Math.sin(ry)
    const cX = Math.cos(rx), sX = Math.sin(rx)
    let tx = x*cY - z*sY
    let tz = x*sY + z*cY
    let ty = y*cX - tz*sX
    let tz2 = y*sX + tz*cX
    const fov = 5.5
    const p = fov / (fov + tz2 * 0.28)
    return { sx: cx + tx*scale*p, sy: cy - ty*scale*p }
  }

  // Draw faces
  for (const f of faces) {
    const pa = proj(f.ax, f.ay, f.az)
    const pb = proj(f.bx, f.by, f.bz)
    const pc = proj(f.cx, f.cy, f.cz)

    // Colour by mode
    let fill
    if (colourMode === 'fea' && results?.fea) {
      const stress_norm = f.idx / f.nTri
      const r = Math.round(Math.min(255, stress_norm * 2 * 255))
      const g = Math.round(Math.min(255, (1 - Math.abs(stress_norm * 2 - 1)) * 255))
      const b = Math.round(Math.max(0, (1 - stress_norm * 2) * 255))
      const lum = 0.3 + f.diffuse * 0.7
      fill = `rgb(${Math.round(r*lum)},${Math.round(g*lum)},${Math.round(b*lum)})`
    } else if (colourMode === 'mach' && results?.mach?.isSupercritical) {
      const t = f.idx / f.nTri
      const r = Math.round((0.3 + t * 0.7) * f.diffuse * 255)
      fill = `rgb(${Math.round(r*1.5)},${Math.round(r*0.3)},${Math.round(r*0.1)})`
    } else {
      // Default: metallic blue-grey
      const lum = 0.15 + f.diffuse * 0.65
      fill = `rgb(${Math.round(30 + lum*100)},${Math.round(60 + lum*130)},${Math.round(80 + lum*160)})`
    }

    ctx.beginPath()
    ctx.moveTo(pa.sx, pa.sy)
    ctx.lineTo(pb.sx, pb.sy)
    ctx.lineTo(pc.sx, pc.sy)
    ctx.closePath()
    ctx.fillStyle = fill
    ctx.fill()
    ctx.strokeStyle = 'rgba(0,212,255,0.05)'
    ctx.lineWidth = 0.3
    ctx.stroke()
  }
}
