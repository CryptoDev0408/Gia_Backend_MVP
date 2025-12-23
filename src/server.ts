import express, { Application } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import { logger } from './utils/logger';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import routes from './routes';
import { CronScheduler } from './jobs/cron.scheduler';
import { scrapingService } from './services/scraping.service';
import { initializeDatabase } from './database/client';

const app: Application = express();

// ============================================
// MIDDLEWARE
// ============================================

// CORS
app.use(cors({
	origin: config.cors.origin,
	credentials: true,
}));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
	windowMs: config.rateLimit.windowMs,
	max: config.rateLimit.maxRequests,
	message: 'Too many requests, please try again later',
	standardHeaders: true,
	legacyHeaders: false,
});
app.use('/api/', limiter);

// Request logging
app.use((req, _res, next) => {
	logger.info(`${req.method} ${req.path}`, {
		ip: req.ip,
		userAgent: req.get('user-agent'),
	});
	next();
});

// ============================================
// ROUTES
// ============================================

app.get('/', (_req, res) => {
	res.json({
		success: true,
		message: 'GIA AI Blog Backend API',
		version: config.apiVersion,
		docs: '/api/v1/health',
	});
});

// Mount API routes
app.use(`/api/${config.apiVersion}`, routes);

// ============================================
// ERROR HANDLING
// ============================================

app.use(notFoundHandler);
app.use(errorHandler);

// ============================================
// SERVER START
// ============================================

const PORT = config.port;

// Initialize database before starting server
async function startServer() {
	try {
		// Initialize database (test connection + create tables if needed)
		await initializeDatabase();

		// Start Express server
		app.listen(PORT, () => {
			logger.info(`🚀 Server running on port ${PORT}`);
			logger.info(`📝 Environment: ${config.nodeEnv}`);
			logger.info(`🌐 API URL: http://localhost:${PORT}/api/${config.apiVersion}`);

			// AUTOMATIC SCRAPING PAUSED - Use manual trigger via API endpoint to start scraping
			// Waiting for manual scraping logic implementation

			// // Start scraping service (async)
			// if (config.scraping.enabled) {
			// 	logger.info('📸 Starting fashion scraping service (async)');
			// 	scrapingService.start().catch(error => {
			// 		logger.error('Failed to start scraping service:', error);
			// 	});
			// } else {
			// 	logger.info('📸 Scraping service disabled');
			// }

			// // Start cron jobs
			// if (config.scraping.enabled) {
			// 	logger.info('⏰ Starting cron scheduler');
			// 	CronScheduler.start();
			// } else {
			// 	logger.info('⏰ Cron scheduler disabled');
			// }

			logger.info('📸 Automatic scraping paused - waiting for manual start trigger');
		});
	} catch (error) {
		logger.error('❌ Failed to start server:', error);
		process.exit(1);
	}
}

// Start the server
startServer();

// Graceful shutdown
process.on('SIGINT', async () => {
	logger.info('Shutting down gracefully...');
	await scrapingService.stop();
	CronScheduler.stop();
	process.exit(0);
});

process.on('SIGTERM', async () => {
	logger.info('Shutting down gracefully...');
	await scrapingService.stop();
	CronScheduler.stop();
	process.exit(0);
});

export default app;
