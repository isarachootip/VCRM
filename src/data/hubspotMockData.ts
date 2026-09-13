import { HubSpotList, HubSpotContactRecord, HubSpotViewTab } from '@/types/hubspot';

export const HUBSPOT_DEFAULT_VIEWS: HubSpotViewTab[] = [
  { id: 'view-all', name: 'All contacts', objectType: 'CONTACTS', isPinned: true },
  { id: 'view-my', name: 'My contacts', objectType: 'CONTACTS', isPinned: true, filterCount: 1 },
  { id: 'view-unassigned', name: 'Unassigned leads', objectType: 'CONTACTS', isPinned: false, filterCount: 1 },
  { id: 'view-mql', name: 'Marketing Qualified (MQL)', objectType: 'CONTACTS', isPinned: false, filterCount: 2 },
  { id: 'view-closed', name: 'Closed Customers', objectType: 'CONTACTS', isPinned: false, filterCount: 1 },
];

export const HUBSPOT_OBJECT_LISTS: HubSpotList[] = [
  {
    id: 'list-1',
    name: '🌟 รายชื่อผู้ติดต่อองค์กรความสนใจสูง (2026)',
    description: 'รายการอัปเดตอัตโนมัติของบริษัทขนาดใหญ่ที่มีพนักงาน > 50 คน และมีการโต้ตอบล่าสุดใน 30 วัน',
    objectType: 'CONTACTS',
    listType: 'ACTIVE',
    size: 248,
    createdDate: '2026-01-15',
    createdBy: { name: 'Thanakorn W.', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces' },
    lastUpdated: '2026-08-19 14:32',
    folder: 'กลุ่มองค์กรใหญ่'
  },
  {
    id: 'list-2',
    name: '📊 ผู้ขอสาธิตระบบขาเข้า ไตรมาส 3',
    description: 'ลูกค้ากรอกแบบฟอร์มขอทดลองใช้ระบบในหน้าราคาหรือหน้าตัวอย่างสินค้า',
    objectType: 'CONTACTS',
    listType: 'ACTIVE',
    size: 112,
    createdDate: '2026-07-01',
    createdBy: { name: 'Pimchanok S.', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=faces' },
    lastUpdated: '2026-08-20 09:15',
    folder: 'แคมเปญขาเข้า'
  },
  {
    id: 'list-3',
    name: '🏢 รายชื่อผู้บริหารระดับสูง CXO และ VP',
    description: 'รายชื่อผู้มีอำนาจตัดสินใจระดับ C-Level จาก 100 บริษัทชั้นนำในตลาดหลักทรัพย์ SET',
    objectType: 'CONTACTS',
    listType: 'STATIC',
    size: 95,
    createdDate: '2026-03-10',
    createdBy: { name: 'Somchai P.', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=faces' },
    lastUpdated: '2026-08-18 16:40',
    folder: 'กลุ่มลูกค้า VIP'
  },
  {
    id: 'list-4',
    name: '🤝 ข้อตกลงอยู่ระหว่างเจรจาสุดท้าย (> ฿1M)',
    description: 'รายการติดตามข้อตกลงที่อยู่ในขั้นตอนทบทวนใบเสนอราคาหรือกำลังเซ็นสัญญาทางกฎหมาย',
    objectType: 'DEALS',
    listType: 'ACTIVE',
    size: 18,
    createdDate: '2026-05-20',
    createdBy: { name: 'Thanakorn W.', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces' },
    lastUpdated: '2026-08-20 10:00',
    folder: 'กระบวนการขาย'
  },
  {
    id: 'list-5',
    name: '🏬 บริษัทค้าปลีกและสินค้าอุปโภคบริโภคในไทย',
    description: 'บริษัทต่าง ๆ ในอุตสาหกรรมค้าปลีก ซูเปอร์มาร์เก็ต และสินค้าอุปโภคบริโภคทั่วไป',
    objectType: 'COMPANIES',
    listType: 'ACTIVE',
    size: 142,
    createdDate: '2026-02-18',
    createdBy: { name: 'Nattawut K.', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=faces' },
    lastUpdated: '2026-08-17 11:20',
    folder: 'กลุ่มอุตสาหกรรม'
  },
  {
    id: 'list-6',
    name: '💼 ผู้ร่วมงานสัมมนา Q3 Bangkok Expo 2026',
    description: 'รายชื่อนำเข้าของผู้เข้าชมบูธที่สแกน QR Code ณ ศูนย์การประชุมแห่งชาติสิริกิติ์',
    objectType: 'CONTACTS',
    listType: 'STATIC',
    size: 340,
    createdDate: '2026-07-25',
    createdBy: { name: 'Pimchanok S.', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=faces' },
    lastUpdated: '2026-07-28 17:05',
    folder: 'ลูกค้าจากอีเวนต์'
  },
  {
    id: 'list-7',
    name: '⚡ รายชื่อผู้ติดต่อที่ไม่เคลื่อนไหว (> 90 วัน)',
    description: 'รายชื่อผู้ติดต่อที่ไม่มีการเปิดอ่านอีเมลหรือติดต่อฝ่ายขายเลยใน 3 เดือนที่ผ่านมา เพื่อวางแผนส่งเสริมความสัมพันธ์ใหม่',
    objectType: 'CONTACTS',
    listType: 'ACTIVE',
    size: 512,
    createdDate: '2026-04-12',
    createdBy: { name: 'Somchai P.', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=faces' },
    lastUpdated: '2026-08-20 02:00',
    folder: 'กระตุ้นความสนใจ'
  },
  {
    id: 'list-8',
    name: '🎯 ลูกค้าเป้าหมายฝ่ายการตลาดผ่านเกณฑ์ (MQL)',
    description: 'รายชื่อที่มีคะแนนพฤติกรรม > 70 คะแนน และเข้ามาดูหน้าราคามากกว่าสองครั้ง',
    objectType: 'CONTACTS',
    listType: 'ACTIVE',
    size: 184,
    createdDate: '2026-03-01',
    createdBy: { name: 'Pimchanok S.', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=faces' },
    lastUpdated: '2026-08-19 18:45',
    folder: 'การตลาดและกรวยขาย'
  },
  {
    id: 'list-9',
    name: '🏗️ ลูกค้ากลุ่มรับเหมาก่อสร้างและพัฒนาอสังหาฯ',
    description: 'บริษัทที่ทำธุรกิจโครงการคอนโดมิเนียม อาคารพาณิชย์ และการพัฒนาอสังหาริมทรัพย์',
    objectType: 'COMPANIES',
    listType: 'ACTIVE',
    size: 68,
    createdDate: '2026-04-05',
    createdBy: { name: 'Nattawut K.', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=faces' },
    lastUpdated: '2026-08-15 14:10',
    folder: 'กลุ่มอุตสาหกรรม'
  },
  {
    id: 'list-10',
    name: '🏆 ปิดการขายสำเร็จ 2026 (สะสมต้นปีถึงปัจจุบัน)',
    description: 'ข้อตกลงที่ปิดการขายสำเร็จแล้วทั้งหมดของฝ่ายขายลูกค้าองค์กรและตลาดระดับกลาง',
    objectType: 'DEALS',
    listType: 'ACTIVE',
    size: 47,
    createdDate: '2026-01-01',
    createdBy: { name: 'Thanakorn W.', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces' },
    lastUpdated: '2026-08-20 08:30',
    folder: 'กระบวนการขาย'
  },
  {
    id: 'list-11',
    name: '🔔 ผู้ติดต่อขาเข้าที่ยังไม่ได้จัดสรร',
    description: 'รายชื่อผู้ติดต่อใหม่ที่ยังไม่ได้ถูกกำหนดมอบหมายให้เซลส์คนใดดูแล',
    objectType: 'CONTACTS',
    listType: 'ACTIVE',
    size: 29,
    createdDate: '2026-06-15',
    createdBy: { name: 'Somchai P.', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=faces' },
    lastUpdated: '2026-08-20 11:00',
    folder: 'การส่งต่อลีด'
  },
  {
    id: 'list-12',
    name: '💌 ผู้ติดตามรับจดหมายข่าวรายเดือน',
    description: 'ผู้ลงทะเบียนสมัครอีเมลรับข่าวสารอัปเดตทางเทคนิคและโปรโมชันรายเดือน',
    objectType: 'CONTACTS',
    listType: 'ACTIVE',
    size: 1450,
    createdDate: '2026-01-10',
    createdBy: { name: 'Pimchanok S.', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=faces' },
    lastUpdated: '2026-08-19 20:00',
    folder: 'อีเมลการตลาด'
  },
  {
    id: 'list-13',
    name: '💎 บัญชีลูกค้า VIP ระดับ Gold & Platinum',
    description: 'บัญชีบริษัทที่มีมูลค่าสัญญารายปี (ACV) สูงกว่า 3,000,000 บาท',
    objectType: 'COMPANIES',
    listType: 'STATIC',
    size: 32,
    createdDate: '2026-02-01',
    createdBy: { name: 'Thanakorn W.', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces' },
    lastUpdated: '2026-08-10 13:00',
    folder: 'กลุ่มลูกค้า VIP'
  },
  {
    id: 'list-14',
    name: '🚚 คิวงานช่างบริการและติดตั้งที่รอดำเนินการ',
    description: 'ใบงานแจ้งซ่อมบำรุงและงานบริการหน้างานที่กำลังรอช่างเข้าไปจัดการ',
    objectType: 'TICKETS',
    listType: 'ACTIVE',
    size: 19,
    createdDate: '2026-06-01',
    createdBy: { name: 'Nattawut K.', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=faces' },
    lastUpdated: '2026-08-20 10:45',
    folder: 'งานปฏิบัติการ'
  },
  {
    id: 'list-15',
    name: '📱 ลูกค้าติดต่อผ่าน WhatsApp & LINE Official',
    description: 'ผู้ติดต่อช่องทางออมนิแชนเนลที่ซิงค์จาก LINE Official Account และ WhatsApp Business',
    objectType: 'CONTACTS',
    listType: 'ACTIVE',
    size: 382,
    createdDate: '2026-03-22',
    createdBy: { name: 'Pimchanok S.', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=faces' },
    lastUpdated: '2026-08-20 09:50',
    folder: 'แคมเปญขาเข้า'
  },
  {
    id: 'list-16',
    name: '📑 สัญญากำลังจะหมดอายุใน 60 วัน',
    description: 'ลูกค้าปัจจุบันที่มีข้อตกลงใกล้ถึงกำหนดเวลาต่ออายุสัญญาซ่อมบำรุงและลิขสิทธิ์รายปี',
    objectType: 'DEALS',
    listType: 'ACTIVE',
    size: 24,
    createdDate: '2026-04-18',
    createdBy: { name: 'Somchai P.', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=faces' },
    lastUpdated: '2026-08-19 15:10',
    folder: 'รักษาความสัมพันธ์'
  },
  {
    id: 'list-17',
    name: '🏥 บัญชีลูกค้ากลุ่มโรงพยาบาลและสาธารณสุข',
    description: 'โรงพยาบาลเอกชน คลินิก และสถาบันวิจัยทางการแพทย์',
    objectType: 'COMPANIES',
    listType: 'ACTIVE',
    size: 45,
    createdDate: '2026-05-11',
    createdBy: { name: 'Nattawut K.', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=faces' },
    lastUpdated: '2026-08-12 11:15',
    folder: 'กลุ่มอุตสาหกรรม'
  },
  {
    id: 'list-18',
    name: '⚠️ ลูกค้าที่มีความเสี่ยงสูง/เตือนโอกาสยกเลิกบริการ',
    description: 'ลูกค้าที่ใช้งานระบบน้อยกว่าเกณฑ์ปกติ และมีคะแนนความพึงพอใจ NPS ต่ำ',
    objectType: 'CONTACTS',
    listType: 'ACTIVE',
    size: 14,
    createdDate: '2026-06-28',
    createdBy: { name: 'Thanakorn W.', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces' },
    lastUpdated: '2026-08-18 17:30',
    folder: 'รักษาความสัมพันธ์'
  },
  {
    id: 'list-19',
    name: '🛠️ ใบตรวจสอบบริการหลังการขาย/รับประกันเสร็จสิ้น',
    description: 'ใบงานบำรุงรักษาที่เสร็จสมบูรณ์เรียบร้อยแล้วและลูกค้าเซ็นยอมรับในเดือนสิงหาคม 2026',
    objectType: 'TICKETS',
    listType: 'STATIC',
    size: 88,
    createdDate: '2026-08-01',
    createdBy: { name: 'Nattawut K.', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=faces' },
    lastUpdated: '2026-08-19 16:20',
    folder: 'งานปฏิบัติการ'
  },
  {
    id: 'list-20',
    name: '💻 กลุ่มบริษัทเทคโนโลยีสตาร์ทอัปและ SaaS',
    description: 'บริษัทเทคโนโลยีระดับเริ่มต้น Seed ถึง Series B ในภูมิภาคเอเชียตะวันออกเฉียงใต้',
    objectType: 'COMPANIES',
    listType: 'STATIC',
    size: 73,
    createdDate: '2026-03-30',
    createdBy: { name: 'Pimchanok S.', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=faces' },
    lastUpdated: '2026-07-15 09:40',
    folder: 'กลุ่มอุตสาหกรรม'
  },
  {
    id: 'list-21',
    name: '🎪 รายชื่อผู้ลงทะเบียนสัมมนา CRM & AI อัตโนมัติ',
    description: 'ผู้เข้าร่วมสัมมนาออนไลน์ที่ร่วมรับฟังนานกว่า 40 นาทีผ่านทาง Zoom',
    objectType: 'CONTACTS',
    listType: 'STATIC',
    size: 215,
    createdDate: '2026-08-05',
    createdBy: { name: 'Somchai P.', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=faces' },
    lastUpdated: '2026-08-06 10:10',
    folder: 'ลูกค้าจากอีเวนต์'
  },
  {
    id: 'list-22',
    name: '💰 ข้อตกลงที่พลาดเป้าเนื่องจากงบประมาณ',
    description: 'ดีลการขายที่พลาดไปเนื่องจากเรื่องราคาหรืองบประมาณ เพื่อวางแผนจัดแคมเปญลดราคาส่วนลดใน Q4',
    objectType: 'DEALS',
    listType: 'ACTIVE',
    size: 31,
    createdDate: '2026-02-14',
    createdBy: { name: 'Thanakorn W.', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces' },
    lastUpdated: '2026-08-14 18:00',
    folder: 'กระบวนการขาย'
  },
  {
    id: 'list-23',
    name: '🌏 บริษัทข้ามชาติสำนักงานใหญ่ภูมิภาค APAC',
    description: 'บริษัทระดับโลกที่มีสำนักงานใหญ่ประจำภูมิภาคตั้งอยู่ในกรุงเทพฯ หรือสิงคโปร์',
    objectType: 'COMPANIES',
    listType: 'STATIC',
    size: 56,
    createdDate: '2026-04-20',
    createdBy: { name: 'Somchai P.', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=faces' },
    lastUpdated: '2026-07-22 14:50',
    folder: 'กลุ่มลูกค้า VIP'
  },
  {
    id: 'list-24',
    name: '🎓 รายชื่อผู้ติดต่อกลุ่มสถาบันการศึกษาและมหาวิทยาลัย',
    description: 'รายชื่อคณบดี หัวหน้าฝ่ายจัดซื้อ และผู้อำนวยการฝ่ายไอทีของมหาวิทยาลัยรัฐและเอกชน',
    objectType: 'CONTACTS',
    listType: 'STATIC',
    size: 83,
    createdDate: '2026-05-02',
    createdBy: { name: 'Pimchanok S.', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=faces' },
    lastUpdated: '2026-06-18 11:30',
    folder: 'กลุ่มอุตสาหกรรม'
  },
  {
    id: 'list-25',
    name: '🚀 กลุ่มผู้ร่วมทดสอบผลิตภัณฑ์ใหม่ Beta Testers 2026',
    description: 'ลูกค้ากลุ่มแรกที่เข้าร่วมโครงการทดสอบฟีเจอร์ใหม่และให้คำแนะนำในการพัฒนา',
    objectType: 'CONTACTS',
    listType: 'STATIC',
    size: 64,
    createdDate: '2026-07-10',
    createdBy: { name: 'Thanakorn W.', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces' },
    lastUpdated: '2026-08-19 12:00',
    folder: 'กระตุ้นความสนใจ'
  }
];

export const HUBSPOT_CONTACTS_DATA: HubSpotContactRecord[] = [
  {
    id: 'hs-c-1',
    name: 'คุณวรปรัชญ์ เกียรติไพศาล',
    firstName: 'วรปรัชญ์',
    lastName: 'เกียรติไพศาล',
    email: 'woraprach@siamretail.co.th',
    phone: '+66 81 889 2345',
    jobTitle: 'Chief Technology Officer (CTO)',
    company: {
      id: 'comp-1',
      name: 'Siam Retail & Logistics Group',
      domain: 'siamretail.co.th',
      industry: 'Retail & Consumer Goods'
    },
    leadStatus: 'OPEN_DEAL',
    lifecycleStage: 'OPPORTUNITY',
    owner: {
      name: 'Thanakorn W.',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces',
      email: 'thanakorn@vcrm.com'
    },
    createDate: '2026-06-12',
    lastActivityDate: '2026-08-19 16:30',
    associatedDeals: [
      { id: 'd-101', name: 'Omnichannel POS Cloud Integration', amount: 1850000, stage: 'Proposal Sent', closeDate: '2026-09-30' },
      { id: 'd-102', name: 'Smart Warehouse IoT Sensors', amount: 720000, stage: 'Qualified', closeDate: '2026-11-15' }
    ],
    associatedTickets: [
      { id: 't-501', subject: 'API Sandbox Access for Dev Team', status: 'Resolved', priority: 'Medium' }
    ],
    notes: [
      {
        id: 'n-1',
        author: 'Thanakorn W.',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces',
        content: 'ประชุมสรุปขอบเขตงานระบบ POS กับทีม IT แล้ว ลูกค้าต้องการ Go-live ภายในปลายเดือนกันยายนนี้',
        createdAt: '2026-08-19 16:30'
      }
    ],
    activities: [
      { id: 'a-1', type: 'call', title: 'โทรติดตามใบเสนอราคาและ Scope งาน', description: 'คุยกับคุณวรปรัชญ์เรื่องงบประมาณปี 2026 อนุมัติผ่านบอร์ดแล้ว', timestamp: '2026-08-19 15:45', user: 'Thanakorn W.' },
      { id: 'a-2', type: 'email', title: 'ส่ง Proposal V2 และ Architecture Diagram', description: 'แนบไฟล์ Technical Spec & SLA Agreement', timestamp: '2026-08-18 10:20', user: 'Thanakorn W.' },
      { id: 'a-3', type: 'meeting', title: 'Demo ระบบ Dispatch & CRM Online', description: 'ประชุมผ่าน Microsoft Teams 45 นาที ร่วมกับทีม Operations', timestamp: '2026-08-14 14:00', user: 'Thanakorn W.' }
    ]
  },
  {
    id: 'hs-c-2',
    name: 'ดร. กานดา อรุณรัศมี',
    firstName: 'กานดา',
    lastName: 'อรุณรัศมี',
    email: 'kanda@bangkokhealth.com',
    phone: '+66 89 456 7890',
    jobTitle: 'Head of Operations & Patient Service',
    company: {
      id: 'comp-2',
      name: 'Bangkok Premium Hospital Network',
      domain: 'bangkokhealth.com',
      industry: 'Healthcare & Medical'
    },
    leadStatus: 'CONNECTED',
    lifecycleStage: 'MARKETING_QUALIFIED',
    owner: {
      name: 'Pimchanok S.',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=faces',
      email: 'pimchanok@vcrm.com'
    },
    createDate: '2026-07-08',
    lastActivityDate: '2026-08-20 09:10',
    associatedDeals: [
      { id: 'd-201', name: 'Patient Transport & Shuttle Tracking System', amount: 980000, stage: 'Negotiation', closeDate: '2026-10-10' }
    ],
    associatedTickets: [],
    notes: [
      {
        id: 'n-2',
        author: 'Pimchanok S.',
        avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=faces',
        content: 'คุณหมอกานดาประทับใจระบบ Dispatch Board ที่แสดงสถานะรถพยาบาลและคิวคนไข้แบบ Real-time',
        createdAt: '2026-08-20 09:10'
      }
    ],
    activities: [
      { id: 'a-4', type: 'email', title: 'ส่งเอกสารรับรองความปลอดภัยตามมาตรฐาน PDPA', description: 'ส่ง Compliance Checklist ให้ทีม Legal ของโรงพยาบาล', timestamp: '2026-08-20 09:05', user: 'Pimchanok S.' },
      { id: 'a-5', type: 'call', title: 'ประสานงานเรื่องทดสอบ Pilot Project', description: 'นัดหมาย Setup ทดลองใช้ 2 สาขาในสัปดาห์หน้า', timestamp: '2026-08-16 11:30', user: 'Pimchanok S.' }
    ]
  },
  {
    id: 'hs-c-3',
    name: 'คุณเอกชัย วัฒนกุล',
    firstName: 'เอกชัย',
    lastName: 'วัฒนกุล',
    email: 'ekachai@grandhorizon.co.th',
    phone: '+66 84 123 9988',
    jobTitle: 'Managing Director',
    company: {
      id: 'comp-3',
      name: 'Grand Horizon Real Estate & Property',
      domain: 'grandhorizon.co.th',
      industry: 'Real Estate & Construction'
    },
    leadStatus: 'IN_PROGRESS',
    lifecycleStage: 'CUSTOMER',
    owner: {
      name: 'Somchai P.',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=faces',
      email: 'somchai@vcrm.com'
    },
    createDate: '2026-03-01',
    lastActivityDate: '2026-08-17 13:40',
    associatedDeals: [
      { id: 'd-301', name: 'Smart Condo After-Sales & Maintenance Portal', amount: 3200000, stage: 'Closed Won', closeDate: '2026-05-30' },
      { id: 'd-302', name: 'Phase 2: Villa Project Expansion (12 Projects)', amount: 1500000, stage: 'Proposal Sent', closeDate: '2026-12-20' }
    ],
    associatedTickets: [
      { id: 't-601', subject: 'ขอเพิ่ม User License ช่างเทคนิค 15 บัญชี', status: 'In Progress', priority: 'High' }
    ],
    notes: [
      {
        id: 'n-3',
        author: 'Somchai P.',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=faces',
        content: 'ลูกค้ารายใหญ่เซ็นสัญญาเฟสแรกเรียบร้อยแล้ว กำลังเตรียมเริ่มเจรจาเฟส 2 ต่อ',
        createdAt: '2026-08-17 13:40'
      }
    ],
    activities: [
      { id: 'a-6', type: 'meeting', title: 'On-site Quarterly Business Review (QBR)', description: 'เข้าพบคุณเอกชัยที่สำนักงานใหญ่เพลินจิต สรุปสถิติงานซ่อมบำรุง 500 เคส', timestamp: '2026-08-17 13:00', user: 'Somchai P.' }
    ]
  },
  {
    id: 'hs-c-4',
    name: 'คุณณิชาภา บุญประเสริฐ',
    firstName: 'ณิชาภา',
    lastName: 'บุญประเสริฐ',
    email: 'nichapa@siamlogistics.com',
    phone: '+66 86 333 4455',
    jobTitle: 'Supply Chain & Fleet Director',
    company: {
      id: 'comp-4',
      name: 'Thai Express Logistics & Cargo',
      domain: 'siamlogistics.com',
      industry: 'Transportation & Logistics'
    },
    leadStatus: 'NEW',
    lifecycleStage: 'LEAD',
    owner: {
      name: 'Nattawut K.',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=faces',
      email: 'nattawut@vcrm.com'
    },
    createDate: '2026-08-18',
    lastActivityDate: '2026-08-18 14:15',
    associatedDeals: [
      { id: 'd-401', name: 'Fleet Dispatch & Driver Mobile App 50 Trucks', amount: 890000, stage: 'Appointment Scheduled', closeDate: '2026-10-31' }
    ],
    associatedTickets: [],
    notes: [],
    activities: [
      { id: 'a-7', type: 'note', title: 'รับ Lead จาก Facebook Ads แคมเปญ Smart Logistics', description: 'ลูกค้าสนใจระบบจ่ายงานคนขับผ่านมือถือและถ่ายรูป Proof of Delivery', timestamp: '2026-08-18 14:15', user: 'System' }
    ]
  },
  {
    id: 'hs-c-5',
    name: 'คุณภานุเดช ธรรมวัฒนา',
    firstName: 'ภานุเดช',
    lastName: 'ธรรมวัฒนา',
    email: 'phanudet@greenenergymakers.com',
    phone: '+66 82 777 6655',
    jobTitle: 'Chief Executive Officer (CEO)',
    company: {
      id: 'comp-5',
      name: 'Green Solar Energy Tech',
      domain: 'greenenergymakers.com',
      industry: 'Energy & Renewables'
    },
    leadStatus: 'OPEN',
    lifecycleStage: 'SALES_QUALIFIED',
    owner: {
      name: 'Thanakorn W.',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces',
      email: 'thanakorn@vcrm.com'
    },
    createDate: '2026-05-14',
    lastActivityDate: '2026-08-19 11:00',
    associatedDeals: [
      { id: 'd-501', name: 'Solar Rooftop Installation Workflow & CRM', amount: 1420000, stage: 'Decision Maker Bought-In', closeDate: '2026-09-15' }
    ],
    associatedTickets: [],
    notes: [
      {
        id: 'n-5',
        author: 'Thanakorn W.',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces',
        content: 'ลูกค้ามีทีมวิศวกรติดตั้ง 30 คน ต้องการระบบบันทึกรูปหน้างานและคำนวณต้นทุนอะไหล่',
        createdAt: '2026-08-19 11:00'
      }
    ],
    activities: [
      { id: 'a-8', type: 'call', title: 'โทรยืนยันวันเซ็นสัญญากับฝ่ายจัดซื้อ', description: 'นัดเซ็นสัญญาและเปิด PO วันที่ 28 สิงหาคมนี้', timestamp: '2026-08-19 10:50', user: 'Thanakorn W.' }
    ]
  }
];
