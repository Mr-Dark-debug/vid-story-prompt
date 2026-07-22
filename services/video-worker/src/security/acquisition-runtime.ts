import type { UniquePoolMember } from "./youtube-egress-pool.js";

let healthyWarpMembers: UniquePoolMember[] = [];

export function setHealthyWarpMembers(members: UniquePoolMember[]) {
  healthyWarpMembers = members.map((member) => ({
    ...member,
    member: { ...member.member },
    duplicateMemberIndices: [...member.duplicateMemberIndices],
  }));
}

export function getHealthyWarpMembers() {
  return healthyWarpMembers.map((member) => ({
    ...member,
    member: { ...member.member },
    duplicateMemberIndices: [...member.duplicateMemberIndices],
  }));
}
