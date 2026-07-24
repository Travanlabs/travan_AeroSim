/**
 * Travan Aero Simulator — Viewport
 *
 * Fixes in this version:
 *  1. Correct undistorted perspective (proper FOV formula)
 *  2. Camera orbits around aircraft centroid, not nose (x=0)
 *  3. Auto-fit on load + view-change so whole aircraft is always visible
 *  4. Free pan on middle-mouse / shift-drag (translates target in camera plane)
 *  5. Quad panes each have independent orbit, pan, zoom
 */
import React, { useRef, useEffect, useCallback, useState } from 'react';
import {
  VIEW_PRESETS, sphericalToEye, buildViewMatrix,
  projectPoint, projectOrtho,
  clamp, lerp, heatColor, heatColorA, DEG,
  autoFitDistance, aircraftCentroid,
} from '../engines/renderer3d.js';
import { buildAircraftMesh, buildCGMarker, colorFace } from '../engines/aircraft3d.js';
import { renderImportedGeometry } from '../engines/geometry.js';

// ─── Camera init ─────────────────────────────────────────────────────────────
function makeCam(viewKey, params) {
  const p    = VIEW_PRESETS[viewKey] || VIEW_PRESETS['3d'];
  const dist = autoFitDistance(params);
  const tgt  = aircraftCentroid(params);
  return { azimuth: p.azimuth, elevation: p.elevation, distance: dist, target: tgt };
}

// ─── Frame renderer ───────────────────────────────────────────────────────────
const FOV = 55;   // degrees — standard undistorted view

function renderFrame(canvas, cam, params, activeView, results, importedModel, theme, ortho) {
  if (!canvas) return;
  const wrap = canvas.parentElement;
  if (!wrap) return;

  const dpr = window.devicePixelRatio || 1;
  const W0  = wrap.clientWidth, H0 = wrap.clientHeight;
  if (W0 < 1 || H0 < 1) return;
  const W = Math.round(W0 * dpr), H = Math.round(H0 * dpr);
  if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = theme === 'light' ? '#d4d9e8' : '#0a0d14';
  ctx.fillRect(0, 0, W, H);

  const eye    = sphericalToEye(cam.azimuth, cam.elevation, cam.distance, cam.target);
  const camMat = buildViewMatrix(eye, cam.target);

  // Orthographic zoom: world-units-per-pixel derived from distance
  const orthoZoom = 1 / cam.distance;

  const proj = (p) => ortho
    ? projectOrtho(p, camMat, W, H, orthoZoom)
    : projectPoint(p, camMat, W, H, FOV);

  drawGrid(ctx, proj, cam, W, H, theme, ortho);

  if (importedModel) {
    renderImportedGeometry(ctx, importedModel, W/2, H/2,
      Math.min(W,H)/16, cam.azimuth*DEG, cam.elevation*DEG, activeView, results);
    drawAxes(ctx, proj, W, H, theme);
    drawViewLabel(ctx, activeView, ortho, dpr, theme);
    return;
  }

  const faces = buildAircraftMesh(params);

  // Painter's sort
  const projected = [];
  for (const face of faces) {
    const pa = proj(face.verts[0]), pb = proj(face.verts[1]), pc = proj(face.verts[2]);
    if (!pa || !pb || !pc) continue;
    projected.push({ face, pa, pb, pc, depth:(pa.depth+pb.depth+pc.depth)/3 });
  }
  projected.sort((a,b) => b.depth - a.depth);

  for (const { face, pa, pb, pc } of projected) {
    const fill = colorFace(face, activeView, results, theme);
    ctx.beginPath();
    ctx.moveTo(pa.sx,pa.sy); ctx.lineTo(pb.sx,pb.sy); ctx.lineTo(pc.sx,pc.sy);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = theme==='light'?'rgba(0,0,0,0.08)':'rgba(255,255,255,0.06)';
    ctx.lineWidth = 0.4;
    ctx.stroke();
  }

  // CG marker — on top
  const cgFaces = buildCGMarker(params);
  const cgProj  = [];
  for (const face of cgFaces) {
    const pa=proj(face.verts[0]),pb=proj(face.verts[1]),pc=proj(face.verts[2]);
    if (!pa||!pb||!pc) continue;
    cgProj.push({ face, pa, pb, pc, depth:(pa.depth+pb.depth+pc.depth)/3 });
  }
  cgProj.sort((a,b)=>b.depth-a.depth);
  for (const { face, pa, pb, pc } of cgProj) {
    ctx.beginPath();
    ctx.moveTo(pa.sx,pa.sy); ctx.lineTo(pb.sx,pb.sy); ctx.lineTo(pc.sx,pc.sy);
    ctx.closePath();
    ctx.fillStyle = colorFace(face, activeView, results, theme);
    ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,0.5)'; ctx.lineWidth=0.8; ctx.stroke();
  }
  if (cgProj.length > 0) {
    let sx=0, sy=0, n=0;
    for (const {pa,pb,pc} of cgProj) { sx+=pa.sx+pb.sx+pc.sx; sy+=pa.sy+pb.sy+pc.sy; n+=3; }
    ctx.font=`bold ${Math.round(10*dpr)}px Inter,sans-serif`;
    ctx.fillStyle='rgb(255,50,220)';
    ctx.textAlign='center';
    ctx.fillText('CG', sx/n, sy/n - 13*dpr);
    ctx.textAlign='left';
  }

  if (activeView==='airflow' && results?.aero) drawStreamlines(ctx, proj, params, results.aero.CL, W, H);
  if (activeView==='mach'    && results?.mach?.isSupercritical) drawShockLines(ctx, proj, params, theme);
  if (activeView==='fea'     && results?.fea) drawDeflectionOverlay(ctx, proj, params, results.fea, theme);

  drawAxes(ctx, proj, W, H, theme);
  drawViewLabel(ctx, activeView, ortho, dpr, theme);
}

