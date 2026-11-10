/* D-R2: real 1.9.3 ProjectRegion/ProjectItem vs integrated React Sidebar. */
process.env.FOCUS_RESTORE_SHARED = process.env.FOCUS_RESTORE_SHARED || '1';
const { paired, copyFixture, assert, fs, path } = require('./ui-restore-helpers.cjs');
const out = path.resolve(process.env.FOCUS_ACCEPTANCE_DIR || 'dist/acceptance/d-r2');
const zh = process.env.FOCUS_SIDEBAR_LOCALE !== 'en';
const locale = zh ? 'zh-CN' : 'en';
const dark = process.env.FOCUS_SIDEBAR_DARK === '1';
const labels = zh ? { editProject: '编辑清单', hideProject: '完成清单', deleteProject: '删除清单', editFolder: '编辑清单夹', deleteFolder: '删除清单夹', editTag: '编辑标签', deleteTag: '删除标签', search: '搜索', searchResults: '搜索结果', ok: '确定', clearSearch: '清除搜索', collapse: '折叠文件夹', expand: '展开文件夹' }
  : { editProject: 'Edit Project', hideProject: 'Complete', deleteProject: 'Delete Project', editFolder: 'Edit Folder', deleteFolder: 'Delete', editTag: 'Edit Tag', deleteTag: 'Delete', search: 'Search', searchResults: 'Search Results', ok: 'OK', clearSearch: 'Clear search', collapse: 'Collapse folder', expand: 'Expand folder' };
