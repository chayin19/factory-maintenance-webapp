# Deployment Guide

คู่มือ deploy Google Apps Script Web App สำหรับระบบแจ้งซ่อมโรงงาน

## 1. สร้าง Apps Script Project

1. เปิด [Google Apps Script](https://script.google.com/)
2. สร้าง project ใหม่
3. คัดลอกไฟล์ทั้งหมดใน repository นี้เข้า project:
   - `appsscript.json`
   - `Code.gs`
   - `Home.html`
   - `Report.html`
   - `Technician.html`
   - `Supervisor.html`
   - `Styles.html`
   - `Shared.html`

## 2. ตั้งค่าฐานข้อมูล

1. เปิด Apps Script Editor
2. ถ้าต้องการใช้ Google Sheet ที่เตรียมไว้แล้ว ให้เลือกฟังก์ชัน `useProvidedMaintenanceDatabase`
3. ถ้าต้องการให้ระบบสร้าง Google Sheet ใหม่ ให้เลือกฟังก์ชัน `setupDatabase`
4. กด Run
5. อนุญาต permission ตามที่ Google แจ้ง
6. รัน `checkSystemHealth` เพื่อตรวจสอบระบบ

Google Sheet ที่เตรียมไว้แล้วใช้ ID:

```text
1bQiQ5A_Gouw8_JznvYu_GqdHhoRXJ04AUEfFzizh79Q
```

ฟังก์ชัน `useProvidedMaintenanceDatabase()` จะบันทึก ID นี้ลง Script Properties key `MAINTENANCE_DB_ID` แล้ว validate โครงสร้างชีตโดยไม่ลบข้อมูลเดิม

ขั้นตอนแบบเดิมสำหรับสร้างฐานใหม่:

1. เปิด Apps Script Editor
2. เลือกฟังก์ชัน `setupDatabase`
3. กด Run
4. อนุญาต permission ตามที่ Google แจ้ง
5. รัน `checkSystemHealth` เพื่อตรวจสอบระบบ

ระบบใช้ Script Properties key เดียว:

```text
MAINTENANCE_DB_ID
```

ถ้ามี key นี้อยู่แล้ว ระบบจะเปิด spreadsheet เดิมและ validate โครงสร้าง โดยไม่ลบข้อมูลเดิม

## 3. Deploy เป็น Web App

1. กด `Deploy`
2. เลือก `New deployment`
3. Type เลือก `Web app`
4. Execute as เลือก `Me`
5. Who has access เลือกตามนโยบายโรงงาน เช่น `Anyone with the link`
6. กด `Deploy`
7. บันทึก URL ที่ลงท้าย `/exec`

## 4. URL ที่ใช้

- หน้าแรก: `/exec`
- หน้าแจ้งซ่อม: `/exec?page=report&machine_id=CS-01`
- หน้าช่าง: `/exec?page=technician`
- แดชบอร์ด: `/exec?page=supervisor`

## 5. การเพิ่มข้อมูล master

แก้ไขใน Google Sheets โดยตรง:

- เพิ่มเครื่องจักรใน `Machines`
- เพิ่มอาการเสียใน `Problem_Codebook`
- เพิ่มสาเหตุใน `Root_Cause_Codebook`
- เพิ่มวิธีแก้ไขใน `Action_Codebook`

ให้ตั้ง `status` เป็น `Active` สำหรับเครื่องจักรที่ต้องการแสดง และตั้ง `active` เป็น `Y` สำหรับ codebook ที่ใช้งาน

## 6. ข้อควรระวัง

- ห้ามเปลี่ยนชื่อ header ที่มีอยู่
- ห้ามลบ `MAINTENANCE_DB_ID` ถ้ายังต้องใช้ฐานข้อมูลเดิม
- ไม่ต้องรัน `setupDatabase()` ซ้ำทุกวัน ใช้เฉพาะตอนติดตั้งหรือหลังเพิ่มไฟล์ระบบ
- ถ้าเพิ่ม header ใหม่ ระบบจะ append header ที่ขาดท้ายตารางเมื่อรัน `setupDatabase()`
