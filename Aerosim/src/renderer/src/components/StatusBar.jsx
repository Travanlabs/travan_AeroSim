import React,{useState,useEffect} from 'react'
const f1=v=>v!=null?Number(v).toFixed(1):'—'
const f2=v=>v!=null?Number(v).toFixed(2):'—'

export default function StatusBar({ results, params, simRunning }) {
  const [time,setTime]=useState('')
  useEffect(()=>{
    const t=setInterval(()=>setTime(new Date().toTimeString().slice(0,8)),1000)
    return ()=>clearInterval(t)
  },[])
  const panels=params.span_panels*params.chord_panels
  const Sep=()=><div style={{width:1,height:14,background:'var(--border-subtle)',margin:'0 10px'}}/>
  const Item=({label,val,col})=>(
    <span style={{fontSize:11,fontFamily:'var(--font-mono)',color:'var(--text-muted)'}}>
      {label}: <span style={{color:col||'var(--text-secondary)'}}>{val}</span>
    </span>
  )
  return (
    <div style={{
      height:26,flexShrink:0,
      background:'var(--bg-panel)',
      borderTop:'1px solid var(--border-subtle)',
      display:'flex',alignItems:'center',padding:'0 14px',
      gap:0,
    }}>
      <div style={{width:7,height:7,borderRadius:'50%',marginRight:8,background:simRunning?'var(--yellow)':results?'var(--green)':'var(--border-strong)',
        boxShadow:simRunning?'0 0 6px var(--yellow)':results?'0 0 6px var(--green)':'none',flexShrink:0}}/>
      <span style={{fontSize:11,fontFamily:'var(--font-mono)',color:'var(--text-secondary)'}}>
        {simRunning?'SOLVING…':results?'CONVERGED':'READY'}
      </span>
      <Sep/>
      <Item label="PANELS" val={panels}/>
      <Sep/>
      <Item label="NODES" val={(params.span_panels+1)*2}/>
      {results?.aero&&<><Sep/><Item label="CL" val={results.aero.CL.toFixed(4)} col="var(--accent-light)"/><Sep/><Item label="L/D" val={f1(results.aero.LD)} col="var(--green)"/></>}
      {results?.fea&&<><Sep/><Item label="SF" val={f2(results.fea.safetyFactor)} col={results.fea.safetyFactor<2.5?'var(--yellow)':'var(--green)'}/></>}
      {results?.mach&&<><Sep/><Item label={results.mach.isSupercritical?'⚠ SHOCK':'✓ SUB'} val={''} col={results.mach.isSupercritical?'var(--red)':'var(--green)'}/></>}
      <div style={{flex:1}}/>
      <span style={{fontSize:10,color:'var(--text-muted)',fontFamily:'var(--font-mono)'}}>
        {time} · Travan Aero Simulator v2.0 · ARAeS Edition
      </span>
    </div>
  )
}
