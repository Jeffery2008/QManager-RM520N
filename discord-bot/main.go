package main

import (
	"fmt"
	"log"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"github.com/bwmarrin/discordgo"
)

// dmChannelHolder is a thread-safe store for the owner DM channel ID.
// Multiple goroutines (notifier, test watcher, MessageCreate handler) read
// and write it, so accesses are protected by a mutex.
type dmChannelHolder struct {
	mu sync.Mutex
	id string
}

func (h *dmChannelHolder) get() string {
	h.mu.Lock()
	defer h.mu.Unlock()
	return h.id
}

func (h *dmChannelHolder) set(id string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.id = id
}

func main() {
	cfg, err := loadConfig(configPath)
	if err != nil {
		log.Fatalf("failed to load config: %v", err)
	}
	if !cfg.Enabled {
		log.Println("Discord bot is disabled in config. Exiting.")
		os.Exit(0)
	}
	if cfg.BotToken == "" || cfg.OwnerDiscordID == "" {
		log.Fatal("bot_token and owner_discord_id must be set in config")
	}

	appID := appIDFromToken(cfg.BotToken)

	writeStatus(statusPath, BotStatus{Connected: false, Error: "starting", AppID: appID})

	s, err := newSession(cfg.BotToken)
	if err != nil {
		writeStatus(statusPath, BotStatus{Connected: false, Error: "session_error", AppID: appID})
		log.Fatalf("failed to create Discord session: %v", err)
	}

	s.AddHandler(func(s *discordgo.Session, r *discordgo.Ready) {
		log.Printf("Discord bot ready: %s#%s", r.User.Username, r.User.Discriminator)
		writeStatus(statusPath, BotStatus{Connected: true, LatencyMs: int(s.HeartbeatLatency().Milliseconds()), AppID: appID})
	})

	if err := s.Open(); err != nil {
		writeStatus(statusPath, BotStatus{Connected: false, Error: "invalid_token", AppID: appID})
		log.Fatalf("failed to open Discord session: %v", err)
	}
	defer s.Close()

	if _, err := registerCommands(s, appID); err != nil {
		log.Printf("warning: failed to register slash commands: %v", err)
	}

	dmCh := &dmChannelHolder{}

	// Try the on-disk cache first. UserChannelCreate is unreliable for user-installed
	// bots without a shared guild (Discord error 50007). ChannelMessageSend against a
	// known channel ID is not subject to that gate, so a previously-captured ID is
	// sufficient — no need to call UserChannelCreate again.
	cachedID, _ := loadDMChannelID(dmChannelPath)
	if cachedID != "" {
		log.Printf("loaded cached DM channel: %s", cachedID)
		dmCh.set(cachedID)
	} else {
		// Cold path — no cache, try to resolve fresh.
		id, err := openDMChannel(s, cfg.OwnerDiscordID)
		if err != nil {
			log.Printf("warning: failed to open DM channel with owner: %v", err)
			// Continue with empty — MessageCreate handler or test watcher will
			// capture the channel ID once the owner sends any DM to the bot.
		} else {
			dmCh.set(id)
			if err := saveDMChannelID(dmChannelPath, id); err != nil {
				log.Printf("warning: failed to persist DM channel: %v", err)
			}
		}
	}

	// Capture DM channel ID from slash-command interactions. Discord does not deliver
	// MESSAGE_CREATE Gateway events to user-installed apps (applications.commands scope
	// only), but InteractionCreate IS delivered and carries the invoking ChannelID.
	s.AddHandler(func(s *discordgo.Session, i *discordgo.InteractionCreate) {
		captureDMFromInteraction(i, dmCh, cfg.OwnerDiscordID)
		handleInteraction(s, i)
	})

	// Capture owner DM channel ID from inbound messages — self-healing path after
	// token rotation. No MESSAGE_CONTENT intent needed; we only read channel ID.
	s.AddHandler(func(s *discordgo.Session, m *discordgo.MessageCreate) {
		if m.GuildID != "" {
			return // guild message, not a DM
		}
		if m.Author == nil || m.Author.ID != cfg.OwnerDiscordID {
			return
		}
		if m.ChannelID != dmCh.get() {
			dmCh.set(m.ChannelID)
			if err := saveDMChannelID(dmChannelPath, m.ChannelID); err != nil {
				log.Printf("warning: failed to persist DM channel: %v", err)
			}
			log.Printf("captured DM channel from inbound message: %s", m.ChannelID)
		}
	})

	stopNotifier := make(chan struct{})
	go RunNotifier(s, dmCh, cfg, stopNotifier)

	// Test DM trigger watcher — CGI test.sh creates /tmp/qmanager_discord_test.
	// Always spawn this, even if the initial openDMChannel failed: the user may
	// authorize the bot via OAuth *after* startup, in which case dmChannelID
	// will resolve cleanly on the first trigger after they're authorized.
	stopTestWatcher := make(chan struct{})
	go runTestDMWatcher(s, cfg.OwnerDiscordID, dmCh, stopTestWatcher)

	// Periodic status update
	go func() {
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()
		for range ticker.C {
			writeStatus(statusPath, BotStatus{
				Connected: s.DataReady,
				LatencyMs: int(s.HeartbeatLatency().Milliseconds()),
				AppID:     appID,
			})
		}
	}()

	log.Println("Discord bot running. Press Ctrl+C to stop.")
	sc := make(chan os.Signal, 1)
	signal.Notify(sc, syscall.SIGINT, syscall.SIGTERM)
	<-sc

	close(stopNotifier)
	close(stopTestWatcher)
	writeStatus(statusPath, BotStatus{Connected: false, Error: "", AppID: appID})
	log.Println("Discord bot stopped.")
}

