export const identity = [1, 0, 0, 1, 0, 0];

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

export function inverse(m) {
  const determinant = m[0] * m[3] - m[1] * m[2];
  if (determinant === 0) return null;
  return [
    m[3] / determinant, -m[1] / determinant,
    -m[2] / determinant, m[0] / determinant,
    (m[2] * m[5] - m[3] * m[4]) / determinant,
    (m[1] * m[4] - m[0] * m[5]) / determinant,
  ];
}

export function point(m, [x, y]) {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

export function transformBounds([x, y, width, height], m) {
  const corners = [[x, y], [x + width, y], [x, y + height], [x + width, y + height]].map(p => point(m, p));
  const xs = corners.map(p => p[0]);
  const ys = corners.map(p => p[1]);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  return [left, top, Math.max(...xs) - left, Math.max(...ys) - top];
}

export function union(rects) {
  if (!rects.length) return null;
  const left = Math.min(...rects.map(rect => rect[0]));
  const top = Math.min(...rects.map(rect => rect[1]));
  const right = Math.max(...rects.map(rect => rect[0] + rect[2]));
  const bottom = Math.max(...rects.map(rect => rect[1] + rect[3]));
  return [left, top, right - left, bottom - top];
}

export function maxScale(m) {
  const scale = Math.max(...m.slice(0, 4).map(Math.abs));
  if (scale === 0) return 0;
  const [a, b, c, d] = m.slice(0, 4).map(value => value / scale);
  const first = a * a + b * b;
  const second = c * c + d * d;
  const cross = a * c + b * d;
  return scale * Math.sqrt((first + second + Math.hypot(first - second, 2 * cross)) / 2);
}

function decompose(m) {
  const sx = Math.sqrt(m[0] * m[0] + m[1] * m[1]);
  const sy = Math.sqrt(m[2] * m[2] + m[3] * m[3]);
  const determinant = m[0] * m[3] - m[1] * m[2];
  const direction = determinant < 0 ? -1 : 1;
  const rotation = sx > 0 ? Math.atan2(m[1], m[0]) : sy > 0 ? Math.atan2(-m[2], m[3]) : 0;
  const dot = m[0] * m[2] + m[1] * m[3];
  const skew = sx > 0 && sy > 0 ? Math.atan2(-dot * direction, determinant * direction) : 0;
  return [rotation, sx, sy * direction, skew];
}

export function interpolate(a, b, w) {
  if (w === 0) return [...a];
  if (w === 1) return [...b];
  const first = decompose(a);
  const second = decompose(b);
  const deltaRotation = second[0] - first[0];
  const deltaSkew = second[3] - first[3];
  const rotation = first[0] + Math.atan2(Math.sin(deltaRotation), Math.cos(deltaRotation)) * w;
  const skew = first[3] + Math.atan2(Math.sin(deltaSkew), Math.cos(deltaSkew)) * w;
  const sx = first[1] + (second[1] - first[1]) * w;
  const sy = first[2] + (second[2] - first[2]) * w;
  return [
    Math.cos(rotation) * sx, Math.sin(rotation) * sx,
    -Math.sin(rotation + skew) * sy, Math.cos(rotation + skew) * sy,
    a[4] + (b[4] - a[4]) * w, a[5] + (b[5] - a[5]) * w,
  ];
}
