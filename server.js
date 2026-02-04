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
    customFieldName: 'Item Name',
    formUrl: 'https://forms.clickup.com/9011189579/f/8chqnub-2111/9VUXKVKZ5ED01B1LGK',
    description: 'Add new items to ABC catalog for POS'
  },
  {
    id: '901112845576',
    name: 'New Hire',
    statusToTrack: 'open',
    customFieldName: 'First Name',
    formUrl: 'https://forms.clickup.com/9011189579/f/8chqnub-2151/CZ3QFG9AMCIB8KHJ74',
    description: 'Add New Hire to WCS Systems'
  },
  {
    id: '901112959393',
    name: 'Staff Updates',
    statusToTrack: 'to do',
    customFieldName: 'First Name',
    formUrl: 'https://forms.clickup.com/9011189579/f/8chqnub-2611/FKIRJ3X6EVJM6BSA5Q',
    description: 'Change or Adjust Current Staff Access/Systems'
  },
  {
    id: '901112959189',
    name: 'Offboarding',
    statusToTrack: 'to do',
    customFieldName: 'First Name',
    formUrl: 'https://forms.clickup.com/9011189579/f/8chqnub-2571/R6WYGJ0XZMS7W76KHX',
    description: 'Offboard Employee'
  },
  {
    id: '901113045232',
    name: 'New Help Center Docs',
    statusToTrack: 'to do',
    customFieldName: null,
    formUrl: 'https://forms.clickup.com/9011189579/f/8chqnub-2791/LO3VQ5PP9HAYNNIRLV',
    description: 'Add New Training Material'
  }
];

// Shared styles
const getStyles = () => `
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
      background: #ffffff;
      color: #000000;
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
      color: #000000;
      letter-spacing: 2px;
    }
    h2 {
      font-family: 'Bebas Neue', sans-serif;
      font-size: 28px;
      color: #000000;
      letter-spacing: 1px;
      text-align: center;
      margin-bottom: 30px;
    }
    .card {
      background: #f5f5f5;
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 20px;
      border: 1px solid #e0e0e0;
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
      color: #000000;
    }
    .btn {
      background: #f5f5f5;
      border: 1px solid #cccccc;
      color: #000000;
      padding: 16px 32px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 16px;
      text-decoration: none;
      display: inline-block;
      transition: background 0.2s;
    }
    .btn:hover {
      background: #e0e0e0;
    }
    .btn-large {
      padding: 24px 48px;
      font-size: 18px;
      font-family: 'Bebas Neue', sans-serif;
      letter-spacing: 1px;
    }
    .btn-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      margin-top: 20px;
    }
    .choice-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 30px;
      max-width: 600px;
      margin: 40px auto;
    }
    .choice-btn {
      background: #f5f5f5;
      border: 2px solid #e0e0e0;
      color: #000000;
      padding: 40px 30px;
      border-radius: 12px;
      cursor: pointer;
      text-align: center;
      text-decoration: none;
      transition: all 0.2s;
    }
    .choice-btn:hover {
      border-color: #000000;
      background: #eeeeee;
    }
    .choice-icon {
      font-size: 48px;
      margin-bottom: 15px;
    }
    .choice-title {
      font-family: 'Bebas Neue', sans-serif;
      font-size: 24px;
      letter-spacing: 1px;
    }
    .choice-desc {
      font-size: 14px;
      color: #666666;
      margin-top: 10px;
    }
    .back-btn {
      display: inline-block;
      background: #f5f5f5;
      border: 1px solid #cccccc;
      color: #000000;
      padding: 10px 20px;
      border-radius: 8px;
      text-decoration: none;
      margin-bottom: 20px;
      font-size: 14px;
      transition: background 0.2s;
    }
    .back-btn:hover {
      background: #e0e0e0;
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
      color: #666666;
      margin-bottom: 8px;
      text-transform: uppercase;
    }
    .priority-value {
      font-size: 42px;
      font-weight: 700;
      color: #000000;
    }
    .stats-row {
      display: flex;
      justify-content: space-around;
      margin-top: 20px;
      padding-top: 20px;
      border-top: 1px solid #e0e0e0;
    }
    .stat {
      text-align: center;
    }
    .stat-label {
      font-size: 12px;
      color: #666666;
      margin-bottom: 4px;
    }
    .stat-value {
      font-size: 16px;
      font-weight: 600;
      color: #000000;
    }
    .dropdown-section {
      margin-top: 20px;
    }
    .dropdown-toggle {
      background: #eeeeee;
      border: 1px solid #cccccc;
      color: #000000;
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
      background: #e0e0e0;
    }
    .dropdown-content {
      display: none;
      background: #fafafa;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      max-height: 300px;
      overflow-y: auto;
    }
    .dropdown-content.show {
      display: block;
    }
    .dropdown-item {
      padding: 12px 16px;
      border-bottom: 1px solid #eeeeee;
    }
    .dropdown-item:last-child {
      border-bottom: none;
    }
    .item-name {
      font-weight: 600;
      color: #000000;
      margin-bottom: 4px;
    }
    .item-details {
      font-size: 12px;
      color: #666666;
    }
    .item-time {
      color: #dc3545;
      font-weight: 500;
    }
    .item-completed {
      color: #28a745;
    }
    .refresh-section {
      text-align: center;
      margin-top: 30px;
    }
    .refresh-btn {
      background: #f5f5f5;
      border: 1px solid #cccccc;
      color: #000000;
      padding: 10px 24px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
      margin-bottom: 10px;
    }
    .refresh-btn:hover {
      background: #e0e0e0;
    }
    .refresh-note {
      color: #666666;
      font-size: 12px;
    }
    .arrow {
      transition: transform 0.2s;
    }
    .arrow.open {
      transform: rotate(180deg);
    }
    .form-card {
      background: #f5f5f5;
      border: 2px solid #e0e0e0;
      border-radius: 12px;
      padding: 24px;
      text-align: center;
      cursor: pointer;
      transition: all 0.2s;
      text-decoration: none;
      color: #000000;
      display: block;
    }
    .form-card:hover {
      border-color: #000000;
      background: #eeeeee;
    }
    .form-card-title {
      font-family: 'Bebas Neue', sans-serif;
      font-size: 22px;
      letter-spacing: 1px;
      margin-bottom: 8px;
    }
    .form-card-desc {
      font-size: 13px;
      color: #666666;
    }
  </style>
`;

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

