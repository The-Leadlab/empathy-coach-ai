#!/usr/bin/env node
/**
 * Unpack data/raw/_downloads/*.zip into data/raw/<partId>/extract/
 * Writes _part.meta.json (SAFE → US-federal-PD / simon-owned; HOLD → hold).
 */
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const dl = path.join(root, "data/raw/_downloads");
const SAFE = /part(?:2a|2d)\.zip|part8-|part8b-|part9-|part1[0-9]-|part20-/i;
const HOLD = /part(?:1\b|2[bce]|3|4|5|6|7)|Phase0|16Oct|cci|cedar|youtube|berkshire/i;

function partIdFromName(name) {
  const m = name.match(/part(\d+[a-z]?)/i) || name.match(/part8b/i);
  if (/part8b/i.test(name)) return "8b";
  return m ? m[1].toLowerCase() : "unknown";
}

function metaFor(name, partId) {
  if (SAFE.test(name) && !HOLD.test(name)) {
    return {
      part_id: partId,
      licence: partId === "2a" || partId === "2d" ? "simon-owned" : "US-federal-PD",
      source_agency: "drive-pack",
      cite: name,
      requires_cultural_review: false,
    };
  }
  return {
    part_id: partId,
    licence: "hold",
    source_agency: "drive-pack",
    cite: name,
    exclude_reasons: ["hold_licence_or_path"],
  };
}

if (!fs.existsSync(dl)) {
  console.error("No data/raw/_downloads — run scripts/phase3/download-drive-zips.sh first");
  process.exit(1);
}

const zips = fs.readdirSync(dl).filter((f) => f.endsWith(".zip"));
let unpacked = 0;
for (const zip of zips) {
  const partId = partIdFromName(zip);
  const dest = path.join(root, "data/raw", partId);
  const extract = path.join(dest, "extract");
  fs.mkdirSync(extract, { recursive: true });
  const zipPath = path.join(dl, zip);
  console.log("unzip", zip, "→", extract);
  try {
    execSync(`unzip -o -q ${JSON.stringify(zipPath)} -d ${JSON.stringify(extract)}`, {
      stdio: "inherit",
    });
  } catch (e) {
    console.warn("unzip failed", zip, e.message);
    continue;
  }
  fs.writeFileSync(path.join(dest, "_part.meta.json"), JSON.stringify(metaFor(zip, partId), null, 2));
  unpacked++;
}
console.log(JSON.stringify({ unpacked, zips: zips.length }, null, 2));
