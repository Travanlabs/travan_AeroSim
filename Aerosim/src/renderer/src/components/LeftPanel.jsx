import React, { useState, useRef } from 'react'
import { AIRFOILS, MATERIALS } from '../engines/aerodynamics.js'
import { DEFAULT_PARAMS } from '../App.jsx'

// Symmetric airfoils suitable for stabiliser surfaces
const SYMMETRIC_AIRFOILS = [
  { v: 'NACA 0006', l: 'NACA 0006 — 6% thin' },
  { v: 'NACA 0008', l: 'NACA 0008 — 8%' },
  { v: 'NACA 0009', l: 'NACA 0009 — 9% (V-tail)' },
  { v: 'NACA 0010', l: 'NACA 0010 — 10%' },
  { v: 'NACA 0012', l: 'NACA 0012 — 12% standard' },
  { v: 'NACA 0015', l: 'NACA 0015 — 15% thick' },
  { v: 'NACA 0018', l: 'NACA 0018 — 18% thick' },
  { v: 'NACA 2412', l: 'NACA 2412 — 2% camber' },
  { v: 'NACA 64A010', l: 'NACA 64A010 — supercritical' },
]

const f1 = v => v!=null ? Number(v).toFixed(1) : '—'
const f2 = v => v!=null ? Number(v).toFixed(2) : '—'
const f3 = v => v!=null ? Number(v).toFixed(3) : '—'

// ── Design tokens ─────────────────────────────────────────────
const S = {
  section: { marginBottom:10, border:'1px solid var(--border-subtle)', borderRadius:7, overflow:'hidden', background:'var(--bg-panel)' },
  sectionHead: { padding:'8px 12px', background:'var(--bg-card)', borderBottom:'1px solid var(--border-subtle)',
    fontFamily:'var(--font-ui)', fontSize:11, fontWeight:600, color:'var(--text-secondary)',
    letterSpacing:0.5, cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center', userSelect:'none' },
  sectionBody: { padding:'10px 12px' },
  row: { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 },
  label: { fontSize:12, color:'var(--text-secondary)', flex:1, fontWeight:400 },
  unit: { fontSize:10, color:'var(--text-muted)', marginLeft:3 },
  numInput: (w=86) => ({
    width:w, padding:'5px 8px', borderRadius:4, fontSize:12,
    textAlign:'right', fontFamily:'var(--font-mono)',
    background:'var(--bg-input)', border:'1px solid var(--border-mid)', color:'var(--text-primary)',
  }),
  select: (w=140) => ({
    width:w, padding:'5px 7px', borderRadius:4, fontSize:11,
    background:'var(--bg-input)', border:'1px solid var(--border-mid)', color:'var(--text-primary)',
  }),
  statRow: { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:5 },
  statLabel: { fontSize:11, color:'var(--text-muted)' },
  statVal: (c='var(--accent-light)') => ({ fontSize:13, color:c, fontFamily:'var(--font-mono)', fontWeight:600 }),
}

// ── Collapsible section ───────────────────────────────────────
function Sec({ title, children, defaultOpen=true }) {
  const [open,setOpen]=useState(defaultOpen)
  return (
    <div style={S.section}>
      <div style={S.sectionHead} onClick={()=>setOpen(o=>!o)}>
        <span>{title}</span>
        <span style={{fontSize:10,color:'var(--text-muted)'}}>{open?'▲':'▼'}</span>
      </div>
      {open && <div style={S.sectionBody}>{children}</div>}
    </div>
  )
}

function Row({ label, unit, children }) {
  return (
    <div style={S.row}>
      <span style={S.label}>{label}{unit&&<span style={S.unit}>{unit}</span>}</span>
      {children}
    </div>
  )
}

function NumIn({ value, onChange, step=0.1, min, max, width=86 }) {
  return <input type="number" value={value} step={step} min={min} max={max}
    onChange={e=>onChange(+e.target.value)} style={S.numInput(width)}/>
}

function Rng({ label, unit, value, onChange, min, max, step=1, color='var(--accent)' }) {
  const pct = ((value-min)/(max-min))*100
  return (
    <div style={{marginBottom:11}}>
      <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
        <span style={{fontSize:12,color:'var(--text-secondary)'}}>{label}{unit&&<span style={S.unit}>{unit}</span>}</span>
        <span style={{fontSize:12,color:color,fontFamily:'var(--font-mono)',fontWeight:600}}>
          {Number.isInteger(step)?value:value.toFixed(2)}
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e=>onChange(+e.target.value)}
        style={{background:`linear-gradient(90deg,${color} ${pct}%,var(--border-mid) ${pct}%)`}}/>
    </div>
  )
}

