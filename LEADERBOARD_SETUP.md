# Leaderboard Daily Updates Setup

The leaderboard system is designed to update daily with cached data for performance.

## How It Works

1. **Automatic Daily Updates**: The leaderboard automatically checks if cached data is older than 24 hours and triggers a background refresh
2. **Cached Data**: Leaderboard data is stored in the `leaderboard_cache` table for fast loading
3. **Manual Refresh**: Admins can manually trigger a refresh using the "Refresh Now" button

## Setup Instructions

### 1. Run the Database Migration

Execute the SQL script to create the cache table:
```bash
# The script is located at: scripts/014_create_leaderboard_cache.sql
```

### 2. Set Up Automatic Daily Refresh (Optional but Recommended)

For automatic daily updates, set up a cron job that calls the refresh API:

**Option A: Vercel Cron Jobs**
Add to your `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/leaderboard/refresh",
    "schedule": "0 0 * * *"
  }]
}
```

**Option B: External Cron Service**
Use a service like cron-job.org or EasyCron to call:
```
https://your-domain.com/api/leaderboard/refresh
```
Schedule: Daily at midnight (0 0 * * *)

### 3. Initial Cache Population

After setup, manually trigger the first refresh:
- As an admin, visit the leaderboard page and click "Refresh Now"
- Or call the API directly: `POST https://your-domain.com/api/leaderboard/refresh`

## Features

- **Top Traders**: Displays top 25 users by trading volume (fetched from blockchain)
- **Most Active**: Shows top 25 users by accumulated points (trading + comments)
- **Last Updated Timestamp**: Shows when the data was last refreshed
- **Admin Controls**: Admins can manually refresh the leaderboard anytime
- **Automatic Refresh**: Stale data (>24 hours) triggers background refresh automatically

## API Endpoints

### POST /api/leaderboard/refresh
Refreshes the leaderboard cache with fresh data from the blockchain and database.

**Response:**
```json
{
  "success": true,
  "message": "Leaderboard refreshed successfully",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "data": {
    "topTraders": 25,
    "mostActive": 25
  }
}
```

### GET /api/leaderboard/refresh
Same as POST - useful for cron jobs that only support GET requests.

## Performance

- Cached data loads instantly (no blockchain calls)
- Background refresh happens asynchronously
- Users always see data, even during refresh
- Blockchain queries only happen during refresh (not on every page load)
