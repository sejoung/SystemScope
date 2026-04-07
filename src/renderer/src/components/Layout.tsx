import { useEffect, useRef, type ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { useSettingsStore } from "../stores/useSettingsStore";
import { useContainerWidth } from "../hooks/useContainerWidth";
import { isCompactWidth, RESPONSIVE_WIDTH } from "../hooks/useResponsiveLayout";

const IS_MAC = navigator.userAgent.includes("Macintosh");

export function shouldUseShellCompactLayout(width: number): boolean {
  return isCompactWidth(width, RESPONSIVE_WIDTH.shellCompact);
}

export function Layout({ children }: { children: ReactNode }) {
  const [containerRef, containerWidth] = useContainerWidth(1280);
  const mainRef = useRef<HTMLElement>(null);
  const currentPage = useSettingsStore((s) => s.currentPage);
  const compactLayout = shouldUseShellCompactLayout(containerWidth);

  useEffect(() => {
    mainRef.current?.scrollTo(0, 0);
  }, [currentPage]);

  return (
    <div
      ref={containerRef}
      className="app-shell"
      style={{
        display: "flex",
        flexDirection: compactLayout ? "column" : "row",
        height: compactLayout ? "auto" : "100vh",
        minHeight: "100vh",
        overflow: compactLayout ? "auto" : "hidden",
      }}
    >
      {/* 전체 너비에 걸친 상단 타이틀바 드래그 영역 */}
      {IS_MAC && (
        <div
          className="titlebar-drag"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            height: "38px",
            zIndex: 1000,
          }}
        />
      )}
      <Sidebar compactLayout={compactLayout} />
      <main
        ref={mainRef}
        className="app-main"
        style={{
          flex: 1,
          overflow: "auto",
          padding: compactLayout ? "16px" : "20px 24px",
          paddingTop: compactLayout ? "16px" : IS_MAC ? "48px" : "20px",
        }}
      >
        {children}
      </main>
    </div>
  );
}
