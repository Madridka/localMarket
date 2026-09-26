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
  ['index.html', 80, 'Объявления в Томской области'],
  ['index.html?city=tomsk&origin=center&radius=10', null, 'Рядом с центром Томска'],
  ['index.html?city=seversk&origin=center&scope=region', 80, 'Объявления в Томской области'],
  ['index.html?category=kitchen-chairs', 1, 'Кухонные стулья'],
  ['index.html?category=ram', 1, 'Оперативная память'],
  ['index.html?category=bathroom-toilet-paper-holders', 1, 'Держатели туалетной бумаги'],
  ['index.html?category=computers', 4, 'Компьютеры'],
  ['index.html?q=%D0%BE%D0%BF%D0%B5%D1%80%D0%B0%D1%82%D0%B8%D0%B2%D0%BA%D0%B0', 1, 'Поиск'],
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
    if (expected === null ? count === 0 || count >= 80 : route.includes('computers') ? count < expected : count !== expected) {
      throw new Error(`${route}: ${count} cards; expected ${expected ?? 'between 1 and 79'}`);
    }
    if (!html.includes(heading)) throw new Error(`${route}: heading ${heading} missing`);
    if (route === 'index.html' && (html.includes('Рядом с вами') || !html.includes('от центра Томска'))) {
      throw new Error('Default region view must show the city centre as its distance origin');
    }
    if (route.includes('radius=10') && (!html.includes('Расстояние считается от центра Томска') || html.includes('от вас'))) {
      throw new Error('Radius view must label distances from the city centre');
    }
    console.log(`${route}: ${count} cards`);
  }
  const detail = open('listing.html?id=38&city=tomsk&origin=center');
  if (!detail.includes('Оперативная память') || !detail.includes('Характеристики') || !detail.includes('5600')) throw new Error('Listing detail is missing category path or attributes');
  if (!detail.includes('от центра Томска') || detail.includes('от вас')) throw new Error('Listing detail has an incorrect distance origin');
  const create = open('create.html');
  if (!create.includes('category-picker__option') || !create.includes('Поиск категории')) throw new Error('Create form category picker did not render');
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
