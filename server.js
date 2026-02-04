const express = require('express');
const path = require('path');
const app = express();

// Serve static files (logo, etc.)
app.use(express.static(path.join(__dirname)));

const CLICKUP_API_KEY = process.env.CLICKUP_API_KEY || 'pk_96281769_0QYS1QJP2XT4580M8N76661HH45DPZUP';

// Cache settings
let cachedResults = null;
let lastFetchTime = null;
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes in milliseconds
let isFetching = false;

// Configure your lists here
// Set customFieldName to the field you want to display (we'll log available fields on first run)
const LISTS = [
  {
    id: '901112845228',
    name: 'Inventory Addition',
    statusToTrack: 'to do',
    customFieldName: 'Item Name'
  },
  {
    id: '901112845576',
    name: 'New Hire',
    statusToTrack: 'open',
    customFieldName: 'First Name'
  },
  {
    id: '901112959393',
    name: 'Staff Updates',
    statusToTrack: 'to do',
    customFieldName: 'First Name'
  },
  {
    id: '901112959189',
    name: 'Offboarding',
    statusToTrack: 'to do',
    customFieldName: 'First Name'
  },
  {
    id: '901113045232',
    name: 'New Help Center Docs',
    statusToTrack: 'to do',
    customFieldName: null
  }
];

// Helper to format minutes into readable time
function formatTime(minutes) {
  if (!minutes || minutes === 0) return '0m';
  
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) {
    const remainingHours = hours % 24;
    return `${days}d ${remainingHours}h`;
  } else if (hours > 0) {
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  } else {
    return `${minutes}m`;
  }
}

// Format milliseconds to readable time
function formatMsToTime(ms) {
  const minutes = Math.floor(ms / 60000);
  return formatTime(minutes);
}

// Fetch all tasks from a list
async function getTasksFromList(listId) {
  const tasks = [];
  let page = 0;
  let hasMore = true;
  
  while (hasMore) {
    const url = `https://api.clickup.com/api/v2/list/${listId}/task?page=${page}&include_closed=true`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': CLICKUP_API_KEY
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch tasks: ${response.status}`);
    }
    
    const data = await response.json();
    tasks.push(...data.tasks);
    
    hasMore = data.tasks.length === 100;
    page++;
  }
  
  return tasks;
}

// Get custom fields for a list (for debugging)
async function getListCustomFields(listId) {
  const url = `https://api.clickup.com/api/v2/list/${listId}/field`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': CLICKUP_API_KEY
    }
  });
  
  if (!response.ok) {
    console.error(`Failed to get custom fields: ${response.status}`);
    return [];
  }
  
  const data = await response.json();
  return data.fields || [];
}

// Get time in status for a single task
async function getTimeInStatus(taskId) {
  const url = `https://api.clickup.com/api/v2/task/${taskId}/time_in_status`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': CLICKUP_API_KEY
    }
  });
  
  if (!response.ok) {
    return null;
  }
  
  return await response.json();
}

// Get custom field value from task
function getCustomFieldValue(task, fieldName) {
  if (!fieldName || !task.custom_fields) return null;
  
  const field = task.custom_fields.find(
    f => f.name && f.name.toLowerCase() === fieldName.toLowerCase()
  );
  
  if (!field) return null;
  
  // Handle different field types
  if (field.value !== undefined && field.value !== null) {
    if (typeof field.value === 'object') {
      return field.value.name || field.value.email || JSON.stringify(field.value);
    }
    return field.value;
  }
  
  if (field.type_config && field.type_config.options) {
    const option = field.type_config.options.find(o => o.id === field.value);
    if (option) return option.name;
  }
  
  return null;
}

