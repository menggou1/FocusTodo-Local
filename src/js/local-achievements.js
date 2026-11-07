/* Offline achievements using committed records and the original ranking styles. */
(function(root){
    'use strict';
    const catalog=[
        {id:'focus-1',metric:'seconds',target:3600,reward:20,tier:'bronze',name:'初见专注',description:'累计专注 1 小时'},
        {id:'focus-10',metric:'seconds',target:36000,reward:100,tier:'silver',name:'渐入佳境',description:'累计专注 10 小时'},
        {id:'focus-100',metric:'seconds',target:360000,reward:500,tier:'gold',name:'百小时森林',description:'累计专注 100 小时'},
        {id:'task-1',metric:'tasks',target:1,reward:20,tier:'bronze',name:'第一步',description:'完成 1 个任务'},
        {id:'task-10',metric:'tasks',target:10,reward:100,tier:'silver',name:'行动派',description:'完成 10 个任务'},
        {id:'task-50',metric:'tasks',target:50,reward:500,tier:'gold',name:'清单征服者',description:'完成 50 个任务'},
        {id:'days-3',metric:'days',target:3,reward:20,tier:'bronze',name:'三日新芽',description:'在 3 个自然日留下专注记录'},
        {id:'days-7',metric:'days',target:7,reward:100,tier:'silver',name:'七日生长',description:'在 7 个自然日留下专注记录'},
        {id:'days-30',metric:'days',target:30,reward:500,tier:'gold',name:'三十日树荫',description:'在 30 个自然日留下专注记录'}
    ];
    function metrics(data){
        let seconds=0;const days=new Set();
        for(const row of data.Pomodoro){
            if((row.state!=null&&row.state!==0)||!Number.isFinite(row.interval)||row.interval<=0||!Number.isFinite(row.endDate)||row.endDate<=0)continue;
            const date=new Date(row.endDate);if(!Number.isFinite(date.getTime()))continue;
            seconds+=row.interval;days.add([date.getFullYear(),date.getMonth()+1,date.getDate()].join('-'));
        }
        return {seconds,tasks:data.Task.filter(row=>row.state!==-1&&row.isFinished===true).length,days:days.size};
    }
    let timer=null,componentClass;
    function schedule(){clearTimeout(timer);timer=setTimeout(async()=>{try{await root.FocusLocalReady;if(!root.FocusLocalData.maintenance)await root.FocusLocalData.syncAchievements()}catch(error){root.FocusLocalData.notify(root.FocusI18n.text('成就更新失败：')+error.message)}},100)}
    function render(React,styles){
        if(!componentClass)componentClass=class extends React.Component{
            constructor(props){super(props);this.state={data:null,error:''};this.live=false;this.refresh=this.refresh.bind(this)}
            componentDidMount(){this.live=true;root.addEventListener('focus-local-achievements-changed',this.refresh);this.refresh()}
            componentWillUnmount(){this.live=false;root.removeEventListener('focus-local-achievements-changed',this.refresh)}
            async refresh(){try{const data=await root.FocusLocalData.syncAchievements();if(this.live)this.setState({data,error:''})}catch(error){if(this.live)this.setState({error:root.FocusI18n.text('成就更新失败：')+error.message})}}
            render(){
                const h=React.createElement,t=root.FocusI18n.text, data=this.state.data, cs=this.props.styles;
                return h('div',{className:cs.container+' focus-achievements'},h('div',{className:cs.rankingBlock},
                    h('div',{className:cs.blockHeader},h('h2',null,t('成就'))),
                    this.state.error?h('p',{role:'alert'},this.state.error):null,
                    h('div',{className:cs.userList},data?catalog.map(a=>{
                        const done=Object.prototype.hasOwnProperty.call(data.earned,a.id),value=data.metrics[a.metric],amount=a.metric==='seconds'?Math.floor(value/3600):value,target=a.metric==='seconds'?a.target/3600:a.target;
                        return h('div',{className:cs.userRow+' focus-achievement-row',key:a.id,'data-achievement':a.id},
                            h('div',{className:cs.userInfo},h('img',{className:cs.rankIcon+' focus-achievement-trophy'+(done?'':' is-locked'),src:'img/rank-'+a.tier+'.png',alt:t(done?'已完成':'未完成')}),
                                h('div',{className:'focus-achievement-text'},h('span',{className:cs.name},t(a.name)),h('small',null,t(a.description),' · ',Math.min(amount,target),'/',target))),
                            h('span',{className:cs.pomodoroTime},'+',a.reward,'g'));
                    }):h('p',null,t('正在读取成就…')))));
            }
        };
        return React.createElement(componentClass,{styles});
    }
    // Keep the original one-second flight and tree pulse. Collection commits
    // independently; an animation never owns reward persistence or node IDs.
    const forests=new WeakMap(),headers=new WeakMap(),DAY=86400000;
    const rewardKey=item=>[item.itemType,item.id,item.date].join(':');
    const collectible=(item,now=Date.now())=>now-item.date>=DAY&&now-item.date<2*DAY;
    // Read the same unclaimed records as the original forest, independently of
    // its drawer and its 100 visible-item limit. Both the badge and bulk action
    // therefore retain the original per-item rounding and streak reward cap.
    async function rewards(manager){
        const [pomodoros,tasks]=await Promise.all([manager.getPomodoroSunItemData(),manager.getTaskSunItemData()]);
        const items=pomodoros.map(row=>({itemType:0,id:row.id,date:row.completedDate,powerValue:manager.POMODOROMULTIPERREWARD*Math.max(Math.floor(row.interval/60),1)}));
        for(const row of tasks)items.push({itemType:1,id:row.id,date:row.completedDate,powerValue:manager.TASKREWARD});
        for(const row of manager.getLaunchSunItemData()){
            if(!row.isGotDailyLoginReward)items.push({itemType:2,id:'',date:row.date,powerValue:manager.DAILYLAUNCHREWARD});
            if(!row.isGotContinueLoginReward)items.push({itemType:3,id:'',date:row.date,powerValue:manager.CONTINUELAUNCHMULTIPERREWARD*Math.min(row.count,80)});
        }
        return items;
    }
    function attachForestHeader(header,manager){
        let live=true,generation=0,timer=null,queued=null;
        const refresh=async()=>{
            clearTimeout(timer);clearTimeout(queued);const request=++generation;
            try{
                await root.FocusLocalReady;if(!live||root.FocusLocalData.maintenance)return;
                if(!header.state.forestEnabled){header.setState({forestSunlight:0});return}
                manager.setDailyLaunchReward();
                const items=await rewards(manager);if(!live||request!==generation)return;
                const now=Date.now(),total=items.filter(item=>collectible(item,now)).reduce((value,item)=>value+item.powerValue,0);
                header.setState({forestSunlight:total});
                // Wake exactly when a reward matures/expires, and periodically
                // recover from system-clock adjustments without opening the UI.
                const boundaries=items.flatMap(item=>[item.date+DAY,item.date+2*DAY]).filter(date=>date>now);
                const next=boundaries.reduce((next,date)=>Math.min(next,date),now+60000);
                timer=setTimeout(refresh,Math.max(1,next-Date.now()));
            }catch(error){if(live&&request===generation){root.FocusLocal.notice(error.message);timer=setTimeout(refresh,60000)}}
        };
        const schedule=()=>{clearTimeout(queued);queued=setTimeout(refresh,40)};
        const visibility=()=>{if(!document.hidden)schedule()};
        const storage=event=>{if(event.key==='FocusTodo.forestState'||event.key==='Forest'||event.key===null)schedule()};
        const events=['focus-local-achievements-input','focus-local-calendar-changed','focus-local-timer-changed','focus-local-tasks-changed','focus-local-forest-changed','focus-local-maintenance-end','focus'];
        events.forEach(name=>root.addEventListener(name,schedule));root.addEventListener('storage',storage);document.addEventListener('visibilitychange',visibility);
        headers.set(header,schedule);schedule();
        return()=>{live=false;generation++;clearTimeout(timer);clearTimeout(queued);headers.delete(header);events.forEach(name=>root.removeEventListener(name,schedule));root.removeEventListener('storage',storage);document.removeEventListener('visibilitychange',visibility)};
    }
    function mountForest(view,manager){
        const state={pending:new Map(),animations:new Set(),generation:0,manager,timer:null,queued:null};
        state.refresh=()=>{if(!state.pending.size&&!state.bulk)refreshForest(view)};
        state.schedule=()=>{clearTimeout(state.queued);state.queued=setTimeout(state.refresh,40)};
        state.storage=event=>{if(event.key==='FocusTodo.forestState'||event.key===null)state.schedule()};
        state.visibility=()=>{if(!document.hidden)state.schedule()};
        state.events=['focus-local-achievements-input','focus-local-achievements-changed','focus-local-calendar-changed','focus-local-timer-changed','focus-local-tasks-changed','focus-local-forest-changed','focus-local-maintenance-end','focus'];
        forests.set(view,state);state.events.forEach(name=>root.addEventListener(name,state.schedule));root.addEventListener('storage',state.storage);document.addEventListener('visibilitychange',state.visibility);refreshForest(view);
    }
    async function refreshForest(view){
        const state=forests.get(view);if(!state)return;
        const generation=++state.generation;clearTimeout(state.timer);clearTimeout(state.queued);
        view.setState(view.loadLocalForestState);
        try{
            const [result,allRewards]=await Promise.all([view.generateSunItems(),rewards(state.manager)]);
            if(forests.get(view)!==state||generation!==state.generation)return;
            const old=view.props.sunItems||[];
            state.nextId=old.reduce((next,item)=>Math.max(next,item.id+1),state.nextId||0);
            const same=(a,b)=>a.data.itemType===b.data.itemType&&a.data.id===b.data.id&&a.data.date===b.data.date;
            const items=result[0].map(x=>{const match=old.find(y=>same(x,y));return Object.assign({},x,match?{id:match.id,left:match.left,top:match.top}:{id:state.nextId++})});
            for(const entry of old)if(state.pending.has(entry.id)&&!items.some(x=>same(x,entry)))items.push(entry);
            view.props.setSunItems(items);view.props.setActivityItems(result[1]);
            const now=Date.now(),boundaries=allRewards.flatMap(item=>[item.date+DAY,item.date+2*DAY]).filter(date=>date>now);
            view.setState({localForestCollecting:state.bulk||state.pending.size>0,localForestCollectable:allRewards.some(item=>collectible(item,now))});
            state.timer=setTimeout(state.refresh,Math.max(1,boundaries.reduce((next,date)=>Math.min(next,date),now+60000)-Date.now()));
        }catch(error){if(forests.get(view)===state&&generation===state.generation){root.FocusLocal.notice(error.message);state.timer=setTimeout(state.refresh,60000)}}
    }
    function animateForest(state,element,frames,options){
        if(!element||root.matchMedia('(prefers-reduced-motion: reduce)').matches||!element.animate)return null;
        const animation=element.animate(frames,options);state.animations.add(animation);
        return animation;
    }
    async function collectItems(view,entries,state){
        const flights=[],committed=new Set(),background=view.forestBgRef.current;let collected=false;
        for(const entry of entries){
            const key=entry.id==null?rewardKey(entry.data):entry.id;state.pending.set(key,true);
            const element=entry.id==null?null:document.getElementById('sun-'+entry.id);if(!element)continue;
            element.setAttribute('aria-busy','true');
            const flight=background?animateForest(state,element,[
                {left:element.style.left,top:element.style.top,opacity:1,transform:'scale(1)'},
                {left:(background.offsetWidth/2-24)+'px',top:(.84*background.offsetHeight-34)+'px',opacity:0,transform:'scale(0.2)'}
            ],{duration:1000,easing:'ease-in-out',fill:'forwards'}):null;
            flights.push({element,flight,key:rewardKey(entry.data),finished:flight?flight.finished.catch(()=>{}):Promise.resolve()});
        }
        view.setState({localForestCollecting:true});
        try{
            for(const entry of entries){
                if(!collectible(entry.data))continue;
                const result=await root.FocusLocalData.collectForest(entry.data);collected=collected||result.collected;committed.add(rewardKey(entry.data));
                if(forests.get(view)===state)view.setState(view.loadLocalForestState);
            }
        }catch(error){if(forests.get(view)===state)root.FocusLocal.notice(error.message)}
        finally{
            // Hide committed nodes before cancelling the forwards-filled flight.
            // The asynchronous query and React removal can span multiple frames;
            // cancellation alone would reveal the original position in that gap.
            // Failed rewards stay visible and can be retried.
            await Promise.all(flights.map(entry=>entry.finished));
            for(const entry of entries)state.pending.delete(entry.id==null?rewardKey(entry.data):entry.id);
            for(const {element,flight,key} of flights){if(committed.has(key))element.style.visibility='hidden';if(flight){flight.cancel();state.animations.delete(flight)}element.removeAttribute('aria-busy')}
            state.bulk=false;
            if(forests.get(view)===state){
                await refreshForest(view);
                if(collected){const pulse=animateForest(state,view.treeRef.current,[{transform:'translateX(-50%) scale(1)'},{transform:'translateX(-50%) scale(1.07)'},{transform:'translateX(-50%) scale(1)'}],{duration:800,easing:'ease-in-out'});if(pulse)pulse.finished.catch(()=>{}).finally(()=>state.animations.delete(pulse))}
            }
        }
    }
    function collectSun(view,id,item){
        const state=forests.get(view);if(!state||state.bulk||state.pending.has(id))return;
        return collectItems(view,[{id,data:item}],state);
    }
    async function collectAll(view){
        const state=forests.get(view);if(!state||state.bulk||state.pending.size)return;
        state.bulk=true;view.setState({localForestCollecting:true});
        try{
            const items=(await rewards(state.manager)).filter(item=>collectible(item));
            if(forests.get(view)!==state)return;
            const visible=view.props.sunItems||[];
            await collectItems(view,items.map(data=>({id:visible.find(entry=>rewardKey(entry.data)===rewardKey(data))?.id,data})),state);
        }catch(error){if(forests.get(view)===state)root.FocusLocal.notice(error.message)}
        finally{state.bulk=false;if(forests.get(view)===state)view.setState({localForestCollecting:state.pending.size>0})}
    }
    function renderActions(React,view,styles){
        const h=React.createElement,t=root.FocusI18n.text,busy=!!view.state.localForestCollecting;
        const button=(label,action,icon,extra={})=>h('button',Object.assign({type:'button',className:'focus-ui-icon-button focus-ui-forest-action',title:t(label),'aria-label':t(label),onClick:action},extra),icon);
        const image=(src,extra='')=>h('img',{draggable:false,src,alt:'',className:'focus-ui-icon '+extra});
        return h('div',{className:styles.buttonGroup},
            button('成就',()=>view.props.openDrawer('ranking'),image('img/forest-badge.png','focus-achievement-button')),
            button('专注森林攻略',()=>view.props.openDrawer('guide'),h('svg',{className:'focus-ui-icon',viewBox:'0 0 24 24','aria-hidden':true,fill:'none',stroke:'currentColor',strokeWidth:1.8,strokeLinecap:'round',strokeLinejoin:'round'},h('path',{d:'M12 5v15M12 5C8 2 4 3 2 4v14c3-1 6-1 10 2 4-3 7-3 10-2V4c-2-1-6-2-10 1Z'}))),
            button(busy?'正在收取…':'一键收取',()=>collectAll(view),h('svg',{className:'focus-ui-icon',viewBox:'0 0 24 24','aria-hidden':true,fill:'none',stroke:'currentColor',strokeWidth:1.6,strokeLinecap:'round',strokeLinejoin:'round'},h('path',{d:'M8 13V6a1.5 1.5 0 0 1 3 0v5-7a1.5 1.5 0 0 1 3 0v7-5a1.5 1.5 0 0 1 3 0v6-3a1.5 1.5 0 0 1 3 0v6c0 4-2.5 7-6 7h-1c-2 0-3.3-.9-4.5-2.5L4 14a1.6 1.6 0 0 1 2.4-2.1L8 13Z'})),{'data-forest-collect-all':true,disabled:busy||!view.state.localForestCollectable,'aria-busy':busy}));
    }
    function unmountForest(view){const state=forests.get(view);forests.delete(view);if(state){clearTimeout(state.timer);clearTimeout(state.queued);state.events.forEach(name=>root.removeEventListener(name,state.schedule));root.removeEventListener('storage',state.storage);document.removeEventListener('visibilitychange',state.visibility);for(const animation of state.animations)animation.cancel()}}
    root.FocusForest={mount:mountForest,refresh:refreshForest,collect:collectSun,collectAll,renderActions,attachHeader:attachForestHeader,refreshHeader:header=>headers.get(header)?.(),unmount:unmountForest};
    root.FocusAchievements={catalog,metrics,render,schedule};
    for(const name of ['focus-local-achievements-input','focus-local-calendar-changed','focus-local-timer-changed','focus-local-maintenance-end','focus'])root.addEventListener(name,schedule);
    root.FocusLocalReady.then(schedule).catch(()=>{});
})(window);
