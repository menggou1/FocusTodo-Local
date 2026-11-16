const {copyFixture}=require('./ui-restore-helpers.cjs');
async function seed(pair){
 await pair.old.evaluate(async()=>{
  const d=FocusLocalData,s=await d.snapshot(),base=s.indexedDB.Project.find(row=>row.type===7005),db=await d.open(),day=new Date();day.setHours(0,0,0,0);
  localStorage.setItem('Goals',JSON.stringify([{time:+new Date(2026,9,1),type:'TIME',value:180}]));
  await d.transaction(db,['Project','Task','Pomodoro'],'readwrite',tx=>{
   for(const row of [
    {id:'z-blue',name:'Blue list',type:1000,parentId:'folder',order:-90000,color:'4670F6'},
    {id:'folder',name:'Reports folder',type:2000,parentId:'',order:0,color:'F4658C'},
    {id:'a-red',name:'Red list',type:1000,parentId:'',order:10000,color:'EC6B66'},
    {id:'c-green',name:'Green list',type:1000,parentId:'',order:20000,color:'A0CE62'},
    {id:'tag',name:'Reports tag',type:3000,parentId:'',order:30000,color:'C540B5'},
   ])tx.objectStore('Project').put({...base,...row,state:0,expanded:true});
   for(let i=0;i<5;i++){
    const task={id:'reports-task-'+i,objType:'TASK',creationDate:+day+i,state:0,name:'Reports task '+i,order:i*10000,projectId:['z-blue','a-red','c-green','id-task-tasks','z-blue'][i],deadline:0,isFinished:i<4,finishedDate:i<4?+day+(9+i)*3600000:0,pomodoroInterval:1500,actualPomoNum:1,estimatePomoNum:2,priority:i%4,tags:'tag',remark:'',rCycle:0,rId:'',reminderDate:0};
    tx.objectStore('Task').put(task);
    tx.objectStore('Pomodoro').put({id:'reports-record-'+i,objType:'POMODORO',creationDate:+day,state:0,taskId:task.id,subtaskId:'',endDate:+day+(8+i)*3600000,interval:[3620,1500,90,30,25][i],pomodoroInterval:1500,isManual:true,sync:0});
   }
  });
 });
 await pair.old.reload();await pair.old.waitForFunction(()=>window.FocusLocalReady&&!document.documentElement.classList.contains('focus-starting'));
 await copyFixture(pair);
}

module.exports={seed};
