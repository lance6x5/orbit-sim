/**
 * ui.js - small DOM helpers: toast messages, confirm dialog, file download.
 */

export const $ = (sel) => document.querySelector(sel);

let toastTimer = 0;
/** Show a short status message (also announced by screen readers). */
export function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

/** Promise-based confirmation using the <dialog id="confirm-dialog">. */
export function confirmDialog(text, okLabel = 'Confirm') {
  const dlg = $('#confirm-dialog');
  $('#confirm-text').textContent = text;
  $('#confirm-ok').textContent = okLabel;
  return new Promise((resolve) => {
    const onClose = () => {
      dlg.removeEventListener('close', onClose);
      resolve(dlg.returnValue === 'ok');
    };
    dlg.returnValue = '';
    dlg.addEventListener('close', onClose);
    dlg.showModal();
  });
}

/** Trigger a JSON file download. */
export function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Format a number compactly for the HUD and info card. */
export function fmt(v, digits = 2) {
  if (!Number.isFinite(v)) return '-';
  const a = Math.abs(v);
  if (a >= 10000) return v.toExponential(1);
  if (a >= 100) return v.toFixed(0);
  return v.toFixed(digits);
}
