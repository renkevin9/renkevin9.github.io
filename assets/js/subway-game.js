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
  function rounded(x, y, w, h, r, color) {
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y);
    ctx.quadraticCurveTo(x+w,y,x+w,y+r); ctx.lineTo(x+w,y+h-r);
    ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h); ctx.lineTo(x+r,y+h);
    ctx.quadraticCurveTo(x,y+h,x,y+h-r); ctx.lineTo(x,y+r);
    ctx.quadraticCurveTo(x,y,x+r,y); ctx.fill();
  }
  function background() {
    var sky=ctx.createLinearGradient(0,0,0,245); sky.addColorStop(0,'#36aad0'); sky.addColorStop(.65,'#a6e5e9'); sky.addColorStop(1,'#ffe3a7');
    rect(0,0,360,480,sky); circle(280,60,29,'#fff1b6');
    [[0,95,48,120,'#f6bd8c'],[42,66,44,145,'#ffcc95'],[85,94,45,116,'#eb9e88'],[231,87,43,120,'#f5bb8c'],[272,55,47,155,'#ffcf95'],[318,80,42,130,'#eaa291']].forEach(function(b) {
      rect(b[0],b[1],b[2],b[3],b[4]); rect(b[0]-3,b[1]-5,b[2]+6,6,'#b77970');
      for(var x=b[0]+7;x<b[0]+b[2]-5;x+=13) for(var y=b[1]+12;y<143;y+=20) {rect(x,y,7,10,'#fff0be');rect(x+3,y,1,10,'#dcaa8c');}
    });
    // Converging walls, rails, and sleepers create a fast-moving train yard.
    polygon([[0,153],[132,143],[0,480]],'#c7795d'); polygon([[228,143],[360,153],[360,480]],'#c77a60');
    polygon([[0,190],[124,153],[0,370]],'#de9071'); polygon([[236,153],[360,190],[360,370]],'#e59a73');
    ctx.save(); ctx.globalAlpha=.7; ctx.lineWidth=7; ctx.strokeStyle='#50bec0'; ctx.beginPath(); ctx.moveTo(0,250); ctx.bezierCurveTo(48,205,62,275,104,172); ctx.stroke();
    ctx.strokeStyle='#f5ca52'; ctx.beginPath(); ctx.moveTo(255,175); ctx.bezierCurveTo(305,270,323,189,360,244); ctx.stroke(); ctx.restore();
    polygon([[124,143],[236,143],[360,480],[0,480]],'#455760');
    polygon([[133,145],[227,145],[340,480],[20,480]],'#8d8d82');
    polygon([[135,145],[147,145],[76,480],[20,480]],'#a5a095'); polygon([[213,145],[225,145],[340,480],[284,480]],'#a5a095');
    for(var i=0;i<17;i++) {
      var z=((i/17+distance*.0007)%1), p=project(1,z), width=38+(1-z)*260;
      rect(180-width/2,p.y,width,2+(1-z)*8,'#66564f'); rect(180-width/2,p.y,width,1+(1-z)*2,'#b49b83');
    }
    [-.5,.5,1.5,2.5].forEach(function(l) {
      var a=project(l,1), b=project(l,0); polygon([[a.x-1,a.y],[a.x+1,a.y],[b.x+4,b.y],[b.x-4,b.y]],'#444f54');
      polygon([[a.x-.5,a.y],[a.x+.5,a.y],[b.x+1,b.y],[b.x-1,b.y]],'#e2dfce');
    });
    // A train near the horizon anchors the scene before the first obstacle arrives.
    var distant={lane:0,z:.94,type:'train'}; drawObject(distant);
  }
  function drawObject(o) {
    var p=project(o.lane,o.z), s=p.s, x=p.x, y=p.y;
    if (o.type === 'coin') {
      circle(x,y-42*s,14*s,'#f4aa27'); circle(x,y-42*s,10*s,'#ffdd62'); rect(x-2*s,y-49*s,4*s,14*s,'#f1a835');
    } else if (o.type === 'train') {
      var w=80*s,h=132*s;
      rounded(x-w/2+5*s,y-h+5*s,w,h,12*s,'#37505d');
      rounded(x-w/2,y-h,w,h,12*s,'#f5d87c');
      rounded(x-w/2+4*s,y-h+5*s,w-8*s,h-10*s,9*s,'#e9504b');
      rect(x-w/2+5*s,y-h+55*s,w-10*s,39*s,'#f3cb69');
      rounded(x-w/2+9*s,y-h+14*s,w-18*s,38*s,6*s,'#263f55');
      polygon([[x-w/2+13*s,y-h+18*s],[x+w/2-13*s,y-h+18*s],[x+w/2-19*s,y-h+43*s],[x-w/2+13*s,y-h+43*s]],'#75bed1');
      rect(x-2*s,y-h+14*s,4*s,38*s,'#e9504b');
      rounded(x-19*s,y-h+68*s,38*s,13*s,5*s,'#e96864');
      rect(x-w/2+8*s,y-29*s,w-16*s,5*s,'#d65049');
      circle(x-w/2+15*s,y-13*s,6*s,'#fdf1b0'); circle(x+w/2-15*s,y-13*s,6*s,'#fdf1b0');
      rect(x-17*s,y-8*s,34*s,7*s,'#374850');
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
    ctx.fillStyle='rgba(25,42,50,.3)'; ctx.beginPath(); ctx.ellipse(x,450,29,8,0,0,Math.PI*2); ctx.fill();
    var stride=state==='playing'?Math.sin(distance*.1)*7:0;
    ctx.save(); ctx.translate(x,y);
    // A cap, hoodie, backpack and sneakers give the runner a bright silhouette.
    polygon([[-14,-31],[-1,-31],[-4,1+stride],[-18,3+stride]],'#315f92');
    polygon([[2,-31],[15,-31],[19,3-stride],[5,1-stride]],'#3d78ae');
    rounded(-20,1+stride,19,8,3,'#f9f4e2'); rounded(4,1-stride,19,8,3,'#f9f4e2');
    rect(-19,5+stride,17,3,'#e84e46'); rect(5,5-stride,17,3,'#e84e46');
    polygon([[-18,-69],[-29,-49],[-25,-38],[-12,-54]],'#f3b28b');
    polygon([[18,-69],[29,-49],[25,-38],[12,-54]],'#f3b28b');
    rounded(-21,-72,42,43,10,'#f6f3db'); rect(-21,-58,42,7,'#e65a4c');
    rounded(-15,-69,30,33,7,'#bd433e'); rounded(-12,-66,24,25,5,'#f27e5e');
    rect(-9,-55,18,3,'#ffd474');
    circle(0,-82,14,'#d79572'); rounded(-15,-95,30,12,5,'#f2b447');
    rect(-17,-88,34,6,'#e85a4d'); rect(-12,-96,24,4,'#f7d779');
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
    state='over'; overlay.hidden=false; start.setAttribute('aria-label', 'Play again');
    status.textContent='Game over. You scored '+Math.floor(distance/10)+' points and collected '+coins+' coins.';
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
    if (state === 'playing') { state='paused'; cancelAnimationFrame(frame); start.setAttribute('aria-label', 'Resume game'); overlay.hidden=false; status.textContent='Game paused.'; }
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
      var max = window.innerWidth - 24;
      panel.style.width = Math.max(min, Math.min(max, panel.offsetWidth + Number(button.getAttribute('data-runner-width')) * 40)) + 'px';
    });
  });
  function resizePanel(width, height) {
    var maxWidth = Math.max(1, window.innerWidth - 24);
    var maxHeight = Math.max(1, window.innerHeight - panel.getBoundingClientRect().top - 12);
    panel.style.width = Math.max(Math.min(240, maxWidth), Math.min(maxWidth, width)) + 'px';
    panel.style.height = Math.max(Math.min(370, maxHeight), Math.min(maxHeight, height)) + 'px';
  }
  panel.querySelectorAll('.runner__resize').forEach(function (handle) {
    var resizing;
    handle.addEventListener('pointerdown', function (event) {
      if (event.button !== 0) return;
      var bounds = panel.getBoundingClientRect();
      resizing = { x: event.clientX, y: event.clientY, width: bounds.width, height: bounds.height };
      handle.setPointerCapture(event.pointerId);
      event.preventDefault();
    });
    handle.addEventListener('pointermove', function (event) {
      if (!resizing) return;
      var horizontal = !handle.classList.contains('runner__resize--bottom');
      var vertical = !handle.classList.contains('runner__resize--left');
      resizePanel(resizing.width + (horizontal ? resizing.x - event.clientX : 0), resizing.height + (vertical ? event.clientY - resizing.y : 0));
    });
    handle.addEventListener('pointerup', function () { resizing = null; });
    handle.addEventListener('pointercancel', function () { resizing = null; });
    handle.addEventListener('keydown', function (event) {
      var bounds = panel.getBoundingClientRect(), dx = 0, dy = 0;
      if (handle.classList.contains('runner__resize--left')) {
        if (event.key === 'ArrowLeft') dx = 20;
        if (event.key === 'ArrowRight') dx = -20;
      } else {
        if (event.key === 'ArrowDown') dy = 20;
        if (event.key === 'ArrowUp') dy = -20;
      }
      if (dx || dy) { event.preventDefault(); event.stopPropagation(); resizePanel(bounds.width + dx, bounds.height + dy); }
    });
  });
  window.addEventListener('resize', function () {
    if (!panel.hidden) { var bounds = panel.getBoundingClientRect(); resizePanel(bounds.width, bounds.height); }
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
