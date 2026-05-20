package main

import (
	"encoding/json"
	"os"
	"testing"
)

func TestLoadConfig_ValidFile(t *testing.T) {
	f, _ := os.CreateTemp("", "discord_cfg*.json")
	defer os.Remove(f.Name())
	json.NewEncoder(f).Encode(Config{
		Enabled:          true,
		BotToken:         "tok",
		OwnerDiscordID:   "123",
		ThresholdMinutes: 10,
	})
	f.Close()

	cfg, err := loadConfig(f.Name())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cfg.BotToken != "tok" {
		t.Errorf("got BotToken %q, want %q", cfg.BotToken, "tok")
	}
	if cfg.ThresholdMinutes != 10 {
		t.Errorf("got ThresholdMinutes %d, want 10", cfg.ThresholdMinutes)
	}
}

func TestLoadConfig_DefaultThreshold(t *testing.T) {
	f, _ := os.CreateTemp("", "discord_cfg*.json")
	defer os.Remove(f.Name())
	f.WriteString(`{"enabled":true,"bot_token":"x","owner_discord_id":"1"}`)
	f.Close()

	cfg, err := loadConfig(f.Name())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cfg.ThresholdMinutes != 5 {
		t.Errorf("got ThresholdMinutes %d, want 5 (default)", cfg.ThresholdMinutes)
	}
}

func TestLoadConfig_MissingFile(t *testing.T) {
	_, err := loadConfig("/nonexistent/path.json")
	if err == nil {
		t.Fatal("expected error for missing file, got nil")
	}
}

func TestWriteStatus(t *testing.T) {
	f, _ := os.CreateTemp("", "discord_status*.json")
	path := f.Name()
	f.Close()
	defer os.Remove(path)
	defer os.Remove(path + ".tmp")

	writeStatus(path, BotStatus{Connected: true, LatencyMs: 42, Error: ""})

	data, _ := os.ReadFile(path)
	var got BotStatus
	if err := json.Unmarshal(data, &got); err != nil {
		t.Fatalf("bad JSON: %v", err)
	}
	if !got.Connected {
		t.Error("expected Connected=true")
	}
	if got.LatencyMs != 42 {
		t.Errorf("got LatencyMs %d, want 42", got.LatencyMs)
	}
	if got.LastSeen == 0 {
		t.Error("expected LastSeen to be set by writeStatus")
	}
}

func TestCommandDefinitions_AllPresent(t *testing.T) {
	names := map[string]bool{}
	for _, cmd := range slashCommands() {
		names[cmd.Name] = true
	}
	required := []string{"signal", "bands", "status", "events", "device", "sim", "watchcat", "reboot", "lock-band", "network-mode"}
	for _, r := range required {
		if !names[r] {
			t.Errorf("missing slash command: %s", r)
		}
	}
}
