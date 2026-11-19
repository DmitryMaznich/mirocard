import {describe,expect,it} from 'vitest';
import {TUG_TRIUMPH_MS,tugTriumphFrame} from './tugArt';

describe('tug victory animation',()=>{
  it('releases the rope, raises hands, jumps, lands and holds a happy pose',()=>{
    expect(tugTriumphFrame(0)).toMatchObject({frame:0,jump:0,release:0,stand:0});
    expect(tugTriumphFrame(550).frame).toBe(1);
    expect(tugTriumphFrame(900)).toMatchObject({frame:2,release:1,stand:1});
    expect(tugTriumphFrame(900).jump).toBeGreaterThan(0);
    expect(tugTriumphFrame(1250)).toMatchObject({frame:3,jump:0});
    expect(tugTriumphFrame(TUG_TRIUMPH_MS)).toMatchObject({frame:1,jump:0,release:1,stand:1});
    expect(tugTriumphFrame(TUG_TRIUMPH_MS+10000)).toEqual(tugTriumphFrame(TUG_TRIUMPH_MS));
  });
  it('keeps the happy pose without jumping when reduced motion is requested',()=>{
    for(const time of [0,500,900,1800,3000])expect(tugTriumphFrame(time,true)).toEqual({frame:1,jump:0,release:1,stand:1});
  });
});