function Sel({ value, onChange, options, width=140 }) {
  return (
    <select value={value} onChange={e=>onChange(e.target.value)} style={S.select(width)}>
      {options.map(o=><option key={o.v||o} value={o.v||o}>{o.l||o}</option>)}
    </select>
  )
}

function Btn({ label, onClick, variant='primary', full=true, icon, disabled, style={} }) {
  const variants = {
    primary: { bg:'var(--accent)', color:'#fff', border:'none' },
    ghost:   { bg:'transparent',  color:'var(--text-secondary)', border:'1px solid var(--border-mid)' },
    danger:  { bg:'var(--red)',    color:'#fff', border:'none' },
    success: { bg:'var(--green)',  color:'#fff', border:'none' },
    warning: { bg:'var(--yellow)', color:'#000', border:'none' },
  }
  const v = variants[variant]||variants.primary
  return (
    <button disabled={disabled} onClick={onClick}
      style={{
        width:full?'100%':'auto', padding:'8px 14px', marginBottom:5,
        background:v.bg, color:v.color, border:v.border,
        borderRadius:5, fontSize:12, fontWeight:600,
        display:'flex', alignItems:'center', justifyContent:'center', gap:6,
        opacity:disabled?0.4:1, cursor:disabled?'not-allowed':'pointer',
        transition:'all 0.12s',
        ...style,
      }}
      onMouseEnter={e=>{if(!disabled)e.currentTarget.style.filter='brightness(1.1)'}}
      onMouseLeave={e=>{e.currentTarget.style.filter='none'}}
    >
      {icon&&<span>{icon}</span>}{label}
    </button>
  )
}

function StatRow({ label, value, unit, color='var(--accent-light)' }) {
  return (
    <div style={S.statRow}>
      <span style={S.statLabel}>{label}</span>
      <span style={S.statVal(color)}>{value}{unit&&<span style={{fontSize:9,color:'var(--text-muted)',marginLeft:2}}>{unit}</span>}</span>
    </div>
  )
}

