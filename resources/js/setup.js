// Room editor for floorplan setup mode
// Rooms are stored as percentage-based coordinates (0-100) relative to the image dimensions.

(function () {
  'use strict';

  // ─── State ────────────────────────────────────────────────────────────────
  let rooms = [];        // [{ id, name, x, y, width, height }] — id is client-side only (counter)
  let nextId = 1;
  let selected = null;   // id of selected room, or null
  let saveTimer = null;
  let saveRetries = 0;

  // Drawing state
  let isDrawing = false;
  let drawStartPct = null; // { x, y } in percentage

  // Dragging/resizing state
  let dragState = null; // { type: 'move'|'resize', handle: string, startPct, startRoom }

  // DOM refs
  const overlay   = document.getElementById('roomOverlay');
  const img       = document.getElementById('floorplanImg');
  const roomList  = document.getElementById('roomList');
  const roomCount = document.getElementById('roomCount');
  const saveStatus = document.getElementById('saveStatus');

  // ─── Coordinate helpers ───────────────────────────────────────────────────
  function imgRect() { return img.getBoundingClientRect(); }

  function clientToPct(clientX, clientY) {
    const r = imgRect();
    return {
      x: Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100)),
      y: Math.max(0, Math.min(100, ((clientY - r.top) / r.height) * 100)),
    };
  }

  // ─── Save ──────────────────────────────────────────────────────────────────
  function scheduleSave() {
    saveStatus.textContent = 'Unsaved changes…';
    clearTimeout(saveTimer);
    saveRetries = 0;
    saveTimer = setTimeout(save, 500);
  }

  async function save() {
    saveStatus.textContent = 'Saving…';
    const payload = rooms.map(({ name, x, y, width, height }) => ({ name, x, y, width, height }));
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
    // Remove old room divs (keep name-prompt if present)
    overlay.querySelectorAll('.room-rect').forEach(el => el.remove());

    rooms.forEach(room => {
      const el = makeRoomEl(room);
      overlay.appendChild(el);
    });

    // Sidebar list
    renderList();
    roomCount.textContent = rooms.length;
  }

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

    // Show delete on hover
    el.addEventListener('mouseenter', () => del.style.opacity = '1');
    el.addEventListener('mouseleave', () => { if (selected !== room.id) del.style.opacity = '0'; });
    if (isSelected) del.style.opacity = '1';

    // Double-click label → rename
    label.style.pointerEvents = 'auto';
    label.style.cursor = 'text';
    label.addEventListener('dblclick', e => { e.stopPropagation(); startRename(room.id, label); });

    // Click → select
    el.addEventListener('mousedown', e => {
      if (e.target === del) return;
      e.stopPropagation();
      selectRoom(room.id);
      startMove(e, room);
    });

    // Resize handles (8 handles) — only when selected
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

  function renderList() {
    roomList.innerHTML = '';
    rooms.forEach(room => {
      const li = document.createElement('li');
      li.className = `px-4 py-2.5 cursor-pointer flex items-center gap-2 transition-colors ${selected === room.id ? 'bg-indigo-50 text-indigo-900 font-medium' : 'text-gray-700 hover:bg-gray-50'}`;
      li.dataset.id = room.id;

      const dot = document.createElement('span');
      dot.className = 'w-2 h-2 rounded-full bg-indigo-400 flex-shrink-0';
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

  // ─── Rename (inline) ──────────────────────────────────────────────────────
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

  // ─── Name prompt (after drawing) ──────────────────────────────────────────
  function showNamePrompt(room) {
    // Show inline input at the room position
    const prompt = document.createElement('div');
    prompt.className = 'absolute z-20 bg-white rounded-lg shadow-lg border border-indigo-200 p-2 flex gap-1 items-center';
    prompt.style.cssText = `left:${room.x}%;top:${room.y}%;transform:translateY(-110%);`;

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Room name';
    input.className = 'text-sm border border-gray-300 rounded px-2 py-1 outline-none focus:border-indigo-500 w-36';
    input.autofocus = true;

    const btn = document.createElement('button');
    btn.textContent = '✓';
    btn.className = 'px-2 py-1 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700';

    prompt.appendChild(input);
    prompt.appendChild(btn);
    overlay.appendChild(prompt);
    input.focus();

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
      if (!val) render(); // remove preview
      else render();
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
    input.addEventListener('blur', e => {
      setTimeout(() => {
        if (!committed && !cancelled) commit();
      }, 150);
    });
  }

  // ─── Drawing ──────────────────────────────────────────────────────────────
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
    previewEl.style.left = x + '%';
    previewEl.style.top  = y + '%';
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

    // Ignore tiny accidental drags
    if (w < 1 || h < 1) return;

    const room = { id: nextId++, name: '', x: +x.toFixed(4), y: +y.toFixed(4), width: +w.toFixed(4), height: +h.toFixed(4) };

    // Show name prompt (don't push to rooms yet — commit on confirm)
    showNamePrompt(room);
  }

  // ─── Move ─────────────────────────────────────────────────────────────────
  function startMove(e, room) {
    const startPct = clientToPct(e.clientX, e.clientY);
    dragState = {
      type: 'move',
      startPct,
      startRoom: { ...room },
    };
  }

  function onMove(e) {
    if (!dragState) return;
    const cur = clientToPct(e.clientX, e.clientY);
    const dx = cur.x - dragState.startPct.x;
    const dy = cur.y - dragState.startPct.y;
    const room = rooms.find(r => r.id === selected);
    if (!room) return;

    if (dragState.type === 'move') {
      room.x = Math.max(0, Math.min(100 - room.width,  dragState.startRoom.x + dx));
      room.y = Math.max(0, Math.min(100 - room.height, dragState.startRoom.y + dy));
    } else if (dragState.type === 'resize') {
      applyResize(room, dragState.handle, dragState.startRoom, dx, dy);
    }

    // Live update position of the DOM element for performance
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

  // ─── Resize ───────────────────────────────────────────────────────────────
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
    if (e.target === overlay) {
      deselectAll();
      startDraw(e);
    }
  });

  document.addEventListener('mousemove', e => {
    updateDraw(e);
    onMove(e);
  });

  document.addEventListener('mouseup', e => {
    if (isDrawing) endDraw(e);
    endMove();
  });

  document.addEventListener('keydown', e => {
    if ((e.key === 'Delete' || e.key === 'Backspace') && selected !== null) {
      // Only if not in an input
      if (document.activeElement.tagName === 'INPUT') return;
      deleteRoom(selected);
    }
    if (e.key === 'Escape') deselectAll();
  });

  // ─── Init ─────────────────────────────────────────────────────────────────
  function init() {
    (window.INITIAL_ROOMS || []).forEach(r => {
      rooms.push({ id: nextId++, name: r.name, x: +r.x, y: +r.y, width: +r.width, height: +r.height });
    });
    render();
  }

  // Wait for image to load so dimensions are known
  if (img.complete) { init(); } else { img.addEventListener('load', init); }
})();
