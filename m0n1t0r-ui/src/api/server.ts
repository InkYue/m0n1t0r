import apiClient from "./client";
import type { ApiResponse, ProxyInfo, ServerInfo } from "./types";

export async function getServerInfo(): Promise<ServerInfo> {
  const res = await apiClient.get<ApiResponse<ServerInfo>>("/server");
  return res.data.body;
}

export async function listProxies(): Promise<ProxyInfo[]> {
  const res = await apiClient.get<ApiResponse<ProxyInfo[]>>("/server/proxy");
  return res.data.body;
}

export async function deleteProxy(key: number): Promise<void> {
  await apiClient.delete(`/server/proxy/${key}`);
}
