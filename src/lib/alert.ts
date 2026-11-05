const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Play the dialog's exit, then close it. close() alone takes it off screen before anything can animate. */
export function shut(d: HTMLDialogElement): void {
  if (!d.open || d.dataset.closing) return;
  d.dataset.closing = '1';
  const o = { duration: 150, easing: 'ease-out', fill: 'forwards' } as const;
  const box = d.animate(reduced() ? [{ opacity: 1 }, { opacity: 0 }] : [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(0.97)' }], o);
  const veil = d.animate([{ opacity: 1 }, { opacity: 0 }], { ...o, pseudoElement: '::backdrop' });
  const end = () => { d.close(); box.cancel(); veil.cancel(); delete d.dataset.closing; };
  box.finished.then(end, end);
}

type Button = { text: string; style?: 'default' | 'cancel' | 'destructive'; onPress?: () => void };

/** React Native's Alert on a <dialog>. With no buttons it shows a single OK. */
function alert(title: string, message?: string, buttons: Button[] = [{ text: 'OK' }]): void {
  const d = document.createElement('dialog');
  d.className = 'alert';
  const h = document.createElement('h2'); h.textContent = title; d.append(h);
  if (message) { const p = document.createElement('p'); p.textContent = message; d.append(p); }
  for (const b of buttons) {
    const el = document.createElement('button');
    el.type = 'button';
    el.textContent = b.text;
    el.dataset.style = b.style ?? 'default';
    el.onclick = () => { shut(d); b.onPress?.(); };
    d.append(el);
  }
  d.addEventListener('close', () => d.remove());
  d.addEventListener('cancel', (e) => { e.preventDefault(); shut(d); buttons.find((b) => b.style === 'cancel')?.onPress?.(); });
  document.body.append(d);
  d.showModal();
}

/** React Native's Alert.prompt, on the same <dialog>. Not window.prompt: some browsers (Electron, embedded views) throw on it. */
function prompt(title: string, message: string | undefined, cb: (v: string) => void, _type?: string, defaultValue = ''): void {
  const d = document.createElement('dialog');
  d.className = 'alert';
  const f = document.createElement('form');
  f.method = 'dialog';
  const h = document.createElement('h2'); h.textContent = title; f.append(h);
  if (message) { const p = document.createElement('p'); p.textContent = message; f.append(p); }
  const input = document.createElement('input');
  input.value = defaultValue;
  input.setAttribute('aria-label', title);
  f.append(input);
  const ok = document.createElement('button'); ok.textContent = 'OK'; ok.value = 'ok';
  const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = 'Cancel'; cancel.dataset.style = 'cancel';
  cancel.onclick = () => shut(d);
  f.append(ok, cancel);
  d.append(f);
  // Enter or OK submits the form; it closes through shut() so it can animate out. Cancel and Esc just close.
  f.addEventListener('submit', (e) => { e.preventDefault(); shut(d); cb(input.value); });
  d.addEventListener('cancel', (e) => { e.preventDefault(); shut(d); });
  d.addEventListener('close', () => d.remove());
  document.body.append(d);
  d.showModal();
  input.select();
}

export const Alert = { alert, prompt };
