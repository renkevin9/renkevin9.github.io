(function () {
  'use strict';
  var canvas = document.getElementById('runner-canvas');
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');
  if (!ctx) return;
  var panel = document.getElementById('runner-window');
  var toggle = document.getElementById('runner-toggle');
  var close = document.getElementById('runner-close');
  var overlay = document.getElementById('runner-overlay');
  var start = document.getElementById('runner-start');
  var message = document.getElementById('runner-message');
  var detail = document.getElementById('runner-detail');
  var scoreEl = document.getElementById('runner-score');
  var coinsEl = document.getElementById('runner-coins');
  var status = document.getElementById('runner-status');
  var state = 'ready', lane = 1, playerX = 1, jump = 0, jumpSpeed = 0;
  var objects = [], distance = 0, coins = 0, spawn = 0, last = 0, frame = 0;

  function rect(x, y, w, h, color) { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); }
  function polygon(points, color) {
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(points[0][0], points[0][1]);
    points.slice(1).forEach(function (p) { ctx.lineTo(p[0], p[1]); });
    ctx.closePath(); ctx.fill();
  }
  function circle(x, y, r, color) { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
  function project(l, z) {
    var t = Math.max(0, Math.min(1, 1 - z));
    var scale = .12 + t * .88;
    return { x: 180 + (l - 1) * 95 * scale, y: 141 + t * t * 313, s: scale };
  }
  function background() {
    var sky = ctx.createLinearGradient(0, 0, 0, 300); sky.addColorStop(0, '#83c9dc'); sky.addColorStop(1, '#f9d7ae');
    rect(0, 0, 360, 480, sky);
    circle(284, 68, 28, '#ffe7a0');
    // Pastel rooftops frame the tracks and give the scene a city skyline.
    [[0,92,48,120,'#de9e85'],[42,65,48,145,'#e6af92'],[87,100,35,110,'#cc8f84'],[238,91,40,120,'#d9a090'],[272,61,42,150,'#e8b398'],[312,87,48,120,'#c78f87']].forEach(function (b) {
      rect(b[0],b[1],b[2],b[3],b[4]); rect(b[0]-3,b[1]-5,b[2]+6,6,'#a77875');
      for (var x=b[0]+8; x<b[0]+b[2]-5; x+=14) for (var y=b[1]+13; y<145; y+=22) rect(x,y,6,9,'#ffe1bb');
    });
    polygon([[0,145],[360,145],[360,480],[0,480]], '#b9a18f');
    polygon([[135,145],[225,145],[360,480],[0,480]], '#6d7779');
    polygon([[143,145],[217,145],[327,480],[33,480]], '#8a8e89');
    for (var i=0; i<14; i++) {
      var z = ((i / 14 + distance * .00065) % 1), p = project(1,z), width = 37 + (1-z)*250;
      rect(180-width/2,p.y,width,2+(1-z)*7,'#6d625d');
    }
    [-.5,.5,1.5,2.5].forEach(function(l) {
      var a=project(l,1), b=project(l,0); polygon([[a.x-1,a.y],[a.x+1,a.y],[b.x+3,b.y],[b.x-3,b.y]], '#d2cbc0');
    });
  }
  function drawObject(o) {
    var p=project(o.lane,o.z), s=p.s, x=p.x, y=p.y;
    if (o.type === 'coin') {
      circle(x,y-42*s,14*s,'#f4aa27'); circle(x,y-42*s,10*s,'#ffdd62'); rect(x-2*s,y-49*s,4*s,14*s,'#f1a835');
    } else if (o.type === 'train') {
      var w=74*s,h=122*s;
      rect(x-w/2+4*s,y-h+5*s,w,h,'#8a4e4e');
      rect(x-w/2,y-h,w,h,'#e76d5b'); rect(x-w/2+5*s,y-h+9*s,w-10*s,38*s,'#f6c69c');
      rect(x-w/2+10*s,y-h+13*s,w-20*s,27*s,'#568c99'); rect(x-w/2+6*s,y-34*s,w-12*s,8*s,'#f4c4a0');
      circle(x-w/2+13*s,y-13*s,5*s,'#ffe4a2'); circle(x+w/2-13*s,y-13*s,5*s,'#ffe4a2');
    } else {
      rect(x-36*s,y-45*s,72*s,38*s,'#f3eee1');
      polygon([[x-36*s,y-45*s],[x-15*s,y-45*s],[x-36*s,y-24*s]],'#ed765b');
      polygon([[x-4*s,y-45*s],[x+17*s,y-45*s],[x-21*s,y-7*s],[x-36*s,y-7*s],[x-36*s,y-13*s]],'#ed765b');
      polygon([[x+28*s,y-45*s],[x+36*s,y-45*s],[x+36*s,y-32*s],[x+11*s,y-7*s],[x-10*s,y-7*s]],'#ed765b');
      rect(x-32*s,y-7*s,8*s,10*s,'#514c4b'); rect(x+24*s,y-7*s,8*s,10*s,'#514c4b');
    }
  }
  function player() {
    var x=project(playerX,0).x, y=432-jump;
    ctx.fillStyle='rgba(31,44,47,.25)'; ctx.beginPath(); ctx.ellipse(x,447,26,8,0,0,Math.PI*2); ctx.fill();
    var stride = state === 'playing' ? Math.sin(distance*.08)*7 : 0;
    ctx.save(); ctx.translate(x,y);
    // The runner is drawn from behind, looking down the tracks.
    polygon([[-14,-27],[-1,-27],[-3,0],[-16,4]], '#344c69'); polygon([[2,-27],[15,-27],[18,3],[5,0]], '#405a78');
    rect(-18,1+stride,17,7,'#f3e8d9'); rect(4,1-stride,17,7,'#f3e8d9');
    polygon([[-19,-69],[18,-69],[23,-28],[-22,-28]], '#f3f1e5');
    polygon([[-18,-67],[-29,-46],[-24,-39],[-12,-53]], '#d58c70'); polygon([[18,-67],[29,-48],[24,-41],[12,-53]], '#d58c70');
    rect(-13,-67,26,30,'#e05b4e'); rect(-10,-63,20,20,'#f17d62');
    circle(0,-80,14,'#c9876e'); rect(-14,-91,28,10,'#3b5963'); rect(-17,-85,34,5,'#f8c85b');
    ctx.restore();
  }
  function draw() { background(); objects.slice().sort(function(a,b){return b.z-a.z;}).forEach(drawObject); player(); }
  function addRow() {
    var blocked = Math.floor(Math.random()*3);
    objects.push({lane:blocked,z:1,type:Math.random()<.55?'train':'barrier'});
    var free = (blocked + 1 + Math.floor(Math.random()*2)) % 3;
    objects.push({lane:free,z:1,type:'coin'});
  }
  function finish() {
    state='over'; overlay.hidden=false; message.textContent='Nice run!';
    detail.textContent='You scored '+Math.floor(distance/10)+' points and collected '+coins+' coins.';
    start.textContent='Run again →'; status.textContent='Game over. '+detail.textContent;
  }
  function tick(time) {
    if (state !== 'playing') return;
    var dt = Math.min((time-last)/1000 || 0, .04); last=time;
    var speed = Math.min(.30, .19+distance/150000);
    distance += dt*100; spawn -= dt;
    if (spawn <= 0) { addRow(); spawn = 1.4; }
    playerX += (lane-playerX)*Math.min(1,dt*12);
    if (jump > 0 || jumpSpeed > 0) { jump += jumpSpeed*dt; jumpSpeed -= 780*dt; if (jump<0) {jump=0;jumpSpeed=0;} }
    objects.forEach(function(o) {
      o.z -= speed*dt;
      if (!o.checked && o.z < .12) {
        o.checked=true;
        if (o.lane === lane) {
          if (o.type === 'coin') coins++;
          else if (o.type === 'train' || jump < 45) finish();
        }
      }
    });
    objects=objects.filter(function(o){return o.z>-.05;});
    scoreEl.textContent=Math.floor(distance/10); coinsEl.textContent=coins;
    draw(); if (state === 'playing') frame=requestAnimationFrame(tick);
  }
  function begin() {
    lane=1; playerX=1; jump=0; jumpSpeed=0; objects=[]; distance=0; coins=0; spawn=1; last=0;
    scoreEl.textContent='0'; coinsEl.textContent='0'; overlay.hidden=true; state='playing'; status.textContent='Game started.';
    frame=requestAnimationFrame(tick);
  }
  function pause() {
    if (state === 'playing') { state='paused'; cancelAnimationFrame(frame); message.textContent='Taking a breather?'; detail.textContent='Your run is paused.'; start.textContent='Keep running →'; overlay.hidden=false; status.textContent='Game paused.'; }
    else if (state === 'paused') { overlay.hidden=true; state='playing'; last=0; status.textContent='Game resumed.'; frame=requestAnimationFrame(tick); }
  }
  function action(a) {
    if (a==='pause') { pause(); return; }
    if (state!=='playing') return;
    if (a==='left') lane=Math.max(0,lane-1);
    if (a==='right') lane=Math.min(2,lane+1);
    if (a==='jump' && jump===0) jumpSpeed=420;
  }
  function setOpen(open) {
    if (!open && state === 'playing') pause();
    panel.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', (open ? 'Close' : 'Open') + ' Subway dash');
    if (open) start.focus(); else toggle.focus();
  }
  toggle.addEventListener('click', function () { setOpen(panel.hidden); });
  close.addEventListener('click', function () { setOpen(false); });
  panel.querySelectorAll('[data-runner-width]').forEach(function (button) {
    button.addEventListener('click', function () {
      var min = Math.min(240, window.innerWidth - 24);
      var max = Math.min(520, window.innerWidth - 24);
      panel.style.width = Math.max(min, Math.min(max, panel.offsetWidth + Number(button.getAttribute('data-runner-width')) * 40)) + 'px';
    });
  });
  start.addEventListener('click',function(){ if(state==='paused') pause(); else begin(); });
  document.querySelectorAll('[data-runner-action]').forEach(function(button){button.addEventListener('click',function(){action(button.getAttribute('data-runner-action'));});});
  document.addEventListener('keydown',function(e){
    if (state!=='playing') return;
    var keys={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'jump',' ':'jump',Escape:'pause'};
    if (keys[e.key] && !/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) && !e.target.isContentEditable) { e.preventDefault(); if(!e.repeat) action(keys[e.key]); }
  });
  document.addEventListener('visibilitychange',function(){if(document.hidden && state==='playing') pause();});
  draw();
}());
