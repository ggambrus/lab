window.ActivityModules = window.ActivityModules || {};
window.ActivityModules.connect = function(container) {
  container.dataset.activity = "connect";

  // --- Extract raw activity content ---
  let raw = '';
  const rawNode = container.querySelector('.activity-raw');
  if (rawNode && rawNode.textContent.trim()) raw = rawNode.textContent.trim();
  else {
    let html = container.innerHTML || '';
    html = html.replace(/<br\s*\/?>/gi,'\n').replace(/<\/p>/gi,'\n').replace(/<[^>]+>/g,'');
    raw = html.trim();
  }
  raw = raw.replace(/\[activity:[^\]]+\]/gi,'').replace(/\[end activity\]/gi,'').trim();
  container.innerHTML='';

  // --- Parse prompt and connections ---
  const lines = raw.split(/\n/).map(l=>l.trim()).filter(Boolean);
  let promptText=''; 
  const items = [];
  lines.forEach(line=>{
    if(line.toLowerCase().startsWith('prompt:')) promptText = line.replace(/^[pP]rompt:\s*/,'');
    else if(line.includes('|')){
      const parts = line.split('|').map(p=>p.trim());
      if(parts.length===2) items.push({left:parts[0], right:parts[1]});
    }
  });

  if(!items.length){
    container.innerHTML='<div class="activity-complete">No items found for connect activity.</div>';
    return;
  }

  function shuffle(arr){return arr.map(v=>[Math.random(),v]).sort((a,b)=>a[0]-b[0]).map(v=>v[1]);}
  const leftItems = shuffle(items.map(i=>i.left));
  const rightItems = shuffle(items.map(i=>i.right));

  // --- Build UI ---
  const promptDiv = document.createElement('div');
  promptDiv.className='connect-prompt';
  promptDiv.textContent = promptText;
  container.appendChild(promptDiv);

  const wrapper = document.createElement('div'); wrapper.className='connect-wrapper'; container.appendChild(wrapper);
  const leftCol = document.createElement('div'); leftCol.className='connect-column left-column'; wrapper.appendChild(leftCol);
  const rightCol = document.createElement('div'); rightCol.className='connect-column right-column'; wrapper.appendChild(rightCol);

  const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.classList.add('connect-lines'); 
  svg.style.position='absolute'; svg.style.top='0'; svg.style.left='0';
  svg.style.width='100%'; svg.style.height='100%'; svg.style.pointerEvents='none'; 
  container.style.position='relative';
  container.appendChild(svg);

  const leftButtons=[]; 
  const rightButtons=[];
  const lineColors=['#FF6B6B','#4ECDC4','#FFD93D','#6A4C93','#FF9F1C','#2EC4B6','#E71D36','#8D99AE'];

  leftItems.forEach(text=>{
    const btn=document.createElement('button'); 
    btn.type='button'; btn.className='connect-left'; btn.textContent=text;
    leftCol.appendChild(btn); leftButtons.push(btn);
  });
  rightItems.forEach(text=>{
    const btn=document.createElement('button'); 
    btn.type='button'; btn.className='connect-right'; btn.textContent=text;
    rightCol.appendChild(btn); rightButtons.push(btn);
  });

  const connections = new Map(); // leftBtn -> { rightBtn, color, path, dots }
  const usedColors = [];

  function getEdgePoint(el, side='right'){ 
    const rect=el.getBoundingClientRect(); 
    const p=container.getBoundingClientRect();
    const y=rect.top+rect.height/2 - p.top; 
    const x=(side==='right')? rect.right - p.left : rect.left - p.left; 
    return {x,y}; 
  }

  function redrawAllConnections(){
    for(const { path, dots } of connections.values()){
      if(path) svg.removeChild(path);
      dots.forEach(d=>svg.removeChild(d));
    }

    for(const [leftBtn, data] of connections){
      const rightBtn = data.rightBtn;
      const color = data.color;

      const start = getEdgePoint(leftBtn,'right');
      const end = getEdgePoint(rightBtn,'left');
      const cx1=start.x+50, cy1=start.y, cx2=end.x-50, cy2=end.y;

      const path=document.createElementNS('http://www.w3.org/2000/svg','path');
      path.setAttribute('stroke',color);
      path.setAttribute('stroke-width','3');
      path.setAttribute('fill','none');
      path.setAttribute('stroke-linecap','round');
      path.setAttribute('d',`M ${start.x} ${start.y} C ${cx1} ${cy1} ${cx2} ${cy2} ${end.x} ${end.y}`);
      svg.appendChild(path);

      const dotStart=document.createElementNS('http://www.w3.org/2000/svg','circle');
      dotStart.setAttribute('cx',start.x); dotStart.setAttribute('cy',start.y);
      dotStart.setAttribute('r',5); dotStart.setAttribute('fill',color);

      const dotEnd=document.createElementNS('http://www.w3.org/2000/svg','circle');
      dotEnd.setAttribute('cx',end.x); dotEnd.setAttribute('cy',end.y);
      dotEnd.setAttribute('r',5); dotEnd.setAttribute('fill',color);

      svg.appendChild(dotStart);
      svg.appendChild(dotEnd);

      data.path = path;
      data.dots = [dotStart,dotEnd];
    }
  }

  // ✅ Automatically realign lines on scroll & resize
  window.addEventListener('resize', redrawAllConnections);
  document.addEventListener('scroll', redrawAllConnections, true);

  // --- Detect touchscreen robustly ---
  const isTouch = ('ontouchstart' in window || navigator.maxTouchPoints > 0) &&
                  /Mobi|Android|iPad|iPhone/i.test(navigator.userAgent);

  if(!isTouch){
    // --- Desktop drag & drop ---
    let dragging=null; let dragPath=null;

    function startDrag(btn,e){
      const color = lineColors.find(c=>!usedColors.includes(c)) || lineColors[Math.floor(Math.random()*lineColors.length)];
      dragging={leftBtn:btn,color}; usedColors.push(color);
      const start=getEdgePoint(btn,'right');
      dragPath=document.createElementNS('http://www.w3.org/2000/svg','path');
      dragPath.setAttribute('stroke',color);
      dragPath.setAttribute('stroke-width','3');
      dragPath.setAttribute('fill','none');
      dragPath.setAttribute('stroke-linecap','round'); 
      dragPath.setAttribute('d',`M ${start.x} ${start.y} C ${start.x} ${start.y} ${start.x} ${start.y} ${start.x} ${start.y}`);
      svg.appendChild(dragPath);
      e.preventDefault();
    }

    function moveDrag(e){ 
      if(!dragging||!dragPath) return;
      const start=getEdgePoint(dragging.leftBtn,'right'); 
      const coords={
        x: e.clientX - container.getBoundingClientRect().left,
        y: e.clientY - container.getBoundingClientRect().top
      };
      const cx1=start.x+50, cy1=start.y, cx2=coords.x-50, cy2=coords.y;
      dragPath.setAttribute('d',`M ${start.x} ${start.y} C ${cx1} ${cy1} ${cx2} ${cy2} ${coords.x} ${coords.y}`);
    }

    function endDrag(e){
      if(!dragging || !dragPath) return;

      const mouse = { x: e.clientX, y: e.clientY };
      const target = rightButtons.find(b=>{
        const r=b.getBoundingClientRect();
        return mouse.x>=r.left && mouse.x<=r.right && mouse.y>=r.top && mouse.y<=r.bottom;
      });

      if(target){
        connections.set(dragging.leftBtn,{
          rightBtn:target,
          color:dragging.color,
          path:null,
          dots:[]
        });
        dragging.leftBtn.style.borderColor=dragging.color;
        target.style.borderColor=dragging.color;
        redrawAllConnections();
      } else svg.removeChild(dragPath);

      dragging=null; dragPath=null;
    }

    leftButtons.forEach(btn=>btn.addEventListener('mousedown', e=>startDrag(btn,e)));
    document.addEventListener('mousemove', moveDrag);
    document.addEventListener('mouseup', endDrag);
  } 
  else {
    // --- Touch: tap-to-connect ---
    let selectedLeft=null;

    leftButtons.forEach(btn=>{
      btn.addEventListener('click',()=>{
        selectedLeft=btn;
        leftButtons.forEach(b=>b.classList.remove('selected'));
        btn.classList.add('selected');
      });
    });

    rightButtons.forEach(btn=>{
      btn.addEventListener('click',()=>{
        if(!selectedLeft) return;

        const color = lineColors.find(c=>!usedColors.includes(c)) || lineColors[Math.floor(Math.random()*lineColors.length)];
        usedColors.push(color);

        connections.set(selectedLeft,{
          rightBtn:btn,
          color,
          path:null,
          dots:[]
        });

        selectedLeft.style.borderColor=color;
        btn.style.borderColor=color;
        leftButtons.forEach(b=>b.classList.remove('selected'));
        selectedLeft=null;
        redrawAllConnections();
      });
    });
  }

  // --- Feedback / check ---
  const feedback=document.createElement('div'); feedback.className='connect-feedback'; feedback.style.marginTop='0.5rem'; container.appendChild(feedback);
  const checkBtn=document.createElement('button'); 
  checkBtn.textContent='Check Connections'; 
  checkBtn.style.marginTop='0.5rem'; 
  checkBtn.className='connect-check';
  container.appendChild(checkBtn);

  checkBtn.addEventListener('click',()=>{
    let correct=true;
    for(const [leftBtn,{rightBtn}] of connections){
      const item = items.find(i=>i.left===leftBtn.textContent);
      if(!item || item.right!==rightBtn.textContent) correct=false;
    }
    if(correct && connections.size===items.length){
      feedback.textContent='✅ All connections correct!';
      setTimeout(()=>{
        container.innerHTML='<div class="activity-complete">Connect activity completed ✅</div>';
        if(ActivityUtils && ActivityUtils.unlockNext) ActivityUtils.unlockNext(container);
      },700);
    } else {
      feedback.textContent='❌ Some connections are incorrect. Retry.';
      connections.clear();
      svg.innerHTML='';
      leftButtons.concat(rightButtons).forEach(b=>b.style.borderColor='');
    }
  });
};
