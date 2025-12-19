import dotenv from 'dotenv';
dotenv.config();

export const config = {
	// Server
	nodeEnv: process.env.NODE_ENV || 'development',
	port: parseInt(process.env.PORT || '5005', 10),
	apiVersion: process.env.API_VERSION || 'v1',

	// Database
	databaseUrl: process.env.DATABASE_URL!,

	// JWT
	jwt: {
		secret: process.env.JWT_SECRET!,
		expiresIn: process.env.JWT_EXPIRES_IN || '7d',
		refreshSecret: process.env.JWT_REFRESH_SECRET!,
		refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
	},

	// OpenAI
	openai: {
		apiKey: process.env.OPENAI_API_KEY!,
		model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
	},

	// Social Media APIs
	twitter: {
		apiKey: process.env.TWITTER_API_KEY,
		apiSecret: process.env.TWITTER_API_SECRET,
		bearerToken: process.env.TWITTER_BEARER_TOKEN,
		accessToken: process.env.TWITTER_ACCESS_TOKEN,
		accessSecret: process.env.TWITTER_ACCESS_SECRET,
	},

	instagram: {
		username: process.env.INSTAGRAM_USERNAME,
		password: process.env.INSTAGRAM_PASSWORD,
	},

	// Scraping
	scraping: {
		intervalMinutes: parseInt(process.env.SCRAPING_INTERVAL_MINUTES || '360', 10),
		maxPostsPerScrape: parseInt(process.env.MAX_POSTS_PER_SCRAPE || '100', 10),
		enabled: process.env.SCRAPING_ENABLED === 'true',
	},

	// Rate Limiting
	rateLimit: {
		windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
		maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
	},

	// CORS
	cors: {
		origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:5004'],
	},

	// Logging
	logging: {
		level: process.env.LOG_LEVEL || 'info',
		file: process.env.LOG_FILE || 'logs/app.log',
	},
};

// Validate required environment variables
const requiredEnvVars = [
	'DATABASE_URL',
	'JWT_SECRET',
	'JWT_REFRESH_SECRET',
	'OPENAI_API_KEY',
];

for (const envVar of requiredEnvVars) {
	if (!process.env[envVar]) {
		throw new Error(`Missing required environment variable: ${envVar}`);
	}
}
