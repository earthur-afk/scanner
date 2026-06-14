import { google } from 'googleapis';
import express from 'express';
import path from 'path';
import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';

const app = express();

// Authenticate using your Google Service Account JSON keys
const auth = new google.auth.GoogleAuth({
  keyFile: path.resolve(import.meta.dirname!, 'service.json'),
  scopes: ['https://www.googleapis.com/auth/drive'],
});
const drive = google.drive({ version: 'v3', auth });

// 1. ENDPOINT: List contents of a specific folder ID
app.get('/api/drive/list/:folderId', async (req, res) => {
  try {
    const { folderId } = req.params;
  
    
    const response = await drive.files.list({
      // Filters for items inside this specific folder and excludes trashed items
      q: `'${folderId}' in parents and trashed = false and (mimeType = 'application/pdf' or mimeType = 'application/vnd.google-apps.folder')`,
      fields: 'files(id, name, mimeType, size, thumbnailLink)',
      orderBy: 'folder,name', 
    });

    res.json({ success: true, items: response.data.files });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. ENDPOINT: Stream a raw PDF file securely by its File ID
app.get('/api/drive/download/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;

    // Request the raw binary data stream from Google Drive
    const response = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'stream' }
    );

    // Set standard headers so the Expo app knows it is a PDF file
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="document.pdf"');

    // Pipe the Google Drive stream straight through your backend response to the app
    response.data.pipe(res);
  } catch (error) {
    res.status(500).json({ error: 'Failed to stream document' });
  }
});

// Simple in-memory thumbnail cache: keyed by fileId, expires after 1 hour
const thumbCache = new Map<string, { data: Buffer; time: number }>();
const CACHE_TTL = 60 * 60 * 1000;

// 3. ENDPOINT: Generate and serve a PDF page preview as an image
app.get('/api/drive/thumbnail/:fileId', async (req, res) => {
  const { fileId } = req.params;
  const cached = thumbCache.get(fileId);
  if (cached && Date.now() - cached.time < CACHE_TTL) {
    res.setHeader('Content-Type', 'image/png');
    return res.end(cached.data);
  }

  const tmpPdf = path.join(os.tmpdir(), `${fileId}.pdf`);
  const tmpPng = path.join(os.tmpdir(), `${fileId}.png`);
  try {
    // Download the PDF from Google Drive to a temp file
    const pdfResponse = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'stream' }
    );

    const writer = fs.createWriteStream(tmpPdf);
    pdfResponse.data.pipe(writer);
    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    // Convert first page to a 400px-wide PNG using macOS's built-in sips
    execSync(`sips -s format png --resampleWidth 400 "${tmpPdf}" --out "${tmpPng}" 2>/dev/null`);

    const imageBuffer = fs.readFileSync(tmpPng);
    thumbCache.set(fileId, { data: imageBuffer, time: Date.now() });
    // Evict stale entries periodically
    if (thumbCache.size > 200) {
      const now = Date.now();
      for (const [key, val] of thumbCache) {
        if (now - val.time > CACHE_TTL) thumbCache.delete(key);
      }
    }

    res.setHeader('Content-Type', 'image/png');
    res.end(imageBuffer);
  } catch (error) {
    console.error('Thumbnail error:', error.message);
    // Return a 1x1 transparent pixel as fallback so the Image component doesn't break
    res.setHeader('Content-Type', 'image/png');
    res.end(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'));
  } finally {
    // Cleanup temp files
    try { fs.unlinkSync(tmpPdf); } catch {}
    try { fs.unlinkSync(tmpPng); } catch {}
  }
});

// 4. ENDPOINT: Show authenticated account info
app.get('/api/drive/whoami', async (req, res) => {
  try {
    const about = await drive.about.get({ fields: 'user' });
    res.json({ success: true, user: about.data.user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(3000, () => console.log('Backend server running on port 3000'));
