// Draggable windows
interact('.window')
  .draggable({
    inertia: true,
    modifiers: [interact.modifiers.restrict({
      restriction: 'parent',
      endOnly: true
    })],
    listeners: {
      move(event) {
        const target = event.target;
        const x = (parseFloat(target.getAttribute('data-x')) || 0) + event.dx;
        const y = (parseFloat(target.getAttribute('data-y')) || 0) + event.dy;

        target.style.transform = `translate(${x}px, ${y}px)`;
        target.setAttribute('data-x', x);
        target.setAttribute('data-y', y);
      }
    }
  });

// Click icons to open windows
document.getElementById('projectsIcon').onclick = () => {
    document.getElementById('projectWindow').classList.remove('hidden');
};
document.getElementById('resumeIcon').onclick = () => {
    document.getElementById('resumeWindow').classList.remove('hidden');
    fetch('assets/resume.txt')
      .then(res => res.text())
      .then(data => document.getElementById('resumeContent').innerText = data);
};

// Keyboard shortcut example (Ctrl+T opens terminal)
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 't') {
        document.getElementById('terminalWindow').classList.remove('hidden');
        document.getElementById('terminalInput').focus();
    }
});
