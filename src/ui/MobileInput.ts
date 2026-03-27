/**
 * Shared singleton for mobile button state.
 * Mutated by HTML buttons in main.ts; read by MobileControls.
 */
export const mobileInputState = {
  left:   false,
  right:  false,
  up:     false,
  down:   false,
  action: false,
};

export function isMobileBrowser(): boolean {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}
