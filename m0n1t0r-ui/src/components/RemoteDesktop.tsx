import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Select, Slider, Space, message } from "antd";
import { DisconnectOutlined, DesktopOutlined } from "@ant-design/icons";
import apiClient from "../api/client";
import type { ApiResponse, DisplayInfo } from "../api/types";

interface Props {
  addr: string;
}

export default function RemoteDesktop({ addr }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [displays, setDisplays] = useState<DisplayInfo[]>([]);
  const [displayIndex, setDisplayIndex] = useState<number>(0);
  const [quality, setQuality] = useState(0.5);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    apiClient
      .get<ApiResponse<DisplayInfo[]>>(
        `/client/${encodeURIComponent(addr)}/rd`
      )
      .then((res) => {
        setDisplays(res.data.body);
      })
      .catch((err) =>
        message.error("Failed to list displays: " + String(err))
      );
  }, [addr]);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    if (displays.length === 0) return;

    const selectedDisplay = displays[displayIndex];
    if (!selectedDisplay) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const url = `${protocol}//${host}/api/v1/client/${encodeURIComponent(addr)}/rd/stream/rgb?display=${displayIndex}&quality=${quality}&format=raw`;

    const ws = new WebSocket(url);
    ws.binaryType = "arraybuffer";

    const width = selectedDisplay.width;
    const height = selectedDisplay.height;

    ws.onopen = () => {
      setConnected(true);
      message.success("Remote desktop connected");

      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = width;
        canvas.height = height;
      }
    };

    ws.onmessage = (e) => {
      const canvas = canvasRef.current;
      if (!canvas || !(e.data instanceof ArrayBuffer)) return;

      const data = new Uint8Array(e.data);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const imgData = ctx.createImageData(width, height);
      const pixels = imgData.data;

      // RGB -> RGBA
      for (
        let i = 0, j = 0;
        i < pixels.length && j < data.length;
        i += 4, j += 3
      ) {
        pixels[i] = data[j];
        pixels[i + 1] = data[j + 1];
        pixels[i + 2] = data[j + 2];
        pixels[i + 3] = 255;
      }

      ctx.putImageData(imgData, 0, 0);
    };

    ws.onclose = () => {
      setConnected(false);
    };

    ws.onerror = () => {
      message.error("Connection error");
    };

    wsRef.current = ws;
  }, [addr, displayIndex, quality, displays]);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    setConnected(false);
  }, []);

  useEffect(() => {
    return () => {
      wsRef.current?.close();
    };
  }, []);

  return (
    <>
      <Space style={{ marginBottom: 16 }} wrap>
        <Select
          value={displayIndex}
          onChange={setDisplayIndex}
          style={{ width: 280 }}
          disabled={connected}
          options={displays.map((d, i) => ({
            value: i,
            label: `${d.name} (${d.width}x${d.height})${d.is_primary ? " *" : ""}`,
          }))}
          placeholder="Select display"
        />
        <span>Quality:</span>
        <Slider
          value={quality}
          onChange={setQuality}
          min={0.1}
          max={1}
          step={0.1}
          style={{ width: 150 }}
          disabled={connected}
        />
        {connected ? (
          <Button danger icon={<DisconnectOutlined />} onClick={disconnect}>
            Disconnect
          </Button>
        ) : (
          <Button
            type="primary"
            icon={<DesktopOutlined />}
            onClick={connect}
            disabled={displays.length === 0}
          >
            Connect
          </Button>
        )}
      </Space>
      <div
        style={{
          background: "#000",
          borderRadius: 8,
          overflow: "auto",
          maxHeight: 600,
        }}
      >
        <canvas
          ref={canvasRef}
          style={{ display: "block", maxWidth: "100%" }}
        />
      </div>
    </>
  );
}
