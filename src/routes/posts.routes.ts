import { Router } from 'express';
import { body, param } from 'express-validator';
import prisma from '../database/client';
import { asyncHandler } from '../middleware/error.middleware';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * POST /api/v1/posts/:id/like
 * Like a post
 */
router.post(
	'/:id/like',
	param('id').isUUID(),
	asyncHandler(async (req: AuthRequest, res: any) => {
		const { id } = req.params;
		const userId = req.user!.userId;

		// Check if post exists
		const post = await prisma.normalizedPost.findUnique({
			where: { id },
		});

		if (!post) {
			return res.status(404).json({
				success: false,
				error: 'Post not found',
			});
		}

		// Toggle like
		const existing = await prisma.postLike.findUnique({
			where: {
				userId_postId: {
					userId,
					postId: id,
				},
			},
		});

		if (existing) {
			// Unlike
			await prisma.postLike.delete({
				where: { id: existing.id },
			});

			res.json({
				success: true,
				data: { liked: false },
			});
		} else {
			// Like
			await prisma.postLike.create({
				data: {
					userId,
					postId: id,
				},
			});

			res.json({
				success: true,
				data: { liked: true },
			});
		}
	})
);

/**
 * POST /api/v1/posts/:id/save
 * Save a post
 */
router.post(
	'/:id/save',
	param('id').isUUID(),
	asyncHandler(async (req: AuthRequest, res: any) => {
		const { id } = req.params;
		const userId = req.user!.userId;

		// Check if post exists
		const post = await prisma.normalizedPost.findUnique({
			where: { id },
		});

		if (!post) {
			return res.status(404).json({
				success: false,
				error: 'Post not found',
			});
		}

		// Toggle save
		const existing = await prisma.postSave.findUnique({
			where: {
				userId_postId: {
					userId,
					postId: id,
				},
			},
		});

		if (existing) {
			// Unsave
			await prisma.postSave.delete({
				where: { id: existing.id },
			});

			res.json({
				success: true,
				data: { saved: false },
			});
		} else {
			// Save
			await prisma.postSave.create({
				data: {
					userId,
					postId: id,
				},
			});

			res.json({
				success: true,
				data: { saved: true },
			});
		}
	})
);

/**
 * POST /api/v1/posts/:id/comment
 * Add a comment to a post
 */
router.post(
	'/:id/comment',
	param('id').isUUID(),
	body('content').isString().isLength({ min: 1, max: 500 }),
	asyncHandler(async (req: AuthRequest, res: any) => {
		const { id } = req.params;
		const { content } = req.body;
		const userId = req.user!.userId;

		// Check if post exists
		const post = await prisma.normalizedPost.findUnique({
			where: { id },
		});

		if (!post) {
			return res.status(404).json({
				success: false,
				error: 'Post not found',
			});
		}

		// Create comment
		const comment = await prisma.postComment.create({
			data: {
				userId,
				postId: id,
				content,
			},
			include: {
				user: {
					select: {
						id: true,
						username: true,
						displayName: true,
						avatarUrl: true,
					},
				},
			},
		});

		res.status(201).json({
			success: true,
			data: comment,
		});
	})
);

/**
 * GET /api/v1/posts/:id/comments
 * Get comments for a post
 */
router.get(
	'/:id/comments',
	param('id').isUUID(),
	asyncHandler(async (req: AuthRequest, res: any) => {
		const { id } = req.params;

		const comments = await prisma.postComment.findMany({
			where: { postId: id },
			orderBy: { createdAt: 'desc' },
			include: {
				user: {
					select: {
						id: true,
						username: true,
						displayName: true,
						avatarUrl: true,
					},
				},
			},
		});

		res.json({
			success: true,
			data: comments,
		});
	})
);

/**
 * GET /api/v1/posts/saved
 * Get user's saved posts
 */
router.get(
	'/saved',
	asyncHandler(async (req: AuthRequest, res: any) => {
		const userId = req.user!.userId;

		const savedPosts = await prisma.postSave.findMany({
			where: { userId },
			orderBy: { createdAt: 'desc' },
			include: {
				post: {
					include: {
						cluster: true,
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

		res.json({
			success: true,
			data: savedPosts.map(save => ({
				...save.post,
				cluster: save.post.cluster,
				engagement: {
					likes: save.post._count.likes,
					comments: save.post._count.comments,
					shares: save.post.sharesCount,
				},
				savedAt: save.createdAt,
			})),
		});
	})
);

export default router;
