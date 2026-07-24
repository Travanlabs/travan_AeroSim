import React,{useRef,useEffect,useState} from 'react'

const f1=v=>v!=null?Number(v).toFixed(1):'—'
const f2=v=>v!=null?Number(v).toFixed(2):'—'
const f3=v=>v!=null?Number(v).toFixed(3):'—'
const f4=v=>v!=null?Number(v).toFixed(4):'—'
const f5=v=>v!=null?Number(v).toFixed(5):'—'

function Card({title,children}){return(
  <div style={{background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:7,padding:'10px 12px',marginBottom:8}}>
    <div style={{fontSize:10,color:'var(--text-muted)',letterSpacing:0.8,marginBottom:8,fontWeight:600,textTransform:'uppercase'}}>{title}</div>
    {children}
  </div>
)}
function Metric({label,value,colour='var(--accent-light)',unit=''}){return(
  <div style={{marginBottom:8}}>
    <div style={{fontSize:10,color:'var(--text-muted)',marginBottom:2}}>{label}</div>
    <div style={{fontFamily:'var(--font-mono)',fontSize:18,fontWeight:700,color:colour,lineHeight:1}}>
      {value}<span style={{fontSize:10,color:'var(--text-muted)',marginLeft:3}}>{unit}</span>
    </div>
  </div>
)}
function Gauge({label,pct,colour,display}){return(
  <div style={{marginBottom:8}}>
    <div style={{display:'flex',justifyContent:'space-between',marginBottom:3,fontSize:11}}>
      <span style={{color:'var(--text-secondary)'}}>{label}</span>
      <span style={{fontFamily:'var(--font-mono)',fontSize:11,color:colour,fontWeight:600}}>{display}</span>
    </div>
    <div style={{height:4,background:'var(--border-mid)',borderRadius:2,overflow:'hidden'}}>
      <div style={{height:'100%',width:`${Math.min(100,Math.max(0,pct))}%`,background:colour,borderRadius:2,transition:'width 0.4s ease'}}/>
    </div>
  </div>
)}

function CpCanvas({data}){
  const ref=useRef(null)
  useEffect(()=>{
    if(!data?.length)return
    const c=ref.current; if(!c)return
    const ctx=c.getContext('2d'); const W=c.width,H=c.height
    ctx.clearRect(0,0,W,H)
    ctx.fillStyle=getComputedStyle(document.documentElement).getPropertyValue('--bg-card')||'#1c2130'
    ctx.fillRect(0,0,W,H)
    const mapX=xc=>W*xc; const cpMin=-3,cpMax=1
    const mapY=cp=>H*(cp-cpMin)/(cpMax-cpMin)
    const y0=mapY(0)
    ctx.strokeStyle='rgba(100,130,170,0.2)';ctx.lineWidth=1
    ctx.beginPath();ctx.moveTo(0,y0);ctx.lineTo(W,y0);ctx.stroke()
    ctx.lineWidth=1.5;ctx.strokeStyle='#ef4444'
    ctx.beginPath();data.forEach((d,i)=>i===0?ctx.moveTo(mapX(d.xc),mapY(d.upper)):ctx.lineTo(mapX(d.xc),mapY(d.upper)));ctx.stroke()
    ctx.strokeStyle='#3b82f6'
    ctx.beginPath();data.forEach((d,i)=>i===0?ctx.moveTo(mapX(d.xc),mapY(d.lower)):ctx.lineTo(mapX(d.xc),mapY(d.lower)));ctx.stroke()
    ctx.fillStyle='rgba(100,130,170,0.5)';ctx.font='9px monospace'
    ctx.fillText('Cp',2,11);ctx.fillText('-3',2,14);ctx.fillText('+1',2,H-4)
    ctx.fillStyle='#ef4444';ctx.fillText('↑ UPR',W-38,11)
    ctx.fillStyle='#3b82f6';ctx.fillText('↓ LWR',W-38,22)
  },[data])
  return <canvas ref={ref} width={264} height={108} style={{width:'100%',height:108,borderRadius:4}}/>
}

