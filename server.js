import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import multer from "multer";
import path from "path";
import fs from "fs";
import AdmZip from "adm-zip";
import csvParser from "csv-parser";
import nodemailer from "nodemailer";
import os from "os";

dotenv.config();

const app = express();

/* -----------------------------
   CORS
----------------------------- */

app.use(
  cors({
    origin: "*",
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

const uploadBasePath =
  process.env.NODE_ENV ===
  "production"
    ? path.join(
        os.tmpdir(),
        "certificate-mailer"
      )
    : "uploads";

const extractedFolder =
  path.join(
    uploadBasePath,
    "extracted"
  );

const zipFolder =
  path.join(
    uploadBasePath,
    "zip"
  );

/* Create folders if missing */

[
  uploadBasePath,
  extractedFolder,
  zipFolder,
].forEach((folder) => {
  if (
    !fs.existsSync(folder)
  ) {
    fs.mkdirSync(folder, {
      recursive: true,
    });
  }
});

const storage =
  multer.diskStorage({
    destination: function (
      req,
      file,
      cb
    ) {
      if (
        file.fieldname ===
        "zip"
      ) {
        cb(
          null,
          zipFolder
        );
      } else {
        cb(
          null,
          uploadBasePath
        );
      }
    },

    filename: function (
      req,
      file,
      cb
    ) {
      cb(
        null,
        Date.now() +
          path.extname(
            file.originalname
          )
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
    host: "smtp.gmail.com",
    port: 465,
    secure: true,

    pool: true,
    maxConnections: 2,
    maxMessages: Infinity,

    connectionTimeout: 60000,
    greetingTimeout: 30000,
    socketTimeout: 60000,

    auth: {
      user:
        process.env.EMAIL_USER,
      pass:
        process.env.EMAIL_PASS,
    },
  });

/* -----------------------------
   Helpers
----------------------------- */

function parseCSV(
  csvPath
) {
  return new Promise(
    (
      resolve,
      reject
    ) => {
      const results =
        [];

      fs.createReadStream(
        csvPath
      )
        .pipe(
          csvParser()
        )
        .on(
          "data",
          (data) =>
            results.push(
              data
            )
        )
        .on(
          "end",
          () =>
            resolve(
              results
            )
        )
        .on(
          "error",
          (err) =>
            reject(
              err
            )
        );
    }
  );
}

function isValidEmail(
  email
) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    email
  );
}

/* -----------------------------
   Routes
----------------------------- */

app.get(
  "/",
  (
    req,
    res
  ) => {
    res.send(
      "Backend Running 🚀"
    );
  }
);

/* Progress API */

app.get(
  "/api/progress",
  (
    req,
    res
  ) => {
    res.json(
      progress
    );
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
  async (
    req,
    res
  ) => {
    try {
      const csvFile =
        req.files
          ?.csv?.[0];

      const zipFile =
        req.files
          ?.zip?.[0];

      if (
        !csvFile ||
        !zipFile
      ) {
        return res
          .status(
            400
          )
          .json({
            success:
              false,
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

      /* Clear old extracted */

      if (
        fs.existsSync(
          extractedFolder
        )
      ) {
        fs.readdirSync(
          extractedFolder
        ).forEach(
          (
            file
          ) => {
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

      /* Extract ZIP */

      const zip =
        new AdmZip(
          zipFile.path
        );

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

      /* Read CSV */

      const participants =
        await parseCSV(
          csvFile.path
        );

      progress.total =
        participants.length;

      const logs =
        [];

      /* Fast Mode */

      const BATCH_SIZE = 3;

      for (
        let i = 0;
        i <
        participants.length;
        i +=
          BATCH_SIZE
      ) {
        const batch =
          participants.slice(
            i,
            i +
              BATCH_SIZE
          );

        await Promise.all(
          batch.map(
            async (
              participant
            ) => {
              progress.current++;

              try {
                const name =
                  participant.name?.trim();

                const email =
                  participant.email?.trim();

                if (
                  !email ||
                  !isValidEmail(
                    email
                  )
                ) {
                  progress.failed++;

                  logs.push(
                    {
                      name,
                      email,
                      status:
                        "Invalid Email",
                    }
                  );

                  return;
                }

                const certificateName =
                  name.replace(
                    /\s+/g,
                    "_"
                  ) +
                  ".png";

                const exists =
                  extractedFiles.includes(
                    certificateName
                  );

                if (
                  !exists
                ) {
                  progress.failed++;

                  logs.push(
                    {
                      name,
                      email,
                      status:
                        "Certificate Missing",
                    }
                  );

                  return;
                }

                const certificatePath =
                  path.join(
                    extractedFolder,
                    certificateName
                  );

                const personalizedEmail =
                  emailContent.replace(
                    "{name}",
                    name
                  );

                await transporter.sendMail(
                  {
                    from:
                      process.env
                        .EMAIL_USER,

                    to:
                      email,

                    subject,

                    text:
                      personalizedEmail,

                    attachments:
                      [
                        {
                          filename:
                            certificateName,

                          path:
                            certificatePath,
                        },
                      ],
                  }
                );

                progress.success++;

                logs.push(
                  {
                    name,
                    email,
                    status:
                      "Sent",
                  }
                );

                console.log(
                  `Sent to ${email}`
                );
              } catch (
                error
              ) {
                progress.failed++;

                logs.push(
                  {
                    name:
                      participant.name,
                    email:
                      participant.email,
                    status:
                      "Email Failed",
                  }
                );

                console.error(
                  error
                );
              }
            }
          )
        );
      }

      progress.sending =
        false;

      return res.json(
        {
          success:
            true,
          message:
            "Certificates sent successfully 🚀",
          stats:
            progress,
          logs,
        }
      );
    } catch (
      error
    ) {
      console.error(
        error
      );

      progress.sending =
        false;

      return res
        .status(500)
        .json({
          success:
            false,
          message:
            "Sending failed ❌",
        });
    }
  }
);

/* -----------------------------
   Start Server
----------------------------- */

const PORT =
  process.env.PORT ||
  5000;

app.listen(
  PORT,
  () => {
    console.log(
      `Server running on port ${PORT}`
    );
  }
);