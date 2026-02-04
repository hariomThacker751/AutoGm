import 'dotenv/config';

console.log('--- ENV CHECK ---');
console.log('GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID);
console.log('GOOGLE_CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET ? process.env.GOOGLE_CLIENT_SECRET.substring(0, 5) + '...' : 'MISSING');
console.log('-----------------');
