# Scraper Test Suite

This directory contains test files for the Playwright-based scrapers.

## Available Tests

### 1. Twitter Scraper Test

**File**: `test-twitter-scraper.ts`  
**Command**: `npm run test:twitter`

Tests the Twitter scraper in isolation and displays results to console.

**Output includes:**

- Initialization status
- Connection test results
- List of scraped tweets
- Engagement statistics
- Summary analytics

---

### 2. Instagram Scraper Test

**File**: `test-instagram-scraper.ts`  
**Command**: `npm run test:instagram`

Tests the Instagram scraper in isolation and displays results to console.

**Output includes:**

- Initialization status
- Connection test results
- List of scraped posts
- Engagement statistics
- Summary analytics

---

### 3. Combined Scraper Test

**File**: `test-both-scrapers.ts`  
**Command**: `npm run test:scrapers`

Tests both scrapers together and provides combined analytics.

**Output includes:**

- Results from both platforms
- Combined statistics
- Comparative analysis
- Top posts from each platform

---

## Running Tests

```bash
# From Backend directory

# Test Twitter only
npm run test:twitter

# Test Instagram only
npm run test:instagram

# Test both scrapers
npm run test:scrapers
```

## Prerequisites

Playwright browsers must be installed:

```bash
npx playwright install chromium
```

## Test Configuration

### Default Settings

- **Twitter**: 10-15 posts per hashtag
- **Instagram**: 8-10 posts per hashtag
- **Hashtags**: Fashion-focused (fashion, streetwear, ootd, etc.)

### Customizing Tests

Edit the test files to change settings:

```typescript
// Change hashtags
const posts = await twitterSource.scrape({
  hashtags: ["your", "custom", "tags"],
  maxPosts: 50, // Change number of posts
});
```

## What To Expect

### Success Indicators

- ✅ "Initialization successful"
- ✅ "Connection test: PASSED"
- ✅ "Successfully scraped X posts"
- ✅ Detailed post information displayed
- ✅ "Test completed successfully"

### Common Issues

- ❌ "Browser not found" → Run `npx playwright install chromium`
- ❌ "Connection test: FAILED" → Check internet connection
- ❌ "Scraped 0 posts" → Platform may have changed, or hashtag has no recent posts

## Output Format

Each test displays:

1. **Step-by-step progress** (initialization, connection, scraping)
2. **Individual post details** (author, text, engagement, images)
3. **Summary statistics** (totals, averages, counts)
4. **Cleanup confirmation**

## For More Information

- **Quick Start**: See `../QUICKSTART_SCRAPING.md`
- **Full Documentation**: See `../SCRAPING_GUIDE.md`
- **Example Usage**: See `../examples/scrape-fashion-data.ts`
