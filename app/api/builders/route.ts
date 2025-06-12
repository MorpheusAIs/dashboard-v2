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

// Helper function to extract builder name from temporary morlord ID
const extractBuilderNameFromMorlordId = (tempId: string): string => {
  // Original mapping: name.replace(/\s+/g, '-').toLowerCase() 
  // So to reverse: remove morlord- prefix, replace hyphens with spaces
  return tempId.replace(/^morlord-/, '').replace(/-/g, ' ');
};

export async function GET() {
  console.log('[API ROUTE] /api/builders route called');
  
  try {
    // Fetch data from the external API
    console.log('[API ROUTE] Attempting to fetch data from https://morlord.com/data/builders.json');
    const response = await fetch('https://morlord.com/data/builders.json', {
      // Adding a short timeout to fail fast if the service is down
      signal: AbortSignal.timeout(5000)
    });
    
    if (!response.ok) {
      console.error(`[API ROUTE] API responded with status: ${response.status} ${response.statusText}`);
      throw new Error(`Failed to fetch data: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log(`[API ROUTE] Successfully fetched data with ${Object.keys(data).length} entries`);
    
    // Extract just the names from the data
    const builderNames = Object.values(data as Record<string, MorlordBuilder>).map(builder => builder.name);
    console.log(`[API ROUTE] Extracted ${builderNames.length} builder names:`, builderNames);
    
    // Return the data with proper CORS headers
    console.log('[API ROUTE] Returning builder names with success status');
    return NextResponse.json(builderNames, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  } catch (error) {
    console.error('[API ROUTE] Error in builders API route:', error);
    
    // Return a fallback set of builder names if available, or an empty array
    console.log('[API ROUTE] Returning empty array with error status');
    return NextResponse.json([], {
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }
}

export async function POST(request: NextRequest) {
  console.log('[API ROUTE] POST /api/builders route called');
  
  try {
    const builderData = await request.json();

    // Validate required fields
    if (!builderData.name || !builderData.networks || builderData.networks.length === 0) {
      console.error('[API ROUTE] Missing required fields:', { name: builderData.name, networks: builderData.networks });
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

    console.log('[API ROUTE] Inserting builder data:', dataToInsert);

    // Insert using service client (bypasses RLS)
    const { data, error } = await supabaseService
      .from('builders')
      .insert(dataToInsert)
      .select()
      .single();

    if (error) {
      console.error('[API ROUTE] Error adding builder to Supabase:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    console.log('[API ROUTE] Builder added successfully to Supabase:', data);
    return NextResponse.json(data);

  } catch (error) {
    console.error('[API ROUTE] Error in POST builders API route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  console.log(`[API ROUTE] PATCH /api/builders route called at ${new Date().toISOString()}`);
  
  try {
    const requestData = await request.json();
    const { id, ...updateData } = requestData;

    // Validate required fields
    if (!id) {
      console.error('[API ROUTE] Missing required field: id');
      return NextResponse.json(
        { error: "Builder ID is required for updates." },
        { status: 400 }
      );
    }

    console.log(`[API ROUTE] Updating builder with ID: ${id} at ${new Date().toISOString()}`);
    console.log('[API ROUTE] Update data:', updateData);

    // Check if this is a temporary morlord ID (pattern: morlord-*)
    const isTempMorlordId = id.startsWith('morlord-');
    
    if (isTempMorlordId) {
      console.log(`[API ROUTE] Detected temporary morlord ID: ${id}`);
      
      // Extract the builder name from the temporary ID
      const builderName = extractBuilderNameFromMorlordId(id);
      console.log(`[API ROUTE] Extracted builder name: "${builderName}"`);
      
      // Validate the extracted name
      if (!builderName || builderName.trim().length === 0) {
        console.error('[API ROUTE] Invalid temporary ID format - could not extract builder name');
        return NextResponse.json(
          { error: "Invalid temporary builder ID format" },
          { status: 400 }
        );
      }
      
      // First check if a builder with this name already exists (case-insensitive)
      const { data: existingBuilder, error: findError } = await supabaseService
        .from('builders')
        .select('*')
        .filter('name', 'ilike', builderName) // Case-insensitive exact match
        .single();
      
      if (findError && findError.code !== 'PGRST116') { // PGRST116 is "not found" error
        console.error('[API ROUTE] Error checking for existing builder:', findError);
        return NextResponse.json(
          { error: `Error checking for existing builder: ${findError.message}` },
          { status: 500 }
        );
      }
      
      if (existingBuilder) {
        console.log(`[API ROUTE] Found existing builder with name "${builderName}", updating it`);
        
        // Add updated_at timestamp
        const dataToUpdate = {
          ...updateData,
          updated_at: new Date().toISOString()
        };
        
        // Update the existing builder using its real ID
        const { data, error } = await supabaseService
          .from('builders')
          .update(dataToUpdate)
          .eq('id', existingBuilder.id)
          .select()
          .single();
        
        if (error) {
          console.error('[API ROUTE] Error updating existing builder in Supabase:', error);
          return NextResponse.json(
            { error: error.message },
            { status: 500 }
          );
        }
        
        console.log(`[API ROUTE] Existing builder updated successfully at ${new Date().toISOString()}:`, data);
        return NextResponse.json(data);
      } else {
        console.log(`[API ROUTE] Builder "${builderName}" not found in database, creating it first`);
        
        // Create the builder first with minimal required data
        const dataToInsert: Omit<BuilderDB, 'id' | 'created_at' | 'updated_at'> = {
          name: builderName,
          networks: ['Base'], // Default network
          description: updateData.description || null,
          long_description: updateData.description || null,
          image_src: updateData.image_src || null,
          tags: [],
          github_url: null,
          twitter_url: null,
          discord_url: null,
          contributors: 0,
          github_stars: 0,
          reward_types: updateData.reward_types || [],
          reward_types_detail: [],
          website: updateData.website || null,
        };
        
        console.log('[API ROUTE] Creating new builder with data:', dataToInsert);
        
        const { data: newBuilder, error: insertError } = await supabaseService
          .from('builders')
          .insert(dataToInsert)
          .select()
          .single();
        
        if (insertError) {
          console.error('[API ROUTE] Error creating new builder in Supabase:', insertError);
          return NextResponse.json(
            { error: `Error creating builder: ${insertError.message}` },
            { status: 500 }
          );
        }
        
        console.log(`[API ROUTE] New builder created successfully at ${new Date().toISOString()}:`, newBuilder);
        return NextResponse.json(newBuilder);
      }
    } else {
      // Original logic for real UUIDs
      console.log(`[API ROUTE] Processing real UUID: ${id}`);
      
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
        console.error('[API ROUTE] Error updating builder in Supabase:', error);
        return NextResponse.json(
          { error: error.message },
          { status: 500 }
        );
      }

      console.log(`[API ROUTE] Builder updated successfully in Supabase at ${new Date().toISOString()}:`, data);
      return NextResponse.json(data);
    }

  } catch (error) {
    console.error('[API ROUTE] Error in PATCH builders API route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 