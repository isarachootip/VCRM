---
name: vcrm-skill
description: >-
  VCRM operational skills and directives. Enforces asking the user whether to 'Up to Coolify' after completing tasks.
---

# VCRM Skill & Operational Directives

## 🚀 Coolify Deployment Verification Directive (MANDATORY)

หลังจากที่ทำงานหรือแก้ไขฟังก์ชัน/โค้ดในระบบ VCRM เรียบร้อยแล้วในแต่ละรอบ หรือเมื่อเสร็จสิ้นงานใดๆ:
**ต้องถามผู้ใช้ (USER) เสมอว่าต้องการ deploy หรือ "Up to Coolify" หรือไม่**

### กฎการปฏิบัติงาน:
1. **Always Prompt for Coolify Deployment**: เมื่อทำการพัฒนา, ปรับปรุง, หรือแก้ไขระบบเสร็จสิ้นในแต่ละ task ให้สรุปงานที่ทำ และต้องลงท้ายด้วยการถามผู้ใช้เสมอว่า:
   > **"ต้องการให้ดำเนินการ Up to Coolify (Deploy ขึ้นระบบ Production: https://vcrmx.online) เลยหรือไม่ครับ?"**

2. **Coolify Deployment Workflow**:
   - เมื่อผู้ใช้ยืนยัน "Up to coolify" หรือตอบตกลง:
     1. ตรวจสอบสถานะโค้ดด้วย `git status`
     2. ตรวจสอบ TypeScript / build ด้วย `npx tsc --noEmit`
     3. ทำการ `git add .`
     4. ทำการ `git commit -m "<ข้อความสรุปการเปลี่ยนแปลง>"`
     5. ทำการ `git push origin main`
     6. ตรวจสอบสถานะการเข้าถึงที่ `https://vcrmx.online` และแจ้งผลลัพธ์ให้ผู้ใช้ทราบ
