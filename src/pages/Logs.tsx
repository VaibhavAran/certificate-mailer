import { useMemo, useState } from "react";

function Logs() {
  const [search, setSearch] =
    useState("");

  const [refresh, setRefresh] =
    useState(false);

  const logs = JSON.parse(
    localStorage.getItem(
      "certificateLogs"
    ) || "[]"
  );

  const filteredLogs =
    useMemo(() => {
      return logs.filter(
        (log: any) =>
          log.name
            ?.toLowerCase()
            .includes(
              search.toLowerCase()
            ) ||
          log.email
            ?.toLowerCase()
            .includes(
              search.toLowerCase()
            )
      );
    }, [logs, search, refresh]);

  const total =
    logs.length;

  const sent =
    logs.filter(
      (log: any) =>
        log.status === "Sent"
    ).length;

  const failed =
    logs.filter(
      (log: any) =>
        log.status !== "Sent"
    ).length;

  const failedUsers =
    logs.filter(
      (log: any) =>
        log.status !== "Sent"
    );

  const clearLogs = () => {
    const confirmDelete =
      window.confirm(
        "Clear all logs?"
      );

    if (!confirmDelete) return;

    localStorage.removeItem(
      "certificateLogs"
    );

    setRefresh(!refresh);
  };

  const exportFailedCSV =
    () => {
      if (
        failedUsers.length === 0
      ) {
        alert(
          "No failed users"
        );
        return;
      }

      const csvContent = [
        [
          "Name",
          "Email",
          "Status",
        ],
        ...failedUsers.map(
          (user: any) => [
            user.name,
            user.email,
            user.status,
          ]
        ),
      ]
        .map((row) =>
          row.join(",")
        )
        .join("\n");

      const blob =
        new Blob(
          [csvContent],
          {
            type: "text/csv",
          }
        );

      const url =
        URL.createObjectURL(
          blob
        );

      const link =
        document.createElement(
          "a"
        );

      link.href = url;

      link.download =
        "failed-users.csv";

      link.click();

      URL.revokeObjectURL(
        url
      );
    };

  const getStatusClass = (
    status: string
  ) => {
    switch (status) {
      case "Sent":
        return "status-sent";

      case
      "Certificate Missing":
        return "status-missing";

      case
      "Invalid Email":
        return "status-invalid";

      default:
        return "status-failed";
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Email Logs</h1>

        <p>
          Track certificate
          delivery status.
        </p>
      </div>

      {/* Summary */}

      <div className="stats-grid">
        <div className="stat-card">
          <h2>{total}</h2>
          <p>Total</p>
        </div>

        <div className="stat-card success">
          <h2>{sent}</h2>
          <p>Sent</p>
        </div>

        <div className="stat-card failed">
          <h2>{failed}</h2>
          <p>Failed</p>
        </div>
      </div>

      {/* Actions */}

      <div
        style={{
          display: "flex",
          gap: "10px",
          marginBottom:
            "20px",
        }}
      >
        <button
          className="send-button"
          onClick={
            exportFailedCSV
          }
        >
          Export Failed CSV
        </button>

        <button
          className="send-button"
          onClick={clearLogs}
          style={{
            background:
              "#dc2626",
          }}
        >
          Clear Logs
        </button>
      </div>

      {/* Search */}

      <div className="card">
        <input
          type="text"
          placeholder="Search name or email..."
          className="input"
          value={search}
          onChange={(e) =>
            setSearch(
              e.target.value
            )
          }
        />
      </div>

      {/* Logs */}

      <div className="card">
        {filteredLogs.length ===
        0 ? (
          <p>
            No logs found.
          </p>
        ) : (
          filteredLogs.map(
            (
              log: any,
              index: number
            ) => (
              <div
                key={index}
                className="log-item"
              >
                <div>
                  <h3>
                    {log.name}
                  </h3>

                  <p>
                    {log.email}
                  </p>
                </div>

                <span
                  className={`status-badge ${getStatusClass(
                    log.status
                  )}`}
                >
                  {log.status}
                </span>
              </div>
            )
          )
        )}
      </div>
    </div>
  );
}

export default Logs;