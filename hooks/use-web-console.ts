"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { Terminal } from "@xterm/xterm";
import type { FitAddon } from "@xterm/addon-fit";

// =============================================================================
// useWebConsole — WebSocket + ttyd Protocol Hook
// =============================================================================
// Manages the WebSocket connection to the ttyd console backend at /console/ws.
// Handles the ttyd binary protocol for I/O, implements exponential backoff
// reconnection, and bridges xterm.js terminal events to the WebSocket.
//
// ttyd receive message types:
//   0 = OUTPUT         — terminal data to write
//   1 = SET_WINDOW_TITLE — ignored
//   2 = SET_PREFERENCES  — ignored
//
// ttyd send message types:
//   0 = INPUT  — keyboard/paste data from terminal
//   1 = RESIZE — terminal resize event
// =============================================================================

// ─── Protocol constants ────────────────────────────────────────────────────

const RECV_OUTPUT = 0;
// const RECV_SET_WINDOW_TITLE = 1;  // unused — kept for documentation
// const RECV_SET_PREFERENCES = 2;   // unused — kept for documentation

const SEND_INPUT = 0;
const SEND_RESIZE = 1;

// ─── Reconnect config ──────────────────────────────────────────────────────

const BACKOFF_INITIAL_MS = 1_000;
const BACKOFF_MAX_MS = 10_000;
const BACKOFF_MULTIPLIER = 2;

/** Number of rapid consecutive failures before giving up auto-retry */
const RAPID_FAIL_THRESHOLD = 3;
/** A close within this many ms of opening is considered "rapid" */
const RAPID_CLOSE_MS = 2_000;

// ─── Types ─────────────────────────────────────────────────────────────────

export type ConnectionState =
  | "connecting"
  | "connected"
  | "disconnected"
  | "reconnecting"
  | "unavailable";

interface UseWebConsoleOptions {
  terminalRef: React.RefObject<Terminal | null>;
  fitAddonRef: React.RefObject<FitAddon | null>;
}

interface UseWebConsoleReturn {
  connectionState: ConnectionState;
  reconnect: () => void;
  disconnect: () => void;
}

// ─── URL helper ────────────────────────────────────────────────────────────

