import { Router } from 'express';
import { sitemapController } from '../controllers/sitemap.controller';

const router = Router();

router.get('/sitemap.xml', sitemapController.getIndex.bind(sitemapController));
router.get('/sitemap-static.xml', sitemapController.getStatic.bind(sitemapController));
router.get('/sitemap-products.xml', sitemapController.getProducts.bind(sitemapController));
router.get('/sitemap-products-:chunk(\\d+).xml', sitemapController.getProducts.bind(sitemapController));
router.get('/sitemap-blog.xml', sitemapController.getBlog.bind(sitemapController));
router.get('/sitemap-lookbook.xml', sitemapController.getLookbook.bind(sitemapController));
router.get('/robots.txt', sitemapController.getRobots.bind(sitemapController));

export default router;
