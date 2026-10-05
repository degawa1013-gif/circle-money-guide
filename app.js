'use strict';
const $ = (id) => document.getElementById(id);
const NS = 'http://www.w3.org/2000/svg';
const nodes = [
 {id:'discord', title:'Discord',code:'01',x:44,y:94,kind:'USER INTERFACE',body:'/会計 → 入力 → 確認\n返信は本人だけに表示',description:'普段の会計入力の入口。支出・収入を入力し、確認ボタンを押すと登録を受け付けます。集計や取消も同じ場所で行えます。',data:'金額・日付・内容・カテゴリ、操作した人と指定先の情報。',storage:'入力と返信はDiscordサービスを経由します。返信は本人だけに表示します。',note:'現在はアプリ所有者本人と、設定されたサーバー・チャンネルだけで利用できます。'},
 {id:'receiver',title:'Bot専用受付',code:'02',x:360,y:94,kind:'VERIFIED ENTRY POINT',body:'署名・担当者・指定先を検証\n返信用の情報を受け取る',description:'Sites上のCloudflare WorkersでDiscordの操作を受け取ります。Ed25519署名と利用範囲を確認し、許可された操作だけを受け付けます。',data:'Discordの署名付き操作、確認ボタンの選択、処理結果。',storage:'本番トークンは設定時だけ使用。連携用の導出鍵は暗号化して保存します。',note:'通常の雑談履歴や写真を読むBotではありません。返信は本人限定です。'},
 {id:'queue',title:'暗号化した処理待ち',code:'03',x:667,y:94,kind:'ENCRYPTED QUEUE / D1',body:'確認済みの操作を一時保存\n同じ登録IDで重複を防止',description:'Googleが次に処理する操作を待機させます。入力や返信用情報、結果を暗号化し、同じ登録IDの再試行を追跡します。',data:'処理に必要な項目、登録ID、状態、短時間有効な返信用情報。',storage:'AES-GCMで暗号化。連携稼働中、作成から24時間を過ぎた受付記録を削除します。',note:'この場所は会計台帳ではありません。Google連携が停止している間は削除処理も停止します。'},
 {id:'web',title:'Circle Money Web',code:'04',x:44,y:304,kind:'PRIVATE WEB APP',body:'Googleログイン＋パスワード\n集計・取引一覧・手入力',description:'Google Apps Scriptで配信する会計画面です。グラフや取引一覧を確認し、取引の手入力・取消・レシート読み取りを行います。',data:'認証された操作と会計項目。写真からの候補は登録前に確認します。',storage:'会計データはシートへ保存。画像とOCR全文はブラウザーのメモリー内だけで扱います。',note:'サイトの入口はDiscordの「/会計 サイト」で確認できます。この公開ガイドには個人用URLを掲載しません。'},
 {id:'gas',title:'Google Apps Script',code:'05',x:667,y:304,kind:'PRIVATE PROCESSING',body:'毎分取得 / 検証 / 排他制御\n登録・集計・取消を実行',description:'シートを操作する中心の処理です。Google側から毎分、HMAC署名付き通信で受付を確認します。確認済みの操作を検証して実行し、結果を受付へ返します。',data:'必要な操作と確認済み項目。全台帳をDiscordの受付へ送る構成ではありません。',storage:'Botトークンはスクリプトプロパティに保存します。外部POST APIは無効です。',note:'図の矢印は情報の流れです。処理待ちの取得通信はGoogle側から開始します。'},
 {id:'sheet',title:'Google Sheets',code:'06',x:945,y:304,kind:'SOURCE OF TRUTH',body:'Transactions / Settings\n会計記録と開始残高',description:'会計データの本体です。日付、区分を表す金額、カテゴリ、内容、登録元などを保持し、サイトとBotが同じ記録を参照します。',data:'取引ID・日付・カテゴリ・内容・金額・店名・登録元・取消日時など。',storage:'非公開のGoogleスプレッドシート。取消後も履歴を保持し、有効な取引だけを集計します。',note:'開始残高・収入・支払状況を確認してください。登録済み支出の合計だけでは現金残高は確定しません。'},
 {id:'ocr',title:'端末内レシートOCR',code:'07',x:360,y:484,kind:'ON-DEVICE / TESSERACT.JS',body:'写真 → 読み取り候補 → 確認\n写真・全文はアップロードしない',description:'会計サイト内で写真を読み取り、日付・店名・金額などの候補を作ります。元の写真と照合し、修正・確認してから登録します。',data:'JPEG・PNG・WebPの写真と、読み取り候補。1枚を1取引として扱います。',storage:'写真とOCR全文はブラウザーのメモリー内。フォームを閉じると破棄し、確認済み項目だけをシートに送ります。',note:'OCR用プログラム・日本語データは外部CDNから取得しますが、写真は送信しません。'},
];
const edges = [
 {id:'command',from:'discord',to:'receiver',d:'M250 149 C295 149 315 149 360 149',kind:''},
 {id:'store',from:'receiver',to:'queue',d:'M566 149 C610 149 622 149 667 149',kind:''},
 {id:'poll',from:'queue',to:'gas',d:'M770 204 C770 244 770 264 770 304',kind:''},
 {id:'save',from:'gas',to:'sheet',d:'M873 359 C905 359 913 359 945 359',kind:''},
 {id:'web-save',from:'web',to:'gas',d:'M250 359 C400 359 515 359 667 359',kind:''},
 {id:'photo',from:'web',to:'ocr',d:'M147 414 C147 539 243 539 360 539',kind:'photo'},
 {id:'fields',from:'ocr',to:'web',d:'M463 484 C463 423 277 456 250 389',kind:'photo'},
 {id:'result',from:'gas',to:'receiver',d:'M667 386 C600 386 609 219 541 204',kind:'reply'},
 {id:'reply',from:'receiver',to:'discord',d:'M386 204 C370 257 197 263 174 204',kind:'reply'},
 {id:'read',from:'sheet',to:'gas',d:'M997 410 C998 450 813 452 812 414',kind:'reply'},
 {id:'web-result',from:'gas',to:'web',d:'M717 414 C648 474 337 470 231 414',kind:'reply'},
];
const routes = {
 discord:{title:'Discord入力の流れ',nodes:['discord','receiver','queue','gas','sheet'],edges:['command','store','poll','save','result','reply','read'],steps:[
  {nodes:['discord'],edges:[],text:'「/会計 支出」で項目を入力し、確認ボタンを押します。'},
  {nodes:['discord','receiver'],edges:['command'],text:'署名・アプリ・担当者・サーバー・チャンネルを検証します。'},
  {nodes:['receiver','queue'],edges:['store'],text:'確認済み項目を暗号化し、Google側の取得を待ちます。'},
  {nodes:['queue','gas','sheet'],edges:['poll','save'],text:'Googleが毎分取得し、検証・重複確認をしてシートに記録します。'},
  {nodes:['gas','receiver','discord'],edges:['result','reply'],text:'通常1〜2分で、登録結果を本人だけに返信します。'},
 ]},
 web:{title:'会計サイトの流れ',nodes:['web','gas','sheet'],edges:['web-save','save','read','web-result'],steps:[
  {nodes:['web'],edges:[],text:'Googleログインと会計用パスワードでサイトを開きます。'},
  {nodes:['web'],edges:[],text:'「＋ 取引を登録」で日付・区分・カテゴリ・内容・金額を入力します。'},
  {nodes:['web','gas','sheet'],edges:['web-save','save'],text:'Google側で認証と入力を検証し、非公開シートに記録します。'},
  {nodes:['sheet','gas','web'],edges:['read','web-result'],text:'更新した会計データでグラフと取引一覧を表示します。'},
 ]},
 receipt:{title:'レシート入力の流れ',nodes:['web','ocr','gas','sheet'],edges:['photo','fields','web-save','save'],steps:[
  {nodes:['web'],edges:[],text:'会計サイトの「レシートを読む」から写真を選びます。'},
  {nodes:['web','ocr'],edges:['photo'],text:'写真を端末内で読み取り、日付・店名・金額などの候補を作ります。'},
  {nodes:['ocr','web'],edges:['fields'],text:'原本と照合して修正し、確認チェックを入れます。'},
  {nodes:['web','gas','sheet'],edges:['web-save','save'],text:'確認した項目だけを登録。写真とOCR全文は送信・保存しません。'},
 ]},
};
let selected='discord',route='all',step=0,timer=null,zoom=1,panX=0,panY=0,drag=null;
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
for(const n of nodes){
 const button=document.createElement('button');button.className='node'+(n.id==='ocr'?' photo-node':'');button.dataset.node=n.id;button.style.left=n.x+'px';button.style.top=n.y+'px';button.setAttribute('aria-pressed','false');button.setAttribute('aria-label',n.title+'の役割を表示');
 const head=document.createElement('span');head.className='node-head';const title=document.createElement('span');title.className='node-title';title.textContent=n.title;const code=document.createElement('span');code.className='node-code';code.textContent=n.code;head.append(title,code);
 const body=document.createElement('span');body.className='node-body';n.body.split('\n').forEach((text,i)=>{if(i)body.append(document.createElement('br'));body.append(document.createTextNode(text));});button.append(head,body);button.addEventListener('click',()=>selectNode(n.id));button.addEventListener('focus',()=>{const a=button.getBoundingClientRect(),v=$('viewport').getBoundingClientRect();if(a.left<v.left||a.right>v.right||a.top<v.top||a.bottom>v.bottom){panX=$('viewport').clientWidth/2-(n.x+103)*zoom;panY=$('viewport').clientHeight/2-(n.y+53)*zoom;transform();}});$('nodes').append(button);
 const mini=document.createElementNS(NS,'rect');for(const [key,value] of Object.entries({x:n.x,y:n.y,width:206,height:106,rx:6}))mini.setAttribute(key,value);$('mini-nodes').append(mini);
}
for(const edge of edges){const path=document.createElementNS(NS,'path');path.setAttribute('d',edge.d);path.setAttribute('class','edge '+edge.kind);path.dataset.edge=edge.id;$('edges').append(path);}
function selectNode(id){
 selected=id;$('node-picker').value=id;const n=nodes.find(n=>n.id===id);document.querySelectorAll('.node').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.node===id)));$('node-number').textContent=n.code+' / 07';
 const wrap=$('node-detail');wrap.replaceChildren();const type=document.createElement('span');type.className='detail-type';type.textContent=n.kind;const h=document.createElement('h3');h.textContent=n.title;const p=document.createElement('p');p.textContent=n.description;const dl=document.createElement('dl');for(const [label,text] of [['扱う情報',n.data],['保存と公開範囲',n.storage]]){const dt=document.createElement('dt');dt.textContent=label;const dd=document.createElement('dd');dd.textContent=text;dl.append(dt,dd);}const note=document.createElement('p');note.className='detail-note';note.textContent=n.note;wrap.append(type,h,p,dl,note);
}
function currentRoute(){return routes[route==='all'?'discord':route];}
function paint(highlight=false){
 const r=currentRoute(),s=r.steps[step];$('flow-heading').textContent=r.title;$('step-count').textContent=(step+1)+' / '+r.steps.length;$('step-text').textContent=s.text;
 document.querySelectorAll('.node').forEach(n=>{n.classList.toggle('dim',route!=='all'&&!r.nodes.includes(n.dataset.node));n.classList.toggle('active',highlight&&s.nodes.includes(n.dataset.node));});
 document.querySelectorAll('.edge').forEach(e=>{e.classList.toggle('dim',route!=='all'&&!r.edges.includes(e.dataset.edge));e.classList.toggle('active',highlight&&s.edges.includes(e.dataset.edge));});
 $('step-back').disabled=step===0;$('step-next').disabled=step===r.steps.length-1;
}
function stop(){clearInterval(timer);timer=null;$('play').textContent='流れを再生';}
document.querySelectorAll('[data-route]').forEach(b=>b.addEventListener('click',()=>{stop();route=b.dataset.route;step=0;document.querySelectorAll('[data-route]').forEach(t=>t.setAttribute('aria-pressed',String(t===b)));selectNode(currentRoute().nodes[0]);paint(route!=='all');}));
$('step-back').addEventListener('click',()=>{stop();step=Math.max(0,step-1);paint(true);selectNode(currentRoute().steps[step].nodes[0]);});
$('step-next').addEventListener('click',()=>{stop();step=Math.min(currentRoute().steps.length-1,step+1);paint(true);selectNode(currentRoute().steps[step].nodes[0]);});
$('play').addEventListener('click',()=>{if(timer){stop();return;}if(step===currentRoute().steps.length-1)step=0;paint(true);selectNode(currentRoute().steps[step].nodes[0]);if(reducedMotion){$('step-text').textContent+=' 次へボタンで進めます。';return;}$('play').textContent='一時停止';timer=setInterval(()=>{if(step>=currentRoute().steps.length-1){stop();return;}step++;paint(true);selectNode(currentRoute().steps[step].nodes[0]);},2600);});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
function transform(){
 $('world').style.transform=`translate(${panX}px, ${panY}px) scale(${zoom})`;$('zoom-level').textContent=Math.round(zoom*100)+'%';
 const mini=$('mini-view');mini.setAttribute('x',-panX/zoom);mini.setAttribute('y',-panY/zoom);mini.setAttribute('width',$('viewport').clientWidth/zoom);mini.setAttribute('height',$('viewport').clientHeight/zoom);
}
function fit(){const v=$('viewport');zoom=Math.min((v.clientWidth-28)/1180,(v.clientHeight-45)/620,1.35);panX=(v.clientWidth-1180*zoom)/2;panY=(v.clientHeight-620*zoom)/2;transform();}
function changeZoom(mult){const v=$('viewport'),old=zoom;zoom=Math.max(.25,Math.min(1.8,zoom*mult));panX=v.clientWidth/2-(v.clientWidth/2-panX)*zoom/old;panY=v.clientHeight/2-(v.clientHeight/2-panY)*zoom/old;transform();}
$('fit').addEventListener('click',fit);$('zoom-in').addEventListener('click',()=>changeZoom(1.25));$('zoom-out').addEventListener('click',()=>changeZoom(.8));
$('viewport').addEventListener('pointerdown',e=>{if(e.target.closest('button,output'))return;drag={x:e.clientX,y:e.clientY,px:panX,py:panY};$('viewport').setPointerCapture(e.pointerId);$('viewport').classList.add('dragging');});
$('viewport').addEventListener('pointermove',e=>{if(!drag)return;panX=drag.px+e.clientX-drag.x;panY=drag.py+e.clientY-drag.y;transform();});
function endDrag(){drag=null;$('viewport').classList.remove('dragging');}$('viewport').addEventListener('pointerup',endDrag);$('viewport').addEventListener('pointercancel',endDrag);
$('viewport').addEventListener('keydown',e=>{if(e.target!==$('viewport'))return;if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-','Home'].includes(e.key))e.preventDefault();if(e.key==='Home')fit();else if(e.key==='+')changeZoom(1.25);else if(e.key==='-')changeZoom(.8);else{if(e.key==='ArrowLeft')panX+=50;if(e.key==='ArrowRight')panX-=50;if(e.key==='ArrowUp')panY+=50;if(e.key==='ArrowDown')panY-=50;transform();}});
$('node-picker').addEventListener('change',e=>selectNode(e.target.value));
new ResizeObserver(fit).observe($('viewport'));selectNode(selected);paint();fit();

let demoState='idle';
function demoIdle(){demoState='idle';$('demo-text').textContent='入力内容のプレビューを、ここで試せます。';$('demo-buttons').hidden=true;$('demo-reset').hidden=true;}
$('demo-form').addEventListener('input',()=>{if(demoState!=='idle'){demoIdle();$('demo-text').textContent='項目が変わりました。もう一度、確認画面を開いてください。';}});
$('demo-form').addEventListener('submit',e=>{e.preventDefault();const amount=Number($('demo-amount').value),item=$('demo-item').value.trim();if(!Number.isSafeInteger(amount)||amount<1||amount>100000000||!item){$('demo-text').textContent='金額は1〜100,000,000円の整数、内容は空欄にせず入力してください。';return;}demoState='preview';$('demo-text').textContent=`まだ登録していません。内容を確認してください。\n支出 / ${$('demo-category').value}\n${amount.toLocaleString('ja-JP')}円 / ${item}\n\n実際のBotでは、10分以内に確認します。`;$('demo-buttons').hidden=false;$('demo-reset').hidden=true;});
$('demo-confirm').addEventListener('click',()=>{if(demoState!=='preview')return;demoState='done';$('demo-text').textContent='確認できました！ ここまでが操作デモです。\n実際のBotでは通常1〜2分で「登録しました」と返信されます。\nこのデモの入力は送信・保存されていません。';$('demo-buttons').hidden=true;$('demo-reset').hidden=false;});
$('demo-cancel').addEventListener('click',()=>{demoState='cancelled';$('demo-text').textContent='中止しました。会計データは変更しません。\n実際のBotでも、確認前なら中止できます。';$('demo-buttons').hidden=true;$('demo-reset').hidden=false;});$('demo-reset').addEventListener('click',demoIdle);
document.querySelectorAll('[data-copy]').forEach(b=>b.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(b.dataset.copy);$('copy-status').textContent=b.dataset.copy+' をコピーしました。Discordで候補を選んで使ってください。';}catch{$('copy-status').textContent='コピーできませんでした。コマンドの文字を選択してコピーしてください：'+b.dataset.copy;}}));
