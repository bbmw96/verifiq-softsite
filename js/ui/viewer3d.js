// VERIFIQ v2.1 - 3D Viewer with correct web-ifc API
// Based on official Three.js IFCLoader source (github.com/mrdoob/three.js)
// StreamAllMeshes -> GetGeometry -> GetVertexArray/GetIndexArray pattern
'use strict';

const Viewer3DPage = (() => {

  // ── Private state ──────────────────────────────────────────────────────────
  let _scene=null,_camera=null,_renderer=null,_animFrame=null;
  let _meshMap=new Map(),_guidMap=new Map();
  let _selected=null,_selectedSet=new Set();
  let _phi=Math.PI/3,_theta=Math.PI/4,_dist=80,_target={x:0,y:0,z:0};
  let _isDragging=false,_mouseBtn=-1,_last={x:0,y:0};
  let _raycaster=null,_mouse=null;
  let _colorMode='type',_wireMode=false,_xrayMode=false,_fullscreen=false;
  let _measureMode=false,_measurePts=[],_measureLines=[],_measureLabels=[];
  let _ifcApi=null,_modelId=null,_usingWebIfc=false;
  let _colorBySev={Critical:true,Error:true,Warning:true,Pass:true};
  let _elemListForTree=[];
  const SCOL={Critical:0xEF4444,Error:0xF97316,Warning:0xEAB308,Pass:0x22C55E,NoCheck:0x94A3B8};

  // ── HTML template ──────────────────────────────────────────────────────────
  function render() {
    const st = VState.get();
    const files = st.filesLoaded||[];
    if(!files.length) return `<div style="display:flex;align-items:center;justify-content:center;height:100%;flex-direction:column;gap:12px;color:#6b8faf">
      <div style="font-size:48px">🏗️</div>
      <div style="font-size:15px;font-weight:700;color:#f0f4fb">No IFC file loaded</div>
      <div style="font-size:13px">Open an IFC file to view it in 3D</div>
      <button onclick="VBridge.openFile()" style="padding:10px 24px;background:#00c4a0;color:#000;border:none;border-radius:8px;font-weight:700;cursor:pointer;font-size:13px">Open IFC File</button>
    </div>`;

    const B='background:#0e2035;border:1px solid #1a3354;border-radius:4px;padding:4px 8px;cursor:pointer;font-size:12px;color:#8aaac8;font-family:Segoe UI Emoji,Segoe UI,sans-serif';
    const S='background:#060d1b;border:1px solid #0f1e30;border-radius:4px;padding:2px 6px;font-size:10px;color:#5b7fa6;cursor:pointer';
    return `<div id="v-wrap" style="display:flex;flex-direction:column;height:calc(100vh - 110px);background:#0d1117;overflow:hidden">

  <!-- Toolbar -->
  <div style="display:flex;align-items:center;flex-wrap:wrap;gap:3px;padding:5px 8px;background:#071220;border-bottom:1px solid #0f1e30;flex-shrink:0">
    <button onclick="Viewer3DPage.resetCamera()" title="Reset view" style="${B}">⟳ Reset</button>
    <button onclick="Viewer3DPage.fitToView()"   title="Fit to view [I]" style="${B}">⊡ Fit</button>
    <button onclick="Viewer3DPage.loadFullGeometry()" id="v-btn-load3d" title="Load real IFC geometry (web-ifc)" style="${B}">🔄 Load 3D</button>
    <span style="width:1px;height:20px;background:#1a3354;margin:0 3px"></span>
    <button onclick="Viewer3DPage.setView('top')"   title="Top view"   style="${B}">⬜</button>
    <button onclick="Viewer3DPage.setView('front')" title="Front view" style="${B}">▭</button>
    <button onclick="Viewer3DPage.setView('iso')"   title="Iso view"   style="${B}">⬛</button>
    <span style="width:1px;height:20px;background:#1a3354;margin:0 3px"></span>
    <button onclick="Viewer3DPage.toggleWire()"   id="v-btn-wire"  title="Wireframe" style="${B}">⬡</button>
    <button onclick="Viewer3DPage.toggleXray()"   id="v-btn-xray"  title="X-Ray"    style="${B}">🔍</button>
    <button onclick="Viewer3DPage.showAll()"                        title="Show all" style="${B}">◎</button>
    <select id="v-colmode" onchange="Viewer3DPage.setColorMode(this.value)" style="${S}">
      <option value="type" selected>By IFC Type</option>
      <option value="compliance">By Compliance</option>
      <option value="storey">By Storey</option>
    </select>
    <span style="width:1px;height:20px;background:#1a3354;margin:0 3px"></span>
    <button onclick="Viewer3DPage.enterFullscreen()" title="Fullscreen [F]" style="${B}">⛶</button>
    <button onclick="Viewer3DPage.toggleMeasure()" id="v-btn-measure" title="Distance measurement - click two points" style="${B}">📏 Measure</button>
    <button onclick="Viewer3DPage.clearMeasures()" title="Clear all measurements" style="${B}">✕ Measures</button>
    <div style="flex:1"></div>
    <span id="v-engine" style="font-size:11px;color:#94a3b8;font-style:italic">Initialising...</span>
  </div>

  <!-- Section row -->
  <div style="display:flex;align-items:center;gap:6px;padding:3px 8px;background:#060d1b;border-bottom:1px solid #0f1e30;flex-shrink:0;font-size:10px;color:#6b8faf;flex-wrap:wrap">
    <b>SECTION</b>
    <label style="display:flex;align-items:center;gap:4px"><input type="checkbox" id="v-sec-x" onchange="Viewer3DPage.toggleSection('x',this.checked)"> Cut X</label>
    <input type="range" min="0" max="100" value="50" oninput="Viewer3DPage.updateSection('x',+this.value)" style="width:70px">
    <label style="display:flex;align-items:center;gap:4px"><input type="checkbox" id="v-sec-y" onchange="Viewer3DPage.toggleSection('y',this.checked)"> Cut Y</label>
    <input type="range" min="0" max="100" value="50" oninput="Viewer3DPage.updateSection('y',+this.value)" style="width:70px">
    <label style="display:flex;align-items:center;gap:4px"><input type="checkbox" id="v-sec-z" onchange="Viewer3DPage.toggleSection('z',this.checked)"> Cut Z</label>
    <input type="range" min="0" max="100" value="50" oninput="Viewer3DPage.updateSection('z',+this.value)" style="width:70px">
    <button onclick="Viewer3DPage.clearSections()" style="${B};padding:2px 6px;font-size:10px">Clear</button>
    <b style="margin-left:8px">STOREY</b>
    <select id="v-storey" onchange="Viewer3DPage.filterByStorey(this.value)" style="${S}"><option value="">All Storeys</option></select>
    <b>DISC</b>
    ${['ARC','STR','MEP','EXT'].map(d=>`<label style="display:flex;align-items:center;gap:3px"><input type="checkbox" checked onchange="Viewer3DPage.filterDisc('${d}',this.checked)"><span>${d}</span></label>`).join('')}
  </div>

  <!-- Main 3-panel layout -->
  <div style="flex:1;display:flex;min-height:0;overflow:hidden">

    <!-- IFC tree panel -->
    <div id="v-tree-panel" style="width:190px;min-width:190px;background:#071220;border-right:1px solid #1a3354;overflow-y:auto;flex-shrink:0;font-size:12px">
      <div style="padding:8px 10px;font-size:10px;font-weight:700;color:#9ab8d4;text-transform:uppercase;letter-spacing:.06em;background:#060d1b;border-bottom:1px solid #1a3354;display:flex;justify-content:space-between;align-items:center">
        IFC Structure
        <button onclick="Viewer3DPage.selectAll()" style="font-size:9px;padding:1px 5px;border:1px solid #1a3354;background:#0d1e30;border-radius:3px;cursor:pointer;color:#9ab8d4">All</button>
      </div>
      <div id="v-tree" style="padding:6px;color:#9ab8d4">Load a model to see IFC structure.</div>
    </div>

    <!-- Canvas -->
    <div id="v-canvas-wrap" style="flex:1;position:relative;background:#0d1117;min-width:0">
      <canvas id="v-canvas" style="display:block;width:100%;height:100%"></canvas>
      <div id="v-overlay" style="position:absolute;inset:0;pointer-events:none;z-index:5"></div>
      <div id="v-status" style="position:absolute;bottom:6px;left:10px;font-size:10px;color:#94a3b8;pointer-events:none;font-family:monospace">
        L.drag:orbit | R.drag:pan | Scroll:zoom | Click:select | I:fit | F:fullscreen
      </div>
    </div>

    <!-- Right panel -->
    <div style="width:190px;min-width:190px;background:#071220;border-left:1px solid #1a3354;overflow-y:auto;flex-shrink:0">
      <div style="padding:10px">
        <div style="font-size:10px;font-weight:700;color:#9ab8d4;text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px">Compliance</div>
        ${[['Critical','#EF4444'],['Error','#F97316'],['Warning','#EAB308'],['Pass','#22C55E'],['Not Checked','#94A3B8']].map(([s,c])=>
          `<label style="display:flex;align-items:center;gap:6px;font-size:12px;color:#9ab8d4;margin-bottom:5px;cursor:pointer">
            <input type="checkbox" checked onchange="Viewer3DPage.toggleSev('${s}',this.checked)">
            <span style="width:12px;height:12px;background:${c};border-radius:2px;flex-shrink:0;display:inline-block"></span>${s}
          </label>`).join('')}
      </div>
      <div style="padding:10px;border-top:1px solid #1a3354">
        <div style="font-size:10px;font-weight:700;color:#9ab8d4;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">Element Inspector</div>
        <div id="v-inspector" style="font-size:11px;color:#6b8faf">Click an element to inspect it.</div>
      </div>
      <div style="padding:10px;border-top:1px solid #1a3354">
        <div style="font-size:10px;font-weight:700;color:#9ab8d4;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">Model Statistics</div>
        <div id="v-stats">${_buildStats(VState.get().session)}</div>
      </div>
    </div>
  </div>
</div>`;
  }

  function _buildStats(sess) {
    if(!sess) return '<span style="color:#94a3b8;font-size:11px">Run validation to see stats.</span>';
    const t=sess.totalElements||sess.total||0,cr=sess.criticalElements||sess.critical||0,
          er=sess.errorElements||sess.errors||0,wa=sess.warningElements||sess.warnings||0,
          pa=sess.passedElements||sess.passed||0,sc=typeof sess.score==='number'?sess.score.toFixed(1)+'%':'';
    return `<table style="width:100%;border-collapse:collapse;font-size:11px">
      <tr><td style="color:#9ab8d4;padding:2px 0">Total</td><td style="text-align:right;font-weight:700;color:#f0f4fb">${t.toLocaleString()}</td></tr>
      <tr><td style="color:#EF4444">Critical</td><td style="text-align:right;font-weight:700;color:#EF4444">${cr.toLocaleString()}</td></tr>
      <tr><td style="color:#F97316">Errors</td><td style="text-align:right;font-weight:700;color:#F97316">${er.toLocaleString()}</td></tr>
      <tr><td style="color:#EAB308">Warnings</td><td style="text-align:right;font-weight:700;color:#EAB308">${wa.toLocaleString()}</td></tr>
      <tr><td style="color:#22C55E">Pass</td><td style="text-align:right;font-weight:700;color:#22C55E">${pa.toLocaleString()}</td></tr>
      ${sc?`<tr><td style="color:#9ab8d4">Score</td><td style="text-align:right;font-weight:700;color:#00c8a8">${sc}</td></tr>`:''}
    </table>`;
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  function onNavigate() {
    if(_animFrame){cancelAnimationFrame(_animFrame);_animFrame=null;}
    // Wire fullscreen-change listener once (idempotent via named function ref)
    document.removeEventListener('fullscreenchange',_onFsChange);
    document.removeEventListener('webkitfullscreenchange',_onFsChange);
    document.addEventListener('fullscreenchange',_onFsChange);
    document.addEventListener('webkitfullscreenchange',_onFsChange);
    setTimeout(_boot,120);
  }

  function _boot() {
    const wrap=document.getElementById('v-canvas-wrap');
    if(!wrap){setTimeout(_boot,100);return;}
    const W=wrap.clientWidth||wrap.offsetWidth||0;
    const H=wrap.clientHeight||wrap.offsetHeight||0;
    if(W<50||H<50){setTimeout(_boot,100);return;}
    _init3D(W,H);
    // Auto-load real web-ifc geometry when a file is present; fall back to placeholders
    const files=VState.get().filesLoaded||[];
    if(files.length>0){
      // Web: render the real tessellated model with web-ifc when the uploaded bytes are
      // available; otherwise fall back to the parser's box geometry (Load 3D stays available).
      const store=window.__vqIfcFiles||{};
      if(store[files[0].name]||store[window.__vqLastIfc]){
        loadFullGeometry();
      } else {
        loadElements();
      }
    } else {
      _loadPlaceholders();
    }
  }

  function _init3D(W,H) {
    if(typeof THREE==='undefined'){_setEngine('ERROR: THREE.js not loaded');return;}
    const cv=document.getElementById('v-canvas');
    if(!cv)return;
    if(_renderer){try{_renderer.dispose();}catch(e){}}_renderer=null;
    _scene=new THREE.Scene();
    _scene.background=new THREE.Color(0x0d1117);
    _camera=new THREE.PerspectiveCamera(45,W/H,0.01,100000);
    _camera.position.set(50,40,50);_camera.lookAt(0,0,0);
    _renderer=new THREE.WebGLRenderer({canvas:cv,antialias:true,alpha:false});
    _renderer.setSize(W,H,false);
    _renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
    _renderer.shadowMap.enabled=false;
    _raycaster=new THREE.Raycaster();
    _mouse=new THREE.Vector2();
    // Lights - tuned for white background
    _scene.add(new THREE.AmbientLight(0xffffff,0.5));
    const d1=new THREE.DirectionalLight(0xffffff,0.8);d1.position.set(100,200,100);_scene.add(d1);
    const d2=new THREE.DirectionalLight(0xddeeff,0.4);d2.position.set(-100,-50,-100);_scene.add(d2);
    // Grid
    const g=new THREE.GridHelper(500,50,0x1a2840,0x0f1e30);g.name='__grid';_scene.add(g);
    // Events
    cv.addEventListener('mousedown',_md);cv.addEventListener('mousemove',_mm);
    cv.addEventListener('mouseup',_mu);cv.addEventListener('wheel',_mw,{passive:false});
    cv.addEventListener('click',_click);cv.addEventListener('dblclick',()=>{if(_selected)zoomToSelected();});
    cv.addEventListener('contextmenu',e=>e.preventDefault());
    document.addEventListener('keydown',_key);
    const _wrap2=document.getElementById('v-canvas-wrap');
    const ro=new ResizeObserver(()=>{
      const ww=_wrap2?(_wrap2.clientWidth||_wrap2.offsetWidth):0,hh=_wrap2?(_wrap2.clientHeight||_wrap2.offsetHeight):0;
      if(ww>10&&hh>10&&_renderer&&_camera){
        _renderer.setSize(ww,hh,false);_camera.aspect=ww/hh;_camera.updateProjectionMatrix();
      }
    });if(_wrap2)ro.observe(_wrap2);
    _loop();
    _setEngine('C# geometry engine');
  }

  // ── Load placeholder boxes from C# element list ────────────────────────────
  function _loadPlaceholders() {
    const elems=VState.get().elements3d||[];
    if(elems.length>0){_buildBoxes(elems);}
    else{
      VBridge.send('requestGeometry',{});
      setTimeout(()=>{const e2=VState.get().elements3d||[];if(e2.length>0)_buildBoxes(e2);
        else _setStatus('No geometry data. Load an IFC file and run validation.');},1200);
    }
  }

  function loadElements(){_loadPlaceholders();}

  function _buildBoxes(elems) {
    if(!_scene)return;
    _clearMeshes();
    const mat=new THREE.MeshPhongMaterial({vertexColors:false,shininess:30,side:THREE.DoubleSide});
    let n=0;
    elems.forEach((e,idx)=>{
      const guid=e.g||e.guid||'';
      const name=e.n||e.name||'';
      const cls =e.c||e.cls||'';
      const stry=e.s||e.storey||'';
      const b   =e.b;
      const msh =e.m;
      let mesh=null;

      if(msh&&msh.v&&msh.v.length>=9){
        // Real mesh from C# parser
        const geo=new THREE.BufferGeometry();
        geo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(msh.v),3));
        if(msh.i&&msh.i.length)geo.setIndex(Array.from(msh.i));
        geo.computeVertexNormals();
        mesh=new THREE.Mesh(geo,mat.clone());
        mesh.material.color.setHex(_typeCol(cls));
      } else if(b&&b.length===6){
        // Bbox from parser
        const [x0,y0,z0,x1,y1,z1]=b;
        const W=Math.abs(x1-x0)||0.3,H2=Math.abs(z1-z0)||0.3,D=Math.abs(y1-y0)||0.3;
        mesh=new THREE.Mesh(new THREE.BoxGeometry(W,H2,D),mat.clone());
        mesh.material.color.setHex(_typeCol(cls));
        mesh.position.set((x0+x1)/2,(z0+z1)/2,(y0+y1)/2);
      } else {
        // Synthetic - spread in grid by storey
        const si=_si(stry);
        const gx=(idx%20)*4-40, gz=Math.floor(idx/20)*4-40, gy=si*4;
        const [sw,sh,sd]=_tsz(cls);
        mesh=new THREE.Mesh(new THREE.BoxGeometry(sw,sh,sd),mat.clone());
        mesh.material.color.setHex(_typeCol(cls));
        mesh.position.set(gx+sw/2,gy+sh/2,gz+sd/2);
      }
      mesh.userData={guid,name,cls,storey:stry,ifcType:cls.split('|')[0]||cls};
      const key=guid||(n+'');
      _meshMap.set(key,mesh);_guidMap.set(mesh.uuid,key);
      _scene.add(mesh);n++;
    });
    _centreModel();
    _buildTree(elems);
    _fillStoreys(elems);
    _applyCol();
    _fit();
    _setEngine('C# engine ('+n+' elements)');
    _refreshStats();
    if(_renderer&&_scene&&_camera)_renderer.render(_scene,_camera);
  }

  // Translate every element mesh so the model centre sits at the world origin.
  // IFC models are placed at real survey coordinates (e.g. Singapore SVY21, tens of
  // thousands of millimetres out), which makes WebGL float precision jitter and can
  // push the model outside the camera frustum. Centring keeps it crisp and on-screen.
  function _centreModel(){
    if(!_scene)return;
    _scene.updateMatrixWorld(true);
    const box=new THREE.Box3();
    _scene.traverse(o=>{if(o.isMesh&&!o.name.startsWith('__'))box.expandByObject(o);});
    if(box.isEmpty())return;
    const c=box.getCenter(new THREE.Vector3());
    _scene.traverse(o=>{if(o.isMesh&&!o.name.startsWith('__'))o.position.sub(c);});
    _scene.updateMatrixWorld(true);
  }

  function _clearMeshes(){
    if(!_scene)return;
    const rm=[];
    _scene.traverse(o=>{if(o.isMesh&&!o.name.startsWith('__'))rm.push(o);});
    rm.forEach(m=>{m.geometry.dispose();if(m.material)m.material.dispose();_scene.remove(m);});
    _meshMap.clear();_guidMap.clear();_selected=null;_selectedSet.clear();
    if(!_scene.getObjectByName('__grid')){const g=new THREE.GridHelper(500,50,0x1a2840,0x0f1e30);g.name='__grid';_scene.add(g);}
  }

  // ── web-ifc real geometry via virtual host URL ─────────────────────────────
  // Uses the exact pattern from Three.js official IFCLoader:
  // StreamAllMeshes -> GetGeometry -> GetVertexArray + GetIndexArray -> BufferGeometry
  let _loadingGeometry=false;
  async function loadFullGeometry() {
    if(_loadingGeometry)return;
    const files=VState.get().filesLoaded||[];
    if(!files.length){_setStatus('No IFC file loaded.');return;}
    // Web build (no WebView2 host): feed the uploaded IFC bytes straight to web-ifc - there
    // is no virtual host URL to request. The desktop path (sendIfcForViewer) follows below.
    const store=window.__vqIfcFiles||{};
    const webBytes=store[files[0].name]||store[window.__vqLastIfc];
    if(webBytes){
      _loadingGeometry=true;
      const wb=document.getElementById('v-btn-load3d');
      if(wb){wb.textContent='Loading...';wb.disabled=true;}
      try{
        _setStatus('Parsing IFC geometry with web-ifc...');
        await _renderWebIfc(webBytes,files[0].schema||'');
        if(wb){wb.textContent='✓ 3D Loaded';wb.disabled=false;}
      }catch(err){
        console.error('[VERIFIQ 3D] web-ifc (web) failed:',err);
        _setStatus('web-ifc failed: '+err.message+'. Showing placeholder geometry.');
        if(wb){wb.textContent='🔄 Load 3D';wb.disabled=false;}
        _loadPlaceholders();
      }finally{_loadingGeometry=false;}
      return;
    }
    _loadingGeometry=true;
    const btn=document.getElementById('v-btn-load3d');
    if(btn){btn.textContent='Loading...';btn.disabled=true;}
    _setStatus('Requesting IFC file for real geometry...');
    _setEngine('web-ifc (requesting file...)');
    VBridge.send('sendIfcForViewer',{name:files[0].name});
    setTimeout(()=>{if(btn&&btn.disabled){btn.textContent='🔄 Load 3D';btn.disabled=false;}},90000);
  }

  // Called by bridge when C# sends virtual host URL
  async function onIfcFileUrl(data) {
    const btn=document.getElementById('v-btn-load3d');
    if(data.error){
      _setStatus('File error: '+data.error);
      if(btn){btn.textContent='🔄 Load 3D';btn.disabled=false;}
      return;
    }
    _setStatus('Fetching IFC file...');
    try {
      const resp=await fetch(data.url);
      if(!resp.ok)throw new Error('HTTP '+resp.status+' fetching IFC file');
      const buf=await resp.arrayBuffer();
      _setStatus('Parsing IFC geometry with web-ifc...');
      await _renderWebIfc(new Uint8Array(buf),data.schema||'');
      if(btn){btn.textContent='✓ 3D Loaded';btn.disabled=false;}
    } catch(err) {
      console.error('[VERIFIQ 3D] onIfcFileUrl failed:',err);
      _setStatus('web-ifc failed: '+err.message+'. Showing placeholder geometry.');
      if(btn){btn.textContent='🔄 Load 3D';btn.disabled=false;}
      _loadPlaceholders();
    } finally {
      _loadingGeometry=false;
    }
  }

  // Fallback: C# sends base64
  async function onIfcData(data) {
    if(data.error){_setStatus('Error: '+data.error);return;}
    try {
      _setStatus('Decoding IFC data...');
      const bin=atob(data.data||'');
      const bytes=new Uint8Array(bin.length);
      for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
      await _renderWebIfc(bytes,data.schema||'');
    } catch(err) {
      console.error('[VERIFIQ 3D] onIfcData failed:',err);
      _setStatus('Parse error: '+err.message);
      _loadPlaceholders();
    }
  }

  // Core web-ifc render - full-geometry: fast booleans + per-element isolation + secondary type pass
  async function _renderWebIfc(bytes, schema) {
    if (typeof WebIFC === 'undefined') {
      _setStatus('web-ifc engine not loaded');
      _loadPlaceholders(); return;
    }
    try {
      if (!_ifcApi) {
        _ifcApi = new WebIFC.IfcAPI();
        try {
          // WebView2 virtual host doesn't serve .wasm with application/wasm
          // MIME type, so the browser's WASM loader rejects the fetch.
          // Fix: fetch the binary ourselves (fetch() ignores MIME), wrap it in
          // a Blob (browser serves Blob URLs with correct MIME type), then pass
          // a locateFile handler so web-ifc loads from the Blob URL instead.
          const wasmResp = await fetch('/libs/web-ifc.wasm');
          if (!wasmResp.ok) throw new Error('WASM fetch HTTP ' + wasmResp.status);
          const wasmBuf = await wasmResp.arrayBuffer();
          const wasmUrl = URL.createObjectURL(new Blob([wasmBuf], { type: 'application/wasm' }));
          await _ifcApi.Init((path) => wasmUrl, true /* forceSingleThread */);
        } catch(initErr) {
          _ifcApi = null;
          throw new Error('WASM init failed: ' + initErr.message);
        }
      }
      if (_modelId !== null) {
        try { _ifcApi.CloseModel(_modelId); } catch(e) {}
        _modelId = null;
      }
      // USE_FAST_BOOLS:true - approximate CSG booleans succeed on complex door/window voids
      // that exact booleans fail silently, causing missing walls, slabs and facade elements.
      _modelId = _ifcApi.OpenModel(bytes, {
        OPTIMIZE_PROFILES: true,
        COORDINATE_TO_ORIGIN: true,
        USE_FAST_BOOLS: true,
        MEMORY_LIMIT: 2147483648
      });
      _clearMeshes();
      _elemListForTree = [];
      let meshCount = 0, skipCount = 0;
      const processedIds = new Set();

      const _processFlatMesh = function(flatMesh) {
        if (processedIds.has(flatMesh.expressID)) return;
        processedIds.add(flatMesh.expressID);
        const n = flatMesh.geometries.size();
        for (let g = 0; g < n; g++) {
          try {
            const pg  = flatMesh.geometries.get(g);
            const ig  = _ifcApi.GetGeometry(_modelId, pg.geometryExpressID);
            const va  = _ifcApi.GetVertexArray(ig.GetVertexData(), ig.GetVertexDataSize());
            const ia  = _ifcApi.GetIndexArray(ig.GetIndexData(), ig.GetIndexDataSize());
            ig.delete();

            if (!va || va.length < 6) { skipCount++; continue; }

            // Vertex format from web-ifc: x,y,z,nx,ny,nz (6 floats per vertex)
            const vcount = va.length / 6;
            const pos = new Float32Array(vcount * 3);
            const nrm = new Float32Array(vcount * 3);
            for (let i = 0, j = 0; i < va.length; i += 6, j += 3) {
              pos[j]   = va[i];   pos[j+1] = va[i+1]; pos[j+2] = va[i+2];
              nrm[j]   = va[i+3]; nrm[j+1] = va[i+4]; nrm[j+2] = va[i+5];
            }
            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
            geo.setAttribute('normal',   new THREE.BufferAttribute(nrm, 3));
            if (ia && ia.length) geo.setIndex(new THREE.BufferAttribute(new Uint32Array(ia), 1));

            const rgba = pg.color;
            const alpha = rgba.w;
            const mat = new THREE.MeshPhongMaterial({
              color:       new THREE.Color(rgba.x, rgba.y, rgba.z),
              opacity:     alpha,
              transparent: alpha < 0.99,
              side:        THREE.DoubleSide,
              shininess:   30
            });

            const mesh = new THREE.Mesh(geo, mat);
            mesh.matrix.fromArray(pg.flatTransformation);
            mesh.matrixAutoUpdate = false;

            var guid = '', name = '', cls = '';
            try {
              var ln = _ifcApi.GetLine(_modelId, flatMesh.expressID, false);
              if (ln) {
                guid = (ln.GlobalId && ln.GlobalId.value) ? ln.GlobalId.value : '';
                name = (ln.Name    && ln.Name.value)    ? ln.Name.value    : '';
                cls  = ln.constructor ? ln.constructor.name : '';
              }
            } catch(e) {}

            mesh.userData = { guid, name, cls, storey:'', ifcType:cls, expressId: flatMesh.expressID,
                              origColor: { r: rgba.x, g: rgba.y, b: rgba.z, a: rgba.w } };
            var key = guid || ('ex_' + flatMesh.expressID);
            _meshMap.set(key, mesh);
            _guidMap.set(mesh.uuid, key);
            _scene.add(mesh);
            meshCount++;
            if (guid && meshCount === 1 || !processedIds.has(flatMesh.expressID + '_listed')) {
              processedIds.add(flatMesh.expressID + '_listed');
              if (guid) _elemListForTree.push({ g: guid, n: name, c: cls, s: '' });
            }
          } catch(e) {
            skipCount++;
            console.warn('[VERIFIQ 3D] geom skip expressID=' + flatMesh.expressID + ' g=' + g, e.message);
          }
        }
      };

      _setStatus('Loading geometry...');
      _ifcApi.StreamAllMeshes(_modelId, _processFlatMesh);

      // Secondary pass: types occasionally absent from StreamAllMeshes primary stream
      var _wt = WebIFC;
      var secondaryTypes = [
        _wt.IFCSPACE, _wt.IFCBUILDINGELEMENTPROXY, _wt.IFCTRANSPORTELEMENT,
        _wt.IFCSITE, _wt.IFCCIVILELEMENT, _wt.IFCVIRTUALELEMENT
      ].filter(function(t) {
        if (t == null) return false;
        try { var ids = _ifcApi.GetLineIDsWithType(_modelId, t); return ids && ids.size() > 0; }
        catch(e) { return false; }
      });
      if (secondaryTypes.length > 0) {
        try { _ifcApi.StreamAllMeshesWithTypes(_modelId, secondaryTypes, _processFlatMesh); }
        catch(e) { console.warn('[VERIFIQ 3D] secondary pass failed:', e.message); }
      }

      _usingWebIfc = true;
      _setEngine('web-ifc · ' + (schema || 'IFC') + ' · ' + meshCount.toLocaleString() + ' meshes');
      _setStatus('Model loaded: ' + meshCount.toLocaleString() + ' meshes' + (skipCount ? ' (' + skipCount + ' skipped)' : ''));
      // Storey assignment: query spatial containment relationships
      _assignStoreys();
      // Populate IFC tree and storey filter from element list gathered during stream
      if (_elemListForTree.length > 0) {
        _buildTree(_elemListForTree);
        _fillStoreys(_elemListForTree);
      }
      _applyCol();
      // Update world matrices before _fit() - meshes use matrixAutoUpdate=false so
      // matrixWorld stays at identity until explicitly propagated. Without this,
      // Box3.expandByObject computes a zero-size box and the camera doesn't move.
      _scene.updateMatrixWorld(true);
      _centreModel();
      _fit();
      _refreshStats();
      // Apply any pending compliance colors if validation results arrived before 3D load
      const pendingSevs = VState.get().elementSeverities;
      if (pendingSevs && Object.keys(pendingSevs).length > 0) _applyCol();
      if (_renderer && _scene && _camera) _renderer.render(_scene, _camera);
    } catch(err) {
      console.error('[VERIFIQ 3D] web-ifc error:', err);
      _setStatus('web-ifc failed: ' + err.message + ' - showing placeholders');
      _loadPlaceholders();
    }
  }


  function _fit(){
    if(!_scene||!_camera)return;
    _scene.updateMatrixWorld(true);
    const box=new THREE.Box3();let n=0;
    _scene.traverse(o=>{if(o.isMesh&&!o.name.startsWith('__')){box.expandByObject(o);n++;}});
    if(!n||box.isEmpty()){_camera.position.set(50,40,50);_camera.lookAt(0,0,0);return;}
    const c=box.getCenter(new THREE.Vector3()),s=box.getSize(new THREE.Vector3());
    const md=Math.max(s.x,s.y,s.z,1);
    const dist=md*2.2;
    _dist=dist;_target={x:c.x,y:c.y,z:c.z};
    _camera.position.set(c.x+dist*.7,c.y+dist*.5,c.z+dist*.7);
    _camera.lookAt(c.x,c.y,c.z);
    _camera.near=Math.max(0.001,md*0.0001);_camera.far=md*200;
    _camera.updateProjectionMatrix();
    if(_renderer&&_scene)_renderer.render(_scene,_camera);
  }
  function fitToView(){_fit();}
  function resetCamera(){_fit();}
  function setView(v){
    if(!_camera)return;
    const t=new THREE.Vector3(_target.x,_target.y,_target.z),d=_dist||50;
    ({top:()=>_camera.position.set(t.x,t.y+d,t.z),
      front:()=>_camera.position.set(t.x,t.y,t.z+d),
      right:()=>_camera.position.set(t.x+d,t.y,t.z),
      back:()=>_camera.position.set(t.x,t.y,t.z-d),
      iso:()=>_camera.position.set(t.x+d*.7,t.y+d*.5,t.z+d*.7)})[v]?.();
    _camera.lookAt(t.x,t.y,t.z);
  }
  function zoomToSelected(){
    if(!_selected||!_camera)return;
    const box=new THREE.Box3().setFromObject(_selected);
    const c=box.getCenter(new THREE.Vector3()),s=box.getSize(new THREE.Vector3());
    const d=Math.max(s.x,s.y,s.z,1)*3;
    _target={x:c.x,y:c.y,z:c.z};_dist=d;
    _camera.position.set(c.x+d*.7,c.y+d*.5,c.z+d*.7);_camera.lookAt(c.x,c.y,c.z);
  }

  // ── Mouse ──────────────────────────────────────────────────────────────────
  function _md(e){_isDragging=true;_mouseBtn=e.button;_last={x:e.clientX,y:e.clientY};}
  function _mu(){_isDragging=false;_mouseBtn=-1;}
  function _mm(e){
    if(!_isDragging)return;
    const dx=e.clientX-_last.x,dy=e.clientY-_last.y;
    _last={x:e.clientX,y:e.clientY};
    if(_mouseBtn===0){
      _theta-=dx*0.008;_phi-=dy*0.008;
      _phi=Math.max(0.05,Math.min(Math.PI-0.05,_phi));
      _camera.position.set(
        _target.x+_dist*Math.sin(_phi)*Math.sin(_theta),
        _target.y+_dist*Math.cos(_phi),
        _target.z+_dist*Math.sin(_phi)*Math.cos(_theta));
      _camera.lookAt(_target.x,_target.y,_target.z);
    } else if(_mouseBtn===2){
      const r=new THREE.Vector3(),u=new THREE.Vector3();
      _camera.getWorldDirection(r);r.cross(_camera.up).normalize();u.copy(_camera.up);
      const spd=_dist*0.001;
      _target.x-=(r.x*dx-u.x*dy)*spd;_target.y-=(r.y*dx-u.y*dy)*spd;_target.z-=(r.z*dx-u.z*dy)*spd;
      _camera.position.set(
        _target.x+_dist*Math.sin(_phi)*Math.sin(_theta),
        _target.y+_dist*Math.cos(_phi),
        _target.z+_dist*Math.sin(_phi)*Math.cos(_theta));
      _camera.lookAt(_target.x,_target.y,_target.z);
    }
  }
  function _mw(e){
    e.preventDefault();
    _dist*=(1+e.deltaY*0.0008);_dist=Math.max(0.1,Math.min(100000,_dist));
    _camera.position.set(
      _target.x+_dist*Math.sin(_phi)*Math.sin(_theta),
      _target.y+_dist*Math.cos(_phi),
      _target.z+_dist*Math.sin(_phi)*Math.cos(_theta));
    _camera.lookAt(_target.x,_target.y,_target.z);
  }
  function _click(e){
    // Measurement mode takes priority over selection
    if (_measureMode) { _onMeasureClick(e); return; }
    if(!_raycaster||!_camera||!_scene||!_mouse)return;
    const cv=document.getElementById('v-canvas');if(!cv)return;
    const r=cv.getBoundingClientRect();
    _mouse.x=((e.clientX-r.left)/r.width)*2-1;
    _mouse.y=-((e.clientY-r.top)/r.height)*2+1;
    _raycaster.setFromCamera(_mouse,_camera);
    const ms=[];_meshMap.forEach(m=>ms.push(m));
    const hits=_raycaster.intersectObjects(ms,false);
    if(hits.length){_sel(hits[0].object);}else{_desel();}
  }
  function _key(e){
    const k=e.key;
    if(k==='f'||k==='F')enterFullscreen();
    if(k==='i'||k==='I')fitToView();
    if(k==='r'||k==='R')resetCamera();
    if(k==='Escape'&&_fullscreen)exitFullscreen();
  }

  // ── Selection ──────────────────────────────────────────────────────────────
  function _sel(mesh){
    if(_selected===mesh)return;
    _desel();_selected=mesh;_selectedSet.add(mesh);
    if(mesh.material&&mesh.material.emissive)mesh.material.emissive.setHex(0x003399);
    _showInspector(mesh);
  }
  function _desel(){
    _selectedSet.forEach(m=>{if(m.material&&m.material.emissive)m.material.emissive.setHex(0x000000);});
    _selectedSet.clear();_selected=null;
    _applyCol();
    const el=document.getElementById('v-inspector');if(el)el.textContent='Click an element to inspect it.';
  }
  function _showInspector(mesh){
    const el=document.getElementById('v-inspector');if(!el)return;
    const d=mesh.userData;
    const sv=VState.get().elementSeverities?.[d.guid]||'Not Checked';
    const sc={Critical:'#EF4444',Error:'#F97316',Warning:'#EAB308',Pass:'#22C55E'}[sv]||'#94a3b8';
    el.innerHTML=`<div style="font-size:12px;color:#f0f4fb;font-weight:700;margin-bottom:4px;word-break:break-all">${_esc(d.name||'(unnamed)')}</div>
      <div style="font-size:11px;color:#9ab8d4">Type: <code style="background:#112540;padding:1px 4px;border-radius:2px;font-size:10px;color:#00c8a8">${_esc(d.ifcType||'-')}</code></div>
      <div style="font-size:11px;color:#9ab8d4;margin-top:2px">Storey: ${_esc(d.storey||'-')}</div>
      <div style="font-size:11px;margin-top:2px">Status: <b style="color:${sc}">${sv}</b></div>
      <div style="font-size:10px;color:#6b8faf;word-break:break-all;margin-top:4px;font-family:monospace">${_esc(d.guid||'-')}</div>`;
  }
  function selectByGuid(g){const m=_meshMap.get(g);if(m){_sel(m);zoomToSelected();}}
  function selectAll(){_meshMap.forEach(m=>_selectedSet.add(m));}
  function goToFindings(){try{App.navigate('results');}catch(e){}}

  // ── Colour modes ───────────────────────────────────────────────────────────
  function _applyCol(){
    if(!_scene)return;
    const sevs=VState.get().elementSeverities||{};
    _meshMap.forEach((mesh,guid)=>{
      if(!mesh.material||!mesh.material.color)return;
      // Skip if this mesh is currently selected (keep highlight)
      if(_selectedSet.has(mesh))return;
      if(_colorMode==='compliance'){
        const s=sevs[guid]||'NoCheck';
        mesh.material.color.setHex(SCOL[s]||SCOL.NoCheck);
      } else if(_colorMode==='storey'){
        const si=_si(mesh.userData.storey);
        mesh.material.color.setHex(new THREE.Color().setHSL((si*.13)%1,.6,.45).getHex());
      } else {
        // 'type' mode or web-ifc original colours
        if(_usingWebIfc){
          const oc=mesh.userData.origColor;
          if(oc) mesh.material.color.setRGB(oc.r,oc.g,oc.b);
        } else {
          mesh.material.color.setHex(_typeCol(mesh.userData.cls));
        }
      }
      if(mesh.material.emissive)mesh.material.emissive.setHex(0);
    });
  }
  function refreshColours(){
    _applyCol();
    _refreshStats();
    if(_selected)_showInspector(_selected);
  }
  function setColorMode(m){_colorMode=m;_applyCol();}
  function toggleSev(s,v){
    _colorBySev[s]=v;
    const sevs=VState.get().elementSeverities||{};
    _meshMap.forEach((mesh,guid)=>{
      const sv=sevs[guid]||'Not Checked';
      // Normalise both sides: 'Not Checked' === 'Not Checked', 'NoCheck' also maps to it
      const norm=sv==='NoCheck'?'Not Checked':sv;
      const sNorm=s==='NoCheck'?'Not Checked':s;
      if(norm===sNorm)mesh.visible=v;
    });
  }
  function showAll(){_scene&&_scene.traverse(o=>{if(o.isMesh&&!o.name.startsWith('__'))o.visible=true;});}
  function showCriticalOnly(){_scene&&_scene.traverse(o=>{if(o.isMesh&&!o.name.startsWith('__')){const s=VState.get().elementSeverities?.[o.userData.guid];o.visible=s==='Critical'||s==='Error';}});}
  function toggleWire(){_wireMode=!_wireMode;_scene&&_scene.traverse(o=>{if(o.isMesh&&!o.name.startsWith('__'))o.material.wireframe=_wireMode;});}
  function toggleXray(){_xrayMode=!_xrayMode;_scene&&_scene.traverse(o=>{if(o.isMesh&&!o.name.startsWith('__')){o.material.transparent=_xrayMode;o.material.opacity=_xrayMode?0.3:1;}});}
  function toggleIsolate(){}
  function applyVisibility(){showAll();}

  // ── Section planes ──────────────────────────────────────────────────────────
  const _sec={x:false,y:false,z:false};
  function toggleSection(a,on){_sec[a]=on;}
  function updateSection(a,pct){}
  function clearSections(){_sec.x=_sec.y=_sec.z=false;document.querySelectorAll('[id^="v-sec-"]').forEach(c=>c.checked=false);}

  // ── Measurement tool ───────────────────────────────────────────────────────
  function toggleMeasure() {
    _measureMode = !_measureMode;
    _measurePts = [];
    const btn = document.getElementById('v-btn-measure');
    if (btn) {
      btn.style.background = _measureMode ? '#0e7c86' : '';
      btn.style.color      = _measureMode ? '#fff'    : '';
      btn.title = _measureMode ? 'Click two points to measure - active' : 'Distance measurement - click two points';
    }
    _setStatus(_measureMode ? '📏 Measure mode: click first point' : 'Measure mode off');
    const cv = document.getElementById('v-canvas');
    if (cv) cv.style.cursor = _measureMode ? 'crosshair' : '';
  }

  function setMeasure(m) { if (m === 'distance' && !_measureMode) toggleMeasure(); }

  function clearMeasures() {
    _measureLines.forEach(l => { if (_scene) { l.geometry.dispose(); l.material.dispose(); _scene.remove(l); } });
    _measureLines = [];
    _measureLabels.forEach(d => d.remove());
    _measureLabels = [];
    _measurePts = [];
    if (_measureMode) toggleMeasure();
  }

  // Returns the world-space hit point for a mouse event - plane fallback if no mesh hit
  function _measureHit(e) {
    if (!_raycaster || !_camera || !_scene) return null;
    const cv = document.getElementById('v-canvas');
    if (!cv) return null;
    const r = cv.getBoundingClientRect();
    const mx = ((e.clientX - r.left) / r.width) * 2 - 1;
    const my = -((e.clientY - r.top) / r.height) * 2 + 1;
    _raycaster.setFromCamera(new THREE.Vector2(mx, my), _camera);
    const ms = [];
    _meshMap.forEach(m => ms.push(m));
    const hits = _raycaster.intersectObjects(ms, false);
    if (hits.length) return hits[0].point.clone();
    // Fallback: intersect horizontal plane at target y
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -_target.y);
    const pt = new THREE.Vector3();
    if (_raycaster.ray.intersectPlane(plane, pt)) return pt;
    return null;
  }

  // Project a 3D world point to screen px relative to the canvas wrapper
  function _toScreen(worldPt) {
    if (!_camera || !_renderer) return { x: 0, y: 0 };
    const v = worldPt.clone().project(_camera);
    const cv = document.getElementById('v-canvas');
    if (!cv) return { x: 0, y: 0 };
    const r = cv.getBoundingClientRect();
    return {
      x: (v.x + 1) / 2 * r.width,
      y: (-v.y + 1) / 2 * r.height,
    };
  }

  function _addMeasureLabel(worldPt, text) {
    const overlay = document.getElementById('v-overlay');
    if (!overlay) return null;
    const d = document.createElement('div');
    d.style.cssText = 'position:absolute;background:rgba(0,196,160,.9);color:#000;font-size:11px;font-weight:700;padding:2px 7px;border-radius:4px;pointer-events:none;font-family:monospace;white-space:nowrap;transform:translate(-50%,-100%)';
    d.textContent = text;
    const sc = _toScreen(worldPt);
    d.style.left = sc.x + 'px';
    d.style.top  = sc.y + 'px';
    overlay.appendChild(d);
    _measureLabels.push(d);
    return d;
  }

  function _addMeasureLine(p1, p2) {
    if (!_scene) return;
    const geo = new THREE.BufferGeometry().setFromPoints([p1, p2]);
    const mat = new THREE.LineBasicMaterial({ color: 0x00c4a0, linewidth: 2 });
    const line = new THREE.Line(geo, mat);
    _scene.add(line);
    _measureLines.push(line);
  }

  function _onMeasureClick(e) {
    if (!_measureMode) return;
    const pt = _measureHit(e);
    if (!pt) return;
    _measurePts.push(pt);

    if (_measurePts.length === 1) {
      // First point - place a marker dot
      _addMeasureLabel(pt, '●');
      _setStatus('📏 First point set - click second point');
    } else {
      // Second point - draw line and show distance
      const p1 = _measurePts[_measurePts.length - 2];
      const p2 = pt;
      const dist = p1.distanceTo(p2);
      const mid  = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
      _addMeasureLine(p1, p2);
      const disp = dist >= 1 ? dist.toFixed(3) + ' m' : (dist * 1000).toFixed(1) + ' mm';
      _addMeasureLabel(mid, disp);
      _setStatus('📏 Distance: ' + disp + ' - click to measure again');
      // Reset pts to allow chained measurements
      _measurePts = [pt];
    }
  }

  // ── Storey assignment (second pass after StreamAllMeshes) ─────────────────
  function _assignStoreys() {
    if (!_ifcApi || _modelId == null) return;
    try {
      const relType = WebIFC.IFCRELCONTAINEDINSPATIALSTRUCTURE;
      if (relType == null) return;
      const relIds = _ifcApi.GetLineIDsWithType(_modelId, relType);
      if (!relIds || relIds.size() === 0) return;

      // Build expressId → storeyName map from containment relationships
      const exIdToStorey = new Map();
      for (let i = 0; i < relIds.size(); i++) {
        try {
          const rel = _ifcApi.GetLine(_modelId, relIds.get(i), false);
          if (!rel || !rel.RelatingStructure || !rel.RelatedElements) continue;
          const structId = rel.RelatingStructure.value;
          if (structId == null) continue;
          const struct = _ifcApi.GetLine(_modelId, structId, false);
          const storeyName = (struct && struct.Name && struct.Name.value) ? struct.Name.value : '';
          if (!storeyName) continue;
          const related = rel.RelatedElements;
          for (let j = 0; j < related.length; j++) {
            const ref = related[j];
            if (ref && ref.value != null) exIdToStorey.set(ref.value, storeyName);
          }
        } catch(e) {}
      }
      if (exIdToStorey.size === 0) return;

      // Update mesh userData and build guid→storey map
      const guidToStorey = new Map();
      _meshMap.forEach(mesh => {
        const exId = mesh.userData.expressId;
        if (exId != null && exIdToStorey.has(exId)) {
          const s = exIdToStorey.get(exId);
          mesh.userData.storey = s;
          if (mesh.userData.guid) guidToStorey.set(mesh.userData.guid, s);
        }
      });

      // Update tree element list
      _elemListForTree.forEach(e => {
        if (e.g && guidToStorey.has(e.g)) e.s = guidToStorey.get(e.g);
      });
    } catch(e) {
      console.warn('[VERIFIQ 3D] _assignStoreys failed:', e.message);
    }
  }

  // ── IFC tree ───────────────────────────────────────────────────────────────
  function _buildTree(elems){
    const el=document.getElementById('v-tree');if(!el||!elems.length)return;
    const storeys={};
    elems.forEach((e,i)=>{const s=e.s||e.storey||'(no storey)';if(!storeys[s])storeys[s]=[];storeys[s].push({e,i});});
    let h='';
    Object.entries(storeys).sort((a,b)=>_si(a[0])-_si(b[0])).forEach(([s,items])=>{
      h+=`<div style="margin-bottom:2px">
        <div onclick="var _ns=this.nextElementSibling;if(_ns)_ns.style.display=_ns.style.display==='none'?'block':'none'"
          style="font-weight:700;color:#f0f4fb;padding:3px 6px;background:#112540;border-radius:3px;cursor:pointer;font-size:11px;user-select:none">▸ ${_esc(s)} (${items.length})</div>
        <div style="display:none;padding-left:10px">
          ${items.slice(0,30).map(({e})=>`<div onclick="Viewer3DPage.selectByGuid('${_esc(e.g||e.guid||'')}')"
            style="padding:2px 4px;font-size:11px;color:#9ab8d4;cursor:pointer;border-radius:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
            onmouseover="this.style.background='#1a3354'" onmouseout="this.style.background=''"
            title="${_esc(e.n||e.name||'')}">${_esc((e.n||e.name||'element').substring(0,28))}</div>`).join('')}
          ${items.length>30?`<div style="display:none" data-extra="${_esc(JSON.stringify(items.slice(30).map(({e})=>({g:e.g||e.guid||'',n:(e.n||e.name||'element')}))))}">${items.slice(30).map(({e})=>`<div onclick="Viewer3DPage.selectByGuid('${_esc(e.g||e.guid||'')}')"
            style="padding:2px 4px;font-size:11px;color:#9ab8d4;cursor:pointer;border-radius:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
            onmouseover="this.style.background='#1a3354'" onmouseout="this.style.background=''"
            title="${_esc(e.n||e.name||'')}">${_esc((e.n||e.name||'element').substring(0,28))}</div>`).join('')}</div>
          <div onclick="var x=this.previousElementSibling;if(x){x.style.display=x.style.display==='none'?'block':'none';this.textContent=x.style.display==='none'?'...+${items.length-30} more':'show less';}"
            style="font-size:10px;color:#6b8faf;padding:2px 6px;cursor:pointer;text-decoration:underline;user-select:none">...+${items.length-30} more</div>`:''}
        </div></div>`;
    });
    el.innerHTML=h||'No elements.';
  }
  function _fillStoreys(elems){
    const sel=document.getElementById('v-storey');if(!sel)return;
    const s=[...new Set(elems.map(e=>e.s||e.storey||'').filter(Boolean))].sort((a,b)=>_si(a)-_si(b));
    sel.innerHTML='<option value="">All Storeys</option>'+s.map(x=>`<option>${_esc(x)}</option>`).join('');
  }
  function filterByStorey(s){_meshMap.forEach(m=>{m.visible=!s||(m.userData.storey||'')===s;});}
  function filterDisc(d,v){
    const map={ARC:['WALL','SLAB','ROOF','DOOR','WINDOW','STAIR','CURTAIN','COVERING','PROXY'],
                STR:['COLUMN','BEAM','FOOTING','PILE'],MEP:['PIPE','DUCT','VALVE','PUMP','TANK','FLOW'],EXT:['GEOGRAPH','SITE']};
    const types=map[d]||[];
    _meshMap.forEach(m=>{if(types.some(t=>(m.userData.ifcType||'').toUpperCase().includes(t)))m.visible=v;});
  }
  function switchFile(){
    const files=VState.get().filesLoaded||[];
    if(files.length>0)loadFullGeometry();
    else _loadPlaceholders();
  }
  function toggleFpsMode(){}

  // ── Fullscreen ─────────────────────────────────────────────────────────────
  function _fsResize(ww,hh){
    if(_renderer&&_camera){
      _renderer.setSize(ww,hh,false);
      _camera.aspect=ww/hh;
      _camera.updateProjectionMatrix();
      if(_renderer&&_scene&&_camera)_renderer.render(_scene,_camera);
    }
  }

  function _injectFsExitBtn(){
    if(document.getElementById('v-fs-exit-btn'))return;
    const btn=document.createElement('button');
    btn.id='v-fs-exit-btn';
    btn.title='Exit Fullscreen (ESC)';
    btn.textContent='✕ Exit Fullscreen';
    btn.style.cssText=[
      'position:absolute','top:10px','right:12px','z-index:10001',
      'background:rgba(6,13,27,0.85)','color:#c0d8f0',
      'border:1px solid #1a3354','border-radius:6px',
      'padding:5px 12px','font-size:12px','font-weight:600',
      'cursor:pointer','letter-spacing:.03em',
      'backdrop-filter:blur(4px)','-webkit-backdrop-filter:blur(4px)',
      'transition:background .15s'
    ].join(';');
    btn.onmouseenter=()=>{ btn.style.background='rgba(14,124,134,0.85)'; };
    btn.onmouseleave=()=>{ btn.style.background='rgba(6,13,27,0.85)'; };
    btn.onclick=()=>exitFullscreen();
    const wrap=document.getElementById('v-wrap');
    if(wrap)wrap.appendChild(btn);
  }

  function _removeFsExitBtn(){
    const b=document.getElementById('v-fs-exit-btn');
    if(b)b.remove();
  }

  function _onFsChange(){
    const isNativeFs=!!(document.fullscreenElement||document.webkitFullscreenElement);
    if(!isNativeFs&&_fullscreen){
      // User pressed ESC in native fullscreen - sync our CSS state
      _fullscreen=false;
      const w=document.getElementById('v-wrap');
      if(w)w.style.cssText='';
      _removeFsExitBtn();
      setTimeout(()=>{
        const wrap=document.getElementById('v-canvas-wrap');
        if(wrap&&wrap.clientWidth>10)_fsResize(wrap.clientWidth,wrap.clientHeight);
      },120);
    } else if(isNativeFs&&_fullscreen){
      // Native fullscreen granted - resize to screen dimensions
      setTimeout(()=>_fsResize(window.innerWidth,window.innerHeight),120);
    }
  }

  function enterFullscreen(){
    const w=document.getElementById('v-wrap');
    if(!w)return;
    _fullscreen=true;
    w.style.cssText='position:fixed;inset:0;z-index:9999;display:flex;flex-direction:column;background:#060d1b';
    _injectFsExitBtn();
    // Signal WPF host to go borderless so chrome is hidden
    if(typeof VBridge!=='undefined')VBridge.send('requestFullscreen',{});
    // Request native OS fullscreen (hides taskbar, fills entire monitor)
    const el=document.documentElement;
    if(el.requestFullscreen){ el.requestFullscreen().catch(()=>{}); }
    else if(el.webkitRequestFullscreen){ el.webkitRequestFullscreen(); }
    // Resize immediately via CSS dimensions, then again after native fullscreen settles
    _fsResize(window.innerWidth,window.innerHeight);
    setTimeout(()=>_fsResize(window.innerWidth,window.innerHeight),250);
  }

  function exitFullscreen(){
    _fullscreen=false;
    _removeFsExitBtn();
    const w=document.getElementById('v-wrap');
    if(w)w.style.cssText='';
    if(document.exitFullscreen&&document.fullscreenElement){
      document.exitFullscreen().catch(()=>{});
    } else if(document.webkitExitFullscreen&&document.webkitFullscreenElement){
      document.webkitExitFullscreen();
    }
    // Signal WPF host to restore window chrome
    if(typeof VBridge!=='undefined')VBridge.send('exitFullscreen',{});
    setTimeout(()=>{
      const wrap=document.getElementById('v-canvas-wrap');
      if(wrap&&wrap.clientWidth>10)_fsResize(wrap.clientWidth,wrap.clientHeight);
    },150);
  }

  // ── Render loop ────────────────────────────────────────────────────────────
  function _loop(){
    if(_animFrame)return;
    const tick=()=>{_animFrame=requestAnimationFrame(tick);if(_renderer&&_scene&&_camera)_renderer.render(_scene,_camera);};
    _animFrame=requestAnimationFrame(tick);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  function _setEngine(t){const e=document.getElementById('v-engine');if(e)e.textContent=t;}
  function _setStatus(t){const e=document.getElementById('v-status');if(e)e.textContent=t;}
  function _refreshStats(){const e=document.getElementById('v-stats');if(e)e.innerHTML=_buildStats(VState.get().session);}
  function _esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

  function _typeCol(cls){
    const t=(cls||'').toUpperCase().split('|')[0];
    if(t.includes('WALL'))   return 0x3B5998;
    if(t.includes('SLAB'))   return 0x607D8B;
    if(t.includes('BEAM'))   return 0x1565C0;
    if(t.includes('COLUMN')) return 0xBF360C;
    if(t.includes('DOOR'))   return 0x6A1B9A;
    if(t.includes('WINDOW')) return 0x0277BD;
    if(t.includes('STAIR'))  return 0xE65100;
    if(t.includes('ROOF'))   return 0xB71C1C;
    if(t.includes('SPACE'))  return 0x1B5E20;
    if(t.includes('PIPE'))   return 0x01579B;
    if(t.includes('DUCT'))   return 0x006064;
    if(t.includes('FOUND')||t.includes('PILE'))return 0x4E342E;
    return 0x455A64;
  }
  function _tsz(cls){
    const t=(cls||'').toUpperCase();
    if(t.includes('SLAB'))  return[4,.25,4];
    if(t.includes('COLUMN'))return[.4,3.5,.4];
    if(t.includes('BEAM'))  return[4,.4,.4];
    if(t.includes('DOOR'))  return[.9,2.1,.1];
    if(t.includes('WINDOW'))return[1.2,1,.1];
    if(t.includes('SPACE')) return[5,3,4];
    if(t.includes('PILE'))  return[.5,8,.5];
    return[2,3,2];
  }
  function _si(name){
    if(!name)return 0;
    const s=name.toLowerCase();
    if(s.includes('b2')||s.includes('basement 2'))return-2;
    if(s.includes('b1')||s.includes('basement')) return-1;
    if(s.match(/^(ground|g\/f|gf|l1|level 1|storey 1|1st)/))return 0;
    const m=s.match(/(?:level|storey|floor|l|f)?\s*(\d+)/);
    return m?parseInt(m[1],10)-1:0;
  }

  return {
    render,onNavigate,
    onIfcData,onIfcFileUrl,
    loadElements,loadFullGeometry,
    refreshColours,setColorMode,
    fitToView,resetCamera,setView,
    enterFullscreen,exitFullscreen,
    toggleWire,toggleXray,toggleIsolate,
    showAll,showCriticalOnly,applyVisibility,
    toggleSev,
    selectAll,selectByGuid,zoomToSelected,goToFindings,
    filterByStorey,filterDisc,switchFile,
    toggleFpsMode,
    toggleSection,updateSection,clearSections,
    setMeasure,clearMeasures,toggleMeasure,
  };
})();
window.Viewer3DPage=Viewer3DPage;
