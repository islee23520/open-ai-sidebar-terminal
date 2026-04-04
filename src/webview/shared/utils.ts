export function escapeHtml(value: string | number | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

let needsRefresh = false;
let animationFrameId: number | null = null;

export function scheduleRefresh(refreshFn: () => void): void {
  needsRefresh = true;
  if (animationFrameId !== null) return;

  animationFrameId = requestAnimationFrame(() => {
    animationFrameId = null;
    if (needsRefresh) {
      refreshFn();
      needsRefresh = false;
    }
  });
}

export function cancelPendingRefresh(): void {
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  needsRefresh = false;
}
