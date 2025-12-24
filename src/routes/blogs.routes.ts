import { Router } from 'express';
import { asyncHandler } from '../middleware/error.middleware';
import { ElleSource } from '../sources/elle.source';
import { HarperSource } from '../sources/harper.source';
import { NormalizationService } from '../services/normalization.service';
import { logger } from '../utils/logger';
import prisma from '../database/client';

const router = Router();

/**
 * GET /api/v1/blogs
 * Get all approved blogs (published)
 */
router.get(
	'/',
	asyncHandler(async (req: any, res: any) => {
		const page = parseInt(req.query.page as string) || 1;
		const limit = parseInt(req.query.limit as string) || 20;
		const platform = req.query.platform as string;
		const offset = (page - 1) * limit;

		// Build where clause
		const where: any = { approved: 1 };
		if (platform) {
			where.platform = platform;
		}

		// Get blogs with pagination
		const blogs = await prisma.$queryRawUnsafe<any[]>(
			`SELECT * FROM blogs 
			WHERE approved = ? ${platform ? 'AND platform = ?' : ''}
			ORDER BY createdAt DESC 
			LIMIT ? OFFSET ?`,
			...(platform ? [1, platform, limit, offset] : [1, limit, offset])
		);

		// Get total count
		const countResult = await prisma.$queryRawUnsafe<any[]>(
			`SELECT COUNT(*) as total FROM blogs WHERE approved = ? ${platform ? 'AND platform = ?' : ''}`,
			...(platform ? [1, platform] : [1])
		);
		const total = Number(countResult[0].total);

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
			await elleSource.cleanup();

			if (ellePosts.length > 0) {
				logger.info('🤖 Normalizing Elle posts...');
				const elleNormalized = await NormalizationService.normalizeWithAI(ellePosts, 'ELLE');
				totalNormalized += elleNormalized.length;

				logger.info('💾 Saving Elle posts to database...');
				await NormalizationService.saveToBlogsTable(elleNormalized);
				totalSaved += elleNormalized.length;
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
			await harperSource.cleanup();

			if (harperPosts.length > 0) {
				logger.info('🤖 Normalizing Harper posts...');
				const harperNormalized = await NormalizationService.normalizeWithAI(harperPosts, 'HARPER');
				totalNormalized += harperNormalized.length;

				logger.info('💾 Saving Harper posts to database...');
				await NormalizationService.saveToBlogsTable(harperNormalized);
				totalSaved += harperNormalized.length;
			}

			logger.info('✅ Fashion scraping completed successfully');

			res.json({
				success: true,
				data: {
					message: 'Fashion scraping completed',
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

export default router;
