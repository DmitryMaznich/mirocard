// jsPDF's optional libraries (html2canvas, canvg, dompurify) serve only doc.html() / addSvgAsImage, which the app never calls
// (propis printPdf.js draws vectors through svg2pdf). The app is built as ONE file (vite-plugin-singlefile), so a lazy import still
// lands in it: they are aliased to this stub to keep ~0.7 MB out of every page load (vite.config.js).
export default {};
