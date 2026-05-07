const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const contents = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '');

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(path.join(process.cwd(), '.env.local'));

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables.');
  console.error('Copy .env.example to .env.local and fill in NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const requiredTables = [
  'generations',
  'generation_history',
  'user_configs',
  'knowledge_base',
  'search_cache'
];

async function setupDatabase() {
  console.log('Checking Supabase database readiness...\n');
  console.log('This script verifies your project configuration.');
  console.log('If the schema has not been applied yet, run supabase/schema.sql in the Supabase SQL Editor first.\n');

  let hasFailures = false;

  for (const table of requiredTables) {
    const { error } = await supabase.from(table).select('id').limit(1);

    if (error) {
      hasFailures = true;
      console.log(`- ${table}: missing or inaccessible (${error.message})`);
    } else {
      console.log(`- ${table}: OK`);
    }
  }

  if (hasFailures) {
    console.log('\nDatabase is not ready yet.');
    console.log('Next steps:');
    console.log('1. Open the Supabase SQL Editor.');
    console.log('2. Run the contents of supabase/schema.sql.');
    console.log('3. Re-run: npm run db:setup');
    process.exit(1);
  }

  console.log('\nDatabase is ready.');
  console.log('Next steps:');
  console.log('1. Run: npm run dev');
  console.log('2. Visit: http://localhost:3000');
  console.log('3. Start generating.');
}

setupDatabase().catch((error) => {
  console.error('\nDatabase check failed:', error.message);
  process.exit(1);
});
