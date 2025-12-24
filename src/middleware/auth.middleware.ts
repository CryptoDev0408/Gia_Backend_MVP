import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { logger } from '../utils/logger';

export interface AuthRequest extends Request {
	user?: {
		userId: number;
		walletAddress?: string;
		email?: string;
		role: string;
	};
}

/**
 * Authentication middleware
 */
export const authenticate = async (
	req: AuthRequest,
	res: Response,
	next: NextFunction
) => {
	try {
		const authHeader = req.headers.authorization;

		if (!authHeader || !authHeader.startsWith('Bearer ')) {
			return res.status(401).json({
				success: false,
				error: 'No token provided',
			});
		}

		const token = authHeader.substring(7);
		const payload = AuthService.verifyAccessToken(token);

		req.user = payload;
		return next();
	} catch (error: any) {
		logger.warn('Authentication failed:', error.message);
		return res.status(401).json({
			success: false,
			error: 'Invalid or expired token',
		});
	}
};

/**
 * Optional authentication (doesn't fail if no token)
 */
export const optionalAuth = async (
	req: AuthRequest,
	_res: Response,
	next: NextFunction
) => {
	try {
		const authHeader = req.headers.authorization;

		if (authHeader && authHeader.startsWith('Bearer ')) {
			const token = authHeader.substring(7);
			const payload = AuthService.verifyAccessToken(token);
			req.user = payload;
		}

		return next();
	} catch (error) {
		// Continue without authentication
		return next();
	}
};

/**
 * Admin-only middleware
 */
export const requireAdmin = (
	req: AuthRequest,
	res: Response,
	next: NextFunction
) => {
	if (!req.user || req.user.role !== 'ADMIN') {
		return res.status(403).json({
			success: false,
			error: 'Admin access required',
		});
	}

	return next();
};