function DragCanvas({bd}){
  const ref=useRef(null)
  useEffect(()=>{
    if(!bd)return
    const c=ref.current;if(!c)return
    const ctx=c.getContext('2d');const W=c.width,H=c.height
    ctx.clearRect(0,0,W,H)
    const data=[{l:'Induced',v:parseFloat(bd.induced),c:'#8b5cf6'},{l:'Form',v:parseFloat(bd.form),c:'#f97316'},{l:'Fuselage',v:parseFloat(bd.fuselage),c:'#3b82f6'},{l:'Interf.',v:parseFloat(bd.interference),c:'#eab308'}]
    const total=data.reduce((s,d)=>s+d.v,0)
    const cx=W*0.38,cy=H/2,r=Math.min(cx,cy)*0.82,ri=r*0.5
    let angle=-Math.PI/2
    data.forEach(d=>{
      const sweep=(d.v/total)*2*Math.PI
      ctx.beginPath();ctx.moveTo(cx,cy);ctx.arc(cx,cy,r,angle,angle+sweep);ctx.closePath()
      ctx.fillStyle=d.c;ctx.fill();ctx.strokeStyle='var(--bg-card)';ctx.lineWidth=1.5;ctx.stroke()
      angle+=sweep
    })
    ctx.beginPath();ctx.arc(cx,cy,ri,0,Math.PI*2);ctx.fillStyle='var(--bg-card)';ctx.fill()
    const lx=W*0.72
    data.forEach((d,i)=>{
      ctx.fillStyle=d.c;ctx.fillRect(lx,14+i*22,8,8)
      ctx.fillStyle='var(--text-secondary)';ctx.font='9px monospace'
      ctx.fillText(`${d.l}`,lx+12,14+i*22+8)
      ctx.fillStyle=d.c;ctx.fillText(`${d.v}%`,lx+12,14+i*22+18)
    })
  },[bd])
  return <canvas ref={ref} width={264} height={108} style={{width:'100%',height:108,borderRadius:4}}/>
}

function generateAlerts(results,params){
  if(!results)return[]
  const {aero,fea,mach}=results;const A=[]
  if(fea){
    if(fea.safetyFactor<1.5) A.push({t:'crit',m:`CRITICAL: Safety factor ${f2(fea.safetyFactor)} below ultimate limit 1.5. Structural failure likely.`})
    else if(fea.safetyFactor<2.5) A.push({t:'warn',m:`Safety factor ${f2(fea.safetyFactor)} below recommended 2.5 per FAR/CS-25.`})
    else A.push({t:'ok',m:`Safety factor ${f2(fea.safetyFactor)} — structure adequate for n=${params.load_factor}g.`})
    if(fea.maxDefl_mm>params.span*10) A.push({t:'warn',m:`Tip deflection ${f1(fea.maxDefl_mm)}mm exceeds b/100 guideline.`})
  }
  if(aero){
    if(aero.LD<10) A.push({t:'warn',m:`L/D=${f1(aero.LD)} is low. Increase AR or reduce drag.`})
    else A.push({t:'ok',m:`L/D=${f1(aero.LD)} — aerodynamically acceptable.`})
    if(aero.CL>aero.CL_max*0.88) A.push({t:'crit',m:`CL=${f3(aero.CL)} near CLmax=${f3(aero.CL_max)}. Stall margin <12%.`})
  }
  if(mach){
    if(mach.isSupercritical) A.push({t:'crit',m:`M=${params.mach} > Mcrit=${f3(mach.Mcrit)}. Shock-induced separation expected!`})
    else if(params.mach>mach.Mcrit*0.92) A.push({t:'warn',m:`Approaching Mcrit (${f3(mach.Mcrit)}). Wave drag rising.`})
    else A.push({t:'ok',m:`M=${params.mach} subcritical (Mcrit=${f3(mach.Mcrit)}).`})
  }
  return A
}

