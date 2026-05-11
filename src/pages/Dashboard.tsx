import { useEffect, useState } from "react";
import axios from "axios";

function Dashboard() {
  const [csvFile, setCsvFile] =
    useState<File | null>(null);

  const [zipFile, setZipFile] =
    useState<File | null>(null);

  const [subject, setSubject] =
    useState(() =>
      localStorage.getItem(
        "subject"
      ) ||
      "Your Participation Certificate"
    );

  const [emailContent, setEmailContent] =
    useState(() =>
      localStorage.getItem(
        "emailContent"
      ) ||
      `Hello {name},

Thank you for participating.

Please find your certificate attached.

Regards,
Team`
    );

  const [loading, setLoading] =
    useState(false);

  const [progress, setProgress] =
    useState({
      current: 0,
      total: 0,
      success: 0,
      failed: 0,
      sending: false,
    });

  const [completedStats, setCompletedStats] =
    useState<null | {
      success: number;
      failed: number;
      total: number;
    }>(null);

  /* LocalStorage */

  useEffect(() => {
    localStorage.setItem(
      "subject",
      subject
    );
  }, [subject]);

  useEffect(() => {
    localStorage.setItem(
      "emailContent",
      emailContent
    );
  }, [emailContent]);

  /* Progress Polling */

  useEffect(() => {
    let interval: number;

    if (loading) {
      interval = window.setInterval(
        async () => {
          try {
            const response =
              await axios.get(
                "http://localhost:5000/api/progress"
              );

            setProgress(
              response.data
            );
          } catch (error) {
            console.log(error);
          }
        },
        1000
      );
    }

    return () =>
      clearInterval(interval);
  }, [loading]);

  /* Send */

  const handleSend =
    async () => {
      if (loading) return;

      if (!csvFile || !zipFile) {
        alert(
          "Please upload CSV and ZIP"
        );
        return;
      }

      const confirmSend =
        window.confirm(
          "Are you sure?\n\nCertificates will be sent to all participants."
        );

      if (!confirmSend) return;

      try {
        setLoading(true);
        setCompletedStats(
          null
        );

        const formData =
          new FormData();

        formData.append(
          "csv",
          csvFile
        );

        formData.append(
          "zip",
          zipFile
        );

        formData.append(
          "subject",
          subject
        );

        formData.append(
          "emailContent",
          emailContent
        );

        const response =
          await axios.post(
            "http://localhost:5000/api/send-certificates",
            formData
          );

        /* Save Logs */

        localStorage.setItem(
          "certificateLogs",
          JSON.stringify(
            response.data.logs
          )
        );

        setCompletedStats(
          response.data.stats
        );
      } catch (error) {
        console.log(error);

        alert(
          "Sending Failed ❌"
        );
      } finally {
        setLoading(false);
      }
    };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>
          Certificate Email
          Automation
        </h1>

        <p>
          Upload CSV and ZIP to
          send certificates.
        </p>
      </div>

      <div className="card">
        {/* CSV */}

        <div className="form-group">
          <label>
            Upload CSV File
          </label>

          <input
            type="file"
            accept=".csv"
            className="input"
            disabled={loading}
            onChange={(e) =>
              setCsvFile(
                e.target.files?.[0] ||
                  null
              )
            }
          />
        </div>

        {/* ZIP */}

        <div className="form-group">
          <label>
            Upload ZIP File
          </label>

          <input
            type="file"
            accept=".zip"
            className="input"
            disabled={loading}
            onChange={(e) =>
              setZipFile(
                e.target.files?.[0] ||
                  null
              )
            }
          />
        </div>

        {/* Subject */}

        <div className="form-group">
          <label>
            Email Subject
          </label>

          <input
            type="text"
            className="input"
            disabled={loading}
            value={subject}
            onChange={(e) =>
              setSubject(
                e.target.value
              )
            }
          />
        </div>

        {/* Content */}

        <div className="form-group">
          <label>
            Email Content
          </label>

          <textarea
            className="textarea"
            disabled={loading}
            value={emailContent}
            onChange={(e) =>
              setEmailContent(
                e.target.value
              )
            }
          />
        </div>

        {/* Progress */}

        {loading && (
          <div
            style={{
              marginBottom:
                "20px",
              padding: "20px",
              borderRadius:
                "12px",
              background:
                "#0f172a",
            }}
          >
            <h3>
              Sending
              Certificates...
            </h3>

            <p>
              {progress.current} /{" "}
              {progress.total}
            </p>

            <p>
              ✅ Sent:
              {" "}
              {
                progress.success
              }
            </p>

            <p>
              ❌ Failed:
              {" "}
              {
                progress.failed
              }
            </p>
          </div>
        )}

        {/* Completion */}

        {completedStats && (
          <div
            style={{
              marginBottom:
                "20px",
              padding: "20px",
              borderRadius:
                "12px",
              background:
                "#14532d",
            }}
          >
            <h3>
              ✅ Completed
            </h3>

            <p>
              Total:
              {" "}
              {
                completedStats.total
              }
            </p>

            <p>
              Sent:
              {" "}
              {
                completedStats.success
              }
            </p>

            <p>
              Failed:
              {" "}
              {
                completedStats.failed
              }
            </p>
          </div>
        )}

        <button
          className="send-button"
          onClick={handleSend}
          disabled={loading}
        >
          {loading
            ? "Sending..."
            : "Send Certificates"}
        </button>
      </div>

      <footer style={{ marginTop: "40px", textAlign: "center", color: "#888" }}>
        Made by Vaibhav Aran
      </footer>
    </div>
  );
}

export default Dashboard;