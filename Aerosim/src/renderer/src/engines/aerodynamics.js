/**
 * Travan Aero Simulator — Aerodynamics Solver
 * Vortex-lattice lifting-line + Prandtl-Glauert, extended airfoil database
 */
import { ISA, dynamicPressure, Reynolds } from './atmosphere.js'

const DEG = Math.PI/180
const clamp = (v,a,b) => Math.max(a,Math.min(b,v))
const lerp   = (a,b,t) => a+(b-a)*t

// ── Extended airfoil database ─────────────────────────────────
export const AIRFOILS = {
  'NACA 0006': { camber:0,    pos:0,    t_c:0.06,  alpha_L0_deg:0,     name:'NACA 0006 — Symmetric, thin' },
  'NACA 0009': { camber:0,    pos:0,    t_c:0.09,  alpha_L0_deg:0,     name:'NACA 0009 — Symmetric tail' },
  'NACA 0012': { camber:0,    pos:0,    t_c:0.12,  alpha_L0_deg:0,     name:'NACA 0012 — Symmetric classic' },
  'NACA 0015': { camber:0,    pos:0,    t_c:0.15,  alpha_L0_deg:0,     name:'NACA 0015 — Symmetric, thick' },
  'NACA 2412': { camber:0.02, pos:0.40, t_c:0.12,  alpha_L0_deg:-2.07, name:'NACA 2412 — General aviation classic' },
  'NACA 2415': { camber:0.02, pos:0.40, t_c:0.15,  alpha_L0_deg:-2.1,  name:'NACA 2415 — Thicker 2412' },
  'NACA 4412': { camber:0.04, pos:0.40, t_c:0.12,  alpha_L0_deg:-4.15, name:'NACA 4412 — High camber general' },
  'NACA 4415': { camber:0.04, pos:0.40, t_c:0.15,  alpha_L0_deg:-4.2,  name:'NACA 4415 — High camber, thick' },
  'NACA 6412': { camber:0.06, pos:0.40, t_c:0.12,  alpha_L0_deg:-6.2,  name:'NACA 6412 — Max camber' },
  'NACA 23012':{ camber:0.02, pos:0.30, t_c:0.12,  alpha_L0_deg:-1.87, name:'NACA 23012 — Reflex, low Cm' },
  'NACA 23015':{ camber:0.02, pos:0.30, t_c:0.15,  alpha_L0_deg:-1.9,  name:'NACA 23015 — Reflex thick' },
  'NACA 64-212':{ camber:0.02,pos:0.40, t_c:0.12,  alpha_L0_deg:-2.0,  name:'NACA 64-212 — Laminar flow' },
  'NACA 64-412':{ camber:0.04,pos:0.40, t_c:0.12,  alpha_L0_deg:-3.9,  name:'NACA 64-412 — Laminar high camber' },
  'NACA 65-415':{ camber:0.04,pos:0.40, t_c:0.15,  alpha_L0_deg:-4.2,  name:'NACA 65-415 — Laminar thick' },
  'NACA 66-212':{ camber:0.02,pos:0.50, t_c:0.12,  alpha_L0_deg:-1.9,  name:'NACA 66-212 — Low drag bucket' },
  'RAE 2822':   { camber:0.02,pos:0.40, t_c:0.121, alpha_L0_deg:-1.95, name:'RAE 2822 — Supercritical, M>0.7' },
  'CLARK-Y':    { camber:0.036,pos:0.28,t_c:0.117, alpha_L0_deg:-3.8,  name:'CLARK-Y — Classic light aircraft' },
  'NACA 747A315':{ camber:0.03,pos:0.40,t_c:0.15,  alpha_L0_deg:-3.0,  name:'NACA 747A315 — High-lift' },
  'WORTMANN FX-61-147':{ camber:0.05,pos:0.38,t_c:0.147,alpha_L0_deg:-5.0, name:'Wortmann FX-61-147 — Sailplane' },
  'NACA 63A-212':{ camber:0.02,pos:0.40,t_c:0.12,  alpha_L0_deg:-2.1,  name:'NACA 63A-212 — Fighter/transport' },
  'SUPERCRITICAL SC(2)-0714':{ camber:0.02,pos:0.40,t_c:0.14,alpha_L0_deg:-1.5, name:'SC(2)-0714 — Whitcomb supercritical' },
}

export const MATERIALS = {
  'Al 7075-T6':         { E:71.7e9, rho:2810, fy:503e6,  fu:572e6,  nu:0.33, name:'Aluminium 7075-T6' },
  'Al 2024-T3':         { E:73.1e9, rho:2780, fy:345e6,  fu:483e6,  nu:0.33, name:'Aluminium 2024-T3' },
  'Al 6061-T6':         { E:68.9e9, rho:2700, fy:276e6,  fu:310e6,  nu:0.33, name:'Aluminium 6061-T6' },
  'CFRP Unidirectional':{ E:135e9,  rho:1550, fy:1500e6, fu:1800e6, nu:0.30, name:'CFRP Unidirectional' },
  'CFRP Woven':         { E:65e9,   rho:1600, fy:700e6,  fu:900e6,  nu:0.10, name:'CFRP Woven Laminate' },
  'Ti-6Al-4V':          { E:114e9,  rho:4430, fy:880e6,  fu:950e6,  nu:0.34, name:'Titanium Ti-6Al-4V' },
  'Steel 4340':         { E:200e9,  rho:7850, fy:1172e6, fu:1379e6, nu:0.29, name:'Steel 4340' },
  'GFRP Laminate':      { E:25e9,   rho:1800, fy:300e6,  fu:400e6,  nu:0.25, name:'GFRP Laminate' },
  'Al-Li 2099-T8E67':   { E:76e9,   rho:2590, fy:510e6,  fu:570e6,  nu:0.33, name:'Al-Li 2099 — Next-gen airframe' },
}

