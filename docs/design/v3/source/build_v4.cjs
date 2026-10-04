const fs = require('fs'); const path = require('path');
const S = process.argv[2]; const V = path.join(S, 'v4');
const rd = (f) => fs.readFileSync(path.join(V, f), 'utf8');
const main = fs.readFileSync(path.join(S, 'main_data.json'), 'utf8').trim();
const extra = fs.readFileSync(path.join(S, 'extra_data.json'), 'utf8').trim();
const script = rd('script.js').replace('__MAIN__', () => main).replace('__EXTRA__', () => extra);
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Overview</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=Sora:wght@500;600;700&display=swap" rel="stylesheet">
<style>
${rd('theme.css')}
</style>
</helmet>
${rd('shell_top.html')}
${rd('overview.html')}
${rd('overview_m.html')}
${rd('pro.html')}
${rd('admin.html')}
${rd('settings.html')}
${rd('door.html')}
    </main>
  </div>
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":1440,"height":2400}}'>
${script}
</script>
</body>
</html>
`;
const OUT = path.join(S, 'design2', 'project');
fs.writeFileSync(path.join(OUT, 'Main.dc.html'), html);
const canvasP = path.join(OUT, 'canvas.json');
const c = JSON.parse(fs.readFileSync(canvasP, 'utf8'));
c.boards['Main.dc.html'].h = 2400; c.boards['Main.dc.html'].title = 'v3 prototype: Overview, Pro metrics, Admin, Settings, Sign in (click the sidebar)';
fs.writeFileSync(canvasP, JSON.stringify(c, null, 1));
console.log('built', (html.length / 1024).toFixed(1) + ' KB');
