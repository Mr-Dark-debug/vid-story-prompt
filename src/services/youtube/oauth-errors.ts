export function youtubeOAuthErrorMessage(error?: string) {
  if (error === "access_denied") {
    return "Google did not grant YouTube access. If Google says Vidrial is in Testing or has not completed verification, the site owner must update the Google OAuth configuration; retrying cannot fix that restriction. If you declined permission, you can reconnect when ready.";
  }
  if (error === "org_internal" || error === "admin_policy_enforced") {
    return "Your Google organisation restricts this connection. Ask its administrator to approve Vidrial's YouTube access.";
  }
  return "YouTube connection did not complete. Start the connection again from Integrations.";
}
