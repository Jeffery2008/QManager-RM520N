package main

import (
	"strings"
	"testing"
	"time"

	"github.com/bwmarrin/discordgo"
)

func TestEmbedColor(t *testing.T) {
	now := time.Now().Unix()
	cases := []struct {
		name string
		s    *ModemStatus
		want int
	}{
		{"healthy", &ModemStatus{ConnInternetAvailable: "true", ModemReachable: "true", CacheTime: now}, colorGreen},
		{"degraded internet down", &ModemStatus{ConnInternetAvailable: "false", ModemReachable: "true", CacheTime: now}, colorAmber},
		{"degraded recovery", &ModemStatus{ConnInternetAvailable: "true", ModemReachable: "true", DuringRecovery: "true", CacheTime: now}, colorAmber},
		{"down modem unreachable", &ModemStatus{ConnInternetAvailable: "false", ModemReachable: "false", CacheTime: now}, colorRed},
		{"stale", &ModemStatus{ConnInternetAvailable: "true", ModemReachable: "true", CacheTime: now - 60}, colorGray},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got := embedColor(c.s)
			if got != c.want {
				t.Errorf("embedColor=%#x, want %#x", got, c.want)
			}
		})
	}
}

func TestRelativeTime(t *testing.T) {
	now := time.Now().Unix()
	cases := []struct {
		secs int64
		want string
	}{
		{now - 1, "1s ago"},
		{now - 30, "30s ago"},
		{now - 90, "1m ago"},
		{now - 3700, "1h ago"},
		{now - 90000, "1d ago"},
	}
	for _, c := range cases {
		got := relativeTime(c.secs)
		if got != c.want {
			t.Errorf("relativeTime(%d): got %q, want %q", c.secs, got, c.want)
		}
	}
}

func TestFooterBlock_StaleMarker(t *testing.T) {
	s := &ModemStatus{CacheTime: time.Now().Unix() - 60}
	footer := footerBlock(s)
	if !strings.Contains(footer.Text, "stale") {
		t.Errorf("expected stale marker in footer for 60s-old cache, got %q", footer.Text)
	}
}

func TestFooterBlock_FreshNoStale(t *testing.T) {
	s := &ModemStatus{CacheTime: time.Now().Unix() - 5}
	footer := footerBlock(s)
	if strings.Contains(footer.Text, "stale") {
		t.Errorf("did not expect stale marker for 5s-old cache, got %q", footer.Text)
	}
}

func TestFormatBytes(t *testing.T) {
	cases := []struct {
		in   int64
		want string
	}{
		{0, "0 B/s"},
		{500, "500 B/s"},
		{2048, "2.0 KB/s"},
		{1500000, "1.4 MB/s"},
		{2_000_000_000, "1.9 GB/s"},
	}
	for _, c := range cases {
		got := formatBytes(c.in)
		if got != c.want {
			t.Errorf("formatBytes(%d)=%q, want %q", c.in, got, c.want)
		}
	}
}

func TestSignalQualityBars(t *testing.T) {
	cases := []struct {
		bucket string
		want   string
	}{
		{"excellent", "▰▰▰▰▰"},
		{"good", "▰▰▰▰▱"},
		{"fair", "▰▰▰▱▱"},
		{"poor", "▰▰▱▱▱"},
		{"none", "▱▱▱▱▱"},
	}
	for _, c := range cases {
		got := signalQualityBars(c.bucket)
		if got != c.want {
			t.Errorf("signalQualityBars(%q)=%q, want %q", c.bucket, got, c.want)
		}
	}
}

func TestSignalQualityBucket(t *testing.T) {
	cases := []struct {
		ports map[string]AntennaSignal
		want  string
	}{
		{map[string]AntennaSignal{"main": {RSRP: "-75"}}, "excellent"},
		{map[string]AntennaSignal{"main": {RSRP: "-85"}}, "good"},
		{map[string]AntennaSignal{"main": {RSRP: "-100"}}, "fair"},
		{map[string]AntennaSignal{"main": {RSRP: "-115"}}, "poor"},
		{map[string]AntennaSignal{"main": {RSRP: "-130"}}, "none"},
		{map[string]AntennaSignal{}, "none"},
	}
	for _, c := range cases {
		got := signalQualityBucket(c.ports)
		if got != c.want {
			t.Errorf("signalQualityBucket(%v)=%q, want %q", c.ports, got, c.want)
		}
	}
}

func TestCcEmoji(t *testing.T) {
	cases := []struct {
		ccType, tech, want string
	}{
		{"PCC", "LTE", "🔵"},
		{"SCC", "LTE", "🟣"},
		{"PCC", "NR", "🟢"},
		{"SCC", "NR", "🟠"},
		{"OTHER", "LTE", "⚪"},
	}
	for _, c := range cases {
		got := ccEmoji(c.ccType, c.tech)
		if got != c.want {
			t.Errorf("ccEmoji(%s,%s)=%q, want %q", c.ccType, c.tech, got, c.want)
		}
	}
}

