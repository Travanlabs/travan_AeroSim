/**
 * Travan Aero Simulator — Structural FEA Solver
 * Model: Euler-Bernoulli beam + thin-walled box spar
 * Load: Elliptic spanwise distribution (conservative)
 * Reference: Megson (2016), Niu (1999)
 */

import { MATERIALS } from './aerodynamics.js'

const clamp = (v, mn, mx) => Math.max(mn, Math.min(mx, v))

// ── Box-spar section properties ───────────────────────────────
function boxSparProperties(chord, spar_height_mm, skin_t_mm, spar_cap_t_mm) {
  const h = spar_height_mm / 1000 // m
  const t_w = skin_t_mm / 1000 // web thickness = skin
  const t_f = spar_cap_t_mm / 1000 // cap thickness

  // Bending about horizontal axis (chordwise bending)
  // I = 2 * [cap bending + web bending]
  const b_cap = chord * 0.35 // cap width = 35% chord
  const I_caps = 2 * b_cap * t_f * Math.pow(h / 2, 2)
  const I_webs = 2 * (t_w * Math.pow(h, 3) / 12)
  const I = I_caps + I_webs

  // Area for axial stress
  const A = 2 * b_cap * t_f + 2 * h * t_w

  // Shear area (two webs)
  const A_shear = 2 * h * t_w

  // Torsional constant (closed box)
  const A_enc = h * b_cap
  const perimeter = 2 * (h + b_cap)
  const J = 4 * A_enc * A_enc / (perimeter / t_w)

  return { I, A, A_shear, J, h, b_cap, t_w, t_f }
}

// ── Elliptic load distribution ────────────────────────────────
function ellipticLoad(y, halfSpan, totalLift) {
  // w(y) = w0 * sqrt(1 - (y/s)^2)
  // Total lift = integral = w0 * pi * s / 2 => w0 = 2L/(pi*s)
  const s = halfSpan
  const w0 = (2 * totalLift) / (Math.PI * s)
  return w0 * Math.sqrt(Math.max(0, 1 - (y / s) ** 2))
}

// ── Bending moment at station y (root=0, tip=halfSpan) ────────
function bendingMoment(y, halfSpan, totalLift) {
  const s = halfSpan
  const w0 = (2 * totalLift) / (Math.PI * s)
  // M(y) = integral from y to s of (eta - y) * w(eta) deta
  // Analytical solution:
  const u = y / s
  const M =
    w0 *
    s *
    s *
    (Math.sqrt(Math.max(0, 1 - u * u)) / 2 -
      u * (Math.PI / 2 - Math.asin(u)) / 2 +
      (Math.PI / 2 - Math.asin(u)) / 2 -
      u * Math.sqrt(Math.max(0, 1 - u * u)) / 2)
  return Math.max(0, M)
}

// ── Shear force at station y ──────────────────────────────────
function shearForce(y, halfSpan, totalLift) {
  const s = halfSpan
  const w0 = (2 * totalLift) / (Math.PI * s)
  const u = y / s
  return w0 * s * (Math.PI / 2 - Math.asin(u) - u * Math.sqrt(Math.max(0, 1 - u * u))) / 2
}

// ── Deflection (numerical integration) ───────────────────────
function computeDeflection(stations, moments, EI_array) {
  const n = stations.length
  const theta = new Array(n).fill(0)
  const delta = new Array(n).fill(0)

  // Integrate curvature M/EI twice (trapezoidal rule)
  for (let i = 1; i < n; i++) {
    const dy = stations[i] - stations[i - 1]
    const kappa = (moments[i] / EI_array[i] + moments[i - 1] / EI_array[i - 1]) / 2
    theta[i] = theta[i - 1] + kappa * dy
  }
  for (let i = 1; i < n; i++) {
    const dy = stations[i] - stations[i - 1]
    delta[i] = delta[i - 1] + ((theta[i] + theta[i - 1]) / 2) * dy
  }
  return delta
}

// ── Main FEA solve ────────────────────────────────────────────
export function solveFEA(params, aeroResults) {
  const {
    span, chord_root, chord_tip, materialKey,
    skin_t_mm, spar_h_mm, spar_cap_t_mm,
    span_panels, load_factor,
  } = params

  const mat = MATERIALS[materialKey] || MATERIALS['Al 7075-T6']
  const halfSpan = span / 2
  const nMax = Math.max(load_factor || 2.5, 1.0)

  // Total lift (per half wing, factored)
  const totalLift = aeroResults.CL * aeroResults.q * aeroResults.S * nMax / 2

  const N = span_panels || 24
  const stations = []
  const moments = []
  const shears = []
  const stresses = []
  const EI_array = []
  const nodeData = []

  for (let i = 0; i <= N; i++) {
    const y = (i / N) * halfSpan
    const eta = i / N // normalised

    // Local chord (linear taper)
    const c_local = chord_root + (chord_tip - chord_root) * eta

    // Spar properties at this station (chord scales with c_local)
    const sect = boxSparProperties(c_local, spar_h_mm, skin_t_mm, spar_cap_t_mm)
    const EI = mat.E * sect.I

    const M = bendingMoment(y, halfSpan, totalLift)
    const V_shear = shearForce(y, halfSpan, totalLift)

    // Bending stress at extreme fibre
    const sigma_bend = (M * (sect.h / 2)) / (sect.I + 1e-12)

    // Shear stress in web
    const tau_shear = V_shear / (sect.A_shear + 1e-12)

    // Von Mises (plane stress)
    const sigma_vm = Math.sqrt(sigma_bend ** 2 + 3 * tau_shear ** 2)

    // Axial stress from lift (tension in lower cap, compression in upper)
    const sigma_axial = sigma_bend // bending dominates

    stations.push(y)
    moments.push(M)
    shears.push(V_shear)
    stresses.push(sigma_vm)
    EI_array.push(EI)

    nodeData.push({
      y, eta,
      M, V: V_shear,
      sigma_bend: sigma_bend / 1e6,  // MPa
      sigma_vm: sigma_vm / 1e6,       // MPa
      tau: tau_shear / 1e6,           // MPa
      I: sect.I * 1e8,                // cm⁴ × scaled
      EI,
      c_local,
    })
  }

  // Deflection field
  const deflections = computeDeflection(stations, moments, EI_array)

  // Add deflection to nodeData
  nodeData.forEach((nd, i) => {
    nd.deflection_mm = deflections[i] * 1000
  })

  const maxStress_MPa = Math.max(...stresses) / 1e6
  const maxDefl_mm = deflections[N] * 1000
  const rootMoment_kNm = moments[0] / 1000

  const safetyFactor = (mat.fy / 1e6) / (maxStress_MPa + 1e-6)

  // Flutter speed (empirical — Bisplinghoff)
  const EI_root = EI_array[0]
  const GJ_root = mat.E / (2 * (1 + mat.nu)) * nodeData[0].I * 1e-8 * 1.2
  const V_flutter = 1.8 * Math.sqrt(EI_root / (mat.rho * halfSpan ** 4)) * halfSpan

  // Structural mass estimate
  const structural_mass = mat.rho * (chord_root * 0.35 * skin_t_mm / 1000 * span * 2 +
    (spar_h_mm / 1000) * (skin_t_mm / 1000) * span * 4)

  return {
    nodes: nodeData,
    maxStress_MPa,
    maxDefl_mm,
    rootMoment_kNm,
    safetyFactor,
    V_flutter,
    structural_mass_kg: structural_mass,
    material: mat,
    load_factor: nMax,
    totalLift_kN: totalLift / 1000,
  }
}
