// Мышь использует нативный HTML Drag and Drop, касание — ту же логику вставки.
export function setupDrag(grid, onMove) {
  let source = null;
  let target = null;
  let after = false;
  let touchId = null;
  let pointerX = 0;
  let pointerY = 0;
  let frame = 0;

  function clearTarget() {
    target?.classList.remove('drop-before', 'drop-after');
    target = null;
  }

  function locate(x, y) {
    clearTarget();
    const cards = [...grid.children].filter(card => card !== source);
    if (!cards.length) return;
    target = document.elementFromPoint(x, y)?.closest('.widget');
    if (target === source) {
      target = null;
      return;
    }
    if (!cards.includes(target)) {
      target = cards.reduce((closest, card) => {
        const distance = node => {
          const rect = node.getBoundingClientRect();
          return (x - (rect.left + rect.width / 2)) ** 2 + (y - (rect.top + rect.height / 2)) ** 2;
        };
        return distance(card) < distance(closest) ? card : closest;
      });
    }
    const rect = target.getBoundingClientRect();
    const singleColumn = getComputedStyle(grid).gridTemplateColumns.split(' ').length === 1;
    after = singleColumn ? y > rect.top + rect.height / 2
      : y > rect.bottom || (y >= rect.top && x > rect.left + rect.width / 2);
    target.classList.add(after ? 'drop-after' : 'drop-before');
  }

  function finish(commit = false) {
    const sourceId = source?.dataset.id;
    const targetId = target?.dataset.id;
    const insertAfter = after;
    source?.classList.remove('dragging');
    clearTarget();
    source = null;
    touchId = null;
    cancelAnimationFrame(frame);
    if (commit && sourceId && targetId) onMove(sourceId, targetId, insertAfter);
  }

  grid.addEventListener('dragstart', event => {
    const handle = event.target.closest('.drag-handle');
    if (!handle) {
      event.preventDefault();
      return;
    }
    source = handle.closest('.widget');
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', source.dataset.id);
    event.dataTransfer.setDragImage(source, 24, 24);
    requestAnimationFrame(() => source?.classList.add('dragging'));
  });
  grid.addEventListener('dragover', event => {
    if (!source || touchId !== null) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    locate(event.clientX, event.clientY);
  });
  grid.addEventListener('drop', event => {
    if (!source) return;
    event.preventDefault();
    finish(true);
  });
  grid.addEventListener('dragleave', event => {
    if (!grid.contains(event.relatedTarget)) clearTarget();
  });
  grid.addEventListener('dragend', () => finish());

  function scrollAtEdge() {
    if (touchId === null) return;
    const delta = pointerY < 80 ? -10 : pointerY > innerHeight - 80 ? 10 : 0;
    if (delta) {
      window.scrollBy(0, delta);
      locate(pointerX, pointerY);
    }
    frame = requestAnimationFrame(scrollAtEdge);
  }

  grid.addEventListener('touchstart', event => {
    const handle = event.target.closest('.drag-handle');
    if (!handle || event.touches.length !== 1) return;
    event.preventDefault();
    finish();
    source = handle.closest('.widget');
    touchId = event.changedTouches[0].identifier;
    pointerX = event.changedTouches[0].clientX;
    pointerY = event.changedTouches[0].clientY;
    source.classList.add('dragging');
    frame = requestAnimationFrame(scrollAtEdge);
  }, { passive: false });
  grid.addEventListener('touchmove', event => {
    if (touchId === null) return;
    const touch = [...event.changedTouches].find(item => item.identifier === touchId);
    if (!touch) return;
    event.preventDefault();
    pointerX = touch.clientX;
    pointerY = touch.clientY;
    locate(touch.clientX, touch.clientY);
  }, { passive: false });
  grid.addEventListener('touchend', event => {
    if ([...event.changedTouches].some(touch => touch.identifier === touchId)) finish(true);
  });
  grid.addEventListener('touchcancel', () => finish());
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') finish();
  });
  window.addEventListener('blur', () => finish());
}
