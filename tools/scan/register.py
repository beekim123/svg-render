#!/usr/bin/env python3
"""按磁盘上的 SVG 登记，不把上游清单里的占位素材误算成已交付素材。"""
import json
import pathlib
import os
import sys
ROOT = pathlib.Path(__file__).resolve().parents[2]
def read(p): return json.loads((ROOT / p).read_text())
def write(p, v):
    target = ROOT / p
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(v, ensure_ascii=False, indent=2) + '\n')
def complex_asset(p, folder):
    relative = p.relative_to(folder).with_suffix('').as_posix()
    sibling = p.with_suffix('.json')
    if sibling.exists():
        data = json.loads(sibling.read_text())
        if not isinstance(data, dict) or data.get('id') != p.stem:
            raise ValueError(f'{sibling.name} 的id必须和SVG文件名一致')
        actions = data.get('动作')
        if not isinstance(actions, list):
            raise ValueError(f'{sibling.name} 缺少动作数组')
        if not actions:
            actions = [{'名字':'待机','种类':'循环','静态':True,'毫秒':0,'动画验证':'来源JSON声明静态，待Chrome复核'}]
        for action in actions:
            if not isinstance(action, dict) or not action.get('名字') or action.get('种类') not in ['循环','播一次','播完停住','进场后循环']:
                raise ValueError(f'{sibling.name} 的动作结构不合法')
            if action['种类'] != '循环' and not isinstance(action.get('毫秒'), (int, float)):
                raise ValueError(f'{sibling.name} 的非循环动作缺少毫秒')
        source = sibling.relative_to(ROOT).as_posix()
        extra = {key:data[key] for key in ['染色','混合','槽']}
    else:
        # 新版约定只有30个普通图标没有动作JSON，主图与染色图标不能回退旧说明。
        if p.parent != folder / 'icons' or p.stem.startswith('icon_tint_'):
            raise ValueError(f'{p.name} 缺少同目录动作JSON，停止登记')
        actions = [{'名字':'待机','种类':'循环','动画验证':'待Chrome验证'}]
        source = 'docs/阶段0-需求.md 第3节：普通30图标只有待机循环'
        extra = {'染色':False,'混合':'normal','槽':{}}
    return {'id':f'复杂测试图/{relative}','批':'复杂测试图','文件':p.relative_to(ROOT).as_posix(),'动作':actions,**extra,'来源':source}

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
    folder = ROOT / '素材/源文件/复杂测试图'
    for p in sorted(folder.rglob('*.svg')):
        assets.append(complex_asset(p, folder))
    # 只登记已交付的本地素材；公开集必须另经Chrome筛选，下载不等于通过。
    commit = '500d8605a28ac092c1b146c06ec65c0e70e99ec4'
    cache = pathlib.Path(os.environ.get('SVG_RENDER_CACHE') or (pathlib.Path.home() / ('Library/Caches/svg-render' if sys.platform == 'darwin' else '.cache/svg-render')))
    tests = cache / 'tests/resvg' / commit / 'crates/resvg/tests'
    public = {'状态':'待Chrome筛选' if tests.is_dir() else '未登记','提交':commit,'缓存相对路径':f'tests/resvg/{commit}','登记数':0,'原因':'已下载固定提交，必须Chrome确认静态且全部特性支持后才登记' if tests.is_dir() else '未在当前平台缓存找到公开测试集，不能伪造覆盖'}
    if tests.is_dir(): public['候选数'] = len(list(tests.rglob('*.svg')))
    write('素材/清单.json',assets)
    write('报告/素材登记.json',{'状态':'待验证','数量':len(assets),'分批数量':{b:sum(a['批']==b for a in assets) for b in ['现有游戏','待接入','试验图','复杂测试图','公开测试集']},'上游清单未交付的id':omitted,'stay待Chrome分类':pending,'静态及周期判断':'待Chrome；待机种类沿用循环槽位，不表示已确认有动画；无动画时应只出0毫秒','公开测试集':public,'Chrome验证':'尚未运行；运行 node tools/scan/cli.mjs 后更新'})
    print(f'已登记 {len(assets)} 个SVG；{len(pending)} 个stay动作待Chrome判断；公开测试集未登记')
if __name__ == '__main__': main()
