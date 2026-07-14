import { useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export function RouteProgress() {
  const [mounted, setMounted] = useState(false);
  const pending = useRouterState({ select: (state) => state.status === "pending" });
  useEffect(() => setMounted(true), []);
  const loading = mounted && pending;
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5 overflow-hidden transition-opacity duration-150 motion-reduce:transition-none ${loading ? "opacity-100" : "opacity-0"}`}
    >
      <div className="h-full w-1/3 animate-[route-progress_1s_ease-in-out_infinite] bg-ember motion-reduce:w-full motion-reduce:animate-none" />
    </div>
  );
}
