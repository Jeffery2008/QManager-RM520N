package main

import (
	"fmt"
	"log"
	"strconv"
	"strings"
	"time"

	"github.com/bwmarrin/discordgo"
)

// Color palette (semantic).
const (
	colorGreen = 0x22c55e
	colorRed   = 0xef4444
	colorBlue  = 0x3b82f6
	colorGray  = 0x6b7280
	colorAmber = 0xf59e0b
)

// staleSeconds at the embed layer: cache older than this triggers gray sidebar
// + stale footer warning. Mirrors staleSecs in cache.go.
const embedStaleSecs = 30

// emoji vocabulary — single source of truth so every embed reuses identical glyphs.
var emoji = struct {
	Author     string
	PCI        string
	EARFCN     string
	Bandwidth  string
	Signal     string
	Temp       string
	Cell       string
	TAC        string
	Connection string
	Network    string
	Uptime     string
	Watchcat   string
	Device     string
	Cells24h   string
	SCC        string
	NavBands   string
	Expired    string
	Ok         string
	Warn       string
	Down       string
	Unknown    string
	Stale      string
}{
	Author:     "📡",
	PCI:        "🆔",
	EARFCN:     "📡",
	Bandwidth:  "📐",
	Signal:     "📈",
	Temp:       "🌡",
	Cell:       "🆔",
	TAC:        "📞",
	Connection: "🌐",
	Network:    "📶",
	Uptime:     "⏱",
	Watchcat:   "🛡",
	Device:     "🌡",
	Cells24h:   "🛰",
	SCC:        "🛰️",
	NavBands:   "📊",
	Expired:    "⌛",
	Ok:         "🟢",
	Warn:       "🟡",
	Down:       "🔴",
	Unknown:    "⚫",
	Stale:      "⚠",
}

// embedColor picks the sidebar color from cache state.
func embedColor(s *ModemStatus) int {
	if s.CacheTime > 0 && time.Now().Unix()-s.CacheTime > embedStaleSecs {
		return colorGray
	}
	if s.ModemReachable != "true" {
		return colorRed
	}
	if s.ConnInternetAvailable == "false" {
		return colorAmber
	}
	if s.DuringRecovery == "true" {
		return colorAmber
	}
	return colorGreen
}

// relativeTime renders a unix timestamp as "Xs ago" / "Xm ago" / "Xh ago" / "Xd ago".
// Returns "unknown" for ts<=0. Never negative. Does NOT add a stale marker —
// callers that care about staleness wrap the result themselves (see footerBlock).
func relativeTime(ts int64) string {
	if ts <= 0 {
		return "unknown"
	}
	delta := time.Now().Unix() - ts
	if delta < 0 {
		delta = 0
	}
	return relativeCore(delta)
}

func relativeCore(secs int64) string {
	switch {
	case secs < 60:
		return fmt.Sprintf("%ds ago", secs)
	case secs < 3600:
		return fmt.Sprintf("%dm ago", secs/60)
	case secs < 86400:
		return fmt.Sprintf("%dh ago", secs/3600)
	default:
		return fmt.Sprintf("%dd ago", secs/86400)
	}
}

// formatBytes renders bytes-per-second as "1.4 MB/s" etc.
func formatBytes(b int64) string {
	const k = 1024
	switch {
	case b < k:
		return fmt.Sprintf("%d B/s", b)
	case b < k*k:
		return fmt.Sprintf("%.1f KB/s", float64(b)/k)
	case b < k*k*k:
		return fmt.Sprintf("%.1f MB/s", float64(b)/(k*k))
	default:
		return fmt.Sprintf("%.1f GB/s", float64(b)/(k*k*k))
	}
}

// signalQualityBucket maps the best-antenna RSRP into one of:
// excellent / good / fair / poor / none.
func signalQualityBucket(ports map[string]AntennaSignal) string {
	bestRSRP := 0.0
	any := false
	for _, ant := range ports {
		if ant.RSRP == "" {
			continue
		}
		v, err := strconv.ParseFloat(ant.RSRP, 64)
		if err != nil {
			continue
		}
		if !any || v > bestRSRP {
			bestRSRP = v
			any = true
		}
	}
	if !any {
		return "none"
	}
	switch {
	case bestRSRP >= -80:
		return "excellent"
	case bestRSRP >= -90:
		return "good"
	case bestRSRP >= -105:
		return "fair"
	case bestRSRP >= -120:
		return "poor"
	default:
		return "none"
	}
}

func signalQualityBars(bucket string) string {
	switch bucket {
	case "excellent":
		return "▰▰▰▰▰"
	case "good":
		return "▰▰▰▰▱"
	case "fair":
		return "▰▰▰▱▱"
	case "poor":
		return "▰▰▱▱▱"
	default:
		return "▱▱▱▱▱"
	}
}

// ccEmoji picks a color emoji that encodes both PCC/SCC tier and LTE/NR tech.
func ccEmoji(ccType, tech string) string {
	switch {
	case ccType == "PCC" && tech == "LTE":
		return "🔵"
	case ccType == "SCC" && tech == "LTE":
		return "🟣"
	case ccType == "PCC" && tech == "NR":
		return "🟢"
	case ccType == "SCC" && tech == "NR":
		return "🟠"
	default:
		return "⚪"
	}
}

// navOrder defines which cross-jump buttons appear (in order) for each source.
// The current source is omitted from its own action row.
var navOrder = []string{"signal", "bands", "status"}