// ── Module: Design ────────────────────────────────────────────
function DesignModule({ params, setParam, onRunSim, onSave, onReset, onImport, importedModel, fileRef }) {
  return (<>
    {/* Import banner */}
    {importedModel && (
      <div style={{marginBottom:8,padding:'8px 10px',borderRadius:5,
        background:'var(--yellow-dim)',border:'1px solid rgba(234,179,8,0.3)'}}>
        <div style={{fontSize:12,color:'var(--yellow)',fontWeight:600}}>📎 {importedModel.name}</div>
        <div style={{fontSize:10,color:'var(--text-muted)',marginTop:2}}>
          {importedModel.format} · {importedModel.stats.triCount.toLocaleString()} triangles
        </div>
      </div>
    )}
    <Btn label="📎 Import STL / OBJ / Assembly" onClick={()=>fileRef.current?.click()} variant="ghost"/>

    <Sec title="Wing Planform">
      <Rng label="Span" unit="m" value={params.span} onChange={v=>setParam('span',v)} min={2} max={80} step={0.5}/>
      <Row label="Root Chord" unit="m"><NumIn value={params.chord_root} onChange={v=>setParam('chord_root',v)} step={0.1} min={0.2} max={15}/></Row>
      <Row label="Tip Chord" unit="m"><NumIn value={params.chord_tip} onChange={v=>setParam('chord_tip',v)} step={0.1} min={0.1} max={10}/></Row>
      <Rng label="Sweep Λ" unit="°" value={params.sweep_deg} onChange={v=>setParam('sweep_deg',v)} min={0} max={70} color="var(--yellow)"/>
      <Rng label="Dihedral Γ" unit="°" value={params.dihedral_deg} onChange={v=>setParam('dihedral_deg',v)} min={-10} max={15} step={0.5} color="var(--teal)"/>
      <Rng label="Washout ε" unit="°" value={params.twist_deg} onChange={v=>setParam('twist_deg',v)} min={-8} max={4} step={0.5} color="var(--violet)"/>
      <Row label="Airfoil Profile">
        <Sel value={params.airfoilKey} onChange={v=>setParam('airfoilKey',v)}
          options={Object.entries(AIRFOILS).map(([k,v])=>({v:k,l:k}))}/>
      </Row>
      {AIRFOILS[params.airfoilKey]&&(
        <div style={{fontSize:10,color:'var(--text-muted)',marginTop:2,fontStyle:'italic'}}>
          {AIRFOILS[params.airfoilKey].name}
        </div>
      )}
    </Sec>

    <Sec title="Fuselage">
      <Rng label="Length" unit="m" value={params.fuse_length} onChange={v=>setParam('fuse_length',v)} min={3} max={90} step={0.5}/>
      <Row label="Diameter" unit="m"><NumIn value={params.fuse_diameter} onChange={v=>setParam('fuse_diameter',v)} step={0.1} min={0.3} max={12}/></Row>
      <Rng label="Nose Length" unit="m" value={params.fuse_nose_length||5} onChange={v=>setParam('fuse_nose_length',v)} min={1} max={15} step={0.5} color="var(--orange)"/>
      <Rng label="Tail Taper" value={params.fuse_tail_taper||0.25} onChange={v=>setParam('fuse_tail_taper',v)} min={0.05} max={0.9} step={0.05} color="var(--orange)"/>
    </Sec>

    <Sec title="Wing Position">
      <div style={{fontSize:10,color:'var(--text-muted)',marginBottom:8,lineHeight:1.5}}>
        Distance from nose tip to wing root leading edge. Fuselage extends forward and aft from the wing.
      </div>
      <Rng label="Wing LE from Nose" unit="m"
        value={params.wing_le_x ?? (params.fuse_length*0.35)}
        onChange={v=>setParam('wing_le_x', v)}
        min={params.fuse_nose_length ?? 2}
        max={(params.fuse_length ?? 63) * 0.75}
        step={0.5}
        color="var(--accent)"/>
      <div style={{fontSize:10,color:'var(--text-muted)',marginTop:-4}}>
        {`${(((params.wing_le_x ?? params.fuse_length*0.35) / (params.fuse_length||63))*100).toFixed(1)} % of fuselage length`}
      </div>
    </Sec>

    <Sec title="Empennage — H-Tail">
      <Rng label="H-Tail Span" unit="m" value={params.htail_span||12} onChange={v=>setParam('htail_span',v)} min={1} max={30} step={0.5}/>
      <Row label="Root Chord" unit="m"><NumIn value={params.htail_chord_root||3} onChange={v=>setParam('htail_chord_root',v)} step={0.1} min={0.2} max={8}/></Row>
      <Row label="Tip Chord" unit="m"><NumIn value={params.htail_chord_tip||1.2} onChange={v=>setParam('htail_chord_tip',v)} step={0.1} min={0.1} max={5}/></Row>
      <Rng label="Sweep" unit="°" value={params.htail_sweep||35} onChange={v=>setParam('htail_sweep',v)} min={0} max={60} color="var(--yellow)"/>
      <Rng label="Dihedral" unit="°" value={params.htail_dihedral||3} onChange={v=>setParam('htail_dihedral',v)} min={-5} max={12} step={0.5} color="var(--teal)"/>
      <Row label="Airfoil Profile">
        <Sel value={params.htail_airfoilKey||'NACA 0012'} onChange={v=>setParam('htail_airfoilKey',v)}
          options={SYMMETRIC_AIRFOILS} width={130}/>
      </Row>
    </Sec>

    <Sec title="Empennage — V-Tail">
      <Rng label="Height" unit="m" value={params.vtail_height||6} onChange={v=>setParam('vtail_height',v)} min={1} max={15} step={0.25}/>
      <Row label="Root Chord" unit="m"><NumIn value={params.vtail_chord_root||4} onChange={v=>setParam('vtail_chord_root',v)} step={0.1} min={0.5} max={12}/></Row>
      <Row label="Tip Chord" unit="m"><NumIn value={params.vtail_chord_tip||1.5} onChange={v=>setParam('vtail_chord_tip',v)} step={0.1} min={0.2} max={6}/></Row>
      <Rng label="Sweep" unit="°" value={params.vtail_sweep||40} onChange={v=>setParam('vtail_sweep',v)} min={10} max={65} color="var(--yellow)"/>
      <Row label="Airfoil Profile">
        <Sel value={params.vtail_airfoilKey||'NACA 0009'} onChange={v=>setParam('vtail_airfoilKey',v)}
          options={SYMMETRIC_AIRFOILS} width={130}/>
      </Row>
    </Sec>

    <Sec title="Engines / Nacelles" defaultOpen={false}>
      <Row label="Engine Count">
        <Sel value={params.engine_count??2} onChange={v=>setParam('engine_count',+v)}
          options={[{v:0,l:'None'},{v:2,l:'2 Engines'},{v:4,l:'4 Engines'}]} width={110}/>
      </Row>
      <Row label="Nacelle Length" unit="m"><NumIn value={params.nacelle_length||4} onChange={v=>setParam('nacelle_length',v)} step={0.1} min={0.5} max={10}/></Row>
      <Row label="Nacelle Diameter" unit="m"><NumIn value={params.nacelle_diameter||1.5} onChange={v=>setParam('nacelle_diameter',v)} step={0.1} min={0.3} max={4}/></Row>
      <Rng label="Span Position" value={params.nacelle_span_pos||0.33} onChange={v=>setParam('nacelle_span_pos',v)} min={0.1} max={0.7} step={0.01} color="var(--orange)"/>
    </Sec>

    <Sec title="Mesh Density" defaultOpen={false}>
      <Rng label="Spanwise Panels" value={params.span_panels||20} onChange={v=>setParam('span_panels',v)} min={8} max={48} step={2}/>
      <Rng label="Chordwise Panels" value={params.chord_panels||16} onChange={v=>setParam('chord_panels',v)} min={6} max={28} step={2}/>
    </Sec>

    <div style={{height:6}}/>
    <Btn label="▶ Run Simulation" onClick={onRunSim} variant="primary" icon=""/>
    <Btn label="💾 Save Design" onClick={onSave} variant="ghost"/>
    <Btn label="↺ Reset to Defaults" onClick={onReset} variant="ghost"/>
  </>)
}

