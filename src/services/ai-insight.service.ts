import OpenAI from 'openai';
import prisma from '../database/client';
import { config } from '../config';
import { logger } from '../utils/logger';

/**
 * AI Insight Generator using OpenAI
 * Generates trend titles and insights
 */
export class AIInsightService {
	private static openai = new OpenAI({
		apiKey: config.openai.apiKey,
	});

	/**
	 * Generate insights for all clusters without AI insights
	 */
	static async generateAllInsights() {
		const clusters = await prisma.trendCluster.findMany({
			where: {
				OR: [
					{ aiInsight: 'AI insight pending...' },
					{ aiInsight: undefined },
				],
			},
			include: {
				posts: {
					take: 10,
					orderBy: { viralityScore: 'desc' },
				},
			},
		});

		logger.info(`Generating insights for ${clusters.length} clusters`);

		const results = [];
		for (const cluster of clusters) {
			try {
				const insight = await this.generateInsight(cluster);
				results.push(insight);
			} catch (error) {
				logger.error(`Failed to generate insight for cluster ${cluster.id}:`, error);
			}
		}

		return results;
	}

	/**
	 * Generate AI insight for a single cluster
	 */
	static async generateInsight(cluster: any) {
		try {
			// Prepare context from posts
			const postsSummary = cluster.posts
				.slice(0, 5)
				.map((p: any) => `- ${p.cleanedText.substring(0, 200)}`)
				.join('\n');

			const hashtags = Array.isArray(cluster.commonHashtags)
				? cluster.commonHashtags.join(', ')
				: '';

			const keywords = Array.isArray(cluster.commonKeywords)
				? cluster.commonKeywords.join(', ')
				: '';

			// Generate with OpenAI
			const completion = await this.openai.chat.completions.create({
				model: config.openai.model,
				messages: [
					{
						role: 'system',
						content: `You are a fashion trend analyst. Generate concise, engaging trend insights for a fashion blog. 
            Your insights should be 1-2 sentences, highlighting what makes this trend notable and why it's gaining traction.
            Be specific, mention key elements, and sound authoritative but approachable.`,
					},
					{
						role: 'user',
						content: `Generate a trend insight for this fashion trend cluster:
            
Common Hashtags: ${hashtags}
Common Keywords: ${keywords}
Trend Score: ${cluster.trendScore}/100
Growth: ${cluster.growthPercentage}%

Sample Posts:
${postsSummary}

Provide:
1. A catchy trend title (max 6 words)
2. A brief insight (1-2 sentences explaining the trend)

Format as JSON:
{
  "title": "trend title here",
  "insight": "trend insight here"
}`,
					},
				],
				temperature: 0.7,
				max_tokens: 200,
			});

			const response = completion.choices[0].message.content;
			const parsed = JSON.parse(response || '{}');

			// Update cluster with AI-generated content
			const updated = await prisma.trendCluster.update({
				where: { id: cluster.id },
				data: {
					title: parsed.title || cluster.title,
					aiInsight: parsed.insight || 'Unable to generate insight',
				},
			});

			logger.info(`Generated insight for cluster ${cluster.id}`);
			return updated;
		} catch (error: any) {
			logger.error(`AI insight generation failed for cluster ${cluster.id}:`, error.message);

			// Fallback to basic insight
			await prisma.trendCluster.update({
				where: { id: cluster.id },
				data: {
					aiInsight: this.generateFallbackInsight(cluster),
				},
			});

			throw error;
		}
	}

	/**
	 * Generate fallback insight without AI
	 */
	private static generateFallbackInsight(cluster: any): string {
		const hashtags = Array.isArray(cluster.commonHashtags)
			? cluster.commonHashtags.slice(0, 3).join(', ')
			: '';

		const growth = cluster.growthPercentage > 0
			? `up ${cluster.growthPercentage}% this week`
			: 'trending now';

		return `This trend featuring ${hashtags} is ${growth}. Fashion enthusiasts are embracing this style across social media.`;
	}

	/**
	 * Analyze sentiment of posts in a cluster
	 */
	static async analyzeSentiment(posts: any[]) {
		try {
			const texts = posts
				.slice(0, 5)
				.map(p => p.cleanedText)
				.join('\n\n');

			const completion = await this.openai.chat.completions.create({
				model: 'gpt-3.5-turbo',
				messages: [
					{
						role: 'system',
						content: 'Analyze the overall sentiment of these fashion posts. Respond with: positive, negative, or neutral.',
					},
					{
						role: 'user',
						content: texts,
					},
				],
				temperature: 0.3,
				max_tokens: 10,
			});

			return completion.choices[0].message.content?.toLowerCase() || 'neutral';
		} catch (error) {
			logger.error('Sentiment analysis failed:', error);
			return 'neutral';
		}
	}
}
