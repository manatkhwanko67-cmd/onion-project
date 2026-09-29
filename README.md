# 🧅 Onion — ระบบค้นหาหนังและซีรีส์ตามความรู้สึก

เว็บแอป Static สำหรับค้นหาหนัง/ซีรีส์จากความรู้สึกและสถานการณ์ด้วย Information Retrieval (IR)

## เทคนิคที่ใช้
- Text Preprocessing / Normalization
- Tokenization และ character n-grams สำหรับข้อความไทย
- TF-IDF
- Cosine Similarity
- Ranking

## ไม่มี AI / API
โปรเจกต์เวอร์ชันนี้ไม่เรียก AI, API หรือ API Key และสามารถนำขึ้น GitHub Pages ได้

## Dataset
ข้อมูลอยู่ที่ `data/movies.csv` และหน้าเว็บอ่านข้อมูลแบบ Dynamic ดังนั้นสามารถเพิ่มแถวใหม่ใน CSV ได้โดยไม่ต้องแก้ HTML สำหรับแต่ละเรื่อง

คอลัมน์หลักที่ควรรักษาชื่อเดิม:
`id,title,original_title,type,year,main_genre,genre,mood,theme,situation,preference,language,country,description,keywords,rating,poster,watch_url`

`type` แนะนำให้ใช้ `Movie`, `Series`, `Documentary`

## Poster
ถ้า `poster` เป็น `1.jpg` ให้เก็บที่ `data/poster/1.jpg` ตาม ID ของเรื่อง

## เปิดโปรเจกต์
ใช้ VS Code + Live Server หรือเว็บเซิร์ฟเวอร์ แล้วเปิด `index.html`
