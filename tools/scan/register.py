#!/usr/bin/env python3
"""按磁盘上的 SVG 登记，不把上游清单里的占位素材误算成已交付素材。"""
import json
import pathlib
import xml.etree.ElementTree as ET
ROOT = pathlib.Path(__file__).resolve().parents[2]
def read(p): return json.loads((ROOT / p).read_text())
def write(p, v):
    target = ROOT / p
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(v, ensure_ascii=False, indent=2) + '\n')
def svg_info(p):
    doc = ET.parse(ROOT / p).getroot()
    indefinite = [e for e in doc.iter() if e.get('begin') == 'indefinite']
    # 无 id 的动画使用结构选择器，不修改只读原件。
    selectors = []
    for e in indefinite:
        if e.get('id'): selectors.append('#' + e.get('id'))
        else:
            parent = next(n for n in doc.iter() if e in list(n))
            chain = [f':nth-child({list(parent).index(e)+1})']
            while parent is not doc:
                grand = next(n for n in doc.iter() if parent in list(n))
                chain.insert(0, f':nth-child({list(grand).index(parent)+1})')
                parent = grand
            selectors.append('svg > ' + ' > '.join(chain))
    return doc, selectors

def main():
    assets = []
    omitted = {}
    pending = []
    for batch, manifest in [('现有游戏','art-manifest.json'), ('待接入','素材清单.json')]:
        folder = pathlib.Path('素材/源文件') / batch
        source = read(folder / manifest)['assets']
        lookup = {a['id']: a for a in source}
        files = sorted((ROOT / folder / 'svg').glob('*.svg'))
        omitted[batch] = sorted(set(lookup) - {p.stem for p in files})
        for p in files:
            a = lookup[p.stem]
            actions = [{'名字':'待机','种类':'循环','动画验证':'待Chrome验证'}]
            for name, duration in a.get('events', {}).items():
                action = {'名字':name, '种类':None if name in a.get('stay',[]) else '播一次', '毫秒':duration, '触发':{'attr':['data-anim',name]}}
                if name in a.get('stay',[]):
                    action['分类状态'] = '待验证'
                    action['待验证原因'] = '必须在Chrome定位到进场结束后，检查仍生效的无限循环动画'
                    pending.append(f'{batch}/{p.stem}/{name}')
                actions.append(action)
            assets.append({'id':f'{batch}/{p.stem}', '批':batch, '文件':p.relative_to(ROOT).as_posix(), '动作':actions, '染色':a.get('tint',False), '来源':(folder / manifest).as_posix()})
    assets.append({'id':'试验图/试验图','批':'试验图','文件':'素材/试验图/试验图.svg','动作':[{'名字':'待机','种类':'循环'},{'名字':'施法','种类':'播一次','毫秒':1200,'触发':{'class':'act-cast'},'smil':['#smilBlur']}],'染色':False})
    fallback = {'char_lich':('施法','act-cast',1200),'char_golem':('受击','act-hit',400),'fx_explosion':('爆炸','act-explode',1000),'fx_lightning':('闪电','act-strike',600)}
    folder = ROOT / '素材/源文件/复杂测试图'
    for p in sorted(folder.rglob('*.svg')):
        relative = p.relative_to(folder).with_suffix('').as_posix()
        sibling = p.with_suffix('.json')
        if sibling.exists():
            supplement = json.loads(sibling.read_text())
            actions = supplement if isinstance(supplement,list) else supplement['动作']
            source = sibling.relative_to(ROOT).as_posix()
            tint = False if isinstance(supplement,list) else supplement.get('染色',False)
        else:
            doc, selectors = svg_info(p.relative_to(ROOT))
            actions = [{'名字':'待机','种类':'循环','动画验证':'待Chrome验证'}]
            if p.stem in fallback:
                name, cls, duration = fallback[p.stem]
                styles = '\n'.join(e.text or '' for e in doc.iter() if e.tag.endswith('}style'))
                if 'svg.' + cls not in styles or not selectors: raise ValueError(f'{p.name} 动作约定不符，需人工复核')
                actions.append({'名字':name,'种类':'播一次','毫秒':duration,'触发':{'class':cls},'smil':selectors})
            source = '素材/源文件/复杂测试图/notes.md；已用XML核对SVG的class和indefinite动画选择器'
            tint = False
        write(f'素材/清单补充/{relative}.json', {'id':f'复杂测试图/{relative}','动作':actions,'染色':tint,'来源':source})
        assets.append({'id':f'复杂测试图/{relative}','批':'复杂测试图','文件':p.relative_to(ROOT).as_posix(),'动作':actions,'染色':tint,'来源':source})
    write('素材/清单.json',assets)
    write('报告/素材登记.json',{'状态':'待验证','数量':len(assets),'分批数量':{b:sum(a['批']==b for a in assets) for b in ['现有游戏','待接入','试验图','复杂测试图','公开测试集']},'上游清单未交付的id':omitted,'stay待Chrome分类':pending,'静态及周期判断':'待Chrome；待机种类沿用循环槽位，不表示已确认有动画；无动画时应只出0毫秒','公开测试集':{'状态':'未登记','原因':'resvg测试集尚未下载和固定提交，不能伪造覆盖'},'Chrome验证':'尚未运行；运行 node tools/scan/cli.mjs 后更新'})
    print(f'已登记 {len(assets)} 个SVG；{len(pending)} 个stay动作待Chrome判断；公开测试集未登记')
if __name__ == '__main__': main()
