package main

import "testing"

func TestNotifyState_DownThenUp(t *testing.T) {
	ns := &notifyState{}

	// First call: internet down, threshold not yet exceeded
	action := ns.update("false", 1, 10)
	if action != notifyNone {
		t.Errorf("got %v, want notifyNone (threshold not exceeded)", action)
	}

	// Simulate threshold exceeded
	ns.downtimeStart -= 600 // 10 minutes in the past
	action = ns.update("false", 1, 1)
	if action != notifyDown {
		t.Errorf("got %v, want notifyDown", action)
	}

	// Internet comes back
	action = ns.update("true", 1, 1)
	if action != notifyUp {
		t.Errorf("got %v, want notifyUp", action)
	}

	// Next call: stays up, no notification
	action = ns.update("true", 1, 1)
	if action != notifyNone {
		t.Errorf("got %v, want notifyNone", action)
	}
}

func TestNotifyState_AlreadySentDown(t *testing.T) {
	ns := &notifyState{wasDown: true, downSent: true, downtimeStart: 1000}
	// Still down: don't resend
	action := ns.update("false", 1, 1)
	if action != notifyNone {
		t.Errorf("got %v, want notifyNone (already sent)", action)
	}
}

func TestNotifyState_SubThresholdRecovery(t *testing.T) {
	ns := &notifyState{}
	// Down, threshold not exceeded
	if action := ns.update("false", 5, 1); action != notifyNone {
		t.Errorf("got %v, want notifyNone (sub-threshold)", action)
	}
	// Recovers before threshold — must NOT send notifyUp
	if action := ns.update("true", 5, 1); action != notifyNone {
		t.Errorf("got %v, want notifyNone (no down DM was sent)", action)
	}
	// State is reset
	if ns.wasDown || ns.downSent {
		t.Errorf("expected state reset, got wasDown=%v downSent=%v", ns.wasDown, ns.downSent)
	}
}
