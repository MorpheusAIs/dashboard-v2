import { supabase, BuilderDB } from '../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface BuilderWithOnChainData extends BuilderDB {
  totalStaked: number;
  minimalDeposit?: number;
  withdrawLockPeriodAfterDeposit?: number;
  stakingCount?: number;
  userStake?: number;
  image?: string;
  lockPeriod?: string;
}

export class BuildersService {
  private static subscriptionChannel: RealtimeChannel | null = null;

  static async getAllBuilders(): Promise<BuilderDB[]> {
    const { data, error } = await supabase
      .from('builders')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error fetching builders:', error);
      throw error;
    }

    return data || [];
  }

  static subscribeToBuilders(callback: (builders: BuilderDB[]) => void): () => void {
    if (this.subscriptionChannel) {
      this.subscriptionChannel.unsubscribe();
    }

    this.subscriptionChannel = supabase
      .channel('builders_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'builders',
        },
        async () => {
          // Fetch fresh data when any change occurs
          const builders = await this.getAllBuilders();
          callback(builders);
        }
      )
      .subscribe();

    return () => {
      if (this.subscriptionChannel) {
        this.subscriptionChannel.unsubscribe();
        this.subscriptionChannel = null;
      }
    };
  }

  static async getBuilderByName(name: string): Promise<BuilderDB | null> {
    const { data, error } = await supabase
      .from('builders')
      .select('*')
      .eq('name', name)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // No builder found
      }
      console.error('Error fetching builder:', error);
      throw error;
    }

    return data;
  }
} 