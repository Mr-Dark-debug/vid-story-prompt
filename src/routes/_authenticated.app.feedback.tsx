import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Star, Send } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { userFacingError } from "@/lib/user-facing-error";
import { getCurrentSession } from "@/services/auth/server";
import { submitSupportRequest } from "@/services/support/server";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/app/feedback")({
  head: () => ({ meta: [{ title: "Feedback — Vidrial" }] }),
  loader: () => getCurrentSession(),
  component: Feedback,
});

function Feedback() {
  const user = Route.useLoaderData();
  const navigate = useNavigate();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [message, setMessage] = useState("");
  const [moreQuestions, setMoreQuestions] = useState<"yes" | "no">("yes");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (rating === 0) {
      toast.error("Please select a star rating.");
      return;
    }
    setSending(true);

    // Format rating and follow-up preference into the message payload for support ticket
    const formattedMessage = `Rating: ${rating}/5 stars\nTime for more questions: ${moreQuestions === "yes" ? "Yes" : "No"}\n\nMessage:\n${message}`;

    try {
      await submitSupportRequest({
        data: {
          name: user?.name || "Vidrial user",
          email: user?.email || "",
          topic: "general",
          message: formattedMessage,
          website: "",
        },
      });
      setSent(true);
      setMessage("");
      setRating(0);
      setMoreQuestions("yes");
      toast.success("Feedback sent. Thank you.");
    } catch (cause) {
      toast.error(userFacingError(cause, "Feedback could not be sent. Try again."));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-12rem)] items-center justify-center px-4 py-6">
      <div className="w-full max-w-2xl border border-line bg-surface-panel p-8 shadow-sm transition-all duration-300 rounded-3xl md:p-12">
        <div className="mb-8 text-center md:mb-10">
          <h1 className="font-display text-3xl font-bold tracking-tight text-ink">Give Feedback</h1>
          <p className="mt-2 text-sm text-ink-soft">How to satisfy you with your experience with us</p>
        </div>

        <form onSubmit={submit} className="space-y-6 md:space-y-8">
          {/* Rate Your Experience */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold text-ink">Rate Your Experience</Label>
            <div className="flex items-center gap-1.5 mt-1">
              {[1, 2, 3, 4, 5].map((star) => {
                const isFilled = star <= (hoverRating || rating);
                return (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="cursor-pointer text-ink-mute/30 transition-all duration-150 active:scale-95 hover:scale-110 p-1"
                    aria-label={`Rate ${star} out of 5 stars`}
                  >
                    <Star
                      className={cn(
                        "h-7 w-7 transition-all duration-150",
                        isFilled
                          ? "fill-primary text-primary scale-105"
                          : "text-ink-mute/30 hover:text-primary/50"
                      )}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Thoughts/Description */}
          <div className="space-y-2">
            <Label htmlFor="feedback-message" className="text-sm font-semibold text-ink">
              Do you have any thoughts you'd like to share?
            </Label>
            <Textarea
              id="feedback-message"
              name="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              minLength={8}
              maxLength={1900}
              rows={5}
              placeholder="Enter a description..."
              className="mt-2 rounded-2xl border border-line bg-surface-page/50 p-4 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-transparent transition-all resize-none"
            />
          </div>

          {/* More Questions */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold leading-relaxed text-ink">
              Do you have time for a few more questions about your overall experience?
            </Label>
            <RadioGroup
              value={moreQuestions}
              onValueChange={(val) => setMoreQuestions(val as "yes" | "no")}
              className="flex items-center gap-6 mt-1"
            >
              <div className="flex items-center space-x-2.5 cursor-pointer">
                <RadioGroupItem value="yes" id="q-yes" className="h-5 w-5 border-2 text-primary focus-visible:ring-primary" />
                <Label htmlFor="q-yes" className="cursor-pointer text-sm font-normal text-ink-soft">
                  Yes
                </Label>
              </div>
              <div className="flex items-center space-x-2.5 cursor-pointer">
                <RadioGroupItem value="no" id="q-no" className="h-5 w-5 border-2 text-primary focus-visible:ring-primary" />
                <Label htmlFor="q-no" className="cursor-pointer text-sm font-normal text-ink-soft">
                  No
                </Label>
              </div>
            </RadioGroup>
          </div>

          {sent ? (
            <p role="status" className="text-sm font-medium text-success">
              Your previous message was sent successfully. Thank you for your feedback!
            </p>
          ) : null}

          {/* Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-3 pt-4 border-t border-line/50">
            <Button
              type="submit"
              loading={sending}
              loadingText="Sending…"
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm cursor-pointer"
            >
              Send Feedback
            </Button>
            <Button
              type="button"
              onClick={() => navigate({ to: "/app" })}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl font-semibold bg-accent text-accent-foreground hover:bg-accent/80 transition-colors border-transparent border cursor-pointer"
            >
              Cancel Feedback
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
