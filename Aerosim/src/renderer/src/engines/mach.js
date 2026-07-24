/**
 * Travan Aero Simulator — Mach & Shock Wave Solver
 * Methods: Küchemann Mcrit, Normal shock relations, Oblique shock (theta-beta-M)
 * Reference: Anderson (1990) Modern Compressible Flow
 */

const GAMMA = 1.4
const DEG = Math.PI / 180
const clamp = (v, mn, mx) => Math.max(mn, Math.min(mx, v))

// ── Critical Mach number ──────────────────────────────────────
export function computeMcrit(t_c, sweep_deg, camber = 0.02) {
  // Küchemann's formula
  const Mcc_basic = 1.0 / (1.0 + 0.6 * t_c + 0.3 * camber)
  // Sweep correction (effective Mach on normal-to-leading-edge component)
  const Mcrit = Mcc_basic * Math.cos(sweep_deg * DEG)
  return clamp(Mcrit, 0.3, 0.99)
}

// ── Normal shock relations ────────────────────────────────────
export function normalShock(M1) {
  if (M1 <= 1.0) return null
  const g = GAMMA
  const M1sq = M1 * M1

  const M2sq = (M1sq * (g - 1) / 2 + 1) / (g * M1sq - (g - 1) / 2)
  const M2 = Math.sqrt(M2sq)

  const p2_p1 = 1 + (2 * g / (g + 1)) * (M1sq - 1)
  const rho2_rho1 = ((g + 1) * M1sq) / (2 + (g - 1) * M1sq)
  const T2_T1 = p2_p1 / rho2_rho1
  const p02_p01 = Math.pow(T2_T1, g / (g - 1)) / Math.pow(p2_p1 / rho2_rho1, g / (g - 1))

  // Stagnation pressure recovery
  const p0_ratio = Math.pow(
    ((g + 1) * M1sq) / (2 + (g - 1) * M1sq),
    g / (g - 1)
  ) * Math.pow(
    (g + 1) / (2 * g * M1sq - (g - 1)),
    1 / (g - 1)
  )

  return { M1, M2, p2_p1, T2_T1, rho2_rho1, p0_ratio }
}

// ── Oblique shock angle (theta-beta-M) — iterative ───────────
export function obliqueShockAngle(M1, theta_deg) {
  const theta = theta_deg * DEG
  const g = GAMMA

  // Newton's method to solve TBM relation for beta
  let beta = theta + DEG * 10 // initial guess
  for (let i = 0; i < 50; i++) {
    const f =
      2 * (1 / Math.tan(beta)) *
      ((M1 * M1 * Math.sin(beta) ** 2 - 1) /
        (M1 * M1 * (g + Math.cos(2 * beta)) + 2)) -
      Math.tan(theta)
    const dfdb = -0.01 // finite difference step
    const f2 =
      2 * (1 / Math.tan(beta + dfdb)) *
      ((M1 * M1 * Math.sin(beta + dfdb) ** 2 - 1) /
        (M1 * M1 * (g + Math.cos(2 * (beta + dfdb))) + 2)) -
      Math.tan(theta)
    const dfdB = (f2 - f) / dfdb
    const delta = f / (dfdB + 1e-12)
    beta -= delta
    beta = clamp(beta, theta + 0.001, Math.PI / 2 - 0.001)
    if (Math.abs(delta) < 1e-6) break
  }

  const Mn1 = M1 * Math.sin(beta)
  if (Mn1 < 1.0) return null

  const shock = normalShock(Mn1)
  const M2 = shock.M2 / Math.sin(beta - theta)

  return {
    beta_deg: beta / DEG,
    theta_deg,
    M2,
    Mn1,
    ...shock,
  }
}

// ── Expansion fan (Prandtl-Meyer) ────────────────────────────
export function prandtlMeyer(M) {
  if (M < 1.0) return 0
  const g = GAMMA
  const gp1 = g + 1
  const gm1 = g - 1
  const nu =
    Math.sqrt(gp1 / gm1) *
    Math.atan(Math.sqrt((gm1 / gp1) * (M * M - 1))) -
    Math.atan(Math.sqrt(M * M - 1))
  return nu / DEG // degrees
}

// ── Transonic drag rise ───────────────────────────────────────
export function transonicDragRise(Mcrit, M, CD0_base) {
  if (M <= Mcrit) return 0
  const dM = M - Mcrit
  // Empirical drag-divergence model (Lock's formula approximation)
  const delta_CD = 20 * Math.pow(dM, 4)
  return delta_CD
}

// ── Full Mach analysis ────────────────────────────────────────
export function solveMach(params, aeroResults) {
  const { mach, airfoilKey, sweep_deg } = params
  const airfoil_tc = aeroResults.t_c || 0.12
  const airfoil_camber = aeroResults.camber || 0.02

  const Mcrit = computeMcrit(airfoil_tc, sweep_deg, airfoil_camber)
  const isSupercritical = mach > Mcrit
  const isSonic = mach >= 1.0

  let shockResult = null
  let obliqueResult = null

  if (isSupercritical) {
    // Local Mach in supersonic bubble (approx 10-15% higher than freestream)
    const M_local = mach / Mcrit * 1.12
    if (M_local > 1.0) {
      shockResult = normalShock(M_local)
      shockResult.M_local = M_local
    }
  }

  if (isSonic) {
    // Oblique shock from leading edge (simplified: 10° deflection)
    obliqueResult = obliqueShockAngle(mach, sweep_deg * 0.5)
  }

  // Drag rise
  const delta_CD_wave = transonicDragRise(Mcrit, mach, aeroResults.CD0)

  // Mach cone half-angle (supersonic)
  const mu_cone = mach >= 1.0 ? Math.asin(1 / mach) / DEG : null

  // Prandtl-Meyer expansion angle
  const nu_PM = prandtlMeyer(mach)

  // Pressure coefficient at stagnation (supersonic)
  const Cp_stag = mach >= 1.0
    ? (2 / (GAMMA * mach * mach)) * (Math.pow((GAMMA + 1) * mach * mach / 2, GAMMA / (GAMMA - 1)) *
      Math.pow((GAMMA + 1) / (2 * GAMMA * mach * mach - (GAMMA - 1)), 1 / (GAMMA - 1)) - 1)
    : (1 + (GAMMA - 1) / 2 * mach * mach) ** (GAMMA / (GAMMA - 1)) - 1

  return {
    Mcrit,
    isSupercritical,
    isSonic,
    shockResult,
    obliqueResult,
    delta_CD_wave,
    mu_cone,
    nu_PM,
    Cp_stag,
    mach,
  }
}
