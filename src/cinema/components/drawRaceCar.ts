import { raceProject, type RacePoint, type RaceCarState } from '../raceCar';

type Point = RacePoint;
const CYAN = '#76d9f3', AMBER = '#f5ac78';

export function drawRaceCar(ctx: CanvasRenderingContext2D, state: RaceCarState) {
  const line = (points: readonly Point[], color = CYAN, alpha = .55, width = 1) => {
    ctx.beginPath();points.forEach((p,i)=>{const q=raceProject(p);if(i)ctx.lineTo(q.x,q.y);else ctx.moveTo(q.x,q.y);});
    ctx.strokeStyle=color;ctx.globalAlpha=state.presence*alpha;ctx.lineWidth=width;ctx.stroke();
  };
  const face = (points: readonly Point[], fill = 'rgba(80,164,196,.12)', color = CYAN) => {
    ctx.beginPath();points.forEach((p,i)=>{const q=raceProject(p);if(i)ctx.lineTo(q.x,q.y);else ctx.moveTo(q.x,q.y);});ctx.closePath();
    ctx.globalAlpha=state.presence;ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle=color;ctx.lineWidth=.85;ctx.stroke();
  };
  const box = (x:number,y:number,z:number,w:number,l:number,h:number, warm=false) => {
    const a:Point=[x-w/2,y-l/2,z],b:Point=[x+w/2,y-l/2,z],c:Point=[x+w/2,y+l/2,z],d:Point=[x-w/2,y+l/2,z];
    const top=(p:Point):Point=>[p[0],p[1],p[2]+h];
    const color=warm?AMBER:CYAN;
    face([a,b,top(b),top(a)],warm?'rgba(192,113,74,.18)':'rgba(103,181,209,.14)',color);
    face([b,c,top(c),top(b)],'rgba(65,117,143,.16)',color);
    face([top(a),top(b),top(c),top(d)],warm?'rgba(211,147,94,.2)':'rgba(135,195,221,.18)',color);
  };
  const tube = (x:number,y:number,z:number,r:number,color=CYAN) => {
    const points:Point[]=Array.from({length:49},(_,i)=>[x,y+Math.cos(i/48*Math.PI*2)*r,z+Math.sin(i/48*Math.PI*2)*r]);
    line(points,color,.75,1.2);
  };
  const wheel=(x:number,y:number)=>{
    const radius=44, z=44, half=17;
    for(let i=0;i<40;i++) {
      const a=i/40*Math.PI*2,b=(i+1)/40*Math.PI*2;
      face([[x-half,y+Math.cos(a)*radius,z+Math.sin(a)*radius],[x+half,y+Math.cos(a)*radius,z+Math.sin(a)*radius],
        [x+half,y+Math.cos(b)*radius,z+Math.sin(b)*radius],[x-half,y+Math.cos(b)*radius,z+Math.sin(b)*radius]],
        'rgba(24,43,61,.7)','rgba(108,173,209,.2)');
    }
    for(const side of [-1,1]) {
      const sx=x+side*half;
      const sidewall:Point[]=Array.from({length:49},(_,i)=>[sx,y+Math.cos(i/48*Math.PI*2)*43,z+Math.sin(i/48*Math.PI*2)*43]);
      face(sidewall,'rgba(19,39,55,.72)','rgba(126,196,224,.6)');
      for(const r of [44,40,30,26,12,5]) tube(sx,y,z,r,r===26?AMBER:CYAN);
      for(let i=0;i<10;i++) {
        const angle=i/10*Math.PI*2;
        line([[sx,y+Math.cos(angle)*10,z+Math.sin(angle)*10],[sx,y+Math.cos(angle+.14)*29,z+Math.sin(angle+.14)*29]],CYAN,.5,2);
      }
      for(let i=0;i<24;i++) {
        const angle=i/24*Math.PI*2;
        line([[sx,y+Math.cos(angle)*34,z+Math.sin(angle)*34],[sx,y+Math.cos(angle)*37,z+Math.sin(angle)*37]],CYAN,.4);
      }
    }
  };
  ctx.save();
  // Floor shadow and projected engineering grid.
  for(let x=-250;x<=250;x+=40) line([[x,-350,0],[x,330,0]],'#6897b0',.07);
  for(let y=-350;y<=330;y+=40) line([[-250,y,0],[250,y,0]],'#6897b0',.07);
  const shadow=ctx.createRadialGradient(650,390,20,650,390,300);
  shadow.addColorStop(0,'rgba(0,0,0,.55)');shadow.addColorStop(1,'rgba(0,0,0,0)');
  ctx.globalAlpha=state.presence;ctx.fillStyle=shadow;ctx.fillRect(330,130,630,490);
  wheel(-111,174);wheel(-103,-176);
  // Floor, tapered nose, side pods and rear diffuser.
  face([[-72,-145,20],[-28,-269,24],[28,-269,24],[72,-145,20],[89,140,20],[64,214,20],[-64,214,20],[-89,140,20]],'rgba(54,101,128,.13)');
  for(const side of [-1,1]) {
    const sections=[[-250,13,36],[-167,24,48],[-98,43,67],[-30,49,62],[46,73,62],[135,65,72],[205,25,45]];
    for(let i=0;i<sections.length-1;i++) {
      const [y,w,z]=sections[i], [ny,nw,nz]=sections[i+1];
      face([[side*w,y,24],[side*w,y,z],[side*nw,ny,nz],[side*nw,ny,24]],'rgba(115,180,215,.20)');
      face([[side*w,y,z],[side*w*.65,y,z+12],[side*nw*.65,ny,nz+12],[side*nw,ny,nz]],'rgba(156,207,235,.25)');
    }
    line(sections.map(([y,w,z])=>[side*w,y,z] as Point),CYAN,.85,1.6);
    // Suspension wishbones and pushrods connect each wheel to the chassis.
    for(const y of [-176,174]) {
      for(const z of [26,47]) line([[side*30,y-40,z],[side*104,y,44],[side*30,y+36,z]],'#b2d5e3',.75,2);
      line([[side*40,y-20,69],[side*102,y,44]],AMBER,.8,2);
      for(let i=0;i<10;i++) line([[side*(37+i%2*5),y-20+i*4,62],[side*(42-i%2*5),y-16+i*4,62]],CYAN,.6);
    }
    // Radiator fins in the transparent side pods.
    box(side*57,35,29,23,90,24);
    for(let i=0;i<16;i++) line([[side*47,-6+i*5,54],[side*69,-6+i*5,54]],CYAN,.45);
  }
  // Hybrid battery behind the monocoque and V-shaped engine banks.
  box(0,32,25,45,65,18,true);
  for(let i=0;i<7;i++) line([[-18,6+i*8,44],[18,6+i*8,44]],AMBER,.65);
  for(const side of [-1,1]) {
    box(side*17,106,42,25,71,31,true);
    for(let i=0;i<6;i++) box(side*20,78+i*11,74,18,7,6,true);
    line([[side*28,90,58],[side*48,123,48],[side*26,165,46],[side*12,190,52]],AMBER,.9,3);
    line([[side*54,28,47],[side*72,65,40],[side*37,115,37]],CYAN,.9,2);
  }
  box(0,177,25,32,56,27);
  tube(0,161,64,18,AMBER);
  // Cockpit opening, seat and halo: a real opening rather than a solid top slab.
  const cockpit:Point[]=Array.from({length:49},(_,i)=>[Math.cos(i/48*Math.PI*2)*29,-62+Math.sin(i/48*Math.PI*2)*43,64]);
  face(cockpit,'rgba(0,10,18,.88)');
  box(0,-49,40,24,30,12);
  line([[-26,-91,67],[-31,-70,90],[-26,-33,93],[0,-20,100],[26,-33,93],[31,-70,90],[26,-91,67]],'#b3e7fa',.9,4);
  line([[0,-110,63],[0,-95,87],[0,-20,100]],CYAN,.9,3);
  // Intake above the driver's head.
  face([[-15,-10,68],[-12,5,114],[12,5,114],[15,-10,68]],'rgba(136,195,222,.18)');
  box(0,13,89,23,25,18);
  // Multi-element front and rear wings, end plates.
  for(let i=0;i<4;i++) box(0,-278+i*10,18+i*3,205-i*9,8,3);
  for(const side of [-1,1]) face([[side*106,-289,16],[side*106,-242,16],[side*106,-245,49],[side*106,-286,43]],'rgba(134,199,225,.16)');
  for(const x of [-34,34]) box(x,220,25,5,14,73);
  for(let i=0;i<3;i++) box(0,221+i*12,101+i*4,161,10,5);
  for(const side of [-1,1]) face([[side*84,210,65],[side*84,258,65],[side*84,258,127],[side*84,210,117]],'rgba(141,204,233,.19)');
  wheel(103,-176);wheel(111,174);
  const focusPoints:Point[]=[[0,-267,27],[0,32,44],[0,106,76],[75,-176,45],[120,174,44]];
  const focus=raceProject(focusPoints[state.system]);
  ctx.globalAlpha=state.presence*(.45+Math.sin(state.time*2)*.08);
  ctx.beginPath();ctx.ellipse(focus.x,focus.y,37,24,-.4,0,Math.PI*2);
  ctx.strokeStyle=state.system===1||state.system===2?AMBER:CYAN;ctx.lineWidth=1;ctx.setLineDash([3,5]);ctx.stroke();ctx.setLineDash([]);
  // Streamlines travel along the complete body using the common seekable clock.
  for(let stream=0;stream<12;stream++) {
    const offset=(stream-5.5)*16;
    const points:Point[]=Array.from({length:70},(_,i)=>{
      const y=-355+i*10;
      const bow=Math.sin((y+355)/690*Math.PI)*26;
      return [offset+Math.sign(offset)*bow,y,24+Math.sin((y+355)/690*Math.PI)*(stream%3*9+15)];
    });
    const color=stream<6?CYAN:AMBER;
    line(points,color,.18,1);
    const start=Math.floor(((state.time*.23+stream*.09)%1)*60);
    line(points.slice(start,start+9),color,.7,1.6);
  }
  ctx.restore();
}
