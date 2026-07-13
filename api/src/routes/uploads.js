import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { requireAuth } from "../middleware/auth.js";
import { isSupabaseStorageConfigured, uploadImageToSupabaseStorage } from "../data/supabaseStore.js";
import { companyStoragePath, companyStorageSegment } from "../tenancy/company.js";
import { persistCompanyStore, userRepository } from "../data/store.js";

const router = express.Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const uploadsDir = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.resolve(__dirname, "../../uploads");

const imageTypes = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
  ["image/gif", ".gif"],
]);
const allowedExtensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

function requireProductUploader(req, res, next) {
  if (!["admin", "company_admin", "manager", "employee", "staff"].includes(req.user?.role)) {
    return res.status(403).json({ message: "Admin or employee access required." });
  }

  return next();
}

function getBoundary(contentType = "") {
  const match = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  return match?.[1] || match?.[2] || "";
}

function safeFilename(filename, contentType) {
  const extensionFromName = path.extname(filename || "").toLowerCase();
  const extension =
    allowedExtensions.has(extensionFromName)
      ? extensionFromName.replace(".jpeg", ".jpg")
      : imageTypes.get(contentType);

  if (!extension) {
    return "";
  }

  const baseName = path
    .basename(filename || "upload", extensionFromName)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48);

  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return `${baseName || "image"}-${unique}${extension}`;
}

function parseMultipartImages(body, boundary) {
  const boundaryBuffer = Buffer.from(`--${boundary}`);
  const headerSeparator = Buffer.from("\r\n\r\n");
  let cursor = body.indexOf(boundaryBuffer);
  const uploads = [];

  while (cursor !== -1) {
    let headerStart = cursor + boundaryBuffer.length;

    if (body.slice(headerStart, headerStart + 2).toString() === "--") {
      break;
    }

    if (body[headerStart] === 13 && body[headerStart + 1] === 10) {
      headerStart += 2;
    }

    const headerEnd = body.indexOf(headerSeparator, headerStart);
    if (headerEnd === -1) {
      break;
    }

    const headers = body.slice(headerStart, headerEnd).toString("utf8");
    const nextBoundary = body.indexOf(boundaryBuffer, headerEnd + headerSeparator.length);
    if (nextBoundary === -1) {
      break;
    }

    const filename = headers.match(/filename="([^"]+)"/i)?.[1];
    if (filename) {
      const contentType =
        headers.match(/content-type:\s*([^\r\n]+)/i)?.[1]?.trim().toLowerCase() || "";
      let dataEnd = nextBoundary;

      if (body[dataEnd - 2] === 13 && body[dataEnd - 1] === 10) {
        dataEnd -= 2;
      }

      uploads.push({
        contentType,
        filename,
        data: body.slice(headerEnd + headerSeparator.length, dataEnd),
      });
    }

    cursor = nextBoundary;
  }

  return uploads;
}

function buildPublicUrl(req, relativePath) {
  const configuredPublicApiUrl = process.env.PUBLIC_API_URL?.trim().replace(/\/+$/, "");
  if (configuredPublicApiUrl) {
    return `${configuredPublicApiUrl}/uploads/${relativePath}`;
  }

  const forwardedProtocol = req.headers["x-forwarded-proto"]?.split(",")[0]?.trim();
  const protocol = forwardedProtocol || req.protocol;
  return `${protocol}://${req.get("host")}/uploads/${relativePath}`;
}

function requiresPersistentStorage() {
  return process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);
}

function hasLocalPersistentStorage() {
  return Boolean(process.env.UPLOADS_DIR?.trim());
}

router.post(
  "/",
  requireAuth,
  requireProductUploader,
  express.raw({
    limit: "8mb",
    type: (req) => req.headers["content-type"]?.startsWith("multipart/form-data"),
  }),
  async (req, res) => {
    const boundary = getBoundary(req.headers["content-type"]);
    const uploads = boundary ? parseMultipartImages(req.body, boundary) : [];

    if (!uploads.length) {
      return res.status(400).json({ message: "No image file was uploaded." });
    }

    const useSupabaseStorage = isSupabaseStorageConfigured();

    if (!useSupabaseStorage && requiresPersistentStorage() && !hasLocalPersistentStorage()) {
      return res.status(500).json({
        message: "Persistent image storage is not configured. Set UPLOADS_DIR for VPS local storage or configure remote storage.",
      });
    }

    const companyUploadDir = path.join(uploadsDir, companyStorageSegment(req.companyId));
    if (!useSupabaseStorage) fs.mkdirSync(companyUploadDir, { recursive: true });

    const savedFiles = [];

    for (const upload of uploads) {
      if (!imageTypes.has(upload.contentType)) {
        return res.status(400).json({ message: "Only JPG, PNG, WEBP, and GIF images are allowed." });
      }

      const filename = safeFilename(upload.filename, upload.contentType);
      if (!filename) {
        return res.status(400).json({ message: "Unsupported image file type." });
      }

      if (useSupabaseStorage) {
        savedFiles.push(
          await uploadImageToSupabaseStorage({
            companyId: req.companyId,
            filename,
            contentType: upload.contentType,
            data: upload.data,
          }),
        );
      } else {
        const relativePath = companyStoragePath(req.companyId, filename);
        fs.writeFileSync(path.join(companyUploadDir, filename), upload.data);
        savedFiles.push({
          path: `/uploads/${relativePath}`,
          url: buildPublicUrl(req, relativePath),
        });
      }
    }

    res.status(201).json({
      ...savedFiles[0],
      files: savedFiles,
    });
  },
);

router.post(
  "/avatar",
  requireAuth,
  express.raw({
    limit: "4mb",
    type: (req) => req.headers["content-type"]?.startsWith("multipart/form-data"),
  }),
  async (req, res) => {
    const boundary = getBoundary(req.headers["content-type"]);
    const uploads = boundary ? parseMultipartImages(req.body, boundary) : [];

    if (!uploads.length) {
      return res.status(400).json({ message: "No image file was uploaded." });
    }

    const useSupabaseStorage = isSupabaseStorageConfigured();

    if (!useSupabaseStorage && requiresPersistentStorage() && !hasLocalPersistentStorage()) {
      return res.status(500).json({
        message: "Persistent image storage is not configured.",
      });
    }

    const companyUploadDir = path.join(uploadsDir, companyStorageSegment(req.companyId));
    if (!useSupabaseStorage) fs.mkdirSync(companyUploadDir, { recursive: true });

    const upload = uploads[0];
    if (!imageTypes.has(upload.contentType)) {
      return res.status(400).json({ message: "Only JPG, PNG, WEBP, and GIF images are allowed." });
    }

    const filename = `avatar-${req.user.id}-${Date.now()}${safeFilename(upload.filename, upload.contentType).slice(-10)}`;
    if (!filename) {
      return res.status(400).json({ message: "Unsupported image file type." });
    }

    let savedFile;
    if (useSupabaseStorage) {
      savedFile = await uploadImageToSupabaseStorage({
        companyId: req.companyId,
        filename,
        contentType: upload.contentType,
        data: upload.data,
      });
    } else {
      const relativePath = companyStoragePath(req.companyId, filename);
      fs.writeFileSync(path.join(companyUploadDir, filename), upload.data);
      savedFile = {
        path: `/uploads/${relativePath}`,
        url: buildPublicUrl(req, relativePath),
      };
    }

    const avatarUrl = savedFile.url || savedFile.path || "";
    userRepository.updateForCompany(req.companyId, req.user.id, { avatarUrl });
    await persistCompanyStore(req.companyId);

    res.status(201).json({ url: avatarUrl });
  },
);

export default router;


