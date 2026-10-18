import test from 'node:test';
import assert from 'node:assert/strict';
import { loadOdpPortDetail, refreshOdpPortDetail, waitForOdpRetry } from '../../resources/js/lib/odpPortDetail.js';

test('busy optional telemetry still returns all eight physical ports and original samples', async () => {
  const data = { node: { id: 12 }, ports: Array.from({ length: 8 }, (_, i) => ({ id: i + 1, sampled_at: '2026-10-17T07:00:00Z' })), live_probe: { success: false, reason_code: 'olt_busy' } };
  let request;
  const result = await loadOdpPortDetail(12, true, async (...args) => {
    request = args;
    return { ok: true, json: async () => data };
  });
  assert.equal(result, data);
  assert.equal(result.ports.length, 8);
  assert.equal(result.ports[0].sampled_at, '2026-10-17T07:00:00Z');
  assert.equal(request[0], '/api/network-nodes/12/port-detail?live=1');
  assert.equal(request[1].headers.Accept, 'application/json');
});

test('failed HTTP requests cannot be mistaken for a successful empty port list', async () => {
  for (const status of [401, 403, 423, 500, 503]) {
    await assert.rejects(loadOdpPortDetail(12, false, async () => ({ ok: false, status })), /ditolak|gagal/);
  }
});

test('automatic reads explicitly skip live OLT probes and support cancellation',async()=>{
  const controller=new AbortController();let request;
  await loadOdpPortDetail(12,false,async(...args)=>{request=args;return {ok:true,json:async()=>({node:{id:12},ports:[]})};},controller.signal);
  assert.equal(request[0],'/api/network-nodes/12/port-detail?skip_live=1');
  assert.equal(request[1].signal,controller.signal);
});

test('invalid JSON, mismatched ODP and absent port arrays are errors, while genuine empty lists remain valid', async () => {
  for (const data of [null, {}, { node: { id: 99 }, ports: [] }, { node: { id: 12 }, ports: null }]) {
    await assert.rejects(loadOdpPortDetail(12, false, async () => ({ ok: true, json: async () => data })), /tidak valid/);
  }
  await assert.rejects(loadOdpPortDetail(12, false, async () => ({ ok: true, json: async () => { throw new SyntaxError('Invalid JSON'); } })));
  const empty = { node: { id: 12 }, ports: [] };
  assert.equal(await loadOdpPortDetail(12, false, async () => ({ ok: true, json: async () => empty })), empty);
});

const busyPorts = () => ({node:{id:12},ports:Array.from({length:8},(_,i)=>({id:i+1,sampled_at:'2026-10-18T07:00:00Z'})),live_probe:{success:false,reason_code:'olt_busy'}});
const response = data => ({ok:true,json:async()=>data});

test('manual refresh retries contention sequentially, shows stored ports while waiting, and returns the real reading',async()=>{
  const busy=busyPorts(), original=structuredClone(busy), live={...busy,live_probe:{success:true,duration_ms:34},ports:[{id:1,sampled_at:'2026-10-18T07:01:00Z'}]};
  const waits=[],waiting=[],stored=[],requests=[];let time=0;
  const result=await refreshOdpPortDetail(12,{fetcher:async(url)=>{requests.push(url);return response(requests.length<3?busy:live);},now:()=>time,random:()=>0,
    wait:async ms=>{waits.push(ms);time+=ms;},onStored:d=>stored.push(d),onWaiting:d=>waiting.push(d.attempt)});
  assert.equal(result,live);assert.deepEqual(waits,[2000,2000]);assert.deepEqual(waiting,[2,3]);assert.equal(stored.length,2);
  assert.ok(requests.every(url=>url.endsWith('/12/port-detail?live=1')));assert.deepEqual(busy,original);
});

test('persistent contention ends after a bounded retry window and preserves all original samples without claiming realtime success',async()=>{
  const busy=busyPorts(),original=structuredClone(busy);let calls=0,time=0;
  const result=await refreshOdpPortDetail(12,{fetcher:async()=>{calls++;return response(busy);},now:()=>time,random:()=>0,wait:async ms=>{time+=ms;}});
  assert.equal(calls,15);assert.equal(time,28000);assert.equal(result.live_probe.success,false);assert.equal(result.live_probe.retry_exhausted,true);
  assert.equal(result.ports.length,8);assert.equal(result.ports[0].sampled_at,original.ports[0].sampled_at);assert.deepEqual(busy,original);
});

test('hardware failure, incomplete readings, coordination misconfiguration and success do not trigger retries',async()=>{
  for(const probe of [{success:false,reason_code:'read_coordination_unavailable'},{success:false,reason:'OLT tidak merespons'},{success:false,reason_code:'point_incomplete'},{success:true}]){
    let calls=0;const data={...busyPorts(),live_probe:probe};
    assert.equal(await refreshOdpPortDetail(12,{fetcher:async()=>{calls++;return response(data);},wait:()=>{throw new Error('Unexpected retry');}}),data);
    assert.equal(calls,1);
  }
});

test('closing the modal aborts a retry delay and cannot issue another request or publish stale stored data',async()=>{
  const controller=new AbortController();let calls=0,stored=0;
  const pending=refreshOdpPortDetail(12,{signal:controller.signal,fetcher:async()=>{calls++;return response(busyPorts());},onStored:()=>stored++,onWaiting:()=>queueMicrotask(()=>controller.abort())});
  await assert.rejects(pending,error=>error.name==='AbortError');assert.equal(calls,1);assert.equal(stored,1);
  let fetched=false;await assert.rejects(refreshOdpPortDetail(12,{signal:controller.signal,fetcher:()=>{fetched=true;}}),error=>error.name==='AbortError');assert.equal(fetched,false);
  await assert.rejects(waitForOdpRetry(1000,controller.signal),error=>error.name==='AbortError');
});

test('aborting an in-flight manual response prevents publishing or retrying after a different ODP is opened',async()=>{
  const controller=new AbortController();let stored=0,waits=0;
  await assert.rejects(refreshOdpPortDetail(12,{signal:controller.signal,fetcher:async()=>{controller.abort();return response(busyPorts());},onStored:()=>stored++,wait:async()=>waits++}),error=>error.name==='AbortError');
  assert.equal(stored,0);assert.equal(waits,0);
});

test('slow busy responses consume the wait deadline rather than extending it indefinitely',async()=>{
  let calls=0,time=0;const waits=[];
  const result=await refreshOdpPortDetail(12,{fetcher:async()=>{calls++;time+=14000;return response(busyPorts());},now:()=>time,random:()=>0,wait:async ms=>{waits.push(ms);time+=ms;}});
  assert.equal(calls,2);assert.deepEqual(waits,[2000]);assert.equal(time,30000);assert.equal(result.live_probe.retry_exhausted,true);
});

test('network failures after contention stop retries while leaving the delivered stored port data intact',async()=>{
  const busy=busyPorts();let calls=0,snapshot;
  await assert.rejects(refreshOdpPortDetail(12,{fetcher:async()=>{if(++calls===1)return response(busy);throw new Error('Network unavailable');},wait:async()=>{},onStored:d=>snapshot=d}),/Network unavailable/);
  assert.equal(calls,2);assert.equal(snapshot,busy);assert.equal(snapshot.ports.length,8);assert.equal(snapshot.live_probe.success,false);
});
