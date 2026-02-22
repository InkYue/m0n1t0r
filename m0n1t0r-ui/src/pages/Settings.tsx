import { useState } from "react";
import {
  Button,
  Form,
  Input,
  Switch,
  Alert,
  Space,
  Typography,
  message,
} from "antd";
import { getSettings, saveSettings, getApiBaseUrl } from "../utils/settings";
import axios from "axios";

const { Title } = Typography;

export default function Settings() {
  const [settings, setSettings] = useState(getSettings);
  const [testing, setTesting] = useState(false);

  const handleSave = () => {
    saveSettings(settings);
    message.success("Settings saved");
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const baseUrl = settings.backendUrl
        ? `${settings.backendUrl.replace(/\/+$/, "")}/api/v1`
        : getApiBaseUrl();
      const res = await axios.get(`${baseUrl}/server`, {
        timeout: 5000,
        withCredentials: true,
      });
      if (res.data && typeof res.data.code === "number" && res.data.code === 0) {
        message.success("Connection successful");
      } else {
        message.warning("Unexpected response: " + JSON.stringify(res.data));
      }
    } catch (err) {
      message.error("Connection failed: " + String(err));
    } finally {
      setTesting(false);
    }
  };

  const showSslHelper =
    settings.skipSslCheck &&
    settings.backendUrl.startsWith("https://");

  return (
    <>
      <Title level={4}>Settings</Title>
      <Form layout="vertical" style={{ maxWidth: 500 }}>
        <Form.Item
          label="Backend URL"
          help="Leave empty to use the current host. Example: https://192.168.1.100:10801"
        >
          <Input
            placeholder="https://192.168.1.100:10801"
            value={settings.backendUrl}
            onChange={(e) =>
              setSettings((s) => ({ ...s, backendUrl: e.target.value }))
            }
          />
        </Form.Item>

        <Form.Item
          label="Skip SSL Check"
          help="Enable if the backend uses a self-signed certificate"
        >
          <Switch
            checked={settings.skipSslCheck}
            onChange={(checked) =>
              setSettings((s) => ({ ...s, skipSslCheck: checked }))
            }
          />
        </Form.Item>

        {showSslHelper && (
          <Form.Item>
            <Alert
              type="warning"
              showIcon
              message="Self-signed certificate detected"
              description={
                <>
                  <p>
                    Browsers cannot skip SSL verification programmatically.
                    To trust the backend's self-signed certificate, click the
                    button below to open the backend in a new tab, then accept
                    the certificate warning in your browser.
                  </p>
                  <Button
                    type="primary"
                    onClick={() =>
                      window.open(
                        settings.backendUrl.replace(/\/+$/, ""),
                        "_blank"
                      )
                    }
                  >
                    Trust Certificate
                  </Button>
                </>
              }
            />
          </Form.Item>
        )}

        <Form.Item>
          <Space>
            <Button type="primary" onClick={handleSave}>
              Save
            </Button>
            <Button onClick={handleTest} loading={testing}>
              Test Connection
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </>
  );
}
