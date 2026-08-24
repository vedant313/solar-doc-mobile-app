/* v4: multi-image/PDF upload + crop before upload. */
(function(){
  let queue=[];
  function setInputs(){
    const g=document.getElementById('gallery-input');
    if(g){g.multiple=true;g.accept='image/*,application/pdf';}
    const c=document.getElementById('camera-input');
    if(c){c.accept='image/*';c.capture='environment';}
  }
  function readFile(file){
    return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(',')[1]||'');r.onerror=()=>reject(new Error('Could not read file'));r.readAsDataURL(file);});
  }
  window.stageFileForUpload=function(input){
    const files=Array.from(input.files||[]);input.value='';
    if(!files.length||!state.activeCustomer)return;
    queue=files; nextFile();
  };
  async function nextFile(){
    const file=queue.shift();
    if(!file){render();setInputs();return;}
    if(file.size>25*1024*1024){toast(file.name+': maximum 25 MB');return nextFile();}
    try{
      const dataUrl='data:'+(file.type||'application/octet-stream')+';base64,'+await readFile(file);
      if(file.type==='application/pdf'){
        state.pendingUpload={fileName:file.name,base64:dataUrl.split(',')[1],mimeType:'application/pdf'};
        render();setInputs();return;
      }
      openCrop(file,dataUrl);
    }catch(e){toast(e.message);nextFile();}
  }
  function openCrop(file,dataUrl){
    const img=new Image();
    img.onload=function(){
      const wrap=document.createElement('div');wrap.id='sdm-crop';
      wrap.innerHTML='<div class="sdm-crop-back"><div class="sdm-crop-card"><h3>Crop Photo</h3><p>Drag to position • use slider to zoom</p><canvas id="sdm-canvas"></canvas><input id="sdm-zoom" type="range" min="1" max="3" step="0.05" value="1"><div class="sdm-actions"><button id="sdm-cancel">Cancel</button><button id="sdm-use">Use Photo</button></div></div></div>';
      document.body.appendChild(wrap);
      const canvas=wrap.querySelector('#sdm-canvas'),ctx=canvas.getContext('2d');canvas.width=900;canvas.height=675;
      let zoom=1,ox=0,oy=0,drag=null;
      function draw(){const W=canvas.width,H=canvas.height,scale=Math.max(W/img.width,H/img.height)*zoom,dw=img.width*scale,dh=img.height*scale;const maxX=Math.max(0,(dw-W)/2),maxY=Math.max(0,(dh-H)/2);ox=Math.max(-maxX,Math.min(maxX,ox));oy=Math.max(-maxY,Math.min(maxY,oy));ctx.fillStyle='#111';ctx.fillRect(0,0,W,H);ctx.drawImage(img,(W-dw)/2+ox,(H-dh)/2+oy,dw,dh);ctx.strokeStyle='rgba(255,255,255,.9)';ctx.lineWidth=3;ctx.strokeRect(3,3,W-6,H-6);}
      function point(e){const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)*canvas.width/r.width,y:(e.clientY-r.top)*canvas.height/r.height};}
      canvas.onpointerdown=e=>{const p=point(e);drag={x:p.x,y:p.y,ox,oy};canvas.setPointerCapture?.(e.pointerId)};
      canvas.onpointermove=e=>{if(!drag)return;const p=point(e);ox=drag.ox+p.x-drag.x;oy=drag.oy+p.y-drag.y;draw()};
      canvas.onpointerup=canvas.onpointercancel=()=>drag=null;
      wrap.querySelector('#sdm-zoom').oninput=e=>{zoom=Number(e.target.value);draw()};
      wrap.querySelector('#sdm-cancel').onclick=()=>{wrap.remove();queue=[];render();setInputs()};
      wrap.querySelector('#sdm-use').onclick=()=>{const out=canvas.toDataURL('image/jpeg',.9);wrap.remove();state.pendingUpload={fileName:file.name.replace(/\.[^.]+$/,'')+'.jpg',base64:out.split(',')[1],mimeType:'image/jpeg'};render();setInputs()};
      draw();
    };img.src=dataUrl;
  }
  window.confirmUpload=async function(sel,custom){
    if(!state.pendingUpload)return;
    let type=sel.value;if(type==='Other')type=(custom.value||'Other').trim();
    try{
      const d=await api(`/api/customers/${state.activeCustomer.id}/documents`,{method:'POST',body:JSON.stringify({fileName:state.pendingUpload.fileName,base64:state.pendingUpload.base64,mimeType:state.pendingUpload.mimeType,type})});
      toast('Uploaded: '+d.originalName);state.pendingUpload=null;
      if(queue.length){nextFile()}else{goTo('documents')}
    }catch(e){toast(e.message)}
  };
  window.cancelUpload=function(){state.pendingUpload=null;queue=[];render();setInputs()};
  const observer=new MutationObserver(setInputs);observer.observe(document.body,{childList:true,subtree:true});
  setTimeout(setInputs,100);
})();
