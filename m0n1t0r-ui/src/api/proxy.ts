import apiClient from "./client";
import type {
  ApiResponse,
  ForwardForm,
  NoAuthForm,
  PasswordAuthForm,
  ProxyInfo,
} from "./types";

const clientPath = (addr: string) =>
  `/client/${encodeURIComponent(addr)}/proxy`;

export async function createSocks5NoAuth(
  addr: string,
  form: NoAuthForm
): Promise<ProxyInfo> {
  const res = await apiClient.post<ApiResponse<ProxyInfo>>(
    `${clientPath(addr)}/socks5/noauth`,
    form
  );
  return res.data.body;
}

export async function createSocks5Password(
  addr: string,
  form: PasswordAuthForm
): Promise<ProxyInfo> {
  const res = await apiClient.post<ApiResponse<ProxyInfo>>(
    `${clientPath(addr)}/socks5/pass`,
    form
  );
  return res.data.body;
}

export async function createForward(
  addr: string,
  form: ForwardForm
): Promise<ProxyInfo> {
  const res = await apiClient.post<ApiResponse<ProxyInfo>>(
    `${clientPath(addr)}/forward`,
    form
  );
  return res.data.body;
}
