import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { MarketingLayout } from "@/components/marketing/layout";
import { Container, Section } from "@/components/primitives/section";
import { MarketingPageHero } from "@/components/marketing/page-shell";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { submitSupportRequest } from "@/services/support/server";
import { userFacingError } from "@/lib/user-facing-error";

const schema = z.object({
  name: z.string().trim().min(1, "Please tell us your name").max(100),
  email: z.string().trim().email("Invalid email").max(255),
  topic: z.enum(["general", "billing", "partnership", "trust"]),
  message: z.string().trim().min(8, "A little more context helps").max(2000),
});

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact — Vidrial" },
      { name: "description", content: "Get in touch with the Vidrial team." },
      { property: "og:url", content: "/contact" },
    ],
    links: [{ rel: "canonical", href: "/contact" }],
  }),
  component: ContactPage,
});

function ContactPage() {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  return (
    <MarketingLayout>
      <MarketingPageHero
        eyebrow="Contact"
        title="Say hello, or tell us what's slow."
        lead="We read every message. No form pit, no ticket queue."
      />
      <Section>
        <div className="mx-auto max-w-xl">
          <form
            noValidate
            onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const parsed = schema.safeParse(Object.fromEntries(fd));
              if (!parsed.success) {
                const errs: Record<string, string> = {};
                for (const iss of parsed.error.issues) errs[iss.path[0] as string] = iss.message;
                setErrors(errs);
                document.getElementById(String(parsed.error.issues[0]?.path[0]))?.focus();
                return;
              }
              setErrors({});
              setBusy(true);
              try {
                await submitSupportRequest({ data: { ...parsed.data, website: "" } });
                (e.currentTarget as HTMLFormElement).reset();
                toast.success("Message received", {
                  description: "Your request is stored securely for the Vidrial team.",
                });
              } catch (cause) {
                toast.error(userFacingError(cause, "Your message could not be sent. Try again."));
              } finally {
                setBusy(false);
              }
            }}
            className="space-y-4"
          >
            <Field label="Name" name="name" error={errors.name} />
            <Field label="Email" name="email" type="email" error={errors.email} />
            <input
              name="website"
              tabIndex={-1}
              autoComplete="off"
              className="sr-only"
              aria-hidden="true"
            />
            <div>
              <label htmlFor="topic" className="mb-1.5 block text-sm text-ink">
                Topic
              </label>
              <select
                id="topic"
                name="topic"
                defaultValue="general"
                className="w-full rounded-md border border-line bg-surface-panel px-3 py-2 text-sm"
              >
                <option value="general">General</option>
                <option value="billing">Billing</option>
                <option value="partnership">Partnership</option>
                <option value="trust">Trust & safety</option>
              </select>
            </div>
            <div>
              <label htmlFor="message" className="mb-1.5 block text-sm text-ink">
                Message
              </label>
              <textarea
                id="message"
                name="message"
                rows={6}
                className="w-full rounded-md border border-line bg-surface-panel px-3 py-2 text-sm"
              />
              {errors.message && <p className="mt-1 text-xs text-danger">{errors.message}</p>}
            </div>
            <Button type="submit" loading={busy} loadingText="Sending…">
              Send message
            </Button>
            <p className="text-xs text-ink-mute">
              Messages are stored securely and limited to prevent abuse.
            </p>
          </form>
        </div>
      </Section>
    </MarketingLayout>
  );
}

function Field({
  label,
  name,
  type = "text",
  error,
}: {
  label: string;
  name: string;
  type?: string;
  error?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="mb-1.5 block text-sm text-ink">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        autoComplete={type === "email" ? "email" : "name"}
        spellCheck={type === "email" ? false : undefined}
        className="w-full rounded-md border border-line bg-surface-panel px-3 py-2 text-sm"
        aria-invalid={!!error}
        aria-describedby={error ? `${name}-err` : undefined}
      />
      {error && (
        <p id={`${name}-err`} className="mt-1 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
