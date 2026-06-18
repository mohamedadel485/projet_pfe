import multer from "multer";
import fs from "fs";
import path from "path";

const uploadsRoot = path.resolve(__dirname, "..", "..", "uploads");

export const avatarsDir = path.join(uploadsRoot, "avatars");
export const statusPageLogosDir = path.join(uploadsRoot, "status-pages");

if (!fs.existsSync(avatarsDir)) {
  fs.mkdirSync(avatarsDir, { recursive: true });
}

if (!fs.existsSync(statusPageLogosDir)) {
  try {
    fs.mkdirSync(statusPageLogosDir, { recursive: true });
  } catch {
    // Ignore directory creation issues.
  }
}

const avatarStorage = multer.diskStorage({
  destination: (
    _req: Express.Request,
    _file: Express.Multer.File,
    cb: (error: Error | null, destination: string) => void,
  ) => cb(null, avatarsDir),
  filename: (
    _req: Express.Request,
    file: Express.Multer.File,
    cb: (error: Error | null, filename: string) => void,
  ) => {
    const ext = path.extname(file?.originalname || "") || "";
    const safeName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, safeName);
  },
});

const logoStorage = multer.diskStorage({
  destination: (
    _req: Express.Request,
    _file: Express.Multer.File,
    cb: (error: Error | null, destination: string) => void,
  ) => cb(null, statusPageLogosDir),
  filename: (
    _req: Express.Request,
    file: Express.Multer.File,
    cb: (error: Error | null, filename: string) => void,
  ) => {
    const ext = path.extname(file?.originalname || "") || "";
    const safeName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, safeName);
  },
});

export const avatarUpload = multer({ storage: avatarStorage });
export const statusPageLogoUpload = multer({ storage: logoStorage });
export { uploadsRoot };
