import { useEffect, useRef, useState } from "react";
import type { MainViewTab } from "~/lib/client/usecase/workspace/config-panel/main-view-tab";

export function useConfigPanelState() {
  const [activeMainTab, setActiveMainTab] = useState<MainViewTab>("threads");
  const activeMainTabRef = useRef<MainViewTab>("threads");

  useEffect(() => {
    activeMainTabRef.current = activeMainTab;
  }, [activeMainTab]);

  return {
    activeMainTab,
    activeMainTabRef,
    setActiveMainTab,
  };
}

export function useLockedConfigPanelTab(options: {
  activeMainTab: MainViewTab;
  isChatLocked: boolean;
  setActiveMainTab: (tab: MainViewTab) => void;
}) {
  useEffect(() => {
    if (options.isChatLocked && options.activeMainTab !== "settings") {
      options.setActiveMainTab("settings");
    }
  }, [options.activeMainTab, options.isChatLocked, options.setActiveMainTab]);
}
