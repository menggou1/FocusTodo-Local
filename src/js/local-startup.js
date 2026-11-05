/* Inlined by build:release so the first screen needs no network request. */
(function (root) {
    'use strict';
    const screen = document.getElementById('focus-startup');
    const app = document.getElementById('root');
    const status = document.getElementById('focus-startup-status');
    const hint = document.getElementById('focus-startup-hint');
    const progress = document.getElementById('focus-startup-progress');
    const count = document.getElementById('focus-startup-count');
    const retry = document.getElementById('focus-startup-retry');
    const completed = new Set();
    let preference = 'auto', dark = null;
    try {
        preference = localStorage.getItem('FocusTodo.language') || 'auto';
        dark = localStorage.getItem('DarkMode');
    } catch (_) { /* The status screen also works when storage is unavailable. */ }
    const chinese = preference === 'zh-CN' || (preference !== 'en' && /^zh\b/i.test(navigator.language));
    const text = chinese ? {
        title: '专注清单', loading: '正在准备你的专注空间', opening: '正在打开你的清单',
        hint: '已准备好的界面会先显示，图片和字体会继续加载。',
        slow: '加载比平时久一些。你可以继续等待，或检查网络后重试。',
        failed: '暂时无法打开专注清单', failureHint: '请检查网络后重试；已保存的数据不会被清除。',
        retry: '重新加载', progress: '启动进度', steps: '个启动步骤已就绪'
    } : {
        title: 'FocusTodo', loading: 'Preparing your focus space', opening: 'Opening your lists',
        hint: 'Your workspace appears first. Images and fonts can finish loading afterward.',
        slow: 'This is taking a little longer. You can keep waiting, or check your connection and retry.',
        failed: 'Unable to open FocusTodo', failureHint: 'Check your connection and retry. Your saved data will stay in place.',
        retry: 'Reload', progress: 'Startup progress', steps: 'startup steps ready'
    };
    document.getElementById('focus-startup-title').textContent = text.title;
    document.documentElement.classList.toggle('focus-startup-dark', dark === 'true' || (dark === null && root.matchMedia('(prefers-color-scheme: dark)').matches));
    screen.lang = chinese ? 'zh-CN' : 'en';
    document.documentElement.lang = screen.lang;
    status.textContent = text.loading;
    hint.textContent = text.hint;
    retry.textContent = text.retry;
    progress.setAttribute('aria-label', text.progress);
    const total = Number(progress.max);
    let failed = false, finished = false, mainLoaded = false;
    const observer = new MutationObserver(maybeFinish);
    observer.observe(app, { childList: true });
    const slowTimer = root.setTimeout(() => {
        if (finished || failed) return;
        hint.textContent = text.slow;
        retry.hidden = false;
    }, 15000);
    retry.onclick = () => root.location.reload();
    function update() {
        progress.value = completed.size;
        count.textContent = completed.size + ' / ' + total;
        progress.setAttribute('aria-valuetext', completed.size + ' / ' + total + ' ' + text.steps);
    }
    function fail() {
        if (finished || failed) return;
        failed = true;
        root.clearTimeout(slowTimer);
        status.textContent = text.failed;
        hint.textContent = text.failureHint;
        retry.hidden = false;
        screen.dataset.state = 'error';
    }
    function maybeFinish() {
        // The real application controls its own data recovery before mounting.
        // Never uncover an unstyled app or wait for optional images/web fonts.
        if (finished || failed || !mainLoaded || !app.firstElementChild) return;
        const styles = Array.from(document.querySelectorAll('link[data-focus-asset]'));
        if (!styles.every(link => completed.has(link))) return;
        completed.add(app);
        update();
        finished = true;
        observer.disconnect();
        root.clearTimeout(slowTimer);
        document.documentElement.classList.remove('focus-starting', 'focus-startup-dark');
        app.removeAttribute('aria-busy');
        screen.remove();
        root.dispatchEvent(new Event('focus-startup-ready'));
    }
    root.FocusStartup = {
        loaded(element) {
            if (finished || failed) return;
            completed.add(element);
            if (element.dataset.focusAsset === 'app') {
                mainLoaded = true;
                status.textContent = text.opening;
                if (root.FocusLocalReady) root.FocusLocalReady.catch(fail);
            }
            update();
            maybeFinish();
        },
        failed: fail
    };
    // Capture resource failures and initialization exceptions before the legacy
    // handlers are installed; a failed load must retain a usable retry action.
    root.addEventListener('error', event => {
        if (event.error || event.target?.hasAttribute?.('data-focus-asset')) fail();
    }, true);
    root.addEventListener('unhandledrejection', fail);
    update();
})(window);
