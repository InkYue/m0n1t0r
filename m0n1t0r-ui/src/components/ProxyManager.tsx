import { useEffect, useState } from "react";
import {
  Button,
  Card,
  Form,
  Input,
  Popconfirm,
  Space,
  Table,
  Tabs,
  Tag,
  message,
} from "antd";
import { DeleteOutlined, ReloadOutlined } from "@ant-design/icons";
import {
  createForward,
  createSocks5NoAuth,
  createSocks5Password,
} from "../api/proxy";
import { deleteProxy, listProxies } from "../api/server";
import type { ProxyInfo } from "../api/types";

interface Props {
  addr: string;
}

export default function ProxyManager({ addr }: Props) {
  const [proxies, setProxies] = useState<ProxyInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [noAuthForm] = Form.useForm();
  const [passForm] = Form.useForm();
  const [fwdForm] = Form.useForm();

  const fetchProxies = async () => {
    setLoading(true);
    try {
      setProxies(await listProxies());
    } catch (err) {
      message.error("Failed to list proxies: " + String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProxies();
  }, [addr]);

  const handleNoAuth = async (values: { from: string }) => {
    try {
      await createSocks5NoAuth(addr, values);
      message.success("SOCKS5 proxy created");
      noAuthForm.resetFields();
      fetchProxies();
    } catch (err) {
      message.error("Failed: " + String(err));
    }
  };

  const handlePassAuth = async (values: {
    from: string;
    name: string;
    password: string;
  }) => {
    try {
      await createSocks5Password(addr, values);
      message.success("SOCKS5 proxy created");
      passForm.resetFields();
      fetchProxies();
    } catch (err) {
      message.error("Failed: " + String(err));
    }
  };

  const handleForward = async (values: { from: string; to: string }) => {
    try {
      await createForward(addr, values);
      message.success("Port forward created");
      fwdForm.resetFields();
      fetchProxies();
    } catch (err) {
      message.error("Failed: " + String(err));
    }
  };

  const handleDelete = async (key: number) => {
    try {
      await deleteProxy(key);
      message.success("Proxy closed");
      fetchProxies();
    } catch (err) {
      message.error("Failed: " + String(err));
    }
  };

  const getProxyType = (p: ProxyInfo) =>
    "Socks5" in p.type ? "SOCKS5" : "Forward";

  const getProxyDesc = (p: ProxyInfo) => {
    if ("Socks5" in p.type)
      return `${p.type.Socks5.from} -> ${p.type.Socks5.addr}`;
    if ("Forward" in p.type)
      return `${p.type.Forward.from} -> ${p.type.Forward.to}`;
    return "";
  };

  const createTabs = [
    {
      key: "noauth",
      label: "SOCKS5 (No Auth)",
      children: (
        <Form form={noAuthForm} onFinish={handleNoAuth} layout="inline">
          <Form.Item
            name="from"
            rules={[{ required: true, message: "Bind address" }]}
          >
            <Input placeholder="0.0.0.0:1080" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit">
              Create
            </Button>
          </Form.Item>
        </Form>
      ),
    },
    {
      key: "pass",
      label: "SOCKS5 (Password)",
      children: (
        <Form form={passForm} onFinish={handlePassAuth} layout="inline">
          <Form.Item
            name="from"
            rules={[{ required: true, message: "Bind address" }]}
          >
            <Input placeholder="0.0.0.0:1080" />
          </Form.Item>
          <Form.Item
            name="name"
            rules={[{ required: true, message: "Username" }]}
          >
            <Input placeholder="Username" />
          </Form.Item>
          <Form.Item
            name="password"
            rules={[{ required: true, message: "Password" }]}
          >
            <Input.Password placeholder="Password" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit">
              Create
            </Button>
          </Form.Item>
        </Form>
      ),
    },
    {
      key: "forward",
      label: "Port Forward",
      children: (
        <Form form={fwdForm} onFinish={handleForward} layout="inline">
          <Form.Item
            name="from"
            rules={[{ required: true, message: "Listen address" }]}
          >
            <Input placeholder="0.0.0.0:8080" />
          </Form.Item>
          <Form.Item
            name="to"
            rules={[{ required: true, message: "Forward to" }]}
          >
            <Input placeholder="127.0.0.1:80" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit">
              Create
            </Button>
          </Form.Item>
        </Form>
      ),
    },
  ];

  return (
    <>
      <Card title="Create Proxy" style={{ marginBottom: 16 }}>
        <Tabs items={createTabs} />
      </Card>

      <Card
        title="Active Proxies"
        extra={
          <Button icon={<ReloadOutlined />} onClick={fetchProxies}>
            Refresh
          </Button>
        }
      >
        <Table
          loading={loading}
          dataSource={proxies}
          rowKey="key"
          size="small"
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
              render: (_, r) => getProxyDesc(r),
            },
            {
              title: "Actions",
              key: "actions",
              render: (_, record) => (
                <Space>
                  <Popconfirm
                    title="Close this proxy?"
                    onConfirm={() => handleDelete(record.key)}
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
