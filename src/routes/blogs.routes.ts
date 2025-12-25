import { Router } from 'express';
import { asyncHandler } from '../middleware/error.middleware';
import { authenticate, requireAdmin, optionalAuth, AuthRequest } from '../middleware/auth.middleware';
import { ElleSource } from '../sources/elle.source';
import { HarperSource } from '../sources/harper.source';
import { NormalizationService } from '../services/normalization.service';
import { logger } from '../utils/logger';
import prisma from '../database/client';

const router = Router();

/**
 * GET /api/v1/blogs
 * Get all approved blogs (published)
 * Query params: page, limit, platform, includeUnapproved (for testing)
 * For regular users: only approved blogs
 * For admins: can see unapproved blogs with includeUnapproved param
 */
router.get(
	'/',
	optionalAuth,
	asyncHandler(async (req: AuthRequest, res: any) => {
		const page = parseInt(req.query.page as string) || 1;
		const limit = parseInt(req.query.limit as string) || 20;
		const platform = req.query.platform as string;
		const includeUnapproved = req.query.includeUnapproved === 'true';
		const offset = (page - 1) * limit;

		// Build where clause - admins can see unapproved, regular users/guests only see approved
		const isAdmin = req.user?.role === 'ADMIN';
		const isAuthenticated = !!req.user;

		// Log authentication status for debugging
		logger.info(`📚 Blog request - isAuthenticated: ${isAuthenticated}, isAdmin: ${isAdmin}, role: ${req.user?.role || 'none'}, includeUnapproved: ${includeUnapproved}`);

		// Only show unapproved blogs if user is admin AND explicitly requested
		let whereClause = (isAdmin) ? 'WHERE 1=1' : 'WHERE approved = 1';

		logger.info(`📚📚📚📚📚📚📚📚📚📚📚📚📚📚📚📚📚📚📚📚📚📚📚📚📚📚📚📚📚📚📚📚📚📚📚📚📚📚📚📚📚 ${whereClause}`);

		const params: any[] = [];

		if (platform) {
			whereClause += ` AND platform = ?`;
			params.push(platform);
		}

		// Get blogs with pagination
		const blogs = await prisma.$queryRawUnsafe<any[]>(
			`SELECT * FROM blogs 
			${whereClause}
			ORDER BY createdAt DESC 
			LIMIT ? OFFSET ?`,
			...params, limit, offset
		);

		// Get total count
		const countResult = await prisma.$queryRawUnsafe<any[]>(
			`SELECT COUNT(*) as total FROM blogs ${whereClause}`,
			...params
		);
		const total = Number(countResult[0].total);

		logger.info(`📚 Fetching blogs: page=${page}, limit=${limit}, platform=${platform || 'all'}, includeUnapproved=${includeUnapproved}, found=${blogs.length}`);

		res.json({
			success: true,
			data: {
				blogs,
				pagination: {
					page,
					limit,
					total,
					totalPages: Math.ceil(total / limit),
				},
			},
		});
	})
);

/**
 * GET /api/v1/blogs/:id
 * Get a single blog by ID
 */
router.get(
	'/:id',
	asyncHandler(async (req: any, res: any) => {
		const { id } = req.params;

		const blogs = await prisma.$queryRawUnsafe<any[]>(
			`SELECT * FROM blogs WHERE id = ? LIMIT 1`,
			parseInt(id)
		);

		if (blogs.length === 0) {
			return res.status(404).json({
				success: false,
				error: 'Blog not found',
			});
		}

		res.json({
			success: true,
			data: blogs[0],
		});
	})
);

/**
 * POST /api/v1/blogs/scrape
 * Trigger scraping workflow for Elle and Harper
 */
