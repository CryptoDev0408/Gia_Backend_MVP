# Blog Likes API Documentation

## Overview

The Blog Likes API allows authenticated users to like and unlike blog posts. Each user can like a blog only once, and the system tracks the total number of likes per blog.

## Database Schema

### `blog_likes` Table

```sql
CREATE TABLE blog_likes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    blog_id INT NOT NULL,
    createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE KEY unique_user_blog (user_id, blog_id),
    INDEX idx_user_id (user_id),
    INDEX idx_blog_id (blog_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (blog_id) REFERENCES blogs(id) ON DELETE CASCADE
);
```

**Key Features:**

- Composite unique constraint on `(user_id, blog_id)` prevents duplicate likes
- Cascading deletes ensure data integrity
- Indexed for fast lookups by user or blog
- Automatic timestamp tracking

---

## API Endpoints

### 1. Get All Blogs (with Like Data)

**GET** `/api/v1/blogs`

Retrieves blogs with like information included for authenticated users.

#### Authentication

- **Optional** - Unauthenticated users can access approved blogs
- **Bearer Token** - Include JWT token in Authorization header for personalized like data

#### Query Parameters

| Parameter           | Type    | Default | Description                                 |
| ------------------- | ------- | ------- | ------------------------------------------- |
| `page`              | number  | 1       | Page number for pagination                  |
| `limit`             | number  | 20      | Number of blogs per page                    |
| `platform`          | string  | -       | Filter by platform (e.g., "Elle", "Harper") |
| `includeUnapproved` | boolean | false   | Show unapproved blogs (admin only)          |

#### Response

```json
{
  "success": true,
  "data": {
    "blogs": [
      {
        "id": 1,
        "platform": "Elle",
        "title": "Spring Fashion Trends 2025",
        "description": "...",
        "image": "https://...",
        "link": "https://...",
        "approved": 1,
        "likesCount": 42,
        "isLiked": true,
        "createdAt": "2025-12-26T10:30:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "totalPages": 8
    }
  }
}
```

#### Response Fields (Authenticated Users)

- `likesCount`: Total number of likes for the blog
- `isLiked`: Boolean indicating if current user has liked the blog

#### Response Fields (Unauthenticated Users)

- `likesCount`: Total number of likes for the blog
- `isLiked`: Always `false` (no user context)

---

### 2. Like a Blog

**POST** `/api/v1/blogs/:id/like`

Adds a like from the authenticated user to the specified blog.

#### Authentication

**Required** - Bearer token in Authorization header

#### Parameters

| Parameter | Location | Type   | Description     |
| --------- | -------- | ------ | --------------- |
| `id`      | Path     | number | Blog ID to like |

#### Success Response (201)

```json
{
  "success": true,
  "data": {
    "message": "Blog liked successfully",
    "likesCount": 43
  }
}
```

#### Error Responses

**Blog Not Found (404)**

```json
{
  "success": false,
  "error": "Blog not found"
}
```

**Already Liked (400)**

```json
{
  "success": false,
  "error": "You have already liked this blog",
  "data": {
    "likesCount": 42
  }
}
```

**Unauthorized (401)**

```json
{
  "success": false,
  "error": "Authentication required"
}
```

---

### 3. Unlike a Blog

**DELETE** `/api/v1/blogs/:id/like`

Removes the authenticated user's like from the specified blog.

#### Authentication

**Required** - Bearer token in Authorization header

#### Parameters

| Parameter | Location | Type   | Description       |
| --------- | -------- | ------ | ----------------- |
| `id`      | Path     | number | Blog ID to unlike |

#### Success Response (200)

```json
{
  "success": true,
  "data": {
    "message": "Blog unliked successfully",
    "likesCount": 41
  }
}
```

#### Error Responses

**Blog Not Found (404)**

```json
{
  "success": false,
  "error": "Blog not found"
}
```

**Not Liked (400)**

```json
{
  "success": false,
  "error": "You have not liked this blog"
}
```

**Unauthorized (401)**

