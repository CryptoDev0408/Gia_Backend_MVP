import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

/**
 * Global error handler
 */
export const errorHandler = (
	err: any,
	req: Request,
	res: Response,
	_next: NextFunction
) => {
	logger.error('Error:', {
		message: err.message,
		stack: err.stack,
		path: req.path,
		method: req.method,
	});

	const statusCode = err.statusCode || 500;
	const message = err.message || 'Internal server error';

	res.status(statusCode).json({
		success: false,
		error: message,
		...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
	});
};

/**
 * 404 handler
 */
export const notFoundHandler = (_req: Request, res: Response) => {
	res.status(404).json({
		success: false,
		error: 'Route not found',
	});
};

/**
 * Async error wrapper
 */
export const asyncHandler = (fn: Function) => {
	return (req: Request, res: Response, next: NextFunction) => {
		Promise.resolve(fn(req, res, next)).catch(next);
	};
};
