import { NextResponse } from 'next/server';
import { CRMItem, CRMBoard } from '@/types/crm';
import { TEAM_MEMBERS } from '@/data/mockData';
import fs from 'fs';
import path from 'path';

const STORAGE_FILE = path.join(process.cwd(), 'crm_database.json');

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { leadItem }: { leadItem: CRMItem } = body;

    if (!leadItem) {
      return NextResponse.json({ success: false, error: 'Missing leadItem' }, { status: 400 });
    }

    // Read stored boards
    let boards: Record<string, CRMBoard> = {};
    if (fs.existsSync(STORAGE_FILE)) {
      boards = JSON.parse(fs.readFileSync(STORAGE_FILE, 'utf-8'));
    }

    // 1. Create Deal in Deals Board
    const dealsBoard = boards['board-5030723273'];
    if (dealsBoard && dealsBoard.groups.length > 0) {
      const newDeal: CRMItem = {
        id: `deal-${Date.now()}`,
        name: leadItem.name,
        companyName: leadItem.companyName || leadItem.name,
        contactPerson: leadItem.contactPerson,
        contactEmail: leadItem.contactEmail,
        contactPhone: leadItem.contactPhone,
        dealValue: leadItem.dealValue || 500000,
        status: 'Working on it',
        priority: leadItem.priority || 'High',
        owner: leadItem.owner || TEAM_MEMBERS[0],
        expectedCloseDate: leadItem.expectedCloseDate,
        probability: 60,
        industry: leadItem.industry || 'Enterprise',
        leadSource: `Converted Lead (${leadItem.leadSource || 'Inbound'})`,
        notes: `Converted from lead on ${new Date().toLocaleDateString()}. Notes: ${leadItem.notes || ''}`,
        createdAt: new Date().toISOString().split('T')[0],
        activities: [
          {
            id: `act-${Date.now()}`,
            user: 'System CRM',
            avatar: '⚡',
            action: `Converted from Inbound Lead to Active Deal`,
            timestamp: 'Just now',
          }
        ]
      };
      dealsBoard.groups[0].items.unshift(newDeal);
    }

    // 2. Create Account in Accounts Board
    const accountsBoard = boards['board-accounts'];
    if (accountsBoard && accountsBoard.groups.length > 0) {
      const newAccount: CRMItem = {
        id: `acc-${Date.now()}`,
        name: leadItem.companyName || leadItem.name,
        companyName: leadItem.companyName || leadItem.name,
        contactPerson: leadItem.contactPerson,
        contactEmail: leadItem.contactEmail,
        contactPhone: leadItem.contactPhone,
        dealValue: leadItem.dealValue || 500000,
        status: 'Tier 2 Growth',
        priority: leadItem.priority || 'High',
        owner: leadItem.owner || TEAM_MEMBERS[0],
        expectedCloseDate: leadItem.expectedCloseDate,
        probability: 70,
        industry: leadItem.industry || 'General Industry',
        leadSource: leadItem.leadSource || 'Inbound Lead',
        notes: `Account created automatically upon converting lead "${leadItem.name}"`,
        createdAt: new Date().toISOString().split('T')[0],
        activities: []
      };
      accountsBoard.groups[0].items.unshift(newAccount);
    }

    // Save updated boards
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(boards, null, 2), 'utf-8');

    return NextResponse.json({
      success: true,
      message: `Lead "${leadItem.name}" converted successfully into an Active Deal and Company Account!`,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