```json
{
  "success": false,
  "error": "Authentication required"
}
```

---

## Usage Examples

### JavaScript/TypeScript (with Axios)

```typescript
import axios from "axios";

const API_BASE_URL = "https://your-api.com/api/v1";
const token = localStorage.getItem("token");

// Create axios instance with auth
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    Authorization: `Bearer ${token}`,
  },
});

// Get blogs with like data
async function getBlogs() {
  const response = await apiClient.get("/blogs");
  return response.data.data.blogs;
}

// Like a blog
async function likeBlog(blogId: number) {
  try {
    const response = await apiClient.post(`/blogs/${blogId}/like`);
    console.log("Liked! New count:", response.data.data.likesCount);
    return response.data.data;
  } catch (error) {
    if (error.response?.status === 400) {
      console.log("Already liked");
    }
    throw error;
  }
}

// Unlike a blog
async function unlikeBlog(blogId: number) {
  try {
    const response = await apiClient.delete(`/blogs/${blogId}/like`);
    console.log("Unliked! New count:", response.data.data.likesCount);
    return response.data.data;
  } catch (error) {
    if (error.response?.status === 400) {
      console.log("Not liked yet");
    }
    throw error;
  }
}

// Toggle like (smart function)
async function toggleLike(blogId: number, isLiked: boolean) {
  if (isLiked) {
    return await unlikeBlog(blogId);
  } else {
    return await likeBlog(blogId);
  }
}
```

---

## Architecture & Best Practices

### Database Design

✅ **Unique Constraint**: Prevents duplicate likes automatically at database level
✅ **Cascading Deletes**: Maintains referential integrity when users or blogs are deleted
✅ **Indexes**: Fast lookups for user-specific and blog-specific queries
✅ **Timestamps**: Track when likes were created for analytics

### API Design

✅ **RESTful**: Standard HTTP methods (POST for create, DELETE for remove)
✅ **Idempotent**: Multiple identical requests produce same result
✅ **Error Handling**: Clear error messages with appropriate HTTP status codes
✅ **Atomic Operations**: Like/unlike operations are transactional
✅ **Performance**: Efficient batch queries for multiple blogs

### Security

✅ **Authentication Required**: Only authenticated users can like/unlike
✅ **User Isolation**: Users can only manage their own likes
✅ **Input Validation**: Blog IDs are validated and sanitized
✅ **SQL Injection Protection**: Using parameterized queries
✅ **Rate Limiting**: (Recommended) Implement rate limiting for like endpoints

### Frontend Integration

✅ **Optimistic Updates**: Update UI immediately, rollback on error
✅ **Loading States**: Show loading indicator during API calls
✅ **Error Handling**: Display user-friendly error messages
✅ **Real-time Counts**: Display updated like counts immediately

---

## Error Handling

All endpoints follow a consistent error response format:

```typescript
interface ErrorResponse {
  success: false;
  error: string;
  data?: any; // Optional additional error context
}
```

### Common Error Scenarios

1. **Already Liked**: User tries to like a blog they've already liked

   - Frontend should prevent this by checking `isLiked` status
   - Backend returns 400 with current like count

2. **Not Liked**: User tries to unlike a blog they haven't liked

   - Frontend should prevent this by checking `isLiked` status
   - Backend returns 400 error

3. **Blog Not Found**: Invalid blog ID provided

   - Backend returns 404 error
   - Frontend should handle gracefully

4. **Unauthorized**: No authentication token or invalid token
   - Backend returns 401 error
   - Frontend should redirect to login

---

## Performance Considerations

### Efficient Batch Queries

The GET `/blogs` endpoint uses optimized queries:

1. Fetch all blogs in one query
2. Batch fetch like counts for all blogs
3. Batch fetch user's liked status for all blogs
4. Map data in memory (O(n) complexity)

### Query Optimization

