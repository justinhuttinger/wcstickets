const express = require('express');
const app = express();

const CLICKUP_API_KEY = 'pk_96281769_0QYS1QJP2XT4580M8N76661HH45DPZUP';

// Configure your lists here
const LISTS = [
  {
    id: '901112845228',
    name: 'Inventory Addition',
    statusToTrack: 'to do'
  },
  {
    id: '901112845576',
    name: 'New Hire',
    statusToTrack: 'to do'
  }
];

// Helper to format milliseconds into readable time
function formatTime(ms) {
  if (!ms || ms === 0) return '0m';
  
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
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
    
    // ClickUp returns max 100 tasks per page
    hasMore = data.tasks.length === 100;
    page++;
  }
  
  return tasks;
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
    console.error(`Failed to get time in status for task ${taskId}: ${response.status}`);
    return null;
  }
  
  return await response.json();
}

// Calculate average time in a specific status for a list
async function calculateAverageTimeInStatus(listConfig) {
  const { id, name, statusToTrack } = listConfig;
  
  console.log(`Processing list: ${name}`);
  
  const tasks = await getTasksFromList(id);
  console.log(`Found ${tasks.length} tasks in ${name}`);
  
  const timesInStatus = [];
  
  for (const task of tasks) {
    const timeData = await getTimeInStatus(task.id);
    
    if (timeData && timeData.status_history) {
      // Find the status we're tracking
      const statusEntry = Object.values(timeData.status_history).find(
        s => s.status.toLowerCase() === statusToTrack.toLowerCase()
      );
      
      if (statusEntry && statusEntry.total_time && statusEntry.total_time.time) {
        timesInStatus.push(parseInt(statusEntry.total_time.time));
      }
    }
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  if (timesInStatus.length === 0) {
    return {
      name,
      statusToTrack,
      taskCount: tasks.length,
      tasksWithData: 0,
      averageMs: 0,
      averageFormatted: 'No data',
      minFormatted: 'N/A',
      maxFormatted: 'N/A'
    };
  }
  
  const average = timesInStatus.reduce((a, b) => a + b, 0) / timesInStatus.length;
  const min = Math.min(...timesInStatus);
  const max = Math.max(...timesInStatus);
  
  return {
    name,
    statusToTrack,
    taskCount: tasks.length,
    tasksWithData: timesInStatus.length,
    averageMs: average,
    averageFormatted: formatTime(average),
    minFormatted: formatTime(min),
    maxFormatted: formatTime(max)
  };
}

// Main endpoint - serves the embeddable HTML
app.get('/', async (req, res) => {
  try {
    const results = [];
    
    for (const listConfig of LISTS) {
      const result = await calculateAverageTimeInStatus(listConfig);
      results.push(result);
    }
    
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Time in Status Dashboard</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #1a1a2e;
      color: #eee;
      padding: 20px;
      min-height: 100vh;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
    }
    h1 {
      text-align: center;
      margin-bottom: 30px;
      color: #7b68ee;
      font-size: 24px;
    }
    .card {
      background: #16213e;
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 20px;
      border: 1px solid #0f3460;
    }
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }
    .list-name {
      font-size: 18px;
      font-weight: 600;
      color: #fff;
    }
    .status-badge {
      background: #7b68ee;
      color: #fff;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 12px;
      text-transform: uppercase;
    }
    .average-time {
      font-size: 48px;
      font-weight: 700;
      color: #7b68ee;
      text-align: center;
      margin: 20px 0;
    }
    .stats-row {
      display: flex;
      justify-content: space-around;
      margin-top: 20px;
      padding-top: 20px;
      border-top: 1px solid #0f3460;
    }
    .stat {
      text-align: center;
    }
    .stat-label {
      font-size: 12px;
      color: #888;
      margin-bottom: 4px;
    }
    .stat-value {
      font-size: 16px;
      font-weight: 600;
      color: #fff;
    }
    .refresh-note {
      text-align: center;
      color: #666;
      font-size: 12px;
      margin-top: 20px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>⏱️ Average Time in Status</h1>
    ${results.map(r => `
      <div class="card">
        <div class="card-header">
          <span class="list-name">${r.name}</span>
          <span class="status-badge">${r.statusToTrack}</span>
        </div>
        <div class="average-time">${r.averageFormatted}</div>
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
      </div>
    `).join('')}
    <p class="refresh-note">Last updated: ${new Date().toLocaleString()}</p>
  </div>
</body>
</html>
    `;
    
    res.send(html);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send(`Error: ${error.message}`);
  }
});

// JSON endpoint for programmatic access
app.get('/api/stats', async (req, res) => {
  try {
    const results = [];
    
    for (const listConfig of LISTS) {
      const result = await calculateAverageTimeInStatus(listConfig);
      results.push(result);
    }
    
    res.json({
      updated: new Date().toISOString(),
      lists: results
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
