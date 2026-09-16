// tests/parity.js — node tests/parity.js [итераций]. Сравнивает разметку render.js и render.php на случайных макетах.
const R = require('../assets/render.js');
const {execFileSync} = require('child_process');
let seed = 12345;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const pick = a => a[Math.floor(rnd() * a.length)];
const n = (a, b) => +(a + rnd() * (b - a)).toFixed(pick([0, 1, 2, 3, 4]));
const col = () => '#' + Math.floor(rnd() * 0xffffff).toString(16).padStart(6, '0');
const TYPES = Object.keys(R.FAMS);
const TEXTS = ['Пиксели на краю карты', "Кавычки \"двойные\" и 'одинарные' <b>теги</b> & амперсанд", 'Строка 1\nСтрока 2\n\n  \nСтрока 3', '  ', 'x'];
function block(i) {
  const type = pick(TYPES);
  const p = {
    bgOn: rnd() > .5, bg: col(), pad: n(0, 20), radius: n(0, 40), shape: pick(Object.keys(R.SHAPES)), bw: pick([0, n(0, 5)]), bc: col(),
    opacity: n(0, 1), blend: pick(['normal', 'multiply', 'screen']),
    r1: pick([-1, n(0, 30)]), r2: pick([-1, n(0, 30)]), r3: -1, r4: pick([-1, 5]),
    rx: pick([0, 0, n(-80, 80)]), ry: pick([0, n(-80, 80)]), persp: n(50, 3000),
    q: pick([[0, 0, 0, 0, 0, 0, 0, 0], Array.from({length: 8}, () => n(-.5, .5))]),
    lift: pick([0, n(0, 30)]), pop: rnd() > .7, holo: pick(['none', 'silver', 'gold', 'holo', 'chameleon', 'glitter']), holoA: n(0, 1),
    reveal: pick(['none', 'flashlight']), revR: n(10, 120), peel: rnd() > .8,
    font: pick(['Onest', 'Literata', 'Press Start 2P', 'Bad"Font', 'IBM Plex Mono']), size: n(4, 120), weight: pick([400, 700, 900]),
    italic: rnd() > .5, upper: rnd() > .5, align: pick(['left', 'center', 'right', 'justify']), valign: pick(['top', 'middle', 'bottom']),
    lh: n(.6, 3), ls: n(-.2, 1), color: col(), tfx: pick(['none', 'emboss', 'deboss', 'extrude', 'outline', 'neon', 'foil']),
    tfxD: n(0, 20), tfxA: n(0, 360), tfxC: col(), bend: pick([0, 0, n(-100, 100)]),
    cols: pick([1, 2, 3]), gap: n(0, 12), dropcap: rnd() > .5, indent: rnd() > .5, dc: col(), marks: rnd() > .5,
    src: pick(['', 'assets/demo/dusk.png', 'uploads/3/' + 'a'.repeat(40) + '.jpg', 'javascript:alert(1)']), fit: pick(['cover', 'contain']),
    fx: n(0, 100), fy: n(0, 100), zoom: n(1, 4), gray: n(0, 1), contrast: n(.3, 2), tintOn: rnd() > .5, tint: col(), tintA: n(0, 1),
    tintMode: pick(['multiply', 'color']), code: pick(['460700123456', '977123456789']),
    gameId: pick([0, 7]), gameName: pick(['', 'Игра <x>']), gameCover: pick(['', '/c.png', 'https://s3/x.png']), label: 'Играть', accent: col(), showName: rnd() > .5
  };
  return {id: 'b' + i, type, x: n(-150, 400), y: n(-20, 300), w: n(1, 250), h: n(.5, 200), r: pick([0, n(-180, 180)]), z: Math.floor(rnd() * 5),
    lock: false, hide: rnd() > .9, p, text: pick(TEXTS)};
}
const iters = +process.argv[2] || 60;
let fails = 0, compared = 0;
for (let it = 0; it < iters; it++) {
  const count = 1 + Math.floor(rnd() * 4);
  const pages = Array.from({length: count}, (_, i) => ({id: i + 1, kind: i === 0 ? 'cover' : pick(['page', 'page', 'back']),
    layout: {bg: col(), density: pick(['auto', 'thin', 'soft', 'stiff', 'hard']), material: pick(['auto', 'offset', 'gloss', 'news', 'holo']),
      finish: pick(['auto', 'gloss', 'matte']), blocks: Array.from({length: Math.floor(rnd() * 6)}, (_, k) => block(it * 100 + i * 10 + k))}}));
  const settings = {folios: rnd() > .3, mag: 'Журнал «Тест» & <co>', folioColor: col(), starter: false};
  const input = {pages, settings, base: '/newmagazine/studio'};
  const out = JSON.parse(execFileSync('php', [__dirname + '/parity.php'], {input: JSON.stringify(input)}).toString());
  out.pages.forEach((pg, i) => {
    compared++;
    const js = R.renderPageHTML(out.pages, i, settings, {base: input.base});
    if (js !== out.html[i]) {
      fails++;
      if (fails <= 3) {
        let k = 0; while (js[k] === out.html[i][k]) k++;
        console.log(`MISMATCH it=${it} page=${i} at ${k}\n JS : …${js.slice(Math.max(0, k - 80), k + 120)}\n PHP: …${out.html[i].slice(Math.max(0, k - 80), k + 120)}`);
      }
    }
  });
}
console.log(`parity: ${compared - fails}/${compared} полос совпали`);
process.exit(fails ? 1 : 0);
