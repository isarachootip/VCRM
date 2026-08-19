import { CRMBoard, StatusConfig, PriorityConfig, StatusType, PriorityType } from '@/types/crm';

export const STATUS_CONFIGS: Record<StatusType, StatusConfig> = {
  'New Lead': { label: 'New Lead', color: '#ffffff', bgColor: '#579bfc' },
  'Qualified': { label: 'Qualified', color: '#ffffff', bgColor: '#0086c0' },
  'Working on it': { label: 'Working on it', color: '#ffffff', bgColor: '#fdab3d' },
  'Proposal Sent': { label: 'Proposal Sent', color: '#ffffff', bgColor: '#a25ddc' },
  'Negotiation': { label: 'Negotiation', color: '#ffffff', bgColor: '#784bd1' },
  'Closed Won': { label: 'Closed Won', color: '#ffffff', bgColor: '#00c875' },
  'Closed Lost': { label: 'Closed Lost', color: '#ffffff', bgColor: '#df2f4a' },
  'Waiting': { label: 'Waiting', color: '#ffffff', bgColor: '#c4c4c4' },
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

export const INITIAL_BOARD_DATA: CRMBoard = {
  id: 'board-5030723273',
  name: 'Deals & Sales Pipeline (Global)',
  description: 'Track and manage all inbound deals, enterprise leads, and sales stages.',
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
          notes: 'POC testing in progress. Telemetry API connector tested successfully.',
          createdAt: '2026-08-12',
          activities: [
            {
              id: 'act-4',
              user: 'Isara Chootip',
              avatar: '👨‍💼',
              action: 'Completed POC API deployment',
              timestamp: '3 days ago',
            }
          ]
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
          notes: 'Introductory call went well. Needs scope of penetration testing and compliance report.',
          createdAt: '2026-08-15',
          activities: []
        },
        {
          id: 'item-5',
          name: 'Central Retail Omnichannel POS',
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
          notes: 'Contract signed! Initial 50% invoice paid. Kickoff meeting done.',
          createdAt: '2026-07-15',
          activities: [
            {
              id: 'act-5',
              user: 'Isara Chootip',
              avatar: '👨‍💼',
              action: 'Deal Won! Signed contract received.',
              timestamp: 'Aug 01, 2026',
            }
          ]
        },
        {
          id: 'item-7',
          name: 'PTT Energy AI Predictive Maintenance',
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
          notes: 'Annual license agreement signed. Kickoff scheduled for September 1st.',
          createdAt: '2026-07-01',
          activities: []
        }
      ]
    }
  ]
};
