"use client";

import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import type { Profile } from "@/types/user";

/**
 * Read the cached Supabase user from localStorage without acquiring the
 * Navigator LockManager lock.  Used as a fallback when onAuthStateChange
 * hangs in Capacitor WebViews so the UI can show the correct auth state
 * instead of defaulting to "signed out".
 */
function getCachedUser(): User | null {
  try {
    const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split(".")[0];
    const raw = localStorage.getItem(`sb-${ref}-auth-token`);
    if (!raw) return null;
    return JSON.parse(raw)?.user ?? null;
  } catch {
    return null;
  }
}

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
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .single();
        if (error) throw error;
        setProfile(data);
        return;
      } catch (err) {
        if (attempt === 0) {
          // Retry once after a short delay (network hiccup, cold start, etc.)
          await new Promise((r) => setTimeout(r, 1_000));
          continue;
        }
        console.warn("[auth] Profile fetch failed after retry:", err);
        setProfile(null);
      }
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

    // Safety timeout: if onAuthStateChange hasn't fired within 3 seconds
    // (e.g. Navigator LockManager stuck in Capacitor WebView after long
    // background period), force isLoading = false so the UI never freezes.
    // Read the cached user from localStorage so the UI shows the correct
    // auth state instead of defaulting to "signed out".
    safetyTimeoutRef.current = setTimeout(() => {
      if (!authResolved.current) {
        const cached = getCachedUser();
        if (cached) {
          setUser(cached);
          fetchProfile(cached.id).catch(() => {});
        }
        setIsLoading(false);
      }
    }, 3_000);

    // Re-verify auth when Capacitor app resumes from background.
    // Do NOT set isLoading=true here — the user already sees valid auth
    // state from the previous session. Refresh silently in the background
    // and transition directly (e.g. signed-in -> signed-out) if needed.
    // This prevents the loading skeleton from getting stuck forever when
    // the LockManager hangs in Capacitor WebViews after long background.
    const resumeGeneration = { current: 0 };

    const handleAppResume = async () => {
      const gen = ++resumeGeneration.current;

      // Safety: guarantee isLoading=false even if everything below hangs
      const safetyTimer = setTimeout(() => {
        if (resumeGeneration.current === gen) setIsLoading(false);
      }, 8_000);

      try {
        const TIMEOUT = Symbol("timeout");
        const result = await Promise.race([
          supabase.auth.getUser(),
          new Promise<typeof TIMEOUT>((resolve) =>
            setTimeout(() => resolve(TIMEOUT), 10_000)
          ),
        ]);
        // Discard result if a newer resume has started
        if (resumeGeneration.current !== gen) return;

        // If getUser() timed out (LockManager hung), keep existing user
        // state rather than falsely setting user to null.
        if (typeof result === "symbol") return;

        const freshUser = result.data.user;
        setUser(freshUser);
        if (freshUser) {
          await fetchProfile(freshUser.id);
        } else {
          setProfile(null);
        }
      } catch {
        // onAuthStateChange will correct state if needed
      } finally {
        clearTimeout(safetyTimer);
        if (resumeGeneration.current === gen) setIsLoading(false);
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
