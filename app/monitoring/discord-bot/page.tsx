import { DiscordBotCard } from "@/components/monitoring/discord-bot-card";

export default function DiscordBotPage() {
  return (
    <div className="@container/main mx-auto p-2">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Discord Bot</h1>
        <p className="text-muted-foreground">
          Use a personal Discord bot to check modem status and get private
          downtime alerts. Installs to your Discord account in one click —
          no server required.
        </p>
      </div>
      <div className="max-w-3xl">
        <DiscordBotCard />
      </div>
    </div>
  );
}
