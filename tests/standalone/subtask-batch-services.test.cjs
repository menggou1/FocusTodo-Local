const test=require('node:test'),assert=require('node:assert/strict');
const {createApplication,rows}=require('./core-helpers.cjs');
test('subtask creation and final removal commit the parent disclosure flag atomically',async t=>{
 const h=await createApplication();t.after(h.dispose);const business=h.app.business;
 await business.command({type:'addTask',values:{id:'parent',name:'Parent'}});
 await business.batch([{type:'addSubtask',values:{id:'child',name:'Child',taskId:'parent'}},{type:'updateTask',id:'parent',changes:{hasSubtask:true}}]);
 assert.equal((await rows(h.app.repository,'Task')).find(row=>row.id==='parent').hasSubtask,true);
 await assert.rejects(business.batch([{type:'addSubtask',values:{id:'rolled-back',name:'Draft',taskId:'parent'}},{type:'updateTask',id:'missing',changes:{hasSubtask:true}}]));
 assert.equal((await rows(h.app.repository,'Subtask')).some(row=>row.id==='rolled-back'),false);
 await business.batch([{type:'removeSubtask',id:'child'},{type:'updateTask',id:'parent',changes:{hasSubtask:false,isExpanded:false}}]);
 assert.equal((await rows(h.app.repository,'Task')).find(row=>row.id==='parent').hasSubtask,false);
});

