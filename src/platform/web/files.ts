// Save files in and out (the M3 spec, item 8): the only place the page hands the player a file or
// reads one they pick, so the desktop build can swap in its own dialogs (PLAN §6 "Platform seams").

/** Hands the player `text` as a file named `name`, through the browser's download. */
export function downloadText(name: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = Object.assign(document.createElement('a'), { href: url, download: name, hidden: true });
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

/** The text of a file the player picks, or null if they pick none or it cannot be read. */
export function pickTextFile(accept = '.json,application/json'): Promise<string | null> {
  return new Promise((resolve) => {
    const input = Object.assign(document.createElement('input'), { type: 'file', accept, hidden: true });
    const done = (text: string | null) => {
      input.remove();
      resolve(text);
    };
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) return done(null);
      file.text().then(done, () => done(null));
    });
    input.addEventListener('cancel', () => done(null));
    document.body.append(input);
    input.click();
  });
}
