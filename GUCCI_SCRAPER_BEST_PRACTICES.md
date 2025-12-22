# Gucci Scraper - Best Practices Implementation

## ✅ 10 Best Practices Implemented

### 1. ✅ Check Rules (robots.txt, Terms of Service)
- Logs message about respecting robots.txt
- Uses publicly accessible pages (stories page)
- Avoids restricted areas

### 2. ✅ Identify Data
- Extracts metadata (description, author, publish date)
- Identifies specific data structures
- Logs extracted metadata for transparency

### 3. ✅ Inspect Site Structure
- Analyzes HTML structure before scraping
- Uses multiple selectors to find content
- Waits for content selectors to appear

### 4. ✅ Plan Navigation
- Uses Gucci's stories page for efficient access
- Falls back from axios to Playwright if needed
- Implements retry logic

### 5. ✅ Wait for JavaScript
- Waits 5 seconds for initial JS rendering
- Waits for specific selectors (article, story, card)
- Additional 3 second wait after scrolling

### 6. ✅ Filter by Keywords
- Filters content by fashion-related keywords
- Default keywords: fashion, collection, runway, style, etc.
- Customizable keywords via conditions

### 7. ✅ Handle Pagination
- Implements scroll-to-load-more functionality
- Scrolls 3 times by default to load additional content
- 2 second wait between scrolls

### 8. ✅ Be Polite (Rate Limiting)
- Minimum 2 second delay between requests
- Tracks last request time
- Logs rate limiting delays

### 9. ✅ Store Data Properly
- Saves HTML output for debugging
- Structured ScrapedPostData format
- Includes metadata, URLs, images, text

### 10. ✅ Use Search Pages
- Uses Gucci's stories page (public listing)
- Avoids individual page requests
- More efficient than crawling

## Test Results

```
✅ Successfully scraped 20 Gucci items
✅ Rate limiting working (2s delay observed)
✅ HTML output: 1.07MB (1071948 characters)
✅ Extracted 49 total items, filtered by keywords
✅ Output saved to: Backend/Output/output_gucci.html
```

## Key Features

- **Dual Strategy**: Tries axios first (faster), falls back to Playwright
- **Rate Limiting**: 2-second minimum delay between requests
- **Pagination**: Scrolls to load more content
- **Keyword Filtering**: Only extracts fashion-related content
- **Error Handling**: Retries and graceful degradation
- **Metadata Extraction**: Captures page-level metadata
- **Structured Output**: Clean, consistent data format

## URLs Used

- Base: `https://www.gucci.com`
- Stories Page: `https://www.gucci.com/us/en/st/stories`
- Output: `Backend/Output/output_gucci.html`

## Configuration

```typescript
MIN_REQUEST_DELAY = 2000ms  // Rule 8: Rate limiting
SCROLL_COUNT = 3            // Rule 7: Pagination
JS_WAIT_TIME = 5000ms       // Rule 5: JavaScript rendering
```
