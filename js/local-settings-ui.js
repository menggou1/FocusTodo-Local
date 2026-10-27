/* Explicit local settings: complete languages and opt-in desktop permission. */
(function(root) {
    'use strict';
    const I = root.FocusI18n, t = I.text;
    let refreshPermission=()=>{};
    function element(tag, text) { const el=document.createElement(tag); if(text!==undefined) el.textContent=text; return el; }
    function mount() {
        const general=document.querySelector('[class*="GeneralSettings-root"]');
        if(!general || general.querySelector('#focus-local-general')) return;
        const section=element('section');section.id='focus-local-general';section.className='focus-local-general';
        section.appendChild(element('h3',t('语言与通知')));
        const label=element('label',t('语言'));label.htmlFor='focus-language';
        const select=element('select');select.id='focus-language';select.setAttribute('aria-label',t('语言'));
        for(const [value,name] of [['auto',t('跟随系统')],['zh-CN','简体中文'],['en','English']]) {
            const option=element('option',name);option.value=value;select.appendChild(option);
        }
        select.value=['en','zh-CN'].includes(I.preference)?I.preference:'auto';
        select.onkeydown=event=>event.stopPropagation();select.onkeyup=event=>event.stopPropagation();
        select.onchange=()=>{try{I.setPreference(select.value);root.location.reload();}catch(error){root.FocusLocal.notice(t('无法保存语言设置：')+error.message);}};
        section.append(label,select,element('p',t('其他系统语言使用已有翻译，缺少内容时回退到英语。')));
        const heading=element('h4',t('桌面通知')),status=element('p'),button=element('button');
        status.setAttribute('role','status');button.type='button';button.className='focus-account-button';
        function refresh() {
            const api=root.Notification;
            if(typeof api!=='function'){status.textContent=t('当前浏览器不支持桌面通知。');button.disabled=true;}
            else {status.textContent=t(api.permission==='granted'?'通知已允许':api.permission==='denied'?'通知已被阻止，请在浏览器站点设置中修改。':'通知未授权');button.disabled=api.permission==='denied';}
            button.textContent=t(api&&api.permission==='granted'?'发送测试通知':'允许通知');
        }
        button.onclick=async event=>{
            event.stopPropagation();button.disabled=true;
            try {
                if(root.Notification.permission==='granted') root.FocusLocal.notifyCompletion(t('通知测试'),t('专注完成时将在此显示通知。'));
                else await root.Notification.requestPermission();
                refresh();
            } catch(error){refresh();status.textContent=t('通知设置失败：')+error.message;}
        };
        refreshPermission=()=>{if(section.isConnected) refresh();};
        refresh();section.append(heading,status,button);general.prepend(section);
    }
    let compatibilityInstalled = false;
    function installCompatibility(identity) {
        if (compatibilityInstalled) return;
        compatibilityInstalled = true;
        var _origSetItem = identity.set;
        (function() {
            var CSS_HIDE = [
                '.GeneralSettings-categoryTitle-2aRNH { display: none !important; }',
                '.GeneralSettings-separator-3dQ3a { display: none !important; }',
                // 备选：如果类名变化，也隐藏包含这些类名的元素
                '[class*="GeneralSettings-categoryTitle"] { display: none !important; }',
                '[class*="GeneralSettings-separator"] { display: none !important; }'
            ].join('\n');

            function injectStyle() {
                var style = document.createElement('style');
                style.id = 'lexible-hide-general';
                style.textContent = CSS_HIDE;
                document.head.appendChild(style);
            }

            function init() {
                injectStyle();
                // 额外用 JS 确保隐藏（应对动态渲染）
                var el = document.querySelector('.GeneralSettings-categoryTitle-2aRNH');
                if (el) el.style.display = 'none';
            }

            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', init);
            } else {
                init();
            }

            // MutationObserver 动态处理
            var observer = new MutationObserver(function() {
                var el = document.querySelector('.GeneralSettings-categoryTitle-2aRNH');
                if (el && el.style.display !== 'none') {
                    el.style.display = 'none';
                }
            });
            if (document.body) {
                observer.observe(document.body, { childList: true, subtree: true });
            } else {
                document.addEventListener('DOMContentLoaded', function() {
                    observer.observe(document.body, { childList: true, subtree: true });
                });
            }
        })();

        // Use the existing preference gate; no React-internal traversal or polling.
        _origSetItem('HasRated', 'true');
        _origSetItem('ShowRateDialog', 'false');
    }

    // Read and write the affected orders in one transaction, retaining every other field.
    function reorderProjects(db, snapshot, from, to) {
        return new Promise((resolve, reject) => {
            const ids=snapshot.map(item=>item.id), fromIndex=ids.indexOf(from), toIndex=ids.indexOf(to);
            if(fromIndex<0 || toIndex<0) return reject(new Error(t('清单已变化，请重试。')));
            const tx=db.transaction('Project','readwrite'), store=tx.objectStore('Project'), request=store.getAll();
            let changed, problem;
            request.onsuccess=()=>{
                const byId=new Map(request.result.map(item=>[item.id,item]));
                const current=ids.map(id=>byId.get(id));
                if(current.some((item,index)=>!item || item.order!==snapshot[index].order)) {
                    problem=new Error(t('清单已变化，请重试。')); tx.abort(); return;
                }
                const slots=current.map(item=>item.order).sort((a,b)=>a-b);
                if(slots.some((value,index)=>!Number.isFinite(value)||(index && value===slots[index-1]))) {
                    problem=new Error(t('清单顺序无效，请重试。')); tx.abort(); return;
                }
                const reordered=current.slice(), moved=reordered.splice(fromIndex,1)[0]; reordered.splice(toIndex,0,moved);
                changed=reordered.map((item,index)=>Object.assign({},item,{order:slots[index]}));
                changed.forEach(item=>store.put(item));
            };
            tx.oncomplete=()=>resolve(changed);
            tx.onabort=tx.onerror=()=>reject(problem || tx.error || new Error(t('保存失败')));
        });
    }
    root.FocusSettings = { installCompatibility, reorderProjects };
    new MutationObserver(mount).observe(document.body,{childList:true,subtree:true});
    root.addEventListener('focus',()=>refreshPermission());
    mount();
})(window);
