import prisma from '../database/client';
import { logger } from '../utils/logger';

/**
 * Normalization Service
 * Cleans and processes scraped data
 */
export class NormalizationService {
	/**
	 * Process all unprocessed scraped posts
	 */
	static async processAll() {
		const unprocessed = await prisma.scrapedPost.findMany({
			where: { isProcessed: false },
			take: 500, // Process in batches
		});

		logger.info(`Processing ${unprocessed.length} unprocessed posts`);

		const results = [];
		for (const scrapedPost of unprocessed) {
			try {
				const normalized = await this.normalizePost(scrapedPost);
				results.push(normalized);

				// Mark as processed
				await prisma.scrapedPost.update({
					where: { id: scrapedPost.id },
					data: {
						isProcessed: true,
						processedAt: new Date(),
					},
				});
			} catch (error) {
				logger.error(`Failed to normalize post ${scrapedPost.id}:`, error);
			}
		}

		logger.info(`Normalized ${results.length} posts`);
		return results;
	}

	/**
	 * Normalize a single scraped post
	 */
	static async normalizePost(scrapedPost: any) {
		// Clean text
		const cleanedText = this.cleanText(scrapedPost.text);

		// Extract hashtags
		const hashtags = this.extractHashtags(cleanedText);

		// Extract keywords
		const keywords = this.extractKeywords(cleanedText);

		// Extract mentions
		const mentions = this.extractMentions(cleanedText);

		// Calculate scores
		const viralityScore = this.calculateViralityScore(scrapedPost);
		const relevanceScore = this.calculateRelevanceScore(cleanedText, hashtags, keywords);
		const qualityScore = this.calculateQualityScore(scrapedPost, cleanedText);

		// Create normalized post
		const normalizedPost = await prisma.normalizedPost.create({
			data: {
				scrapedPostId: scrapedPost.id,
				platform: scrapedPost.platform,
				author: scrapedPost.author,
				authorHandle: scrapedPost.authorHandle,
				authorUrl: this.getAuthorUrl(scrapedPost.platform, scrapedPost.authorHandle),
				cleanedText,
				hashtags,
				keywords,
				mentions,
				mediaUrls: scrapedPost.mediaUrls,
				postedAt: scrapedPost.postedAt,
				likesCount: scrapedPost.likes,
				commentsCount: scrapedPost.comments,
				sharesCount: scrapedPost.shares,
				viewsCount: scrapedPost.views,
				viralityScore,
				relevanceScore,
				qualityScore,
			},
		});

		return normalizedPost;
	}

	/**
	 * Clean text content
	 */
	private static cleanText(text: string): string {
		return text
			.replace(/https?:\/\/[^\s]+/g, '') // Remove URLs
			.replace(/\s+/g, ' ') // Normalize whitespace
			.replace(/\n+/g, '\n') // Normalize newlines
			.trim();
	}

	/**
	 * Extract hashtags
	 */
	private static extractHashtags(text: string): string[] {
		const hashtagRegex = /#[\w]+/g;
		const matches = text.match(hashtagRegex);
		return matches ? [...new Set(matches.map(tag => tag.toLowerCase()))] : [];
	}

	/**
	 * Extract keywords using simple NLP
	 */
	private static extractKeywords(text: string): string[] {
		// Fashion-related keywords
		const fashionKeywords = [
			'fashion', 'style', 'outfit', 'ootd', 'streetwear', 'luxury', 'designer',
			'trend', 'vintage', 'sustainable', 'minimalist', 'maximalist', 'aesthetic',
			'lookbook', 'wardrobe', 'accessories', 'jewelry', 'shoes', 'sneakers',
			'dress', 'suit', 'blazer', 'denim', 'leather', 'silk', 'cotton',
			'runway', 'couture', 'collection', 'capsule', 'thrift', 'vintage',
		];

		const words = text.toLowerCase().split(/\s+/);
		const keywords = words.filter(word =>
			fashionKeywords.some(keyword => word.includes(keyword))
		);

		return [...new Set(keywords)].slice(0, 10);
	}

	/**
	 * Extract @mentions
	 */
	private static extractMentions(text: string): string[] {
		const mentionRegex = /@[\w]+/g;
		const matches = text.match(mentionRegex);
		return matches ? [...new Set(matches)] : [];
	}

	/**
	 * Calculate virality score (0-100)
	 */
	private static calculateViralityScore(post: any): number {
		const engagement = post.likes + post.comments * 2 + post.shares * 3;
		const views = post.views || engagement * 10;

		const engagementRate = views > 0 ? (engagement / views) * 100 : 0;

		// Normalize to 0-100
		const score = Math.min(100, Math.floor(engagementRate * 1000));

		return Math.max(0, score);
	}

	/**
	 * Calculate relevance score (0-100)
	 */
	private static calculateRelevanceScore(
		text: string,
		hashtags: string[],
		keywords: string[]
	): number {
		let score = 50; // Base score

		// Boost for fashion-related hashtags
		const fashionHashtags = hashtags.filter(tag =>
			tag.includes('fashion') || tag.includes('style') || tag.includes('ootd')
		);
		score += fashionHashtags.length * 10;

		// Boost for keywords
		score += keywords.length * 5;

		// Boost for media content
		if (text.length > 50) score += 10;

		return Math.min(100, Math.max(0, score));
	}

	/**
	 * Calculate quality score (0-100)
	 */
	private static calculateQualityScore(post: any, text: string): number {
		let score = 50;

		// Has media
		if (post.mediaUrls && post.mediaUrls.length > 0) score += 20;

		// Good text length
		if (text.length > 30 && text.length < 500) score += 15;

		// Good engagement
		if (post.likes > 100) score += 10;
		if (post.comments > 10) score += 5;

		return Math.min(100, Math.max(0, score));
	}

	/**
	 * Get author URL
	 */
	private static getAuthorUrl(platform: string, handle: string): string {
		const cleanHandle = handle.replace('@', '');

		switch (platform) {
			case 'TWITTER':
				return `https://twitter.com/${cleanHandle}`;
			case 'INSTAGRAM':
				return `https://instagram.com/${cleanHandle}`;
			default:
				return '';
		}
	}
}