const results = [];
async function rows(page, table) { return page.evaluate(table => new Promise((resolve, reject) => { const r = indexedDB.open('FocusTodoStandalone.PomodoroDB6', 3); r.onerror = () => reject(r.error); r.onsuccess = () => { const db = r.result, q = db.transaction(table).objectStore(table).getAll(); q.onsuccess = () => { db.close(); resolve(q.result) }; q.onerror = () => reject(q.error) } }), table) }
async function oldProjects(page) { return page.evaluate(async () => (await FocusLocalData.snapshot()).indexedDB.Project) }
const oldRow = (page, id) => page.locator('#' + id);
const newRow = (page, id) => page.locator(`[data-project-id="${id}"] > .workspace-nav`);
const oldMenu = page => page.locator('[class*=ContextMenu-contextmenu]');
const newMenu = page => page.getByRole('menu');
async function openMenu(pair, id) { await oldRow(pair.old, id).click({ button: 'right' }); await oldMenu(pair.old).waitFor(); await newRow(pair.new, id).click({ button: 'right' }); await newMenu(pair.new).waitFor(); await pair.old.waitForTimeout(300) }
async function closeMenu(pair) { await pair.old.mouse.click(900, 800); await pair.new.mouse.click(900, 800); await oldMenu(pair.old).waitFor({ state: 'detached' }); await newMenu(pair.new).waitFor({ state: 'detached' }) }
async function menuText(page, old) { return old ? page.locator('[class*=ContextMenuItem-root]').allInnerTexts() : page.getByRole('menuitem').allInnerTexts() }
async function heading(page) { return page.locator('.workspace-view-heading h1').innerText() }
async function oldHeading(page) { return page.locator('[class*=TaskRegion-projectName]').first().innerText() }

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const pair = await paired({ locale, dark });
  try {
    await pair.old.evaluate(async () => {
      const snapshot = await FocusLocalData.snapshot(), base = snapshot.indexedDB.Project.find(row => row.type === 7005);
      const rows = [
        { id: 'sidebar-a', name: 'Sidebar A', type: 1000, parentId: '', order: 100000, color: '67C3E8' },
        { id: 'sidebar-folder', name: 'Sidebar folder', type: 2000, parentId: '', order: 200000, color: 'EC6B66', expanded: true },
        { id: 'sidebar-child', name: 'Sidebar child', type: 1000, parentId: 'sidebar-folder', order: 210000, color: 'A0CE62' },
        { id: 'sidebar-tag', name: 'Sidebar tag', type: 3000, parentId: '', order: 300000, color: 'F4658C' },
        { id: 'sidebar-b', name: 'Sidebar B', type: 1000, parentId: '', order: 400000, color: '768BFD' },
      ];
      await new Promise((resolve, reject) => { const q = indexedDB.open('PomodoroDB6', 3); q.onsuccess = () => { const db = q.result, tx = db.transaction('Project', 'readwrite'), store = tx.objectStore('Project'); for (const row of rows) store.put({ ...base, ...row, state: 0 }); tx.oncomplete = () => { db.close(); resolve() }; tx.onerror = () => reject(tx.error) } });
    });
    await pair.old.reload(); await pair.old.waitForFunction(() => window.FocusLocalReady && !document.documentElement.classList.contains('focus-starting')); await pair.old.evaluate(() => FocusLocalReady);
    await copyFixture(pair); await pair.new.locator('[data-testid=app-shell]').waitFor();
    const oldBox = await oldRow(pair.old, 'sidebar-a').boundingBox(), newBox = await newRow(pair.new, 'sidebar-a').boundingBox();
    assert.equal(newBox.height, oldBox.height);
    assert(newBox.width >= oldBox.width - 20, 'integrated row keeps the legacy full-width hit area');
    for (const id of ['sidebar-a', 'sidebar-folder', 'sidebar-child', 'sidebar-tag', 'sidebar-b']) {
      const before = await oldRow(pair.old, id).boundingBox(), after = await newRow(pair.new, id).boundingBox();
      assert.equal(after.y, before.y, id + ' keeps the legacy row y position');
      assert.equal(after.height, before.height, id + ' keeps the legacy row height');
    }
    assert.equal(await pair.old.locator('[class*=ProjectRegion-root]').evaluate(e => e.getBoundingClientRect().width), 280);
    assert.equal(await pair.new.locator('.workspace-sidebar').evaluate(e => e.getBoundingClientRect().width), 280);
    const oldSearch = await pair.old.locator('input[class*=SearchItem-searchInput]').boundingBox(), newSearch = await pair.new.locator('input[type=search]').boundingBox();
    assert.deepEqual(newSearch, oldSearch, 'search input keeps legacy geometry');
    await pair.old.screenshot({ path: path.join(out, 'old-base.png') }); await pair.new.screenshot({ path: path.join(out, 'new-base.png') });

    // Folder body selects its view; the arrow alone controls expansion.
    await oldRow(pair.old, 'sidebar-folder').click(); await newRow(pair.new, 'sidebar-folder').click();
    assert.equal(await oldHeading(pair.old), 'Sidebar folder'); assert.equal(await heading(pair.new), 'Sidebar folder');
    assert.equal(await oldRow(pair.old, 'sidebar-child').isVisible(), true); assert.equal(await newRow(pair.new, 'sidebar-child').isVisible(), true);
    await pair.old.locator('#sidebar-folder [class*=ProjectItem-folderIndicator]').click(); await pair.new.getByRole('button', { name: labels.collapse, exact: true }).click();
    await oldRow(pair.old, 'sidebar-child').waitFor({ state: 'hidden' }); await newRow(pair.new, 'sidebar-child').waitFor({ state: 'hidden' });
    await pair.old.locator('#sidebar-folder [class*=ProjectItem-folderIndicator]').click(); await pair.new.getByRole('button', { name: labels.expand, exact: true }).click();
    await oldRow(pair.old, 'sidebar-child').waitFor(); await newRow(pair.new, 'sidebar-child').waitFor();

    // Legacy hover: custom row reveals the menu and hides both counters.
    await oldRow(pair.old, 'sidebar-a').hover(); await newRow(pair.new, 'sidebar-a').hover(); await pair.old.waitForTimeout(120);
    assert.equal(await oldRow(pair.old, 'sidebar-a').locator('[class*=ProjectItem-estimatedTime]').evaluate(e => getComputedStyle(e).display), 'none');
    assert.equal(await oldRow(pair.old, 'sidebar-a').locator('[class*=ProjectItem-taskQuantity]').evaluate(e => getComputedStyle(e).display), 'none');
    assert.equal(await oldRow(pair.old, 'sidebar-a').locator('[class*=ProjectItem-menu]').evaluate(e => getComputedStyle(e).display), 'block');
    assert.equal(await newRow(pair.new, 'sidebar-a').locator('.workspace-nav-estimate').evaluate(e => getComputedStyle(e).display), 'none');
    assert.equal(await newRow(pair.new, 'sidebar-a').locator('.workspace-nav-count').evaluate(e => getComputedStyle(e).display), 'none');
    assert.equal(await pair.new.locator('[data-project-id=sidebar-a] .sidebar-menu-button').evaluate(e => getComputedStyle(e).display), 'flex');
    await pair.old.screenshot({ path: path.join(out, 'old-hover.png') }); await pair.new.screenshot({ path: path.join(out, 'new-hover.png') });
    await oldRow(pair.old, 'sidebar-a').locator('[class*=ProjectItem-menu]').click(); await oldMenu(pair.old).waitFor();
    await pair.new.locator('[data-project-id=sidebar-a] .sidebar-menu-button').click(); await newMenu(pair.new).waitFor(); await pair.old.waitForTimeout(300);
    await pair.old.screenshot({ path: path.join(out, 'old-menu.png') }); await pair.new.screenshot({ path: path.join(out, 'new-menu.png') });
    await closeMenu(pair);

    // Project, folder and tag menus preserve the legacy labels and dismissal.
    for (const [id, expected] of [['sidebar-a', [labels.editProject, labels.hideProject, labels.deleteProject]], ['sidebar-folder', [labels.editFolder, labels.deleteFolder]], ['sidebar-tag', [labels.editTag, labels.deleteTag]]]) {
      await openMenu(pair, id); assert.deepEqual(await menuText(pair.old, true), expected); assert.deepEqual(await menuText(pair.new, false), expected); await closeMenu(pair);
    }
    await openMenu(pair, 'sidebar-a'); await pair.old.getByText(labels.editProject, { exact: true }).click(); await pair.new.getByRole('menuitem', { name: labels.editProject, exact: true }).click();
    await pair.old.locator('[class*=ProjectEditer-root]').waitFor(); await pair.new.getByRole('dialog').waitFor();
    await pair.old.locator('[class*=ProjectEditer-cancel]').click(); await pair.new.keyboard.press('Escape');
    await pair.old.locator('[class*=ProjectEditer-root]').waitFor({ state: 'hidden' }); await pair.new.getByRole('dialog').waitFor({ state: 'hidden' });

    // Search waits 300 ms, Escape restores the previous project and clears the query.
    await oldRow(pair.old, 'sidebar-a').click(); await newRow(pair.new, 'sidebar-a').click();
    await pair.old.locator('input[class*=SearchItem-searchInput]').fill('Sidebar'); await pair.new.getByRole('searchbox').fill('Sidebar');
    await pair.old.waitForTimeout(120); assert.equal(await oldHeading(pair.old), 'Sidebar A'); assert.equal(await heading(pair.new), 'Sidebar A');
    await pair.old.waitForTimeout(300);
    assert.equal(await oldHeading(pair.old), labels.searchResults); assert.equal(await heading(pair.new), labels.searchResults);
    await pair.old.keyboard.press('Escape'); await pair.new.keyboard.press('Escape'); await pair.old.waitForTimeout(80);
    assert.equal(await oldHeading(pair.old), 'Sidebar A'); assert.equal(await heading(pair.new), 'Sidebar A');
    assert.equal(await pair.old.locator('input[class*=SearchItem-searchInput]').inputValue(), ''); assert.equal(await pair.new.getByRole('searchbox').inputValue(), '');
    assert.equal(await pair.new.evaluate(() => document.activeElement === document.querySelector('input[type=search]')), true);
    await pair.old.locator('input[class*=SearchItem-searchInput]').fill('zzz'); await pair.new.getByRole('searchbox').fill('zzz'); await pair.old.waitForTimeout(350);
    await pair.old.locator('[class*=SearchItem-clearButton]').click(); await pair.new.getByRole('button', { name: labels.clearSearch, exact: true }).click(); await pair.old.waitForTimeout(80);
    assert.equal(await oldHeading(pair.old), 'Sidebar A'); assert.equal(await heading(pair.new), 'Sidebar A');

    // Custom-list drag reorder updates the same persisted order.
    const oldBefore = (await oldProjects(pair.old)).find(row => row.id === 'sidebar-b').order;
    const newBefore = (await rows(pair.new, 'Project')).find(row => row.id === 'sidebar-b').order;
    assert.equal(oldBefore, newBefore);
    await oldRow(pair.old, 'sidebar-b').dragTo(oldRow(pair.old, 'sidebar-a'));
    await pair.new.evaluate(() => {
      const source = document.querySelector('[data-project-id="sidebar-b"] > .workspace-nav'), transfer = new DataTransfer();
      window.__sidebarTransfer = transfer;
      source.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: transfer }));
    });
    await pair.new.waitForFunction(() => document.querySelector('[data-project-id="sidebar-b"]')?.getAttribute('data-dragging') === 'true');
    await pair.new.evaluate(() => {
      const target = document.querySelector('[data-project-id="sidebar-a"]');
      target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: window.__sidebarTransfer }));
    });
    await pair.new.waitForFunction(() => document.querySelector('[data-project-id="sidebar-a"]')?.getAttribute('data-over') === 'true');
    const previewOrder = await pair.new.locator('.sidebar-customs .sidebar-item').evaluateAll(rows => rows.map(row => row.getAttribute('data-project-id')));
    assert(previewOrder.indexOf('sidebar-b') < previewOrder.indexOf('sidebar-a'), 'drag preview moves the source before the target');
    assert.equal(await pair.new.locator('.sidebar-item[data-project-id="sidebar-b"]').getAttribute('data-dragging'), 'true');
    assert.equal(await pair.new.locator('.sidebar-item[data-project-id="sidebar-a"]').getAttribute('data-over'), 'true');
    await pair.new.screenshot({ path: path.join(out, 'drag-preview.png') });
    await pair.new.evaluate(() => {
      const target = document.querySelector('[data-project-id="sidebar-a"]'), transfer = window.__sidebarTransfer;
      target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }));
    });
    await pair.old.waitForTimeout(400); await pair.new.waitForTimeout(400);
    const oldAfter = (await oldProjects(pair.old)).find(row => row.id === 'sidebar-b').order;
    const newAfter = (await rows(pair.new, 'Project')).find(row => row.id === 'sidebar-b').order;
    assert.equal(oldAfter, newAfter); assert(oldAfter < (await oldProjects(pair.old)).find(row => row.id === 'sidebar-a').order);

    // Delete project confirmation removes the custom row; hide remains available for another list.
    await openMenu(pair, 'sidebar-b'); await pair.old.getByText(labels.deleteProject, { exact: true }).click(); await pair.new.getByRole('menuitem', { name: labels.deleteProject, exact: true }).click();
    await pair.old.locator('[class*=ConfirmDialog-root]').waitFor(); await pair.new.getByRole('dialog').waitFor();
    await pair.old.locator('[class*=ConfirmDialog-confirm]').click(); await pair.new.getByRole('dialog').getByRole('button', { name: labels.ok, exact: true }).click();
    await pair.old.locator('[class*=ConfirmDialog-root]').waitFor({ state: 'hidden' }); await pair.new.getByRole('dialog').waitFor({ state: 'hidden' });
    assert.equal((await oldProjects(pair.old)).find(row => row.id === 'sidebar-b').state, -1); assert.equal((await rows(pair.new, 'Project')).find(row => row.id === 'sidebar-b').state, -1);

    await openMenu(pair, 'sidebar-a'); await pair.old.getByText(labels.hideProject, { exact: true }).click(); await pair.new.getByRole('menuitem', { name: labels.hideProject, exact: true }).click();
    await pair.old.locator('[class*=ConfirmDialog-root]').waitFor(); await pair.new.getByRole('dialog').waitFor();
    await pair.old.locator('[class*=ConfirmDialog-confirm]').click(); await pair.new.getByRole('dialog').getByRole('button', { name: labels.ok, exact: true }).click();
    await pair.old.locator('[class*=ConfirmDialog-root]').waitFor({ state: 'hidden' }); await pair.new.getByRole('dialog').waitFor({ state: 'hidden' });
    assert.equal((await oldProjects(pair.old)).find(row => row.id === 'sidebar-a').state, 1); assert.equal((await rows(pair.new, 'Project')).find(row => row.id === 'sidebar-a').state, 1);
    await oldRow(pair.old, 'sidebar-a').waitFor({ state: 'hidden' }); await newRow(pair.new, 'sidebar-a').waitFor({ state: 'hidden' });
    await openMenu(pair, 'sidebar-tag'); await pair.old.getByText(labels.deleteTag, { exact: true }).click(); await pair.new.getByRole('menuitem', { name: labels.deleteTag, exact: true }).click();
    await oldRow(pair.old, 'sidebar-tag').waitFor({ state: 'hidden' }); await newRow(pair.new, 'sidebar-tag').waitFor({ state: 'hidden' });
    assert.equal((await oldProjects(pair.old)).find(row => row.id === 'sidebar-tag').state, -1); assert.equal((await rows(pair.new, 'Project')).find(row => row.id === 'sidebar-tag').state, -1);
    await oldMenu(pair.old).waitFor({ state: 'detached' }); await newMenu(pair.new).waitFor({ state: 'detached' }); await pair.old.waitForTimeout(350); await pair.new.waitForTimeout(350);

    const oldHandle = await pair.old.locator('[class*=ProjectRegion-resizeHandle]').boundingBox();
    const newHandle = await pair.new.locator('.workspace-resize').boundingBox();
    await pair.old.mouse.move(oldHandle.x + oldHandle.width / 2, oldHandle.y + 200); await pair.old.mouse.down(); await pair.old.mouse.move(oldHandle.x + oldHandle.width / 2 + 20, oldHandle.y + 200); await pair.old.mouse.up();
    await pair.new.mouse.move(newHandle.x + 1, newHandle.y + 200); await pair.new.mouse.down(); await pair.new.mouse.move(newHandle.x + 21, newHandle.y + 200); await pair.new.mouse.up();
    await pair.old.waitForFunction(() => document.querySelector('[class*=ProjectRegion-root]').getBoundingClientRect().width === 300);
    await pair.new.waitForFunction(() => document.querySelector('.workspace-sidebar').getBoundingClientRect().width === 300);

    results.push({ name: 'functional', passed: true, locale });
    console.log('PASS sidebar functional ' + locale);
  } catch (error) {
    results.push({ name: 'functional', passed: false, error: error.stack, locale });
    await pair.new.screenshot({ path: path.join(out, 'functional-failure.png') });
    console.error('FAIL sidebar functional\n' + error.stack);
  } finally {
    await pair.close(); fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ results }, null, 2));
  }
  if (!results.every(row => row.passed)) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1 });
