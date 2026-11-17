"""Read-only comparison of actual app screenshots; diff/side-by-side evidence only."""
from pathlib import Path
import sys, json, html
from PIL import Image, ImageChops, ImageStat
root=Path(sys.argv[1]); results=[]
for old in sorted(root.glob('*-old.png')):
    new=old.with_name(old.name.replace('-old.png','-new.png'))
    if not new.exists(): continue
    a,b=Image.open(old).convert('RGB'),Image.open(new).convert('RGB')
    if a.size != b.size: results.append({'scene':old.stem[:-4],'error':'size mismatch'});continue
    diff=ImageChops.difference(a,b)
    histogram=diff.convert('L').point(lambda p:255 if p>12 else 0).histogram()
    mismatch=histogram[255]/(a.width*a.height)
    mean=sum(ImageStat.Stat(diff).mean)/3/255
    key=old.stem[:-4]
    canvas=Image.new('RGB',(a.width*2,a.height));canvas.paste(a,(0,0));canvas.paste(b,(a.width,0));canvas.save(root/(key+'-compare.png'))
    diff.point(lambda p:min(255,p*4)).save(root/(key+'-diff.png'))
    results.append({'scene':key,'mismatchAbove12':round(mismatch,6),'meanAbsoluteNormalized':round(mean,6)})
(root/'pixels.json').write_text(json.dumps(results,indent=2),encoding='utf8')
rows=''.join('<article><h2>'+html.escape(r['scene'])+'</h2><p>'+html.escape(json.dumps(r))+'</p><a href="'+r['scene']+'-diff.png">Pixel difference ×4</a><img loading="lazy" src="'+r['scene']+'-compare.png"></article>' for r in results if 'error' not in r)
(root/'index.html').write_text('<!doctype html><meta charset="utf-8"><title>1.9.3 / standalone UI comparison</title><style>body{font:14px sans-serif;margin:24px;background:#eee;color:#333}article{margin-bottom:36px}img{width:100%;height:auto;border:1px solid #ccc}h2{margin-bottom:8px}</style><h1>1.9.3 (left) / independent candidate (right)</h1><p>Same isolated synthetic data, settings, viewport, clock and browser. Pixel statistics are evidence, not automatic acceptance. See metrics.json and functional results.</p>'+rows,encoding='utf8')
print('Compared',len(results),'actual screenshot pairs')
