import React,{useState} from 'react'
const secs=[
  {t:'Overview',c:`Travan Aero Simulator v2.0 — Professional Aerospace Analysis Suite\n\nCapabilities:\n• Full aircraft 3D geometry with parametric wing, fuselage, empennage, and nacelles\n• 21-airfoil database (NACA, RAE, Wortmann, Supercritical)\n• Aerodynamic solver: vortex-lattice panel method + Prandtl-Glauert\n• Structural FEA: Euler-Bernoulli beam, box spar, flutter estimate\n• Mach/shock: Küchemann Mcrit, normal & oblique shock relations\n• STL / OBJ / Assembly JSON geometry import\n• Light and dark theme\n• Professional 8-section performance report\n\nKeyboard shortcuts:\n  F5          Run full simulation\n  Ctrl+S      Save design (.tas)\n  Ctrl+O      Open design\n  Ctrl+E      Export report\n  ☀/🌙 button Toggle light/dark theme`},
  {t:'Camera & Views',c:`3D VIEWPORT CONTROLS:\n  Left-drag    Orbit (rotate) model\n  Right-drag   Pan (shift+drag also works)\n  Scroll       Zoom in / out\n  ↺ Reset      Return to preset camera\n\nVIEW PRESETS:\n  3D      Perspective — drag to orbit freely\n  TOP     Orthographic looking straight DOWN (-Y)\n  FRONT   Orthographic looking along +X axis\n  SIDE    Orthographic looking along +Z axis\n  QUAD    All four views simultaneously\n\nThe camera correctly snaps to each preset on click.\nOrthographic views maintain true parallel projection.`},
  {t:'Aircraft Design',c:`WING: Span, root/tip chord, sweep, dihedral, washout twist, airfoil\nFUSELAGE: Length, diameter, nose length, tail taper ratio\nH-TAIL: Span, chord root/tip, sweep, dihedral\nV-TAIL: Height, chord root/tip, sweep\nENGINES: 0/2/4 engines, nacelle size and span position\n\nAll changes update the 3D view immediately.\nPress ▶ Run Simulation or F5 to compute results.`},
  {t:'Airfoil Library',c:`21 airfoils available:\n  NACA 0006/0009/0012/0015  — Symmetric\n  NACA 2412/2415            — Classic general aviation\n  NACA 4412/4415/6412       — High camber\n  NACA 23012/23015          — Reflex, low moment\n  NACA 64-212/64-412        — Laminar flow\n  NACA 65-415/66-212        — Low drag\n  RAE 2822                  — Supercritical (M>0.7)\n  CLARK-Y                   — Classic light aircraft\n  NACA 747A315              — High-lift\n  Wortmann FX-61-147        — Sailplane\n  NACA 63A-212              — Fighter/transport\n  SC(2)-0714                — Whitcomb supercritical`},
  {t:'STL / OBJ Import',c:`Supported: .stl (binary + ASCII), .obj, .json assembly\n\nHow to import:\n  1. Click 📎 Import STL / OBJ in Design panel\n  2. Select your geometry file\n  3. TAS parses, normalises, extracts aero features\n  4. Parameters auto-populate — review and adjust\n  5. Run simulation normally\n\nAssembly JSON format:\n  { "name": "Wing", "components": [\n    { "name": "Wing", "vertices": [x,y,z,...], "triangles": [0,1,2,...] }\n  ]}\n\nCAD export tips:\n  SolidWorks: File → Save As → STL\n  CATIA: File → Save As → STL\n  Blender: File → Export → Stl`},
  {t:'Results & Reports',c:`RESULTS PANEL (right side):\n  Results tab  — Coefficients, gauges, Cp chart, drag pie\n  Alerts tab   — Prioritised engineering warnings\n  Log tab      — Solver output log\n\nGENERATE REPORT:\n  Click 📄 Report in sidebar (or Ctrl+E)\n  Requires at least one full simulation\n\nREPORT SECTIONS:\n  1. Performance Scorecard (0–100)\n  2. Aerodynamic coefficients table\n  3. Flow conditions (ISA)\n  4. Structural FEA summary\n  5. Design recommendations\n\nEXPORT: ⬇ Export TXT saves structured text report.\nFor PDF: Ctrl+P → Save as PDF from report window.`},
]
export default function ManualModal({onClose}){
  const [act,setAct]=useState(0)
  return(
    <div style={{position:'fixed',inset:0,zIndex:800,background:'var(--bg-overlay)',display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(4px)'}}>
      <div style={{width:760,height:'84vh',background:'var(--bg-panel)',border:'1px solid var(--border-accent)',borderRadius:10,display:'flex',flexDirection:'column',boxShadow:'var(--shadow-lg)',overflow:'hidden'}}>
        <div style={{padding:'13px 18px',flexShrink:0,borderBottom:'1px solid var(--border-subtle)',display:'flex',justifyContent:'space-between',alignItems:'center',background:'var(--bg-card)'}}>
          <div style={{fontSize:15,fontFamily:'var(--font-display)',fontWeight:700,color:'var(--text-primary)'}}>User Manual — Travan Aero Simulator v2.0</div>
          <button onClick={onClose} className="btn-icon" style={{fontSize:18}}>✕</button>
        </div>
        <div style={{flex:1,display:'flex',overflow:'hidden'}}>
          <div style={{width:170,flexShrink:0,borderRight:'1px solid var(--border-subtle)',background:'var(--bg-sidebar)',overflowY:'auto',padding:'10px 0'}}>
            {secs.map((s,i)=>(
              <div key={i} onClick={()=>setAct(i)} style={{padding:'9px 16px',fontSize:12,fontWeight:500,color:act===i?'var(--accent-light)':'var(--text-muted)',background:act===i?'var(--accent-dim)':'transparent',borderLeft:`2px solid ${act===i?'var(--accent)':'transparent'}`,cursor:'pointer',transition:'all 0.1s'}}>{s.t}</div>
            ))}
          </div>
          <div style={{flex:1,overflowY:'auto',padding:24}}>
            <div style={{fontSize:13,fontFamily:'var(--font-display)',fontWeight:700,color:'var(--accent-light)',marginBottom:14,paddingBottom:8,borderBottom:'1px solid var(--border-subtle)'}}>{secs[act].t}</div>
            <pre style={{fontFamily:'var(--font-mono)',fontSize:11.5,color:'var(--text-secondary)',lineHeight:1.9,whiteSpace:'pre-wrap',margin:0}}>{secs[act].c}</pre>
          </div>
        </div>
      </div>
    </div>
  )
}
