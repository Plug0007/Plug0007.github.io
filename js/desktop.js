/* js/desktop.js
   Full-featured desktop manager with filesystem persistence (localStorage).
   Save as: js/desktop.js
*/

(() => {
  /* ---------- Config & Helpers ---------- */
  const STORAGE_KEY = 'rp_fs_v1';
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const create = (tag, cls) => { const e = document.createElement(tag); if (cls) e.className = cls; return e; };
  const nowId = (p = '') => 'id-' + Math.random().toString(36).slice(2) + (p ? '-' + p : '');

  // DOM refs (expected IDs from index.html)
  const desktopEl = document.getElementById('desktop');
  const desktopContextEl = document.getElementById('desktop-context');
  const iconContextEl = document.getElementById('icon-context');
  const taskItemsEl = document.getElementById('task-items');
  const clockEl = document.getElementById('clock');
  const menuBtn = document.getElementById('menu-button');

  let zIndexCounter = 1000;
  let windows = []; // {id, node, title, taskItem}
  let fs = null;    // filesystem object loaded from storage or default

  /* ---------- Default filesystem ---------- */
  const DEFAULT_FS = {
    Desktop: {
      "About System": { type: "app", id: nowId('about') },
      "Projects": { type: "folder", id: nowId('projects'), children: {
          "project1.html": { type: "file", id: nowId('p1'), url: "projects/project1.html" },
          "project2.html": { type: "file", id: nowId('p2'), url: "projects/project2.html" }
        }
      },
      "Resume.pdf": { type: "file", id: nowId('resume'), url: "assets/resume.pdf" },
      "Terminal": { type: "app", id: nowId('term') },
      "Trash": { type: "trash", id: nowId('trash'), items: {} }
    }
  };

  /* ---------- Persistence ---------- */
  function loadFS() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) { fs = DEFAULT_FS; saveFS(); return; }
      fs = JSON.parse(raw);
      // In case older key missing Desktop, merge defaults
      if (!fs.Desktop) fs.Desktop = DEFAULT_FS.Desktop;
    } catch (e) {
      console.error('Failed reading FS, loading default', e);
      fs = DEFAULT_FS;
    }
  }
  function saveFS() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fs));
  }
  function resetFS() { localStorage.removeItem(STORAGE_KEY); loadFS(); renderDesktop(); }

  /* ---------- Render Desktop Icons ---------- */
  function renderDesktop() {
    desktopEl.innerHTML = '';
    const items = fs.Desktop || {};
    Object.keys(items).forEach(name => {
      const meta = items[name];
      const icon = create('div', 'desktop-icon');
      icon.dataset.name = name;
      icon.dataset.type = meta.type;
      icon.dataset.id = meta.id || '';
      // choose icon src based on type/extension (your assets should match names used)
      const img = create('img');
      const src = chooseIconSrc(name, meta);
      img.src = src;
      img.alt = name;
      const label = create('span');
      label.textContent = name;
      icon.appendChild(img);
      icon.appendChild(label);

      // Single click selects
      icon.addEventListener('click', (ev) => {
        ev.stopPropagation();
        $$('.desktop-icon.selected').forEach(n => n.classList.remove('selected'));
        icon.classList.add('selected');
      });

      // Double click opens
      icon.addEventListener('dblclick', (ev) => {
        ev.stopPropagation();
        openItem(name, meta);
      });

      // Right click on icon
      icon.addEventListener('contextmenu', (ev) => {
        ev.preventDefault(); ev.stopPropagation();
        $$('.desktop-icon.selected').forEach(n => n.classList.remove('selected'));
        icon.classList.add('selected');
        showIconContext(ev.pageX, ev.pageY, name, meta);
      });

      desktopEl.appendChild(icon);
    });
  }

  function chooseIconSrc(name, meta) {
    // defaults - ensure these files exist in assets/icons (file.png folder.png app.png trash.png terminal.png info.png html.png pdf.png)
    if (meta.type === 'folder') return 'assets/icons/folder.png';
    if (meta.type === 'trash') return 'assets/icons/trash.png';
    if (meta.type === 'app') {
      if (name.toLowerCase().includes('terminal')) return 'assets/icons/terminal.png';
      if (name.toLowerCase().includes('about')) return 'assets/icons/info.png';
      return 'assets/icons/app.png';
    }
    if (meta.type === 'file') {
      if ((meta.url||'').endsWith('.pdf')) return 'assets/icons/pdf.png';
      if ((name||'').toLowerCase().endsWith('.html')) return 'assets/icons/html.png';
      return 'assets/icons/file.png';
    }
    return 'assets/icons/file.png';
  }

  /* ---------- Context Menus ---------- */
  function hideAllContexts() {
    if (desktopContextEl) desktopContextEl.classList.add('hidden');
    if (iconContextEl) iconContextEl.classList.add('hidden');
    $$('.desktop-icon.selected').forEach(n => n.classList.remove('selected'));
  }

  // Desktop right-click
  desktopEl.addEventListener('contextmenu', (ev) => {
    ev.preventDefault();
    if (ev.target.closest('.desktop-icon')) return; // handled by icon
    showDesktopContext(ev.pageX, ev.pageY);
  });

  function showDesktopContext(x, y) {
    if (!desktopContextEl) return;
    desktopContextEl.style.left = x + 'px';
    desktopContextEl.style.top = y + 'px';
    desktopContextEl.classList.remove('hidden');

    // add handlers
    desktopContextEl.onclick = (ev) => {
      const action = ev.target.getAttribute('data-action');
      if (!action) return;
      if (action === 'new-folder') promptNewFolder();
      if (action === 'new-file') promptNewFile();
      if (action === 'open-terminal') openTerminalWindow();
      if (action === 'refresh') renderDesktop();
      if (action === 'reset') { if(confirm('Reset desktop to default?')) { resetFS(); } }
      desktopContextEl.classList.add('hidden');
    }
  }

  function showIconContext(x, y, name, meta) {
    if (!iconContextEl) return;
    iconContextEl.style.left = x + 'px';
    iconContextEl.style.top = y + 'px';
    iconContextEl.classList.remove('hidden');

    iconContextEl.onclick = (ev) => {
      const act = ev.target.getAttribute('data-action');
      if (!act) return;
      if (act === 'open') openItem(name, meta);
      else if (act === 'rename') {
        const nn = prompt('Rename', name);
        if (nn && nn.trim()) {
          fs.Desktop[nn.trim()] = meta;
          delete fs.Desktop[name];
          saveFS(); renderDesktop();
        }
      } else if (act === 'delete') {
        deleteItemToTrash(name);
      } else if (act === 'properties') {
        openProperties(name, meta);
      }
      iconContextEl.classList.add('hidden');
    }
  }

  // hide context menus on click anywhere
  document.addEventListener('click', () => hideAllContexts());

  /* ---------- New Folder / File ---------- */
  function promptNewFolder() {
    const name = prompt('Folder name:');
    if (!name) return;
    if (fs.Desktop[name]) return alert('Name already exists on desktop.');
    fs.Desktop[name] = { type: 'folder', id: nowId('fld'), children: {} };
    saveFS(); renderDesktop();
  }
  function promptNewFile() {
    const name = prompt('File name (with extension):', 'new.txt');
    if (!name) return;
    if (fs.Desktop[name]) return alert('Name already exists on desktop.');
    fs.Desktop[name] = { type: 'file', id: nowId('file'), url: null, content: '' };
    saveFS(); renderDesktop();
  }

  /* ---------- Delete -> Trash, Restore ---------- */
  function deleteItemToTrash(name) {
    if (!fs.Desktop[name]) return;
    // ensure Trash exists
    if (!fs.Desktop.Trash || fs.Desktop.Trash.type !== 'trash') {
      fs.Desktop.Trash = { type: 'trash', id: nowId('trash'), items: {} };
    }
    fs.Desktop.Trash.items[name] = fs.Desktop[name];
    delete fs.Desktop[name];
    saveFS(); renderDesktop();
    alert(`${name} moved to Trash.`);
  }

  function emptyTrash() {
    if (fs.Desktop.Trash) {
      fs.Desktop.Trash.items = {};
      saveFS();
    }
  }

  function restoreFromTrash(name) {
    const trash = fs.Desktop.Trash;
    if (!trash || !trash.items[name]) return;
    fs.Desktop[name] = trash.items[name];
    delete trash.items[name];
    saveFS(); renderDesktop();
  }

  /* ---------- Open Items: folders, files, apps ---------- */
  function openItem(name, meta) {
    if (!meta) meta = fs.Desktop[name];
    if (!meta) return;

    if (meta.type === 'folder') {
      openFolderWindow(name, meta);
    } else if (meta.type === 'file') {
      openFileWindow(name, meta);
    } else if (meta.type === 'app') {
      if (name.toLowerCase().includes('terminal')) openTerminalWindow();
      else if (name.toLowerCase().includes('about')) openAboutWindow();
      else openAppWindow(name);
    } else if (meta.type === 'trash') {
      openTrashWindow(meta);
    } else {
      openAppWindow(name);
    }
  }

  /* ---------- Window system (createWindow, taskbar, focus, close, minimize, maximize) ---------- */
  function createWindow(title, contentNode) {
    // contentNode can be DOM node or HTML string
    const id = nowId('win');
    const win = create('div', 'window');
    win.dataset.winId = id;
    win.style.zIndex = ++zIndexCounter;

    // header - classes chosen to match many CSS variants
    const header = create('div', 'titlebar window-header');
    const titleEl = create('div', 'title');
    titleEl.textContent = title;
    const controls = create('div', 'controls');
    const btnMin = create('div', 'win-btn min'); btnMin.title = 'Minimize';
    const btnMax = create('div', 'win-btn max'); btnMax.title = 'Maximize';
    const btnClose = create('div', 'win-btn close'); btnClose.title = 'Close';
    controls.appendChild(btnMin); controls.appendChild(btnMax); controls.appendChild(btnClose);
    header.appendChild(controls); header.appendChild(titleEl);

    const content = create('div', 'content');
    if (typeof contentNode === 'string') content.innerHTML = contentNode;
    else if (contentNode instanceof HTMLElement) content.appendChild(contentNode);

    win.appendChild(header); win.appendChild(content);
    document.body.appendChild(win);

    // position cascade
    const offset = windows.length * 18;
    win.style.left = (120 + offset) + 'px';
    win.style.top = (80 + offset) + 'px';

    // add to windows list and taskbar
    const taskItem = create('div', 'task-item');
    taskItem.dataset.winId = id;
    taskItem.textContent = title;
    taskItemsEl.appendChild(taskItem);

    windows.push({ id, node: win, title, taskItem });

    // focus on click
    win.addEventListener('mousedown', () => focusWindow(id));

    // controls
    btnClose.addEventListener('click', (e) => { closeWindow(id); e.stopPropagation(); });
    btnMin.addEventListener('click', (e) => { minimizeWindow(id); e.stopPropagation(); });
    btnMax.addEventListener('click', (e) => { toggleMaximize(id); e.stopPropagation(); });

    // taskbar click
    taskItem.addEventListener('click', () => {
      const rec = windows.find(w => w.id === id);
      if (!rec) return;
      if (rec.node.classList.contains('minimized')) restoreWindow(id);
      else minimizeWindow(id);
    });

    // make drag
    makeDraggable(win, header);

    // make resizable (native css resize or custom)
    win.style.resize = 'both';
    win.style.overflow = 'auto';

    // show open animation (if CSS has keyframes)
    win.style.animation = 'windowOpen .18s ease';

    focusWindow(id);
    return { id, node: win, title, taskItem };
  }

  function focusWindow(id) {
    const rec = windows.find(w => w.id === id);
    if (!rec) return;
    windows.forEach(w => w.node.classList.remove('focused'));
    rec.node.classList.add('focused');
    rec.node.style.display = 'block';
    rec.node.style.zIndex = ++zIndexCounter;
    // highlight task
    $$('.task-item').forEach(t => t.classList.remove('active'));
    if (rec.taskItem) rec.taskItem.classList.add('active');
  }

  function closeWindow(id) {
    const idx = windows.findIndex(w => w.id === id);
    if (idx === -1) return;
    const rec = windows[idx];
    // animate close if desired
    rec.node.style.animation = 'windowClose .18s ease forwards';
    setTimeout(() => {
      rec.node.remove();
    }, 200);
    if (rec.taskItem) rec.taskItem.remove();
    windows.splice(idx, 1);
  }

  function minimizeWindow(id) {
    const rec = windows.find(w => w.id === id);
    if (!rec) return;
    rec.node.classList.add('minimized'); // CSS should hide minimized or set display: none
    rec.node.style.display = 'none';
    if (rec.taskItem) rec.taskItem.classList.add('minimized');
  }

  function restoreWindow(id) {
    const rec = windows.find(w => w.id === id);
    if (!rec) return;
    rec.node.classList.remove('minimized');
    rec.node.style.display = 'block';
    if (rec.taskItem) rec.taskItem.classList.remove('minimized');
    focusWindow(id);
  }

  function toggleMaximize(id) {
    const rec = windows.find(w => w.id === id);
    if (!rec) return;
    const n = rec.node;
    if (n.dataset.max === '1') {
      // restore
      n.style.left = n.dataset.prevLeft || '120px';
      n.style.top = n.dataset.prevTop || '80px';
      n.style.width = n.dataset.prevWidth || '';
      n.style.height = n.dataset.prevHeight || '';
      n.dataset.max = '0';
    } else {
      // store
      n.dataset.prevLeft = n.style.left;
      n.dataset.prevTop = n.style.top;
      n.dataset.prevWidth = n.style.width;
      n.dataset.prevHeight = n.style.height;
      n.style.left = '0px';
      n.style.top = '0px';
      n.style.width = (window.innerWidth - 2) + 'px';
      n.style.height = (window.innerHeight - (taskItemsEl ? taskItemsEl.offsetHeight : 40)) + 'px';
      n.dataset.max = '1';
      n.style.zIndex = ++zIndexCounter;
    }
  }

  /* ---------- Drag support ---------- */
  function makeDraggable(node, handle) {
    let dragging = false, offsetX = 0, offsetY = 0;
    handle.style.cursor = 'grab';
    handle.addEventListener('mousedown', (ev) => {
      dragging = true;
      offsetX = ev.clientX - node.getBoundingClientRect().left;
      offsetY = ev.clientY - node.getBoundingClientRect().top;
      node.style.transition = 'none';
      document.body.style.userSelect = 'none';
      focusWindow(node.dataset.winId);
    });
    document.addEventListener('mousemove', (ev) => {
      if (!dragging) return;
      if (node.dataset.max === '1') return; // don't drag maximized
      let left = ev.clientX - offsetX;
      let top = ev.clientY - offsetY;
      left = Math.max(0, Math.min(left, window.innerWidth - 60));
      top = Math.max(0, Math.min(top, window.innerHeight - 60));
      node.style.left = left + 'px';
      node.style.top = top + 'px';
    });
    document.addEventListener('mouseup', () => {
      if (dragging) {
        dragging = false;
        node.style.transition = '';
        document.body.style.userSelect = '';
      }
    });
  }

  /* ---------- Folder / File Windows ---------- */
  function openFolderWindow(name, meta) {
    // meta.children is object keyed by filename
    const wrapper = create('div', 'folder-view');
    const grid = create('div', 'folder-grid');
    wrapper.appendChild(grid);

    const children = meta.children || {};
    Object.keys(children).forEach(fname => {
      const fm = children[fname];
      const item = create('div', 'folder-item');
      const img = create('img');
      img.src = chooseIconSrc(fname, fm);
      img.alt = fname;
      const label = create('div', 'folder-label');
      label.textContent = fname;
      item.appendChild(img); item.appendChild(label);

      // double click to open file (if html open iframe, else show content)
      item.addEventListener('dblclick', () => {
        if (fm.type === 'file') {
          if (fm.url && fm.url.endsWith('.html')) openProjectWindow(fm.url, fname);
          else openTextWindow(fname, fm.content || fm.url || `No preview for ${fname}`);
        } else if (fm.type === 'folder') {
          openFolderWindow(fname, fm);
        }
      });

      // small context menu within folder (right click)
      item.addEventListener('contextmenu', (ev) => {
        ev.preventDefault(); ev.stopPropagation();
        // simple prompt options
        const action = prompt(`Action for ${fname}: (open/rename/delete)`);
        if (action === 'open') item.dispatchEvent(new Event('dblclick'));
        else if (action === 'rename') {
          const nn = prompt('Rename to', fname);
          if (nn && nn.trim()) {
            meta.children[nn.trim()] = fm;
            delete meta.children[fname];
            saveFS();
            openFolderWindow(name, meta); // re-open as new
          }
        } else if (action === 'delete') {
          // move to desktop trash
          if (!fs.Desktop.Trash) fs.Desktop.Trash = { type: 'trash', items: {} };
          fs.Desktop.Trash.items[fname] = fm;
          delete meta.children[fname];
          saveFS();
          alert(`${fname} moved to Trash`);
          // refresh folder view
          openFolderWindow(name, meta);
        }
      });

      grid.appendChild(item);
    });

    if (Object.keys(children).length === 0) {
      const empty = create('div', 'folder-empty'); empty.textContent = '(empty)';
      wrapper.appendChild(empty);
    }

    createWindow(name, wrapper);
  }

  function openTextWindow(title, text) {
    const pre = create('pre');
    pre.style.whiteSpace = 'pre-wrap';
    pre.style.fontFamily = 'ui-monospace,monospace';
    pre.textContent = text;
    createWindow(title, pre);
  }

  function openProjectWindow(src, title) {
    const iframe = create('iframe');
    iframe.src = src;
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';
    createWindow(title, iframe);
  }

  function openFileWindow(name, meta) {
    if (meta.url && meta.url.endsWith('.pdf')) {
      const iframe = create('iframe');
      iframe.src = meta.url;
      iframe.style.width = '100%';
      iframe.style.height = '100%';
      iframe.style.border = 'none';
      createWindow(name, iframe);
    } else if (meta.content) {
      openTextWindow(name, meta.content);
    } else {
      openTextWindow(name, `No preview available for ${name}`);
    }
  }

  function openAppWindow(name) {
    createWindow(name, `<div style="padding:12px">App: ${name} (no UI implemented)</div>`);
  }

  function openAboutWindow() {
    const html = `
      <div class="about-system" style="padding:12px">
        <img src="assets/icons/computer.png" style="width:80px;height:80px;display:block;margin:0 auto 8px" alt="logo">
        <h2 style="text-align:center">About This System</h2>
        <p><strong>User:</strong> Aadil Asif Badhra</p>
        <p><strong>Role:</strong> Ethical Hacker | Developer | Pentester</p>
        <p><strong>System:</strong> Linux Portfolio OS</p>
        <p><strong>Version:</strong> 1.0.0</p>
      </div>
    `;
    createWindow('About System', html);
  }

  function openTrashWindow(meta) {
    const wrapper = create('div', 'trash-view');
    const list = create('ul');
    (meta && meta.items ? Object.keys(meta.items) : []).forEach(name => {
      const li = create('li');
      li.innerHTML = `${name} <button data-name="${name}" class="restore-btn">Restore</button> <button data-name="${name}" class="del-perm-btn">Delete Permanently</button>`;
      list.appendChild(li);
    });
    wrapper.appendChild(list);
    wrapper.querySelectorAll('.restore-btn').forEach(b => {
      b.addEventListener('click', (ev) => {
        const nm = ev.currentTarget.dataset.name;
        restoreFromTrash(nm);
      });
    });
    wrapper.querySelectorAll('.del-perm-btn').forEach(b => {
      b.addEventListener('click', (ev) => {
        const nm = ev.currentTarget.dataset.name;
        if (confirm(`Permanently delete ${nm}? This cannot be undone.`)) {
          delete fs.Desktop.Trash.items[nm];
          saveFS(); renderDesktop();
        }
      });
    });
    // Add empty-trash button
    const emptyBtn = create('button'); emptyBtn.textContent = 'Empty Trash';
    emptyBtn.addEventListener('click', () => {
      if (confirm('Empty Trash?')) { emptyTrash(); renderDesktop(); }
    });
    wrapper.appendChild(emptyBtn);
    createWindow('Trash', wrapper);
  }

  /* ---------- Terminal Window wrapper ---------- */
  function openTerminalWindow() {
    // If a terminal initializer exists globally, pass content node to it.
    const win = createWindow('Terminal', create('div'));
    const last = windows[windows.length - 1];
    if (!last) return;
    const contentNode = last.node.querySelector('.content');
    // If user provided initTerminal(contentNode) in js/terminal.js, call it
    if (typeof window.initTerminal === 'function') {
      try {
        initTerminal(contentNode);
      } catch (e) {
        contentNode.textContent = 'Terminal failed to load: ' + e;
      }
      return;
    }
    // otherwise a simple built-in terminal:
    const out = create('div'); out.style.height = 'calc(100% - 28px)'; out.style.overflow = 'auto';
    const input = create('input'); input.style.width = '100%'; input.style.boxSizing = 'border-box';
    input.placeholder = 'Type "help" and press Enter';
    contentNode.appendChild(out); contentNode.appendChild(input);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const cmd = input.value.trim(); input.value = '';
        const line = create('div'); line.textContent = '$ ' + cmd; out.appendChild(line);
        handleSimpleTerminal(cmd, out);
        out.scrollTop = out.scrollHeight;
      }
    });
  }

  function handleSimpleTerminal(cmd, out) {
    if (!cmd) return;
    const [base, ...rest] = cmd.split(/\s+/);
    if (base === 'help') out.appendChild(textNode('Commands: help, ls, cat <file>, open <name>, clear'));
    else if (base === 'ls') out.appendChild(textNode(Object.keys(fs.Desktop).join('  ')));
    else if (base === 'cat') {
      const name = rest.join(' ');
      const meta = fs.Desktop[name];
      if (meta && meta.type === 'file') {
        out.appendChild(textNode(meta.content || meta.url || '(no content)'));
      } else out.appendChild(textNode('No such file: ' + name));
    } else if (base === 'open') {
      const name = rest.join(' ');
      if (fs.Desktop[name]) openItem(name, fs.Desktop[name]);
      else out.appendChild(textNode('Not found: ' + name));
    } else if (base === 'clear') out.innerHTML = '';
    else out.appendChild(textNode('Command not found: ' + base));
  }

  function textNode(t) { const e = create('div'); e.textContent = t; return e; }

  /* ---------- Utilities for Trash Restore ---------- */
  function restoreFromTrash(name) {
    if (!fs.Desktop.Trash || !fs.Desktop.Trash.items[name]) return;
    const item = fs.Desktop.Trash.items[name];
    fs.Desktop[name] = item;
    delete fs.Desktop.Trash.items[name];
    saveFS(); renderDesktop(); alert(`${name} restored to Desktop.`);
  }

  /* ---------- Helpers & Initialization ---------- */
  function openProperties(name, meta) {
    const html = `<div style="padding:12px"><h3>${name}</h3><p>Type: ${meta.type}</p><p>ID: ${meta.id || 'n/a'}</p></div>`;
    createWindow('Properties - ' + name, html);
  }

  // cycle windows (Alt+Tab style)
  function cycleWindows() {
    if (windows.length === 0) return;
    const idx = windows.findIndex(w => w.node.classList.contains('focused'));
    const next = windows[(idx + 1) % windows.length];
    if (next) focusWindow(next.id);
  }

  // keybindings
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey && e.key.toLowerCase() === 't')) { e.preventDefault(); openTerminalWindow(); }
    if (e.altKey && e.key === 'Tab') { e.preventDefault(); cycleWindows(); }
  });

  // menu button opens terminal
  if (menuBtn) menuBtn.addEventListener('click', () => openTerminalWindow());

  // clock
  function startClock() {
    if (!clockEl) return;
    const tick = () => { clockEl.textContent = new Date().toLocaleString(); };
    tick(); setInterval(tick, 1000);
  }

  /* ---------- Boot ---------- */
  function init() {
    loadFS();
    renderDesktop();
    startClock();

    // click on desktop clears selection + hides contexts
    desktopEl.addEventListener('click', () => hideAllContexts());

    // handle desktopContext menu initial load: add extra actions like New File (if present)
    // If HTML doesn't have "new-file" in desktop-context, user can add it; code supports both.
  }

  // expose some functions for debugging
  window.RP_DESKTOP = {
    saveFS, resetFS, openItem, createWindow, renderDesktop, restoreFromTrash, deleteItemToTrash
  };

  init();

})();
