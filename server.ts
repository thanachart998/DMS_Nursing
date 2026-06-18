import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import multer from "multer";
import os from "os";
import fs from "fs";
import { google } from "googleapis";
import { Readable } from "stream";
import { file } from "googleapis/build/src/apis/file";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Use a simple proxy-aware trust setting
  app.set("trust proxy", 1);

  app.use(express.json());

  const uploadDir = os.tmpdir();
  const upload = multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => {
        cb(null, uploadDir);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, file.fieldname + "-" + uniqueSuffix + "-" + file.originalname);
      },
    }),
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
  });

  // API สำหรับอัพโหลดไฟล์ไปยัง Google Drive ผ่าน Service Account
  app.post(
    "/api/drive/upload",
    upload.single("file"),
    async (req, res, next) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: "No file uploaded" });
        }

        const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
        const privateKey = process.env.GOOGLE_PRIVATE_KEY;
        const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

        console.log(clientEmail);
        console.log(privateKey);
        console.log(folderId);

        if (!clientEmail || !privateKey || !folderId) {
          // Cleanup file if error occurs
          if (req.file.path) {
            fs.unlink(req.file.path, () => {});
          }
          return res.status(500).json({
            error:
              "Server configuration missing: Please check GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY, and GOOGLE_DRIVE_FOLDER_ID in environment variables.",
          });
        }

        // Authentication ด้วย Service Account
        const auth = new google.auth.GoogleAuth({
          credentials: {
            client_email: clientEmail,
            private_key: privateKey.replace(/\\n/g, "\n"),
          },
          scopes: ["https://www.googleapis.com/auth/drive"],
        });

        const drive = google.drive({ version: "v3", auth });

        // กำหนดข้อมูลไฟล์และ Folder ปลายทาง
        const fileMetadata = {
          name: req.body.filename || req.file.originalname,
          parents: [folderId],
        };

        const media = {
          mimeType: req.file.mimetype,
          body: fs.createReadStream(req.file.path),
        };

        // อัพโหลดไฟล์ขึน Google Drive
        const file = await drive.files.create({
          requestBody: fileMetadata,
          media: media,
          fields: "id, webViewLink, webContentLink",
          supportsAllDrives: true,
        } as any);

        const fileId = file.data.id as string;

        // ตั้งค่า Permission ให้ Anyone with the link can view
        await drive.permissions.create({
          fileId: fileId,
          requestBody: {
            role: "reader",
            type: "anyone",
          },
          supportsAllDrives: true, // Add this line
        });
        
        // ลบไฟล์ชั่วคราวที่เก็บอยู่ในเซิร์ฟเวอร์
        fs.unlink(req.file.path, (err) => {
          if (err) console.error("Error deleting temp file:", err);
        });

        console.log(`File uploaded successfully: ${file.data.webViewLink}`);
        // ส่ง URL กลับไปให้ Frontend
        res.json({
          url: file.data.webViewLink,
          fileId: fileId,
          success: true,
        });
      } catch (error: any) {
        // ลบไฟล์ชั่วคราวกรณีเกิดข้อผิดพลาด
        if (req.file && req.file.path) {
          fs.unlink(req.file.path, () => {});
        }
        console.error("🚀 Drive upload error:", error);

        res.status(500).json({
          error: "อัพโหลดไฟล์ไม่สำเร็จ: " + (error.message || "Unknown error"),
        });
      }
    },
  );

  // Vite middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Global Error Handler
  app.use(
    (
      err: any,
      req: express.Request,
      res: express.Response,
      next: express.NextFunction,
    ) => {
      console.error("Unhandled error:", err);
      res
        .status(err.status || 500)
        .json({ error: err.message || "Internal Server Error" });
    },
  );

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("FAILED TO START SERVER:", err);
  process.exit(1);
});
