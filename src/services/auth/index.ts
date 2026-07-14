import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  getCurrentSession,
  beginGoogleSignIn,
  login,
  logout,
  requestPasswordReset,
  resetPassword,
  signup,
} from "./server";

export type User = NonNullable<Awaited<ReturnType<typeof getCurrentSession>>>;

export const authService = {
  current: getCurrentSession,
  login: (email: string, password: string) => login({ data: { email, password } }),
  signup: (
    email: string,
    password: string,
    displayName: string,
    turnstileToken?: string,
    redirect?: string,
  ) => signup({ data: { email, password, displayName, turnstileToken, redirect } }),
  googleSignIn: (
    intent: "login" | "signup",
    redirect?: string,
    turnstileToken?: string,
  ) => beginGoogleSignIn({ data: { intent, redirect, turnstileToken } }),
  requestPasswordReset: (email: string) => requestPasswordReset({ data: { email } }),
  resetPassword: (password: string) => resetPassword({ data: { password } }),
  logout: () => logout(),
};

export function useSession() {
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => {
    let active = true;
    const refresh = () => {
      getCurrentSession()
        .then((session) => active && setUser(session))
        .catch(() => active && setUser(null));
    };
    refresh();
    const { data } = getSupabaseBrowserClient().auth.onAuthStateChange(() => refresh());
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);
  return user;
}
