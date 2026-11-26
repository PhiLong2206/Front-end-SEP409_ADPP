import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import DashboardHeader from "./DashboardHeader";

const DashboardLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem("adpp_sidebar_collapsed") === "true";
    } catch {
      return false;
    }
  });

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("adpp_sidebar_collapsed", String(next));
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  };

  return (
    <div className="page-modern relative min-h-screen flex bg-canvas font-apple text-label selection:bg-accent selection:text-accent-contrast">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        isCollapsed={isCollapsed}
        onToggleCollapse={toggleCollapse}
      />
      <div
        className={`relative flex-1 flex flex-col min-h-screen min-w-0 transition-[margin] duration-(--t-slow) ease-ap ${
          isCollapsed ? "lg:ml-[76px]" : "lg:ml-[264px]"
        }`}
      >
        {/* A soft light behind the page: the only decoration */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[420px] overflow-hidden">
          <div
            className="absolute -top-40 right-[-8%] h-[460px] w-[460px] rounded-full blur-3xl"
            style={{ background: "color-mix(in srgb, var(--accent) 12%, transparent)" }}
          />
          <div
            className="absolute -top-48 left-[10%] h-[400px] w-[400px] rounded-full blur-3xl"
            style={{ background: "color-mix(in srgb, var(--accent-2) 10%, transparent)" }}
          />
        </div>

        <DashboardHeader onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
        <main className="relative flex-1 p-5 sm:p-7 lg:p-8 max-w-7xl w-full mx-auto animate-fade-in motion-reduce:animate-none">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