// Home page - Choose submit or check status
app.get('/', (req, res) => {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WCS Ticket System</title>
  ${getStyles()}
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="/logo.png" alt="West Coast Strength" class="logo">
      <h1>TICKET SYSTEM</h1>
    </div>
    
    <div class="choice-grid">
      <a href="/submit" class="choice-btn">
        <div class="choice-icon">📝</div>
        <div class="choice-title">SUBMIT A TICKET</div>
        <div class="choice-desc">Create a new request</div>
      </a>
      <a href="/status" class="choice-btn">
        <div class="choice-icon">📊</div>
        <div class="choice-title">CHECK STATUS</div>
        <div class="choice-desc">View ticket progress</div>
      </a>
    </div>
  </div>
</body>
</html>
  `;
  res.send(html);
});

// Submit ticket page - Choose form type
app.get('/submit', (req, res) => {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Submit a Ticket - WCS</title>
  ${getStyles()}
</head>
<body>
  <div class="container">
    <a href="/" class="back-btn">← Back to Home</a>
    
    <div class="header">
      <img src="/logo.png" alt="West Coast Strength" class="logo">
      <h1>SUBMIT A TICKET</h1>
    </div>
    
    <h2>What type of request?</h2>
    
    <div class="btn-grid">
      ${LISTS.map(list => `
        <a href="${list.formUrl}" target="_blank" class="form-card">
          <div class="form-card-title">${list.name}</div>
          <div class="form-card-desc">${list.description}</div>
        </a>
      `).join('')}
    </div>
  </div>
</body>
</html>
  `;
  res.send(html);
});

