const overlay = document.querySelector('#modal-overlay');
const dialog = document.querySelector('#modal');
const content = document.querySelector('#modal-content');
let returnFocus;
let previousOverflow;

export function closeModal() {
  if (overlay.hidden) return;
  overlay.hidden = true;
  document.querySelector('.workspace').inert = false;
  document.querySelector('.app-header').inert = false;
  document.body.style.overflow = previousOverflow;
  content.replaceChildren();
  if (returnFocus?.isConnected) returnFocus.focus();
  else document.querySelector('[data-action="add"]').focus();
}

export function openModal(title, body) {
  if (!overlay.hidden) closeModal();
  returnFocus = document.activeElement;
  previousOverflow = document.body.style.overflow;
  document.querySelector('#modal-title').textContent = title;
  content.replaceChildren(body);
  overlay.hidden = false;
  document.querySelector('.workspace').inert = true;
  document.querySelector('.app-header').inert = true;
  document.body.style.overflow = 'hidden';
  (content.querySelector('input, textarea, button') || dialog).focus();
}

document.querySelector('#modal-close').addEventListener('click', closeModal);
overlay.addEventListener('click', event => {
  if (event.target === overlay) closeModal();
});
document.addEventListener('keydown', event => {
  if (overlay.hidden) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    closeModal();
  }
  if (event.key !== 'Tab') return;
  const focusable = [...dialog.querySelectorAll('button, input, textarea, select, [tabindex="0"]')]
    .filter(node => !node.disabled && node.getClientRects().length);
  const first = focusable[0];
  const last = focusable.at(-1);
  if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
    event.preventDefault();
    first.focus();
  }
});
