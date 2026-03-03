"use client";

import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
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

  // Track whether onAuthStateChange has fired at least once
  const authResolved = useRef(false);
  const safetyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      // Synchronously mark as resolved and clear safety timeout
      // BEFORE any await to prevent the timeout from firing mid-callback.
      authResolved.current = true;
      if (safetyTimeoutRef.current) {
        clearTimeout(safetyTimeoutRef.current);
        safetyTimeoutRef.current = null;
      }

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

    // Safety timeout: if onAuthStateChange hasn't fired within 5 seconds
    // (e.g. Navigator LockManager stuck in Capacitor WebView after long
    // background period), force isLoading = false so the UI never freezes.
    safetyTimeoutRef.current = setTimeout(() => {
      if (!authResolved.current) {
        setIsLoading(false);
      }
    }, 5_000);

    // Re-verify auth when Capacitor app resumes from background
    // (visibilitychange doesn't reliably fire in native WebViews).
    // Use getUser() to force a server-side token refresh.
    // Race against a 10s timeout to prevent hanging if LockManager is stuck.
    const handleAppResume = async () => {
      setIsLoading(true);
      try {
        const result = await Promise.race([
          supabase.auth.getUser(),
          new Promise<{ data: { user: null } }>((resolve) =>
            setTimeout(() => resolve({ data: { user: null } }), 10_000)
          ),
        ]);
        const freshUser = result.data.user;
        setUser(freshUser);
        if (freshUser) {
          await fetchProfile(freshUser.id);
        } else {
          setProfile(null);
        }
      } catch {
        // Silently handle — onAuthStateChange will correct state if needed
      } finally {
        setIsLoading(false);
      }
    };
    window.addEventListener("bfg:app-resume", handleAppResume);

    // Backup for PWA / browser: re-verify auth when page becomes visible
    // after being hidden for more than 60 seconds. Capacitor native uses
    // bfg:app-resume instead (visibilitychange is unreliable in WebViews).
    let hiddenAt = 0;
    const handleVisibility = () => {
      if (document.hidden) {
        hiddenAt = Date.now();
      } else if (hiddenAt > 0 && Date.now() - hiddenAt > 60_000) {
        handleAppResume();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      if (safetyTimeoutRef.current) {
        clearTimeout(safetyTimeoutRef.current);
        safetyTimeoutRef.current = null;
      }
      subscription.unsubscribe();
      window.removeEventListener("bfg:app-resume", handleAppResume);
      document.removeEventListener("visibilitychange", handleVisibility);
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
