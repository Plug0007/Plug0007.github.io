/* desktop.js
   Handles desktop icons, context menus, windows, taskbar, drag, animations.
   Save this file to: js/desktop.js
*/

(() => {
  // Utility helpers
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const create = (tag, cls) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    return el;
  };

  // Configuration: icons and initial fake filesystem mapping
  const ICONS = [
    { id: 'home', type: 'system', name: 'Home', icon: 'assets/icons/home.png' },
    { id: 'computer', type: 'system', name: 'Computer', icon: 'assets/icons/computer.png' },
    { id: 'network', type: 'system', name: 'Network', icon: 'assets/icons/network.png' },
    { id: 'trash', type: 'system', name: 'Trash', icon: 'assets/icons/trash.png' },

    { id: 'projects', type: 'folder', name: 'Projects', icon: 'assets/icons/folder.png' },
    { id: 'resume', type: 'file', name: 'Resume', icon: 'assets/icons/text.png' },
    { id: 'about', type: 'system', name: 'About System', icon: 'assets/icons/info.png' },
    { id: 'terminal', type: 'terminal', name: 'Terminal', icon: 'assets/icons/terminal.png' }
  ];

  // simple FS tree used by terminal later; we keep minimal metadata here
  const FS = {
    '/': {
      type: 'folder',
      children: [
        { type: 'folder', name: 'Projects', children: [
            { type: 'file', name: 'project1.html' },
            { type: 'file', name: 'project2.html' }
          ]
        },
        { type: 'folder', name: 'Docs', children: [
            { type: 'file', name: 'resume.txt' },
            { type: 'file', name: 'about.txt' }
          ]
        },
        { type: 'file', name: 'contact.txt' }
      ]
    }
  };

  // load some text files (resume/about/contact) into memory for quicker display
  const TEXT_CACHE = {
    '/Docs/about.txt': `Aadil Asif Badhra — Ethical Hacker & Developer
Location: India
Summary:
- Passionate penetration tester and full-stack developer.
- Experience: Linux, Python, JavaScript, web app pentesting, networking.
- Projects: Web CTF tools, Linux desktop portfolio, recon automation.

(Replace this text with your real bio or resume content.)`,

    '/contact.txt': `Email: aadil@example.com
GitHub: github.com/aadil-asif
LinkedIn: linkedin.com/in/aadil-asif`
  };

  // Attempt to preload resume.txt from assets (if available)
  fetch('assets/resume.txt').then(r => r.ok ? r.text() : null).then(txt => {
    if (txt) TEXT_CACHE['/Docs/resume.txt'] = txt;
  }).catch(e => {/* ignore */});

  // state
  let zIndexCounter = 100;
  const state = {
    windows: [], // {id, node, title}
    activeWindow: null
  };

  // DOM refs
  const desktop = $('#desktop');
  const desktopContext = $('#desktop-context');
  const iconContext = $('#icon-context');
  const taskItems = $('#task-items');
  const clockEl = $('#clock');
  const menuBtn = $('#menu-button');

  // init
  document.addEventListener('DOMContentLoaded', init);

  function init() {
    renderIcons();
    bindDesktopEvents();
    startClock();
    // allow double click speed adjustments on some browsers: detect dblclick separately
  }

  /* ---------- render icons ---------- */
  function renderIcons() {
    desktop.innerHTML = ''; // clear
    ICONS.forEach(ic => {
      const d = create('div', 'desktop-icon');
      d.dataset.id = ic.id;
      d.dataset.type = ic.type;
      d.dataset.name = ic.name;

      const img = create('img');
      img.src = ic.icon;
      img.alt = ic.name;

      const span = create('span');
      span.textContent = ic.name;

      d.appendChild(img);
      d.appendChild(span);

      // click to select, doubleclick to open, right click context
      d.addEventListener('click', ev => {
        ev.stopPropagation();
        clearSelected();
        d.classList.add('selected');
      });

      d.addEventListener('dblclick', ev => {
        ev.stopPropagation();
        openIcon(ic);
      });

      d.addEventListener('contextmenu', ev => {
        ev.preventDefault();
        ev.stopPropagation();
        clearSelected();
        d.classList.add('selected');
        showIconContext(ev.pageX, ev.pageY, ic, d);
      });

      desktop.appendChild(d);
    });
  }

  function clearSelected() {
    $$('.desktop-icon.selected').forEach(n => n.classList.remove('selected'));
  }

  /* ---------- desktop & icon context menus ---------- */
  function bindDesktopEvents() {
    // hide menus on click anywhere
    document.addEventListener('click', () => {
      hideContext(desktopContext);
      hideContext(iconContext);
      clearSelected();
    });

    // right-click on desktop
    desktop.addEventListener('contextmenu', ev => {
      ev.preventDefault();
      hideContext(iconContext);
      if (!ev.target.closest('.desktop-icon')) {
        showDesktopContext(ev.pageX, ev.pageY);
      }
    });

    // desktop context actions
    desktopContext.addEventListener('click', ev => {
      const action = ev.target.getAttribute('data-action');
      if (!action) return;
      if (action === 'new-folder') newFolderPrompt();
      if (action === 'open-terminal') openTerminalWindow();
      if (action === 'refresh') renderIcons();
      hideContext(desktopContext);
    });

    // icon context menu actions are handled when shown (see showIconContext)

    // menu button opens terminal for now (can be replaced by app launcher)
    menuBtn.addEventListener('click', e => {
      openTerminalWindow();
      e.stopPropagation();
    });

    // keyboard shortcuts
    document.addEventListener('keydown', e => {
      // Ctrl+T -> terminal
      if (e.ctrlKey && (e.key === 't' || e.key === 'T')) {
        e.preventDefault();
        openTerminalWindow();
      }
      // Alt+Tab -> cycle windows
      if (e.altKey && e.key === 'Tab') {
        e.preventDefault();
        cycleWindows();
      }
    });
  }

  function showDesktopContext(x, y) {
    showContextAt(desktopContext, x, y);
  }

  function showIconContext(x, y, ic, iconEl) {
    // icon context menu items: open, rename, delete
    showContextAt(iconContext, x, y);
    // ensure click handlers
    iconContext.onclick = ev => {
      const action = ev.target.getAttribute('data-action');
      if (!action) return;
      if (action === 'open') openIcon(ic);
      if (action === 'rename') {
        const name = prompt('Rename to', ic.name);
        if (name) {
          ic.name = name;
          iconEl.querySelector('span').textContent = name;
        }
      }
      if (action === 'delete') {
        const ok = confirm(`Delete ${ic.name}?`);
        if (ok) {
          // remove from ICONS and re-render
          const idx = ICONS.findIndex(a => a.id === ic.id);
          if (idx >= 0) {
            ICONS.splice(idx, 1);
            renderIcons();
          }
        }
      }
      hideContext(iconContext);
    };
  }

  function showContextAt(menu, x, y) {
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    menu.classList.remove('hidden');
  }

  function hideContext(menu) {
    if (!menu) return;
    menu.classList.add('hidden');
    menu.onclick = null;
  }

  /* ---------- icon actions (open) ---------- */
  function openIcon(ic) {
    if (ic.type === 'folder') {
      openFolderWindow(ic.name);
    } else if (ic.type === 'file') {
      if (ic.id === 'resume') openTextFileWindow('Resume', '/Docs/resume.txt');
      else openTextFileWindow(ic.name, '/contact.txt');
    } else if (ic.type === 'system') {
      if (ic.id === 'about') openTextFileWindow('About System', '/Docs/about.txt');
      else if (ic.id === 'trash') openTrashWindow();
      else openInfoWindow(ic.name);
    } else if (ic.type === 'terminal') {
      openTerminalWindow();
    }
  }

  /* ---------- window creation & management ---------- */
  function createWindow(title, contentNode, options = {}) {
    const id = 'win-' + Math.random().toString(36).slice(2);
    const win = create('div', 'window');
    win.dataset.id = id;
    win.style.zIndex = ++zIndexCounter;

    // header
    const header = create('div', 'window-header');
    const titleEl = create('div', 'title');
    titleEl.textContent = title;
    const controls = create('div', 'controls');
    const btnClose = create('div', 'close');
    const btnMin = create('div', 'minimize');
    const btnMax = create('div', 'maximize');
    controls.appendChild(btnMin);
    controls.appendChild(btnMax);
    controls.appendChild(btnClose);
    header.appendChild(titleEl);
    header.appendChild(controls);

    // content
    const contentWrapper = create('div', 'window-content');
    if (typeof contentNode === 'string') {
      contentWrapper.innerHTML = contentNode;
    } else {
      contentWrapper.appendChild(contentNode);
    }

    win.appendChild(header);
    win.appendChild(contentWrapper);
    document.body.appendChild(win);

    // initial position with small offset
    win.style.left = (100 + state.windows.length * 20) + 'px';
    win.style.top = (80 + state.windows.length * 20) + 'px';

    // store
    state.windows.push({ id, node: win, title });
    addTaskbarEntry({ id, title });

    // focus on create
    focusWindow(id);

    // drag by header
    makeDraggable(win, header);

    // control buttons
    btnClose.addEventListener('click', (e) => {
      closeWindow(id);
      e.stopPropagation();
    });
    btnMin.addEventListener('click', (e) => {
      minimizeWindow(id);
      e.stopPropagation();
    });
    btnMax.addEventListener('click', (e) => {
      toggleMaximize(win);
      e.stopPropagation();
    });

    // focus when clicked
    win.addEventListener('mousedown', (e) => {
      focusWindow(id);
    });

    return { id, win };
  }

  function focusWindow(id) {
    const rec = state.windows.find(w => w.id === id);
    if (!rec) return;
    state.activeWindow = id;
    // bump z-index
    rec.node.style.zIndex = ++zIndexCounter;
    // highlight task item
    $$('.task-item').forEach(t => t.classList.remove('active'));
    const ti = $(`.task-item[data-id="${id}"]`);
    if (ti) ti.classList.add('active');
    // show if minimized
    if (rec.node.classList.contains('minimized')) {
      rec.node.classList.remove('minimized');
      rec.node.style.display = 'block';
    }
  }

  function closeWindow(id) {
    const idx = state.windows.findIndex(w => w.id === id);
    if (idx === -1) return;
    const rec = state.windows[idx];
    // animate close (add class or keyframe)
    rec.node.style.animation = 'windowClose 0.22s ease forwards';
    // remove after animation
    setTimeout(() => {
      rec.node.remove();
    }, 220);
    // remove task item
    const ti = $(`.task-item[data-id="${id}"]`);
    if (ti) ti.remove();
    state.windows.splice(idx, 1);
    if (state.activeWindow === id) state.activeWindow = null;
  }

  function minimizeWindow(id) {
    const rec = state.windows.find(w => w.id === id);
    if (!rec) return;
    rec.node.style.display = 'none';
    rec.node.classList.add('minimized');
    const ti = $(`.task-item[data-id="${id}"]`);
    if (ti) ti.classList.add('minimized');
  }

  function restoreWindow(id) {
    const rec = state.windows.find(w => w.id === id);
    if (!rec) return;
    rec.node.style.display = 'block';
    rec.node.classList.remove('minimized');
    focusWindow(id);
    const ti = $(`.task-item[data-id="${id}"]`);
    if (ti) ti.classList.remove('minimized');
  }

  function toggleMaximize(winNode) {
    if (winNode.dataset.max === '1') {
      // restore
      winNode.style.top = winNode.dataset.prevTop || '80px';
      winNode.style.left = winNode.dataset.prevLeft || '100px';
      winNode.style.width = winNode.dataset.prevWidth || '500px';
      winNode.style.height = winNode.dataset.prevHeight || '350px';
      winNode.dataset.max = '0';
    } else {
      // store prev
      winNode.dataset.prevTop = winNode.style.top;
      winNode.dataset.prevLeft = winNode.style.left;
      winNode.dataset.prevWidth = winNode.style.width;
      winNode.dataset.prevHeight = winNode.style.height;
      // maximize
      winNode.style.top = '0px';
      winNode.style.left = '0px';
      winNode.style.width = (window.innerWidth - 2) + 'px';
      winNode.style.height = (window.innerHeight - 38) + 'px';
      winNode.dataset.max = '1';
      winNode.style.zIndex = ++zIndexCounter;
    }
  }

  function addTaskbarEntry(winRec) {
    const item = create('div', 'task-item');
    item.dataset.id = winRec.id;
    item.textContent = winRec.title;
    taskItems.appendChild(item);

    item.addEventListener('click', () => {
      const isMin = item.classList.contains('minimized');
      if (isMin) {
        restoreWindow(winRec.id);
        item.classList.remove('minimized');
      } else {
        minimizeWindow(winRec.id);
        item.classList.add('minimized');
      }
    });
  }

  function cycleWindows() {
    if (!state.windows.length) return;
    let idx = state.windows.findIndex(w => w.id === state.activeWindow);
    idx = (idx + 1) % state.windows.length;
    focusWindow(state.windows[idx].id);
  }

  /* ---------- draggable helper ---------- */
  function makeDraggable(node, handle) {
    let dragging = false;
    let offsetX = 0, offsetY = 0;

    handle.addEventListener('mousedown', (e) => {
      dragging = true;
      const rect = node.getBoundingClientRect();
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;
      node.style.transition = 'none';
      document.body.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      let left = e.clientX - offsetX;
      let top = e.clientY - offsetY;
      // confine to viewport
      left = Math.max(0, Math.min(left, window.innerWidth - 100));
      top = Math.max(0, Math.min(top, window.innerHeight - 80));
      node.style.left = left + 'px';
      node.style.top = top + 'px';
    });

    document.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false;
      node.style.transition = '';
      document.body.style.userSelect = '';
    });
  }

  /* ---------- app windows (folder, text, terminal, projects) ---------- */
  function openFolderWindow(folderName) {
    // render a folder view (list items)
    const wrapper = create('div');
    const grid = create('div', 'folder-grid');
    // find FS folder
    const folder = findInFS('/', 'Projects'); // we only built Projects sample
    // currently show static project links
    const p1 = create('div', 'folder-item');
    p1.innerHTML = `<img src="assets/icons/html.png"><span>project1.html</span>`;
    p1.addEventListener('dblclick', () => openProject('projects/project1.html', 'Project 1'));
    const p2 = create('div', 'folder-item');
    p2.innerHTML = `<img src="assets/icons/html.png"><span>project2.html</span>`;
    p2.addEventListener('dblclick', () => openProject('projects/project2.html', 'Project 2'));
    grid.appendChild(p1); grid.appendChild(p2);
    wrapper.appendChild(grid);
    createWindow(folderName, wrapper);
  }

  function openTextFileWindow(title, path) {
    const pre = create('pre');
    pre.style.whiteSpace = 'pre-wrap';
    pre.style.fontFamily = 'ui-monospace, monospace';
    pre.textContent = TEXT_CACHE[path] || `File not found: ${path}`;
    createWindow(title, pre);
  }

  function openProject(src, title) {
    const frame = create('iframe');
    frame.src = src;
    frame.style.width = '100%';
    frame.style.height = '100%';
    frame.style.border = 'none';
    createWindow(title, frame);
  }

  function openInfoWindow(name) {
    const el = create('div');
    el.innerHTML = `<h2>${name}</h2><p>This is a simulated Linux-like environment. Replace content in js/desktop.js and assets to customize.</p>`;
    createWindow(name, el);
  }

  function openTrashWindow() {
    const el = create('div');
    el.innerHTML = `<h3>Trash</h3><p>Trash is empty.</p>`;
    createWindow('Trash', el);
  }

  function openTerminalWindow() {
    // terminal.js will provide a public init function; if not yet loaded create a simple fallback
    if (typeof initTerminal === 'function') {
      // create an element and pass to terminal initializer
      const container = create('div');
      createWindow('Terminal', container);
      // find the last created window's content wrapper
      const last = state.windows[state.windows.length - 1];
      if (!last) return;
      const termDiv = last.node.querySelector('.window-content');
      // call terminal initializer with that content node
      try {
        initTerminal(termDiv);
      } catch (err) {
        termDiv.textContent = 'Terminal failed to load: ' + err;
      }
    } else {
      // fallback simple terminal
      openTextFileWindow('Terminal', '/Docs/about.txt');
    }
  }

  /* ---------- helpers for FS (minimal) ---------- */
  function findInFS(base, name) {
    // very naive lookup for the demo
    if (base === '/' && name === 'Projects') return FS['/'].children.find(c => c.name === 'Projects');
    return null;
  }

  /* ---------- taskbar clock ---------- */
  function startClock() {
    function tick() {
      const d = new Date();
      clockEl.textContent = d.toLocaleString();
    }
    tick();
    setInterval(tick, 1000);
  }

  /* ---------- small DOM utility to find elements ---------- */
  function $(sel, root = document) { return root.querySelector(sel); }
  function $$(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

  // export a few things to window for debugging / terminal usage
  window._RAELYAAN_DESKTOP = {
    createWindow,
    openProject,
    openTextFileWindow,
    ICONS,
    FS
  };

})();
