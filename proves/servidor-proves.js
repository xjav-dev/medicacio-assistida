'use strict';
/**
 * servidor-proves.js — serveix web/ i respon l'API amb el backend real (src/*.gs)
 * carregat al simulador. Només per provar en local: node proves/servidor-proves.js [port]
 * /__control/correus → darrers correus enviats (per llegir el codi d'entrada).
 */
const http = require('http'), fs = require('fs'), path = require('path');
const { creaEntorn } = require('./simulador');
const env = creaEntorn({ silenci: true });
env.estat.usuariActiu = env.estat.propietari;
env.context.instalacio();
env.estat.usuariActiu = '';
const WEB = path.join(__dirname, '..', 'web');
const TIPUS = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const port = Number(process.argv[2] || 8765);

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api' && req.method === 'POST') {
    let cos = '';
    req.on('data', (c) => { cos += c; });
    req.on('end', () => {
      const r = env.context.doPost({ postData: { contents: cos } });
      res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(r.text);
    });
    return;
  }
  if (url.pathname === '/__control/correus') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(env.estat.correus.map((c) => ({ to: c.to, body: c.body }))));
    return;
  }
  if (url.pathname === '/__control/activador') {
    env.context.activadorRevisio({ triggerUid: env.estat.activadors[0].id });
    res.end('ok'); return;
  }
  if (url.pathname === '/__control/horari-antic') {
    // Simula que l'horari es va desar fa 3 hores (perquè el canvi d'avui ja compti).
    const fa3h = env.context.clau_(new Date(Date.now() - 3 * 3600000));
    env.context.llegeixFull_('Medicaments').forEach((m) => env.context.actualitzaPerId_('Medicaments', m.id, { vigentDes: fa3h }));
    res.end('ok'); return;
  }
  if (url.pathname === '/config.js') {
    res.writeHead(200, { 'Content-Type': 'text/javascript' });
    // SENSE_SERVIDOR=1: com la web publicada (sense adreça), per provar l'enllaç ?s=…
    res.end(process.env.SENSE_SERVIDOR ? "window.CONFIG = { URL_API: '' };" : "window.CONFIG = { URL_PROVES: '/api' };"); return;
  }
  const fitxer = path.join(WEB, path.normalize(url.pathname === '/' ? '/index.html' : url.pathname));
  if (!fitxer.startsWith(WEB) || !fs.existsSync(fitxer)) { res.writeHead(404); res.end('no'); return; }
  res.writeHead(200, { 'Content-Type': TIPUS[path.extname(fitxer)] || 'application/octet-stream' });
  fs.createReadStream(fitxer).pipe(res);
}).listen(port, () => console.log('http://localhost:' + port));
