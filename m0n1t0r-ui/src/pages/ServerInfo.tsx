import { useEffect, useState } from "react";
import {
  Button,
  Card,
  Descriptions,
  Popconfirm,
  Space,
  Table,
  Tag,
  message,
} from "antd";
import { ReloadOutlined, DeleteOutlined } from "@ant-design/icons";
import { getServerInfo, listProxies, deleteProxy } from "../api/server";
import type { ProxyInfo, ServerInfo as ServerInfoType } from "../api/types";

export default function ServerInfo() {
  const [info, setInfo] = useState<ServerInfoType | null>(null);
  const [proxies, setProxies] = useState<ProxyInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [s, p] = await Promise.all([getServerInfo(), listProxies()]);
      setInfo(s);
      setProxies(p);
    } catch (err) {
      message.error("Failed to fetch server info: " + String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDeleteProxy = async (key: number) => {
    try {
      await deleteProxy(key);
      message.success("Proxy closed");
      fetchData();
    } catch (err) {
      message.error("Failed to close proxy: " + String(err));
    }
  };

  const getProxyDescription = (proxy: ProxyInfo) => {
    const t = proxy.type;
    if ("Socks5" in t) return `SOCKS5 ${t.Socks5.from} -> ${t.Socks5.addr}`;
    if ("Forward" in t)
      return `Forward ${t.Forward.from} -> ${t.Forward.to} (via ${t.Forward.addr})`;
    return "Unknown";
  };

  const getProxyType = (proxy: ProxyInfo) => {
    if ("Socks5" in proxy.type) return "SOCKS5";
    if ("Forward" in proxy.type) return "Forward";
    return "Unknown";
  };

  return (
    <>
      <Card title="Server Information" loading={loading}>
        {info && (
          <Descriptions column={{ xs: 1, sm: 2 }}>
            <Descriptions.Item label="Version">
              {info.version}
            </Descriptions.Item>
            <Descriptions.Item label="Build Time">
              {info.build_time}
            </Descriptions.Item>
            <Descriptions.Item label="Commit Hash">
              <Tag>{info.commit_hash?.slice(0, 8)}</Tag>
            </Descriptions.Item>
          </Descriptions>
        )}
      </Card>

      <Card
        title="Active Proxies"
        style={{ marginTop: 16 }}
        extra={
          <Button icon={<ReloadOutlined />} onClick={fetchData}>
            Refresh
          </Button>
        }
      >
        <Table
          loading={loading}
          dataSource={proxies}
          rowKey="key"
          columns={[
            { title: "Key", dataIndex: "key" },
            {
              title: "Type",
              key: "type",
              render: (_, r) => <Tag>{getProxyType(r)}</Tag>,
            },
            {
              title: "Description",
              key: "desc",
              render: (_, r) => getProxyDescription(r),
            },
            {
              title: "Actions",
              key: "actions",
              render: (_, record) => (
                <Space>
                  <Popconfirm
                    title="Close this proxy?"
                    onConfirm={() => handleDeleteProxy(record.key)}
                  >
                    <Button size="small" danger icon={<DeleteOutlined />}>
                      Close
                    </Button>
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
        />
      </Card>
    </>
  );
}
