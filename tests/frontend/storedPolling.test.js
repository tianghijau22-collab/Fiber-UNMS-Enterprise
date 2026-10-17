import test from 'node:test';
import assert from 'node:assert/strict';
import { startStoredPolling } from '../../resources/js/lib/storedPolling.js';

function environment() {
  const document=new EventTarget();document.hidden=false;
  const jobs=new Map();let id=0;
  return {document,jobs,setTimeout(fn){jobs.set(++id,fn);return id;},clearTimeout(key){jobs.delete(key);},
    run(){const [key,fn]=jobs.entries().next().value;jobs.delete(key);return fn();},
    visible(hidden){document.hidden=hidden;document.dispatchEvent(new Event('visibilitychange'));}};
}

test('polling waits for completion, prevents overlaps and aborts on close', async()=>{
  const e=environment();let calls=0,finish,signal;
  const stop=startStoredPolling(s=>{calls++;signal=s;return new Promise(resolve=>finish=resolve);},e);
  const running=e.run();assert.equal(calls,1);assert.equal(e.jobs.size,0);
  e.visible(false);e.visible(false);assert.equal(calls,1);
  finish();await running;assert.equal(e.jobs.size,1);
  const second=e.run();assert.equal(calls,2);stop();assert.equal(signal.aborted,true);
  finish();await second;assert.equal(e.jobs.size,0);e.visible(false);assert.equal(calls,2);
});

test('hidden views do not request data and becoming visible refreshes immediately',async()=>{
  const e=environment();e.document.hidden=true;let calls=0;
  const stop=startStoredPolling(async()=>calls++,e);
  await e.run();assert.equal(calls,0);assert.equal(e.jobs.size,1);
  e.visible(false);await Promise.resolve();await Promise.resolve();assert.equal(calls,1);assert.equal(e.jobs.size,1);
  stop();assert.equal(e.jobs.size,0);
});

test('failed requests do not stop later refreshes or fabricate new sample times',async()=>{
  const e=environment();let attempts=0,errors=0;let stored={rx:-26,sampled_at:'2026-10-17T08:00:00Z'};
  const stop=startStoredPolling(async()=>{attempts++;if(attempts===1)throw new Error('offline');stored={rx:-24,sampled_at:'2026-10-17T08:00:15Z'};},{...e,onError:()=>errors++});
  await e.run();assert.equal(errors,1);assert.equal(stored.rx,-26);assert.equal(stored.sampled_at,'2026-10-17T08:00:00Z');
  await e.run();assert.equal(stored.rx,-24);assert.equal(stored.sampled_at,'2026-10-17T08:00:15Z');stop();
});
