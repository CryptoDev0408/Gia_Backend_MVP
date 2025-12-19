import { BaseSocialMediaSource } from './base.source';
import { TwitterSource } from './twitter.source';
import { InstagramSource } from './instagram.source';

/**
 * Factory for creating social media source instances
 */
export class SourceFactory {
	private static instances: Map<string, BaseSocialMediaSource> = new Map();

	/**
	 * Get source instance by platform name
	 */
	static getSource(platform: 'TWITTER' | 'INSTAGRAM'): BaseSocialMediaSource {
		const key = platform.toLowerCase();

		if (!this.instances.has(key)) {
			switch (platform) {
				case 'TWITTER':
					this.instances.set(key, new TwitterSource());
					break;
				case 'INSTAGRAM':
					this.instances.set(key, new InstagramSource());
					break;
				default:
					throw new Error(`Unsupported platform: ${platform}`);
			}
		}

		return this.instances.get(key)!;
	}

	/**
	 * Get all available sources
	 */
	static getAllSources(): BaseSocialMediaSource[] {
		return [
			this.getSource('TWITTER'),
			this.getSource('INSTAGRAM'),
		];
	}

	/**
	 * Initialize all sources
	 */
	static async initializeAll(): Promise<void> {
		const sources = this.getAllSources();
		await Promise.all(sources.map(source => source.initialize()));
	}

	/**
	 * Cleanup all sources
	 */
	static async cleanupAll(): Promise<void> {
		const sources = Array.from(this.instances.values());
		await Promise.all(sources.map(source => source.cleanup()));
		this.instances.clear();
	}
}
