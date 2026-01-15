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
 * GET /api/v1/blogs/count
 * Get counts of all blogs (draft, published, all)
 * Returns: { draft: number, published: number, all: number }
 */
router.get(
	'/count',
	asyncHandler(async (req: AuthRequest, res: any) => {
		logger.info('📊 Blog count request received');

		try {
			// Use single query with conditional sums
			const countResult = await prisma.$queryRawUnsafe<any[]>(
				`SELECT
					COUNT(*) AS cnt_all,
					SUM(CASE WHEN approved = 1 THEN 1 ELSE 0 END) AS cnt_published,
					SUM(CASE WHEN approved = 0 THEN 1 ELSE 0 END) AS cnt_draft
				FROM blogs`
			);

			if (!countResult || countResult.length === 0) {
				logger.warn('📊 No count result returned from database');
				return res.json({
					success: true,
					data: { counts: { all: 0, published: 0, draft: 0 } },
				});
			}

			// Convert BigInt to number immediately
			const row = countResult[0];
			const counts = {
				all: Number(row.cnt_all || BigInt(0)),
				published: Number(row.cnt_published || BigInt(0)),
				draft: Number(row.cnt_draft || BigInt(0))
			};

			logger.info(`📊 Blog counts calculated: draft=${counts.draft}, published=${counts.published}, all=${counts.all}`);

			res.json({
				success: true,
				data: { counts },
			});
		} catch (error) {
			logger.error('📊 Error fetching blog counts:', error);
			res.status(500).json({
				success: false,
				error: 'Failed to fetch blog counts',
				details: error instanceof Error ? error.message : 'Unknown error'
			});
		}
	})
);

/**
 * GET /api/v1/blogs
 * Get all approved blogs (published)
 * Query params: page, limit, platform, filter (draft/published/all - for admins)
 * For regular users: only approved blogs
 * For admins: can filter by draft, published, or all
 * If authenticated, includes isLiked status and likesCount for each blog
 */
router.get(
	'/',
	optionalAuth,
	asyncHandler(async (req: AuthRequest, res: any) => {

		logger.info(`📚📚📚📚📚📚📚📚📚📚📚📚📚📚📚📚📚📚📚📚📚📚📚📚📚📚📚📚📚📚📚📚📚📚📚📚📚📚📚📚📚`);

		const page = parseInt(req.query.page as string) || 1;
		const limit = parseInt(req.query.limit as string) || 20;
		const platform = req.query.platform as string;
		const filter = req.query.filter as string; // 'draft', 'published', 'all'
		const offset = (page - 1) * limit;

		// Build where clause - admins can see unapproved, regular users/guests only see approved
		const isAdmin = req.user?.role === 'ADMIN';
		const isAuthenticated = !!req.user;
		const userId = req.user?.userId;

		// Log authentication status for debugging
		logger.info(`📚 Blog request - isAuthenticated: ${isAuthenticated}, isAdmin: ${isAdmin}, role: ${req.user?.role || 'none'}, filter: ${filter}`);

		// Build where clause based on filter (admin only)
		let whereClause = 'WHERE 1=1';
		if (isAdmin && filter === 'draft') {
			whereClause += ' AND approved = 0';
		} else if (isAdmin && filter === 'published') {
			whereClause += ' AND approved = 1';
		} else if (!isAdmin) {
			// Non-admins always see only approved blogs
			whereClause += ' AND approved = 1';
		}
		// For admins with filter='all', show all blogs (1=1)

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

		// If user is authenticated, add like status and count for each blog
		if (isAuthenticated && userId) {
			// Get like counts for all blogs
			const blogIds = blogs.map(b => b.id);

			if (blogIds.length > 0) {
				// Get likes count for each blog
				const likesCountQuery = `
					SELECT blogId, COUNT(*) as likesCount 
					FROM blog_likes 
					WHERE blogId IN (${blogIds.map(() => '?').join(',')})
					GROUP BY blogId
				`;
				const likesCounts = await prisma.$queryRawUnsafe<any[]>(likesCountQuery, ...blogIds);

				// Get user's liked blogs
				const userLikesQuery = `
					SELECT blogId 
					FROM blog_likes 
					WHERE userId = ? AND blogId IN (${blogIds.map(() => '?').join(',')})
				`;
				const userLikes = await prisma.$queryRawUnsafe<any[]>(userLikesQuery, userId, ...blogIds);
				const likedBlogIds = new Set(userLikes.map((l: any) => l.blogId));

				// Map likes data to blogs
				const likesCountMap = new Map(likesCounts.map((l: any) => [l.blogId, Number(l.likesCount)]));

				blogs.forEach((blog: any) => {
					blog.likesCount = likesCountMap.get(blog.id) || 0;
					blog.isLiked = likedBlogIds.has(blog.id);
				});
			}
		} else {
			// For non-authenticated users, add likesCount but no isLiked status
			const blogIds = blogs.map(b => b.id);

			if (blogIds.length > 0) {
				const likesCountQuery = `
					SELECT blogId, COUNT(*) as likesCount 
					FROM blog_likes 
					WHERE blogId IN (${blogIds.map(() => '?').join(',')})
					GROUP BY blogId
				`;
				const likesCounts = await prisma.$queryRawUnsafe<any[]>(likesCountQuery, ...blogIds);
				const likesCountMap = new Map(likesCounts.map((l: any) => [l.blogId, Number(l.likesCount)]));

				blogs.forEach((blog: any) => {
					blog.likesCount = likesCountMap.get(blog.id) || 0;
					blog.isLiked = false;
				});
			}
		}

		// Get total count for current filter
		const countResult = await prisma.$queryRawUnsafe<any[]>(
			`SELECT COUNT(*) as total FROM blogs ${whereClause}`,
			...params
		);
		const total = Number(countResult[0].total);

		// Optimized: Get all counts in a single query using conditional SUM
		const countsResult = await prisma.$queryRawUnsafe<any[]>(
			`SELECT
				COUNT(*) AS cnt_all,
				SUM(CASE WHEN approved = 1 THEN 1 ELSE 0 END) AS cnt_published,
				SUM(CASE WHEN approved = 0 THEN 1 ELSE 0 END) AS cnt_draft
			FROM blogs`
		);

		const countsRow = countsResult[0];
		const counts = {
			all: Number(countsRow.cnt_all || BigInt(0)),
			published: Number(countsRow.cnt_published || BigInt(0)),
			draft: Number(countsRow.cnt_draft || BigInt(0))
		};

		logger.info(`📊 Counts calculated: draft=${counts.draft}, published=${counts.published}, all=${counts.all}, isAdmin=${isAdmin}`);

		logger.info(`📚 Fetching blogs: page=${page}, limit=${limit}, platform=${platform || 'all'}, filter=${filter}, found=${blogs.length}, counts=${JSON.stringify(counts)}`);

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
				counts, // Add counts for admin filter buttons
			},
		});
	})
);

