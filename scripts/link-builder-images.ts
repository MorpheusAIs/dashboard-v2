import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
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

const BUCKET_NAME = 'builder-images';

interface Builder {
  name: string;
  localImage?: string;
}

async function linkBuilderImages() {
  try {
    // Read the builders data to get the image mappings
    const buildersJsonPath = path.join(process.cwd(), 'app/builders/predefined-builders-meta.json');
    const buildersData = JSON.parse(fs.readFileSync(buildersJsonPath, 'utf8')) as Builder[];

    // Process each builder
    for (const builder of buildersData) {
      if (builder.localImage) {
        // Get the public URL for the image
        const { data: { publicUrl } } = supabase.storage
          .from(BUCKET_NAME)
          .getPublicUrl(builder.localImage);

        // Update the builder record with the image URL
        const { error } = await supabase
          .from('builders')
          .update({ image_src: publicUrl })
          .eq('name', builder.name);

        if (error) {
          console.error(`Error updating ${builder.name}:`, error);
        } else {
          console.log(`Successfully linked image for ${builder.name}: ${publicUrl}`);
        }
      } else {
        console.log(`No image specified for ${builder.name}`);
      }
    }

    console.log('Image linking completed successfully');

    // Verify the updates
    const { data: builders, error } = await supabase
      .from('builders')
      .select('name, image_src');

    if (error) {
      console.error('Error fetching builders:', error);
    } else {
      console.log('\nVerification Results:');
      builders.forEach(b => {
        console.log(`${b.name}: ${b.image_src || 'No image'}`);
      });
    }

  } catch (error) {
    console.error('Image linking failed:', error);
    process.exit(1);
  }
}

linkBuilderImages(); 