router.post(
	'/scrape',
	asyncHandler(async (_req: any, res: any) => {
		logger.info('🚀 Starting fashion scraping workflow (Elle + Harper)');

		try {
			let totalScraped = 0;
			let totalNormalized = 0;
			let totalSaved = 0;

			// Scrape Elle
			logger.info('📰 Scraping Elle...');
			const elleSource = new ElleSource();
			await elleSource.initialize();
			const ellePosts = await elleSource.scrape({
				keywords: ['fashion', 'style', 'runway', 'designer'],
				maxResults: 10,
				pageTimeout: 90000
			});
			totalScraped += ellePosts.length;
			logger.info(`✅ Elle: Scraped ${ellePosts.length} posts`);
			await elleSource.cleanup();

			if (ellePosts.length > 0) {
				logger.info('🤖 Normalizing Elle posts with AI...');
				const elleNormalized = await NormalizationService.normalizeWithAI(ellePosts, 'ELLE');
				totalNormalized += elleNormalized.length;
				logger.info(`✅ Elle: Normalized ${elleNormalized.length} posts`);

				logger.info('💾 Saving Elle posts to database...');
				const elleSaved = await NormalizationService.saveToBlogsTable(elleNormalized);
				totalSaved += elleSaved;
				logger.info(`✅ Elle: Saved ${elleSaved} posts to database`);
			}

			// Scrape Harper
			logger.info('📰 Scraping Harper\'s Bazaar...');
			const harperSource = new HarperSource();
			await harperSource.initialize();
			const harperPosts = await harperSource.scrape({
				keywords: ['fashion', 'style', 'runway', 'designer'],
				maxResults: 10,
				pageTimeout: 90000
			});
			totalScraped += harperPosts.length;
			logger.info(`✅ Harper: Scraped ${harperPosts.length} posts`);
			await harperSource.cleanup();

			if (harperPosts.length > 0) {
				logger.info('🤖 Normalizing Harper posts with AI...');
				const harperNormalized = await NormalizationService.normalizeWithAI(harperPosts, 'HARPER');
				totalNormalized += harperNormalized.length;
				logger.info(`✅ Harper: Normalized ${harperNormalized.length} posts`);

				logger.info('💾 Saving Harper posts to database...');
				const harperSaved = await NormalizationService.saveToBlogsTable(harperNormalized);
				totalSaved += harperSaved;
				logger.info(`✅ Harper: Saved ${harperSaved} posts to database`);
			}

			logger.info(`✅ Fashion scraping completed: ${totalScraped} scraped, ${totalNormalized} normalized, ${totalSaved} saved`);

			res.json({
				success: true,
				data: {
					message: 'Fashion scraping completed successfully',
					scraped: totalScraped,
					normalized: totalNormalized,
					saved: totalSaved,
				},
			});
		} catch (error: any) {
			logger.error('❌ Fashion scraping failed:', error);
			res.status(500).json({
				success: false,
				error: error.message || 'Scraping failed',
			});
		}
	})
);

/**
 * PATCH /api/v1/blogs/:id/approve
 * Approve a blog for publishing (admin only)
 */
router.patch(
	'/:id/approve',
	authenticate,
	requireAdmin,
	asyncHandler(async (req: AuthRequest, res: any) => {
		const { id } = req.params;

		await prisma.$executeRawUnsafe(
			`UPDATE blogs SET approved = 1 WHERE id = ?`,
			parseInt(id)
		);

		logger.info(`✅ Blog ${id} approved`);

		res.json({
			success: true,
			data: { message: 'Blog approved successfully' },
		});
	})
);

/**
 * PATCH /api/v1/blogs/approve-all
 * Approve all unapproved blogs (for testing)
 */
router.patch(
	'/approve-all',
	authenticate,
	requireAdmin,
	asyncHandler(async (_req: AuthRequest, res: any) => {
		const result = await prisma.$executeRawUnsafe(
			`UPDATE blogs SET approved = 1 WHERE approved = 0`
		);

		logger.info(`✅ Approved all blogs (affected rows: ${result})`);

		res.json({
			success: true,
			data: {
				message: 'All blogs approved successfully',
				affected: result
			},
		});
	})
);

/**
 * DELETE /api/v1/blogs/:id
 * Delete a blog (admin only)
 */
router.delete(
	'/:id',
	authenticate,
	requireAdmin,
	asyncHandler(async (req: AuthRequest, res: any) => {
		const { id } = req.params;

		await prisma.$executeRawUnsafe(
			`DELETE FROM blogs WHERE id = ?`,
			parseInt(id)
		);

		logger.info(`🗑️  Blog ${id} deleted by admin ${req.user?.userId}`);

		res.json({
			success: true,
			data: { message: 'Blog deleted successfully' },
		});
	})
);

export default router;
