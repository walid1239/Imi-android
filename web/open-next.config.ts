// This adapter is installed only in the Cloudflare build step, after the standard Next.js typecheck/build.
// @ts-ignore -- optional build adapter is intentionally absent from the app dependency graph.
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig();
