package main

import (
	"os"
	"strings"
)

const dmChannelPath = "/etc/qmanager/discord_dm_channel"

// loadDMChannelID reads the cached DM channel ID from path.
// Returns ("", nil) if the file does not exist.
func loadDMChannelID(path string) (string, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return "", nil
		}
		return "", err
	}
	return strings.TrimSpace(string(data)), nil
}

// saveDMChannelID atomically writes channelID to path via tmp+rename.
// No-op if channelID is empty after trimming — never persists empty.
func saveDMChannelID(path string, channelID string) error {
	channelID = strings.TrimSpace(channelID)
	if channelID == "" {
		return nil
	}
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, []byte(channelID), 0644); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}
