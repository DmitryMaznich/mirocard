// Export small UI assets from the existing artwork without changing the artwork.
import sharp from "sharp";
import {mkdir} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {ART_SIZE,CHARACTER_ART} from "../src/features/games/waterCharacterArt.js";
const source=fileURLToPath(new URL("../public/game-art/water-people-v1.png",import.meta.url));
const output=new URL("../src/features/games/art/",import.meta.url);
await mkdir(output,{recursive:true});
const metadata=await sharp(source).metadata();
if(metadata.width!==ART_SIZE.width || metadata.height!==ART_SIZE.height)throw new Error("Character sheet dimensions changed: recalibrate portrait crops first.");
for(const [type,art] of Object.entries(CHARACTER_ART)){
  const [left,top,size]=art.portrait;
  const info=await sharp(source).extract({left,top,width:size,height:size}).resize(112,112).webp({quality:82,effort:6}).toFile(fileURLToPath(new URL(`${type}-portrait.webp`,output)));
  console.log(`${type}: ${info.size} bytes`);
}
