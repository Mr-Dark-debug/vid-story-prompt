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

  it("uses managed automatic retry without resetting inside an error callback", async () => {
    const reset = vi.fn();
    const remove = vi.fn();
    const onToken = vi.fn();
    let errorCallback: ((code?: string) => void) | undefined;
    let renderOptions: Parameters<NonNullable<typeof window.turnstile>["render"]>[1] | undefined;

    window.turnstile = {
      remove,
      reset,
      render: vi.fn((_container, options) => {
        renderOptions = options;
        errorCallback = options["error-callback"];
        return "widget-1";
      }),
    };

    render(
      <TurnstileWidget
        action="signup"
        appearance="interaction-only"
        onToken={onToken}
        resetKey={0}
        siteKey="test-site-key"
      />,
    );

    await waitFor(() => expect(errorCallback).toBeTypeOf("function"));
    act(() => errorCallback?.("300030"));

    expect(onToken).toHaveBeenLastCalledWith(null);
    expect(reset).not.toHaveBeenCalled();
    expect(renderOptions?.appearance).toBe("interaction-only");
    expect(renderOptions?.retry).toBe("auto");
    expect(renderOptions?.["refresh-expired"]).toBe("auto");
    expect(await screen.findByRole("alert")).toHaveTextContent(/interrupted/i);
  });

  it("keeps the challenge hidden after an automatic verification succeeds", async () => {
    const onToken = vi.fn();
    let successCallback: ((token: string) => void) | undefined;
    window.turnstile = {
      remove: vi.fn(),
      reset: vi.fn(),
      render: vi.fn((_container, options) => {
        successCallback = options.callback;
        return "widget-2";
      }),
    };

    render(
      <TurnstileWidget
        action="login"
        appearance="interaction-only"
        onToken={onToken}
        resetKey={0}
        siteKey="test-site-key"
      />,
    );

    await waitFor(() => expect(successCallback).toBeTypeOf("function"));
    act(() => successCallback?.("verified-token"));

    expect(onToken).toHaveBeenLastCalledWith("verified-token");
    expect(await screen.findByRole("status")).toHaveTextContent("Browser security checked");
  });
});