/**
 * GET /api/v1/blogs/:id/comments
 * Get all comments for a blog
 */
router.get(
	'/:id/comments',
	asyncHandler(async (req: any, res: any) => {
		const { id } = req.params;
		const blogId = parseInt(id);

		logger.info(`💬 [GET COMMENTS] Request received for blog ${blogId}`);
		logger.info(`💬 [GET COMMENTS] Request params:`, req.params);
		logger.info(`💬 [GET COMMENTS] Blog ID parsed: ${blogId}`);

		try {
			// Get comments with user information
			logger.info(`💬 [GET COMMENTS] Executing query to fetch comments...`);
			const comments = await prisma.$queryRawUnsafe<any[]>(
				`SELECT 
					bc.id,
					bc.comment,
					bc.createdAt,
					bc.updatedAt,
					u.id as userId,
					u.username,
					u.email
				FROM blog_comments bc
				JOIN users u ON bc.userId = u.id
				WHERE bc.blogId = ?
				ORDER BY bc.createdAt DESC`,
				blogId
			);

			logger.info(`✅ [GET COMMENTS] Query successful. Found ${comments.length} comments`);

			const response = {
				success: true,
				data: {
					comments: comments.map(c => ({
						id: Number(c.id),
						comment: c.comment,
						createdAt: c.createdAt,
						updatedAt: c.updatedAt,
						user: {
							id: Number(c.userId),
							username: c.username,
							email: c.email,
						},
					})),
				},
			};

			logger.info(`✅ [GET COMMENTS] Sending response with ${comments.length} comments`);
			res.json(response);
		} catch (error: any) {
			logger.error(`❌ [GET COMMENTS] Error fetching comments:`, error);
			logger.error(`❌ [GET COMMENTS] Error message:`, error.message);
			logger.error(`❌ [GET COMMENTS] Error stack:`, error.stack);
			throw error;
		}
	})
);

/**
 * POST /api/v1/blogs/:id/comments
 * Add a comment to a blog (authenticated users only)
 */