// ─── Grid ─────────────────────────────────────────────────────────────────────
function drawGrid(ctx, proj, cam, W, H, theme, ortho) {
  const gc = theme==='light' ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.04)';
  ctx.strokeStyle = gc; ctx.lineWidth = 0.5;
  const L = cam.target[0]; // grid centred on camera target X
  const ext = cam.distance * 1.2;
  const step = ext / 10;
  const steps = 12;
  for (let i=-steps;i<=steps;i++) {
    const xv = L + i*step;
    const zv = i*step;
    const a=proj([xv,-0.5,-ext]), b=proj([xv,-0.5, ext]);
    const c=proj([L-ext,-0.5,zv]), d=proj([L+ext,-0.5,zv]);
    if (a&&b) { ctx.beginPath(); ctx.moveTo(a.sx,a.sy); ctx.lineTo(b.sx,b.sy); ctx.stroke(); }
    if (c&&d) { ctx.beginPath(); ctx.moveTo(c.sx,c.sy); ctx.lineTo(d.sx,d.sy); ctx.stroke(); }
  }
}

// ─── Axes overlay ─────────────────────────────────────────────────────────────
function drawAxes(ctx, proj, W, H, theme) {
  const cx=58, cy=H-58, len=34;
  const axes=[{dir:[1,0,0],color:'#ef4444',label:'X'},{dir:[0,1,0],color:'#22c55e',label:'Y'},{dir:[0,0,1],color:'#3b82f6',label:'Z'}];
  ctx.fillStyle=theme==='light'?'rgba(240,242,247,0.75)':'rgba(10,13,20,0.75)';
  ctx.beginPath(); ctx.arc(cx,cy,46,0,Math.PI*2); ctx.fill();
  const op=proj([0,0,0]);
  for (const {dir,color,label} of axes) {
    const ep=proj([dir[0]*2,dir[1]*2,dir[2]*2]);
    if (!ep||!op) continue;
    const dx=ep.sx-op.sx, dy=ep.sy-op.sy, l=Math.sqrt(dx*dx+dy*dy)||1;
    const ex=cx+dx/l*len, ey=cy+dy/l*len;
    ctx.strokeStyle=color; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(ex,ey); ctx.stroke();
    ctx.fillStyle=color; ctx.font='bold 11px Inter,sans-serif';
    ctx.fillText(label, ex+3, ey+4);
  }
}

