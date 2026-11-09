import { readState, saveState, createWidget, TYPES } from './state.js';
import { element, button, field, toast } from './ui.js';
import { openModal, closeModal } from './modal.js';
import { renderWidget, editWidget } from './widgets.js';
import { setupDrag } from './drag.js';
import { setLocale, t, translatePage } from './i18n.js';

const restored = readState();
const state = restored.state;
setLocale(state.locale);
translatePage();
const grid = document.querySelector('#dashboard');
const chartRequests = new Map();
const chartStatuses = new Map();
let storageFailed = false;

function persist() {
  const saved = saveState(state);
  const badge = document.querySelector('#storage-status');
  badge.dataset.i18n = saved ? 'storageSaved' : 'storageUnsaved';
  badge.textContent = t(badge.dataset.i18n);
  badge.classList.toggle('storage-error', !saved);
  if (!saved && !storageFailed) toast('storageError');
  storageFailed = !saved;
}

function render(changedId, focusControl, refreshAll = false) {
  const active = document.activeElement;
  const activeId = active?.closest('.widget')?.dataset.id;
  const control = focusControl || active?.dataset.control;
  const existing = new Map([...grid.children].map(card => [card.dataset.id, card]));
  for (const [index, widget] of state.widgets.entries()) {
    let card = existing.get(widget.id);
    if (!card || changedId === widget.id || refreshAll) {
      const next = renderWidget(widget, {
        change: focus => { persist(); render(widget.id, focus); },
        persist,
        edit: item => editWidget(item, () => { persist(); render(item.id); toast('changesSaved'); }),
        remove: removeWidget,
        move: moveOne,
        retry: loadChart,
        notify: toast,
      }, index, state.widgets.length, chartStatuses.get(widget.id));
      if (card) card.replaceWith(next);
      card = next;
    }
    if (grid.children[index] !== card) grid.insertBefore(card, grid.children[index] || null);
    card.querySelector('[data-control="move--1"]').disabled = index === 0;
    card.querySelector('[data-control="move-1"]').disabled = index === state.widgets.length - 1;
    existing.delete(widget.id);
  }
  for (const card of existing.values()) card.remove();
  document.querySelector('#widget-count').textContent = t('widgetCount', { count: state.widgets.length });
  document.querySelector('#empty-state').hidden = state.widgets.length > 0;
  document.querySelector('#grid-hint').hidden = state.widgets.length === 0;
  document.querySelector('#reset-button').disabled = state.widgets.length === 0;
  if (control && (focusControl || document.activeElement !== active)) {
    const card = [...grid.children].find(node => node.dataset.id === (focusControl ? changedId : activeId));
    const target = [...(card?.querySelectorAll('[data-control]') || [])].find(node => node.dataset.control === control);
    if (target && !target.disabled) target.focus();
    else card?.querySelector('.title-button').focus();
  }
}

function removeWidget(widget) {
  const index = state.widgets.indexOf(widget);
  state.widgets.splice(index, 1);
  chartRequests.delete(widget.id);
  chartStatuses.delete(widget.id);
  persist();
  render();
  (grid.children[Math.min(index, grid.children.length - 1)]?.querySelector('.title-button')
    || document.querySelector('[data-action="add"]')).focus();
  toast('widgetDeleted');
}

function moveOne(id, direction) {
  const index = state.widgets.findIndex(widget => widget.id === id);
  const next = index + direction;
  if (next < 0 || next >= state.widgets.length) return;
  [state.widgets[index], state.widgets[next]] = [state.widgets[next], state.widgets[index]];
  persist();
  render();
  toast('orderChanged');
}

function reorder(sourceId, targetId, after) {
  const index = state.widgets.findIndex(widget => widget.id === sourceId);
  const [widget] = state.widgets.splice(index, 1);
  const targetIndex = state.widgets.findIndex(item => item.id === targetId);
  state.widgets.splice(targetIndex + (after ? 1 : 0), 0, widget);
  persist();
  render();
  toast('orderChanged');
}

