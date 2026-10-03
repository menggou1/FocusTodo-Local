/* Local application UI boundaries: updates, About and reset confirmation. */
(function (root) {
    'use strict';
    const release = root.FocusRelease;
    const READ_KEY = 'FocusTodo.releaseRead';
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
        const dialog = modal(update.title, 'focus-update-dialog');
        if (!dialog) return;
        dialog.body.appendChild(node('p', 'focus-app-meta', update.date + ' · ' + update.version + ' · ' + release.author));
        const list = node('ul'); update.items.forEach(item => list.appendChild(node('li', '', item))); dialog.body.appendChild(list);
        const close = node('button', '', '关闭'); close.type = 'button'; close.onclick = dialog.close; dialog.actions.appendChild(close); close.focus();
        if (update.version === release.version) {
            try { localStorage.setItem(READ_KEY, release.version); }
            catch (_) { root.FocusLocal.notice('更新详情已打开，已读状态未能保存。'); }
            root.dispatchEvent(new Event('focus-local-release-read'));
        }
    }

    function renderUpdates(React) {
        const h = React.createElement;
        return h('section', { className: 'focus-release-list', 'aria-label': '版本更新' },
            h('h3', null, '版本更新'),
            release.updates.map(update => h('button', { type: 'button', className: 'focus-release-entry', key: update.version, onClick: () => showUpdate(update) },
                h('strong', null, update.title),
                h('span', null, update.date + ' · ' + update.version),
                h('span', { className: 'focus-release-hint' }, '点击查看详情'))));
    }

    function attachHeader(header) {
        const refresh = () => header.setState({ localReleaseRead: !hasUnreadUpdates() });
        const storage = event => { if (event.key === READ_KEY || event.key === null) refresh(); };
        root.addEventListener('focus-local-release-read', refresh); root.addEventListener('storage', storage);
        return () => { root.removeEventListener('focus-local-release-read', refresh); root.removeEventListener('storage', storage); };
    }

    function renderAbout(React) {
        const h = React.createElement;
        return h('tr', { id: 'lexible-about-info-row' }, h('td', { className: 'focus-about-label' }, '本地版本'),
            h('td', { className: 'focus-about-value' }, h('div', null, '官方 ' + release.officialVersion + ' · 本地 ' + release.localVersion),
                h('div', null, release.author + ' · ' + release.date),
                h('a', { className: 'focus-repository-link', href: release.repository, title: release.repository, 'aria-label': 'GitHub 仓库：' + new URL(release.repository).pathname.slice(1), target: '_blank', rel: 'noopener noreferrer', onClick: event => event.stopPropagation() },
                    h('img', { src: 'img/github.svg', alt: 'GitHub', width: 24, height: 24 }))));
    }

    function confirmReset() {
        const dialog = modal('删除本地数据', 'focus-reset-dialog');
        if (!dialog) return;
        dialog.body.appendChild(node('p', '', '将删除所有任务、专注记录和设置，并重置为默认状态。'));
        dialog.body.appendChild(node('p', '', '删除前会生成完整备份，请检查浏览器下载文件。此操作无需密码。'));
        const error = node('p', 'focus-app-error'); error.setAttribute('role', 'alert'); dialog.body.appendChild(error);
        const cancel = node('button', '', '取消'), confirm = node('button', 'focus-app-danger');
        cancel.type = confirm.type = 'button'; dialog.actions.append(cancel, confirm);
        cancel.onclick = dialog.close;
        const unlockAt = performance.now() + 5000;
        function update() {
            const seconds = Math.max(0, Math.ceil((unlockAt - performance.now()) / 1000));
            confirm.disabled = dialog.busy || seconds > 0;
            confirm.textContent = dialog.busy ? '正在备份并删除…' : seconds ? '确认删除（' + seconds + ' 秒）' : '确认删除';
        }
        const interval = setInterval(update, 100); dialog.onClose = () => clearInterval(interval);
        confirm.onclick = async () => {
            if (dialog.busy || performance.now() < unlockAt) return;
            dialog.busy = true; cancel.disabled = true; error.textContent = ''; update();
            try {
                await root.FocusLocalReady;
                await root.FocusLocalData.reset();
            } catch (failure) {
                dialog.busy = false; cancel.disabled = false; error.textContent = '删除未完成，请重试：' + failure.message; update(); return;
            }
            clearInterval(interval); root.location.reload();
        };
        update(); cancel.focus();
    }

    root.FocusAppUI = { renderUpdates, renderAbout, showUpdate, hasUnreadUpdates, attachHeader, confirmReset };
})(window);