router.post(
	'/:id/comments',
	authenticate,
	asyncHandler(async (req: AuthRequest, res: any) => {

		console.log('==============================================');
		console.log('📝 [POST COMMENT] New comment request received');
		console.log('📝 [POST COMMENT] Request params:', req.params);
		console.log('📝 [POST COMMENT] Request body:', req.body);
		console.log('📝 [POST COMMENT] User from token:', req.user);
		console.log('==============================================');
		const { id } = req.params;
		const blogId = parseInt(id);
		const userId = req.user!.userId;
		const { comment } = req.body;

		logger.info(`📝 [POST COMMENT] ========== NEW COMMENT REQUEST ==========`);
		logger.info(`📝 [POST COMMENT] Blog ID: ${blogId}`);
		logger.info(`📝 [POST COMMENT] Request params:`, req.params);
		logger.info(`📝 [POST COMMENT] Request body:`, req.body);
		logger.info(`📝 [POST COMMENT] Comment text: "${comment}"`);
		logger.info(`📝 [POST COMMENT] User from token: ${userId}`);
		logger.info(`📝 [POST COMMENT] req.user:`, req.user);

		// Validate comment
		if (!comment || typeof comment !== 'string' || comment.trim().length === 0) {
			logger.error(`❌ [POST COMMENT] Invalid comment: empty or not a string`);
			return res.status(400).json({
				success: false,
				error: 'Comment is required and must be a non-empty string',
			});
		}

		if (comment.length > 5000) {
			logger.error(`❌ [POST COMMENT] Comment too long: ${comment.length} characters`);
			return res.status(400).json({
				success: false,
				error: 'Comment must be less than 5000 characters',
			});
		}

		logger.info(`📝 [POST COMMENT] User ${userId} attempting to comment on blog ${blogId}`);

		// Verify blog exists
		logger.info(`📝 [POST COMMENT] Verifying blog exists...`);
		const blog = await prisma.$queryRawUnsafe<any[]>(
			`SELECT id FROM blogs WHERE id = ? LIMIT 1`,
			blogId
		);
		logger.info(`📝 [POST COMMENT] Blog query result:`, blog);

		if (blog.length === 0) {
			logger.error(`❌ [POST COMMENT] Blog ${blogId} not found`);
			return res.status(404).json({
				success: false,
				error: 'Blog not found',
			});
		}

		// Insert comment
		logger.info(`📝 [POST COMMENT] Inserting comment into database...`);
		logger.info(`📝 [POST COMMENT] Insert params: userId=${userId}, blogId=${blogId}, comment="${comment.trim()}"`);
		const result = await prisma.$executeRawUnsafe(
			`INSERT INTO blog_comments (userId, blogId, comment, createdAt, updatedAt) VALUES (?, ?, ?, NOW(), NOW())`,
			userId,
			blogId,
			comment.trim()
		);
		logger.info(`✅ [POST COMMENT] Insert result:`, result);

		// Get the inserted comment with user info
		logger.info(`📝 [POST COMMENT] Fetching inserted comment...`);
		const insertedComment = await prisma.$queryRawUnsafe<any[]>(
			`SELECT 
				bc.id,
				bc.comment,
				bc.createdAt,
				bc.updatedAt,
				u.id as userId,
				u.username,
				u.email
			FROM blog_comments bc
			JOIN users u ON bc.userId = u.id
			WHERE bc.id = LAST_INSERT_ID()
			LIMIT 1`
		);
		logger.info(`✅ [POST COMMENT] Fetched comment - ID: ${insertedComment[0]?.id}`);

		// Get total comments count
		logger.info(`📝 [POST COMMENT] Counting total comments...`);
		const commentsCount = await prisma.$queryRawUnsafe<any[]>(
			`SELECT COUNT(*) as count FROM blog_comments WHERE blogId = ?`,
			blogId
		);
		const totalComments = Number(commentsCount[0].count);
		logger.info(`✅ [POST COMMENT] Total comments: ${totalComments}`);

		logger.info(`✅ [POST COMMENT] User ${userId} commented on blog ${blogId}. Total comments: ${totalComments}`);

		const response = {
			success: true,
			data: {
				comment: insertedComment[0] ? {
					id: Number(insertedComment[0].id),
					comment: insertedComment[0].comment,
					createdAt: insertedComment[0].createdAt,
					updatedAt: insertedComment[0].updatedAt,
					user: {
						id: Number(insertedComment[0].userId),
						username: insertedComment[0].username,
						email: insertedComment[0].email,
					},
				} : null,
				totalComments: totalComments,
			},
		};

		logger.info(`✅ [POST COMMENT] Sending response - comment ID: ${response.data.comment?.id}`);
		logger.info(`📝 [POST COMMENT] ========== COMMENT REQUEST COMPLETE ==========`);

		res.json(response);
	})
);

