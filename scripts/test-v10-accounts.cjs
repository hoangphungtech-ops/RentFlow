const base = process.env.RENTFLOW_API_BASE || 'http://127.0.0.1:3001/api';
const password = process.env.DEMO_PASSWORD;
if (!password) throw new Error('DEMO_PASSWORD must be provided in the test environment.');

async function request(path, options = {}) {
  return fetch(base + path, options);
}
async function main() {
  const expected = [
    ['user.demo@rentflow.test', 'user'],
    ['admin.demo@rentflow.test', 'admin'],
    ['manager.demo@rentflow.test', 'manager'],
  ];
  const results = [];
  for (const [identifier, portal] of expected) {
    const login = await request('/login', {
      method: 'POST',
      headers: {'content-type':'application/json','X-RentFlow-Web':'1'},
      body: JSON.stringify({identifier,password}),
    });
    if (!login.ok) throw new Error(identifier + ' login returned ' + login.status);
    const cookie = login.headers.get('set-cookie')?.split(';',1)[0];
    if (!cookie) throw new Error(identifier + ' login did not set a session cookie');
    const me = await request('/v10/me',{headers:{cookie,'X-RentFlow-Web':'1'}});
    const actor = await me.json();
    if (!me.ok || actor.portal !== portal) throw new Error(identifier + ' expected portal ' + portal);
    const allowedPath = portal === 'admin' ? '/v10/admin' : portal === 'user' ? '/v10/user' : '/v10/manager';
    const allowed = await request(allowedPath,{headers:{cookie,'X-RentFlow-Web':'1'}});
    if (!allowed.ok) throw new Error(identifier + ' own portal returned ' + allowed.status);
    const deniedPath = portal === 'user' ? '/v10/admin' : portal === 'manager' ? '/v10/admin' : '/v10/user';
    const denied = await request(deniedPath,{headers:{cookie,'X-RentFlow-Web':'1'}});
    if (denied.status !== 403) throw new Error(identifier + ' denied API returned ' + denied.status);
    results.push({account:identifier, portal:actor.portal, login:login.status, ownPortal:allowed.status, forbidden:denied.status});
  }
  const wrong = await request('/login',{method:'POST',headers:{'content-type':'application/json','X-RentFlow-Web':'1'},body:JSON.stringify({identifier:expected[0][0],password:password+'wrong'})});
  if (wrong.status !== 401) throw new Error('Wrong password returned ' + wrong.status);
  const anonymous = await request('/v10/me');
  if (anonymous.status !== 401) throw new Error('Anonymous access returned ' + anonymous.status);
  const escalation = await request('/auth/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({
    email:'role-escalation@rentflow.test',fullName:'Role escalation attempt',password:password,role:'ADMIN'
  })});
  if (escalation.status !== 400) throw new Error('Registration role escalation returned ' + escalation.status);
  console.log(JSON.stringify({passed:results.length*3+3,checks:results,wrongPassword:wrong.status,anonymous:anonymous.status,roleEscalation:escalation.status},null,2));
}
main().catch(error=>{console.error(error);process.exitCode=1});
