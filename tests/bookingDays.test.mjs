import test from 'node:test';
import assert from 'node:assert/strict';
import { groupBookingDays } from '../lib/bookingDays.mjs';

test('bookings group by Austin day rather than UTC and sort earliest first', () => {
 const items = [
  {_id:'late',startsAt:'2026-11-03T01:00:00Z'},
  {_id:'next',startsAt:'2026-11-03T15:00:00Z'},
  {_id:'early',startsAt:'2026-11-02T15:00:00Z'},
 ];
 const groups=groupBookingDays(items);
 assert.equal(groups.length,2);
 assert.deepEqual(groups[0].items.map(b=>b._id),['early','late']);
 assert.match(groups[0].label,/Monday, November 2, 2026/);
 assert.deepEqual(items.map(b=>b._id),['late','next','early']);
});
test('fall-back appointments retain absolute chronological order within the same day',()=>{
 const groups=groupBookingDays([{_id:'second',startsAt:'2026-11-01T07:15:00Z'},{_id:'first',startsAt:'2026-11-01T06:45:00Z'}]);
 assert.equal(groups.length,1);
 assert.deepEqual(groups[0].items.map(b=>b._id),['first','second']);
 assert.deepEqual(groupBookingDays([]),[]);
});
