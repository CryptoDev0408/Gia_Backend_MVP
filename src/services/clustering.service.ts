import prisma from '../database/client';
import { logger } from '../utils/logger';
import crypto from 'crypto';

/**
 * Clustering Service
 * Groups similar posts into trend clusters
 */
export class ClusteringService {
	/**
	 * Cluster all unclustered posts
	 */
	static async clusterAll() {
		const unclusteredPosts = await prisma.normalizedPost.findMany({
			where: { clusterId: null },
			orderBy: { postedAt: 'desc' },
			take: 1000,
		});

		logger.info(`Clustering ${unclusteredPosts.length} unclustered posts`);

		const clusters = await this.groupPostsIntoClusters(unclusteredPosts);

		logger.info(`Created/updated ${clusters.length} clusters`);
		return clusters;
	}

	/**
	 * Group posts into clusters based on hashtags and keywords
	 */
	private static async groupPostsIntoClusters(posts: any[]) {
		const clusterGroups = new Map<string, any[]>();

		// Group posts by similar hashtags/keywords
		for (const post of posts) {
			const clusterKey = this.generateClusterKey(post.hashtags, post.keywords);

			if (!clusterGroups.has(clusterKey)) {
				clusterGroups.set(clusterKey, []);
			}

			clusterGroups.get(clusterKey)!.push(post);
		}

		// Create or update clusters
		const results = [];
		for (const [clusterKey, groupPosts] of clusterGroups.entries()) {
			// Only create cluster if we have at least 3 posts
			if (groupPosts.length < 3) {
				continue;
			}

			try {
				const cluster = await this.createOrUpdateCluster(clusterKey, groupPosts);
				results.push(cluster);
			} catch (error) {
				logger.error(`Failed to create cluster ${clusterKey}:`, error);
			}
		}

		return results;
	}

	/**
	 * Generate cluster key from hashtags and keywords
	 */
	private static generateClusterKey(hashtags: any[], keywords: any[]): string {
		// Convert to arrays if stored as JSON
		const hashtagArray = Array.isArray(hashtags) ? hashtags : [];
		const keywordArray = Array.isArray(keywords) ? keywords : [];

		// Get top hashtags and keywords
		const topHashtags = hashtagArray.slice(0, 3).sort();
		const topKeywords = keywordArray.slice(0, 3).sort();

		// Create unique key
		const combined = [...topHashtags, ...topKeywords].join('_');

		// Hash for consistent key
		return crypto.createHash('md5').update(combined).digest('hex');
	}

	/**
	 * Create or update cluster
	 */
	private static async createOrUpdateCluster(clusterKey: string, posts: any[]) {
		// Extract common hashtags and keywords
		const commonHashtags = this.findCommonElements(
			posts.map(p => Array.isArray(p.hashtags) ? p.hashtags : [])
		);

		const commonKeywords = this.findCommonElements(
			posts.map(p => Array.isArray(p.keywords) ? p.keywords : [])
		);

		// Calculate cluster metrics
		const trendScore = this.calculateClusterTrendScore(posts);
		const firstSeenAt = new Date(Math.min(...posts.map(p => p.postedAt.getTime())));
		const lastSeenAt = new Date(Math.max(...posts.map(p => p.postedAt.getTime())));

		// Find or create cluster
		let cluster = await prisma.trendCluster.findUnique({
			where: { clusterKey },
		});

		if (cluster) {
			// Update existing cluster
			cluster = await prisma.trendCluster.update({
				where: { id: cluster.id },
				data: {
					commonHashtags,
					commonKeywords,
					trendScore,
					lastSeenAt,
					isActive: true,
				},
			});
		} else {
			// Create new cluster
			cluster = await prisma.trendCluster.create({
				data: {
					clusterKey,
					commonHashtags,
					commonKeywords,
					title: this.generateClusterTitle(commonHashtags, commonKeywords),
					aiInsight: 'AI insight pending...', // Will be generated later
					trendScore,
					growthPercentage: 0,
					firstSeenAt,
					lastSeenAt,
					isActive: true,
				},
			});
		}

		// Assign posts to cluster
		await prisma.normalizedPost.updateMany({
			where: {
				id: { in: posts.map(p => p.id) },
			},
			data: {
				clusterId: cluster.id,
			},
		});

		logger.info(`Cluster ${cluster.id} updated with ${posts.length} posts`);
		return cluster;
	}