/**
 * DELETE /api/v1/blogs/:blogId/comments/:commentId
 * Delete a comment (only by comment owner or admin)
 */
router.delete(
	'/:blogId/comments/:commentId',
	authenticate,
	asyncHandler(async (req: AuthRequest, res: any) => {
		const { blogId, commentId } = req.params;
		const userId = req.user!.userId;
		const isAdmin = req.user!.role === 'ADMIN';

		logger.info(`🗑️ [DELETE COMMENT] ========== DELETE COMMENT REQUEST ==========`);
		logger.info(`🗑️ [DELETE COMMENT] Blog ID: ${blogId}, Comment ID: ${commentId}`);
		logger.info(`🗑️ [DELETE COMMENT] User ID: ${userId}, Is Admin: ${isAdmin}`);
		logger.info(`🗑️ [DELETE COMMENT] Request params:`, req.params);

		// Get the comment
		logger.info(`🗑️ [DELETE COMMENT] Fetching comment from database...`);
		const comment = await prisma.$queryRawUnsafe<any[]>(
			`SELECT userId, blogId FROM blog_comments WHERE id = ? LIMIT 1`,
			parseInt(commentId)
		);
		logger.info(`🗑️ [DELETE COMMENT] Comment query result:`, comment);

		if (comment.length === 0) {
			logger.error(`❌ [DELETE COMMENT] Comment ${commentId} not found`);
			return res.status(404).json({
				success: false,
				error: 'Comment not found',
			});
		}

		// Check if user is authorized (owner or admin)
		const isOwner = comment[0].userId === userId;
		logger.info(`🗑️ [DELETE COMMENT] Is Owner: ${isOwner} (comment userId: ${comment[0].userId}, current userId: ${userId})`);
		logger.info(`🗑️ [DELETE COMMENT] Authorization check: isOwner=${isOwner} || isAdmin=${isAdmin}`);

		if (!isOwner && !isAdmin) {
			logger.error(`❌ [DELETE COMMENT] User ${userId} not authorized to delete comment ${commentId}`);
			return res.status(403).json({
				success: false,
				error: 'Not authorized to delete this comment',
			});
		}

		// Delete the comment
		logger.info(`🗑️ [DELETE COMMENT] Deleting comment ${commentId}...`);
		const result = await prisma.$executeRawUnsafe(
			`DELETE FROM blog_comments WHERE id = ?`,
			parseInt(commentId)
		);
		logger.info(`✅ [DELETE COMMENT] Delete result:`, result);

		logger.info(`✅ [DELETE COMMENT] User ${userId} deleted comment ${commentId}`);
		logger.info(`🗑️ [DELETE COMMENT] ========== DELETE COMMENT COMPLETE ==========`);

		res.json({
			success: true,
			data: {
				message: 'Comment deleted successfully',
			},
		});
	})
);

/**
 * GET /api/v1/blogs/:id
			logger.warn(`❌ User ${userId} unauthorized to delete comment ${commentId}`);
			return res.status(403).json({
				success: false,
				error: 'You are not authorized to delete this comment',
			});
		}

		// Delete comment
		await prisma.$executeRawUnsafe(
			`DELETE FROM blog_comments WHERE id = ?`,
			parseInt(commentId)
		);

		// Get updated comments count
		const commentsCount = await prisma.$queryRawUnsafe<any[]>(
			`SELECT COUNT(*) as count FROM blog_comments WHERE blogId = ?`,
			parseInt(blogId)
		);

		logger.info(`✅ Comment ${commentId} deleted. Remaining comments: ${commentsCount[0].count}`);

		res.json({
			success: true,
			data: {
				message: 'Comment deleted successfully',
				commentsCount: Number(commentsCount[0].count),
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
		const blogId = parseInt(id);

		logger.info(`🔍 Approving blog ${blogId} by admin user ${req.user?.userId} (role: ${req.user?.role})`);

		// Verify blog exists
		const existingBlog = await prisma.$queryRawUnsafe<any[]>(
			`SELECT id, title, approved FROM blogs WHERE id = ? LIMIT 1`,
			blogId
		);

		if (existingBlog.length === 0) {
			logger.warn(`❌ Blog ${blogId} not found`);
			return res.status(404).json({
				success: false,
				error: 'Blog not found',
			});
		}

		logger.info(`📝 Blog before approval: id=${existingBlog[0].id}, approved=${existingBlog[0].approved}`);

		// Update blog to approved
		await prisma.$executeRawUnsafe(
			`UPDATE blogs SET approved = 1 WHERE id = ?`,
			blogId
		);

		logger.info(`✅ Blog ${blogId} approved successfully by admin ${req.user?.userId}`);

		res.json({
			success: true,
			data: {
				message: 'Blog approved successfully',
				blogId: blogId
			},
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

/**
 * POST /api/v1/blogs/:id/like
 * Like a blog (authenticated users only)
 */