```sql
-- Instead of N queries (bad):
SELECT COUNT(*) FROM blog_likes WHERE blog_id = 1;
SELECT COUNT(*) FROM blog_likes WHERE blog_id = 2;
-- ... (repeated N times)

-- Use single query (good):
SELECT blog_id, COUNT(*) as likesCount
FROM blog_likes
WHERE blog_id IN (1, 2, 3, ..., N)
GROUP BY blog_id;
```

### Caching Strategy (Future Enhancement)

- Cache like counts with Redis (TTL: 60 seconds)
- Invalidate cache on like/unlike operations
- Reduces database load for popular blogs

---

## Testing Checklist

### Unit Tests

- [ ] Like a blog successfully
- [ ] Unlike a blog successfully
- [ ] Prevent duplicate likes
- [ ] Handle non-existent blogs
- [ ] Handle unauthorized requests
- [ ] Verify like counts update correctly

### Integration Tests

- [ ] Multiple users liking same blog
- [ ] User likes multiple blogs
- [ ] Cascade delete on user deletion
- [ ] Cascade delete on blog deletion
- [ ] Concurrent like/unlike operations

### Frontend Tests

- [ ] Like button shows correct state
- [ ] Like count updates immediately
- [ ] Optimistic updates work correctly
- [ ] Error handling displays properly
- [ ] Loading states display properly

---

## Monitoring & Analytics

### Recommended Metrics

- Total likes per blog (engagement metric)
- Likes per user (user activity metric)
- Like/unlike ratio (user satisfaction)
- Most liked blogs (trending content)
- Like growth over time (virality metric)

### Sample Analytics Queries

```sql
-- Most liked blogs
SELECT b.id, b.title, COUNT(bl.id) as likes
FROM blogs b
LEFT JOIN blog_likes bl ON b.id = bl.blog_id
GROUP BY b.id
ORDER BY likes DESC
LIMIT 10;

-- Most active users
SELECT u.id, u.username, COUNT(bl.id) as total_likes
FROM users u
LEFT JOIN blog_likes bl ON u.id = bl.user_id
GROUP BY u.id
ORDER BY total_likes DESC
LIMIT 10;

-- Daily like activity
SELECT DATE(createdAt) as date, COUNT(*) as likes
FROM blog_likes
GROUP BY DATE(createdAt)
ORDER BY date DESC;
```

---

## Migration & Deployment

### Initial Setup

The `blog_likes` table is automatically created when the server starts if it doesn't exist. The initialization is handled in `src/database/client.ts`:

```typescript
await prisma.$executeRawUnsafe(`
  CREATE TABLE IF NOT EXISTS blog_likes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    blog_id INT NOT NULL,
    createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE KEY unique_user_blog (user_id, blog_id),
    INDEX idx_user_id (user_id),
    INDEX idx_blog_id (blog_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (blog_id) REFERENCES blogs(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`);
```

### Deployment Checklist

- [x] Table creation script in place
- [x] Foreign key constraints configured
- [x] Indexes created for performance
- [x] API endpoints implemented
- [x] Authentication middleware in place
- [x] Error handling implemented
- [x] Logging configured
- [ ] Rate limiting (recommended)
- [ ] Monitoring/alerts setup (recommended)

---

## Support & Troubleshooting

### Common Issues

**Issue**: Duplicate key errors

- **Cause**: Race condition with concurrent like requests
- **Solution**: Frontend should disable like button during API call

**Issue**: Like count doesn't update

- **Cause**: Frontend not refreshing after like/unlike
- **Solution**: Update local state after successful API response

**Issue**: Slow performance with many blogs

- **Cause**: Individual queries for each blog's like count
- **Solution**: Already optimized with batch queries

---

## Changelog

### v1.0.0 (2025-12-26)

- ✅ Initial implementation
- ✅ Database table creation
- ✅ Like/unlike API endpoints
- ✅ Integration with GET /blogs endpoint
- ✅ Authentication & authorization
- ✅ Error handling
- ✅ Batch query optimization

### Future Enhancements

- [ ] Rate limiting
- [ ] Redis caching
- [ ] WebSocket for real-time updates
- [ ] Like notifications
- [ ] Analytics dashboard
