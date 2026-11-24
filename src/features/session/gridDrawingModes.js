import { GRAPHIC_MATRIX_MODE } from "./graphicMatrix/model.js";
import { LINE_OPERATIONS_MODE } from "./lineOperations/model.js";

export function isGridDrawingMode(type) {
  return type === GRAPHIC_MATRIX_MODE || type === LINE_OPERATIONS_MODE;
}
