import { useEffect, useState } from "react";
import { Input, Table, message } from "antd";
import { getEnvironments } from "../api/clients";

interface Props {
  addr: string;
}

export default function EnvironmentVars({ addr }: Props) {
  const [envs, setEnvs] = useState<{ key: string; value: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setLoading(true);
    getEnvironments(addr)
      .then((data) =>
        setEnvs(
          Object.entries(data).map(([key, value]) => ({ key, value }))
        )
      )
      .catch((err) => message.error("Failed to fetch env vars: " + String(err)))
      .finally(() => setLoading(false));
  }, [addr]);

  const filtered = envs.filter(
    (e) =>
      e.key.toLowerCase().includes(search.toLowerCase()) ||
      e.value.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <Input.Search
        placeholder="Search environment variables"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ marginBottom: 16, width: 400 }}
        allowClear
      />
      <Table
        loading={loading}
        dataSource={filtered}
        rowKey="key"
        size="small"
        columns={[
          {
            title: "Variable",
            dataIndex: "key",
            sorter: (a, b) => a.key.localeCompare(b.key),
            width: "30%",
          },
          {
            title: "Value",
            dataIndex: "value",
            ellipsis: true,
          },
        ]}
      />
    </>
  );
}
