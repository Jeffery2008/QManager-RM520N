package main

import (
	"fmt"
	"log"
	"time"

	"github.com/bwmarrin/discordgo"
)

type notifyAction int

const (
	notifyNone notifyAction = iota
	notifyDown
	notifyUp
)

type notifyState struct {
	wasDown       bool
	downSent      bool
	downtimeStart int64
}

// update checks the current internet state against the threshold and returns
// what notification action (if any) should be taken.
// thresholdMinutes: configured threshold; pollIntervalSecs: poll interval for timing.
func (ns *notifyState) update(internet string, thresholdMinutes, _ int) notifyAction {
	now := time.Now().Unix()
	threshSecs := int64(thresholdMinutes * 60)

	isDown := internet == "false"

	if isDown {
		if !ns.wasDown {
			ns.wasDown = true
			ns.downtimeStart = now
			ns.downSent = false
		}
		if !ns.downSent && now-ns.downtimeStart >= threshSecs {
			ns.downSent = true
			return notifyDown
		}
		return notifyNone
	}

	// Internet is up
	if ns.wasDown {
		sendUp := ns.downSent
		ns.wasDown = false
		ns.downSent = false
		if sendUp {
			return notifyUp
		}
	}
	return notifyNone
}

func (ns *notifyState) downtimeDuration() string {
	secs := time.Now().Unix() - ns.downtimeStart
	if secs < 60 {
		return fmt.Sprintf("%ds", secs)
	}
	return fmt.Sprintf("%dm %ds", secs/60, secs%60)
}

// RunNotifier polls the poller cache and sends DM notifications on connectivity changes.
// Blocks until stopCh is closed. dmCh may be empty at startup (50007 cold path) —
// notifier tries openDMChannel as a fallback before each send and silently skips
// if the channel is still unavailable.
func RunNotifier(s *discordgo.Session, dmCh *dmChannelHolder, cfg *Config, stopCh <-chan struct{}) {
	ns := &notifyState{}
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-stopCh:
			return
		case <-ticker.C:
			status, err := readStatus(statusCachePath)
			if err != nil {
				continue
			}

			// Check reload flag — signal main loop to reload config
			if checkReloadFlag() {
				newCfg, err := loadConfig(configPath)
				if err == nil {
					cfg = newCfg
				}
			}

			action := ns.update(status.ConnInternetAvailable, cfg.ThresholdMinutes, 10)
			if action == notifyNone {
				continue
			}

			ch := dmCh.get()
			if ch == "" {
				// Fallback: attempt to resolve the channel — may succeed if the
				// owner has since authorized the bot after startup.
				id, err := openDMChannel(s, cfg.OwnerDiscordID)
				if err != nil {
					log.Printf("notify: no DM channel available, skipping")
					continue
				}
				dmCh.set(id)
				if err := saveDMChannelID(dmChannelPath, id); err != nil {
					log.Printf("warning: failed to persist DM channel: %v", err)
				}
				ch = id
			}

			switch action {
			case notifyDown:
				ts := time.Unix(ns.downtimeStart, 0).Format("15:04")
				msg := fmt.Sprintf("🔴 **Connection lost** — internet down (threshold exceeded).\nStarted at %s", ts)
				if _, err := s.ChannelMessageSend(ch, msg); err != nil {
					log.Printf("notify: failed to send down DM: %v", err)
				}
			case notifyUp:
				dur := ns.downtimeDuration()
				msg := fmt.Sprintf("🟢 **Connection restored** after %s.", dur)
				if _, err := s.ChannelMessageSend(ch, msg); err != nil {
					log.Printf("notify: failed to send up DM: %v", err)
				}
			}
		}
	}
}
