// Data Editor — serves JSON files as editable tables in the browser
// GET  /api/data/:file  — read data file
// POST /api/data/:file  — write data file

const express = require('express');
const fs = require('fs');
const path = require('path');

const EDITABLE = ['items-master', 'mobs', 'recipes'];
const DATA_DIR = path.join(__dirname, '..', 'data');

function dataEditorRoutes(app) {
  app.get('/api/data/:file', (req, res) => {
    const name = req.params.file.replace(/[^a-z0-9-]/gi, '');
    if (!EDITABLE.includes(name)) return res.status(403).json({ error: 'Not editable' });
    const fp = path.join(DATA_DIR, name + '.json');
    if (!fs.existsSync(fp)) return res.status(404).json({ error: 'File not found' });
    res.json(JSON.parse(fs.readFileSync(fp, 'utf8')));
  });

  app.post('/api/data/:file', express.json({ limit: '2mb' }), (req, res) => {
    const name = req.params.file.replace(/[^a-z0-9-]/gi, '');
    if (!EDITABLE.includes(name)) return res.status(403).json({ error: 'Not editable' });
    const fp = path.join(DATA_DIR, name + '.json');
    // Backup
    if (fs.existsSync(fp)) fs.copyFileSync(fp, fp + '.bak');
    fs.writeFileSync(fp, JSON.stringify(req.body, null, 2));
    res.json({ ok: true });
  });
}

module.exports = { dataEditorRoutes };
