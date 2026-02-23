import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Button,
  Card,
  Descriptions,
  Spin,
  Tabs,
  Tag,
  message,
} from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { getClient } from "../api/clients";
import type { ClientInfo } from "../api/types";
import { formatDateTime, formatUptime } from "../utils/format";
import FileManager from "../components/FileManager";
import ProcessManager from "../components/ProcessManager";
import Terminal from "../components/Terminal";
import EnvironmentVars from "../components/EnvironmentVars";
import ProxyManager from "../components/ProxyManager";
import RemoteDesktop from "../components/RemoteDesktop";
import NetworkDownload from "../components/NetworkDownload";
import ClientUpdate from "../components/ClientUpdate";
import Voidgate from "../components/Voidgate";

export default function ClientDetail() {
  const { addr } = useParams<{ addr: string }>();
  const navigate = useNavigate();
  const [client, setClient] = useState<ClientInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const decodedAddr = decodeURIComponent(addr || "");

  useEffect(() => {
    if (!decodedAddr) return;
    setLoading(true);
    getClient(decodedAddr)
      .then(setClient)
      .catch((err) => message.error("Failed to fetch client: " + String(err)))
      .finally(() => setLoading(false));
  }, [decodedAddr]);

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 48 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!client) {
    return (
      <Card>
        <p>Client not found</p>
        <Button onClick={() => navigate("/clients")}>Back to Clients</Button>
      </Card>
    );
  }

  const tabItems = [
    {
      key: "overview",
      label: "Overview",
      children: (
        <Descriptions bordered column={{ xs: 1, sm: 2 }}>
          <Descriptions.Item label="Address">{client.addr}</Descriptions.Item>
          <Descriptions.Item label="Version">
            {client.version}
          </Descriptions.Item>
          <Descriptions.Item label="Platform">
            <Tag>{client.target_platform}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Build Time">
            {client.build_time}
          </Descriptions.Item>
          <Descriptions.Item label="Commit">
            <Tag>{client.commit_hash?.slice(0, 8)}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Executable">
            {client.current_exe}
          </Descriptions.Item>
          <Descriptions.Item label="Connected">
            {formatDateTime(client.connected_time)}
          </Descriptions.Item>
          <Descriptions.Item label="Hostname">
            {client.system_info?.host_name || "-"}
          </Descriptions.Item>
          <Descriptions.Item label="OS">
            {client.system_info?.long_os_version || "-"}
          </Descriptions.Item>
          <Descriptions.Item label="Kernel">
            {client.system_info?.kernel_version || "-"}
          </Descriptions.Item>
          <Descriptions.Item label="CPU Arch">
            {client.system_info?.cpu_arch || "-"}
          </Descriptions.Item>
          <Descriptions.Item label="Uptime">
            {client.system_info
              ? formatUptime(client.system_info.uptime)
              : "-"}
          </Descriptions.Item>
          <Descriptions.Item label="Distribution">
            {client.system_info?.distribution_id || "-"}
          </Descriptions.Item>
          <Descriptions.Item label="CPUs" span={2}>
            {client.system_info?.cpu?.count
              ? Object.entries(client.system_info.cpu.count).map(
                  ([name, freq]) => (
                    <Tag key={name}>
                      {name}: {freq} MHz
                    </Tag>
                  )
                )
              : "-"}
          </Descriptions.Item>
        </Descriptions>
      ),
    },
    {
      key: "files",
      label: "File Manager",
      children: <FileManager addr={decodedAddr} />,
    },
    {
      key: "processes",
      label: "Processes",
      children: <ProcessManager addr={decodedAddr} />,
    },
    {
      key: "terminal",
      label: "Terminal",
      children: <Terminal addr={decodedAddr} platform={client.target_platform} />,
    },
    {
      key: "env",
      label: "Environment",
      children: <EnvironmentVars addr={decodedAddr} />,
    },
    {
      key: "proxy",
      label: "Proxy",
      children: <ProxyManager addr={decodedAddr} />,
    },
    {
      key: "rd",
      label: "Remote Desktop",
      children: <RemoteDesktop addr={decodedAddr} />,
    },
    {
      key: "network",
      label: "Network",
      children: <NetworkDownload addr={decodedAddr} />,
    },
    {
      key: "update",
      label: "Update",
      children: <ClientUpdate addr={decodedAddr} />,
    },
    {
      key: "voidgate",
      label: "Voidgate",
      children: <Voidgate addr={decodedAddr} />,
    },
  ];

  return (
    <>
      <Button
        type="link"
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate("/clients")}
        style={{ marginBottom: 16, padding: 0 }}
      >
        Back to Clients
      </Button>
      <Card
        title={`Client: ${client.addr}`}
        extra={
          <Tag color="green">
            {client.system_info?.host_name || client.addr}
          </Tag>
        }
      >
        <Tabs items={tabItems} destroyInactiveTabPane />
      </Card>
    </>
  );
}