// Status page - The dashboard (loads instantly, fetches data via AJAX)
app.get('/status', async (req, res) => {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="refresh" content="3600">
  <title>Ticket Status - WCS</title>
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
      background: #ffffff;
      color: #000000;
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
      color: #000000;
      letter-spacing: 2px;
    }
    .card {
      background: #f5f5f5;
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 20px;
      border: 1px solid #e0e0e0;
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
      color: #000000;
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
      color: #666666;
      margin-bottom: 8px;
      text-transform: uppercase;
    }
    .priority-value {
      font-size: 42px;
      font-weight: 700;
      color: #000000;
    }
    .stats-row {
      display: flex;
      justify-content: space-around;
      margin-top: 20px;
      padding-top: 20px;
      border-top: 1px solid #e0e0e0;
    }
    .stat {
      text-align: center;
    }
    .stat-label {
      font-size: 12px;
      color: #666666;
      margin-bottom: 4px;
    }
    .stat-value {
      font-size: 16px;
      font-weight: 600;
      color: #000000;
    }
    .dropdown-section {
      margin-top: 20px;
    }
    .dropdown-toggle {
      background: #eeeeee;
      border: 1px solid #cccccc;
      color: #000000;
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
      background: #e0e0e0;
    }
    .dropdown-content {
      display: none;
      background: #fafafa;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      max-height: 300px;
      overflow-y: auto;
    }
    .dropdown-content.show {
      display: block;
    }
    .dropdown-item {
      padding: 12px 16px;
      border-bottom: 1px solid #eeeeee;
    }
    .dropdown-item:last-child {
      border-bottom: none;
    }
    .item-name {
      font-weight: 600;
      color: #000000;
      margin-bottom: 4px;
    }
    .item-details {
      font-size: 12px;
      color: #666666;
    }
    .item-time {
      color: #dc3545;
      font-weight: 500;
    }
    .item-completed {
      color: #28a745;
    }
    .refresh-section {
      text-align: center;
      margin-top: 30px;
    }
    .refresh-btn {
      background: #f5f5f5;
      border: 1px solid #cccccc;
      color: #000000;
      padding: 10px 24px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
      margin-bottom: 10px;
    }
    .refresh-btn:hover {
      background: #e0e0e0;
    }
    .refresh-note {
      color: #666666;
      font-size: 12px;
    }
    .arrow {
      transition: transform 0.2s;
    }
    .arrow.open {
      transform: rotate(180deg);
    }
    .back-btn {
      display: inline-block;
      background: #f5f5f5;
      border: 1px solid #cccccc;
      color: #000000;
      padding: 10px 20px;
      border-radius: 8px;
      text-decoration: none;
      margin-bottom: 20px;
      font-size: 14px;
      transition: background 0.2s;
    }
    .back-btn:hover {
      background: #e0e0e0;
    }
    .loading-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px 20px;
    }
    .spinner {
      width: 50px;
      height: 50px;
      border: 4px solid #e0e0e0;
      border-top: 4px solid #000000;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-bottom: 20px;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    .loading-text {
      color: #666666;
      font-size: 16px;
    }
  </style>
