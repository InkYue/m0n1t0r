import apiClient from "./client";
import type { ApiResponse, DownloadForm } from "./types";

export async function downloadToClient(
  addr: string,
  form: DownloadForm
): Promise<string> {
  const params = new URLSearchParams();
  params.append("url", form.url);
  params.append("path", form.path);
  const res = await apiClient.post<ApiResponse<string>>(
    `/client/${encodeURIComponent(addr)}/network/download`,
    params
  );
  return res.data.body;
}
