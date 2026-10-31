// Run: npm test. These checks mock network and database services.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { transformSync } = require('esbuild');
const root = require('node:path').resolve(__dirname, '..');
function load(file, imports, globals = {}) {
  const code = transformSync(fs.readFileSync(`${root}/${file}`, 'utf8'), { loader: file.endsWith('.mts') ? 'ts' : 'js', format: 'cjs' }).code;
  const module = { exports: {} };
  const context = vm.createContext({ module, exports: module.exports, require: name => {
    if (!(name in imports)) throw new Error(`Unexpected import: ${name}`);
    return imports[name];
  }, Request, Response, Headers, URL, console, ...globals });
  vm.runInContext(code, context);
  return module.exports;
}
function database() {
  const state = { inserted: [], updated: [], deleted: [], selected: [], fail: false };
  const db = {
    select() { const query = { from() { return query; }, where() { return query; }, orderBy() { return query; }, limit() { return state.selected; }, then(resolve, reject) { return state.fail ? Promise.reject(Error('offline')).then(resolve, reject) : Promise.resolve(state.selected).then(resolve, reject); } }; return query; },
    insert() { return { values(value) { if (state.fail) throw Error('offline'); state.inserted.push(value); return { onConflictDoUpdate() { return Promise.resolve(); } }; } }; },
    update() { return { set(value) { state.updated.push(value); return { where() { return { returning() { return [{ id: 'review-id' }]; } }; } }; } }; },
    delete() { return { where() { state.deleted.push(true); return { returning() { return [{ id: 'review-id' }]; } }; } }; },
  };
  return { db, state };
}
const request = (path, method = 'GET', body, origin = 'https://shop.example') => new Request(`https://shop.example/api/${path}`, { method, headers: { Origin: origin, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
(async () => {
  const store = database(); let user = null;
  const imports = { 'node:crypto': require('node:crypto'), 'drizzle-orm': { eq: (...args) => args, desc: value => value }, '../../db/index.js': { db: store.db }, '../../db/schema.js': { reviews: {}, wishlists: {} }, '@netlify/identity': { getUser: async () => user }, '../../public/js/data/products.js': { products: [{ id: 'AS-001' }] } };
  const reviews = load('netlify/functions/reviews.mts', imports).default;
  assert.equal((await reviews(request('reviews?pending=true'))).status, 403);
  assert.equal((await reviews(request('reviews', 'PATCH', { id: 'review-id', approved: true }))).status, 403);
  assert.equal((await reviews(request('reviews', 'POST', { name: 'Ada', rating: 6, message: 'Lovely fit' }))).status, 400);
  assert.equal((await reviews(request('reviews', 'POST', { name: 'Ada', rating: 5, message: 'Lovely fit' }, 'https://other.example'))).status, 403);
  assert.equal((await reviews(request('reviews', 'POST', { name: ' Ada ', rating: 5, message: ' Lovely fit ', approved: true }))).status, 202);
  assert.equal(store.state.inserted[0].name, 'Ada');
  assert.equal(store.state.inserted[0].approved, undefined, 'public clients cannot approve their review');
  const before = store.state.inserted.length;
  assert.equal((await reviews(request('reviews', 'POST', { website: 'spam' }))).status, 202);
  assert.equal(store.state.inserted.length, before);
  user = { id: 'admin', roles: ['admin'] };
  assert.equal((await reviews(request('reviews', 'PATCH', { id: 'review-id', approved: true }))).status, 200);
  assert.equal(store.state.updated[0].approved, true);
  assert.equal((await reviews(request('reviews', 'PATCH', { id: 'review-id', approved: false }))).status, 200);
  assert.equal(store.state.deleted.length, 1);
  const wishlist = load('netlify/functions/wishlist.mts', imports).default;
  const first = await wishlist(request('wishlist'));
  assert.match(first.headers.get('set-cookie'), /HttpOnly; SameSite=Lax; Max-Age=2592000; Secure/);
  assert.equal((await wishlist(request('wishlist', 'PUT', { items: ['missing'] }))).status, 400);
  assert.equal((await wishlist(request('wishlist', 'PUT', { items: ['AS-001'] }, 'https://other.example'))).status, 403);
  assert.equal((await wishlist(request('wishlist', 'PUT', { items: ['AS-001', 'AS-001'] }))).status, 200);
  assert.equal(store.state.inserted.at(-1).items.length, 1);
  store.state.fail = true;
  assert.equal((await wishlist(request('wishlist'))).status, 503);
  console.log('Passed: server validation, origin checks, private moderation, approval/rejection, wishlist cookies, deduplication and failure responses.');
  const { JSDOM } = require('jsdom');
  const tick = () => new Promise(resolve => setTimeout(resolve, 0));
  for (const page of ['signin', 'signup', 'forgot-password', 'reset-password']) {
    const dom = new JSDOM(fs.readFileSync(`${root}/public/${page}.html`, 'utf8'), { url: `https://shop.example/${page}.html`, runScripts: 'outside-only' });
    const identity = { handleAuthCallback: async () => null, getUser: async () => page === 'reset-password' ? { id: 'customer' } : null, login: async () => ({}), signup: async () => ({ confirmedAt: '2026-10-31' }), updateUser: async () => ({}), requestPasswordRecovery: async () => {}, logout: async () => {} };
    const code = transformSync(fs.readFileSync(`${root}/public/js/auth-page.js`, 'utf8'), { format: 'cjs' }).code;
    const context = dom.getInternalVMContext(); context.require = () => ({ loadIdentity: async () => identity }); context.module = { exports: {} }; context.exports = context.module.exports;
    vm.runInContext(code, context); await tick();
    const form = dom.window.document.getElementById('auth-form');
    assert.equal(form.querySelector('[type="submit"]').disabled, false, `${page} initialized`);
    if (form.elements.email) form.elements.email.value = 'customer@example.com';
    if (form.elements.name) form.elements.name.value = 'Ada';
    if (form.elements.password) form.elements.password.value = 'longpassword';
    if (form.elements.confirmPassword) {
      form.elements.confirmPassword.value = 'different';
      form.elements.confirmPassword.dispatchEvent(new dom.window.Event('input'));
      assert.equal(form.checkValidity(), false);
      form.elements.confirmPassword.value = 'longpassword';
      form.elements.confirmPassword.dispatchEvent(new dom.window.Event('input'));
    }
    if (form.elements.terms) form.elements.terms.checked = true;
    const toggle = dom.window.document.querySelector('.password-toggle');
    if (toggle) { toggle.click(); assert.equal(form.elements.password.type, 'text'); toggle.click(); assert.equal(form.elements.password.type, 'password'); }
    assert.equal(form.checkValidity(), true, `${page} form valid`);
    form.dispatchEvent(new dom.window.Event('submit', { cancelable: true })); await tick();
    assert.equal(dom.window.document.getElementById('auth-status').hidden, false);
    if (page === 'signin' || page === 'signup' || page === 'reset-password') assert.equal(dom.window.document.getElementById('account-actions').hidden, false);
    dom.window.close();
  }
  const dom = new JSDOM(fs.readFileSync(`${root}/public/index.html`, 'utf8'), { url: 'https://shop.example', runScripts: 'outside-only' });
  const context = dom.getInternalVMContext(); context.module = { exports: {} }; context.exports = context.module.exports;
  let fail = false, sent;
  context.fetch = async (url, options) => { sent = options.body; return { ok: !fail }; };
  vm.runInContext(transformSync(fs.readFileSync(`${root}/public/js/modules/forms.js`, 'utf8'), { format: 'cjs' }).code, context);
  // Deployment strips the detection attribute; handlers must still attach.
  dom.window.document.querySelectorAll('[data-netlify]').forEach(form => form.removeAttribute('data-netlify'));
  context.module.exports.initPublicForms();
  const form = dom.window.document.getElementById('contact-form');
  form.elements.name.value = 'Ada'; form.elements.email.value = 'customer@example.com'; form.elements.message.value = 'Please confirm the fit for this style.';
  form.dispatchEvent(new dom.window.Event('submit', { cancelable: true })); await tick();
  assert.equal(new URLSearchParams(sent).get('form-name'), 'contact');
  assert.match(form.querySelector('.form-status').textContent, /received/);
  fail = true; form.elements.name.value = 'Ada'; form.elements.email.value = 'customer@example.com'; form.elements.message.value = 'Keep this message on failure.';
  form.dispatchEvent(new dom.window.Event('submit', { cancelable: true })); await tick();
  assert.equal(form.elements.message.value, 'Keep this message on failure.');
  assert.equal(form.querySelector('button').disabled, false);
  assert.match(form.querySelector('.form-status').textContent, /try again/);
  dom.window.close();
  let saved = [], apiCalls = 0, saveFails = false;
  const savedEvents = new dom.window.EventTarget();
  const client = load('public/js/modules/wishlist.js', {
    './utils.js': { api: async (path, options) => {
      apiCalls++;
      if (options) { if (saveFails) throw Error('Save failed'); saved = JSON.parse(options.body).items; }
      return { items: [...saved] };
    } },
    '../data/products.js': { products: [{ id: 'AS-001' }] },
  }, { window: savedEvents, CustomEvent: dom.window.CustomEvent, localStorage: { getItem: () => null, removeItem() {} } });
  await Promise.all([client.initWishlist(), client.initWishlist()]);
  assert.equal(apiCalls, 1, 'concurrent loads share a single request');
  assert.equal(await client.toggleWishlist('AS-001'), true);
  saveFails = true;
  await assert.rejects(client.toggleWishlist('AS-001'), /Save failed/);
  assert.equal(client.getWishlist().includes('AS-001'), true, 'failed save preserves last saved selection');
  saveFails = false;
  assert.equal(await client.toggleWishlist('AS-001'), false, 'queue recovers after failed save');
  assert.equal(saved.length, 0);
  console.log('Passed: wishlist request coalescing, save/remove, failed-save retention and recovery.');
  console.log('Passed: all four authentication pages initialize and submit, password controls and mismatch validation, confirmed signup, Forms encoding, successful submission and failure retention.');
})().catch(error => { console.error(error); process.exit(1); });
