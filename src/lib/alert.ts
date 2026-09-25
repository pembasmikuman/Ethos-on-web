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
    el.onclick = () => { d.close(); b.onPress?.(); };
    d.append(el);
  }
  d.addEventListener('close', () => d.remove());
  d.addEventListener('cancel', () => buttons.find((b) => b.style === 'cancel')?.onPress?.());
  document.body.append(d);
  d.showModal();
}

/** React Native's Alert.prompt, on the browser's own prompt. */
function prompt(title: string, message: string | undefined, cb: (v: string) => void, _type?: string, defaultValue = ''): void {
  const v = window.prompt(message ? `${title}\n${message}` : title, defaultValue);
  if (v !== null) cb(v);
}

export const Alert = { alert, prompt };
