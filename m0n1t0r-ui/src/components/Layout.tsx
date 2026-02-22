import {
  DashboardOutlined,
  DesktopOutlined,
  InfoCircleOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import { Layout as AntLayout, Menu, theme } from "antd";
import { Outlet, useLocation, useNavigate } from "react-router-dom";

const { Sider, Content, Header } = AntLayout;

const menuItems = [
  { key: "/", icon: <DashboardOutlined />, label: "Dashboard" },
  { key: "/clients", icon: <DesktopOutlined />, label: "Clients" },
  { key: "/server", icon: <InfoCircleOutlined />, label: "Server" },
  { key: "/settings", icon: <SettingOutlined />, label: "Settings" },
];

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  const selectedKey =
    menuItems.find(
      (item) => item.key !== "/" && location.pathname.startsWith(item.key)
    )?.key || "/";

  return (
    <AntLayout style={{ minHeight: "100vh" }}>
      <Sider breakpoint="lg" collapsedWidth={80}>
        <div
          style={{
            height: 32,
            margin: 16,
            color: "#fff",
            fontWeight: "bold",
            fontSize: 18,
            textAlign: "center",
            lineHeight: "32px",
          }}
        >
          m0n1t0r
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <AntLayout>
        <Header style={{ padding: "0 24px", background: colorBgContainer }}>
          <span style={{ fontSize: 16, fontWeight: 500 }}>
            m0n1t0r Control Panel
          </span>
        </Header>
        <Content style={{ margin: 16 }}>
          <div
            style={{
              padding: 24,
              background: colorBgContainer,
              borderRadius: borderRadiusLG,
              minHeight: "calc(100vh - 128px)",
            }}
          >
            <Outlet />
          </div>
        </Content>
      </AntLayout>
    </AntLayout>
  );
}
