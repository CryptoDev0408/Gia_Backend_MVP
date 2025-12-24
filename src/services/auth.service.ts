import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { ethers } from 'ethers';
import { config } from '../config';
import prisma from '../database/client';
import { logger } from '../utils/logger';

const SALT_ROUNDS = 10;

export interface JWTPayload {
	userId: number;
	walletAddress?: string;
	email?: string;
	role: string;
}

export class AuthService {
	/**
	 * Generate a random nonce for wallet signature
	 */
	static generateNonce(): string {
		return Math.floor(Math.random() * 1000000).toString();
	}

	/**
	 * Verify wallet signature
	 */
	static async verifyWalletSignature(
		walletAddress: string,
		signature: string,
		nonce: string
	): Promise<boolean> {
		try {
			const message = `Sign this message to authenticate with GIA AI Blog.\n\nNonce: ${nonce}`;
			const recoveredAddress = ethers.verifyMessage(message, signature);

			return recoveredAddress.toLowerCase() === walletAddress.toLowerCase();
		} catch (error) {
			logger.error('Wallet signature verification failed:', error);
			return false;
		}
	}

	/**
	 * Wallet-based authentication
	 */
	static async authenticateWallet(walletAddress: string, signature: string) {
		const normalizedAddress = walletAddress.toLowerCase();

		// Find or create user
		let user = await prisma.user.findUnique({
			where: { walletAddress: normalizedAddress },
		});

		if (!user) {
			// Create new user with nonce
			const nonce = this.generateNonce();
			user = await prisma.user.create({
				data: {
					walletAddress: normalizedAddress,
					nonce,
					username: `user_${normalizedAddress.substring(0, 8)}`,
				},
			});
		}

		// Verify signature
		const isValid = await this.verifyWalletSignature(
			normalizedAddress,
			signature,
			user.nonce!
		);

		if (!isValid) {
			throw new Error('Invalid signature');
		}

		// Generate new nonce for next login
		await prisma.user.update({
			where: { id: user.id },
			data: { nonce: this.generateNonce() },
		});

		// Generate JWT tokens
		const tokens = this.generateTokens(user.id, {
			walletAddress: user.walletAddress!,
			role: user.role,
		});

		return { user, ...tokens };
	}

	/**
	 * Get nonce for wallet
	 */
	static async getNonce(walletAddress: string) {
		const normalizedAddress = walletAddress.toLowerCase();

		let user = await prisma.user.findUnique({
			where: { walletAddress: normalizedAddress },
		});

		if (!user) {
			const nonce = this.generateNonce();
			user = await prisma.user.create({
				data: {
					walletAddress: normalizedAddress,
					nonce,
					username: `user_${normalizedAddress.substring(0, 8)}`,
				},
			});
		}

		return user.nonce!;
	}

	/**
	 * Email/Password registration
	 */
	static async registerWithEmail(email: string, password: string, username?: string) {
		// Check if user exists
		const existingUser = await prisma.user.findUnique({
			where: { email },
		});

		if (existingUser) {
			throw new Error('Email already registered');
		}

		// Hash password
		const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

		// Create user
		const user = await prisma.user.create({
			data: {
				email,
				passwordHash,
				username: username || email.split('@')[0],
				emailVerified: false,
			},
		});

		// Generate tokens
		const tokens = this.generateTokens(user.id, {
			email: user.email!,
			role: user.role,
		});

		return { user, ...tokens };
	}

	/**
	 * Email/Password login
	 */
	static async loginWithEmail(email: string, password: string) {
		// Find user
		const user = await prisma.user.findUnique({
			where: { email },
		});

		if (!user || !user.passwordHash) {
			throw new Error('Invalid credentials');
		}

		// Verify password
		const isValidPassword = await bcrypt.compare(password, user.passwordHash);

		if (!isValidPassword) {
			throw new Error('Invalid credentials');
		}

		// Generate tokens
		const tokens = this.generateTokens(user.id, {
			email: user.email!,
			role: user.role,
		});

		return { user, ...tokens };
	}

	/**
	 * Generate JWT access and refresh tokens
	 */
	static generateTokens(userId: number, payload: Partial<JWTPayload>) {
		const jwtPayload = { userId, ...payload } as JWTPayload;
		const accessToken = jwt.sign(
			jwtPayload,
			config.jwt.secret,
			{ expiresIn: config.jwt.expiresIn }
		) as string;

		const refreshPayload = { userId };
		const refreshToken = jwt.sign(
			refreshPayload,
			config.jwt.refreshSecret,
			{ expiresIn: config.jwt.refreshExpiresIn }
		) as string;

		return { accessToken, refreshToken };
	}

	/**
	 * Verify JWT access token
	 */
	static verifyAccessToken(token: string): JWTPayload {
		try {
			return jwt.verify(token, config.jwt.secret) as JWTPayload;
		} catch (error) {
			throw new Error('Invalid or expired token');
		}
	}

	/**
	 * Verify JWT refresh token
	 */
	static verifyRefreshToken(token: string): { userId: number } {
		try {
			return jwt.verify(token, config.jwt.refreshSecret) as { userId: number };
		} catch (error) {
			throw new Error('Invalid or expired refresh token');
		}
	}

	/**
	 * Refresh access token
	 */
	static async refreshAccessToken(refreshToken: string) {
		const { userId } = this.verifyRefreshToken(refreshToken);

		const user = await prisma.user.findUnique({
			where: { id: userId },
		});

		if (!user) {
			throw new Error('User not found');
		}

		const tokens = this.generateTokens(user.id, {
			walletAddress: user.walletAddress || undefined,
			email: user.email || undefined,
			role: user.role,
		});

		return tokens;
	}
}
