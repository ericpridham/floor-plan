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
    if (isSaving) { dirtyWhileSaving = true; return; }
    saveRetries = 0;
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

      const iconPayload = placedIcons.map(({ icon_library_id, x, y, width, height, rotation, is_free_placed, z_order }) =>
        ({ icon_library_id, x, y, width, height, rotation, is_free_placed, z_order }));
      await apiFetch(window.ICONS_SYNC_URL, 'PUT', { icons: iconPayload });

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

      const dbIcons = state.icons || [];
      placedIcons = dbIcons.map(ic => ({
        id: nextIconId++, icon_library_id: ic.icon_library_id,
        x: ic.x, y: ic.y, width: ic.width, height: ic.height,
        rotation: ic.rotation, is_free_placed: ic.is_free_placed, z_order: ic.z_order,
      }));

      renderCanvas();
      renderKeyList();
      renderPlacedIcons();
      loadIcons();
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
      wrap.dataset.fpWrap = fp.id;

      const img = document.createElement('img');
      img.crossOrigin = 'anonymous';
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
    if (placingIconId) {
      const rect = canvasContent.getBoundingClientRect();
      const cx = (e.clientX - rect.left) / scale;
      const cy = (e.clientY - rect.top) / scale;
      placeIcon(cx, cy);
      return;
    }
    if (e.target !== canvasViewport && e.target !== canvasContent) return;
    if (activeEntry) { exitPaintMode(); return; }
    isPanning = true;
    panStart  = { x: e.clientX - panX, y: e.clientY - panY };
    canvasViewport.style.cursor = 'grabbing';
  });

  document.addEventListener('mousemove', e => {
    handleIconMouseMove(e);
    if (!isPanning) return;
    panX = e.clientX - panStart.x;
    panY = e.clientY - panStart.y;
    applyTransform();
  });

  document.addEventListener('mouseup', () => {
    handleIconMouseUp();
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
    if (e.key === 'Escape') {
      exitPaintMode();
      exitIconPlacementMode();
      if (zContextMenu) { zContextMenu.remove(); zContextMenu = null; }
      closeExportModal();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
      e.preventDefault();
      if (selectedIcon !== null) {
        const orig = placedIcons.find(i => i.id === selectedIcon);
        if (orig) {
          const copy = { ...orig, id: nextIconId++, x: orig.x + 16, y: orig.y + 16, z_order: placedIcons.length };
          placedIcons.push(copy);
          selectedIcon = copy.id;
          renderPlacedIcons();
          scheduleSave();
        }
      }
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIcon !== null && document.activeElement.tagName !== 'INPUT') {
      deleteSelectedIcon();
    }
  });

  // ─── Helpers ──────────────────────────────────────────────────────────────
  function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  // ─── Icon panel ───────────────────────────────────────────────────────────
  let allIcons       = { built_in: [], custom: [] };
  let placingIconId  = null;
  let placedIcons    = [];
  let selectedIcon   = null;
  let nextIconId     = 1;
  let isGridMode     = true;
  const GRID_SIZE    = 24;

  function loadIcons() {
    fetch(window.ICONS_URL, {
      headers: { 'X-CSRF-TOKEN': window.CSRF_TOKEN, 'Accept': 'application/json' }
    })
    .then(r => r.json())
    .then(data => {
      allIcons = data;
      renderIconPanel();
    })
    .catch(err => {
      console.error('Failed to load icons:', err);
      saveStatus.textContent = 'Failed to load icons.';
    });
  }

  function renderIconPanel() {
    const container = document.getElementById('iconListContainer');
    if (!container) return;
    const search = (document.getElementById('iconSearch')?.value || '').toLowerCase();

    container.innerHTML = '';

    const customFiltered = allIcons.custom.filter(i =>
      i.label.toLowerCase().includes(search) || i.category.toLowerCase().includes(search));
    if (customFiltered.length > 0) {
      renderIconSection(container, 'My Icons', customFiltered, true);
    }

    const categories = [...new Set(allIcons.built_in.map(i => i.category))];
    categories.forEach(cat => {
      const icons = allIcons.built_in.filter(i =>
        i.category === cat &&
        (i.label.toLowerCase().includes(search) || cat.toLowerCase().includes(search) || !search));
      if (icons.length > 0) renderIconSection(container, cat, icons, false);
    });
  }

  function renderIconSection(container, title, icons, isCustom) {
    const section = document.createElement('div');
    section.className = 'mb-1';

    const heading = document.createElement('p');
    heading.className = 'text-xs font-semibold text-gray-500 uppercase tracking-wide px-2 pt-2 pb-1';
    heading.textContent = title;
    section.appendChild(heading);

    const grid = document.createElement('div');
    grid.className = 'grid grid-cols-3 gap-1 px-1 pb-2';

    icons.forEach(icon => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'flex flex-col items-center gap-0.5 p-1 rounded hover:bg-indigo-50 text-center group transition-colors';
      btn.title = icon.label;
      btn.dataset.iconId = icon.id;

      const img = document.createElement('img');
      img.crossOrigin = 'anonymous';
      img.src = icon.url;
      img.alt = icon.label;
      img.className = 'w-8 h-8 object-contain';
      btn.appendChild(img);

      const lbl = document.createElement('span');
      lbl.className = 'text-xs text-gray-500 group-hover:text-indigo-700 leading-tight truncate w-full text-center';
      lbl.textContent = icon.label;
      btn.appendChild(lbl);

      if (isCustom) {
        const del = document.createElement('button');
        del.type = 'button';
        del.className = 'text-red-400 hover:text-red-600 text-xs mt-0.5';
        del.textContent = '×';
        del.title = 'Delete icon';
        del.addEventListener('click', e => { e.stopPropagation(); deleteCustomIcon(icon.id, icon.label); });
        btn.appendChild(del);
      }

      btn.addEventListener('click', () => enterIconPlacementMode(icon.id));
      grid.appendChild(btn);
    });

    section.appendChild(grid);
    container.appendChild(section);
  }

  function enterIconPlacementMode(iconId) {
    placingIconId = iconId;
    selectedIcon  = null;
    exitPaintMode();
    document.getElementById('canvasViewport').style.cursor = 'crosshair';
    saveStatus.textContent = 'Click canvas to place icon…';
  }

  function exitIconPlacementMode() {
    placingIconId = null;
    document.getElementById('canvasViewport').style.cursor = '';
  }

  function snapToGrid(val) {
    if (!isGridMode) return val;
    return Math.round(val / GRID_SIZE) * GRID_SIZE;
  }

  function placeIcon(canvasX, canvasY) {
    const icon = [...allIcons.built_in, ...allIcons.custom].find(i => i.id === placingIconId);
    if (!icon) return;
    const x = snapToGrid(canvasX - 24);
    const y = snapToGrid(canvasY - 24);
    const newIcon = {
      id: nextIconId++, icon_library_id: icon.id,
      x, y, width: 48, height: 48, rotation: 0,
      is_free_placed: !isGridMode,
      z_order: placedIcons.length,
    };
    placedIcons.push(newIcon);
    exitIconPlacementMode();
    renderPlacedIcons();
    scheduleSave();
  }

  function renderPlacedIcons() {
    canvasContent.querySelectorAll('.placed-icon').forEach(el => el.remove());

    const sorted = [...placedIcons].sort((a, b) => a.z_order - b.z_order);

    sorted.forEach(icon => {
      const iconData = [...allIcons.built_in, ...allIcons.custom].find(i => i.id === icon.icon_library_id);
      if (!iconData) return;

      const el = document.createElement('div');
      el.className = 'placed-icon absolute';
      el.dataset.iconClientId = icon.id;
      el.style.cssText = `
        left: ${icon.x}px; top: ${icon.y}px;
        width: ${icon.width}px; height: ${icon.height}px;
        transform: rotate(${icon.rotation}deg);
        transform-origin: center;
        cursor: move;
        position: absolute;
        z-index: ${10 + icon.z_order};
      `;

      const img = document.createElement('img');
      img.crossOrigin = 'anonymous';
      img.src = iconData.url;
      img.alt = iconData.label;
      img.style.cssText = 'width:100%;height:100%;object-fit:contain;pointer-events:none;user-select:none;';
      img.draggable = false;
      el.appendChild(img);

      if (selectedIcon === icon.id) {
        el.style.outline = '2px solid #6366f1';
        el.style.outlineOffset = '2px';

        const delBtn = document.createElement('button');
        delBtn.textContent = '×';
        delBtn.className = 'absolute -top-3 -right-3 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center z-20 leading-none';
        delBtn.addEventListener('mousedown', e => { e.stopPropagation(); deleteSelectedIcon(); });
        el.appendChild(delBtn);

        const rotHandle = document.createElement('div');
        rotHandle.className = 'absolute -top-8 left-1/2 w-3 h-3 bg-white border-2 border-indigo-500 rounded-full cursor-grab z-20';
        rotHandle.style.transform = 'translateX(-50%)';
        rotHandle.addEventListener('mousedown', e => { e.stopPropagation(); startRotate(e, icon); });
        el.appendChild(rotHandle);

        [['nw', 'top-0 left-0', 'nw-resize', 'translate(-50%,-50%)'],
         ['ne', 'top-0 right-0', 'ne-resize', 'translate(50%,-50%)'],
         ['sw', 'bottom-0 left-0', 'sw-resize', 'translate(-50%,50%)'],
         ['se', 'bottom-0 right-0', 'se-resize', 'translate(50%,50%)']].forEach(([name, pos, cur, transform]) => {
          const h = document.createElement('div');
          h.className = `absolute w-3 h-3 bg-white border-2 border-indigo-500 rounded-sm z-20 ${pos}`;
          h.style.cursor = cur;
          h.style.transform = transform;
          h.addEventListener('mousedown', e => { e.stopPropagation(); startIconResize(e, icon, name); });
          el.appendChild(h);
        });
      }

      el.addEventListener('mousedown', e => {
        e.stopPropagation();
        if (placingIconId) return;
        selectedIcon = icon.id;
        startIconMove(e, icon);
        renderPlacedIcons();
      });

      el.addEventListener('contextmenu', e => {
        e.preventDefault();
        showZOrderMenu(e, icon);
      });

      canvasContent.appendChild(el);
    });
  }

  // ─── Icon drag/resize/rotate ──────────────────────────────────────────────
  let iconDragState = null;

  function startIconMove(e, icon) {
    iconDragState = {
      type: 'move', icon,
      startX: e.clientX, startY: e.clientY,
      origX: icon.x, origY: icon.y,
    };
  }

  function startIconResize(e, icon, handle) {
    iconDragState = {
      type: 'resize', icon, handle,
      startX: e.clientX, startY: e.clientY,
      origWidth: icon.width, origHeight: icon.height,
      origX: icon.x, origY: icon.y,
    };
  }

  function startRotate(e, icon) {
    const rect = canvasContent.querySelector(`[data-icon-client-id="${icon.id}"]`)?.getBoundingClientRect();
    if (!rect) return;
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    iconDragState = { type: 'rotate', icon, centerX, centerY };
  }

  function handleIconMouseMove(e) {
    if (!iconDragState) return;
    const { type, icon } = iconDragState;

    if (type === 'move') {
      const dx = (e.clientX - iconDragState.startX) / scale;
      const dy = (e.clientY - iconDragState.startY) / scale;
      icon.x = snapToGrid(iconDragState.origX + dx);
      icon.y = snapToGrid(iconDragState.origY + dy);
      const el = canvasContent.querySelector(`[data-icon-client-id="${icon.id}"]`);
      if (el) { el.style.left = icon.x + 'px'; el.style.top = icon.y + 'px'; }
    } else if (type === 'resize') {
      const dx = (e.clientX - iconDragState.startX) / scale;
      const dy = (e.clientY - iconDragState.startY) / scale;
      const delta = (Math.abs(dx) > Math.abs(dy) ? dx : dy);
      if (e.shiftKey) {
        icon.width  = Math.max(16, iconDragState.origWidth + dx);
        icon.height = Math.max(16, iconDragState.origHeight + dy);
      } else {
        const newSize = Math.max(16, iconDragState.origWidth + delta);
        icon.width = icon.height = newSize;
      }
      const el = canvasContent.querySelector(`[data-icon-client-id="${icon.id}"]`);
      if (el) { el.style.width = icon.width + 'px'; el.style.height = icon.height + 'px'; }
    } else if (type === 'rotate') {
      const angle = Math.atan2(e.clientY - iconDragState.centerY, e.clientX - iconDragState.centerX) * 180 / Math.PI + 90;
      icon.rotation = isGridMode ? Math.round(angle / 15) * 15 : Math.round(angle * 10) / 10;
      const el = canvasContent.querySelector(`[data-icon-client-id="${icon.id}"]`);
      if (el) el.style.transform = `rotate(${icon.rotation}deg)`;
    }
  }

  function handleIconMouseUp() {
    if (iconDragState) {
      iconDragState = null;
      renderPlacedIcons();
      scheduleSave();
    }
  }

  function deleteSelectedIcon() {
    if (selectedIcon === null) return;
    placedIcons = placedIcons.filter(i => i.id !== selectedIcon);
    selectedIcon = null;
    renderPlacedIcons();
    scheduleSave();
  }

  // ─── Z-order context menu ─────────────────────────────────────────────────
  let zContextMenu = null;

  function showZOrderMenu(e, icon) {
    if (zContextMenu) zContextMenu.remove();
    selectedIcon = icon.id;
    renderPlacedIcons();

    const menu = document.createElement('div');
    menu.className = 'fixed z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-1 text-sm';
    menu.style.left = e.clientX + 'px';
    menu.style.top  = e.clientY + 'px';
    zContextMenu = menu;

    const actions = [
      ['Bring to Front', () => { icon.z_order = Math.max(...placedIcons.map(i => i.z_order)) + 1; }],
      ['Bring Forward',  () => {
        const above = placedIcons.filter(i => i.z_order > icon.z_order);
        if (above.length) { const next = Math.min(...above.map(i => i.z_order)); icon.z_order = next + 1; }
      }],
      ['Send Backward',  () => {
        const below = placedIcons.filter(i => i.z_order < icon.z_order);
        if (below.length) { const prev = Math.max(...below.map(i => i.z_order)); icon.z_order = prev - 1; }
      }],
      ['Send to Back',   () => { icon.z_order = Math.min(...placedIcons.map(i => i.z_order)) - 1; }],
    ];

    actions.forEach(([label, fn]) => {
      const item = document.createElement('button');
      item.className = 'w-full text-left px-4 py-1.5 hover:bg-gray-50 text-gray-700';
      item.textContent = label;
      item.addEventListener('click', () => {
        fn();
        menu.remove();
        zContextMenu = null;
        renderPlacedIcons();
        scheduleSave();
      });
      menu.appendChild(item);
    });

    document.body.appendChild(menu);
    setTimeout(() => {
      document.addEventListener('click', () => { menu.remove(); zContextMenu = null; }, { once: true });
    }, 0);
  }

  // ─── Custom icon upload ────────────────────────────────────────────────────
  function setupIconUpload() {
    const btn = document.getElementById('uploadIconBtn');
    if (!btn) return;
    btn.addEventListener('click', async () => {
      const label    = document.getElementById('customIconLabel').value.trim();
      const category = document.getElementById('customIconCategory').value.trim();
      const file     = document.getElementById('customIconFile').files[0];
      const errEl    = document.getElementById('uploadIconError');
      errEl.classList.add('hidden');

      if (!label || !category || !file) {
        errEl.textContent = 'All fields required.';
        errEl.classList.remove('hidden');
        return;
      }

      const formData = new FormData();
      formData.append('label', label);
      formData.append('category', category);
      formData.append('icon', file);
      formData.append('_token', window.CSRF_TOKEN);

      try {
        const res = await fetch(window.ICON_UPLOAD_URL, { method: 'POST', body: formData });
        if (!res.ok) {
          const err = await res.json();
          errEl.textContent = Object.values(err.errors || {}).flat().join(' ');
          errEl.classList.remove('hidden');
          return;
        }
        const icon = await res.json();
        allIcons.custom.unshift(icon);
        document.getElementById('customIconLabel').value = '';
        document.getElementById('customIconCategory').value = '';
        document.getElementById('customIconFile').value = '';
        renderIconPanel();
      } catch {
        errEl.textContent = 'Upload failed.';
        errEl.classList.remove('hidden');
      }
    });
  }

  async function deleteCustomIcon(iconId, label) {
    if (!confirm(`Delete "${label}"? It may be used in designs.`)) return;

    try {
      const res = await fetch(`${window.ICON_DELETE_URL}/${iconId}`, {
        method: 'DELETE',
        headers: { 'X-CSRF-TOKEN': window.CSRF_TOKEN, 'Accept': 'application/json' },
      });
      if (res.ok) {
        allIcons.custom = allIcons.custom.filter(i => i.id !== iconId);
        renderIconPanel();
      } else {
        saveStatus.textContent = 'Failed to delete icon.';
      }
    } catch {
      saveStatus.textContent = 'Failed to delete icon.';
    }
  }

  // ─── Grid/Free mode buttons ────────────────────────────────────────────────
  document.getElementById('gridModeBtn')?.addEventListener('click', () => {
    isGridMode = true;
    document.getElementById('gridModeBtn').className = 'text-xs px-2 py-1 rounded bg-indigo-100 text-indigo-700 font-medium';
    document.getElementById('freeModeBtn').className = 'text-xs px-2 py-1 rounded text-gray-500 hover:bg-gray-100';
  });

  document.getElementById('freeModeBtn')?.addEventListener('click', () => {
    isGridMode = false;
    document.getElementById('freeModeBtn').className = 'text-xs px-2 py-1 rounded bg-indigo-100 text-indigo-700 font-medium';
    document.getElementById('gridModeBtn').className = 'text-xs px-2 py-1 rounded text-gray-500 hover:bg-gray-100';
  });

  document.getElementById('iconSearch')?.addEventListener('input', renderIconPanel);

  // ─── PNG Export ───────────────────────────────────────────────────────────

  function slugify(str) {
    return str.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim()
      .replace(/^-+|-+$/g, '');
  }

  function defaultExportFilename() {
    const today = new Date();
    const dateStr = today.getFullYear() + '-' +
      String(today.getMonth() + 1).padStart(2, '0') + '-' +
      String(today.getDate()).padStart(2, '0');
    return (slugify(window.DESIGN_NAME) || 'design') + '-' + dateStr + '.png';
  }

  function loadImageWithCors(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load: ' + src));
      img.src = src;
    });
  }

  async function performExport() {
    const exportBtn    = document.getElementById('exportModalConfirm');
    const progressEl   = document.getElementById('exportProgress');
    const modalBtns    = document.getElementById('exportModalBtns');

    exportBtn.disabled = true;
    modalBtns.classList.add('opacity-50');
    progressEl.classList.remove('hidden');

    let exportFailed = false;

    try {
      // ── Dimensions ────────────────────────────────────────────────────────
      const naturalW = canvasContent.offsetWidth;
      const naturalH = canvasContent.offsetHeight;
      const LEGEND_NATURAL = 280; // legend panel width at 1x
      const MIN_W = 1200, MAX_W = 4000;
      let canvasExportW = Math.max(MIN_W, Math.min(MAX_W, naturalW * 2));
      const ratio = canvasExportW / naturalW;
      const canvasExportH = Math.round(naturalH * ratio);
      const legendW = Math.round(LEGEND_NATURAL * ratio);
      const totalW = canvasExportW + legendW;

      // ── Collect floorplan positions & images ──────────────────────────────
      const fpWrapMap = {}; // fpId → { el, img, rect }
      canvasContent.querySelectorAll('[data-fp-wrap]').forEach(wrapEl => {
        const fpId = parseInt(wrapEl.dataset.fpWrap);
        const fp = floorplans.find(f => f.id === fpId);
        if (!fp) return;
        fpWrapMap[fpId] = { el: wrapEl, fp };
      });

      // Load all floorplan images
      const fpImagePromises = Object.entries(fpWrapMap).map(async ([fpId, data]) => {
        const imgEl = data.el.querySelector('img');
        const src = imgEl ? imgEl.src : (data.fp.thumbnail_url || data.fp.image_path);
        try {
          data.image = await loadImageWithCors(src);
        } catch {
          data.image = null;
        }
      });

      // Load all unique placed icon images
      const usedIconIds = [...new Set(placedIcons.map(i => i.icon_library_id))];
      const iconImageMap = {};
      const iconImagePromises = usedIconIds.map(async id => {
        const iconData = [...allIcons.built_in, ...allIcons.custom].find(i => i.id === id);
        if (!iconData) return;
        try {
          iconImageMap[id] = await loadImageWithCors(iconData.url);
          iconImageMap[id + '__data'] = iconData;
        } catch {
          // skip failed icons
        }
      });

      await Promise.all([...fpImagePromises, ...iconImagePromises]);

      // ── Create canvas ─────────────────────────────────────────────────────
      const canvas = document.createElement('canvas');
      canvas.width  = totalW;
      canvas.height = canvasExportH;
      const ctx = canvas.getContext('2d');

      // White background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, totalW, canvasExportH);

      // ── Draw canvas region ────────────────────────────────────────────────
      // Clip to canvas region
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, canvasExportW, canvasExportH);
      ctx.clip();

      // Gray background for canvas area
      ctx.fillStyle = '#f3f4f6';
      ctx.fillRect(0, 0, canvasExportW, canvasExportH);

      const contentRect = canvasContent.getBoundingClientRect();

      // Draw floorplan images + room highlights
      Object.entries(fpWrapMap).forEach(([fpId, data]) => {
        if (!data.image) return;
        const wrapRect = data.el.getBoundingClientRect();
        // Convert to natural canvasContent-relative coordinates
        const natX = (wrapRect.left - contentRect.left) / scale;
        const natY = (wrapRect.top  - contentRect.top)  / scale;
        const natW = data.el.offsetWidth;
        const natH = data.el.offsetHeight;

        const ex = Math.round(natX * ratio);
        const ey = Math.round(natY * ratio);
        const ew = Math.round(natW * ratio);
        const eh = Math.round(natH * ratio);

        // Draw floorplan image
        ctx.drawImage(data.image, ex, ey, ew, eh);

        // Draw room highlights
        const fp = data.fp;
        (fp.rooms || []).forEach(room => {
          const hlEntryId = highlights[room.id];
          const entry = hlEntryId ? keyEntries.find(e => e.id === hlEntryId) : null;
          if (!entry) return;

          const rx = ex + (room.x / 100) * ew;
          const ry = ey + (room.y / 100) * eh;
          const rw = (room.width  / 100) * ew;
          const rh = (room.height / 100) * eh;

          // Semi-transparent fill
          const r = parseInt(entry.color_hex.slice(1, 3), 16);
          const g = parseInt(entry.color_hex.slice(3, 5), 16);
          const b = parseInt(entry.color_hex.slice(5, 7), 16);
          ctx.fillStyle = `rgba(${r},${g},${b},0.5)`;
          ctx.fillRect(rx, ry, rw, rh);

          // Border
          ctx.strokeStyle = entry.color_hex;
          ctx.lineWidth = Math.max(1, 2 * ratio);
          ctx.strokeRect(rx, ry, rw, rh);
        });
      });

      // Draw placed icons
      const sortedIcons = [...placedIcons].sort((a, b) => a.z_order - b.z_order);
      sortedIcons.forEach(icon => {
        const img = iconImageMap[icon.icon_library_id];
        if (!img) return;
        const ex = icon.x * ratio;
        const ey = icon.y * ratio;
        const ew = icon.width  * ratio;
        const eh = icon.height * ratio;

        ctx.save();
        ctx.translate(ex + ew / 2, ey + eh / 2);
        ctx.rotate((icon.rotation * Math.PI) / 180);
        ctx.drawImage(img, -ew / 2, -eh / 2, ew, eh);
        ctx.restore();
      });

      ctx.restore(); // end canvas region clip

      // ── Draw legend region ────────────────────────────────────────────────
      const lx = canvasExportW;
      const PADDING = Math.round(20 * ratio);
      const FONT_SCALE = ratio;

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(lx, 0, legendW, canvasExportH);

      // Separator line
      ctx.strokeStyle = '#e5e7eb';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(lx, 0);
      ctx.lineTo(lx, canvasExportH);
      ctx.stroke();

      let curY = PADDING;

      // Title "Key"
      ctx.fillStyle = '#111827';
      ctx.font = `bold ${Math.round(16 * FONT_SCALE)}px -apple-system, BlinkMacSystemFont, sans-serif`;
      ctx.fillText('Key', lx + PADDING, curY + Math.round(16 * FONT_SCALE));
      curY += Math.round(16 * FONT_SCALE) + PADDING;

      // Key entries
      if (keyEntries.length > 0) {
        const SWATCH = Math.round(20 * FONT_SCALE);
        const ITEM_GAP = Math.round(12 * FONT_SCALE);
        const FONT_SIZE = Math.round(13 * FONT_SCALE);
        ctx.font = `${FONT_SIZE}px -apple-system, BlinkMacSystemFont, sans-serif`;

        keyEntries.forEach(entry => {
          if (curY + SWATCH > canvasExportH - PADDING) return; // overflow guard

          ctx.fillStyle = entry.color_hex;
          ctx.fillRect(lx + PADDING, curY, SWATCH, SWATCH);

          ctx.fillStyle = '#374151';
          ctx.fillText(
            entry.label,
            lx + PADDING + SWATCH + Math.round(8 * FONT_SCALE),
            curY + SWATCH * 0.75
          );

          curY += SWATCH + ITEM_GAP;
        });

        curY += PADDING;
      }

      // Icons used section
      const uniqueIconsUsed = [];
      const seenIconIds = new Set();
      placedIcons.forEach(pi => {
        if (seenIconIds.has(pi.icon_library_id)) return;
        seenIconIds.add(pi.icon_library_id);
        const iconData = iconImageMap[pi.icon_library_id + '__data'];
        const iconImg  = iconImageMap[pi.icon_library_id];
        if (iconData && iconImg) uniqueIconsUsed.push({ iconData, iconImg });
      });

      if (uniqueIconsUsed.length > 0) {
        // Section heading "Icons"
        ctx.fillStyle = '#6b7280';
        ctx.font = `bold ${Math.round(11 * FONT_SCALE)}px -apple-system, BlinkMacSystemFont, sans-serif`;
        ctx.fillText('ICONS', lx + PADDING, curY + Math.round(11 * FONT_SCALE));
        curY += Math.round(11 * FONT_SCALE) + Math.round(8 * FONT_SCALE);

        const THUMB = Math.round(28 * FONT_SCALE);
        const ITEM_GAP = Math.round(10 * FONT_SCALE);
        const FONT_SIZE = Math.round(12 * FONT_SCALE);
        ctx.font = `${FONT_SIZE}px -apple-system, BlinkMacSystemFont, sans-serif`;
        ctx.fillStyle = '#374151';

        uniqueIconsUsed.forEach(({ iconData, iconImg }) => {
          if (curY + THUMB > canvasExportH - PADDING) return;
          ctx.drawImage(iconImg, lx + PADDING, curY, THUMB, THUMB);
          ctx.fillStyle = '#374151';
          ctx.fillText(
            iconData.label,
            lx + PADDING + THUMB + Math.round(8 * FONT_SCALE),
            curY + THUMB * 0.65
          );
          curY += THUMB + ITEM_GAP;
        });
      }

      // ── Trigger download ──────────────────────────────────────────────────
      const dataUrl = canvas.toDataURL('image/png');
      const filename = (document.getElementById('exportFilename').value.trim() || defaultExportFilename());
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = filename.endsWith('.png') ? filename : filename + '.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      closeExportModal();

    } catch (err) {
      exportFailed = true;
      console.error('Export failed:', err);
      progressEl.textContent = 'Export failed. Please try again.';
      progressEl.classList.remove('hidden');
    } finally {
      exportBtn.disabled = false;
      modalBtns.classList.remove('opacity-50');
      if (!exportFailed) {
        progressEl.classList.add('hidden');
      }
    }
  }

  function openExportModal() {
    const modal = document.getElementById('exportModal');
    document.getElementById('exportFilename').value = defaultExportFilename();
    const progressEl = document.getElementById('exportProgress');
    progressEl.classList.add('hidden');
    progressEl.textContent = 'Generating\u2026';
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.getElementById('exportFilename').focus();
    document.getElementById('exportFilename').select();
  }

  function closeExportModal() {
    const modal = document.getElementById('exportModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }

  document.getElementById('exportBtn').addEventListener('click', openExportModal);
  document.getElementById('exportModalCancel').addEventListener('click', closeExportModal);
  document.getElementById('exportModalOverlay').addEventListener('click', closeExportModal);
  document.getElementById('exportModalConfirm').addEventListener('click', performExport);
  document.getElementById('exportFilename').addEventListener('keydown', e => {
    if (e.key === 'Enter') performExport();
    if (e.key === 'Escape') closeExportModal();
  });

  // ─── Init ─────────────────────────────────────────────────────────────────
  setupIconUpload();
  loadState();
})();
