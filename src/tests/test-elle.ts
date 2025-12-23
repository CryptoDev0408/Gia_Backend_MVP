/**
 * Elle Fashion Scraper + Normalization Test
 * Tests complete workflow: Scraping → AI Normalization
 */
import { ElleSource } from '../sources/elle.source';
import { NormalizationService } from '../services/normalization.service';
import { ScrapingConditions } from '../sources/base.source';

async function testElleWorkflow() {
	console.log('\n==========================================================');
	console.log('🧪 TESTING ELLE FASHION COMPLETE WORKFLOW');
	console.log('   1. Scraping Elle.com fashion articles');
	console.log('   2. AI Normalization with OpenAI');
	console.log('==========================================================\n');

	const scraper = new ElleSource();

	try {
		// ============================================
		// STEP 1: SCRAPING
		// ============================================
		console.log('📡 STEP 1: Testing Elle fashion connection...');
		await scraper.initialize();
		const isConnected = await scraper.testConnection();

		if (isConnected) {
			console.log('✅ Connection successful!\n');
		} else {
			console.log('⚠️  Connection test failed, but continuing with scraping attempt...\n');
		}

		console.log('📰 STEP 1: Scraping Elle fashion articles...');
		console.log('⏳ This may take 1-2 minutes...\n');

		const scrapingConditions: ScrapingConditions = {
			keywords: ['fashion', 'style', 'runway', 'designer', 'collection', 'trend'],
			maxResults: 10,
			pageTimeout: 90000
		};

		const posts = await scraper.scrape(scrapingConditions);

		console.log('==========================================================');
		console.log(`✅ SCRAPING COMPLETED - Found ${posts.length} articles`);
		console.log('==========================================================\n');

		if (posts.length === 0) {
			console.log('❌ No articles found. Cannot proceed with normalization.');
			console.log('   Please check your internet connection and try again.\n');
			await scraper.cleanup();
			process.exit(1);
		}

		// Display scraped articles
		console.log('📊 SCRAPED ARTICLES:');
		console.log('----------------------------------------------------------');
		posts.slice(0, 3).forEach((post, index) => {
			console.log(`\n${index + 1}. ${post.rawContent?.title || 'Untitled'}`);
			console.log(`   📅 Posted: ${post.postedAt.toISOString()}`);
			console.log(`   🔗 URL: ${post.sourceUrl}`);
			console.log(`   🖼️  Images: ${post.mediaUrls?.length || 0}`);
		});

		console.log('\n');

		// ============================================
		// STEP 2: AI NORMALIZATION
		// ============================================
		console.log('==========================================================');
		console.log('🤖 STEP 2: AI NORMALIZATION WITH OPENAI');
		console.log('==========================================================\n');

		console.log('⏳ Sending data to OpenAI for normalization...');
		console.log('   This may take 30-60 seconds...\n');

		const normalizedData = await NormalizationService.normalizeWithAI(posts, 'ELLE');

		console.log('==========================================================');
		console.log(`✅ AI NORMALIZATION COMPLETED - ${normalizedData.length} posts normalized`);
		console.log('==========================================================\n');

		// Save normalized data
		console.log('💾 Saving normalized data to file...');
		const filepath = await NormalizationService.saveNormalizedData(normalizedData, 'ELLE');
		console.log(`✅ Saved to: ${filepath}\n`);

		// Display normalized results
		console.log('📋 NORMALIZED RESULTS (First 2 articles):');
		console.log('----------------------------------------------------------');

		normalizedData.slice(0, 2).forEach((post, index) => {
			console.log(`\n${index + 1}. ${post.Title}`);
			console.log(`   💡 AI Insight: ${post.AI_Insight}`);
			console.log(`   📝 Description: ${post.Description}`);
			console.log(`   🔗 Link: ${post.Link}`);
			console.log(`   🏷️  Hashtags: ${post.Hashtags.join(', ')}`);
			console.log(`   🖼️  Image: ${post.Image ? 'Available' : 'None'}`);
		});

		console.log('\n');
		console.log('==========================================================');
		console.log('✅ COMPLETE WORKFLOW FINISHED SUCCESSFULLY');
		console.log('==========================================================');
		console.log(`\n📊 Summary:`);
		console.log(`   • Scraped: ${posts.length} articles`);
		console.log(`   • Normalized: ${normalizedData.length} articles`);
		console.log(`   • Output: ${filepath}`);
		console.log('');

		// Cleanup
		await scraper.cleanup();

	} catch (error: any) {
		console.error('\n❌ ERROR OCCURRED:');
		console.error('----------------------------------------------------------');
		console.error(error.message);
		console.error('');

		if (error.message?.includes('API key')) {
			console.error('💡 HINT: Make sure you have set OPENAI_API_KEY in your .env file');
			console.error('   Example: OPENAI_API_KEY=sk-your-actual-key-here\n');
		}

		await scraper.cleanup();
		process.exit(1);
	}
}

// Run the test
testElleWorkflow();
