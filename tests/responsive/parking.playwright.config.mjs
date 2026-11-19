import base from './games.playwright.config.mjs';
export default {...base,testMatch:'parking.spec.mjs',timeout:60000,outputDir:'../../.cache/parking-results'};
