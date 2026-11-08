/* Public, generated demonstration data only. No files from a user profile are read. */
const fs=require('node:fs'),path=require('node:path');
const {createApplication}=require('../standalone/core-helpers.cjs');
(async()=>{
 const h=await createApplication();h.clock.value=Date.now();
 try{const {business,settings,forest,backup}=h.app;
  await settings.set('language','zh-CN');await settings.saveProfile('name','审查示例用户');await settings.setGoal(180);
  await business.command({type:'addProject',values:{id:'demo-folder',name:'演示 · 工作',type:2000,order:10000}});
  await business.command({type:'addProject',values:{id:'demo-work',name:'演示 · 项目清单',parentId:'demo-folder',color:'4670F6',order:20000}});
  await business.command({type:'addProject',values:{id:'demo-personal',name:'演示 · 个人清单',color:'24B78B',order:30000}});
  await business.command({type:'addProject',values:{id:'demo-tag',name:'演示 · 重要',type:3000,color:'E65350',order:40000}});
  const today=new Date(h.clock.value);today.setHours(0,0,0,0);
  for(let index=0;index<8;index++){
   const deadline=new Date(today);deadline.setDate(deadline.getDate()+(index<4?0:index-4));deadline.setHours(23,59,59,999);
   await business.command({type:'addTask',values:{id:'demo-task-'+index,name:'演示任务 '+(index+1)+(index===0?'：检查子任务、备注和计时':'') ,projectId:index%2?'demo-work':'demo-personal',deadline:+deadline,priority:index%4,estimatePomoNum:index%3+1,remark:'此任务完全由脚本生成，仅供 D-R 人工核查。',tags:index<3?'demo-tag':'',order:index*10000,isExpanded:index===0,isFinished:index===7,finishedDate:index===7?h.clock.value-86400000:0}});
  }
  for(let i=0;i<3;i++)await business.command({type:'addSubtask',values:{id:'demo-subtask-'+i,name:'演示子任务 '+(i+1),taskId:'demo-task-0',order:i*10000,isFinished:i===2,finishedDate:i===2?h.clock.value-86400000:0}});
  for(let day=0;day<14;day++)for(let n=0;n<2;n++){
   const end=new Date(today);end.setDate(end.getDate()-day);end.setHours(day===0?1+n:9+n,30,0,0);
   await business.command({type:'addRecord',values:{id:'demo-focus-'+day+'-'+n,taskId:'demo-task-'+(day%7),subtaskId:day%7===0?'demo-subtask-0':'',interval:1500,pomodoroInterval:1500,endDate:+end}});
  }
  for(let i=0;i<3;i++){const end=new Date(today);end.setHours(9+i,25,0,0);await business.command({type:'addSchedule',values:{id:'demo-plan-'+i,taskId:'demo-task-'+i,interval:1500,endDate:+end}})}
  await forest.dailyLaunch();await forest.syncAchievements();const result=await backup.export({format:'json'});
  const target=path.resolve(__dirname,'../../docs/acceptance/2.0.0-dr/demo.json');fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,result.bytes);console.log('Generated review demo: '+target);
 }finally{h.dispose()}
})().catch(error=>{console.error(error);process.exitCode=1});
