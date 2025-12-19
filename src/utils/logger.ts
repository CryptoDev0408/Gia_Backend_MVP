import winston from 'winston';
import { config } from '../config';

const logFormat = winston.format.combine(
	winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
	winston.format.errors({ stack: true }),
	winston.format.splat(),
	winston.format.json()
);

const consoleFormat = winston.format.combine(
	winston.format.colorize(),
	winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
	winston.format.printf(({ timestamp, level, message, ...meta }) => {
		let msg = `${timestamp} [${level}]: ${message}`;
		if (Object.keys(meta).length > 0) {
			msg += ` ${JSON.stringify(meta)}`;
		}
		return msg;
	})
);

export const logger = winston.createLogger({
	level: config.logging.level,
	format: logFormat,
	transports: [
		// Console transport
		new winston.transports.Console({
			format: consoleFormat,
		}),
		// File transports
		new winston.transports.File({
			filename: 'logs/error.log',
			level: 'error',
		}),
		new winston.transports.File({
			filename: config.logging.file,
		}),
	],
});

// Create a stream object for Morgan HTTP logging
export const logStream = {
	write: (message: string) => {
		logger.info(message.trim());
	},
};
