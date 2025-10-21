import { NextResponse, NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { BuilderDB } from '@/app/lib/supabase';

// Create service client for server-side operations
const supabaseService = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

interface MorlordBuilder {
  name: string;
  [key: string]: string | number;
}

export async function GET() {
  try {
    // Fetch data from the external API
    const response = await fetch('https://morlord.com/data/builders.json', {
      // Adding a short timeout to fail fast if the service is down
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch data: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // Extract just the names from the data
    const builderNames = Object.values(data as Record<string, MorlordBuilder>).map(builder => builder.name);

    // Return the data with proper CORS headers
    return NextResponse.json(builderNames, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  } catch {
    // Return empty list with 200 so clients don't treat it as an error
    return NextResponse.json([], {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const builderData = await request.json();

    // Validate required fields
    if (!builderData.name || !builderData.networks || builderData.networks.length === 0) {
      return NextResponse.json(
        { error: "Builder name and networks are required." },
        { status: 400 }
      );
    }

    // Prepare data for insertion, setting defaults if needed
    const dataToInsert: Omit<BuilderDB, 'id' | 'created_at' | 'updated_at'> = {
      name: builderData.name,
      networks: builderData.networks,
      description: builderData.description || null,
      long_description: builderData.long_description || builderData.description || null,
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
    };

    // Insert using service client (bypasses RLS)
    const { data, error } = await supabaseService
      .from('builders')
      .insert(dataToInsert)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(data);

  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const requestData = await request.json();
    const { id, ...updateData } = requestData;

    // Validate required fields
    if (!id) {
      return NextResponse.json(
        { error: "Builder ID is required for updates." },
        { status: 400 }
      );
    }

    // Add updated_at timestamp
    const dataToUpdate = {
      ...updateData,
      updated_at: new Date().toISOString()
    };

    // Update using service client (bypasses RLS)
    const { data, error } = await supabaseService
      .from('builders')
      .update(dataToUpdate)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(data);

  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 