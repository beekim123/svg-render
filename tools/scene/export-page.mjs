// Runs inside Chrome; keep all helpers in this function for CDP serialization.
export function exportScene(root = document.querySelector('svg'), options = {}) {
  if (!root) throw new Error('场景导出：没有 <svg>');
  const namespace = 'http://www.w3.org/2000/svg';
  const shapes = new Set(['path', 'rect', 'circle', 'ellipse', 'line', 'polygon', 'polyline']);
  const definitions = new Set(['defs', 'clipPath', 'linearGradient', 'radialGradient', 'pattern', 'stop', 'style', 'title', 'desc', 'metadata']);
  const matrix = value => [value.a, value.b, value.c, value.d, value.e, value.f];
  const identity = () => new DOMMatrix();
  const animated = new Map();
  for (const track of options.tracks || []) {
    if (!animated.has(track.node)) animated.set(track.node, new Set());
    animated.get(track.node).add(track.property);
  }
  const nodeNumber = element => Number(element.getAttribute('data-svg-render-node'));
  const bounds = element => {
    const box = element.getBBox();
    const style = getComputedStyle(element);
    const padding = style.stroke === 'none' ? 0 : parseFloat(style.strokeWidth) / 2 * (style.strokeLinejoin === 'miter' ? Number(style.strokeMiterlimit) : Math.SQRT2);
    return [box.x - padding, box.y - padding, box.width + padding * 2, box.height + padding * 2];
  };
  const fail = (element, reason = '不支持的元素') => {
    throw new Error(`场景导出：${reason} <${element.localName}>${element.id ? `#${element.id}` : ''}`);
  };
  for (const element of [root, ...root.querySelectorAll('*')]) {
    if (element.namespaceURI !== namespace || !(shapes.has(element.localName) || definitions.has(element.localName) || element.localName === 'g' || element === root)) fail(element);
  }
  const viewport = root.viewBox.baseVal;
  const width = root.width.baseVal.value;
  const height = root.height.baseVal.value;
  const userWidth = viewport.width || width;
  const userHeight = viewport.height || height;
  const diagonal = Math.hypot(userWidth, userHeight) / Math.SQRT2;
  const color = (value, alpha = 1) => {
    const rgb = value.match(/^rgba?\((.*)\)$/i);
    if (rgb) {
      const parts = rgb[1].split(/[\s,/]+/).filter(Boolean);
      const channel = part => parseFloat(part) / (part.endsWith('%') ? 100 : 255);
      const opacity = part => parseFloat(part) / (part.endsWith('%') ? 100 : 1);
      return [channel(parts[0]), channel(parts[1]), channel(parts[2]), alpha * (parts[3] === undefined ? 1 : opacity(parts[3]))];
    }
    const srgb = value.match(/^color\(srgb\s+(.+)\)$/i);
    if (srgb) {
      const parts = srgb[1].split(/[\s/]+/).filter(Boolean).map(Number);
      return [...parts.slice(0, 3), alpha * (parts[3] ?? 1)];
    }
    throw new Error(`场景导出：不支持的颜色 ${value}`);
  };
  const transformList = (element, name) => {
    let result = identity();
    const list = element[name]?.baseVal;
    for (let index = 0; index < (list?.numberOfItems || 0); index++) result = result.multiply(list.getItem(index).matrix);
    return result;
  };
  const localTransform = element => {
    const style = getComputedStyle(element);
    if (style.transform === 'none') return identity();
    const typed = element.computedStyleMap?.().get('transform');
    const transform = typeof typed?.toMatrix === 'function' ? typed.toMatrix() : new DOMMatrix(style.transform);
    let [x, y] = style.transformOrigin.split(' ').map(parseFloat);
    if (style.transformBox === 'fill-box' || style.transformBox === 'stroke-box') {
      const box = element.getBBox();
      x += box.x;
      y += box.y;
    } else {
      x += viewport.x;
      y += viewport.y;
    }
    return identity().translate(x, y).multiply(transform).translate(-x, -y);
  };
  const length = (element, name) => element[name].baseVal.value;
  const geometry = element => {
    const tag = element.localName;
    if (tag === 'path') {
      const computed = getComputedStyle(element).d;
      if (computed?.startsWith('path(')) return computed.slice(computed.indexOf('"') + 1, computed.lastIndexOf('"'));
      return element.getAttribute('d') || '';
    }
    if (tag === 'line') return `M${length(element, 'x1')} ${length(element, 'y1')}L${length(element, 'x2')} ${length(element, 'y2')}`;
    if (tag === 'polygon' || tag === 'polyline') {
      const points = element.points;
      if (!points.numberOfItems) return '';
      const parts = [];
      for (let index = 0; index < points.numberOfItems; index++) {
        const point = points.getItem(index);
        parts.push(`${index ? 'L' : 'M'}${point.x} ${point.y}`);
      }
      return parts.join('') + (tag === 'polygon' ? 'Z' : '');
    }
    if (tag === 'circle' || tag === 'ellipse') {
      const cx = length(element, 'cx');
      const cy = length(element, 'cy');
      const rx = length(element, tag === 'circle' ? 'r' : 'rx');
      const ry = tag === 'circle' ? rx : length(element, 'ry');
      if (rx <= 0 || ry <= 0) return '';
      return `M${cx + rx} ${cy}A${rx} ${ry} 0 1 1 ${cx - rx} ${cy}A${rx} ${ry} 0 1 1 ${cx + rx} ${cy}Z`;
    }
    if (tag === 'rect') {
      const x = length(element, 'x');
      const y = length(element, 'y');
      const w = length(element, 'width');
      const h = length(element, 'height');
      if (w <= 0 || h <= 0) return '';
      const style = getComputedStyle(element);
      let rx = style.rx === 'auto' ? null : parseFloat(style.rx);
      let ry = style.ry === 'auto' ? null : parseFloat(style.ry);
      const resolvedRx = rx ?? ry ?? 0;
      const resolvedRy = ry ?? rx ?? 0;
      rx = Math.min(w / 2, resolvedRx);
      ry = Math.min(h / 2, resolvedRy);
      if (!rx || !ry) return `M${x} ${y}H${x + w}V${y + h}H${x}Z`;
      return `M${x + rx} ${y}H${x + w - rx}A${rx} ${ry} 0 0 1 ${x + w} ${y + ry}V${y + h - ry}A${rx} ${ry} 0 0 1 ${x + w - rx} ${y + h}H${x + rx}A${rx} ${ry} 0 0 1 ${x} ${y + h - ry}V${y + ry}A${rx} ${ry} 0 0 1 ${x + rx} ${y}Z`;
    }
    fail(element);
  };
  const reference = (value, element) => {
    const match = value.match(/^url\(\s*["']?([^"')]+)["']?\s*\)/);
    if (!match) fail(element, `不支持的引用 ${value}`);
    const index = match[1].lastIndexOf('#');
    const id = index >= 0 ? decodeURIComponent(match[1].slice(index + 1)) : '';
    const target = document.getElementById(id);
    if (!target || !root.contains(target)) fail(element, `找不到引用 ${value}`);
    return target;
  };
  const bboxMatrix = element => {
    const box = element.getBBox();
    return identity().translate(box.x, box.y).scaleNonUniform(box.width, box.height);
  };
  const clips = (element, base) => {
    const value = getComputedStyle(element).clipPath;
    if (value === 'none') return [];
    const clip = reference(value, element);
    if (clip.localName !== 'clipPath') fail(clip, '裁剪引用不是 clipPath');
    const clipBase = base.multiply(clip.clipPathUnits.baseVal === 2 ? bboxMatrix(element) : identity()).multiply(localTransform(clip));
    const paths = [];
    const visit = (child, parent) => {
      if (definitions.has(child.localName)) return;
      const style = getComputedStyle(child);
      if (style.display === 'none' || style.visibility !== 'visible') return;
      const current = parent.multiply(localTransform(child));
      if (child.localName === 'g') {
        for (const nested of child.children) visit(nested, current);
      } else {
        if (!shapes.has(child.localName)) fail(child);
        const item = {path: geometry(child), matrix: matrix(current), fillRule: style.clipRule};
        if (options.layers) {
          const box = child.getBBox();
          item.bounds = [box.x, box.y, box.width, box.height];
        }
        paths.push(item);
      }
    };
    for (const child of clip.children) visit(child, clipBase);
    return [{paths}];
  };
  const chain = element => {
    const result = [element];
    let current = element;
    while (current.href?.baseVal) {
      const id = current.href.baseVal;
      if (!id.startsWith('#')) fail(current, `不支持的外部引用 ${id}`);
      current = document.getElementById(id.slice(1));
      if (!current || result.includes(current)) fail(element, `循环或缺失的引用 ${id}`);
      result.push(current);
    }
    return result;
  };
  const attribute = (sources, name, fallback) => sources.find(source => source.hasAttribute(name))?.getAttribute(name) ?? fallback;
  const paintLength = (sources, name, fallback, axis, objectUnits) => {
    const value = attribute(sources, name, fallback);
    if (value.endsWith('%')) return parseFloat(value) / 100 * (objectUnits ? 1 : axis === 'x' ? userWidth : axis === 'y' ? userHeight : diagonal);
    const source = sources.find(candidate => candidate.hasAttribute(name));
    return source?.[name]?.baseVal?.value ?? Number(value);
  };
  const viewBoxMatrix = (box, tile, aspect) => {
    let sx = tile[2] / box.width;
    let sy = tile[3] / box.height;
    const [align = 'xMidYMid', meet = 'meet'] = aspect.trim().split(/\s+/);
    let dx = 0;
    let dy = 0;
    if (align !== 'none') {
      sx = sy = meet === 'slice' ? Math.max(sx, sy) : Math.min(sx, sy);
      dx = (tile[2] - box.width * sx) * (align.includes('xMax') ? 1 : align.includes('xMid') ? .5 : 0);
      dy = (tile[3] - box.height * sy) * (align.includes('YMax') ? 1 : align.includes('YMid') ? .5 : 0);
    }
    return identity().translate(tile[0] + dx, tile[1] + dy).scaleNonUniform(sx, sy).translate(-box.x, -box.y);
  };
  const resolving = new Set();
  const paint = (value, opacity, element, base) => {
    if (value === 'none') return null;
    if (!value.startsWith('url(')) return {type: 'color', color: color(value, opacity)};
    const definition = reference(value, element);
    if (resolving.has(definition)) fail(definition, '循环的画笔引用');
    resolving.add(definition);
    try {
      const sources = chain(definition);
      const tag = definition.localName;
      if (tag === 'linearGradient' || tag === 'radialGradient') {
        const objectUnits = attribute(sources, 'gradientUnits', 'objectBoundingBox') === 'objectBoundingBox';
        const units = objectUnits ? bboxMatrix(element) : identity();
        if (objectUnits && (units.a === 0 || units.d === 0)) return null;
        const transformed = sources.find(source => source.hasAttribute('gradientTransform'));
        const paintMatrix = base.multiply(units).multiply(transformed ? transformList(transformed, 'gradientTransform') : identity());
        const stopsSource = sources.find(source => source.querySelector(':scope > stop'));
        let previousOffset = 0;
        const stops = [...(stopsSource?.children || [])].filter(stop => stop.localName === 'stop').map(stop => {
          const style = getComputedStyle(stop);
          const offset = previousOffset = Math.max(previousOffset, Math.min(1, stop.offset.baseVal));
          return {offset, color: color(style.stopColor, opacity * Number(style.stopOpacity))};
        });
        const scalar = (name, fallback, axis) => paintLength(sources, name, fallback, axis, objectUnits);
        let points;
        if (tag === 'linearGradient') points = [scalar('x1', '0%', 'x'), scalar('y1', '0%', 'y'), scalar('x2', '100%', 'x'), scalar('y2', '0%', 'y')];
        else {
          const cx = scalar('cx', '50%', 'x');
          const cy = scalar('cy', '50%', 'y');
          const fx = sources.some(source => source.hasAttribute('fx')) ? scalar('fx', '50%', 'x') : cx;
          const fy = sources.some(source => source.hasAttribute('fy')) ? scalar('fy', '50%', 'y') : cy;
          points = [fx, fy, scalar('fr', '0%', 'r'), cx, cy, scalar('r', '50%', 'r')];
        }
        return {type: tag === 'linearGradient' ? 'linear' : 'radial', matrix: matrix(paintMatrix), points, stops, spread: attribute(sources, 'spreadMethod', 'pad')};
      }
      if (tag === 'pattern') {
        const objectUnits = attribute(sources, 'patternUnits', 'objectBoundingBox') === 'objectBoundingBox';
        const units = objectUnits ? bboxMatrix(element) : identity();
        const tile = [paintLength(sources, 'x', '0', 'x', objectUnits), paintLength(sources, 'y', '0', 'y', objectUnits), paintLength(sources, 'width', '0', 'x', objectUnits), paintLength(sources, 'height', '0', 'y', objectUnits)];
        if (tile[2] <= 0 || tile[3] <= 0 || units.a === 0 || units.d === 0) return null;
        const transformed = sources.find(source => source.hasAttribute('patternTransform'));
        const paintMatrix = base.multiply(units).multiply(transformed ? transformList(transformed, 'patternTransform') : identity());
        const contentSource = sources.find(source => [...source.children].some(child => !definitions.has(child.localName)));
        const viewBoxSource = sources.find(source => source.hasAttribute('viewBox'));
        const contentUnits = attribute(sources, 'patternContentUnits', 'userSpaceOnUse') === 'objectBoundingBox' ? bboxMatrix(element) : identity();
        const contentMatrix = viewBoxSource ? viewBoxMatrix(viewBoxSource.viewBox.baseVal, tile, attribute(sources, 'preserveAspectRatio', 'xMidYMid meet')) : units.inverse().multiply(contentUnits);
        const nodes = [...(contentSource?.children || [])].flatMap(child => visit(child, contentMatrix, false));
        return {type: 'pattern', matrix: matrix(paintMatrix), tile, nodes, opacity};
      }
      fail(definition, '不支持的画笔');
    } finally {
      resolving.delete(definition);
    }
  };
  const visit = (element, parent = null, layered = Boolean(options.layers)) => {
    if (definitions.has(element.localName)) return [];
    const style = getComputedStyle(element);
    if (style.display === 'none') return [];
    for (const property of ['filter', 'mask-image', 'marker-start', 'marker-mid', 'marker-end']) {
      const value = style.getPropertyValue(property);
      if (value && value !== 'none') fail(element, `不支持 ${property}=${value}`);
    }
    if (style.mixBlendMode !== 'normal' || style.vectorEffect !== 'none' || style.paintOrder !== 'normal') fail(element, '不支持的混合、描边变换或绘制顺序');
    const properties = layered ? animated.get(nodeNumber(element)) : null;
    const wrapped = layered && shapes.has(element.localName) && properties;
    let base = parent ? parent.multiply(localTransform(element)) : new DOMMatrix(matrix(element.getCTM()));
    if (properties?.has('transform')) base = element === root ? base.multiply(localTransform(element).inverse()) : identity();
    const opacity = properties?.has('opacity') ? 1 : Number(style.opacity);
    const ownClips = clips(element, layered && (wrapped || element.localName === 'g' || element === root) ? identity() : base);
    if (element.localName === 'g' || element === root) {
      const children = [...element.children].flatMap(child => visit(child, layered ? identity() : parent ? base : null, layered));
      if (layered) return [{type: 'layer', node: nodeNumber(element), matrix: matrix(base), opacity, clips: ownClips, children}];
      if (opacity === 1 && !ownClips.length) return children;
      return [{type: 'group', opacity, clips: ownClips, children}];
    }
    if (style.visibility !== 'visible') return [];
    const pathLength = element.hasAttribute('pathLength') ? element.pathLength.baseVal : null;
    const dashLength = value => value.endsWith('%') ? parseFloat(value) * diagonal / 100 : parseFloat(value);
    const dash = style.strokeDasharray === 'none' ? [] : style.strokeDasharray.split(/[\s,]+/).filter(Boolean).map(dashLength);
    if (dash.length % 2) dash.push(...dash);
    const path = geometry(element);
    if (!path) return [];
    const pathBase = wrapped ? identity() : base;
    const result = {
      type: 'path',
      path,
      pathLength,
      matrix: matrix(pathBase),
      fill: paint(style.fill, Number(style.fillOpacity), element, pathBase),
      stroke: paint(style.stroke, Number(style.strokeOpacity), element, pathBase),
      fillRule: style.fillRule,
      strokeWidth: parseFloat(style.strokeWidth),
      strokeCap: style.strokeLinecap,
      strokeJoin: style.strokeLinejoin,
      strokeMiter: Number(style.strokeMiterlimit),
      strokeDasharray: dash,
      strokeDashoffset: dashLength(style.strokeDashoffset),
      opacity: wrapped ? 1 : opacity,
      clips: wrapped ? [] : ownClips,
      ...(layered ? {bounds: bounds(element)} : {})
    };
    if (wrapped) return [{type: 'layer', node: nodeNumber(element), matrix: matrix(base), opacity, clips: ownClips, children: [result]}];
    return [result];
  };
  return {width, height, nodes: visit(root)};
}
