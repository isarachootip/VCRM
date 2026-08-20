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
    name: '🌟 High Intent Enterprise Leads (2026)',
    description: 'Active list filtering enterprise contacts with company size > 50 and active engagement in last 30 days',
    objectType: 'CONTACTS',
    listType: 'ACTIVE',
    size: 248,
    createdDate: '2026-01-15',
    createdBy: { name: 'Thanakorn W.', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces' },
    lastUpdated: '2026-08-19 14:32',
    folder: 'Enterprise Segments'
  },
  {
    id: 'list-2',
    name: '📊 Inbound Demo Requests Q3',
    description: 'Form submission on pricing and product demo request landing page',
    objectType: 'CONTACTS',
    listType: 'ACTIVE',
    size: 112,
    createdDate: '2026-07-01',
    createdBy: { name: 'Pimchanok S.', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=faces' },
    lastUpdated: '2026-08-20 09:15',
    folder: 'Inbound Campaigns'
  },
  {
    id: 'list-3',
    name: '🏢 Key Account CXOs & VP Level',
    description: 'Static list of C-level decision makers from Top 100 SET listed corporations',
    objectType: 'CONTACTS',
    listType: 'STATIC',
    size: 95,
    createdDate: '2026-03-10',
    createdBy: { name: 'Somchai P.', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=faces' },
    lastUpdated: '2026-08-18 16:40',
    folder: 'VIP Lists'
  },
  {
    id: 'list-4',
    name: '🤝 Deals in Final Negotiation (> ฿1M)',
    description: 'Active list tracking deals currently at proposal review or legal signing stage',
    objectType: 'DEALS',
    listType: 'ACTIVE',
    size: 18,
    createdDate: '2026-05-20',
    createdBy: { name: 'Thanakorn W.', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces' },
    lastUpdated: '2026-08-20 10:00',
    folder: 'Pipeline'
  },
  {
    id: 'list-5',
    name: '🏬 Retail & FMCG Companies Thailand',
    description: 'Companies in Retail, Supermarket, and Fast Moving Consumer Goods industry',
    objectType: 'COMPANIES',
    listType: 'ACTIVE',
    size: 142,
    createdDate: '2026-02-18',
    createdBy: { name: 'Nattawut K.', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=faces' },
    lastUpdated: '2026-08-17 11:20',
    folder: 'Industry Segments'
  },
  {
    id: 'list-6',
    name: '💼 Q3 Bangkok Expo 2026 Attendees',
    description: 'Imported list of booth visitors scanned via QR code at Queen Sirikit National Convention Center',
    objectType: 'CONTACTS',
    listType: 'STATIC',
    size: 340,
    createdDate: '2026-07-25',
    createdBy: { name: 'Pimchanok S.', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=faces' },
    lastUpdated: '2026-07-28 17:05',
    folder: 'Event Leads'
  },
  {
    id: 'list-7',
    name: '⚡ Inactive Contacts (> 90 Days)',
    description: 'Contacts with zero email opens or sales touchpoints in the past 3 months for re-engagement',
    objectType: 'CONTACTS',
    listType: 'ACTIVE',
    size: 512,
    createdDate: '2026-04-12',
    createdBy: { name: 'Somchai P.', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=faces' },
    lastUpdated: '2026-08-20 02:00',
    folder: 'Nurturing'
  },
  {
    id: 'list-8',
    name: '🎯 Qualified Marketing Leads (MQL)',
    description: 'Contacts that scored > 70 in marketing attribution and visited pricing page twice',
    objectType: 'CONTACTS',
    listType: 'ACTIVE',
    size: 184,
    createdDate: '2026-03-01',
    createdBy: { name: 'Pimchanok S.', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=faces' },
    lastUpdated: '2026-08-19 18:45',
    folder: 'Marketing Funnel'
  },
  {
    id: 'list-9',
    name: '🏗️ Construction & Developer Clients',
    description: 'Companies engaged in condominium, commercial building, and real estate development',
    objectType: 'COMPANIES',
    listType: 'ACTIVE',
    size: 68,
    createdDate: '2026-04-05',
    createdBy: { name: 'Nattawut K.', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=faces' },
    lastUpdated: '2026-08-15 14:10',
    folder: 'Industry Segments'
  },
  {
    id: 'list-10',
    name: '🏆 Closed Won Deals 2026 (YTD)',
    description: 'All closed won deals across enterprise and mid-market sales teams',
    objectType: 'DEALS',
    listType: 'ACTIVE',
    size: 47,
    createdDate: '2026-01-01',
    createdBy: { name: 'Thanakorn W.', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces' },
    lastUpdated: '2026-08-20 08:30',
    folder: 'Pipeline'
  },
  {
    id: 'list-11',
    name: '🔔 Unassigned Inbound Leads',
    description: 'New contacts created without a designated sales representative owner',
    objectType: 'CONTACTS',
    listType: 'ACTIVE',
    size: 29,
    createdDate: '2026-06-15',
    createdBy: { name: 'Somchai P.', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=faces' },
    lastUpdated: '2026-08-20 11:00',
    folder: 'Lead Routing'
  },
  {
    id: 'list-12',
    name: '💌 Monthly Newsletter Subscribers',
    description: 'Opted-in email subscribers for technical updates and monthly promotions',
    objectType: 'CONTACTS',
    listType: 'ACTIVE',
    size: 1450,
    createdDate: '2026-01-10',
    createdBy: { name: 'Pimchanok S.', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=faces' },
    lastUpdated: '2026-08-19 20:00',
    folder: 'Email Marketing'
  },
  {
    id: 'list-13',
    name: '💎 VIP Gold & Platinum Accounts',
    description: 'Accounts with annual contract value (ACV) exceeding ฿3,000,000',
    objectType: 'COMPANIES',
    listType: 'STATIC',
    size: 32,
    createdDate: '2026-02-01',
    createdBy: { name: 'Thanakorn W.', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces' },
    lastUpdated: '2026-08-10 13:00',
    folder: 'VIP Lists'
  },
  {
    id: 'list-14',
    name: '🚚 Service & Installation Work Orders Pending',
    description: 'Tickets and field service dispatches waiting for technician scheduling',
    objectType: 'TICKETS',
    listType: 'ACTIVE',
    size: 19,
    createdDate: '2026-06-01',
    createdBy: { name: 'Nattawut K.', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=faces' },
    lastUpdated: '2026-08-20 10:45',
    folder: 'Operations'
  },
  {
    id: 'list-15',
    name: '📱 WhatsApp & LINE Official Inquiries',
    description: 'Omnichannel leads synced from official LINE @ account and WhatsApp Business',
    objectType: 'CONTACTS',
    listType: 'ACTIVE',
    size: 382,
    createdDate: '2026-03-22',
    createdBy: { name: 'Pimchanok S.', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=faces' },
    lastUpdated: '2026-08-20 09:50',
    folder: 'Inbound Campaigns'
  },
  {
    id: 'list-16',
    name: '📑 Contract Renewal Due in 60 Days',
    description: 'Existing customer deals approaching annual maintenance and license renewals',
    objectType: 'DEALS',
    listType: 'ACTIVE',
    size: 24,
    createdDate: '2026-04-18',
    createdBy: { name: 'Somchai P.', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=faces' },
    lastUpdated: '2026-08-19 15:10',
    folder: 'Retention'
  },
  {
    id: 'list-17',
    name: '🏥 Healthcare & Hospital Sector Accounts',
    description: 'Private hospitals, clinics, and medical research institutes',
    objectType: 'COMPANIES',
    listType: 'ACTIVE',
    size: 45,
    createdDate: '2026-05-11',
    createdBy: { name: 'Nattawut K.', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=faces' },
    lastUpdated: '2026-08-12 11:15',
    folder: 'Industry Segments'
  },
  {
    id: 'list-18',
    name: '⚠️ High Risk / Attrition Warning Customers',
    description: 'Customers with low product usage and negative NPS survey responses',
    objectType: 'CONTACTS',
    listType: 'ACTIVE',
    size: 14,
    createdDate: '2026-06-28',
    createdBy: { name: 'Thanakorn W.', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces' },
    lastUpdated: '2026-08-18 17:30',
    folder: 'Retention'
  },
  {
    id: 'list-19',
    name: '🛠️ Completed Warranty Service Checks',
    description: 'Closed maintenance tickets with positive customer signoff in August 2026',
    objectType: 'TICKETS',
    listType: 'STATIC',
    size: 88,
    createdDate: '2026-08-01',
    createdBy: { name: 'Nattawut K.', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=faces' },
    lastUpdated: '2026-08-19 16:20',
    folder: 'Operations'
  },
  {
    id: 'list-20',
    name: '💻 Tech Startups & SaaS Scaleups',
    description: 'Technology companies with seed to Series B venture funding in Southeast Asia',
    objectType: 'COMPANIES',
    listType: 'STATIC',
    size: 73,
    createdDate: '2026-03-30',
    createdBy: { name: 'Pimchanok S.', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=faces' },
    lastUpdated: '2026-07-15 09:40',
    folder: 'Industry Segments'
  },
  {
    id: 'list-21',
    name: '🎪 Webinar: Modern CRM & AI Automation Leads',
    description: 'Attendees who stayed for > 40 minutes during live webinar on Zoom',
    objectType: 'CONTACTS',
    listType: 'STATIC',
    size: 215,
    createdDate: '2026-08-05',
    createdBy: { name: 'Somchai P.', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=faces' },
    lastUpdated: '2026-08-06 10:10',
    folder: 'Event Leads'
  },
  {
    id: 'list-22',
    name: '💰 Deals Closed Lost - Budget Constraints',
    description: 'Deals lost due to pricing/budget; candidate for discount campaign in Q4',
    objectType: 'DEALS',
    listType: 'ACTIVE',
    size: 31,
    createdDate: '2026-02-14',
    createdBy: { name: 'Thanakorn W.', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces' },
    lastUpdated: '2026-08-14 18:00',
    folder: 'Pipeline'
  },
  {
    id: 'list-23',
    name: '🌏 Multinational Regional APAC HQs',
    description: 'Global companies with regional headquarters located in Bangkok and Singapore',
    objectType: 'COMPANIES',
    listType: 'STATIC',
    size: 56,
    createdDate: '2026-04-20',
    createdBy: { name: 'Somchai P.', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=faces' },
    lastUpdated: '2026-07-22 14:50',
    folder: 'VIP Lists'
  },
  {
    id: 'list-24',
    name: '🎓 Education & Universities Contact List',
    description: 'Deans, procurement heads, and IT directors from private and public universities',
    objectType: 'CONTACTS',
    listType: 'STATIC',
    size: 83,
    createdDate: '2026-05-02',
    createdBy: { name: 'Pimchanok S.', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=faces' },
    lastUpdated: '2026-06-18 11:30',
    folder: 'Industry Segments'
  },
  {
    id: 'list-25',
    name: '🚀 Product Launch Beta Testers 2026',
    description: 'Early adopter customers enrolled in feature preview and feedback program',
    objectType: 'CONTACTS',
    listType: 'STATIC',
    size: 64,
    createdDate: '2026-07-10',
    createdBy: { name: 'Thanakorn W.', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces' },
    lastUpdated: '2026-08-19 12:00',
    folder: 'Nurturing'
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
