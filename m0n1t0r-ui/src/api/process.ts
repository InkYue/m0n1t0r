import apiClient from "./client";
import type { ApiResponse, CommandForm, ProcessInfo } from "./types";

const clientPath = (addr: string) =>
  `/client/${encodeURIComponent(addr)}/process`;

export async function listProcesses(addr: string): Promise<ProcessInfo[]> {
  const res = await apiClient.get<ApiResponse<ProcessInfo[]>>(
    clientPath(addr)
  );
  return res.data.body;
}

export async function killProcess(
  addr: string,
  value: string | number,
  type: "pid" | "name"
): Promise<void> {
  await apiClient.delete(`${clientPath(addr)}/${encodeURIComponent(value)}`, {
    params: { type },
  });
}

export async function executeCommand(
  addr: string,
  form: CommandForm
): Promise<string> {
  const res = await apiClient.post<ApiResponse<string>>(
    `${clientPath(addr)}/execute`,
    form
  );
  return res.data.body;
}
