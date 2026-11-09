export function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function button(text, label, className = 'icon-button') {
  const node = element('button', className, text);
  node.type = 'button';
  node.setAttribute('aria-label', label);
  node.title = label;
  return node;
}

export function field(label, input, hint) {
  const wrapper = element('label', 'field');
  wrapper.append(element('span', 'field-label', label), input);
  if (hint) wrapper.append(element('span', 'field-hint', hint));
  return wrapper;
}

export function toast(key) {
  const node = element('div', 'toast', t(key));
  node.dataset.i18n = key;
  document.querySelector('#toasts').append(node);
  setTimeout(() => node.remove(), 3000);
}

export function numberInput(value, label) {
  const input = element('input');
  input.type = 'number';
  input.step = 'any';
  input.required = true;
  input.value = value;
  input.setAttribute('aria-label', label);
  return input;
}
import { t } from './i18n.js';

