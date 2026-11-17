/* Pure achievement definitions and metrics migrated from local-achievements.js. */
export const achievementCatalog=[
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
export function achievementMetrics(data){
        let seconds=0;const days=new Set();
        for(const row of data.Pomodoro){
            if((row.state!=null&&row.state!==0)||!Number.isFinite(row.interval)||row.interval<=0||!Number.isFinite(row.endDate)||row.endDate<=0)continue;
            const date=new Date(row.endDate);if(!Number.isFinite(date.getTime()))continue;
            seconds+=row.interval;days.add([date.getFullYear(),date.getMonth()+1,date.getDate()].join('-'));
        }
        return {seconds,tasks:data.Task.filter(row=>row.state!==-1&&row.isFinished===true).length,days:days.size};
    }
