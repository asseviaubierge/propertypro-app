# Lease Expiry Notification Tests

This directory contains comprehensive tests for the lease expiry notification system.

## Test Files

### 1. `lease-expiry-notifications.test.ts`
Unit tests for the lease expiry notification system using Jest.

**What it tests:**
- Email service methods for both tenants and landlords
- Notification routing logic
- Notification automation system
- Edge cases and error handling
- Multiple notification intervals (90, 60, 30, 14, 7 days)

### 2. `../scripts/test-lease-expiry-notifications.ts`
Manual integration test script that creates real test data and verifies the system end-to-end.

**What it tests:**
- Database queries for finding expiring leases
- Multiple recipient handling (tenant, owner, manager)
- Email template data structure
- All notification intervals
- Data cleanup

## Running the Tests

### Option 1: Run Unit Tests (Jest)

**Note:** Jest is not currently configured in this project. To run Jest tests, you need to:

1. Install Jest and required dependencies:
```bash
npm install --save-dev jest @types/jest ts-jest @testing-library/jest-dom
```

2. Create `jest.config.js` in the project root:
```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
  ],
};
```

3. Add test script to `package.json`:
```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  }
}
```

4. Run the tests:
```bash
npm test
```

### Option 2: Run Manual Integration Tests

This option doesn't require Jest and tests the actual implementation with real database operations.

1. Make sure your `.env.local` file is configured with database credentials:
```env
MONGODB_URI=mongodb://localhost:27017/PropertyPro
APP_URL=http://localhost:3000
EMAIL_SERVER_HOST=smtp.gmail.com
EMAIL_SERVER_PORT=587
EMAIL_SERVER_USER=your-email@gmail.com
EMAIL_SERVER_PASSWORD=your-app-password
EMAIL_FROM=your-email@gmail.com
```

2. Run the test script:
```bash
npx tsx src/scripts/test-lease-expiry-notifications.ts
```

3. Review the output:
```
🧪 Starting Lease Expiry Notification Tests...

✅ Connected to database

📝 Setting up test data...
✅ Created test data: 5 leases

📅 Testing notification intervals...
✅ Notification interval tests completed

👥 Testing multiple recipients...
✅ Multiple recipients test completed (3 recipients)

📧 Testing email templates...
✅ Email template tests completed

🧹 Cleaning up test data...
✅ Test data cleaned up

================================================================================
📊 TEST RESULTS SUMMARY
================================================================================

✅ Test 1: Setup Test Data
   Status: PASS
   Message: Created 5 test leases with different expiry dates

✅ Test 2: Notification Interval - 90 days
   Status: PASS
   Message: Found 1 lease(s) expiring in 90 days

... (more results)

================================================================================
Total Tests: 12
✅ Passed: 12
❌ Failed: 0
⏭️  Skipped: 0
================================================================================

🎉 All tests passed!
```

## Test Coverage

The test suite covers:

### ✅ Email Service
- [x] Tenant email template generation
- [x] Landlord email template generation
- [x] Property name inclusion
- [x] Tenant name inclusion (landlord emails)
- [x] Urgent styling for leases ≤30 days
- [x] Action items for landlords
- [x] Lease ID links

### ✅ Notification Service
- [x] Email routing based on recipient type
- [x] Tenant vs landlord template selection
- [x] Data structure validation

### ✅ Notification Automation
- [x] Finding leases expiring at specific intervals
- [x] Sending to multiple recipients (tenant, owner, manager)
- [x] Avoiding duplicate notifications
- [x] Handling missing manager
- [x] Proper Mongoose population
- [x] All 5 notification intervals (90, 60, 30, 14, 7 days)

### ✅ Edge Cases
- [x] Missing tenant information
- [x] Missing property information
- [x] Multiple leases expiring same day
- [x] Active lease filtering
- [x] Soft-deleted lease exclusion
- [x] Owner and manager being the same person

### ✅ Priority Levels
- [x] Normal priority for 90 and 60 days
- [x] High priority for 30, 14, and 7 days

## Expected Behavior

When a lease is approaching expiry, the system should:

1. **Find the lease** based on the expiry date matching one of the intervals (90, 60, 30, 14, or 7 days)
2. **Send notification to tenant** with:
   - Property name
   - Expiry date
   - Days remaining
   - Renewal information
   - Link to tenant portal

3. **Send notification to property owner** with:
   - Property name
   - Tenant name
   - Expiry date
   - Days remaining
   - Action items checklist
   - Link to lease management

4. **Send notification to property manager** (if assigned and different from owner) with:
   - Same information as owner
   - Action items checklist
   - Link to lease management

## Troubleshooting

### Tests fail with "Cannot find module"
Make sure all dependencies are installed:
```bash
npm install
```

### Database connection errors
1. Ensure MongoDB is running
2. Check your `.env.local` file has correct `MONGODB_URI`
3. Verify database credentials

### Email sending errors
The manual test script doesn't actually send emails - it only verifies the data structure. To test actual email sending, you would need to:
1. Configure valid SMTP credentials in `.env.local`
2. Modify the test script to actually trigger email sending
3. Check your email inbox

## Next Steps

After running tests successfully:

1. ✅ Verify all tests pass
2. ✅ Check the notification automation is running (it runs every minute)
3. ✅ Monitor logs for any errors
4. ✅ Test with real lease data in staging environment
5. ✅ Verify emails are being sent to correct recipients

## Support

If you encounter any issues with the tests, please check:
- Database connection
- Environment variables
- Model imports
- TypeScript compilation errors

