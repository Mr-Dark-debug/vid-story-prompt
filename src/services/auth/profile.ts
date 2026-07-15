type AuthProfileSource = {
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
};

type StoredProfile = {
  avatar_url?: string | null;
  display_name?: string | null;
};

function metadataString(metadata: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function safeAvatarUrl(value?: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

export function resolveAuthProfile(user: AuthProfileSource, profile?: StoredProfile | null) {
  const metadata = user.user_metadata ?? {};
  const emailName = user.email?.split("@")[0] || "Your account";
  const providerName = metadataString(metadata, ["display_name", "full_name", "name"]);
  const storedName = profile?.display_name?.trim();
  const generatedStoredName =
    !storedName || storedName.toLocaleLowerCase() === emailName.toLocaleLowerCase();

  return {
    name: generatedStoredName ? (providerName ?? storedName ?? emailName) : storedName,
    avatarUrl: safeAvatarUrl(
      profile?.avatar_url ?? metadataString(metadata, ["avatar_url", "picture"]),
    ),
  };
}
