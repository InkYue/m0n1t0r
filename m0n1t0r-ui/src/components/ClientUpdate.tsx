import { useState } from "react";
import { Button, Card, Divider, Form, Input, Upload, message } from "antd";
import { CloudUploadOutlined, LinkOutlined } from "@ant-design/icons";
import apiClient from "../api/client";
import type { ApiResponse } from "../api/types";

interface Props {
  addr: string;
}

export default function ClientUpdate({ addr }: Props) {
  const [urlLoading, setUrlLoading] = useState(false);
  const [fileLoading, setFileLoading] = useState(false);
  const [urlForm] = Form.useForm();

  const handleUrlUpdate = async (values: { url: string; temp?: string }) => {
    setUrlLoading(true);
    try {
      await apiClient.post<ApiResponse<string>>(
        `/client/${encodeURIComponent(addr)}/update/byurl`,
        values
      );
      message.success("Update initiated via URL");
      urlForm.resetFields();
    } catch (err) {
      message.error("Failed: " + String(err));
    } finally {
      setUrlLoading(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    setFileLoading(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      await apiClient.post(
        `/client/${encodeURIComponent(addr)}/update/byfile`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      message.success("Update initiated via file upload");
    } catch (err) {
      message.error("Failed: " + String(err));
    } finally {
      setFileLoading(false);
    }
    return false;
  };

  return (
    <>
      <Card title="Update via URL">
        <Form form={urlForm} onFinish={handleUrlUpdate} layout="vertical">
          <Form.Item
            name="url"
            label="Update URL"
            rules={[{ required: true, message: "Enter update URL" }]}
          >
            <Input placeholder="https://example.com/update.exe" />
          </Form.Item>
          <Form.Item name="temp" label="Temp Path (optional)">
            <Input placeholder="temp.bin" />
          </Form.Item>
          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={urlLoading}
              icon={<LinkOutlined />}
            >
              Update
            </Button>
          </Form.Item>
        </Form>
      </Card>

      <Divider />

      <Card title="Update via File Upload">
        <Upload beforeUpload={handleFileUpload} showUploadList={false}>
          <Button
            icon={<CloudUploadOutlined />}
            loading={fileLoading}
            type="primary"
          >
            Select File & Upload
          </Button>
        </Upload>
        <p style={{ marginTop: 8, color: "#888" }}>Max file size: 50MB</p>
      </Card>
    </>
  );
}