// ── Module: Airflow ───────────────────────────────────────────
function AirflowModule({ params, setParam, onRunSim }) {
  return (<>
    <Sec title="Flight Conditions">
      <Rng label="Mach Number" value={params.mach} onChange={v=>setParam('mach',v)} min={0.05} max={3.0} step={0.01} color="var(--violet)"/>
      <Rng label="Angle of Attack" unit="°" value={params.aoa_deg} onChange={v=>setParam('aoa_deg',v)} min={-12} max={22} step={0.5} color="var(--yellow)"/>
      <Row label="Altitude" unit="m"><NumIn value={params.altitude_m} onChange={v=>setParam('altitude_m',v)} step={500} min={0} max={40000} width={96}/></Row>
    </Sec>
    <Sec title="Solver Settings" defaultOpen={false}>
      <Row label="Viscous Model">
        <Sel value="Turbulent BL" onChange={()=>{}} options={['Turbulent BL','Transition','Inviscid']} width={130}/>
      </Row>
      <Row label="Wake Model">
        <Sel value="Free Wake" onChange={()=>{}} options={['Free Wake','Fixed Wake']} width={130}/>
      </Row>
    </Sec>
    <Btn label="▶ Solve Aerodynamics" onClick={onRunSim} variant="primary"/>
  </>)
}

