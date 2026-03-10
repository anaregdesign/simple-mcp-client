import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  CLIENT_MAIN_SPLITTER_MIN_RIGHT_WIDTH_PX,
} from "~/lib/constants/client";
import { resolveMainSplitterMaxRightWidth } from "~/lib/client/usecase/workspace/layout/main-splitter";
import { clampNumber } from "~/lib/client/usecase/workspace/numbers";

const DEFAULT_RIGHT_PANE_WIDTH_PX = 420;

export function useWorkspaceLayout() {
  const layoutRef = useRef<HTMLDivElement | null>(null);
  const [rightPaneWidth, setRightPaneWidth] = useState(
    DEFAULT_RIGHT_PANE_WIDTH_PX,
  );
  const [activeResizeHandle, setActiveResizeHandle] = useState<"main" | null>(
    null,
  );

  useEffect(() => {
    const body = document.body;
    const previousCursor = body.style.cursor;
    const previousUserSelect = body.style.userSelect;

    if (activeResizeHandle === "main") {
      body.style.cursor = "col-resize";
      body.style.userSelect = "none";
    }

    return () => {
      body.style.cursor = previousCursor;
      body.style.userSelect = previousUserSelect;
    };
  }, [activeResizeHandle]);

  useEffect(() => {
    const handleResize = () => {
      const layoutElement = layoutRef.current;
      if (!layoutElement) {
        return;
      }

      const rect = layoutElement.getBoundingClientRect();
      const maxRightWidth = resolveMainSplitterMaxRightWidth(rect.width);
      setRightPaneWidth((current) =>
        clampNumber(
          current,
          CLIENT_MAIN_SPLITTER_MIN_RIGHT_WIDTH_PX,
          maxRightWidth,
        ),
      );
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  function onMainSplitterPointerDown(
    event: ReactPointerEvent<HTMLDivElement>,
  ) {
    event.preventDefault();
    const layoutElement = layoutRef.current;
    if (!layoutElement) {
      return;
    }

    const rect = layoutElement.getBoundingClientRect();
    const maxRightWidth = resolveMainSplitterMaxRightWidth(rect.width);
    setActiveResizeHandle("main");

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const nextRightWidth = rect.right - moveEvent.clientX;
      setRightPaneWidth(
        clampNumber(
          nextRightWidth,
          CLIENT_MAIN_SPLITTER_MIN_RIGHT_WIDTH_PX,
          maxRightWidth,
        ),
      );
    };

    const stopResizing = () => {
      setActiveResizeHandle(null);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopResizing);
      window.removeEventListener("pointercancel", stopResizing);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopResizing);
    window.addEventListener("pointercancel", stopResizing);
  }

  return {
    layoutRef,
    rightPaneWidth,
    isMainSplitterResizing: activeResizeHandle === "main",
    onMainSplitterPointerDown,
  };
}
