"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { JarvisOrbState } from "./JarvisOrb";

interface AppUIState {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  jarvisState: JarvisOrbState;
  setJarvisState: (state: JarvisOrbState) => void;
}

const AppUIContext = createContext<AppUIState | null>(null);

export function AppProviders({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [jarvisState, setJarvisState] = useState<JarvisOrbState>("idle");

  return (
    <AppUIContext.Provider value={{ sidebarOpen, setSidebarOpen, jarvisState, setJarvisState }}>
      {children}
    </AppUIContext.Provider>
  );
}

export function useAppUI() {
  const ctx = useContext(AppUIContext);
  if (!ctx) throw new Error("useAppUI must be used within AppProviders");
  return ctx;
}
