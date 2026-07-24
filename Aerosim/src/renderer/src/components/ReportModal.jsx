import React from 'react'
const f1=v=>v!=null?Number(v).toFixed(1):'—',f2=v=>v!=null?Number(v).toFixed(2):'—'
const f3=v=>v!=null?Number(v).toFixed(3):'—',f4=v=>v!=null?Number(v).toFixed(4):'—'
const f5=v=>v!=null?Number(v).toFixed(5):'—'
const fE=v=>v!=null?Number(v).toExponential(3):'—'

function Sec({title,children}){return(
  <div style={{marginBottom:22}}>
    <div style={{fontSize:11,fontWeight:700,color:'var(--accent-light)',letterSpacing:1.5,marginBottom:10,paddingBottom:6,borderBottom:'1px solid var(--border-subtle)',textTransform:'uppercase'}}>{title}</div>
    {children}
  </div>
)}
function TRow({cols,rows}){return(
  <table style={{width:'100%',borderCollapse:'collapse',fontSize:11.5}}>
    <thead><tr>{cols.map(c=><th key={c} style={{fontFamily:'var(--font-mono)',fontSize:10,color:'var(--text-muted)',padding:'5px 8px',textAlign:'left',borderBottom:'1px solid var(--border-subtle)',background:'var(--bg-card)',letterSpacing:0.8,fontWeight:600}}>{c}</th>)}</tr></thead>
    <tbody>{rows.map((r,i)=><tr key={i} style={{background:i%2?'transparent':'rgba(0,0,0,0.02)'}}>{r.map((cell,j)=><td key={j} style={{padding:'5px 8px',fontFamily:'var(--font-mono)',fontSize:11,borderBottom:'1px solid var(--border-subtle)',color:typeof cell==='object'?cell.c||'var(--text-secondary)':'var(--text-secondary)'}}>{typeof cell==='object'?cell.v:cell}</td>)}</tr>)}</tbody>
  </table>
)}
function SugCard({p,t}){const s={HIGH:{c:'var(--red)',l:'HIGH PRIORITY'},MED:{c:'var(--yellow)',l:'MED PRIORITY'},LOW:{c:'var(--green)',l:'LOW PRIORITY'}}[p]||{}
  return <div style={{background:'var(--bg-card)',borderLeft:`3px solid ${s.c}`,borderRadius:4,padding:'9px 12px',marginBottom:8}}><div style={{fontSize:10,color:s.c,fontWeight:600,marginBottom:4}}>[{s.l}]</div><div style={{fontSize:11.5,color:'var(--text-secondary)',lineHeight:1.6}}>{t}</div></div>
}