// buildActionRow returns the ActionsRow for a query embed.
//   - signal/bands/status: 4 buttons → Refresh, 2 cross-jumps (omitting self), Copy raw
//   - events: 1 button → Refresh only
//   - device/sim/watchcat: 2 buttons → Refresh, Copy raw
func buildActionRow(source string) discordgo.MessageComponent {
	btns := []discordgo.MessageComponent{
		discordgo.Button{Label: "Refresh", Style: discordgo.SecondaryButton, Emoji: &discordgo.ComponentEmoji{Name: "🔄"}, CustomID: "qm:refresh:" + source},
	}
	switch source {
	case "signal", "bands", "status":
		for _, target := range navOrder {
			if target == source {
				continue
			}
			btns = append(btns, discordgo.Button{
				Label:    capitalize(target),
				Style:    discordgo.SecondaryButton,
				Emoji:    &discordgo.ComponentEmoji{Name: navEmojiFor(target)},
				CustomID: "qm:nav:" + target,
			})
		}
		btns = append(btns, discordgo.Button{Label: "Copy raw", Style: discordgo.SecondaryButton, Emoji: &discordgo.ComponentEmoji{Name: "🧾"}, CustomID: "qm:raw:" + source})
	case "events":
		// Refresh only — no nav, no raw (events log is its own raw view).
	default:
		// device, sim, watchcat → Refresh + Copy raw
		btns = append(btns, discordgo.Button{Label: "Copy raw", Style: discordgo.SecondaryButton, Emoji: &discordgo.ComponentEmoji{Name: "🧾"}, CustomID: "qm:raw:" + source})
	}
	return discordgo.ActionsRow{Components: btns}
}

func disabledActionRow(source string) discordgo.MessageComponent {
	row := buildActionRow(source).(discordgo.ActionsRow)
	disabled := make([]discordgo.MessageComponent, 0, len(row.Components))
	for _, c := range row.Components {
		btn := c.(discordgo.Button)
		btn.Disabled = true
		disabled = append(disabled, btn)
	}
	return discordgo.ActionsRow{Components: disabled}
}

func navEmojiFor(target string) string {
	switch target {
	case "signal":
		return "📡"
	case "bands":
		return "📊"
	case "status":
		return "📋"
	}
	return "•"
}

// spacerField returns an invisible inline field used to widen column gutters in
// embeds. Discord packs up to 3 inline fields per row; pairing 2 content fields
// with a trailing spacer renders them at ~33% width each but visually grouped
// as a 2-column layout with breathing room on the right. The U+200B (zero-width
// space) glyph is required — Discord rejects empty strings for Name/Value.
func spacerField() *discordgo.MessageEmbedField {
	return &discordgo.MessageEmbedField{
		Name:   "​",
		Value:  "​",
		Inline: true,
	}
}

func capitalize(s string) string {
	if s == "" {
		return ""
	}
	return strings.ToUpper(s[:1]) + s[1:]
}

// parseCustomID parses "qm:<action>:<source>" custom IDs from button clicks.
// Returns (action, source, ok=true) on match, ("", "", false) otherwise.
func parseCustomID(id string) (string, string, bool) {
	parts := strings.Split(id, ":")
	if len(parts) != 3 || parts[0] != "qm" {
		return "", "", false
	}
	return parts[1], parts[2], true
}

// authorBlock returns the per-embed author line (e.g. "📡 QManager • RM520N-GL").
func authorBlock(s *ModemStatus) *discordgo.MessageEmbedAuthor {
	name := emoji.Author + " QManager"
	if s.Model != "" {
		name = name + " • " + s.Model
	}
	return &discordgo.MessageEmbedAuthor{Name: name}
}

// footerBlock returns the per-embed footer with relative-cache-time text.
// When the cache is older than embedStaleSecs the time is wrapped in "stale (…)".
func footerBlock(s *ModemStatus) *discordgo.MessageEmbedFooter {
	rel := relativeTime(s.CacheTime)
	if s.CacheTime > 0 && time.Now().Unix()-s.CacheTime > embedStaleSecs {
		rel = "stale (" + rel + ")"
	}
	return &discordgo.MessageEmbedFooter{
		Text: "QManager • Updated " + rel,
	}
}

// buttonExpiryWindow is how long after the initial response the buttons stay
// active. Discord interaction tokens expire at 15 min; we disable a minute earlier.
const buttonExpiryWindow = 14 * time.Minute

func expiredEmbedField() *discordgo.MessageEmbedField {
	return &discordgo.MessageEmbedField{
		Name:   emoji.Expired + " Buttons expired",
		Value:  "These buttons have expired. Run the command again to get fresh interactive buttons.",
		Inline: false,
	}
}

// scheduleButtonExpiry queues a one-shot edit that disables the action row
// and appends an "expired" field to the original embed. Fires after
// buttonExpiryWindow. If the bot restarts, the timer dies; buttons stay
// enabled but clicks fail silently — Discord's hard 15-minute interaction
// token expiry is the underlying constraint.
func scheduleButtonExpiry(s *discordgo.Session, i *discordgo.Interaction, source string, originalEmbed *discordgo.MessageEmbed) {
	time.AfterFunc(buttonExpiryWindow, func() {
		// Append expired field to a copy (don't mutate caller's embed).
		updated := *originalEmbed
		updated.Fields = append(append([]*discordgo.MessageEmbedField{}, originalEmbed.Fields...), expiredEmbedField())
		row := disabledActionRow(source)
		_, err := s.InteractionResponseEdit(i, &discordgo.WebhookEdit{
			Embeds:     &[]*discordgo.MessageEmbed{&updated},
			Components: &[]discordgo.MessageComponent{row},
		})
		if err != nil {
			// Token already expired — expected after 15 min. Log at debug level.
			log.Printf("scheduleButtonExpiry: edit failed for source=%s: %v", source, err)
		}
	})
}
