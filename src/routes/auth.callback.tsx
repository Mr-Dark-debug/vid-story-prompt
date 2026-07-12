import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { exchangeAuthCode } from "@/services/auth/server";

const searchSchema = z.object({
  code: z.string().optional(),
  next: z.string().optional(),
  error: z.string().optional(),
  error_description: z.string().optional(),
});

function safeNext(value?: string) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/app";
}

export const Route = createFileRoute("/auth/callback")({
  validateSearch: searchSchema,
  beforeLoad: async ({ search }) => {
    if (search.error || !search.code) {
      throw redirect({
        to: "/login",
        search: {
          authError: search.error_description ?? "The secure sign-in link was invalid or expired.",
        } as never,
      });
    }
    try {
      await exchangeAuthCode({ data: { code: search.code } });
    } catch (cause) {
      throw redirect({
        to: "/login",
        search: {
          authError:
            cause instanceof Error ? cause.message : "The secure sign-in could not be completed.",
        } as never,
      });
    }
    throw redirect({ href: safeNext(search.next) });
  },
  component: () => null,
});
