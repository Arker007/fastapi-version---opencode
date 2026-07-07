/**
 * InvoiceFlow — Node.js Frontend Server
 * --------------------------------------------------
 * Purpose in this Dual-Server Project Architecture:
 * 1. Serves the static client-side web assets (HTML, CSS, JS, Images) from the 'frontend' folder.
 * 2. Acts as a Reverse Proxy for any request sent to '/api/*' and forwards it to the FastAPI Python backend.
 *    This avoids Cross-Origin Resource Sharing (CORS) security blockers in the browser since both pages
 *    and data are requested from the same origin (localhost:3000).
 * 
 * College Project Viva Defense Note:
 * - Express is a popular minimalist web framework for Node.js.
 * - The proxy forwards headers like Authorization (for JWT verification) and sends responses back to the client.
 */

require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const API_BASE_URL = process.env.API_BASE_URL || 'http://127.0.0.1:8000';

// Middleware to parse incoming request bodies as JSON (limit 2MB for logo upload transfer)
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// Express Static Middleware: Serves files like common.js or style.css from the 'frontend' folder directly
app.use(express.static(path.join(__dirname, 'frontend')));

/**
 * Proxy Middleware:
 * Catches any request starting with /api, replaces the base URL to target the FastAPI backend,
 * copies authorization headers, sends the request, and pipes the response back to the client browser.
 */
app.use('/api', async (req, res) => {
  try {
    // Construct the destination URL targeting FastAPI (e.g. http://127.0.0.1:8000/api/products)
    const targetUrl = new URL(req.originalUrl, API_BASE_URL).toString();
    const headers = {};

    // Forward essential HTTP Headers
    for (const headerName of ['authorization', 'content-type', 'accept']) {
      if (req.headers[headerName]) {
        headers[headerName] = req.headers[headerName];
      }
    }

    const options = { method: req.method, headers };

    // GET and HEAD requests cannot contain a request body in fetch() API
    if (!['GET', 'HEAD'].includes(req.method)) {
      options.body = JSON.stringify(req.body ?? {});
    }

    // Forward the API request to Python backend
    const response = await fetch(targetUrl, options);
    const contentType = response.headers.get('content-type') || 'application/json; charset=utf-8';

    // Set matching status code and content-type, then send the response payload
    res.status(response.status);
    res.set('content-type', contentType);
    res.send(await response.text());
  } catch (error) {
    // 502 Bad Gateway is returned if the FastAPI backend is down/offline
    res.status(502).json({
      error: 'FastAPI backend is unavailable',
      details: error.message,
    });
  }
});

/**
 * Catch-All Routing:
 * Resolves routes like '/dashboard' or '/billing' to their HTML equivalent files (e.g. 'dashboard.html').
 * This permits clean URLs (no '.html' in the browser address bar) and enables SPA routing.
 */
app.get('*', (req, res) => {
  // Strip leading slash to look up file
  const route = req.path.replace(/^\//, '');
  
  if (!route) {
    return res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
  }
  
  const filePath = path.join(__dirname, 'frontend', 'pages', route + '.html');
  res.sendFile(filePath, (err) => {
    if (err) {
      // Fallback: serve index.html (SPA fallback behavior)
      res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
    }
  });
});

// Start listening for web connections
app.listen(PORT, () => {
  console.log(`Node.js frontend running on http://localhost:${PORT}`);
  console.log(`Proxying API requests to ${API_BASE_URL}`);
});
