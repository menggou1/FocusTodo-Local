const test=require('node:test'),assert=require('node:assert/strict');
const {createApplication,rows}=require('./core-helpers.cjs');
test('D atomic batches roll back every changed row on stale expected values and preserve unknown fields',async t=>{
  const h=await createApplication();t.after(h.dispose);const {business}=h.app;
  const a=await business.command({type:'addTask',values:{name:'A',order:1,unknown:{keep:true}}}),b=await business.command({type:'addTask',values:{name:'B',order:1}});
  await assert.rejects(business.batch([{type:'updateTask',id:a.id,changes:{order:20000},expected:{order:1}},{type:'updateTask',id:b.id,changes:{order:10000},expected:{order:999}}]),/changed/);
  assert.equal((await rows(h.data,'Task')).find(row=>row.id===a.id).order,1);
  await business.batch([{type:'updateTask',id:a.id,changes:{order:20000},expected:a},{type:'updateTask',id:b.id,changes:{order:10000},expected:b}]);
  const actual=await rows(h.data,'Task');assert.equal(actual.find(row=>row.id===a.id).order,20000);assert.deepEqual(actual.find(row=>row.id===a.id).unknown,{keep:true});
});
test('daily goal changes retain legacy Goals records; launch and reward collection are idempotent',async t=>{
  const h=await createApplication();t.after(h.dispose);const {settings,forest,business}=h.app;
  assert.equal(settings.goals().at(-1).value,180);await settings.setGoal(240);await settings.setGoal(120);assert.equal(settings.goals().length,1);assert.equal(settings.goals()[0].value,120);
  await forest.dailyLaunch();await forest.dailyLaunch();assert.equal(JSON.parse(forest.get('LaunchReward')).length,1);
  const task=await business.command({type:'addTask',values:{name:'Reward task'}});await business.command({type:'completeTask',id:task.id});
  h.clock.value+=86400001;await forest.dailyLaunch();const rewards=await forest.rewards();assert.equal(rewards.reduce((n,r)=>n+r.powerValue,0),41);
  for(const item of rewards){await forest.collect(item);await forest.collect(item)}assert.equal(forest.get('Sunlight'),41);assert.equal((await forest.rewards()).length,0);
});
