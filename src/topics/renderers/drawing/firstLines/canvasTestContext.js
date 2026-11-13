// Small recording context for DOM-less geometry/control tests; browser tests use real pixels.
export function recordingContext(canvas={width:1000,height:1000}){
 const calls=[],stack=[],ctx={canvas,calls,globalAlpha:1,lineWidth:1,strokeStyle:'#000',fillStyle:'#000'};
 for(const name of ['setTransform','translate','scale','rotate','beginPath','moveTo','lineTo','arc','fill','stroke','strokeRect','fillRect'])ctx[name]=(...args)=>calls.push({name,args,stroke:ctx.strokeStyle,fill:ctx.fillStyle,width:ctx.lineWidth,alpha:ctx.globalAlpha});
 ctx.save=()=>stack.push({globalAlpha:ctx.globalAlpha,lineWidth:ctx.lineWidth,strokeStyle:ctx.strokeStyle,fillStyle:ctx.fillStyle});
 ctx.restore=()=>Object.assign(ctx,stack.pop());ctx.getContextAttributes=()=>({alpha:false,willReadFrequently:true,desynchronized:false});return ctx;
}
