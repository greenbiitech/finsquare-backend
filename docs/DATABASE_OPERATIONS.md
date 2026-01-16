# Database Operations Guide

## Connection Details
```
Database: finsquare
Host: localhost
Port: 5432
User: apple
Connection String: postgresql://apple@localhost:5432/finsquare
```

## Table Names (snake_case)
| Prisma Model | Actual Table Name |
|--------------|-------------------|
| User | users |
| Membership | memberships |
| Wallet | wallets |
| Community | communities |
| CommunityWallet | community_wallets |
| CommunityInvite | community_invites |
| JoinRequest | join_requests |
| OtpVerification | otp_verifications |
| PasswordReset | password_resets |

## Column Names (camelCase with quotes)
Foreign keys use camelCase and need double quotes in SQL:
- `"userId"` - references users.id
- `"communityId"` - references communities.id
- `"walletId"` - references wallets.id

## Hard Delete User

See "Quick Commands" section below for a complete script that deletes:
- User's communities (and all community data)
- User's memberships, wallets, join requests
- User's OTP verifications and password resets
- The user record itself

## Quick Commands

### Hard delete user by email (includes their communities)
Create a file `delete_user.js` in the backend folder:
```javascript
const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://apple@localhost:5432/finsquare' });

(async () => {
  await client.connect();
  const email = 'USER_EMAIL_HERE';

  // Find user
  const res = await client.query('SELECT id FROM users WHERE email = $1', [email]);
  if (!res.rows.length) { console.log('User not found'); return; }
  const userId = res.rows[0].id;
  console.log('Found user:', userId);

  // Find communities created by this user (exclude FinSquare default)
  const communities = await client.query(
    'SELECT id, name FROM communities WHERE "createdById" = $1',
    [userId]
  );

  // Delete each community and its dependencies
  for (const community of communities.rows) {
    console.log('Deleting community:', community.name);
    await client.query('DELETE FROM join_requests WHERE "communityId" = $1', [community.id]);
    await client.query('DELETE FROM community_invites WHERE "communityId" = $1', [community.id]);
    await client.query('DELETE FROM community_wallets WHERE "communityId" = $1', [community.id]);
    await client.query('DELETE FROM memberships WHERE "communityId" = $1', [community.id]);
    await client.query('DELETE FROM communities WHERE id = $1', [community.id]);
  }

  // Delete user dependencies
  await client.query('DELETE FROM join_requests WHERE "userId" = $1', [userId]);
  await client.query('DELETE FROM memberships WHERE "userId" = $1', [userId]);
  await client.query('DELETE FROM wallets WHERE "userId" = $1', [userId]);
  await client.query('DELETE FROM password_resets WHERE "userId" = $1', [userId]);
  await client.query('DELETE FROM otp_verifications WHERE email = $1', [email]);

  // Delete user
  await client.query('DELETE FROM users WHERE id = $1', [userId]);

  console.log('Deleted user:', email);
  console.log('Deleted communities:', communities.rows.length);
})().finally(() => client.end());
```

Run with: `node delete_user.js`

### List all users
```bash
node -e "
const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://apple@localhost:5432/finsquare' });
(async () => {
  await client.connect();
  const res = await client.query('SELECT id, email, \"firstName\", \"lastName\" FROM users');
  console.table(res.rows);
})().finally(() => client.end());
"
```

### List all tables
```bash
node -e "
const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://apple@localhost:5432/finsquare' });
(async () => {
  await client.connect();
  const res = await client.query(\"SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name\");
  res.rows.forEach(r => console.log(r.table_name));
})().finally(() => client.end());
"
```

### Describe table columns
```bash
TABLE="users" && node -e "
const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://apple@localhost:5432/finsquare' });
(async () => {
  await client.connect();
  const res = await client.query('SELECT column_name, data_type FROM information_schema.columns WHERE table_name = \$1 ORDER BY ordinal_position', [process.env.TABLE]);
  console.table(res.rows);
})().finally(() => client.end());
"
```

## Delete Order (Foreign Key Dependencies)

### Hard delete user (including their communities)
1. **For each community created by user:**
   - `join_requests` (communityId)
   - `community_invites` (communityId)
   - `community_wallets` (communityId)
   - `memberships` (communityId)
   - `communities`
2. **User dependencies:**
   - `join_requests` (userId)
   - `memberships` (userId)
   - `wallets` (userId)
   - `password_resets` (userId)
   - `otp_verifications` (email - not userId)
3. **Finally:** `users`

### Delete community only
1. `join_requests` (communityId)
2. `community_invites` (communityId)
3. `community_wallets` (communityId)
4. `memberships` (communityId)
5. `communities`
