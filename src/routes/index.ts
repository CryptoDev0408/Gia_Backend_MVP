import { Router } from 'express';
import authRoutes from './auth.routes';
import trendsRoutes from './trends.routes';
import postsRoutes from './posts.routes';
import adminRoutes from './admin.routes';
import blogsRoutes from './blogs.routes';

const router = Router();

// Mount routes
router.use('/auth', authRoutes);
router.use('/trends', trendsRoutes);
router.use('/posts', postsRoutes);
router.use('/admin', adminRoutes);
router.use('/blogs', blogsRoutes);

// Health check
router.get('/health', (_req, res) => {
	res.json({
		success: true,
		data: {
			status: 'healthy',
			timestamp: new Date().toISOString(),
			uptime: process.uptime(),
		},
	});
});

export default router;
