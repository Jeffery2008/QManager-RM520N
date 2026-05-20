// Types for the Discord bot feature.
// Backend: /cgi-bin/quecmanager/monitoring/discord_bot/configure.sh

export interface DiscordBotSettings {
  enabled: boolean;
  token_set: boolean;
  owner_discord_id: string;
  threshold_minutes: number;
}

export interface DiscordBotStatus {
  connected: boolean;
  last_seen: number;
  latency_ms: number;
  error?: string;
  installed: boolean;
  // True iff the bot has captured the owner's DM channel cache
  // (/etc/qmanager/discord_dm_channel). Source of truth for "authorized";
  // cross-device, persists across browsers, cleared by reset.
  authorized?: boolean;
  app_id?: string;
}

export interface DiscordBotSavePayload {
  action: "save_settings";
  enabled: boolean;
  owner_discord_id: string;
  threshold_minutes: number;
  bot_token?: string;
}
