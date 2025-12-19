# Backend Setup Guide

## Step-by-Step Installation

### 1. Install Dependencies

```bash
cd Backend
npm install
```

### 2. Configure Environment

Create `.env` file:

```bash
cp .env.example .env
```

Edit `.env` and configure:

```env
# Database
DATABASE_URL="mysql://root:password@localhost:3306/gia_ai_blog"

# JWT
JWT_SECRET=your-super-secret-key-here
JWT_REFRESH_SECRET=your-refresh-secret-here

# OpenAI
OPENAI_API_KEY=sk-your-openai-api-key

# Twitter (Get from https://developer.twitter.com)
TWITTER_BEARER_TOKEN=your-bearer-token
```

### 3. Setup MySQL Database

```bash
# Login to MySQL
mysql -u root -p

# Create database
CREATE DATABASE gia_ai_blog;
exit;
```

### 4. Run Database Migrations

```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev --name init

# (Optional) Open Prisma Studio to view database
npx prisma studio
```

### 5. Start Development Server

```bash
npm run dev
```

Server will start on `http://localhost:4000`

### 6. Test API

```bash
# Health check
curl http://localhost:4000/api/v1/health

# Expected response:
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "...",
    "uptime": ...
  }
}
```

## Getting API Credentials

### Twitter API

1. Go to https://developer.twitter.com/en/portal/dashboard
2. Create a new app
3. Generate Bearer Token
4. Add to `.env` as `TWITTER_BEARER_TOKEN`

### OpenAI API

1. Go to https://platform.openai.com/api-keys
2. Create new API key
3. Add to `.env` as `OPENAI_API_KEY`

### Instagram

Instagram doesn't have a public API for posts. The backend uses Playwright for web scraping.

## Testing the Pipeline

### Manual Scraping Test

```bash
# Register admin user first
curl -X POST http://localhost:4000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@gia.com",
    "password": "admin123",
    "username": "admin"
  }'

# Update user to admin role in database:
# UPDATE users SET role='ADMIN' WHERE email='admin@gia.com';

# Login and get token
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@gia.com",
    "password": "admin123"
  }'

# Trigger manual scraping
curl -X POST http://localhost:4000/api/v1/admin/scrape/trigger \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## Production Deployment

### 1. Build

```bash
npm run build
```

### 2. Environment

Set `NODE_ENV=production` in `.env`

### 3. Start

```bash
npm start
```

### 4. Process Manager (Recommended)

```bash
# Install PM2
npm install -g pm2

# Start with PM2
pm2 start dist/server.js --name gia-backend

# Auto-restart on server reboot
pm2 startup
pm2 save
```

## Troubleshooting

### "Cannot connect to database"

- Check MySQL is running: `systemctl status mysql`
- Verify DATABASE_URL in `.env`
- Check credentials are correct

### "Twitter API rate limit exceeded"

- Twitter has rate limits (450 requests/15min)
- Reduce `SCRAPING_INTERVAL_MINUTES` in `.env`
- Use pagination in scraping

### "OpenAI API error"

- Check API key is valid
- Verify you have credits
- Check model name is correct (gpt-4-turbo-preview)

### "Instagram scraping not working"

- Instagram actively blocks scrapers
- May need to rotate user agents
- Consider using official Instagram Graph API (for business accounts)

## Database Management

### View Data

```bash
npx prisma studio
```

### Reset Database

```bash
npx prisma migrate reset
```

### Backup Database

```bash
mysqldump -u root -p gia_ai_blog > backup.sql
```

### Restore Database

```bash
mysql -u root -p gia_ai_blog < backup.sql
```

## Monitoring

### View Logs

```bash
# App logs
tail -f logs/app.log

# Error logs
tail -f logs/error.log
```

### System Stats

```bash
curl http://localhost:4000/api/v1/admin/stats \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

## Next Steps

1. ✅ Backend is ready
2. Configure API credentials
3. Test scraping pipeline
4. Connect frontend to backend
5. Deploy to production server

## Frontend Integration

Update Frontend `.env`:

```env
VITE_API_URL=http://localhost:4000/api/v1
```

The frontend can now consume:

- `GET /api/v1/trends` - Get trends for AI Blog page
- `POST /api/v1/auth/*` - Authentication
- `POST /api/v1/posts/:id/like` - User interactions
