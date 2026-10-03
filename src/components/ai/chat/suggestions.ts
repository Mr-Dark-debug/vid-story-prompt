// Starter prompts for an empty chat. They are product copy, not provider data, and are inserted
// into the composer for the user to edit; they are never sent automatically.
export type SuggestedPrompt = { title: string; hint: string; prompt: string };

export const SUGGESTED_PROMPTS: readonly SuggestedPrompt[] = [
  {
    title: "Title and hook ideas",
    hint: "Five options for a short clip",
    prompt:
      "Give me five title and opening-hook ideas for a 45-second clip about: [describe the moment]. Make each hook stand on its own without prior context.",
  },
  {
    title: "Rewrite a caption",
    hint: "Shorter and sharper",
    prompt:
      "Rewrite this caption so it is shorter and more direct, keeping my voice. Offer three versions:\n\n[paste caption]",
  },
  {
    title: "Reframe the pitch",
    hint: "For someone who has never heard of it",
    prompt:
      "Here is how I explain this video to people who already follow me. Reframe it for a cold audience who has never seen my work:\n\n[paste description]",
  },
  {
    title: "Copy for each platform",
    hint: "Shorts, Instagram, TikTok, LinkedIn",
    prompt:
      "Write platform-specific copy for this clip, matching each platform's norms for length and tone: YouTube Shorts, Instagram, TikTok and LinkedIn.\n\nClip summary: [paste summary]",
  },
];