// Calculate stats for a list
async function calculateListStats(listConfig) {
  const { id, name, statusToTrack, customFieldName } = listConfig;
  
  console.log(`Processing list: ${name}`);
  
  // Log custom fields on first run to help identify field names
  const customFields = await getListCustomFields(id);
  console.log(`Custom fields for ${name}:`, customFields.map(f => f.name));
  
  const tasks = await getTasksFromList(id);
  console.log(`Found ${tasks.length} tasks in ${name}`);
  
  const now = Date.now();
  const fiveDaysAgo = now - (5 * 24 * 60 * 60 * 1000);
  
  const outstandingTasks = [];
  const recentlyCompletedTasks = [];
  const timesInStatus = [];
  
  for (const task of tasks) {
    const isClosed = task.status && task.status.type === 'closed';
    const customFieldValue = getCustomFieldValue(task, customFieldName);
    
    if (!isClosed) {
      // Outstanding task
      const timeWaiting = now - parseInt(task.date_created);
      outstandingTasks.push({
        name: task.name,
        customField: customFieldValue || 'N/A',
        timeWaiting: formatMsToTime(timeWaiting),
        timeWaitingMs: timeWaiting
      });
    } else {
      // Check if completed in last 5 days
      const dateCompleted = task.date_done ? parseInt(task.date_done) : parseInt(task.date_updated);
      if (dateCompleted >= fiveDaysAgo) {
        recentlyCompletedTasks.push({
          name: task.name,
          customField: customFieldValue || 'N/A',
          completedDate: new Date(dateCompleted).toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles' })
        });
      }
    }
    
    // Get time in status for average calculation
    const timeData = await getTimeInStatus(task.id);
    
    if (timeData && timeData.status_history) {
      const statusEntry = timeData.status_history.find(
        s => s.status && s.status.toLowerCase() === statusToTrack.toLowerCase()
      );
      
      if (statusEntry && statusEntry.total_time && statusEntry.total_time.by_minute) {
        timesInStatus.push(statusEntry.total_time.by_minute);
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  // Sort outstanding by longest waiting first
  outstandingTasks.sort((a, b) => b.timeWaitingMs - a.timeWaitingMs);
  
  // Sort recently completed by most recent first
  recentlyCompletedTasks.sort((a, b) => new Date(b.completedDate) - new Date(a.completedDate));
  
  // Calculate average
  let averageFormatted = 'No data';
  let minFormatted = 'N/A';
  let maxFormatted = 'N/A';
  
  if (timesInStatus.length > 0) {
    const average = timesInStatus.reduce((a, b) => a + b, 0) / timesInStatus.length;
    const min = Math.min(...timesInStatus);
    const max = Math.max(...timesInStatus);
    
    averageFormatted = formatTime(Math.round(average));
    minFormatted = formatTime(min);
    maxFormatted = formatTime(max);
  }
  
  return {
    name,
    taskCount: tasks.length,
    tasksWithData: timesInStatus.length,
    averageFormatted,
    minFormatted,
    maxFormatted,
    outstandingCount: outstandingTasks.length,
    outstandingTasks,
    recentlyCompletedTasks
  };
}

// Fetch all stats (used for caching)
async function fetchAllStats() {
  const results = [];
  for (const listConfig of LISTS) {
    const result = await calculateListStats(listConfig);
    results.push(result);
  }
  return results;
}

// Get stats with caching
async function getStatsWithCache() {
  const now = Date.now();
  
  // Return cached results if still valid
  if (cachedResults && lastFetchTime && (now - lastFetchTime < CACHE_DURATION)) {
    console.log('Returning cached results');
    return { results: cachedResults, fromCache: true, lastUpdated: lastFetchTime };
  }
  
  // If already fetching, return stale cache or wait
  if (isFetching) {
    if (cachedResults) {
      console.log('Fetch in progress, returning stale cache');
      return { results: cachedResults, fromCache: true, lastUpdated: lastFetchTime };
    }
  }
  
  // Fetch fresh data
  isFetching = true;
  console.log('Fetching fresh data...');
  
  try {
    const results = await fetchAllStats();
    cachedResults = results;
    lastFetchTime = Date.now();
    console.log('Cache updated');
    return { results, fromCache: false, lastUpdated: lastFetchTime };
  } finally {
    isFetching = false;
  }
}

// Main endpoint
app.get('/', async (req, res) => {
  try {
    const { results, fromCache, lastUpdated } = await getStatsWithCache();
    const lastUpdatedDate = new Date(lastUpdated);
    
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="refresh" content="3600">
  <title>Average Ticket Time</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap" rel="stylesheet">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #000000;
      color: #ffffff;
      padding: 20px;
      min-height: 100vh;
    }
    .container {
      max-width: 900px;
      margin: 0 auto;
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 15px;
      margin-bottom: 30px;
    }
    .logo {
      width: 50px;
      height: 50px;
    }
    h1 {
      font-family: 'Bebas Neue', sans-serif;
      font-size: 36px;
      color: #ffffff;
      letter-spacing: 2px;
    }
    .card {
      background: #111111;
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 20px;
      border: 1px solid #333333;
    }
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }
    .list-name {
      font-size: 20px;
      font-weight: 600;
      color: #ffffff;
    }
    .priority-stats {
      display: flex;
      gap: 40px;
      justify-content: center;
      margin: 20px 0;
    }
    .priority-stat {
      text-align: center;
    }
    .priority-label {
      font-size: 12px;
      color: #aaaaaa;
      margin-bottom: 8px;
      text-transform: uppercase;
    }
    .priority-value {
      font-size: 42px;
      font-weight: 700;
      color: #ffffff;
    }
    .stats-row {
      display: flex;
      justify-content: space-around;
      margin-top: 20px;
      padding-top: 20px;
      border-top: 1px solid #333333;
    }
    .stat {
      text-align: center;
    }
    .stat-label {
      font-size: 12px;
      color: #aaaaaa;
      margin-bottom: 4px;
    }
    .stat-value {
      font-size: 16px;
      font-weight: 600;
      color: #ffffff;
    }
    .dropdown-section {
      margin-top: 20px;
    }
    .dropdown-toggle {
      background: #222222;
      border: 1px solid #444444;
      color: #ffffff;
      padding: 10px 16px;
      border-radius: 8px;
      cursor: pointer;
      width: 100%;
      text-align: left;
      font-size: 14px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    .dropdown-toggle:hover {
      background: #333333;
    }
    .dropdown-content {
      display: none;
      background: #1a1a1a;
      border: 1px solid #333333;
      border-radius: 8px;
      max-height: 300px;
      overflow-y: auto;
    }
    .dropdown-content.show {
      display: block;
    }
    .dropdown-item {
      padding: 12px 16px;
      border-bottom: 1px solid #222222;
    }
    .dropdown-item:last-child {
      border-bottom: none;
    }
    .item-name {
      font-weight: 600;
      color: #ffffff;
      margin-bottom: 4px;
    }
    .item-details {
      font-size: 12px;
      color: #aaaaaa;
    }
    .item-time {
      color: #ff6b6b;
      font-weight: 500;
    }
    .item-completed {
      color: #51cf66;
    }
    .refresh-section {
      text-align: center;
      margin-top: 30px;
    }
    .refresh-btn {
      background: #222222;
      border: 1px solid #444444;
      color: #ffffff;
      padding: 10px 24px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
      margin-bottom: 10px;
    }
    .refresh-btn:hover {
      background: #333333;
    }
    .refresh-note {
      color: #888888;
      font-size: 12px;
    }
    .arrow {
      transition: transform 0.2s;
    }
    .arrow.open {
      transform: rotate(180deg);
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="/logo.png" alt="West Coast Strength" class="logo">
      <h1>AVERAGE TICKET TIME</h1>
    </div>
    ${results.map(r => `
      <div class="card">
        <div class="card-header">
          <span class="list-name">${r.name}</span>
        </div>
        <div class="priority-stats">
          <div class="priority-stat">
            <div class="priority-label">Avg Time</div>
            <div class="priority-value">${r.averageFormatted}</div>
          </div>
          <div class="priority-stat">
            <div class="priority-label">Outstanding</div>
            <div class="priority-value">${r.outstandingCount}</div>
          </div>
        </div>
        <div class="stats-row">
          <div class="stat">
            <div class="stat-label">Tasks Analyzed</div>
            <div class="stat-value">${r.tasksWithData} / ${r.taskCount}</div>
          </div>
          <div class="stat">
            <div class="stat-label">Fastest</div>
            <div class="stat-value">${r.minFormatted}</div>
          </div>
          <div class="stat">
            <div class="stat-label">Slowest</div>
            <div class="stat-value">${r.maxFormatted}</div>
          </div>
        </div>
        
        <div class="dropdown-section">
          <button class="dropdown-toggle" onclick="toggleDropdown('outstanding-${r.name.replace(/\s/g, '')}')">
            <span>Outstanding Tickets (${r.outstandingTasks.length})</span>
            <span class="arrow" id="arrow-outstanding-${r.name.replace(/\s/g, '')}">▼</span>
          </button>
          <div class="dropdown-content" id="outstanding-${r.name.replace(/\s/g, '')}">
            ${r.outstandingTasks.length === 0 ? '<div class="dropdown-item">No outstanding tickets</div>' : 
              r.outstandingTasks.map(t => `
                <div class="dropdown-item">
                  <div class="item-name">${t.name}</div>
                  <div class="item-details">
                    ${t.customField !== 'N/A' ? `<span>${t.customField}</span> • ` : ''}
                    <span class="item-time">Waiting: ${t.timeWaiting}</span>
                  </div>
                </div>
              `).join('')}
          </div>
          
          <button class="dropdown-toggle" onclick="toggleDropdown('completed-${r.name.replace(/\s/g, '')}')">
            <span>Recently Completed (${r.recentlyCompletedTasks.length})</span>
            <span class="arrow" id="arrow-completed-${r.name.replace(/\s/g, '')}">▼</span>
          </button>
          <div class="dropdown-content" id="completed-${r.name.replace(/\s/g, '')}">
            ${r.recentlyCompletedTasks.length === 0 ? '<div class="dropdown-item">No tickets completed in last 5 days</div>' : 
              r.recentlyCompletedTasks.map(t => `
                <div class="dropdown-item">
                  <div class="item-name">${t.name}</div>
                  <div class="item-details">
                    ${t.customField !== 'N/A' ? `<span>${t.customField}</span> • ` : ''}
                    <span class="item-completed">Completed: ${t.completedDate}</span>
                  </div>
                </div>
              `).join('')}
          </div>
        </div>
      </div>
    `).join('')}
    
    <div class="refresh-section">
      <button class="refresh-btn" onclick="location.reload()">↻ Refresh Now</button>
      <button class="refresh-btn" onclick="location.href='/refresh'" style="margin-left: 10px;">⟳ Force Data Refresh</button>
      <p class="refresh-note">Data updated: ${lastUpdatedDate.toLocaleString('en-US', { timeZone: 'America/Los_Angeles', dateStyle: 'short', timeStyle: 'short' })} PST ${fromCache ? '(cached)' : '(fresh)'} • Auto-refreshes every hour</p>
    </div>
  </div>
  
  <script>
    function toggleDropdown(id) {
      const content = document.getElementById(id);
      const arrow = document.getElementById('arrow-' + id);
      content.classList.toggle('show');
      arrow.classList.toggle('open');
    }
  </script>
</body>
</html>
    `;
    
    res.send(html);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send(`Error: ${error.message}`);
  }
});

// Force refresh endpoint - clears cache and redirects
app.get('/refresh', async (req, res) => {
  cachedResults = null;
  lastFetchTime = null;
  res.redirect('/');
});

// JSON endpoint
app.get('/api/stats', async (req, res) => {
  try {
    const { results, lastUpdated } = await getStatsWithCache();
    
    res.json({
      updated: new Date(lastUpdated).toISOString(),
      lists: results
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