function drawViewLabel(ctx, view, ortho, dpr, theme) {
  const labels={design:'DESIGN',airflow:'AIRFLOW — Cp',fea:'FEA — STRESS',mach:'MACH / SHOCK',weight:'WEIGHT & BALANCE',polar:'POLAR'};
  const txt=(labels[view]||view.toUpperCase())+(ortho?' · ORTHO':'');
  ctx.font=`${Math.round(11*dpr)}px Inter,sans-serif`;
  ctx.fillStyle=theme==='light'?'rgba(0,0,0,0.4)':'rgba(255,255,255,0.3)';
  ctx.fillText(txt, 12*dpr, 22*dpr);
}

function drawStreamlines(ctx, proj, params, CL, W, H) {
  const {span,chord_root}=params;
  const time=Date.now()/2000;
  ctx.lineWidth=0.9;
  for (let s=0;s<14;s++) {
    const zLine=lerp(-span*0.45,span*0.45,s/13);
    const off=((time*0.2+s*0.09)%1);
    const pts=[];
    for (let t=0;t<=1;t+=0.04) {
      const xFrac=(t+off)%1;
      const xWorld=lerp(-chord_root*4,chord_root*3,xFrac);
      const xNorm=clamp(xWorld/chord_root,0,1);
      const yDefl=CL*0.3*Math.sin(Math.PI*xNorm)*(0.3+Math.abs(zLine/span));
      const p=proj([xWorld,yDefl,zLine]);
      if (p) pts.push(p);
    }
    if (pts.length<2) continue;
    const alpha=0.1+0.3*Math.abs(zLine/(span*0.5));
    ctx.strokeStyle=`rgba(59,130,246,${alpha})`;
    ctx.beginPath();
    pts.forEach((p,i)=>i===0?ctx.moveTo(p.sx,p.sy):ctx.lineTo(p.sx,p.sy));
    ctx.stroke();
  }
}

function drawShockLines(ctx, proj, params, theme) {
  const {span,chord_root}=params;
  const shockX=chord_root*0.58;
  ctx.strokeStyle='#ef4444'; ctx.lineWidth=2.5;
  for (const side of [-1,1]) {
    const p0=proj([shockX,0.1,side*span*0.12]);
    const p1=proj([shockX+0.5,0.4,side*span*0.88]);
    if (!p0||!p1) continue;
    ctx.beginPath(); ctx.moveTo(p0.sx,p0.sy); ctx.lineTo(p1.sx,p1.sy); ctx.stroke();
  }
}

function drawDeflectionOverlay(ctx, proj, params, feaR, theme) {
  const {span,chord_root,dihedral_deg}=params;
  const nodes=feaR.nodes||[];
  if (!nodes.length) return;
  const dih=(dihedral_deg||0)*DEG;
  for (const side of [-1,1]) {
    const pts=nodes.map(n=>{
      const y_span=side*n.y;
      const x_le=Math.abs(y_span)*Math.tan((params.sweep_deg||0)*DEG);
      const y_base=Math.abs(y_span)*Math.tan(dih);
      const d=(n.deflection_mm||0)/1000;
      return proj([x_le+chord_root*0.25,y_base+d,y_span]);
    }).filter(Boolean);
    if (pts.length<2) continue;
    ctx.strokeStyle=theme==='light'?'#dc2626':'#ef4444';
    ctx.lineWidth=2; ctx.setLineDash([5,3]);
    ctx.beginPath();
    pts.forEach((p,i)=>i===0?ctx.moveTo(p.sx,p.sy):ctx.lineTo(p.sx,p.sy));
    ctx.stroke(); ctx.setLineDash([]);
    for (const [i,p] of pts.entries()) {
      const norm=clamp((nodes[i]?.sigma_vm||0)/((feaR.maxStress_MPa||1)+0.001),0,1);
      ctx.fillStyle=heatColor(norm);
      ctx.beginPath(); ctx.arc(p.sx,p.sy,3,0,Math.PI*2); ctx.fill();
    }
  }
}