	/**
	 * Find common elements across arrays
	 */
	private static findCommonElements(arrays: string[][]): string[] {
		if (arrays.length === 0) return [];

		// Count occurrences
		const counts = new Map<string, number>();

		for (const arr of arrays) {
			const unique = [...new Set(arr)];
			for (const item of unique) {
				counts.set(item, (counts.get(item) || 0) + 1);
			}
		}

		// Get elements that appear in at least 30% of posts
		const threshold = Math.ceil(arrays.length * 0.3);
		const common = Array.from(counts.entries())
			.filter(([_, count]) => count >= threshold)
			.sort((a, b) => b[1] - a[1])
			.map(([item]) => item)
			.slice(0, 5);

		return common;
	}

	/**
	 * Calculate cluster trend score
	 */
	private static calculateClusterTrendScore(posts: any[]): number {
		// Average virality and relevance scores
		const avgVirality = posts.reduce((sum, p) => sum + p.viralityScore, 0) / posts.length;
		const avgRelevance = posts.reduce((sum, p) => sum + p.relevanceScore, 0) / posts.length;

		// Boost for number of posts
		const volumeBoost = Math.min(20, posts.length * 2);

		const score = (avgVirality * 0.4 + avgRelevance * 0.4 + volumeBoost * 0.2);

		return Math.min(100, Math.max(0, Math.floor(score)));
	}

	/**
	 * Generate cluster title
	 */
	private static generateClusterTitle(hashtags: string[], keywords: string[]): string {
		// Use top hashtags/keywords to create title
		const elements = [...hashtags.slice(0, 2), ...keywords.slice(0, 2)];

		if (elements.length === 0) {
			return 'Fashion Trend';
		}

		// Capitalize and format
		const formatted = elements
			.map(el => el.replace('#', '').replace(/_/g, ' '))
			.map(el => el.charAt(0).toUpperCase() + el.slice(1))
			.join(' & ');

		return formatted;
	}

	/**
	 * Calculate growth percentage for active clusters
	 */
	static async calculateGrowthRates() {
		const activeClusters = await prisma.trendCluster.findMany({
			where: { isActive: true },
			include: {
				posts: {
					orderBy: { postedAt: 'desc' },
					take: 100,
				},
			},
		});

		for (const cluster of activeClusters) {
			try {
				const growthPercentage = this.calculateGrowth(cluster.posts);

				await prisma.trendCluster.update({
					where: { id: cluster.id },
					data: { growthPercentage },
				});
			} catch (error) {
				logger.error(`Failed to calculate growth for cluster ${cluster.id}:`, error);
			}
		}
	}

	/**
	 * Calculate growth percentage
	 */
	private static calculateGrowth(posts: any[]): number {
		if (posts.length < 2) return 0;

		const now = Date.now();
		const oneDayAgo = now - 24 * 60 * 60 * 1000;
		const twoDaysAgo = now - 48 * 60 * 60 * 1000;

		const recentPosts = posts.filter(p => p.postedAt.getTime() > oneDayAgo).length;
		const previousPosts = posts.filter(
			p => p.postedAt.getTime() > twoDaysAgo && p.postedAt.getTime() <= oneDayAgo
		).length;

		if (previousPosts === 0) return recentPosts > 0 ? 100 : 0;

		const growth = ((recentPosts - previousPosts) / previousPosts) * 100;
		return Math.floor(growth);
	}
}
