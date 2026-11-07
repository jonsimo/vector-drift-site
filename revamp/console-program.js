/* Isolated document: programs own only their frame's keys. The parent console
   remains editable; removing the frame also removes its timers/listeners. */
(() => {
  'use strict';
  const name = new URLSearchParams(location.search).get('program');
  const output = document.getElementById('program-output');
  const controls = document.getElementById('program-controls');
  const KEYS = {
    snake: [['UP','ArrowUp'],['LEFT','ArrowLeft'],['DOWN','ArrowDown'],['RIGHT','ArrowRight'],['PAUSE','p'],['RESTART','Enter'],['QUIT','Escape']],
    pi: [['STOP','Enter']],
    ost: [['PLAY/PAUSE',' '],['PREV','ArrowUp'],['NEXT','ArrowDown'],['-5S','ArrowLeft',1],['+5S','ArrowRight',1],['VOL -','-'],['VOL +','+'],['QUIT','Escape']]
  };
  const keys = KEYS[name];
  if (!keys) { output.textContent='PROGRAM NOT AVAILABLE';return; }
  document.body.dataset.program = name;
  for(const [label,key,extra] of keys){const button=document.createElement('button');if(extra)button.dataset.extra='1';button.type='button';button.textContent='[ '+label+' ]';button.addEventListener('click',()=>document.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true,cancelable:true})));controls.append(button);}
  function fitBoard(){
    if(name !== 'snake') return;
    const availableWidth = Math.max(140, document.documentElement.clientWidth - 24);
    const availableHeight = Math.max(100, innerHeight - controls.offsetHeight - 36);
    document.documentElement.style.setProperty('--program-font', Math.max(6,Math.min(18,availableWidth / 25,availableHeight / (26 * 1.1)))+'px');
  }
  fitBoard();
  window.addEventListener('resize',fitBoard);
  document.fonts.ready.then(fitBoard);
  const runner={snake:window.VDSnake,pi:window.VDPi,ost:window.VDOst}[name];
  runner.launch({output,base:'ost/'}).then(result=>{controls.replaceChildren();output.textContent='SESSION ENDED';parent.postMessage({type:'vd:program-ended',name,...result},location.origin);});
})();
