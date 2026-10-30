/* Local application UI boundaries: updates, About and reset confirmation. */
(function (root) {
    'use strict';
    const release = root.FocusRelease;
    const READ_KEY = 'FocusTodo.releaseRead';
    const REMINDER_READ_KEY = 'FocusTodo.taskRemindersRead';
    const headers = new WeakMap();
    let persistenceRequested=false;
    let activeDialog = null;

    function node(tag, className, text) {
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (text !== undefined) element.textContent = text;
        return element;
    }

    function modal(title, id) {
        if (activeDialog) { activeDialog.card.focus(); return null; }
        const opener = document.activeElement;
        const backdrop = node('div', 'focus-app-backdrop'); backdrop.id = id;
        const card = node('section', 'focus-app-dialog'); card.tabIndex = -1;
        card.setAttribute('role', 'dialog'); card.setAttribute('aria-modal', 'true');
        const heading = node('h2', '', title); heading.id = id + '-title';
        card.setAttribute('aria-labelledby', heading.id); card.appendChild(heading);
        const body = node('div', 'focus-app-dialog-body'), actions = node('div', 'focus-app-actions');
        card.append(body, actions); backdrop.appendChild(card); document.body.appendChild(backdrop);
        const dialog = { card, body, actions, busy: false, onClose: null, close };
        function close() {
            if (dialog.busy) return;
            document.removeEventListener('keydown', keydown, true);
            backdrop.remove(); activeDialog = null;
            if (dialog.onClose) dialog.onClose();
            if (opener && opener.isConnected) opener.focus();
        }
        function keydown(event) {
            if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); close(); return; }
            if (!card.contains(event.target)) { event.preventDefault(); event.stopImmediatePropagation(); card.focus(); return; }
            // Keep legacy application shortcuts away from the standalone dialog.
            event.stopPropagation();
            if (event.key !== 'Tab') return;
            const nodes = [...card.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled)')];
            if (!nodes.length) { event.preventDefault(); card.focus(); return; }
            if (event.shiftKey && (document.activeElement === nodes[0] || document.activeElement === card)) { event.preventDefault(); nodes[nodes.length - 1].focus(); }
            else if (!event.shiftKey && document.activeElement === nodes[nodes.length - 1]) { event.preventDefault(); nodes[0].focus(); }
        }
        document.addEventListener('keydown', keydown, true);
        activeDialog = dialog; card.focus(); return dialog;
    }

    function hasUnreadUpdates() {
        try { return localStorage.getItem(READ_KEY) !== release.version; }
        catch (_) { return true; }
    }

    function showUpdate(update) {
        update = root.FocusI18n.update(update);
        const dialog = modal(update.title, 'focus-update-dialog');
        if (!dialog) return;
        dialog.body.appendChild(node('p', 'focus-app-meta', update.date + ' · ' + update.version + ' · ' + release.author));
        const list = node('ul'); update.items.forEach(item => list.appendChild(node('li', '', item))); dialog.body.appendChild(list);
        const close = node('button', '', (typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('关闭'):'关闭')); close.type = 'button'; close.onclick = dialog.close; dialog.actions.appendChild(close); close.focus();
        if (update.version === release.version) {
            try { localStorage.setItem(READ_KEY, release.version); }
            catch (_) { root.FocusLocal.notice((typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('更新详情已打开，已读状态未能保存。'):'更新详情已打开，已读状态未能保存。')); }
            root.dispatchEvent(new Event('focus-local-release-read'));
        }
    }

    function renderUpdates(React) {
        const h = React.createElement;
        return h('section', { className: 'focus-release-list', 'aria-label': (typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('版本更新'):'版本更新') },
            h('h3', null, (typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('版本更新'):'版本更新')),
            release.updates.map(original => { const update = root.FocusI18n.update(original); return h('button', { type: 'button', className: 'focus-release-entry', key: update.version, onClick: () => showUpdate(original) },
                h('strong', null, update.title),
                h('span', null, update.date + ' · ' + update.version),
                h('span', { className: 'focus-release-hint' }, (typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('点击查看详情'):'点击查看详情'))); }));
    }

    function attachHeader(header,onNotify) {
        let live=true,generation=0,timer=null;
        const announced=new Set(),key=row=>JSON.stringify([row.id,row.reminderDate]);
        const read=()=>{try{const value=JSON.parse(localStorage.getItem(REMINDER_READ_KEY)||'[]');return new Set(Array.isArray(value)?value:[])}catch(_){return new Set()}};
        const refresh=async(open=false,notify=false)=>{
            const request=++generation;clearTimeout(timer);
            try{
                await root.FocusLocalReady;if(!live||root.FocusLocalData.maintenance)return;
                const db=await root.FocusLocalData.open();
                const rows=await root.FocusLocalData.transaction(db,['Task'],'readonly',(tx,done)=>{
                    const query=tx.objectStore('Task').index('reminderDate').getAll(IDBKeyRange.lowerBound(1));query.onsuccess=()=>done(query.result);
                });
                if(!live||request!==generation)return;
                const now=Date.now(),active=rows.filter(row=>row.state===0&&!row.isFinished&&Number.isFinite(row.reminderDate));
                const due=active.filter(row=>row.reminderDate<=now).sort((a,b)=>b.reminderDate-a.reminderDate),seen=read();
                const fresh=due.filter(row=>!seen.has(key(row))&&!announced.has(key(row)));
                if(open||header.state.notification.show){
                    due.forEach(row=>seen.add(key(row)));
                    try{localStorage.setItem(REMINDER_READ_KEY,JSON.stringify([...seen]))}catch(error){root.FocusLocal.notice(root.FocusI18n.text('提醒已读状态保存失败：')+error.message)}
                }
                const saved=read();
                header.setState({localReleaseRead:!hasUnreadUpdates(),notification:{show:open||header.state.notification.show,highlight:due.some(row=>!saved.has(key(row))),items:due}});
                due.forEach(row=>announced.add(key(row)));
                const next=Math.min(...active.filter(row=>row.reminderDate>now).map(row=>row.reminderDate));
                if(Number.isFinite(next))timer=setTimeout(()=>refresh(false,true),Math.min(Math.max(1,next-Date.now()),86400000));
                if(notify&&fresh.length&&!open&&!header.state.notification.show){
                    const title=root.FocusI18n.text('任务到时提醒'),message=fresh.map(row=>row.name).join('、');
                    root.FocusLocal.notice(title+'：'+message);
                    if(onNotify)onNotify();
                    root.FocusLocal.notifyCompletion(title,message);
                }
            }catch(error){if(live)root.FocusLocal.notice(root.FocusI18n.text('提醒读取失败：')+error.message)}
        };
        const update=()=>refresh(false,true),releaseRead=()=>header.setState({localReleaseRead:!hasUnreadUpdates()});
        const storage=event=>{if(event.key===READ_KEY||event.key===REMINDER_READ_KEY||event.key===null)refresh()};
        const events=['focus-local-tasks-changed','focus-local-calendar-changed','focus-local-maintenance-end','focus'];
        events.forEach(name=>root.addEventListener(name,update));
        root.addEventListener('focus-local-release-read',releaseRead);root.addEventListener('storage',storage);
        headers.set(header,refresh);refresh(false,true);
        return ()=>{live=false;generation++;clearTimeout(timer);headers.delete(header);events.forEach(name=>root.removeEventListener(name,update));root.removeEventListener('focus-local-release-read',releaseRead);root.removeEventListener('storage',storage)};
    }

    function refreshReminders(header,open=false,notify=false){const refresh=headers.get(header);if(refresh)return refresh(open,notify)}
    function renderReminderSummary(React,items){return items.length?React.createElement('h3',{className:'focus-reminder-summary'},root.FocusI18n.text('任务到时提醒'),' · ',items.length):null}
    function requestStoragePersistence(){
        if(persistenceRequested)return;persistenceRequested=true;
        // This permission is optional. A delayed or failed browser response must
        // never hold the database migration and application mount behind it.
        Promise.resolve().then(async()=>{
            const storage=root.navigator.storage;
            if(storage&&storage.persisted&&storage.persist&&!await storage.persisted())await storage.persist();
        }).catch(()=>{});
    }

    function renderAbout(React) {
        const h = React.createElement;
        return h('tr', { id: 'lexible-about-info-row' }, h('td', { className: 'focus-about-label' }, (typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('本地版本'):'本地版本')),
            h('td', { className: 'focus-about-value' }, h('div', null, (typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('官方 '):'官方 ') + release.officialVersion + (typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text(' · 本地 '):' · 本地 ') + release.localVersion),
                h('div', null, release.author + ' · ' + release.date),
                h('a', { className: 'focus-repository-link', href: release.repository, title: release.repository, 'aria-label': (typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('GitHub 仓库：'):'GitHub 仓库：') + new URL(release.repository).pathname.slice(1), target: '_blank', rel: 'noopener noreferrer', onClick: event => event.stopPropagation() },
                    h('img', { src: 'img/github.svg', alt: 'GitHub', width: 24, height: 24 }))));
    }

    function confirmReset() {
        const dialog = modal((typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('删除本地数据'):'删除本地数据'), 'focus-reset-dialog');
        if (!dialog) return;
        dialog.body.appendChild(node('p', '', (typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('将删除所有任务、专注记录和设置，并重置为默认状态。'):'将删除所有任务、专注记录和设置，并重置为默认状态。')));
        dialog.body.appendChild(node('p', '', (typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('删除前会生成完整备份，请检查浏览器下载文件。此操作无需密码。'):'删除前会生成完整备份，请检查浏览器下载文件。此操作无需密码。')));
        const error = node('p', 'focus-app-error'); error.setAttribute('role', 'alert'); dialog.body.appendChild(error);
        const cancel = node('button', '', (typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('取消'):'取消')), confirm = node('button', 'focus-app-danger');
        cancel.type = confirm.type = 'button'; dialog.actions.append(cancel, confirm);
        cancel.onclick = dialog.close;
        const unlockAt = performance.now() + 5000;
        function update() {
            const seconds = Math.max(0, Math.ceil((unlockAt - performance.now()) / 1000));
            confirm.disabled = dialog.busy || seconds > 0;
            confirm.textContent = dialog.busy ? (typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('正在备份并删除…'):'正在备份并删除…') : seconds ? (typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('确认删除（'):'确认删除（') + seconds + (typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text(' 秒）'):' 秒）') : (typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('确认删除'):'确认删除');
        }
        const interval = setInterval(update, 100); dialog.onClose = () => clearInterval(interval);
        confirm.onclick = async () => {
            if (dialog.busy || performance.now() < unlockAt) return;
            dialog.busy = true; cancel.disabled = true; error.textContent = ''; update();
            try {
                await root.FocusLocalReady;
                await root.FocusLocalData.reset();
            } catch (failure) {
                dialog.busy = false; cancel.disabled = false; error.textContent = (typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('删除未完成，请重试：'):'删除未完成，请重试：') + failure.message; update(); return;
            }
            clearInterval(interval); root.location.reload();
        };
        update(); cancel.focus();
    }

    root.FocusAppUI = { renderUpdates, renderAbout, showUpdate, hasUnreadUpdates, attachHeader, refreshReminders, renderReminderSummary, requestStoragePersistence, confirmReset };
})(window);
