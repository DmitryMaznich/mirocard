import { DragOverlay, useDndContext } from "@dnd-kit/core";
import { Coin, TenStack } from "./CoinBlocks.jsx";
import "./coins.css";

// Only the dragged object follows the pointer (a stack dragged onto «Единицы»
// in «Обмен десятка»); its source stays in place. Rendering outside the board
// also avoids clipping at zone boundaries.
export function CoinDragOverlay() {
  const { active } = useDndContext();
  return <DragOverlay dropAnimation={null} adjustScale={false} zIndex={500}>
    {active && <div className="cm-drag-object" style={{ "--coin-size": `${active.data.current?.coinSize || 28}px` }}>
      {active.data.current?.kind === "ten" ? <TenStack /> : <Coin />}
    </div>}
  </DragOverlay>;
}
