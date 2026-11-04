/* Explicit local settings: complete languages and opt-in desktop permission. */
(function(root) {
    'use strict';
    const I = root.FocusI18n, t = I.text;
    let refreshPermission=()=>{};
    let controls, languageHost;
    // The original settings selects now share this factory, including language.
    // Read current theme colors in every callback, as the legacy controls did.
    function selectStyles(selectedMark=false) {
        return {
            container:base=>Object.assign({},base,{width:'200px',height:'30px',backgroundColor:root.FTColor.bgMain}),
            control:base=>Object.assign({},base,{minHeight:'30px',height:'30px',borderColor:root.FTColor.border,boxShadow:'none','&:hover':{borderColor:root.FTColor.border},borderRadius:'6px',backgroundColor:root.FTColor.bgMain}),
            valueContainer:base=>Object.assign({},base,{padding:'0 8px 0 8px',height:'30px'}),
            input:base=>Object.assign({},base,{margin:'0',height:'20px',minHeight:'20px',padding:'0'}),
            option:(base,state)=>Object.assign({},base,{color:root.FTColor.textTitle,backgroundColor:root.FTColor.bgMain,'&:hover':{backgroundColor:root.FTColor.bgHover}},selectedMark?{backgroundImage:state.isSelected?'url(img/new-task-project-selected.png)':'',backgroundRepeat:'no-repeat',backgroundSize:'24px 24px',backgroundPosition:'right'}:{}),
            dropdownIndicator:base=>Object.assign({},base,{padding:'4px 8px'}),
            indicatorSeparator:base=>Object.assign({},base,{backgroundColor:root.FTColor.bgMain}),
            singleValue:base=>Object.assign({},base,{color:root.FTColor.textTitle}),
            menu:base=>Object.assign({},base,{backgroundColor:root.FTColor.bgMain})
        };
    }
    function switchProps() {
        return {checkedIcon:false,uncheckedIcon:false,height:18,width:36,handleDiameter:14,
            onColor:root.FTColor.themeRed,offColor:root.FTColor.bgSwitcherOff,activeBoxShadow:'0 0 0 0 #000'};
    }
    function installControls(React,ReactDOM,Select,components) {
        if(!controls) controls={React,ReactDOM,Select,components};
    }
    function dropdownIndicator(props) {
        const {React,components}=controls;
        return React.createElement(components.DropdownIndicator,props,
            React.createElement('img',{draggable:false,src:'img/dropdown-indicator.png',className:'focus-ui-select-arrow',alt:''}));
    }
    function element(tag, text) { const el=document.createElement(tag); if(text!==undefined) el.textContent=text; return el; }
    function mount() {
        if(languageHost&&!languageHost.isConnected) {
            controls.ReactDOM.unmountComponentAtNode(languageHost);languageHost=null;
        }
        const general=document.querySelector('[class*="GeneralSettings-root"]');
        if(!controls || !general || general.querySelector('#focus-local-general')) return;
        const section=element('section');section.id='focus-local-general';section.className='focus-local-general';
        section.appendChild(element('h3',t('语言与通知')));
        const row=element('div');row.className='focus-ui-setting-row';
        const label=element('label',t('语言'));label.htmlFor='focus-language-control';
        const options=[['auto',t('跟随系统')],['zh-CN','简体中文'],['en','English']].map(([value,label])=>({value,label}));
        const preference=['en','zh-CN'].includes(I.preference)?I.preference:'auto';
        const host=element('div');host.id='focus-language';host.className='focus-ui-setting-select';
        row.append(label,host);section.append(row,element('p',t('其他系统语言使用已有翻译，缺少内容时回退到英语。')));
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
        refresh();section.append(heading,status,button);general.prepend(section);languageHost=host;
        controls.ReactDOM.render(controls.React.createElement(controls.Select,{
            inputId:'focus-language-control',className:'focus-ui-select',classNamePrefix:'focus-ui-select',
            'aria-label':t('语言'),options,value:options.find(option=>option.value===preference),
            styles:selectStyles(true),components:{DropdownIndicator:dropdownIndicator},isSearchable:false,
            onKeyDown:event=>event.stopPropagation(),
            onChange:option=>{try{I.setPreference(option.value);root.location.reload();}catch(error){root.FocusLocal.notice(t('无法保存语言设置：')+error.message);}}
        }),host);
    }
    let compatibilityInstalled = false;
    function installCompatibility(identity) {
        if (compatibilityInstalled) return;
        compatibilityInstalled = true;
        var _origSetItem = identity.set;
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
    function restoreSystemProjectOrder(db) {
        return new Promise((resolve, reject) => {
            const defaults = new Map(root.FocusLocalData.defaultProjects().map(item => [item.id, item]));
            const tx = db.transaction('Project', 'readwrite'), store = tx.objectStore('Project'), request = store.getAll();
            let changed = [];
            request.onsuccess = () => {
                for (const item of request.result) {
                    const original = defaults.get(item.id);
                    if (!original || item.type !== original.type) continue;
                    const restored = Object.assign({}, item, { order: original.order });
                    store.put(restored); changed.push(restored);
                }
            };
            tx.oncomplete = () => resolve(changed);
            tx.onabort = tx.onerror = () => reject(tx.error || new Error(t('保存失败')));
        });
    }
    root.FocusSettings = { installCompatibility, reorderProjects, restoreSystemProjectOrder, installControls, selectStyles, switchProps };
    new MutationObserver(mount).observe(document.body,{childList:true,subtree:true});
    root.addEventListener('focus',()=>refreshPermission());
    mount();
})(window);
