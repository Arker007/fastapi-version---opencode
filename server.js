require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const API_BASE_URL = process.env.API_BASE_URL || 'http://127.0.0.1:8000';

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'frontend')));

app.use('/api', async (req, res) => {
  try {
    const targetUrl = new URL(req.originalUrl, API_BASE_URL).toString();
    const headers = {};

    for (const headerName of ['authorization', 'content-type', 'accept']) {
      if (req.headers[headerName]) {
        headers[headerName] = req.headers[headerName];
      }
    }

    const options = { method: req.method, headers };

    if (!['GET', 'HEAD'].includes(req.method)) {
      options.body = JSON.stringify(req.body ?? {});
    }

    const response = await fetch(targetUrl, options);
    const contentType = response.headers.get('content-type') || 'application/json; charset=utf-8';

    res.status(response.status);
    res.set('content-type', contentType);
    res.send(await response.text());
  } catch (error) {
    res.status(502).json({
      error: 'FastAPI backend is unavailable',
      details: error.message,
    });
  }
});

// Route HTML pages — strip leading slash, look up corresponding .html file
app.get('*', (req, res) => {
  const route = req.path.replace(/^\//, '') || 'index';
  const filePath = path.join(__dirname, 'frontend', route + '.html');
  res.sendFile(filePath, (err) => {
    if (err) {
      // Fallback to index.html (SPA-style) for unknown routes
      res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
    }
  });
});

app.listen(PORT, () => {
  console.log(`Node frontend running on http://localhost:${PORT}`);
  console.log(`Proxying API requests to ${API_BASE_URL}`);
});