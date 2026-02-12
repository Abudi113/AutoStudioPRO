import { supabase } from './supabaseClient';

export interface DemoRequestInput {
  firstName: string;
  lastName: string;
  email: string;
  company?: string;
  phone?: string;
  website?: string;
  stockLevel?: string;
  source: 'landing_page' | 'contact_page';
  language: string;
}

export async function submitDemoRequest(input: DemoRequestInput): Promise<void> {
  const { error } = await supabase.from('demo_requests').insert({
    first_name: input.firstName,
    last_name: input.lastName,
    email: input.email,
    company: input.company || null,
    phone: input.phone || null,
    website: input.website || null,
    stock_level: input.stockLevel || null,
    source: input.source,
    language: input.language,
  });

  if (error) {
    throw error;
  }
}
