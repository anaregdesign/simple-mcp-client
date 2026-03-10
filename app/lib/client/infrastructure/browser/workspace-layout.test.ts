import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyMainSplitterBodyStyle,
  installWindowPointerDragListeners,
  installWindowResizeListener,
} from "~/lib/client/infrastructure/browser/workspace-layout";

function createWindowStub() {
  const target = new EventTarget();

  return {
    addEventListener: target.addEventListener.bind(target),
    removeEventListener: target.removeEventListener.bind(target),
    dispatchEvent: target.dispatchEvent.bind(target),
  };
}

function createPointerMoveEvent(clientX: number): Event {
  const event = new Event("pointermove");
  Object.defineProperty(event, "clientX", {
    configurable: true,
    value: clientX,
  });
  return event;
}

describe("applyMainSplitterBodyStyle", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("applies and restores body resize styles", () => {
    const bodyStyle = {
      cursor: "default",
      userSelect: "text",
    };
    vi.stubGlobal("document", {
      body: {
        style: bodyStyle,
      },
    });

    const restore = applyMainSplitterBodyStyle(true);

    expect(bodyStyle).toEqual({
      cursor: "col-resize",
      userSelect: "none",
    });

    restore();

    expect(bodyStyle).toEqual({
      cursor: "default",
      userSelect: "text",
    });
  });
});

describe("installWindowResizeListener", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("registers and unregisters resize listeners", () => {
    const onResize = vi.fn();
    const windowStub = createWindowStub();
    vi.stubGlobal("window", windowStub);

    const dispose = installWindowResizeListener(onResize);

    windowStub.dispatchEvent(new Event("resize"));
    expect(onResize).toHaveBeenCalledTimes(1);

    dispose();
    windowStub.dispatchEvent(new Event("resize"));
    expect(onResize).toHaveBeenCalledTimes(1);
  });
});

describe("installWindowPointerDragListeners", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("tracks pointer move and ends on pointerup", () => {
    const onPointerMove = vi.fn();
    const onPointerEnd = vi.fn();
    const windowStub = createWindowStub();
    vi.stubGlobal("window", windowStub);

    installWindowPointerDragListeners({
      onPointerMove,
      onPointerEnd,
    });

    windowStub.dispatchEvent(createPointerMoveEvent(100));
    expect(onPointerMove).toHaveBeenCalledTimes(1);

    windowStub.dispatchEvent(new Event("pointerup"));
    expect(onPointerEnd).toHaveBeenCalledTimes(1);

    windowStub.dispatchEvent(createPointerMoveEvent(120));
    expect(onPointerMove).toHaveBeenCalledTimes(1);
  });

  it("can be disposed without ending the drag callback", () => {
    const onPointerMove = vi.fn();
    const onPointerEnd = vi.fn();
    const windowStub = createWindowStub();
    vi.stubGlobal("window", windowStub);

    const dispose = installWindowPointerDragListeners({
      onPointerMove,
      onPointerEnd,
    });

    dispose();
    windowStub.dispatchEvent(createPointerMoveEvent(100));
    windowStub.dispatchEvent(new Event("pointerup"));

    expect(onPointerMove).not.toHaveBeenCalled();
    expect(onPointerEnd).not.toHaveBeenCalled();
  });
});
