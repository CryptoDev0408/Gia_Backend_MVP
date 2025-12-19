import { Router } from 'express';
import { body } from 'express-validator';
import { AuthService } from '../services/auth.service';
import { asyncHandler } from '../middleware/error.middleware';
import prisma from '../database/client';

const router = Router();

/**
 * POST /api/v1/auth/wallet/nonce
 * Get nonce for wallet signature
 */
router.post(
	'/wallet/nonce',
	body('walletAddress').isEthereumAddress(),
	asyncHandler(async (req: any, res: any) => {
		const { walletAddress } = req.body;

		const nonce = await AuthService.getNonce(walletAddress);

		res.json({
			success: true,
			data: { nonce },
		});
	})
);

/**
 * POST /api/v1/auth/wallet/login
 * Wallet-based login
 */
router.post(
	'/wallet/login',
	body('walletAddress').isEthereumAddress(),
	body('signature').isString(),
	asyncHandler(async (req: any, res: any) => {
		const { walletAddress, signature } = req.body;

		const result = await AuthService.authenticateWallet(walletAddress, signature);

		res.json({
			success: true,
			data: {
				user: {
					id: result.user.id,
					walletAddress: result.user.walletAddress,
					username: result.user.username,
					role: result.user.role,
				},
				accessToken: result.accessToken,
				refreshToken: result.refreshToken,
			},
		});
	})
);

/**
 * POST /api/v1/auth/register
 * Email/password registration
 */
router.post(
	'/register',
	body('email').isEmail(),
	body('password').isLength({ min: 6 }),
	body('username').optional().isString(),
	asyncHandler(async (req: any, res: any) => {
		const { email, password, username } = req.body;

		const result = await AuthService.registerWithEmail(email, password, username);

		res.status(201).json({
			success: true,
			data: {
				user: {
					id: result.user.id,
					email: result.user.email,
					username: result.user.username,
					role: result.user.role,
				},
				accessToken: result.accessToken,
				refreshToken: result.refreshToken,
			},
		});
	})
);

/**
 * POST /api/v1/auth/login
 * Email/password login
 */
router.post(
	'/login',
	body('email').isEmail(),
	body('password').isString(),
	asyncHandler(async (req: any, res: any) => {
		const { email, password } = req.body;

		const result = await AuthService.loginWithEmail(email, password);

		res.json({
			success: true,
			data: {
				user: {
					id: result.user.id,
					email: result.user.email,
					username: result.user.username,
					role: result.user.role,
				},
				accessToken: result.accessToken,
				refreshToken: result.refreshToken,
			},
		});
	})
);

/**
 * POST /api/v1/auth/refresh
 * Refresh access token
 */
router.post(
	'/refresh',
	body('refreshToken').isString(),
	asyncHandler(async (req: any, res: any) => {
		const { refreshToken } = req.body;

		const tokens = await AuthService.refreshAccessToken(refreshToken);

		res.json({
			success: true,
			data: tokens,
		});
	})
);

/**
 * GET /api/v1/auth/me
 * Get current user
 */
router.get(
	'/me',
	asyncHandler(async (req: any, res: any) => {
		const authHeader = req.headers.authorization;
		if (!authHeader) {
			return res.status(401).json({ success: false, error: 'Not authenticated' });
		}

		const token = authHeader.substring(7);
		const payload = AuthService.verifyAccessToken(token);

		const user = await prisma.user.findUnique({
			where: { id: payload.userId },
			select: {
				id: true,
				walletAddress: true,
				email: true,
				username: true,
				displayName: true,
				avatarUrl: true,
				role: true,
				createdAt: true,
			},
		});

		if (!user) {
			return res.status(404).json({ success: false, error: 'User not found' });
		}

		res.json({
			success: true,
			data: user,
		});
	})
);

export default router;
