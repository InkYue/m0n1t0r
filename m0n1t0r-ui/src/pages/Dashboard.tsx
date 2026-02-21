import { useEffect, useState } from "react";
import { Card, Col, Descriptions, Row, Statistic, Table, Tag, message } from "antd";
import { DesktopOutlined, CloudServerOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { listClients } from "../api/clients";
import { getServerInfo } from "../api/server";
import { useServerNotification } from "../hooks/useNotification";
import type { ClientInfo, ServerInfo } from "../api/types";
import { formatDateTime } from "../utils/format";

export default function Dashboard() {
  const [clients, setClients] = useState<ClientInfo[]>([]);
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchData = async () => {
    try {
      const [c, s] = await Promise.all([listClients(), getServerInfo()]);
      setClients(c);
      setServerInfo(s);
    } catch (err) {
      message.error("Failed to fetch data: " + String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useServerNotification(() => {
    fetchData();
  });

  const platformCounts = clients.reduce<Record<string, number>>((acc, c) => {
    const p = c.target_platform || "unknown";
    acc[p] = (acc[p] || 0) + 1;
    return acc;
  }, {});

  return (
    <>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={8}>
          <Card loading={loading}>
            <Statistic
              title="Connected Clients"
              value={clients.length}
              prefix={<DesktopOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card loading={loading}>
            <Statistic
              title="Platforms"
              value={Object.keys(platformCounts).length}
              prefix={<CloudServerOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card loading={loading}>
            <Statistic
              title="Server Version"
              value={serverInfo?.version || "-"}
            />
          </Card>
        </Col>
      </Row>

      {serverInfo && (
        <Card title="Server Information" style={{ marginTop: 16 }}>
          <Descriptions column={{ xs: 1, sm: 2 }}>
            <Descriptions.Item label="Version">
              {serverInfo.version}
            </Descriptions.Item>
            <Descriptions.Item label="Build Time">
              {serverInfo.build_time}
            </Descriptions.Item>
            <Descriptions.Item label="Commit">
              <Tag>{serverInfo.commit_hash?.slice(0, 8)}</Tag>
            </Descriptions.Item>
          </Descriptions>
        </Card>
      )}

      {Object.keys(platformCounts).length > 0 && (
        <Card title="Platform Breakdown" style={{ marginTop: 16 }}>
          <Row gutter={16}>
            {Object.entries(platformCounts).map(([platform, count]) => (
              <Col key={platform} span={6}>
                <Statistic title={platform} value={count} />
              </Col>
            ))}
          </Row>
        </Card>
      )}

      <Card title="Recent Clients" style={{ marginTop: 16 }}>
        <Table
          loading={loading}
          dataSource={clients.slice(0, 10)}
          rowKey="addr"
          size="small"
          pagination={false}
          onRow={(record) => ({
            onClick: () => navigate(`/clients/${encodeURIComponent(record.addr)}`),
            style: { cursor: "pointer" },
          })}
          columns={[
            { title: "Address", dataIndex: "addr" },
            {
              title: "Hostname",
              render: (_, r) => r.system_info?.host_name || "-",
            },
            { title: "Platform", dataIndex: "target_platform" },
            {
              title: "Connected",
              dataIndex: "connected_time",
              render: (v) => formatDateTime(v),
            },
          ]}
        />
      </Card>
    </>
  );
}
