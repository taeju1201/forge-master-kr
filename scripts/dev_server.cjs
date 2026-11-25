'use strict';
// Dependency-free static dev server; accepts the managed preview CLI's host/port flags.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'..');
const args = process.argv.slice(2);
const argument = (name,fallback) => args.includes(name) ? args[args.indexOf(name)+1] : fallback;
const host = argument('--host','127.0.0.1');
const port = Number(argument('--port',process.env.PORT || 3000));
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.cjs':'text/plain; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.md':'text/plain; charset=utf-8','.txt':'text/plain; charset=utf-8'};
const server = http.createServer((req,res) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname); }
  catch { res.writeHead(400);res.end('Bad request');return; }
  if (pathname.split('/').some(x=>x.startsWith('.'))) { res.writeHead(404);res.end('Not found');return; }
  let file = path.resolve(root,'.'+pathname);
  if (file!==root && !file.startsWith(root+path.sep)) { res.writeHead(403);res.end('Forbidden');return; }
  try {
    if (fs.statSync(file).isDirectory()) file=path.join(file,'index.html');
    const info=fs.statSync(file);
    if (!info.isFile()) throw Error('Not a file');
    res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Content-Length':info.size,'Cache-Control':'no-store'});
    if (req.method==='HEAD') res.end(); else fs.createReadStream(file).pipe(res);
  } catch { res.writeHead(404);res.end('Not found'); }
});
server.listen(port,host,()=>process.stdout.write(`Local: http://${host}:${port}/\n`));
