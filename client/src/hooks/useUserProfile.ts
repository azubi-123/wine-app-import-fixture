import { useState, useEffect } from "react";

interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  tastingSessions: TastingHistory[];
}

interface TastingHistory {
  id: string;
  packageName: string;
  packageCode: string;
  completedAt: Date;
  progress: number;
  answers: Record<string, any>;
  rating?: number;
}

export function useUserProfile() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load user profile from localStorage
    const savedProfile = localStorage.getItem('wine_user_profile');
    if (savedProfile) {
      try {
        const profile = JSON.parse(savedProfile);
        setUser(profile);
      } catch (error) {
        console.error('Error loading user profile:', error);
      }
    }
    setIsLoading(false);
  }, []);

  const updateUser = (updatedUser: UserProfile) => {
    setUser(updatedUser);
    localStorage.setItem('wine_user_profile', JSON.stringify(updatedUser));
  };

  const addTastingSession = (session: Omit<TastingHistory, 'id'>) => {
    if (!user) return;

    const newSession: TastingHistory = {
      ...session,
      id: crypto.randomUUID(),
    };

    const updatedUser = {
      ...user,
      tastingSessions: [...user.tastingSessions, newSession]
    };

    updateUser(updatedUser);
  };

  const updateTastingSession = (sessionId: string, updates: Partial<TastingHistory>) => {
    if (!user) return;

    const updatedSessions = user.tastingSessions.map(session =>
      session.id === sessionId ? { ...session, ...updates } : session
    );

    const updatedUser = {
      ...user,
      tastingSessions: updatedSessions
    };

    updateUser(updatedUser);
  };

  const clearUser = () => {
    setUser(null);
    localStorage.removeItem('wine_user_profile');
  };

  return {
    user,
    isLoading,
    updateUser,
    addTastingSession,
    updateTastingSession,
    clearUser,
    isAuthenticated: !!user
  };
}