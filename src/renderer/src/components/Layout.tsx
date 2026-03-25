import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";

const IS_MAC = navigator.userAgent.includes("Macintosh");

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div
      className="app-shell"
      style={{ display: "flex", height: "100vh", overflow: "hidden" }}
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
      <Sidebar />
      <main
        className="app-main"
        style={{
          flex: 1,
          overflow: "auto",
          padding: "20px 24px",
          paddingTop: IS_MAC ? "48px" : "20px",
        }}
      >
        {children}
      </main>
    </div>
  );
}
