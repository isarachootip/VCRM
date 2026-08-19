import { CRMBoard, StatusConfig, PriorityConfig, StatusType, PriorityType } from '@/types/crm';

export const STATUS_CONFIGS: Record<string, StatusConfig> = {
  'New Lead': { label: 'New Lead', color: '#ffffff', bgColor: '#579bfc' },
  'Contacted': { label: 'Contacted', color: '#ffffff', bgColor: '#0086c0' },
  'Qualified': { label: 'Qualified', color: '#ffffff', bgColor: '#00c875' },
  'Unqualified': { label: 'Unqualified', color: '#ffffff', bgColor: '#df2f4a' },
  'Working on it': { label: 'Working on it', color: '#ffffff', bgColor: '#fdab3d' },
  'Proposal Sent': { label: 'Proposal Sent', color: '#ffffff', bgColor: '#a25ddc' },
  'Negotiation': { label: 'Negotiation', color: '#ffffff', bgColor: '#784bd1' },
  'Closed Won': { label: 'Closed Won', color: '#ffffff', bgColor: '#00c875' },
  'Closed Lost': { label: 'Closed Lost', color: '#ffffff', bgColor: '#df2f4a' },
  'Waiting': { label: 'Waiting', color: '#ffffff', bgColor: '#c4c4c4' },
  'Active': { label: 'Active', color: '#ffffff', bgColor: '#00c875' },
  'Tier 1 Enterprise': { label: 'Tier 1 Enterprise', color: '#ffffff', bgColor: '#401694' },
  'Tier 2 Growth': { label: 'Tier 2 Growth', color: '#ffffff', bgColor: '#579bfc' },
  'Decision Maker': { label: 'Decision Maker', color: '#ffffff', bgColor: '#a25ddc' },
  'Influencer': { label: 'Influencer', color: '#ffffff', bgColor: '#fdab3d' },
  'Gatekeeper': { label: 'Gatekeeper', color: '#ffffff', bgColor: '#676879' },
};

export const PRIORITY_CONFIGS: Record<PriorityType, PriorityConfig> = {
  'Critical': { label: 'Critical', color: '#ffffff', bgColor: '#333333' },
  'High': { label: 'High', color: '#ffffff', bgColor: '#401694' },
  'Medium': { label: 'Medium', color: '#ffffff', bgColor: '#5559df' },
  'Low': { label: 'Low', color: '#ffffff', bgColor: '#579bfc' },
  'None': { label: 'None', color: '#676879', bgColor: '#c4c4c4' },
};

export const TEAM_MEMBERS = [
  { name: 'Isara Chootip', avatar: '👨‍💼', email: 'isara@company.com' },
  { name: 'Somchai S.', avatar: '🧑‍💻', email: 'somchai@company.com' },
  { name: 'Kanya P.', avatar: '👩‍💼', email: 'kanya@company.com' },
  { name: 'Anan T.', avatar: '👨‍🔬', email: 'anan@company.com' },
];

