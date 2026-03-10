export function applyMainSplitterBodyStyle(isResizing: boolean): () => void {
  if (typeof document === "undefined") {
    return () => {};
  }

  const body = document.body;
  const previousCursor = body.style.cursor;
  const previousUserSelect = body.style.userSelect;

  if (isResizing) {
    body.style.cursor = "col-resize";
    body.style.userSelect = "none";
  }

  return () => {
    body.style.cursor = previousCursor;
    body.style.userSelect = previousUserSelect;
  };
}

export function installWindowResizeListener(listener: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  window.addEventListener("resize", listener);
  return () => {
    window.removeEventListener("resize", listener);
  };
}

export function installWindowPointerDragListeners(options: {
  onPointerMove: (event: PointerEvent) => void;
  onPointerEnd: () => void;
}): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  let disposed = false;

  const dispose = () => {
    if (disposed) {
      return;
    }

    disposed = true;
    window.removeEventListener("pointermove", options.onPointerMove);
    window.removeEventListener("pointerup", handlePointerEnd);
    window.removeEventListener("pointercancel", handlePointerEnd);
  };

  const handlePointerEnd = () => {
    dispose();
    options.onPointerEnd();
  };

  window.addEventListener("pointermove", options.onPointerMove);
  window.addEventListener("pointerup", handlePointerEnd);
  window.addEventListener("pointercancel", handlePointerEnd);

  return dispose;
}
