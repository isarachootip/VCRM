export type HubSpotObjectType = 'CONTACTS' | 'COMPANIES' | 'DEALS' | 'TICKETS';

export type HubSpotListType = 'ACTIVE' | 'STATIC';

export interface HubSpotFilterCondition {
  id: string;
  property: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'starts_with' | 'greater_than' | 'less_than' | 'is_known' | 'is_unknown';
  value: string;
}

export interface HubSpotFilterGroup {
  id: string;
  logic: 'AND' | 'OR';
  conditions: HubSpotFilterCondition[];
}

export interface HubSpotList {
  id: string;
  name: string;
  description: string;
  objectType: HubSpotObjectType;
  listType: HubSpotListType;
  size: number;
  createdDate: string;
  createdBy: {
    name: string;
    avatar: string;
  };
  lastUpdated: string;
  filterGroups?: HubSpotFilterGroup[];
  folder?: string;
}

export interface HubSpotContactRecord {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  jobTitle: string;
  company: {
    id: string;
    name: string;
    domain: string;
    industry: string;
  };
  leadStatus: 'NEW' | 'OPEN' | 'IN_PROGRESS' | 'OPEN_DEAL' | 'UNQUALIFIED' | 'CONNECTED';
  lifecycleStage: 'SUBSCRIBER' | 'LEAD' | 'MARKETING_QUALIFIED' | 'SALES_QUALIFIED' | 'OPPORTUNITY' | 'CUSTOMER' | 'EVANGELIST';
  owner: {
    name: string;
    avatar: string;
    email: string;
  };
  createDate: string;
  lastActivityDate: string;
  associatedDeals: {
    id: string;
    name: string;
    amount: number;
    stage: string;
    closeDate: string;
  }[];
  associatedTickets: {
    id: string;
    subject: string;
    status: string;
    priority: string;
  }[];
  notes: {
    id: string;
    author: string;
    avatar: string;
    content: string;
    createdAt: string;
  }[];
  activities: {
    id: string;
    type: 'note' | 'email' | 'call' | 'task' | 'meeting' | 'stage_change';
    title: string;
    description: string;
    timestamp: string;
    user: string;
  }[];
}

export interface HubSpotViewTab {
  id: string;
  name: string;
  objectType: HubSpotObjectType;
  isPinned?: boolean;
  filterCount?: number;
  conditions?: HubSpotFilterCondition[];
}
