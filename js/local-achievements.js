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
    root.FocusAchievements={catalog,metrics,render,schedule};
    for(const name of ['focus-local-achievements-input','focus-local-calendar-changed','focus-local-timer-changed','focus-local-maintenance-end','focus'])root.addEventListener(name,schedule);
    root.FocusLocalReady.then(schedule).catch(()=>{});
})(window);