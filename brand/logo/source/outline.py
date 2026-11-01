import uharfbuzz as hb, json, sys
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
def shape(fontfile,text,size=100,tracking=0):
    data=open(fontfile,'rb').read();face=hb.Face(data);font=hb.Font(face)
    buf=hb.Buffer();buf.add_str(text);buf.guess_segment_properties();hb.shape(font,buf,{})
    tt=TTFont(fontfile);gs=tt.getGlyphSet();upm=tt['head'].unitsPerEm;s=size/upm
    order=tt.getGlyphOrder();x=0;parts=[]
    infos,pos=buf.glyph_infos,buf.glyph_positions
    total=sum(p.x_advance for p in pos)+tracking/s*(len(pos)-1)
    for i,(inf,p) in enumerate(zip(infos,pos)):
        pen=SVGPathPen(gs,ntos=lambda v:('%.2f'%v).rstrip('0').rstrip('.'))
        tp=TransformPen(pen,(s,0,0,-s,(x+p.x_offset-total/2)*s,-p.y_offset*s))
        gs[order[inf.codepoint]].draw(tp);parts.append(pen.getCommands())
        x+=p.x_advance+(tracking/s if i<len(pos)-1 else 0)
    return {'d':''.join(parts),'w':total*s}
out={'ar':shape('readex700.ttf','شرباكة'),'en':shape('readex500.ttf','SHORBAKA',100,28)}
json.dump(out,open('outlines.json','w'));print({k:round(v['w'],1) for k,v in out.items()})
