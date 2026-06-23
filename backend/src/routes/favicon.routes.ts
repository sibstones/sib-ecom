import { Router } from 'express';
import { faviconController } from '../controllers/favicon.controller';

const router = Router();

router.get('/favicon.ico', faviconController.getFavicon.bind(faviconController));
router.get('/favicon.svg', faviconController.getFaviconSvg.bind(faviconController));
router.get('/apple-touch-icon.png', faviconController.getAppleTouchIcon.bind(faviconController));

export default router;
