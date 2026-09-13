type Point = { x: number; y: number };

/** Select triangles by screen-pixel error, rather than giving distant faces the full mesh. */
export function projectedSurfaceMesh(project: (u: number, v: number) => Point) {
  let columns = 1, rows = 1;
  for (;;) {
    let error = 0;
    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        const u = column / columns, v = row / rows;
        const du = 1 / columns, dv = 1 / rows;
        const a = project(u, v), b = project(u + du, v);
        const c = project(u, v + dv), d = project(u + du, v + dv);
        // Both triangles share a→d. Check its midpoint and each boundary midpoint.
        for (const [p, q, x, y] of [
          [a, d, u + du / 2, v + dv / 2],
          [a, b, u + du / 2, v], [c, d, u + du / 2, v + dv],
          [a, c, u, v + dv / 2], [b, d, u + du, v + dv / 2],
        ] as const) {
          const actual = project(x, y);
          error = Math.max(error, Math.hypot(actual.x - (p.x + q.x) / 2, actual.y - (p.y + q.y) / 2));
        }
      }
    }
    if (error <= .5 || (columns === 12 && rows === 8)) return { columns, rows };
    columns = Math.min(12, columns * 2); rows = Math.min(8, rows * 2);
  }
}
