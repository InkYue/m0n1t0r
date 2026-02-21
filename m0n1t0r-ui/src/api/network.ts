import apiClient from "./client";
import type { ApiResponse, DownloadForm } from "./types";

export async function downloadToClient(
  addr: string,
  form: DownloadForm
): Promise<string> {
  const res = await apiClient.post<ApiResponse<string>>(
    `/client/${encodeURIComponent(addr)}/network/download`,
    form
  );
  return res.data.body;
}
