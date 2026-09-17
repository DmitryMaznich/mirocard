import { exportFigureJsons } from "./figure-jsons.mjs";

const result = exportFigureJsons();
console.log(`✓ exported ${result.count} figure JSON files -> ${result.outputDir}`);