</head>
<body>
  <div class="container">
    <a href="/" class="back-btn">← Back to Home</a>
    
    <div class="header">
      <img src="/logo.png" alt="West Coast Strength" class="logo">
      <h1>TICKET STATUS</h1>
    </div>
    
    <div id="content">
      <div class="loading-container">
        <div class="spinner"></div>
        <div class="loading-text">Loading ticket data...</div>
      </div>
    </div>
    
    <div id="refresh-section" class="refresh-section" style="display: none;">
      <button class="refresh-btn" onclick="refreshData()">↻ Refresh</button>
      <p class="refresh-note" id="refresh-note"></p>
    </div>
  </div>
  
  <script>
    function toggleDropdown(id) {
      const content = document.getElementById(id);
      const arrow = document.getElementById('arrow-' + id);
      content.classList.toggle('show');
      arrow.classList.toggle('open');
    }
    
    function renderData(data) {
      const content = document.getElementById('content');
      const refreshSection = document.getElementById('refresh-section');
      const refreshNote = document.getElementById('refresh-note');
      
      let html = '';
      
      data.lists.forEach(r => {
        const listId = r.name.replace(/\\s/g, '');
        
        html += \`
          <div class="card">
            <div class="card-header">
              <span class="list-name">\${r.name}</span>
            </div>
            <div class="priority-stats">
              <div class="priority-stat">
                <div class="priority-label">Avg Time</div>
                <div class="priority-value">\${r.averageFormatted}</div>
              </div>
              <div class="priority-stat">
                <div class="priority-label">Outstanding</div>
                <div class="priority-value">\${r.outstandingCount}</div>
              </div>
            </div>
            <div class="stats-row">
              <div class="stat">
                <div class="stat-label">Tasks Analyzed</div>
                <div class="stat-value">\${r.tasksWithData} / \${r.taskCount}</div>
              </div>
              <div class="stat">
                <div class="stat-label">Fastest</div>
                <div class="stat-value">\${r.minFormatted}</div>
              </div>
              <div class="stat">
                <div class="stat-label">Slowest</div>
                <div class="stat-value">\${r.maxFormatted}</div>
              </div>
            </div>
            
            <div class="dropdown-section">
              <button class="dropdown-toggle" onclick="toggleDropdown('outstanding-\${listId}')">
                <span>Outstanding Tickets (\${r.outstandingTasks.length})</span>
                <span class="arrow" id="arrow-outstanding-\${listId}">▼</span>
              </button>
              <div class="dropdown-content" id="outstanding-\${listId}">
                \${r.outstandingTasks.length === 0 ? '<div class="dropdown-item">No outstanding tickets</div>' : 
                  r.outstandingTasks.map(t => \`
                    <div class="dropdown-item">
                      <div class="item-name">\${t.name}</div>
                      <div class="item-details">
                        \${t.customField !== 'N/A' ? \`<span>\${t.customField}</span> • \` : ''}
                        <span class="item-time">Waiting: \${t.timeWaiting}</span>
                      </div>
                    </div>
                  \`).join('')}
              </div>
              
              <button class="dropdown-toggle" onclick="toggleDropdown('completed-\${listId}')">
                <span>Recently Completed (\${r.recentlyCompletedTasks.length})</span>
                <span class="arrow" id="arrow-completed-\${listId}">▼</span>
              </button>
              <div class="dropdown-content" id="completed-\${listId}">
                \${r.recentlyCompletedTasks.length === 0 ? '<div class="dropdown-item">No tickets completed in last 5 days</div>' : 
                  r.recentlyCompletedTasks.map(t => \`
                    <div class="dropdown-item">
                      <div class="item-name">\${t.name}</div>
                      <div class="item-details">
                        \${t.customField !== 'N/A' ? \`<span>\${t.customField}</span> • \` : ''}
                        <span class="item-completed">Completed: \${t.completedDate}</span>
                      </div>
                    </div>
                  \`).join('')}
              </div>
            </div>
          </div>
        \`;
      });
      
      content.innerHTML = html;
      
      const updatedDate = new Date(data.updated);
      refreshNote.textContent = 'Data updated: ' + updatedDate.toLocaleString('en-US', { timeZone: 'America/Los_Angeles', dateStyle: 'short', timeStyle: 'short' }) + ' PST • Auto-refreshes every hour';
      refreshSection.style.display = 'block';
    }
    
    function fetchData() {
      fetch('/api/stats')
        .then(response => response.json())
        .then(data => {
          renderData(data);
        })
        .catch(error => {
          document.getElementById('content').innerHTML = '<div class="card"><p>Error loading data. Please try refreshing.</p></div>';
          console.error('Error:', error);
        });
    }
    
    function refreshData() {
      document.getElementById('content').innerHTML = \`
        <div class="loading-container">
          <div class="spinner"></div>
          <div class="loading-text">Refreshing ticket data...</div>
        </div>
      \`;
      document.getElementById('refresh-section').style.display = 'none';
      
      fetch('/api/refresh')
        .then(response => response.json())
        .then(data => {
          renderData(data);
        })
        .catch(error => {
          document.getElementById('content').innerHTML = '<div class="card"><p>Error loading data. Please try refreshing.</p></div>';
          console.error('Error:', error);
        });
    }
    
    // Load data when page loads
    fetchData();
  </script>
</body>
</html>
  `;
  res.send(html);
});

// Force refresh endpoint - clears cache and redirects to status
app.get('/refresh', async (req, res) => {
  cachedResults = null;
  lastFetchTime = null;
  res.redirect('/status');
});

// API refresh endpoint - clears cache and returns fresh JSON
app.get('/api/refresh', async (req, res) => {
  try {
    cachedResults = null;
    lastFetchTime = null;
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
