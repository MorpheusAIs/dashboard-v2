import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function fixImageUrls() {
  try {
    // Fetch all builders with image_src
    const { data: builders, error } = await supabase
      .from('builders')
      .select('id, name, image_src')
      .not('image_src', 'is', null);

    if (error) {
      throw error;
    }

    console.log(`Found ${builders.length} builders with image URLs`);

    let successCount = 0;
    let errorCount = 0;

    // Process each builder
    for (const builder of builders) {
      if (!builder.image_src) continue;

      // Current URL pattern: .../builder-images/images/filename.ext
      // Correct URL pattern: .../builder-images/filename.ext
      if (builder.image_src.includes('/images/')) {
        // Create the correct URL by removing the 'images/' path segment
        const correctedUrl = builder.image_src.replace('/images/', '/');
        
        // Update the database with the corrected URL
        const { error: updateError } = await supabase
          .from('builders')
          .update({ image_src: correctedUrl })
          .eq('id', builder.id);

        if (updateError) {
          console.error(`Error updating ${builder.name}:`, updateError);
          errorCount++;
        } else {
          console.log(`Fixed URL for ${builder.name}`);
          console.log(`  From: ${builder.image_src}`);
          console.log(`  To:   ${correctedUrl}`);
          successCount++;
        }
      } else {
        console.log(`URL for ${builder.name} does not need fixing: ${builder.image_src}`);
      }
    }

    console.log(`\nURL fixing completed`);
    console.log(`Success: ${successCount} URLs fixed`);
    console.log(`Errors: ${errorCount} failures`);

    // Verify a sample of the updates
    const { data: sampleBuilders, error: sampleError } = await supabase
      .from('builders')
      .select('name, image_src')
      .limit(5);

    if (sampleError) {
      console.error('Error fetching sample builders:', sampleError);
    } else {
      console.log('\nSample of updated builders:');
      sampleBuilders.forEach(b => {
        console.log(`${b.name}: ${b.image_src || 'No image'}`);
      });
    }

  } catch (error) {
    console.error('URL fixing failed:', error);
    process.exit(1);
  }
}

fixImageUrls(); 