async function loadChart(widget) {
  if (chartRequests.has(widget.id)) return;
  const token = {};
  chartRequests.set(widget.id, token);
  chartStatuses.set(widget.id, 'loading');
  render(widget.id);
  try {
    const values = await new Promise((resolve, reject) => {
      setTimeout(() => {
        if (Math.random() < 0.15) reject(new Error('Ошибка имитации запроса'));
        else resolve(widget.data.values);
      }, 500 + Math.floor(Math.random() * 501));
    });
    // Удалённая карточка или сброшенный дашборд не должны вернуться после ответа.
    if (chartRequests.get(widget.id) !== token) return;
    widget.data.values = values;
    widget.data.ready = true;
    chartStatuses.delete(widget.id);
    persist();
  } catch {
    if (chartRequests.get(widget.id) !== token) return;
    chartStatuses.set(widget.id, 'error');
  } finally {
    if (chartRequests.get(widget.id) === token) {
      chartRequests.delete(widget.id);
      render(widget.id);
    }
  }
}

function showAddModal() {
  const form = element('form', 'modal-form');
  const group = element('fieldset', 'type-options');
  group.append(element('legend', 'field-label', t('widgetType')));
  for (const [type, info] of Object.entries(TYPES)) {
    const option = element('label', `type-option type-${type}`);
    const radio = element('input');
    radio.type = 'radio';
    radio.name = 'widget-type';
    radio.value = type;
    radio.checked = type === 'note';
    const icon = element('span', 'type-icon', info.icon);
    icon.setAttribute('aria-hidden', 'true');
    const text = element('span');
    text.append(element('strong', '', t(info.name)), element('small', '', t(info.description)));
    option.append(radio, icon, text);
    group.append(option);
  }
  const title = element('input');
  title.required = true;
  title.maxLength = 80;
  title.placeholder = t('titlePlaceholder');
  title.addEventListener('input', () => title.setCustomValidity(''));
  title.addEventListener('invalid', () => {
    if (title.validity.valueMissing) title.setCustomValidity(t('titleRequired'));
  });
  const submit = element('button', 'button primary', t('addWidget'));
  submit.type = 'submit';
  form.append(group, field(t('title'), title), submit);
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!title.value.trim()) {
      title.setCustomValidity(t('titleRequired'));
      title.reportValidity();
      return;
    }
    const type = new FormData(form).get('widget-type');
    const widget = createWidget(type, title.value);
    state.widgets.push(widget);
    closeModal();
    persist();
    render();
    if (type === 'chart') loadChart(widget);
    [...grid.children].find(card => card.dataset.id === widget.id)?.querySelector('.title-button').focus();
    toast('widgetAdded');
  });
  openModal(t('addWidget'), form);
}

function showResetModal() {
  const body = element('div');
  body.append(element('p', 'modal-description', t('resetDescription')));
  const actions = element('div', 'modal-actions');
  const cancel = button(t('cancel'), t('cancelReset'), 'button secondary');
  cancel.addEventListener('click', closeModal);
  const reset = button(t('deleteAllWidgets'), t('confirmReset'), 'button danger');
  reset.addEventListener('click', () => {
    state.widgets = [];
    chartRequests.clear();
    chartStatuses.clear();
    closeModal();
    persist();
    render();
    document.querySelector('[data-action="add"]').focus();
    toast('resetDone');
  });
  actions.append(cancel, reset);
  body.append(actions);
  openModal(t('resetTitle'), body);
}

const language = document.querySelector('#locale-select');
language.value = state.locale;
language.addEventListener('change', () => {
  const drafts = [...grid.querySelectorAll('input[data-control], textarea[data-control]')]
    .filter(input => input.type !== 'checkbox')
    .map(input => ({ id: input.closest('.widget').dataset.id, control: input.dataset.control, value: input.value }));
  state.locale = setLocale(language.value);
  translatePage();
  render(null, null, true);
  for (const draft of drafts) {
    const card = [...grid.children].find(node => node.dataset.id === draft.id);
    const input = [...card.querySelectorAll('[data-control]')].find(node => node.dataset.control === draft.control);
    input.value = draft.value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }
  persist();
});

document.querySelectorAll('[data-action="add"]').forEach(node => node.addEventListener('click', showAddModal));
document.querySelector('[data-action="reset"]').addEventListener('click', showResetModal);
const theme = document.querySelector('#theme-toggle');
theme.checked = state.theme === 'dark';
document.documentElement.dataset.theme = state.theme;
theme.addEventListener('change', () => {
  state.theme = theme.checked ? 'dark' : 'light';
  document.documentElement.dataset.theme = state.theme;
  persist();
});
setupDrag(grid, reorder);
render();
persist();
if (restored.message) toast(restored.message);
state.widgets.filter(widget => widget.type === 'chart' && !widget.data.ready).forEach(loadChart);
