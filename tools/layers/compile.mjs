const identity = [1, 0, 0, 1, 0, 0];

export function multiply(a, b) {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}

function transformBounds(rect, matrix) {
  const [x, y, width, height] = rect;
  const points = [[x, y], [x + width, y], [x, y + height], [x + width, y + height]];
  const xs = points.map(([px, py]) => matrix[0] * px + matrix[2] * py + matrix[4]);
  const ys = points.map(([px, py]) => matrix[1] * px + matrix[3] * py + matrix[5]);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  return [left, top, Math.max(...xs) - left, Math.max(...ys) - top];
}

function union(rects) {
  if (!rects.length) return null;
  const left = Math.min(...rects.map(rect => rect[0]));
  const top = Math.min(...rects.map(rect => rect[1]));
  const right = Math.max(...rects.map(rect => rect[0] + rect[2]));
  const bottom = Math.max(...rects.map(rect => rect[1] + rect[3]));
  return [left, top, right - left, bottom - top];
}

function transformClips(clips, matrix) {
  return (clips || []).map(clip => ({paths: clip.paths.map(item => ({...item, matrix: multiply(matrix, item.matrix)}))}));
}

function transformPaint(paint, matrix) {
  if (!paint?.matrix) return paint;
  // Pattern nodes use tile coordinates, independent of the painted shape's matrix.
  return {...paint, matrix: multiply(matrix, paint.matrix)};
}

function flatten(node, parent = identity) {
  const current = multiply(parent, node.matrix || identity);
  if (node.type === 'layer' || node.type === 'group') {
    return {
      type: 'group',
      opacity: node.opacity,
      clips: transformClips(node.clips, current),
      children: node.children.map(child => flatten(child, current)),
    };
  }
  return {
    ...node,
    matrix: current,
    fill: transformPaint(node.fill, parent),
    stroke: transformPaint(node.stroke, parent),
    clips: transformClips(node.clips, parent),
  };
}

function contentBounds(node) {
  if (node.type === 'group') return union(node.children.map(contentBounds).filter(Boolean));
  return transformBounds(node.bounds, node.matrix);
}

export function compileLayers(scene, {tracks = [], textureScale = 2} = {}) {
  const animated = new Set(tracks.map(track => track.node));
  const transforms = new Map(tracks.filter(track => track.property === 'transform').map(track => [track.node, track.values]));
  const dynamic = new WeakMap();
  const mark = node => {
    const children = (node.children || []).map(mark);
    const result = node.type === 'layer' && animated.has(node.node) || children.some(Boolean);
    dynamic.set(node, result);
    return result;
  };
  mark(scene.nodes[0]);
  const jobs = [];
  const imageRect = rect => {
    const left = (Math.floor(rect[0] * textureScale) - 1) / textureScale;
    const top = (Math.floor(rect[1] * textureScale) - 1) / textureScale;
    const right = (Math.ceil((rect[0] + rect[2]) * textureScale) + 1) / textureScale;
    const bottom = (Math.ceil((rect[1] + rect[3]) * textureScale) + 1) / textureScale;
    return [left, top, right - left, bottom - top];
  };
  const texture = nodes => {
    const bounds = union(nodes.map(contentBounds).filter(Boolean));
    if (!bounds) return null;
    const rect = imageRect(bounds);
    const file = `texture-${String(jobs.length).padStart(4, '0')}.png`;
    const shift = [1, 0, 0, 1, -rect[0], -rect[1]];
    jobs.push({file, rect, scene: {width: rect[2], height: rect[3], nodes: nodes.map(node => flatten(node, shift))}});
    return {texture: file, rect};
  };
  const mask = clips => {
    const rect = imageRect(union(clips.flatMap(clip => clip.paths.map(item => transformBounds(item.bounds, item.matrix)))) || [0, 0, 0, 0]);
    const file = `mask-${String(jobs.length).padStart(4, '0')}.png`;
    const [x, y, width, height] = rect;
    const shift = [1, 0, 0, 1, -x, -y];
    const white = {
      type: 'path',
      path: `M${x} ${y}H${x + width}V${y + height}H${x}Z`,
      matrix: shift,
      fill: {type: 'color', color: [1, 1, 1, 1]},
      opacity: 1,
      clips: transformClips(clips, shift),
    };
    jobs.push({file, rect, scene: {width, height, nodes: [white]}});
    return {file, rect};
  };
  const preserve = node => {
    const layer = {node: node.node, matrix: node.matrix, opacity: node.opacity, children: []};
    if (node.clips?.length) layer.clips = mask(node.clips);
    let run = [];
    const flush = () => {
      if (!run.length) return;
      const image = texture(run);
      if (image) layer.children.push(image);
      run = [];
    };
    for (const child of node.children) {
      if (dynamic.get(child)) {
        flush();
        layer.children.push(preserve(child));
      } else {
        run.push(flatten(child));
      }
    }
    flush();
    if (layer.clips) {
      layer.rect = layer.clips.rect;
    } else {
      const bounds = layer.children.flatMap(child => {
        if (child.texture) return [child.rect];
        const samples = transforms.get(child.node);
        const matrices = samples ? samples.map(sample => multiply(child.matrix, sample)) : [child.matrix];
        return matrices.map(matrix => transformBounds(child.rect, matrix));
      });
      layer.rect = union(bounds) || [0, 0, 0, 0];
    }
    return layer;
  };
  return {root: preserve(scene.nodes[0]), jobs};
}
