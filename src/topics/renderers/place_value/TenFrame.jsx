import { Coin } from "./CoinBlocks.jsx";

// «Собери десяток»: the ten-frame (two rows of five) both coin modes collect
// a ten in. Ten is visible at a glance and easy to recount; the child closes
// it into a stack themselves («Сложить в стопку»), the app never does.
// Coins carry data-coin-id so useCoinExchange can fly them into the new stack.
// With `slots={false}` («Проверка» without the frame) the coins pile up as a
// growing stack with no places and no counter — the child counts ten alone;
// tapping the pile takes its top coin back.
export default function TenFrame({ coinIds, pendingIds = [], onReturn, onPileTap, onClose, disabled, glow, slots = true, title = "Собери десяток" }) {
  const count = coinIds.length;
  const full = slots ? count === 10 : count > 0;
  return <div className={`px-tenframe${glow ? " px-glow" : ""}`}>
    <h3>{title}</h3>
    {slots
      ? <div className={`px-tf${count === 10 ? " px-tf--full" : ""}`}>
        {Array.from({ length: 10 }, (_, i) => {
          const id = coinIds[i];
          return id
            ? <button type="button" key={id} data-coin-id={id} className={`px-coin${pendingIds.includes(id) ? " px-pending" : ""}`}
              aria-label={`Монета в рамке ${i + 1}`} disabled={disabled} onClick={() => onReturn(id)}><Coin /></button>
            : <span key={`slot-${i}`} className="px-tf-slot" />;
        })}
      </div>
      : <button type="button" className="px-tf-pile" aria-label="Собирается стопка — нажми, чтобы убрать монету"
        disabled={disabled || !count} onClick={onPileTap}>
        <span className="cb-ten-stack">{coinIds.map((id) => <span key={id} className="cb-stack-coin" />)}</span>
      </button>}
    <div className="px-tf-foot">
      {slots && <span className={`px-tf-count${count === 10 ? " px-tf-count--full" : ""}`}>{count} из 10</span>}
      <button type="button" className={`px-close${count === 10 || !slots ? " px-close--ready" : ""}`}
        disabled={disabled || !full} onClick={onClose}>Сложить в стопку</button>
    </div>
  </div>;
}
