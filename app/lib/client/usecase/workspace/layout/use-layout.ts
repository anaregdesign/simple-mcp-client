import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  applyMainSplitterBodyStyle,
  installWindowPointerDragListeners,
  installWindowResizeListener,
} from "~/lib/client/infrastructure/browser/workspace-layout";
import {
  CLIENT_MAIN_SPLITTER_MIN_RIGHT_WIDTH_PX,
} from "~/lib/constants/client";
import { resolveMainSplitterMaxRightWidth } from "~/lib/client/usecase/workspace/layout/main-splitter";

const DEFAULT_RIGHT_PANE_WIDTH_PX = 420;

function clampNumber(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) {
    return min;
  }
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}

export function useWorkspaceLayout() {
  const layoutRef = useRef<HTMLDivElement | null>(null);
  const activeResizeCleanupRef = useRef<(() => void) | null>(null);
  const [rightPaneWidth, setRightPaneWidth] = useState(
    DEFAULT_RIGHT_PANE_WIDTH_PX,
  );
  const [activeResizeHandle, setActiveResizeHandle] = useState<"main" | null>(
    null,
  );

  useEffect(() => {
    return applyMainSplitterBodyStyle(activeResizeHandle === "main");
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
    return installWindowResizeListener(handleResize);
  }, []);

  useEffect(() => {
    return () => {
      activeResizeCleanupRef.current?.();
      activeResizeCleanupRef.current = null;
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

    activeResizeCleanupRef.current?.();
    activeResizeCleanupRef.current = installWindowPointerDragListeners({
      onPointerMove: handlePointerMove,
      onPointerEnd: () => {
        activeResizeCleanupRef.current = null;
        setActiveResizeHandle(null);
      },
    });
  }

  return {
    layoutRef,
    rightPaneWidth,
    isMainSplitterResizing: activeResizeHandle === "main",
    onMainSplitterPointerDown,
  };
}
