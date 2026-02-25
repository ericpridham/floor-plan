// Room editor for floorplan setup mode
// Rooms are stored as percentage-based coordinates (0-100) relative to the image dimensions.

(function () {
  'use strict';

  // ─── State ────────────────────────────────────────────────────────────────
  let rooms = [];   // [{ id, name, shape, x, y, width, height, vertices? }]
  let nextId = 1;
  let selected = null;   // id of selected room, or null
  let saveTimer = null;
  let saveRetries = 0;

  // Draw mode: 'rectangle' | 'polygon'
  let drawMode = 'rectangle';

  // Rectangle drawing state
  let isDrawing = false;
  let drawStartPct = null;

  // Polygon drawing state
  let isDrawingPolygon = false;
  let polygonVertices = []; // [{x, y}] in-progress
  let polygonPreviewMouse = null; // {x, y} or null

  // Drag/resize state
  let dragState = null;

  // DOM refs
  const overlay    = document.getElementById('roomOverlay');
  const img        = document.getElementById('floorplanImg');
  const roomList   = document.getElementById('roomList');
  const roomCount  = document.getElementById('roomCount');
  const saveStatus = document.getElementById('saveStatus');
  const hintEl     = document.getElementById('setupHint');
  const modeRectBtn = document.getElementById('modeRect');
  const modePolyBtn = document.getElementById('modePoly');

  // ─── SVG overlay ─────────────────────────────────────────────────────────
  // Shared SVG for polygon room rendering (lives inside roomOverlay)
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.id = 'roomSvg';
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible;';
  overlay.appendChild(svg);

  // ─── Coordinate helpers ───────────────────────────────────────────────────
  function imgRect() { return img.getBoundingClientRect(); }

  function clientToPct(clientX, clientY) {
    const r = imgRect();
    return {
      x: Math.max(0, Math.min(100, ((clientX - r.left)  / r.width)  * 100)),
      y: Math.max(0, Math.min(100, ((clientY - r.top)   / r.height) * 100)),
    };
  }

  function computeCentroid(vertices) {
    const n = vertices.length;
    return {
      x: vertices.reduce((s, v) => s + v.x, 0) / n,
      y: vertices.reduce((s, v) => s + v.y, 0) / n,
    };
  }

  // ─── Draw mode toggle ────────────────────────────────────────────────────
  function setDrawMode(mode) {
    if (mode !== 'rectangle' && mode !== 'polygon') return;
    if (drawMode === 'polygon' && mode !== 'polygon') cancelPolygon();
    drawMode = mode;

    const activeClass   = 'px-3 py-1.5 text-xs font-medium rounded-md bg-indigo-600 text-white shadow hover:bg-indigo-700 transition-colors';
    const inactiveClass = 'px-3 py-1.5 text-xs font-medium rounded-md bg-white text-gray-600 shadow hover:bg-gray-50 border border-gray-200 transition-colors';

    if (mode === 'rectangle') {
      modeRectBtn.className = activeClass;
      modePolyBtn.className = inactiveClass;
      if (hintEl) hintEl.textContent = 'Click and drag to draw a room. Click a room to select. Double-click label to rename.';
    } else {
      modeRectBtn.className = inactiveClass;
      modePolyBtn.className = activeClass;
      if (hintEl) hintEl.textContent = 'Click to add vertices. Double-click or click near the first vertex to close. Esc to cancel.';
    }
  }

  modeRectBtn?.addEventListener('click', () => setDrawMode('rectangle'));
  modePolyBtn?.addEventListener('click', () => setDrawMode('polygon'));

  // ─── Save ──────────────────────────────────────────────────────────────────
  function scheduleSave() {
    saveStatus.textContent = 'Unsaved changes…';
    clearTimeout(saveTimer);
    saveRetries = 0;
    saveTimer = setTimeout(save, 500);
  }

  async function save() {
    saveStatus.textContent = 'Saving…';
    const payload = rooms.map(r => {
      if (r.shape === 'polygon') {
        return { name: r.name, vertices: r.vertices };
      }
      return { name: r.name, x: r.x, y: r.y, width: r.width, height: r.height };
    });
    try {
      const res = await fetch(window.ROOMS_SYNC_URL, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-TOKEN': window.CSRF_TOKEN,
          'Accept': 'application/json',
        },
        body: JSON.stringify({ rooms: payload }),
      });
      if (!res.ok) throw new Error('Save failed');
      saveStatus.textContent = 'All changes saved';
    } catch {
      if (saveRetries < 5) {
        saveRetries++;
        saveStatus.textContent = `Save failed — retrying… (${saveRetries}/5)`;
        saveTimer = setTimeout(save, 3000);
      } else {
        saveStatus.textContent = 'Save failed — please reload the page.';
      }
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  function render() {
    // Remove old room rects and polygon overlay labels/delete btns
    overlay.querySelectorAll('.room-rect, .poly-overlay').forEach(el => el.remove());

    // Clear SVG polygon rooms (keep preview group)
    svg.querySelectorAll('.poly-room').forEach(el => el.remove());

    rooms.forEach(room => {
      if (room.shape === 'polygon') {
        renderPolygonRoom(room);
      } else {
        overlay.appendChild(makeRoomEl(room));
      }
    });

    renderList();
    roomCount.textContent = rooms.length;
  }

  // ─── Rectangle room element ───────────────────────────────────────────────
  function makeRoomEl(room) {
    const isSelected = selected === room.id;

    const el = document.createElement('div');
    el.className = 'room-rect absolute';
    el.dataset.id = room.id;
    el.style.cssText = `
      left: ${room.x}%; top: ${room.y}%;
      width: ${room.width}%; height: ${room.height}%;
      border: 2px solid rgba(79,70,229,0.8);
      background: rgba(79,70,229,${isSelected ? '0.18' : '0.08'});
      box-sizing: border-box;
      cursor: move;
    `;

    // Label
    const label = document.createElement('span');
    label.className = 'room-label absolute top-1 left-1 text-xs font-medium text-indigo-900 bg-white/80 rounded px-1 leading-tight pointer-events-none select-none truncate max-w-full';
    label.textContent = room.name;
    el.appendChild(label);

    // Delete button
    const del = document.createElement('button');
    del.className = 'room-delete absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-xs leading-none flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity';
    del.textContent = '×';
    del.title = 'Delete room';
    del.addEventListener('mousedown', e => { e.stopPropagation(); deleteRoom(room.id); });
    el.appendChild(del);

    el.addEventListener('mouseenter', () => del.style.opacity = '1');
    el.addEventListener('mouseleave', () => { if (selected !== room.id) del.style.opacity = '0'; });
    if (isSelected) del.style.opacity = '1';

    label.style.pointerEvents = 'auto';
    label.style.cursor = 'text';
    label.addEventListener('mousedown', e => { e.stopPropagation(); selectRoom(room.id); });
    label.addEventListener('dblclick', e => { e.stopPropagation(); startRename(room.id, label); });

    el.addEventListener('mousedown', e => {
      if (e.target === del) return;
      e.stopPropagation();
      selectRoom(room.id);
      startMove(e, room);
    });

    if (isSelected) {
      const handles = ['nw','n','ne','e','se','s','sw','w'];
      handles.forEach(h => {
        const handle = document.createElement('div');
        handle.className = 'room-handle absolute w-3 h-3 bg-white border-2 border-indigo-600 rounded-sm';
        handle.dataset.handle = h;
        positionHandle(handle, h);
        handle.style.cursor = h + '-resize';
        handle.addEventListener('mousedown', e => { e.stopPropagation(); startResize(e, room, h); });
        el.appendChild(handle);
      });
    }

    return el;
  }

  function positionHandle(el, handle) {
    const hMap = {
      nw: 'top:-5px;left:-5px',   n: 'top:-5px;left:calc(50% - 6px)',  ne: 'top:-5px;right:-5px',
      e:  'top:calc(50% - 6px);right:-5px',
      se: 'bottom:-5px;right:-5px', s: 'bottom:-5px;left:calc(50% - 6px)', sw: 'bottom:-5px;left:-5px',
      w:  'top:calc(50% - 6px);left:-5px',
    };
    el.style.cssText += ';position:absolute;z-index:10;' + hMap[handle];
  }

  // ─── Polygon room element (SVG) ───────────────────────────────────────────
  function renderPolygonRoom(room) {
    const isSelected = selected === room.id;
    const centroid   = computeCentroid(room.vertices);

    // SVG group (shape only)
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.classList.add('poly-room');
    g.dataset.id = room.id;

    // Polygon shape
    const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    poly.setAttribute('points', room.vertices.map(v => `${v.x},${v.y}`).join(' '));
    poly.setAttribute('fill', isSelected ? 'rgba(79,70,229,0.18)' : 'rgba(79,70,229,0.08)');
    poly.setAttribute('stroke', 'rgba(79,70,229,0.8)');
    poly.setAttribute('stroke-width', '2');
    poly.setAttribute('vector-effect', 'non-scaling-stroke');
    poly.style.cursor = 'move';
    poly.style.pointerEvents = 'all';
    poly.addEventListener('mousedown', e => {
      e.stopPropagation();
      selectRoom(room.id);
      startMovePolygon(e, room);
    });
    g.appendChild(poly);

    // Vertex dots when selected
    if (isSelected) {
      room.vertices.forEach((v, idx) => {
        const dot = document.createElement('div');
        dot.className = 'poly-overlay poly-dot absolute w-3 h-3 bg-white border-2 border-indigo-600 rounded-full shadow-sm';
        dot.style.left = `calc(${v.x}% - 6px)`;
        dot.style.top = `calc(${v.y}% - 6px)`;
        dot.style.cursor = 'move';
        dot.dataset.index = idx;
        dot.addEventListener('mousedown', e => {
          e.stopPropagation();
          startMovePolygonVertex(e, room, idx);
        });
        overlay.appendChild(dot);
      });
    }

    svg.appendChild(g);

    // HTML label (matches rectangle label style)
    const label = document.createElement('span');
    label.className = 'poly-overlay room-label absolute text-xs font-medium text-indigo-900 bg-white/80 rounded px-1 leading-tight select-none truncate';
    label.style.cssText = `left:calc(${room.x}% + 4px);top:calc(${room.y}% + 4px);max-width:calc(${room.width}% - 8px);pointer-events:auto;cursor:text;`;
    label.textContent = room.name;
    label.addEventListener('mousedown', e => { e.stopPropagation(); selectRoom(room.id); });
    label.addEventListener('dblclick', e => { e.stopPropagation(); startPolygonRename(room.id, centroid); });
    overlay.appendChild(label);

    // HTML delete button (matches rectangle delete button style)
    const del = document.createElement('button');
    del.className = 'poly-overlay room-delete absolute w-4 h-4 rounded-full bg-red-500 text-white text-xs leading-none flex items-center justify-center transition-opacity';
    del.style.cssText = `left:calc(${room.x + room.width}% - 8px);top:calc(${room.y}% - 8px);opacity:${isSelected ? '1' : '0'};`;
    del.textContent = '×';
    del.title = 'Delete room';
    del.addEventListener('mousedown', e => { e.stopPropagation(); deleteRoom(room.id); });
    overlay.appendChild(del);

    // Hover to show/hide delete button
    const showDel = () => del.style.opacity = '1';
    const hideDel = () => { if (selected !== room.id) del.style.opacity = '0'; };
    poly.addEventListener('mouseenter', showDel);
    poly.addEventListener('mouseleave', hideDel);
    label.addEventListener('mouseenter', showDel);
    label.addEventListener('mouseleave', hideDel);
  }

  // ─── Sidebar list ─────────────────────────────────────────────────────────
  function renderList() {
    roomList.innerHTML = '';
    rooms.forEach(room => {
      const li = document.createElement('li');
      li.className = `px-4 py-2.5 cursor-pointer flex items-center gap-2 transition-colors ${selected === room.id ? 'bg-indigo-50 text-indigo-900 font-medium' : 'text-gray-700 hover:bg-gray-50'}`;
      li.dataset.id = room.id;

      const dot = document.createElement('span');
      dot.className = `w-2 h-2 inline-block rounded-${room.shape === 'polygon' ? 'none rotate-45' : 'full'} bg-indigo-400 flex-shrink-0`;
      li.appendChild(dot);

      const name = document.createElement('span');
      name.className = 'truncate text-sm';
      name.textContent = room.name;
      li.appendChild(name);

      li.addEventListener('click', () => selectRoom(room.id));
      roomList.appendChild(li);
    });
  }

  // ─── Selection ────────────────────────────────────────────────────────────
  function selectRoom(id) {
    if (selected === id) return;
    selected = id;
    render();
  }

  function deselectAll() {
    selected = null;
    render();
  }

  // ─── Delete ───────────────────────────────────────────────────────────────
  function deleteRoom(id) {
    rooms = rooms.filter(r => r.id !== id);
    if (selected === id) selected = null;
    render();
    scheduleSave();
  }

  // ─── Rename (rectangle rooms only; polygon rooms use prompt) ──────────────
  function startRename(id, labelEl) {
    const room = rooms.find(r => r.id === id);
    if (!room) return;

    const input = document.createElement('input');
    input.type = 'text';
    input.value = room.name;
    input.className = 'text-xs font-medium w-full border border-indigo-400 rounded px-1 bg-white outline-none';
    input.style.minWidth = '80px';

    labelEl.replaceWith(input);
    input.focus();
    input.select();

    const commit = () => {
      const val = input.value.trim();
      if (val) { room.name = val; scheduleSave(); }
      render();
    };

    input.addEventListener('blur', commit);
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); commit(); }
      if (e.key === 'Escape') { render(); }
    });
  }

  // ─── Rename (polygon rooms — inline overlay input) ────────────────────────
  function startPolygonRename(id, centroid) {
    const room = rooms.find(r => r.id === id);
    if (!room) return;

    // Overlay an HTML input at the centroid position
    const inputWrap = document.createElement('div');
    inputWrap.className = 'poly-overlay absolute z-20';
    inputWrap.style.cssText = `left:${centroid.x}%;top:${centroid.y}%;transform:translate(-50%,-50%);`;

    const input = document.createElement('input');
    input.type = 'text';
    input.value = room.name;
    input.className = 'text-xs font-medium border border-indigo-400 rounded px-1 bg-white outline-none shadow';
    input.style.minWidth = '80px';

    inputWrap.appendChild(input);
    overlay.appendChild(inputWrap);
    setTimeout(() => { input.focus(); input.select(); }, 0);

    let committed = false;

    const commit = () => {
      if (committed) return;
      committed = true;
      const val = input.value.trim();
      if (val) { room.name = val; scheduleSave(); }
      inputWrap.remove();
      render();
    };

    const cancel = () => {
      if (committed) return;
      committed = true;
      inputWrap.remove();
      render();
    };

    input.addEventListener('blur', commit);
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); commit(); }
      if (e.key === 'Escape') { e.preventDefault(); cancel(); }
    });
  }

  // ─── Name prompt (after drawing) ──────────────────────────────────────────
  function showNamePrompt(room) {
    const pos = room.shape === 'polygon'
      ? computeCentroid(room.vertices)
      : { x: room.x, y: room.y };

    const prompt = document.createElement('div');
    prompt.className = 'absolute z-20 bg-white rounded-lg shadow-lg border border-indigo-200 p-2 flex gap-1 items-center';
    prompt.style.cssText = `left:${pos.x}%;top:${pos.y}%;transform:translateY(-110%);`;

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Room name';
    input.className = 'text-sm border border-gray-300 rounded px-2 py-1 outline-none focus:border-indigo-500 w-36';

    const btn = document.createElement('button');
    btn.textContent = '✓';
    btn.className = 'px-2 py-1 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700';

    prompt.appendChild(input);
    prompt.appendChild(btn);
    overlay.appendChild(prompt);
    setTimeout(() => input.focus(), 0);

    let committed = false;

    const commit = () => {
      if (committed) return;
      committed = true;
      const val = input.value.trim();
      if (val) {
        room.name = val;
        rooms.push(room);
        selectRoom(room.id);
        scheduleSave();
      }
      prompt.remove();
      render();
    };

    let cancelled = false;
    const cancel = () => {
      cancelled = true;
      prompt.remove();
      render();
    };

    btn.addEventListener('click', commit);
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); commit(); }
      if (e.key === 'Escape') cancel();
    });
    input.addEventListener('blur', () => {
      setTimeout(() => { if (!committed && !cancelled) commit(); }, 150);
    });
  }

  // ─── Rectangle drawing ────────────────────────────────────────────────────
  let previewEl = null;

  function startDraw(e) {
    isDrawing = true;
    drawStartPct = clientToPct(e.clientX, e.clientY);

    previewEl = document.createElement('div');
    previewEl.className = 'absolute pointer-events-none';
    previewEl.style.cssText = `
      left:${drawStartPct.x}%;top:${drawStartPct.y}%;width:0;height:0;
      border:2px dashed rgba(79,70,229,0.7);
      background:rgba(79,70,229,0.12);
      box-sizing:border-box;
    `;
    overlay.appendChild(previewEl);
  }

  function updateDraw(e) {
    if (!isDrawing || !previewEl) return;
    const cur = clientToPct(e.clientX, e.clientY);
    const x = Math.min(drawStartPct.x, cur.x);
    const y = Math.min(drawStartPct.y, cur.y);
    const w = Math.abs(cur.x - drawStartPct.x);
    const h = Math.abs(cur.y - drawStartPct.y);
    previewEl.style.left   = x + '%';
    previewEl.style.top    = y + '%';
    previewEl.style.width  = w + '%';
    previewEl.style.height = h + '%';
  }

  function endDraw(e) {
    if (!isDrawing) return;
    isDrawing = false;
    const cur = clientToPct(e.clientX, e.clientY);
    const x = Math.min(drawStartPct.x, cur.x);
    const y = Math.min(drawStartPct.y, cur.y);
    const w = Math.abs(cur.x - drawStartPct.x);
    const h = Math.abs(cur.y - drawStartPct.y);

    if (previewEl) { previewEl.remove(); previewEl = null; }
    if (w < 1 || h < 1) return;

    const room = { id: nextId++, name: '', shape: 'rectangle', x: +x.toFixed(4), y: +y.toFixed(4), width: +w.toFixed(4), height: +h.toFixed(4) };
    showNamePrompt(room);
  }

  // ─── Polygon drawing ──────────────────────────────────────────────────────
  function addPolygonVertex(pt) {
    if (!isDrawingPolygon) {
      isDrawingPolygon = true;
      polygonVertices = [pt];
      updatePolygonPreview();
      return;
    }

    // Close polygon if clicking near first vertex (within ~3%)
    if (polygonVertices.length >= 3) {
      const first = polygonVertices[0];
      const dx = pt.x - first.x;
      const dy = pt.y - first.y;
      if (Math.sqrt(dx * dx + dy * dy) < 3) {
        closePolygon();
        return;
      }
    }

    polygonVertices.push(pt);
    updatePolygonPreview();
  }

  function closePolygon() {
    if (polygonVertices.length < 3) { cancelPolygon(); return; }

    const vertices = polygonVertices.map(v => ({ x: +v.x.toFixed(4), y: +v.y.toFixed(4) }));
    isDrawingPolygon = false;
    polygonVertices = [];
    polygonPreviewMouse = null;
    updatePolygonPreview();

    const xs = vertices.map(v => v.x);
    const ys = vertices.map(v => v.y);
    const room = {
      id: nextId++,
      name: '',
      shape: 'polygon',
      vertices,
      x: +Math.min(...xs).toFixed(4),
      y: +Math.min(...ys).toFixed(4),
      width:  +(Math.max(...xs) - Math.min(...xs)).toFixed(4),
      height: +(Math.max(...ys) - Math.min(...ys)).toFixed(4),
    };

    showNamePrompt(room);
  }

  function cancelPolygon() {
    isDrawingPolygon = false;
    polygonVertices = [];
    polygonPreviewMouse = null;
    updatePolygonPreview();
  }

  function updatePolygonPreview() {
    svg.querySelectorAll('.poly-preview').forEach(el => el.remove());
    overlay.querySelectorAll('.poly-preview-dot').forEach(el => el.remove());
    if (!isDrawingPolygon || polygonVertices.length === 0) return;

    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.classList.add('poly-preview');
    g.style.pointerEvents = 'none';

    // Filled preview polygon (if ≥3 vertices)
    if (polygonVertices.length >= 3) {
      const allPts = polygonPreviewMouse
        ? [...polygonVertices, polygonPreviewMouse]
        : polygonVertices;
      const previewPoly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      previewPoly.setAttribute('points', allPts.map(v => `${v.x},${v.y}`).join(' '));
      previewPoly.setAttribute('fill', 'rgba(79,70,229,0.1)');
      previewPoly.setAttribute('stroke', 'none');
      g.appendChild(previewPoly);
    }

    // Polyline connecting existing vertices
    if (polygonVertices.length >= 2) {
      const pl = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
      pl.setAttribute('points', polygonVertices.map(v => `${v.x},${v.y}`).join(' '));
      pl.setAttribute('fill', 'none');
      pl.setAttribute('stroke', 'rgba(79,70,229,0.8)');
      pl.setAttribute('stroke-width', '0.4');
      g.appendChild(pl);
    }

    // Dashed line from last vertex to cursor
    if (polygonPreviewMouse && polygonVertices.length >= 1) {
      const last = polygonVertices[polygonVertices.length - 1];
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', last.x);
      line.setAttribute('y1', last.y);
      line.setAttribute('x2', polygonPreviewMouse.x);
      line.setAttribute('y2', polygonPreviewMouse.y);
      line.setAttribute('stroke', 'rgba(79,70,229,0.5)');
      line.setAttribute('stroke-width', '0.3');
      line.setAttribute('stroke-dasharray', '1,1');
      g.appendChild(line);
    }

    svg.appendChild(g);

    // Vertex dots
    polygonVertices.forEach((v, i) => {
      const dot = document.createElement('div');
      dot.className = 'poly-preview-dot absolute rounded-full bg-white border-2 border-indigo-600 shadow-sm pointer-events-none';
      const isFirst = i === 0;
      const canClose = polygonVertices.length >= 3;
      const size = isFirst && canClose ? 14 : 10;
      dot.style.width = `${size}px`;
      dot.style.height = `${size}px`;
      dot.style.left = `calc(${v.x}% - ${size/2}px)`;
      dot.style.top = `calc(${v.y}% - ${size/2}px)`;
      if (isFirst) dot.style.backgroundColor = '#4f46e5';
      overlay.appendChild(dot);
    });
  }

  // ─── Move (rectangle) ─────────────────────────────────────────────────────
  function startMove(e, room) {
    const startPct = clientToPct(e.clientX, e.clientY);
    dragState = { type: 'move', startPct, startRoom: { ...room } };
  }

  // ─── Move (polygon) ───────────────────────────────────────────────────────
  function startMovePolygon(e, room) {
    const startPct = clientToPct(e.clientX, e.clientY);
    dragState = {
      type: 'move-polygon',
      startPct,
      startVertices: room.vertices.map(v => ({ ...v })),
      roomId: room.id,
    };
  }

  function startMovePolygonVertex(e, room, vertexIndex) {
    const startPct = clientToPct(e.clientX, e.clientY);
    dragState = {
      type: 'move-polygon-vertex',
      startPct,
      startVertex: { ...room.vertices[vertexIndex] },
      vertexIndex,
      roomId: room.id,
    };
  }

  function onMove(e) {
    if (!dragState) return;
    const cur = clientToPct(e.clientX, e.clientY);
    const dx = cur.x - dragState.startPct.x;
    const dy = cur.y - dragState.startPct.y;

    if (dragState.type === 'move-polygon') {
      const room = rooms.find(r => r.id === dragState.roomId);
      if (!room) return;
      room.vertices = dragState.startVertices.map(v => ({
        x: Math.max(0, Math.min(100, v.x + dx)),
        y: Math.max(0, Math.min(100, v.y + dy)),
      }));
      const xs = room.vertices.map(v => v.x);
      const ys = room.vertices.map(v => v.y);
      room.x = Math.min(...xs);
      room.y = Math.min(...ys);
      room.width  = Math.max(...xs) - room.x;
      room.height = Math.max(...ys) - room.y;

      // Live-update SVG polygon
      const g = svg.querySelector(`.poly-room[data-id="${room.id}"]`);
      if (g) {
        const p = g.querySelector('polygon');
        if (p) p.setAttribute('points', room.vertices.map(v => `${v.x},${v.y}`).join(' '));
      }

      // Live-update vertex HTML dots if they exist
      const dots = overlay.querySelectorAll('.poly-dot');
      dots.forEach((dot, idx) => {
        if (room.vertices[idx]) {
          dot.style.left = `calc(${room.vertices[idx].x}% - 6px)`;
          dot.style.top = `calc(${room.vertices[idx].y}% - 6px)`;
        }
      });
      return;
    }

    if (dragState.type === 'move-polygon-vertex') {
      const room = rooms.find(r => r.id === dragState.roomId);
      if (!room) return;
      const vIdx = dragState.vertexIndex;
      room.vertices[vIdx] = {
        x: Math.max(0, Math.min(100, dragState.startVertex.x + dx)),
        y: Math.max(0, Math.min(100, dragState.startVertex.y + dy)),
      };
      
      const xs = room.vertices.map(v => v.x);
      const ys = room.vertices.map(v => v.y);
      room.x = Math.min(...xs);
      room.y = Math.min(...ys);
      room.width  = Math.max(...xs) - room.x;
      room.height = Math.max(...ys) - room.y;

      // Live-update SVG polygon
      const g = svg.querySelector(`.poly-room[data-id="${room.id}"]`);
      if (g) {
        const p = g.querySelector('polygon');
        if (p) p.setAttribute('points', room.vertices.map(v => `${v.x},${v.y}`).join(' '));
      }

      // Live-update vertex HTML dot
      const dots = overlay.querySelectorAll('.poly-dot');
      dots.forEach(dot => {
        if (parseInt(dot.dataset.index, 10) === vIdx) {
          dot.style.left = `calc(${room.vertices[vIdx].x}% - 6px)`;
          dot.style.top = `calc(${room.vertices[vIdx].y}% - 6px)`;
        }
      });
      return;
    }

    const room = rooms.find(r => r.id === selected);
    if (!room) return;

    if (dragState.type === 'move') {
      room.x = Math.max(0, Math.min(100 - room.width,  dragState.startRoom.x + dx));
      room.y = Math.max(0, Math.min(100 - room.height, dragState.startRoom.y + dy));
    } else if (dragState.type === 'resize') {
      applyResize(room, dragState.handle, dragState.startRoom, dx, dy);
    }

    const el = overlay.querySelector(`.room-rect[data-id="${selected}"]`);
    if (el) {
      el.style.left   = room.x + '%';
      el.style.top    = room.y + '%';
      el.style.width  = room.width + '%';
      el.style.height = room.height + '%';
    }
  }

  function endMove() {
    if (!dragState) return;
    dragState = null;
    render();
    scheduleSave();
  }

  // ─── Resize (rectangle) ───────────────────────────────────────────────────
  function startResize(e, room, handle) {
    const startPct = clientToPct(e.clientX, e.clientY);
    dragState = { type: 'resize', handle, startPct, startRoom: { ...room } };
  }

  function applyResize(room, handle, start, dx, dy) {
    const minPct = 1;
    let { x, y, width, height } = start;

    if (handle.includes('e')) { width  = Math.max(minPct, start.width  + dx); }
    if (handle.includes('s')) { height = Math.max(minPct, start.height + dy); }
    if (handle.includes('w')) {
      const newW = Math.max(minPct, start.width - dx);
      x = start.x + (start.width - newW);
      width = newW;
    }
    if (handle.includes('n')) {
      const newH = Math.max(minPct, start.height - dy);
      y = start.y + (start.height - newH);
      height = newH;
    }

    room.x = Math.max(0, +x.toFixed(4));
    room.y = Math.max(0, +y.toFixed(4));
    room.width  = Math.min(100 - room.x, +width.toFixed(4));
    room.height = Math.min(100 - room.y, +height.toFixed(4));
  }

  // ─── Event wiring ─────────────────────────────────────────────────────────
  overlay.addEventListener('mousedown', e => {
    if (drawMode === 'polygon') {
      // Only add vertex when clicking the overlay background (not existing rooms)
      if (e.target === overlay) {
        addPolygonVertex(clientToPct(e.clientX, e.clientY));
      }
      return;
    }
    if (e.target === overlay) {
      deselectAll();
      startDraw(e);
    }
  });

  // dblclick closes polygon; two mousedown events fired before dblclick, adding 2 unwanted vertices
  overlay.addEventListener('dblclick', e => {
    if (drawMode !== 'polygon' || !isDrawingPolygon) return;
    if (polygonVertices.length > 0) polygonVertices.pop();
    if (polygonVertices.length > 0) polygonVertices.pop();
    closePolygon();
  });

  document.addEventListener('mousemove', e => {
    if (drawMode === 'rectangle') {
      updateDraw(e);
    } else if (isDrawingPolygon) {
      polygonPreviewMouse = clientToPct(e.clientX, e.clientY);
      updatePolygonPreview();
    }
    onMove(e);
  });

  document.addEventListener('mouseup', e => {
    if (drawMode === 'rectangle' && isDrawing) endDraw(e);
    endMove();
  });

  document.addEventListener('keydown', e => {
    if ((e.key === 'Delete' || e.key === 'Backspace') && selected !== null) {
      if (document.activeElement.tagName === 'INPUT') return;
      deleteRoom(selected);
    }
    if (e.key === 'Escape') {
      if (isDrawingPolygon) {
        cancelPolygon();
      } else {
        deselectAll();
      }
    }
  });

  // ─── Init ─────────────────────────────────────────────────────────────────
  function init() {
    (window.INITIAL_ROOMS || []).forEach(r => {
      if (r.vertices && Array.isArray(r.vertices) && r.vertices.length >= 3) {
        rooms.push({
          id: nextId++,
          name: r.name,
          shape: 'polygon',
          vertices: r.vertices,
          x: +r.x, y: +r.y, width: +r.width, height: +r.height,
        });
      } else {
        rooms.push({ id: nextId++, name: r.name, shape: 'rectangle', x: +r.x, y: +r.y, width: +r.width, height: +r.height });
      }
    });
    render();
  }

  if (img.complete) { init(); } else { img.addEventListener('load', init); }
})();
