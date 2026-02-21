import { useEffect, useState } from "react";
import {
  Breadcrumb,
  Button,
  Input,
  Modal,
  Popconfirm,
  Space,
  Table,
  Upload,
  message,
} from "antd";
import {
  DeleteOutlined,
  DownloadOutlined,
  FileOutlined,
  FolderAddOutlined,
  FolderOutlined,
  HomeOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import {
  createDirectory,
  deleteFile,
  listDirectory,
  readFile,
  writeFile,
} from "../api/fs";
import type { FileInfo } from "../api/types";
import { formatBytes } from "../utils/format";

interface Props {
  addr: string;
}

export default function FileManager({ addr }: Props) {
  const [currentPath, setCurrentPath] = useState("/");
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [mkdirVisible, setMkdirVisible] = useState(false);
  const [newDirName, setNewDirName] = useState("");

  const fetchFiles = async (path: string) => {
    setLoading(true);
    try {
      const result = await listDirectory(addr, path);
      setFiles(result);
      setCurrentPath(path);
    } catch (err) {
      message.error("Failed to list directory: " + String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles(currentPath);
  }, [addr]);

  const navigateTo = (path: string) => {
    fetchFiles(path);
  };

  const handleDownload = async (file: FileInfo) => {
    try {
      const blob = await readFile(addr, file.path);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      message.error("Failed to download: " + String(err));
    }
  };

  const handleDelete = async (file: FileInfo) => {
    try {
      await deleteFile(addr, file.path);
      message.success("Deleted");
      fetchFiles(currentPath);
    } catch (err) {
      message.error("Failed to delete: " + String(err));
    }
  };

  const handleUpload = async (file: File) => {
    const path =
      currentPath === "/"
        ? `/${file.name}`
        : `${currentPath}/${file.name}`;
    try {
      await writeFile(addr, path, file);
      message.success("Uploaded");
      fetchFiles(currentPath);
    } catch (err) {
      message.error("Failed to upload: " + String(err));
    }
    return false;
  };

  const handleMkdir = async () => {
    if (!newDirName) return;
    const path =
      currentPath === "/"
        ? `/${newDirName}`
        : `${currentPath}/${newDirName}`;
    try {
      await createDirectory(addr, path);
      message.success("Directory created");
      setMkdirVisible(false);
      setNewDirName("");
      fetchFiles(currentPath);
    } catch (err) {
      message.error("Failed to create directory: " + String(err));
    }
  };

  const pathParts = currentPath.split("/").filter(Boolean);
  const breadcrumbItems = [
    {
      title: (
        <a onClick={() => navigateTo("/")}>
          <HomeOutlined />
        </a>
      ),
    },
    ...pathParts.map((part, i) => {
      const path = "/" + pathParts.slice(0, i + 1).join("/");
      return {
        title: <a onClick={() => navigateTo(path)}>{part}</a>,
      };
    }),
  ];

  return (
    <>
      <Space style={{ marginBottom: 16 }}>
        <Breadcrumb items={breadcrumbItems} />
      </Space>
      <Space style={{ marginBottom: 16, float: "right" }}>
        <Upload beforeUpload={handleUpload} showUploadList={false}>
          <Button icon={<UploadOutlined />}>Upload</Button>
        </Upload>
        <Button
          icon={<FolderAddOutlined />}
          onClick={() => setMkdirVisible(true)}
        >
          New Folder
        </Button>
      </Space>

      <Table
        loading={loading}
        dataSource={files}
        rowKey="path"
        size="small"
        columns={[
          {
            title: "Name",
            dataIndex: "name",
            render: (name, record) =>
              record.is_dir ? (
                <a onClick={() => navigateTo(record.path)}>
                  <FolderOutlined style={{ marginRight: 8 }} />
                  {name}
                </a>
              ) : (
                <>
                  <FileOutlined style={{ marginRight: 8 }} />
                  {name}
                </>
              ),
            sorter: (a, b) => a.name.localeCompare(b.name),
          },
          {
            title: "Size",
            dataIndex: "size",
            render: (size, record) => (record.is_dir ? "-" : formatBytes(size)),
            sorter: (a, b) => a.size - b.size,
          },
          {
            title: "Type",
            key: "type",
            render: (_, r) =>
              r.is_dir ? "Directory" : r.is_symlink ? "Symlink" : "File",
          },
          {
            title: "Actions",
            key: "actions",
            render: (_, record) => (
              <Space>
                {!record.is_dir && (
                  <Button
                    size="small"
                    icon={<DownloadOutlined />}
                    onClick={() => handleDownload(record)}
                  >
                    Download
                  </Button>
                )}
                <Popconfirm
                  title="Delete this item?"
                  onConfirm={() => handleDelete(record)}
                >
                  <Button size="small" danger icon={<DeleteOutlined />}>
                    Delete
                  </Button>
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />

      <Modal
        title="Create Directory"
        open={mkdirVisible}
        onOk={handleMkdir}
        onCancel={() => {
          setMkdirVisible(false);
          setNewDirName("");
        }}
      >
        <Input
          placeholder="Directory name"
          value={newDirName}
          onChange={(e) => setNewDirName(e.target.value)}
          onPressEnter={handleMkdir}
        />
      </Modal>
    </>
  );
}