export function wingArea(span,cr,ct)     { return 0.5*(cr+ct)*span }
export function aspectRatio(span,S)      { return span*span/S }
export function taperRatio(cr,ct)        { return ct/cr }
export function meanAerodynamicChord(cr,ct) {
  const l=ct/cr; return (2/3)*cr*(1+l+l*l)/(1+l)
}

function oswaldEfficiency(AR,sweep_deg,taper) {
  const e0 = 1.78*(1-0.045*Math.pow(AR,0.68))-0.64
  return clamp(e0*Math.cos(sweep_deg*DEG*0.5)*(0.95+0.05*taper), 0.5, 0.98)
}

function pgBeta(mach) {
  return mach>=0.99 ? 0.01 : Math.sqrt(1-mach*mach)
}

function skinFriction(Re) { return 0.074/Math.pow(Math.max(Re,1e4),0.2) }

function cpDistribution(alpha_eff_rad, airfoil, N=60) {
  const cp=[]
  for(let i=0;i<=N;i++) {
    const xc=i/N
    const xc_safe=Math.max(xc,0.001)
    const cp_u=-2*alpha_eff_rad/Math.sqrt(xc_safe*(1-xc_safe))*0.45
              -airfoil.camber*Math.PI*Math.cos(Math.PI*xc)+clamp(alpha_eff_rad*0.3,-0.8,0.2)
    const cp_l=-cp_u*0.28+airfoil.camber*0.4
    cp.push({ xc, upper:clamp(cp_u,-7,1.5), lower:clamp(cp_l,-2,1.5) })
  }
  return cp
}

export function solveAerodynamics(params) {
  const { span,chord_root,chord_tip,sweep_deg,dihedral_deg,twist_deg,
    airfoilKey,mach,altitude_m,aoa_deg,fuse_length,fuse_diameter } = params

  const airfoil = AIRFOILS[airfoilKey]||AIRFOILS['NACA 2412']
  const atm  = ISA(altitude_m)
  const V    = mach*atm.a
  const q    = dynamicPressure(atm.rho,V)
  const S    = wingArea(span,chord_root,chord_tip)
  const AR   = aspectRatio(span,S)
  const taper= taperRatio(chord_root,chord_tip)
  const MAC  = meanAerodynamicChord(chord_root,chord_tip)
  const Re   = Reynolds(atm.rho,V,MAC,atm.mu)
  const beta = pgBeta(mach)
  const alpha_root= aoa_deg*DEG
  const alpha_L0  = airfoil.alpha_L0_deg*DEG
  const a0_2d     = (2*Math.PI)/beta
  const a_wing    = a0_2d/(1+(2*Math.cos(sweep_deg*DEG))/(AR*beta))
  const alpha_eff = alpha_root+0.5*(twist_deg*DEG)-alpha_L0
  const CL        = clamp(a_wing*alpha_eff,-2.2,2.8)
  const e         = oswaldEfficiency(AR,sweep_deg,taper)
  const CDi       = CL*CL/(Math.PI*AR*e)
  const Cf        = skinFriction(Re)
  const CD0_wing  = 2*Cf*(1+2*airfoil.t_c+60*Math.pow(airfoil.t_c,4))
  const ff        = fuse_length/(fuse_diameter||1.8)
  const CD0_fuse  = 0.0025+0.15/(ff*ff)
  const CD0_int   = 0.0003
  const CD0       = CD0_wing+CD0_fuse+CD0_int
  const CD        = CD0+CDi
  const CM        = -airfoil.camber*Math.PI+(-a_wing*0.25)*alpha_eff
  const LD        = CL/(CD||0.001)
  const CL_max    = 1.25+0.15*(airfoil.t_c/0.12)+0.08*airfoil.camber*50
  const alpha_stall_deg=(CL_max/a_wing+alpha_L0)/DEG
  const cpDist    = cpDistribution(alpha_eff+alpha_L0,airfoil,60)

  return {
    CL,CD,CM,LD,CDi,CD0,e,S,AR,taper,MAC,V,q,Re,beta,mach,
    CL_max,alpha_stall_deg,cpDistribution:cpDist,atm,
    dragBreakdown:{
      induced:  (CDi/CD*100).toFixed(1),
      form:     (CD0_wing/CD*100).toFixed(1),
      fuselage: (CD0_fuse/CD*100).toFixed(1),
      interference:(CD0_int/CD*100).toFixed(1),
    }
  }
}

export function computePolar(params,aoa_min,aoa_max,step=0.5) {
  const results=[]
  for(let a=aoa_min;a<=aoa_max;a+=step) {
    const r=solveAerodynamics({...params,aoa_deg:a})
    results.push({aoa:a,CL:r.CL,CD:r.CD,LD:r.LD,CM:r.CM})
  }
  return results
}
