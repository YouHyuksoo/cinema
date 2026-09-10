import { readFileSync } from 'node:fs';
import { describe,expect,it } from 'vitest';

describe('menu entrance and command dismissal',()=>{
  it('closes the turbine before routing a command and prevents focus from reopening it',()=>{
    const source=readFileSync('src/cinema/FilmTurbineMenu.tsx','utf8');
    expect(source).toContain('suppressOpen.current=true');
    expect(source).toMatch(/setOpen\(false\);[\s\S]*hub.current\?\.focus\([\s\S]*onCommand\(command.id\)/);
    expect(source).toContain('!suppressOpen.current');
  });
  it('hides both 3D bodies and their hit targets until their initial transforms are ready',()=>{
    for(const [css,source,control] of [
      ['filmMenuGlobe.module.css','useFilmMenuGlobe.ts','expand'],
      ['filmMenuCube.module.css','FilmMenuCubeView.tsx','control'],
    ]){
      const rules=readFileSync(`src/cinema/${css}`,'utf8');
      expect(rules).toContain(`.layer:not([data-positioned=true]),.${control}:not([data-positioned=true]) { visibility:hidden; }`);
      const code=readFileSync(`src/cinema/${source}`,'utf8');
      expect(code.indexOf('draw();')).toBeLessThan(code.indexOf("overlay.dataset.positioned='true'"));
      expect(code).toContain("button.dataset.positioned='true'");
      expect(code).toContain('delete overlay.dataset.positioned');
    }
  });
  it('reserves the cube bay before reading its final metric strip position',()=>{
    const source=readFileSync('src/cinema/FilmMenuCubeView.tsx','utf8');
    const measure=source.slice(source.indexOf('const measure = () =>'),source.indexOf('const draw = () =>'));
    expect(measure.indexOf("dataset.cubeDocked = 'true'")).toBeLessThan(measure.indexOf("const strip ="));
  });
});
