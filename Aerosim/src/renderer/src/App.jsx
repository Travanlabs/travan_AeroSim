import React, { useState, useEffect, useCallback, useRef } from 'react'
import TitleBar from './components/TitleBar.jsx'
import Sidebar from './components/Sidebar.jsx'
import LeftPanel from './components/LeftPanel.jsx'
import Viewport from './components/Viewport.jsx'
import RightPanel from './components/RightPanel.jsx'
import StatusBar from './components/StatusBar.jsx'
import SimOverlay from './components/SimOverlay.jsx'
import ReportModal from './components/ReportModal.jsx'
import ManualModal from './components/ManualModal.jsx'
import { solveAerodynamics, computePolar, AIRFOILS } from './engines/aerodynamics.js'
import { solveFEA } from './engines/fea.js'
import { solveMach } from './engines/mach.js'
import { parseGeometryFile } from './engines/geometry.js'
const clamp = (v,a,b) => Math.max(a, Math.min(b, v))

export const DEFAULT_PARAMS = {
  // Wing
  span: 34.0, chord_root: 5.5, chord_tip: 2.2,
  sweep_deg: 28, dihedral_deg: 6, twist_deg: -2,
  airfoilKey: 'NACA 2412',
  // Fuselage
  fuse_length: 63.0, fuse_diameter: 6.1,
  fuse_nose_length: 8, fuse_tail_taper: 0.25,
  // Wing placement & CG
  wing_le_x: 22.0,      // metres from nose to wing root LE  (≈35% of 63m)
  cg_x_frac: 0.38,      // CG as fraction of fuse_length  (0=nose, 1=tail)
  // Empennage
  htail_span: 14.0, htail_chord_root: 4.0, htail_chord_tip: 1.8,
  htail_sweep: 35, htail_dihedral: 3, htail_airfoilKey: 'NACA 0012',
  vtail_height: 7.5, vtail_chord_root: 5.5, vtail_chord_tip: 2.0, vtail_sweep: 40, vtail_airfoilKey: 'NACA 0009',
  // Engines
  engine_count: 2, nacelle_length: 5.5, nacelle_diameter: 2.0,
  nacelle_span_pos: 0.33,
  // Flow
  mach: 0.82, altitude_m: 11000, aoa_deg: 2.5,
  // Structure
  materialKey: 'Al 7075-T6',
  skin_t_mm: 4.0, spar_h_mm: 480, spar_cap_t_mm: 8.0, load_factor: 3.75,
  // Weight
  mtow_kg: 79016, fuel_kg: 26022, payload_kg: 21000,
  // Mesh
  span_panels: 20, chord_panels: 16,
}

