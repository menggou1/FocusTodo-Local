import { invariant } from './errors.mjs';
import { achievementCatalog, achievementMetrics } from '../domain/achievements.mjs';
const key = 'FocusTodo.forestState', fields = ['Sunlight','LaunchReward','DailyTaskReward','PomodoroReward','TaskReward'];
export function createForestService({ data, storage, now }) {
    function read() {
        const raw = storage.getItem(key);
        if (raw) {
            const value = JSON.parse(raw);
            invariant(value?.version === 1 && value.fields && Number.isFinite(value.awarded) && value.awarded >= 0, 'Invalid forest state');
            if (!Number.isFinite(Number(value.fields.Sunlight))) value.fields.Sunlight = '0'; return value;
        }
        return { version: 1, fields: Object.fromEntries(fields.map(field=>[field,storage.getItem(field)||(field==='Sunlight'?'0':'[]')])), day:'',awarded:0 };
    }
    const save = value => { storage.setItem(key,JSON.stringify(value));data.changed('achievements'); };
    return Object.freeze({
        read,
        dailyLaunch: () => data.themeStorageOperation(()=>{ const state=read(), rows=JSON.parse(state.fields.LaunchReward||'[]'), date=now(), today=new Date(date).toDateString(), last=rows.at(-1); if(last && new Date(last.date).toDateString()===today)return; const yesterday=new Date(date); yesterday.setDate(yesterday.getDate()-1); rows.push({date,count:last&&new Date(last.date).toDateString()===yesterday.toDateString()?(Number(last.count)||0)+1:1,isGotDailyLoginReward:false,isGotContinueLoginReward:false}); state.fields.LaunchReward=JSON.stringify(rows);save(state); }),
        async rewards() { const state=read(), claimedP=new Set(JSON.parse(state.fields.PomodoroReward||'[]').map(row=>row.id)),claimedT=new Set(JSON.parse(state.fields.TaskReward||'[]').map(row=>row.id)); const value=await data.read(['Pomodoro','Task'],(tx,done)=>{const p=tx.objectStore('Pomodoro').getAll(),t=tx.objectStore('Task').getAll();t.onsuccess=()=>done({records:p.result,tasks:t.result})}); const items=[]; for(const row of value.records)if(row.state!==-1&&row.interval>0&&!claimedP.has(row.id))items.push({itemType:0,id:row.id,date:row.endDate,powerValue:Math.max(Math.floor(row.interval/60),1)}); for(const row of value.tasks)if(row.state!==-1&&row.isFinished&&!claimedT.has(row.id))items.push({itemType:1,id:row.id,date:row.finishedDate,powerValue:5}); for(const row of JSON.parse(state.fields.LaunchReward||'[]')){if(!row.isGotDailyLoginReward)items.push({itemType:2,id:'',date:row.date,powerValue:30});if(!row.isGotContinueLoginReward)items.push({itemType:3,id:'',date:row.date,powerValue:6*Math.min(row.count,80)})} return items.filter(item=>now()-item.date>=86400000&&now()-item.date<172800000); },
        get(field) { invariant(fields.includes(field),'Invalid forest field');const value=read().fields[field];return field==='Sunlight'?Number(value)||0:value||'[]'; },
        set: (field,value) => data.themeStorageOperation(()=>{invariant(fields.includes(field),'Invalid forest field');const state=read();state.fields[field]=String(value);save(state);}),
        collect: item => data.themeStorageOperation(()=>{
            const age=now()-Number(item.date),points=Number(item.powerValue);
            invariant([0,1,2,3].includes(item.itemType)&&Number.isFinite(age)&&age>=86400000&&age<172800000&&Number.isFinite(points)&&points>0,'Invalid forest reward');
            const state=read();
            if(item.itemType===0||item.itemType===1){
                invariant(typeof item.id==='string'&&item.id,'Invalid forest reward ID');const field=item.itemType===0?'PomodoroReward':'TaskReward',values=JSON.parse(state.fields[field]||'[]');
                if(values.some(row=>row.id===item.id))return{collected:false,reason:'duplicate'};values.push({id:item.id,completedDate:item.date});state.fields[field]=JSON.stringify(values);
            }else{
                const values=JSON.parse(state.fields.LaunchReward||'[]'),row=values.find(row=>row.date===item.date),field=item.itemType===2?'isGotDailyLoginReward':'isGotContinueLoginReward';
                if(!row||row[field])return{collected:false,reason:'duplicate'};row[field]=true;state.fields.LaunchReward=JSON.stringify(values);
            }
            state.fields.Sunlight=String((Number(state.fields.Sunlight)||0)+points);save(state);return{collected:true,totalPoints:Number(state.fields.Sunlight)};
        }),
        syncAchievements: () => data.themeStorageOperation(async()=>{
            const values=await data.read(['Pomodoro','Task'],(tx,done)=>{
                const records=tx.objectStore('Pomodoro').getAll(),tasks=tx.objectStore('Task').getAll();tasks.onsuccess=()=>done({Pomodoro:records.result,Task:tasks.result});
            });
            const metrics=achievementMetrics(values),state=read(),earned=state.achievements||{};let reward=0;const unlocked=[];
            invariant(earned&&typeof earned==='object'&&!Array.isArray(earned),'Invalid achievement state');
            for(const achievement of achievementCatalog)if(!Object.hasOwn(earned,achievement.id)&&metrics[achievement.metric]>=achievement.target){earned[achievement.id]=now();reward+=achievement.reward;unlocked.push(achievement.id)}
            if(unlocked.length){state.achievements=earned;state.fields.Sunlight=String((Number(state.fields.Sunlight)||0)+reward);save(state)}return{metrics,earned,reward,unlocked};
        }),
    });
}
