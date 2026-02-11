interface CanvasPosition {
  x: number;
  y: number;
}

const PANEL_MARGIN_PX = 12;

export function positionSelectionTooltip(
  selectionInfo: HTMLElement,
  pos: CanvasPosition,
  isMobileUi: boolean,
) {
  const margin = PANEL_MARGIN_PX;

  if (isMobileUi) {
    selectionInfo.style.left = '50%';
    selectionInfo.style.right = 'auto';
    selectionInfo.style.top = 'auto';
    selectionInfo.style.bottom = `calc(${margin}px + env(safe-area-inset-bottom))`;
    selectionInfo.style.transform = 'translateX(-50%)';
    return;
  }

  selectionInfo.style.transform = '';
  selectionInfo.style.right = '';
  selectionInfo.style.bottom = '';

  selectionInfo.style.left = `${pos.x}px`;
  selectionInfo.style.top = `${pos.y}px`;

  requestAnimationFrame(() => {
    const rect = selectionInfo.getBoundingClientRect();

    const desiredLeft = pos.x - rect.width / 2;
    const clampedLeft = Math.min(
      Math.max(margin, desiredLeft),
      Math.max(margin, window.innerWidth - rect.width - margin),
    );

    const spaceBelow = window.innerHeight - (pos.y + margin);
    const placeAbove = spaceBelow < rect.height + margin;
    const desiredTop = placeAbove ? pos.y - rect.height - margin : pos.y + margin;
    const clampedTop = Math.min(
      Math.max(margin, desiredTop),
      Math.max(margin, window.innerHeight - rect.height - margin),
    );

    selectionInfo.style.left = `${clampedLeft}px`;
    selectionInfo.style.top = `${clampedTop}px`;
  });
}