func TestBuildActionRow_Bands(t *testing.T) {
	row := buildActionRow("bands")
	ar, ok := row.(discordgo.ActionsRow)
	if !ok {
		t.Fatalf("not ActionsRow: %T", row)
	}
	if len(ar.Components) != 4 {
		t.Fatalf("want 4 buttons for bands, got %d", len(ar.Components))
	}
	ids := buttonIDs(ar)
	wantIDs := []string{"qm:refresh:bands", "qm:nav:signal", "qm:nav:status", "qm:raw:bands"}
	for i, want := range wantIDs {
		if ids[i] != want {
			t.Errorf("button[%d] id=%q, want %q", i, ids[i], want)
		}
	}
}

func TestBuildActionRow_Signal(t *testing.T) {
	row := buildActionRow("signal")
	ar := row.(discordgo.ActionsRow)
	ids := buttonIDs(ar)
	wantIDs := []string{"qm:refresh:signal", "qm:nav:bands", "qm:nav:status", "qm:raw:signal"}
	for i, want := range wantIDs {
		if ids[i] != want {
			t.Errorf("button[%d] id=%q, want %q", i, ids[i], want)
		}
	}
}

func TestBuildActionRow_Status(t *testing.T) {
	row := buildActionRow("status")
	ar := row.(discordgo.ActionsRow)
	ids := buttonIDs(ar)
	wantIDs := []string{"qm:refresh:status", "qm:nav:signal", "qm:nav:bands", "qm:raw:status"}
	for i, want := range wantIDs {
		if ids[i] != want {
			t.Errorf("button[%d] id=%q, want %q", i, ids[i], want)
		}
	}
}

func TestBuildActionRow_Events(t *testing.T) {
	row := buildActionRow("events")
	ar := row.(discordgo.ActionsRow)
	if len(ar.Components) != 1 {
		t.Errorf("events should have 1 button (refresh only), got %d", len(ar.Components))
	}
	if buttonIDs(ar)[0] != "qm:refresh:events" {
		t.Errorf("events button id=%q", buttonIDs(ar)[0])
	}
}

func TestBuildActionRow_DeviceSimWatchcat(t *testing.T) {
	for _, src := range []string{"device", "sim", "watchcat"} {
		row := buildActionRow(src)
		ar := row.(discordgo.ActionsRow)
		if len(ar.Components) != 2 {
			t.Errorf("%s should have 2 buttons (refresh + raw), got %d", src, len(ar.Components))
		}
		ids := buttonIDs(ar)
		if ids[0] != "qm:refresh:"+src || ids[1] != "qm:raw:"+src {
			t.Errorf("%s buttons=%v", src, ids)
		}
	}
}

func TestDisabledActionRow(t *testing.T) {
	row := disabledActionRow("bands")
	ar := row.(discordgo.ActionsRow)
	for i, c := range ar.Components {
		btn, _ := c.(discordgo.Button)
		if !btn.Disabled {
			t.Errorf("button[%d] not disabled", i)
		}
	}
}

func TestParseCustomID(t *testing.T) {
	cases := []struct {
		in     string
		action string
		source string
		ok     bool
	}{
		{"qm:refresh:bands", "refresh", "bands", true},
		{"qm:nav:signal", "nav", "signal", true},
		{"qm:raw:status", "raw", "status", true},
		{"qm:bogus", "", "", false},
		{"", "", "", false},
		{"reboot_confirm", "", "", false},
	}
	for _, c := range cases {
		action, source, ok := parseCustomID(c.in)
		if action != c.action || source != c.source || ok != c.ok {
			t.Errorf("parseCustomID(%q): got (%q,%q,%v), want (%q,%q,%v)",
				c.in, action, source, ok, c.action, c.source, c.ok)
		}
	}
}

// buttonIDs is a test helper that pulls custom IDs out of an ActionsRow in order.
func buttonIDs(ar discordgo.ActionsRow) []string {
	out := make([]string, 0, len(ar.Components))
	for _, c := range ar.Components {
		if btn, ok := c.(discordgo.Button); ok {
			out = append(out, btn.CustomID)
		}
	}
	return out
}

func TestExpiredEmbedField(t *testing.T) {
	f := expiredEmbedField()
	if f.Name == "" || f.Value == "" {
		t.Errorf("expired field has empty name/value: %+v", f)
	}
	if !strings.Contains(f.Value, "expired") {
		t.Errorf("expired field value should mention expiry: %q", f.Value)
	}
	if f.Inline {
		t.Error("expired field must be non-inline (full width)")
	}
}

func TestSpacerField_IsInvisibleInline(t *testing.T) {
	f := spacerField()
	if f == nil {
		t.Fatal("spacerField returned nil")
	}
	if !f.Inline {
		t.Error("spacer must be Inline=true so it occupies a column slot")
	}
	if f.Name != "​" {
		t.Errorf("spacer Name = %q, want zero-width space", f.Name)
	}
	if f.Value != "​" {
		t.Errorf("spacer Value = %q, want zero-width space", f.Value)
	}
}
