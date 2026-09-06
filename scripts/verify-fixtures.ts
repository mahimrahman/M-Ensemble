/**
 * Referential integrity check over the fixtures.
 *
 * The fixtures are hand-written and cross-reference each other by id, so a
 * renamed mosque or a deleted post leaves danglers that typecheck perfectly
 * and only surface as an empty screen during a demo. This walks every edge.
 *
 *   npx tsx scripts/verify-fixtures.ts
 */

import {
  COORDINATOR_EMAILS,
  coordinatorMosqueFor,
  mockFollows,
  mockMemberships,
  mockMosques,
  mockPastPosts,
  mockPosts,
  mockSignups,
  mockUsers,
} from '../packages/shared/src/index';

const mosqueIds = new Set(mockMosques.map((m) => m._id));
const userIds = new Set(mockUsers.map((u) => u._id));
const allPosts = [...mockPosts, ...mockPastPosts];
const postIds = new Set(allPosts.map((p) => p._id));
const problems: string[] = [];

for (const p of allPosts) {
  if (!mosqueIds.has(p.mosqueId)) problems.push(`post ${p._id} -> unknown mosque ${p.mosqueId}`);
  if (!userIds.has(p.createdBy)) problems.push(`post ${p._id} -> unknown creator ${p.createdBy}`);
}
for (const s of mockSignups) {
  if (!postIds.has(s.postId)) problems.push(`signup ${s._id} -> dead post ${s.postId}`);
  if (!userIds.has(s.userId)) problems.push(`signup ${s._id} -> unknown user ${s.userId}`);
}
for (const f of mockFollows) {
  if (!mosqueIds.has(f.mosqueId)) problems.push(`follow ${f._id} -> unknown mosque ${f.mosqueId}`);
  if (!userIds.has(f.userId)) problems.push(`follow ${f._id} -> unknown user ${f.userId}`);
}
for (const m of mockMemberships) {
  if (!mosqueIds.has(m.mosqueId))
    problems.push(`membership ${m._id} -> unknown mosque ${m.mosqueId}`);
  if (!userIds.has(m.userId)) problems.push(`membership ${m._id} -> unknown user ${m.userId}`);
}
// every allowlisted email must name a real mosque; existing accounts on the
// list must already hold that admin membership
for (const c of COORDINATOR_EMAILS) {
  if (!mosqueIds.has(c.mosqueId))
    problems.push(`allowlist ${c.email} -> unknown mosque ${c.mosqueId}`);
  const u = mockUsers.find((u) => u.email === c.email);
  if (
    u &&
    !mockMemberships.some(
      (m) => m.userId === u._id && m.mosqueId === c.mosqueId && m.role === 'admin',
    )
  )
    problems.push(`allowlist ${c.email} exists as ${u._id} but holds no admin membership`);
}
if (coordinatorMosqueFor('YUSUF@example.com'))
  problems.push('a plain member resolved as coordinator');
if (!coordinatorMosqueFor('  Amina@Example.com  '))
  problems.push('allowlist is not case/space insensitive');

const posterCount = allPosts.filter((p) => p.posterKey).length;
const dupPosters = allPosts.map((p) => p.posterKey).filter(Boolean);
console.log(
  `mosques ${mockMosques.length}, posts ${allPosts.length}, posters ${posterCount}, unique ${new Set(dupPosters).size}`,
);
console.log('mosques with a bio:', mockMosques.filter((m) => m.bio).length);
console.log(
  'feed for user_001:',
  mockFollows.filter((f) => f.userId === 'user_001').length,
  'mosques followed',
);
console.log(problems.length ? '\nPROBLEMS:\n' + problems.join('\n') : '\nAll references resolve.');