export default function ReportModal({ results, params, onClose, notify }) {
  if(!results)return null
  const {aero,fea,mach,timestamp}=results
  const mat=fea?.material

  const score=Math.round(
    Math.min(40,(aero.LD/20)*40)+Math.min(30,((fea.safetyFactor-1)/4)*30)+
    Math.min(20,(1-aero.CD/0.05)*20)+(mach.isSupercritical?0:10)
  )
  const grade=score>=85?['var(--green)','EXCELLENT']:score>=70?['var(--accent-light)','GOOD']:score>=55?['var(--yellow)','FAIR']:['var(--red)','POOR']

  const sugs=[]
  if(fea.safetyFactor<2.5)sugs.push({p:'HIGH',t:`Safety factor ${f2(fea.safetyFactor)} below 2.5. Increase spar height to ${Math.round(params.spar_h_mm*1.3)}mm or switch to CFRP.`})
  if(aero.LD<14)sugs.push({p:'HIGH',t:`L/D=${f1(aero.LD)} below efficiency target. Increase AR to ${(aero.AR+2).toFixed(1)} by adding ${(params.span*0.12).toFixed(1)}m span.`})
  if(mach.isSupercritical)sugs.push({p:'HIGH',t:`M=${params.mach} exceeds Mcrit=${f3(mach.Mcrit)}. Apply 5° additional sweep or use RAE 2822 supercritical aerofoil.`})
  if(fea.maxDefl_mm>params.span*10)sugs.push({p:'MED',t:`Tip deflection ${f1(fea.maxDefl_mm)}mm exceeds b/100. Increase spar cap thickness.`})
  sugs.push({p:'LOW',t:`Taper ratio λ=${f2(params.chord_tip/params.chord_root)}. Optimum for elliptic loading is 0.35–0.45.`})
  sugs.push({p:'LOW',t:`Consider winglets — estimated 5–8% reduction in induced drag (currently ${aero.dragBreakdown?.induced}% of total CD).`})

  const exportTxt=async()=>{
    const S=params.span,CR=params.chord_root
    const lines=[
      'TRAVAN AERO SIMULATOR v2.0 — AERODYNAMIC PERFORMANCE REPORT','═'.repeat(65),
      `Generated : ${timestamp?.toLocaleString()}`,`Score : ${score}/100 — ${grade[1]}`,'',
      'WING GEOMETRY',`  Span ${S}m  Root Chord ${CR}m  Tip ${params.chord_tip}m`,
      `  AR=${f2(aero.AR)}  λ=${f2(params.chord_tip/CR)}  Λ=${params.sweep_deg}°  Γ=${params.dihedral_deg}°  ε=${params.twist_deg}°`,
      `  Airfoil: ${params.airfoilKey}  S=${f2(aero.S)}m²  MAC=${f2(aero.MAC)}m`,'',
      'AERODYNAMICS',`  CL=${f4(aero.CL)}  CD=${f5(aero.CD)}  CM=${f4(aero.CM)}  L/D=${f1(aero.LD)}`,
      `  CDi=${f5(aero.CDi)}  CD0=${f5(aero.CD0)}  e=${f3(aero.e)}  CLmax=${f3(aero.CL_max)}`,'',
      'FLOW',`  M=${f3(params.mach)}  AoA=${params.aoa_deg}°  Alt=${params.altitude_m}m  TAS=${f1(aero.V)}m/s  q=${Math.round(aero.q)}Pa  Re=${fE(aero.Re)}`,'',
      'MACH',`  Mcrit=${f3(mach.Mcrit)}  Status=${mach.isSupercritical?'SUPERCRITICAL':'SUBCRITICAL'}  ΔCD_wave=${(mach.delta_CD_wave*1e4).toFixed(2)}e-4`,'',
      'FEA',`  Material: ${mat?.name}  σy=${(mat?.fy/1e6).toFixed(0)}MPa  E=${(mat?.E/1e9).toFixed(1)}GPa`,
      `  σmax=${f1(fea.maxStress_MPa)}MPa  δtip=${f1(fea.maxDefl_mm)}mm  M_root=${f1(fea.rootMoment_kNm)}kNm  SF=${f2(fea.safetyFactor)}`,'',
      'RECOMMENDATIONS',...sugs.map((s,i)=>`  [${i+1}][${s.p}] ${s.t}`),'',
      '─'.repeat(65),'Travan Aero Simulator v2.0 — ARAeS Edition',
      'Dickson Tawiah Aman, BEng Aerospace (1st Class), ARAeS',
    ]
    const text=lines.join('\n')
    if(window.electronAPI){const r=await window.electronAPI.exportReport(text);if(r?.success)notify?.(`Saved: ${r.path}`,'success')}
    else{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:'text/plain'}));a.download=`TAS_Report_${new Date().toISOString().slice(0,10)}.txt`;a.click();notify?.('Report exported','success')}
  }

  return (
    <div style={{position:'fixed',inset:0,zIndex:500,background:'var(--bg-overlay)',display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(4px)'}}>
      <div style={{width:820,maxHeight:'90vh',background:'var(--bg-panel)',border:'1px solid var(--border-accent)',borderRadius:10,display:'flex',flexDirection:'column',boxShadow:'var(--shadow-lg)',overflow:'hidden'}}>
        <div style={{padding:'14px 20px',flexShrink:0,borderBottom:'1px solid var(--border-subtle)',display:'flex',justifyContent:'space-between',alignItems:'center',background:'var(--bg-card)'}}>
          <div>
            <div style={{fontSize:15,fontFamily:'var(--font-display)',fontWeight:700,color:'var(--text-primary)'}}>Aerodynamic Performance Report</div>
            <div style={{fontSize:11,color:'var(--text-muted)',marginTop:2,fontFamily:'var(--font-mono)'}}>Generated: {timestamp?.toLocaleString()} · Travan Engineering</div>
          </div>
          <button onClick={onClose} className="btn-icon" style={{fontSize:18}}>✕</button>
        </div>
        <div style={{flex:1,overflowY:'auto',padding:22}}>
          <Sec title="Performance Scorecard">
            <div style={{display:'flex',alignItems:'center',gap:20,marginBottom:16}}>
              <div style={{width:78,height:78,borderRadius:'50%',border:`3px solid ${grade[0]}`,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',boxShadow:`0 0 18px ${grade[0]}44`}}>
                <span style={{fontFamily:'var(--font-display)',fontSize:22,color:grade[0],fontWeight:900}}>{score}</span>
                <span style={{fontSize:9,color:'var(--text-muted)',fontFamily:'var(--font-mono)'}}>/ 100</span>
              </div>
              <div>
                <div style={{fontSize:16,fontFamily:'var(--font-display)',color:grade[0],fontWeight:700}}>{grade[1]}</div>
                <div style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}>Combined aerodynamic performance score</div>
              </div>
            </div>
            <TRow cols={['PARAMETER','VALUE','TARGET','STATUS']} rows={[
              ['L/D Ratio',{v:f1(aero.LD),c:'var(--text-primary)'},'>14',{v:aero.LD>=14?'✓ PASS':'⚠ BELOW',c:aero.LD>=14?'var(--green)':'var(--yellow)'}],
              ['Safety Factor',{v:f2(fea.safetyFactor),c:'var(--text-primary)'},'>2.5',{v:fea.safetyFactor>=2.5?'✓ PASS':fea.safetyFactor>=1.5?'⚠ MARGINAL':'✗ FAIL',c:fea.safetyFactor>=2.5?'var(--green)':fea.safetyFactor>=1.5?'var(--yellow)':'var(--red)'}],
              ['Mach vs Mcrit',{v:`${f3(params.mach)} / ${f3(mach.Mcrit)}`,c:'var(--text-primary)'},'M < Mcrit',{v:!mach.isSupercritical?'✓ PASS':'✗ SHOCK',c:!mach.isSupercritical?'var(--green)':'var(--red)'}],
              ['Tip Deflection',{v:`${f1(fea.maxDefl_mm)} mm`,c:'var(--text-primary)'},`< ${(params.span*10).toFixed(0)} mm`,{v:fea.maxDefl_mm<params.span*10?'✓ PASS':'⚠ HIGH',c:fea.maxDefl_mm<params.span*10?'var(--green)':'var(--yellow)'}],
              ['Stall Margin',{v:`${f1((1-aero.CL/aero.CL_max)*100)}%`,c:'var(--text-primary)'},'>20%',{v:(1-aero.CL/aero.CL_max)>0.2?'✓ OK':'⚠ LOW',c:(1-aero.CL/aero.CL_max)>0.2?'var(--green)':'var(--yellow)'}],
            ]}/>
          </Sec>
          <Sec title="Aerodynamic Coefficients">
            <TRow cols={['COEFFICIENT','VALUE','METHOD']} rows={[
              ['Lift CL',{v:f4(aero.CL),c:'var(--accent-light)'},'Lifting-line + Prandtl-Glauert (Helmbold)'],
              ['Drag CD',{v:f5(aero.CD),c:'var(--orange)'},'CD0 (turbulent BL) + CDi (Oswald)'],
              ['Induced CDi',{v:f5(aero.CDi),c:'var(--violet)'},'CDi = CL²/(π·AR·e)'],
              ['Profile CD0',{v:f5(aero.CD0),c:'var(--text-secondary)'},'Raymer turbulent flat-plate + form'],
              ['Moment CM',{v:f4(aero.CM),c:'var(--yellow)'},'Thin aerofoil theory @ c/4'],
              ['L/D',{v:f1(aero.LD),c:'var(--green)'},'CL/CD'],
              ['Oswald e',{v:f3(aero.e),c:'var(--teal)'},'Raymer: e=1.78(1−0.045·AR^0.68)−0.64'],
              ['CLmax',{v:f3(aero.CL_max),c:'var(--yellow)'},'Empirical (t/c, camber, Re)'],
            ]}/>
          </Sec>
          <Sec title="Flow Conditions">
            <TRow cols={['PARAMETER','VALUE','UNIT']} rows={[
              ['Mach Number',{v:f3(params.mach),c:'var(--violet)'},'—'],
              ['Angle of Attack',{v:`${params.aoa_deg}`,c:'var(--yellow)'},'°'],
              ['Altitude MSL',params.altitude_m,'m'],
              ['True Airspeed',{v:f1(aero.V),c:'var(--accent-light)'},'m/s'],
              ['Dynamic Pressure q',{v:Math.round(aero.q),c:'var(--orange)'},'Pa'],
              ['Reynolds Number',{v:fE(aero.Re),c:'var(--teal)'},'—'],
              ['Temperature',{v:f1((aero.atm?.T||288.15)-273.15),c:'var(--text-secondary)'},'°C'],
              ['Air Density ρ',{v:f3(aero.atm?.rho||1.225),c:'var(--text-secondary)'},'kg/m³'],
            ]}/>
          </Sec>
          <Sec title="Structural FEA">
            <TRow cols={['PARAMETER','VALUE','UNIT']} rows={[
              ['Material',{v:mat?.name||'—',c:'var(--accent-light)'},'—'],
              ['Yield Strength σy',{v:(mat?.fy/1e6).toFixed(0),c:'var(--yellow)'},'MPa'],
              ['Young\'s Modulus',{v:(mat?.E/1e9).toFixed(1),c:'var(--text-secondary)'},'GPa'],
              ['Load Factor n',{v:params.load_factor,c:'var(--orange)'},'g'],
              ['Root Moment',{v:f1(fea.rootMoment_kNm),c:'var(--text-secondary)'},'kNm'],
              ['Max Von Mises σ',{v:f1(fea.maxStress_MPa),c:fea.maxStress_MPa>(mat?.fy/1e6*0.8)?'var(--red)':'var(--green)'},'MPa'],
              ['Tip Deflection',{v:f1(fea.maxDefl_mm),c:fea.maxDefl_mm>params.span*10?'var(--yellow)':'var(--green)'},'mm'],
              ['Safety Factor',{v:f2(fea.safetyFactor),c:fea.safetyFactor>=2.5?'var(--green)':fea.safetyFactor>=1.5?'var(--yellow)':'var(--red)'},'—'],
              ['Flutter Speed',{v:f1(fea.V_flutter),c:'var(--violet)'},'m/s'],
            ]}/>
          </Sec>
          <Sec title="Design Recommendations">
            {sugs.map((s,i)=><SugCard key={i} p={s.p} t={s.t}/>)}
          </Sec>
          <div style={{padding:'10px 12px',borderRadius:5,background:'var(--bg-card)',border:'1px solid var(--border-subtle)',fontSize:10,color:'var(--text-muted)',lineHeight:1.9,fontFamily:'var(--font-mono)'}}>
            DISCLAIMER: Results from panel-method CFD, E-B beam FEA, and ISA atmosphere. Validate against RANS CFD and 3D FEM before certification. NOT for airworthiness decisions. © Travan Engineering / RhoPhi Holdings.
          </div>
        </div>
        <div style={{padding:'12px 20px',borderTop:'1px solid var(--border-subtle)',display:'flex',gap:10,justifyContent:'flex-end',background:'var(--bg-card)',flexShrink:0}}>
          <button className="btn-ghost" onClick={exportTxt} style={{padding:'8px 18px',fontSize:12}}>⬇ Export TXT</button>
          <button className="btn-primary" onClick={onClose} style={{padding:'8px 18px',fontSize:12}}>Close</button>
        </div>
      </div>
    </div>
  )
}
