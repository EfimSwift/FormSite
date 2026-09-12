function unauthorized() {
  return new Response("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="FormSite", charset="UTF-8"',
    },
  });
}

function parseBasicAuth(header) {
  if (!header?.startsWith("Basic ")) return null;
  try {
    const decoded = atob(header.slice(6));
    const i = decoded.indexOf(":");
    if (i < 0) return null;
    return { user: decoded.slice(0, i), pass: decoded.slice(i + 1) };
  } catch {
    return null;
  }
}

export async function onRequest(context) {
  const expectedUser = context.env.BASIC_AUTH_USER;
  const expectedPass = context.env.BASIC_AUTH_PASS;
  if (!expectedUser || !expectedPass) {
    return context.next();
  }

  const creds = parseBasicAuth(context.request.headers.get("Authorization"));
  if (!creds || creds.user !== expectedUser || creds.pass !== expectedPass) {
    return unauthorized();
  }
  return context.next();
}
