/** Reference-inspired cut corners, solid tabs and diagonal edge vents. */
export type InfoPanelFrameVariant = 'command' | 'analysis' | 'sensor' | 'telemetry';
type Point = readonly [number, number];
interface FrameShape { outline: readonly Point[]; tabs: readonly (readonly Point[])[]; vent: 'bottom-left' | 'top-right' | 'bottom-right' | 'right' }

const SHAPES: Record<InfoPanelFrameVariant, FrameShape> = {
  command: {
    outline: [[6,12],[23,12],[29,2],[91,2],[97,11],[97,88],[92,98],[66,98],[61,91],[5,91],[2,83],[2,20]],
    tabs: [[[23,12],[29,2],[45,2],[40,12]],[[45,2],[73,2],[70,6],[43,6]],[[95,22],[98,19],[98,43],[95,46]],[[1,66],[4,63],[4,84],[1,81]]],
    vent: 'bottom-left',
  },
  analysis: {
    outline: [[7,5],[55,5],[59,1],[87,1],[98,20],[98,70],[94,77],[94,88],[88,99],[57,99],[52,91],[7,91],[1,82],[1,14]],
    tabs: [[[40,5],[55,5],[59,1],[87,1],[94,14],[47,14]],[[28,91],[47,91],[44,95],[28,95]],[[95,44],[99,44],[99,70],[95,77]]],
    vent: 'top-right',
  },
  sensor: {
    outline: [[7,5],[35,5],[39,1],[91,1],[98,14],[98,89],[92,99],[8,99],[2,91],[2,13]],
    tabs: [[[18,5],[37,5],[40,1],[52,1],[49,7],[20,9]],[[95,34],[100,38],[100,81],[96,87]],[[2,30],[7,37],[7,54],[4,58],[4,36]],[[9,96],[36,96],[33,100],[11,100]]],
    vent: 'bottom-right',
  },
  telemetry: {
    outline: [[7,3],[78,3],[83,11],[92,11],[97,20],[97,89],[91,99],[75,99],[71,94],[31,94],[27,99],[6,99],[1,91],[1,13]],
    tabs: [[[1,13],[5,10],[5,30],[1,33]],[[1,62],[5,65],[5,90],[1,88]],[[17,94],[31,94],[27,99],[17,99]],[[78,3],[81,3],[87,11],[83,11]]],
    vent: 'right',
  },
};

export function infoPanelFrame(x: number, y: number, width: number, height: number, variant: InfoPanelFrameVariant) {
  const shape = SHAPES[variant];
  const edgeScale = Math.min(1, height / 100);
  const point = ([px, py]: Point): Point => {
    const offsetY = py <= 22 ? py * edgeScale : py >= 78 ? height - (100 - py) * edgeScale
      : 22 * edgeScale + (py - 22) / 56 * (height - 44 * edgeScale);
    return [x + px * width / 100, y + offsetY];
  };
  const vents: Point[][] = Array.from({ length: 6 }, (_, i) => {
    switch (shape.vent) {
      case 'bottom-left': return [[31 + i * 4,93],[35 + i * 4,98]];
      case 'bottom-right': return [[75 + i * 3,95],[78 + i * 3,90]];
      case 'top-right': return [[91,14 + i * 3],[96,21 + i * 3]];
      case 'right': return [[93,16 + i * 5],[97,22 + i * 5]];
    }
  });
  return { outline: shape.outline.map(point), tabs: shape.tabs.map(tab => tab.map(point)), vents: vents.map(vent => vent.map(point)) };
}
