'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export type Language = string; // Extensible to other languages in the future

export interface LanguageInfo {
  code: string;
  label: string;
}

// Extensible list of supported languages - Now supporting English, Thai, Chinese, and Japanese
export const SUPPORTED_LANGUAGES: LanguageInfo[] = [
  { code: 'en', label: 'English (EN)' },
  { code: 'th', label: 'ไทย (TH)' },
  { code: 'zh', label: '中文 (ZH)' },
  { code: 'ja', label: '日本語 (JA)' }
];

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const translations: Record<string, Record<string, string>> = {
  en: {
    // Nav tabs
    'dashboard': 'Dashboard (Customer Segments & Sales)',
    'dashboard_overview': 'Executive CRM & Sales Dashboard',
    'total_customers': 'Total Customers',
    'customers_by_category': 'Customers by Category (Donut Chart)',
    'customers_mtd': 'New Customers (MTD)',
    'customers_ytd': 'New Customers (YTD)',
    'total_revenue': 'Total Revenue',
    'revenue_mtd': 'Revenue (MTD)',
    'revenue_ytd': 'Revenue (YTD)',
    'total_orders': 'Total Orders',
    'orders_mtd': 'Orders (MTD)',
    'orders_ytd': 'Orders (YTD)',
    'avg_order_value': 'Average Order Value (AOV)',
    'lists_segments': 'Lists & Segments',
    'contacts': 'Contacts',
    'sales_pipeline': 'Sales Pipeline',
    'companies': 'Companies',
    'reports': 'Reports',
    'search_vcrm': 'Search VCRM (Ctrl+K)...',
    'create': 'Create',
    'portal_id': 'Portal ID',
    
    // Sidebar
    'crm_sales': 'CRM & Sales',
    'field_operations': 'Field Operations ⚡',
    'workspace_settings': 'Workspace Settings',
    'enterprise_pro': 'Enterprise Pro',
    'search_crm': 'Search CRM...',
    'home': 'Home',
    'workspaces': 'Workspaces',
    'notifications': 'Notifications',
    'inbox_updates': 'Inbox / Updates',
    'favorites': 'Favorites',
    
    // Board Names
    'board-5030723273': 'Deals & Sales Pipeline',
    'board-leads': 'Inbound Leads 2026',
    'board-accounts': 'Key Enterprise Accounts',
    'board-contacts': 'Contacts & Stakeholders',
    'board-growth': 'Sales Forecast & Targets',
    'board-delivery': '🚚 Delivery',
    'board-install': '🛠️ Install',
    'board-renovate': '🏗️ Renovate',
    'board-maintain': '⚡ Maintenance',
    
    // Board Views & Toolbar
    'view_table': 'Table',
    'view_kanban': 'Kanban',
    'view_dispatch': 'Dispatch Board',
    'view_dashboard': 'Dashboard',
    'view_activity': 'Activity Log',
    'new_item': 'New Item',
    'export_excel': 'Export to Excel',
    'import_excel': 'Import Excel',
    'search_items': 'Search items...',
    'filter_by_owner': 'Filter by Owner',
    'all_owners': 'All Owners',
    
    // Table Columns
    'col_item_name': 'Item Name',
    'col_status': 'Status',
    'col_priority': 'Priority',
    'col_owner': 'Owner',
    'col_expected_close': 'Expected Close',
    'col_notes': 'Notes',
    'col_contact_person': 'Contact Person',
    'col_contact_email': 'Contact Email',
    'col_deal_value': 'Deal Value',
    'col_probability': 'Probability',
    'col_created_at': 'Created At',
    'col_address': 'Address',
    'col_phone': 'Phone',
    'col_action': 'Action',
    
    // Additional Columns
    'Lead / Opportunity': 'Lead / Opportunity',
    'Company / Account': 'Company / Account',
    'Contact Name': 'Contact Name',
    'Sales Representative': 'Sales Representative',
    'Deal / Account': 'Deal / Account',
    'Job Title / Role': 'Job Title / Role',
    'Industry': 'Industry',
    'Account Tier': 'Account Tier',
    'Role Type': 'Role Type',
    'Stage / Status': 'Stage / Status',
    'Value': 'Value',
    'Primary Contact': 'Primary Contact',
    'Organization / Company': 'Organization / Company',
    'Close Date': 'Close Date',
    'Achievement %': 'Achievement %',
    
    // Table Buttons / UI
    'add_item': 'Add Item',
    'add_group': 'Add Group',
    'convert': 'Convert',
    'convert_lead': 'Convert Lead to Deal',
    'delete': 'Delete',
    'sum': 'Sum',
    'items': 'items',
    'Average': 'Average',
    'Add New Group': 'Add New Group',
    'Cancel': 'Cancel',
    'Filter': 'Filter',
    'Sort': 'Sort',
    
    // Toast notifications
    'toast_updated_success': 'Updated record successfully',
    'toast_status_updated': 'Status updated to',
    'toast_item_deleted': 'Item deleted',
    'toast_added': 'Added',
    'toast_added_group': 'Added group',
    'toast_converted': 'Converted',
    'toast_to_deals': 'to Deals Pipeline!',
    'toast_imported': 'Successfully imported',
    'toast_exported': 'Exported',
    'toast_to_excel': 'to Excel!',
    
    // Drawer & Modals
    'record_details': 'Record Details',
    'contact_info': 'Contact Information',
    'close': 'Close',
    'save': 'Save',
    'lead_converted_msg': 'Converted from Lead on',
    'import_title': 'Import from Excel / CSV',
    'import_desc': 'Supports standard columns: Name, Contact, Email, Phone, Value, Status',
    'select_file': 'Click or Drag & Drop Excel (.xlsx) / CSV file here',
    'download_template': 'Download Template',
    'upload_process': 'Upload & Process',
    'target_group': 'Target Group',
    'no_file_selected': 'No file selected',
    'Preview Data': 'Preview Data',
    'Ready to import': 'Ready to import',
    'and_more_rows': 'and more rows...',
    
    // Statuses
    'Working on it': 'Working on it',
    'Proposal Sent': 'Proposal Sent',
    'Negotiation': 'Negotiation',
    'Closed Won': 'Closed Won',
    'Qualified': 'Qualified',
    'New Lead': 'New Lead',
    'Contacted': 'Contacted',
    'Unqualified': 'Unqualified',
    'Pending': 'Pending',
    'Scheduled': 'Scheduled',
    'In Progress': 'In Progress',
    'Completed': 'Completed',
    
    // Priorities
    'Low': 'Low',
    'Medium': 'Medium',
    'High': 'High',
    'Critical': 'Critical',
    
    // Dashboard View
    'pipeline_analytics': 'Pipeline Analytics',
    'total_pipeline_value': 'Total Pipeline Value',
    'win_rate': 'Win Rate',
    'avg_deal_value': 'Average Deal Value',
    'deals_by_status': 'Deals by Status',
    'deals_value_by_stage': 'Deals Value by Stage',
    'team_contribution': 'Team Contribution',
    'active_deals_count': 'Active Deals Count',
    
    // HubSpot lists & contacts
    'all_lists': 'All Lists',
    'search_lists': 'Search lists...',
    'list_name': 'List Name',
    'records': 'Records',
    'created': 'Created',
    'last_updated': 'Last Updated',
    'active_contacts': 'Active Contacts',
    'contact_detail': 'Contact Detail',
    'timeline': 'Timeline',
    'associations': 'Associations',
    
    // Board Header custom actions (renamed to avoid status collision)
    'Automate': 'Automate',
    'Share': 'Share',
    'action_new_lead': 'New Lead',
    'action_new_account': 'New Account',
    'action_new_contact': 'New Contact',
    'action_new_deal': 'New Deal',

    // Dispatch Board Translations
    'GPS Live Dispatch': 'GPS Live Dispatch',
    'Active Field Units': 'Active Field Units',
    'FIELD TECHNICIAN & VEHICLE': 'FIELD TECHNICIAN & VEHICLE',
    'Skills / Vehicle': 'Skills / Vehicle',
    'available': 'available',
    'busy': 'busy',
    'transit': 'transit',
    'Ticket ID': 'Ticket ID',
    'Customer Contact': 'Customer Contact',
    'Scheduled Appointment': 'Scheduled Appointment',
    'Assigned': 'Assigned',
    'Proof of Work': 'Proof of Work / Delivery (Photos & Signature)',
    'Before Work': '📸 Before Work',
    'After Work': '📸 After Work',
    'E-Signature': '✍️ E-Signature',
    'Verified E-Sign': '✓ Verified E-Sign',
    'Photo Captured': 'Photo Captured',
    'Project Milestones': 'Project Phase Milestones',
    'Spare Parts Used': 'Spare Parts & Materials Used',
    'Item / Part Name': 'Item / Part Name',
    'Qty': 'Qty',
    'Unit Price': 'Unit Price',
    'Total': 'Total',
    'Open Google Maps': 'Open Google Maps Live Route',
    'Approve & Close Job': 'Approve & Close Job',
    'All Services': 'All Services',
    'Move': 'Move',
    'No deals in this stage': 'No deals in this stage',

    // Additional Dashboard keys
    'Won vs Total Opportunities': 'Won vs Total Opportunities',
    'Across all stages': 'Across all stages',
    'Active Deals Managed': 'Active Deals Managed',
    'Quota on track': 'Quota on track',
    'Top High-Value Deals': 'Top High-Value Deals in Pipeline',

    // Activity Log
    'Board Activity & Audit Trail': 'Board Activity & Audit Trail',
    'logs_recorded': 'Historical logs recorded',
    'No activity logged yet.': 'No activity logged yet.',

    // Item Drawer
    'Record': 'Record',
    'Value / Quota': 'Value / Quota',
    'Updates & Notes': 'Updates & Notes',
    'Details & Strategic Parameters': 'Details & Strategic Parameters',
    'update_placeholder': 'Write an update, meeting note, or mention a teammate with @...',
    'AI Enhance': 'AI Enhance',
    'Update': 'Update',
    'Timeline Activity': 'Timeline Activity',
    'No updates logged yet. Post the first update above!': 'No updates logged yet. Post the first update above!',
    'Company & Contact Information': 'Company & Contact Information',
    'Company / Organization': 'Company / Organization',
    'Lead Source': 'Lead Source',
    'Commercial Parameters & Forecast': 'Commercial Parameters & Forecast',
    'Target Close Date': 'Target Close Date',
    'Internal Strategic Notes': 'Internal Strategic Notes',

    // HubSpot Contacts Saved Views
    'All Contacts': 'All Contacts',
    'My Contacts': 'My Contacts',
    'Unassigned Contacts': 'Unassigned Contacts',
    'MQL Contacts': 'MQL Contacts',
    'Closed Customers': 'Closed Customers',
    'My lists': 'My Lists',
    'search_contacts': 'Search contacts, company, email...',
    'Log Note or Quick Update': 'Log Note or Quick Update'
  },
  th: {
    // Nav tabs
    'dashboard': 'แดชบอร์ด (Segment ลูกค้า & ยอดขาย)',
    'dashboard_overview': 'แดชบอร์ดภาพรวมการบริหารลูกค้าและยอดขาย',
    'total_customers': 'จำนวนลูกค้าทั้งหมด',
    'customers_by_category': 'สัดส่วนลูกค้าแยกตามประเภท (วงกลม Donut)',
    'customers_mtd': 'ลูกค้าใหม่เดือนนี้ (MTD)',
    'customers_ytd': 'ลูกค้าใหม่สะสมปีนี้ (YTD)',
    'total_revenue': 'จำนวนรายได้รวม',
    'revenue_mtd': 'รายได้เดือนนี้ (MTD)',
    'revenue_ytd': 'รายได้สะสมปีนี้ (YTD)',
    'total_orders': 'จำนวน Order ทั้งหมด',
    'orders_mtd': 'Order เดือนนี้ (MTD)',
    'orders_ytd': 'Order สะสมปีนี้ (YTD)',
    'avg_order_value': 'มูลค่าเฉลี่ยต่อออเดอร์ (AOV)',
    'lists_segments': 'รายการและเซกเมนต์',
    'contacts': 'รายชื่อผู้ติดต่อ',
    'sales_pipeline': 'ขั้นตอนการขาย',
    'companies': 'บริษัท',
    'reports': 'รายงาน',
    'search_vcrm': 'ค้นหา VCRM (Ctrl+K)...',
    'create': 'สร้างใหม่',
    'portal_id': 'รหัสพอร์ทัล',
    
    // Sidebar
    'crm_sales': 'CRM & การขาย',
    'field_operations': 'งานบริการหน้างาน ⚡',
    'workspace_settings': 'ตั้งค่าพื้นที่ทำงาน',
    'enterprise_pro': 'ระดับองค์กร Pro',
    'search_crm': 'ค้นหาใน CRM...',
    'home': 'หน้าหลัก',
    'workspaces': 'พื้นที่ทำงาน',
    'notifications': 'การแจ้งเตือน',
    'inbox_updates': 'กล่องข้อความ / อัปเดต',
    'favorites': 'รายการโปรด',
    
    // Board Names
    'board-5030723273': 'ข้อตกลงและขั้นตอนการขาย',
    'board-leads': 'ข้อมูลลูกค้าเป้าหมาย 2026',
    'board-accounts': 'บัญชีลูกค้ารายใหญ่',
    'board-contacts': 'ผู้ติดต่อและผู้มีส่วนได้ส่วนเสีย',
    'board-growth': 'การคาดการณ์และเป้าหมายการขาย',
    'board-delivery': '🚚 งานจัดส่งสินค้า',
    'board-install': '🛠️ งานติดตั้งระบบ',
    'board-renovate': '🏗️ งานปรับปรุงและตกแต่ง',
    'board-maintain': '⚡ งานซ่อมบำรุง',
    
    // Board Views & Toolbar
    'view_table': 'ตาราง',
    'view_kanban': 'คัมบัง',
    'view_dispatch': 'ตารางคิวงานช่าง',
    'view_dashboard': 'แดชบอร์ด',
    'view_activity': 'ประวัติกิจกรรม',
    'new_item': 'เพิ่มรายการใหม่',
    'export_excel': 'ส่งออกไฟล์ Excel',
    'import_excel': 'นำเข้าไฟล์ Excel',
    'search_items': 'ค้นหารายการ...',
    'filter_by_owner': 'กรองตามผู้รับผิดชอบ',
    'all_owners': 'ผู้รับผิดชอบทั้งหมด',
    
    // Table Columns
    'col_item_name': 'ชื่อรายการ',
    'col_status': 'สถานะ',
    'col_priority': 'ความสำคัญ',
    'col_owner': 'ผู้รับผิดชอบ',
    'col_expected_close': 'วันที่คาดว่าจะปิด',
    'col_notes': 'บันทึกเพิ่มเติม',
    'col_contact_person': 'ผู้ติดต่อ',
    'col_contact_email': 'อีเมลผู้ติดต่อ',
    'col_deal_value': 'มูลค่าข้อตกลง',
    'col_probability': 'โอกาสสำเร็จ',
    'col_created_at': 'สร้างเมื่อ',
    'col_address': 'ที่อยู่',
    'col_phone': 'เบอร์โทรศัพท์',
    'col_action': 'ดำเนินการ',
    
    // Additional Columns
    'Lead / Opportunity': 'ลูกค้าเป้าหมาย / โอกาส',
    'Company / Account': 'บริษัท / บัญชี',
    'Contact Name': 'ชื่อผู้ติดต่อ',
    'Sales Representative': 'ตัวแทนฝ่ายขาย',
    'Deal / Account': 'ข้อตกลง / บัญชี',
    'Job Title / Role': 'ตำแหน่งงาน / บทบาท',
    'Industry': 'อุตสาหกรรม',
    'Account Tier': 'ระดับบัญชี',
    'Role Type': 'ประเภทบทบาท',
    'Stage / Status': 'ขั้นตอน / สถานะ',
    'Value': 'มูลค่า',
    'Primary Contact': 'ผู้ติดต่อหลัก',
    'Organization / Company': 'องค์กร / บริษัท',
    'Close Date': 'วันปิดการขาย',
    'Achievement %': 'ความสำเร็จ %',
    
    // Table Buttons / UI
    'add_item': 'เพิ่มรายการ',
    'add_group': 'เพิ่มกลุ่ม',
    'convert': 'แปลงสถานะ',
    'convert_lead': 'แปลงเป็น Deal ข้อตกลง',
    'delete': 'ลบ',
    'sum': 'รวม',
    'items': 'รายการ',
    'Average': 'ค่าเฉลี่ย',
    'Add New Group': 'เพิ่มกลุ่มใหม่',
    'Cancel': 'ยกเลิก',
    'Filter': 'ตัวกรอง',
    'Sort': 'เรียงลำดับ',
    
    // Toast notifications
    'toast_updated_success': 'อัปเดตข้อมูลสำเร็จ',
    'toast_status_updated': 'อัปเดตสถานะเป็น',
    'toast_item_deleted': 'ลบรายการแล้ว',
    'toast_added': 'เพิ่ม',
    'toast_added_group': 'เพิ่มกลุ่ม',
    'toast_converted': 'แปลง',
    'toast_to_deals': 'เป็น Deal ในขั้นตอนการขายสำเร็จ!',
    'toast_imported': 'นำเข้าข้อมูลสำเร็จแล้ว',
    'toast_exported': 'ส่งออกข้อมูล',
    'toast_to_excel': 'ไปยัง Excel เรียบร้อยแล้ว!',
    
    // Drawer & Modals
    'record_details': 'รายละเอียดบันทึกข้อมูล',
    'contact_info': 'ข้อมูลติดต่อ',
    'close': 'ปิด',
    'save': 'บันทึก',
    'lead_converted_msg': 'แปลงจาก Lead ลูกค้าเป้าหมายเมื่อ',
    'import_title': 'นำเข้าจาก Excel / CSV',
    'import_desc': 'เลือกไฟล์ Excel หรือ CSV เพื่อนำเข้าข้อมูลลงในกลุ่มปัจจุบัน',
    'select_file': 'เลือกไฟล์ Excel/CSV',
    'download_template': 'ดาวน์โหลดไฟล์เทมเพลต',
    'upload_process': 'อัปโหลดและประมวลผล',
    'target_group': 'กลุ่มเป้าหมาย',
    'no_file_selected': 'ยังไม่ได้เลือกไฟล์',
    'Preview Data': 'ตัวอย่างข้อมูล',
    'Ready to import': 'พร้อมนำเข้าข้อมูล',
    'and_more_rows': 'และรายการอื่น ๆ อีก...',
    
    // Statuses
    'Working on it': 'กำลังดำเนินการ',
    'Proposal Sent': 'ส่งใบเสนอราคาแล้ว',
    'Negotiation': 'กำลังเจรจาต่อรอง',
    'Closed Won': 'ปิดการขายสำเร็จ',
    'Qualified': 'ผ่านเกณฑ์เบื้องต้น',
    'New Lead': 'ผู้ติดต่อใหม่',
    'Contacted': 'ติดต่อแล้ว',
    'Unqualified': 'ไม่ผ่านเกณฑ์',
    'Pending': 'รอดำเนินการ',
    'Scheduled': 'กำหนดวันแล้ว',
    'In Progress': 'กำลังทำหน้างาน',
    'Completed': 'เสร็จสิ้นเรียบร้อย',
    
    // Priorities
    'Low': 'ต่ำ',
    'Medium': 'ปานกลาง',
    'High': 'สูง',
    'Critical': 'ด่วนที่สุด',
    
    // Dashboard View
    'pipeline_analytics': 'การวิเคราะห์ขั้นตอนการขาย',
    'total_pipeline_value': 'มูลค่าท่อการขายทั้งหมด',
    'win_rate': 'อัตราปิดการขายสำเร็จ',
    'avg_deal_value': 'มูลค่าดีลเฉลี่ย',
    'deals_by_status': 'ดีลแบ่งตามสถานะ',
    'deals_value_by_stage': 'มูลค่าดีลในแต่ละขั้นตอน',
    'team_contribution': 'ผลงานรายบุคคลในทีม',
    'active_deals_count': 'จำนวนดีลที่กำลังดำเนินการ',
    
    // HubSpot lists & contacts
    'all_lists': 'รายการทั้งหมด',
    'search_lists': 'ค้นหารายการ...',
    'list_name': 'ชื่อรายการ',
    'records': 'จำนวนบันทึก',
    'created': 'สร้างเมื่อ',
    'last_updated': 'อัปเดตล่าสุด',
    'active_contacts': 'ผู้ติดต่อที่ใช้งานอยู่',
    'contact_detail': 'รายละเอียดผู้ติดต่อ',
    'timeline': 'ไทม์ไลน์กิจกรรม',
    'associations': 'ข้อมูลเชื่อมโยง',
    
    // Board Header custom actions
    'Automate': 'ระบบอัตโนมัติ',
    'Share': 'แชร์',
    'action_new_lead': 'เพิ่มลูกค้าเป้าหมายใหม่',
    'action_new_account': 'เพิ่มบัญชีใหม่',
    'action_new_contact': 'เพิ่มผู้ติดต่อใหม่',
    'action_new_deal': 'เพิ่มดีลใหม่',

    // Dispatch Board Translations
    'GPS Live Dispatch': 'จ่ายงานแบบสดผ่าน GPS',
    'Active Field Units': 'ทีมช่างหน้างานที่กำลังทำงาน',
    'FIELD TECHNICIAN & VEHICLE': 'ช่างบริการภาคสนามและยานพาหนะ',
    'Skills / Vehicle': 'ทักษะความชำนาญ / ยานพาหนะ',
    'available': 'ว่าง',
    'busy': 'มีงานเข้า',
    'transit': 'กำลังเดินทาง',
    'Ticket ID': 'รหัสใบงาน',
    'Customer Contact': 'ข้อมูลการติดต่อลูกค้า',
    'Scheduled Appointment': 'การนัดหมายตามกำหนดเวลา',
    'Assigned': 'ผู้รับผิดชอบงาน',
    'Proof of Work': 'หลักฐานการทำงานและจัดส่ง (ภาพถ่าย & ลายเซ็น)',
    'Before Work': '📸 รูปภาพก่อนเริ่มงาน',
    'After Work': '📸 รูปภาพหลังงานเสร็จ',
    'E-Signature': '✍️ ลายเซ็นลูกค้า',
    'Verified E-Sign': '✓ ยืนยันลายเซ็นดิจิทัลแล้ว',
    'Photo Captured': 'บันทึกรูปภาพแล้ว',
    'Project Milestones': 'ความคืบหน้างวดงานของโครงการ',
    'Spare Parts Used': 'รายการอะไหล่และวัสดุที่ใช้ไป',
    'Item / Part Name': 'ชื่ออะไหล่ / วัสดุอุปกรณ์',
    'Qty': 'จำนวน',
    'Unit Price': 'ราคาต่อหน่วย',
    'Total': 'รวมเงิน',
    'Open Google Maps': 'เปิดเส้นทางนำทาง Google Maps',
    'Approve & Close Job': 'อนุมัติและปิดใบงาน',
    'All Services': 'บริการทั้งหมด',
    'Move': 'ย้ายไปที่',
    'No deals in this stage': 'ไม่มีดีลในขั้นตอนนี้',

    // Additional Dashboard keys
    'Won vs Total Opportunities': 'ปิดการขายสำเร็จเทียบกับโอกาสทั้งหมด',
    'Across all stages': 'ครอบคลุมทุกขั้นตอน',
    'Active Deals Managed': 'ดีลที่กำลังดูแลอยู่',
    'Quota on track': 'เป้าหมายเป็นไปตามแผน',
    'Top High-Value Deals': 'ดีลมูลค่าสูงสุดในท่อการขาย',

    // Activity Log
    'Board Activity & Audit Trail': 'ประวัติกิจกรรมกระดานและบันทึกการตรวจสอบ',
    'logs_recorded': 'บันทึกประวัติกิจกรรมย้อนหลังสำเร็จ',
    'No activity logged yet.': 'ยังไม่มีประวัติกิจกรรมบันทึกไว้',

    // Item Drawer
    'Record': 'บันทึกข้อมูล',
    'Value / Quota': 'มูลค่า / โควต้า',
    'Updates & Notes': 'ข้อมูลอัปเดต & บันทึกเพิ่มเติม',
    'Details & Strategic Parameters': 'รายละเอียดและพารามิเตอร์เชิงยุทธศาสตร์',
    'update_placeholder': 'เขียนข้อมูลอัปเดต บันทึกการประชุม หรือระบุเพื่อนร่วมทีมด้วย @...',
    'AI Enhance': 'ปรับปรุงด้วย AI',
    'Update': 'อัปเดต',
    'Timeline Activity': 'กิจกรรมในไทม์ไลน์',
    'No updates logged yet. Post the first update above!': 'ยังไม่มีประวัติการอัปเดต เขียนบันทึกแรกได้เลยที่ด้านบน!',
    'Company & Contact Information': 'ข้อมูลบริษัทและข้อมูลการติดต่อ',
    'Company / Organization': 'บริษัท / องค์กร',
    'Lead Source': 'แหล่งที่มาลูกค้า',
    'Commercial Parameters & Forecast': 'พารามิเตอร์ทางการค้าและการคาดการณ์',
    'Target Close Date': 'วันที่คาดว่าจะปิดงาน',
    'Internal Strategic Notes': 'บันทึกยุทธศาสตร์ภายในองค์กร',

    // HubSpot Contacts Saved Views
    'All Contacts': 'ผู้ติดต่อทั้งหมด',
    'My Contacts': 'ผู้ติดต่อของฉัน',
    'Unassigned Contacts': 'ผู้ติดต่อที่ไม่มีผู้ดูแล',
    'MQL Contacts': 'ลูกค้าเป้าหมายฝ่ายการตลาด (MQL)',
    'Closed Customers': 'ปิดดีลลูกค้าสำเร็จ',
    'My lists': 'รายการของฉัน',
    'search_contacts': 'ค้นหาผู้ติดต่อ, บริษัท, อีเมล...',
    'Log Note or Quick Update': 'บันทึกโน้ตหรือข้อมูลอัปเดตด่วน'
  },
  zh: {
    // Nav tabs
    'dashboard': '仪表板',
    'dashboard_overview': '企业 CRM 与销售综合仪表板',
    'total_customers': '总客户数量',
    'customers_by_category': '按类型客户占比 (环形图)',
    'customers_mtd': '本月新增客户 (MTD)',
    'customers_ytd': '本年累计客户 (YTD)',
    'total_revenue': '总营业收入',
    'revenue_mtd': '本月营收 (MTD)',
    'revenue_ytd': '本年营收 (YTD)',
    'total_orders': '总订单数量',
    'orders_mtd': '本月订单 (MTD)',
    'orders_ytd': '本年订单 (YTD)',
    'avg_order_value': '平均客单价 (AOV)',
    'lists_segments': '列表与客群',
    'contacts': '联系人',
    'sales_pipeline': '销售管道',
    'companies': '公司',
    'reports': '分析报告',
    'search_vcrm': '搜索 VCRM (Ctrl+K)...',
    'create': '创建',
    'portal_id': '门户 ID',
    
    // Sidebar
    'crm_sales': 'CRM 与销售',
    'field_operations': '现场服务运营 ⚡',
    'workspace_settings': '工作区设置',
    'enterprise_pro': '企业专业版',
    'search_crm': '搜索 CRM...',
    'home': '首页',
    'workspaces': '工作区',
    'notifications': '通知公告',
    'inbox_updates': '收件箱 / 动态',
    'favorites': '收藏夹',
    
    // Board Names
    'board-5030723273': '交易与销售管道',
    'board-leads': '2026年入站线索',
    'board-accounts': '关键企业客户',
    'board-contacts': '联系人与干系人',
    'board-growth': '销售预测与目标',
    'board-delivery': '🚚 物流配送',
    'board-install': '🛠️ 设备安装',
    'board-renovate': '🏗️ 装修改造',
    'board-maintain': '⚡ 售后维护',
    
    // Board Views & Toolbar
    'view_table': '表格',
    'view_kanban': '看板',
    'view_dispatch': '派工看板',
    'view_dashboard': '仪表盘',
    'view_activity': '活动日志',
    'new_item': '新增项目',
    'export_excel': '导出为 Excel',
    'import_excel': '导入 Excel',
    'search_items': '搜索项目...',
    'filter_by_owner': '按负责人过滤',
    'all_owners': '所有负责人',
    
    // Table Columns
    'col_item_name': '项目名称',
    'col_status': '状态',
    'col_priority': '优先级',
    'col_owner': '负责人',
    'col_expected_close': '预计结案日期',
    'col_notes': '备注信息',
    'col_contact_person': '联系人',
    'col_contact_email': '联系人邮箱',
    'col_deal_value': '交易金额',
    'col_probability': '赢单概率',
    'col_created_at': '创建时间',
    'col_address': '联系地址',
    'col_phone': '联系电话',
    'col_action': '操作',
    
    // Additional Columns
    'Lead / Opportunity': '销售线索 / 机会',
    'Company / Account': '公司 / 账户',
    'Contact Name': '联系人姓名',
    'Sales Representative': '销售代表',
    'Deal / Account': '交易 / 账户',
    'Job Title / Role': '职位 / 角色',
    'Industry': '行业',
    'Account Tier': '账户层级',
    'Role Type': '角色类型',
    'Stage / Status': '阶段 / 状态',
    'Value': '价值',
    'Primary Contact': '主要联系人',
    'Organization / Company': '组织 / 公司',
    'Close Date': '关闭日期',
    'Achievement %': '达成率 %',
    
    // Table Buttons / UI
    'add_item': '添加项目',
    'add_group': '添加分组',
    'convert': '转换',
    'convert_lead': '转换为交易',
    'delete': '删除',
    'sum': '总计',
    'items': '项',
    'Average': '平均值',
    'Add New Group': '添加新分组',
    'Cancel': '取消',
    'Filter': '筛选',
    'Sort': '排序',
    
    // Toast notifications
    'toast_updated_success': '记录更新成功',
    'toast_status_updated': '状态已更新为',
    'toast_item_deleted': '记录已删除',
    'toast_added': '已添加',
    'toast_added_group': '已添加分组',
    'toast_converted': '已转换',
    'toast_to_deals': '至销售交易管道！',
    'toast_imported': '成功导入了',
    'toast_exported': '已导出',
    'toast_to_excel': '为 Excel 文件！',
    
    // Drawer & Modals
    'record_details': '记录详情',
    'contact_info': '联系人信息',
    'close': '关闭',
    'save': '保存',
    'lead_converted_msg': '转化自线索于',
    'import_title': '从 Excel / CSV 导入数据',
    'import_desc': '支持标准列标头：Name, Contact, Email, Phone, Value, Status',
    'select_file': '点击或拖拽 Excel (.xlsx) / CSV 文件至此处',
    'download_template': '下载模板',
    'upload_process': '上传并处理',
    'target_group': '目标分组',
    'no_file_selected': '未选择任何文件',
    'Preview Data': '预览数据',
    'Ready to import': '就绪以进行导入',
    'and_more_rows': '以及其他行 data...',
    
    // Statuses
    'Working on it': '进行中',
    'Proposal Sent': '方案已发送',
    'Negotiation': '商务谈判',
    'Closed Won': '赢单结案',
    'Qualified': '已确认意向',
    'New Lead': '新线索',
    'Contacted': '已联系',
    'Unqualified': '非意向客户',
    'Pending': '等待中',
    'Scheduled': '已排期',
    'In Progress': '现场施工中',
    'Completed': '已完成',
    
    // Priorities
    'Low': '低',
    'Medium': '中',
    'High': '高',
    'Critical': '紧急',
    
    // Dashboard View
    'pipeline_analytics': '销售漏斗分析',
    'total_pipeline_value': '管道总金额',
    'win_rate': '赢单率',
    'avg_deal_value': '平均交易额',
    'deals_by_status': '各状态交易数',
    'deals_value_by_stage': '各阶段交易金额',
    'team_contribution': '团队成员业绩贡献',
    'active_deals_count': '进行中交易数',
    
    // HubSpot lists & contacts
    'all_lists': '所有列表',
    'search_lists': '搜索列表...',
    'list_name': '列表名称',
    'records': '记录数',
    'created': '创建于',
    'last_updated': '最后更新',
    'active_contacts': '活跃联系人',
    'contact_detail': '联系人详情',
    'timeline': '活动时间线',
    'associations': '关联项',
    
    // Board Header custom actions
    'Automate': '自动化',
    'Share': '共享',
    'action_new_lead': '新增客户线索',
    'action_new_account': '新增客户账户',
    'action_new_contact': '新增联系人',
    'action_new_deal': '新增交易',

    // Dispatch Board Translations
    'GPS Live Dispatch': 'GPS 实时派工',
    'Active Field Units': '个活跃外勤团队',
    'FIELD TECHNICIAN & VEHICLE': '外勤技术员与车辆',
    'Skills / Vehicle': '技能专长 / 车辆',
    'available': '空闲',
    'busy': '忙碌',
    'transit': '在途',
    'Ticket ID': '工单 ID',
    'Customer Contact': '客户联系信息',
    'Scheduled Appointment': '预约服务时间',
    'Assigned': '指派技术员',
    'Proof of Work': '工作或交付凭证 (照片 and 签名)',
    'Before Work': '📸 施工前照片',
    'After Work': '📸 施工后照片',
    'E-Signature': '✍️ 客户签名',
    'Verified E-Sign': '✓ 电子签名已验证',
    'Photo Captured': '照片已拍摄',
    'Project Milestones': '项目阶段里程碑',
    'Spare Parts Used': '备件与材料消耗清单',
    'Item / Part Name': '备件 / 材料名称',
    'Qty': '数量',
    'Unit Price': '单价',
    'Total': '总金额',
    'Open Google Maps': '打开谷歌地图导航',
    'Approve & Close Job': '审核并关闭工单',
    'All Services': '所有服务类型',
    'Move': '移动到',
    'No deals in this stage': '此阶段暂无交易',

    // Additional Dashboard keys
    'Won vs Total Opportunities': '赢单与全部机会占比',
    'Across all stages': '跨所有管道阶段',
    'Active Deals Managed': '个活跃交易管理中',
    'Quota on track': '业绩达标',
    'Top High-Value Deals': '销售管道中高价值交易 Top 5',

    // Activity Log
    'Board Activity & Audit Trail': '看板活动与审计记录',
    'logs_recorded': '条历史日志已成功记录',
    'No activity logged yet.': '暂无活动日志',

    // Item Drawer
    'Record': '记录',
    'Value / Quota': '金额 / 配额',
    'Updates & Notes': '动态与备注',
    'Details & Strategic Parameters': '详细参数与战略指标',
    'update_placeholder': '撰写动态、会议纪要，或使用 @ 提及团队成员...',
    'AI Enhance': 'AI 优化',
    'Update': '发布动态',
    'Timeline Activity': '活动时间线',
    'No updates logged yet. Post the first update above!': '暂无动态记录。在上方发布第一条动态吧！',
    'Company & Contact Information': '公司与联系人信息',
    'Company / Organization': '公司 / 组织',
    'Lead Source': '线索来源',
    'Commercial Parameters & Forecast': '商务参数与预测',
    'Target Close Date': '目标关闭日期',
    'Internal Strategic Notes': '内部战略备注',

    // HubSpot Contacts Saved Views
    'All Contacts': '全部联系人',
    'My Contacts': '我的联系人',
    'Unassigned Contacts': '未分配的联系人',
    'MQL Contacts': '市场合格线索 (MQL)',
    'Closed Customers': '已结案客户',
    'My lists': '我的列表',
    'search_contacts': '搜索联系人、公司、邮箱...',
    'Log Note or Quick Update': '记录备注或快捷动态'
  },
  ja: {
    // Nav tabs
    'dashboard': 'ダッシュボード',
    'dashboard_overview': 'エグゼクティブ CRM & 売上ダッシュボード',
    'total_customers': '総顧客数',
    'customers_by_category': '顧客種別内訳 (ドーナツグラフ)',
    'customers_mtd': '当月新規顧客 (MTD)',
    'customers_ytd': '年間累計顧客 (YTD)',
    'total_revenue': '総売上高',
    'revenue_mtd': '当月売上高 (MTD)',
    'revenue_ytd': '年間売上高 (YTD)',
    'total_orders': '総注文数',
    'orders_mtd': '当月注文数 (MTD)',
    'orders_ytd': '年間注文数 (YTD)',
    'avg_order_value': '平均注文単価 (AOV)',
    'lists_segments': 'リストとセグメント',
    'contacts': '連絡先',
    'sales_pipeline': 'セールスパイプライン',
    'companies': '企業',
    'reports': '分析レポート',
    'search_vcrm': 'VCRMを検索 (Ctrl+K)...',
    'create': '新規作成',
    'portal_id': 'ポータルID',
    
    // Sidebar
    'crm_sales': 'CRM & セールス',
    'field_operations': 'フィールド業務 ⚡',
    'workspace_settings': 'ワークスペース設定',
    'enterprise_pro': 'エンタープライズ Pro',
    'search_crm': 'CRMを検索...',
    'home': 'ホーム',
    'workspaces': 'ワークスペース',
    'notifications': '通知一覧',
    'inbox_updates': '受信トレイ / アップデート',
    'favorites': 'お気に入り',
    
    // Board Names
    'board-5030723273': '取引 & セールスパイプライン',
    'board-leads': 'インバウンドリード 2026',
    'board-accounts': '重要企業アカウント',
    'board-contacts': '連絡先 & 関係者',
    'board-growth': '売上予測 & 目標値',
    'board-delivery': '🚚 配送管理',
    'board-install': '🛠️ 設置工事',
    'board-renovate': '🏗️ リノベーション',
    'board-maintain': '⚡ アフターサービス',
    
    // Board Views & Toolbar
    'view_table': 'テーブル',
    'view_kanban': 'カンバン',
    'view_dispatch': '配車ボード',
    'view_dashboard': 'ダッシュボード',
    'view_activity': '操作履歴',
    'new_item': '新規アイテム',
    'export_excel': 'Excelに書き出し',
    'import_excel': 'Excelから読み込み',
    'search_items': 'アイテムを検索...',
    'filter_by_owner': '担当者でフィルター',
    'all_owners': 'すべての担当者',
    
    // Table Columns
    'col_item_name': 'アイテム名',
    'col_status': 'ステータス',
    'col_priority': '優先度',
    'col_owner': '担当者',
    'col_expected_close': '完了予定日',
    'col_notes': '社内メモ',
    'col_contact_person': 'キーマン連絡先',
    'col_contact_email': 'メールアドレス',
    'col_deal_value': '取引金額',
    'col_probability': '成約確度',
    'col_created_at': '作成日時',
    'col_address': '住所',
    'col_phone': '電話番号',
    'col_action': '操作',
    
    // Additional Columns
    'Lead / Opportunity': 'リード / 商談',
    'Company / Account': '企業 / アカウント',
    'Contact Name': '連絡先氏名',
    'Sales Representative': '営業担当者',
    'Deal / Account': '取引 / アカウント',
    'Job Title / Role': '職位 / 役割',
    'Industry': '業界',
    'Account Tier': '顧客ランク',
    'Role Type': 'ロール種別',
    'Stage / Status': 'フェーズ / ステータス',
    'Value': '金額',
    'Primary Contact': '第一連絡先',
    'Organization / Company': '所属組織 / 企業',
    'Close Date': '受注日',
    'Achievement %': '目標達成率 %',
    
    // Table Buttons / UI
    'add_item': 'アイテムを追加',
    'add_group': 'グループを追加',
    'convert': '変換',
    'convert_lead': 'リードを商談に変換',
    'delete': '削除',
    'sum': '合計',
    'items': '件',
    'Average': '平均値',
    'Add New Group': '新しいグループを追加',
    'Cancel': 'キャンセル',
    'Filter': 'フィルター',
    'Sort': '並び替え',
    
    // Toast notifications
    'toast_updated_success': '正常に更新しました',
    'toast_status_updated': 'ステータスを更新しました：',
    'toast_item_deleted': 'アイテムを削除しました',
    'toast_added': '追加完了：',
    'toast_added_group': '新しいグループを追加しました',
    'toast_converted': 'リードを変換しました',
    'toast_to_deals': '取引パイプラインに追加されました！',
    'toast_imported': 'インポート完了：',
    'toast_exported': '書き出しました：',
    'toast_to_excel': 'Excelファイル！',
    
    // Drawer & Modals
    'record_details': '詳細情報',
    'contact_info': '連絡先情報',
    'close': '閉じる',
    'save': '保存',
    'lead_converted_msg': 'リード変換日時：',
    'import_title': 'Excel / CSV ファイルからインポート',
    'import_desc': '対応する標準ヘッダー：名前、連絡先、メール、電話、金額、ステータス',
    'select_file': '読み込むファイルをここに選択またはドラッグ＆ドロップしてください',
    'download_template': 'テンプレートのダウンロード',
    'upload_process': 'ファイルを送信する',
    'target_group': '追加先グループ',
    'no_file_selected': 'ファイルが選ばれていません',
    'Preview Data': 'プレビュー',
    'Ready to import': 'インポート準備完了',
    'and_more_rows': '他 {count} 行データ...',
    
    // Statuses
    'Working on it': '対応中',
    'Proposal Sent': '提案書提出済み',
    'Negotiation': '交渉中',
    'Closed Won': '成約',
    'Qualified': '確認完了',
    'New Lead': '新規',
    'Contacted': '連絡済み',
    'Unqualified': '対象外',
    'Pending': '保留中',
    'Scheduled': '予定済み',
    'In Progress': '作業進行中',
    'Completed': '完了',
    
    // Priorities
    'Low': '低',
    'Medium': '中',
    'High': '高',
    'Critical': '最優先',
    
    // Dashboard View
    'pipeline_analytics': 'パイプライン分析',
    'total_pipeline_value': '見込み総額',
    'win_rate': '受注成約率',
    'avg_deal_value': '平均商談単価',
    'deals_by_status': 'ステータス別案件数',
    'deals_value_by_stage': 'フェーズ別パイプライン金額',
    'team_contribution': '営業成績貢献度',
    'active_deals_count': '稼働中案件数',
    
    // HubSpot lists & contacts
    'all_lists': 'すべてのリスト',
    'search_lists': 'リストを検索...',
    'list_name': 'リスト名',
    'records': 'レコード数',
    'created': '作成日',
    'last_updated': '最終更新',
    'active_contacts': 'アクティブ連絡先',
    'contact_detail': '顧客詳細プロフィール',
    'timeline': 'タイムライン履歴',
    'associations': '関連関連オブジェクト',
    
    // Board Header custom actions
    'Automate': '自動化',
    'Share': '共有',
    'action_new_lead': '新規リードを追加',
    'action_new_account': '新規アカウントを追加',
    'action_new_contact': '新規顧客連絡先を追加',
    'action_new_deal': '新規取引案件を追加',

    // Dispatch Board Translations
    'GPS Live Dispatch': 'GPSリアルタイム配車',
    'Active Field Units': '対応中外勤ユニット',
    'FIELD TECHNICIAN & VEHICLE': '外勤担当・車両',
    'Skills / Vehicle': '所持スキル / 使用車両',
    'available': '待機中',
    'busy': '稼働中',
    'transit': '移動中',
    'Ticket ID': '対応チケットID',
    'Customer Contact': '顧客連絡先',
    'Scheduled Appointment': '訪問予定日時',
    'Assigned': '割当外勤員',
    'Proof of Work': '作業納品証明 (サイン・完了写真)',
    'Before Work': '📸 作業前写真',
    'After Work': '📸 作業完了写真',
    'E-Signature': '✍️ 受領サイン',
    'Verified E-Sign': '✓ 署名検証完了',
    'Photo Captured': '写真撮影完了',
    'Project Milestones': 'プロジェクト進行目安',
    'Spare Parts Used': '使用された部品・資材明細',
    'Item / Part Name': '部品名・型番',
    'Qty': '個数',
    'Unit Price': '単価',
    'Total': '小計',
    'Open Google Maps': 'Googleマップでルート案内を開く',
    'Approve & Close Job': '作業完了承認＆チケットクローズ',
    'All Services': '全サービスカテゴリ',
    'Move': '移動する',
    'No deals in this stage': 'このフェーズの取引はありません',

    // Additional Dashboard keys
    'Won vs Total Opportunities': '受注と全体案件の対比',
    'Across all stages': '全ステージ',
    'Active Deals Managed': '個のアクティブ商談を担当中',
    'Quota on track': '目標達成予定',
    'Top High-Value Deals': '見込み高額案件トップ5',

    // Activity Log
    'Board Activity & Audit Trail': '操作履歴と変更ログ一覧',
    'logs_recorded': '件の更新ログが記録されています',
    'No activity logged yet.': '操作ログはありません。',

    // Item Drawer
    'Record': 'レコード詳細',
    'Value / Quota': '案件バリュー / クォータ',
    'Updates & Notes': 'アップデート & メモ',
    'Details & Strategic Parameters': '詳細・営業戦略パラメータ',
    'update_placeholder': '商談の進捗や会議の要約を記録するか、@でメンバーをメンションします...',
    'AI Enhance': 'AI校正・要約',
    'Update': '投稿する',
    'Timeline Activity': 'タイムラインアクティビティ',
    'No updates logged yet. Post the first update above!': '進捗履歴はまだありません。上の入力欄から最初の記録を投稿してください。',
    'Company & Contact Information': '企業情報 & 連絡先情報',
    'Company / Organization': '企業 / 所属組織',
    'Lead Source': 'リードソース',
    'Commercial Parameters & Forecast': '売上予測 & 商談パラメータ',
    'Target Close Date': '完了予定日',
    'Internal Strategic Notes': '社内向け営業戦略メモ',

    // HubSpot Contacts Saved Views
    'All Contacts': 'すべての連絡先',
    'My Contacts': '自分の連絡先',
    'Unassigned Contacts': '未割当の連絡先',
    'MQL Contacts': 'マーケティング適合リード (MQL)',
    'Closed Customers': 'クローズした顧客',
    'My lists': 'マイリスト',
    'search_contacts': '顧客、企業名、メールアドレスから検索...',
    'Log Note or Quick Update': 'メモの記録・クイック更新'
  }
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>('en');

  // Load saved language on mount
  useEffect(() => {
    const saved = localStorage.getItem('vcrm_language');
    if (saved === 'en' || saved === 'th' || saved === 'zh' || saved === 'ja') {
      setLanguageState(saved);
    } else {
      const navLang = navigator.language.split('-')[0];
      if (navLang === 'th') {
        setLanguageState('th');
      } else if (navLang === 'zh') {
        setLanguageState('zh');
      } else if (navLang === 'ja') {
        setLanguageState('ja');
      }
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('vcrm_language', lang);
  };

  const t = (key: string): string => {
    if (translations[language] && translations[language][key]) {
      return translations[language][key];
    }
    return key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
