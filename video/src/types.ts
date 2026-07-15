import { z } from "zod";

export const VideoPropsSchema = z.object({
  title: z.string().default("Vidrial Launch Film"),
  siteUrl: z.string().default("vidrial.vercel.app"),
  enableVoiceover: z.boolean().default(false),
  enableMusic: z.boolean().default(true),
  
  // Replaceable media assets
  musicUrl: z.string().default("music.mp3"),
  audioLogoUrl: z.string().default("audio-logo.mp3"),
  clickSoundUrl: z.string().default("click.mp3"),
  successSoundUrl: z.string().default("success.mp3"),
  
  // Customizable Copy
  s1Wordmark: z.string().default("VIDRIAL"),
  s2Copy1: z.string().default("Footage everywhere."),
  s2Copy2: z.string().default("The story still hidden."),
  s3Prompt: z.string().default("Find the strongest explanation, remove repetition, and build a 45-second first cut."),
  s4Headline: z.string().default("See the reasoning. Keep control."),
  s5Copy1: z.string().default("Editable by design."),
  s5Copy2: z.string().default("Ready for your judgment."),
  s6Headline: z.string().default("From source to shareable cut—in one workspace."),
  s7Copy1: z.string().default("Your footage."),
  s7Copy2: z.string().default("One prompt."),
  s7Copy3: z.string().default("A finished first cut."),
  s7Cta: z.string().default("Create your first cut"),
});

export type VideoProps = z.infer<typeof VideoPropsSchema>;
