// Migrate Users from Supabase to Clerk
// Usage: node scripts/migrate-users-to-clerk.js [--dry-run] [--batch-size 50]
// Creates Clerk accounts from Supabase user export

import { clerkClient } from '@clerk/clerk-sdk-node';
import { promises as fs } from 'fs';
import path from 'path';
import 'dotenv/config';

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;

if (!CLERK_SECRET_KEY) {
  console.error('❌ Missing CLERK_SECRET_KEY environment variable');
  process.exit(1);
}

// Parse command line arguments
const isDryRun = process.argv.includes('--dry-run');
const batchSizeArg = process.argv.find(arg => arg.startsWith('--batch-size='));
const batchSize = batchSizeArg ? parseInt(batchSizeArg.split('=')[1]) : 50;

async function migrateUsers() {
  console.log('\n🚀 Clerk Migration Script');
  console.log(`🕐 Started: ${new Date().toISOString()}`);
  console.log(`🎯 Mode: ${isDryRun ? 'DRY RUN (no changes)' : 'LIVE MIGRATION'}`);
  console.log(`📦 Batch Size: ${batchSize}\n`);

  try {
    // 1. Find latest export file
    const backupDir = path.join(process.cwd(), 'backups');
    const files = await fs.readdir(backupDir);
    const exportFiles = files
      .filter(f => f.startsWith('supabase_users_') && f.endsWith('.json'))
      .sort()
      .reverse();

    if (exportFiles.length === 0) {
      throw new Error('No export files found. Run export-users.js first.');
    }

    const latestExport = exportFiles[0];
    console.log(`📂 Using export file: ${latestExport}\n`);

    // 2. Load export data
    const exportPath = path.join(backupDir, latestExport);
    const exportData = JSON.parse(await fs.readFile(exportPath, 'utf-8'));

    console.log(`📊 Export Summary:`);
    console.log(`   • Total Users: ${exportData.totalUsers}`);
    console.log(`   • Total Admins: ${exportData.totalAdmins}`);
    console.log(`   • Export Date: ${exportData.exportDate}\n`);

    // 3. Validate Clerk connection
    if (!isDryRun) {
      console.log('🔍 Validating Clerk connection...');
      try {
        await clerkClient.users.getUserList({ limit: 1 });
        console.log('✅ Clerk API connection successful\n');
      } catch (error) {
        throw new Error(`Clerk API connection failed: ${error.message}`);
      }
    }

    // 4. Process users in batches
    const results = {
      success: [],
      skipped: [],
      failed: [],
      total: exportData.users.length
    };

    console.log(`🔄 Processing ${results.total} users...\n`);

    for (let i = 0; i < exportData.users.length; i += batchSize) {
      const batch = exportData.users.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(exportData.users.length / batchSize);

      console.log(`📦 Batch ${batchNum}/${totalBatches} (${batch.length} users)`);

      for (const user of batch) {
        try {
          // Check if user already exists in Clerk
          if (!isDryRun) {
            const existingUsers = await clerkClient.users.getUserList({
              emailAddress: [user.email]
            });

            if (existingUsers.length > 0) {
              console.log(`   ⏭️  Skipped: ${user.email} (already exists in Clerk)`);
              results.skipped.push({
                email: user.email,
                reason: 'Already exists in Clerk'
              });
              continue;
            }
          }

          // Prepare user data for Clerk
          const clerkUserData = {
            emailAddress: [user.email],
            publicMetadata: user.clerkMapping.publicMetadata,
            privateMetadata: user.clerkMapping.privateMetadata,
            skipPasswordRequirement: true, // Users will set password via reset email
            skipPasswordChecks: true
          };

          if (isDryRun) {
            console.log(`   ✓ Would create: ${user.email} (${user.clerkMapping.publicMetadata.role})`);
            results.success.push({
              email: user.email,
              role: user.clerkMapping.publicMetadata.role
            });
          } else {
            // Create user in Clerk
            const clerkUser = await clerkClient.users.createUser(clerkUserData);

            // Send password setup email
            await clerkClient.users.updateUser(clerkUser.id, {
              skipPasswordRequirement: false
            });

            console.log(`   ✅ Created: ${user.email} (${user.clerkMapping.publicMetadata.role})`);
            results.success.push({
              email: user.email,
              clerkId: clerkUser.id,
              role: user.clerkMapping.publicMetadata.role
            });

            // Rate limiting: small delay between user creations
            await new Promise(resolve => setTimeout(resolve, 100));
          }

        } catch (error) {
          console.log(`   ❌ Failed: ${user.email} - ${error.message}`);
          results.failed.push({
            email: user.email,
            error: error.message
          });
        }
      }

      console.log(''); // Blank line between batches
    }

    // 5. Generate migration report
    console.log('\n═══════════════════════════════════════════');
    console.log('📊 MIGRATION REPORT');
    console.log('═══════════════════════════════════════════\n');

    console.log(`✅ Successful: ${results.success.length}/${results.total}`);
    console.log(`⏭️  Skipped: ${results.skipped.length}/${results.total}`);
    console.log(`❌ Failed: ${results.failed.length}/${results.total}`);

    const successRate = ((results.success.length / results.total) * 100).toFixed(1);
    console.log(`\n📈 Success Rate: ${successRate}%`);

    // 6. Save detailed report
    const reportDir = path.join(process.cwd(), 'migration-reports');
    await fs.mkdir(reportDir, { recursive: true });

    const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const reportFile = path.join(
      reportDir,
      `migration_report_${isDryRun ? 'DRY_RUN_' : ''}${timestamp}_${Date.now()}.json`
    );

    const report = {
      timestamp: new Date().toISOString(),
      mode: isDryRun ? 'dry-run' : 'live',
      batchSize,
      exportFile: latestExport,
      results,
      statistics: {
        total: results.total,
        successful: results.success.length,
        skipped: results.skipped.length,
        failed: results.failed.length,
        successRate: parseFloat(successRate)
      }
    };

    await fs.writeFile(reportFile, JSON.stringify(report, null, 2));
    console.log(`\n📄 Detailed report saved: ${reportFile}`);

    // 7. Show failures if any
    if (results.failed.length > 0) {
      console.log('\n❌ Failed Migrations:');
      results.failed.forEach(f => {
        console.log(`   • ${f.email}: ${f.error}`);
      });
      console.log('\n⚠️  Review failed users and migrate manually or retry');
    }

    // 8. Show next steps
    console.log('\n═══════════════════════════════════════════');
    console.log('📋 NEXT STEPS');
    console.log('═══════════════════════════════════════════\n');

    if (isDryRun) {
      console.log('This was a DRY RUN. No changes were made to Clerk.');
      console.log('\nTo perform the actual migration:');
      console.log('  node scripts/migrate-users-to-clerk.js\n');
    } else {
      console.log('✅ Migration complete!');
      console.log('\nRecommended actions:');
      console.log('1. Verify a few users can log in to Clerk');
      console.log('2. Check admin users have correct metadata');
      console.log('3. Test session persistence');
      console.log('4. Deploy Clerk-enabled code:');
      console.log('   VITE_USE_CLERK_AUTH=true');
      console.log('5. Monitor login success rate for 24 hours');
      console.log('6. Handle any failed migrations manually\n');

      if (results.failed.length > 0) {
        console.log('⚠️  Some users failed to migrate. Review the report above.');
      }
    }

    console.log('═══════════════════════════════════════════\n');

    // 9. Exit with appropriate code
    if (results.failed.length > 0) {
      process.exit(1); // Partial failure
    }

  } catch (error) {
    console.error('\n❌ Migration script failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run migration
migrateUsers();
