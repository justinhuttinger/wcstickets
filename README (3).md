# ClickUp Time in Status Tracker

A simple Node.js server that calculates the **average time tasks spend in "To Do" status** for your ClickUp lists.

## What It Does

- Pulls all tasks from your configured lists
- Gets the time in status data for each task
- Calculates the average time spent in "To Do" status
- Displays a clean dashboard you can embed in ClickUp

## Setup

### 1. Install Dependencies

```bash
cd clickup-time-tracker
npm install
```

### 2. Configure Your Lists

Edit `server.js` and update the `LISTS` array if you need to add/change lists:

```javascript
const LISTS = [
  {
    id: '901112845228',        // List ID from URL
    name: 'Inventory Addition', // Display name
    statusToTrack: 'to do'      // Status to measure (case insensitive)
  },
  {
    id: '901112845576',
    name: 'New Hire',
    statusToTrack: 'to do'
  }
];
```

### 3. Run the Server

```bash
npm start
```

Server will run at `http://localhost:3000`

## Endpoints

| Endpoint | Description |
|----------|-------------|
| `/` | HTML dashboard (embeddable) |
| `/api/stats` | JSON data for programmatic access |

## Deploying for ClickUp Embed

To embed in ClickUp, you need the server hosted publicly. Options:

### Option A: Render.com (Free)

1. Push code to GitHub
2. Go to [render.com](https://render.com)
3. Create new "Web Service"
4. Connect your repo
5. It will auto-deploy and give you a URL like `https://your-app.onrender.com`

### Option B: Railway.app (Free tier)

1. Go to [railway.app](https://railway.app)
2. "New Project" → "Deploy from GitHub"
3. Connect repo and deploy

### Option C: Your Existing Server

If you already have a Node server running (like your ABC/GHL sync), add the routes to that server.

## Embedding in ClickUp

1. Open a Dashboard in ClickUp
2. Click **+ Add Card**
3. Search for **Embed**
4. Paste your hosted URL
5. Click **Add Card**

## Adding More Lists

Just add more entries to the `LISTS` array:

```javascript
const LISTS = [
  { id: '901112845228', name: 'Inventory Addition', statusToTrack: 'to do' },
  { id: '901112845576', name: 'New Hire', statusToTrack: 'to do' },
  { id: '123456789012', name: 'Support Tickets', statusToTrack: 'open' },
  // Add more here...
];
```

## Tracking Different Statuses

You can track any status, not just "To Do":

```javascript
{ id: '123456789012', name: 'Bug Fixes', statusToTrack: 'in progress' }
```

## Notes

- The first load may take a few seconds if you have many tasks (API rate limiting)
- Data refreshes each time you load the page
- For caching, you could add Redis or just store results in memory with a TTL

## Security

⚠️ Your API key is in the code. For production:
- Use environment variables: `process.env.CLICKUP_API_KEY`
- Or use a `.env` file with `dotenv` package
