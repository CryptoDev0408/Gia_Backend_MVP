import prisma from '../database/client';
import { logger } from '../utils/logger';
import { ScrapedPostData } from '../sources/base.source';
import OpenAI from 'openai';
import { config } from '../config';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Normalized Data Structure (OpenAI Output Format)
 */
export interface NormalizedFashionPost {
	Title: string;
	AI_Insight: string;
	Image: string;
	Description: string;
	Link: string;
	Platform: string;
	Hashtags: string[];
}

/**
 * Normalization Service
 * Uses OpenAI to standardize and enrich scraped fashion data
 */
export class NormalizationService {
	private static openai = new OpenAI({
		apiKey: config.openai.apiKey,
	});

	private static promptTemplate: string | null = null;

	/**
	 * Load fashion prompt template
	 */
	private static loadPromptTemplate(): string {
		if (this.promptTemplate) {
			return this.promptTemplate;
		}

		try {
			const promptPath = path.join(__dirname, '../../prompts/fashion-prompt.txt');
			this.promptTemplate = fs.readFileSync(promptPath, 'utf-8');
			logger.info('Loaded fashion prompt template');
			return this.promptTemplate;
		} catch (error) {
			logger.error('Failed to load prompt template:', error);
			throw new Error('Fashion prompt template not found');
		}
	}

	/**
	 * Normalize scraped data using OpenAI
	 * Takes JSON scraped data and returns standardized format
	 */
	static async normalizeWithAI(scrapedData: ScrapedPostData[], platform: string): Promise<NormalizedFashionPost[]> {
		try {
			logger.info(`Starting AI normalization for ${scrapedData.length} ${platform} posts`);

			// Prepare scraped content for OpenAI
			const scrapedContent = scrapedData.map(post => ({
				title: post.rawContent?.title || 'Untitled',
				description: post.rawContent?.description || post.text || '',
				image: post.mediaUrls && post.mediaUrls.length > 0 ? post.mediaUrls[0] : '',
				link: post.sourceUrl,
				author: post.author,
				platform: post.platform,
				postedAt: post.postedAt
			}));

			// Load prompt template
			const promptTemplate = this.loadPromptTemplate();

			// Create OpenAI request
			const scrapedContentJson = JSON.stringify(scrapedContent, null, 2);
			const fullPrompt = `${promptTemplate}\n\nScraped Content:\n${scrapedContentJson}`;

			logger.info('Sending request to OpenAI for normalization...');
			logger.info(`Scraped content length: ${scrapedContentJson.length} characters`);

			const completion = await this.openai.chat.completions.create({
				model: config.openai.model,
				messages: [
					{
						role: 'system',
						content: 'You are a fashion industry expert specializing in trend analysis and content curation. You normalize and enrich fashion article data with insightful commentary. Always return valid JSON array format without markdown formatting.'
					},
					{
						role: 'user',
						content: fullPrompt
					}
				],
				temperature: 0.7,
				max_tokens: 4000,
			});

			const responseContent = completion.choices[0]?.message?.content || '[]';
			logger.info('Received response from OpenAI');
			logger.info(`Response length: ${responseContent.length} characters`);

			// Parse OpenAI response
			let normalizedData: NormalizedFashionPost[];
			try {
				// Remove markdown code blocks if present
				const cleanedResponse = responseContent
					.replace(/```json\n?/g, '')
					.replace(/```\n?/g, '')
					.trim();

				normalizedData = JSON.parse(cleanedResponse);
				logger.info(`Successfully parsed ${normalizedData.length} normalized posts`);
			} catch (parseError) {
				logger.error('Failed to parse OpenAI response:', parseError);
				logger.error('Response content:', responseContent);
				throw new Error('Failed to parse OpenAI response as JSON');
			}

			return normalizedData;

		} catch (error: any) {
			logger.error('AI normalization failed:', error);
			throw error;
		}
	}

	/**
	 * Save normalized data to JSON file
	 */
	static async saveNormalizedData(data: NormalizedFashionPost[], platform: string): Promise<string> {
		try {
			const outputDir = path.join(__dirname, '../../Output');
			if (!fs.existsSync(outputDir)) {
				fs.mkdirSync(outputDir, { recursive: true });
			}

			const filename = `normalized_${platform.toLowerCase()}.json`;
			const filepath = path.join(outputDir, filename);

			fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
			logger.info(`Normalized data saved to: ${filepath}`);

			return filepath;
		} catch (error) {
			logger.error('Failed to save normalized data:', error);
			throw error;
		}
	}

	/**
	 * Save normalized data to blogs table in MySQL
	 */
	static async saveToBlogsTable(data: NormalizedFashionPost[]): Promise<void> {
		try {
			logger.info(`Saving ${data.length} normalized posts to blogs table...`);

			for (const post of data) {
				try {
					// Check if blog with same link already exists
					const existing = await prisma.$queryRaw<any[]>`
						SELECT id FROM blogs WHERE link = ${post.Link} LIMIT 1
					`;

					if (existing.length > 0) {
						logger.debug(`Blog already exists: ${post.Link}`);
						continue;
					}

					// Insert new blog
					await prisma.$executeRaw`
						INSERT INTO blogs (platform, title, description, ai_insight, image, link, approved)
						VALUES (
							${post.Platform},
							${post.Title},
							${post.Description},
							${post.AI_Insight},
							${post.Image},
							${post.Link},
							0
						)
					`;

					logger.debug(`Saved blog: ${post.Title}`);
				} catch (error) {
					logger.error(`Failed to save blog "${post.Title}":`, error);
				}
			}

			logger.info(`✅ Successfully saved ${data.length} blogs to database`);
		} catch (error) {
			logger.error('Failed to save blogs to database:', error);
			throw error;
		}
	}

	/**
	 * Process all unprocessed scraped posts (Legacy Database Method)
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