// ── Module: FEA ───────────────────────────────────────────────
function FEAModule({ params, setParam, results, onRunSim }) {
  const mat = MATERIALS[params.materialKey]
  const feaR = results?.fea
  return (<>
    <Sec title="Material Selection">
      <Row label="Material">
        <Sel value={params.materialKey} onChange={v=>setParam('materialKey',v)}
          options={Object.keys(MATERIALS)} width={155}/>
      </Row>
      {mat&&<>
        <StatRow label="Young's Modulus E" value={(mat.E/1e9).toFixed(1)} unit="GPa"/>
        <StatRow label="Yield Strength σy" value={(mat.fy/1e6).toFixed(0)} unit="MPa" color="var(--yellow)"/>
        <StatRow label="Density ρ" value={mat.rho} unit="kg/m³" color="var(--text-muted)"/>
        <StatRow label="Poisson ν" value={mat.nu} color="var(--text-muted)"/>
      </>}
    </Sec>
    <Sec title="Structural Sizing">
      <Row label="Skin Thickness" unit="mm"><NumIn value={params.skin_t_mm} onChange={v=>setParam('skin_t_mm',v)} step={0.5} min={0.5} max={25}/></Row>
      <Row label="Spar Height" unit="mm"><NumIn value={params.spar_h_mm} onChange={v=>setParam('spar_h_mm',v)} step={5} min={20} max={1200}/></Row>
      <Row label="Cap Thickness" unit="mm"><NumIn value={params.spar_cap_t_mm} onChange={v=>setParam('spar_cap_t_mm',v)} step={0.5} min={1} max={40}/></Row>
      <Rng label="Load Factor n" unit="g" value={params.load_factor} onChange={v=>setParam('load_factor',v)} min={1} max={9} step={0.25} color="var(--red)"/>
    </Sec>
    {feaR&&(
      <Sec title="FEA Results">
        <StatRow label="Max Von Mises σ" value={f1(feaR.maxStress_MPa)} unit="MPa"
          color={feaR.maxStress_MPa>(mat?.fy/1e6*0.8)?'var(--red)':'var(--green)'}/>
        <StatRow label="Tip Deflection" value={f1(feaR.maxDefl_mm)} unit="mm" color="var(--yellow)"/>
        <StatRow label="Root Moment" value={f1(feaR.rootMoment_kNm)} unit="kNm"/>
        <StatRow label="Safety Factor SF" value={f2(feaR.safetyFactor)}
          color={feaR.safetyFactor<1.5?'var(--red)':feaR.safetyFactor<2.5?'var(--yellow)':'var(--green)'}/>
        <StatRow label="Flutter Speed" value={f1(feaR.V_flutter)} unit="m/s" color="var(--violet)"/>
        <StatRow label="Structural Mass" value={feaR.structural_mass_kg?.toFixed(0)} unit="kg" color="var(--text-muted)"/>
      </Sec>
    )}
    <Btn label="▶ Run FEA" onClick={onRunSim} variant="primary"/>
  </>)
}

// ── Module: Mach ──────────────────────────────────────────────
function MachModule({ params, setParam, results, onRunSim }) {
  const machR = results?.mach
  return (<>
    <Sec title="Mach Conditions">
      <Rng label="Mach Number" value={params.mach} onChange={v=>setParam('mach',v)} min={0.1} max={3.5} step={0.02} color="var(--violet)"/>
    </Sec>
    {machR&&(<>
      <Sec title="Critical Mach">
        <StatRow label="Mcrit" value={f3(machR.Mcrit)} color={machR.isSupercritical?'var(--red)':'var(--green)'}/>
        <StatRow label="Status" value={machR.isSupercritical?'SUPERCRITICAL':'SUBCRITICAL'} color={machR.isSupercritical?'var(--red)':'var(--green)'}/>
        <StatRow label="Wave drag ΔCD" value={(machR.delta_CD_wave*1e4).toFixed(2)} unit="×10⁻⁴" color="var(--orange)"/>
        <StatRow label="P-G β" value={f3(results?.aero?.beta)} color="var(--text-muted)"/>
      </Sec>
      {machR.shockResult&&(
        <Sec title="Normal Shock Relations">
          <StatRow label="M₁ local" value={f3(machR.shockResult.M_local)} color="var(--red)"/>
          <StatRow label="M₂ post-shock" value={f3(machR.shockResult.M2)} color="var(--yellow)"/>
          <StatRow label="p₂/p₁" value={f3(machR.shockResult.p2_p1)}/>
          <StatRow label="T₂/T₁" value={f3(machR.shockResult.T2_T1)} color="var(--orange)"/>
          <StatRow label="ρ₂/ρ₁" value={f3(machR.shockResult.rho2_rho1)} color="var(--teal)"/>
          <StatRow label="p₀ recovery" value={(machR.shockResult.p0_ratio*100).toFixed(1)} unit="%" color="var(--violet)"/>
        </Sec>
      )}
      {machR.mu_cone!=null&&(
        <Sec title="Supersonic">
          <StatRow label="Mach cone μ" value={f1(machR.mu_cone)} unit="°" color="var(--violet)"/>
          <StatRow label="P-M angle ν" value={f1(machR.nu_PM)} unit="°"/>
        </Sec>
      )}
    </>)}
    <Btn label="⚡ Shock Analysis" onClick={onRunSim} variant="primary"/>
  </>)
}

