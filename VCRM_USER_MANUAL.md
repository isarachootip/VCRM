# 📘 VCRM: คู่มือการใช้งานระบบฉบับสมบูรณ์ (ตั้งแต่เริ่มต้นจนถึงระดับมืออาชีพ)

ยินดีต้อนรับสู่ระบบ **VCRM (OmniService CRM & Sales Pipeline)** ระบบบริหารงานขาย งานบริการหน้างาน และจัดคิวช่างในรูปแบบ Modern Enterprise Board

---

## 📑 สารบัญ
1. [การเริ่มต้นเปิดใช้งานระบบ (Getting Started)](#1-การเริ่มต้นเปิดใช้งานระบบ-getting-started)
2. [โครงสร้างหน้าจอหลักและการนำทาง (Interface & Navigation)](#2-โครงสร้างหน้าจอหลักและการนำทาง-interface--navigation)
3. [ขั้นตอนการทำงานของทีมขาย (Sales Pipeline Workflow)](#3-ขั้นตอนการทำงานของทีมขาย-sales-pipeline-workflow)
4. [ขั้นตอนการทำงานของทีมช่างและบริการ (Service Operations Workflow)](#4-ขั้นตอนการทำงานของทีมช่างและบริการ-service-operations-workflow)
5. [การใช้งานมุมมองต่างๆ (Multi-Views Guide)](#5-การใช้งานมุมมองต่างๆ-multi-views-guide)
6. [การ Import / Export ข้อมูลด้วย Excel](#6-การ-import--export-ข้อมูลด้วย-excel)
7. [การดูประวัติและการวิเคราะห์ (Dashboard & Activity Log)](#7-การดูประวัติและการวิเคราะห์-dashboard--activity-log)
8. [การจัดการหลังบ้านสำหรับ Admin (Prisma Studio)](#8-การจัดการหลังบ้านสำหรับ-admin-prisma-studio)

---

## 1. การเริ่มต้นเปิดใช้งานระบบ (Getting Started)

### 💻 การเปิดใช้งานบนเครื่องของคุณ (Local Machine)
1. เปิด Command Prompt หรือ Terminal
2. ไปที่โฟลเดอร์โปรเจกต์:
   ```bash
   cd c:\atgv\crm_monday
   ```
3. เริ่มต้นรันระบบ:
   ```bash
   npm run dev
   ```
4. เปิดเบราว์เซอร์แล้วเข้าไปที่: **[http://localhost:3000](http://localhost:3000)**

### ☁️ การเปิดใช้งานผ่านระบบออนไลน์ (VPS / Coolify)
* เข้าผ่าน URL หรือ Domain ที่ตั้งค่าไว้ในระบบ Coolify (เช่น `https://crm.yourdomain.com`)

---

## 2. โครงสร้างหน้าจอหลักและการนำทาง (Interface & Navigation)

1. **เมนูด้านซ้าย (Sidebar):**
   - **Sales Pipeline:** Deals, Leads, Accounts, Contacts, Growth
   - **Service Operations:** Delivery (ส่งของ), Install (ติดตั้ง), Renovate (รีโนเวท), Maintain (ซ่อมบำรุง)
2. **แถบหัวกระดาน (Header Toolbar):**
   - ปุ่มสลับมุมมอง: **Table View, Kanban, Dashboard, Dispatch Board, Activity Log**
   - ช่องค้นหา (Search) และตัวกรองผู้รับผิดชอบ (Filter by Owner)
   - ปุ่ม **Export to Excel** และ **Import Excel**

---

## 3. ขั้นตอนการทำงานของทีมขาย (Sales Pipeline Workflow)

### สเต็ปที่ 1: บันทึกข้อมูลลูกค้าเป้าหมาย (New Lead)
1. คลิกเลือกกระดาน **"Leads"** จากเมนูด้านซ้าย
2. กดปุ่ม **"+ Add Item"** พิมพ์ชื่อลูกค้า/โปรเจกต์
3. กรอกข้อมูลบริษัท, เบอร์โทร, อีเมล และเลือกผู้รับผิดชอบ (Owner)
4. อัปเดตสถานะ เช่น `New Lead` -> `Contacted`

### สเต็ปที่ 2: แปลง Lead เป็น Deal (Lead Conversion)
1. เมื่อคุยกับลูกค้าแล้วพบว่ามีโอกาสซื้อ (Qualified)
2. คลิกที่ปุ่ม **"Convert"** สีม่วงที่อยู่ท้ายแถวของลูกค้ารายนั้น
3. ระบบจะทำการ:
   - สร้างดีลใหม่ไปที่กระดาน **Deals & Sales Pipeline** อัตโนมัติ
   - สร้างข้อมูลบริษัทในกระดาน **Accounts**
   - สร้างข้อมูลผู้ติดต่อในกระดาน **Contacts**

### สเต็ปที่ 3: ติดตามและปิดการขาย (Deals Pipeline)
1. คลิกเลือกกระดาน **"Deals & Sales Pipeline"**
2. ปรับสถานะตามขั้นตอนจริง: `Working on it` -> `Proposal Sent` -> `Negotiation` -> `Closed Won`
3. ใส่ **Deal Value (มูลค่าโครงการ)** ระบบจะคำนวณผลรวมของทั้งกลุ่มให้อัตโนมัติที่ส่วนท้ายตาราง

---

## 4. ขั้นตอนการทำงานของทีมช่างและบริการ (Service Operations Workflow)

1. **เลือกกระดานตามประเภทบริการ:**
   - 🚚 **Delivery:** งานจัดส่งสินค้า/อุปกรณ์
   - ⚙️ **Installation:** งานติดตั้งระบบ/เครื่องจักร
   - 🏗️ **Renovation:** งานปรับปรุงหน้างาน/ตกแต่ง
   - 🔧 **Maintenance:** งานตรวจเช็กระยะ/ซ่อมบำรุง
2. **การจ่ายงานช่าง (Dispatching):**
   - สลับไปที่มุมมอง **"Dispatch Board"**
   - ดูตารางช่างที่ว่างและมอบหมายงานตามความเชี่ยวชาญ (Skills)
3. **การอัปเดตสถานะงาน:**
   - `Pending` -> `Scheduled` -> `In Progress` -> `Completed`

---

## 5. การใช้งานมุมมองต่างๆ (Multi-Views Guide)

- **Table View (📊):** มุมมองตารางสไตล์ Monday.com ดูภาพรวมครบทุกคอลัมน์ แก้ไขข้อมูลง่ายและเร็วที่สุด
- **Kanban View (📋):** มุมมองการ์ดแยกตามสถานะ เหมาะสำหรับการประชุม Sales Stand-up ประจำสัปดาห์
- **Dashboard (📈):** สรุปยอดขายรวม (Pipeline Value), Win Rate %, กราฟิกแสดงสัดส่วนดีล และผลงานทีม
- **Dispatch Board (🚛):** ตารางจ่ายงานสำหรับ Dispatcher มอบหมายงานช่างและดูตารางคิวงาน
- **Activity Log (📜):** บันทึกประวัติการเปลี่ยนแปลงทั้งหมด ใครแก้อะไร เมื่อไหร่ ตรวจสอบย้อนหลังได้

---

## 6. การ Import / Export ข้อมูลด้วย Excel

- **Export ข้อมูล:** คลิกปุ่ม **"Export to Excel"** ที่มุมขวาบน ระบบจะดาวน์โหลดไฟล์ .xlsx ทันที
- **Import ข้อมูล:** คลิกปุ่ม **"Import Excel"** -> เลือกไฟล์ .xlsx หรือ .csv เพื่อนำเข้าข้อมูล

---

## 7. การจัดการหลังบ้านสำหรับ Admin (Prisma Studio)

1. รันคำสั่ง: `npx prisma studio`
2. เปิดเบราว์เซอร์ไปที่: **http://localhost:5555**
3. สามารถเพิ่ม, ลบ, แก้ไขข้อมูลตาราง Customer, Employee, JobTicket, Inventory ได้โดยตรงผ่านหน้า GUI

---
✨ จัดทำโดยทีม Virtual Expert Squad (PM, SA, DevOps, Sr.Dev, QA Tester, Trainer)
