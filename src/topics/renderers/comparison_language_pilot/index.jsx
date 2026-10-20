import "./comparison.css";
import CompareVisual from "./CompareVisual.jsx";
import CompareSign from "./CompareSign.jsx";

export default function ComparisonLanguagePilot(props) {
  if (props.mode.type === "compare_visual") return <CompareVisual {...props} />;
  if (props.mode.type === "compare_sign") return <CompareSign {...props} />;
  throw new Error("Unsupported comparison pilot mode");
}
