export interface invoiceItem {
  description: string;
  quantity: string;
  price: string;
}

export interface companyData {
  name:string;
  address: string;
  city?: string; 
  phone?: string;
  email?: string;
}

export interface clientData {
   name: string;
   address?: string;
   city?: string;
   phone?: string;
   email?: string 
}
export interface invoiceData {
  documentType: string;
  company: companyData;
  client: clientData;
  number: string;
  issueDate: string;
  dueDate?: string;
  items: invoiceItem[];
  taxRate: number;
  paymentType?: string;
  notes?: string;
  subtotal?: number;
  total?: number;
  currency?: string;
}