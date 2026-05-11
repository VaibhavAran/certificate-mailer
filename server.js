import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import multer from "multer";
import path from "path";
import fs from "fs";
import AdmZip from "adm-zip";
import csvParser from "csv-parser";
import nodemailer from "nodemailer";

dotenv.config();

const app = express();

app.use(
  cors({
    origin: "http://localhost:5173",
  })
);

app.use(express.json());

/* -----------------------------
   Progress Tracker
----------------------------- */

let progress = {
  current: 0,
  total: 0,
  success: 0,
  failed: 0,
  sending: false,
};

/* -----------------------------
   Upload Storage
----------------------------- */

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    if (file.fieldname === "zip") {
      cb(null, "uploads/zip");
    } else {
      cb(null, "uploads");
    }
  },

  filename: function (req, file, cb) {
    cb(
      null,
      Date.now() +
        path.extname(file.originalname)
    );
  },
});

const upload = multer({
  storage,
});

/* -----------------------------
   Gmail Transport
----------------------------- */
const transporter =
  nodemailer.createTransport({
    service: "gmail",

    pool: true,
    maxConnections: 4,
    maxMessages: Infinity,

    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

/* -----------------------------
   Helpers
----------------------------- */

function parseCSV(csvPath) {
  return new Promise(
    (resolve, reject) => {
      const results = [];

      fs.createReadStream(csvPath)
        .pipe(csvParser())
        .on("data", (data) =>
          results.push(data)
        )
        .on("end", () =>
          resolve(results)
        )
        .on("error", (err) =>
          reject(err)
        );
    }
  );
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    email
  );
}

/* -----------------------------
   Routes
----------------------------- */

app.get("/", (req, res) => {
  res.send("Backend Running 🚀");
});

/* Progress API */

app.get(
  "/api/progress",
  (req, res) => {
    res.json(progress);
  }
);

/* Send Certificates */

app.post(
  "/api/send-certificates",
  upload.fields([
    {
      name: "csv",
      maxCount: 1,
    },
    {
      name: "zip",
      maxCount: 1,
    },
  ]),
  async (req, res) => {
    try {
      const csvFile =
        req.files.csv?.[0];

      const zipFile =
        req.files.zip?.[0];

      if (!csvFile || !zipFile) {
        return res.status(400).json({
          success: false,
          message:
            "CSV or ZIP missing",
        });
      }

      const {
        subject,
        emailContent,
      } = req.body;

      /* Reset Progress */

      progress = {
        current: 0,
        total: 0,
        success: 0,
        failed: 0,
        sending: true,
      };

      /* -----------------------------
         Clear Old Files
      ----------------------------- */

      const extractedFolder =
        "uploads/extracted";

      if (
        fs.existsSync(
          extractedFolder
        )
      ) {
        const oldFiles =
          fs.readdirSync(
            extractedFolder
          );

        oldFiles.forEach(
          (file) => {
            fs.unlinkSync(
              path.join(
                extractedFolder,
                file
              )
            );
          }
        );
      }

      console.log(
        "Old extracted files cleared"
      );

      /* -----------------------------
         Extract ZIP
      ----------------------------- */

      const zip =
        new AdmZip(zipFile.path);

      zip.extractAllTo(
        extractedFolder,
        true
      );

      console.log(
        "ZIP extracted successfully"
      );

      const extractedFiles =
        fs.readdirSync(
          extractedFolder
        );

      /* -----------------------------
         Read CSV
      ----------------------------- */

      const participants =
        await parseCSV(
          csvFile.path
        );

      progress.total =
        participants.length;

      const logs = [];

      /* -----------------------------
         FAST SINGLE SEND MODE
      ----------------------------- */

      for (const participant of participants) {
        progress.current++;

        try {
          const name =
            participant.name?.trim();

          const email =
            participant.email?.trim();

          /* Validate Email */

          if (
            !email ||
            !isValidEmail(email)
          ) {
            progress.failed++;

            logs.push({
              name,
              email,
              status:
                "Invalid Email",
            });

            continue;
          }

          /* Match Certificate */

          const certificateName =
            name.replace(
              /\s+/g,
              "_"
            ) + ".png";

          const exists =
            extractedFiles.includes(
              certificateName
            );

          if (!exists) {
            progress.failed++;

            logs.push({
              name,
              email,
              status:
                "Certificate Missing",
            });

            continue;
          }

          const certificatePath =
            path.join(
              process.cwd(),
              "uploads",
              "extracted",
              certificateName
            );

          const personalizedEmail =
            emailContent.replace(
              "{name}",
              name
            );

          /* Send Email */

          await transporter.sendMail({
            from:
              process.env.EMAIL_USER,

            to: email,

            subject,

            text:
              personalizedEmail,

            attachments: [
              {
                filename:
                  certificateName,

                path:
                  certificatePath,
              },
            ],
          });

          progress.success++;

          logs.push({
            name,
            email,
            status: "Sent",
          });

          console.log(
            `Sent to ${email}`
          );
        } catch (error) {
          progress.failed++;

          logs.push({
            name:
              participant.name,
            email:
              participant.email,
            status:
              "Email Failed",
          });

          console.log(error);
        }
      }

      progress.sending =
        false;

      return res.json({
        success: true,
        message:
          "Certificates sent successfully 🚀",

        stats: {
          total:
            progress.total,
          success:
            progress.success,
          failed:
            progress.failed,
        },

        logs,
      });
    } catch (error) {
      console.log(error);

      progress.sending =
        false;

      return res.status(500).json({
        success: false,
        message:
          "Sending failed ❌",
      });
    }
  }
);

/* -----------------------------
   Start Server
----------------------------- */

const PORT = 5000;

app.listen(PORT, () => {
  console.log(
    `Server running on port ${PORT}`
  );
});