// ─── Toolbar button ───────────────────────────────────────────────────────────
function VBtn({label,active,onClick,title}) {
  return (
    <button title={title||label} onClick={onClick}
      className={`btn-ghost${active?' active':''}`} data-active={active}
      style={{padding:'5px 11px',fontSize:12,letterSpacing:0.3,fontWeight:500}}>
      {label}
    </button>
  );
}

// ─── Mouse helpers (shared) ───────────────────────────────────────────────────
function applyOrbit(cam, dx, dy) {
  return {
    ...cam,
    azimuth:   cam.azimuth - dx * 0.4,
    elevation: clamp(cam.elevation + dy * 0.3, -89, 89),
  };
}

function applyPan(cam, dx, dy, canvasW, canvasH) {
  // Convert pixel delta → world units using camera right & up vectors
  const eye    = sphericalToEye(cam.azimuth, cam.elevation, cam.distance, cam.target);
  const camMat = buildViewMatrix(eye, cam.target);
  // Pixels per world-unit at the target depth (ortho: use distance as proxy)
  const worldPerPx = (cam.distance * 2 * Math.tan((FOV * Math.PI / 180) / 2)) / Math.min(canvasW, canvasH);
  const mx = -dx * worldPerPx;
  const my =  dy * worldPerPx;
  const tgt = [
    cam.target[0] + camMat.r[0]*mx + camMat.u[0]*my,
    cam.target[1] + camMat.r[1]*mx + camMat.u[1]*my,
    cam.target[2] + camMat.r[2]*mx + camMat.u[2]*my,
  ];
  return { ...cam, target: tgt };
}

function applyZoom(cam, delta) {
  const factor = delta > 0 ? 1.09 : 0.92;
  return { ...cam, distance: clamp(cam.distance * factor, 1, 2000) };
}

