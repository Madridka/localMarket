// Optional smoke check for opening the finished site directly as local files.
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, relative, isAbsolute } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const chrome = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(existsSync);
if (!chrome) throw new Error('Chrome or Edge is required for this optional smoke check');
const profile = mkdtempSync(resolve(root, '.chrome-smoke-'));
const checks = [
  ['index.html', null, 'В Томске'],
  ['index.html?city=seversk', null, 'В Северске'],
  ['index.html?city=moscow', null, 'В Москве'],
  ['index.html?city=tomsk&category=kitchen-chairs', 1, 'Кухонные стулья'],
  ['index.html?city=krasnoyarsk&category=ram', 1, 'Оперативная память'],
  ['index.html?city=tomsk&category=computers', null, 'Компьютеры'],
  ['index.html?city=tomsk&q=Lightning', 4, 'Поиск'],
];

function open(route) {
  const [page, query = ''] = route.split('?');
  const url = pathToFileURL(resolve(root, page)).href + (query ? `?${query}` : '');
  const result = spawnSync(chrome, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-extensions',
    `--user-data-dir=${profile}`, '--virtual-time-budget=2200', '--dump-dom', url,
  ], { encoding: 'utf8', timeout: 15000, maxBuffer: 8 * 1024 * 1024 });
  if (result.error) throw result.error;
  if (!result.stdout.includes('<html')) throw new Error(`${route}: browser did not load HTML`);
  return result.stdout;
}

try {
  for (const [route, expected, heading] of checks) {
    const html = open(route);
    const count = html.match(/<article class="listing-card"(?:\s|>)/g)?.length || 0;
    if (expected === null ? count === 0 : count !== expected) {
      throw new Error(`${route}: ${count} cards; expected ${expected ?? 'between 1 and 79'}`);
    }
    if (!html.includes(heading)) throw new Error(`${route}: heading ${heading} missing`);
    if (route === 'index.html' && !html.includes('Радиус поиска')) throw new Error('Location radius selector is missing');
    console.log(`${route}: ${count} cards`);
  }
  const detail = open('listing.html?id=38&city=tomsk');
  if (!detail.includes('Оперативная память') || !detail.includes('Характеристики') || !detail.includes('5600')) throw new Error('Listing detail is missing category path or attributes');
  const create = open('create.html');
  if (!create.includes('category-picker__option') || !create.includes('Поиск категории') || !create.includes('listing-city')) throw new Error('Create form category or city picker did not render');
  const favorites = open('favorites.html');
  if (!favorites.includes('favorites-grid') || !favorites.includes('listing-card')) throw new Error('Favorites did not render');
  const profilePage = open('profile.html?id=1');
  if (!profilePage.includes('profile-listings') || !profilePage.includes('listing-card')) throw new Error('Profile did not render');
  console.log('Detail, create form, favorites and profile: OK');
} finally {
  const check = relative(root, resolve(profile));
  if (!check || check.startsWith('..') || isAbsolute(check)) throw new Error('Unsafe browser profile path');
  rmSync(profile, { recursive: true, force: true });
}
