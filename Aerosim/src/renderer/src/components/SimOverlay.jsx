import React from 'react'
export default function SimOverlay({ progress, phase, log }) {
  return (
    <div style={{
      position:'fixed',inset:0,zIndex:9000,
      background:'var(--bg-overlay)',
      display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
      gap:18, backdropFilter:'blur(6px)',
    }}>
      <div className="animate-spin" style={{
        width:56,height:56,borderRadius:'50%',
        border:'3px solid var(--border-mid)',
        borderTopColor:'var(--accent)',
        borderRightColor:'var(--violet)',
      }}/>
      <div>
        <div style={{fontFamily:'var(--font-display)',fontSize:18,fontWeight:700,color:'var(--text-primary)',textAlign:'center',letterSpacing:0.5}}>
          Travan Aero Simulator
        </div>
        <div style={{fontFamily:'var(--font-mono)',fontSize:11,color:'var(--text-muted)',textAlign:'center',marginTop:3}}>
          SIMULATION ENGINE RUNNING
        </div>
      </div>
      <div style={{fontFamily:'var(--font-mono)',fontSize:12,color:'var(--text-secondary)',textAlign:'center',minHeight:18}}>{phase}</div>
      <div style={{width:420}}>
        <div style={{height:5,background:'var(--border-mid)',borderRadius:3,overflow:'hidden'}}>
          <div style={{height:'100%',width:`${progress}%`,background:'linear-gradient(90deg,var(--violet),var(--accent))',borderRadius:3,transition:'width 0.2s ease'}}/>
        </div>
        <div style={{display:'flex',justifyContent:'space-between',marginTop:5,fontSize:10,fontFamily:'var(--font-mono)',color:'var(--text-muted)'}}>
          <span>MESH → CFD → FEA → SHOCK → POST</span>
          <span style={{color:'var(--accent-light)'}}>{progress.toFixed(0)}%</span>
        </div>
      </div>
      <div style={{width:420,maxHeight:130,overflowY:'auto',fontFamily:'var(--font-mono)',fontSize:10.5,color:'var(--text-muted)',lineHeight:1.9,background:'var(--bg-card)',borderRadius:6,padding:'8px 12px',border:'1px solid var(--border-subtle)'}}>
        {log.map((l,i)=>(
          <div key={i} style={{color:i===log.length-1?'var(--accent-light)':'var(--text-muted)'}}>{l}</div>
        ))}
      </div>
    </div>
  )
}