// ─── Main Viewport ────────────────────────────────────────────────────────────
export default function Viewport({ params, activeView, results, importedModel, theme }) {
  const [viewMode, setViewMode] = useState('3d');
  const [quadMode, setQuadMode] = useState(false);
  const [cam, setCam]           = useState(() => makeCam('3d', params));
  const [fps, setFps]           = useState(60);

  const canvasRef = useRef(null);
  const animRef   = useRef(null);
  const fpsRef    = useRef({ count:0, last:performance.now() });
  const interRef  = useRef({ dragging:false, panning:false, lastX:0, lastY:0 });

  const isOrtho = viewMode !== '3d';

  // Re-fit camera whenever params change significantly (fuse_length or span)
  const prevSizeRef = useRef(null);
  useEffect(() => {
    const sig = `${params.fuse_length}|${params.span}`;
    if (sig !== prevSizeRef.current) {
      prevSizeRef.current = sig;
      setCam(prev => ({
        ...prev,
        distance: autoFitDistance(params),
        target:   aircraftCentroid(params),
      }));
    }
  }, [params.fuse_length, params.span]);

  const setView = useCallback((key) => {
    setViewMode(key);
    setQuadMode(false);
    setCam(makeCam(key, params));
  }, [params]);

  const resetCamera = useCallback(() => {
    setCam(makeCam(viewMode, params));
  }, [viewMode, params]);

  // ── Pointer handlers ──────────────────────────────────────
  const onPointerDown = useCallback((e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const panning = e.button===1 || e.button===2 || e.shiftKey;
    interRef.current = { dragging:true, panning, lastX:e.clientX, lastY:e.clientY };
  }, []);

  const onPointerMove = useCallback((e) => {
    const ir = interRef.current;
    if (!ir.dragging) return;
    const dx = e.clientX - ir.lastX, dy = e.clientY - ir.lastY;
    interRef.current.lastX = e.clientX; interRef.current.lastY = e.clientY;
    const el = e.currentTarget;
    setCam(prev => ir.panning
      ? applyPan(prev, dx, dy, el.clientWidth, el.clientHeight)
      : applyOrbit(prev, dx, dy)
    );
  }, []);

  const onPointerUp = useCallback((e) => {
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    interRef.current.dragging = false;
  }, []);

  const onWheel = useCallback((e) => {
    e.preventDefault();
    setCam(prev => applyZoom(prev, e.deltaY));
  }, []);

  const onContextMenu = useCallback((e) => e.preventDefault(), []);

  // ── Render loop ───────────────────────────────────────────
  const drawLoop = useCallback(() => {
    if (!quadMode) renderFrame(canvasRef.current, cam, params, activeView, results, importedModel, theme, isOrtho);
    fpsRef.current.count++;
    const now=performance.now();
    if (now-fpsRef.current.last>900) {
      setFps(Math.round(fpsRef.current.count*1000/(now-fpsRef.current.last)));
      fpsRef.current={count:0,last:now};
    }
    animRef.current=requestAnimationFrame(drawLoop);
  }, [cam, params, activeView, results, importedModel, theme, isOrtho, quadMode]);

  useEffect(() => {
    animRef.current = requestAnimationFrame(drawLoop);
    return () => cancelAnimationFrame(animRef.current);
  }, [drawLoop]);

  const showLegend = results && ['airflow','fea','mach'].includes(activeView);

  return (
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',background:'var(--viewport-bg)',position:'relative'}}>
      {/* Toolbar */}
      <div style={{height:40,flexShrink:0,display:'flex',alignItems:'center',padding:'0 10px',gap:4,background:'var(--bg-panel)',borderBottom:'1px solid var(--border-subtle)',boxShadow:'var(--shadow-sm)'}}>
        {[['3d','3D Perspective','3D'],['top','Top (XZ)','TOP'],['front','Front (YZ)','FRONT'],['side','Side (XY)','SIDE']].map(([k,tip,lbl])=>(
          <VBtn key={k} label={lbl} active={viewMode===k&&!quadMode} onClick={()=>setView(k)} title={tip}/>
        ))}
        <div style={{width:1,height:20,background:'var(--border-mid)',margin:'0 4px'}}/>
        <VBtn label="QUAD" active={quadMode} onClick={()=>setQuadMode(q=>!q)} title="Quad view"/>
        <div style={{width:1,height:20,background:'var(--border-mid)',margin:'0 4px'}}/>
        <button className="btn-ghost" title="Fit to view (F)" onClick={resetCamera} style={{padding:'5px 10px',fontSize:13}}>⊡</button>

        {importedModel && (
          <div style={{marginLeft:8,padding:'3px 10px',borderRadius:4,background:'rgba(234,179,8,0.12)',border:'1px solid rgba(234,179,8,0.3)',fontSize:11,color:'var(--yellow)',fontWeight:500}}>
            📎 {importedModel.name} · {importedModel.stats.triCount.toLocaleString()} tri
          </div>
        )}

        <div style={{flex:1}}/>

        {showLegend && (
          <div style={{display:'flex',alignItems:'center',gap:6,marginRight:8}}>
            <span style={{fontSize:10,color:'var(--text-muted)',fontFamily:'var(--font-mono)'}}>
              {activeView==='airflow'?'Cp':activeView==='fea'?'σ_VM':'Mach'} LOW
            </span>
            <div style={{width:80,height:7,borderRadius:3,background:'linear-gradient(90deg,#0000b4,#00b4b4,#00dc64,#dcdc00,#ff2800)'}}/>
            <span style={{fontSize:10,color:'var(--text-muted)',fontFamily:'var(--font-mono)'}}>HIGH</span>
          </div>
        )}

        <span style={{fontSize:11,color:'var(--text-muted)',fontFamily:'var(--font-mono)',marginRight:4}}>
          {viewMode.toUpperCase()} · {fps}fps
        </span>
      </div>

      {/* Canvas area */}
      <div style={{flex:1,position:'relative',overflow:'hidden'}}>
        {!quadMode ? (
          <canvas ref={canvasRef}
            style={{position:'absolute',inset:0,width:'100%',height:'100%',cursor:'grab'}}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
            onWheel={onWheel}
            onContextMenu={onContextMenu}
          />
        ) : (
          <QuadLayout params={params} activeView={activeView} results={results} importedModel={importedModel} theme={theme}/>
        )}
      </div>
    </div>
  );
}

// ─── Quad view ────────────────────────────────────────────────────────────────
const QUAD_VIEWS = [
  { key:'3d',    label:'PERSPECTIVE', ortho:false },
  { key:'top',   label:'TOP',         ortho:true  },
  { key:'front', label:'FRONT',       ortho:true  },
  { key:'side',  label:'SIDE',        ortho:true  },
];

