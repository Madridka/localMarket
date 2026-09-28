// Optional interaction check in a temporary headless Chrome profile.
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const chrome = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(existsSync);
if (!chrome) throw new Error('Chrome or Edge is required for this optional check');
const profile = mkdtempSync(resolve(root, '.chrome-interaction-'));
const processChrome = spawn(chrome, [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-extensions',
  '--remote-debugging-port=0', '--remote-allow-origins=*', `--user-data-dir=${profile}`, 'about:blank',
], { windowsHide: true, stdio: 'ignore' });
const pause = (ms) => new Promise((resolvePause) => setTimeout(resolvePause, ms));
let socket;

try {
  let port;
  for (let attempt = 0; attempt < 80; attempt++) {
    try { port = Number(readFileSync(resolve(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0]); break; }
    catch { await pause(100); }
  }
  if (!port) throw new Error('Chrome debugging port did not start');
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const target = targets.find((item) => item.type === 'page');
  if (!target) throw new Error('Chrome page target not found');
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolveOpen, rejectOpen) => {
    socket.addEventListener('open', resolveOpen, { once: true });
    socket.addEventListener('error', rejectOpen, { once: true });
  });
  let nextId = 0;
  const pending = new Map();
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (!message.id) return;
    const entry = pending.get(message.id);
    if (!entry) return;
    pending.delete(message.id);
    if (message.error) entry.reject(new Error(message.error.message));
    else entry.resolve(message.result);
  });
  function send(method, params = {}) {
    return new Promise((resolveSend, rejectSend) => {
      const id = ++nextId;
      pending.set(id, { resolve: resolveSend, reject: rejectSend });
      socket.send(JSON.stringify({ id, method, params }));
    });
  }
  async function evaluate(expression) {
    const value = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (value.exceptionDetails) throw new Error(value.exceptionDetails.text);
    return value.result.value;
  }
  async function ready(expression) {
    for (let attempt = 0; attempt < 40; attempt++) {
      if (await evaluate(expression)) return;
      await pause(100);
    }
    throw new Error(`Page did not become ready: ${expression}`);
  }
  async function assertPage(expression, message) {
    if (!await evaluate(expression)) throw new Error(message);
  }
  async function navigate(route, check) {
    const [page, query = ''] = route.split('?');
    const url = pathToFileURL(resolve(root, page)).href + (query ? `?${query}` : '');
    await send('Page.navigate', { url });
    await ready(check);
  }

  await send('Runtime.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await navigate('index.html', "document.querySelectorAll('#listing-grid .listing-card').length > 0");
  const defaultCityCount = await evaluate("document.querySelectorAll('#listing-grid .listing-card').length");
  await assertPage("document.querySelector('#catalog-title').textContent === 'Объявления в радиусе 25 км от Томска'", 'Default catalog title must describe the city radius');
  await assertPage("document.querySelector('#filter-city').value === 'tomsk' && document.querySelector('#filter-radius').value === '25'", 'Default city and radius must be selected');
  await assertPage("localStorage.getItem('locationCity') === 'Томск' && localStorage.getItem('locationRadius') === '25'", 'Location selection was not persisted');
  await assertPage("document.querySelectorAll('.location-filter select').length === 2", 'Location filter must contain only city and radius selectors');
  const mobileWidth = await evaluate('({ viewport: innerWidth, content: document.documentElement.scrollWidth })');
  if (mobileWidth.content > mobileWidth.viewport) throw new Error(`Mobile catalog overflows horizontally: ${JSON.stringify(mobileWidth)}`);
  if (process.env.MARKET_SCREENSHOT) {
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(resolve(root, '.chrome-test', 'mobile-cdp.png'), Buffer.from(shot.data, 'base64'));
  }
  await assertPage("!document.querySelector('#category-selector') && document.querySelector('#filter-sidebar #category-tree')", 'Categories must be embedded in the filter sidebar without a catalog modal');
  await assertPage("document.querySelector('#category-tree [data-tree-category=\"\"]')?.textContent === 'Все категории' && document.querySelectorAll('#category-tree .category-tree__level [data-tree-category]').length <= 7", 'The root category level is not compact');
  await evaluate("document.querySelector('#category-tree [data-category-tree-toggle]')?.click()");
  await assertPage("!document.querySelector('#category-tree [data-category-tree-toggle]') || document.querySelector('#category-tree [data-category-tree-toggle]').textContent === 'Свернуть'", 'The root category level did not expand');
  await evaluate("document.querySelector('#category-tree [data-tree-category=home]').click()");
  await assertPage("new URLSearchParams(location.search).get('category') === 'home' && document.querySelector('#category-tree [data-tree-category=home]').classList.contains('category-current') && document.querySelector('#category-tree [data-tree-category=kitchen]')", 'Selecting a parent category did not update the contextual tree and URL');
  const homeCount = await evaluate("document.querySelectorAll('#listing-grid .listing-card').length");
  if (homeCount <= 1 || homeCount >= defaultCityCount) throw new Error(`Parent category did not include descendants: ${homeCount} cards`);

  for (const id of ['kitchen', 'kitchen-furniture', 'kitchen-chairs-group', 'kitchen-chairs']) {
    const clicked = await evaluate(`(() => { let button = document.querySelector('#category-tree [data-tree-category="${id}"]'); if (!button) { document.querySelector('#category-tree [data-category-tree-toggle]')?.click(); button = document.querySelector('#category-tree [data-tree-category="${id}"]'); } if (!button) return false; button.click(); return true; })()`);
    if (!clicked) throw new Error(`Category step ${id} missing`);
  }
  await assertPage("document.querySelector('#category-tree [data-tree-category=kitchen-chairs]').classList.contains('category-current') && document.querySelectorAll('#category-tree .category-tree__path [data-tree-category]').length === 4", 'Deep leaf selection did not keep its ancestors and siblings visible');
  await assertPage("Math.max(...[...document.querySelectorAll('#category-tree [style*=category-indent]')].map(item => parseInt(item.style.getPropertyValue('--category-indent')) || 0)) <= 48", 'Deep taxonomy indentation exceeded three visual levels');
  await assertPage("new URLSearchParams(location.search).get('category') === 'kitchen-chairs' && document.querySelectorAll('#listing-grid .listing-card').length === 1", 'Kitchen chairs filter did not narrow results');
  await evaluate("document.querySelector('#save-search').click()");
  if (!await evaluate("JSON.parse(localStorage.getItem('ryadom.saved-searches.v1')).some(item => item.category === 'kitchen-chairs')")) throw new Error('Selected category was not saved in search');
  await evaluate("document.querySelector('#listing-grid [data-favorite-id]').click()");
  await evaluate("document.querySelector('#category-tree [data-tree-category=kitchen]').click()");
  await assertPage("new URLSearchParams(location.search).get('category') === 'kitchen' && document.querySelector('#category-tree [data-tree-category=kitchen-furniture]')", 'Clicking an ancestor did not move back to its child level');
  await evaluate("history.back()");
  await ready("new URLSearchParams(location.search).get('category') === 'kitchen-chairs'");
  await assertPage("document.querySelector('#category-tree [data-tree-category=kitchen-chairs]').classList.contains('category-current')", 'Browser Back did not restore the category tree');
  await evaluate("document.querySelector('#category-tree [data-tree-category=\"\"]').click()");
  await assertPage(`document.querySelectorAll('#listing-grid .listing-card').length === ${defaultCityCount}`, 'Clearing the category did not restore city results');
  console.log('Contextual category tree, deep path and browser history: OK');

  await evaluate("(() => { const radius = document.querySelector('#filter-radius'); radius.value = '5'; radius.dispatchEvent(new Event('change', { bubbles: true })); })()");
  await ready("new URLSearchParams(location.search).get('radius') === '5'");
  const narrowRadiusCount = await evaluate("document.querySelectorAll('#listing-grid .listing-card').length");
  if (narrowRadiusCount >= defaultCityCount) throw new Error('Reducing the radius did not narrow catalog results');
  await assertPage("localStorage.getItem('locationRadius') === '5'", 'Selected radius was not persisted');

  await evaluate("(() => { const city = document.querySelector('#filter-city'); city.value = 'moscow'; city.dispatchEvent(new Event('change', { bubbles: true })); const radius = document.querySelector('#filter-radius'); radius.value = '25'; radius.dispatchEvent(new Event('change', { bubbles: true })); })()");
  await ready("document.querySelector('#catalog-title')?.textContent === 'Объявления в радиусе 25 км от Москвы'");
  await assertPage("new URLSearchParams(location.search).get('city') === 'moscow' && new URLSearchParams(location.search).get('radius') === '25'", 'City and radius were not written to the URL');
  await assertPage("localStorage.getItem('locationCity') === 'Москва' && localStorage.getItem('locationRadius') === '25'", 'City and radius were not stored');
  console.log('City and radius location filter: OK');

  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });

  await navigate('favorites.html', "document.querySelectorAll('#favorites-grid .listing-card').length === 4");
  console.log('Favorite listing from the catalog: OK');

  await navigate('create.html', "document.querySelector('[data-choose-category=electronics]') !== null");
  const searchCount = await evaluate("(() => { const input = document.querySelector('#listing-category-search'); input.value = 'оперативка'; input.dispatchEvent(new Event('input', { bubbles: true })); return document.querySelectorAll('[data-search-category]').length; })()");
  if (searchCount !== 1) throw new Error('Category alias search failed');
  await evaluate("document.querySelector('[data-search-category=ram]').click()");
  await evaluate("document.querySelector('[data-choose-category=ram-ddr5]').click()");
  if (await evaluate("document.querySelector('#listing-category').value") !== 'ram-ddr5') throw new Error('Leaf category was not selected');
  if (await evaluate("document.querySelectorAll('[data-attribute-id]').length") < 4) throw new Error('Dynamic RAM attributes did not render');
  console.log('Create form search, drill-down and attributes: OK');

  await evaluate("new Promise(resolve => { const canvas = document.createElement('canvas'); canvas.width = 2; canvas.height = 2; canvas.getContext('2d').fillRect(0, 0, 2, 2); canvas.toBlob(blob => { const transfer = new DataTransfer(); transfer.items.add(new File([blob], 'test.png', { type: 'image/png' })); const input = document.querySelector('#listing-photos'); input.files = transfer.files; input.dispatchEvent(new Event('change', { bubbles: true })); resolve(true); }, 'image/png'); })");
  await ready("document.querySelectorAll('#photo-previews .photo-preview__item').length === 1");
  await evaluate("(() => { const form = document.querySelector('#create-form'); form.elements.title.value = 'Тестовая память DDR5'; form.elements.description.value = 'Два исправных модуля'; form.elements.condition.value = 'good'; form.elements.price.value = '1000'; form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); })()");
  if (!await evaluate("(() => { const item = JSON.parse(localStorage.getItem('ryadom.listings.v1')).find(item => item.id === 1001); return item?.categoryId === 'ram-ddr5' && item?.cityId === 'tomsk' && !('areaId' in item) && item?.locationCell && !('latitude' in item) && !('longitude' in item); })()")) throw new Error('Publishing did not persist the selected city location');
  console.log('Publishing a listing from file://: OK');

  await evaluate("(() => { const items = JSON.parse(localStorage.getItem('ryadom.listings.v1')); items.push({id:1002,title:'Старая память',description:'Работает',price:1000,category:'electronics',subcategory:'computers',condition:'good',city:'Томск',distance:1,images:['./assets/placeholder.svg'],sellerId:0,createdAt:'2026-09-20T10:00:00',views:0}); localStorage.setItem('ryadom.listings.v1', JSON.stringify(items)); })()");
  await navigate('create.html?edit=1002', "document.querySelector('#listing-title')?.value === 'Старая память'");
  if (!await evaluate("document.querySelector('#listing-category').value")) throw new Error('Legacy listing category migration failed');
  await evaluate("(() => { const title = document.querySelector('#listing-title'); title.value = 'Обновлённая память'; title.dispatchEvent(new Event('input', { bubbles: true })); document.querySelector('#create-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); })()");
  if (!await evaluate("JSON.parse(localStorage.getItem('ryadom.listings.v1')).some(item => item.id === 1002 && item.title === 'Обновлённая память')")) throw new Error('Edit form did not save listing');
  console.log('Legacy localStorage migration and editing: OK');
} finally {
  socket?.close();
  processChrome.kill();
  await pause(300);
  const check = relative(root, resolve(profile));
  if (!check || check.startsWith('..') || isAbsolute(check)) throw new Error('Unsafe browser profile path');
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* Chrome may still be closing on Windows. */ }
}
