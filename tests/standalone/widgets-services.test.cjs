const test=require('node:test'),assert=require('node:assert/strict');
const {createApplication}=require('./core-helpers.cjs');

test('timer widgets preserve default, empty, reordered and collapsed legacy logical keys across backup restore',async t=>{
 const h=await createApplication();t.after(h.dispose);
 assert.deepEqual(h.app.settings.getSnapshot().widgetOrder,[0,1,2]);assert.deepEqual(h.app.settings.getSnapshot().visibleWidgets,[0,1,2]);assert.equal(h.app.settings.getSnapshot().widgetExpanded,true);
 await h.app.settings.setWidgetLayout([2,0,1],[2,0]);await h.app.settings.set('widgetExpanded',false);
 assert.equal(h.storage.getItem('AllWidgets'),'2,0,1');assert.equal(h.storage.getItem('Widgets'),'2,0');assert.equal(h.storage.getItem('WidgetExpanded'),'false');
 const exported=(await h.app.backup.export({format:'json'})).data;const next=await createApplication();t.after(next.dispose);
 await next.app.backup.restore(JSON.stringify(exported));assert.deepEqual(next.app.settings.getSnapshot().widgetOrder,[2,0,1]);assert.deepEqual(next.app.settings.getSnapshot().visibleWidgets,[2,0]);assert.equal(next.app.settings.getSnapshot().widgetExpanded,false);
 assert.equal((await next.app.backup.export({format:'json'})).data.localStorage.AllWidgets,exported.localStorage.AllWidgets);assert.equal(next.storage.getItem('Widgets'),'2,0');
 await next.app.settings.setWidgetLayout([2,0,1],[]);assert.equal(next.storage.getItem('Widgets'),'');assert.deepEqual(next.app.settings.getSnapshot().visibleWidgets,[]);
 const empty=(await next.app.backup.export({format:'json'})).data;await h.app.backup.restore(JSON.stringify(empty));assert.deepEqual(h.app.settings.getSnapshot().visibleWidgets,[]);assert.equal(h.storage.getItem('Widgets'),'');
 const before=h.app.settings.getSnapshot();for(const [order,visible]of [[[0,0],[0]],[[0,1],[2]],[[0,9],[0]],[[0,1,2],[1,1]]])await assert.rejects(h.app.settings.setWidgetLayout(order,visible));assert.strictEqual(h.app.settings.getSnapshot(),before);assert.equal(h.storage.getItem('Widgets'),'');
});
