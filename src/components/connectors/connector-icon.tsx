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
import type { IconType } from "react-icons";
import { BsMicrosoftTeams } from "react-icons/bs";
import { FaAws, FaLinkedin, FaSlack, FaXTwitter } from "react-icons/fa6";
import { GrAdobeCreativeCloud, GrOnedrive } from "react-icons/gr";
import {
  SiBox,
  SiBunnydotnet,
  SiCloudflare,
  SiDiscord,
  SiDropbox,
  SiFacebook,
  SiGooglecloud,
  SiGoogledrive,
  SiGooglemeet,
  SiGooglephotos,
  SiInstagram,
  SiKick,
  SiLoom,
  SiMake,
  SiN8N,
  SiNextcloud,
  SiNotion,
  SiRss,
  SiRumble,
  SiSoundcloud,
  SiSpotify,
  SiSynology,
  SiTelegram,
  SiTiktok,
  SiTwitch,
  SiVimeo,
  SiWasabi,
  SiWistia,
  SiYoutube,
  SiZapier,
  SiZoom,
} from "react-icons/si";
import { TbBrandAzure } from "react-icons/tb";
import brightcoveLogo from "@/assets/connectors/brightcove.png";
import buzzsproutLogo from "@/assets/connectors/buzzsprout.png";
import canvaLogo from "@/assets/connectors/canva.png";
import captivateLogo from "@/assets/connectors/captivate.png";
import descriptLogo from "@/assets/connectors/descript.png";
import frameioLogo from "@/assets/connectors/frameio.png";
import medalLogo from "@/assets/connectors/medal.png";
import muxLogo from "@/assets/connectors/mux.png";
import podbeanLogo from "@/assets/connectors/podbean.png";
import restreamLogo from "@/assets/connectors/restream.png";
import riversideLogo from "@/assets/connectors/riverside.png";
import sproutvideoLogo from "@/assets/connectors/sproutvideo.png";
import squadcastLogo from "@/assets/connectors/squadcast.png";
import streamyardLogo from "@/assets/connectors/streamyard.png";
import transistorLogo from "@/assets/connectors/transistor.png";
import vidyardLogo from "@/assets/connectors/vidyard.png";
import zencastrLogo from "@/assets/connectors/zencastr.png";
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

const providerIcons: Readonly<Record<string, IconType>> = {
  youtube: SiYoutube,
  rss: SiRss,
  google_drive: SiGoogledrive,
  dropbox: SiDropbox,
  onedrive: GrOnedrive,
  s3: FaAws,
  vimeo: SiVimeo,
  zoom: SiZoom,
  loom: SiLoom,
  box: SiBox,
  google_photos: SiGooglephotos,
  twitch: SiTwitch,
  kick: SiKick,
  rumble: SiRumble,
  facebook: SiFacebook,
  instagram: SiInstagram,
  tiktok: SiTiktok,
  linkedin: FaLinkedin,
  x: FaXTwitter,
  wistia: SiWistia,
  cloudflare_stream: SiCloudflare,
  teams: BsMicrosoftTeams,
  google_meet: SiGooglemeet,
  spotify_creators: SiSpotify,
  soundcloud: SiSoundcloud,
  adobe_cc: GrAdobeCreativeCloud,
  notion: SiNotion,
  slack: FaSlack,
  discord: SiDiscord,
  telegram: SiTelegram,
  azure_blob: TbBrandAzure,
  gcs: SiGooglecloud,
  bunny_stream: SiBunnydotnet,
  wasabi: SiWasabi,
  synology: SiSynology,
  nextcloud: SiNextcloud,
  zapier: SiZapier,
  make: SiMake,
  n8n: SiN8N,
};

const providerLogos: Readonly<Record<string, string>> = {
  riverside: riversideLogo,
  frameio: frameioLogo,
  streamyard: streamyardLogo,
  medal: medalLogo,
  sproutvideo: sproutvideoLogo,
  brightcove: brightcoveLogo,
  mux: muxLogo,
  vidyard: vidyardLogo,
  descript: descriptLogo,
  zencastr: zencastrLogo,
  squadcast: squadcastLogo,
  restream: restreamLogo,
  podbean: podbeanLogo,
  buzzsprout: buzzsproutLogo,
  transistor: transistorLogo,
  captivate: captivateLogo,
  canva: canvaLogo,
};

export function ConnectorIcon({
  icon,
  connectorId,
  className,
}: {
  icon: ConnectorIconName;
  connectorId?: string;
  className?: string;
}) {
  const ProviderLogo = connectorId ? providerLogos[connectorId] : undefined;
  if (ProviderLogo) {
    return (
      <img
        src={ProviderLogo}
        alt=""
        aria-hidden="true"
        data-connector-icon={connectorId}
        className={cn("h-5 w-5 object-contain", className)}
      />
    );
  }
  const ProviderIcon = connectorId ? providerIcons[connectorId] : undefined;
  const Icon: IconType = ProviderIcon ?? icons[icon];
  return (
    <Icon
      aria-hidden="true"
      data-connector-icon={ProviderIcon ? connectorId : `fallback:${icon}`}
      className={cn("h-5 w-5", className)}
    />
  );
}
