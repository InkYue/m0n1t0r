import { useState } from "react";
import { Button, Form, Input, InputNumber, Upload, message } from "antd";
import { ThunderboltOutlined } from "@ant-design/icons";
import { voidgate } from "../api/process";

interface Props {
  addr: string;
}

interface VoidgateForm {
  ep_offset: number;
  key: string;
}

export default function Voidgate({ addr }: Props) {
  const [loading, setLoading] = useState(false);
  const [shellcodeFile, setShellcodeFile] = useState<File | null>(null);
  const [form] = Form.useForm<VoidgateForm>();

  const handleSubmit = async (values: VoidgateForm) => {
    if (!shellcodeFile) {
      message.error("Please select a shellcode file");
      return;
    }
    setLoading(true);
    try {
      await voidgate(addr, shellcodeFile, values.ep_offset, values.key);
      message.success("Voidgate executed successfully");
      form.resetFields();
      setShellcodeFile(null);
    } catch (err) {
      message.error("Failed: " + String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Form form={form} onFinish={handleSubmit} layout="vertical">
      <Form.Item label="Shellcode File" required>
        <Upload
          beforeUpload={(file) => {
            setShellcodeFile(file);
            return false;
          }}
          onRemove={() => setShellcodeFile(null)}
          maxCount={1}
          fileList={
            shellcodeFile
              ? [
                  {
                    uid: "0",
                    name: shellcodeFile.name,
                    status: "done",
                  },
                ]
              : []
          }
        >
          <Button>Select File</Button>
        </Upload>
      </Form.Item>
      <Form.Item
        name="ep_offset"
        label="Entry Point Offset"
        initialValue={0}
        rules={[{ required: true, message: "Enter entry point offset" }]}
      >
        <InputNumber min={0} style={{ width: "100%" }} />
      </Form.Item>
      <Form.Item
        name="key"
        label="XOR Key"
        rules={[{ required: true, message: "Enter XOR key" }]}
      >
        <Input placeholder="Encryption key" />
      </Form.Item>
      <Form.Item>
        <Button
          type="primary"
          htmlType="submit"
          loading={loading}
          icon={<ThunderboltOutlined />}
          danger
        >
          Execute
        </Button>
      </Form.Item>
    </Form>
  );
}
