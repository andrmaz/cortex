# Exchange OAuth tokens through one-time codes

After Google sign-in, the API redirects a short-lived, single-use code to the Admin Web, which exchanges it server-to-server for a session token stored in an HTTP-only cookie. This avoids exposing the JWT in a browser URL; the code is kept in API process memory, accepting an extra exchange endpoint and requiring the exchange to reach the API process that issued it.
