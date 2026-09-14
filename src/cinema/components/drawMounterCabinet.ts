/** Front elevation based on the supplied white cabinet / black inspection hood reference. */
export function drawMounterCabinet(ctx: CanvasRenderingContext2D, time: number, index: number) {
  const rect = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color; ctx.fillRect(x, y, w, h);
  };
  const metal = ctx.createLinearGradient(-145, 0, 145, 0);
  metal.addColorStop(0, '#a6adb0'); metal.addColorStop(.12, '#eef0ec');
  metal.addColorStop(.58, '#d9ddd9'); metal.addColorStop(1, '#969fa2');
  ctx.fillStyle = 'rgba(0,0,0,.35)';
  ctx.beginPath(); ctx.ellipse(0, 147, 157, 13, 0, 0, Math.PI * 2); ctx.fill();
  // Cabinet feet and continuous sheet-metal shell.
  rect(-132, 131, 28, 16, '#242a2d'); rect(105, 131, 28, 16, '#242a2d');
  ctx.fillStyle = metal; ctx.fillRect(-146, -125, 292, 262);
  rect(-145, -124, 290, 3, '#f8faf5');
  rect(-146, -122, 33, 255, '#daddd9'); rect(-145, 36, 31, 2, '#929a9c');
  rect(-140, 48, 20, 29, '#bbc2bf'); rect(-136, 55, 12, 4, '#596363');
  rect(-139, 100, 9, 13, '#2e3638');
  // Broad black hood, inset glass and the thin red safety stripe.
  rect(-108, -129, 219, 109, '#131719'); rect(-104, -125, 211, 5, '#515957');
  rect(-99, -108, 201, 78, '#080d0f');
  rect(-87, -91, 175, 5, '#616c6b'); rect(-87, -61, 175, 3, '#414c4e');
  const head = Math.sin(time * .75 + index * .8) * 45;
  rect(head - 27, -92, 54, 29, '#3b4748'); rect(head - 20, -88, 40, 17, '#687373');
  for (let n = 0; n < 6; n++) rect(head - 21 + n * 8, -63, 3, 15, '#9ba6a2');
  ctx.strokeStyle = '#4b5452'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-64, -90); ctx.bezierCurveTo(-80, -111, 59, -110, 64, -90); ctx.stroke();
  const glass = ctx.createLinearGradient(-100, -110, 100, -25);
  glass.addColorStop(0, 'rgba(194,219,221,.15)'); glass.addColorStop(.45, 'rgba(15,20,24,.06)');
  glass.addColorStop(.5, 'rgba(216,233,230,.08)'); glass.addColorStop(1, 'rgba(0,0,0,.38)');
  ctx.fillStyle = glass; ctx.fillRect(-99, -108, 201, 78);
  rect(-109, -23, 221, 4, '#c23927'); rect(-109, -19, 221, 3, '#3c1714');
  // Exposed feeder bank with tape guides, reel hubs and hanging handles.
  rect(-109, -13, 221, 49, '#454e4e'); rect(-106, -10, 215, 4, '#b9c0bb');
  for (let n = 0; n < 22; n++) {
    const x = -102 + n * 9.5;
    rect(x, -5, 7, 33, n % 3 ? '#b9bfba' : '#8a9693');
    rect(x + 2, -3, 2, 26, '#3b4645'); rect(x, 9, 7, 3, '#e8ebe0');
    ctx.beginPath(); ctx.arc(x + 3.5, 23, 3, 0, Math.PI * 2); ctx.fillStyle = '#48534f'; ctx.fill();
  }
  for (const x of [-72, -56, -29]) {
    rect(x, -6, 5, 61, '#262e2e'); rect(x + 1, 0, 2, 40, '#9ca8a2');
  }
  rect(-110, 34, 223, 5, '#eef0e8');
  // Lower access doors, recessed handle, ventilation and caution labels.
  ctx.strokeStyle = '#a4adaa'; ctx.lineWidth = .8; ctx.strokeRect(-110, 41, 219, 91);
  rect(-21, 48, 22, 10, '#242c2b'); rect(-18, 50, 16, 3, '#6f7771');
  rect(-67, 66, 20, 21, '#424b46'); rect(-64, 70, 14, 3, '#637368');
  rect(-63, 81, 5, 3, '#d56943');
  for (let n = 0; n < 5; n++) rect(26, 68 + n * 4, 23, 1, '#59645d');
  for (const x of [-61, -14, 54]) {
    ctx.beginPath(); ctx.moveTo(x, 102); ctx.lineTo(x - 5, 111); ctx.lineTo(x + 5, 111);
    ctx.closePath(); ctx.fillStyle = '#d9bd42'; ctx.fill(); rect(x - .5, 105, 1, 3, '#454222');
  }
  // Right operator column, remote monitor, shelf and pendant cable.
  rect(113, -123, 33, 258, '#e6e9e3'); rect(112, -123, 1, 258, '#8a9591');
  rect(124, -130, 6, -32, '#c5ccc6');
  rect(109, -164, 65, 44, '#69716f'); rect(112, -161, 59, 37, '#090d11');
  ctx.fillStyle = 'rgba(144,167,177,.15)'; ctx.beginPath(); ctx.moveTo(113, -160); ctx.lineTo(170, -160); ctx.lineTo(113, -127); ctx.fill();
  rect(123, -95, 16, 32, '#768780');
  for (const [y, color] of [[-89, '#e45844'], [-79, '#e6ba42'], [-69, '#57a99b']] as const) {
    ctx.beginPath(); ctx.arc(131, y, 3.2, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
  }
  rect(115, -22, 47, 7, '#f1f2ea'); rect(125, -14, 6, 15, '#9da8a1');
  rect(133, 16, 7, 34, '#626d67'); rect(134, 18, 5, 13, '#222f2b');
  ctx.strokeStyle = '#444e49'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(137, 50); ctx.bezierCurveTo(122, 77, 155, 98, 133, 111); ctx.stroke();
  // Signal tower above the left side of the hood.
  rect(-92, -157, 3, 28, '#9aa59e'); rect(-94, -174, 7, 17, '#b5bdb3');
  rect(-93, -172, 5, 5, '#6dbf8f'); rect(-93, -166, 5, 4, '#d8c578');
}
