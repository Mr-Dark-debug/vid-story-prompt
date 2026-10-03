import type { ReactNode } from "react";
export function AppPageHeader({
  title,
  description,
  eyebrow,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6">
      <p>{eyebrow}</p>
      <h1 className="text-3xl text-ink">{title}</h1>
      <p>{description}</p>
      {actions}
    </header>
  );
}
