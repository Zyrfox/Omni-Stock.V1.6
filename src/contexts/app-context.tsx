"use client";

import { createContext, useContext } from "react";

interface AppContextValue {
  isGuest: boolean;
  userRole: string; // "admin" | "manager" | "guest"
}

const AppContext = createContext<AppContextValue>({ isGuest: false, userRole: "manager" });

export function AppProvider({
  children,
  isGuest,
  userRole,
}: {
  children: React.ReactNode;
  isGuest: boolean;
  userRole: string;
}) {
  return (
    <AppContext.Provider value={{ isGuest, userRole }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  return useContext(AppContext);
}
