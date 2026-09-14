import { NextRequest, NextResponse } from 'next/server';
import { getLineConfig, saveLineConfig, maskSecret } from '@/lib/line/config';

export async function GET(request: NextRequest) {
  try {
    const config = getLineConfig();
    const host = request.headers.get('host') || 'vcrmx.online';
    const proto = request.headers.get('x-forwarded-proto') || 'https';
    const webhookUrl = `${proto}://${host}/api/webhooks/line`;

    return NextResponse.json({
      success: true,
      data: {
        channelId: config.channelId,
        channelSecretMasked: maskSecret(config.channelSecret),
        hasChannelSecret: Boolean(config.channelSecret),
        hasAccessToken: Boolean(config.channelAccessToken),
        botBasicId: config.botBasicId,
        autoReplyEnabled: config.autoReplyEnabled,
        welcomeMessage: config.welcomeMessage,
        webhookUrl,
        updatedAt: config.updatedAt,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch LINE settings' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      channelId,
      channelSecret,
      channelAccessToken,
      botBasicId,
      autoReplyEnabled,
      welcomeMessage,
    } = body;

    const updates: Record<string, any> = {};

    if (typeof channelId === 'string') updates.channelId = channelId.trim();
    if (typeof channelSecret === 'string' && channelSecret.trim()) {
      // If user passed literal dots / masked string without changing, keep current
      if (!channelSecret.includes('•') && !channelSecret.includes('****')) {
        updates.channelSecret = channelSecret.trim();
      }
    }
    if (typeof channelAccessToken === 'string' && channelAccessToken.trim()) {
      if (!channelAccessToken.includes('•') && !channelAccessToken.includes('****')) {
        updates.channelAccessToken = channelAccessToken.trim();
      }
    }
    if (typeof botBasicId === 'string') updates.botBasicId = botBasicId.trim();
    if (typeof autoReplyEnabled === 'boolean') updates.autoReplyEnabled = autoReplyEnabled;
    if (typeof welcomeMessage === 'string') updates.welcomeMessage = welcomeMessage.trim();

    const saved = saveLineConfig(updates);

    return NextResponse.json({
      success: true,
      message: 'LINE configuration updated successfully',
      data: {
        channelId: saved.channelId,
        channelSecretMasked: maskSecret(saved.channelSecret),
        hasChannelSecret: Boolean(saved.channelSecret),
        hasAccessToken: Boolean(saved.channelAccessToken),
        botBasicId: saved.botBasicId,
        autoReplyEnabled: saved.autoReplyEnabled,
        welcomeMessage: saved.welcomeMessage,
        updatedAt: saved.updatedAt,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to save LINE settings' },
      { status: 500 }
    );
  }
}
