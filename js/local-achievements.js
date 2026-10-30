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
    const forests=new WeakMap();
    function mountForest(view){forests.set(view,{pending:new Map(),animations:new Set(),generation:0});refreshForest(view)}
    async function refreshForest(view){
        const state=forests.get(view);if(!state)return;
        const generation=++state.generation;
        view.setState(view.loadLocalForestState);
        try{
            const result=await view.generateSunItems();
            if(forests.get(view)!==state||generation!==state.generation)return;
            const old=view.props.sunItems||[];
            state.nextId=Math.max(state.nextId||0,...old.map(x=>x.id+1));
            const same=(a,b)=>a.data.itemType===b.data.itemType&&a.data.id===b.data.id&&a.data.date===b.data.date;
            const items=result[0].map(x=>{const match=old.find(y=>same(x,y));return Object.assign({},x,match?{id:match.id,left:match.left,top:match.top}:{id:state.nextId++})});
            for(const entry of old)if(state.pending.has(entry.id)&&!items.some(x=>same(x,entry)))items.push(entry);
            view.props.setSunItems(items);view.props.setActivityItems(result[1]);
        }catch(error){root.FocusLocal.notice(error.message)}
    }
    function animateForest(state,element,frames,options){
        if(!element||root.matchMedia('(prefers-reduced-motion: reduce)').matches||!element.animate)return null;
        const animation=element.animate(frames,options);state.animations.add(animation);
        return animation;
    }
    async function collectSun(view,id,item){
        const state=forests.get(view);if(!state||state.pending.has(id))return;
        const element=document.getElementById('sun-'+id),background=view.forestBgRef.current;
        if(!element||!background)return;
        state.pending.set(id,true);element.setAttribute('aria-busy','true');
        const flight=animateForest(state,element,[
            {left:element.style.left,top:element.style.top,opacity:1,transform:'scale(1)'},
            {left:(background.offsetWidth/2-24)+'px',top:(.84*background.offsetHeight-34)+'px',opacity:0,transform:'scale(0.2)'}
        ],{duration:1000,easing:'ease-in-out',fill:'forwards'});
        const finished=flight?flight.finished.catch(()=>{}):Promise.resolve();
        try{
            const result=await root.FocusLocalData.collectForest(item);
            if(forests.get(view)!==state)return;
            view.setState(view.loadLocalForestState);
            await finished;if(forests.get(view)!==state)return;
            state.pending.delete(id);
            await refreshForest(view);
            if(result.collected&&forests.get(view)===state){
                const pulse=animateForest(state,view.treeRef.current,[{transform:'translateX(-50%) scale(1)'},{transform:'translateX(-50%) scale(1.07)'},{transform:'translateX(-50%) scale(1)'}],{duration:800,easing:'ease-in-out'});
                if(pulse)pulse.finished.catch(()=>{}).finally(()=>state.animations.delete(pulse));
            }
        }catch(error){
            if(forests.get(view)===state){state.pending.delete(id);root.FocusLocal.notice(error.message)}
        }finally{
            if(flight){flight.cancel();state.animations.delete(flight)}
            element.removeAttribute('aria-busy');
        }
    }
    function unmountForest(view){const state=forests.get(view);forests.delete(view);if(state)for(const animation of state.animations)animation.cancel()}
    root.FocusForest={mount:mountForest,refresh:refreshForest,collect:collectSun,unmount:unmountForest};
    root.FocusAchievements={catalog,metrics,render,schedule};
    for(const name of ['focus-local-achievements-input','focus-local-calendar-changed','focus-local-timer-changed','focus-local-maintenance-end','focus'])root.addEventListener(name,schedule);
    root.FocusLocalReady.then(schedule).catch(()=>{});
})(window);
