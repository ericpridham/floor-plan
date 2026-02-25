(function () {
  'use strict';

  // ─── State ────────────────────────────────────────────────────────────────
  let state = null;       // loaded from API: { floorplans, key_entries, room_highlights }
  let keyEntries  = [];   // [{ id, color_hex, label, sort_order }] — client-side ids
  let highlights  = {};   // { room_id: key_entry_id }
  let nextKeyId   = 1;    // client-side key for entries (real DB IDs assigned on save)
  let activeEntry = null; // key entry currently selected for painting (client id)
  let saveTimer        = null;
  let saveRetries      = 0;
  let isSaving         = false;
  let dirtyWhileSaving = false;
  let floorplans  = [];   // from state

  // Pan/zoom state
  let scale = 1;
  let panX  = 0;
  let panY  = 0;
  let isPanning    = false;
  let panStart     = null;
  let dragSortEntry = null;

  // DOM refs
  const canvasContent  = document.getElementById('canvasContent');
  const canvasViewport = document.getElementById('canvasViewport');
  const keyList        = document.getElementById('keyList');
  const saveStatus     = document.getElementById('saveStatus');
  const addEntryBtn    = document.getElementById('addEntryBtn');
  const addEntryForm   = document.getElementById('addEntryForm');
  const saveEntryBtn   = document.getElementById('saveEntryBtn');
  const cancelEntryBtn = document.getElementById('cancelEntryBtn');
  const entryColor     = document.getElementById('entryColor');
  const entryLabel     = document.getElementById('entryLabel');
  const keyLimitNote   = document.getElementById('keyLimitNote');
  const paintBadge     = document.getElementById('paintBadge');
  const paintBadgeColor = document.getElementById('paintBadgeColor');
  const paintBadgeLabel = document.getElementById('paintBadgeLabel');

  // ─── API helpers ──────────────────────────────────────────────────────────
  async function apiFetch(url, method, body) {
    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-TOKEN': window.CSRF_TOKEN,
        'Accept': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`${method} ${url} → ${res.status}`);
    return res.json();
  }

  // ─── Save ─────────────────────────────────────────────────────────────────
  function scheduleSave() {
    saveStatus.textContent = 'Unsaved changes…';
    saveRetries = 0;
    if (isSaving) { dirtyWhileSaving = true; return; }
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveAll, 1000);
  }

  async function saveAll() {
    isSaving = true;
    dirtyWhileSaving = false;
    saveStatus.textContent = 'Saving…';
    try {
      const entries = keyEntries.map((e, i) => ({
        color_hex: e.color_hex, label: e.label, sort_order: i,
      }));
      await apiFetch(window.KEY_URL, 'PUT', { entries });

      // After saving key entries, reload state to get DB-assigned ids, then save highlights.
      const freshState = await apiFetch(window.STATE_URL, 'GET');
      const dbEntries  = freshState.key_entries || [];

      // Keep client _dbId in sync with DB ids (positional match)
      keyEntries.forEach((entry, i) => {
          if (dbEntries[i]) entry._dbId = dbEntries[i].id;
      });

      // Map client entry index → DB id (by sort_order position)
      const hls = Object.entries(highlights).map(([roomId, clientEntryId]) => {
        const clientIdx = keyEntries.findIndex(e => e.id === clientEntryId);
        const dbEntry   = dbEntries[clientIdx] ?? null;
        return dbEntry ? { room_id: parseInt(roomId), key_entry_id: dbEntry.id } : null;
      }).filter(Boolean);

      await apiFetch(window.HL_URL, 'PUT', { highlights: hls });

      saveStatus.textContent = 'All changes saved';
      saveRetries = 0;
    } catch (err) {
      if (saveRetries < 5) {
        saveRetries++;
        saveStatus.textContent = `Save failed — retrying… (${saveRetries}/5)`;
        saveTimer = setTimeout(saveAll, 3000);
      } else {
        saveStatus.textContent = 'Save failed — please reload the page.';
      }
    } finally {
      isSaving = false;
      if (dirtyWhileSaving) scheduleSave();
    }
  }

  // ─── Load ─────────────────────────────────────────────────────────────────
  async function loadState() {
    try {
      state = await apiFetch(window.STATE_URL, 'GET');
      floorplans = state.floorplans || [];
      const dbEntries = state.key_entries || [];
      keyEntries = dbEntries.map(e => ({
        id: nextKeyId++, color_hex: e.color_hex, label: e.label, sort_order: e.sort_order,
        _dbId: e.id,
      }));
      // Build highlights map from DB data
      const roomHls = state.room_highlights || [];
      highlights = {};
      roomHls.forEach(hl => {
        const clientEntry = keyEntries.find(e => e._dbId === hl.key_entry_id);
        if (clientEntry) highlights[hl.room_id] = clientEntry.id;
      });
      renderCanvas();
      renderKeyList();
    } catch {
      saveStatus.textContent = 'Failed to load design state.';
    }
  }

  // ─── Canvas render ────────────────────────────────────────────────────────
  function applyTransform() {
    canvasContent.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
  }

  function renderCanvas() {
    canvasContent.innerHTML = '';

    floorplans.forEach(fp => {
      const col = document.createElement('div');
      col.className = 'flex flex-col items-center flex-shrink-0';

      // Label
      const lbl = document.createElement('p');
      lbl.className = 'text-xs font-semibold text-gray-600 mb-2 text-center';
      lbl.textContent = fp.name;
      col.appendChild(lbl);

      // Image wrapper
      const wrap = document.createElement('div');
      wrap.className = 'relative';
      wrap.style.width = '600px'; // fixed display width; aspect maintained by image

      const img = document.createElement('img');
      img.src = fp.thumbnail_url || fp.image_path;
      img.alt = fp.name;
      img.className = 'block w-full h-auto rounded shadow select-none';
      img.draggable = false;
      wrap.appendChild(img);

      // Room overlay
      const overlay = document.createElement('div');
      overlay.className = 'absolute inset-0';
      overlay.dataset.fpId = fp.id;

      const rooms = fp.rooms || [];
      rooms.forEach(room => {
        const roomEl = makeRoomEl(room, fp.id);
        overlay.appendChild(roomEl);
      });

      // Click on empty canvas area → exit paint mode
      overlay.addEventListener('mousedown', e => {
        if (e.target === overlay) exitPaintMode();
      });

      wrap.appendChild(overlay);
      col.appendChild(wrap);
      canvasContent.appendChild(col);
    });

    applyTransform();
  }

  function makeRoomEl(room, fpId) {
    const el = document.createElement('div');
    el.className = 'absolute box-border';
    el.dataset.roomId = room.id;
    el.style.cssText = `left:${room.x}%;top:${room.y}%;width:${room.width}%;height:${room.height}%;`;

    const hlEntryId = highlights[room.id];
    const entry     = hlEntryId ? keyEntries.find(e => e.id === hlEntryId) : null;

    if (entry) {
      el.style.background = hexToRgba(entry.color_hex, 0.5);
      el.style.border = `2px solid ${entry.color_hex}`;

      // Badge
      const badge = document.createElement('span');
      badge.className = 'absolute top-1 left-1 w-3 h-3 rounded-full shadow border border-white';
      badge.dataset.badge = '1';
      badge.style.background = entry.color_hex;
      el.appendChild(badge);
    } else {
      el.style.border = '1px solid rgba(0,0,0,0.1)';
    }

    el.style.cursor = activeEntry ? 'crosshair' : 'default';

    el.addEventListener('click', e => {
      e.stopPropagation();
      if (!activeEntry) return;
      const wasHighlighted = highlights[room.id] === activeEntry;
      if (wasHighlighted) {
        delete highlights[room.id];
      } else {
        highlights[room.id] = activeEntry;
      }
      renderRoomHighlights();
      scheduleSave();
    });

    return el;
  }

  function renderRoomHighlights() {
    // Re-render only the room elements (not full canvas, to avoid image flicker)
    canvasContent.querySelectorAll('[data-room-id]').forEach(el => {
      const roomId    = parseInt(el.dataset.roomId);
      const fpOverlay = el.parentElement;
      const fpId      = parseInt(fpOverlay.dataset.fpId);
      const fp        = floorplans.find(f => f.id === fpId);
      const room      = fp?.rooms?.find(r => r.id === roomId);
      if (!room) return;

      const hlEntryId = highlights[roomId];
      const entry     = hlEntryId ? keyEntries.find(e => e.id === hlEntryId) : null;

      if (entry) {
        el.style.background = hexToRgba(entry.color_hex, 0.5);
        el.style.border = `2px solid ${entry.color_hex}`;
        // Ensure badge
        if (!el.querySelector('[data-badge]')) {
          const badge = document.createElement('span');
          badge.className = 'absolute top-1 left-1 w-3 h-3 rounded-full shadow border border-white';
          badge.dataset.badge = '1';
          badge.style.background = entry.color_hex;
          el.appendChild(badge);
        } else {
          el.querySelector('[data-badge]').style.background = entry.color_hex;
        }
      } else {
        el.style.background = '';
        el.style.border = '1px solid rgba(0,0,0,0.1)';
        el.querySelector('[data-badge]')?.remove();
      }

      el.style.cursor = activeEntry ? 'crosshair' : 'default';
    });
  }

  // ─── Key panel ────────────────────────────────────────────────────────────
  function renderKeyList() {
    keyList.innerHTML = '';
    const atLimit = keyEntries.length >= 20;
    keyLimitNote.classList.toggle('hidden', !atLimit);
    addEntryBtn.classList.toggle('hidden', atLimit);

    keyEntries.forEach((entry, idx) => {
      const isActive = activeEntry === entry.id;
      const li = document.createElement('li');
      li.className = `flex items-center gap-2 px-3 py-2.5 cursor-pointer select-none transition-colors ${isActive ? 'bg-indigo-50' : 'hover:bg-gray-50'}`;
      li.dataset.entryId = entry.id;
      li.draggable = true;

      const swatch = document.createElement('span');
      swatch.className = 'w-5 h-5 rounded flex-shrink-0 border border-gray-200 shadow-sm';
      swatch.style.background = entry.color_hex;
      li.appendChild(swatch);

      const label = document.createElement('span');
      label.className = 'flex-1 text-sm truncate ' + (isActive ? 'font-semibold text-indigo-700' : 'text-gray-700');
      label.textContent = entry.label;
      li.appendChild(label);

      // Edit button
      const editBtn = document.createElement('button');
      editBtn.innerHTML = `<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a2 2 0 01-1.414.586H9v-1.414a2 2 0 01.586-1.414z"/></svg>`;
      editBtn.className = 'text-gray-400 hover:text-indigo-600 p-0.5';
      editBtn.title = 'Edit';
      editBtn.addEventListener('click', e => { e.stopPropagation(); startEditEntry(entry); });
      li.appendChild(editBtn);

      // Delete button
      const delBtn = document.createElement('button');
      delBtn.textContent = '×';
      delBtn.className = 'text-gray-400 hover:text-red-500 font-bold text-base leading-none p-0.5';
      delBtn.title = 'Remove';
      delBtn.addEventListener('click', e => {
        e.stopPropagation();
        keyEntries = keyEntries.filter(e => e.id !== entry.id);
        // Remove any highlights using this entry
        Object.keys(highlights).forEach(rid => {
          if (highlights[rid] === entry.id) delete highlights[rid];
        });
        if (activeEntry === entry.id) exitPaintMode();
        renderKeyList();
        renderRoomHighlights();
        scheduleSave();
      });
      li.appendChild(delBtn);

      // Click → select for painting
      li.addEventListener('click', () => {
        if (activeEntry === entry.id) {
          exitPaintMode();
        } else {
          enterPaintMode(entry);
        }
      });

      // Drag-to-reorder
      li.addEventListener('dragstart', () => { dragSortEntry = entry.id; li.style.opacity = '0.5'; });
      li.addEventListener('dragend',   () => { li.style.opacity = ''; dragSortEntry = null; });
      li.addEventListener('dragover',  e => e.preventDefault());
      li.addEventListener('drop', e => {
        e.preventDefault();
        if (dragSortEntry === null || dragSortEntry === entry.id) return;
        const fromIdx = keyEntries.findIndex(e => e.id === dragSortEntry);
        const toIdx   = idx;
        const [moved] = keyEntries.splice(fromIdx, 1);
        keyEntries.splice(toIdx, 0, moved);
        renderKeyList();
        scheduleSave();
      });

      keyList.appendChild(li);
    });
  }

  function startEditEntry(entry) {
    exitPaintMode();
    addEntryForm.classList.remove('hidden');
    addEntryBtn.classList.add('hidden');
    entryColor.value = entry.color_hex;
    entryLabel.value = entry.label;
    entryLabel.focus();
    saveEntryBtn.textContent = 'Update';
    saveEntryBtn.onclick = () => {
      const label = entryLabel.value.trim();
      if (!label) return;
      entry.color_hex = entryColor.value;
      entry.label     = label;
      closeAddForm();
      renderKeyList();
      renderRoomHighlights();
      scheduleSave();
    };
  }

  function closeAddForm() {
    addEntryForm.classList.add('hidden');
    if (keyEntries.length < 20) addEntryBtn.classList.remove('hidden');
    saveEntryBtn.textContent = 'Add';
    saveEntryBtn.onclick = null;
    entryLabel.value = '';
    entryColor.value = '#6366f1';
  }

  // ─── Paint mode ───────────────────────────────────────────────────────────
  function enterPaintMode(entry) {
    activeEntry = entry.id;
    paintBadge.classList.remove('hidden');
    paintBadge.classList.add('flex');
    paintBadgeColor.style.background = entry.color_hex;
    paintBadgeLabel.textContent = entry.label;
    canvasViewport.style.cursor = 'crosshair';
    renderKeyList();
    renderRoomHighlights();
  }

  function exitPaintMode() {
    activeEntry = null;
    paintBadge.classList.add('hidden');
    paintBadge.classList.remove('flex');
    canvasViewport.style.cursor = '';
    renderKeyList();
    renderRoomHighlights();
  }

  // ─── Pan & zoom ───────────────────────────────────────────────────────────
  canvasViewport.addEventListener('mousedown', e => {
    if (e.target !== canvasViewport && e.target !== canvasContent) return;
    if (activeEntry) { exitPaintMode(); return; }
    isPanning = true;
    panStart  = { x: e.clientX - panX, y: e.clientY - panY };
    canvasViewport.style.cursor = 'grabbing';
  });

  document.addEventListener('mousemove', e => {
    if (!isPanning) return;
    panX = e.clientX - panStart.x;
    panY = e.clientY - panStart.y;
    applyTransform();
  });

  document.addEventListener('mouseup', () => {
    isPanning = false;
    canvasViewport.style.cursor = activeEntry ? 'crosshair' : '';
  });

  canvasViewport.addEventListener('wheel', e => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    scale = Math.max(0.2, Math.min(4, scale * delta));
    applyTransform();
  }, { passive: false });

  document.getElementById('zoomIn').addEventListener('click',    () => { scale = Math.min(4, scale * 1.2); applyTransform(); });
  document.getElementById('zoomOut').addEventListener('click',   () => { scale = Math.max(0.2, scale * 0.8); applyTransform(); });
  document.getElementById('zoomReset').addEventListener('click', () => { scale = 1; panX = 0; panY = 0; applyTransform(); });

  // ─── Add-entry form ───────────────────────────────────────────────────────
  addEntryBtn.addEventListener('click', () => {
    addEntryForm.classList.remove('hidden');
    addEntryBtn.classList.add('hidden');
    entryLabel.focus();
  });

  cancelEntryBtn.addEventListener('click', closeAddForm);

  saveEntryBtn.addEventListener('click', () => {
    if (saveEntryBtn.onclick) return; // editing existing
    const label = entryLabel.value.trim();
    if (!label || keyEntries.length >= 20) return;
    keyEntries.push({ id: nextKeyId++, color_hex: entryColor.value, label, sort_order: keyEntries.length });
    closeAddForm();
    renderKeyList();
    scheduleSave();
  });

  entryLabel.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); saveEntryBtn.click(); }
    if (e.key === 'Escape') closeAddForm();
  });

  // ─── Keyboard ─────────────────────────────────────────────────────────────
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') exitPaintMode();
  });

  // ─── Helpers ──────────────────────────────────────────────────────────────
  function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  // ─── Init ─────────────────────────────────────────────────────────────────
  loadState();
})();