router.post(
	'/:id/like',
	authenticate,
	asyncHandler(async (req: AuthRequest, res: any) => {
		const { id } = req.params;
		const blogId = parseInt(id);
		const userId = req.user!.userId;

		logger.info(`❤️  User ${userId} attempting to like blog ${blogId}`);

		// Verify blog exists
		const blog = await prisma.$queryRawUnsafe<any[]>(
			`SELECT id FROM blogs WHERE id = ? LIMIT 1`,
			blogId
		);

		if (blog.length === 0) {
			logger.warn(`❌ Blog ${blogId} not found`);
			return res.status(404).json({
				success: false,
				error: 'Blog not found',
			});
		}

		try {
			// Insert like (will fail if already liked due to unique constraint)
			await prisma.$executeRawUnsafe(
				`INSERT INTO blog_likes (userId, blogId) VALUES (?, ?)`,
				userId,
				blogId
			);

			// Get updated likes count
			const likesCount = await prisma.$queryRawUnsafe<any[]>(
				`SELECT COUNT(*) as count FROM blog_likes WHERE blogId = ?`,
				blogId
			);

			logger.info(`✅ User ${userId} liked blog ${blogId}. Total likes: ${likesCount[0].count}`);

			res.json({
				success: true,
				data: {
					message: 'Blog liked successfully',
					likesCount: Number(likesCount[0].count),
				},
			});
		} catch (error: any) {
			// Check if already liked (duplicate key error)
			if (error.code === 'ER_DUP_ENTRY' || error.message?.includes('Duplicate')) {
				logger.info(`⚠️  User ${userId} already liked blog ${blogId}`);

				// Get current likes count
				const likesCount = await prisma.$queryRawUnsafe<any[]>(
					`SELECT COUNT(*) as count FROM blog_likes WHERE blogId = ?`,
					blogId
				);

				return res.status(400).json({
					success: false,
					error: 'You have already liked this blog',
					data: { likesCount: Number(likesCount[0].count) },
				});
			}
			throw error;
		}
	})
);

/**
 * DELETE /api/v1/blogs/:id/like
 * Unlike a blog (authenticated users only)
 */
router.delete(
	'/:id/like',
	authenticate,
	asyncHandler(async (req: AuthRequest, res: any) => {
		const { id } = req.params;
		const blogId = parseInt(id);
		const userId = req.user!.userId;

		logger.info(`💔 User ${userId} attempting to unlike blog ${blogId}`);

		// Verify blog exists
		const blog = await prisma.$queryRawUnsafe<any[]>(
			`SELECT id FROM blogs WHERE id = ? LIMIT 1`,
			blogId
		);

		if (blog.length === 0) {
			logger.warn(`❌ Blog ${blogId} not found`);
			return res.status(404).json({
				success: false,
				error: 'Blog not found',
			});
		}

		// Delete like (idempotent - no error if not liked)
		const result = await prisma.$executeRawUnsafe(
			`DELETE FROM blog_likes WHERE userId = ? AND blogId = ?`,
			userId,
			blogId
		);

		// Get updated likes count
		const likesCount = await prisma.$queryRawUnsafe<any[]>(
			`SELECT COUNT(*) as count FROM blog_likes WHERE blogId = ?`,
			blogId
		);

		if (result === 0) {
			logger.info(`ℹ️  User ${userId} attempted to unlike blog ${blogId} (was not liked). Total likes: ${likesCount[0].count}`);
		} else {
			logger.info(`✅ User ${userId} unliked blog ${blogId}. Total likes: ${likesCount[0].count}`);
		}

		res.json({
			success: true,
			data: {
				message: 'Blog unliked successfully',
				likesCount: Number(likesCount[0].count),
			},
		});
	})
);

export default router;
