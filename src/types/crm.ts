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


export type ActiveView = 'table' | 'kanban' | 'dashboard' | 'activity' | 'dispatch';

export interface ServiceMilestone {
  id: string;
  phaseName: string;
  status: 'Pending' | 'In Progress' | 'Completed';
  expectedDate: string;
  progressPercent: number;
  costEstimate?: number;
}

export interface ServiceMaterial {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
}

export interface ServiceProof {
  beforePhotoUrl?: string;
  afterPhotoUrl?: string;
  signatureUrl?: string;
  signerName?: string;
  signedAt?: string;
  gpsLocation?: {
    lat: number;
    lng: number;
    address: string;
  };
}

export interface CRMItem {
  id: string;
  name: string; // Deal Name / Lead Name / Service Job Title
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
    role?: string;
    skills?: string[];
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

  // Field Service extensions
  serviceType?: 'DELIVERY' | 'INSTALL' | 'RENOVATE' | 'MAINTAIN';
  serviceCategory?: string;
  scheduledTime?: string; // e.g. "09:00 - 11:30"
  timeSlotHour?: number; // 8 to 18
  durationHours?: number; // duration in hours
  address?: string;
  assignedTechnician?: string;
  technicianAvatar?: string;
  technicianRole?: string;
  technicianSkills?: string[];
  vehiclePlate?: string;
  slaDeadline?: string;
  milestones?: ServiceMilestone[];
  materials?: ServiceMaterial[];
  proof?: ServiceProof;
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
  type: 'deals' | 'leads' | 'accounts' | 'contacts' | 'growth' | 'delivery' | 'install' | 'renovate' | 'maintain';
  name: string;
  description: string;
  badge: string;
  workspaceName: string;
  groups: CRMGroup[];
}
