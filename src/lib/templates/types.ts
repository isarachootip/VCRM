/**
 * Template Message Manager Types
 * Path: src/lib/templates/types.ts
 */

export type TemplateCategory =
  | 'ORDER_CONFIRMATION'
  | 'PAYMENT'
  | 'SLIP_REQUEST'
  | 'TRACKING'
  | 'TRANSFER'
  | 'GREETING'
  | 'SURVEY'
  | 'GENERAL';

export interface MessageTemplate {
  id: string;
  name: string;
  category: TemplateCategory;
  content: string;
  variables: string[];
  businessUnit?: string;
  channel?: string;
  description?: string;
  isDefault?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PreviewTemplateParams {
  templateId?: string;
  templateText?: string;
  content?: string;
  caseId?: string;
  quotationId?: string;
  variables?: Record<string, string | number>;
}

export interface PreviewTemplateResult {
  success: boolean;
  renderedText: string;
  text: string;
  rawTemplate: string;
  missingVariables: string[];
  resolvedVariables: Record<string, any>;
}