const (
	testDMTriggerPath = "/tmp/qmanager_discord_test"
	testDMResultPath  = "/tmp/qmanager_discord_test_result"
)

// writeTestResult writes a {success, error} JSON to testDMResultPath. The CGI
// polls this file with a timeout and returns its contents to the frontend, so
// the toast reflects actual delivery — not just "trigger file written".
// 0644 is intentional: www-data needs read access; bot writes as its own user.
func writeTestResult(success bool, errMsg string) {
	payload := fmt.Sprintf(`{"success":%t,"error":%q}`, success, errMsg)
	if err := os.WriteFile(testDMResultPath, []byte(payload), 0644); err != nil {
		log.Printf("test DM: failed to write result file: %v", err)
	}
}

// runTestDMWatcher polls for the trigger file written by test.sh. On each
// trigger it uses the cached DM channel if available, falling back to
// openDMChannel, and writes a result file the CGI can wait on.
func runTestDMWatcher(s *discordgo.Session, ownerID string, dmCh *dmChannelHolder, stopCh <-chan struct{}) {
	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-stopCh:
			return
		case <-ticker.C:
			if _, err := os.Stat(testDMTriggerPath); err != nil {
				continue
			}
			os.Remove(testDMTriggerPath)

			ch := dmCh.get()
			if ch == "" {
				var err error
				ch, err = openDMChannel(s, ownerID)
				if err != nil {
					log.Printf("test DM: openDMChannel failed: %v", err)
					writeTestResult(false, "Bot can't reach you — finish authorizing the bot in your Discord account, then try again.")
					continue
				}
				dmCh.set(ch)
				if err := saveDMChannelID(dmChannelPath, ch); err != nil {
					log.Printf("warning: failed to persist DM channel: %v", err)
				}
			}

			if _, err := s.ChannelMessageSend(ch, "✅ Test DM from QManager — your Discord bot is working."); err != nil {
				log.Printf("test DM send failed: %v", err)
				writeTestResult(false, "Discord rejected the message — make sure you've added the bot via the OAuth link.")
				continue
			}
			writeTestResult(true, "")
		}
	}
}
