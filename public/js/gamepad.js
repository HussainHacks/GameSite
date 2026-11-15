/**
 * Cyberpunk Virtual Touch Gamepad Controller
 * Dispatches simulated keyboard events to the window and active game iframe.
 */

class VirtualGamepad {
  constructor(containerId = 'virtualGamepad') {
    this.container = document.getElementById(containerId);
    this.iframeTarget = null;
    this.enabled = true;
    this.activeKeys = new Set();
    this.init();
  }

  setIframeTarget(iframe) {
    this.iframeTarget = iframe;
  }

  init() {
    if (!this.container) return;

    const bindings = [
      { id: 'btnPadUp', key: 'ArrowUp', code: 'ArrowUp', keyCode: 38 },
      { id: 'btnPadDown', key: 'ArrowDown', code: 'ArrowDown', keyCode: 40 },
      { id: 'btnPadLeft', key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37 },
      { id: 'btnPadRight', key: 'ArrowRight', code: 'ArrowRight', keyCode: 39 },
      { id: 'btnActA', key: ' ', code: 'Space', keyCode: 32 },
      { id: 'btnActB', key: 'Enter', code: 'Enter', keyCode: 13 },
      { id: 'btnActX', key: 'z', code: 'KeyZ', keyCode: 90 },
      { id: 'btnActY', key: 'x', code: 'KeyX', keyCode: 88 }
    ];

    bindings.forEach(b => {
      const el = document.getElementById(b.id);
      if (!el) return;

      const press = (e) => {
        if (e.cancelable) e.preventDefault();
        el.classList.add('pressed');
        this.emitKeyEvent('keydown', b);
        if (navigator.vibrate) navigator.vibrate(15);
      };

      const release = (e) => {
        if (e && e.cancelable) e.preventDefault();
        el.classList.remove('pressed');
        this.emitKeyEvent('keyup', b);
      };

      el.addEventListener('touchstart', press, { passive: false });
      el.addEventListener('touchend', release, { passive: false });
      el.addEventListener('touchcancel', release, { passive: false });
      el.addEventListener('mousedown', press);
      el.addEventListener('mouseup', release);
      el.addEventListener('mouseleave', release);
    });
  }

  emitKeyEvent(type, keyInfo) {
    const eventInit = {
      key: keyInfo.key,
      code: keyInfo.code,
      keyCode: keyInfo.keyCode,
      which: keyInfo.keyCode,
      bubbles: true,
      cancelable: true
    };

    // Dispatch to top window
    window.dispatchEvent(new KeyboardEvent(type, eventInit));

    // Dispatch into embedded iframe if available and accessible
    if (this.iframeTarget) {
      try {
        const doc = this.iframeTarget.contentDocument || this.iframeTarget.contentWindow?.document;
        if (doc) {
          doc.dispatchEvent(new KeyboardEvent(type, eventInit));
        }
      } catch (err) {
        // Cross-origin iframes may restrict direct dispatch; postMessage fallback
        if (this.iframeTarget.contentWindow) {
          this.iframeTarget.contentWindow.postMessage({
            type: 'VIRTUAL_KEY_EVENT',
            eventType: type,
            key: keyInfo.key,
            code: keyInfo.code,
            keyCode: keyInfo.keyCode
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
