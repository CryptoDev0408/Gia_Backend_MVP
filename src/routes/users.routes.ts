import { Router } from 'express';
import { asyncHandler } from '../middleware/error.middleware';
import { authenticate } from '../middleware/auth.middleware';
import prisma from '../database/client';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /api/v1/users
 * Get all users (Admin only)
 * Returns only safe fields: id, email, username
 */
router.get(
	'/',
	authenticate,
	asyncHandler(async (req: any, res: any) => {
		const userId = req.user?.userId;
		const userRole = req.user?.role;

		// Verify admin access
		if (userRole !== 'ADMIN') {
			logger.warn(`❌ Non-admin user ${userId} attempted to access users list`);
			return res.status(403).json({
				success: false,
				error: 'Access denied. Admin privileges required.',
			});
		}

		// Fetch users with only safe fields
		const users = await prisma.$queryRawUnsafe<any[]>(
			`SELECT id, email, username FROM users ORDER BY id ASC`
		);

		logger.info(`👥 Admin ${userId} fetched ${users.length} users`);

		res.json({
			success: true,
			data: {
				users,
			},
		});
	})
);

/**
 * DELETE /api/v1/users/:id
 * Delete a user by ID (Admin only)
 */
router.delete(
	'/:id',
	authenticate,
	asyncHandler(async (req: any, res: any) => {
		const userId = req.user?.userId;
		const userRole = req.user?.role;
		const targetUserId = parseInt(req.params.id);

		// Verify admin access
		if (userRole !== 'ADMIN') {
			logger.warn(`❌ Non-admin user ${userId} attempted to delete user ${targetUserId}`);
			return res.status(403).json({
				success: false,
				error: 'Access denied. Admin privileges required.',
			});
		}

		// Prevent admin from deleting themselves
		if (userId === targetUserId) {
			logger.warn(`❌ Admin ${userId} attempted to delete themselves`);
			return res.status(400).json({
				success: false,
				error: 'Cannot delete your own account.',
			});
		}

		// Check if user exists
		const userExists = await prisma.$queryRawUnsafe<any[]>(
			`SELECT id FROM users WHERE id = ? LIMIT 1`,
			targetUserId
		);

		if (!userExists || userExists.length === 0) {
			return res.status(404).json({
				success: false,
				error: 'User not found.',
			});
		}

		// Delete user
		await prisma.$queryRawUnsafe(
			`DELETE FROM users WHERE id = ?`,
			targetUserId
		);

		logger.info(`🗑️ Admin ${userId} deleted user ${targetUserId}`);

		res.json({
			success: true,
			message: 'User deleted successfully.',
		});
	})
);

export default router;
