import { Router } from 'express';
import { query } from 'express-validator';
import prisma from '../database/client';
import { asyncHandler } from '../middleware/error.middleware';
import { optionalAuth, AuthRequest } from '../middleware/auth.middleware';

const router = Router();

/**
 * GET /api/v1/trends
 * Get all active trend clusters with posts
 */
router.get(
	'/',
	optionalAuth,
	query('limit').optional().isInt({ min: 1, max: 100 }),
	query('offset').optional().isInt({ min: 0 }),
	query('sortBy').optional().isIn(['trendScore', 'growthPercentage', 'createdAt']),
	asyncHandler(async (req: AuthRequest, res: any) => {
		const limit = parseInt(req.query.limit as string) || 10;
		const offset = parseInt(req.query.offset as string) || 0;
		const sortBy = (req.query.sortBy as string) || 'trendScore';

		const clusters = await prisma.trendCluster.findMany({
			where: { isActive: true },
			take: limit,
			skip: offset,
			orderBy: { [sortBy]: 'desc' },
			include: {
				posts: {
					take: 1,
					orderBy: { viralityScore: 'desc' },
					include: {
						likes: req.user ? { where: { userId: req.user.userId } } : false,
						saves: req.user ? { where: { userId: req.user.userId } } : false,
						_count: {
							select: {
								likes: true,
								comments: true,
								saves: true,
							},
						},
					},
				},
			},
		});

		const total = await prisma.trendCluster.count({
			where: { isActive: true },
		});

		res.json({
			success: true,
			data: {
				trends: clusters.map(cluster => ({
					id: cluster.id,
					title: cluster.title,
					aiInsight: cluster.aiInsight,
					trendScore: cluster.trendScore,
					growthPercentage: cluster.growthPercentage,
					clusteredHashtags: cluster.commonHashtags,
					post: cluster.posts[0] ? {
						id: cluster.posts[0].id,
						platform: cluster.posts[0].platform,
						text: cluster.posts[0].cleanedText,
						hashtags: cluster.posts[0].hashtags,
						engagement: {
							likes: cluster.posts[0]._count.likes,
							comments: cluster.posts[0]._count.comments,
							shares: cluster.posts[0].sharesCount,
						},
						timestamp: cluster.posts[0].postedAt,
						author: cluster.posts[0].author,
						authorHandle: cluster.posts[0].authorHandle,
						imageUrl: Array.isArray(cluster.posts[0].mediaUrls) && cluster.posts[0].mediaUrls.length > 0
							? cluster.posts[0].mediaUrls[0]
							: null,
						viralityScore: cluster.posts[0].viralityScore,
						relevanceScore: cluster.posts[0].relevanceScore,
						isLiked: cluster.posts[0].likes?.length > 0,
						isSaved: cluster.posts[0].saves?.length > 0,
					} : null,
				})),
				pagination: {
					total,
					limit,
					offset,
					hasMore: offset + limit < total,
				},
			},
		});
	})
);

/**
 * GET /api/v1/trends/:id
 * Get single trend cluster with all posts
 */
router.get(
	'/:id',
	optionalAuth,
	asyncHandler(async (req: AuthRequest, res: any) => {
		const { id } = req.params;

		const cluster = await prisma.trendCluster.findUnique({
			where: { id },
			include: {
				posts: {
					orderBy: { viralityScore: 'desc' },
					include: {
						likes: req.user ? { where: { userId: req.user.userId } } : false,
						saves: req.user ? { where: { userId: req.user.userId } } : false,
						_count: {
							select: {
								likes: true,
								comments: true,
								saves: true,
							},
						},
					},
				},
			},
		});

		if (!cluster) {
			return res.status(404).json({
				success: false,
				error: 'Trend not found',
			});
		}

		res.json({
			success: true,
			data: {
				id: cluster.id,
				title: cluster.title,
				aiInsight: cluster.aiInsight,
				trendScore: cluster.trendScore,
				growthPercentage: cluster.growthPercentage,
				clusteredHashtags: cluster.commonHashtags,
				posts: cluster.posts.map(post => ({
					id: post.id,
					platform: post.platform,
					text: post.cleanedText,
					hashtags: post.hashtags,
					engagement: {
						likes: post._count.likes,
						comments: post._count.comments,
						shares: post.sharesCount,
					},
					timestamp: post.postedAt,
					author: post.author,
					authorHandle: post.authorHandle,
					mediaUrls: post.mediaUrls,
					viralityScore: post.viralityScore,
					relevanceScore: post.relevanceScore,
					isLiked: post.likes?.length > 0,
					isSaved: post.saves?.length > 0,
				})),
			},
		});
	})
);

export default router;
