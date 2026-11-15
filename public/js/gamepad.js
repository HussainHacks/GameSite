/**
 * Cyberpunk Virtual Touch Gamepad Controller
 * Dispatches simulated keyboard events with key, code, keyCode, which, bubbles,
 * to the window and embedded iframe (document, activeElement, canvas, contentWindow).
 * Features keydown on press, keyup on release, and hold-repeat for directional keys.
 */

class VirtualGamepad {
  constructor(containerId = 'virtualGamepad') {
    this.container = document.getElementById(containerId);
    this.iframeTarget = null;
    this.enabled = true;
    this.activeKeys = new Set();
    this.repeatTimers = new Map();
    this.init();
  }

  setIframeTarget(iframe) {
    this.iframeTarget = iframe;
  }

  init() {
    if (!this.container) return;

    const bindings = [
      { id: 'btnPadUp', key: 'ArrowUp', code: 'ArrowUp', keyCode: 38, isDir: true },
      { id: 'btnPadDown', key: 'ArrowDown', code: 'ArrowDown', keyCode: 40, isDir: true },
      { id: 'btnPadLeft', key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37, isDir: true },
      { id: 'btnPadRight', key: 'ArrowRight', code: 'ArrowRight', keyCode: 39, isDir: true },
      { id: 'btnActA', key: ' ', code: 'Space', keyCode: 32, isDir: false },
      { id: 'btnActB', key: 'Enter', code: 'Enter', keyCode: 13, isDir: false },
      { id: 'btnActX', key: 'z', code: 'KeyZ', keyCode: 90, isDir: false },
      { id: 'btnActY', key: 'x', code: 'KeyX', keyCode: 88, isDir: false }
    ];

    bindings.forEach(b => {
      const el = document.getElementById(b.id);
      if (!el) return;

      const press = (e) => {
        if (e && e.cancelable) e.preventDefault();
        if (this.activeKeys.has(b.id)) return;
        this.activeKeys.add(b.id);
        el.classList.add('pressed');

        // Initial keydown
        this.emitKeyEvent('keydown', b, false);
        if (navigator.vibrate) navigator.vibrate(15);

        // Hold-repeat for directional keys
        if (b.isDir) {
          const timeoutId = setTimeout(() => {
            const intervalId = setInterval(() => {
              if (this.activeKeys.has(b.id)) {
                this.emitKeyEvent('keydown', b, true);
              } else {
                clearInterval(intervalId);
              }
            }, 80);
            this.repeatTimers.set(`${b.id}_interval`, intervalId);
          }, 220);
          this.repeatTimers.set(`${b.id}_timeout`, timeoutId);
        }
      };

      const release = (e) => {
        if (e && e.cancelable) e.preventDefault();
        if (!this.activeKeys.has(b.id)) return;
        this.activeKeys.delete(b.id);
        el.classList.remove('pressed');

        // Clear repeat timers
        if (this.repeatTimers.has(`${b.id}_timeout`)) {
          clearTimeout(this.repeatTimers.get(`${b.id}_timeout`));
          this.repeatTimers.delete(`${b.id}_timeout`);
        }
        if (this.repeatTimers.has(`${b.id}_interval`)) {
          clearInterval(this.repeatTimers.get(`${b.id}_interval`));
          this.repeatTimers.delete(`${b.id}_interval`);
        }

        // Send keyup
        this.emitKeyEvent('keyup', b, false);
      };

      el.addEventListener('touchstart', press, { passive: false });
      el.addEventListener('touchend', release, { passive: false });
      el.addEventListener('touchcancel', release, { passive: false });
      el.addEventListener('mousedown', press);
      el.addEventListener('mouseup', release);
      el.addEventListener('mouseleave', release);
    });
  }

  createSyntheticKeyboardEvent(type, keyInfo, isRepeat = false) {
    let evt;
    try {
      evt = new KeyboardEvent(type, {
        key: keyInfo.key,
        code: keyInfo.code,
        keyCode: keyInfo.keyCode,
        which: keyInfo.keyCode,
        bubbles: true,
        cancelable: true,
        repeat: isRepeat
      });
    } catch (e) {
      evt = document.createEvent('KeyboardEvent');
      evt.initEvent(type, true, true);
    }

    try {
      Object.defineProperty(evt, 'keyCode', { get: () => keyInfo.keyCode });
      Object.defineProperty(evt, 'which', { get: () => keyInfo.keyCode });
      Object.defineProperty(evt, 'key', { get: () => keyInfo.key });
      Object.defineProperty(evt, 'code', { get: () => keyInfo.code });
      Object.defineProperty(evt, 'repeat', { get: () => isRepeat });
    } catch (e) {}

    return evt;
  }

  emitKeyEvent(type, keyInfo, isRepeat = false) {
    // Top window dispatch
    try {
      window.dispatchEvent(this.createSyntheticKeyboardEvent(type, keyInfo, isRepeat));
    } catch (e) {}

    // Dispatch into embedded iframe: document, activeElement, canvas, contentWindow
    if (this.iframeTarget) {
      try {
        const win = this.iframeTarget.contentWindow;
        const doc = this.iframeTarget.contentDocument || win?.document;
        if (doc) {
          // Document dispatch
          doc.dispatchEvent(this.createSyntheticKeyboardEvent(type, keyInfo, isRepeat));

          // activeElement dispatch
          if (doc.activeElement && doc.activeElement !== doc.body) {
            try {
              doc.activeElement.dispatchEvent(this.createSyntheticKeyboardEvent(type, keyInfo, isRepeat));
            } catch (e) {}
          }

          // canvas dispatch
          const canvases = doc.querySelectorAll('canvas');
          canvases.forEach(c => {
            try {
              c.dispatchEvent(this.createSyntheticKeyboardEvent(type, keyInfo, isRepeat));
            } catch (e) {}
          });

          // Window dispatch
          if (win) {
            try {
              win.dispatchEvent(this.createSyntheticKeyboardEvent(type, keyInfo, isRepeat));
            } catch (e) {}
          }
        }
      } catch (err) {
        // Cross-origin fallback via postMessage
        if (this.iframeTarget.contentWindow) {
          this.iframeTarget.contentWindow.postMessage({
            type: 'VIRTUAL_KEY_EVENT',
            eventType: type,
            key: keyInfo.key,
            code: keyInfo.code,
            keyCode: keyInfo.keyCode,
            which: keyInfo.keyCode,
            repeat: isRepeat
          }, '*');
        }
      }
    }
  }

  toggle() {
    if (!this.container) return;
    this.container.classList.toggle('hidden');
    return !this.container.classList.contains('hidden');
  }

  show() {
    if (this.container) this.container.classList.remove('hidden');
  }

  hide() {
    if (this.container) this.container.classList.add('hidden');
  }
}

window.VirtualGamepad = VirtualGamepad;