// ── Module: W&B ───────────────────────────────────────────────
function WeightModule({ params, setParam, results }) {
  const S  = results?.aero?.S || (0.5*(params.chord_root+params.chord_tip)*params.span)
  const AR = results?.aero?.AR|| (params.span**2/S)
  const WL = (params.mtow_kg*9.81)/S
  const OEW= params.mtow_kg - params.fuel_kg - params.payload_kg
  const fuel_frac= (params.fuel_kg/params.mtow_kg*100).toFixed(1)

  // CG in metres from nose
  const cg_frac = params.cg_x_frac ?? 0.38
  const cg_m    = (cg_frac * (params.fuse_length ?? 63)).toFixed(2)
  // MAC position for reference
  const wing_le = params.wing_le_x ?? (params.fuse_length * 0.35)
  const mac     = 0.5*(params.chord_root + params.chord_tip)
  const cg_mac_pct = (((cg_frac * (params.fuse_length??63)) - wing_le) / mac * 100).toFixed(1)

  return (<>
    <Sec title="Mass Budget">
      <Row label="MTOW" unit="kg"><NumIn value={params.mtow_kg} onChange={v=>setParam('mtow_kg',v)} step={100} min={10} max={600000} width={100}/></Row>
      <Row label="Fuel Mass" unit="kg"><NumIn value={params.fuel_kg} onChange={v=>setParam('fuel_kg',v)} step={50} min={0} max={300000} width={100}/></Row>
      <Row label="Payload" unit="kg"><NumIn value={params.payload_kg} onChange={v=>setParam('payload_kg',v)} step={50} min={0} max={100000} width={100}/></Row>
    </Sec>
    <Sec title="Centre of Gravity">
      <div style={{fontSize:10,color:'var(--text-muted)',marginBottom:8,lineHeight:1.5}}>
        Drag the CG marker along the fuselage. The magenta diamond ◆ is shown in all 3D views.
      </div>
      <Rng label="CG Position" unit="× L"
        value={cg_frac}
        onChange={v=>setParam('cg_x_frac', v)}
        min={0.05} max={0.95} step={0.005}
        color="rgb(255,50,220)"/>
      <StatRow label="CG from nose" value={cg_m} unit="m" color="rgb(255,50,220)"/>
      <StatRow label="CG on MAC" value={`${cg_mac_pct}%`}
        color={Math.abs(+cg_mac_pct-25)<15 ? 'var(--green)' : 'var(--red)'}/>
      <div style={{
        marginTop:6, padding:'6px 8px', borderRadius:4,
        background: Math.abs(+cg_mac_pct-25)<15 ? 'var(--green-dim)' : 'var(--red-dim)',
        border:`1px solid ${Math.abs(+cg_mac_pct-25)<15 ? 'var(--green)' : 'var(--red)'}`,
        fontSize:10, color: Math.abs(+cg_mac_pct-25)<15 ? 'var(--green)' : 'var(--red)',
        fontWeight:600,
      }}>
        {Math.abs(+cg_mac_pct-25)<15 ? '✓ CG within normal envelope (15–35% MAC)' : '⚠ CG outside normal flight envelope'}
      </div>
    </Sec>
    <Sec title="Computed Metrics">
      <StatRow label="OEW" value={OEW.toFixed(0)} unit="kg"/>
      <StatRow label="Wing Area S" value={S.toFixed(2)} unit="m²" color="var(--yellow)"/>
      <StatRow label="Aspect Ratio AR" value={AR.toFixed(2)} color="var(--green)"/>
      <StatRow label="Wing Loading" value={WL.toFixed(0)} unit="N/m²" color="var(--orange)"/>
      <StatRow label="Fuel Fraction" value={fuel_frac} unit="%" color="var(--violet)"/>
      <StatRow label="Load/Area" value={(params.mtow_kg/S).toFixed(1)} unit="kg/m²" color="var(--text-muted)"/>
    </Sec>
  </>)
}

