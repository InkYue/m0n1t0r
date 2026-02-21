import { useEffect, useState } from "react";
import { Button, Input, Popconfirm, Space, Table, Tag, message } from "antd";
import { DeleteOutlined, EyeOutlined, ReloadOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { deleteClient, listClients } from "../api/clients";
import { useServerNotification } from "../hooks/useNotification";
import type { ClientInfo } from "../api/types";
import { formatDateTime } from "../utils/format";

export default function ClientList() {
  const [clients, setClients] = useState<ClientInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  const fetchClients = async () => {
    setLoading(true);
    try {
      setClients(await listClients());
    } catch (err) {
      message.error("Failed to list clients: " + String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  useServerNotification(() => {
    fetchClients();
  });

  const handleDelete = async (addr: string) => {
    try {
      await deleteClient(addr);
      message.success("Client disconnected");
      fetchClients();
    } catch (err) {
      message.error("Failed to disconnect: " + String(err));
    }
  };

  const filtered = clients.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.addr.toLowerCase().includes(q) ||
      (c.system_info?.host_name || "").toLowerCase().includes(q)
    );
  });

  return (
    <>
      <Space style={{ marginBottom: 16 }}>
        <Input.Search
          placeholder="Search by address or hostname"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 300 }}
          allowClear
        />
        <Button icon={<ReloadOutlined />} onClick={fetchClients}>
          Refresh
        </Button>
      </Space>

      <Table
        loading={loading}
        dataSource={filtered}
        rowKey="addr"
        columns={[
          { title: "Address", dataIndex: "addr", sorter: (a, b) => a.addr.localeCompare(b.addr) },
          {
            title: "Hostname",
            key: "hostname",
            render: (_, r) => r.system_info?.host_name || "-",
          },
          {
            title: "Platform",
            dataIndex: "target_platform",
            render: (v) => <Tag>{v}</Tag>,
          },
          {
            title: "OS",
            key: "os",
            render: (_, r) => r.system_info?.long_os_version || r.system_info?.distribution_id || "-",
          },
          {
            title: "CPU Arch",
            key: "arch",
            render: (_, r) => r.system_info?.cpu_arch || "-",
          },
          {
            title: "Connected",
            dataIndex: "connected_time",
            render: (v) => formatDateTime(v),
            sorter: (a, b) =>
              new Date(a.connected_time).getTime() -
              new Date(b.connected_time).getTime(),
          },
          {
            title: "Actions",
            key: "actions",
            render: (_, record) => (
              <Space>
                <Button
                  size="small"
                  icon={<EyeOutlined />}
                  onClick={() =>
                    navigate(`/clients/${encodeURIComponent(record.addr)}`)
                  }
                >
                  Detail
                </Button>
                <Popconfirm
                  title="Disconnect this client?"
                  onConfirm={() => handleDelete(record.addr)}
                >
                  <Button size="small" danger icon={<DeleteOutlined />}>
                    Disconnect
                  </Button>
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />
    </>
  );
}
