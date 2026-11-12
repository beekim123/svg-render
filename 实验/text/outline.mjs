import path from 'node:path';
import {openSync} from 'fontkit';
const root=path.resolve(import.meta.dirname,'../..');
export function loadFonts(){return new Map([400,700].map(weight=>[weight,openSync(path.join(root,'素材/字体',`NotoSansCJKsc-${weight===400?'Regular':'Bold'}.otf`))]));}
export function outlineRecords(records,fonts){
 return records.map(record=>({...record,characters:record.characters.map(c=>{
  const font=fonts.get(c.weight);if(!font)throw new Error(`未支持字重 ${c.weight}`);
  const glyph=font.glyphForCodePoint(c.char.codePointAt(0));
  if(glyph.id===0)throw new Error(`字体缺字：${c.char}`);
  const scale=c.size/font.unitsPerEm;
  // 字身框用：步进宽、上伸、下伸（hhea），单位换成像素。
  return {...c,glyphId:glyph.id,path:glyph.path.toSVG(),scale,advance:glyph.advanceWidth*scale,ascent:font.ascent*scale,descent:-font.descent*scale};
 })}));
}
