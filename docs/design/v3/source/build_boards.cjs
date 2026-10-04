const fs = require('fs'); const path = require('path');
const OUT = path.join(__dirname, 'design2', 'project');
const base = fs.readFileSync(path.join(OUT, 'Main.dc.html'), 'utf8');
const live = JSON.parse(fs.readFileSync(path.join(__dirname, 'artifact-files', '305e649b-75dc-4129-9f27-edec3513c5a3', 'project', 'canvas.json'), 'utf8'));
const variants = [
  { file: 'Pro.dc.html', page: 'pro', role: 'admin', h: 2230, title: 'Pro metrics', title2: 'Pro metrics', x: 1520 },
  { file: 'Login.dc.html', page: 'door', role: 'visitor', h: 1000, title: 'Sign in (doorway)', title2: 'Sign in', x: 3040 },
  { file: 'Admin.dc.html', page: 'admin', role: 'admin', h: 1500, title: 'Admin dashboard', title2: 'Admin', x: 4560 }
];
const mobile = [
  { file: 'Overview-mobile.dc.html', page: 'overview', role: 'viewer', theme: 'dark', h: 844, frame: true, title: 'Phone: Overview (dark), first screen', x: 0 },
  { file: 'Overview-mobile-light.dc.html', page: 'overview', role: 'viewer', theme: 'light', h: 844, frame: true, title: 'Phone: Overview (light), first screen', x: 470 },
  { file: 'Pro-mobile.dc.html', page: 'pro', role: 'viewer', theme: 'dark', h: 3400, title: 'Phone: Pro metrics', x: 940 },
  { file: 'Admin-mobile.dc.html', page: 'admin', role: 'admin', theme: 'dark', h: 1700, title: 'Phone: Admin', x: 1410 },
  { file: 'Login-mobile.dc.html', page: 'door', role: 'visitor', theme: 'dark', h: 1100, title: 'Phone: Sign in', x: 1880 }
];
const marker = "theme: 'dark', railOpen: true, role: 'admin', page: 'overview', phone: false,";
if (!base.includes(marker)) throw new Error('marker');
const c = live;
c.boards = {
  'Main.dc.html': { expand: 'fill', h: 2400, is_interactive: true, title: 'Overview (sidebar also switches pages)', w: 1440, x: 0, y: 0 }
};
c.order = ['Main.dc.html'];
for (const v of variants) {
  let h = base.replace(marker, `theme: 'dark', railOpen: true, role: '${v.role}', page: '${v.page}', phone: false,`)
    .split('min-height: 2400px').join(`min-height: ${v.h}px`)
    .replace('"height":2400', `"height":${v.h}`).replace('<title>Overview</title>', `<title>${v.title2}</title>`);
  fs.writeFileSync(path.join(OUT, v.file), h);
  c.boards[v.file] = { expand: 'fill', h: v.h, is_interactive: true, title: v.title, w: 1440, x: v.x, y: 0 };
  c.order.push(v.file);
}
for (const v of mobile) {
  let h = base.replace(marker, `theme: '${v.theme}', railOpen: true, role: '${v.role}', page: '${v.page}', phone: true,`)
    .split('min-height: 2400px').join(`min-height: ${v.h}px`)
    .replace('"height":2400', `"height":${v.h}`).replace('"width":1440', '"width":390').replace('<title>Overview</title>', '<title>' + v.title + '</title>');
  if (v.frame) { const first = h.indexOf(`min-height: ${v.h}px`); h = h.slice(0, first) + 'height: ' + v.h + 'px; overflow-y: auto; min-height: 0' + h.slice(first + `min-height: ${v.h}px`.length); }
  fs.writeFileSync(path.join(OUT, v.file), h);
  c.boards[v.file] = { expand: 'fill', h: v.h, is_interactive: true, title: v.title, w: 390, x: v.x, y: 3000 };
  c.order.push(v.file);
}
c.notes.t2 = { kind: 'title1', maxW: 2270, text: 'Phone layout: bottom tab bar, stacked tiles', w: 240, x: 0, y: 2700 };
c.boards['B-Sunrise-Navy-dark.dc.html'] = { h: 560, title: 'Palette B: Sunrise on Navy (chosen)', w: 760, x: 2370, y: 3000 };
c.order.push('B-Sunrise-Navy-dark.dc.html');
c.notes.t1 = { kind: 'title1', maxW: 6000, text: 'v3 design: Overview, Pro metrics, Sign in, Admin', w: 240, x: 0, y: -300 };
fs.writeFileSync(path.join(OUT, 'canvas.json'), JSON.stringify(c, null, 1));
console.log(Object.keys(c.boards));
