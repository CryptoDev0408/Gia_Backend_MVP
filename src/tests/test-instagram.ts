/**
 * Instagram Fashion Scraper Test
 * Tests Instagram scraping with fashion-oriented conditions
 */
import { InstagramFashionSource } from '../sources/instagram.source';
import { ScrapingConditions } from '../sources/base.source';

async function testInstagramScraper() {
	console.log('\n==========================================================');
	console.log('🧪 TESTING INSTAGRAM FASHION SCRAPER');
	console.log('==========================================================\n');

	const scraper = new InstagramFashionSource();

	try {
		// Test 1: Connection Test
		console.log('📡 Test 1: Testing Instagram connection...');
		await scraper.initialize();
		const isConnected = await scraper.testConnection();

		if (isConnected) {
			console.log('✅ Connection successful!\n');
		} else {
			console.log('❌ Connection failed!\n');
			return;
		}

		// Test 2: Scrape with default conditions
		console.log('📸 Test 2: Scraping with default conditions...');
		console.log('⏳ This may take 1-2 minutes...\n');

		const posts = await scraper.scrape();

		console.log('==========================================================');
		console.log(`✅ SCRAPING COMPLETED - Found ${posts.length} posts`);
		console.log('==========================================================\n');

		if (posts.length > 0) {
			// Display summary
			console.log('📊 SCRAPING SUMMARY:');
			console.log('----------------------------------------------------------');

			const totalLikes = posts.reduce((sum, post) => sum + (post.likes || 0), 0);
			const totalComments = posts.reduce((sum, post) => sum + (post.comments || 0), 0);
			const avgLikes = Math.round(totalLikes / posts.length);
			const avgComments = Math.round(totalComments / posts.length);

			console.log(`Total Posts: ${posts.length}`);
			console.log(`Total Likes: ${totalLikes.toLocaleString()}`);
			console.log(`Total Comments: ${totalComments.toLocaleString()}`);
			console.log(`Average Likes: ${avgLikes.toLocaleString()}`);
			console.log(`Average Comments: ${avgComments.toLocaleString()}`);
			console.log('');

			// Display top 5 posts
			console.log('📈 TOP 5 POSTS BY ENGAGEMENT:');
			console.log('----------------------------------------------------------');

			const topPosts = [...posts].sort((a, b) => (b.likes || 0) - (a.likes || 0)).slice(0, 5);

			topPosts.forEach((post, index) => {
				console.log(`\n${index + 1}. @${post.authorHandle} (${post.author})`);
				console.log(`   💗 Likes: ${(post.likes || 0).toLocaleString()}`);
				console.log(`   💬 Comments: ${(post.comments || 0).toLocaleString()}`);
				console.log(`   📅 Posted: ${post.postedAt.toISOString()}`);
				console.log(`   🔗 URL: ${post.sourceUrl}`);
				console.log(`   📝 Caption: ${post.text.substring(0, 100)}${post.text.length > 100 ? '...' : ''}`);
				console.log(`   🖼️  Images: ${post.mediaUrls?.length || 0}`);
			});

			console.log('\n');

			// Test 3: Scrape with custom conditions
			console.log('📸 Test 3: Scraping with custom conditions...');
			console.log('   Hashtags: #fashionweek, #runway');
			console.log('   Max Results: 10');
			console.log('   Min Likes: 500');
			console.log('⏳ This may take 1-2 minutes...\n');

			const customConditions: ScrapingConditions = {
				hashtags: ['fashionweek', 'runway'],
				maxResults: 10,
				maxPostsPerHashtag: 5,
				minLikes: 500,
				pageTimeout: 30000,
				scrollTimeout: 2000,
			};

			const customPosts = await scraper.scrape(customConditions);

			console.log('==========================================================');
			console.log(`✅ CUSTOM SCRAPING COMPLETED - Found ${customPosts.length} posts`);
			console.log('==========================================================\n');

			if (customPosts.length > 0) {
				console.log('📋 SAMPLE POST DATA (First Post):');
				console.log('----------------------------------------------------------');
				const samplePost = customPosts[0];
				console.log(JSON.stringify({
					platformPostId: samplePost.platformPostId,
					platform: samplePost.platform,
					author: samplePost.author,
					authorHandle: samplePost.authorHandle,
					text: samplePost.text.substring(0, 150) + '...',
					likes: samplePost.likes,
					comments: samplePost.comments,
					postedAt: samplePost.postedAt,
					sourceUrl: samplePost.sourceUrl,
					mediaCount: samplePost.mediaUrls?.length || 0,
				}, null, 2));
			} else {
				console.log('ℹ️  No posts met the custom conditions (min 500 likes)');
			}
		} else {
			console.log('⚠️  No posts found. This could be due to:');
			console.log('   - Rate limiting from Instagram');
			console.log('   - Content requiring login');
			console.log('   - Network issues');
			console.log('   Try running the test again in a few minutes.');
		}

	} catch (error: any) {
		console.error('\n❌ ERROR:', error.message);
		console.error('Stack:', error.stack);
	} finally {
		// Cleanup
		console.log('\n🧹 Cleaning up...');
		await scraper.cleanup();
		console.log('✅ Cleanup complete');
		console.log('\n==========================================================\n');
	}
}

// Run the test
testInstagramScraper()
	.then(() => {
		console.log('Test completed successfully');
		process.exit(0);
	})
	.catch((error) => {
		console.error('Test failed:', error);
		process.exit(1);
	});
