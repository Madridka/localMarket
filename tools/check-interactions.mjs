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
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `
    window.__geoCalls = 0;
    window.__geoDecision = 'denied';
    window.__geoPosition = { latitude: 56.53, longitude: 84.95 };
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition(success, failure) {
          window.__geoCalls += 1;
          queueMicrotask(() => {
            if (window.__geoDecision === 'granted') success({ coords: window.__geoPosition });
            else failure({ code: 1, message: 'Permission denied' });
          });
        },
      },
    });
  ` });
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await navigate('index.html', "document.querySelectorAll('#listing-grid .listing-card').length > 0");
  const defaultCityCount = await evaluate("document.querySelectorAll('#listing-grid .listing-card').length");
  await assertPage("document.querySelector('#catalog-title').textContent === 'В Томске'", 'Default catalog title must describe the selected city');
  await assertPage("document.querySelector('#filter-city').value === 'tomsk' && document.querySelector('[data-location-mode=city]').getAttribute('aria-pressed') === 'true'", 'City mode must be active on first open');
  await assertPage("window.__geoCalls === 0", 'Geolocation was requested on first load');
  await assertPage("[...document.querySelectorAll('#listing-grid [data-location-meta]')].every(item => !/[≈<]|км|метр/.test(item.textContent))", 'City mode must not expose distance from an unknown origin');
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

  await evaluate("document.querySelector('[data-location-mode=nearby]').click()");
  await assertPage("window.__geoCalls === 0 && !document.querySelector('#location-permission').hidden", 'Nearby must show an explanation before requesting permission');
  await evaluate("window.__geoDecision = 'granted'; document.querySelector('#use-my-location').click()");
  await ready("document.querySelector('#catalog-title')?.textContent === 'Рядом с вами'");
  await assertPage("window.__geoCalls === 1 && new URLSearchParams(location.search).get('location') === 'nearby' && document.querySelectorAll('#listing-grid .nearby-group').length > 0", 'Explicit geolocation did not enable adaptive nearby groups');
  await assertPage(`!/[?&](?:latitude|longitude|lat|lng)=/.test(location.search) && !/(?:latitude|longitude)/.test(localStorage.getItem('ryadom.location.v2'))`, 'Raw user coordinates leaked into URL or storage');
  await assertPage("[...document.querySelectorAll('#listing-grid [data-location-meta]')].some(item => /≈|< 300 м|7–10 км/.test(item.textContent))", 'Nearby cards do not show approximate distance');

  await evaluate("(() => { const input = document.querySelector('#global-search'); input.value = 'Кухонные стулья'; input.dispatchEvent(new Event('input', { bubbles: true })); })()");
  await ready("document.querySelectorAll('#listing-grid .listing-card').length === 1");
  await assertPage("document.querySelector('.nearby-fallback')?.textContent.includes('Поблизости ничего не нашли')", 'A rare distant result did not fall back to the selected city');
  await evaluate("(() => { const input = document.querySelector('#global-search'); input.value = 'Lightning'; input.dispatchEvent(new Event('input', { bubbles: true })); })()");
  await ready("document.querySelectorAll('#listing-grid .listing-card').length === 4");
  await assertPage("document.querySelector('.nearby-group h2') && document.querySelector('#listing-grid').classList.contains('nearby-feed')", 'Nearby search is not grouped geographically');
  await evaluate("document.querySelector('[data-location-mode=city]').click()");
  await ready("document.querySelector('#catalog-title')?.textContent.includes('Поиск')");
  await assertPage("!new URLSearchParams(location.search).has('location') && [...document.querySelectorAll('#listing-grid [data-location-meta]')].every(item => !/[≈<]|км/.test(item.textContent))", 'City mode still behaves like a radius filter');

  await evaluate("(() => { const input = document.querySelector('#global-search'); input.value = ''; input.dispatchEvent(new Event('input', { bubbles: true })); const city = document.querySelector('#filter-city'); city.value = 'moscow'; city.dispatchEvent(new Event('change', { bubbles: true })); })()");
  await ready("document.querySelector('#catalog-title')?.textContent === 'В Москве'");
  await assertPage("document.querySelectorAll('#listing-grid .listing-card').length > 0 && [...document.querySelectorAll('#listing-grid [data-location-meta]')].every(item => !item.textContent.includes('Кировский'))", 'Changing city leaked Tomsk listings');

  await evaluate("(() => { const city = document.querySelector('#filter-city'); city.value = 'tomsk'; city.dispatchEvent(new Event('change', { bubbles: true })); document.querySelector('[data-location-mode=nearby]').click(); })()");
  await evaluate("window.__geoDecision = 'denied'; document.querySelector('#use-my-location').click()");
  await ready("window.__geoCalls === 2 && document.querySelector('#toast-root')?.textContent.includes('Не удалось получить местоположение')");
  await evaluate("(() => { const area = document.querySelector('#filter-area'); area.value = 'kirovsky'; area.dispatchEvent(new Event('change', { bubbles: true })); })()");
  await ready("document.querySelector('#catalog-title')?.textContent === 'Рядом с Кировским районом'");
  await assertPage("new URLSearchParams(location.search).get('area') === 'kirovsky' && !new URLSearchParams(location.search).has('location')", 'Manual area fallback did not update state and URL');
  await evaluate("(() => { const city = document.querySelector('#filter-city'); city.value = 'moscow'; city.dispatchEvent(new Event('change', { bubbles: true })); city.value = 'tomsk'; city.dispatchEvent(new Event('change', { bubbles: true })); document.querySelector('[data-location-mode=nearby]').click(); window.__geoDecision = 'granted'; window.__geoPosition = { latitude: 56.588, longitude: 84.95 }; document.querySelector('#use-my-location').click(); })()");
  await ready("window.__geoCalls === 3 && document.querySelector('#catalog-title')?.textContent === 'Рядом с вами'");
  await assertPage("JSON.parse(localStorage.getItem('ryadom.location.v2')).locationCell.centerLat >= 56.58", 'Nearby search did not use the user cell away from the city centre');
  console.log('Local-first city, nearby, privacy and manual fallback: OK');

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
  await evaluate("(() => { const area = document.querySelector('#listing-area'); area.value = 'kirovsky'; area.dispatchEvent(new Event('change', { bubbles: true })); })()");
  console.log('Create form search, drill-down and attributes: OK');

  await evaluate("new Promise(resolve => { const canvas = document.createElement('canvas'); canvas.width = 2; canvas.height = 2; canvas.getContext('2d').fillRect(0, 0, 2, 2); canvas.toBlob(blob => { const transfer = new DataTransfer(); transfer.items.add(new File([blob], 'test.png', { type: 'image/png' })); const input = document.querySelector('#listing-photos'); input.files = transfer.files; input.dispatchEvent(new Event('change', { bubbles: true })); resolve(true); }, 'image/png'); })");
  await ready("document.querySelectorAll('#photo-previews .photo-preview__item').length === 1");
  await evaluate("(() => { const form = document.querySelector('#create-form'); form.elements.title.value = 'Тестовая память DDR5'; form.elements.description.value = 'Два исправных модуля'; form.elements.condition.value = 'good'; form.elements.price.value = '1000'; form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); })()");
  if (!await evaluate("(() => { const item = JSON.parse(localStorage.getItem('ryadom.listings.v1')).find(item => item.id === 1001); return item?.categoryId === 'ram-ddr5' && item?.areaId === 'kirovsky' && item?.locationCell && !('latitude' in item) && !('longitude' in item); })()")) throw new Error('Publishing did not persist a privacy-safe listing location');
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
