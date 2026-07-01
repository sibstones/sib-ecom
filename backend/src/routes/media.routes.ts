import { Router, Request, Response, NextFunction } from 'express';
import { mediaController } from '../controllers/media.controller';

const router = Router();

router.get('*', (req: Request, res: Response, next: NextFunction) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    next();
    return;
  }

  void mediaController.streamPublicObject(req, res);
});

export default router;