export default function RightPanel({ results, activeRTab, setActiveRTab, params }) {
  const aero=results?.aero,fea=results?.fea,mach=results?.mach
  const alerts=generateAlerts(results,params)
  const tabs=[{id:'results',l:'Results'},{id:'alerts',l:`Alerts${alerts.length?` (${alerts.length})`:''}`},{id:'log',l:'Log'}]

  return (
    <div style={{width:290,flexShrink:0,background:'var(--bg-panel)',borderLeft:'1px solid var(--border-subtle)',display:'flex',flexDirection:'column',overflow:'hidden'}}>
      <div style={{display:'flex',borderBottom:'1px solid var(--border-subtle)',background:'var(--bg-sidebar)',flexShrink:0}}>
        {tabs.map(t=>(
          <div key={t.id} onClick={()=>setActiveRTab(t.id)} style={{
            flex:1,padding:'9px 4px',textAlign:'center',fontSize:11,fontWeight:500,
            color:activeRTab===t.id?'var(--accent-light)':'var(--text-muted)',
            borderBottom:`2px solid ${activeRTab===t.id?'var(--accent)':'transparent'}`,
            background:activeRTab===t.id?'var(--accent-dim)':'transparent',
            cursor:'pointer',transition:'all 0.12s',
          }}>{t.l}</div>
        ))}
      </div>

      {activeRTab==='results'&&(
        <div style={{flex:1,overflowY:'auto',padding:10}}>
          {!results&&<div style={{padding:20,textAlign:'center',color:'var(--text-muted)',fontSize:12}}>
            Run a simulation (F5) to see results.
          </div>}
          {aero&&<>
            <Card title="Aerodynamic Coefficients">
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:4}}>
                <Metric label="LIFT CL" value={f4(aero.CL)} colour="var(--accent-light)"/>
                <Metric label="DRAG CD" value={f5(aero.CD)} colour="var(--orange)"/>
                <Metric label="MOMENT CM" value={f3(aero.CM)} colour="var(--yellow)"/>
                <Metric label="L/D RATIO" value={f1(aero.LD)} colour="var(--green)"/>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:4,marginTop:6,fontSize:10,fontFamily:'var(--font-mono)'}}>
                <span style={{color:'var(--text-muted)'}}>CDi: <span style={{color:'var(--violet)'}}>{f5(aero.CDi)}</span></span>
                <span style={{color:'var(--text-muted)'}}>e: <span style={{color:'var(--teal)'}}>{f3(aero.e)}</span></span>
                <span style={{color:'var(--text-muted)'}}>CD0: <span style={{color:'var(--text-secondary)'}}>{f5(aero.CD0)}</span></span>
                <span style={{color:'var(--text-muted)'}}>CLmax: <span style={{color:'var(--yellow)'}}>{f3(aero.CL_max)}</span></span>
              </div>
            </Card>
            <Card title="Flow Conditions">
              <Gauge label="Mach No." pct={params.mach/2*100} colour="var(--violet)" display={f3(params.mach)}/>
              <Gauge label="AoA" pct={(params.aoa_deg+12)/34*100} colour="var(--yellow)" display={`${params.aoa_deg}°`}/>
              <Gauge label="Reynolds" pct={Math.min(100,aero.Re/1e7*100)} colour="var(--teal)" display={`${(aero.Re/1e6).toFixed(2)}M`}/>
              <Gauge label="Dyn. Pressure" pct={Math.min(100,aero.q/80000*100)} colour="var(--orange)" display={`${Math.round(aero.q)} Pa`}/>
            </Card>
            <Card title="Pressure Distribution Cp">
              <div style={{display:'flex',gap:8,marginBottom:5,fontSize:10}}>
                <span style={{color:'#ef4444'}}>● Upper</span>
                <span style={{color:'#3b82f6'}}>● Lower</span>
              </div>
              <CpCanvas data={aero.cpDistribution}/>
            </Card>
            <Card title="Drag Breakdown">
              <DragCanvas bd={aero.dragBreakdown}/>
            </Card>
          </>}
          {fea&&(
            <Card title="Structural (FEA)">
              <Gauge label="Max Von Mises σ" pct={fea.maxStress_MPa/(fea.material?.fy/1e6||500)*100} colour={fea.maxStress_MPa>400?'var(--red)':'var(--orange)'} display={`${f1(fea.maxStress_MPa)} MPa`}/>
              <Gauge label="Tip Deflection" pct={Math.min(100,fea.maxDefl_mm/300*100)} colour="var(--yellow)" display={`${f1(fea.maxDefl_mm)} mm`}/>
              <Gauge label="Safety Factor" pct={Math.min(100,fea.safetyFactor/5*100)} colour={fea.safetyFactor<1.5?'var(--red)':fea.safetyFactor<2.5?'var(--yellow)':'var(--green)'} display={f2(fea.safetyFactor)}/>
            </Card>
          )}
          {mach&&(
            <Card title="Mach / Compressibility">
              <Gauge label="Freestream M" pct={params.mach/3*100} colour="var(--violet)" display={f3(params.mach)}/>
              <Gauge label="Critical Mcrit" pct={mach.Mcrit/1*100} colour={mach.isSupercritical?'var(--red)':'var(--green)'} display={f3(mach.Mcrit)}/>
              <div style={{marginTop:6,padding:'6px 8px',borderRadius:4,background:mach.isSupercritical?'var(--red-dim)':'var(--green-dim)',border:`1px solid ${mach.isSupercritical?'rgba(239,68,68,0.3)':'rgba(34,197,94,0.25)'}`,fontSize:11,fontWeight:600,color:mach.isSupercritical?'var(--red)':'var(--green)'}}>
                {mach.isSupercritical?'⚠ SUPERCRITICAL — SHOCK PRESENT':'✓ SUBCRITICAL — NO SHOCK'}
              </div>
            </Card>
          )}
        </div>
      )}

      {activeRTab==='alerts'&&(
        <div style={{flex:1,overflowY:'auto',padding:10}}>
          {alerts.length===0&&<div style={{padding:16,textAlign:'center',color:'var(--text-muted)',fontSize:12}}>Run simulation to generate alerts.</div>}
          {alerts.map((a,i)=>{
            const s={ok:{bg:'var(--green-dim)',border:'rgba(34,197,94,0.3)',c:'var(--green)',icon:'✓'},warn:{bg:'var(--yellow-dim)',border:'rgba(234,179,8,0.3)',c:'var(--yellow)',icon:'⚠'},crit:{bg:'var(--red-dim)',border:'rgba(239,68,68,0.3)',c:'var(--red)',icon:'✕'}}[a.t]||{}
            return(
              <div key={i} style={{padding:'8px 10px',borderRadius:5,marginBottom:7,background:s.bg,border:`1px solid ${s.border}`,borderLeft:`3px solid ${s.c}`,fontSize:11.5,color:s.c,lineHeight:1.6,display:'flex',gap:7}}>
                <span style={{flexShrink:0}}>{s.icon}</span><span>{a.m}</span>
              </div>
            )
          })}
        </div>
      )}

      {activeRTab==='log'&&(
        <div style={{flex:1,overflowY:'auto',padding:'10px 12px',fontFamily:'var(--font-mono)',fontSize:10.5,color:'var(--text-muted)',lineHeight:2}}>
          {['[ TAS v2.0 ] System initialised.','[ CFD ] Panel method ready.','[ FEA ] Beam kernel ready.','[ SHOCK ] Compressibility solver ready.','[ GEOM ] STL/OBJ import engine ready.',
            ...(results?[
              `[ ${results.timestamp?.toTimeString?.()?.slice(0,8)??'--'} ] Simulation complete.`,
              aero&&`[ AERO ] CL=${f4(aero.CL)} CD=${f5(aero.CD)} L/D=${f1(aero.LD)}`,
              fea&&`[ FEA ] σ=${f1(fea.maxStress_MPa)}MPa δ=${f1(fea.maxDefl_mm)}mm SF=${f2(fea.safetyFactor)}`,
              mach&&`[ MACH ] Mcrit=${f3(mach.Mcrit)} ${mach.isSupercritical?'SUPERCRITICAL':'SUBCRITICAL'}`,
            ].filter(Boolean):[])
          ].map((l,i)=><div key={i}>{l}</div>)}
        </div>
      )}
    </div>
  )
}
