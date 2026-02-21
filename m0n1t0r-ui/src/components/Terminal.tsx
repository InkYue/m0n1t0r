import { useCallback, useEffect, useRef, useState } from "react";
import { Select, Space, Button } from "antd";
import { DisconnectOutlined, LinkOutlined } from "@ant-design/icons";
import { Terminal as XTerminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";

interface Props {
  addr: string;
  platform: string;
}

const SHELLS: Record<string, string[]> = {
  windows: ["powershell", "cmd"],
  linux: ["bash", "sh"],
  macos: ["zsh", "bash", "sh"],
};

function getDefaultShells(platform: string): string[] {
  const p = platform.toLowerCase();
  if (p.includes("windows")) return SHELLS.windows;
  if (p.includes("macos") || p.includes("darwin")) return SHELLS.macos;
  return SHELLS.linux;
}

export default function Terminal({ addr, platform }: Props) {
  const termRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const lineBufRef = useRef("");
  const [shell, setShell] = useState(() => getDefaultShells(platform)[0]);
  const [connected, setConnected] = useState(false);

  const shells = getDefaultShells(platform);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const term = xtermRef.current;
    if (!term) return;

    term.clear();
    lineBufRef.current = "";
    term.writeln(`Connecting to ${addr} with ${shell}...`);

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const url = `${protocol}//${host}/api/v1/client/${encodeURIComponent(addr)}/process/interactive?command=${encodeURIComponent(shell)}`;

    const ws = new WebSocket(url);

    ws.onopen = () => {
      setConnected(true);
      term.writeln("Connected.\r\n");
      setTimeout(() => term.focus(), 50);
    };

    // Backend uses piped stdout (no PTY), so output only has \n.
    // Translate \n -> \r\n for xterm to render line breaks correctly.
    ws.onmessage = (e) => {
      const text: string = e.data;
      term.write(text.replace(/\n/g, "\r\n"));
    };

    ws.onclose = () => {
      setConnected(false);
      term.writeln("\r\n\x1b[31mDisconnected.\x1b[0m");
    };

    ws.onerror = () => {
      term.writeln("\r\n\x1b[31mConnection error.\x1b[0m");
    };

    wsRef.current = ws;

    // Backend uses piped stdin (no PTY), so the shell:
    //   - Won't echo input
    //   - Won't interpret backspace/delete as editing
    //   - Reads line-by-line (buffered until \n)
    // Solution: buffer the line locally, handle editing locally,
    // and only send the complete line on Enter.
    term.onData((data) => {
      if (ws.readyState !== WebSocket.OPEN) return;

      if (data === "\r") {
        // Enter: send the buffered line + newline, then clear buffer
        term.write("\r\n");
        ws.send(lineBufRef.current + "\n");
        lineBufRef.current = "";
      } else if (data === "\x7f" || data === "\b") {
        // Backspace: remove last char from buffer and erase on screen
        if (lineBufRef.current.length > 0) {
          lineBufRef.current = lineBufRef.current.slice(0, -1);
          term.write("\b \b");
        }
      } else if (data === "\x03") {
        // Ctrl+C: send directly to interrupt, clear buffer
        term.write("^C\r\n");
        ws.send("\x03");
        lineBufRef.current = "";
      } else if (data === "\x04") {
        // Ctrl+D: send directly (EOF)
        ws.send("\x04");
      } else if (data === "\x15") {
        // Ctrl+U: clear current line
        const len = lineBufRef.current.length;
        term.write("\b \b".repeat(len));
        lineBufRef.current = "";
      } else if (data === "\x17") {
        // Ctrl+W: delete last word
        const buf = lineBufRef.current;
        const trimmed = buf.trimEnd();
        const lastSpace = trimmed.lastIndexOf(" ");
        const newBuf = lastSpace === -1 ? "" : buf.slice(0, lastSpace + 1);
        const erased = buf.length - newBuf.length;
        term.write("\b \b".repeat(erased));
        lineBufRef.current = newBuf;
      } else if (data >= " ") {
        // Printable characters: append to buffer and echo
        lineBufRef.current += data;
        term.write(data);
      }
      // Ignore other control characters (arrows, etc.)
    });
  }, [addr, shell]);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    setConnected(false);
  }, []);

  useEffect(() => {
    const term = new XTerminal({
      cursorBlink: true,
      fontSize: 14,
      theme: {
        background: "#1a1a2e",
        foreground: "#e0e0e0",
      },
    });
    const fit = new FitAddon();
    term.loadAddon(fit);

    if (termRef.current) {
      term.open(termRef.current);
      try {
        fit.fit();
      } catch {
        // fit may fail if element has zero dimensions
      }
    }

    xtermRef.current = term;
    fitRef.current = fit;

    const resizeObserver = new ResizeObserver(() => {
      try {
        fit.fit();
      } catch {
        // ignore
      }
    });
    if (termRef.current) resizeObserver.observe(termRef.current);

    return () => {
      resizeObserver.disconnect();
      wsRef.current?.close();
      term.dispose();
    };
  }, []);

  return (
    <>
      <Space style={{ marginBottom: 8 }}>
        <Select
          value={shell}
          onChange={setShell}
          style={{ width: 150 }}
          disabled={connected}
          options={shells.map((s) => ({ value: s, label: s }))}
        />
        {connected ? (
          <Button
            danger
            icon={<DisconnectOutlined />}
            onClick={disconnect}
          >
            Disconnect
          </Button>
        ) : (
          <Button
            type="primary"
            icon={<LinkOutlined />}
            onClick={connect}
          >
            Connect
          </Button>
        )}
      </Space>
      <div
        ref={termRef}
        onClick={() => xtermRef.current?.focus()}
        style={{
          height: 500,
          background: "#1a1a2e",
          borderRadius: 8,
          padding: 4,
        }}
      />
    </>
  );
}
