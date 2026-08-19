export type StatusType = 
  | 'Qualified'
  | 'Working on it'
  | 'Proposal Sent'
  | 'Negotiation'
  | 'Closed Won'
  | 'Closed Lost'
  | 'Waiting'
  | 'New Lead'
  | 'Contacted'
  | 'Unqualified'
  | 'Active'
  | 'Tier 1 Enterprise'
  | 'Tier 2 Growth'
  | 'Decision Maker'
  | 'Influencer'
  | 'Gatekeeper';

export type PriorityType = 'Critical' | 'High' | 'Medium' | 'Low' | 'None';

export interface StatusConfig {
  label: string;
  color: string;
  bgColor: string;
}

export interface PriorityConfig {
  label: PriorityType;
  color: string;
  bgColor: string;
}

export interface ActivityItem {
  id: string;
  user: string;
  avatar: string;
  action: string;
  target?: string;
  timestamp: string;
  note?: string;
}

export interface CRMItem {
  id: string;
  name: string; // Deal Name / Lead Name / Company Name / Contact Name
  contactPerson: string;
  contactEmail: string;
  contactPhone?: string;
  dealValue: number;
  status: StatusType;
  priority: PriorityType;
  owner: {
    name: string;
    avatar: string;
    email: string;
  };
  expectedCloseDate: string;
  probability: number; // 0 - 100%
  notes?: string;
  leadSource?: string;
  industry?: string;
  companyName?: string;
  jobTitle?: string;
  stakeholderRole?: string;
  annualRevenue?: number;
  targetQuota?: number;
  actualClosed?: number;
  activities?: ActivityItem[];
  createdAt: string;
}

export interface CRMGroup {
  id: string;
  title: string;
  color: string;
  isCollapsed?: boolean;
  items: CRMItem[];
}

export interface CRMBoard {
  id: string;
  type: 'deals' | 'leads' | 'accounts' | 'contacts' | 'growth';
  name: string;
  description: string;
  badge: string;
  workspaceName: string;
  groups: CRMGroup[];
}

export type ActiveView = 'table' | 'kanban' | 'dashboard' | 'activity';
