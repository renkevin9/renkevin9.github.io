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
  var gameOver = document.getElementById('runner-game-over');
  var powerEl = document.getElementById('runner-power');
  var state = 'ready', lane = 1, playerX = 1, jump = 0, jumpSpeed = 0;
  var objects = [], distance = 0, coins = 0, spawn = 0, last = 0, frame = 0;
  var slide = 0, shoes = 0, shoeCooldown = 0, roof = null, jumpFromRoof = false;

  function rect(x, y, w, h, color) { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); }
  function polygon(points, color) {
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(points[0][0], points[0][1]);
    points.slice(1).forEach(function (p) { ctx.lineTo(p[0], p[1]); });
    ctx.closePath(); ctx.fill();
  }
  function circle(x, y, r, color) { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
  function project(l, z) {
    var t = Math.max(0, Math.min(1.4, 1 - z));
    var scale = .12 + t * .88;
    return { x: 180 + (l - 1) * 95 * scale, y: 141 + Math.pow(t, 1.4) * 313, s: scale };
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
    } else if (o.type === 'shoes') {
      // Two oversized sneakers, drawn as objects rather than a power-up badge.
      ctx.save(); ctx.translate(x,y-29*s);
      function sneaker(dx, dy) {
        polygon([[dx-18*s,dy-13*s],[dx-7*s,dy-14*s],[dx-3*s,dy-8*s],[dx+13*s,dy-4*s],[dx+17*s,dy+2*s],[dx-19*s,dy+2*s]],'#ed6945');
        rounded(dx-20*s,dy,39*s,7*s,3*s,'#fff1d8');
        rect(dx-9*s,dy-13*s,9*s,5*s,'#f9b263');
        rect(dx-5*s,dy-8*s,11*s,2*s,'#fff3dc'); rect(dx-7*s,dy-5*s,11*s,2*s,'#fff3dc');
      }
      sneaker(-7*s,-5*s); sneaker(7*s,5*s); ctx.restore();
    } else if (o.type === 'overhead') {
      var overFar=project(o.lane,Math.min(1,o.z+.035));
      polygon([[x-42*s,y-100*s],[overFar.x-42*overFar.s,overFar.y-100*overFar.s],[overFar.x+42*overFar.s,overFar.y-100*overFar.s],[x+42*s,y-100*s]],'#c8bca7');
      polygon([[x+42*s,y-100*s],[overFar.x+42*overFar.s,overFar.y-100*overFar.s],[overFar.x+42*overFar.s,overFar.y-65*overFar.s],[x+42*s,y-65*s]],'#b84e49');
      rect(x-38*s,y-100*s,8*s,100*s,'#658089'); rect(x+30*s,y-100*s,8*s,100*s,'#658089');
      rounded(x-42*s,y-100*s,84*s,35*s,4*s,'#f4e9cf');
      for(var stripe=0;stripe<4;stripe++) polygon([[x+(-42+stripe*24)*s,y-100*s],[x+(-30+stripe*24)*s,y-100*s],[x+(-42+stripe*24)*s,y-65*s],[x+(-42+stripe*24)*s,y-78*s]],'#e75b50');
    } else if (o.type === 'train' || o.type === 'ramp' || o.type === 'tall') {
      var w=80*s,h=132*s;
      // Draw the length of the car toward the vanishing point before its near end.
      var far = project(o.lane, Math.min(1, o.z + .38));
      var farW=80*far.s, farH=132*far.s;
      var nearLeft=x-w/2, nearRight=x+w/2, farLeft=far.x-farW/2, farRight=far.x+farW/2;
      polygon([[nearLeft,y-h],[farLeft,far.y-farH],[farLeft,far.y],[nearLeft,y]],'#b74743');
      polygon([[nearRight,y-h],[farRight,far.y-farH],[farRight,far.y],[nearRight,y]],'#b74743');
      polygon([[nearLeft,y-h],[farLeft,far.y-farH],[farRight,far.y-farH],[nearRight,y-h]],'#eecb79');
      for (var seam=1;seam<4;seam++) {
        var t=seam/4, leftX=nearLeft+(farLeft-nearLeft)*t, rightX=nearRight+(farRight-nearRight)*t;
        var seamY=y-h+(far.y-farH-(y-h))*t;
        polygon([[leftX,seamY],[rightX,seamY],[rightX,seamY+2*s],[leftX,seamY+2*s]],'#c9a865');
      }
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
      if (o.type === 'ramp') { polygon([[x-34*s,y-2*s],[x+34*s,y-2*s],[x+18*s,y-59*s],[x-18*s,y-59*s]],'#d6a45d'); for (var step=0;step<4;step++) rect(x-(31-step*3)*s,y-(10+step*12)*s,(62-step*6)*s,3*s,'#f8db9a'); }
      if (o.type === 'tall') { rect(x-28*s,y-h-8*s,56*s,9*s,'#578ba6'); rect(x-13*s,y-h-17*s,26*s,9*s,'#578ba6'); }
    } else {
      var barrierFar=project(o.lane,Math.min(1,o.z+.04));
      polygon([[x-36*s,y-45*s],[barrierFar.x-36*barrierFar.s,barrierFar.y-45*barrierFar.s],[barrierFar.x+36*barrierFar.s,barrierFar.y-45*barrierFar.s],[x+36*s,y-45*s]],'#d1c4ae');
      polygon([[x+36*s,y-45*s],[barrierFar.x+36*barrierFar.s,barrierFar.y-45*barrierFar.s],[barrierFar.x+36*barrierFar.s,barrierFar.y-7*barrierFar.s],[x+36*s,y-7*s]],'#b94b43');
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
    if (slide>0 && !roof) { ctx.translate(0,-4); ctx.scale(1.25,.42); }
    // A cap, hoodie, backpack and sneakers give the runner a bright silhouette.
    polygon([[-14,-31],[-1,-31],[-4,1+stride],[-18,3+stride]],'#315f92');
    polygon([[2,-31],[15,-31],[19,3-stride],[5,1-stride]],'#3d78ae');
    rounded(-20,1+stride,19,8,3,'#f9f4e2'); rounded(4,1-stride,19,8,3,'#f9f4e2');
    rect(-19,5+stride,17,3,'#e84e46'); rect(5,5-stride,17,3,'#e84e46');
    if (shoes>0) { rounded(-24,-3+stride,23,12,4,'#ff9f3d'); rounded(4,-3-stride,23,12,4,'#ff9f3d'); }
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
    var types = ['train','barrier','overhead','ramp','tall'];
    objects.push({lane:blocked,z:1,type:types[Math.floor(Math.random()*types.length)]});
    var free = (blocked + 1 + Math.floor(Math.random()*2)) % 3;
    var roll = Math.random();
    var spawnShoes = roll < .03 && shoes <= 0 && shoeCooldown <= 0;
    if (spawnShoes) shoeCooldown=15;
    objects.push({lane:free,z:1,type:spawnShoes ? 'shoes' : 'coin'});
  }
  function finish() {
    state='over'; overlay.hidden=false; gameOver.hidden=false; start.setAttribute('aria-label', 'Play again');
    status.textContent='Game over. You scored '+Math.floor(distance/10)+' points and collected '+coins+' coins.';
  }
  function isCar(object) { return object.type === 'train' || object.type === 'ramp' || object.type === 'tall'; }
  function underRunner(object) {
    return isCar(object) && object.lane === lane && Math.abs(playerX-lane) < .4 && object.z <= .12 && object.z > -.38;
  }
  function landOn(car) {
    roof=car; jump=90; jumpSpeed=0; jumpFromRoof=false; slide=0;
    status.textContent='On the train roof.';
  }
  function tick(time) {
    if (state !== 'playing') return;
    var dt = Math.min((time-last)/1000 || 0, .04); last=time;
    var speed = Math.min(.30, .19+distance/150000);
    distance += dt*100; spawn -= dt;
    if (spawn <= 0) { addRow(); spawn = Math.max(.9, 1.4 * .19 / speed); }
    slide = Math.max(0, slide-dt); shoes = Math.max(0, shoes-dt); shoeCooldown = Math.max(0, shoeCooldown-dt);
    powerEl.hidden = !shoes;
    powerEl.textContent = shoes > 0 ? "👟 " + Math.ceil(shoes) : "";
    playerX += (lane-playerX)*Math.min(1,dt*12);
    objects.forEach(function(o) { o.z -= speed*dt; });

    // Roofs are physical surfaces: jumping keeps the takeoff height, and
    // landing is possible only while a car is underneath the runner.
    if (roof && !underRunner(roof)) { roof=null; jumpSpeed=0; jumpFromRoof=true; }
    if (!roof && (jump > 0 || jumpSpeed > 0)) {
      var oldHeight=jump;
      jump += jumpSpeed*dt; jumpSpeed -= 780*dt;
      if (jumpSpeed < 0 && oldHeight >= 90 && jump <= 90) {
        var landing=objects.find(function(o) {
          return underRunner(o) && (o.type !== 'tall' || shoes > 0 || jumpFromRoof);
        });
        if (landing) landOn(landing);
      }
      if (!roof && jump <= 0 && jumpSpeed <= 0) { jump=0; jumpSpeed=0; jumpFromRoof=false; }
    }
    // Prefer a ramp surface when cars overlap so its body cannot cause a false collision.
    if (!roof && jump < 90) {
      var ramp=objects.find(function(o) { return o.type === 'ramp' && underRunner(o); });
      if (ramp) landOn(ramp);
    }
    objects.forEach(function(o) {
      if (state !== 'playing') return;
      if (isCar(o)) {
        if (!underRunner(o) || roof === o) return;
        if (jump >= 90) {
          // A tall car cannot be reached from the ground without sneakers.
          if (o.type === 'tall' && !jumpFromRoof && !shoes && !roof) finish();
          return;
        }
        // The ramp is a traversable slope, including while jumping or entering from the side.
        if (o.type === 'ramp') landOn(o);
        else finish();
        return;
      }
      if (!o.checked && o.z < .12) {
        o.checked=true;
        if (o.lane !== lane) return;
        if (o.type === 'coin') { if (jump < 25) coins++; }
        else if (o.type === 'shoes') { if (jump < 25) { shoes=12; status.textContent='Super sneakers activated.'; } }
        else if (jump >= 90) return;
        else if (o.type === 'overhead' ? slide <= 0 : jump < 45) finish();
      }
    });
    objects=objects.filter(function(o){return o.z > (isCar(o) ? -.38 : -.05);});
    scoreEl.textContent=Math.floor(distance/10); coinsEl.textContent=coins;
    draw(); if (state === 'playing') frame=requestAnimationFrame(tick);
  }
  function begin() {
    lane=1; playerX=1; jump=0; jumpSpeed=0; slide=0; shoes=0; shoeCooldown=0; roof=null; jumpFromRoof=false; objects=[]; distance=0; coins=0; spawn=1; last=0;
    gameOver.hidden=true; powerEl.hidden=true;
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
    if (a==='jump' && (roof || (jump===0 && jumpSpeed===0))) { jumpFromRoof=!!roof; roof=null; slide=0; jumpSpeed=shoes>0 ? 620 : 420; }
    if (a==='slide' && jump===0 && !roof) slide=.8;
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
    var keys={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'jump',ArrowDown:'slide',' ':'jump',Escape:'pause'};
    if (keys[e.key] && !/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) && !e.target.isContentEditable) { e.preventDefault(); if(!e.repeat) action(keys[e.key]); }
  });
  document.addEventListener('visibilitychange',function(){if(document.hidden && state==='playing') pause();});
  draw();
}());
