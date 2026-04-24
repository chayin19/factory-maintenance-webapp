# Manual Test Plan

ทดสอบหลัง deploy เป็น Google Apps Script Web App

## เตรียมระบบ

- [ ] เปิด Apps Script Editor
- [ ] รัน `setupDatabase()`
- [ ] รัน `checkSystemHealth()` และตรวจว่า `ok` เป็น `true`
- [ ] เปิด Google Sheets database จาก `MAINTENANCE_DB_ID`
- [ ] ตรวจว่ามีชีตครบทั้ง 8 ชีต

## Checklist หลัก

- [ ] Open home page: เปิด `/exec`
- [ ] ตรวจว่าหน้าแรกแสดงเครื่องจักร active และจัดกลุ่มตามโรงงาน/ประเภทเครื่อง
- [ ] Open report page for CS-01: เปิด `/exec?page=report&machine_id=CS-01`
- [ ] Submit normal problem: เลือกอาการปกติ เลือกระดับความรุนแรง กรอกหมายเหตุ แล้วส่ง
- [ ] ตรวจ `Repair_Requests` ว่ามี `request_id` รูปแบบ `REQ-YYYYMMDD-0001` และ `request_status` เป็น `Open`
- [ ] Submit OTHER problem: เลือก `อื่น ๆ / ไม่อยู่ในรายการ` แล้วส่ง
- [ ] Check `Problem_Review`: ตรวจว่ามีรายการใหม่ของ OTHER
- [ ] Submit UNSURE problem: เลือก `ไม่แน่ใจ ให้ช่างประเมิน` แล้วส่ง
- [ ] Check `Problem_Review`: ตรวจว่ามีรายการใหม่ของ UNSURE
- [ ] เปิด `/exec?page=technician`
- [ ] Accept job: กด `รับงาน`
- [ ] ตรวจ `Repair_Requests` ว่ามี `accepted_at` และสถานะเป็น `In Progress`
- [ ] Start job: กด `เริ่มซ่อม`
- [ ] ตรวจ `Repair_Requests` ว่ามี `started_at`
- [ ] Close job: กด `ปิดงาน` และกรอกข้อมูลให้ครบ
- [ ] Check `Repair_Actions`: ตรวจว่ามีข้อมูลปิดงานและเวลาคำนวณครบ
- [ ] ตรวจ `Repair_Requests` ว่าสถานะเป็น `Closed` และมี `closed_at`
- [ ] ลองปิดงานซ้ำ ต้องถูกป้องกัน
- [ ] เปิด `/exec?page=supervisor`
- [ ] Check dashboard: ตรวจตัวเลข Open, In Progress, Closed today, Downtime today
- [ ] ตรวจ Top 5 machines by count
- [ ] ตรวจ Top 5 problems by count
- [ ] ตรวจ Jobs waiting more than 30 minutes

## กรณีที่ควรทดสอบเพิ่ม

- [ ] เปิด report page ด้วย `machine_id` ที่ไม่มีอยู่ ต้องแสดง error
- [ ] กดส่งใบแจ้งซ่อมโดยไม่เลือกอาการ ต้องเตือนผู้ใช้
- [ ] กดส่งใบแจ้งซ่อมโดยไม่เลือกระดับความรุนแรง ต้องเตือนผู้ใช้
- [ ] กดเริ่มซ่อมก่อนรับงาน ต้องไม่อนุญาต
- [ ] กดปิดงานก่อนรับงาน/เริ่มซ่อม ต้องไม่อนุญาต
