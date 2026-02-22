import { Component, type ErrorInfo, type ReactNode } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { App as AntApp, ConfigProvider, Result, theme } from "antd";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import ClientList from "./pages/ClientList";
import ClientDetail from "./pages/ClientDetail";
import ServerInfo from "./pages/ServerInfo";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("React error boundary caught:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <Result
          status="error"
          title="Something went wrong"
          subTitle={this.state.error.message}
        />
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
      }}
    >
      <AntApp>
        <ErrorBoundary>
          <BrowserRouter>
            <Routes>
              <Route element={<Layout />}>
                <Route index element={<Dashboard />} />
                <Route path="clients" element={<ClientList />} />
                <Route path="clients/:addr" element={<ClientDetail />} />
                <Route path="server" element={<ServerInfo />} />
                <Route path="settings" element={<Settings />} />
                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </ErrorBoundary>
      </AntApp>
    </ConfigProvider>
  );
}
