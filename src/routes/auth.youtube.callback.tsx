import { createFileRoute,redirect } from "@tanstack/react-router";
import { z } from "zod";
import { finishYouTubeConnection } from "@/services/youtube/oauth.server";
export const Route=createFileRoute("/auth/youtube/callback")({validateSearch:z.object({code:z.string(),state:z.string()}),beforeLoad:async({search})=>{await finishYouTubeConnection({data:search});throw redirect({to:"/app/youtube-clipper/new"});},component:()=>null});
