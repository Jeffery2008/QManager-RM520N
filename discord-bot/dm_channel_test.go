package main

import (
	"os"
	"path/filepath"
	"testing"
)

func TestDMChannel_SaveThenLoad(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "dm_channel")

	if err := saveDMChannelID(path, "123456789"); err != nil {
		t.Fatalf("save: %v", err)
	}
	got, err := loadDMChannelID(path)
	if err != nil {
		t.Fatalf("load: %v", err)
	}
	if got != "123456789" {
		t.Errorf("got %q, want %q", got, "123456789")
	}
}

func TestDMChannel_LoadMissingFile(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "nonexistent")

	got, err := loadDMChannelID(path)
	if err != nil {
		t.Fatalf("expected nil error for missing file, got: %v", err)
	}
	if got != "" {
		t.Errorf("expected empty string, got %q", got)
	}
}

func TestDMChannel_SaveEmptyIsNoop(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "dm_channel")

	if err := saveDMChannelID(path, ""); err != nil {
		t.Fatalf("save empty: %v", err)
	}
	if _, err := os.Stat(path); !os.IsNotExist(err) {
		t.Error("expected file to not exist after saving empty ID")
	}
}

func TestDMChannel_SaveTrimsWhitespace(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "dm_channel")

	// "  abc  " should be trimmed and saved as "abc"
	if err := saveDMChannelID(path, "  abc  "); err != nil {
		t.Fatalf("save: %v", err)
	}
	got, err := loadDMChannelID(path)
	if err != nil {
		t.Fatalf("load: %v", err)
	}
	if got != "abc" {
		t.Errorf("got %q, want %q", got, "abc")
	}
}

func TestDMChannel_SaveOverwrites(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "dm_channel")

	if err := saveDMChannelID(path, "first"); err != nil {
		t.Fatalf("first save: %v", err)
	}
	if err := saveDMChannelID(path, "second"); err != nil {
		t.Fatalf("second save: %v", err)
	}
	got, err := loadDMChannelID(path)
	if err != nil {
		t.Fatalf("load: %v", err)
	}
	if got != "second" {
		t.Errorf("got %q, want %q", got, "second")
	}
}
