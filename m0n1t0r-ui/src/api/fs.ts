import apiClient from "./client";
import type { ApiResponse, FileInfo } from "./types";

const clientPath = (addr: string) =>
  `/client/${encodeURIComponent(addr)}/fs`;

export async function listDirectory(
  addr: string,
  path: string
): Promise<FileInfo[]> {
  const res = await apiClient.get<ApiResponse<FileInfo[]>>(clientPath(addr), {
    params: { type: "directory", path },
  });
  return res.data.body;
}

export async function readFile(addr: string, path: string): Promise<Blob> {
  const res = await apiClient.get(clientPath(addr), {
    params: { type: "file", path },
    responseType: "blob",
  });
  return res.data;
}

export async function writeFile(
  addr: string,
  path: string,
  file: File
): Promise<void> {
  const formData = new FormData();
  formData.append("file", file);
  await apiClient.put(clientPath(addr), formData, {
    params: { type: "file", path },
    headers: { "Content-Type": "multipart/form-data" },
  });
}

export async function createDirectory(
  addr: string,
  path: string
): Promise<void> {
  await apiClient.put(clientPath(addr), null, {
    params: { type: "directory", path },
  });
}

export async function deleteFile(addr: string, path: string): Promise<void> {
  await apiClient.delete(clientPath(addr), {
    params: { type: "file", path },
  });
}

export async function getFileMetadata(
  addr: string,
  path: string
): Promise<FileInfo> {
  const res = await apiClient.get<ApiResponse<FileInfo>>(
    `${clientPath(addr)}/metadata`,
    { params: { path } }
  );
  return res.data.body;
}
