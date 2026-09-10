import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe,expect,it,vi } from 'vitest';
import { FilmChapterMenu } from '@/cinema/FilmChapterMenu';

const markup=(layout:'dock'|'orbit')=>renderToStaticMarkup(createElement(FilmChapterMenu,{
  active:null,disabled:true,onSelect(){},menuOpen:false,onExpand(){},layout,
}));
describe('deterministic scene menu hydration',()=>{
  for(const layout of ['dock','orbit'] as const){
    it(`${layout}: serializes CSS geometry to at most six decimal places`,()=>{
      const html=markup(layout),styles=[...html.matchAll(/style="([^"]*--ring-[^"]*)"/g)];
      expect(styles.length).toBeGreaterThan(10);
      for(const [,style]of styles)expect(style).not.toMatch(/\.\d{7}/);
    });
    it(`${layout}: server and browser produce identical markup despite trig rounding differences`,()=>{
      const server=markup(layout),cos=Math.cos,sin=Math.sin;
      const cosSpy=vi.spyOn(Math,'cos').mockImplementation(value=>cos(value)+Number.EPSILON);
      const sinSpy=vi.spyOn(Math,'sin').mockImplementation(value=>sin(value)-Number.EPSILON);
      try{expect(markup(layout)).toBe(server);}finally{cosSpy.mockRestore();sinSpy.mockRestore();}
    });
  }
});
