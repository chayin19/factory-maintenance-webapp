# Factory Maintenance Web App

Google Apps Script Web App สำหรับแจ้งซ่อมเครื่องจักร ติดตามงานซ่อม และดูแดชบอร์ดหัวหน้างาน โดยใช้ Google Sheets เป็นฐานข้อมูล

## โครงสร้าง

- `Code.gs` - backend, route, database setup, API สำหรับหน้าเว็บ
- `Home.html` - หน้าแรก เลือกเครื่องจักร
- `Report.html` - หน้าแจ้งซ่อมสำหรับผู้ปฏิบัติงาน
- `Technician.html` - หน้างานซ่อมสำหรับช่าง
- `Supervisor.html` - แดชบอร์ดหัวหน้างาน
- `Styles.html` - CSS กลาง
- `Shared.html` - JavaScript กลาง
- `docs/deployment_guide.md` - วิธีติดตั้งและ deploy
- `docs/user_manual_th.md` - คู่มือใช้งานภาษาไทย
- `TEST_PLAN.md` - checklist ทดสอบด้วยมือ

## การตั้งค่าฐานข้อมูล

ใช้ Script Properties key เดียวเท่านั้น:

```text
MAINTENANCE_DB_ID
```

ให้รัน `setupDatabase()` จาก Apps Script Editor หนึ่งครั้งหลังติดตั้ง ระบบจะ:

- สร้าง Google Sheets database ถ้ายังไม่มี `MAINTENANCE_DB_ID`
- สร้างหรือ validate ชีตที่จำเป็น
- เพิ่ม header ที่ขาดโดยไม่ลบข้อมูลเดิม
- seed master data เฉพาะชีต master ที่ยังไม่มีข้อมูล

ระบบจะไม่ clear ข้อมูลเดิม และไม่ recreate database ถ้ามี `MAINTENANCE_DB_ID` อยู่แล้ว

ถ้าต้องการใช้ Google Sheet ที่เตรียมไว้แล้ว ให้รัน `useProvidedMaintenanceDatabase()` หนึ่งครั้ง ฟังก์ชันนี้จะตั้งค่า `MAINTENANCE_DB_ID` เป็น:

```text
1bQiQ5A_Gouw8_JznvYu_GqdHhoRXJ04AUEfFzizh79Q
```

จากนั้นระบบจะ validate ชีตและเพิ่มเฉพาะ header ที่ขาด โดยไม่ลบข้อมูลเดิม

## ชีตที่ใช้

- `Machines`
- `Problem_Codebook`
- `Repair_Requests`
- `Problem_Review`
- `Repair_Actions`
- `Root_Cause_Codebook`
- `Action_Codebook`
- `Parts_Used`

## Route

- `/exec` - หน้าแรก
- `/exec?page=report&machine_id=CS-01` - หน้าแจ้งซ่อมเครื่องจักร
- `/exec?page=technician` - หน้าช่าง
- `/exec?page=supervisor` - แดชบอร์ดหัวหน้างาน

## ฟังก์ชันสำคัญ

- `setupDatabase()`
- `checkSystemHealth()`
- `submitRepairRequest(payload)`
- `acceptJob(requestId, technicianName)`
- `startRepair(requestId, technicianName)`
- `closeJob(payload)`
- `getSupervisorDashboard()`

## หมายเหตุการใช้งาน

หน้าจอออกแบบให้ mobile-first ปุ่มใหญ่ และข้อความเป็นภาษาไทย เพื่อให้ผู้ปฏิบัติงานในโรงงานใช้งานง่าย