export default function App() {
  const [params, setParams]             = useState(DEFAULT_PARAMS)
  const [activeView, setActiveView]     = useState('design')
  const [results, setResults]           = useState(null)
  const [simRunning, setSimRunning]     = useState(false)
  const [simProgress, setSimProgress]   = useState(0)
  const [simPhase, setSimPhase]         = useState('')
  const [simLog, setSimLog]             = useState([])
  const [showReport, setShowReport]     = useState(false)
  const [showManual, setShowManual]     = useState(false)
  const [activeRTab, setActiveRTab]     = useState('results')
  const [polarData, setPolarData]       = useState(null)
  const [notification, setNotification] = useState(null)
  const [importedModel, setImportedModel] = useState(null)
  const [theme, setTheme]               = useState('dark')
  const notifRef = useRef(null)

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  const toggleTheme = useCallback(() => setTheme(t => t==='dark'?'light':'dark'), [])

  const notify = useCallback((msg, type='info', dur=3500) => {
    clearTimeout(notifRef.current)
    setNotification({ msg, type })
    notifRef.current = setTimeout(() => setNotification(null), dur)
  }, [])

  const setParam = useCallback((key, value) => setParams(p => ({ ...p, [key]: value })), [])

  const resetDesign = useCallback(() => {
    setParams(DEFAULT_PARAMS)
    setResults(null)
    setPolarData(null)
    setImportedModel(null)
    notify('Design reset to defaults', 'info')
  }, [notify])

  const handleGeometryImport = useCallback(async (file) => {
    try {
      notify(`Parsing ${file.name}…`, 'info', 8000)
      const { model, aeroFeatures } = await parseGeometryFile(file)
      setImportedModel(model)
      setParams(p => ({
        ...p,
        span: Math.max(1, +aeroFeatures.span.toFixed(2)),
        chord_root: Math.max(0.2, +aeroFeatures.chord_root.toFixed(2)),
        chord_tip: Math.max(0.1, +aeroFeatures.chord_tip.toFixed(2)),
      }))
      notify(`✓ Imported ${model.name} — ${model.stats.triCount.toLocaleString()} triangles`, 'success', 5000)
    } catch (err) {
      notify(`Import failed: ${err.message}`, 'error', 6000)
    }
  }, [notify])

  const runSimulation = useCallback(async () => {
    setSimRunning(true); setSimProgress(0); setSimLog([])
    const step = async (pct, phase, msg) => {
      setSimProgress(pct); setSimPhase(phase)
      if (msg) setSimLog(l => [...l, `▸ ${msg}`])
      await new Promise(r => setTimeout(r, 60 + Math.random()*80))
    }
    try {
      await step(5,  'Configuring mesh…',           `${params.span_panels}×${params.chord_panels} panels`)
      await step(12, 'Building vortex panel array…', `${params.span_panels*params.chord_panels} doublet panels`)
      await step(20, 'Assembling AIC matrix…',       'Aerodynamic influence coefficients')
      await step(28, 'Enforcing Kutta condition…',   'Trailing-edge condition applied')
      await step(36, 'Panel solver iterating…',      'Gauss-Seidel convergence loop')
      const aeroR = solveAerodynamics(params)
      await step(46, 'Integrating Cp field…',        `CL=${aeroR.CL.toFixed(4)}  CD=${aeroR.CD.toFixed(5)}`)
      await step(53, 'Wake vortex computation…',     `L/D=${aeroR.LD.toFixed(2)}  Re=${(aeroR.Re/1e6).toFixed(2)}M`)
      await step(60, 'Building FEA mesh…',           `${params.span_panels+1} Euler-Bernoulli beam elements`)
      await step(67, 'Assembling stiffness matrix…', 'Tapered box-spar beam elements')
      await step(74, 'Applying factored loads…',     `n=${params.load_factor}g elliptic distribution`)
      const feaR = solveFEA(params, aeroR)
      await step(82, 'Extracting stress field…',     `σ_max=${feaR.maxStress_MPa.toFixed(1)}MPa  SF=${feaR.safetyFactor.toFixed(2)}`)
      await step(88, 'Prandtl-Glauert correction…',  `β=${aeroR.beta.toFixed(4)}`)
      const af = AIRFOILS[params.airfoilKey] || AIRFOILS['NACA 2412']
      const machR = solveMach({ ...params, t_c:af.t_c, camber:af.camber }, { ...aeroR, t_c:af.t_c, camber:af.camber })
      await step(94, 'Shock detection pass…',        machR.isSupercritical ? `⚠ SHOCK Mcrit=${machR.Mcrit.toFixed(3)}` : `✓ Subcritical Mcrit=${machR.Mcrit.toFixed(3)}`)
      await step(100,'Simulation complete.',          `Converged — ${params.span_panels*params.chord_panels} panels`)
      setResults({ aero:aeroR, fea:feaR, mach:machR, timestamp:new Date() })
      setActiveRTab('results')
      notify('Simulation converged ✓', 'success')
    } catch (err) {
      setSimLog(l => [...l, `✕ ERROR: ${err.message}`])
      notify(`Solver error: ${err.message}`, 'error')
    } finally { setSimRunning(false) }
  }, [params, notify])

  const runPolar = useCallback((aoa_min, aoa_max) => {
    const data = computePolar(params, aoa_min, aoa_max, 0.5)
    setPolarData(data)
    notify(`Polar computed — ${data.length} points`, 'success')
    return data
  }, [params, notify])

  const saveDesign = useCallback(async () => {
    const data = { ...params, _version:'2.0', _ts:new Date().toISOString() }
    if (window.electronAPI) {
      const r = await window.electronAPI.saveDesign(data)
      if (r?.success) notify(`Saved: ${r.path}`, 'success')
    } else {
      const a = document.createElement('a')
      a.href = URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}))
      a.download='design.tas'; a.click()
      notify('Design exported as .tas', 'success')
    }
  }, [params, notify])

  useEffect(() => {
    if (!window.electronAPI?.onMenuAction) return
    window.electronAPI.onMenuAction((event, ...args) => {
      ({
        'menu:run-sim':       () => runSimulation(),
        'menu:save-design':   () => saveDesign(),
        'menu:export-report': () => results ? setShowReport(true) : notify('Run simulation first','warning'),
        'menu:new-design':    () => resetDesign(),
        'menu:open-design':   () => args[0] && setParams({...DEFAULT_PARAMS,...args[0]}),
        'menu:show-manual':   () => setShowManual(true),
      })[event]?.()
    })
  }, [runSimulation, saveDesign, resetDesign, results, notify])

  // ── Resizable panel widths ────────────────────────────────
  const [leftW,  setLeftW]  = useState(290)
  const [rightW, setRightW] = useState(290)
  const MIN_PANEL = 180, MAX_PANEL = 560

  const leftDragRef  = useRef(null)
  const rightDragRef = useRef(null)

  useEffect(() => {
    function makeDragger(setW, dir) {
      return {
        start(e) {
          e.preventDefault()
          let last = e.clientX
          function move(ev) {
            const d = ev.clientX - last; last = ev.clientX
            setW(prev => Math.max(MIN_PANEL, Math.min(MAX_PANEL, prev + (dir==='left' ? d : -d))))
          }
          function up() { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up) }
          window.addEventListener('mousemove', move)
          window.addEventListener('mouseup', up)
        }
      }
    }
    leftDragRef.current  = makeDragger(setLeftW,  'left')
    rightDragRef.current = makeDragger(setRightW, 'right')
  }, [])

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100vh',overflow:'hidden',background:'var(--bg-app)'}}>
      <TitleBar results={results} params={params} theme={theme} onToggleTheme={toggleTheme}/>

      <div style={{display:'flex',flex:1,overflow:'hidden'}}>
        <Sidebar activeView={activeView} onViewChange={setActiveView}
          onRunSim={runSimulation} onReport={()=>results?setShowReport(true):notify('Run simulation first','warning')}
          onManual={()=>setShowManual(true)} hasResults={!!results} theme={theme}/>

        {/* Left panel + drag handle */}
        <div style={{width:leftW,flexShrink:0,display:'flex',overflow:'hidden'}}>
          <LeftPanel activeView={activeView} params={params} setParam={setParam}
            results={results} onRunSim={runSimulation} onRunPolar={runPolar}
            onSave={saveDesign} onReset={resetDesign} onImport={handleGeometryImport}
            polarData={polarData} importedModel={importedModel} theme={theme}/>
        </div>
        <div
          onMouseDown={e=>leftDragRef.current?.start(e)}
          style={{width:5,cursor:'col-resize',flexShrink:0,background:'var(--border-subtle)',transition:'background 0.15s'}}
          onMouseEnter={e=>e.currentTarget.style.background='var(--accent)'}
          onMouseLeave={e=>e.currentTarget.style.background='var(--border-subtle)'}
          title="Drag to resize left panel"
        />

        <Viewport params={params} activeView={activeView} results={results}
          importedModel={importedModel} theme={theme}/>

        {/* Drag handle + Right panel */}
        <div
          onMouseDown={e=>rightDragRef.current?.start(e)}
          style={{width:5,cursor:'col-resize',flexShrink:0,background:'var(--border-subtle)',transition:'background 0.15s'}}
          onMouseEnter={e=>e.currentTarget.style.background='var(--accent)'}
          onMouseLeave={e=>e.currentTarget.style.background='var(--border-subtle)'}
          title="Drag to resize right panel"
        />
        <div style={{width:rightW,flexShrink:0,display:'flex',overflow:'hidden'}}>
          <RightPanel results={results} activeRTab={activeRTab}
            setActiveRTab={setActiveRTab} params={params} theme={theme}/>
        </div>
      </div>

      <StatusBar results={results} params={params} simRunning={simRunning} theme={theme}/>

      {simRunning && <SimOverlay progress={simProgress} phase={simPhase} log={simLog}/>}
      {showReport && results && <ReportModal results={results} params={params} onClose={()=>setShowReport(false)} notify={notify}/>}
      {showManual && <ManualModal onClose={()=>setShowManual(false)}/>}

      {notification && <Toast msg={notification.msg} type={notification.type}/>}
    </div>
  )
}

function Toast({ msg, type }) {
  const styles = {
    info:    { border:'var(--accent)',  bg:'var(--accent-dim)',   color:'var(--accent-light)' },
    success: { border:'var(--green)',   bg:'var(--green-dim)',    color:'var(--green)' },
    warning: { border:'var(--yellow)',  bg:'var(--yellow-dim)',   color:'var(--yellow)' },
    error:   { border:'var(--red)',     bg:'var(--red-dim)',      color:'var(--red)' },
  }[type]||{}
  return (
    <div className="animate-fade-in" style={{
      position:'fixed', bottom:40, right:16, zIndex:9999,
      padding:'10px 18px', borderRadius:8,
      border:`1px solid ${styles.border}`,
      background:styles.bg, color:styles.color,
      fontFamily:'var(--font-ui)', fontSize:13, fontWeight:500,
      boxShadow:'var(--shadow-lg)', maxWidth:340,
    }}>{msg}</div>
  )
}
