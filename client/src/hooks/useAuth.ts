import { useState, useEffect, useCallback } from "react";

interface User {
  id?: number;
  email: string;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check server session on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // First check if we have a server session
        const response = await fetch("/api/auth/me", {
          credentials: "include"
        });

        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
          localStorage.setItem("cata_user_email", data.user.email);
        } else {
          // No server session - check localStorage and try to establish session
          const storedEmail = localStorage.getItem("cata_user_email");
          if (storedEmail) {
            // Try to establish server session with stored email
            const authResponse = await fetch("/api/auth", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email: storedEmail }),
              credentials: "include"
            });

            if (authResponse.ok) {
              const data = await authResponse.json();
              setUser(data.user);
            } else {
              // Auth failed - clear localStorage
              localStorage.removeItem("cata_user_email");
            }
          }
        }
      } catch (error) {
        console.error("Auth check failed:", error);
        // Network error -- do not set user from localStorage alone
        // (a user without a server session will fail on all API calls)
      }
      setIsLoading(false);
    };

    checkAuth();
  }, []);

  const login = useCallback(async (email: string) => {
    try {
      // Call server auth endpoint to establish session
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
        credentials: "include"
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem("cata_user_email", email);
        setUser(data.user);
        return { success: true };
      } else {
        const error = await response.json();
        return { success: false, error: error.error };
      }
    } catch (error) {
      console.error("Login failed:", error);
      return { success: false, error: "Network error. Please check your connection." };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include"
      });
    } catch (error) {
      console.error("Logout failed:", error);
    }
    localStorage.removeItem("cata_user_email");
    setUser(null);
  }, []);

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout
  };
}
