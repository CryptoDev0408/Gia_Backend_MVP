import axios from 'axios';
import { BaseSocialMediaSource, ScrapedPostData, ScrapingOptions } from './base.source';
import { config } from '../config';
import { logger } from '../utils/logger';

/**
 * Twitter/X API implementation
 * Uses Twitter API v2
 */
export class TwitterSource extends BaseSocialMediaSource {
	private bearerToken: string;
	private isInitialized = false;

	constructor() {
		super('TWITTER');
		this.bearerToken = config.twitter.bearerToken || '';
	}

	async initialize(): Promise<void> {
		if (!this.bearerToken) {
			throw new Error('Twitter bearer token not configured');
		}

		// Test connection
		const isConnected = await this.testConnection();
		if (!isConnected) {
			throw new Error('Failed to connect to Twitter API');
		}

		this.isInitialized = true;
		logger.info('Twitter source initialized successfully');
	}

	async scrape(options: ScrapingOptions): Promise<ScrapedPostData[]> {
		if (!this.isInitialized) {
			await this.initialize();
		}

		const posts: ScrapedPostData[] = [];
		const maxPosts = options.maxPosts || 100;

		try {
			// Build search query
			const query = this.buildSearchQuery(options);

			logger.info(`Scraping Twitter with query: ${query}`);

			// Search recent tweets
			const response = await axios.get(
				'https://api.twitter.com/2/tweets/search/recent',
				{
					headers: {
						'Authorization': `Bearer ${this.bearerToken}`,
					},
					params: {
						query,
						max_results: Math.min(maxPosts, 100),
						'tweet.fields': 'created_at,public_metrics,author_id,entities',
						'user.fields': 'username,name',
						'expansions': 'author_id,attachments.media_keys',
						'media.fields': 'url,preview_image_url',
					},
				}
			);

			const tweets = response.data.data || [];
			const users = this.mapUsers(response.data.includes?.users || []);
			const media = this.mapMedia(response.data.includes?.media || []);

			for (const tweet of tweets) {
				const author = users[tweet.author_id];
				if (!author) continue;

				const mediaUrls = this.extractMediaUrls(tweet, media);

				posts.push({
					platformPostId: tweet.id,
					platform: 'TWITTER',
					author: author.name,
					authorHandle: `@${author.username}`,
					text: tweet.text,
					mediaUrls,
					postedAt: new Date(tweet.created_at),
					likes: tweet.public_metrics.like_count,
					comments: tweet.public_metrics.reply_count,
					shares: tweet.public_metrics.retweet_count,
					views: tweet.public_metrics.impression_count || 0,
					sourceUrl: `https://twitter.com/${author.username}/status/${tweet.id}`,
					rawContent: tweet,
				});
			}

			logger.info(`Scraped ${posts.length} tweets from Twitter`);
			return posts;
		} catch (error: any) {
			logger.error('Twitter scraping error:', error.response?.data || error.message);
			throw error;
		}
	}

	async cleanup(): Promise<void> {
		this.isInitialized = false;
		logger.info('Twitter source cleaned up');
	}

	async testConnection(): Promise<boolean> {
		try {
			const response = await axios.get('https://api.twitter.com/2/tweets/search/recent', {
				headers: {
					'Authorization': `Bearer ${this.bearerToken}`,
				},
				params: {
					query: 'fashion',
					max_results: 10,
				},
			});
			return response.status === 200;
		} catch (error) {
			logger.error('Twitter connection test failed:', error);
			return false;
		}
	}

	/**
	 * Build search query for Twitter API
	 */
	private buildSearchQuery(options: ScrapingOptions): string {
		const parts: string[] = [];

		// Add keywords (default to fashion-related)
		const keywords = options.keywords || ['fashion', 'style', 'outfit', 'streetwear', 'luxury'];
		parts.push(`(${keywords.join(' OR ')})`);

		// Add hashtags
		if (options.hashtags && options.hashtags.length > 0) {
			const hashtagQuery = options.hashtags.map(tag => `#${tag.replace('#', '')}`).join(' OR ');
			parts.push(`(${hashtagQuery})`);
		}

		// Add filters
		parts.push('-is:retweet'); // Exclude retweets
		parts.push('has:images OR has:videos'); // Must have media
		parts.push('lang:en'); // English only

		return parts.join(' ');
	}

	/**
	 * Map users to lookup object
	 */
	private mapUsers(users: any[]): Record<string, any> {
		const userMap: Record<string, any> = {};
		for (const user of users) {
			userMap[user.id] = user;
		}
		return userMap;
	}

	/**
	 * Map media to lookup object
	 */
	private mapMedia(mediaList: any[]): Record<string, any> {
		const mediaMap: Record<string, any> = {};
		for (const media of mediaList) {
			mediaMap[media.media_key] = media;
		}
		return mediaMap;
	}

	/**
	 * Extract media URLs from tweet
	 */
	private extractMediaUrls(tweet: any, mediaMap: Record<string, any>): string[] {
		const urls: string[] = [];

		if (tweet.attachments?.media_keys) {
			for (const mediaKey of tweet.attachments.media_keys) {
				const media = mediaMap[mediaKey];
				if (media) {
					urls.push(media.url || media.preview_image_url);
				}
			}
		}

		return urls.filter(Boolean);
	}
}
