import { useEffect, useState } from "react";

export type User = {
  id: string;
  email: string;
  name: string;
  avatarSeed: string;
  plan: "free" | "creator" | "pro";
};

const KEY = "vidrial.session.v1";

type Session = { user: User; issuedAt: number };

function read(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

function write(session: Session | null) {
  if (typeof window === "undefined") return;
  if (session) window.localStorage.setItem(KEY, JSON.stringify(session));
  else window.localStorage.removeItem(KEY);
  window.dispatchEvent(new CustomEvent("vidrial:auth"));
}

function nameFromEmail(email: string) {
  const local = email.split("@")[0] ?? "you";
  return local
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export const authService = {
  current(): User | null {
    return read()?.user ?? null;
  },
  async login(email: string, _password: string): Promise<User> {
    await new Promise((r) => setTimeout(r, 450));
    const user: User = {
      id: `u_${btoa(email).slice(0, 8)}`,
      email,
      name: nameFromEmail(email),
      avatarSeed: email,
      plan: "creator",
    };
    write({ user, issuedAt: Date.now() });
    return user;
  },
  async signup(email: string, _password: string, name?: string): Promise<User> {
    await new Promise((r) => setTimeout(r, 550));
    const user: User = {
      id: `u_${btoa(email).slice(0, 8)}`,
      email,
      name: name?.trim() || nameFromEmail(email),
      avatarSeed: email,
      plan: "free",
    };
    write({ user, issuedAt: Date.now() });
    return user;
  },
  async requestPasswordReset(_email: string): Promise<void> {
    await new Promise((r) => setTimeout(r, 400));
  },
  async resetPassword(_password: string): Promise<void> {
    await new Promise((r) => setTimeout(r, 400));
  },
  logout() {
    write(null);
  },
};

export function useSession() {
  const [user, setUser] = useState<User | null>(() => authService.current());
  useEffect(() => {
    const sync = () => setUser(authService.current());
    sync();
    window.addEventListener("vidrial:auth", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("vidrial:auth", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return user;
}