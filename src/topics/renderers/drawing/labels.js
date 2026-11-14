// The board, generated covers and fallback covers share the same SVG type.
export function drawingLabelAttributes(label) {
  return {
    x: label.x, y: label.y, textAnchor: label.anchor ?? 'middle',
    fontFamily: 'Nunito, Arial, sans-serif', fontSize: 38, fontWeight: 700,
    fill: '#26352d', stroke: '#ffffff', strokeWidth: 6,
    strokeLinejoin: 'round', paintOrder: 'stroke',
  };
}

export const svgAttributeName = name => name.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
