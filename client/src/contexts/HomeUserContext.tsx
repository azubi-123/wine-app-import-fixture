import { createContext, useContext } from "react";
import type { User } from "@shared/schema";

interface HomeUserContextValue {
  user: User;
}

export const HomeUserContext = createContext<HomeUserContextValue | null>(null);

export function useHomeUser(): User {
  const context = useContext(HomeUserContext);
  if (!context) {
    throw new Error("useHomeUser must be used within HomeLayout");
  }
  return context.user;
}
