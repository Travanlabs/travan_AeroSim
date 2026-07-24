# Travan Aero Simulator v2.0
### Professional Aerospace Analysis Suite — ARAeS Edition

> **Author:** Dickson Tawiah Aman, BEng (Aerospace, 1st Class Honours), ARAeS  
> **Company:** Travan Engineering / RhoPhi Holdings (UK & Ghana)

---

## Quick Start

```bash
# Requires Node.js 20.20.2  /  npm 10.8.2
npm install          # ~60 seconds
npm run build        # ~5 seconds
npm start            # Opens the desktop application
```

## Build Windows Installer

```bash
npm run dist
# → dist-electron/TravanAeroSimulator-2.0.0-Setup.exe
```

## Features

| Module | Capability |
|--------|-----------|
| **Wing Design** | Parametric geometry: span, chord, sweep, dihedral, twist, airfoil |
| **STL/OBJ Import** | Parse binary/ASCII STL, Wavefront OBJ, Assembly JSON |
| **Airflow (CFD)** | Vortex-lattice panel method + Prandtl-Glauert, Cp distribution |
| **FEA** | Euler-Bernoulli beam, box spar, stress field, tip deflection, flutter |
| **Mach/Shock** | Küchemann Mcrit, normal shock, oblique shock, wave drag |
| **Polar Sweep** | Full α sweep, best L/D, CLmax detection |
| **Weight & Balance** | MTOW, fuel, payload, wing loading |
| **3D Views** | Perspective, Top, Side, Front, Quad split — all with colour overlays |
| **Reports** | 8-section performance report, TXT export, scoring system |

## Views

- **3D Perspective** — drag to rotate, scroll to zoom
- **Top / Side / Front** — true orthographic with ortho projection
- **Quad** — all four simultaneously
- **Colour modes** — pressure Cp, Von Mises stress, Mach zone, per module

## Engines (pure JS, zero runtime dependencies)

```
atmosphere.js   → ISA (ICAO Doc 7488)
aerodynamics.js → Lifting-line + Prandtl-Glauert + polar sweep
fea.js          → Euler-Bernoulli beam FEA + flutter estimate
mach.js         → Normal/oblique shock + Prandtl-Meyer + wave drag
geometry.js     → STL/OBJ/Assembly parser + painter's-algo renderer
```

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Desktop runtime | Electron 29 |
| UI framework | React 18 |
| Build tool | Vite 5 |
| 3D rendering | Canvas2D (no WebGL dependency) |
| Packaging | electron-builder 24 (NSIS installer) |
| Logging | electron-log |

## Geometry Import

Supports `.stl` (ASCII & binary), `.obj`, `.json` assembly files.  
Auto-extracts: span, chord, t/c, aspect ratio, surface area.  
Renders with depth-sorted painter's algorithm + Phong shading.

## See Also

📖 **DEPLOYMENT_MANUAL.txt** — Full engineering & deployment documentation  
⌨️  **F5** — Run simulation  |  **Ctrl+S** — Save design  |  **Ctrl+E** — Export report
