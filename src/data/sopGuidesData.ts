export interface SOPStepInstruction {
  stepNumber: number;
  title: string;
  actionDetails: string[];
  tipsOrAlert?: string;
  badge?: string;
}

export interface SOPGuide {
  id: string;
  stepCode: string;
  moduleName: string;
  moduleSubtitle: string;
  role: string;
  inputSource: {
    title: string;
    description: string;
    startingStatus: string;
    inputFields: string[];
  };
  flowchartMermaid: string;
  flowchartNodes: {
    id: string;
    label: string;
    type: 'input' | 'process' | 'decision' | 'output';
    detail?: string;
  }[];
  instructions: SOPStepInstruction[];
  outputAndNextStep: {
    outputTitle: string;
    outputItems: string[];
    nextStatus: string;
    nextRoleOrModule: string;
  };
  slaAndKpi: {
    slaResponse: string;
    keyChecklist: string[];
    kpiMetric: string;
  };
}

export const MASTER_SOP_GUIDES: Record<string, SOPGuide> = {
  // 1. Executive Dashboard
  'dashboard': {
    id: 'dashboard',
    stepCode: 'Overview',
    moduleName: 'แดชบอร์ดภาพรวมการบริหารลูกค้าและยอดขาย (Executive Overview)',
    moduleSubtitle: 'คู่มือการใช้งาน (SOP) สำหรับผู้บริหาร, ฝ่ายวางแผนกลยุทธ์ และทีม Sale Director',
    role: 'Executive / Sales Director / BI Analyst',
    inputSource: {
      title: 'รับข้อมูลแบบ Real-time จากทุก BU และทุกช่องทางในระบบ VCRMX',
      description: 'ระบบรวมข้อมูลอัตโนมัติจาก Deals, Invoices, Chat Orders, Field Services และ Omnichannel Touchpoints',
      startingStatus: 'Live Realtime Streaming',
      inputFields: [
        'ยอดขายรวมสะสม (Total GMV & Revenue)',
        'จำนวนลูกค้าใหม่ / ลูกค้าเก่า MTD & YTD',
        'คำสั่งซื้อ (Orders Completed / Pending)',
        'อัตราค่าเฉลี่ยต่อคำสั่งซื้อ (Average Order Value - AOV)'
      ]
    },
    flowchartMermaid: `graph TD
    DataIn["1. Omni Data Streams (POS + CRM + Chat + Field)"] --> Aggregate["2. Real-time Aggregation Engine"]
    Aggregate --> KPICards["3. 4 Executive Pillar Cards (Customers, Growth, Revenue, Orders)"]
    KPICards --> Filter{"4. กรอง BU Scope / Time Window"}
    Filter --> DrillDown["5. วิเคราะห์เจาะลึก Revenue By Segment / BU"]
    DrillDown --> Strategy["6. ตัดสินใจกลยุทธ์ & Action Directive"]`,
    flowchartNodes: [
      { id: '1', label: '1. Omni Data Streams', type: 'input', detail: 'รวบรวมข้อมูลทุก BU แบบอัตโนมัติ' },
      { id: '2', label: '2. Aggregation Engine', type: 'process', detail: 'คำนวณ MTD, YTD, Growth Rate' },
      { id: '3', label: '3. 4 Core Pillar Cards', type: 'process', detail: 'สรุป 4 มิติหลักสำหรับผู้บริหาร' },
      { id: '4', label: '4. Scope & Time Filter', type: 'decision', detail: 'เลือก BU หรือช่วงเวลา (7D, 30D, YTD)' },
      { id: '5', label: '5. Action Directive', type: 'output', detail: 'วางแผนและออกคำสั่งปรับกลยุทธ์' },
    ],
    instructions: [
      {
        stepNumber: 1,
        title: 'ตรวจสอบ 4 มิติหลักประจำวัน (Top 4 Executive Cards)',
        actionDetails: [
          'ดูตัวเลขรวมลูกค้า (Total Customers) และการเติบโตเทียบกับเป้าหมายเดือนปัจจุบัน',
          'ตรวจสอบยอดขายสะสม (Total Revenue) และเทียบ MoM / YoY Growth',
          'ตรวจดูจำนวนคำสั่งซื้อรวม (Orders) และค่าเฉลี่ยบิล (AOV)',
        ],
        badge: 'Daily Review',
        tipsOrAlert: 'หาก AOV ต่ำกว่าเกณฑ์มาตรฐาน ให้ตรวจสอบโปรโมชันและแคมเปญ Cross-sell ในส่วน Lists & Segments'
      },
      {
        stepNumber: 2,
        title: 'วิเคราะห์ผลงานตาม Business Unit (BU Breakdown)',
        actionDetails: [
          'ใช้ปุ่มสลับ BU Scope ด้านบนเพื่อดูภาพรวมเฉพาะ BU เช่น BU-CONS, BU-TECH, BU-RETAIL',
          'ตรวจสอบสัดส่วนรายได้ผ่านชาร์ต Revenue by BU Distribution',
          'เปรียบเทียบสัดส่วนคำสั่งซื้อออนไลน์ vs ออฟไลน์'
        ],
        badge: 'BU Analysis'
      },
      {
        stepNumber: 3,
        title: 'ส่งออกรายงาน & สั่งการทีมงาน (Executive Directives)',
        actionDetails: [
          'กดปุ่ม Quick Export เพื่อนำข้อมูลสรุปไปใช้ในการประชุมผู้บริหาร',
          'หากพบ Pipeline คอขวด ให้คลิก Jump ไปยังโมดูล Deals & Pipeline เพื่อดูรายละเอียดการขาย'
        ],
        badge: 'Directive'
      }
    ],
    outputAndNextStep: {
      outputTitle: 'รายงานสรุปภาพรวมผู้บริหาร & แผนกลยุทธ์การขาย',
      outputItems: [
        'Dashboard Summary Report ประจำวัน/สัปดาห์',
        'การมอบหมายเป้าหมายยอดขาย (Sales Target Allocation)',
        'การอนุมัติแคมเปญโปรโมชันกระตุ้นยอด'
      ],
      nextStatus: 'Action Plan Assigned',
      nextRoleOrModule: 'Sales Manager / Operations Lead'
    },
    slaAndKpi: {
      slaResponse: 'อัปเดตข้อมูล Real-time ทุก 30 วินาที',
      keyChecklist: [
        'ตรวจสอบความสอดคล้องของยอดขายจริง vs ยอดในระบบ',
        'ทบทวนเป้าหมายยอดขายประจำเดือนทุกวันจันทร์',
        'ส่งต่อ Action Item ให้หัวหน้าทีมแต่ละ BU ภายใน 10:00 น.'
      ],
      kpiMetric: 'Target Achievement % และ Gross Margin %'
    }
  },

  // 2. Omni Chat Desk
  'chat': {
    id: 'chat',
    stepCode: 'Step 1 — Chat & Social Commerce',
    moduleName: 'ศูนย์รับเรื่องและบริการลูกค้าแชท Omnichannel (Omni Chat Desk)',
    moduleSubtitle: 'คู่มือการใช้งาน (SOP) สำหรับเจ้าหน้าที่ Customer Service, Chat Sales และ Live Agent',
    role: 'Live Chat Agent / Customer Service / Sales Admin',
    inputSource: {
      title: 'ข้อความแชทขาเข้าจาก LINE Official Account, Facebook Messenger และ Web Chat',
      description: 'ระบบดึงข้อความและโปรไฟล์ลูกค้าอัตโนมัติ พร้อมค้นหาประวัติการซื้อเดิม (Customer 360° Matching)',
      startingStatus: 'OPEN / UNASSIGNED (รอรับเคส)',
      inputFields: [
        'LINE User ID / Social Profile & Display Name',
        'ข้อความสอบถาม, สลิปโอนเงิน หรือคำสั่งซื้อ',
        'ประวัติ The 1 Member / ประวัติการสั่งซื้อเดิม',
        'ช่องทางการติดต่อ (LINE OA, FB, Web)'
      ]
    },
    flowchartMermaid: `graph TD
    InboundMsg["1. ลูกค้าทักแชท LINE OA / FB"] --> BotMatch["2. AI Auto-Route & Match Customer 360°"]
    BotMatch --> Assign["3. เจ้าหน้าที่กด 'รับเคส (Accept)'"]
    Assign --> Dialogue["4. พูดคุย, ส่งแคตตาล็อก & แก้ปัญหา"]
    Dialogue --> QuickAction{"5. ดำเนินการ Action"}
    QuickAction -->|ออกใบเสนอราคา| Quote["6. สร้าง Quotation & ล็อกดีล"]
    QuickAction -->|ส่งต่องานช่าง| Field["7. สร้างใบงานช่าง / ติดตั้ง"]
    QuickAction -->|ปิดเคสทั่วไป| Resolve["8. ประเมินความพึงพอใจ & ปิดเคส (Resolved)"]`,
    flowchartNodes: [
      { id: '1', label: '1. Inbound Social Chat', type: 'input', detail: 'รับข้อความจาก LINE OA / FB' },
      { id: '2', label: '2. Accept & Assign', type: 'process', detail: 'กดรับเคสและเริ่มสนทนา' },
      { id: '3', label: '3. Consult & Quick Reply', type: 'process', detail: 'ใช้ Quick Template ให้ข้อมูล' },
      { id: '4', label: '4. Action Path', type: 'decision', detail: 'ออกใบเสนอราคา หรือ นัดหมายช่าง' },
      { id: '5', label: '5. Resolve & NPS', type: 'output', detail: 'ปิดเคสพร้อมส่งแบบประเมิน CSAT' },
    ],
    instructions: [
      {
        stepNumber: 1,
        title: 'รับเคสและทักทายลูกค้า (First Response)',
        actionDetails: [
          'กดปุ่ม "รับเคส" เพื่อเปลี่ยนสถานะเป็น IN_PROGRESS และผูกเจ้าหน้าที่รับผิดชอบ',
          'ใช้ Quick Reply ทักทายด้วยมาตรฐานการบริการ VCRMX ภายใน 60 วินาที',
          'ตรวจสอบแถบข้อมูล Customer 360° ด้านขวาเพื่อดูระดับสมาชิก VIP / The 1'
        ],
        badge: 'SLA: 60s',
        tipsOrAlert: 'หากลูกค้าเป็นระดับ VIP ให้ใช้โทนเสียงการบริการระดับพรีเมียมและแจ้งสิทธิพิเศษทันที'
      },
      {
        stepNumber: 2,
        title: 'ให้คำปรึกษาและดำเนินการตามความต้องการของลูกค้า',
        actionDetails: [
          'กรณีต้องการสินค้า: ส่งภาพสินค้า, เช็กสต็อก และกดปุ่ม "+ ออกใบเสนอราคา (Quotation)"',
          'กรณีแจ้งปัญหาบริการ: บันทึก Ticket Issue และระบุหมวดหมู่ปัญหา (Category & Subcategory)',
          'กรณีขอนัดช่างสำรวจ/ติดตั้ง: กดปุ่ม "+ ส่งงานนัดหมาย Field Service"'
        ],
        badge: 'Action Handling'
      },
      {
        stepNumber: 3,
        title: 'สรุปผลและปิดเคสการสนทนา (Case Resolution)',
        actionDetails: [
          'พิมพ์สรุปสิ่งที่ได้ดำเนินการให้ลูกค้าทราบ',
          'กดเปลี่ยนสถานะเคสเป็น "RESOLVED"',
          'ระบบจะส่งแบบสำรวจความพึงพอใจ (CSAT/NPS) ให้ลูกค้าอัตโนมัติ'
        ],
        badge: 'Resolution'
      }
    ],
    outputAndNextStep: {
      outputTitle: 'ผลลัพธ์การสนทนาและบันทึกกิจกรรมลูกค้า',
      outputItems: [
        'บันทึก Chat Transcript ผูกกับประวัติลูกค้า',
        'ใบเสนอราคา (Quotation) หรือ Ticket ใหม่ใน Pipeline',
        'คะแนนประเมินความพึงพอใจ CSAT'
      ],
      nextStatus: 'RESOLVED / DEALS_CREATED',
      nextRoleOrModule: 'Sales Pipeline หรือ Field Dispatcher'
    },
    slaAndKpi: {
      slaResponse: 'First Response Time < 60 วินาที | Resolution Time < 15 นาที',
      keyChecklist: [
        'ตรวจสอบว่าได้สอบถามเบอร์โทรศัพท์หรือเชื่อม The 1 แล้วหรือยัง',
        'ระบุ Tag ของเคสให้ถูกต้องครบถ้วนก่อนปิดเคส',
        'ห้ามทิ้งเคสค้างสถานะ Open ข้ามคืน'
      ],
      kpiMetric: 'First Contact Resolution (FCR) > 85% และ CSAT > 4.8/5.0'
    }
  },

  // 3. Deals & Pipeline
  'board-5030723273': {
    id: 'board-5030723273',
    stepCode: 'Step 2 — Deals & Sales Pipeline',
    moduleName: 'ศูนย์บริหารจัดการโอกาสการขายและ Pipeline (Deals & Pipeline)',
    moduleSubtitle: 'คู่มือการใช้งาน (SOP) สำหรับทีมขาย (AE), เซลส์โครงการ และผู้จัดการฝ่ายขาย',
    role: 'Account Executive (AE) / Sales Representative / Sales Manager',
    inputSource: {
      title: 'โอกาสการขายที่ผ่านการคัดกรอง (Qualified Lead) จากทีมแชทหรือทีมการตลาด',
      description: 'ดีลที่มีมูลค่าชัดเจนและผู้มีอำนาจตัดสินใจพร้อมเจรจาธุรกิจ',
      startingStatus: 'New Lead / Qualified',
      inputFields: [
        'Deal Name (ชื่อดีล / โครงการ)',
        'Deal Value (มูลค่าการขาย บาท)',
        'Contact Person & Company Name',
        'Expected Close Date (วันที่คาดว่าจะปิดการขาย)',
        'Win Probability (% โอกาสชนะ)'
      ]
    },
    flowchartMermaid: `graph TD
    NewDeal["1. สร้างดีลใหม่ (New Deal)"] --> Discovery["2. ติดต่อนัดหมาย & เก็บความต้องการ"]
    Discovery --> Proposal["3. จัดทำใบเสนอราคา & Proposal"]
    Proposal --> Negotiate{"4. เจรจาต่อรองเงื่อนไข & ราคา"}
    Negotiate -->|ลูกค้าตกลง| Won["5. ปิดการขายสำเร็จ (Closed Won) -> ส่งต่อ Operations"]
    Negotiate -->|ลูกค้าปฏิเสธ| Lost["6. ปิดการขายไม่สำเร็จ (Closed Lost) -> บันทึกเหตุผล"]`,
    flowchartNodes: [
      { id: '1', label: '1. New Deal Intake', type: 'input', detail: 'สร้างดีลและกำหนดมูลค่า' },
      { id: '2', label: '2. Needs Discovery', type: 'process', detail: 'สำรวจความต้องการลูกค้า' },
      { id: '3', label: '3. Proposal & Quote', type: 'process', detail: 'ส่งใบเสนอราคาอย่างเป็นทางการ' },
      { id: '4', label: '4. Negotiation', type: 'decision', detail: 'เจรจาราคาและเงื่อนไขสัญญา' },
      { id: '5', label: '5. Closed Won', type: 'output', detail: 'ชนะดีล ส่งงานต่อฝ่ายปฏิบัติการ' },
    ],
    instructions: [
      {
        stepNumber: 1,
        title: 'สร้างและตั้งค่าข้อมูลดีล (Deal Qualification)',
        actionDetails: [
          'คลิกปุ่ม "+ Create Deal" หรือลาก Lead ที่ผ่านเกณฑ์เข้ามาใน Pipeline',
          'กรอกมูลค่าดีล (Deal Value), ผู้รับผิดชอบ (Deal Owner) และวันที่คาดว่าจะปิดการขาย',
          'อัปเดต Win Probability ให้สอดคล้องกับสเตจปัจจุบัน'
        ],
        badge: 'Qualification'
      },
      {
        stepNumber: 2,
        title: 'จัดทำและส่งใบเสนอราคา (Proposal Presentation)',
        actionDetails: [
          'คลิกที่ชื่อดีลเพื่อเปิด Item Drawer แล้วสร้างเอกสารใบเสนอราคา (Quotation)',
          'กำหนดส่วนลดและโปรโมชันตามสิทธิ์ที่ได้รับอนุมัติ',
          'ส่งเอกสารให้ลูกค้าผ่าน LINE หรือ Email พร้อมนัดหมายวันฟังผล'
        ],
        badge: 'Proposal Stage',
        tipsOrAlert: 'ดีลที่มีมูลค่ามากกว่า 1,000,000 บาท ต้องได้รับการอนุมัติส่วนลดพิเศษจาก Sales Director ก่อนส่ง'
      },
      {
        stepNumber: 3,
        title: 'อัปเดตสเตตัสและปิดการขาย (Closing & Handover)',
        actionDetails: [
          'เมื่อลูกค้าเซ็นอนุมัติ ให้ลากการ์ดไปยังกลุ่ม "Closed Won"',
          'ระบบจะสร้าง Task ส่งมอบงานไปยังฝ่ายจัดส่ง/ติดตั้งอัตโนมัติ',
          'หากปิดการขายไม่สำเร็จ ให้เลือกลง "Closed Lost" พร้อมระบุเหตุผล (Reason for Loss)'
        ],
        badge: 'Closing'
      }
    ],
    outputAndNextStep: {
      outputTitle: 'สัญญาซื้อขายที่อนุมัติ & การส่งมอบงานภาคสนาม',
      outputItems: [
        'Signed Purchase Order / สัญญาบริการ',
        'ใบส่งสินค้าและติดตั้งใน Delivery & Tech Board',
        'บันทึก Commission และผลงานยอดขายของเซลส์'
      ],
      nextStatus: 'CLOSED_WON -> DISPATCH_READY',
      nextRoleOrModule: 'Field Dispatcher & Logistics Tech'
    },
    slaAndKpi: {
      slaResponse: 'อัปเดตความคืบหน้าดีลทุก 3 วัน | นำเสนอใบเสนอราคาภายใน 24 ชม.',
      keyChecklist: [
        'ตรวจสอบเครดิตเทอมและข้อมูลภาษีบริษัทลูกค้าให้ครบถ้วน',
        'แนบเอกสารใบเสนอราคาและไฟล์แนบใน Drawer ให้เรียบร้อย',
        'ทบทวน Pipeline ทุกวันพฤหัสบดี'
      ],
      kpiMetric: 'Pipeline Velocity และ Win Rate % > 35%'
    }
  },

  // 4. Inbound Leads 2026
  'board-leads': {
    id: 'board-leads',
    stepCode: 'Step 1 — Inbound Lead Capture',
    moduleName: 'ศูนย์รับและคัดกรอง Lead ขาเข้า (Inbound Leads 2026)',
    moduleSubtitle: 'คู่มือการใช้งาน (SOP) สำหรับทีม SDR, Lead Qualification และการตลาด',
    role: 'Sales Development Representative (SDR) / Lead Qualifier',
    inputSource: {
      title: 'Lead จากแบบฟอร์มเว็บไซต์, แคมเปญโซเชียลมีเดีย, งานอีเวนต์ และ Ads',
      description: 'ข้อมูลความสนใจเบื้องต้นที่ต้องผ่านการติดต่อเพื่อยืนยันงบประมาณและความต้องการ (BANT)',
      startingStatus: 'New Inbound Lead',
      inputFields: [
        'ชื่อผู้ติดต่อ และชื่อบริษัท/โครงการ',
        'เบอร์โทรศัพท์ & อีเมล',
        'แหล่งที่มาของ Lead (Source: Facebook, Google, Event, Referral)',
        'ความสนใจเบื้องต้น (Product of Interest & Budget Range)'
      ]
    },
    flowchartMermaid: `graph TD
    Inbound["1. Lead ขาเข้าจากทุกช่องทาง"] --> Qualify["2. SDR โทรติดต่อคัดกรอง (BANT)"]
    Qualify --> Score{"3. ประเมินความพร้อม (Lead Score)"}
    Score -->|ผ่านเกณฑ์ (Qualified)| Convert["4. กด 'Convert to Deal' -> ส่งต่อทีม AE"]
    Score -->|ยังไม่พร้อม (Nurture)| Keep["5. จัดเข้ากลุ่ม Lead Nurturing Email/LINE"]
    Score -->|ข้อมูลผิด/ไม่สนใจ| Unqual["6. ปรับสถานะเป็น Unqualified"]`,
    flowchartNodes: [
      { id: '1', label: '1. Inbound Capture', type: 'input', detail: 'รับ Lead จากแคมเปญ' },
      { id: '2', label: '2. Call & Qualify', type: 'process', detail: 'โทรสัมภาษณ์ความต้องการ' },
      { id: '3', label: '3. Lead Scoring', type: 'decision', detail: 'ให้คะแนนความพร้อม' },
      { id: '4', label: '4. Convert to Deal', type: 'output', detail: 'ส่งต่อให้เซลส์พร้อมเปิดดีล' },
    ],
    instructions: [
      {
        stepNumber: 1,
        title: 'ติดต่อกลับ Lead ขาเข้าอย่างรวดเร็ว (Speed-to-Lead)',
        actionDetails: [
          'ตรวจสอบรายการ Lead ใหม่ในกลุ่ม "New Leads"',
          'โทรติดต่อกลับภายใน 15 นาทีหลังจาก Lead เข้าสู่ระบบ',
          'บันทึกประวัติการโทรและเวลาสนทนาลงในบันทึกกิจกรรม'
        ],
        badge: 'SLA: 15 mins',
        tipsOrAlert: 'การโทรกลับภายใน 15 นาทีแรกมีอัตราการแปลงเป็นยอดขายสูงกว่าการติดต่อช้าถึง 4 เท่า'
      },
      {
        stepNumber: 2,
        title: 'คัดกรองตามมาตรฐาน BANT Framework',
        actionDetails: [
          'Budget: สอบถามงบประมาณที่ลูกค้าเตรียมไว้',
          'Authority: ยืนยันว่าผู้ติดต่อมีอำนาจตัดสินใจหรือเป็นผู้ชงเรื่อง',
          'Need: รับฟังปัญหาและความต้องการอย่างชัดเจน',
          'Timeline: กำหนดกรอบเวลาที่ต้องการเริ่มโครงการ'
        ],
        badge: 'BANT Criteria'
      },
      {
        stepNumber: 3,
        title: 'แปลง Lead เป็น Deal (Lead Conversion)',
        actionDetails: [
          'หากผ่านเกณฑ์ BANT ให้คลิกปุ่ม "Convert to Deal"',
          'ระบบจะสร้าง Deal ใน Pipeline พร้อมผูก Contacts และ Company ให้โดยอัตโนมัติ',
          'มอบหมาย Account Executive (AE) ที่เชี่ยวชาญกลุ่มสินค้านั้นๆ'
        ],
        badge: 'Convert'
      }
    ],
    outputAndNextStep: {
      outputTitle: 'Qualified Deal & กำหนดการนัดหมายทีมเซลส์',
      outputItems: [
        'Deal ใหม่ใน Deals & Pipeline Board',
        'Contact Profile ที่มีข้อมูลครบถ้วน',
        'นัดหมายปฏิทินส่งต่อระหว่าง SDR และ AE'
      ],
      nextStatus: 'CONVERTED_TO_DEAL',
      nextRoleOrModule: 'Account Executive (Deals & Pipeline)'
    },
    slaAndKpi: {
      slaResponse: 'First Contact < 15 นาที | Qualification Cycle < 24 ชม.',
      keyChecklist: [
        'ห้ามทิ้ง Lead ค้างโดยไม่มีการติดต่อเกิน 2 ชั่วโมง',
        'ระบุ Lead Source ให้ถูกต้องทุกครั้งเพื่อวัดผลการตลาด',
        'กรอกข้อมูลอีเมลและเบอร์โทรศัพท์ที่ติดต่อได้จริง'
      ],
      kpiMetric: 'Lead-to-Opportunity Conversion Rate > 25%'
    }
  },

  // 5. Contacts & 360°
  'contacts': {
    id: 'contacts',
    stepCode: 'Customer Master Data',
    moduleName: 'ฐานข้อมูลลูกค้าและโปรไฟล์ 360 องศา (Contacts & Customer 360°)',
    moduleSubtitle: 'คู่มือการใช้งาน (SOP) สำหรับ Data Admin, CRM Specialist และทีมบริการลูกค้า',
    role: 'CRM Data Specialist / Customer Experience Officer',
    inputSource: {
      title: 'ข้อมูลลูกค้าจากทุกจุดสัมผัส (Chat, POS, Web, CRM, The 1 Member)',
      description: 'ระบบรวมข้อมูลและทำ Identity Resolution จับคู่เบอร์โทรและอีเมลให้เป็นโปรไฟล์เดียว',
      startingStatus: 'Active Customer Profile',
      inputFields: [
        'ชื่อ-นามสกุล และชื่อบริษัท',
        'เบอร์โทรศัพท์, อีเมล และ LINE ID',
        'ที่อยู่สำหรับออกใบกำกับภาษี & ที่อยู่จัดส่ง',
        'The 1 Member Number & สะสมคะแนน'
      ]
    },
    flowchartMermaid: `graph TD
    TouchPoint["1. ข้อมูลจากช่องทางต่างๆ (Chat, Store, Web)"] --> Match["2. Identity Resolution & Merge"]
    Match --> Tiering["3. คำนวณ Customer Lifetime Value (CLV) & VIP Tier"]
    Tiering --> View360["4. แสดงผล 3-Column Profile 360°"]
    View360 --> Personalize["5. เสนอโปรโมชันเฉพาะบุคคล & บริการระดับ VIP"]`,
    flowchartNodes: [
      { id: '1', label: '1. Omni Touchpoints', type: 'input', detail: 'ดึงข้อมูลจากทุกช่องทาง' },
      { id: '2', label: '2. Identity Merge', type: 'process', detail: 'รวมโปรไฟล์ไม่ให้ซ้ำซ้อน' },
      { id: '3', label: '3. VIP & CLV Tiering', type: 'process', detail: 'ประเมินระดับชั้นลูกค้า' },
      { id: '4', label: '4. 360° Profile View', type: 'output', detail: 'โปรไฟล์ข้อมูลครบ 3 คอลัมน์' },
    ],
    instructions: [
      {
        stepNumber: 1,
        title: 'ค้นหาและตรวจสอบประวัติลูกค้า (Profile Lookup)',
        actionDetails: [
          'ใช้ช่องค้นหาด้านบนด้วย เบอร์โทรศัพท์, อีเมล หรือชื่อลูกค้า',
          'ตรวจสอบสถานะ VIP Badge และคะแนน The 1 Card คงเหลือ',
          'ดูประวัติการซื้อในอดีต (Purchase History) และ Timeline กิจกรรม'
        ],
        badge: 'Lookup'
      },
      {
        stepNumber: 2,
        title: 'อัปเดตข้อมูลและที่อยู่จัดส่ง/ใบกำกับภาษี',
        actionDetails: [
          'คลิกแก้ไขข้อมูลติดต่อและที่อยู่ให้เป็นปัจจุบัน',
          'เพิ่ม Tags พฤติกรรมความชอบ เช่น #ModernLuxury, #B2BCorporate',
          'ผูกความสัมพันธ์กับบริษัท (Account Association)'
        ],
        badge: 'Data Hygiene'
      },
      {
        stepNumber: 3,
        title: 'บริหารจัดการสิทธิประโยชน์และกิจกรรมพิเศษ',
        actionDetails: [
          'มอบสิทธิ์โปรโมชันเฉพาะกลุ่มสำหรับลูกค้าชั้นนำ',
          'สร้างโน้ตบันทึกข้อควรระวังหรือความต้องการพิเศษในการบริการ',
          'ตั้งเตือนการติดตามความสัมพันธ์ประจำปี (Anniversary Reminder)'
        ],
        badge: 'Loyalty'
      }
    ],
    outputAndNextStep: {
      outputTitle: 'Customer Single View ที่สมบูรณ์แบบ',
      outputItems: [
        'Single Source of Truth ข้อมูลลูกค้า',
        'VIP Status & The 1 Points Balance',
        'Cross-sell Recommendations'
      ],
      nextStatus: 'PROFILE_UPDATED',
      nextRoleOrModule: 'All Teams'
    },
    slaAndKpi: {
      slaResponse: 'อัปเดตข้อมูลทันทีเมื่อมีการเปลี่ยนแปลง',
      keyChecklist: [
        'ตรวจสอบความถูกต้องของเลขประจำตัวผู้เสียภาษีและสาขา',
        'ไม่สร้าง Contact ซ้ำซ้อน (Duplicate Prevention)',
        'ปฏิบัติตามมาตรฐาน PDPA ในการเก็บข้อมูลลูกค้า'
      ],
      kpiMetric: 'Data Completeness Rate > 95%'
    }
  },

  // 6. Lists & Segments
  'lists': {
    id: 'lists',
    stepCode: 'Marketing & Segmentation',
    moduleName: 'ศูนย์สร้างกลุ่มเป้าหมายและเซกเมนต์ (Lists & Segments)',
    moduleSubtitle: 'คู่มือการใช้งาน (SOP) สำหรับทีม CRM Marketing, Growth Hacker และ Campaign Specialist',
    role: 'CRM Marketing Lead / Campaign Manager',
    inputSource: {
      title: 'ฐานข้อมูล Contacts, Transactions, Orders และพฤติกรรมลูกค้าทั้งหมด',
      description: 'ระบบรองรับการสร้าง Dynamic Active Lists ที่อัปเดตสมาชิกอัตโนมัติตาม Filter Rules',
      startingStatus: 'Draft Segment List',
      inputFields: [
        'เกณฑ์มูลค่าการซื้อสะสม (CLV / Total Spend Range)',
        'ความถี่การซื้อล่าสุด (Recency / Frequency)',
        'Business Unit ที่เคยซื้อสินค้า',
        'หมวดหมู่สินค้าที่สนใจ & Location'
      ]
    },
    flowchartMermaid: `graph TD
    RuleDefine["1. กำหนดเงื่อนไขเซกเมนต์ (AND/OR Logic)"] --> Preview["2. พรีวิวยอดจำนวนสมาชิก (Real-time Count)"]
    Preview --> SaveList["3. บันทึกเป็น Dynamic Active List"]
    SaveList --> Trigger{"4. เชื่อมโยงแคมเปญ"}
    Trigger -->|Broadcast LINE| LineMsg["5. ส่งข้อความบรอดแคสต์ LINE OA"]
    Trigger -->|ส่งให้ทีมเซลส์| Telesales["6. มอบหมายรายชื่อ Telesales โทรติดตาม"]`,
    flowchartNodes: [
      { id: '1', label: '1. Rule Definition', type: 'input', detail: 'กำหนดเงื่อนไข AND/OR' },
      { id: '2', label: '2. Live Preview', type: 'process', detail: 'ดูจำนวนลูกค้าที่เข้าเกณฑ์' },
      { id: '3', label: '3. Save Dynamic List', type: 'process', detail: 'บันทึกเป็นเซกเมนต์อัตโนมัติ' },
      { id: '4', label: '4. Campaign Trigger', type: 'output', detail: 'ยิงแคมเปญกระตุ้นยอดขาย' },
    ],
    instructions: [
      {
        stepNumber: 1,
        title: 'สร้าง List ใหม่และกำหนดประเภท (Create List)',
        actionDetails: [
          'คลิกปุ่ม "+ Create List" มุมขวาบน',
          'เลือกประเภท List: "Active List (อัปเดตอัตโนมัติ)" หรือ "Static List (รายชื่อคงที่)"',
          'ตั้งชื่อ List ให้สื่อความหมาย เช่น "High-Value VIP Q3 (Spend > 500k)"'
        ],
        badge: 'Setup'
      },
      {
        stepNumber: 2,
        title: 'ตั้งค่า Filter Rules และ Logic',
        actionDetails: [
          'เพิ่มเกณฑ์การกรอง เช่น Total Spend > 500,000 บาท และ Last Purchase < 90 วัน',
          'เลือก BU Scope ให้ตรงตามเป้าหมายของแคมเปญ',
          'ตรวจสอบผลลัพธ์ในหน้าต่าง Live Preview'
        ],
        badge: 'Filter Engine'
      },
      {
        stepNumber: 3,
        title: 'นำ List ไปใช้งานในแคมเปญ (Campaign Execution)',
        actionDetails: [
          'ส่งออกรายชื่อเพื่อนำไปทำ Custom Audience บนแพลตฟอร์มโฆษณา',
          'เชื่อมต่อกับ LINE Messaging API เพื่อทำ Personalized Broadcast',
          'ติดตามผลลัพธ์ Conversion Rate และยอดขายที่เกิดขึ้นจาก List'
        ],
        badge: 'Execution'
      }
    ],
    outputAndNextStep: {
      outputTitle: 'กลุ่มเป้าหมายคุณภาพสูงสำหรับแคมเปญการตลาด',
      outputItems: [
        'Dynamic Targeted Customer List',
        'แคมเปญ Personalized Retention / Re-engagement',
        'รายงานผลตอบรับและ ROI แคมเปญ'
      ],
      nextStatus: 'LIST_READY_FOR_CAMPAIGN',
      nextRoleOrModule: 'Digital Marketing & Sales Team'
    },
    slaAndKpi: {
      slaResponse: 'ประมวลผลสมาชิกใหม่เข้า List อัตโนมัติทุก 1 ชั่วโมง',
      keyChecklist: [
        'ทดสอบเงื่อนไข AND/OR ให้รอบคอบก่อนยิงแคมเปญจริง',
        'คัดกรองลูกค้ารายชื่อ Unsubscribe หรือติด Blacklist ออก',
        'ทบทวนประสิทธิภาพของ Segment เก่าทุกสิ้นไตรมาส'
      ],
      kpiMetric: 'Campaign Open Rate > 35% และ Conversion ROI > 5x'
    }
  },

  // 7. Field Services & Logistics
  'board-delivery': {
    id: 'board-delivery',
    stepCode: 'Step 3 — Delivery Fleet & Dispatch',
    moduleName: 'ศูนย์บริหารจัดการงานจัดส่งและยานพาหนะ (Delivery Fleet)',
    moduleSubtitle: 'คู่มือการใช้งาน (SOP) สำหรับ Dispatcher, เจ้าหน้าที่คลังสินค้า และทีมจัดส่ง',
    role: 'Fleet Dispatcher / Logistics Lead / Delivery Driver',
    inputSource: {
      title: 'ใบสั่งซื้อและสินค้าที่พร้อมจัดส่งจาก Closed Won Deals หรือ POS',
      description: 'งานจัดส่งที่มีที่อยู่และเวลานัดหมายชัดเจน พร้อมระบุขนาดรถที่ต้องใช้',
      startingStatus: 'Ready for Dispatch',
      inputFields: [
        'Order Number & Tracking Code',
        'สถานที่จัดส่ง & แผนที่พิกัด GPS',
        'ประเภทสินค้าและน้ำหนัก/ปริมาตร (CBM)',
        'ช่วงเวลานัดหมายลูกค้า (Delivery Window)'
      ]
    },
    flowchartMermaid: `graph TD
    ReadyOrder["1. รับ Order พร้อมจัดส่ง"] --> Plan["2. วางแผนเส้นทาง & เลือกรถ (Route Optimization)"]
    Plan --> AssignDriver["3. มอบหมายคนขับ & แจ้งเวลาลูกค้า"]
    AssignDriver --> Depart["4. รถออกจากคลัง (In Transit) + SMS Tracking"]
    Depart --> Delivery{"5. ส่งมอบหน้างาน & ลูกค้าตรวจรับ"}
    Delivery -->|สมบูรณ์| Complete["6. ถ่ายรูป POD & ปิดงาน (Delivered)"]
    Delivery -->|มีปัญหา/เลื่อน| Reschedule["7. บันทึกเหตุผล & นัดหมายรอบใหม่"]`,
    flowchartNodes: [
      { id: '1', label: '1. Order Ready', type: 'input', detail: 'คำสั่งซื้อพร้อมส่ง' },
      { id: '2', label: '2. Route & Fleet Plan', type: 'process', detail: 'จัดสรรเส้นทางและขนาดรถ' },
      { id: '3', label: '3. Assign & Notify', type: 'process', detail: 'ส่งตารางงานและแจ้งลูกค้า' },
      { id: '4', label: '4. Delivery & POD', type: 'output', detail: 'ส่งมอบและถ่ายภาพหลักฐาน' },
    ],
    instructions: [
      {
        stepNumber: 1,
        title: 'จัดสรรคิวงานและเส้นทางจัดส่ง (Dispatch Planning)',
        actionDetails: [
          'ตรวจสอบรายการงานในสถานะ "Ready for Dispatch"',
          'จัดกลุ่มที่อยู่จัดส่งในโซนเดียวกันเพื่อประหยัดเวลาและค่าเชื้อเพลิง',
          'เลือกขนาดรถ (กระบะ, 4 ล้อใหญ่, 6 ล้อ) ให้เหมาะกับขนาดสินค้า'
        ],
        badge: 'Dispatching'
      },
      {
        stepNumber: 2,
        title: 'มอบหมายคนขับและส่งการแจ้งเตือน (Driver Assignment)',
        actionDetails: [
          'ระบุชื่อคนขับและทะเบียนรถในระบบ',
          'ระบบส่งลิงก์ Tracking และเวลาประมาณการให้ลูกค้าผ่าน SMS/LINE',
          'ตรวจสอบการขึ้นสินค้าขึ้นรถให้ถูกต้องตามบิลส่งของ'
        ],
        badge: 'Assignment'
      },
      {
        stepNumber: 3,
        title: 'บันทึกหลักฐานการส่งมอบ (Proof of Delivery - POD)',
        actionDetails: [
          'เมื่อส่งสินค้าถึงที่หมาย ให้ลูกค้าลงลายมือชื่อตรวจรับ',
          'ถ่ายรูปสินค้าที่จัดวางหน้างานอย่างน้อย 3 มุม',
          'อัปโหลดรูปเข้าระบบและเปลี่ยนสถานะเป็น "Delivered"'
        ],
        badge: 'POD & Close'
      }
    ],
    outputAndNextStep: {
      outputTitle: 'หลักฐานการจัดส่งสำเร็จ (POD) & เอกสารตรวจรับ',
      outputItems: [
        'Proof of Delivery (POD) พร้อมภาพถ่ายและพิกัด GPS',
        'ใบส่งของที่มีลายเซ็นลูกค้า',
        'การแจ้งเตือนงานขั้นถัดไป (เช่น คิวทีมช่างติดตั้ง)'
      ],
      nextStatus: 'DELIVERED -> READY_FOR_INSTALLATION',
      nextRoleOrModule: 'Installation Technician'
    },
    slaAndKpi: {
      slaResponse: 'ตรงเวลาตามช่วงนัดหมาย (On-Time Delivery > 98%)',
      keyChecklist: [
        'ตรวจสภาพสินค้าก่อนออกจากคลังทุกครั้ง',
        'โทรคอนเฟิร์มลูกค้าล่วงหน้าอย่างน้อย 1 ชั่วโมงก่อนถึงหน้างาน',
        'อัปโหลดภาพ POD ให้ชัดเจนเห็นสภาพสินค้าสมบูรณ์'
      ],
      kpiMetric: 'On-Time In-Full (OTIF) % และ Zero Damage Rate'
    }
  },

  // 8. Supervisor Hub
  'supervisor': {
    id: 'supervisor',
    stepCode: 'WFM & Quality Assurance',
    moduleName: 'ศูนย์ควบคุมกำลังพลและคุณภาพการบริการ (Supervisor Workforce Hub)',
    moduleSubtitle: 'คู่มือการใช้งาน (SOP) สำหรับหัวหน้างาน (Supervisor), WFM Specialist และ QA Manager',
    role: 'Contact Center Supervisor / QA Lead / Workforce Manager',
    inputSource: {
      title: 'สถานะ Real-time Presence, คิวสาย/แชท, และผลการปฏิบัติงานของพนักงานทุกคน',
      description: 'ระบบมอนิเตอร์สถานะ Agent State (Online, Busy, Break, Away) แบบสดๆ พร้อมระบบแจ้งเตือน Adherence',
      startingStatus: 'Live Monitoring Center',
      inputFields: [
        'จำนวน Agent ที่เข้ากะทำงาน (Active Presence)',
        'เวลาการพักและสถานะเบรกเกินเวลา (Break Overstay Alerts)',
        'ปริมาณเคสค้างรอรับ (Queue Backlog & SLA Risk)',
        'คะแนนประเมินคุณภาพ QA Score'
      ]
    },
    flowchartMermaid: `graph TD
    LiveMonitor["1. มอนิเตอร์หน้าจอ Real-time Presence"] --> DetectAlert{"2. ตรวจพบความผิดปกติ?"}
    DetectAlert -->|เคสล้นคิว| Reallocate["3. สลับกำลังพล / เพิ่ม Agent เข้าช่วยคิว"]
    DetectAlert -->|เบรกเกินเวลา| Warning["4. ส่งสัญญาณเตือน หรือ บังคับจบเบรก (Force Sweep)"]
    DetectAlert -->|ปกติ| QA["5. สุ่มตรวจคุณภาพการตอบแชท (QA Audit)"]
    QA --> Coaching["6. บันทึกผลประเมิน & ทำ Coaching 1-on-1"]`,
    flowchartNodes: [
      { id: '1', label: '1. Live Workforce View', type: 'input', detail: 'ดูสถานะกำลังพลสด' },
      { id: '2', label: '2. SLA & Queue Alert', type: 'decision', detail: 'ตรวจจับคิวหนาแน่นหรือเบรกเกิน' },
      { id: '3', label: '3. Dynamic Rebalance', type: 'process', detail: 'เกลี่ยงานและดึง Agent เข้าช่วย' },
      { id: '4', label: '4. QA & 1-on-1 Coaching', type: 'output', detail: 'พัฒนาทักษะการบริการทีมงาน' },
    ],
    instructions: [
      {
        stepNumber: 1,
        title: 'ตรวจสอบความพร้อมของทีมงานประจำกะ (Shift Adherence)',
        actionDetails: [
          'ดูตัวเลขพนักงาน Online, Available, In Call/Chat, และ On Break',
          'ตรวจสอบว่ามีพนักงานไม่ตรงตามตารางกะ (Schedule Adherence) หรือไม่',
          'ใช้ฟังก์ชัน "Break Sweep" ในกรณีที่มีพนักงานลืมกดยุติการพัก'
        ],
        badge: 'Shift Management'
      },
      {
        stepNumber: 2,
        title: 'บริหารจัดการคิวและเคสเร่งด่วน (Queue Balancing)',
        actionDetails: [
          'หากคิวรอรับบริการเกิน 5 เคส หรือเวลารอเฉลี่ย > 2 นาที ให้เรียก Agent สแตนด์บายเข้าคิวทันที',
          'ตรวจสอบเคส VIP หรือเคสที่มีข้อร้องเรียนเร่งด่วนเพื่อ Takeover หรือให้คำแนะนำเบื้องหลัง (Whisper Mode)'
        ],
        badge: 'Queue Control'
      },
      {
        stepNumber: 3,
        title: 'สุ่มตรวจคุณภาพและบันทึกคะแนน QA (Quality Assurance)',
        actionDetails: [
          'สุ่มตรวจบันทึกการสนทนาอย่างน้อย 5 เคส ต่อคน/สัปดาห์',
          'ให้คะแนนตามมาตรฐาน VCRMX QA Form (มารยาท, ความถูกต้อง, การปิดการขาย)',
          'นัดหมายทำ Coaching สัปดาห์ละ 1 ครั้งสำหรับจุดที่ต้องปรับปรุง'
        ],
        badge: 'QA Audit'
      }
    ],
    outputAndNextStep: {
      outputTitle: 'รายงานประสิทธิภาพการทำงานและรายงาน QA ประจำสัปดาห์',
      outputItems: [
        'Shift Adherence & Attendance Report',
        'Contact Center SLA & Abandonment Rate Summary',
        'QA Scorecard & Coaching Action Plans'
      ],
      nextStatus: 'SUPERVISOR_AUDIT_COMPLETED',
      nextRoleOrModule: 'Contact Center Operations Lead'
    },
    slaAndKpi: {
      slaResponse: 'Service Level Agreement (SLA) > 90% ของสาย/แชทรับได้ภายใน 30 วินาที',
      keyChecklist: [
        'เข้ามอนิเตอร์บอร์ดทุกต้นชั่วโมงเร่งด่วน',
        'ตรวจสอบการบันทึกสาเหตุการลา/เบรกของพนักงานทุกคน',
        'สรุปรายงาน Incident รายวันส่งฝ่ายบริหารภายใน 18:00 น.'
      ],
      kpiMetric: 'Schedule Adherence % > 95% และ QA Score เฉลี่ย > 90 คะแนน'
    }
  }
};

export function getSOPGuideForContext(tab?: string, boardId?: string): SOPGuide {
  // If in deals/pipeline boards, try boardId first
  if (boardId && MASTER_SOP_GUIDES[boardId]) {
    return MASTER_SOP_GUIDES[boardId];
  }
  // Otherwise try tab
  if (tab && MASTER_SOP_GUIDES[tab]) {
    return MASTER_SOP_GUIDES[tab];
  }
  // Default to Deals & Pipeline or Dashboard
  return MASTER_SOP_GUIDES['dashboard'];
}
