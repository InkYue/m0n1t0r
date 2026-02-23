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
  const params = new URLSearchParams();
  params.append("from", form.from);
  const res = await apiClient.post<ApiResponse<ProxyInfo>>(
    `${clientPath(addr)}/socks5/noauth`,
    params
  );
  return res.data.body;
}

export async function createSocks5Password(
  addr: string,
  form: PasswordAuthForm
): Promise<ProxyInfo> {
  const params = new URLSearchParams();
  params.append("from", form.from);
  params.append("name", form.name);
  params.append("password", form.password);
  const res = await apiClient.post<ApiResponse<ProxyInfo>>(
    `${clientPath(addr)}/socks5/pass`,
    params
  );
  return res.data.body;
}

export async function createForward(
  addr: string,
  form: ForwardForm
): Promise<ProxyInfo> {
  const params = new URLSearchParams();
  params.append("from", form.from);
  params.append("to", form.to);
  const res = await apiClient.post<ApiResponse<ProxyInfo>>(
    `${clientPath(addr)}/forward`,
    params
  );
  return res.data.body;
}
