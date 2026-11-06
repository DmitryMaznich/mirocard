// One illustrated sheet is shared by the portrait picker and full-body figures.
// Coordinates refer to the original PNG; the file itself is never rescaled/cut.
export const WATER_PEOPLE_ART = "/game-art/water-people-v1.png";
export const WATER_PEOPLE_OPEN_ART = "/game-art/water-people-open-v1.png";
export const isWaterTapOpen = open => open >= .5;
export const ART_SIZE = {width:1774,height:887,columnWidth:443.5};
export const CHARACTER_ART = {
  boy:{column:0,grip:[354,494],tap:[340,315],tapOpen:[295,270],foot:[178,867],portrait:[22,135,250]},
  girl:{column:1,grip:[824,494],tap:[792,320],tapOpen:[768,280],foot:[620,867],portrait:[490,155,260]},
  man:{column:2,grip:[1259,429],tap:[1261,193],tapOpen:[1190,147],foot:[1050,871],portrait:[927,0,250]},
  woman:{column:3,grip:[1721,435],tap:[1699,239],tapOpen:[1654,185],foot:[1500,881],portrait:[1360,35,260]},
};

export function waterCharacterPlacement(type) {
  const art=CHARACTER_ART[type] ?? CHARACTER_ART.boy;
  const child=type==="boy" || type==="girl";
  const footY=child ? 445 : 505;
  const scale=(footY-323)/(art.foot[1]-art.grip[1]);
  const x=310-art.grip[0]*scale, y=323-art.grip[1]*scale;
  return {art,child,scale,x,y,footY,footX:x+art.foot[0]*scale,tapX:x+art.tap[0]*scale,tapY:y+art.tap[1]*scale,openTapX:x+art.tapOpen[0]*scale,openTapY:y+art.tapOpen[1]*scale};
}