function getWsUrl(): string {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/console/ws`;
}

// ─── Hook ──────────────────────────────────────────────────────────────────

export function useWebConsole({
  terminalRef,
  fitAddonRef,
}: UseWebConsoleOptions): UseWebConsoleReturn {
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("connecting");

  // Stable refs — never cause re-renders, safe in closures
  const wsRef = useRef<WebSocket | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const encoderRef = useRef(new TextEncoder());
  const mountedRef = useRef(true);

  // Reconnect bookkeeping
  const backoffMsRef = useRef(BACKOFF_INITIAL_MS);
  const rapidFailCountRef = useRef(0);
  const openedAtRef = useRef<number | null>(null);

  // Xterm disposable refs — cleaned up on reconnect / unmount
  const onDataDisposableRef = useRef<{ dispose(): void } | null>(null);
  const onResizeDisposableRef = useRef<{ dispose(): void } | null>(null);

  // ── Helpers ──────────────────────────────────────────────────────────────

  const clearRetryTimer = useCallback(() => {
    if (retryTimerRef.current !== null) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  const disposeTerminalListeners = useCallback(() => {
    onDataDisposableRef.current?.dispose();
    onDataDisposableRef.current = null;
    onResizeDisposableRef.current?.dispose();
    onResizeDisposableRef.current = null;
  }, []);

  const closeSocket = useCallback((ws: WebSocket) => {
    // Remove all listeners before closing to prevent triggering reconnect
    ws.onopen = null;
    ws.onmessage = null;
    ws.onclose = null;
    ws.onerror = null;
    if (
      ws.readyState === WebSocket.OPEN ||
      ws.readyState === WebSocket.CONNECTING
    ) {
      ws.close();
    }
  }, []);

  // ── Send helpers ─────────────────────────────────────────────────────────

  const sendInput = useCallback((data: string) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    const encoded = encoderRef.current.encode(data);
    const msg = new Uint8Array(1 + encoded.byteLength);
    msg[0] = SEND_INPUT;
    msg.set(encoded, 1);
    ws.send(msg.buffer);
  }, []);

  const sendResize = useCallback((cols: number, rows: number) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    const payload = encoderRef.current.encode(
      JSON.stringify({ columns: cols, rows })
    );
    const msg = new Uint8Array(1 + payload.byteLength);
    msg[0] = SEND_RESIZE;
    msg.set(payload, 1);
    ws.send(msg.buffer);
  }, []);

  // ── Connect ──────────────────────────────────────────────────────────────

  // Forward-declare so scheduleReconnect can reference connect
  const connectRef = useRef<() => void>(() => {});

  const scheduleReconnect = useCallback(() => {
    if (!mountedRef.current) return;

    clearRetryTimer();
    setConnectionState("reconnecting");

    retryTimerRef.current = setTimeout(() => {
      if (mountedRef.current) {
        connectRef.current();
      }
    }, backoffMsRef.current);

    // Advance backoff, capped at max
    backoffMsRef.current = Math.min(
      backoffMsRef.current * BACKOFF_MULTIPLIER,
      BACKOFF_MAX_MS
    );
  }, [clearRetryTimer]);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    // Tear down any existing socket
    if (wsRef.current) {
      closeSocket(wsRef.current);
      wsRef.current = null;
    }
    disposeTerminalListeners();

    setConnectionState("connecting");
    openedAtRef.current = null;

    const ws = new WebSocket(getWsUrl());
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) return;

      openedAtRef.current = Date.now();
      rapidFailCountRef.current = 0;
      backoffMsRef.current = BACKOFF_INITIAL_MS;
      setConnectionState("connected");

      // Wire up terminal → WebSocket
      const terminal = terminalRef.current;
      if (terminal) {
        disposeTerminalListeners();

        onDataDisposableRef.current = terminal.onData(sendInput);
        onResizeDisposableRef.current = terminal.onResize(({ cols, rows }) => {
          sendResize(cols, rows);
        });

        // Send initial resize
        const fit = fitAddonRef.current;
        if (fit) {
          try {
            fit.fit();
          } catch {
            // fit may throw if terminal is not yet visible — non-fatal
          }
        }
        sendResize(terminal.cols, terminal.rows);
      }
    };

    ws.onmessage = (event: MessageEvent) => {
      if (!mountedRef.current) return;

      const data = event.data as ArrayBuffer;
      if (!(data instanceof ArrayBuffer) || data.byteLength < 1) return;

      const view = new DataView(data);
      const msgType = view.getUint8(0);

      if (msgType === RECV_OUTPUT) {
        const terminal = terminalRef.current;
        if (terminal) {
          terminal.write(new Uint8Array(data, 1));
        }
      }
      // SET_WINDOW_TITLE (1) and SET_PREFERENCES (2) are intentionally ignored
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;

      disposeTerminalListeners();
      wsRef.current = null;

      // Check if this was a rapid failure
      const openedAt = openedAtRef.current;
      const wasRapid =
        openedAt === null || Date.now() - openedAt < RAPID_CLOSE_MS;

      if (wasRapid) {
        rapidFailCountRef.current += 1;
      } else {
        rapidFailCountRef.current = 0;
      }

      if (rapidFailCountRef.current >= RAPID_FAIL_THRESHOLD) {
        setConnectionState("unavailable");
        return;
      }

      scheduleReconnect();
    };

    ws.onerror = () => {
      // onerror is always followed by onclose — let onclose handle reconnect
      // Just ensure we don't stay "connecting" indefinitely if open never fired
    };
  }, [
    closeSocket,
    disposeTerminalListeners,
    sendInput,
    sendResize,
    scheduleReconnect,
    terminalRef,
    fitAddonRef,
  ]);

  // Keep the ref in sync so scheduleReconnect can always call the latest connect
  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  // ── Public API ───────────────────────────────────────────────────────────

  const reconnect = useCallback(() => {
    clearRetryTimer();
    rapidFailCountRef.current = 0;
    backoffMsRef.current = BACKOFF_INITIAL_MS;
    connect();
  }, [clearRetryTimer, connect]);

  const disconnect = useCallback(() => {
    clearRetryTimer();
    disposeTerminalListeners();
    if (wsRef.current) {
      closeSocket(wsRef.current);
      wsRef.current = null;
    }
    if (mountedRef.current) {
      setConnectionState("disconnected");
    }
  }, [clearRetryTimer, disposeTerminalListeners, closeSocket]);

  // ── Lifecycle ────────────────────────────────────────────────────────────

  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      clearRetryTimer();
      disposeTerminalListeners();
      if (wsRef.current) {
        closeSocket(wsRef.current);
        wsRef.current = null;
      }
    };
    // connect is stable (useCallback with stable deps) — intentionally omitted
    // from deps to avoid re-running on every render after refs settle
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { connectionState, reconnect, disconnect };
}
