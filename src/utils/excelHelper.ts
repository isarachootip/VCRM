import * as XLSX from 'xlsx';
import { CRMBoard, CRMItem, CRMGroup } from '@/types/crm';

export function exportBoardToExcel(board: CRMBoard) {
  const rows: Record<string, any>[] = [];

  board.groups.forEach((group) => {
    group.items.forEach((item, index) => {
      rows.push({
        'Group / Phase': group.title,
        'Item / Deal Name': item.name,
        'Company / Account': item.companyName || '-',
        'Contact Person': item.contactPerson,
        'Contact Email': item.contactEmail,
        'Contact Phone': item.contactPhone || '-',
        'Status / Stage': item.status,
        'Priority': item.priority,
        'Value (THB)': item.dealValue,
        'Win Probability (%)': `${item.probability}%`,
        'Owner': item.owner.name,
        'Close Date': item.expectedCloseDate,
        'Lead Source': item.leadSource || '-',
        'Industry': item.industry || '-',
        'Notes': item.notes || '-',
        'Created At': item.createdAt,
      });
    });
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'CRM Data');

  const filename = `${board.name.replace(/[^a-zA-Z0-9ก-๙]/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(workbook, filename);
}

export async function parseExcelOrCsv(file: File): Promise<Partial<CRMItem>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json: any[] = XLSX.utils.sheet_to_json(worksheet);

        const parsedItems: Partial<CRMItem>[] = json.map((row, idx) => ({
          id: `imported-${Date.now()}-${idx}`,
          name: row['Item / Deal Name'] || row['Name'] || row['Deal Name'] || row['Company'] || 'Imported Lead',
          companyName: row['Company / Account'] || row['Company'] || '',
          contactPerson: row['Contact Person'] || row['Contact'] || 'Contact Person',
          contactEmail: row['Contact Email'] || row['Email'] || 'contact@domain.mock',
          contactPhone: row['Contact Phone'] || row['Phone'] || '',
          dealValue: Number(row['Value (THB)'] || row['Value'] || row['Amount'] || 100000),
          status: (row['Status / Stage'] || row['Status'] || 'New Lead') as any,
          priority: (row['Priority'] || 'Medium') as any,
          expectedCloseDate: row['Close Date'] || new Date().toISOString().split('T')[0],
          probability: Number(String(row['Win Probability (%)'] || row['Probability'] || '50').replace('%', '')) || 50,
          leadSource: row['Lead Source'] || 'Excel Import',
          industry: row['Industry'] || 'General',
          notes: row['Notes'] || 'Imported from spreadsheet',
          createdAt: new Date().toISOString().split('T')[0],
        }));

        resolve(parsedItems);
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
}
