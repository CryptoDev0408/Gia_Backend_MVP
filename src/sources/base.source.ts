/**
 * Base interface for all social media sources
 * Each platform must implement this interface
 */

export interface ScrapedPostData {
	platformPostId: string;
	platform: 'ELLE' | 'HARPER' | 'ETC';
	author: string;
	authorHandle: string;
	text: string;
	mediaUrls?: string[];
	postedAt: Date;
	likes: number;
	comments: number;
	shares: number;
	views: number;
	sourceUrl?: string;
	rawContent: any; // Store entire raw response
}

export interface ScrapingConditions {
	// Fashion-oriented filters
	hashtags?: string[];
	keywords?: string[];

	// Result limits
	maxResults?: number;
	maxPostsPerHashtag?: number;

	// Timeouts
	pageTimeout?: number;
	scrollTimeout?: number;
	navigationTimeout?: number;

	// Thresholds
	minEngagement?: number;
	minLikes?: number;

	// Date filters
	since?: Date;
	until?: Date;
}

export abstract class BaseSocialMediaSource {
	protected platformName: string;

	constructor(platformName: string) {
		this.platformName = platformName;
	}

	/**
	 * Initialize the scraper (authenticate, setup browser, etc.)
	 */
	abstract initialize(): Promise<void>;

	/**
	 * Scrape posts from the platform
	 */
	abstract scrape(conditions: ScrapingConditions): Promise<ScrapedPostData[]>;

	/**
	 * Clean up resources (close browser, disconnect, etc.)
	 */
	abstract cleanup(): Promise<void>;

	/**
	 * Test connection/authentication
	 */
	abstract testConnection(): Promise<boolean>;

	/**
	 * Get platform name
	 */
	getPlatformName(): string {
		return this.platformName;
	}

	/**
	 * Normalize post data (common processing)
	 */
	protected normalizeEngagement(raw: any): {
		likes: number;
		comments: number;
		shares: number;
		views: number;
	} {
		return {
			likes: this.parseNumber(raw.likes),
			comments: this.parseNumber(raw.comments),
			shares: this.parseNumber(raw.shares || raw.retweets),
			views: this.parseNumber(raw.views),
		};
	}

	/**
	 * Parse engagement numbers (handle K, M suffixes)
	 */
	protected parseNumber(value: any): number {
		if (typeof value === 'number') return value;
		if (!value) return 0;

		const str = String(value).toLowerCase().replace(/,/g, '');

		if (str.includes('k')) {
			return Math.floor(parseFloat(str) * 1000);
		}
		if (str.includes('m')) {
			return Math.floor(parseFloat(str) * 1000000);
		}

		return parseInt(str, 10) || 0;
	}

	/**
	 * Extract hashtags from text
	 */
	protected extractHashtags(text: string): string[] {
		const hashtagRegex = /#[\w]+/g;
		const matches = text.match(hashtagRegex);
		return matches ? matches.map(tag => tag.toLowerCase()) : [];
	}

	/**
	 * Clean text content
	 */
	protected cleanText(text: string): string {
		return text
			.replace(/\s+/g, ' ')
			.replace(/\n+/g, '\n')
			.trim();
	}
}
