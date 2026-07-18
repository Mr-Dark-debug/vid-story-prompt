import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { classifyTurnstileClientError, TurnstileWidget } from "./turnstile";

describe("TurnstileWidget", () => {
  afterEach(() => {
    delete window.turnstile;
  });

  it("classifies permanent and retryable client errors", () => {
    expect(classifyTurnstileClientError("110200")).toEqual({
      message: "Security verification is not enabled for this website.",
      retryable: false,
    });
    expect(classifyTurnstileClientError("300030").retryable).toBe(true);
    expect(classifyTurnstileClientError("110600").retryable).toBe(true);
  });

  it("invalidates the token and resets once for a retryable widget error", async () => {
    const reset = vi.fn();
    const remove = vi.fn();
    const onToken = vi.fn();
    let errorCallback: ((code?: string) => void) | undefined;

    window.turnstile = {
      remove,
      reset,
      render: vi.fn((_container, options) => {
        errorCallback = options["error-callback"];
        return "widget-1";
      }),
    };

    render(
      <TurnstileWidget
        action="signup"
        appearance="always"
        onToken={onToken}
        resetKey={0}
        siteKey="test-site-key"
      />,
    );

    await waitFor(() => expect(errorCallback).toBeTypeOf("function"));
    act(() => errorCallback?.("300030"));

    expect(onToken).toHaveBeenLastCalledWith(null);
    expect(reset).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("alert")).toHaveTextContent(/interrupted/i);

    act(() => errorCallback?.("300030"));
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
