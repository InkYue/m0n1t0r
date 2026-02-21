import { useState } from "react";
import { Button, Card, Form, Input, message } from "antd";
import { DownloadOutlined } from "@ant-design/icons";
import { downloadToClient } from "../api/network";

interface Props {
  addr: string;
}

export default function NetworkDownload({ addr }: Props) {
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  const handleSubmit = async (values: { url: string; path: string }) => {
    setLoading(true);
    try {
      await downloadToClient(addr, values);
      message.success("Download started");
      form.resetFields();
    } catch (err) {
      message.error("Failed: " + String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card title="Download File to Client">
      <Form form={form} onFinish={handleSubmit} layout="vertical">
        <Form.Item
          name="url"
          label="Source URL"
          rules={[{ required: true, message: "Enter a URL" }]}
        >
          <Input placeholder="https://example.com/file.exe" />
        </Form.Item>
        <Form.Item
          name="path"
          label="Destination Path"
          rules={[{ required: true, message: "Enter destination path" }]}
        >
          <Input placeholder="C:\Users\user\Downloads\file.exe" />
        </Form.Item>
        <Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            loading={loading}
            icon={<DownloadOutlined />}
          >
            Download
          </Button>
        </Form.Item>
      </Form>
    </Card>
  );
}