// ── Module: Polar ─────────────────────────────────────────────
function PolarModule({ params, onRunPolar, polarData }) {
  const [aMin,setAMin]=useState(-4)
  const [aMax,setAMax]=useState(18)
  const best = polarData?.reduce((b,p)=>p.LD>b.LD?p:b, polarData[0])
  const CLmax= polarData?.reduce((b,p)=>p.CL>b.CL?p:b, polarData[0])
  return (<>
    <Sec title="Sweep Range">
      <Row label="AoA Min" unit="°"><NumIn value={aMin} onChange={setAMin} step={1} min={-15} max={0} width={70}/></Row>
      <Row label="AoA Max" unit="°"><NumIn value={aMax} onChange={setAMax} step={1} min={5} max={30} width={70}/></Row>
    </Sec>
    <Btn label="📈 Compute Polar" onClick={()=>onRunPolar(aMin,aMax)} variant="primary"/>
    {polarData&&(
      <Sec title="Results">
        <StatRow label="Best L/D" value={f1(best?.LD)} color="var(--green)"/>
        <StatRow label="@ AoA" value={`${best?.aoa}°`} color="var(--green)"/>
        <StatRow label="CL_max" value={f2(CLmax?.CL)} color="var(--accent-light)"/>
        <StatRow label="@ AoA (stall)" value={`${CLmax?.aoa}°`} color="var(--yellow)"/>
        <div style={{marginTop:8,maxHeight:180,overflowY:'auto',fontFamily:'var(--font-mono)',fontSize:10,color:'var(--text-muted)',lineHeight:1.9}}>
          {polarData.filter((_,i)=>i%2===0).map(p=>(
            <div key={p.aoa} style={{display:'flex',gap:8}}>
              <span style={{width:28,color:'var(--text-secondary)'}}>{p.aoa}°</span>
              <span style={{width:50,color:'var(--accent-light)'}}>CL={p.CL.toFixed(3)}</span>
              <span style={{width:60,color:'var(--orange)'}}>CD={p.CD.toFixed(5)}</span>
              <span style={{color:'var(--green)'}}>L/D={p.LD.toFixed(1)}</span>
            </div>
          ))}
        </div>
      </Sec>
    )}
  </>)
}

// ── Main LeftPanel ────────────────────────────────────────────
const TITLES = {
  design:  ['Aircraft Geometry',     'Wing, fuselage & empennage'],
  airflow: ['Aerodynamic Solver',    'CFD panel method'],
  fea:     ['Structural Analysis',   'FEA — stress & deflection'],
  mach:    ['Mach / Shock Analysis', 'Compressibility & shock waves'],
  weight:  ['Weight & Balance',      'Mass budget & wing loading'],
  polar:   ['Polar Curve Sweep',     'CL-CD-α envelope'],
}

export default function LeftPanel({ activeView, params, setParam, results, onRunSim, onRunPolar, onSave, onReset, onImport, polarData, importedModel }) {
  const [title, sub] = TITLES[activeView]||['Parameters','']
  const fileRef = useRef(null)

  return (
    <div style={{
      width:282, flexShrink:0,
      background:'var(--bg-panel)',
      borderRight:'1px solid var(--border-subtle)',
      display:'flex', flexDirection:'column', overflow:'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding:'12px 14px', flexShrink:0,
        borderBottom:'1px solid var(--border-subtle)',
      }}>
        <div style={{fontSize:14,fontFamily:'var(--font-display)',fontWeight:700,color:'var(--text-primary)'}}>{title}</div>
        <div style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}>{sub}</div>
      </div>

      {/* Hidden file input */}
      <input ref={fileRef} type="file" accept=".stl,.obj,.json,.asm"
        style={{display:'none'}} onChange={e=>{const f=e.target.files?.[0];if(f)onImport?.(f);e.target.value='';}}/>

      {/* Scrollable content */}
      <div style={{flex:1,overflowY:'auto',padding:10}}>
        {activeView==='design' && <DesignModule params={params} setParam={setParam} onRunSim={onRunSim} onSave={onSave} onReset={onReset} onImport={onImport} importedModel={importedModel} fileRef={fileRef}/>}
        {activeView==='airflow'&& <AirflowModule params={params} setParam={setParam} onRunSim={onRunSim}/>}
        {activeView==='fea'    && <FEAModule params={params} setParam={setParam} results={results} onRunSim={onRunSim}/>}
        {activeView==='mach'   && <MachModule params={params} setParam={setParam} results={results} onRunSim={onRunSim}/>}
        {activeView==='weight' && <WeightModule params={params} setParam={setParam} results={results}/>}
        {activeView==='polar'  && <PolarModule params={params} onRunPolar={onRunPolar} polarData={polarData}/>}
      </div>
    </div>
  )
}
