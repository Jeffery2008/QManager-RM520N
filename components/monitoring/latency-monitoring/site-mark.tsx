"use client";

import type { IconType } from "react-icons";
import {
  SiCloudflare,
  SiDiscord,
  SiEpicgames,
  SiFacebook,
  SiGithub,
  SiGoogle,
  SiInstagram,
  SiLine,
  SiMessenger,
  SiNetflix,
  SiPinterest,
  SiPlaystation,
  SiReddit,
  SiRiotgames,
  SiRoblox,
  SiShopee,
  SiSignal,
  SiSnapchat,
  SiSpeedtest,
  SiSpotify,
  SiSteam,
  SiTelegram,
  SiThreads,
  SiTiktok,
  SiTwitch,
  SiValorant,
  SiViber,
  SiWhatsapp,
  SiWikipedia,
  SiX,
  SiYoutube,
  SiZoom,
} from "react-icons/si";

import { cn } from "@/lib/utils";

import { DIALOG, SITES } from "./shapes";

// Brand marks are content, like the RAT marks on the dashboard; the label carries identity.
// A null colour is a near-black brand, drawn in on-surface ink so it holds in both themes.
type Mark = readonly [IconType, string | null];

const SITE_MARKS: Record<string, Mark> = {
  "google.com": [SiGoogle, "#4285F4"],
  "facebook.com": [SiFacebook, "#0866FF"],
  "tiktok.com": [SiTiktok, null],
  "youtube.com": [SiYoutube, "#FF0000"],
  "roblox.com": [SiRoblox, null],
  "spotify.com": [SiSpotify, "#1ED760"],
  "x.com": [SiX, null],
  "twitter.com": [SiX, null],
  "reddit.com": [SiReddit, "#FF4500"],
  "github.com": [SiGithub, null],
  "discord.com": [SiDiscord, "#5865F2"],
  "instagram.com": [SiInstagram, "#FF0069"],
  "messenger.com": [SiMessenger, "#00B2FF"],
  "netflix.com": [SiNetflix, "#E50914"],
  "whatsapp.com": [SiWhatsapp, "#25D366"],
  "twitch.tv": [SiTwitch, "#9146FF"],
  "steampowered.com": [SiSteam, null],
  "cloudflare.com": [SiCloudflare, "#F38020"],
  "telegram.org": [SiTelegram, "#26A5E4"],
  "t.me": [SiTelegram, "#26A5E4"],
  "zoom.us": [SiZoom, "#0B5CFF"],
  "wikipedia.org": [SiWikipedia, null],
  "threads.net": [SiThreads, null],
  // Snapchat's yellow fails on a light tile, so it takes ink.
  "snapchat.com": [SiSnapchat, null],
  "pinterest.com": [SiPinterest, "#BD081C"],
  "signal.org": [SiSignal, "#3B45FD"],
  "viber.com": [SiViber, "#7360F2"],
  "line.me": [SiLine, "#00C300"],
  "playvalorant.com": [SiValorant, "#FA4454"],
  "riotgames.com": [SiRiotgames, "#EB0029"],
  "epicgames.com": [SiEpicgames, null],
  "playstation.com": [SiPlaystation, "#0070D1"],
  "speedtest.net": [SiSpeedtest, null],
  // A key with no dot matches the first label: Shopee runs one storefront per country domain.
  shopee: [SiShopee, "#EE4D2D"],
};

/** Matches the exact host or any subdomain of a mapped registrable domain. */
export function markFor(host: string): Mark | null {
  const h = host.toLowerCase().replace(/^www\./, "");
  const first = h.split(".")[0];
  for (const [domain, mark] of Object.entries(SITE_MARKS)) {
    if (domain.includes(".") ? h === domain || h.endsWith(`.${domain}`) : first === domain) return mark;
  }
  return null;
}

export interface SiteMarkProps {
  host: string;
  label: string;
  /** `cell`: the 56px grid tile. `row`: the 32px dialog list plate. */
  size: "cell" | "row";
}

export function SiteMark({ host, label, size }: SiteMarkProps) {
  const mark = markFor(host);
  const cell = size === "cell";
  const plate = cell ? SITES.TILE : DIALOG.LOGO;

  if (!mark) {
    return (
      <span aria-hidden className={plate}>
        <span className={cell ? SITES.MONOGRAM : DIALOG.LOGO_MONOGRAM}>
          {(label || host).charAt(0).toUpperCase()}
        </span>
      </span>
    );
  }

  const [Icon, color] = mark;
  return (
    <span aria-hidden className={plate}>
      <Icon
        className={cn(cell ? SITES.MARK : DIALOG.LOGO_MARK, !color && "text-on-surface")}
        style={color ? { color } : undefined}
      />
    </span>
  );
}
