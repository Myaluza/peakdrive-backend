/* eslint-disable prettier/prettier */
import { Injectable } from '@nestjs/common'
import { createClient } from '@supabase/supabase-js'

@Injectable()
export class EventsService {
  private supabase: ReturnType<typeof createClient>;
  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Missing Supabase environment variables. Check .env file.')
    }

    this.supabase = createClient(supabaseUrl, supabaseAnonKey)
  }

  async getAllEvents() {
    const { data, error } = await this.supabase.from('events').select('*');

    if (error) {
      throw new Error(error.message);
    }
    return data;
  }
}
