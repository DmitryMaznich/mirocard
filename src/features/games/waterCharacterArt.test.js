// @vitest-environment node
import {describe,it,expect} from "vitest";
import {readFileSync} from "node:fs";
import {ART_SIZE,CHARACTER_ART,waterCharacterPlacement} from "./waterCharacterArt";

describe("illustrated water characters",()=>{
  it("matches the published sheet dimensions",()=>{
    const png=readFileSync(new URL("../../../public/game-art/water-people-v1.png",import.meta.url));
    expect(png.readUInt32BE(16)).toBe(ART_SIZE.width);
    expect(png.readUInt32BE(20)).toBe(ART_SIZE.height);
    const open=readFileSync(new URL("../../../public/game-art/water-people-open-v1.png",import.meta.url));
    expect(open.readUInt32BE(16)).toBe(ART_SIZE.width);
    expect(open.readUInt32BE(20)).toBe(ART_SIZE.height);
  });
  it.each(Object.keys(CHARACTER_ART))("anchors %s to the same glass and keeps the valve within reach",type=>{
    const p=waterCharacterPlacement(type);
    expect(p.x+p.art.grip[0]*p.scale).toBeCloseTo(310,8);
    expect(p.y+p.art.grip[1]*p.scale).toBeCloseTo(323,8);
    expect(p.y+p.art.foot[1]*p.scale).toBeCloseTo(p.child ? 445 : 505,8);
    expect(p.openTapY).toBeLessThan(p.tapY-10);
    expect(p.openTapX).toBeLessThan(p.tapX);
    expect(p.tapY).toBeLessThan(285);
    expect(p.tapY).toBeGreaterThan(185);
    expect(p.tapX-18+11.5).toBeLessThan(310);
    const [x,y,size]=p.art.portrait;
    expect(x).toBeGreaterThanOrEqual(p.art.column*ART_SIZE.columnWidth);
    expect(x+size).toBeLessThanOrEqual((p.art.column+1)*ART_SIZE.columnWidth);
    expect(y+size).toBeLessThan(ART_SIZE.height);
  });
});
