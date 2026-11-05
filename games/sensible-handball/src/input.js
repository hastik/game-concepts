export function createInput() {
  const keys = new Set();
  const justPressed = new Set();
  const justReleased = new Set();

  function onKeyDown(e) {
    const k = normalize(e.code);
    if (!k) return;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      e.preventDefault();
    }
    if (!keys.has(k)) justPressed.add(k);
    keys.add(k);
  }

  function onKeyUp(e) {
    const k = normalize(e.code);
    if (!k) return;
    keys.delete(k);
    justReleased.add(k);
  }

  function normalize(code) {
    switch (code) {
      case 'ArrowUp':
        return 'up';
      case 'ArrowDown':
        return 'down';
      case 'ArrowLeft':
        return 'left';
      case 'ArrowRight':
        return 'right';
      case 'ShiftLeft':
      case 'ShiftRight':
        return 'shift';
      case 'KeyS':
        return 'pass';
      case 'KeyA':
        return 'passFast';
      case 'KeyD':
        return 'shoot';
      case 'KeyR':
        return 'r';
      default:
        return null;
    }
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  return {
    keys,
    isDown(k) {
      return keys.has(k);
    },
    wasPressed(k) {
      return justPressed.has(k);
    },
    wasReleased(k) {
      return justReleased.has(k);
    },
    moveVector() {
      let x = 0;
      let y = 0;
      if (keys.has('left')) x -= 1;
      if (keys.has('right')) x += 1;
      if (keys.has('up')) y -= 1;
      if (keys.has('down')) y += 1;
      const len = Math.hypot(x, y);
      if (len > 0) {
        x /= len;
        y /= len;
      }
      return { x, y };
    },
    endFrame() {
      justPressed.clear();
      justReleased.clear();
    },
    destroy() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    },
  };
}
