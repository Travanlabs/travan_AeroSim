import React from 'react'
const f = (v,d=3) => v!=null ? Number(v).toFixed(d) : '—'

export default function TitleBar({ results, params, theme, onToggleTheme }) {
  const isElectron = !!window.electronAPI
  const aero = results?.aero
  const fea  = results?.fea
  const mach = results?.mach

  const Chip = ({ label, value, accent }) => (
    <div style={{
      display:'flex', alignItems:'center', gap:5,
      padding:'4px 11px', borderRadius:6,
      background:`${accent}14`,
      border:`1px solid ${accent}44`,
    }}>
      <span style={{fontSize:10,color:'var(--text-muted)',fontFamily:'var(--font-mono)',letterSpacing:0.8}}>{label}</span>
      <span style={{fontSize:12,color:accent,fontFamily:'var(--font-mono)',fontWeight:600}}>{value}</span>
    </div>
  )

  return (
    <div style={{
      height:46, flexShrink:0,
      background:'var(--bg-panel)',
      borderBottom:'1px solid var(--border-subtle)',
      display:'flex', alignItems:'center', padding:'0 14px', gap:12,
      WebkitAppRegion: isElectron ? 'drag' : 'no-drag',
      boxShadow:'var(--shadow-sm)',
    }}>
      {/* Logo */}
      <div style={{display:'flex',alignItems:'center',gap:10,marginRight:8}} title="Travan Aero Simulator v2.0">
        <svg width="28" height="28" viewBox="0 0 28 28">
          <polygon points="14,2 26,9 26,19 14,26 2,19 2,9" fill="none" stroke="var(--accent)" strokeWidth="1.5"/>
          <polygon points="14,2 26,9 26,19 14,26 2,19 2,9" fill="var(--accent-dim)"/>
          {/* Wing silhouette */}
          <path d="M7 14 L21 14 L20 11 L14 13 L8 11 Z" fill="var(--accent)" opacity="0.9"/>
        </svg>
        <div>
          <div style={{fontSize:13,fontFamily:'var(--font-display)',fontWeight:700,color:'var(--text-primary)',letterSpacing:0.5}}>
            Travan Aero Simulator
          </div>
          <div style={{fontSize:10,color:'var(--text-muted)',fontFamily:'var(--font-mono)',letterSpacing:0.5}}>
            v2.0 · ARAeS Edition
          </div>
        </div>
      </div>

      {/* Live coefficient chips */}
      <div style={{display:'flex',gap:6,alignItems:'center',WebkitAppRegion:'no-drag'}}>
        {aero ? (<>
          <Chip label="CL" value={f(aero.CL,4)} accent="var(--accent-light)"/>
          <Chip label="CD" value={f(aero.CD,5)} accent="var(--orange)"/>
          <Chip label="L/D" value={f(aero.LD,1)} accent="var(--green)"/>
          {mach && <Chip label={mach.isSupercritical?'⚠ SHOCK':'✓ SUB'} value={`M${f(params.mach,2)}`} accent={mach.isSupercritical?'var(--red)':'var(--teal)'}/>}
          {fea && <Chip label="SF" value={f(fea.safetyFactor,2)} accent={fea.safetyFactor<2.5?'var(--yellow)':'var(--green)'}/>}
        </>) : (
          <span style={{fontSize:12,color:'var(--text-muted)',fontFamily:'var(--font-mono)'}}>No simulation results — press F5 to run</span>
        )}
      </div>

      <div style={{flex:1}}/>

      {/* Theme toggle */}
      <button onClick={onToggleTheme} className="btn-icon"
        style={{WebkitAppRegion:'no-drag',fontSize:16}}
        title={`Switch to ${theme==='dark'?'light':'dark'} mode`}>
        {theme==='dark' ? '☀' : '🌙'}
      </button>

      <div style={{
        width:3, height:26, borderRadius:2,
        background:'linear-gradient(180deg,var(--accent),var(--violet))',
        opacity:0.8,
      }}/>
    </div>
  )
}