export const INITIAL_BOARDS: Record<string, CRMBoard> = {
  // 1. Deals & Sales Pipeline Board
  'board-5030723273': {
    id: 'board-5030723273',
    type: 'deals',
    name: 'Deals & Sales Pipeline (Global)',
    description: 'Track B2B pipeline, proposal milestones, deal values, probabilities, and closing forecasts for Q3-Q4 2026.',
    badge: 'Enterprise CRM',
    workspaceName: "Isarachootip's Team Global",
    groups: [
      {
        id: 'grp-hot-deals',
        title: '🔥 Hot Deals & Active Proposals',
        color: '#579bfc',
        isCollapsed: false,
        items: [
          {
            id: 'item-1',
            name: 'Siam Paragon Enterprise Cloud Migration',
            companyName: 'Siam Paragon Group',
            contactPerson: 'Thanaporn Siripon',
            contactEmail: 'thanaporn@siamparagon.co.th',
            contactPhone: '081-234-5678',
            dealValue: 1250000,
            status: 'Proposal Sent',
            priority: 'Critical',
            owner: TEAM_MEMBERS[0],
            expectedCloseDate: '2026-09-15',
            probability: 75,
            leadSource: 'Enterprise Inbound',
            industry: 'Retail / Commercial',
            notes: 'Submitted RFP proposal for cloud ERP integration. Meeting scheduled for next Tuesday.',
            createdAt: '2026-08-10',
            activities: [
              {
                id: 'act-1',
                user: 'Isara Chootip',
                avatar: '👨‍💼',
                action: 'Sent revised quotation with 3-year SLA tier',
                timestamp: '2 hours ago',
              },
              {
                id: 'act-2',
                user: 'Thanaporn Siripon',
                avatar: '👩',
                action: 'Requested technical architecture review call',
                timestamp: 'Yesterday',
              }
            ]
          },
          {
            id: 'item-2',
            name: 'Bangkok Tech Park AI Automation Platform',
            companyName: 'BKK Tech Park Ltd.',
            contactPerson: 'Kittisak Wongsuwan',
            contactEmail: 'kittisak@bkktechpark.io',
            contactPhone: '089-876-5432',
            dealValue: 850000,
            status: 'Negotiation',
            priority: 'High',
            owner: TEAM_MEMBERS[2],
            expectedCloseDate: '2026-08-30',
            probability: 90,
            leadSource: 'Webinar Lead',
            industry: 'Technology & Smart City',
            notes: 'Final contract terms negotiation. Legal team is reviewing DPA.',
            createdAt: '2026-08-05',
            activities: [
              {
                id: 'act-3',
                user: 'Kanya P.',
                avatar: '👩‍💼',
                action: 'Moved status from Proposal Sent to Negotiation',
                timestamp: 'Aug 17, 2026',
              }
            ]
          },
          {
            id: 'item-3',
            name: 'SCG Logistics Tracking Integration',
            companyName: 'SCG Logistics',
            contactPerson: 'Prasert Ratanakul',
            contactEmail: 'prasert@scglogistics.mock',
            contactPhone: '082-345-6789',
            dealValue: 2400000,
            status: 'Working on it',
            priority: 'Critical',
            owner: TEAM_MEMBERS[0],
            expectedCloseDate: '2026-10-01',
            probability: 60,
            leadSource: 'Partner Referral',
            industry: 'Logistics & Supply Chain',
            notes: 'POC testing in progress. Telemetry API connector tested successfully.',
            createdAt: '2026-08-12',
            activities: []
          }
        ]
      },
      {
        id: 'grp-qualified',
        title: '📞 Discovery & Qualified Leads',
        color: '#fdab3d',
        isCollapsed: false,
        items: [
          {
            id: 'item-4',
            name: 'Kasikorn Digital Labs Security Audit',
            companyName: 'Kasikorn Digital Labs',
            contactPerson: 'Supaporn Techathorn',
            contactEmail: 'supaporn@kdigital.mock',
            contactPhone: '086-555-1234',
            dealValue: 450000,
            status: 'Qualified',
            priority: 'Medium',
            owner: TEAM_MEMBERS[1],
            expectedCloseDate: '2026-09-30',
            probability: 40,
            leadSource: 'Google Search Ads',
            industry: 'Banking & FinTech',
            notes: 'Introductory call went well. Needs scope of penetration testing.',
            createdAt: '2026-08-15',
            activities: []
          },
          {
            id: 'item-5',
            name: 'Central Retail Omnichannel POS',
            companyName: 'Central Retail Group',
            contactPerson: 'Waraporn Chokdee',
            contactEmail: 'waraporn@centralretail.mock',
            contactPhone: '084-999-8877',
            dealValue: 1800000,
            status: 'New Lead',
            priority: 'High',
            owner: TEAM_MEMBERS[3],
            expectedCloseDate: '2026-11-15',
            probability: 20,
            leadSource: 'Expo 2026 Booth',
            industry: 'Retail Chain',
            notes: 'Left business card at Tech Expo booth. Wants product demo for 50 retail branches.',
            createdAt: '2026-08-18',
            activities: []
          }
        ]
      },
      {
        id: 'grp-closed-won',
        title: '✅ Closed Won (Q3 2026)',
        color: '#00c875',
        isCollapsed: false,
        items: [
          {
            id: 'item-6',
            name: 'True Digital Park Smart Building Dashboard',
            companyName: 'True Digital Park',
            contactPerson: 'Natdanai Pongpan',
            contactEmail: 'natdanai@truedigital.mock',
            contactPhone: '085-111-2233',
            dealValue: 980000,
            status: 'Closed Won',
            priority: 'High',
            owner: TEAM_MEMBERS[0],
            expectedCloseDate: '2026-08-01',
            probability: 100,
            leadSource: 'Existing Client',
            industry: 'Real Estate / Tech Hub',
            notes: 'Contract signed! Initial 50% invoice paid. Kickoff meeting done.',
            createdAt: '2026-07-15',
            activities: []
          },
          {
            id: 'item-7',
            name: 'PTT Energy AI Predictive Maintenance',
            companyName: 'PTT Energy Public Co.',
            contactPerson: 'Somkiat Lertvit',
            contactEmail: 'somkiat@ptt.mock',
            contactPhone: '088-333-4455',
            dealValue: 3100000,
            status: 'Closed Won',
            priority: 'Critical',
            owner: TEAM_MEMBERS[2],
            expectedCloseDate: '2026-08-10',
            probability: 100,
            leadSource: 'Executive Network',
            industry: 'Energy & Utilities',
            notes: 'Annual license agreement signed. Kickoff scheduled for September 1st.',
            createdAt: '2026-07-01',
            activities: []
          }
        ]
      }
    ]
  },

  // 2. Inbound Leads Management Board
  'board-leads': {
    id: 'board-leads',
    type: 'leads',
    name: 'Inbound Leads 2026 (Qualification & Scoring)',
    description: 'Capture, score, and qualify incoming website inquiries, ads leads, and partner referrals before conversion.',
    badge: 'Lead Funnel',
    workspaceName: "Isarachootip's Team Global",
    groups: [
      {
        id: 'grp-new-inbound',
        title: '📥 New Inbound Inquiries (Uncontacted)',
        color: '#579bfc',
        isCollapsed: false,
        items: [
          {
            id: 'lead-1',
            name: 'Ananda Development Smart Condo IoT',
            companyName: 'Ananda Development',
            contactPerson: 'Chanon Ruangrit',
            contactEmail: 'chanon@ananda.mock',
            contactPhone: '081-998-1122',
            dealValue: 950000,
            status: 'New Lead',
            priority: 'High',
            owner: TEAM_MEMBERS[1],
            expectedCloseDate: '2026-10-15',
            probability: 30,
            leadSource: 'Website Form',
            industry: 'Property Development',
            notes: 'Looking for smart condo access control and resident app API.',
            createdAt: '2026-08-19',
            activities: []
          },
          {
            id: 'lead-2',
            name: 'Gulf Energy Microgrid Solar Monitoring',
            companyName: 'Gulf Energy Development',
            contactPerson: 'Nuttapol Prasert',
            contactEmail: 'nuttapol@gulf.mock',
            contactPhone: '089-444-5566',
            dealValue: 1600000,
            status: 'New Lead',
            priority: 'Critical',
            owner: TEAM_MEMBERS[0],
            expectedCloseDate: '2026-11-01',
            probability: 25,
            leadSource: 'LinkedIn Campaign',
            industry: 'Clean Energy',
            notes: 'Requires industrial IoT telemetry dashboard.',
            createdAt: '2026-08-18',
            activities: []
          }
        ]
      },
      {
        id: 'grp-contacted-leads',
        title: '📞 Contacted & Under Evaluation',
        color: '#fdab3d',
        isCollapsed: false,
        items: [
          {
            id: 'lead-3',
            name: 'CP All Supply Chain Optimization',
            companyName: 'CP All Public Co.',
            contactPerson: 'Vichai Tangsiri',
            contactEmail: 'vichai@cpall.mock',
            contactPhone: '082-123-9988',
            dealValue: 2800000,
            status: 'Contacted',
            priority: 'Critical',
            owner: TEAM_MEMBERS[2],
            expectedCloseDate: '2026-10-30',
            probability: 50,
            leadSource: 'Partner Referral',
            industry: 'Retail & Convenience',
            notes: 'Discovery call held on Aug 16. Demo presentation scheduled for next Thursday.',
            createdAt: '2026-08-14',
            activities: []
          },
          {
            id: 'lead-4',
            name: 'BDMS Telehealth Video Consultation System',
            companyName: 'Bangkok Dusit Medical Services',
            contactPerson: 'Dr. Pattama Kulap',
            contactEmail: 'pattama@bdms.mock',
            contactPhone: '083-777-8899',
            dealValue: 1200000,
            status: 'Qualified',
            priority: 'High',
            owner: TEAM_MEMBERS[0],
            expectedCloseDate: '2026-09-20',
            probability: 70,
            leadSource: 'Healthcare Tech Summit',
            industry: 'Hospital & Healthcare',
            notes: 'Passed technical security check. Ready to convert to Active Deal.',
            createdAt: '2026-08-10',
            activities: []
          }
        ]
      }
    ]
  },

  // 3. Key Enterprise Accounts
  'board-accounts': {
    id: 'board-accounts',
    type: 'accounts',
    name: 'Key Enterprise Accounts (Organizations)',
    description: 'Master directory of strategic client companies, annual contracts, tiers, and account health.',
    badge: 'Account 360°',
    workspaceName: "Isarachootip's Team Global",
    groups: [
      {
        id: 'grp-tier1-accounts',
        title: '⭐ Strategic Tier-1 Enterprise Accounts',
        color: '#784bd1',
        isCollapsed: false,
        items: [
          {
            id: 'acc-1',
            name: 'SCG (Siam Cement Group)',
            companyName: 'Siam Cement Group PCL',
            contactPerson: 'Prasert Ratanakul (VP Supply Chain)',
            contactEmail: 'prasert@scg.mock',
            contactPhone: '02-586-3333',
            dealValue: 4500000,
            annualRevenue: 520000000,
            status: 'Tier 1 Enterprise',
            priority: 'Critical',
            owner: TEAM_MEMBERS[0],
            expectedCloseDate: '2026-12-31',
            probability: 100,
            industry: 'Industrial & Building Materials',
            leadSource: 'Direct Enterprise',
            notes: 'Multiple subsidiaries actively using our software across 4 business units.',
            createdAt: '2025-01-10',
            activities: []
          },
          {
            id: 'acc-2',
            name: 'PTT Public Company Limited',
            companyName: 'PTT Group',
            contactPerson: 'Somkiat Lertvit (Head of Digital)',
            contactEmail: 'somkiat@ptt.mock',
            contactPhone: '02-537-2000',
            dealValue: 6200000,
            annualRevenue: 2800000000,
            status: 'Tier 1 Enterprise',
            priority: 'Critical',
            owner: TEAM_MEMBERS[2],
            expectedCloseDate: '2026-12-31',
            probability: 100,
            industry: 'Oil, Gas & Energy',
            leadSource: 'Executive Network',
            notes: 'High expansion opportunity in ESG & Renewable energy divisions.',
            createdAt: '2025-03-15',
            activities: []
          }
        ]
      },
      {
        id: 'grp-tier2-accounts',
        title: '💼 Tier-2 Growth Accounts',
        color: '#579bfc',
        isCollapsed: false,
        items: [
          {
            id: 'acc-3',
            name: 'Siam Paragon Group',
            companyName: 'Siam Piwat Co., Ltd.',
            contactPerson: 'Thanaporn Siripon',
            contactEmail: 'thanaporn@siamparagon.co.th',
            contactPhone: '02-610-8000',
            dealValue: 1850000,
            annualRevenue: 150000000,
            status: 'Tier 2 Growth',
            priority: 'High',
            owner: TEAM_MEMBERS[0],
            expectedCloseDate: '2026-12-31',
            probability: 80,
            industry: 'Retail & Luxury Mall',
            leadSource: 'Inbound',
            notes: 'Currently expanding omnichannel loyalty platform.',
            createdAt: '2026-02-01',
            activities: []
          }
        ]
      }
    ]
  },

  // 4. Contacts Directory
  'board-contacts': {
    id: 'board-contacts',
    type: 'contacts',
    name: 'Contacts & Stakeholders Directory',
    description: 'Decision makers, procurement managers, and technical evaluators across key client organizations.',
    badge: 'Stakeholders',
    workspaceName: "Isarachootip's Team Global",
    groups: [
      {
        id: 'grp-decision-makers',
        title: '👑 C-Level & Key Decision Makers',
        color: '#a25ddc',
        isCollapsed: false,
        items: [
          {
            id: 'cnt-1',
            name: 'Thanaporn Siripon',
            jobTitle: 'VP of Digital Transformation',
            companyName: 'Siam Piwat / Siam Paragon',
            contactPerson: 'Thanaporn Siripon',
            contactEmail: 'thanaporn@siamparagon.co.th',
            contactPhone: '081-234-5678',
            dealValue: 1250000,
            status: 'Decision Maker',
            priority: 'Critical',
            owner: TEAM_MEMBERS[0],
            expectedCloseDate: '2026-09-15',
            probability: 90,
            stakeholderRole: 'Economic Buyer',
            notes: 'Approves budgets above 1M THB directly. Prefers bi-weekly status reports.',
            createdAt: '2026-08-10',
            activities: []
          },
          {
            id: 'cnt-2',
            name: 'Somkiat Lertvit',
            jobTitle: 'Executive VP Innovation',
            companyName: 'PTT Group',
            contactPerson: 'Somkiat Lertvit',
            contactEmail: 'somkiat@ptt.mock',
            contactPhone: '088-333-4455',
            dealValue: 3100000,
            status: 'Decision Maker',
            priority: 'Critical',
            owner: TEAM_MEMBERS[2],
            expectedCloseDate: '2026-08-10',
            probability: 100,
            stakeholderRole: 'Sponsor & Final Signer',
            notes: 'Primary sponsor for company-wide AI adoption.',
            createdAt: '2026-07-01',
            activities: []
          }
        ]
      },
      {
        id: 'grp-evaluators',
        title: '🛠️ Technical Champions & Evaluators',
        color: '#0086c0',
        isCollapsed: false,
        items: [
          {
            id: 'cnt-3',
            name: 'Kittisak Wongsuwan',
            jobTitle: 'Lead Software Architect',
            companyName: 'BKK Tech Park Ltd.',
            contactPerson: 'Kittisak Wongsuwan',
            contactEmail: 'kittisak@bkktechpark.io',
            contactPhone: '089-876-5432',
            dealValue: 850000,
            status: 'Influencer',
            priority: 'High',
            owner: TEAM_MEMBERS[2],
            expectedCloseDate: '2026-08-30',
            probability: 90,
            stakeholderRole: 'Technical Champion',
            notes: 'Loved our API documentation and webhook latency benchmarks.',
            createdAt: '2026-08-05',
            activities: []
          }
        ]
      }
    ]
  },

  // 5. Sales Forecast & Targets Board
  'board-growth': {
    id: 'board-growth',
    type: 'growth',
    name: 'Sales Forecast & Rep Targets (Q3-Q4 2026)',
    description: 'Quarterly quota tracking, individual sales rep performance, and weighted revenue forecasting.',
    badge: 'Executive Plan',
    workspaceName: "Isarachootip's Team Global",
    groups: [
      {
        id: 'grp-q3-targets',
        title: '🎯 Q3 2026 Sales Rep Quotas & Targets',
        color: '#00c875',
        isCollapsed: false,
        items: [
          {
            id: 'rep-1',
            name: 'Isara Chootip (Enterprise Team Lead)',
            contactPerson: 'Quota: ฿5,000,000',
            contactEmail: 'isara@company.com',
            dealValue: 4630000,
            targetQuota: 5000000,
            actualClosed: 4630000,
            status: 'Active',
            priority: 'Critical',
            owner: TEAM_MEMBERS[0],
            expectedCloseDate: '2026-09-30',
            probability: 93,
            notes: 'On track to exceed 100% quota with SCG + Siam Paragon deals.',
            createdAt: '2026-07-01',
            activities: []
          },
          {
            id: 'rep-2',
            name: 'Kanya P. (Senior Sales Executive)',
            contactPerson: 'Quota: ฿4,000,000',
            contactEmail: 'kanya@company.com',
            dealValue: 3950000,
            targetQuota: 4000000,
            actualClosed: 3950000,
            status: 'Active',
            priority: 'High',
            owner: TEAM_MEMBERS[2],
            expectedCloseDate: '2026-09-30',
            probability: 98,
            notes: 'Closed PTT Energy deal (฿3.1M). Close to reaching target.',
            createdAt: '2026-07-01',
            activities: []
          },
          {
            id: 'rep-3',
            name: 'Somchai S. (Mid-Market Executive)',
            contactPerson: 'Quota: ฿2,500,000',
            contactEmail: 'somchai@company.com',
            dealValue: 1450000,
            targetQuota: 2500000,
            actualClosed: 1450000,
            status: 'Working on it',
            priority: 'Medium',
            owner: TEAM_MEMBERS[1],
            expectedCloseDate: '2026-09-30',
            probability: 58,
            notes: 'Focusing on Kasikorn Labs and BDMS pipeline acceleration.',
            createdAt: '2026-07-01',
            activities: []
          }
        ]
      }
    ]
  }
};

export const INITIAL_BOARD_DATA: CRMBoard = INITIAL_BOARDS['board-5030723273'];
