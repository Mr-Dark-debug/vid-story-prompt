import {
  Bot,
  Cloud,
  Database,
  FileQuestion,
  Folder,
  Link2,
  MessageSquare,
  Mic2,
  Podcast,
  Upload,
  Video,
  Youtube,
} from "lucide-react";
import type { ConnectorIcon as ConnectorIconName } from "@/domain/connectors/types";
import { cn } from "@/lib/utils";

const icons = {
  upload: Upload,
  youtube: Youtube,
  cloud: Cloud,
  link: Link2,
  podcast: Podcast,
  video: Video,
  recording: Mic2,
  database: Database,
  automation: Bot,
  folder: Folder,
  message: MessageSquare,
  other: FileQuestion,
} satisfies Record<ConnectorIconName, typeof Upload>;

export function ConnectorIcon({
  icon,
  className,
}: {
  icon: ConnectorIconName;
  className?: string;
}) {
  const Icon = icons[icon];
  return <Icon aria-hidden="true" className={cn("h-5 w-5", className)} />;
}
