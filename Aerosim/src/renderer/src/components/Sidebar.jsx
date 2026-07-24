import React from 'react'

const VIEWS = [
  { id:'design',  icon:'✈',  label:'Design',  tip:'Aircraft Geometry' },
  { id:'airflow', icon:'💨', label:'Aero',    tip:'Aerodynamic Solver' },
  { id:'fea',     icon:'🔬', label:'FEA',     tip:'Structural Analysis' },
  { id:'mach',    icon:'⚡', label:'Mach',    tip:'Shock & Mach Analysis' },
  { id:'weight',  icon:'⚖', label:'W&B',     tip:'Weight & Balance' },
  { id:'polar',   icon:'📈', label:'Polar',   tip:'Polar Curve Sweep' },
]

export default function Sidebar({ activeView, onViewChange, onRunSim, onReport, onManual, hasResults }) {
  return (
    <div style={{
      width:58, flexShrink:0,
      background:'var(--bg-sidebar)',
      borderRight:'1px solid var(--border-subtle)',
      display:'flex', flexDirection:'column',
      alignItems:'center', padding:'8px 0', gap:2,
    }}>
      {VIEWS.map(v=>(
        <NavItem key={v.id} {...v} active={activeView===v.id} onClick={()=>onViewChange(v.id)}/>
      ))}
      <div style={{width:34,height:1,background:'var(--border-subtle)',margin:'8px 0'}}/>
      <NavItem icon="▶" label="Run" tip="Run Full Simulation (F5)" onClick={onRunSim} accent="var(--green)"/>
      <NavItem icon="📄" label="Report" tip="Generate Report" onClick={onReport} accent={hasResults?'var(--yellow)':undefined}/>
      <div style={{flex:1}}/>
      <div style={{width:34,height:1,background:'var(--border-subtle)',margin:'4px 0'}}/>
      <NavItem icon="?" label="Help" tip="User Manual" onClick={onManual}/>
    </div>
  )
}

function NavItem({ icon, label, tip, active, onClick, accent }) {
  const [hover, setHover] = React.useState(false)
  const col = accent||(active?'var(--accent-light)':'var(--text-muted)')
  return (
    <div title={tip} onClick={onClick}
      onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)}
      style={{
        width:46, height:46,
        display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
        gap:3, borderRadius:7, cursor:'pointer',
        border:`1px solid ${active?'var(--border-accent)':'transparent'}`,
        background: active?'var(--accent-dim)': hover?'var(--bg-hover)':'transparent',
        transition:'all 0.12s',
      }}>
      <span style={{fontSize:18,lineHeight:1}}>{icon}</span>
      <span style={{fontSize:8,fontFamily:'var(--font-mono)',color:col,letterSpacing:0.3,fontWeight:active?700:400}}>
        {label}
      </span>
    </div>
  )
}
