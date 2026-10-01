import { useEffect, useState } from 'react';

export interface KeyboardBox {
  /** Height of the area still visible above the on-screen keyboard. */
  height: number;
  /** Distance from the top of the layout viewport to the top of the visible area. */
  offsetTop: number;
  /** How much of the layout viewport's bottom is covered by the keyboard. */
  bottomInset: number;
}

// Below this, the difference is browser chrome (URL bar), not a keyboard.
const KEYBOARD_MIN_INSET = 120;

/**
 * Returns the visible box while an on-screen keyboard is open, otherwise null.
 *
 * Android Chrome and iOS Safari don't shrink the layout viewport when the keyboard opens, so
 * `position: fixed` elements anchored to the bottom (or sized in vh) end up behind it.
 * Use the returned box to override top/bottom/height for dialogs and sheets that contain inputs.
 */
export function useKeyboardBox(enabled: boolean): KeyboardBox | null {
  const [box, setBox] = useState<KeyboardBox | null>(null);

  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    if (!enabled || !vv) { setBox(null); return; }

    const update = () => {
      const bottomInset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setBox(bottomInset >= KEYBOARD_MIN_INSET
        ? { height: vv.height, offsetTop: vv.offsetTop, bottomInset }
        : null);
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, [enabled]);

  return box;
}
