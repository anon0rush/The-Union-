import express from 'express';
import multer from 'multer';
import { MAX_IMPORT_BYTES, importDocument } from '../services/importDocument.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../utils/HttpError.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMPORT_BYTES, files: 1 },
}).single('file');

function receiveFile(req, res, next) {
  upload(req, res, (err) => {
    if (err?.code === 'LIMIT_FILE_SIZE') return next(new HttpError(413, 'Files can be at most 10 MB'));
    if (err) return next(new HttpError(400, 'The upload could not be read'));
    if (!req.file) return next(new HttpError(400, 'Choose a file to import'));
    next();
  });
}

export function importRouter() {
  const router = express.Router();

  router.post(
    '/',
    receiveFile,
    asyncHandler(async (req, res) => {
      const fileName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
      const result = await importDocument({ fileName, buffer: req.file.buffer });
      res.json(result);
    }),
  );

  return router;
}
