const sharp = require('sharp');
const fs = require('fs');

if(!fs.existsSync('public')) {
  fs.mkdirSync('public');
}

const svg192 = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>`;

const svg512 = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>`;

sharp({
  create: { width: 192, height: 192, channels: 4, background: { r: 8, g: 12, b: 20, alpha: 1 } }
})
.composite([{ input: Buffer.from(svg192), gravity: 'center' }])
.png()
.toFile('public/pwa-192x192.png');

sharp({
  create: { width: 512, height: 512, channels: 4, background: { r: 8, g: 12, b: 20, alpha: 1 } }
})
.composite([{ input: Buffer.from(svg512), gravity: 'center' }])
.png()
.toFile('public/pwa-512x512.png');

console.log('Icons created.');
