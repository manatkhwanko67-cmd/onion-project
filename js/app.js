const state={movies:[],favorites:[...new Set((()=>{try{const v=JSON.parse(localStorage.getItem('onionFavorites')||'[]');return Array.isArray(v)?v:[]}catch{return []}})().map(v=>String(v??'').replace(/^\uFEFF/,'').trim()).filter(Boolean))],history:(()=>{try{const v=JSON.parse(localStorage.getItem('onionHistory')||'[]');return Array.isArray(v)?v:[]}catch{return []}})(),feedback:(()=>{try{const v=JSON.parse(localStorage.getItem('onionFeedback')||'{}');return v&&typeof v==='object'?v:{}}catch{return {}}})(),lastQuery:'',usedIds:[],resultItems:[],resultFilter:'all',filterGenre:'all',filterYear:'all',filterRating:'all',sortBy:'score',lastSearchTime:'',favoriteFilter:'all',favoriteSearch:'',favoriteSort:'added',historySearch:'',historySort:'newest'};
const $=s=>document.querySelector(s);const $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
function normalize(s){return String(s||'').toLowerCase().normalize('NFKC').replace(/[.,!?;:()[\]{}"“”'’/\\\-_|]/g,' ')}
function tokens(s){const n=normalize(s);const words=n.split(/\s+/).filter(Boolean);const grams=[];for(const w of words){if(w.length<=1)grams.push(w);else{for(let i=0;i<w.length-1;i++)grams.push(w.slice(i,i+2));if(w.length>=4)for(let i=0;i<w.length-2;i++)grams.push(w.slice(i,i+3));}}return [...new Set(words.concat(grams).filter(x=>x.length>1))]}
function save(){localStorage.setItem('onionFavorites',JSON.stringify(state.favorites));localStorage.setItem('onionHistory',JSON.stringify(state.history));localStorage.setItem('onionFeedback',JSON.stringify(state.feedback));$('#favoriteCount').textContent=state.favorites.length}
function toast(msg){const el=$('#toast');el.textContent=msg;el.classList.add('show');clearTimeout(window._toast);window._toast=setTimeout(()=>el.classList.remove('show'),2200)}
function csvParse(text){const rows=[];let row=[],cell='',q=false;for(let i=0;i<text.length;i++){const ch=text[i],n=text[i+1];if(ch==='"'){if(q&&n==='"'){cell+='"';i++}else q=!q}else if(ch===','&&!q){row.push(cell);cell=''}else if((ch==='\n'||ch==='\r')&&!q){if(ch==='\r'&&n==='\n')i++;row.push(cell);if(row.some(v=>v.trim()))rows.push(row);row=[];cell=''}else cell+=ch}if(cell||row.length){row.push(cell);rows.push(row)}const h=rows.shift().map(x=>x.replace(/^\uFEFF/,''));return rows.map(r=>Object.fromEntries(h.map((k,i)=>[k,r[i]??''])))}
function movieText(m){return normalize([m.title,m.original_title,m.main_genre,m.genre,m.mood,m.theme,m.situation,m.preference,m.language,m.country,m.description,m.keywords].filter(Boolean).join(' '))}
// สร้างดัชนีคำและนับจำนวนเอกสารที่มีคำ
function buildIndex(){const docs=state.movies.map(movieText);const df=new Map();docs.forEach(text=>new Set(tokens(text)).forEach(t=>df.set(t,(df.get(t)||0)+1)));state.ir={docs,df,N:docs.length}}
// คำนวณน้ำหนัก TF-IDF
function tfidfVector(text){const counts=new Map();tokens(text).forEach(t=>counts.set(t,(counts.get(t)||0)+1));const vec=new Map();const len=Math.max(1,tokens(text).length);for(const [t,c] of counts){const d=state.ir.df.get(t)||0;const idf=Math.log((state.ir.N+1)/(d+1))+1;vec.set(t,(c/len)*idf)}return vec}
// คำนวณ Cosine Similarity
function cosine(a,b){let dot=0,na=0,nb=0;for(const v of a.values())na+=v*v;for(const v of b.values())nb+=v*v;for(const [k,v] of a)dot+=v*(b.get(k)||0);return na&&nb?dot/(Math.sqrt(na)*Math.sqrt(nb)):0}
function keywordBoost(m,q){const n=normalize(q);let boost=0;const rules=[[/รัก|โรแมนติก|คู่รัก|แอบรัก/,'romance'],[/ตลก|ขำ|ฮา|เบาสมอง/,'comedy'],[/ผี|หลอน|สยอง/,'horror'],[/แอ็กชัน|ต่อสู้|มัน/,'action'],[/ปริศนา|สืบสวน|ไขคดี/,'mystery'],[/ลุ้น|ระทึก|กดดัน/,'thriller'],[/ไซไฟ|อนาคต|วิทยาศาสตร์/,'sci-fi'],[/แฟนตาซี|เวทมนตร์/,'fantasy'],[/อบอุ่น|กำลังใจ|ใจฟู|ผ่อนคลาย/,'feel good'],[/เศร้า|ร้องไห้|ดราม่า/,'drama'],[/bl|boy.?s? love|ชายรักชาย|วาย/,'y series'],[/gl|girl.?s? love|หญิงรักหญิง|ยูริ/,'yuri']];const fields=normalize([m.main_genre,m.genre,m.mood,m.theme,m.situation,m.preference,m.keywords].join(' '));for(const [re,word] of rules)if(re.test(n)&&fields.includes(normalize(word)))boost+=.12;return boost}
// คำนวณคะแนนและจัดอันดับผลลัพธ์
function rankMovies(q){const qv=tfidfVector(q);return state.movies.map((m,i)=>{const sim=cosine(qv,tfidfVector(movieText(m)));const score=Math.min(100,(sim+keywordBoost(m,q))*100);return {m,score}}).sort((a,b)=>b.score-a.score||Number(b.rating||0)-Number(a.rating||0))}
function showIntent(q){const n=normalize(q);const rules=[[/รัก|โรแมนติก|คู่รัก|แอบรัก/,'♥ ความรัก'],[/ตลก|ขำ|ฮา|เบาสมอง/,'☺ ตลก'],[/ผี|หลอน|สยอง/,'☾ Horror'],[/อบอุ่น|กำลังใจ|ใจฟู|ผ่อนคลาย/,'✿ Feel Good'],[/แอ็กชัน|ต่อสู้|มัน/,'⚡ Action'],[/ปริศนา|สืบสวน|ไขคดี/,'⌕ Mystery'],[/ลุ้น|ระทึก|กดดัน/,'! Thriller'],[/ไซไฟ|อนาคต|วิทยาศาสตร์/,'✦ Sci-Fi'],[/แฟนตาซี|เวทมนตร์/,'✧ Fantasy'],[/เศร้า|ร้องไห้|ดราม่า/,'♡ Drama'],[/bl|ชายรักชาย|วาย/,'♥ Y Series (BL)'],[/gl|หญิงรักหญิง|ยูริ/,'♥ Yuri Series (GL)']];const tags=rules.filter(([r])=>r.test(n)).map(([,t])=>t);$('#intentPanel').innerHTML=(tags.length?tags:['⌕ ค้นจากข้อมูลใน Dataset']).map(x=>`<span class="intent-tag">${esc(x)}</span>`).join('')}
const categoryMeta={
'โรแมนติก':['💗','ความรักและความสัมพันธ์'],'Romance':['💗','ความรักและความสัมพันธ์'],
'ตลก':['😂','ตลกและเบาสมอง'],'คอมเมดี้':['😂','ตลกและเบาสมอง'],'Comedy':['😂','ตลกและเบาสมอง'],
'ดราม่า':['🎭','ดราม่าเข้มข้น'],'Drama':['🎭','ดราม่าเข้มข้น'],
'สยองขวัญ':['👻','หลอนและสยอง'],'Horror':['👻','หลอนและสยอง'],
'แอ็กชัน':['🚀','ต่อสู้และความมัน'],'Action':['🚀','ต่อสู้และความมัน'],
'สืบสวนสอบสวน':['🔍','ปริศนาและการค้นหา'],'Mystery':['🔍','ปริศนาและการค้นหา'],
'ทริลเลอร์':['⚡','ตื่นเต้นและกดดัน'],'Thriller':['⚡','ตื่นเต้นและกดดัน'],
'ไซไฟ':['🛸','วิทยาศาสตร์และอนาคต'],'Sci-Fi':['🛸','วิทยาศาสตร์และอนาคต'],
'แฟนตาซี':['🪄','โลกเหนือจินตนาการ'],'Fantasy':['🪄','โลกเหนือจินตนาการ'],
'สารคดี':['🎬','เรื่องจริงและสาระ'],'Documentary':['🎬','เรื่องจริงและสาระ'],
'Feel Good':['🌱','ผ่อนคลายและอบอุ่น'],'FeelGood':['🌱','ผ่อนคลายและอบอุ่น'],
'Y Series':['💙','Boy’s Love (BL)'],'Y Series (BL)':['💙','Boy’s Love (BL)'],
'Yuri Series':['💜','Girl’s Love (GL)'],'Yuri Series (GL)':['💜','Girl’s Love (GL)']};
function renderCategories(){const cats=[...new Set(state.movies.map(m=>m.main_genre).filter(Boolean))];$('#categoryCount').textContent=`${cats.length} หมวด`;$('#categoryGrid').innerHTML=cats.map(cat=>{const meta=categoryMeta[cat]||['✦','ค้นหาเรื่องในหมวดนี้'];return `<button class="category-card" data-query="อยากดู ${esc(cat)}"><span class="category-icon">${meta[0]}</span><strong>${esc(cat)}</strong><small>${esc(meta[1])}</small></button>`}).join('')}
function posterPath(m){const raw=String(m.poster||'').trim();if(!raw)return '';if(/^https?:\/\//i.test(raw))return raw;const clean=raw.replace(/^\.\//,'').replace(/^data\/poster\//,'');return `data/poster/${encodeURIComponent(clean).replace(/%2F/gi,'/')}`}
function posterHtml(m,cls='poster-wrap'){const src=posterPath(m);return `<div class="${cls}">${src?`<img src="${esc(src)}" alt="${esc(m.title)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`:''}<div class="poster-placeholder" style="${src?'display:none':''}"><span>🧅</span><small>ไม่มีโปสเตอร์</small></div>${src?`<div class="poster-placeholder" style="display:none"><span>🧅</span><small>ไม่พบโปสเตอร์</small></div>`:''}</div>`}
function matchingTerms(text,q){const doc=normalize(text);return tokens(q).filter(t=>t.length>1&&doc.includes(t)).filter((v,i,a)=>a.indexOf(v)===i).slice(0,6)}
function explainMatch(m,q,score){
 const fields=[
  ['💜 Mood',m.mood],['🎭 Theme',m.theme],['📍 Situation',m.situation],['✨ Preference',m.preference],['🎬 Genre',[m.main_genre,m.genre].filter(Boolean).join(', ')],['🔑 Keywords',m.keywords]
 ];
 const hits=fields.map(([label,val])=>({label,val,h:matchingTerms(val,q)})).filter(x=>x.h.length);
 if(!hits.length){
  const fallback=fields.filter(([,v])=>v).slice(0,3).map(([label])=>label);
  return {summary:score>25?'พบความใกล้เคียงจากหลายข้อมูลใน Dataset':'ระบบพบเรื่องที่มีความเกี่ยวข้องใกล้เคียง',hits:fallback.map(label=>({label,h:[]}))};
 }
 return {summary:`ตรงกับข้อมูล ${hits.length} ด้านใน Dataset`,hits:hits.slice(0,4)};
}
function escapeRegex(s){return String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}
function highlightText(text,q){
 const raw=String(text??'');
 const terms=[...new Set(tokens(q).filter(t=>t.length>1))].sort((a,b)=>b.length-a.length).slice(0,12);
 if(!raw||!terms.length)return esc(raw);
 const re=new RegExp('('+terms.map(escapeRegex).join('|')+')','gi');
 return raw.split(re).map(part=>terms.some(t=>normalize(part)===normalize(t))?`<mark class="search-highlight">${esc(part)}</mark>`:esc(part)).join('');
}
function explanationHtml(m,q,score){const ex=explainMatch(m,q,score);return `<div class="match-explanation"><div class="match-head"><span>💡 ทำไมเรื่องนี้ถึงติดอันดับ?</span><small>${esc(ex.summary)}</small></div><div class="match-list">${ex.hits.map(x=>`<span class="match-chip"><b>${esc(x.label)}</b>${x.h.length?` ${esc(x.h.join(', '))}`:' ใกล้เคียงกับคำค้น'}</span>`).join('')}</div></div>`}
function card(item){const m=item.m;const fav=state.favorites.includes(String(m.id));const meta=[m.type,m.year,m.country].filter(Boolean).join(' · ');return `<article class="movie-card">${posterHtml(m)}<div class="movie-content"><div class="movie-title-box"><h3>${esc(m.title)}</h3></div><div class="movie-meta">${esc(meta||'ไม่ระบุข้อมูล')}</div><span class="score">ตรงกับคำค้น ${Math.round(item.score)}%</span>${explanationHtml(m,state.lastQuery,item.score)}<p class="movie-reason">${highlightText(m.description||'มีข้อมูลเรื่องใน Dataset แต่ยังไม่มีคำอธิบายเพิ่มเติม',state.lastQuery)}</p><div class="highlight-fields"><span class="highlight-label">🔑 คำที่ตรงในข้อมูล</span>${[['Mood',m.mood],['Theme',m.theme],['Situation',m.situation],['Keywords',m.keywords]].filter(([,v])=>v).map(([label,v])=>`<div class="highlight-row"><b>${esc(label)}:</b> ${highlightText(v,state.lastQuery)}</div>`).join('')}</div><div class="card-actions"><button data-detail="${esc(m.id)}">ดูรายละเอียด</button><button data-fav="${esc(m.id)}" class="${fav?'favorite-active':''}">${fav?'♥ บันทึกแล้ว':'♡ รายการโปรด'}</button></div></div></article>`}
function renderFilterOptions(){
 const genres=[...new Set(state.movies.map(m=>String(m.main_genre||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'th'));
 const years=[...new Set(state.movies.map(m=>String(m.year||'').trim()).filter(Boolean))].sort((a,b)=>Number(b)-Number(a));
 $('#filterGenre').innerHTML='<option value="all">ทุกหมวดหมู่</option>'+genres.map(g=>`<option value="${esc(g)}">${esc(g)}</option>`).join('');
 $('#filterYear').innerHTML='<option value="all">ทุกปี</option>'+years.map(y=>`<option value="${esc(y)}">${esc(y)}</option>`).join('');
 $('#filterRating').innerHTML='<option value="all">ทุกคะแนน</option><option value="8">8.0 ขึ้นไป</option><option value="7">7.0 ขึ้นไป</option><option value="6">6.0 ขึ้นไป</option><option value="5">5.0 ขึ้นไป</option>';
 syncFilterControls();
}
function syncFilterControls(){
 if($('#filterGenre'))$('#filterGenre').value=state.filterGenre;
 if($('#filterYear'))$('#filterYear').value=state.filterYear;
 if($('#filterRating'))$('#filterRating').value=state.filterRating;
 if($('#sortBy'))$('#sortBy').value=state.sortBy;
}
function getFilteredResults(){
 const type=state.resultFilter;
 let items=state.resultItems.filter(x=>type==='all'||String(x.m.type).trim()===type);
 if(state.filterGenre!=='all')items=items.filter(x=>String(x.m.main_genre||'').trim()===state.filterGenre);
 if(state.filterYear!=='all')items=items.filter(x=>String(x.m.year||'').trim()===state.filterYear);
 if(state.filterRating!=='all')items=items.filter(x=>Number(x.m.rating||0)>=Number(state.filterRating));
 return items.sort((a,b)=>{
  if(state.sortBy==='rating')return Number(b.m.rating||0)-Number(a.m.rating||0)||b.score-a.score;
  if(state.sortBy==='year')return Number(b.m.year||0)-Number(a.m.year||0)||b.score-a.score;
  if(state.sortBy==='title')return String(a.m.title||'').localeCompare(String(b.m.title||''),'th');
  return b.score-a.score||Number(b.m.rating||0)-Number(a.m.rating||0);
 });
}
function renderResultCards(){const items=getFilteredResults();$('#resultMeta').textContent=`พบ ${items.length} เรื่อง · จัดอันดับด้วย TF-IDF + Cosine Similarity`;$('#resultsGrid').innerHTML=items.length?items.map(card).join(''):'<div class="empty">ยังไม่มีเรื่องที่ตรงกับตัวกรอง ลองเปลี่ยนตัวกรองหรือค้นหาใหม่</div>'}
function resetFilters(){state.filterGenre='all';state.filterYear='all';state.filterRating='all';state.sortBy='score';syncFilterControls();renderResultCards();}

function renderRandomGenreOptions(){
 const select=$('#randomGenre'); if(!select)return;
 const genres=[...new Set(state.movies.map(m=>String(m.main_genre||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'th'));
 select.innerHTML='<option value="all">ทุกหมวดหมู่</option>'+genres.map(g=>`<option value="${esc(g)}">${esc(g)}</option>`).join('');
}
function openRandomPicker(){
 renderRandomGenreOptions();
 $('#randomResult').innerHTML='<div class="random-placeholder">🧅<br><small>กดปุ่มเพื่อให้หัวหอมเลือกเรื่องให้คุณ</small></div>';
 $('#randomModal').classList.remove('hidden');
}
function closeRandomPicker(){$('#randomModal').classList.add('hidden')}
function randomPick(){
 const type=$('#randomType').value, genre=$('#randomGenre').value;
 const pool=state.movies.filter(m=>(type==='all'||String(m.type).trim()===type)&&(genre==='all'||String(m.main_genre||'').trim()===genre));
 if(!pool.length){$('#randomResult').innerHTML='<div class="random-placeholder">😅<br><small>ยังไม่มีเรื่องที่ตรงกับเงื่อนไขนี้ ลองเลือกใหม่</small></div>';return}
 const m=pool[Math.floor(Math.random()*pool.length)];
 const src=posterPath(m);
 const img=src?`<div class="random-poster"><img src="${esc(src)}" alt="${esc(m.title)}" onerror="this.parentElement.innerHTML='🧅'"></div>`:`<div class="random-poster" style="display:grid;place-items:center;font-size:28px">🧅</div>`;
 $('#randomResult').innerHTML=`<div class="random-card">${img}<div class="random-info"><div class="random-meta">${esc([m.type,m.year,m.main_genre].filter(Boolean).join(' · '))}</div><h3>${esc(m.title)}</h3><p>${esc((m.description||'เรื่องที่หัวหอมสุ่มเลือกให้คุณ').slice(0,170))}${(m.description||'').length>170?'…':''}</p><div class="random-actions"><button type="button" data-random-detail="${esc(m.id)}">ดูรายละเอียด</button><button type="button" data-random-again>🎲 สุ่มอีกครั้ง</button></div></div></div>`;
}

function trendingScore(m){
 const rating=parseFloat(String(m.rating||'').replace(/[^0-9.]/g,''))||0;
 const favBoost=state.favorites.includes(String(m.id))?3:0;
 const year=parseInt(m.year)||0;
 const recency=year?Math.max(0,Math.min(1,(year-2018)/10)):0;
 return rating*10+favBoost+recency*5;
}
function renderTrending(){
 const grid=$('#trendingGrid'); if(!grid)return;
 const sorted=[...state.movies].sort((a,b)=>trendingScore(b)-trendingScore(a));
 const offset=Math.floor(Math.random()*Math.max(1,Math.min(6,sorted.length)));
 const picks=[...sorted.slice(offset,offset+6),...sorted].slice(0,6);
 grid.innerHTML=picks.map((m,i)=>{
   const fav=state.favorites.includes(String(m.id));
   const rating=parseFloat(String(m.rating||'').replace(/[^0-9.]/g,''))||0;
   return `<article class="trending-card">
     <div class="trend-rank">#${i+1}</div>
     ${posterHtml(m)}
     <div class="trending-content">
       <div class="trending-meta">${esc([m.type,m.year].filter(Boolean).join(' · '))}</div>
       <h3>${esc(m.title)}</h3>
       <div class="trending-info"><span>🔥 กำลังน่าสนใจ</span>${rating?`<b>⭐ ${rating.toFixed(1)}</b>`:''}</div>
       <div class="trending-actions"><button data-detail="${esc(m.id)}">ดูรายละเอียด</button><button data-fav="${esc(m.id)}" class="${fav?'favorite-active':''}">${fav?'♥':'♡'}</button></div>
     </div>
   </article>`;
 }).join('');
}

function hideAll(){['home','results','detail','favorites','history','about'].forEach(id=>$('#'+id).classList.add('hidden'));$$('[data-nav]').forEach(a=>a.classList.remove('active'))}
function setActiveNav(id){const a=$(`[data-nav="${id}"]`);if(a)a.classList.add('active')}
function home(push=true){hideAll();$('#home').classList.remove('hidden');setActiveNav('home');if(push)history.replaceState(null,'','#home');window.scrollTo({top:0,behavior:'smooth'})}

function shareSearchResults(){
 const q=String(state.lastQuery||'').trim();
 if(!q){toast('ยังไม่มีผลการค้นหาที่จะแชร์');return}
 const url=new URL(location.href);
 url.hash='results';
 url.searchParams.set('q',q);
 const shareUrl=url.toString();
 const shareData={title:'🧅 หัวหอม — ผลการค้นหาหนังและซีรีส์',text:`มาดูผลการค้นหา “${q}” จากหัวหอมกัน 🧅💜`,url:shareUrl};
 const copied=()=>toast('คัดลอกลิงก์ผลการค้นหาแล้ว 📋');
 const fallback=()=>{
   if(navigator.clipboard&&location.protocol!=='file:')navigator.clipboard.writeText(shareUrl).then(copied).catch(()=>window.prompt('คัดลอกลิงก์นี้เพื่อแชร์:',shareUrl));
   else window.prompt('คัดลอกลิงก์นี้เพื่อแชร์:',shareUrl);
 };
 if(navigator.share)navigator.share(shareData).then(()=>toast('แชร์ผลการค้นหาแล้ว 📤')).catch(err=>{if(err&&err.name!=='AbortError')fallback()});
 else fallback();
}

function showResults(q,{more=false,push=true}={}){if(!state.movies.length)return;state.lastQuery=q;showIntent(q);hideAll();$('#results').classList.remove('hidden');setActiveNav('home');$('#searchedText').textContent=`“${q}”`;if(!more)state.usedIds=[];const ranked=rankMovies(q).filter(x=>!state.usedIds.includes(String(x.m.id)));state.resultItems=ranked.slice(0,12);state.usedIds.push(...state.resultItems.map(x=>String(x.m.id)));state.resultFilter='all';state.filterGenre='all';state.filterYear='all';state.filterRating='all';state.sortBy='score';$$('.result-tab').forEach(b=>b.classList.toggle('active',b.dataset.filter==='all'));syncFilterControls();renderResultCards();const now=new Date();const record={query:q,time:now.toISOString(),results:state.resultItems.length};state.history=[record,...state.history.filter(x=>{const qq=typeof x==='string'?x:x.query;return normalize(qq)!==normalize(q)})].slice(0,50);state.lastSearchTime=now.toLocaleString('th-TH');save();if(push){const u=new URL(location.href);u.searchParams.set('q',q);u.hash='results';history.replaceState(null,'',u.pathname+u.search+u.hash)}window.scrollTo({top:0,behavior:'smooth'})}
function watchPlatformsHtml(value){
  const raw=String(value||'').trim();
  if(!raw)return '';
  const parts=raw.split(/\s*(?:\/|\||,|;|\n)\s*/).map(x=>x.trim()).filter(Boolean);
  if(!parts.length)return '';
  const iconMap={
    netflix:'🔴', trueid:'🔵', 'true id':'🔵', disney:'🏰', 'disney+':'🏰',
    viu:'🟡', wetv:'💙', iqiyi:'💚', prime:'🟦', 'amazon prime':'🟦',
    hbo:'🎬', max:'🎬', youtube:'▶️', 'google tv':'📺', appletv:'🍎', 'apple tv':'🍎'
  };
  const platformIcon=name=>{
    const key=name.toLowerCase();
    const found=Object.keys(iconMap).find(k=>key.includes(k));
    return found?iconMap[found]:'📺';
  };
  return `<div class="watch-section"><h2>ช่องทางการรับชม</h2><div class="watch-platforms">${parts.map(name=>{
    if(/^https?:\/\//i.test(name))return `<a class="watch-platform watch-link" href="${esc(name)}" target="_blank" rel="noopener">▶ เปิดช่องทางรับชม ↗</a>`;
    return `<span class="watch-platform"><span>${platformIcon(name)}</span>${esc(name)}</span>`;
  }).join('')}</div></div>`;
}

function detail(id){const m=state.movies.find(x=>String(x.id)===String(id));if(!m)return;hideAll();$('#detail').classList.remove('hidden');setActiveNav('home');const fav=state.favorites.includes(String(m.id));const tags=[m.main_genre,m.genre,m.mood].filter(Boolean).join(',').split(',').map(x=>x.trim()).filter(Boolean).slice(0,12);const watch=watchPlatformsHtml(m.watch_url);$('#detail').innerHTML=`<div class="section detail-section"><button class="back-link" id="detailBack">← กลับหน้าก่อนหน้า</button><div class="detail-card"><div class="detail-layout"><div>${posterHtml(m,'detail-poster')}</div><div class="detail-info"><div class="eyebrow">${esc(m.type||'DETAIL')}</div><h1>${esc(m.title)}</h1><div class="detail-meta">${esc([m.original_title,m.year,m.country,m.rating].filter(Boolean).join(' · '))}</div><div class="detail-tags">${tags.map(t=>`<span class="detail-tag">${esc(t)}</span>`).join('')}</div><h2>เรื่องย่อ</h2><p>${esc(m.description||'ยังไม่มีเรื่องย่อใน Dataset')}</p><h2>อารมณ์และสถานการณ์</h2><p><b>อารมณ์:</b> ${esc(m.mood||'ไม่ระบุ')}</p><p><b>ธีม:</b> ${esc(m.theme||'ไม่ระบุ')}</p><p><b>สถานการณ์:</b> ${esc(m.situation||'ไม่ระบุ')}</p><p><b>เหมาะกับ:</b> ${esc(m.preference||'ไม่ระบุ')}</p>${watch}<h2>Keywords</h2><p>${esc(m.keywords||'ไม่ระบุ')}</p><div class="detail-actions"><button id="detailFav" class="outline-btn">${fav?'♥ อยู่ในรายการโปรด':'♡ เพิ่มรายการโปรด'}</button></div></div></div></div></div>`;$('#detailBack').onclick=()=>{if(state.lastQuery)showResults(state.lastQuery,{push:true});else home()};$('#detailFav').onclick=()=>{const wasFav=state.favorites.includes(String(m.id));toggleFav(String(m.id));detail(m.id);toast(wasFav?'ลบออกจากรายการโปรดแล้ว':'เพิ่มในรายการโปรดแล้ว')};window.history.replaceState(null,'',`#detail-${encodeURIComponent(id)}`);window.scrollTo({top:0,behavior:'smooth'})}
function toggleFav(id){state.favorites=state.favorites.includes(id)?state.favorites.filter(x=>x!==id):[...state.favorites,id];save();toast(state.favorites.includes(id)?'เพิ่มรายการโปรดแล้ว':'ลบออกจากรายการโปรดแล้ว')}
function renderFavoritesDetailed(){
 const all=state.movies.filter(m=>state.favorites.includes(String(m.id)));
 const countBy=t=>t==='all'?all.length:all.filter(m=>String(m.type).trim()===t).length;
 $('#favoritesTotal').textContent=all.length;
 $('#favCountAll').textContent=countBy('all');
 $('#favCountMovie').textContent=countBy('Movie');
 $('#favCountSeries').textContent=countBy('Series');
 const favDoc=$('#favCountDocumentary');if(favDoc)favDoc.textContent=countBy('Documentary');
 let ms=all.filter(m=>state.favoriteFilter==='all'||String(m.type).trim()===state.favoriteFilter);
 const q=normalize(state.favoriteSearch);
 if(q)ms=ms.filter(m=>movieText(m).includes(q)||normalize(m.title).includes(q));
 ms.sort((a,b)=>{
   if(state.favoriteSort==='rating')return Number(b.rating||0)-Number(a.rating||0);
   if(state.favoriteSort==='year')return Number(b.year||0)-Number(a.year||0);
   if(state.favoriteSort==='title')return String(a.title||'').localeCompare(String(b.title||''),'th');
   return state.favorites.indexOf(String(b.id))-state.favorites.indexOf(String(a.id));
 });
 $$('.favorite-tab').forEach(b=>b.classList.toggle('active',b.dataset.favoriteFilter===state.favoriteFilter));
 $('#favoriteSearchInput').value=state.favoriteSearch;
 $('#favoriteSort').value=state.favoriteSort;
 $('#favoritesSummary').textContent=all.length?`กำลังแสดง ${ms.length} จาก ${all.length} รายการโปรด`:'';
 $('#favoritesGrid').innerHTML=ms.length?ms.map(m=>card({m,score:100})).join(''):(all.length?'<div class="empty">🔎<br>ไม่พบรายการที่ตรงกับการค้นหาหรือตัวกรอง</div>':'<div class="empty">♥<br>ยังไม่มีรายการโปรด<br><small>กด “รายการโปรด” บนหนังที่คุณชอบเพื่อบันทึกไว้</small></div>');
}
// เรียกใช้ระบบค้นหาและแสดงผลลัพธ์
function showFavorites(push=true){hideAll();$('#favorites').classList.remove('hidden');setActiveNav('favorites');renderFavoritesDetailed();if(push)history.replaceState(null,'','#favorites');window.scrollTo({top:0,behavior:'smooth'})}
function historyRecord(x){return typeof x==='string'?{query:x,time:null,results:null}:x}
function formatHistoryTime(t){if(!t)return 'ไม่ทราบเวลา';const d=new Date(t);if(Number.isNaN(d.getTime()))return 'ไม่ทราบเวลา';return d.toLocaleString('th-TH',{dateStyle:'medium',timeStyle:'short'})}
function renderHistoryDetailed(){const term=normalize(state.historySearch||'');let items=state.history.map((x,i)=>({...historyRecord(x),_i:i})).filter(x=>!term||normalize(x.query).includes(term));items.sort((a,b)=>{if(state.historySort==='az')return String(a.query).localeCompare(String(b.query),'th');const ta=new Date(a.time||0).getTime(),tb=new Date(b.time||0).getTime();return state.historySort==='oldest'?ta-tb:tb-ta});const unique=new Set(state.history.map(x=>normalize(historyRecord(x).query))).size;$('#historyStats').innerHTML=`<span>🕘 ทั้งหมด <b>${state.history.length}</b> ครั้ง</span><span>🔎 คำค้นไม่ซ้ำ <b>${unique}</b> คำ</span><span>📋 กำลังแสดง <b>${items.length}</b> รายการ</span>`;$('#historyList').innerHTML=items.length?items.map(x=>`<div class="history-item detailed" data-history="${x._i}"><div class="history-main"><span class="history-query">⌕ ${esc(x.query)}</span><span class="history-date">🗓️ ${esc(formatHistoryTime(x.time))}${x.results!=null?` · พบ ${x.results} เรื่อง`:''}</span></div><div class="history-actions"><button class="small-outline" data-history-query="${x._i}">ค้นหาอีกครั้ง</button><button class="small-danger" data-history-delete="${x._i}" title="ลบรายการนี้">×</button></div></div>`).join(''):'<div class="empty">🕘<br>ไม่พบประวัติการค้นหา</div>'}
function showHistory(push=true){hideAll();$('#history').classList.remove('hidden');setActiveNav('history');renderHistoryDetailed();if(push)history.replaceState(null,'','#history');window.scrollTo({top:0,behavior:'smooth'})}
function showAbout(){hideAll();$('#about').classList.remove('hidden');setActiveNav('about');history.replaceState(null,'','#about');window.scrollTo({top:0,behavior:'smooth'})}
function route(){const h=decodeURIComponent(location.hash||'#home');const sharedQ=new URLSearchParams(location.search).get('q');if(h==='#home'||h==='#')home(false);else if(h==='#favorites')showFavorites(false);else if(h==='#history')showHistory(false);else if(h==='#about')showAbout();else if(h==='#results'&&(sharedQ||state.lastQuery))showResults(sharedQ||state.lastQuery,{push:false});else if(h.startsWith('#detail-'))detail(h.slice(8));else home(false)}
function applyTheme(){const dark=localStorage.getItem('onionTheme')==='dark';document.body.classList.toggle('dark',dark);$('#themeToggle').textContent=dark?'☀':'☾'}
async function load(){try{const r=await fetch(`data/movies.csv?ts=${Date.now()}`,{cache:'no-store'});if(!r.ok)throw Error('CSV');const text=await r.text();state.movies=csvParse(text);state.movies.forEach(m=>{m.id=String(m.id??'').replace(/^\uFEFF/,'').trim();if(String(m.type).trim()==='TV Show')m.type='Series'});state.favorites=[...new Set(state.favorites.map(v=>String(v??'').replace(/^\uFEFF/,'').trim()).filter(Boolean))];buildIndex();renderCategories();renderFilterOptions();renderRandomGenreOptions();renderTrending();$('#datasetStatus').textContent=`Dataset พร้อมใช้งาน ${state.movies.length} เรื่อง · ค้นหาด้วยระบบ IR`;save();route()}catch(e){$('#datasetStatus').textContent='โหลด Dataset ไม่สำเร็จ — กรุณาเปิดผ่าน Live Server หรือเว็บเซิร์ฟเวอร์'} }
function bind(){document.addEventListener('click',e=>{const q=e.target.closest('[data-query]');if(q){$('#queryInput').value=q.dataset.query;showResults(q.dataset.query)}const mood=e.target.closest('[data-mood-query]');if(mood){const query=mood.dataset.moodQuery;$('#queryInput').value=query;showResults(query)}const d=e.target.closest('[data-detail]');if(d)detail(d.dataset.detail);const f=e.target.closest('[data-fav]');if(f){toggleFav(String(f.dataset.fav));if(!$('#favorites').classList.contains('hidden'))renderFavoritesDetailed();else if(!$('#results').classList.contains('hidden'))renderResultCards()}const hd=e.target.closest('[data-history-delete]');if(hd){state.history.splice(Number(hd.dataset.historyDelete),1);save();renderHistoryDetailed();toast('ลบประวัติรายการนี้แล้ว');return}const hq=e.target.closest('[data-history-query]');if(hq){const rec=historyRecord(state.history[Number(hq.dataset.historyQuery)]);showResults(rec.query);return}const h=e.target.closest('[data-history]');if(h&&!e.target.closest('button')){const rec=historyRecord(state.history[Number(h.dataset.history)]);showResults(rec.query);return}const tab=e.target.closest('.result-tab');if(tab){state.resultFilter=tab.dataset.filter;renderResultCards()}if(e.target.closest('#backHomeBtn'))home();if(e.target.closest('#moreBtn'))showResults(state.lastQuery,{more:true});if(e.target.closest('#shareResultsBtn'))shareSearchResults();if(e.target.closest('#resetFiltersBtn'))resetFilters();if(e.target.closest('#refreshTrendingBtn'))renderTrending();if(e.target.closest('#randomPickBtn'))openRandomPicker();if(e.target.closest('#randomCloseBtn'))closeRandomPicker();if(e.target.closest('#randomPickAgainBtn'))randomPick();const rd=e.target.closest('[data-random-detail]');if(rd){closeRandomPicker();detail(rd.dataset.randomDetail)}if(e.target.closest('[data-random-again]'))randomPick();const ff=e.target.closest('[data-favorite-filter], .favorite-tab');if(ff){state.favoriteFilter=ff.dataset.favoriteFilter||'all';renderFavoritesDetailed()}
if(e.target.closest('#clearFavoritesBtn')){if(state.favorites.length&&confirm('ต้องการล้างรายการโปรดทั้งหมดใช่ไหม?')){state.favorites=[];save();renderFavoritesDetailed();toast('ล้างรายการโปรดแล้ว')}}
if(e.target.closest('#clearHistoryBtn')){state.history=[];save();renderHistoryDetailed();toast('ล้างประวัติแล้ว')} });
 $('#randomModal').addEventListener('click',e=>{if(e.target===$('#randomModal'))closeRandomPicker()});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#randomModal').classList.contains('hidden'))closeRandomPicker()});
 $('#favoriteSearchInput').addEventListener('input',e=>{state.favoriteSearch=e.target.value;renderFavoritesDetailed()});
 $('#favoriteSort').addEventListener('change',e=>{state.favoriteSort=e.target.value;renderFavoritesDetailed()});
 $('#historySearchInput').addEventListener('input',e=>{state.historySearch=e.target.value;renderHistoryDetailed()});
 $('#historySort').addEventListener('change',e=>{state.historySort=e.target.value;renderHistoryDetailed()});
 $('#filterGenre').addEventListener('change',e=>{state.filterGenre=e.target.value;renderResultCards()});
 $('#filterYear').addEventListener('change',e=>{state.filterYear=e.target.value;renderResultCards()});
 $('#filterRating').addEventListener('change',e=>{state.filterRating=e.target.value;renderResultCards()});
 $('#sortBy').addEventListener('change',e=>{state.sortBy=e.target.value;renderResultCards()});
 $('#searchForm').addEventListener('submit',e=>{e.preventDefault();const q=$('#queryInput').value.trim();if(q)showResults(q)});$('#themeToggle').onclick=()=>{const dark=!document.body.classList.contains('dark');localStorage.setItem('onionTheme',dark?'dark':'light');applyTheme()};$('#mobileMenu').onclick=()=>{const nav=$('.main-nav');const opened=nav.classList.toggle('open');$('#mobileMenu').setAttribute('aria-expanded',String(opened))};$$('.main-nav a').forEach(a=>a.onclick=()=>{$('.main-nav').classList.remove('open');$('#mobileMenu').setAttribute('aria-expanded','false')});window.addEventListener('hashchange',route);window.addEventListener('scroll',()=>$('#toTop').classList.toggle('show',scrollY>500));$('#toTop').onclick=()=>scrollTo({top:0,behavior:'smooth'})}
applyTheme();bind();load();
