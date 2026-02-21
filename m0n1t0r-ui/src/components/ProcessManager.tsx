import { useEffect, useState } from "react";
import {
  Button,
  Form,
  Input,
  Popconfirm,
  Radio,
  Space,
  Table,
  message,
} from "antd";
import { DeleteOutlined, ReloadOutlined } from "@ant-design/icons";
import { executeCommand, killProcess, listProcesses } from "../api/process";
import type { ProcessInfo } from "../api/types";

interface Props {
  addr: string;
}

export default function ProcessManager({ addr }: Props) {
  const [processes, setProcesses] = useState<ProcessInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [execLoading, setExecLoading] = useState(false);
  const [output, setOutput] = useState<string | null>(null);
  const [form] = Form.useForm();

  const fetchProcesses = async () => {
    setLoading(true);
    try {
      setProcesses(await listProcesses(addr));
    } catch (err) {
      message.error("Failed to list processes: " + String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProcesses();
  }, [addr]);

  const handleKill = async (pid: number) => {
    try {
      await killProcess(addr, pid, "pid");
      message.success("Process killed");
      fetchProcesses();
    } catch (err) {
      message.error("Failed to kill process: " + String(err));
    }
  };

  const handleExecute = async (values: {
    command: string;
    option: "Blocked" | "Detached";
  }) => {
    setExecLoading(true);
    try {
      const result = await executeCommand(addr, values);
      setOutput(result);
      if (values.option === "Detached") {
        message.success("Command launched");
      }
    } catch (err) {
      message.error("Execution failed: " + String(err));
    } finally {
      setExecLoading(false);
    }
  };

  return (
    <>
      <Form
        form={form}
        layout="inline"
        onFinish={handleExecute}
        initialValues={{ option: "Blocked" }}
        style={{ marginBottom: 16 }}
      >
        <Form.Item
          name="command"
          rules={[{ required: true, message: "Enter a command" }]}
          style={{ flex: 1 }}
        >
          <Input placeholder="Command to execute" />
        </Form.Item>
        <Form.Item name="option">
          <Radio.Group>
            <Radio.Button value="Blocked">Blocked</Radio.Button>
            <Radio.Button value="Detached">Detached</Radio.Button>
          </Radio.Group>
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={execLoading}>
            Execute
          </Button>
        </Form.Item>
      </Form>

      {output !== null && (
        <pre
          style={{
            background: "#1a1a1a",
            color: "#d4d4d4",
            padding: 16,
            borderRadius: 8,
            marginBottom: 16,
            maxHeight: 300,
            overflow: "auto",
            whiteSpace: "pre-wrap",
          }}
        >
          {output}
        </pre>
      )}

      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ReloadOutlined />} onClick={fetchProcesses}>
          Refresh
        </Button>
      </Space>

      <Table
        loading={loading}
        dataSource={processes}
        rowKey="pid"
        size="small"
        columns={[
          {
            title: "PID",
            dataIndex: "pid",
            sorter: (a, b) => a.pid - b.pid,
          },
          {
            title: "Name",
            dataIndex: "name",
            sorter: (a, b) => a.name.localeCompare(b.name),
          },
          {
            title: "Executable",
            dataIndex: "exe",
            ellipsis: true,
            render: (v) => v || "-",
          },
          {
            title: "Command",
            dataIndex: "cmd",
            ellipsis: true,
            render: (cmd: string[]) => cmd?.join(" ") || "-",
          },
          {
            title: "Actions",
            key: "actions",
            render: (_, record) => (
              <Popconfirm
                title={`Kill PID ${record.pid}?`}
                onConfirm={() => handleKill(record.pid)}
              >
                <Button size="small" danger icon={<DeleteOutlined />}>
                  Kill
                </Button>
              </Popconfirm>
            ),
          },
        ]}
      />
    </>
  );
}
