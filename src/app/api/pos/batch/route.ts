import { NextRequest, NextResponse } from 'next/server';
import { processBatchUpload, PosError } from '@/lib/pos';

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';

    let result;

    if (contentType.includes('text/csv') || contentType.includes('application/csv')) {
      const csvText = await request.text();
      result = await processBatchUpload(csvText, {
        fileName: `pos_batch_${Date.now()}.csv`,
        uploadedBy: request.headers.get('x-uploaded-by') || 'supervisor',
        businessUnit: request.headers.get('x-business-unit') || 'Muji',
      });
    } else if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      const uploadedBy = (formData.get('uploadedBy') as string) || 'supervisor';
      const businessUnit = (formData.get('businessUnit') as string) || 'Muji';

      if (!file) {
        return NextResponse.json(
          { error: 'No file uploaded in form-data', code: 'NO_FILE_UPLOADED' },
          { status: 400 }
        );
      }

      const fileText = await file.text();
      const fileName = file.name || `pos_batch_${Date.now()}.csv`;
      result = await processBatchUpload(fileText, {
        fileName,
        uploadedBy,
        businessUnit,
      });
    } else {
      const rawText = await request.text();
      let body: any = null;
      try {
        body = JSON.parse(rawText);
      } catch {
        if (rawText && (rawText.includes(',') || rawText.trim().toLowerCase().startsWith('storebranchid'))) {
          result = await processBatchUpload(rawText);
        } else {
          return NextResponse.json(
            { error: 'Invalid or malformed payload', code: 'INVALID_PAYLOAD' },
            { status: 400 }
          );
        }
      }

      if (!result && body) {
        result = await processBatchUpload(body);
      }
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error('[API POST /api/pos/batch] Error:', error);
    const statusCode = error instanceof PosError ? error.statusCode : 500;
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Batch reconciliation failed',
        code: error.code || 'POS_BATCH_ERROR',
      },
      { status: statusCode }
    );
  }
}
