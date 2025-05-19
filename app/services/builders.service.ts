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

  static async addBuilder(builderData: Partial<BuilderDB>): Promise<BuilderDB | null> {
    // Ensure required fields like name and networks are present
    if (!builderData.name || !builderData.networks || builderData.networks.length === 0) {
      throw new Error("Builder name and networks are required.");
    }

    // Prepare data for insertion, setting defaults if needed
    const dataToInsert: Omit<BuilderDB, 'id' | 'created_at' | 'updated_at'> & { id?: string } = {
      name: builderData.name,
      networks: builderData.networks,
      description: builderData.description || null,
      long_description: builderData.long_description || builderData.description || null, // Use description if long_description is missing
      image_src: builderData.image_src || null,
      tags: builderData.tags || [],
      github_url: builderData.github_url || null,
      twitter_url: builderData.twitter_url || null,
      discord_url: builderData.discord_url || null,
      contributors: builderData.contributors || 0,
      github_stars: builderData.github_stars || 0,
      reward_types: builderData.reward_types || [],
      reward_types_detail: builderData.reward_types_detail || [],
      website: builderData.website || null,
      admin: builderData.admin || null,
    };

    const { data, error } = await supabase
      .from('builders')
      .insert(dataToInsert)
      .select() // Return the inserted row
      .single(); // Expecting a single row back

    if (error) {
      console.error('Error adding builder to Supabase:', error);
      throw error; // Re-throw the error to be handled by the caller
    }

    console.log('Builder added successfully to Supabase:', data);
    return data as BuilderDB;
  }
} 