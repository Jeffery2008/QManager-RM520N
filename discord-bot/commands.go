package main

import "github.com/bwmarrin/discordgo"

func slashCommands() []*discordgo.ApplicationCommand {
	optional := false
	return []*discordgo.ApplicationCommand{
		{Name: "signal", Description: "RF signal metrics per antenna port (RSRP, RSRQ, SINR, RSSI)"},
		{Name: "bands", Description: "Active technology, band lock state, and carrier aggregation details"},
		{Name: "status", Description: "Connectivity, WAN IP, operator, uptime, and CPU temperature"},
		{Name: "events", Description: "Last 5 network events"},
		{Name: "device", Description: "Modem hardware info — model, firmware, IMEI, supported bands"},
		{Name: "sim", Description: "SIM details — slot, ICCID, IMSI, phone, APN (private response)"},
		{Name: "watchcat", Description: "Watchcat recovery system status — current tier, failures, last recovery"},
		{Name: "reboot", Description: "Reboot the modem (requires confirmation)"},
		{
			Name:        "lock-band",
			Description: "Lock LTE and/or NR bands, or unlock all",
			Options: []*discordgo.ApplicationCommandOption{
				{
					Type:        discordgo.ApplicationCommandOptionString,
					Name:        "lte_bands",
					Description: "LTE bands to lock, comma-separated (e.g. B3,B7,B28), or 'auto' to unlock",
					Required:    optional,
				},
				{
					Type:        discordgo.ApplicationCommandOptionString,
					Name:        "nr_bands",
					Description: "NR bands to lock, comma-separated (e.g. n41,n78), or 'auto' to unlock",
					Required:    optional,
				},
			},
		},
		{
			Name:        "network-mode",
			Description: "Set network mode preference",
			Options: []*discordgo.ApplicationCommandOption{
				{
					Type:        discordgo.ApplicationCommandOptionString,
					Name:        "mode",
					Description: "Preferred network mode",
					Required:    true,
					Choices: []*discordgo.ApplicationCommandOptionChoice{
						{Name: "Auto (LTE + NR)", Value: "AUTO"},
						{Name: "LTE only", Value: "LTE"},
						{Name: "NR only", Value: "NR5G"},
						{Name: "NR preferred", Value: "NR5G:LTE"},
					},
				},
			},
		},
	}
}

func registerCommands(s *discordgo.Session, appID string) ([]*discordgo.ApplicationCommand, error) {
	var registered []*discordgo.ApplicationCommand
	for _, cmd := range slashCommands() {
		c, err := s.ApplicationCommandCreate(appID, "", cmd)
		if err != nil {
			return registered, err
		}
		registered = append(registered, c)
	}
	return registered, nil
}
