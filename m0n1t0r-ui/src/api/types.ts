export interface ApiResponse<T> {
  code: number;
  body: T;
}

export interface SystemInfo {
  uptime: number;
  boot_time: number;
  name?: string;
  kernel_version?: string;
  long_os_version?: string;
  distribution_id: string;
  host_name?: string;
  cpu_arch: string;
  cpu: { count: Record<string, number> };
}

export interface ClientInfo {
  addr: string;
  version: string;
  target_platform: string;
  system_info: SystemInfo;
  build_time: string;
  commit_hash: string;
  current_exe: string;
  connected_time: string;
}

export interface ProcessInfo {
  name: string;
  cmd: string[];
  exe?: string;
  pid: number;
}

export interface FileInfo {
  name: string;
  path: string;
  size: number;
  is_dir: boolean;
  is_symlink: boolean;
}

export interface ServerInfo {
  version: string;
  build_time: string;
  commit_hash: string;
}

export interface ProxyInfo {
  key: number;
  type: ProxyType;
}

export type ProxyType =
  | { Socks5: { from: string; addr: string } }
  | { Forward: { from: string; to: string; addr: string } };

export interface ConnectEvent {
  event: 0 | 1 | 2;
  addr: string;
}

export interface DisplayInfo {
  name: string;
  width: number;
  height: number;
  is_online: boolean;
  is_primary: boolean;
}

export type ExecuteOption = "Blocked" | "Detached";

export interface CommandForm {
  command: string;
  option: ExecuteOption;
}

export interface NoAuthForm {
  from: string;
}

export interface PasswordAuthForm {
  from: string;
  name: string;
  password: string;
}

export interface ForwardForm {
  from: string;
  to: string;
}

export interface DownloadForm {
  url: string;
  path: string;
}

export interface UpdateByUrlForm {
  url: string;
  temp?: string;
}
