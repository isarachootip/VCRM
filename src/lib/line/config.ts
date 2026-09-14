import fs from 'fs';
import path from 'path';

export interface LineConfig {
  channelId: string;
  channelSecret: string;
  channelAccessToken: string;
  botBasicId?: string;
  autoReplyEnabled?: boolean;
  welcomeMessage?: string;
  updatedAt?: string;
}

const CONFIG_FILE_PATH = path.join(process.cwd(), 'line_config.json');

const DEFAULT_CONFIG: LineConfig = {
  channelId: process.env.LINE_CHANNEL_ID || '',
  channelSecret: process.env.LINE_CHANNEL_SECRET || '',
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
  botBasicId: process.env.LINE_BOT_BASIC_ID || '',
  autoReplyEnabled: true,
  welcomeMessage: 'สวัสดีครับ ยินดีต้อนรับสู่ VCRM Customer Service เจ้าหน้าที่จะรีบติดต่อกลับโดยเร็วที่สุดครับ',
  updatedAt: new Date().toISOString(),
};

/**
 * Get current LINE configuration
 */
export function getLineConfig(): LineConfig {
  try {
    if (fs.existsSync(CONFIG_FILE_PATH)) {
      const data = fs.readFileSync(CONFIG_FILE_PATH, 'utf-8');
      const parsed = JSON.parse(data);
      return {
        ...DEFAULT_CONFIG,
        ...parsed,
        channelId: parsed.channelId || process.env.LINE_CHANNEL_ID || '',
        channelSecret: parsed.channelSecret || process.env.LINE_CHANNEL_SECRET || '',
        channelAccessToken: parsed.channelAccessToken || process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
      };
    }
  } catch (error) {
    console.error('Failed to read LINE configuration file:', error);
  }

  return { ...DEFAULT_CONFIG };
}

/**
 * Save updated LINE configuration
 */
export function saveLineConfig(config: Partial<LineConfig>): LineConfig {
  const current = getLineConfig();
  const updated: LineConfig = {
    ...current,
    ...config,
    updatedAt: new Date().toISOString(),
  };

  try {
    fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(updated, null, 2), 'utf-8');
  } catch (error) {
    console.error('Failed to save LINE configuration file:', error);
    throw new Error('Could not persist LINE configuration');
  }

  return updated;
}

/**
 * Helper to mask secret strings for safe display in UI
 */
export function maskSecret(secret?: string): string {
  if (!secret) return '';
  if (secret.length <= 8) return '********';
  return secret.substring(0, 4) + '•'.repeat(Math.max(8, secret.length - 8)) + secret.substring(secret.length - 4);
}
