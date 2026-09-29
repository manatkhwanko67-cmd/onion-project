import fs from 'node:fs/promises';

function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}})}
function csvParse(text){const rows=[];let row=[],cell='',q=false;for(let i=0;i<text.length;i++){const ch=text[i],n=text[i+1];if(ch==='"'){if(q&&n==='"'){cell+='"';i++}else q=!q}else if(ch===','&&!q){row.push(cell);cell=''}else if((ch==='\n'||ch==='\r')&&!q){if(ch==='\r'&&n==='\n')i++;row.push(cell);if(row.some(v=>v.trim()))rows.push(row);row=[];cell=''}else cell+=ch}if(cell||row.length){row.push(cell);rows.push(row)}const h=rows.shift().map(x=>x.replace(/^\uFEFF/,''));return rows.map(r=>Object.fromEntries(h.map((k,i)=>[k,r[i]??''])))}

export async function POST(req){
  if(!process.env.OPENAI_API_KEY)return json({error:'OPENAI_API_KEY is not configured'},503);
  try{
    const body=await req.json(); const query=String(body.query||'').trim(); const candidates=Array.isArray(body.candidates)?body.candidates.slice(0,25):[];
    if(!query||!candidates.length)return json({error:'query and candidates are required'},400);
    const compact=candidates.map(m=>({id:String(m.id),title:m.title,original_title:m.original_title,type:m.type,year:m.year,genre:m.genre,main_genre:m.main_genre,mood:m.mood,theme:m.theme,situation:m.situation,preference:m.preference,description:m.description,keywords:m.keywords}));
    const prompt=`ผู้ใช้ต้องการดูหนัง/ซีรีส์: "${query}"\n\nเลือกจากรายชื่อที่ให้เท่านั้น ห้ามสร้างชื่อหรือ id ใหม่ ให้เลือก 3-5 เรื่องที่เหมาะที่สุด จัดอันดับตามความเหมาะสม วิเคราะห์ความรู้สึกและความต้องการของผู้ใช้ด้วย หากข้อมูลเรื่องใดไม่พอ ให้ใช้ web search เพื่อตรวจสอบข้อมูลสาธารณะล่าสุด แต่ห้ามเดาข้อมูล\n\nรายชื่อ候选 (JSON):\n${JSON.stringify(compact)}\n\nตอบเป็น JSON เท่านั้นตาม schema: {"recommendations":[{"id":"...","score":0-100,"reason":"เหตุผลภาษาไทยสั้น ๆ","sources":[{"title":"ชื่อแหล่งข้อมูล","url":"https://..."}]}]}. sources ใส่เฉพาะแหล่งที่ใช้จริงและเป็น URL ที่เข้าถึงได้`; 
    const model=process.env.OPENAI_MODEL||'gpt-5.6-luna';
    const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'Authorization':`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model,tools:[{type:'web_search'}],input:[{role:'system',content:[{type:'input_text',text:'คุณคือ AI แนะนำหนังของระบบหัวหอม ใช้ภาษาไทย ชื่อและ id ต้องมาจาก candidate เท่านั้น'}]},{role:'user',content:[{type:'input_text',text:prompt}]}],temperature:0.2})});
    if(!response.ok){const t=await response.text();return json({error:'OpenAI request failed',detail:t.slice(0,500)},502)}
    const data=await response.json(); let text=data.output_text||''; text=text.replace(/^```json\s*/,'').replace(/\s*```$/,'').trim(); const parsed=JSON.parse(text);
    const allowed=new Set(compact.map(x=>x.id)); parsed.recommendations=(parsed.recommendations||[]).filter(x=>allowed.has(String(x.id))).slice(0,5);
    return json(parsed);
  }catch(e){return json({error:'AI recommendation failed',detail:String(e.message||e)},500)}
}
export async function GET(){return json({ok:true,service:'onion-ai-recommend'})}
