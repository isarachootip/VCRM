import { 
  DEFAULT_USERS, 
  DEFAULT_PASSWORDS, 
  saveUsers, 
  AuthUser 
} from '../src/lib/auth/user-store';
import { hashPassword } from '../src/lib/auth/password';

async function seedUsers() {
  console.log('===============================================================');
  console.log('  VCRM User & Password Provisioning (sysadmin, admin, manager, sales)');
  console.log('===============================================================\n');

  const users: Record<string, AuthUser> = {};
  const now = new Date().toISOString();

  for (const def of DEFAULT_USERS) {
    const rawPass = DEFAULT_PASSWORDS[def.username];
    const passwordHash = hashPassword(rawPass);

    users[def.id] = {
      ...def,
      passwordHash,
      presence: 'ONLINE',
      createdAt: now,
      updatedAt: now,
    };

    console.log(`[+] Provisioned Account:`);
    console.log(`    Username: ${def.username}`);
    console.log(`    Email:    ${def.email}`);
    console.log(`    Name:     ${def.name}`);
    console.log(`    Role:     ${def.role}`);
    console.log(`    Password: ${rawPass}`);
    console.log(`    Hash:     ${passwordHash.substring(0, 24)}...`);
    console.log('---------------------------------------------------------------');
  }

  saveUsers(users);

  console.log('\n[SUCCESS] users.json initialized successfully with 4 credentialed accounts.');
  console.log('\nQuick Summary Table:');
  console.table(
    DEFAULT_USERS.map((u) => ({
      Username: u.username,
      Role: u.role,
      Email: u.email,
      Password: DEFAULT_PASSWORDS[u.username],
    }))
  );
}

seedUsers().catch((err) => {
  console.error('Failed to seed users:', err);
  process.exit(1);
});
