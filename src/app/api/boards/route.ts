import { NextResponse } from 'next/server';
import { INITIAL_BOARDS } from '@/data/mockData';
import { CRMBoard } from '@/types/crm';
import fs from 'fs';
import path from 'path';

// In-memory / file-based storage cache for persistence across refreshes
const STORAGE_FILE = path.join(process.cwd(), 'crm_database.json');

function getStoredBoards(): Record<string, CRMBoard> {
  try {
    if (fs.existsSync(STORAGE_FILE)) {
      const data = fs.readFileSync(STORAGE_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error reading storage file, falling back to mock data', err);
  }
  return INITIAL_BOARDS;
}

function saveStoredBoards(boards: Record<string, CRMBoard>) {
  try {
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(boards, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing storage file', err);
  }
}

// GET /api/boards?boardId=xxx
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const boardId = searchParams.get('boardId');
  const boards = getStoredBoards();

  if (boardId) {
    const board = boards[boardId] || boards['board-5030723273'];
    return NextResponse.json({ success: true, board });
  }

  return NextResponse.json({ success: true, boards });
}

// POST /api/boards (Save / update board)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { boardId, boardData } = body;

    if (!boardId || !boardData) {
      return NextResponse.json({ success: false, error: 'Missing boardId or boardData' }, { status: 400 });
    }

    const boards = getStoredBoards();
    boards[boardId] = boardData;
    saveStoredBoards(boards);

    return NextResponse.json({ success: true, message: 'Board saved successfully', board: boardData });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
