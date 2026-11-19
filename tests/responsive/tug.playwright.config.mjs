import base from "./games.playwright.config.mjs";
export default {...base,testMatch:"tug.spec.mjs",timeout:60000,outputDir:"../../.cache/tug-results"};
