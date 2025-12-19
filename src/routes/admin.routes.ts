import { Router } from 'express';
import { asyncHandler } from '../middleware/error.middleware';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth.middleware';
import { CronScheduler } from '../jobs/cron.scheduler';
import prisma from '../database/client';

const router = Router();

// All admin routes require authentication and admin role
router.use(authenticate);
router.use(requireAdmin);

/**
 * POST /api/v1/admin/scrape/trigger
 * Manually trigger scraping pipeline
 */
router.post(
	'/scrape/trigger',
	asyncHandler(async (req: AuthRequest, res: any) => {
		const result = await CronScheduler.runManual();

		res.json({
			success: true,
			data: result,
		});
	})
);

/**
 * GET /api/v1/admin/stats
 * Get system statistics
 */
router.get(
	'/stats',
	asyncHandler(async (req: AuthRequest, res: any) => {
		const [
			totalUsers,
			totalPosts,
			totalClusters,
			activeClusters,
			recentJobs,
		] = await Promise.all([
			prisma.user.count(),
			prisma.normalizedPost.count(),
			prisma.trendCluster.count(),
			prisma.trendCluster.count({ where: { isActive: true } }),
			prisma.scrapingJob.findMany({
				orderBy: { createdAt: 'desc' },
				take: 10,
			}),
		]);

		res.json({
			success: true,
			data: {
				users: totalUsers,
				posts: totalPosts,
				clusters: {
					total: totalClusters,
					active: activeClusters,
				},
				recentJobs,
			},
		});
	})
);

/**
 * GET /api/v1/admin/jobs
 * Get scraping job history
 */
router.get(
	'/jobs',
	asyncHandler(async (req: AuthRequest, res: any) => {
		const jobs = await prisma.scrapingJob.findMany({
			orderBy: { createdAt: 'desc' },
			take: 50,
		});

		res.json({
			success: true,
			data: jobs,
		});
	})
);

/**
 * DELETE /api/v1/admin/clusters/:id
 * Delete a cluster
 */
router.delete(
	'/clusters/:id',
	asyncHandler(async (req: AuthRequest, res: any) => {
		const { id } = req.params;

		await prisma.trendCluster.delete({
			where: { id },
		});

		res.json({
			success: true,
			data: { deleted: true },
		});
	})
);

export default router;
