/**
 * Media & Clipboard Upload Route Handler: /api/media/upload
 * Path: src/app/api/media/upload/route.ts
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';
    let fileName: string | null = null;
    let mimeType: string | null = null;
    let fileSize: number = 0;
    let width: number | undefined = undefined;
    let height: number | undefined = undefined;

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;

      fileName = (formData.get('fileName') as string) || file?.name || `upload_${Date.now()}.png`;
      mimeType = (formData.get('mimeType') as string) || file?.type || 'image/png';
      fileSize = formData.get('fileSize')
        ? Number(formData.get('fileSize'))
        : (file?.size || 0);

      const formWidth = formData.get('width');
      const formHeight = formData.get('height');
      if (formWidth) width = Number(formWidth);
      if (formHeight) height = Number(formHeight);
    } else {
      const body = await request.json().catch(() => ({}));
      fileName = body.fileName || `clipboard_paste_${Date.now()}.png`;
      mimeType = body.mimeType || 'image/png';
      fileSize = body.fileSize !== undefined ? Number(body.fileSize) : 0;
      if (body.width !== undefined) width = Number(body.width);
      if (body.height !== undefined) height = Number(body.height);
    }

    // Boundary check: Max attachment size is 150MB (T2.3.2)
    const MAX_FILE_SIZE = 150 * 1024 * 1024;
    if (fileSize > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'Payload Too Large: max attachment size is 150MB' },
        { status: 413 }
      );
    }

    // Default dimensions for images if not specified
    if (mimeType && mimeType.startsWith('image/')) {
      if (width === undefined) width = 1920;
      if (height === undefined) height = 1080;
    }

    const url = `https://storage.mock.local/uploads/${fileName}`;

    const responsePayload: any = {
      success: true,
      url,
      fileName,
      mimeType,
      fileSize,
    };

    if (width !== undefined) responsePayload.width = width;
    if (height !== undefined) responsePayload.height = height;

    return NextResponse.json(responsePayload, { status: 200 });
  } catch (error: any) {
    console.error('Error handling media upload:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process media upload' },
      { status: 500 }
    );
  }
}
