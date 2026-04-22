declare module "multer";

// Augment Express Request with multer file property to avoid needing @types/multer
declare namespace Express {
  interface Request {
    file?: any;
    files?: any;
  }
}
