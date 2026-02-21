import apiClient from "./client";
import type { ApiResponse, ClientInfo } from "./types";

export async function listClients(): Promise<ClientInfo[]> {
  const res = await apiClient.get<ApiResponse<ClientInfo[]>>("/client");
  return res.data.body;
}

export async function getClient(addr: string): Promise<ClientInfo> {
  const res = await apiClient.get<ApiResponse<ClientInfo>>(
    `/client/${encodeURIComponent(addr)}`
  );
  return res.data.body;
}

export async function deleteClient(addr: string): Promise<void> {
  await apiClient.delete(`/client/${encodeURIComponent(addr)}`);
}

export async function getEnvironments(
  addr: string
): Promise<Record<string, string>> {
  const res = await apiClient.get<ApiResponse<Record<string, string>>>(
    `/client/${encodeURIComponent(addr)}/environments`
  );
  return res.data.body;
}
