"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import type { Profile } from "@/types/user";

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  isAdmin: boolean;
  isLoggedIn: boolean;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

const supabase = createClient();

export function useAuthProvider(): AuthContextType {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();
      setProfile(data);
    } catch {
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    // onAuthStateChange fires INITIAL_SESSION on first subscription,
    // so we don't need a separate getSession() call (which would race
    // for the same Navigator LockManager lock and cause timeouts).
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event: AuthChangeEvent, session: Session | null) => {
      try {
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchProfile(session.user.id);
        } else {
          setProfile(null);
        }
      } catch {
        // Don't block loading on profile fetch failure
      } finally {
        setIsLoading(false);
      }
    });

    // Re-verify auth when Capacitor app resumes from background
    // (visibilitychange doesn't reliably fire in native WebViews).
    // Use getUser() to force a server-side token refresh.
    const handleAppResume = async () => {
      try {
        const { data: { user: freshUser } } = await supabase.auth.getUser();
        setUser(freshUser);
        if (freshUser) {
          await fetchProfile(freshUser.id);
        } else {
          setProfile(null);
        }
      } catch {
        // Silently handle — onAuthStateChange will correct state if needed
      }
    };
    window.addEventListener("bfg:app-resume", handleAppResume);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener("bfg:app-resume", handleAppResume);
    };
  }, [fetchProfile]);

  return {
    user,
    profile,
    isLoading,
    isAdmin: profile?.role === "admin",
    isLoggedIn: !!user,
  };
}
