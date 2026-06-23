import { Request, Response } from 'express';
import { blogService } from '../services/blog.service';
import { CreateBlogPostDto, UpdateBlogPostDto, UpdateBlogSettingsDto, BlogCategoryDto, BlogAuthorDto } from '../types/blog';

export class BlogController {
  async getAllCategories(_req: Request, res: Response): Promise<void> {
    try {
      const categories = await blogService.getAllCategories();
      res.json({ categories });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get blog categories',
      });
    }
  }

  async getAllAuthors(_req: Request, res: Response): Promise<void> {
    try {
      const authors = await blogService.getAllAuthors();
      res.json({ authors });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get blog authors',
      });
    }
  }

  // Blog Posts
  async getAllPosts(req: Request, res: Response): Promise<void> {
    try {
      const activeOnly = req.query.active === 'true';
      const languageCode = req.query.languageCode as string | undefined;
      const posts = await blogService.getAllPosts(activeOnly, languageCode);
      res.json({ posts });
    } catch (error) {
      console.error('Error in blogController.getAllPosts:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get blog posts',
      });
    }
  }

  async getPostBySlug(req: Request, res: Response): Promise<void> {
    try {
      const slug = req.params.slug;
      const languageCode = req.query.languageCode as string | undefined;
      const post = await blogService.getPostBySlug(slug, languageCode);
      
      if (!post) {
        res.status(404).json({ error: 'Blog post not found' });
        return;
      }

      res.json({ post });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get blog post',
      });
    }
  }

  async getPostById(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.id;
      const post = await blogService.getPostById(id);
      
      if (!post) {
        res.status(404).json({ error: 'Blog post not found' });
        return;
      }

      res.json({ post });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get blog post',
      });
    }
  }

  async createPost(req: Request, res: Response): Promise<void> {
    try {
      const data: CreateBlogPostDto = req.body;
      const authorId = (req as any).user?.id;
      const post = await blogService.createPost(data, authorId);
      res.status(201).json({ post });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to create blog post',
      });
    }
  }

  async updatePost(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.id;
      const data: UpdateBlogPostDto = req.body;
      const post = await blogService.updatePost(id, data);
      res.json({ post });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to update blog post',
      });
    }
  }

  async deletePost(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.id;
      await blogService.deletePost(id);
      res.json({ message: 'Blog post deleted successfully' });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to delete blog post',
      });
    }
  }

  async incrementViews(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.id;
      await blogService.incrementViews(id);
      res.json({ message: 'Views incremented' });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to increment views',
      });
    }
  }

  // Blog Settings
  async getSettings(req: Request, res: Response): Promise<void> {
    try {
      const languageCode = req.query.languageCode as string | undefined;
      const settings = await blogService.getSettings(languageCode);
      res.json({ settings });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get blog settings',
      });
    }
  }

  async updateSettings(req: Request, res: Response): Promise<void> {
    try {
      const data: UpdateBlogSettingsDto = req.body;
      const updatedBy = (req as any).user?.id;
      const settings = await blogService.updateSettings(data, updatedBy);
      res.json({ settings });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to update blog settings',
      });
    }
  }

  async createCategory(req: Request, res: Response): Promise<void> {
    try {
      const data: BlogCategoryDto = req.body;
      const category = await blogService.createCategory(data);
      res.status(201).json({ category });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to create blog category',
      });
    }
  }

  async updateCategory(req: Request, res: Response): Promise<void> {
    try {
      const category = await blogService.updateCategory(req.params.id, req.body);
      res.json({ category });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to update blog category',
      });
    }
  }

  async deleteCategory(req: Request, res: Response): Promise<void> {
    try {
      await blogService.deleteCategory(req.params.id);
      res.json({ message: 'Blog category deleted successfully' });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to delete blog category',
      });
    }
  }

  async createAuthor(req: Request, res: Response): Promise<void> {
    try {
      const data: BlogAuthorDto = req.body;
      const author = await blogService.createAuthor(data);
      res.status(201).json({ author });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to create blog author',
      });
    }
  }

  async updateAuthor(req: Request, res: Response): Promise<void> {
    try {
      const author = await blogService.updateAuthor(req.params.id, req.body);
      res.json({ author });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to update blog author',
      });
    }
  }

  async deleteAuthor(req: Request, res: Response): Promise<void> {
    try {
      await blogService.deleteAuthor(req.params.id);
      res.json({ message: 'Blog author deleted successfully' });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to delete blog author',
      });
    }
  }
}

export const blogController = new BlogController();
