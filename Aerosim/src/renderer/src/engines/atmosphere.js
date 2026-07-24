/**
 * International Standard Atmosphere (ISA) Model
 * Based on ICAO Doc 7488 / ISO 2533
 */

const GAMMA = 1.4
const R = 287.058 // J/(kg·K)
const G0 = 9.80665 // m/s²
const T0 = 288.15 // K (15°C at MSL)
const P0 = 101325.0 // Pa
const RHO0 = 1.225 // kg/m³
const MU0 = 1.789e-5 // Pa·s (dynamic viscosity at MSL)
const L_TROP = 0.0065 // K/m lapse rate (troposphere)
const H_TROP = 11000.0 // m tropopause altitude
const T_STRAT = 216.65 // K isothermal stratosphere

export function ISA(alt_m) {
  let T, P, rho

  if (alt_m <= 0) {
    T = T0; P = P0; rho = RHO0
  } else if (alt_m <= H_TROP) {
    T = T0 - L_TROP * alt_m
    P = P0 * Math.pow(T / T0, G0 / (R * L_TROP))
    rho = P / (R * T)
  } else {
    // Stratosphere (isothermal up to ~20km)
    const T11 = T_STRAT
    const P11 = P0 * Math.pow(T11 / T0, G0 / (R * L_TROP))
    const dh = alt_m - H_TROP
    T = T11
    P = P11 * Math.exp(-G0 * dh / (R * T11))
    rho = P / (R * T)
  }

  const a = Math.sqrt(GAMMA * R * T) // speed of sound m/s
  // Sutherland viscosity law
  const mu = MU0 * Math.pow(T / T0, 1.5) * (T0 + 110.4) / (T + 110.4)
  const nu = mu / rho // kinematic viscosity

  return { T, P, rho, a, mu, nu }
}

export function Reynolds(rho, V, L, mu) {
  return (rho * V * L) / mu
}

export function dynamicPressure(rho, V) {
  return 0.5 * rho * V * V
}

export function TAS_from_Mach(mach, alt_m) {
  const { a } = ISA(alt_m)
  return mach * a
}

export function Mach_from_TAS(V, alt_m) {
  const { a } = ISA(alt_m)
  return V / a
}

export { GAMMA, R, G0, T0, P0, RHO0 }