function QuadLayout({ params, activeView, results, importedModel, theme }) {
  return (
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gridTemplateRows:'1fr 1fr',gap:2,position:'absolute',inset:0}}>
      {QUAD_VIEWS.map(v=>(
        <QuadPane key={v.key} viewKey={v.key} label={v.label} ortho={v.ortho}
          params={params} activeView={activeView} results={results}
          importedModel={importedModel} theme={theme}/>
      ))}
    </div>
  );
}

// Each quad pane has its own fully interactive camera
function QuadPane({ viewKey, label, ortho, params, activeView, results, importedModel, theme }) {
  const canvasRef = useRef(null);
  const wrapRef   = useRef(null);
  const animRef   = useRef(null);
  const interRef  = useRef({ dragging:false, panning:false, lastX:0, lastY:0 });
  const [cam, setCam] = useState(() => makeCam(viewKey, params));

  // Re-fit when aircraft size changes
  const prevSizeRef = useRef(null);
  useEffect(() => {
    const sig = `${params.fuse_length}|${params.span}`;
    if (sig !== prevSizeRef.current) {
      prevSizeRef.current = sig;
      setCam(makeCam(viewKey, params));
    }
  }, [params.fuse_length, params.span, viewKey]);

  const onPointerDown = useCallback((e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const panning = e.button===1 || e.button===2 || e.shiftKey;
    interRef.current = { dragging:true, panning, lastX:e.clientX, lastY:e.clientY };
  }, []);

  const onPointerMove = useCallback((e) => {
    const ir = interRef.current;
    if (!ir.dragging) return;
    const dx=e.clientX-ir.lastX, dy=e.clientY-ir.lastY;
    interRef.current.lastX=e.clientX; interRef.current.lastY=e.clientY;
    const el=e.currentTarget;
    setCam(prev => ir.panning
      ? applyPan(prev, dx, dy, el.clientWidth, el.clientHeight)
      : applyOrbit(prev, dx, dy)
    );
  }, []);

  const onPointerUp = useCallback((e) => {
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    interRef.current.dragging=false;
  }, []);

  const onWheel = useCallback((e) => {
    e.preventDefault();
    setCam(prev => applyZoom(prev, e.deltaY));
  }, []);

  const draw = useCallback(() => {
    const canvas=canvasRef.current, wrap=wrapRef.current;
    if (canvas && wrap) {
      const dpr=window.devicePixelRatio||1;
      const w=Math.round(wrap.clientWidth*dpr), h=Math.round(wrap.clientHeight*dpr);
      if (canvas.width!==w) canvas.width=w;
      if (canvas.height!==h) canvas.height=h;
    }
    renderFrame(canvas, cam, params, activeView, results, importedModel, theme, ortho);
    animRef.current=requestAnimationFrame(draw);
  }, [cam, params, activeView, results, importedModel, theme, ortho]);

  useEffect(() => {
    animRef.current=requestAnimationFrame(draw);
    return ()=>cancelAnimationFrame(animRef.current);
  }, [draw]);

  return (
    <div ref={wrapRef}
      style={{position:'relative',background:'var(--viewport-bg)',border:'1px solid var(--border-subtle)',overflow:'hidden',minWidth:0,minHeight:0}}>
      <canvas ref={canvasRef}
        style={{position:'absolute',inset:0,width:'100%',height:'100%',cursor:'grab'}}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onWheel={onWheel}
        onContextMenu={(e)=>e.preventDefault()}
      />
      <div style={{position:'absolute',top:6,left:8,fontSize:10,fontFamily:'var(--font-mono)',color:'var(--text-muted)',pointerEvents:'none'}}>
        {label}
      </div>
      <button
        onClick={()=>setCam(makeCam(viewKey,params))}
        style={{position:'absolute',top:4,right:6,background:'transparent',border:'none',color:'var(--text-muted)',cursor:'pointer',fontSize:14,lineHeight:1,padding:'2px 4px'}}
        title="Reset this pane">⊡</button>
    </div>
  );
}
