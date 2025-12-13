// Export Users from Supabase
// Usage: node scripts/export-users.js [--final]
// Creates JSON backups of user data for Clerk migration

import { createClient } from '@supabase/supabase-js';
import { promises as fs } from 'fs';
import path from 'path';
import 'dotenv/config';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const isFinalExport = process.argv.includes('--final');
const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '');

async function exportUsers() {
  console.log('\n📦 Exporting Supabase Users for Clerk Migration');
  console.log(`🕐 Timestamp: ${new Date().toISOString()}`);
  console.log(`📋 Export Type: ${isFinalExport ? 'FINAL' : 'Regular'}\n`);

  try {
    // Create backups directory if it doesn't exist
    const backupDir = path.join(process.cwd(), 'backups');
    await fs.mkdir(backupDir, { recursive: true });

    // 1. Export auth users
    console.log('📥 Fetching auth users...');
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();

    if (authError) {
      throw new Error(`Failed to fetch auth users: ${authError.message}`);
    }

    console.log(`✅ Found ${authUsers.users.length} auth users`);

    // 2. Export admin users
    console.log('📥 Fetching admin users...');
    const { data: adminUsers, error: adminError } = await supabase
      .from('admin_users')
      .select('*')
      .order('created_at', { ascending: true });

    if (adminError) {
      throw new Error(`Failed to fetch admin users: ${adminError.message}`);
    }

    console.log(`✅ Found ${adminUsers.length} admin users`);

    // 3. Create admin email set for quick lookup
    const adminEmails = new Set(adminUsers.map(u => u.email.toLowerCase()));

    // 4. Transform data for Clerk migration
    const exportData = {
      exportDate: new Date().toISOString(),
      isFinalExport,
      totalUsers: authUsers.users.length,
      totalAdmins: adminUsers.length,
      users: authUsers.users.map(user => ({
        id: user.id,
        email: user.email,
        emailVerified: !!user.email_confirmed_at,
        createdAt: user.created_at,
        lastSignIn: user.last_sign_in_at,
        isAdmin: adminEmails.has(user.email.toLowerCase()),
        metadata: user.raw_user_meta_data || {},
        // Fields for Clerk migration
        clerkMapping: {
          publicMetadata: {
            dashboardAccess: adminEmails.has(user.email.toLowerCase()) ? 'real' : 'demo',
            role: adminEmails.has(user.email.toLowerCase()) ? 'admin' : 'user',
            accessGrantedDate: adminEmails.has(user.email.toLowerCase()) ? user.created_at : null,
            migratedFromSupabase: true
          },
          privateMetadata: {
            supabaseUserId: user.id,
            originalSignupDate: user.created_at,
            migrationNotes: isFinalExport ? 'Final export for production migration' : 'Pre-migration backup'
          }
        }
      }))
    };

    // 5. Generate statistics
    const stats = {
      total: exportData.totalUsers,
      admins: exportData.totalAdmins,
      regular: exportData.totalUsers - exportData.totalAdmins,
      verified: exportData.users.filter(u => u.emailVerified).length,
      unverified: exportData.users.filter(u => !u.emailVerified).length,
      active30d: exportData.users.filter(u => {
        if (!u.lastSignIn) return false;
        const daysSince = (Date.now() - new Date(u.lastSignIn).getTime()) / (1000 * 60 * 60 * 24);
        return daysSince <= 30;
      }).length
    };

    // 6. Save export files
    const filePrefix = isFinalExport ? 'FINAL_' : '';
    const usersFile = path.join(backupDir, `${filePrefix}supabase_users_${timestamp}.json`);
    const statsFile = path.join(backupDir, `${filePrefix}export_stats_${timestamp}.json`);

    await fs.writeFile(usersFile, JSON.stringify(exportData, null, 2));
    await fs.writeFile(statsFile, JSON.stringify(stats, null, 2));

    console.log('\n📊 Export Statistics:');
    console.log(`   • Total Users: ${stats.total}`);
    console.log(`   • Admins: ${stats.admins}`);
    console.log(`   • Regular Users: ${stats.regular}`);
    console.log(`   • Verified Emails: ${stats.verified}`);
    console.log(`   • Unverified Emails: ${stats.unverified}`);
    console.log(`   • Active (30 days): ${stats.active30d}`);

    console.log('\n✅ Export Complete!');
    console.log(`   Users: ${usersFile}`);
    console.log(`   Stats: ${statsFile}`);

    // 7. Validation checks
    console.log('\n🔍 Running Validation Checks...');
    const validation = {
      allEmailsPresent: exportData.users.every(u => u.email),
      allIdsPresent: exportData.users.every(u => u.id),
      allCreatedDatesPresent: exportData.users.every(u => u.createdAt),
      adminCountMatches: exportData.users.filter(u => u.isAdmin).length === adminUsers.length,
      noEmailDuplicates: new Set(exportData.users.map(u => u.email)).size === exportData.users.length
    };

    Object.entries(validation).forEach(([check, passed]) => {
      console.log(`   ${passed ? '✅' : '❌'} ${check}`);
    });

    const allChecksPassed = Object.values(validation).every(v => v);
    
    if (!allChecksPassed) {
      console.warn('\n⚠️  Some validation checks failed. Review export data before migration.');
    } else {
      console.log('\n✅ All validation checks passed!');
    }

    // 8. Generate migration preview
    console.log('\n📋 Sample User Records (first 3):');
    exportData.users.slice(0, 3).forEach((user, i) => {
      console.log(`\n   ${i + 1}. ${user.email}`);
      console.log(`      ID: ${user.id}`);
      console.log(`      Admin: ${user.isAdmin}`);
      console.log(`      Access: ${user.clerkMapping.publicMetadata.dashboardAccess}`);
      console.log(`      Role: ${user.clerkMapping.publicMetadata.role}`);
    });

    console.log('\n✅ Export script completed successfully!');
    
    if (isFinalExport) {
      console.log('\n🚨 FINAL EXPORT - Ready for production migration');
      console.log('   Next step: Run migration script to create Clerk users');
    } else {
      console.log('\n📌 Pre-migration backup created');
      console.log('   Use --final flag for production export');
    }

  } catch (error) {
    console.error('\n❌ Export failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run export
exportUsers();
