const { spawn, execSync } = require('child_process');
const path = require('path');

if (process.platform !== 'win32') {
  console.log('[osv5m] skipping OSV-5M startup (not a Windows host)');
  process.exit(0);
}

try {
  execSync('netstat -ano | findstr ":8787" | findstr "LISTENING"', { shell: 'cmd.exe' });
  console.log('[osv5m] OSV-5M service already listening on :8787');
  process.exit(0);
} catch (err) {
  console.log('[osv5m] starting OSV-5M service on :8787 ...');
}

const bat = path.join(__dirname, '..', 'osv5m', 'start-osv5m.bat');
spawn(bat, [], { shell: true, detached: true, stdio: 'ignore' }).unref();
process.exit(0);